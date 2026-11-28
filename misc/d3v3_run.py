#!/usr/bin/env python3
"""bitGen Studio — misc/d3v3_run.py (3.7.0): 💎 FINE DETAIL, run INSIDE the Direct3D-V3 add-on's own Python (lib/d3v3Addon.js)
by misc/d3v3_worker.py.

Direct3D-V3 (DreamTech / Nanjing University, SIGGRAPH Asia 2026; MIT code) does not make a shape from nothing: it takes a
picture AND a rough mesh of the same thing, the same way round (Hunyuan3D 2.1 / TRELLIS.2's - bitGen's 🧊 Convert to 3D), and
carves the fine detail into it on signed-distance voxels (512 -> 1024 -> 1536).

  python d3v3_run.py <args.json>   {image, coarse, out, resolution, steps, cfg, seed, max_tokens, target_faces, model, src}
Before Direct3D-V3 is imported, each compiled part it needs that does not import (flash_attn, cudavoxelize, fillhole_cpp) is
replaced by bitGen's stand-in (misc/d3v3_shims) and said - the real one always wins when it is there.
Progress: "[d3v3] <stage>: step v/m" (the queue's bar); the result is moved back onto the rough model's size and place.
Pure (scripts/test-d3v3-3700.py): fit_to, stages_for.
"""
import importlib
import importlib.util
import json
import os
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

SHIMS = Path(__file__).resolve().parent / "d3v3_shims"
PARTS = (("flash_attn", "flash-attn"), ("cudavoxelize", "the voxelizer"), ("fillhole_cpp", "the hole filler"))
STAGES = (512, 1024, 1536)


def say(line):
    print(line, flush=True)


def stages_for(res):
    return [s for s in STAGES if s <= int(res)]


def fit_to(out_v, coarse_v):
    """out_v moved onto coarse_v's bounding box: the same centre, its longest side the coarse one's"""
    import numpy as np
    o, c = np.asarray(out_v, dtype=np.float64), np.asarray(coarse_v, dtype=np.float64)
    olo, ohi, clo, chi = o.min(0), o.max(0), c.min(0), c.max(0)
    oe, ce = float((ohi - olo).max()), float((chi - clo).max())
    k = ce / oe if oe > 0 else 1.0
    return (o - (olo + ohi) / 2) * k + (clo + chi) / 2


def stand_ins():
    used = []
    for mod, what in PARTS:
        try:
            importlib.import_module(mod)
            say(f"[d3v3] {what}: the real one ({mod})")
        except Exception as e:                             # noqa: BLE001 - a wheel for another torch fails in many ways
            spec = importlib.util.spec_from_file_location(mod, SHIMS / f"{mod}.py")
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            sys.modules[mod] = m
            used.append(what)
            say(f"[d3v3] {what}: bitGen's stand-in ({type(e).__name__}: {str(e)[:120]})")
    return used


def main():
    if len(sys.argv) != 2:
        say("usage: d3v3_run.py <args.json>")
        sys.exit(2)
    a = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if a.get("src"):
        sys.path.insert(0, str(a["src"]))
    used = stand_ins()
    import torch
    import trimesh
    if not torch.cuda.is_available():
        say("[d3v3] ERROR: no NVIDIA card is usable from this Python (torch.cuda.is_available() is False) - Direct3D-V3 needs one")
        sys.exit(1)
    from direct3d import Direct3DV3Pipeline
    res = int(a.get("resolution") or 1024)
    say(f"[d3v3] loading Direct3D-V3 ({a.get('model') or 'wushuang98/Direct3D-V3'}) - the {' -> '.join(map(str, stages_for(res)))} passes")
    pipe = Direct3DV3Pipeline.from_pretrained(a.get("model") or "wushuang98/Direct3D-V3", local_files_only=bool(a.get("offline"))).to("cuda")
    steps, cfg = int(a.get("steps") or 15), float(a.get("cfg") if a.get("cfg") is not None else 4.0)

    def prog(stage, done, total):
        say(f"[d3v3] {stage}: step {done}/{total}")

    coarse = trimesh.load(str(a["coarse"]), force="mesh", process=False)
    say(f"[d3v3] the rough model: {len(coarse.vertices)} corners, {len(coarse.faces)} faces")
    mesh = pipe(image=str(a["image"]), coarse_mesh=coarse, resolution=res,
                num_inference_steps={s: steps for s in stages_for(res)}, guidance_scale={s: cfg for s in stages_for(res)},
                seed=int(a.get("seed") if a.get("seed") is not None else 2026), max_tokens=int(a.get("max_tokens") or 150000),
                target_faces=int(a["target_faces"]) if a.get("target_faces") else None, on_sampling_step=prog)
    mesh.vertices = fit_to(mesh.vertices, coarse.vertices)
    out = Path(a["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(str(out))
    say(f"[d3v3] done: {len(mesh.faces)} faces" + (f" (bitGen's stand-ins for {', '.join(used)})" if used else "") + f" -> {out.name}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:                                 # noqa: BLE001
        msg = str(e)
        hint = (" - try Low memory (a smaller detail budget) or 1024 instead of 1536" if "out of memory" in msg.lower()
                else " - the DINOv3 picture encoder is gated: accept its licence on Hugging Face and put your token in Settings ▸ Paths ▸ Hugging Face, then Install again"
                if ("dinov3" in msg.lower() and ("401" in msg or "403" in msg or "gated" in msg.lower() or "restricted" in msg.lower())) else "")
        say(f"[d3v3] ERROR: {type(e).__name__}: {msg[:400]}{hint}")
        sys.exit(1)
