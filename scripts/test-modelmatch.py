#!/usr/bin/env python3
"""bitGen Studio — 2.345.0: a workflow's model file -> the name THIS ComfyUI lists.
Run: python3 scripts/test-modelmatch.py

Tim's LTX Ripple run: "node 821: Value not in list [unet_name] =
ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors ... not in
(list of length 37)" - his file lives under another path. scripts/model_match
.best + its use in ripple_worker (every loader) and viggle_worker (pick)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import model_match as MM  # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:400]))


W = "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors"
UNET = r"ltx.?2\.?5.*(22b|19b|transformer|distilled|dev)"
check("the same file in a subfolder (Tim's case) -> ComfyUI's own name",
      MM.best(["flux1-dev.safetensors", "LTX\\" + W], W, UNET) == ("LTX\\" + W, "subfolder"))
check("listed as asked -> exact", MM.best([W, "x.safetensors"], W, UNET) == (W, "exact"))
check("not there, but an LTX 2.5 transformer is -> the closest of that kind",
      MM.best(["ltx-2.3-22b-dev.safetensors", "ltx-2.5-22b-distilled-fp8.safetensors", "ltx-2.5-22b-dev-bf16.safetensors"], W, UNET)
      == ("ltx-2.5-22b-distilled-fp8.safetensors", "similar"))
check("...never another model family (an LTX 2.3 file is not an LTX 2.5 one)", MM.best(["ltx-2.3-22b-dev.safetensors", "wan.safetensors"], W, UNET) == (None, ""))
check("no pattern -> only the same file counts", MM.best(["other.safetensors"], W) == (None, ""))
check("no list to check (an old ComfyUI) -> the workflow's own name, unchanged", MM.best([], W, UNET) == (W, "unlisted"))
R = (ROOT / "misc" / "ripple_worker.py").read_text(encoding="utf-8")
check("ripple_worker: every model loader (UNETLoader / VAELoader / VAELoaderKJ / CLIPLoader) matched, said, or refused in words",
      all(c in R for c in ('"UNETLoader": ("unet_name"', '"VAELoader": ("vae_name"', '"VAELoaderKJ": ("vae_name"', '"CLIPLoader": ("clip_name"'))
      and "name, how = MM.best(listed, want, pat)" in R and "as your ComfyUI lists it" in R and "nothing like it is in" in R)
V = (ROOT / "misc" / "viggle_worker.py").read_text(encoding="utf-8")
check("viggle_worker.pick uses the same matcher", "return MM.best(names, want, pattern)[0]" in V)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
