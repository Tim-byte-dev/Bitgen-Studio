"""bitGen Studio — a .blend IN THE PREVIEW CANVAS: export, edits, save, render (2.403.0). Runs INSIDE Blender:

    blender -b --factory-startup -P scripts/blend_scene.py -- export <file.blend|.tmp> <out.glb> <meta.json>
    blender -b --factory-startup -P scripts/blend_scene.py -- save   <file> <edits.json> <out.blend> [<out2.blend> ...]
    blender -b --factory-startup -P scripts/blend_scene.py -- render <file> <edits.json> <job.json>
    blender -b --factory-startup -P scripts/blend_scene.py -- build  <plan.json> <out.blend>      (2.404.0, blend_build.py)
    ... -- daz_scene / merge / fbx2glb                                                          (2.405.0, blend_daz.py)

Tim (verbatim): "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene,
select the segment we want to render to real? even better id we could edit the scene, move objects etc" - asked: edits
= move / rotate / scale + hide / duplicate / delete + keyframes; where edits go = "an option dropdown in the properties
for blender in our toolbox - to write back to blender, copy to new file, only render in our scene, keep the blender
filename.tmp in current project folder. save it as .blend if save button is pressed".

export   every object gets a custom property bitgen_id (its name) -> glTF extras, so the page can tell nodes apart;
         .glb with cameras, lights, animation (times = frame / fps), modifiers applied; meta.json = frame range, fps,
         resolution, the active camera, every object {id, type, parent, animated, hidden}. The file is NOT saved.
edits    (written by ext/timelinedock/blendscene.js) in glTF LOCAL space - exactly what three.js shows for a node:
         {objects: {<id>: {base: {t: [x,y,z], r: [x,y,z,w], s: [x,y,z]} | null, keys: {<frame>: {t, r, s}},
                           hidden: bool, deleted: bool, src: <id of the object it duplicates> | absent,
                           import: <an absolute model path - a NEW object (2.404.0: + Model / a picture made 3D)>}}}
         Converted here with what Blender's glTF exporter does (checked against it, scripts/test-blendscene.py):
         Blender world = C · glTF world · C⁻¹ (· Rx(+90°) for a camera / light), C = Y-up -> Z-up. A parented
         object's glTF local is taken from its parent's glTF world at that frame, so a parent inverse is kept.
         A key is inserted at its frame (location / rotation in the object's own rotation mode / scale).
save     the edits applied, the file saved to every output path (the project's <name>.blend, the original .blend for
         "write back" - Blender keeps the old one as .blend1 - or <name>_bitgen.blend for "copy").
render   the edits applied in memory, frames start..end through the scene camera or a VIEW (a new camera at the page's
         free-view camera: its glTF world matrix + vertical fov), Workbench / EEVEE / the scene's engine, the long
         side at most 1280 (multiples of 32), H.264 .mp4. Prints "H3B frame i/n", "H3B done <path>", "H3B error: ...".
         2.540.0: job "still" = the FIRST frame as a PNG too, job "objects2d" = where each mesh is on that frame
         ({id, box [x0, y0, x1, y1] 0-1 from the top left}) - lib/realRefs.js turns the frame into a photo with the
         reference docker's pictures and 3DREAL animates it.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))             # 2.404.0: blend_build.py beside it
import blend_pose  # noqa: E402  2.461.0: the figure poses (shared with blend_layer3d.py)

C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))       # glTF (Y up) -> Blender (Z up)
CI = C.inverted()
RX90 = Matrix.Rotation(math.radians(90), 4, "X")                           # the exporter's camera / light turn
RX90I = RX90.inverted()
TURNED = ("CAMERA", "LIGHT")


def say(s):
    print(s, flush=True)


def open_file(path):
    bpy.ops.wm.open_mainfile(filepath=path)


def bl_world(wgl, kind):
    m = C @ wgl @ CI
    return m @ RX90 if kind in TURNED else m


def gl_world(wbl, kind):
    m = wbl @ RX90I if kind in TURNED else wbl
    return CI @ m @ C


def trs_matrix(e):
    t = Vector(e.get("t") or (0, 0, 0))
    r = e.get("r") or (0, 0, 0, 1)
    s = e.get("s") or (1, 1, 1)
    return Matrix.Translation(t) @ Quaternion((r[3], r[0], r[1], r[2])).to_matrix().to_4x4() @ Matrix.Diagonal((s[0], s[1], s[2], 1))


def animated(o):
    ad = o.animation_data
    if not ad or not ad.action:
        return False
    return any(fc.data_path in ("location", "rotation_euler", "rotation_quaternion", "rotation_axis_angle", "scale")
               for fc in ad.action.fcurves)


# ---------------------------------------------------------------- export
def export(src, glb, meta_path):
    open_file(src)
    sc = bpy.context.scene
    for o in bpy.data.objects:
        o["bitgen_id"] = o.name
    kw = dict(filepath=glb, export_format="GLB", export_yup=True, export_cameras=True, export_lights=True,
              export_extras=True, export_apply=True, export_animations=True, use_visible=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        for k in ("use_visible", "export_apply"):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)
    r = sc.render
    objs = []
    for o in sc.objects:
        keys = []
        if animated(o):                       # its own key frames - the page plays edits between them, not per frame
            keys = sorted({int(round(k.co[0])) for fc in o.animation_data.action.fcurves
                           if fc.data_path in ("location", "rotation_euler", "rotation_quaternion", "rotation_axis_angle", "scale")
                           for k in fc.keyframe_points})
        objs.append({"id": o.name, "type": o.type, "parent": o.parent.name if o.parent else None,
                     "animated": animated(o), "keys": keys, "hidden": bool(o.hide_render)})
    meta = {"scene": sc.name, "frame_start": sc.frame_start, "frame_end": sc.frame_end, "fps": r.fps / (r.fps_base or 1.0),
            "width": int(r.resolution_x * r.resolution_percentage / 100), "height": int(r.resolution_y * r.resolution_percentage / 100),
            "camera": sc.camera.name if sc.camera else None, "engine": r.engine, "objects": objs,
            "blender": bpy.app.version_string, "armatures": blend_pose.armatures()}   # 2.461.0: the Pose lists
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh)
    say("H3B done " + glb)


# ---------------------------------------------------------------- edits
def set_world_from_gl(o, local_gl):
    """o's transform from its glTF LOCAL matrix (relative to its parent's glTF world at the current frame)"""
    if o.parent:
        wgl = gl_world(o.parent.matrix_world, o.parent.type) @ local_gl
    else:
        wgl = local_gl
    o.matrix_world = bl_world(wgl, o.type)


def key(o, frame):
    o.keyframe_insert("location", frame=frame)
    mode = o.rotation_mode
    o.keyframe_insert("rotation_quaternion" if mode == "QUATERNION" else "rotation_axis_angle" if mode == "AXIS_ANGLE"
                      else "rotation_euler", frame=frame)
    o.keyframe_insert("scale", frame=frame)


def apply_edits(edits):
    """returns notes"""
    sc = bpy.context.scene
    notes = []
    objs = (edits or {}).get("objects") or {}
    # 2.404.0: models added in the preview (a .glb made from a picture, any model in models3d/) - a new object with the
    # file's geometry as three.js shows it (every part's transform baked, the object at the origin), then its base
    for oid, e in objs.items():
        src = e.get("import")
        if not src or oid in bpy.data.objects or e.get("deleted"):
            continue
        import blend_build
        o = blend_build.import_model(str(src), oid)
        notes.append(f"added {oid} ({os.path.basename(str(src))})" if o else f"{oid}: {src} could not be read")
    # duplicates first (they may be edited like any other object)
    for oid, e in objs.items():
        src = e.get("src")
        if not src or oid in bpy.data.objects:
            continue
        so = bpy.data.objects.get(src)
        if not so:
            notes.append(f"duplicate {oid}: its source {src} is gone")
            continue
        no = so.copy()
        no.name = oid
        if so.animation_data and so.animation_data.action:
            no.animation_data.action = so.animation_data.action.copy()
        for col in so.users_collection:
            col.objects.link(no)
        notes.append(f"duplicated {src} -> {no.name}")
    keep = sc.frame_current
    for oid, e in objs.items():
        o = bpy.data.objects.get(oid)
        if not o:
            continue
        if e.get("deleted"):
            bpy.data.objects.remove(o, do_unlink=True)
            notes.append(f"deleted {oid}")
            continue
        if e.get("base"):
            sc.frame_set(keep)
            set_world_from_gl(o, trs_matrix(e["base"]))
            if animated(o):                       # an animated object keeps its own track: the base is a key here
                key(o, keep)
            notes.append(f"moved {oid}")
        for f in sorted((e.get("keys") or {}), key=lambda x: float(x)):
            fr = int(round(float(f)))
            sc.frame_set(fr)
            set_world_from_gl(o, trs_matrix(e["keys"][f]))
            key(o, fr)
        if e.get("keys"):
            notes.append(f"{oid}: {len(e['keys'])} key(s)")
        if "hidden" in e:
            o.hide_render = bool(e["hidden"])
            o.hide_viewport = bool(e["hidden"])
            try:
                o.hide_set(bool(e["hidden"]))
            except Exception:                  # noqa: BLE001 - not in this view layer
                pass
    sc.frame_set(keep)
    return notes


def pose_edits(edits, frames):
    """2.461.0: the page's figure pose (edits["pose"] - scripts/blend_pose.py); an animated rig keyed over `frames`"""
    n = blend_pose.apply((edits or {}).get("pose"), frames)
    if n:
        say(f"H3B note posed {n} bone(s)")


