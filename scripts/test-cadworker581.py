#!/usr/bin/env python3
"""bitGen Studio — scripts/test-cadworker581.py (2.581.0): cad_worker.py - the code check, the code extraction, the plan
(SolidCraft commands) and, when CadQuery is importable (run it with the CAD generate venv's Python: <install>/cadgen/
.venv), real parts: every modelling step recorded and turned into sketches + extrudes + fillets, the ones it cannot
rebuild named. The replay in SolidCraft itself (volumes compared) is scripts/test-ui581-ui.js."""
import json
import math
import os
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "misc"))
import cad_worker as W  # noqa: E402

P = F = 0


def check(name, cond, got=None):
    global P, F
    if cond:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:900]))


# ---- pure
check("check_code: cadquery / math / numpy only", W.check_code("import cadquery as cq\nimport math\nresult=1") is None and "import os" in (W.check_code("import os") or ""))
check("check_code: no open / eval / __import__ / dunder attributes / from-imports of others",
      "open" in (W.check_code("open('x')") or "") and "eval" in (W.check_code("eval('1')") or "") and "__class__" in (W.check_code("x=(1).__class__") or "")
      and "subprocess" in (W.check_code("from subprocess import run") or "") and "syntax" in (W.check_code("x = (") or ""))
check("extract_code: the ``` block with cadquery", W.extract_code("hi\n```python\nimport cadquery as cq\nr=1\n```") == "import cadquery as cq\nr=1\n")
fr = W.Frame((0, 0, 5), (2, 0, 0), (0, 0, 3))
check("Frame: unit, right-handed, local coordinates", fr.x == (1.0, 0.0, 0.0) and fr.y == (0.0, 1.0, 0.0) and fr.local((3, 4, 7)) == (3.0, 4.0, 2.0)
      and fr.plane() == {"origin": [0.0, 0.0, 5.0], "x_dir": [1.0, 0.0, 0.0], "y_dir": [0.0, 1.0, 0.0]})
pl = W.Plan()
pl.extrude(fr, [{"outer": True, "curves": [("line", (0, 0), (10, 0)), ("arc", (10, 0), (5, 5), (0, 0))]}, {"outer": False, "curves": [("circle", (5, 1), 1)]}], 4, "negative", "new")
pl.edges("fillet", [(1, 2, 3)], 0.5)
ids = [c["id"] for c in pl.commands]
ext = pl.commands[5]["params"]
check("Plan: sketch.create on the plane, a curve per command (keyed), finish, one profile per OUTER loop (the hole is its island), the extrude",
      ids == ["sketch.create", "sketch.line", "sketch.arc.three_point", "sketch.circle.center", "sketch.finish", "solid.extrude", "solid.fillet"]
      and ext["profiles"] == [{"curves": {"$curves": ["k1", "k2"]}}] and ext["distance"] == 4 and ext["direction"] == "negative" and ext["operation"] == "new"
      and pl.commands[0]["params"]["name"] == ext["sketch"] and pl.commands[6]["params"] == {"edges": [[1.0, 2.0, 3.0]], "radius": 0.5}, pl.commands)
pl2 = W.Plan()
pl2.extrude(fr, [{"outer": True, "curves": [("circle", (0, 0), 2)]}], None, "symmetric", "cut", True)
check("Plan: a cut through all, both ways", pl2.commands[-1]["params"].get("through_all") is True and pl2.commands[-1]["params"]["direction"] == "symmetric" and "distance" not in pl2.commands[-1]["params"])
check("fmt: 6 decimals, no -0", W.fmt(-0.0000001) == 0.0 and W.fmt(1.23456789) == 1.234568)

# ---- real parts (CadQuery)
try:
    import cadquery as cq  # noqa: F401
    HAVE = True
except Exception:  # noqa: BLE001
    HAVE = False
if not HAVE:
    print("NOTE: no CadQuery in this Python - run it with the CAD generate venv's Python for the real parts")
