#!/usr/bin/env python3
"""bitGen Studio — PICTURE upscaling worker (2.733.0): mode "imgupscale".

Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image"

One job = one picture (a gallery image, an Image asset or a reference-dock picture) made bigger:
  1. the picture read (its size);
  2. SeedVR2 (Tim's image workflow) or an upscale model in ComfyUI - the files from what ComfyUI lists - or lanczos;
  3. the result checked (the source's own size back = nothing was upscaled: the job fails in words, the 2.727.0 rule),
     taken to the exact size, saved as a PNG in the project's output folder (the gallery's Images) -> @@OUT.
params: mode "imgupscale", source (abs path), width / height (wanted), method (seedvr2 | model | lanczos), model (a file
name, optional), color, denoise, seed, output_name, label.
"""
import json
import random
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import seedvr2_worker as W                                 # probe / listed / say / fail / _comfy
import image_name as _iname
import comfy_progress as _CP
import imgupscale_graph as IG
import seedvr2_graph as SV

STAGES = 3


def say(line):
    W.say(line)


def fail(msg):
    W.fail(msg)


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def main():
    if len(sys.argv) != 2:
        fail("usage: imgupscale_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job.get("config") or {}
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "imgupscale":
        fail(f"imgupscale_worker.py only runs mode=imgupscale (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the picture to upscale is gone: {src}")
    method = str(params.get("method") or "seedvr2")
    if method not in IG.METHODS:
        fail(f"unknown way to upscale: {method}")
    say(f"[worker] imgupscale_worker.py source={src.name} method={method}")

    stage(1, "reading the picture")
    info = W.probe(src) or {}
    sw, sh = int(info.get("width") or 0), int(info.get("height") or 0)
    if not (sw > 0 and sh > 0):
        fail(f"could not read the size of {src.name} (is it a picture? is ffprobe installed?)")
    ow, oh = int(params.get("width") or 0), int(params.get("height") or 0)
    if not (ow > 0 and oh > 0):
        ow, oh = sw * 2, sh * 2
    say(f"[worker] {sw}x{sh} -> {ow}x{oh}")
    stem = Path(str(params.get("output_name") or "")).stem or f"{src.stem}_upscaled_{ow}x{oh}"
    name = _iname.reserve(output_dir, stem + ".png")
    raw = work / "imgupscale_raw.png"

    if method == "lanczos":
        stage(2, "lanczos (no ComfyUI)")
        r = subprocess.run(IG.lanczos_cmd(src, raw, ow, oh), capture_output=True, text=True)
        if r.returncode != 0 or not raw.is_file():
            fail("ffmpeg could not scale the picture: " + (r.stderr or "").strip()[-300:])
    else:
        _comfy = W._comfy
        if _comfy is None:
            fail(f"the ComfyUI modules could not be imported: {W._comfy_err}")
        base = _comfy.base_url(cfg)
        say(f"[worker] engine=comfy url={base}")
        try:
            _comfy.preflight(base)
        except _comfy.ComfyError as e:
            fail(str(e) + " - or pick Lanczos, which needs no ComfyUI")
        stage(2, "upscaling in ComfyUI" + (" (SeedVR2)" if method == "seedvr2" else " (upscale model)"))
        miss = _comfy.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(IG.REQUIRED[method])})
        if miss:
            fail("ComfyUI does not have these node types: " + ", ".join(miss)
                 + (" - SeedVR2 is in ComfyUI's core since PR #14424: update ComfyUI" if method == "seedvr2" else ""))
        try:
            up = _comfy.upload_image(base, str(src))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload {src.name} to ComfyUI: {e}")
        prefix = "bitgen_imgupscale/" + work.name
        if method == "seedvr2":
            unet, note = SV.pick_model(W.listed(base, "UNETLoader", "unet_name"), params.get("model") or "")
            if not unet:
                fail(note)
            vae = SV.pick_vae(W.listed(base, "VAELoader", "vae_name"))
            if not vae:
                fail(f"no SeedVR2 VAE in ComfyUI's models/vae - put {SV.DEFAULT_VAE} there")
            seed = int(params.get("seed", -1))
            if seed < 0:
                seed = random.randrange(0, 2 ** 31)
            say(f"[worker] {note}, VAE {vae}, seed {seed}")
            graph = IG.seedvr2(up, sw, sh, ow, oh, prefix, unet, vae, seed=seed, color=params.get("color") or "lab",
                               denoise=params.get("denoise"))
            say("[meta] " + json.dumps({"seed": seed, "steps": 1, "models": [unet, vae], "upscale": f"SeedVR2 -> {ow}x{oh}"}))
        else:
            mf, note = IG.pick_upscale_model(W.listed(base, "UpscaleModelLoader", "model_name"), params.get("model") or "")
            if not mf:
                fail(note)
            say(f"[worker] {note}")
            graph = IG.model(up, mf, ow, oh, prefix)
            say("[meta] " + json.dumps({"models": [mf], "upscale": f"{mf} -> {ow}x{oh}"}))
        for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
            say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
        (work / "imgupscale_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
        try:
            _comfy.clear_before_gen(base, cfg, say, graph)
            _pid, outputs = _CP.run(_comfy, base, graph, say, "upscaling")
        except _comfy.ComfyError as e:
            fail(str(e))
        imgs = _comfy.output_images(outputs)
        if not imgs:
            fail("ComfyUI finished but saved no picture (the graph ends in SaveImage)")
        _comfy.download(base, imgs[0], raw)
        if not raw.is_file() or raw.stat().st_size == 0:
            fail("downloaded an empty picture")

    stage(3, "checking and saving")
    got = W.probe(raw) or {}
    gw, gh = int(got.get("width") or 0), int(got.get("height") or 0)
    verdict, vmsg = SV.size_verdict(sw, sh, ow, oh, gw, gh)
    if verdict == "source":
        fail(vmsg.replace("seedvr2_queued.json", "imgupscale_queued.json"))
    dest = output_dir / name
    if gw and gh and (gw, gh) != (ow, oh):
        say(f"[worker] {gw}x{gh} came back - taken to exactly {ow}x{oh} (lanczos)")
        r = subprocess.run(IG.exact_cmd(raw, dest, ow, oh), capture_output=True, text=True)
        if r.returncode != 0:
            fail("ffmpeg could not finish the picture: " + (r.stderr or "").strip()[-300:])
    else:
        shutil.copyfile(raw, dest)
    say(f"[worker] {ow}x{oh} written")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] imgupscale complete")


if __name__ == "__main__":
    main()
