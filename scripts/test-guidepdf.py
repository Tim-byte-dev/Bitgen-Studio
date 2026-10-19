#!/usr/bin/env python3
"""bitGen Studio — 2.391.1: THE PDF GUIDE (2.392.0: dark, the bitGen palette; + the brochure, scripts/make_ad_pdf.py) (scripts/make_guide_pdf.py) - instructions + a shortcut-key quick view.
Run: python3 scripts/test-guidepdf.py
Tim (verbatim): "create a pdf with instructions and shortcut key quick view".
  1. it builds (to a temp file) from docs/USAGE.md + docs/shortcuts.json + package.json;
  2. the shortcut pages hold every group and key; the instructions every ## heading; the version on the pages;
  3. the PDF's outline (sidebar) has Part 1 / Part 2 and the headings; the contents link to them;
  4. the image editor rows in docs/shortcuts.json are still the editor's own keys (its command table in pcui.js);
  5. the shipped docs/bitGen-Studio-Guide.pdf is this version's."""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else " :: %r" % (got,)))


try:
    import reportlab  # noqa: F401
    from pypdf import PdfReader
except Exception as e:  # noqa: BLE001
    print("SKIP: reportlab / pypdf are not installed here - the PDF guide test did not run (%s)" % e)
    sys.exit(0)

out = os.path.join(tempfile.mkdtemp(prefix="guide391_"), "guide.pdf")
r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "make_guide_pdf.py"), out], capture_output=True, text=True)
info = json.loads((r.stdout.strip().split("\n") or ["{}"])[-1] or "{}") if r.returncode == 0 else {}
ver = json.load(open(os.path.join(ROOT, "package.json")))["version"]
check("it builds: the version, the headings, the shortcut groups", r.returncode == 0 and info.get("version") == ver and info.get("headings", 0) > 40, (r.stderr[-600:], info))
rd = PdfReader(out)
text = "\n".join(p.extract_text() or "" for p in rd.pages)
flat = re.sub(r"\s+", " ", text)
sc = json.load(open(os.path.join(ROOT, "docs", "shortcuts.json"), encoding="utf-8"))
check("more than 20 pages; the cover says what it is", len(rd.pages) > 20 and "Instructions and shortcut keys" in flat, len(rd.pages))
miss = [g["title"] for g in sc["groups"] if re.sub(r"\s+", " ", g["title"]).split(" (")[0] not in flat]
check("Part 1: every shortcut group is on the quick-view pages", "Shortcut keys at a glance" in flat and not miss, miss)
keys = [k for g in sc["groups"] for k, _v in g["rows"]]
km = [k for k in keys if re.sub(r"\s+", "", k) not in re.sub(r"\s+", "", text)]
check("...and every key in them (Ctrl+Shift+…, F7, \\, Space …)", not km, km[:10])
heads = [re.sub(r"[*`]", "", m.group(1)).strip() for m in re.finditer(r"^##\s+(.*)$", open(os.path.join(ROOT, "docs", "USAGE.md"), encoding="utf-8").read(), re.M)]
hm = [h for h in heads if re.sub(r"[^\w]", "", h.split("(")[0])[:24] not in re.sub(r"[^\w]", "", text)]
check("Part 2: every section of docs/USAGE.md is there", len(heads) > 40 and len(hm) <= 2, hm)
check("the version on every page's header", flat.count("Guide · v" + ver) >= len(rd.pages) - 2, flat.count("Guide · v" + ver))
ol = rd.outline
titles = []
def walk(o):
    for x in o:
        if isinstance(x, list): walk(x)
        else: titles.append(x.title)
walk(ol)
check("the PDF's outline: Part 1, Part 2 and the headings", titles[:1] == ["Part 1 - Shortcut keys at a glance"] and "Part 2 - Instructions" in titles and len(titles) > 40, titles[:4])
links = sum(1 for p in rd.pages for a in (p.get("/Annots") or []) if a.get_object().get("/Subtype") == "/Link")
check("the contents (and the guide's own links) jump to the sections", links > 40, links)
UI = "".join(open(os.path.join(ROOT, "ext", "imageeditdock", f), encoding="utf-8").read() for f in ("pcui.js", "pcsam.js", "pcpsd.js", "pcpen.js", "pcsmart.js", "pcwarp.js", "pcselect.js", "pcretouch.js", "pcrefine.js", "pcheal.js", "pcpdf.js", "pcvline.js", "pcactions.js", "pcdockers.js", "pcdocs.js", "pcpalette.js", "pcgrad.js", "pccomps.js", "pcbgi.js", "pcgenfill.js", "pcpattern.js", "pcpanels.js", "pcpropbar.js", "pcguides.js", "pcdims.js", "pcframes.js", "pcprefs.js", "pcpromptlink.js", "pcartboards.js", "pccafill.js", "pcruns.js", "pchandles.js") if os.path.exists(os.path.join(ROOT, "ext", "imageeditdock", f)))   # 2.422.0: + the pen / smart / warp files' commands; 2.423.0: + select / retouch / refine / heal
ed = [(g["title"], k, v) for g in sc["groups"] if g["title"].startswith("Image editor - ") and g["title"].endswith(" menu") for k, v in g["rows"]]
bad = [(k, v) for _t, k, v in ed if not re.search(r'"' + re.escape(v) + r'…?"', UI)]       # the label as the editor writes it
check("docs/shortcuts.json's image editor menu rows are the editor's own commands (pcui.js)", len(ed) > 40 and not bad, bad[:6])
sh = os.path.join(ROOT, "docs", "bitGen-Studio-Guide.pdf")
shipped = PdfReader(sh) if os.path.exists(sh) else None
check("the shipped docs/bitGen-Studio-Guide.pdf is this version's", shipped is not None and ("v" + ver) in (shipped.pages[1].extract_text() or ""), ver)