else:
    out = tempfile.mkdtemp(prefix="cw581-")

    def run(src, name="p"):
        return W.run_code(src, out, name)

    r = run("import cadquery as cq\nresult = cq.Workplane('XY').box(40, 20, 10)\n", "box")
    check("a box: the STEP + OBJ written, 8000 mm³, one sketch (4 lines) + one extrude, editable",
          r["ok"] and r["editable"] and abs(r["volume"] - 8000) < 1e-6 and os.path.exists(os.path.join(out, "box.step")) and os.path.getsize(os.path.join(out, "box.obj")) > 100
          and [c["id"] for c in r["commands"]].count("sketch.line") == 4 and r["commands"][-1]["params"]["distance"] == 10, r)
    src = ("import cadquery as cq\n"
           "w0 = cq.Workplane('XY')\n"
           "r = (w0.sketch().segment((-28, -11), (-28, 11)).arc((-37, 25), (-49, 3)).segment((-60, 3)).segment((-60, -11)).close()\n"
           "     .assemble().reset().push([(-45, -4)]).circle(3, mode='s').finalize().extrude(17)\n"
           "     .union(cq.Workplane('ZX').workplane(offset=-10).sketch().circle(9).circle(5, mode='s').finalize().extrude(-26)))\n"
           "r = r.faces('>Z').workplane().pushPoints([(-40, 0)]).hole(3, 4)\n"
           "result = r.edges('|Z').edges('<X').fillet(1.5)\n")
    r = run(src, "mixed")
    ex = [c for c in r.get("commands", []) if c["id"] == "solid.extrude"]
    check("the CAD-Recode style (sketch segments + arc + a hole circle, a second plane, a hole, a fillet): editable, every step a feature",
          r["ok"] and r["editable"] and [e["params"]["operation"] for e in ex] == ["new", "join", "cut"] and ex[1]["params"]["direction"] == "negative"
          and any(c["id"] == "sketch.arc.three_point" for c in r["commands"]) and r["commands"][-1]["id"] == "solid.fillet" and len(r["commands"][-1]["params"]["edges"]) >= 1, r.get("reason") or r.get("error"))
    sk2 = [c for c in r["commands"] if c["id"] == "sketch.create"][1]["params"]["plane"]
    check("...the ZX workplane offset -10 is the second sketch's plane (origin y -10, x = Z, y = X)", sk2 == {"origin": [0.0, -10.0, 0.0], "x_dir": [0.0, 0.0, 1.0], "y_dir": [1.0, 0.0, 0.0]}, sk2)
    r = run("import cadquery as cq\nresult = (cq.Workplane('XY').rect(80, 50).extrude(8).faces('>Z').workplane().rect(60, 30, forConstruction=True).vertices().hole(5)\n"
            "          .faces('>Z').workplane().polygon(6, 20).cutThruAll().faces('>X').edges('|Y').chamfer(1))\n", "plate")
    ops = [(c["params"]["operation"], c["params"].get("through_all", False)) for c in r.get("commands", []) if c["id"] == "solid.extrude"]
    check("holes at four corners = four cut cylinders, a hexagon cut through all (both ways), a chamfer",
          r["ok"] and r["editable"] and ops == [("new", False)] + [("cut", False)] * 4 + [("cut", True)] and r["commands"][-1]["id"] == "solid.chamfer"
          and abs(r["volume"] - (80 * 50 * 8 - 4 * math.pi * 2.5 ** 2 * 8 - 1.5 * math.sqrt(3) * 10 ** 2 * 8 - 2 * 0.5 * 1 * 1 * 50)) < 1, (ops, r.get("volume")))
    r = run("import cadquery as cq\nresult = cq.Workplane('XY').sphere(5).union(cq.Workplane('XY', origin=(0, 0, 5)).cylinder(10, 2))\n", "knob")
    check("a sphere + a cylinder on it: solid.sphere (new) + a circle extrude (join)",
          r["ok"] and r["editable"] and r["commands"][0]["id"] == "solid.sphere" and abs(r["commands"][0]["params"]["radius"] - 5) < 1e-3
          and [c["params"]["operation"] for c in r["commands"] if c["id"] == "solid.extrude"] == ["join"], r.get("commands", [])[:2])
    r = run("import cadquery as cq\nresult = cq.Workplane('XZ').moveTo(10, 0).lineTo(20, 0).lineTo(20, 30).lineTo(10, 30).close().revolve(360, (0, 0, 0), (0, 1, 0))\n", "ring")
    check("a revolve: the part made (STEP) but not editable - it says why", r["ok"] and not r["editable"] and "revolve" in r["reason"] and r["commands"] == [] and r["volume"] > 0, r.get("reason"))
    r = run("import cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 1/0)\n")
    check("an error in the code: where (the part's line) and what", not r["ok"] and r["stage"] == "run" and "ZeroDivisionError" in r["error"] and "line 2" in r["where"], r)
    r = run("import cadquery as cq\nx = 5\n")
    check("no part made: says to put it in `result`", not r["ok"] and "result" in r["error"], r)
    r = run("import cadquery as cq\nimport os\nresult = cq.Workplane().box(1,1,1)\n")
    check("a forbidden import is refused before anything runs", not r["ok"] and r["stage"] == "check", r)
    r = run("import cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)\nr = result.faces('>Z').shell(-1)\nresult = r\n")
    check("a shell: not editable, says shell", r["ok"] and not r["editable"] and "shell" in r["reason"], r.get("reason"))
    # after a run the real CadQuery is itself again (the recorder's wrappers removed)
    import cadquery as cq2
    check("the recorder unwraps CadQuery after the run", getattr(cq2.Workplane.extrude, "__name__", "") == "extrude" and not hasattr(cq2.Workplane.extrude, "__wrapped__") and cq2.Workplane.box.__module__ == "cadquery.cq", cq2.Workplane.box.__module__)

print("\n%d passed, %d failed" % (P, F))
print("RESULT: FAIL" if F else "RESULT: PASS")
sys.exit(1 if F else 0)
