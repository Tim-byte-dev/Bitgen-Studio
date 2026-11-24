"""bitGen Studio — scripts/openjutsu_pick.py (2.949.0): the OpenJutsu graph's model files, from what ComfyUI lists.

lib/openjutsu.js fills OpenJutsu's workflows with OpenJutsu's own file names (the INT8 / INT4 ConvRot H3 files, the DMAD
LoRA, SAM 3.1). A machine that already renders MiniMax H3 in bitGen often has the SAME models under other names (the
NVFP4 text encoder on a Blackwell card, the fp16 video VAE): each loader whose file ComfyUI does not list is pointed at
the nearest file of that kind it does list, in words. Nothing is guessed past that - a kind with no file at all is
reported, with the add-on that installs it.

  RULES                    [(class_type, input, title regex or None, [ranked name regexes], what)]
  pick(graph, lists)       -> (changes [(node, input, old, new)], missing [(node, input, old, what)])   in place
                              lists: {(class_type, input): [names ComfyUI lists]}
Pure: no ComfyUI, no files (scripts/test-openjutsu949.py).
"""
import re

# The loaders OpenJutsu's workflows use and what can stand in for each. Ordered: the first regex that matches a listed
# name wins (int8 ConvRot first, the way OpenJutsu ships; never a Viggle / fl2va model for the ref2va swap).
RULES = [
    ("UNETLoader", "unet_name", r"^H3 Diffusion Model$",
     [r"^(?!.*viggle).*minimax_h3_ref2va_pruned_int8_convrot", r"^(?!.*viggle).*minimax_h3_ref2va.*int8",
      r"^(?!.*viggle).*minimax_h3_ref2va.*(fp8|nvfp4|int4|w4a8)", r"^(?!.*viggle).*minimax_h3_ref2va"], "the MiniMax H3 ref2va model"),
    ("LoraLoaderModelOnly", "lora_name", r"^(DMAD LoRA|LoRA \d)$",
     [r"minimax_h3_DMAD_4step_full_lora", r"DMAD.*4step", r"dmad"], "the DMAD 4-step LoRA (or turn DMAD off)"),
    ("CLIPLoader", "clip_name", r"^H3 Text Encoder$",
     [r"qwen3vl_32b_minimax_h3_int4_convrot", r"qwen3vl_32b_minimax_h3.*int8", r"qwen3vl_32b_minimax_h3.*nvfp4",
      r"qwen3vl_32b_minimax_h3"], "the MiniMax H3 text encoder (Qwen3-VL 32B)"),
    ("CLIPLoader", "clip_name", r"^Describer",
     [r"qwen3vl_8b_int8_convrot", r"qwen3vl_8b", r"qwen3vl_4b"], "the describer (Qwen3-VL 8B)"),
    ("VAELoader", "vae_name", r"^Video VAE$",
     [r"minimax_h3_video_vae_int8_convrot", r"minimax_h3_video_vae"], "the MiniMax H3 video VAE"),
    ("VAELoader", "vae_name", r"^Audio VAE$",
     [r"minimax_h3_audio_vae_fp32", r"minimax_h3_audio_vae"], "the MiniMax H3 audio VAE"),
    ("CheckpointLoaderSimple", "ckpt_name", r"^SAM 3\.1$",
     [r"sam3\.1_multiplex_fp16", r"sam3\.1_multiplex", r"sam3\.1", r"sam3"], "SAM 3.1"),
    ("SAMLoader", "model_name", None, [r"sam_vit_b_01ec64", r"sam_vit_b"], "SAM ViT-B (Fix faces)"),
    ("H3FaceTrackCrop", "detector", None, [r"face_yolov8m\.pt$", r"face_yolov8"], "the YOLOv8 face detector (Fix faces)"),
    ("H3FaceTrackCrop", "fallback_detector", None, [r"person_yolov8m-seg\.pt$", r"person_yolov8"], "the YOLOv8 person detector (Fix faces)"),
]


def norm(name):
    return str(name or "").replace("\\", "/").strip()


def _spelled(name, names):
    """ComfyUI's own spelling of a listed name, or None."""
    n = norm(name).lower()
    for x in names:
        if norm(x).lower() == n:
            return x
    return None


def _best(rule_rx, names):
    for rx in rule_rx:
        for x in names:
            if re.search(rx, norm(x), re.I):
                return x
    return None


def pick(graph, lists):
    changes, missing = [], []
    for nid, node in (graph or {}).items():
        ct = node.get("class_type")
        title = ((node.get("_meta") or {}).get("title")) or ""
        for (cls, key, trx, rxs, what) in RULES:
            if cls != ct or (trx and not re.search(trx, title)):
                continue
            inputs = node.setdefault("inputs", {})
            old = inputs.get(key)
            if not isinstance(old, str) or old in ("", "none"):
                continue
            names = lists.get((cls, key))
            if names is None:                               # ComfyUI did not say: leave it
                continue
            own = _spelled(old, names)
            if own is not None:                             # listed - in ComfyUI's own spelling (bbox\\ vs bbox/)
                if own != old:
                    inputs[key] = own
                    changes.append((nid, key, old, own))
                continue
            new = _best(rxs, names)
            if new:
                inputs[key] = new
                changes.append((nid, key, old, new))
            else:
                missing.append((nid, key, old, what))
    return changes, missing
