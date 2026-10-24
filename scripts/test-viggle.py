#!/usr/bin/env python3
"""bitGen Studio — 2.344.0: the swap dialog's Viggle (H3) engine, the Python side.
Run: python3 scripts/test-viggle.py

Tim (with API-viggle-animate-h3_workflow-v1.2.0.json): "https://github.com/
deepbeepmeep/Wan2GP, uses a 3 step viggle animate ... can you see if we can
add viggle to our styles\\workflow".
  1. scripts/viggle_graph.patch on his upload (comfy_workflows/
     viggle_animate_h3_api.json): size / length, the first frame + the clip
     (the megapixel resize taken out), seed, the 3-step sigmas (5 / 7 = the
     other presets, anything else interpolated), the DMD LoRA + swap LoRAs,
     the output, the prune; refusals in words;
  2. bypass: the speed patches a ComfyUI lacks are stepped over;
  3. viggle_worker.pick: the models as ComfyUI lists them (fp16 VAE for the
     int8 one), none = None."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "misc"))
import viggle_graph as VG  # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:400]))


T = json.loads((ROOT / "comfy_workflows" / "viggle_animate_h3_api.json").read_text(encoding="utf-8"))
ofc = lambda g, c: [k for k, v in g.items() if v["class_type"] == c]  # noqa: E731
o = {"image": "ff.png", "video": "clip.mp4", "width": 832, "height": 480, "frames": 120, "seed": 4242, "steps": 3,
     "strength": 0.9, "loras": [{"name": "look.safetensors", "weight": 0.5}], "prefix": "bitgen_viggle"}

# ---- 1. the patch
g, notes = VG.patch(T, o)
c = g[ofc(g, "ViggleAnimateConditioning")[0]]["inputs"]
check("the conditioning: 832x480, 120 frames", (c["width"], c["height"], c["length"]) == (832, 480, 120), c)
lv = g[ofc(g, "VHS_LoadVideo")[0]]["inputs"]
check("the clip: from its first frame, all 120, 24 fps, no resize (the megapixel resize taken out - the app cuts it at the size)",
      lv["video"] == "clip.mp4" and lv["skip_first_frames"] == 0 and lv["frame_load_cap"] == 120 and lv["force_rate"] == 24
      and c["cond_video"] == [ofc(g, "VHS_LoadVideo")[0], 0] and not ofc(g, "JWImageResizeToMegapixels"), lv)
check("the ✎ first frame is the ref image", g[c["ref_image"][0]]["class_type"] == "LoadImage" and g[c["ref_image"][0]]["inputs"]["image"] == "ff.png")
check("seed on RandomNoise", g[ofc(g, "RandomNoise")[0]]["inputs"]["noise_seed"] == 4242)
sig = g[g[ofc(g, "SamplerCustomAdvanced")[0]]["inputs"]["sigmas"][0]]["inputs"]
check("3 steps = the 4-point DMD sigmas (Tim's \"3 step viggle animate\")", sig == {"sigmas_string": VG.SIGMAS[3], "interpolate_to_steps": 3}, sig)
for n, pts in ((5, 6), (7, 8)):
    s2 = VG.patch(T, {**o, "steps": n})[0]
    si = s2[s2[ofc(s2, "SamplerCustomAdvanced")[0]]["inputs"]["sigmas"][0]]["inputs"]
    check(f"{n} steps = the {pts}-point preset", si["interpolate_to_steps"] == n and len(si["sigmas_string"].split(",")) == pts, si)
s4 = VG.patch(T, {**o, "steps": 4})[0]
si = s4[s4[ofc(s4, "SamplerCustomAdvanced")[0]]["inputs"]["sigmas"][0]]["inputs"]
check("any other count = the 4-point preset interpolated", si == {"sigmas_string": VG.SIGMAS[3], "interpolate_to_steps": 4}, si)
dmd = [k for k in ofc(g, "LoraLoaderModelOnly") if "viggle" in g[k]["inputs"]["lora_name"]][0]
check("the DMD LoRA @ 0.9, the swap LoRA chained after it, the model chain reads the last",
      g[dmd]["inputs"]["strength_model"] == 0.9 and g["vl1"]["inputs"] == {"lora_name": "look.safetensors", "strength_model": 0.5, "model": [dmd, 0]}
      and any(v["inputs"].get("model") == ["vl1", 0] for k, v in g.items() if k != "vl1"))
outs = ofc(g, "VHS_VideoCombine")
check("ONE output - the VAEDecode's, prefix bitgen_viggle, saved; the comparison + the spare sigmas pruned",
      len(outs) == 1 and g[outs[0]]["inputs"]["filename_prefix"] == "bitgen_viggle" and g[outs[0]]["inputs"]["save_output"] is True
      and not ofc(g, "ImageConcanate") and len(ofc(g, "CustomSigmas")) == 1 and not ofc(g, "BasicScheduler"), outs)
check("nothing dangling", all(str(v[0]) in g for n in g.values() for v in n["inputs"].values()
                              if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)))
check("the template is never touched", T["1"]["inputs"]["length"] == 56 and "vl1" not in T)
for bad, why in (({}, "empty"), ({k: v for k, v in T.items() if v["class_type"] != "ViggleAnimateConditioning"}, "ONE ViggleAnimateConditioning")):
    try:
        VG.patch(bad, o)
        check(f"refused in words: {why}", False)
    except ValueError as e:
        check(f"refused in words: {why}", why in str(e), str(e))

# ---- 2. bypass
g2 = json.loads(json.dumps(T))
gone = VG.bypass(g2, ["SolAttnPatch", "MiniMaxChunkFeedForward"])
check("bypass: the two speed patches stepped over, the chain rejoined (ModelPatchTorchSettings reads ModelAttentionBackend)",
      sorted(gone) == ["48", "49"] and g2["50"]["inputs"]["model"] == ["22", 0], (gone, g2.get("50")))
g3, _n = VG.patch(g2, o)
check("...and the patch still makes one clean graph", not ofc(g3, "SolAttnPatch") and all(
    str(v[0]) in g3 for n in g3.values() for v in n["inputs"].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)))
check("size: the video's aspect at 480 (Viggle's canvas), 32-multiples", VG.size(1920, 1080) == (864, 480) and VG.size(1080, 1920) == (480, 864))

# ---- 3. the model names
import viggle_worker as W  # noqa: E402
check("pick: the template's file as ComfyUI spells it", W.pick(["sub\\minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors"],
                                                               "minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors", r"ref2va_viggle")
      == "sub\\minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors")
check("pick: else the one matching (the fp16 H3 VAE for the int8 one)", W.pick(["a.safetensors", "minimax_h3_video_vae_fp16.safetensors"],
                                                                              "minimax_h3_video_vae_int8_convrot.safetensors", r"minimax_h3_video_vae")
      == "minimax_h3_video_vae_fp16.safetensors")
check("pick: none -> None; no list -> the template's own", W.pick(["a.safetensors"], "x.safetensors", r"viggle") is None
      and W.pick([], "x.safetensors", r"viggle") == "x.safetensors")
# ---- 4. 2.346.0: ComfyUI dying mid-render is said in words (Tim's run: a
# custom node aborted ComfyUI; the job died as "the worker crashed: URLError")
import urllib.error  # noqa: E402
import comfy_client as CC  # noqa: E402
_hj, _sl = CC.http_json, CC.time.sleep
calls = []
def _down(url, *a, **k):
    calls.append(url)
    raise urllib.error.URLError("[WinError 10061] No connection could be made because the target machine actively refused it")
CC.http_json, CC.time.sleep = _down, (lambda s: None)
try:
    CC.wait("http://127.0.0.1:1", "pid")
    check("wait: a ComfyUI that stops answering -> ComfyError in words", False)
except CC.ComfyError as e:
    check("wait: a ComfyUI that stops answering -> ComfyError in words (after 5 misses, not a traceback)",
          "stopped answering while rendering - it most likely crashed" in str(e) and len(calls) == 5, str(e))
seq = iter([urllib.error.URLError("blip"), {"pid": {"outputs": {"9": {"gifs": []}}}}])
def _blip(url, *a, **k):
    v = next(seq)
    if isinstance(v, Exception):
        raise v
    return v
CC.http_json = _blip
check("...one missed poll is a blip - the render carries on", CC.wait("http://x", "pid") == {"9": {"gifs": []}})
CC.http_json, CC.time.sleep = _hj, _sl
# ---- 5. 2.350.0 (Tim: "the Viggle render came back ALL BLACK ... this was
# with viggle"): fp16 accumulation is a speed patch; safe mode for a black take
gp, _n = VG.patch(T, o)
mpt = ofc(gp, "ModelPatchTorchSettings")[0]
check("the template ships fp16 accumulation ON", gp[mpt]["inputs"]["enable_fp16_accumulation"] is True)
check("fp16_accumulation(False): switched OFF (the node kept - it forces the flag off for the run)",
      VG.fp16_accumulation(gp, False) == [mpt] and gp[mpt]["inputs"]["enable_fp16_accumulation"] is False and VG.fp16_accumulation(gp, False) == [])
gp[mpt]["inputs"]["enable_fp16_accumulation"] = True
VN = ["minimax_h3_video_vae_int8_convrot.safetensors", "sub\\minimax_h3_video_vae_fp16.safetensors", "other_vae.safetensors"]
gs, ch = VG.safe_mode(gp, VN)
check("safe_mode: fp16 accumulation off, the speed patches + the attention backend stepped over, the fp16 H3 VAE for the int8 one",
      ch == ["fp16 accumulation off", "the speed patches stepped over", "ComfyUI's own attention (not comfy kitchen attention)",
             "the minimax_h3_video_vae_fp16.safetensors VAE (not the minimax_h3_video_vae_int8_convrot.safetensors)"]
      and gs[mpt]["inputs"]["enable_fp16_accumulation"] is False
      and not ofc(gs, "SolAttnPatch") and not ofc(gs, "MiniMaxChunkFeedForward") and not ofc(gs, "ModelAttentionBackend")
      and gs[ofc(gs, "VAELoader")[0]]["inputs"]["vae_name"] == "sub\\minimax_h3_video_vae_fp16.safetensors", ch)
check("...one clean graph (the model chain rejoined), the input graph untouched", all(
    str(v[0]) in gs for n in gs.values() for v in n["inputs"].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int))
    and ofc(gp, "ModelAttentionBackend") and gp[mpt]["inputs"]["enable_fp16_accumulation"] is True)
gs2, ch2 = VG.safe_mode(gs, VN)
check("safe_mode twice: nothing left to change -> [] (the worker then fails in words, no pointless re-render)", ch2 == [], ch2)
gv, chv = VG.safe_mode(gp, ["minimax_h3_video_vae_int8_convrot.safetensors"])
check("no full-precision H3 VAE listed -> the int8 one stays", "VAE" not in " ".join(chv)
      and gv[ofc(gv, "VAELoader")[0]]["inputs"]["vae_name"] == gp[ofc(gp, "VAELoader")[0]]["inputs"]["vae_name"], chv)
import black_check as BC  # noqa: E402
check("the reason: black in safe mode too -> the model files / ComfyUI (not 'retry with a new seed')",
      "in safe mode too" in BC.reason("Viggle", safe=True) and "Retry with a new seed" not in BC.reason("Viggle", safe=True)
      and "Retry with a new seed" in BC.reason("Viggle"))
Wsrc = (ROOT / "misc" / "viggle_worker.py").read_text(encoding="utf-8")
check("worker: fp16 accumulation follows ⚙ speed patches; ⚙ safe mode up front; a black take -> ONE safe-mode render (same seed), black again -> the safe reason",
      'VG.fp16_accumulation(graph, bool(params.get("speed_patch")))' in Wsrc and 'if params.get("safe"):' in Wsrc
      and 'raw = render(g2, "_safe", "chunk 1/1 (safe mode)")' in Wsrc and 'fail(BC.reason("Viggle", safe=True))' in Wsrc
      and "safe mode fixed it" in Wsrc)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
