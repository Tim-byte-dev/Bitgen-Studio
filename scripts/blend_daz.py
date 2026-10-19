"""bitGen Studio — DAZ STUDIO -> bitGen: the Blender side (2.405.0). Runs INSIDE Blender, imported by blend_scene.py:

    blender -b --factory-startup -P scripts/blend_scene.py -- daz_scene <scene.fbx> <out.blend> <info.json> <fps> <start> <end> [w h]
    blender -b --factory-startup -P scripts/blend_scene.py -- merge     <target.blend|.tmp> <source.blend> <pick.json> <out.blend>
    blender -b --factory-startup -P scripts/blend_scene.py -- fbx2glb   <model.fbx> <out.glb>

Tim (verbatim): "can we have a daz3d to bitgen bridge?" + "can we add option to merge daz3d scene with blender scene -
create a dialog for list of objects, lights, cameras to merge. dialogs must have a titlebar".

daz_scene  the FBX the bridge exported (figures with their rig, props, lights, cameras, the timeline's animation) ->
           a .blend: Daz's fps and play range (Daz frame 0 = Blender frame 1, the importer's own offset), the first
           camera the scene camera, a sun when Daz sent no light, the render size. info.json = the ROOT objects the
           merge dialog lists: {name, type: figure | mesh | light | camera | empty, parts (its children), animated}.
merge      the picked roots (each with everything under it) appended from the Daz .blend into the target (the open
           .blend preview's working copy) in a collection "Daz"; pick.json = {names: [...], camera: <a picked camera
           to make the scene camera> | null, range: true (stretch the target's frame range to the Daz animation),
           fps: the Daz scene's (its keys respaced when the target runs at another fps)}.
fbx2glb    one figure / prop -> a .glb (rig, skin, animation, textures) for the project's models3d/.
Prints "H3B note ...", "H3B objects <json>", "H3B done <path>", "H3B error: ...".
"""
import json
import os

import bpy

KIND = {"ARMATURE": "figure", "MESH": "mesh", "LIGHT": "light", "CAMERA": "camera", "EMPTY": "empty", "CURVE": "mesh"}


def say(s):
    print(s, flush=True)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def animated(o):
    if o.animation_data and o.animation_data.action:
        return True
    return any(c.animation_data and c.animation_data.action for c in o.children_recursive)


def roots_info():
    out = []
    for o in bpy.context.scene.objects:
        if o.parent is not None:
            continue
        k = KIND.get(o.type, "mesh")
        # Daz's figures arrive as an armature (the rig) with the body and clothing meshes under it
        out.append({"name": o.name, "type": k, "parts": len(o.children_recursive), "animated": bool(animated(o)),
                    "kids": [c.name for c in o.children_recursive][:40]})
    order = {"figure": 0, "mesh": 1, "empty": 2, "light": 3, "camera": 4}
    out.sort(key=lambda r: (order.get(r["type"], 9), r["name"].lower()))
    return out


def import_fbx(path):
    if not os.path.isfile(path):
        raise RuntimeError(f"the FBX is not there: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, anim_offset=1.0, automatic_bone_orientation=True,
                             ignore_leaf_bones=True, use_image_search=True)
    return [o for o in bpy.data.objects if o not in before]


