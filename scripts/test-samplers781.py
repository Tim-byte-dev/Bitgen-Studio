#!/usr/bin/env python3
"""bitGen Studio — 2.781.0: Basic Settings' sampler / scheduler written into the graph a worker sends
(scripts/comfy_client.py apply_sampler_pick - called by queue() and worker.py's own send).
Tim (verbatim): "please add a list of samplers to the basic settings docker above the checkpoint dropdowns." """
import copy, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import comfy_client as cc

P = F = 0
def check(n, c, got=None):
    global P, F
    if c: P += 1; print("PASS: " + n)
    else: F += 1; print("FAIL: " + n + ("" if got is None else "\n      got " + repr(got)[:600]))

G = {"3": {"class_type": "KSampler", "inputs": {"sampler_name": "euler", "scheduler": "simple", "steps": 20, "model": ["4", 0]}},
     "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
     "9": {"class_type": "BasicScheduler", "inputs": {"scheduler": "beta", "steps": 8}},
     "11": {"class_type": "SomePackSampler", "inputs": {"sampler_name": "flowmatch_custom", "scheduler": "linear"}},
     "12": {"class_type": "Linked", "inputs": {"sampler_name": ["8", 0]}}}
cc._SAMPLER_LISTS["http://x"] = (list(cc.BUILTIN_SAMPLERS), list(cc.BUILTIN_SCHEDULERS), True)
said = []
g = copy.deepcopy(G)
r = cc.apply_sampler_pick("http://x", g, "dpmpp_2m", "karras", say=said.append)
check("written into every node with ComfyUI's own names (KSampler, KSamplerSelect, BasicScheduler)", r == {"sampler": ["3", "8"], "scheduler": ["3", "9"]} and g["3"]["inputs"]["sampler_name"] == "dpmpp_2m" and g["8"]["inputs"]["sampler_name"] == "dpmpp_2m" and g["9"]["inputs"]["scheduler"] == "karras", (r, g))
check("…a custom node with words of its own and a linked input are left alone", g["11"]["inputs"] == {"sampler_name": "flowmatch_custom", "scheduler": "linear"} and g["12"]["inputs"]["sampler_name"] == ["8", 0])
check("…said in the job's log", said and said[0].startswith("[sampler] Basic Settings - sampler dpmpp_2m: node(s) 3, 8; scheduler karras: node(s) 3, 9"), said)
said.clear(); g = copy.deepcopy(G)
r = cc.apply_sampler_pick("http://x", g, "not_a_sampler", "", say=said.append)
check("a name this ComfyUI does not list: the workflow's own kept, said", r == {"sampler": [], "scheduler": []} and g == G and "not in this ComfyUI's list" in said[0], said)
said.clear(); g = copy.deepcopy(G)
check("nothing picked: nothing changes, nothing said", cc.apply_sampler_pick("http://x", g, "", "", say=said.append) == {"sampler": [], "scheduler": []} and g == G and not said)
said.clear(); g = {"1": {"class_type": "ManualSigmas", "inputs": {"sigmas": "1,0.5,0"}}, "2": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}}}
cc.apply_sampler_pick("http://x", g, "euler_ancestral", "karras", say=said.append)
check("a distilled graph (fixed sigmas, no scheduler node): the sampler goes in, the fixed steps are kept and said", g["2"]["inputs"]["sampler_name"] == "euler_ancestral" and "fixed steps (sigmas) are kept" in said[0], said)
os.environ["BITGEN_SAMPLER"], os.environ["BITGEN_SCHEDULER"] = "heun", ""
g = copy.deepcopy(G); cc.apply_sampler_pick("http://x", g, say=lambda t: None)
check("from the job's environment (BITGEN_SAMPLER / BITGEN_SCHEDULER - lib/core.js)", g["3"]["inputs"]["sampler_name"] == "heun" and g["3"]["inputs"]["scheduler"] == "simple")
src = open(os.path.join(os.path.dirname(__file__), "comfy_client.py")).read()
w = open(os.path.join(os.path.dirname(__file__), "..", "misc", "worker.py")).read()
check("queue() applies it before sending; worker.py's own send too", "apply_sampler_pick(base, graph)" in src.split("def queue(")[1][:400] and "_cc.apply_sampler_pick(base, graph, say=say)" in w)
print(f"\nRESULT: {P} passed, {F} failed"); sys.exit(1 if F else 0)
