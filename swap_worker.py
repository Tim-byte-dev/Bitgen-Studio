#!/usr/bin/env python3
"""bitGen Studio — the CHARACTER SWAP worker (2.324.0).

A fifth worker, by the standing rule (lib/core.js WORKER_FOR): a new
generation kind gets its own worker, never a branch inside another one. A
swap has nothing to do with worker.py's frame grids / chunk hand-offs /
style validation, and it is more than graph_worker.py's transport: it cuts
the reference video first and gives the result its original audio back.

    1. ffprobe the reference video; scripts/swap_graph.window() / size()
       decide the window (start + duration, snapped to 17k+5, one run) and
       the render size (the video's aspect, the chosen short side)
    2. ffmpeg cuts that window at 24 fps and the render size (+ its audio)
    3. the clip and the character picture are uploaded to ComfyUI;
       swap_graph.patch() aims comfy_workflows/MiniMax_H3_Swap.json at them
       (prompt / size / length / seed written directly)
    4. ComfyUI renders; the video is downloaded
    5. Tim's answer "Keep original audio": the window's ORIGINAL sound goes
       back on the swapped picture (a silent source keeps the model's audio)

Speaks the same control protocol as the other workers (@@OUT, the chunk
line lib/core.js parses).
"""
import json
import shutil
import signal
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
import swap_graph as SG
import vr_swap as VR           # 2.330.0: the character swap in VR video
# 2.328.0: the swap STYLE's overrides (mmh3_chr_swap - model / te / vae /
# LoRAs / load precision / accelerators) go through worker.py's own
# apply_video_style / apply_video_accel, never a copy. Imported BEFORE this
# file's signal handlers are installed: worker.py installs its own at import
# and ours (below) must be the ones that stand.
try:
    import worker as _W
except Exception as _e:                                    # noqa: BLE001
    _W, _W_err = None, _e
# 2.329.0: the swap dialog's ⏫ Upscale re-runs a segment with the SAME seed
# and the video docker ⚙ upscaler stage spliced after the sampler
try:
    import upscalestage as _us
except Exception as _e:                                    # noqa: BLE001
    _us, _us_err = None, _e

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv", ".avi", ".gif")


def say(line: str) -> None:
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg: str) -> None:
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def on_term(signum, _frame):
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, on_term)
    except Exception:                                      # noqa: BLE001
        pass


