#!/usr/bin/env python3
"""bitGen Studio — LongCat-Video-Avatar 1.6 worker (2.918.0): mode "longcat".

Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"

One job = one talking / singing video as long as the speech (scripts/longcat_graph.py):
  1. ComfyUI is asked for the LongCat Avatar nodes (the ComfyUI-LongCat-Avatar pack), the files are picked from what it lists
     (the int8 DiT first), the speech and the start picture go up; the picture's shape picks the release's size bucket;
  2. the graph is queued and waited on (8 distilled steps a 93-frame segment, each continuing from the last 13);
  3. the node's mp4 already carries the speech -> the project's output as it is (H.264 when it is not) -> @@OUT.

params: mode "longcat", prompt, image (abs path | ""), audio {path, start} (required), width, height (Basic Settings - the
bucket is picked from them and the picture), seed, max_seconds (0 = the whole speech), mix_steps, mix_alpha, ref_img_index,
model / dmd / opsd / whisper / te / vae (optional names), output_name (optional stem), video_style.
"""
import json
import os
import random
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import seedvr2_worker as W                                 # say / fail / listed / first_video / probe
import image_name as _iname
import comfy_progress as _CP
import longcat_graph as LG

say, fail = W.say, W.fail
STAGES = 3
PACK = "ComfyUI-LongCat-Avatar (Settings ▸ Add-ons ▸ LongCat Avatar 1.6 installs it - then restart ComfyUI)"


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def picture_size(p):
    """(w, h) of a picture through ffprobe, or None"""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "json", str(p)], capture_output=True, text=True, timeout=30)
        s = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
        w, h = int(s.get("width") or 0), int(s.get("height") or 0)
        return (w, h) if w and h else None
    except Exception:                                      # noqa: BLE001
        return None


def sound_seconds(p):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(p)],
                           capture_output=True, text=True, timeout=30)
        return float((json.loads(r.stdout or "{}").get("format") or {}).get("duration") or 0)
    except Exception:                                      # noqa: BLE001
        return 0.0


