#!/usr/bin/env python3
"""bitGen Studio — 2.316.0: THE CONTROLNET PASS OF AN IMAGE RENDER.
Tim: "add controlnet accordian menuitem to basic settings in left docker ...
show the first image generated, the controlnet preprocessor gen and the final
generation in the gallery"
  1. preprocess_graph: LoadImage -> the type's comfyui_controlnet_aux node ->
     SaveImage, the picked annotator file on the right input;
  2. apply_controlnet on the shipped SDXL (KSampler) and FLUX.2 (CFGGuider)
     workflows and a guider-only graph: every positive/negative through
     ControlNetApplyAdvanced with the decode's VAE;
  3. final_params: steps / cfg / LoRAs on top of the style; (2.317.0) the
     SECOND model's style, at the first image's size;
  4. run() with a fake ComfyUI: first -> <first>_cnmap.png -> <first>_cn.png,
     in that order;
  5. the worker wiring.
Run from repo root: python3 scripts/test-cnstage.py"""
import copy, json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import cn_stage as cs  # noqa: E402
import comfy_image as ci  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


# ---- 1. the preprocessor graph ----------------------------------------------------------
g, n = cs.preprocess_graph("up_first.png", "pose", "yzd-v/DWPose/dw-ll_ucoco_384.onnx", 1024, "bitgen_cnmap/x")
check("pose: LoadImage -> DWPreprocessor (pose_estimator = the picked file, resolution 1024) -> SaveImage",
      g["cn_load"]["inputs"]["image"] == "up_first.png" and g["cn_pre"]["class_type"] == "DWPreprocessor"
      and g["cn_pre"]["inputs"]["pose_estimator"] == "dw-ll_ucoco_384.onnx" and g["cn_pre"]["inputs"]["resolution"] == 1024
      and g["cn_save"]["inputs"]["images"] == ["cn_pre", 0] and g["cn_save"]["inputs"]["filename_prefix"] == "bitgen_cnmap/x", g)
g2, _ = cs.preprocess_graph("a.png", "pose", "yolox_l.onnx")
g3, _ = cs.preprocess_graph("a.png", "depth", "depth-anything/depth_anything_v2_vitl.pth")
g4, n4 = cs.preprocess_graph("a.png", "lineart", "sk_model.pth")
g5, n5 = cs.preprocess_graph("a.png", "scribble", "")
check("...a YOLOX file is the bbox detector; depth takes ckpt_name; lineart / scribble keep their fixed model (said); blank = the node's default",
      g2["cn_pre"]["inputs"].get("bbox_detector") == "yolox_l.onnx"
      and g3["cn_pre"]["class_type"] == "DepthAnythingV2Preprocessor" and g3["cn_pre"]["inputs"]["ckpt_name"] == "depth_anything_v2_vitl.pth"
      and g4["cn_pre"]["class_type"] == "LineArtPreprocessor" and "fixed model" in " ".join(n4)
      and g5["cn_pre"]["class_type"] == "Scribble_PiDiNet_Preprocessor" and "own default" in " ".join(n5))
try:
    cs.preprocess_graph("a.png", "hologram")
    bad = False
except ValueError:
    bad = True
check("...an unknown type is refused", bad)
# 2.319.0 (Tim's run: LineArtPreprocessor -> KeyError: 'coarse')
LA = {"required": {"image": ["IMAGE"]}, "optional": {"coarse": [["disable", "enable"], {"default": "disable"}],
                                                     "resolution": ["INT", {"default": 512}]}}
check("2.319.0: every preprocessor graph carries its switches (Lineart coarse, Scribble safe, DWPose detect_*)",
      g4["cn_pre"]["inputs"].get("coarse") == "disable" and g5["cn_pre"]["inputs"].get("safe") == "enable"
      and all(g["cn_pre"]["inputs"].get(k) == "enable" for k in ("detect_hand", "detect_body"))
      and g["cn_pre"]["inputs"].get("detect_face") == "disable", g4)
gpf, npf = cs.preprocess_graph("a.png", "pose", "", 512, "p", pose_face=True)
check("2.322.0: Pose face points are OFF by default (the second model draws the face); the switch turns them on - said either way",
      gpf["cn_pre"]["inputs"]["detect_face"] == "enable" and "face points ON" in " ".join(npf)
      and "face points OFF" in " ".join(cs.preprocess_graph("a.png", "pose")[1])
      and "detect_face" not in g3["cn_pre"]["inputs"], npf)
