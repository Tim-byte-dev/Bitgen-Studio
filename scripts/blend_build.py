"""bitGen Studio — a SCENE PLAN -> a .blend (2.404.0). Runs INSIDE Blender, imported by scripts/blend_scene.py:

    blender -b --factory-startup -P scripts/blend_scene.py -- build <plan.json> <out.blend>

Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image to
workflow?". Option 1: the LLM writes a small JSON plan (lib/scenePlan.js asks for it and cleans it) and this builds it -
no LLM-written Python ever runs. The image half: an object of kind "model" carries the .glb made from its picture
(mesh3d_worker.py) and is imported here, set on the ground and sized to the plan's height.

Plan (lib/scenePlan.clean - Blender's axes: metres, Z up, the camera looks along +Y at first, an object's front faces -Y):
  {title, seconds, fps, width, height, sky: "#rrggbb", ground: {size, color} | null,
   sun: {elevation, azimuth, strength, color},
   objects: [{name, kind, at: [x, y, z] (the base's centre), size: [w (x), d (y), h (z)], turn (degrees about Z),
              color, file (kind "model" / "asset": an absolute .glb / .gltf / .fbx / .obj path), text,
              moves: [{t (seconds), at, turn}]}],
   camera: {lens (mm), keys: [{t, at, look}]}}
Every object is ONE mesh object named by the plan (its parts joined, one material per colour) - what the preview
selects and edits. A primitive / a composite (car, tree, person ...) is drawn in a unit box ([-0.5, 0.5] x [-0.5, 0.5]
x [0, 1]) and stretched to its size, so the plan's sizes are exact. Moves are linear keys; the camera eases.
"""
import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- colours / materials
NAMED = {"red": "#c0392b", "blue": "#2e6db4", "green": "#3a8f3a", "yellow": "#e3c33a", "orange": "#e07b29",
         "purple": "#7d4aa8", "pink": "#e58fb0", "white": "#eeeeee", "black": "#1c1c1c", "grey": "#808080",
         "gray": "#808080", "brown": "#7a5230", "silver": "#b8bcc2", "gold": "#c9a227", "beige": "#d8c8a8",
         "teal": "#2a8f8f", "navy": "#1f3366", "dark": "#2a2a2a", "wood": "#8a5a35", "skin": "#d9a882",
         "glass": "#9fc3d8", "metal": "#9aa0a6", "leaf": "#3f7f35", "asphalt": "#3a3a3c", "concrete": "#9a9a96",
         "sand": "#d6c08f", "water": "#2f6f9f", "brick": "#9c4a32", "stone": "#8c8c88", "grass": "#4c7f35"}


