#!/usr/bin/env python3
"""bitGen Studio - 2.697.0: P-H3 Image Edit's guider kept. scripts/comfy_image.py bypass_image_slot passed through EVERY node
downstream of an unused picture slot that had a `conditioning` input - in P-H3's graph that is its BasicGuider (after
PH3ImageConditioning), so the sampler's guider got a CONDITIONING: "Return type mismatch between linked nodes [guider]".
Tim (verbatim): "p-h3 downloaded but doesn't work... node 14: Return type mismatch between linked nodes [guider]"
"""
import copy, glob, json, os, sys
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
def bad_links(g):
    out = []
    for k, v in g.items():
        for kk, vv in (v.get("inputs") or {}).items():
            if isinstance(vv, list) and len(vv) == 2 and isinstance(vv[0], str):
                if vv[0] not in g: out.append(k + "." + kk + " -> missing " + vv[0])
                elif kk == "guider" and "Guider" not in g[vv[0]]["class_type"]: out.append(k + ".guider <- " + g[vv[0]]["class_type"])
    return out
g, rep = C.apply_images(load("img_ph3_edit.json"), ["crop.png"])
check("P-H3 Image Edit, one picture: the sampler's guider is still the BasicGuider (node 10)", g.get("10", {}).get("class_type") == "BasicGuider" and g["14"]["inputs"]["guider"] == ["10", 0], g.get("14"))
check("…picture 1 in slot 51, slots 52-58 gone and their images.image_N inputs dropped", [r[2] for r in rep] == ["slot"] + ["bypassed"] * 7 and sorted(k for k in g["9"]["inputs"] if k.startswith("images.")) == ["images.image_1"] and not any(str(n) in g for n in range(52, 59)))
g3, _ = C.apply_images(load("img_ph3_edit.json"), ["a.png", "b.png", "c.png"])
check("…three pictures: images.image_1-3 kept, the guider kept", sorted(k for k in g3["9"]["inputs"] if k.startswith("images.")) == ["images.image_1", "images.image_2", "images.image_3"] and not bad_links(g3))
gc, _ = C.apply_images(load("h3_character_creator.json"), ["a.png"])
check("the character creator's two BasicGuiders kept too (the same bug)", all(gc[s]["inputs"]["guider"][0] in gc and "Guider" in gc[gc[s]["inputs"]["guider"][0]]["class_type"] for s in gc if gc[s]["class_type"] == "SamplerCustomAdvanced"))
# every shipped workflow with picture slots: no sampler guider left pointing at a non-guider, no ReferenceLatent of an unused slot left
broken = []
for f in sorted(glob.glob(os.path.join(ROOT, "comfy_workflows", "*.json"))):
    try:
        gg = json.load(open(f))
    except Exception:
        continue
    if not isinstance(gg, dict) or "nodes" in gg: continue
    gg = {k: v for k, v in gg.items() if isinstance(v, dict) and "class_type" in v}
    if not any(v["class_type"] == "LoadImage" for v in gg.values()): continue
    try:
        out, _ = C.apply_images(copy.deepcopy(gg), ["a.png"])
    except C.PatchError:
        continue
    b = [x for x in bad_links(out) if ".guider" in x]
    refs = [k for k, v in out.items() if v["class_type"] == "ReferenceLatent" and not (isinstance(v["inputs"].get("latent"), list) and v["inputs"]["latent"][0] in out)]
    if b or refs: broken.append((os.path.basename(f), b[:2], refs[:2]))
check("every shipped workflow, one picture: no guider wired to a non-guider, no ReferenceLatent left for an empty slot", not broken, broken)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
