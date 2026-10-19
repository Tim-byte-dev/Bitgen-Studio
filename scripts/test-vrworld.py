#!/usr/bin/env python3
"""bitGen Studio — 2.368.0: VR WORLD (scripts/vr_world.py + vr_world_worker.py).
Tim: "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio references- maybe
using a 360 sbs picture as reference?" -> "lets try route 2".
  1. detect_mode: the players' name tokens, then the shape (2:1 mono 360, 1:1 TB 360, 4:1 SBS 360);
  2. the still's view (the same v360 maths as the VR swap), the paste back over the still sphere (loop, feather,
     eyes re-stacked, the render's sound), static_prompt, the auto view size;
  3. the Composer on a synthetic stereo pair: the place's own disparity, the performer found against the empty
     view, standing at the disparity of the ground at their feet, lock = the picture itself outside them;
  4. vr_world_worker.py LIVE: a TB 360 picture + a Wan performer (the stub ComfyUI) -> a 360 TB mp4 at the
     picture's size, the sound on, the spherical metadata (top-bottom) in it; the first frame fitted to the view.
Run from repo root: python3 scripts/test-vrworld.py"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import vr_swap as VR  # noqa: E402
import vr_world as VW  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


# 1
check("detect: name tokens (_360_TB, _180_LR / SBS, 360 LR) are sure",
      VW.detect_mode("beach_360_TB.jpg", 4096, 4096) == ("tb360", True)
      and VW.detect_mode("room_180_sbs.png", 8192, 4096) == ("sbs180", True)
      and VW.detect_mode("hall_360_LR.jpg", 8192, 2048) == ("sbs360", True))
check("detect: the shape when the name says nothing (1:1 TB, 4:1 SBS 360, 2:1 mono 360) - not sure",
      VW.detect_mode("a.jpg", 4096, 4096) == ("tb360", False) and VW.detect_mode("a.jpg", 8192, 2048) == ("sbs360", False)
      and VW.detect_mode("a.jpg", 8192, 4096) == ("mono360", False) and VW.detect_mode("a.jpg", 1920, 1080) == ("", False))
check("sbs360 is a VR mode now (stereo sbs, full equirect per eye, _360_LR)",
      VR.MODES["sbs360"] == {"stereo": "sbs", "proj": "e", "suffix": "_360_LR"} and VR.eye_size("sbs360", 8192, 2048) == (4096, 2048))

# 2
v = {"yaw": 30, "pitch": -10, "fov": 70, "shape": "1:1"}
a = VW.still_view_args("w.jpg", "l.png", "tb360", "R", v, 512, 512)
check("still_view_args: the RIGHT eye's crop + the v360 flat view, one frame",
      a[a.index("-vf") + 1].startswith("crop=iw:ih/2:0:ih/2,v360=input=e:output=flat:yaw=30.0:pitch=-10.0:h_fov=70.0")
      and a[-3:] == ["-frames:v", "1", "l.png"], a)
p = VW.paste_still_args("w.jpg", "tb360", v, "L.mp4", "R.mp4", "m.png", "o.mp4", 4096, 4096, 512, 512, 48,
                        ["-c:v", "libx264"], audio_src="perf.mp4")
fc = p[p.index("-filter_complex") + 1]
check("paste_still_args: the still LOOPED for the clip's length, both eyes through the exact inverse, vstack, the render's sound",
      p[p.index("-loop") + 1] == "1" and p[p.index("-t") + 1] == "2.0000" and "vstack=inputs=2" in fc
      and "v360=input=flat:output=e" in fc and "alphamerge" in fc and "4:a:0?" in p and "+faststart" not in p
      and p[p.index("-frames:v") + 1] == "48", p)
check("static_prompt: the camera locked once (a prompt that already says so is left alone)",
      VW.static_prompt("She sings.").endswith("Static camera: the camera does not move, the background stays exactly as in the first frame.")
      and VW.static_prompt("Static camera. She sings.") == "Static camera. She sings.")
check("view_short_side_for: matches the sphere's sharpness (8K mono, 70°: ~1088 cap; 2K mono, 70°: 384 floor) on 16",
      VW.view_short_side_for("mono360", 8192, 4096, 70, "1:1") == 1088 and VW.view_short_side_for("mono360", 2048, 1024, 70, "1:1") == 384
      and VW.view_short_side_for("tb360", 4096, 4096, 60, "16:9") % 16 == 0)

# 3
try:
    import cv2
    import numpy as np
    HAVE_CV = True
except ImportError:
    HAVE_CV = False
    print("(OpenCV missing - the compositor checks are skipped)")
if HAVE_CV:
    rng = np.random.default_rng(3)
    H = W = 256
    tex = cv2.GaussianBlur((rng.random((H, W + 64, 3)) * 255).astype(np.uint8), (3, 3), 0)
    bl, br = tex[:, :W].copy(), tex[:, 6:6 + W].copy()           # the place 6 px of disparity everywhere
    comp = VW.Composer(bl, br, lock=True)
    check("Composer: the place's own disparity from the picture's pair (6 px)", abs(float(np.median(comp.bg_d[:, 40:200])) - 6) < 0.6,
          float(np.median(comp.bg_d)))
    fr = bl.copy()
    fr[100:220, 100:140] = (0, 0, 255)                              # the performer, a red card
    for _ in range(3):
        left, right = comp.eyes(fr)
    red = lambda im: np.where((im[:, :, 2] > 200) & (im[:, :, 0] < 60) & (im[:, :, 1] < 60))  # noqa: E731
    rc, lc = red(right)[1], red(left)[1]
    check("...the performer is found (~7% of the view) and stands at the ground's disparity at their feet (6)",
          0.04 < comp.last_area < 0.2 and abs(comp.foot - 6) < 0.6, (comp.last_area, comp.foot))
    check("...the right eye shows them shifted by that disparity (100-139 -> 94-133), the left eye untouched",
          lc.min() == 100 and lc.max() == 139 and abs(rc.min() - 94) <= 1 and abs(rc.max() - 133) <= 1, (lc.min(), lc.max(), rc.min(), rc.max()))
    check("...lock: outside the performer the right eye IS the picture's right view", float(np.abs(right[:60].astype(int) - br[:60].astype(int)).mean()) < 0.5)
    mono = VW.Composer(bl, None, lock=False)
    l2, r2 = mono.eyes(fr)
    check("Composer mono: one eye, the frame as rendered", r2 is None and np.array_equal(l2, fr))
    empty = VW.Composer(bl, br)
    empty.eyes(bl.copy())
    check("...an empty frame (nothing differs from the view): no performer", empty.last_area == 0.0)

# 4 LIVE
T = Path(tempfile.mkdtemp(prefix="vrw368_"))
models = T / "models"
(models / "diffusion_models").mkdir(parents=True)
(models / "diffusion_models" / "wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors").write_bytes(b"x")
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / "cout")],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    world = T / "plaza_360_TB.jpg"
    # a TB 360 still: the left eye on top, the right eye (the same place, shifted) below
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1024x512",
                    "-filter_complex", "[0:v]split=2[a][b];[b]crop=iw-8:ih:8:0,pad=iw+8:ih:0:0[c];[a][c]vstack=inputs=2",
                    "-frames:v", "1", str(world)], check=True)
    first = T / "first.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:size=600x400", "-frames:v", "1", str(first)], check=True)
    song = T / "song.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "6", str(song)], check=True)
    jd = T / "job"
    jd.mkdir()
    render = {"mode": "wan", "wan_family": "wan21", "wan_mode": "i2v", "prompt": "she waves", "frames": 17, "seed": 3,
              "images": {}, "audio": {"path": str(song), "start": 1.0}, "video_style": {"name": "Wan 2.1", "phases": [{}]}}
    job = {"params": {"mode": "vrworld", "world": str(world), "vr_mode": "tb360",
                      "view": {"yaw": 20, "pitch": 0, "fov": 70, "shape": "1:1"}, "short_side": 256, "lock": False,
                      "first_frame": str(first), "render": render},
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "vr_world_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=300)
    outs = [x[6:] for x in r.stdout.splitlines() if x.startswith("@@OUT ")]
    vid = jd / "out" / outs[0] if outs else None
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", str(vid)],
                                   capture_output=True, text=True).stdout or "{}") if vid and vid.is_file() else {}
    vs = [x for x in pr.get("streams") or [] if x.get("codec_type") == "video"]
    check("LIVE: one @@OUT <stem>_vrworld_360_TB.mp4 at the picture's 1024x1024, with the song",
          r.returncode == 0 and len(outs) == 1 and outs[0].endswith("_vrworld_360_TB.mp4") and vs and (vs[0]["width"], vs[0]["height"]) == (1024, 1024)
          and any(x.get("codec_type") == "audio" for x in pr.get("streams") or []), (r.returncode, r.stdout[-2000:], pr))
    xml = VR.read_spherical(vid) if vid and vid.is_file() else ""
    check("...the spherical metadata says equirectangular, top-bottom", "equirectangular" in xml and "top-bottom" in xml, xml[:200])
    check("...the performer ran through wan_worker.py in its own folder, its log passed on as [performer] lines, its @@OUT kept out",
          (jd / "performer" / "job.json").is_file() and "[performer] [worker] wan_worker.py family=wan21 mode=i2v" in r.stdout
          and sum(1 for x in r.stdout.splitlines() if x.startswith("@@OUT")) == 1, r.stdout[-1500:])
    sub = json.loads((jd / "performer" / "job.json").read_text())["params"]
    check("...the performer job: the view's 256x256, the fitted first frame as its start, the camera locked in the prompt",
          sub["width"] == 256 and sub["height"] == 256 and sub["images"]["start"].endswith("first_frame.png")
          and "Static camera" in sub["prompt"], sub)
    fw = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(jd / "first_frame.png")],
                        capture_output=True, text=True).stdout.strip()
    check("...the 600x400 first frame was fitted to the view (256x256)", fw == "256,256", fw)
    check("...the log: the world, the aim, both eyes, back onto the picture, the metadata",
          "VR World: plaza_360_TB.jpg (1024x1024, tb360, one eye 1024x512)" in r.stdout and "VR eyes:" in r.stdout
          and "back onto the 1024x1024 picture" in r.stdout and "spherical metadata written" in r.stdout, r.stdout[-1500:])
    bad = dict(job)
    bad["params"] = dict(job["params"], vr_mode="cube")
    (jd / "bad.json").write_text(json.dumps(bad))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "vr_world_worker.py"), str(jd / "bad.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=60)
    check("an unknown VR type: refused in words", r.returncode != 0 and "unknown VR type 'cube'" in r.stdout, r.stdout[-300:])
finally:
    stub.kill()
    stub.wait()
    shutil.rmtree(T, ignore_errors=True)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
