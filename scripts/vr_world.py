#!/usr/bin/env python3
"""bitGen Studio — VR WORLD: a performer inside a 360 / 180 picture (2.368.0).

Tim (verbatim): "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio
references- maybe using a 360 sbs picture as reference?" -> "lets try route 2".

The world is a STILL 360 / 180 picture (mono, stereo top-bottom or side by side). The performer is rendered
by a flat video model in a VIRTUAL CAMERA aimed into it, then put back:

  1. THE VIEW        the left eye of the picture, cut at the render size where the performer stands
                     (vr_swap.flat_vf - the same maths as the VR character swap). Stereo: the right eye's
                     view too - the pair gives the place's real depth.
  2. THE PERFORMER   rendered by MiniMax H3 / Wan starting on that view (or on a first frame with the
                     character already in it - the dialog's ✎ First frame), the camera locked.
  3. THE OTHER EYE   the place keeps its true depth (StereoSGBM on the picture's own pair, once). The
                     performer has no pair, so they stand as a CARD at the depth of the ground at their feet:
                     the performer is found as what differs from the empty view, their feet are the mask's
                     lowest row, and the right eye shifts them by the place's disparity there (smoothed over
                     time). Lock the background = outside the performer both eyes show the picture itself
                     (no shimmer, no seam); off = the render's own background (shadows and light kept).
  4. BACK INTO THE SPHERE  each eye's view through v360's exact inverse with the feathered edge, over the
                     still sphere, eyes re-stacked, the render's sound; H.265 above 4K, the players' name
                     suffix and the spherical v1 box (vr_swap.inject).

Pure argument builders + the per-frame compositor (numpy / OpenCV); vr_world_worker.py runs them.
Tested: scripts/test-vrworld.py.
"""
import math
import re
import subprocess

import vr_swap as VR

FPS = VR.FPS


def detect_mode(name, w, h):
    """(mode, sure) from the file NAME (players' tokens) or its shape. A 2:1 picture with no name hint is
    taken as a mono 360 photo (the commonest) - the dialog lets you change it."""
    n = str(name or "").lower()
    tok = lambda rx: re.search(rx, n) is not None                                       # noqa: E731
    is180 = tok(r"(^|[^a-z0-9])180([^0-9]|$)|vr180")
    is360 = tok(r"(^|[^a-z0-9])360([^0-9]|$)|vr360")
    tb = tok(r"(^|[_\-. ])(tb|ou|3dv|top.?bottom|over.?under)([_\-. ]|$)")
    lr = tok(r"(^|[_\-. ])(lr|sbs|3dh|side.?by.?side)([_\-. ]|$)")
    w, h = int(w or 0), int(h or 0)
    if is180 and (lr or not tb):
        return "sbs180", True
    if is360 and tb:
        return "tb360", True
    if is360 and lr:
        return "sbs360", True
    if lr and w and h and abs(w - 4 * h) <= 8:
        return "sbs360", True
    if tb and w and h and abs(w - h) <= 4:
        return "tb360", True
    if is360:
        return "mono360", True
    if w and h and abs(w - h) <= 4:
        return "tb360", False
    if w and h and abs(w - 4 * h) <= 8:
        return "sbs360", False
    if w and h and abs(w - 2 * h) <= 4:
        return "mono360", False
    return "", False


def still_view_args(src, dst, mode, eye, view, w, h):
    """ffmpeg: one eye of the still picture as the virtual camera sees it (a PNG)."""
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
            "-vf", VR.flat_vf(mode, eye, view, w, h) + ",setsar=1", "-frames:v", "1", str(dst)]


def fit_args(src, dst, w, h, frames=None):
    """ffmpeg: a render (any size / rate) -> exactly the view's size at 24 fps, sound kept."""
    a = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-vf", f"fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1",
         "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k"]
    if frames:
        a += ["-frames:v", str(int(frames))]
    return a + [str(dst)]


def fit_image_args(src, dst, w, h):
    """ffmpeg: a first-frame picture -> exactly the view's size (cover, centred)."""
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
            "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1",
            "-frames:v", "1", str(dst)]


