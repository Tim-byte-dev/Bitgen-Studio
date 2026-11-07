#!/usr/bin/env python3
"""bitGen Studio — 2.714.1: THE FEATURE LIST IN 简体中文 / 繁體中文 / 日本語 (docs/i18n/<lang>/FEATURES.md, for the website's
Features page in the visitor's language - tigerart's scripts/website-sync.py reads them).

Tim (verbatim): "please translate the feature list too, it is the core information"

Each translation has the English's shape line for line: the same headings at the same places, one bullet per feature in
the form the PDF script reads ('- **Name** — text *Where:* … *Since:* x'), the same *Since:* version on each, translated
words (not English left over), no placeholder text. zh-TW is the zh-CN converted (scripts/i18n-zhtw.py --features).
"""
import importlib.util
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASS = FAIL = 0


def check(name, ok, got=None):
    global PASS, FAIL
    if ok:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + repr(got)[:500]))


spec = importlib.util.spec_from_file_location("fpdf", os.path.join(ROOT, "scripts", "make_features_pdf.py"))
try:
    F = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(F)
    BULLET = F.BULLET
except Exception:                                          # no reportlab here: the same pattern, written out
    BULLET = re.compile(r"^- \*\*(.+?)\*\*\s+—\s+(.*)$")

en = open(os.path.join(ROOT, "docs", "FEATURES.md"), encoding="utf-8").read().split("\n")
SINCE = re.compile(r"\*Since:\*\s*([0-9][0-9.]*[0-9])")
CJK = re.compile(r"[぀-ヿ一-鿿]")
for lang in ("zh-CN", "zh-TW", "ja"):
    p = os.path.join(ROOT, "docs", "i18n", lang, "FEATURES.md")
    check(lang + ": docs/i18n/" + lang + "/FEATURES.md is there", os.path.exists(p))
    if not os.path.exists(p):
        continue
    tr = open(p, encoding="utf-8").read().split("\n")
    check(lang + ": as many lines as the English (" + str(len(en)) + ")", len(tr) == len(en), len(tr))
    shape = []
    for i, (a, b) in enumerate(zip(en, tr)):
        kind = lambda s: ("#" * (len(s) - len(s.lstrip("#"))) if s.startswith("#") else "-" if s.startswith("- ") else "" if not s.strip() else ".")
        if kind(a) != kind(b):
            shape.append((i + 1, a[:50], b[:50]))
    check(lang + ": the same headings / bullets / blank lines on the same lines", not shape, shape[:3])
    bullets = [(a, b) for a, b in zip(en, tr) if a.startswith("- **")]
    bad = [b[:80] for a, b in bullets if bool(BULLET.match(a)) and not BULLET.match(b)]
    check(lang + ": every feature in the form '- **Name** — text' (" + str(len(bullets)) + ")", not bad and len(bullets) > 900, bad[:3])
    mk = [b[:60] for a, b in bullets if ("*Where:*" in a) != ("*Where:*" in b) or ("*Since:*" in a) != ("*Since:*" in b)]
    check(lang + ": *Where:* and *Since:* wherever the English has them", not mk, mk[:3])
    ver = [b[:60] for a, b in bullets if SINCE.search(a) and (not SINCE.search(b) or SINCE.search(a).group(1) != SINCE.search(b).group(1))]
    check(lang + ": the same *Since:* version on every feature", not ver, ver[:3])
    left = [b[:60] for a, b in bullets if not CJK.search(b.split("*Where:*")[0])]
    check(lang + ": every feature translated (no line left in English only)", len(left) <= 5, left[:5])
    heads = [b for a, b in zip(en, tr) if a.startswith("#") and not CJK.search(b) and CJK.search(a) is None and re.search(r"[a-z]{4}", a)]
    check(lang + ": the headings translated", len(heads) <= 3, heads[:5])
    junk = [b[:60] for b in tr if re.search(r"TODO|TRANSLATE|\?\?\?|<<<|>>>", b)]
    check(lang + ": no placeholders or merge marks", not junk, junk[:3])

zh = open(os.path.join(ROOT, "docs", "i18n", "zh-TW", "FEATURES.md"), encoding="utf-8").read()
check("zh-TW: Traditional characters (the zh-CN converted: 視窗, 專案, 設定)", "专案" not in zh and "项目" not in zh and ("專案" in zh or "項目" in zh) and "設定" in zh)
src = open(os.path.join(ROOT, "scripts", "i18n-zhtw.py"), encoding="utf-8").read()
check("scripts/i18n-zhtw.py --features (zh-CN -> zh-TW) and --json (the website's dictionary)", "def features()" in src and '"--features"' in src and "def json_strings(" in src)
print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
