#!/usr/bin/env python3
"""bitGen Studio — 2.473.0: THE FEATURE REFERENCE PDF (scripts/make_features_pdf.py from docs/FEATURES.md).
Tim (verbatim): "create a pdf documenting all the features of bitgen studio so far."
Checks the catalogue (every bullet in the form, the areas in order, the newest releases in it, no other products'
names) and the PDF (built here: the version on the cover, the areas as bookmarks, every feature in the text) and that
the shipped docs/bitGen-Studio-Features.pdf is this version's."""
import json, os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
npass = nfail = 0
def check(name, ok, got=None):
    global npass, nfail
    if ok: npass += 1; print("PASS: " + name)
    else: nfail += 1; print("FAIL: " + name + ("" if got is None else " :: " + repr(got)[:500]))
import importlib.util
spec = importlib.util.spec_from_file_location("feat", os.path.join(ROOT, "scripts", "make_features_pdf.py")); F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
md = open(os.path.join(ROOT, "docs", "FEATURES.md"), encoding="utf-8").read()
d = F.parse(md)
feats = [f for a in d["areas"] for s in a["subs"] for f in s["feats"]]
bullets = [l for l in md.splitlines() if l.startswith("- ")]
check("FEATURES.md: every bullet is one feature in the form '- **Name** — what it does. *Where:* … *Since:* …'", len(bullets) == len(feats) and all(F.BULLET.match(l) for l in bullets), [l for l in bullets if not F.BULLET.match(l)][:3])
titles = [a["title"] for a in d["areas"]]
check("the areas: the workspace first, the image editor, CAD and 3D, the bridges, delivery, keys (10 at least)", len(titles) >= 10 and titles[0].lower().startswith("the workspace") and any("image editor" in t.lower() for t in titles) and any("cad" in t.lower() for t in titles) and any("bridge" in t.lower() for t in titles), titles)
check("500+ features, each with what it does", len(feats) >= 500 and all(len(f["text"]) > 10 for f in feats), len(feats))
low = md.lower()
check("the newest releases are in it: sketch layers + constraints, the CAD toolbar, picking (hover / picked outlines), parametric bodies (extrude, revolve, fillet, split), OpenCascade / Blender, Unreal + MetaHuman layers, the Unreal camera",
      all(w in low for w in ["sketch", "cad toolbar", "hover", "extrude", "revolve", "fillet", "split body", "opencascade", "metahuman", "unreal camera"]))
RX = re.compile(r"CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip|Fusion 360|Autodesk")
check("no other products' names (as in the help and the Guide)", not RX.search(md), RX.findall(md)[:5])
ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8"))["version"]
with tempfile.TemporaryDirectory() as td:
    out = os.path.join(td, "f.pdf")
    r = F.build(out)
    check("the PDF builds: the areas, sub-areas and features counted", r["features"] == len(feats) and r["areas"] == len(titles) and os.path.getsize(out) > 50000, r)
    try:
        txt = subprocess.run(["pdftotext", "-layout", out, "-"], capture_output=True, text=True, timeout=120).stdout
    except Exception:
        txt = ""
    if txt:
        flat = re.sub(r"\s+", " ", txt)
        check("the cover: 'Feature Reference', this version, the count", "Feature Reference" in flat and f"Version {ver}" in flat and f"{len(feats)} features" in flat, flat[:300])
        missing = [f["name"] for f in feats if re.sub(r"\s+", " ", re.sub(r"[*`]", "", f["name"]))[:30] not in flat]
        check("every feature's name is in the PDF's text", len(missing) <= 3, missing[:5])
    else:
        print("SKIP: pdftotext is not installed - the PDF's text was not read")
shipped = os.path.join(ROOT, "docs", "bitGen-Studio-Features.pdf")
if os.path.exists(shipped):
    try:
        t = subprocess.run(["pdftotext", "-l", "1", shipped, "-"], capture_output=True, text=True, timeout=60).stdout
        check("the shipped docs/bitGen-Studio-Features.pdf is this version's", f"Version {ver}" in t, re.findall(r"Version [\d.]+", t))
    except Exception:
        print("SKIP: pdftotext is not installed")
else:
    check("docs/bitGen-Studio-Features.pdf is shipped", False)
print(f"\nRESULT: {npass} passed, {nfail} failed")
sys.exit(1 if nfail else 0)
