#!/usr/bin/env python3
"""THE one place the compiled movie's total length is decided (2.63.0).

WHY THIS FILE EXISTS
--------------------
Before 2.63.0 the compile ended at the end of the BASE video track (V1) and
nowhere else, because of two ffmpeg defaults that both quietly mean "however
long input 0 is":

  * the composite pass fed the joined V1 track in as ffmpeg input 0 and
    overlaid everything else onto it, so `overlay` produced exactly as many
    frames as the base had;
  * the audio mix used `amix=duration=first`, i.e. as long as the first
    stream in the mix, which was the base track's own audio.

So a V2 clip, an image or a soundtrack that ran PAST the last frame of V1 was
truncated without a word in the log. The fix is to work out how long the
timeline actually is, pad the base track with black + silence up to it, and
cap the output there. That arithmetic lives here so the worker, the route and
the tests all answer the question the same way.

MIRROR: `lib/timelineSpan.js` is the Node twin of this module and MUST stay in
step with it — `scripts/test-span.py` and `scripts/test-timeline.js` run the
same case table against the two. If you change a rule here, change it there.

THE RULE: a clip occupies `start` .. `start + (out - in)`. `out` is the trim
point the user dragged; when it is absent the clip runs to the end of its
source file, whose length arrives as `dur` from the UI or is probed from disk
by the caller.

AN UNKNOWN LENGTH CONTRIBUTES NOTHING. When a clip carries no `out`, no `dur`
and no probe answers for it, it is SKIPPED rather than assumed to be some
default number of seconds. The UI's effDur() does guess 5s in that case, and
copying that guess here cost a full e2e cycle: /api/export sees no `dur` on an
untrimmed clip, so every such compile invented a 5-second timeline and the
worker faithfully padded a 2-second video with 3 seconds of black. Guessing
can only ever add footage that is not there. Skipping can only ever fall back
to `base_dur` in compile_span(), i.e. to the video that was actually rendered.
When in doubt, be short and real rather than long and black.
"""

# `len` is authoritative for an image and always present, so this only covers a
# malformed track. Video clips have NO equivalent: see the doctrine above.
FALLBACK_IMAGE_SECONDS = 3.0
MIN_CLIP_SECONDS = 0.1


def _num(v):
    """The value as a finite float, or None when there isn't one.

    None rather than 0.0 matters: `out` and `dur` are tested for PRESENCE, and
    a garbage value that read as 0.0 would look like a trim to zero length and
    silently shrink the clip to MIN_CLIP_SECONDS. Absent means "fall through
    to the next source of truth", which is what a garbage value should do.
    """
    if v is None or v is False or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def _f(v, default=0.0):
    """float() that never raises — timelines arrive from JSON and from users."""
    n = _num(v)
    return default if n is None else n


def track_clips(track):
    """Flatten either track shape into a plain list of clips.

    A track is `{clips, transition_in, transition_out}` from 2.60.0 on and a
    bare list of clips in anything older. Saved projects still hold the old
    shape, so BOTH are accepted here exactly as mark_track() accepts them in
    worker.py and trackOf() does in routes/index.js.
    """
    if isinstance(track, list):
        return [c for c in track if isinstance(c, dict)]
    if isinstance(track, dict):
        return [c for c in (track.get("clips") or []) if isinstance(c, dict)]
    return []


def clip_length(c, probe=None):
    """Seconds of this clip that play after its in/out trim, or None if unknown."""
    tl = _num(c.get("tl_len"))          # 2.406.0: a retimed clip covers its timeline length (lib/clipFx.forJob)
    if tl is not None and tl > 0:
        return max(MIN_CLIP_SECONDS, tl)
    cin = _f(c.get("in"), 0.0)
    end = _num(c.get("out"))
    if end is None:
        end = _num(c.get("dur"))
    if end is None and probe:
        try:
            end = _num(probe(c.get("path") or c.get("name")))
        except Exception:                # noqa: BLE001 - a bad probe is not fatal
            end = None
    if end is None or end <= 0:
        return None                      # unmeasurable: contributes nothing
    return max(MIN_CLIP_SECONDS, end - cin)


def clip_end(c, probe=None):
    """The absolute second this clip stops covering the timeline, or None."""
    ln = clip_length(c, probe=probe)
    return None if ln is None else _f(c.get("start"), 0.0) + ln


def image_end(c):
    """A still occupies `len` seconds from its start; it has no in/out trim."""
    ln = _num(c.get("len"))
    if ln is None or ln <= 0:
        ln = FALLBACK_IMAGE_SECONDS
    return _f(c.get("start"), 0.0) + max(MIN_CLIP_SECONDS, ln)


def scene_end(tl, probe=None):
    """The last second of the WHOLE timeline — every layer, not just V1.

    `probe` is an optional callable taking a path and returning the source
    file's duration in seconds; it is consulted only for a clip carrying
    neither `out` nor `dur`. With no probe such a clip is skipped entirely
    (see the doctrine at the top of this file) — the route has no ffprobe and
    deliberately hints short rather than long.
    """
    if not isinstance(tl, dict):
        return 0.0
    ends = [0.0]

    def add(v):
        if v is not None:
            ends.append(v)

    for c in track_clips(tl.get("video")):
        add(clip_end(c, probe=probe))
    for L in (tl.get("video_layers") or []):
        for c in track_clips(L if isinstance(L, list) else (L or {}).get("clips")):
            add(clip_end(c, probe=probe))
    for track in (tl.get("audio") or []):
        for c in track_clips(track):
            add(clip_end(c, probe=probe))
    for track in (tl.get("images") or []):
        for c in track_clips(track):
            add(image_end(c))
    return max(ends)


def compile_span(tl, base_dur=0.0, probe=None, hint=None):
    """The length the compiled movie must be.

    Three candidates, and the longest wins, because every one of them is a
    floor rather than a target:
      * `hint` — `timeline.scene_end`, stamped on the job by routes/index.js
        where the UI's own `dur` for each clip is still known;
      * the span computed here from the timeline the worker received;
      * `base_dur` — the joined V1 track as actually rendered. Never return
        less than this or the cap would throw away footage that exists.
    """
    return max(_f(base_dur, 0.0), _f(hint, 0.0), scene_end(tl, probe=probe))


def pad_needed(span, base_dur, eps=0.04):
    """Seconds of black/silence to append to V1, or 0.0 when it already fits.

    `eps` is one frame at 24 fps rounded up: padding by less than a frame
    costs an extra encode and changes nothing visible.
    """
    pad = _f(span, 0.0) - _f(base_dur, 0.0)
    return pad if pad > eps else 0.0
