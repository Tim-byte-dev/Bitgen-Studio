"""bitGen Studio — THE CONTROLNET PASS OF AN IMAGE RENDER (2.316.0).

Tim (verbatim): "add controlnet accordian menuitem to basic settings in left
docker, checkbox - use controlnet, dropdown-types, dropdown-preprocessor,
dropdown model folder, dropdown model, cfg slider, steps slider, lora folder,
lora dropdown, add lora button, lora weight slider. show the first image
generated, the controlnet preprocessor gen and the final generation in the
gallery"

With "Use ControlNet" ticked, an image job carries params.controlnet
{type, node, preprocessor, model, strength, cfg, steps, loras} and the image
worker runs THREE steps, each saved to the gallery:
  1. the FIRST image - the selected style, exactly as without ControlNet;
  2. the CONTROL MAP - that image through the type's comfyui_controlnet_aux
     preprocessor (LoadImage -> DWPreprocessor / Scribble_PiDiNet /
     LineArt / DepthAnythingV2 -> SaveImage), <first>_cnmap.png;
  3. the FINAL image - the style's workflow again, same prompt and seed, with
     ControlNetLoader + ControlNetApplyAdvanced on every sampler's positive /
     negative (a guider's single conditioning too), the ControlNet steps /
     cfg / LoRAs on top, <first>_cn.png.
2.317.0 (Tim): "the model will be a diffusion model or checkpoint, the
preprocessor will be the controlnet model from controlnet folder in comfyui,
this will generate an image in one model, create the controlnet image then
generate the image from the second model. second model can be sdxl or flux
klein etc." - params.controlnet.controlnet is the ControlNet model (the
"Preprocessor" dropdown); the annotator node runs on its own default model;
the FINAL render is the SECOND model (params.controlnet.second - an image
style that renders it, or a shipped template), at the first image's size,
with the ControlNet steps / cfg / LoRAs.
Pure graph builders + run() with the ComfyUI calls handed in (testable)."""
import shutil
from pathlib import Path

PRE_NODES = {"pose": "DWPreprocessor", "scribble": "Scribble_PiDiNet_Preprocessor",
             "lineart": "LineArtPreprocessor", "depth": "DepthAnythingV2Preprocessor",
             # 2.333.0: the image editor's control layers (Krita AI Diffusion's
             # set) - soft edge (PiDiNet), canny (ComfyUI's own core node),
             # normal (BAE), segmentation (OneFormer ADE20K)
             "softedge": "PiDiNetPreprocessor", "canny": "Canny",
             "normal": "BAE-NormalMapPreprocessor", "segmentation": "OneFormer-ADE20K-SemSegPreprocessor"}
# 2.319.0 (Tim's run: LineArtPreprocessor -> KeyError: 'coarse'): the aux
# nodes declare their switches as OPTIONAL inputs but read them as if always
# sent (ComfyUI's own front end always sends every widget). The API sends
# only what the graph holds - so every declared widget is sent: these known
# switches first, then complete_inputs() fills the rest from the live schema.
PRE_SWITCHES = {
    # 2.322.0: detect_face follows the Pose "face points" switch (off by default)
    "DWPreprocessor": {"detect_hand": "enable", "detect_body": "enable", "detect_face": "disable"},
    "Scribble_PiDiNet_Preprocessor": {"safe": "enable"},
    "LineArtPreprocessor": {"coarse": "disable"},
    "DepthAnythingV2Preprocessor": {},
    "PiDiNetPreprocessor": {"safe": "enable"},
    "BAE-NormalMapPreprocessor": {},
    "OneFormer-ADE20K-SemSegPreprocessor": {},
}
WIDGET_TYPES = ("INT", "FLOAT", "STRING", "BOOLEAN", "BOOL", "COMBO")
CN_LOADER = "ControlNetLoader"
CN_APPLY = "ControlNetApplyAdvanced"


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _free(g, base):
    k = base
    while k in g:
        k += "_"
    return k


def png_size(p):
    try:
        b = Path(p).read_bytes()[:24]
    except OSError:
        return None
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")


def detect_resolution(size, cap=2048):
    """The annotator's working resolution: the picture's short side, 64-px
    steps, 512..cap (the node's own default is 512)."""
    if not size:
        return 512
    s = min(int(size[0]), int(size[1]))
    return max(512, min(int(cap), int(round(s / 64.0)) * 64))


