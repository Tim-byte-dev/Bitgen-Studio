"""bitGen Studio — LTX 2.5: the job's values into the converted API graph (2.338.0).

The graph is ONE mode of Tim's "LTX 2.5 All-In-One" canvas, converted by
scripts/ltx_convert.js against the live ComfyUI (lib/ltxWorkflow.prepare +
lib/graphToApi). Every value is written by what the canvas CALLS things, never
by node id (a subgraph's nodes come back as "<instance>:<id>"):

  prompt         CLIPTextEncode titled "... positive" -> text
  negative       CLIPTextEncode titled "... negative" -> text (when given)
  pictures       LoadImage "Load Image1" / "Load Image2" / "Load Image3" -> image
                 (first; last or middle; last in first-middle-last)
  audio          VHS_LoadAudioUpload -> audio, start_time (its duration is the
                 canvas's own link from the clip length)
  video          VHS_LoadVideo -> video, skip_first_frames (the rest is linked)
  seconds        mxSlider "Clip Length" -> Xi / Xf (isfloatX 0)
  fps            INTConstant "FPS" -> value
  size           ResolutionSelector -> its width / height outputs become numbers
  seed           every RandomNoise -> noise_seed (seed, seed+1, ...)
  loras          Power Lora Loader rows: the TRANSITION row only on in the
                 modes that travel between two pictures; the style's LoRAs added
  output         VHS_VideoCombine -> filename_prefix
  (2.339.0, LTX Ripple - the swap dialog's second engine)
  frames         VHS_LoadVideo frame_load_cap = exactly this many frames (8k+1)
  ic_lora        LTXICLoRALoaderModelOnly -> the IC-LoRA file + strength
                 (LTX25_Ripple_v11 at 1.35 instead of the union-control one)
  raw_guide      the IC guide gets the RAW video: the ResizeImageMaskNode fed by
                 a pose / depth / canny preprocessor is fed that preprocessor's
                 own input instead (the preprocessors are pruned)
Then everything the output does not need is pruned (the other loaders and
pictures, the audio preview).

Pure: no ComfyUI, no files. ltx_worker.py runs it.
"""
import copy
import re

TRANSITION_MODES = ("flf", "fl_lipsync", "fmlf")
PREPROCESSORS = ("DWPreprocessor", "DepthAnythingV2Preprocessor", "CannyEdgePreprocessor",
                 "OpenposePreprocessor", "LineArtPreprocessor", "AIO_Preprocessor")
IC_LORA_CLASSES = ("LTXICLoRALoaderModelOnly",)
TRANSITION_RE = re.compile(r"transition", re.I)
OUTPUT_CLASSES = ("VHS_VideoCombine", "SaveVideo", "SaveAnimatedWEBP")


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int)) and isinstance(v[1], int)


def _title(n):
    return str(((n or {}).get("_meta") or {}).get("title") or "")


def _of(g, cls):
    return [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == cls]


