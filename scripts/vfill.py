#!/usr/bin/env python3
"""bitGen Studio — 🩹 CONTENT-AWARE FILL FOR VIDEO (2.515.0): take something out of a shot, frame by frame.

Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "Content-aware fill for video (remove
an object across a shot)".

    python scripts/vfill.py job.json
job = {input, output (the whole clip again - .mp4, its sound copied; the frames outside from..to as they were),
       from, to (source s), hole: {file, kind: "alpha" (a cut-out .webm - scripts/roto.py: what is cut out goes) |
       "grey" (a mask video: white goes), t0 (its first frame's source s), invert: false}, grow (px - the hole made
       bigger: edges, a shadow), feather (px - the soft join), reach (s - how far before / after the frames are looked
       in, default 2), method: auto | spatial, ref: {file (a PNG of one frame already filled - in the image editor),
       t (its source s)} | null, work (the long side worked at, px - default 1280)}
    auto     each frame: the frames round it (nearest first, up to `reach` away) lined up on it (ORB features outside the
             holes -> a homography, RANSAC) - what they show where the hole is fills it (their brightness matched round
             the hole); then the reference frame (lined up the same way); then the last filled frame carried on (so
             what had to be made up stays still); what is still left is painted in from round it (OpenCV inpaint).
    spatial  only the painting in (fast; it may shimmer)
stdout: JSON lines {"p", "stage"}; the end {"ok", "frames", "filled", "from_frames" (share of the hole filled from other
        frames), "inpainted" (share painted in)}
"""
import collections
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene_io as sio  # noqa: E402

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None

OFFS = [1, -1, 2, -2, 3, -3, 5, -5, 8, -8, 12, -12, 18, -18, 27, -27, 40, -40, 60, -60, 90, -90]


class Holes:
    """the hole of each frame of the range (0/1 at the work size), from the cut-out's alpha or a grey mask video"""

    def __init__(self, hole, a, b, w, h, fps):
        self.ok = bool(hole and hole.get("file") and os.path.exists(hole["file"]))
        self.inv = bool(hole and hole.get("invert"))
        self.last = None
        self.kind = (hole or {}).get("kind") or "alpha"
        if not self.ok:
            self.gen = None
            return
        t0 = float(hole.get("t0") or 0)
        if self.kind == "alpha":
            self.gen = sio.frames(hole["file"], max(0.0, a - t0), max(0.02, b - t0), w, h, "rgba", fps=fps, alpha_codec="libvpx-vp9")
        else:
            self.gen = sio.frames(hole["file"], max(0.0, a - t0), max(0.02, b - t0), w, h, "gray", fps=fps)
        self.w, self.h = w, h

    def next(self):
        if self.gen is None:
            m = self.last if (self.last is not None and self.kind == "grey") else None
            return m if m is not None else np.zeros((self.h, self.w), np.uint8) if self.ok else None
        try:
            _, f = next(self.gen)
            m = (f[..., 3] if f.ndim == 3 else f) > 100
            if self.inv:
                m = ~m
            self.last = m.astype(np.uint8)
            return self.last
        except StopIteration:
            self.gen = None
            return self.next()


def orb():
    return cv2.ORB_create(nfeatures=2500, scaleFactor=1.2, nlevels=8, fastThreshold=7)


def feats(det, gray, hole):
    m = np.full(gray.shape, 255, np.uint8)
    if hole is not None:
        m[cv2.dilate(hole, np.ones((15, 15), np.uint8)) > 0] = 0
    kp, ds = det.detectAndCompute(gray, m)
    return (np.float32([k.pt for k in kp]) if kp else np.zeros((0, 2), np.float32)), ds


def homog(fa, fb, bf):
    """the homography taking frame a onto frame b (None when they do not line up well)"""
    (pa, da), (pb, db) = fa, fb
    if da is None or db is None or len(pa) < 12 or len(pb) < 12:
        return None
    try:
        mm = bf.knnMatch(da, db, k=2)
    except cv2.error:
        return None
    good = [m[0] for m in mm if len(m) == 2 and m[0].distance < 0.75 * m[1].distance]
    if len(good) < 16:
        return None
    A = np.float32([pa[m.queryIdx] for m in good])
    B = np.float32([pb[m.trainIdx] for m in good])
    H, inl = cv2.findHomography(A, B, cv2.RANSAC, 3.0)
    if H is None or inl is None or int(inl.sum()) < 14:
        return None
    return H


LK = dict(winSize=(21, 21), maxLevel=5, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01)) if cv2 is not None else {}