def preprocess_graph(image, cn_type, preprocessor="", resolution=512, prefix="bitgen_cnmap", pose_face=False):
    """LoadImage -> the type's preprocessor -> SaveImage. Returns (graph, notes)."""
    node = PRE_NODES.get(str(cn_type or ""))
    if not node:
        raise ValueError(f"unknown ControlNet type {cn_type!r} - use " + ", ".join(PRE_NODES))
    if node == "Canny":
        # ComfyUI's core Canny: thresholds 0.01..0.99, no resolution input
        g = {"cn_load": {"class_type": "LoadImage", "inputs": {"image": str(image)}},
             "cn_pre": {"class_type": "Canny", "inputs": {"image": ["cn_load", 0], "low_threshold": 0.4, "high_threshold": 0.8}},
             "cn_save": {"class_type": "SaveImage", "inputs": {"images": ["cn_pre", 0], "filename_prefix": prefix}}}
        return g, ["control map: Canny (ComfyUI core) thresholds 0.4 / 0.8"]
    ins = {"image": ["cn_load", 0], "resolution": int(resolution), **PRE_SWITCHES.get(node, {})}
    if node == "DWPreprocessor":
        # 2.322.0 (Tim: faces "distorted"): a cartoon's face points (big eyes,
        # tiny mouth) force cartoon proportions on a real face - OFF unless
        # the Pose "face points" box is ticked
        ins["detect_face"] = "enable" if pose_face else "disable"
        notes_face = "face points ON (the control image carries the face's landmarks)" if pose_face \
            else "face points OFF (the second model draws the face itself)"
    else:
        notes_face = ""
    notes = [f"control map: {node} at {int(resolution)}px"] + ([notes_face] if notes_face else [])
    f = Path(str(preprocessor or "")).name
    if f:
        if cn_type == "pose":
            key = "bbox_detector" if any(x in f.lower() for x in ("yolox", "yolo_nas", "yolo-nas")) else "pose_estimator"
            ins[key] = f
            notes.append(f"{key} = {f}")
        elif cn_type == "depth":
            ins["ckpt_name"] = f
            notes.append(f"ckpt_name = {f}")
        else:
            notes.append(f"{node} has one fixed model - {f} is not a choice there, the node's own is used")
    else:
        notes.append("the preprocessor's own default model")
    g = {"cn_load": {"class_type": "LoadImage", "inputs": {"image": str(image)}},
         "cn_pre": {"class_type": node, "inputs": ins},
         "cn_save": {"class_type": "SaveImage", "inputs": {"images": ["cn_pre", 0], "filename_prefix": prefix}}}
    return g, notes


def _spec_parts(sp):
    """(type, options, default) of one /object_info input spec, any shape:
    [["a","b"], {...}] | ["INT", {"default": 5}] | ["COMBO", {"options": [...]}]
    | {"type": "COMBO", "options": [...], "default": ...}."""
    if isinstance(sp, dict):
        return str(sp.get("type") or ""), sp.get("options"), sp.get("default", None), "default" in sp
    if isinstance(sp, (list, tuple)) and sp:
        first = sp[0]
        opts = sp[1] if len(sp) > 1 and isinstance(sp[1], dict) else {}
        if isinstance(first, list):
            return "COMBO", first, opts.get("default"), "default" in opts
        return str(first), opts.get("options"), opts.get("default"), "default" in opts
    return "", None, None, False


def complete_inputs(graph, nid, spec):
    """Send EVERY widget the node declares (required AND optional): a missing
    one gets the server's declared default, else a combo's first choice; a
    combo value the server does not list is replaced the same way. Link-typed
    inputs (IMAGE ...) are left alone. Returns [(name, value, why)]."""
    node = graph.get(nid) or {}
    ins = node.setdefault("inputs", {})
    out = []
    for group in ("required", "optional"):
        for name, sp in ((spec or {}).get(group) or {}).items():
            typ, options, default, has_default = _spec_parts(sp)
            combo = typ.upper() == "COMBO" or isinstance(options, list)
            if not combo and typ.upper() not in WIDGET_TYPES:
                continue                      # a link (IMAGE, MASK ...)
            if isinstance(ins.get(name), list) and len(ins[name]) == 2 and not combo:
                continue
            fallback = default if has_default else (options[0] if combo and options else None)
            if name not in ins:
                if fallback is not None:
                    ins[name] = fallback
                    out.append((name, fallback, "declared default" if has_default else "first choice"))
            elif combo and options and ins[name] not in options and fallback is not None:
                out.append((name, fallback, f"{ins[name]!r} is not in this ComfyUI's list"))
                ins[name] = fallback
    return out


