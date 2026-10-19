"""bitGen Studio — scripts/make_layer3d_fixture.py (2.460.0): a small posable scene for the 3D layer tests (run by Blender).

blender -b --factory-startup -P scripts/make_layer3d_fixture.py -- <out.blend> [animated]
  A grey floor, a red "Body" box, an armature "Figure" (bones "hip" -> "arm"; the arm sticks out sideways along +X) with
  a blue "Arm" box parented to the bone "arm" (so posing the bone moves it), a camera "Cam" looking at the figure from
  the front (-Y), a sun. What a Daz figure sent through the bridge looks like to the 3D layer (an armature + meshes).
"""
import math
import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    return m


def box(name, loc, size, m):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.data.materials.append(m)
    return o


box("Floor", (0, 0, -0.05), (3, 3, 0.05), mat("grey", (0.5, 0.5, 0.5)))
body = box("Body", (0, 0, 1), (0.25, 0.2, 0.6), mat("red", (0.8, 0.05, 0.05)))
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.active_object
arm.name = "Figure"
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones
hip = eb[0]
hip.name = "hip"
hip.head, hip.tail = Vector((0, 0, 0.4)), Vector((0, 0, 1.4))
b = eb.new("arm")
b.head, b.tail = Vector((0.25, 0, 1.4)), Vector((1.25, 0, 1.4))
b.parent = hip
bpy.ops.object.mode_set(mode="OBJECT")
a = box("Arm", (0.75, 0, 1.4), (0.5, 0.1, 0.1), mat("blue", (0.05, 0.1, 0.9)))
bpy.context.view_layer.update()
mw = a.matrix_world.copy()
a.parent = arm
a.parent_type = "BONE"
a.parent_bone = "arm"
a.matrix_world = mw
cd = bpy.data.cameras.new("Cam")
cd.angle = math.radians(45)
cam = bpy.data.objects.new("Cam", cd)
sc.collection.objects.link(cam)
cam.location = (0, -6, 1.2)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam
ld = bpy.data.lights.new("Sun", "SUN")
ld.energy = 3
lo = bpy.data.objects.new("Sun", ld)
sc.collection.objects.link(lo)
lo.rotation_euler = (0.6, 0.2, 0.4)
sc.world = bpy.data.worlds.new("World")
sc.render.resolution_x, sc.render.resolution_y = 640, 480
if "animated" in sys.argv[sys.argv.index("--") + 1:]:       # 2.461.0: the arm swings (keys at 1 and 21) - for the pose-on-animation tests
    pb = arm.pose.bones["arm"]
    pb.rotation_mode = "XYZ"
    for f, deg in ((1, -30), (21, 30)):
        pb.rotation_euler = (0, 0, math.radians(deg))
        pb.keyframe_insert("rotation_euler", frame=f)
    sc.frame_start, sc.frame_end = 1, 21
    sc.frame_set(11)
bpy.ops.wm.save_as_mainfile(filepath=out)
print("H3L fixture " + out, flush=True)
