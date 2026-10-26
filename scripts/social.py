"""bitGen Studio — scripts/social.py (2.597.0): the 📤 Export preset "MP4 · Social media" - a file Facebook, Instagram
and TikTok take as it is - and the CHECK of the file made.

Tim (verbatim): "is there a video format we can use for social media like facebook, our mp4 and avi files are rejected"
then "yes please build the preset".

What the sites take without a fuss (their upload guides): MP4 with H.264 + AAC stereo; 30 fps is the safe default;
1080 px on the short side (feed 4:5 1080x1350, Reels / Stories 9:16 1080x1920, 1:1, 16:9); up to 4 GB. So the preset:
  video   libx264, profile High, level 4.1 (4.2 above 30 fps), 8-bit yuv420p, Rec.709 tagged (tv range), a STEADY frame
          rate (fps_mode cfr - "same fps" above 60 becomes 30, an odd rate the nearest of 24 / 25 / 30 / 50 / 60; 23.976
          and 29.97 stay), a keyframe every 2 s, CRF with a ceiling (maxrate - 8 Mb/s at 1080p, 5 at 720p, 2.5 below;
          "high" a little more) so a file never balloons, the short side 1080 at most, even sizes
  audio   AAC-LC 48 kHz stereo (192 / 160 / 128 kb/s by quality); a movie with no sound gets a silent track (some
          uploaders refuse a video without one)
  file    +faststart (the index first - needed to play while it uploads), avc1 tag, no timecode track, no metadata or
          chapters carried over (the master's own tags stay out)
check(path) after the encode: what the sites look at, each line ok or not, plus notes (a 9:16 longer than 90 s may
post as a plain video instead of a Reel; over 4 GB is refused; very long). Pure: level_for, fps_for, maxrate_for,
args, atoms_faststart (a file's top-level boxes), verdict(probe, size, faststart, aspect).
"""
import json
import subprocess
from pathlib import Path

CRF = (18, 21, 24)                      # high, standard, small
ABR = ("192k", "160k", "128k")
SAFE_FPS = (24, 25, 30, 50, 60)


def fps_for(want, src):
    """the frame rate the file is made at: "source" keeps the movie's when it is a normal one"""
    if want and want != "source":
        return float(want)
    s = float(src or 30)
    if s > 60.5:
        return 30.0
    for f in (23.976, 29.97, 59.94):
        if abs(s - f) < 0.01:
            return f
    return float(min(SAFE_FPS, key=lambda f: abs(f - s)))


def level_for(w, h, fps):
    """the H.264 level: 4.1 covers 1080p30, 4.2 1080p60; small frames 3.1"""
    if w * h <= 1280 * 720 and fps <= 30:
        return "3.1"
    return "4.2" if fps > 30.5 else "4.1"


def maxrate_for(w, h, q):
    """the bitrate ceiling (Mb/s) - the CRF picks the quality, this keeps the size sane"""
    px = w * h
    base = 8.0 if px > 1280 * 720 else 5.0 if px > 854 * 480 else 2.5
    return base * (1.5 if q == 0 else 1.0)


def args(w, h, fps, q, has_audio, fps_mode="-fps_mode"):
    """the ffmpeg output args after the video filter's -map [v] (the audio input: 0:a, else 1:a = the silent track)"""
    rate = maxrate_for(w, h, q)
    fr = ("%.3f" % fps).rstrip("0").rstrip(".")
    a = ["-c:v", "libx264", "-preset", "medium", "-crf", str(CRF[q]), "-maxrate", "%gM" % rate, "-bufsize", "%gM" % (rate * 2),
         "-profile:v", "high", "-level:v", level_for(w, h, fps), "-pix_fmt", "yuv420p",
         "-r", fr, fps_mode, "cfr", "-g", str(int(round(fps * 2))), "-bf", "2",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
         "-tag:v", "avc1", "-movflags", "+faststart", "-map_metadata", "-1", "-map_chapters", "-1"]
    a += ["-map", "0:a:0" if has_audio else "1:a:0", "-c:a", "aac", "-profile:a", "aac_low", "-b:a", ABR[q], "-ar", "48000", "-ac", "2"]
    if not has_audio:
        a += ["-shortest"]
    return a


