#!/usr/bin/env python3
"""bitGen Studio — 2.752.0: THE BRAIN FILM, UPSCALED (Tim: "are you able to upscale the video and make the text more sharp?").

Tim's LTX clip of the bitGen brain is 960 x 544. This makes it 1920 x 1080 with Real-ESRGAN's small general model
(realesr-general-x4v3, BSD-3-Clause, https://github.com/xinntao/Real-ESRGAN): x4, then down to 1920 x 1080 - the titles come
out crisp where a plain resize leaves them soft.

A maintainer's tool, run by hand - nothing in the app uses it. No PyTorch: the model's weights are read straight from its
.pth (a zip of numpy-readable tensors) and run with ONNX Runtime on the CPU (about 7 s a frame on 2 cores, ~40 min).

    pip install onnx onnxruntime pillow numpy
    python3 misc/brand/upscale_brain.py SOURCE.mp4        # -> docs/images/bitgen-neural.mp4 (1280 x 720, the website's)
                                                          #    + static/splash-neural.webm (1920 x 1080, the app's)

SOURCE is the 960 x 544 original (Tim's clip). The weights are downloaded once into misc/brand/.cache (not in git).
"""
import collections, pathlib, pickle, subprocess, sys, time, urllib.request, zipfile
import numpy as np
import onnx, onnxruntime as ort
from onnx import helper, numpy_helper, TensorProto
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "misc" / "brand" / ".cache"
URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"


def weights():
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / "realesr-general-x4v3.pth"
    if not f.exists():
        urllib.request.urlretrieve(URL, f)
    z = zipfile.ZipFile(f); top = z.namelist()[0].split("/")[0]

    def rebuild(storage, offset, size, stride, *rest):
        key, dtype = storage
        buf = np.frombuffer(z.read(f"{top}/data/{key}"), dtype=dtype)
        return np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=[s * buf.itemsize for s in stride]).copy()

    class Reader(pickle.Unpickler):
        def find_class(self, mod, name):
            return {"_rebuild_tensor_v2": rebuild, "FloatStorage": np.float32, "OrderedDict": collections.OrderedDict}.get(name) \
                or super().find_class(mod, name)

        def persistent_load(self, pid):
            return (pid[2], pid[1])

    sd = Reader(z.open(f"{top}/data.pkl")).load()
    return sd.get("params", sd)


def model(sd):
    """SRVGGNetCompact: conv + PReLU, 32 x (conv + PReLU), conv to 48 channels, pixel shuffle x4, + the input made 4x (nearest)"""
    nodes, inits, x = [], [], "in"
    for n in sorted({int(k.split(".")[1]) for k in sd}):
        w = sd[f"body.{n}.weight"]
        if w.ndim == 4:
            inits += [numpy_helper.from_array(w.astype(np.float32), f"w{n}"), numpy_helper.from_array(sd[f"body.{n}.bias"].astype(np.float32), f"b{n}")]
            nodes.append(helper.make_node("Conv", [x, f"w{n}", f"b{n}"], [f"c{n}"], pads=[1, 1, 1, 1])); x = f"c{n}"
        else:
            inits.append(numpy_helper.from_array(w.reshape(-1, 1, 1).astype(np.float32), f"a{n}"))
            nodes.append(helper.make_node("PRelu", [x, f"a{n}"], [f"p{n}"])); x = f"p{n}"
    inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), "sc"))
    nodes += [helper.make_node("DepthToSpace", [x], ["ds"], blocksize=4, mode="CRD"),
              helper.make_node("Resize", ["in", "", "sc"], ["up"], mode="nearest"),
              helper.make_node("Add", ["ds", "up"], ["out"])]
    io = lambda n: helper.make_tensor_value_info(n, TensorProto.FLOAT, [1, 3, None, None])
    m = helper.make_model(helper.make_graph(nodes, "srvgg", [io("in")], [io("out")], inits), opset_imports=[helper.make_opsetid("", 17)])
    m.ir_version = 9
    o = ort.SessionOptions(); o.intra_op_num_threads = 0
    return ort.InferenceSession(m.SerializeToString(), o, providers=["CPUExecutionProvider"])


def main(src):
    info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                           "-of", "csv=p=0", src], capture_output=True, text=True, check=True).stdout.strip().split(",")
    W, H, fps = int(info[0]), int(info[1]), info[2]
    s = model(weights())
    master = ROOT / "misc" / "brand" / "brain_master_tmp.mkv"
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080", "-r", fps, "-i", "-",
                            "-c:v", "libx264", "-crf", "8", "-preset", "veryfast", "-pix_fmt", "yuv444p", str(master)], stdin=subprocess.PIPE)
    n, t0 = 0, time.time()
    while len(b := dec.stdout.read(W * H * 3)) == W * H * 3:
        a = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32).transpose(2, 0, 1)[None] / 255
        y = s.run(None, {"in": a})[0][0].transpose(1, 2, 0)
        im = Image.fromarray((np.clip(y, 0, 1) * 255 + .5).astype(np.uint8))
        h = round(1920 * im.height / im.width)                       # 16:9 out of 960 x 544: fit the width, trim the height
        im = im.resize((1920, h), Image.LANCZOS).crop((0, (h - 1080) // 2, 1920, (h - 1080) // 2 + 1080))
        enc.stdin.write(im.tobytes()); n += 1
        if n % 24 == 0:
            print(f"{n} frames, {(time.time() - t0) / n:.1f} s a frame", flush=True)
    enc.stdin.close()
    if enc.wait() or dec.wait():
        sys.exit("ffmpeg failed")
    finish(master)


def finish(master):
    """the master -> the website's mp4 (H.264, 1280 x 720 - it shows about 560 px wide there, so this is sharp and a third of
    the size) and the app's webm (VP9, 1920 x 1080 - full window), each written to a temporary name first"""
    mp4, webm = ROOT / "docs" / "images" / "bitgen-neural.mp4", ROOT / "static" / "splash-neural.webm"
    t1, t2 = mp4.with_name("bitgen-neural_tmp.mp4"), webm.with_name("splash-neural_tmp.webm")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(master), "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-an", str(t1)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(master), "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1",
                    "-deadline", "good", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-an", str(t2)], check=True)
    t1.replace(mp4); t2.replace(webm); master.unlink()
    print("->", mp4, "\n->", webm)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--finish":             # an existing master
        finish(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) == 2:
        main(sys.argv[1])
    else:
        sys.exit(__doc__)
