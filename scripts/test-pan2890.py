#!/usr/bin/env python3
"""bitGen Studio — 2.890.0: PAN 2 (MBZUAI's world model) in ComfyUI's own nodes.
Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"
  1. scripts/pan2_graph.py: the graph wired as ComfyUI's PAN 2 support needs it (CLIPLoader type pan2, the Wan 2.2 VAE,
     Wan22ImageToVideoLatent with / without the start picture, ModelSamplingAuraFlow shift 9, KSampler euler / simple 50 steps
     cfg 2.5, CreateVideo 24 fps), the files picked from what ComfyUI lists (int8 before bf16, missing ones named with the
     add-on), 4n+1 frames, 32-px sizes;
  2. LIVE on the stub ComfyUI: text to video and image to video render at the size and length asked, the reference sound
     laid under; a ComfyUI without PAN 2 and missing files each fail in words.
Run from repo root: python3 scripts/test-pan2890.py"""
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
import pan2_graph as PG  # noqa: E402

FAILED, PASSED = [], []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    (PASSED if cond else FAILED).append(name)


CAP = json.dumps({"video_style": "x", "lighting": "y", "perspective_view": "z", "subjects_lifecycle": [],
                  "init_frame_visual_description": "a", "events": [], "quality": {}})
# 1 the graph
g, notes = PG.build({"model": "pan2_int8_convrot.safetensors", "te": "qwen3.5_9b_int8_convrot.safetensors", "vae": "wan2.2_vae.safetensors",
                     "prompt": CAP, "negative": "{\"video_style\":\"blur\"}", "width": 1248, "height": 704, "frames": 241, "seed": 5, "prefix": "p/x"})
ct = {k: v["class_type"] for k, v in g.items()}
inv = {v: k for k, v in ct.items()}
I = lambda c: g[inv[c]]["inputs"]   # noqa: E731
check("graph: ComfyUI's own nodes only (no custom pack), text to video = no LoadImage", set(ct.values()) == set(PG.REQUIRED), sorted(ct.values()))
check("graph: CLIPLoader type pan2 with the Qwen3.5 9B file; UNETLoader the PAN 2 model; VAELoader the Wan 2.2 VAE",
      I("CLIPLoader") == {"clip_name": "qwen3.5_9b_int8_convrot.safetensors", "type": "pan2", "device": "default"}
      and I("UNETLoader")["unet_name"] == "pan2_int8_convrot.safetensors" and I("VAELoader") == {"vae_name": "wan2.2_vae.safetensors"})
encs = [k for k, c in ct.items() if c == "CLIPTextEncode"]
check("graph: the caption -> positive, the negative -> negative, both on the pan2 CLIPLoader",
      len(encs) == 2 and I("KSampler")["positive"] == [encs[0], 0] and I("KSampler")["negative"] == [encs[1], 0]
      and g[encs[0]]["inputs"]["text"] == CAP and g[encs[1]]["inputs"]["text"].startswith("{") and all(g[e]["inputs"]["clip"] == [inv["CLIPLoader"], 0] for e in encs))
check("2.899.1: the shift node is ModelSamplingAuraFlow (multiplier 1.0, like PAN 2's own config) - never ModelSamplingSD3 (multiplier 1000: every step read as t = 1, a WHITE take)",
      not any(v["class_type"] == "ModelSamplingSD3" for v in g.values()) and "ModelSamplingAuraFlow" in PG.REQUIRED and "ModelSamplingSD3" not in PG.REQUIRED)
check("graph: PAN 2's defaults - 50 steps, cfg 2.5, euler / simple, denoise 1, shift 9 on ModelSamplingAuraFlow, the seed",
      I("KSampler")["steps"] == 50 and I("KSampler")["cfg"] == 2.5 and I("KSampler")["sampler_name"] == "euler"
      and I("KSampler")["scheduler"] == "simple" and I("KSampler")["denoise"] == 1.0 and I("ModelSamplingAuraFlow")["shift"] == 9.0
      and I("KSampler")["seed"] == 5 and I("KSampler")["model"] == [inv["ModelSamplingAuraFlow"], 0])
