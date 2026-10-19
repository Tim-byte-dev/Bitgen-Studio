#!/usr/bin/env python3
"""bitGen Studio — WAN 2.1 / WAN 2.2 VIDEO GRAPHS (2.368.0).

Tim (verbatim): "add a wan2.1 style so we can use wan as well, also wan2.2".

The graph is BUILT here from ComfyUI's own core Wan nodes (comfy_extras/nodes_wan.py) - no export to keep in
step with a pack. One builder, two families, four modes:

  family  wan21   one model, KSampler (uni_pc / simple), CLIP vision for the picture modes
          wan22   the A14B pair: HIGH-noise model samples the first half, LOW-noise finishes
                  (KSamplerAdvanced x2, euler / simple) - no CLIP vision
  mode    t2v     text only                   EmptyHunyuanLatentVideo
          i2v     starts on a picture         WanImageToVideo (start_image)
          flf2v   first + last picture        WanFirstLastFrameToVideo
          ref     a character picture (VACE)  WanVaceToVideo (reference_image) -> TrimVideoLatent
          ati     a picture + drawn PATHS     WanTrackToVideo (start_image + tracks JSON) - Wan 2.1 ATI (2.387.0,
                  Tim: "can we add a paths layer, then generate parts of the scene on each path layer so animals,
                  cars, people can be rendered separately"): the subject travels the path the user drew
          camera  a picture + a CAMERA MOVE  WanCameraEmbedding (camera_pose, speed) -> WanCameraImageToVideo
                  (start_image + camera_conditions) on a Wan Fun Camera model (2.399.0, Tim: "can we add camera movement
                  to follow a 3d path ... will we be able to tell mmh3 , wan and ltx to follow these paths")
          vctrl   the EXACT camera path       LoadVideo -> GetVideoComponents -> WanVaceToVideo (control_video = the
                  timeline camera's depth guide, reference_image = the first picture) on a VACE model -> TrimVideoLatent

Model FILES are picked from what ComfyUI lists (pick_models): the family + the mode's keyword in the name
(t2v / i2v / flf2v / vace; high / low for 2.2), so one "Wan 2.1" style serves every mode. A model the style
names wins when it fits the mode. Wan renders 16 fps; frames are 4k+1.

Pure: dicts in, (graph, notes) out - scripts/test-wangraph.py.
"""
import re

FAMILIES = ("wan21", "wan22")
MODES = ("t2v", "i2v", "flf2v", "ref", "ati", "camera", "vctrl")
CAMERA_POSES = ("Static", "Pan Up", "Pan Down", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Anti Clockwise (ACW)",
                "ClockWise (CW)")                    # ComfyUI's WanCameraEmbedding camera_pose
FPS = 16
MAX_FRAMES = 161          # ~10 s; Wan is trained on 81 (5 s) - longer drifts, said in the note
DEFAULTS = {
    "wan21": {"steps": 30, "cfg": 6.0, "sampler": "uni_pc", "scheduler": "simple", "shift": 8.0},
    "wan22": {"steps": 20, "cfg": 3.5, "sampler": "euler", "scheduler": "simple", "shift": 8.0},
}
FAST = {"steps": 4, "cfg": 1.0}       # a Lightning / lightx2v / CausVid LoRA is loaded
FAST_RE = re.compile(r"lightx2v|lightning|causvid|distill|4[-_ ]?step|turbo", re.I)
# "ati" first: the ATI file's name also says i2v (Wan2_1-I2V-ATI-14B) - it must never be taken for a plain i2v model
# 2.399.0: "camera" second - a Fun Camera file (wan2.2_fun_camera_high_noise_14B) must never be taken for a plain model
KEYWORD = {"ati": ("ati",), "camera": ("camera",), "t2v": ("t2v",), "i2v": ("i2v",), "flf2v": ("flf2v", "flf"), "ref": ("vace",)}
ATI_TEMPERATURE, ATI_TOPK, ATI_POINTS = 220.0, 2, 121
# what to download when a mode's file is missing (Comfy-Org's repackaged names)
HINTS = {
    "wan21": {"t2v": ["wan2.1_t2v_14B_fp8_e4m3fn.safetensors (or wan2.1_t2v_1.3B_fp16.safetensors)"],
              "i2v": ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors (or the 480p one)"],
              "flf2v": ["wan2.1_flf2v_720p_14B_fp16.safetensors"],
              "ref": ["wan2.1_vace_14B_fp16.safetensors (or wan2.1_vace_1.3B_fp16.safetensors)"],
              "ati": ["Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors (Kijai/WanVideo_comfy)"],
              "camera": ["a Wan 2.1 Fun Camera model (alibaba-pai Wan2.1-Fun-V1.1-14B-Control-Camera, 'camera' in its name)"]},
    "wan22": {"t2v": ["wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"],
              "i2v": ["wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"],
              "flf2v": ["wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"],
              "ref": ["a Wan 2.2 VACE high-noise + low-noise pair (Wan2.2-VACE-Fun-A14B)"],
              "ati": ["ATI is a Wan 2.1 model - use a Wan 2.1 style"],
              "camera": ["wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors", "wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors"]},
}
TE_HINT = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
VAE_HINT = "wan_2.1_vae.safetensors"
CLIPV_HINT = "clip_vision_h.safetensors"


