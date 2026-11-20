#!/usr/bin/env python3
"""bitGen Studio — PAN 2's ComfyUI graph (2.890.0), built from ComfyUI's OWN nodes (PR #17755, the v0.46.0 release).

Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"

    UNETLoader (pan2_*) -> [LoraLoaderModelOnly ...] -> ModelSamplingSD3 (shift 9) ---------------\
    CLIPLoader (qwen3.5_9b, type "pan2") -> CLIPTextEncode (the caption) / CLIPTextEncode (the negative) -> KSampler
    VAELoader (wan2.2_vae) -> Wan22ImageToVideoLatent (width, height, length = 4n+1, [start_image]) ----/
    KSampler (euler / simple, 50 steps, cfg 2.5) -> VAEDecode -> CreateVideo (24 fps) -> SaveVideo

With no start picture Wan22ImageToVideoLatent hands back an empty latent (text to video); with one, its first latent
frame is the encoded picture and the noise mask keeps it (PAN 2's model reads that mask - comfy/model_base.PAN2.concat_cond).
Pure: pick(), settings() and build() take lists and dicts - scripts/test-pan2890.py checks them without ComfyUI.
"""
import re

FPS = 24
REQUIRED = ["UNETLoader", "CLIPLoader", "VAELoader", "CLIPTextEncode", "Wan22ImageToVideoLatent", "ModelSamplingSD3",
            "KSampler", "VAEDecode", "CreateVideo", "SaveVideo"]
DEFAULTS = {"steps": 50, "cfg": 2.5, "shift": 9.0, "sampler": "euler", "scheduler": "simple"}
MODEL_HINT = "pan2_int8_convrot.safetensors"
TE_HINT = "qwen3.5_9b_int8_convrot.safetensors"
VAE_HINT = "wan2.2_vae.safetensors"


def _base(name):
    return str(name or "").replace("\\", "/").split("/")[-1].lower()


def _pick(names, wanted, pattern, prefer):
    """the style's file when listed (or nothing listed), else the first name matching `pattern` in `prefer` order"""
    names = [str(n) for n in (names or [])]
    if wanted:
        if not names or wanted in names:
            return wanted, ""
        hit = [n for n in names if _base(n) == _base(wanted)]
        if hit:
            return hit[0], ""
    found = [n for n in names if re.search(pattern, _base(n))]
    for p in prefer:
        for n in found:
            if p in _base(n):
                return n, ""
    if found:
        return found[0], ""
    return "", wanted or ""


def pick(unets, clips, vaes, model="", te="", vae=""):
    """-> {model, te, vae, notes, error} from what ComfyUI lists: int8 before bf16 (it fits a 32 GB card)"""
    notes, missing = [], []
    m, want_m = _pick(unets, model, r"(^|[-_])pan[-_]?2([-_.]|$)", ["int8", "fp8", "bf16"])
    t, want_t = _pick(clips, te, r"qwen3[._]?5[-_.]?9b", ["int8", "bf16", "fp8"])
    v, want_v = _pick(vaes, vae, r"wan[-_ ]?2[._]?2[-_]?vae|wan2\.2_vae", ["wan2.2"])
    if not m:
        missing.append(want_m or MODEL_HINT)
    if not t:
        missing.append(want_t or TE_HINT)
    if not v:
        missing.append(want_v or VAE_HINT)
    if missing:
        return {"error": "ComfyUI does not list " + ", ".join(missing)
                + " - Settings ▸ Add-ons ▸ PAN 2 downloads them (then restart ComfyUI so it lists them)",
                "missing": missing, "notes": notes}
    if model and _base(m) != _base(model):
        notes.append(f"the style's model {model} is not listed - using {m}")
    if "bf16" in _base(m):
        notes.append("the bf16 model (67 GB) - on a card under 80 GB ComfyUI moves most of it to RAM, which is slow; the int8 one fits a 32 GB card")
    return {"model": m, "te": t, "vae": v, "notes": notes, "error": ""}


def settings(steps=0, cfg=0, shift=0):
    d = dict(DEFAULTS)
    if steps and int(steps) > 0:
        d["steps"] = int(steps)
    if cfg and float(cfg) > 0:
        d["cfg"] = float(cfg)
    if shift and float(shift) > 0:
        d["shift"] = float(shift)
    return d