def paste_still_args(still, mode, view, eye_l, eye_r, mask, dst, src_w, src_h, vw, vh, frames, codec,
                     audio_src=None):
    """ffmpeg: the eye clips back onto the still sphere with the feathered mask, eyes re-stacked, the
    render's sound. No +faststart: the spherical box is injected after (vr_swap.inject)."""
    ew, eh = VR.eye_size(mode, src_w, src_h)
    stereo = VR.MODES[mode]["stereo"]
    sph = VR.sphere_vf(mode, view, vw, vh, ew, eh)
    dur = frames / float(FPS)
    ins = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.4f}", "-i", str(still), "-i", str(eye_l)]
    if stereo:
        ins += ["-i", str(eye_r)]
    mi = 3 if stereo else 2
    ins += ["-loop", "1", "-framerate", str(FPS), "-i", str(mask)]
    ai = None
    if audio_src:
        ai = mi + 1
        ins += ["-i", str(audio_src)]
    fc = ["[0:v]format=yuv420p" + (",split=2[sa][sb]" if stereo else "[e0]")]
    if stereo:
        fc += [f"[sa]{VR.eye_crop(mode, 'L')}[e0]", f"[sb]{VR.eye_crop(mode, 'R')}[e1]"]
    fc.append(f"[{mi}:v]format=gray,{sph}" + (",split=2[m0][m1]" if stereo else "[m0]"))
    eyes = ["0", "1"] if stereo else ["0"]
    for i, e in enumerate(eyes):
        fc.append(f"[{1 + i}:v]fps={FPS},format=yuv420p,{sph}[p{e}]")
        fc.append(f"[p{e}][m{e}]alphamerge[pa{e}]")
        fc.append(f"[e{e}][pa{e}]overlay=shortest=1:format=auto,format=yuv420p[o{e}]")
    if stereo == "tb":
        fc.append("[o0][o1]vstack=inputs=2[v]")
    elif stereo == "sbs":
        fc.append("[o0][o1]hstack=inputs=2[v]")
    else:
        fc.append("[o0]null[v]")
    out = ["-filter_complex", ";".join(fc), "-map", "[v]"]
    if ai is not None:
        out += ["-map", f"{ai}:a:0?", "-c:a", "aac", "-b:a", "192k"]
    return ["ffmpeg", "-y", "-loglevel", "error"] + ins + out + ["-frames:v", str(int(frames))] \
        + list(codec) + [str(dst)]


def out_suffix(mode):
    return VR.MODES[mode]["suffix"]


# ------------------------------------------------------------- the compositor
class Composer:
    """Per frame: the performer's mask (what differs from the empty view), both eyes. bg_l / bg_r = the
    picture's own left / right views (BGR uint8, the view's size); bg_r None = mono."""

    def __init__(self, bg_l, bg_r=None, lock=False, smooth=0.8):
        import cv2
        import numpy as np
        self.cv2, self.np = cv2, np
        self.h, self.w = bg_l.shape[:2]
        self.bg_l, self.bg_r, self.lock, self.smooth = bg_l, bg_r, bool(lock), smooth
        self.foot = None
        self.xs = np.tile(np.arange(self.w, dtype=np.float32), (self.h, 1))
        self.ys = np.tile(np.arange(self.h, dtype=np.float32)[:, None], (1, self.w))
        self.bg_d = None
        if bg_r is not None:
            eye = VR.RightEye(self.w, self.h, smooth=0.0)
            self.bg_d = eye.disparity(bg_l, bg_r)          # the place's own depth, once
        self.k_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        self.k_big = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        self.feather = max(5, int(min(self.w, self.h) * 0.02) | 1)
        self.last_area = 0.0

    def mask(self, frame):
        """0..1 float alpha of the performer (soft edge), from what differs from the empty view."""
        cv2, np = self.cv2, self.np
        d = cv2.absdiff(frame, self.bg_l).max(axis=2)
        d = cv2.GaussianBlur(d, (7, 7), 0).astype(np.float32)
        med = float(np.median(d))
        mad = float(np.median(np.abs(d - med))) + 1e-3
        thr = max(18.0, med + 6.0 * mad)
        m = (d > thr).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, self.k_small)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, self.k_big)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
        keep = np.zeros_like(m)
        floor = 0.003 * self.w * self.h
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] >= floor:
                keep[lab == i] = 1
        keep = cv2.dilate(keep, self.k_big)
        self.last_area = float(keep.mean())
        a = cv2.GaussianBlur(keep.astype(np.float32), (self.feather, self.feather), 0)
        return np.clip(a, 0.0, 1.0)

    def foot_disparity(self, alpha):
        """The place's disparity under the performer's feet (the mask's lowest rows), smoothed."""
        np = self.np
        if self.bg_d is None:
            return 0.0
        rows = np.where((alpha > 0.5).any(axis=1))[0]
        if not len(rows):
            return self.foot if self.foot is not None else 0.0
        bottom = int(rows.max())
        cols = np.where(alpha[bottom] > 0.5)[0]
        if not len(cols):
            cols = np.arange(self.w)
        y0, y1 = max(0, bottom - 2), min(self.h, bottom + 8)
        x0, x1 = int(cols.min()), int(cols.max()) + 1
        val = float(np.median(self.bg_d[y0:y1, x0:x1]))
        self.foot = val if self.foot is None else self.smooth * self.foot + (1 - self.smooth) * val
        return self.foot

    def eyes(self, frame):
        """(left, right) for one rendered frame; right None for mono."""
        cv2, np = self.cv2, self.np
        a = self.mask(frame)
        a3 = a[:, :, None]
        left = frame
        if self.lock:
            left = (self.bg_l.astype(np.float32) * (1 - a3) + frame.astype(np.float32) * a3).astype(np.uint8)
        if self.bg_r is None:
            return left, None
        f = self.foot_disparity(a)
        # the performer's mask in the RIGHT eye's coordinates (a card at disparity f: x_right = x_left - f)
        M = np.float32([[1, 0, -f], [0, 1, 0]])
        ar = cv2.warpAffine(a, M, (self.w, self.h), flags=cv2.INTER_LINEAR, borderValue=0)
        d = self.bg_d * (1 - ar) + f * ar
        mx = self.xs + d
        warped = cv2.remap(frame, mx, self.ys, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        oob = mx > (self.w - 1.5)
        if oob.any():
            warped[oob] = self.bg_r[oob]
        if self.lock:
            ar3 = ar[:, :, None]
            right = (self.bg_r.astype(np.float32) * (1 - ar3) + warped.astype(np.float32) * ar3).astype(np.uint8)
        else:
            right = warped
        return left, right


def _reader(path, w, h):
    return subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "rawvideo",
                             "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-"],
                            stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)


