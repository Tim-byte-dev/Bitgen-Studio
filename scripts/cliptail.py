#!/usr/bin/env python3
"""bitGen Studio — scripts/cliptail.py (2.572.0): a clip HELD UNDER THE NEXT ONE for its transition (c["tail"] seconds).

Tim: "can we have an auto transition button with number of frames input in the timeline menubar. for music videos it is
important that the lipsync is timed well ... i prefer to have a full sound clip and the video lipsync match".

The timeline's ✨ Auto transition never moves a clip (the lip sync with the song stays frame-exact): the next clip comes
in over N frames from ITS OWN start, and the clip before stays visible underneath for those N frames - its `tail`.
Before the compile, prepare() renders every clip with a tail as a file of its own:
    the clip's frames from its in point, then past its out point as far as the file goes (real frames - a "handle"),
    then its last frame held (tpad clone) for whatever is left; its sound the same way (then silence).
The clip then points at that file (in 0, out = its length + the tail), so everything after treats it as a plain clip.
Pure: plan(c, src_dur) - the numbers; filters(plan, has_audio) - the filter graph (scripts/test-autotr572.py).
"""
import json
import subprocess
from pathlib import Path

MAX_TAIL = 4.0


def plan(c, src_dur):
    """-> {start, src_end, hold, length} or None (no tail): start = the in point, src_end = where the file's own frames
    stop (out + tail, or the file's end), hold = the seconds of last frame after that, length = the new clip's length"""
    tail = min(MAX_TAIL, max(0.0, float(c.get("tail") or 0)))
    if tail <= 0:
        return None
    cin = max(0.0, float(c.get("in") or 0))
    sd = float(src_dur or 0)
    cout = float(c.get("out")) if c.get("out") else (sd if sd > 0 else None)
    if cout is None or cout <= cin:
        return None
    want = cout + tail
    src_end = min(want, sd) if sd > 0 else cout
    src_end = max(src_end, cout)
    hold = max(0.0, want - src_end)
    return {"start": round(cin, 4), "src_end": round(src_end, 4), "hold": round(hold, 4), "length": round(want - cin, 4)}


def filters(p, has_audio):
    """the filter graph: the picture (held at the end), the sound (silence at the end)"""
    v = "[0:v]setpts=PTS-STARTPTS" + (f",tpad=stop_mode=clone:stop_duration={p['hold']:.4f}" if p["hold"] > 0 else "") + "[v]"
    if not has_audio:
        return v
    a = "[0:a]asetpts=PTS-STARTPTS" + (f",apad=pad_dur={p['hold']:.4f}" if p["hold"] > 0 else "") + "[a]"
    return v + ";" + a


def _probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", str(path)],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        d = {}
    kinds = {s.get("codec_type") for s in d.get("streams") or []}
    try:
        dur = float((d.get("format") or {}).get("duration") or 0)
    except (TypeError, ValueError):
        dur = 0.0
    return {"video": "video" in kinds, "audio": "audio" in kinds, "dur": dur}


def render(c, workdir, idx, say, run):
    src = Path(c["path"])
    info = _probe(src)
    if not info["video"]:
        return c
    p = plan(c, info["dur"] or c.get("dur"))
    if not p:
        return c
    out = Path(workdir) / f"tail_{idx:03d}.mkv"
    a = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{p['start']:.4f}", "-t", f"{p['src_end'] - p['start']:.4f}", "-i", str(src),
         "-filter_complex", filters(p, info["audio"]), "-map", "[v]", "-c:v", "ffv1", "-level", "3", "-g", "1"]
    if info["audio"]:
        a += ["-map", "[a]", "-c:a", "pcm_s16le"]
    a += [str(out)]
    held = f", its last frame held {p['hold']:.2f}s" if p["hold"] > 0 else ""
    say(f"[worker] transition tail {src.name}: +{float(c.get('tail') or 0):.2f}s under the next clip "
        f"({p['src_end'] - (float(c.get('out') or p['src_end'])):.2f}s of its own frames{held}) - its start does not move")
    if run(a, echo_cmd=False) != 0 or not out.exists():
        say(f"[worker] transition tail {src.name}: could not be rendered - a plain cut there")
        return dict(c, tail=0)
    return dict(c, path=str(out), **{"in": 0.0, "out": p["length"], "dur": p["length"], "tail": 0, "tail_src": src.name})


def prepare(tl, workdir, say, run):
    """every clip with a tail on V1 and the video layers, rendered in place -> how many"""
    n = 0

    def each(lst):
        nonlocal n
        for i, c in enumerate(lst):
            if isinstance(c, dict) and float(c.get("tail") or 0) > 0 and c.get("path"):
                n += 1
                lst[i] = render(c, workdir, n, say, run)
    each(tl.get("video") or [])
    for L in tl.get("video_layers") or []:
        each(L.get("clips") or [])
    return n
