#!/usr/bin/env python3
"""bitGen Studio — 🧍 CUT OUT A SUBJECT THROUGH A SHOT (2.515.0): the AI cut-out that follows (+ refine edge).

Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "AI cut-out through a shot (a subject
matte that follows) + refine edge".

    python scripts/roto.py job.json
job = {input, output (a .webm: the subject with its alpha, VP9 - see-through on the canvas and in the compile),
       from, to (source seconds), prompts: [{t (source s), pts: [[x, y, 1 = the subject | 0 = not it], ...] (0..1),
       box: [x0, y0, x1, y1] (0..1) | null}], method: auto | sam2 | ai | flow, model (the AI matte's), work (the long
       side the matte is worked out at, px), refine: {feather px, choke px (+ shrinks, - grows), smooth 0..100 (over
       time), edge: true (snapped to the picture's edges - a guided filter)}, sam2: {ckpt, cfg}}
The ways (auto = the best that is installed):
    sam2   Segment Anything 2's video predictor (venvs/matte + torch + sam2, the checkpoint in models/sam2): the clicks /
           box at one frame or several, the subject followed both ways from each - the best
    ai     the AI matte (rembg + BiRefNet, venvs/matte): each frame the subject's last shape is carried on by the
           motion (optical flow) and the AI matte is worked out round it, kept to what touches the carried shape
    flow   OpenCV only (nothing to install): GrabCut from the clicks / box, then each frame the carried shape refined by
           GrabCut in a band round its edge
Several prompts: each frame follows the nearest one (the shape is set again there - a correction).
stdout: JSON lines {"p": 0..1, "stage"}; the end {"ok": true, "frames", "method", "w", "h", "fps", "empty": [frame ...]}.
"""
import json
import os
import shutil
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene_io as sio  # noqa: E402

try:
    import cv2
except Exception:  # noqa: BLE001
    cv2 = None


def have_sam2():
    try:
        import sam2  # noqa: F401
        import torch  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def have_rembg():
    try:
        import rembg  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def methods(job):
    out = []
    s2 = job.get("sam2") or {}
    if have_sam2() and s2.get("ckpt") and os.path.exists(s2["ckpt"]):
        out.append("sam2")
    if have_rembg() and cv2 is not None:
        out.append("ai")
    if cv2 is not None:
        out.append("flow")
    return out


# ---------------------------------------------------------------- shapes
def px(pt, w, h):
    return int(round(min(1, max(0, pt[0])) * (w - 1))), int(round(min(1, max(0, pt[1])) * (h - 1)))


def rect_of(prompt, w, h):
    """the prompt's box in px (x, y, w, h) - its box, else round its points"""
    b = prompt.get("box")
    if b and len(b) == 4:
        x0, x1 = sorted([b[0], b[2]])
        y0, y1 = sorted([b[1], b[3]])
        x0, y0, x1, y1 = int(x0 * w), int(y0 * h), int(np.ceil(x1 * w)), int(np.ceil(y1 * h))
    else:
        inc = [px(p, w, h) for p in prompt.get("pts") or [] if len(p) < 3 or p[2]]
        if not inc:
            return 1, 1, w - 2, h - 2
        xs, ys = [p[0] for p in inc], [p[1] for p in inc]
        pad = int(0.18 * min(w, h)) if len(inc) == 1 else int(0.12 * min(w, h))
        x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
    x0, y0 = max(1, x0), max(1, y0)
    x1, y1 = min(w - 2, x1), min(h - 2, y1)
    return x0, y0, max(2, x1 - x0), max(2, y1 - y0)


