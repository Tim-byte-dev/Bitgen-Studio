"""bitGen Studio — SeedVR2 VIDEO upscaling graph (2.400.0).

Tim (verbatim): "add seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors -
https://github.com/Comfy-Org/workflow_templates/blob/main/templates/utility_seedvr2_3b_int8_upscale_video.json"

The API graph of Comfy-Org's "Upscale Video (SeedVR2 3B Int8)" template, flattened out of its subgraph and built
from ComfyUI's CORE nodes (comfy_extras/nodes_seedvr.py, since PR #14424) - no custom pack:

  LoadVideo -> GetVideoComponents -> ResizeImageMaskNode (scale by multiplier, lanczos) -> SeedVR2Preprocess
    -> VAEEncodeTiled (512 / 128, temporal 64 / 8) -> [SeedVR2TemporalChunk] -> SeedVR2Conditioning
    -> KSampler (1 step, cfg 1, euler / simple, denoise) -> [SeedVR2TemporalMerge] -> VAEDecodeTiled
    -> SeedVR2PostProcessing (colour match to the resized original) -> CreateVideo (the source's fps) -> SaveVideo

The template's switches become plain choices here: the temporal split is IN the graph when chunking is "auto" or a
frame count (a long clip is sampled a piece at a time within VRAM, the pieces cross-faded back together), and OUT
when it is "off". The template's trim switch is not needed - the worker cuts the window it was given before upload.
The sound is not routed through the graph: the worker lays the source's own track back under the result (a silent
source has no AUDIO for CreateVideo to take).
"""
import re

COLORS = ("lab", "wavelet", "adain", "none")
TILE = {"tile_size": 512, "overlap": 128, "temporal_size": 64, "temporal_overlap": 8}
DEFAULT_MODEL = "seedvr2_7b_sharp_fp16.safetensors"
DEFAULT_VAE = "seedvr2_ema_vae_fp16.safetensors"
# best first: Tim's sharp 7B fp16, any sharp 7B, the 7B, the 3B, anything SeedVR2
PREFER = (r"seedvr2_7b_sharp.*fp16", r"seedvr2_7b_sharp", r"seedvr2_7b", r"seedvr2_3b", r"seedvr2")
REQUIRED = ("LoadVideo", "GetVideoComponents", "ResizeImageMaskNode", "SeedVR2Preprocess", "VAEEncodeTiled",
            "SeedVR2Conditioning", "KSampler", "VAEDecodeTiled", "SeedVR2PostProcessing", "CreateVideo", "SaveVideo",
            "UNETLoader", "VAELoader")
CHUNK_NODES = ("SeedVR2TemporalChunk", "SeedVR2TemporalMerge")


def pick_model(names, wanted=""):
    """(file, note) - the asked-for file when ComfyUI lists it, else the best SeedVR2 file listed; ("", why) when
    there is none."""
    names = [str(n) for n in (names or [])]
    low = {n.lower().replace("\\", "/"): n for n in names}
    w = str(wanted or "").strip()
    if w:
        for k, n in low.items():
            if k == w.lower() or k.endswith("/" + w.lower()):
                return n, f"model {n} (as asked)"
    for rx in PREFER:
        hits = [n for k, n in low.items() if re.search(rx, k.rsplit("/", 1)[-1])]
        if hits:
            got = sorted(hits, key=lambda n: (len(n), n))[0]
            note = f"model {got}"
            if w:
                note += f" ({w} is not in ComfyUI's diffusion_models - the best SeedVR2 file listed instead)"
            elif not re.search(PREFER[0], got.lower()):
                note += f" ({DEFAULT_MODEL} is not installed - Setup -> Models has it, 16.5 GB)"
            return got, note
    return "", (f"no SeedVR2 model in ComfyUI's models/diffusion_models - put {DEFAULT_MODEL} there "
                "(Setup -> Models -> Upscaling, or huggingface.co/Comfy-Org/SeedVR2)")


def pick_vae(names, wanted=""):
    names = [str(n) for n in (names or [])]
    w = str(wanted or DEFAULT_VAE).lower()
    for n in names:
        if n.lower().replace("\\", "/").rsplit("/", 1)[-1] == w:
            return n
    hits = [n for n in names if "seedvr" in n.lower()]
    return hits[0] if hits else ""


def multiplier(src_w, src_h, out_w, out_h):
    """The Resize node's factor that reaches out_w x out_h from the source (the larger of the two ratios)."""
    return round(max(out_w / max(1, src_w), out_h / max(1, src_h)), 4)


def chunk_spec(chunk):
    """"auto" / "off" / a 4n+1 frame count -> (in_graph, inputs for SeedVR2TemporalChunk)."""
    c = str(chunk if chunk is not None else "auto").strip().lower()
    if c in ("off", "none", "0", "false"):
        return False, {}
    if c == "auto" or not c:
        return True, {"chunking_mode": "auto"}
    try:
        n = int(float(c))
    except ValueError:
        return True, {"chunking_mode": "auto"}
    n = max(1, n)
    n = n - ((n - 1) % 4)                       # 4n+1: 1, 5, 9, 13, ...
    return True, {"chunking_mode": "manual", "chunking_mode.frames_per_chunk": n}


