#!/usr/bin/env python3
"""bitGen Studio — scripts/i18n-zhtw.py (2.704.0): the TRADITIONAL CHINESE guide + help (zh-TW, Taiwan / Hong Kong) made from
the reviewed Simplified Chinese one (zh-CN).

Tim (verbatim): "can you add a traditional chinese version as well?"

    pip install opencc                  (OpenCC - Apache-2.0, the standard Simplified <-> Traditional converter)
    python3 scripts/i18n-zhtw.py        docs/i18n/zh-CN/* + static/help/zh-CN/*  ->  docs/i18n/zh-TW/* + static/help/zh-TW/*

OpenCC's "s2twp" turns the characters AND the mainland words into Taiwan's (视频 -> 影片, 文件 -> 檔案, 默认 -> 預設, 项目 ->
專案); TW_WORDS then sets the app's own terms. Code, `code`, links, URLs, HTML tags and the <!-- en: … --> markers are left
exactly as they are, so a section keeps the English hash it was translated from (lib/helpI18n.js). After running it, read
the result (scripts/i18n-help.js check zh-TW must say 0 problems) - a refresh of zh-CN can be carried over the same way.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# the app's words as Taiwan's software usage has them (after s2twp)
TW_WORDS = [
    ("時間線", "時間軸"),
]
KEEP = re.compile(r"(```[\s\S]*?```|`[^`\n]+`|<!--[\s\S]*?-->|<[^>]+>|\]\([^)]*\)|https?://[^\s)<>\"]+)")


def converter():
    try:
        import opencc
    except ImportError:
        sys.exit("needs OpenCC: pip install opencc")
    return opencc.OpenCC("s2twp")


def convert_text(text, cc):
    """the Chinese prose converted; code, tags, links and markers kept byte for byte"""
    out = []
    for part in KEEP.split(text):
        if not part:
            continue
        if KEEP.fullmatch(part):
            out.append(part)
        else:
            t = cc.convert(part)
            for a, b in TW_WORDS:
                t = t.replace(a, b)
            out.append(t)
    return "".join(out)


def main():
    cc = converter()
    src, dst = os.path.join(ROOT, "docs", "i18n", "zh-CN"), os.path.join(ROOT, "docs", "i18n", "zh-TW")
    os.makedirs(dst, exist_ok=True)
    md = open(os.path.join(src, "USAGE.md"), encoding="utf-8").read()
    open(os.path.join(dst, "USAGE.md"), "w", encoding="utf-8").write(convert_text(md, cc))
    sc = json.load(open(os.path.join(src, "shortcuts.json"), encoding="utf-8"))
    sc["lang"] = "zh-TW"
    for g in sc["groups"]:
        g["title"] = convert_text(g["title"], cc)
        g["rows"] = [[r[0], convert_text(r[1], cc)] for r in g["rows"]]
    open(os.path.join(dst, "shortcuts.json"), "w", encoding="utf-8").write(json.dumps(sc, ensure_ascii=False, indent=2) + "\n")
    hs, hd = os.path.join(ROOT, "static", "help", "zh-CN"), os.path.join(ROOT, "static", "help", "zh-TW")
    os.makedirs(hd, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(hs)):
        if f.endswith(".html"):
            open(os.path.join(hd, f), "w", encoding="utf-8").write(convert_text(open(os.path.join(hs, f), encoding="utf-8").read(), cc))
            n += 1
    print(json.dumps({"guide": len(md), "shortcut_groups": len(sc["groups"]), "help_pages": n, "out": [dst, hd]}))


if __name__ == "__main__":
    main()
