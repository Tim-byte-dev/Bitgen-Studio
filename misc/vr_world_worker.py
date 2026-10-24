#!/usr/bin/env python3
"""bitGen Studio — VR WORLD worker (2.368.0): mode "vrworld".

Tim (verbatim): "is it possible for bitgen to create vr 3d sbs movies from reference pictures and audio
references- maybe using a 360 sbs picture as reference?" -> "lets try route 2. and add a wan2.1 style so we can
use wan as well, also wan2.2".

One job = one VR clip (scripts/vr_world.py has the why):
  1. the virtual camera's views of the still picture (left; + right for stereo) at the render size;
  2. the PERFORMER render - the job's `render` params run through the app's own worker for them (worker.py
     for MiniMax H3, wan_worker.py for Wan) in a sub-folder, starting on the first frame (the dialog's
     ✎ First frame, else the empty view); its log is passed through as [performer] lines;
  3. both eyes (the performer as a card at the depth of the ground at their feet), the feathered edge;
  4. back into the still sphere, the render's sound, H.265 above 4K, the name suffix + spherical metadata
     -> @@OUT.

params: mode "vrworld", world (abs), vr_mode (mono360|tb360|sbs180|sbs360), view {yaw, pitch, fov, shape},
short_side, lock (bool), first_frame (abs | ""), render (a worker job's params: mode fl2va / wan),
output_name (optional stem).
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent                     # misc/ (2.591.0) - the other workers are here
sys.path.insert(0, str(HERE.parent / "scripts"))
import image_name as _iname                                  # noqa: E402
import vr_swap as VR                                         # noqa: E402
import vr_world as VW                                        # noqa: E402

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

CHILD = [None]


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def _term(*_):
    c = CHILD[0]
    if c is not None and c.poll() is None:
        try:
            c.terminate()
            c.wait(timeout=10)
        except Exception:                                  # noqa: BLE001
            try:
                c.kill()
            except Exception:                              # noqa: BLE001
                pass
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, _term)
    except Exception:                                      # noqa: BLE001
        pass


def run_ff(args, what):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"ffmpeg failed {what}: {(r.stderr or '').strip()[-400:]}")


def probe(p):
    """(width, height, frames, duration, has_audio)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,width,height,nb_frames:format=duration", "-of", "json", str(p)],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        d = {}
    v = next((s for s in d.get("streams") or [] if s.get("codec_type") == "video"), {})
    a = any(s.get("codec_type") == "audio" for s in d.get("streams") or [])
    try:
        nf = int(v.get("nb_frames") or 0)
    except ValueError:
        nf = 0
    return (int(v.get("width") or 0), int(v.get("height") or 0), nf,
            float((d.get("format") or {}).get("duration") or 0), a)


def render_performer(job, rparams, work):
    """Run the app's own worker for the performer in work/performer; -> the file it wrote."""
    sub = work / "performer"
    out = sub / "out"
    out.mkdir(parents=True, exist_ok=True)
    script = "wan_worker.py" if rparams.get("mode") == "wan" else "worker.py"
    sj = {k: v for k, v in job.items() if k not in ("params", "output_dir", "raw_dir")}
    sj.update({"params": rparams, "output_dir": str(out)})
    (sub / "job.json").write_text(json.dumps(sj, indent=1), encoding="utf-8")
    py = sys.executable or "python3"
    say(f"[worker] the performer: {script} {rparams.get('mode')} at {rparams.get('width')}x{rparams.get('height')}")
    p = subprocess.Popen([py, "-u", str(HERE / script), str(sub / "job.json")], cwd=str(sub),
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                         text=True, encoding="utf-8", errors="replace", env=dict(os.environ))
    CHILD[0] = p
    name = None
    for line in p.stdout:
        line = line.rstrip("\n")
        if line.startswith("@@OUTS "):
            continue
        if line.startswith("@@OUT "):
            name = line[6:].strip()
            continue
        if line.startswith("@@"):
            continue                      # @@CMD / @@CFG belong to the sub-job, not this one
        say("[performer] " + line)
    code = p.wait()
    CHILD[0] = None
    if code != 0:
        fail(f"the performer render failed ({script} exited {code}) - its log is above")
    if not name or not (out / name).is_file():
        fail("the performer render finished without a file")
    return out / name