def main():
    if len(sys.argv) != 2:
        fail("usage: longcat_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "longcat":
        fail(f"longcat_worker.py only runs mode=longcat (got {params.get('mode')!r})")
    style = params.get("video_style") if isinstance(params.get("video_style"), dict) else {}
    say("[worker] longcat_worker.py" + (f" style={style.get('name')}" if style else ""))
    _comfy = W._comfy
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {W._comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 1. the nodes, the files, the speech, the picture
    stage(1, "checking ComfyUI and picking the files")
    miss = _comfy.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(LG.REQUIRED)})
    if miss:
        fail("ComfyUI does not have these node types, which LongCat Avatar needs: " + ", ".join(miss) + " - " + PACK
             + ("; AudioEncoderLoader comes with ComfyUI itself - update ComfyUI" if "AudioEncoderLoader" in miss else ""))
    pk = LG.pick(W.listed(base, "LongCatAvatarModelLoader", "unet_name"), W.listed(base, "LongCatAvatarVideo", "dmd_lora"),
                 W.listed(base, "AudioEncoderLoader", "audio_encoder_name"), W.listed(base, "CLIPLoader", "clip_name"),
                 W.listed(base, "VAELoader", "vae_name"),
                 {k: params.get(k) or "" for k in ("model", "dmd", "opsd", "whisper", "te", "vae")})
    if pk.get("error"):
        fail(pk["error"])
    for n in pk.get("notes") or []:
        say(f"[worker] {n}")
    say(f"[worker] model {pk['model']} · LoRAs {pk['dmd']} + {pk['opsd']} · Whisper {pk['whisper']} · text encoder {pk['te']} · VAE {pk['vae']}")
    au = params.get("audio") if isinstance(params.get("audio"), dict) else None
    if not au or not au.get("path") or not Path(str(au["path"])).is_file():
        fail("LongCat Avatar needs the speech: put a sound in the References docker (clean speech, or a song's vocals - the Stems docker's ✂ Separate)")
    snd = Path(str(au["path"]))
    secs = sound_seconds(snd)
    start = max(0.0, float(au.get("start") or 0))
    max_s = max(0.0, float(params.get("max_seconds") or 0))
    if start > 0 or (max_s and secs and max_s < secs - start):
        # a part of the sound: cut it here (LoadAudio takes the whole file)
        cut = work / "speech_cut.wav"
        args = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(snd)]
        if max_s:
            args += ["-t", f"{max_s:.3f}"]
        r = subprocess.run(args + ["-vn", str(cut)], capture_output=True, text=True)
        if r.returncode != 0:
            fail("ffmpeg could not cut the speech: " + (r.stderr or "").strip()[-300:])
        say(f"[worker] the speech from {start:.1f} s" + (f", {max_s:.1f} s of it" if max_s else ""))
        snd = cut
        secs = sound_seconds(snd)
    try:
        up_a = _comfy.upload_image(base, str(snd))
    except Exception as e:                                 # noqa: BLE001
        fail(f"could not upload the speech to ComfyUI: {e}")
    segs = LG.segments_for(secs) if secs else 0
    say(f"[worker] uploaded the speech {snd.name} -> {up_a}" + (f" ({secs:.1f} s = {segs} segment(s) of {LG.SEG} frames at {LG.FPS} fps)" if secs else ""))
    up_i, pic = "", None
    img = str(params.get("image") or "")
    if img:
        p = Path(img)
        if not p.is_file():
            fail(f"the start picture is missing: {p}")
        pic = picture_size(p)
        try:
            up_i = _comfy.upload_image(base, str(p))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the start picture to ComfyUI: {e}")
        say(f"[worker] uploaded the start picture {p.name} -> {up_i}")
    w, h, res = LG.size_for(params.get("width"), params.get("height"), pic)
    say(f"[worker] {w}x{h} ({res} bucket nearest the {'picture' if pic else 'Basic Settings size'}'s shape)")
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
    try:
        graph, notes = LG.build({"model": pk["model"], "dmd": pk["dmd"], "opsd": pk["opsd"], "whisper": pk["whisper"], "te": pk["te"],
                                 "vae": pk["vae"], "prompt": params.get("prompt") or "", "audio": up_a, "image": up_i,
                                 "width": w, "height": h, "seed": seed, "max_segments": 0,
                                 "mix_steps": params.get("mix_steps", LG.DEFAULTS["mix_steps"]),
                                 "mix_alpha": params.get("mix_alpha", LG.DEFAULTS["mix_alpha"]),
                                 "ref_img_index": params.get("ref_img_index", LG.DEFAULTS["ref_img_index"]),
                                 "sampler": (os.environ.get("BITGEN_SAMPLER") or "").strip() or LG.DEFAULTS["sampler"],
                                 "prefix": "bitgen_longcat/" + work.name})
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    say("[meta] " + json.dumps({"seed": seed, "steps": 8, "cfg": 1, "sampler": graph["8"]["inputs"]["sampler_name"],
                                "models": [pk["model"], pk["dmd"], pk["opsd"], pk["whisper"], pk["te"], pk["vae"]]}))
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    (work / "longcat_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

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
    raw = work / ("longcat_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 3. the take (the speech is in it already)
    stage(3, "writing the video")
    stem = str(params.get("output_name") or "") or _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_longcat.mp4")
    if raw.suffix.lower() == ".mp4":
        shutil.copyfile(raw, output_dir / name)
    else:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-movflags", "+faststart", str(output_dir / name)], capture_output=True, text=True)
        if r.returncode != 0:
            fail("ffmpeg could not write the take: " + (r.stderr or "").strip()[-300:])
    got = W.probe(output_dir / name) or {}
    say(f"[worker] {got.get('width', '?')}x{got.get('height', '?')}, {float(got.get('duration') or 0):.1f} s"
        + (", with the speech" if got.get("audio") else " (no sound track came back)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] longcat complete")


if __name__ == "__main__":
    main()