def snap_frames(n):
    """4k+1, 5..MAX_FRAMES."""
    n = max(5, min(MAX_FRAMES, int(round(float(n or 81)))))
    return n - ((n - 1) % 4)


def frames_for(seconds):
    return snap_frames(float(seconds or 5) * FPS + 1)


def a16(v, lo=256, hi=1920):
    return max(lo, min(hi, int(round(float(v) / 16.0)) * 16))


def _base(name):
    return re.split(r"[\\/]", str(name or ""))[-1].lower()


def family_of(name):
    b = _base(name).replace("-", "_")
    if re.search(r"wan_?2[._]?2", b):
        return "wan22"
    if re.search(r"wan_?2[._]?1", b):
        return "wan21"
    return None


def _mode_of_name(b):
    for m, keys in KEYWORD.items():
        if any(re.search(rf"(^|[^a-z]){k}([^a-z]|$)", b) for k in keys):
            return m
    return None


def _fits(name, family, mode):
    b = _base(name).replace("-", "_")
    fam = family_of(b)
    if fam and fam != family:
        return False
    want = "i2v" if (family == "wan22" and mode == "flf2v") else mode     # 2.2 FLF runs on the i2v pair
    have = _mode_of_name(b)
    if have is None:
        return True                       # a name with no mode word (a merge) fits any mode
    if have == want:
        return True
    return family == "wan21" and mode == "flf2v" and have == "flf2v"


def _rank(name, height):
    """Prefer fp8 / scaled (fits a 24 GB card), the 720p file for >= 600 px, 14B over 1.3B."""
    b = _base(name)
    r = 0
    if "720p" in b and height >= 600:
        r += 4
    if "480p" in b and height < 600:
        r += 4
    if "14b" in b:
        r += 2
    if "fp8" in b or "scaled" in b:
        r += 1
    if b.endswith(".gguf"):
        r -= 10                           # needs the GGUF loader - not built here
    return r