def prune(g):
    """Keep only what the output node(s) need."""
    roots = [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") in OUTPUT_CLASSES]
    keep, stack = set(), list(roots)
    while stack:
        k = str(stack.pop())
        if k in keep or k not in g:
            continue
        keep.add(k)
        for v in (g[k].get("inputs") or {}).values():
            if _is_link(v):
                stack.append(str(v[0]))
    dropped = [k for k in list(g) if k not in keep]
    for k in dropped:
        g.pop(k, None)
    return dropped


def _replace_output(g, src, slot, value):
    """Every input linked to (src, slot) gets `value` instead."""
    n = 0
    for v in g.values():
        ins = (v or {}).get("inputs") or {}
        for key, val in list(ins.items()):
            if _is_link(val) and str(val[0]) == str(src) and int(val[1]) == int(slot):
                ins[key] = value
                n += 1
    return n


def patch(g, o):
    """o = {mode, prompt, negative, images: [names], audio: {name, start},
    video: {name, skip}, seconds, fps, width, height, seed, prefix,
    style_loras: [{path, weight}], transition (None = by mode)}.
    Returns (graph, notes); raises ValueError in words."""
    if not isinstance(g, dict) or not g:
        raise ValueError("the LTX graph is empty - the conversion failed")
    g = copy.deepcopy(g)
    notes = []
    mode = str(o.get("mode") or "")
    # prompt / negative
    pos = [k for k in _of(g, "CLIPTextEncode") if "positive" in _title(g[k]).lower()]
    neg = [k for k in _of(g, "CLIPTextEncode") if "negative" in _title(g[k]).lower()]
    if not pos:
        raise ValueError("the LTX graph has no CLIPTextEncode titled 'positive' - is it Tim's all-in-one canvas?")
    for k in pos:
        g[k]["inputs"]["text"] = str(o.get("prompt") or "")
    if o.get("negative") and neg:
        for k in neg:
            g[k]["inputs"]["text"] = str(o["negative"])
    notes.append(f"prompt: {len(str(o.get('prompt') or ''))} chars -> node {pos[0]}")
    # pictures
    imgs = [str(x) for x in (o.get("images") or []) if x]
    slots = {}
    for i, name in enumerate(imgs[:3]):
        ids = [k for k in _of(g, "LoadImage") if re.search(rf"image\s*{i + 1}\b", _title(g[k]), re.I)]
        for k in ids:
            g[k]["inputs"]["image"] = name
            g[k]["inputs"].setdefault("upload", "image")
        slots[i] = (name, ids)
    # audio
    au = o.get("audio") or {}
    for k in _of(g, "VHS_LoadAudioUpload"):
        if au.get("name"):
            g[k]["inputs"]["audio"] = str(au["name"])
            g[k]["inputs"]["start_time"] = float(au.get("start") or 0)
            notes.append(f"audio {au['name']} from {float(au.get('start') or 0):.2f}s")
    # video
    vd = o.get("video") or {}
    for k in _of(g, "VHS_LoadVideo"):
        if vd.get("name"):
            ins = g[k]["inputs"]
            ins["video"] = str(vd["name"])
            ins["skip_first_frames"] = int(vd.get("skip") or 0)
            ins.setdefault("select_every_nth", 1)
            ins.setdefault("custom_width", 0)
            ins.setdefault("custom_height", 0)
            ins.setdefault("format", "AnimateDiff")
            notes.append(f"video {vd['name']} from frame {int(vd.get('skip') or 0)}")
    # 2.339.0: exact frames (Ripple: the window's 8k+1)
    if o.get("frames"):
        for k in _of(g, "VHS_LoadVideo"):
            g[k]["inputs"]["frame_load_cap"] = int(o["frames"])
        notes.append(f"the video: {int(o['frames'])} frames")
    # 2.339.0: the IC-LoRA (Ripple) + the raw guide
    ic = o.get("ic_lora") or {}
    if ic.get("name"):
        hit = [k for k, v in g.items() if v.get("class_type") in IC_LORA_CLASSES]
        if not hit:
            raise ValueError("this LTX mode has no IC-LoRA loader (LTXICLoRALoaderModelOnly) - Ripple runs the "
                             "canvas's style-transfer mode")
        for k in hit:
            ins = g[k]["inputs"]
            lk = [x for x, v in ins.items() if isinstance(v, str) and v.lower().endswith((".safetensors", ".ckpt", ".pt"))]
            ins[lk[0] if lk else "lora_name"] = str(ic["name"])
            sk = [x for x in ins if "strength" in x.lower()]
            ins[sk[0] if sk else "strength_model"] = float(ic.get("strength", 1.0))
        notes.append(f"IC-LoRA {ic['name']} @ {float(ic.get('strength', 1.0)):g}")
    if o.get("raw_guide"):
        pre = {k for k, v in g.items() if v.get("class_type") in PREPROCESSORS}
        n = 0
        for v in g.values():
            ins = v.get("inputs") or {}
            for key, val in list(ins.items()):
                if _is_link(val) and str(val[0]) in pre:
                    src = (g[str(val[0])].get("inputs") or {}).get("image")
                    if _is_link(src):
                        ins[key] = list(src)
                        n += 1
        notes.append(f"the IC guide gets the raw video ({n} wire(s) around the preprocessor)")
    # length / fps
    secs = max(1, int(round(float(o.get("seconds") or 5))))
    for k in _of(g, "mxSlider"):
        g[k]["inputs"].update({"Xi": secs, "Xf": float(secs), "isfloatX": 0})
    fps = int(o.get("fps") or 24)
    for k in _of(g, "INTConstant"):
        if "fps" in _title(g[k]).lower():
            g[k]["inputs"]["value"] = fps
    notes.append(f"{secs}s at {fps} fps = {secs * fps + 1} frames")
    # size
    w, h = int(o.get("width") or 0), int(o.get("height") or 0)
    if w and h:
        for k in _of(g, "ResolutionSelector"):
            n0 = _replace_output(g, k, 0, w)
            n1 = _replace_output(g, k, 1, h)
            notes.append(f"size {w}x{h} ({n0 + n1} input(s))")
    # seed
    seed = int(o.get("seed") if o.get("seed") is not None else 0) & 0xFFFFFFFFFFFF
    for i, k in enumerate(sorted(_of(g, "RandomNoise"))):
        g[k]["inputs"]["noise_seed"] = (seed + i) & 0xFFFFFFFFFFFF
        g[k]["inputs"].setdefault("control_after_generate", "fixed")
    # loras
    trans = o.get("transition")
    if trans is None:
        trans = mode in TRANSITION_MODES
    for k in [k for k, v in g.items() if str(v.get("class_type", "")).startswith("Power Lora Loader")]:
        ins = g[k]["inputs"]
        for key, row in ins.items():
            if key.startswith("lora_") and isinstance(row, dict) and TRANSITION_RE.search(str(row.get("lora") or "")):
                row["on"] = bool(trans)
                notes.append(f"transition LoRA {row.get('lora')}: {'on' if trans else 'off'}")
        n = 1 + max([int(x[5:]) for x in ins if re.fullmatch(r"lora_\d+", x)] or [0])
        for l in o.get("style_loras") or []:
            if not (l or {}).get("path"):
                continue
            ins[f"lora_{n}"] = {"on": True, "lora": str(l["path"]), "strength": float(l.get("weight", 1)), "strengthTwo": None}
            notes.append(f"style LoRA {l['path']} @ {float(l.get('weight', 1)):g}")
            n += 1
    # output
    for k in _of(g, "VHS_VideoCombine"):
        ins = g[k]["inputs"]
        ins["filename_prefix"] = str(o.get("prefix") or "bitgen_ltx")
        ins.setdefault("format", "video/h264-mp4")
        ins.setdefault("pix_fmt", "yuv420p")
        ins.setdefault("crf", 10)
        ins["save_output"] = True
    dropped = prune(g)
    if ic.get("name") and not any(v.get("class_type") in IC_LORA_CLASSES for v in g.values()):
        raise ValueError("this LTX mode does not use the IC-LoRA loader (LTXICLoRALoaderModelOnly) - Ripple runs "
                         "the canvas's style-transfer mode (v2v)")
    for i, (name, ids) in slots.items():             # said after the prune: what the mode really reads
        if any(k in g for k in ids):
            notes.append(f"Load Image{i + 1} = {name}")
        else:
            notes.append(f"picture {i + 1} ({name}): this mode has no Load Image{i + 1} - not used")
    if dropped:
        notes.append(f"pruned {len(dropped)} node(s) the output does not need")
    return g, notes


# ---- 2.399.0: the timeline camera's LTX-2 camera-control LoRA (static/campath.js ltxLora: its regex)
def camera_lora(names, pattern):
    """The camera LoRA as ComfyUI lists it (a subfolder is fine), or None."""
    if not pattern:
        return None
    rx = re.compile(str(pattern), re.I)
    for n in names or []:
        b = re.split(r"[\\/]", str(n))[-1]
        if b.lower().endswith((".safetensors", ".ckpt", ".pt")) and rx.search(b):
            return str(n)
    return None


# ---- 2.339.0: the LTX Ripple segment (ltx_worker cuts + finishes with these)
FPS = 24


def ripple_size(w, h, short_side=544):
    """Multiples of 32 at the source aspect, short side = short_side."""
    w, h, s = max(1, int(w)), max(1, int(h)), max(64, int(short_side or 544))
    k = s / min(w, h)
    r = lambda v: max(256, min(2048, int(round(v * k / 32.0)) * 32))  # noqa: E731
    return r(w), r(h)


def ripple_cut_args(src, dst, start, frames, width, height):
    """ffmpeg: the segment at 24 fps, scaled + cropped to the render size,
    exactly `frames` frames (the last one held if the video ends first),
    the audio kept (for the mux back)."""
    vf = (f"fps={FPS},scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},setsar=1,tpad=stop_mode=clone:stop={int(frames)}")
    return ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{float(start):.3f}", "-i", str(src),
            "-t", f"{int(frames) / FPS + 0.5:.4f}", "-vf", vf, "-frames:v", str(int(frames)),
            "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", str(dst)]


