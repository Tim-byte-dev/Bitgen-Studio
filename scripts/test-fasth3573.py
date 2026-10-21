#!/usr/bin/env python3
"""bitGen Studio — 2.573.0 units: scripts/fasth3.py (FastH3 Omni's recipe on any H3 graph) + worker.apply_video_accel
keeping VSA. Run: python3 scripts/test-fasth3573.py
Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni"."""
import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, ROOT)
import fasth3 as F                                        # noqa: E402
import worker                                             # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:700] if got is not None else ""))


def load(n):
    with open(os.path.join(ROOT, "comfy_workflows", n), encoding="utf-8") as f:
        return json.load(f)


def of(g, cls):
    return [k for k, v in g.items() if v.get("class_type") == cls]


# 1 recipe_for
check("recipe_for: the Omni file -> omni, the V2 file -> v2, H3's own -> None",
      F.recipe_for("fasth3_omniref_8step_pruned_int8_convrot.safetensors") == "omni"
      and F.recipe_for("sub/FastH3_8step_v2_int8.safetensors") == "v2"
      and F.recipe_for("minimax_h3_ref2va_pruned_int8_convrot.safetensors") is None)

# 2 the shipped graph: the template's recipe, untouched by apply
W = load("fasth3_omni_r2v.json")
bs, sh, be = of(W, "BlockSparseAttention"), of(W, "MiniMaxH3SigmaShift"), of(W, "ModelAttentionBackend")
sched = W[of(W, "BasicScheduler")[0]]["inputs"]
guide = W[of(W, "BasicGuider")[0]]["inputs"]
check("fasth3_omni_r2v.json: UNET = the FastH3 Omni int8 file, H3's encoder + VAEs; the template's chain loader -> shift 12/3 -> kitchen attention -> VSA keep 10",
      W[of(W, "UNETLoader")[0]]["inputs"]["unet_name"] == "fasth3_omniref_8step_pruned_int8_convrot.safetensors"
      and W[sh[0]]["inputs"]["shift_video"] == 12 and W[sh[0]]["inputs"]["shift_audio"] == 3
      and W[be[0]]["inputs"]["attention"] == "comfy kitchen attention"
      and W[bs[0]]["inputs"]["selection"] == "vsa" and W[bs[0]]["inputs"]["selection.keep_percent"] == 10
      and W[bs[0]]["inputs"]["model"] == [be[0], 0] and W[be[0]]["inputs"]["model"] == [sh[0], 0])
check("...the scheduler AND the guider read the VSA model (the shift reaches the sigmas); 8 steps euler simple",
      sched["model"] == [bs[0], 0] and guide["model"] == [bs[0], 0] and sched["steps"] == 8
      and W[of(W, "KSamplerSelect")[0]]["inputs"]["sampler_name"] == "euler" and sched["scheduler"] == "simple")
check("...the native MiniMaxH3ReferenceToVideo with a picture slot (the board's 9 pictures / 3 videos / 3 sounds ride it)",
      len(of(W, "MiniMaxH3ReferenceToVideo")) == 1 and "ref_images.ref_image_0" in W[of(W, "MiniMaxH3ReferenceToVideo")[0]]["inputs"])
W2, n2 = F.apply(copy.deepcopy(W))
check("apply on the shipped graph: no node added, the values kept", len(W2) == len(W) and W2[bs[0]] == W[bs[0]], n2)

# 3 H3's own scene graph with the FastH3 file swapped in (Basic Settings' model / a style's Model)
G = load("h3_scene_api.json")
uid = of(G, "UNETLoader")[0]
G[uid]["inputs"]["unet_name"] = "fasth3_omniref_8step_pruned_int8_convrot.safetensors"
check("detect: the FastH3 file in any loader -> omni; H3's own graph -> None", F.detect(G) == "omni" and F.detect(load("h3_scene_api.json")) is None)
g, notes = F.apply(copy.deepcopy(G), kitchen=False)
s3, b3, a3 = of(g, "MiniMaxH3SigmaShift"), of(g, "BlockSparseAttention"), of(g, "ModelAttentionBackend")
sc = g[of(g, "BasicScheduler")[0]]["inputs"]
gd = g[of(g, "BasicGuider")[0]]["inputs"]
check("h3_scene_api + FastH3: shift right after the loader, backend -> VSA at the guider; scheduler + guider on the VSA model",
      len(s3) == len(b3) == len(a3) == 1 and g[s3[0]]["inputs"]["model"] == [uid, 0] and g[a3[0]]["inputs"]["model"] == [s3[0], 0]
      and g[b3[0]]["inputs"]["model"] == [a3[0], 0] and gd["model"] == [b3[0], 0] and sc["model"] == [b3[0], 0], notes)
