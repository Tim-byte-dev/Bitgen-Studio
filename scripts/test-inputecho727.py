#!/usr/bin/env python3
"""bitGen Studio — 2.727.0: an upscale that handed back its own SOURCE.
Tim sent ..._seedvr2_1080p.mp4 to put on the website - it was 960x544, exactly the LTX clip it was made from. Since
ComfyUI PR #15637 (2026-08-30) LoadVideo reports a preview of the file it was GIVEN ({"type": "input"}) in the
history's outputs, ahead of SaveVideo; the workers took "the first video" = the source, muxed it and named it by the
size ASKED for.
  1. comfy_client.is_input_echo + output_videos / output_images / output_audio skip a LoadVideo's input preview,
     keep the saved and temp results in node order;
  2. seedvr2_graph.size_verdict: ok within a few pixels, "source" = exactly the source's size, "off" = another size,
     "unknown" = no size read;
  3. LIVE on the stub ComfyUI (which now echoes LoadVideo's input first, as ComfyUI does): a 960x544 clip -> 1080p
     comes back 1906x1080 and is named _1080p; the stub really put an input preview first in the history; with a
     ComfyUI that hands back the source's size the job FAILS in words and writes no file.
Run from repo root: python3 scripts/test-inputecho727.py"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import comfy_client as CC  # noqa: E402
import seedvr2_graph as SV  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


# 1 the helper and the pickers
echo = {"filename": "take.mp4", "subfolder": "", "type": "input"}
saved = {"filename": "bitgen_seedvr2/j_00001_.mp4", "subfolder": "", "type": "output"}
temp = {"filename": "prev.webm", "subfolder": "", "type": "temp"}
outs = {"1": {"images": [echo], "animated": [True]}, "15": {"images": [saved], "animated": [True]}, "16": {"gifs": [temp]}}
check("is_input_echo: type input yes; output / temp / no type / not a dict no",
      CC.is_input_echo(echo) and CC.is_input_echo({"filename": "a.mp4", "type": "INPUT"})
      and not CC.is_input_echo(saved) and not CC.is_input_echo(temp) and not CC.is_input_echo({"filename": "a.mp4"})
      and not CC.is_input_echo(None))
check("output_videos: LoadVideo's input preview skipped, SaveVideo first, temp kept", CC.output_videos(outs) == [saved, temp],
      CC.output_videos(outs))
check("output_images skips an input picture; output_audio an input sound",
      CC.output_images({"1": {"images": [{"filename": "ref.png", "type": "input"}, {"filename": "o.png", "type": "output"}]}})
      == [{"filename": "o.png", "type": "output"}]
      and CC.output_audio({"1": {"audio": [{"filename": "v.wav", "type": "input"}]}, "9": {"audio": [{"filename": "s.flac", "type": "output"}]}})
      == [{"filename": "s.flac", "type": "output"}])
src = (ROOT / "misc" / "seedvr2_worker.py").read_text(encoding="utf-8")
check("every hand-rolled first_video skips the echo (seedvr2 / rtxvfx / dlss5 / ltx / viggle / graph) and worker.py's ranking does",
      all("is_input_echo(it)" in (ROOT / "misc" / f).read_text(encoding="utf-8")
          for f in ("seedvr2_worker.py", "rtxvfx_worker.py", "dlss5_worker.py", "ltx_worker.py", "viggle_worker.py", "graph_worker.py"))
      and 'str(it.get("type", "")).lower() != "input"' in (ROOT / "misc" / "worker.py").read_text(encoding="utf-8"))

# 2 size_verdict
check("size_verdict ok: 1904x1080 for 1906x1080 (pad / even trim)", SV.size_verdict(960, 544, 1906, 1080, 1904, 1080)[0] == "ok")
v, m = SV.size_verdict(960, 544, 1906, 1080, 960, 544)
check("size_verdict source: 960x544 back for 1906x1080 - says nothing was upscaled", v == "source" and "960x544" in m
      and "1906x1080" in m and "nothing was upscaled" in m, m)
v, m = SV.size_verdict(960, 544, 1906, 1080, 1280, 720)
check("size_verdict off: another size, said with both", v == "off" and "1280x720" in m and "1906x1080" in m, m)
check("size_verdict unknown: nothing read", SV.size_verdict(960, 544, 1906, 1080, None, 0)[0] == "unknown"
      and SV.size_verdict(960, 544, 1906, 1080, "x", 1)[0] == "unknown")
check("the worker names the file by the size it IS and fails on the source's size",
      "SV.size_verdict(" in src and 'if verdict == "source":\n        fail(vmsg)' in src and "_seedvr2_{real}p.mp4" in src
      and "_seedvr2_{min(exp_w, exp_h)}p" not in src)

# 3 LIVE
T = Path(tempfile.mkdtemp(prefix="ie727_"))
models = T / "models"
(models / "diffusion_models").mkdir(parents=True)
(models / "vae").mkdir()
(models / "diffusion_models" / "seedvr2_7b_sharp_fp16.safetensors").write_bytes(b"x")
(models / "vae" / "seedvr2_ema_vae_fp16.safetensors").write_bytes(b"x")


def start_stub(extra):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    p = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                         env=dict(os.environ, STUB_MODELS_ROOT=str(models), **extra),
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return p, port


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "json", str(p)], capture_output=True, text=True)
    s = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
    return s.get("width"), s.get("height")


def run_job(port, name):
    jd = T / name
    jd.mkdir()
    job = {"params": {"mode": "seedvr2", "source": str(clip), "width": 1906, "height": 1080, "chunk": "off", "seed": 1},
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "seedvr2_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=180)
    return r, sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else []


clip = T / "20261108-233101_fb2dc998b908.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=960x544:rate=24",
                "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=32000", "-t", "1.5", "-pix_fmt", "yuv420p",
                "-c:v", "libx264", "-c:a", "aac", str(clip)], check=True)
stub, port = start_stub({})
try:
    r, files = run_job(port, "j1")
    wh = probe(files[0]) if files else None
    check("LIVE 960x544 -> 1080p: 1906x1080 written, named _1080p (not the source handed back)",
          r.returncode == 0 and files and files[0].name == "20261108-233101_fb2dc998b908_seedvr2_1080p.mp4"
          and wh is not None and abs(wh[0] - 1906) <= 4 and wh[1] == 1080 and "WARNING" not in r.stdout,
          (r.returncode, wh, r.stdout[-1200:]))
    hist = {}
    for f in (T / f"out{port}").glob("video_*.json"):
        hist = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/history/{f.stem[6:]}", timeout=5).read())
    first = next(iter((next(iter(hist.values()), {}) or {}).get("outputs", {}).values()), {})
    check("LIVE the stub put LoadVideo's input preview FIRST in the history, as ComfyUI does",
          (first.get("images") or [{}])[0].get("type") == "input", hist)
finally:
    stub.kill(); stub.wait()
stub, port = start_stub({"STUB_SEEDVR2_KEEP_SIZE": "1"})
try:
    r, files = run_job(port, "j2")
    check("LIVE a ComfyUI that hands back the source's size: the job fails in words, no file",
          r.returncode != 0 and "nothing was upscaled" in r.stdout and "960x544" in r.stdout and not files,
          (r.returncode, files, r.stdout[-800:]))
finally:
    stub.kill(); stub.wait()

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
