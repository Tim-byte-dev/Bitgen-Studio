#!/usr/bin/env python3
"""bitGen Studio — 2.402.0: LTX 2.3 + fal's 3DREAL (render -> real) + the Blender scene send.
Tim (verbatim): "https://huggingface.co/fal/LTX-2.3-3DREAL-LoRA, can we use this lora and our blender bridge to layout a
3d scene in blender and render it in bitgen using ltx2.3 - please add a style for ltx2.3".
  1. Comfy-Org's four LTX 2.3 templates converted against a REAL ComfyUI's answers (scripts/fixtures; the same graphs
     were accepted by that server's /prompt): every node passes the stub's copy of ComfyUI's checks; the job's values
     by label; 3DREAL: the trigger first, the render -> GetVideoComponents -> the IC guide (no depth pass), fal's
     LoRA + strength, the first-frame conditioning bypassed without a picture / on with one;
  2. the model picking: dev + distilled LoRA for text / image, the distilled checkpoint alone runs everything (its
     LoRA left out), a missing distilled LoRA / 3DREAL file refused in words, the Gemma LoRA dropped from the graph;
  3. lib/ltx: the LTX 2.3 style's modes (Auto: a video = 3DREAL), canvas-only modes refused, 3DREAL needs the render;
     lib/blenderScene: a render saved by its container (junk refused), queued as LTX 2.3 3DREAL;
  4. LIVE ltx_worker on the stub (real schemas + checks): t2v, flf, 3DREAL (the render's first frame extracted, the
     take written), lipsync on LTX 2.3 refused in words.
Run from repo root: python3 scripts/test-ltx23.py"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import ltx_graph as LG  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f"\n      {str(extra)[:1500]}"))
    if not cond:
        FAILED.append(name)


T = Path(tempfile.mkdtemp(prefix="ltx23_4020_"))
DEV, DIST = "ltx-2.3-22b-dev-fp8.safetensors", "ltx-2.3-22b-distilled-fp8.safetensors"
DLORA = "ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors"
TE, UP = "gemma_3_12B_it_fp4_mixed.safetensors", "ltx-2.3-spatial-upscaler-x2-1.1.safetensors"
M = T / "models"
for sub, names in (("checkpoints", [DEV, DIST]), ("text_encoders", [TE]), ("loras", [DLORA, "3DREAL-strong-v2.safetensors", "3DREAL-light.safetensors"]),
                   ("latent_upscale_models", [UP])):
    (M / sub).mkdir(parents=True, exist_ok=True)
    for n in names:
        (M / sub / n).write_bytes(b"x")
os.environ["STUB_MODELS_ROOT"] = str(M)                   # the stub's folder scans (its validator reads them)
REAL = json.loads((ROOT / "scripts" / "fixtures" / "ltx25_object_info.json").read_text(encoding="utf-8"))
sys.argv = [sys.argv[0], "0", str(T / "stubval")]
src = (ROOT / "scripts" / "stub-comfy.py").read_text(encoding="utf-8").rsplit("ThreadingHTTPServer((", 1)[0]
STUB = {"__file__": str(ROOT / "scripts" / "stub-comfy.py"), "__name__": "stubval"}
exec(compile(src, "stub-comfy.py", "exec"), STUB)          # noqa: S102 - our own stub, for its validator
LISTS = {"ckpt": [DEV, DIST], "te": [TE], "loras": [DLORA, "3DREAL-strong-v2.safetensors", "3DREAL-light.safetensors"],
         "upscale": [UP]}


def node(*a):
    return subprocess.run(["node", str(ROOT / "scripts" / "ltx_convert.js")] + [str(x) for x in a],
                          capture_output=True, text=True, timeout=60)


info = T / "oi.json"
info.write_text(json.dumps(REAL))
G = {}
for mode, f in (("t2v", "t2v"), ("i2v", "i2v"), ("flf", "flf2v"), ("3dreal", "ic_lora")):
    o = T / f"o_{mode}.json"
    o.write_text(json.dumps({"family": "ltx23", "mode": mode, "prompt": "a red car on a mountain road", "seconds": 3,
                             "width": 650, "height": 380, "seed": 7, "fps": 24, "images": ["a.png", "b.png"],
                             "video": "scene.mp4", "video_start": 0.5, "prefix": "bitgen_ltx", "lists": LISTS,
                             "ic_strength": 0.8}))
    r = node("oconvert", ROOT / "comfy_workflows" / f"ltx23_official_{f}.json", o, info, T / f"api_{mode}.json")
    d = json.loads((T / f"api_{mode}.json").read_text()) if r.returncode == 0 else {}
    g0 = d.get("graph") or {}
    g, fin = LG.official_finish(g0, {"models": d.get("models") or {}, "style_loras": [], "negative": "cartoon"}) if g0 else ({}, [])
    G[mode] = (g, d)
    by = lambda c, g=g: [v for v in g.values() if v["class_type"] == c]       # noqa: E731
    errs = {k: (v["class_type"], [x["details"] for x in STUB["ltx25_validate"](v)]) for k, v in g.items()
            if v["class_type"] not in ("LoadImage",) and STUB["ltx25_validate"](v)}
    prims = [x for v in g.values() for x in (v.get("inputs") or {}).values() if not isinstance(x, (list, dict))]
    ck = [v["inputs"].get("ckpt_name") for v in by("CheckpointLoaderSimple")]
    check(f"{mode}: Comfy-Org's LTX 2.3 template converted against a real ComfyUI's answers, every node passes "
          "ComfyUI's checks, no unknown class",
          r.returncode == 0 and g and not d.get("unknown") and not errs, (r.stderr[-400:], d.get("unknown"), errs))
    check(f"{mode}: the job's values by label - 640x384, 24 fps, seed 7, the checkpoint "
          f"({'dev' if mode in ('t2v', 'i2v') else 'distilled'}), Gemma 3, SaveVideo prefix; the Gemma LoRA "
          "(not in loras) taken out of the graph",
          640 in prims and 384 in prims and 24 in prims
          and any(v["inputs"].get("noise_seed") == 7 or v["inputs"].get("seed") == 7 for v in g.values())
          and ck and all(c == (DEV if mode in ("t2v", "i2v") else DIST) for c in ck)
          and all(v["inputs"].get("text_encoder") == TE for v in by("LTXAVTextEncoderLoader"))
          and all(v["inputs"].get("filename_prefix") == "bitgen_ltx" for v in by("SaveVideo"))
          and not any(v["inputs"].get("lora_name") == LG.DROP for v in g.values()) and not by("LoraLoader")
          and any(isinstance(x, str) and "a red car" in x for x in prims),
          (sorted(map(str, prims))[:40], ck, d.get("notes"), fin))
    if mode in ("t2v", "i2v"):
        check(f"{mode}: dev checkpoint + the distilled LoRA + the 2.3 x2 upscaler",
              any(v["inputs"].get("lora_name") == DLORA for v in by("LoraLoaderModelOnly"))
              and any(v["inputs"].get("model_name") == UP for v in by("LatentUpscaleModelLoader")))

g, d = G["3dreal"]
by = lambda c: [v for v in g.values() if v["class_type"] == c]       # noqa: E731
gv = [k for k, v in g.items() if v["class_type"] == "GetVideoComponents"]
guide = by("LTXVAddGuide")
ic = [v for v in by("LoraLoaderModelOnly") if "3DREAL" in str(v["inputs"].get("lora_name"))]
prims = [x for v in g.values() for x in (v.get("inputs") or {}).values() if not isinstance(x, (list, dict))]
check("3DREAL: the render on LoadVideo, Video Slice from 0.5 s for 3 s -> GetVideoComponents -> the IC guide "
      "(LTXVAddGuide image) - the MoGe depth branch is gone",
      any(v["inputs"].get("file") == "scene.mp4" for v in by("LoadVideo"))
      and any(v["inputs"].get("start_time") == 0.5 and v["inputs"].get("duration") == 3 for v in by("Video Slice"))
      and gv and guide and all(v["inputs"].get("image") == [gv[0], 0] for v in guide)
      and not any(v["class_type"].startswith("MoGe") or v["class_type"] == "LoadMoGeModel" for v in g.values()),
      {k: v for k, v in g.items() if v["class_type"] in ("LoadVideo", "Video Slice", "LTXVAddGuide", "GetVideoComponents")})
check("3DREAL: fal's LoRA (3DREAL-strong-v2, the newest listed) @ 0.8 feeds GetICLoRAParameters; the prompt starts "
      "with the trigger '3DREAL. Make it photorealistic.'; no picture -> the first-frame conditioning bypassed",
      ic and ic[0]["inputs"].get("lora_name") == "3DREAL-strong-v2.safetensors" and ic[0]["inputs"].get("strength_model") == 0.8
      and by("GetICLoRAParameters")
      and any(isinstance(x, str) and x.startswith("3DREAL. Make it photorealistic. a red car") for x in prims)
      and all(v["inputs"].get("bypass") is True for v in by("LTXVImgToVideoInplace")),
      (ic, prims, by("LTXVImgToVideoInplace")))
(T / "o_3d_real.json").write_text(json.dumps({**json.loads((T / "o_3dreal.json").read_text()), "first_real": True,
                                              "ic_lora": "3DREAL-light.safetensors", "prompt": "3dreal. a street"}))
r = node("oconvert", ROOT / "comfy_workflows" / "ltx23_official_ic_lora.json", T / "o_3d_real.json", info, T / "api_3d_real.json")
g2 = json.loads((T / "api_3d_real.json").read_text())["graph"] if r.returncode == 0 else {}
check("3DREAL with a real first picture: the conditioning on; the asked variant (light); a typed trigger kept once",
      any(v["class_type"] == "LTXVImgToVideoInplace" and v["inputs"].get("bypass") is False for v in g2.values())
      and any(v["class_type"] == "LoraLoaderModelOnly" and v["inputs"].get("lora_name") == "3DREAL-light.safetensors" for v in g2.values())
      and any(x == "3DREAL. a street" for v in g2.values() for x in (v.get("inputs") or {}).values()),
      r.stderr[-300:])


# 2 model picking (pure)
def pick(lists, mode, want=None, style=None):
    r = subprocess.run(["node", "-e", "const L=require(process.argv[1]); process.stdout.write(JSON.stringify(L.pickModels23("
                        "JSON.parse(process.argv[2]), JSON.parse(process.argv[3]), process.argv[4], JSON.parse(process.argv[5]))))",
                        str(ROOT / "lib" / "ltxOfficial.js"), json.dumps(lists), json.dumps(style or {}), mode, json.dumps(want or {})],
                       capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


only_dist = dict(LISTS, ckpt=[DIST], loras=["3DREAL-strong.safetensors"])
a = pick(only_dist, "t2v")
check("only the distilled checkpoint: text to video runs on it, the distilled LoRA left out (said)",
      a.get("ckpt") == DIST and a.get("dlora") == "__bitgen_drop__" and any("distilled LoRA is left out" in n for n in a.get("notes", [])), a)
b = pick(dict(LISTS, ckpt=[DEV], loras=[]), "i2v")
c = pick(dict(LISTS, loras=[DLORA]), "3dreal")
dd = pick(dict(LISTS, ckpt=[]), "flf")
e = pick(LISTS, "3dreal", {"ic_lora": "3DREAL-strong.safetensors"})
check("refused in words: the dev checkpoint without its distilled LoRA; 3DREAL without fal's file (where to get it); "
      "no LTX 2.3 checkpoint; an asked variant ComfyUI lacks -> the newest it has, said",
      "distilled LoRA" in b.get("error", "") and "huggingface.co/fal/LTX-2.3-3DREAL-LoRA" in c.get("error", "")
      and "no LTX 2.3 checkpoint" in dd.get("error", "") and e.get("iclora") == "3DREAL-strong-v2.safetensors"
      and any("not in ComfyUI's loras" in n for n in e.get("notes", [])), [b, c, dd, e])

# 3 lib/ltx + lib/blenderScene (node)
js = r"""
const path = require("path"), fs = require("fs"), os = require("os");
const ltx = require(path.join(process.argv[1], "lib", "ltx.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ltx23js_"));
const wf = path.join(process.argv[1], "comfy_workflows", "LTX25_All_In_One.json");
const st = { id: "s23", name: "LTX 2.3", kind: "video", arch: "ltx-2.3" };
const pic = path.join(tmp, "a.png"); fs.writeFileSync(pic, "x");
const vid = path.join(tmp, "scene.mp4"); fs.writeFileSync(vid, "x");
const out = {};
out.modes = ltx.modesFor(st).map((m) => m.id);
out.auto_v = ltx.jobParams({ style: st, workflow: wf, mode: "auto", prompt: "x", images: [pic], video: { path: vid, start: 0 }, seconds: 4 });
out.auto_2 = ltx.jobParams({ style: st, workflow: wf, mode: "auto", images: [pic, pic] });
out.lip = ltx.jobParams({ style: st, workflow: wf, mode: "lipsync", images: [pic] });
out.nov = ltx.jobParams({ style: st, workflow: wf, mode: "3dreal", images: [] });
out.is = [ltx.isLtxStyle(st), ltx.isLtxStyle({ kind: "video", arch: "ltx-2.5" }), ltx.isLtxStyle({ kind: "video", arch: "wan22" })];
out.sum = ltx.summary(out.auto_v);
const bs = require(path.join(process.argv[1], "lib", "blenderScene.js"));
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(32)]);
out.s1 = bs.save(mp4, { name: "My Scene!", frames: 48, fps: 24 }, tmp);
out.s2 = bs.save(mp4, { name: "My Scene!" , seconds: 3 }, tmp);
try { bs.save(Buffer.from("not a video at all......"), { name: "x" }, tmp); out.junk = "saved"; } catch (e) { out.junk = e.message; }
process.stdout.write(JSON.stringify(out));
"""
r = subprocess.run(["node", "-e", js, str(ROOT)], capture_output=True, text=True)
o = json.loads(r.stdout or "{}") if r.returncode == 0 else {}
av = o.get("auto_v") or {}
check("lib/ltx: an LTX 2.3 style offers t2v / i2v / flf / 3dreal; Auto with a video = 3DREAL (the picture = its real "
      "first frame, the render as the video, ic_strength 1), 2 pictures = first / last; isLtxStyle knows 2.3",
      o.get("modes") == ["t2v", "i2v", "flf", "3dreal"] and av.get("ltx_mode") == "3dreal" and av.get("ltx_family") == "ltx23"
      and len(av.get("images") or []) == 1 and (av.get("video") or {}).get("path", "").endswith("scene.mp4")
      and av.get("ic_strength") == 1 and (o.get("auto_2") or {}).get("ltx_mode") == "flf" and o.get("is") == [True, True, False]
      and str(o.get("sum", "")).startswith("LTX 2.3 3D render -> real"), (r.stderr[-500:], o))
check("lib/ltx: lipsync on LTX 2.3 refused (an LTX 2.5 mode); 3DREAL without a render refused (points at Blender)",
      "LTX 2.5 mode" in (o.get("lip") or {}).get("error", "") and "Blender" in (o.get("nov") or {}).get("error", ""), o)
check("lib/blenderScene: the render saved as blender_<name>.mp4 (never over an older one), seconds from frames / fps; "
      "junk refused in words",
      (o.get("s1") or {}).get("name") == "blender_My_Scene.mp4" and (o.get("s1") or {}).get("seconds") == 2
      and (o.get("s2") or {}).get("name") == "blender_My_Scene_2.mp4" and (o.get("s2") or {}).get("seconds") == 3
      and "send the render as a video" in str(o.get("junk")), o)


# 4 LIVE
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


port = free_port()
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / "out")],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(M)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = f"http://127.0.0.1:{port}"
for _ in range(80):
    try:
        socket.create_connection(("127.0.0.1", port), 0.2).close()
        break
    except OSError:
        time.sleep(0.1)
pic = T / "face.png"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x192:duration=1", "-frames:v", "1", str(pic)])
render = T / "blender_scene.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x192:rate=24:duration=2",
                "-pix_fmt", "yuv420p", str(render)])


def run_job(lmode, images, name, video=None):
    jd = T / name
    jd.mkdir()
    job = {"params": {"mode": "ltx", "ltx_mode": lmode, "ltx_family": "ltx23", "prompt": "a red car", "seconds": 2,
                      "fps": 24, "width": 650, "height": 380, "seed": 11, "images": [str(x) for x in images],
                      "video": {"path": str(video), "start": 0} if video else None,
                      "workflow": str(ROOT / "comfy_workflows" / "LTX25_All_In_One.json"),
                      "video_style": {"name": "LTX 2.3", "arch": "ltx-2.3", "negative": "cartoon"},
                      **({"ic_lora": "", "ic_strength": 1} if lmode == "3dreal" else {})},
           "config": {"engine": {"backend": "comfy", "comfy": {"url": base}}}, "output_dir": str(jd / "out"),
           "app_dir": str(ROOT), "node_exe": shutil.which("node")}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "ltx_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=240)
    q = json.loads((jd / "ltx_queued.json").read_text()) if (jd / "ltx_queued.json").is_file() else {}
    return r, q


try:
    for lmode, imgs, vid in (("t2v", [], None), ("flf", [pic, pic], None), ("3dreal", [], render)):
        r, q = run_job(lmode, imgs, f"live_{lmode}", vid)
        out = r.stdout
        cls = {v.get("class_type") for v in q.values()}
        extra = True
        if lmode == "3dreal":
            lv = [v["inputs"].get("file") for v in q.values() if v.get("class_type") == "LoadVideo"]
            li = [v["inputs"].get("image") for v in q.values() if v.get("class_type") == "LoadImage"]
            extra = (lv == ["blender_scene.mp4"] and li == ["render_first.png"] and "GetVideoComponents" in cls
                     and any(v.get("class_type") == "LoraLoaderModelOnly" and v["inputs"].get("lora_name") == "3DREAL-strong-v2.safetensors" for v in q.values())
                     and "3DREAL: no first picture" in out)
        check(f"LIVE {lmode}: ltx_worker ran Comfy-Org's LTX 2.3 template (never the canvas), the stub's real checks "
              "passed, the take written" + (" - the render uploaded, its first frame extracted for the bypassed input, "
                                            "fal's LoRA on the guide" if lmode == "3dreal" else ""),
              r.returncode == 0 and "LTX 2.3 on Comfy-Org's own template ltx23_official_" in out and "@@OUT " in out
              and "LTX25_All_In_One" not in out and "SaveVideo" in cls and "CheckpointLoaderSimple" in cls and extra,
              out[-1300:])
    r, q = run_job("lipsync", [pic], "live_lip")
    check("LIVE lipsync on LTX 2.3: refused in words (an LTX 2.5 canvas mode), nothing queued",
          r.returncode != 0 and "LTX 2.5 canvas mode" in r.stdout and not q, r.stdout[-800:])
finally:
    stub.kill()
    stub.wait()
shutil.rmtree(T, ignore_errors=True)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
