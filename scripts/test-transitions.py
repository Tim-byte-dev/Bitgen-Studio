#!/usr/bin/env python3
"""Transition catalogue + xfade arithmetic.

The offset maths is the whole reason this file exists. xfade OVERLAPS its two
inputs, so joining N clips with a d-second transition yields
sum(durations) - (N-1)*d, and every offset is measured on the running JOINED
timeline rather than on the original clips. Getting it wrong does not error —
it silently produces a video of the wrong length with clips landing early.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import transitions as tr                                        # noqa: E402

fails = 0


def check(name, cond, got=""):
    global fails
    print(("PASS: " if cond else "FAIL: ") + name)
    if not cond:
        fails += 1
        print("      got " + str(got)[:300])


# --- the catalogue is shared, so both readers must see the same thing --------
cat = tr.catalogue()
check("catalogue: it parses and has transitions", len(cat["transitions"]) > 5, len(cat["transitions"]))
check("catalogue: 'none' exists and is a cut (no xfade name)",
      tr.by_id("none") is not None and not tr.by_id("none")["xfade"], tr.by_id("none"))
ids = [t["id"] for t in cat["transitions"]]
check("catalogue: ids are unique", len(ids) == len(set(ids)), ids)
check("catalogue: every entry has id/label/group",
      all(t.get("id") and t.get("label") and t.get("group") for t in cat["transitions"]),
      "missing field")
check("catalogue: the standard set is present",
      all(i in ids for i in ("fade", "fadeblack", "fadewhite",
                             "wipeleft", "wiperight", "wipeup", "wipedown",
                             "slideleft", "slideright", "circleopen", "pixelize")), ids)

# Node and Python must agree — they read the same file, and this proves it
node = subprocess.run(["node", "-e",
                       "const t=require('./lib/transitions');"
                       "console.log(JSON.stringify(t.list().map(x=>x.id)))"],
                      capture_output=True, text=True, cwd=str(ROOT))
check("catalogue: Node and Python read the same list",
      json.loads(node.stdout.strip() or "[]") == ids, node.stdout.strip()[:200] or node.stderr[:200])

# --- normalize degrades rather than throws ----------------------------------
check("normalize: an unknown id becomes a cut",
      tr.normalize({"type": "does-not-exist"})["type"] == "none", tr.normalize({"type": "x"}))
check("normalize: a silly duration is clamped, not rejected",
      tr.normalize({"type": "fade", "dur": 999})["dur"] == cat["max_duration"],
      tr.normalize({"type": "fade", "dur": 999}))
check("normalize: junk input still yields a usable transition",
      tr.normalize(None)["type"] == "none" and tr.normalize("fade")["type"] == "none",
      tr.normalize(None))
check("is_active: a cut is not active", not tr.is_active({"type": "none"}), "active")
check("is_active: a wipe is active", tr.is_active({"type": "wipeleft"}), "inactive")

# --- the arithmetic ---------------------------------------------------------
durs = [5.0, 5.0, 5.0]
fc, labs = tr.build_xfade_chain(3, durs, "fade", 1.0, audio=True)
check("xfade: one filter per join", fc.count("xfade=") == 2, fc)
check("xfade: the first offset is clip1 minus the transition",
      "offset=4.000" in fc, fc)
# second join happens on the JOINED timeline: (5+5-1) - 1 = 8, not 9
check("xfade: the second offset is on the joined timeline, not the source",
      "offset=8.000" in fc, fc)
# [vo] is the LAST video label but not the last label overall — the audio chain
# is appended after it, which is exactly what tripped this assertion first time
check("xfade: the final video join is labelled [vo]",
      "[vo]" in fc and fc.split(";")[len(durs) + 1].endswith("[vo]"), fc)
check("xfade: video-only builds end on [vo]",
      tr.build_xfade_chain(2, [4.0, 4.0], "fade", 0.5)[0].endswith("[vo]"),
      tr.build_xfade_chain(2, [4.0, 4.0], "fade", 0.5)[0][-30:])
check("xfade: audio is crossfaded alongside", "acrossfade=" in fc and "[ao]" in fc, fc)
check("xfade: labels are returned for mapping", labs == ["[vo]", "[ao]"], labs)

check("length: N clips lose (N-1) x duration",
      abs(tr.joined_length([5.0, 5.0, 5.0], 1.0) - 13.0) < 1e-6,
      tr.joined_length([5.0, 5.0, 5.0], 1.0))
check("length: a single clip is untouched",
      abs(tr.joined_length([5.0], 1.0) - 5.0) < 1e-6, tr.joined_length([5.0], 1.0))

# a transition longer than the clips it joins would run past the end
check("clamp: the transition cannot exceed half the shortest clip",
      abs(tr.clamp_duration([10.0, 1.0], 4.0) - 0.5) < 1e-6, tr.clamp_duration([10.0, 1.0], 4.0))
check("clamp: a comfortable transition is left alone",
      abs(tr.clamp_duration([10.0, 8.0], 0.5) - 0.5) < 1e-6, tr.clamp_duration([10.0, 8.0], 0.5))
check("clamp: joined_length uses the clamped value",
      abs(tr.joined_length([10.0, 1.0], 4.0) - 10.5) < 1e-6, tr.joined_length([10.0, 1.0], 4.0))

# --- ffmpeg argv ------------------------------------------------------------
cmd = tr.ffmpeg_args(["a.webm", "b.webm"], [4.0, 4.0], {"type": "wipeleft", "dur": 0.5},
                     "out.webm", fps=24)
check("argv: every input is passed", cmd.count("-i") == 2, cmd)
check("argv: the chosen transition reaches ffmpeg", "transition=wipeleft" in " ".join(cmd), cmd)
check("argv: both streams are mapped",
      cmd.count("-map") == 2, [c for c in cmd if c.startswith("[")])
try:
    tr.ffmpeg_args(["a", "b"], [1.0, 1.0], {"type": "none"}, "o")
    check("argv: a cut is refused (concat handles it)", False, "no error raised")
except ValueError:
    check("argv: a cut is refused (concat handles it)", True)
try:
    tr.build_xfade_chain(3, [1.0, 1.0], "fade", 0.5)
    check("argv: a duration/input mismatch is caught", False, "no error raised")
except ValueError:
    check("argv: a duration/input mismatch is caught", True)

# --- project name validation (lib/projects) ---------------------------------
# A project name becomes a DIRECTORY name, so a separator here would let "New
# project" write outside the projects folder.
chk = subprocess.run(["node", "-e", """
const p=require('./lib/projects');
const bad=['','   ','a/b','a\\\\b','..','.hidden','con','x'.repeat(80),'a:b','a*b'];
const out={bad:bad.map(n=>!!p.nameError(n)), good:!p.nameError('my music video_2')};
console.log(JSON.stringify(out));
"""], capture_output=True, text=True, cwd=str(ROOT))
try:
    r = json.loads(chk.stdout.strip() or "{}")
except Exception:
    r = {}
check("projects: every unsafe name is rejected", all(r.get("bad", [False])), chk.stdout or chk.stderr[:200])
check("projects: an ordinary name is accepted", r.get("good") is True, chk.stdout or chk.stderr[:200])

# --- layer-boundary fades (2.60.0) ------------------------------------------
# These are the IN/OUT transitions. Until 2.60.0 they reached nothing at all:
# routes/index.js never copied the fields onto the job, so the worker always
# read None. The route pass-through is asserted in the e2e suite; here we cover
# the fragment builders the worker splices into its filter chains.
check("fade: a cut produces no fragment at all",
      tr.fade_filter({"type": "none"}, "in", 0, 10) == "")
check("fade: an absent transition produces no fragment",
      tr.fade_filter(None, "in", 0, 10) == "")
check("fade: in starts at the layer's own start",
      tr.fade_filter({"type": "fade", "dur": 0.5}, "in", 2.0, 10)
      == "fade=t=in:st=2.000:d=0.500:c=black")
check("fade: out ENDS on the layer's end, so it starts d earlier",
      tr.fade_filter({"type": "fade", "dur": 0.5}, "out", 10.0, 10)
      == "fade=t=out:st=9.500:d=0.500:c=black")
check("fade: dip to white dips through white",
      ":c=white" in tr.fade_filter({"type": "fadewhite", "dur": 1}, "out", 10.0, 10))
check("fade: every other transition dips through black",
      ":c=black" in tr.fade_filter({"type": "fadeblack", "dur": 1}, "in", 0.0, 10))
check("fade: an overlay ramps alpha instead of dipping through a colour",
      tr.fade_filter({"type": "fade", "dur": 0.5}, "in", 2.0, 10, alpha=True)
      == "fade=t=in:st=2.000:d=0.500:alpha=1")
check("fade: audio uses afade, never fade",
      tr.fade_filter({"type": "fade", "dur": 0.5}, "in", 2.0, 10, audio=True)
      == "afade=t=in:st=2.000:d=0.500")
# a wipe needs two pictures; a layer boundary only has one
check("fade: a wipe at a boundary degrades to a dissolve, not to nothing",
      tr.fade_filter({"type": "wipeleft", "dur": 0.5}, "in", 0.0, 10).startswith("fade=t=in"))
check("fade: a fade longer than the layer is clamped to half of it",
      tr.fade_span({"type": "fade", "dur": 4}, 1.0) == 0.5)
check("fade: clamping never goes below the catalogue minimum",
      tr.fade_span({"type": "fade", "dur": 4}, 0.0001) >= tr.catalogue()["min_duration"])
check("fade: an out fade can never start before zero",
      ":st=0.000:" in tr.fade_filter({"type": "fade", "dur": 4}, "out", 0.2, 0.4))
check("fade: a cut has zero span",
      tr.fade_span({"type": "none", "dur": 2}) == 0.0)
try:
    tr.fade_filter({"type": "fade"}, "sideways", 0, 10)
    check("fade: a bogus direction is rejected", False, "no error raised")
except ValueError:
    check("fade: a bogus direction is rejected", True)

# The worker's wrappers must never take an export down over a transition.
sys.path.insert(0, str(ROOT))
import worker as _w
check("worker: _fade returns empty for a cut rather than raising",
      _w._fade({"type": "none"}, "in", 0, 10) == "")
check("worker: _fade swallows a malformed transition",
      _w._fade({"type": 12345, "dur": "x"}, "in", 0, 10) == "")
check("worker: _fade_any sees an active boundary transition",
      _w._fade_any({"fade_in": {"type": "fade", "dur": 0.5}}) is True)
check("worker: _fade_any is False when both sides are cuts",
      _w._fade_any({"fade_in": {"type": "none"}, "fade_out": None}) is False)

print("=" * 30)
print("ALL PASS" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
