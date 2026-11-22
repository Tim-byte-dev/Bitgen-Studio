#!/usr/bin/env python3
"""bitGen Studio — the live voice stream (2.919.0): Inworld's SAVA turn detection + Voice Isolator, kept loaded.

Tim (verbatim): "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
with bitgen" -> "go ahead".

lib/voiceStream.js keeps this process up in the voice-kit venv (lib/voiceKitAddon.js) and streams the microphone through it
while you talk - from the 📱 app's 🎙 Talk and the studio's 🎙 voice chat:
  the microphone (PCM16, 48 kHz - or 16 kHz with no isolator)
    -> Voice Isolator realtime (48 kHz, 20 ms look-ahead: the room, the TV, the fans taken out)  [when installed / on]
    -> 16 kHz -> SAVA (speech + end-of-turn probabilities every 40 ms) -> its reference turn policy (TurnSegmenter)
    -> a closed, kept turn = the cleaned 16 kHz audio of it as a wav -> Node hears it (Whisper, lib/asrLive.js)
SAVA ends a turn when the SENTENCE is done (the end-of-turn probability crosses 0.9 once you go quiet), or after 1.6 s of
silence whatever it says - not after a fixed pause, so a pause to think does not cut you off.

One JSON line per request on stdin, one per answer on stdout (the first line out: {ready, device, isolator, rate} or {fatal}):
  {"id", "op": "open", "sid", "rate"}            a session (rate = what the client will send: 48000 or 16000)
  {"id", "op": "push", "sid", "pcm": base64}     little-endian int16 mono -> {"id", "events": [...]}
  {"id", "op": "close", "sid"}                   flush -> {"id", "events": [...]}
events: {"type": "speech"} a turn opened · {"type": "turn", "wav", "seconds", "reason"} · {"type": "dropped", "reason"}
config (argv[1], JSON): {"isolate": true|false, "device": "auto|cpu|cuda", "tmp": dir, "sava": repo/path, "isolator": repo/path}
"""
import base64
import json
import os
import sys
import tempfile
import time
import wave

import numpy as np

SR = 16000
FRAME = 640                     # SAVA's 40 ms frame at 16 kHz
ISO_SR = 48000


