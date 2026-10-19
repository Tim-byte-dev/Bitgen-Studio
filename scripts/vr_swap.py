#!/usr/bin/env python3
"""bitGen Studio — CHARACTER SWAP IN VR VIDEO (2.330.0).

Tim (verbatim): "is it possible to make it 360 stereo and 180sbs ? and
usable results" -> "yes please build it".

A VR frame is never swapped whole (the model would see a stretched sphere,
and each eye would get a different character). Instead:

  1. THE VIRTUAL CAMERA  the person is aimed at (yaw / pitch, a field of
     view, a shape): ffmpeg's v360 cuts an ordinary rectilinear view of the
     LEFT eye at the render size - that clip is what ComfyUI swaps, at the
     model's full resolution.
  2. THE OTHER EYE       (stereo only) never swapped separately. The depth of
     the ORIGINAL footage is measured (OpenCV StereoSGBM on the original
     left / right views, right-referenced, temporally smoothed) and the
     swapped left view is re-projected through it into the right eye - both
     eyes show the SAME character at the right depth.
  3. BACK INTO THE SPHERE each swapped view goes back through v360 (the
     exact inverse: yaw -Y, pitch -P, rotation order pyr - verified round
     trip) with a feathered mask, over the untouched full-resolution eye;
     the eyes are re-stacked (TB) / put side by side (SBS), the window's
     original sound kept.
  4. A VR FILE           H.265 above 4K (H.264 cannot carry 8K VR), the
     standard name suffix (_360_TB / _180_LR / _360) and Google's spherical
     v1 metadata box, so headset players open it as VR.

Modes: mono360 (one equirect sphere), tb360 (stereo 360, top-bottom),
sbs180 (stereo 180, side by side, half-equirect per eye).

Pure argument builders + the warp (tested: scripts/test-vrswap.py);
swap_worker.py runs them. CLI: `python vr_swap.py inject <file.mp4> <mode>`
(the compile route tags the joined movie with it).
"""
import math
import shutil
import struct
import subprocess
import sys
import uuid
from pathlib import Path

FPS = 24
MODES = {
    "mono360": {"stereo": None, "proj": "e", "suffix": "_360"},
    "tb360": {"stereo": "tb", "proj": "e", "suffix": "_360_TB"},
    "sbs180": {"stereo": "sbs", "proj": "hequirect", "suffix": "_180_LR"},
    # 2.368.0: 360 stereo side by side (each eye a full 2:1 sphere) - the VR World's pictures come this way too
    "sbs360": {"stereo": "sbs", "proj": "e", "suffix": "_360_LR"},
}
SHAPES = {"1:1": (1, 1), "3:4": (3, 4), "9:16": (9, 16), "4:3": (4, 3), "16:9": (16, 9)}
FEATHER = 0.08          # the soft edge, as a share of the view's short side


def mode_of(v):
    return v if v in MODES else None


def eye_size(mode, w, h):
    """One eye's picture in the file: TB halves the height, SBS the width."""
    st = MODES[mode]["stereo"]
    if st == "tb":
        return int(w), int(h) // 2
    if st == "sbs":
        return int(w) // 2, int(h)
    return int(w), int(h)


def eye_crop(mode, eye):
    """The ffmpeg crop that takes one eye out of the frame ('' = mono)."""
    st = MODES[mode]["stereo"]
    if st == "tb":
        return "crop=iw:ih/2:0:0" if eye == "L" else "crop=iw:ih/2:0:ih/2"
    if st == "sbs":
        return "crop=iw/2:ih:0:0" if eye == "L" else "crop=iw/2:ih:iw/2:0"
    return ""


def a16(v):
    return max(128, int(round(v / 16.0)) * 16)


def view_size(short_side, shape):
    """The swap's render size for the virtual camera: the shape at the
    chosen short side, 16-px aligned."""
    a, b = SHAPES.get(shape, SHAPES["1:1"])
    s = max(128, int(short_side or 544))
    if a >= b:
        return a16(s * a / b), a16(s)
    return a16(s), a16(s * b / a)


