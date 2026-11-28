#!/usr/bin/env python3
"""bitGen Studio — 💎 FINE DETAIL worker (3.7.0): mode "d3v3" - Direct3D-V3 carves fine detail into a rough 3D model of a
picture (lib/d3v3Addon.js). Tim: "can you add this to sketcher. https://dreamtechai.github.io/Direct3D-V3/"

Runs misc/d3v3_run.py in the add-on's own Python (cwd = its Direct3D-V3 folder), passes its "[d3v3]" lines on (the
"step v/m" ones fill the queue's bar), and puts the result in the project's models3d as <name>_detail.glb.
params: mode "d3v3", image, coarse (abs paths), name, resolution, steps, cfg, seed, max_tokens, target_faces, models_dir,
d3v3 {python, src}, label.
"""
import json
import os
import shutil
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


def free_name(d, stem, ext):
    n, i = f"{stem}{ext}", 2
    while (d / n).exists():
        n, i = f"{stem}_{i}{ext}", i + 1
    return n


def main():
    if len(sys.argv) != 2:
        fail("usage: d3v3_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    p = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    if p.get("mode") != "d3v3":
        fail(f"d3v3_worker.py only runs mode=d3v3 (got {p.get('mode')!r})")
    image, coarse = Path(str(p.get("image") or "")), Path(str(p.get("coarse") or ""))
    if not image.is_file():
        fail(f"the picture is gone: {image}")
    if not coarse.is_file():
        fail(f"the rough model is gone: {coarse}")
    a = p.get("d3v3") or {}
    py, src = Path(str(a.get("python") or "")), Path(str(a.get("src") or ""))
    if not py.is_file() or not (src / "direct3d" / "pipeline.py").is_file():
        fail("💎 Fine detail is not installed - Settings ▸ Add-ons ▸ 💎 Fine detail (Direct3D-V3)")
    models_dir = Path(str(p.get("models_dir") or "")) if p.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    stem = "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in str(p.get("name") or coarse.stem))[:60] or "model"
    work = Path.cwd() / "d3v3"
    work.mkdir(parents=True, exist_ok=True)
    out = work / f"{stem}_detail.glb"
    if out.exists():
        out.unlink()
    args = {"image": str(image), "coarse": str(coarse), "out": str(out), "src": str(src), "resolution": p.get("resolution", 1024),
            "steps": p.get("steps", 15), "cfg": p.get("cfg", 4.0), "seed": p.get("seed", 2026), "max_tokens": p.get("max_tokens", 150000),
            "target_faces": p.get("target_faces"), "model": p.get("model") or "wushuang98/Direct3D-V3", "offline": True}
    af = work / "args.json"
    af.write_text(json.dumps(args), encoding="utf-8")
    say(f"[worker] d3v3_worker.py picture={image.name} rough={coarse.name} detail={args['resolution']}")
    env = dict(os.environ, PYTHONUTF8="1", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", PYTHONPATH=str(src))
    cmd = [str(py), str(HERE / "d3v3_run.py"), str(af)]
    say("> " + " ".join(cmd))
    pr = subprocess.Popen(cmd, cwd=str(src), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", env=env)
    tail = []
    for line in pr.stdout:
        line = line.rstrip()
        if not line:
            continue
        say(line if line.startswith("[d3v3]") else "[d3v3] " + line)
        if "ERROR" in line or "Error" in line:
            tail = (tail + [line])[-3:]
    code = pr.wait()
    if code != 0 or not out.is_file():
        fail("Direct3D-V3 stopped: " + (" | ".join(tail) or f"exit {code}"))
    name = free_name(models_dir, f"{stem}_detail", ".glb")
    shutil.copyfile(out, models_dir / name)
    try:
        if (output_dir / name).exists():
            (output_dir / name).unlink()
        os.link(models_dir / name, output_dir / name)
    except OSError:
        shutil.copyfile(models_dir / name, output_dir / name)
    say(f"[worker] {(models_dir / name).stat().st_size // 1024} KB -> models3d/{name}")
    say("@@MODEL3D " + name)
    say("@@OUT " + name)
    say("[worker] fine detail complete")


if __name__ == "__main__":
    main()
