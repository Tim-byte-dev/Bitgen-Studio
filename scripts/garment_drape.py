"""bitGen Studio — scripts/garment_drape.py (2.933.0): 👗 a garment's pattern sewn and draped on the display mannequin, in Blender.

  blender -b --factory-startup --python scripts/garment_drape.py -- <request.json>
Quality (in the answer): seam_gap_cm (mean / max still open), inside_pct (garment points inside the body), drop_cm (the median
drop of its points - a top that slid off the shoulders, trousers that fell). Draped on the A-pose display mannequin
(<sex>_drape.obj), whatever measurements the pattern was made for. Tops, hoodies and skirts drape well; trousers and
sleeveless fitted bodices can slide (GarmentCode drafts the rise / straps for its own body) - the drop says so.

Blender's own cloth simulation (GPL program, run as a tool) - NOT GarmentCode's simulator (its NVIDIA Warp fork is non-commercial).
request: {"outline": <outline.json - scripts/garment_pattern.py>, "body": <the mannequin's A-pose OBJ (<sex>_drape.obj)>,
          "out": <folder>, "name", "res_cm": 1.8, "frames": 80, "fabric": "cotton|jersey|silk|denim", "color": [r, g, b] 0..1,
          "render": true, "size": [w, h], "samples": 24, "views": ["front", "side", "back"]}
1. Each piece becomes a flat cloth mesh: its outline resampled every res_cm (each edge on its own, so the seam vertices are
   known), points inside on a staggered grid, a constrained Delaunay triangulation (mathutils.geometry.delaunay_2d_cdt).
2. Each piece is placed where GarmentCode hangs it round the body: world = Rz Ry Rx (the panel's XYZ degrees) [x, y, 0] + t,
   cm -> m, GarmentCode's y-up / z-front -> Blender's z-up / -y front (the same turn as the mannequin OBJ's).
3. Every seam (outline.json's stitches) = loose edges between matching points along its two edges (the direction that brings
   them closest), Blender's SEWING SPRINGS pull them together; the mannequin is a collider. Gravity is off while the seams
   close, then comes on and the garment settles.
4. The result: the seams welded, garment.obj + .mtl (y up, like the mannequins), dressed.glb (garment + mannequin, for the
   image editor's 3D layer) and front / side / back renders (Cycles) of the dressed mannequin.
Prints "DRAPE_STEP <frame>/<frames>" as it goes and one "DRAPE {json}" line at the end.
"""
import json
import math
import os
import sys
import time

import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

FABRICS = {   # mass kg/m2-ish, tension / compression, shear, bending
    "cotton": (0.3, 15.0, 5.0, 0.5),
    "jersey": (0.25, 8.0, 3.0, 0.1),
    "silk": (0.15, 5.0, 2.0, 0.05),
    "denim": (0.4, 40.0, 15.0, 10.0),
}


def say(obj):
    print("DRAPE " + json.dumps(obj), flush=True)


def to_blender(p):
    """GarmentCode / the OBJ: x right, y up, z front (metres) -> Blender: x right, z up, -y front"""
    return Vector((p[0], -p[2], p[1]))


def rot(deg):
    rx, ry, rz = (math.radians(d) for d in deg)
    return Matrix.Rotation(rz, 3, "Z") @ Matrix.Rotation(ry, 3, "Y") @ Matrix.Rotation(rx, 3, "X")


def resample(pts, step):
    """points along an open polyline every ~step (both ends kept)"""
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i - 1], pts[i]))
    n = max(1, int(round(L[-1] / step)))
    out, j = [], 0
    for k in range(n + 1):
        t = L[-1] * k / n
        while j < len(L) - 2 and L[j + 1] < t:
            j += 1
        seg = (L[j + 1] - L[j]) or 1.0
        f = (t - L[j]) / seg
        a, b = pts[j], pts[min(j + 1, len(pts) - 1)]
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
    return out


def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) or 1e-12) + a[0]:
            c = not c
    return c