def vfov(hfov, w, h):
    """A rectilinear view's vertical field of view for its horizontal one."""
    hf = max(10.0, min(150.0, float(hfov)))
    return math.degrees(2 * math.atan(math.tan(math.radians(hf) / 2) * h / w))


def clamp_view(v):
    """{yaw, pitch, fov} -> sane numbers (yaw -180..180, pitch -85..85,
    fov 20..140 degrees)."""
    v = v or {}
    yaw = ((float(v.get("yaw") or 0) + 180) % 360) - 180
    pitch = max(-85.0, min(85.0, float(v.get("pitch") or 0)))
    fov = max(20.0, min(140.0, float(v.get("fov") or 70)))
    return {"yaw": round(yaw, 3), "pitch": round(pitch, 3), "fov": round(fov, 3),
            "shape": v.get("shape") if v.get("shape") in SHAPES else "1:1"}


def flat_vf(mode, eye, view, w, h):
    """The filter that cuts the virtual camera out of one eye."""
    v = clamp_view(view)
    parts = [p for p in (eye_crop(mode, eye),) if p]
    parts.append(f"v360=input={MODES[mode]['proj']}:output=flat:yaw={v['yaw']}:pitch={v['pitch']}"
                 f":h_fov={v['fov']}:v_fov={vfov(v['fov'], w, h):.4f}:w={w}:h={h}")
    return ",".join(parts)


def sphere_vf(mode, view, vw, vh, eye_w, eye_h):
    """The exact inverse: a rectilinear view back onto the eye's sphere
    (yaw -Y, pitch -P, rotation order pyr - the round trip is verified)."""
    v = clamp_view(view)
    return (f"v360=input=flat:output={MODES[mode]['proj']}:ih_fov={v['fov']}"
            f":iv_fov={vfov(v['fov'], vw, vh):.4f}:w={eye_w}:h={eye_h}"
            f":yaw={-v['yaw']}:pitch={-v['pitch']}:rorder=pyr")


def cut_args(src, dst, start, dur, frames, mode, eye, view, w, h, audio=True):
    """ffmpeg: the window of one eye as the virtual camera sees it, 24 fps,
    at the render size (+ the original sound on the left-eye clip - it is
    the reference ComfyUI loads and the audio the result gets back)."""
    vf = f"fps={FPS}," + flat_vf(mode, eye, view, w, h) + ",setsar=1"
    a = ["-c:a", "aac", "-b:a", "192k"] if audio else ["-an"]
    return ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{float(start):.3f}", "-i", str(src),
            "-t", f"{float(dur):.4f}", "-vf", vf, "-frames:v", str(int(frames)),
            "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p"] + a + [str(dst)]


def mask_args(dst, w, h):
    """ffmpeg: the feather - white inside, fading to black at the edges."""
    f = max(4, int(min(w, h) * FEATHER))
    lum = f"255*min(1,min(min(X,W-1-X),min(Y,H-1-Y))/{f})"
    return ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=black:s={w}x{h}",
            "-vf", f"format=gray,geq=lum='{lum}'", "-frames:v", "1", str(dst)]


def has_encoder(name):
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    except OSError:
        return False
    return f" {name} " in out


