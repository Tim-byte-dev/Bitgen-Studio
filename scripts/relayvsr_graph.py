"""bitGen Studio — RelayVSR VIDEO UPSCALING graph (2.728.0), ComfyUI's core nodes.

Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"

RelayVSR (Xijun Wang et al., Apache-2.0) is a streaming video super-resolution model: a one-step Wan 2.2 5B pass on
every 15th frame (+ the last), and a small "Flash" decoder that restores every frame from those keyframe latents and the
low-quality frames. ComfyUI has it in its core since PR #17511 (2026-11-05, master after commit 2f89433 - not in the
v0.44.0 release; it needs comfy-kitchen 0.2.41's window_attention, which ComfyUI's requirements.txt installs):
    RelayVSRConditioning(model, images) -> (positive, latent)      "sample with 1 step at cfg 1", no prompt, no negative
    VSRDecode(vae, samples, images, detail 0..1) -> images         the Flash decoder; detail 1 = the full model output
Comfy-Org/RelayVSR repacks the files for ComfyUI (Apache-2.0): a x2 pair (LightX2V's, trained on MiniMax H3 clips - the
step after an H3 / LTX render) and the original x4 pair. The factor is the MODEL's: x2 files make exactly 2x, x4 files 4x;
the exact size asked for (1080p, 1920x1080, ...) is the worker's ffmpeg after (fit_vf).

The graph (no negative, so a guider rather than a KSampler):
    LoadVideo -> GetVideoComponents -> UNETLoader + RelayVSRConditioning -> RandomNoise / BasicGuider / KSamplerSelect
    euler / BasicScheduler simple 1 step -> SamplerCustomAdvanced -> VAELoader + VSRDecode -> CreateVideo -> SaveVideo
"""

MODELS = {
    2: {"unet": "relayvsr_x2_lightx2v_int8_convrot.safetensors", "vae": "relayvsr_flash_vae_x2_fp32.safetensors"},
    4: {"unet": "relayvsr_x4_int8_convrot.safetensors", "vae": "relayvsr_flash_vae_x4_fp32.safetensors"},
}
REQUIRED = ["LoadVideo", "GetVideoComponents", "UNETLoader", "VAELoader", "RelayVSRConditioning", "RandomNoise",
            "BasicGuider", "KSamplerSelect", "BasicScheduler", "SamplerCustomAdvanced", "VSRDecode", "CreateVideo",
            "SaveVideo"]
KEYFRAME_INTERVAL = 15          # comfy.ldm.wan.model_vsr.RELAY_KEYFRAME_INTERVAL
ADDON = "Settings ▸ Add-ons ▸ RelayVSR"


def _norm(name):
    return str(name or "").replace("\\", "/").rsplit("/", 1)[-1].lower()


def _find(listed, want):
    """the entry of ComfyUI's dropdown that IS `want` (a subfolder kept: ComfyUI lists "sub/file")"""
    w = _norm(want)
    for x in listed or []:
        if _norm(x) == w:
            return x
    return ""


def pick(unets, vaes, factor, asked_unet="", asked_vae=""):
    """The pair for `factor` (2 | 4) from what ComfyUI lists -> (unet, vae, note); unet "" = missing (note says what)."""
    f = 4 if int(factor or 2) == 4 else 2
    m = MODELS[f]
    unet = _find(unets, asked_unet) if asked_unet else ""
    unet = unet or _find(unets, m["unet"])
    if not unet:                                    # a renamed copy: anything relayvsr + x2 / x4 in the name
        unet = next((u for u in unets or [] if "relayvsr" in _norm(u) and f"x{f}" in _norm(u)), "")
    vae = _find(vaes, asked_vae) if asked_vae else ""
    vae = vae or _find(vaes, m["vae"])
    if not vae:
        vae = next((v for v in vaes or [] if "relayvsr" in _norm(v) and f"x{f}" in _norm(v)), "")
    if not unet or not vae:
        miss = ([f"models/diffusion_models/{m['unet']}"] if not unet else []) + ([f"models/vae/{m['vae']}"] if not vae else [])
        return "", "", (f"RelayVSR x{f} needs " + " and ".join(miss) + f" in ComfyUI - {ADDON} downloads them "
                        "(the x2 and x4 files are a pair each: never mix them)")
    return unet, vae, f"RelayVSR x{f}: {unet} + {vae}"


def keyframes(frames):
    """how many frames go through the model (every 15th + the last) - the log says it"""
    n = int(frames or 0)
    if n <= 1:
        return 1
    return len(range(0, n - 1, KEYFRAME_INTERVAL)) + 1


