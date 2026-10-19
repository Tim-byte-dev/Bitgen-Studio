#!/usr/bin/env python3
"""bitGen Studio - the KARAOKE overlay's subtitle script, with a bouncing ball (2.373.0).

Tim: "is it possible to add a kareoke layer to the timeline, and generate the kareoke style bouncing ball in
videodocker ... when the video renders, render another video with transparent background with the kareoke lyrics
that can be added as an overlay layer in timeline".

build(words, width, height, opts) -> (ass_text, font_dir_or_None)

words = [{"text", "line", "start", "end"}] in seconds of THIS overlay (0 = the first frame of the scene's take).
Layout, per lyric line:
  * the line being sung sits low in the frame, every word placed by its measured width (so the ball knows where
    each word is); a word sweeps from white to yellow (\\kf) while it is sung;
  * the NEXT line waits dimmed underneath, so the singer can read ahead;
  * the ball hops in an arc from word to word and lands on each one as it starts; a long gap is a few small
    bounces on the spot before the hop.
The words are measured with a real TrueType font when Pillow and a font file are there (Arial on Windows,
Liberation Sans - Arial's metric twin - or DejaVu Sans on Linux); the same file's folder goes to ffmpeg's
subtitles filter (fontsdir) so libass draws exactly what was measured. Without Pillow an Arial-like width table is
used.
"""
import math
import os

FPS = 24

# Arial Bold advance widths in 1/1000 em for printable ASCII (32..126); others = 600.
_AW = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
       556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
       975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
       667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
       333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
       611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]

FONT_CANDIDATES = [
    # (file, family libass looks up)
    (r"C:\Windows\Fonts\arialbd.ttf", "Arial"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "Liberation Sans"),
    ("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf", "Liberation Sans"),
    ("/usr/share/fonts/liberation/LiberationSans-Bold.ttf", "Liberation Sans"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans"),
    ("/Library/Fonts/Arial Bold.ttf", "Arial"),
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "Arial"),
]


def pick_font():
    """(file or None, family)."""
    for f, fam in FONT_CANDIDATES:
        if os.path.exists(f):
            return f, fam
    return None, "Arial"


FONT_DIRS = [r"C:\Windows\Fonts", os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts"),
             "/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts"), "/Library/Fonts",
             "/System/Library/Fonts", "/System/Library/Fonts/Supplemental"]


def find_font(family):
    """2.380.0: the karaoke style's font by family name -> (file or None, family). A bold file is preferred (the
    lyrics are bold); libass still finds the family by name when no file matches (the widths are then estimated)."""
    want = "".join(c for c in str(family or "").lower() if c.isalnum())
    if not want:
        return pick_font()
    best = None
    for d in FONT_DIRS:
        if not d or not os.path.isdir(d):
            continue
        for root, _dirs, files in os.walk(d):
            for f in files:
                if not f.lower().endswith((".ttf", ".otf")):
                    continue
                stem = "".join(c for c in os.path.splitext(f)[0].lower() if c.isalnum())
                if not stem.startswith(want):
                    continue
                rest = stem[len(want):]
                score = 3 if rest in ("bd", "bold", "b") else 2 if rest == "" or rest in ("regular", "r") else 1
                if not best or score > best[0]:
                    best = (score, os.path.join(root, f))
    return (best[1], family) if best else (None, family)


def ass_color(hexc, opacity=100):
    """#rrggbb + opacity % -> ASS &HAABBGGRR& (AA 00 = solid)."""
    h = str(hexc or "#ffffff").lstrip("#")
    if len(h) != 6:
        h = "ffffff"
    a = max(0, min(255, int(round(255 * (1 - max(0.0, min(100.0, float(opacity))) / 100.0)))))
    return f"&H{a:02X}{h[4:6].upper()}{h[2:4].upper()}{h[0:2].upper()}&"


STYLE_DEFAULTS = {"font": "", "font_size": 0, "color": "#ffffff", "highlight": "#ffd500", "font_opacity": 100,
                  "text_shadow": 2, "border_color": "#101010", "border_width": 3, "bg_color": "#000000",
                  "bg_opacity": 0, "bg_border_color": "#ffffff", "bg_border_width": 0, "box_shadow": 0,
                  "bg_height": 0, "position_top": -1, "ball_size": 0, "ball_color": "#ffd500",
                  "ball_outline_color": "#101010"}


def style_of(opts):
    st = dict(STYLE_DEFAULTS)
    for k, v in ((opts or {}).get("style") or {}).items():
        if k in st and v is not None:
            st[k] = v
    return st


