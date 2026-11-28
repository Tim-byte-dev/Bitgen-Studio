#!/usr/bin/env python3
"""bitGen Studio — 🧩 MING LAYERED DESIGN worker (3.9.0; 3.12.0 runs it in ComfyUI): mode "ming" (lib/mingAddon.js,
lib/mingLayers.js, scripts/ming_graph.py).
Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with add
layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
generate separate layers"
3.12.0 - Tim: "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image"

Two steps, each optional:
  1 the design    Ming-Image Design from the layer list's JSON prompt (params.t2i_prompt) -> one flat picture (in ComfyUI 0.1
                  Design with its own text encoder; 0.2 once a 0.2 encoder is listed - scripts/ming_graph.py pick, 3.13.2)
  2 the layers    Ming-Image-0.1-Design-Layer splits the flat picture (or params.input - a picture to split) by the plan
                  (params.layer_plan) -> N transparent PNGs, layer 1 the front-most
engine "comfy":      ComfyUI's own Ming-Image nodes (0.46.0 or newer) with Comfy-Org/Ming-Image's files (int8 unless the bf16
                     ones are what params.precision asks for) - one graph per step (scripts/ming_graph.py), live step lines
engine "openrouter": POST <base>/images (the key in job.json config.apis - lib/orRender.js jobApis); 0.2-Design when OpenRouter
                     has it, else 0.1-Design (said)
Writes <name>_ming.png (the design) and <name>_ming_L01_<layer>.png … (front first) in the project's output folder:
"@@OUTS [...]" (the design first when there is one, then the layers), "@@OUT" the last.
"""
import base64
import json
import os
import re
import shutil
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

HERE = Path(__file__).resolve().parent


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def slug(s, n=24):
    return (re.sub(r"[^A-Za-z0-9_-]+", "_", str(s or "")).strip("_")[:n]) or "layer"


def free_name(d, stem, ext):
    n, i = f"{stem}{ext}", 2
    while (d / n).exists():
        n, i = f"{stem}_{i}{ext}", i + 1
    return n


def name_layers(files, rows, out_dir, stem):
    """the layer PNGs (front first) -> the output folder, each named after its row"""
    names = []
    for i, f in enumerate(files):
        row = rows[i] if i < len(rows) else {"name": f"Layer {i + 1}"}
        n = free_name(out_dir, f"{stem}_ming_L{i + 1:02d}_{slug(row.get('name'))}", ".png")
        shutil.copyfile(f, out_dir / n)
        names.append(n)
    return names


def count_note(got, want):
    if got == want:
        return ""
    return f" (asked for {want}, the model gave {got})"


# ---------------------------------------------------------------- in ComfyUI (3.12.0)
def _comfy_mods():
    sys.path.insert(0, str(HERE.parent / "scripts"))
    import comfy_client as cc                              # noqa: E402
    import comfy_progress as cp                            # noqa: E402
    import ming_graph as mg                                # noqa: E402
    return cc, cp, mg


def listed(cc, base, class_type, key):
    """ComfyUI's dropdown for one loader input ([] when it does not say)"""
    try:
        return cc.combo_values(base, class_type, key) or []
    except Exception:                                      # noqa: BLE001
        return []


