"""bitGen Studio — LTX Ripple through Tim's own workflow (2.342.0).

Tim: "use this workflow for the character swap, i tested it in comfy and it
works". comfy_workflows/LTX_Ripple_FFAF_Edit_v11.json (his UI export) is
converted once (scripts/ui_named_to_api.py -> ..._api.json, shipped) and
patched here per segment - by what the nodes ARE, never by id:

  width / height / frames / fps  the INTConstant titled "Set Width" / "Set
                                 Height" / "Set Frames Amount" / "Set FPS"
  seed                           SeedNode.seed (RandomNoise reads it)
  steps                          BasicScheduler.steps
  prompt / negative              the CLIPTextEncode on LTXVConditioning's
                                 positive / negative
  the edited first frame         the LoadImage
  the segment clip               VHS_LoadVideo.video (skip 0; its frame cap
                                 is the Frames constant)
  the Ripple LoRA                the LoraLoaderModelOnly whose file says
                                 "ripple" (name as ComfyUI lists it, strength)
  extra LoRAs                    LoraLoaderModelOnly nodes chained after it
  output                         the VHS_VideoCombine fed by the VAEDecode
                                 (prefix); the input preview and the
                                 side-by-side comparison are dropped, then
                                 everything the output does not need

His graph's guide is [the edited frame, the clip's frames...] sliced to
Frames: output frame 0 is the still, frame k follows clip frame k-1. So the
worker renders Frames = 8k+1 >= the segment + 1 and drops frame 0.

Pure: no ComfyUI, no files.
"""
import copy
import re

RIPPLE_RE = re.compile(r"ripple", re.I)
FPS = 24


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], str) and isinstance(v[1], int)


def _title(n):
    return str(((n or {}).get("_meta") or {}).get("title") or "")


def _of(g, cls):
    return [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == cls]


