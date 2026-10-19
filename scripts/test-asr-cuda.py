#!/usr/bin/env python3
"""Regression test: faster-whisper must fall back to CPU when the CUDA
libraries CTranslate2 links against are missing, rather than failing outright.

Reproduces the exact Windows error ("Library cublas64_12.dll is not found or
cannot be loaded") with a stand-in faster_whisper module.
Run from repo root: python3 scripts/test-asr-cuda.py
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# CTranslate2 loads cuBLAS lazily, so the DLL error can surface at THREE
# different points. All three must be caught and retried on CPU — an earlier
# version only handled the first, which is why this suite passed while real
# transcription still failed.
#   load      : raised by WhisperModel(...)
#   transcribe: raised by model.transcribe(...)
#   iterate   : raised while draining the returned GENERATOR (the common one,
#               because transcribe() does no work until it is consumed)
FAKE = '''
FAIL_AT = "%s"
class _Info:
    duration = 2.0
    language = "en"
def _boom():
    raise RuntimeError("Library cublas64_12.dll is not found or cannot be loaded")
class WhisperModel:
    def __init__(self, model, device=None, compute_type=None, download_root=None):
        self.gpu = device is None or device == "auto" or device.startswith("cuda")
        if self.gpu and FAIL_AT == "load":
            _boom()
        self.device = device
    def transcribe(self, audio, **kw):
        if self.gpu and FAIL_AT == "transcribe":
            _boom()
        gpu = self.gpu
        def gen():
            if gpu and FAIL_AT == "iterate":
                _boom()
            class S:
                start, end, text, words = 0.0, 2.0, "ok", []
            yield S()
        return gen(), _Info()
'''
fails = 0

def check(name, cond, got=""):
    global fails
    if cond:
        print("PASS: " + name)
    else:
        fails += 1
        print(f"FAIL: {name}\n      got {got}")

def run_case(fail_at):
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / "faster_whisper.py").write_text(FAKE % fail_at)
        job = Path(td) / "job.json"
        job.write_text(json.dumps({"audio": "x.wav", "model": "base",
                                   "device": "auto", "mode": "speech"}))
        env = dict(os.environ, PYTHONPATH=td)
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "asr_local.py"), str(job)],
                           capture_output=True, text=True, env=env)
        out = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
        try:
            d = json.loads(out)
        except Exception:
            d = {}
        return r, d, out


for where in ("load", "transcribe", "iterate"):
    r, d, out = run_case(where)
    check(f"cublas failure at {where}: does not abort", r.returncode == 0,
          (r.stderr or out)[-220:])
    check(f"cublas failure at {where}: a transcript is still returned",
          d.get("text") == "ok", out[:160])
    check(f"cublas failure at {where}: the result records the CPU fallback",
          str(d.get("device", "")).startswith("cpu (fell back"), d.get("device"))

r, d, out = run_case("load")
check("the log names the missing CUDA libraries and how to fix them",
      "cublas" in r.stderr.lower() and "nvidia-cudnn-cu12" in r.stderr, r.stderr[-160:])

with tempfile.TemporaryDirectory() as td:
    (Path(td) / "faster_whisper.py").write_text(FAKE % "load")
    job = Path(td) / "job.json"
    job.write_text(json.dumps({"audio": "x.wav", "model": "base",
                               "device": "cpu", "mode": "speech"}))
    env = dict(os.environ, PYTHONPATH=td)
    r2 = subprocess.run([sys.executable, str(ROOT / "scripts" / "asr_local.py"), str(job)],
                        capture_output=True, text=True, env=env)
    check("device=cpu goes straight to CPU with no failed GPU attempt",
          r2.returncode == 0 and "GPU run failed" not in r2.stderr, r2.stderr[-160:])

print("=" * 30)
print("ALL PASS" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
