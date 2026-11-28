#!/usr/bin/env python3
"""bitGen Studio — ✍ CONTINUE's runner (3.11.0): runs IN the add-on's own Python (lib/amtAddon.js), the anticipation code on
PYTHONPATH. Reads args.json, writes notes.json. Started by misc/amt_worker.py.

args: model (a Hugging Face repo, already in the cache), notes [{m, t, d}] (s), start, end (s - write from start to end),
      instr (a General MIDI program the notes are played as), only (write that instrument only), top_p, seed, out
out:  {"notes": [{m, t, d, instr}], "device": "cuda" | "cpu"} - every note the model wrote from `start` on

The Anticipatory Music Transformer (Thickstun et al., Stanford CRFM, Apache-2.0): events of 3 tokens - time (10 ms steps),
duration, instrument x 128 + pitch - with the offsets of anticipation/vocab.py; generate() (anticipation/sample.py) writes what
comes after the prompt. bitGen's own parts: the notes -> events, "only this instrument" (its instr_logits made to keep one
instrument's notes), the progress lines ("[amt] writing: step v/m") and events -> notes.
"""
import json
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass


def say(line):
    print(line, flush=True)


def to_events(notes, instr, V):
    """our notes (s) -> the model's event tokens, in time order"""
    ev = []
    for n in sorted(notes, key=lambda n: (n["t"], n["m"])):
        t = max(0, int(round(float(n["t"]) * V.TIME_RESOLUTION)))
        d = max(1, min(V.MAX_DUR - 1, int(round(float(n["d"]) * V.TIME_RESOLUTION))))
        if t >= V.MAX_TIME:
            continue
        ev += [V.TIME_OFFSET + t, V.DUR_OFFSET + d, V.NOTE_OFFSET + instr * V.MAX_PITCH + int(n["m"])]
    return ev


def from_events(events, start_bins, V):
    """the model's events -> notes (s) from start on (rests and anything not a note left out)"""
    out = []
    for i in range(0, len(events) - 2, 3):
        t, d, nt = events[i] - V.TIME_OFFSET, events[i + 1] - V.DUR_OFFSET, events[i + 2] - V.NOTE_OFFSET
        if not (0 <= nt < V.MAX_NOTE) or t < start_bins or d < 0:
            continue
        out.append({"m": nt % V.MAX_PITCH, "t": t / V.TIME_RESOLUTION, "d": max(1, d) / V.TIME_RESOLUTION, "instr": nt // V.MAX_PITCH})
    return out


class Progress:
    """stands in for tqdm inside generate(): '[amt] writing: step v/m' (the queue's bar) every ~5 %"""
    def __init__(self, it=None, total=None, **_):
        self.total = total if total is not None else (len(it) if it is not None else 0)
        self.n, self.last = 0, -1

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def update(self, k=1):
        self.n += k
        pct = int(100 * min(self.n, self.total) / max(1, self.total))
        if pct // 5 != self.last // 5:
            self.last = pct
            say(f"[amt] writing: step {min(self.n, self.total)}/{max(1, self.total)}")


def main():
    a = json.load(open(sys.argv[1], encoding="utf-8"))
    from anticipation import config as C, vocab as V, sample as S
    import torch
    from transformers import AutoModelForCausalLM
    seed = int(a.get("seed") or 0)
    torch.manual_seed(seed)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    say(f"[amt] loading {a['model']} on the {'graphics card' if dev == 'cuda' else 'CPU'}")
    model = AutoModelForCausalLM.from_pretrained(a["model"], local_files_only=True).to(dev)
    model.eval()
    instr = int(a.get("instr") or 0)
    if a.get("only", True):
        keep_lo, keep_hi = V.NOTE_OFFSET + instr * V.MAX_PITCH, V.NOTE_OFFSET + (instr + 1) * V.MAX_PITCH

        def one_instrument(logits, _history):
            logits[V.NOTE_OFFSET:keep_lo] = -float("inf")
            logits[keep_hi:V.NOTE_OFFSET + V.MAX_NOTE] = -float("inf")
            return logits
        S.instr_logits = one_instrument
    S.tqdm = Progress
    inputs = to_events(a.get("notes") or [], instr, V)
    start, end = float(a["start"]), float(a["end"])
    say(f"[amt] {len(inputs) // 3} notes in, writing {start:.2f} s - {end:.2f} s (top_p {a.get('top_p', 0.97)}, seed {seed})")
    events = S.generate(model, start_time=start, end_time=end, inputs=inputs, top_p=float(a.get("top_p", 0.97)))
    notes = from_events(events, int(round(start * C.TIME_RESOLUTION)), V)
    json.dump({"notes": notes, "device": dev}, open(a["out"], "w", encoding="utf-8"))
    say(f"[amt] {len(notes)} new notes")


if __name__ == "__main__":
    main()
