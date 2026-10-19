#!/usr/bin/env python3
"""bitGen Studio — 2.401.3: live step lines for every ComfyUI worker (scripts/comfy_progress.py).
Tim: "wan2.2 is not creating a step ... after 3 minutes".
  1. comfy_progress.run against the stub ComfyUI (its /ws sends a status, executing, 4 legacy progress frames and a
     progress_state batch): "[worker] queued as", "[comfy] running <class>", "[comfy] step v/m - <class>" (both
     message shapes), the outputs back; the heartbeat only while the socket is quiet;
  2. a rejected graph still raises ComfyError (the listener stopped);
  3. wan_worker LIVE: its job log has "[comfy] step" lines now (lib/jobMeta reads them as "step n of total");
  4. every ComfyUI worker queues through it (wan, ltx, ripple, seedvr2, swap, viggle, graph, music) and worker.py's
     listener delegates to it.
Run from repo root: python3 scripts/test-comfyprogress.py"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import comfy_client as CC  # noqa: E402
import comfy_progress as CP  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


T = Path(tempfile.mkdtemp(prefix="cp4013_"))
models = T / "models"
(models / "diffusion_models").mkdir(parents=True)
(models / "text_encoders").mkdir()
(models / "text_encoders" / "umt5_xxl_fp8_e4m3fn_scaled.safetensors").write_bytes(b"x")
for nm in ("wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"):
    (models / "diffusion_models" / nm).write_bytes(b"x")
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / "out")],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = f"http://127.0.0.1:{port}"
try:
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    said = []
    g = {"125": {"class_type": "KSampler", "inputs": {k: 1 for k in ("model", "seed", "steps", "cfg", "sampler_name", "scheduler",
                                                                       "positive", "negative", "latent_image", "denoise")}},
         "9": {"class_type": "SaveVideo", "inputs": {"video": ["125", 0], "filename_prefix": "cp", "format": "auto"}}}
    pid, outs = CP.run(CC, base, g, said.append, "rendering", timeout=60)
    steps = [l for l in said if l.startswith("[comfy] step ")]
    check("run: queued as <pid>, [comfy] running KSampler, step lines from BOTH ws shapes, the outputs back",
          pid and f"[worker] queued as {pid}" in said and any(l.startswith("[comfy] running KSampler") for l in said)
          and len(steps) >= 2 and all(re.match(r"\[comfy\] step \d+/\d+", l) for l in steps) and isinstance(outs, dict) and outs,
          said[:20])
    check("run: no '[worker] rendering... Ns' heartbeat while the socket is talking",
          not any(l.startswith("[worker] rendering...") for l in said), said)
    try:
        CP.run(CC, base, {"1": {"class_type": "E2E_Reject", "inputs": {}}}, said.append, timeout=20)
        check("a rejected graph raises ComfyError", False)
    except CC.ComfyError as e:
        check("a rejected graph raises ComfyError (the listener stopped)", "rejected" in str(e).lower(), str(e)[:200])

    # 3 wan_worker LIVE
    jd = T / "wan"
    jd.mkdir()
    job = {"params": {"mode": "wan", "wan_family": "wan22", "wan_mode": "t2v", "prompt": "a tree", "width": 320, "height": 192,
                      "frames": 17, "seed": 3, "images": {}, "video_style": {"name": "Wan 2.2", "phases": [{}, {}]}},
           "config": {"engine": {"backend": "comfy", "comfy": {"url": base}}}, "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "wan_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=180)
    check("wan_worker LIVE: '[comfy] step v/m' lines in its log now (the job's 'step n of total'), done",
          r.returncode == 0 and "@@OUT " in r.stdout and re.search(r"^\[comfy\] step \d+/\d+", r.stdout, re.M)
          and "[worker] queued as" in r.stdout, r.stdout[-1500:])
finally:
    stub.kill()
    stub.wait()
    shutil.rmtree(T, ignore_errors=True)

# 4
uses = {f: (ROOT / f).read_text(encoding="utf-8") for f in ("wan_worker.py", "ltx_worker.py", "ripple_worker.py", "seedvr2_worker.py",
                                                             "swap_worker.py", "viggle_worker.py", "graph_worker.py", "music_worker.py")}
check("every ComfyUI video / graph / music worker queues through comfy_progress.run (none polls blind)",
      all("import comfy_progress as _CP" in t and "_CP.run(_comfy, base," in t and "pid = _comfy.queue(base" not in t for t in uses.values()),
      [f for f, t in uses.items() if "_CP.run(" not in t])
w = (ROOT / "worker.py").read_text(encoding="utf-8")
check("worker.py's listener delegates to the shared one", "_cp.listen(base, client_id, stop, pidbox, g, seen, say)" in w)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
