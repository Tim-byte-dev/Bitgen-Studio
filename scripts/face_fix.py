"""bitGen Studio — FACE FIX: the Impact Pack's FaceDetailer on the final image (2.322.0).

Tim: "is there any way to get the persons face to look 'not distorted'" ->
"please add the 2 reccommendations" (a Pose face-points switch, and a face
fix pass). A face fix re-renders each detected face at a proper size and
pastes it back - the standard ComfyUI fix, ComfyUI-Impact-Pack's
FaceDetailer with an Ultralytics face detector (Impact-Subpack's
UltralyticsDetectorProvider, models/ultralytics/bbox/face_yolov8m.pt).

apply(g, spec, seed) - a graph hook, run on the patched render graph:
  every SaveImage fed by a VAEDecode gets FaceDetailer IN BETWEEN
  (VAEDecode -> FaceDetailer -> SaveImage), in the SAME prompt, so the
  render's own models stay loaded. FaceDetailer takes that render's model,
  the text encoder behind its positive prompt, its VAE and its positive /
  negative conditioning - for a ControlNet final the conditioning BEFORE
  ControlNetApplyAdvanced (the control map is the whole picture, the face
  crop is not), steps / cfg / sampler / scheduler from its sampler.
  spec = {denoise, detector}. Pure: (graph, notes) out; a graph it cannot
  read is left alone, said.
"""
import copy

DETAILER = "FaceDetailer"
PROVIDER = "UltralyticsDetectorProvider"
DEFAULT_DETECTOR = "bbox/face_yolov8m.pt"
CLASSES = (DETAILER, PROVIDER)
CN_APPLY = ("ControlNetApplyAdvanced", "ControlNetApply")


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _node(g, link):
    return g.get(str(link[0])) if _is_link(link) else None


def _free(g, base):
    k = base
    while k in g:
        k += "_"
    return k


def _uncontrolled(g, link, key):
    """Follow a conditioning link back through ControlNet applies to the
    plain text conditioning (the face crop must not get the whole-picture map)."""
    seen = 0
    while _is_link(link) and seen < 8:
        n = _node(g, link)
        if not n or str(n.get("class_type")) not in CN_APPLY:
            return list(link)
        nxt = (n.get("inputs") or {}).get(key if key in (n.get("inputs") or {}) else "conditioning")
        if not _is_link(nxt):
            return list(link)
        link, seen = nxt, seen + 1
    return list(link) if _is_link(link) else None


def _clip_for(g, cond):
    """The CLIP link behind a conditioning (the text encoder's clip input)."""
    seen = 0
    while _is_link(cond) and seen < 8:
        n = _node(g, cond)
        ins = (n or {}).get("inputs") or {}
        if _is_link(ins.get("clip")):
            return list(ins["clip"])
        cond = next((v for k, v in ins.items() if _is_link(v) and k in ("conditioning", "conditioning_to",
                                                                         "conditioning_1", "positive")), None)
        seen += 1
    return None


def _scalar(v, default):
    return default if _is_link(v) or v is None else v


def _sampler_parts(g, sampler_link):
    """{model, positive, negative, steps, cfg, sampler_name, scheduler} from
    the node that made the decoded latent, or None."""
    s = _node(g, sampler_link)
    if not s:
        return None
    ins = s.get("inputs") or {}
    ct = str(s.get("class_type", ""))
    if _is_link(ins.get("positive")) and _is_link(ins.get("negative")) and _is_link(ins.get("model")):
        return {"model": list(ins["model"]), "positive": list(ins["positive"]), "negative": list(ins["negative"]),
                "steps": int(_scalar(ins.get("steps"), 20)), "cfg": float(_scalar(ins.get("cfg"), 7.0)),
                "sampler_name": _scalar(ins.get("sampler_name"), "euler"),
                "scheduler": _scalar(ins.get("scheduler"), "normal")}
    if ct == "SamplerCustomAdvanced":
        gd = _node(g, ins.get("guider"))
        gi = (gd or {}).get("inputs") or {}
        if not (_is_link(gi.get("model")) and _is_link(gi.get("positive")) and _is_link(gi.get("negative"))):
            return None
        sch = _node(g, ins.get("sigmas")) or {}
        sel = _node(g, ins.get("sampler")) or {}
        return {"model": list(gi["model"]), "positive": list(gi["positive"]), "negative": list(gi["negative"]),
                "steps": int(_scalar((sch.get("inputs") or {}).get("steps"), 20)),
                "cfg": float(_scalar(gi.get("cfg"), 1.0)),
                "sampler_name": _scalar((sel.get("inputs") or {}).get("sampler_name"), "euler"),
                "scheduler": _scalar((sch.get("inputs") or {}).get("scheduler"), "simple")}
    return None


def apply(g, spec, seed=0):
    if not isinstance(g, dict) or not spec:
        return g, []
    g = copy.deepcopy(g)
    notes, done = [], 0
    detector = str((spec or {}).get("detector") or "").strip() or DEFAULT_DETECTOR
    denoise = max(0.05, min(1.0, float((spec or {}).get("denoise") or 0.4)))
    for sid, save in list(g.items()):
        if not isinstance(save, dict) or "SaveImage" not in str(save.get("class_type", "")):
            continue
        img = (save.get("inputs") or {}).get("images")
        dec = _node(g, img)
        if not dec or not str(dec.get("class_type", "")).startswith("VAEDecode"):
            continue
        di = dec.get("inputs") or {}
        parts = _sampler_parts(g, di.get("samples"))
        if not parts or not _is_link(di.get("vae")):
            notes.append(f"face fix skipped for save {sid}: its sampler / VAE could not be read")
            continue
        pos = _uncontrolled(g, parts["positive"], "positive")
        neg = _uncontrolled(g, parts["negative"], "negative")
        clip = _clip_for(g, pos)
        if not (pos and neg and clip):
            notes.append(f"face fix skipped for save {sid}: no text encoder behind its prompt")
            continue
        prov = _free(g, "ff_detector")
        g[prov] = {"class_type": PROVIDER, "inputs": {"model_name": detector}}
        fd = _free(g, "ff_detailer")
        g[fd] = {"class_type": DETAILER, "_meta": {"title": "bitGen: face fix"}, "inputs": {
            "image": list(img), "model": parts["model"], "clip": clip, "vae": list(di["vae"]),
            "positive": pos, "negative": neg, "bbox_detector": [prov, 0],
            "guide_size": 512, "guide_size_for": True, "max_size": 1024,
            "seed": int(seed) & 0xFFFFFFFFFFFF, "steps": parts["steps"], "cfg": parts["cfg"],
            "sampler_name": parts["sampler_name"], "scheduler": parts["scheduler"],
            "denoise": denoise, "feather": 5, "noise_mask": True, "force_inpaint": True,
            "bbox_threshold": 0.5, "bbox_dilation": 10, "bbox_crop_factor": 3.0,
            "drop_size": 10, "wildcard": "", "cycle": 1}}
        save["inputs"]["images"] = [fd, 0]
        done += 1
    if done:
        notes.insert(0, f"face fix: FaceDetailer ({detector}, denoise {denoise:g}) before {done} save(s) - "
                        "each face re-rendered at 512 px and pasted back")
    elif not notes:
        notes.append("face fix skipped: no SaveImage fed by a VAEDecode in this graph")
    return g, notes