def daz_scene(fbx, out, info_path, fps, start, end, w=0, h=0):
    clear()
    sc = bpy.context.scene
    fps = max(1, int(round(float(fps or 30))))
    sc.render.fps = fps
    new = import_fbx(fbx)
    if not new:
        raise RuntimeError("the FBX has no objects")
    s, e = int(start), int(end)
    sc.frame_start = max(1, s + 1)
    sc.frame_end = max(sc.frame_start + 1, e + 1)
    if int(w or 0) > 0 and int(h or 0) > 0:
        sc.render.resolution_x, sc.render.resolution_y = int(w), int(h)
    cams = [o for o in new if o.type == "CAMERA"]
    if cams:
        sc.camera = sorted(cams, key=lambda c: c.name)[0]
    if not any(o.type == "LIGHT" for o in new):
        ld = bpy.data.lights.new("Sun", "SUN")
        ld.energy = 3.0
        lo = bpy.data.objects.new("Sun", ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = (0.8, 0.0, 0.6)
        say("H3B note no light came from Daz - a sun added")
    if not sc.world:
        sc.world = bpy.data.worlds.new("World")
    info = {"objects": roots_info(), "fps": fps, "frame_start": sc.frame_start, "frame_end": sc.frame_end,
            "camera": sc.camera.name if sc.camera else None}
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(info, f)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    say(f"H3B note {len(new)} object(s) from Daz, frames {sc.frame_start}-{sc.frame_end} at {fps} fps"
        + (f", camera {sc.camera.name}" if sc.camera else ", no camera"))
    say("H3B objects " + json.dumps(info["objects"]))
    say("H3B done " + out)


def merge(target, source, pick_path, out):
    pick = json.load(open(pick_path, encoding="utf-8"))
    want = [str(n) for n in pick.get("names") or []]
    if not want:
        raise RuntimeError("nothing picked to merge")
    bpy.ops.wm.open_mainfile(filepath=target)
    sc = bpy.context.scene
    with bpy.data.libraries.load(source, link=False) as (src, dst):
        lib_names = list(src.objects)
        dst.objects = list(lib_names)
    # the library's names -> the loaded objects (Blender renames on a clash: "Camera" -> "Camera.001"), in order
    by = {n: o for n, o in zip(lib_names, dst.objects) if o is not None}
    loaded = list(by.values())
    keep = set()
    missing = []
    for n in want:
        o = by.get(n)
        if o is None:
            missing.append(n)
            continue
        keep.add(o)
        keep.update(o.children_recursive)
    col = bpy.data.collections.get("Daz") or bpy.data.collections.new("Daz")
    if col.name not in sc.collection.children:
        sc.collection.children.link(col)
    for o in loaded:
        if o in keep:
            col.objects.link(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    names_now = sorted(o.name for o in keep if o.parent is None or o.parent not in keep)
    cam = pick.get("camera")
    if cam:
        co = by.get(cam)
        if co is not None and co in keep and co.type == "CAMERA":
            sc.camera = co
            say(f"H3B note the scene camera is now {co.name} (from Daz)")
    # the Daz animation keeps its timing in a scene of another fps (Daz 30 fps into a 24 fps scene: keys respaced)
    sfps, tfps = float(pick.get("fps") or sc.render.fps), float(sc.render.fps)
    if abs(sfps - tfps) > 1e-6:
        k = tfps / sfps
        acts = {o.animation_data.action for o in keep if o.animation_data and o.animation_data.action}
        for act in acts:
            for fc in act.fcurves:
                for kp in fc.keyframe_points:
                    for attr in ("co", "handle_left", "handle_right"):
                        v = getattr(kp, attr)
                        v[0] = 1 + (v[0] - 1) * k
        if acts:
            say(f"H3B note the Daz animation ({sfps:g} fps) respaced for this scene's {tfps:g} fps")
    if pick.get("range", True):
        frames = [k.co[0] for o in keep if o.animation_data and o.animation_data.action
                  for fc in o.animation_data.action.fcurves for k in fc.keyframe_points]
        if frames and max(frames) > sc.frame_end:
            sc.frame_end = int(round(max(frames)))
            say(f"H3B note the frame range now ends at {sc.frame_end} (the Daz animation)")
    bpy.ops.wm.save_as_mainfile(filepath=out)
    say(f"H3B note merged {len(keep)} object(s): " + ", ".join(names_now))
    if missing:
        say("H3B note not in the Daz scene: " + ", ".join(missing))
    say("H3B merged " + json.dumps(names_now))
    say("H3B done " + out)


def fbx2glb(fbx, out):
    clear()
    new = import_fbx(fbx)
    if not new:
        raise RuntimeError("the FBX has no objects")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True, export_skins=True,
                              export_yup=True, export_apply=False)
    say(f"H3B note {len(new)} object(s) -> {os.path.basename(out)}")
    say("H3B done " + out)
