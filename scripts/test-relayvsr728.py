#!/usr/bin/env python3
"""bitGen Studio — 2.728.0: RelayVSR + the 1920x1080 frame.
Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"
  1. scripts/relayvsr_graph.py: the core-node graph wired as ComfyUI's RelayVSR nodes need it (no negative: a guider;
     one euler step; VSR Decode reads the sampler AND the same frames), the x2 / x4 pair picked from what ComfyUI lists
     (a pair never mixed, missing files named), the keyframe count, fit_vf (the frame covered + trimmed, a short side
     scaled down, never blown up past the model's output);
  2. lib/relayvsr.js plan (node): auto = the smallest pair that reaches the size (x2 for 960x544 -> 1920x1080, x4 for
     2160p), too big refused in words; lib/seedvr2.js target("1920x1080"); the ⚙'s "1920x1080" read as 1080 by the
     factor upscalers (renderSettings.resShort);
  3. LIVE on the stub ComfyUI (RelayVSR's real schemas, LoadVideo's input echo first): 960x544 -> 1920x1080 (x2, the
     8 rows trimmed, named _relayvsr_1080p, the sound back), -> 2160p (x4), native x2; a ComfyUI without the nodes, the
     files missing and the source's size handed back each fail in words; SeedVR2 at "1920x1080" -> exactly 1920x1080.
Run from repo root: python3 scripts/test-relayvsr728.py"""
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
import relayvsr_graph as RV  # noqa: E402
import seedvr2_graph as SV  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


# 1 the graph
g, notes = RV.build({"video": "clip.mp4", "unet": "relayvsr_x2_lightx2v_int8_convrot.safetensors",
                     "vae": "relayvsr_flash_vae_x2_fp32.safetensors", "seed": 7, "detail": 0.8, "prefix": "p/x", "bit_depth": True})
ct = {k: v["class_type"] for k, v in g.items()}
inv = {v: k for k, v in ct.items()}
I = lambda c: g[inv[c]]["inputs"]   # noqa: E731
check("graph: exactly RelayVSR's core nodes (no KSampler, no prompt, no text encoder)", set(ct.values()) == set(RV.REQUIRED)
      and not any("CLIP" in c or c == "KSampler" for c in ct.values()), sorted(ct.values()))
check("graph: conditioning reads the model + the video's frames; the guider its positive, the sampler its latent",
      I("RelayVSRConditioning") == {"model": [inv["UNETLoader"], 0], "images": [inv["GetVideoComponents"], 0]}
      and I("BasicGuider")["conditioning"] == [inv["RelayVSRConditioning"], 0]
      and I("SamplerCustomAdvanced")["latent_image"] == [inv["RelayVSRConditioning"], 1], g)
check("graph: one euler step, simple, denoise 1; the seed on RandomNoise",
      I("BasicScheduler")["steps"] == 1 and I("BasicScheduler")["scheduler"] == "simple" and I("BasicScheduler")["denoise"] == 1.0
      and I("KSamplerSelect")["sampler_name"] == "euler" and I("RandomNoise")["noise_seed"] == 7)
check("graph: VSR Decode reads the Flash VAE, the sampler's output and the SAME frames; detail 0.8",
      I("VSRDecode") == {"vae": [inv["VAELoader"], 0], "samples": [inv["SamplerCustomAdvanced"], 0],
                         "images": [inv["GetVideoComponents"], 0], "detail": 0.8})
check("graph: CreateVideo at the source's fps (+ bit depth), SaveVideo under the prefix",
      I("CreateVideo") == {"images": [inv["VSRDecode"], 0], "fps": [inv["GetVideoComponents"], 2], "bit_depth": [inv["GetVideoComponents"], 3]}
      and I("SaveVideo")["filename_prefix"] == "p/x")
check("graph: detail clamped to 0..1", RV.build({"video": "a", "unet": "u", "vae": "v", "detail": 3})[0]["11"]["inputs"]["detail"] == 1.0
      and RV.build({"video": "a", "unet": "u", "vae": "v", "detail": -1})[0]["11"]["inputs"]["detail"] == 0.0)
