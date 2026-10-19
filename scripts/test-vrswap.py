#!/usr/bin/env python3
"""Unit tests for scripts/vr_swap.py (2.330.0, the character swap in VR
video): the view maths, the v360 round trip (flat -> sphere is the exact
inverse), the feather mask, the codec pick, the whole VR paste on real
synthetic TB-360 and SBS-180 stereo clips, the right eye re-projected
through the ORIGINAL depth, and the spherical metadata box.
Run: python3 scripts/test-vrswap.py"""
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import vr_swap as V  # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    return r.returncode == 0, r.stderr[-400:]


# ---- the maths
check("eye_size: TB halves the height, SBS the width, mono keeps the frame",
      V.eye_size("tb360", 4096, 4096) == (4096, 2048) and V.eye_size("sbs180", 5760, 2880) == (2880, 2880)
      and V.eye_size("mono360", 3840, 1920) == (3840, 1920))
check("eye_crop: top / bottom, left / right halves; mono none",
      V.eye_crop("tb360", "R") == "crop=iw:ih/2:0:ih/2" and V.eye_crop("sbs180", "L") == "crop=iw/2:ih:0:0"
      and V.eye_crop("mono360", "L") == "")
check("view_size: the shape at the short side, 16-aligned",
      V.view_size(544, "1:1") == (544, 544) and V.view_size(544, "9:16") == (544, 960)
      and V.view_size(720, "16:9") == (1280, 720))
check("vfov: a square view's vertical fov = its horizontal one; 16:9 at 90 -> 58.7",
      abs(V.vfov(70, 512, 512) - 70) < 1e-6 and abs(V.vfov(90, 1600, 900) - 58.72) < 0.01)
cv = V.clamp_view({"yaw": 270, "pitch": 120, "fov": 5, "shape": "x"})
check("clamp_view: yaw wraps into -180..180, pitch <= 85, fov >= 20, a junk shape = 1:1",
      cv == {"yaw": -90.0, "pitch": 85.0, "fov": 20.0, "shape": "1:1"}, cv)
check("flat_vf: the left eye cut then v360 to a flat view at the aim",
      V.flat_vf("sbs180", "L", {"yaw": 30, "pitch": 10, "fov": 70}, 512, 512)
      == "crop=iw/2:ih:0:0,v360=input=hequirect:output=flat:yaw=30.0:pitch=10.0:h_fov=70.0:v_fov=70.0000:w=512:h=512")
check("sphere_vf: the inverse (yaw -Y, pitch -P, rotation order pyr)",
      V.sphere_vf("tb360", {"yaw": 40, "pitch": 15, "fov": 70}, 512, 512, 2048, 1024)
      == "v360=input=flat:output=e:ih_fov=70.0:iv_fov=70.0000:w=2048:h=1024:yaw=-40.0:pitch=-15.0:rorder=pyr")
check("codec_args: H.265 above 4K (when there), else H.264",
      "libx265" in V.codec_args(7680, 3840, True) and "hvc1" in V.codec_args(7680, 3840, True)
      and "libx264" in V.codec_args(7680, 3840, False) and "libx264" in V.codec_args(3840, 1920, True))
check("num_disparities: ~15% of the width, a multiple of 16", V.num_disparities(544) == 96 and V.num_disparities(100) == 16)
check("MODES: the players' name suffixes", [V.MODES[m]["suffix"] for m in ("mono360", "tb360", "sbs180")]
      == ["_360", "_360_TB", "_180_LR"])

if not shutil.which("ffmpeg"):
    print("  (ffmpeg not on PATH - the real VR checks are skipped)")
