#!/usr/bin/env python3
"""bitGen Studio — cad_worker.py (2.581.0): ✨ GENERATE FOR THE 📐 SOLIDCRAFT DOCKER - CadQuery code -> a part, and the
part as SolidCraft's own editable features.

Tim: "are there any models that we can use to generate sketches and models for solidcraft?" -> "yes, please build your
suggestion" (cadrille first - text or a picture -> CadQuery code - with the local LLM as the fallback).

Runs in its own venv (<install>/cadgen/.venv - Settings ▸ Add-ons ▸ CAD generate), started by lib/cadGen.js:

  python cad_worker.py run      --code <file.py> --out <dir> [--name <stem>]
      the code is checked (only cadquery / math / numpy, no files, no dunders - check_code), run with CadQuery, and while it
      runs every modelling step is RECORDED (Recorder: extrude / cut / box / cylinder / sphere / hole / union / cut /
      intersect / fillet / chamfer). Writes <dir>/<stem>.step + <stem>.obj and prints one line
      CADRESULT {"ok", "volume", "bbox", "editable", "reason", "commands": [...], "step", "obj", "features"}
      commands = SolidCraft command-API calls ({id, params, key?}) that rebuild the part as sketches + extrudes +
      fillets the user can edit; "$curves": [keys] in a param = the curve ids those earlier commands created.
      editable false (+ reason) = a step the replay does not know (revolve, loft, shell …): the docker inserts the STEP.
  python cad_worker.py cadrille --text "<description>" | --image <png> --out <dir> [--model <dir|repo>]
      cadrille (github.com/col14m/cadrille - its code Apache-2.0; its weights maksimko123/cadrille CC BY-NC 4.0,
      downloaded by the add-on, never shipped) writes the CadQuery code, then it is run as above. Prints CADCODE first.
      With --text and --image both, the picture is used (cadrille takes one or the other).
  python cad_worker.py check    -> CADRESULT {"ok", "cadquery": version, "cadrille": bool, "torch": version | ""}

Pure parts for the tests (scripts/test-cadgen581.py, without CadQuery): check_code, extract_code, fmt, Plan.
"""
import ast
import json
import math
import os
import sys
import traceback

ALLOWED_IMPORTS = {"cadquery", "math", "numpy"}
SAFE_BUILTINS = ("abs", "all", "any", "bool", "dict", "enumerate", "float", "int", "len", "list", "map", "max", "min", "pow",
                 "print", "range", "reversed", "round", "set", "sorted", "sum", "tuple", "zip", "isinstance", "ValueError",
                 "Exception", "ZeroDivisionError", "filter", "divmod", "str")
BANNED_NAMES = {"open", "exec", "eval", "compile", "__import__", "input", "globals", "locals", "vars", "breakpoint",
                "exit", "quit", "help", "memoryview", "getattr", "setattr", "delattr"}


# ----------------------------------------------------------------------------------------------- pure helpers
def extract_code(text):
    """an LLM / model answer -> the Python in it (a ``` block, else the text from `import cadquery`) (pure)"""
    t = str(text or "")
    import re
    blocks = re.findall(r"```(?:python|py)?\s*\n(.*?)```", t, re.S)
    if blocks:
        withcq = [b for b in blocks if "cadquery" in b or "Workplane" in b]
        return (withcq or blocks)[-1].strip() + "\n"
    i = t.find("import cadquery")
    return (t[i:] if i >= 0 else t).strip() + "\n"


def check_code(src):
    """None when the code only builds geometry, else why not (pure): imports cadquery / math / numpy only, none of the
    builtins that reach files or other code, no __dunder__ attributes"""
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return "syntax error on line %s: %s" % (e.lineno, e.msg)
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for a in n.names:
                if a.name.split(".")[0] not in ALLOWED_IMPORTS:
                    return "import %s is not allowed (cadquery, math, numpy only)" % a.name
        elif isinstance(n, ast.ImportFrom):
            if (n.module or "").split(".")[0] not in ALLOWED_IMPORTS:
                return "from %s import is not allowed (cadquery, math, numpy only)" % n.module
        elif isinstance(n, ast.Name) and n.id in BANNED_NAMES:
            return "%s() is not allowed in a part's code" % n.id
        elif isinstance(n, ast.Attribute) and n.attr.startswith("__"):
            return "%s is not allowed in a part's code" % n.attr
        elif isinstance(n, (ast.Global, ast.Nonlocal)):
            return "global / nonlocal are not allowed"
    return None


