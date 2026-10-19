#!/usr/bin/env python3
"""bitGen Studio — 📷 3D CAMERA TRACKER (2.515.0): solve the camera that filmed a shot, and the scene's points.

Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "3D camera tracker (solve the camera,
place layers in the scene)".

    python scripts/camtrack.py job.json
job = {input, from, to (source s), fov (the lens's across angle in degrees; 0 = worked out), mode: auto | free | tripod,
       width (the work size, px - default 960), features (how many points are followed at once, default 1200),
       ignore: {file (a cut-out .webm - scripts/roto.py), t0 (its first frame's source s)} | null (what moves on its own -
       a person, a car - is not used for the solve)}
    1  TRACK   corners followed frame by frame (pyramid Lucas-Kanade, checked forwards and back), new ones found as
               others leave
    2  SOLVE   free: the pair of frames with enough parallax -> the essential matrix -> the first 3D points; each frame's
               camera from the points it sees (PnP, RANSAC), new points triangulated as the camera moves; then a bundle
               adjustment (scipy - the cameras, the points and the lens together, a robust loss). The lens: tried at a
               few angles, the one that fits best refined by the adjustment.
               tripod (or auto when the shot has no parallax): the camera only turns (pan / tilt / roll) - the rotation
               from the homographies; the points on a sphere round it
    3  OUT     in the first solved frame's camera: R = I, the centre at 0, the points' middle depth = 1 (the page puts it
               into its 3D space - tl3d.js; x right, y down, z away)
stdout: JSON lines {"p", "stage"}; the end {"ok", "mode", "fps", "W", "H", "f", "fov", "err" (median px), "solved",
        "frames": [{"t", "R": [9], "C": [3]} | null], "points": [[x, y, z, seen]]}
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene_io as sio  # noqa: E402

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None
try:
    from scipy.optimize import least_squares
    from scipy.sparse import lil_matrix
except Exception:  # noqa: BLE001
    least_squares = None


# ---------------------------------------------------------------- 1 track
def track(src, a, b, W, H, nfeat, ignore, fps):
    """-> obs: {track id: {frame: (x, y)}}, n frames"""
    lk = dict(winSize=(21, 21), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    mind = max(6, int(min(W, H) / 70))
    obs, alive = {}, {}                      # alive: id -> (x, y)
    nid = 0
    prev = None
    ign = None
    if ignore and ignore.get("file") and os.path.exists(ignore["file"]):
        t0 = float(ignore.get("t0") or 0)
        ign = sio.frames(ignore["file"], max(0.0, a - t0), max(0.01, b - t0), W, H, "rgba", alpha_codec="libvpx-vp9")
    n = 0
    total = max(1, int((b - a) * fps))
    for i, g in sio.frames(src, a, b, W, H, "gray"):
        n = i + 1
        bad = None
        if ign is not None:
            try:
                _, f = next(ign)
                bad = cv2.dilate((f[..., 3] > 40).astype(np.uint8), np.ones((9, 9), np.uint8))
            except StopIteration:
                ign = None
        if prev is not None and alive:
            ids = list(alive.keys())
            p0 = np.float32([alive[k] for k in ids]).reshape(-1, 1, 2)
            p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, **lk)
            pb, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, **lk)
            fb = np.linalg.norm((p0 - pb).reshape(-1, 2), axis=1)
            ok = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < 0.8)
            alive = {}
            for k, good, q in zip(ids, ok, p1.reshape(-1, 2)):
                x, y = float(q[0]), float(q[1])
                if not good or x < 2 or y < 2 or x > W - 3 or y > H - 3:
                    continue
                if bad is not None and bad[int(y), int(x)]:
                    continue
                alive[k] = (x, y)
                obs[k][i] = (x, y)
        if len(alive) < 0.7 * nfeat:
            m = np.full((H, W), 255, np.uint8)
            for (x, y) in alive.values():
                cv2.circle(m, (int(x), int(y)), mind, 0, -1)
            if bad is not None:
                m[bad > 0] = 0
            new = cv2.goodFeaturesToTrack(g, maxCorners=int(nfeat - len(alive)), qualityLevel=0.01, minDistance=mind, mask=m, blockSize=7)
            if new is not None:
                for q in new.reshape(-1, 2):
                    alive[nid] = (float(q[0]), float(q[1]))
                    obs[nid] = {i: (float(q[0]), float(q[1]))}
                    nid += 1
        prev = g
        if i % 6 == 0:
            sio.say(p=round(0.02 + 0.33 * i / total, 3), stage="track")
    obs = {k: v for k, v in obs.items() if len(v) >= 3}
    return obs, n


# ---------------------------------------------------------------- 2 solve (free)
def Kof(f, W, H):
    return np.array([[f, 0, W / 2.0], [0, f, H / 2.0], [0, 0, 1]], np.float64)


def common(obs, i, j):
    ks = [k for k, v in obs.items() if i in v and j in v]
    return ks, np.float64([obs[k][i] for k in ks]), np.float64([obs[k][j] for k in ks])


def reproj(K, R, t, X):
    x = (K @ (R @ X.T + t.reshape(3, 1))).T
    return x[:, :2] / x[:, 2:3], x[:, 2]


def tri(K, R1, t1, R2, t2, p1, p2):
    if len(p1) < 1:
        return np.zeros((0, 3)), np.zeros(0, bool)
    P1, P2 = K @ np.hstack([R1, t1.reshape(3, 1)]), K @ np.hstack([R2, t2.reshape(3, 1)])
    X = cv2.triangulatePoints(P1, P2, p1.T, p2.T)
    X = (X[:3] / np.where(np.abs(X[3]) < 1e-12, 1e-12, X[3])).T
    q1, z1 = reproj(K, R1, t1, X)
    q2, z2 = reproj(K, R2, t2, X)
    e = np.maximum(np.linalg.norm(q1 - p1, axis=1), np.linalg.norm(q2 - p2, axis=1))
    c1, c2 = -R1.T @ t1, -R2.T @ t2
    v1, v2 = X - c1, X - c2
    cosang = np.sum(v1 * v2, 1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1) + 1e-12)
    good = (z1 > 0) & (z2 > 0) & (e < 2.5) & (cosang < math.cos(math.radians(1.0)))
    return X, good


def turned_only(p, q, K, inl):
    """a homography explains the pair as well as the essential matrix does, and it is a rotation's (K^-1 H K orthogonal)"""
    Hm, hin = cv2.findHomography(p, q, cv2.RANSAC, 1.5)
    if Hm is None:
        return False
    if hin.sum() < 0.9 * max(1, inl.sum()):
        return False
    M = np.linalg.inv(K) @ Hm @ K
    sv = np.linalg.svd(M, compute_uv=False)
    return sv[2] / max(1e-12, sv[0]) > 0.95


