#!/usr/bin/env python3
"""bitGen Studio — scripts/garment_pattern.py (2.932.0): 👗 a sewing pattern from GarmentCode's garment programs.

Runs in the Garment designer add-on's own Python (<app>/garmentcode/.venv, numpy < 2 - lib/garmentAddon.js) with
GarmentCode's repository (MIT, github.com/maria-korosteleva/GarmentCode) on sys.path. Only the pattern side is used:
pygarment's garment programs + its SVG / PNG writer. GarmentCode's own drape simulator (a fork of NVIDIA Warp under the
NVIDIA Source Code License - non-commercial) is NOT used.

  python garment_pattern.py <request.json>
request: {"op": "schema", "src": <GarmentCode dir>}
     ->  GARMENT {"ok": true, "schema": {...the design tree of assets/design_params/default.yaml...}}
request: {"op": "make", "src": <dir>, "name": <stem>, "out": <folder>, "body": {<measurement>: cm ...},
          "design": {...a full design tree - every leaf {"v": ..., "range": [...], "type": ...}}}
     ->  <out>/pattern.svg, pattern.png, specification.json, outline.json, body.yaml, design.json
         GARMENT {"ok": true, "panels": n, "stitches": n, "self_intersecting": bool, "size_cm": [w, h], "files": {...}}
     ->  GARMENT {"ok": false, "error": "..."}   (the garment program refused these settings - its own words)

outline.json = {"units": "cm", "panels": [{"name", "outline": [[x, y] ...] (closed, y up, the panel's own frame),
  "edges": [{"from": i, "to": j, "a": [x, y], "b": [x, y], "length": cm, "at": [k0, k1]} ...] (k = outline index range),
  "translation": [x, y, z], "rotation": [rx, ry, rz] (degrees, XYZ - where the panel hangs round the body), "label"}],
  "stitches": [[{"panel", "edge"}, {"panel", "edge"}] ...]}
"""
import json
import os
import sys
import traceback


def say(obj):
    print("GARMENT " + json.dumps(obj), flush=True)


def sample(seg, n):
    """points along one svgpathtools segment (complex), the start included, the end left to the next edge"""
    return [seg.point(i / float(n)) for i in range(n)]


def seg_steps(seg):
    try:
        length = seg.length(error=1e-3)
    except Exception:
        length = abs(seg.end - seg.start)
    if seg.__class__.__name__ == "Line":
        return 1, length
    return max(4, min(64, int(length / 1.5) + 1)), length    # a point every ~1.5 cm along a curve


def outline_of(BP, panel):
    """the closed outline of one panel in cm (y up), the same curves pygarment draws in its SVG"""
    import numpy as np
    verts = np.asarray(panel["vertices"], dtype=float)
    flipped = verts * np.array([1.0, -1.0])                  # pygarment's writer works in image coordinates (y down)
    pts, edges = [], []
    for e in panel["edges"]:
        seg = BP._edge_as_curve(flipped, e)
        n, length = seg_steps(seg)
        k0 = len(pts)
        for c in sample(seg, n):
            pts.append([round(c.real, 4), round(-c.imag, 4)])
        a, b = e["endpoints"]
        edges.append({"from": int(a), "to": int(b), "a": [round(verts[a][0], 4), round(verts[a][1], 4)],
                      "b": [round(verts[b][0], 4), round(verts[b][1], 4)], "length": round(float(length), 3),
                      "at": [k0, len(pts)]})
    return pts, edges


def stub_missing():
    """pygarment imports CairoSVG (needs the cairo library - not on Windows without extra DLLs) and matplotlib only to draw
    PNG previews; bitGen shows the SVG, so a stand-in that draws nothing is fine when they are not there"""
    import types
    for name in ("cairosvg",):
        try:
            __import__(name)
        except Exception:
            m = types.ModuleType(name)
            m.svg2png = lambda *a, **k: None
            m.svg2pdf = lambda *a, **k: None
            sys.modules[name] = m


def op_schema(req):
    import yaml
    with open(os.path.join(req["src"], "assets", "design_params", "default.yaml"), "r", encoding="utf-8") as f:
        return {"ok": True, "schema": yaml.safe_load(f)["design"]}


