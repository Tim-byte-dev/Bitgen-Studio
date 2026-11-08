#!/usr/bin/env python3
"""bitGen Studio — FlowHMR MOTION CAPTURE worker (2.730.0): mode "flowhmr".

Tim (verbatim): "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it
to addons with a disclaimer that it is for non commercial use only".

One job = the motion of the person in one video, as FlowHMR's own command makes it:
  1. the video copied into the job folder under a name that says the camera setting (FlowHMR caches its features by the
     video's name - a different setting must not reuse them);
  2. FlowHMR's run_v2m_demo_generation.py in its own venv (Settings ▸ Add-ons ▸ FlowHMR): person detection (YOLOX),
     the camera (VGGT-Omega - skipped for a still camera), body features (SAM 3D Body), then FlowHMR;
  3. its output/<name>/flowhmr_latest.npz (SMPL-H) + .fbx (when the FBX SDK installed) -> the project's models3d/ as
     <video>_motion.fbx / .npz (a link in the job's output folder) -> @@OUT.
NON-COMMERCIAL USE ONLY: the SMPL-H body model and Meta's SAM 3D Body / VGGT-Omega licences.
params: mode "flowhmr", source (abs path), camera ("moving" | "still"), every (VGGT every N frames), steps, models_dir,
flowhmr (the install's paths - lib/flowhmrAddon.paths), label.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

STAGES = 3
NOTICE = ("NON-COMMERCIAL USE ONLY - FlowHMR needs the SMPL-H body model and Meta's SAM 3D Body / VGGT-Omega, "
          "whose licences do not allow commercial use")


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def safe_stem(name):
    s = re.sub(r"[^A-Za-z0-9_-]+", "_", Path(name).stem).strip("_")
    return (s or "video")[:60]


def free_name(d, stem, ext):
    n, i = f"{stem}{ext}", 2
    while (d / n).exists():
        n, i = f"{stem}_{i}{ext}", i + 1
    return n


def link_into(src, dst):
    try:
        if dst.exists():
            dst.unlink()
        os.link(src, dst)
    except OSError:
        shutil.copyfile(src, dst)


def main():
    if len(sys.argv) != 2:
        fail("usage: flowhmr_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "flowhmr":
        fail(f"flowhmr_worker.py only runs mode=flowhmr (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the video is gone: {src}")
    fp = params.get("flowhmr") or {}
    py, script, ckpt = Path(str(fp.get("python") or "")), Path(str(fp.get("script") or "")), Path(str(fp.get("ckpt") or ""))
    if not py.is_file() or not script.is_file() or not ckpt.is_file():
        fail("FlowHMR is not installed - Settings ▸ Add-ons ▸ FlowHMR (" + ", ".join(
            w for w, p in (("its Python", py), ("the code", script), ("the model", ckpt)) if not p.is_file()) + " missing)")
    models_dir = Path(str(params.get("models_dir") or "")) if params.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    say(f"[worker] flowhmr_worker.py source={src.name}")
    say(f"[worker] {NOTICE}")

    # 1 the video, named by its setting
    stage(1, "preparing the video")
    still = str(params.get("camera") or "moving") == "still"
    every = max(1, int(params.get("every") or 10))
    steps = max(1, int(params.get("steps") or 20))
    stem = safe_stem(src.name) + ("_still" if still else f"_cam{every}")
    feed = work / (stem + (src.suffix.lower() if src.suffix.lower() in (".mp4", ".mov", ".mkv", ".webm", ".avi") else ".mp4"))
    shutil.copyfile(src, feed)
    say(f"[worker] {feed.name}: " + ("still camera (no camera estimate)" if still else f"moving camera, VGGT-Omega every {every} frame(s)"))

    # 2 FlowHMR's own command, in its venv
    stage(2, "capturing the motion (detection, camera, body features, FlowHMR)")
    cmd = [str(py), str(script), str(feed), "--ckpt", str(ckpt), "--steps", str(steps)]
    cmd += ["--static_camera"] if still else ["--vggt_interval", str(every)]
    env = dict(os.environ, PYTHONUTF8="1", FLOWHMR_ATTENTION_BACKEND=os.environ.get("FLOWHMR_ATTENTION_BACKEND", "query_batched"))
    say("> " + " ".join(cmd))
    p = subprocess.Popen(cmd, cwd=str(script.parent), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                         encoding="utf-8", errors="replace", env=env)
    tail = []
    for line in p.stdout:
        line = line.rstrip()
        if line:
            say("[flowhmr] " + line)
            tail = (tail + [line])[-8:]
    code = p.wait()
    if code != 0:
        why = " | ".join(tail[-3:])
        hint = ""
        if re.search(r"out of memory|CUDA error: out of memory", why, re.I):
            hint = " - try a still camera, or the camera every 10 frames"
        elif "missing files" in why:
            hint = " - Settings ▸ Add-ons ▸ FlowHMR says what is missing"
        fail(f"FlowHMR stopped (exit {code}): {why}{hint}")

    # 3 into models3d/
    stage(3, "saving the motion")
    out = script.parent / "output" / stem
    npz = out / (ckpt.stem + ".npz")
    if not npz.is_file():
        fail(f"FlowHMR finished but wrote no {npz.name} in {out}")
    base = safe_stem(src.name) + "_motion"
    made = []
    fbx = npz.with_suffix(".fbx")
    for f in ([fbx] if fbx.is_file() else []) + [npz]:
        name = free_name(models_dir, base, f.suffix)
        shutil.copyfile(f, models_dir / name)
        link_into(models_dir / name, output_dir / name)
        made.append(name)
        say(f"[worker] {f.stat().st_size // 1024} KB -> models3d/{name}")
    if not fbx.is_file():
        say("[worker] no .fbx (the FBX SDK is not installed in FlowHMR's venv) - the .npz holds the SMPL-H motion")
    for i, n in enumerate(made):
        say(f"[worker] file {i + 1}/{len(made)} written -> {n}")
    say("@@MODEL3D " + made[0])
    say("@@OUT " + made[0])
    say("[worker] flowhmr complete")


if __name__ == "__main__":
    main()
