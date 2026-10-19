#!/usr/bin/env python3
"""bitGen Studio — 2.388.0: APPEND / PREPEND (scripts/clipjoin.py) with REAL ffmpeg.
Run: python3 scripts/test-clipjoin.py
Tim: "add option to dropdown in reference docker video dropdown -"Append" ... take the last frame, upscale the png then
generate an i2v or fl2va video from that frame-append the video" / "prepend" the same with the first frame.
Synthetic clips: the VIDEO is red then blue (its last frame blue, its first red), the PART green then yellow."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clipjoin as CJ  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else " :: %r" % (got,)))


def run(cmd):
    return subprocess.run(cmd, capture_output=True).returncode


def two_colour(out, a, b, w, h, n_each, audio):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c={a}:s={w}x{h}:r=24:d={n_each / 24}",
           "-f", "lavfi", "-i", f"color=c={b}:s={w}x{h}:r=24:d={n_each / 24}"]
    fc = "[0:v][1:v]concat=n=2:v=1:a=0[v]"
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000:duration={2 * n_each / 24}"]
    cmd += ["-filter_complex", fc, "-map", "[v]"] + (["-map", "2:a", "-c:a", "aac"] if audio else []) \
        + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "24", str(out)]
    assert run(cmd) == 0, cmd


def frame_rgb(video, idx):
    """the mean colour of frame idx (0-based) as (r, g, b)"""
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(video), "-vf", f"select=eq(n\\,{idx}),scale=1:1:flags=area",
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return tuple(r.stdout[:3]) if len(r.stdout) >= 3 else None


def near(c, want, tol=60):
    return c is not None and all(abs(a - b) <= tol for a, b in zip(c, want))


RED, BLUE, GREEN, YELLOW = (255, 0, 0), (0, 0, 255), (0, 128, 0), (255, 255, 0)   # ffmpeg "green" = #008000
says = []
tmp = Path(tempfile.mkdtemp(prefix="cj388_"))
vid = tmp / "video.mp4"
part = tmp / "part.mp4"
two_colour(vid, "red", "blue", 320, 192, 24, True)          # 48 frames, sound
two_colour(part, "green", "yellow", 256, 160, 12, False)     # 24 frames, no sound, another size

vi, pi = CJ.probe(vid), CJ.probe(part)
check("probe: size, frames, sound", vi["w"] == 320 and vi["h"] == 192 and vi["frames"] == 48 and vi["audio"]
      and pi["frames"] == 24 and not pi["audio"], (vi, pi))

# ---- extract
last, first = tmp / "last.png", tmp / "first.png"
check("extract_cmd: the first frame = -frames:v 1, the last = -sseof -1 ... -update 1",
      "-frames:v" in CJ.extract_cmd(vid, "first", first) and "-sseof" in CJ.extract_cmd(vid, "last", last)
      and "-update" in CJ.extract_cmd(vid, "last", last))
run(CJ.extract_cmd(vid, "first", first))
run(CJ.extract_cmd(vid, "last", last))
fr = lambda p: subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(p), "-vf", "scale=1:1:flags=area", "-f", "rawvideo",
                               "-pix_fmt", "rgb24", "-"], capture_output=True).stdout[:3]
check("extract: the first frame is red, the last blue", near(tuple(fr(first)), RED) and near(tuple(fr(last)), BLUE),
      (tuple(fr(first)), tuple(fr(last))))

# ---- prepare (lanczos; and a failing ComfyUI upscale falls back to it)
op = {"op": "append", "video": str(vid), "frame": str(last), "width": 640, "height": 384, "upscaler": ""}
how = CJ.prepare(op, says.append, run)
sz = CJ.probe(last)
check("prepare: no upscaler = lanczos, the frame now the render's size (in place)", how == "lanczos" and (sz["w"], sz["h"]) == (640, 384), (how, sz))
boom = {"upload": lambda p: (_ for _ in ()).throw(RuntimeError("comfy down")), "queue": None, "wait": None, "fetch": None}
how2 = CJ.prepare(dict(op, frame=str(first), upscaler="4x_foo.pth", op="prepend"), says.append, run, boom)
check("prepare: a failed ComfyUI upscale -> lanczos, said", how2 == "lanczos" and any("failed" in s and "lanczos" in s for s in says), says[-2:])

# ---- the joins
out = tmp / "append.mp4"
r = CJ.join({"op": "append", "video": str(vid)}, part, out, says.append, run)
jo = CJ.probe(out)
check("append: video + part minus its first frame = 48 + 23 frames, at the video's size, one sound track",
      r["frames"] == 71 and jo["w"] == 320 and jo["h"] == 192 and jo["audio"], (r, jo))
check("append: the seam - frame 47 blue (the video's last), 48 green (the part's 2nd), the end yellow",
      near(frame_rgb(out, 47), BLUE) and near(frame_rgb(out, 48), GREEN) and near(frame_rgb(out, 70), YELLOW),
      (frame_rgb(out, 47), frame_rgb(out, 48), frame_rgb(out, 70)))

out = tmp / "prepend.mp4"
r = CJ.join({"op": "prepend", "video": str(vid)}, part, out, says.append, run)
check("prepend: part minus its last frame + video = 23 + 48, the seam - frame 22 yellow, 23 red, the start green",
      r["frames"] == 71 and near(frame_rgb(out, 22), YELLOW) and near(frame_rgb(out, 23), RED) and near(frame_rgb(out, 0), GREEN),
      (r, frame_rgb(out, 0), frame_rgb(out, 22), frame_rgb(out, 23)))

out = tmp / "prepend_rev.mp4"
r = CJ.join({"op": "prepend", "video": str(vid), "reverse": True}, part, out, says.append, run)
check("prepend reversed (no first-frame picture): the part backwards - starts yellow, its green start lands next to the "
      "video's red", r["frames"] == 71 and near(frame_rgb(out, 0), YELLOW) and near(frame_rgb(out, 22), GREEN)
      and near(frame_rgb(out, 23), RED), (frame_rgb(out, 0), frame_rgb(out, 22), frame_rgb(out, 23)))
check("...and says so", any("played backwards" in s for s in says), says[-1:])

c = CJ.join_cmd({"op": "prepend", "video": "v.mp4", "reverse": True}, "p.mp4", "o.mp4",
                {"w": 10, "h": 10, "frames": 24, "dur": 1, "audio": True}, {"w": 10, "h": 10, "frames": 48, "dur": 2, "audio": True})
fc = c[c.index("-filter_complex") + 1]
check("join_cmd: a reversed part's sound is silence (never the sound played backwards), one concat",
      "[1:a]" not in fc and "anullsrc" in fc and fc.count("concat=n=2") == 1 and "reverse" in fc, fc)
try:
    CJ.join({"op": "append", "video": str(tmp / "gone.mp4")}, part, tmp / "x.mp4", says.append, run)
    check("join: a missing video is refused", False)
except RuntimeError as e:
    check("join: a missing video is refused in words", "could not read" in str(e), str(e))

print("\nRESULT: %d passed, %d failed" % (P, F))
sys.exit(1 if F else 0)
