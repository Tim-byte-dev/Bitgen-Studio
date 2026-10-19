#!/usr/bin/env python3
"""bitGen Studio — scene_io.py (2.515.0): the frames in and out for the timeline's SCENE TOOLS (step 8 of the After Effects
gap list: the AI cut-out through a shot - scripts/roto.py, the 3D camera tracker - scripts/camtrack.py, content-aware
fill for video - scripts/vfill.py). numpy + ffmpeg only.

    probe(path)                         -> {w, h, fps, dur, alpha}
    frames(path, t0, t1, w, h, fmt)     a generator of (index, numpy frame) from source second t0 to t1, scaled to w x h
                                        (fmt "rgb24" -> HxWx3, "gray" -> HxW, "rgba" -> HxWx4; alpha read through libvpx)
    Writer(path, w, h, fps, kind)       .write(frame) .close(): kind "vp9a" (RGBA -> VP9 with alpha, see-through webm),
                                        "h264" (RGB -> mp4), "vp9" (RGB -> webm), "gray" (HxW -> VP9 grey webm); audio_from (+ audio_range)
                                        = the clip's sound with it (copied into an mp4, Opus in a webm)
    say(**kw)                           one JSON line on stdout (the progress: {"p": 0..1, "stage": ...}; the end: {"ok": ...})
    work_size(w, h, side)               the size the work is done at (the long side at most `side`, even numbers)
"""
import json
import subprocess
import sys

import numpy as np


def say(**kw):
    sys.stdout.write(json.dumps(kw) + "\n")
    sys.stdout.flush()


def _num(v, d=0.0):
    try:
        x = float(v)
        return x if x == x else d
    except Exception:  # noqa: BLE001
        return d


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate,avg_frame_rate,codec_name,pix_fmt:stream_tags=alpha_mode:format=duration",
                        "-of", "json", path], capture_output=True, text=True)
    j = json.loads(r.stdout or "{}")
    s = (j.get("streams") or [{}])[0]
    fps = 0.0
    for k in ("r_frame_rate", "avg_frame_rate"):
        a, _, b = str(s.get(k) or "0/1").partition("/")
        v = _num(a) / max(1e-9, _num(b, 1.0))
        if 1 <= v <= 240:
            fps = v
            break
    tags = s.get("tags") or {}
    alpha = str(tags.get("alpha_mode") or tags.get("ALPHA_MODE") or "") == "1" or "a" in str(s.get("pix_fmt") or "").replace("yuv", "")[:4]
    return {"w": int(s.get("width") or 0), "h": int(s.get("height") or 0), "fps": fps or 24.0,
            "dur": _num((j.get("format") or {}).get("duration")), "alpha": bool(alpha), "codec": s.get("codec_name") or ""}


def work_size(w, h, side):
    k = min(1.0, float(side) / max(1, max(w, h)))
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def frames(path, t0, t1, w, h, fmt="rgb24", fps=None, alpha_codec=None):
    """(i, frame) for every source frame from t0 to t1 (fps = the source's own, or the one asked)"""
    ch = {"rgb24": 3, "gray": 1, "rgba": 4}[fmt]
    args = ["ffmpeg", "-v", "error"]
    if alpha_codec:
        args += ["-c:v", alpha_codec]
    args += ["-ss", "%.4f" % max(0.0, t0), "-i", path, "-t", "%.4f" % max(0.01, t1 - t0)]
    vf = "scale=%d:%d:flags=area" % (w, h)
    if fps:
        vf = "fps=%.6f," % fps + vf
    args += ["-vf", vf, "-an", "-f", "rawvideo", "-pix_fmt", fmt, "-"]
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    n = w * h * ch
    i = 0
    try:
        while True:
            b = p.stdout.read(n)
            if not b or len(b) < n:
                break
            a = np.frombuffer(b, np.uint8)
            yield i, (a.reshape(h, w) if ch == 1 else a.reshape(h, w, ch))
            i += 1
    finally:
        try:
            p.stdout.close()
            p.kill()
        except Exception:  # noqa: BLE001
            pass
        p.wait()


class Writer:
    def __init__(self, path, w, h, fps, kind="vp9a", audio_from=None, crf=None, audio_range=None):
        self.w, self.h, self.kind = w, h, kind
        pix = {"vp9a": "rgba", "vp9": "rgb24", "h264": "rgb24", "gray": "gray"}[kind]
        args = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", pix, "-s", "%dx%d" % (w, h), "-r", "%.6f" % fps, "-i", "-"]
        if audio_from:                       # the clip's sound (a range of it: audio_range = (from s, length s))
            if audio_range:
                args += ["-ss", "%.4f" % audio_range[0], "-t", "%.4f" % audio_range[1]]
            args += ["-i", audio_from, "-map", "0:v:0", "-map", "1:a?"]
            args += ["-c:a", "libopus", "-b:a", "160k"] if kind != "h264" else ["-c:a", "copy"]
        if kind == "vp9a":
            args += ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", str(crf or 24),
                     "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-metadata:s:v:0", "alpha_mode=1"]
        elif kind == "vp9":
            args += ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", str(crf or 18), "-deadline", "good", "-cpu-used", "3", "-row-mt", "1"]
        elif kind == "gray":
            args += ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", str(crf or 20), "-deadline", "good", "-cpu-used", "4", "-row-mt", "1"]
        else:
            args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", str(crf or 16), "-preset", "medium", "-movflags", "+faststart"]
        args.append(path)
        self.p = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        self.n = 0

    def write(self, f):
        if self.kind == "gray" and f.ndim == 3:
            f = f[..., 0]
        self.p.stdin.write(np.ascontiguousarray(f, dtype=np.uint8).tobytes())
        self.n += 1

    def close(self):
        try:
            self.p.stdin.close()
        except Exception:  # noqa: BLE001
            pass
        err = self.p.stderr.read().decode("utf8", "replace") if self.p.stderr else ""
        code = self.p.wait()
        if code != 0:
            raise RuntimeError("ffmpeg could not write the video: " + (err.strip().splitlines() or ["?"])[-1][:300])
        return self.n
