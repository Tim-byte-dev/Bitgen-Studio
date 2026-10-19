#!/usr/bin/env python3
"""bitGen Studio — SeedVR2 VIDEO upscaling worker (2.400.0): mode "seedvr2".

Tim (verbatim): "add seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors - ...
utility_seedvr2_3b_int8_upscale_video.json"

One job = one video upscaled:
  1. the source (a take, its lossless master, any video in the project) - the window asked for is cut, a file
     ComfyUI's LoadVideo may not read (the FFV1 master) is made a near-lossless H.264 first;
  2. the model files come from what ComfyUI lists (scripts/seedvr2_graph.pick_model: the file asked for, else
     seedvr2_7b_sharp_fp16, any 7B, the 3B), the VAE likewise;
  3. the core-node graph (scripts/seedvr2_graph.build) is queued and waited on;
  4. the source's sound is laid back under the result -> @@OUT.

params: mode "seedvr2", source (abs path), width / height (the size wanted), start / duration (optional window),
model (optional file name), color (lab|wavelet|adain|none), denoise, chunk (auto|off|frames), overlap, seed,
output_name (optional file name), audio_source (optional - the take whose sound goes back under a master), label.
The four stages print "[worker] step i/4" so the queue's running card has a bar to fill.
"""
import json
import random
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))
try:
    import comfy_client as _comfy
except Exception as _e:                                    # noqa: BLE001
    _comfy, _comfy_err = None, _e
import image_name as _iname
import comfy_progress as _CP          # 2.401.3: live step lines from ComfyUI's websocket
import seedvr2_graph as SV
import swap_graph as SG

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

DIRECT = (".mp4", ".webm", ".mov", ".mkv", ".m4v")         # what LoadVideo reads as it is
STAGES = 4


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


def probe(path):
    """{width, height, duration, fps, audio} of a video, or {}."""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                            "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", str(path)],
                           capture_output=True, text=True, timeout=60)
        d = json.loads(r.stdout or "{}")
    except Exception:                                      # noqa: BLE001
        return {}
    out = {"audio": False}
    for s in d.get("streams") or []:
        if s.get("codec_type") == "video" and "width" not in out:
            out["width"], out["height"] = int(s.get("width") or 0), int(s.get("height") or 0)
            try:
                a, b = str(s.get("r_frame_rate") or "24/1").split("/")
                out["fps"] = float(a) / float(b or 1)
            except (ValueError, ZeroDivisionError):
                out["fps"] = 24.0
        elif s.get("codec_type") == "audio":
            out["audio"] = True
    try:
        out["duration"] = float((d.get("format") or {}).get("duration") or 0)
    except (TypeError, ValueError):
        out["duration"] = 0.0
    return out if out.get("width") else {}


def listed(base, class_type, key):
    """ComfyUI's dropdown for one loader input ([] when it does not say)."""
    info = _comfy.object_info(base, class_type)
    spec = (((info or {}).get(class_type) or {}).get("input") or {})
    for group in ("required", "optional"):
        got = (spec.get(group) or {}).get(key)
        if got is not None:
            return SG.combo_list(got)
    return []


def has_input(base, class_type, key):
    spec = (((_comfy.object_info(base, class_type) or {}).get(class_type) or {}).get("input") or {})
    return any(key in (spec.get(g) or {}) for g in ("required", "optional"))


def first_video(outputs):
    vids = _comfy.output_videos(outputs) if hasattr(_comfy, "output_videos") else []
    if vids:
        return vids[0]
    for node_out in (outputs or {}).values():
        for lst in (node_out or {}).values():
            for it in lst if isinstance(lst, list) else []:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(_comfy.VIDEO_EXT):
                    return it
    return None


