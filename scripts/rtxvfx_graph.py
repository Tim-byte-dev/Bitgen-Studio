#!/usr/bin/env python3
"""bitGen Studio — RTX VFX VIDEO FINISHER graph (2.708.0) for rtxvfx_worker.py.

Tim: "Add the RTX upscale" - the DENO pack's DenoRTXVFXVideoFinisher (https://github.com/Deno2026/comfyui-deno-custom-nodes,
NVIDIA RTX Video Super Resolution / Deblur / High Bitrate passes) as another take upscaler beside SeedVR2 and DLSS 5.
Every class / input / widget name below is the one Tim's own exported workflow carries (pack ver 0.7.4) - nothing
guessed; the graph is built here, his workflow file is not copied. ONE graph per CHUNK of frames:

  VHS_LoadVideo (video, skip_first_frames, frame_load_cap, ...) -> IMAGE(0) -> DenoRTXVFXVideoFinisher (images) ->
  images(0) -> VHS_VideoCombine (images; no audio - the worker lays the source's sound back under the joined result)
  VHS_LoadVideo video_info(3) -> VHS_VideoInfoSource -> fps(0) -> VHS_VideoCombine frame_rate

The batching is the WORKER's (chunks(): skip_first_frames + frame_load_cap per run, each chunk saved under its own
filename_prefix, then joined losslessly with ffmpeg's concat demuxer - concat_args()). VideoHelperSuite's meta-batch
(VHS_BatchManager) is not used: its re-queue is not something an API client can rely on.

The option strings below are DEFAULTS only (the ones seen in Tim's export). The running ComfyUI's /object_info is the
list of what its node offers - resolve(values, lists) checks every combo against it before anything is queued.
The NVIDIA runtime is NOT in the pack: its installer (custom_nodes/deno-custom-nodes/tools/install_rtx_vfx.bat) puts it
in. RTX cards / Windows only.

Pure: NODE, REQUIRED, PRESETS, DEFAULTS, normalize(o), target(w, h, scale, div), chunks(frames, per),
      build(opts) -> (graph, notes), resolve(values, lists) -> (values, notes, errors), concat_list(files),
      concat_args(list_file, dest).
"""
NODE = "DenoRTXVFXVideoFinisher"
REQUIRED = ("VHS_LoadVideo", "VHS_VideoInfoSource", NODE, "VHS_VideoCombine")
# Tim's two presets (his export): A = one VSR pass; B = a Deblur pass, then High Bitrate
PRESETS = {
    "vsr": {"first_pass": "Off", "first_quality": "Ultra", "upscale_pass": "VSR", "upscale_quality": "High"},
    "twopass": {"first_pass": "Deblur", "first_quality": "Ultra", "upscale_pass": "High Bitrate", "upscale_quality": "High"},
}
PASS_KEYS = ("first_pass", "first_quality", "upscale_pass", "upscale_quality")
# the node's other widgets, as Tim's export sets them (resize by Scale; the rest is what Scale mode leaves unused)
FIXED = {"resize_type": "Scale", "megapixels": 4.0, "width": 3840, "height": 2160, "divisible_by": "32",
         "ratio_preset": "16:9", "resize_method": "Center Crop (Fill)"}
# combos that are ours to fall back on when this ComfyUI's pack spells them differently (they do not change the look)
SOFT = ("divisible_by", "ratio_preset", "resize_method")
LOAD_FORMAT = "AnimateDiff"                 # VHS_LoadVideo.format as the repo's own exports carry it
LOAD_FORMAT_PREFER = ("None", "AnimateDiff")  # the first of these the live list offers ("None" = no size rule)
DEFAULTS = dict(PRESETS["vsr"], preset="vsr", scale=2.0, batch=48)   # batch = frames per run; 0 = all in one run


def _num(v, d, lo, hi):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return d
    return d if x != x else max(lo, min(hi, x))


def _word(v, d):
    s = str(v if v is not None else "").strip()
    return s if s and len(s) <= 60 and all(ord(c) >= 32 for c in s) else d


def normalize(o):
    """the job's rtx options: preset (vsr | twopass | custom), the four pass widgets, scale (1-4), batch (frames per
    run, 0 = every frame in one run)"""
    o = o if isinstance(o, dict) else {}
    preset = o.get("preset") if o.get("preset") in ("vsr", "twopass", "custom") else DEFAULTS["preset"]
    base = PRESETS.get(preset) or PRESETS["vsr"]
    out = {"preset": preset}
    for k in PASS_KEYS:
        out[k] = base[k] if preset in PRESETS else _word(o.get(k), base[k])
    out["scale"] = round(_num(o.get("scale"), DEFAULTS["scale"], 1.0, 4.0), 3)
    out["batch"] = int(_num(o.get("batch"), DEFAULTS["batch"], 0, 4096))
    return out


