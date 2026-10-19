#!/usr/bin/env python3
"""Unit tests for scripts/image_name.py — what a generated still is called.

Run: python3 scripts/test-imagename.py

A filename looks like cosmetics until it is the only surviving record of how a
picture was made. Two things are being pinned here:

  * the SEED is in the name, so a picture worth keeping can be made again
    without the job log (which is trimmed) still existing;
  * a name is never handed back if a file already has it, because an overwrite
    is the one failure in this whole path that destroys work silently instead
    of reporting it.

Pure functions apart from reserve(), so all of this runs without a GPU, a
model, ComfyUI or a server.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import image_name as N                                      # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      got " + repr(got) if got is not None else ""))


# ------------------------------------------------------------------- stamp
s = N.stamp(0)
check("the stamp is YYYYMMDD-HHMMSS", len(s) == 15 and s[8] == "-"
      and s.replace("-", "").isdigit(), s)
check("the stamp sorts chronologically as text — a gallery sorted by name is "
      "sorted by time", N.stamp(1000) <= N.stamp(1000000), None)

# --------------------------------------------------------------- build_stem
st = N.build_stem("61e2ec4b3780", 316826193, 0)
check("the stem carries time, seed and job id", st.endswith("_s316826193_61e2ec4b3780")
      and st.startswith(N.stamp(0)), st)
check("the seed is written so it can be read back off the file",
      "s316826193" in st, st)
check("a negative seed is LEFT OUT rather than written as s-1 — it reproduces "
      "nothing, so recording it would be a lie",
      "s-1" not in N.build_stem("job", -1, 0), N.build_stem("job", -1, 0))
check("...and so is an absent one", "_s" not in N.build_stem("job", None, 0),
      N.build_stem("job", None, 0))
check("SEED 0 IS A REAL SEED and appears — the classic 'falsy means unset' bug",
      "_s0_" in N.build_stem("job", 0, 0), N.build_stem("job", 0, 0))
check("a junk seed does not crash the naming of a picture that already rendered",
      isinstance(N.build_stem("job", "banana", 0), str), N.build_stem("job", "banana", 0))
check("a job id with separators in it cannot escape the output folder",
      "/" not in N.build_stem("../../etc/passwd", 1, 0)
      and "\\" not in N.build_stem("..\\..\\win", 1, 0),
      N.build_stem("../../etc/passwd", 1, 0))
check("an empty job id still yields a usable stem",
      N.build_stem("", 5, 0) == N.stamp(0) + "_s5", N.build_stem("", 5, 0))
check("TWO PRESSES CANNOT COLLIDE even inside one second with one pinned seed: "
      "the job id differs",
      N.build_stem("aaa", 7, 0) != N.build_stem("bbb", 7, 0), None)

# --------------------------------------------------------------- image_name
check("a single image is not numbered", N.image_name("x", 0, 1) == "x.png",
      N.image_name("x", 0, 1))
check("a batch is numbered from 01", N.image_name("x", 0, 4) == "x_01.png",
      N.image_name("x", 0, 4))
check("...and zero-padded, so 10 files sort after 9 rather than between 1 and 2",
      N.image_name("x", 9, 12) == "x_10.png", N.image_name("x", 9, 12))
check("the extension is honoured with or without its dot",
      N.image_name("x", 0, 1, "webp") == "x.webp"
      and N.image_name("x", 0, 1, ".webp") == "x.webp", None)

# ------------------------------------------------------------------ reserve
with tempfile.TemporaryDirectory() as d:
    check("a free name is returned unchanged",
          N.reserve(d, "a.png") == "a.png", N.reserve(d, "a.png"))
    open(os.path.join(d, "a.png"), "w").close()
    got = N.reserve(d, "a.png")
    check("A TAKEN NAME IS NEVER HANDED BACK — the picture already there must "
          "survive", got != "a.png", got)
    check("...and steps aside the same way lib/autoAssets.js does",
          got == "a (2).png", got)
    open(os.path.join(d, got), "w").close()
    check("it keeps counting past the second collision",
          N.reserve(d, "a.png") == "a (3).png", N.reserve(d, "a.png"))
    check("the extension survives the rename",
          N.reserve(d, "a.png").endswith(".png"), N.reserve(d, "a.png"))
    open(os.path.join(d, "b.tar.gz"), "w").close()
    check("only the LAST extension is treated as one",
          N.reserve(d, "b.tar.gz") == "b.tar (2).gz", N.reserve(d, "b.tar.gz"))
    try:
        N.reserve(d, "")
        check("an empty name is refused rather than silently used", False, "no raise")
    except ValueError:
        check("an empty name is refused rather than silently used", True)

# ------------------------------------------------- the callers actually use it
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
w = open(os.path.join(root, "image_worker.py"), encoding="utf-8").read()
check("image_worker.py names files through this module, not by hand",
      "_iname.image_name(" in w and "_iname.reserve(" in w, None)
check("...on BOTH engines, so a comfy still and an sd-cli still are named alike",
      w.count("_iname.reserve(") >= 2, w.count("_iname.reserve("))
check("no hand-rolled name format is left behind in the worker",
      "f\"{stem}.png\"" not in w, None)

print("=======================")
print("RESULT: %d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
