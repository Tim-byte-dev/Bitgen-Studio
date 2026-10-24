#!/usr/bin/env python3
"""bitGen Studio - a KARAOKE OVERLAY: the lyrics + a bouncing ball on a TRANSPARENT video (2.373.0).

Tim: "when the video renders, render another video with transparent background with the kareoke lyrics that can
be added as an overlay layer in timeline - first render of the scene won't have the kareoke lyrics".

No model, ffmpeg only. The scene's take stays exactly as rendered; this draws its lyrics (scripts/karaoke_ass.py)
onto a fully transparent canvas the size and length of the take and writes a VP9 webm WITH ALPHA
(yuva420p, alpha_mode=1) - the browser plays it see-through and the timeline compile decodes its alpha
(worker.py reads alpha webm through libvpx-vp9). Writes <output_dir>/<name>_<stamp>.webm and prints @@OUT.

job.json params.karaoke = {words:[{text,line,start,end}], width, height, dur, fps, name, scene, song, window}
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import karaoke_ass  # noqa: E402


def say(m):
    print(m, flush=True)


def ff_path(p):
    """A path inside an ffmpeg filter string: / separators, ':' and quotes escaped (C:\\x -> C\\:/x)."""
    return str(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def even(v):
    return max(2, int(v) // 2 * 2)


def _hex(c, fb):
    s = str(c or "").strip().lstrip("#")
    return "0x" + s if len(s) == 6 and all(x in "0123456789abcdefABCDEF" for x in s) else fb


def band_filters(style, W, H):
    """2.380.0: the karaoke style's BACKGROUND BAND under the lyrics, drawn on the transparent canvas before the text:
    its soft box shadow (a darker band, blurred), the band (colour at its opacity), its top / bottom border lines.
    Returns a filter chain prefix ending in ',' ('' when the background is off)."""
    st = karaoke_ass.style_of({"style": style})
    op = max(0.0, min(100.0, float(st["bg_opacity"]))) / 100.0
    if op <= 0:
        return ""
    G = karaoke_ass.geometry(W, H, {"style": style})
    top, bh = max(0, int(G["band_top"])), max(2, int(G["band_h"]))
    col = _hex(st["bg_color"], "0x000000")
    out = ""
    bs = max(0, int(st["box_shadow"]))
    if bs:
        out += (f"split[kb0][kb1];[kb1]drawbox=x=0:y={top + bs // 2}:w=iw:h={bh}:color=black@{min(1.0, op + 0.25):.3f}"
                f":t=fill:replace=1,gblur=sigma={max(1, bs / 2):.1f}[kbs];[kb0][kbs]overlay=format=auto,")
    out += f"drawbox=x=0:y={top}:w=iw:h={bh}:color={col}@{op:.3f}:t=fill:replace=1,"
    bw = max(0, int(st["bg_border_width"]))
    if bw:
        bcol = _hex(st["bg_border_color"], "0xffffff")
        out += (f"drawbox=x=0:y={top}:w=iw:h={bw}:color={bcol}@1:t=fill:replace=1,"
                f"drawbox=x=0:y={max(0, top + bh - bw)}:w=iw:h={bw}:color={bcol}@1:t=fill:replace=1,")
    return out


def main():
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    p = job.get("params") or {}
    k = p.get("karaoke") or {}
    out_dir = job.get("output_dir") or "."
    os.makedirs(out_dir, exist_ok=True)
    words = [w for w in (k.get("words") or []) if str(w.get("text") or "").strip()]
    if not words:
        say("[karaoke] no lyrics fall inside this scene's part of the song - nothing to draw")
        sys.exit(2)
    W, H = even(k.get("width") or 1280), even(k.get("height") or 720)
    fps = int(k.get("fps") or 24)
    dur = max(0.2, float(k.get("dur") or 5))
    style = k.get("style") or {}                       # 2.380.0: the karaoke style (lib/karaokeStyle.js)
    ass, fonts = karaoke_ass.build(words, W, H, {"dur": dur, "style": style})
    ass_file = Path.cwd() / "karaoke.ass"
    ass_file.write_text(ass, encoding="utf-8")
    name = "".join(c if c.isalnum() or c in "._-" else "_" for c in str(k.get("name") or "karaoke"))
    out = Path(out_dir) / f"{name}_{time.strftime('%Y%m%d_%H%M%S')}.webm"
    say(f"[karaoke] {len(words)} word(s), {W}x{H}, {dur:.2f}s"
        + (f" - scene {k.get('scene')}" if k.get("scene") else "")
        + (f", song window {k.get('window')}" if k.get("window") else ""))
    sub = f"subtitles='{ff_path(ass_file)}':alpha=1"
    if fonts:
        sub += f":fontsdir='{ff_path(fonts)}'"
    fc = band_filters(style, W, H) + sub
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", f"color=c=black@0.0:s={W}x{H}:r={fps}:d={dur:.3f},format=rgba",
            "-filter_complex", "[0:v]" + fc + "[v]", "-map", "[v]", "-an",
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
            "-b:v", "0", "-crf", "32", "-deadline", "good", "-cpu-used", "4",
            "-metadata:s:v:0", "alpha_mode=1", str(out)]
    say("@@CMD " + json.dumps(args))
    r = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0 or not out.exists():
        say(f"[karaoke] ffmpeg could not draw the lyrics (exit {r.returncode}): " + (r.stdout or "")[-600:])
        sys.exit(2)
    say("@@OUT " + out.name)
    say(f"[karaoke] transparent lyrics overlay -> {out.name}")


if __name__ == "__main__":
    main()
