#!/usr/bin/env python3
"""bitGen Studio — 🎥 SYNC BY SOUND (2.416.0): where several recordings of the same moment line up (Premiere's multi-camera
"synchronize by audio").

Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".

    python3 audiosync.py <reference> <other> [<other> ...]
    -> JSON {"rate": 8000, "results": [{"file", "lag": seconds, "score": 0..1, "ok": bool}]}
       lag = how much LATER the same sound is in the reference than in the other: the other's second s happens at the
       reference's second s + lag (put the other on the timeline lag seconds after the reference's start)

Each file's sound: mono, 8 kHz, its loudness evened out (a camera mic and a lapel mic differ), the first 10 minutes.
The match: the cross-correlation of the two (through an FFT), its highest peak; score = how much that peak stands above
the rest (a clear single peak = 1). A file without sound, or a weak match, says so (ok false).
"""
import json
import subprocess
import sys

import numpy as np

RATE = 8000
MAXS = 600


def sound(p):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-vn", "-ac", "1", "-ar", str(RATE), "-t", str(MAXS),
                        "-f", "s16le", "-"], capture_output=True)
    x = np.frombuffer(r.stdout or b"", np.int16).astype(np.float32) / 32768.0
    if x.size < RATE // 4:
        return None
    # loudness evened out over ~0.25 s windows, so a loud mic does not outvote a quiet one
    w = RATE // 4
    n = x.size // w
    if n >= 2:
        env = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1)) + 1e-4
        g = np.repeat(1.0 / env, w)
        x = x[: n * w] * g
    x = x - x.mean()
    s = np.sqrt((x * x).sum()) + 1e-9
    return x / s


def lag(a, b):
    n = 1
    while n < a.size + b.size:
        n *= 2
    c = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    k = int(np.argmax(c))
    peak = float(c[k])
    # the next best peak, away from this one (±0.1 s)
    guard = RATE // 10
    c2 = c.copy()
    lo, hi = max(0, k - guard), min(n, k + guard + 1)
    c2[lo:hi] = -np.inf
    if k - guard < 0:
        c2[n + (k - guard):] = -np.inf
    if k + guard >= n:
        c2[: (k + guard) - n + 1] = -np.inf
    second = float(np.max(c2))
    if k > n // 2:
        k -= n
    score = 0.0 if peak <= 0 else max(0.0, min(1.0, 1.0 - max(0.0, second) / peak))
    return k / RATE, score, peak


def main(argv):
    if len(argv) < 2:
        raise SystemExit("usage: audiosync.py <reference> <other> [<other> ...]")
    ref = sound(argv[0])
    out = []
    for f in argv[1:]:
        if ref is None:
            out.append({"file": f, "lag": 0.0, "score": 0.0, "ok": False, "why": "the reference has no sound"})
            continue
        x = sound(f)
        if x is None:
            out.append({"file": f, "lag": 0.0, "score": 0.0, "ok": False, "why": "no sound to sync by"})
            continue
        lg, sc, pk = lag(ref, x)
        out.append({"file": f, "lag": round(lg, 4), "score": round(sc, 3), "ok": sc >= 0.2 and pk > 0.05,
                    "why": "" if sc >= 0.2 and pk > 0.05 else "no clear match - is it the same moment?"})
    return {"rate": RATE, "results": out}


if __name__ == "__main__":
    sys.stdout.write(json.dumps(main(sys.argv[1:])))