def homog_lk(ga, ha, gb, hb):
    """the same by following corners (optical flow) - for frames with little texture for ORB"""
    m = np.full(ga.shape, 255, np.uint8)
    m[cv2.dilate(ha, np.ones((15, 15), np.uint8)) > 0] = 0
    p0 = cv2.goodFeaturesToTrack(ga, maxCorners=900, qualityLevel=0.0005, minDistance=6, mask=m, blockSize=7)
    if p0 is None or len(p0) < 20:
        return None
    p1, st, _ = cv2.calcOpticalFlowPyrLK(ga, gb, p0, None, **LK)
    pb, st2, _ = cv2.calcOpticalFlowPyrLK(gb, ga, p1, None, **LK)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((p0 - pb).reshape(-1, 2), axis=1) < 1.0)
    if ok.sum() < 16:
        return None
    A, B = p0.reshape(-1, 2)[ok], p1.reshape(-1, 2)[ok]
    hh, ww = gb.shape
    inb = (B[:, 0] >= 0) & (B[:, 1] >= 0) & (B[:, 0] < ww) & (B[:, 1] < hh)
    A, B = A[inb], B[inb]
    if len(A) < 16:
        return None
    keep = hb[B[:, 1].astype(int), B[:, 0].astype(int)] == 0
    A, B = A[keep], B[keep]
    if len(A) < 16:
        return None
    H, inl = cv2.findHomography(A, B, cv2.RANSAC, 2.0)
    if H is None or inl is None or int(inl.sum()) < 14:
        return None
    return H


