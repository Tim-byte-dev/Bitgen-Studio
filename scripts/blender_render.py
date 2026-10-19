"""bitGen Studio — render ONE 3D layer in Blender (2.385.0): the "Blender render bake".

Run by lib/blender.js:  blender -b --factory-startup -P scripts/blender_render.py -- <job.json>

Tim (verbatim): "is it possible for us to create a blender to bitgen bridge?" -> "Add-on + Blender render bake".

The job (lib/blender.js writes it):
  {spec: <the clip's m3d>, w, h, fps, frames: [{t, rx, ry, rz, pz, sx, sy, sz}], model: <abs path> | null,
   font: <abs path to a TTF> | null, texture: <abs path> | null, parts: {"<n>": name}, out: <dir>, engine, samples}
Every frame is rendered as out/f_00000.png ... (RGBA, a transparent background) - the same frames the browser bake
sends - and lib/m3d.encode() turns them into video/m3d_<id>.webm for the compile.
The scene matches static/m3d.js: the object centred and 1 unit across, the camera framed by the same formula, the
same lights (studio + the layer's own), the material as a Principled BSDF. Progress on stdout: "H3B frame i/n".
"""
import json
import math
import os
import sys

import bpy                       # noqa: E402  (Blender only)
from mathutils import Matrix, Vector   # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blender_common as B      # noqa: E402


def say(*a):
    print("H3B", *a, flush=True)


def job_path():
    argv = sys.argv
    return argv[argv.index("--") + 1] if "--" in argv else None


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            try:
                node.inputs[n].default_value = value
                return True
            except (TypeError, ValueError):
                continue
    return False


