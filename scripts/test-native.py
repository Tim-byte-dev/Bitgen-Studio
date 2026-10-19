#!/usr/bin/env python3
"""bitGen Studio — 2.352.0: the native engine behind Viggle (native), the app-Python side (no torch needed).
Run: python3 scripts/test-native.py [--tiny <python with torch + diffusers>]

Tim: "the viggle doesn't render at all now, 200sec elapsed and no steps started" (Viggle (native) in
2.351 held the 66 GB transformer in bf16 AND a pinned copy - over his 128 GB). It now runs on a resident
server that keeps it int8 in RAM, streamed block by block, loaded between segments.
  1. native_client + a FAKE venv whose python runs the stub server: start, reuse, run, the words on a
     failure, to_video's master + trim, the ComfyUI hand-back;
  2. viggle_native_worker.py end to end on the server, and its words when not installed;
  3. fetch.py: the component lists, the text encoder's shard pick;
  4. --tiny: scripts/native/test_tiny.py - the REAL diffusers pipeline (the engine core).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
import native_client as NC      # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:500]))


tmp = Path(tempfile.mkdtemp(prefix="native_"))

# ---- 1. the client + the stub server in a fake venv
fake = tmp / "venv" / "bin"
fake.mkdir(parents=True)
py = fake / "python"
py.write_text(f"#!/bin/sh\nexport STUB_NATIVE_LOG_DIR={tmp}\nexec {sys.executable} {ROOT / 'scripts' / 'stub-native-server.py'} \"$@\"\n")
py.chmod(0o755)
port = 8396
n = {"python": str(py), "port": port, "log_dir": str(tmp / "logs"), "app_dir": str(tmp)}
said = []
base = NC.ensure(n, said.append)
check("ensure: no server -> the venv's server started detached, answered /health", NC.health(base)["ok"] and any("starting the engine server" in s for s in said), said)
said2 = []
NC.ensure(n, said2.append)
check("ensure: a running server is reused (not started twice)", not any("starting" in s for s in said2), said2)
fin = NC.run(base, "h3", {"workflow": "t2va", "prompt": "p", "num_frames": 124, "width": 64, "height": 32, "steps": 4, "seed": 1,
                          "out_frames": str(tmp / "a.rgb"), "out_audio": str(tmp / "a.f32")}, said.append)
check("run: the NDJSON lines come through, the meta at the end", fin["meta"]["frames"] == 124 and any("[native] stub engine: h3 t2va 124f 64x32" in s for s in said))
NC.to_video(fin["meta"], tmp / "a.rgb", tmp / "a.f32", tmp / "a.raw.avi", tmp / "a.mp4",
            ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac"], say=said.append, keep=56)
probe = lambda f, e="stream=nb_read_frames": subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", e,  # noqa: E731
                                                              "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout.strip()
aud = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(tmp / "a.raw.avi")], capture_output=True, text=True).stdout
check("to_video: an FFV1 master with PCM audio, and the playback file, both cut to the 56 frames kept",
      probe(tmp / "a.raw.avi") == "56" and probe(tmp / "a.mp4") == "56" and "ffv1" in aud and "pcm_s24le" in aud, (aud, probe(tmp / "a.mp4")))
try:
    NC.run(base, "h3", {"workflow": "t2va", "prompt": "p", "num_frames": 124, "width": 64, "height": 32, "steps": 4, "seed": 666,
                        "out_frames": str(tmp / "b.rgb")}, said.append)
    check("run: the engine's failure is a NativeError in its own words", False)
except NC.NativeError as e:
    check("run: the engine's failure is a NativeError in its own words", "NaN / inf pixels" in str(e), str(e))
NC.shutdown(base)
time.sleep(0.6)
check("shutdown: the server is gone", NC.health(base) is None)
try:
    NC.ensure({"python": str(tmp / "none" / "python"), "port": 8395}, said.append)
    check("ensure: no venv -> the swap dialog's ⚙ -> Viggle native -> ⤓ Install", False)
except NC.NativeError as e:
    check("ensure: no venv -> the swap dialog's ⚙ -> Viggle native -> ⤓ Install", "Viggle native -> ⤓ Install" in str(e), str(e))

# ---- 2. viggle_native_worker on the server
if shutil.which("ffmpeg") and shutil.which("node"):
    cfg = json.loads(subprocess.run(["node", "-e", f"process.stdout.write(JSON.stringify(require({json.dumps(str(ROOT / 'lib' / 'core'))}).resolvedConfig()))"],
                                    capture_output=True, text=True, cwd=str(ROOT)).stdout)
    cfg["engine"]["comfy"]["url"] = "http://127.0.0.1:1"
    cfg["native"] = dict(cfg.get("native") or {}, port=8394, python=str(py), base=str(tmp / "base"), log_dir=str(tmp / "logs"),
                         sources={c: {"official": str(tmp / c)} for c in ("vae", "audio_vae", "viggle")}, idle_exit_min=5)
    cfg["native"]["sources"]["viggle_lora"] = {"official": str(tmp / "lora.safetensors")}
    cfg["native"]["sources"]["viggle_assets"] = {"official": str(tmp / "embed.pt")}
    ref = tmp / "ref.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=64x64", "-frames:v", "1", str(ref)], check=True)

    def work(params, worker="viggle_native_worker.py", c=None):
        wd = Path(tempfile.mkdtemp(prefix="wj_", dir=tmp))
        out = tmp / "out"
        (wd / "job.json").write_text(json.dumps({"params": params, "config": c or cfg, "app_dir": str(ROOT), "models_dir": str(ROOT / "models"),
                                                 "output_dir": str(out)}))
        r = subprocess.run([sys.executable, str(ROOT / worker), "job.json"], cwd=wd, capture_output=True, text=True, timeout=600)
        name = next((ln[6:].strip() for ln in r.stdout.splitlines() if ln.startswith("@@OUT ")), "")
        return r.returncode, r.stdout, (out / name if name else None)
    src = tmp / "movie.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-f", "lavfi", "-i",
                    "sine=frequency=330:sample_rate=48000", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(src)], check=True)
    vp = {"mode": "viggle_native", "video": str(src), "image": str(ref), "start": 0.5, "frames": 48, "render_frames": 124, "width": 64, "height": 32,
          "seed": 11, "steps": 4, "shift": 3}
    code, log, f = work(vp)
    a = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout if f else ""
    check("viggle worker: on the shared server - 124 rendered, 48 kept, the clip's own audio on",
          code == 0 and probe(f) == "48" and "audio" in a and "stub engine: viggle ref2va 124f 64x32" in log and "LoRA lora.safetensors @ 1.0" in log,
          (code, log[-600:]))
    c3 = json.loads(json.dumps(cfg))
    c3["native"]["sources"].pop("viggle")
    code, log, f = work(vp, c=c3)
    check("viggle worker: not installed -> what is missing, in words", code == 1 and "Viggle (native) is not installed yet - missing viggle" in log, log[-300:])
    NC.shutdown("http://127.0.0.1:8394")
else:
    print("(ffmpeg / node missing - the worker checks are skipped)")

# ---- 3. fetch.py
r = subprocess.run([sys.executable, str(ROOT / "scripts" / "native" / "fetch.py"), str(tmp / "dl"), "text_encoder,transformer_ref,viggle,viggle_lora", "--dry-run"],
                   capture_output=True, text=True)
check("fetch --dry-run: base first (the text encoder's index), then the pieces asked for; the DMD LoRA is its own download (2.353.0)",
      r.returncode == 0 and "base, text_encoder, transformer_ref, viggle, viggle_lora" in r.stdout and "shards for layers < 51" in r.stdout
      and "would fetch viggle: Viggle/Viggle-Animate (transformer/*, LICENSE" in r.stdout
      and "would fetch viggle_lora: Viggle/Viggle-Animate (lora/*, LICENSE" in r.stdout, r.stdout[-600:])
sys.path.insert(0, str(ROOT / "scripts" / "native"))
import fetch as FE   # noqa: E402
idx = tmp / "idx.json"
wm = {"model.language_model.layers.0.x": "model-1.safetensors", "model.language_model.layers.50.x": "model-2.safetensors",
      "model.language_model.layers.51.x": "model-3.safetensors", "model.visual.blocks.0.x": "model-1.safetensors", "lm_head.weight": "model-4.safetensors"}
idx.write_text(json.dumps({"weight_map": wm}))
check("the text encoder: only the shards holding layers < 51 + the vision tower (no lm_head, no layers 51+)",
      FE.te_shards(str(idx)) == ["model-1.safetensors", "model-2.safetensors"], FE.te_shards(str(idx)))

# ---- 4. --tiny
if "--tiny" in sys.argv:
    tpy = sys.argv[sys.argv.index("--tiny") + 1]
    r = subprocess.run([tpy, str(ROOT / "scripts" / "native" / "test_tiny.py")], capture_output=True, text=True)
    check("--tiny: the REAL diffusers pipeline (scripts/native/test_tiny.py)", r.returncode == 0 and "RESULT:" in r.stdout and " 0 failed" in r.stdout,
          (r.stdout[-1200:], r.stderr[-600:]))
shutil.rmtree(tmp, ignore_errors=True)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
