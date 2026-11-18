"""bitGen Studio 2.855.0 - run an AI-written bpy script in headless Blender, safely, on a copy (lib/blendSkills.js).

  blender -b [scene.blend] --factory-startup --python-exit-code 1 -P blend_skill_run.py -- --mode model
      --code script.py --out result.blend --preview result.png

The script runs with a safe __import__ (bpy, bmesh, mathutils, math, random ... only) and without open / eval / exec /
compile / input / breakpoint; then bitGen saves the result as a NEW .blend (never the scene it was opened from) and renders a
small Workbench preview from a camera that frames everything. Prints one @@JSON@@ line: {ok, objects} or {ok: false,
error, traceback}.
"""
import builtins
import json
import math
import sys
import traceback

import bpy
import mathutils

MARK = "@@JSON@@"
ALLOW = {"bpy", "bmesh", "mathutils", "math", "random", "colorsys", "itertools", "functools", "collections", "statistics", "bpy_extras"}
BLOCK = {"open", "eval", "exec", "compile", "input", "breakpoint", "globals", "locals", "vars", "__import__", "exit", "quit", "help", "memoryview"}


def emit(d):
    print(MARK + json.dumps(d, default=str), flush=True)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {}
    for i in range(0, len(a) - 1, 2):
        o[a[i].lstrip("-")] = a[i + 1]
    return o


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level or name.split(".")[0] not in ALLOW:
        raise ImportError("bitGen does not let a script import " + name)
    return builtins.__import__(name, globals, locals, fromlist, level)


def frame_camera(scene):
    pts = []
    for ob in scene.objects:
        if ob.type in {"MESH", "CURVE", "SURFACE", "META", "FONT"} and ob.visible_get():
            pts += [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
    if not pts:
        pts = [mathutils.Vector((-1, -1, 0)), mathutils.Vector((1, 1, 1))]
    lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid, size = (lo + hi) / 2, max((hi - lo).length, 0.1)
    cam_data = bpy.data.cameras.new("bitGen preview")
    cam_data.lens = 50
    cam = bpy.data.objects.new("bitGen preview", cam_data)
    scene.collection.objects.link(cam)
    d = mathutils.Vector((1.0, -1.4, 0.8)).normalized()
    cam.location = mid + d * size * 1.6
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = max(1000.0, size * 20)
    return cam


def preview(path):
    scene = bpy.context.scene
    old_cam = scene.camera
    cam = frame_camera(scene)
    scene.camera = cam
    r = scene.render
    keep = (r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath, r.image_settings.file_format)
    r.engine = "BLENDER_WORKBENCH"
    r.resolution_x, r.resolution_y, r.resolution_percentage = 640, 360, 100
    r.image_settings.file_format = "PNG"
    r.filepath = path
    try:
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
    except Exception:
        pass
    bpy.ops.render.render(write_still=True)
    r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath, r.image_settings.file_format = keep
    scene.camera = old_cam
    bpy.data.objects.remove(cam, do_unlink=True)


def main():
    o = args()
    if o.get("mode") != "model":
        emit({"ok": False, "error": "unknown mode"})
        sys.exit(1)
    with builtins.open(o["code"], encoding="utf-8") as f:
        code = f.read()
    safe = {k: getattr(builtins, k) for k in dir(builtins) if k not in BLOCK}
    safe["__import__"] = safe_import
    g = {"__builtins__": safe, "__name__": "__main__"}
    try:
        exec(compile(code, "ai_script.py", "exec"), g)  # noqa: S102 - the script was checked, and runs without open / exec / imports
    except Exception as e:
        tb = traceback.format_exc().splitlines()
        tb = [ln for ln in tb if "blend_skill_run.py" not in ln]
        emit({"ok": False, "error": f"{type(e).__name__}: {e}", "traceback": "\n".join(tb[-12:])})
        sys.exit(1)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    bpy.ops.wm.save_as_mainfile(filepath=o["out"], copy=True)
    shot = None
    if o.get("preview"):
        try:
            preview(o["preview"])
            shot = o["preview"]
        except Exception as e:  # a preview is a nicety - the model is made
            shot = "failed: " + str(e)
    objs = []
    for ob in bpy.context.scene.objects:
        rec = {"name": ob.name, "type": ob.type}
        if ob.type == "MESH":
            rec["verts"] = len(ob.data.vertices)
            rec["tris"] = sum(max(0, len(p.vertices) - 2) for p in ob.data.polygons)
        objs.append(rec)
    emit({"ok": True, "objects": objs[:200], "preview": shot})


main()
