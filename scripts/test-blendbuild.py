#!/usr/bin/env python3
"""bitGen Studio — 2.404.0: a scene PLAN built in a REAL Blender (scripts/blend_build.py via blend_scene.py build) and
a model added in the .blend preview (+ Model -> an "import" edit) saved by Blender.
Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image to
workflow?".
  1. every kind the plan may name builds as ONE mesh object of the plan's name, its base on the ground at "at", the
     simple shapes exactly the plan's size, the composites within it; a turn turns it about Z
  2. moves = linear keys from frame 1 to the last frame (the plan's seconds), the camera's keys look at their points
  3. a "model" object = its .glb imported, joined, its height = the plan's, its base on the ground; a file that cannot
     be read -> a stand-in of its kind, said
  4. the frame range / fps / size / sky / sun / ground; the scene camera is the plan's
  5. an "import" edit (+ Model) saved: the new object exported back has exactly the page's glTF-local base
SKIP without Blender. Run from repo root: python3 scripts/test-blendbuild.py"""
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "blend_scene.py"
FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f"\n      {str(extra)[:1500]}"))
    if not cond:
        FAILED.append(name)


exe = shutil.which("blender")
if not exe:
    print("SKIP: Blender is not installed here - the scene builder did not run")
    print("\nRESULT: 0 failed")
    sys.exit(0)
T = Path(tempfile.mkdtemp(prefix="blendbuild_"))


def blender(*args, script=None, timeout=600):
    cmd = [exe, "-b", "--factory-startup", "-P", str(script or SCRIPT), "--"] + [str(a) for a in args]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


# a model file: a monkey 2 x 2 at (3, 0, 5), exported as .glb (any position / size - the build re-fits it)
(T / "mk.py").write_text('''
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.mesh.primitive_monkey_add(location=(3, 0, 5)); bpy.context.active_object.scale = (2, 2, 2)
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format="GLB")
''')
blender(T / "monkey.glb", script=T / "mk.py")
KINDS = json.loads(subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(require('./lib/scenePlan').KINDS))"],
                                  cwd=ROOT, capture_output=True, text=True).stdout)
