#!/usr/bin/env python3
"""bitGen Studio - 2.698.0: edits at Basic Settings' Size. scripts/comfy_image.py patch(): exact_size + width / height = the
graph's ImageScaleToTotalPixels steps keep that many pixels (megapixels x 1024 x 1024, 16 px steps), the report says so; without
exact_size nothing changes ("size: taken from the reference image"). The page side: static/index.html H3BasicImageSize,
ext/imageeditdock/pcpromptlink.js runRefs (picture 1 cropped to the size, exact), mount.js sends exact, routes/aiedit.js
exact_size.
Tim (verbatim): "when we edit an image it always uses the ref-image resolution can we change this to use our resolution using
basic settings docker?"
"""
import copy, json, math, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import comfy_image as C  # noqa: E402
passed = failed = 0
def check(name, ok, got=None):
    global passed, failed
    if ok: passed += 1; print("PASS: " + name)
    else: failed += 1; print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:500]))
def load(name):
    g = json.load(open(os.path.join(ROOT, "comfy_workflows", name)))
    return {k: v for k, v in g.items() if isinstance(v, dict) and "class_type" in v}
def comfy_scale(w, h, mp, steps):   # ComfyUI ImageScaleToTotalPixels
    total = mp * 1024 * 1024; k = math.sqrt(total / (w * h))
    return round(w * k / steps) * steps, round(h * k / steps) * steps
ph3 = load("img_ph3_edit.json")
out, rep = C.patch(copy.deepcopy(ph3), {"name": "P-H3 Image Edit"}, {"prompt": "x", "width": 1536, "height": 864, "exact_size": True, "images": ["a.png"]})
n41 = out["41"]["inputs"]
check("P-H3 at 1536 x 864 (Basic Settings): its 4 MP scaler keeps 1536 x 864 instead (megapixels x 1024 x 1024, 16 px steps)", comfy_scale(1536, 864, n41["megapixels"], n41["resolution_steps"]) == (1536, 864), n41)
check("…the log says the size came from Basic Settings", any("1536x864: Basic Settings' Size" in x for x in rep) and any("kept by node(s) 41" in x for x in rep), [x for x in rep if "size" in x])
out0, rep0 = C.patch(copy.deepcopy(ph3), {"name": "P-H3 Image Edit"}, {"prompt": "x", "width": 1536, "height": 864, "images": ["a.png"]})
check("without exact_size (Style's own / the image editor's selection): unchanged - 4 MP, taken from the reference image", out0["41"]["inputs"]["megapixels"] == 4.0 and any("taken from the reference image" in x for x in rep0))
q = [f for f in os.listdir(os.path.join(ROOT, "comfy_workflows")) if f.startswith("img_") and "qwen" in f and "edit" in f]
ok = True
for f in q:
    g = load(f)
    if not any(v["class_type"] == "ImageScaleToTotalPixels" for v in g.values()): continue
    try: o, _ = C.patch(copy.deepcopy(g), {"name": f}, {"prompt": "x", "width": 1024, "height": 1536, "exact_size": True, "images": ["a.png"]})
    except C.PatchError: continue
    for v in o.values():
        if v["class_type"] == "ImageScaleToTotalPixels" and not isinstance(v["inputs"].get("megapixels"), list):
            ok = ok and abs(v["inputs"]["megapixels"] - 1024 * 1536 / 1048576) < 1e-3
check("every Qwen edit workflow's scalers follow too", ok, q)
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf8").read()
IX, PL, MT, RA = rd("static/index.html"), rd("ext/imageeditdock/pcpromptlink.js"), rd("ext/imageeditdock/mount.js"), rd("routes/aiedit.js")
check("wired: H3BasicImageSize (null = Style's own) -> runRefs crops picture 1 to it (the middle) and sends exact -> exact_size on the job",
  "window.H3BasicImageSize = () => (ovrStyleOn() ? imgWhFromUi() : null);" in IX and "const want = typeof root.H3BasicImageSize" in PL and PL.count("exact }, tellSay)") == 2
  and 'if (req.exact) fd.append("exact", "1");' in MT and 'if (b.exact === "1") p.exact_size = true;' in RA)
check("2.699.0: Override style not ticked = no Basic Settings size; then the FIRST picture's own size (16 px steps, <= 4096) is sent, exact either way",
  "ovrStyleOn() ? imgWhFromUi() : null" in IX and "{ w: a16(bmp.width * cap), h: a16(bmp.height * cap) }" in PL and "4096 / Math.max(bmp.width, bmp.height)" in PL and "const exact = true;" in PL)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
