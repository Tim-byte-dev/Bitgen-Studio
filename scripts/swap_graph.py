"""bitGen Studio — CHARACTER SWAP: the pure half (2.324.0).

Tim: "can we use this workflow to add another functionality to bitgen
studio. to load a reference video and change the character in the reference
video with a character from a reference image. this should be able to work
from a video prompt or from a scene (we add the reference image to a
rendered scene) and run this workflow. and from the video prompt in prompt
docker we use the reference image and reference video loaded".
Answers: keep the ORIGINAL audio; one run over a START + DURATION window of
the video (the single-run ceiling); the scene's picture is a cast sheet or a
dropped picture; the prompt is the workflow's swap template + the user's
text (lib/swap.js builds it).

THE WORKFLOW (comfy_workflows/MiniMax_H3_Swap.json, Tim's
minimax-h3-swap export): MiniMaxH3ReferenceToVideo with
    ref_images.ref_image_0  <- LoadImage            (the new character)
    ref_videos.ref_video_0  <- VHS_LoadVideo        (the performance)
    width / height          <- VHS_VideoInfo loaded size
    length                  <- ComfyMathExpression  (duration -> 17k+5)
    prompt                  <- PrimitiveStringMultiline
2.334.0 (Tim: "the character swap worked for the first 2 seconds of a video,
then it wouldn't work at all ... it seems to not be using the reference image
at all"): H3 names its references <Picture n> / <Video n> / <Audio n> in the
order they are connected - the swap prompt said <Image 1>, a tag H3 does not
know, so nothing in the text pointed at the character picture and the
performance won. patch() now rewrites any <Image n> to <Picture n>, sends the
picture at ref_image_size "max" (up to a 2048-px short edge - the stronger
identity) and add_swap_lora() stacks akatz-ai's H3 Character Swap LoRA onto
the graph's LoRA loader when ComfyUI has it.
The worker has ALREADY cut the window, 24 fps, at the render size
(ffmpeg), so every derived value is known here: patch() writes them as
plain numbers and drops the helper nodes (VideoInfo / the math / the prompt
primitive) - a ComfyUI without ComfyMathExpression still runs the swap.

Pure: no ffmpeg, no ComfyUI. The worker (swap_worker.py) runs these.
"""
import copy
import math
import re

FPS = 24
CEILING = 362                   # 17*21+5, framePlan.MAX_SINGLE_RUN_COMFY
GEN = "MiniMaxH3ReferenceToVideo"
VIDEO_LOADERS = ("VHS_LoadVideo", "VHS_LoadVideoPath", "LoadVideo")
IMAGE_LOADERS = ("LoadImage",)
HELPERS = ("VHS_VideoInfo", "VHS_VideoInfoLoaded", "VHS_VideoInfoSource",
           "ComfyMathExpression", "PrimitiveStringMultiline", "PrimitiveString",
           "PrimitiveInt", "PrimitiveFloat", "GetVideoComponents")


REF_SIZES = ("match", "max")
DEFAULT_REF_SIZE = "max"
# akatz-ai/MiniMax-H3-Character-Swap-LoRA (trained on H3 Ref2VA, strength 1.0,
# 4-5 s shots hold the identity best)
SWAP_LORA_FILE = "h3_character_swap_pro4500_1000.safetensors"
SWAP_LORA_STRENGTH = 1.0
SWAP_LORA_RE = re.compile(r"(h3[_-]?character[_-]?swap|character[_-]?swap[_-]?lora)", re.I)
BEST_FRAMES = 124               # 17*7+5 = 5.17 s - the swap LoRA's 4-5 s shots
_IMAGE_TAG = re.compile(r"<\s*image\s+(\d+)\s*>", re.I)


def fix_tags(text):
    """<Image n> -> <Picture n>: H3's own name for a reference picture."""
    return _IMAGE_TAG.sub(lambda m: f"<Picture {m.group(1)}>", str(text or ""))


