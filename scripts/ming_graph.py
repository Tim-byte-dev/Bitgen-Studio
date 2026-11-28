#!/usr/bin/env python3
"""bitGen Studio — 🧩 MING LAYERED DESIGN's ComfyUI graphs (3.12.0), built from ComfyUI's OWN Ming-Image nodes (the v0.46.0
release: comfy/model_base.MingImage, comfy_extras/nodes_ming.py) with Comfy-Org/Ming-Image's repacked files (MIT).

Tim (verbatim): "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image"

THE DESIGN - Comfy-Org's own template (workflow_templates image_ming_image_01_design_t2i.json), without its optional prompt
expander and attention switch:
    UNETLoader (ming_image_0.1_design_* - 0.2 when its own text encoder is listed, see pick) -> ModelSamplingFlux (1.15 / 0.5,
    the size) -> BasicScheduler (simple, 12) ; CLIPLoader (that model's ming_image_*_ling_mini_2.0_*, type qwen_image) ->
    CLIPTextEncode (the layer list's JSON) -> BasicGuider
    EmptyLatentImage (w, h) + RandomNoise + KSamplerSelect (euler) -> SamplerCustomAdvanced -> VAEDecode -> SaveImage

THE LAYERS - Ming-Image-0.1-Design-Layer (Comfy-Org has no template for it; built from what ComfyUI and inclusionAI's code say):
  * ComfyUI's Lumina model reads a 5-D latent's frame axis as "composite + layers for Ming-Image-Layer"
    (comfy/ldm/lumina/model.py) - so the empty latent is EmptyQwenImageLayeredLatentImage (layers -> layers + 1 frames);
  * the picture to split goes in as TextEncodeMingImageEdit's image_1: the text encoder sees it AND the VAE puts it after the
    target frames as a clean reference frame (model_base.MingImage ref_frames) - inclusionAI's message order (picture, plan);
  * inclusionAI's layer sampling is 12 steps at cfg 2.0 with the negative = the conditioning zeroed
    (modeling_bailingmm2.py: condition_embeds * 0.0) -> CFGGuider + ConditioningZeroOut. NOT EXACT: their code also zeroes
    the second conditioning; ComfyUI's ConditioningZeroOut leaves the Ming "direct_context" as it is (both sides carry it);
  * frame 0 is the composite (inclusionAI's infer.py skips it) - the worker drops it; frames 1..N = Layer 1 (front) .. N;
  * LatentCutToBatch (t, 1) BEFORE the decode: the Ming VAE is a Wan 2.1-layout video VAE - decoding N frames as one clip
    would mix them in time; one frame per batch item decodes each layer on its own;
  * the Ming VAE takes and gives RGBA (comfy/sd.py: the encoder's 4 input channels) - SaveImage writes the transparency.

Pure: pick(), build_design() and build_layers() take lists and dicts (scripts/test-ming-31200.py checks them without ComfyUI).
"""
import re

REQUIRED = ["UNETLoader", "CLIPLoader", "VAELoader", "ModelSamplingFlux", "CLIPTextEncode", "EmptyLatentImage", "RandomNoise",
            "KSamplerSelect", "BasicScheduler", "BasicGuider", "SamplerCustomAdvanced", "VAEDecode", "SaveImage"]
REQUIRED_LAYERS = ["LoadImage", "ImageScale", "TextEncodeMingImageEdit", "EmptyQwenImageLayeredLatentImage", "ConditioningZeroOut",
                   "CFGGuider", "LatentCutToBatch"]
DESIGN = {"steps": 12, "cfg": 1.0, "sampler": "euler", "scheduler": "simple", "max_shift": 1.15, "base_shift": 0.5}
LAYERS = {"steps": 12, "cfg": 2.0, "sampler": "euler", "scheduler": "simple", "max_shift": 1.15, "base_shift": 0.5}
HINT = {"design": "ming_image_0.1_design_int8_convrot.safetensors", "design_te": "ming_image_0.1_ling_mini_2.0_int8_convrot.safetensors",
        "layer": "ming_image_0.1_design_layer_int8_convrot.safetensors", "layer_te": "ming_image_0.1_ling_mini_2.0_layer_int8_convrot.safetensors",
        "vae": "ming_image_vae_bf16.safetensors"}
CLIP_TYPE = "qwen_image"          # Comfy-Org's templates; ComfyUI tells the Ming text encoder by its weights whatever the type
ADDON = "Settings ▸ Add-ons ▸ 🧩 Ming layered design"
UPDATE = ("Ming-Image runs in ComfyUI's own nodes since the v0.46.0 release - update ComfyUI (Settings ▸ ComfyUI ▸ ⤓ Update "
          "ComfyUI, or the portable build's update\\update_comfyui.bat), then restart it")


def _base(name):
    return str(name or "").replace("\\", "/").split("/")[-1].lower()