def init_pair(obs, n, K, W, hint=None):
    best = None
    i0 = 0
    for i0 in ([hint[0]] if hint else range(0, max(1, n // 3), max(1, n // 12))):
        for j in ([hint[1]] if hint else range(i0 + 3, n, max(1, n // 24))):
            ks, p, q = common(obs, i0, j)
            if len(ks) < 40:
                break
            if np.median(np.linalg.norm(p - q, axis=1)) < 0.03 * W:
                continue
            E, inl = cv2.findEssentialMat(p, q, K, cv2.RANSAC, 0.999, 1.0)
            if E is None or E.shape != (3, 3):
                continue
            if turned_only(p, q, K, inl):        # the camera only turned between them: no depth to be had
                continue
            _, R, t, inl2 = cv2.recoverPose(E, p, q, K, mask=inl)
            m = inl2.ravel() > 0
            if m.sum() < 12:
                continue
            X, good = tri(K, np.eye(3), np.zeros(3), R, t.ravel(), p[m], q[m])
            score = int(good.sum())
            if best is None or score > best[0]:
                best = (score, i0, j, R, t.ravel(), [k for k, mm in zip(ks, m) if mm], X, good)
        if best and best[0] > 120:
            break
    return best


def solve_free(obs, n, f, W, H, final=False, hint=None):
    K = Kof(f, W, H)
    ip = init_pair(obs, n, K, W, hint)
    if not ip and hint:
        ip = init_pair(obs, n, K, W)
    if not ip or ip[0] < 30:
        return None
    _, i0, j0, R, t, ks, X, good = ip
    pts = {}
    for k, x, g in zip(ks, X, good):
        if g:
            pts[k] = x
    poses = {i0: (np.zeros(3), np.zeros(3)), j0: (cv2.Rodrigues(R)[0].ravel(), t)}
    byframe = {}
    for tid, v in obs.items():
        for k in v:
            byframe.setdefault(k, []).append(tid)
    order = list(range(i0 + 1, n)) + list(range(i0 - 1, -1, -1))
    last_good = i0
    for cnt, k in enumerate(order):
        if k in poses and k != j0:
            continue
        ids = [tid for tid in byframe.get(k, ()) if tid in pts]
        if len(ids) < 10:
            continue
        P3 = np.float64([pts[tid] for tid in ids])
        P2 = np.float64([obs[tid][k] for tid in ids])
        near = min(poses.keys(), key=lambda q: abs(q - k))
        rv, tv = poses[near]
        ok, rv2, tv2, inl = cv2.solvePnPRansac(P3, P2, K, None, rvec=rv.reshape(3, 1).copy(), tvec=tv.reshape(3, 1).copy(),
                                               useExtrinsicGuess=True, iterationsCount=200, reprojectionError=3.0, flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok or inl is None or len(inl) < 10:
            continue
        ii = inl.ravel()
        rv2, tv2 = cv2.solvePnPRefineLM(P3[ii], P2[ii], K, None, rv2, tv2)
        poses[k] = (rv2.ravel(), tv2.ravel())
        # new points: tracks seen here and in a solved frame far enough back
        if abs(k - last_good) >= 3:
            Rk = cv2.Rodrigues(rv2)[0]
            cand = [tid for tid in byframe.get(k, ()) if tid not in pts]
            byf = {}
            for tid in cand:
                fr = [q for q in obs[tid] if q in poses and q != k]
                if fr:
                    q = max(fr, key=lambda z: abs(z - k))
                    if abs(q - k) >= 3:
                        byf.setdefault(q, []).append(tid)
            for q, tids in byf.items():
                Rq = cv2.Rodrigues(poses[q][0])[0]
                p1 = np.float64([obs[tid][q] for tid in tids])
                p2 = np.float64([obs[tid][k] for tid in tids])
                Xn, gd = tri(K, Rq, poses[q][1], Rk, tv2.ravel(), p1, p2)
                for tid, x, g in zip(tids, Xn, gd):
                    if g:
                        pts[tid] = x
            last_good = k
        if final and cnt % 10 == 0:
            sio.say(p=round(0.45 + 0.25 * cnt / max(1, len(order)), 3), stage="solve")
    return {"K": K, "f": f, "poses": poses, "pts": pts, "pair": (i0, j0)}


def err_of(sol, obs):
    """the median reprojection error (px) over every sighting of a solved point in a solved frame"""
    K, P = sol["K"], sol["poses"]
    by = {}
    for tid, X in sol["pts"].items():
        for k, xy in obs[tid].items():
            if k in P:
                by.setdefault(k, ([], []))
                by[k][0].append(X)
                by[k][1].append(xy)
    es = []
    for k, (Xs, xys) in by.items():
        rv, tv = P[k]
        q, z = reproj(K, cv2.Rodrigues(rv)[0], tv, np.float64(Xs))
        e = np.linalg.norm(q - np.float64(xys), axis=1)
        es.append(np.where(z > 0, e, 50.0))
    if not es:
        return 1e9, 0
    es = np.concatenate(es)
    return float(np.median(es)), int(len(es))


def bundle(sol, obs, W, H, n):
    """the cameras, the points and the lens adjusted together (a robust loss)"""
    if least_squares is None:
        return sol
    frames = sorted(sol["poses"].keys())
    step = max(1, len(frames) // 90)
    fsel = frames[::step]
    if frames[-1] not in fsel:
        fsel.append(frames[-1])
    pids = sorted(sol["pts"].keys(), key=lambda t: -sum(1 for k in obs[t] if k in sol["poses"]))[:700]
    fi = {k: i for i, k in enumerate(fsel)}
    pi = {t: i for i, t in enumerate(pids)}
    O = [(fi[k], pi[t], xy[0], xy[1]) for t in pids for k, xy in obs[t].items() if k in fi]
    if len(O) < 50:
        return sol
    O = np.array(O, np.float64)
    nf, npt = len(fsel), len(pids)
    x0 = np.concatenate([[sol["f"]], np.concatenate([np.concatenate(sol["poses"][k]) for k in fsel]), np.concatenate([sol["pts"][t] for t in pids])])
    fixed0 = fsel[0]
    fidx, pidx = O[:, 0].astype(int), O[:, 1].astype(int)
    cx, cy = W / 2.0, H / 2.0

    def rot(rv):
        th = np.linalg.norm(rv, axis=1, keepdims=True)
        k = rv / np.maximum(th, 1e-12)
        return th, k

    def res(x):
        f = x[0]
        cam = x[1:1 + 6 * nf].reshape(nf, 6)
        P = x[1 + 6 * nf:].reshape(npt, 3)
        cam = cam.copy()
        cam[0] = np.concatenate(sol["poses"][fixed0])            # the first camera stays where it is (the gauge)
        rv, tv = cam[fidx, :3], cam[fidx, 3:]
        X = P[pidx]
        th, k = rot(rv)
        c, s = np.cos(th), np.sin(th)
        Xr = X * c + np.cross(k, X) * s + k * np.sum(k * X, 1, keepdims=True) * (1 - c) + tv
        z = np.maximum(Xr[:, 2], 1e-6)
        return np.concatenate([f * Xr[:, 0] / z + cx - O[:, 2], f * Xr[:, 1] / z + cy - O[:, 3]])

    m = 2 * len(O)
    A = lil_matrix((m, len(x0)), dtype=int)
    r = np.arange(len(O))
    A[r, 0] = 1
    A[r + len(O), 0] = 1
    for d in range(6):
        A[r, 1 + fidx * 6 + d] = 1
        A[r + len(O), 1 + fidx * 6 + d] = 1
    for d in range(3):
        A[r, 1 + 6 * nf + pidx * 3 + d] = 1
        A[r + len(O), 1 + 6 * nf + pidx * 3 + d] = 1
    try:
        R = least_squares(res, x0, jac_sparsity=A, loss="huber", f_scale=1.5, max_nfev=40, x_scale="jac", method="trf")
    except Exception:  # noqa: BLE001
        return sol
    x = R.x
    f = float(np.clip(x[0], 0.25 * W, 6 * W))
    P = x[1 + 6 * nf:].reshape(npt, 3)
    pts = dict(sol["pts"])
    for t, i in pi.items():
        pts[t] = P[i]
    # every frame's camera again from the adjusted points and lens
    K = Kof(f, W, H)
    poses = {}
    for k in frames:
        ids = [t for t in pts if k in obs[t]]
        if len(ids) < 8:
            continue
        P3, P2 = np.float64([pts[t] for t in ids]), np.float64([obs[t][k] for t in ids])
        rv, tv = sol["poses"][k]
        ok, rv2, tv2, inl = cv2.solvePnPRansac(P3, P2, K, None, rvec=rv.reshape(3, 1).copy(), tvec=tv.reshape(3, 1).copy(), useExtrinsicGuess=True,
                                               iterationsCount=100, reprojectionError=3.0, flags=cv2.SOLVEPNP_ITERATIVE)
        if ok and inl is not None and len(inl) >= 8:
            ii = inl.ravel()
            rv2, tv2 = cv2.solvePnPRefineLM(P3[ii], P2[ii], K, None, rv2, tv2)
            poses[k] = (rv2.ravel(), tv2.ravel())
    if fixed0 in sol["poses"]:
        poses[fixed0] = sol["poses"][fixed0]
    return {"K": K, "f": f, "poses": poses, "pts": pts}


# ---------------------------------------------------------------- 2 solve (tripod)
def solve_tripod(obs, n, f, W, H):
    K = Kof(f, W, H)
    Ki = np.linalg.inv(K)
    Rs = {0: np.eye(3)}
    for k in range(1, n):
        ks, p, q = common(obs, k - 1, k)
        if len(ks) < 12 or (k - 1) not in Rs:
            continue
        Hm, _ = cv2.findHomography(p, q, cv2.RANSAC, 2.0)
        if Hm is None:
            continue
        M = Ki @ Hm @ K
        U, _, Vt = np.linalg.svd(M)
        R = U @ Vt
        if np.linalg.det(R) < 0:
            R = -R
        Rs[k] = R @ Rs[k - 1]
    poses = {k: (cv2.Rodrigues(R)[0].ravel(), np.zeros(3)) for k, R in Rs.items()}
    pts = {}
    for tid, v in obs.items():
        k = min(v.keys())
        if k in Rs:
            ray = Rs[k].T @ (Ki @ np.array([v[k][0], v[k][1], 1.0]))
            pts[tid] = ray / np.linalg.norm(ray)
    return {"K": K, "f": f, "poses": poses, "pts": pts}


def tripod_err(sol, obs):
    return err_of(sol, obs)


# ---------------------------------------------------------------- 3 out
def normalise(sol, obs, a, fps, n, W, H, mode):
    keys = sorted(sol["poses"].keys())
    k0 = keys[0]
    R0 = cv2.Rodrigues(sol["poses"][k0][0])[0]
    t0 = sol["poses"][k0][1]
    C0 = -R0.T @ t0
    pts = sol["pts"]
    depth = [float((R0 @ X + t0)[2]) for X in pts.values()]
    depth = [d for d in depth if d > 0]
    s = 1.0 / (float(np.median(depth)) if depth else 1.0)
    frames = []
    for k in range(n):
        if k not in sol["poses"]:
            frames.append(None)
            continue
        R = cv2.Rodrigues(sol["poses"][k][0])[0]
        C = -R.T @ sol["poses"][k][1]
        Rn = R @ R0.T
        Cn = R0 @ (C - C0) * s
        frames.append({"t": round(a + k / fps, 4), "R": [round(float(v), 6) for v in Rn.ravel()], "C": [round(float(v), 5) for v in Cn]})
    P = []
    for tid, X in pts.items():
        Xn = R0 @ (X - C0) * s
        if Xn[2] <= 0.02 or not np.all(np.isfinite(Xn)):
            continue
        P.append([round(float(Xn[0]), 4), round(float(Xn[1]), 4), round(float(Xn[2]), 4), len(obs[tid])])
    P.sort(key=lambda r: -r[3])
    f = float(sol["f"])
    return frames, P[:1500], f


def fill_gaps(frames):
    """a frame not solved: between its solved neighbours (position straight, rotation slerped), else the nearest"""
    idx = [i for i, fr in enumerate(frames) if fr]
    if not idx:
        return frames, 0
    lost = 0
    for i, fr in enumerate(frames):
        if fr:
            continue
        lost += 1
        lo = max([j for j in idx if j < i], default=None)
        hi = min([j for j in idx if j > i], default=None)
        if lo is None or hi is None:
            src = frames[lo if lo is not None else hi]
            frames[i] = dict(src)
            continue
        u = (i - lo) / float(hi - lo)
        A, B = frames[lo], frames[hi]
        Ra, Rb = np.array(A["R"]).reshape(3, 3), np.array(B["R"]).reshape(3, 3)
        rv = cv2.Rodrigues(Rb @ Ra.T)[0] * u
        R = cv2.Rodrigues(rv)[0] @ Ra
        frames[i] = {"t": None, "R": [round(float(v), 6) for v in R.ravel()], "C": [round(A["C"][d] + (B["C"][d] - A["C"][d]) * u, 5) for d in range(3)], "guess": True}
    return frames, lost


def main():
    job = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    if cv2 is None:
        raise SystemExit("the camera tracker needs OpenCV (pip install opencv-python-headless)")
    src = job["input"]
    Pp = sio.probe(src)
    if not Pp["w"]:
        raise SystemExit("not a video: " + os.path.basename(src))
    fps = Pp["fps"]
    a = max(0.0, float(job.get("from") or 0))
    b = float(job.get("to") or Pp["dur"] or a + 5)
    if Pp["dur"]:
        b = min(b, Pp["dur"])
    if b - a < 0.4:
        raise SystemExit("too short to solve a camera (at least half a second)")
    if b - a > 120:
        raise SystemExit("at most 2 minutes at a time")
    W, H = sio.work_size(Pp["w"], Pp["h"], int(job.get("width") or 960))
    obs, n = track(src, a, b, W, H, int(job.get("features") or 1200), job.get("ignore"), fps)
    if n < 8 or len(obs) < 30:
        raise SystemExit("not enough detail to follow (%d points over %d frames) - a busier shot, or a longer range" % (len(obs), n))
    sio.say(p=0.36, stage="lens")
    fov = float(job.get("fov") or 0)
    mode = job.get("mode") or "auto"
    f_of = lambda deg: (W / 2.0) / math.tan(math.radians(deg) / 2.0)  # noqa: E731
    cands = [fov] if fov > 0 else [30, 40, 50, 60, 75]
    sol, best_e = None, 1e9
    if mode in ("auto", "free"):
        tried = {}

        def at(deg):
            if deg not in tried:
                hint = next((v[1]["pair"] for v in tried.values() if v[1]), None)
                s = solve_free(obs, n, f_of(deg), W, H, hint=hint)
                tried[deg] = (err_of(s, obs)[0] if s and len(s["poses"]) >= 0.5 * n else 1e9, s)
            return tried[deg][0]
        for deg in cands:
            at(deg)
        if fov <= 0:                                  # the lens: the best of a few, then narrowed down (golden section)
            d0 = min(tried, key=lambda d: tried[d][0])
            if tried[d0][0] < 1e9:
                lo, hi = max(15.0, d0 - 9.0), min(110.0, d0 + 9.0)
                g = (math.sqrt(5) - 1) / 2
                x1, x2 = hi - g * (hi - lo), lo + g * (hi - lo)
                for _ in range(6):
                    if at(round(x1, 2)) < at(round(x2, 2)):
                        hi, x2 = x2, x1
                        x1 = hi - g * (hi - lo)
                    else:
                        lo, x1 = x1, x2
                        x2 = lo + g * (hi - lo)
                sio.say(p=0.42, stage="lens")
        dbest = min(tried, key=lambda d: tried[d][0])
        best_e, sol = tried[dbest]
        if best_e >= 1e9:
            sol = None
        if sol is not None:
            sol = solve_free(obs, n, sol["f"], W, H, final=True, hint=sol.get("pair")) or sol
            sio.say(p=0.72, stage="adjust")
            sol = bundle(sol, obs, W, H, n)
            used = "free"
    if sol is None:
        if mode == "free":
            raise SystemExit("the camera could not be solved as moving - not enough parallax (try 📷 Tripod, or a longer range)")
        tt = {}

        def at2(deg):
            if deg not in tt:
                s = solve_tripod(obs, n, f_of(deg), W, H)
                tt[deg] = (tripod_err(s, obs)[0], s)
            return tt[deg][0]
        for deg in cands:
            at2(deg)
        if fov <= 0:
            d0 = min(tt, key=lambda d: tt[d][0])
            lo, hi = max(15.0, d0 - 9.0), min(110.0, d0 + 9.0)
            g = (math.sqrt(5) - 1) / 2
            x1, x2 = hi - g * (hi - lo), lo + g * (hi - lo)
            for _ in range(7):
                if at2(round(x1, 2)) < at2(round(x2, 2)):
                    hi, x2 = x2, x1
                    x1 = hi - g * (hi - lo)
                else:
                    lo, x1 = x1, x2
                    x2 = lo + g * (hi - lo)
        sol, used = tt[min(tt, key=lambda d: tt[d][0])][1], "tripod"
    e, m = err_of(sol, obs)
    frames, P, f = normalise(sol, obs, a, fps, n, W, H, used)
    solved = sum(1 for fr in frames if fr)
    frames, lost = fill_gaps(frames)
    for i, fr in enumerate(frames):
        fr["t"] = round(a + i / fps, 4)
    sio.say(ok=True, mode=used, fps=fps, W=W, H=H, f=round(f, 3), fov=round(math.degrees(2 * math.atan(W / 2.0 / f)), 2),
            err=round(e, 3), solved=solved, lost=lost, frames=frames, points=P, tracks=len(obs), **{"from": a})


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0):
            sys.stderr.write(str(e.code) + "\n")
            sys.exit(2)