def codec_args(w, h, x265=None):
    """H.265 above 4K (VR players decode 8K H.265; H.264 tops out near 4K),
    else H.264. `x265` = is libx265 there (None = ask ffmpeg)."""
    big = int(w) * int(h) > 4096 * 2304
    if big and (x265 if x265 is not None else has_encoder("libx265")):
        return ["-c:v", "libx265", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"]
    return ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p"]


def paste_args(src, start, dur, frames, mode, view, sw_left, sw_right, mask, dst,
               src_w, src_h, vw, vh, codec, audio=True):
    """ffmpeg: the swapped view(s) back onto the full-resolution eye(s) with
    the feathered mask, the eyes re-stacked, the window's own sound."""
    ew, eh = eye_size(mode, src_w, src_h)
    stereo = MODES[mode]["stereo"]
    sph = sphere_vf(mode, view, vw, vh, ew, eh)
    ins = ["-ss", f"{float(start):.3f}", "-t", f"{float(dur):.4f}", "-i", str(src), "-i", str(sw_left)]
    if stereo:
        ins += ["-i", str(sw_right)]
    mi = 3 if stereo else 2
    ins += ["-loop", "1", "-framerate", str(FPS), "-i", str(mask)]
    fc = [f"[0:v]fps={FPS},format=yuv420p" + (",split=2[sa][sb]" if stereo else "[e0]")]
    if stereo:
        fc += [f"[sa]{eye_crop(mode, 'L')}[e0]", f"[sb]{eye_crop(mode, 'R')}[e1]"]
    fc.append(f"[{mi}:v]format=gray,{sph}" + (",split=2[m0][m1]" if stereo else "[m0]"))
    eyes = ["0", "1"] if stereo else ["0"]
    for i, e in enumerate(eyes):
        fc.append(f"[{1 + i}:v]fps={FPS},format=yuv420p,{sph}[p{e}]")
        fc.append(f"[p{e}][m{e}]alphamerge[pa{e}]")
        fc.append(f"[e{e}][pa{e}]overlay=shortest=1:format=auto,format=yuv420p[o{e}]")
    if stereo == "tb":
        fc.append("[o0][o1]vstack=inputs=2[v]")
    elif stereo == "sbs":
        fc.append("[o0][o1]hstack=inputs=2[v]")
    else:
        fc.append("[o0]null[v]")
    out = ["-filter_complex", ";".join(fc), "-map", "[v]"]
    if audio:
        out += ["-map", "0:a:0?", "-c:a", "aac", "-b:a", "192k"]
    return ["ffmpeg", "-y", "-loglevel", "error"] + ins + out + ["-frames:v", str(int(frames))] \
        + list(codec) + [str(dst)]


# ------------------------------------------------------------- the other eye
def _fill_rows(d, bad):
    """Invalid disparities take the nearest valid one on their row (the
    background side of an occlusion keeps its own depth)."""
    import numpy as np
    h, w = d.shape
    idx = np.where(~bad, np.arange(w)[None, :], 0)
    np.maximum.accumulate(idx, axis=1, out=idx)
    left = d[np.arange(h)[:, None], idx]
    ridx = np.where(~bad, np.arange(w)[None, :], w - 1)
    ridx = np.minimum.accumulate(ridx[:, ::-1], axis=1)[:, ::-1]
    right = d[np.arange(h)[:, None], ridx]
    had_left = np.maximum.accumulate(~bad, axis=1)
    out = np.where(bad, np.where(had_left, np.minimum(left, right), right), d)
    return out


def num_disparities(w):
    """The search range: ~15% of the view's width, a multiple of 16."""
    return max(16, int(math.ceil(w * 0.15 / 16.0)) * 16)


class RightEye:
    """Re-projects a swapped LEFT view into the right eye through the
    ORIGINAL footage's depth, one frame at a time (temporal smoothing keeps
    the depth from flickering)."""

    def __init__(self, w, h, smooth=0.6):
        import cv2
        self.cv2 = cv2
        self.w, self.h, self.smooth = w, h, smooth
        n, bs = num_disparities(w), 5
        self.sgbm = cv2.StereoSGBM_create(minDisparity=0, numDisparities=n, blockSize=bs,
                                          P1=8 * bs * bs, P2=32 * bs * bs, disp12MaxDiff=2,
                                          uniquenessRatio=8, speckleWindowSize=80, speckleRange=2,
                                          mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY)
        self.prev = None
        import numpy as np
        self.np = np
        self.xs = np.tile(np.arange(w, dtype=np.float32), (h, 1))
        self.ys = np.tile(np.arange(h, dtype=np.float32)[:, None], (1, w))

    def disparity(self, orig_l, orig_r):
        """Right-referenced disparity (x_left = x_right + d), filled, smoothed."""
        cv2, np = self.cv2, self.np
        gl = cv2.cvtColor(orig_l, cv2.COLOR_BGR2GRAY)
        gr = cv2.cvtColor(orig_r, cv2.COLOR_BGR2GRAY)
        # the right view as the reference: mirror both, swap roles, mirror back
        d = self.sgbm.compute(np.ascontiguousarray(gr[:, ::-1]), np.ascontiguousarray(gl[:, ::-1]))
        d = d[:, ::-1].astype(np.float32) / 16.0
        bad = d <= 0
        if bad.all():
            d = np.zeros_like(d)
        elif bad.any():
            d = _fill_rows(d, bad)
        d = cv2.medianBlur(d, 5)
        if self.prev is not None:
            d = self.smooth * self.prev + (1 - self.smooth) * d
        self.prev = d
        return d

    def warp(self, swapped_l, orig_l, orig_r):
        """The right eye: each right pixel takes the swapped left pixel its
        depth points at. Near the view's edge the right eye sees past what
        the left view holds - there the ORIGINAL right pixels stay (frame the
        person with a margin and that band is untouched background)."""
        cv2, np = self.cv2, self.np
        d = self.disparity(orig_l, orig_r)
        mx = self.xs + d
        out = cv2.remap(swapped_l, mx, self.ys, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        oob = mx > (self.w - 1.5)
        if oob.any():
            out[oob] = orig_r[oob]
        return out


def _reader(path, w, h):
    return subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "rawvideo",
                             "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-"],
                            stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)


