#!/usr/bin/env python3
"""bitGen Studio — 2.403.0: a .blend in the preview canvas - the Blender side (scripts/blend_scene.py) in a REAL Blender.
Tim (verbatim): "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene,
select the segment we want to render to real? even better id we could edit the scene, move objects etc".
  1. export: a .blend opened as <name>.tmp -> .glb (every node carries extras.bitgen_id; cameras, lights, animation at
     frame / fps) + meta (range, fps, size, the active camera, objects with type / parent / animated);
  2. edits in glTF LOCAL space (what three.js shows) come back exactly: each object's own local as its edit leaves every
     world matrix where it was (meshes, an empty, a parented child with a parent inverse, a camera, a light);
  3. a move in glTF space lands where Blender's exporter says it should (x, -z, y), a parented child moves along its
     parent's turned axis, a key lands on its frame, duplicate / delete / hide;
  4. save: the project copy + "write back" over the original (the old one kept as .blend1) + "copy" as another file;
  5. render: frames 2..13 through the scene camera -> a 12-frame H.264 mp4 at 1280x704; the VIEW camera built from the
     scene camera's glTF world + yfov renders the same picture (the page's free view lands where it looked).
SKIP without Blender. Run from repo root: python3 scripts/test-blendview.py"""
import json
import math
import os
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
    print("SKIP: Blender is not installed here - the .blend preview's Blender side did not run")
    print("\nRESULT: 0 failed")
    sys.exit(0)
T = Path(tempfile.mkdtemp(prefix="blendview_"))


def blender(*args, script=None, timeout=400):
    cmd = [exe, "-b", "--factory-startup", "-P", str(script or SCRIPT), "--"] + [str(a) for a in args]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


# a scene: ground, an animated cube, an empty with a parented child (parent inverse), a sphere, an animated camera, sun
(T / "make.py").write_text('''
import bpy
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.frame_start=1; sc.frame_end=48; sc.render.fps=24
sc.render.resolution_x, sc.render.resolution_y = 1280, 704
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.name="Ground"
bpy.ops.mesh.primitive_cube_add(location=(0,0,1)); c=bpy.context.active_object; c.name="Cube"
c.keyframe_insert("location",frame=1); c.location=(3,0,1); c.keyframe_insert("location",frame=48)
bpy.ops.object.empty_add(location=(2,-1,1)); p=bpy.context.active_object; p.name="Parent"; p.rotation_euler=(0,0,0.7)
bpy.ops.mesh.primitive_uv_sphere_add(location=(-2,2,1)); bpy.context.active_object.name="Sphere"
bpy.ops.mesh.primitive_cone_add(location=(3,2,1)); ch=bpy.context.active_object; ch.name="Child"
ch.parent=p; ch.matrix_parent_inverse=p.matrix_world.inverted()
bpy.ops.object.camera_add(location=(9,-9,6), rotation=(1.1,0,0.785)); cam=bpy.context.active_object; cam.name="Cam"; sc.camera=cam
cam.keyframe_insert("location",frame=1); cam.location=(8,-10,5); cam.keyframe_insert("location",frame=48)
bpy.ops.object.light_add(type="SUN", location=(0,0,6), rotation=(0.5,0.2,0)); bpy.context.active_object.name="Sun"
bpy.ops.wm.save_as_mainfile(filepath=r"%s")
''' % str(T / "scene.blend"))
subprocess.run([exe, "-b", "--factory-startup", "-P", str(T / "make.py")], capture_output=True, timeout=200)
shutil.copy(T / "scene.blend", T / "scene.tmp")

# 1 export
r = blender("export", T / "scene.tmp", T / "scene.glb", T / "meta.json")
meta = json.loads((T / "meta.json").read_text()) if (T / "meta.json").is_file() else {}
data = (T / "scene.glb").read_bytes() if (T / "scene.glb").is_file() else b""
gj = json.loads(data[20:20 + struct.unpack("<I", data[12:16])[0]]) if data else {}
nodes = gj.get("nodes") or []
ids = {n.get("extras", {}).get("bitgen_id"): i for i, n in enumerate(nodes) if n.get("extras", {}).get("bitgen_id")}
objs = {o["id"]: o for o in meta.get("objects", [])}
anim_t = [gj["accessors"][s["input"]].get("min", [None])[0] for a in gj.get("animations", []) for s in a["samplers"]]
check("export: the .tmp copy opens, every object a node with extras.bitgen_id, the camera + sun exported, animation "
      "times = frame / fps (frame 1 = 1/24 s)",
      r.returncode == 0 and set(ids) >= {"Ground", "Cube", "Parent", "Sphere", "Child", "Cam", "Sun"}
      and gj.get("cameras") and any(abs(t - 1 / 24) < 1e-6 for t in anim_t if t is not None), (r.stdout[-600:], list(ids), anim_t))
check("meta: frames 1-48 at 24 fps, 1280x704, the active camera Cam, Cube + Cam animated, Child's parent = Parent",
      meta.get("frame_start") == 1 and meta.get("frame_end") == 48 and meta.get("fps") == 24 and meta.get("width") == 1280
      and meta.get("camera") == "Cam" and objs.get("Cube", {}).get("animated") and objs.get("Cam", {}).get("animated")
      and not objs.get("Sphere", {}).get("animated") and objs.get("Child", {}).get("parent") == "Parent", meta)
