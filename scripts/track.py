#!/usr/bin/env python3
"""bitGen Studio — 🎯 TRACK (2.416.0): follow what a mask sits on through the clip (Premiere's mask tracking).

Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".

    python3 track.py <file> <from s> <to s> <x> <y> <w> <h> [fps]
      x, y = the region's centre, w, h = its size (0..1 of the frame) at <from>
    -> JSON {"track": [{"t": source seconds, "x", "y"}], "lost": seconds | null, "gaps": [[from, to]], "method": "opencv" | "numpy",
             "frames": n}

The region at the first frame is the template; every next frame (10 a second, 320 wide) it is looked for near where it
was (the normalised squared difference in colour - OpenCV's matchTemplate when it is there, numpy's otherwise: the same score), the
template slowly taking on the new look (lighting, a turn - always anchored to the first look, so it never drifts
onto the background). A match much poorer than the clip's usual good ones (4x, at least 0.05) = lost: the track holds
its last place and looks further around; a clear match picks it up again - the gaps are said.
"""
import json
import subprocess
import sys

import numpy as np

try:
    import cv2
except Exception:                       # noqa: BLE001 - numpy alone tracks too
    cv2 = None

AW = 320


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", p],
                       capture_output=True, text=True)
    try:
        s = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
        return int(s.get("width") or 0), int(s.get("height") or 0)
    except (ValueError, TypeError):
        return 0, 0


def frames(p, t0, t1, fps):
    w, h = probe(p)
    if not w or not h:
        raise SystemExit("not a picture: " + p)
    ah = max(2, int(round(h * AW / w / 2)) * 2)
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t0:.4f}", "-to", f"{t1:.4f}", "-i", p, "-vf",
                        f"fps={fps},scale={AW}:{ah},format=rgb24", "-f", "rawvideo", "-"], capture_output=True)
    buf = r.stdout or b""
    n = len(buf) // (AW * ah * 3)          # in COLOUR: a yellow ball on a yellow-grey bar is not lost in grey
    return AW, ah, [np.frombuffer(buf, np.uint8, AW * ah * 3, i * AW * ah * 3).reshape(ah, AW, 3).astype(np.float32) for i in range(n)]


def ncc(win, tpl):
    """how well tpl matches at every place in win: 1 - the normalised squared difference, in colour (OpenCV's
    TM_SQDIFF_NORMED, or the same in numpy) - absolute colours count (a yellow ball over a yellow-grey bar is not the bar)"""
    if cv2 is not None:
        return 1.0 - cv2.matchTemplate(win.astype(np.float32), tpl.astype(np.float32), cv2.TM_SQDIFF_NORMED)
    th, tw = tpl.shape[:2]
    v = np.lib.stride_tricks.sliding_window_view(win, (th, tw, win.shape[2]))[:, :, 0]
    t = tpl.astype(np.float64)
    vv = v.astype(np.float64)
    tt = (t * t).sum()
    ii = (vv * vv).sum(axis=(2, 3, 4))
    ti = (vv * t).sum(axis=(2, 3, 4))
    sq = tt + ii - 2 * ti
    return 1.0 - sq / (np.sqrt(tt * ii) + 1e-6)


def track(p, t0, t1, x, y, w, h, fps=10.0):
    W, H, fr = frames(p, t0, t1, fps)
    if not fr:
        return {"track": [], "lost": None, "method": "opencv" if cv2 is not None else "numpy", "frames": 0}
    tw = max(8, int(round(w * W)))
    th = max(8, int(round(h * H)))
    cx, cy = x * W, y * H

    def patch(img, cx_, cy_):
        x0 = int(round(cx_ - tw / 2))
        y0 = int(round(cy_ - th / 2))
        x0 = max(0, min(W - tw, x0))
        y0 = max(0, min(H - th, y0))
        return img[y0:y0 + th, x0:x0 + tw], x0, y0

    tpl, _, _ = patch(fr[0], cx, cy)
    tpl = tpl.copy()
    first, run = tpl.copy(), tpl.copy()
    out = [{"t": round(t0, 4), "x": round(cx / W, 5), "y": round(cy / H, 5)}]
    lost = None                                        # the first moment it was not found
    gaps = []                                          # [from, to] seconds it was held (not found)
    miss = 0
    base = 0.01
    vx = vy = 0.0
    for i in range(1, len(fr)):
        img = fr[i]
        t = round(t0 + i / fps, 4)
        sr = int(max(tw, th) * (0.9 + 0.6 * min(miss, 6))) + 4      # looking further while it is missing
        px, py = cx + vx, cy + vy                      # where it should be at its speed
        x0 = int(max(0, px - tw / 2 - sr))
        y0 = int(max(0, py - th / 2 - sr))
        x1 = int(min(W, px + tw / 2 + sr))
        y1 = int(min(H, py + th / 2 + sr))
        win = img[y0:y1, x0:x1]
        best = -1.0
        if win.shape[0] >= th and win.shape[1] >= tw:
            sc = ncc(win, tpl)
            k = int(np.argmax(sc))
            by, bx = divmod(k, sc.shape[1])
            best = float(sc[by, bx])
        d = 1.0 - best                                 # the match's distance (0 = the same picture)
        lim = max(0.05, 4.0 * base) if not miss else max(0.03, 2.0 * base)
        if best < 0 or d > lim:                        # not found (found again only on a clear match)
            if not miss:
                lost = lost if lost is not None else t
                gaps.append([t, t])
                vx = vy = 0.0
            miss += 1
            gaps[-1][1] = t
        else:
            miss = 0
            base = 0.8 * base + 0.2 * d if i > 1 else d    # how close a good match usually is in this clip
            ncx, ncy = x0 + bx + tw / 2, y0 + by + th / 2
            vx, vy = 0.6 * vx + 0.4 * (ncx - cx), 0.6 * vy + 0.4 * (ncy - cy)
            cx, cy = ncx, ncy
            if d < max(0.01, 1.5 * base):
                new, _, _ = patch(img, cx, cy)
                if new.shape == tpl.shape:          # anchored to the first look: no slow drift onto the background
                    run = 0.9 * run + 0.1 * new
                    tpl = 0.6 * first + 0.4 * run
        out.append({"t": t, "x": round(cx / W, 5), "y": round(cy / H, 5)})
    return {"track": out, "lost": lost, "gaps": gaps, "method": "opencv" if cv2 is not None else "numpy", "frames": len(fr)}


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 7:
        raise SystemExit("usage: track.py <file> <from> <to> <x> <y> <w> <h> [fps]")
    res = track(a[0], float(a[1]), float(a[2]), float(a[3]), float(a[4]), float(a[5]), float(a[6]), float(a[7]) if len(a) > 7 else 10.0)
    sys.stdout.write(json.dumps(res))
