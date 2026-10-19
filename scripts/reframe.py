"""bitGen Studio — SMART REFRAME (2.413.0): the 📤 Export's "follow" fit - a 9:16 / 1:1 / 4:5 ... version of the movie
whose crop FOLLOWS THE SUBJECT instead of staying in the middle (Premiere's Auto Reframe).

Tim: "do the smaller jobs and complete the 10 partly done jobs" (Auto reframe: "centre crop / pad / blur - it does not
follow the subject yet").

analyse(movie)  -> [(t, cx, cy, weight)] the subject's centre (0..1 of the frame) a few times a second:
                   faces (OpenCV's frontal + profile Haar cascades) count most, then people (OpenCV's HOG detector), then
                   what stands out - spectral-residual saliency + what moves between samples (numpy only, so this works
                   without OpenCV too)
smooth(track)   -> one centre per sample: gaps filled, a dead zone (small wobbles ignored), a moving average (~1 s), the
                   pan speed limited - a calm camera operator, not a jittery tracker
cmd_file(...)   -> a sendcmd file moving crop@rf's x / y every output frame (what deliver.py's vfilter animates)
"""
import json
import subprocess
from pathlib import Path

import numpy as np

try:
    import cv2                      # opencv-python(-headless): requirements.txt
except Exception:                   # noqa: BLE001 - numpy alone still reframes
    cv2 = None

SAMPLE_FPS = 4.0
AW = 320                            # analysis width


def _probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
        s = (d.get("streams") or [{}])[0]
        return int(s.get("width") or 0), int(s.get("height") or 0), float((d.get("format") or {}).get("duration") or 0)
    except (ValueError, TypeError):
        return 0, 0, 0.0


def frames(movie, fps=SAMPLE_FPS, aw=AW):
    """the movie's frames at `fps`, aw wide, as RGB uint8 arrays: (w, h, [frames])"""
    w, h, _d = _probe(movie)
    if not w or not h:
        return 0, 0, []
    ah = max(2, int(round(h * aw / w / 2)) * 2)
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(movie), "-vf", f"fps={fps},scale={aw}:{ah}", "-f", "rawvideo",
                        "-pix_fmt", "rgb24", "-"], capture_output=True)
    buf = r.stdout or b""
    n = len(buf) // (aw * ah * 3)
    return aw, ah, [np.frombuffer(buf, np.uint8, aw * ah * 3, i * aw * ah * 3).reshape(ah, aw, 3) for i in range(n)]


def saliency(gray):
    """spectral residual saliency (Hou & Zhang 2007) on a small copy -> a map the size of gray, 0..1"""
    h, w = gray.shape
    sw, sh = 64, max(8, int(round(64 * h / w)))
    small = gray[np.linspace(0, h - 1, sh).astype(int)][:, np.linspace(0, w - 1, sw).astype(int)].astype(np.float32)
    f = np.fft.fft2(small)
    amp, ph = np.abs(f), np.angle(f)
    la = np.log(amp + 1e-6)
    k = np.ones((3, 3), np.float32) / 9.0
    pad = np.pad(la, 1, mode="edge")
    avg = sum(pad[i:i + sh, j:j + sw] * k[i, j] for i in range(3) for j in range(3))
    sal = np.abs(np.fft.ifft2(np.exp((la - avg) + 1j * ph))) ** 2
    sal = sal / (sal.max() + 1e-9)
    big = sal[np.linspace(0, sh - 1, h).astype(int)][:, np.linspace(0, sw - 1, w).astype(int)]
    return big


def _centre(mask):
    m = mask.astype(np.float64)
    if m.sum() <= 1e-9:
        return None
    thr = np.quantile(m, 0.9)                   # the strongest tenth decides
    m = np.where(m >= thr, m, 0)
    s = m.sum()
    if s <= 1e-9:
        return None
    ys, xs = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    return float((m * xs).sum() / s / m.shape[1]), float((m * ys).sum() / s / m.shape[0])


_CASCADES = None


def _detectors():
    global _CASCADES
    if _CASCADES is None and cv2 is not None:
        try:
            base = cv2.data.haarcascades
            _CASCADES = [cv2.CascadeClassifier(base + "haarcascade_frontalface_default.xml"),
                         cv2.CascadeClassifier(base + "haarcascade_profileface.xml")]
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            _CASCADES.append(hog)
        except Exception:           # noqa: BLE001
            _CASCADES = []
    return _CASCADES or []


