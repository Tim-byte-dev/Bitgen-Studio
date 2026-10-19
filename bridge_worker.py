#!/usr/bin/env python3
"""bitGen Studio - a BRIDGE scene drawn as a standard transition (2.358.0).

Tim: "If user clicks transition then we can do standard transitions like wipe, fade, dissolve etc from the
last frame of seg 1 to first frame of seg 3".

No model: the scene before's LAST frame and the scene after's FIRST frame, each held as a still, joined by
ffmpeg's xfade (the timeline's own catalogue, lib/transitions.json) over exactly the bridge's seconds, with the
board song's window laid under it. The size is the scene before's take (the scene after's frame is fitted
into it). Writes <output_dir>/bridge_<n>_<stamp>.mp4 and prints @@OUT.

job.json params.bridge = {xfade, type, label, seconds, prev_take, next_take, song, start, fps, width, height}
"""
import json
import os
import shutil
import subprocess
import sys
import time

def say(m):
    print(m, flush=True)

def run(args, what):
    say("@@CMD " + json.dumps(args))
    r = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        say(f"[bridge] {what} failed (ffmpeg exit {r.returncode}): " + (r.stdout or "")[-600:])
        sys.exit(2)

def probe_size(p):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=width,height", "-of", "csv=p=0:s=x", p],
                             stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30).stdout.strip()
        w, h = out.split("\n")[0].split("x")[:2]
        return int(w), int(h)
    except Exception:
        return 0, 0

def even(v):
    return max(2, int(v) // 2 * 2)

def filter_graph(xfade, seconds, w, h, fps):
    """Two held stills -> one xfade over the whole bridge (offset 0, duration = the bridge)."""
    fit = (f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,"
           f"setsar=1,fps={fps},format=yuv420p")
    return (f"[0:v]{fit}[a];[1:v]{fit}[b];"
            f"[a][b]xfade=transition={xfade}:duration={seconds:.3f}:offset=0,format=yuv420p[v]")

def main():
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    p = job.get("params") or {}
    b = p.get("bridge") or {}
    out_dir = job.get("output_dir") or "."
    os.makedirs(out_dir, exist_ok=True)
    secs = float(b.get("seconds") or 0.5)
    fps = int(b.get("fps") or 24)
    xfade = str(b.get("xfade") or "fade")
    prev, nxt = b.get("prev_take") or "", b.get("next_take") or ""
    for f, what in ((prev, "the scene before's take"), (nxt, "the scene after's take")):
        if not f or not os.path.exists(f):
            say(f"[bridge] {what} is not on disk: {f}")
            sys.exit(2)
    if not shutil.which("ffmpeg"):
        say("[bridge] ffmpeg is not on PATH")
        sys.exit(2)
    work = os.getcwd()
    last_png, first_png = os.path.join(work, "bridge_from.png"), os.path.join(work, "bridge_to.png")
    run(["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.2", "-i", prev, "-frames:v", "1", "-update", "1",
         last_png], "reading the scene before's last frame")
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "0", "-i", nxt, "-frames:v", "1", "-update", "1",
         first_png], "reading the scene after's first frame")
    w, h = probe_size(prev)
    if not (w and h):
        w, h = int(b.get("width") or 0), int(b.get("height") or 0)
    if not (w and h):
        w, h = probe_size(nxt)
    w, h = even(w or 1280), even(h or 720)
    n = int(((p.get("scene") or {}).get("n")) or 0)
    name = f"bridge_{n}_{time.strftime('%Y%m%d-%H%M%S')}.mp4"
    out = os.path.join(out_dir, name)
    hold = f"{secs + 0.2:.3f}"
    args = ["ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-t", hold, "-i", last_png,
            "-loop", "1", "-t", hold, "-i", first_png]
    song = b.get("song") or ""
    if song and os.path.exists(song):
        args += ["-ss", f"{max(0.0, float(b.get('start') or 0)):.3f}", "-t", f"{secs:.3f}", "-i", song]
        audio = ["-map", "2:a:0", "-c:a", "aac", "-b:a", "192k", "-af", "apad"]
    else:
        args += ["-f", "lavfi", "-t", f"{secs:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        audio = ["-map", "2:a:0", "-c:a", "aac", "-b:a", "128k"]
    args += ["-filter_complex", filter_graph(xfade, secs, w, h, fps), "-map", "[v]"] + audio
    args += ["-t", f"{secs:.3f}", "-r", str(fps), "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", out]
    say(f"[bridge] {b.get('label') or xfade}: {secs}s at {w}x{h} from {os.path.basename(prev)}'s last frame "
        f"to {os.path.basename(nxt)}'s first frame" + (" with the song window" if song else ""))
    run(args, "drawing the transition")
    if not os.path.exists(out):
        say("[bridge] ffmpeg wrote nothing")
        sys.exit(2)
    say("[bridge] done -> " + name)
    say("@@OUT " + name)

if __name__ == "__main__":
    main()
