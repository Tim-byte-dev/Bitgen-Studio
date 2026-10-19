#!/usr/bin/env python3
"""Transitions: the ffmpeg side.

Reads lib/transitions.json — the SAME file lib/transitions.js serves to the UI —
so the dropdown and the renderer cannot disagree about what exists.

The interesting part is xfade's offset arithmetic. xfade OVERLAPS the two
inputs: the output of joining N clips with a d-second transition is

    sum(durations) - (N - 1) * d

and each offset is measured on the *running joined* timeline, not on the
original clips. Getting that wrong does not error — it silently produces a
video of the wrong length with clips landing early, which is exactly the kind
of bug that is painful to spot in a preview. build_xfade_chain() is therefore
pure string-building with no ffmpeg dependency, so it can be unit-tested.
"""
import json
import os
import sys

CATALOGUE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "lib", "transitions.json")
_cache = None


def catalogue():
    global _cache
    if _cache is None:
        with open(os.path.normpath(CATALOGUE), "r", encoding="utf-8") as fh:
            _cache = json.load(fh)
    return _cache


def by_id(tid):
    for t in catalogue()["transitions"]:
        if t["id"] == tid:
            return t
    return None


def normalize(t):
    """Mirror of lib/transitions.js normalize(): unknown ids degrade to a cut."""
    c = catalogue()
    raw = t if isinstance(t, dict) else {}
    hit = by_id(str(raw.get("type") or "none"))
    try:
        d = float(raw.get("dur"))
    except (TypeError, ValueError):
        d = c["default_duration"]
    if not (d > 0):
        d = c["default_duration"]
    return {"type": hit["id"] if hit else "none",
            "dur": min(c["max_duration"], max(c["min_duration"], d))}


def is_active(t):
    n = normalize(t)
    hit = by_id(n["type"])
    return bool(hit and hit.get("xfade"))


def clamp_duration(durations, d):
    """A transition cannot be longer than the shorter of the two clips it joins,
    or ffmpeg produces a black hole where the overlap ran past the end. Half the
    shortest clip is the safe ceiling."""
    if not durations:
        return d
    return max(catalogue()["min_duration"], min(d, min(durations) / 2.0))


def build_xfade_chain(n, durations, xfade, d, fps=24, audio=False):
    """filter_complex for joining n inputs with xfade (and acrossfade).

    Returns (filter_complex, out_labels). Offsets accumulate on the JOINED
    timeline: after k joins the running length is sum(durations[:k+1]) - k*d,
    and the next transition starts d seconds before the end of that.
    """
    if n < 2:
        raise ValueError("build_xfade_chain needs at least 2 inputs")
    if len(durations) != n:
        raise ValueError(f"got {len(durations)} durations for {n} inputs")
    d = clamp_duration(durations, d)

    parts, vprev, aprev = [], None, None
    for i in range(n):
        parts.append(f"[{i}:v]settb=AVTB,fps={fps},format=yuva420p[v{i}]")
    running = durations[0]
    vprev = "[v0]"
    for i in range(1, n):
        off = running - d
        lab = f"[vx{i}]" if i < n - 1 else "[vo]"
        parts.append(f"{vprev}[v{i}]xfade=transition={xfade}:duration={d:.3f}"
                     f":offset={max(0.0, off):.3f}{lab}")
        vprev = lab
        running = running + durations[i] - d

    if audio:
        aprev = "[0:a]"
        for i in range(1, n):
            lab = f"[ax{i}]" if i < n - 1 else "[ao]"
            parts.append(f"{aprev}[{i}:a]acrossfade=d={d:.3f}:c1=tri:c2=tri{lab}")
            aprev = lab
    return ";".join(parts), (["[vo]", "[ao]"] if audio else ["[vo]"])


def joined_length(durations, d):
    """What build_xfade_chain will produce. Used by the worker to log the
    length change, because a shorter export is the expected result of adding
    transitions and looks like a bug otherwise."""
    if len(durations) < 2:
        return sum(durations)
    d = clamp_duration(durations, d)
    return sum(durations) - (len(durations) - 1) * d


def fade_color(tid):
    """Which colour a boundary fade dips through.

    Only the dip-to-white transition is white; everything else dips through
    black. (Overlay layers ignore this and ramp alpha instead — there is
    nothing behind them to dip *to*.)"""
    return "white" if tid == "fadewhite" else "black"


def fade_span(t, length=None):
    """The clamped duration of a boundary fade, or 0.0 when it is a cut.

    A fade longer than half its layer would still be ramping when the layer
    ends, so it is clamped the same way clamp_duration() clamps a join."""
    if not is_active(t):
        return 0.0
    d = normalize(t)["dur"]
    if length and length > 0:
        d = max(catalogue()["min_duration"], min(d, float(length) / 2.0))
    return d