def analyse(movie, fps=SAMPLE_FPS):
    """-> {"w", "h", "dur", "track": [[t, cx, cy, weight, how]]}"""
    W, H, dur = _probe(movie)
    aw, ah, fr = frames(movie, fps)
    track = []
    prev = None
    det = _detectors()
    for i, f in enumerate(fr):
        t = i / fps
        gray = f.mean(axis=2)
        hit = None
        if det:
            g8 = gray.astype(np.uint8)
            faces = []
            for c in det[:2]:
                try:
                    faces += [tuple(x) for x in c.detectMultiScale(g8, 1.15, 4, minSize=(max(12, aw // 24),) * 2)]
                except Exception:   # noqa: BLE001
                    pass
            if faces:
                x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
                hit = ((x + w / 2) / aw, (y + h / 2.2) / ah, 1.0, "face")
            else:
                try:
                    people, wts = det[2].detectMultiScale(g8, winStride=(8, 8), padding=(8, 8), scale=1.06)
                    if len(people):
                        k = int(np.argmax(np.asarray(wts).reshape(-1))) if len(wts) else 0
                        x, y, w, h = people[k]
                        hit = ((x + w / 2) / aw, (y + h / 3) / ah, 0.7, "person")
                except Exception:   # noqa: BLE001
                    pass
        if hit is None:
            m = saliency(gray)
            if prev is not None:
                mv = np.abs(gray - prev)
                if mv.max() > 8:
                    m = 0.5 * m + 0.5 * mv / (mv.max() + 1e-9)
            c = _centre(m)
            if c:
                hit = (c[0], c[1], 0.35, "salient")
        prev = gray
        if hit:
            track.append([round(t, 3), round(hit[0], 4), round(hit[1], 4), hit[2], hit[3]])
    return {"w": W, "h": H, "dur": dur, "track": track}


def smooth(track, dur, fps=SAMPLE_FPS, dead=0.04, window=1.0, max_speed=0.35):
    """one calm centre per sample time: [(t, cx, cy)] - gaps held / blended, a dead zone, a ~1 s moving average,
    the pan at most max_speed of the frame per second"""
    n = max(1, int(np.ceil(max(dur, 1e-3) * fps)) + 1)
    ts = np.arange(n) / fps
    if not track:
        return [(float(t), 0.5, 0.5) for t in ts]
    tt = np.array([p[0] for p in track], float)
    cx = np.interp(ts, tt, np.array([p[1] for p in track], float))
    cy = np.interp(ts, tt, np.array([p[2] for p in track], float))
    out = []
    k = max(1, int(round(window * fps)))
    for arr in (cx, cy):
        # dead zone: hold until the subject moves past it
        held = arr.copy()
        cur = arr[0]
        for i in range(n):
            if abs(arr[i] - cur) > dead:
                cur = arr[i] - np.sign(arr[i] - cur) * dead
            held[i] = cur
        pad = np.pad(held, k, mode="edge")
        avg = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
        lim = avg.copy()
        step = max_speed / fps
        for i in range(1, n):
            lim[i] = lim[i - 1] + np.clip(avg[i] - lim[i - 1], -step, step)
        out.append(lim)
    return [(float(ts[i]), float(np.clip(out[0][i], 0, 1)), float(np.clip(out[1][i], 0, 1))) for i in range(n)]


def cover(w, h, tw, th):
    """the size the movie is scaled to so a tw x th crop fits inside (even numbers)"""
    f = max(tw / max(1, w), th / max(1, h))
    return max(tw, int(np.ceil(w * f / 2)) * 2), max(th, int(np.ceil(h * f / 2)) * 2)


def cmd_file(path_pts, out_fps, sw, sh, tw, th, out, t0=0.0, t1=None):
    """crop@rf's x / y for every output frame between t0 and t1 (the part an In / Out export keeps, its clock from 0)"""
    ts = np.array([p[0] for p in path_pts], float)
    xs, ys = np.array([p[1] for p in path_pts], float), np.array([p[2] for p in path_pts], float)
    end = t1 if t1 is not None else float(ts[-1])
    lines = []
    n = int(np.ceil(max(0.0, end - t0) * out_fps)) + 1
    for i in range(n):
        t = t0 + i / out_fps
        x = int(round(np.clip(np.interp(t, ts, xs) * sw - tw / 2, 0, sw - tw)))
        y = int(round(np.clip(np.interp(t, ts, ys) * sh - th / 2, 0, sh - th)))
        lines.append(f"{i / out_fps:.4f} crop@rf x {x}, crop@rf y {y};")
    Path(out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    first = lines[0].split()
    return int(first[3].rstrip(",")), int(first[6].rstrip(";"))