check("...no comfy kitchen here -> the backend is pytorch attention; vsa keep 10 start 0; steps 8 (the graph's 6 from a Primitive is replaced only when literal)",
      g[a3[0]]["inputs"]["attention"] == "pytorch attention" and g[b3[0]]["inputs"]["selection"] == "vsa"
      and g[b3[0]]["inputs"]["start_percent"] == 0.0 and g[of(g, "KSamplerSelect")[0]]["inputs"]["sampler_name"] == "euler", g[a3[0]])
check("...the scheduler's steps: a linked Primitive stays linked (its value is the graph's), a literal becomes 8",
      isinstance(sc["steps"], list))
g5, _ = F.apply({"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "fasth3_omniref_8step_pruned_int8_convrot.safetensors"}},
                 "2": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "steps": 20, "scheduler": "beta", "denoise": 1}},
                 "3": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["9", 0]}}}, explicit_steps=0)
g6, n6 = F.apply({"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "fasth3_omniref_8step_pruned_int8_convrot.safetensors"}},
                  "2": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "steps": 20, "scheduler": "beta", "denoise": 1}},
                  "3": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["9", 0]}}}, explicit_steps=6)
check("steps: literal 20 -> 8 (simple); an explicit Basic Settings count stays (6) and the log says it is distilled for 8",
      g5["2"]["inputs"]["steps"] == 8 and g5["2"]["inputs"]["scheduler"] == "simple" and g6["2"]["inputs"]["steps"] == 6
      and any("distilled for 8" in x for x in n6), n6)

# 4 the official ref2va export: its turbo LoRA comes out, its loader feeds the shift
R = load("ref2va.json")
lora = of(R, "LoraLoaderModelOnly")
uidr = of(R, "UNETLoader")[0]
R[uidr]["inputs"]["unet_name"] = "fasth3_omniref_8step_pruned_int8_convrot.safetensors"
lname = R[lora[0]]["inputs"].get("lora_name", "") if lora else ""
r2, rn = F.apply(copy.deepcopy(R))
links = [x for v in r2.values() for x in (v.get("inputs") or {}).values() if isinstance(x, list) and len(x) == 2]
check("ref2va.json + FastH3: its turbo LoRA (" + str(lname)[:40] + ") taken out and nothing still points at it; the shift + VSA in",
      (not lora or ("turbo" not in lname.lower() and "step" not in lname.lower()) or (lora[0] not in r2 and not any(str(x[0]) == str(lora[0]) for x in links)))
      and len(of(r2, "MiniMaxH3SigmaShift")) == 1 and len(of(r2, "BlockSparseAttention")) == 1, rn)
dangling = [x for x in links if str(x[0]) not in r2]
check("...no dangling link anywhere", not dangling, dangling[:5])

# 5 the fl2va warning + CFGGuider to 1
FL = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "fasth3_omniref_8step_pruned_int8_convrot.safetensors"}},
      "2": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {}},
      "3": {"class_type": "CFGGuider", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["2", 0], "cfg": 3}}}
fg, fn = F.apply(copy.deepcopy(FL))
check("an fl2va graph with the Omni file: a WARNING in the log; a CFGGuider runs at cfg 1",
      any("WARNING" in x for x in fn) and fg["3"]["inputs"]["cfg"] == 1.0, fn)

# 6 worker.apply_video_accel keeps VSA
ga, an = worker.apply_video_accel(copy.deepcopy(W), {"sage": "auto", "spectrum": "on", "veda": "fast", "long": "on", "kitchen_attn": True})
cls = [v.get("class_type") for v in ga.values()]
check("apply_video_accel on a VSA graph: sage / spectrum / veda skipped (said), Long video = only the chunked feed-forward",
      worker.ACCEL_CHUNKFF in cls and worker.ACCEL_LOWVRAM not in cls and worker.ACCEL_SPECTRUM not in cls
      and worker.ACCEL_SAGE_GENERIC not in cls and any("VSA" in x for x in an), an)
gb, _ = worker.apply_video_accel(copy.deepcopy(load("h3_scene_api.json")), {"long": "on"})
check("...an H3 graph without VSA keeps the whole Long video chain (low-VRAM attention + chunked feed-forward)",
      worker.ACCEL_LOWVRAM in [v.get("class_type") for v in gb.values()])

# 7 the worker hook is wired after the refmods, before the upscale stage, and drops cfg to 1
src = open(os.path.join(ROOT, "worker.py"), encoding="utf-8").read()
i_ref, i_f3, i_us = src.find("g = _apply_refmods(g, params.get(\"refmods\"))"), src.find("_f3.apply(g, explicit_steps="), src.find("if params.get(\"upscale_stage\"):        # 2.312.0")
check("worker.py: import fasth3 guarded; the hook after _apply_refmods and before the upscale stage; cfg -> 1; kitchen asked of ComfyUI",
      "import fasth3 as _f3" in src and 0 < i_ref < i_f3 < i_us and "cfg_val = 1.0" in src[i_f3:i_us] and "def _kitchen_attn(base)" in src)

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