def _writer(dst, w, h):
    return subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
                             "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "12",
                             "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dst)], stdin=subprocess.PIPE)


def read_png(path):
    import cv2
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"could not read {path}")
    return img


def write_eyes(clip, bg_l_png, bg_r_png, out_l, out_r, w, h, frames, lock=False, on_tick=None):
    """The rendered view clip -> the left-eye clip (+ the right-eye clip for stereo).
    Returns (frames written, mean performer area 0..1)."""
    import numpy as np
    bl = read_png(bg_l_png)
    br = read_png(bg_r_png) if bg_r_png else None
    if bl.shape[:2] != (h, w):
        raise ValueError(f"the left view is {bl.shape[1]}x{bl.shape[0]}, not {w}x{h}")
    comp = Composer(bl, br, lock=lock)
    size = w * h * 3
    rd = _reader(clip, w, h)
    wl = _writer(out_l, w, h)
    wr = _writer(out_r, w, h) if br is not None else None
    n, areas = 0, []
    try:
        while n < frames:
            buf = rd.stdout.read(size)
            if len(buf) < size:
                break
            fr = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            left, right = comp.eyes(fr)
            wl.stdin.write(np.ascontiguousarray(left).tobytes())
            if wr is not None:
                wr.stdin.write(np.ascontiguousarray(right).tobytes())
            areas.append(comp.last_area)
            n += 1
            if on_tick and n % 24 == 0:
                on_tick(n)
    finally:
        for p in (wl, wr):
            if p is None:
                continue
            try:
                p.stdin.close()
            except OSError:
                pass
            p.wait()
        try:
            rd.stdout.close()
        except OSError:
            pass
        rd.kill()
        rd.wait()
    return n, (sum(areas) / len(areas) if areas else 0.0)


def static_prompt(prompt):
    """The camera must not move (the view is pasted back into a still sphere) - added once."""
    p = str(prompt or "").strip()
    if re.search(r"static camera|camera (does not|doesn't) move|locked[- ]off|tripod", p, re.I):
        return p
    return (p + (" " if p else "") + "Static camera: the camera does not move, the background stays exactly as "
            "in the first frame.").strip()


def view_hfov_ok(fov):
    return 20.0 <= float(fov) <= 140.0


def eye_pixels_per_degree(mode, w, h):
    """How sharp the sphere is: pixels per degree of one eye (for the 'view size' hint)."""
    ew, _eh = VR.eye_size(mode, w, h)
    span = 180.0 if VR.MODES[mode]["proj"] == "hequirect" else 360.0
    return ew / span


def view_short_side_for(mode, w, h, fov, shape):
    """The render's short side that matches the sphere's sharpness for this field of view (capped)."""
    ppd = eye_pixels_per_degree(mode, w, h)
    a, b = VR.SHAPES.get(shape, VR.SHAPES["1:1"])
    horiz = ppd * float(fov)                 # the view's WIDTH spans the horizontal field of view
    short = horiz * b / a if a >= b else horiz
    return int(max(384, min(1088, math.floor(short / 16.0) * 16)))