check("meta: an animated object's own key frames (the page plays edits between them): Cube [1, 48], Sphere none",
      objs.get("Cube", {}).get("keys") == [1, 48] and objs.get("Sphere", {}).get("keys") == [], objs.get("Cube"))


def local(i):
    n = nodes[i]
    return {"t": n.get("translation", [0, 0, 0]), "r": n.get("rotation", [0, 0, 0, 1]), "s": n.get("scale", [1, 1, 1])}


# a Blender-side reader: every object's world matrix, location at a frame, hide flags, fcurve keys
(T / "probe.py").write_text('''
import bpy, json, sys
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
sc = bpy.context.scene
out = {}
for f in (1, 24):
    sc.frame_set(f)
    for o in sc.objects:
        d = out.setdefault(o.name, {})
        d["w%d" % f] = [list(r) for r in o.matrix_world]
        d["hide"] = bool(o.hide_render)
        ad = o.animation_data
        d["keys"] = sorted({round(k.co[0]) for fc in (ad.action.fcurves if ad and ad.action else []) for k in fc.keyframe_points})
json.dump(out, open(a[1], "w"))
''')


def probe(blend, name):
    subprocess.run([exe, "-b", "--factory-startup", "-P", str(T / "probe.py"), "--", str(blend), str(T / name)],
                   capture_output=True, timeout=200)
    return json.loads((T / name).read_text()) if (T / name).is_file() else {}


before = probe(T / "scene.tmp", "p0.json")
# 2 identity edits: each object's own glTF local as its base (the animated ones too - a key at the current frame)
static = ["Ground", "Parent", "Sphere", "Child", "Sun"]
(T / "e_id.json").write_text(json.dumps({"objects": {k: {"base": local(ids[k])} for k in static}}))
r = blender("save", T / "scene.tmp", T / "e_id.json", T / "id.blend")
after = probe(T / "id.blend", "p1.json")


def maxdiff(a, b):
    return max(abs(x - y) for ra, rb in zip(a, b) for x, y in zip(ra, rb))


d = {k: maxdiff(before[k]["w1"], after[k]["w1"]) for k in static if k in before and k in after}
check("round trip: each object's own glTF local as its edit leaves every world matrix where it was (mesh, empty, the "
      "child under a turned parent with a parent inverse, the sun's -90° correction) - within 1e-4",
      r.returncode == 0 and len(d) == len(static) and all(v < 1e-4 for v in d.values()), (d, r.stdout[-500:]))
(T / "e_cam.json").write_text(json.dumps({"objects": {"Cam": {"keys": {"1": local(ids["Cam"])}}}}))
r = blender("save", T / "scene.tmp", T / "e_cam.json", T / "cam.blend")
cam = probe(T / "cam.blend", "p2.json")
# the GLB holds the camera at the frame it was exported on (the file's current frame, 1)
check("round trip: the animated camera keyed at frame 1 with its own glTF local stays put (the camera's correction)",
      r.returncode == 0 and maxdiff(before["Cam"]["w1"], cam["Cam"]["w1"]) < 1e-4, (before.get("Cam", {}).get("w1"), cam.get("Cam", {}).get("w1")))

# 3 real edits
cl = local(ids["Child"])
cl2 = dict(cl, t=[cl["t"][0] + 1, cl["t"][1], cl["t"][2]])
edits = {"objects": {
    "Cube": {"keys": {"24": {"t": [1.5, 2.0, -0.5], "r": [0, 0, 0, 1], "s": [1, 1, 1]}}},
    "Sphere": {"base": {"t": [-2, 3, -2], "r": [0, 0, 0, 1], "s": [1, 1, 1]}},
    "Child": {"base": cl2},
    "Sphere.bg1": {"src": "Sphere", "base": {"t": [0, 1, 4], "r": [0, 0, 0, 1], "s": [2, 2, 2]}},
    "Ground": {"deleted": True},
    "Sun": {"hidden": True},
}}
(T / "edits.json").write_text(json.dumps(edits))
r = blender("save", T / "scene.tmp", T / "edits.json", T / "ed.blend")
ed = probe(T / "ed.blend", "p3.json")
loc = lambda k, f="w1": [ed[k][f][i][3] for i in range(3)] if k in ed else None      # noqa: E731
close = lambda a, b: a is not None and all(abs(x - y) < 1e-3 for x, y in zip(a, b))   # noqa: E731
dl = [a - b for a, b in zip(loc("Child"), [before["Child"]["w1"][i][3] for i in range(3)])] if "Child" in ed else None
check("a move in glTF space lands as Blender's exporter maps it: Sphere gl (-2, 3, -2) -> (-2, 2, 3); the Cube's key at "
      "frame 24 gl (1.5, 2, -0.5) -> (1.5, 0.5, 2) with a key on 24",
      close(loc("Sphere"), [-2, 2, 3]) and close(loc("Cube", "w24"), [1.5, 0.5, 2.0]) and 24 in ed.get("Cube", {}).get("keys", []),
      {"sphere": loc("Sphere"), "cube24": loc("Cube", "w24"), "keys": ed.get("Cube", {}).get("keys")})