def target(w, h, scale, div=32):
    """{width, height, factor} - ABOUT what the finisher makes from w x h at `scale` (each side x scale, to the nearest
    multiple of divisible_by); the node's own rounding decides the exact size. {error} when the size is unreadable."""
    w, h = int(w or 0), int(h or 0)
    if w <= 0 or h <= 0:
        return {"error": "could not read the video's size"}
    f = _num(scale, DEFAULTS["scale"], 1.0, 4.0)
    d = max(1, int(_num(div, 32, 1, 512)))
    rnd = lambda v: max(d, int(v * f / d + 0.5) * d)         # noqa: E731  (half up, not Python's half-even)
    return {"width": rnd(w), "height": rnd(h), "factor": f}


def chunks(frames, per):
    """[(skip_first_frames, frame_load_cap)] - one run per `per` frames of `frames`; per 0 (or an unknown frame count)
    = one run of every frame (cap 0 = VHS loads to the end). The last chunk loads to the end (cap 0) so a frame count
    that was a little short never drops the tail."""
    frames, per = int(frames or 0), int(per or 0)
    if per <= 0 or frames <= 0 or frames <= per:
        return [(0, 0)]
    out, skip = [], 0
    while skip + per < frames:
        out.append((skip, per))
        skip += per
    out.append((skip, 0))
    return out


def build(opts):
    """(graph, notes) for ONE chunk. opts: video (ComfyUI's uploaded name), the normalize() keys, prefix, skip / cap
    (the chunk), and optionally the live-resolved widget values (format, resize_type, divisible_by, ratio_preset,
    resize_method)"""
    s = normalize(opts)
    fx = {k: opts.get(k, v) for k, v in FIXED.items()}
    g = {
        "2": {"class_type": "VHS_LoadVideo", "inputs": {
            "video": opts["video"], "force_rate": 0, "custom_width": 0, "custom_height": 0,
            "frame_load_cap": max(0, int(opts.get("cap") or 0)), "skip_first_frames": max(0, int(opts.get("skip") or 0)),
            "select_every_nth": 1, "format": opts.get("format") or LOAD_FORMAT}},
        "3": {"class_type": "VHS_VideoInfoSource", "inputs": {"video_info": ["2", 3]}},
        "4": {"class_type": NODE, "inputs": dict({"images": ["2", 0]}, **{k: s[k] for k in PASS_KEYS},
                                                  resize_type=fx["resize_type"], scale=s["scale"],
                                                  megapixels=fx["megapixels"], width=fx["width"], height=fx["height"],
                                                  divisible_by=fx["divisible_by"], ratio_preset=fx["ratio_preset"],
                                                  resize_method=fx["resize_method"])},
        "9": {"class_type": "VHS_VideoCombine", "inputs": {
            "images": ["4", 0], "frame_rate": ["3", 0], "loop_count": 0,
            "filename_prefix": opts.get("prefix") or "bitgen_rtxvfx", "format": "video/h264-mp4", "pingpong": False,
            "save_output": True, "pix_fmt": "yuv420p", "crf": 15, "save_metadata": False, "trim_to_audio": False}},
    }
    first = "no first pass" if s["first_pass"] == "Off" else f"{s['first_pass']} ({s['first_quality']})"
    notes = [f"RTX VFX: {first} -> {s['upscale_pass']} ({s['upscale_quality']}) x{s['scale']:g}, "
             + (f"{s['batch']} frames per run" if s["batch"] else "every frame in one run")]
    return g, notes


def resolve(values, lists):
    """Check the chosen combo values against what THIS ComfyUI's node offers (lists = {widget: [options]}, [] = the
    server did not say). -> (values, notes, errors). A pass / quality / resize_type it does not offer is an error (the
    look would change); a SOFT widget falls back to the server's first choice, with a note."""
    v, notes, errors = dict(values), [], []
    for k in PASS_KEYS + ("resize_type",) + SOFT:
        opts = [str(x) for x in (lists or {}).get(k) or []]
        if not opts or str(v.get(k)) in opts:
            continue
        if k in SOFT:
            notes.append(f"{NODE}.{k}: this ComfyUI has no {v.get(k)!r} - using {opts[0]!r}")
            v[k] = opts[0]
        else:
            errors.append(f"{NODE}.{k} {v.get(k)!r} is not offered by this ComfyUI's DENO nodes - it offers: "
                          + ", ".join(opts[:20]))
    fmts = [str(x) for x in (lists or {}).get("format") or []]
    if fmts:                                # VHS_LoadVideo.format: the first preferred one the server offers
        cur = str(v.get("format") or LOAD_FORMAT)
        v["format"] = next((f for f in LOAD_FORMAT_PREFER if f in fmts), cur if cur in fmts else fmts[0])
    return v, notes, errors


def concat_list(files):
    """ffmpeg concat-demuxer list text for the chunk files (absolute paths, quotes escaped)"""
    q = lambda p: str(p).replace("\\", "/").replace("'", "'\\''")   # noqa: E731
    return "".join(f"file '{q(f)}'\n" for f in files)


def concat_args(list_file, dest):
    """ffmpeg: the chunks joined losslessly (they share codec / size / frame rate)"""
    return ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy",
            str(dest)]
