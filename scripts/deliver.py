"""bitGen Studio — the 📤 EXPORT queue (2.407.0): every deliverable the timeline asked for, made from the compiled master
(<project>.mp4) in one job, plus the captions' .srt beside each movie.

Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".

worker.py's export calls finish(final, tl, say, run) at every completion. tl["deliver"] = [{preset (lib/exportPresets.json),
size (the SHORT side, or "source"), aspect ("source" | "16:9" | "9:16" | "1:1" | "4:5" | "21:9"), fit (crop | pad | blur),
fps, quality (high | standard | small), name}] (normalized by lib/deliver.js) and tl["tc"] = {start: "HH:MM:SS:FF"}.
Each one: <stem>_<name>.<ext> beside the master. A preset whose encoder this ffmpeg lacks is skipped and said.

2.410.0 (Tim: "continue with the next stages of the premier gap closure" - "Export a range (in / out) only"):
tl["deliver_range"] = {a, b} (seconds - the ruler selection, lib/deliver.range) makes every deliverable of that part
only: <stem>_<name>_io.<ext>, its timecode starting where the part starts, its .srt cut to the part and shifted.

2.411.0 (Tim: "... any premier leftovers that you can do comfortably"): MP4 AV1 (SVT-AV1, else libaom), MP4 H.265 10-bit,
and tl["deliver_hw"] = use the GRAPHICS CARD's encoder for H.264 / H.265 / AV1 when it has one (NVENC, Quick Sync, AMF -
each tried with a one-frame encode first, once per run); none that works = the software encoder, said in the log.

2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"): MOV ProRes 4444 WITH ALPHA (the timeline
compiled on black and on white, the difference = how see-through - alpha_passes), MP4 H.264 10-bit (High 10), VAAPI
(Linux: -vaapi_device + hwupload) among the graphics-card encoders, drop-frame timecode (29.97 / 59.94 "HH:MM:SS;FF").

2.413.0: fit "follow" = SMART REFRAME - the crop follows the subject (scripts/reframe.py: faces, people, what stands
out; a calm smoothed path; crop@rf moved every frame by a sendcmd file).
"""
import json
import re
import subprocess
from pathlib import Path

import hdr as _hdr                    # 2.417.0: HDR10 / HLG / Rec.2020 deliverables (scripts/hdr.py)
import social as _social              # 2.597.0: MP4 · Social media - what Facebook / Instagram / TikTok take (scripts/social.py)

PRESETS = {p["id"]: p for p in json.loads((Path(__file__).resolve().parent.parent / "lib" / "exportPresets.json")
                                          .read_text(encoding="utf-8"))["presets"]}
CRF = {"h264": (16, 20, 26), "h265": (18, 23, 28), "webm": (24, 32, 40), "av1": (24, 32, 40), "h265_10": (18, 23, 28), "h264_10": (16, 20, 26)}
ENC = {"h264": "libx264", "h265": "libx265", "h265_10": "libx265", "av1": "libsvtav1", "prores": "prores_ks", "dnxhr": "dnxhd", "webm": "libvpx-vp9", "gif": "gif",
       "wav": "pcm_s24le", "mp3": "libmp3lame", "h264_10": "libx264", "prores4444": "prores_ks", "social": "libx264"}
# the presets that carry a start timecode (MP4 / MOV)
TC_PRESETS = ("h264", "h265", "h265_10", "h264_10", "av1", "prores", "prores4444", "dnxhr")
JOB = None          # 2.412.0: worker.py sets the export job's file here - the ProRes 4444 alpha passes re-run it
_have = None


def encoders():
    global _have
    if _have is None:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True)
        _have = {ln.split()[1] for ln in (r.stdout or "").splitlines() if len(ln.split()) > 1 and len(ln.split()[0]) == 6}
    return _have


HW = {"h264": ("h264_nvenc", "h264_qsv", "h264_amf", "h264_vaapi"), "h265": ("hevc_nvenc", "hevc_qsv", "hevc_amf", "hevc_vaapi"),
      "h265_10": ("hevc_nvenc", "hevc_qsv", "hevc_vaapi"), "av1": ("av1_nvenc", "av1_qsv", "av1_amf", "av1_vaapi")}