def ripple_finish_args(raw, clip, dst, frames, has_audio):
    """ffmpeg: the render trimmed to the segment's frames (one encode) + the
    clip's ORIGINAL audio for exactly that long."""
    dur = int(frames) / FPS
    a = ["-i", str(clip), "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"] if has_audio else ["-map", "0:v:0", "-an"]
    return (["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw)] + a
            + ["-frames:v", str(int(frames)), "-t", f"{dur:.4f}", "-r", str(FPS),
               "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dst)])


DROP = "__bitgen_drop__"        # lib/ltxOfficial.DROP: a LoRA this ComfyUI does not have


def _title_of(ins):
    return "the text encoder's LoRA" if "clip" in ins else "a LoRA"


# ---- 2.401.5: Comfy-Org's own LTX 2.5 templates (lib/ltxOfficial.js) - the API graph's finishing touches
def official_finish(g, o):
    """g = the converted template (scripts/ltx_convert.js oconvert), o = {models: {unet, gguf}, style_loras:
    [{path, weight}], negative}. A .gguf transformer goes on ComfyUI-GGUF's UnetLoaderGGUF (the template loads
    safetensors on the core UNETLoader); the style's / camera's LoRAs are chained right behind the transformer
    (LoraLoaderModelOnly); a negative replaces the template's typed one. Returns (g, notes)."""
    g = copy.deepcopy(g)
    notes = []
    m = o.get("models") or {}
    # 2.402.0: a LoRA loader lib/ltxOfficial marked DROP (this ComfyUI lacks the file) leaves the graph - whoever read
    # its MODEL (slot 0) / CLIP (slot 1) reads what fed it
    for k in [k for k, v in g.items() if v.get("class_type") in ("LoraLoaderModelOnly", "LoraLoader")
              and (v.get("inputs") or {}).get("lora_name") == DROP]:
        ins = g[k].get("inputs") or {}
        feed = {0: ins.get("model"), 1: ins.get("clip")}
        for v in g.values():
            for key, val in list((v.get("inputs") or {}).items()):
                if _is_link(val) and str(val[0]) == str(k) and _is_link(feed.get(int(val[1]))):
                    v["inputs"][key] = list(feed[int(val[1])])
        g.pop(k, None)
        notes.append(f"{_title_of(ins)} left out (not in ComfyUI's loras)")
    loaders = _of(g, "UNETLoader")
    if m.get("gguf"):
        for k in loaders:
            g[k] = {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": str(m.get("unet") or g[k]["inputs"].get("unet_name"))},
                    "_meta": {"title": "Unet Loader (GGUF)"}}
        notes.append(f"transformer {m.get('unet')} on UnetLoaderGGUF (ComfyUI-GGUF)")
        loaders = _of(g, "UnetLoaderGGUF")
    if not loaders:                                   # 2.402.0: LTX 2.3 loads one checkpoint (MODEL = slot 0)
        loaders = _of(g, "CheckpointLoaderSimple")
    loras = [x for x in (o.get("style_loras") or []) if (x or {}).get("path")]
    if loras and loaders:
        src = loaders[0]
        users = [(v, key) for v in g.values() for key, val in (v.get("inputs") or {}).items()
                 if _is_link(val) and str(val[0]) == str(src) and int(val[1]) == 0]
        last = [src, 0]
        for i, l in enumerate(loras):
            nid = f"{src}_lora{i + 1}"
            g[nid] = {"class_type": "LoraLoaderModelOnly", "_meta": {"title": f"LoRA {i + 1}"},
                      "inputs": {"model": list(last), "lora_name": str(l["path"]), "strength_model": float(l.get("weight", 1))}}
            last = [nid, 0]
            notes.append(f"style LoRA {l['path']} @ {float(l.get('weight', 1)):g}")
        for v, key in users:
            v["inputs"][key] = list(last)
    neg = str(o.get("negative") or "").strip()
    if neg:
        # 2.402.0: only the encoder that feeds a NEGATIVE input (LTX 2.3's first-last template types its positive
        # prompt into an encoder too - the old "every typed encoder" rule overwrote the prompt)
        negs = {str(val[0]) for v in g.values() for key, val in (v.get("inputs") or {}).items()
                if key == "negative" and _is_link(val)}
        for k in _of(g, "CLIPTextEncode"):
            if str(k) in negs and isinstance(g[k]["inputs"].get("text"), str):
                g[k]["inputs"]["text"] = neg
                notes.append("negative prompt from the style")
    return g, notes