def combo_list(spec):
    """The choices of one /object_info input spec, whatever shape the server
    answers in: classic [[a, b], {..}], ["COMBO", {"options": [..]}], or
    {"type": "COMBO", "options": [..]}."""
    if isinstance(spec, list) and spec:
        if isinstance(spec[0], list):
            return [str(x) for x in spec[0]]
        if len(spec) > 1 and isinstance(spec[1], dict):
            o = spec[1].get("options") or spec[1].get("values")
            if isinstance(o, list):
                return [str(x) for x in o]
    if isinstance(spec, dict):
        o = spec.get("options") or spec.get("values")
        if isinstance(o, list):
            return [str(x) for x in o]
    return []


def lora_names(info, class_type="LoraLoaderModelOnly"):
    """ComfyUI's LoRA list from an /object_info answer for a LoRA loader."""
    spec = ((info or {}).get(class_type) or {}).get("input") or {}
    for group in ("required", "optional"):
        got = (spec.get(group) or {}).get("lora_name")
        if got is not None:
            return combo_list(got)
    return []


def find_swap_lora(names):
    """The character-swap LoRA among ComfyUI's LoRAs (the exact file first),
    or None. The lightx2v TURBO LoRA is not it."""
    names = [str(n) for n in (names or [])]
    exact = [n for n in names if n.replace("\\", "/").rsplit("/", 1)[-1] == SWAP_LORA_FILE]
    if exact:
        return exact[0]
    return next((n for n in names if SWAP_LORA_RE.search(n) and "turbo" not in n.lower()), None)


def add_swap_lora(g, name, strength=SWAP_LORA_STRENGTH):
    """Stack the swap LoRA onto the graph's LoRA loader -> (graph, note).
    rgthree's Power Lora Loader gets one more lora_N row (on); otherwise a
    LoraLoaderModelOnly goes between the gen model's loader and whatever read
    it. Already there = untouched."""
    g = copy.deepcopy(g)
    base = lambda n: str(n or "").replace("\\", "/").rsplit("/", 1)[-1]
    for k, v in g.items():
        if not isinstance(v, dict):
            continue
        ins = v.get("inputs") or {}
        for kk, vv in ins.items():
            if (isinstance(vv, dict) and base(vv.get("lora")) == base(name) and vv.get("on") is not False) \
                    or (kk == "lora_name" and base(vv) == base(name)):
                return g, f"swap LoRA: {name} is already in the graph (node {k})"
    power = [k for k, v in g.items() if isinstance(v, dict)
             and str(v.get("class_type", "")).startswith("Power Lora Loader")]
    if power:
        ins = g[power[0]].setdefault("inputs", {})
        n = 1
        while f"lora_{n}" in ins:
            n += 1
        ins[f"lora_{n}"] = {"on": True, "lora": name, "strength": float(strength), "strengthTwo": None}
        return g, f"swap LoRA: {name} @ {float(strength):g} stacked on the Power Lora Loader (node {power[0]}, lora_{n})"
    loaders = [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") in
               ("UNETLoader", "UnetLoaderGGUF", "CheckpointLoaderSimple", "DiffusionModelLoaderKJ")]
    if not loaders:
        return g, "swap LoRA: the graph has no model loader to hang it on - skipped"
    src = loaders[0]
    nid = "h3swaplora"
    for v in g.values():
        if isinstance(v, dict):
            for kk, vv in (v.get("inputs") or {}).items():
                if _is_link(vv) and str(vv[0]) == src and int(vv[1]) == 0 and kk == "model":
                    v["inputs"][kk] = [nid, 0]
    g[nid] = {"class_type": "LoraLoaderModelOnly",
              "inputs": {"model": [src, 0], "lora_name": name, "strength_model": float(strength)},
              "_meta": {"title": "H3 Character Swap LoRA"}}
    return g, f"swap LoRA: {name} @ {float(strength):g} (built {nid} after node {src})"