def apply_controlnet(g, control_image, model, strength=1.0, end=1.0, start=0.0, first_only=False):
    """ControlNetLoader + ControlNetApplyAdvanced on every sampler's positive /
    negative (or a guider's conditioning). Returns (graph, notes); a graph with
    nowhere to hang it raises ValueError. Called again on the same graph it
    CHAINS (the image editor's several control layers). first_only = the
    primary sampler alone (an SDXL inpaint export's refiner keeps its own
    conditioning); start = start_percent (2.333.0)."""
    if not model:
        raise ValueError("no ControlNet model picked (Basic Settings -> ControlNet -> Preprocessor)")
    g = {k: v for k, v in g.items() if isinstance(v, dict)}
    pairs = [k for k, v in g.items()
             if _is_link((v.get("inputs") or {}).get("positive")) and _is_link((v.get("inputs") or {}).get("negative"))]
    single = [] if pairs else [k for k, v in g.items()
                                if _is_link((v.get("inputs") or {}).get("conditioning"))
                                and "guider" in str(v.get("class_type", "")).lower()]
    if not pairs and not single:
        raise ValueError("the second model's workflow has no sampler / guider conditioning to put the ControlNet on")
    if first_only:
        def _num(k):
            try:
                return (0, int(k))
            except ValueError:
                return (1, str(k))
        # the primary = the sampler that is NOT fed a latent by another sampler
        if pairs:
            fed = {k for k in pairs for v in [g[k].get("inputs") or {}]
                   if _is_link(v.get("latent_image")) and str(v["latent_image"][0]) in pairs}
            base = [k for k in pairs if k not in fed] or pairs
            pairs = sorted(base, key=_num)[:1]
        else:
            single = sorted(single, key=_num)[:1]
    st = max(0.0, min(0.95, float(start or 0.0)))
    vae = next((list(v["inputs"]["vae"]) for v in g.values()
                if str(v.get("class_type", "")).startswith("VAEDecode") and _is_link((v.get("inputs") or {}).get("vae"))), None)
    load = _free(g, "cn_image")
    g[load] = {"class_type": "LoadImage", "inputs": {"image": str(control_image)},
               "_meta": {"title": "bitGen: the control map"}}
    loader = _free(g, "cn_model")
    g[loader] = {"class_type": CN_LOADER, "inputs": {"control_net_name": str(model)}}
    n = 0
    for k in pairs + single:
        ins = g[k]["inputs"]
        pos = list(ins["positive"] if k in pairs else ins["conditioning"])
        neg = list(ins["negative"]) if k in pairs else pos
        a = _free(g, f"cn_apply{n}")
        g[a] = {"class_type": CN_APPLY, "inputs": {
            "positive": pos, "negative": neg, "control_net": [loader, 0], "image": [load, 0],
            "strength": float(strength), "start_percent": st,
            "end_percent": max(st + 0.05, min(1.0, float(end if end is not None else 1.0))),
            **({"vae": vae} if vae else {})}}
        if k in pairs:
            ins["positive"], ins["negative"] = [a, 0], [a, 1]
        else:
            ins["conditioning"] = [a, 0]
        n += 1
    return g, [f"ControlNet {model} (strength {float(strength):g}, " + (f"starts at {round(st * 100)}%, " if st > 0 else "") + "ends at "
               f"{round(max(st + 0.05, min(1.0, float(end if end is not None else 1.0))) * 100)}%) on {n} "
               + ("sampler(s)" if pairs else "guider(s)") + f", following the control map {control_image}"]


def merge_loras(style_loras, extra):
    out = [dict(l) for l in (style_loras or []) if isinstance(l, dict)]
    for l in extra or []:
        p = str((l or {}).get("path") or "")
        if not p:
            continue
        w = float((l or {}).get("weight", 1) if (l or {}).get("weight") is not None else 1)
        i = next((j for j, x in enumerate(out) if str(x.get("path")) == p), None)
        if i is None:
            out.append({"path": p, "weight": w})
        else:
            out[i] = {**out[i], "path": p, "weight": w}
    return out


def final_params(params, style, cn):
    """The final render's params + style: same prompt / seed, the ControlNet
    cfg / steps when set. 2.317.0: with a SECOND model (cn.second) the final
    renders through its style - its own LoRAs dropped (they belong to the
    first model), the ControlNet LoRAs on it, the first render's workflow
    swap and reference pictures left behind (a text-to-image template).
    Without one (a 2.316 job) the first style again, the LoRAs on top."""
    p = {k: v for k, v in dict(params).items() if k != "controlnet"}
    # 2.321.0 (Tim: "add the second model prompt + negative prompt ... and a
    # checkbox above the positive prompt to use prompt docker prompt"): the
    # second model's OWN prompt when "Use prompt docker prompt" is off; its
    # negative whenever one is written (else the first render's)
    if not cn.get("use_main_prompt", True) and str(cn.get("prompt") or "").strip():
        p["prompt"] = str(cn["prompt"])
    if str(cn.get("negative") or "").strip():
        p["negative"] = str(cn["negative"])
    if cn.get("second"):
        for k in ("workflow", "workflow_note", "images", "model"):
            p.pop(k, None)
        st = dict(cn["second"])
        st["loras"] = merge_loras([], cn.get("loras"))
        if cn.get("steps"):
            p["steps"] = int(cn["steps"])
        else:
            p.pop("steps", None)            # the second model's own (a distilled one wants 4)
        if cn.get("cfg") is not None and cn.get("cfg") != "":
            p["cfg"] = float(cn["cfg"])
        else:
            p.pop("cfg", None)
        return p, st
    if cn.get("steps"):
        p["steps"] = int(cn["steps"])
    if cn.get("cfg") is not None and cn.get("cfg") != "":
        p["cfg"] = float(cn["cfg"])
    st = dict(style)
    if cn.get("loras"):
        st["loras"] = merge_loras(style.get("loras"), cn["loras"])
    return p, st