gl = {"p": {"class_type": "LineArtPreprocessor", "inputs": {"image": ["l", 0]}}}
filled = cs.complete_inputs(gl, "p", LA)
check("complete_inputs: a declared OPTIONAL widget that is missing gets the server's default (coarse), the IMAGE link is left alone",
      gl["p"]["inputs"] == {"image": ["l", 0], "coarse": "disable", "resolution": 512}
      and ("coarse", "disable", "declared default") in filled, (gl, filled))
DWS = {"required": {"image": ["IMAGE"]}, "optional": {
    "bbox_detector": [["yolox_l.torchscript.pt", "yolox_l.onnx"], {"default": "yolox_l.onnx"}],
    "pose_estimator": ["COMBO", {"options": ["dw-ll_ucoco_384_bs5.torchscript.pt", "dw-ll_ucoco_384.onnx"]}],
    "scale_stick_for_xinsr_cn": {"type": "COMBO", "options": ["disable", "enable"], "default": "disable"},
    "resolution": ["INT", {"default": 512}]}}
gd = {"p": {"class_type": "DWPreprocessor", "inputs": {"image": ["l", 0], "resolution": 1024, "bbox_detector": "yolox_x.onnx"}}}
fd = cs.complete_inputs(gd, "p", DWS)
check("...every spec shape (list combo, COMBO+options, dict); a value this ComfyUI does not list -> its default; a set value is kept",
      gd["p"]["inputs"]["bbox_detector"] == "yolox_l.onnx" and gd["p"]["inputs"]["pose_estimator"] == "dw-ll_ucoco_384_bs5.torchscript.pt"
      and gd["p"]["inputs"]["scale_stick_for_xinsr_cn"] == "disable" and gd["p"]["inputs"]["resolution"] == 1024
      and any(n == "bbox_detector" and "not in this ComfyUI" in w for n, v, w in fd), (gd, fd))
check("...no schema (an unreachable server): nothing changes", cs.complete_inputs(copy.deepcopy(gl), "p", {}) == [])
check("detect_resolution: the short side in 64-px steps, 512..2048",
      cs.detect_resolution((1344, 768)) == 768 and cs.detect_resolution((300, 200)) == 512
      and cs.detect_resolution((4096, 4096)) == 2048 and cs.detect_resolution(None) == 512)

# ---- 2. ControlNet on the style's own graph ------------------------------------------------
SDXL = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_sdxl_t2i.json"))
samp = next(k for k, v in SDXL.items() if v["class_type"] == "KSampler")
pos0, neg0 = list(SDXL[samp]["inputs"]["positive"]), list(SDXL[samp]["inputs"]["negative"])
gs, ns = cs.apply_controlnet(copy.deepcopy(SDXL), "map.png", "sdxl/depth_cn.safetensors", 0.8)
ap = [k for k, v in gs.items() if v["class_type"] == "ControlNetApplyAdvanced"]
a = gs[ap[0]]["inputs"] if ap else {}
ld = next((k for k, v in gs.items() if v["class_type"] == "ControlNetLoader"), None)
im = next((k for k, v in gs.items() if v["class_type"] == "LoadImage" and v["inputs"].get("image") == "map.png"), None)
dec = next(v for v in gs.values() if v["class_type"] == "VAEDecode")
check("SDXL: the KSampler's positive + negative go through ControlNetApplyAdvanced (the map, the model, strength 0.8, the decode's VAE)",
      len(ap) == 1 and a["positive"] == pos0 and a["negative"] == neg0 and a["control_net"] == [ld, 0]
      and a["image"] == [im, 0] and a["strength"] == 0.8 and a["vae"] == dec["inputs"]["vae"]
      and gs[samp]["inputs"]["positive"] == [ap[0], 0] and gs[samp]["inputs"]["negative"] == [ap[0], 1]
      and gs[ld]["inputs"]["control_net_name"] == "sdxl/depth_cn.safetensors" and "1 sampler(s)" in ns[0], (a, ns))
FL = ci.load_workflow(str(ROOT / "comfy_workflows" / "img_flux2_klein_9b_t2i.json"))
gf, nf = cs.apply_controlnet(copy.deepcopy(FL), "map.png", "flux_union.safetensors")
gd = next(k for k, v in gf.items() if v["class_type"] == "CFGGuider")
check("FLUX.2 (CFGGuider positive/negative): wired the same way",
      str(gf[gd]["inputs"]["positive"][0]).startswith("cn_apply") and str(gf[gd]["inputs"]["negative"][0]).startswith("cn_apply"), nf)
BG = {"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "x", "clip": ["2", 0]}},
      "3": {"class_type": "BasicGuider", "inputs": {"model": ["4", 0], "conditioning": ["1", 0]}},
      "5": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["7", 0]}}}
