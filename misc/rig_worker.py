#!/usr/bin/env python3
"""bitGen Studio — 🦴 RIG IT worker (2.976.0): mode "rig" - UniRig (MIT) gives any 3D model a skeleton and skin weights.

Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with facegen?" ->
"yes please" (rig what 🧊 Convert to 3D / 🧱 Picture → 3D scene make).

UniRig's launch/inference/*.sh are bash; the same Python steps are run here, in its venv, with cwd = its folder:
  1. src.data.extract on the model                       -> npz1/<stem>/raw_data.npz
  2. run.py skeleton task (articulation-xl, 256)         -> work/skeleton/<stem>.fbx
  3. src.data.extract on that skeleton .fbx              -> npz2/<stem>/raw_data.npz
  4. run.py skin task                                     -> work/skin/<stem>.fbx
  5. src.inference.merge (the skin onto the ORIGINAL model, its textures kept) -> models3d/<stem>_rigged.glb -> @@OUT
skin false = the skeleton only (merged without weights).
params: mode "rig", source (abs path), name, seed, faces, skin, suffix, models_dir, unirig {python, src}, label.
"""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

SKELETON_TASK = "configs/task/quick_inference_skeleton_articulationxl_ar_256.yaml"
SKIN_TASK = "configs/task/quick_inference_unirig_skin.yaml"
DATA_CONFIG = "configs/data/quick_inference.yaml"


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


def extract_cmd(py, model, npz, p, stamp):
    return [str(py), "-m", "src.data.extract", f"--config={DATA_CONFIG}", f"--require_suffix={p.get('suffix') or 'obj,fbx,FBX,dae,glb,gltf,vrm'}",
            f"--faces_target_count={int(p.get('faces') or 50000)}", "--num_runs=1", "--force_override=true", "--id=0", f"--time={stamp}",
            f"--input={model}", f"--output_dir={npz}"]


def run_cmd(py, task, src, out, npz, seed, data_name=None):
    c = [str(py), "run.py", f"--task={task}", f"--seed={int(seed)}", f"--input={src}", f"--output={out}", f"--npz_dir={npz}"]
    if data_name:
        c.append(f"--data_name={data_name}")
    return c


def merge_cmd(py, source, target, out, p):
    return [str(py), "-m", "src.inference.merge", f"--require_suffix={p.get('suffix') or 'obj,fbx,FBX,dae,glb,gltf,vrm'}", "--num_runs=1", "--id=0",
            f"--source={source}", f"--target={target}", f"--output={out}"]


def plan(py, model, work, p, stamp):
    """the five steps: [(what, cmd, expected file or None)]"""
    stem = Path(str(p.get("name") or Path(model).stem))
    npz1, npz2 = work / "npz1", work / "npz2"
    skel = work / "skeleton" / f"{stem}.fbx"
    skin = work / "skin" / f"{stem}.fbx"
    out = work / f"{stem}_rigged.glb"
    seed = p.get("seed") if p.get("seed") is not None else 12345
    steps = [("reading the model", extract_cmd(py, model, npz1, p, stamp), None),
             ("the skeleton (UniRig)", run_cmd(py, SKELETON_TASK, model, skel, npz1, seed), skel)]
    if p.get("skin", True):
        steps += [("reading the skeleton", extract_cmd(py, skel, npz2, p, stamp), None),
                  ("the skin weights (UniRig)", run_cmd(py, SKIN_TASK, skel, skin, npz2, seed, "raw_data.npz"), skin),
                  ("the rig onto the model", merge_cmd(py, skin, model, out, p), out)]
    else:
        steps += [("the skeleton onto the model", merge_cmd(py, skel, model, out, p), out)]
    return steps, out


def main():
    if len(sys.argv) != 2:
        fail("usage: rig_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    p = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    if p.get("mode") != "rig":
        fail(f"rig_worker.py only runs mode=rig (got {p.get('mode')!r})")
    model = Path(str(p.get("source") or ""))
    if not model.is_file():
        fail(f"the model is gone: {model}")
    u = p.get("unirig") or {}
    py, src = Path(str(u.get("python") or "")), Path(str(u.get("src") or ""))
    if not py.is_file() or not (src / "run.py").is_file():
        fail("🦴 Rig it is not installed - Settings ▸ Add-ons ▸ 🦴 Rig it (UniRig)")
    models_dir = Path(str(p.get("models_dir") or "")) if p.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd() / "rig"
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    for d in ("npz1", "npz2", "skeleton", "skin"):
        (work / d).mkdir(parents=True, exist_ok=True)
    # a copy named by the job (UniRig names its folders after the file's stem)
    stem = "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in str(p.get("name") or model.stem))[:60] or "model"
    p["name"] = stem
    feed = work / (stem + model.suffix.lower())
    shutil.copyfile(model, feed)
    say(f"[worker] rig_worker.py source={model.name} skin={'yes' if p.get('skin', True) else 'no'}")
    steps, out = plan(py, feed, work, p, time.strftime("%Y_%m_%d_%H_%M_%S"))
    env = dict(os.environ, PYTHONUTF8="1")
    for i, (what, cmd, expect) in enumerate(steps, 1):
        say(f"[worker] step {i}/{len(steps)} - {what}")
        say("> " + " ".join(cmd))
        pr = subprocess.Popen(cmd, cwd=str(src), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", env=env)
        tail = []
        for line in pr.stdout:
            line = line.rstrip()
            if line:
                say("[unirig] " + line)
                tail = (tail + [line])[-6:]
        code = pr.wait()
        if code != 0 or (expect is not None and not Path(expect).is_file()):
            why = " | ".join(tail[-3:]) or f"exit {code}"
            hint = " - the model may be too big: fewer faces" if "out of memory" in why.lower() else ""
            fail(f"UniRig stopped at '{what}': {why}{hint}")
    name = free_name(models_dir, f"{stem}_rigged", ".glb")
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
    say("[worker] rig complete")


if __name__ == "__main__":
    main()