def main():
    if len(sys.argv) != 2:
        fail("usage: vr_world_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params = job["params"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "vrworld":
        fail(f"vr_world_worker.py only runs mode=vrworld (got {params.get('mode')!r})")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            fail(f"VR World needs {tool} on PATH (winget install Gyan.FFmpeg)")
    world = Path(str(params.get("world") or ""))
    if not world.is_file():
        fail(f"the world picture is missing: {world}")
    mode = params.get("vr_mode")
    if not VR.mode_of(mode):
        fail(f"unknown VR type {mode!r} (mono360 / tb360 / sbs180 / sbs360)")
    view = VR.clamp_view(params.get("view") or {})
    W, H, _n, _d, _a = probe(world)
    if not (W and H):
        fail(f"could not read the size of {world.name} (is ffprobe installed?)")
    stereo = VR.MODES[mode]["stereo"]
    if stereo:
        try:
            import cv2  # noqa: F401
            import numpy  # noqa: F401
        except ImportError:
            fail("stereo VR needs OpenCV + numpy in the app's Python (pip install opencv-python-headless numpy)")
    vw, vh = VR.view_size(int(params.get("short_side") or 544), view["shape"])
    ew, eh = VR.eye_size(mode, W, H)
    say(f"[worker] VR World: {world.name} ({W}x{H}, {mode}, one eye {ew}x{eh}) · the camera yaw {view['yaw']:g}° "
        f"pitch {view['pitch']:g}° view {view['fov']:g}° {view['shape']} -> {vw}x{vh}")

    # 1. the views of the still
    vl, vr = work / "view_L.png", work / "view_R.png"
    run_ff(VW.still_view_args(world, vl, mode, "L", view, vw, vh), "cutting the left view")
    if stereo:
        run_ff(VW.still_view_args(world, vr, mode, "R", view, vw, vh), "cutting the right view")

    # 2. the performer
    first = Path(str(params.get("first_frame") or ""))
    start = work / "first_frame.png"
    if first.is_file():
        run_ff(VW.fit_image_args(first, start, vw, vh), "fitting the first frame to the view")
        say(f"[worker] the performer starts on {first.name} (the ✎ first frame), fitted to {vw}x{vh}")
    else:
        shutil.copyfile(vl, start)
        say("[worker] the performer starts on the empty view (no ✎ first frame) - the prompt brings them in")
    rp = dict(params.get("render") or {})
    if not rp.get("mode"):
        fail("the job has no performer render")
    rp["width"], rp["height"] = vw, vh
    rp["prompt"] = VW.static_prompt(rp.get("prompt"))
    if rp["mode"] == "wan":
        rp["images"] = {"start": str(start)}
        rp["wan_mode"] = "i2v"
    else:
        rp["reference_files"] = [str(start)]
        rp["reference_names"] = ["first_frame.png"]
    raw = render_performer(job, rp, work)
    rw, rh, rn, rdur, has_a = probe(raw)
    say(f"[worker] the performer: {raw.name} {rw}x{rh}, {rdur:.2f}s" + (", with sound" if has_a else ", silent"))
    frames = max(1, int(round(rdur * VW.FPS)))
    clip = work / "performer_24.mp4"
    run_ff(VW.fit_args(raw, clip, vw, vh, frames), "fitting the render to the view")

    # 3. the eyes
    eye_l, eye_r = work / "eye_L.mp4", work / "eye_R.mp4"
    lock = params.get("lock") is True
    n, area = VW.write_eyes(clip, vl, vr if stereo else None, eye_l, eye_r if stereo else None, vw, vh, frames,
                            lock=lock, on_tick=lambda k: say(f"[worker] VR eyes: {k}/{frames} frames"))
    if n < 1:
        fail("no frames came out of the performer render")
    say(f"[worker] VR eyes: {n} frames" + (" (stereo: the place's own depth, the performer at their feet's depth)"
                                           if stereo else "") + (f"; the performer covers ~{area * 100:.0f}% of the view"
                                                                 if area else "; no performer found against the empty view"
                                                                 " - the whole view moves as rendered")
        + ("; background locked to the picture" if lock else ""))
    mask = work / "feather.png"
    run_ff(VR.mask_args(mask, vw, vh), "making the feathered edge")

    # 4. back into the sphere
    stem = str(params.get("output_name") or "") or _iname.build_stem(work.name, None, time.time())
    name = _iname.reserve(output_dir, f"{stem}_vrworld{VW.out_suffix(mode)}.mp4")
    dest = output_dir / name
    codec = VR.codec_args(W, H)
    say(f"[worker] VR: back onto the {W}x{H} picture ({'H.265' if 'libx265' in codec else 'H.264'}, {VW.FPS} fps)")
    run_ff(VW.paste_still_args(world, mode, view, eye_l, eye_r, mask, dest, W, H, vw, vh, n, codec,
                               audio_src=clip if has_a else None), "putting the performer into the VR picture")
    tagged = VR.inject(dest, mode)
    say("[worker] VR: " + ("spherical metadata written - players open it as VR" if tagged else
                           "the name suffix marks it as VR (the metadata could not be written)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] vrworld complete")


if __name__ == "__main__":
    main()
