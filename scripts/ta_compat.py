"""bitGen Studio — scripts/ta_compat.py (2.601.0): torchaudio.load / torchaudio.save WITHOUT TorchCodec.

Tim (verbatim): 'Ming-3.0 TTS stopped (1): "TorchCodec is required for load_with_torchcodec. " "Please install
torchcodec to use this function." | ) from e | ImportError: TorchCodec is required for load_with_torchcodec. Please
install torchcodec to use this function.'

torchaudio 2.9 handed load() / save() to TorchCodec, which is a separate package and on Windows needs FFmpeg's shared
DLLs as well - so a fresh Ming-3.0 TTS venv (torch + torchaudio from the CUDA index = 2.9+) failed the moment it read
the reference voice. patch() puts back a load / save that need no TorchCodec - soundfile when it is installed, else
the standard library's wave module for a PCM WAV, else ffmpeg (decodes anything to float32) - and only when
TorchCodec does not import and torchaudio is 2.9 or newer (an older torchaudio keeps its own backends).

  python ta_compat.py <script.py> [args...]   runs the script as __main__ with the patch in place (its folder first on
                                              sys.path, like running it directly) - scripts/ming_local.py runs infer.py so
2.601.1: patch_complex_half() - a bfloat16 / half tensor meeting a Python complex number (Ming's vocoder: mag * (x + 1j * y))
is lifted to float32 first: PyTorch has no "BComplex32" maths ('"mul_cuda" not implemented for 'BComplex32'').
Pure: version_tuple(s), needs_patch(ver, has_codec), pcm_to_float(raw, width), float_to_pcm16(samples).
"""
import os
import subprocess
import sys
import wave


def version_tuple(s):
    out = []
    for p in str(s or "0").split("+")[0].split("."):
        n = "".join(ch for ch in p if ch.isdigit())
        out.append(int(n) if n else 0)
    return tuple((out + [0, 0, 0])[:3])


def needs_patch(ver, has_codec):
    return (not has_codec) and version_tuple(ver) >= (2, 9, 0)


