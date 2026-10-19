#!/usr/bin/env python3
"""Image generation: the sd-cli argument side.

Reads lib/imageArch.json — the SAME catalogue lib/styles.js validates against
and the Settings UI builds its Architecture dropdown from — so a style saved in
the UI and the command line that renders it cannot disagree about which flag a
text encoder is passed with.

This module is PURE STRING BUILDING with no subprocess and no filesystem
requirement beyond reading the catalogue, which is what makes it unit-testable
(scripts/test-imagegen.py) without a GPU, without sd-cli and without a model.
image_worker.py does the running; this file only decides what to run.

WHY A SEPARATE FILE FROM worker.py's build_command(): video and image share an
executable and nothing else. vid_gen carries the 4n+1 frame grid, the 361-frame
ceiling, --video-frames, --audio-vae, --cfg-scale 1.0 and --mode vid_gen, and
EVERY ONE of those is wrong for a still image. Keeping them apart means a change
to image defaults can never perturb a video render.
"""
import json
import os

CATALOGUE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "lib", "imageArch.json")
_cache = None


def catalogue():
    global _cache
    if _cache is None:
        with open(os.path.normpath(CATALOGUE), "r", encoding="utf-8") as fh:
            _cache = json.load(fh)
    return _cache


def archs():
    return catalogue()["archs"]


def arch_by_id(aid):
    for a in archs():
        if a["id"] == aid:
            return a
    return None


def _num(v, default=None):
    """A number if one was PRESENT, else the default.

    `v or default` is the bug this exists to avoid: it turns a legitimate 0
    (clip_skip 0, cfg 0, LoRA weight 0) into the default silently. Presence is
    the question, not truthiness — same fix as numOrNull() in lib/timelineSpan.js.
    """
    if v is None or v is False or v == "":
        return default
    try:
        n = float(v)
    except (TypeError, ValueError):
        return default
    if n != n or n in (float("inf"), float("-inf")):   # NaN / inf
        return default
    return n


def _int(v, default=None):
    n = _num(v, None)
    return default if n is None else int(n)


def lora_tokens(loras):
    """`<lora:name:weight>` tokens for sd.cpp's webui-style LoRA syntax.

    sd.cpp resolves the NAME against --lora-model-dir, so the token carries the
    file's stem, never its full path. A weight of 0 is a real instruction
    ("this LoRA off, but keep it in the stack") and must survive: see _num().
    """
    out = []
    for l in loras or []:
        p = str((l or {}).get("path") or "").strip()
        if not p:
            continue
        stem = os.path.splitext(os.path.basename(p.replace("\\", "/")))[0]
        if not stem:
            continue
        w = _num((l or {}).get("weight"), 1.0)
        out.append("<lora:%s:%g>" % (stem, w))
    return out


def prompt_with_loras(prompt, loras):
    toks = lora_tokens(loras)
    text = str(prompt or "").strip()
    if not toks:
        return text
    return (text + " " + " ".join(toks)).strip()


def missing_slots(style):
    """Human-readable list of required-but-empty fields for this style's arch.

    Returned rather than raised so the caller decides whether it is a hard fail
    (the worker) or a warning (the settings UI, where a half-filled style is a
    perfectly normal intermediate state).
    """
    a = arch_by_id(str((style or {}).get("arch") or ""))
    if a is None:
        return ["unknown architecture: %r" % (style or {}).get("arch")]
    miss = []
    if not str(style.get("model") or "").strip():
        miss.append("model")
    if a["vae"].get("required") and not str(style.get("vae") or "").strip():
        miss.append("VAE")
    te = style.get("te") or []
    for i, slot in enumerate(a["te"]):
        got = str((te[i] if i < len(te) else "") or "").strip()
        if slot.get("required") and not got:
            miss.append(slot["label"])
    return miss


