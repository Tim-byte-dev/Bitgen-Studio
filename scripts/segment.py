#!/usr/bin/env python3
"""bitGen Studio — SEGMENT ANYTHING for the image editor (2.390.0).

Tim (verbatim): "yes, please do these steps and maybe add sam to segment the image on the layer and add an option to
put segments on different layers" - the steps: layers as references, a prompt that masks ("mask the person's head"),
PSD files, Generate using the editor's layers.

Run by lib/segment.js inside its own venv (venvs/segment: torch + segment-anything + transformers, the SAM checkpoint
in models/sam, CLIPSeg in models/hf) as a SERVER that keeps the models loaded:
    python scripts/segment.py --serve [--fake]
stdin: one JSON request per line, stdout: "H3SEG <json>" answers ("H3SEG-LOG <text>" while it loads). A request:
    {id, op, image (a PNG path), out_dir, prefix, model: vit_b|vit_l|vit_h, checkpoint, ...}
  op "points"  point / box prompts -> ONE mask (the best of SAM's three)            {points: [[x, y, 1|0]], box}
  op "text"    words -> a mask per word: CLIPSeg finds where the word is, SAM draws its exact outline from that
               region's box + its strongest point (refine false = CLIPSeg's rough mask only)
               {prompt: "head, dog", threshold: 0.35, refine: true, instances: false (each separate thing its own mask)}
  op "auto"    EVERYTHING: SamAutomaticMaskGenerator's masks, biggest first     {points_per_side, max, min_area (% of
               the picture), iou, stability}
  op "status"  the device and what is loaded
An answer: {id, ok, masks: [{file, label, bbox: [x, y, w, h], area, score}], took, note} - each mask a full-size
8-bit PNG (255 = the segment). --fake = no torch: flat-colour regions stand in for SAM's (the tests, and the pipes).
"""
import json
import os
import sys
import time
from collections import deque

import numpy as np
from PIL import Image

FAKE = "--fake" in sys.argv
STATE = {"sam": {}, "pred": {}, "pred_key": None, "clipseg": None, "device": None}
CLIPSEG_ID = "CIDAS/clipseg-rd64-refined"
COLOURS = {"red": (220, 40, 40), "green": (40, 180, 60), "blue": (40, 70, 220), "yellow": (230, 210, 40),
           "white": (245, 245, 245), "black": (15, 15, 15), "orange": (240, 140, 30), "purple": (140, 60, 190)}


def say(obj):
    print("H3SEG " + json.dumps(obj), flush=True)


def log(text):
    print("H3SEG-LOG " + str(text), flush=True)


# ------------------------------------------------------------------ helpers (numpy only - tested in --fake)
def load_rgb(path):
    if str(path).lower().endswith(".jxl"):              # 2.479.0: JPEG XL - its PNG (scripts/jxl_png.py)
        import jxl_png
        path = jxl_png.png_for(path)
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    return np.array(im.convert("RGB"))


def label_components(mask):
    """8-connected components of a bool mask -> (labels int32, n). scipy / cv2 when there, else a BFS"""
    try:
        import cv2  # noqa: WPS433
        n, lab = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
        return lab.astype(np.int32), n - 1
    except Exception:  # noqa: BLE001
        pass
    try:
        from scipy import ndimage  # noqa: WPS433
        lab, n = ndimage.label(mask, structure=np.ones((3, 3), int))
        return lab.astype(np.int32), int(n)
    except Exception:  # noqa: BLE001
        pass
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or lab[y0, x0]:
                continue
            n += 1
            q = deque([(y0, x0)])
            lab[y0, x0] = n
            while q:
                y, x = q.popleft()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n
                            q.append((yy, xx))
    return lab, n