# 2.336.0 (Tim: "the character swap video is still not working, i
# downloaded ... MiniMax-H3-Character-Swap-LoRA"). The LoRA's own evaluation
# renders used 28 steps, guidance 1, NO turbo LoRA (its README: "does not
# require a Turbo LoRA"); ComfyUI's own H3 reference template ships its
# Lightning LoRA OFF (20 steps) and says beta / normal beat simple for
# reference-heavy prompts. Tim's export runs the lightx2v turbo row at 4
# steps. QUALITY picks which:
#   fast  the export as it is (turbo LoRA, 4 steps)       - quickest
#   full  turbo rows OFF, 20 steps, beta scheduler         - the default
#   best  turbo rows OFF, 28 steps, beta scheduler         - the LoRA's own
QUALITIES = {
    "fast": {"label": "Fast (turbo LoRA, 4 steps)", "turbo": True, "steps": None, "scheduler": None},
    "full": {"label": "Full (20 steps, no turbo)", "turbo": False, "steps": 20, "scheduler": "beta"},
    "best": {"label": "Best (28 steps, no turbo - the swap LoRA's own)", "turbo": False, "steps": 28, "scheduler": "beta"},
}
DEFAULT_QUALITY = "full"
TURBO_RE = re.compile(r"(turbo|lightx2v|lightning|distill|\bcausvid|[_-]4step|[_-]8step)", re.I)


def is_turbo(name):
    """A speed-up LoRA (lightx2v / turbo / lightning), never the swap LoRA."""
    n = str(name or "")
    return bool(TURBO_RE.search(n)) and not SWAP_LORA_RE.search(n)


