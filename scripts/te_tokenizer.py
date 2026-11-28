"""te_tokenizer.py — does a umT5 / T5 text encoder file carry its TOKENIZER? (3.16.1)

Tim's log: LongCat Avatar 1.6 -> CLIPLoader "nsfw_wan_umt5-xxl_bf16.safetensors" -> ComfyUI: "ValueError: invalid tokenizer".
WHY: ComfyUI's umT5 (type "wan") takes its sentencepiece tokenizer from INSIDE the text-encoder file - the tensor
"spiece_model" (comfy/text_encoders/wan.py: tokenizer_data.get("spiece_model")). Comfy-Org's repackaged files carry it
(umt5_xxl_fp16 / umt5_xxl_fp8_e4m3fn_scaled). Files made for other loaders (Kijai's WanVideoWrapper "umt5-xxl-enc-bf16",
many re-uploads / fine-tunes) carry only the weights, so ComfyUI's CLIPLoader stops with "invalid tokenizer".

    keys(path)                          the tensor names in a .safetensors header (None: not readable / not safetensors)
    has_tokenizer(path)                 True / False / None (not a .safetensors, or not found here: cannot tell)
    comfy_roots(cfg, app_base)          the ComfyUI folder(s) (Settings ▸ ComfyUI's, else one beside the app)
    model_dirs(cfg, app_base, folders)  <root>/models/<folder> + extra_model_paths.yaml's paths for those folders
    resolve(name, dirs)                 a ComfyUI dropdown name -> the file on this machine ("" when not here)
    choose(names, picked, cfg, app_base, rx, prefer) -> {te, note, error}: the picked encoder when it can be used, else
                                        another umT5 listed that carries its tokenizer; none -> error (what to download)
Pure (Python 3, no packages): scripts/test-tetok-31601.py.
"""
import json
import os
import re
import struct
from pathlib import Path

TOKENIZER_KEY = "spiece_model"
DOWNLOAD = ("umt5_xxl_fp8_e4m3fn_scaled.safetensors (Comfy-Org/Wan_2.1_ComfyUI_repackaged, 6.7 GB) - "
            "Models ▸ LongCat Avatar ▸ umT5-XXL text encoder, or the Wan 2.1 models")


def keys(path, limit=256 * 1024 * 1024):
    try:
        with open(path, "rb") as f:
            head = f.read(8)
            if len(head) < 8:
                return None
            n = struct.unpack("<Q", head)[0]
            if n <= 0 or n > limit:
                return None
            data = json.loads(f.read(n).decode("utf-8"))
        return set(k for k in data.keys() if k != "__metadata__") if isinstance(data, dict) else None
    except Exception:
        return None


def has_tokenizer(path):
    p = str(path or "")
    if not p.lower().endswith(".safetensors") or not os.path.isfile(p):
        return None
    k = keys(p)
    if k is None:
        return None
    return TOKENIZER_KEY in k


def comfy_roots(cfg, app_base):
    d = str((((cfg or {}).get("engine") or {}).get("comfy") or {}).get("dir") or "").strip()
    app = Path(app_base or ".")
    cands = [Path(d) if os.path.isabs(d) else app / d] if d else [app / "ComfyUI", app / "comfy", app.parent / "ComfyUI",
                                                                    app.parent / "ComfyUI_windows_portable"]
    out = []
    for p in cands:
        for r in (p, p / "ComfyUI"):
            if (r / "models").is_dir() and str(r) not in out:
                out.append(str(r))
    return out


def _yaml_paths(text, folders):
    """the subset of extra_model_paths.yaml that matters: per section its base_path and the (one or several, '|' block)
    paths given for each wanted folder -> [path]"""
    out, base, sect, key, block, kind = [], "", None, None, False, 0
    entries = []
    for raw in (text or "").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        ind = len(line) - len(line.lstrip())
        s = line.strip()
        if ind == 0 and s.endswith(":"):
            sect, base, key, block = s[:-1], "", None, False
            continue
        if block and key and ind > kind:                 # a line of a '|' block (a Windows path has a ':' in it too)
            entries.append((sect, key, s.strip("'\"")))
            continue
        block = False
        m = re.match(r"([\w-]+)\s*:\s*(.*)$", s)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip().strip("'\"")
        if k == "base_path":
            base = v
            entries.append((sect, "__base__", v))
        elif v in ("|", ">", "|-", ">-"):
            key, block, kind = k, True, ind
        else:
            key = k
            entries.append((sect, k, v))
    bases = {}
    for sect, k, v in entries:
        if k == "__base__":
            bases[sect] = v
    for sect, k, v in entries:
        if k in folders:
            b = bases.get(sect, "")
            out.append(v if (os.path.isabs(v) or not b) else os.path.join(b, v))
    return out


