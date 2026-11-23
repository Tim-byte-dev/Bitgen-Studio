#!/usr/bin/env python3
"""bitGen Studio - scripts/make_mannequin_mesh.py (2.928.0): the DISPLAY MANNEQUINS' 3D bodies (glossy, faceless).

Tim: "use these mannequins as included character sheet mannequins (create new ones that look similar) ad our garment
design" - his pictures were glossy white fibreglass display mannequins with an egg head. bitGen's own, made from the
MakeHuman base mesh and its body targets (CC0 1.0 - released as CC0 in September 2020; https://github.com/makehumancommunity/makehuman,
makehuman/data). Only the body is kept (no eyes, teeth, hair helpers); the head is smoothed into a faceless egg; the whole
body gets a light fibreglass smoothing. Writes static/mannequins/mesh/<sex>.json (for the sheets - static/mannequinGloss.js)
and <sex>.obj (for Blender and the garment designer), in metres, feet on the floor, facing +Z.

  python3 scripts/make_mannequin_mesh.py <makehuman-checkout>/makehuman/data
Development tool (needs numpy); the app only reads its output."""
import base64, collections, json, os, sys
import numpy as np

DATA = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mh/makehuman/data"
OUT = os.environ.get("MANNEQUIN_OUT") or os.path.join(os.path.dirname(__file__), "..", "static", "mannequins", "mesh")
# 2.933.0: --drape = the same body with the arms raised to GarmentCode's A-pose (its sleeves are placed for arms about 45 deg
# below the horizontal - arm_pose_angle in static/mannequins/mesh/<sex>.measure.json): <sex>_drape.obj, what 👗 drapes on
DRAPE = "--drape" in sys.argv
if DRAPE: sys.argv.remove("--drape")
RACES = ["african", "asian", "caucasian"]

BODIES = {
    # an athletic male display mannequin (Tim's first two pictures): young, very muscular, average weight, tall, ideal proportions
    "male": [("macrodetails/{r}-male-young.target", 1 / 3, True),
             ("macrodetails/universal-male-young-averagemuscle-averageweight.target", 0.25, False),
             ("macrodetails/universal-male-young-maxmuscle-averageweight.target", 0.75, False),
             ("macrodetails/height/male-young-maxmuscle-averageweight-maxheight.target", 0.12, False),
             ("macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions.target", 1.0, False)],
    # a slim female display mannequin (his fourth / fifth): young, average muscle, slim, tall, ideal proportions
    "female": [("macrodetails/{r}-female-young.target", 1 / 3, True),
               ("macrodetails/universal-female-young-averagemuscle-averageweight.target", 0.35, False),
               ("macrodetails/universal-female-young-averagemuscle-minweight.target", 0.65, False),
               ("macrodetails/height/female-young-averagemuscle-minweight-maxheight.target", 0.15, False),
               ("macrodetails/proportions/female-young-averagemuscle-minweight-idealproportions.target", 1.0, False)],
}


def read_obj(p):
    V, groups, G = [], collections.defaultdict(list), None
    for l in open(p):
        if l.startswith("v "): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("g "): G = l.split()[1]
        elif l.startswith("f "): groups[G].append([int(t.split("/")[0]) - 1 for t in l.split()[1:]])
    return np.array(V), groups


def target(rel):
    p = os.path.join(DATA, "targets", rel)
    if not os.path.exists(p): return None
    idx, d = [], []
    for l in open(p):
        if not l.strip() or l[0] == "#": continue
        s = l.split(); idx.append(int(s[0])); d.append([float(x) for x in s[1:4]])
    return (np.array(idx, dtype=np.int64), np.array(d, dtype=float).reshape(-1, 3)) if idx else None


def neighbours(n, faces):
    nb = [set() for _ in range(n)]
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]): nb[a].add(b); nb[b].add(a)
    return [np.array(sorted(s)) for s in nb]


def taubin(V, nb, w, it, lam=0.5, mu=-0.53):
    """smoothing that does not shrink: w (0..1 per vertex) = how much each vertex takes part"""
    V = V.copy()
    for k in range(it):
        avg = np.array([V[s].mean(0) if len(s) else V[i] for i, s in enumerate(nb)])
        V += (lam if k % 2 == 0 else mu) * w[:, None] * (avg - V)
    return V


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


