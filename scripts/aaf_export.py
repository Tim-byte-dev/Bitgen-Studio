#!/usr/bin/env python3
"""bitGen Studio — AAF (2.417.0): the timeline for Avid Media Composer and Pro Tools (Premiere's "AAF" export).

Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".

    python3 aaf_export.py <out.aaf>   (the job as JSON on stdin)
      {"name", "fps", "tc_start" (frames), "video": [{"name", "items": [{"path", "start", "len", "in"}]}],
       "audio": [{"name", "items": [...]}]}       start / len / in in FRAMES at fps
    -> JSON {"ok", "file", "video_tracks", "audio_tracks", "clips", "notes"}

pyaaf2 (pure Python - requirements.txt) writes it: every file LINKED (AMA - not copied in: the AAF stays small, the
media stays where it is), a composition with a timecode track, one picture track per video layer (V1 first) and the
sound as MONO tracks - a stereo file's two channels on two tracks, the way Avid and Pro Tools lay them out. Gaps are
fillers. A sped-up / reversed clip goes as the stretch it covers (its speed is said in the notes, not written as an
effect); opacity, volume, moves and the grade are not carried.
"""
import json
import subprocess
import sys
from fractions import Fraction

import aaf2


def _secs(v):
    try:
        if isinstance(v, str) and ":" in v:
            h, m, x = v.split(":")
            return int(h) * 3600 + int(m) * 60 + float(x)
        return float(v)
    except (TypeError, ValueError):
        return None


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", path], capture_output=True, text=True)
    m = json.loads(r.stdout or "{}")
    # a Matroska / WebM stream has no duration of its own (only a DURATION tag) - pyaaf2 needs one per stream
    fd = _secs((m.get("format") or {}).get("duration"))
    for st in m.get("streams") or []:
        if _secs(st.get("duration")) is None:
            d = _secs({k.upper(): v for k, v in (st.get("tags") or {}).items()}.get("DURATION")) or fd
            if d:
                st["duration"] = f"{d:.6f}"
                if st.get("codec_type") == "audio" and st.get("sample_rate"):
                    st["duration_ts"] = int(round(d * int(st["sample_rate"])))
        if st.get("codec_type") == "audio" and not str(st.get("bit_rate") or "").isdigit():
            st["bit_rate"] = str(int(st.get("sample_rate") or 48000) * int(st.get("channels") or 2) * 16)   # Opus / Vorbis say none
        if st.get("codec_type") == "video" and not str(st.get("nb_frames") or "").isdigit():
            try:
                a, b = str(st.get("avg_frame_rate") or st.get("r_frame_rate") or "25/1").split("/")
                st["nb_frames"] = str(int(round(_secs(st.get("duration")) * float(a) / float(b or 1))))
            except (TypeError, ValueError, ZeroDivisionError):
                st["nb_frames"] = "1"
    return m


# pyaaf2 links WAV, AIFF and the QuickTime family (.mov / .mp4 / .m4a); anything else (WebM, MKV, MP3, FLAC) is linked
# the same generic way - the AAF holds its path and its streams; Avid / Pro Tools may want it as a .mov / .mxf to play
LINKS_AS_IS = ("wav", "aiff")
def linkable(meta):
    f = meta.get("format") or {}
    return f.get("format_name") in LINKS_AS_IS or f.get("format_long_name") == "QuickTime / MOV"


def rate_of(fps):
    f = float(fps or 25)
    if abs(f - round(f)) > 0.001:                     # NTSC: 29.97 = 30000/1001
        return Fraction(round(f) * 1000, 1001)
    return Fraction(int(round(f)), 1)