def make_material(spec, name, texture=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None) or nt.nodes.new("ShaderNodeBsdfPrincipled")
    col = B.srgb_to_linear(B.hex_rgb(spec["color"]))
    set_input(bsdf, ["Base Color"], (col[0], col[1], col[2], 1.0))
    set_input(bsdf, ["Metallic"], float(spec["metal"]))
    set_input(bsdf, ["Roughness"], float(spec["rough"]))
    set_input(bsdf, ["IOR"], float(spec["ior"]))
    set_input(bsdf, ["Alpha"], float(spec["opacity"]))
    set_input(bsdf, ["Coat Weight", "Clearcoat"], float(spec["clearcoat"]))
    set_input(bsdf, ["Transmission Weight", "Transmission"], float(spec["glass"]))
    if spec["glow"] > 0:
        e = B.srgb_to_linear(B.hex_rgb(spec["emissive"], (0, 0, 0)))
        set_input(bsdf, ["Emission Color", "Emission"], (e[0], e[1], e[2], 1.0))
        set_input(bsdf, ["Emission Strength"], float(spec["glow"]))
    if spec["opacity"] < 1 or spec["glass"] > 0:
        for attr, v in (("blend_method", "BLEND"), ("surface_render_method", "BLENDED")):
            try:
                setattr(m, attr, v)
            except (AttributeError, TypeError):
                pass
    if texture and os.path.exists(texture):
        try:
            img = bpy.data.images.load(texture)
            tx = nt.nodes.new("ShaderNodeTexImage")
            tx.image = img
            mp = nt.nodes.new("ShaderNodeMapping")
            co = nt.nodes.new("ShaderNodeTexCoord")
            r = float(spec.get("repeat") or 1)
            mp.inputs["Scale"].default_value = (r, r, r)
            nt.links.new(co.outputs["UV"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
            nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
        except Exception as ex:      # a texture never stops the render
            say("texture skipped:", ex)
    return m


def mesh_objects(objs):
    return [o for o in objs if o.type == "MESH"]


def world_bbox(objs):
    lo, hi = [math.inf] * 3, [-math.inf] * 3
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type not in ("MESH", "FONT", "CURVE"):
            continue
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    if lo[0] == math.inf:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    return Vector(lo), Vector(hi)


def import_model(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=path)
        else:
            bpy.ops.import_scene.obj(filepath=path)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        raise RuntimeError("not a model file: " + path)
    return [o for o in bpy.data.objects if o not in before]


def build_object(job):
    """the object, centred on the origin and 1 unit across, under `holder` (what each frame moves)"""
    spec = job["spec"]
    holder = bpy.data.objects.new("H3_holder", None)
    bpy.context.scene.collection.objects.link(holder)
    inner = bpy.data.objects.new("H3_inner", None)
    bpy.context.scene.collection.objects.link(inner)
    inner.parent = holder
    layer_mat = make_material(B.mat_spec(spec), "H3_layer", job.get("texture"))
    if spec.get("type") == "text":
        cu = bpy.data.curves.new("H3_text", "FONT")
        cu.body = str(spec.get("text") or " ")
        if job.get("font") and os.path.exists(job["font"]):
            cu.font = bpy.data.fonts.load(job["font"])
        cu.size = 1.0
        cu.extrude = max(0.0005, B.num(spec.get("depth"), 0.25)) / 2
        bev = B.num(spec.get("bevel"), 0)
        if bev > 0:
            cu.bevel_depth = bev * 0.6
            cu.bevel_resolution = 3
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        ob = bpy.data.objects.new("H3_text", cu)
        bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(layer_mat)
        # three.js lays the text in its XY plane facing +Z: Blender's XZ plane facing -Y
        ob.rotation_euler = (math.radians(90), 0, 0)
        bpy.context.view_layer.update()
        lo, hi = world_bbox([ob])
        ctr = (lo + hi) / 2
        ob.location = ob.location - ctr
        ob.parent = inner
        size = hi - lo
        box = (size[0], size[2], size[1])          # back to three's (w, h, depth)
        return holder, "box", box, [ob]
    path = job.get("model")
    if not path or not os.path.exists(path):
        raise RuntimeError("the model file is missing: " + str(path))
    new = import_model(path)
    roots = [o for o in new if o.parent is None]
    bpy.context.view_layer.update()
    lo, hi = world_bbox(new)
    ctr, r = (lo + hi) / 2, max(1e-6, (hi - lo).length / 2)
    for o in roots:
        o.parent = inner
    inner.location = -ctr / r
    inner.scale = (1 / r, 1 / r, 1 / r)
    # materials: each part the file's own, this layer's, or a preset (matched by its name - the page lists the parts
    # in three.js's order, Blender's importers may list them differently)
    parts = spec.get("parts") or {}
    names = job.get("parts") or {}
    by_name = {}
    for n, use in parts.items():
        nm = names.get(str(n))
        if nm:
            by_name[nm] = use
    default = "own" if spec.get("keepMat") else "layer"
    cache = {}
    for o in mesh_objects(new):
        mats = [s.material.name if s.material else "" for s in o.material_slots]
        use = by_name.get(o.name) or next((by_name[m] for m in mats if m in by_name), None) or default
        if use == "own":
            continue
        if use not in cache:
            cache[use] = layer_mat if use == "layer" else make_material(B.mat_spec(spec, use), "H3_" + use)
        o.data.materials.clear()
        o.data.materials.append(cache[use])
    return holder, "sphere", (2.0, 2.0, 2.0), new


def finish_look(spec, objs):
    x = spec.get("mat") or {}
    for o in mesh_objects(objs):
        if x.get("flat"):
            for p in o.data.polygons:
                p.use_smooth = False
        if x.get("wire"):
            mod = o.modifiers.new("H3_wire", "WIREFRAME")
            mod.thickness = 0.01


def add_lights(spec):
    world = bpy.data.worlds.new("H3_world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    amb = [0.0, 0.0, 0.0]
    for L in B.lights_of(spec):
        kind = L["type"]
        if L.get("studio"):
            col, power = (1.0, 1.0, 1.0), L["power"]
        else:
            col, power = B.srgb_to_linear(B.hex_rgb(L.get("color"))), B.light_power(kind, L.get("b"))
        if kind in ("ambient", "sky"):
            for i in range(3):
                amb[i] += col[i] * power
            continue
        bl_kind = {"sun": "SUN", "spot": "SPOT"}.get(kind, "POINT")
        ld = bpy.data.lights.new("H3_" + kind, bl_kind)
        ld.color = col
        if bl_kind == "SUN":
            ld.energy = power
        else:
            ld.energy = power
            ld.shadow_soft_size = 0.1
        if bl_kind == "SPOT":
            ld.spot_size = math.radians(max(1.0, min(89.0, B.num(L.get("angle"), 30)))) * 2
            ld.spot_blend = 0.35
        ob = bpy.data.objects.new("H3_" + kind, ld)
        bpy.context.scene.collection.objects.link(ob)
        pos = Vector(B.to_bl(L.get("x", 2), L.get("y", 2), L.get("z", 3)))
        ob.location = pos
        d = -pos if pos.length > 1e-6 else Vector((0, 1, 0))
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if bg:
        bg.inputs["Color"].default_value = (amb[0], amb[1], amb[2], 1.0)
        bg.inputs["Strength"].default_value = 1.0


def add_camera(job, fit, box):
    w, h = int(job["w"]), int(job["h"])
    dist = B.framing(w, h, fit, box)
    cd = bpy.data.cameras.new("H3_cam")
    cd.sensor_fit = "VERTICAL"
    cd.lens_unit = "FOV"
    cd.angle_y = math.radians(B.FOV_DEG)
    cd.clip_start = max(0.001, dist / 100)
    cd.clip_end = dist * 100
    cam = bpy.data.objects.new("H3_cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = Vector(B.to_bl(0, 0, dist))
    cam.rotation_euler = (math.radians(90), 0, 0)      # looks along +Y, Z up
    bpy.context.scene.camera = cam
    return dist


def setup_render(job):
    sc = bpy.context.scene
    r = sc.render
    have = [e.identifier for e in r.bl_rna.properties["engine"].enum_items]
    r.engine = B.engine_id(job.get("engine"), have)
    r.resolution_x, r.resolution_y, r.resolution_percentage = int(job["w"]), int(job["h"]), 100
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    r.fps = int(job.get("fps") or 24)
    try:
        sc.view_settings.view_transform = "Standard"     # three.js writes plain sRGB (no Filmic / AgX)
    except TypeError:
        pass
    samples = int(job.get("samples") or 0)
    if samples > 0:
        if r.engine == "CYCLES":
            sc.cycles.samples = samples
            sc.cycles.device = "GPU" if job.get("gpu") else "CPU"
        elif hasattr(sc, "eevee"):
            sc.eevee.taa_render_samples = samples
    return r.engine


def place(holder, f, dist):
    D = math.radians
    R = Matrix.Identity(4)
    for key, axis in B.euler_axes():
        R = R @ Matrix.Rotation(D(B.num(f.get(key), 0)), 4, Vector(axis))
    s = B.scale_bl(*(max(0.01, B.num(f.get(k), 1)) for k in ("sx", "sy", "sz")))
    S = Matrix.Diagonal((s[0], s[1], s[2], 1.0))
    T = Matrix.Translation(Vector(B.to_bl(0, 0, B.clamp_depth(B.num(f.get("pz"), 0), dist))))
    holder.matrix_world = T @ R @ S


def main():
    jp = job_path()
    if not jp:
        raise SystemExit("usage: blender -b -P blender_render.py -- job.json")
    with open(jp, "r", encoding="utf-8") as fh:
        job = json.load(fh)
    clear()
    sc = bpy.context.scene
    sc.render.fps = int(job.get("fps") or 24)       # before an import: the file's animation lands on these frames
    engine = setup_render(job)
    holder, fit, box, objs = build_object(job)
    finish_look(job["spec"], objs)
    add_lights(job["spec"])
    dist = add_camera(job, fit, box)
    out = job["out"]
    os.makedirs(out, exist_ok=True)
    frames = job.get("frames") or [{"t": 0}]
    anim = job["spec"].get("anim") is not False
    say("engine", engine, "frames", len(frames), "dist", round(dist, 4))
    start = sc.frame_start
    for i, f in enumerate(frames):
        sc.frame_set(start + (int(round(B.num(f.get("t"), 0) * sc.render.fps)) if anim else 0))
        place(holder, f, dist)
        sc.render.filepath = os.path.join(out, "f_%05d.png" % i)
        bpy.ops.render.render(write_still=True)
        say("frame %d/%d" % (i + 1, len(frames)))
    say("done", len(frames))


try:
    main()
except Exception as ex:          # the server shows this line
    import traceback
    traceback.print_exc()
    say("error:", ex)
    sys.exit(1)
