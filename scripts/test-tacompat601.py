#!/usr/bin/env python3
"""bitGen Studio — scripts/test-tacompat601.py (2.601.0): torchaudio.load / save WITHOUT TorchCodec (scripts/ta_compat.py).

Tim: 'Ming-3.0 TTS stopped (1): ... ImportError: TorchCodec is required for load_with_torchcodec. Please install
torchcodec to use this function.'
  pure        version_tuple / needs_patch (2.9+ and no TorchCodec only), pcm_to_float / float_to_pcm16 round trip
  LIVE        a stand-in torchaudio 2.9 whose load / save raise exactly that ImportError (and a stand-in torch); a script
              run through `ta_compat.py <script>` (the way ming_local.py runs infer.py) reads a 16-bit stereo WAV with
              torchaudio.load (channels first, the right rate, offset / num_frames), writes it back with torchaudio.save,
              imports a module from ITS OWN folder (not scripts/), and gets __main__ + its argv; without the shim the same
              script stops with the TorchCodec error; a torchaudio 2.8 is left alone
  wiring      ming_local.py runs infer.py through ta_compat.py; omnivoice_local.py patches before it imports OmniVoice
  2.601.1     complex maths in bfloat16 (Ming's vocoder: mag * (x + 1j * y)) - fails without the shim ('BComplex32'),
              complex64 -> float32 audio through it (needs PyTorch: this python, or H3_TORCH_PYTHON; else SKIP)
No numpy here = the LIVE legs SKIP (the pure ones run).
"""
import os
import struct
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ta_compat as T  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1; print("PASS: " + name)
    else:
        F += 1; print("FAIL: " + name + ("" if got is None else "\n      got " + repr(got)[:600]))


check("version_tuple: '2.9.0+cu128' -> (2, 9, 0); '2.10' -> (2, 10, 0)", T.version_tuple("2.9.0+cu128") == (2, 9, 0) and T.version_tuple("2.10") == (2, 10, 0))
check("needs_patch: only torchaudio 2.9+ WITHOUT TorchCodec", T.needs_patch("2.9.1", False) and not T.needs_patch("2.9.1", True) and not T.needs_patch("2.8.0", False))
raw = T.float_to_pcm16([0.0, 0.5, -0.5, 1.0, -1.0])
back = T.pcm_to_float(raw, 2)
check("float_to_pcm16 / pcm_to_float round trip (16-bit)", all(abs(a - b) < 1e-3 for a, b in zip(back, [0.0, 0.5, -0.5, 1.0, -1.0])), back)
check("pcm_to_float 24-bit", abs(T.pcm_to_float((4194304).to_bytes(3, "little", signed=True), 3)[0] - 0.5) < 1e-6)

src = open(os.path.join(HERE, "ming_local.py"), encoding="utf-8").read()
check("ming_local.py runs infer.py through ta_compat.py", "[sys.executable, TA_COMPAT] + args" in src and 'TA_COMPAT = os.path.join(' in src)
ov = open(os.path.join(HERE, "omnivoice_local.py"), encoding="utf-8").read()
check("omnivoice_local.py patches torchaudio before it imports OmniVoice", ov.index("ta_compat.patch()") < ov.index("from omnivoice import OmniVoice"))

try:
    import numpy  # noqa: F401
    have_np = True
except ImportError:
    have_np = False

if not have_np:
    print("SKIP: numpy is not installed here - the LIVE legs did not run")