ARM = ["upperarm01", "upperarm02", "lowerarm01", "lowerarm02", "wrist", "metacarpal1", "metacarpal2", "metacarpal3", "metacarpal4"] \
    + ["finger%d-%d" % (a, b) for a in range(1, 6) for b in range(1, 4)]
_RIG = {}
HANDS = {}


def rig():
    if not _RIG:
        _RIG["w"] = json.load(open(os.path.join(DATA, "rigs", "default_weights.mhw")))["weights"]
        _RIG["k"] = json.load(open(os.path.join(DATA, "rigs", "default.mhskel")))["joints"]
    return _RIG["w"], _RIG["k"]


def rot(a, b):
    """the rotation turning direction a onto direction b"""
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b)); s = np.linalg.norm(v)
    if s < 1e-9: return np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K * ((1 - c) / (s * s))


def pose_arms(B, used, Vfull, out_deg=9):
    W, K = rig()
    full = {o: n for n, o in enumerate(used)}
    for side, sx in (("L", 1), ("R", -1)):
        w = np.zeros(len(B))
        for bone in ARM:
            for vi, wt in W.get(bone + "." + side, []):
                if vi in full: w[full[vi]] += wt
        w = np.clip(w, 0, 1)
        sh = Vfull[K["upperarm01.%s____head" % side]].mean(0)          # the rig's joints are MakeHuman's helper cubes
        wr = Vfull[K["wrist.%s____head" % side]].mean(0)
        down = np.array([sx * np.sin(np.radians(out_deg)), -np.cos(np.radians(out_deg)), -0.03])
        R = rot(wr - sh, down)
        moved = (B - sh) @ R.T + sh
        B = B + w[:, None] * (moved - B)
        hw = np.zeros(len(B))                                          # where the hand is now (the sheet's close-ups)
        for bone in [b for b in ARM if b.startswith(("wrist", "metacarpal", "finger"))]:
            for vi, wt in W.get(bone + "." + side, []):
                if vi in full: hw[full[vi]] += wt
        HANDS[side] = B[hw > 0.6].mean(0)
    return B


def eyeballs(V, groups, used):
    """MakeHuman's eye helper spheres (they fill the body's eye openings) as extra triangles"""
    out_v, out_t = [], []
    for g in ("helper-l-eye", "helper-r-eye"):
        fs = groups.get(g, [])
        ids = sorted({i for f in fs for i in f}); m = {o: n + sum(len(v) for v in out_v) for n, o in enumerate(ids)}
        out_v.append(V[ids])
        for f in fs:
            q = [m[i] for i in f]
            out_t += [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] if len(q) == 4 else [q[:3]]
    return (np.concatenate(out_v) if out_v else np.zeros((0, 3))), np.array(out_t, dtype=np.int64).reshape(-1, 3)


