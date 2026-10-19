#!/usr/bin/env python3
"""scripts/omnivoice_local.py against a FAKE omnivoice package (2.102.0).

The real model is gigabytes; what matters here is the wiring — clone / design
/ auto mode selection, the prompt cache (built, saved, reused, and NOT used
when stale), the kwargs filter, the 24 kHz wav on disk, and the JSON contract
lib/tts.js relies on. Run from repo root: python3 scripts/test-omnivoice.py
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fails = 0


def check(name, cond, got=""):
    global fails
    if cond:
        print("PASS: " + name)
    else:
        fails += 1
        print(f"FAIL: {name}\n      got {got}")


FAKE = '''
import numpy as np, json, os
__version__ = "fake-0.1"
CALLS = []
class VoiceClonePrompt:
    def __init__(self, tag): self.tag = tag
    def save(self, p):
        with open(p, "w") as fh: fh.write(json.dumps({"tag": self.tag}))
    @classmethod
    def load(cls, p):
        with open(p) as fh: return cls(json.load(fh)["tag"])
class OmniVoice:
    sample_rate = 24000
    def __init__(self): pass
    @classmethod
    def from_pretrained(cls, model_id, device_map="cuda", dtype=None):
        CALLS.append(("load", model_id, device_map))
        return cls()
    def create_voice_clone_prompt(self, ref_audio, ref_text=""):
        CALLS.append(("encode", os.path.basename(ref_audio), ref_text))
        return VoiceClonePrompt("prompt-for-" + os.path.basename(ref_audio))
    def generate(self, text, num_step=32, speed=1.0, voice_clone_prompt=None,
                 ref_audio=None, ref_text=None, instruct=None):
        mode = "clone" if (voice_clone_prompt is not None or ref_audio) else ("design" if instruct else "auto")
        CALLS.append(("gen", mode, num_step, getattr(voice_clone_prompt, "tag", None), instruct))
        with open(os.environ["FAKE_CALLS"], "w") as fh: json.dump(CALLS, fh)
        return [np.zeros(2400, dtype=np.float32)]
'''

SF = '''
def write(path, data, rate):
    import struct
    n = len(data)
    with open(path, "wb") as fh:
        fh.write(b"RIFF" + struct.pack("<I", 36 + n*2) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate*2, 2, 16)
                 + b"data" + struct.pack("<I", n*2) + b"\\x00\\x00" * n)
'''

TORCH = '''
float16 = "fp16"; float32 = "fp32"
class _C:
    def is_available(self): return False
cuda = _C()
__version__ = "fake-torch"
'''


def run(job, env):
    jf = os.path.join(env["TMP"], "job.json")
    with open(jf, "w") as fh:
        json.dump(job, fh)
    return subprocess.run([sys.executable, str(ROOT / "scripts" / "omnivoice_local.py"), jf],
                          capture_output=True, text=True, env=env)


with tempfile.TemporaryDirectory() as tmp:
    site = Path(tmp) / "site"
    (site / "omnivoice").mkdir(parents=True)
    (site / "omnivoice" / "__init__.py").write_text(FAKE)
    (site / "soundfile.py").write_text(SF)
    (site / "torch.py").write_text(TORCH)
    calls = Path(tmp) / "calls.json"
    env = dict(os.environ, PYTHONPATH=str(site), FAKE_CALLS=str(calls), TMP=tmp)
    ref = Path(tmp) / "narrator.wav"; ref.write_bytes(b"RIFF fake")
    cache = Path(tmp) / "narrator.omnivoice.pt"
    out = Path(tmp) / "out.wav"

    # ---- check op
    r = run({"op": "check"}, env)
    j = json.loads(r.stdout.strip().splitlines()[-1])
    check("op=check imports the package and reports versions without loading a model",
          j.get("ok") is True and j.get("omnivoice") == "fake-0.1", r.stdout + r.stderr)

    # ---- clone, first time: encodes and saves the cache
    r = run({"text": "hello", "out": str(out), "ref_audio": str(ref), "ref_text": "the transcript",
             "prompt_cache": str(cache), "num_step": 16, "device": "cuda"}, env)
    j = json.loads(r.stdout.strip().splitlines()[-1])
    c = json.load(open(calls))
    check("clone: exits 0 with the JSON contract (out, engine=omnivoice, mode=clone, rate)",
          r.returncode == 0 and j.get("engine") == "omnivoice" and j.get("mode") == "clone" and j.get("rate") == 24000, r.stdout + r.stderr)
    check("clone: the wav is written", out.exists() and out.stat().st_size > 44, out.stat().st_size if out.exists() else None)
    check("clone: the reference is ENCODED once with its transcript", ["encode", "narrator.wav", "the transcript"] in c, c)
    check("clone: generate got the prompt and the step count", any(x[0] == "gen" and x[1] == "clone" and x[2] == 16 and x[3] == "prompt-for-narrator.wav" for x in c), c)
    check("clone: the prompt cache was saved beside the voice", cache.exists(), None)
    check("clone: progress lines go to stderr with the [tts] prefix", "[tts] " in r.stderr, r.stderr[:200])

    # ---- clone, second time: uses the cache, no encode
    time.sleep(0.05)
    r = run({"text": "again", "out": str(out), "ref_audio": str(ref), "ref_text": "the transcript",
             "prompt_cache": str(cache)}, env)
    c = json.load(open(calls))
    check("clone again: the cached prompt is used, the clip is NOT re-encoded",
          r.returncode == 0 and not any(x[0] == "encode" for x in c) and "cached voice prompt" in r.stderr, c)

    # ---- stale cache: voice re-recorded after the cache -> rebuild
    time.sleep(0.05)
    ref.write_bytes(b"RIFF newer take")
    os.utime(ref, None)
    r = run({"text": "third", "out": str(out), "ref_audio": str(ref), "ref_text": "new words",
             "prompt_cache": str(cache)}, env)
    c = json.load(open(calls))
    check("stale cache: a re-recorded reference forces a fresh encode", any(x[0] == "encode" and x[2] == "new words" for x in c), c)

    # ---- design
    r = run({"text": "design me", "out": str(out), "instruct": "female, low pitch, british accent"}, env)
    j = json.loads(r.stdout.strip().splitlines()[-1]); c = json.load(open(calls))
    check("design: no clip + instruct -> mode=design and the description reaches generate",
          j.get("mode") == "design" and any(x[0] == "gen" and x[4] == "female, low pitch, british accent" for x in c), c)

    # ---- auto
    r = run({"text": "whoever", "out": str(out)}, env)
    j = json.loads(r.stdout.strip().splitlines()[-1])
    check("auto: nothing given -> the model picks a voice (mode=auto)", j.get("mode") == "auto", j)

    # ---- refusals
    r = run({"text": "", "out": str(out)}, env)
    check("empty text is a JSON error, exit 1", r.returncode == 1 and "no text" in r.stdout, r.stdout)
    r = run({"text": "x"}, env)
    check("no output path is a JSON error", r.returncode == 1 and "output path" in r.stdout, r.stdout)

    # ---- kwargs filter
    sys.path.insert(0, str(ROOT / "scripts"))
    import omnivoice_local as ol
    def f(a, b=1): pass
    check("_fits keeps only the kwargs the callable accepts", ol._fits(f, {"a": 1, "b": 2, "zzz": 3}) == {"a": 1, "b": 2}, None)
    def g(**kw): pass
    check("_fits passes everything to a **kwargs callable", ol._fits(g, {"q": 1}) == {"q": 1}, None)

print("=" * 30)
print("ALL PASS" if not fails else f"FAILED: {fails}")
sys.exit(1 if fails else 0)