else:
    tmp = tempfile.mkdtemp(prefix="bg-ta601-")
    stub = os.path.join(tmp, "stub")
    os.makedirs(os.path.join(stub, "torch")); os.makedirs(os.path.join(stub, "torchaudio"))
    with open(os.path.join(stub, "torch", "__init__.py"), "w") as fh:
        fh.write('''import numpy as np
class Tensor:
    def __init__(self, a): self.a = np.asarray(a, dtype=np.float32)
    @property
    def shape(self): return self.a.shape
    def transpose(self, i, j): return Tensor(np.swapaxes(self.a, i, j))
    def contiguous(self): return Tensor(np.ascontiguousarray(self.a))
    def detach(self): return self
    def cpu(self): return self
    def float(self): return self
    def numpy(self): return self.a
def from_numpy(a): return Tensor(a)
''')

    def ta(ver):
        with open(os.path.join(stub, "torchaudio", "__init__.py"), "w") as fh:
            fh.write('__version__ = "%s"\n' % ver + '''def load(*a, **k):
    raise ImportError("TorchCodec is required for load_with_torchcodec. Please install torchcodec to use this function.")
def save(*a, **k):
    raise ImportError("TorchCodec is required for save_with_torchcodec. Please install torchcodec to use this function.")
''')
    ta("2.9.0+cu128")
    prog = os.path.join(tmp, "prog")
    os.makedirs(prog)
    with open(os.path.join(prog, "mylocal.py"), "w") as fh:
        fh.write("WHO = 'prog'\n")
    with open(os.path.join(prog, "infer.py"), "w") as fh:
        fh.write('''import sys, json, torchaudio, mylocal
from torchaudio import load as L
w, sr = torchaudio.load(sys.argv[1])
p, _ = L(sys.argv[1], frame_offset=100, num_frames=50)
torchaudio.save(sys.argv[2], w, sr)
print(json.dumps({"name": __name__, "argv": sys.argv[1:], "shape": list(w.shape), "sr": sr, "part": list(p.shape), "who": mylocal.WHO,
                  "first": [round(float(w.a[0][1]), 3), round(float(w.a[1][1]), 3)]}))
''')
    wav = os.path.join(tmp, "in.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(24000)
        w.writeframes(b"".join(struct.pack("<hh", 16384 if i == 1 else 0, -16384 if i == 1 else 0) for i in range(1000)))
    env = dict(os.environ, PYTHONPATH=stub)
    out = os.path.join(tmp, "out.wav")
    r = subprocess.run([sys.executable, os.path.join(HERE, "ta_compat.py"), "infer.py", wav, out], cwd=prog, env=env, capture_output=True, text=True)
    import json
    last = (r.stdout or "").strip().splitlines()
    try:
        j = json.loads(last[-1])
    except Exception:  # noqa: BLE001
        j = {"stdout": r.stdout, "stderr": r.stderr[-800:]}
    check("through ta_compat.py: torchaudio.load reads the 16-bit stereo WAV (2 x 1000, channels first, 24 kHz, the samples right)",
          j.get("shape") == [2, 1000] and j.get("sr") == 24000 and j.get("first") == [0.5, -0.5], j)
    check("…frame_offset / num_frames, and `from torchaudio import load` gets the patched one too", j.get("part") == [2, 50], j)
    ok_out = os.path.isfile(out)
    if ok_out:
        with wave.open(out, "rb") as w:
            ok_out = (w.getnchannels(), w.getframerate(), w.getnframes()) == (2, 24000, 1000)
    check("…torchaudio.save writes it back (2 channels, 24 kHz, 1000 frames)", ok_out)
    check("…the script runs as __main__ with its own argv and imports from ITS folder", j.get("name") == "__main__" and j.get("argv") == [wav, out] and j.get("who") == "prog", j)
    check("…and says it read audio without TorchCodec", "without TorchCodec" in (r.stdout or ""), r.stdout[-300:])
    r2 = subprocess.run([sys.executable, "infer.py", wav, out], cwd=prog, env=env, capture_output=True, text=True)
    check("without the shim the same script stops with the TorchCodec error (what Tim saw)", r2.returncode != 0 and "TorchCodec is required" in (r2.stderr or ""), r2.stderr[-300:])
    ta("2.8.0")
    r3 = subprocess.run([sys.executable, os.path.join(HERE, "ta_compat.py"), "infer.py", wav, out], cwd=prog, env=env, capture_output=True, text=True)
    check("a torchaudio 2.8 is left alone (its own backends)", r3.returncode != 0 and "TorchCodec is required" in (r3.stderr or "") and "without TorchCodec" not in (r3.stdout or ""))

# ---- 2.601.1: complex maths in bfloat16 ('"mul_cuda" not implemented for 'BComplex32'')
TA = open(os.path.join(HERE, "ta_compat.py"), encoding="utf-8").read()
check("2.601.1: run() lifts complex-bfloat16 maths too (patch_complex_half after patch, before the script)",
      TA.index("    patch()\n    patch_complex_half()") < TA.index('runpy.run_path(script, run_name="__main__")'))
tpy = os.environ.get("H3_TORCH_PYTHON") or ""
if not tpy:
    try:
        import torch  # noqa: F401
        tpy = sys.executable
    except ImportError:
        tpy = ""
if not tpy:
    print("SKIP: no PyTorch here (set H3_TORCH_PYTHON to a python that has it) - the 2.601.1 LIVE legs did not run")
else:
    tmp2 = tempfile.mkdtemp(prefix="bg-chalf601-")
    voc = os.path.join(tmp2, "voc.py")
    with open(voc, "w") as fh:     # the vocoder head's spectrum, as Ming's audio_tokenizer/istft.py builds it (all bfloat16)
        fh.write('''import torch
m = torch.randn(1, 961, 12).to(torch.bfloat16); p = torch.randn(1, 961, 12).to(torch.bfloat16)
mag = torch.clip(torch.exp(m), max=1e2)
x = torch.cos(p)
y = torch.sin(p)
S = mag * (x + 1j * y)
a = torch.fft.irfft(S, 1920, dim=1, norm="backward")
r = torch.randn(4).to(torch.bfloat16) * 2 + 1
print("VOC", S.dtype, a.dtype, tuple(a.shape), bool(torch.isfinite(a).all()), r.dtype)
''')
    r1 = subprocess.run([tpy, voc], cwd=tmp2, capture_output=True, text=True)
    check("2.601.1 LIVE: without the shim the vocoder's spectrum fails like Tim's (not implemented for 'BComplex32')", r1.returncode != 0 and "BComplex32" in (r1.stderr or ""), (r1.stderr or "")[-300:])
    r2 = subprocess.run([tpy, os.path.join(HERE, "ta_compat.py"), voc], cwd=tmp2, capture_output=True, text=True)
    out2 = [l for l in (r2.stdout or "").splitlines() if l.startswith("VOC")]
    check("2.601.1 LIVE: through ta_compat it is complex64 -> float32 audio, finite; plain bfloat16 maths stays bfloat16; the log says so",
          r2.returncode == 0 and out2 and out2[0] == "VOC torch.complex64 torch.float32 (1, 1920, 12) True torch.bfloat16" and "done in float32" in r2.stdout, (r2.stdout or "")[-300:] + (r2.stderr or "")[-300:])

print("\n%d passed, %d failed" % (P, F))
print("RESULT: FAIL" if F else "RESULT: PASS")
sys.exit(1 if F else 0)
