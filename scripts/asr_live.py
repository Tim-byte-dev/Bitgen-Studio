#!/usr/bin/env python3
"""bitGen Studio 2.564.0 - LIVE speech-to-text for the 🎙 voice chat (lib/asrLive.js).

The one-shot helper (scripts/asr_local.py) loads the Whisper model for every clip - seconds each time. A conversation
needs the model loaded ONCE: this process stays up, reads one JSON line per utterance on stdin and answers one JSON
line on stdout. Runs in the whisper venv (venvs/whisper); nothing leaves the machine.

  argv[1]        a JSON file: {model, model_dir, device, compute_type, language}
  stdout first   {"ready": true, "device": "...", "model": "..."}   (or {"fatal": "..."} and exit)
  stdin          {"id": "...", "audio": "<a 16 kHz mono wav>", "language": ""?}
  stdout         {"id": "...", "text": "...", "language": "..."} | {"id": "...", "error": "..."}
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asr_local import add_cuda_dll_dirs, CUDA_HINT, load_audio  # noqa: E402  (2.600.1: load_audio - no PyAV)


def say(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def is_cuda_problem(msg):
    m = str(msg).lower()
    return any(k in m for k in ("cublas", "cudnn", "cuda", "libcu", ".dll", "cannot be loaded", "no kernel image"))


def main():
    if len(sys.argv) < 2:
        say({"fatal": "usage: asr_live.py <config.json>"})
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    add_cuda_dll_dirs()
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        say({"fatal": "faster-whisper is not installed in this venv - use Install faster-whisper in Settings -> Audio"})
        return 1
    name = cfg.get("model") or "base"
    device = cfg.get("device") or "auto"
    compute = cfg.get("compute_type") or ("float16" if device.startswith("cuda") else "int8")
    root = cfg.get("model_dir") or None
    lang0 = (cfg.get("language") or "").strip() or None

    def load(dev, comp):
        sys.stderr.write(f"[asr-live] loading {name} on {dev} ({comp})\n")
        sys.stderr.flush()
        m = WhisperModel(name, device=dev, compute_type=comp, download_root=root)
        return m

    def run(m, audio, lang):
        segs, info = m.transcribe(load_audio(audio), language=lang, vad_filter=True, beam_size=1,
                                  condition_on_previous_text=False, word_timestamps=False)
        text = " ".join(str(s.text).strip() for s in segs).strip()       # drained here: a GPU failure surfaces now
        return text, getattr(info, "language", None) or lang or ""

    used = device
    try:
        model = load(device, compute)
    except Exception as e:  # noqa: BLE001
        if is_cuda_problem(e) and not device.startswith("cpu"):
            model, used = load("cpu", "int8"), "cpu"
        else:
            say({"fatal": f"could not load Whisper {name}: {e}"})
            return 1
    say({"ready": True, "device": used, "model": name})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except ValueError:
            continue
        jid = job.get("id")
        audio = job.get("audio") or ""
        lang = (job.get("language") or "").strip() or lang0
        try:
            text, lg = run(model, audio, lang)
        except Exception as e:  # noqa: BLE001
            if is_cuda_problem(e) and not used.startswith("cpu"):
                sys.stderr.write("[asr-live] GPU failed - CPU from now on. " + CUDA_HINT + "\n")
                sys.stderr.flush()
                try:
                    model, used = load("cpu", "int8"), "cpu"
                    text, lg = run(model, audio, lang)
                except Exception as e2:  # noqa: BLE001
                    say({"id": jid, "error": f"transcription failed: {e2}"})
                    continue
            else:
                say({"id": jid, "error": f"transcription failed: {e}"})
                continue
        say({"id": jid, "text": text, "language": lg, "device": used})
    return 0


if __name__ == "__main__":
    sys.exit(main())
