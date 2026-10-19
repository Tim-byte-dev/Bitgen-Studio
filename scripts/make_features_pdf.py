#!/usr/bin/env python3
"""bitGen Studio — the FEATURE REFERENCE PDF (2.473.0): every feature so far, by area.

Tim (verbatim): "create a pdf documenting all the features of bitgen studio so far."

    python3 scripts/make_features_pdf.py [out.pdf]     (default docs/bitGen-Studio-Features.pdf)

Built from docs/FEATURES.md (areas `##`, sub-areas `###`, one bullet per feature: `- **Name** — what it does.
*Where:* … *Since:* …`) and package.json (the version), in the Guide's dark bitGen look (scripts/make_guide_pdf.py's
palette, fonts and helpers): a cover, the areas at a glance (how many features each), then the catalogue - each
feature its name, what it does, and where it is / since which version in a quieter line. PDF bookmarks per area and
sub-area. Needs reportlab.
"""
import importlib.util
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("bg_guide", os.path.join(ROOT, "scripts", "make_guide_pdf.py"))
G = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(G)

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, KeepTogether, NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle

ST = dict(G.ST)
ST["feat"] = G.S("feat", fontSize=9.2, leading=12.4, spaceAfter=0.5, leftIndent=8)
ST["meta"] = G.S("meta", fontName=G.ITAL, fontSize=7.8, leading=10, textColor=G.DIM, spaceAfter=4.5, leftIndent=8)
ST["intro"] = G.S("intro", fontSize=9.6, leading=13.4, textColor=G.INK, spaceAfter=6)
ST["area"] = G.S("area", fontName=G.BOLD, fontSize=17, leading=21, spaceBefore=2, spaceAfter=6, textColor=G.TIGER, keepWithNext=1)
ST["glance"] = G.S("glance", fontSize=9.4, leading=12.5, spaceAfter=0)
ST["glanceN"] = G.S("glanceN", fontName=G.BOLD, fontSize=9.4, leading=12.5, spaceAfter=0, textColor=G.TIGER, alignment=2)

BULLET = re.compile(r"^-\s+\*\*(.+?)\*\*\s*[—-]\s*(.*)$")


def parse(md):
    """FEATURES.md -> {title, intro, areas: [{title, intro, subs: [{title, intro, feats: [{name, text, where, since}]}]}]}"""
    doc = {"title": "", "intro": [], "areas": []}
    area = sub = None
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("# "):
            doc["title"] = line[2:].strip(); continue
        if line.startswith("## "):
            area = {"title": line[3:].strip(), "intro": [], "subs": []}; doc["areas"].append(area); sub = None; continue
        if line.startswith("### "):
            if area is None:
                area = {"title": "", "intro": [], "subs": []}; doc["areas"].append(area)
            sub = {"title": line[4:].strip(), "intro": [], "feats": []}; area["subs"].append(sub); continue
        m = BULLET.match(line.strip())
        if m:
            if area is None:
                area = {"title": "", "intro": [], "subs": []}; doc["areas"].append(area)
            if sub is None:
                sub = {"title": "", "intro": [], "feats": []}; area["subs"].append(sub)
            text = m.group(2)
            where = since = ""
            ms = re.search(r"\*Since:\*\s*(.+?)\s*$", text)
            if ms:
                since = ms.group(1).strip().rstrip("."); text = text[:ms.start()].rstrip()
            mw = re.search(r"\*Where:\*\s*(.+?)\s*$", text)
            if mw:
                where = mw.group(1).strip().rstrip("."); text = text[:mw.start()].rstrip()
            sub["feats"].append({"name": m.group(1).strip(), "text": text.strip(), "where": where, "since": since})
            continue
        target = sub if sub is not None else area if area is not None else None
        (target["intro"] if target is not None else doc["intro"]).append(line.strip())
    return doc


def count(area):
    return sum(len(s["feats"]) for s in area["subs"])