def build_image_command(params, cfg, style, out_path):
    """The full sd-cli argv for one image.

    params: {prompt, negative?, width?, height?, steps?, cfg?, clip_skip?,
             sampler?, seed?, extra_args?}   (all optional bar prompt —
             anything absent falls back to the style, then to the arch default)
    style:  a normalized style dict from lib/styles.js
    """
    a = arch_by_id(str((style or {}).get("arch") or ""))
    if a is None:
        raise ValueError("unknown image architecture: %r" % (style or {}).get("arch"))
    if a.get("comfy_only"):          # 2.502.0: FLUX 3 Klein - no sd.cpp support yet
        raise ValueError("%s renders through ComfyUI only - set the style's engine to ComfyUI" % a.get("label", a["id"]))
    d = a["defaults"]

    def pick(key, fallback=None):
        """params -> style -> arch default. Presence, not truthiness."""
        v = _num(params.get(key), None)
        if v is None:
            v = _num((style or {}).get(key), None)
        if v is None:
            v = _num(d.get(key), fallback)
        return v

    extra = str(params.get("extra_args") or (style or {}).get("extra_args") or "").strip()
    extra_tokens = extra.split()

    mode_flag = (((cfg or {}).get("flags") or {}).get("image_mode")
                 or "--mode img_gen").split()

    argv = [cfg["sd_cli"], *mode_flag,
            a["model_flag"], style["model"]]

    vae = str((style or {}).get("vae") or "").strip()
    if vae:
        argv += [a["vae"]["flag"], vae]

    te = (style or {}).get("te") or []
    for i, slot in enumerate(a["te"]):
        got = str((te[i] if i < len(te) else "") or "").strip()
        if got:
            argv += [slot["flag"], got]

    argv += ["--prompt", prompt_with_loras(params.get("prompt"), (style or {}).get("loras"))]

    # A negative prompt on a distilled, cfg-1.0 architecture does nothing at
    # best; pass it only where the architecture actually uses one.
    if a.get("negative"):
        neg = str(params.get("negative") or (style or {}).get("negative") or "").strip()
        if neg:
            argv += ["--negative-prompt", neg]

    argv += ["--width", str(int(pick("width", 1024))),
             "--height", str(int(pick("height", 1024))),
             "--steps", str(int(pick("steps", 20))),
             "--cfg-scale", "%g" % pick("cfg", 7.0)]

    # clip_skip: -1 means "let sd.cpp decide" and is the sane default for the
    # flux/qwen family. 0 is a REAL value, so only a genuinely absent setting
    # is skipped.
    cs = _int(params.get("clip_skip"), None)
    if cs is None:
        cs = _int((style or {}).get("clip_skip"), None)
    if cs is None:
        cs = _int(d.get("clip_skip"), None)
    if cs is not None and cs >= 0:
        argv += ["--clip-skip", str(cs)]

    sampler = (str(params.get("sampler") or (style or {}).get("sampler") or "").strip()
               or d.get("sampler"))
    if sampler and "--sampling-method" not in extra_tokens:
        argv += ["--sampling-method", sampler]

    seed = _int(params.get("seed"), -1)
    argv += ["--seed", str(seed)]

    lora_dir = (cfg or {}).get("lora_dir")
    if lora_dir and (style or {}).get("loras"):
        argv += ["--lora-model-dir", lora_dir]

    # Architecture-mandated extras (e.g. qwen-image's --flow-shift 3), skipped
    # when the user already set that flag themselves — same "do not fight the
    # user's own args" rule build_command() uses for --backend and --cache-mode.
    for i in range(0, len(a.get("extra") or []), 2):
        pair = a["extra"][i:i + 2]
        if pair and pair[0] not in extra_tokens:
            argv += pair

    gpu = (cfg or {}).get("gpu") or {}
    if gpu.get("vae_tiling") and "--vae-tiling" not in extra_tokens:
        argv += ["--vae-tiling"]
    if gpu.get("offload_cpu"):
        off = (((cfg or {}).get("flags") or {}).get("offload_cpu") or "--offload-to-cpu")
        if off.split()[0] not in extra_tokens:
            argv += off.split()

    argv += ["--output", str(out_path)]
    if extra_tokens:
        argv += extra_tokens
    return argv
