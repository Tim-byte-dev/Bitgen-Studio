"""bitGen Studio — a timeline clip's SPEED / REVERSE / RAMP, COLOUR GRADE + LUT and SOUND CLEAN-UP, rendered once
before the compile (2.406.0). worker.py's export calls prepare(tl, ...) first; every clip whose fx needs it is
rendered into the job folder and the clip then points at that file (in 0, out = its timeline length), so the rest of
the compile (the V1 join, the overlays, the mix, the span) treats it as an ordinary clip.

Tim: "lets start closing the gap and go with your suggestions as you see fit" (speed ramps / reverse, a colour grade
with LUTs, caption tracks, audio clean-up + ducking - after "what tools does adobe premier that bitgen doesn't?").

The fx arrive from lib/clipFx.forJob (static/clipfx.js maths - the preview follows the same numbers):
  segments  [{q0, q1, s}] the source (in PLAYED order, seconds from the start of play) cut into pieces, each at speed s
  reverse   the source played backwards (reversed first, then the segments run along it)
  blend     dup (fps: frames repeated) | blend (framerate: neighbours mixed) | flow (minterpolate: motion-compensated)
  lut_file  the whole look baked into one .cube (ffmpeg lut3d, tetrahedral)
  afx       {denoise 0..1 (afftdn), voice (high-pass 80 Hz + presence + a gentle compressor), gain dB}
            2.412.0: + eq {low, mid, high, midHz} (bass / equalizer / treble), comp (mcompand, 3 bands), reverb {mix, room}
Video -> FFV1 in .mkv (lossless; yuva420p when the source carried alpha - a karaoke / ✨ Fill webm), sound -> PCM.
"""
import json
import subprocess
from pathlib import Path

import vfx_filters as VF          # 2.409.0: ✨ effects (blur, sharpen, glow, vignette, grain, crop, key, stabilise)
import hdr as _hdr                 # 2.417.0: HDR sources tone-mapped into the timeline's SDR


def _probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,codec_name,r_frame_rate,pix_fmt,width,height,color_transfer,color_primaries:stream_tags=alpha_mode:format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        d = {}
    out = {"video": False, "audio": False, "fps": 30.0, "alpha": False, "dur": 0.0, "vcodec": "", "w": 0, "h": 0, "hdr": None, "primaries": ""}
    for s in d.get("streams") or []:
        if s.get("codec_type") == "video" and not out["video"]:
            out["video"] = True
            out["vcodec"] = s.get("codec_name") or ""
            out["w"], out["h"] = int(s.get("width") or 0), int(s.get("height") or 0)
            tr = str(s.get("color_transfer") or "")                   # 2.417.0: an HDR source (PQ / HLG)
            out["hdr"] = "pq" if tr == "smpte2084" else "hlg" if tr == "arib-std-b67" else None
            out["primaries"] = str(s.get("color_primaries") or "")
            try:
                a, b = str(s.get("r_frame_rate") or "30/1").split("/")
                f = float(a) / float(b or 1)
                out["fps"] = f if 1 <= f <= 120 else 30.0
            except (ValueError, ZeroDivisionError):
                pass
            tags = {k.lower(): v for k, v in (s.get("tags") or {}).items()}
            out["alpha"] = str(tags.get("alpha_mode", "")).strip() == "1" or "a" in str(s.get("pix_fmt") or "")[3:5]
        elif s.get("codec_type") == "audio":
            out["audio"] = True
    try:
        out["dur"] = float((d.get("format") or {}).get("duration") or 0)
    except (TypeError, ValueError):
        pass
    return out


