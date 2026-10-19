#!/usr/bin/env python3
"""bitGen Studio — 2.301.0: the LOSSLESS scene master (scripts/rawmaster.py),
against REAL ffmpeg. Run: python3 scripts/test-rawmaster.py

Tim (verbatim): "we create 2 separate files, 1 raw files and 1 mp4 to
playback. quality will be more important than diskspace at this stage ...
save the raw renders in project name\\raw".
  1. the taps: PreviewImage on the frames, PreviewAudio on the audio of the
     video joiner that feeds the save; none when there is no joiner;
  2. the master is LOSSLESS: every frame decodes to the exact RGB of its PNG
     (framemd5 identical), FFV1 / bgr0 / all-intra, PCM 24-bit audio;
  3. the chunk join drops the seam frame and trims exactly, still lossless;
  4. the playback mp4 (one encode) is H.264 and a different, smaller file."""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rawmaster as rm  # noqa: E402

P = F = 0
def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1; print("PASS: " + name)
    else:
        F += 1; print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:400]))

def ff(*a):
    return subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *map(str, a)], capture_output=True, text=True)

def probe(p, sel, entries):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", sel, "-show_entries",
                        entries, "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    return r.stdout.strip()

def rgb_md5s(src):
    """per-frame md5 of the decoded RGB24 pixels."""
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(src), "-map", "0:v",
                        "-pix_fmt", "rgb24", "-f", "framemd5", "-"], capture_output=True, text=True)
    return [ln.split(",")[-1].strip() for ln in r.stdout.splitlines() if ln and not ln.startswith("#")]

# ---- 1. taps -------------------------------------------------------------------
g = {"60": {"class_type": "VAEDecode", "inputs": {"samples": ["54", 0], "vae": ["12", 0]}},
     "61": {"class_type": "CreateVideo", "inputs": {"fps": 24, "images": ["60", 0], "audio": ["41", 2]}},
     "62": {"class_type": "SaveVideo", "inputs": {"video": ["61", 0], "filename_prefix": "x"}}}
g2, note, fps = rm.add_taps(g)
check("taps: PNG frames off the joiner's images, FLAC off its audio, fps read from the joiner",
      g2.get(rm.TAP_IMG) == {"class_type": "PreviewImage", "inputs": {"images": ["60", 0]},
                             "_meta": {"title": "bitGen lossless frames (PNG)"}}
      and g2[rm.TAP_AUD]["class_type"] == "PreviewAudio" and g2[rm.TAP_AUD]["inputs"] == {"audio": ["41", 2]}
      and fps == 24.0 and "node 61" in note and rm.TAP_IMG not in g, [note, fps])
two = dict(g); two["70"] = {"class_type": "CreateVideo", "inputs": {"fps": 24, "images": ["99", 0]}}
two = {"70": two["70"], **g}          # an unsaved joiner FIRST
g3, _, _ = rm.add_taps(two)
check("taps: the joiner that feeds the SAVE wins over another one", g3[rm.TAP_IMG]["inputs"]["images"] == ["60", 0])
g4, note4, _ = rm.add_taps({"1": {"class_type": "MiniMaxH3SegmentSave", "inputs": {}}})
check("taps: no joiner -> no taps, said in words", rm.TAP_IMG not in g4 and "no CreateVideo" in note4, note4)
fr, au = rm.tap_outputs({rm.TAP_IMG: {"images": [{"filename": "a"}, {"filename": "b"}]},
                         rm.TAP_AUD: {"audio": [{"filename": "s.flac"}]}, "9": {"videos": []}})
check("tap_outputs: frames in batch order + the audio item", [x["filename"] for x in fr] == ["a", "b"] and au["filename"] == "s.flac")
check("tap_outputs: nothing when the taps did not run", rm.tap_outputs({"9": {}}) == ([], None))
check("master_name: the take's stem + .avi", rm.master_name("20260924-120000_ab12.mp4") == "20260924-120000_ab12.avi")

# ---- 2-4. real ffmpeg ----------------------------------------------------------------
if not shutil.which("ffmpeg"):
    print("SKIP: ffmpeg not on PATH")