HW_SUFFIX = ("_nvenc", "_qsv", "_amf", "_vaapi")


def vaapi_device():
    """2.412.0: VAAPI (Linux: Intel / AMD) encodes on a render node - H3_VAAPI_DEVICE, else /dev/dri/renderD128"""
    import os
    dev = os.environ.get("H3_VAAPI_DEVICE") or "/dev/dri/renderD128"
    return dev if Path(dev).exists() else None


def pre_for(enc):
    """the options that go BEFORE -i for this encoder (VAAPI opens its device there)"""
    if enc and enc.endswith("_vaapi"):
        dev = vaapi_device()
        return ["-vaapi_device", dev] if dev else []
    return []
_hw_ok = {}


def hw_works(enc, run=None):
    """a one-frame encode with this hardware encoder (cached): listed by ffmpeg is not enough - the card / driver decides"""
    if enc not in _hw_ok:
        if enc not in encoders():
            _hw_ok[enc] = False
        else:
            try:
                vaapi = enc.endswith("_vaapi")
                if vaapi and not vaapi_device():
                    raise OSError("no VAAPI render node")
                r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error"] + pre_for(enc)
                                   + ["-f", "lavfi", "-i", "color=c=gray:s=256x144:d=0.1", "-frames:v", "1"]
                                   + (["-vf", "format=nv12,hwupload"] if vaapi else []) + ["-c:v", enc, "-f", "null", "-"],
                                   capture_output=True, text=True, timeout=30)
            except (OSError, subprocess.SubprocessError):
                r = None
            _hw_ok[enc] = bool(r) and r.returncode == 0
    return _hw_ok[enc]


def pick_encoder(pid, hw):
    """-> (the encoder, hw or None) for a video preset: the graphics card's when asked and one works, else software"""
    if hw and pid in HW:
        for enc in HW[pid]:
            if hw_works(enc):
                return enc, enc
    if pid == "av1" and "libsvtav1" not in encoders() and "libaom-av1" in encoders():
        return "libaom-av1", None
    return ENC[pid], None


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate",
                        "-of", "json", str(p)], capture_output=True, text=True)
    out = {"w": 0, "h": 0, "fps": 30.0, "audio": False}
    try:
        for s in json.loads(r.stdout or "{}").get("streams") or []:
            if s.get("codec_type") == "video" and not out["w"]:
                out["w"], out["h"] = int(s.get("width") or 0), int(s.get("height") or 0)
                a, b = str(s.get("r_frame_rate") or "30/1").split("/")
                out["fps"] = float(a) / float(b or 1)
            elif s.get("codec_type") == "audio":
                out["audio"] = True
    except (ValueError, ZeroDivisionError):
        pass
    return out


def even(v):
    return max(2, int(round(v / 2.0)) * 2)


def frame(d, w, h):
    """the target frame (w, h) for a deliverable from a w x h master"""
    asp = d.get("aspect") or "source"
    if asp == "source":
        ar = w / float(h or 1)
    else:
        a, b = asp.split(":")
        ar = float(a) / float(b)
    size = d.get("size") or "source"
    short = min(w, h) if size == "source" else int(size)
    if d.get("preset") == "gif":
        short = min(short, 360)
    return (even(short * ar), even(short)) if ar >= 1 else (even(short), even(short / ar))


