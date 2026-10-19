"""bitGen Studio — APPEND / PREPEND a reference video (2.388.0).

Tim (verbatim): "add option to dropdown in reference docker video dropdown -"Append" if this is selected then continue
this video, take the last frame, upscale the png then generate an i2v or fl2va video from that frame-append the video
add option to dropdown in video reference -"prepend" if this is selected then continue this video, take the first
frame, upscale the png then generate an i2v or fl2va video from that frame-prepend the video. this will work from the
generate button in the prompt docker".

routes/index.js (/api/generate) takes the frame out of the video (ffmpeg) and puts it in the render as its first frame
(append) or its last frame (prepend, when the dock has a picture marked "first frame"); the job carries `frame_op`
{op: append | prepend, video, frame, width, height, upscaler, reverse}. The workers (worker.py, wan_worker.py) call:
  prepare(op, say, run_cmd, comfy)   the frame upscaled IN PLACE to the render's size: the ⚙ PNG upscaler (a model
                                     file or SeedVR2 through ComfyUI - scripts/tailpngs.py's graphs), else lanczos;
                                     a failed ComfyUI upscale falls back to lanczos, said
  join(op, part, out, say, run_cmd)  the new part and the video as ONE clip at the video's size / 24 fps:
                                     append  = video + part (the part's first frame - the video's last - dropped)
                                     prepend = part + video (the part's last frame - the video's first - dropped);
                                     reverse (a prepend with no first-frame picture: the part was made FORWARD from the
                                     video's first frame) = the part played backwards (silent), so it ends on it
A part / video with no sound gets silence, so the join always has one sound track.
"""
import json
import shutil
import subprocess
from pathlib import Path

try:
    import tailpngs as _tp
except Exception:                       # noqa: BLE001 - lanczos still works
    _tp = None

FPS = 24


def probe(path):
    """{w, h, frames, dur, audio} of a clip"""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames",
                        "-show_entries", "format=duration", "-of", "json", str(path)], capture_output=True, text=True)
    j = json.loads(r.stdout or "{}")
    v = next((s for s in j.get("streams") or [] if s.get("codec_type") == "video"), {})
    dur = float((j.get("format") or {}).get("duration") or 0)
    frames = int(v.get("nb_frames") or 0) or int(round(dur * FPS))
    return {"w": int(v.get("width") or 0), "h": int(v.get("height") or 0), "frames": frames, "dur": dur,
            "audio": any(s.get("codec_type") == "audio" for s in j.get("streams") or [])}


def extract_cmd(video, which, out):
    """ffmpeg: the video's first or LAST frame as a PNG (the last: the final decoded frame of the last second)"""
    if which == "first":
        return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-frames:v", "1", str(out)]
    return ["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-1", "-i", str(video), "-update", "1", "-q:v", "1", str(out)]