def geometry(width, height, opts=None):
    """2.380.0: where the lyrics and the background band go - {size, y_cur, y_next, band_top, band_h, ball_r}.
    position_top -1 = the 2.373 layout (the singing line at 80% of the height, the next one under it)."""
    st = style_of(opts)
    W, H = int(width), int(height)
    size = int(st["font_size"]) or max(18, int(round(H * float((opts or {}).get("size_frac", 0.075)))))
    size = max(8, size)
    nsize = size * 0.82
    pad = max(6, int(round(size * 0.35)))
    content = size * 1.05 + nsize * 1.15
    top = int(st["position_top"])
    if top >= 0:
        band_h = int(st["bg_height"]) or int(round(content + pad * 2))
        y_cur = top + max(0.0, (band_h - content) / 2.0) + size * 1.05
        y_next = y_cur + nsize * 1.15
        band_top = top
    else:
        y_cur = H * 0.80
        y_next = y_cur + size * 1.15
        if y_next + size * 0.4 > H:
            y_next = H - size * 0.4
            y_cur = y_next - size * 1.15
        band_top = int(round(y_cur - size * 1.05 - pad))
        band_h = int(st["bg_height"]) or int(round(y_next - band_top + pad * 0.6))
    r = float(st["ball_size"]) or max(4, size * 0.2)
    return {"size": size, "y_cur": y_cur, "y_next": y_next, "band_top": band_top, "band_h": band_h, "ball_r": r}


class Measure:
    """Text width in pixels at a font size: Pillow + the font file, else the Arial Bold table."""

    def __init__(self, font_file):
        self.file = font_file
        self.cache = {}
        self.ok = False
        try:
            from PIL import ImageFont  # noqa: F401
            self.ok = bool(font_file)
        except Exception:
            self.ok = False

    def width(self, text, size):
        size = max(4, int(round(size)))
        if self.ok:
            try:
                from PIL import ImageFont
                f = self.cache.get(size)
                if f is None:
                    f = self.cache[size] = ImageFont.truetype(self.file, size)
                return float(f.getlength(text))
            except Exception:
                self.ok = False
        return sum((_AW[ord(c) - 32] if 32 <= ord(c) <= 126 else 600) for c in text) * size / 1000.0


def ass_time(t):
    t = max(0.0, t)
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def esc(s):
    return str(s).replace("\\", "").replace("{", "").replace("}", "").replace("\n", " ").strip()


def group_lines(words):
    """[{n, words:[...], start, end}] in order (a line = the words sharing a line number)."""
    lines = []
    for w in words:
        if not lines or lines[-1]["n"] != w.get("line", 0):
            lines.append({"n": w.get("line", 0), "words": []})
        lines[-1]["words"].append(w)
    for L in lines:
        L["start"] = min(w["start"] for w in L["words"])
        L["end"] = max(w["end"] for w in L["words"])
    return lines


def layout(line, measure, size, width):
    """Each word's left x and width, the line centred; the size shrinks to fit 90% of the frame."""
    space = measure.width(" ", size) * 0.8
    ws = [measure.width(esc(w["text"]), size) for w in line["words"]]
    total = sum(ws) + space * (len(ws) - 1)
    k = min(1.0, (0.9 * width) / total) if total > 0 else 1.0
    size_k = size * k
    ws = [x * k for x in ws]
    space *= k
    total = sum(ws) + space * (len(ws) - 1)
    x = (width - total) / 2.0
    out = []
    for w in ws:
        out.append((x, w))
        x += w + space
    return out, size_k


def circle(r):
    k = 0.5523 * r
    f = lambda v: f"{v:.1f}"  # noqa: E731
    return (f"m 0 {f(-r)} b {f(k)} {f(-r)} {f(r)} {f(-k)} {f(r)} 0 "
            f"b {f(r)} {f(k)} {f(k)} {f(r)} 0 {f(r)} "
            f"b {f(-k)} {f(r)} {f(-r)} {f(k)} {f(-r)} 0 "
            f"b {f(-r)} {f(-k)} {f(-k)} {f(-r)} 0 {f(-r)}")


def arc(x0, y0, x1, y1, t0, t1, height):
    """The ball's hop as short straight \\move pieces along a parabola: [(ta, tb, xa, ya, xb, yb)]."""
    span = max(0.01, t1 - t0)
    n = max(3, min(14, int(round(span * 12))))
    pts = []
    for i in range(n + 1):
        u = i / n
        pts.append((t0 + span * u, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - height * 4 * u * (1 - u)))
    return [(pts[i][0], pts[i + 1][0], pts[i][1], pts[i][2], pts[i + 1][1], pts[i + 1][2]) for i in range(n)]