def _fx_path(p):
    """a path inside a filtergraph option: forward slashes, ':' and "'" escaped"""
    s = str(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    return f"'{s}'"


def atempo(s):
    """ffmpeg's atempo takes 0.5..2 per stage here (old builds), so a big change is a chain"""
    out, s = [], float(s)
    while s > 2.0 + 1e-9:
        out.append("atempo=2.0")
        s /= 2.0
    while s < 0.5 - 1e-9:
        out.append("atempo=0.5")
        s /= 0.5
    if abs(s - 1.0) > 1e-6:
        out.append(f"atempo={s:.6f}")
    return out


def eq_chain(eq):
    """2.412.0: three bands - a low shelf at 120 Hz, a bell in the middle (1 kHz unless moved), a high shelf at 8 kHz"""
    e = eq or {}
    out = []
    if abs(float(e.get("low") or 0)) > 1e-3:
        out.append(f"bass=g={float(e['low']):.2f}:f=120")
    if abs(float(e.get("mid") or 0)) > 1e-3:
        out.append(f"equalizer=f={int(e.get('midHz') or 1000)}:t=q:w=1:g={float(e['mid']):.2f}")
    if abs(float(e.get("high") or 0)) > 1e-3:
        out.append(f"treble=g={float(e['high']):.2f}:f=8000")
    return out


def mband(amount):
    """2.412.0: a three-band compressor (below 200 Hz / to 3 kHz / above) - amount 0..1 lowers the threshold and raises
    the ratio together; the level lost is made up after"""
    a = max(0.0, min(1.0, float(amount)))
    th, r = -10 - 20 * a, 1 + 3 * a
    top = th + (0 - th) / r
    curve = f"-90/-90\\,{th:.1f}/{th:.1f}\\,0/{top:.1f}"
    bands = [("0.005\\,0.1", 200), ("0.003\\,0.05", 3000), ("0.000625\\,0.0125", 22000)]
    body = " | ".join(f"{ad} 6 {curve} {fq}" for ad, fq in bands)
    return f"mcompand={body},volume={-top * 0.5:.2f}dB"


ROOMS = {"small": ((23, 37, 51, 67), (0.32, 0.26, 0.2, 0.15)),
         "room": ((40, 73, 112, 160, 213), (0.38, 0.3, 0.24, 0.18, 0.13)),
         "hall": ((80, 147, 229, 331, 450, 590, 760), (0.45, 0.38, 0.32, 0.26, 0.21, 0.16, 0.12))}


def reverb(mix, room):
    """2.412.0: reflections of the space (aecho taps), `mix` of them over the dry sound - a light reverb, not a convolution
    of a measured hall"""
    d, k = ROOMS.get(room) or ROOMS["room"]
    m = max(0.0, min(1.0, float(mix)))
    decays = "|".join(f"{x * (0.35 + 0.9 * m):.3f}" for x in k)
    return f"aecho=0.9:{0.95 - 0.25 * m:.3f}:{'|'.join(str(x) for x in d)}:{decays}"


def afx_chain(afx):
    """the clip's sound clean-up as filters (empty when none)"""
    a = afx or {}
    out = []
    if a.get("voice"):
        out += ["highpass=f=80", "equalizer=f=250:t=q:w=1.2:g=-2", "equalizer=f=3200:t=q:w=1.0:g=3",
                "acompressor=threshold=0.125:ratio=3:attack=10:release=180:makeup=1.5"]
    dn = float(a.get("denoise") or 0)
    if dn > 0:
        out.append(f"afftdn=nr={6 + 24 * min(1.0, dn):.1f}:nf=-45:tn=1")
    out += eq_chain(a.get("eq"))                                  # 2.412.0
    cm = float(a.get("comp") or 0)
    if cm > 0:
        out.append(mband(cm))
    rv = a.get("reverb") or {}
    if float(rv.get("mix") or 0) > 0:
        out.append(reverb(float(rv["mix"]), rv.get("room") or "room"))
    g = float(a.get("gain") or 0)
    if abs(g) > 1e-3:
        out.append(f"volume={g:.2f}dB")
    return out


def graph(fx, info, src_len, for_video=True):
    """(filter_complex, has_v, has_a, out_len) for one clip"""
    segs = fx.get("segments") or [{"q0": 0.0, "q1": src_len, "s": 1.0}]
    rev = bool(fx.get("reverse"))
    fps = round(info["fps"], 3)
    out_len = sum((float(s["q1"]) - float(s["q0"])) / max(0.01, float(s["s"])) for s in segs)
    parts = []
    has_v = for_video and info["video"]
    has_a = info["audio"]
    if any("d" in s for s in segs):                                  # 2.501.0: TIME REMAPPING - forward / backward / frozen pieces
        return remap_graph(fx, info, src_len, segs, has_v, has_a, fps, parts)
    if has_v:
        tm = _hdr.to_sdr({"hdr": info.get("hdr"), "primaries": info.get("primaries")})      # 2.417.0: HDR -> the timeline's SDR
        v = "[0:v]setpts=PTS-STARTPTS" + ("," + ",".join(tm) if tm else "") + (",format=yuva420p" if info["alpha"] else "") + (",reverse" if rev else "")
        if len(segs) == 1:
            s = float(segs[0]["s"])
            parts.append(v + (f",setpts=PTS/{s:.6f}" if abs(s - 1) > 1e-6 else "") + "[vr]")
        else:
            parts.append(v + f",split={len(segs)}" + "".join(f"[vs{i}]" for i in range(len(segs))))
            for i, sg in enumerate(segs):
                parts.append(f"[vs{i}]trim=start={float(sg['q0']):.4f}:end={float(sg['q1']):.4f},"
                             f"setpts=(PTS-STARTPTS)/{float(sg['s']):.6f}[vt{i}]")
            parts.append("".join(f"[vt{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[vr]")
        tail = []
        slowed = any(float(s["s"]) < 0.999 for s in segs)
        blend = fx.get("blend") or "dup"
        if slowed and blend == "blend":
            tail.append(f"framerate=fps={fps}")
        elif slowed and blend == "flow":
            tail.append(f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
        tail.append(f"fps={fps}")
        parts.append("[vr]" + ",".join(tail) + "[vf]")
        # 2.409.0: the grade's baked LUT + the clip's ✨ effects (a key / crop makes it see-through -> yuva420p)
        vfx = fx.get("vfx") or {}
        lut = _lut_of(fx)                               # 2.516.0: a keyed look = several cubes
        if VF.any_vfx(vfx) or lut:
            fx["_vfx_notes"] = VF.build(parts, "[vf]", "[vx]", vfx, info.get("w") or 1920, info.get("h") or 1080, tag="cv", clip=True, lut=lut,
                                        dur=out_len, fps=fps, stab=fx.get("_stab"), mask=fx.get("mask"))   # 2.416.0: a mask on the look
        else:
            parts.append("[vf]null[vx]")
        parts.append("[vx]format=yuva420p[v]" if (info["alpha"] or VF.needs_alpha(vfx)) else "[vx]format=yuv420p[v]")
    if has_a:
        a = "[0:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo" + (",areverse" if rev else "")
        if len(segs) == 1:
            ch = atempo(float(segs[0]["s"]))
            parts.append(a + "".join("," + f for f in ch) + "[ar]")
        else:
            parts.append(a + f",asplit={len(segs)}" + "".join(f"[as{i}]" for i in range(len(segs))))
            for i, sg in enumerate(segs):
                ch = atempo(float(sg["s"]))
                parts.append(f"[as{i}]atrim=start={float(sg['q0']):.4f}:end={float(sg['q1']):.4f},asetpts=PTS-STARTPTS"
                             + "".join("," + f for f in ch) + f"[at{i}]")
            parts.append("".join(f"[at{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1[ar]")
        clean = afx_chain(fx.get("afx"))
        parts.append("[ar]" + ",".join(clean + [f"atrim=end={out_len:.4f}", "apad", f"atrim=end={out_len:.4f}"]) + "[a]")
    return ";".join(parts), has_v, has_a, out_len


def _lut_of(fx):
    """the look's cube (lut_file), or 2.516.0: [(at, cube) ...] when the look is keyed (lut_keys, lib/clipFx.js withAk)"""
    ks = [k for k in (fx.get("lut_keys") or []) if isinstance(k, dict) and k.get("file")]
    if len(ks) >= 2:
        return [(float(k.get("at") or 0), _fx_path(k["file"])) for k in ks]
    return _fx_path(fx["lut_file"]) if fx.get("lut_file") else None


def remap_pieces(segs, src_len, fps):
    """2.501.0: a time remap's pieces made playable: [(kind, a, b, d, s)] - kind "fwd" (source a..b forward at s), "back"
    (source a..b played backwards at s), "hold" (the frame at a held for d s). A piece moving less than about a frame of
    source is a hold (a trim that short could be empty)."""
    out, f = [], 1.0 / max(1.0, fps)
    for sg in segs:
        q0, q1, d = float(sg["q0"]), float(sg["q1"]), max(0.0, float(sg["d"]))
        if d < 1e-4:
            continue
        q0, q1 = min(max(0.0, q0), src_len), min(max(0.0, q1), src_len)
        if abs(q1 - q0) < 1.5 * f or abs(q1 - q0) / d < 0.01:
            out.append(("hold", min(q0, max(0.0, src_len - 1.5 * f)), 0.0, d, 0.0))
        elif q1 > q0:
            out.append(("fwd", q0, q1, d, (q1 - q0) / d))
        else:
            out.append(("back", q1, q0, d, (q0 - q1) / d))
    return out or [("hold", 0.0, 0.0, max(f, float(segs[-1].get("d") or f)), 0.0)]


def remap_graph(fx, info, src_len, segs, has_v, has_a, fps, parts):
    """2.501.0: (filter_complex, has_v, has_a, out_len) for a remapped clip - each piece trimmed from the source, played
    forward (setpts / s), backward (reverse, then setpts / s) or held (one frame + tpad clone), then joined"""
    P = remap_pieces(segs, src_len, fps)
    out_len = sum(p[3] for p in P)
    f = 1.0 / max(1.0, fps)
    n = len(P)
    if has_v:
        tm = _hdr.to_sdr({"hdr": info.get("hdr"), "primaries": info.get("primaries")})
        v = "[0:v]setpts=PTS-STARTPTS" + ("," + ",".join(tm) if tm else "") + (",format=yuva420p" if info["alpha"] else "")
        parts.append(v + f",split={n}" + "".join(f"[vs{i}]" for i in range(n)))
        for i, (k, a, b, d, s) in enumerate(P):
            if k == "hold":
                parts.append(f"[vs{i}]trim=start={a:.4f}:end={a + 1.5 * f:.4f},setpts=PTS-STARTPTS,trim=end_frame=1,"
                             f"tpad=stop_mode=clone:stop_duration={d:.4f},trim=end={d:.4f},fps={fps}[vt{i}]")
            else:
                parts.append(f"[vs{i}]trim=start={a:.4f}:end={b:.4f},setpts=PTS-STARTPTS" + (",reverse" if k == "back" else "")
                             + f",setpts=(PTS-STARTPTS)/{s:.6f},fps={fps},trim=end={d:.4f}[vt{i}]")
        parts.append("".join(f"[vt{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vr]")
        tail = []
        slowed = any(p[0] != "hold" and p[4] < 0.999 for p in P)
        blend = fx.get("blend") or "dup"
        if slowed and blend == "blend":
            tail.append(f"framerate=fps={fps}")
        elif slowed and blend == "flow":
            tail.append(f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
        tail.append(f"fps={fps}")
        parts.append("[vr]" + ",".join(tail) + "[vf]")
        vfx = fx.get("vfx") or {}
        lut = _lut_of(fx)                               # 2.516.0: a keyed look = several cubes
        if VF.any_vfx(vfx) or lut:
            fx["_vfx_notes"] = VF.build(parts, "[vf]", "[vx]", vfx, info.get("w") or 1920, info.get("h") or 1080, tag="cv", clip=True, lut=lut,
                                        dur=out_len, fps=fps, stab=fx.get("_stab"), mask=fx.get("mask"))
        else:
            parts.append("[vf]null[vx]")
        parts.append("[vx]format=yuva420p[v]" if (info["alpha"] or VF.needs_alpha(vfx)) else "[vx]format=yuv420p[v]")
    if has_a:
        a = "[0:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo"
        sounding = [i for i, p in enumerate(P) if p[0] != "hold"]
        if sounding:
            parts.append(a + f",asplit={len(sounding)}" + "".join(f"[as{i}]" for i in sounding))
        else:
            parts.append(a + ",anullsink")
        for i, (k, a0, b, d, s) in enumerate(P):
            if k == "hold":                                        # a freeze is silent
                parts.append(f"aevalsrc=0|0:s=48000:c=stereo:d={d:.4f}[at{i}]")
            else:
                parts.append(f"[as{i}]atrim=start={a0:.4f}:end={b:.4f},asetpts=PTS-STARTPTS" + (",areverse" if k == "back" else "")
                             + "".join("," + x for x in atempo(s)) + f",apad,atrim=end={d:.4f}[at{i}]")
        parts.append("".join(f"[at{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[ar]")
        clean = afx_chain(fx.get("afx"))
        parts.append("[ar]" + ",".join(clean + [f"atrim=end={out_len:.4f}", "apad", f"atrim=end={out_len:.4f}"]) + "[a]")
    return ";".join(parts), has_v, has_a, out_len


def render(c, workdir, idx, say, run, kind="video"):
    """one clip -> a new clip dict pointing at its rendered file, or raises RuntimeError in words"""
    fx = c.get("fx") or {}
    src = Path(c["path"])
    info = _probe(src)
    cin = float(c.get("in") or 0)
    cout = c.get("out")
    cout = float(cout) if cout not in (None, "", 0) else (float(c["dur"]) if c.get("dur") else info["dur"])
    src_len = max(0.04, cout - cin)
    # 2.413.0: stabilise with vidstab - a first pass measures the shake of exactly the frames the clip plays (after its
    # speed / reverse), the render then smooths it (the smoothing %, or locked); no vidstab here = deshake
    if kind == "video" and VF.stab_cfg(fx.get("vfx")) and VF.has_vidstab() and info["video"]:
        trf = Path(workdir) / f"stab_{idx:03d}.trf"
        det = dict(fx, _stab={"detect": str(trf)}, afx=None)
        gd, _hv, _ha, _ol = graph(det, info, src_len, for_video=True)
        gd = gd.split(";[0:a]")[0] if ";[0:a]" in gd else gd
        r = run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{cin:.4f}", "-t", f"{src_len:.4f}", "-i", str(src),
                 "-filter_complex", gd, "-map", "[v]", "-f", "null", "-"], echo_cmd=False)
        if r == 0 and trf.exists():
            fx = dict(fx, _stab={"trf": str(trf)})
            say(f"[worker] fx {src.name}: the shake measured (vidstab)")
        else:
            say(f"[worker] fx {src.name}: measuring the shake failed - deshake instead")
    g, has_v, has_a, out_len = graph(fx, info, src_len, for_video=(kind == "video"))
    if not has_v and not has_a:
        raise RuntimeError(f"{src.name}: nothing to render (no picture, no sound)")
    out = Path(workdir) / (f"fx_{kind}_{idx:03d}" + (".mkv" if has_v else ".wav"))
    a = ["ffmpeg", "-y", "-loglevel", "error"]
    if info["alpha"] and info["vcodec"] in ("vp9", "vp8") and kind == "video":
        a += ["-c:v", "libvpx-vp9" if info["vcodec"] == "vp9" else "libvpx"]      # keep the alpha plane
    a += ["-ss", f"{cin:.4f}", "-t", f"{src_len:.4f}", "-i", str(src), "-filter_complex", g]
    if has_v:
        a += ["-map", "[v]", "-c:v", "ffv1", "-level", "3", "-g", "1"]
    if has_a:
        a += ["-map", "[a]"] + (["-c:a", "pcm_s16le"] if has_v else ["-c:a", "pcm_s16le"])
    a += [str(out)]
    what = []
    segs = fx.get("segments")
    if segs and any("d" in s for s in segs):                       # 2.501.0
        what.append(f"time remap ({len(segs) + 1} keys)")
    elif segs:
        what.append(("ramp " + "→".join(f"{float(s['s']):g}x" for s in (segs[0], segs[-1]))) if len(segs) > 1
                    else f"speed {float(segs[0]['s']):g}x")
    if info.get("hdr") and kind == "video":
        what.append(("PQ" if info["hdr"] == "pq" else "HLG") + " HDR tone-mapped to the timeline's SDR")
    if fx.get("reverse"):
        what.append("reversed")
    if fx.get("lut_file"):
        what.append("graded" + (f" ({fx.get('look')})" if fx.get("look") else "") + (f" + LUT {fx.get('lut')}" if fx.get("lut") else ""))
    if fx.get("afx"):
        what.append("sound " + ", ".join(k for k in ("voice", "denoise", "eq", "comp", "reverb", "gain") if (fx["afx"] or {}).get(k)))
    if fx.get("_vfx_notes"):
        what.append("effects: " + ", ".join(fx.pop("_vfx_notes")))
    say(f"[worker] fx {src.name}: " + ", ".join(what) + f" - {src_len:.2f}s of source -> {out_len:.2f}s")
    if run(a, echo_cmd=False) != 0 or not out.exists():
        raise RuntimeError(f"rendering the fx of {src.name} failed")
    return dict(c, path=str(out), **{"in": 0.0, "out": round(out_len, 4), "dur": round(out_len, 4), "fx": None,
                                    "fx_src": src.name})


_HDR_SEEN = {}


def is_hdr(path):
    """2.417.0: is this video file HDR (PQ / HLG)? (asked once per file)"""
    p = str(path or "")
    if p not in _HDR_SEEN:
        try:
            _HDR_SEEN[p] = _hdr.probe(p).get("hdr")
        except Exception:          # noqa: BLE001
            _HDR_SEEN[p] = None
    return _HDR_SEEN[p]


def needs(c, kind="video"):
    fx = c.get("fx") or {}
    return bool(fx.get("segments") or fx.get("reverse") or fx.get("lut_file") or fx.get("afx") or VF.any_vfx(fx.get("vfx"))
                or (kind == "video" and c.get("path") and is_hdr(c["path"])))           # 2.417.0: tone-mapped once


def prepare(tl, workdir, say, run):
    """render every clip that needs it, in place (V1, the video layers, the sound clips). -> how many"""
    n = 0

    def each(lst, kind):
        nonlocal n
        for i, c in enumerate(lst):
            if isinstance(c, dict) and needs(c, kind):
                n += 1
                lst[i] = render(c, workdir, n, say, run, kind=kind)
    each(tl.get("video") or [], "video")
    for L in tl.get("video_layers") or []:
        each(L.get("clips") or [], "video")
    for T in tl.get("audio") or []:
        each(T if isinstance(T, list) else (T.get("clips") or []), "audio")
    return n


def preview(src, at, secs, afx, out):
    """the 🎧 button: `secs` of a clip's sound from `at`, before | after the clean-up, as one wav (2.406.0)"""
    chain = afx_chain(afx) or ["anull"]
    f = (f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[x][y];"
         f"[y]{','.join(chain)}[z];[x]apad=pad_dur=0.4[xp];[xp][z]concat=n=2:v=0:a=1[a]")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{max(0.0, float(at)):.3f}",
                        "-t", f"{max(0.5, min(30.0, float(secs))):.3f}", "-i", str(src), "-filter_complex", f,
                        "-map", "[a]", "-c:a", "pcm_s16le", str(out)], capture_output=True, text=True)
    if r.returncode != 0 or not Path(out).exists():
        raise RuntimeError((r.stderr or "ffmpeg failed").strip().splitlines()[-1] if (r.stderr or "").strip() else "ffmpeg failed")


def stab_preview(src, out, smooth, lock):
    """2.413.0: the canvas's steady preview - the WHOLE file stabilised (vidstab, the clip's smoothing), 640 wide, VP9 +
    its sound, so the preview keeps its own times (only the file it reads changes)"""
    if not VF.has_vidstab():
        raise RuntimeError("this ffmpeg has no vidstab - the canvas shows the shot as it is (the compile uses deshake)")
    v = {"stabilise": {"smooth": float(smooth), "lock": bool(int(lock))}}
    info = _probe(src)
    trf = Path(out).with_suffix(".trf")
    det = VF.stab_filters(v, {"detect": str(trf)}, info["fps"], [])
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", "scale=640:-2," + det[0], "-f", "null", "-"],
                       capture_output=True, text=True)
    if r.returncode != 0 or not trf.exists():
        raise RuntimeError("measuring the shake failed: " + ((r.stderr or "").strip().splitlines() or ["ffmpeg"])[-1])
    tr = VF.stab_filters(v, {"trf": str(trf)}, info["fps"], [])
    a = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", "scale=640:-2," + tr[0],
         "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1"]
    a += ["-c:a", "libopus", "-b:a", "96k"] if info["audio"] else ["-an"]
    r = subprocess.run(a + [str(out)], capture_output=True, text=True)
    try:
        trf.unlink()
    except OSError:
        pass
    if r.returncode != 0 or not Path(out).exists():
        raise RuntimeError("the steady preview failed: " + ((r.stderr or "").strip().splitlines() or ["ffmpeg"])[-1])


def sound_preview(src, out, fx, cin, cout):
    """2.417.0: the canvas's SOUND of a reversed / ramped clip - the compile's own retime (areverse + atempo per
    segment, graph()) over the clip's played stretch, as Opus in a .webm the preview plays in step with the timeline
    (browsers cannot play backwards, and a ramp changes speed under the clip). Times: 0 = the clip's start on the
    timeline, so the page plays it at (playhead - clip start)."""
    info = _probe(src)
    if not info["audio"]:
        raise RuntimeError("the clip has no sound")
    cin = float(cin or 0)
    cout = float(cout) if cout not in (None, "", 0, "0") else info["dur"]
    src_len = max(0.04, cout - cin)
    f = dict(fx or {}, afx=None)                     # the clean-up plays live (the 🎚 mixer); only the retime is baked
    g, _hv, has_a, _ol = graph(f, info, src_len, for_video=False)
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{cin:.4f}", "-t", f"{src_len:.4f}", "-i", str(src),
                        "-filter_complex", g, "-map", "[a]", "-c:a", "libopus", "-b:a", "96k", "-f", "webm", str(out)],
                       capture_output=True, text=True)
    if r.returncode != 0 or not Path(out).exists():
        raise RuntimeError("the sound preview failed: " + ((r.stderr or "").strip().splitlines() or ["ffmpeg"])[-1])


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 7 and sys.argv[1] == "soundprev":          # 2.417.0
        try:
            sound_preview(sys.argv[2], sys.argv[3], json.loads(sys.argv[4] or "{}"), sys.argv[5], sys.argv[6])
        except Exception as e:  # noqa: BLE001 - said in words to the route
            print(str(e), file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    if len(sys.argv) == 6 and sys.argv[1] == "stabprev":
        try:
            stab_preview(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        except Exception as e:  # noqa: BLE001 - said in words to the route
            print(str(e), file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    if len(sys.argv) == 7 and sys.argv[1] == "preview":
        try:
            preview(sys.argv[2], sys.argv[3], sys.argv[4], json.loads(sys.argv[5] or "{}"), sys.argv[6])
        except Exception as e:  # noqa: BLE001 - said in words to the route
            print(str(e), file=sys.stderr)
            sys.exit(1)
    else:
        print("usage: clipfx_render.py preview <src> <at> <secs> <afx json> <out.wav>", file=sys.stderr)
        sys.exit(2)
