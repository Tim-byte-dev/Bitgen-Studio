#!/usr/bin/env python3
"""bitGen Studio — 2.572.0 units: scripts/cliptail.py - a clip held under the next one for its transition (its own frames
past its out point when the file has them, then its last frame held; its sound then silence). Run: python3 scripts/test-autotr572.py
Tim: "for music videos it is important that the lipsync is timed well"."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cliptail as T                                       # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:700] if got is not None else ""))


p1 = T.plan({"in": 1, "out": 3, "tail": 0.5}, 10)
p2 = T.plan({"in": 0, "out": 4, "tail": 0.5}, 4)
p3 = T.plan({"in": 0, "out": None, "tail": 0.25}, 4.2)
check("plan: a file with frames past the out point uses them (no hold); a clip to the file's end holds its last frame; out = none = the file's end",
      p1 == {"start": 1, "src_end": 3.5, "hold": 0.0, "length": 2.5} and p2 == {"start": 0, "src_end": 4, "hold": 0.5, "length": 4.5}
      and p3 == {"start": 0, "src_end": 4.2, "hold": 0.25, "length": 4.45}, (p1, p2, p3))
p4 = T.plan({"in": 0, "out": 3.9, "tail": 0.5}, 4)
check("...partly: 0.1 s of its own frames, then 0.4 s held", p4 == {"start": 0, "src_end": 4, "hold": 0.4, "length": 4.4}, p4)
check("...no tail / a tail over 4 s = none / 4 s", T.plan({"in": 0, "out": 2}, 5) is None and T.plan({"in": 0, "out": 2, "tail": 9}, 20)["length"] == 6, T.plan({"in": 0, "out": 2, "tail": 9}, 20))
f = T.filters(p2, True)
check("filters: the picture's last frame held (tpad clone), the sound padded with silence; without a hold, plain", "tpad=stop_mode=clone:stop_duration=0.5000" in f and "apad=pad_dur=0.5000" in f
      and "tpad" not in T.filters(p1, False) and "[a]" not in T.filters(p1, False), f)

# a real render: a 1 s red clip, a 0.5 s tail -> 1.5 s, its last frame held, the clip pointed at the new file
with tempfile.TemporaryDirectory() as d:
    src = Path(d) / "a.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=160x90:d=1:r=24", "-f", "lavfi", "-i", "sine=f=440:d=1",
                    "-shortest", "-pix_fmt", "yuv420p", "-c:a", "aac", str(src)], check=True)
    said = []

    def run(argv, echo_cmd=True):
        return subprocess.run(argv, capture_output=True).returncode
    tl = {"video": [{"path": str(src), "in": 0, "out": None, "start": 0, "tail": 0.5}],
          "video_layers": [{"clips": [{"path": str(src), "in": 0.2, "out": 0.6, "start": 1, "tail": 0.25}, {"path": str(src), "in": 0, "out": 1, "start": 2}]}]}
    n = T.prepare(tl, d, said.append, run)
    v = tl["video"][0]
    probe = T._probe(v["path"])
    ok_len = abs(probe["dur"] - 1.5) < 0.08
    # the last two frames are the same picture (held), the frame at 0.5 s differs from the end
    def frame(path, t):
        return subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    a1, a2, a0 = frame(v["path"], 1.2), frame(v["path"], 1.45), frame(v["path"], 0.5)
    check("prepare: V1's clip rendered 1.5 s (1 s + a 0.5 s tail), its last frame held, in 0 / out 1.5 - its start unchanged",
          n == 2 and ok_len and v["in"] == 0.0 and v["out"] == 1.5 and v["start"] == 0 and a1 == a2 and a1 != a0 and probe["audio"], (n, probe, v))
    w = tl["video_layers"][0]["clips"]
    check("...a layer clip with frames past its out point uses them (0.4 s + 0.25 s = 0.65 s); a clip without a tail is left alone",
          abs(w[0]["out"] - 0.65) < 1e-6 and w[0]["start"] == 1 and w[1]["path"] == str(src) and any("its start does not move" in s for s in said), (w, said))

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: FAIL" if FAIL else "RESULT: PASS")
sys.exit(1 if FAIL else 0)