def apply_quality(g, quality=None):
    """Quality -> (graph, notes). fast = untouched; full / best switch every
    turbo LoRA off (Power Lora Loader rows off; a LoraLoaderModelOnly turbo
    node is bypassed - its readers get its model input) and set the
    scheduler's steps + beta."""
    q = str(quality or DEFAULT_QUALITY).lower()
    if q not in QUALITIES:
        q = DEFAULT_QUALITY
    spec = QUALITIES[q]
    g = copy.deepcopy(g)
    notes = []
    if spec["turbo"]:
        return g, [f"quality {q}: {spec['label']} - the workflow's own turbo LoRA and steps"]
    off = []
    for k, v in g.items():
        if not isinstance(v, dict):
            continue
        ins = v.get("inputs") or {}
        if str(v.get("class_type", "")).startswith("Power Lora Loader"):
            for kk, row in ins.items():
                if kk.startswith("lora_") and isinstance(row, dict) and row.get("on") is not False and is_turbo(row.get("lora")):
                    row["on"] = False
                    off.append(str(row.get("lora")))
    for k in [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") in ("LoraLoaderModelOnly", "LoraLoader")
              and is_turbo((v.get("inputs") or {}).get("lora_name"))]:
        node = g[k]
        src = (node.get("inputs") or {}).get("model")
        if not _is_link(src):
            continue
        for v in g.values():
            if isinstance(v, dict):
                for kk, vv in (v.get("inputs") or {}).items():
                    if _is_link(vv) and str(vv[0]) == str(k) and int(vv[1]) == 0:
                        v["inputs"][kk] = list(src)
        off.append(str(node["inputs"].get("lora_name")))
        g.pop(k)
    steps = []
    for k, v in g.items():
        if not isinstance(v, dict):
            continue
        ct, ins = v.get("class_type"), v.get("inputs") or {}
        if ct in ("BasicScheduler", "KSampler", "KSamplerAdvanced") and isinstance(ins.get("steps"), int):
            ins["steps"] = spec["steps"]
            if "scheduler" in ins and not _is_link(ins.get("scheduler")):
                ins["scheduler"] = spec["scheduler"]
            steps.append(k)
    notes.append(f"quality {q}: {spec['label']} - "
                 + (f"turbo LoRA off ({', '.join(off)})" if off else "no turbo LoRA in the graph")
                 + (f"; {spec['steps']} steps, {spec['scheduler']} scheduler (node {', '.join(steps)})" if steps
                    else "; no scheduler node found - the steps stay the workflow's"))
    return g, notes


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def snap_down(frames):
    """The largest 17k+5 length <= frames (min 5) - H3's frame grid."""
    f = max(5, int(frames))
    return max(5, 5 + 17 * ((f - 5) // 17))


def window(src_dur, start=0.0, dur=None, ceiling=CEILING):
    """The part of the video one run swaps: {start, dur, frames, notes}.
    start clamps into the video; dur blank/0 = to the end; the frames are
    snapped DOWN to 17k+5 and capped at the single-run ceiling, and dur is
    then exactly frames / 24 so the clip, the render and the original audio
    line up frame for frame."""
    notes = []
    src = float(src_dur or 0)
    if src <= 0:
        raise ValueError("the reference video has no duration (is it a video file?)")
    s = float(start or 0)
    if not math.isfinite(s) or s < 0:
        s = 0.0
    if s >= src - (5 / FPS):
        raise ValueError(f"the start ({s:g}s) is past the end of the {src:.2f}s video")
    avail = src - s
    want = float(dur) if dur not in (None, "") else 0.0
    if not math.isfinite(want) or want <= 0 or want > avail:
        if want > avail:
            notes.append(f"the video has {avail:.2f}s after {s:g}s - the swap runs to its end")
        want = avail
    ceil = snap_down(ceiling or CEILING)
    frames = snap_down(round(want * FPS))
    if frames > ceil:
        notes.append(f"{want:.2f}s is longer than one run ({ceil} frames, {ceil / FPS:.2f}s) - "
                     f"the swap covers {s:g}s to {s + ceil / FPS:.2f}s; swap the rest with a later start")
        frames = ceil
    d = frames / FPS
    if abs(d - want) >= 0.5 / FPS and frames < ceil:
        notes.append(f"{want:.2f}s snapped to {frames} frames ({d:.2f}s), H3's 17k+5 grid")
    return {"start": round(s, 3), "dur": d, "frames": frames, "notes": notes}


def size(src_w, src_h, short_side):
    """The render size: the VIDEO's aspect with its short side at
    `short_side`, both edges 16-px aligned (the Basic Settings rule)."""
    w, h = int(src_w or 0), int(src_h or 0)
    if w <= 0 or h <= 0:
        raise ValueError("the reference video has no picture size")
    s = max(128, int(short_side or 544))
    a16 = lambda v: max(128, int(round(v / 16.0)) * 16)
    if w >= h:
        hh = a16(s)
        return a16(hh * w / h), hh
    ww = a16(s)
    return ww, a16(ww * h / w)


def _feeder(g, link):
    return g.get(str(link[0])) if _is_link(link) else None


def _prune(g, ids):
    """Drop the helper nodes nothing reads any more (repeat: a helper can
    feed another helper)."""
    dropped = []
    changed = True
    while changed:
        changed = False
        used = {str(v[0]) for n in g.values() if isinstance(n, dict)
                for v in (n.get("inputs") or {}).values() if _is_link(v)}
        for k in list(ids):
            if k in g and k not in used:
                g.pop(k)
                ids.discard(k)
                dropped.append(k)
                changed = True
    return dropped


def patch(g, video, image, prompt, width, height, frames, seed, prefix="bitgen_swap",
          ref_image_size=None):
    """The swap graph for one run. `video` / `image` are the names ComfyUI
    gave the uploads. Returns (graph, notes); raises ValueError in words
    when the graph is not a swap graph."""
    if not isinstance(g, dict):
        raise ValueError("the swap workflow is not an API graph")
    g = copy.deepcopy(g)
    gens = [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == GEN]
    if not gens:
        raise ValueError(f"the swap workflow has no {GEN} node")
    gid = gens[0]
    gi = g[gid].setdefault("inputs", {})
    notes = []
    helpers = set()
    vkeys = sorted(k for k in gi if k.startswith("ref_videos."))
    ikeys = sorted(k for k in gi if k.startswith("ref_images."))
    vk = next((k for k in vkeys if _is_link(gi[k])), None)
    ik = next((k for k in ikeys if _is_link(gi[k])), None)
    vl, il = gi.get(vk), gi.get(ik)
    vnode, inode = _feeder(g, vl), _feeder(g, il)
    # a core LoadVideo reaches the gen node through GetVideoComponents
    if vnode and vnode.get("class_type") == "GetVideoComponents":
        vnode = _feeder(g, (vnode.get("inputs") or {}).get("video"))
    if not vnode or vnode.get("class_type") not in VIDEO_LOADERS:
        raise ValueError("the swap workflow's <Video 1> is not fed by a video loader "
                         f"({', '.join(VIDEO_LOADERS)})")
    if not inode or inode.get("class_type") not in IMAGE_LOADERS:
        raise ValueError("the swap workflow's <Picture 1> is not fed by LoadImage")
    # every other reference slot is emptied - one performance, one character
    for k in vkeys + ikeys:
        if k not in (vk, ik):
            v = gi.pop(k)
            if _is_link(v):
                helpers.add(str(v[0]))
    vi = vnode.setdefault("inputs", {})
    if vnode.get("class_type") == "LoadVideo":
        vi["file"] = video
    else:
        vi["video"] = video
        vi.update({"force_rate": FPS, "custom_width": int(width), "custom_height": int(height),
                   "frame_load_cap": int(frames), "skip_first_frames": 0, "select_every_nth": 1})
        vi.setdefault("format", "None")
    inode.setdefault("inputs", {})["image"] = image
    prompt = fix_tags(prompt)
    if not re.search(r"<Picture 1>", prompt):
        notes.append("swap: the prompt never names <Picture 1> - H3 will not know which picture is the character")
    for key, val in (("prompt", prompt), ("width", int(width)), ("height", int(height)),
                     ("length", int(frames))):
        old = gi.get(key)
        if _is_link(old):
            helpers.add(str(old[0]))
        gi[key] = val
    rs = str(ref_image_size or DEFAULT_REF_SIZE).lower()
    gi["ref_image_size"] = rs if rs in REF_SIZES else DEFAULT_REF_SIZE
    for k, v in g.items():
        if not isinstance(v, dict):
            continue
        ins = v.get("inputs") or {}
        ct = v.get("class_type")
        if ct == "RandomNoise":
            ins["noise_seed"] = int(seed) & 0xFFFFFFFFFFFF
        elif ct in ("KSampler", "KSamplerAdvanced"):
            ins["seed" if "seed" in ins or ct == "KSampler" else "noise_seed"] = int(seed) & 0xFFFFFFFFFFFF
        elif ct == "SaveVideo":
            ins["filename_prefix"] = prefix
        elif ct == "VHS_VideoCombine":
            ins["filename_prefix"] = prefix
    # helpers upstream of the ones cut loose (VideoInfo behind the math)
    stack = list(helpers)
    while stack:
        n = g.get(stack.pop())
        for v in ((n or {}).get("inputs") or {}).values():
            if _is_link(v) and str(v[0]) not in helpers and \
                    (g.get(str(v[0])) or {}).get("class_type") in HELPERS:
                helpers.add(str(v[0]))
                stack.append(str(v[0]))
    helpers = {h for h in helpers if (g.get(h) or {}).get("class_type") in HELPERS}
    dropped = _prune(g, helpers)
    notes.append(f"swap: {width}x{height}, {frames} frames ({frames / FPS:.2f}s) - "
                 f"<Video 1> = {video}, <Picture 1> = {image} (ref_image_size {gi['ref_image_size']})")
    if dropped:
        notes.append(f"swap: size / length / prompt written directly - {len(dropped)} helper "
                     "node(s) dropped (VideoInfo / the length math / the prompt box)")
    return g, notes


def trim_args(src, dst, start, dur, frames, width, height):
    """ffmpeg: the window, 24 fps, cropped to the render size (the aspect
    was kept by size(), so the crop only trims the 16-px rounding), the
    original audio kept (AAC) - the clip ComfyUI loads AND the audio the
    swap is given back."""
    vf = (f"fps={FPS},scale={width}:{height}:force_original_aspect_ratio=increase,"
          f"crop={width}:{height},setsar=1")
    return ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{float(start):.3f}", "-i", str(src),
            "-t", f"{float(dur):.4f}", "-vf", vf, "-frames:v", str(int(frames)),
            "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", str(dst)]


def mux_args(swapped, clip, dst, dur):
    """ffmpeg: the swapped picture + the ORIGINAL audio of the window. An
    mp4 render is stream-copied (no second encode); anything else (a webm)
    is encoded once to H.264 for the .mp4 take."""
    v = ["-c:v", "copy"] if str(swapped).lower().endswith(".mp4") else \
        ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p"]
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(swapped), "-i", str(clip),
            "-map", "0:v:0", "-map", "1:a:0"] + v + ["-c:a", "aac", "-b:a", "192k",
            "-t", f"{float(dur):.4f}", str(dst)]