def comfy(p, job, work):
    cc, cp, mg = _comfy_mods()
    cfg = job.get("config") or {}
    base = cc.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        cc.preflight(base)
    except cc.ComfyError as e:
        fail(f"{e} - 🧩 Ming runs in ComfyUI: start it (or pick ☁ OpenRouter in the dialog)")
    gen, split = bool(p.get("generate")), bool(p.get("split"))
    need = (["design"] if gen else []) + (["layer"] if split else [])
    want = list(mg.REQUIRED) + (list(mg.REQUIRED_LAYERS) if split else [])
    miss = cc.missing_classes(base, {str(i): {"class_type": c, "inputs": {}} for i, c in enumerate(want)})
    if miss:
        fail("this ComfyUI does not have " + ", ".join(miss) + " - " + mg.UPDATE + ".")
    pk = mg.pick(listed(cc, base, "UNETLoader", "unet_name"), listed(cc, base, "CLIPLoader", "clip_name"),
                 listed(cc, base, "VAELoader", "vae_name"), need, p.get("precision") or "int8")
    if pk.get("error"):
        fail(pk["error"])
    for n in pk.get("notes") or []:
        say(f"[ming] {n}")
    seed = int(p.get("seed", 42) or 0)
    total, step = len(need), 0
    flat, layers = None, []

    def render(graph, tag, name):
        (work / f"{name}_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
        for nid, key, _old, new in cc.canonicalise_combos(base, graph):
            say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
        try:
            cc.clear_before_gen(base, cfg, say, graph)
            _pid, outputs = cp.run(cc, base, graph, say, tag)
        except cc.ComfyError as e:
            fail(f"Ming-Image ({tag}) stopped in ComfyUI: {e}")
        items = cc.output_images(outputs)
        if not items:
            fail(f"ComfyUI finished {tag} but saved no picture")
        files = []
        for i, it in enumerate(items):
            f = work / f"{name}_{i:02d}.png"
            cc.download(base, it, f)
            if not f.is_file() or f.stat().st_size == 0:
                fail(f"downloaded an empty picture for {it.get('filename')}")
            files.append(f)
        return files

    if gen:
        step += 1
        say(f"[worker] step {step}/{total} - the design ({'Ming-Image 0.2 Design' if '0.2' in pk['design'] else 'Ming-Image 0.1 Design'})")
        say(f"[ming] model {pk['design']} · text encoder {pk['design_te']} · VAE {pk['vae']}")
        try:
            g, notes = mg.build_design({"model": pk["design"], "te": pk["design_te"], "vae": pk["vae"], "prompt": p.get("t2i_prompt") or "",
                                        "width": p.get("width"), "height": p.get("height"), "seed": seed, "steps": p.get("steps"),
                                        "prefix": "bitgen_ming/" + slug(p.get("name"), 30) + "_design"})
        except ValueError as e:
            fail(str(e))
        for n in notes:
            say(f"[ming] {n}")
        flat = render(g, "the design", "design")[0]
    if split:
        step += 1
        rows = p.get("rows") or []
        src_img = flat or Path(str(p.get("input") or ""))
        if not src_img.is_file():
            fail("the picture to split is gone")
        say(f"[worker] step {step}/{total} - the layers (Ming-Image 0.1 Design-Layer)")
        say(f"[ming] model {pk['layer']} · text encoder {pk['layer_te']} · VAE {pk['vae']}")
        try:
            up = cc.upload_image(base, str(src_img))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the picture to ComfyUI: {e}")
        lw, lh = layer_size(src_img, p.get("layer_res") or 1024, *((int(p.get("width") or 0), int(p.get("height") or 0)) if flat else
                                                                   (int(p.get("input_w") or 0), int(p.get("input_h") or 0))))
        try:
            g, notes = mg.build_layers({"model": pk["layer"], "te": pk["layer_te"], "vae": pk["vae"], "prompt": p.get("layer_plan") or "",
                                        "image": up, "layers": len(rows), "width": lw, "height": lh, "seed": seed,
                                        "steps": p.get("steps"), "cfg": p.get("layer_cfg"),
                                        "prefix": "bitgen_ming/" + slug(p.get("name"), 30) + "_layers"})
        except ValueError as e:
            fail(str(e))
        for n in notes:
            say(f"[ming] {n}")
        got = render(g, "the layers", "layer")
        layers = mg.layer_items(got, len(rows))
        say(f"[ming] {len(got)} pictures back - the composite first, then the layers front first")
    return flat, layers


def layer_size(img, res, w=0, h=0):
    """the split's size: the picture's shape (w x h from the job - lib/mingAddon.js - else its PNG header) at about res x res
    pixels, 16-px steps (no Pillow: the app's Python does not have it)"""
    if not (w and h):
        try:
            head = Path(img).read_bytes()[:32]
            if head[:8] == b"\x89PNG\r\n\x1a\n":
                w, h = int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
        except OSError:
            pass
    w, h = (w, h) if w and h else (1024, 1024)
    r = max(0.25, min(4.0, float(w) / float(h)))
    L = 512 if int(res or 1024) == 512 else 1024
    return max(256, int(round(L * r ** 0.5 / 16.0)) * 16), max(256, int(round(L / r ** 0.5 / 16.0)) * 16)


# ---------------------------------------------------------------- on OpenRouter
def openrouter(p, job, work):
    sys.path.insert(0, str(HERE))
    import api_worker as A                                 # its HTTP helpers (urllib; the same headers OpenRouter pictures use)
    api = ((job.get("config") or {}).get("apis") or {}).get("__openrouter") or {}
    if not api.get("key"):
        fail("☁ OpenRouter needs your API key - 🖥 GPU ▸ Remote generation ▸ OpenRouter")
    base = A.base_of("openrouter", "https://openrouter.ai/api/v1", api)
    hd = {"Authorization": "Bearer " + api["key"], "HTTP-Referer": "https://tigerart.com.au", "X-OpenRouter-Title": "bitGen Studio"}
    m = p.get("ming") or {}

    def post(body):
        try:
            st, j, _ = A.http("POST", base + "/images", hd, body, timeout=900)
        except A.ApiError as e:
            fail(str(e))
        return st, j

    def images(j):
        out = []
        for d in (j.get("data") or []) if isinstance(j, dict) else []:
            if d.get("b64_json"):
                out.append(base64.b64decode(d["b64_json"]))
        cost = ((j or {}).get("usage") or {}).get("cost") if isinstance(j, dict) else None
        if cost is not None:
            say(f"[api] OpenRouter: about ${cost} for this")
        return out

    flat, layers = None, []
    total = int(bool(p.get("generate"))) + int(bool(p.get("split")))
    step = 0
    if p.get("generate"):
        step += 1
        say(f"[ming] the design on OpenRouter: step {step}/{total}")
        got, models = None, list(m.get("gen") or [])
        for i, model in enumerate(models):
            st, j = post({"model": model, "prompt": p.get("t2i_prompt") or "", "n": 1, "output_format": "png", "size": f"{p['width']}x{p['height']}"})
            if st in (400, 404) and i < len(models) - 1 and re.search(r"model|not (a )?valid|not found|no endpoints|unknown", json.dumps(j)[:400], re.I):
                say(f"[ming] OpenRouter has no {model} - {models[i + 1]} in its place")
                continue
            if st >= 400:
                fail(A.why("OpenRouter", st, j))
            pics = images(j)
            if not pics:
                fail("OpenRouter answered without a picture")
            say(f"[ming] the design by {model}")
            got = pics[0]
            break
        if got is None:
            fail("OpenRouter has none of " + ", ".join(models))
        flat = work / "design.png"
        flat.write_bytes(got)
    if p.get("split"):
        step += 1
        say(f"[ming] the layers on OpenRouter: step {step}/{total}")
        src_img = flat or Path(str(p.get("input") or ""))
        if not src_img.is_file():
            fail("the picture to split is gone")
        st, j = post({"model": m.get("layer"), "prompt": p.get("layer_plan") or "", "n": 1, "output_format": "png",
                      "input_references": [{"type": "image_url", "image_url": {"url": A.data_url(src_img)}}]})
        if st >= 400:
            fail(A.why("OpenRouter", st, j))
        pics = images(j)
        want = len(p.get("rows") or [])
        if len(pics) == want + 1:
            pics = pics[1:]                                # the composite first, as the model gives it
        if not pics:
            fail("OpenRouter answered without layers")
        for i, b in enumerate(pics):
            f = work / f"layer_{i + 1:02d}.png"
            f.write_bytes(b)
            layers.append(f)
    return flat, layers


def main():
    if len(sys.argv) != 2:
        fail("usage: ming_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    p = job["params"]
    if p.get("mode") != "ming":
        fail(f"ming_worker.py only runs mode=ming (got {p.get('mode')!r})")
    out_dir = Path(job["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd() / "ming"
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    rows = p.get("rows") or []
    say(f"[worker] ming_worker.py engine={p.get('engine')} design={bool(p.get('generate'))} layers={len(rows) if p.get('split') else 0}")
    flat, layers = openrouter(p, job, work) if p.get("engine") == "openrouter" else comfy(p, job, work)
    stem = slug(p.get("name") or "design", 40)
    outs = []
    if flat is not None:
        n = free_name(out_dir, f"{stem}_ming", ".png")
        shutil.copyfile(flat, out_dir / n)
        outs.append(n)
        say(f"[worker] the design -> {n}")
    if layers:
        names = name_layers(layers, rows, out_dir, stem)
        outs += names
        say(f"[worker] {len(names)} layers{count_note(len(names), len(rows))}: " + ", ".join(names))
    if not outs:
        fail("nothing was made")
    say("@@OUTS " + json.dumps(outs))
    say("@@OUT " + outs[-1])
    say("[worker] ming complete")


if __name__ == "__main__":
    main()
