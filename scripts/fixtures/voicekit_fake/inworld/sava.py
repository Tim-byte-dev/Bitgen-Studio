"""stand-in for inworld.sava (see __init__.py)"""
import dataclasses

import numpy as np

FRAME = 640


class _Model:
    lookahead_frames = 3


def load(_src="inworld/sava"):
    return _Model()


@dataclasses.dataclass
class Frames:
    first: int
    speech: np.ndarray
    turn: np.ndarray

    def __len__(self):
        return self.speech.size


class Session:
    def __init__(self, model):
        self.lag = model.lookahead_frames
        self.buf = np.zeros(0, dtype=np.float32)
        self.n = 0
        self.levels = []
        self.quiet = 0

    def _step(self, frames_audio):
        sp, tu = [], []
        for f in frames_audio:
            lvl = float(np.sqrt(np.mean(f * f))) if f.size else 0.0
            self.levels.append(lvl)
            self.quiet = 0 if lvl > 0.05 else self.quiet + 1
            judged = len(self.levels) - 1 - self.lag
            sp.append(1.0 if judged >= 0 and self.levels[judged] > 0.05 else 0.0)
            tu.append(0.95 if self.quiet >= 10 else 0.05)
        first = self.n
        self.n += len(frames_audio)
        return Frames(first, np.array(sp, dtype=np.float32), np.array(tu, dtype=np.float32))

    def push(self, piece):
        self.buf = np.concatenate((self.buf, np.asarray(piece, dtype=np.float32).reshape(-1)))
        k = self.buf.size // FRAME
        frames = [self.buf[i * FRAME:(i + 1) * FRAME] for i in range(k)]
        self.buf = self.buf[k * FRAME:]
        return self._step(frames)

    def flush(self):
        return self._step([np.zeros(FRAME, dtype=np.float32)] * self.lag)


@dataclasses.dataclass(frozen=True)
class Policy:
    speech_threshold: float = 0.5
    turn_threshold: float = 0.9
    pre_roll_ms: int = 800
    max_silence_ms: int = 1600
    min_speech_ms: int = 400


@dataclasses.dataclass
class Turn:
    start: int
    end: int
    speech_ms: int
    reason: str
    kept: bool


class TurnSegmenter:
    def __init__(self, policy, lag):
        self.p, self.lag = policy, lag
        self._start = None
        self._speech = 0
        self._pause = 0
        self._last = -1

    @property
    def open(self):
        return self._start is not None

    def feed(self, frames):
        out = []
        for i in range(len(frames)):
            judged = frames.first + i - self.lag
            if judged < 0:
                continue
            self._last = judged
            sp = frames.speech[i] >= self.p.speech_threshold
            if self._start is None:
                if not sp:
                    continue
                self._start, self._speech, self._pause = max(0, judged - self.p.pre_roll_ms // 40), 0, 0
            if sp:
                self._speech += 40
                self._pause = 0
                continue
            self._pause += 1
            if frames.turn[i] >= self.p.turn_threshold or self._pause * 40 >= self.p.max_silence_ms:
                out.append(self._close(judged + 1, "turn" if frames.turn[i] >= self.p.turn_threshold else "silence"))
        return out

    def finish(self):
        return [self._close(self._last + 1, "end")] if self._start is not None else []

    def _close(self, end, why):
        t = Turn(self._start, end, self._speech, why, self._speech >= self.p.min_speech_ms)
        self._start = None
        return t
