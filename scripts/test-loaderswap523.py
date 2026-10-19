#!/usr/bin/env python3
"""bitGen Studio — 2.523.0 units: the diffusion-model LOADER FOLLOWS THE FILE (scripts/comfy_image.py match_loader).

Tim's log ("krea and anima aren't working, should i create a unet folder for them?"):
    model: node 70.unet_name = Krea2/jibMixKrea_v60CarolinaReaper.safetensors
    node 70: Value not in list [unet_name] = Krea2/jibMixKrea_v60CarolinaReaper.safetensors
      not in ['LTX-2.5-Distilled-Q4_K_M.gguf', 'Wan2.2-...gguf', ...]
The Krea 2 Raw GGUF style's UnetLoaderGGUF lists .gguf files only; a .safetensors model there now switches it to
UNETLoader (and a .gguf in a UNETLoader style to UnetLoaderGGUF). Run: python3 scripts/test-loaderswap523.py
"""
import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_image as C                                     # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


def wf(name):
    return C.load_workflow(os.path.join(HERE, "..", "comfy_workflows", name))


# Tim's exact case: Krea 2 Raw GGUF + a .safetensors fine-tune in a subfolder (a Windows backslash, too)
g, rep = C.patch(wf("img_krea2_raw_gguf_t2i.json"), {"model": "Krea2\\jibMixKrea_v60CarolinaReaper.safetensors"}, {"prompt": "a lighthouse", "seed": 1})
n = g["70"]
check("Krea 2 Raw GGUF + a .safetensors model: node 70 becomes UNETLoader with weight_dtype default, the name with /",
      n["class_type"] == "UNETLoader" and n["inputs"]["unet_name"] == "Krea2/jibMixKrea_v60CarolinaReaper.safetensors" and n["inputs"]["weight_dtype"] == "default", n)
check("…and the log says so", any("UnetLoaderGGUF -> UNETLoader" in str(x) for x in rep), rep)
check("…its CLIP, VAE, sampler and LoRA chain are untouched", g["71"]["class_type"] == "CLIPLoader" and g["72"]["class_type"] == "VAELoader"
      and g["71"]["inputs"]["type"] == "krea2")

# the other way: a .gguf in the safetensors styles (Krea 2 Raw / Turbo, Anima)
for f in ("img_krea2_raw_t2i.json", "img_krea2_turbo_t2i.json", "img_anima_aesthetic_t2i.json", "img_anima_base_t2i.json"):
    g2, rep2 = C.patch(wf(f), {"model": "krea2_raw-Q5_K_M.gguf"}, {"prompt": "x", "seed": 1})
    n2 = g2["70"]
    check(f"{f} + a .gguf model: UNETLoader -> UnetLoaderGGUF (no weight_dtype)", n2["class_type"] == "UnetLoaderGGUF" and n2["inputs"] == {"unet_name": "krea2_raw-Q5_K_M.gguf"}, n2)

# nothing changes when the file already fits
g3, rep3 = C.patch(wf("img_krea2_raw_gguf_t2i.json"), {"model": "krea2_raw-Q8_0.gguf"}, {"prompt": "x", "seed": 1})
check("a .gguf in the GGUF style: stays UnetLoaderGGUF", g3["70"]["class_type"] == "UnetLoaderGGUF" and not any("->" in str(x) and "node 70" in str(x) and "Loader" in str(x) for x in rep3), g3["70"])
g4, _ = C.patch(wf("img_anima_aesthetic_t2i.json"), {"model": "anima/anima-aesthetic-v1.1.safetensors"}, {"prompt": "x", "seed": 1})
check("a .safetensors in a safetensors style: stays UNETLoader (weight_dtype kept)", g4["70"]["class_type"] == "UNETLoader" and g4["70"]["inputs"]["weight_dtype"] == "default")
g5, _ = C.patch(wf("img_krea2_raw_gguf_t2i.json"), {}, {"prompt": "x", "seed": 1})
check("no model override: the template's own loader and file stand", g5["70"]["class_type"] == "UnetLoaderGGUF" and g5["70"]["inputs"]["unet_name"] == "krea2_raw-Q5_K_M.gguf")

# pure
node = {"class_type": "UnetLoaderGGUFAdvanced", "inputs": {"unet_name": "a.gguf", "dequant_dtype": "default", "patch_dtype": "default", "patch_on_device": False}}
check("match_loader: the Advanced GGUF loader's own settings are dropped for UNETLoader", C.match_loader(node, "b.safetensors") == "UnetLoaderGGUFAdvanced -> UNETLoader"
      and node["inputs"] == {"unet_name": "a.gguf", "weight_dtype": "default"}, node)
ck = {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "x.safetensors"}}
check("match_loader: a checkpoint loader is never touched", C.match_loader(ck, "y.gguf") == "" and ck["class_type"] == "CheckpointLoaderSimple")
check("is_gguf", C.is_gguf("A/B.GGUF") and not C.is_gguf("x.safetensors") and not C.is_gguf(None))

print("=======================")
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