def op_make(req):
    import yaml
    from pathlib import Path
    out = req["out"]
    os.makedirs(out, exist_ok=True)
    body_file = os.path.join(out, "body.yaml")
    with open(body_file, "w", encoding="utf-8") as f:
        yaml.safe_dump({"body": {k: float(v) for k, v in (req.get("body") or {}).items()}}, f)
    with open(os.path.join(out, "design.json"), "w", encoding="utf-8") as f:
        json.dump(req["design"], f, indent=1)

    from assets.garment_programs.meta_garment import MetaGarment
    from assets.bodies.body_params import BodyParameters
    from pygarment.pattern.wrappers import VisPattern   # it has the writer's _flip_y

    body = BodyParameters(body_file)
    name = str(req.get("name") or "garment")
    piece = MetaGarment(name, body, req["design"])
    pattern = piece.assembly()
    if not pattern.pattern.get("panels"):
        return {"ok": False, "error": "these settings make no pieces - pick a top, a waistband or a bottom"}
    selfx = bool(piece.is_self_intersecting())
    tmp = Path(out) / "_gc"
    folder = pattern.serialize(tmp, tag="", to_subfolder=True, with_3d=False, with_text=False, view_ids=False,
                               with_printable=False)
    folder = Path(folder)
    stem = folder.name
    files = {}
    for src, dst, key in ((f"{stem}_specification.json", "specification.json", "spec"),
                          (f"{stem}_pattern.svg", "pattern.svg", "svg"), (f"{stem}_pattern.png", "pattern.png", "png")):
        p = folder / src
        if p.exists():
            os.replace(p, os.path.join(out, dst))
            files[key] = dst
    try:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
    except Exception:
        pass
    spec_file = os.path.join(out, "specification.json")
    BP = VisPattern(spec_file)
    spec = BP.pattern
    panels = []
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for pname in BP.panel_order():
        if pname is None:
            continue
        P = spec["panels"][pname]
        pts, edges = outline_of(BP, P)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        minx, maxx, miny, maxy = min(minx, *xs), max(maxx, *xs), min(miny, *ys), max(maxy, *ys)
        panels.append({"name": pname, "label": P.get("label", ""), "outline": pts, "edges": edges,
                       "translation": [round(float(v), 4) for v in P.get("translation", [0, 0, 0])],
                       "rotation": [round(float(v), 4) for v in P.get("rotation", [0, 0, 0])]})
    stitches = [[{"panel": s[0]["panel"], "edge": int(s[0]["edge"])}, {"panel": s[1]["panel"], "edge": int(s[1]["edge"])}]
                for s in spec.get("stitches", [])]
    with open(os.path.join(out, "outline.json"), "w", encoding="utf-8") as f:
        json.dump({"units": "cm", "name": name, "panels": panels, "stitches": stitches,
                   "self_intersecting": selfx}, f)
    files["outline"] = "outline.json"
    return {"ok": True, "panels": len(panels), "stitches": len(stitches), "self_intersecting": selfx,
            "size_cm": [round(maxx - minx, 1), round(maxy - miny, 1)], "files": files}


def main():
    if len(sys.argv) < 2:
        say({"ok": False, "error": "usage: garment_pattern.py <request.json>"})
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        req = json.load(f)
    src = req.get("src") or ""
    if not os.path.isfile(os.path.join(src, "assets", "garment_programs", "meta_garment.py")):
        say({"ok": False, "error": f"GarmentCode is not in {src} - Settings ▸ Add-ons ▸ Garment designer ▸ Install"})
        return 1
    sys.path.insert(0, src)
    stub_missing()
    os.chdir(src)                     # the garment programs read a few files relative to the repository
    try:
        res = op_schema(req) if req.get("op") == "schema" else op_make(req)
    except Exception as e:            # the garment program's own words: a setting it cannot build
        traceback.print_exc()
        msg = str(e).strip() or e.__class__.__name__
        say({"ok": False, "error": msg[:400]})
        return 1
    say(res)
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