check("graph: Wan22ImageToVideoLatent 1248x704x241 on the VAE -> the sampler's latent; decode -> CreateVideo 24 fps -> SaveVideo",
      I("Wan22ImageToVideoLatent") == {"vae": [inv["VAELoader"], 0], "width": 1248, "height": 704, "length": 241, "batch_size": 1}
      and I("KSampler")["latent_image"] == [inv["Wan22ImageToVideoLatent"], 0] and I("CreateVideo")["fps"] == 24.0
      and I("SaveVideo")["filename_prefix"] == "p/x" and "text to video" in notes[-1])
g2, n2 = PG.build({"model": "m", "te": "t", "vae": "v", "prompt": CAP, "width": 1000, "height": 720, "frames": 100, "image": "first.png",
                   "steps": 30, "cfg": 3, "shift": 7, "loras": [{"name": "a.safetensors", "strength": 0.7}]})
c2 = {v["class_type"]: k for k, v in g2.items()}
check("graph: image to video - LoadImage -> start_image; size snapped down to 32 px (992x704), frames to 4n+1 (97), own steps / cfg / shift, a LoRA on the model",
      g2[c2["Wan22ImageToVideoLatent"]]["inputs"]["start_image"] == [c2["LoadImage"], 0] and g2[c2["LoadImage"]]["inputs"]["image"] == "first.png"
      and g2[c2["Wan22ImageToVideoLatent"]]["inputs"]["width"] == 992 and g2[c2["Wan22ImageToVideoLatent"]]["inputs"]["height"] == 704
      and g2[c2["Wan22ImageToVideoLatent"]]["inputs"]["length"] == 97 and g2[c2["KSampler"]]["inputs"]["steps"] == 30
      and g2[c2["KSampler"]]["inputs"]["cfg"] == 3.0 and g2[c2["ModelSamplingAuraFlow"]]["inputs"]["shift"] == 7.0
      and g2[c2["ModelSamplingAuraFlow"]]["inputs"]["model"] == [c2["LoraLoaderModelOnly"], 0] and any("32-px" in n for n in n2), g2)
try:
    PG.build({"model": "m", "te": "t", "vae": "v", "prompt": " "})
    bad = False
except ValueError:
    bad = True
check("graph: no caption = refused", bad)
p = PG.pick(["stub-unet.safetensors", "pan2_bf16.safetensors", "pan2_int8_convrot.safetensors", "japan2x.safetensors"],
            ["qwen3.5_9b_w4a8_gptq.safetensors", "qwen3.5_9b_int8_convrot.safetensors", "umt5.safetensors"], ["Wan2.1_VAE.safetensors", "wan2.2_vae.safetensors"])
check("pick: int8 before bf16, the int8 Qwen3.5 9B, the Wan 2.2 VAE (not 2.1), never a name that only contains pan2",
      p["model"] == "pan2_int8_convrot.safetensors" and p["te"] == "qwen3.5_9b_int8_convrot.safetensors" and p["vae"] == "wan2.2_vae.safetensors" and not p["error"], p)
p = PG.pick(["pan2_bf16.safetensors"], ["sub/qwen3.5_9b_int8_convrot.safetensors"], ["wan2.2_vae.safetensors"], model="PAN2/pan2_bf16.safetensors")
check("pick: the style's model found by its file name in a subfolder; bf16 warned about memory",
      p["model"] == "pan2_bf16.safetensors" and any("80 GB" in n for n in p["notes"]) and p["te"] == "sub/qwen3.5_9b_int8_convrot.safetensors", p)
p = PG.pick(["stub-unet.safetensors"], ["clip_l.safetensors"], ["Wan2.1_VAE.safetensors"])
check("pick: nothing listed = every missing file named + Settings ▸ Add-ons ▸ PAN 2", p["error"] and "pan2_int8_convrot" in p["error"]
      and "qwen3.5_9b_int8_convrot" in p["error"] and "wan2.2_vae" in p["error"] and "Add-ons ▸ PAN 2" in p["error"], p)
check("frames: 4n+1, 5..481", PG.frames_ok(241) == 241 and PG.frames_ok(500) == 481 and PG.frames_ok(242) == 241 and PG.frames_ok(2) == 5)

core_js = (ROOT / "lib" / "core.js").read_text(encoding="utf-8")
check("wired: core runs mode pan2 with misc/pan2_worker.py; routes/index mounts routes/pan2; nothing added to misc/server.js",
      'pan2: "pan2_worker.py"' in core_js and 'require("./pan2").mount(app)' in (ROOT / "routes" / "index.js").read_text(encoding="utf-8")
      and "pan2" not in (ROOT / "misc" / "server.js").read_text(encoding="utf-8").lower())