try:
    RV.build({"video": "a", "unet": "", "vae": "v"}); refused = False
except ValueError:
    refused = True
check("graph: no model file = a ValueError naming the add-on", refused)

UN = ["relayvsr_x2_lightx2v_int8_convrot.safetensors", "sub/relayvsr_x4_int8_convrot.safetensors", "seedvr2_7b_sharp_fp16.safetensors"]
VA = ["relayvsr_flash_vae_x2_fp32.safetensors", "relayvsr_flash_vae_x4_fp32.safetensors", "ae.safetensors"]
u, v, n = RV.pick(UN, VA, 2)
check("pick x2: the x2 model + the x2 Flash decoder", (u, v) == (UN[0], VA[0]) and "x2" in n, (u, v, n))
u, v, n = RV.pick(UN, VA, 4)
check("pick x4: a subfolder copy found (ComfyUI lists sub/file), the x4 decoder", (u, v) == (UN[1], VA[1]), (u, v))
u, v, n = RV.pick(UN[:1], VA[:1], 4)
check("pick x4 with only the x2 pair: refused, naming both x4 files and the add-on (never mixed)", u == "" and
      "relayvsr_x4_int8_convrot" in n and "relayvsr_flash_vae_x4_fp32" in n and "Add-ons" in n, n)
check("keyframes: every 15th + the last (150 frames -> 11, 1 -> 1, 16 -> 2)", RV.keyframes(150) == 11 and RV.keyframes(1) == 1
      and RV.keyframes(16) == 2 and RV.keyframes(360) == 25)
check("fit_vf frame: 1920x1088 -> trimmed to 1920x1080, no scale", RV.fit_vf(1920, 1088, 1920, 1080, "crop")[0] == "crop=1920:1080")
vf, what = RV.fit_vf(3840, 2176, 1920, 1080, "crop")
check("fit_vf frame from x4: scaled to cover, then trimmed", vf == "scale=1920:1088:flags=lanczos,crop=1920:1080" and "trimmed" in what, vf)
check("fit_vf short side: 1920x1088 -> 1906x1080 (lanczos)", RV.fit_vf(1920, 1088, 1906, 1080)[0] == "scale=1906:1080:flags=lanczos")
check("fit_vf: never blown up past the model's output; the same size = nothing", RV.fit_vf(1920, 1088, 3840, 2176)[0] is None
      and "kept" in RV.fit_vf(1920, 1088, 3840, 2176)[1] and RV.fit_vf(1920, 1088, 1920, 1088) == (None, ""))
a = SV.mux_args("r.mp4", "s.mp4", "o.mp4", 0, None, 2.0, None, "scale=10:10")
b = SV.mux_args("r.mp4", "s.mp4", "o.mp4", 0, None, 2.0, (8, 8), "scale=10:10")
check("mux: the fit chain as -vf, a crop after it", a[a.index("-vf") + 1] == "scale=10:10" and b[b.index("-vf") + 1] == "scale=10:10,crop=8:8"
      and "-vf" not in SV.mux_args("r", "s", "o"))
check("seedvr2 crop_to: 1920x1088 -> (1920, 1080); smaller / equal -> None", SV.crop_to(1920, 1088, 1920, 1080) == (1920, 1080)
      and SV.crop_to(1906, 1080, 1920, 1080) is None and SV.crop_to(1920, 1080, 1920, 1080) is None)