_fpsm = None


def fps_mode_flag():
    """ffmpeg 5.1+ says -fps_mode; older ones -vsync"""
    global _fpsm
    if _fpsm is None:
        try:
            r = subprocess.run(["ffmpeg", "-hide_banner", "-h", "full"], capture_output=True, text=True, timeout=30)
            _fpsm = "-fps_mode" if "-fps_mode" in (r.stdout or "") else "-vsync"
        except (OSError, subprocess.SubprocessError):
            _fpsm = "-fps_mode"
    return _fpsm


def atoms_faststart(path):
    """True when the MP4's index (moov) comes before its media (mdat) - read from the top-level boxes"""
    try:
        with open(path, "rb") as fh:
            pos = 0
            while True:
                fh.seek(pos)
                hd = fh.read(16)
                if len(hd) < 8:
                    return False
                size = int.from_bytes(hd[0:4], "big")
                kind = hd[4:8].decode("latin-1")
                if kind == "moov":
                    return True
                if kind == "mdat":
                    return False
                if size == 1:
                    size = int.from_bytes(hd[8:16], "big")
                elif size == 0:
                    return False
                if size < 8:
                    return False
                pos += size
    except OSError:
        return False


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels"
                        ":format=duration,format_name", "-of", "json", str(path)], capture_output=True, text=True)
    try:
        return json.loads(r.stdout or "{}")
    except ValueError:
        return {}


def _rate(s):
    try:
        a, b = str(s or "0/1").split("/")
        return float(a) / float(b or 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


def verdict(pr, size, faststart, aspect="source"):
    """-> {ok, lines: [(ok, words)], notes: [words], summary}"""
    st = pr.get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    a = next((s for s in st if s.get("codec_type") == "audio"), {})
    dur = float((pr.get("format") or {}).get("duration") or 0)
    w, h = int(v.get("width") or 0), int(v.get("height") or 0)
    rf, af = _rate(v.get("r_frame_rate")), _rate(v.get("avg_frame_rate"))
    lines = [
        (v.get("codec_name") == "h264", "video H.264 (%s)" % (v.get("codec_name") or "none")),
        (str(v.get("profile") or "") in ("High", "Main", "Constrained Baseline", "Baseline"), "profile %s, 8-bit" % (v.get("profile") or "?")),
        (v.get("pix_fmt") == "yuv420p", "colour format %s" % (v.get("pix_fmt") or "?")),
        (w > 0 and h > 0 and w % 2 == 0 and h % 2 == 0 and min(w, h) <= 1080, "%dx%d" % (w, h)),
        (0 < rf <= 60.5 and (af == 0 or abs(rf - af) < 0.05), "%.3g fps, steady" % rf if abs(rf - af) < 0.05 or not af else "%.3g fps (varies: %.3g)" % (rf, af)),
        (a.get("codec_name") == "aac", "sound AAC (%s)" % (a.get("codec_name") or "none")),
        (str(a.get("sample_rate") or "") in ("48000", "44100") and int(a.get("channels") or 0) in (1, 2), "%s Hz, %s channel(s)" % (a.get("sample_rate") or "?", a.get("channels") or "?")),
        (bool(faststart), "faststart (the index first)"),
        (0 < size <= 4 * 1024 ** 3, "%.1f MB (4 GB at most)" % (size / 1048576.0)),
    ]
    notes = []
    if aspect == "9:16" and dur > 90:
        notes.append("%.0f s long - Facebook / Instagram may post a 9:16 over 90 s as a plain video instead of a Reel" % dur)
    if dur > 240 * 60:
        notes.append("over 4 hours - Facebook takes about 240 minutes at most")
    ok = all(x for x, _ in lines)
    summary = ("ready for Facebook / Instagram / TikTok" if ok else "NOT ready: " + ", ".join(t for x, t in lines if not x))
    return {"ok": ok, "lines": lines, "notes": notes, "summary": summary, "duration": dur}


def check(path, aspect="source"):
    p = Path(path)
    return verdict(probe(p), p.stat().st_size if p.exists() else 0, atoms_faststart(p), aspect)
