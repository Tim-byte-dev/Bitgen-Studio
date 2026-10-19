#!/usr/bin/env python3
"""bitGen Studio — 2.525.0 units: a diffusion model ComfyUI's loader does NOT list is found where ComfyUI DOES list it
(scripts/comfy_client.py relocate_model_loaders, run from canonicalise_combos by every worker).

Tim's log after 2.523 ("krea and anima still don't work"):
    model: node 70.unet_name = Krea2/jibMixKrea_v60CarolinaReaper.safetensors
    node 70: Value not in list [unet_name] = Krea2/jibMixKrea_v60CarolinaReaper.safetensors
      unet_name: '...' not in (list of length 72)
The Krea 2 Raw style's UNETLoader lists models/diffusion_models + models/unet; the file is in models/checkpoints (a
Civitai "Checkpoint" with a text encoder / VAE inside stays there). Load Checkpoint lists it, and loads a model-only
file as well, so node 70 becomes CheckpointLoaderSimple - its output 0 is the same MODEL.
Run: python3 scripts/test-relocate525.py
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_client as CC                                    # noqa: E402
import comfy_image as C                                      # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


KREA = "Krea2/jibMixKrea_v60CarolinaReaper.safetensors"
UNET = ["flux1-krea-dev.safetensors", "anima/anima-preview.safetensors", "qwen_image_fp8.safetensors"]
GGUF = ["flux1-krea-dev-Q8_0.gguf", "Wan2.2-T2V-Q4_K_M.gguf"]
CKPT = ["sd_xl_base_1.0.safetensors", "Krea2\\jibMixKrea_v60CarolinaReaper.safetensors", "Anima\\animaAesthetic_v10.safetensors"]
LISTS = {("UNETLoader", "unet_name"): UNET, ("UnetLoaderGGUF", "unet_name"): GGUF, ("CheckpointLoaderSimple", "ckpt_name"): CKPT}


def wf(name):
    return C.load_workflow(os.path.join(HERE, "..", "comfy_workflows", name))


# ---- find_model_name
check("find_model_name: exact", CC.find_model_name(CKPT, "sd_xl_base_1.0.safetensors") == "sd_xl_base_1.0.safetensors")
check("…a Windows backslash / case difference", CC.find_model_name(CKPT, "krea2/JIBMIXKREA_v60CarolinaReaper.safetensors") == CKPT[1])
check("…the same FILE NAME under another subfolder (one match)", CC.find_model_name(UNET, "Anima/anima-preview.safetensors") == "anima/anima-preview.safetensors")
check("…two files with that name = no guess", CC.find_model_name(["a/x.safetensors", "b/x.safetensors"], "c/x.safetensors") == "")
check("…nothing", CC.find_model_name(UNET, "nope.safetensors") == "" and CC.find_model_name([], "x") == "")

# ---- Tim's case, on the real Krea 2 Raw workflow
g, rep = C.patch(wf("img_krea2_raw_t2i.json"), {"model": KREA}, {"prompt": "a lighthouse", "seed": 1})
before = copy.deepcopy(g)
users = CC._uses_outputs(g, "70")
out = CC.relocate_model_loaders("", g, LISTS)
n = g["70"]
check("Krea 2 Raw + a model in models/checkpoints: node 70 becomes CheckpointLoaderSimple with ComfyUI's own name",
      n["class_type"] == "CheckpointLoaderSimple" and n["inputs"].get("ckpt_name") == CKPT[1] and "unet_name" not in n["inputs"] and "weight_dtype" not in n["inputs"], n)
check("…only its MODEL output (0) was read - the swap is safe; nothing else in the graph changed",
      users == {0} and all(g[k] == before[k] for k in g if k != "70"), users)
check("…the report says why (Load Checkpoint, the checkpoints folder, the text encoder + VAE loaders stay)",
      len(out) == 1 and out[0][0] == "70" and out[0][1] == "unet_name" and "Load Checkpoint" in out[0][3] and "checkpoints folder" in out[0][3], out)

# the GGUF style with the same safetensors: match_loader (2.523) -> UNETLoader, then this -> Load Checkpoint
g2, _ = C.patch(wf("img_krea2_raw_gguf_t2i.json"), {"model": KREA}, {"prompt": "x", "seed": 1})
CC.relocate_model_loaders("", g2, LISTS)
check("Krea 2 Raw GGUF + the same file: GGUF -> UNETLoader (2.523) -> Load Checkpoint", g2["70"]["class_type"] == "CheckpointLoaderSimple" and "dequant_dtype" not in g2["70"]["inputs"], g2["70"])

# a model that IS in UNETLoader's list is never touched
g3, _ = C.patch(wf("img_krea2_raw_t2i.json"), {"model": "flux1-krea-dev.safetensors"}, {"prompt": "x", "seed": 1})
c3 = copy.deepcopy(g3)
check("a model UNETLoader lists: nothing changes", CC.relocate_model_loaders("", g3, LISTS) == [] and g3 == c3)

# the same file under another subfolder of UNETLoader's own list
g4 = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "Anima/anima-preview.safetensors", "weight_dtype": "default"}},
      "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0]}}}
o4 = CC.relocate_model_loaders("", g4, LISTS)
check("Anima in another subfolder: the name ComfyUI lists, the loader kept", g4["1"]["class_type"] == "UNETLoader" and g4["1"]["inputs"]["unet_name"] == "anima/anima-preview.safetensors" and len(o4) == 1, g4)

# a .gguf is never sent to Load Checkpoint
g5 = {"1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "Krea2/x-Q8.gguf"}}, "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0]}}}
check("a .gguf nobody lists: left for ComfyUI to reject (with the message)", CC.relocate_model_loaders("", g5, {**LISTS, ("CheckpointLoaderSimple", "ckpt_name"): CKPT + ["Krea2/x-Q8.gguf"]}) == [] and g5["1"]["class_type"] == "UnetLoaderGGUF")

# CheckpointLoaderSimple + a diffusion-only file: to UNETLoader only when nobody reads its CLIP / VAE
g6 = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "qwen_image_fp8.safetensors"}}, "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0]}}}
CC.relocate_model_loaders("", g6, LISTS)
check("Load Checkpoint + a file only UNETLoader lists, its CLIP / VAE unused -> UNETLoader (weight_dtype default)", g6["1"]["class_type"] == "UNETLoader" and g6["1"]["inputs"] == {"unet_name": "qwen_image_fp8.safetensors", "weight_dtype": "default"}, g6)
g7 = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "qwen_image_fp8.safetensors"}}, "2": {"class_type": "KSampler", "inputs": {"model": ["1", 0]}}, "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1]}}}
check("…but NOT when the graph reads its CLIP (output 1)", CC.relocate_model_loaders("", g7, LISTS) == [] and g7["1"]["class_type"] == "CheckpointLoaderSimple")

# nowhere at all / no answer from the server
g8 = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "Krea2/gone.safetensors"}}}
check("a file in no list: unchanged (ComfyUI's error + the 2.525 hint follow)", CC.relocate_model_loaders("", g8, LISTS) == [] and g8["1"]["inputs"]["unet_name"] == "Krea2/gone.safetensors")
check("no answer from the server: unchanged", CC.relocate_model_loaders("", copy.deepcopy(g8), {}) == [])

# every worker gets it: canonicalise_combos runs it (combo_values monkeypatched as the running ComfyUI)
real = CC.combo_values
CC.combo_values = lambda base, ct, key: list(LISTS.get((ct, key)) or [])
try:
    g9, _ = C.patch(wf("img_krea2_raw_t2i.json"), {"model": KREA}, {"prompt": "x", "seed": 1})
    fx = CC.canonicalise_combos("http://x", g9)
    check("canonicalise_combos (every worker) does it too", g9["70"]["class_type"] == "CheckpointLoaderSimple" and any(f[0] == "70" for f in fx), fx)
finally:
    CC.combo_values = real

# the error when it is nowhere names every list it was looked for in
src = open(os.path.join(HERE, "comfy_client.py"), encoding="utf-8").read()
check("the 'not in list' message says it is in no list - checkpoints, diffusion_models, unet - and where to put it", "It is not in Load Checkpoint's list (models/checkpoints)" in src and "ComfyUI/models/diffusion_models" in src)
iw = open(os.path.join(HERE, "..", "image_worker.py"), encoding="utf-8").read()
check("the image worker logs the change ('-> as ComfyUI lists it')", iw.count("as ComfyUI lists it") == 2)

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
