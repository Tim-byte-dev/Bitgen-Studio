#!/usr/bin/env python3
"""bitGen Studio — the character swap's Viggle (native) engine (2.351.0; 2.352.0: on the shared native engine).

Tim: "can we use wan2gp technique to render viggle, it works very well and
faster than comfy, just the technique not the libraries" -> "can we build our
own wan2gp engine?" -> "can we make the engine replace comfy engine so we can
package independent of comfy?"

No ComfyUI. This worker (the app's Python) does what every swap engine does -
cut the segment at the render size, render, check, trim back, put the clip's
own sound back - and hands the render to the resident native engine server
(scripts/native/server.py in venvs/native; scripts/native_client.py talks to
it). The server keeps Viggle's transformer loaded between segments.

    job.json params: mode=viggle_native, video, image (the ✎ first frame),
    start, frames (the segment's), render_frames (17n+5, >= 124), width,
    height, seed, steps, shift; config.native: python, base, sources
    (viggle, viggle_lora, viggle_assets, vae, audio_vae), port ...
"""
import json
import random
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent              # the app folder (2.591.0: this file is in misc/)
sys.path.insert(0, str(HERE / "scripts"))
import black_check as BC            # noqa: E402
import native_client as NC          # noqa: E402
import image_name as _iname         # noqa: E402
import ltx_graph as LG              # noqa: E402
import ripple_graph as RG           # noqa: E402
import viggle_graph as VG           # noqa: E402

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

_BASE = [None]                      # the native server, for a cancel
NATIVE_MAX = 345                    # diffusers' H3: at most 15.0 s (the ComfyUI route takes 362)


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def _stop(*_):
    if _BASE[0]:
        NC.cancel(_BASE[0])                               # the server stops at the next block; its models stay loaded
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, _stop)
    except Exception:                                      # noqa: BLE001
        pass


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        d = {}
    v = [x for x in d.get("streams") or [] if x.get("codec_type") == "video"]
    a = any(x.get("codec_type") == "audio" for x in d.get("streams") or [])
    return (float((d.get("format") or {}).get("duration") or 0), int((v[0] if v else {}).get("width") or 0),
            int((v[0] if v else {}).get("height") or 0), a)


def count_frames(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_packets", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try:
        return int((r.stdout or "").strip().split(",")[0])
    except ValueError:
        return 0


def run_ff(args, what):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"ffmpeg failed {what}: {(r.stderr or '').strip()[-300:]}")


def main():
    if len(sys.argv) != 2:
        fail("usage: viggle_native_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "viggle_native":
        fail(f"viggle_native_worker.py only runs mode=viggle_native (got {params.get('mode')!r})")
    say("[worker] viggle_native_worker.py mode=viggle_native (Viggle-Animate, our own engine - no ComfyUI)")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            fail(f"a Viggle swap needs {tool} on PATH (winget install Gyan.FFmpeg)")
    ncfg = dict(job["config"].get("native") or {})
    ncfg.setdefault("app_dir", job.get("app_dir") or str(HERE))
    nsrc = ncfg.get("sources") or {}
    miss = [k for k in ("viggle", "viggle_lora", "viggle_assets", "vae", "audio_vae") if not nsrc.get(k)]
    if miss or not ncfg.get("base"):
        fail("Viggle (native) is not installed yet - missing " + ", ".join(miss or ["the configs"])
             + ": the swap dialog's ⚙ -> Viggle native -> ⤓ Install (or 🔍 Use my ComfyUI files)")
    src = Path(str(params.get("video") or ""))
    img = Path(str(params.get("image") or ""))
    for label, p in (("video to swap", src), ("edited first frame", img)):
        if not p.is_file():
            fail(f"the {label} is missing: {p}")

    # 1. the size + the cut (17n+5 frames, the last one held if the video ends first)
    _d, sw, sh, _a = probe(src)
    width, height = int(params.get("width") or 0), int(params.get("height") or 0)
    if not (width and height):
        if not (sw and sh):
            fail(f"could not read the size of {src.name} (is ffprobe installed?)")
        width, height = VG.size(sw, sh, VG.SHORT)
    if width % 32 or height % 32:
        fail(f"the render size {width}x{height} must be multiples of 32 (⚙ size)")
    frames = int(params.get("frames") or 124)
    render_n = VG.align_frames(int(params.get("render_frames") or frames))
    if render_n > NATIVE_MAX:
        fail(f"a Viggle segment can be at most {NATIVE_MAX} frames ({NATIVE_MAX / 24:.2f} s) - this one is {frames}; split it")
    clip = work / "viggle_clip.mp4"
    run_ff(LG.ripple_cut_args(src, clip, params.get("start") or 0, render_n, width, height), "cutting the segment")
    say(f"[worker] viggle native: the segment {float(params.get('start') or 0):.2f}s + {frames} frames of {src.name}, cut at {width}x{height}"
        + (f" - rendered as {render_n} frames (H3 makes 17n+5, at least 124), trimmed back after" if render_n != frames else ""))

    # 2. the render, in the venv
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed random -> {seed}")
    raw = work / "viggle_native_raw.mp4"
    frames_file = work / "viggle_native.rgb"
    lora = nsrc["viggle_lora"].get("comfy") or nsrc["viggle_lora"].get("official")
    body = {"workflow": "ref2va", "videos": [str(clip)], "images": [str(img)], "num_frames": render_n,
            "width": width, "height": height, "steps": int(params.get("steps") or 4), "shift": float(params.get("shift") or 3.0),
            "seed": seed, "base": ncfg["base"], "canvas_short_edge": min(width, height),
            "sources": {"transformer_ref": nsrc["viggle"], "vae": nsrc["vae"], "audio_vae": nsrc["audio_vae"]},
            "loras": [{"path": lora, "weight": 1.0}], "embed": nsrc["viggle_assets"].get("official") or nsrc["viggle_assets"].get("comfy"),
            "out_frames": str(frames_file), "out_audio": None}
    say("[worker] ===== chunk 1/1")
    t0 = time.time()
    try:
        base = NC.ensure(ncfg, say)
        _BASE[0] = base
        if ncfg.get("free_comfy", True):
            NC.free_comfy(job["config"], say)          # ComfyUI's cached models out of RAM + VRAM first
        fin = NC.run(base, "viggle", body, say)
    except NC.NativeError as e:
        fail(str(e))
    meta = fin["meta"]
    run_ff(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{meta['width']}x{meta['height']}",
            "-r", "24", "-i", str(frames_file), "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(raw)],
           "encoding the rendered frames")
    frames_file.unlink(missing_ok=True)
    say(f"[worker] viggle native: rendered in {time.time() - t0:.0f}s")
    if BC.all_black(raw):
        fail(BC.reason("Viggle (native)"))

    # 3. the segment's frames, the original sound
    got = count_frames(raw)
    keep = min(frames, got) if got else frames
    stem = _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_viggle.mp4")
    has_a = probe(clip)[3]
    run_ff(RG.finish_args(raw, clip, output_dir / name, keep, has_a, drop_first=False), "trimming the take and putting the original audio back")
    say(f"[worker] viggle native: {keep} frames kept" + (f" (made {got})" if got and got != keep else "")
        + (", the original audio on" if has_a else " (the video has no audio)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] viggle native complete")


if __name__ == "__main__":
    main()