# 2 LIVE
T = Path(tempfile.mkdtemp(prefix="pan2_890_"))
models = T / "models"
for sub in ("diffusion_models", "text_encoders", "vae"):
    (models / sub).mkdir(parents=True)
(models / "diffusion_models" / "pan2_int8_convrot.safetensors").write_bytes(b"x")
(models / "text_encoders" / "qwen3.5_9b_int8_convrot.safetensors").write_bytes(b"x")
(models / "vae" / "wan2.2_vae.safetensors").write_bytes(b"x")


def start_stub(extra, mroot=models):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    pr = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                          env=dict(os.environ, STUB_MODELS_ROOT=str(mroot), **extra), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return pr, port


def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,nb_frames,r_frame_rate:format=duration", "-of", "json", str(f)],
                       capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    st = d.get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    return v.get("r_frame_rate"), float((d.get("format") or {}).get("duration") or 0), any(s.get("codec_type") == "audio" for s in st)


def run_job(port, name, params):
    jd = T / name
    jd.mkdir()
    job = {"params": dict({"mode": "pan2", "pan2_mode": "t2v", "prompt": CAP, "negative": "{}", "width": 1248, "height": 704,
                           "frames": 49, "seed": 3}, **params),
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "pan2_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=240)
    return r, sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else [], jd


pic = T / "first.png"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360", "-frames:v", "1", str(pic)], check=True)
snd = T / "song.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=32000", "-t", "4", str(snd)], check=True)
stub, port = start_stub({})
try:
    r, files, jd = run_job(port, "a", {"output_name": "pan2t"})
    fr = probe(files[0]) if files else None
    q = json.loads((jd / "pan2_queued.json").read_text()) if (jd / "pan2_queued.json").exists() else {}
    check("LIVE text to video: 49 frames at 24 fps (about 2 s), named _pan2, the queued graph on the stub's int8 / Qwen / Wan 2.2 files",
          r.returncode == 0 and files and files[0].name == "pan2t_pan2.mp4" and fr and fr[0] == "24/1" and abs(fr[1] - 49 / 24) < 0.15
          and any(v["inputs"].get("unet_name") == "pan2_int8_convrot.safetensors" for v in q.values())
          and any(v["inputs"].get("type") == "pan2" for v in q.values()) and "[meta]" in r.stdout and "PAN 2 makes no sound" in r.stdout,
          (r.returncode, fr, r.stdout[-1500:]))
    r, files, jd = run_job(port, "b", {"pan2_mode": "i2v", "image": str(pic), "frames": 25, "audio": {"path": str(snd), "start": 0.5}})
    fr = probe(files[0]) if files else None
    q = json.loads((jd / "pan2_queued.json").read_text()) if (jd / "pan2_queued.json").exists() else {}
    check("LIVE image to video: the picture uploaded and LoadImage -> start_image, the sound laid under, 25 frames",
          r.returncode == 0 and files and fr and fr[2] is True and abs(fr[1] - 25 / 24) < 0.15 and "uploaded the first picture" in r.stdout
          and any(v["class_type"] == "LoadImage" for v in q.values())
          and any("start_image" in v["inputs"] for v in q.values() if v["class_type"] == "Wan22ImageToVideoLatent"), (r.returncode, fr, r.stdout[-1200:]))
finally:
    stub.kill(); stub.wait()

stub, port = start_stub({"STUB_PAN2_ABSENT": "1"})
try:
    r, files, _ = run_job(port, "c", {})
    check("LIVE a ComfyUI older than its PAN 2 support: fails naming it + update ComfyUI, no file",
          r.returncode != 0 and ("pan2" in r.stdout or "Wan22ImageToVideoLatent" in r.stdout) and "update ComfyUI" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

bare = T / "bare"
for sub in ("diffusion_models", "text_encoders", "vae"):
    (bare / sub).mkdir(parents=True)
stub, port = start_stub({}, bare)
try:
    r, files, _ = run_job(port, "d", {})
    check("LIVE the files missing: fails naming them and Settings ▸ Add-ons ▸ PAN 2",
          r.returncode != 0 and "pan2_int8_convrot" in r.stdout and "Add-ons ▸ PAN 2" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

print()
print(f"RESULT: {len(PASSED)} passed, {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
