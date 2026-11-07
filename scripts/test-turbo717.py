#!/usr/bin/env python3
"""bitGen Studio — 2.717.0 units: THE TESTER'S FINDINGS, FIXED in the video accelerators (misc/worker.py).

Tim: "can we add the faster 8 step turbo model and fix the problems he talked about" - a tester's blind benchmark on one
RTX 3090 (two rounds of 32 same-seed pairs, two blind judges): Veda on fights / transformations 22 % faster and softer;
Veda on a 12.25 s long shot 628 s -> 222 s and not worse; Spectrum at 20 steps twice as fast but faces blurred; KJ
head-chunk attention + Sage on a long shot only 17 % (nothing to change - Long video leaves Sage out).
Run: python3 scripts/test-turbo717.py
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "misc")); sys.path.insert(0, HERE)
import worker                                                # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + repr(got)[:600]))


def h3(steps=8):
    return {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "h3.safetensors"}},
            "2": {"class_type": "MiniMaxH3Sampler", "inputs": {"model": ["1", 0]}},
            "3": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["9", 0]}},
            "4": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "steps": steps}}}


big = ["Two men fight on the rooftop, punches fly", "she TRANSFORMS into a wolf", "a car chase through the market",
       "the tower explodes", "兩人在屋頂上打鬥", "怪物变身", "戦闘シーン", "a backflip off the wall", "sword fight at dawn"]
calm = ["a man talks to the camera by the waterfall", "she walks slowly through the garden", "close-up, he smiles and speaks",
        "the fighter jet on display in a museum hall"]
check("is_big_motion: fights, transformations, chases, explosions, stunts - English, 中文, 日本語", all(worker.is_big_motion(p) for p in big),
      [p for p in big if not worker.is_big_motion(p)])
check("…not a dialogue, a walk, a smile - nor 'fighter jet' (whole words only)", not any(worker.is_big_motion(p) for p in calm),
      [p for p in calm if worker.is_big_motion(p)])

g, n = worker.apply_video_accel(h3(), {"veda": "on"}, prompt="Two men fight on the rooftop")
check("Veda on + a fight: this shot runs without Veda, with a note saying why", "h3veda" not in g and g["3"]["inputs"]["model"] == ["1", 0]
      and any("Veda skipped for this shot" in x and "big motion" in x for x in n), n)
g, n = worker.apply_video_accel(h3(), {"veda": "on", "veda_action": "keep"}, prompt="Two men fight on the rooftop")
check("…the style's 'Veda on action shots too' (veda_action keep): Veda stays", "h3veda" in g and g["3"]["inputs"]["model"] == ["h3veda", 0], n)
g, n = worker.apply_video_accel(h3(), {"veda": "quality"}, prompt="a man talks to the camera by the waterfall")
check("…a dialogue shot: Veda as before", "h3veda" in g and not any("skipped" in x for x in n), n)
g, n = worker.apply_video_accel(h3(), {"veda": "on"})
check("…no prompt (the swap worker): Veda as before", "h3veda" in g)

g, n = worker.apply_video_accel(h3(), {"veda": "on", "long": "on", "kitchen_attn": True}, prompt="a long walk and talk")
check("Long video + Veda: Veda replaces the low-VRAM attention (and the kitchen backend); the chunked feed-forward stays, Veda last",
      "h3lowvram" not in g and "h3attnbe" not in g and g["h3chunkff"]["inputs"]["model"] == ["1", 0] and g["h3veda"]["inputs"]["model"] == ["h3chunkff", 0]
      and g["3"]["inputs"]["model"] == ["h3veda", 0] and any("Veda replaces the low-VRAM attention" in x for x in n), n)
g, n = worker.apply_video_accel(h3(), {"veda": "on", "long": "on"}, prompt="they fight in the rain")
check("…a long ACTION shot: Veda skipped, so the low-VRAM attention stays (the old long chain)", "h3veda" not in g and "h3lowvram" in g and "h3chunkff" in g, n)
g, n = worker.apply_video_accel(h3(), {"long": "on"})
check("…Long video without Veda: unchanged (low-VRAM attention + chunked feed-forward)", "h3lowvram" in g and "h3chunkff" in g and "h3veda" not in g)
g, n = worker.apply_video_accel(h3(), {"long": "on", "sage": "auto"})
check("…and Long video still leaves Sage out (KJ head chunks + Sage measured only 17 % faster)", "h3sage" not in g and any("sage auto skipped" in x for x in n), n)

g, n = worker.apply_video_accel(h3(20), {"spectrum": "on"})
sp = g["h3spectrum"]["inputs"]
check("Spectrum on, a 20-step run: 2 real steps first, 3 last (faces / fine detail never forecast), said in the log",
      sp.get("warmup_steps") == 2 and sp.get("tail_actual_steps") == 3 and sp.get("enabled") is True and any("3 last of 20" in x for x in n), (sp, n))
g, n = worker.apply_video_accel(h3(8), {"spectrum": "on"})
check("…an 8-step run: the node's own defaults (too few steps to hold more back)", "warmup_steps" not in g["h3spectrum"]["inputs"] and "tail_actual_steps" not in g["h3spectrum"]["inputs"])
g, n = worker.apply_video_accel(h3(20), {"spectrum": "aggressive"})
check("…aggressive keeps the README's preset (blend 0.75, flex 3.0) and nothing more", g["h3spectrum"]["inputs"].get("blend_weight") == 0.75 and "tail_actual_steps" not in g["h3spectrum"]["inputs"])
check("_graph_steps: the largest integer steps in the graph", worker._graph_steps(h3(25)) == 25 and worker._graph_steps({"1": {"inputs": {"steps": ["x", 0]}}}) == 0)
src = open(os.path.join(ROOT, "misc", "worker.py"), encoding="utf-8").read()
check("the worker passes the job's prompt in", 'apply_video_accel(g, vstyle.get("accel"), prompt=params.get("prompt") or "")' in src)
print("\nRESULT: %s (%d passed, %d failed)" % ("PASS" if not FAIL else "FAIL", PASS, FAIL))
sys.exit(1 if FAIL else 0)