def frames_ok(n):
    n = int(n or 241)
    n = max(5, min(481, n))
    return n - ((n - 1) % 4)


def build(o):
    """o = {model, te, vae, prompt, negative, width, height, frames, seed, steps, cfg, shift, image (uploaded name | ""),
    loras [{name, strength}], prefix, sampler?, scheduler?} -> (graph, notes)"""
    if not str(o.get("prompt") or "").strip():
        raise ValueError("PAN 2 needs its caption")
    notes = []
    g, nid = {}, [0]

    def add(ct, inputs):
        nid[0] += 1
        g[str(nid[0])] = {"class_type": ct, "inputs": inputs}
        return str(nid[0])

    w = max(256, min(2048, int(o.get("width") or 1248) // 32 * 32))       # down: 720 -> 704 (never more memory than asked)
    h = max(256, min(2048, int(o.get("height") or 704) // 32 * 32))
    n = frames_ok(o.get("frames"))
    if (w, h) != (int(o.get("width") or w), int(o.get("height") or h)):
        notes.append(f"size {o.get('width')}x{o.get('height')} -> {w}x{h} (PAN 2's latent works in 32-px steps)")
    s = settings(o.get("steps"), o.get("cfg"), o.get("shift"))
    k = add("UNETLoader", {"unet_name": o["model"], "weight_dtype": "default"})
    for lo in o.get("loras") or []:
        name = str((lo or {}).get("name") or "")
        if name:
            k = add("LoraLoaderModelOnly", {"model": [k, 0], "lora_name": name, "strength_model": float(lo.get("strength", 1.0) or 1.0)})
    k = add("ModelSamplingSD3", {"model": [k, 0], "shift": s["shift"]})
    clip = add("CLIPLoader", {"clip_name": o["te"], "type": "pan2", "device": "default"})
    vae = add("VAELoader", {"vae_name": o["vae"]})
    pos = add("CLIPTextEncode", {"text": str(o["prompt"]), "clip": [clip, 0]})
    neg = add("CLIPTextEncode", {"text": str(o.get("negative") or ""), "clip": [clip, 0]})
    lat_in = {"vae": [vae, 0], "width": w, "height": h, "length": n, "batch_size": 1}
    if o.get("image"):
        img = add("LoadImage", {"image": o["image"]})
        lat_in["start_image"] = [img, 0]
    lat = add("Wan22ImageToVideoLatent", lat_in)
    smp = add("KSampler", {"model": [k, 0], "seed": int(o.get("seed") or 0), "steps": s["steps"], "cfg": s["cfg"],
                           "sampler_name": o.get("sampler") or s["sampler"], "scheduler": o.get("scheduler") or s["scheduler"],
                           "positive": [pos, 0], "negative": [neg, 0], "latent_image": [lat, 0], "denoise": 1.0})
    dec = add("VAEDecode", {"samples": [smp, 0], "vae": [vae, 0]})
    vid = add("CreateVideo", {"images": [dec, 0], "fps": float(FPS)})
    add("SaveVideo", {"video": [vid, 0], "filename_prefix": o.get("prefix") or "bitgen_pan2/pan2", "format": "auto", "codec": "auto"})
    notes.append(f"{w}x{h}, {n} frames at {FPS} fps · {s['steps']} steps, cfg {s['cfg']}, shift {s['shift']}, "
                 f"{o.get('sampler') or s['sampler']} / {o.get('scheduler') or s['scheduler']}"
                 + (" · image to video" if o.get("image") else " · text to video"))
    return g, notes


def finish_args(raw, out, audio=None, audio_start=0.0):
    """ffmpeg: PAN 2's 24 fps take -> H.264 (yuv420p); the reference sound laid under it, trimmed to the take"""
    args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw)]
    if audio:
        args += ["-ss", f"{float(audio_start or 0):.3f}", "-i", str(audio)]
    args += ["-vf", "format=yuv420p", "-map", "0:v:0"]
    args += ["-map", "1:a:0", "-shortest"] if audio else ["-map", "0:a:0?"]
    return args + ["-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)]