def rgb(c, default="#9a9a9a"):
    s = str(c or "").strip().lower()
    s = NAMED.get(s, s)
    if not (s.startswith("#") and len(s) in (4, 7)):
        s = NAMED.get(str(default).lower(), default)
    if len(s) == 4:
        s = "#" + "".join(ch * 2 for ch in s[1:])
    try:
        return tuple(int(s[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
    except ValueError:
        return (0.6, 0.6, 0.6)


def lin(v):                                    # sRGB -> linear (Blender's colour inputs are linear)
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


_MATS = {}


def material(hexcol, glow=0.0, rough=0.6, metal=0.0, alpha=1.0):
    key = (hexcol, glow, rough, metal, alpha)
    if key in _MATS:
        return _MATS[key]
    r, g, b = rgb(hexcol)
    m = bpy.data.materials.new(f"bg {hexcol}{' glow' if glow else ''}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    col = (lin(r), lin(g), lin(b), 1.0)
    m.diffuse_color = col
    if bsdf:
        bsdf.inputs["Base Color"].default_value = col
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        if glow:
            for k in ("Emission Color", "Emission"):
                if k in bsdf.inputs:
                    bsdf.inputs[k].default_value = col
                    break
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = glow
        if alpha < 1.0:
            bsdf.inputs["Alpha"].default_value = alpha
    _MATS[key] = m
    return m


# ---------------------------------------------------------------- parts in a unit box
# (shape, centre, dims, colour role, rotation degrees XYZ) - cyl / cone axes along Z before the rotation;
# roles: main (the object's colour) or a fixed name / hex
P = lambda shape, c, d, role="main", rot=(0, 0, 0): (shape, c, d, role, rot)   # noqa: E731
WHEEL = (90, 0, 90)                             # a cylinder turned so its axis is X (a wheel)
KINDS = {
    "box": [P("cube", (0, 0, .5), (1, 1, 1))],
    "cube": [P("cube", (0, 0, .5), (1, 1, 1))],
    "sphere": [P("sphere", (0, 0, .5), (1, 1, 1))],
    "ball": [P("sphere", (0, 0, .5), (1, 1, 1))],
    "cylinder": [P("cyl", (0, 0, .5), (1, 1, 1))],
    "cone": [P("cone", (0, 0, .5), (1, 1, 1))],
    "plane": [P("cube", (0, 0, .005), (1, 1, .01))],
    "torus": [P("torus", (0, 0, .5), (1, 1, 1))],
    "pyramid": [P("pyr", (0, 0, .5), (1, 1, 1))],
    "car": [P("cube", (0, 0, .33), (1, 1, .36)), P("cube", (0, .06, .7), (.86, .5, .36), "glass"),
            P("cube", (0, .06, .89), (.88, .52, .03)),
            P("cyl", (.45, -.32, .16), (.32, .32, .1), "dark", WHEEL), P("cyl", (-.45, -.32, .16), (.32, .32, .1), "dark", WHEEL),
            P("cyl", (.45, .32, .16), (.32, .32, .1), "dark", WHEEL), P("cyl", (-.45, .32, .16), (.32, .32, .1), "dark", WHEEL),
            P("cube", (.33, -.5, .4), (.16, .02, .06), "#fff3c4"), P("cube", (-.33, -.5, .4), (.16, .02, .06), "#fff3c4")],
    "truck": [P("cube", (0, -.36, .45), (1, .26, .6)), P("cube", (0, -.36, .7), (.9, .2, .2), "glass"),
              P("cube", (0, .14, .55), (1, .7, .9), "#d8d8d8"),
              P("cyl", (.45, -.36, .12), (.24, .24, .1), "dark", WHEEL), P("cyl", (-.45, -.36, .12), (.24, .24, .1), "dark", WHEEL),
              P("cyl", (.45, .3, .12), (.24, .24, .1), "dark", WHEEL), P("cyl", (-.45, .3, .12), (.24, .24, .1), "dark", WHEEL)],
    "bus": [P("cube", (0, 0, .5), (1, 1, .8)), P("cube", (0, 0, .62), (1.01, .96, .2), "glass"),
            P("cyl", (.45, -.34, .1), (.2, .2, .1), "dark", WHEEL), P("cyl", (-.45, -.34, .1), (.2, .2, .1), "dark", WHEEL),
            P("cyl", (.45, .34, .1), (.2, .2, .1), "dark", WHEEL), P("cyl", (-.45, .34, .1), (.2, .2, .1), "dark", WHEEL)],
    "bicycle": [P("torus", (0, -.25, .25), (.5, .5, .1), "dark", (0, 90, 0)), P("torus", (0, .25, .25), (.5, .5, .1), "dark", (0, 90, 0)),
                P("cube", (0, 0, .5), (.06, .56, .06)), P("cube", (0, .05, .75), (.3, .06, .06), "dark")],
    "boat": [P("cube", (0, 0, .25), (1, 1, .5)), P("pyr", (0, -.5, .25), (1, .3, .5), "main", (0, 0, 0)),
             P("cube", (0, .15, .65), (.6, .4, .3), "white")],
    "tree": [P("cyl", (0, 0, .2), (.14, .14, .4), "wood"), P("sphere", (0, 0, .66), (1, 1, .7), "leaf")],
    "pine": [P("cyl", (0, 0, .1), (.1, .1, .2), "wood"), P("cone", (0, 0, .6), (1, 1, .8), "#2f5f2f")],
    "palm": [P("cyl", (0, 0, .45), (.08, .08, .9), "wood"), P("sphere", (0, 0, .92), (1, 1, .16), "leaf")],
    "bush": [P("sphere", (0, 0, .5), (1, 1, 1), "leaf")],
    "flower": [P("cyl", (0, 0, .35), (.06, .06, .7), "leaf"), P("sphere", (0, 0, .85), (1, 1, .3))],
    "rock": [P("ico", (0, 0, .45), (1, 1, .9), "stone")],
    "mountain": [P("cone", (0, 0, .5), (1, 1, 1), "stone"), P("cone", (0, 0, .9), (.25, .25, .2), "white")],
    "lamp_post": [P("cyl", (0, 0, .5), (.12, .12, 1), "dark"), P("cube", (0, -.25, .98), (.06, .5, .04), "dark"),
                  P("sphere", (0, -.48, .93), (.3, .3, .08), "#fff1b0")],
    "street_light": "lamp_post",
    "traffic_light": [P("cyl", (0, 0, .4), (.1, .1, .8), "dark"), P("cube", (0, 0, .85), (.5, .4, .3), "dark"),
                      P("sphere", (0, -.2, .93), (.2, .05, .05), "#e03030"), P("sphere", (0, -.2, .85), (.2, .05, .05), "#e0c030"),
                      P("sphere", (0, -.2, .77), (.2, .05, .05), "#30c040")],
    "sign": [P("cyl", (0, 0, .35), (.08, .08, .7), "metal"), P("cube", (0, 0, .82), (1, .08, .32))],
    "bench": [P("cube", (0, 0, .45), (1, .45, .08), "wood"), P("cube", (0, .21, .78), (1, .06, .45), "wood"),
              P("cube", (.45, 0, .22), (.06, .45, .44), "dark"), P("cube", (-.45, 0, .22), (.06, .45, .44), "dark")],
    "table": [P("cube", (0, 0, .95), (1, 1, .1)), P("cube", (.44, .44, .45), (.08, .08, .9), "main"),
              P("cube", (-.44, .44, .45), (.08, .08, .9)), P("cube", (.44, -.44, .45), (.08, .08, .9)),
              P("cube", (-.44, -.44, .45), (.08, .08, .9))],
    "chair": [P("cube", (0, 0, .48), (1, 1, .07)), P("cube", (0, .46, .75), (1, .08, .5)),
              P("cube", (.42, .42, .24), (.1, .1, .48)), P("cube", (-.42, .42, .24), (.1, .1, .48)),
              P("cube", (.42, -.42, .24), (.1, .1, .48)), P("cube", (-.42, -.42, .24), (.1, .1, .48))],
    "sofa": [P("cube", (0, .05, .22), (1, .9, .44)), P("cube", (0, .4, .6), (1, .2, .5)),
             P("cube", (.45, 0, .4), (.1, .9, .4)), P("cube", (-.45, 0, .4), (.1, .9, .4))],
    "bed": [P("cube", (0, 0, .25), (1, 1, .5), "wood"), P("cube", (0, 0, .58), (.96, .96, .16), "white"),
            P("cube", (0, .48, .7), (1, .04, .6), "wood"), P("cube", (0, .35, .7), (.7, .2, .1), "white")],
    "desk": [P("cube", (0, 0, .96), (1, 1, .08)), P("cube", (.45, 0, .46), (.08, .9, .92)), P("cube", (-.45, 0, .46), (.08, .9, .92))],
    "shelf": [P("cube", (0, 0, .5), (1, 1, 1)), P("cube", (0, -.05, .33), (.94, .92, .03), "dark"), P("cube", (0, -.05, .66), (.94, .92, .03), "dark")],
    "tv": [P("cube", (0, 0, .55), (1, 1, .9), "dark"), P("cube", (0, -.51, .55), (.92, .02, .8), "#2a3a55")],
    "lamp": [P("cyl", (0, 0, .03), (.6, .6, .06), "dark"), P("cyl", (0, 0, .4), (.08, .08, .75), "dark"),
             P("cone", (0, 0, .85), (1, 1, .3), "#fff1b0")],
    "door": [P("cube", (0, 0, .5), (1, 1, 1), "wood"), P("sphere", (.35, -.6, .5), (.08, .2, .04), "gold")],
    "window": [P("cube", (0, 0, .5), (1, 1, 1), "white"), P("cube", (0, -.05, .5), (.86, 1, .86), "glass")],
    "wall": [P("cube", (0, 0, .5), (1, 1, 1))],
    "fence": [P("cube", (0, 0, .75), (1, .4, .1), "main"), P("cube", (0, 0, .35), (1, .4, .1), "main")]
             + [P("cube", (x / 5.0 - .5, 0, .45), (.04, 1, .9)) for x in range(0, 6)],
    "stairs": [P("cube", (0, .5 - (i + .5) / 6.0, (i + 1) / 12.0), (1, 1 / 6.0, (i + 1) / 6.0)) for i in range(6)],
    "house": [P("cube", (0, 0, .3), (1, 1, .6)), P("pyr", (0, 0, .8), (1.08, 1.08, .4), "brick"),
              P("cube", (0, -.5, .18), (.18, .03, .36), "wood"),
              P("cube", (.28, -.5, .36), (.18, .03, .16), "glass"), P("cube", (-.28, -.5, .36), (.18, .03, .16), "glass")],
    "building": [P("cube", (0, 0, .5), (1, 1, 1))]
                + [P("cube", (0, -.502, (k + .5) / 8.0), (.9, .01, .05), "glass") for k in range(8)]
                + [P("cube", (0, 0, 1.01), (1.02, 1.02, .02), "dark")],
    "tower": [P("cyl", (0, 0, .45), (1, 1, .9)), P("cone", (0, 0, .95), (1.1, 1.1, .1), "dark")],
    "road": [P("cube", (0, 0, .5), (1, 1, 1), "asphalt")] + [P("cube", (0, k / 6.0 - .42, 1.02), (.04, .08, .04), "white") for k in range(6)],
    "sidewalk": [P("cube", (0, 0, .5), (1, 1, 1), "concrete")],
    "water": [P("cube", (0, 0, .5), (1, 1, 1), "water")],
    "pool": [P("cube", (0, 0, .5), (1, 1, 1), "white"), P("cube", (0, 0, .6), (.9, .9, .9), "water")],
    "bridge": [P("cube", (0, 0, .9), (1, 1, .2)), P("cube", (0, .45, .5), (.06, .1, .8)), P("cube", (0, -.45, .5), (.06, .1, .8))],
    "arch": [P("cube", (.4, 0, .45), (.2, 1, .9)), P("cube", (-.4, 0, .45), (.2, 1, .9)), P("cube", (0, 0, .92), (1, 1, .16))],
    "pillar": [P("cyl", (0, 0, .5), (1, 1, 1), "white")],
    "statue": [P("cube", (0, 0, .15), (1, 1, .3), "stone"), P("cyl", (0, 0, .55), (.4, .4, .5), "stone"),
               P("sphere", (0, 0, .88), (.35, .35, .24), "stone")],
    "barrel": [P("cyl", (0, 0, .5), (1, 1, 1), "wood")],
    "crate": [P("cube", (0, 0, .5), (1, 1, 1), "wood")],
    "person": [P("cyl", (.12, 0, .24), (.18, .3, .48), "#2a3a55"), P("cyl", (-.12, 0, .24), (.18, .3, .48), "#2a3a55"),
               P("cyl", (0, 0, .64), (.5, .5, .34)), P("cyl", (.32, 0, .62), (.12, .18, .32), "main", (0, 0, 0)),
               P("cyl", (-.32, 0, .62), (.12, .18, .32)), P("sphere", (0, 0, .9), (.26, .4, .14), "skin"),
               P("cyl", (.32, 0, .44), (.1, .16, .06), "skin"), P("cyl", (-.32, 0, .44), (.1, .16, .06), "skin")],
    "child": "person",
    "dog": [P("cube", (0, 0, .62), (.5, .6, .36)), P("cube", (0, -.36, .85), (.4, .26, .28)),
            P("cube", (0, -.5, .8), (.24, .12, .12)), P("cyl", (.15, -.22, .25), (.14, .1, .5)), P("cyl", (-.15, -.22, .25), (.14, .1, .5)),
            P("cyl", (.15, .22, .25), (.14, .1, .5)), P("cyl", (-.15, .22, .25), (.14, .1, .5)),
            P("cyl", (0, .36, .78), (.08, .08, .3), "main", (60, 0, 0))],
    "cat": "dog",
    "horse": [P("cube", (0, 0, .62), (.5, .64, .3)), P("cube", (0, -.36, .86), (.24, .2, .4), "main", (-30, 0, 0)),
              P("cube", (0, -.46, .98), (.22, .2, .14)),
              P("cyl", (.17, -.24, .3), (.12, .08, .6)), P("cyl", (-.17, -.24, .3), (.12, .08, .6)),
              P("cyl", (.17, .24, .3), (.12, .08, .6)), P("cyl", (-.17, .24, .3), (.12, .08, .6))],
    "bird": [P("sphere", (0, 0, .5), (.6, 1, .6)), P("sphere", (0, -.45, .7), (.4, .4, .4)),
             P("cube", (0, 0, .55), (1, .4, .05))],
}
ALIASES = {"streetlight": "lamp_post", "lamppost": "lamp_post",
           "skyscraper": "building", "tower_block": "building", "column": "pillar", "box_crate": "crate",
           "vehicle": "car", "suv": "car", "van": "truck", "human": "person", "man": "person", "woman": "person",
           "character": "person", "cupboard": "shelf", "bookshelf": "shelf", "monitor": "tv", "hill": "mountain",
           "lake": "water", "river": "water", "ground": "plane", "floor": "plane", "pavement": "sidewalk"}


def kind_parts(kind):
    k = ALIASES.get(kind, kind)
    v = KINDS.get(k)
    if isinstance(v, str):
        v = KINDS.get(v)
    return v or KINDS["box"]


def add_part(bm, shape, centre, dims, rot):
    """a primitive of size dims at centre (unit box) into bm -> the new faces"""
    before = set(bm.faces)
    M = Matrix.Translation(Vector(centre)) @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4() \
        @ Matrix.Diagonal(Vector((dims[0], dims[1], dims[2], 1.0)))
    if shape == "cube":
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    elif shape == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=0.5, matrix=M)
    elif shape == "ico":
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.5, matrix=M)
    elif shape == "cyl":
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.5, radius2=0.5, depth=1.0, matrix=M)
    elif shape == "cone":
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.5, radius2=0.0, depth=1.0, matrix=M)
    elif shape == "pyr":
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=4, radius1=0.7071, radius2=0.0, depth=1.0,
                              matrix=M @ Matrix.Rotation(math.radians(45), 4, "Z"))
    elif shape == "torus":
        R, r, nu, nv = 0.35, 0.15, 24, 10
        vs = []
        for i in range(nu):
            a = 2 * math.pi * i / nu
            ring = []
            for j in range(nv):
                b = 2 * math.pi * j / nv
                p = Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b) / 0.3))
                ring.append(bm.verts.new(M @ p))
            vs.append(ring)
        for i in range(nu):
            for j in range(nv):
                bm.faces.new((vs[i][j], vs[(i + 1) % nu][j], vs[(i + 1) % nu][(j + 1) % nv], vs[i][(j + 1) % nv]))
    return [f for f in bm.faces if f not in before]


