#!/usr/bin/env python3
"""scripts/ui_to_api.py + the SDXL inpaint export through the image patcher (2.108.1)."""
import copy, json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import ui_to_api, comfy_image as ci
fails = 0
def check(n, c, got=""):
    global fails
    print(("PASS: " if c else "FAIL: ") + n + ("" if c else f"\n      got {got}")); fails += 0 if c else 1

ui = json.load(open(ROOT / "comfy_workflows" / "img_inpaint_sdxl_ui_export.json"))
api = ui_to_api.convert(ui, drop={"LoraStackLoader_PoP"})
check("the UI export converts: 16 API nodes, primitives inlined, the all-Off LoRA stack dropped",
      len(api) == 16 and "35" not in api and "49" not in api, sorted(api))
check("...the bypassed stack's MODEL/CLIP go straight from the loaders to the consumers",
      api["3"]["inputs"]["model"] == ["30", 0] and api["34"]["inputs"]["clip"] == ["29", 1], (api["3"]["inputs"]["model"], api["34"]["inputs"]["clip"]))
check("...KSampler widgets are named (seed/steps/cfg/sampler/scheduler/denoise), UI-only control_after_generate dropped",
      api["3"]["inputs"]["steps"] == 16 and api["3"]["inputs"]["sampler_name"] == "dpmpp_sde" and "control_after_generate" not in api["3"]["inputs"], api["3"]["inputs"])
check("...KSamplerAdvanced keeps start_at_step 16 / end 10000 (the refiner hand-off)",
      api["54"]["inputs"]["start_at_step"] == 16 and api["54"]["inputs"]["end_at_step"] == 10000, api["54"]["inputs"])
check("...CLIPTextEncodeSDXL gets text_g/text_l and its linked width/height from Get image size",
      api["34"]["inputs"]["text_g"] == api["34"]["inputs"]["text_l"] and api["34"]["inputs"]["width"] == ["33", 0], api["34"]["inputs"])
check("...the mask is LoadImage's MASK output (alpha) into VAEEncodeForInpaint", api["26"]["inputs"]["mask"] == ["20", 1] and api["26"]["inputs"]["grow_mask_by"] == 20, api["26"]["inputs"])
try:
    ui_to_api.convert({"nodes": [{"id": 1, "type": "SomethingCustom", "inputs": [], "outputs": [], "widgets_values": [1]}], "links": []})
    check("an unknown node type stops the conversion and names itself", False, "no error")
except SystemExit as e:
    check("an unknown node type stops the conversion and names itself", "SomethingCustom" in str(e), str(e))

# the shipped copy is that conversion (plus the placeholder + prefix + comment)
g = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_inpaint_sdxl.json"))
check("the shipped img_inpaint_sdxl.json is the converted export (same nodes, the neutral picture - 2.401.1 clean_workflows)",
      set(g) == set(api) and g["20"]["inputs"]["image"] == "example.png" and g["30"]["inputs"]["unet_name"] == api["30"]["inputs"]["unet_name"], sorted(g))
r = ci.roles(g)
check("roles: BOTH samplers found (base + refiner), one image slot, three loaders",
      sorted(r["samplers"]) == ["3", "54"] and r["image_slots"] == ["20"] and len(r["loaders"]["model"]) == 3, r["samplers"])
style = {"id": "s", "name": "S", "engine": "comfy", "arch": "sdxl", "workflow": "x", "model": "", "vae": "", "te": "", "loras": [], "negative": "bad, ugly", "steps": None, "cfg": None}
out, rep = ci.patch(copy.deepcopy(g), style, {"prompt": "a red door", "seed": 123, "width": 128, "height": 96, "images": ["hole.png"]})
check("patch: the prompt reaches BOTH encoders — base text_g+text_l and the refiner's text",
      out["34"]["inputs"]["text_g"] == "a red door" and out["34"]["inputs"]["text_l"] == "a red door" and out["50"]["inputs"]["text"] == "a red door", [out["34"]["inputs"], out["50"]["inputs"]])
check("patch: the negative reaches both too", out["37"]["inputs"]["text_g"] == "bad, ugly" and out["52"]["inputs"]["text"] == "bad, ugly", None)
check("patch: one seed into both samplers, steps/cfg left as exported (16 base / 20 refiner, cfg 6)",
      out["3"]["inputs"]["seed"] == 123 and out["54"]["inputs"]["noise_seed"] == 123 and out["3"]["inputs"]["steps"] == 16 and out["54"]["inputs"]["steps"] == 20 and out["3"]["inputs"]["cfg"] == 6, None)
check("patch: the picture lands in the single LoadImage; loaders untouched (inpaint UNet, dreamshaper, refiner)",
      out["20"]["inputs"]["image"] == "hole.png" and out["30"]["inputs"]["unet_name"].startswith("diffusion_pytorch_inpaint") and out["29"]["inputs"]["ckpt_name"].startswith("dreamshaper"), None)
