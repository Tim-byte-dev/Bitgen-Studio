#!/usr/bin/env python3
"""Stub ComfyUI server for e2e: /system_stats, /object_info, /upload/image,
/prompt (renders testsrc webm+sine via ffmpeg), /history/{id}, /view, and
/free (2.98.0: the clear-before-generation; the stub's fake card reports
3 GB free until /free, then 30 GB, so the worker's VRAM line shows a real
before -> after and the e2e can assert the clear landed BEFORE the queue)."""
import base64, hashlib, json, os, re, subprocess, sys, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/stub-comfy-out")
OUT.mkdir(parents=True, exist_ok=True)
JOBS = {}
# A fake 32 GB card. FREE_CALLS counts POST /free; FREED flips the free figure so
# a worker that polls /system_stats after /free sees the unload "land".
GB = 2**30
# 2.280.0, faithful-mock rule (Tim's field report: "Required input is
# missing sampler_name / scheduler / clip_name / vae_name / unet_name"):
# the core loader/sampler classes answer /object_info with REAL schemas —
# deliberately spanning all three spec generations ComfyUI has shipped
# (classic list-combo, ["COMBO", {options}], and OBJECT-form specs), so
# the converter's widget mapping and the worker's schema sync are
# exercised against every shape on every gate.
# File combos are FOLDER SCANS on a real server — the app's live list
# REPLACES its own disk scan with them by design (2.72.0), so static
# choice lists here masked the e2e's fake model folders and broke the
# listing + install-invalidation legs. The stub therefore scans the same
# root the e2e configures (STUB_MODELS_ROOT, default /tmp/e2e_comfy/
# ComfyUI/models) AT REQUEST TIME: installs appear, exactly as on a real
# box. Static names stay as the floor so schema sync always has a choice.
MODELS_ROOT = Path(os.environ.get("STUB_MODELS_ROOT",
                                  "/tmp/e2e_comfy/ComfyUI/models"))

def _yaml_dirs(sub):
    """2.402.0, faithful-mock rule: ComfyUI also lists the folders extra_model_paths.yaml (next to its models folder)
    adds for a category - "group: base_path + <category>: path" (one path, or a | block of several). The stub's
    lists used to stop at models/, which only mattered once a real schema (LoraLoader) answered for a category the
    app otherwise scans itself."""
    y = MODELS_ROOT.parent / "extra_model_paths.yaml"
    out = []
    try:
        lines = y.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    base, key, block = None, None, False
    for raw in lines + ["end:"]:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        ind = len(raw) - len(raw.lstrip())
        txt = raw.strip()
        if ind == 0:                                           # a new group
            base, key, block = None, None, False
            continue
        if block and key and ":" not in txt:
            if key in sub:
                out.append(Path(base or "") / txt if base else Path(txt))
            continue
        k, _, v = txt.partition(":")
        k, v = k.strip(), v.strip()
        block = v in ("|", ">")
        key = k
        if k == "base_path":
            base = v
        elif v and not block and k in sub:
            out.append(Path(base) / v if base else Path(v))
    return out


def _folder_combo(sub, floor):
    """The category's files RECURSIVELY, subfolder-relative with forward
    slashes — exactly how ComfyUI's own dropdown spells a nested model
    (flux_klein_9B/aisha.safetensors), so an install into a subfolder
    appears in the live list the way the app's saved value names it."""
    names = list(floor)
    for d in ([MODELS_ROOT / s for s in sub] + _yaml_dirs(sub)):
        try:
            for f in sorted(d.rglob("*")):
                if f.is_file() and f.suffix.lower() in (
                        ".safetensors", ".sft", ".pt", ".pth", ".ckpt",
                        ".gguf", ".bin"):
                    rel = f.relative_to(d).as_posix()
                    if rel not in names:
                        names.append(rel)
        except Exception:
            pass
    return names

def core_schemas():
    return {
        "CLIPLoader": {"input": {"required": {
            "clip_name": {"type": "COMBO",
                          "options": _folder_combo(["text_encoders", "clip"],
                                                   ["clip_l.safetensors"])},
            "type": {"type": "COMBO",
                     "options": ["stable_diffusion", "minimax", "wan", "ltxv"]}}}},
        "VAELoader": {"input": {"required": {
            "vae_name": [_folder_combo(["vae"], ["Wan2.1_VAE.safetensors"])]}}},
        # 2.334.0: the swap looks for the H3 Character Swap LoRA here - a
        # folder scan of models/loras like a real server (OBJECT-form spec)
        "LoraLoaderModelOnly": {"input": {"required": {
            "model": ["MODEL"],
            "lora_name": {"type": "COMBO", "options": _folder_combo(["loras"], [])},
            "strength_model": ["FLOAT", {"default": 1.0}]}}},
        "UNETLoader": {"input": {"required": {
            "unet_name": ["COMBO", {"options": _folder_combo(
                ["unet", "diffusion_models"], ["stub-unet.safetensors"])}],
            "weight_dtype": [["default", "fp8_e4m3fn"]]}}},
        # 2.344.0: the Viggle pack's text conditioning (models/text_cond)
        "ViggleTextCondLoader": {"input": {"required": {
            "text_cond": [_folder_combo(["text_cond"], [])]}}},
        "KSamplerSelect": {"input": {"required": {
            "sampler_name": ["COMBO", {"options": ["res_multistep", "euler"]}]}}},
        "BasicScheduler": {"input": {"required": {
            # 2.336.0: ComfyUI's real list (the swap's quality picks beta)
            "scheduler": {"type": "COMBO", "options": ["simple", "sgm_uniform", "karras", "exponential",
                                                        "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal"]},
            "steps": ["INT", {"default": 20, "min": 1}],
            "denoise": {"type": "FLOAT", "default": 1.0}}}},
        # 2.368.0: ComfyUI's core Wan nodes (comfy_extras/nodes_wan.py) with their REAL required inputs, so a
        # Wan graph that forgets one is refused here exactly as on Tim's box
        **WAN_SCHEMAS,
        # 2.402.0: KSampler as a REAL ComfyUI answers it (fixture) - with "*" types no widget was ever a widget, so a UI
        # workflow's sampler (LTX 2.3's IC-LoRA template) converted without steps / cfg / sampler / scheduler
        **({"KSampler": LTX25_REAL["KSampler"]} if "KSampler" in LTX25_REAL else {}),
        # 2.400.0: ComfyUI's core SeedVR2 nodes (comfy_extras/nodes_seedvr.py) + the video I/O around them
        **SEEDVR2_SCHEMAS,
        # 2.504.0: RunningHub's DLSS 5 pack (nodes.py INPUT_TYPES - all optional, as the pack declares them)
        **DLSS5_SCHEMAS,
        # 2.319.0, faithful-mock rule (Tim's run: LineArtPreprocessor ->
        # KeyError: 'coarse'): comfyui_controlnet_aux declares its switches
        # as OPTIONAL and reads them as always-sent - the stub fails the same
        # way at execution (AUX_ERR) when one is missing
        **AUX_SCHEMAS,
        # 2.404.0: CLIPVisionLoader lists its folder (Wan's clip_vision_h always) - TRELLIS.2's DINOv3 shows up when there
        "CLIPVisionLoader": {"input": {"required": {"clip_name": [_folder_combo(["clip_vision"], ["clip_vision_h.safetensors"])]}}},
    }


_WAN_COMMON = {"positive": ["CONDITIONING"], "negative": ["CONDITIONING"], "vae": ["VAE"],
               "width": ["INT", {"default": 832}], "height": ["INT", {"default": 480}],
               "length": ["INT", {"default": 81}], "batch_size": ["INT", {"default": 1}]}
WAN_SCHEMAS = {
    "WanImageToVideo": {"input": {"required": dict(_WAN_COMMON),
                                  "optional": {"clip_vision_output": ["CLIP_VISION_OUTPUT"], "start_image": ["IMAGE"]}}},
    "WanFirstLastFrameToVideo": {"input": {"required": dict(_WAN_COMMON), "optional": {
        "clip_vision_start_image": ["CLIP_VISION_OUTPUT"], "clip_vision_end_image": ["CLIP_VISION_OUTPUT"],
        "start_image": ["IMAGE"], "end_image": ["IMAGE"]}}},
    "WanVaceToVideo": {"input": {"required": dict(_WAN_COMMON, strength=["FLOAT", {"default": 1.0}]), "optional": {
        "control_video": ["IMAGE"], "control_masks": ["MASK"], "reference_image": ["IMAGE"]}}},
    # 2.399.0: the camera path - ComfyUI's Fun Camera nodes (comfy_extras/nodes_camera_trajectory.py + nodes_wan.py)
    # and the core video loader the exact-path guide comes in through
    "WanCameraEmbedding": {"input": {"required": {
        "camera_pose": [["Static", "Pan Up", "Pan Down", "Pan Left", "Pan Right", "Zoom In", "Zoom Out",
                         "Anti Clockwise (ACW)", "ClockWise (CW)"], {"default": "Static"}],
        "width": ["INT", {"default": 832}], "height": ["INT", {"default": 480}], "length": ["INT", {"default": 81}]},
        "optional": {"speed": ["FLOAT", {"default": 1.0}], "fx": ["FLOAT", {"default": 0.5}], "fy": ["FLOAT", {"default": 0.5}],
                     "cx": ["FLOAT", {"default": 0.5}], "cy": ["FLOAT", {"default": 0.5}]}},
        "output": ["WAN_CAMERA_EMBEDDING", "INT", "INT", "INT"]},
    "WanCameraImageToVideo": {"input": {"required": dict(_WAN_COMMON), "optional": {
        "clip_vision_output": ["CLIP_VISION_OUTPUT"], "start_image": ["IMAGE"], "camera_conditions": ["WAN_CAMERA_EMBEDDING"]}}},
    "LoadVideo": {"input": {"required": {"file": ["COMBO", {"options": []}]}}, "output": ["VIDEO"]},
    "GetVideoComponents": {"input": {"required": {"video": ["VIDEO"]}}, "output": ["IMAGE", "AUDIO", "FLOAT"]},
    "TrimVideoLatent": {"input": {"required": {"samples": ["LATENT"], "trim_amount": ["INT", {"default": 0}]}}},
    "EmptyHunyuanLatentVideo": {"input": {"required": {"width": ["INT", {"default": 848}], "height": ["INT", {"default": 480}],
                                                       "length": ["INT", {"default": 25}], "batch_size": ["INT", {"default": 1}]}}},
    "ModelSamplingSD3": {"input": {"required": {"model": ["MODEL"], "shift": ["FLOAT", {"default": 3.0}]}}},
    "CLIPVisionLoader": {"input": {"required": {"clip_name": [["clip_vision_h.safetensors"]]}}},
    "CLIPVisionEncode": {"input": {"required": {"clip_vision": ["CLIP_VISION"], "image": ["IMAGE"],
                                                "crop": [["center", "none"]]}}},
    "KSampler": {"input": {"required": {k: ["*"] for k in ("model", "seed", "steps", "cfg", "sampler_name", "scheduler",
                                                           "positive", "negative", "latent_image", "denoise")}}},
    "KSamplerAdvanced": {"input": {"required": {k: ["*"] for k in (
        "model", "add_noise", "noise_seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative",
        "latent_image", "start_at_step", "end_at_step", "return_with_leftover_noise")}}},
}

