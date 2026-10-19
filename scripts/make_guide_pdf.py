#!/usr/bin/env python3
"""bitGen Studio — the PDF GUIDE: instructions + a shortcut-key quick view (2.391.1).

Tim (verbatim): "create a pdf with instructions and shortcut key quick view".

    python3 scripts/make_guide_pdf.py [out.pdf]        (default docs/bitGen-Studio-Guide.pdf)

Built from the app's own files, so it is made again for every release and never drifts:
  docs/shortcuts.json   the shortcut groups (the image editor's rows were read from its command table)
  docs/USAGE.md         the instructions (headings, paragraphs, lists, tables, pictures from docs/images)
  package.json          the version on the cover and every page
Needs reportlab (pip install reportlab). DejaVu Sans is used when the machine has it (it draws ← → ▸ ✔ ⏫ …);
a character no font here can draw (most emoji) is left out rather than printed as a black box.
"""
import json
import os
import re
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether, ListFlowable, ListItem, PageBreak,
                                PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle, Flowable)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 2.392.0 (Tim: "keep the dark theme everywhere, do the same with the instructions - keep bitgen theme"): the app's own
# palette (static/index.html :root) - every page dark, the text light, the tiger orange for headings and keys
BG = colors.HexColor("#14120f")        # --ink   (the page)
PANEL = colors.HexColor("#1d1a15")     # --panel
TIGER = colors.HexColor("#f59e2c")     # --tiger
INK = colors.HexColor("#e8e2d6")       # --text  (the words)
DIM = colors.HexColor("#9a917f")       # --dim
LINE = colors.HexColor("#3a342a")      # --line
CHIP = colors.HexColor("#26221b")      # --panel-2 (key chips, code, table heads)

# ------------------------------------------------------------------ fonts
FONT, BOLD, ITAL, MONO = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier"
_GLYPHS = None
for d in ("/usr/share/fonts/truetype/dejavu", "C:/Windows/Fonts", "/Library/Fonts"):
    reg, bold, ital, mono = (os.path.join(d, f) for f in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf", "DejaVuSansMono.ttf"))
    if all(os.path.exists(f) for f in (reg, bold, ital, mono)):
        pdfmetrics.registerFont(TTFont("DV", reg)); pdfmetrics.registerFont(TTFont("DV-B", bold))
        pdfmetrics.registerFont(TTFont("DV-I", ital)); pdfmetrics.registerFont(TTFont("DV-M", mono))
        pdfmetrics.registerFontFamily("DV", normal="DV", bold="DV-B", italic="DV-I", boldItalic="DV-B")
        FONT, BOLD, ITAL, MONO = "DV", "DV-B", "DV-I", "DV-M"
        _GLYPHS = set(pdfmetrics.getFont("DV").face.charToGlyph.keys()) & set(pdfmetrics.getFont("DV-M").face.charToGlyph.keys()) | set(range(32, 127))
        break


def drawable(text):
    """the characters the fonts can draw (an emoji with no glyph is dropped, its variation selector too)"""
    out = []
    for ch in str(text):
        o = ord(ch)
        if o in (0xFE0F, 0x200D):
            continue
        if _GLYPHS is None:
            out.append(ch if o < 256 else "")
        elif o in _GLYPHS or ch in "\n\t":
            out.append(ch)
    return re.sub(r"[ ]{2,}", " ", "".join(out))


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


ANCHORS = set()


def slug(title):
    """GitHub's heading anchor: lower case, punctuation gone, spaces -> -"""
    t = re.sub(r"[^\w\s-]", "", str(title).lower(), flags=re.UNICODE)
    return re.sub(r"\s", "-", t.strip())


def _link(m):
    text, href = m.group(1), m.group(2)
    if href.startswith("#"):
        return f'<link href="{href}" color="#f59e2c">{text}</link>' if href[1:] in ANCHORS else text
    return f'<link href="{href}" color="#f59e2c">{text}</link>' if re.match(r"^[a-z]+:", href) else text


def inline(md):
    """markdown inline -> reportlab markup: `code`, **bold**, *italic*, [text](url), \\ escapes"""
    t = drawable(md)
    t = re.sub(r"\*\*\s*\*\*", "", t)            # a bold that held only an emoji (dropped) is gone too
    parts = re.split(r"(`[^`]+`)", t)
    out = []
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append(f'<font face="{MONO}" size="8.5" backColor="#26221b" color="#f5c27a">{esc(p[1:-1])}</font>')
            continue
        p = esc(p.replace("\\\\", "\x00").replace("\\", "").replace("\x00", "\\"))
        p = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", p)
        p = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", p)
        p = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _link, p)
        out.append(p)
    return "".join(out).strip()


