"""bitGen Studio — the H3_Viggle video style (2.352.0).

Tim: "I have looks at the h3ref workflow, we should have a fl2va workflow too,
can we incorporate viggle into these worklows but make it a new viggle
workflow?"

H3_Viggle renders a scene the Viggle-Animate way, through ComfyUI: the scene's
MOTION VIDEO (its reference clip) drives the movement, and a picture says WHO
performs it:

  ref2va   comfy_workflows/H3_Viggle_ref2va.json - the character sheet /
           picture (the job's first reference picture)
  fl2va    comfy_workflows/H3_Viggle_fl2va.json  - the scene's first frame
           (its First picture, the frame it continues from, or a long clip's
           hand-off frame for chunk 2+)

worker.py's comfy_generate() sends a graph holding a ViggleAnimateConditioning
here instead of its H3 patcher (the prompt / references / H3 nodes do not
exist in a Viggle graph). This module:
  * picks the picture for the mode (refuses in words when there is none);
  * cuts the motion clip for THIS chunk - from its offset in the clip (chunk
    2+ carry on where chunk 1 stopped), at the render size (scale + centre
    crop), 24 fps, the length H3 renders (17n+5, at least 124 - shorter takes
    are trimmed back by the plan), the clip's last frame held when it ends
    first, its own audio kept;
  * fills the graph with scripts/viggle_graph.patch (seed, the Viggle sigmas,
    the DMD LoRA, the style's LoRAs chained after it, the output) and turns
    fp16 accumulation off (2.350.0: the likeliest black-take cause);
  * after the render: an all-black take is refused in words.

Pure except cut_motion (ffmpeg / ffprobe) and black (scripts/black_check.py).
"""
import subprocess
from pathlib import Path

import viggle_graph as VG

FPS = 24
STEPS = VG.STEPS                       # the 3-step DMD schedule
STYLE = "H3_Viggle"


def is_viggle(g):
    """A graph built around Viggle-Animate's conditioning node."""
    return isinstance(g, dict) and any(isinstance(v, dict) and v.get("class_type") == "ViggleAnimateConditioning"
                                       for v in g.values())


def render_frames(frames):
    """What H3 renders for a chunk of `frames` (17n+5, 124..362)."""
    return min(VG.MAX_FRAMES, VG.align_frames(frames))


def picture_for(seg_mode, refs, first_frame):
    """-> (path, words) of the picture whose character performs the motion; ValueError in words."""
    refs = [str(r) for r in (refs or []) if r]
    if seg_mode == "fl2va":
        pic = first_frame or (refs[0] if refs else None)
        if not pic:
            raise ValueError("H3_Viggle fl2va needs the scene's first frame (its First picture, or the frame it "
                             "continues from) - its character performs the motion video")
        return str(pic), "the first frame " + Path(str(pic)).name
    if not refs:
        raise ValueError("H3_Viggle ref2va needs a character sheet or picture - the character who performs the "
                         "motion video (a cast sheet, a scene picture, or a reference picture)")
    extra = f" (Viggle takes ONE picture - {len(refs) - 1} more reference(s) left out)" if len(refs) > 1 else ""
    return refs[0], "the picture " + Path(refs[0]).name + extra


def probe_seconds(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, timeout=60).stdout.strip()
        return float(out)
    except Exception:                                     # noqa: BLE001
        return 0.0