gb, nb = cs.apply_controlnet(copy.deepcopy(BG), "m.png", "cn.safetensors")
ab = next(v["inputs"] for v in gb.values() if v["class_type"] == "ControlNetApplyAdvanced")
check("a guider with ONE conditioning: it goes through the apply (as both inputs) and the guider reads output 0",
      gb["3"]["inputs"]["conditioning"] == ["cn_apply0", 0] and ab["positive"] == ["1", 0] and ab["negative"] == ["1", 0]
      and "guider(s)" in nb[0], (gb["3"], nb))
for bad_g, why in ((({"1": {"class_type": "SaveImage", "inputs": {}}}), "no sampler"),):
    try:
        cs.apply_controlnet(copy.deepcopy(bad_g), "m.png", "cn.safetensors")
        ok = False
    except ValueError:
        ok = True
    check(f"...{why} / no model: refused in words", ok)
try:
    cs.apply_controlnet(copy.deepcopy(SDXL), "m.png", "")
    ok = False
except ValueError as e:
    ok = "Basic Settings -> ControlNet -> Preprocessor" in str(e)
check("...no ControlNet picked names the Preprocessor dropdown", ok)
# the patched graph is still one the image patcher accepts (roles find the text + sampler)
r = ci.roles(gs)
check("the patched SDXL graph still has its sampler and prompt for the patcher", r["sampler"] == samp and r["positive"], r["sampler"])

# ---- 3. the final's params ----------------------------------------------------------------------
style = {"name": "s", "loras": [{"path": "a.safetensors", "weight": 0.5}]}
fp, fst = cs.final_params({"prompt": "p", "seed": 7, "steps": 20, "cfg": 5, "controlnet": {}}, style,
                          {"steps": 30, "cfg": 3.5, "loras": [{"path": "a.safetensors", "weight": 0.9},
                                                             {"path": "cn/b.safetensors", "weight": 0.7}]})
check("final_params: same prompt + seed, the ControlNet steps 30 / cfg 3.5, its LoRAs on top (a re-weighted, b added)",
      fp["prompt"] == "p" and fp["seed"] == 7 and fp["steps"] == 30 and fp["cfg"] == 3.5 and "controlnet" not in fp
      and fst["loras"] == [{"path": "a.safetensors", "weight": 0.9}, {"path": "cn/b.safetensors", "weight": 0.7}]
      and style["loras"] == [{"path": "a.safetensors", "weight": 0.5}], (fp, fst))
fp2, fst2 = cs.final_params({"prompt": "p", "steps": 20}, style, {"steps": None, "cfg": None, "loras": []})
# 2.317.0: the SECOND model
SEC = {"id": "cn_second", "name": "ControlNet: jugg", "engine": "comfy", "workflow": "comfy_workflows/img_sdxl_t2i.json",
       "model": "SDXL/jugg.safetensors", "model_override": True, "loras": []}
fp3, fst3 = cs.final_params({"prompt": "p", "seed": 7, "steps": 4, "cfg": 1, "workflow": "comfy_workflows/klein_edit.json",
                             "images": ["a.png"], "model": "klein.safetensors", "negative": "blurry"},
                            {"name": "first", "loras": [{"path": "firstlook.safetensors", "weight": 1}]},
                            {"second": SEC, "steps": None, "cfg": 6, "loras": [{"path": "cn/l.safetensors", "weight": 0.6}]})
check("2.317.0 final_params with a SECOND model: its style (workflow + model), the ControlNet LoRAs only, the first render's "
      "workflow swap / reference pictures / checkpoint override / steps left behind, the ControlNet cfg, same prompt + seed + negative",
      fst3["workflow"] == SEC["workflow"] and fst3["model"] == "SDXL/jugg.safetensors"
      and fst3["loras"] == [{"path": "cn/l.safetensors", "weight": 0.6}]
      and not any(k in fp3 for k in ("workflow", "images", "model", "steps")) and fp3["cfg"] == 6.0
      and fp3["prompt"] == "p" and fp3["seed"] == 7 and fp3["negative"] == "blurry" and SEC["loras"] == [], (fp3, fst3))
# 2.321.0: the second model's own prompt / negative, strength + end
fp4, _ = cs.final_params({"prompt": "anime style, a woman", "negative": "blurry", "seed": 3}, {"name": "f"},
                         {"second": SEC, "use_main_prompt": False, "prompt": "photo, realistic, a woman", "negative": "anime, cartoon"})
fp5, _ = cs.final_params({"prompt": "anime style, a woman", "negative": "blurry"}, {"name": "f"},
                         {"second": SEC, "use_main_prompt": True, "prompt": "not used"})
