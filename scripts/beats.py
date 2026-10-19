#!/usr/bin/env python3
"""bitGen Studio — BEATS (2.420.0): where the beats of a song (or any clip's sound) fall, for ✂ cut-to-the-beat on
the timeline (ext/timelinedock/tlai.js -> lib/tlAi.js beats()).

Tim: "yes, please add your 2 suggestions" (AI inside the timeline: AI-aware cuts).

    python3 beats.py <media> [start] [dur]   -> JSON {"tempo", "beats": [seconds from `start`], "dur", "method"}

numpy only (no librosa): the sound at 22050 Hz mono -> a spectral-flux ONSET envelope (1024-sample frames, hop 256 =
~86 per second, log magnitude, the positive change summed, the local mean taken off) -> the TEMPO from its
autocorrelation over 60 - 200 BPM weighted towards 120 (a log-normal prior, the usual tempo-tracker trick; half / double
tempo ambiguities go to the faster one only when it is clearly stronger) -> the BEATS by dynamic programming (Ellis
2007): each frame's score = its onset strength + the best earlier beat one period back, penalised by how far the gap
strays from the period; traced back from the strongest end.
"""
import json
import subprocess
import sys

import numpy as np

SR = 22050
NFFT = 1024
HOP = 256


def load(path, start=0.0, dur=None):
    a = ["ffmpeg", "-v", "error"]
    if start and float(start) > 0:
        a += ["-ss", f"{float(start):.3f}"]
    a += ["-i", str(path)]
    if dur:
        a += ["-t", f"{float(dur):.3f}"]
    a += ["-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    r = subprocess.run(a, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr.decode("utf8", "replace").strip().splitlines() or ["ffmpeg failed"])[-1])
    return np.frombuffer(r.stdout, dtype=np.float32)


def onset_env(y):
    if len(y) < NFFT * 2:
        return np.zeros(1)
    n = 1 + (len(y) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    win = np.hanning(NFFT).astype(np.float32)
    S = np.abs(np.fft.rfft(y[idx] * win, axis=1))
    L = np.log1p(1000.0 * S)
    flux = np.maximum(0.0, np.diff(L, axis=0)).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    # take off the local mean (a ~0.5 s window) so loud passages do not swamp quiet ones
    k = max(1, int(0.5 * SR / HOP))
    mean = np.convolve(flux, np.ones(k) / k, mode="same")
    e = np.maximum(0.0, flux - mean)
    s = e.std()
    return e / s if s > 0 else e


def tempo_of(env):
    fps = SR / HOP
    lo, hi = int(fps * 60 / 200), int(fps * 60 / 60)
    if len(env) < hi * 2:
        return 120.0, 0.0
    e = env - env.mean()
    ac = np.correlate(e, e, mode="full")[len(e) - 1:]
    ac = ac / (ac[0] if ac[0] > 0 else 1.0)
    lags = np.arange(lo, hi + 1)
    bpm = 60.0 * fps / lags
    prior = np.exp(-0.5 * (np.log2(bpm / 120.0) / 1.0) ** 2)
    score = ac[lags] * prior
    best = int(lags[int(np.argmax(score))])
    # a strong peak at HALF the lag (double tempo) wins only when clearly stronger
    half = best // 2
    if half >= lo and ac[half] > 1.15 * ac[best]:
        best = half
    # refine to a fractional lag (parabola through the peak)
    if 1 <= best < len(ac) - 1:
        a, b, c = ac[best - 1], ac[best], ac[best + 1]
        d = (a - c) / (2 * (a - 2 * b + c)) if (a - 2 * b + c) != 0 else 0.0
        lag = best + max(-0.5, min(0.5, d))
    else:
        lag = float(best)
    return 60.0 * fps / lag, float(ac[best])


def beats_of(env, bpm, tight=100.0):
    fps = SR / HOP
    period = fps * 60.0 / bpm
    n = len(env)
    score = env.astype(np.float64).copy()
    back = -np.ones(n, dtype=np.int64)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    offs = np.arange(-hi, -lo + 1)
    pen = -tight * (np.log(-offs / period)) ** 2
    for t in range(n):
        p = t + offs
        ok = p >= 0
        if not ok.any():
            continue
        cand = score[p[ok]] + pen[ok]
        j = int(np.argmax(cand))
        if cand[j] > 0:
            score[t] += cand[j]
            back[t] = p[ok][j]
    # the end: the best score within the last period
    tail = max(0, n - int(round(period)))
    t = tail + int(np.argmax(score[tail:])) if n else 0
    out = []
    while t >= 0 and n:
        out.append(t)
        t = int(back[t])
    out.reverse()
    # a frame's flux rises once the attack is well inside its 1024-sample window: measured on click tracks, the attack
    # itself is 3/4 of a window after the frame's start
    return [round((float(f) * HOP + 0.75 * NFFT) / SR, 3) for f in out]


def main(path, start=0.0, dur=None):
    y = load(path, start, dur)
    total = len(y) / SR
    env = onset_env(y)
    if not env.any():
        return {"tempo": 0, "beats": [], "dur": round(total, 3), "method": "silent"}
    bpm, conf = tempo_of(env)
    beats = beats_of(env, bpm)
    return {"tempo": round(bpm, 2), "beats": beats, "dur": round(total, 3), "confidence": round(conf, 3), "method": "flux+dp"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: beats.py <media> [start] [dur]")
    s = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    d = float(sys.argv[3]) if len(sys.argv) > 3 and float(sys.argv[3]) > 0 else None
    sys.stdout.write(json.dumps(main(sys.argv[1], s, d)))
