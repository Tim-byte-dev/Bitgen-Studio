#!/usr/bin/env python3
"""bitGen Studio — 🧩 MING LAYERED DESIGN worker (3.9.0): mode "ming" (lib/mingAddon.js, lib/mingLayers.js).
Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with add
layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
generate separate layers"

Two steps, each optional:
  1 the design    Ming-Image-0.2-Design from the layer list's JSON prompt (params.t2i_prompt) -> one flat picture
  2 the layers    Ming-Image-0.1-Design-Layer splits the flat picture (or params.input - a picture to split) by the plan
                  (params.layer_plan) -> N transparent PNGs, layer 1 the front-most
engine "local":      the add-on's Python runs Ming-Image's own infer.py (cwd = its folder), offline, the language model spread
                     over every NVIDIA card (--device-map balanced --num-gpus N; params.gpus 1 = the first card only)
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
import subprocess
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


# ---------------------------------------------------------------- on this computer
def gpu_count(py):
    try:
        r = subprocess.run([str(py), "-c", "import torch; print('NGPU', torch.cuda.device_count())"], capture_output=True, text=True, timeout=300)
        m = re.search(r"NGPU (\d+)", r.stdout or "")
        return int(m.group(1)) if m else 0
    except Exception:                                      # noqa: BLE001
        return 0


def run_infer(py, src, args, tag):
    cmd = [str(py), str(src / "infer.py")] + [str(a) for a in args]
    env = dict(os.environ, PYTHONUTF8="1", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", PYTHONPATH=str(src))
    say("> " + " ".join(cmd))
    pr = subprocess.Popen(cmd, cwd=str(src), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", env=env)
    tail, oom = [], False
    for line in pr.stdout:
        line = line.rstrip()
        if not line:
            continue
        say("[ming] " + line)
        if re.search(r"out of memory|OutOfMemoryError|CUDA error", line, re.I):
            oom = True
        if "Error" in line or "ERROR" in line:
            tail = (tail + [line])[-3:]
    code = pr.wait()
    if code != 0:
        hint = (" - the cards ran out of memory: inclusionAI validated one 80 GB card; try ☁ OpenRouter in the dialog, a smaller size, "
                "or both cards (GPUs: all)") if oom else ""
        fail(f"Ming-Image ({tag}) stopped: " + (" | ".join(tail) or f"exit {code}") + hint)


def local(p, work):
    m = p.get("ming") or {}
    py, src = Path(str(m.get("python") or "")), Path(str(m.get("src") or ""))
    if not py.is_file() or not (src / "infer.py").is_file():
        fail("🧩 Ming-Image is not installed - Settings ▸ Add-ons ▸ 🧩 Ming layered design (or ☁ OpenRouter in the dialog)")
    n = 1 if p.get("gpus") == 1 else max(1, gpu_count(py))
    say(f"[ming] {n} NVIDIA card(s) for the language model" + (" (spread over them)" if n > 1 else ""))
    common = ["--local-files-only", "--attn-implementation", "eager", "--seed", p.get("seed", 42), "--device-map", "balanced", "--num-gpus", n]
    if p.get("steps"):
        common += ["--steps", p["steps"]]
    flat, layers = None, []
    total = int(bool(p.get("generate"))) + int(bool(p.get("split")))
    step = 0
    if p.get("generate"):
        step += 1
        say(f"[ming] the design: step {step}/{total}")
        pf = work / "prompt.json"
        pf.write_text(p.get("t2i_prompt") or "", encoding="utf-8")
        od = work / "gen"
        run_infer(py, src, ["--model", m.get("gen"), "--task", "text-to-image", "--prompt", pf, "--width", p["width"], "--height", p["height"], "--output-dir", od] + common, "the design")
        outs = sorted(od.glob("image_*.png"))
        if not outs:
            fail("Ming-Image made no picture")
        flat = outs[0]
    if p.get("split"):
        step += 1
        say(f"[ming] the layers: step {step}/{total}")
        src_img = flat or Path(str(p.get("input") or ""))
        if not src_img.is_file():
            fail("the picture to split is gone")
        lf = work / "plan.txt"
        lf.write_text(p.get("layer_plan") or "", encoding="utf-8")
        od = work / "layers"
        run_infer(py, src, ["--model", m.get("layer"), "--task", "layer-decompose", "--input-image", src_img, "--prompt", lf, "--resolution", p.get("layer_res", 1024), "--output-dir", od] + common, "the layers")
        layers = sorted(od.glob("layer_*.png"))
        if not layers:
            fail("Ming-Image made no layers")
    return flat, layers


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
    flat, layers = openrouter(p, job, work) if p.get("engine") == "openrouter" else local(p, work)
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