def keep_touching(m, pts_in, pts_out, fallback_rect=None):
    """the parts of a 0/1 mask that hold a 'subject' click (none: the biggest), less those holding only a 'not it' click"""
    m8 = (m > 0.5).astype(np.uint8)
    n, lab = cv2.connectedComponents(m8, connectivity=8)
    if n <= 1:
        return m8
    keep = set()
    for (x, y) in pts_in:
        if lab[y, x] > 0:
            keep.add(int(lab[y, x]))
    if pts_in and not keep:                   # a click just off the shape: the part nearest it
        ys, xs = np.nonzero(lab)
        for (x, y) in pts_in:
            k = int(np.argmin((xs - x) ** 2 + (ys - y) ** 2))
            keep.add(int(lab[ys[k], xs[k]]))
    if not keep:
        sizes = np.bincount(lab.ravel())
        sizes[0] = 0
        keep.add(int(np.argmax(sizes)))
    for (x, y) in pts_out:
        k = int(lab[y, x])
        if k in keep and not any(lab[yy, xx] == k for (xx, yy) in pts_in):
            keep.discard(k)
    return np.isin(lab, list(keep)).astype(np.uint8)


def disc(mask, pts, r, val):
    for (x, y) in pts:
        cv2.circle(mask, (x, y), r, int(val), -1)


def grabcut_init(img, prompt):
    h, w = img.shape[:2]
    x, y, rw, rh = rect_of(prompt, w, h)
    pts = prompt.get("pts") or []
    inc = [px(p, w, h) for p in pts if len(p) < 3 or p[2]]
    exc = [px(p, w, h) for p in pts if len(p) >= 3 and not p[2]]
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[y:y + rh, x:x + rw] = cv2.GC_PR_FGD
    r = max(3, int(0.012 * np.hypot(w, h)))
    disc(m, inc, r, cv2.GC_FGD)
    disc(m, exc, r, cv2.GC_BGD)
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img, m, (x, y, rw, rh), bg, fg, 5, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        pass
    out = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)).astype(np.uint8)
    return keep_touching(out, inc, exc).astype(np.float32)


def carry(prev_gray, cur_gray, prev_mask):
    """the last shape carried on to this frame by the motion (dense optical flow, this frame -> the last)"""
    flow = cv2.calcOpticalFlowFarneback(cur_gray, prev_gray, None, 0.5, 4, 21, 3, 5, 1.1, 0)
    h, w = cur_gray.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(prev_mask.astype(np.float32), gx + flow[..., 0], gy + flow[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def bbox(m, thr=0.5):
    ys, xs = np.nonzero(m > thr)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def grow_box(b, k, w, h, at_least=8):
    x0, y0, x1, y1 = b
    dx, dy = max(at_least, int((x1 - x0) * k)), max(at_least, int((y1 - y0) * k))
    return max(0, x0 - dx), max(0, y0 - dy), min(w, x1 + dx), min(h, y1 + dy)


def grabcut_refine(img, warped):
    """the carried shape refined by GrabCut in a band round its edge (inside it = the subject, far out = not)"""
    h, w = warped.shape
    b = bbox(warped)
    if b is None:
        return warped
    side = max(b[2] - b[0], b[3] - b[1])
    band = max(4, int(0.06 * side))
    X0, Y0, X1, Y1 = grow_box(b, 0.25, w, h, band * 2)
    sub = (warped[Y0:Y1, X0:X1] > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1))
    kin = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (band + 1, band + 1))
    dil, ero = cv2.dilate(sub, k), cv2.erode(sub, kin)
    m = np.full(sub.shape, cv2.GC_BGD, np.uint8)
    m[dil > 0] = cv2.GC_PR_BGD
    m[sub > 0] = cv2.GC_PR_FGD
    m[ero > 0] = cv2.GC_FGD
    if not (m == cv2.GC_FGD).any() or not ((m == cv2.GC_BGD) | (m == cv2.GC_PR_BGD)).any():
        return warped
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(np.ascontiguousarray(img[Y0:Y1, X0:X1]), m, None, bg, fg, 2, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return warped
    out = np.zeros((h, w), np.float32)
    out[Y0:Y1, X0:X1] = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD))
    return out


def sane(new, ref):
    a, r = float((new > 0.5).sum()), float((ref > 0.5).sum())
    return r <= 0 or 0.4 <= a / r <= 2.5