def pick_models(names, family, mode, wanted=(), height=720):
    """The model file(s) for family + mode from ComfyUI's list.
    -> {"models": [one] (wan21) | [high, low] (wan22), "notes": [...]} or {"error": words}."""
    names = [str(n) for n in (names or []) if str(n).lower().endswith((".safetensors", ".ckpt", ".pt", ".pth", ".bin"))]
    notes = []
    if mode == "vctrl":                     # 2.399.0: the exact camera path runs on the VACE model(s)
        mode = "ref"
    wanted = [w for w in (wanted or []) if w]
    if family == "wan21":
        mine = [w for w in wanted if _fits(w, family, mode) and _mode_of_name(_base(w)) is not None]
        if mine:
            return {"models": [mine[0]], "notes": [f"model {mine[0]} (the style's)"]}
        hits = [n for n in names if family_of(n) == "wan21" and _mode_of_name(_base(n).replace("-", "_")) == (mode if mode != "flf2v" else "flf2v")]
        if not hits and wanted:
            return {"models": [wanted[0]], "notes": [f"no Wan 2.1 {mode} file listed by ComfyUI - the style's {wanted[0]}"]}
        if not hits:
            return {"error": f"ComfyUI has no Wan 2.1 {mode.upper()} model in models/diffusion_models - download "
                             + " / ".join(HINTS["wan21"][mode]) + " (Comfy-Org/Wan_2.1_ComfyUI_repackaged)"}
        hits.sort(key=lambda n: (-_rank(n, height), n))
        return {"models": [hits[0]], "notes": [f"model {hits[0]} (ComfyUI's Wan 2.1 {mode} file)"]}
    # wan22: a HIGH + LOW pair of the mode
    want_mode = "i2v" if mode == "flf2v" else mode

    def side(lst, s):
        return [n for n in lst if re.search(rf"(^|[^a-z]){s}([^a-z]|$)", _base(n).replace("-", "_"))
                or (s == "high" and "high_noise" in _base(n)) or (s == "low" and "low_noise" in _base(n))]
    mine = [w for w in wanted if _fits(w, family, mode) and _mode_of_name(_base(w)) is not None]
    hi, lo = side(mine, "high"), side(mine, "low")
    if hi and lo:
        return {"models": [hi[0], lo[0]], "notes": [f"models {hi[0]} + {lo[0]} (the style's)"]}
    pool = [n for n in names if family_of(n) == "wan22" and _mode_of_name(_base(n).replace("-", "_")) == want_mode]
    hi, lo = side(pool, "high"), side(pool, "low")
    if not (hi and lo):
        if len(wanted) >= 2:
            return {"models": [wanted[0], wanted[1]],
                    "notes": [f"no Wan 2.2 {want_mode} pair listed by ComfyUI - the style's {wanted[0]} + {wanted[1]}"]}
        return {"error": f"ComfyUI has no Wan 2.2 {want_mode.upper()} high-noise + low-noise pair in "
                         "models/diffusion_models - download " + " + ".join(HINTS["wan22"][mode])
                         + " (Comfy-Org/Wan_2.2_ComfyUI_Repackaged)"}
    hi.sort(key=lambda n: (-_rank(n, height), n))
    lo.sort(key=lambda n: (-_rank(n, height), n))
    if mode == "flf2v":
        notes.append("Wan 2.2 first + last frame runs on the i2v pair (WanFirstLastFrameToVideo)")
    return {"models": [hi[0], lo[0]], "notes": notes + [f"models {hi[0]} + {lo[0]} (ComfyUI's Wan 2.2 {want_mode} pair)"]}


def pick_file(names, wanted, pattern, hint):
    """A text encoder / VAE / CLIP vision file: the style's if listed (or nothing listed), else the first
    name matching `pattern`, else the hint (ComfyUI will say what it lacks)."""
    names = [str(n) for n in (names or [])]
    if wanted:
        if not names or wanted in names or any(_base(n) == _base(wanted) for n in names):
            return wanted
    hit = [n for n in names if re.search(pattern, _base(n))]
    if hit:
        return sorted(hit, key=lambda n: ("fp8" not in _base(n), n))[0]
    return wanted or hint


def settings(family, steps=0, cfg=None, loras=()):
    """steps / cfg for the samplers: explicit > a fast LoRA's 4 / 1 > the family's defaults."""
    d = dict(DEFAULTS[family])
    notes = []
    fast = any(FAST_RE.search(str((l or {}).get("name") or (l or {}).get("path") or "")) for l in (loras or []))
    if fast:
        d.update(FAST)
        notes.append("a Lightning / distill LoRA is loaded - 4 steps, cfg 1 unless set")
    if steps and int(steps) > 0:
        d["steps"] = int(steps)
    if cfg is not None and float(cfg) > 0:
        d["cfg"] = float(cfg)
    return d, notes