def build(words, width, height, opts=None):
    o = opts or {}
    W, H = int(width), int(height)
    st = style_of(o)                                     # 2.380.0: the karaoke style (lib/karaokeStyle.js)
    font_file, family = find_font(st["font"]) if st["font"] else pick_font()
    if o.get("font_file") and os.path.exists(o["font_file"]):
        font_file, family = o["font_file"], o.get("font_family") or family
    m = Measure(font_file)
    G = geometry(W, H, o)
    size, r, y_cur, y_next = G["size"], G["ball_r"], G["y_cur"], G["y_next"]
    dur = float(o.get("dur") or 0) or (max((w["end"] for w in words), default=0) + 1)
    fo = float(st["font_opacity"])
    sh = int(st["text_shadow"])
    bw = max(0, int(st["border_width"]))
    shadow_col = ass_color("#000000", 50 * fo / 100.0)
    head = [
        "[Script Info]", "ScriptType: v4.00+", "WrapStyle: 2", "ScaledBorderAndShadow: yes",
        f"PlayResX: {W}", f"PlayResY: {H}", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding",
        # sung = the highlight (Primary), not yet sung = the colour (Secondary) - 2.380.0 the karaoke style
        f"Style: Sing,{family},{size},{ass_color(st['highlight'], fo)},{ass_color(st['color'], fo)},"
        f"{ass_color(st['border_color'], fo)},{shadow_col},-1,0,0,0,100,100,0,0,1,{bw},{sh},1,0,0,0,1",
        f"Style: Next,{family},{size},{ass_color(st['color'], fo * 0.78)},{ass_color(st['color'], fo * 0.78)},"
        f"{ass_color(st['border_color'], fo * 0.78)},{shadow_col},-1,0,0,0,100,100,0,0,1,{max(0, bw - 1)},0,1,0,0,0,1",
        f"Style: Ball,{family},{size},{ass_color(st['ball_color'])},{ass_color(st['ball_color'])},"
        f"{ass_color(st['ball_outline_color'])},{ass_color('#000000', 50)},0,0,0,0,100,100,0,0,1,"
        f"{max(1.5, r / 4):.1f},{max(1, size // 40)},5,0,0,0,1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    ev = []
    lines = group_lines([w for w in words if w["end"] > 0 and w["start"] < dur])
    ball = circle(r)
    # a line comes up 1.5 s before it is sung (never before the line above it is finished) and stays until the
    # next one takes its place - so ONE line (and one ball) is ever in the singing row
    shows = []
    for i, L in enumerate(lines):
        prev_end = lines[i - 1]["end"] if i > 0 else -10.0
        shows.append(max(0.0, prev_end + 0.05, L["start"] - 1.5))
    for i, L in enumerate(lines):
        show = shows[i]
        hide = min(dur, L["end"] + 0.5)
        if i + 1 < len(lines):
            hide = min(hide, shows[i + 1])
        if hide <= show:
            hide = show + 0.3
        pos, sz = layout(L, m, size, W)
        fs = f"\\fs{sz:.0f}" if abs(sz - size) > 0.5 else ""
        # the words of the line being sung (each its own event: placed exactly, swept as it is sung)
        for w, (x, ww) in zip(L["words"], pos):
            delay = max(0, int(round((w["start"] - show) * 100)))
            sweep = max(1, int(round((max(w["end"], w["start"] + 0.05) - max(w["start"], show)) * 100)))
            ev.append(f"Dialogue: 1,{ass_time(show)},{ass_time(hide)},Sing,,0,0,0,,"
                      f"{{\\an1\\pos({x:.1f},{y_cur:.1f}){fs}\\fad(120,120)\\k{delay}}}{{\\kf{sweep}}}{esc(w['text'])}")
        # the next line, dimmed, underneath
        if i + 1 < len(lines) and lines[i + 1]["start"] - L["end"] < 10:
            npos, nsz = layout(lines[i + 1], m, size * 0.82, W)
            text = " ".join(esc(w["text"]) for w in lines[i + 1]["words"])
            x0 = npos[0][0] if npos else W / 2
            ev.append(f"Dialogue: 0,{ass_time(show)},{ass_time(hide)},Next,,0,0,0,,"
                      f"{{\\an1\\pos({x0:.1f},{y_next:.1f})\\fs{nsz:.0f}\\fad(120,120)}}{text}")
        # the ball: in from the left of the first word, then word to word, landing on each as it starts
        top = y_cur - sz * 0.88 - r                      # resting on top of the letters
        cx = [x + ww / 2 for x, ww in pos]
        hop_h = lambda dx: max(sz * 0.5, min(sz * 2.0, sz * 0.6 + 0.15 * abs(dx)))  # noqa: E731
        segs = []
        t_prev, x_prev = show, cx[0] - max(sz * 1.5, 40)
        for j, w in enumerate(L["words"]):
            t_land = max(w["start"], t_prev + 0.04)
            gap = t_land - t_prev
            if gap > 1.0:                                # small bounces on the spot, then the hop
                t_hop = t_land - 0.6
                k = 0
                t = t_prev
                while t + 0.45 <= t_hop and k < 12:
                    segs += arc(x_prev, top, x_prev, top, t, t + 0.45, sz * 0.25)
                    t += 0.45
                    k += 1
                if t < t_hop:
                    segs.append((t, t_hop, x_prev, top, x_prev, top))
                t_prev = t_hop
            segs += arc(x_prev, top, cx[j], top, t_prev, t_land, hop_h(cx[j] - x_prev))
            t_prev, x_prev = t_land, cx[j]
        if t_prev < hide:
            segs.append((t_prev, hide, x_prev, top, x_prev, top))
        for (ta, tb, xa, ya, xb, yb) in segs:
            if tb <= ta:
                continue
            ev.append(f"Dialogue: 2,{ass_time(ta)},{ass_time(tb)},Ball,,0,0,0,,"
                      f"{{\\an5\\move({xa:.1f},{ya:.1f},{xb:.1f},{yb:.1f})\\p1}}{ball}{{\\p0}}")
    return "\n".join(head + ev) + "\n", (os.path.dirname(font_file) if font_file else None)