def bbox_of(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return [0, 0, 0, 0]
    return [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def write_masks(req, items):
    """items [(bool mask, label, score)] -> the answer's masks (PNG files in out_dir)"""
    out_dir = req["out_dir"]
    os.makedirs(out_dir, exist_ok=True)
    prefix = str(req.get("prefix") or "seg")
    out = []
    for i, (m, label, score) in enumerate(items):
        m = np.asarray(m, bool)
        area = int(m.sum())
        if not area:
            continue
        name = f"{prefix}_{i + 1:03d}.png"
        Image.fromarray((m * 255).astype(np.uint8), "L").save(os.path.join(out_dir, name), optimize=True)
        out.append({"file": name, "label": label, "bbox": bbox_of(m), "area": area, "score": round(float(score), 4)})
    return out


def fake_regions(rgb, step=48):
    """flat-colour regions (colours quantised) - the --fake stand-in for SAM's masks"""
    q = (rgb.astype(np.int32) // step)
    key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    regions = []
    for k in np.unique(key):
        lab, n = label_components(key == k)
        for i in range(1, n + 1):
            m = lab == i
            regions.append(m)
    regions.sort(key=lambda m: -int(m.sum()))
    return regions


def components_of(mask, min_px):
    lab, n = label_components(mask)
    comps = [lab == i for i in range(1, n + 1)]
    return sorted([c for c in comps if c.sum() >= min_px], key=lambda c: -int(c.sum()))


# ------------------------------------------------------------------ the models
def device():
    if STATE["device"]:
        return STATE["device"]
    import torch  # noqa: WPS433
    STATE["device"] = "cuda" if torch.cuda.is_available() else "cpu"
    return STATE["device"]


def sam_model(req):
    kind = req.get("model") or "vit_b"
    ck = req.get("checkpoint") or ""
    if (kind, ck) in STATE["sam"]:
        return STATE["sam"][(kind, ck)]
    from segment_anything import sam_model_registry  # noqa: WPS433
    if not ck or not os.path.exists(ck):
        raise RuntimeError(f"the SAM checkpoint is missing ({ck or kind}) - ⬇ Install in Segment settings fetches it")
    log(f"loading SAM {kind} from {os.path.basename(ck)} on {device()}")
    sam = sam_model_registry[kind](checkpoint=ck)
    sam.to(device=device())
    sam.eval()
    STATE["sam"] = {(kind, ck): sam}          # one model in memory
    STATE["pred"] = {}
    STATE["pred_key"] = None
    return sam


def predictor(req, rgb):
    """SamPredictor with THIS picture's embedding - kept while the same picture is clicked again"""
    from segment_anything import SamPredictor  # noqa: WPS433
    sam = sam_model(req)
    st = os.stat(req["image"])
    key = (id(sam), req["image"], st.st_mtime_ns, st.st_size)
    if STATE["pred_key"] != key:
        p = STATE["pred"].get("p") or SamPredictor(sam)
        t = time.time()
        p.set_image(rgb)
        log(f"picture embedded in {time.time() - t:.1f}s")
        STATE["pred"] = {"p": p}
        STATE["pred_key"] = key
    return STATE["pred"]["p"]


def clipseg():
    if STATE["clipseg"]:
        return STATE["clipseg"]
    from transformers import CLIPSegForImageSegmentation, CLIPSegProcessor  # noqa: WPS433
    log("loading CLIPSeg (the words -> where)")
    proc = CLIPSegProcessor.from_pretrained(CLIPSEG_ID)
    model = CLIPSegForImageSegmentation.from_pretrained(CLIPSEG_ID)
    model.to(device())
    model.eval()
    STATE["clipseg"] = (proc, model)
    return STATE["clipseg"]


def heat(rgb, terms):
    """CLIPSeg: one probability map per word, the picture's size, 0..1"""
    import torch  # noqa: WPS433
    proc, model = clipseg()
    pil = Image.fromarray(rgb)
    inputs = proc(text=terms, images=[pil] * len(terms), padding="max_length", return_tensors="pt")
    inputs = {k: v.to(device()) for k, v in inputs.items()}
    with torch.no_grad():
        logits = model(**inputs).logits
    if logits.dim() == 2:
        logits = logits.unsqueeze(0)
    probs = torch.sigmoid(logits).float().cpu().numpy()
    h, w = rgb.shape[:2]
    return [np.asarray(Image.fromarray((p * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float32) / 255.0
            for p in probs]


def best_of(masks, scores):
    i = int(np.argmax(scores))
    return np.asarray(masks[i], bool), float(scores[i])


# ------------------------------------------------------------------ the ops
def op_points(req, rgb):
    pts = [p for p in (req.get("points") or []) if len(p) >= 2]
    box = req.get("box")
    if not pts and not box:
        raise RuntimeError("click on the picture (or drag a box) first")
    h, w = rgb.shape[:2]
    if FAKE:
        regions = fake_regions(rgb)
        m = np.zeros((h, w), bool)
        for x, y, *lab in pts:
            x, y = int(min(w - 1, max(0, x))), int(min(h - 1, max(0, y)))
            r = next((r for r in regions if r[y, x]), None)
            if r is not None:
                m = (m & ~r) if (lab and int(lab[0]) == 0) else (m | r)
        if box and not pts:
            x0, y0, x1, y1 = [int(v) for v in box]
            inside = [r for r in regions if bbox_of(r)[0] >= x0 and bbox_of(r)[1] >= y0
                      and bbox_of(r)[0] + bbox_of(r)[2] <= x1 + 1 and bbox_of(r)[1] + bbox_of(r)[3] <= y1 + 1]
            if inside:
                m = inside[0]
        return [(m, "object", 0.99)]
    p = predictor(req, rgb)
    kw = {"multimask_output": True}
    if pts:
        kw["point_coords"] = np.array([[float(a[0]), float(a[1])] for a in pts], np.float32)
        kw["point_labels"] = np.array([int(a[2]) if len(a) > 2 else 1 for a in pts], np.int32)
    if box:
        kw["box"] = np.array([float(v) for v in box], np.float32)
    masks, scores, _ = p.predict(**kw)
    m, s = best_of(masks, scores)
    return [(m, "object", s)]


def op_text(req, rgb):
    terms = [t.strip() for t in str(req.get("prompt") or "").replace(";", ",").split(",") if t.strip()][:8]
    if not terms:
        raise RuntimeError("write what to select (\"the person's head\", \"dog, car\")")
    thr = float(req.get("threshold") or 0.35)
    refine = req.get("refine", True) is not False
    each = bool(req.get("instances"))
    h, w = rgb.shape[:2]
    min_px = max(16, int(h * w * 0.001))
    out = []
    if FAKE:
        regions = fake_regions(rgb)
        for t in terms:
            col = next((c for n, c in COLOURS.items() if n in t.lower()), None)
            if col is not None:
                d = np.sqrt(((rgb.astype(np.float32) - np.array(col, np.float32)) ** 2).sum(-1))
                m = d < 90
            else:
                m = regions[1] if len(regions) > 1 else regions[0]      # the biggest thing that is not the background
            comps = components_of(m, min_px) if each else [m]
            for i, c in enumerate(comps):
                out.append((c, t if len(comps) == 1 else f"{t} {i + 1}", 0.9))
        return out
    maps = heat(rgb, terms)
    p = predictor(req, rgb) if refine else None
    for t, pm in zip(terms, maps):
        top = float(pm.max())
        cut = thr if top >= thr else (0.6 * top if top >= 0.12 else None)
        if cut is None:
            log(f"\"{t}\": not found (best {top:.2f})")
            continue
        rough = pm >= cut
        comps = components_of(rough, min_px) or [rough]
        found = []
        for c in comps:
            if not refine:
                found.append((c, float(pm[c].mean())))
                continue
            x, y, bw, bh = bbox_of(c)
            pad = int(0.06 * max(bw, bh))
            box = np.array([max(0, x - pad), max(0, y - pad), min(w - 1, x + bw + pad), min(h - 1, y + bh + pad)], np.float32)
            iy, ix = np.unravel_index(np.argmax(np.where(c, pm, -1)), pm.shape)
            masks, scores, _ = p.predict(point_coords=np.array([[ix, iy]], np.float32), point_labels=np.array([1], np.int32),
                                         box=box, multimask_output=True)
            m, s = best_of(masks, scores)
            found.append((m, s))
        if each:
            for i, (m, s) in enumerate(found):
                out.append((m, t if len(found) == 1 else f"{t} {i + 1}", s))
        else:
            u = np.zeros((h, w), bool)
            for m, _s in found:
                u |= m
            out.append((u, t, max(s for _m, s in found)))
    return out


def op_auto(req, rgb):
    h, w = rgb.shape[:2]
    mx = max(1, min(256, int(req.get("max") or 64)))
    min_px = max(16, int(h * w * float(req.get("min_area") or 0.2) / 100.0))
    if FAKE:
        regs = [r for r in fake_regions(rgb) if r.sum() >= min_px][:mx]
        return [(r, f"segment {i + 1}", 0.95) for i, r in enumerate(regs)]
    from segment_anything import SamAutomaticMaskGenerator  # noqa: WPS433
    gen = SamAutomaticMaskGenerator(model=sam_model(req), points_per_side=int(req.get("points_per_side") or 32),
                                    pred_iou_thresh=float(req.get("iou") or 0.86),
                                    stability_score_thresh=float(req.get("stability") or 0.92),
                                    min_mask_region_area=min_px)
    t = time.time()
    anns = gen.generate(rgb)
    log(f"{len(anns)} segments in {time.time() - t:.1f}s")
    anns = sorted([a for a in anns if int(a["area"]) >= min_px], key=lambda a: -int(a["area"]))[:mx]
    return [(a["segmentation"], f"segment {i + 1}", float(a.get("predicted_iou", 0))) for i, a in enumerate(anns)]


OPS = {"points": op_points, "text": op_text, "auto": op_auto}


def handle(req):
    t0 = time.time()
    op = req.get("op")
    if op == "status":
        return {"ok": True, "fake": FAKE, "device": "fake" if FAKE else device(),
                "loaded": [k[0] for k in STATE["sam"]], "clipseg": bool(STATE["clipseg"])}
    if op not in OPS:
        raise RuntimeError(f"unknown op {op!r}")
    rgb = load_rgb(req["image"])
    items = OPS[op](req, rgb)
    masks = write_masks(req, items)
    note = f"{op}: {len(masks)} mask(s)" + (" (fake - flat-colour regions, not SAM)" if FAKE else f" on {device()}")
    return {"ok": True, "masks": masks, "w": int(rgb.shape[1]), "h": int(rgb.shape[0]), "took": round(time.time() - t0, 3), "note": note}


def serve():
    log("ready" + (" (fake)" if FAKE else ""))
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        rid = None
        try:
            req = json.loads(line)
            rid = req.get("id")
            ans = handle(req)
        except Exception as e:  # noqa: BLE001 - every failure is an answer, the server lives on
            ans = {"ok": False, "error": str(e)[:500]}
        ans["id"] = rid
        say(ans)


if __name__ == "__main__":
    if "--serve" in sys.argv:
        serve()
    else:
        print(__doc__)