def vfilter(d, info):
    tw, th = frame(d, info["w"], info["h"])
    fit = d.get("fit") or "crop"
    if (tw, th) == (info["w"], info["h"]):
        chain = "[0:v]setsar=1"
    elif fit == "pad":
        chain = f"[0:v]scale={tw}:{th}:force_original_aspect_ratio=decrease,pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2:black,setsar=1"
    elif fit == "follow" and d.get("_rf"):                 # 2.413.0: the crop follows the subject (scripts/reframe.py)
        rf = d["_rf"]
        fp = str(rf["cmd"]).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        chain = f"[0:v]scale={rf['sw']}:{rf['sh']},sendcmd=f='{fp}',crop@rf={tw}:{th}:{rf['x0']}:{rf['y0']},setsar=1"
    elif fit == "blur":
        chain = (f"[0:v]split=2[bg0][fg0];[bg0]scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th},"
                 f"boxblur=20:2[bg];[fg0]scale={tw}:{th}:force_original_aspect_ratio=decrease[fg];"
                 f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1")
    else:
        chain = f"[0:v]scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th},setsar=1"
    fps = d.get("fps") or "source"
    if d.get("preset") == "gif":
        fps = "15" if fps == "source" else str(min(30, int(fps)))
    if fps != "source":
        chain += f",fps={int(fps)}"
    return chain, tw, th


ALPHA_MATTE = ("[0:v]format=gbrp,split[mb][mb2];[1:v]format=gbrp[mw];"
               "[mw][mb]blend=all_mode=difference,format=gray,negate,lut=c0='if(lt(val,8),0,if(gt(val,247),255,val))',"
               "format=gbrp,split[ma1][ma2];[mb2][ma1]unpremultiply=inplace=0[mc];[ma2]format=gray[ma3];"
               "[mc][ma3]alphamerge,format=yuva444p10le[m0];")


def args_for(d, info, tc, enc=None, alpha=False):
    """-> (ffmpeg args after the inputs, (w, h) or None). alpha: input 1 is the WHITE-background pass - ProRes 4444 is
    made with the see-through parts (2.412.0)"""
    pid = d["preset"]
    enc = enc or ENC.get(pid)
    hwq = {"high": 19, "standard": 24, "small": 30}.get(d.get("quality") or "standard", 24)
    q = {"high": 0, "standard": 1, "small": 2}.get(d.get("quality") or "standard", 1)
    a = []
    p = PRESETS[pid]
    if pid == "social":                                                    # 2.597.0: scripts/social.py's settings
        d = social_deliverable(d, info)
        fps = _social.fps_for(d.get("fps"), info.get("fps"))
        chain, tw, th = vfilter(dict(d, fps="source"), info)
        return (["-filter_complex", chain + "[v]", "-map", "[v]"]
                + _social.args(tw, th, fps, q, info["audio"], _social.fps_mode_flag())), (tw, th)
    if p["video"]:
        chain, tw, th = vfilter(d, info)
        if pid == "prores4444" and alpha:                       # 2.412.0: the difference matte (black vs white pass)
            chain = ALPHA_MATTE + chain.replace("[0:v]", "[m0]").replace(":black,setsar", ":black@0,setsar")
        colour = d.get("colour") if d.get("colour") in _hdr.OUT and p.get("wide") else None     # 2.417.0
        if colour:
            chain += "," + _hdr.out_chain(colour, {"prores": "yuv422p10le", "prores4444": "yuv444p10le"}.get(pid, "yuv420p10le"))
        if pid == "gif":
            chain += ",split[g1][g2];[g1]palettegen=stats_mode=diff[pal];[g2][pal]paletteuse=dither=bayer:bayer_scale=4"
            return ["-filter_complex", chain + "[v]", "-map", "[v]", "-an", "-loop", "0"], (tw, th)
        if enc and enc.endswith("_vaapi"):                      # 2.412.0: VAAPI takes frames uploaded to the card
            chain += ",format=" + ("p010le" if pid == "h265_10" else "nv12") + ",hwupload"
        a += ["-filter_complex", chain + "[v]", "-map", "[v]"]
        if enc and enc.endswith("_vaapi"):
            a += ["-c:v", enc, "-rc_mode", "CQP", "-qp", str(hwq)]
            if pid in ("h265", "h265_10"):
                a += ["-tag:v", "hvc1"]
            a += ["-movflags", "+faststart"]
        elif enc and enc.endswith(("_nvenc", "_qsv", "_amf")):          # 2.411.0: the graphics card's encoder
            rc = {"_nvenc": ["-rc", "vbr", "-cq", str(hwq)], "_qsv": ["-global_quality", str(hwq)],
                  "_amf": ["-rc", "cqp", "-qp_i", str(hwq), "-qp_p", str(hwq)]}[next(k for k in ("_nvenc", "_qsv", "_amf") if enc.endswith(k))]
            a += ["-c:v", enc] + rc + ["-pix_fmt", "p010le" if pid == "h265_10" else "yuv420p"]
            if pid in ("h265", "h265_10"):
                a += ["-tag:v", "hvc1"]
            a += ["-movflags", "+faststart"]
        elif pid == "h264":
            a += ["-c:v", "libx264", "-preset", "medium", "-crf", str(CRF["h264"][q]), "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        elif pid == "h264_10":                                             # 2.412.0: High 10
            a += ["-c:v", "libx264", "-preset", "medium", "-crf", str(CRF["h264_10"][q]), "-profile:v", "high10", "-pix_fmt", "yuv420p10le",
                  "-movflags", "+faststart"]
        elif pid in ("h265", "h265_10"):
            a += ["-c:v", "libx265", "-preset", "medium", "-crf", str(CRF[pid][q]), "-pix_fmt", "yuv420p10le" if pid == "h265_10" else "yuv420p", "-tag:v", "hvc1",
                  "-movflags", "+faststart", "-x265-params", "log-level=error" + (":" + _hdr.x265_params(colour) if colour else "")]
        elif pid == "av1":                                                   # 2.411.0
            if enc == "libaom-av1":
                a += ["-c:v", "libaom-av1", "-crf", str(CRF["av1"][q]), "-b:v", "0", "-cpu-used", "6", "-row-mt", "1", "-pix_fmt", "yuv420p10le" if colour else "yuv420p"]
            else:
                a += ["-c:v", "libsvtav1", "-crf", str(CRF["av1"][q]), "-preset", "8", "-pix_fmt", "yuv420p10le" if colour else "yuv420p"]
                if colour:
                    a += ["-svtav1-params", _hdr.svtav1_params(colour)]
            a += ["-movflags", "+faststart"]
        elif pid == "prores":
            a += ["-c:v", "prores_ks", "-profile:v", "3", "-vendor", "apl0", "-pix_fmt", "yuv422p10le"]
        elif pid == "prores4444":                                          # 2.412.0: 4444, with the alpha when there is one
            a += ["-c:v", "prores_ks", "-profile:v", "4", "-vendor", "apl0"] + (["-alpha_bits", "16", "-pix_fmt", "yuva444p10le"] if alpha else ["-pix_fmt", "yuv444p10le"])
        elif pid == "dnxhr":
            a += ["-c:v", "dnxhd", "-profile:v", "dnxhr_hq", "-pix_fmt", "yuv422p"]
        elif pid == "webm":
            a += ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(CRF["webm"][q]), "-row-mt", "1", "-deadline", "good", "-cpu-used", "4"]
        if colour:
            a += _hdr.tags(colour)                                          # 2.417.0: the stream says its colour
        if info["audio"]:
            a += ["-map", "0:a"]
            aac = ["-c:a", "aac", "-b:a", ("320k", "192k", "128k")[q]]
            a += {"h264": aac, "h265": aac, "h265_10": aac, "h264_10": aac, "av1": aac, "prores4444": ["-c:a", "pcm_s24le"],
                  "prores": ["-c:a", "pcm_s24le"], "dnxhr": ["-c:a", "pcm_s24le"], "webm": ["-c:a", "libopus", "-b:a", "160k"]}[pid]
        if tc and pid in TC_PRESETS:
            out_fps = info.get("fps") if (d.get("fps") or "source") == "source" else d.get("fps")
            a += ["-timecode", tc_for(tc, out_fps)]
        return a, (tw, th)
    a += ["-vn", "-map", "0:a"]
    a += ["-c:a", "pcm_s24le", "-ar", "48000"] if pid == "wav" else ["-c:a", "libmp3lame", "-b:a", "320k"]
    return a, None


def social_deliverable(d, info):
    """2.597.0: the social preset keeps the short side at 1080 at most ("source size" on a 4K master = 1080)"""
    size = d.get("size") or "source"
    short = min(info["w"], info["h"]) if size == "source" else int(size)
    return dict(d, size="1080") if short > 1080 else d


def out_path(final, d, rng=None):
    return final.with_name(f"{final.stem}_{d.get('name') or d['preset']}{'_io' if rng else ''}.{PRESETS[d['preset']]['ext']}")


def range_of(tl, dur=None):
    """tl["deliver_range"] -> (a, b) seconds inside the movie, or None"""
    r = tl.get("deliver_range") if isinstance(tl, dict) else None
    if not isinstance(r, dict):
        return None
    try:
        a, b = max(0.0, float(r.get("a"))), float(r.get("b"))
    except (TypeError, ValueError):
        return None
    if dur:
        b = min(b, float(dur))
    return (round(a, 4), round(b, 4)) if b - a >= 0.04 else None


def _tc_rate(fps):
    f = float(fps or 25)
    tb = int(round(f))
    return tb, (tb * 1000 / 1001 if abs(f - tb) > 0.001 else float(tb)), abs(f - tb) > 0.001 and tb in (30, 60)


def tc_frames(tc, fps):
    """'HH:MM:SS:FF' / 'HH:MM:SS;FF' (drop-frame on 29.97 / 59.94) -> frames, or None (the same sums as static/timecode.js)"""
    m = re.match(r"^(\d{1,2}):(\d{2}):(\d{2})([:;.])(\d{2})$", str(tc or "").strip())
    if not m:
        return None
    tb, _r, can = _tc_rate(fps)
    h, mi, s, f = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(5))
    n = ((h * 60 + mi) * 60 + s) * tb + f
    if m.group(4) == ";" and can:
        dn = 4 if tb == 60 else 2
        mins = h * 60 + mi
        n -= dn * (mins - mins // 10)
    return n


def tc_fmt(n, fps, drop=False):
    """frames -> 'HH:MM:SS:FF', or 'HH:MM:SS;FF' drop-frame (29.97 / 59.94)"""
    tb, _r, can = _tc_rate(fps)
    n, sep = max(0, int(n)), ":"
    if drop and can:
        dn = 4 if tb == 60 else 2
        per10, per_min = tb * 600 - dn * 9, tb * 60 - dn
        d, m = divmod(n, per10)
        n += dn * 9 * d + (dn * ((m - dn) // per_min) if m > dn else 0)
        sep = ";"
    return f"{n // (3600 * tb) % 24:02d}:{n // (60 * tb) % 60:02d}:{n // tb % 60:02d}{sep}{n % tb:02d}"


def tc_plus(tc, fps, secs):
    """'HH:MM:SS:FF' + secs -> the timecode there; 2.412.0: frames at the REAL rate (29.97 = 30000/1001), a drop-frame
    start ('HH:MM:SS;FF') stays drop-frame"""
    n = tc_frames(tc, fps)
    if n is None:
        return tc
    _tb, r, _can = _tc_rate(fps)
    return tc_fmt(n + int(round(secs * r)), fps, ";" in str(tc))


def tc_for(tc, out_fps):
    """the -timecode for a file made at out_fps: ffmpeg writes drop-frame only at 29.97 / 59.94 (and 30 / 60) - on another
    rate the same frame number goes in as non-drop"""
    if tc and ";" in tc and int(round(float(out_fps or 0))) % 30 != 0:
        return tc.replace(";", ":")
    return tc


def srt_cut(text, a, b):
    """an .srt cut to [a, b] and shifted to start at 0"""
    import re
    def secs(t):
        hh, mm, rest = t.split(":")
        ss, ms = rest.replace(".", ",").split(",")
        return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms) / 1000.0

    def fmt(x):
        x = max(0.0, x)
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    out, n = [], 0
    for blk in re.split(r"\r?\n\s*\r?\n", text.strip()):
        lines = blk.splitlines()
        k = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if k is None:
            continue
        try:
            s0, s1 = [secs(x.strip().split(" ")[0]) for x in lines[k].split("-->")]
        except (ValueError, IndexError):
            continue
        if s1 <= a or s0 >= b:
            continue
        n += 1
        out.append(f"{n}\n{fmt(max(s0, a) - a)} --> {fmt(min(s1, b) - a)}\n" + "\n".join(lines[k + 1:]))
    return "\n\n".join(out) + ("\n" if out else "")


def alpha_passes(final, say):
    """2.412.0: ProRes 4444 WITH ALPHA - the timeline compiled twice more (high quality), once on BLACK and once on WHITE
    where nothing is drawn (V1's gaps, past its end, a see-through V1); what differs between the two is how see-through
    each pixel is (a difference matte - exact for anything laid over, fades and opacity included). -> (black, white)
    paths or None (said why)."""
    import sys
    if not JOB or not Path(JOB).exists():
        say("[worker] ProRes 4444: no export job to re-run for the alpha - made without one")
        return None
    try:
        job = json.loads(Path(JOB).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    worker = Path(__file__).resolve().parent.parent / "misc" / "worker.py"
    made = []
    for bg in ("black", "white"):
        j = json.loads(json.dumps(job))
        pr = j["params"]
        tl = pr.get("timeline") or {}
        tl["deliver"] = []
        caps = tl.get("captions") or {}
        if isinstance(caps, dict):
            caps["srt"] = False
        pr.update({"bg": bg, "crf": 10, "out_name": f"{final.stem}__alpha_{bg}.mp4"})
        jf = Path(JOB).with_name(Path(JOB).stem + f"_alpha_{bg}.json")
        jf.write_text(json.dumps(j), encoding="utf-8")
        say(f"[worker] ProRes 4444 alpha: compiling the timeline on {bg} (where nothing is drawn)")
        r = subprocess.run([sys.executable, str(worker), str(jf)], capture_output=True, text=True, cwd=str(Path.cwd()))
        out = final.with_name(f"{final.stem}__alpha_{bg}.mp4")
        if r.returncode != 0 or not out.exists():
            tail = " | ".join((r.stdout or "").strip().splitlines()[-3:])
            say(f"[worker] ProRes 4444 alpha: the {bg} pass failed ({tail[:300]}) - made without the alpha")
            for m in made:
                Path(m).unlink(missing_ok=True)
            return None
        made.append(out)
    return made[0], made[1]


def finish(final, tl, say, run):
    """the deliverables after the master is written. -> the list of files made (names)"""
    final = Path(final)
    made = []
    dl = [d for d in (tl.get("deliver") or []) if isinstance(d, dict) and d.get("preset") in PRESETS]
    if not dl or not final.exists():
        return made
    info = probe(final)
    tc = ((tl.get("tc") or {}).get("start") or "").strip() or None
    srt = final.with_suffix(".srt")
    rng = range_of(tl)
    if rng and tc:
        tc = tc_plus(tc, (tl.get("tc") or {}).get("fps") or 25, rng[0])
    passes = alpha_passes(final, say) if any(d["preset"] == "prores4444" for d in dl) else None
    # 2.413.0: smart reframe - the subject found once (faces, people, what stands out), its path smoothed
    follow = [d for d in dl if d.get("fit") == "follow" and (d.get("aspect") or "source") != "source" and PRESETS[d["preset"]]["video"]]
    rf_pts, rf_files = None, []
    if follow:
        try:
            import reframe as _rf
            an = _rf.analyse(final)
            rf_pts = _rf.smooth(an["track"], an["dur"] or 0)
            hows = {}
            for p_ in an["track"]:
                hows[p_[4]] = hows.get(p_[4], 0) + 1
            say("[worker] reframe: following the subject (" + (", ".join(f"{k} {v}" for k, v in hows.items()) or "nothing stood out - the middle") + ")")
        except Exception as e:  # noqa: BLE001 - the centre crop instead, said
            say(f"[worker] reframe: could not follow the subject ({e}) - the middle is kept")
            rf_pts = None
    say(f"[worker] export queue: {len(dl)} deliverable(s) from {final.name}"
        + (f" - In / Out only: {rng[0]:.2f}-{rng[1]:.2f} s ({rng[1] - rng[0]:.2f} s)" if rng else ""))
    for i, d in enumerate(dl, start=1):
        p = PRESETS[d["preset"]]
        enc, hw = pick_encoder(d["preset"], bool(tl.get("deliver_hw")) and (d.get("colour") or "sdr") == "sdr") if p["video"] else (ENC[d["preset"]], None)
        if enc not in encoders():
            say(f"[worker] export {i}/{len(dl)} {p['label']}: this ffmpeg has no {enc} encoder - skipped")
            continue
        if tl.get("deliver_hw") and d["preset"] in HW:
            say(f"[worker] export {i}/{len(dl)} {p['label']}: " + (f"the graphics card's {hw}" if hw else f"no graphics-card encoder works here - {enc} (software)"))
        if not p["video"] and not info["audio"]:
            say(f"[worker] export {i}/{len(dl)} {p['label']}: the movie has no sound - skipped")
            continue
        out = out_path(final, d, rng)
        alpha = bool(passes) and d["preset"] == "prores4444" and (d.get("colour") or "sdr") == "sdr"
        if rf_pts and d in follow:
            tw_, th_ = frame(d, info["w"], info["h"])
            sw_, sh_ = _rf.cover(info["w"], info["h"], tw_, th_)
            cmd = final.with_name(f"{final.stem}_rf{i}.cmd")
            x0, y0 = _rf.cmd_file(rf_pts, info["fps"] or 30, sw_, sh_, tw_, th_, cmd, t0=rng[0] if rng else 0.0, t1=rng[1] if rng else None)
            rf_files.append(cmd)
            d = dict(d, _rf={"cmd": str(cmd), "sw": sw_, "sh": sh_, "x0": x0, "y0": y0})
        a, wh = args_for(d, info, tc, enc, alpha=alpha)
        say(f"[worker] export {i}/{len(dl)} {p['label']}" + (f" {wh[0]}x{wh[1]}" if wh else "")
            + (f" · {_hdr.OUT[d['colour']]['label']} (the master's white at {_hdr.REF_WHITE} nits)" if d.get("colour") in _hdr.OUT else "")
            + (f" ({d.get('aspect')} {d.get('fit')})" if (d.get("aspect") or "source") != "source" else "") + f" -> {out.name}")
        cut = ["-ss", f"{rng[0]:.4f}", "-t", f"{rng[1] - rng[0]:.4f}"] if rng else []      # 2.410.0: In / Out only
        ins = (cut[:2] + ["-i", str(passes[0])] + cut[:2] + ["-i", str(passes[1])]) if alpha else (cut[:2] + ["-i", str(final)])
        if d["preset"] == "social" and not info["audio"]:                  # 2.597.0: a silent track for a movie with no sound
            ins += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        if alpha:
            say(f"[worker] export {i}/{len(dl)} {p['label']}: the alpha from the black / white passes (see-through where nothing is drawn)")
        rc = run(["ffmpeg", "-y", "-loglevel", "error"] + pre_for(enc) + ins + cut[2:] + a + [str(out)], echo_cmd=False)
        if rc != 0 or not out.exists():
            say(f"[worker] export {i}/{len(dl)} {p['label']}: ffmpeg failed - skipped")
            continue
        made.append(out.name)
        if d["preset"] == "social":                                        # 2.597.0: what the sites look at, checked
            try:
                ck = _social.check(out, d.get("aspect") or "source")
                say(f"[worker] export {i}/{len(dl)} social check: {ck['summary']} - " + "; ".join(("ok " if x else "NO ") + t for x, t in ck["lines"]))
                for n_ in ck["notes"]:
                    say(f"[worker] export {i}/{len(dl)} note: {n_}")
            except Exception as e:  # noqa: BLE001 - the file is made; the check is advice
                say(f"[worker] export {i}/{len(dl)} social check could not run: {e}")
        if srt.exists() and p["video"] and d["preset"] != "gif":
            txt = srt.read_text(encoding="utf-8")
            out.with_suffix(".srt").write_text(srt_cut(txt, rng[0], rng[1]) if rng else txt, encoding="utf-8")
    for f in rf_files:
        Path(f).unlink(missing_ok=True)
    for f in (passes or []):
        Path(f).unlink(missing_ok=True)
        Path(f).with_suffix(".srt").unlink(missing_ok=True)
    say(f"[worker] export queue done: {', '.join(made) if made else 'nothing made'}")
    return made
