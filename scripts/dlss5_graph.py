#!/usr/bin/env python3
"""bitGen Studio — DLSS 5 ENHANCE / UPSCALE / FRAME GENERATION graph (2.504.0) for dlss5_worker.py.

Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow (which ends in
RH_DLSS5Enhance at 4K). One ComfyUI graph per job, built from the pack's OWN example API files
(examples/ComfyUI-RH-DLSS5_video_api.json + _frame_interp_api.json) - class names, input names and option strings
verbatim, nothing guessed:

  LoadVideo (file) -> RH_DLSS5Enhance (video; its output 1 is the VIDEO) -> [RH_DLSS5FrameInterpolation (video; output
  1)] -> SaveVideo (video, filename_prefix, format auto, codec auto)

The NVIDIA runtime DLLs are the user's own (ComfyUI/models/dlss5/ - the pack never downloads them); NVIDIA RTX only.
Pure: MODES, STYLES, FPS_OUT, defaults, normalize(o), target(w, h, mode) (the size DLSS will make - the pack's own rule:
fixed factors 1 / 1.5 / 1.724 / 2 / 3; 1K / 2K / 4K / 8K pick the smallest factor whose SHORT side reaches
1080 / 1440 / 2160 / 4320, a source already there stays 1x), build(opts), REQUIRED.
"""
MODES = ["1x (DLAA / native)", "1.5x (Quality)", "1.724x (Balanced)", "2x (Performance)", "3x (Ultra Performance)",
         "1K", "2K", "4K", "8K"]
STYLES = ["default", "natural", "cinematic", "off (bypass NR)"]
FPS_OUT = ["off", "2x", "3x", "4x", "48", "50", "60", "72", "90", "96", "120", "144"]
FACTORS = [1.0, 1.5, 1.724, 2.0, 3.0]
BUCKET = {"1K": 1080, "2K": 1440, "4K": 2160, "8K": 4320}
FIXED = {"1x (DLAA / native)": 1.0, "1.5x (Quality)": 1.5, "1.724x (Balanced)": 1.724, "2x (Performance)": 2.0,
         "3x (Ultra Performance)": 3.0}
REQUIRED = ("LoadVideo", "RH_DLSS5Enhance", "SaveVideo")
INTERP = "RH_DLSS5FrameInterpolation"
# the secret-sauce export's own values (its node 162), the pack's defaults where the export has none
DEFAULTS = {"mode": "2K", "style": "default", "intensity": 1.0, "tone": 1.0, "structure": 1.5, "skin": 1.0,
            "detail": 1.0, "color": 1.0, "fps": "off"}


def _num(v, d, lo, hi):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    return d if x != x else max(lo, min(hi, x))


def normalize(o):
    o = o if isinstance(o, dict) else {}
    return {
        "mode": o.get("mode") if o.get("mode") in MODES else DEFAULTS["mode"],
        "style": o.get("style") if o.get("style") in STYLES else DEFAULTS["style"],
        "intensity": _num(o.get("intensity"), 1.0, 0.0, 2.0),
        "tone": _num(o.get("tone"), 1.0, 0.0, 2.0),
        "structure": _num(o.get("structure"), 1.5, 0.0, 2.0),
        "skin": _num(o.get("skin"), 1.0, -1.0, 2.0),
        "detail": _num(o.get("detail"), 1.0, 0.0, 2.0),
        "color": _num(o.get("color"), 1.0, 0.0, 1.0),
        "fps": str(o.get("fps")) if str(o.get("fps")) in FPS_OUT else "off",
    }


def target(w, h, mode):
    """{width, height, factor} DLSS makes from w x h, or {error}"""
    w, h = int(w or 0), int(h or 0)
    if w <= 0 or h <= 0:
        return {"error": "could not read the video's size"}
    if mode in FIXED:
        f = FIXED[mode]
    elif mode in BUCKET:
        b, short = BUCKET[mode], min(w, h)
        if short >= b:
            f = 1.0
        else:
            ok = [x for x in FACTORS if short * x >= b - 0.5]
            if not ok:
                return {"error": f"{w}x{h} cannot reach {mode} with DLSS (3x at most) - pick a fixed factor or a smaller size"}
            f = ok[0]
    else:
        return {"error": f"unknown DLSS mode {mode!r}"}
    ow, oh = int(round(w * f)), int(round(h * f))
    if max(ow, oh) > 7680 or min(ow, oh) > 4320:
        return {"error": f"{ow}x{oh} is beyond DLSS's 7680x4320 output"}
    return {"width": ow, "height": oh, "factor": f}


def build(opts):
    """(graph, notes). opts: video (ComfyUI's uploaded name), the normalize() keys, prefix"""
    s = normalize(opts)
    g = {
        "1": {"class_type": "LoadVideo", "inputs": {"file": opts["video"]}},
        "2": {"class_type": "RH_DLSS5Enhance", "inputs": {
            "video": ["1", 0], "upscaling_mode": s["mode"], "style": s["style"], "preset": 0,
            "intensity": s["intensity"], "tone": s["tone"], "structure": s["structure"], "skin": s["skin"],
            "auto_mask": "on", "motion": "auto", "scene_change_threshold": 0.24, "batch_mode": "temporal sequence",
            "warmup_frames": 0, "keep_audio": "on", "backend": "auto", "channel_order": "auto",
            "detail": s["detail"], "color": s["color"], "runtime_dir": "", "wine_prefix": ""}},
    }
    notes = [f"DLSS 5 {s['mode']} · style {s['style']} · intensity {s['intensity']:g} · structure {s['structure']:g}"
             + f" · detail {s['detail']:g}"]
    last = "2"
    if s["fps"] != "off":
        g["3"] = {"class_type": INTERP, "inputs": {
            "video": ["2", 1], "output_fps": s["fps"], "motion": "auto", "scene_change_threshold": 0.24,
            "keep_audio": "on", "runtime_dir": "", "wine_prefix": ""}}
        last = "3"
        notes.append(f"DLSS frame generation -> {s['fps']}" + (" fps" if s["fps"][-1] != "x" else ""))
    g["9"] = {"class_type": "SaveVideo", "inputs": {"video": [last, 1], "filename_prefix": opts.get("prefix") or "bitgen_dlss5",
                                                     "format": "auto", "codec": "auto"}}
    return g, notes
