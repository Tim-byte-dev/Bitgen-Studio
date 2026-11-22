"""stand-in for inworld.voice_isolation (see __init__.py): a stream that halves quiet samples (the "noise")"""
import numpy as np


class _Stream:
    def push(self, x):
        x = np.asarray(x, dtype=np.float32)
        return np.where(np.abs(x) < 0.02, x * 0.5, x).astype(np.float32)

    def flush(self, as_numpy=False):
        return np.zeros(0, dtype=np.float32)


class VoiceIsolator:
    sample_rate = 48000

    def __init__(self, model="inworld/voice-isolator", mode="offline", lookahead_frames=0, **_kw):
        if mode != "streaming":
            raise ValueError("the stand-in only streams")

    def stream(self, **_kw):
        return _Stream()
