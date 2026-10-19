#!/usr/bin/env python3
"""OmniVoice (k2-fsa) text-to-speech for bitGen Studio (2.102.0).

The SECOND speech engine, beside OpenAudio/fish-speech (tts_local.py). Same
contract, so lib/tts.js can switch between them with one setting:

    python omnivoice_local.py <job.json>      -> one JSON line on stdout
    job = {
      "text": "...",  "out": "/abs/path.wav",
      "model": "k2-fsa/OmniVoice",            # HF repo id or a local folder
      "device": "cuda" | "cuda:1" | "cpu",
      "ref_audio": "/abs/voice.wav" | null,   # voice CLONE (with ref_text)
      "ref_text": "transcript of ref_audio",
      "instruct": "female, low pitch, british accent" | "",   # voice DESIGN
      "prompt_cache": "/abs/voice.omnivoice.pt" | null,       # optional
      "num_step": 32, "speed": 1.0,
      "op": "check"                           # optional: import test only
    }
    stdout: {"out": ..., "engine": "omnivoice", "seconds": ..., "mode": ...}
            or {"error": "..."}
    stderr: progress lines (streamed into the app's TTS progress panel)

THREE MODES, picked from the job, in this order:
  clone   ref_audio present            -> zero-shot voice cloning
  design  instruct present, no clip    -> voice from a description
  auto    neither                      -> the model picks a voice

PROMPT CACHE. Encoding the reference clip is the slow part of a clone; the
model can save that encoding as a .pt beside the voice and skip the audio on
later runs. lib/tts.js passes `prompt_cache` = <voice>.omnivoice.pt; if the
file exists AND is newer than the wav it is used, else it is (re)built and
saved. A stale prompt (voice re-recorded) is therefore never used.

Output is 24 kHz mono (the model's native rate); the project's Sound folder
does not care, and ffmpeg resamples at compile time like any other asset.
"""
import json
import os
import sys
import time


def say(msg):
    sys.stderr.write(f"[tts] {msg}\n")
    sys.stderr.flush()


def _fits(cls_or_fn, want):
    """Keep only the kwargs the callable actually accepts (the API is young
    and has added/renamed parameters between releases)."""
    import inspect
    try:
        params = inspect.signature(cls_or_fn).parameters
    except (TypeError, ValueError):
        return dict(want)
    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
        return dict(want)
    return {k: v for k, v in want.items() if k in params}


def check():
    """Import test for the status panel — no model download."""
    import importlib
    try:
        import torch
    except Exception as e:                                          # noqa: BLE001
        return {"ok": False, "error": f"torch missing in the OmniVoice venv: {e}"}
    try:
        m = importlib.import_module("omnivoice")
    except Exception as e:                                          # noqa: BLE001
        return {"ok": False, "error": f"omnivoice is not installed in this venv: {e}",
                "torch": torch.__version__}
    return {"ok": True, "torch": torch.__version__,
            "cuda": bool(getattr(torch, "cuda", None) and torch.cuda.is_available()),
            "omnivoice": getattr(m, "__version__", "?")}


def synth(job):
    text = str(job.get("text") or "").strip()
    if not text:
        raise ValueError("no text")
    out = job.get("out")
    if not out:
        raise ValueError("no output path")
    model_id = job.get("model") or "k2-fsa/OmniVoice"
    device = str(job.get("device") or "cuda")
    ref_audio = job.get("ref_audio") or None
    ref_text = str(job.get("ref_text") or "").strip()
    instruct = str(job.get("instruct") or "").strip()
    cache = job.get("prompt_cache") or None
    num_step = int(job.get("num_step") or 32)
    speed = float(job.get("speed") or 1.0)

    import torch
    import soundfile as sf
    from omnivoice import OmniVoice

    t0 = time.time()
    say(f"loading {model_id} on {device} (first run downloads the weights)")
    dtype = torch.float16 if not device.startswith("cpu") else torch.float32
    model = OmniVoice.from_pretrained(model_id, **_fits(
        OmniVoice.from_pretrained, {"device_map": device, "dtype": dtype, "torch_dtype": dtype}))
    say(f"model ready in {time.time() - t0:.1f}s")

    gen = {"text": text, "num_step": num_step, "speed": speed}
    mode = "auto"
    if ref_audio:
        mode = "clone"
        prompt = None
        if cache and os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(ref_audio):
            try:
                from omnivoice import VoiceClonePrompt
                prompt = VoiceClonePrompt.load(cache)
                say(f"using the cached voice prompt {os.path.basename(cache)}")
            except Exception as e:                                  # noqa: BLE001
                say(f"cached prompt unreadable ({e}); rebuilding it")
                prompt = None
        if prompt is None:
            say(f"encoding the reference clip {os.path.basename(ref_audio)}"
                + (" with its transcript" if ref_text else " (no transcript: Whisper will transcribe it)"))
            if hasattr(model, "create_voice_clone_prompt"):
                kw = {"ref_audio": ref_audio}
                if ref_text:
                    kw["ref_text"] = ref_text
                prompt = model.create_voice_clone_prompt(**kw)
                if cache:
                    try:
                        prompt.save(cache)
                        say(f"saved the voice prompt to {os.path.basename(cache)}")
                    except Exception as e:                          # noqa: BLE001
                        say(f"could not save the prompt cache: {e}")
        if prompt is not None:
            gen["voice_clone_prompt"] = prompt
        else:
            gen["ref_audio"] = ref_audio
            if ref_text:
                gen["ref_text"] = ref_text
    elif instruct:
        mode = "design"
        gen["instruct"] = instruct
        say(f"voice design: {instruct}")
    else:
        say("no voice given: the model will pick one")

    say(f"synthesizing {len(text)} chars, {num_step} steps ({mode})")
    t1 = time.time()
    audio = model.generate(**_fits(model.generate, gen))
    wave = audio[0] if isinstance(audio, (list, tuple)) else audio
    if hasattr(wave, "detach"):
        wave = wave.detach().float().cpu().numpy()
    rate = int(getattr(model, "sample_rate", 24000) or 24000)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sf.write(out, wave, rate)
    secs = float(len(wave)) / rate
    say(f"done: {secs:.1f}s of audio in {time.time() - t1:.1f}s")
    return {"out": out, "engine": "omnivoice", "seconds": round(secs, 2),
            "rate": rate, "mode": mode}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: omnivoice_local.py <job.json>"}))
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)
    try:
        if job.get("op") == "check":
            print(json.dumps(check()))
            return 0
        print(json.dumps(synth(job)))
        return 0
    except Exception as e:                                          # noqa: BLE001
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
