#!/usr/bin/env python3
"""Unit tests for scripts/timeline_span.py — the compile's length.

The SAME case table is run against the Node mirror by scripts/test-timeline.js.
CASES below is the shared contract: if you add a case here, add it there, or
the two halves of the compile will disagree about how long the movie is.

Run: python3 scripts/test-span.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import timeline_span as ts   # noqa: E402

ok = fail = 0


def check(name, got, want, eps=1e-6):
    global ok, fail
    if abs(float(got) - float(want)) <= eps:
        ok += 1
        print(f"  ok   {name}  ({got})")
    else:
        fail += 1
        print(f"  FAIL {name}: got {got}, want {want}")


# --------------------------------------------------------------- shared table
# Each entry: (name, timeline, expected scene_end). Mirrored in test-timeline.js.
CASES = [
    ("empty timeline", {}, 0),
    ("base track only, trimmed",
     {"video": [{"start": 0, "in": 1, "out": 4}]}, 3),
    ("base track only, untrimmed with dur",
     {"video": [{"start": 2, "in": 0, "dur": 3}]}, 5),
    # NOT 5s. An unmeasurable clip contributes NOTHING, so this timeline has
    # no known length at all and compile_span() falls back to the rendered
    # base track. Guessing here padded real exports with black.
    ("no out and no dur contributes nothing",
     {"video": [{"start": 0}]}, 0),
    ("an unmeasurable clip does not suppress a measurable one",
     {"video": [{"start": 0, "out": 2}, {"start": 9}]}, 2),

    # THE REGRESSION THIS FILE EXISTS FOR: an overlay that outlasts the base
    # track. The compile used to stop at 2.0 and throw the rest away.
    ("overlay layer outlasts the base track",
     {"video": [{"start": 0, "in": 0, "out": 2}],
      "video_layers": [{"clips": [{"start": 3, "in": 0, "out": 4}]}]}, 7),
    ("the LAST of several layers wins, whatever the layer order",
     {"video": [{"start": 0, "out": 2}],
      "video_layers": [{"clips": [{"start": 9, "out": 1}]},
                       {"clips": [{"start": 1, "out": 2}]}]}, 10),
    ("a sound layer alone can define the length",
     {"video": [{"start": 0, "out": 2}],
      "audio": [[{"start": 4, "in": 0, "out": 6}]]}, 10),
    ("an image layer alone can define the length",
     {"video": [{"start": 0, "out": 2}],
      "images": [{"clips": [{"start": 5, "len": 4}]}]}, 9),
    ("an image with no len is 3s",
     {"video": [{"start": 0, "out": 1}],
      "images": [[{"start": 2}]]}, 5),

    # both track shapes, because saved projects still hold the old one
    ("legacy bare-array audio track",
     {"video": [{"start": 0, "out": 1}],
      "audio": [[{"start": 1, "out": 2}]]}, 3),
    ("2.60.0 {clips} audio track",
     {"video": [{"start": 0, "out": 1}],
      "audio": [{"transition_in": None, "clips": [{"start": 1, "out": 2}]}]}, 3),

    ("a base track longer than every layer still wins",
     {"video": [{"start": 0, "out": 30}],
      "video_layers": [{"clips": [{"start": 0, "out": 2}]}],
      "audio": [[{"start": 0, "out": 5}]]}, 30),
    ("a zero-length clip is clamped to a tenth of a second",
     {"video": [{"start": 4, "in": 2, "out": 2}]}, 4.1),
    ("junk values do not throw",
     {"video": [{"start": "x", "out": "y"}]}, 0),
]

print("timeline_span.scene_end")
for name, tl, want in CASES:
    check(name, ts.scene_end(tl), want)

# ------------------------------------------------------------------ the probe
print("timeline_span probe fallback")
probed = {"n": 0}


def probe(p):
    probed["n"] += 1
    return 8.0


tl = {"video": [{"start": 1, "in": 0, "path": "/x.webm"}]}
check("a clip with neither out nor dur is probed", ts.scene_end(tl, probe=probe), 9)
check("the probe was actually called", probed["n"], 1)
check("out wins over the probe",
      ts.scene_end({"video": [{"start": 0, "out": 2, "path": "/x"}]}, probe=probe), 2)
check("dur wins over the probe",
      ts.scene_end({"video": [{"start": 0, "dur": 3, "path": "/x"}]}, probe=probe), 3)


def boom(_p):
    raise OSError("no such file")


check("a probe that raises contributes nothing rather than killing the export",
      ts.scene_end({"video": [{"start": 0, "path": "/gone"}]}, probe=boom), 0)

# ------------------------------------------------------------- compile_span
print("timeline_span.compile_span")
tl = {"video": [{"start": 0, "out": 2}],
      "video_layers": [{"clips": [{"start": 3, "out": 1}]}]}
check("the timeline beats a shorter rendered base track",
      ts.compile_span(tl, base_dur=2.0), 4)
check("a rendered base track longer than the timeline is never truncated",
      ts.compile_span({"video": [{"start": 0, "out": 1}]}, base_dur=9.0), 9)
check("the route's hint is honoured when it is the largest",
      ts.compile_span(tl, base_dur=2.0, hint=12.5), 12.5)
check("a stale/short hint cannot shorten the compile",
      ts.compile_span(tl, base_dur=2.0, hint=1.0), 4)

# ---------------------------------------------------------------- pad_needed
print("timeline_span.pad_needed")
check("padding is the shortfall", ts.pad_needed(7.0, 2.0), 5.0)
check("nothing to pad when they match", ts.pad_needed(2.0, 2.0), 0.0)
check("a negative shortfall never pads", ts.pad_needed(1.0, 4.0), 0.0)
check("sub-frame shortfalls are not worth an encode", ts.pad_needed(2.02, 2.0), 0.0)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
