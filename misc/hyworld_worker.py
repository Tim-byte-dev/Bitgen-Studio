#!/usr/bin/env python3
"""bitGen Studio — HunyuanWorld 1.0 WALK-IN WORLD worker (2.975.0): mode "hyworld".

Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5" - step 5b
of 🧱 Picture → 3D scene: the scene's 360° panorama -> a layered 3D mesh world you can walk into.

One job:
  1. HunyuanWorld 1.0's own demo_scenegen.py in its venv (Settings ▸ Add-ons ▸ HunyuanWorld 1.0): the panorama, the class
     (indoor / outdoor), the foreground objects to lift out as layers 1 and 2; Low memory = the authors' fp8 / cache
     switches when this version of the demo has them;
  2. its mesh_layer*.ply files -> ONE .glb (trimesh, in the same venv) -> the project's models3d/<name>_world.glb -> @@OUT.
LICENCE: Tencent HunyuanWorld 1.0 Community License (not the EU, the UK or South Korea) + FLUX.1 Fill [dev] (non-commercial).
params: mode "hyworld", source (the panorama, abs path), name, classes, labels_fg1, labels_fg2, low_memory, seed, models_dir,
hyworld (lib/hyworldAddon.paths), label.
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

STAGES = 2
NOTICE = ("Tencent HunyuanWorld 1.0 Community License (no use in the EU, the UK or South Korea); "
          "FLUX.1 Fill [dev] - non-commercial")
TO_GLB = r'''
import glob, os, sys
import trimesh
out, files = sys.argv[1], sorted(glob.glob(os.path.join(sys.argv[2], "mesh_layer*.ply")))
if not files:
    sys.exit("no mesh_layer*.ply")
scene = trimesh.Scene()
for f in files:
    m = trimesh.load(f, process=False)
    scene.add_geometry(m, node_name=os.path.splitext(os.path.basename(f))[0], geom_name=os.path.splitext(os.path.basename(f))[0])
scene.export(out)
print("glb", out, len(files))
'''


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


def free_name(d, stem, ext):
    n, i = f"{stem}{ext}", 2
    while (d / n).exists():
        n, i = f"{stem}_{i}{ext}", i + 1
    return n


def low_memory_flags(script_text):
    """the authors' fp8 / cache switches - only those this version of demo_scenegen.py has"""
    return [f for f in ("--fp8_attention", "--fp8_gemm", "--cache") if f in script_text]


def scene_cmd(py, script, pano, out, p, script_text=""):
    cmd = [str(py), str(script), "--image_path", str(pano), "--classes", str(p.get("classes") or "outdoor"), "--output_path", str(out)]
    for k in ("labels_fg1", "labels_fg2"):
        labels = [re.sub(r"[^A-Za-z0-9 _-]+", " ", str(x)).strip() for x in (p.get(k) or [])]
        labels = [x.replace(" ", "_") for x in labels if x]
        if labels:
            cmd += ["--" + k] + labels
    if p.get("seed") is not None and "--seed" in script_text:
        cmd += ["--seed", str(int(p.get("seed")))]
    if p.get("low_memory", True):
        cmd += low_memory_flags(script_text)
    return cmd


def main():
    if len(sys.argv) != 2:
        fail("usage: hyworld_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "hyworld":
        fail(f"hyworld_worker.py only runs mode=hyworld (got {params.get('mode')!r})")
    pano = Path(str(params.get("source") or ""))
    if not pano.is_file():
        fail(f"the panorama is gone: {pano}")
    hp = params.get("hyworld") or {}
    py, script = Path(str(hp.get("python") or "")), Path(str(hp.get("script") or ""))
    if not py.is_file() or not script.is_file():
        fail("HunyuanWorld 1.0 is not installed - Settings ▸ Add-ons ▸ HunyuanWorld 1.0")
    models_dir = Path(str(params.get("models_dir") or "")) if params.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    say(f"[worker] hyworld_worker.py source={pano.name}")
    say(f"[worker] {NOTICE}")

    stage(1, "building the world (HunyuanWorld 1.0: depth, layers, the hidden parts filled)")
    out = work / "world"
    if out.exists():
        shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    try:
        text = script.read_text(encoding="utf-8", errors="replace")
    except OSError:
        text = ""
    cmd = scene_cmd(py, script, pano, out, params, text)
    env = dict(os.environ, PYTHONUTF8="1")
    say("> " + " ".join(cmd))
    p = subprocess.Popen(cmd, cwd=str(script.parent), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                         encoding="utf-8", errors="replace", env=env)
    tail = []
    for line in p.stdout:
        line = line.rstrip()
        if line:
            say("[hyworld] " + line)
            tail = (tail + [line])[-8:]
    code = p.wait()
    if code != 0:
        why = " | ".join(tail[-3:])
        hint = ""
        if re.search(r"out of memory", why, re.I):
            hint = " - it needs about 24 GB of graphics memory with Low memory on; close other renders (ComfyUI keeps models loaded)"
        elif re.search(r"401|403|gated|access", why, re.I):
            hint = " - accept FLUX.1 Fill [dev]'s licence on Hugging Face and set your token in Settings"
        fail(f"HunyuanWorld stopped (exit {code}): {why}{hint}")

    stage(2, "one .glb from its layers")
    plys = sorted(out.glob("mesh_layer*.ply"))
    if not plys:
        fail(f"HunyuanWorld finished but wrote no mesh_layer*.ply in {out}")
    name = free_name(models_dir, re.sub(r"[^A-Za-z0-9_-]+", "_", str(params.get("name") or "world"))[:60] + "_world", ".glb")
    dest = models_dir / name
    r = subprocess.run([str(py), "-c", TO_GLB, str(dest), str(out)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 or not dest.is_file():
        fail("could not turn the layers into a .glb: " + ((r.stderr or r.stdout or "").strip().splitlines() or ["?"])[-1])
    try:
        if (output_dir / name).exists():
            (output_dir / name).unlink()
        os.link(dest, output_dir / name)
    except OSError:
        shutil.copyfile(dest, output_dir / name)
    say(f"[worker] {len(plys)} layer(s), {dest.stat().st_size // 1024} KB -> models3d/{name}")
    say("@@MODEL3D " + name)
    say("@@OUT " + name)
    say("[worker] hyworld complete")


if __name__ == "__main__":
    main()
