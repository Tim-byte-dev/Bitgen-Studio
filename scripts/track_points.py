#!/usr/bin/env python3
"""bitGen Studio — 🎯 TRACK POINTS / A PLANE (2.499.0): follow points (or a flat surface) through a clip.

Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." -
AFTER-EFFECTS-GAP.md: "Point / corner-pin tracking (stick a picture on a screen), planar tracking".

    python3 track_points.py <file> <from s> <to s> <points | planar> <json [[x, y], ...] (0..1 of the frame)> [box] [width]
      points  each point followed on its own: the patch round it (box = its size, 0..1 of the width, default 0.05) looked
              for near where it was, frame by frame (the clip's own frame rate, <width> px wide, default 960), to a
              fraction of a pixel (a parabola through the best score and its neighbours); the patch slowly takes on the
              new look, always anchored to the first one (it never drifts onto the background)
      planar  4 corners of a flat surface (a screen, a sign, a page): with OpenCV - many features inside it followed
              (optical flow), the surface's homography each frame (RANSAC: what moves differently is ignored), the
              corners carried by it; features found again when too few are left. Without OpenCV: the 4 corners as points.
    -> JSON {"fps", "track": [{"t": source s, "pts": [[x, y], ...]}], "method": "opencv" | "numpy" | "opencv-planar",
             "lost": [source s ...] (frames where a point was not found well - it held / was guessed), "frames"}
"""
import json
import subprocess
import sys

import numpy as np

try:
    import cv2
except Exception:                       # noqa: BLE001 - numpy alone tracks points too
    cv2 = None


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-of", "json", path], capture_output=True, text=True)
    s = json.loads(r.stdout or "{}").get("streams", [{}])[0]
    num, den = (s.get("r_frame_rate") or "24/1").split("/")
    fps = float(num) / max(1.0, float(den))
    return int(s.get("width") or 1280), int(s.get("height") or 720), fps if 1 <= fps <= 240 else 24.0


def frames(path, t0, t1, W, H):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.4f}", "-i", path, "-t", f"{max(0.04, t1 - t0):.4f}",
           "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W).astype(np.float32)
    p.wait()


def ssd_map(img, tmpl, x0, y0, x1, y1):
    """normalised squared difference of tmpl over img[y0:y1, x0:x1] (top-left positions) -> map"""
    th, tw = tmpl.shape
    win = img[y0:y1 + th - 1, x0:x1 + tw - 1]
    if cv2 is not None:
        return cv2.matchTemplate(win, tmpl, cv2.TM_SQDIFF_NORMED)
    v = np.lib.stride_tricks.sliding_window_view(win, (th, tw))
    d = ((v - tmpl) ** 2).sum(axis=(2, 3))
    nrm = np.sqrt((v ** 2).sum(axis=(2, 3)) * (tmpl ** 2).sum()) + 1e-6
    return d / nrm


def sub(m, j, i):
    """the minimum at (j, i) to a fraction of a pixel (a parabola each way)"""
    def par(a, b, c):
        d = a - 2 * b + c
        return 0.0 if abs(d) < 1e-12 else max(-0.5, min(0.5, 0.5 * (a - c) / d))
    dx = par(m[j, i - 1], m[j, i], m[j, i + 1]) if 0 < i < m.shape[1] - 1 else 0.0
    dy = par(m[j - 1, i], m[j, i], m[j + 1, i]) if 0 < j < m.shape[0] - 1 else 0.0
    return dx, dy


