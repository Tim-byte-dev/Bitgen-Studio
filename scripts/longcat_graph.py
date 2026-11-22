#!/usr/bin/env python3
"""bitGen Studio — LongCat-Video-Avatar 1.6's ComfyUI graph (2.918.0).

Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"

LongCat-Video-Avatar 1.6 (Meituan LongCat, MIT weights) makes a person talk / sing to a sound: a start picture (or none -
the prompt alone), a prompt and the speech in, a 25 fps video as long as the speech out. ComfyUI's own support is still a
pull request (Comfy-Org/ComfyUI #17831, not merged in Nov 2026), so it runs in PedroMarinhoDev's ComfyUI-LongCat-Avatar
("LongCat Avatar Native", GPL-3.0 code - ComfyUI's own samplers, LoRA patches and dynamic VRAM; lib/nodePacks.json id
"longcat"):

    LongCatAvatarModelLoader (the DiT: int8 ConvRot / W6A8 / W4A8 / bf16) ----------------------------------\
    CLIPLoader (umt5_xxl, type "wan") -> CLIPTextEncode (the prompt) ----------------------------------------+
    VAELoader (wan_2.1_vae) ---------------------------------------------------------------------------------+-> LongCatAvatarVideo
    AudioEncoderLoader (whisper_large_v3) -> LongCatAvatarAudioEncode <- LoadAudio (the speech) -------------+   (distilled, 8 steps:
    LoadImage (the person, optional) ------------------------------------------------------------------------/    DMD LoRA then OPSD)
    LongCatAvatarVideo -> SaveVideo   (93-frame segments, each continuing from the last 13; the speech muxed in)

Pure: pick(), size_for(), segments_for() and build() take lists and dicts - scripts/test-longcat918.py checks them without
ComfyUI.
"""
import math
import re

FPS = 25
SEG = 93                       # frames a segment
OVERLAP = 13                   # frames each continued segment starts from
REQUIRED = ["LongCatAvatarModelLoader", "LongCatAvatarAudioEncode", "LongCatAvatarVideo", "CLIPLoader", "CLIPTextEncode",
            "VAELoader", "AudioEncoderLoader", "LoadAudio", "LoadImage", "SaveVideo"]
DEFAULTS = {"mix_steps": 4, "mix_alpha": 1.0, "ref_img_index": 10, "sampler": "euler"}
HINT = {"model": "longcat-video-avatar/longcat_video_avatar_1.6_int8_convrot.safetensors",
        "dmd": "longcat-video-avatar/longcat_video_avatar_1.6_dmd_lora_bf16.safetensors",
        "opsd": "longcat-video-avatar/longcat_video_avatar_1.6_opsd_lora_bf16.safetensors",
        "whisper": "whisper_large_v3_encoder_fp16.safetensors",
        "te": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "vae": "wan_2.1_vae.safetensors"}
# the release's buckets (the picture's aspect picks the closest): 480p, and 720p for a bigger Basic Settings size
BUCKETS = {"480p": [(832, 480), (768, 512), (704, 544), (640, 640), (544, 704), (512, 768), (480, 832)],
           "720p": [(1280, 720), (1152, 768), (1024, 832), (960, 960), (832, 1024), (768, 1152), (720, 1280)]}


def _base(name):
    return str(name or "").replace("\\", "/").split("/")[-1].lower()


def _pick(names, wanted, pattern, prefer):
    """the style's file when listed (or nothing listed), else the first name matching `pattern`, in `prefer` order"""
    names = [str(n) for n in (names or [])]
    if wanted:
        if not names or wanted in names:
            return wanted
        hit = [n for n in names if _base(n) == _base(wanted)]
        if hit:
            return hit[0]
    found = [n for n in names if re.search(pattern, _base(n)) or re.search(pattern, str(n).lower().replace("\\", "/"))]
    for p in prefer:
        for n in found:
            if p in _base(n):
                return n
    return found[0] if found else ""


