#!/usr/bin/env python3
"""bitGen Studio — scripts/mannequin_measure.py (2.932.0): the display mannequins' body measurements for 👗 the Garment designer.

A dev tool (numpy only), run once when the mannequin meshes change:
  python3 scripts/mannequin_measure.py <GarmentCode dir>
reads static/mannequins/mesh/<sex>.json (2.928.0 - MakeHuman CC0, metres, y up) and writes
static/mannequins/mesh/<sex>.measure.json = {sex, height_cm, measured {...}, body {...the 26 GarmentCode measurements},
reference, note}.

MEASURED ON OUR MESH, like a tape measure (the convex outline of a horizontal cut, cm): height, bust, underbust, waist,
hips, leg_circ (upper thigh), wrist. The rest start from GarmentCode's own average body for that
sex (assets/bodies/mean_female.yaml / mean_male.yaml - GarmentCode's MIT repository, their own body model, not SMPL) and
are scaled: lengths by our height, the back widths / point distances by the circumference they belong to; the angles are
kept. Nothing of GarmentCode's is shipped but these derived numbers.
"""
import base64
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MESH = os.path.join(HERE, "..", "static", "mannequins", "mesh")

LENGTHS = ["arm_length", "armscye_depth", "bust_line", "crotch_hip_diff", "head_l", "hips_line", "neck_w", "shoulder_w",
           "vert_bust_line", "waist_line", "waist_over_bust_line"]
BY = {"back_width": "bust", "bust_points": "bust", "waist_back_width": "waist", "hip_back_width": "hips", "bum_points": "hips"}
ANGLES = ["arm_pose_angle", "hip_inclination", "shoulder_incl"]


def load(sex):
    d = json.load(open(os.path.join(MESH, sex + ".json")))
    V = np.frombuffer(base64.b64decode(d["pos"]), dtype=np.float32).reshape(-1, 3).astype(float)
    T = np.frombuffer(base64.b64decode(d["idx"]), dtype=np.uint32).reshape(-1, 3)
    return d, V, T


def cut(V, T, y):
    """the loops where the plane at height y cuts the mesh -> [np.array([[x, z] ...])]"""
    ys = V[:, 1]
    above = ys[T] > y
    n = above.sum(1)
    hit = T[(n == 1) | (n == 2)]
    point, links = {}, {}
    for tri in hit:
        ks = []
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            if (ys[a] > y) != (ys[b] > y):
                k = (min(a, b), max(a, b))
                if k not in point:
                    t = (y - ys[a]) / (ys[b] - ys[a])
                    p = V[a] + t * (V[b] - V[a])
                    point[k] = (p[0], p[2])
                ks.append(k)
        if len(ks) == 2:
            links.setdefault(ks[0], []).append(ks[1])
            links.setdefault(ks[1], []).append(ks[0])
    seen, loops = set(), []
    for k0 in links:
        if k0 in seen:
            continue
        loop, k, prev = [], k0, None
        while k is not None and k not in seen:
            seen.add(k)
            loop.append(point[k])
            nxt = [q for q in links[k] if q != prev and q not in seen]
            prev, k = k, (nxt[0] if nxt else None)
        if len(loop) >= 6:
            loops.append(np.array(loop))
    return loops


def hull_len(P):
    """the tape measure: the perimeter of the convex outline (monotone chain)"""
    pts = sorted(set(map(tuple, np.round(P, 6))))
    if len(pts) < 3:
        return 0.0
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    h = lo[:-1] + up[:-1]
    return sum(math.dist(h[i], h[(i + 1) % len(h)]) for i in range(len(h)))


def torso(loops):
    """the loop round the body's middle (x = 0 inside it, the widest such loop)"""
    c = [L for L in loops if L[:, 0].min() < 0 < L[:, 0].max()]
    return max(c, key=lambda L: L[:, 0].max() - L[:, 0].min()) if c else None


def scan(V, T, lo, hi, step=0.005):
    out = []
    y = lo
    while y <= hi:
        L = torso(cut(V, T, y))
        if L is not None:
            out.append((y, hull_len(L), L[:, 0].max() - L[:, 0].min()))
        y += step
    return out