def render_frames(n):
    """LTX: 8k+1 frames covering the segment plus the still at frame 0."""
    f = max(1, int(n)) + 1
    return max(9, 8 * ((f - 1 + 7) // 8) + 1)


def _const(g, title_re):
    return [k for k in _of(g, "INTConstant") if re.search(title_re, _title(g[k]), re.I)]


def output_node(g):
    """The VHS_VideoCombine whose images come from a VAEDecode."""
    for k in _of(g, "VHS_VideoCombine"):
        src = (g[k].get("inputs") or {}).get("images")
        if _is_link(src) and (g.get(src[0]) or {}).get("class_type") == "VAEDecode":
            return k
    return None


def prune(g, keep_root):
    keep, stack = set(), [keep_root]
    while stack:
        k = stack.pop()
        if k in keep or k not in g:
            continue
        keep.add(k)
        for v in (g[k].get("inputs") or {}).values():
            if _is_link(v):
                stack.append(v[0])
    dropped = [k for k in g if k not in keep]
    for k in dropped:
        g.pop(k)
    return dropped


def patch(g0, o):
    """o = {image, video, width, height, frames, fps, seed, steps, prompt,
    negative, lora (name as listed | None = keep), strength, loras:
    [{name, weight}], prefix}. -> (graph, notes); ValueError in words."""
    if not isinstance(g0, dict) or not g0:
        raise ValueError("the Ripple workflow is empty")
    g = copy.deepcopy(g0)
    notes = []
    out = output_node(g)
    if not out:
        raise ValueError("the Ripple workflow has no VHS_VideoCombine fed by a VAEDecode - is it LTX_Ripple_FFAF_Edit_v11?")

    def put_const(title_re, value, what):
        ids = _const(g, title_re)
        if not ids:
            raise ValueError(f"the Ripple workflow has no INTConstant titled like '{title_re}' ({what})")
        for k in ids:
            g[k]["inputs"]["value"] = int(value)
    w, h = int(o["width"]), int(o["height"])
    frames = int(o["frames"])
    put_const(r"^set\s*width$", w, "width")
    put_const(r"^set\s*height$", h, "height")
    put_const(r"^set\s*frames", frames, "frames")
    put_const(r"^set\s*fps$", int(o.get("fps") or FPS), "fps")
    notes.append(f"{w}x{h}, {frames} frames at {int(o.get('fps') or FPS)} fps")
    for k in _of(g, "VHS_VideoCombine"):
        g[k]["inputs"]["frame_rate"] = int(o.get("fps") or FPS)
    # seed
    seeds = _of(g, "SeedNode")
    seed = int(o.get("seed") or 0) & 0xFFFFFFFFFFFF
    if seeds:
        for k in seeds:
            g[k]["inputs"]["seed"] = seed
    for k in _of(g, "RandomNoise"):
        if not _is_link(g[k]["inputs"].get("noise_seed")):
            g[k]["inputs"]["noise_seed"] = seed
    notes.append(f"seed {seed}")
    # steps
    if o.get("steps"):
        for k in _of(g, "BasicScheduler"):
            g[k]["inputs"]["steps"] = int(o["steps"])
        notes.append(f"steps {int(o['steps'])}")
    # prompts: by what LTXVConditioning reads
    conds = _of(g, "LTXVConditioning")
    for key, val in (("positive", o.get("prompt")), ("negative", o.get("negative"))):
        if not val:
            continue
        for c in conds:
            src = g[c]["inputs"].get(key)
            if _is_link(src) and g[src[0]]["class_type"] == "CLIPTextEncode":
                g[src[0]]["inputs"]["text"] = str(val)
    # the first frame + the clip
    imgs = _of(g, "LoadImage")
    if len(imgs) != 1:
        raise ValueError(f"the Ripple workflow should load ONE picture (the edited first frame), it loads {len(imgs)}")
    g[imgs[0]]["inputs"]["image"] = str(o["image"])
    vids = _of(g, "VHS_LoadVideo")
    if not vids:
        raise ValueError("the Ripple workflow has no VHS_LoadVideo")
    for k in vids:
        ins = g[k]["inputs"]
        ins["video"] = str(o["video"])
        ins["skip_first_frames"] = 0
        if not _is_link(ins.get("frame_load_cap")):
            ins["frame_load_cap"] = frames
    notes.append(f"first frame {o['image']}, clip {o['video']}")
    # the Ripple LoRA + the extra ones
    rip = [k for k in _of(g, "LoraLoaderModelOnly") if RIPPLE_RE.search(str(g[k]["inputs"].get("lora_name") or ""))]
    if not rip:
        raise ValueError("the Ripple workflow has no LoraLoaderModelOnly with the Ripple LoRA")
    r = rip[0]
    if o.get("lora"):
        g[r]["inputs"]["lora_name"] = str(o["lora"])
    if o.get("strength") is not None:
        g[r]["inputs"]["strength_model"] = float(o["strength"])
    notes.append(f"Ripple LoRA {g[r]['inputs']['lora_name']} @ {g[r]['inputs']['strength_model']:g}")
    last = r
    consumers = [(k, key) for k, v in g.items() for key, val in (v.get("inputs") or {}).items()
                 if _is_link(val) and val[0] == r and val[1] == 0]
    for i, l in enumerate([x for x in (o.get("loras") or []) if (x or {}).get("name")]):
        nid = f"rl{i + 1}"
        g[nid] = {"class_type": "LoraLoaderModelOnly", "_meta": {"title": f"swap LoRA {i + 1}"},
                  "inputs": {"lora_name": str(l["name"]), "strength_model": float(l.get("weight", 1.0)), "model": [last, 0]}}
        last = nid
        notes.append(f"LoRA {l['name']} @ {float(l.get('weight', 1.0)):g}")
    for k, key in consumers:
        g[k]["inputs"][key] = [last, 0]
    # the output
    g[out]["inputs"]["filename_prefix"] = str(o.get("prefix") or "bitgen_ripple")
    g[out]["inputs"]["save_output"] = True
    dropped = prune(g, out)
    if dropped:
        notes.append(f"pruned {len(dropped)} node(s) the output does not need (the previews, the comparison)")
    return g, notes


def finish_args(raw, clip, dst, frames, has_audio, drop_first=True):
    """ffmpeg: drop the still at frame 0, keep the segment's frames, the
    clip's ORIGINAL audio for exactly that long."""
    dur = int(frames) / FPS
    vf = ["-vf", "trim=start_frame=1,setpts=PTS-STARTPTS"] if drop_first else []
    a = ["-i", str(clip), "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"] if has_audio else ["-map", "0:v:0", "-an"]
    return (["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw)] + a + vf
            + ["-frames:v", str(int(frames)), "-t", f"{dur:.4f}", "-r", str(FPS),
               "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dst)])