def build(o):
    """o = {family, mode, prompt, negative, width, height, frames, seed, steps, cfg, models:[..], te, vae,
            clip_vision, loras:[{name, strength}], images:{start, end, ref} (uploaded names), prefix}
    -> (graph, notes). Raises ValueError in words."""
    fam, mode = o.get("family"), o.get("mode")
    if fam not in FAMILIES:
        raise ValueError(f"unknown Wan family {fam!r} (wan21 / wan22)")
    if mode not in MODES:
        raise ValueError(f"unknown Wan mode {mode!r} (t2v / i2v / flf2v / ref)")
    models = list(o.get("models") or [])
    if len(models) < (2 if fam == "wan22" else 1):
        raise ValueError("Wan 2.2 needs a high-noise and a low-noise model" if fam == "wan22" else "no Wan 2.1 model")
    imgs = o.get("images") or {}
    if mode in ("i2v", "flf2v") and not imgs.get("start"):
        raise ValueError(f"Wan {mode} needs a start picture")
    if mode == "flf2v" and not imgs.get("end"):
        raise ValueError("Wan flf2v needs a last picture")
    if mode == "ati":
        if fam != "wan21":
            raise ValueError("Wan ATI (paths) is a Wan 2.1 model - pick a Wan 2.1 style for the path layer")
        if not imgs.get("start"):
            raise ValueError("Wan ATI needs a start picture (the subject at the path's start)")
        if not tracks_ok(o.get("tracks")):
            raise ValueError("Wan ATI needs at least one drawn path (tracks)")
    if mode == "ref" and not imgs.get("ref"):
        raise ValueError("Wan reference (VACE) needs a character picture")
    cam = o.get("camera") or {}
    if mode == "camera":
        if not imgs.get("start"):
            raise ValueError("Wan Fun Camera needs a start picture (it is an image-to-video model)")
        if cam.get("pose") not in CAMERA_POSES:
            raise ValueError(f"unknown Wan camera move {cam.get('pose')!r}")
    if mode == "vctrl" and not imgs.get("control"):
        raise ValueError("the exact camera path needs its depth guide video (the Camera panel's 🎬 Make guide)")
    w, h = a16(o.get("width") or 1280), a16(o.get("height") or 720)
    frames = snap_frames(o.get("frames") or 81)
    st = {"steps": int(o.get("steps") or DEFAULTS[fam]["steps"]), "cfg": float(o.get("cfg") or DEFAULTS[fam]["cfg"]),
          "sampler": DEFAULTS[fam]["sampler"], "scheduler": DEFAULTS[fam]["scheduler"],
          "shift": float(o.get("shift") or DEFAULTS[fam]["shift"])}
    seed = int(o.get("seed") or 0)
    notes = [f"Wan {'2.2' if fam == 'wan22' else '2.1'} {mode}: {w}x{h}, {frames} frames at {FPS} fps "
             f"({(frames - 1) / FPS:.2f} s), {st['steps']} steps, cfg {st['cfg']:g}"]
    if frames > 81:
        notes.append(f"{frames} frames is past Wan's trained 81 - motion may drift or loop")
    g = {}
    nid = [100]

    def add(ct, ins, title=None):
        nid[0] += 1
        k = str(nid[0])
        g[k] = {"class_type": ct, "inputs": ins}
        if title:
            g[k]["_meta"] = {"title": title}
        return k

    # models (+ LoRAs + shift on each)
    tops = []
    for i, m in enumerate(models[:2] if fam == "wan22" else models[:1]):
        # 2.409.0: a .gguf file goes on ComfyUI-GGUF's loader
        k = add("UnetLoaderGGUF", {"unet_name": m}, ("High noise" if i == 0 else "Low noise") if fam == "wan22" else "Wan model") \
            if str(m).lower().endswith(".gguf") else \
            add("UNETLoader", {"unet_name": m, "weight_dtype": o.get("dtype") or "default"},
                ("High noise" if i == 0 else "Low noise") if fam == "wan22" else "Wan model")
        for lo in o.get("loras") or []:
            name = (lo or {}).get("name") or (lo or {}).get("path")
            if not name:
                continue
            k = add("LoraLoaderModelOnly", {"model": [k, 0], "lora_name": name,
                                            "strength_model": float((lo or {}).get("strength", (lo or {}).get("weight", 1.0)))})
        k = add("ModelSamplingSD3", {"model": [k, 0], "shift": st["shift"]})
        tops.append(k)
    clip = add("CLIPLoader", {"clip_name": o.get("te") or TE_HINT, "type": "wan", "device": "default"})
    pos = add("CLIPTextEncode", {"text": str(o.get("prompt") or ""), "clip": [clip, 0]}, "Positive")
    neg = add("CLIPTextEncode", {"text": str(o.get("negative") or ""), "clip": [clip, 0]}, "Negative")
    vae = add("VAELoader", {"vae_name": o.get("vae") or VAE_HINT})
    P, N = [pos, 0], [neg, 0]
    trim = None
    common = {"vae": [vae, 0], "width": w, "height": h, "length": frames, "batch_size": 1}
    cv = None
    if fam == "wan21" and mode in ("i2v", "flf2v", "ati", "camera"):
        cv = add("CLIPVisionLoader", {"clip_name": o.get("clip_vision") or CLIPV_HINT})
    if mode == "t2v":
        lat = [add("EmptyHunyuanLatentVideo", {"width": w, "height": h, "length": frames, "batch_size": 1}), 0]
    elif mode == "i2v":
        s = add("LoadImage", {"image": imgs["start"]}, "Start frame")
        ins = {"positive": P, "negative": N, **common, "start_image": [s, 0]}
        if cv:
            ins["clip_vision_output"] = [add("CLIPVisionEncode", {"clip_vision": [cv, 0], "image": [s, 0], "crop": "none"}), 0]
        n2 = add("WanImageToVideo", ins)
        P, N, lat = [n2, 0], [n2, 1], [n2, 2]
    elif mode == "ati":
        s = add("LoadImage", {"image": imgs["start"]}, "Start frame")
        ins = {"positive": P, "negative": N, **common, "tracks": tracks_json(o.get("tracks"), w, h),
               "temperature": float(o.get("ati_temperature") or ATI_TEMPERATURE), "topk": int(o.get("ati_topk") or ATI_TOPK),
               "start_image": [s, 0]}
        ins["clip_vision_output"] = [add("CLIPVisionEncode", {"clip_vision": [cv, 0], "image": [s, 0], "crop": "none"}), 0]
        n2 = add("WanTrackToVideo", ins)
        P, N, lat = [n2, 0], [n2, 1], [n2, 2]
        notes.append(f"ATI: {len(o.get('tracks') or [])} path(s), {ATI_POINTS} points each, on {w}x{h}")
    elif mode == "flf2v":
        s = add("LoadImage", {"image": imgs["start"]}, "First frame")
        e = add("LoadImage", {"image": imgs["end"]}, "Last frame")
        ins = {"positive": P, "negative": N, **common, "start_image": [s, 0], "end_image": [e, 0]}
        if cv:
            ins["clip_vision_start_image"] = [add("CLIPVisionEncode", {"clip_vision": [cv, 0], "image": [s, 0], "crop": "none"}), 0]
            ins["clip_vision_end_image"] = [add("CLIPVisionEncode", {"clip_vision": [cv, 0], "image": [e, 0], "crop": "none"}), 0]
        n2 = add("WanFirstLastFrameToVideo", ins)
        P, N, lat = [n2, 0], [n2, 1], [n2, 2]
    elif mode == "camera":                  # 2.399.0: a Fun Camera move from the start picture
        s = add("LoadImage", {"image": imgs["start"]}, "Start frame")
        speed = max(0.1, min(10.0, float(cam.get("speed") or 1.0)))
        emb = add("WanCameraEmbedding", {"camera_pose": cam["pose"], "width": w, "height": h, "length": frames, "speed": speed},
                  "Camera move")
        ins = {"positive": P, "negative": N, **common, "start_image": [s, 0], "camera_conditions": [emb, 0]}
        if cv:
            ins["clip_vision_output"] = [add("CLIPVisionEncode", {"clip_vision": [cv, 0], "image": [s, 0], "crop": "none"}), 0]
        n2 = add("WanCameraImageToVideo", ins)
        P, N, lat = [n2, 0], [n2, 1], [n2, 2]
        notes.append(f"Fun Camera: {cam['pose']} at speed {speed:g}")
    elif mode == "vctrl":                   # 2.399.0: the exact camera path - the depth guide as VACE's control video
        lv = add("LoadVideo", {"file": imgs["control"]}, "Camera guide (depth)")
        comp = add("GetVideoComponents", {"video": [lv, 0]})
        ins = {"positive": P, "negative": N, **common, "strength": float(cam.get("strength") or 1.0), "control_video": [comp, 0]}
        if imgs.get("ref"):
            ins["reference_image"] = [add("LoadImage", {"image": imgs["ref"]}, "First picture"), 0]
        n2 = add("WanVaceToVideo", ins)
        P, N, lat, trim = [n2, 0], [n2, 1], [n2, 2], [n2, 3]
        notes.append("VACE: the camera path's depth guide is the control video" + (", the first picture its reference" if imgs.get("ref") else ""))
    else:                                   # ref (VACE): one reference picture
        r = add("LoadImage", {"image": imgs["ref"]}, "Reference")
        n2 = add("WanVaceToVideo", {"positive": P, "negative": N, **common, "strength": 1.0, "reference_image": [r, 0]})
        P, N, lat, trim = [n2, 0], [n2, 1], [n2, 2], [n2, 3]
        notes.append("VACE takes ONE reference picture - the first")
    if fam == "wan21":
        smp = add("KSampler", {"model": [tops[0], 0], "seed": seed, "steps": st["steps"], "cfg": st["cfg"],
                               "sampler_name": st["sampler"], "scheduler": st["scheduler"],
                               "positive": P, "negative": N, "latent_image": lat, "denoise": 1.0})
    else:
        split = max(1, st["steps"] // 2)
        hi = add("KSamplerAdvanced", {"model": [tops[0], 0], "add_noise": "enable", "noise_seed": seed,
                                      "steps": st["steps"], "cfg": st["cfg"], "sampler_name": st["sampler"],
                                      "scheduler": st["scheduler"], "positive": P, "negative": N, "latent_image": lat,
                                      "start_at_step": 0, "end_at_step": split,
                                      "return_with_leftover_noise": "enable"}, "High noise")
        smp = add("KSamplerAdvanced", {"model": [tops[1], 0], "add_noise": "disable", "noise_seed": seed,
                                       "steps": st["steps"], "cfg": st["cfg"], "sampler_name": st["sampler"],
                                       "scheduler": st["scheduler"], "positive": P, "negative": N,
                                       "latent_image": [hi, 0], "start_at_step": split, "end_at_step": 10000,
                                       "return_with_leftover_noise": "disable"}, "Low noise")
        notes.append(f"high noise steps 0-{split}, low noise {split}-{st['steps']}")
    out = [smp, 0]
    if trim:
        out = [add("TrimVideoLatent", {"samples": out, "trim_amount": trim}), 0]
    dec = add("VAEDecode", {"samples": out, "vae": [vae, 0]})
    vid = add("CreateVideo", {"images": [dec, 0], "fps": float(FPS)})
    add("SaveVideo", {"video": [vid, 0], "filename_prefix": o.get("prefix") or "bitgen_wan/wan",
                      "format": "auto", "codec": "auto"})
    return g, notes


def tracks_ok(tracks):
    return isinstance(tracks, list) and any(isinstance(t, list) and len(t) >= 2 for t in tracks)


def resample(track, n=ATI_POINTS):
    """a drawn track ({x, y} points in picture pixels) -> exactly n points, evenly spaced in time (the page already
    put them at the times the subject should be there)"""
    pts = [(float(p["x"]), float(p["y"])) for p in track if isinstance(p, dict) and "x" in p and "y" in p]
    if not pts:
        return []
    if len(pts) == 1:
        return [{"x": round(pts[0][0], 2), "y": round(pts[0][1], 2)}] * n
    out = []
    for i in range(n):
        f = i * (len(pts) - 1) / (n - 1)
        a = int(f)
        b = min(a + 1, len(pts) - 1)
        t = f - a
        out.append({"x": round(pts[a][0] + (pts[b][0] - pts[a][0]) * t, 2), "y": round(pts[a][1] + (pts[b][1] - pts[a][1]) * t, 2)})
    return out


def tracks_json(tracks, w, h):
    """WanTrackToVideo's `tracks`: a JSON list of tracks, each a list of {"x", "y"} points in the generated video's
    pixels (the same shape ComfyUI's spline / path editors write), every track 121 points, kept inside the frame"""
    out = []
    for t in tracks or []:
        if not isinstance(t, list) or len([p for p in t if isinstance(p, dict) and "x" in p and "y" in p]) < 2:
            continue                        # a single point is not a path
        r = resample(t)
        if len(r) >= 2:
            out.append([{"x": max(0.0, min(w - 1.0, p["x"])), "y": max(0.0, min(h - 1.0, p["y"]))} for p in r])
    import json as _json
    return _json.dumps(out)


def finish_args(raw, out, audio=None, audio_start=0.0, seconds=None, interpolate=True):
    """ffmpeg: Wan's 16 fps take -> 24 fps (motion-interpolated, so it joins the app's 24 fps clips without
    judder), H.264; the reference sound laid under it (trimmed to the take), else the take's own sound if any."""
    vf = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" if interpolate else "fps=24"
    args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw)]
    if audio:
        args += ["-ss", f"{float(audio_start or 0):.3f}", "-i", str(audio)]
    args += ["-vf", vf + ",format=yuv420p", "-map", "0:v:0"]
    args += ["-map", "1:a:0", "-shortest"] if audio else ["-map", "0:a:0?"]
    args += ["-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
    if seconds:
        args += ["-t", f"{float(seconds):.3f}"]
    return args + [str(out)]