def pick(unets, loras, encoders, clips, vaes, want=None):
    """-> {model, dmd, opsd, whisper, te, vae, notes, error} from what ComfyUI lists. The DiT: int8 ConvRot first (a 24 GB
    card), then W6A8, W4A8 (smaller cards), bf16 last (30 GB from RAM); the LoRAs by DMD / OPSD in their names"""
    w = want or {}
    lc = r"longcat"
    out = {
        "model": _pick(unets, w.get("model"), lc + r".*avatar.*1[._]6|" + lc + r".*avatar", ["int8", "w6a8", "w4a8", "bf16", "fp8"]),
        "dmd": _pick(loras, w.get("dmd"), lc + r".*dmd|dmd.*" + lc, ["1.6", "1_6"]),
        "opsd": _pick(loras, w.get("opsd"), lc + r".*opsd|opsd.*" + lc, ["1.6", "1_6"]),
        "whisper": _pick(encoders, w.get("whisper"), r"whisper.*large.*v3|whisper[-_]?large", ["fp16", "bf16", ""]),
        "te": _pick(clips, w.get("te"), r"umt5", ["bf16", "fp16", "fp8", "int8"]),
        "vae": _pick(vaes, w.get("vae"), r"wan[-_ ]?2[._]?1[-_]?vae|^wan_2\.1_vae", ["wan_2.1", "wan2.1"]),
    }
    missing = [HINT[k] for k in ("model", "dmd", "opsd", "whisper", "te", "vae") if not out[k]]
    notes = []
    if out["model"] and "bf16" in _base(out["model"]):
        notes.append("the bf16 DiT streams from system RAM (about 30 GB) - the int8 file is quicker on a 24-32 GB card")
    out["notes"] = notes
    out["error"] = ("ComfyUI does not list these LongCat Avatar files: " + ", ".join(missing)
                    + " - Settings ▸ Add-ons ▸ LongCat Avatar 1.6 downloads them (restart ComfyUI afterwards)") if missing else ""
    return out


def size_for(width, height, pic=None):
    """the release's bucket nearest the shape: the start picture's (when there is one), else Basic Settings' width x height;
    720p when Basic Settings asks for 720 px or more on the short side, else 480p -> (w, h, res)"""
    try:
        bw, bh = int(width or 0), int(height or 0)
    except (TypeError, ValueError):
        bw, bh = 0, 0
    res = "720p" if min(bw or 480, bh or 480) >= 700 else "480p"
    sw, sh = (pic or (0, 0))
    if not (sw and sh):
        sw, sh = (bw or 832), (bh or 480)
    ar = sw / float(sh)
    w, h = min(BUCKETS[res], key=lambda b: abs(math.log((b[0] / float(b[1])) / ar)))
    return w, h, res


def segments_for(seconds):
    """how many 93-frame segments (each continuing from 13) cover `seconds` of speech at 25 fps"""
    n = max(1, int(math.ceil(float(seconds or 0) * FPS)))
    return 1 + max(0, int(math.ceil((n - SEG) / float(SEG - OVERLAP))))


def build(o):
    """-> (graph, notes). o = {model, dmd, opsd, whisper, te, vae, prompt, audio (uploaded name), image (uploaded name | ""),
    width, height, seed, max_segments, mix_steps, mix_alpha, ref_img_index, sampler, prefix}"""
    notes = []
    prompt = str(o.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("write the prompt first - who is talking, how they look and move, where they are")
    if not o.get("audio"):
        raise ValueError("LongCat Avatar needs the speech: put a sound in the References docker (clean speech or a song's vocals)")
    w, h = int(o.get("width") or 832), int(o.get("height") or 480)
    if w % 16 or h % 16:
        raise ValueError(f"{w}x{h} is not in 16-px steps")
    seed = int(o.get("seed") or 0) % (2 ** 63)
    mix_steps = max(0, min(8, int(o.get("mix_steps", DEFAULTS["mix_steps"]))))
    mix_alpha = max(0.0, min(1.0, float(o.get("mix_alpha", DEFAULTS["mix_alpha"]))))
    ref_idx = max(-1000, min(1000, int(o.get("ref_img_index", DEFAULTS["ref_img_index"]))))
    g = {
        "1": {"class_type": "LongCatAvatarModelLoader", "inputs": {"unet_name": o["model"]}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": o["te"], "type": "wan", "device": "default"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": o["vae"]}},
        "5": {"class_type": "LoadAudio", "inputs": {"audio": o["audio"]}},
        "6": {"class_type": "AudioEncoderLoader", "inputs": {"audio_encoder_name": o["whisper"]}},
        "7": {"class_type": "LongCatAvatarAudioEncode", "inputs": {"audio_encoder": ["6", 0], "audio": ["5", 0]}},
        "8": {"class_type": "LongCatAvatarVideo", "inputs": {
            "model": ["1", 0], "positive": ["3", 0], "vae": ["4", 0], "audio_features": ["7", 0], "audio": ["5", 0],
            "dmd_lora": o["dmd"], "opsd_lora": o["opsd"], "seed": seed, "width": w, "height": h,
            "max_segments": max(0, int(o.get("max_segments") or 0)), "sampler_name": str(o.get("sampler") or DEFAULTS["sampler"]),
            "mix_steps": mix_steps, "mix_alpha": mix_alpha, "ref_img_index": ref_idx, "encoder": "auto"}},
        "9": {"class_type": "SaveVideo", "inputs": {"video": ["8", 0], "filename_prefix": str(o.get("prefix") or "bitgen_longcat/take"),
                                                     "format": "auto", "codec": "auto"}},
    }
    if o.get("image"):
        g["10"] = {"class_type": "LoadImage", "inputs": {"image": o["image"]}}
        g["8"]["inputs"]["start_image"] = ["10", 0]
    else:
        notes.append("no start picture - the person is made from the prompt and the speech alone")
    return g, notes