# 2 the JS side
js = r"""
const R = require('./lib/relayvsr'), S = require('./lib/seedvr2'), RS = require('./lib/renderSettings');
const out = {
  t: S.target('1920x1080', 960, 544), big: S.target('1920x1080', 2560, 1440),
  p1: R.plan('1920x1080', 'auto', 960, 544), p2: R.plan('2160', 'auto', 960, 544), p3: R.plan('native', 'x4', 960, 544),
  p4: R.plan('2160', 'x2', 960, 544), p5: R.plan('x4', 'auto', 960, 544), p6: R.plan('2160', 'auto', 400, 300),
  n: R.normalize({ size: 'bogus', model: 'x9', detail: 7 }),
  jp: R.jobParams('/v/a.mp4', { width: 960, height: 544 }, { size: '1920x1080' }),
  sj: S.jobParams('/v/a.mp4', { width: 960, height: 544 }, { size: '1920x1080' }),
  short: RS.resShort('1920x1080'), lab: RS.resLabel('1920x1080'), ud: RS.upscaleDims('1920x1080', 960, 544),
  norm: RS.normalize({ upscale_res: '1920x1080' }).upscale_res, fromSettings: R.sizeFromSettings({ upscale_res: '1920x1080' }),
  rtx: require('./lib/rtxvfx').scaleFromSettings({ upscale_res: '1920x1080' }, { width: 960, height: 544 }),
  dl: require('./lib/dlss5').modeFromSettings({ upscale_res: '1920x1080' }),
  notes: RS.jobOverrides({ upscaler: 'relayvsr', upscale_res: '1920x1080' }, { width: 960, height: 544 }).notes,
  addon: require('./lib/addons').LIST.some((a) => a.id === 'relayvsr'),
  cat: ['relayvsr_x2', 'relayvsr_vae_x2', 'relayvsr_x4', 'relayvsr_vae_x4'].map((id) => (require('./lib/setupModels').byId(id) || {}).dest),
};
console.log(JSON.stringify(out));
"""
r = subprocess.run(["node", "-e", js], cwd=str(ROOT), capture_output=True, text=True, timeout=60)
try:
    J = json.loads(r.stdout.strip().splitlines()[-1])
except Exception:  # noqa: BLE001
    J = {}
    print(r.stderr[-1500:])
check("seedvr2 target 1920x1080 of 960x544: the frame, covered at x2 (1920x1088), fit crop",
      J.get("t", {}).get("width") == 1920 and J["t"]["height"] == 1080 and J["t"]["fit"] == "crop" and J["t"]["cover"] == {"width": 1920, "height": 1088}, J.get("t"))
check("seedvr2 target 1920x1080 of a 2560x1440: refused (already larger)", "already" in str(J.get("big", {}).get("error")), J.get("big"))
p1 = J.get("p1", {})
check("relayvsr plan 960x544 -> 1920x1080 auto: x2, made 1920x1088, fit crop", p1.get("model") == "x2" and p1.get("made") == {"width": 1920, "height": 1088}
      and p1.get("fit") == "crop" and p1.get("width") == 1920 and p1.get("height") == 1080 and p1.get("scaled"), p1)
check("relayvsr plan 2160p auto: x4 (3840x2176 made, scaled to 3812x2160)", J.get("p2", {}).get("model") == "x4" and J["p2"]["made"] == {"width": 3840, "height": 2176}
      and J["p2"]["height"] == 2160, J.get("p2"))
check("relayvsr plan native x4: 3840x2176, nothing after", J.get("p3", {}).get("width") == 3840 and J["p3"]["scaled"] is False)
check("relayvsr plan 2160p with x2 forced: refused, says pick x4", "pick x4" in str(J.get("p4", {}).get("error")), J.get("p4"))
check("relayvsr plan x4 size auto: x4", J.get("p5", {}).get("model") == "x4")
check("relayvsr plan 2160p of 400x300 (needs x7.2): refused in words", "more than RelayVSR x4" in str(J.get("p6", {}).get("error")), J.get("p6"))
check("relayvsr normalize: bad size / model fall back, detail clamped", J.get("n") == {"size": "1920x1080", "model": "auto", "detail": 1, "seed": -1}, J.get("n"))
jp = (J.get("jp") or {}).get("params", {})
check("relayvsr jobParams: mode relayvsr, 1920x1080 fit crop, factor 2, the x2 pair named, the note says trimmed",
      jp.get("mode") == "relayvsr" and jp.get("width") == 1920 and jp.get("fit") == "crop" and jp.get("factor") == 2
      and jp.get("unet") == "relayvsr_x2_lightx2v_int8_convrot.safetensors" and jp.get("vae") == "relayvsr_flash_vae_x2_fp32.safetensors"
      and "trimmed" in J["jp"]["note"], J.get("jp"))
