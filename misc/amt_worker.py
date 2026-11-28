#!/usr/bin/env python3
"""bitGen Studio — ✍ CONTINUE worker (3.11.0): mode "amt" (lib/amtAddon.js, lib/amtNotes.js). Tim: "okay let go with 1" - the
Anticipatory Music Transformer writes the next bars of a note clip (the Edit Booth's 🎹 piano roll).

Runs misc/amt_run.py in the add-on's own Python (the anticipation code on PYTHONPATH, offline), passes its "[amt]" lines on
(the "step v/m" ones fill the queue's bar) and leaves the notes in <the job's folder>/amt/notes.json - routes/amt.js hands
them to the piano roll. A tool mode: done on exit code 0, no file in the project.
params: mode "amt", model (a Hugging Face repo), notes [{m, t, d}], start, end, instr, only, top_p, seed, amt {python, src}
"""
import json
import os
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

HERE = Path(__file__).resolve().parent


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def main():
    if len(sys.argv) != 2:
        fail("usage: amt_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    p = job["params"]
    if p.get("mode") != "amt":
        fail(f"amt_worker.py only runs mode=amt (got {p.get('mode')!r})")
    a = p.get("amt") or {}
    py, src = Path(str(a.get("python") or "")), Path(str(a.get("src") or ""))
    if not py.is_file() or not (src / "anticipation" / "sample.py").is_file():
        fail("✍ Continue is not installed - Settings ▸ Add-ons ▸ ✍ Continue (Anticipatory Music Transformer)")
    work = Path.cwd() / "amt"
    work.mkdir(parents=True, exist_ok=True)
    out = work / "notes.json"
    if out.exists():
        out.unlink()
    args = {k: p.get(k) for k in ("model", "notes", "start", "end", "instr", "only", "top_p", "seed")}
    args["out"] = str(out)
    af = work / "args.json"
    af.write_text(json.dumps(args), encoding="utf-8")
    say(f"[worker] amt_worker.py {p.get('model')} - {len(p.get('notes') or [])} notes in, {p.get('start')} s -> {p.get('end')} s")
    env = dict(os.environ, PYTHONUTF8="1", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", PYTHONPATH=str(src), TOKENIZERS_PARALLELISM="false")
    cmd = [str(py), str(HERE / "amt_run.py"), str(af)]
    say("> " + " ".join(cmd))
    pr = subprocess.Popen(cmd, cwd=str(work), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", env=env)
    tail = []
    for line in pr.stdout:
        line = line.rstrip()
        if not line or "it/s]" in line or "s/it]" in line:
            continue
        say(line if line.startswith("[amt]") else "[amt] " + line)
        if "Error" in line or "ERROR" in line:
            tail = (tail + [line])[-3:]
    code = pr.wait()
    if code != 0 or not out.is_file():
        fail("the Anticipatory Music Transformer stopped: " + (" | ".join(tail) or f"exit {code}"))
    n = len(json.loads(out.read_text(encoding="utf-8")).get("notes") or [])
    say(f"[worker] continue complete - {n} new notes")


if __name__ == "__main__":
    main()