def save(src, edits_path, outs):
    open_file(src)
    edits = json.load(open(edits_path, encoding="utf-8")) if edits_path and os.path.isfile(edits_path) else {}
    for n in apply_edits(edits):
        say("H3B note " + n)
    sc = bpy.context.scene
    pose_edits(edits, range(sc.frame_start, sc.frame_end + 1))
    for i, out in enumerate(outs):
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=out, copy=(i > 0))
        say("H3B saved " + out)
    say("H3B done " + (outs[0] if outs else ""))


# ---------------------------------------------------------------- render
def fit_size(w, h, longest=1280):
    w, h = max(1, int(w)), max(1, int(h))
    k = min(1.0, float(longest) / max(w, h))
    return max(256, int(round(w * k / 32.0)) * 32), max(256, int(round(h * k / 32.0)) * 32)


def objects2d(sc, cam):
    """2.540.0: every visible mesh's box on the camera's picture at the current frame (0-1, the top left = 0, 0)"""
    from bpy_extras.object_utils import world_to_camera_view
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in sc.objects:
        if o.type not in ("MESH", "CURVE", "SURFACE", "META", "FONT") or o.hide_render or o.name.startswith("bitgen_"):
            continue
        try:
            ev = o.evaluated_get(dg)
            pts = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
        except Exception:                      # noqa: BLE001
            continue
        xs, ys, front = [], [], 0
        for p in pts:
            v = world_to_camera_view(sc, cam, p)
            if v.z > 0:
                front += 1
                xs.append(v.x)
                ys.append(1.0 - v.y)
        if front < 2:
            continue
        b = [max(0.0, min(xs)), max(0.0, min(ys)), min(1.0, max(xs)), min(1.0, max(ys))]
        if b[2] - b[0] < 0.005 or b[3] - b[1] < 0.005:
            continue
        out.append({"id": o.name, "box": [round(x, 3) for x in b]})
    return out[:200]


