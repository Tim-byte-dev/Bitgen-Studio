"""bitGen Studio — the timeline's CAPTION track burned into the compile, and its .srt beside the movie (2.406.0).

Tim: "lets start closing the gap and go with your suggestions as you see fit" (caption tracks from the transcript).

captions = {cues: [{start, end, text}], style: {font, size (% of the picture's height), color, outline (px at 1080),
            outline_color, box (a band behind the words), box_color, box_opacity, position: bottom | top | middle,
            margin (% of the height), bold}, burn: bool, srt: bool}
ass(captions, w, h) -> the ASS text (libass, ffmpeg's subtitles filter); srt(cues) -> the SubRip text.
The page's canvas draws the same cues with the same numbers (ext/timelinedock/captions.js), scaled to the preview.
"""


def _t_ass(t):
    t = max(0.0, float(t))
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    cs = int(round((s - int(s)) * 100))
    si = int(s)
    if cs == 100:
        si, cs = si + 1, 0
    return f"{h}:{m:02d}:{si:02d}.{cs:02d}"


def _t_srt(t):
    t = max(0.0, float(t))
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _bgr(hexc, alpha=0):
    h = str(hexc or "#ffffff").lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except (ValueError, IndexError):
        r, g, b = 255, 255, 255
    return f"&H{int(alpha):02X}{b:02X}{g:02X}{r:02X}"


def _esc(text):
    return str(text or "").replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\r", "").replace("\n", "\\N")


def ass(captions, w, h):
    st = (captions or {}).get("style") or {}
    w, h = int(w or 1920), int(h or 1080)
    size = max(8, int(round(h * max(1.0, min(20.0, float(st.get("size") or 5.5))) / 100)))
    outline = max(0.0, min(20.0, float(st.get("outline") if st.get("outline") is not None else 2.5))) * h / 1080
    pos = st.get("position") or "bottom"
    align = {"bottom": 2, "top": 8, "middle": 5}.get(pos, 2)
    margin = int(round(h * max(0.0, min(40.0, float(st.get("margin") if st.get("margin") is not None else 6))) / 100))
    box = bool(st.get("box"))
    box_alpha = int(round(255 * (1 - max(0.0, min(1.0, float(st.get("box_opacity") if st.get("box_opacity") is not None else 0.6))))))
    style = ("Style: Cap," + str(st.get("font") or "Arial").replace(",", " ") + f",{size},"
             + _bgr(st.get("color") or "#ffffff") + ",&H000000FF,"
             + (_bgr(st.get("box_color") or "#000000", box_alpha) if box else _bgr(st.get("outline_color") or "#000000")) + ","
             + (_bgr(st.get("box_color") or "#000000", box_alpha) if box else "&H80000000") + ","
             + ("-1" if st.get("bold", True) else "0") + ",0,0,0,100,100,0,0,"
             + ("3" if box else "1") + f",{(size * 0.18 if box else outline):.1f},{0 if box else outline * 0.4:.1f},"
             + f"{align},{int(w * 0.06)},{int(w * 0.06)},{margin},1")
    lines = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {w}", f"PlayResY: {h}", "WrapStyle: 0",
             "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
             "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
             "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
             "MarginR, MarginV, Encoding", style, "", "[Events]",
             "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for c in cues(captions):
        lines.append(f"Dialogue: 0,{_t_ass(c['start'])},{_t_ass(c['end'])},Cap,,0,0,0,,{_esc(c['text'])}")
    return "\n".join(lines) + "\n"


def cues(captions):
    out = []
    for c in (captions or {}).get("cues") or []:
        try:
            a, b = float(c.get("start")), float(c.get("end"))
        except (TypeError, ValueError):
            continue
        t = str(c.get("text") or "").strip()
        if t and b > a:
            out.append({"start": a, "end": b, "text": t})
    out.sort(key=lambda c: c["start"])
    return out


def srt(captions):
    return "\n".join(f"{i}\n{_t_srt(c['start'])} --> {_t_srt(c['end'])}\n{c['text']}\n"
                     for i, c in enumerate(cues(captions), start=1))