# 2.400.0: ComfyUI's core SeedVR2 nodes (comfy_extras/nodes_seedvr.py) with their real required inputs. ONLY the
# SeedVR2 classes: the video I/O around them (Resize / tiled VAE / CreateVideo / SaveVideo) is in Tim's exports too, and
# declaring those here would change what the other workers fill and what this stub refuses for every other graph.
SEEDVR2_SCHEMAS = {
    "SeedVR2Preprocess": {"input": {"required": {"resized_images": ["IMAGE"]}}, "output": ["IMAGE"]},
    "SeedVR2PostProcessing": {"input": {"required": {
        "images": ["IMAGE"], "original_resized_images": ["IMAGE"],
        "color_correction_method": [["lab", "wavelet", "adain", "none"], {"default": "lab"}]}}, "output": ["IMAGE"]},
    "SeedVR2Conditioning": {"input": {"required": {"model": ["MODEL"], "vae_conditioning": ["LATENT"]}},
                            "output": ["CONDITIONING", "CONDITIONING"]},
    "SeedVR2TemporalChunk": {"input": {"required": {
        "latent": ["LATENT"], "temporal_overlap": ["INT", {"default": 0}],
        "chunking_mode": ["COMFY_DYNAMICCOMBO_V3", {"options": [{"key": "auto"}, {"key": "manual"}]}]}},
        "output": ["LATENT", "INT"]},
    "SeedVR2TemporalMerge": {"input": {"required": {"latents": ["LATENT"], "temporal_overlap": ["INT", {"forceInput": True}]}},
                             "output": ["LATENT"]},
}

# 2.504.0: ComfyUI-RH-DLSS5's two nodes as its nodes.py declares them (every input OPTIONAL; the option lists verbatim)
_DL_MODES = ["1x (DLAA / native)", "1.5x (Quality)", "1.724x (Balanced)", "2x (Performance)", "3x (Ultra Performance)",
             "1K", "2K", "4K", "8K"]
DLSS5_SCHEMAS = {
    "RH_DLSS5Enhance": {"input": {"required": {}, "optional": {
        "image": ["IMAGE"], "video": ["VIDEO"], "upscaling_mode": [_DL_MODES, {"default": _DL_MODES[0]}],
        "style": [["default", "natural", "cinematic", "off (bypass NR)"], {"default": "default"}],
        "preset": ["INT", {"default": 0}], "intensity": ["FLOAT", {"default": 1.0}], "tone": ["FLOAT", {"default": 1.0}],
        "structure": ["FLOAT", {"default": 1.5}], "skin": ["FLOAT", {"default": -1.0}], "auto_mask": [["on", "off"], {"default": "on"}],
        "motion": [["auto", "nvof", "optical_flow", "none"], {"default": "auto"}], "scene_change_threshold": ["FLOAT", {"default": 0.24}],
        "batch_mode": [["temporal sequence", "still images"], {"default": "temporal sequence"}], "warmup_frames": ["INT", {"default": 0}],
        "keep_audio": [["on", "off"], {"default": "on"}], "backend": [["auto", "linux-wine", "windows-bridge"], {"default": "auto"}],
        "channel_order": [["auto", "RGBA", "BGRA"], {"default": "auto"}], "hdr": [["off", "on"], {"default": "off"}],
        "global_tone": ["FLOAT", {"default": -1.0}], "detail": ["FLOAT", {"default": 1.0}], "color": ["FLOAT", {"default": 1.0}],
        "runtime_dir": ["STRING", {"default": ""}], "wine_prefix": ["STRING", {"default": ""}]}},
        "output": ["IMAGE", "VIDEO", "STRING"]},
    "RH_DLSS5FrameInterpolation": {"input": {"required": {}, "optional": {
        "output_fps": [["1x", "2x", "3x", "4x", "23.976", "24", "25", "29.97", "30", "48", "50", "59.94", "60", "72", "90", "96",
                        "120", "144"], {"default": "2x"}],
        "video": ["VIDEO"], "image": ["IMAGE"], "motion": [["auto", "nvof", "dis"], {"default": "auto"}],
        "scene_change_threshold": ["FLOAT", {"default": 0.24}], "keep_audio": [["on", "off"], {"default": "on"}],
        "audio": ["AUDIO"], "runtime_dir": ["STRING", {"default": ""}], "wine_prefix": ["STRING", {"default": ""}]}},
        "output": ["IMAGE", "VIDEO", "STRING"]},
}

ABSENT = {"SolAttnPatch", "MiniMaxChunkFeedForward"}   # 2.344.0: classes this stub ComfyUI lacks


def _aux_opt(options, default):
    return [list(options), {"default": default}]


AUX_SCHEMAS = {
    "LineArtPreprocessor": {"input": {"required": {"image": ["IMAGE"]}, "optional": {
        "coarse": _aux_opt(["disable", "enable"], "disable"),
        "resolution": ["INT", {"default": 512, "min": 64, "max": 16384}]}}},
    "Scribble_PiDiNet_Preprocessor": {"input": {"required": {"image": ["IMAGE"]}, "optional": {
        "safe": _aux_opt(["enable", "disable"], "enable"),
        "resolution": ["INT", {"default": 512}]}}},
    "DWPreprocessor": {"input": {"required": {"image": ["IMAGE"]}, "optional": {
        "detect_hand": _aux_opt(["enable", "disable"], "enable"),
        "detect_body": _aux_opt(["enable", "disable"], "enable"),
        "detect_face": _aux_opt(["enable", "disable"], "enable"),
        "resolution": ["INT", {"default": 512}],
        "bbox_detector": _aux_opt(["yolox_l.torchscript.pt", "yolox_l.onnx", "None"], "yolox_l.onnx"),
        "pose_estimator": _aux_opt(["dw-ll_ucoco_384_bs5.torchscript.pt", "dw-ll_ucoco_384.onnx"],
                                   "dw-ll_ucoco_384_bs5.torchscript.pt"),
        "scale_stick_for_xinsr_cn": _aux_opt(["disable", "enable"], "disable")}}},
    "DepthAnythingV2Preprocessor": {"input": {"required": {"image": ["IMAGE"]}, "optional": {
        "ckpt_name": _aux_opt(["depth_anything_v2_vitg.pth", "depth_anything_v2_vitl.pth",
                               "depth_anything_v2_vitb.pth", "depth_anything_v2_vits.pth"],
                              "depth_anything_v2_vitl.pth"),
        "resolution": ["INT", {"default": 512}]}}},
}


def aux_missing(g):
    """(node id, class, the first declared input it lacks) for an aux node,
    or None - what the real pack turns into a KeyError at execution."""
    for nid, v in g.items():
        sc = AUX_SCHEMAS.get(str((v or {}).get("class_type", "")))
        if not sc:
            continue
        ins = v.get("inputs") or {}
        for name in sc["input"].get("optional", {}):
            if name != "resolution" and name not in ins:
                return str(nid), str(v["class_type"]), name
    return None

VRAM = {"free_calls": 0, "freed": False, "last_free_body": None,
        # e2e: a fake card that "runs out of memory" on any video graph asking
        # for more than oom_above frames (0 = never). Set via POST /e2e/oom.
        "oom_above": 0, "oom_events": 0, "oom_kind": "oom",   # kind: oom | einval
        # e2e (2.129.0): a fake ComfyUI whose ACCELERATOR packs are broken.
        # accel_fail = "" | "h3sage" | "h3spectrum" (fail while THAT injected
        # node is in the graph, i.e. succeed once the worker has removed it) or
        # "always" (fail whatever the graph looks like, so a retry that cannot
        # help is proved to stop instead of looping). accel_kind picks the error
        # SHAPE: "spectrum" = the FinalLayer.forward() signature TypeError from
        # Tim's run 2; "sage" = the DLL-load ImportError from run 1.
        "accel_fail": "", "accel_kind": "spectrum", "accel_events": 0}

# Every basename /upload/image has handed back this run. Real ComfyUI can only
# load what sits in its input folder; a chain voice loader still holding the
# tmp file's project-disk name is a file the server has never seen. This is
# the faithful-mock rule again (2.130.0's uuid bug, 2.144.0's voice bug): a
# stub that loads any string lets the suite pass while Tim's machine fails.
UPLOADED = set()
SCHEMA = {}   # /e2e/schema: class -> {"input", "choices"} pack-update simulation

def _take_feed(g):
    """[latent source class, pixels source class, video source class, file]
    for the MMH3UltimateUpscale latent, or []."""
    def src(v, key):
        x = ((v or {}).get("inputs") or {}).get(key)
        return g.get(str(x[0])) if isinstance(x, list) and x else None
    up = next((v for v in g.values() if v.get("class_type") == "MMH3UltimateUpscale"), None)
    if not up:
        return []
    enc = src(up, "latent")
    comp = src(enc, "pixels")
    load = src(comp, "video")
    return [(enc or {}).get("class_type"), (comp or {}).get("class_type"),
            (load or {}).get("class_type"), ((load or {}).get("inputs") or {}).get("file")]


def _gen_ref_images(g):
    """The image filenames feeding a MiniMaxH3 gen node, in dotted-slot order.

    Follows the links rather than scanning LoadImage nodes, so a loader the
    patcher left detached is not counted as a reference the model saw.
    """
    out = []
    for v in g.values():
        if not (isinstance(v, dict) and "MiniMaxH3" in str(v.get("class_type", ""))):
            continue
        ins = v.get("inputs") or {}
        for k in sorted(k for k in ins if ".ref_image_" in k or k in ("first_frame", "last_frame")):
            link = ins.get(k)
            if isinstance(link, list) and link and str(link[0]) in g:
                img = ((g[str(link[0])].get("inputs") or {}).get("image"))
                if isinstance(img, str):
                    out.append(img)
    return out


def _gen_ref_audios(g):
    """The audio files behind a MiniMaxH3 gen node's ref_audios.* slots, in
    slot order - a slot fed through TrimAudioDuration (the NativeAudio song)
    is followed to its loader."""
    out = []
    for v in g.values():
        if not (isinstance(v, dict) and "MiniMaxH3" in str(v.get("class_type", ""))):
            continue
        ins = v.get("inputs") or {}
        for k in sorted(k for k in ins if ".ref_audio_" in k):
            link, hops = ins.get(k), 0
            while isinstance(link, list) and link and str(link[0]) in g and hops < 4:
                src = g[str(link[0])]
                a = (src.get("inputs") or {}).get("audio")
                if isinstance(a, str):
                    out.append(a)
                    break
                link, hops = a, hops + 1
    return out