def largest_on(m, ref):
    """the parts of m that overlap the carried shape (islands elsewhere dropped)"""
    m8 = (m > 0.5).astype(np.uint8)
    n, lab = cv2.connectedComponents(m8, connectivity=8)
    if n <= 2:
        return m
    ov = np.bincount(lab[ref > 0.5].ravel(), minlength=n)
    ov[0] = 0
    if ov.max() <= 0:
        return m
    keep = [k for k in range(1, n) if ov[k] > 0.15 * ov.max()]
    return m * np.isin(lab, keep)


# ---------------------------------------------------------------- the ways
class Flow:
    name = "flow"

    def first(self, img, prompt):
        return grabcut_init(img, prompt)

    def next(self, img, prev_img, prev_mask):
        g0, g1 = cv2.cvtColor(prev_img, cv2.COLOR_BGR2GRAY), cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        w = carry(g0, g1, prev_mask)
        r = grabcut_refine(img, w)
        if not sane(r, w):
            r = (w > 0.5).astype(np.float32)
        return largest_on(r, w).astype(np.float32)


class Ai(Flow):
    name = "ai"

    def __init__(self, model):
        from rembg import new_session
        self.sess = new_session(model or "birefnet-general")

    def matte(self, img, box):
        from rembg import remove
        from PIL import Image
        x0, y0, x1, y1 = box
        crop = cv2.cvtColor(np.ascontiguousarray(img[y0:y1, x0:x1]), cv2.COLOR_BGR2RGB)
        m = remove(Image.fromarray(crop), session=self.sess, only_mask=True)
        out = np.zeros(img.shape[:2], np.float32)
        out[y0:y1, x0:x1] = np.asarray(m.convert("L"), np.float32) / 255.0
        return out

    def first(self, img, prompt):
        h, w = img.shape[:2]
        x, y, rw, rh = rect_of(prompt, w, h)
        box = grow_box((x, y, x + rw, y + rh), 0.08, w, h)
        m = self.matte(img, box)
        pts = prompt.get("pts") or []
        inc = [px(p, w, h) for p in pts if len(p) < 3 or p[2]]
        exc = [px(p, w, h) for p in pts if len(p) >= 3 and not p[2]]
        keep = keep_touching(m, inc, exc)
        out = m * cv2.dilate(keep, np.ones((5, 5), np.uint8))
        return out if (out > 0.5).any() else grabcut_init(img, prompt)

    def next(self, img, prev_img, prev_mask):
        h, w = img.shape[:2]
        g0, g1 = cv2.cvtColor(prev_img, cv2.COLOR_BGR2GRAY), cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        wm = carry(g0, g1, prev_mask)
        b = bbox(wm, 0.3)
        if b is None:
            return wm
        m = self.matte(img, grow_box(b, 0.2, w, h, 12))
        side = max(b[2] - b[0], b[3] - b[1])
        band = max(5, int(0.08 * side))
        gate = cv2.dilate((wm > 0.3).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band + 1, 2 * band + 1)))
        m = m * gate
        if not sane(m, wm):
            return Flow.next(self, img, prev_img, prev_mask)
        return largest_on(m, wm).astype(np.float32)