def model_dirs(cfg, app_base, folders=("text_encoders", "clip")):
    out = []
    for r in comfy_roots(cfg, app_base):
        for f in folders:
            p = os.path.join(r, "models", f)
            if os.path.isdir(p) and p not in out:
                out.append(p)
        for y in ("extra_model_paths.yaml", "extra_models_config.yaml"):
            yp = os.path.join(r, y)
            if os.path.isfile(yp):
                try:
                    txt = Path(yp).read_text(encoding="utf-8", errors="replace")
                except Exception:
                    txt = ""
                for p in _yaml_paths(txt, folders):
                    p = os.path.expanduser(p if os.path.isabs(p) else os.path.join(r, p))
                    if os.path.isdir(p) and p not in out:
                        out.append(p)
    return out


def resolve(name, dirs):
    rel = str(name or "").replace("\\", "/").lstrip("/")
    if not rel:
        return ""
    for d in dirs or []:
        p = os.path.join(d, *rel.split("/"))
        if os.path.isfile(p):
            return p
    return ""


def _base(n):
    return str(n or "").replace("\\", "/").split("/")[-1].lower()


def choose(names, picked, cfg, app_base, rx=r"umt5", prefer=("fp16", "bf16", "fp8", "int8"), dirs=None):
    """-> {te, note, error}. The picked file is kept when it carries its tokenizer or when that cannot be told here (a remote
    ComfyUI, a .gguf); a file that does NOT is swapped for another listed one that does - Comfy-Org's repackaged names first"""
    dirs = model_dirs(cfg, app_base) if dirs is None else dirs
    tok = lambda n: has_tokenizer(resolve(n, dirs))
    if not picked or tok(picked) is not False:
        return {"te": picked, "note": "", "error": ""}
    names = [str(n) for n in (names or []) if str(n) != picked and re.search(rx, _base(n))]
    order = sorted(names, key=lambda n: (0 if re.match(r"umt5[-_]xxl[-_](fp16|fp8|bf16)", _base(n)) else 1,
                                         next((i for i, p in enumerate(prefer) if p in _base(n)), len(prefer))))
    sure = [n for n in order if tok(n) is True]
    maybe = [n for n in order if tok(n) is None]
    why = (f"{_base(picked)} has no tokenizer inside (it is a weights-only copy, e.g. for WanVideoWrapper) - ComfyUI's "
           f"text-encoder loader stops on it with 'invalid tokenizer'")
    if sure or maybe:
        alt = (sure or maybe)[0]
        return {"te": alt, "note": f"{why}; using {alt} instead", "error": ""}
    return {"te": "", "note": "", "error": f"{why}, and ComfyUI lists no other umT5 text encoder that has one. Download {DOWNLOAD}"}


INVALID_TOKENIZER_ADVICE = (
    "\n\n[worker] 'invalid tokenizer': the TEXT ENCODER file has no tokenizer inside. ComfyUI's umT5 / T5 loader reads"
    "\n[worker] the tokenizer from the file itself (the tensor 'spiece_model'); weights-only copies (Kijai's"
    "\n[worker] 'umt5-xxl-enc-bf16', many re-uploads and fine-tunes) do not carry it."
    "\n[worker] Fix: use Comfy-Org's umt5_xxl_fp8_e4m3fn_scaled.safetensors or umt5_xxl_fp16.safetensors"
    "\n[worker] (Comfy-Org/Wan_2.1_ComfyUI_repackaged, split_files/text_encoders) - set it as the style's text encoder,"
    "\n[worker] or move the other file out of ComfyUI's text_encoders folder.")
