#!/usr/bin/env python3
"""bitGen Studio — scripts/website-sync.py (2.712.0): brings the website (website/, the PHP site for tigerart.com.au)
up to date with the app: the screenshots (resized JPEGs), the intro film + its poster, the guide / feature PDFs' links,
website/data/site.json (the version, every feature from docs/FEATURES.md grouped as there, the credits from
lib/credits.json). Run it before uploading the site:   python3 scripts/website-sync.py
Tim: "can you create the full tigerart.com.au website and only use bitgen as the only product" """
import json
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "website"
IMG = WEB / "assets" / "img"
MEDIA = WEB / "assets" / "media"
RAW = "https://github.com/Tim-byte-dev/Bitgen-Studio/raw/main/"
# the screenshots the pages use: docs/images/<name>.png -> assets/img/<name>.jpg (at most `w` wide)
SHOTS = {"overview": 1600, "image-editor": 1600, "timeline": 1310, "sketcher": 1600, "music": 1110, "video-docker": 1310,
         "model-manager": 850, "image-styles": 1242, "expert-workspace": 1920, "settings-comfyui": 1240, "reference-select": 980}
PDFS = ["bitGen-Studio-Guide.pdf", "bitGen-Studio-Guide-zh-CN.pdf", "bitGen-Studio-Guide-zh-TW.pdf", "bitGen-Studio-Guide-ja.pdf",
        "bitGen-Studio-Features.pdf", "bitGen-Studio-Brochure.pdf"]


def plain(s):
    """markdown inline -> plain text (the pages escape it)"""
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    return s.strip()


def features():
    """docs/FEATURES.md -> [{title, intro, groups: [{title, items: [{name, text, where, since}]}]}]"""
    out, cur, grp = [], None, None
    for line in (ROOT / "docs" / "FEATURES.md").read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            cur = {"title": plain(line[3:]), "intro": "", "groups": []}
            out.append(cur)
            grp = None
        elif line.startswith("### ") and cur is not None:
            grp = {"title": plain(line[4:]), "items": []}
            cur["groups"].append(grp)
        elif line.startswith("- **") and grp is not None:
            m = re.match(r"- \*\*(.+?)\*\*\s*[—-]\s*(.*)$", line)
            if not m:
                continue
            rest = m.group(2)
            since = re.search(r"\*Since:\*\s*([0-9.]+)", rest)
            where = re.search(r"\*Where:\*\s*(.+?)(?:\s*\*Since:\*|$)", rest)
            text = re.split(r"\s*\*Where:\*", rest)[0]
            text = re.split(r"\s*\*Since:\*", text)[0]
            grp["items"].append({"name": plain(m.group(1)), "text": plain(text).rstrip("."),
                                 "where": plain(where.group(1)).rstrip(".") if where else "", "since": since.group(1) if since else ""})
        elif cur is not None and grp is None and line.strip() and not cur["intro"]:
            cur["intro"] = plain(line)
    return out


def shots():
    try:
        from PIL import Image
    except ImportError:
        print("website-sync: needs Pillow (pip install pillow) for the screenshots")
        return []
    IMG.mkdir(parents=True, exist_ok=True)
    made = []
    for name, w in SHOTS.items():
        src = ROOT / "docs" / "images" / (name + ".png")
        if not src.exists():
            continue
        im = Image.open(src).convert("RGB")
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        dst = IMG / (name + ".jpg")
        im.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
        made.append({"name": name, "w": im.width, "h": im.height})
    shutil.copyfile(ROOT / "docs" / "images" / "logo.png", IMG / "logo.png")
    logo = Image.open(ROOT / "docs" / "images" / "bitgen-logo-1920x1080.png").convert("RGB")       # the link preview picture
    logo.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652)).save(IMG / "og.jpg", "JPEG", quality=85, optimize=True)
    return made


def film():
    MEDIA.mkdir(parents=True, exist_ok=True)
    src = ROOT / "docs" / "images" / "bitgen-studio-intro.mp4"
    shutil.copyfile(src, MEDIA / "intro.mp4")
    # the poster = the drawing finished with its title in (8.5 s; the last frames fade out) - shown before it plays and
    # to reduced-motion visitors
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "8.5", "-i", str(src), "-frames:v", "1", "-q:v", "3", str(IMG / "intro-poster.jpg")], check=True)


def installers():
    """the one-file installers (install_all.bat / .sh / .command) - served from the site as downloads (.htaccess)"""
    d = WEB / "assets" / "get"
    d.mkdir(parents=True, exist_ok=True)
    out = []
    for f in ("install_all.bat", "install_all.sh", "install_all.command"):
        p = ROOT / f
        if p.exists():
            shutil.copyfile(p, d / f)
            out.append({"file": f, "kb": round(p.stat().st_size / 1024)})
    return out


def pdfs():
    """the guide / feature PDFs: linked straight from the GitHub repo (always the newest; not copied - they are big)"""
    out = []
    for f in PDFS:
        p = ROOT / "docs" / f
        if p.exists():
            out.append({"file": f, "mb": round(p.stat().st_size / 1e6, 1), "url": RAW + "docs/" + f})
    return out


def main():
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    feats = features()
    credits = json.loads((ROOT / "lib" / "credits.json").read_text(encoding="utf-8"))
    made = shots()
    film()
    docs = pdfs()
    inst = installers()
    n = sum(len(g["items"]) for s in feats for g in s["groups"])
    site = {"version": version, "built": date.today().isoformat(), "featureCount": n, "features": feats, "credits": credits,
            "shots": made, "pdfs": docs, "installers": inst}
    (WEB / "data").mkdir(parents=True, exist_ok=True)
    (WEB / "data" / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"website-sync: v{version}, {n} features in {len(feats)} sections, {len(made)} screenshots, {len(docs)} PDFs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