def probe(p: Path):
    """(duration s, width, height, has_audio) of a video file."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:stream=codec_type,width,height",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        d = {}
    streams = d.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    has_a = any(s.get("codec_type") == "audio" for s in streams)
    try:
        dur = float((d.get("format") or {}).get("duration") or 0)
    except (TypeError, ValueError):
        dur = 0.0
    return dur, int(v.get("width") or 0), int(v.get("height") or 0), has_a


def run_cmd(args, what):
    r = subprocess.run(args, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        fail(f"{what} failed: {(r.stderr or '').strip()[-400:]}")


def first_video(outputs):
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        for lst in node_out.values():
            if not isinstance(lst, list):
                continue
            for it in lst:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(VIDEO_EXT):
                    return it
    return None


def apply_style(graph, style):
    """The swap style's overrides into the patched graph -> (graph, notes).
    No style / an empty one = the graph untouched."""
    if not isinstance(style, dict):
        return graph, []
    if _W is None:
        return graph, [f"style \"{style.get('name')}\": its overrides were skipped - "
                       f"worker.py did not load ({_W_err})"]
    notes = []
    graph, n1 = _W.apply_video_style(graph, style)
    graph, n2 = _W.apply_video_accel(graph, style.get("accel"))
    for n in n1 + n2:
        notes.append(f"style \"{style.get('name')}\": {n}")
    if not notes:
        notes.append(f"style \"{style.get('name')}\": the workflow's own models and settings")
    return graph, notes


def swap_lora(base, graph, want):
    """Stack the character-swap LoRA when ComfyUI's loras folder has it
    (want False = never). Says what it did either way."""
    if want is False or str(want).lower() in ("0", "false", "off", "no"):
        say("[worker] swap LoRA: off for this job")
        return graph
    names = []
    for ct in ("LoraLoaderModelOnly", "LoraLoader"):
        try:
            names = SG.lora_names(_comfy.object_info(base, ct), ct)
        except Exception:                                  # noqa: BLE001
            names = []
        if names:
            break
    name = SG.find_swap_lora(names)
    if not name:
        say(f"[worker] swap LoRA: {SG.SWAP_LORA_FILE} is not in ComfyUI's loras - the swap runs on H3 alone "
            "(identity holds less well; get it in Setup -> Models -> Video extras: "
            "\"H3 Character Swap LoRA\", into models/loras/minimax-h3)")
        return graph
    graph, note = SG.add_swap_lora(graph, name, SG.SWAP_LORA_STRENGTH)
    say(f"[worker] {note}")
    return graph


def swap_quality(base, graph, quality):
    """The quality preset, with a scheduler this ComfyUI knows (beta, else
    normal, else the workflow's own)."""
    graph, notes = SG.apply_quality(graph, quality)
    for n in notes:
        say(f"[worker] {n}")
    try:
        info = _comfy.object_info(base, "BasicScheduler") or {}
        spec = ((info.get("BasicScheduler") or {}).get("input") or {}).get("required") or {}
        names = SG.combo_list(spec.get("scheduler"))
    except Exception:                                      # noqa: BLE001
        names = []
    if names:
        for k, v in graph.items():
            ins = (v or {}).get("inputs") or {} if isinstance(v, dict) else {}
            if v.get("class_type") == "BasicScheduler" and isinstance(ins.get("scheduler"), str) \
                    and ins["scheduler"] not in names:
                alt = "normal" if "normal" in names else names[0]
                say(f"[worker] this ComfyUI has no '{ins['scheduler']}' scheduler - using '{alt}'")
                ins["scheduler"] = alt
    return graph


def params_short_side(vr):
    return int(vr.get("_short_side") or 544)


def vr_finish(src, raw, work, output_dir, vr, view, win, sw, sh, has_a, seed):
    """VR: the right eye through the original depth (stereo), both swapped
    views back onto their full-resolution eyes, re-stacked, the window's own
    sound, H.265 above 4K, tagged + named for VR players."""
    mode = vr["mode"]
    _, rw, rh, _ = probe(raw)
    if not rw or not rh:
        fail("could not read the swapped view's size")
    vw, vh = VR.view_size(params_short_side(vr), view["shape"])
    if abs(rw / rh - vw / vh) > 0.01:
        # the render came back in another shape than the view was cut in -
        # squeeze it back, or the paste would land at the wrong angles
        fixed = work / "vr_swapped_fit.mp4"
        rh = max(2, int(round(rw * vh / vw / 2.0)) * 2)
        run_cmd(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-vf", f"scale={rw}:{rh},setsar=1",
                 "-c:v", "libx264", "-crf", "10", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(fixed)],
                "fitting the render to the view's shape")
        say(f"[worker] VR: the render came back {rw}x{probe(raw)[2]} - fitted to the view's shape ({rw}x{rh})")
        raw = fixed
    frames = int(win["frames"])
    sw_right = None
    if VR.MODES[mode]["stereo"]:
        try:
            import cv2  # noqa: F401
            import numpy  # noqa: F401
        except Exception as e:                              # noqa: BLE001
            fail("stereo VR needs OpenCV + numpy in the app's Python (pip install opencv-python-headless "
                 f"numpy - start.bat installs them from requirements.txt): {e}")
        ol, orr = work / "vr_orig_l.mp4", work / "vr_orig_r.mp4"
        say(f"[worker] VR: the original left / right views at {rw}x{rh} for the depth")
        run_cmd(VR.cut_args(src, ol, win["start"], win["dur"], frames, mode, "L", view, rw, rh, audio=False),
                "cutting the original left view")
        run_cmd(VR.cut_args(src, orr, win["start"], win["dur"], frames, mode, "R", view, rw, rh, audio=False),
                "cutting the original right view")
        sw_right = work / "vr_swapped_r.mp4"
        say("[worker] VR: the right eye = the swapped left view re-projected through the original depth")
        n = VR.right_eye_file(raw, ol, orr, sw_right, rw, rh, frames,
                              on_tick=lambda k: say(f"[worker] VR right eye: {k}/{frames} frames"))
        if n < 1:
            fail("the right eye came out empty")
        say(f"[worker] VR right eye: {n} frames")
    mask = work / "vr_mask.png"
    run_cmd(VR.mask_args(mask, rw, rh), "making the feathered edge")
    stem = _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_swap{VR.MODES[mode]['suffix']}.mp4")
    dest = output_dir / name
    codec = VR.codec_args(sw, sh)
    say(f"[worker] VR: back onto the {sw}x{sh} frame ({'H.265' if 'libx265' in codec else 'H.264'}, "
        f"{VR.FPS} fps - the model's rate)")
    run_cmd(VR.paste_args(src, win["start"], win["dur"], frames, mode, view, raw, sw_right, mask, dest,
                          sw, sh, rw, rh, codec, audio=has_a), "putting the swap back into the VR frame")
    tagged = VR.inject(dest, mode)
    say("[worker] VR: " + ("spherical metadata written - players open it as VR"
                           if tagged else "no metadata box (the name suffix still marks it)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] swap complete")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: swap_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    cfg["_app_dir"] = job.get("app_dir", str(Path.cwd()))
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "swap":
        fail(f"swap_worker.py only runs mode=swap (got {params.get('mode')!r})")
    say("[worker] swap_worker.py mode=swap"
        + (f" style={params['video_style'].get('name')}" if isinstance(params.get("video_style"), dict) else ""))
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            fail(f"a character swap needs {tool} on PATH (winget install Gyan.FFmpeg)")

    src = Path(str(params.get("video") or ""))
    pic = Path(str(params.get("image") or ""))
    wf = Path(str(params.get("workflow") or ""))
    for label, p in (("reference video", src), ("character picture", pic), ("swap workflow", wf)):
        if not p.is_file():
            fail(f"the {label} is missing: {p}")

    # 1. the window and the size
    sdur, sw, sh, has_a = probe(src)
    say(f"[worker] reference video {src.name}: {sdur:.2f}s, {sw}x{sh}, "
        f"{'with' if has_a else 'no'} audio")
    try:
        win = SG.window(sdur, params.get("start") or 0, params.get("dur"),
                        int(params.get("ceiling") or SG.CEILING))
        width, height = SG.size(sw, sh, params.get("short_side") or 544)
    except ValueError as e:
        fail(str(e))
    # 2.330.0: VR - the swap renders a VIRTUAL CAMERA aimed at the person
    # in the left eye (scripts/vr_swap.py), never the whole sphere
    vr = params.get("vr") if isinstance(params.get("vr"), dict) else None
    if vr and not VR.mode_of(vr.get("mode")):
        fail(f"unknown VR format {vr.get('mode')!r}")
    if vr:
        view = VR.clamp_view(vr)
        width, height = VR.view_size(params.get("short_side") or 544, view["shape"])
        vr = dict(vr, _short_side=params.get("short_side") or 544)
        ew, eh = VR.eye_size(vr["mode"], sw, sh)
        say(f"[worker] VR {vr['mode']}: eye {ew}x{eh}; the virtual camera looks at yaw {view['yaw']:g}, "
            f"pitch {view['pitch']:g} with a {view['fov']:g} degree view ({view['shape']}) -> {width}x{height}")
    for n in win["notes"]:
        say(f"[worker] {n}")
    if int(win["frames"]) > SG.BEST_FRAMES:
        say(f"[worker] note: {win['frames']} frames ({win['dur']:.2f}s) in one run - the swap holds the new "
            f"character best on 4-5 s shots ({SG.BEST_FRAMES} frames); longer runs can drift back to the "
            "original performer (✂ Auto segment cuts 5 s pieces)")
    say(f"[worker] swapping {win['start']:g}s + {win['dur']:.2f}s = {win['frames']} frames "
        f"at {width}x{height}")

    # 2. the clip
    clip = work / "swap_clip.mp4"
    if vr:
        run_cmd(VR.cut_args(src, clip, win["start"], win["dur"], win["frames"], vr["mode"], "L",
                            view, width, height), "cutting the virtual camera's view of the left eye")
    else:
        run_cmd(SG.trim_args(src, clip, win["start"], win["dur"], win["frames"], width, height),
                "cutting the reference window")

    # 3. uploads + the graph
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
        graph = json.loads(wf.read_text(encoding="utf-8"))
    except _comfy.ComfyError as e:
        fail(str(e))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read the swap workflow {wf.name}: {e}")
    try:
        up_v = _comfy.upload_image(base, str(clip))
        up_i = _comfy.upload_image(base, str(pic))
    except Exception as e:                                  # noqa: BLE001
        fail(f"could not upload the swap references to ComfyUI: {e}")
    say(f"[worker] uploaded {clip.name} -> {up_v}, {pic.name} -> {up_i}")
    seed = int(params.get("seed", -1))
    if seed < 0:
        import random
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
    try:
        graph, notes = SG.patch(graph, up_v, up_i, params.get("prompt") or "",
                                width, height, win["frames"], seed,
                                ref_image_size=params.get("ref_image_size"))
    except ValueError as e:
        fail(f"{wf.name}: {e}")
    for n in notes:
        say(f"[worker] {n}")
    graph, snotes = apply_style(graph, params.get("video_style"))
    for n in snotes:
        say(f"[worker] {n}")
    # 2.334.0: akatz-ai's H3 Character Swap LoRA - trained to swap the person
    # in <Video 1> for <Picture 1>; stacked when ComfyUI has it
    graph = swap_lora(base, graph, params.get("swap_lora", True))
    # 2.336.0: QUALITY - the swap LoRA was tested without the turbo LoRA at
    # 28 steps; Full / Best switch the turbo row off (scripts/swap_graph.py)
    graph = swap_quality(base, graph, params.get("quality"))
    if params.get("upscale_stage"):
        if _us is None:
            fail(f"scripts/upscalestage.py did not load ({_us_err}) - the segment cannot be upscaled")
        graph, unotes = _us.apply(graph, params["upscale_stage"], seed=seed)
        for n in unotes:
            say(f"[worker] {n}")
        if not any(n.startswith("upscale: MMH3") or "re-aimed" in n for n in unotes):
            fail("could not add the upscale stage to the swap graph: " + "; ".join(unotes))
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    missing = _comfy.missing_classes(base, graph)
    if missing:
        fail("ComfyUI does not have these node types: " + ", ".join(missing)
             + ". Install the node pack that provides them (Manager -> Install Missing "
               "Custom Nodes; VHS_LoadVideo is ComfyUI-VideoHelperSuite, the Power Lora "
               "Loader is rgthree-comfy).")

    # 4. render
    say("[worker] ===== chunk 1/1")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
        # progress, the queue card and the status bar move instead of saying "loading" until the end
        pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video - the swap workflow must end in SaveVideo")
    raw = work / ("swap_raw" + (Path(str(it.get("filename"))).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    if vr:
        vr_finish(src, raw, work, output_dir, vr, view, win, sw, sh, has_a, seed)
        sys.exit(0)

    # 5. the original audio back on
    stem = _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_swap.mp4")
    dest = output_dir / name
    _, _, _, clip_a = probe(clip)
    if clip_a:
        run_cmd(SG.mux_args(raw, clip, dest, win["dur"]), "putting the original audio back")
        say("[worker] the reference video's own audio is on the swapped take")
    else:
        if raw.suffix.lower() == ".mp4":
            shutil.copyfile(raw, dest)
        else:
            run_cmd(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-c:v", "libx264",
                     "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", str(dest)],
                    "encoding the swapped take")
        say("[worker] the reference video has no audio - the model's own audio is kept")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] swap complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