def eevee_id():
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if e in ids:
            return e
    return ids[0]


def render(src, edits_path, job_path):
    job = json.load(open(job_path, encoding="utf-8"))
    open_file(src)
    sc = bpy.context.scene
    edits = json.load(open(edits_path, encoding="utf-8")) if edits_path and os.path.isfile(edits_path) else {}
    for n in apply_edits(edits):
        say("H3B note " + n)
    r = sc.render
    view = job.get("view")
    if view:                                  # the page's free view: a still camera there
        cd = bpy.data.cameras.new("bitgen_view")
        cd.sensor_fit = "VERTICAL"
        cd.angle = math.radians(float(view.get("fov") or 50))
        co = bpy.data.objects.new("bitgen_view", cd)
        sc.collection.objects.link(co)
        m = view["matrix"]                    # column-major 4x4 (three.js Matrix4.elements)
        wgl = Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]).transposed()
        co.matrix_world = bl_world(wgl, "CAMERA")
        sc.camera = co
        say("H3B note the view camera")
    if not sc.camera:
        raise RuntimeError("the scene has no camera - pick one in Blender, or use the preview's free view")
    start = int(job.get("start") or sc.frame_start)
    end = int(job.get("end") or sc.frame_end)
    if end < start:
        start, end = end, start
    sc.frame_start, sc.frame_end = start, end
    pose_edits(edits, range(start, end + 1))
    eng = str(job.get("engine") or "WORKBENCH").upper()
    if eng == "WORKBENCH":
        r.engine = "BLENDER_WORKBENCH"
    elif eng == "EEVEE":
        r.engine = eevee_id()
    w, h = fit_size(r.resolution_x * r.resolution_percentage / 100.0, r.resolution_y * r.resolution_percentage / 100.0)
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.film_transparent = False
    extra = {}
    if job.get("objects2d") or job.get("still"):   # 2.540.0: the first frame (+ where each mesh is on it)
        sc.frame_set(start)
        if job.get("objects2d"):
            extra["objects2d"] = objects2d(sc, sc.camera)
            say("H3B note %d object(s) in view" % len(extra["objects2d"]))
        if job.get("still"):
            if hasattr(r.image_settings, "media_type"):
                try:
                    r.image_settings.media_type = "IMAGE"
                except Exception:              # noqa: BLE001
                    pass
            r.image_settings.file_format = "PNG"
            r.filepath = job["still"]
            bpy.ops.render.render(write_still=True)
            extra["still"] = job["still"] if os.path.isfile(job["still"]) else None
    im = r.image_settings
    if hasattr(im, "media_type"):
        try:
            im.media_type = "VIDEO"
        except Exception:                      # noqa: BLE001
            pass
    im.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"
    r.ffmpeg.codec = "H264"
    try:
        r.ffmpeg.constant_rate_factor = "HIGH"
    except Exception:                          # noqa: BLE001
        pass
    out = job["out"]
    r.filepath = out
    n = end - start + 1
    state = {"i": 0}

    def tick(_scene, *_a):
        state["i"] += 1
        say(f"H3B frame {state['i']}/{n}")
    bpy.app.handlers.render_post.append(tick)
    bpy.ops.render.render(animation=True)
    d = os.path.dirname(out)
    got = out if os.path.isfile(out) else None
    if not got:                                 # Blender adds the frame range to a name it thinks has none
        base = os.path.splitext(os.path.basename(out))[0]
        c = sorted((os.path.join(d, f) for f in os.listdir(d) if f.startswith(base) and f.endswith(".mp4")), key=os.path.getmtime)
        got = c[-1] if c else None
        if got and got != out:
            os.replace(got, out)
            got = out
    if not got:
        raise RuntimeError("Blender wrote no video - is FFmpeg output available in this Blender build?")
    with open(job_path + ".out.json", "w", encoding="utf-8") as fh:
        json.dump(dict({"frames": n, "fps": r.fps / (r.fps_base or 1.0), "width": w, "height": h, "start": start, "end": end}, **extra), fh)
    say("H3B done " + out)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    try:
        cmd = argv[0]
        if cmd == "export":
            export(argv[1], argv[2], argv[3])
        elif cmd == "save":
            save(argv[1], argv[2], argv[3:])
        elif cmd == "render":
            render(argv[1], argv[2], argv[3])
        elif cmd in ("daz_scene", "merge", "fbx2glb"):     # 2.405.0: Daz Studio -> bitGen (blend_daz.py)
            import blend_daz
            if cmd == "daz_scene":
                blend_daz.daz_scene(*argv[1:])
            elif cmd == "merge":
                blend_daz.merge(argv[1], argv[2], argv[3], argv[4])
            else:
                blend_daz.fbx2glb(argv[1], argv[2])
        elif cmd == "build":
            import blend_build
            notes = []
            plan = json.load(open(argv[1], encoding="utf-8"))
            blend_build.build(plan, argv[2], notes)
            for n in notes:
                say("H3B note " + n)
            say("H3B done " + argv[2])
        else:
            raise RuntimeError("usage: blend_scene.py -- export|save|render|build|daz_scene|merge|fbx2glb ...")
    except Exception as e:                      # noqa: BLE001
        say("H3B error: " + str(e).replace("\n", " ")[:600])
        sys.exit(1)


main()