def main():
    if len(sys.argv) != 2:
        fail("usage: seedvr2_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "seedvr2":
        fail(f"seedvr2_worker.py only runs mode=seedvr2 (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the video to upscale is gone: {src}")
    say(f"[worker] seedvr2_worker.py source={src.name}")

    # 1. the source: its size, the window, a file LoadVideo reads
    stage(1, "reading the video")
    info = probe(src)
    if not info:
        fail(f"could not read {src.name} (is ffprobe installed, is it a video?)")
    start = max(0.0, float(params.get("start") or 0))
    dur = float(params.get("duration") or 0) or None
    if start >= (info.get("duration") or 0) > 0:
        fail(f"the window starts at {start:.2f}s - {src.name} is only {info['duration']:.2f}s long")
    say(f"[worker] {src.name}: {info['width']}x{info['height']} · {info.get('fps', 24):.3g} fps · "
        f"{info.get('duration', 0):.2f}s" + (" · with sound" if info.get("audio") else " · silent")
        + (f" · window {start:.2f}s +{dur:.2f}s" if (start or dur) else ""))
    feed = src
    if start or dur or src.suffix.lower() not in DIRECT:
        feed = work / "seedvr2_src.mp4"
        cut = ["ffmpeg", "-y", "-loglevel", "error"]
        if start:
            cut += ["-ss", f"{start:.3f}"]
        cut += ["-i", str(src)]
        if dur:
            cut += ["-t", f"{dur:.3f}"]
        cut += ["-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "8", "-pix_fmt", "yuv444p",
                str(feed)]
        r = subprocess.run(cut, capture_output=True, text=True)
        if r.returncode != 0 or not feed.is_file():
            fail("ffmpeg could not prepare the video: " + (r.stderr or "").strip()[-300:])
        say(f"[worker] prepared {feed.name} (" + ("the window, " if (start or dur) else "")
            + ("near-lossless H.264 from the " + src.suffix.lstrip(".").upper() if src.suffix.lower() not in DIRECT
               else "re-encoded near-lossless") + ")")
    sw, sh = info["width"], info["height"]
    ow, oh = int(params.get("width") or 0), int(params.get("height") or 0)
    if not (ow > 0 and oh > 0):
        ow, oh = sw * 2, sh * 2
    mult = SV.multiplier(sw, sh, ow, oh)
    if mult < 1:
        fail(f"{sw}x{sh} is already larger than {ow}x{oh} - pick a larger size")
    exp_w, exp_h = int(round(sw * mult)), int(round(sh * mult))

    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 2. files, from what ComfyUI lists
    stage(2, "picking the model and uploading")
    model, mnote = SV.pick_model(listed(base, "UNETLoader", "unet_name"), params.get("model") or "")
    if not model:
        fail(mnote)
    say(f"[worker] {mnote}")
    vae = SV.pick_vae(listed(base, "VAELoader", "vae_name"))
    if not vae:
        fail(f"no SeedVR2 VAE in ComfyUI's models/vae - put {SV.DEFAULT_VAE} there (Setup -> Models -> Upscaling)")
    say(f"[worker] VAE {vae}")
    chunk = params.get("chunk", "auto")
    probe_graph = {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(SV.REQUIRED + SV.CHUNK_NODES)}
    miss = _comfy.missing_classes(base, probe_graph)
    hard = [c for c in miss if c in SV.REQUIRED]
    if hard:
        fail("ComfyUI does not have these node types, which SeedVR2 needs: " + ", ".join(hard)
             + " - update ComfyUI (SeedVR2 is a core node set since PR #14424).")
    if str(chunk).lower() not in ("off", "none", "0", "false") and any(c in SV.CHUNK_NODES for c in miss):
        say("[worker] this ComfyUI has no SeedVR2TemporalChunk / Merge - the whole clip is sampled at once")
        chunk = "off"
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
        graph, notes = SV.build({
            "video": up, "mult": mult, "model": model, "vae": vae, "seed": seed,
            "denoise": params.get("denoise"), "color": params.get("color") or "lab", "chunk": chunk,
            "overlap": params.get("overlap") or 0, "prefix": "bitgen_seedvr2/" + work.name,
            "bit_depth": has_input(base, "CreateVideo", "bit_depth"),
        })
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    say(f"[worker] {sw}x{sh} -> {exp_w}x{exp_h}")
    say("[meta] " + json.dumps({"seed": seed, "steps": 1, "cfg": 1, "sampler": "euler / simple",
                                "models": [model, vae], "upscale": f"SeedVR2 x{mult:g} -> {exp_w}x{exp_h}"}))
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    (work / "seedvr2_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 3. render
    stage(3, "upscaling in ComfyUI")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
        # progress, the queue card and the status bar move instead of saying "loading" until the end
        pid, outputs = _CP.run(_comfy, base, graph, say, "upscaling")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video (the graph ends in SaveVideo)")
    raw = work / ("seedvr2_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 4. the sound back under it
    stage(4, "laying the sound back")
    got = probe(raw) or {}
    name = str(params.get("output_name") or "").strip()
    if not name:
        name = f"{src.stem}_seedvr2_{min(exp_w, exp_h)}p.mp4"
    name = _iname.reserve(output_dir, Path(name).stem + ".mp4")
    asrc = Path(str(params.get("audio_source") or "")) if params.get("audio_source") else src
    if not asrc.is_file():
        asrc = src
    r = subprocess.run(SV.mux_args(raw, asrc, output_dir / name, start, dur, got.get("duration") or None),
                       capture_output=True, text=True)
    if r.returncode != 0:
        fail("ffmpeg could not finish the upscale: " + (r.stderr or "").strip()[-300:])
    say(f"[worker] {got.get('width', '?')}x{got.get('height', '?')} written"
        + (f", the sound of {asrc.name} laid under it" if (info.get("audio") or asrc != src) else " (the source is silent)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] seedvr2 complete")


if __name__ == "__main__":
    main()
