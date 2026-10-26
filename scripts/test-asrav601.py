#!/usr/bin/env python3
"""bitGen Studio — scripts/test-asrav601.py (2.600.1): transcription WITHOUT PyAV - Tim, cloning a voice with Ming:
"transcription failed: open() got an unexpected keyword argument 'metadata_errors'".

PyAV 19 removed av.open(metadata_errors=...); faster-whisper (1.2.1, the newest) still passes it when it decodes a FILE.
  asr_local.load_audio   a 16 kHz mono PCM WAV read by the standard library; anything else (an mp3, 44.1 kHz stereo)
                         through ffmpeg -> 16 kHz mono float32
  asr_local.py / asr_live.py   hand faster-whisper an ARRAY - run here with a stand-in faster_whisper that fails exactly
                         like the real one when it is given a file path
  the installer          the whisper venv gets "av<19" beside faster-whisper
Needs numpy + ffmpeg (else SKIP). Temp files only."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:900]))


W = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("the installer: the whisper venv gets faster-whisper + av<19", 'pkgs = ["faster-whisper", "av<19"]' in W)
try:
    import numpy  # noqa: F401
    have_np = True
except ImportError:
    have_np = False
if not have_np or not shutil.which("ffmpeg"):
    print("SKIP: numpy / ffmpeg missing - the audio checks did not run")
else:
    sys.path.insert(0, str(ROOT / "scripts"))
    import asr_local as A
    tmp = Path(tempfile.mkdtemp(prefix="bg-asrav-"))
    try:
        wav, mp3 = tmp / "c.wav", tmp / "c.mp3"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=3", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav)], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ar", "44100", "-ac", "2", str(mp3)], check=True)
        a, b = A.load_audio(wav), A.load_audio(mp3)
        check("load_audio: a 16 kHz mono WAV (the standard library) and an mp3 at 44.1 kHz stereo (ffmpeg) -> 16 kHz mono float32, 3 s",
              str(a.dtype) == "float32" and a.shape == (48000,) and 0.1 < float(abs(a).max()) < 1.0 and str(b.dtype) == "float32" and abs(b.shape[0] - 48000) < 2000, (a.shape, b.shape))
        try:
            A.load_audio(tmp / "nothing.wav")
            check("load_audio: a missing file = an error in words", False)
        except RuntimeError as e:
            check("load_audio: a missing file = an error in words", "could not read the audio" in str(e), e)
        stub = tmp / "stub" / "faster_whisper"
        stub.mkdir(parents=True)
        (stub / "__init__.py").write_text(
            "import numpy as np\n"
            "class _S:\n    start=0.0; end=3.0; text=' hello'; words=[]\n"
            "class _I:\n    language='en'; duration=3.0\n"
            "class WhisperModel:\n    def __init__(self,*a,**k): pass\n"
            "    def transcribe(self, audio, **kw):\n"
            "        if not isinstance(audio, np.ndarray): raise TypeError(\"open() got an unexpected keyword argument 'metadata_errors'\")\n"
            "        return iter([_S()]), _I()\n")
        env = dict(os.environ, PYTHONPATH=str(tmp / "stub"))
        job = tmp / "job.json"
        job.write_text(json.dumps({"audio": str(wav), "model": "tiny", "device": "cpu", "mode": "speech", "word_timestamps": False}))
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "asr_local.py"), str(job)], capture_output=True, text=True, env=env)
        out = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1])
        check("asr_local.py hands faster-whisper an array (a stand-in that fails like PyAV 19 on a file path): the text comes back",
              out.get("text") == "hello" and not out.get("error"), r.stdout + r.stderr[-400:])
        live = tmp / "live.json"
        live.write_text(json.dumps({"model": "tiny", "device": "cpu"}))
        r2 = subprocess.run([sys.executable, str(ROOT / "scripts" / "asr_live.py"), str(live)], input=json.dumps({"id": "u1", "audio": str(mp3)}) + "\n",
                            capture_output=True, text=True, env=env)
        lines = [json.loads(x) for x in r2.stdout.strip().splitlines() if x.strip()]
        check("asr_live.py (the 🎙 voice chat) too - an mp3 turn comes back as text", len(lines) == 2 and lines[0].get("ready") and lines[1].get("text") == "hello", r2.stdout + r2.stderr[-400:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
print(f"\n{P} passed, {F} failed")
print("RESULT: FAIL" if F else "RESULT: PASS")
sys.exit(1 if F else 0)