def seg_dist(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / ((ax * ax + ay * ay) or 1e-12)))
    return math.hypot(p[0] - a[0] - t * ax, p[1] - a[1] - t * ay)


def panel_mesh(P, step):
    """-> (verts2d cm, tris, edge_verts [[vertex ids along each edge, start -> end]])"""
    out = P["outline"]
    ring, edge_ids = [], []
    for e in P["edges"]:
        k0, k1 = e["at"]
        pts = out[k0:k1] + [out[k1 % len(out)]]
        rs = resample(pts, step)
        ids = []
        for q in rs[:-1]:
            ids.append(len(ring))
            ring.append(q)
        edge_ids.append(ids)
    n = len(ring)
    for i, ids in enumerate(edge_ids):            # each edge ends on the next one's first vertex
        ids.append(edge_ids[(i + 1) % len(edge_ids)][0] if edge_ids[(i + 1) % len(edge_ids)] else 0)
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    pts = list(ring)
    h = step * math.sqrt(3) / 2
    y, row = min(ys) + h * 0.5, 0
    while y < max(ys):
        x = min(xs) + (step / 2 if row % 2 else 0)
        while x < max(xs):
            if inside(ring, x, y) and min(seg_dist((x, y), ring[i], ring[i - 1]) for i in range(n)) > 0.55 * step:
                pts.append((x, y))
            x += step
        y += h
        row += 1
    vo, eo, fo, ov, oe, of = delaunay_2d_cdt([Vector(p) for p in pts], [], [list(range(n))], 1, 1e-5, True)
    remap = {}
    for new, olds in enumerate(ov):
        for o in olds:
            remap[o] = new
    edge_verts = [[remap[i] for i in ids] for ids in edge_ids]
    tris = [list(f) for f in fo if len(f) >= 3]
    return [tuple(v) for v in vo], tris, edge_verts


def load_obj(path):
    V, F = [], []
    with open(path, "r") as f:
        for line in f:
            if line.startswith("v "):
                V.append(to_blender([float(t) for t in line.split()[1:4]]))
            elif line.startswith("f "):
                F.append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
    return V, F


def obj_of(name, V, E, F):
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, E, F)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def material(name, rgb, rough, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1)
    b.inputs["Roughness"].default_value = rough
    for k in ("Sheen Weight", "Sheen"):
        if k in b.inputs:
            b.inputs[k].default_value = sheen
            break
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1)
    return m