def _gen_ref_videos(g):
    """2.292.0: the video files behind a MiniMaxH3 gen node's ref_videos.*
    slots, in slot order (the previous take's tail on a NativeAudio Ref
    scene)."""
    out = []
    for v in g.values():
        if not (isinstance(v, dict) and "MiniMaxH3" in str(v.get("class_type", ""))):
            continue
        ins = v.get("inputs") or {}
        for k in sorted(k for k in ins if ".ref_video_" in k):
            link = ins.get(k)
            if isinstance(link, list) and link and str(link[0]) in g:
                src = g[str(link[0])]
                # 2.305.0: the worker's split (LoadVideo -> GetVideoComponents
                # -> frames) - follow it to the loader
                if src.get("class_type") == "GetVideoComponents":
                    up = (src.get("inputs") or {}).get("video")
                    src = g.get(str(up[0])) or {} if isinstance(up, list) and up else {}
                si = src.get("inputs") or {}
                f = si.get("file", si.get("video"))
                if isinstance(f, str):
                    out.append(f)
    return out


INPUTS = OUT / "_inputs"


def _keep_upload(body, base):
    """The file part of a multipart /upload/image body, kept as OUT/_inputs/<base> (what ComfyUI's input folder holds)."""
    try:
        i = body.index(b"\r\n\r\n", body.index(b'filename="')) + 4
        bnd = body[:body.index(b"\r\n")]
        j = body.rindex(b"\r\n" + bnd)
        INPUTS.mkdir(parents=True, exist_ok=True)
        (INPUTS / base).write_bytes(body[i:j])
    except (ValueError, OSError):
        pass


def _probe(p):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                            "-of", "json", str(p)], capture_output=True, text=True, timeout=30)
        d = json.loads(r.stdout or "{}")
    except Exception:                                      # noqa: BLE001
        return {}
    out = {"audio": any(x.get("codec_type") == "audio" for x in d.get("streams") or [])}
    for x in d.get("streams") or []:
        if x.get("codec_type") == "video":
            out["w"], out["h"] = int(x.get("width") or 0), int(x.get("height") or 0)
            break
    out["dur"] = float((d.get("format") or {}).get("duration") or 0)
    return out


def render_seedvr2(pid, g):
    """2.400.0: a SeedVR2 video graph, answered like ComfyUI would: the LOADED video scaled by the Resize node's
    multiplier, as long as the source, no sound (the template's audio is not wired - the worker lays it back).
    The graph's wiring is checked the way the real nodes would fail: the conditioning must read the encoded (or
    split) latent, the merge must read the sampler, the post-process must hold the resized original."""
    def node(link):
        return g.get(str(link[0])) if isinstance(link, list) and link else None
    def err(nid, ct, msg):
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_error", {"prompt_id": pid, "node_id": str(nid), "node_type": ct, "exception_type": "ValueError",
                                 "exception_message": msg, "traceback": ["  File \"comfy_extras/nodes_seedvr.py\""]}]]},
            "outputs": {}}
    load = next((v for v in g.values() if v.get("class_type") == "LoadVideo"), None)
    rsz = next((v for v in g.values() if v.get("class_type") == "ResizeImageMaskNode"), None)
    cond_id, cond = next(((k, v) for k, v in g.items() if v.get("class_type") == "SeedVR2Conditioning"), (None, None))
    post = next((v for v in g.values() if v.get("class_type") == "SeedVR2PostProcessing"), None)
    f = ((load or {}).get("inputs") or {}).get("file")
    if not isinstance(f, str) or f not in UPLOADED:
        return err("1", "LoadVideo", f"Invalid video file: {f}")
    src = (node((cond.get("inputs") or {}).get("vae_conditioning")) or {}).get("class_type")
    if src not in ("VAEEncodeTiled", "VAEEncode", "SeedVR2TemporalChunk"):
        return err(cond_id, "SeedVR2Conditioning", f"vae_conditioning must be a SeedVR2 latent (got {src})")
    if (node(((post or {}).get("inputs") or {}).get("original_resized_images")) or {}).get("class_type") != "ResizeImageMaskNode":
        return err("13", "SeedVR2PostProcessing", "original_resized_images must be the resized source")
    info = _probe(INPUTS / f) if (INPUTS / f).is_file() else {}
    w, h, dur = info.get("w") or 192, info.get("h") or 108, info.get("dur") or 1.0
    m = float(((rsz or {}).get("inputs") or {}).get("resize_type.multiplier") or 1)
    ow, oh = max(2, int(round(w * m))), max(2, int(round(h * m)))
    ow, oh = ow - ow % 2, oh - oh % 2
    fn = f"seedvr2_{pid}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={ow}x{oh}:rate=24",
                    "-t", f"{dur:.3f}", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast", str(OUT / fn)],
                   check=False)
    rec = {"_seedvr2": {k: (v.get("inputs") or {}) for k, v in g.items()
                        if str(v.get("class_type", "")).startswith(("SeedVR2", "KSampler", "Resize", "UNET", "VAELoader",
                                                                   "CreateVideo"))},
           "_classes": sorted({str(v.get("class_type", "")) for v in g.values()}),
           "_source": {"file": f, "w": w, "h": h, "dur": dur, "audio": info.get("audio")}, "_out": [ow, oh]}
    Path(OUT / f"video_{pid}.json").write_text(json.dumps(rec), encoding="utf-8")
    sv = next((k for k, v in g.items() if v.get("class_type") == "SaveVideo"), "15")
    JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                 "outputs": {str(sv): {"images": [{"filename": fn, "subfolder": "", "type": "output"}], "animated": [True]}}}


