#!/usr/bin/env python3
"""bitGen Studio — 2.531.0 units: every loader file is found where ComfyUI lists it, and a missing one says where to get it.

Tim's Anima log after 2.525 (Krea works now): the model was found in models/checkpoints and loaded by Load Checkpoint, then
    node 71: Value not in list [clip_name] = qwen_3_06b_base.safetensors
      clip_name: 'qwen_3_06b_base.safetensors' not in (list of length 25)
The Anima text encoder is not in his text_encoders / clip folders. relocate_model_loaders now also points a text encoder /
VAE / LoRA / ControlNet at the same file under another subfolder of its own list, and the "not in list" message names the
model catalog entry that downloads it. Run: python3 scripts/test-anima531.py
"""
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


def wf(name):
    return C.load_workflow(os.path.join(HERE, "..", "comfy_workflows", name))


LISTS = {("UNETLoader", "unet_name"): ["flux1-krea-dev.safetensors"],
         ("CheckpointLoaderSimple", "ckpt_name"): ["anima\\animakimi_v13.safetensors"],
         ("CLIPLoader", "clip_name"): ["Anima\\qwen_3_06b_base.safetensors", "t5xxl_fp16.safetensors"],
         ("VAELoader", "vae_name"): ["qwen\\qwen_image_vae.safetensors"]}

g, rep = C.patch(wf("img_anima_aesthetic_t2i.json"), {"model": "anima/animakimi_v13.safetensors"}, {"prompt": "a horse", "seed": 1})
te = [n for n, x in g.items() if isinstance(x, dict) and x.get("class_type") == "CLIPLoader"]
vae = [n for n, x in g.items() if isinstance(x, dict) and x.get("class_type") == "VAELoader"]
out = CC.relocate_model_loaders("", g, LISTS)
check("Tim's Anima: the model -> Load Checkpoint (2.525), as before", g["70"]["class_type"] == "CheckpointLoaderSimple" and g["70"]["inputs"]["ckpt_name"] == "anima\\animakimi_v13.safetensors", g["70"])
check("…the text encoder in another subfolder of CLIPLoader's list is found (the name ComfyUI lists)", te and g[te[0]]["inputs"]["clip_name"] == "Anima\\qwen_3_06b_base.safetensors" and g[te[0]]["class_type"] == "CLIPLoader", te and g[te[0]])
check("…the VAE too", vae and g[vae[0]]["inputs"]["vae_name"] == "qwen\\qwen_image_vae.safetensors", vae and g[vae[0]])
check("…each change is reported", {o[1] for o in out} >= {"unet_name", "clip_name", "vae_name"}, out)

g2, _ = C.patch(wf("img_anima_aesthetic_t2i.json"), {"model": "anima/animakimi_v13.safetensors"}, {"prompt": "a horse", "seed": 1})
lists2 = dict(LISTS); lists2[("CLIPLoader", "clip_name")] = ["t5xxl_fp16.safetensors"]
CC.relocate_model_loaders("", g2, lists2)
check("…a text encoder in no list at all is left for ComfyUI to refuse (no guessing another file)", g2[te[0]]["inputs"]["clip_name"] == "qwen_3_06b_base.safetensors")
two = {"1": {"class_type": "CLIPLoader", "inputs": {"clip_name": "x/te.safetensors"}}}
CC.relocate_model_loaders("", two, {("CLIPLoader", "clip_name"): ["a/te.safetensors", "b/te.safetensors"]})
check("…two files with that name = no guess", two["1"]["inputs"]["clip_name"] == "x/te.safetensors")

h = CC.catalog_hint("qwen_3_06b_base.safetensors")
check("catalog_hint: the model catalog downloads it - its label, size, folder, repo", "Anima text encoder (Qwen3 0.6B base)" in h and "1.2 GB" in h and "ComfyUI/models/text_encoders" in h and "circlestone-labs/Anima" in h, h)
check("…by its file name in any subfolder / with a backslash", CC.catalog_hint("anima\\qwen_3_06b_base.safetensors") == h and CC.catalog_hint("nope.safetensors") == "")


real = CC.combo_values
CC.combo_values = lambda base, ct, key: ["t5xxl_fp16.safetensors"] if ct == "CLIPLoader" else []
try:
    res = {"error": {"message": "Prompt outputs failed validation"}, "node_errors": {"71": {"errors": [{"message": "Value not in list",
           "details": "clip_name: 'qwen_3_06b_base.safetensors' not in (list of length 25)", "extra_info": {"input_name": "clip_name", "received_value": "qwen_3_06b_base.safetensors"}}]}}}
    msg = CC.describe_rejection(res, {"71": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_06b_base.safetensors"}}}, "http://x")
    msg = msg if isinstance(msg, str) else "\n".join(msg)
    check("the 'not in list' message (Tim's line) now says the catalog downloads it", "node 71: Value not in list [clip_name]" in msg and "Model catalog" in msg and "Anima text encoder" in msg, msg)
finally:
    CC.combo_values = real

js = open(os.path.join(HERE, "..", "lib", "styleDoctor.js"), encoding="utf-8").read()
check("the 🩺 Style doctor's advice names the catalog entry too", "catalogHint(m[2])" in js)

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
