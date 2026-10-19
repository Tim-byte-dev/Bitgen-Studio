#!/usr/bin/env python3
"""bitGen Studio — 2.385.0: the Blender bridge's maths (scripts/blender_common.py), no Blender needed.
Run: python3 scripts/test-blender.py
Tim: "is it possible for us to create a blender to bitgen bridge?" -> "Add-on + Blender render bake"."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender_common as B  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else " :: %r" % (got,)))


check("to_bl: three.js (Y up, camera on +Z) -> Blender (Z up, camera on -Y)", B.to_bl(1, 2, 3) == (1, -3, 2), B.to_bl(1, 2, 3))
# static/m3d.js: a square picture, a unit sphere -> 1.08 / sin(15 deg)
d = B.framing(640, 640)
check("framing: the sphere fit = static/m3d.js's (1.08 / sin(fov/2) for a square picture)", abs(d - 1.08 / math.sin(math.radians(15))) < 1e-9, d)
wide = B.framing(1280, 360)
check("...a wide picture is framed by its height (same as the square)", abs(wide - d) < 1e-9, wide)
tall = B.framing(200, 800)
check("...a tall one by its width (further away)", tall > d, tall)
tb = B.framing(700, 216, "box", (4.0, 1.0, 0.25))
vf = math.radians(30)
want = max(1.12 / 2 / math.tan(vf / 2), 4 * 1.12 / 2 / (math.tan(vf / 2) * 700 / 216)) + 0.125
check("...text: its box with a 12% margin + half its depth", abs(tb - want) < 1e-9, (tb, want))
check("clamp_depth: never behind the lens, never past 4x the distance", B.clamp_depth(99, 5) == 4.7 and B.clamp_depth(-99, 5) == -20 and B.clamp_depth(1, 5) == 1)
check("euler_axes: rx about X, ry about Blender Z (three's up), rz about -Y (toward the camera)",
      B.euler_axes() == [("rx", (1.0, 0.0, 0.0)), ("ry", (0.0, 0.0, 1.0)), ("rz", (0.0, -1.0, 0.0))])
check("scale_bl: three X/Y/Z -> Blender X/Z/Y", B.scale_bl(1, 2, 3) == (1, 3, 2))
check("light_power: sun 1.6 b, point/spot 4 pi 25 b watts, ambient 0.6 b, sky 0.8 b, brightness clamped 0-20",
      B.light_power("sun", 2) == 3.2 and abs(B.light_power("point", 1) - 4 * math.pi * 25) < 1e-9
      and B.light_power("ambient", 1) == 0.6 and B.light_power("sky", 1) == 0.8 and B.light_power("sun", 99) == 32)
check("hex_rgb + srgb_to_linear", B.hex_rgb("#ff8000") == (1.0, 128 / 255, 0.0) and B.hex_rgb("fff") == (1.0, 1.0, 1.0)
      and abs(B.srgb_to_linear((0.5,))[0] - 0.21404) < 1e-4 and B.hex_rgb("zz", (0, 0, 0)) == (0, 0, 0))
check("engine_id: what was asked if Blender has it; Eevee Next on 4.2+; else Eevee, Cycles, anything",
      B.engine_id("cycles", ["BLENDER_EEVEE", "CYCLES"]) == "CYCLES" and B.engine_id("eevee", ["BLENDER_EEVEE_NEXT", "CYCLES"]) == "BLENDER_EEVEE_NEXT"
      and B.engine_id("cycles", ["BLENDER_EEVEE"]) == "BLENDER_EEVEE" and B.engine_id("x", ["BLENDER_WORKBENCH"]) == "BLENDER_WORKBENCH")
m = {"color": "#112233", "metal": 0.1, "rough": 0.9, "mat": {"glow": 2, "emissive": "#ff0000", "wire": True}}
s = B.mat_spec(m)
g = B.mat_spec(m, "gold")
check("mat_spec: the layer's colour / metal / rough + its mat; a preset over them (static/m3d.js matSpec)",
      s["color"] == "#112233" and s["glow"] == 2 and s["wire"] is True and g["color"] == "#ffcc55" and g["metal"] == 1 and g["rough"] == 0.25)
check("...a preset with no colour keeps the layer's (glossy plastic)", B.mat_spec(m, "plastic")["color"] == "#112233")
L = B.lights_of({"light": 2, "lights": [{"type": "spot", "power": 3, "x": 1, "y": 2, "z": 3, "angle": 20}, {"type": "point", "on": False}]})
check("lights_of: the studio three x the studio brightness + the layer's own (an 'off' one left out)",
      len(L) == 4 and L[1]["power"] == 3.2 and L[3]["type"] == "spot" and L[3]["b"] == 3 and L[3]["angle"] == 20, L)
check("...studio off: only the layer's", len(B.lights_of({"studio": False, "lights": [{"type": "sun"}]})) == 1)
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "m3d.js"), encoding="utf-8").read()
check("the presets are static/m3d.js's (the same names)", all(('%s: { label:' % k) in src for k in B.PRESETS))
print("\nRESULT: %d passed, %d failed" % (P, F))
sys.exit(1 if F else 0)
