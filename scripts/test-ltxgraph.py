#!/usr/bin/env python3
"""bitGen Studio — 2.338.0: scripts/ltx_graph.patch on Tim's real canvas.
Run: python3 scripts/test-ltxgraph.py

Every mode is converted with scripts/ltx_convert.js (a bare per-class
/object_info, like the stub) and patched: the prompt, the pictures by their
"Load Image<n>" titles, the audio window, the video skip, the length, the fps,
the size, the seeds, the transition LoRA by mode, the style LoRAs, the output
prefix, and the prune (only what VHS_VideoCombine needs is queued)."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import ltx_graph as LG  # noqa: E402

WF = ROOT / "comfy_workflows" / "LTX25_All_In_One.json"
CONV = ROOT / "scripts" / "ltx_convert.js"
TMP = Path(tempfile.mkdtemp(prefix="ltxg-"))
P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:400]))


def convert(mode):
    r = subprocess.run(["node", str(CONV), "classes", str(WF), mode], capture_output=True, text=True)
    classes = json.loads(r.stdout or "{}").get("classes") or []
    info = TMP / f"info_{mode}.json"
    info.write_text(json.dumps({c: {"input": {}} for c in classes}))
    out = TMP / f"api_{mode}.json"
    r = subprocess.run(["node", str(CONV), "convert", str(WF), mode, str(TMP / "none.json"), str(info), str(out)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("convert failed: " + r.stderr[-400:])
    return json.loads(out.read_text())["graph"]


def of(g, cls):
    return [v for v in g.values() if v.get("class_type") == cls]


def title(v):
    return (v.get("_meta") or {}).get("title") or ""


def links_to(g, cls):
    """ids of nodes of class cls something still links to."""
    ids = {k for k, v in g.items() if v.get("class_type") == cls}
    return {str(x[0]) for v in g.values() for x in (v.get("inputs") or {}).values()
            if isinstance(x, list) and len(x) == 2 and str(x[0]) in ids}


BASE = {"prompt": "A woman sings on a rooftop at dusk.", "negative": "blurry", "seconds": 6, "fps": 24,
        "width": 960, "height": 544, "seed": 1234, "prefix": "bitgen_ltx"}
graphs = {}
for m in ("t2v", "i2v", "flf", "fmlf", "a2v", "lipsync", "fl_lipsync", "v2v"):
    graphs[m] = convert(m)

# ---- the common values
for m, g0 in graphs.items():
    imgs = {"i2v": 1, "flf": 2, "fmlf": 3, "lipsync": 1, "fl_lipsync": 2, "v2v": 1}.get(m, 0)
    o = dict(BASE, mode=m, images=[f"pic{i + 1}.png" for i in range(imgs)],
             audio={"name": "song.wav", "start": 12.5} if m in ("a2v", "lipsync", "fl_lipsync", "fmlf") else {},
             video={"name": "clip.mp4", "skip": 48} if m == "v2v" else {})
    g, notes = LG.patch(g0, o)
    pos = [v for v in of(g, "CLIPTextEncode") if "positive" in title(v).lower()]
    check(f"{m}: the prompt in the positive CLIPTextEncode", pos and all(v["inputs"]["text"] == BASE["prompt"] for v in pos))
    li = {title(v): v["inputs"].get("image") for v in of(g, "LoadImage")}
    check(f"{m}: {imgs} picture(s) by their Load Image titles, nothing else loaded",
          sorted(li.values()) == [f"pic{i + 1}.png" for i in range(imgs)], li)
    sl = of(g, "mxSlider")
    check(f"{m}: the clip length (mxSlider Xi/Xf) = 6 s, fps 24",
          sl and all(v["inputs"]["Xi"] == 6 and v["inputs"]["Xf"] == 6.0 for v in sl)
          and all(v["inputs"]["value"] == 24 for v in of(g, "INTConstant") if "fps" in title(v).lower()))
    check(f"{m}: the size numbers replace the ResolutionSelector (it is pruned)",
          not of(g, "ResolutionSelector") and any(x == 960 for v in g.values() for x in (v.get("inputs") or {}).values()))
    rn = of(g, "RandomNoise")
    check(f"{m}: the seeds (1234, 1235, ...)", rn and sorted(v["inputs"]["noise_seed"] for v in rn)[0] == 1234)
    vc = of(g, "VHS_VideoCombine")
    check(f"{m}: one VHS_VideoCombine, prefix bitgen_ltx, saved", len(vc) == 1 and vc[0]["inputs"]["filename_prefix"] == "bitgen_ltx"
          and vc[0]["inputs"]["save_output"] is True)
    pl = [v for v in g.values() if str(v.get("class_type", "")).startswith("Power Lora Loader")]
    trow = [r for v in pl for r in v["inputs"].values() if isinstance(r, dict) and "transition" in str(r.get("lora", "")).lower()]
    want = m in ("flf", "fl_lipsync", "fmlf")
    check(f"{m}: the transition LoRA {'on' if want else 'off'}", trow and all(r["on"] is want for r in trow), trow)
    dang = [(k, kk) for k, v in g.items() for kk, x in (v.get("inputs") or {}).items()
            if isinstance(x, list) and len(x) == 2 and isinstance(x[1], int) and str(x[0]) not in g]
    check(f"{m}: no link to a node that is not queued (SetNode pass-through wires resolved, lib/subgraphs 2.338.0)", not dang, dang)
    loaders = of(g, "UnetLoaderGGUF") + of(g, "UNETLoader")
    check(f"{m}: one model loader left after the prune", len(loaders) == 1, [v["class_type"] for v in loaders])
    if m in ("a2v", "lipsync", "fl_lipsync", "fmlf"):
        au = of(g, "VHS_LoadAudioUpload")
        check(f"{m}: the audio + its start (the song window)", au and au[0]["inputs"]["audio"] == "song.wav"
              and au[0]["inputs"]["start_time"] == 12.5)
    else:
        check(f"{m}: no audio loader queued", not of(g, "VHS_LoadAudioUpload"))
    if m == "v2v":
        lv = of(g, "VHS_LoadVideo")
        check("v2v: the video + skip_first_frames", lv and lv[0]["inputs"]["video"] == "clip.mp4" and lv[0]["inputs"]["skip_first_frames"] == 48)

# ---- the knobs
g, notes = LG.patch(graphs["i2v"], dict(BASE, mode="i2v", images=["a.png"], transition=True,
                                         style_loras=[{"path": "ltx/myStyle.safetensors", "weight": 0.7}]))
pl = [v for v in g.values() if str(v.get("class_type", "")).startswith("Power Lora Loader")][0]["inputs"]
rows = [r for k, r in pl.items() if k.startswith("lora_")]
check("transition forced on in i2v; the style's LoRA added as the next row",
      any("transition" in r["lora"] and r["on"] for r in rows)
      and any(r["lora"] == "ltx/myStyle.safetensors" and r["strength"] == 0.7 and r["on"] for r in rows), rows)
g, _ = LG.patch(graphs["flf"], dict(BASE, mode="flf", images=["a.png", "b.png"], transition=False))
pl = [v for v in g.values() if str(v.get("class_type", "")).startswith("Power Lora Loader")][0]["inputs"]
check("transition forced off in flf", all(not r["on"] for k, r in pl.items() if k.startswith("lora_") and "transition" in r["lora"]))
g, notes = LG.patch(graphs["i2v"], dict(BASE, mode="i2v", images=["a.png", "b.png"]))
check("a picture the mode has no slot for: said, not an error", any("no Load Image2" in n for n in notes), notes)
try:
    LG.patch({"1": {"class_type": "KSampler", "inputs": {}}}, {"mode": "t2v"})
    check("a graph without the positive prompt is refused in words", False)
except ValueError as e:
    check("a graph without the positive prompt is refused in words", "positive" in str(e))
try:
    LG.patch({}, {})
    check("an empty graph is refused in words", False)
except ValueError as e:
    check("an empty graph is refused in words", "empty" in str(e))
g0 = graphs["t2v"]
g, _ = LG.patch(g0, dict(BASE, mode="t2v"))
check("patch never touches its input graph", g0 != g and not any(isinstance(v, dict) and v.get("inputs", {}).get("filename_prefix") == "bitgen_ltx"
                                                                    and v.get("inputs", {}).get("save_output") is True and False for v in g0.values()))
check("the prune: every link in the queued graph points at a node that is there",
      all(str(x[0]) in g for v in g.values() for x in (v.get("inputs") or {}).values()
          if isinstance(x, list) and len(x) == 2 and isinstance(x[1], int)))

# ---- 2.339.0: LTX Ripple (the swap dialog's second engine) on the v2v mode
g, notes = LG.patch(graphs["v2v"], dict(BASE, mode="v2v", images=["ff.png"], video={"name": "clip.mp4", "skip": 0},
                                        frames=129, ic_lora={"name": "LTX25_Ripple_v11.safetensors", "strength": 1.35},
                                        raw_guide=True))
ic = of(g, "LTXICLoRALoaderModelOnly")
check("ripple: the IC-LoRA = LTX25_Ripple_v11 @ 1.35 (not the union-control one)",
      ic and all("LTX25_Ripple_v11.safetensors" in v["inputs"].values() and 1.35 in v["inputs"].values() for v in ic)
      and not any("union-control" in str(x) for v in ic for x in v["inputs"].values()), ic)
check("ripple: the raw video is the IC guide - no pose / depth / canny preprocessor is queued",
      not [v for v in g.values() if v.get("class_type") in LG.PREPROCESSORS], sorted({v["class_type"] for v in g.values()}))
lv = of(g, "VHS_LoadVideo")
check("ripple: the video loads exactly 129 frames (8k+1), from its first", lv and lv[0]["inputs"]["frame_load_cap"] == 129
      and lv[0]["inputs"]["skip_first_frames"] == 0)
check("ripple: the edited first frame is Load Image1", [v["inputs"].get("image") for v in of(g, "LoadImage")] == ["ff.png"])
check("ripple: still nothing dangling", not [(k, kk) for k, v in g.items() for kk, x in (v.get("inputs") or {}).items()
      if isinstance(x, list) and len(x) == 2 and isinstance(x[1], int) and str(x[0]) not in g])
check("ripple: the notes say what went in", any("IC-LoRA LTX25_Ripple_v11" in n for n in notes) and any("raw video" in n for n in notes), notes)
try:
    LG.patch(graphs["i2v"], dict(BASE, mode="i2v", images=["a.png"], ic_lora={"name": "x.safetensors"}))
    check("an IC-LoRA on a mode without the loader is refused in words", False)
except ValueError as e:
    check("an IC-LoRA on a mode without the loader is refused in words", "IC-LoRA loader" in str(e))
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