def measure(sex, ref):
    d, V, T = load(sex)
    J = d["joints"]
    y0, y1 = V[:, 1].min(), V[:, 1].max()
    height = y1 - y0
    sh, pel, hand = J["l-shoulder"][1], J["pelvis"][1], J["l-hand"]
    # the crotch: going down from the pelvis, the first cut where the legs are two loops either side of x = 0
    crotch = None
    y = pel
    while y > pel - 0.3:
        loops = cut(V, T, y)
        sides = [L for L in loops if abs(L[:, 0].mean()) > 0.03 and abs(L[:, 0].mean()) < 0.2 and L[:, 0].min() * L[:, 0].max() > 0]
        if any(L[:, 0].mean() > 0 for L in sides) and any(L[:, 0].mean() < 0 for L in sides) and torso(loops) is None:
            crotch = y
            break
        y -= 0.004
    if crotch is None:
        raise SystemExit(f"{sex}: no crotch found below the pelvis")
    # chest / bust: the fullest cut between the armpits and the bust line, arms kept out (their own loops)
    up = scan(V, T, sh - 0.24, sh - 0.07)
    bust_y, bust, _ = max(up, key=lambda r: r[1])
    under = [r for r in scan(V, T, bust_y - 0.11, bust_y - 0.07)]
    underbust = min(r[1] for r in under)
    mid = scan(V, T, pel + 0.04, bust_y - 0.12)
    waist_y, waist, _ = min(mid, key=lambda r: r[1])
    low = scan(V, T, crotch + 0.015, pel + 0.03)
    hips_y, hips, _ = max(low, key=lambda r: r[1])
    leg = [L for L in cut(V, T, crotch - 0.025) if L[:, 0].min() > 0 and L[:, 0].max() < 0.24]   # the left thigh, not a hand
    leg_circ = max(hull_len(L) for L in leg) if leg else None
    wr = []
    for k in range(3, 13):
        yy = hand[1] + k * 0.01
        arm = [L for L in cut(V, T, yy) if abs(L[:, 0].mean() - hand[0]) < 0.07 and L[:, 0].min() > 0.05]
        if arm:
            wr.append(hull_len(min(arm, key=lambda L: abs(L[:, 0].mean() - hand[0]))))
    wrist = min(wr) if wr else None
    cm = lambda v: round(float(v) * 100, 2)
    measured = {"height": cm(height), "bust": cm(bust), "underbust": cm(underbust), "waist": cm(waist), "hips": cm(hips)}
    if leg_circ:
        measured["leg_circ"] = cm(leg_circ)
    if wrist:
        measured["wrist"] = cm(wrist)
    body = scale(ref, measured)
    levels = {"bust_y": round(bust_y, 3), "waist_y": round(waist_y, 3), "hips_y": round(hips_y, 3), "crotch_y": round(crotch, 3)}
    return {"sex": sex, "height_cm": measured["height"], "measured": measured, "body": body, "levels_m": levels}


def scale(ref, measured):
    """the reference body moved onto these measurements (lengths by height, back widths by their circumference)"""
    out = dict(ref)
    for k, v in measured.items():
        out[k] = v
    h = measured["height"] / ref["height"]
    for k in LENGTHS:
        if k in ref:
            out[k] = ref[k] * h
    for k, by in BY.items():
        if k in ref and by in measured:
            out[k] = ref[k] * measured[by] / ref[by]
    for k in ANGLES:
        if k in ref:
            out[k] = ref[k]
    return {k: round(float(v), 3) for k, v in sorted(out.items())}


def main():
    import yaml
    if len(sys.argv) < 2:
        raise SystemExit("usage: mannequin_measure.py <GarmentCode dir>")
    gc = sys.argv[1]
    for sex in ("female", "male"):
        ref = yaml.safe_load(open(os.path.join(gc, "assets", "bodies", f"mean_{sex}.yaml")))["body"]
        r = measure(sex, ref)
        r["reference"] = f"GarmentCode (MIT) assets/bodies/mean_{sex}.yaml, scaled"
        r["note"] = ("measured on bitGen Studio's display mannequin (MakeHuman CC0): " + ", ".join(sorted(r["measured"]))
                     + "; the rest from GarmentCode's average body, scaled")
        with open(os.path.join(MESH, sex + ".measure.json"), "w") as f:
            json.dump(r, f, indent=1)
        print(sex, json.dumps(r["measured"]), r["levels_m"])


if __name__ == "__main__":
    main()