def run_sam2(job, fdir, n, w, h, prompts, put):
    import torch
    from sam2.build_sam import build_sam2_video_predictor
    s2 = job.get("sam2") or {}
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    pred = build_sam2_video_predictor(s2.get("cfg") or "configs/sam2.1/sam2.1_hiera_s.yaml", s2["ckpt"], device=dev)
    seen = set()
    with torch.inference_mode(), torch.autocast(dev, dtype=torch.bfloat16, enabled=(dev == "cuda")):
        st = pred.init_state(video_path=fdir, offload_video_to_cpu=True, async_loading_frames=False)
        for k, pr in prompts:
            pts = pr.get("pts") or []
            kw = {}
            if pts:
                kw["points"] = np.array([[p[0] * w, p[1] * h] for p in pts], np.float32)
                kw["labels"] = np.array([1 if (len(p) < 3 or p[2]) else 0 for p in pts], np.int32)
            b = pr.get("box")
            if b and len(b) == 4:
                kw["box"] = np.array([min(b[0], b[2]) * w, min(b[1], b[3]) * h, max(b[0], b[2]) * w, max(b[1], b[3]) * h], np.float32)
            pred.add_new_points_or_box(inference_state=st, frame_idx=int(k), obj_id=1, **kw)
        k0 = min(k for k, _ in prompts)
        for rev in (False, True):                                 # forward from the first prompt, then back from it
            for fi, _ids, logits in pred.propagate_in_video(st, start_frame_idx=k0, reverse=rev):
                m = torch.sigmoid(logits[0, 0].float()).cpu().numpy()
                if m.shape != (h, w):
                    m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
                put(fi, m)
                seen.add(fi)
                sio.say(p=round(0.05 + 0.65 * len(seen) / max(1, n), 3), stage="sam2")


# ---------------------------------------------------------------- refine edge
def guided(I, p, r, eps):
    """He et al.'s guided filter: p (the matte) smoothed but kept to the edges of I (the picture's grey)"""
    k = (2 * r + 1, 2 * r + 1)
    mI, mp = cv2.boxFilter(I, -1, k), cv2.boxFilter(p, -1, k)
    cov = cv2.boxFilter(I * p, -1, k) - mI * mp
    var = cv2.boxFilter(I * I, -1, k) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return cv2.boxFilter(a, -1, k) * I + cv2.boxFilter(b, -1, k)


