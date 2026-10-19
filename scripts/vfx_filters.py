"""bitGen Studio — ✨ EFFECTS as ffmpeg filters (2.409.0): a clip's effects (scripts/clipfx_render.py renders them into
the clip) and an ADJUSTMENT LAYER's (worker.py applies them to everything under it, for its time on the timeline).

Tim: "continue with the premier close gap" (effects + green-screen keying + adjustment layers were the next gap).

vfx (static/clipfx.js normalizes it - the canvas previews the same numbers, static/vfxgl.js):
  stabilise  bool | {smooth 0..100, lock}   2.413.0: vidstab (two passes: detect -> transform, the smoothing a
                                Warp-style %, lock = no camera motion) when this ffmpeg has it, else deshake (clips only)
  crop       {l, t, r, b} %    the edges made transparent - the picture stays where it is (clips only)
  key        {color "#00ff00", similarity 0.01..0.5, blend 0..0.5, spill 0..1}   chromakey (+ despill) -> alpha (clips)
  blur       0..50             px of a 1080-line picture (gblur)
  sharpen    0..2              unsharp mask amount
  glow       0..1              a blurred copy screened over it
  vignette   0..1              darker edges
  grain      0..1              film grain (temporal noise)

2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"): EFFECT KEYFRAMES - vfx["kf"] = [{at, blur,
sharpen, glow, vignette, grain, crop}] (static/clipfx.js vfxAt is the same maths): a straight line between two keys,
held outside them. The compile animates them: gblur's sigma and the blends' opacities through sendcmd (a command file,
every frame), the vignette's angle as an expression of t, sharpen / grain as the strongest version mixed in by the
amount (exact - both are linear in it), a keyframed crop as a moving mask (geq on the time -> alphamerge).

2.516.0 (Tim: "finish the last row" - KEYFRAMES ON ANY PROPERTY, static/anykeys.js): vfx["kf"] also carries lens,
warp_amount / warp_size / warp_speed and key_similarity / key_blend / key_spill (lib/clipFx.js withAk): lenscorrection's
k1 / k2, chromakey's similarity / blend and despill's mix move by sendcmd; the warp's numbers are expressions of the time
(geq). A keyed LOOK: lut = [(at, cube) ...] - every cube applied to a copy, each laid over the one before by a blend
whose opacity moves 0 -> 1 between their two keys (sendcmd) - the look cross-fades from key to key.
"""
import math
from pathlib import Path

KF_KEYS = ("blur", "sharpen", "glow", "vignette", "grain")
AK_KEYS = ("lens", "warp_amount", "warp_size", "warp_speed", "key_similarity", "key_blend", "key_spill")   # 2.516.0


def _kf_has(kf, q):
    return any(isinstance(k, dict) and k.get(q) is not None for k in (kf or []))
_VIDSTAB = None


def has_vidstab():
    """this ffmpeg has vidstabdetect / vidstabtransform (most full builds do)"""
    global _VIDSTAB
    if _VIDSTAB is None:
        import subprocess
        try:
            r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True, timeout=30)
            _VIDSTAB = "vidstabtransform" in (r.stdout or "")
        except (OSError, subprocess.SubprocessError):
            _VIDSTAB = False
    return _VIDSTAB


def stab_cfg(v):
    """2.413.0: (smooth 0..100, lock) of vfx.stabilise (true = 50 %, moving)"""
    s = (v or {}).get("stabilise")
    if not s:
        return None
    if not isinstance(s, dict):
        return (50.0, False)
    return (max(0.0, min(100.0, _f(s.get("smooth"), 50))), bool(s.get("lock")))


