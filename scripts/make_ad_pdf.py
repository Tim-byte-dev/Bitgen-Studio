#!/usr/bin/env python3
"""bitGen Studio — THE BROCHURE (2.392.0): docs/bitGen-Studio-Brochure.pdf, a 3-page advert for the studio.

Tim (verbatim): "create a pdf as an ad for bitgen studio - keep the dark theme everywhere, do the same with the
instructions - keep bitgen theme".

    python3 scripts/make_ad_pdf.py [out.pdf]

Every page is the app's own dark palette (static/index.html :root - ink #14120f, panel #1d1a15, the tiger orange
#f59e2c, text #e8e2d6), the pictures are the studio's own screens (docs/images/ad-*.jpg - remake them with
scripts/adshots when the look changes). Only what the studio does today is claimed: every feature line is checked
against the code by scripts/test-guidepdf.py. Run it with the guide after a version change (the footer carries it).
"""
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG, PANEL, PANEL2 = colors.HexColor("#14120f"), colors.HexColor("#1d1a15"), colors.HexColor("#26221b")
LINE, TEXT, DIM = colors.HexColor("#3a342a"), colors.HexColor("#e8e2d6"), colors.HexColor("#9a917f")
TIGER, DEEP = colors.HexColor("#f59e2c"), colors.HexColor("#c4761a")

FONT, BOLD = "Helvetica", "Helvetica-Bold"
for d in ("/usr/share/fonts/truetype/dejavu", "C:/Windows/Fonts", "/Library/Fonts"):
    reg, bold = os.path.join(d, "DejaVuSans.ttf"), os.path.join(d, "DejaVuSans-Bold.ttf")
    if os.path.exists(reg) and os.path.exists(bold):
        pdfmetrics.registerFont(TTFont("DV", reg)); pdfmetrics.registerFont(TTFont("DV-B", bold))
        pdfmetrics.registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV", boldItalic="DV-B")
        FONT, BOLD = "DV", "DV-B"
        break

# the features (each line is something the studio does now - scripts/test-guidepdf.py checks the code for it)
FEATURES = [
    ("Scene board & screenplay", "Ask the local LLM for a screenplay; it writes the scenes. Characters, voices and "
     "360° locations stay the same from scene to scene. Every card shows its take, \"rendering step n of total\" and a scene picker keeps the board tidy."),
    ("Your video models", "MiniMax H3 (references, first / last frame, text), Wan 2.1 and 2.2 - subjects that follow a "
     "path you draw - and LTX 2.5, all through your own ComfyUI. Append or prepend a clip and it continues seamlessly."),
    ("A full image editor", "Layers, groups, masks, adjustment layers, layer styles, 41 filters, type and shapes. "
     "Open and save PSD files. Segment Anything selects a thing with one click - or from words: \"the person's head\"."),
    ("AI that edits", "Qwen Image Edit, FLUX Kontext and FLUX.2 Klein: regenerate a selection, remove an object, or "
     "Compose - put the dog from one layer on the sofa in another. Control layers guide every render."),
    ("A real timeline", "Video, audio, image, text, 3D and path layers with keyframes, transitions and karaoke lyrics. "
     "Blender bridge for 3D. Compile it all into one film."),
    ("Music & sound", "Write songs and covers, split stems, cut sound effects out of any video, lip-sync performers and "
     "build a music video scene by scene from the song."),
    ("Swap, perform, explore", "Swap a character into a reference video, put a performer inside a 360° world, cut "
     "subjects out of a green screen and move them along a path."),
    ("Your layout, kept", "Dockers float, snap and pin. ⊞ Docker configs remembers the sizes for every combination of "
     "dockers you open - and fits them to whatever screen you are on."),
]
STEPS = [("1", "Write", "Type an idea - or let the prompt chat and the screenplay writer turn it into scenes."),
         ("2", "Cast", "Make characters from one picture: a sheet, a voice, a look that holds across the film."),
         ("3", "Render", "Scene by scene on your own GPU, watching every step. Redo a take, keep the best."),
         ("4", "Finish", "Cut on the timeline, add music and lyrics, touch up stills in the editor, compile.")]
PROMISES = ["Runs on your own computer - your projects are plain folders on your disk",
            "Uses the ComfyUI and the models you already have, and local LLMs for writing",
            "No account and no sign-up - after the one-time model downloads it works offline",
            "Every docker sized the way you like it, on every screen you use"]


def para(text, size, color=TEXT, leading=None, bold=False):
    st = ParagraphStyle("p", fontName=BOLD if bold else FONT, fontSize=size, leading=leading or size * 1.38, textColor=color, alignment=TA_LEFT)
    return Paragraph(text, st)


def draw_para(c, text, x, y_top, w, size, color=TEXT, leading=None, bold=False):
    p = para(text, size, color, leading, bold)
    _, h = p.wrap(w, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def bg(c, W, H):
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)


