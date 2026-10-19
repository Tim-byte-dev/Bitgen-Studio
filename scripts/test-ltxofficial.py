#!/usr/bin/env python3
"""bitGen Studio — 2.401.5: LTX 2.5 on Comfy-Org's own templates.
Tim (verbatim): "maybe try to find another ltx workflow" - after "ResizeImageMaskNode.execute() missing 1 required
positional argument: 'resize_type'".
  1. the converter against a REAL ComfyUI's answers (scripts/fixtures/ltx25_object_info.json, taken from ComfyUI master
     2026-10-09 - and the three converted templates were accepted by that server's own /prompt validation):
     every template converts with no unknown class, ResizeImageMaskNode carries resize_type + its option's inputs,
     TextGenerateLTX2Prompt / CreateVideo values in their right places (a template saved before a widget was added),
     every node passes the stub's copy of ComfyUI's checks;
  2. ltx_graph.official_finish: a .gguf on UnetLoaderGGUF, LoRAs chained behind the transformer, the negative;
  3. ltx_worker LIVE on the stub (real schemas + validation) with the LTX 2.5 files in its models: t2v / i2v / flf run
     on the templates, the take written; the job's prompt / size / seconds / fps / seed / pictures in the queued graph;
  4. LIVE with NO LTX 2.5 files: said in words, the canvas runs the job (it rendered).
Run from repo root: python3 scripts/test-ltxofficial.py"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import ltx_graph as LG  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f"\n      {str(extra)[:1500]}"))
    if not cond:
        FAILED.append(name)


T = Path(tempfile.mkdtemp(prefix="ltxo4015_"))
FILES = {"diffusion_models": "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
         "vae": ["ltx-2.5-video-vae-bf16.safetensors", "ltx-2.5-audio-vae-bf16.safetensors"],
         "text_encoders": "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors",
         "latent_upscale_models": "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"}
LISTS = {"unet": [FILES["diffusion_models"]], "gguf": [], "vae": FILES["vae"], "clip": [FILES["text_encoders"]],
         "upscale": [FILES["latent_upscale_models"]]}
REAL = json.loads((ROOT / "scripts" / "fixtures" / "ltx25_object_info.json").read_text(encoding="utf-8"))
sys.argv = [sys.argv[0], "0", str(T / "stubval")]          # the stub module reads its argv at import
import importlib.util  # noqa: E402
src = (ROOT / "scripts" / "stub-comfy.py").read_text(encoding="utf-8").rsplit("ThreadingHTTPServer((", 1)[0]
STUB = {"__file__": str(ROOT / "scripts" / "stub-comfy.py"), "__name__": "stubval"}
exec(compile(src, "stub-comfy.py", "exec"), STUB)          # noqa: S102 - our own stub, for its validator


def node(*a):
    return subprocess.run(["node", str(ROOT / "scripts" / "ltx_convert.js")] + [str(x) for x in a],
                          capture_output=True, text=True, timeout=60)


# 1 the converter against the real answers
info = T / "oi.json"
info.write_text(json.dumps(REAL))
for mode, f in (("t2v", "ltx25_official_t2v.json"), ("i2v", "ltx25_official_i2v.json"), ("flf", "ltx25_official_flf2v.json")):
    o = T / f"o_{mode}.json"
    o.write_text(json.dumps({"mode": mode, "prompt": "a red fox walks through snow", "seconds": 3, "width": 650, "height": 380,
                             "seed": 7, "fps": 25, "images": ["a.png", "b.png"], "prefix": "bitgen_ltx", "lists": LISTS}))
    r = node("oconvert", ROOT / "comfy_workflows" / f, o, info, T / f"api_{mode}.json")
    d = json.loads((T / f"api_{mode}.json").read_text()) if r.returncode == 0 else {}
    g = d.get("graph") or {}
    by = lambda c: [v for v in g.values() if v["class_type"] == c]       # noqa: E731
    errs = {}
    for k, v in g.items():
        if v["class_type"] == "LoadImage":
            continue                                                      # (the fixture's input list is not ours)
        e = STUB["ltx25_validate"](v)
        if e:
            errs[k] = (v["class_type"], [x["details"] for x in e])
    rs = by("ResizeImageMaskNode")
    tg = by("TextGenerateLTX2Prompt")
    cv = by("CreateVideo")
    prims = [v["inputs"].get("value") for v in g.values() if v["class_type"].startswith("Primitive") and not isinstance(v["inputs"].get("value"), list)]
    check(f"{mode}: converted against a real ComfyUI's answers, every node passes ComfyUI's checks "
          "(required present, dynamic combo options, combo lists, INT)",
          r.returncode == 0 and g and not d.get("unknown") and not errs, (r.stderr[-400:], d.get("unknown"), errs))
    check(f"{mode}: the job's values in (by each input's label - the names differ per template): prompt (none of the template's sample text), the enhancer off, 3 s, 640x384 (multiples of 32), 25 fps, seed 7, the models; "
          "SaveVideo prefix; notes say the template",
          "a red fox walks through snow" in prims and 3 in prims and 640 in prims and 384 in prims and 25 in prims
          and any(v["inputs"].get("noise_seed") == 7 for v in by("RandomNoise"))
          and all(v["inputs"].get("filename_prefix") == "bitgen_ltx" for v in by("SaveVideo"))
          and any(v["inputs"].get("unet_name") == FILES["diffusion_models"] for v in by("UNETLoader"))
          and any("Comfy-Org's LTX 2.5" in n for n in d.get("notes") or [])
          and not any(isinstance(x, str) and ("Arctic hunter" in x or "machinery" in x) for x in prims)
          and all(v["inputs"].get("value") is False for v in by("PrimitiveBoolean")),
          (sorted(map(str, prims)), d.get("notes")))
    if mode != "t2v":
        imgs = [v["inputs"].get("image") for v in by("LoadImage")]
        check(f"{mode}: the picture(s) on the LoadImage(s)" + (" - first and last" if mode == "flf" else ""),
              sorted(imgs) == (["a.png", "b.png"] if mode == "flf" else ["a.png"]), imgs)
    if rs:
        check(f"{mode}: ResizeImageMaskNode sends resize_type + its chosen option's own inputs (Tim's TypeError)",
              all("resize_type" in v["inputs"] and any(k.startswith("resize_type.") for k in v["inputs"]) for v in rs),
              [v["inputs"] for v in rs])
    check(f"{mode}: TextGenerateLTX2Prompt max_length 600 / sampling_mode 'on' + its options; CreateVideo bit_depth 8 "
          "(the template predates 'mtp' / 'color_space' - values stay in their places, the new ones get their defaults "
          "as ComfyUI's frontend sends them: mtp auto, color_space sRGB)",
          all(v["inputs"].get("max_length") == 600 and v["inputs"].get("sampling_mode") == "on"
              and "sampling_mode.temperature" in v["inputs"] and v["inputs"].get("mtp") == "auto" for v in tg)
          and all(v["inputs"].get("bit_depth") == 8 and v["inputs"].get("color_space") == "sRGB" for v in cv) and tg and cv,
          ([v["inputs"] for v in tg], [v["inputs"] for v in cv]))
(T / "o_none.json").write_text(json.dumps({"mode": "i2v", "images": ["a.png"], "lists": {}}))
r = node("oclasses", ROOT / "comfy_workflows" / "ltx25_official_i2v.json", T / "o_none.json")
check("no LTX 2.5 model in ComfyUI: refused in words (which file, which folder)",
      r.returncode == 2 and "no LTX 2.5 model in ComfyUI" in r.stderr and "models/diffusion_models" in r.stderr, r.stderr)
(T / "o_gguf.json").write_text(json.dumps({"mode": "t2v", "lists": dict(LISTS, unet=[], gguf=["LTX-2.5-Distilled-Q4_K_M.gguf"]),
                                           "style": {"model": "LTX-2.5-Distilled-Q4_K_M.gguf"}}))
r = node("oclasses", ROOT / "comfy_workflows" / "ltx25_official_t2v.json", T / "o_gguf.json")
d = json.loads(r.stdout or "{}")
check("Tim's GGUF (LTX-2.5-Distilled-Q4_K_M.gguf, the style's model) is picked and flagged for the GGUF loader",
      (d.get("models") or {}).get("gguf") is True and d["models"]["unet"] == "LTX-2.5-Distilled-Q4_K_M.gguf"
      and "UnetLoaderGGUF" not in d.get("classes", []), d)

# 2 official_finish
g0 = json.loads((T / "api_i2v.json").read_text())["graph"]
g, notes = LG.official_finish(g0, {"models": {"unet": "LTX-2.5-Distilled-Q4_K_M.gguf", "gguf": True},
                                   "style_loras": [{"path": "ltx-2-19b-ic-lora-detailer.safetensors", "weight": 0.3},
                                                   {"path": "cam/dolly-in.safetensors", "weight": 1}],
                                   "negative": "blurry, warped"})
gg = [k for k, v in g.items() if v["class_type"] == "UnetLoaderGGUF"]
lo = [k for k, v in g.items() if v["class_type"] == "LoraLoaderModelOnly"]
users = [v for v in g.values() if v["class_type"] not in ("LoraLoaderModelOnly",)
         and any(isinstance(x, list) and x and str(x[0]) in gg + lo for x in v["inputs"].values())]
check("official_finish: the .gguf on UnetLoaderGGUF, two LoRAs chained behind it, every model user on the last LoRA, "
      "the negative replaced",
      len(gg) == 1 and g[gg[0]]["inputs"] == {"unet_name": "LTX-2.5-Distilled-Q4_K_M.gguf"} and len(lo) == 2
      and g[lo[0]]["inputs"]["model"] == [gg[0], 0] and g[lo[1]]["inputs"]["model"] == [lo[0], 0]
      and users and all(any(x == [lo[1], 0] for x in v["inputs"].values()) for v in users)
      and any(v["class_type"] == "CLIPTextEncode" and v["inputs"].get("text") == "blurry, warped" for v in g.values())
      and not any(v["class_type"] == "UNETLoader" for v in g.values()), notes)


# 2b which jobs go to the templates
sys.path.insert(0, str(ROOT))
import ltx_worker as LWK  # noqa: E402
wf = ROOT / "comfy_workflows" / "LTX25_All_In_One.json"
pick = lambda lm, **p: LWK.official_template({"app_dir": str(ROOT)}, p, wf, lm, p.pop("_rp", None))  # noqa: E731
check("the templates take t2v / i2v / flf; the canvas keeps lipsync / a2v / v2v / fmlf, Ripple, the camera's raw guide, "
      "an asked-for transition LoRA, and ltx_engine 'canvas'",
      pick("t2v").name == "ltx25_official_t2v.json" and pick("i2v").name == "ltx25_official_i2v.json"
      and pick("flf").name == "ltx25_official_flf2v.json"
      and all(pick(m) is None for m in ("lipsync", "a2v", "v2v", "fmlf", "fl_lipsync"))
      and pick("i2v", _rp={"frames": 9}) is None and pick("i2v", raw_guide=True) is None
      and pick("flf", transition=True) is None and pick("flf", transition=False) is not None
      and pick("t2v", ltx_engine="canvas") is None)
LJS = (ROOT / "lib" / "ltx.js").read_text(encoding="utf-8") + (ROOT / "routes" / "ltx.js").read_text(encoding="utf-8")
check("the route passes ltx_engine=canvas through to the job", 'ltx_engine: x.engine === "canvas"' in LJS and 'engine: b.ltx_engine === "canvas"' in LJS)

# 3 / 4 LIVE
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def start_stub(models):
    port = free_port()
    p = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                         env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return p, f"http://127.0.0.1:{port}"


pic = T / "face.png"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x192:duration=1", "-frames:v", "1", str(pic)])
pic2 = T / "face2.png"
shutil.copy(pic, pic2)


def run_job(base, lmode, images, name):
    jd = T / name
    jd.mkdir()
    job = {"params": {"mode": "ltx", "ltx_mode": lmode, "prompt": "a red fox walks through snow", "seconds": 2, "fps": 24,
                      "width": 650, "height": 380, "seed": 11, "images": [str(x) for x in images],
                      "workflow": str(ROOT / "comfy_workflows" / "LTX25_All_In_One.json"),
                      "video_style": {"name": "LTX 2.5", "loras": [{"path": "ltx-2-19b-ic-lora-detailer.safetensors", "weight": 0.3}]}},
           "config": {"engine": {"backend": "comfy", "comfy": {"url": base}}}, "output_dir": str(jd / "out"),
           "app_dir": str(ROOT), "node_exe": shutil.which("node")}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "ltx_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=240)
    q = json.loads((jd / "ltx_queued.json").read_text()) if (jd / "ltx_queued.json").is_file() else {}
    return r, q


M = T / "models"
for sub, nm in FILES.items():
    (M / sub).mkdir(parents=True, exist_ok=True)
    for x in (nm if isinstance(nm, list) else [nm]):
        (M / sub / x).write_bytes(b"x")
(M / "loras").mkdir()
(M / "loras" / "ltx-2-19b-ic-lora-detailer.safetensors").write_bytes(b"x")
stub, base = start_stub(M)
try:
    for lmode, imgs in (("t2v", []), ("i2v", [pic]), ("flf", [pic, pic2])):
        r, q = run_job(base, lmode, imgs, f"live_{lmode}")
        out = r.stdout
        cls = {v.get("class_type") for v in q.values()}
        li = sorted(v["inputs"].get("image") for v in q.values() if v.get("class_type") == "LoadImage")
        check(f"LIVE {lmode}: ltx_worker ran Comfy-Org's template (not the canvas), the stub's real checks passed, "
              "the take written",
              r.returncode == 0 and "on Comfy-Org's own template ltx25_official_" in out and "@@OUT " in out
              and "converted LTX25_All_In_One" not in out and "SaveVideo" in cls and "VHS_VideoCombine" not in cls,
              out[-2500:])
        check(f"LIVE {lmode}: queued with the prompt, 640x384, 2 s at 24 fps, seed 11, the style's LoRA behind the "
              "transformer" + (", the uploaded picture(s)" if imgs else ""),
              any(v["inputs"].get("value") == "a red fox walks through snow" for v in q.values())
              and any(v["inputs"].get("value") == 640 for v in q.values()) and any(v["inputs"].get("noise_seed") == 11 for v in q.values())
              and any(v.get("class_type") == "LoraLoaderModelOnly" and v["inputs"].get("lora_name") == "ltx-2-19b-ic-lora-detailer.safetensors"
                      for v in q.values())
              and len(li) == len(imgs) and all(x and x.endswith(".png") for x in li)
              and "[worker] style LoRA ltx-2-19b-ic-lora-detailer.safetensors @ 0.3" in out, (li, out[-1500:]))
finally:
    stub.kill()
    stub.wait()

# 4 no LTX 2.5 files -> the canvas
stub, base = start_stub(T / "empty_models")
try:
    r, q = run_job(base, "i2v", [pic], "live_canvas")
    out = r.stdout
    check("LIVE no LTX 2.5 files in ComfyUI: said in words, then the canvas runs the job (and it rendered)",
          "no LTX 2.5 model in ComfyUI" in out and "the LTX canvas runs it" in out
          and "converted LTX25_All_In_One.json (i2v)" in out and r.returncode == 0 and "@@OUT " in out, out[-2500:])
finally:
    stub.kill()
    stub.wait()
shutil.rmtree(T, ignore_errors=True)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