def _find(names, pattern, prefer, avoid=None):
    found = [str(n) for n in (names or []) if re.search(pattern, _base(n)) and not (avoid and re.search(avoid, _base(n)))]
    for p in prefer:
        for n in found:
            if p in _base(n):
                return n
    return found[0] if found else ""


def prefer_of(precision):
    return ["bf16", "int8", "fp8"] if precision == "bf16" else ["int8", "fp8", "bf16"]


def pick(unets, clips, vaes, need=("design", "layer"), precision="int8"):
    """-> {design, design_te, layer, layer_te, vae, notes, error, missing} from what ComfyUI lists; precision "int8" | "bf16" or
    {design, layer} (lib/mingAddon.js: bf16 for a model whose bf16 set is downloaded)"""
    pd = precision.get("design") if isinstance(precision, dict) else precision
    pl = precision.get("layer") if isinstance(precision, dict) else precision
    # 3.13.2 (Tim: "are we using the comfy ming image modes?"): a design model only with ITS OWN text encoder. ComfyUI's Ming
    # text encoder file carries the Ling-mini-2.0 LLM AND the connector + projections (comfy/text_encoders/ming_image.py
    # MingImageEncoder); inclusionAI's 0.1 and 0.2 Design share the LLM shards byte for byte but NOT the connector / mlp (their
    # Hugging Face sha256s, checked 28 Nov 2026). Comfy-Org's repo has 0.1's encoder but no 0.2 one (their template names
    # ming_image_0.2_ling_mini_2.0_int8_convrot, which is not there) - so 0.2 Design runs only when a 0.2 encoder is listed.
    no_layer = r"layer"
    d02 = _find(unets, r"ming[-_]?image[-_]0\.2.*design", prefer_of(pd), avoid=no_layer)
    t02 = _find(clips, r"ming[-_]?image[-_]0\.2.*ling", prefer_of(pd) + ["w4a8"], avoid=no_layer)
    d01 = _find(unets, r"ming[-_]?image[-_]0\.1.*design", prefer_of(pd), avoid=no_layer)
    t01 = _find(clips, r"ming[-_]?image[-_]0\.1.*ling", prefer_of(pd) + ["w4a8"], avoid=no_layer)
    notes = []
    if d02 and t02:
        design, dte = d02, t02
    elif d01 and t01:
        design, dte = d01, t01
        if d02:
            notes.append(f"{d02} is here but no 0.2 text encoder is (Comfy-Org has not published one) - using 0.1 Design with its own")
    else:                                                   # names without a version: whatever is there
        design = d01 or _find(unets, r"ming[-_]?image.*design", prefer_of(pd), avoid=no_layer)
        dte = t01 or _find(clips, r"ming[-_]?image.*ling", prefer_of(pd) + ["w4a8"], avoid=no_layer)
        if design and "0.2" in _base(design) and dte and "0.2" not in _base(dte):
            design = ""                                     # 0.2 with 0.1's encoder: the connector does not fit
    got = {"design": design, "design_te": dte,
           "layer": _find(unets, r"ming[-_]?image.*design[-_]?layer", prefer_of(pl)),
           "layer_te": _find(clips, r"ming[-_]?image.*ling.*layer", prefer_of(pl)),
           "vae": _find(vaes, r"ming[-_]?image.*vae", ["bf16"])}
    want = ["vae"] + (["design", "design_te"] if "design" in need else []) + (["layer", "layer_te"] if "layer" in need else [])
    missing = [HINT[k] for k in want if not got[k]]
    if missing:
        return dict(got, notes=notes, missing=missing,
                    error="ComfyUI does not list " + ", ".join(missing) + " - " + ADDON + " downloads them (then restart "
                    "ComfyUI so it lists them)")
    return dict(got, notes=notes, missing=[], error="")


def size16(v, lo=256, hi=4096):
    return max(lo, min(hi, int(round(float(v or 1024) / 16.0)) * 16))


def _graph():
    g, nid = {}, [0]

    def add(ct, inputs):
        nid[0] += 1
        g[str(nid[0])] = {"class_type": ct, "inputs": inputs}
        return str(nid[0])
    return g, add


def _steps(v, d):
    try:
        n = int(v or 0)
    except (TypeError, ValueError):
        n = 0
    return max(1, min(60, n)) if n > 0 else d