sj = (J.get("sj") or {}).get("params", {})
check("seedvr2 jobParams 1920x1080: width/height 1920x1080, fit crop, the note says 1920x1088 trimmed",
      sj.get("width") == 1920 and sj.get("height") == 1080 and sj.get("fit") == "crop" and "1920x1088, the edges trimmed" in J["sj"]["note"], J.get("sj"))
check("the ⚙: 1920x1080 kept; read as 1080 by upscaleDims / RTX VFX / DLSS 5; said as 1920x1080; RelayVSR gets the frame",
      J.get("norm") == "1920x1080" and J.get("short") == "1080" and J.get("lab") == "1920x1080" and J.get("ud") == {"width": 1920, "height": 1088}
      and abs(J.get("rtx", 0) - 1.985) < 0.01 and J.get("dl") == "1K" and J.get("fromSettings") == "1920x1080"
      and any("RelayVSR -> 1920x1080" in x for x in J.get("notes", [])), {k: J.get(k) for k in ("norm", "short", "lab", "ud", "rtx", "dl", "notes")})
check("Settings ▸ Add-ons lists RelayVSR; the catalog holds the four files (diffusion_models + vae)", J.get("addon") is True
      and J.get("cat") == ["comfy/diffusion_models", "comfy/vae", "comfy/diffusion_models", "comfy/vae"], J.get("cat"))

core_js = (ROOT / "lib" / "core.js").read_text(encoding="utf-8")
chars = (ROOT / "routes" / "characters.js").read_text(encoding="utf-8")
check("wired: core runs mode relayvsr with misc/relayvsr_worker.py; routes/index mounts routes/relayvsr; a scene's ⏫ and "
      "'Upscale every render' go to RelayVSR with the ⚙ on it; nothing added to misc/server.js",
      'relayvsr: "relayvsr_worker.py"' in core_js and 'require("./relayvsr").mount(app)' in (ROOT / "routes" / "index.js").read_text(encoding="utf-8")
      and "return relayvsr.queueTake(project, n);" in chars and "relayvsr.onTake(project, r.n)" in chars
      and "relayvsr" not in (ROOT / "misc" / "server.js").read_text(encoding="utf-8").lower())

# 3 LIVE
T = Path(tempfile.mkdtemp(prefix="rv728_"))
models = T / "models"
for sub in ("diffusion_models", "vae"):
    (models / sub).mkdir(parents=True)
for f in ("relayvsr_x2_lightx2v_int8_convrot.safetensors", "relayvsr_x4_int8_convrot.safetensors", "seedvr2_7b_sharp_fp16.safetensors"):
    (models / "diffusion_models" / f).write_bytes(b"x")
for f in ("relayvsr_flash_vae_x2_fp32.safetensors", "relayvsr_flash_vae_x4_fp32.safetensors", "seedvr2_ema_vae_fp16.safetensors"):
    (models / "vae" / f).write_bytes(b"x")


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


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", str(p)],
                       capture_output=True, text=True)
    st = json.loads(r.stdout or "{}").get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    return v.get("width"), v.get("height"), any(s.get("codec_type") == "audio" for s in st)


def run_job(port, name, params, worker="relayvsr_worker.py"):
    jd = T / name
    jd.mkdir()
    job = {"params": dict({"source": str(clip), "seed": 3}, **params),
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / worker), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=240)
    return r, sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else [], jd


clip = T / "20261108-233101_fb2dc998b908.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=960x544:rate=24",
                "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=32000", "-t", "1.5", "-pix_fmt", "yuv420p",
                "-c:v", "libx264", "-c:a", "aac", str(clip)], check=True)
