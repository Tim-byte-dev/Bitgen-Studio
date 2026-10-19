#!/usr/bin/env python3
"""comfy_client repairs (2.209.0, Tim's hardware card): carry_loader_names —
a swapped sibling inherits model filenames from the style's PROVEN own
workflow — and fill_required_inputs — required inputs the export predates,
filled from the server's own declared defaults, never guessed.
Run from repo root: python3 scripts/test-comfyrepair.py"""
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comfy_client as cc  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    if cond:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name}  {extra}")
        FAILED.append(name)


# ---- carry_loader_names --------------------------------------------------
SIB = {
    "70": {"class_type": "UNETLoader",
           "inputs": {"unet_name": "flux-2-klein-base-9b-fp8.safetensors",
                      "weight_dtype": "default"}},
    "71": {"class_type": "CLIPLoader",
           "inputs": {"clip_name": "qwen_3_8b_fp8mixed.safetensors"}},
    "101": {"class_type": "LoraLoader", "inputs": {"lora_name": "sib.safetensors"}},
    "_comment": "not a node",
}
OWN = {
    "70": {"class_type": "UNETLoader",
           "inputs": {"unet_name": "flux-2-klein-9b-fp8.safetensors",
                      "weight_dtype": "fp8_e4m3fn"}},
    "71": {"class_type": "CLIPLoader",
           "inputs": {"clip_name": "qwen_3_8b_fp8mixed.safetensors"}},
    "101": {"class_type": "LoraLoader", "inputs": {"lora_name": ""}},
}

g = copy.deepcopy(SIB)
out = cc.carry_loader_names(g, copy.deepcopy(OWN))
check("the sibling's baked unet_name is replaced by the own workflow's proven one — Tim's exact card",
      g["70"]["inputs"]["unet_name"] == "flux-2-klein-9b-fp8.safetensors"
      and ("70", "unet_name",
           "flux-2-klein-base-9b-fp8.safetensors",
           "flux-2-klein-9b-fp8.safetensors") in out, out)
check("an already-matching name is NOT reported (clip_name equal on both sides)",
      not any(k == "clip_name" for _, k, _o, _n in out), out)
check("weight_dtype is not a model file and is left alone",
      g["70"]["inputs"]["weight_dtype"] == "default")
check("LoraLoader is never touched — LoRA slots belong to the style patcher",
      g["101"]["inputs"]["lora_name"] == "sib.safetensors")

g = copy.deepcopy(SIB)
donor2 = copy.deepcopy(OWN)
donor2["75"] = {"class_type": "UNETLoader", "inputs": {"unet_name": "other.safetensors"}}
out = cc.carry_loader_names(g, donor2)
check("same-id + same-class donor wins even when a second same-class node exists",
      g["70"]["inputs"]["unet_name"] == "flux-2-klein-9b-fp8.safetensors", out)

g = copy.deepcopy(SIB)
g["77"] = g.pop("70")   # different id — donor has TWO UNETLoaders, no id match
out = cc.carry_loader_names(g, donor2)
check("two same-class donor candidates with no id match = ambiguity, node left alone",
      g["77"]["inputs"]["unet_name"] == "flux-2-klein-base-9b-fp8.safetensors", out)
check("a missing or invalid donor changes nothing and never raises",
      cc.carry_loader_names(copy.deepcopy(SIB), None) == []
      and cc.carry_loader_names(copy.deepcopy(SIB), {}) == [])

# ---- fill_required_inputs (object_info monkeypatched) --------------------
SPECS = {
    "ImageScaleToTotalPixels": {"input": {"required": {
        "image": ["IMAGE"],
        "upscale_method": [["nearest-exact", "bilinear"]],
        "megapixels": ["FLOAT", {"default": 1.0}],
        "resolution_steps": ["INT", {"default": 64, "min": 1}],
    }}},
    "PickyNode": {"input": {"required": {
        "mode": [["fast", "slow"]],                 # combo, no default
        "mystery": ["STRING", {}],                  # no default, no choices
    }}},
}
calls = {"n": 0}
real_object_info = cc.object_info


def fake_object_info(base, class_type=None, timeout=15):
    calls["n"] += 1
    return {class_type: SPECS[class_type]} if class_type in SPECS else None


cc.object_info = fake_object_info
try:
    g = {"91": {"class_type": "ImageScaleToTotalPixels",
                "inputs": {"image": ["81", 0], "upscale_method": "nearest-exact",
                           "megapixels": 1}},
         "92": {"class_type": "ImageScaleToTotalPixels",
                "inputs": {"image": ["82", 0], "upscale_method": "nearest-exact",
                           "megapixels": 1}}}
    out = cc.fill_required_inputs("http://x", g)
    check("resolution_steps is filled on BOTH nodes from the server default — Tim's exact card",
          g["91"]["inputs"]["resolution_steps"] == 64
          and g["92"]["inputs"]["resolution_steps"] == 64
          and len(out) == 2 and all(r[4] == "server default" for r in out), out)
    check("inputs the node already carries are never overwritten",
          g["91"]["inputs"]["megapixels"] == 1)
    n0 = calls["n"]
    cc.fill_required_inputs("http://x", g)
    check("object_info is fetched once per class, then cached within a call",
          calls["n"] == n0 + 1, calls["n"] - n0)

    g2 = {"5": {"class_type": "PickyNode", "inputs": {}}}
    out = cc.fill_required_inputs("http://x", g2)
    check("a required combo with no default gets its FIRST choice; no-default-no-choices is left for validation to name",
          g2["5"]["inputs"].get("mode") == "fast"
          and "mystery" not in g2["5"]["inputs"]
          and out == [("5", "PickyNode", "mode", "fast", "first choice")], out)

    g3 = {"9": {"class_type": "UnknownClass", "inputs": {}}}
    check("an unknown class (object_info None) fills nothing and never raises",
          cc.fill_required_inputs("http://x", g3) == [] and g3["9"]["inputs"] == {})
finally:
    cc.object_info = real_object_info

print()
if FAILED:
    print(f"{len(FAILED)} FAILED")
    sys.exit(1)
print("all passed")
