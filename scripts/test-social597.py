#!/usr/bin/env python3
"""bitGen Studio — scripts/test-social597.py (2.597.0): the 📤 Export preset "MP4 · Social media" (scripts/social.py +
scripts/deliver.py), REAL encodes with ffmpeg.

Tim: "is there a video format we can use for social media like facebook, our mp4 and avi files are rejected" then "yes
please build the preset".
  pure      fps_for (same fps over 60 -> 30, odd -> the nearest normal, 29.97 kept), level_for, maxrate_for, args (High,
            8-bit, cfr, keyframes every 2 s, faststart, avc1, no metadata, AAC-LC 48 kHz stereo; a silent track's map),
            atoms_faststart, verdict
  real      a 3840x2160 "4K" master at 75 fps with sound, an exported 9:16 Reel, 4:5 feed, 1:1 and 16:9: H.264 High
            8-bit, the short side 1080, even, 30 fps steady, AAC 48 kHz stereo, faststart, no timecode track - the check
            says ready; a master with NO sound gets a silent AAC track; the old H.264 export (timecode) still made
  page      lib/exportPresets.json lists it; the dialog's social pack uses it (9:16 · 4:5 · 1:1 · 16:9) with a quality
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import social as S  # noqa: E402
import deliver as D  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:900]))


check("fps_for: same fps 75 -> 30, 47 -> 50, 29.97 kept, 23.976 kept, 25 kept, asked 60 -> 60",
      S.fps_for("source", 75) == 30 and S.fps_for("source", 47) == 50 and S.fps_for("source", 29.97) == 29.97
      and S.fps_for("source", 23.976) == 23.976 and S.fps_for("source", 25) == 25 and S.fps_for("60", 30) == 60)
check("level_for: 720p30 3.1, 1080p30 4.1, 1080p60 4.2", S.level_for(1280, 720, 30) == "3.1" and S.level_for(1080, 1920, 30) == "4.1" and S.level_for(1920, 1080, 60) == "4.2")
check("maxrate_for: 1080p 8 (high 12), 720p 5, small 2.5 Mb/s", S.maxrate_for(1080, 1920, 1) == 8 and S.maxrate_for(1080, 1920, 0) == 12 and S.maxrate_for(1280, 720, 1) == 5 and S.maxrate_for(640, 360, 2) == 2.5)
a = S.args(1080, 1920, 30.0, 1, True)
j = " ".join(a)
check("args: libx264 High 4.1 yuv420p, -r 30 cfr, keyframes every 60 frames, Rec.709, avc1, faststart, no metadata / chapters, AAC-LC 160k 48 kHz stereo from 0:a",
      "-c:v libx264" in j and "-profile:v high -level:v 4.1 -pix_fmt yuv420p" in j and "-r 30 -fps_mode cfr -g 60" in j and "-colorspace bt709" in j
      and "-tag:v avc1 -movflags +faststart -map_metadata -1 -map_chapters -1" in j and "-map 0:a:0 -c:a aac -profile:a aac_low -b:a 160k -ar 48000 -ac 2" in j
      and "-maxrate 8M -bufsize 16M" in j and "-shortest" not in j, j)
j2 = " ".join(S.args(1920, 1080, 29.97, 2, False, "-vsync"))
check("args without sound: the silent track 1:a, -shortest; an old ffmpeg's -vsync", "-map 1:a:0" in j2 and "-shortest" in j2 and "-r 29.97 -vsync cfr" in j2, j2)
v = S.verdict({"streams": [{"codec_type": "video", "codec_name": "h264", "profile": "High 10", "pix_fmt": "yuv420p10le", "width": 1080, "height": 1920, "r_frame_rate": "30/1", "avg_frame_rate": "30/1"},
                           {"codec_type": "audio", "codec_name": "opus", "sample_rate": "48000", "channels": 2}], "format": {"duration": "120"}}, 1000, False, "9:16")
check("verdict: 10-bit, Opus, no faststart = NOT ready, each named; a 120 s 9:16 gets the Reel note",
      not v["ok"] and "profile High 10" in v["summary"] and "sound AAC (opus)" in v["summary"] and "faststart" in v["summary"] and any("Reel" in n for n in v["notes"]), v)

if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
    print("SKIP: no ffmpeg here - the real encodes did not run")
else:
    tmp = Path(tempfile.mkdtemp(prefix="bg-social597-"))
    try:
        master = tmp / "film.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=3840x2160:r=75:d=3", "-f", "lavfi", "-i", "sine=f=440:r=44100:d=3",
                        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv444p", "-c:a", "aac", "-ac", "1", "-shortest", str(master)], check=True)
        said = []

        def run(cmd, echo_cmd=True):
            return subprocess.run(cmd, capture_output=True, text=True).returncode
        tl = {"deliver": [{"preset": "social", "aspect": "9:16", "size": "1080", "fit": "blur", "fps": "source", "quality": "standard", "name": "social_9x16_1080p"},
                          {"preset": "social", "aspect": "4:5", "size": "source", "fit": "crop", "fps": "source", "quality": "small", "name": "social_4x5"},
                          {"preset": "social", "aspect": "1:1", "size": "1080", "fit": "crop", "fps": "source", "quality": "high", "name": "social_1x1_1080p"},
                          {"preset": "social", "aspect": "16:9", "size": "720", "fit": "pad", "fps": "source", "quality": "standard", "name": "social_16x9_720p"},
                          {"preset": "h264", "aspect": "source", "size": "source", "fit": "crop", "fps": "source", "quality": "standard", "name": "h264"}],
              "tc": {"start": "01:00:00:00", "fps": 25}}
        made = D.finish(master, tl, said.append, run)
        check("five made (4 social + the plain H.264)", len(made) == 5, {"made": made, "said": said[-12:]})
        want = {"social_9x16_1080p": (1080, 1920), "social_4x5": (1080, 1350), "social_1x1_1080p": (1080, 1080), "social_16x9_720p": (1280, 720)}
        for name, wh in want.items():
            f = tmp / f"film_{name}.mp4"
            pr = S.probe(f)
            vs = next((s for s in pr.get("streams", []) if s.get("codec_type") == "video"), {})
            au = next((s for s in pr.get("streams", []) if s.get("codec_type") == "audio"), {})
            kinds = [s.get("codec_type") for s in pr.get("streams", [])]
            ck = S.check(f, name.split("_")[1].replace("x", ":"))
            check(f"{name}: {wh[0]}x{wh[1]} H.264 High 8-bit 30 fps steady (the 75 fps 4K 4:4:4 master), AAC 48 kHz stereo (from 44.1 kHz mono), faststart, no timecode / data track - the check says ready",
                  (vs.get("width"), vs.get("height")) == wh and vs.get("codec_name") == "h264" and vs.get("profile") == "High" and vs.get("pix_fmt") == "yuv420p"
                  and vs.get("r_frame_rate") == "30/1" and au.get("codec_name") == "aac" and au.get("sample_rate") == "48000" and au.get("channels") == 2
                  and kinds == ["video", "audio"] and S.atoms_faststart(f) and ck["ok"], {"v": vs, "a": au, "kinds": kinds, "check": ck["summary"]})
        check("the log says each check (ready for Facebook / Instagram / TikTok)", sum(1 for s in said if "social check: ready for Facebook / Instagram / TikTok" in s) == 4, said[-14:])
        silent = tmp / "quiet.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=24:d=2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(silent)], check=True)
        said.clear()
        made2 = D.finish(silent, {"deliver": [{"preset": "social", "aspect": "9:16", "size": "source", "fit": "pad", "fps": "source", "quality": "standard", "name": "social_9x16"}]}, said.append, run)
        f2 = tmp / "quiet_social_9x16.mp4"
        pr2 = S.probe(f2)
        au2 = next((s for s in pr2.get("streams", []) if s.get("codec_type") == "audio"), {})
        dur = float(pr2.get("format", {}).get("duration") or 0)
        vs2 = next((s for s in pr2.get("streams", []) if s.get("codec_type") == "video"), {})
        check("a master with NO sound: a silent AAC 48 kHz stereo track, the length kept (-shortest), 720x1280 at 24 fps",
              made2 == ["quiet_social_9x16.mp4"] and au2.get("codec_name") == "aac" and au2.get("channels") == 2 and 1.9 < dur < 2.3
              and (vs2.get("width"), vs2.get("height")) == (720, 1280) and vs2.get("r_frame_rate") == "24/1", {"a": au2, "dur": dur, "v": vs2, "said": said})
        check("atoms_faststart: an ordinary ffmpeg MP4 (no faststart) = False", not S.atoms_faststart(silent))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

presets = json.loads((ROOT / "lib" / "exportPresets.json").read_text(encoding="utf-8"))
sp = next((p for p in presets["presets"] if p["id"] == "social"), {})
dl = (ROOT / "ext" / "timelinedock" / "deliver.js").read_text(encoding="utf-8")
check("lib/exportPresets.json lists MP4 · Social media (mp4, video + sound); the dialog's social pack = 9:16 blur, 4:5, 1:1, 16:9 with it, a quality pick",
      sp.get("ext") == "mp4" and sp.get("video") and sp.get("audio") and "Social media" in sp.get("label", "")
      and '{ preset: "social", aspect: "9:16", size: "1080", fit: "blur" }' in dl and '{ preset: "social", aspect: "4:5", size: "1080", fit: "crop" }' in dl
      and "webm|social)$/" in dl)
print(f"\n{P} passed, {F} failed")
print("RESULT: FAIL" if F else "RESULT: PASS")
sys.exit(1 if F else 0)
