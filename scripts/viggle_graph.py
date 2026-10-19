"""bitGen Studio — Viggle-Animate (MiniMax H3) for the character swap (2.344.0).

Tim (with API-viggle-animate-h3_workflow-v1.2.0.json): "https://github.com/
deepbeepmeep/Wan2GP, uses a 3 step viggle animate. i have seen it on youtube.
can you see if we can add viggle to our styles\\workflow".

Viggle-Animate replaces the character in a clip from ONE of the clip's own
frames with the character repainted - the swap dialog's ✎ first frame (Qwen
Image 2.1), exactly like LTX Ripple. comfy_workflows/viggle_animate_h3_api.json
(his upload, verbatim) is patched here per segment - by what the nodes ARE,
never by id:

  the edited first frame   the LoadImage (ref_image)
  the segment clip         VHS_LoadVideo.video (skip 0, cap = frames, 24 fps);
                           the app cuts it AT the render size, so the
                           megapixel resize between it and cond_video is
                           taken out
  size / length            ViggleAnimateConditioning width / height / length
  seed                     RandomNoise.noise_seed
  steps                    the CustomSigmas SamplerCustomAdvanced reads: the
                           Viggle presets (3 = 4 points, the "3 step" DMD
                           schedule; 5 = 6 points; 7 = 8 points), any other
                           count = the 4-point preset interpolated
  the DMD LoRA             the LoraLoaderModelOnly (strength); swap LoRAs
                           chained after it
  output                   the VHS_VideoCombine fed by the VAEDecode (prefix);
                           the side-by-side comparison dropped, then all the
                           output does not need
  speed patches            SolAttnPatch / MiniMaxChunkFeedForward /
                           ModelPatchTorchSettings / ModelAttentionBackend are
                           MODEL -> MODEL: one ComfyUI lacks is stepped over
                           (bypass()), never a failure
  NaNs (2.350.0)           fp16 accumulation off unless ⚙ speed patches;
                           safe_mode(): everything that can make a black
                           take switched off, for the one black retry

Pure: no ComfyUI, no files.
"""
import copy

FPS = 24
DMD_STRENGTH = 1.0
STEPS = 3                                   # "a 3 step viggle animate" (4 sigma points)
SHORT = 480                                 # Viggle's reference canvas is 480x832
SIGMAS = {
    3: "1.0, 0.8571428571428571, 0.6, 0.0",
    5: "1.0, 0.9230769230769231, 0.8181818181818182, 0.6666666666666666, 0.42857142857142855, 0.0",
    7: "1.0, 0.9473684210526315, 0.8823529411764706, 0.8, 0.6923076923076923, 0.5454545454545454, 0.3333333333333333, 0.0",
}
# 2.351.0: MiniMax H3's video VAE encodes 17 * n + 5 frames, and H3 makes 5 to
# 15 seconds (diffusers' minimax_h3: align_num_frames / the 362-frame
# ceiling). Viggle's evaluated length is 124. A segment of any other length is
# rendered at the next valid count (the clip's last frame held if it ends
# first) and trimmed back - 2.344-2.350 sent the segment's own count (120, 48),
# which the H3 VAE cannot encode: the likely cause of Tim's black takes.
MIN_FRAMES, MAX_FRAMES = 124, 362


def align_frames(n):
    """The frame count H3 renders for a segment of n frames (17k + 5, >= 124)."""
    n = max(MIN_FRAMES, int(n or 0))
    while n % 17 != 5:
        n += 1
    return n


OPTIONAL = ("SolAttnPatch", "MiniMaxChunkFeedForward", "ModelPatchTorchSettings", "ModelAttentionBackend")
RESIZERS = ("JWImageResizeToMegapixels", "ImageResizeKJv2", "ImageScale", "ImageScaleToTotalPixels")


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], str) and isinstance(v[1], int)


def _of(g, cls):
    return [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == cls]


def size(w, h, short_side=SHORT):
    """The video's aspect with short_side on the short edge, multiples of 32."""
    w, h, s = max(1, int(w)), max(1, int(h)), max(256, int(short_side or SHORT))
    k = s / min(w, h)
    r = lambda v: max(256, min(2048, int(round(v * k / 32.0)) * 32))  # noqa: E731
    return r(w), r(h)


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


