#!/usr/bin/env python3
"""bitGen Studio 2.594.0 - Underdog Bark 3.0 speech-to-text (Conway Research; from NVIDIA Parakeet; CC-BY-4.0) for
lib/asr.js and lib/asrLive.js. Runs in <app>/bark-stt/.venv; the model (model.bark + bark_loader.py + NOTICE from
ConwayResearch/Underdog-Bark-3.0) is in <app>/bark-stt/model.

Tim (verbatim): "add option to use https://underdog.ai/bark as stt engine".

Bark 3.0 is ENGLISH ONLY and gives NO word times: lib/asr.js sends it plain transcripts (the 🎤 Transcribe button, voice
clone transcripts, the phone remote, the 🎙 voice chat) and keeps lyrics, captions and other timed work on faster-whisper.
A long file is cut into pieces of at most 30 s at the quietest moment near each cut (the model's memory grows with the
length - its authors advise pieces), so the transcript still has rough times: one segment per piece.

  python bark_local.py <job.json>   job = {op: "transcribe", model_dir, device, audio (a 16 kHz mono wav), max_s}
                                     -> {text, segments: [{start, end, text}], language: "en", device}
                                     job = {op: "live", model_dir, device}: like asr_live.py - first line
                                     {"ready": true, "device", "model": "bark-3.0"}, then one JSON line per stdin line
                                     {id, audio} -> {id, text, language: "en", device} | {id, error}
  python bark_local.py --check <model_dir>    {ok, device} | {missing: "<module>"} | {error}
Pure (tests): cuts(energy, hop_s, max_s, min_s), text_of(result).
"""
import json
import os
import sys


def say(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def log(s):
    sys.stderr.write("[bark] " + str(s) + "\n")
    sys.stderr.flush()


def text_of(r):
    """bark_loader.transcribe's answer as text (a str, or a dict / list with text in it)"""
    if r is None:
        return ""
    if isinstance(r, str):
        return r.strip()
    if isinstance(r, dict):
        return str(r.get("text") or r.get("transcript") or "").strip()
    if isinstance(r, (list, tuple)):
        return " ".join(text_of(x) for x in r).strip()
    return str(getattr(r, "text", r)).strip()


def cuts(energy, hop_s, max_s=30.0, min_s=18.0):
    """where to cut a long recording: [(start_s, end_s)] pieces of at most max_s, each cut at the quietest frame
    between min_s and max_s into the piece (energy = one value per hop_s frame)"""
    n = len(energy)
    total = n * hop_s
    out, a = [], 0
    per_max, per_min = max(1, int(round(max_s / hop_s))), max(1, int(round(min_s / hop_s)))
    while a < n:
        if n - a <= per_max:
            out.append((round(a * hop_s, 3), round(total, 3)))
            break
        lo, hi = a + per_min, min(n, a + per_max)
        b = min(range(lo, hi), key=lambda i: (energy[i], -i))
        out.append((round(a * hop_s, 3), round(b * hop_s, 3)))
        a = b
    return out


def device_of(want):
    w = str(want or "auto")
    try:
        import torch
    except ImportError:          # bark_loader.py says what it needs; the device question is torch's
        return "cpu"
    if w.startswith("cuda") and torch.cuda.is_available():
        return w
    if w == "auto" and torch.cuda.is_available():
        return "cuda"
    if w == "mps" or (w == "auto" and getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()):
        return "mps"
    return "cpu"


def load(model_dir, want):
    sys.path.insert(0, model_dir)
    import bark_loader  # noqa: E402  (the model's own loader, downloaded beside model.bark)
    dev = device_of(want)
    log("loading Bark 3.0 on %s" % dev)
    try:
        m = bark_loader.load_model(os.path.join(model_dir, "model.bark"), device=dev)
    except Exception as e:  # noqa: BLE001
        if dev == "cpu":
            raise
        log("the GPU would not take it (%s) - CPU" % e)
        dev = "cpu"
        m = bark_loader.load_model(os.path.join(model_dir, "model.bark"), device=dev)
    return bark_loader, m, dev


def read_mono(path):
    import numpy as np
    import soundfile as sf
    wave, sr = sf.read(path, dtype="float32", always_2d=True)
    return np.ascontiguousarray(wave.mean(1)), sr


def run(BL, m, path, max_s=30.0):
    import numpy as np
    wave, sr = read_mono(path)
    if len(wave) <= int(max_s * sr):
        t = text_of(BL.transcribe(m, wave, sr))
        return t, [{"start": 0.0, "end": round(len(wave) / sr, 3), "text": t}] if t else []
    hop = int(sr * 0.02)
    frames = len(wave) // hop
    energy = [float(np.sqrt(np.mean(np.square(wave[i * hop:(i + 1) * hop])))) for i in range(frames)]
    segs = []
    for a, b in cuts(energy, hop / sr, max_s):
        piece = wave[int(a * sr):int(b * sr)]
        if len(piece) < sr * 0.2:
            continue
        t = text_of(BL.transcribe(m, piece, sr))
        log("%.1f - %.1f s: %s" % (a, b, t[:60]))
        if t:
            segs.append({"start": a, "end": b, "text": t})
    return " ".join(s["text"] for s in segs).strip(), segs


def check(model_dir):
    if not os.path.isfile(os.path.join(model_dir, "model.bark")):
        return {"error": "model.bark is not in %s" % model_dir}
    try:
        BL, _m, dev = load(model_dir, "auto")
    except ModuleNotFoundError as e:
        return {"missing": e.name or str(e)}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}
    if not hasattr(BL, "transcribe"):
        return {"error": "bark_loader.py has no transcribe() - the model's loader changed"}
    return {"ok": True, "device": dev}


def live(job):
    try:
        BL, m, dev = load(job.get("model_dir") or "", job.get("device"))
    except Exception as e:  # noqa: BLE001
        say({"fatal": "could not load Bark 3.0: %s" % e})
        return 1
    say({"ready": True, "device": dev, "model": "bark-3.0"})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            q = json.loads(line)
        except ValueError:
            continue
        try:
            text, _segs = run(BL, m, q.get("audio") or "")
            say({"id": q.get("id"), "text": text, "language": "en", "device": dev})
        except Exception as e:  # noqa: BLE001
            say({"id": q.get("id"), "error": "transcription failed: %s" % e})
    return 0


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--check":
        say(check(sys.argv[2]))
        return 0
    if len(sys.argv) < 2:
        say({"error": "usage: bark_local.py <job.json> | --check <model_dir>"})
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)
    if job.get("op") == "live":
        return live(job)
    try:
        BL, m, dev = load(job.get("model_dir") or "", job.get("device"))
        text, segs = run(BL, m, job.get("audio") or "", float(job.get("max_s") or 30))
        say({"text": text, "segments": segs, "language": "en", "device": dev})
        return 0
    except Exception as e:  # noqa: BLE001
        say({"error": "Bark 3.0: %s" % e})
        return 1


if __name__ == "__main__":
    sys.exit(main())