def build(opts):
    """opts: video (the uploaded name), unet, vae, seed, detail (0..1), prefix, bit_depth (wire GetVideoComponents'
    bit_depth into CreateVideo when this ComfyUI has it). -> (graph, notes)"""
    if not opts.get("unet") or not opts.get("vae"):
        raise ValueError(f"no RelayVSR model / Flash VAE - {ADDON}")
    try:
        detail = float(opts.get("detail") if opts.get("detail") is not None else 1.0)
    except (TypeError, ValueError):
        detail = 1.0
    detail = max(0.0, min(1.0, detail))
    g = {
        "1": {"class_type": "LoadVideo", "inputs": {"file": opts["video"]}},
        "2": {"class_type": "GetVideoComponents", "inputs": {"video": ["1", 0]}},
        "3": {"class_type": "UNETLoader", "inputs": {"unet_name": opts["unet"], "weight_dtype": "default"}},
        "4": {"class_type": "RelayVSRConditioning", "inputs": {"model": ["3", 0], "images": ["2", 0]}},
        "5": {"class_type": "RandomNoise", "inputs": {"noise_seed": int(opts.get("seed") or 0)}},
        "6": {"class_type": "BasicGuider", "inputs": {"model": ["3", 0], "conditioning": ["4", 0]}},
        "7": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "8": {"class_type": "BasicScheduler", "inputs": {"model": ["3", 0], "scheduler": "simple", "steps": 1, "denoise": 1.0}},
        "9": {"class_type": "SamplerCustomAdvanced", "inputs": {
            "noise": ["5", 0], "guider": ["6", 0], "sampler": ["7", 0], "sigmas": ["8", 0], "latent_image": ["4", 1]}},
        "10": {"class_type": "VAELoader", "inputs": {"vae_name": opts["vae"]}},
        "11": {"class_type": "VSRDecode", "inputs": {"vae": ["10", 0], "samples": ["9", 0], "images": ["2", 0], "detail": detail}},
    }
    cv = {"images": ["11", 0], "fps": ["2", 2]}
    if opts.get("bit_depth"):
        cv["bit_depth"] = ["2", 3]
    g["12"] = {"class_type": "CreateVideo", "inputs": cv}
    g["13"] = {"class_type": "SaveVideo", "inputs": {
        "video": ["12", 0], "filename_prefix": str(opts.get("prefix") or "bitgen_relayvsr/upscaled"),
        "format": "auto", "codec": "auto"}}
    notes = [f"one RelayVSR step (euler, cfg 1, no prompt) on the keyframes, then the Flash decoder restores every frame"
             f" (detail {detail:g})"]
    return g, notes


def fit_vf(got_w, got_h, want_w, want_h, fit=""):
    """ffmpeg -vf that takes RelayVSR's fixed x2 / x4 result to the size asked for -> (vf | None, what it did).
    fit "crop" = the exact frame: scaled (lanczos) until it COVERS want, the overhang trimmed off the middle;
    else the aspect is kept: scaled to want (never above what the model made - it is never blown up past its output)."""
    try:
        gw, gh, ww, wh = int(got_w or 0), int(got_h or 0), int(want_w or 0), int(want_h or 0)
    except (TypeError, ValueError):
        return None, ""
    if min(gw, gh, ww, wh) <= 0 or (gw, gh) == (ww, wh):
        return None, ""
    even = lambda v: max(2, int(round(v / 2.0)) * 2)          # noqa: E731
    if fit == "crop":
        m = max(ww / gw, wh / gh)
        cw, ch = max(ww, even(gw * m)), max(wh, even(gh * m))
        parts = [] if (cw, ch) == (gw, gh) else [f"scale={cw}:{ch}:flags=lanczos"]
        if (cw, ch) != (ww, wh):
            parts.append(f"crop={ww}:{wh}")
        what = (f"{gw}x{gh} -> {cw}x{ch} (lanczos)" if (cw, ch) != (gw, gh) else f"{gw}x{gh}") \
            + (f", trimmed to {ww}x{wh} (the middle kept)" if (cw, ch) != (ww, wh) else "")
        return ",".join(parts), what
    if ww > gw or wh > gh:                                     # more than the model made: keep its output
        return None, f"{ww}x{wh} is more than RelayVSR made ({gw}x{gh}) - kept at {gw}x{gh}"
    return f"scale={ww}:{wh}:flags=lanczos", f"{gw}x{gh} -> {ww}x{wh} (lanczos)"
