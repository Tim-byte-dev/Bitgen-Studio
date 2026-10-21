#!/usr/bin/env python3
"""bitGen Studio — 2.569.0 units: 🔲 zones as regional prompting in one ComfyUI pass (scripts/comfy_regions.py, called by
scripts/comfy_image.py patch when the job carries `regions`). Run: python3 scripts/test-regions569.py

Tim: "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put kite in this
box, dog in this box, bench in this box?"
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_image as C                                     # noqa: E402
import comfy_regions as R                                   # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:900] if got is not None else ""))


def wf(name):
    return C.load_workflow(os.path.join(HERE, "..", "comfy_workflows", name))


ZONES = [{"x": 0.05, "y": 0.05, "w": 0.3, "h": 0.3, "text": "a red kite"},
         {"x": 0.6, "y": 0.55, "w": 0.35, "h": 0.4, "text": "a dog", "strength": 1.5},
         {"x": 0.3, "y": 0.6, "w": 0.2, "h": 0.2, "text": "  "}]

# 1 the box in pixels
a = R.area_px({"x": 0.05, "y": 0.05, "w": 0.3, "h": 0.3}, 1024, 768)
b = R.area_px({"x": 0.98, "y": 0.0, "w": 0.01, "h": 0.01}, 1024, 768)
check("area_px: fractions -> the render's pixels on a 16-px grid; at least 64 px a side, kept inside the picture",
      a == {"x": 48, "y": 32, "width": 304, "height": 224} and b["width"] == 64 and b["x"] + b["width"] <= 1024 and b["height"] == 64, (a, b))

# 2 SDXL: KSampler positive / negative
g0 = wf("img_sdxl_t2i.json")
g, rep = C.patch(g0, {"name": "t"}, {"prompt": "a park at noon", "width": 1024, "height": 768, "seed": 5, "regions": ZONES})
r0 = C.roles(g0)
samp = g[r0["sampler"]]["inputs"]
comb = g[samp["positive"][0]]
chain, cur = [], samp["positive"]
while g[cur[0]]["class_type"] == "ConditioningCombine":
    area = g[g[cur[0]]["inputs"]["conditioning_2"][0]]
    chain.append((area["inputs"]["x"], area["inputs"]["y"], area["inputs"]["width"], area["inputs"]["height"], area["inputs"]["strength"],
                  g[area["inputs"]["conditioning"][0]]["inputs"]["text"]))
    cur = g[cur[0]]["inputs"]["conditioning_1"]
check("SDXL: the sampler's positive = the scene's prompt combined with one ConditioningSetArea per box (its own CLIPTextEncode, the same CLIP); a box with no words is left out",
      comb["class_type"] == "ConditioningCombine" and cur == g0[r0["sampler"]]["inputs"]["positive"] and len(chain) == 2
      and chain[1][:5] == (48, 32, 304, 224, 1.0) and chain[1][5] == "a red kite" and chain[0][5] == "a dog" and chain[0][4] == 1.5
      and g[g[cur[0]]["inputs"]["clip"][0] if "clip" in g[cur[0]]["inputs"] else cur[0]] is not None, chain)
check("...the negative is untouched; the report names each zone", g[r0["sampler"]]["inputs"]["negative"] == g0[r0["sampler"]]["inputs"]["negative"]
      and sum(1 for l in rep if l.startswith("zone ")) == 2, rep)

# 3 FLUX.2 (CFGGuider + a Primitive holding the words) and a guider-only graph with FluxGuidance
g1, rep1 = C.patch(wf("img_flux2_9b_t2i_verified.json"), {"name": "t"}, {"prompt": "x", "width": 1024, "height": 768, "regions": ZONES[:1]})
new = [n for k, n in g1.items() if n.get("_meta", {}).get("title", "").startswith("zone 1")]
enc = [n for n in new if n["class_type"] == "CLIPTextEncode"]
check("FLUX.2: the zone's encoder shares the CLIP of the ENCODER (not the Primitive that holds the scene's words)",
      len(enc) == 1 and enc[0]["inputs"]["clip"] == ["75:71", 0], new)
guided = {
    "1": {"class_type": "CLIPLoader", "inputs": {"clip_name": "t5.safetensors", "type": "flux"}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "x", "clip": ["1", 0]}},
    "3": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["2", 0], "guidance": 3.0}},
    "4": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux.safetensors", "weight_dtype": "default"}},
    "5": {"class_type": "BasicGuider", "inputs": {"model": ["4", 0], "conditioning": ["3", 0]}},
    "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
    "7": {"class_type": "SamplerCustomAdvanced", "inputs": {"guider": ["5", 0], "latent_image": ["6", 0], "noise": ["8", 0]}},
    "8": {"class_type": "RandomNoise", "inputs": {"noise_seed": 1}},
    "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["10", 0]}},
    "10": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    "11": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "x"}},
}
g2, rep2 = R.apply(json.loads(json.dumps(guided)), ZONES[:2], 1024, 1024)
c2 = g2["5"]["inputs"]["conditioning"]
fg = [n for n in g2.values() if n["class_type"] == "FluxGuidance" and n.get("_meta", {}).get("title", "").startswith("zone")]
check("a guider graph (FLUX's BasicGuider): its conditioning gets the zones; the FluxGuidance on the way is copied onto each zone (same guidance)",
      g2[c2[0]]["class_type"] == "ConditioningCombine" and len(fg) == 2 and all(n["inputs"]["guidance"] == 3.0 for n in fg), rep2)

# 4 nothing to do / refusals
g3, rep3 = R.apply({"a": 1}, [{"text": " "}], 512, 512)
check("no zone with words = the graph as it was, nothing reported", g3 == {"a": 1} and rep3 == [])
try:
    R.apply(json.loads(json.dumps(guided)), ZONES[:1], 0, 0); ok = False
except C.PatchError:
    ok = True
try:
    R.apply({"1": {"class_type": "SaveImage", "inputs": {}}}, ZONES[:1], 512, 512); ok2 = False
except C.PatchError as e:
    ok2 = "no sampler conditioning" in str(e)
check("...no size, or no sampler to add them to = a PatchError in the user's words", ok and ok2)
g4, _ = C.patch(wf("img_sdxl_t2i.json"), {"name": "t"}, {"prompt": "x", "width": 1024, "height": 768})
check("...a job without regions patches exactly as before (no zone nodes)", not any(n.get("_meta", {}).get("title", "").startswith("zone") for n in g4.values()))

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: FAIL" if FAIL else "RESULT: PASS")
sys.exit(1 if FAIL else 0)
