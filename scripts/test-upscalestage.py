#!/usr/bin/env python3
"""bitGen Studio — 2.312.0: the MMH3 Ultimate Upscale stage.
Tim: "... upscaler dropdown, upscale resolution. Add a workflow for comfyui
upscaler, https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale".
  1. the stage workflow (comfy_workflows/MMH3_UltimateUpscale_stage.json)
     carries the pack's nodes with the inputs Tim's own MM3 export uses;
  2. SPLICED into the native-audio fl2va graph: after the sampler, model +
     conditioning from its guider (the lock-patched model), the video decode
     reads the upscaled latent, the song (the lock node's audio) untouched,
     the target size on both param nodes, the noise seeded;
  3. an export that ALREADY has a stage (MM3_Characters) is re-aimed, never
     doubled, its cfg back to 1;
  4. a graph with no decodable sampler is left alone, said;
  5. the worker wiring;
  6. (2.315.0) from_take: the stage reads the rendered TAKE (LoadVideo ->
     GetVideoComponents -> VAEEncodeTiled), the sampler left unused.
Run from repo root: python3 scripts/test-upscalestage.py"""
import copy, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import upscalestage as us  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


STAGE = {"model": "minimax_h3_latent_upscaler_3d_bf16.safetensors", "width": 1920, "height": 1088}

# ---- 1. the stage workflow -----------------------------------------------------------
T = us.load_template()
classes = sorted(v["class_type"] for v in T.values())
check("the stage workflow carries the pack's four nodes + its own noise / sampler / one-step scheduler",
      classes == sorted(["MMH3LatentUpscaleWithModelParams", "MMH3TemporalSplitParams", "MMH3SpatialSplitParams",
                         "MMH3UltimateUpscale", "RandomNoise", "KSamplerSelect", "BasicScheduler"]), classes)
MM3 = json.loads((ROOT / "comfy_workflows" / "MM3_Characters.json").read_text())
theirs = {v["class_type"]: v["inputs"] for v in MM3.values() if str(v["class_type"]).startswith("MMH3")}
mine = {v["class_type"]: v["inputs"] for v in T.values() if str(v["class_type"]).startswith("MMH3")}
check("...every input name matches Tim's own MM3 export (the pack's exact API names)",
      all(set(mine[c]) == set(theirs[c]) for c in theirs), {c: sorted(set(mine[c]) ^ set(theirs[c])) for c in theirs})
check("...the refine pass is the export's: one step, denoise 0.2, beta, sa_solver, cfg 1",
      T["bgup_sigmas"]["inputs"]["steps"] == 1 and T["bgup_sigmas"]["inputs"]["denoise"] == 0.2
      and T["bgup_sigmas"]["inputs"]["scheduler"] == "beta"
      and T["bgup_sampler"]["inputs"]["sampler_name"] == "sa_solver" and T["bgup_upscale"]["inputs"]["cfg"] == 1)

# ---- 2. spliced into the native-audio fl2va graph -----------------------------------------
FL = json.loads((ROOT / "comfy_workflows" / "MMH3_NativeAudio_MV_fl2va.json").read_text())
g, notes = us.apply(copy.deepcopy(FL), STAGE, seed=1234)
up = [k for k, v in g.items() if v["class_type"] == "MMH3UltimateUpscale"]
check("spliced: one MMH3UltimateUpscale after sampler 54", len(up) == 1 and g[up[0]]["inputs"]["latent"] == ["54", 0], up)
u = g[up[0]]["inputs"]
check("...model + conditioning from the sampler's guider (the lock-patched model 41, the gen node's positive 40)",
      u["model"] == ["41", 0] and u["conditioning"] == ["40", 0], u)
check("...the video decode reads the UPSCALED latent; the song (lock node output 2) is untouched",
      g["60"]["inputs"]["samples"] == [up[0], 0] and g["61"]["inputs"]["audio"] == ["41", 2], (g["60"], g["61"]))
p = next(v["inputs"] for v in g.values() if v["class_type"] == "MMH3LatentUpscaleWithModelParams")
sp = next(v["inputs"] for v in g.values() if v["class_type"] == "MMH3SpatialSplitParams")
sig = next(v["inputs"] for k, v in g.items() if v["class_type"] == "BasicScheduler" and k != "52")
check("...the model file and the target size land on both param nodes; its scheduler reads the same model",
      p["model_name"] == STAGE["model"] and (p["width"], p["height"]) == (1920, 1088)
      and (sp["upscale_width"], sp["upscale_height"]) == (1920, 1088) and sig["model"] == ["41", 0], (p, sp))
check("...the stage's noise is seeded from the render",
      next(v["inputs"]["noise_seed"] for k, v in g.items() if v["class_type"] == "RandomNoise" and k != "50") == 1234)
check("...every link points at a node that exists (no placeholder left)",
      all(not (isinstance(val, list) and len(val) == 2 and str(val[0]) not in g)
          and val not in ("@model", "@conditioning", "@latent")
          for v in g.values() for val in v["inputs"].values()))
check("...and the log says what happened", any("spliced after sampler 54" in n for n in notes), notes)
g2, _ = us.apply(copy.deepcopy(g), STAGE, seed=1)
check("...applied twice, still ONE stage (re-aimed, not doubled)",
      sum(1 for v in g2.values() if v["class_type"] == "MMH3UltimateUpscale") == 1)