stub, port = start_stub({})
try:
    r, files, jd = run_job(port, "a", {"mode": "relayvsr", "width": 1920, "height": 1080, "fit": "crop", "factor": 2,
                                        "detail": 0.9})
    wh = probe(files[0]) if files else None
    q = json.loads((jd / "relayvsr_queued.json").read_text()) if (jd / "relayvsr_queued.json").exists() else {}
    check("LIVE 960x544 -> 1920x1080 (x2): exactly 1920x1080, the sound back, named _relayvsr_1080p, trimmed said",
          r.returncode == 0 and files and files[0].name == "20261108-233101_fb2dc998b908_relayvsr_1080p.mp4"
          and wh == (1920, 1080, True) and "trimmed to 1920x1080" in r.stdout and "WARNING" not in r.stdout,
          (r.returncode, wh, r.stdout[-1500:]))
    check("LIVE the queued graph: the x2 pair, detail 0.9, LoadVideo's echo skipped (the stub put it first)",
          any(v.get("inputs", {}).get("unet_name") == "relayvsr_x2_lightx2v_int8_convrot.safetensors" for v in q.values())
          and any(v.get("inputs", {}).get("vae_name") == "relayvsr_flash_vae_x2_fp32.safetensors" for v in q.values())
          and any(v.get("inputs", {}).get("detail") == 0.9 for v in q.values()) and "go through the model" in r.stdout, q)
    r, files, _ = run_job(port, "b", {"mode": "relayvsr", "width": 3812, "height": 2160, "factor": 4})
    wh = probe(files[0]) if files else None
    check("LIVE -> 2160p (x4): 3840x2176 made, scaled to 3812x2160, _relayvsr_2160p", r.returncode == 0 and wh and wh[:2] == (3812, 2160)
          and files[0].name.endswith("_relayvsr_2160p.mp4") and "RelayVSR x4" in r.stdout, (r.returncode, wh, r.stdout[-800:]))
    r, files, _ = run_job(port, "c", {"mode": "relayvsr", "factor": 2})
    wh = probe(files[0]) if files else None
    check("LIVE native x2: 1920x1088 as it came, _relayvsr_1088p", r.returncode == 0 and wh and wh[:2] == (1920, 1088)
          and files[0].name.endswith("_relayvsr_1088p.mp4"), (r.returncode, wh))
    r, files, _ = run_job(port, "s", {"mode": "seedvr2", "width": 1920, "height": 1080, "fit": "crop", "chunk": "off"}, "seedvr2_worker.py")
    wh = probe(files[0]) if files else None
    check("LIVE SeedVR2 at 1920x1080 of 960x544: covered (1920x1088) and trimmed to exactly 1920x1080, named _seedvr2_1080p",
          r.returncode == 0 and wh and wh[:2] == (1920, 1080) and files[0].name.endswith("_seedvr2_1080p.mp4")
          and "trimmed to 1920x1080" in r.stdout and "WARNING" not in r.stdout, (r.returncode, wh, r.stdout[-1200:]))
finally:
    stub.kill(); stub.wait()

stub, port = start_stub({"STUB_RELAYVSR_ABSENT": "1"})
try:
    r, files, _ = run_job(port, "d", {"mode": "relayvsr", "width": 1920, "height": 1080, "fit": "crop", "factor": 2})
    check("LIVE a ComfyUI without the RelayVSR nodes: fails naming them + update ComfyUI, no file",
          r.returncode != 0 and "RelayVSRConditioning" in r.stdout and "Update ComfyUI" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

bare = T / "bare"
(bare / "diffusion_models").mkdir(parents=True); (bare / "vae").mkdir()
stub, port = start_stub({}, bare)
try:
    r, files, _ = run_job(port, "e", {"mode": "relayvsr", "width": 1920, "height": 1080, "fit": "crop", "factor": 2})
    check("LIVE the model files missing: fails naming both x2 files and Settings ▸ Add-ons ▸ RelayVSR",
          r.returncode != 0 and "relayvsr_x2_lightx2v_int8_convrot" in r.stdout and "Add-ons" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

stub, port = start_stub({"STUB_RELAYVSR_KEEP_SIZE": "1"})
try:
    r, files, _ = run_job(port, "f", {"mode": "relayvsr", "width": 1920, "height": 1080, "fit": "crop", "factor": 2})
    check("LIVE a ComfyUI that hands back the source's size: fails in words (nothing was upscaled), no file",
          r.returncode != 0 and "nothing was upscaled" in r.stdout and "relayvsr_queued.json" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