def _fxp(p):
    return "'" + str(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'") + "'"


def stab_filters(v, stab, fps, notes):
    """the stabilise filter(s) for a clip: vidstab's detect (stab["detect"] = the .trf to write) or transform (stab["trf"]),
    else deshake. The smoothing: smooth % -> 0.1 .. 3 s of frames either side; lock = tripod (a still camera)"""
    cfg = stab_cfg(v)
    if not cfg:
        return []
    smooth, lock = cfg
    stab = stab or {}
    if stab.get("detect"):
        return [f"vidstabdetect=result={_fxp(stab['detect'])}:shakiness=6:accuracy=12" + (":tripod=1" if lock else "")]
    if stab.get("trf"):
        frames = max(1, int(round(float(fps or 25) * (0.1 + 2.9 * smooth / 100.0))))
        notes.append(f"stabilised (smoothing {smooth:g} %" + (", locked" if lock else "") + ")")
        return [f"vidstabtransform=input={_fxp(stab['trf'])}:smoothing={frames}:optzoom=1:zoomspeed=0.2:interpol=bicubic:crop=black"
                + (":tripod=1" if lock else "")]
    notes.append("stabilised (deshake - this ffmpeg has no vidstab, so no smoothing control)")
    return ["deshake"]


def kf_val(kf, t, get, fallback):
    ks = [k for k in kf if get(k) is not None]
    if not ks:
        return fallback
    if t <= ks[0]["at"]:
        return get(ks[0])
    if t >= ks[-1]["at"]:
        return get(ks[-1])
    for a, b in zip(ks, ks[1:]):
        if t <= b["at"]:
            f = (t - a["at"]) / (b["at"] - a["at"]) if b["at"] > a["at"] else 1.0
            return get(a) + (get(b) - get(a)) * f
    return fallback


def _lin_expr(pts, var="T"):
    """[(t, v)...] -> an ffmpeg expression: straight lines between, held outside"""
    if not pts:
        return "0"
    if len(pts) == 1:
        return f"{pts[0][1]:.5f}"
    e = f"{pts[-1][1]:.5f}"
    for (ta, va), (tb, vb) in reversed(list(zip(pts, pts[1:]))):
        slope = (vb - va) / (tb - ta) if tb > ta else 0.0
        e = f"if(lt({var},{tb:.4f}),{va:.5f}+({slope:.6f})*({var}-{ta:.4f}),{e})"
    return f"if(lt({var},{pts[0][0]:.4f}),{pts[0][1]:.5f},{e})"


def _keys(kf, get):
    return [(float(k["at"]), float(get(k))) for k in kf if get(k) is not None]


def _hex(c, default="00ff00"):
    s = str(c or "").lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    try:
        int(s, 16)
        return s.lower() if len(s) == 6 else default
    except ValueError:
        return default


def _f(v, d=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


def distorts(v):
    """2.415.0: lens / mirror / warp set? (2.516.0: or keyed)"""
    v = v or {}
    w = v.get("warp") or {}
    kf = v.get("kf") or []
    return bool(abs(_f(v.get("lens"))) > 1e-4 or v.get("mirror") in ("h", "v", "quad")
                or (w.get("type") in ("wave", "twirl") and (_f(w.get("amount")) > 0 or _kf_has(kf, "warp_amount")))
                or any(abs(_f(k.get("lens"))) > 1e-4 for k in kf if isinstance(k, dict)))


def distort_filters(v, w, h, en="", alpha=False, t0=0.0, notes=None, kf=None, tag="fx", cmds=None, times=None):
    """2.415.0 - DISTORT (Tim: "lets do the medium jobs now"): mirror -> lens -> warp, the same sample points as
    static/clipfx.js distortAt (the canvas's shader too). geq works per plane (W / H = that plane's size, so the
    chroma follows); a see-through picture keeps its alpha (a= the same lookup)."""
    out = []
    notes = notes if notes is not None else []
    m = v.get("mirror")

    def geq(expr):
        a = f":a='{expr}'" if alpha else ""
        return f"geq=lum='{expr}'{a}{en}"
    if m in ("h", "v", "quad"):
        sx = "if(gt(X,W/2),W-1-X,X)" if m in ("h", "quad") else "X"
        sy = "if(gt(Y,H/2),H-1-Y,Y)" if m in ("v", "quad") else "Y"
        out.append(geq(f"p({sx},{sy})"))
        notes.append({"h": "mirrored left to right", "v": "mirrored top to bottom", "quad": "mirrored four ways"}[m])
    ln = max(-100.0, min(100.0, _f(v.get("lens"))))
    kf = kf or []
    if _kf_has(kf, "lens") and cmds is not None and times:          # 2.516.0: keyed - k1 / k2 by command
        sl = [(t, max(-100.0, min(100.0, kf_val(kf, t, lambda k: k.get("lens"), ln)))) for t in times]
        k1 = sl[0][1] / 100.0 * 0.5
        out.append(f"lenscorrection@{tag}ln=cx=0.5:cy=0.5:k1={k1:.4f}:k2={k1 * 0.5:.4f}:i=bilinear{en}")
        for t, x in sl:
            q = x / 100.0 * 0.5
            cmds.append((t0 + t, f"lenscorrection@{tag}ln k1 {q:.4f}"))
            cmds.append((t0 + t, f"lenscorrection@{tag}ln k2 {q * 0.5:.4f}"))
        notes.append("lens keyed")
        ln = 0.0
    if abs(ln) > 1e-4:
        k1 = ln / 100.0 * 0.5
        out.append(f"lenscorrection=cx=0.5:cy=0.5:k1={k1:.4f}:k2={k1 * 0.5:.4f}:i=bilinear{en}")
        notes.append(("barrel " if ln > 0 else "pincushion ") + f"{abs(ln):g}")
    wp = v.get("warp") or {}
    amt = max(0.0, min(100.0, _f(wp.get("amount"))))
    T0 = float(t0 or 0)

    def wexp(q, st, k, lo, hi):
        """2.516.0: a warp number as an expression of the time when it is keyed, else its value (x k)"""
        pts = _keys(kf, lambda x: x.get(q))
        if not pts:
            return f"{max(lo, min(hi, st)) * k:.5f}"
        return "(" + _lin_expr([(T0 + a_, max(lo, min(hi, b_)) * k) for a_, b_ in pts], "T") + ")"
    keyed_w = any(_kf_has(kf, q) for q in ("warp_amount", "warp_size", "warp_speed"))
    if wp.get("type") == "wave" and (amt > 0 or keyed_w):
        a = wexp("warp_amount", amt, 0.05 / 100.0, 0, 100)
        L = wexp("warp_size", _f(wp.get("size"), 20), 0.01, 5, 100)
        sp = wexp("warp_speed", _f(wp.get("speed")), 1.0, 0, 5)
        out.append(geq(f"p(X+{a}*W*sin(2*PI*Y/({L}*H)+2*PI*{sp}*(T-{T0:.4f})),Y)"))
        notes.append("wave keyed" if keyed_w else f"wave {amt:g}")
    elif wp.get("type") == "twirl" and (amt > 0 or keyed_w):
        a = wexp("warp_amount", amt, 3.0 / 100.0, 0, 100)
        R = wexp("warp_size", _f(wp.get("size"), 60), 0.01, 5, 100)
        out.append(geq(f"st(0,X-W/2);st(1,Y-H/2);st(2,hypot(ld(0),ld(1))/({R}*min(W,H)/2));"
                       f"st(3,if(lt(ld(2),1),{a}*(1-ld(2))*(1-ld(2)),0));"
                       f"p(W/2+ld(0)*cos(ld(3))-ld(1)*sin(ld(3)),H/2+ld(0)*sin(ld(3))+ld(1)*cos(ld(3)))"))
        notes.append("twirl keyed" if keyed_w else f"twirl {amt:g}")
    return out


def any_vfx(v):
    v = v or {}
    k = v.get("key") or {}
    c = v.get("crop") or {}
    kf = v.get("kf") or []
    return bool(v.get("stabilise") or any(_f(c.get(x)) > 0 for x in "ltrb") or v.get("key") is not None or distorts(v)
                or any(_f(v.get(x)) > 0 for x in ("blur", "sharpen", "glow", "vignette", "grain"))
                or any(_f(k.get(x)) > 0 for k in kf for x in KF_KEYS)                           # 2.412.0
                or any(_f((k.get("crop") or {}).get(x)) > 0 for k in kf for x in "ltrb")
                or any(k.get(x) is not None for k in kf for x in AK_KEYS))                      # 2.516.0


def needs_alpha(v):
    v = v or {}
    c = v.get("crop") or {}
    return bool(v.get("key") is not None or any(_f(c.get(x)) > 0 for x in "ltrb")
                or any(k.get("crop") for k in (v.get("kf") or [])))                              # 2.412.0


# ---------------- 2.416.0: MASKS / POWER WINDOWS (Tim: "continue with the next part please the gap is getting smaller")
# The look (the LUT + every effect after it) only inside the shape - or outside (invert). static/clipfx.js maskAlpha is
# the formula. The shape is drawn ONCE (geq on one frame, its feather a smoothstep across the edge), looped, and moved per
# frame by overlay's x / y (a 🎯 tracked mask follows its track - straight lines between the samples) onto a black copy
# of the clip: the mask. The graded copy takes it as its alpha (times its own when it was keyed) over the picture as it
# was.

def mask_cfg(m):
    if not isinstance(m, dict) or m.get("shape") not in ("ellipse", "rect"):
        return None
    c = lambda k, d, a, b: max(a, min(b, _f(m.get(k), d)))
    o = {"shape": m["shape"], "x": c("x", 0.5, -0.5, 1.5), "y": c("y", 0.5, -0.5, 1.5), "w": c("w", 0.4, 0.02, 2.0),
         "h": c("h", 0.4, 0.02, 2.0), "rot": c("rot", 0.0, -180.0, 180.0), "feather": c("feather", 0.05, 0.0, 0.5),
         "invert": bool(m.get("invert"))}
    tr = [(_f(k.get("at")), _f(k.get("x"), o["x"]), _f(k.get("y"), o["y"])) for k in (m.get("track") or []) if isinstance(k, dict)]
    tr.sort(key=lambda k: k[0])
    o["track"] = tr
    return o


def _decimate(pts, tol=0.0015, cap=240):
    """[(t, x, y)] -> fewer points whose straight lines stay within tol of every dropped one (and at most cap)"""
    if len(pts) <= 2:
        return list(pts)
    keep = [pts[0]]
    i = 0
    while i < len(pts) - 1:
        j = i + 1
        while j + 1 < len(pts):
            a, b = pts[i], pts[j + 1]
            ok = True
            for k in range(i + 1, j + 1):
                f = (pts[k][0] - a[0]) / max(1e-9, b[0] - a[0])
                if abs(a[1] + (b[1] - a[1]) * f - pts[k][1]) > tol or abs(a[2] + (b[2] - a[2]) * f - pts[k][2]) > tol:
                    ok = False
                    break
            if not ok:
                break
            j += 1
        keep.append(pts[j])
        i = j
    if len(keep) > cap:
        step = len(keep) / cap
        keep = [keep[int(i * step)] for i in range(cap - 1)] + [keep[-1]]
    return keep


def mask_shape(m, w, h, ox=0.0, oy=0.0):
    """the shape's own picture: (geq lum expression, its width, its height) - centred (+ ox, oy: the part of a pixel the
    overlay's whole-pixel place leaves over), rotated, feathered"""
    W, H = float(w), float(h)
    RX, RY = max(1e-6, m["w"] * W / 2.0), max(1e-6, m["h"] * H / 2.0)
    F = m["feather"] * H
    r = math.radians(m["rot"])
    ex = abs(RX * math.cos(r)) + abs(RY * math.sin(r)) if m["shape"] == "rect" else math.hypot(RX * math.cos(r), RY * math.sin(r))
    ey = abs(RX * math.sin(r)) + abs(RY * math.cos(r)) if m["shape"] == "rect" else math.hypot(RX * math.sin(r), RY * math.cos(r))
    sw = int(math.ceil(ex + F / 2.0 + 2)) * 2
    sh = int(math.ceil(ey + F / 2.0 + 2)) * 2
    cr, sr = math.cos(r), math.sin(r)
    dx = f"(X-{sw / 2.0 - 0.5 + ox:.4f})"
    dy = f"(Y-{sh / 2.0 - 0.5 + oy:.4f})"
    lx = f"({dx}*{cr:.6f}+{dy}*{sr:.6f})"
    ly = f"(-{dx}*{sr:.6f}+{dy}*{cr:.6f})"
    if m["shape"] == "rect":
        sd = f"min({RX:.4f}-abs({lx}),{RY:.4f}-abs({ly}))"
    else:
        sd = f"(1-hypot({lx}/{RX:.4f},{ly}/{RY:.4f}))*{min(RX, RY):.4f}"
    if F <= 1e-6:
        a = f"gte({sd},0)"
    else:
        q = f"clip(({sd}+{F / 2.0:.4f})/{F:.4f},0,1)"
        a = f"st(0,{q});ld(0)*ld(0)*(3-2*ld(0))"
    return f"255*({a})" if F > 1e-6 else f"255*{a}", sw, sh


def mask_stream(parts, src, out, m, w, h, fps, t0, tag):
    """[src] (a copy of the picture: its size and its frames) -> [out] the mask (gray, 255 = the look)"""
    fps = max(1.0, float(fps or 25))
    tr = _decimate(m["track"]) if m["track"] else []
    expr, sw, sh = mask_shape(m, w, h)
    if tr:                     # a moving mask: its place rounded to the nearest pixel each frame
        xs = _lin_expr([(t0 + t, x) for t, x, _y in tr], "t")
        ys = _lin_expr([(t0 + t, y) for t, _x, y in tr], "t")
        x = f"floor(({xs})*{float(w):.1f}-{sw / 2.0:.1f}+0.5)"
        y = f"floor(({ys})*{float(h):.1f}-{sh / 2.0:.1f}+0.5)"
    else:                      # a still one: a whole-pixel place, the rest of the pixel drawn into the shape - exact
        fx0, fy0 = m["x"] * float(w) - sw / 2.0, m["y"] * float(h) - sh / 2.0
        xi, yi = math.floor(fx0 + 0.5), math.floor(fy0 + 0.5)
        expr, sw, sh = mask_shape(m, w, h, fx0 - xi, fy0 - yi)
        x, y = str(xi), str(yi)
    parts.append(f"color=c=black:s={sw}x{sh}:r={fps:.3f}:d=1,format=gray,geq=lum='{expr}',loop=loop=-1:size=1[{tag}sh]")
    parts.append(f"{src}format=gray,lut=c0=0[{tag}bk]")
    parts.append(f"[{tag}bk][{tag}sh]overlay=x='{x}':y='{y}':eval=frame:shortest=1:format=yuv444{',negate' if m['invert'] else ''},format=gray{out}")


def build(parts, inl, outl, v, w, h, enable=None, tag="fx", clip=True, lut=None, t0=0.0, dur=None, fps=25.0, stab=None, mask=None):
    """2.416.0: with a mask the look (lut + the effects after it) is made on a copy and laid over the picture through the
    mask; the clip's own stabilise / crop / key stay on the whole picture (they come before the look)"""
    v = v or {}
    m = mask_cfg(mask)
    if m and not (stab and stab.get("detect")) and (lut or any_vfx({k: x for k, x in v.items() if k not in ("crop", "key", "stabilise")})):
        pre = {k: v[k] for k in ("crop", "key", "stabilise") if k in v} if clip else {}
        look = {k: x for k, x in v.items() if k not in ("crop", "key", "stabilise")}
        notes = []
        p = f"[{tag}mp]"
        if pre:
            notes += _build(parts, inl, p, pre, w, h, enable, tag + "p", clip, None, t0, dur, fps, stab)
        else:
            parts.append(f"{inl}null{p}")
        parts.append(f"{p}split=3[{tag}mb][{tag}mg][{tag}mm]")
        notes += _build(parts, f"[{tag}mg]", f"[{tag}mq]", look, w, h, enable, tag + "l", clip, lut, t0, dur, fps, None)
        mask_stream(parts, f"[{tag}mm]", f"[{tag}mk]", m, w, h, fps, float(t0 or 0), tag)
        if clip and needs_alpha(v):             # keyed / cropped: the mask times the picture's own alpha
            parts.append(f"[{tag}mq]format=yuva420p,split=2[{tag}q1][{tag}q2]")
            parts.append(f"[{tag}q2]alphaextract[{tag}qa]")
            parts.append(f"[{tag}qa][{tag}mk]blend=all_mode=multiply[{tag}qm]")
            parts.append(f"[{tag}q1][{tag}qm]alphamerge[{tag}ma]")
        else:
            parts.append(f"[{tag}mq]format=yuva420p[{tag}mq2]")
            parts.append(f"[{tag}mq2][{tag}mk]alphamerge[{tag}ma]")
        parts.append(f"[{tag}mb][{tag}ma]overlay=format=auto{',format=yuva420p' if clip and needs_alpha(v) else ''}{outl}")
        notes.append(("the look outside " if m["invert"] else "the look inside ") + ("an ellipse" if m["shape"] == "ellipse" else "a box")
                     + (f" ({m['feather'] * 100:.0f} % feather)" if m["feather"] > 0 else "")
                     + (f", tracked ({len(m['track'])} samples)" if m["track"] else ""))
        return notes
    return _build(parts, inl, outl, v, w, h, enable, tag, clip, lut, t0, dur, fps, stab)


def _build(parts, inl, outl, v, w, h, enable=None, tag="fx", clip=True, lut=None, t0=0.0, dur=None, fps=25.0, stab=None):
    """append [inl] -> effects -> [outl] to `parts`; `enable` (an ffmpeg expression) limits the timeline-capable filters
    to a time range (an adjustment layer); clip=False leaves out what only a clip can have (stabilise, crop, key).
    2.412.0: t0 = where the clip / adjustment starts on the stream's clock (its keyframes count from there), dur its
    length, fps its rate (the keyframes' command steps). -> notes (words for the job log)"""
    v = v or {}
    kf = [k for k in (v.get("kf") or []) if isinstance(k, dict) and "at" in k]
    if stab and stab.get("detect"):                       # 2.413.0: vidstab's first pass only measures
        parts.append(f"{inl}{','.join(stab_filters(v, stab, fps, []))}{outl}")
        return ["measuring the shake"]
    if kf or isinstance(lut, list):                       # 2.516.0: + a keyed look (several cubes)
        return _build_kf(parts, inl, outl, v, kf, w, h, enable, tag, clip, lut, float(t0 or 0), dur, float(fps or 25), stab)
    en = f":enable='{enable}'" if enable else ""
    chain, notes = [], []
    h = max(2, int(h or 1080))
    w = max(2, int(w or 1920))
    if clip and v.get("stabilise"):
        chain += stab_filters(v, stab, fps, notes)
    c = v.get("crop") or {}
    l, t, r, b = (max(0.0, min(45.0, _f(c.get(x)))) / 100.0 for x in "ltrb")
    if clip and (l or t or r or b):
        cw = max(2, int(round(w * (1 - l - r))) // 2 * 2)
        chh = max(2, int(round(h * (1 - t - b))) // 2 * 2)
        cx, cy = int(round(w * l)), int(round(h * t))
        chain += ["format=yuva420p", f"crop={cw}:{chh}:{cx}:{cy}", f"pad={w}:{h}:{cx}:{cy}:color=black@0"]
        notes.append(f"cropped {round(l * 100)}/{round(t * 100)}/{round(r * 100)}/{round(b * 100)} % (L/T/R/B)")
    k = v.get("key")
    if clip and k is not None:
        k = k or {}
        col = _hex(k.get("color"))
        sim = max(0.01, min(0.5, _f(k.get("similarity"), 0.12)))
        bl = max(0.0, min(0.5, _f(k.get("blend"), 0.08)))
        chain += ["format=yuva420p", f"chromakey=color=0x{col}:similarity={sim:.3f}:blend={bl:.3f}"]
        sp = max(0.0, min(1.0, _f(k.get("spill"), 0.5)))
        if sp > 0:
            r_, g_, b_ = int(col[0:2], 16), int(col[2:4], 16), int(col[4:6], 16)
            chain.append(f"despill=type={'blue' if b_ > g_ else 'green'}:mix={sp:.2f}:expand=0")
        notes.append(f"keyed #{col} (similarity {sim:.2f}, edge {bl:.2f}" + (f", spill {sp:.2f})" if sp > 0 else ")"))
    if lut:
        chain.append(f"lut3d=file={lut}:interp=tetrahedral{en}")
    if distorts(v):                                       # 2.415.0: lens / mirror / warp - after the grade
        chain += distort_filters(v, w, h, en, alpha=bool(clip and needs_alpha(v)), t0=t0, notes=notes)
    bl = max(0.0, min(50.0, _f(v.get("blur"))))
    if bl > 0:
        chain.append(f"gblur=sigma={bl * h / 1080.0 / 2.0:.3f}{en}")
        notes.append(f"blur {bl:g}")
    sh = max(0.0, min(2.0, _f(v.get("sharpen"))))
    if sh > 0:
        chain.append(f"unsharp=5:5:{sh * 1.5:.3f}:5:5:0{en}")
        notes.append(f"sharpen {sh:g}")
    gl = max(0.0, min(1.0, _f(v.get("glow"))))
    vg = max(0.0, min(1.0, _f(v.get("vignette"))))
    gr = max(0.0, min(1.0, _f(v.get("grain"))))
    cur = inl
    if gl > 0:
        pre = f"{cur}{','.join(chain) if chain else 'null'},split=2[{tag}ga][{tag}gb]"
        parts.append(pre)
        parts.append(f"[{tag}gb]gblur=sigma={12.0 * h / 1080.0:.3f}[{tag}gc]")
        parts.append(f"[{tag}ga][{tag}gc]blend=all_mode=screen:all_opacity={gl:.3f}{en}[{tag}gd]")
        cur, chain = f"[{tag}gd]", []
        notes.append(f"glow {gl:g}")
    if vg > 0:
        chain.append(f"vignette=angle={0.15 + vg * 1.05:.4f}{en}")
        notes.append(f"vignette {vg:g}")
    if gr > 0:
        chain.append(f"noise=alls={max(1, int(round(gr * 40)))}:allf=t{en}")
        notes.append(f"grain {gr:g}")
    parts.append(f"{cur}{','.join(chain) if chain else 'null'}{outl}")
    return notes


def _build_kf(parts, inl, outl, v, kf, w, h, enable, tag, clip, lut, t0, dur, fps, stab=None):
    """2.412.0: the effects with keyframes (see the top of the file)"""
    en = f":enable='{enable}'" if enable else ""
    h = max(2, int(h or 1080))
    w = max(2, int(w or 1920))
    notes = [f"{len(kf)} effect keyframe(s)"]
    end = max([float(k["at"]) for k in kf] + [float(dur or 0)])
    step = 1.0 / max(1.0, min(25.0, fps))
    times = [i * step for i in range(int(end / step) + 2)]
    lim = {"blur": 50.0, "sharpen": 2.0, "glow": 1.0, "vignette": 1.0, "grain": 1.0}

    def sched(q):
        st = max(0.0, min(lim[q], _f(v.get(q))))
        has = any(k.get(q) is not None for k in kf)
        return [(t, max(0.0, min(lim[q], kf_val(kf, t, lambda k: k.get(q), st)))) for t in times] if has else None

    cmds = []
    n = 0
    head = len(parts)                 # the command file goes FIRST - a frame's values are set before it is drawn
    cur = f"[{tag}k0]"

    def nxt():
        nonlocal n
        n += 1
        return f"[{tag}k{n}]"
    chain = []
    if clip and v.get("stabilise"):
        chain += stab_filters(v, stab, fps, notes)
    # crop: a moving mask when keyframed, else as before
    crop_kf = clip and any(k.get("crop") for k in kf)
    c0 = v.get("crop") or {}
    if crop_kf:
        sides = {}
        for q in "ltrb":
            pts = _keys(kf, lambda k, q=q: (k.get("crop") or {}).get(q) if k.get("crop") else None)
            sides[q] = _lin_expr([(t0 + a, max(0.0, min(45.0, b)) / 100.0) for a, b in pts] or [(0.0, max(0.0, min(45.0, _f(c0.get(q)))) / 100.0)], "T")
        o = nxt()
        parts.append(f"{cur}{','.join(chain + ['format=yuva420p']) }{o}")
        chain = []
        cur = o
        msk, m2 = nxt(), nxt()
        d = max(0.1, float(dur or end or 1)) + t0
        parts.append(f"color=c=black:s={w}x{h}:r={fps:.3f}:d={d:.3f},format=gray{msk}")
        # the window that stays: X between W*l and W*(1-r), Y between H*t and H*(1-b) - geq has the time (T)
        inside = (f"between(X,W*({sides['l']}),W*(1-({sides['r']})))*between(Y,H*({sides['t']}),H*(1-({sides['b']})))")
        parts.append(f"{msk}geq=lum='255*{inside}'{m2}")
        o2 = nxt()
        parts.append(f"{cur}{m2}alphamerge{o2}")
        cur = o2
        notes.append("crop keyframed")
    elif clip:
        l, t_, r, b = (max(0.0, min(45.0, _f(c0.get(x)))) / 100.0 for x in "ltrb")
        if l or t_ or r or b:
            cw = max(2, int(round(w * (1 - l - r))) // 2 * 2)
            chh = max(2, int(round(h * (1 - t_ - b))) // 2 * 2)
            cx, cy = int(round(w * l)), int(round(h * t_))
            chain += ["format=yuva420p", f"crop={cw}:{chh}:{cx}:{cy}", f"pad={w}:{h}:{cx}:{cy}:color=black@0"]
    k = v.get("key")
    if clip and k is not None:
        k = k or {}
        col = _hex(k.get("color"))
        sim = max(0.01, min(0.5, _f(k.get("similarity"), 0.12)))
        bl_ = max(0.0, min(0.5, _f(k.get("blend"), 0.08)))
        sp = max(0.0, min(1.0, _f(k.get("spill"), 0.5)))
        ks_, kb_, kp_ = (_kf_has(kf, "key_similarity"), _kf_has(kf, "key_blend"), _kf_has(kf, "key_spill"))
        if ks_ or kb_ or kp_:                             # 2.516.0: the keyer's numbers keyed - by command
            sim = max(0.01, min(0.5, kf_val(kf, 0.0, lambda x: x.get("key_similarity"), sim)))
            bl_ = max(0.0, min(0.5, kf_val(kf, 0.0, lambda x: x.get("key_blend"), bl_)))
            for t in times:
                if ks_:
                    cmds.append((t0 + t, f"chromakey@{tag}ck similarity {max(0.01, min(0.5, kf_val(kf, t, lambda x: x.get('key_similarity'), sim))):.4f}"))
                if kb_:
                    cmds.append((t0 + t, f"chromakey@{tag}ck blend {max(0.0, min(0.5, kf_val(kf, t, lambda x: x.get('key_blend'), bl_))):.4f}"))
                if kp_:
                    cmds.append((t0 + t, f"despill@{tag}dp mix {max(0.0, min(1.0, kf_val(kf, t, lambda x: x.get('key_spill'), sp))):.4f}"))
            notes.append("keyer keyed")
            if kp_:
                sp = max(sp, 0.001)
        chain += ["format=yuva420p", f"chromakey@{tag}ck=color=0x{col}:similarity={sim:.3f}:blend={bl_:.3f}"]
        if sp > 0:
            r_, g_, b_ = int(col[0:2], 16), int(col[2:4], 16), int(col[4:6], 16)
            chain.append(f"despill@{tag}dp=type={'blue' if b_ > g_ else 'green'}:mix={sp:.3f}:expand=0")
    if isinstance(lut, list) and len(lut) >= 2:            # 2.516.0: a keyed look - the cubes cross-faded key to key
        # two lanes: the even keys' cubes and the odd keys' - each cube on only while one of its two stretches plays
        # (lut3d's enable), so a frame goes through 2 cubes however many keys there are; the blend's opacity (the even
        # lane's weight) moves by command
        L_ = sorted(((float(a_), f_) for a_, f_ in lut), key=lambda x: x[0])
        n_ = len(L_)
        tt = [a_ for a_, _f_ in L_]

        def win(j):
            lo = "-1e9" if j == 0 else f"{t0 + tt[j - 1]:.4f}"
            hi = "1e9" if j == n_ - 1 else f"{t0 + tt[j + 1]:.4f}"
            return f"gte(t,{lo})*lt(t,{hi})"
        parts.append(f"{cur}{','.join(chain) if chain else 'null'},split=2[{tag}le][{tag}lo]")
        chain = []
        lanes = {}
        for par in (0, 1):
            fl = [f"lut3d=file={L_[j][1]}:interp=tetrahedral:enable='{win(j)}'" for j in range(par, n_, 2)]
            o = nxt()
            parts.append(f"[{tag}{'le' if par == 0 else 'lo'}]{','.join(fl) if fl else 'null'}{o}")
            lanes[par] = o

        def w_even(t):
            if t <= tt[0]:
                return 1.0
            if t >= tt[-1]:
                return 1.0 if (n_ - 1) % 2 == 0 else 0.0
            for i in range(n_ - 1):
                if tt[i] <= t < tt[i + 1]:
                    g = (t - tt[i]) / max(1e-6, tt[i + 1] - tt[i])
                    return 1.0 - g if i % 2 == 0 else g
            return 1.0
        o = nxt()
        w0 = w_even(times[0] if times else 0.0)
        parts.append(f"{lanes[0]}{lanes[1]}blend@{tag}lb=all_mode=normal:all_opacity={w0:.4f}{o}")   # normal: the FIRST weighed by the opacity
        cmds.extend((t0 + t, f"blend@{tag}lb all_opacity {w_even(t):.4f}") for t in times)
        cur = o
        notes.append(f"the look keyed ({n_} looks cross-faded)")
    elif lut:
        lf = lut[0][1] if isinstance(lut, list) else lut
        chain.append(f"lut3d=file={lf}:interp=tetrahedral{en}")
    if distorts(v):                                       # 2.415.0
        chain += distort_filters(v, w, h, en, alpha=bool(clip and needs_alpha(v)), t0=t0, notes=notes, kf=kf, tag=tag, cmds=cmds, times=times)
    # blur: gblur's sigma moved by command
    sb = sched("blur")
    blur0 = max(0.0, min(50.0, _f(v.get("blur"))))
    if sb and max(x for _t, x in sb) > 0:
        sig = lambda x: x * h / 1080.0 / 2.0
        chain.append(f"gblur@{tag}b=sigma={sig(sb[0][1]):.3f}{en}")
        cmds += [(t0 + t, f"gblur@{tag}b sigma {sig(x):.3f}") for t, x in sb]
        notes.append("blur keyframed")
    elif blur0 > 0:
        chain.append(f"gblur=sigma={blur0 * h / 1080.0 / 2.0:.3f}{en}")

    def mixed(q, make, what):
        """an effect that is linear in its amount: the strongest version mixed over the clean one by amount / max"""
        nonlocal cur, chain
        s_ = sched(q)
        mx = max(x for _t, x in s_) if s_ else 0
        if mx <= 0:
            return False
        a, b2, c2, o = nxt(), nxt(), nxt(), nxt()
        parts.append(f"{cur}{','.join(chain) if chain else 'null'},split=2{a}{b2}")
        chain = []
        parts.append(f"{b2}{make(mx)}{c2}")
        # 2.516.0 fix: blend's NORMAL mode weighs its FIRST input by the opacity (top * op + bottom * (1 - op)); screen lays
        # the mix over the first by the opacity - so the strongest version goes first for normal (sharpen / grain had it
        # the wrong way round since 2.412.0: a key at full strength gave none)
        pair = f"{a}{c2}" if q == "glow" else f"{c2}{a}"
        parts.append(f"{pair}blend@{tag}{q}=all_mode={'screen' if q == 'glow' else 'normal'}:all_opacity={s_[0][1] / mx:.4f}{en}{o}")
        cmds.extend((t0 + t, f"blend@{tag}{q} all_opacity {x / mx:.4f}") for t, x in s_)
        cur = o
        notes.append(f"{what} keyframed")
        return True
    sh0 = max(0.0, min(2.0, _f(v.get("sharpen"))))
    if not mixed("sharpen", lambda mx: f"unsharp=5:5:{mx * 1.5:.3f}:5:5:0", "sharpen") and sh0 > 0:
        chain.append(f"unsharp=5:5:{sh0 * 1.5:.3f}:5:5:0{en}")
    gl0 = max(0.0, min(1.0, _f(v.get("glow"))))
    if not mixed("glow", lambda mx: f"gblur=sigma={12.0 * h / 1080.0:.3f}", "glow") and gl0 > 0:
        a, b2, c2, o = nxt(), nxt(), nxt(), nxt()
        parts.append(f"{cur}{','.join(chain) if chain else 'null'},split=2{a}{b2}")
        chain = []
        parts.append(f"{b2}gblur=sigma={12.0 * h / 1080.0:.3f}{c2}")
        parts.append(f"{a}{c2}blend=all_mode=screen:all_opacity={gl0:.3f}{en}{o}")
        cur = o
    # vignette: the angle as an expression of t (0 = none)
    vk = _keys(kf, lambda k: k.get("vignette"))
    vg0 = max(0.0, min(1.0, _f(v.get("vignette"))))
    if vk:
        pts = [(t0 + a, max(0.0, min(1.0, b))) for a, b in vk]
        ex = _lin_expr(pts, "t")
        chain.append(f"vignette=angle='if(gt({ex},0.001),0.15+1.05*({ex}),0)':eval=frame{en}")
        notes.append("vignette keyframed")
    elif vg0 > 0:
        chain.append(f"vignette=angle={0.15 + vg0 * 1.05:.4f}{en}")
    gr0 = max(0.0, min(1.0, _f(v.get("grain"))))
    if not mixed("grain", lambda mx: f"noise=alls={max(1, int(round(mx * 40)))}:allf=t", "grain") and gr0 > 0:
        chain.append(f"noise=alls={max(1, int(round(gr0 * 40)))}:allf=t{en}")
    if cmds:
        f = Path.cwd() / f"{tag}_kf.cmd"
        cmds.sort(key=lambda x: x[0])
        f.write_text("".join(f"{t:.4f} {c};\n" for t, c in cmds), encoding="utf-8")
        fp = str(f).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        parts.insert(head, f"{inl}sendcmd=f='{fp}'[{tag}k0]")
    else:
        parts.insert(head, f"{inl}null[{tag}k0]")
    parts.append(f"{cur}{','.join(chain) if chain else 'null'}{outl}")
    return notes
