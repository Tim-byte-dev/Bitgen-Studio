#!/usr/bin/env python3
"""bitGen Studio — RTX VFX VIDEO FINISHER worker (2.708.0): mode "rtxvfx".

Tim: "Add the RTX upscale" - the DENO pack's DenoRTXVFXVideoFinisher (NVIDIA RTX Video Super Resolution / Deblur /
High Bitrate passes, https://github.com/Deno2026/comfyui-deno-custom-nodes) as another take upscaler beside SeedVR2 and
DLSS 5. One job = one video through scripts/rtxvfx_graph.build (VideoHelperSuite in / out), in CHUNKS of frames:
  1. the source (a take, its lossless master, any project video) - the window asked for is cut; a file VHS_LoadVideo
     may not read (the FFV1 master) is made a near-lossless H.264 first; its frames are counted;
  2. the nodes are checked, and every combo the job sets is checked against what THIS ComfyUI's node offers
     (/object_info - never a hard-coded list); required inputs a newer pack added are filled from its own defaults;
  3. one graph per chunk of "frames per batch" frames (VHS_LoadVideo skip_first_frames + frame_load_cap; 0 = every
     frame in one run), each saved by its own VHS_VideoCombine prefix, "chunk n/N" as each runs - the batching is ours,
     not VideoHelperSuite's meta batch (its re-queue is nothing an API client can count on);
  4. the chunks are joined losslessly (ffmpeg concat demuxer, -c copy) and the source's sound is laid back under the
     whole thing -> @@OUT.

The NVIDIA runtime is NOT in the pack: its installer (custom_nodes/deno-custom-nodes/tools/install_rtx_vfx.bat, with
ComfyUI closed) puts it in. RTX cards / Windows only. The pack's own error text is passed on when it fails.

params: mode "rtxvfx", source (abs path), rtx {preset, first_pass, first_quality, upscale_pass, upscale_quality, scale,
batch}, start / duration (optional window), output_name, audio_source (the take whose sound goes back under a master),
label.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
try:
    import comfy_client as _comfy
except Exception as _e:                                    # noqa: BLE001
    _comfy, _comfy_err = None, _e
import image_name as _iname
import comfy_progress as _CP
import rtxvfx_graph as RG
import seedvr2_graph as SV                                  # mux_args: the same "sound back under it" step
import swap_graph as SG                                     # combo_list: every /object_info combo shape

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

DIRECT = (".mp4", ".webm", ".mov", ".mkv", ".m4v")
STAGES = 4
INSTALL = ("Settings -> ComfyUI -> Video accelerators -> Install DENO nodes (RTX VFX) (or git clone "
           "https://github.com/Deno2026/comfyui-deno-custom-nodes into custom_nodes/deno-custom-nodes), then put in "
           "NVIDIA's runtime with the pack's installer: https://deno2026.github.io/comfyui-deno-custom-nodes/rtx-vfx-install/ "
           "(extract the official installer zip into ComfyUI/custom_nodes/deno-custom-nodes/tools/, close ComfyUI, run "
           "install_rtx_vfx.bat) and restart ComfyUI. NVIDIA RTX cards on Windows only")
RUNTIME = ("the NVIDIA RTX VFX runtime is not in the node pack - with ComfyUI closed, run "
           "ComfyUI/custom_nodes/deno-custom-nodes/tools/install_rtx_vfx.bat (extract NVIDIA's official installer zip "
           "there first: https://deno2026.github.io/comfyui-deno-custom-nodes/rtx-vfx-install/), then restart ComfyUI. "
           "NVIDIA RTX cards on Windows only")
VHS = "update / install ComfyUI-VideoHelperSuite (ComfyUI-Manager, or git clone it into custom_nodes)"


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


def first_video(outputs):
    vids = _comfy.output_videos(outputs) if hasattr(_comfy, "output_videos") else []
    if vids:
        return vids[0]
    for node_out in (outputs or {}).values():
        for lst in (node_out or {}).values():
            for it in lst if isinstance(lst, list) else []:
                if (isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(_comfy.VIDEO_EXT)
                        and not _comfy.is_input_echo(it)):
                    return it
    return None


def live_lists(base):
    """{widget: [options]} THIS ComfyUI offers: the finisher's combos + VHS_LoadVideo.format ([] = not said)"""
    out = {}
    for ct, keys in ((RG.NODE, RG.PASS_KEYS + ("resize_type",) + RG.SOFT), ("VHS_LoadVideo", ("format",))):
        try:
            info = _comfy.object_info(base, ct) or {}
        except Exception:                                  # noqa: BLE001
            info = {}
        spec = ((info.get(ct) or {}).get("input") or {})
        for k in keys:
            got = None
            for g in ("required", "optional"):
                if k in (spec.get(g) or {}):
                    got = spec[g][k]
            out[k] = SG.combo_list(got) if got is not None else []
    return out