objs = []
for i, k in enumerate(KINDS):
    objs.append({"name": f"K {k}", "kind": k, "at": [(i % 10) * 6.0, (i // 10) * 6.0, 0.0], "size": [1.5, 2.0, 2.5],
                 "turn": 0, "color": "red"})
objs += [
    {"name": "Turned", "kind": "box", "at": [0, -10, 0], "size": [1, 3, 1], "turn": 90},
    {"name": "Mover", "kind": "car", "at": [0, -20, 0], "size": [1.8, 4.4, 1.5],
     "moves": [{"t": 0, "at": [0, -20, 0], "turn": 0}, {"t": 4, "at": [10, -20, 0], "turn": 90}]},
    {"name": "Monkey", "kind": "model", "like": "statue", "at": [5, 5, 1], "size": [1, 1, 0.7], "file": str(T / "monkey.glb")},
    {"name": "Broken", "kind": "model", "like": "dog", "at": [7, 5, 0], "size": [0.4, 0.9, 0.6], "file": str(T / "nope.glb")},
    {"name": "NoFile", "kind": "model", "like": "horse", "at": [9, 5, 0], "size": [0.7, 2.2, 1.7]},
]
plan = {"title": "test", "seconds": 4, "fps": 24, "width": 1280, "height": 704, "sky": "#336699", "ground": {"size": 80, "color": "grass"},
        "sun": {"elevation": 30, "azimuth": 90, "strength": 2.5}, "objects": objs,
        "camera": {"lens": 50, "keys": [{"t": 0, "at": [0, -30, 3], "look": [0, 0, 1]}, {"t": 4, "at": [10, -25, 6], "look": [5, 5, 0]}]}}
(T / "plan.json").write_text(json.dumps(plan))
r = blender("build", T / "plan.json", T / "built.blend")
notes = [ln[9:] for ln in r.stdout.splitlines() if ln.startswith("H3B note ")]
check("build: Blender writes the .blend", (T / "built.blend").is_file() and "H3B done" in r.stdout, r.stdout[-1500:] + r.stderr[-800:])

# probe the built file
(T / "probe.py").write_text('''
import bpy, json, sys, math
from mathutils import Vector
sc = bpy.context.scene
out = {"frame_start": sc.frame_start, "frame_end": sc.frame_end, "fps": sc.render.fps, "w": sc.render.resolution_x,
       "h": sc.render.resolution_y, "camera": sc.camera.name if sc.camera else None, "lens": sc.camera.data.lens if sc.camera else None,
       "objects": {}}
w = sc.world
bg = w.node_tree.nodes.get("Background") if w and w.use_nodes else None
out["sky"] = list(bg.inputs[0].default_value)[:3] if bg else None
def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts), max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)]
for f in (1, sc.frame_end, (1 + sc.frame_end) // 2):
    sc.frame_set(f)
    for o in bpy.data.objects:
        d = out["objects"].setdefault(o.name, {"type": o.type, "mats": len(o.data.materials) if o.type == "MESH" else 0,
                                                "kind": o.get("bitgen_kind"), "parts": 0})
        d[f"f{f}"] = {"loc": list(o.matrix_world.translation), "rot": list(o.matrix_world.to_euler()), "bbox": bbox(o) if o.type == "MESH" else None,
                      "fwd": list((o.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized())}
        if o.animation_data and o.animation_data.action:
            d["keys"] = sorted({int(round(k.co[0])) for fc in o.animation_data.action.fcurves for k in fc.keyframe_points})
            d["interp"] = sorted({k.interpolation for fc in o.animation_data.action.fcurves for k in fc.keyframe_points})
json.dump(out, open(sys.argv[-1], "w"))
''')
pr = subprocess.run([exe, "-b", str(T / "built.blend"), "--factory-startup", "-P", str(T / "probe.py"), "--", str(T / "probe.json")],
                    capture_output=True, text=True, timeout=300)
P = json.loads((T / "probe.json").read_text()) if (T / "probe.json").is_file() else {"objects": {}}
O = P["objects"]
check("the scene: frames 1-96 (4 s at 24 fps), 1280x704, the plan's camera (50 mm) is the scene camera, the sky's colour",
      P.get("frame_start") == 1 and P.get("frame_end") == 96 and P.get("fps") == 24 and P.get("w") == 1280 and P.get("h") == 704
      and P.get("camera") == "Camera" and abs((P.get("lens") or 0) - 50) < 1e-6
      and P.get("sky") and abs(P["sky"][2] - ((0x99 / 255 + 0.055) / 1.055) ** 2.4) < 1e-3, {k: P.get(k) for k in ("frame_end", "w", "camera", "lens", "sky")})
check("the ground (80 m) and the sun are there", "Ground" in O and "Sun" in O and O["Sun"]["type"] == "LIGHT"
      and abs((O["Ground"]["f1"]["bbox"][3] - O["Ground"]["f1"]["bbox"][0]) - 80) < 1e-3, {k: O.get(k) for k in ("Ground", "Sun")})
missing = [k for k in KINDS if f"K {k}" not in O]
check(f"every kind ({len(KINDS)}) builds as ONE mesh object named by the plan", not missing and all(O[f"K {k}"]["type"] == "MESH" for k in KINDS), missing)
EXACT = ["box", "cube", "sphere", "ball", "cylinder", "cone", "pyramid", "wall", "crate", "barrel", "bush"]
bad = []
for i, k in enumerate(KINDS):
    b = O.get(f"K {k}", {}).get("f1", {}).get("bbox")
    if not b:
        bad.append((k, "no bbox"))
        continue
    at = [(i % 10) * 6.0, (i // 10) * 6.0, 0.0]
    dx, dy, dz = b[3] - b[0], b[4] - b[1], b[5] - b[2]
    tol = 0.002 if k in EXACT else 0.2
    if k in ("plane",):
        ok = abs(dx - 1.5) < 0.01 and abs(dy - 2.0) < 0.01 and abs(b[2]) < 0.01
    elif k in EXACT:
        ok = abs(dx - 1.5) < tol * 1.5 + 0.01 and abs(dy - 2.0) < tol * 2 + 0.01 and abs(dz - 2.5) < tol * 2.5 + 0.01 and abs(b[2]) < 0.01
    else:                                   # a composite: within its box (a roof / mirror / arm may stick out a little)
        ok = dx < 1.5 * 1.25 and dy < 2.0 * 1.25 and 2.5 * 0.6 < dz < 2.5 * 1.15 and -0.01 < b[2] < 0.6
    cx, cy = (b[0] + b[3]) / 2, (b[1] + b[4]) / 2
    if not ok or abs(cx - at[0]) > 0.3 * 1.5 or abs(cy - at[1]) > 0.3 * 2.0:     # a lamp's arm overhangs its pole
        bad.append((k, [round(v, 3) for v in b]))
check("sizes: the simple shapes exactly w x d x h with their base on the ground; every composite inside its box, centred on 'at'",
      not bad, bad)
mats = O.get("K car", {}).get("mats", 0)
check("a composite carries one material per colour (the car: body, glass, tyres, lights)", mats >= 4, mats)
t = O.get("Turned", {}).get("f1", {}).get("bbox") or [0] * 6
check("turn 90: a 1 x 3 box lies 3 x 1", abs((t[3] - t[0]) - 3) < 0.01 and abs((t[4] - t[1]) - 1) < 0.01, t)
mv = O.get("Mover", {})
mid = (1 + 96) // 2
check("moves: linear keys at frames 1 and 96; half way it is half way; it turns to 90 degrees",
      mv.get("keys") == [1, 96] and mv.get("interp") == ["LINEAR"] and abs(mv["f1"]["loc"][0]) < 1e-4 and abs(mv["f96"]["loc"][0] - 10) < 1e-4
      and abs(mv[f"f{mid}"]["loc"][0] - 10 * (mid - 1) / 95) < 0.02 and abs(mv["f96"]["rot"][2] - math.pi / 2) < 1e-3, {k: mv.get(k) for k in ("keys", "interp", "f96")})
cam = O.get("Camera", {})


def aim(at, look):
    d = [look[i] - at[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in d))
    return [x / n for x in d]


ok_cam = cam.get("keys") == [1, 96]
for f, k in (("f1", plan["camera"]["keys"][0]), ("f96", plan["camera"]["keys"][1])):
    c = cam.get(f, {})
    ok_cam = ok_cam and all(abs(c["loc"][i] - k["at"][i]) < 1e-3 for i in range(3)) \
        and sum(c["fwd"][i] * aim(k["at"], k["look"])[i] for i in range(3)) > 0.9999
check("the camera: at each key's place, looking at its point (frames 1 and 96)", ok_cam, cam)
mk = O.get("Monkey", {}).get("f1", {}).get("bbox") or [0] * 6
check("a 'model': the .glb imported as one object, 0.7 m tall, its base on the ground at its 'at' (5, 5, 1)",
      O.get("Monkey", {}).get("type") == "MESH" and abs((mk[5] - mk[2]) - 0.7) < 1e-3 and abs(mk[2] - 1) < 1e-3
      and abs((mk[0] + mk[3]) / 2 - 5) < 1e-3 and abs((mk[1] + mk[4]) / 2 - 5) < 1e-3 and any("Monkey: the model monkey.glb, 0.70 m tall" in n for n in notes),
      {"bbox": mk, "notes": notes})
check("a model file that cannot be read -> a stand-in of its kind (a dog), said; no file -> a stand-in horse, said",
      O.get("Broken", {}).get("kind") == "model" and any("Broken: nope.glb could not be read" in n for n in notes)
      and any("NoFile: no model made - a stand-in horse" in n for n in notes) and "NoFile" in O, notes)

# 5: + Model saved, exported back = the base
base = {"t": [1.5, 0.25, -2.0], "r": [0.0, 0.3826834, 0.0, 0.9238795], "s": [0.5, 0.5, 0.5]}
(T / "edits.json").write_text(json.dumps({"objects": {"Added": {"import": str(T / "monkey.glb"), "base": base}}}))
r = blender("save", T / "built.blend", T / "edits.json", T / "saved.blend")
check("save with an import edit: Blender adds the object", "H3B note added Added (monkey.glb)" in r.stdout, r.stdout[-800:])
r = blender("export", T / "saved.blend", T / "saved.glb", T / "saved.meta.json")


def glb_nodes(p):
    b = Path(p).read_bytes()
    ln = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + ln])["nodes"]


node = next((n for n in glb_nodes(T / "saved.glb") if n.get("name") == "Added"), None) if (T / "saved.glb").is_file() else None
ok = node is not None
if ok:
    ok = all(abs(a - b) < 1e-4 for a, b in zip(node.get("translation", [0, 0, 0]), base["t"])) \
        and (all(abs(a - b) < 1e-4 for a, b in zip(node.get("rotation", [0, 0, 0, 1]), base["r"]))
             or all(abs(a + b) < 1e-4 for a, b in zip(node.get("rotation", [0, 0, 0, 1]), base["r"]))) \
        and all(abs(a - b) < 1e-4 for a, b in zip(node.get("scale", [1, 1, 1]), base["s"]))
check("the added object exported back has exactly the page's glTF-local place / turn / size (what the preview showed)", ok, node)
meta = json.loads((T / "saved.meta.json").read_text()) if (T / "saved.meta.json").is_file() else {}
check("... and it is in the scene's object list (meta), a mesh", any(o.get("id") == "Added" and o.get("type") == "MESH" for o in meta.get("objects", [])), meta.get("objects"))

shutil.rmtree(T, ignore_errors=True)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
