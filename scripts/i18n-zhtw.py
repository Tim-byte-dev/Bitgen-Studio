#!/usr/bin/env python3
"""bitGen Studio — scripts/i18n-zhtw.py (2.704.0): the TRADITIONAL CHINESE guide + help (zh-TW, Taiwan / Hong Kong) made from
the reviewed Simplified Chinese one (zh-CN).

Tim (verbatim): "can you add a traditional chinese version as well?"

    pip install opencc                  (OpenCC - Apache-2.0, the standard Simplified <-> Traditional converter)
    python3 scripts/i18n-zhtw.py [--force]   docs/i18n/zh-CN/* + static/help/zh-CN/*  ->  docs/i18n/zh-TW/* + static/help/zh-TW/*
                                        (refuses to overwrite the reviewed zh-TW without --force)
    python3 scripts/i18n-zhtw.py --ui        static/i18n/ui/zh-CN.json -> zh-TW.json (2.705.0: the app's own words)

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
# (2.704.0: the Taiwan editor's review of the first conversion - the mainland software terms OpenCC leaves)
TW_WORDS = [
    ("時間線", "時間軸"), ("撤銷", "復原"), ("模板", "範本"), ("質量", "品質"), ("選中", "選取"), ("當前", "目前"),
    ("拖動", "拖曳"), ("列表", "清單"), ("文本", "文字"), ("攝像機", "攝影機"), ("蒙版", "遮罩"), ("選區", "選取範圍"),
    ("工具欄", "工具列"), ("選單欄", "選單列"), ("菜單欄", "選單列"), ("控制台", "主控台"), ("視訊記憶體", "顯示記憶體"),
    ("型別", "類型"), ("選項卡", "分頁"), ("標籤頁", "分頁"), ("引數", "參數"), ("摳圖", "去背"), ("漸變", "漸層"),
    ("魔棒", "魔術棒"), ("控制元件", "控制項"), ("映象", "鏡像"), ("全域性", "全域"), ("擴充套件", "擴充功能"),
    ("和麵板", "和面板"), ("全綵", "全彩"), ("傢俱", "家具"), ("合並", "合併"),
]
# NOT automatic (the meaning decides - read for them): 行 / 列 in tables (Taiwan: 列 = row, 欄 = column); 應用 = 應用程式
# (the app) or 套用 (apply); 項目 = 專案 (a project) or 項目 (an item); 連線 (a connection) vs 連接 (walls that join).
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


def ui():
    """2.705.0: the UI dictionary - static/i18n/ui/zh-CN.json -> zh-TW.json (the translations converted; the English keys kept)"""
    cc = converter()
    d = json.load(open(os.path.join(ROOT, "static", "i18n", "ui", "zh-CN.json"), encoding="utf-8"))
    out = {k: convert_text(v, cc) for k, v in d["strings"].items()}
    import hashlib
    v = hashlib.sha256(json.dumps(dict(sorted(out.items())), ensure_ascii=False, separators=(", ", ": ")).encode("utf-8")).hexdigest()[:12]
    json.dump({"lang": "zh-TW", "v": v, "count": len(out), "strings": dict(sorted(out.items()))},
              open(os.path.join(ROOT, "static", "i18n", "ui", "zh-TW.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"ui": "zh-TW", "strings": len(out)}))


def main():
    if "--ui" in sys.argv:
        return ui()
    force = "--force" in sys.argv
    if not force and os.path.exists(os.path.join(ROOT, "docs", "i18n", "zh-TW", "USAGE.md")):
        sys.exit("docs/i18n/zh-TW already exists and was read over by hand (2.704.0) - converting again would undo that.\n"
                 "To refresh only what changed: node scripts/i18n-help.js prep zh-TW <dir> gives the stale sections in English;\n"
                 "take the matching reviewed zh-CN sections, convert them with convert_text() and assemble them. --force overwrites all.")
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