def framed(c, path, x, y, w, glow=True):
    img = ImageReader(path)
    iw, ih = img.getSize()
    h = w * ih / iw
    if glow:
        for i, a in enumerate((0.10, 0.16, 0.24)):
            c.setFillColor(colors.Color(0.96, 0.62, 0.17, alpha=a))
            pad = (3 - i) * 2.2
            c.roundRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad, 6 + pad, fill=1, stroke=0)
    c.setFillColor(PANEL); c.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 5, fill=1, stroke=0)
    c.drawImage(img, x, y, w, h, mask="auto")
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 5, fill=0, stroke=1)
    return h


def pill(c, x, y, text, size=8.6):
    w = pdfmetrics.stringWidth(text, BOLD, size) + 16
    c.setFillColor(PANEL2); c.setStrokeColor(DEEP); c.setLineWidth(0.8)
    c.roundRect(x, y, w, size + 10, (size + 10) / 2, fill=1, stroke=1)
    c.setFillColor(TIGER); c.setFont(BOLD, size); c.drawString(x + 8, y + 5.6, text)
    return w


def footer(c, W, ver, n):
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(16 * mm, 14 * mm, W - 16 * mm, 14 * mm)
    c.setFont(BOLD, 8); c.setFillColor(TIGER); c.drawString(16 * mm, 9 * mm, "bitGen Studio")
    c.setFont(FONT, 8); c.setFillColor(DIM)
    c.drawRightString(W - 16 * mm, 9 * mm, f"v{ver}  ·  {n} / 3")