check("the parented child moved +1 along its PARENT's local x (turned 0.7 rad): world delta (cos .7, sin .7, 0)",
      dl is not None and close(dl, [math.cos(0.7), math.sin(0.7), 0]), dl)
check("duplicate Sphere.bg1 (gl (0,1,4) x2 -> (0,-4,1)), Ground deleted, Sun hidden from the render",
      close(loc("Sphere.bg1"), [0, -4, 1]) and abs(ed.get("Sphere.bg1", {}).get("w1", [[0]])[0][0] - 2) < 1e-3
      and "Ground" not in ed and ed.get("Sun", {}).get("hide") is True, {k: (loc(k), ed[k].get("hide")) for k in ed})

# 4 save modes: the project copy + write back (the original kept as .blend1) + a copy
orig = T / "orig" / "scene.blend"
orig.parent.mkdir()
shutil.copy(T / "scene.blend", orig)
r = blender("save", T / "scene.tmp", T / "edits.json", T / "proj" / "scene.blend", orig, orig.with_name("scene_bitgen.blend"))
check("save: the project's scene.blend, the original overwritten (scene.blend1 = the old one), scene_bitgen.blend beside it",
      r.returncode == 0 and (T / "proj" / "scene.blend").is_file() and orig.with_name("scene.blend1").is_file()
      and orig.with_name("scene_bitgen.blend").is_file() and "Sphere.bg1" in probe(orig, "p4.json"), r.stdout[-600:])

# 5 render: the scene camera, frames 2..13; then a VIEW at the camera's own glTF world + yfov
(T / "job.json").write_text(json.dumps({"start": 2, "end": 13, "engine": "WORKBENCH", "out": str(T / "r1.mp4")}))
r = blender("render", T / "scene.tmp", T / "edits.json", T / "job.json", timeout=600)
info = json.loads((T / "job.json.out.json").read_text()) if (T / "job.json.out.json").is_file() else {}


def ffprobe(p):
    q = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,nb_read_frames,codec_name", "-of", "json", str(p)], capture_output=True, text=True)
    return (json.loads(q.stdout or "{}").get("streams") or [{}])[0]


s1 = ffprobe(T / "r1.mp4")
check("render: frames 2..13 through the scene camera -> a 12-frame H.264 mp4 at 1280x704 (progress lines, the info file)",
      r.returncode == 0 and s1.get("codec_name") == "h264" and int(s1.get("nb_read_frames") or 0) == 12
      and (s1.get("width"), s1.get("height")) == (1280, 704) and "H3B frame 12/12" in r.stdout and info.get("frames") == 12,
      (s1, r.stdout[-800:]))
# the camera's glTF world at frame 1, from Blender itself (gl_world of its matrix_world) + the exported yfov
(T / "camgl.py").write_text('''
import bpy, json, sys, math
sys.path.insert(0, r"%s")
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
from mathutils import Matrix
C = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
R = Matrix.Rotation(math.radians(90), 4, "X")
sc = bpy.context.scene; sc.frame_set(1)
w = C.inverted() @ (sc.camera.matrix_world @ R.inverted()) @ C
el = [w[r][c] for c in range(4) for r in range(4)]      # column-major like three.js
json.dump({"matrix": el}, open(a[1], "w"))
''' % str(ROOT / "scripts"))
subprocess.run([exe, "-b", "--factory-startup", "-P", str(T / "camgl.py"), "--", str(T / "scene.tmp"), str(T / "camgl.json")],
               capture_output=True, timeout=200)
yfov = math.degrees((gj.get("cameras") or [{}])[0].get("perspective", {}).get("yfov", 0.4))
view = json.loads((T / "camgl.json").read_text())
view["fov"] = yfov
for name, extra in (("a", {}), ("b", {"view": view})):
    (T / f"job_{name}.json").write_text(json.dumps({"start": 1, "end": 1, "engine": "WORKBENCH", "out": str(T / f"{name}.mp4"), **extra}))
    blender("render", T / "scene.tmp", "", T / f"job_{name}.json", timeout=600)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(T / f"{name}.mp4"), "-frames:v", "1", str(T / f"{name}.png")])
q = subprocess.run(["ffmpeg", "-loglevel", "info", "-i", str(T / "a.png"), "-i", str(T / "b.png"), "-lavfi", "psnr", "-f", "null", "-"],
                   capture_output=True, text=True)
psnr = next((ln for ln in q.stderr.splitlines() if "PSNR" in ln and "average" in ln), "")
avg = psnr.split("average:")[1].split()[0] if "average:" in psnr else "0"
val = float("inf") if avg == "inf" else float(avg)
check("the VIEW camera (the scene camera's glTF world + yfov, as the page sends its free view) renders the same frame "
      f"as the scene camera (PSNR {avg} dB)", val > 35, psnr)

shutil.rmtree(T, ignore_errors=True)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