def right_eye_file(swapped_l, orig_l, orig_r, dst, w, h, frames, on_tick=None):
    """The whole right-eye view clip: swapped left + the original pair ->
    dst (H.264, near-lossless). Returns the frame count written."""
    import numpy as np
    eye = RightEye(w, h)
    size = w * h * 3
    rs = [_reader(p, w, h) for p in (swapped_l, orig_l, orig_r)]
    wr = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
                           "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "12",
                           "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dst)], stdin=subprocess.PIPE)
    n = 0
    try:
        while n < frames:
            bufs = [r.stdout.read(size) for r in rs]
            if any(len(b) < size for b in bufs):
                break
            a, l, r = (np.frombuffer(b, np.uint8).reshape(h, w, 3) for b in bufs)
            wr.stdin.write(np.ascontiguousarray(eye.warp(a, l, r)).tobytes())
            n += 1
            if on_tick and n % 24 == 0:
                on_tick(n)
    finally:
        try:
            wr.stdin.close()
        except OSError:
            pass
        wr.wait()
        for r in rs:
            try:
                r.stdout.close()
            except OSError:
                pass
            r.kill()
            r.wait()
    return n


# ------------------------------------------------------------- VR metadata
SPHERICAL_UUID = uuid.UUID("ffcc8263-f855-4a93-8814-587a02521fdd").bytes