def main():
    job = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    if cv2 is None:
        raise SystemExit("the fill needs OpenCV (pip install opencv-python-headless)")
    src, out = job["input"], job["output"]
    P = sio.probe(src)
    if not P["w"]:
        raise SystemExit("not a video: " + os.path.basename(src))
    fps, W, H = P["fps"], P["w"], P["h"]
    a = max(0.0, float(job.get("from") or 0))
    b = float(job.get("to") or P["dur"] or a + 5)
    if P["dur"]:
        b = min(b, P["dur"])
    if b <= a + 0.5 / fps:
        raise SystemExit("nothing to fill: the range is empty")
    if b - a > 120:
        raise SystemExit("at most 2 minutes at a time")
    ws, hs = sio.work_size(W, H, int(job.get("work") or 1280))
    kx = ws / float(W)
    grow = max(0, int(round(float(job.get("grow") or 0) * kx)))
    feather = max(0.0, float(job.get("feather") or 0))
    reach = max(1, int(round(max(0.2, min(10.0, float(job.get("reach") or 2))) * fps)))
    offs = [o for o in OFFS if abs(o) <= reach]
    spatial = job.get("method") == "spatial"
    holes = Holes(job.get("hole"), a, b, ws, hs, fps)
    if not holes.ok:
        raise SystemExit("what to take out? (a cut-out, or the clip's masks)")
    det, bf = orb(), cv2.BFMatcher(cv2.NORM_HAMMING)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    ref = None
    R = job.get("ref") or {}
    if R.get("file") and os.path.exists(R["file"]):
        im = cv2.imread(R["file"], cv2.IMREAD_COLOR)
        if im is not None:
            im = cv2.cvtColor(cv2.resize(im, (ws, hs), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
            ref = {"img": im, "f": feats(det, clahe.apply(cv2.cvtColor(im, cv2.COLOR_RGB2GRAY)), None)}
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)) if grow else None
    ring_se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    buf = collections.OrderedDict()                # frame index -> {img, gray, hole, f}
    gen = sio.frames(src, a, b, ws, hs, "rgb24")
    total = max(1, int(round((b - a) * fps)))
    patches = {}                                   # frame -> (x0, y0, x1, y1, rgb patch, alpha patch) at the work size
    prev_out, prev_f = None, None
    stats = {"hole": 0, "frames": 0, "inp": 0}
    nxt, ended, i = 0, False, 0

    def load_until(k):
        nonlocal nxt, ended
        while not ended and nxt <= k:
            try:
                j, img = next(gen)
            except StopIteration:
                ended = True
                break
            hm = holes.next()
            if hm is None:
                hm = np.zeros((hs, ws), np.uint8)
            if se is not None and hm.any():
                hm = cv2.dilate(hm, se)
            g = clahe.apply(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY))      # local contrast evened: more to line up on
            buf[j] = {"img": img, "gray": g, "hole": hm, "f": None}
            nxt = j + 1

    def fe(j):
        e = buf[j]
        if e["f"] is None:
            e["f"] = feats(det, e["gray"], e["hole"])
        return e["f"]

    while True:
        load_until(i + reach)
        if i not in buf:
            break
        for k in [k for k in buf if k < i - reach]:
            del buf[k]
        cur = buf[i]
        hole = cur["hole"] > 0
        if hole.any():
            res = cur["img"].astype(np.float32)
            todo = hole.copy()
            nh = int(hole.sum())
            ring = (cv2.dilate(hole.astype(np.uint8), ring_se) > 0) & ~hole
            if not spatial:
                fi = fe(i)
                for o in offs:
                    j = i + o
                    if j not in buf or not todo.any():
                        continue
                    nb = buf[j]
                    Hm = homog(fe(j), fi, bf)
                    if Hm is None:
                        Hm = homog_lk(nb["gray"], nb["hole"], cur["gray"], cur["hole"])
                    if Hm is None:
                        continue
                    wimg = cv2.warpPerspective(nb["img"], Hm, (ws, hs), flags=cv2.INTER_LINEAR)
                    wbad = cv2.warpPerspective(nb["hole"] * 255, Hm, (ws, hs), flags=cv2.INTER_LINEAR, borderValue=255)
                    wval = cv2.warpPerspective(np.full((hs, ws), 255, np.uint8), Hm, (ws, hs), flags=cv2.INTER_NEAREST, borderValue=0)
                    ok = (wbad < 8) & (wval > 250)
                    take = todo & ok
                    if not take.any():
                        continue
                    rr = ring & ok
                    gain = np.ones(3, np.float32)
                    if rr.sum() > 30:
                        gain = np.clip(cur["img"][rr].astype(np.float32).mean(0) / np.maximum(1.0, wimg[rr].astype(np.float32).mean(0)), 0.8, 1.25)
                    res[take] = wimg[take].astype(np.float32) * gain
                    todo &= ~take
                stats["frames"] += nh - int(todo.sum())
                if todo.any() and ref is not None:
                    Hm = homog(ref["f"], fi, bf)
                    if Hm is not None:
                        wimg = cv2.warpPerspective(ref["img"], Hm, (ws, hs))
                        wval = cv2.warpPerspective(np.full((hs, ws), 255, np.uint8), Hm, (ws, hs), flags=cv2.INTER_NEAREST, borderValue=0)
                        take = todo & (wval > 250)
                        res[take] = wimg[take]
                        todo &= ~take
                if todo.any() and prev_out is not None and prev_f is not None:
                    Hm = homog(prev_f, fi, bf)
                    if Hm is None and (i - 1) in buf:
                        Hm = homog_lk(buf[i - 1]["gray"], buf[i - 1]["hole"], cur["gray"], cur["hole"])
                    if Hm is not None:
                        wimg = cv2.warpPerspective(prev_out, Hm, (ws, hs))
                        wval = cv2.warpPerspective(np.full((hs, ws), 255, np.uint8), Hm, (ws, hs), flags=cv2.INTER_NEAREST, borderValue=0)
                        take = todo & (wval > 250)
                        res[take] = wimg[take]
                        todo &= ~take
            r8 = np.clip(res + 0.5, 0, 255).astype(np.uint8)
            if todo.any():
                stats["inp"] += int(todo.sum())
                r8 = cv2.inpaint(r8, todo.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
            stats["hole"] += nh
            ys, xs = np.nonzero(hole)
            pad = int(np.ceil(feather * kx)) + 4
            x0, y0, x1, y1 = max(0, xs.min() - pad), max(0, ys.min() - pad), min(ws, xs.max() + pad + 1), min(hs, ys.max() + pad + 1)
            patches[i] = (x0, y0, x1, y1, r8[y0:y1, x0:x1].copy(), hole[y0:y1, x0:x1].astype(np.uint8) * 255)
            prev_out, prev_f = r8, fe(i) if not spatial else None
        else:
            prev_out, prev_f = None, None
        if i % 4 == 0:
            sio.say(p=round(0.02 + 0.68 * i / total, 3), stage="fill")
        i += 1
    n = i
    # the whole clip again: the filled frames laid in at the clip's own size (a soft join), the rest as it was
    sio.say(p=0.71, stage="encode")
    k0 = int(round(a * fps))
    webm = out.lower().endswith(".webm")                     # a webm clip stays a webm (VP9 + Opus), else an mp4
    part = out + (".part.webm" if webm else ".part.mp4")
    wr = sio.Writer(part, W, H, fps, "vp9" if webm else "h264", audio_from=src)
    try:
        for fi, rgb in sio.frames(src, 0, P["dur"] or b, W, H, "rgb24"):
            k = fi - k0
            if k in patches:
                x0, y0, x1, y1, pr, pa = patches.pop(k)
                X0, Y0 = int(x0 / kx), int(y0 / kx)
                X1, Y1 = min(W, int(np.ceil(x1 / kx))), min(H, int(np.ceil(y1 / kx)))
                big = cv2.resize(pr, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_CUBIC).astype(np.float32)
                al = cv2.resize(pa, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
                if feather > 0.2:                          # the hole stays filled to its edge, softening outward
                    r = max(1, int(round(feather / 2.0)))
                    al = cv2.GaussianBlur(cv2.dilate(al, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))), (0, 0), feather / 2.0)
                    al = np.maximum(al, cv2.resize(pa, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_NEAREST).astype(np.float32) / 255.0)
                al = al[..., None]
                o = rgb.astype(np.float32).copy()
                o[Y0:Y1, X0:X1] = o[Y0:Y1, X0:X1] * (1 - al) + big * al
                rgb = np.clip(o + 0.5, 0, 255).astype(np.uint8)
            wr.write(rgb)
            if fi % 15 == 0 and P["dur"]:
                sio.say(p=round(0.71 + 0.28 * min(1.0, fi / (P["dur"] * fps)), 3), stage="encode")
    finally:
        wn = wr.close()
    os.replace(part, out)
    hole_px = max(1, stats["hole"])
    sio.say(ok=True, frames=wn, filled=n, from_frames=round(stats["frames"] / hole_px, 3), inpainted=round(stats["inp"] / hole_px, 3), **{"from": a, "to": b})


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0):
            sys.stderr.write(str(e.code) + "\n")
            sys.exit(2)