def render_dlss5(pid, g):
    """2.504.0: a DLSS 5 graph answered like the pack would: the LOADED video at the size DLSS picks (the pack's
    fixed factors / 1K-8K buckets - scripts/dlss5_graph.target states the same rule), as long as the source, at the
    interpolated frame rate when RH_DLSS5FrameInterpolation is there. An option string the pack does not have, or an
    Enhance without a video, fails as ComfyUI's validation would."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import dlss5_graph as DG                                  # noqa: E402
    def err(nid, ct, msg):
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_error", {"prompt_id": pid, "node_id": str(nid), "node_type": ct, "exception_type": "ValueError",
                                 "exception_message": msg, "traceback": ["  File \"custom_nodes/ComfyUI-RH-DLSS5/nodes.py\""]}]]},
            "outputs": {}}
    load = next((v for v in g.values() if v.get("class_type") == "LoadVideo"), None)
    en_id, en = next(((k, v) for k, v in g.items() if v.get("class_type") == "RH_DLSS5Enhance"), (None, None))
    fi = next((v for v in g.values() if v.get("class_type") == "RH_DLSS5FrameInterpolation"), None)
    f = ((load or {}).get("inputs") or {}).get("file")
    if not isinstance(f, str) or f not in UPLOADED:
        return err("1", "LoadVideo", f"Invalid video file: {f}")
    ins = en.get("inputs") or {}
    sch = DLSS5_SCHEMAS["RH_DLSS5Enhance"]["input"]["optional"]
    for k, v in ins.items():
        spec = sch.get(k)
        if spec is None:
            continue
        if isinstance(spec[0], list) and v not in spec[0]:
            return err(en_id, "RH_DLSS5Enhance", f"Value not in list: {k}: '{v}' not in {spec[0]}")
    if not isinstance(ins.get("video"), list):
        return err(en_id, "RH_DLSS5Enhance", "connect an image batch or a video")
    info = _probe(INPUTS / f) if (INPUTS / f).is_file() else {}
    w, h, dur = info.get("w") or 192, info.get("h") or 108, info.get("dur") or 1.0
    t = DG.target(w, h, ins.get("upscaling_mode") or "1x (DLAA / native)")
    if t.get("error"):
        return err(en_id, "RH_DLSS5Enhance", t["error"])
    ow, oh = t["width"] - t["width"] % 2, t["height"] - t["height"] % 2
    fps = 24
    if fi:
        o = str((fi.get("inputs") or {}).get("output_fps") or "2x")
        fps = 24 * int(o[:-1]) if o.endswith("x") else int(float(o))
    fn = f"dlss5_{pid}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={ow}x{oh}:rate={fps}",
                    "-t", f"{dur:.3f}", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast", str(OUT / fn)],
                   check=False)
    rec = {"_dlss5": {k: (v.get("inputs") or {}) for k, v in g.items()}, "_out": [ow, oh, fps],
           "_classes": sorted({str(v.get("class_type", "")) for v in g.values()})}
    Path(OUT / f"video_{pid}.json").write_text(json.dumps(rec), encoding="utf-8")
    sv = next((k for k, v in g.items() if v.get("class_type") == "SaveVideo"), "9")
    JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                 "outputs": {str(sv): {"images": [{"filename": fn, "subfolder": "", "type": "output"}], "animated": [True]}}}


def render(pid, g):
    # An image graph (one that ends in SaveImage) renders PNGs; anything else is
    # the video path. A FAITHFUL stub matters more than a convenient one: a mock
    # that is less capable than the real server lets tests pass while the real
    # machine fails, so this honours batch_size, the latent's width/height and
    # the seed exactly as ComfyUI would.
    save = [n for n in g.values() if "SaveImage" in str(n.get("class_type", ""))]
    miss = aux_missing(g)
    if miss:                           # 2.319.0: the real pack's KeyError, verbatim shape
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_error", {"prompt_id": pid, "node_id": miss[0], "node_type": miss[1],
                                 "executed": [], "exception_message": f"'{miss[2]}'\n",
                                 "exception_type": "KeyError",
                                 "traceback": ["  File \"E:\\ComfyUI\\execution.py\", line 545, in execute\n"]}]]},
                     "outputs": {}}
        return
    if any(v.get("class_type") == "SeedVR2Conditioning" for v in g.values()) and \
            any(v.get("class_type") == "LoadVideo" for v in g.values()):
        return render_seedvr2(pid, g)                  # 2.400.0
    if any(v.get("class_type") == "RH_DLSS5Enhance" for v in g.values()):
        return render_dlss5(pid, g)                    # 2.504.0
    if any(v.get("class_type") == "SaveGLB" for v in g.values()):
        return render_mesh(pid, g)                     # 2.404.0
    if save:
        return render_images(pid, g)
    # A MUSIC graph ends in SaveAudio*/PreviewAudio and reports `audio`, not
    # `images` — the stub mirrors the real history shape so the music worker's
    # collection step is exercised for real, not against a convenient mock.
    # 2.301.0: the worker's LOSSLESS TAPS (bgraw_* PreviewImage/PreviewAudio
    # beside a video save) are not a music graph - the id says whose they are
    if any("SaveAudio" in str(n.get("class_type", "")) or "PreviewAudio" in str(n.get("class_type", ""))
           for k, n in g.items() if not str(k).startswith("bgraw_")):
        return render_audio(pid, g)
    dur = 1.0
    for v in g.values():
        ins = v.get("inputs", {})
        if "MiniMaxH3" not in str(v.get("class_type", "")):
            continue
        if "duration_seconds" in ins:                 # RH pack graphs
            dur = float(ins["duration_seconds"])
        elif isinstance(ins.get("length"), (int, float)):  # native graphs
            dur = float(ins["length"]) / 24.0
    # 2.339.0: an LTX 2.5 graph (Tim's canvas) is as long as it says - the
    # loaded video's frame_load_cap (v2v / Ripple), else the clip slider
    if any(str(v.get("class_type", "")).startswith("LTXV") for v in g.values()):
        for v in g.values():
            ins = v.get("inputs", {})
            if v.get("class_type") == "mxSlider" and isinstance(ins.get("Xi"), (int, float)):
                dur = (int(ins["Xi"]) * 24 + 1) / 24.0
        for v in g.values():
            ins = v.get("inputs", {})
            cap = ins.get("frame_load_cap")
            if v.get("class_type") == "VHS_LoadVideo" and isinstance(cap, list) and len(cap) == 2:
                cap = ((g.get(str(cap[0])) or {}).get("inputs") or {}).get("value")   # 2.342.0: Tim's Frames constant
            if v.get("class_type") == "VHS_LoadVideo" and isinstance(cap, int) and cap > 0:
                dur = cap / 24.0
    # 2.368.0: a Wan graph (core Wan nodes) is length frames at Wan's 16 fps
    for v in g.values():
        if str(v.get("class_type", "")) in ("WanImageToVideo", "WanFirstLastFrameToVideo", "WanVaceToVideo",
                                             "EmptyHunyuanLatentVideo", "WanCameraImageToVideo") \
                and isinstance(v.get("inputs", {}).get("length"), int):
            dur = v["inputs"]["length"] / 16.0
    # 2.344.0: a Viggle-Animate graph is as long as its conditioning's length
    for v in g.values():
        if v.get("class_type") == "ViggleAnimateConditioning" and isinstance(v.get("inputs", {}).get("length"), int):
            dur = v["inputs"]["length"] / 24.0
    frames = int(round(dur * 24))
    want = VRAM["accel_fail"]
    if want and (want == "always" or want in g):
        # The real shapes, verbatim from Tim's live runs. Note the spectrum one
        # blames the SAMPLER node, not the patch: that is exactly why the error
        # has to be recognised by shape rather than by which node reported it.
        VRAM["accel_events"] += 1
        if VRAM["accel_kind"] == "generic":
            # 2.143.1: an execution error NO recogniser knows (not sage, not
            # the H3-internals TypeError, not memory) from an ordinary node -
            # the case whose verdict used to be the misleading "check the
            # MiniMax H3 nodes exist" advice. The e2e proves the worker now
            # names THIS node and exception instead.
            # 2.175.0 (faithful to Tim's LoopStart audio-policy card): when
            # /e2e/schema declared a required input for a class THIS graph
            # carries, the node holding it is the one that throws - a policy
            # filled with a value the graph cannot satisfy fails AT that
            # node, exactly as on his machine. No schema match keeps the
            # canned 42/VAEDecode shape the 2.143.1 leg pins.
            hitn = hitc = None
            for nid2, v2 in g.items():
                ct2 = str(v2.get("class_type", ""))
                if ct2 in SCHEMA and SCHEMA[ct2].get("choices"):
                    sc2 = SCHEMA[ct2]
                    val2 = (v2.get("inputs") or {}).get(sc2["input"])
                    VRAM["last_policy_value"] = val2   # /e2e/vram introspection
                    # value-sensitive, as the real pack is: the strict first
                    # choice trips the policy; an ABSENT input means the node
                    # used its own default — the strict one (Tim's optional-
                    # widget case). A pinned other value renders past.
                    if val2 == sc2["choices"][0] or val2 is None:
                        hitn, hitc = str(nid2), ct2
                        break
            if hitn:
                sc = SCHEMA[hitc]
                ev = {"node_id": hitn, "node_type": hitc,
                      "exception_type": "ValueError",
                      "exception_message": (f"H3 preflight error: the active "
                          f"policy {sc['choices'][0]!r} requires source audio. "
                          "Action: connect a source, or change the policy."),
                      "traceback": ["  File \"chain_nodes.py\", line 10882"]}
            else:
                ev = {"node_id": "42", "node_type": "VAEDecode",
                      "exception_type": "RuntimeError",
                      "exception_message": ("Given groups=1, weight of size [512, 16, 3, 3], "
                                            "expected input to have 16 channels\n"
                                            "second line the card must not need"),
                      "traceback": ["  File \"comfy/sd.py\", line 300, in decode"]}
        elif VRAM["accel_kind"] == "sage":
            nid = "h3sage"
            ev = {"node_id": nid,
                  "node_type": str((g.get(nid) or {}).get("class_type") or "PathchSageAttentionKJ"),
                  "exception_type": "ImportError",
                  "exception_message": "DLL load failed while importing _fused: The specified module could not be found.",
                  "traceback": ["  File \"sageattention/core.py\", line 20, in <module>"]}
        else:
            ev = {"node_id": "333", "node_type": "SamplerCustomAdvanced",
                  "exception_type": "TypeError",
                  "exception_message": ("FinalLayer.forward() missing 3 required positional "
                                        "arguments: 'sigma', 'sample_sigmas', and 'shifts'"),
                  "traceback": ["  File \"comfy/ldm/minimax/model.py\", line 300, in forward"]}
        ev["prompt_id"] = pid
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_cached", {"prompt_id": pid, "nodes": ["122", "127"]}],
            ["execution_error", ev]]}, "outputs": {}}
        return
    if VRAM["oom_above"] and frames > VRAM["oom_above"]:
        # the exact event shape a real failure leaves in /history (Tim's logs):
        # a clean torch OOM, or the OSError [Errno 22] the SAME over-budget run
        # throws under memory pressure (2.99.1). Both must trigger the ladder.
        VRAM["oom_events"] += 1
        if VRAM["oom_kind"] == "einval":
            exc_msg, exc_type = "[Errno 22] Invalid argument\n", "OSError"
        else:
            exc_msg = "Allocation on device \nThis error means you ran out of memory on your GPU.\n"
            exc_type = "torch.OutOfMemoryError"
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_error", {"prompt_id": pid, "node_id": "125",
                                 "node_type": "SamplerCustomAdvanced", "executed": ["127"],
                                 "exception_message": exc_msg, "exception_type": exc_type,
                                 "traceback": ["  File \"execution.py\", line 545, in execute"]}]]},
                     "outputs": {}}
        return
    # 2.145.0: the real Scheduled*Reference pack VALIDATES its tag widget at
    # execution — Tim's live error, verbatim shape. A spaced or punctuated
    # tag must fail here exactly as it fails on his machine, or the suite is
    # green while the hardware is not (the faithful-mock rule, fifth time).
    for nid, v in g.items():
        ct = str(v.get("class_type", ""))
        if not ("Scheduled" in ct and "Reference" in ct):
            continue
        t = (v.get("inputs") or {}).get("tag")
        if isinstance(t, str) and not re.fullmatch(r"@?[A-Za-z0-9_-]+", t):
            JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
                ["execution_start", {"prompt_id": pid, "timestamp": 1}],
                ["execution_error", {"prompt_id": pid, "node_id": str(nid),
                                     "node_type": ct,
                                     "exception_type": "ValueError",
                                     "exception_message": ("Reference tag must be a stable tag "
                                                           "such as 'hero_face' or '@hero-face'."),
                                     "traceback": ["  File \"scheduled_reference.py\""]}]]},
                         "outputs": {}}
            return
    # 2.144.0: a VHS_LoadAudioUpload naming a file that was never uploaded
    # fails at EXECUTION on the real server (the file is not in its input
    # folder) — reproduce that, so a worker that leaves the tmp file's stale
    # project-disk name in a voice loader cannot pass the suite.
    for nid, v in g.items():
        if v.get("class_type") != "VHS_LoadAudioUpload":
            continue
        a = (v.get("inputs") or {}).get("audio")
        if isinstance(a, str) and a not in UPLOADED:
            JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
                ["execution_start", {"prompt_id": pid, "timestamp": 1}],
                ["execution_error", {"prompt_id": pid, "node_id": str(nid),
                                     "node_type": "VHS_LoadAudioUpload",
                                     "exception_type": "FileNotFoundError",
                                     "exception_message": f"Audio file not found: {a}",
                                     "traceback": ["  File \"videohelpersuite/load_audio.py\""]}]]},
                         "outputs": {}}
            return
    # 2.110.0: what a VIDEO STYLE wrote into the graph — loaders, encoder,
    # vae, LoRAs — so the e2e can prove the style reached ComfyUI
    rec = {"_models": sorted(str(v["inputs"].get(k)) for v in g.values() for k in ("unet_name", "ckpt_name")
                             if isinstance(v.get("inputs", {}).get(k), str)),
           "_clips": sorted(str(v["inputs"].get("clip_name")) for v in g.values() if isinstance(v.get("inputs", {}).get("clip_name"), str)),
           "_vaes": sorted(str(v["inputs"].get("vae_name")) for v in g.values() if isinstance(v.get("inputs", {}).get("vae_name"), str)),
           "_loras": sorted(str(v["inputs"].get("lora_name")) for v in g.values()
                            if "lora" in str(v.get("class_type", "")).lower() and isinstance(v.get("inputs", {}).get("lora_name"), str)),
           "_steps": {nid: v["inputs"]["steps"] for nid, v in g.items() if isinstance(v.get("inputs", {}).get("steps"), int)},
           "_cfg": {nid: v["inputs"]["cfg"] for nid, v in g.items() if isinstance(v.get("inputs", {}).get("cfg"), (int, float))},
           # 2.116.0: the injected VIDEO ACCELERATORS (sage / spectrum) so the
           # e2e can prove a style's accel choice reached ComfyUI, wired in
           # front of the guider ("h3sage"/"h3spectrum" ids from worker.py)
           "_accel": sorted(str(v.get("class_type")) for v in g.values()
                            if str(v.get("class_type")) in
                            ("PathchSageAttentionKJ",
                             "MiniMaxH3MemoryEfficientSageAttentionPatch",
                             "SpectrumApplyMiniMaxH3", "VedaSparseAttention")),
           "_accel_wiring": {nid: v["inputs"].get("model") for nid, v in g.items()
                             if nid in ("h3sage", "h3spectrum", "h3veda")
                             or (isinstance(v.get("inputs", {}).get("model"), list)
                                 and str(v["inputs"]["model"][0]) in ("h3sage", "h3spectrum", "h3veda"))},
           "_veda": (g.get("h3veda") or {}).get("inputs"),          # 2.536.0
           "_spectrum": (g.get("h3spectrum") or {}).get("inputs"),
           # 2.312.0: the MMH3 Ultimate Upscale stage as queued (class -> inputs)
           "_upscale": {str(v.get("class_type")): v.get("inputs") for v in g.values()
                        if str(v.get("class_type", "")).startswith("MMH3")},
           "_decode_src": [v["inputs"].get("samples") for v in g.values()
                           if v.get("class_type") == "VAEDecode"],
           # 2.315.0: what feeds the upscale stage's latent - a TAKE upscale
           # reads LoadVideo -> GetVideoComponents -> VAEEncodeTiled
           "_take_feed": _take_feed(g),
           # 2.130.0: the images the GEN node actually received, in slot order.
           # Chunk 2 of a long render must still be holding chunk 1's reference
           # (the character) as well as the hand-off frame — that is the whole
           # of the 15-second-character-reset fix, and it is invisible from any
           # other record the stub keeps.
           "_ref_images": _gen_ref_images(g),
           # 2.334.0: the character swap's identity knobs - the gen node's
           # ref_image_size and the Power Lora Loader's rows that are on
           "_ref_image_size": next(((v.get("inputs") or {}).get("ref_image_size") for v in g.values()
                                    if "MiniMaxH3" in str(v.get("class_type", ""))
                                    and "ref_image_size" in (v.get("inputs") or {})), None),
           "_power_loras": [str(x.get("lora")) for v in g.values()
                            if str(v.get("class_type", "")).startswith("Power Lora Loader")
                            for k, x in sorted((v.get("inputs") or {}).items())
                            if k.startswith("lora_") and isinstance(x, dict) and x.get("on") is not False],
           # 2.290.0: the native gen node's PROMPT (the reference map rides
           # it) and the files behind its dotted AUDIO slots, in slot order,
           # followed through TrimAudioDuration to the loader
           "_gen_prompt": next((str((v.get("inputs") or {}).get("prompt"))
                                for v in g.values()
                                if "MiniMaxH3" in str(v.get("class_type", ""))
                                and isinstance((v.get("inputs") or {}).get("prompt"), str)), ""),
           "_ref_audio_slots": _gen_ref_audios(g),
           # 2.323.0: the native gen node's LENGTH (frames) - a no-song scene
           # is timed by the writer's seconds / the Duration field
           "_gen_length": next(((v.get("inputs") or {}).get("length") for v in g.values()
                                if "MiniMaxH3" in str(v.get("class_type", ""))
                                and isinstance((v.get("inputs") or {}).get("length"), (int, float))), None),
           "_ref_video_slots": _gen_ref_videos(g),
           # 2.357.0: the native gen node's SIZE (the left Basic Settings' width x height on a board render)
           "_gen_size": next(([(v.get("inputs") or {}).get("width"), (v.get("inputs") or {}).get("height")]
                              for v in g.values() if "MiniMaxH3" in str(v.get("class_type", ""))
                              and isinstance((v.get("inputs") or {}).get("width"), (int, float))), None),
           # 2.144.0: the audio filenames the chain's voice loaders will read
           "_ref_audios": sorted(str((v.get("inputs") or {}).get("audio"))
                                 for v in g.values()
                                 if v.get("class_type") in ("VHS_LoadAudioUpload", "LoadAudio")
                                 and isinstance((v.get("inputs") or {}).get("audio"), str)),
           # 2.140.0: every class in the queued graph, so a test can assert a
           # stage (e.g. MMH3UltimateUpscale) was kept or stripped without the
           # stub having to keep the whole graph around.
           "_classes": sorted({str(v.get("class_type", "")) for v in g.values()
                               if isinstance(v, dict)}),
           # 2.344.0: every model file the graph names (a worker's name matching is provable)
           "_models": sorted({str((v.get("inputs") or {}).get(k)) for v in g.values() if isinstance(v, dict)
                              for k in ("unet_name", "vae_name", "lora_name", "text_cond", "clip_name")
                              if isinstance((v.get("inputs") or {}).get(k), str)})}
    # 2.170.0 (the render-selected first-scene-six-times bug): a CHAIN graph
    # answers like the real pack answers — the SEGMENT file is VIDEO-ONLY
    # (Tim's pre-2.165.0 silent takes prove his segments carry no audio) and
    # the ASSEMBLED film carries the muxed audio. The loop's scene_range is
    # recorded so a test can prove which scene a queued job asked for.
    loop = next((v for v in g.values()
                 if str(v.get("class_type")) == "MiniMaxH3ChainLoopStart"), None)
    seg_nid = next((nid for nid, v in g.items()
                    if "SegmentSave" in str(v.get("class_type"))), None)
    asm_nid = next((nid for nid, v in g.items()
                    if "ChainAssemble" in str(v.get("class_type"))), None)
    if loop is not None:
        rec["_scene_range"] = str((loop.get("inputs") or {}).get("scene_range", ""))
    Path(OUT / f"video_{pid}.json").write_text(json.dumps(rec), encoding="utf-8")
    if loop is not None and seg_nid and asm_nid:
        import re as _re
        plan = {}
        for v in g.values():
            if str(v.get("class_type")) == "MiniMaxH3ChainPlan":
                try: plan = json.loads(str((v.get("inputs") or {}).get("plan_json", "")))
                except Exception: plan = {}
                break
        shots = plan.get("shots") or []
        total = max(1.0, sum(int(sh.get("length", 24)) for sh in shots) / 24.0)
        m = _re.fullmatch(r"(\d+):(\d+)", str((loop.get("inputs") or {}).get("scene_range", "")))
        n = int(m.group(1)) if m and m.group(1) == m.group(2) else 1
        seg_dur = (int(shots[n - 1].get("length", 24)) / 24.0
                   if len(shots) >= n else min(2.0, total))
        seg_fn, film_fn = f"segment_{pid}.webm", f"film_{pid}.webm"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-f", "lavfi", "-i", "testsrc2=size=192x108:rate=24",
                        "-t", f"{seg_dur:.3f}", "-pix_fmt", "yuv420p",
                        "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0",
                        "-an", str(OUT / seg_fn)], check=False)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-f", "lavfi", "-i", "testsrc2=size=192x108:rate=24",
                        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                        "-t", f"{total:.3f}", "-pix_fmt", "yuv420p",
                        "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0",
                        "-c:a", "libopus", str(OUT / film_fn)], check=False)
        JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                     "outputs": {str(seg_nid): {"videos": [{"filename": seg_fn,
                                                            "subfolder": "", "type": "output"}]},
                                 str(asm_nid): {"videos": [{"filename": film_fn,
                                                            "subfolder": "", "type": "output"}]}}}
        return
    fn = f"h3_{pid}.webm"
    # 2.350.0: "black" = True (every render) or a count (the next N renders)
    blk = VRAM.get("black")
    if isinstance(blk, int) and not isinstance(blk, bool) and blk > 0:
        VRAM["black"] = blk - 1 or False
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                    "-f", "lavfi", "-i", "color=c=black:size=192x108:rate=24" if blk else "testsrc2=size=192x108:rate=24",
                    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                    "-t", f"{dur:.3f}", "-pix_fmt", "yuv420p",
                    "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0",
                    "-c:a", "libopus", str(OUT / fn)], check=False)
    outs = {"9": {"videos": [{"filename": fn, "subfolder": "", "type": "output"}]}}
    # 2.301.0: the lossless taps answer like ComfyUI's PreviewImage /
    # PreviewAudio - PNG frames (the SAME testsrc2 frames as the video, so the
    # master and the take are the same pictures) and a FLAC, type "temp"
    if "bgraw_frames" in g:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-f", "lavfi", "-i", "testsrc2=size=192x108:rate=24",
                        "-t", f"{dur:.3f}", str(OUT / f"bgraw_{pid}_%05d_.png")], check=False)
        pngs = sorted(x.name for x in OUT.glob(f"bgraw_{pid}_*_.png"))
        outs["bgraw_frames"] = {"images": [{"filename": x, "subfolder": "", "type": "temp"}
                                           for x in pngs]}
        if "bgraw_audio" in g:
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                            "-t", f"{dur:.3f}", "-c:a", "flac", str(OUT / f"bgraw_{pid}.flac")],
                           check=False)
            outs["bgraw_audio"] = {"audio": [{"filename": f"bgraw_{pid}.flac",
                                              "subfolder": "", "type": "temp"}]}
    JOBS[pid] = {"status": {"status_str": "success", "completed": True}, "outputs": outs}

def render_audio(pid, g):
    """An mp3 of exactly max_duration seconds, batch_size of them.

    The tone is keyed on the seed so two songs from different seeds differ in
    bytes; the lyrics and caption that reached the encoder are written beside
    the files (prompt_<pid>.json) so a test can prove the PROMPT went into
    `lyrics` and the STYLE's text into `caption`, not the other way round.
    """
    dur, n, seed = 5.0, 1, 0
    texts = {}
    for nid, v in g.items():
        ins = v.get("inputs", {})
        if isinstance(ins.get("max_duration"), (int, float)):
            dur = float(ins["max_duration"])
        if "batch_size" in ins and not isinstance(ins["batch_size"], list) \
                and "seconds" in ins:
            n = int(ins.get("batch_size") or 1)
        for k in ("seed", "noise_seed"):
            if k in ins and not isinstance(ins[k], list):
                seed = int(ins[k])
        for k in ("lyrics", "caption"):
            if isinstance(ins.get(k), str):
                texts.setdefault(nid, {})[k] = ins[k]
        # sampler/scheduler names must be something ComfyUI would accept; the
        # stub records them so a test can assert the style's choice arrived
        for k in ("sampler_name", "scheduler", "steps", "cfg"):
            if k in ins and not isinstance(ins[k], list):
                texts.setdefault(nid, {})[k] = ins[k]
    files = []
    dur = max(0.5, min(dur, 20.0))         # the stub need not render 5 minutes
    for i in range(max(1, n)):
        fn = f"audio_minimax_music3_{pid}_{i}.mp3"
        hz = 220 + ((seed + i * 97) % 400)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                        "-i", f"sine=frequency={hz}:sample_rate=44100",
                        "-t", f"{dur:.3f}", "-c:a", "libmp3lame", "-q:a", "5",
                        str(OUT / fn)], check=False)
        files.append({"filename": fn, "subfolder": "audio", "type": "output"})
    Path(OUT / f"prompt_{pid}.json").write_text(json.dumps(texts), encoding="utf-8")
    JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                 "outputs": {"35": {"audio": files}}}


def render_images(pid, g):
    """PNGs, exactly as many as batch_size, at the latent's size.

    The colour is keyed on the seed and the batch index so an e2e check can
    assert that a batch of three is three DIFFERENT pictures. A stub that
    returned identical bytes would hide a seed/batch regression completely.
    """
    w = h = 512
    n = 1
    for v in g.values():
        ins = v.get("inputs", {})
        if "width" in ins and "height" in ins and not isinstance(ins["width"], list):
            w, h = int(ins["width"]), int(ins["height"])
            n = int(ins.get("batch_size", 1) or 1)
    seed = 0
    for v in g.values():
        ins = v.get("inputs", {})
        for k in ("seed", "noise_seed"):
            if k in ins and not isinstance(ins[k], list):
                seed = int(ins[k])
    # EVERY text node, keyed by node id — not "the last one seen". A test has to
    # be able to prove the prompt went to the POSITIVE node and the negative
    # prompt to the negative one; collapsing them to one string cannot show
    # that, and getting them the wrong way round is the failure that looks like
    # a bad model rather than a bug.
    texts = {nid: (v["inputs"].get("text") if isinstance(v["inputs"].get("text"), str) else v["inputs"].get("text_g"))
             for nid, v in g.items()
             if isinstance(v.get("inputs", {}).get("text"), str) or isinstance(v.get("inputs", {}).get("text_g"), str)}
    # 2.105.0: the reference pictures that reached LoadImage nodes, so a test
    # can prove the dock conditioned a Klein 9B render
    texts["_images"] = [v["inputs"]["image"] for v in g.values()
                        if v.get("class_type") == "LoadImage" and isinstance(v.get("inputs", {}).get("image"), str)]
    # 2.109.0: the model names and LoRAs that reached the loaders (the image
    # editor's Infill must carry the style's overrides into the inpaint graph)
    texts["_models"] = sorted(str(v["inputs"].get(k)) for v in g.values() for k in ("unet_name", "ckpt_name")
                              if isinstance(v.get("inputs", {}).get(k), str))
    texts["_loras"] = sorted(str(v["inputs"].get("lora_name")) for v in g.values()
                             if "lora" in str(v.get("class_type", "")).lower() and isinstance(v.get("inputs", {}).get("lora_name"), str))
    # 2.316.0: the ControlNet pass - the preprocessor graph and the final's
    # ControlNet nodes (class -> inputs), so the e2e can prove each step
    texts["_classes"] = sorted({str(v.get("class_type", "")) for v in g.values()})
    # 2.332.0: the image editor's AI - a prompt promoted to a Primitive (the
    # Qwen edit graph) and the sampler's denoise (Refine's strength)
    texts["_prims"] = {nid: v["inputs"].get("value") for nid, v in g.items()
                       if str(v.get("class_type", "")).startswith("PrimitiveString")
                       and isinstance(v.get("inputs", {}).get("value"), str)}
    texts["_denoise"] = {nid: v["inputs"].get("denoise") for nid, v in g.items()
                         if isinstance(v.get("inputs", {}).get("denoise"), (int, float))}
    texts["_cn"] = {str(v.get("class_type")): v.get("inputs") for v in g.values()
                    if str(v.get("class_type", "")) in ("ControlNetLoader", "ControlNetApplyAdvanced",
                                                        "DWPreprocessor", "Scribble_PiDiNet_Preprocessor",
                                                        "LineArtPreprocessor", "DepthAnythingV2Preprocessor")}
    # 2.322.0: the face fix - FaceDetailer's inputs + its detector, and what
    # the SaveImage reads, so the e2e can prove the pass sits before the save
    texts["_face"] = {str(v.get("class_type")): v.get("inputs") for v in g.values()
                      if str(v.get("class_type", "")) in ("FaceDetailer", "UltralyticsDetectorProvider")}
    texts["_save_src"] = [str((g.get(str((v.get("inputs") or {}).get("images", [""])[0])) or {}).get("class_type"))
                          for v in g.values() if "SaveImage" in str(v.get("class_type", ""))
                          and isinstance((v.get("inputs") or {}).get("images"), list)]
    files = []
    for i in range(max(1, n)):
        fn = f"img_{pid}_{i}.png"
        c = ((seed + i * 97) * 37) % 256
        # 2.386.0: green from the seed's NEXT bits - two seeds 256 apart used to give the same picture (a 1-in-256
        # flake in "the second press reproduced the first"); now it takes 1 in 65536
        gr = (((seed + i * 97) >> 8) * 53 + 32) % 256
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                        "-i", f"color=c=0x{c:02x}{gr:02x}{(c * 3) % 256:02x}:s={w}x{h}",
                        "-frames:v", "1", str(OUT / fn)], check=False)
        files.append({"filename": fn, "subfolder": "", "type": "output"})
    Path(OUT / f"prompt_{pid}.json").write_text(json.dumps(texts), encoding="utf-8")
    # 2.314.0, faithful-mock rule: the images come back under the SAVE
    # node's own id (it used to be "9" whatever the graph said)
    sid = next((k for k, v in g.items() if "SaveImage" in str(v.get("class_type", ""))), "9")
    JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                 "outputs": {str(sid): {"images": files}}}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _j(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def _ws(self):
        """Minimal WS endpoint: handshake, then a fake progress stream — a
        queue 'status', 'executing', 4 legacy 'progress' frames on node 125,
        then a 'progress_state' batch (the >=0.33 shape) so the worker's
        live-progress listener is exercised on BOTH message formats."""
        key = self.headers.get("Sec-WebSocket-Key", "")
        acc = base64.b64encode(hashlib.sha1(
            (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        self.wfile.write((f"HTTP/1.1 101 Switching Protocols\r\n"
                          f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
                          f"Sec-WebSocket-Accept: {acc}\r\n\r\n").encode())
        def frame(obj):
            p = json.dumps(obj).encode()
            if len(p) < 126:                       # 7-bit length
                hdr = bytes([0x81, len(p)])
            else:                                  # 16-bit extended length
                hdr = bytes([0x81, 126]) + len(p).to_bytes(2, "big")
            self.wfile.write(hdr + p)
        try:
            frame({"type": "status",
                   "data": {"status": {"exec_info": {"queue_remaining": 2}}}})
            frame({"type": "executing", "data": {"node": "125"}})
            for v in range(1, 5):
                time.sleep(0.35)
                frame({"type": "progress",
                       "data": {"value": v, "max": 4, "node": "125"}})
            time.sleep(0.2)
            frame({"type": "progress_state",
                   "data": {"nodes": {"125": {"value": 5, "max": 6,
                                              "state": "running",
                                              "display_node_id": "125"},
                                      "122": {"value": 0, "max": 1,
                                              "state": "pending"}}}})
            time.sleep(1.0)
            self.wfile.write(bytes([0x88, 0x00]))     # close
        except Exception:
            pass
        self.close_connection = True

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/ws":
            return self._ws()
        if u.path in ("/system_stats",):
            free = 30 * GB if VRAM["freed"] else 3 * GB
            return self._j({"ok": True, "devices": [
                {"name": "stub cuda:0", "type": "cuda", "index": 0,
                 "vram_total": 32 * GB, "vram_free": free,
                 "torch_vram_total": 32 * GB, "torch_vram_free": free}]})
        if u.path == "/e2e/vram":          # e2e introspection, not a ComfyUI route
            return self._j(dict(VRAM))
        if u.path.startswith("/object_info"):
            ct = unquote(u.path.rstrip("/").rsplit("/", 1)[-1])   # 2.338.0: encoded class names
            if ct == "MiniMaxH3ChainContext":
                # CONTINUITY PREFLIGHT shape (2.172.0): a context node that
                # takes vae+latent plausibly RETURNS a context-spliced
                # latent, so the stub declares one - that makes the e2e
                # exercise the bypass DETECTOR against Tim's real export
                # wiring (which leaves this output unconsumed). On Tim's
                # machine the worker reads his server's REAL answer; if the
                # real node has no latent output it prints the wiring-OK
                # line instead. The stub only picks which branch the suite
                # covers - the detector itself never assumes a shape.
                return self._j({ct: {"input": {},
                    "output": ["CONDITIONING", "INT", "LATENT"],
                    "output_name": ["conditioning", "trim_frames",
                                    "context_latent"]}})
            # 2.401.2: ComfyUI's core Math Expression as the real server declares it - the expression widget + the
            # growable values group (a, b, ...); outside core_schemas so the queue's required-input check (which
            # would ask for "values" itself, not values.a) stays as it was
            if ct == "ComfyMathExpression":
                return self._j({ct: {"input": {"required": {
                    "expression": ["STRING", {"multiline": True, "default": "a + b"}],
                    "values": ["COMFY_AUTOGROW_V3", {"template": {"input": {"required": {}}}}]}},
                    "output": ["FLOAT", "INT", "BOOLEAN"], "output_name": ["FLOAT", "INT", "BOOL"]}})
            # 2.536.0: Veda sparse attention - its predictor combo (models/veda); STUB_VEDA_EMPTY=1 = none downloaded
            if ct == "VedaSparseAttention":
                preds = [] if os.environ.get("STUB_VEDA_EMPTY") else ["minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors"]
                return self._j({ct: {"input": {"required": {"model": ["MODEL"], "predictor": [preds]},
                    "optional": {"generated_sparsity": ["STRING", {"default": "90%"}], "reference_sparsity": ["STRING", {"default": "90%"}],
                                 "full_attention_layers": ["STRING", {"default": ""}], "full_attention_steps": ["STRING", {"default": ""}],
                                 "verbose": ["BOOLEAN", {"default": False}]}},
                    "output": ["MODEL"], "output_name": ["MODEL"]}})
            CS = core_schemas()
            if ct in CS:
                return self._j({ct: CS[ct]})
            # 2.401.5: the real answers (fixture) - unless an e2e leg is simulating a pack update on that class
            if ct in LTX25_REAL and ct != "ComfyMathExpression" and ct not in SCHEMA and ct not in LTX25_NOT_SERVED:
                return self._j({ct: ltx25_schema(ct)})
            # 2.344.0: the speed patches in Tim's Viggle upload come from a
            # pack this "ComfyUI" does not have - the worker steps over them
            if ct in ABSENT:
                return self._j({})
            if ct and ct != "object_info":
                sc = SCHEMA.get(ct)
                if sc:
                    # a pack-update shape (2.175.0/2.176.0): one combo input
                    # the exports never had — REQUIRED gets schema-filled by
                    # the worker; OPTIONAL stays unsent and the node runs on
                    # its own default, the exact shape of Tim's LoopStart card
                    sec = sc.get("section") or "required"
                    if "default" in sc and not sc.get("choices"):
                        # 2.209.0: a DEFAULTED SCALAR the export predates —
                        # the exact shape of Tim's resolution_steps card. The
                        # worker fills it from this declared default.
                        return self._j({ct: {"input": {sec: {
                            sc["input"]: ["INT", {"default": sc["default"]}]}}}})
                    return self._j({ct: {"input": {sec: {
                        sc["input"]: [list(sc["choices"])]}}}})
                return self._j({ct: {"input": {}}})   # class exists, no schema
            return self._j({"ok": True})
        if u.path.startswith("/history/"):
            pid = u.path.rsplit("/", 1)[1]
            return self._j({pid: JOBS[pid]} if pid in JOBS else {})
        if u.path == "/view":
            q = parse_qs(u.query)
            f = OUT / Path(q["filename"][0]).name
            data = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self._j({"error": "nf"}, 404)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n)
        if self.path == "/upload/image":
            # Real ComfyUI keeps the uploaded FILENAME (it de-duplicates with a
            # suffix, it does not randomise). The stub used to answer with a
            # fresh uuid every time, which made the same reference image look
            # like a different picture in every chunk — an unfaithful mock that
            # hid the 15-second character reset from the suite and then made the
            # fix for it look broken. Echo the basename instead.
            m = re.search(rb'filename="([^"]*)"', body or b"")
            base = (m.group(1).decode("utf-8", "replace") if m else "")
            base = os.path.basename(base).strip() or ("up_" + uuid.uuid4().hex[:6] + ".png")
            UPLOADED.add(base)
            if re.search(r"\.(mp4|webm|mov|mkv|m4v)$", base, re.I):     # 2.400.0: the SeedVR2 render reads it back
                _keep_upload(body, base)
            return self._j({"name": base, "subfolder": ""})
        if self.path == "/e2e/schema":        # e2e control, not a ComfyUI route
            # declare a combo input for a class, as an updated node pack
            # would: {"class": "VAEDecode", "input": "e2e_policy",
            # "choices": [...], "section": "required"|"optional"};
            # or a DEFAULTED SCALAR (2.209.0, the resolution_steps shape):
            # {"class": ..., "input": ..., "default": 64} — no choices, the
            # worker fills it from the declared default. Empty class clears.
            j = json.loads(body or b"{}")
            SCHEMA.clear() if not j.get("class") else SCHEMA.update(
                {j["class"]: (
                    {"input": j.get("input") or "e2e_policy",
                     "default": j["default"],
                     "section": j.get("section") or "required"}
                    if "default" in j and not j.get("choices") else
                    {"input": j.get("input") or "e2e_policy",
                     "choices": j.get("choices") or ["strict", "loose"],
                     "section": j.get("section") or "required"})})
            return self._j(dict(SCHEMA))
        if self.path == "/e2e/black":          # 2.348.0: the next video renders are all black
            j = json.loads(body or b"{}")
            VRAM["black"] = int(j["count"]) if int(j.get("count") or 0) > 0 else bool(j.get("on"))
            return self._j({"black": VRAM["black"]})
        if self.path == "/e2e/oom":            # e2e control, not a ComfyUI route
            j = json.loads(body or b"{}")
            VRAM["oom_above"] = int(j.get("above") or 0)
            VRAM["oom_kind"] = j.get("kind") or "oom"
            VRAM["oom_events"] = 0
            return self._j(dict(VRAM))
        if self.path == "/e2e/accel":          # e2e control, not a ComfyUI route
            j = json.loads(body or b"{}")
            VRAM["accel_fail"] = str(j.get("node") or "")
            VRAM["accel_kind"] = j.get("kind") or "spectrum"
            VRAM["accel_events"] = 0
            return self._j(dict(VRAM))
        if self.path == "/free":
            # ComfyUI answers an EMPTY 200 here (web.Response(status=200)); the
            # client's http_json must cope with a body of zero bytes.
            try:
                VRAM["last_free_body"] = json.loads(body or b"{}")
            except Exception:
                VRAM["last_free_body"] = {"bad": True}
            VRAM["free_calls"] += 1
            VRAM["freed"] = True
            self.send_response(200)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path == "/prompt":
            g = json.loads(body)["prompt"]
            VRAM["freed"] = False                 # a render fills the card again

            # 2.147.0, faithful-mock rule: real ComfyUI validates INT minimums
            # — BasicScheduler.steps has min 1, so a 0 written over a step
            # input is REJECTED at /prompt. The stub used to accept it, which
            # is how a degenerate schedule could pass the suite while a real
            # render came out as noise.
            for nid, v in g.items():
                if v.get("class_type") == "BasicScheduler":
                    st = (v.get("inputs") or {}).get("steps")
                    if isinstance(st, (int, float)) and st < 1:
                        return self._j({"error": {
                            "type": "prompt_outputs_failed_validation",
                            "message": "Prompt outputs failed validation"},
                            "node_errors": {str(nid): {"errors": [{
                                "message": "Value smaller than min of 1",
                                "details": f"steps: {st}",
                                "extra_info": {"input_name": "steps",
                                               "received_value": st}}]}}},
                           400)
            # 2.305.0, faithful-mock rule (Tim's Scene 7 report): newer
            # ComfyUI declares MiniMaxH3ReferenceToVideo's ref_videos.* IMAGE
            # (the clip's frames); a LoadVideo (VIDEO) linked straight in is
            # refused at /prompt in exactly this shape. The worker splits the
            # link (GetVideoComponents) and queues again.
            vv = {}
            for nid, v in g.items():
                if not isinstance(v, dict) or v.get("class_type") != "MiniMaxH3ReferenceToVideo":
                    continue
                for name, val in (v.get("inputs") or {}).items():
                    if (re.fullmatch(r"ref_videos\.ref_video_\d+", name) and isinstance(val, list)
                            and (g.get(str(val[0])) or {}).get("class_type") == "LoadVideo"):
                        vv.setdefault(str(nid), {"errors": []})["errors"].append({
                            "type": "return_type_mismatch",
                            "message": "Return type mismatch between linked nodes",
                            "details": f"{name}, received_type(VIDEO) mismatch input_type(IMAGE)",
                            "extra_info": {"input_name": name, "input_config": ["IMAGE", {}],
                                           "received_type": "VIDEO", "linked_node": val}})
            if vv:
                return self._j({"error": {"type": "prompt_outputs_failed_validation",
                                          "message": "Prompt outputs failed validation"},
                                "node_errors": vv}, 400)
            if any(v.get("class_type") == "E2E_Reject" for v in g.values()):
                return self._j({"error": {"type": "prompt_outputs_failed_validation",
                                          "message": "Prompt outputs failed validation"},
                                "node_errors": {"73": {"errors": [{
                                    "message": "Value not in list",
                                    "details": "model: 'nope.safetensors' not in [...]",
                                    "extra_info": {"input_name": "model",
                                                   "received_value": "nope.safetensors"}}]}}},
                               400)
            # 2.279.0, faithful-mock rule (Tim's field report: "rejected:
            # prompt_no_outputs Prompt has no outputs"): real ComfyUI refuses
            # a graph with no OUTPUT_NODE class in it. The stub used to
            # accept anything, which is exactly how the cascade could behead
            # the chain (LoopStart..Assemble) and still pass the gate while
            # the real box rejected the same graph. Output-ness follows the
            # naming convention real packs follow (Save*/Preview* classes,
            # VHS_VideoCombine) plus the H3 chain's own terminals; the
            # E2E_Reject hook above keeps precedence, it is a deliberate
            # sink-less probe.
            def _outputish(ct):
                ct = str(ct or "")
                return (ct.startswith("Save") or ct.startswith("Preview")
                        or "VideoCombine" in ct
                        or ct in ("MiniMaxH3ChainSegmentSave",
                                  "MiniMaxH3ChainAssemble",
                                  "MiniMaxH3ChainReview"))
            if not any(_outputish(v.get("class_type"))
                       for v in g.values() if isinstance(v, dict)):
                return self._j({"error": {
                    "type": "prompt_no_outputs",
                    "message": "Prompt has no outputs"},
                    "node_errors": {}}, 400)
            # 2.280.0: required-input presence for the core classes, the
            # exact validation Tim's box applied. A missing required key is
            # refused BY NAME in ComfyUI's own error shape.
            nerr = {}
            for nid, v in g.items():
                if not isinstance(v, dict):
                    continue
                sch = core_schemas().get(str(v.get("class_type", "")))
                if not sch:
                    continue
                ins = v.get("inputs") or {}
                for name in (sch["input"].get("required") or {}):
                    if name not in ins:
                        nerr.setdefault(str(nid), {"errors": []})["errors"].append(
                            {"message": f"Required input is missing {name}",
                             "details": name,
                             "extra_info": {"input_name": name}})
            for nid, v in g.items():                   # 2.401.5: the real schemas' checks
                if isinstance(v, dict):
                    for e in ltx25_validate(v):
                        nerr.setdefault(str(nid), {"errors": [], "class_type": v.get("class_type")})["errors"].append(e)
            if nerr:
                return self._j({"error": {
                    "type": "prompt_outputs_failed_validation",
                    "message": "Prompt outputs failed validation"},
                    "node_errors": nerr}, 400)
            pid = uuid.uuid4().hex
            threading.Timer(1.0, render, args=(pid, g)).start()
            return self._j({"prompt_id": pid})
        self._j({"error": "nf"}, 404)

# 2.401.5, faithful-mock rule (Tim's LTX run: "ResizeImageMaskNode.execute() missing 1 required positional argument:
# 'resize_type'"): the core classes Comfy-Org's LTX 2.5 templates use answer with what a REAL ComfyUI (master,
# 2026-10-09) answered - scripts/fixtures/ltx25_object_info.json, V3 dynamic combos and all - and a queued graph is
# checked against them the way ComfyUI's validate_inputs does (checked against that server: required present; a
# MISSING dynamic combo is not refused - SaveVideo runs without format.codec - but a given one's option inputs are
# required; a fixed combo's value in its list). Loader file lists stay folder scans (below).
try:
    LTX25_REAL = json.loads((Path(__file__).resolve().parent / "fixtures" / "ltx25_object_info.json").read_text(encoding="utf-8"))
except Exception:                                          # noqa: BLE001
    LTX25_REAL = {}
LTX25_FOLDERS = {("UNETLoader", "unet_name"): ["unet", "diffusion_models"], ("VAELoader", "vae_name"): ["vae"],
                 ("CLIPLoader", "clip_name"): ["text_encoders", "clip"],
                 ("LatentUpscaleModelLoader", "model_name"): ["latent_upscale_models"],
                 ("LoraLoaderModelOnly", "lora_name"): ["loras"], ("UnetLoaderGGUF", "unet_name"): ["unet"],
                 # 2.402.0: LTX 2.3 - one checkpoint (+ its audio VAE / text-encoder side), the Gemma 3 encoder
                 ("CheckpointLoaderSimple", "ckpt_name"): ["checkpoints"], ("LTXVAudioVAELoader", "ckpt_name"): ["checkpoints"],
                 ("LTXAVTextEncoderLoader", "ckpt_name"): ["checkpoints"], ("LTXAVTextEncoderLoader", "text_encoder"): ["text_encoders"],
                 ("LoraLoader", "lora_name"): ["loras"]}


LTX25_EXEC_NEEDS = {"ResizeImageMaskNode": ["resize_type"]}   # dynamic combos the class's execute() cannot do without
# 2.402.0: two classes the fixture holds (LTX 2.3) but the stub keeps answering the OLD way: the image / ControlNet /
# face-fix / infill legs load checkpoints and LoRAs by names that are deliberately not on disk, and a listed answer
# changes what those workers choose. Their real shapes are covered by scripts/test-ltx23.py against the fixture.
LTX25_NOT_SERVED = {"CheckpointLoaderSimple", "LoraLoader"}


def ltx25_schema(ct):
    """The real schema with file combos rescanned from the stub's models root."""
    sc = json.loads(json.dumps(LTX25_REAL.get(ct) or {}))
    for (c, k), sub in LTX25_FOLDERS.items():
        if c == ct and k in ((sc.get("input") or {}).get("required") or {}):
            sc["input"]["required"][k] = [_folder_combo(sub, [])]
    if ct == "LoadImage" and "image" in ((sc.get("input") or {}).get("required") or {}):
        # ComfyUI lists its input folder: what was uploaded + its own example.png
        sc["input"]["required"]["image"] = [sorted(set(UPLOADED) | {"example.png"}), {"image_upload": True}]
    return sc