def spherical_xml(mode, w, h):
    """Google's spherical video v1 XML (what the Spatial Media injector
    writes). 180 = the full equirect of a 360 with the half cropped."""
    stereo = {"tb": "top-bottom", "sbs": "left-right"}.get(MODES[mode]["stereo"], "")
    ew, eh = eye_size(mode, w, h)
    crop = ""
    if MODES[mode]["proj"] == "hequirect":
        fw = ew * 2
        crop = (f"<GSpherical:CroppedAreaImageWidthPixels>{ew}</GSpherical:CroppedAreaImageWidthPixels>"
                f"<GSpherical:CroppedAreaImageHeightPixels>{eh}</GSpherical:CroppedAreaImageHeightPixels>"
                f"<GSpherical:FullPanoWidthPixels>{fw}</GSpherical:FullPanoWidthPixels>"
                f"<GSpherical:FullPanoHeightPixels>{eh}</GSpherical:FullPanoHeightPixels>"
                f"<GSpherical:CroppedAreaLeftPixels>{ew // 2}</GSpherical:CroppedAreaLeftPixels>"
                f"<GSpherical:CroppedAreaTopPixels>0</GSpherical:CroppedAreaTopPixels>")
    return ('<?xml version="1.0"?><rdf:SphericalVideo '
            'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
            'xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">'
            "<GSpherical:Spherical>true</GSpherical:Spherical>"
            "<GSpherical:Stitched>true</GSpherical:Stitched>"
            "<GSpherical:StitchingSoftware>bitGen Studio</GSpherical:StitchingSoftware>"
            "<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType>"
            + (f"<GSpherical:StereoMode>{stereo}</GSpherical:StereoMode>" if stereo else "")
            + crop + "</rdf:SphericalVideo>")


def _boxes(data, start, end):
    """(type, start, size, header) of the boxes in data[start:end]."""
    out, i = [], start
    while i + 8 <= end:
        size, typ = struct.unpack(">I4s", data[i:i + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack(">Q", data[i + 8:i + 16])[0]
            hdr = 16
        elif size == 0:
            size = end - i
        if size < hdr or i + size > end:
            break
        out.append((typ.decode("latin-1"), i, size, hdr))
        i += size
    return out


def inject(path, mode):
    """Put the spherical v1 box in the VIDEO track of an mp4 whose moov
    comes AFTER mdat (no chunk offsets move); a moov-first file is left as
    is (its name suffix still tells players). Returns True when injected."""
    p = Path(path)
    data = bytearray(p.read_bytes())
    top = _boxes(data, 0, len(data))
    moov = next((b for b in top if b[0] == "moov"), None)
    mdat = next((b for b in top if b[0] == "mdat"), None)
    if not moov or not mdat or moov[1] < mdat[1] or moov[3] != 8:
        return False
    if SPHERICAL_UUID in data[moov[1]:moov[1] + moov[2]]:
        return True
    w = h = 0
    for t in _boxes(data, moov[1] + 8, moov[1] + moov[2]):
        if t[0] != "trak" or t[3] != 8:
            continue
        inner = _boxes(data, t[1] + 8, t[1] + t[2])
        tkhd = next((b for b in inner if b[0] == "tkhd"), None)
        blob = bytes(data[t[1]:t[1] + t[2]])
        if b"vide" not in blob or not tkhd:
            continue
        tk = data[tkhd[1]:tkhd[1] + tkhd[2]]
        w, h = struct.unpack(">I", tk[-8:-4])[0] >> 16, struct.unpack(">I", tk[-4:])[0] >> 16
        xml = spherical_xml(mode, w, h).encode("utf-8")
        box = struct.pack(">I4s", 8 + 16 + len(xml), b"uuid") + SPHERICAL_UUID + xml
        at = t[1] + t[2]
        data[at:at] = box
        struct.pack_into(">I", data, t[1], t[2] + len(box))
        struct.pack_into(">I", data, moov[1], moov[2] + len(box))
        p.write_bytes(bytes(data))
        return True
    return False


def read_spherical(path):
    """The spherical XML of a file (tests / the log), or ''."""
    data = Path(path).read_bytes()
    i = data.find(SPHERICAL_UUID)
    if i < 0:
        return ""
    size = struct.unpack(">I", data[i - 8:i - 4])[0]
    return data[i + 16:i - 8 + size].decode("utf-8", "replace")


def main(argv):
    if len(argv) == 4 and argv[1] == "inject" and mode_of(argv[3]):
        ok = inject(argv[2], argv[3])
        print("injected" if ok else "not injected (moov before mdat) - the name suffix still marks it")
        return 0
    print("usage: vr_swap.py inject <file.mp4> <mono360|tb360|sbs180|sbs360>")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
