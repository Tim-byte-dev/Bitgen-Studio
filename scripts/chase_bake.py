# bitGen Studio — scripts/chase_bake.py (2.936.0): 🚓 POLICE CHASE's BUILDINGS from your own Blender city - the Blender side.
#
# Run by scripts/chase_assets.py (or by hand) with Blender's Python - the Blender app or the bpy module:
#   blender -b --python scripts/chase_bake.py -- --file city.blend --out DIR [--size 512] [--only "Coll A,Coll B"]
#   python  scripts/chase_bake.py --file city.blend --out DIR        (a Python that has `import bpy`)
# Every innermost collection holding something taller than 1.5 m is one building. Each is rendered alone with Cycles from
# its four sides and from above, orthographic, on a transparent background, at one scale (the longest side = --size px):
#   DIR/<slug>_px.png (seen from +X), _nx (-X), _pz (from -Y, the front), _nz (+Y), _py (from above)
#   DIR/bake.json  [{id, name, size_m: [x, y, z], faces: {px, nx, pz, nz, py}}]
# The game shows each building as a box wearing these five pictures (an "impostor"): a dozen triangles however detailed the
# model is - and the model itself is never part of the game, only pictures of it.
import sys, os, json, math, re

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
def arg(name, dflt=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else dflt

import bpy
from mathutils import Vector

src, out = arg("--file"), arg("--out")
SIZE = int(arg("--size", "512"))
ONLY = [s.strip() for s in (arg("--only", "") or "").split(",") if s.strip()]
SAMPLES = int(arg("--samples", "24"))
if not out:
    raise SystemExit("--out DIR is needed")
if src:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene

def meshes(coll):
    return [o for o in coll.all_objects if o.type == "MESH"]
def bounds(objs):
    lo = Vector((1e18,) * 3); hi = Vector((-1e18,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "building"

# the buildings: the scene's collections - the innermost ones (or --only), each taller than 1.5 m
def leaves(c):                             # a collection that holds collections is a group: its children are the buildings
    return [c] if not c.children else [x for k in c.children for x in leaves(k)]
tops = [x for c in sc.collection.children for x in leaves(c)]
cands = [c for c in tops if (not ONLY or c.name in ONLY)]
builds = []
for c in cands:
    ms = meshes(c)
    if not ms:
        continue
    lo, hi = bounds(ms)
    if hi.z - lo.z < 1.5:
        continue
    builds.append((c, ms, lo, hi))
print("CHASE_BAKE buildings:", [b[0].name for b in builds])

# one even light for every picture: a soft sky + a sun from the front left, nothing else
for o in list(sc.objects):
    if o.type in ("LIGHT", "CAMERA"):
        o.hide_render = True
world = bpy.data.worlds.new("chase_bake_sky"); world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.78, 0.82, 0.9, 1); bg.inputs[1].default_value = 0.9
sc.world = world
sun_d = bpy.data.lights.new("chase_sun", "SUN"); sun_d.energy = 2.6; sun_d.angle = math.radians(8)
sun = bpy.data.objects.new("chase_sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
cam_d = bpy.data.cameras.new("chase_cam"); cam_d.type = "ORTHO"
cam = bpy.data.objects.new("chase_cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
r = sc.render
r.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.device = "CPU"
try: sc.cycles.use_denoising = False
except Exception: pass
r.film_transparent = True; r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
r.resolution_percentage = 100
try: sc.view_settings.view_transform = "Standard"
except Exception: pass

everything = [o for o in sc.objects if o.type in ("MESH", "CURVE", "FONT", "SURFACE", "META")]
VIEWS = {  # face: (camera direction from the centre, width axis, height axis) - the camera's own Y stays up (world Z;
           # from above: world +Y, the game's -Z, at the top of the picture)
    "pz": (Vector((0, -1, 0)), 0, 2),   # the front: from -Y, looking +Y  (the game's +Z side)
    "nz": (Vector((0, 1, 0)), 0, 2),
    "px": (Vector((1, 0, 0)), 1, 2),
    "nx": (Vector((-1, 0, 0)), 1, 2),
    "py": (Vector((0, 0, 1)), 0, 1),
}
done = []
for coll, ms, lo, hi in builds:
    keep = set(ms)
    for o in everything:
        o.hide_render = o not in keep
    ctr = (lo + hi) / 2; ext = hi - lo; reach = ext.length * 2 + 10
    big = max(ext.x, ext.y, ext.z)
    sid = slug(coll.name); faces = {}
    for face, (d, wa, ha) in VIEWS.items():
        w, h = ext[wa], ext[ha]
        r.resolution_x = max(16, round(SIZE * w / big)); r.resolution_y = max(16, round(SIZE * h / big))
        cam_d.ortho_scale = max(w, h); cam_d.clip_start = 0.01; cam_d.clip_end = reach * 2
        cam.location = ctr + d * reach
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        f = os.path.join(out, f"{sid}_{face}.png")
        r.filepath = f
        bpy.ops.render.render(write_still=True)
        faces[face] = os.path.basename(f)
        print("CHASE_BAKE", coll.name, face, r.resolution_x, "x", r.resolution_y, flush=True)
    done.append({"id": sid, "name": coll.name, "size_m": [round(ext.x, 3), round(ext.y, 3), round(ext.z, 3)], "faces": faces})
with open(os.path.join(out, "bake.json"), "w") as fh:
    json.dump(done, fh, indent=1)
print("CHASE_BAKE done", len(done))
