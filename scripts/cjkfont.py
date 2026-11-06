#!/usr/bin/env python3
"""bitGen Studio — scripts/cjkfont.py (2.703.0): a Chinese / Japanese font the PDF makers can embed.

ReportLab embeds TrueType (glyf) fonts only; the free Noto Sans CJK fonts (SIL Open Font License) come as OpenType CFF
collections. This takes the right face of the collection (SC = Simplified Chinese, JP = Japanese - the glyph shapes differ
between them), keeps only the characters a document uses (subset - a few hundred KB instead of 20 MB), turns its CFF outlines
into TrueType ones (fontTools cu2qu) and writes a .ttf.

    from cjkfont import cjk_ttf
    path = cjk_ttf("zh-CN", "Bold", text, out_dir)      # lang zh-CN | ja, weight Regular | Bold

Needs fontTools (pip install fonttools) and Noto Sans CJK installed (Debian / Ubuntu: fonts-noto-cjk; or set
BITGEN_CJK_FONT_DIR to a folder with NotoSansCJK-Regular.ttc / NotoSansCJK-Bold.ttc).
Tim: "is it possible to translate help and the user guide into chinese and japanese as additional help files?" (PDFs too).
"""
import hashlib
import os

FACE = {"zh-CN": "Noto Sans CJK SC", "ja": "Noto Sans CJK JP"}
DIRS = [os.environ.get("BITGEN_CJK_FONT_DIR", ""), "/usr/share/fonts/opentype/noto", "/usr/share/fonts/noto-cjk",
        "/usr/share/fonts/google-noto-cjk", "C:/Windows/Fonts", "/Library/Fonts", os.path.expanduser("~/Library/Fonts")]


def find(weight):
    """the Noto Sans CJK collection of that weight"""
    for d in DIRS:
        if d:
            for n in (f"NotoSansCJK-{weight}.ttc", f"NotoSansCJKsc-{weight}.otf"):
                p = os.path.join(d, n)
                if os.path.exists(p):
                    return p
    return None


def _to_glyf(font):
    """CFF outlines -> TrueType quadratic glyf outlines (as fontTools' otf2ttf snippet does)"""
    from fontTools.pens.cu2quPen import Cu2QuPen
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib import newTable
    order = font.getGlyphOrder()
    gs = font.getGlyphSet()
    glyf = newTable("glyf"); glyf.glyphOrder = order; glyf.glyphs = {}
    for name in order:
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyf.glyphs[name] = pen.glyph()
    font["loca"] = newTable("loca"); font["glyf"] = glyf
    for t in ("CFF ", "VORG"):
        if t in font:
            del font[t]
    font["head"].indexToLocFormat = 0; font["head"].glyphDataFormat = 0
    mx = newTable("maxp"); mx.tableVersion = 0x00010000
    for k in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs", "maxStackElements",
              "maxSizeOfInstructions", "maxComponentElements", "maxPoints", "maxContours", "maxCompositePoints",
              "maxCompositeContours", "maxComponentDepth"):
        setattr(mx, k, 0)
    mx.maxZones = 1; mx.numGlyphs = len(order); font["maxp"] = mx
    font["post"].formatType = 2.0; font["post"].extraNames = []; font["post"].mapping = {}
    font["post"].glyphOrder = order
    font.sfntVersion = "\x00\x01\x00\x00"
    font["glyf"].compile(font); font["maxp"].recalc(font)


def cjk_ttf(lang, weight, text, out_dir):
    """a subset TrueType font with every character of `text` the face has (cached by its contents)"""
    from fontTools.ttLib import TTCollection, TTFont
    from fontTools import subset
    src = find(weight)
    if not src:
        raise RuntimeError(f"Noto Sans CJK {weight} not found - install fonts-noto-cjk or set BITGEN_CJK_FONT_DIR")
    chars = sorted(set(text) | set(chr(c) for c in range(32, 127)))
    key = hashlib.sha256((lang + weight + src + "".join(chars)).encode("utf-8")).hexdigest()[:12]
    out = os.path.join(out_dir, f"bitgen-cjk-{lang}-{weight}-{key}.ttf")
    if os.path.exists(out):
        return out
    if src.endswith(".ttc"):
        col = TTCollection(src)
        font = next((f for f in col.fonts if f["name"].getDebugName(1) == FACE[lang]), None)
        if font is None:
            raise RuntimeError(f"{FACE[lang]} is not in {src}")
    else:
        font = TTFont(src)
    opt = subset.Options(); opt.layout_features = ["*"]; opt.name_IDs = ["*"]; opt.notdef_outline = True
    opt.drop_tables += ["VORG", "vhea", "vmtx", "BASE", "JSTF", "DSIG"]
    sub = subset.Subsetter(opt); sub.populate(unicodes=[ord(c) for c in chars]); sub.subset(font)
    _to_glyf(font)
    os.makedirs(out_dir, exist_ok=True)
    tmp = out + ".tmp"
    font.save(tmp); os.replace(tmp, out)
    return out