def P(markup, style):
    """a Paragraph - and if the markdown's markup does not nest (a stray * or **), the same words without it"""
    try:
        return Paragraph(markup, style)
    except ValueError:
        return Paragraph(esc(re.sub(r"<[^>]+>", "", markup).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")), style)


# ------------------------------------------------------------------ styles
def S(name, **k):
    base = dict(fontName=FONT, fontSize=9.6, leading=13.2, textColor=INK, spaceAfter=4)
    base.update(k)
    return ParagraphStyle(name, **base)


ST = {
    "body": S("body"),
    "h1": S("h1", fontName=BOLD, fontSize=19, leading=24, spaceBefore=4, spaceAfter=10, textColor=INK),
    "h2": S("h2", fontName=BOLD, fontSize=13.5, leading=17, spaceBefore=12, spaceAfter=6, textColor=TIGER, keepWithNext=1),
    "h3": S("h3", fontName=BOLD, fontSize=11, leading=14, spaceBefore=8, spaceAfter=4, keepWithNext=1),
    "cell": S("cell", fontSize=8.6, leading=11, spaceAfter=0),
    "cellb": S("cellb", fontName=BOLD, fontSize=8.6, leading=11, spaceAfter=0),
    "key": S("key", fontName=BOLD, fontSize=8.4, leading=10.5, spaceAfter=0, textColor=INK),
    "grp": S("grp", fontName=BOLD, fontSize=10, leading=13, spaceBefore=2, spaceAfter=3, textColor=TIGER),
    "toc": S("toc", fontSize=9.4, leading=13, spaceAfter=0),
    "sub": S("sub", leftIndent=10, spaceAfter=2),
    "cap": S("cap", fontName=ITAL, fontSize=8, leading=10, textColor=DIM, alignment=TA_CENTER, spaceAfter=8),
    "code": S("code", fontName=MONO, fontSize=8, leading=10.5, backColor=CHIP, borderPadding=4, spaceAfter=6),
}


class Bookmark(Flowable):
    """an outline entry (the PDF's sidebar) where it stands"""
    def __init__(self, title, level, key):
        super().__init__()
        self.title, self.level, self.key = title, level, key
        self.width = self.height = 0

    def draw(self):
        c = self.canv
        c.bookmarkPage(self.key)
        c.addOutlineEntry(self.title, self.key, level=self.level, closed=self.level > 0)


# ------------------------------------------------------------------ the shortcut quick view
def key_chip(k):
    return Paragraph(f'<font backColor="#26221b" color="#f59e2c">&nbsp;{esc(drawable(k))}&nbsp;</font>', ST["key"])


def shortcut_tables(groups, col_w):
    blocks = []
    for g in groups:
        rows = [[key_chip(k), P(inline(v), ST["cell"])] for k, v in g["rows"]]
        t = Table(rows, colWidths=[col_w * 0.36, col_w * 0.64])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
                               ("TOPPADDING", (0, 0), (-1, -1), 2.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
                               ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
        blocks.append(KeepTogether([Paragraph(esc(drawable(g["title"])), ST["grp"]), t, Spacer(1, 7)]))
    return blocks


# ------------------------------------------------------------------ USAGE.md -> flowables
def md_flowables(md, img_dir, width):
    out, heads = [], []
    lines = md.split("\n")
    ANCHORS.clear()
    for ln in lines:
        mh = re.match(r"^#{2,3}\s+(.*)$", ln.strip())
        if mh:
            ANCHORS.add(slug(mh.group(1)))
    i, n_h = 0, 0
    para = []

    def flush():
        if para:
            out.append(P(inline(" ".join(x.strip() for x in para)), ST["body"]))
            para.clear()

    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if s.startswith("```"):
            flush()
            j = i + 1
            buf = []
            while j < len(lines) and not lines[j].strip().startswith("```"):
                buf.append(drawable(lines[j])); j += 1
            out.append(Preformatted("\n".join(buf), ST["code"]))
            i = j + 1
            continue
        m = re.match(r"^(#{1,3})\s+(.*)$", s)
        if m:
            flush()
            lvl = len(m.group(1))
            title = drawable(re.sub(r"[*`]", "", m.group(2))).strip()
            if lvl == 1:
                i += 1
                continue                      # the document's own title - the part's heading stands for it
            n_h += 1
            key = slug(m.group(2)) or f"h{n_h}"
            heads.append((lvl, title, key))
            out.append(Bookmark(title, lvl - 1, key))
            out.append(Paragraph(esc(title), ST["h2" if lvl == 2 else "h3"]))
            i += 1
            continue
        m = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)", s)
        if m:
            flush()
            p = os.path.join(img_dir, os.path.basename(m.group(2)))
            if os.path.exists(p):
                try:
                    from reportlab.lib.utils import ImageReader
                    iw, ih = ImageReader(p).getSize()
                    w = min(width, iw * 0.6)
                    h = w * ih / iw
                    if h > 120 * mm:
                        h = 120 * mm; w = h * iw / ih
                    out.append(Image(p, width=w, height=h))
                    out.append(Paragraph(esc(drawable(m.group(1))), ST["cap"]))
                except Exception:  # noqa: BLE001 - a picture that will not load is skipped
                    pass
            i += 1
            continue
        if s.startswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            rows = [r for r in rows if any(r)]
            if rows:
                nc = max(len(r) for r in rows)
                data = [[P(inline(c), ST["cell"]) for c in r + [""] * (nc - len(r))] for r in rows]
                cw = [width * (0.28 if nc == 2 and k == 0 else (0.72 if nc == 2 else 1.0 / nc)) for k in range(nc)]
                t = Table(data, colWidths=cw, repeatRows=0)
                t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.3, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                       ("BACKGROUND", (0, 0), (0, -1), CHIP), ("TOPPADDING", (0, 0), (-1, -1), 3),
                                       ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
                out.append(t)
                out.append(Spacer(1, 6))
            continue
        bm = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", ln)
        if bm:
            flush()
            ordered = bm.group(2)[0].isdigit()
            items = []
            base_indent = len(bm.group(1))
            while i < len(lines):
                m2 = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                if m2 and len(m2.group(1)) <= base_indent + 1 and (m2.group(2)[0].isdigit()) == ordered:
                    items.append([m2.group(3)])
                    i += 1
                    continue
                if m2 and items and len(m2.group(1)) > base_indent + 1:      # a nested item: a line of its own INSIDE its parent
                    items[-1].append("\x01" + m2.group(3))
                    i += 1
                    continue
                if items and lines[i].strip() and (lines[i].startswith(" ") or lines[i].startswith("\t")) and not lines[i].strip().startswith("|") \
                        and not re.match(r"^\s*!\[", lines[i]):
                    items[-1].append(lines[i].strip())
                    i += 1
                    continue
                break
            def item(it):
                blocks, cur = [], []
                for x in it:
                    if x.startswith("\x01"):
                        if cur: blocks.append(P(inline(" ".join(cur)), ST["body"])); cur = []
                        blocks.append(P("– " + inline(x[1:]), ST["sub"]))
                    elif blocks and blocks[-1].style is ST["sub"]:
                        blocks[-1] = P(blocks[-1].text + " " + inline(x), ST["sub"])
                    else:
                        cur.append(x)
                if cur: blocks.append(P(inline(" ".join(cur)), ST["body"]))
                return ListItem(blocks, leftIndent=12)
            lf = ListFlowable([item(it) for it in items],
                              bulletType="1" if ordered else "bullet", start="1" if ordered else None,
                              bulletFontName=FONT, bulletFontSize=8 if not ordered else 9, leftIndent=14,
                              bulletColor=TIGER if not ordered else INK)
            out.append(lf)
            continue
        if not s:
            flush()
            i += 1
            continue
        para.append(ln)
        i += 1
    flush()
    return out, heads


# ------------------------------------------------------------------ the document
def build(out_path):
    ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("version", "")
    sc = json.load(open(os.path.join(ROOT, "docs", "shortcuts.json"), encoding="utf-8"))
    md = open(os.path.join(ROOT, "docs", "USAGE.md"), encoding="utf-8").read()
    W, H = A4
    M = 16 * mm
    width = W - 2 * M

    def deco(c, doc):
        c.saveState()
        c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)          # every page dark (the app's --ink)
        c.setStrokeColor(TIGER); c.setLineWidth(1.2); c.line(M, H - 11 * mm, W - M, H - 11 * mm)
        c.setFont(BOLD, 7.5); c.setFillColor(INK); c.drawString(M, H - 9.5 * mm, "bitGen Studio")
        c.setFont(FONT, 7.5); c.setFillColor(DIM); c.drawRightString(W - M, H - 9.5 * mm, f"Guide · v{ver}")
        c.drawCentredString(W / 2, 8 * mm, str(doc.page))
        c.restoreState()

    def cover(c, doc):
        c.saveState()
        c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setFillColor(TIGER); c.rect(0, H * 0.62, W, 5, fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont(BOLD, 34); c.drawString(M, H * 0.70, "bitGen Studio")
        c.setFont(FONT, 15); c.setFillColor(colors.HexColor("#f2e7d6")); c.drawString(M, H * 0.665, "Instructions and shortcut keys")
        c.setFont(FONT, 10); c.setFillColor(colors.HexColor("#b9ab95"))
        c.drawString(M, H * 0.58, f"Version {ver}  ·  {date.today().strftime('%d %B %Y')}")
        c.drawString(M, H * 0.56, "Local AI video, image, music and editing studio - ComfyUI, MiniMax H3, Wan, LTX, local LLMs")
        c.setFont(FONT, 8.5)
        y = H * 0.44
        for line in ["Part 1  -  Shortcut keys at a glance", "Part 2  -  Instructions (every docker, step by step)"]:
            c.drawString(M, y, line); y -= 14
        c.restoreState()

    doc = BaseDocTemplate(out_path, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=15 * mm, bottomMargin=14 * mm,
                          title=f"bitGen Studio {ver} - Guide", author="bitGen Studio", subject="Instructions and shortcut keys")
    full = Frame(M, 14 * mm, width, H - 29 * mm, id="full")
    gap = 6 * mm
    colw = (width - gap) / 2
    left = Frame(M, 14 * mm, colw, H - 29 * mm, id="l")
    right = Frame(M + colw + gap, 14 * mm, colw, H - 29 * mm, id="r")
    doc.addPageTemplates([PageTemplate(id="cover", frames=[full], onPage=cover),
                          PageTemplate(id="keys", frames=[left, right], onPage=deco),
                          PageTemplate(id="text", frames=[full], onPage=deco)])
    flow, heads = md_flowables(md, os.path.join(ROOT, "docs", "images"), width)
    story = [Spacer(1, 1)]
    from reportlab.platypus.doctemplate import NextPageTemplate
    story += [NextPageTemplate("keys"), PageBreak()]
    story += [Bookmark("Part 1 - Shortcut keys at a glance", 0, "p1"),
              Paragraph("Shortcut keys at a glance", ST["h1"]),
              Paragraph("Keys work when the docker they belong to has the pointer or the focus, and never while you type in a box. "
                        "In the image editor every menu shows its keys too, and <b>Ctrl+K</b> finds any command by name.", ST["body"]),
              Spacer(1, 4)]
    story += shortcut_tables(sc["groups"], colw)
    story += [NextPageTemplate("text"), PageBreak()]
    story += [Bookmark("Part 2 - Instructions", 0, "p2"), Paragraph("Instructions", ST["h1"]),
              Paragraph("<b>Contents</b>", ST["h3"])]
    toc = [[Paragraph(f'<link href="#{k}" color="#e8e2d6">{esc(t)}</link>', ST["toc"])] for lvl, t, k in heads if lvl == 2]
    half = (len(toc) + 1) // 2
    rows = [[toc[r][0] if r < len(toc) else "", toc[r + half][0] if r + half < len(toc) else ""] for r in range(half)]
    tt = Table(rows, colWidths=[width / 2, width / 2])
    tt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 0.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [tt, PageBreak()]
    story += flow
    doc.build(story)
    return {"version": ver, "headings": len(heads), "shortcut_groups": len(sc["groups"])}


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "bitGen-Studio-Guide.pdf")
    r = build(out)
    print(json.dumps(dict(r, out=out)))
