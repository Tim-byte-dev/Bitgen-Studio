#!/usr/bin/env python3
"""bitGen Studio — DLSS 5 ENHANCE / UPSCALE / FRAME GENERATION worker (2.504.0): mode "dlss5".

Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow (which ends in DLSS 5
at 4K). One job = one video through RunningHub's DLSS 5 nodes (scripts/dlss5_graph.build):
  1. the source (a take, its lossless master, any project video) - the window asked for is cut; a file ComfyUI's
     LoadVideo may not read (the FFV1 master) is made a near-lossless H.264 first;
  2. the pack is checked (its node types, and nothing else - the NVIDIA DLLs it needs are the user's own,
     ComfyUI/models/dlss5/; its own error names any that are missing);
  3. the graph is queued and waited on;
  4. the source's sound is laid back under the result -> @@OUT.

params: mode "dlss5", source (abs path), dlss {mode, style, intensity, tone, structure, skin, detail, color, fps},
start / duration (optional window), output_name, audio_source (the take whose sound goes back under a master), label.
"""
import json
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
import dlss5_graph as DG
import seedvr2_graph as SV                                  # mux_args: the same "sound back under it" step

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

DIRECT = (".mp4", ".webm", ".mov", ".mkv", ".m4v")
STAGES = 4
INSTALL = ("Settings -> ComfyUI -> Video accelerators -> Install RH DLSS 5 (or git clone "
           "https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 into custom_nodes), put NVIDIA's DLLs in "
           "ComfyUI/models/dlss5/ (the pack's README) and restart ComfyUI")


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
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(_comfy.VIDEO_EXT):
                    return it
    return None


def main():
    if len(sys.argv) != 2:
        fail("usage: dlss5_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "dlss5":
        fail(f"dlss5_worker.py only runs mode=dlss5 (got {params.get('mode')!r})")
    src = Path(str(params.get("source") or ""))
    if not src.is_file():
        fail(f"the video to enhance is gone: {src}")
    opts = DG.normalize(params.get("dlss") or {})
    say(f"[worker] dlss5_worker.py source={src.name}")

    stage(1, "reading the video")
    info = probe(src)
    if not info:
        fail(f"could not read {src.name} (is ffprobe installed, is it a video?)")
    start = max(0.0, float(params.get("start") or 0))
    dur = float(params.get("duration") or 0) or None
    t = DG.target(info["width"], info["height"], opts["mode"])
    if t.get("error"):
        fail(t["error"])
    say(f"[worker] {src.name}: {info['width']}x{info['height']} · {info.get('fps', 24):.3g} fps · "
        f"{info.get('duration', 0):.2f}s -> about {t['width']}x{t['height']} (x{t['factor']:g})")
    feed = src
    if start or dur or src.suffix.lower() not in DIRECT:
        feed = work / "dlss5_src.mp4"
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

    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    stage(2, "checking the DLSS 5 nodes and uploading")
    need = list(DG.REQUIRED) + ([DG.INTERP] if opts["fps"] != "off" else [])
    miss = _comfy.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(need)})
    if miss:
        fail("ComfyUI does not have " + ", ".join(miss) + " - " + (INSTALL if any(c.startswith("RH_") for c in miss)
             else "update ComfyUI (LoadVideo / SaveVideo are core nodes)"))
    try:
        up = _comfy.upload_image(base, str(feed))
    except Exception as e:                                 # noqa: BLE001
        fail(f"could not upload {feed.name} to ComfyUI: {e}")
    say(f"[worker] uploaded {feed.name} -> {up}")
    graph, notes = DG.build(dict(opts, video=up, prefix="bitgen_dlss5/" + work.name))
    for n in notes:
        say(f"[worker] {n}")
    say("[meta] " + json.dumps({"steps": 1, "cfg": 1, "sampler": "DLSS 5", "models": ["NVIDIA DLSS 5 (NGX)"],
                                "upscale": f"DLSS 5 {opts['mode']} -> about {t['width']}x{t['height']}"
                                + (f", frame generation {opts['fps']}" if opts["fps"] != "off" else "")}))
    (work / "dlss5_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    stage(3, "DLSS 5 in ComfyUI")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        _pid, outputs = _CP.run(_comfy, base, graph, say, "enhancing")
    except _comfy.ComfyError as e:
        msg = str(e)
        if "dll" in msg.lower() or "runtime" in msg.lower() or "ngx" in msg.lower():
            msg += " - the NVIDIA DLSS DLLs go in ComfyUI/models/dlss5/ (the pack's README names them)"
        fail(msg)
    it = first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video (the graph ends in SaveVideo)")
    raw = work / ("dlss5_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    stage(4, "laying the sound back")
    got = probe(raw) or {}
    name = str(params.get("output_name") or "").strip() or f"{src.stem}_dlss5_{min(got.get('width', 0) or t['width'], got.get('height', 0) or t['height'])}p.mp4"
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
    say("[worker] dlss5 complete")


if __name__ == "__main__":
    main()