# ---- 3. an export that already has a stage ------------------------------------------------
m = copy.deepcopy(MM3)
for v in m.values():
    if v["class_type"] == "MMH3UltimateUpscale":
        v["inputs"]["cfg"] = 4.5          # what the shared patch writes into every cfg input
g3, n3 = us.apply(m, {"model": "other_up.safetensors", "width": 2560, "height": 1440})
p3 = next(v["inputs"] for v in g3.values() if v["class_type"] == "MMH3LatentUpscaleWithModelParams")
sp3 = next(v["inputs"] for v in g3.values() if v["class_type"] == "MMH3SpatialSplitParams")
u3 = next(v["inputs"] for v in g3.values() if v["class_type"] == "MMH3UltimateUpscale")
check("the MM3 export's OWN stage is re-aimed (model, 2560x1440 on both param nodes), cfg back to 1, nothing added",
      p3["model_name"] == "other_up.safetensors" and (p3["width"], p3["height"]) == (2560, 1440)
      and (sp3["upscale_width"], sp3["upscale_height"]) == (2560, 1440) and u3["cfg"] == 1
      and len(g3) == len(MM3) and any("re-aimed" in n for n in n3), (p3, u3, n3))

# ---- 4. nothing to hang it on -------------------------------------------------------------------
g4, n4 = us.apply({"1": {"class_type": "SaveImage", "inputs": {}}}, STAGE)
check("a graph with no sampler feeding a VAEDecode is left alone, said",
      len(g4) == 1 and any("skipped" in n for n in n4), n4)
check("no stage asked for: untouched, silent", us.apply(copy.deepcopy(FL), None) == (FL, []))

# ---- 5. the worker ----------------------------------------------------------------------------
W = (ROOT / "worker.py").read_text()
check("worker: imports the stage helper; keeps an export's stage when the job asks for an upscale; applies it after the patch",
      "import upscalestage as _us" in W
      and 'upscale=bool(params.get("upscale", True)) or bool(params.get("upscale_stage")))' in W
      and 'g, unotes = _us.apply(g, params["upscale_stage"], seed=seed)' in W
      and W.index('g, unotes = _us.apply(') > W.index("g = _apply_refmods(g, params.get(\"refmods\"))")
      and W.index('g, unotes = _us.apply(') < W.index("g, rnote, raw_fps = _rm.add_taps(g)"))

# ---- 6. 2.315.0: ⏫ upscales THE TAKE (Tim: "i would prefer to press the button so i can preview the scene")
gt, _ = us.apply(copy.deepcopy(FL), STAGE, seed=5)
samp = next(k for k, v in FL.items() if v["class_type"] == "SamplerCustomAdvanced")
gt, nt = us.from_take(gt, "scene_2_3.avi")
load = [k for k, v in gt.items() if v["class_type"] == "LoadVideo" and v["inputs"].get("file") == "scene_2_3.avi"]
comp = [k for k, v in gt.items() if v["class_type"] == "GetVideoComponents"]
enc = [k for k, v in gt.items() if v["class_type"] == "VAEEncodeTiled"]
upk = next(k for k, v in gt.items() if v["class_type"] == "MMH3UltimateUpscale")
dec = next(v for v in gt.values() if v["class_type"] == "VAEDecode" and v["inputs"]["samples"] == [upk, 0])
check("from_take: LoadVideo(the take) -> GetVideoComponents -> VAEEncodeTiled with the decode's OWN vae -> the stage's latent",
      len(load) == 1 and len(comp) == 1 and len(enc) == 1
      and gt[comp[0]]["inputs"]["video"] == [load[0], 0] and gt[enc[0]]["inputs"]["pixels"] == [comp[0], 0]
      and gt[enc[0]]["inputs"]["vae"] == dec["inputs"]["vae"] and gt[upk]["inputs"]["latent"] == [enc[0], 0]
      and gt[enc[0]]["inputs"]["tile_size"] == 512, (load, comp, enc, gt[upk]["inputs"].get("latent")))
check("...the scene's sampler feeds nothing any more (ComfyUI skips it), the guider still gives model + conditioning, said",
      not any(isinstance(x, list) and x[:1] == [samp] for v in gt.values() for x in v.get("inputs", {}).values())
      and isinstance(gt[upk]["inputs"]["model"], list) and isinstance(gt[upk]["inputs"]["conditioning"], list)
      and any("reads the TAKE scene_2_3.avi" in n and "skips it" in n for n in nt), nt)
check("...no stage in the graph / no take: left alone, said",
      any("skipped" in n for n in us.from_take(copy.deepcopy(FL), "x.avi")[1])
      and any("skipped" in n for n in us.from_take(copy.deepcopy(gt), "")[1]))
check("worker (2.315.0): the take is uploaded and fed to the stage right after it is applied; a missing take / a failed feed FAILS the job (never a fresh sample)",
      'g, tnotes = _us.from_take(g, _up(tk))' in W and W.index("_us.from_take(") > W.index("g, unotes = _us.apply(")
      and 'raise RuntimeError(f"the take to upscale is gone' in W
      and 'raise RuntimeError("could not feed the take to the upscale stage: "' in W
      and 'raise RuntimeError("scripts/upscalestage.py did not load - the take cannot be upscaled")' in W)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