def build(out):
    ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("version", "")
    W, H = A4
    M = 16 * mm
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(f"bitGen Studio {ver} - your AI film studio"); c.setAuthor("bitGen Studio"); c.setSubject("bitGen Studio brochure")

    # ---------------- page 1: the hero
    bg(c, W, H)
    c.setFillColor(TIGER); c.rect(0, H - 6, W, 6, fill=1, stroke=0)
    c.setFont(BOLD, 10); c.setFillColor(TIGER); c.drawString(M, H - 26 * mm, "LOCAL  AI  FILM  STUDIO")
    c.setFont(BOLD, 46); c.setFillColor(TEXT); c.drawString(M, H - 44 * mm, "bitGen Studio")
    y = H - 52 * mm
    y -= draw_para(c, "Your whole AI film studio - <font color='#f59e2c'>on your own computer.</font>", M, y, W - 2 * M, 19, TEXT, 24, True) + 4 * mm
    y -= draw_para(c, "Write it, cast it, render it, score it, cut it. Video, pictures, music and editing in one window, "
                   "driven by the models on your own machine. Your ideas and your files stay yours.", M, y, W - 2 * M - 20 * mm, 11.5, DIM, 16.5) + 7 * mm
    x = M
    for t in ("100% local", "ComfyUI inside", "Video · Image · Music · Edit", "One window, every step"):
        x += pill(c, x, y - 18, t) + 6
    y -= 19 * mm
    ih = framed(c, os.path.join(ROOT, "docs", "images", "ad-editor.jpg"), M, y - (W - 2 * M) * 1013 / 1800, W - 2 * M)
    yb = y - ih - 9 * mm
    yb -= draw_para(c, "<b>The image editor</b> - layers, masks, styles and filters, with AI fill, edit, "
                    "Compose and Segment Anything built in.", M, yb, W - 2 * M, 9.5, DIM, 13) + 9 * mm
    # what is inside - three columns
    cols = [("VIDEO", "MiniMax H3 · Wan 2.1 / 2.2 · LTX 2.5", "scenes, characters, voices, swaps, VR worlds"),
            ("PICTURES", "Qwen Image · FLUX · SDXL and more", "styles, LoRAs, ControlNet, face fix, editing"),
            ("SOUND", "songs · covers · stems · SFX", "lyrics, karaoke, lip-sync, music videos")]
    cw = (W - 2 * M - 2 * 5 * mm) / 3
    for i, (h, a, b) in enumerate(cols):
        x0 = M + i * (cw + 5 * mm)
        c.setFillColor(PANEL); c.setStrokeColor(LINE); c.setLineWidth(0.7); c.roundRect(x0, yb - 36 * mm, cw, 36 * mm, 6, fill=1, stroke=1)
        c.setFillColor(TIGER); c.setFont(BOLD, 9); c.drawString(x0 + 5 * mm, yb - 8 * mm, h)
        h1 = draw_para(c, a, x0 + 5 * mm, yb - 10.5 * mm, cw - 10 * mm, 10, TEXT, 13, True)
        draw_para(c, b, x0 + 5 * mm, yb - 10.5 * mm - h1 - 2 * mm, cw - 10 * mm, 8.6, DIM, 11.6)
    footer(c, W, ver, 1)
    c.showPage()

    # ---------------- page 2: the features
    bg(c, W, H)
    c.setFillColor(TIGER); c.rect(0, H - 6, W, 6, fill=1, stroke=0)
    c.setFont(BOLD, 10); c.setFillColor(TIGER); c.drawString(M, H - 22 * mm, "WHAT IT DOES")
    c.setFont(BOLD, 26); c.setFillColor(TEXT); c.drawString(M, H - 33 * mm, "Everything a film needs")
    gap = 5 * mm
    cw = (W - 2 * M - gap) / 2
    ch = 52 * mm
    top = H - 42 * mm
    for i, (t, body) in enumerate(FEATURES):
        col, row = i % 2, i // 2
        x0 = M + col * (cw + gap)
        y0 = top - row * (ch + gap)
        c.setFillColor(PANEL); c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.roundRect(x0, y0 - ch, cw, ch, 6, fill=1, stroke=1)
        c.setFillColor(TIGER); c.roundRect(x0, y0 - ch, 3.2, ch, 1.6, fill=1, stroke=0)
        c.setFont(BOLD, 12.5); c.setFillColor(TIGER); c.drawString(x0 + 9 * mm / 1.6, y0 - 9 * mm, t)
        draw_para(c, body, x0 + 9 * mm / 1.6, y0 - 12.5 * mm, cw - 10 * mm, 9.4, TEXT, 13.4)
    footer(c, W, ver, 2)
    c.showPage()

    # ---------------- page 3: the workflow + the promise
    bg(c, W, H)
    c.setFillColor(TIGER); c.rect(0, H - 6, W, 6, fill=1, stroke=0)
    c.setFont(BOLD, 10); c.setFillColor(TIGER); c.drawString(M, H - 22 * mm, "HOW IT FLOWS")
    c.setFont(BOLD, 26); c.setFillColor(TEXT); c.drawString(M, H - 33 * mm, "From one prompt to a finished film")
    sw = (W - 2 * M - 3 * 4 * mm) / 4
    y0 = H - 42 * mm
    for i, (n, t, body) in enumerate(STEPS):
        x0 = M + i * (sw + 4 * mm)
        c.setFillColor(PANEL); c.setStrokeColor(LINE); c.roundRect(x0, y0 - 46 * mm, sw, 46 * mm, 6, fill=1, stroke=1)
        c.setFillColor(TIGER); c.circle(x0 + 9 * mm, y0 - 9 * mm, 5 * mm, fill=1, stroke=0)
        c.setFillColor(BG); c.setFont(BOLD, 13); c.drawCentredString(x0 + 9 * mm, y0 - 11.2 * mm, n)
        c.setFillColor(TEXT); c.setFont(BOLD, 12); c.drawString(x0 + 16 * mm, y0 - 11 * mm, t)
        draw_para(c, body, x0 + 4 * mm, y0 - 18 * mm, sw - 8 * mm, 8.8, DIM, 12.4)
    y = y0 - 54 * mm
    ih = framed(c, os.path.join(ROOT, "docs", "images", "ad-layout.jpg"), M, y - (W - 2 * M) * 1013 / 1800, W - 2 * M)
    y = y - ih - 6 * mm
    y -= draw_para(c, "<b>Your workspace, your way</b> - open the dockers you need together, size them once, press "
                   "<font color='#f59e2c'>⊞ Docker configs ▸ Save</font>. Next time they open exactly like that, on any screen.", M, y, W - 2 * M, 9.5, DIM, 13) + 6 * mm
    c.setFillColor(PANEL2); c.setStrokeColor(DEEP); c.setLineWidth(0.8)
    bh = 44 * mm
    c.roundRect(M, y - bh, W - 2 * M, bh, 8, fill=1, stroke=1)
    c.setFont(BOLD, 15); c.setFillColor(TEXT); c.drawString(M + 7 * mm, y - 10 * mm, "Built for people who own their tools")
    yy = y - 15 * mm
    for t in PROMISES:
        c.setFillColor(TIGER); c.circle(M + 9 * mm, yy - 3.2, 2.2, fill=1, stroke=0)
        yy -= draw_para(c, t, M + 13 * mm, yy, W - 2 * M - 20 * mm, 10, TEXT, 14) + 2.2 * mm
    c.setFont(BOLD, 18); c.setFillColor(TIGER)
    c.drawCentredString(W / 2, 24 * mm, "Install it.  Open it.  Make your film.")
    footer(c, W, ver, 3)
    c.showPage()
    c.save()
    return {"version": ver, "pages": 3, "features": len(FEATURES)}


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "bitGen-Studio-Brochure.pdf")
    r = build(out)
    print(json.dumps(dict(r, out=out)))