def main(out, job):
    fps = rate_of(job.get("fps"))
    notes, n_clips = [], 0
    with aaf2.open(out, "w") as f:
        masters = {}

        def master(path):
            if path in masters:
                return masters[path]
            meta = probe(path)
            if not linkable(meta):
                meta["format"] = dict(meta.get("format") or {}, format_long_name="QuickTime / MOV")
                notes.append(f"{path.replace(chr(92), '/').split('/')[-1]}: linked as it is - Avid / Pro Tools may want it as a .mov / .mxf (relink)")
            got = f.content.create_ama_link(path, meta)
            if not got:
                raise SystemExit("cannot link " + path)
            mm = got[0]
            pic = [s.slot_id for s in mm.slots if s.media_kind == "Picture"]
            snd = [s.slot_id for s in mm.slots if s.media_kind == "Sound"]
            masters[path] = (mm, pic, snd)
            return masters[path]

        comp = f.create.CompositionMob(job.get("name") or "bitGen timeline")
        comp.usage = "Usage_TopLevel"
        f.content.mobs.append(comp)
        end = 0
        for T in (job.get("video") or []) + (job.get("audio") or []):
            for it in T.get("items") or []:
                end = max(end, int(it["start"]) + int(it["len"]))
        # the start timecode
        tc = f.create.Timecode(int(round(float(fps))), drop=False)
        tc.start = int(job.get("tc_start") or 0)
        tc.length = max(1, end)
        tslot = comp.create_timeline_slot(edit_rate=fps)
        tslot.segment = tc

        def track(T, kind, channel=None):
            nonlocal n_clips
            slot = comp.create_timeline_slot(edit_rate=fps)
            seq = f.create.Sequence(media_kind=kind)
            slot.segment = seq
            cur = 0
            for it in sorted(T.get("items") or [], key=lambda x: int(x["start"])):
                st, ln = int(it["start"]), max(1, int(it["len"]))
                if st < cur:
                    notes.append(f"{it.get('name') or it['path']}: overlaps on its layer - left out of the AAF track")
                    continue
                mm, pic, snd = master(it["path"])
                ids = pic if kind == "picture" else snd
                if not ids:
                    if st > cur:
                        seq.components.append(f.create.Filler(kind, st - cur))
                    seq.components.append(f.create.Filler(kind, ln))
                    cur = st + ln
                    continue
                sid = ids[0] if kind == "picture" else ids[min(channel or 0, len(ids) - 1)]
                if st > cur:
                    seq.components.append(f.create.Filler(kind, st - cur))
                # StartTime is in the edit units of the clip's CONTEXT (the timeline's frames - AAF object spec), not the
                # source track's 44100 - Avid / Pro Tools / OTIO all read it so
                clip = mm.create_source_clip(slot_id=sid, start=int(it.get("in") or 0), length=ln, media_kind=kind)
                seq.components.append(clip)
                n_clips += 1
                cur = st + ln
                if it.get("speed") and abs(float(it["speed"]) - 1) > 1e-3:
                    notes.append(f"{it.get('name')}: {float(it['speed']):g}x - carried as the stretch it covers (no speed effect)")
                if it.get("reverse"):
                    notes.append(f"{it.get('name')}: reversed - carried forwards")
            if end > cur:
                seq.components.append(f.create.Filler(kind, end - cur))
            slot.name = T.get("name") or ""
            return slot

        nv = na = 0
        for T in job.get("video") or []:
            if T.get("items"):
                track(T, "picture")
                nv += 1
        for T in job.get("audio") or []:
            if not T.get("items"):
                continue
            chans = 1
            for it in T["items"]:
                _mm, _p, snd = master(it["path"])
                chans = max(chans, min(2, len(snd)))
            for ch in range(chans):
                track(dict(T, name=(T.get("name") or "A") + (" L" if chans == 2 and ch == 0 else " R" if chans == 2 else "")), "sound", ch)
                na += 1
    return {"ok": True, "file": out, "video_tracks": nv, "audio_tracks": na, "clips": n_clips, "notes": sorted(set(notes))}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: aaf_export.py <out.aaf>  (the job as JSON on stdin)")
    sys.stdout.write(json.dumps(main(sys.argv[1], json.loads(sys.stdin.read() or "{}"))))