check("2.321.0 final_params: unticked -> the second model's own prompt + negative; ticked -> the prompt docker's prompt and the first negative",
      fp4["prompt"] == "photo, realistic, a woman" and fp4["negative"] == "anime, cartoon" and fp4["seed"] == 3
      and fp5["prompt"] == "anime style, a woman" and fp5["negative"] == "blurry", (fp4, fp5))
ge, ne = cs.apply_controlnet(copy.deepcopy(SDXL), "m.png", "cn.safetensors", 0.6, 0.7)
ae = next(v["inputs"] for v in ge.values() if v["class_type"] == "ControlNetApplyAdvanced")
check("...apply_controlnet: strength 0.6, end_percent 0.7 (said); an end of 0 is held at 5%",
      ae["strength"] == 0.6 and ae["end_percent"] == 0.7 and ae["start_percent"] == 0.0 and "ends at 70%" in ne[0]
      and next(v["inputs"] for v in cs.apply_controlnet(copy.deepcopy(SDXL), "m", "c", 1, 0)[0].values()
               if v["class_type"] == "ControlNetApplyAdvanced")["end_percent"] == 0.05, (ae, ne))
check("size16: the first image's size, 16-px aligned (the second render lines up with the map)",
      cs.size16((1344, 770)) == (1344, 768) and cs.size16(None) is None)
check("...unset steps / cfg / LoRAs keep the first render's", fp2["steps"] == 20 and "cfg" not in fp2 and fst2["loras"] == style["loras"])

# ---- 4. run() with a fake ComfyUI --------------------------------------------------------------------
with tempfile.TemporaryDirectory() as td:
    out = Path(td)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=1344x768",
                    "-frames:v", "1", str(out / "20260926-1_s7.png")], check=True)
    queued, uploads, log = [], [], []

    def dl(item, dest):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=64x64",
                        "-frames:v", "1", str(dest)], check=True)
    fake = {"upload": lambda p: (uploads.append(Path(p).name), "up_" + Path(p).name)[1],
            "prepare": lambda g: g, "queue": lambda g: (queued.append(g), f"pid{len(queued)}")[1],
            "wait": lambda pid: {"cn_save": {"images": [{"filename": "m.png"}]}},
            "images": lambda outs: outs["cn_save"]["images"], "download": dl}
    hooked = []

    sizes = []

    def render(stem, hook, size=None):
        g = hook(copy.deepcopy(SDXL))
        hooked.append(g)
        sizes.append(size)
        (out / f"{stem}.png").write_bytes(b"png")
        return [f"{stem}.png"]
    got = cs.run(["20260926-1_s7.png"], out, {"type": "depth", "controlnet": "cn.safetensors", "strength": 1,
                                              "second": SEC, "second_how": "img_sdxl_t2i.json with SDXL/jugg.safetensors"},
                 say=log.append, comfy=fake, render=render, reserve=lambda n, d=None: n)
    pre = queued[0] if queued else {}
    check("run: first -> <first>_cnmap.png -> <first>_cn.png, in gallery order, each on disk",
          got == ["20260926-1_s7.png", "20260926-1_s7_cnmap.png", "20260926-1_s7_cn.png"]
          and all((out / f).exists() for f in got), got)
    check("...the preprocessor ran on the FIRST image (uploaded) at its short side (768), the final on the uploaded MAP",
          pre.get("cn_load", {}).get("inputs", {}).get("image") == "up_20260926-1_s7.png"
          and pre.get("cn_pre", {}).get("inputs", {}).get("resolution") == 768
          and uploads == ["20260926-1_s7.png", "20260926-1_s7_cnmap.png"]
          and any(v["class_type"] == "LoadImage" and v["inputs"].get("image") == "up_20260926-1_s7_cnmap.png"
                  for v in hooked[0].values()), (pre, uploads))
    check("...and says each step (the final names the second model)", any("control map written" in x for x in log)
          and any("ControlNet final" in x for x in log) and any("the second model: img_sdxl_t2i.json with SDXL/jugg" in x for x in log), log)
    cnl = next((v["inputs"] for v in hooked[0].values() if v["class_type"] == "ControlNetLoader"), {})
    check("...the ControlNet loader takes the Preprocessor pick (the controlnet model); the second render asked for the first image's size",
          cnl.get("control_net_name") == "cn.safetensors" and sizes == [(1344, 768)], (cnl, sizes))