def pcm_to_float(raw, width):
    """little-endian PCM bytes (8 / 16 / 24 / 32 bit) -> a list of floats in -1..1"""
    if width == 1:
        return [(b - 128) / 128.0 for b in raw]
    if width == 2:
        import array
        a = array.array("h"); a.frombytes(raw[: len(raw) // 2 * 2])
        if sys.byteorder != "little":
            a.byteswap()
        return [x / 32768.0 for x in a]
    if width == 3:
        n = len(raw) // 3
        return [int.from_bytes(raw[i * 3:i * 3 + 3], "little", signed=True) / 8388608.0 for i in range(n)]
    if width == 4:
        import array
        a = array.array("i"); a.frombytes(raw[: len(raw) // 4 * 4])
        if sys.byteorder != "little":
            a.byteswap()
        return [x / 2147483648.0 for x in a]
    raise ValueError("unsupported sample width %d" % width)


def float_to_pcm16(samples):
    import array
    a = array.array("h", [max(-32768, min(32767, int(round(float(x) * 32767.0)))) for x in samples])
    if sys.byteorder != "little":
        a.byteswap()
    return a.tobytes()


def _read(path):
    """-> (frames x channels as a numpy float32 array, sample rate)"""
    import numpy as np
    p = str(path)
    try:
        import soundfile as sf
        data, sr = sf.read(p, dtype="float32", always_2d=True)
        return data, int(sr)
    except ImportError:
        pass
    except Exception:  # noqa: BLE001 - soundfile cannot read it: the next way
        if not os.path.isfile(p):
            raise
    try:
        with wave.open(p, "rb") as w:
            ch, sr, width = w.getnchannels(), w.getframerate(), w.getsampwidth()
            flat = np.asarray(pcm_to_float(w.readframes(w.getnframes()), width), dtype=np.float32)
        return flat.reshape(-1, ch), int(sr)
    except (wave.Error, EOFError, ValueError):
        pass
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels",
                            "-of", "csv=p=0", p], capture_output=True, text=True)
    parts = (probe.stdout or "").strip().split(",")
    sr = int(parts[0]) if parts and parts[0].isdigit() else 24000
    ch = int(parts[1]) if len(parts) > 1 and parts[1].strip().isdigit() else 1
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-acodec", "pcm_f32le", "-ac", str(ch), "-ar", str(sr), "-"],
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("could not read %s: %s" % (p, (r.stderr or b"").decode("utf-8", "replace").strip()[-300:]))
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, ch).copy(), sr


def load(uri, frame_offset=0, num_frames=-1, normalize=True, channels_first=True, format=None, buffer_size=4096, backend=None):  # noqa: A002
    import torch
    data, sr = _read(uri)
    if frame_offset:
        data = data[int(frame_offset):]
    if num_frames is not None and int(num_frames) >= 0:
        data = data[: int(num_frames)]
    t = torch.from_numpy(data.copy())
    return (t.transpose(0, 1).contiguous() if channels_first else t), sr


def save(uri, src, sample_rate, channels_first=True, format=None, encoding=None, bits_per_sample=None, buffer_size=4096, backend=None, compression=None):  # noqa: A002
    import numpy as np
    a = src.detach().cpu().float().numpy() if hasattr(src, "detach") else np.asarray(src, dtype=np.float32)
    if a.ndim == 1:
        a = a[None, :] if channels_first else a[:, None]
    if channels_first:
        a = a.T
    p = str(uri)
    os.makedirs(os.path.dirname(os.path.abspath(p)) or ".", exist_ok=True)
    try:
        import soundfile as sf
        sf.write(p, a, int(sample_rate), subtype="PCM_16" if p.lower().endswith(".wav") else None)
        return
    except ImportError:
        pass
    with wave.open(p, "wb") as w:
        w.setnchannels(int(a.shape[1])); w.setsampwidth(2); w.setframerate(int(sample_rate))
        w.writeframes(float_to_pcm16(a.reshape(-1)))


def patch(verbose=True):
    """torchaudio.load / save without TorchCodec when it is missing (torchaudio 2.9+) -> True when patched"""
    try:
        import torchaudio
    except Exception:  # noqa: BLE001 - no torchaudio: nothing to fix
        return False
    try:
        import torchcodec  # noqa: F401
        has = True
    except Exception:  # noqa: BLE001 - missing, or its FFmpeg DLLs are
        has = False
    if not needs_patch(getattr(torchaudio, "__version__", "0"), has):
        return False
    torchaudio.load = load
    torchaudio.save = save
    if verbose:
        print("[h3] torchaudio %s without TorchCodec: audio is read / written with %s" % (
            torchaudio.__version__, "soundfile" if _has("soundfile") else "the wave module / ffmpeg"), flush=True)
    return True


# ---------------------------------------------------------------- 2.601.1: complex numbers in bfloat16
# Tim: 'Ming-3.0 TTS stopped (1): S = mag * (x + 1j * y) | ~~~^~~ | NotImplementedError: "mul_cuda" not implemented for
# 'BComplex32''. Ming casts the WHOLE model to bfloat16, its vocoder head (audio_tokenizer/istft.py ISTFTHead) builds the
# spectrum as mag * (cos + 1j * sin) - and a bfloat16 tensor times a Python complex is a complex-bfloat16 ("BComplex32"),
# which PyTorch has (almost) no maths for: mul / add fail on CUDA and CPU alike. patch_complex_half() makes those
# operators do that one step in float32 (complex64): a half / bfloat16 tensor meeting a Python complex number - or a
# tensor that is already complex-half - is lifted first. Everything else goes straight through unchanged.
_CPLX_OPS = ("__mul__", "__rmul__", "__add__", "__radd__", "__sub__", "__rsub__", "__truediv__", "__rtruediv__")


def _is_chalf(t):
    try:
        return bool(t.is_complex()) and t.element_size() <= 4
    except Exception:  # noqa: BLE001
        return False


def patch_complex_half(verbose=True):
    """-> True when the operators were wrapped (once per process)"""
    try:
        import torch
    except Exception:  # noqa: BLE001
        return False
    try:
        T = torch.Tensor
        if getattr(T, "_h3_chalf", False):
            return False
        half = (torch.bfloat16, torch.float16)
        orig_ops = [getattr(T, n) for n in _CPLX_OPS]
    except Exception:  # noqa: BLE001 - an odd torch: leave it exactly as it is
        return False
    del orig_ops
    said = []

    def lift(t):
        if isinstance(t, torch.Tensor):
            if t.dtype in half:
                return t.float()
            if _is_chalf(t):
                return t.to(torch.complex64)
        return t

    def wrap(name):
        orig = getattr(T, name)

        def op(self, other):
            if (isinstance(other, complex) and getattr(self, "dtype", None) in half) or _is_chalf(self) \
                    or (isinstance(other, torch.Tensor) and _is_chalf(other)):
                if verbose and not said:
                    said.append(1)
                    print("[h3] complex maths in %s done in float32 (the vocoder's spectrum) - PyTorch has no complex-%s kernels"
                          % (str(getattr(self, "dtype", "half")).replace("torch.", ""), "bfloat16"), flush=True)
                return orig(lift(self), lift(other))
            return orig(self, other)
        op.__name__ = name
        return op

    for n in _CPLX_OPS:
        setattr(T, n, wrap(n))
    T._h3_chalf = True
    return True


def _has(mod):
    try:
        __import__(mod)
        return True
    except Exception:  # noqa: BLE001
        return False


def run(argv):
    import runpy
    script = os.path.abspath(argv[0])
    sys.argv = [script] + list(argv[1:])
    sys.path[0] = os.path.dirname(script)    # its own folder first - never this one (scripts/ names must not shadow its modules)
    patch()
    patch_complex_half()                     # 2.601.1: "mul_cuda" not implemented for 'BComplex32'
    runpy.run_path(script, run_name="__main__")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: ta_compat.py <script.py> [args...]")
        sys.exit(2)
    run(sys.argv[1:])