def build(sex):
    drape_deg = None
    if DRAPE:
        m = json.load(open(os.path.join(OUT, sex + ".measure.json")))
        drape_deg = 90.0 - float(m["body"]["arm_pose_angle"])
    V, groups = read_obj(os.path.join(DATA, "3dobjs", "base.obj"))
    joint = lambda g: V[sorted({i for f in groups[g] for i in f})].mean(0)
    for rel, wt, per_race in BODIES[sex]:
        for r in (RACES if per_race else [None]):
            t = target(rel.format(r=r) if r else rel)
            if t is None: print("  (no " + rel + ")"); continue
            V[t[0]] += wt * t[1]
    J = {g: V[sorted({i for f in groups[g] for i in f})].mean(0) for g in groups if g.startswith("joint-")}
    faces = groups["body"]
    used = sorted({i for f in faces for i in f}); remap = {o: n for n, o in enumerate(used)}
    B = V[used]; F = [[remap[i] for i in f] for f in faces]
    nb = neighbours(len(B), F)
    # the arms down by the sides (a display mannequin's stance - MakeHuman stands in an A pose, arms forward): the whole arm
    # turned about the shoulder, each vertex as much as MakeHuman's own rig weights put it on the arm (CC0, default_weights.mhw)
    B = pose_arms(B, used, V) if drape_deg is None else pose_arms(B, used, V, out_deg=drape_deg)
    # MakeHuman's own head kept (a human skull, jaw and neck), the face softened like a sculpted mannequin's; the eyes
    # closed over with its eyeball helpers (the body has eye openings). The faceless gloss is your image model's job
    # (✨ Make lifelike on your PC) - this is the shape it follows and the body the garments drape on.
    eye = smoothstep(J["joint-jaw"][1] - 0.1, J["joint-jaw"][1] + 0.25, B[:, 1]) * (B[:, 2] > J["joint-l-eye"][2] - 0.6)
    B = taubin(B, nb, eye * 0.8, 24)
    HV, HT = eyeballs(V, groups, used)
    # the nipples, the navel and the fine skin detail softened everywhere (fibreglass)
    B = taubin(B, nb, np.full(len(B), 0.55), 8)
    tris = []
    for f in F:
        tris += [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] if len(f) == 4 else [f[:3]]
    tris = np.concatenate([np.array(tris), HT + len(B)]).astype(np.uint32)
    F = F + [list(t) for t in (HT + len(B))]
    B = np.concatenate([B, HV])
    # metres, feet on the floor, centred
    B = B - np.array([0, B[:, 1].min(), 0]); B[:, 0] -= (B[:, 0].max() + B[:, 0].min()) / 2
    B = B * 0.1
    floor = V[used][:, 1].min()
    marks = {k.replace("joint-", ""): ((v - np.array([0, floor, 0])) * 0.1).round(4).tolist() for k, v in J.items()}
    xs = (B[:, 0].max() + B[:, 0].min()) / 2 if False else 0
    for side, key in (("L", "l-hand"), ("R", "r-hand")):
        if side in HANDS: marks[key] = ((HANDS[side] - np.array([0, floor, 0])) * 0.1).round(4).tolist()
    os.makedirs(OUT, exist_ok=True)
    pos = B.astype(np.float32)
    if drape_deg is not None:                                          # 2.933.0: only the OBJ for the drape
        with open(os.path.join(OUT, sex + "_drape.obj"), "w") as o:
            o.write("# bitGen Studio display mannequin (%s) for draping garments - arms %.1f deg out (GarmentCode's A-pose). Metres, +Y up, facing +Z. MakeHuman base mesh + targets (CC0 1.0).\n" % (sex, drape_deg))
            for p in pos: o.write("v %.5f %.5f %.5f\n" % tuple(p))
            for t in tris: o.write("f %d %d %d\n" % (t[0] + 1, t[1] + 1, t[2] + 1))
        print(sex, "drape body: arms %.1f deg out" % drape_deg, len(pos), "verts")
        return
    json.dump({"sex": sex, "height_m": round(float(pos[:, 1].max()), 3), "verts": len(pos), "tris": len(tris),
               "pos": base64.b64encode(pos.tobytes()).decode(), "idx": base64.b64encode(tris.tobytes()).decode(),
               "joints": {k: marks[k] for k in marks if not k.startswith("l-finger") and not k.startswith("r-finger") and "eye" not in k},
               "credit": "bitGen Studio's display mannequin, made from the MakeHuman base mesh and targets (CC0 1.0)"},
              open(os.path.join(OUT, sex + ".json"), "w"), separators=(",", ":"))
    with open(os.path.join(OUT, sex + ".obj"), "w") as o:
        o.write("# bitGen Studio display mannequin (%s) - metres, +Y up, facing +Z. Made from the MakeHuman base mesh + targets (CC0 1.0).\n" % sex)
        for p in pos: o.write("v %.5f %.5f %.5f\n" % tuple(p))
        for f in F: o.write("f " + " ".join(str(i + 1) for i in f) + "\n")
    print(sex, "height %.3f m" % pos[:, 1].max(), len(pos), "verts", len(tris), "triangles")


if __name__ == "__main__":
    for s in sys.argv[2:] or ["male", "female"]: build(s)