def fmt(v):
    """a number for a command: 6 decimals, no -0 (pure)"""
    x = round(float(v), 6)
    return 0.0 if x == 0 else x


def _sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def _dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def _cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def _norm(a):
    l = math.sqrt(_dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


class Frame:
    """a sketch plane: origin + x / y / z (unit, right-handed) (pure)"""
    def __init__(self, origin, x, z):
        self.o = tuple(float(c) for c in origin)
        self.z = _norm(z)
        xx = _sub(x, tuple(self.z[i] * _dot(x, self.z) for i in range(3)))
        self.x = _norm(xx)
        self.y = _cross(self.z, self.x)

    def local(self, p):
        d = _sub(p, self.o)
        return (_dot(d, self.x), _dot(d, self.y), _dot(d, self.z))

    def shifted(self, dz):
        return Frame(tuple(self.o[i] + self.z[i] * dz for i in range(3)), self.x, self.z)

    def plane(self):
        return {"origin": [fmt(c) for c in self.o], "x_dir": [fmt(c) for c in self.x], "y_dir": [fmt(c) for c in self.y]}


class Plan:
    """the SolidCraft commands that rebuild the part (pure - fed loops of curves in plane coordinates)"""
    def __init__(self):
        self.commands, self.n_sketch, self.n_feat, self.reasons = [], 0, 0, []

    def _key(self):
        self._k = getattr(self, "_k", 0) + 1
        return "k%d" % self._k

    def extrude(self, frame, loops, distance=None, direction="positive", op="new", through_all=False):
        """loops: [{"outer": bool, "curves": [("line", a, b) | ("arc", a, m, b) | ("circle", c, r) | ("spline", [pts])]}]"""
        self.n_sketch += 1
        sk = "AI Sketch %d" % self.n_sketch
        self.commands.append({"id": "sketch.create", "params": {"plane": frame.plane(), "name": sk}})
        outer_keys = []
        for lp in loops:
            keys = []
            for c in lp["curves"]:
                k = self._key()
                keys.append(k)
                if c[0] == "line":
                    self.commands.append({"id": "sketch.line", "key": k, "params": {"points": [[fmt(c[1][0]), fmt(c[1][1])], [fmt(c[2][0]), fmt(c[2][1])]]}})
                elif c[0] == "arc":
                    self.commands.append({"id": "sketch.arc.three_point", "key": k, "params": {
                        "start": [fmt(c[1][0]), fmt(c[1][1])], "through": [fmt(c[2][0]), fmt(c[2][1])], "end": [fmt(c[3][0]), fmt(c[3][1])]}})
                elif c[0] == "circle":
                    self.commands.append({"id": "sketch.circle.center", "key": k, "params": {"center": [fmt(c[1][0]), fmt(c[1][1])], "radius": fmt(c[2])}})
                elif c[0] == "spline":
                    self.commands.append({"id": "sketch.spline.fit_point", "key": k, "params": {"points": [[fmt(p[0]), fmt(p[1])] for p in c[1]]}})
            if lp.get("outer"):
                outer_keys.append(keys)
        self.commands.append({"id": "sketch.finish", "params": {}})
        self.n_feat += 1
        p = {"sketch": sk, "operation": op, "name": "AI %s %d" % ("Cut" if op == "cut" else "Extrude", self.n_feat),
             "profiles": [{"curves": {"$curves": ks}} for ks in outer_keys]}
        if through_all:
            p["through_all"] = True
            if direction == "symmetric":
                p["direction"] = "symmetric"
        else:
            p["distance"] = fmt(distance)
            p["direction"] = direction
        self.commands.append({"id": "solid.extrude", "params": p})

    def sphere(self, center, radius, op):
        self.n_feat += 1
        self.commands.append({"id": "solid.sphere", "params": {"radius": fmt(radius), "center": [fmt(c) for c in center], "operation": op, "name": "AI Sphere %d" % self.n_feat}})

    def edges(self, kind, points, radius, radius2=None):
        if not points:
            return
        p = {"edges": [[fmt(c) for c in pt] for pt in points]}
        if kind == "fillet":
            p["radius"] = fmt(radius)
        else:
            p["distance"] = fmt(radius)
            if radius2:
                p["distance2"] = fmt(radius2)
        self.commands.append({"id": "solid." + kind, "params": p})


# ------------------------------------------------------------------------------------- the recorder (needs CadQuery)
def _vt(v):
    return (v.x, v.y, v.z) if hasattr(v, "x") else tuple(v)


def _edge_curves(edges, frame):
    """CadQuery edges -> plane curves (raises on a kind the sketch cannot draw)"""
    out = []
    for e in edges:
        g = e.geomType()
        if g == "LINE":
            a, b = frame.local(_vt(e.startPoint())), frame.local(_vt(e.endPoint()))
            out.append(("line", a, b))
        elif g == "CIRCLE":
            if e.IsClosed():
                c = frame.local(_vt(e.arcCenter()))
                out.append(("circle", c, e.radius()))
            else:
                out.append(("arc", frame.local(_vt(e.startPoint())), frame.local(_vt(e.positionAt(0.5))), frame.local(_vt(e.endPoint()))))
        elif g in ("BSPLINE", "BEZIER", "ELLIPSE"):
            pts = [frame.local(_vt(e.positionAt(t / 12.0))) for t in range(13)]
            out.append(("spline", pts))
        else:
            raise ValueError("a %s edge in a sketch" % g.lower())
    return out


def _zs(curves):
    zs = []
    for c in curves:
        if c[0] in ("line",):
            zs += [c[1][2], c[2][2]]
        elif c[0] == "arc":
            zs += [c[1][2], c[2][2], c[3][2]]
        elif c[0] == "circle":
            zs.append(c[1][2])
        else:
            zs += [p[2] for p in c[1]]
    return zs


def faces_to_loops(faces, frame):
    """planar faces -> (frame on their plane, loops) - the outer wire of each face a profile, its inner wires holes"""
    loops = []
    for f in faces:
        if f.geomType() != "PLANE":
            raise ValueError("a %s face to extrude" % f.geomType().lower())
        loops.append({"outer": True, "curves": _edge_curves(f.outerWire().Edges(), frame)})
        for w in f.innerWires():
            loops.append({"outer": False, "curves": _edge_curves(w.Edges(), frame)})
    zs = [z for lp in loops for z in _zs(lp["curves"])]
    if not zs:
        raise ValueError("nothing to extrude")
    z0 = sum(zs) / len(zs)
    if max(abs(z - z0) for z in zs) > 1e-5:
        raise ValueError("the faces are not on one plane")
    if abs(z0) > 1e-9:            # the faces sit off the workplane: the sketch goes where they are
        frame = frame.shifted(z0)
        loops = [{"outer": lp["outer"], "curves": [_flat(c) for c in lp["curves"]]} for lp in loops]
    return frame, loops


def _flat(c):
    if c[0] == "line":
        return ("line", c[1][:2], c[2][:2])
    if c[0] == "arc":
        return ("arc", c[1][:2], c[2][:2], c[3][:2])
    if c[0] == "circle":
        return ("circle", c[1][:2], c[2])
    return ("spline", [p[:2] for p in c[1]])


def classify(solid):
    """a primitive solid (box / cylinder / sphere, any placement) -> ("prism", frame, loops, height) | ("sphere", c, r)"""
    faces = solid.Faces()
    kinds = sorted(f.geomType() for f in faces)
    if kinds == ["SPHERE"]:
        c = _vt(solid.Center())
        r = (3.0 * solid.Volume() / (4.0 * math.pi)) ** (1.0 / 3.0)
        return ("sphere", c, r)
    planes = [f for f in faces if f.geomType() == "PLANE"]
    if kinds == ["PLANE"] * 6 or kinds == ["CYLINDER", "PLANE", "PLANE"]:
        f0 = max(planes, key=lambda f: f.Area())
        n = _vt(f0.normalAt())
        z = (-n[0], -n[1], -n[2])                       # into the solid
        edges = f0.outerWire().Edges()
        e0 = edges[0]
        if e0.geomType() == "LINE":
            x = _sub(_vt(e0.endPoint()), _vt(e0.startPoint()))
        else:
            x = _cross(z, (0, 0, 1)) if abs(z[2]) < 0.9 else _cross(z, (1, 0, 0))
        frame = Frame(_vt(f0.Center()), x, z)
        loops = [{"outer": True, "curves": [_flat(c) for c in _edge_curves(edges, frame)]}]
        if kinds == ["PLANE"] * 6:            # the height: the farthest corner from the face, along z
            h = max(frame.local(v.toTuple())[2] for v in solid.Vertices())
        else:                                     # the other cap
            other = [f for f in planes if not f.isSame(f0)][0]
            h = frame.local(_vt(other.Center()))[2]
        return ("prism", frame, loops, h)
    return None


class Recorder:
    """wraps CadQuery's Workplane while the code runs: each modelling step -> a feature (Plan)"""
    EXTRUDES = {"extrude", "cutBlind", "cutThruAll"}
    PRIMS = {"box", "cylinder", "sphere"}
    BOOLS = {"union": "join", "__add__": "join", "__or__": "join", "cut": "cut", "__sub__": "cut", "intersect": "intersect", "__and__": "intersect", "__mul__": "intersect"}
    UNSUPPORTED = {"revolve", "loft", "sweep", "shell", "twistExtrude", "cboreHole", "cskHole", "mirror", "rotate", "translate",
                   "rotateAboutCenter", "split", "text", "interpPlate", "polyhedron", "wedge", "torus", "placeSketch"}

    def __init__(self, cq):
        self.cq, self.depth, self.last, self.reasons = cq, 0, {}, []
        self._orig = {}

    # --- the per-chain feature lists
    def rec_of(self, w):
        while w is not None:
            r = getattr(w, "_bgrec", None)
            if r is not None:
                return r
            w = getattr(w, "parent", None)
        return []

    def solid_of(self, w):
        try:
            return w._findType((self.cq.Solid, self.cq.Compound), True, True)
        except Exception:                               # noqa: BLE001
            return None

    def install(self):
        cq, W = self.cq, self.cq.Workplane
        rec = self
        o_faces = W._getFaces
        self._orig["_getFaces"], self._orig["eachpoint"] = W._getFaces, W.eachpoint

        def _getFaces(self_):
            fs = o_faces(self_)
            rec.last["faces"] = list(fs)
            rec.last["frame"] = self_.plane
            return fs
        W._getFaces = _getFaces
        o_each = W.eachpoint

        def eachpoint(self_, *a, **k):
            r = o_each(self_, *a, **k)
            try:
                rec.last["tools"] = [s for s in r.vals() if isinstance(s, cq.Shape)]
            except Exception:                           # noqa: BLE001
                pass
            return r
        W.eachpoint = eachpoint
        names = set(self.EXTRUDES) | set(self.PRIMS) | set(self.BOOLS) | set(self.UNSUPPORTED) | {"hole", "cutEach", "fillet", "chamfer"}
        for n in names:
            if hasattr(W, n):
                self._wrap(W, n)

    def uninstall(self):
        for n, f in self._orig.items():
            setattr(self.cq.Workplane, n, f)
        self._orig = {}

    def _wrap(self, W, name):
        orig = getattr(W, name)
        self._orig[name] = orig
        rec = self

        def w(self_, *a, **k):
            if rec.depth:
                return orig(self_, *a, **k)
            rec.depth += 1
            rec.last = {}
            pre = None
            if name in ("fillet", "chamfer"):
                try:
                    pre = [_vt(e.positionAt(0.5)) for e in self_.edges().vals()]
                except Exception:                       # noqa: BLE001
                    pre = None
            try:
                res = orig(self_, *a, **k)
            finally:
                rec.depth -= 1
            try:
                rec.record(name, self_, res, a, k, pre)
            except Exception as e:                      # noqa: BLE001
                rec.reasons.append("%s: %s" % (name, e))
                res._bgrec = rec.rec_of(self_) + [("bad", name)]
            return res
        w.__name__ = name
        setattr(W, name, w)

    def record(self, name, self_, res, a, k, pre):
        if not isinstance(res, self.cq.Workplane):
            return
        base = self.rec_of(self_)
        had = self.solid_of(self_) is not None
        if name in self.UNSUPPORTED:
            if self.solid_of(res) is not self.solid_of(self_):
                self.reasons.append(name + " is not rebuilt as SolidCraft features yet")
                res._bgrec = base + [("bad", name)]
            return
        if name in self.EXTRUDES:
            faces, plane = self.last.get("faces") or [], self.last.get("frame") or self_.plane
            frame0 = Frame(_vt(plane.origin), _vt(plane.xDir), _vt(plane.zDir))
            fr, loops = faces_to_loops(faces, frame0)
            until = a[0] if a else k.get("until", k.get("distance"))
            both = k.get("both", a[3] if name == "extrude" and len(a) > 3 else (a[2] if name == "cutBlind" and len(a) > 2 else False))
            taper = k.get("taper")
            if taper:
                raise ValueError("a tapered extrude")
            if name == "cutThruAll":
                feat = ("extrude", fr, loops, None, "symmetric", "cut", True)
            else:
                if not isinstance(until, (int, float)):
                    raise ValueError("an extrude up to a face")
                d = float(until)
                comb = k.get("combine", a[1] if name == "extrude" and len(a) > 1 else True)
                op = "cut" if name == "cutBlind" or comb in ("cut", "s") else ("new" if comb is False or not had else "join")
                if both:
                    feat = ("extrude", fr, loops, abs(d) * 2, "symmetric", op, False)
                else:
                    feat = ("extrude", fr, loops, abs(d), "positive" if d >= 0 else "negative", op, False)
            res._bgrec = base + [feat]
            return
        if name in self.PRIMS or name in ("hole", "cutEach"):
            tools = self.last.get("tools") or []
            if not tools:
                raise ValueError("no solid from " + name)
            comb = k.get("combine", True)
            if name in ("hole", "cutEach"):
                op = "cut"
            else:
                op = "cut" if comb in ("cut", "s") else ("new" if comb is False or not had else "join")
            feats = []
            for i, t in enumerate(self._solids(tools)):
                c = classify(t)
                if c is None:
                    raise ValueError("a %s that is not a plain box / cylinder / sphere" % name)
                o = op if (op != "new" or i == 0) else "join"
                if c[0] == "sphere":
                    feats.append(("sphere", c[1], c[2], o))
                else:
                    feats.append(("extrude", c[1], c[2], c[3], "positive", o, False))
            res._bgrec = base + feats
            return
        if name in self.BOOLS:
            op = self.BOOLS[name]
            other = a[0] if a else k.get("toUnion", k.get("toCut", k.get("toIntersect")))
            if isinstance(other, self.cq.Workplane):
                orec = self.rec_of(other)
            else:
                orec = []
                for i, t in enumerate(self._solids([other])):
                    c = classify(t)
                    if c is None:
                        raise ValueError("a %s with a shape that is not a plain box / cylinder / sphere" % name)
                    orec.append(("sphere", c[1], c[2], "new") if c[0] == "sphere" else ("extrude", c[1], c[2], c[3], "positive", "new", False))
            if not base:                                # nothing to combine with yet: the other part is the start
                res._bgrec = list(orec)
                return
            mapped = []
            for f in orec:
                if f[0] == "bad":
                    mapped.append(f)
                    continue
                fo = f[-1] if f[0] == "sphere" else f[5]
                if op == "join":
                    no = "join" if fo in ("new", "join") else fo
                elif op == "cut":
                    no = "cut" if fo in ("new", "join") else "join"
                else:
                    if len(orec) != 1:
                        raise ValueError("an intersect with a part of several steps")
                    no = "intersect"
                mapped.append(f[:-1] + (no,) if f[0] == "sphere" else f[:5] + (no,) + f[6:])
            res._bgrec = base + mapped
            return
        if name in ("fillet", "chamfer"):
            r1 = a[0] if a else k.get("radius", k.get("length"))
            r2 = (a[1] if len(a) > 1 else k.get("length2")) if name == "chamfer" else None
            if not pre:
                raise ValueError("no edges picked")
            res._bgrec = base + [(name, pre, r1, r2)]
            return

    def _solids(self, shapes):
        out = []
        for s in shapes:
            if isinstance(s, self.cq.Compound):
                out += list(s.Solids())
            elif isinstance(s, self.cq.Solid):
                out.append(s)
            elif hasattr(s, "Solids"):
                out += list(s.Solids())
        return out


def plan_from(rec_list):
    """the recorded features -> (Plan, reasons)"""
    plan, reasons = Plan(), []
    first = True
    for f in rec_list:
        if f[0] == "bad":
            reasons.append(f[1])
            continue
        if f[0] == "extrude":
            _, fr, loops, d, direction, op, thru = f
            if first and op in ("join", "cut", "intersect"):
                op = "new" if op == "join" else op
            plan.extrude(fr, loops, d, direction, op, thru)
        elif f[0] == "sphere":
            op = f[3]
            if first and op == "join":
                op = "new"
            plan.sphere(f[1], f[2], op)
        elif f[0] in ("fillet", "chamfer"):
            plan.edges(f[0], f[1], f[2], f[3])
        first = False
    return plan, reasons


# ----------------------------------------------------------------------------------------------------- running
def write_obj(shape, path, tol=0.1):
    verts, tris = shape.tessellate(tol, 0.3)
    with open(path, "w", encoding="utf-8") as f:
        f.write("# bitGen Studio cad_worker\no part\n")
        for v in verts:
            f.write("v %.6f %.6f %.6f\n" % (v.x, v.y, v.z))
        for t in tris:
            f.write("f %d %d %d\n" % (t[0] + 1, t[1] + 1, t[2] + 1))


def run_code(src, out_dir, stem="part"):
    why = check_code(src)
    if why:
        return {"ok": False, "error": why, "stage": "check"}
    import cadquery as cq
    rec = Recorder(cq)
    rec.install()
    shown = []
    import builtins as _b
    safe_builtins = {n: getattr(_b, n) for n in SAFE_BUILTINS if hasattr(_b, n)}

    def _imp(name, *a, **k):
        if name.split(".")[0] not in ALLOWED_IMPORTS:
            raise ImportError("import %s is not allowed" % name)
        return _b.__import__(name, *a, **k)
    safe_builtins["__import__"] = _imp
    env = {"__builtins__": safe_builtins, "__name__": "__part__", "show_object": lambda o, *a, **k: shown.append(o)}
    try:
        exec(compile(src, "<part>", "exec"), env)            # noqa: S102 - the code passed check_code
    except Exception as e:                                    # noqa: BLE001
        tb = traceback.format_exc().splitlines()
        lines = [l for l in tb if "<part>" in l]
        return {"ok": False, "error": "%s: %s" % (type(e).__name__, e), "where": lines[-1].strip() if lines else "", "stage": "run"}
    finally:
        rec.uninstall()
    cands = shown + [env[n] for n in ("result", "r", "part", "model", "res") if n in env] + [v for v in env.values() if isinstance(v, cq.Workplane)][::-1]
    wp = next((c for c in cands if isinstance(c, (cq.Workplane, cq.Shape))), None)
    if wp is None:
        return {"ok": False, "error": "the code made no part - put the result in a variable named result", "stage": "result"}
    shape = wp
    if isinstance(wp, cq.Workplane):
        try:
            shape = wp.findSolid()
        except Exception:                                     # noqa: BLE001
            shape = wp.val() if wp.vals() else None
    if shape is None or not hasattr(shape, "Volume") or shape.Volume() <= 1e-9:
        return {"ok": False, "error": "the code made no solid (nothing with a volume)", "stage": "result"}
    os.makedirs(out_dir, exist_ok=True)
    step, obj = os.path.join(out_dir, stem + ".step"), os.path.join(out_dir, stem + ".obj")
    cq.exporters.export(cq.Workplane().add(shape), step, exportType="STEP")
    write_obj(shape, obj)
    bb = shape.BoundingBox()
    plan, reasons = plan_from(rec.rec_of(wp) if isinstance(wp, cq.Workplane) else [])
    reasons = rec.reasons + [x for x in reasons if not any(x in y for y in rec.reasons)]
    editable = bool(plan.commands) and not reasons
    return {"ok": True, "volume": shape.Volume(), "bbox": {"min": [bb.xmin, bb.ymin, bb.zmin], "max": [bb.xmax, bb.ymax, bb.zmax]},
            "editable": editable, "reason": "; ".join(dict.fromkeys(reasons)) if reasons else ("" if plan.commands else "no steps recorded"),
            "commands": plan.commands if editable else [], "features": plan.n_feat, "step": os.path.basename(step), "obj": os.path.basename(obj)}


# ---------------------------------------------------------------------------------------------------- cadrille
CADRILLE_REPO = "maksimko123/cadrille"
PROCESSOR_REPO = "Qwen/Qwen2-VL-2B-Instruct"


def cadrille_code(text=None, image=None, model=None, max_new_tokens=768):
    """cadrille (github.com/col14m/cadrille, test.py / cadrille.py / dataset.py): a description or a picture -> CadQuery
    code, the way its own test does it:
      - the processor is Qwen/Qwen2-VL-2B-Instruct with min_pixels 256*28*28, max_pixels 1280*28*28, padding left;
      - TEXT (Text2CAD): one user turn whose content is the description;
      - A PICTURE: one user turn [{"type": "video", "video": [the picture], "fps": 1.0}, {"type": "text", "text":
        "Generate cadquery code"}] - its training pictures are 4 renders of the part (a 2 x 2 grid, 128 px views, a 3 px
        black border each, the part pale yellow) - so a clean render / drawing of the part works far better than a photo;
      - the chat template with add_generation_prompt, max_new_tokens 768 (the model's own generation config otherwise).
    cadrille's class (a Qwen2VLForConditionalGeneration with a point-cloud encoder) is not needed for text / pictures: the
    weights load into Qwen2VLForConditionalGeneration (the point encoder's are left out)."""
    import torch
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
    src = model or os.environ.get("CADRILLE_MODEL") or CADRILLE_REPO
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if dev == "cuda" else torch.float32
    m = Qwen2VLForConditionalGeneration.from_pretrained(src, torch_dtype=dtype, attn_implementation="sdpa").to(dev).eval()
    proc = AutoProcessor.from_pretrained(os.environ.get("CADRILLE_PROCESSOR") or PROCESSOR_REPO,
                                         min_pixels=256 * 28 * 28, max_pixels=1280 * 28 * 28, padding_side="left")
    if image:
        from PIL import Image, ImageOps
        im = Image.open(image).convert("RGB")
        im.thumbnail((262, 262))                     # about the 2 x 2 grid of 128 px views it was trained on
        im = ImageOps.expand(im, border=3, fill="black")
        content = [{"type": "video", "video": [im], "fps": 1.0}, {"type": "text", "text": "Generate cadquery code"}]
    else:
        content = str(text or "")
    msgs = [{"role": "user", "content": content}]
    prompt = proc.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    kw = {}
    if image:
        from qwen_vl_utils import process_vision_info
        imgs, vids = process_vision_info(msgs)
        kw = {"images": imgs, "videos": vids}
    inputs = proc(text=[prompt], padding=True, return_tensors="pt", **kw).to(dev)
    with torch.no_grad():
        out = m.generate(**inputs, max_new_tokens=max_new_tokens)
    gen = out[0][inputs["input_ids"].shape[1]:]
    return proc.decode(gen, skip_special_tokens=True, clean_up_tokenization_spaces=False)


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    cmd, args = argv[0], argv[1:]
    opt = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--"):
            opt[args[i][2:]] = args[i + 1] if i + 1 < len(args) else ""
            i += 2
        else:
            i += 1
    if cmd == "check":
        r = {"ok": True, "cadquery": "", "torch": "", "transformers": ""}
        try:
            import cadquery as cq
            r["cadquery"] = getattr(cq, "__version__", "?")
        except Exception as e:                                # noqa: BLE001
            r.update(ok=False, error="CadQuery: %s" % e)
        for n in ("torch", "transformers"):
            try:
                r[n] = __import__(n).__version__
            except Exception:                                 # noqa: BLE001
                r[n] = ""
        print("CADRESULT " + json.dumps(r))
        return 0
    if cmd == "run":
        src = open(opt["code"], encoding="utf-8").read()
        r = run_code(src, opt.get("out") or ".", opt.get("name") or "part")
        print("CADRESULT " + json.dumps(r))
        return 0
    if cmd == "cadrille":
        try:
            txt = cadrille_code(opt.get("text"), opt.get("image"), opt.get("model"))
        except Exception as e:                                # noqa: BLE001
            print("CADRESULT " + json.dumps({"ok": False, "error": "cadrille: %s: %s" % (type(e).__name__, e), "stage": "model"}))
            return 0
        code = extract_code(txt)
        print("CADCODE " + json.dumps(code))
        r = run_code(code, opt.get("out") or ".", opt.get("name") or "part")
        r["code"] = code
        print("CADRESULT " + json.dumps(r))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