def build(opts):
    """opts: video (the uploaded name), mult, model, vae, seed, denoise, color, chunk, overlap, prefix,
    bit_depth (bool - wire GetVideoComponents' bit_depth into CreateVideo when this ComfyUI has it).
    Returns (graph, notes)."""
    notes = []
    color = str(opts.get("color") or "lab").lower()
    if color not in COLORS:
        notes.append(f"colour correction {color!r} is not one of {', '.join(COLORS)} - lab")
        color = "lab"
    mult = float(opts.get("mult") or 2)
    if not mult > 0:
        raise ValueError("the upscale factor must be above 0")
    denoise = float(opts.get("denoise") if opts.get("denoise") is not None else 1.0)
    denoise = max(0.0, min(1.0, denoise))
    if not opts.get("model"):
        raise ValueError("no SeedVR2 model")
    if not opts.get("vae"):
        raise ValueError(f"no SeedVR2 VAE - put {DEFAULT_VAE} in ComfyUI's models/vae")
    g = {
        "1": {"class_type": "LoadVideo", "inputs": {"file": opts["video"]}},
        "2": {"class_type": "GetVideoComponents", "inputs": {"video": ["1", 0]}},
        "3": {"class_type": "ResizeImageMaskNode", "inputs": {
            "input": ["2", 0], "resize_type": "scale by multiplier", "resize_type.multiplier": mult,
            "scale_method": "lanczos"}},
        "4": {"class_type": "SeedVR2Preprocess", "inputs": {"resized_images": ["3", 0]}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": opts["vae"]}},
        "6": {"class_type": "UNETLoader", "inputs": {"unet_name": opts["model"], "weight_dtype": "default"}},
        "7": {"class_type": "VAEEncodeTiled", "inputs": dict(TILE, pixels=["4", 0], vae=["5", 0])},
    }
    latent = ["7", 0]
    chunked, cin = chunk_spec(opts.get("chunk"))
    overlap = max(0, min(16, int(opts.get("overlap") or 0)))
    if chunked:
        g["8"] = {"class_type": "SeedVR2TemporalChunk", "inputs": dict(cin, latent=["7", 0], temporal_overlap=overlap)}
        latent = ["8", 0]
        notes.append("temporal split: " + (f"{cin['chunking_mode.frames_per_chunk']} frames a piece"
                                            if cin.get("chunking_mode") == "manual" else "auto (what fits the free VRAM)")
                     + (f", {overlap} latent frame(s) cross-faded" if overlap else ""))
    else:
        notes.append("temporal split off - the whole clip is sampled at once (a long clip may run out of VRAM)")
    g["9"] = {"class_type": "SeedVR2Conditioning", "inputs": {"model": ["6", 0], "vae_conditioning": latent}}
    g["10"] = {"class_type": "KSampler", "inputs": {
        "model": ["6", 0], "positive": ["9", 0], "negative": ["9", 1], "latent_image": latent,
        "seed": int(opts.get("seed") or 0), "steps": 1, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
        "denoise": denoise}}
    samples = ["10", 0]
    if chunked:
        g["11"] = {"class_type": "SeedVR2TemporalMerge", "inputs": {"latents": ["10", 0], "temporal_overlap": ["8", 1]}}
        samples = ["11", 0]
    g["12"] = {"class_type": "VAEDecodeTiled", "inputs": dict(TILE, samples=samples, vae=["5", 0])}
    g["13"] = {"class_type": "SeedVR2PostProcessing", "inputs": {
        "images": ["12", 0], "original_resized_images": ["3", 0], "color_correction_method": color}}
    cv = {"images": ["13", 0], "fps": ["2", 2]}
    if opts.get("bit_depth"):
        cv["bit_depth"] = ["2", 3]
    g["14"] = {"class_type": "CreateVideo", "inputs": cv}
    g["15"] = {"class_type": "SaveVideo", "inputs": {
        "video": ["14", 0], "filename_prefix": str(opts.get("prefix") or "bitgen_seedvr2/upscaled"),
        "format": "auto", "codec": "auto"}}
    notes.append(f"x{mult:g} (lanczos resize, then one SeedVR2 step at denoise {denoise:g}), colour match {color}")
    return g, notes


def mux_args(upscaled, source, dest, start=0.0, dur=None, out_dur=None):
    """ffmpeg: the upscaled picture with the SOURCE's sound (the same window), H.264 for every player; a silent source
    stays silent (the ? on the map). out_dur = the upscaled clip's length - the sound never makes it longer."""
    a = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(upscaled)]
    if start:
        a += ["-ss", f"{float(start):.3f}"]
    if dur:
        a += ["-t", f"{float(dur):.3f}"]
    a += ["-i", str(source), "-map", "0:v:0", "-map", "1:a:0?", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
          "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k"]
    if out_dur:
        a += ["-t", f"{float(out_dur):.3f}"]
    return a + ["-movflags", "+faststart", str(dest)]