def cut_motion(src, offset, frames, width, height, out):
    """The motion clip for one chunk: from frame `offset`, `frames` long at 24 fps,
    width x height (scaled to cover + centre crop), the last frame held if the
    clip ends first, its audio (silence padded). -> (path, words); RuntimeError."""
    src, out = Path(str(src)), Path(str(out))
    if not src.exists():
        raise RuntimeError(f"the motion video {src.name} is gone - choose it again on the scene (🎬 Motion)")
    secs = probe_seconds(src)
    start = offset / FPS
    if secs and start >= secs:
        raise RuntimeError(f"the motion video {src.name} is {secs:.2f} s - this part of the scene starts at "
                           f"{start:.2f} s, past its end (use a longer clip or a shorter scene)")
    dur = frames / FPS
    vf = (f"fps={FPS},scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
          f"setsar=1,tpad=stop_mode=clone:stop=-1")
    argv = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(src), "-vf", vf,
            "-af", "apad", "-t", f"{dur:.4f}", "-frames:v", str(frames), "-c:v", "libx264", "-crf", "12",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", str(out)]
    r = subprocess.run(argv, capture_output=True, text=True)
    if r.returncode != 0 or not out.exists():
        # a clip with no audio track: -af apad has nothing to pad
        argv2 = [a for a in argv if a not in ("-af", "apad", "-c:a", "aac", "-ar", "48000")]
        r = subprocess.run(argv2, capture_output=True, text=True)
        if r.returncode != 0 or not out.exists():
            raise RuntimeError(f"could not cut the motion video {src.name}: {(r.stderr or '').strip()[-300:]}")
    held = secs and start + dur > secs + 1e-3
    words = (f"motion {src.name} from {start:.2f} s, {frames} frames at {width}x{height}"
             + (f" (the clip ends at {secs:.2f} s - its last frame is held)" if held else ""))
    return out, words


def prepare(g, o, upload):
    """o = {seg_mode, refs, first_frame, motion, offset, frames, width, height,
    seed, steps, loras:[{path, weight}], workdir, prefix}. upload(path) -> the
    name ComfyUI knows it by. -> (graph, render_frames, notes); ValueError /
    RuntimeError in words."""
    if not o.get("motion"):
        raise ValueError("H3_Viggle needs the scene's motion video - the clip whose movement the character "
                         "performs (🎬 Motion on the scene card, or a video in the reference dock)")
    pic, pic_words = picture_for(o.get("seg_mode"), o.get("refs"), o.get("first_frame"))
    n = render_frames(o["frames"])
    w, h = int(o["width"]), int(o["height"])
    if w % 32 or h % 32:
        raise ValueError(f"H3 renders sizes in multiples of 32 - {w}x{h} is not")
    wd = Path(str(o.get("workdir") or "."))
    clip, clip_words = cut_motion(o["motion"], int(o.get("offset") or 0), n, w, h,
                                  wd / f"motion_{int(o.get('offset') or 0):06d}.mp4")
    loras = [{"name": str(x.get("path") or x.get("name") or "").strip(), "weight": float(x.get("weight", 1.0))}
             for x in (o.get("loras") or []) if isinstance(x, dict) and (x.get("path") or x.get("name"))]
    g2, notes = VG.patch(g, {"image": upload(pic), "video": upload(clip), "width": w, "height": h, "frames": n,
                             "seed": o.get("seed") or 0, "steps": o.get("steps") or STEPS, "loras": loras,
                             "prefix": o.get("prefix") or "bitgen_h3viggle"})
    if VG.fp16_accumulation(g2, False):
        notes.append("fp16 accumulation off (it can turn a Viggle take black)")
    head = [f"H3_Viggle {o.get('seg_mode')}: {pic_words} performs the {clip_words}"]
    if n != int(o["frames"]):
        head.append(f"rendered as {n} frames (H3 makes 17n+5, Viggle at least 124) - the plan trims the take to "
                    f"{int(o['frames'])}" if n > int(o["frames"]) else f"capped at {n} frames")
    return g2, n, head + notes


def black(path):
    """True when the take is all black (scripts/black_check.py; False when it cannot tell)."""
    try:
        import black_check as BC
        return bool(BC.all_black(Path(str(path))))
    except Exception:                                    # noqa: BLE001
        return False


BLACK_WORDS = ("the H3_Viggle render came back ALL BLACK - ComfyUI's Viggle model produced no picture. "
               "Try again with another seed; if it stays black, update the Viggle nodes and the H3 VAE "
               "(a full-precision minimax_h3_video_vae instead of the int8 one) in ComfyUI")