def build_design(o):
    """o = {model, te, vae, prompt, width, height, seed, steps?, prefix} -> (graph, notes) - one picture"""
    if not str(o.get("prompt") or "").strip():
        raise ValueError("the design needs its prompt (the layer list)")
    w, h = size16(o.get("width")), size16(o.get("height"))
    st = _steps(o.get("steps"), DESIGN["steps"])
    g, add = _graph()
    unet = add("UNETLoader", {"unet_name": o["model"], "weight_dtype": "default"})
    m = add("ModelSamplingFlux", {"model": [unet, 0], "max_shift": DESIGN["max_shift"], "base_shift": DESIGN["base_shift"], "width": w, "height": h})
    clip = add("CLIPLoader", {"clip_name": o["te"], "type": CLIP_TYPE, "device": "default"})
    vae = add("VAELoader", {"vae_name": o["vae"]})
    pos = add("CLIPTextEncode", {"text": str(o["prompt"]), "clip": [clip, 0]})
    lat = add("EmptyLatentImage", {"width": w, "height": h, "batch_size": 1})
    noise = add("RandomNoise", {"noise_seed": int(o.get("seed") or 0)})
    smp = add("KSamplerSelect", {"sampler_name": DESIGN["sampler"]})
    sig = add("BasicScheduler", {"model": [m, 0], "scheduler": DESIGN["scheduler"], "steps": st, "denoise": 1.0})
    gd = add("BasicGuider", {"model": [m, 0], "conditioning": [pos, 0]})
    out = add("SamplerCustomAdvanced", {"noise": [noise, 0], "guider": [gd, 0], "sampler": [smp, 0], "sigmas": [sig, 0], "latent_image": [lat, 0]})
    dec = add("VAEDecode", {"samples": [out, 0], "vae": [vae, 0]})
    add("SaveImage", {"images": [dec, 0], "filename_prefix": o.get("prefix") or "bitgen_ming/design"})
    return g, [f"the design {w}x{h} · {st} steps, {DESIGN['sampler']} / {DESIGN['scheduler']}, shift {DESIGN['max_shift']} / {DESIGN['base_shift']}"]


def build_layers(o):
    """o = {model, te, vae, prompt (the plan), image (uploaded name), layers (N), width, height, seed, steps?, cfg?, prefix}
    -> (graph, notes) - N + 1 RGBA pictures in one batch: the composite, then Layer 1 (front) .. Layer N"""
    n = int(o.get("layers") or 0)
    if n < 1:
        raise ValueError("splitting needs at least one layer")
    if not o.get("image"):
        raise ValueError("splitting needs the picture")
    if not str(o.get("prompt") or "").strip():
        raise ValueError("splitting needs the layer plan")
    w, h = size16(o.get("width")), size16(o.get("height"))
    st = _steps(o.get("steps"), LAYERS["steps"])
    try:
        cfg = float(o.get("cfg") or 0) or LAYERS["cfg"]
    except (TypeError, ValueError):
        cfg = LAYERS["cfg"]
    g, add = _graph()
    unet = add("UNETLoader", {"unet_name": o["model"], "weight_dtype": "default"})
    m = add("ModelSamplingFlux", {"model": [unet, 0], "max_shift": LAYERS["max_shift"], "base_shift": LAYERS["base_shift"], "width": w, "height": h})
    clip = add("CLIPLoader", {"clip_name": o["te"], "type": CLIP_TYPE, "device": "default"})
    vae = add("VAELoader", {"vae_name": o["vae"]})
    img = add("LoadImage", {"image": o["image"]})
    # the reference frame must be the latent's size (TextEncodeMingImageEdit encodes the first picture at its own size)
    ref = add("ImageScale", {"image": [img, 0], "upscale_method": "lanczos", "width": w, "height": h, "crop": "disabled"})
    pos = add("TextEncodeMingImageEdit", {"clip": [clip, 0], "vae": [vae, 0], "prompt": str(o["prompt"]), "images.image_1": [ref, 0]})
    neg = add("ConditioningZeroOut", {"conditioning": [pos, 0]})
    lat = add("EmptyQwenImageLayeredLatentImage", {"width": w, "height": h, "layers": n, "batch_size": 1})
    noise = add("RandomNoise", {"noise_seed": int(o.get("seed") or 0)})
    smp = add("KSamplerSelect", {"sampler_name": LAYERS["sampler"]})
    sig = add("BasicScheduler", {"model": [m, 0], "scheduler": LAYERS["scheduler"], "steps": st, "denoise": 1.0})
    gd = add("CFGGuider", {"model": [m, 0], "positive": [pos, 0], "negative": [neg, 0], "cfg": cfg})
    out = add("SamplerCustomAdvanced", {"noise": [noise, 0], "guider": [gd, 0], "sampler": [smp, 0], "sigmas": [sig, 0], "latent_image": [lat, 0]})
    cut = add("LatentCutToBatch", {"samples": [out, 0], "dim": "t", "slice_size": 1})
    dec = add("VAEDecode", {"samples": [cut, 0], "vae": [vae, 0]})
    add("SaveImage", {"images": [dec, 0], "filename_prefix": o.get("prefix") or "bitgen_ming/layers"})
    return g, [f"the layers {w}x{h} · {n} layers + the composite · {st} steps, cfg {cfg}, {LAYERS['sampler']} / {LAYERS['scheduler']}"]


def layer_items(items, n):
    """SaveImage's N + 1 pictures (the composite first) -> the N layers, front first; fewer = what came"""
    items = list(items or [])
    return items[1:] if len(items) == n + 1 else items[-n:] if len(items) > n + 1 else items[1:] if len(items) > 1 else items