def _combo_opts(spec):
    t = spec[0] if isinstance(spec, list) and spec else None
    if isinstance(t, list):
        return t
    o = spec[1] if isinstance(spec, list) and len(spec) > 1 and isinstance(spec[1], dict) else {}
    return o.get("options") if t == "COMBO" and isinstance(o.get("options"), list) else None


def ltx25_validate(v):
    """[error dicts] for one API node of a class the fixture knows - ComfyUI's own messages."""
    ct = str(v.get("class_type") or "")
    if ct not in LTX25_REAL or ct in ("ComfyMathExpression",) or ct in core_schemas() or ct in SCHEMA or ct in LTX25_NOT_SERVED:
        return []                       # (the core loaders keep their own presence check)
    sc = ltx25_schema(ct)
    ins = v.get("inputs") or {}
    errs = []

    def need(prefix, group, req):
        for name, spec in (group or {}).items():
            key = f"{prefix}{name}"
            t0 = spec[0] if isinstance(spec, list) and spec else None
            if key not in ins and isinstance(t0, str) and "DYNAMICCOMBO" in t0:
                # a real ComfyUI does NOT refuse a missing dynamic combo (checked: SaveVideo without format.codec runs);
                # the node's own execute() may - ResizeImageMaskNode does, Tim's exact error, refused here up front
                if ct in LTX25_EXEC_NEEDS and key in LTX25_EXEC_NEEDS[ct]:
                    errs.append({"message": f"{ct}.execute() missing 1 required positional argument: '{key}'",
                                 "details": key, "extra_info": {"input_name": key}})
                continue
            if key not in ins:
                if req:
                    errs.append({"message": "Required input is missing", "details": key, "extra_info": {"input_name": key}})
                continue
            val = ins[key]
            if isinstance(val, list) and len(val) == 2 and isinstance(val[1], int):
                continue                                    # linked
            t = spec[0] if isinstance(spec, list) and spec else None
            if isinstance(t, str) and "DYNAMICCOMBO" in t:
                opts = (spec[1] or {}).get("options") or []
                hit = next((o for o in opts if str(o.get("key")) == str(val)), None)
                if not hit:
                    errs.append({"message": "Value not in list", "details": f"{key}: '{val}' not in {[o.get('key') for o in opts]}",
                                 "extra_info": {"input_name": key, "received_value": val}})
                    continue
                need(f"{key}.", (hit.get("inputs") or {}).get("required"), True)
                need(f"{key}.", (hit.get("inputs") or {}).get("optional"), False)
                continue
            co = _combo_opts(spec)
            # a FILE combo (a loader's folder scan, LoadImage's input folder) is not checked here: the e2e's image /
            # swap legs name files that are deliberately not on disk, and the worker's own preflight owns that rule
            if (ct, key) in LTX25_FOLDERS or (ct, key) in (("LoadImage", "image"), ("LoadVideo", "file")):
                co = None
            if co is not None and co and val not in co and str(val) not in [str(x) for x in co]:
                errs.append({"message": "Value not in list", "details": f"{key}: '{val}' not in {co[:8]}",
                             "extra_info": {"input_name": key, "received_value": val}})
            elif t == "INT" and not isinstance(val, int):
                try:
                    int(val)
                except (TypeError, ValueError):
                    errs.append({"message": "Failed to convert an input value to a INT value",
                                 "details": f"{key}, {val}", "extra_info": {"input_name": key, "received_value": val}})
    need("", (sc.get("input") or {}).get("required"), True)
    need("", (sc.get("input") or {}).get("optional"), False)
    return errs