def track_points(path, t0, t1, pts, box, width):
    W0, H0, fps = probe(path)
    W = int(width)
    H = int(round(H0 * W / W0 / 2) * 2)
    r = max(6, int(round(box * W / 2)))
    P = [[x * W, y * H] for x, y in pts]
    V = [[0.0, 0.0] for _ in P]
    first, tmpl, out, lost, good = None, [], [], [], [[] for _ in P]
    for k, f in enumerate(frames(path, t0, t1, W, H)):
        t = t0 + k / fps
        if first is None:
            first = []
            for (x, y) in P:
                xi, yi = int(round(x)), int(round(y))
                xi, yi = min(max(r, xi), W - r - 1), min(max(r, yi), H - r - 1)
                first.append(f[yi - r:yi + r + 1, xi - r:xi + r + 1].copy())
            tmpl = [a.copy() for a in first]
            out.append({"t": round(t, 4), "pts": [[round(x / W, 6), round(y / H, 6)] for x, y in P]})
            continue
        lost_here = False
        for n, (x, y) in enumerate(P):
            px, py = x + V[n][0], y + V[n][1]                       # where it should be (its speed)
            s = r + 16 + int(abs(V[n][0]) + abs(V[n][1]))
            x0, y0 = int(max(0, round(px) - r - s)), int(max(0, round(py) - r - s))
            x1, y1 = int(min(W - 2 * r - 1, round(px) - r + s)), int(min(H - 2 * r - 1, round(py) - r + s))
            if x1 <= x0 or y1 <= y0:
                lost_here = True
                continue
            m = ssd_map(f, tmpl[n], x0, y0, x1, y1)
            j, i = np.unravel_index(int(np.argmin(m)), m.shape)
            score = float(m[j, i])
            g = good[n]
            usual = float(np.median(g)) if len(g) >= 5 else 0.02
            if score > max(0.08, 4 * usual):                       # not found well: it keeps moving as it was
                lost_here = True
                P[n] = [px, py]
                continue
            g.append(score)
            dx, dy = sub(m, j, i)
            nx, ny = x0 + i + dx + r, y0 + j + dy + r
            V[n] = [0.6 * (nx - x) + 0.4 * V[n][0], 0.6 * (ny - y) + 0.4 * V[n][1]]
            P[n] = [nx, ny]
            xi, yi = int(round(nx)), int(round(ny))
            if r <= xi < W - r and r <= yi < H - r:
                tmpl[n] = 0.8 * first[n] + 0.2 * f[yi - r:yi + r + 1, xi - r:xi + r + 1]
        if lost_here:
            lost.append(round(t, 4))
        out.append({"t": round(t, 4), "pts": [[round(x / W, 6), round(y / H, 6)] for x, y in P]})
    return {"fps": fps, "track": out, "method": "opencv" if cv2 is not None else "numpy", "lost": lost, "frames": len(out)}


def track_planar(path, t0, t1, quad, width):
    W0, H0, fps = probe(path)
    W = int(width)
    H = int(round(H0 * W / W0 / 2) * 2)
    Q0 = np.array([[x * W, y * H] for x, y in quad], np.float32).reshape(-1, 1, 2)
    Htot = np.eye(3)
    prev, feats, out, lost = None, None, [], []

    def find(img, q):
        mask = np.zeros(img.shape, np.uint8)
        cv2.fillConvexPoly(mask, q.reshape(-1, 2).astype(np.int32), 255)
        return cv2.goodFeaturesToTrack(img, maxCorners=300, qualityLevel=0.01, minDistance=5, mask=mask)
    for k, f in enumerate(frames(path, t0, t1, W, H)):
        t = t0 + k / fps
        g8 = f.astype(np.uint8)
        if prev is None:
            feats = find(g8, Q0)
            prev = g8
            out.append({"t": round(t, 4), "pts": [[round(float(x) / W, 6), round(float(y) / H, 6)] for x, y in Q0.reshape(-1, 2)]})
            continue
        ok_here = False
        if feats is not None and len(feats) >= 8:
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g8, feats, None, winSize=(21, 21), maxLevel=3)
            a, b = feats[st.ravel() == 1], nxt[st.ravel() == 1]
            if len(a) >= 8:
                Hm, inl = cv2.findHomography(a, b, cv2.RANSAC, 3.0)
                if Hm is not None and inl is not None and int(inl.sum()) >= 8:
                    Htot = Hm @ Htot
                    feats = b[inl.ravel() == 1].reshape(-1, 1, 2)
                    ok_here = True
        Q = cv2.perspectiveTransform(Q0, Htot)
        if feats is None or len(feats) < 60:                       # too few left: found again inside the surface
            more = find(g8, Q)
            if more is not None:
                feats = more if feats is None else np.concatenate([feats, more])[:400]
        if not ok_here:
            lost.append(round(t, 4))
        prev = g8
        out.append({"t": round(t, 4), "pts": [[round(float(x) / W, 6), round(float(y) / H, 6)] for x, y in Q.reshape(-1, 2)]})
    return {"fps": fps, "track": out, "method": "opencv-planar", "lost": lost, "frames": len(out)}


def main(a):
    if len(a) < 6:
        print("usage: track_points.py <file> <from> <to> <points|planar> <json pts> [box] [width]", file=sys.stderr)
        sys.exit(2)
    path, t0, t1, mode, pts = a[1], float(a[2]), float(a[3]), a[4], json.loads(a[5])
    box = float(a[6]) if len(a) > 6 else 0.05
    width = int(a[7]) if len(a) > 7 else 960
    if not (isinstance(pts, list) and pts and all(isinstance(p, list) and len(p) == 2 for p in pts)):
        print("points: [[x, y], ...] (0..1 of the frame)", file=sys.stderr)
        sys.exit(2)
    if mode == "planar" and cv2 is not None and len(pts) == 4:
        res = track_planar(path, t0, t1, pts, width)
    else:
        res = track_points(path, t0, t1, pts, box, width)
    print(json.dumps(res))


if __name__ == "__main__":
    main(sys.argv)
