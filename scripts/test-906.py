#!/usr/bin/env python3
"""bitGen Studio 2.906.0 - misc/worker.py _size_words (the size asked vs what each MiniMax H3 node got) and
probe_take_wh (the take's own size). Run: python3 scripts/test-906.py"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "misc"))
sys.argv = ["x"]
import worker as W   # noqa: E402
P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS:", name)
    else:
        F += 1
        print("FAIL:", name, "" if got is None else json.dumps(got, default=str)[:500])


g = json.loads((ROOT / "comfy_workflows" / "fasth3_omni_r2v.json").read_text(encoding="utf-8"))
s0 = W._size_words(g, {"width": 544, "height": 960})
check("_size_words: FastH3 Omni as exported - its size is linked (ResolutionSelector), said as such", "linked (336 MiniMaxH3ReferenceToVideo" in s0 and "asked 544x960" in s0, s0)
g["336"]["inputs"].update({"width": 544, "height": 960})
s1 = W._size_words(g, {"width": 544, "height": 960, "_req_w": 544, "_req_h": 960})
check("_size_words: after the patch - 544x960 on node 336", s1 == "render size asked 544x960: 544x960 (336 MiniMaxH3ReferenceToVideo)", s1)
check("_size_words: a graph without an H3 node says so", "no MiniMax H3 node" in W._size_words({"1": {"class_type": "KSampler", "inputs": {}}}, {"width": 1, "height": 1}))
with tempfile.TemporaryDirectory() as d:
    v = Path(d) / "t.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:size=544x960:duration=0.2", str(v)], check=True)
    check("probe_take_wh: a 9:16 take reads 544x960", W.probe_take_wh(v) == (544, 960), W.probe_take_wh(v))
    check("probe_take_wh: not a video -> None", W.probe_take_wh(Path(d) / "nope.mp4") is None)
print(f"\nRESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
