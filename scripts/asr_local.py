#!/usr/bin/env python3
"""Local transcription with faster-whisper. Run by bitGen Studio inside the
whisper venv (venvs/whisper) — no HTTP, no server, no API key.

Reads a JSON job on argv[1] and prints ONE line of JSON on stdout:
  {"text": str, "language": str, "segments": [{start,end,text,words:[...]}]}
Progress and errors go to stderr so the job console can show them.
"""
import glob
import json
import os
import sys
import sysconfig


def add_cuda_dll_dirs():
    """Put the pip-installed NVIDIA libraries on the DLL search path.

    faster-whisper runs on CTranslate2, which links cuBLAS and cuDNN at load
    time but does NOT depend on them via pip. The wheels that provide them
    (nvidia-cublas-cu12, nvidia-cudnn-cu12) drop their DLLs inside
    site-packages/nvidia/*/bin, which is not on PATH — hence the classic
    "Library cublas64_12.dll is not found or cannot be loaded" even though
    everything looks installed. Add those folders before importing.
    """
    found = []
    for base in {sysconfig.get_paths()["purelib"], sysconfig.get_paths()["platlib"]}:
        for sub in ("bin", "lib"):
            for d in glob.glob(os.path.join(base, "nvidia", "*", sub)):
                if not os.path.isdir(d):
                    continue
                found.append(d)
                if hasattr(os, "add_dll_directory"):        # Windows
                    try:
                        os.add_dll_directory(d)
                    except OSError:
                        pass
                os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
                if sys.platform.startswith("linux"):
                    os.environ["LD_LIBRARY_PATH"] = (
                        d + os.pathsep + os.environ.get("LD_LIBRARY_PATH", ""))
    return found


def load_audio(path):
    """The clip as faster-whisper's own input - 16 kHz mono float32 - WITHOUT PyAV (2.600.1).

    faster-whisper decodes a FILE with PyAV: av.open(..., metadata_errors="ignore"). PyAV 19 removed that argument, and
    faster-whisper (1.2.1, the newest) still passes it, so every transcription in a venv that pulled the newest PyAV
    died with "open() got an unexpected keyword argument 'metadata_errors'" (Tim, cloning a voice). The app hands this
    script a 16 kHz mono PCM WAV (lib/asr.js toWav16k), so the standard library reads it; anything else goes through
    ffmpeg. An ndarray skips PyAV entirely, whatever version is installed."""
    import numpy as np
    import wave
    try:
        with wave.open(str(path), "rb") as w:
            if w.getsampwidth() == 2 and w.getframerate() == 16000 and w.getcomptype() == "NONE":
                a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
                ch = w.getnchannels()
                return a.reshape(-1, ch).mean(axis=1) if ch > 1 else a
    except (wave.Error, EOFError, OSError):
        pass
    import subprocess
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("could not read the audio: " + (r.stderr.decode("utf-8", "replace").strip().splitlines() or ["ffmpeg failed"])[-1])
    return np.frombuffer(r.stdout, dtype="<i2").astype(np.float32) / 32768.0


CUDA_HINT = (
    "the CUDA libraries CTranslate2 needs are missing. Install them into the "
    "whisper venv with:  pip install nvidia-cublas-cu12 nvidia-cudnn-cu12  "
    "(or press Install faster-whisper again, which now does it), or set "
    "Device to cpu in Settings -> Audio."
)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: asr_local.py <job.json>"}))
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)

    libs = add_cuda_dll_dirs()
    if libs:
        sys.stderr.write(f"[asr] added {len(libs)} NVIDIA library folder(s) to the search path\n")
        sys.stderr.flush()
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper is not installed in this venv — "
                                   "use Install faster-whisper in Settings -> Audio"}))
        return 1

    model_name = job.get("model") or "base"
    device = job.get("device") or "auto"
    compute = job.get("compute_type") or ("float16" if device.startswith("cuda") else "int8")

    lang = (job.get("language") or "").strip() or None
    want_words = bool(job.get("word_timestamps", True))
    kw = dict(language=lang, word_timestamps=want_words,
              vad_filter=bool(job.get("vad", False)))
    if job.get("mode") == "lyrics":
        # a song is not conversation: stop whisper collapsing repeated choruses
        kw.update(temperature=0.0, condition_on_previous_text=False)

    try:
        audio = load_audio(job["audio"])
    except Exception as e:                                   # noqa: BLE001
        print(json.dumps({"error": f"transcription failed: {e}"}))
        return 1

    def attempt(dev, comp):
        """Load, transcribe AND drain the generator on one device.

        All three must live in the same attempt. CTranslate2 loads cuBLAS
        LAZILY, so a missing DLL usually surfaces at transcribe() or even
        during iteration — model construction alone can succeed on a machine
        that cannot actually decode. faster_whisper.transcribe() also returns a
        GENERATOR: nothing runs until it is consumed, so draining it here is
        what makes a GPU failure catchable and retryable on CPU.
        """
        sys.stderr.write(f"[asr] loading {model_name} on {dev} ({comp})\n")
        sys.stderr.flush()
        model = WhisperModel(model_name, device=dev, compute_type=comp,
                             download_root=job.get("model_dir") or None)
        segments, info = model.transcribe(audio, **kw)   # 2.600.1: an array (load_audio), never PyAV
        rows = []
        total = float(getattr(info, "duration", 0) or 0)
        for seg in segments:
            words = []
            for w in (getattr(seg, "words", None) or []):
                words.append({"start": float(w.start), "end": float(w.end),
                              "text": str(w.word).strip()})
            rows.append({"start": float(seg.start), "end": float(seg.end),
                         "text": str(seg.text).strip(), "words": words})
            if total:
                sys.stderr.write(f"[asr] {seg.end:.1f}/{total:.0f}s\n")
                sys.stderr.flush()
        return rows, info, total

    def is_cuda_problem(msg):
        m = msg.lower()
        return any(k in m for k in ("cublas", "cudnn", "cuda", "libcu", ".dll",
                                    "cannot be loaded", "no kernel image"))

    device_used = device
    try:
        out, info, total = attempt(device, compute)
    except Exception as e:                                   # noqa: BLE001
        msg = str(e)
        if is_cuda_problem(msg) and not device.startswith("cpu"):
            sys.stderr.write(f"[asr] GPU run failed ({msg.splitlines()[0][:160]})\n")
            sys.stderr.write("[asr] retrying on CPU - " + CUDA_HINT + "\n")
            sys.stderr.flush()
            try:
                out, info, total = attempt("cpu", "int8")
                device_used = "cpu (fell back: " + CUDA_HINT.split(".")[0] + ")"
            except Exception as e2:                          # noqa: BLE001
                print(json.dumps({"error": f"transcription failed on GPU and CPU: {e2}"}))
                return 1
        else:
            print(json.dumps({"error": f"transcription failed: {msg}"
                                       + ("  — " + CUDA_HINT if is_cuda_problem(msg) else "")}))
            return 1

    print(json.dumps({"text": " ".join(x["text"] for x in out).strip(),
                      "language": getattr(info, "language", None) or lang or "",
                      "duration": total, "device": device_used, "segments": out}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
