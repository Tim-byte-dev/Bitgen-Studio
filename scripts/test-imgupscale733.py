#!/usr/bin/env python3
"""bitGen Studio — 2.733.0: ⏫ Enhance on a PICTURE.
Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image"
  1. scripts/imgupscale_graph.py: Tim's SeedVR2 image workflow with the model / VAE / colour / denoise / seed picked
     and the multiplier that reaches the size (the ImageCompare preview dropped); the upscale-model workflow at the
     size; the model picked from what ComfyUI lists;
  2. lib/imgUpscale.js (node): the sizes (x2 / x3 / x4 / short sides, 8192 px a side at most), a picture named never
     pathed (gallery / Image assets / an upload's token), an upload sniffed (PNG / JPEG / WebP / BMP only), job params;
  3. LIVE on the stub ComfyUI: SeedVR2 x2 (a few pixels over -> exactly the size), an upscale model to 1080 px, lanczos
     without ComfyUI, PNGs in the output folder named <name>_upscaled_<w>x<h>.png; the source's size handed back, no
     upscale model and no ComfyUI each fail in words.
Run from repo root: python3 scripts/test-imgupscale733.py"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import imgupscale_graph as IG  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {str(extra)[:900]}"))
    if not cond:
        FAILED.append(name)


# 1 the graphs
g = IG.seedvr2("pic.png", 960, 544, 1920, 1088, "p/x", "seedvr2_7b_sharp_fp16.safetensors", "seedvr2_ema_vae_fp16.safetensors",
               seed=9, color="wavelet", denoise=0.7)
by = {v["class_type"]: v["inputs"] for v in g.values()}
check("SeedVR2 graph: Tim's image workflow (LoadImage -> Resize -> Preprocess -> tiled VAE -> Conditioning -> KSampler -> "
      "decode -> PostProcessing -> SaveImage), no ImageCompare",
      {"LoadImage", "ResizeImageMaskNode", "SeedVR2Preprocess", "VAEEncodeTiled", "SeedVR2Conditioning", "KSampler",
       "VAEDecodeTiled", "SeedVR2PostProcessing", "SaveImage", "UNETLoader", "VAELoader"} <= set(by) and "ImageCompare" not in by, sorted(by))
check("SeedVR2 graph: the picture, x2, the model + VAE listed, wavelet, denoise 0.7, seed 9, the prefix",
      by["LoadImage"]["image"] == "pic.png" and by["ResizeImageMaskNode"]["resize_type.multiplier"] == 2.0
      and by["UNETLoader"]["unet_name"] == "seedvr2_7b_sharp_fp16.safetensors" and by["VAELoader"]["vae_name"] == "seedvr2_ema_vae_fp16.safetensors"
      and by["SeedVR2PostProcessing"]["color_correction_method"] == "wavelet" and by["KSampler"]["denoise"] == 0.7
      and by["KSampler"]["seed"] == 9 and by["KSampler"]["steps"] == 1 and by["SaveImage"]["filename_prefix"] == "p/x", by)
check("SeedVR2 graph: an unknown colour = lab, denoise held to 0.05..1",
      [v["inputs"] for v in IG.seedvr2("a", 1, 1, 2, 2, "p", "u", "v", color="neon", denoise=9).values() if v["class_type"] == "SeedVR2PostProcessing"][0]["color_correction_method"] == "lab")
m = IG.model("pic.png", "4x-UltraSharp.pth", 2160, 1224, "p/y")
mb = {v["class_type"]: v["inputs"] for v in m.values()}
check("model graph: UpscaleModelLoader (the file) -> ImageUpscaleWithModel -> ImageScale 2160x1224 -> SaveImage",
      mb["UpscaleModelLoader"]["model_name"] == "4x-UltraSharp.pth" and mb["ImageScale"]["width"] == 2160 and mb["ImageScale"]["height"] == 1224
      and mb["LoadImage"]["image"] == "pic.png" and mb["SaveImage"]["filename_prefix"] == "p/y", mb)
check("pick_upscale_model: the asked file (any folder), else the first listed, none = said in words",
      IG.pick_upscale_model(["a/RealESRGAN_x4plus.pth", "4x-UltraSharp.pth"], "RealESRGAN_x4plus.pth")[0] == "a/RealESRGAN_x4plus.pth"
      and IG.pick_upscale_model(["4x-UltraSharp.pth"], "")[0] == "4x-UltraSharp.pth"
      and IG.pick_upscale_model([], "")[0] == "" and "models/upscale_models" in IG.pick_upscale_model([], "")[1])

# 2 node
NODE = r"""
const I = require('./lib/imgUpscale'), fs = require('fs'), os = require('os'), path = require('path');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'iu733-')), P = path.join(T, 'proj'), TMP = path.join(T, 'tmp');
for (const d of ['output', 'images', 'final']) fs.mkdirSync(path.join(P, d), { recursive: true });
fs.writeFileSync(path.join(P, 'output', 'a.png'), 'x'); fs.writeFileSync(path.join(P, 'images', 'a.png'), 'y'); fs.writeFileSync(path.join(P, 'images', 'b.jpg'), 'z');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const up = I.saveUpload(TMP, png, 'my ref<1>.png');
let bad = ''; try { I.saveUpload(TMP, Buffer.from('<html>not a picture</html>'), 'x.png'); } catch (e) { bad = e.message; }
const out = {
  t: [I.target('x2', 960, 544), I.target('1080', 512, 768), I.target('x4', 4000, 3000), I.target('720', 1920, 1080)],
  g: path.relative(P, I.resolve(P, 'a.png', 'gallery', TMP) || ''), a: path.relative(P, I.resolve(P, 'a.png', 'asset', TMP) || ''),
  b: path.relative(P, I.resolve(P, 'b.jpg', 'gallery', TMP) || ''), trav: I.resolve(P, '../../etc/passwd', 'gallery', TMP), vid: I.resolve(P, 'a.mp4', 'gallery', TMP),
  up, upPath: !!I.resolve(P, up.name, 'upload', TMP), bad,
  n: I.normalize({ size: 'x9', method: 'magic', model: '../evil.pth', color: 'red', denoise: 7 }),
  jp: I.jobParams('/x/pic.png', { width: 960, height: 544 }, { size: 'x2', method: 'model', model: '4x-UltraSharp.pth' }),
  jl: I.jobParams('/x/pic.png', { width: 960, height: 544 }, { size: '2160', method: 'lanczos', model: '4x-UltraSharp.pth' }),
};
fs.rmSync(T, { recursive: true, force: true });
console.log(JSON.stringify(out));
"""
r = subprocess.run(["node", "-e", NODE], cwd=str(ROOT), capture_output=True, text=True)
try:
    N = json.loads(r.stdout)
except json.JSONDecodeError:
    N = {}
    print(r.stdout, r.stderr)
t = N.get("t") or [{}] * 4
check("sizes: x2 of 960x544 = 1920x1088; 1080 px short side of 512x768 = 1080x1620; 16000 px refused; smaller than it is refused",
      t[0].get("width") == 1920 and t[0].get("height") == 1088 and t[1].get("width") == 1080 and t[1].get("height") == 1620
      and "8192" in (t[2].get("error") or "") and "already" in (t[3].get("error") or "") and "picture" in (t[3].get("error") or ""), t)
check("names, never paths: a gallery picture from output/, an Image asset from images/ first, a .jpg asset found from the gallery too; "
      "../ and a video refused", N.get("g") == "output/a.png" and N.get("a") == "images/a.png" and N.get("b") == "images/b.jpg"
      and N.get("trav") is None and N.get("vid") is None, N)
check("an upload: a PNG kept under a token (its name made safe), found by it; HTML refused in words",
      (N.get("up") or {}).get("from") == "upload" and (N.get("up") or {}).get("name", "").endswith("_my ref_1_.png") and N.get("upPath")
      and "not a PNG, JPEG, WebP or BMP" in (N.get("bad") or ""), N.get("up"))
n = N.get("n") or {}
check("normalize: an unknown size / way / colour = the defaults (x2, SeedVR2, lab), a ../ model dropped, denoise held to 1",
      n.get("size") == "x2" and n.get("method") == "seedvr2" and n.get("model") == "" and n.get("color") == "lab" and n.get("denoise") == 1, n)
jp, jl = (N.get("jp") or {}).get("params") or {}, (N.get("jl") or {}).get("params") or {}
check("job params: mode imgupscale, the size, the way + model, output pic_upscaled_1920x1088.png; lanczos carries no model",
      jp.get("mode") == "imgupscale" and jp.get("width") == 1920 and jp.get("height") == 1088 and jp.get("method") == "model"
      and jp.get("model") == "4x-UltraSharp.pth" and jp.get("output_name") == "pic_upscaled_1920x1088.png"
      and jl.get("method") == "lanczos" and "model" not in jl and jl.get("output_name") == "pic_upscaled_3812x2160.png", (jp, jl))
core = (ROOT / "lib" / "core.js").read_text(encoding="utf-8")
idx = (ROOT / "routes" / "index.js").read_text(encoding="utf-8")
check("wiring: lib/core.js runs mode imgupscale with imgupscale_worker.py; routes/imgupscale.js is mounted from routes/index.js, "
      "not misc/server.js", 'imgupscale: "imgupscale_worker.py"' in core and 'require("./imgupscale").mount(app)' in idx
      and "imgupscale" not in (ROOT / "misc" / "server.js").read_text(encoding="utf-8").lower())

# 3 LIVE
T = Path(tempfile.mkdtemp(prefix="iu733_"))
models = T / "models"
for sub in ("diffusion_models", "vae", "upscale_models"):
    (models / sub).mkdir(parents=True)
(models / "diffusion_models" / "seedvr2_7b_sharp_fp16.safetensors").write_bytes(b"x")
(models / "vae" / "seedvr2_ema_vae_fp16.safetensors").write_bytes(b"x")
(models / "upscale_models" / "4x-UltraSharp.pth").write_bytes(b"x")
bare = T / "bare"
for sub in ("diffusion_models", "vae"):
    (bare / sub).mkdir(parents=True)
(bare / "diffusion_models" / "seedvr2_7b_sharp_fp16.safetensors").write_bytes(b"x")
(bare / "vae" / "seedvr2_ema_vae_fp16.safetensors").write_bytes(b"x")


def start_stub(extra, mroot=models):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    p = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                         env=dict(os.environ, STUB_MODELS_ROOT=str(mroot), **extra), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return p, port


def size(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "json", str(p)], capture_output=True, text=True)
    s = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
    return s.get("width"), s.get("height")


pic = T / "Sunset_Beach.png"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=300x170:rate=1", "-frames:v", "1", str(pic)], check=True)


def run_job(port, name, params):
    jd = T / name
    jd.mkdir()
    job = {"params": dict({"mode": "imgupscale", "source": str(pic), "seed": 5}, **params),
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "imgupscale_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=180)
    return r, sorted((jd / "out").glob("*.png")) if (jd / "out").exists() else [], jd


stub, port = start_stub({})
try:
    r, files, jd = run_job(port, "s", {"width": 600, "height": 340, "method": "seedvr2", "color": "adain", "denoise": 0.8,
                                       "output_name": "Sunset_Beach_upscaled_600x340.png"})
    q = json.loads((jd / "imgupscale_queued.json").read_text()) if (jd / "imgupscale_queued.json").exists() else {}
    qb = {v["class_type"]: v["inputs"] for v in q.values()}
    check("LIVE SeedVR2 x2: 300x170 -> SeedVR2 hands back 608x352 (padded to 16) -> exactly 600x340, a PNG named "
          "Sunset_Beach_upscaled_600x340.png, @@OUT",
          r.returncode == 0 and [f.name for f in files] == ["Sunset_Beach_upscaled_600x340.png"] and size(files[0]) == (600, 340)
          and "608x352 came back - taken to exactly 600x340" in r.stdout and "@@OUT Sunset_Beach_upscaled_600x340.png" in r.stdout,
          (r.returncode, [f.name for f in files], r.stdout[-1200:]))
    check("LIVE the queued graph: the model + VAE ComfyUI lists, adain, denoise 0.8, x2, the uploaded picture",
          qb.get("UNETLoader", {}).get("unet_name") == "seedvr2_7b_sharp_fp16.safetensors" and qb.get("SeedVR2PostProcessing", {}).get("color_correction_method") == "adain"
          and qb.get("KSampler", {}).get("denoise") == 0.8 and qb.get("ResizeImageMaskNode", {}).get("resize_type.multiplier") == 2.0
          and str(qb.get("LoadImage", {}).get("image", "")).endswith(".png"), qb)
    r, files, _ = run_job(port, "m", {"width": 1906, "height": 1080, "method": "model", "model": "4x-UltraSharp.pth"})
    check("LIVE an upscale model to 1080 px: 4x-UltraSharp.pth, 1906x1080, named by its size",
          r.returncode == 0 and files and files[0].name == "Sunset_Beach_upscaled_1906x1080.png" and size(files[0]) == (1906, 1080)
          and "upscale model 4x-UltraSharp.pth" in r.stdout, (r.returncode, r.stdout[-1000:]))
    r, files, _ = run_job(port, "l", {"width": 900, "height": 510, "method": "lanczos"})
    check("LIVE lanczos: no ComfyUI asked, 900x510", r.returncode == 0 and files and size(files[0]) == (900, 510)
          and "engine=comfy" not in r.stdout, (r.returncode, r.stdout[-600:]))
finally:
    stub.kill(); stub.wait()
stub, port = start_stub({"STUB_SEEDVR2_KEEP_SIZE": "1"})
try:
    r, files, _ = run_job(port, "k", {"width": 600, "height": 340, "method": "seedvr2"})
    check("LIVE the source's own size handed back = fails in words, no file", r.returncode != 0 and not files
          and "nothing was upscaled" in r.stdout and "imgupscale_queued.json" in r.stdout, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()
stub, port = start_stub({}, bare)
try:
    r, files, _ = run_job(port, "n", {"width": 600, "height": 340, "method": "model"})
    check("LIVE no upscale model = fails in words (models/upscale_models, or SeedVR2 / Lanczos)", r.returncode != 0 and not files
          and "models/upscale_models" in r.stdout, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()
r, files, _ = run_job(1, "x", {"width": 600, "height": 340, "method": "seedvr2"})
check("LIVE no ComfyUI = fails in words, says Lanczos needs none", r.returncode != 0 and not files and "Lanczos" in r.stdout, r.stdout[-500:])

print("\n%d failed" % len(FAILED) if FAILED else "\nALL PASS")
sys.exit(1 if FAILED else 0)
