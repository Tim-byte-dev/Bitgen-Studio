#!/usr/bin/env python3
"""bitGen Studio — 3.16.1: a umT5 text encoder with no tokenizer inside (scripts/te_tokenizer.py, the LongCat / Wan workers,
comfy_client's explanation). Tim's log: LongCat Avatar 1.6 -> CLIPLoader nsfw_wan_umt5-xxl_bf16.safetensors -> "invalid tokenizer"."""
import json
import os
import struct
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import te_tokenizer as T  # noqa: E402
import comfy_client as CC  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + repr(got)[:600]))


def st(path, names):
    h = {n: {"dtype": "U8", "shape": [1], "data_offsets": [0, 1]} for n in names}
    h["__metadata__"] = {"format": "pt"}
    b = json.dumps(h).encode()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(struct.pack("<Q", len(b)) + b + b"\0")


tmp = Path(tempfile.mkdtemp())
app = tmp / "Bitgen-Studio"
comfy = app / "ComfyUI"
te = comfy / "models" / "text_encoders"
st(te / "nsfw_wan_umt5-xxl_bf16.safetensors", ["encoder.block.0.weight", "shared.weight"])
st(te / "umt5-xxl-enc-bf16.safetensors", ["encoder.block.0.weight"])
st(te / "wan" / "umt5_xxl_fp16.safetensors", ["encoder.block.0.weight", "spiece_model"])
shared = tmp / "lib" / "te"
st(shared / "umt5_xxl_fp8_e4m3fn_scaled.safetensors", ["encoder.block.0.weight", "spiece_model", "scaled_fp8"])
(comfy / "extra_model_paths.yaml").write_text(f"""
mine:
    base_path: {tmp / 'lib'}
    text_encoders: |
        te
        nowhere
    checkpoints: ckpt
""", encoding="utf-8")
cfg = {"engine": {"comfy": {"dir": str(comfy)}}}

check("keys: the tensor names of a .safetensors header (not __metadata__)", T.keys(te / "wan" / "umt5_xxl_fp16.safetensors") == {"encoder.block.0.weight", "spiece_model"})
check("has_tokenizer: Comfy-Org's file yes, a weights-only copy no, a .gguf / a missing file: cannot tell",
      T.has_tokenizer(te / "wan" / "umt5_xxl_fp16.safetensors") is True and T.has_tokenizer(te / "nsfw_wan_umt5-xxl_bf16.safetensors") is False
      and T.has_tokenizer(te / "x.gguf") is None and T.has_tokenizer(te / "gone.safetensors") is None)
dirs = T.model_dirs(cfg, app)
check("model_dirs: ComfyUI's models/text_encoders + extra_model_paths.yaml's (a '|' block)", str(te) in dirs and str(shared) in dirs, dirs)
check("model_dirs: no Settings folder - the ComfyUI beside the app", str(te) in T.model_dirs({}, app))
check("resolve: a dropdown name with its subfolder (either slash) -> the file here", T.resolve("wan\\umt5_xxl_fp16.safetensors", dirs).endswith("umt5_xxl_fp16.safetensors") and T.resolve("nope.safetensors", dirs) == "")
names = ["nsfw_wan_umt5-xxl_bf16.safetensors", "umt5-xxl-enc-bf16.safetensors", "wan\\umt5_xxl_fp16.safetensors", "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "clip_l.safetensors"]
r = T.choose(names, "nsfw_wan_umt5-xxl_bf16.safetensors", cfg, app)
check("Tim's case: the bf16 copy with no tokenizer is swapped for one that has it (Comfy-Org's names first), and it is said",
      r["te"] in ("wan\\umt5_xxl_fp16.safetensors", "umt5_xxl_fp8_e4m3fn_scaled.safetensors") and "no tokenizer" in r["note"] and "invalid tokenizer" in r["note"] and not r["error"], r)
check("a picked file that has it: kept, nothing said", T.choose(names, "umt5_xxl_fp8_e4m3fn_scaled.safetensors", cfg, app) == {"te": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "note": "", "error": ""})
check("a remote ComfyUI (the file not here): kept - nothing to tell", T.choose(names, "nsfw_wan_umt5-xxl_bf16.safetensors", {"engine": {"comfy": {"dir": str(tmp / 'nowhere')}}}, tmp / "x")["te"] == "nsfw_wan_umt5-xxl_bf16.safetensors")
r2 = T.choose(names[:2], "nsfw_wan_umt5-xxl_bf16.safetensors", cfg, app)
check("only weights-only umT5s listed: an error naming the file to download", r2["te"] == "" and "umt5_xxl_fp8_e4m3fn_scaled" in r2["error"] and "Download" in r2["error"], r2)
msgs = [["execution_error", {"node_type": "CLIPLoader", "exception_message": "invalid tokenizer\n", "exception_type": "ValueError"}]]
ex = CC.explain_execution_error(msgs)
check("ComfyUI's bare 'invalid tokenizer' gets an explanation and the fix", "no tokenizer inside" in ex and "umt5_xxl_fp8_e4m3fn_scaled" in ex, ex)
for w in ("misc/longcat_worker.py", "misc/wan_worker.py"):
    src = (ROOT / w).read_text(encoding="utf-8")
    check(f"{w}: the picked text encoder goes through te_tokenizer.choose (fail on its error, say its note)", "_tt.choose(" in src and 'fail(tc["error"])' in src)
print(f"\n{P} passed, {F} failed")
print(f"RESULT: {F} failed")
sys.exit(1 if F else 0)
