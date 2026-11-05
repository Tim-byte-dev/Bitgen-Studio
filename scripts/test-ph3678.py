#!/usr/bin/env python3
"""bitGen Studio — 2.678.0: P-H3 IMAGE's workflows through the patcher (scripts/comfy_image.py): the prompt template
({prompt} / {aspect}), the fixed P-H3 LoRA kept while the style's LoRA slots fill / bypass, the size, the seed, the
edit graph's picture slots (<image1> edited, its size the output's), no picture = said.
Tim (verbatim): "please add this image edit model, https://huggingface.co/PrunaAI/P-H3-Image-Comfy"
Run: python3 scripts/test-ph3678.py"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import comfy_image as C   # noqa: E402
PASS = FAIL = 0
def check(n, c, got=None):
    global PASS, FAIL
    if c: PASS += 1; print("PASS: " + n)
    else: FAIL += 1; print("FAIL: " + n + ("\n      " + repr(got)[:600] if got is not None else ""))
def wf(name):
    g = json.load(open(os.path.join(HERE, "..", "comfy_workflows", name)))
    return {k: v for k, v in g.items() if not k.startswith("_")}
ST = {"kind": "image", "steps": 8, "cfg": 1, "width": 2048, "height": 2048, "loras": []}
t = wf("img_ph3_t2i.json")
check("the official template's graph: MiniMax H3 FL2VA + the P-H3 LoRA, sigma shift 1/1, the minimax text encoder + upsampler, PH3ImageConditioning, 8 sigmas, er_sde, BasicGuider",
      t["1"]["inputs"]["unet_name"] == "minimax_h3_fl2va_pruned_int8_convrot.safetensors" and t["19"]["inputs"]["lora_name"] == "p-h3-image_lora_bf16.safetensors"
      and t["18"]["inputs"]["shift_video"] == 1 and t["2"]["inputs"]["type"] == "minimax" and t["4"]["inputs"]["clip_name"] == "p-h3-image_prompt_upsampler_w4a8.safetensors"
      and t["33"]["class_type"] == "TextGenerateV2" and t["9"]["inputs"]["prompt"] == ["33", 0] and len(t["13"]["inputs"]["sigmas"].split(",")) == 9
      and t["11"]["inputs"]["sampler_name"] == "er_sde" and t["10"]["class_type"] == "BasicGuider")
out = C.patch(t, ST, {"prompt": "a red fox in the snow", "width": 2368, "height": 1760, "seed": 5})[0]
check("the prompt into the upsampler's template: 'Aspect ratio: 4:3\\nRequest: a red fox in the snow'", out["24"]["inputs"]["value"] == "Aspect ratio: 4:3\nRequest: a red fox in the snow", out["24"]["inputs"])
check("…the size on the conditioning (2368 x 1760), the seed on RandomNoise", out["9"]["inputs"]["width"] == 2368 and out["9"]["inputs"]["height"] == 1760 and out["12"]["inputs"]["noise_seed"] == 5)
check("the P-H3 LoRA '(fixed)' kept; the style's empty LoRA slots bypassed (the model chain 19 -> sigma shift)", "19" in out and out["18"]["inputs"]["model"] == ["19", 0] and not any(k in out for k in ("101", "102", "103", "104")))
o2 = C.patch(t, dict(ST, loras=[{"path": "loras/detail.safetensors", "weight": 0.6}]), {"prompt": "x"})[0]
check("…a style's LoRA fills slot 1 AFTER the P-H3 LoRA (both kept)", o2["101"]["inputs"]["lora_name"].endswith("detail.safetensors") and o2["101"]["inputs"]["model"] == ["19", 0] and o2["19"]["inputs"]["lora_name"] == "p-h3-image_lora_bf16.safetensors", o2.get("101"))
check("aspect_of: the nearest usual ratio", C.aspect_of(1920, 1080) == "16:9" and C.aspect_of(1024, 1024) == "1:1" and C.aspect_of(1760, 2368) == "3:4" and C.aspect_of(0, 5) == "1:1")
check("a prompt node without {prompt}: the prompt as it is (every other workflow)", C.fill_template({"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "old"}}}, "1", "new") == "new")
e = wf("img_ph3_edit.json")
check("the edit graph: <image1> scaled to 4 MP (x32) -> the conditioning's image_1 + the upsampler's picture; its size = the output's; <image2>..<image8> references",
      e["41"]["inputs"]["megapixels"] == 4.0 and e["9"]["inputs"]["images.image_1"] == ["41", 0] and e["33"]["inputs"]["images.image1"] == ["41", 0]
      and e["9"]["inputs"]["width"] == ["40", 0] and all(e["9"]["inputs"]["images.image_%d" % n] == [str(50 + n), 0] for n in range(2, 9)))
oe = C.patch(e, ST, {"prompt": "make it night", "seed": 3, "images": ["src.png", "ref.png"]})[0]
check("edit: 2 pictures = slots <image1>, <image2>; the other six removed with their inputs; 'Request: make it night'",
      oe["51"]["inputs"]["image"] == "src.png" and oe["52"]["inputs"]["image"] == "ref.png" and not any(str(50 + n) in oe for n in range(3, 9))
      and sorted(k for k in oe["9"]["inputs"] if k.startswith("images")) == ["images.image_1", "images.image_2"] and oe["24"]["inputs"]["value"] == "Request: make it night")
check("…the output's size follows <image1> (links - never the style's 2048 x 2048)", oe["9"]["inputs"]["width"] == ["40", 0] and oe["9"]["inputs"]["height"] == ["40", 1])
try:
    C.patch(e, ST, {"prompt": "x", "images": []}); ok = False
except C.PatchError as ex:
    ok = "edits a reference image" in str(ex)
check("edit with no picture: said (nothing to edit)", ok)
print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