def main():
    req = json.load(open(sys.argv[sys.argv.index("--") + 1]))
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    out = req["out"]
    os.makedirs(out, exist_ok=True)
    step = float(req.get("res_cm") or 1.8)
    frames = int(req.get("frames") or 80)
    outline = json.load(open(req["outline"]))

    # the mannequin
    BV, BF = load_obj(req["body"])
    body = obj_of("mannequin", BV, [], BF)
    for p in body.data.polygons:
        p.use_smooth = True
    col = body.modifiers.new("collision", "COLLISION")
    body.collision.thickness_outer = float(req.get("thickness") or 0.006)
    body.collision.thickness_inner = 0.02
    body.collision.damping = float(req.get("damping") or 0.1)

    # the pieces, placed round the body
    V, F, where, spans = [], [], {}, {}
    for P in outline["panels"]:
        v2, tris, ev = panel_mesh(P, step)
        R, t = rot(P.get("rotation", [0, 0, 0])), Vector(P.get("translation", [0, 0, 0]))
        base = len(V)
        for (x, y) in v2:
            w = R @ Vector((x, y, 0.0)) + t
            V.append(to_blender([w[0] / 100.0, w[1] / 100.0, w[2] / 100.0]))
        F += [[base + i for i in f] for f in tris]
        where[P["name"]] = [[base + i for i in ids] for ids in ev]
        spans[P["name"]] = (base, len(V))

    # the seams: loose edges between matching points of the two edges
    def pick(ids, t):
        if len(ids) == 1:
            return ids[0]
        L = [0.0]
        for i in range(1, len(ids)):
            L.append(L[-1] + (V[ids[i]] - V[ids[i - 1]]).length)
        want = t * L[-1]
        return ids[min(range(len(ids)), key=lambda i: abs(L[i] - want))]
    sew, gaps0 = set(), []
    for s in outline.get("stitches", []):
        try:
            A = where[s[0]["panel"]][s[0]["edge"]]
            B = where[s[1]["panel"]][s[1]["edge"]]
        except (KeyError, IndexError):
            continue
        n = max(len(A), len(B))
        ts = [i / (n - 1) for i in range(n)] if n > 1 else [0.0]
        fwd = sum((V[pick(A, t)] - V[pick(B, t)]).length for t in ts)
        rev = sum((V[pick(A, t)] - V[pick(B, 1 - t)]).length for t in ts)
        flip = rev < fwd
        for t in ts:
            a, b = pick(A, t), pick(B, 1 - t if flip else t)
            if a != b:
                sew.add((min(a, b), max(a, b)))
                gaps0.append((V[a] - V[b]).length)
    # GarmentCode hangs the pieces for ITS body; on ours a shoulder seam can start under the shoulder's surface (near the
    # neck) - sewn straight through it the top slides off. Lift the garment so that every seam of the upper body starts
    # above the surface (a ray down onto the mannequin), 2 cm clear; gravity brings it back down onto the shoulders.
    tree = BVHTree.FromPolygons([v for v in BV], BF)
    bz = [v.z for v in BV]
    upper = min(bz) + 0.72 * (max(bz) - min(bz))
    lift = 0.0
    for a, b in sew:
        m = (V[a] + V[b]) / 2
        if m.z < upper:
            continue
        hit = tree.ray_cast(Vector((m.x, m.y, max(bz) + 0.5)), Vector((0, 0, -1)))
        if hit[0] is not None and hit[0].z + 0.02 > m.z:
            lift = max(lift, hit[0].z + 0.02 - m.z)
    lift = min(lift, 0.15)
    if lift > 0:
        V = [v + Vector((0, 0, lift)) for v in V]
    if req.get("no_sew"):                                             # (tests: the pieces alone)
        sew = set()
    garment = obj_of("garment", V, sorted(sew), F)
    # the mannequin starts THIN (a shape key: each point moved inward by up to half its thickness, 5 cm at most) while the
    # seams close - their straight paths then pass round slim legs, arms and a slim torso instead of through them - and grows
    # back to its full shape before gravity comes on (the collider pushes the sewn garment out with it)
    thin_f = float(req.get("thin") or 0.0)          # off by default (it let trousers slide off - see HANDOVER 2.933.0)
    if thin_f > 0:
        body.shape_key_add(name="Basis")
        sk = body.shape_key_add(name="thin")
        for i, v in enumerate(body.data.vertices):
            n = v.normal
            hit = tree.ray_cast(v.co - n * 0.002, -n)
            d = (hit[0] - v.co).length if hit[0] is not None else 0.1
            sk.data[i].co = v.co - n * min(0.05, thin_f * d)
    for p in garment.data.polygons:
        p.use_smooth = True

    # the cloth
    mass, stiff, shear, bend = FABRICS.get(req.get("fabric") or "cotton", FABRICS["cotton"])
    cm = garment.modifiers.new("cloth", "CLOTH")
    cs = cm.settings
    cs.quality = int(req.get("quality") or 6)
    cs.mass = mass
    cs.tension_stiffness = cs.compression_stiffness = stiff
    cs.shear_stiffness = shear
    cs.bending_stiffness = bend
    cs.use_sewing_springs = True
    cs.sewing_force_max = float(req.get("sewing_force") or 12.0)
    cs.air_damping = 2.0
    cm.collision_settings.distance_min = 0.004
    cm.collision_settings.collision_quality = int(req.get("collision_quality") or 4)
    cm.collision_settings.use_self_collision = False
    cm.point_cache.frame_start = 1
    cm.point_cache.frame_end = frames
    sc.frame_start, sc.frame_end = 1, frames
    g = cs.effector_weights
    sew_until = max(10, int(frames * 0.45))
    g.gravity = 0.0
    g.keyframe_insert("gravity", frame=1)
    g.keyframe_insert("gravity", frame=sew_until)
    g.gravity = 0.0 if req.get("no_gravity") else 1.0                # (tests / looking at the sewing alone)
    g.keyframe_insert("gravity", frame=min(frames, sew_until + 16))
    # the body slippery while the seams close (the pieces slide round it), then gripping (a T-shirt stays on the shoulders)
    if thin_f > 0:
        sk.value = 1.0
        sk.keyframe_insert("value", frame=1)
        sk.keyframe_insert("value", frame=sew_until)
        sk.value = 0.0
        sk.keyframe_insert("value", frame=min(frames, sew_until + 12))
    bc = body.collision
    bc.cloth_friction = float(req.get("friction_sew") or 5.0)
    body.keyframe_insert('collision.cloth_friction', frame=1)
    body.keyframe_insert('collision.cloth_friction', frame=sew_until)
    bc.cloth_friction = float(req.get("friction") or 80.0)
    body.keyframe_insert('collision.cloth_friction', frame=sew_until + 5)
    ghost = int(req.get("ghost_frames") if req.get("ghost_frames") is not None else 0)
    if ghost > 0:      # the body passable while the seams start closing (pieces already round a leg close round it)
        bc.use = False
        body.keyframe_insert('collision.use', frame=1)
        body.keyframe_insert('collision.use', frame=ghost)
        bc.use = True
        body.keyframe_insert('collision.use', frame=ghost + 1)
    for f in range(1, frames + 1):
        sc.frame_set(f)
        if f % 5 == 0 or f == frames:
            print("DRAPE_STEP %d/%d" % (f, frames), flush=True)
            if req.get("trace"):
                ev0 = garment.evaluated_get(bpy.context.evaluated_depsgraph_get())
                zs0 = [ (ev0.matrix_world @ v.co).z for v in ev0.data.vertices]
                print("DRAPE_TRACE f%d z %.3f..%.3f" % (f, min(zs0), max(zs0)), flush=True)
                if req.get("trace") == "panels":
                    print("   " + " ".join("%s=%.2f" % (k, sum(zs0[a:b]) / max(1, b - a)) for k, (a, b) in spans.items()), flush=True)

    # the result: the modifier applied, the seams welded, the loose seam edges gone
    dg = bpy.context.evaluated_depsgraph_get()
    ev = garment.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    done_v = [v.co.copy() for v in me.vertices]
    gaps = [(done_v[a] - done_v[b]).length for a, b in sew]
    # how far the garment as a whole slid down: the median drop of its points (a hood falling back is not a slide)
    dz = sorted(V[i].z - done_v[i].z for i in range(min(len(V), len(done_v))))
    drop = dz[len(dz) // 2] if dz else 0.0
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    loose = [e for e in bm.edges if not e.link_faces]
    pairs = [(e.verts[0], e.verts[1]) for e in loose]
    bmesh.ops.delete(bm, geom=loose, context="EDGES")
    targetmap = {}
    for a, b in pairs:
        if a.is_valid and b.is_valid and (a.co - b.co).length < 0.012:
            targetmap[b] = a
    if targetmap:
        bmesh.ops.weld_verts(bm, targetmap=targetmap)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    bpy.data.objects.remove(garment)
    dressed = bpy.data.objects.new("garment", me)
    sc.collection.objects.link(dressed)
    body.modifiers.remove(col)
    if body.data.shape_keys:
        body.shape_key_clear()
    # how well it sits: seams still open (cm) and garment points inside the body
    inside_n = 0
    for v in me.vertices:
        hit = tree.find_nearest(v.co)
        if hit[0] is not None and (v.co - hit[0]).dot(hit[1]) < -0.004:
            inside_n += 1
    rgb = req.get("color") or [0.55, 0.12, 0.16]
    dressed.data.materials.append(material("fabric", rgb, 0.85, 0.6))
    body.data.materials.append(material("mannequin", (0.92, 0.92, 0.92), 0.25))

    files = {}
    bpy.ops.object.select_all(action="DESELECT")
    dressed.select_set(True)
    bpy.context.view_layer.objects.active = dressed
    obj_path = os.path.join(out, "garment.obj")
    bpy.ops.wm.obj_export(filepath=obj_path, export_selected_objects=True, forward_axis="NEGATIVE_Z", up_axis="Y",
                          export_materials=True, apply_modifiers=True)
    files["obj"] = "garment.obj"
    if os.path.exists(os.path.join(out, "garment.mtl")):
        files["mtl"] = "garment.mtl"
    body.select_set(True)
    try:
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, "dressed.glb"), export_format="GLB", use_selection=True)
        files["glb"] = "dressed.glb"
    except Exception as e:     # the glTF exporter is an add-on that can be off
        print("glTF export failed: %s" % e, flush=True)

    if req.get("render", True):
        files.update(render(req, sc, body, dressed, out))
    res = {"ok": True, "files": files, "verts": len(me.vertices), "faces": len(me.polygons), "seams": len(sew),
           "seam_gap_cm": round(100 * (sum(gaps) / len(gaps)) if gaps else 0.0, 2),
           "seam_gap_max_cm": round(100 * max(gaps) if gaps else 0.0, 2),
           "seam_gap_start_cm": round(100 * (sum(gaps0) / len(gaps0)) if gaps0 else 0.0, 2),
           "inside_pct": round(100.0 * inside_n / max(1, len(me.vertices)), 2), "frames": frames,
           "lift_cm": round(lift * 100, 1), "drop_cm": round(100 * drop, 1),
           "seconds": round(time.time() - t0, 1)}
    with open(os.path.join(out, "drape.json"), "w") as f:
        json.dump(res, f)
    say(res)


