#!/usr/bin/env python3
"""bitGen Studio — the PDF GUIDE: instructions + a shortcut-key quick view (2.391.1).

Tim (verbatim): "create a pdf with instructions and shortcut key quick view".

    python3 scripts/make_guide_pdf.py [out.pdf]        (default docs/bitGen-Studio-Guide.pdf)
    python3 scripts/make_guide_pdf.py --lang zh-CN|zh-TW|ja [out.pdf]   (2.703.0: docs/bitGen-Studio-Guide-<lang>.pdf from
        docs/i18n/<lang>/USAGE.md + shortcuts.json - a section / group not translated is printed in English; Noto Sans CJK
        embedded through scripts/cjkfont.py, CJK line breaking)

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


FALLBACK = None      # 2.703.0: in a Chinese / Japanese build, the characters the CJK font lacks but DejaVu has


def fb(markup):
    """wrap the characters the main font cannot draw (but DejaVu can) in <font name="DV"> - outside the tags only"""
    if not FALLBACK:
        return markup
    out = []
    for part in re.split(r"(<[^>]+>|&[a-z]+;|&#\d+;)", markup):
        if not part or part.startswith("<") or part.startswith("&"):
            out.append(part); continue
        out.append(re.sub("([" + re.escape("".join(sorted(FALLBACK))) + "]+)", r'<font name="DV">\1</font>', part) if any(ch in FALLBACK for ch in part) else part)
    return "".join(out)


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
        return Paragraph(fb(markup), style)
    except ValueError:
        return Paragraph(esc(re.sub(r"<[^>]+>", "", markup).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")), style)


# ------------------------------------------------------------------ styles
WRAP = None          # 2.703.0: "CJK" in a Chinese / Japanese build (lines break between any two characters)


def S(name, **k):
    base = dict(fontName=FONT, fontSize=9.6, leading=13.2, textColor=INK, spaceAfter=4)
    if WRAP:
        base["wordWrap"] = WRAP
    base.update(k)
    return ParagraphStyle(name, **base)


def styles():
  return {
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


ST = styles()


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
        blocks.append(KeepTogether([P(esc(drawable(g["title"])), ST["grp"]), t, Spacer(1, 7)]))
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
            out.append(P(esc(title), ST["h2" if lvl == 2 else "h3"]))
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
                    out.append(P(esc(drawable(m.group(1))), ST["cap"]))
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


# ------------------------------------------------------------------ 2.703.0: the Chinese / Japanese guide
WORDS = {
    "en": {"head": "Guide · v{ver}", "sub": "Instructions and shortcut keys", "ver": "Version {ver}  ·  {date}", "date": "%d %B %Y",
           "tag": "Local AI video, image, music and editing studio - ComfyUI, MiniMax H3, Wan, LTX, local LLMs",
           "parts": ["Part 1  -  Shortcut keys at a glance", "Part 2  -  Instructions (every docker, step by step)", "Credits  -  at the end of Part 2"],
           "p1": "Part 1 - Shortcut keys at a glance", "keys": "Shortcut keys at a glance",
           "keysnote": "Keys work when the docker they belong to has the pointer or the focus, and never while you type in a box. "
                       "In the image editor every menu shows its keys too, and <b>Ctrl+K</b> finds any command by name.",
           "p2": "Part 2 - Instructions", "instr": "Instructions", "toc": "Contents", "title": "Guide"},
    "zh-CN": {"head": "指南 · v{ver}", "sub": "使用说明与快捷键", "ver": "版本 {ver}  ·  {date}", "date": "%Y年%m月%d日",
              "tag": "本地 AI 视频、图像、音乐与编辑工作室 - ComfyUI、MiniMax H3、Wan、LTX、本地 LLM",
              "parts": ["第 1 部分  -  快捷键一览", "第 2 部分  -  使用说明（逐个面板、逐步讲解）", "鸣谢  -  位于第 2 部分末尾"],
              "p1": "第 1 部分 - 快捷键一览", "keys": "快捷键一览",
              "keysnote": "快捷键在指针或焦点位于其所属面板时生效，在输入框中输入时不会触发。在图像编辑器中，每个菜单也会显示其快捷键，"
                          "按 <b>Ctrl+K</b> 可按名称查找任何命令。应用的按钮和菜单为英文，因此本指南中的界面名称保留英文。",
              "p2": "第 2 部分 - 使用说明", "instr": "使用说明", "toc": "目录", "title": "指南"},
    "zh-TW": {"head": "指南 · v{ver}", "sub": "使用說明與快捷鍵", "ver": "版本 {ver}  ·  {date}", "date": "%Y年%m月%d日",
              "tag": "本機 AI 影片、圖片、音樂與剪輯工作室 - ComfyUI、MiniMax H3、Wan、LTX、本機 LLM",
              "parts": ["第 1 部分  -  快捷鍵一覽", "第 2 部分  -  使用說明（逐一介紹每個面板與步驟）", "致謝  -  位於第 2 部分末尾"],
              "p1": "第 1 部分 - 快捷鍵一覽", "keys": "快捷鍵一覽",
              "keysnote": "快捷鍵在指標或焦點位於其所屬面板時生效，在輸入框中輸入時不會觸發。在影像編輯器中，每個選單也會顯示其快捷鍵，"
                          "按 <b>Ctrl+K</b> 可依名稱尋找任何指令。應用程式的按鈕與選單為英文，因此本指南中的介面名稱保留英文。",
              "p2": "第 2 部分 - 使用說明", "instr": "使用說明", "toc": "目錄", "title": "指南"},
    "ja": {"head": "ガイド · v{ver}", "sub": "使い方とショートカットキー", "ver": "バージョン {ver}  ·  {date}", "date": "%Y年%m月%d日",
           "tag": "ローカル AI 動画・画像・音楽・編集スタジオ - ComfyUI、MiniMax H3、Wan、LTX、ローカル LLM",
           "parts": ["第 1 部  -  ショートカットキー一覧", "第 2 部  -  使い方（ドッカーごとに手順を説明）", "クレジット  -  第 2 部の最後"],
           "p1": "第 1 部 - ショートカットキー一覧", "keys": "ショートカットキー一覧",
           "keysnote": "キーは、そのキーが属するドッカーにポインターまたはフォーカスがあるときに働き、入力欄に入力している間は働きません。"
                       "画像エディターでは各メニューにもキーが表示され、<b>Ctrl+K</b> で任意のコマンドを名前で検索できます。"
                       "アプリのボタンやメニューは英語のため、このガイドでも画面上の名前は英語のまま記載しています。",
           "p2": "第 2 部 - 使い方", "instr": "使い方", "toc": "目次", "title": "ガイド"},
}
LANG = "en"


def use_lang(lang):
    """read the translated guide + shortcuts; switch the fonts to Noto Sans CJK (SC / JP) with DejaVu behind it"""
    global LANG, FONT, BOLD, ITAL, _GLYPHS, FALLBACK, WRAP, ST
    import subprocess
    # 2.705.0: the guide as the app shows it - the buttons named as the translated UI names them (one place: lib/helpI18n.js)
    tmd = subprocess.run(["node", os.path.join(ROOT, "scripts", "i18n-help.js"), "render", lang], capture_output=True, check=True).stdout.decode("utf-8")
    md = re.sub(r"^\s*<!--\s*en:[^>]*-->\s*\n", "", tmd, flags=re.M)
    sc = json.load(open(os.path.join(ROOT, "docs", "shortcuts.json"), encoding="utf-8"))
    try:
        tsc = json.load(open(os.path.join(ROOT, "docs", "i18n", lang, "shortcuts.json"), encoding="utf-8"))
    except (OSError, ValueError):
        tsc = {"groups": []}
    groups = []
    for i, g in enumerate(sc["groups"]):                 # a group with the same keys in the same order = translated
        t = tsc["groups"][i] if i < len(tsc.get("groups", [])) else None
        ok = t and len(t.get("rows", [])) == len(g["rows"]) and all(a[0] == b[0] for a, b in zip(t["rows"], g["rows"]))
        groups.append({"title": t["title"], "rows": [[r[0], r[1]] for r in t["rows"]]} if ok else g)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from cjkfont import cjk_ttf
    import tempfile
    text = md + json.dumps(groups, ensure_ascii=False) + json.dumps(WORDS[lang], ensure_ascii=False)
    fdir = os.path.join(tempfile.gettempdir(), "bitgen-cjk-fonts")
    reg, bold = cjk_ttf(lang, "Regular", text, fdir), cjk_ttf(lang, "Bold", text, fdir)
    pdfmetrics.registerFont(TTFont("CJ", reg)); pdfmetrics.registerFont(TTFont("CJ-B", bold))
    pdfmetrics.registerFontFamily("CJ", normal="CJ", bold="CJ-B", italic="CJ", boldItalic="CJ-B")
    cj = set(pdfmetrics.getFont("CJ").face.charToGlyph.keys())
    dv = set(_GLYPHS or set())
    FALLBACK = set(chr(c) for c in (dv - cj) if c > 127) if FONT == "DV" else set()
    _GLYPHS = cj | dv
    FONT, BOLD, ITAL = "CJ", "CJ-B", "CJ"
    WRAP, LANG = "CJK", lang
    ST = styles()
    return md, {"groups": groups}


# ------------------------------------------------------------------ the document
def build(out_path, lang="en"):
    ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("version", "")
    if lang != "en":
        md, sc = use_lang(lang)
    else:
        sc = json.load(open(os.path.join(ROOT, "docs", "shortcuts.json"), encoding="utf-8"))
        md = open(os.path.join(ROOT, "docs", "USAGE.md"), encoding="utf-8").read()
    w = WORDS[lang]
    credits = json.load(open(os.path.join(ROOT, "lib", "credits.json"), encoding="utf-8")).get("credits", [])
    W, H = A4
    M = 16 * mm
    width = W - 2 * M

    def deco(c, doc):
        c.saveState()
        c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)          # every page dark (the app's --ink)
        c.setStrokeColor(TIGER); c.setLineWidth(1.2); c.line(M, H - 11 * mm, W - M, H - 11 * mm)
        c.setFont(BOLD, 7.5); c.setFillColor(INK); c.drawString(M, H - 9.5 * mm, "bitGen Studio")
        c.setFont(FONT, 7.5); c.setFillColor(DIM); c.drawRightString(W - M, H - 9.5 * mm, w["head"].format(ver=ver))
        c.drawCentredString(W / 2, 8 * mm, str(doc.page))
        c.restoreState()

    def cover(c, doc):
        c.saveState()
        c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setFillColor(TIGER); c.rect(0, H * 0.62, W, 5, fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont(BOLD, 34); c.drawString(M, H * 0.70, "bitGen Studio")
        c.setFont(FONT, 15); c.setFillColor(colors.HexColor("#f2e7d6")); c.drawString(M, H * 0.665, w["sub"])
        c.setFont(FONT, 10); c.setFillColor(colors.HexColor("#b9ab95"))
        c.drawString(M, H * 0.58, w["ver"].format(ver=ver, date=date.today().strftime(w["date"])))
        c.drawString(M, H * 0.56, w["tag"])
        # 2.642.0: the credit lines (lib/credits.json - the same as Settings ▸ About and the Credits section)
        y = H * 0.515
        for cr in credits:
            c.setFont(BOLD, 11.5); c.setFillColor(colors.HexColor("#f2e7d6")); c.drawString(M, y, drawable(cr["role"] + cr.get("join", " ") + cr["name"])); y -= 17
        c.setFont(FONT, 8.5); c.setFillColor(colors.HexColor("#b9ab95"))
        y = H * 0.40
        for line in w["parts"]:
            c.drawString(M, y, line); y -= 14
        c.restoreState()

    doc = BaseDocTemplate(out_path, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=15 * mm, bottomMargin=14 * mm,
                          title=f"bitGen Studio {ver} - {w['title']}", author="bitGen Studio", subject=w["sub"], lang=lang)
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
    story += [Bookmark(w["p1"], 0, "p1"), P(w["keys"], ST["h1"]), P(w["keysnote"], ST["body"]), Spacer(1, 4)]
    story += shortcut_tables(sc["groups"], colw)
    story += [NextPageTemplate("text"), PageBreak()]
    story += [Bookmark(w["p2"], 0, "p2"), P(w["instr"], ST["h1"]), P(f"<b>{w['toc']}</b>", ST["h3"])]
    toc = [[P(f'<link href="#{k}" color="#e8e2d6">{esc(t)}</link>', ST["toc"])] for lvl, t, k in heads if lvl == 2]
    half = (len(toc) + 1) // 2
    rows = [[toc[r][0] if r < len(toc) else "", toc[r + half][0] if r + half < len(toc) else ""] for r in range(half)]
    tt = Table(rows, colWidths=[width / 2, width / 2])
    tt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 0.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [tt, PageBreak()]
    story += flow
    doc.build(story)
    return {"version": ver, "headings": len(heads), "shortcut_groups": len(sc["groups"]), "lang": lang}


if __name__ == "__main__":
    a = sys.argv[1:]
    lang = "en"
    if "--lang" in a:
        i = a.index("--lang"); lang = a[i + 1]; del a[i:i + 2]
        if lang not in WORDS or lang == "en":
            sys.exit("--lang: zh-CN, zh-TW or ja")
    out = a[0] if a else os.path.join(ROOT, "docs", "bitGen-Studio-Guide" + ("" if lang == "en" else "-" + lang) + ".pdf")
    r = build(out, lang)
    print(json.dumps(dict(r, out=out)))
