# bitGen Studio — scripts/blend_body3d.py (2.471.0): the BLENDER engine of the parametric 3D bodies.
#
# Settings ▸ 3D ▸ "Blender (on this computer)": lib/body3d.js runs
#   blender -b --factory-startup --python scripts/blend_body3d.py -- <job.json> <out.json>
# The job is static/body3d.js plan()'s (the same one the in-browser OpenCascade engine takes):
#   extrude / revolve  profiles (loops of segments L / A (3-point arc) / C (circle) / B (cubic)) -> a filled 2D curve
#                      (holes by even-odd), extruded (the curve's own extrude) or spun (bmesh spin) - then joined /
#                      cut / intersected with the body (Boolean, the EXACT solver)
#   fillet / chamfer   the sharp edges of the set (all / top / bottom / vertical / horizontal) bevelled (bmesh bevel:
#                      6 segments round, 1 flat) after the flat faces are merged (dissolve_limit)
#   split              the body intersected with a half-space box (keep pos / neg of the plane)
#   shell              the open face (top / bottom) taken away, Solidify inwards
# Out: {"mesh": {"vertices": [...], "triangles": [...]}, "volume": v, "warnings": [{id, msg}]}
import bpy, bmesh, json, sys, math
from mathutils import Vector, Matrix

TAU = math.pi * 2


def circ3(a, b, c):
    d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
    if abs(d) < 1e-12:
        return None
    A = a[0] ** 2 + a[1] ** 2; B = b[0] ** 2 + b[1] ** 2; C = c[0] ** 2 + c[1] ** 2
    x = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d
    y = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d
    return x, y, math.hypot(a[0] - x, a[1] - y)


def seg_poly(segs, step=math.radians(6)):
    out = []
    for g in segs:
        k = g["k"]
        if k == "L":
            out.append(g["a"])
        elif k == "C":
            n = max(24, int(math.ceil(TAU / step)))
            out += [[g["c"][0] + g["r"] * math.cos(TAU * i / n), g["c"][1] + g["r"] * math.sin(TAU * i / n)] for i in range(n)]
        elif k == "A":
            c = circ3(g["a"], g["m"], g["b"])
            if not c:
                out.append(g["a"]); continue
            t0 = math.atan2(g["a"][1] - c[1], g["a"][0] - c[0]); tm = math.atan2(g["m"][1] - c[1], g["m"][0] - c[0]); t1 = math.atan2(g["b"][1] - c[1], g["b"][0] - c[0])
            ccw = ((tm - t0) % TAU) < ((t1 - t0) % TAU)
            sweep = ((t1 - t0) % TAU) if ccw else -((t0 - t1) % TAU)
            if abs(sweep) < 1e-9:
                sweep = TAU if ccw else -TAU
            n = max(2, int(math.ceil(abs(sweep) / step)))
            out += [[c[0] + c[2] * math.cos(t0 + sweep * i / n), c[1] + c[2] * math.sin(t0 + sweep * i / n)] for i in range(n)]
        elif k == "B":
            n = 16
            for i in range(n):
                t = i / n; u = 1 - t
                out.append([u ** 3 * g["a"][j] + 3 * u * u * t * g["c1"][j] + 3 * u * t * t * g["c2"][j] + t ** 3 * g["b"][j] for j in (0, 1)])
    return out


