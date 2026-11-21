#!/usr/bin/env python3
"""bitGen Studio 2.905.0 - Override style on EVERY video model (Tim: "make sure it works with all video models - it is not
overiding with fast h3 omni"). The Python half: scripts/fasth3.py keep_cfg, scripts/h3_16gb.py pass-1 steps,
misc/worker.py _chain_override + the FastH3 / 16 GB / Viggle cfg rules, misc/swap_worker.py swap_basic,
scripts/basic_apply.py a second pass's seed. Run: python3 scripts/test-905.py"""
import copy
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "misc"))
sys.argv = ["x"]
P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS:", name)
    else:
        F += 1
        print("FAIL:", name, "" if got is None else json.dumps(got, default=str)[:600])


import fasth3 as F3          # noqa: E402
import h3_16gb as H16        # noqa: E402
import basic_apply as BA     # noqa: E402

# 1. FastH3: the recipe's cfg 1 only when Override did not send one
G = json.loads((ROOT / "comfy_workflows" / "fasth3_omni_r2v.json").read_text(encoding="utf-8"))
g = copy.deepcopy(G)
g["331"] = {"class_type": "CFGGuider", "inputs": {"model": g["331"]["inputs"]["model"], "positive": ["336", 0], "negative": ["336", 0], "cfg": 3.5}}
g1, n1 = F3.apply(copy.deepcopy(g), explicit_steps=9)
g2, n2 = F3.apply(copy.deepcopy(g), explicit_steps=9, keep_cfg=True)
check("fasth3: a CFGGuider goes to cfg 1 without Override, keeps 3.5 with it (keep_cfg)",
      g1["331"]["inputs"]["cfg"] == 1.0 and g2["331"]["inputs"]["cfg"] == 3.5, [g1["331"], g2["331"]])
check("fasth3: the note says whose cfg", any("cfg 1" in n for n in n1) and any("cfg Basic Settings'" in n for n in n2), [n1[:2], n2[:2]])
check("fasth3: Override's 9 steps on the scheduler either way",
      g1["330"]["inputs"]["steps"] == 9 and g2["330"]["inputs"]["steps"] == 9)

# 2. worker.py: Override's cfg kept on FastH3 / 16 GB mode, Viggle says it cannot use it, chain plans take the values
W = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("worker: cfg_kept = params cfg_override (routes/index.js, routes/characters.js)",
      'cfg_kept = bool(params.get("cfg_override"))' in W)
check("worker: FastH3 keeps Override's cfg (keep_cfg=cfg_kept) and only forces 1 without it",
      "keep_cfg=cfg_kept" in W and re.search(r"if float\(cfg_val or 1\) > 1 and cfg_kept:.*\n.*\n.*\n\s+elif float\(cfg_val or 1\) > 1:\n.*\n\s+cfg_val = 1\.0", W) is not None)
check("worker: 16 GB mode keeps Override's cfg and gets its steps for pass 1",
      "16 GB mode: cfg {cfg_val} (Basic Settings - Override style) kept" in W and 'o16["steps"] = int(params.get("steps"))' in W)
check("worker: Viggle takes Override's steps; its cfg said, not silently dropped",
      'params.get("cfg_override") is not None\n' in W and "Viggle reads no prompt (a fixed text embedding)" in W)
check("worker: _patch_workflow gets override= only with Override style on", "override=({\"steps\": int(params.get(\"steps\") or 0)," in W
      and 'if params.get("cfg_override") is not None else None)' in W)
import worker as WK          # noqa: E402
cg = json.loads((ROOT / "comfy_workflows" / "MM3_Characters.json").read_text(encoding="utf-8"))
cg2 = copy.deepcopy(cg)
done = WK._chain_override(cg2, 640, 384, {"steps": 9, "seed": 777})
pn = next(v for v in cg2.values() if v.get("class_type") == "MiniMaxH3ChainPlan")
plan = json.loads(pn["inputs"]["plan_json"])
check("_chain_override: the plan node's size / default steps / base seed", (str(pn["inputs"]["width"]), str(pn["inputs"]["height"]),
      str(pn["inputs"]["default_steps"]), str(pn["inputs"]["base_seed"])) == ("640", "384", "9", "777"), pn["inputs"])
