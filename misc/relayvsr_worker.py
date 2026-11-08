#!/usr/bin/env python3
"""bitGen Studio — RelayVSR VIDEO upscaling worker (2.728.0): mode "relayvsr".

Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR"

One job = one video upscaled with ComfyUI's core RelayVSR nodes (scripts/relayvsr_graph.py):
  1. the source - the window cut, a file LoadVideo reads (seedvr2_worker.prepare_source, the same rules);
  2. the x2 or x4 pair from what ComfyUI lists (relayvsr_graph.pick) - the job says which (lib/relayvsr.js picks the
     smallest that reaches the size asked for);
  3. the graph queued and waited on; the size that came back CHECKED (the source's own size = nothing upscaled: the
     job fails in words - seedvr2_graph.size_verdict, the 2.727.0 rule);
  4. ffmpeg takes the model's fixed x2 / x4 result to the size asked for (relayvsr_graph.fit_vf: the 1920x1080 frame
     covered and trimmed, or scaled down to 1080p / 1440p ...) and lays the source's sound back -> @@OUT.

params: mode "relayvsr", source (abs path), width / height (the size wanted), fit ("crop" = the exact frame), factor
(2 | 4), unet / vae (optional file names), detail (0..1), seed, start / duration, output_name, audio_source, label.
"""
import json
import random
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import seedvr2_worker as W                                 # probe / prepare_source / listed / first_video / say / fail
import image_name as _iname
import comfy_progress as _CP
import relayvsr_graph as RV
import seedvr2_graph as SV

say, fail, stage = W.say, W.fail, W.stage


def main():
    if len(sys.argv) != 2:
        fail("usage: relayvsr_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "relayvsr":
        fail(f"relayvsr_worker.py only runs mode=relayvsr (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the video to upscale is gone: {src}")
    say(f"[worker] relayvsr_worker.py source={src.name}")

    # 1. the source
    stage(1, "reading the video")
    info, start, dur, feed = W.prepare_source(src, params, work, "relayvsr_src.mp4")
    sw, sh = info["width"], info["height"]
    factor = 4 if int(params.get("factor") or 2) == 4 else 2
    ow, oh = int(params.get("width") or 0), int(params.get("height") or 0)
    if not (ow > 0 and oh > 0):
        ow, oh = sw * factor, sh * factor
    exp_w, exp_h = sw * factor, sh * factor

    _comfy = W._comfy
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {W._comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 2. the nodes + the pair, from what ComfyUI lists
    stage(2, "picking the model and uploading")
    probe_graph = {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(RV.REQUIRED)}
    miss = _comfy.missing_classes(base, probe_graph)
    if miss:
        fail("ComfyUI does not have these node types, which RelayVSR needs: " + ", ".join(miss)
             + " - RelayVSR is in ComfyUI's core since 5 Nov 2026 (PR #17511), newer than the v0.44.0 release: update "
               "ComfyUI to the newest (Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI on the \"latest\" channel - it also installs "
               "comfy-kitchen 0.2.41 from requirements.txt), then restart it.")
    unet, vae, note = RV.pick(W.listed(base, "UNETLoader", "unet_name"), W.listed(base, "VAELoader", "vae_name"),
                              factor, params.get("unet") or "", params.get("vae") or "")
    if not unet:
        fail(note)
    say(f"[worker] {note}")
    try:
        up = _comfy.upload_image(base, str(feed))
    except Exception as e:                                 # noqa: BLE001
        fail(f"could not upload {feed.name} to ComfyUI: {e}")
    say(f"[worker] uploaded {feed.name} -> {up}")
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
    try:
        graph, notes = RV.build({"video": up, "unet": unet, "vae": vae, "seed": seed, "detail": params.get("detail"),
                                 "prefix": "bitgen_relayvsr/" + work.name,
                                 "bit_depth": W.has_input(base, "CreateVideo", "bit_depth")})
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    frames = int(round((info.get("duration") if not dur else dur) * (info.get("fps") or 24))) if (info.get("duration") or dur) else 0
    if frames:
        say(f"[worker] about {frames} frames - {RV.keyframes(frames)} go through the model, the decoder restores the rest")
    say(f"[worker] {sw}x{sh} -> {exp_w}x{exp_h} (RelayVSR x{factor})" + (f", then {ow}x{oh}" if (ow, oh) != (exp_w, exp_h) else ""))
    say("[meta] " + json.dumps({"seed": seed, "steps": 1, "cfg": 1, "sampler": "euler / simple",
                                "models": [unet, vae], "upscale": f"RelayVSR x{factor} -> {ow}x{oh}"}))
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    (work / "relayvsr_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 3. render
    stage(3, "upscaling in ComfyUI")
    try:
        _comfy.clear_before_gen(base, cfg, say, graph)
        pid, outputs = _CP.run(_comfy, base, graph, say, "upscaling")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = W.first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video (the graph ends in SaveVideo)")
    raw = work / ("relayvsr_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 4. the size asked for + the sound back
    stage(4, "fitting the size and laying the sound back")
    got = W.probe(raw) or {}
    verdict, vmsg = SV.size_verdict(sw, sh, exp_w, exp_h, got.get("width"), got.get("height"))
    if verdict == "source":
        fail(vmsg.replace("seedvr2_queued.json", "relayvsr_queued.json"))
    if verdict == "off":
        say(f"[worker] WARNING: {vmsg}")
    vf, what = RV.fit_vf(got.get("width"), got.get("height"), ow, oh, params.get("fit") or "")
    if what:
        say(f"[worker] {what}")
    fw, fh = (ow, oh) if vf else (got.get("width") or exp_w, got.get("height") or exp_h)
    name = str(params.get("output_name") or "").strip() or f"{src.stem}_relayvsr_{min(fw, fh)}p.mp4"
    name = _iname.reserve(output_dir, Path(name).stem + ".mp4")
    asrc = Path(str(params.get("audio_source") or "")) if params.get("audio_source") else src
    if not asrc.is_file():
        asrc = src
    r = subprocess.run(SV.mux_args(raw, asrc, output_dir / name, start, dur, got.get("duration") or None, None, vf),
                       capture_output=True, text=True)
    if r.returncode != 0:
        fail("ffmpeg could not finish the upscale: " + (r.stderr or "").strip()[-300:])
    say(f"[worker] {fw}x{fh} written"
        + (f", the sound of {asrc.name} laid under it" if (info.get("audio") or asrc != src) else " (the source is silent)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] relayvsr complete")


if __name__ == "__main__":
    main()