def render(req, sc, body, dressed, out):
    w, h = req.get("size") or [640, 960]
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.get_devices()
        for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
                if any(d.type == kind for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = True
                    sc.cycles.device = "GPU"
                    break
            except Exception:
                continue
    except Exception:
        pass
    sc.cycles.samples = int(req.get("samples") or 24)
    # the denoiser only where Blender was built with it (the official builds are; some Linux packages are not)
    sc.cycles.use_denoising = bool(getattr(bpy.app.build_options, "openimagedenoise", False))
    sc.render.resolution_x, sc.render.resolution_y = int(w), int(h)
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.02, 0.022, 1)
    sc.world = world
    for name, loc, power, size in (("key", (2.5, -3.0, 3.2), 900, 2.0), ("fill", (-3.0, -2.0, 1.8), 350, 2.5),
                                   ("rim", (0.5, 3.0, 2.8), 600, 1.5)):
        L = bpy.data.lights.new(name, "AREA")
        L.energy, L.size = power, size
        o = bpy.data.objects.new(name, L)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(o)
    zs = [v.co.z for v in body.data.vertices]
    top, mid = max(zs), (max(zs) + min(zs)) / 2
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 70
    cam = bpy.data.objects.new("cam", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    dist = top * 3.1
    files = {}
    for view in req.get("views") or ["front", "side", "back"]:
        d = {"front": Vector((0, -1, 0)), "side": Vector((1, 0, 0)), "back": Vector((0, 1, 0))}.get(view)
        if d is None:
            continue
        cam.location = d * dist + Vector((0, 0, mid))
        cam.rotation_euler = (Vector((0, 0, mid)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(out, view + ".png")
        bpy.ops.render.render(write_still=True)
        files[view] = view + ".png"
        print("DRAPE_RENDER %s" % view, flush=True)
    return files


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        say({"ok": False, "error": str(e)[:400]})
        sys.exit(1)