check("_chain_override: every shot 9 steps + seed 777, prompts and lengths kept",
      all(s.get("steps") == 9 and str(s.get("seed")) == "777" for s in plan["shots"])
      and [s.get("length") for s in plan["shots"]] == [s.get("length") for s in json.loads(
          next(v for v in cg.values() if v.get("class_type") == "MiniMaxH3ChainPlan")["inputs"]["plan_json"])["shots"]]
      and [s.get("prompt") for s in plan["shots"]] == [s.get("prompt") for s in json.loads(
          next(v for v in cg.values() if v.get("class_type") == "MiniMaxH3ChainPlan")["inputs"]["plan_json"])["shots"]], plan["shots"][:2])
check("_chain_override: says what it wrote", done == ["size 640x384", "9 steps a shot", "seed 777 for every shot"], done)
cg3 = copy.deepcopy(cg)
WK._chain_override(cg3, 640, 384, {"steps": 0, "seed": None})
p3 = json.loads(next(v for v in cg3.values() if v.get("class_type") == "MiniMaxH3ChainPlan")["inputs"]["plan_json"])
p0 = json.loads(next(v for v in cg.values() if v.get("class_type") == "MiniMaxH3ChainPlan")["inputs"]["plan_json"])
check("_chain_override: steps 0 (auto) and a random seed leave the plan's own", [(s["steps"], s["seed"]) for s in p3["shots"]]
      == [(s["steps"], s["seed"]) for s in p0["shots"]])

# 3. 16 GB mode: pass 1 = Override's steps when given
H = (ROOT / "scripts" / "h3_16gb.py").read_text(encoding="utf-8")
check("h3_16gb: pass 1's steps = o['steps'] when set, else 8", 'p1 = int(o.get("steps") or 0) if int(o.get("steps") or 0) > 0 else STEPS' in H
      and 'g[f["scheduler"]]["inputs"]["steps"] = p1' in H)

# 4. swap_worker: Override's steps over the quality preset, cfg -> true CFG
import swap_worker as SW     # noqa: E402
said = []
SW.say = said.append
sg = {"124": {"class_type": "BasicScheduler", "inputs": {"steps": 20, "scheduler": "beta", "denoise": 1}},
      "r": {"class_type": "BasicScheduler", "inputs": {"steps": 2, "denoise": 0.3}}}
SW.swap_basic(sg, {"basic": {"steps": 9, "cfg": None}})
check("swap_basic: 9 steps on the main scheduler (a refine pass's own kept)", sg["124"]["inputs"]["steps"] == 9 and sg["r"]["inputs"]["steps"] == 2, sg)
check("swap_basic: no basic = untouched", SW.swap_basic({"a": {"class_type": "BasicScheduler", "inputs": {"steps": 20}}}, {})["a"]["inputs"]["steps"] == 20)
check("swap_worker: swap_basic runs after the quality preset", "graph = swap_quality(base, graph, params.get(\"quality\"))\n    graph = swap_basic(graph, params)"
      in (ROOT / "misc" / "swap_worker.py").read_text(encoding="utf-8"))

# 5. basic_apply: a seed set in Basic Settings reaches a second pass's noise (LTX 2.3's fixed 42)
g5 = {"a": {"class_type": "RandomNoise", "inputs": {"noise_seed": 42}}, "b": {"class_type": "RandomNoise", "inputs": {"noise_seed": 777}}}
n5 = BA.apply(g5, {"seed": 777})
check("basic_apply: the seed's noise kept, the other pass's 42 -> 778", g5["b"]["inputs"]["noise_seed"] == 777 and g5["a"]["inputs"]["noise_seed"] == 778
      and any("42 -> 778" in n for n in n5), [g5, n5])
g6 = {"a": {"class_type": "RandomNoise", "inputs": {"noise_seed": 5}}}
check("basic_apply: a random seed (-1) leaves the noise alone", BA.apply(g6, {"seed": -1}) == [] and g6["a"]["inputs"]["noise_seed"] == 5)

print(f"\nRESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