# 2.404.0: image -> 3D. Comfy-Org's Hunyuan3D 2.1 / TRELLIS.2 classes as a REAL ComfyUI (master, 2026-10-09) answers
# them (scripts/fixtures/mesh3d_object_info.json), served and checked like the LTX ones; the loaders list their folders.
try:
    for _c, _v in json.loads((Path(__file__).resolve().parent / "fixtures" / "mesh3d_object_info.json").read_text(encoding="utf-8")).items():
        LTX25_REAL.setdefault(_c, _v)
except Exception:                                          # noqa: BLE001
    pass
LTX25_FOLDERS.update({("ImageOnlyCheckpointLoader", "ckpt_name"): ["checkpoints"],
                      ("LoadBackgroundRemovalModel", "bg_removal_name"): ["background_removal"],
                      ("LoadMoGeModel", "model_name"): ["geometry_estimation"]})


def _glb_cube(size=1.0, color=None):
    """a valid binary glTF 2.0: one cube mesh (positions + indices [+ a vertex colour]), y up, its base at 0"""
    import struct
    h = size / 2.0
    pos = [(-h, 0, -h), (h, 0, -h), (h, size, -h), (-h, size, -h), (-h, 0, h), (h, 0, h), (h, size, h), (-h, size, h)]
    idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3]
    pb = b"".join(struct.pack("<3f", *p) for p in pos)
    ib = b"".join(struct.pack("<H", i) for i in idx)
    cb = b"".join(struct.pack("<4f", *(color or (0.8, 0.8, 0.8)), 1.0) for _ in pos) if color else b""
    pad = lambda b, c=b"\0": b + c * ((4 - len(b) % 4) % 4)          # noqa: E731
    binb = pad(pb) + pad(ib) + cb
    views = [{"buffer": 0, "byteOffset": 0, "byteLength": len(pb)}, {"buffer": 0, "byteOffset": len(pad(pb)), "byteLength": len(ib)}]
    acc = [{"bufferView": 0, "componentType": 5126, "count": 8, "type": "VEC3", "min": [-h, 0, -h], "max": [h, size, h]},
           {"bufferView": 1, "componentType": 5123, "count": len(idx), "type": "SCALAR"}]
    attrs = {"POSITION": 0}
    if color:
        views.append({"buffer": 0, "byteOffset": len(pad(pb)) + len(pad(ib)), "byteLength": len(cb)})
        acc.append({"bufferView": 2, "componentType": 5126, "count": 8, "type": "VEC4"})
        attrs["COLOR_0"] = 2
    gj = {"asset": {"version": "2.0", "generator": "bitGen stub-comfy"}, "scene": 0, "scenes": [{"nodes": [0]}],
          "nodes": [{"mesh": 0, "name": "mesh"}], "meshes": [{"primitives": [{"attributes": attrs, "indices": 1}]}],
          "buffers": [{"byteLength": len(binb)}], "bufferViews": views, "accessors": acc}
    jb = pad(json.dumps(gj).encode("utf-8"), b" ")
    body = struct.pack("<II", len(jb), 0x4E4F534A) + jb + struct.pack("<II", len(binb), 0x004E4942) + binb
    return struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body


