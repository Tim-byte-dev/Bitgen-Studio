"""bitGen Studio — scripts/blend_layer3d.py (2.460.0): A DAZ / BLENDER SCENE AS A 3D LAYER of the image editor.

Tim (verbatim): "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through
the image editor or timeline docker. use the image in the daz layer to generate a new image / if we can't do it wit daz
directly we can send daz scene to blender" - asked: Blender + an experimental Daz live link.

Run by lib/layer3d.js (blender -b --factory-startup -P this -- <cmd> ...):
  inspect <scene.blend> <out.json>
      {cameras: [{name, fov}], camera, center, radius, orbit: {target, dist, yaw, pitch, fov} (the scene camera's view
       as an orbit - or a front view when there is none), armatures: [{name, bones: [{name, parent}]}], frame, frames,
       resolution: [w, h], objects}
  serve <scene.blend>
      loads the file ONCE, then reads one JSON job per line from stdin:
        {"cmd": "render", "out": png, "w", "h", "engine": "WORKBENCH" | "EEVEE" | "CYCLES", "samples", "transparent",
         "cam": null (the scene camera) | {target: [x,y,z], dist, yaw, pitch, fov} (degrees, Blender's Z up),
         "pose": {<armature>: {<bone>: [x, y, z] degrees added to the bone's own rotation}}, "frame": n | null,
         "objects": {<object>: {"move": [x, y, z] m, "turn": [x, y, z] degrees, "scale": k, "hide": true}} (2.541.0 - on
         top of the file's own places, world axes, round the object's own origin; every job starts from the file's)}
        {"cmd": "quit"}
      Every job starts from the file's own pose (kept at load), so poses never pile up. Prints "H3L ready",
      "H3L done <png> <ms>", "H3L error <message>".
  render <scene.blend> <job.json>          one job, then exit (the same as serve's)
"""
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector


def say(s):
    print(s, flush=True)


def open_file(path):
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)


def scene_box():
    lo, hi, n = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9)), 0
    for o in bpy.context.scene.objects:
        if o.type not in ("MESH", "CURVE", "SURFACE", "META", "FONT") or o.hide_render:
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
            n += 1
    if not n:
        return Vector((0, 0, 1)), 2.0
    return (lo + hi) / 2, max(0.1, (hi - lo).length / 2)


def cam_fov(cd):
    return math.degrees(cd.angle)


def orbit_of(sc):
    center, radius = scene_box()
    cam = sc.camera
    if cam and cam.type == "CAMERA":
        P = cam.matrix_world.to_translation()
        fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        d = max(0.05 * radius, (center - P).dot(fwd))
        if d <= 0.05 * radius:
            d = max(radius, (center - P).length)
        target = P + fwd * d
        v = P - target
        return {"target": list(target), "dist": d, "yaw": math.degrees(math.atan2(v.y, v.x)),
                "pitch": math.degrees(math.asin(max(-1.0, min(1.0, v.z / d)))), "fov": cam_fov(cam.data)}
    return {"target": list(center), "dist": radius * 2.6, "yaw": -90.0, "pitch": 8.0, "fov": 40.0}


def obj_info(o):
    """{name, type} + 2.540.0 a mesh's world box [lo, hi] - the image editor puts each object on the picture (the 🖼
    References list: which reference docker picture an object becomes)"""
    d = {"name": o.name, "type": o.type}
    if o.type in ("MESH", "CURVE", "SURFACE", "META", "FONT") and not o.hide_render:
        try:
            ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
            d["box"] = [[round(min(w[i] for w in ws), 4) for i in range(3)], [round(max(w[i] for w in ws), 4) for i in range(3)]]
        except Exception:                      # noqa: BLE001
            pass
    return d