check("patch: the report names the refiner writes", any("refiner" in l for l in rep), rep)
# ---- Tim's FLUX Fill inpaint export (2.109.0): the style's model + LoRAs ARE applied
gf = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_flux_fill_inpaint.json"))
rf = ci.roles(gf)
check("flux fill: one image slot (alpha = hole), the prompt node behind FluxGuidance, zeroed negative recognised, one UNET loader",
      rf["image_slots"] == ["17"] and rf["positive"] == "47:23" and rf["zeroed_negative"] and rf["loaders"]["model"] == [("47:31", "unet_name")], rf)
fs_style = {"id": "f", "name": "FLUX Fill inpaint", "engine": "comfy", "arch": "flux", "workflow": "x", "model": "my-fill.safetensors", "vae": "", "te": "",
            "loras": [{"path": "detail.safetensors", "weight": 0.8}], "negative": "", "steps": None, "cfg": None}
of, repf = ci.patch(copy.deepcopy(gf), fs_style, {"prompt": "green eye", "seed": 7, "width": 128, "height": 96, "images": ["hole.png"]})
check("flux fill: the style's model replaces unet_name", of["47:31"]["inputs"]["unet_name"] == "my-fill.safetensors", of["47:31"]["inputs"])
lora = [k for k, v in of.items() if v["class_type"] == "LoraLoader"]
check("flux fill: a LoraLoader is BUILT between the UNET loader and DifferentialDiffusion, and on the CLIP path",
      len(lora) == 1 and of["47:39"]["inputs"]["model"] == [lora[0], 0] and of["47:23"]["inputs"]["clip"] == [lora[0], 1]
      and of[lora[0]]["inputs"]["lora_name"] == "detail.safetensors", (lora, of["47:39"]["inputs"]))
check("flux fill: prompt + seed written, steps/cfg/guidance left as exported (20 / 1 / 30)",
      of["47:23"]["inputs"]["text"] == "green eye" and of["47:3"]["inputs"]["seed"] == 7 and of["47:3"]["inputs"]["steps"] == 20
      and of["47:3"]["inputs"]["cfg"] == 1 and of["47:26"]["inputs"]["guidance"] == 30, of["47:3"]["inputs"])
check("flux fill: the picture lands in the single LoadImage", of["17"]["inputs"]["image"] == "hole.png", None)
# ---- SDXL / Pony / Illustrious core-node graphs (2.112.0)
gt = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_sdxl_t2i.json"))
gi = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_sdxl_i2i.json"))
rt, ri = ci.roles(gt), ci.roles(gi)
check("sdxl t2i: positive/negative found, EmptyLatentImage size node, checkpoint loader, no image slot",
      rt["positive"] == "3" and rt["negative"] == "4" and rt["size_nodes"] == ["5"] and rt["loaders"]["model"] == [("1", "ckpt_name")] and rt["image_slots"] == [], rt)
check("sdxl i2i: one LoadImage slot feeding VAEEncode, no size node (size follows the picture)",
      ri["image_slots"] == ["10"] and ri["size_nodes"] == [] and gi["11"]["inputs"]["pixels"] == ["10", 0] and gi["6"]["inputs"]["denoise"] == 0.65, ri)
pony = {"id": "p", "name": "Pony", "engine": "comfy", "arch": "sdxl", "workflow": "x", "model": "ponyDiffusionV6XL.safetensors", "vae": "", "te": ["", ""],
        "loras": [{"path": "style.safetensors", "weight": 0.7}], "negative": "score_6, worst quality", "steps": 28, "cfg": 6, "clip_skip": 2, "width": 832, "height": 1216}
o, rep = ci.patch(copy.deepcopy(gt), pony, {"prompt": "score_9, 1girl", "seed": 42})
check("sdxl t2i patched: checkpoint, prompt, negative, seed, steps, cfg, size", o["1"]["inputs"]["ckpt_name"].startswith("pony") and o["3"]["inputs"]["text"] == "score_9, 1girl"
      and o["4"]["inputs"]["text"] == "score_6, worst quality" and o["6"]["inputs"]["seed"] == 42 and o["6"]["inputs"]["cfg"] == 6.0 and o["5"]["inputs"]["width"] == 832, rep)
check("...clip skip 2 -> CLIPSetLastLayer.stop_at_clip_layer = -2, and the built LoRA sits on the CLIP path before it",
      o["2"]["inputs"]["stop_at_clip_layer"] == -2 and o["2"]["inputs"]["clip"][0] == [k for k, v in o.items() if v["class_type"] == "LoraLoader"][0], (o["2"]["inputs"], rep))
o2, _ = ci.patch(copy.deepcopy(gi), pony, {"prompt": "a cat", "seed": 1, "images": ["ref.png"]})
check("sdxl i2i patched: the reference lands in LoadImage, denoise stays 0.65", o2["10"]["inputs"]["image"] == "ref.png" and o2["6"]["inputs"]["denoise"] == 0.65, o2["6"]["inputs"])
o3, rep3 = ci.patch(copy.deepcopy(gt), dict(pony, clip_skip=None), {"prompt": "x", "seed": 1})
check("no clip_skip on the style leaves the graph's own CLIPSetLastLayer value", o3["2"]["inputs"]["stop_at_clip_layer"] == -2 and not any("clip skip" in l for l in rep3), rep3)
print("=" * 30); print("ALL PASS" if not fails else f"FAILED: {fails}"); sys.exit(1 if fails else 0)
