"""bitGen Studio — LOSSLESS SCENE MASTERS (2.301.0).

Tim (verbatim): "why am i losing quality with each scene rendered with a
first/last image" -> "can we do the encode as avi instead of mp4, no
compression?" -> "we create 2 separate files, 1 raw files and 1 mp4 to
playback. quality will be more important than diskspace at this stage. user
can delete raw files on project completion if they want to. save the raw
renders in project name\\raw".

WHY. A scene's take used to be compressed TWICE before the next scene
started from one of its frames: ComfyUI's SaveVideo wrote H.264 at its own
default, then the worker decoded that and wrote H.264 again (CRF 20), both
at 4:2:0 chroma. The first/last frame the next scene started from was a
lossless PNG of that twice-compressed picture, the model baked the damage
in, and the chain compounded it scene after scene.

WHAT. The graph gets two lossless TAPS beside its video save: PreviewImage
on the decoded frames (PNG, ComfyUI's temp folder - cleared when ComfyUI
restarts, so nothing piles up in its output folder) and PreviewAudio on the
clip's audio (FLAC). The worker downloads both and builds the scene's
MASTER: FFV1 (a lossless codec - every pixel identical to what the VAE
decoded), full RGB (bgr0, no chroma subsampling), every frame a keyframe
(frame-exact seeks and trims by stream copy), PCM 24-bit audio, in an
.avi. The playback .mp4 is encoded ONCE from that master. The next scene's
first/last frame, the chunk hand-off inside a long job and the movie
compile all read the master. Masters live in projects/<project>/raw/ under
the take's own stem (<take>.avi) - lib/rawMaster.js finds them the same way.

Pure helpers: graph edits and ffmpeg argument lists; the worker runs them.
"""
from pathlib import Path

TAP_IMG = "bgraw_frames"
TAP_AUD = "bgraw_audio"
_VIDEO_JOINERS = ("CreateVideo", "VHS_VideoCombine")


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def add_taps(g):
    """Add the lossless taps to an API graph. Returns (graph, note, fps).
    The tap hangs off the video joiner that FEEDS A SAVE node (the take the
    worker keeps), else the first joiner; no joiner = no tap (said)."""
    if not isinstance(g, dict):
        return g, "no graph to tap", None
    joiners = [(k, v) for k, v in g.items()
               if isinstance(v, dict) and v.get("class_type") in _VIDEO_JOINERS]
    if not joiners:
        return g, ("this workflow has no CreateVideo / VHS_VideoCombine node to tap - "
                   "the take stays mp4-only (no lossless master)"), None
    def feeds_save(jid):
        for v in g.values():
            if not isinstance(v, dict):
                continue
            if "save" not in str(v.get("class_type", "")).lower():
                continue
            for x in (v.get("inputs") or {}).values():
                if _is_link(x) and str(x[0]) == str(jid):
                    return True
        # VHS_VideoCombine saves by itself
        return str((g.get(str(jid)) or {}).get("class_type")) == "VHS_VideoCombine"
    jid, jn = next(((k, v) for k, v in joiners if feeds_save(k)), joiners[0])
    ins = jn.get("inputs") or {}
    img = ins.get("images")
    if not _is_link(img):
        return g, f"node {jid} ({jn.get('class_type')}) has no linked images - no lossless master", None
    g = dict(g)
    g[TAP_IMG] = {"class_type": "PreviewImage", "inputs": {"images": list(img)},
                  "_meta": {"title": "bitGen lossless frames (PNG)"}}
    aud = ins.get("audio")
    if _is_link(aud):
        g[TAP_AUD] = {"class_type": "PreviewAudio", "inputs": {"audio": list(aud)},
                      "_meta": {"title": "bitGen lossless audio (FLAC)"}}
    fps = ins.get("fps", ins.get("frame_rate"))
    try:
        fps = float(fps)
    except (TypeError, ValueError):
        fps = None
    return g, (f"lossless master tap on node {jid} ({jn.get('class_type')}): PNG frames"
               + (" + FLAC audio" if _is_link(aud) else " (no audio link)")), fps


def tap_outputs(outputs):
    """(frame items in batch order, audio item or None) from ComfyUI's
    /history outputs - empty when the taps did not run."""
    o = outputs or {}
    frames = list(((o.get(TAP_IMG) or {}).get("images")) or [])
    aud = list(((o.get(TAP_AUD) or {}).get("audio")) or [])
    return frames, (aud[0] if aud else None)


def ffv1_args():
    """Lossless, full RGB, all-intra (frame-exact seeks / stream-copy trims)."""
    return ["-c:v", "ffv1", "-level", "3", "-g", "1", "-slices", "16",
            "-slicecrc", "1", "-pix_fmt", "bgr0"]


def pcm_args():
    return ["-c:a", "pcm_s24le"]


def master_cmd(frame_pattern, audio, out_avi, fps=24):
    """PNG sequence (+ FLAC) -> the FFV1 .avi master."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{fps:g}",
           "-i", str(frame_pattern)]
    if audio:
        cmd += ["-i", str(audio), "-map", "0:v", "-map", "1:a"]
    cmd += ffv1_args() + (pcm_args() if audio else ["-an"]) + [str(out_avi)]
    return cmd


def playback_cmd(master, out_path, enc):
    """The ONE lossy encode: master -> playback file (enc = the worker's
    per-format codec args)."""
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(master)] + list(enc) + [str(out_path)]


def join_cmd(masters, out_avi, fps=24, limit_frames=None, has_audio=True):
    """Chunks -> one master, dropping the seam-duplicate first frame (and
    1/fps s of audio) of chunks 2+ exactly as the playback join does, and
    capping to the exact length - losslessly."""
    n = len(masters)
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for m in masters:
        cmd += ["-i", str(m)]
    v, a, pairs = [], [], []
    for k in range(n):
        v.append(f"[{k}:v]" + ("" if k == 0 else "trim=start_frame=1,") + f"setpts=PTS-STARTPTS[v{k}]")
        if has_audio:
            a.append(f"[{k}:a]" + ("" if k == 0 else f"atrim=start={1 / fps:.6f},")
                     + f"asetpts=PTS-STARTPTS[a{k}]")
        pairs.append(f"[v{k}]" + (f"[a{k}]" if has_audio else ""))
    fc = ";".join(v + a) + ";" + "".join(pairs) + \
        f"concat=n={n}:v=1:a={1 if has_audio else 0}[vo]" + ("[ao]" if has_audio else "")
    cmd += ["-filter_complex", fc, "-map", "[vo]"] + (["-map", "[ao]"] if has_audio else [])
    if limit_frames:
        cmd += ["-frames:v", str(int(limit_frames)), "-t", f"{int(limit_frames) / fps:.6f}"]
    cmd += ffv1_args() + (pcm_args() if has_audio else ["-an"]) + [str(out_avi)]
    return cmd


def master_name(take_name):
    """The master's file name for a take: <take stem>.avi."""
    return Path(str(take_name)).stem + ".avi"