def build(out_path):
    ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("version", "")
    md = open(os.path.join(ROOT, "docs", "FEATURES.md"), encoding="utf-8").read()
    d = parse(md)
    W, H = A4
    M = 16 * mm
    width = W - 2 * M

    def deco(c, doc):
        c.saveState()
        c.setFillColor(G.BG); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setStrokeColor(G.TIGER); c.setLineWidth(1.2); c.line(M, H - 11 * mm, W - M, H - 11 * mm)
        c.setFont(G.BOLD, 7.5); c.setFillColor(G.INK); c.drawString(M, H - 9.5 * mm, "bitGen Studio")
        c.setFont(G.FONT, 7.5); c.setFillColor(G.DIM); c.drawRightString(W - M, H - 9.5 * mm, f"Feature Reference · v{ver}")
        c.drawCentredString(W / 2, 8 * mm, str(doc.page))
        c.restoreState()

    total = sum(count(a) for a in d["areas"])

    def cover(c, doc):
        c.saveState()
        c.setFillColor(G.BG); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setFillColor(G.TIGER); c.rect(0, H * 0.62, W, 5, fill=1, stroke=0)
        c.setFillColor(colors.white); c.setFont(G.BOLD, 34); c.drawString(M, H * 0.70, "bitGen Studio")
        c.setFont(G.FONT, 15); c.setFillColor(colors.HexColor("#f2e7d6")); c.drawString(M, H * 0.665, "Feature Reference")
        c.setFont(G.FONT, 10); c.setFillColor(colors.HexColor("#b9ab95"))
        c.drawString(M, H * 0.58, f"Version {ver}  ·  {date.today().strftime('%d %B %Y')}")
        c.drawString(M, H * 0.56, f"{total} features in {len(d['areas'])} areas - what each does, where it is, and since when")
        c.setFont(G.FONT, 8.5)
        y = H * 0.46
        for i, a in enumerate(d["areas"], 1):
            c.drawString(M, y, G.drawable(f"{i:>2}.  {a['title']}")); c.drawRightString(W - M, y, f"{count(a)}"); y -= 13
        c.setFillColor(G.DIM); c.setFont(G.FONT, 7.5)
        c.drawString(M, 14 * mm, "Made from docs/FEATURES.md for every release. The step-by-step instructions and the shortcut keys are in the Guide PDF.")
        c.restoreState()

    doc = BaseDocTemplate(out_path, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=16 * mm, bottomMargin=16 * mm,
                          title="bitGen Studio — Feature Reference", author="bitGen Studio", subject=f"Every feature, version {ver}")
    fr = Frame(M, 14 * mm, width, H - 30 * mm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="cover", frames=[fr], onPage=cover), PageTemplate(id="text", frames=[fr], onPage=deco)])
    story = [NextPageTemplate("text"), PageBreak()]
    # the areas at a glance
    story += [G.Bookmark("The areas at a glance", 0, "glance"), Paragraph("The areas at a glance", ST["h1"])]
    for t in d["intro"]:
        story.append(G.P(G.inline(t), ST["intro"]))
    rows = []
    for i, a in enumerate(d["areas"]):
        subs = ", ".join(s["title"] for s in a["subs"] if s["title"])
        rows.append([G.P(f'<link href="#area{i}" color="#e8e2d6"><b>{G.esc(G.drawable(a["title"]))}</b></link><br/><font size="7.8" color="#9a917f">{G.esc(G.drawable(subs))}</font>', ST["glance"]), Paragraph(str(count(a)), ST["glanceN"])])
    t = Table(rows, colWidths=[width - 18 * mm, 18 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, G.LINE), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [t]
    # the catalogue
    for i, a in enumerate(d["areas"]):
        story += [PageBreak(), G.Bookmark(G.drawable(a["title"]) or f"Area {i + 1}", 0, f"area{i}"), Paragraph(f'<a name="area{i}"/>{G.esc(G.drawable(a["title"]))}', ST["area"])]
        for t in a["intro"]:
            story.append(G.P(G.inline(t), ST["intro"]))
        for j, s in enumerate(a["subs"]):
            if s["title"]:
                story += [G.Bookmark(G.drawable(s["title"]), 1, f"a{i}s{j}"), Paragraph(G.esc(G.drawable(s["title"])), ST["h3"])]
            for t in s["intro"]:
                story.append(G.P(G.inline(t), ST["body"]))
            for f in s["feats"]:
                meta = " · ".join(x for x in [("Where: " + f["where"]) if f["where"] else "", ("Since " + f["since"]) if f["since"] else ""] if x)
                block = [G.P(f'<font color="#f59e2c">■</font> <b>{G.inline(f["name"])}</b> - {G.inline(f["text"])}', ST["feat"])]
                block.append(G.P(G.inline(meta), ST["meta"]) if meta else Spacer(1, 3.5))
                story.append(KeepTogether(block))
    doc.build(story)
    return {"version": ver, "areas": len(d["areas"]), "subareas": sum(len(a["subs"]) for a in d["areas"]), "features": total}


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "bitGen-Studio-Features.pdf")
    print(json.dumps(dict(build(out), out=out)))