def out(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _resampler(src, dst):
    """a streaming resampler src -> dst (soxr's when there is one, else linear with the phase carried between pieces)"""
    if src == dst:
        return lambda x: x
    try:
        import soxr  # noqa: PLC0415
        rs = soxr.ResampleStream(src, dst, 1, dtype="float32")
        return lambda x: rs.resample_chunk(np.asarray(x, dtype=np.float32))
    except Exception:                                      # noqa: BLE001
        state = {"t": 0.0, "last": 0.0}
        step = src / float(dst)

        def lin(x):
            x = np.asarray(x, dtype=np.float32)
            if not x.size:
                return x
            buf = np.concatenate(([state["last"]], x))
            pos = np.arange(state["t"], len(x), step)
            y = np.interp(pos + 1.0, np.arange(len(buf)), buf).astype(np.float32)
            state["t"] = (pos[-1] + step - len(x)) if pos.size else state["t"] - len(x)
            state["last"] = float(x[-1])
            return y
        return lin


class Session:
    def __init__(self, k, rate):
        self.k = k
        self.rate = int(rate or ISO_SR)
        self.iso = k.isolator.stream() if k.isolator is not None else None
        self.to_iso = _resampler(self.rate, ISO_SR) if self.iso is not None else None
        self.to_16k = _resampler(ISO_SR if self.iso is not None else self.rate, SR)
        self.sava = k.sava.Session(k.model)
        self.cut = k.sava.TurnSegmenter(k.sava.Policy(), k.model.lookahead_frames)
        self.audio = np.zeros(0, dtype=np.float32)      # the cleaned 16 kHz stream, from sample `base`
        self.base = 0
        self.was_open = False
        self.t0 = time.time()

    def _turns(self, turns, events):
        for t in turns:
            if not t.kept:
                events.append({"type": "dropped", "reason": t.reason})
                continue
            a, b = t.start * FRAME - self.base, t.end * FRAME - self.base
            clip = self.audio[max(0, a):max(0, b)]
            if clip.size < SR // 5:
                events.append({"type": "dropped", "reason": "short"})
                continue
            path = os.path.join(self.k.tmp, f"turn_{os.getpid()}_{int(time.time() * 1000)}_{len(events)}.wav")
            with wave.open(path, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SR)
                w.writeframes((np.clip(clip, -1, 1) * 32767).astype("<i2").tobytes())
            events.append({"type": "turn", "wav": path, "seconds": round(clip.size / SR, 2), "reason": t.reason})

    def _feed(self, x16, events):
        if x16.size:
            self.audio = np.concatenate((self.audio, x16))
        frames = self.sava.push(x16) if x16.size else None
        if frames is not None and len(frames):
            self._turns(self.cut.feed(frames), events)
        if self.cut.open and not self.was_open:
            events.append({"type": "speech"})
        self.was_open = self.cut.open
        # keep what an open turn may still need (its pre-roll), drop the rest
        keep = 60 * SR if self.cut.open else 2 * SR
        if self.audio.size > keep:
            drop = self.audio.size - keep
            self.audio = self.audio[drop:]
            self.base += drop

    def push(self, pcm):
        events = []
        pcm = pcm[:len(pcm) // 2 * 2]                    # a stray odd byte: dropped
        x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        if self.iso is not None:
            x = np.asarray(self.iso.push(self.to_iso(x)), dtype=np.float32).reshape(-1)
        self._feed(self.to_16k(x), events)
        return events

    def close(self):
        events = []
        if self.iso is not None:
            try:
                tail = np.asarray(self.iso.flush(as_numpy=True), dtype=np.float32).reshape(-1)
                self._feed(self.to_16k(tail), events)
            except Exception:                              # noqa: BLE001
                pass
        frames = self.sava.flush()
        if frames is not None and len(frames):
            self._turns(self.cut.feed(frames), events)
        self._turns(self.cut.finish(), events)
        return events


class Kit:
    def __init__(self, conf):
        from inworld import sava  # noqa: PLC0415
        self.sava = sava
        dev = str(conf.get("device") or "auto")
        self.device = "cpu"
        try:
            import torch  # noqa: PLC0415
            if dev in ("auto", "cuda") and torch.cuda.is_available():
                self.device = "cuda"
        except Exception:                                  # noqa: BLE001
            pass
        self.model = sava.load(conf.get("sava") or "inworld/sava")     # SAVA is light: the CPU is enough (3.8 ms a frame)
        self.isolator = None
        if conf.get("isolate", True):
            from inworld import voice_isolation  # noqa: PLC0415
            kw = {"mode": "streaming", "lookahead_frames": 2}
            if self.device == "cuda":
                kw["device"] = "cuda"
            self.isolator = voice_isolation.VoiceIsolator(conf.get("isolator") or "inworld/voice-isolator", **kw)
        self.tmp = conf.get("tmp") or tempfile.gettempdir()
        os.makedirs(self.tmp, exist_ok=True)


def main():
    conf = {}
    if len(sys.argv) > 1:
        try:
            with open(sys.argv[1], encoding="utf-8") as f:
                conf = json.load(f)
        except (OSError, ValueError) as e:
            out({"fatal": f"cannot read the config: {e}"})
            return
    try:
        kit = Kit(conf)
    except Exception as e:                                 # noqa: BLE001
        out({"fatal": f"{type(e).__name__}: {e}"})
        return
    out({"ready": True, "device": kit.device, "isolator": kit.isolator is not None, "rate": ISO_SR if kit.isolator is not None else SR})
    sessions = {}
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except ValueError:
            continue
        rid, op, sid = req.get("id"), req.get("op"), str(req.get("sid") or "")
        try:
            if op == "open":
                sessions[sid] = Session(kit, req.get("rate"))
                out({"id": rid, "events": []})
            elif op == "push":
                s = sessions.get(sid)
                if s is None:
                    out({"id": rid, "error": "no such session"})
                    continue
                out({"id": rid, "events": s.push(base64.b64decode(req.get("pcm") or ""))})
            elif op == "close":
                s = sessions.pop(sid, None)
                out({"id": rid, "events": s.close() if s else []})
            elif op == "ping":
                out({"id": rid, "events": [], "sessions": len(sessions)})
            else:
                out({"id": rid, "error": f"unknown op {op}"})
        except Exception as e:                             # noqa: BLE001
            out({"id": rid, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