def inspect(src, out):
    open_file(src)
    sc = bpy.context.scene
    center, radius = scene_box()
    arms = []
    for o in sc.objects:
        if o.type == "ARMATURE":
            arms.append({"name": o.name, "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None} for b in o.data.bones]})   # = blend_pose.armatures()
    info = {"cameras": [{"name": o.name, "fov": cam_fov(o.data)} for o in sc.objects if o.type == "CAMERA"],
            "camera": sc.camera.name if sc.camera else None, "center": list(center), "radius": radius,
            "orbit": orbit_of(sc), "armatures": arms, "frame": sc.frame_current, "frames": [sc.frame_start, sc.frame_end],
            "resolution": [sc.render.resolution_x, sc.render.resolution_y],
            "objects": [obj_info(o) for o in sc.objects][:400]}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(info, fh)
    say("H3L done " + out)


# ---------------------------------------------------------------- pose (2.461.0: scripts/blend_pose.py, shared with blend_scene.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blend_pose  # noqa: E402


def keep_pose():
    blend_pose.keep()


def apply_pose(pose, frame):
    blend_pose.reset()                     # back to the file's own pose first
    return blend_pose.apply(pose, [frame], mute=True)


# ---------------------------------------------------------------- the model (2.541.0)
_ORIG = {}


def keep_objects():
    """the file's own place of every object - each job starts from it, so edits never pile up"""
    _ORIG.clear()
    for o in bpy.data.objects:
        if o.name.startswith("bitgen_"):
            continue
        _ORIG[o.name] = (o.location.copy(), o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy(),
                         o.rotation_axis_angle[:], o.scale.copy(), o.hide_render, o.hide_viewport)


def reset_objects():
    for name, (loc, mode, eul, quat, axa, scl, hr, hv) in _ORIG.items():
        o = bpy.data.objects.get(name)
        if not o:
            continue
        o.location, o.rotation_mode, o.rotation_euler, o.rotation_quaternion = loc, mode, eul, quat
        o.rotation_axis_angle = axa
        o.scale, o.hide_render, o.hide_viewport = scl, hr, hv


def apply_objects(objs):
    """the page's model edits, in world space round each object's own origin: scale, turn (X, Y, Z), then move"""
    from mathutils import Euler, Matrix
    done = []
    for name, e in (objs or {}).items():
        o = bpy.data.objects.get(name)
        if not o or o.name.startswith("bitgen_") or not isinstance(e, dict):
            continue
        if e.get("hide"):
            o.hide_render = True
            done.append(name)
            continue
        m = o.matrix_world.copy()
        t = m.to_translation()
        k = float(e.get("scale") or 1.0)
        tn = [math.radians(float(v or 0)) for v in (e.get("turn") or [0, 0, 0])[:3]]
        mv = Vector([float(v or 0) for v in (e.get("move") or [0, 0, 0])[:3]])
        about = Matrix.Translation(t) @ Euler(tn, "XYZ").to_matrix().to_4x4() @ Matrix.Scale(k, 4) @ Matrix.Translation(-t)
        o.matrix_world = Matrix.Translation(mv) @ about @ m
        done.append(name)
    if done:
        bpy.context.view_layer.update()
    return done


# ---------------------------------------------------------------- camera + render
def view_cam(sc, cam):
    co = bpy.data.objects.get("bitgen_layer3d_cam")
    if not co:
        cd = bpy.data.cameras.new("bitgen_layer3d_cam")
        co = bpy.data.objects.new("bitgen_layer3d_cam", cd)
        sc.collection.objects.link(co)
    t = Vector([float(v) for v in cam.get("target") or (0, 0, 0)])
    d = max(1e-3, float(cam.get("dist") or 5))
    yaw, pitch = math.radians(float(cam.get("yaw") or 0)), math.radians(max(-89.9, min(89.9, float(cam.get("pitch") or 0))))
    loc = t + Vector((math.cos(pitch) * math.cos(yaw), math.cos(pitch) * math.sin(yaw), math.sin(pitch))) * d
    co.location = loc
    co.rotation_mode = "QUATERNION"
    co.rotation_quaternion = (t - loc).to_track_quat("-Z", "Y")
    co.data.sensor_fit = "AUTO"
    co.data.angle = math.radians(max(1.0, min(170.0, float(cam.get("fov") or 40))))
    co.data.clip_start = max(1e-3, d / 1000.0)
    co.data.clip_end = max(100.0, d * 100.0)
    return co


def engine_id(want):
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    if want == "EEVEE":
        for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            if e in ids:
                return e
    if want == "CYCLES" and "CYCLES" in ids:
        return "CYCLES"
    return "BLENDER_WORKBENCH"


def render_job(job):
    t0 = time.time()
    sc = bpy.context.scene
    frame = job.get("frame")
    reset_objects()                        # 2.541.0: the file's own places first (then the frame's animation)
    sc.frame_set(int(frame) if frame is not None else sc.frame_current)
    apply_pose(job.get("pose"), sc.frame_current)
    apply_objects(job.get("objects"))
    keep_cam = sc.camera
    if job.get("cam"):
        sc.camera = view_cam(sc, job["cam"])
    if not sc.camera:
        sc.camera = view_cam(sc, orbit_of(sc))
    r = sc.render
    eng = engine_id(str(job.get("engine") or "WORKBENCH").upper())
    r.engine = eng
    if eng == "BLENDER_WORKBENCH":
        try:
            sh = sc.display.shading
            sh.light, sh.color_type = "STUDIO", "MATERIAL"
        except Exception:                                  # noqa: BLE001
            pass
    if eng == "CYCLES":
        sc.cycles.samples = max(1, int(job.get("samples") or 32))
        sc.cycles.device = "CPU"
        try:
            sc.cycles.use_denoising = False
        except Exception:                                  # noqa: BLE001
            pass
    r.resolution_x, r.resolution_y, r.resolution_percentage = max(16, int(job.get("w") or 640)), max(16, int(job.get("h") or 480)), 100
    r.film_transparent = bool(job.get("transparent"))
    im = r.image_settings
    if hasattr(im, "media_type"):
        try:
            im.media_type = "IMAGE"
        except Exception:                                  # noqa: BLE001
            pass
    im.file_format = "PNG"
    im.color_mode = "RGBA"
    out = job["out"]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    r.filepath = out
    bpy.ops.render.render(write_still=True)
    sc.camera = keep_cam
    if not os.path.isfile(out):
        raise RuntimeError("Blender wrote no picture")
    say("H3L done %s %d" % (out, int((time.time() - t0) * 1000)))


def serve(src):
    open_file(src)
    keep_pose()
    keep_objects()
    say("H3L ready")
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
            if job.get("cmd") == "quit":
                break
            render_job(job)
        except Exception as e:                             # noqa: BLE001
            say("H3L error " + str(e).replace("\n", " "))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    try:
        cmd = argv[0]
        if cmd == "inspect":
            inspect(argv[1], argv[2])
        elif cmd == "serve":
            serve(argv[1])
        elif cmd == "render":
            open_file(argv[1])
            keep_pose()
            keep_objects()
            render_job(json.load(open(argv[2], encoding="utf-8")))
        else:
            raise RuntimeError("unknown command " + cmd)
    except Exception as e:                                 # noqa: BLE001
        say("H3L error " + str(e).replace("\n", " "))
        sys.exit(1)


main()