def size16(size):
    """The first image's size, 16-px aligned, for the second render (the map
    and the final line up)."""
    if not size:
        return None
    return max(64, int(round(size[0] / 16.0)) * 16), max(64, int(round(size[1] / 16.0)) * 16)


def run(first_files, output_dir, cn, *, say, comfy, render, reserve):
    """The map + final for each first image. comfy = {upload(path)->name,
    prepare(graph)->graph (canonicalise + fill + missing check), queue, wait,
    images(outputs)->items, download(item, dest)}; render(stem, hook, size) ->
    [names] (the second model's render with the ControlNet hook, at size);
    reserve(name, directory=None) -> a free name (output_dir by default).
    Returns what goes to the gallery, in order: [first, map, final, ...] -
    or, 2.320.0 cn.final_only (Tim: "show the final image only, if checked
    don't show the first generation or controlnet image in the gallery, put
    them in projectname\\temp\\controlnet, name them gen_filename,
    ctn_filename, use the ctn filename to generate the final image"), the
    finals alone: the first moves to <temp_dir>/gen_<name>, the control image
    is written as <temp_dir>/ctn_<name>, THAT file is uploaded for the final,
    and the final takes <name> in the gallery."""
    out_dir = Path(output_dir)
    final_only = bool(cn.get("final_only") and cn.get("temp_dir"))
    tmp = Path(cn["temp_dir"]) if final_only else None
    if tmp is not None:
        tmp.mkdir(parents=True, exist_ok=True)
    produced = []
    for first in first_files:
        stem = Path(first).stem
        src = out_dir / first
        if final_only:
            gen = reserve(f"gen_{first}", tmp)
            shutil.move(str(src), str(tmp / gen))
            src = tmp / gen
            say(f"[worker] final image only: the first image -> {tmp.name}/{gen} (kept out of the gallery)")
        else:
            produced.append(first)
        size = png_size(src)
        g, pnotes = preprocess_graph(comfy["upload"](src), cn.get("type"), cn.get("preprocessor", ""),
                                     detect_resolution(size), f"bitgen_cnmap/{stem}",
                                     pose_face=bool(cn.get("pose_face")))
        for n in pnotes:
            say(f"[worker] {n}")
        g = comfy["prepare"](g)
        say(f"[worker] ===== ControlNet preprocessor ({PRE_NODES[cn['type']]}) on {first}")
        items = comfy["images"](comfy["wait"](comfy["queue"](g)))
        if not items:
            raise RuntimeError("the preprocessor finished but saved no control map")
        map_dir = tmp if final_only else out_dir
        map_name = reserve(f"ctn_{stem}.png", tmp) if final_only else reserve(f"{stem}_cnmap.png")
        comfy["download"](items[0], map_dir / map_name)
        if not (map_dir / map_name).exists():
            raise RuntimeError("the control map did not download")
        if final_only:
            say(f"[worker] control image written -> {tmp.name}/{map_name} (kept out of the gallery)")
        else:
            produced.append(map_name)
            say(f"[worker] control map written -> {map_name}")
        up_map = comfy["upload"](map_dir / map_name)     # the final renders from THIS file

        def hook(graph, _m=up_map):
            graph, notes = apply_controlnet(graph, _m, cn.get("controlnet") or cn.get("model"),
                                            cn.get("strength", 1.0), cn.get("end", 1.0))
            for n in notes:
                say(f"[worker] {n}")
            return graph
        say("[worker] ===== ControlNet final render"
            + (f" - the second model: {cn['second_how']}" if cn.get("second_how") else ""))
        finals = render(stem if final_only else f"{stem}_cn", hook, size16(size))
        produced.extend(finals)
        for f in finals:
            say(f"[worker] ControlNet final written -> {f}")
    return produced
