# bitGen Studio — scripts/chase_car.py (2.937.0): 🚓 POLICE CHASE's CARS from 3D models - the Blender side.
#
#   python  scripts/chase_car.py --in car.fbx|.glb|.obj --out car.glb [--tris 14000] [--paint "body"] [--drop "Gauge,skin"]
#           [--turn 180] [--tex 512]             (a Python with `import bpy`, Blender 4.2+ / the bpy module)
#   blender -b --factory-startup --python scripts/chase_car.py -- --in ... --out ...
# One car for the game: everything joined into one mesh, the parts in --drop left out (insides nobody sees), cut down to about
# --tris triangles (Decimate), turned so its nose points along Blender's +Y (--turn degrees round Z first), the wheels on
# the ground, centred, textures shrunk to --tex px, the paint material renamed "Body" (the game tints it for each police
# car), exported as a binary glTF. The game scales it to its tile. (Collada .dae: convert first - Blender 5 reads no .dae.)
import sys, os, math

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv and argv.index(n) + 1 < len(argv) else d

import bpy
from mathutils import Vector, Matrix

src, out = arg("--in"), arg("--out")
TRIS = int(arg("--tris", "14000")); TEX = int(arg("--tex", "512")); TURN = float(arg("--turn", "0"))
PAINT = [s.strip().lower() for s in (arg("--paint", "") or "").split(",") if s.strip()]
DROP = [s.strip().lower() for s in (arg("--drop", "") or "").split(",") if s.strip()]
if not src or not out:
    raise SystemExit("--in and --out are needed")
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext == ".fbx":
    try: bpy.ops.preferences.addon_enable(module="io_scene_fbx")
    except Exception: pass
    bpy.ops.import_scene.fbx(filepath=src)
elif ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=src)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=src)
else:
    raise SystemExit("not a car file I can read: " + ext)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.type != "MESH" or any(d in o.name.lower() for d in DROP) or any(m and any(d in m.name.lower() for d in DROP) for m in o.data.materials):
        bpy.data.objects.remove(o, do_unlink=True)
ms = [o for o in sc.objects if o.type == "MESH"]
if not ms:
    raise SystemExit("no meshes left")
# one mesh, transforms applied
for o in ms:
    o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(ms) > 1:
    bpy.ops.object.join()
car = bpy.context.view_layer.objects.active
me = car.data
tris0 = sum(len(p.vertices) - 2 for p in me.polygons)
# turn, centre, wheels on the ground
car.data.transform(Matrix.Rotation(math.radians(TURN), 4, "Z"))
vs = [v.co for v in me.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
me.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
# cut down
if tris0 > TRIS:
    mod = car.modifiers.new("cut", "DECIMATE"); mod.ratio = max(0.005, TRIS / tris0); mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
tris1 = sum(len(p.vertices) - 2 for p in me.polygons)
# the paint
named = False
for m in me.materials:
    if m and PAINT and m.name.lower() in PAINT and not named:
        m.name = "Body"; named = True
# small textures
for im in bpy.data.images:
    try:
        if im.size[0] > TEX or im.size[1] > TEX:
            k = TEX / max(im.size[0], im.size[1]); im.scale(max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))
    except Exception as e:
        print("CHASE_CAR image", im.name, e)
ext_m = hi - lo
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=False, export_image_format="JPEG",
                          export_apply=True, export_yup=True)
print("CHASE_CAR", os.path.basename(src), "tris", tris0, "->", tris1, "size_m", [round(ext_m.x, 3), round(ext_m.y, 3), round(ext_m.z, 3)],
      "paint", named, "bytes", os.path.getsize(out))
