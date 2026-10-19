#!/usr/bin/env python3
"""stems_local.py — vocal/instrumental separation, run INSIDE venvs/demucs.

Invoked as `venv-python stems_local.py <job.json>` (the lib/venv.js runJson
contract): reads one job, prints ONE json line on stdout, logs to stderr.

Job: { "file": "<abs path to the song>", "out_dir": "<abs dir>",
       "model": "htdemucs", "device": "cuda"|"cpu"|"auto",
       "stem": "<base name for outputs>" }
Answer: { "vocals": "<abs>", "instrumental": "<abs>" } or { "error": "..." }

Demucs pulls the htdemucs weights from its own hub cache on first run —
fully local afterwards. --two-stems=vocals yields exactly the pair Tim
asked for: the lyrics (vocals) apart from the instruments (no_vocals).
"""
import json, os, shutil, subprocess, sys, tempfile


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "stems_local: expected <job.json>"}))
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)
    src = job.get("file") or ""
    if not os.path.isfile(src):
        print(json.dumps({"error": f"no such file: {src}"}))
        return 1
    out_dir = job.get("out_dir") or os.path.dirname(src)
    os.makedirs(out_dir, exist_ok=True)
    model = job.get("model") or "htdemucs"
    device = job.get("device") or "auto"
    stem = job.get("stem") or os.path.splitext(os.path.basename(src))[0]

    work = tempfile.mkdtemp(prefix="h3stems_")
    cmd = [sys.executable, "-m", "demucs.separate",
           "-n", model, "--two-stems", "vocals", "-o", work]
    if device in ("cuda", "cpu"):
        cmd += ["-d", device]
    cmd.append(src)
    sys.stderr.write("[stems] " + " ".join(cmd) + "\n")
    sys.stderr.flush()
    r = subprocess.run(cmd, stdout=sys.stderr, stderr=sys.stderr)
    if r.returncode != 0:
        print(json.dumps({"error": f"demucs exited {r.returncode} - read the log above"}))
        return 1

    # demucs writes <work>/<model>/<track>/{vocals,no_vocals}.wav
    track = os.path.splitext(os.path.basename(src))[0]
    made = os.path.join(work, model, track)
    pair = {}
    for kind, suffix in (("vocals", "_vocals"), ("no_vocals", "_instrumental")):
        p = os.path.join(made, kind + ".wav")
        if not os.path.isfile(p):
            print(json.dumps({"error": f"demucs finished but {kind}.wav is missing in {made}"}))
            return 1
        dst = os.path.join(out_dir, stem + suffix + ".wav")
        shutil.move(p, dst)
        pair["instrumental" if kind == "no_vocals" else "vocals"] = dst
    shutil.rmtree(work, ignore_errors=True)
    print(json.dumps(pair))
    return 0


if __name__ == "__main__":
    sys.exit(main())