# ---- 4b. 2.320.0 FINAL IMAGE ONLY (Tim: "if checked don't show the first generation or controlnet
# image in the gallery, put them in projectname\\temp\\controlnet, name them gen_filename,
# ctn_filename, use the ctn filename to generate the final image")
with tempfile.TemporaryDirectory() as td:
    out = Path(td) / "images"
    tmpd = Path(td) / "temp" / "controlnet"
    out.mkdir()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=832x1216",
                    "-frames:v", "1", str(out / "20260926-2_s9.png")], check=True)
    queued2, uploads2, log2, stems2, hooked2 = [], [], [], [], []

    def dl2(item, dest):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=64x64",
                        "-frames:v", "1", str(dest)], check=True)
    fake2 = {"upload": lambda p: (uploads2.append(str(p)), "up_" + Path(p).name)[1],
             "prepare": lambda g: g, "queue": lambda g: (queued2.append(g), "pid")[1],
             "wait": lambda pid: {"cn_save": {"images": [{"filename": "m.png"}]}},
             "images": lambda outs: outs["cn_save"]["images"], "download": dl2}

    def render2(stem, hook, size=None):
        stems2.append(stem)
        hooked2.append(hook(copy.deepcopy(SDXL)))
        (out / f"{stem}.png").write_bytes(b"png")
        return [f"{stem}.png"]

    def reserve2(n, d=None):
        d = Path(d) if d else out
        return n if not (d / n).exists() else "X_" + n
    got2 = cs.run(["20260926-2_s9.png"], out, {"type": "lineart", "controlnet": "cn.safetensors", "final_only": True,
                                              "temp_dir": str(tmpd), "second": SEC},
                  say=log2.append, comfy=fake2, render=render2, reserve=reserve2)
    check("final only: the gallery gets ONLY the final, under the first image's own name",
          got2 == ["20260926-2_s9.png"] and stems2 == ["20260926-2_s9"] and (out / "20260926-2_s9.png").read_bytes() == b"png"
          and sorted(p.name for p in out.iterdir()) == ["20260926-2_s9.png"], (got2, stems2, sorted(p.name for p in out.iterdir())))
    check("...the first image is moved to <project>/temp/controlnet/gen_<file>, the control image written there as ctn_<file>",
          sorted(p.name for p in tmpd.iterdir()) == ["ctn_20260926-2_s9.png", "gen_20260926-2_s9.png"]
          and cs.png_size(tmpd / "gen_20260926-2_s9.png") == (832, 1216), sorted(p.name for p in tmpd.iterdir()))
    check("...the preprocessor read gen_<file>, and the final is rendered FROM the uploaded ctn_<file> at the first image's size",
          uploads2 == [str(tmpd / "gen_20260926-2_s9.png"), str(tmpd / "ctn_20260926-2_s9.png")]
          and any(v["class_type"] == "LoadImage" and v["inputs"].get("image") == "up_ctn_20260926-2_s9.png" for v in hooked2[0].values())
          and queued2[0]["cn_pre"]["inputs"]["coarse"] == "disable", uploads2)
    check("...and the log says where they went", any("temp/controlnet" in x.replace("\\", "/") or "controlnet/gen_" in x for x in log2)
          or any("gen_20260926-2_s9.png" in x for x in log2), log2)

# ---- 5. the worker ------------------------------------------------------------------------------------------
W = (ROOT / "image_worker.py").read_text()
check("image_worker: run_comfy takes a graph hook (after the patch + combo spelling, before the schema fill)",
      "def run_comfy(params, cfg, style, output_dir, stem, batch, seed, graph_hook=None):" in W
      and W.index("graph = graph_hook(graph)") > W.index("_comfy.canonicalise_combos(base, graph)")
      and W.index("graph = graph_hook(graph)") < W.index("for nid, ct, name, val, src in _comfy.fill_required_inputs(base, graph):"))
check("2.319.0: the worker completes each preprocessor node from this ComfyUI's schema before queueing it",
      "for name, val, why in _cn.complete_inputs(g, nid, spec or {}):" in W
      and W.index("_cn.complete_inputs(") < W.index("for nid, key, old, new in _comfy.canonicalise_combos(base, g):"))
check("...the ControlNet pass runs after the first image when the job carries it; a failure keeps the first image and says so",
      "if params.get(\"controlnet\"):\n            produced = run_controlnet(" in W
      and 'fail(f"ControlNet: {e} (the first image is in the gallery)")' in W
      and "return run_comfy(p2, cfg, fst, output_dir, stem2, 1, seed, graph_hook=both)" in W
      and "reserve=lambda n, d=None: _iname.reserve(Path(d) if d else output_dir, n))" in W
      and 'as gen_* / ctn_*)")' in W
      and 'p2["width"], p2["height"] = size' in W)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
