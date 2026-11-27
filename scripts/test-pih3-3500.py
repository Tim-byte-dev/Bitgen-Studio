#!/usr/bin/env python3
"""bitGen Studio — 3.5.0: pi-H3 graphs (comfy_workflows/pi_h3_dwd_*.json) + scripts/pih3.py (attention, adapter twin) + the
worker filling them. Tim: "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose
which model to dl"."""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, "misc"))
import pih3 as P
import worker

N = F = 0
def check(n, c, got=None):
    global N, F
    if c: N += 1; print("PASS: " + n)
    else: F += 1; print("FAIL: " + n + ("" if got is None else "\n      got " + repr(got)[:700]))

def load(s):
    return json.load(open(os.path.join(ROOT, "comfy_workflows", "pi_h3_dwd_%dstep.json" % s), encoding="utf-8"))

g2, g4 = load(2), load(4)
cls = lambda g, c: [k for k, v in g.items() if v.get("class_type") == c]
check("the graphs: H3 FL2VA int8 + the 2 / 4-step DWD adapter, shift 12/3, pi-Flow Scheduler (0.93 / 0.96, 0.6), DWD Decode, no VAEDecode",
      g2["1"]["inputs"]["unet_name"] == "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
      and g2["2"]["inputs"]["adapter_name"] == "pi_h3_2step_dwd_adapter_int8_convrot.safetensors" and g4["2"]["inputs"]["adapter_name"] == "pi_h3_4step_dwd_adapter_int8_convrot.safetensors"
      and g2["3"]["inputs"]["shift_video"] == 12 and g2["12"]["inputs"]["steps"] == 2 and g2["12"]["inputs"]["max_raw_t"] == 0.93 and g4["12"]["inputs"]["max_raw_t"] == 0.96
      and g2["12"]["inputs"]["final_step_size_scale"] == 0.6 and cls(g2, "DWD Decode") and not cls(g2, "VAEDecode") and g2["18"]["inputs"]["images"] == ["16", 0])
check("detect / steps_of", P.detect(g2) and not P.detect({"1": {"class_type": "UNETLoader", "inputs": {}}}) and P.steps_of(g4) == 4)

SPEC = {"input": {"required": {"model": ["MODEL"], "mode": [["quality", "speed"], {"default": "quality"}], "steps": ["INT", {"default": 20}],
                               "topk_ratio": ["FLOAT", {"default": 0.2}]}, "optional": {"chunk_path": ["STRING", {"default": "none"}]}}}
KJS = {"input": {"required": {"model": ["MODEL"], "tau": ["FLOAT", {"default": 1.0}], "dense_blocks": ["STRING", {"default": "0-1"}]}}}
g, n = P.apply(copy.deepcopy(g2), {"classes": {"MiniMaxH3SparkAttentionSM89": SPEC, "SolAttnPatch": KJS}, "gpu": "cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync"})
check("auto: Spark-Attn for this GPU (RTX 40 = SM89), mode speed, steps = the sampler's, the rest its defaults",
      g["4"] == {"class_type": "MiniMaxH3SparkAttentionSM89", "inputs": {"model": ["3", 0], "mode": "speed", "steps": 2, "topk_ratio": 0.2, "chunk_path": "none"},
                 "_meta": {"title": "pi-H3 Spark-Attn"}} and "Spark-Attn" in n[-1], (g["4"], n))
g, n = P.apply(copy.deepcopy(g2), {"classes": {"MiniMaxH3SparkAttentionSM120": SPEC, "SolAttnPatch": KJS}, "gpu": "NVIDIA GeForce RTX 3090"})
check("…a Spark node for another GPU is not used: Kijai's Sol-Attn", g["4"]["class_type"] == "SolAttnPatch" and g["4"]["inputs"] == {"model": ["3", 0], "tau": 1.0, "dense_blocks": "0-1"}, g["4"])
g, n = P.apply(copy.deepcopy(g2), {"classes": {}, "gpu": ""})
check("…neither: the built-in Sol-Attn stays, said", g["4"]["class_type"] == "BlockSparseAttention" and "built-in" in n[-1], n)
g, n = P.apply(copy.deepcopy(g2), {"classes": {"SolAttnPatch": KJS}}, attention="dense")
check("dense: the sparse node out, its consumers on the shift", "4" not in g and g["12"]["inputs"]["model"] == ["3", 0] and g["13"]["inputs"]["model"] == ["3", 0], g.get("12"))
AD = {"input": {"required": {"model": ["MODEL"], "adapter_name": [["pi_h3_2step_dwd_adapter.safetensors", "x.safetensors"]], "adapter_strength": ["FLOAT", {}]}}}
g, n = P.apply(copy.deepcopy(g2), {"classes": {"Load LakonLab Adapter": AD}})
check("only the bf16 adapter downloaded: the graph loads it", g["2"]["inputs"]["adapter_name"] == "pi_h3_2step_dwd_adapter.safetensors" and any("bf16" in x for x in n), n)
for name, gpu, want in (("3090", "NVIDIA GeForce RTX 3090", "MiniMaxH3SparkAttentionSM86"), ("5090", "NVIDIA GeForce RTX 5090", "MiniMaxH3SparkAttentionSM120"),
                        ("PRO", "NVIDIA RTX PRO 6000 Blackwell Workstation Edition", "MiniMaxH3SparkAttentionSM120"), ("H100", "NVIDIA H100 80GB HBM3", None), ("A100", "NVIDIA A100-SXM4-80GB", None)):
    check("spark_class " + name, P.spark_class(gpu, {c: 1 for c in P.SPARK}) == want)

out = worker._patch_workflow(copy.deepcopy(g2), prompt="a fox in snow", seed=7, frames=124, width=1344, height=768, steps=0, cfg=1.0,
                             images=["first.png"], videos=[], audios=[], use_lora=False)
check("the worker fills it: prompt, size, length, seed, the first frame wired, the empty last frame dropped",
      out["10"]["inputs"]["prompt"] == "a fox in snow" and out["10"]["inputs"]["length"] == 124 and out["14"]["inputs"]["noise_seed"] == 7
      and out["10"]["inputs"]["first_frame"] == ["8", 0] and "last_frame" not in out["10"]["inputs"] and out["8"]["inputs"]["image"] == "first.png", out["10"])
w = open(os.path.join(ROOT, "misc", "worker.py"), encoding="utf-8").read()
check("worker.py: pih3.apply after the refs (cfg 1, no 16 GB mode on a pi-H3 graph)",
      "g, pinotes = _pi.apply(g, _pi.info(base), attention=att)" in w and "if not rp and not is_pi:" in w)
print(f"\n{N} passed, {F} failed")
sys.exit(1 if F else 0)
