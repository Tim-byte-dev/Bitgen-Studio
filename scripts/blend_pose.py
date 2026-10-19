"""bitGen Studio — scripts/blend_pose.py (2.461.0): figure poses from bitGen, shared by the Blender scripts.

A pose = {<armature name>: {<bone name>: [x, y, z]}} - degrees turned on top of the bone's own rotation (Euler XYZ in
the bone's local axes, as Blender's pose mode turns it). Used by scripts/blend_layer3d.py (the image editor's 3D layer,
one frame) and scripts/blend_scene.py (the timeline's .blend preview: save / render a frame range).
  keep()                          the file's own rotation of every pose bone (once, after the file is opened)
  reset()                         back to it (the 3D layer's next job starts from the file's pose)
  apply(pose, frames, mute)       turn the bones; an ANIMATED armature gets the turn keyed at every frame in `frames`
                                  (its own motion + the turn) - or, mute=True (one still frame), its rotation channels of
                                  those bones muted until reset(); a still armature once -> how many bones were turned
  armatures()                     [{name, bones: [{name, parent}]}] for the pages' Pose lists
"""
import math

import bpy
from mathutils import Euler, Quaternion, Vector

REST = {}
MUTED = []


def keep():
    REST.clear()
    for o in bpy.context.scene.objects:
        if o.type != "ARMATURE":
            continue
        for pb in o.pose.bones:
            REST[(o.name, pb.name)] = (pb.rotation_mode, pb.rotation_quaternion.copy(), pb.rotation_euler.copy(), tuple(pb.rotation_axis_angle))


def reset():
    while MUTED:                                   # the channels a still pose muted (apply(..., mute=True))
        try:
            MUTED.pop().mute = False
        except Exception:                          # noqa: BLE001 - gone with its action
            pass
    for (an, bn), (mode, q, e, aa) in REST.items():
        o = bpy.data.objects.get(an)
        pb = o.pose.bones.get(bn) if o else None
        if not pb:
            continue
        pb.rotation_mode = mode
        pb.rotation_quaternion = q
        pb.rotation_euler = e
        pb.rotation_axis_angle = aa


def own_quat(pb, mode=None):
    m = mode or pb.rotation_mode
    if m == "QUATERNION":
        return pb.rotation_quaternion.copy()
    if m == "AXIS_ANGLE":
        a = pb.rotation_axis_angle
        return Quaternion(Vector((a[1], a[2], a[3])), a[0])
    return Euler(tuple(pb.rotation_euler), m if m in ("XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX") else "XYZ").to_quaternion()


def delta(rot):
    x, y, z = (math.radians(float(v or 0)) for v in (list(rot) + [0, 0, 0])[:3])
    return None if abs(x) + abs(y) + abs(z) < 1e-9 else Euler((x, y, z), "XYZ").to_quaternion()


def bone_curves(o, bn):
    act = o.animation_data.action if o.animation_data else None
    pre = 'pose.bones["%s"].rotation_' % bn.replace('"', '\\"')
    return [fc for fc in (act.fcurves if act else []) if fc.data_path.startswith(pre)]


def apply(pose, frames=None, mute=False):
    sc = bpy.context.scene
    keep_frame = sc.frame_current
    n = 0
    for an, bones in (pose or {}).items():
        o = bpy.data.objects.get(an)
        if not o or o.type != "ARMATURE":
            continue
        animated = bool(o.animation_data and o.animation_data.action)
        todo = []
        for bn, rot in (bones or {}).items():
            pb = o.pose.bones.get(bn)
            d = delta(rot) if pb else None
            if pb and d is not None:
                todo.append((pb, d, pb.rotation_mode))
        if not todo:
            continue
        if animated and mute:                          # ONE frame (the 3D layer): its own value, its rotation channels muted
            sc.frame_set(int((frames or [keep_frame])[0]))
            for pb, d, m0 in todo:
                q = own_quat(pb, m0)
                for fc in bone_curves(o, pb.name):
                    if not fc.mute:
                        fc.mute = True
                        MUTED.append(fc)
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = q @ d
        elif animated:
            fs = [int(f) for f in (frames or [keep_frame])]
            own = {}
            for f in fs:                                       # first every frame's own value (the action as it is) ...
                sc.frame_set(f)
                for i, (pb, d, m0) in enumerate(todo):
                    own[(i, f)] = own_quat(pb, m0)
            for f in fs:                                       # ... then the keys (so a new key never bends the next read)
                for i, (pb, d, m0) in enumerate(todo):
                    pb.rotation_mode = "QUATERNION"
                    pb.rotation_quaternion = own[(i, f)] @ d
                    pb.keyframe_insert("rotation_quaternion", frame=f)
            sc.frame_set(keep_frame)
        else:
            for pb, d, m0 in todo:
                q = own_quat(pb, m0)
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = q @ d
        n += len(todo)
    return n


def armatures():
    out = []
    for o in bpy.context.scene.objects:
        if o.type == "ARMATURE":
            out.append({"name": o.name, "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None} for b in o.data.bones]})
    return out