# ---- 2.392.0 (Tim: "create a pdf as an ad for bitgen studio - keep the dark theme everywhere, do the same with the
# instructions - keep bitgen theme")
DARK = b".078431 .070588 .058824 rg\nn 0 0 595.2756 841.8898 re f*"          # the app's --ink over the whole page
def dark(page):
    try:
        return DARK in page.get_contents().get_data()[:400]
    except Exception:  # noqa: BLE001
        return False
check("the guide is dark on EVERY page (the app's --ink #14120f under each page, the cover too)", all(dark(pg) for pg in rd.pages), [i for i, pg in enumerate(rd.pages) if not dark(pg)][:5])
src = open(os.path.join(ROOT, "scripts", "make_guide_pdf.py"), encoding="utf-8").read()
check("...in the bitGen palette (tiger #f59e2c headings / keys, text #e8e2d6, lines #3a342a)", all(c in src for c in ('"#f59e2c"', '"#e8e2d6"', '"#3a342a"', '"#14120f"')) and '"#f3ede3"' not in src)
ad = os.path.join(os.path.dirname(out), "ad.pdf")
r2 = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "make_ad_pdf.py"), ad], capture_output=True, text=True)
ai = json.loads((r2.stdout.strip().split("\n") or ["{}"])[-1] or "{}") if r2.returncode == 0 else {}
ra = PdfReader(ad) if r2.returncode == 0 else None
at = re.sub(r"\s+", " ", "\n".join(pg.extract_text() or "" for pg in ra.pages)) if ra else ""
check("the brochure builds: 3 dark pages, the version on each, the studio's own screens (docs/images/ad-*.jpg)",
      ra is not None and len(ra.pages) == 3 and all(dark(pg) for pg in ra.pages) and at.count("v" + ver) == 3
      and os.path.exists(os.path.join(ROOT, "docs", "images", "ad-editor.jpg")) and os.path.exists(os.path.join(ROOT, "docs", "images", "ad-layout.jpg")), (r2.stderr[-400:], ai))
check("...what it says: the title, the promise, the eight features, the four steps", all(t in at for t in ("bitGen Studio", "Your whole AI film studio", "Everything a film needs",
      "From one prompt to a finished film", "Built for people who own their tools", "Scene board", "A full image editor", "Docker configs")) and ai.get("features") == 8, at[:300])
# every claim is something the studio does now - the code that does it
EVID = {"Segment Anything": "ext/imageeditdock/pcsam.js", "PSD": "ext/imageeditdock/pcpsd.js", "Docker configs": "static/dockcfg.js",
        "LTX 2.5": "lib/ltx.js", "Wan 2.1 and 2.2": "lib/wan.js", "Blender bridge": "lib/blender.js", "karaoke": "lib/karaoke.js",
        "split stems": "ext/stemsdock", "sound effects": "ext/sfxdock", "360° world": "lib/vrWorld.js", "Swap a character": "lib/swap.js",
        "Qwen Image Edit": "comfy_workflows/img_qwen_edit_2511.json", "FLUX Kontext": "comfy_workflows/img_flux_kontext_edit.json",
        "rendering step n of total": "ext/videodock/characters.js", "Append or prepend": "lib/frameOp.js", "green screen": "lib/matte.js",
        "lip-sync": "lib/ltxScenes.js", "Control layers": "lib/aiEdit.js"}
gone = [k for k, f in EVID.items() if k in at and not os.path.exists(os.path.join(ROOT, f))]
said = [k for k in EVID if k in at]
check("...every feature it names is in the code (pcsam, pcpsd, dockcfg, ltx, wan, blender, karaoke, stems, sfx, vrWorld, swap, the edit graphs ...)",
      len(said) >= 14 and not gone and "41 filters" in at and "rendering step n of total" in open(os.path.join(ROOT, "ext", "videodock", "characters.js"), encoding="utf-8").read(), (said, gone))
shb = os.path.join(ROOT, "docs", "bitGen-Studio-Brochure.pdf")
check("the shipped docs/bitGen-Studio-Brochure.pdf is this version's", os.path.exists(shb) and ("v" + ver) in (PdfReader(shb).pages[0].extract_text() or ""), ver)
print("\nRESULT: %d passed, %d failed" % (P, F))
sys.exit(1 if F else 0)