def bypass(g, classes):
    """Step over MODEL -> MODEL nodes of these classes (their consumers read
    what they read). -> the ids removed."""
    gone = []
    for k in [k for k, v in g.items() if v.get("class_type") in set(classes)]:
        src = (g[k].get("inputs") or {}).get("model")
        if not _is_link(src):
            continue
        for v in g.values():
            for key, val in (v.get("inputs") or {}).items():
                if _is_link(val) and val[0] == k:
                    v["inputs"][key] = list(src)
        g.pop(k)
        gone.append(k)
    return gone


# 2.350.0 (Tim: "the render failed: the Viggle render came back ALL BLACK
# ... this was with viggle"): what can make NaNs in this graph, in the order
# it is switched off. fp16 accumulation (ModelPatchTorchSettings) is OFF unless
# ⚙ speed patches is ticked; a black take is rendered ONCE more in safe mode.
LOW_PRECISION = ("int8", "fp8", "e4m3", "e5m2", "nf4", "gguf")


def fp16_accumulation(g, on):
    """Set every ModelPatchTorchSettings' enable_fp16_accumulation (the node
    stays: with False it switches the flag OFF for the run, whatever an
    earlier run left in ComfyUI). -> the ids changed."""
    changed = []
    for k in _of(g, "ModelPatchTorchSettings"):
        ins = g[k].setdefault("inputs", {})
        if ins.get("enable_fp16_accumulation") is not bool(on):
            ins["enable_fp16_accumulation"] = bool(on)
            changed.append(k)
    return changed


def _low(name):
    b = str(name or "").replace("\\", "/").rsplit("/", 1)[-1].lower()
    return any(t in b for t in LOW_PRECISION)


def safe_mode(g0, vae_names=None):
    """The graph with everything that can turn a Viggle take black switched
    off: fp16 accumulation off, the speed patches + the attention backend
    stepped over (ComfyUI's own attention), and a full-precision H3 VAE
    instead of an int8 / fp8 one when ComfyUI lists one.
    -> (graph, [what changed, in words]); nothing to change -> []."""
    g = copy.deepcopy(g0)
    changes = []
    if fp16_accumulation(g, False):
        changes.append("fp16 accumulation off")
    gone = bypass(g, ["SolAttnPatch", "MiniMaxChunkFeedForward"])
    if gone:
        changes.append("the speed patches stepped over")
    backends = [str((g[k].get("inputs") or {}).get("attention") or "") for k in _of(g, "ModelAttentionBackend")]
    if bypass(g, ["ModelAttentionBackend"]):
        changes.append("ComfyUI's own attention (not " + (", ".join(b for b in backends if b) or "the attention backend") + ")")
    for k in _of(g, "VAELoader"):
        cur = (g[k].get("inputs") or {}).get("vae_name")
        if not _low(cur):
            continue
        full = sorted(n for n in (vae_names or []) if "minimax_h3_video_vae" in str(n).lower() and not _low(n))
        if full:
            full.sort(key=lambda n: (0 if "bf16" in n.lower() or "fp16" in n.lower() else 1, n))
            g[k]["inputs"]["vae_name"] = full[0]
            changes.append(f"the {full[0].replace(chr(92), '/').rsplit('/', 1)[-1]} VAE (not the {str(cur).replace(chr(92), '/').rsplit('/', 1)[-1]})")
    return g, changes


def sigmas_for(steps):
    """(sigmas_string, interpolate_to_steps) for a step count."""
    n = max(1, min(50, int(steps or STEPS)))
    return (SIGMAS[n], n) if n in SIGMAS else (SIGMAS[3], n)