else:
    d = Path(tempfile.mkdtemp())
    try:
        ff("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-frames:v", "30", d / "%06d.png")
        ff("-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "1.25", "-c:a", "flac", d / "a.flac")
        m = d / "m.avi"
        r = subprocess.run(rm.master_cmd(d / "%06d.png", d / "a.flac", m, 24), capture_output=True, text=True)
        png_md5 = [rgb_md5s(p)[0] for p in sorted(d.glob("0*.png"))]
        m_md5 = rgb_md5s(m)
        check("master: every frame is pixel-identical to its PNG (lossless)",
              r.returncode == 0 and len(m_md5) == 30 and m_md5 == png_md5, [r.stderr[:200], len(m_md5)])
        check("master: FFV1, full RGB (bgr0), 24 fps",
              probe(m, "v:0", "stream=codec_name,pix_fmt,r_frame_rate") == "ffv1,bgr0,24/1",
              probe(m, "v:0", "stream=codec_name,pix_fmt,r_frame_rate"))
        check("master: audio is PCM 24-bit", probe(m, "a:0", "stream=codec_name") == "pcm_s24le",
              probe(m, "a:0", "stream=codec_name"))
        kf = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                             "frame=key_frame", "-of", "csv=p=0", str(m)], capture_output=True, text=True).stdout.split()
        check("master: every frame is a keyframe (frame-exact seeks and trims)", kf and all(x.startswith("1") for x in kf), kf[:5])
        # the chunk join: chunk 2 repeats chunk 1's last frame as its first (the seam)
        ff("-i", m, "-vf", "select=gte(n\\,10)", "-vsync", "0", "-af", "atrim=start=0.416667,asetpts=PTS-STARTPTS",
           *rm.ffv1_args(), *rm.pcm_args(), d / "c2.avi")
        j = d / "j.avi"
        r2 = subprocess.run(rm.join_cmd([m, d / "c2.avi"], j, 24, limit_frames=45), capture_output=True, text=True)
        jm = rgb_md5s(j)
        want = m_md5 + m_md5[11:26]      # chunk 2 minus its seam frame, capped at 45
        check("join: seam frame dropped, exact 45-frame cap, every pixel still identical",
              r2.returncode == 0 and jm == want, [r2.stderr[:200], len(jm)])
        # the playback copy: ONE lossy encode from the master
        pb = d / "p.mp4"
        r3 = subprocess.run(rm.playback_cmd(m, pb, ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
                                                   "-c:a", "aac"]), capture_output=True, text=True)
        check("playback: H.264 from the master, smaller than the master",
              r3.returncode == 0 and probe(pb, "v:0", "stream=codec_name") == "h264"
              and pb.stat().st_size < m.stat().st_size, [r3.stderr[:200]])
        check("the master and its playback copy have the same frame count",
              len(rgb_md5s(pb)) == len(m_md5))
        # ---- 2.302.0: "trim first frame" (worker._trim_head) - the master
        # loses its first frame losslessly, the take is re-encoded ONCE from it
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        import worker as W                                   # noqa: E402
        W.say = lambda *a, **k: None
        tm = d / "t.avi"; shutil.copyfile(m, tm)
        tf = d / "t.mp4"
        subprocess.run(rm.playback_cmd(tm, tf, W.enc_args("mp4", crf=16)), capture_output=True)
        W._trim_head(tf, tm, 1, "mp4")
        tmd = rgb_md5s(tm)
        adur = float(probe(tm, "a:0", "format=duration") or 0)
        check("trim first frame: the master drops EXACTLY its first frame, the rest pixel-identical (still lossless)",
              tmd == m_md5[1:] and probe(tm, "v:0", "stream=codec_name,pix_fmt") == "ffv1,bgr0", [len(tmd), len(m_md5)])
        check("trim first frame: the take is re-encoded from the trimmed master - one frame shorter, H.264",
              len(rgb_md5s(tf)) == len(m_md5) - 1 and probe(tf, "v:0", "stream=codec_name") == "h264")
        check("trim first frame: 1/24 s of audio goes with the frame",
              abs(adur - (1.25 - 1 / 24)) < 0.03, adur)
        nf = d / "n.mp4"
        subprocess.run(rm.playback_cmd(m, nf, W.enc_args("mp4", crf=16)), capture_output=True)
        W._trim_head(nf, None, 1, "mp4")
        check("trim first frame without a master: the take itself loses its first frame",
              len(rgb_md5s(nf)) == len(m_md5) - 1)
    finally:
        shutil.rmtree(d, ignore_errors=True)

print(f"\nRESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