def mesh_obj(name, me):
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def evaluated(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(ob.evaluated_get(dg))


def profile_mesh(profiles, z, extrude=0.0):
    """filled 2D curve of the profiles (holes even-odd); extrude = half the thickness (Blender's curve extrude)"""
    cu = bpy.data.curves.new("prof", "CURVE")
    cu.dimensions = "2D"; cu.fill_mode = "BOTH"; cu.extrude = extrude; cu.resolution_u = 1
    for p in profiles:
        for loop in [p["outer"]] + list(p.get("holes") or []):
            pts = seg_poly(loop)
            if len(pts) < 3:
                continue
            sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
            for i, q in enumerate(pts):
                sp.points[i].co = (q[0], q[1], 0.0, 1.0)
            sp.use_cyclic_u = True
    ob = bpy.data.objects.new("prof", cu); bpy.context.scene.collection.objects.link(ob)
    me = evaluated(ob)
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    me.transform(Matrix.Translation((0, 0, z)))
    weld(me)
    return me


def weld(me):
    """the curve's caps and walls come as separate pieces: one surface (shared corners)"""
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()


def solid_of(op):
    if op["op"] == "extrude":
        z, L = op["z"], op["dist"]
        if op.get("dir") == "sym":
            z = op["z"] - L / 2
        elif op.get("dir") == "two":
            z = op["z"] - op["dist2"]; L = op["dist"] + op["dist2"]
        if L < 0:
            z += L; L = -L
        return profile_mesh(op["profiles"], z + L / 2, L / 2)
    me = profile_mesh(op["profiles"], op["z"], 0.0)
    bm = bmesh.new(); bm.from_mesh(me)
    ax = op["axis"]; ang = math.radians(op["angle"]); full = abs(abs(op["angle"]) - 360) < 1e-6
    steps = max(8, int(math.ceil(abs(op["angle"]) / 5)))
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.spin(bm, geom=geom, cent=(ax["o"][0], ax["o"][1], op["z"]), axis=(ax["d"][0], ax["d"][1], 0.0), angle=ang, steps=steps, use_merge=full, use_duplicate=False)
    if full:   # the profile's own faces are inside the ring now
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        inner = [f for f in bm.faces if all(len(e.link_faces) > 2 for e in f.edges)]
        bmesh.ops.delete(bm, geom=inner, context="FACES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return me


def boolean(body, tool, mode):
    a = mesh_obj("body", body); b = mesh_obj("tool", tool)
    m = a.modifiers.new("b", "BOOLEAN"); m.object = b; m.solver = "EXACT"
    m.operation = {"join": "UNION", "new": "UNION", "cut": "DIFFERENCE", "intersect": "INTERSECT"}[mode]
    out = evaluated(a)
    bpy.data.objects.remove(a); bpy.data.objects.remove(b)
    return out


def zrange(me):
    zs = [v.co.z for v in me.vertices]
    return (min(zs), max(zs)) if zs else (0, 0)


def bevel(me, amount, segs, edge_set):
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
    z0, z1 = zrange(me); eps = 1e-4 * max(1.0, z1 - z0)
    pick = []
    for e in bm.edges:
        if len(e.link_faces) != 2 or e.calc_face_angle(0) < math.radians(30):
            continue
        a, b = e.verts[0].co, e.verts[1].co; d = (b - a)
        vert = d.length > 0 and abs(d.normalized().z) > 0.999
        if edge_set == "top" and not (abs(a.z - z1) < eps and abs(b.z - z1) < eps): continue
        if edge_set == "bottom" and not (abs(a.z - z0) < eps and abs(b.z - z0) < eps): continue
        if edge_set == "vertical" and not vert: continue
        if edge_set == "horizontal" and vert: continue
        pick.append(e)
    if not pick:
        bm.free(); raise RuntimeError("no edges of that kind")
    bmesh.ops.bevel(bm, geom=pick, offset=amount, offset_type="OFFSET", segments=segs, profile=0.5, affect="EDGES", clamp_overlap=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return me


def box_mesh(mn, mx):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector([mn[i] if v.co[i] < 0 else mx[i] for i in range(3)])
    me = bpy.data.meshes.new("box"); bm.to_mesh(me); bm.free()
    return me


def split(me, plane, o, keep):
    B = 1e5; pos = keep != "neg"; i = {"XY": 2, "XZ": 1, "YZ": 0}[plane]
    mn = [-B, -B, -B]; mx = [B, B, B]
    if pos: mn[i] = o
    else: mx[i] = o
    return boolean(me, box_mesh(mn, mx), "intersect")


def shell(me, t, face):
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts, edges=bm.edges)
    zs = [v.co.z for v in bm.verts]; z = max(zs) if face != "bottom" else min(zs); want = 1 if face != "bottom" else -1
    gone = [f for f in bm.faces if abs(f.normal.z - want) < 1e-3 and all(abs(v.co.z - z) < 1e-4 for v in f.verts)]
    if not gone:
        bm.free(); raise RuntimeError("no flat face there to open")
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bm.to_mesh(me); bm.free()
    ob = mesh_obj("sh", me); m = ob.modifiers.new("s", "SOLIDIFY"); m.thickness = t; m.offset = -1; m.use_even_offset = True; m.use_quality_normals = True
    out = evaluated(ob); bpy.data.objects.remove(ob)
    return out


def run(job):
    body = None; warnings = []
    for op in job.get("ops", []):
        try:
            k = op["op"]
            if k in ("extrude", "revolve"):
                s = solid_of(op)
                body = s if body is None else boolean(body, s, op.get("mode", "join"))
            elif body is None:
                continue
            elif k == "fillet":
                body = bevel(body, op["radius"], 6, op.get("edges", "all"))
            elif k == "chamfer":
                body = bevel(body, op["dist"], 1, op.get("edges", "all"))
            elif k == "split":
                body = split(body, op["plane"], op["offset"], op.get("keep", "pos"))
            elif k == "shell":
                body = shell(body, op["thick"], op.get("face", "top"))
        except Exception as e:   # one feature failing keeps the body before it
            warnings.append({"id": op.get("id"), "msg": str(e) or "Blender could not do it"})
    return body, warnings


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    job = json.load(open(argv[0], encoding="utf-8"))
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    body, warnings = run(job)
    if body is None:
        out = {"error": "; ".join(w["msg"] for w in warnings) or "nothing to build", "warnings": warnings}
    else:
        bm = bmesh.new(); bm.from_mesh(body); bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.verts.index_update()
        vol = abs(bm.calc_volume(signed=False))
        verts = [c for v in bm.verts for c in (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))]
        tris = [v.index for f in bm.faces for v in f.verts]
        bm.free()
        out = {"mesh": {"vertices": verts, "triangles": tris}, "volume": vol, "warnings": warnings}
    json.dump(out, open(argv[1], "w", encoding="utf-8"))


if __name__ == "__main__":
    main()