def finish(m_work, rgb, ref):
    """the matte at the picture's size, refined: snapped to the edges, choked / grown, feathered"""
    H, W = rgb.shape[:2]
    m = cv2.resize(m_work, (W, H), interpolation=cv2.INTER_LINEAR)
    if ref.get("edge"):
        k = min(1.0, 1920.0 / max(W, H))
        gw, gh = max(2, int(W * k)), max(2, int(H * k))
        I = cv2.cvtColor(cv2.resize(rgb, (gw, gh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        mm = cv2.resize(m, (gw, gh), interpolation=cv2.INTER_AREA)
        r = max(2, int(round(min(gw, gh) / 160)))
        g = np.clip(guided(I, mm, r, 1e-3), 0, 1)
        m = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR) if (gw, gh) != (W, H) else g
    ch = int(round(float(ref.get("choke") or 0)))
    if ch:
        se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * abs(ch) + 1, 2 * abs(ch) + 1))
        m = cv2.erode(m, se) if ch > 0 else cv2.dilate(m, se)
    fe = float(ref.get("feather") or 0)
    if fe > 0.2:
        m = cv2.GaussianBlur(m, (0, 0), fe / 2.0)
    return np.clip(m * 255.0 + 0.5, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- the job
def main():
    job = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    if job.get("probe"):
        sio.say(ok=True, methods=methods(job), cv2=cv2 is not None)
        return
    if cv2 is None:
        raise SystemExit("the cut-out needs OpenCV (pip install opencv-python-headless) - or install the AI matte")
    src, out = job["input"], job["output"]
    P = sio.probe(src)
    if not P["w"]:
        raise SystemExit("not a video: " + os.path.basename(src))
    fps = P["fps"]
    a = max(0.0, float(job.get("from") or 0))
    b = float(job.get("to") or P["dur"] or a + 5)
    if P["dur"]:
        b = min(b, P["dur"])
    if b <= a + 0.5 / fps:
        raise SystemExit("nothing to cut out: the range is empty")
    have = methods(job)
    want = job.get("method") or "auto"
    meth = have[0] if want == "auto" and have else want
    if meth not in have:
        raise SystemExit("the cut-out way '%s' is not installed here (there is: %s)" % (meth, ", ".join(have) or "none"))
    ws, hs = sio.work_size(P["w"], P["h"], int(job.get("work") or 768))
    tmp = tempfile.mkdtemp(prefix="bg-roto-")
    try:
        fdir = os.path.join(tmp, "f")
        os.makedirs(fdir)
        n = 0
        sio.say(p=0.01, stage="frames")
        for i, f in sio.frames(src, a, b, ws, hs, "rgb24"):
            cv2.imwrite(os.path.join(fdir, "%05d.jpg" % i), cv2.cvtColor(f, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 94])
            n = i + 1
        if not n:
            raise SystemExit("no frames between %.2f and %.2f s" % (a, b))
        prompts = []
        for pr in job.get("prompts") or []:
            k = int(round((float(pr.get("t", a)) - a) * fps))
            if (pr.get("pts") or pr.get("box")):
                prompts.append((min(n - 1, max(0, k)), pr))
        if not prompts:
            raise SystemExit("click the subject first (✚) - or drag a box round it")
        prompts.sort(key=lambda x: x[0])
        M = np.lib.format.open_memmap(os.path.join(tmp, "m.npy"), mode="w+", dtype=np.uint8, shape=(n, hs, ws))
        img = lambda i: cv2.imread(os.path.join(fdir, "%05d.jpg" % i))  # noqa: E731
        done = [0]

        def put(i, m):
            M[i] = np.clip(m * 255.0 + 0.5, 0, 255).astype(np.uint8)

        if meth == "sam2":
            run_sam2(job, fdir, n, ws, hs, prompts, put)
        else:
            eng = Ai(job.get("model")) if meth == "ai" else Flow()
            ks = [k for k, _ in prompts]
            for j, (k, pr) in enumerate(prompts):
                lo = 0 if j == 0 else (ks[j - 1] + k) // 2 + 1
                hi = n - 1 if j == len(prompts) - 1 else (k + ks[j + 1]) // 2
                im0 = img(k)
                m0 = eng.first(im0, pr)
                put(k, m0)
                for direction in (1, -1):
                    prev_i, prev_m, prev_im = k, m0, im0
                    rng = range(k + 1, hi + 1) if direction > 0 else range(k - 1, lo - 1, -1)
                    for i in rng:
                        im = img(i)
                        m = eng.next(im, prev_im, prev_m)
                        put(i, m)
                        prev_i, prev_m, prev_im = i, m, im
                        done[0] += 1
                        if done[0] % 4 == 0:
                            sio.say(p=round(0.05 + 0.65 * done[0] / max(1, n), 3), stage=meth)
        M.flush()
        # over time: a light smoothing of each frame with its neighbours (flicker at the edge goes)
        sm = max(0.0, min(100.0, float((job.get("refine") or {}).get("smooth") or 0))) / 150.0
        empty = [i for i in range(n) if int(M[i].max()) < 128]
        ref = job.get("refine") or {}
        sio.say(p=0.72, stage="encode")
        wr = sio.Writer(out + ".part.webm", P["w"], P["h"], fps, "vp9a", audio_from=src, audio_range=(a, n / fps))   # its sound too (the layer plays it)
        try:
            last = n - 1
            for i, rgb in sio.frames(src, a, b, P["w"], P["h"], "rgb24"):
                if i > last:
                    break
                m = M[i].astype(np.float32) / 255.0
                if sm > 0 and 0 < i < last:
                    m = (1 - sm) * m + sm * 0.5 * (M[i - 1].astype(np.float32) + M[i + 1].astype(np.float32)) / 255.0
                al = finish(m, rgb, ref)
                wr.write(np.dstack([rgb, al]))
                if i % 8 == 0:
                    sio.say(p=round(0.72 + 0.27 * i / max(1, n), 3), stage="encode")
        finally:
            wn = wr.close()
        os.replace(out + ".part.webm", out)
        sio.say(ok=True, frames=wn, method=meth, w=P["w"], h=P["h"], fps=fps, empty=empty[:200], **{"from": a, "to": a + wn / fps})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0):
            sys.stderr.write(str(e.code) + "\n")
            sys.exit(2)