else:
    import numpy as np
    import cv2
    with tempfile.TemporaryDirectory() as td:
        t = Path(td)
        # ---- the v360 round trip, both projections
        eq = t / "eq.png"
        run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1024x512", "-frames:v", "1", str(eq)])
        for proj, mode, src_w, src_h in (("e", "mono360", 1024, 512), ("hequirect", "sbs180", 512, 512)):
            srcp = eq if proj == "e" else t / "he.png"
            if proj != "e":
                run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(eq), "-vf", "v360=input=e:output=hequirect:w=512:h=512", str(srcp)])
            view = {"yaw": 35, "pitch": 12, "fov": 70}
            fl, bk = t / f"f_{proj}.png", t / f"b_{proj}.png"
            vf = V.flat_vf("mono360", "L", view, 256, 256).replace("input=e", f"input={proj}")
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(srcp), "-vf", vf, str(fl)])
            sv = V.sphere_vf(mode, view, 256, 256, src_w, src_h) + ":alpha_mask=1,format=rgba"
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(fl), "-vf", sv, str(bk)])
            a = cv2.imread(str(srcp)).astype(np.float32)
            b = cv2.imread(str(bk), cv2.IMREAD_UNCHANGED).astype(np.float32)
            m = b[:, :, 3] > 250
            err = float(np.abs(b[:, :, :3][m] - a[m]).mean()) if m.any() else 999
            check(f"v360 round trip ({proj}): flat -> sphere lands exactly where it was cut from (mean error {err:.2f})",
                  err < 3 and m.sum() > 1000, err)
        # ---- the mask
        mk = t / "mask.png"
        ok, err = run(V.mask_args(mk, 200, 100))
        mm = cv2.imread(str(mk), cv2.IMREAD_GRAYSCALE) if ok else None
        check("mask: white inside, black at the very edge, a ramp between",
              mm is not None and mm[50, 100] == 255 and mm[0, 100] == 0 and 0 < mm[50, 3] < 255, err)

        # ---- a synthetic STEREO TB-360 clip: a textured "person" nearer
        # than the background (20 px of disparity), background at infinity
        W, H = 1024, 512                # one eye (equirect)
        frames = 22
        vid = t / "vr_tb.mp4"
        person = "mandelbrot=size=160x220:rate=24"
        fc = (f"[0:v]split=2[bl][br];[1:v]split=2[pl][pr];"
              f"[bl][pl]overlay=x=560:y=150[L];[br][pr]overlay=x=540:y=150[R];[L][R]vstack[v]")
        ok, err = run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={W}x{H}:rate=24",
                       "-f", "lavfi", "-i", person, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                       "-filter_complex", fc, "-map", "[v]", "-map", "2:a", "-t", "1", "-c:v", "libx264",
                       "-pix_fmt", "yuv420p", "-c:a", "aac", str(vid)])
        check("fixture: a 1 s stereo TB-360 clip with sound", ok, err)
        # the person sits at u = (560+80)/1024 -> yaw = (0.625-0.5)*360 = 45, v ~ 0.51 -> pitch ~ 0
        view = {"yaw": 45, "pitch": -2, "fov": 90, "shape": "1:1"}
        vw, vh = 256, 256
        cl, cr = t / "cl.mp4", t / "cr.mp4"
        ok1, e1 = run(V.cut_args(vid, cl, 0, frames / 24, frames, "tb360", "L", view, vw, vh))
        ok2, e2 = run(V.cut_args(vid, cr, 0, frames / 24, frames, "tb360", "R", view, vw, vh, audio=False))
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames",
                                        "-of", "json", str(cl)], capture_output=True, text=True).stdout or "{}")
        vs = [s for s in pr.get("streams", []) if s["codec_type"] == "video"]
        check("cut: the left eye's virtual camera clip - the view size, the window's frames, the sound kept",
              ok1 and ok2 and vs and vs[0]["width"] == vw and int(vs[0]["nb_frames"]) == frames
              and any(s["codec_type"] == "audio" for s in pr["streams"]), (e1, e2, pr))

        def frames_of(p, n=None):
            raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(p), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                                 capture_output=True).stdout
            a = np.frombuffer(raw, np.uint8)
            return a.reshape(-1, vh, vw, 3)

        # the "swap": the character changes - here the view is inverted
        sl = t / "sl.mp4"
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(cl), "-vf", "negate", "-c:v", "libx264", "-crf", "8",
             "-pix_fmt", "yuv420p", "-an", str(sl)])
        srr = t / "sr.mp4"
        n = V.right_eye_file(sl, cl, cr, srr, vw, vh, frames)
        L, R, S, SR = frames_of(cl), frames_of(cr), frames_of(sl), frames_of(srr)
        k = frames // 2
        want = 255 - R[k].astype(np.float32)          # the swapped right eye should look like this
        naive = float(np.abs(S[k].astype(np.float32) - want).mean())
        got = float(np.abs(SR[k].astype(np.float32) - want).mean())
        check(f"right eye: the swapped left view re-projected through the ORIGINAL depth matches what the right eye "
              f"should see (error {got:.1f} vs {naive:.1f} unshifted)", n == frames and got < naive * 0.6 and got < 15,
              (n, got, naive))
        # ---- the paste back into the full stereo frame
        mk2 = t / "vmask.png"
        run(V.mask_args(mk2, vw, vh))
        out = t / "out_360_TB.mp4"
        ok, err = run(V.paste_args(vid, 0, frames / 24, frames, "tb360", view, sl, srr, mk2, out, W, H * 2, vw, vh,
                                   V.codec_args(W, H * 2, False)))
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                        "stream=codec_type,width,height,nb_frames", "-of", "json", str(out)],
                                       capture_output=True, text=True).stdout or "{}")
        vs = [s for s in pr.get("streams", []) if s["codec_type"] == "video"]
        check("paste: the full stereo frame back at its own size, the window's frames, the sound",
              ok and vs and vs[0]["width"] == W and vs[0]["height"] == H * 2 and int(vs[0]["nb_frames"]) == frames
              and any(s["codec_type"] == "audio" for s in pr["streams"]), (err, pr))
        if ok:
            full = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(out), "-vf", f"select=eq(n\\,{k})",
                                   "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
            orig = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(vid), "-vf", f"fps=24,select=eq(n\\,{k})",
                                   "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
            F = np.frombuffer(full, np.uint8).reshape(H * 2, W, 3).astype(np.float32)
            O = np.frombuffer(orig, np.uint8).reshape(H * 2, W, 3).astype(np.float32)
            # the person (left eye, top half) is swapped (inverted); the far side of the sphere is untouched
            pl = F[150 + 60:150 + 160, 560 + 40:560 + 120]
            ol = O[150 + 60:150 + 160, 560 + 40:560 + 120]
            prr = F[H + 150 + 60:H + 150 + 160, 540 + 40:540 + 120]
            orr = O[H + 150 + 60:H + 150 + 160, 540 + 40:540 + 120]
            back = float(np.abs(F[200:300, 50:150] - O[200:300, 50:150]).mean())
            inv_l = float(np.abs(pl - (255 - ol)).mean())
            inv_r = float(np.abs(prr - (255 - orr)).mean())
            check(f"paste: the person is swapped in BOTH eyes at their own places (left {inv_l:.1f}, right {inv_r:.1f}); "
                  f"the rest of the sphere is untouched ({back:.1f})",
                  inv_l < 25 and inv_r < 30 and back < 3, (inv_l, inv_r, back))
        # ---- SBS 180 end to end (mono check of the plumbing: the left eye swapped, hstack)
        vid2 = t / "vr_sbs.mp4"
        run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=512x512:rate=24",
             "-filter_complex", "[0:v]split=2[a][b];[a][b]hstack[v]", "-map", "[v]", "-t", "0.5",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", str(vid2)])
        out2 = t / "o2_180_LR.mp4"
        c2 = t / "c2.mp4"
        run(V.cut_args(vid2, c2, 0, 0.5, 12, "sbs180", "L", {"yaw": 0, "pitch": 0, "fov": 80}, 128, 128, audio=False))
        ok, err = run(V.paste_args(vid2, 0, 0.5, 12, "sbs180", {"yaw": 0, "pitch": 0, "fov": 80}, c2, c2, mk2, out2,
                                   1024, 512, 128, 128, V.codec_args(1024, 512, False), audio=False))
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height",
                                        "-of", "json", str(out2)], capture_output=True, text=True).stdout or "{}")
        check("paste (SBS 180): the eyes side by side again at 1024x512", ok and pr.get("streams")
              and pr["streams"][0]["width"] == 1024 and pr["streams"][0]["height"] == 512, (err, pr))
        # ---- metadata
        ok = V.inject(out, "tb360")
        xml = V.read_spherical(out)
        again = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "json", str(out)],
                               capture_output=True, text=True)
        check("inject: the spherical v1 box in the video track (stereo top-bottom); the file still plays",
              ok and "<GSpherical:Spherical>true" in xml and "top-bottom" in xml and again.returncode == 0
              and '"video"' in again.stdout, xml[:120])
        check("inject: twice = still one box", V.inject(out, "tb360") and out.read_bytes().count(V.SPHERICAL_UUID) == 1)
        ok = V.inject(out2, "sbs180")
        xml = V.read_spherical(out2)
        check("inject (180): left-right + the cropped half of a full pano",
              ok and "left-right" in xml and "<GSpherical:FullPanoWidthPixels>1024<" in xml
              and "<GSpherical:CroppedAreaLeftPixels>256<" in xml, xml[-300:])
        fs = t / "fs.mp4"
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(vid2), "-c", "copy", "-movflags", "+faststart", str(fs)])
        check("inject: a moov-first file is left alone (no offsets are ever rewritten)", V.inject(fs, "sbs180") is False)

print(f"RESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
