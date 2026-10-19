#!/usr/bin/env python3
"""bitGen Studio — 2.322.0: FACE FIX (FaceDetailer) + the Pose face-points switch.
Tim: "is there any way to get the persons face to look 'not distorted'" ->
"please add the 2 reccommendations".
  1. face_fix.apply on the shipped SDXL and FLUX.2 Klein workflows: FaceDetailer
     between the decode and the save, the render's model / clip / vae /
     conditioning / steps / cfg / sampler, the detector, the denoise;
  2. on a ControlNet final: the conditioning from BEFORE ControlNetApplyAdvanced;
  3. graphs it cannot read are left alone, said;
  4. the worker wiring (plain render / ControlNet final, a missing pack skips).
Run from repo root: python3 scripts/test-facefix.py"""
import copy, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import face_fix as ff  # noqa: E402
import cn_stage as cs  # noqa: E402
import comfy_image as ci  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


def fd_of(g):
    return next((k for k, v in g.items() if v.get("class_type") == "FaceDetailer"), None)


SDXL = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_sdxl_t2i.json"))
g, n = ff.apply(SDXL, {"denoise": 0.35, "detector": "bbox/face_yolov8n.pt"}, seed=77)
k = fd_of(g)
d = g[k]["inputs"] if k else {}
save = next(v for v in g.values() if v["class_type"] == "SaveImage")
dec = next(kk for kk, v in g.items() if v["class_type"] == "VAEDecode")
samp = next(v["inputs"] for v in SDXL.values() if v["class_type"] == "KSampler")
prov = g.get(str((d.get("bbox_detector") or [""])[0])) or {}
check("SDXL: VAEDecode -> FaceDetailer -> SaveImage, the render's model / vae / positive / negative, the clip behind the prompt",
      k and save["inputs"]["images"] == [k, 0] and d["image"] == [dec, 0] and d["model"] == samp["model"]
      and d["positive"] == samp["positive"] and d["negative"] == samp["negative"]
      and d["vae"] == g[dec]["inputs"]["vae"] and d["clip"] == SDXL[str(samp["positive"][0])]["inputs"]["clip"], d)
check("...steps / cfg / sampler / scheduler from the KSampler, denoise 0.35, the seed, the detector through UltralyticsDetectorProvider",
      d["steps"] == samp["steps"] and d["cfg"] == samp["cfg"] and d["sampler_name"] == samp["sampler_name"]
      and d["scheduler"] == samp["scheduler"] and d["denoise"] == 0.35 and d["seed"] == 77
      and prov.get("class_type") == "UltralyticsDetectorProvider" and prov["inputs"]["model_name"] == "bbox/face_yolov8n.pt"
      and "denoise 0.35" in n[0] and SDXL == ci.load_workflow(str(ROOT / "comfy_workflows" / "img_sdxl_t2i.json")), (d, n))
KL = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_flux2_klein_9b_t2i.json"))
gk, nk = ff.apply(KL, {"denoise": 0.4})
dk = gk[fd_of(gk)]["inputs"] if fd_of(gk) else {}
gd = next(v["inputs"] for v in KL.values() if v["class_type"] == "CFGGuider")
check("FLUX.2 Klein (SamplerCustomAdvanced + CFGGuider): the guider's model / conditioning, the scheduler's 4 steps, cfg 1, euler; default detector",
      dk and dk["model"] == gd["model"] and dk["positive"] == gd["positive"] and dk["negative"] == gd["negative"]
      and dk["steps"] == 4 and dk["cfg"] == 1.0 and dk["sampler_name"] == "euler"
      and gk[str(dk["bbox_detector"][0])]["inputs"]["model_name"] == ff.DEFAULT_DETECTOR, dk)
gc, _ = cs.apply_controlnet(copy.deepcopy(SDXL), "m.png", "cn.safetensors", 0.6, 0.7)
gcf, _ = ff.apply(gc, {"denoise": 0.4})
dc = gcf[fd_of(gcf)]["inputs"]
ks = next(v["inputs"] for v in gcf.values() if v["class_type"] == "KSampler")
check("ControlNet final: the face is re-rendered from the conditioning BEFORE ControlNetApplyAdvanced (the map is the whole picture)",
      str(ks["positive"][0]).startswith("cn_apply") and dc["positive"] == samp["positive"] and dc["negative"] == samp["negative"], dc)
g0, n0 = ff.apply({"1": {"class_type": "SaveImage", "inputs": {"images": ["2", 0]}},
                   "2": {"class_type": "LoadImage", "inputs": {"image": "x"}}}, {"denoise": 0.4})
check("a graph with no decoded render is left alone, said; no spec -> untouched",
      fd_of(g0) is None and "skipped" in n0[0] and ff.apply(SDXL, None) == (SDXL, []), n0)
W = (ROOT / "image_worker.py").read_text()
check("worker: a plain render gets the face fix hook (not when ControlNet runs - the final does); the ControlNet final composes both hooks",
      'ff = None if params.get("controlnet") else face_fix_hook(params, cfg, seed)' in W
      and "produced = run_comfy(params, cfg, stored, output_dir, stem, batch, seed, graph_hook=ff)" in W
      and "both = (lambda g: ff(hook(g))) if ff else hook" in W)
check("...the Impact Pack is checked on this ComfyUI first - missing = the render runs without the fix, said",
      "miss = _comfy.missing_classes(base, {str(i): {\"class_type\": c} for i, c in enumerate(_ff.CLASSES)})" in W
      and "face fix skipped: ComfyUI does not have" in W)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
