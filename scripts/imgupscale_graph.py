"""bitGen Studio — PICTURE upscaling graphs (2.733.0) for misc/imgupscale_worker.py.

Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image"

Three ways, the same three the scene tail PNGs already use (scripts/tailpngs.py - reused here, not copied):
  seedvr2  Tim's own SeedVR2 7B image workflow (comfy_workflows/utility_seedvr2_7b_int8_upscale_image_api.json:
           LoadImage -> Resize x N -> SeedVR2Preprocess -> VAEEncodeTiled -> SeedVR2Conditioning -> KSampler 1 step ->
           VAEDecodeTiled -> SeedVR2PostProcessing -> SaveImage), with the SeedVR2 model / VAE ComfyUI really lists, the
           colour match and denoise picked;
  model    ComfyUI's image-upscale workflow (comfy_workflows/image_upscale_model.json: UpscaleModelLoader ->
           ImageUpscaleWithModel -> ImageScale to the size) with a file from models/upscale_models (4x-UltraSharp,
           ESRGAN ...);
  lanczos  no ComfyUI: ffmpeg's lanczos straight to the size (fast, no new detail).
"""
import tailpngs as TP

METHODS = ("seedvr2", "model", "lanczos")
COLORS = ("lab", "wavelet", "adain", "none")
REQUIRED = {
    "seedvr2": ("LoadImage", "ResizeImageMaskNode", "SeedVR2Preprocess", "VAEEncodeTiled", "SeedVR2Conditioning",
                "KSampler", "VAEDecodeTiled", "SeedVR2PostProcessing", "SaveImage", "UNETLoader", "VAELoader"),
    "model": ("LoadImage", "UpscaleModelLoader", "ImageUpscaleWithModel", "ImageScale", "SaveImage"),
}


def seedvr2(image, src_w, src_h, width, height, prefix, unet, vae, seed=42, color="lab", denoise=1.0):
    """Tim's SeedVR2 image workflow for this picture: the multiplier that reaches width x height, the model + VAE
    ComfyUI lists, the colour match, the denoise, one seed."""
    g = TP.graph_seedvr2(image, src_w, src_h, width, height, prefix, seed=seed)
    color = color if color in COLORS else "lab"
    d = max(0.05, min(1.0, float(denoise if denoise is not None else 1.0)))
    for v in g.values():
        ct, ins = v.get("class_type"), v.setdefault("inputs", {})
        if ct == "UNETLoader":
            ins["unet_name"] = unet
        elif ct == "VAELoader":
            ins["vae_name"] = vae
        elif ct == "SeedVR2PostProcessing":
            ins["color_correction_method"] = color
        elif ct == "KSampler":
            ins["denoise"] = d
    return g


def model(image, model_file, width, height, prefix):
    """ComfyUI's image-upscale workflow with this upscale model, landing on width x height."""
    return TP.graph(image, model_file, width, height, prefix)


def pick_upscale_model(listed, wanted=""):
    """(file, note): the asked-for file when ComfyUI lists it, else the first listed; ("", why) when there is none."""
    names = [str(n) for n in (listed or [])]
    w = str(wanted or "").strip().replace("\\", "/").lower()
    if w:
        for n in names:
            k = n.replace("\\", "/").lower()
            if k == w or k.endswith("/" + w) or k.rsplit("/", 1)[-1] == w.rsplit("/", 1)[-1]:
                return n, f"upscale model {n}"
    if names:
        return names[0], f"upscale model {names[0]}" + (f" ({wanted} is not in models/upscale_models)" if wanted else "")
    return "", ("no upscale model in ComfyUI's models/upscale_models - put one there (4x-UltraSharp.pth, "
                "RealESRGAN_x4plus.pth ...), or pick SeedVR2 or Lanczos")


def lanczos_cmd(src, dest, width, height):
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", f"scale={int(width)}:{int(height)}:flags=lanczos",
            "-frames:v", "1", str(dest)]


def exact_cmd(src, dest, width, height):
    """a result a few pixels off (SeedVR2 pads to 16) -> exactly the size asked for"""
    return lanczos_cmd(src, dest, width, height)
