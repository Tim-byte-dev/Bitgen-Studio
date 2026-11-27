#!/usr/bin/env python3
"""bitGen Studio — ⛰ PANORAMA DEPTH worker (2.994.0): mode "panodepth" - PaGeR (code Apache-2.0, weights CC BY-NC 4.0:
NON-COMMERCIAL use only) reads a 360° panorama's shape. Tim: "is this worth adding? https://pager360.github.io/" -> "yes do it
please, first time dl, add disclaimer that these models are for non-commercial use only".

This worker runs in the app's Python (stdlib only); the model runs in PaGeR's own venv: misc/pager_run.py, cwd = its folder.
It writes into the job's output folder (the gallery): <stem>_depth.png, <stem>_360_TB.png (the stereo 360), the depth files;
the walk-in mesh <stem>_depth.glb goes into the project's models3d too (@@MODEL3D).
params: mode "panodepth", source (abs path), name, scene, ipd, stereo, mesh, models_dir, pager {python, src, repo}, label.
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


def free_stem(d, stem):
    s, i = stem, 2
    while (d / f"{s}_depth.glb").exists() or (d / f"{s}_depth.png").exists():
        s, i = f"{stem}_{i}", i + 1
    return s


def main():
    if len(sys.argv) != 2:
        fail("usage: pager_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    p = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    if p.get("mode") != "panodepth":
        fail(f"pager_worker.py only runs mode=panodepth (got {p.get('mode')!r})")
    pic = Path(str(p.get("source") or ""))
    if not pic.is_file():
        fail(f"the panorama is gone: {pic}")
    g = p.get("pager") or {}
    py, src = Path(str(g.get("python") or "")), Path(str(g.get("src") or ""))
    if not py.is_file() or not (src / "src" / "pager.py").is_file():
        fail("⛰ Panorama depth is not installed - Settings ▸ Add-ons ▸ ⛰ Panorama depth (PaGeR)")
    say("[worker] ⛰ Panorama depth - PaGeR's weights are CC BY-NC 4.0: NON-COMMERCIAL use only")
    stem = free_stem(output_dir, "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in str(p.get("name") or pic.stem))[:60] or "panorama")
    work = Path.cwd() / "panodepth"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    args = {"image": str(pic), "out_dir": str(work), "stem": stem, "scene": p.get("scene") or "auto", "ipd": p.get("ipd") or 0.064,
            "stereo": p.get("stereo", True), "mesh": p.get("mesh", True), "repo": g.get("repo") or "prs-eth/PaGeR", "geo_dir": str(HERE)}
    af = work / "args.json"
    af.write_text(json.dumps(args), encoding="utf-8")
    cmd = [str(py), str(HERE / "pager_run.py"), str(af)]
    say("> " + " ".join(cmd))
    env = dict(os.environ, PYTHONUTF8="1")
    pr = subprocess.Popen(cmd, cwd=str(src), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", env=env)
    tail, result = [], None
    for line in pr.stdout:
        line = line.rstrip()
        if not line:
            continue
        if line.startswith("@@RESULT "):
            try:
                result = json.loads(line[9:])
            except json.JSONDecodeError:
                result = None
            continue
        say("[pager] " + line if not line.startswith("[pager]") else line)
        tail = (tail + [line])[-6:]
    code = pr.wait()
    if code != 0 or not result:
        why = " | ".join(tail[-3:]) or f"exit {code}"
        hint = " - not enough GPU memory: PaGeR needs about 12 GB free (close other jobs / ComfyUI's models)" if "out of memory" in why.lower() else ""
        fail(f"PaGeR stopped: {why}{hint}")
    files = result.get("files") or {}
    # the gallery gets the stereo 360, the coloured depth and the view's small files (.f32 / .json - not listed as pictures);
    # the mesh and the full depth / normals / sky pictures go into the project's models3d
    models_dir = Path(str(p.get("models_dir") or "")) if p.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    for k, n in files.items():
        shutil.copyfile(work / n, (output_dir if k in ("stereo", "preview", "grid", "meta") else models_dir) / n)
    outs = [files[k] for k in ("stereo", "preview") if k in files]
    if "mesh" in files:
        say(f"[worker] the walk-in mesh -> models3d/{files['mesh']} (+ the depth / normals / sky pictures)")
        say("@@MODEL3D " + files["mesh"])
    say(f"[worker] {result.get('scene')} · nearest {result.get('near', 0):.2f} m · middle {result.get('median', 0):.1f} m · "
        f"{result.get('seconds')} s")
    say("@@OUTS " + json.dumps(outs))
    say("@@OUT " + (outs[-1] if outs else files.get("meta", "")))
    say("[worker] panodepth complete")


if __name__ == "__main__":
    main()