def prepare(op, say, run_cmd, comfy=None):
    """the frame upscaled in place to op.width x op.height. -> how ("lanczos" / the upscaler)"""
    png = Path(op["frame"])
    w, h = int(op["width"]), int(op["height"])
    up = str(op.get("upscaler") or "")
    if up and comfy and _tp is not None:
        tmp = png.with_name(".up_" + png.name)
        try:
            name = comfy["upload"](png)
            if up == _tp.SEEDVR2:
                sw, sh = _tp.png_size(png) or (w, h)
                g = _tp.graph_seedvr2(name, sw, sh, w, h, "bitgen_frameop/" + png.stem)
            else:
                g = _tp.graph(name, up, w, h, "bitgen_frameop/" + png.stem)
            save = _tp.save_node(g)
            outs = comfy["wait"](comfy["queue"](g)) or {}
            items = ((outs.get(save) or {}).get("images")) or []
            if not items:
                raise RuntimeError("the upscale returned no image")
            comfy["fetch"](items[0], tmp)
            rc = run_cmd(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-vf", f"scale={w}:{h}:flags=lanczos", str(png)])
            if rc != 0:
                raise RuntimeError("could not fit the upscaled frame to the size")
            say(f"[frame-op] the {'last' if op.get('op') == 'append' else 'first'} frame upscaled with "
                + ("SeedVR2" if up == _tp.SEEDVR2 else up) + f" to {w}x{h}")
            return up
        except Exception as e:          # noqa: BLE001 - lanczos never fails the render
            say(f"[frame-op] the ComfyUI upscale failed ({e}) - lanczos instead")
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass
    fit = png.with_name(".fit_" + png.name)
    rc = run_cmd(["ffmpeg", "-y", "-loglevel", "error", "-i", str(png), "-vf", f"scale={w}:{h}:flags=lanczos", str(fit)])
    if rc == 0 and fit.exists():
        fit.replace(png)
        say(f"[frame-op] the frame scaled to {w}x{h} (lanczos)")
    return "lanczos"


def join_cmd(op, part, out, pi, vi):
    """the ffmpeg command for the join (pure - tested): pi / vi = probe() of the part / the video"""
    W, H = vi["w"] or pi["w"], vi["h"] or pi["h"]
    fit = (f"scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,"
           f"setsar=1,fps={FPS},format=yuv420p")
    n = max(1, pi["frames"])
    rev = bool(op.get("reverse"))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(op["video"]), "-i", str(part)]
    fc = []
    if op["op"] == "append":
        fc.append(f"[0:v]{fit},setpts=PTS-STARTPTS[v0]")
        fc.append(f"[1:v]{fit},trim=start_frame=1,setpts=PTS-STARTPTS[v1]")
    else:
        fc.append(f"[1:v]{fit}" + (",reverse" if rev else "") + f",trim=end_frame={n - 1},setpts=PTS-STARTPTS[v1]")
        fc.append(f"[0:v]{fit},setpts=PTS-STARTPTS[v0]")
    pdur = max(0.0, (n - 1) / FPS)
    def silence(d):
        return f"anullsrc=r=48000:cl=stereo,atrim=duration={d:.6f}"
    # the video's sound (or silence), the part's sound trimmed like its picture (or silence - always for a reversed part)
    fc.append(("[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a0]" if vi["audio"]
               else silence(vi["dur"] or 0.04) + "[a0]"))
    if pi["audio"] and not rev:
        if op["op"] == "append":
            fc.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={1 / FPS:.6f},asetpts=PTS-STARTPTS[a1]")
        else:
            fc.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=end={pdur:.6f},asetpts=PTS-STARTPTS[a1]")
    else:
        fc.append(silence(pdur if op["op"] == "prepend" else max(0.04, (n - 1) / FPS)) + "[a1]")
    order = "[v0][a0][v1][a1]" if op["op"] == "append" else "[v1][a1][v0][a0]"
    fc.append(order + "concat=n=2:v=1:a=1[vo][ao]")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[vo]", "-map", "[ao]", "-r", str(FPS),
            "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)]
    return cmd


def join(op, part, out, say, run_cmd):
    """the part and the video -> out. Returns {frames, part_frames, video_frames}"""
    vi, pi = probe(op["video"]), probe(part)
    if not (vi["w"] and pi["w"]):
        raise RuntimeError("could not read the video or the new part")
    tmp = Path(out).with_name(".join_" + Path(out).name)
    rc = run_cmd(join_cmd(op, part, tmp, pi, vi))
    if rc != 0 or not tmp.exists():
        raise RuntimeError("ffmpeg could not join the new part to the video")
    shutil.move(str(tmp), str(out))
    jo = probe(out)
    say(f"[frame-op] {'appended' if op['op'] == 'append' else 'prepended'}: {Path(op['video']).name} ({vi['frames']} frames) "
        + ("+ " if op["op"] == "append" else "after ") + f"the new part ({pi['frames']} frames"
        + (", played backwards" if op.get("reverse") else "") + f") -> {jo['frames']} frames at {vi['w']}x{vi['h']}")
    return {"frames": jo["frames"], "part_frames": pi["frames"], "video_frames": vi["frames"]}