def fade_filter(t, where, at, length=None, alpha=False, audio=False):
    """One ffmpeg fade fragment for a LAYER BOUNDARY, or "" for a cut.

    `where` is "in" or "out"; `at` is the absolute timeline second the layer
    starts (in) or ends (out). Fragments are returned rather than whole
    commands so the caller can splice them into an existing filter chain.

    Why every transition becomes a fade here: xfade wipes, slides and shapes
    need TWO pictures to move between. A layer boundary has only one — there
    is no outgoing clip to wipe away from at the moment a layer begins. So a
    boundary renders the only thing that is meaningful with one picture, a
    dissolve, and the wipe still applies where the same layer's clips MEET
    (join_v1 / build_xfade_chain). This is deliberate, not a fallback.
    """
    if where not in ("in", "out"):
        raise ValueError("fade direction must be 'in' or 'out', got %r" % (where,))
    d = fade_span(t, length)
    if d <= 0:
        return ""
    at = float(at)
    st = at if where == "in" else max(0.0, at - d)
    if audio:
        return "afade=t=%s:st=%.3f:d=%.3f" % (where, st, d)
    bits = ["fade=t=%s" % where, "st=%.3f" % st, "d=%.3f" % d]
    # An overlay ramps its own alpha; a full-frame track dips through a colour.
    bits.append("alpha=1" if alpha else "c=%s" % fade_color(normalize(t)["type"]))
    return ":".join(bits)


def ffmpeg_args(inputs, durations, transition, out, fps=24, audio=True):
    """A complete ffmpeg argv for joining `inputs` with `transition`."""
    n = normalize(transition)
    hit = by_id(n["type"])
    if not hit or not hit.get("xfade"):
        raise ValueError(f"{n['type']} is a cut, not a transition — use concat")
    fc, labs = build_xfade_chain(len(inputs), durations, hit["xfade"],
                                 n["dur"], fps=fps, audio=audio)
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for p in inputs:
        cmd += ["-i", str(p)]
    cmd += ["-filter_complex", fc]
    for l in labs:
        cmd += ["-map", l]
    cmd += ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-r", str(fps)]
    if audio:
        cmd += ["-c:a", "libopus"]
    cmd += [str(out)]
    return cmd


if __name__ == "__main__":
    print(json.dumps({"transitions": catalogue()["transitions"]}, indent=2))
    sys.exit(0)


# ---------------- 2.415.0: a LAYER BOUNDARY drawn as its SHAPE (Tim: "lets do the medium jobs now" - a transitions
# library beyond the layer fades). fade_filter() above explains why a boundary used to be a dissolve: there is no
# outgoing picture. The answer: the clip itself, made fully see-through, IS the other picture - xfade from that
# transparent copy to the clip (its entry) or from the clip to it (its exit) draws the wipe / slide / iris / slices with
# the alpha, so whatever is under the layer shows through exactly where the shape has not reached yet.
DIP = ("fade", "fadeblack", "fadewhite", "fadegrays", "fadefast", "fadeslow")   # these stay an alpha dissolve on a layer


def shape_of(t):
    """the xfade name when this boundary transition draws a SHAPE on a layer (wipe, slide, iris, slices ...), else None"""
    if not t:
        return None
    try:
        n = normalize(t)
    except Exception:              # noqa: BLE001
        return None
    hit = by_id(n["type"])
    if not hit or not hit.get("xfade") or hit["xfade"] in DIP:
        return None
    return hit["xfade"]


def boundary_chain(parts, src, out, t_in, t_out, length, tag):
    """[src] (the clip from its own first frame) -> [out] with its entry and / or exit drawn as the shape.
    -> (entry_done, exit_done); (False, False) = nothing added (the caller keeps its alpha fades)."""
    xi = shape_of(t_in)
    xo = shape_of(t_out) if length else None
    if not xi and not xo:
        return False, False
    L = float(length) if length else None
    di = fade_span(t_in, L) if xi else 0.0
    do = fade_span(t_out, L) if xo else 0.0
    if L and di + do > L:                       # both ends on a short clip: share it
        k = L / (di + do)
        di, do = di * k, do * k
    clear = "format=rgba,colorchannelmixer=aa=0,format=yuva420p"
    parts.append(f"{src}format=yuva420p,setpts=PTS-STARTPTS[{tag}s]")
    cur = f"[{tag}s]"
    if xi and di > 0:
        parts.append(f"{cur}split[{tag}a][{tag}b]")
        parts.append(f"[{tag}b]trim=duration={di:.4f},setpts=PTS-STARTPTS,{clear}[{tag}z]")
        parts.append(f"[{tag}z][{tag}a]xfade=transition={xi}:duration={di:.4f}:offset=0[{tag}i]")
        cur = f"[{tag}i]"
    if xo and do > 0:
        parts.append(f"{cur}split[{tag}c][{tag}d]")
        parts.append(f"[{tag}d]trim=start={L - do:.4f},setpts=PTS-STARTPTS,{clear}[{tag}y]")
        parts.append(f"[{tag}c][{tag}y]xfade=transition={xo}:duration={do:.4f}:offset={L - do:.4f}[{tag}o]")
        cur = f"[{tag}o]"
    parts.append(f"{cur}null{out}")
    return bool(xi and di > 0), bool(xo and do > 0)
