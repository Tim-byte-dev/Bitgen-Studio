#!/usr/bin/env python3
"""bitGen Studio — 2.535.0 units: an OPTION ComfyUI does not offer is "update ComfyUI", not "the file is not on a search path".

Tim's log ("flux3 fails"):
    node 71: Value not in list [type] = flux3
      type: 'flux3' not in (list of length 29)
      ComfyUI has nothing by that name in CLIPLoader.type — the file is not on a search path it uses. ...
CLIPLoader.type is a choice, not a file: FLUX 3 Klein's text encoder needs ComfyUI 0.41.0 or newer (docs.comfy.org
tutorials/flux/flux-3-klein: "need ComfyUI 0.41.0 or later"; the fix shipped in 0.41.1). Also: the FLUX 3 Klein weights
are named flux3-image-klein-int8-convrot / flux3-image-klein-base-int8-convrot in black-forest-labs/flux-3-image-klein-comfy.
Run: python3 scripts/test-flux535.py
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_client as CC                                    # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


TYPES = ["stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv", "pixart", "cosmos", "lumina2", "wan", "hidream",
         "chroma", "ace", "omnigen2", "qwen_image", "hunyuan_image", "flux2", "ovis", "longcat_image"]
graph = {"71": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "flux3", "device": "default"}}}
res = {"error": {"type": "prompt_outputs_failed_validation", "message": "Prompt outputs failed validation"},
       "node_errors": {"71": {"errors": [{"type": "value_not_in_list", "message": "Value not in list", "details": "type: 'flux3' not in (list of length 29)",
                                          "extra_info": {"input_name": "type", "received_value": "flux3"}}], "class_type": "CLIPLoader"}}}
real_cv, real_ver = CC.combo_values, CC.comfy_version
CC.combo_values = lambda base, ct, key: list(TYPES) if (ct, key) == ("CLIPLoader", "type") else []
CC.comfy_version = lambda base, timeout=3: "0.40.2"
try:
    out = "\n".join(CC.describe_rejection(res, graph, "http://x"))
finally:
    CC.combo_values, CC.comfy_version = real_cv, real_ver
check("Tim's rejection: 'flux3' is a CHOICE of CLIPLoader.type, not a file - this ComfyUI is older than the model",
      "'flux3' is a CHOICE of CLIPLoader.type, not a file" in out and "older than this model" in out, out)
check("…FLUX 3 Klein needs ComfyUI 0.41.0 or newer (0.41.1+ best), and says which one is running (0.40.2)",
      "FLUX 3 Klein needs ComfyUI 0.41.0 or newer" in out and "0.41.1" in out and "This one is 0.40.2." in out, out)
check("…how to update (the portable's update_comfyui.bat, git pull + requirements, ComfyUI-Manager), then restart",
      "update\\update_comfyui.bat" in out and "git pull" in out and "ComfyUI-Manager -> Update ComfyUI" in out and "restart" in out, out)
check("…the choices this ComfyUI has (flux2, qwen_image ...)", "Its type choices here: stable_diffusion" in out and "flux2" in out, out)
check("…NOT the old 'the file is not on a search path' / extra_model_paths advice", "search path" not in out and "extra_model_paths" not in out, out)

check("is_file_input: file inputs vs options", CC.is_file_input("clip_name", "x") and CC.is_file_input("unet_name", "a") and CC.is_file_input("lora_name", "a")
      and CC.is_file_input("whatever", "sub/x.safetensors") and not CC.is_file_input("type", "flux3") and not CC.is_file_input("sampler_name", "euler")
      and not CC.is_file_input("weight_dtype", "fp8_e4m3fn"))
gen = CC.option_hint("KSampler", "sampler_name", "res_multistep_x", ["euler", "dpmpp_2m"], None)
check("an option with no known version: 'older than this workflow', update ComfyUI, its choices", "older than this workflow" in gen[0] and any("Update ComfyUI" in l for l in gen) and any("euler, dpmpp_2m" in l for l in gen), gen)

# a FILE that is not there still gets the file advice
res2 = {"node_errors": {"70": {"errors": [{"message": "Value not in list", "details": "unet_name: 'nope.safetensors' not in (list of length 3)",
                                           "extra_info": {"input_name": "unet_name", "received_value": "nope.safetensors"}}]}}}
CC.combo_values = lambda base, ct, key: ["a.safetensors"]
try:
    out2 = "\n".join(CC.describe_rejection(res2, {"70": {"class_type": "UNETLoader", "inputs": {"unet_name": "nope.safetensors"}}}, "http://x"))
finally:
    CC.combo_values = real_cv
check("a missing FILE still gets the search-path advice", "not on a search path" in out2 and "CHOICE" not in out2, out2)

# the Style doctor
ROOT = os.path.join(HERE, "..")
js = ("const D=require('./lib/styleDoctor.js');const r=D.explain(['node 71: Value not in list [type] = flux3','    type: \\'flux3\\' not in (list of length 29)']);"
      "const r2=D.explain(['node 70: Value not in list [unet_name] = x.safetensors']);console.log(JSON.stringify([r,r2]))")
r, r2 = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT, text=True))
check("🩺 Style doctor: CLIPLoader.type = flux3 -> 'update ComfyUI' (FLUX 3 Klein needs 0.41.0+), not 'put the file in'",
      r["kind"] == "comfyold" and "older than the model" in r["advice"] and "0.41.0" in r["advice"] and "update_comfyui.bat" in r["advice"], r)
check("…a model file is still the model rule", r2["kind"] == "model", r2)

# the real file names
cat = {m["id"]: m for m in json.load(open(os.path.join(ROOT, "lib", "modelCatalog.json")))["models"]}
check("model catalog: FLUX 3 Klein's real file names in black-forest-labs/flux-3-image-klein-comfy",
      cat["flux3_klein"]["file"] == "diffusion_models/flux3-image-klein-int8-convrot.safetensors" and cat["flux3_klein_base"]["file"] == "diffusion_models/flux3-image-klein-base-int8-convrot.safetensors"
      and cat["flux3_te"]["file"] == "text_encoders/qwen3vl_4b_int8_convrot.safetensors", [cat["flux3_klein"]["file"], cat["flux3_klein_base"]["file"]])
wf = json.load(open(os.path.join(ROOT, "comfy_workflows", "img_flux3_klein_t2i.json")))
check("…and the templates load them (CLIPLoader type flux3 kept - it is right for ComfyUI 0.41+)",
      wf["70"]["inputs"]["unet_name"] == "flux3-image-klein-int8-convrot.safetensors" and wf["71"]["inputs"]["type"] == "flux3")
k3 = subprocess.check_output(["node", "-e", "const R=require('./lib/imageRefs.js');console.log(R.isKlein3({engine:'comfy',mode:'image',model:'flux3-image-klein-int8-convrot.safetensors'}))"], cwd=ROOT, text=True).strip()
check("isKlein3 knows the dashed name", k3 == "true", k3)

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