def pack_said(msg):
    """the pack's own words out of a ComfyError (its exception_message), or ''"""
    m = re.findall(r'"exception_message":\s*"((?:[^"\\]|\\.)*)"', str(msg or ""))
    if not m:
        return ""
    try:
        return json.loads('"' + m[-1] + '"').strip()
    except (ValueError, json.JSONDecodeError):
        return m[-1].strip()


def count_frames(path, info):
    """the video's frame count (ffprobe -count_packets), else duration x fps; 0 = unknown"""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                            "stream=nb_read_packets", "-of", "csv=p=0", str(path)], capture_output=True, text=True,
                           timeout=120)
        n = int((r.stdout or "").strip().splitlines()[0].strip().rstrip(","))
        if n > 0:
            return n
    except Exception:                                      # noqa: BLE001
        pass
    return int(round((info.get("duration") or 0) * (info.get("fps") or 24)))


def main():
    if len(sys.argv) != 2:
        fail("usage: rtxvfx_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "rtxvfx":
        fail(f"rtxvfx_worker.py only runs mode=rtxvfx (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the video to finish is gone: {src}")
    opts = RG.normalize(params.get("rtx") or {})
    say(f"[worker] rtxvfx_worker.py source={src.name}")

    stage(1, "reading the video")
    info = probe(src)
    if not info:
        fail(f"could not read {src.name} (is ffprobe installed, is it a video?)")
    start = max(0.0, float(params.get("start") or 0))
    dur = float(params.get("duration") or 0) or None
    t = RG.target(info["width"], info["height"], opts["scale"])
    if t.get("error"):
        fail(t["error"])
    say(f"[worker] {src.name}: {info['width']}x{info['height']} · {info.get('fps', 24):.3g} fps · "
        f"{info.get('duration', 0):.2f}s -> about {t['width']}x{t['height']} (x{t['factor']:g})")
    feed = src
    if start or dur or src.suffix.lower() not in DIRECT:
        feed = work / "rtxvfx_src.mp4"
        cut = ["ffmpeg", "-y", "-loglevel", "error"]
        if start:
            cut += ["-ss", f"{start:.3f}"]
        cut += ["-i", str(src)]
        if dur:
            cut += ["-t", f"{dur:.3f}"]
        cut += ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "medium", "-crf", "8",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", str(feed)]
        r = subprocess.run(cut, capture_output=True, text=True)
        if r.returncode != 0 or not feed.is_file():
            fail("ffmpeg could not prepare the video: " + (r.stderr or "").strip()[-300:])
        say(f"[worker] prepared {feed.name}")
    frames = count_frames(feed, info if feed == src else (probe(feed) or info))
    parts = RG.chunks(frames, opts["batch"])

    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    stage(2, "checking the RTX VFX nodes and uploading")
    miss = _comfy.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(RG.REQUIRED)})
    if miss:
        fail("ComfyUI does not have " + ", ".join(miss) + " - " + (INSTALL if RG.NODE in miss else VHS))
    vals, notes, errors = RG.resolve(dict(opts, **RG.FIXED, format=RG.LOAD_FORMAT), live_lists(base))
    if errors:
        fail("; ".join(errors) + " - pick one of those in the RTX VFX panel (Custom), or update the DENO nodes")
    try:
        up = _comfy.upload_image(base, str(feed))
    except Exception as e:                                 # noqa: BLE001
        fail(f"could not upload {feed.name} to ComfyUI: {e}")
    say(f"[worker] uploaded {feed.name} -> {up}")
    total = len(parts)
    graphs = []
    for i, (skip, cap) in enumerate(parts, 1):
        g, more = RG.build(dict(vals, video=up, prefix=f"bitgen_rtxvfx/{work.name}_c{i:03d}", skip=skip, cap=cap))
        try:
            for _nid, ct, name, v, how in _comfy.fill_required_inputs(base, g):
                if i == 1:
                    notes.append(f"{ct}.{name} = {v!r} ({how} - this pack version needs it)")
        except Exception:                                  # noqa: BLE001
            pass
        graphs.append(g)
        if i == 1:
            notes = more + notes
    for n in notes:
        say(f"[worker] {n}")
    say(f"[worker] {frames or '?'} frames -> {total} chunk" + ("s" if total > 1 else "")
        + (f" of {opts['batch']} frames" if total > 1 else " (every frame in one run)"))
    say("[meta] " + json.dumps({"steps": 1, "cfg": 1, "sampler": "RTX VFX", "models": ["NVIDIA RTX Video (VFX SDK)"],
                                "upscale": f"RTX VFX {vals['upscale_pass']} x{opts['scale']:g} -> about "
                                + f"{t['width']}x{t['height']}"
                                + (f", {vals['first_pass']} first" if vals["first_pass"] != "Off" else "")}))
    (work / "rtxvfx_queued.json").write_text(json.dumps(graphs[0], indent=1), encoding="utf-8")

    stage(3, "RTX VFX in ComfyUI")
    pieces = []
    try:
        _comfy.clear_before_gen(base, cfg, say, graphs[0])
        for i, (g, (skip, cap)) in enumerate(zip(graphs, parts), 1):
            last = f"{skip + 1}-{skip + cap}" if cap else f"{skip + 1}-end"
            say(f"[worker] chunk {i}/{total} - frames {last}")
            _pid, outputs = _CP.run(_comfy, base, g, say, f"chunk {i}/{total}")
            it = first_video(outputs)
            if not it:
                fail(f"chunk {i}/{total}: ComfyUI finished but saved no video (the graph ends in VHS_VideoCombine)")
            piece = work / (f"rtxvfx_chunk_{i:03d}" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
            _comfy.download(base, it, piece)
            if not piece.exists() or piece.stat().st_size == 0:
                fail(f"chunk {i}/{total}: downloaded an empty file for {it.get('filename')}")
            pieces.append(piece)
    except _comfy.ComfyError as e:
        msg = str(e)
        said = pack_said(msg)
        if said:
            say(f"[worker] {RG.NODE} said: {said}")
        low = msg.lower()
        if any(w in low for w in ("runtime", "dll", "sdk", "nvvfx", "install_rtx", "not installed", "nvidia")):
            msg += " - " + RUNTIME
        fail((f"chunk {len(pieces) + 1}/{total}: " if total > 1 else "") + msg)
    raw = pieces[0]
    if len(pieces) > 1:
        lst = work / "rtxvfx_chunks.txt"
        lst.write_text(RG.concat_list(pieces), encoding="utf-8")
        raw = work / ("rtxvfx_joined" + pieces[0].suffix)
        r = subprocess.run(RG.concat_args(lst, raw), capture_output=True, text=True)
        if r.returncode != 0 or not raw.is_file():
            fail("ffmpeg could not join the chunks: " + (r.stderr or "").strip()[-300:])
        say(f"[worker] joined {len(pieces)} chunks (no re-encode)")

    stage(4, "laying the sound back")
    got = probe(raw) or {}
    short = min(got.get("width", 0) or t["width"], got.get("height", 0) or t["height"])
    name = str(params.get("output_name") or "").strip() or f"{src.stem}_rtxvfx_{short}p.mp4"
    name = _iname.reserve(output_dir, Path(name).stem + ".mp4")
    asrc = Path(str(params.get("audio_source") or "")) if params.get("audio_source") else src
    if not asrc.is_file():
        asrc = src
    r = subprocess.run(SV.mux_args(raw, asrc, output_dir / name, start, dur, got.get("duration") or None),
                       capture_output=True, text=True)
    if r.returncode != 0:
        fail("ffmpeg could not finish: " + (r.stderr or "").strip()[-300:])
    say(f"[worker] {got.get('width', '?')}x{got.get('height', '?')} written")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] rtxvfx complete")


if __name__ == "__main__":
    main()
