#!/usr/bin/env python3
"""bitGen Studio — AI MATTE for a path layer's subject (2.387.0).

Tim (verbatim): "can we add a paths layer, then generate parts of the scene on each path layer so animals, cars, people
can be rendered separately have transparent backgrounds and compose the scene" - asked how the background goes:
"Green screen + AI matte".

Run by lib/matte.js inside its own venv (venvs/matte: rembg + onnxruntime, the BiRefNet model in models/rembg):
    python scripts/matte.py job.json
job = {input, output, w, h, fps, frames, model ("birefnet-general" ...), key: [r, g, b], despill: true, combine: true,
       fake: false}   combine = the model's matte AND a soft key of the screen's colour (pockets of green go too)
The clip (a subject on a green screen) is read frame by frame from ffmpeg, the background taken away by the model
(rembg), the green that spills onto the edges toned down, and the frames written straight into ffmpeg as a see-through
VP9 webm (yuva420p, alpha_mode=1 - what the canvas and the compile read). fake = a green-distance key instead of the
model (the tests, and a machine without the venv) - same pipes, same output.
stdout: "H3M frame i/n" per frame, then one JSON line {"ok": true, "frames": n, "bbox": [x, y, w, h], "heights": [...]}.
"""
import json
import subprocess
import sys

import numpy as np


def say(*a):
    print("H3M", *a, flush=True)


def despill(rgb, key):
    """the key colour's channel held down to the brighter of the other two (green spill on fur / hair / edges)"""
    k = int(np.argmax(key))                     # 1 = a green screen, 2 = blue
    o = [i for i in range(3) if i != k]
    out = rgb.copy()
    out[..., k] = np.minimum(rgb[..., k], np.maximum(rgb[..., o[0]], rgb[..., o[1]]))
    return out


def key_alpha(rgb, key, tol=60.0, soft=40.0):
    d = np.sqrt(((rgb.astype(np.float32) - np.array(key, np.float32)) ** 2).sum(-1))
    return np.clip((d - tol) / soft * 255.0, 0, 255).astype(np.uint8)


def main():
    job = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    w, h, fps = int(job["w"]), int(job["h"]), float(job.get("fps") or 24)
    key = job.get("key") or [0, 177, 64]
    fake = bool(job.get("fake"))
    session = None
    if not fake:
        from PIL import Image                   # noqa: F401 - rembg's own dependency
        from rembg import new_session, remove   # noqa: F401
        session = new_session(job.get("model") or "birefnet-general")
        say("model", job.get("model") or "birefnet-general")
    dec = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", job["input"], "-vf", f"scale={w}:{h}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}",
                            "-r", f"{fps:g}", "-i", "-", "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                            "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-deadline", "good", "-cpu-used", "4",
                            "-metadata:s:v:0", "alpha_mode=1", job["output"]], stdin=subprocess.PIPE)
    n_total = int(job.get("frames") or 0)
    size = w * h * 3
    i = 0
    lo = [w, h]
    hi = [-1, -1]
    heights = []
    while True:
        buf = dec.stdout.read(size)
        if not buf or len(buf) < size:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        if fake:
            a = key_alpha(rgb, key)
        else:
            from PIL import Image
            from rembg import remove
            out = remove(Image.fromarray(rgb), session=session, post_process_mask=True)
            a = np.asarray(out.convert("RGBA"))[..., 3].copy()
            if job.get("combine", True):
                # green pockets the model kept (between legs, inside a wheel, between letters) go too: the screen's
                # own colour is never the subject
                a = np.minimum(a, key_alpha(rgb, key))
        rgb2 = despill(rgb, key) if job.get("despill", True) else rgb
        enc.stdin.write(np.dstack([rgb2, a]).astype(np.uint8).tobytes())
        ys, xs = np.nonzero(a > 128)
        if len(xs):
            lo = [min(lo[0], int(xs.min())), min(lo[1], int(ys.min()))]
            hi = [max(hi[0], int(xs.max())), max(hi[1], int(ys.max()))]
            heights.append(int(ys.max() - ys.min() + 1))
        i += 1
        say("frame %d/%d" % (i, max(n_total, i)))
    dec.stdout.close()
    dec.wait()
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit("ffmpeg could not write " + job["output"])
    if not i:
        raise SystemExit("no frames could be read from " + job["input"])
    bbox = [lo[0], lo[1], hi[0] - lo[0] + 1, hi[1] - lo[1] + 1] if hi[0] >= 0 else [0, 0, w, h]
    print(json.dumps({"ok": True, "frames": i, "bbox": bbox, "heights": heights[::max(1, len(heights) // 24)]}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as ex:                     # noqa: BLE001
        say("error:", ex)
        sys.exit(1)