def patch(g0, o):
    """o = {image, video, width, height, frames, seed, steps, strength,
    loras: [{name, weight}], prefix}. -> (graph, notes); ValueError in words."""
    if not isinstance(g0, dict) or not g0:
        raise ValueError("the Viggle workflow is empty")
    g = copy.deepcopy({k: v for k, v in g0.items() if not str(k).startswith("_")})
    notes = []
    out = output_node(g)
    if not out:
        raise ValueError("the Viggle workflow has no VHS_VideoCombine fed by a VAEDecode - is it viggle_animate_h3_api.json?")
    conds = _of(g, "ViggleAnimateConditioning")
    if len(conds) != 1:
        raise ValueError(f"the Viggle workflow should have ONE ViggleAnimateConditioning, it has {len(conds)}")
    c = g[conds[0]]["inputs"]
    w, h, frames = int(o["width"]), int(o["height"]), int(o["frames"])
    c["width"], c["height"], c["length"] = w, h, frames
    # the ref image + the driving clip
    ref = c.get("ref_image")
    if not (_is_link(ref) and g.get(ref[0], {}).get("class_type") == "LoadImage"):
        imgs = _of(g, "LoadImage")
        if len(imgs) != 1:
            raise ValueError(f"the Viggle workflow should load ONE picture (the edited first frame), it loads {len(imgs)}")
        ref = [imgs[0], 0]
        c["ref_image"] = ref
    g[ref[0]]["inputs"]["image"] = str(o["image"])
    vids = _of(g, "VHS_LoadVideo")
    if not vids:
        raise ValueError("the Viggle workflow has no VHS_LoadVideo")
    for k in vids:
        ins = g[k]["inputs"]
        ins.update({"video": str(o["video"]), "skip_first_frames": 0, "frame_load_cap": frames, "force_rate": FPS,
                    "custom_width": 0, "custom_height": 0, "select_every_nth": 1})
    cv = c.get("cond_video")
    if _is_link(cv) and g.get(cv[0], {}).get("class_type") in RESIZERS:
        c["cond_video"] = [vids[0], 0]                      # the clip is cut at the render size already
    notes.append(f"{w}x{h}, {frames} frames at {FPS} fps; first frame {o['image']}, clip {o['video']}")
    # seed
    seed = int(o.get("seed") or 0) & 0xFFFFFFFFFFFF
    for k in _of(g, "RandomNoise"):
        if not _is_link(g[k]["inputs"].get("noise_seed")):
            g[k]["inputs"]["noise_seed"] = seed
    notes.append(f"seed {seed}")
    # steps: the sigmas the sampler reads
    samp = _of(g, "SamplerCustomAdvanced")
    if not samp:
        raise ValueError("the Viggle workflow has no SamplerCustomAdvanced")
    sg = g[samp[0]]["inputs"].get("sigmas")
    if _is_link(sg) and g.get(sg[0], {}).get("class_type") == "CustomSigmas":
        s, n = sigmas_for(o.get("steps"))
        g[sg[0]]["inputs"]["sigmas_string"], g[sg[0]]["inputs"]["interpolate_to_steps"] = s, n
        notes.append(f"steps {n} ({len(s.split(','))}-point Viggle sigmas" + ("" if n in SIGMAS else ", interpolated") + ")")
    # the DMD LoRA + the swap LoRAs
    dmd = [k for k in _of(g, "LoraLoaderModelOnly") if "viggle" in str(g[k]["inputs"].get("lora_name") or "").lower()]
    last = None
    if dmd:
        last = dmd[0]
        if o.get("strength") is not None:
            g[last]["inputs"]["strength_model"] = float(o["strength"])
        notes.append(f"DMD LoRA {g[last]['inputs']['lora_name']} @ {g[last]['inputs']['strength_model']:g}")
    else:
        unets = _of(g, "UNETLoader")
        last = unets[0] if unets else None
    extra = [x for x in (o.get("loras") or []) if (x or {}).get("name")]
    if extra and last:
        consumers = [(k, key) for k, v in g.items() for key, val in (v.get("inputs") or {}).items()
                     if _is_link(val) and val[0] == last and val[1] == 0]
        head = last
        for i, l in enumerate(extra):
            nid = f"vl{i + 1}"
            g[nid] = {"class_type": "LoraLoaderModelOnly", "_meta": {"title": f"swap LoRA {i + 1}"},
                      "inputs": {"lora_name": str(l["name"]), "strength_model": float(l.get("weight", 1.0)), "model": [head, 0]}}
            head = nid
            notes.append(f"LoRA {l['name']} @ {float(l.get('weight', 1.0)):g}")
        for k, key in consumers:
            g[k]["inputs"][key] = [head, 0]
    # the output
    g[out]["inputs"]["filename_prefix"] = str(o.get("prefix") or "bitgen_viggle")
    g[out]["inputs"]["save_output"] = True
    g[out]["inputs"]["frame_rate"] = FPS
    dropped = prune(g, out)
    if dropped:
        notes.append(f"pruned {len(dropped)} node(s) the output does not need (the comparison, the unused sigmas)")
    return g, notes
