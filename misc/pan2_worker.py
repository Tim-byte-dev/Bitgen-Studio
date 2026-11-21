#!/usr/bin/env python3
"""bitGen Studio — PAN 2 VIDEO worker (2.890.0): mode "pan2".

Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2"

One job = one clip from PAN 2 (MBZUAI's world model) in ComfyUI's own nodes (scripts/pan2_graph.py):
  1. ComfyUI is asked whether it knows PAN 2 (CLIPLoader type "pan2" - the v0.46.0 release), the files are picked from
     what it lists (int8 first), the first picture (image to video) goes up;
  2. the graph - the caption lib/pan2.js wrote, PAN 2's own fixed negative - is queued and waited on;
  3. the 24 fps take becomes H.264 with the job's sound laid under it (PAN 2 makes no sound) -> @@OUT.

params: mode "pan2", pan2_mode (t2v | i2v), prompt (the JSON caption), negative, image (abs path | ""), width, height,
frames (4n+1, up to 481), seconds, seed, steps, cfg, shift, model / te / vae (optional names), loras [{name, strength}],
audio {path, start} | null, output_name (optional stem), video_style.
"""
import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import seedvr2_worker as W                                 # say / fail / listed / first_video / probe
import image_name as _iname
import comfy_progress as _CP
import pan2_graph as PG

say, fail = W.say, W.fail
STAGES = 3


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def main():
    if len(sys.argv) != 2:
        fail("usage: pan2_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "pan2":
        fail(f"pan2_worker.py only runs mode=pan2 (got {params.get('mode')!r})")
    style = params.get("video_style") if isinstance(params.get("video_style"), dict) else {}
    say(f"[worker] pan2_worker.py mode={params.get('pan2_mode')}" + (f" style={style.get('name')}" if style else ""))
    _comfy = W._comfy
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {W._comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 1. PAN 2 in this ComfyUI? the files, the picture
    stage(1, "checking ComfyUI and picking the files")
    miss = _comfy.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(PG.REQUIRED)})
    if miss:
        fail("ComfyUI does not have these node types, which PAN 2 needs: " + ", ".join(miss) + " - update ComfyUI to 0.46.0 or newer, then restart it.")
    types = W.listed(base, "CLIPLoader", "type")
    if types and "pan2" not in types:
        fail("this ComfyUI does not know PAN 2 (its CLIPLoader has no type \"pan2\") - PAN 2 runs in ComfyUI's own nodes since "
             "15 Nov 2026 (the v0.46.0 release): update ComfyUI (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI, or the portable "
             "build's update\\update_comfyui.bat), then restart it.")
    pk = PG.pick(W.listed(base, "UNETLoader", "unet_name"), W.listed(base, "CLIPLoader", "clip_name"),
                 W.listed(base, "VAELoader", "vae_name"), params.get("model") or "", params.get("te") or "", params.get("vae") or "")
    if pk.get("error"):
        fail(pk["error"])
    for n in pk.get("notes") or []:
        say(f"[worker] {n}")
    say(f"[worker] model {pk['model']} · text encoder {pk['te']} · VAE {pk['vae']}")
    up = ""
    img = str(params.get("image") or "")
    if img:
        p = Path(img)
        if not p.is_file():
            fail(f"the first picture is missing: {p}")
        try:
            up = _comfy.upload_image(base, str(p))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the first picture to ComfyUI: {e}")
        say(f"[worker] uploaded the first picture {p.name} -> {up}")
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
    try:
        graph, notes = PG.build({"model": pk["model"], "te": pk["te"], "vae": pk["vae"], "prompt": params.get("prompt") or "",
                                 "negative": params.get("negative") or "", "width": params.get("width"), "height": params.get("height"),
                                 "frames": params.get("frames"), "seed": seed, "steps": params.get("steps"), "cfg": params.get("cfg"),
                                 "shift": params.get("shift"), "image": up, "loras": params.get("loras") or [],
                                 "prefix": "bitgen_pan2/" + work.name})
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    st = PG.settings(params.get("steps"), params.get("cfg"), params.get("shift"))
    # 2.904.0: Basic Settings' sampler / scheduler (Override style - comfy_client.queue writes them in) say so in the meta
    smp = (os.environ.get("BITGEN_SAMPLER") or "").strip() or "euler"
    sch = (os.environ.get("BITGEN_SCHEDULER") or "").strip() or "simple"
    say("[meta] " + json.dumps({"seed": seed, "steps": st["steps"], "cfg": st["cfg"], "sampler": smp + " / " + sch,
                                "shift": st["shift"], "models": [pk["model"], pk["te"], pk["vae"]]}))
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    (work / "pan2_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 2. render
    stage(2, "rendering in ComfyUI")
    say("[worker] ===== chunk 1/1")
    try:
        _comfy.clear_before_gen(base, cfg, say, graph)
        pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = W.first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video (the graph ends in SaveVideo)")
    raw = work / ("pan2_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 3. H.264 + the sound
    stage(3, "writing the video")
    stem = str(params.get("output_name") or "") or _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_pan2.mp4")
    au = params.get("audio") if isinstance(params.get("audio"), dict) and (params.get("audio") or {}).get("path") else None
    if au and not Path(str(au["path"])).is_file():
        say(f"[worker] the sound {au['path']} is gone - the take stays silent")
        au = None
    r = subprocess.run(PG.finish_args(raw, output_dir / name, au and au["path"], (au or {}).get("start") or 0),
                       capture_output=True, text=True)
    if r.returncode != 0:
        fail("ffmpeg could not finish the take: " + (r.stderr or "").strip()[-300:])
    got = W.probe(output_dir / name) or {}
    say(f"[worker] {got.get('width', '?')}x{got.get('height', '?')}, {float(got.get('duration') or 0):.1f} s"
        + (f", the sound {Path(str(au['path'])).name} from {float(au.get('start') or 0):.2f}s laid under it" if au else " (PAN 2 makes no sound)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] pan2 complete")


if __name__ == "__main__":
    main()