def render_mesh(pid, g):
    """2.404.0: an image-to-3D graph, answered like ComfyUI would: the LoadImage must name an uploaded picture, the
    Hunyuan path a CLIP-vision encode of it, the TRELLIS path its texture stage; SaveGLB writes a .glb (a cube - grey
    for Hunyuan's shape, coloured for TRELLIS's texture) under its prefix, reported under "3d"."""
    def err(nid, ct, msg):
        JOBS[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
            ["execution_start", {"prompt_id": pid, "timestamp": 1}],
            ["execution_error", {"prompt_id": pid, "node_id": str(nid), "node_type": ct, "exception_type": "ValueError",
                                 "exception_message": msg, "traceback": ["  File \"comfy_extras/nodes_hunyuan3d.py\""]}]]},
            "outputs": {}}
    li = next(((k, v) for k, v in g.items() if v.get("class_type") == "LoadImage"), (None, None))
    f = ((li[1] or {}).get("inputs") or {}).get("image")
    if not isinstance(f, str) or f not in UPLOADED:
        return err(li[0] or "?", "LoadImage", f"Invalid image file: {f}")
    classes = sorted({str(v.get("class_type", "")) for v in g.values()})
    trellis = "Trellis2TextureStage" in classes
    if not trellis and "Hunyuan3Dv2Conditioning" not in classes:
        return err("?", "SaveGLB", "not an image-to-3D graph")
    sid, sv = next((k, v) for k, v in g.items() if v.get("class_type") == "SaveGLB")
    prefix = str((sv.get("inputs") or {}).get("filename_prefix") or "3d/ComfyUI")
    sub, stem = (prefix.rsplit("/", 1) if "/" in prefix else ("", prefix))
    fn = f"{stem}_{pid[:6]}_00001_.glb"
    (OUT / fn).write_bytes(_glb_cube(1.0, (0.2, 0.6, 0.3) if trellis else None))
    rec = {"_classes": classes, "_image": f, "_engine": "trellis" if trellis else "hunyuan",
           "_seeds": sorted(int((v.get("inputs") or {}).get("seed")) for v in g.values() if v.get("class_type") == "KSampler"),
           "_files": {k: v for n in g.values() for k, v in (n.get("inputs") or {}).items()
                      if k in ("ckpt_name", "unet_name", "vae_name", "clip_name", "bg_removal_name")} }
    Path(OUT / f"mesh_{pid}.json").write_text(json.dumps(rec), encoding="utf-8")
    JOBS[pid] = {"status": {"status_str": "success", "completed": True},
                 "outputs": {str(sid): {"3d": [{"filename": fn, "subfolder": sub, "type": "output"}],
                                        "camera_info": [None], "model_3d_info": []}}}


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