def mesh_object(name, kind, size, color):
    parts = kind_parts(kind)
    bm = bmesh.new()
    mats, idx = [], {}
    main = color or "#9a9a9a"
    for shape, c, d, role, rot in parts:
        hexcol = main if role == "main" else role
        glow = 2.0 if hexcol in ("#fff1b0", "#fff3c4") else 0.0
        alpha_k = (hexcol, glow)
        if alpha_k not in idx:
            idx[alpha_k] = len(mats)
            mats.append(material(hexcol, glow=glow, rough=0.15 if role == "glass" else 0.6,
                                 metal=0.6 if role in ("metal", "glass") else 0.0))
        for f in add_part(bm, shape, c, d, rot):
            f.material_index = idx[alpha_k]
    w, dd, h = size
    bmesh.ops.scale(bm, vec=Vector((w, dd, h)), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- imported models (.glb from a picture)
def import_model(path, name):
    """a model file -> ONE mesh object (every part's world transform baked, one material list), at the origin.
    None when the file cannot be read."""
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)
    try:
        if ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        elif ext == ".obj":
            if hasattr(bpy.ops.wm, "obj_import"):
                bpy.ops.wm.obj_import(filepath=path)
            else:
                bpy.ops.import_scene.obj(filepath=path)
        else:
            return None
    except Exception:                                    # noqa: BLE001
        return None
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        return None
    bpy.context.view_layer.update()
    bm = bmesh.new()
    mats = []
    for o in meshes:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        off = len(mats)
        mats.extend(list(o.data.materials) or [None])
        for f in tmp.faces:
            f.material_index += off
        me2 = bpy.data.meshes.new("bitgen_tmp")
        tmp.to_mesh(me2)
        tmp.free()
        bm.from_mesh(me2)
        bpy.data.meshes.remove(me2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def bounds(me):
    if not me.vertices:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    xs = [v.co for v in me.vertices]
    lo = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
    hi = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    return lo, hi


def fit_model(o, size):
    """the base's centre at the origin, its HEIGHT = the plan's (the other sides follow, the shape kept)"""
    lo, hi = bounds(o.data)
    h = max(1e-6, hi.z - lo.z)
    k = max(1e-4, float(size[2])) / h
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    o.data.transform(Matrix.Diagonal(Vector((k, k, k, 1.0))) @ Matrix.Translation(-centre))
    return k


# ---------------------------------------------------------------- the scene
def look_rot(at, look):
    d = Vector(look) - Vector(at)
    if d.length < 1e-6:
        d = Vector((0, 1, 0))
    return d.to_track_quat("-Z", "Y").to_euler()


def build(plan, out, notes):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    fps = int(plan.get("fps") or 24)
    secs = float(plan.get("seconds") or 5)
    sc.render.fps = fps
    sc.frame_start = 1
    sc.frame_end = max(2, int(round(secs * fps)))         # frames 1..N = the plan's seconds; t = seconds maps into them
    sc.render.resolution_x, sc.render.resolution_y = int(plan.get("width") or 1280), int(plan.get("height") or 704)
    sc.render.resolution_percentage = 100
    fr = lambda t: max(1, min(sc.frame_end, 1 + int(round(max(0.0, float(t)) / max(secs, 1e-3) * (sc.frame_end - 1)))))  # noqa: E731
    # the world: sky colour + a little ambient
    w = bpy.data.worlds.new("bitGen sky") if not sc.world else sc.world
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        r, g, b = rgb(plan.get("sky") or "#a9c4dc")
        bg.inputs[0].default_value = (lin(r), lin(g), lin(b), 1)
        bg.inputs[1].default_value = 0.8
    gr = plan.get("ground")
    if gr:
        s = float(gr.get("size") or 40)
        o = mesh_object("Ground", "plane", (s, s, 0.01), gr.get("color") or "grass")
        o.location = (0, 0, -0.01)
        o["bitgen_kind"] = "ground"
    sun = plan.get("sun") or {}
    ld = bpy.data.lights.new("Sun", "SUN")
    ld.energy = float(sun.get("strength") or 3.0)
    ld.color = rgb(sun.get("color") or "#fff4e0")
    lo = bpy.data.objects.new("Sun", ld)
    sc.collection.objects.link(lo)
    el, az = math.radians(float(sun.get("elevation", 45))), math.radians(float(sun.get("azimuth", 135)))
    lo.rotation_euler = (math.pi / 2 - el, 0, az)
    lo.location = (0, 0, 20)
    used = set(o.name for o in bpy.data.objects)
    for i, ob in enumerate(plan.get("objects") or []):
        name = str(ob.get("name") or f"Object {i + 1}")[:60]
        while name in used:
            name = name + "+"
        used.add(name)
        kind = str(ob.get("kind") or "box")
        size = [max(0.02, float(x)) for x in (ob.get("size") or [1, 1, 1])][:3]
        o = None
        if kind in ("model", "asset") and ob.get("file"):
            o = import_model(str(ob["file"]), name)
            if o:
                fit_model(o, size)
                notes.append(f"{name}: the model {os.path.basename(str(ob['file']))}, {size[2]:.2f} m tall")
            else:
                notes.append(f"{name}: {os.path.basename(str(ob['file']))} could not be read - a stand-in box")
        if not o:
            if kind in ("model", "asset"):
                fallback = str(ob.get("like") or "box")
                o = mesh_object(name, fallback if fallback in KINDS or fallback in ALIASES else "box", size, ob.get("color"))
                if not ob.get("file"):
                    notes.append(f"{name}: no model made - a stand-in {fallback if fallback in KINDS else 'box'}")
            else:
                o = mesh_object(name, kind, size, ob.get("color"))
        o["bitgen_kind"] = kind
        if ob.get("describe"):
            o["bitgen_describe"] = str(ob["describe"])[:300]
        at = ob.get("at") or [0, 0, 0]
        o.location = Vector(at)
        o.rotation_euler = (0, 0, math.radians(float(ob.get("turn") or 0)))
        moves = ob.get("moves") or []
        if len(moves) >= 2:
            for mv in moves:
                f = fr(mv.get("t", 0))
                o.location = Vector(mv.get("at") or at)
                o.rotation_euler = (0, 0, math.radians(float(mv.get("turn", ob.get("turn") or 0))))
                o.keyframe_insert("location", frame=f)
                o.keyframe_insert("rotation_euler", frame=f)
            if o.animation_data and o.animation_data.action:
                for fc in o.animation_data.action.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = "LINEAR"
    # the camera
    cam = plan.get("camera") or {}
    cd = bpy.data.cameras.new("Camera")
    cd.lens = float(cam.get("lens") or 35)
    cd.clip_end = 2000
    co = bpy.data.objects.new("Camera", cd)
    sc.collection.objects.link(co)
    sc.camera = co
    keys = cam.get("keys") or [{"t": 0, "at": [0, -12, 1.7], "look": [0, 0, 1]}]
    prev = None
    for kf in keys:
        co.location = Vector(kf.get("at") or [0, -12, 1.7])
        e = look_rot(kf.get("at") or [0, -12, 1.7], kf.get("look") or [0, 0, 1])
        if prev is not None:
            e.make_compatible(prev)
        co.rotation_euler = e
        prev = e.copy()
        if len(keys) >= 2:
            co.keyframe_insert("location", frame=fr(kf.get("t", 0)))
            co.keyframe_insert("rotation_euler", frame=fr(kf.get("t", 0)))
    sc.frame_set(1)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    notes.append(f"{len(plan.get('objects') or [])} object(s), {sc.frame_end} frames at {fps} fps, "
                 f"{sc.render.resolution_x}x{sc.render.resolution_y}, camera {len(keys)} key(s)")
    return out
