#!/usr/bin/env python3
"""bitGen Studio — scripts/song_tags.py (2.922.0): a finished song carries its OWN details in its tags.

Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and name
from the meta tags?"

The music worker (misc/music_worker.py) calls tag() on every song it writes - after the mp3 / wav conversion - so the file
itself says what it is, wherever it is copied to:

    title     the song's title                      (ID3 TIT2, FLAC TITLE, WAV INAM)
    lyrics    the lyrics                            (ID3 USLT, FLAC LYRICS - what music players show)
    comment   "Made with bitGen Studio - <style>, seed N" (WAV: + the details below, its only free-text field)
    date      the year
    bitgen    the details as JSON - title, lyrics, caption, style_id, style_name, dur, seed, format, bpm, keyscale,
              timesig, language, made_at, index (ID3 TXXX:bitgen, FLAC BITGEN; WAV keeps no custom tags, so the JSON
              rides its comment after "bitgen:")

ComfyUI's own "prompt" / "workflow" tags (the graph its SaveAudio writes) are kept (-map_metadata 0). The audio is copied,
never re-encoded. Any ffmpeg trouble leaves the song as it was - a song without tags beats no song. lib/songTags.js reads
all of this back for the Audio docker's 🎶 Song tab.
"""
import json
import subprocess
import time
from pathlib import Path

KEYS = ("title", "lyrics", "caption", "style_id", "style_name", "dur", "seed", "format",
        "bpm", "keyscale", "timesig", "language")


def details(params, style, seed, index=0, fmt=""):
    """The song's details from the job (pure). Only what is known - blanks are left out."""
    p, st = params or {}, style or {}
    d = {
        "v": 1,
        "title": str(p.get("title") or "").strip(),
        "lyrics": str(p.get("prompt") or ""),
        "caption": str(st.get("caption") or ""),
        "style_id": str(p.get("style_id") or st.get("id") or ""),
        "style_name": str(p.get("style_name") or st.get("name") or ""),
        "dur": p.get("max_duration", st.get("max_duration")),
        "seed": seed,
        "format": str(fmt or p.get("audio_format") or "flac").lower().lstrip("."),
        "bpm": st.get("bpm"), "keyscale": st.get("keyscale"), "timesig": st.get("timesig"), "language": st.get("language"),
        "made_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "made_by": "bitGen Studio",
    }
    if index:
        d["index"] = int(index)                      # the 2nd / 3rd … song of one press (one seed, one batch)
    return {k: v for k, v in d.items() if v not in (None, "")}


def tag_args(d, ext):
    """ffmpeg -metadata arguments for a song's details (pure)."""
    ext = str(ext or "").lower().lstrip(".")
    blob = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    note = "Made with bitGen Studio" + (" - " + d["style_name"] if d.get("style_name") else "") \
        + (", seed " + str(d["seed"]) if d.get("seed") not in (None, "") else "")
    tags = {"comment": note, "date": str(d.get("made_at", ""))[:4]}
    if d.get("title"):
        tags["title"] = d["title"]
    if ext == "wav":
        tags["comment"] = note + "\nbitgen:" + blob          # RIFF INFO has no custom tags: the JSON rides ICMT
    else:
        if d.get("lyrics"):
            tags["lyrics"] = d["lyrics"]
        tags["bitgen"] = blob
    args = []
    for k, v in tags.items():
        if v:
            args += ["-metadata", f"{k}={v}"]
    return args


def tag(path, d, say=lambda s: None):
    """Write the details into the song (a copy of the audio, then renamed over it). True when written."""
    p = Path(path)
    ext = p.suffix.lower().lstrip(".")
    if ext not in ("flac", "mp3", "wav", "ogg", "opus", "m4a"):
        return False
    tmp = p.with_name(p.stem + ".tagging" + p.suffix)
    extra = ["-id3v2_version", "3"] if ext == "mp3" else []
    try:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(p), "-map", "0", "-map_metadata", "0",
                            "-c", "copy", *extra, *tag_args(d, ext), str(tmp)],
                           capture_output=True, text=True, timeout=300)
        if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size == 0:
            say("[worker] the song's tags were not written (" + (r.stderr or "").strip()[:160] + ") - the song is untouched")
            tmp.unlink(missing_ok=True)
            return False
        tmp.replace(p)
        say(f"[worker] tagged {p.name}: title, lyrics and the song's details (the Song tab reads them back)")
        return True
    except (OSError, subprocess.TimeoutExpired) as e:
        say(f"[worker] the song's tags were not written ({e}) - the song is untouched")
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False
