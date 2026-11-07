#!/usr/bin/env python3
"""bitGen Studio — 2.708.0: 16 GB MODE on MiniMax H3 graphs (scripts/h3_16gb.py) - on the app's own ref2va / fl2va
templates: the text encoder unload, pass 1 in 8 steps with the Acc LoRA (the graph's turbo switch bypassed), the latent
upscale + the last 2 sigmas with the DMD + refiner LoRAs and sparse attention, the sound kept, every decode reading
the result; parts this ComfyUI lacks left out with a note; FastH3 / an upscale stage / x1 respected.
Tim (verbatim): "this workflow is meant to work with 16gb vram - minimax" """
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import h3_16gb as H  # noqa: E402

P = F = 0


def check(name, cond, got=None):
    global P, F
    if cond:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:700]))


def load(name):
    return json.loads((ROOT / "comfy_workflows" / name).read_text(encoding="utf-8"))


ALL = {c: True for c in H.NODES.values()}
FILES = {"acc": "H3\\" + H.ACC, "dmd": H.DMD, "refiner": "H3/" + H.REFINER, "upscaler": H.UPSCALER}
OPT = {"scale": 1.8, "have": ALL, "files": FILES, "kitchen": True, "turbo": True}


def dangling(g):
    bad = []
    for k, v in g.items():
        for key, val in ((v or {}).get("inputs") or {}).items():
            if isinstance(val, list) and len(val) == 2 and isinstance(val[0], (str, int)) and str(val[0]) not in g:
                bad.append(f"{k}.{key}->{val[0]}")
    return bad


for name in ("ref2va.json", "fl2va.json"):
    g0 = load(name)
    f = H.find(g0)
    check(f"{name}: the H3 render is found (H3 node -> SamplerCustomAdvanced -> BasicGuider)", bool(f), f)
    g, notes = H.apply(g0, OPT)
    check(f"{name}: the template itself is not changed (a copy is)", json.dumps(g0, sort_keys=True) == json.dumps(load(name), sort_keys=True))
    check(f"{name}: every link points at a node of the graph", not dangling(g), dangling(g))
    gu = g[f["guider"]]["inputs"]
    check(f"{name}: the text encoder is unloaded between the H3 conditioning and BOTH guiders",
          g["h16teu"]["class_type"] == "DenoTextEncoderUnload" and gu["conditioning"] == ["h16teu", 0]
          and g["h16guide"]["inputs"]["conditioning"] == ["h16teu", 0]
          and g["h16teu"]["inputs"]["text_encoder"] == g[f["h3"]]["inputs"]["clip"]
          and g["h16teu"]["inputs"]["positive_conditioning"] == [f["h3"], 0])
    sw = g0[str(g0[f["guider"]]["inputs"]["model"][0])]
    base = sw["inputs"]["on_false"] if sw.get("class_type") == "ComfySwitchNode" else g0[f["guider"]]["inputs"]["model"]
    p1 = []
    cur = gu["model"]
    while str(cur[0]).startswith("h16p1"):
        p1.append(g[str(cur[0])]["class_type"])
        cur = g[str(cur[0])]["inputs"]["model"]
    check(f"{name}: pass 1 = base model (the turbo switch bypassed) -> kitchen attention -> Acc 8-step LoRA -> sigma shift 12 / 3",
          cur == base and p1 == ["MiniMaxH3SigmaShift", "LoraLoaderModelOnly", "ModelAttentionBackend"]
          and g["h16p1l0"]["inputs"]["lora_name"] == FILES["acc"] and g["h16p1sh"]["inputs"]["shift_video"] == 12, {"p1": p1, "cur": cur, "base": base})
    sch = g[f["scheduler"]]["inputs"]
    ks = g[str(g[f["sampler"]]["inputs"]["sampler"][0])]["inputs"]
    check(f"{name}: pass 1 runs 8 steps, euler", sch["steps"] == 8 and ks["sampler_name"] == "euler", {"steps": sch["steps"], "s": ks})
    up = g["h16up"]["inputs"]
    check(f"{name}: the video latent is upscaled x1.8 (scale by multiplier, align 32); the audio latent is masked (frozen) and rejoined",
          up["mode"] == "scale by multiplier" and up["mode.scale"] == 1.8 and up["align"] == 32 and up["model_name"] == H.UPSCALER
          and g["h16sep"]["inputs"]["av_latent"] == [f["sampler"], 0] and g["h16amask"]["inputs"]["samples"] == ["h16sep", 1]
          and g["h16mask"]["inputs"]["value"] == 0 and g["h16cat"]["inputs"] == {"video_latent": ["h16up", 0], "audio_latent": ["h16amask", 0]})
    p2, cur = [], g["h16guide"]["inputs"]["model"]
    while str(cur[0]).startswith("h16p2"):
        p2.append(g[str(cur[0])]["class_type"])
        cur = g[str(cur[0])]["inputs"]["model"]
    check(f"{name}: pass 2 = base -> kitchen attention -> DMD LoRA -> 2K refiner LoRA -> sigma shift -> Sol sparse attention (tau 1.3 from 20 %)",
          cur == base and p2 == ["BlockSparseAttention", "MiniMaxH3SigmaShift", "LoraLoaderModelOnly", "LoraLoaderModelOnly", "ModelAttentionBackend"]
          and g["h16p2sp"]["inputs"]["selection"] == "sol-attn" and g["h16p2sp"]["inputs"]["selection.tau"] == 1.3 and g["h16p2sp"]["inputs"]["start_percent"] == 0.2
          and [g["h16p2l0"]["inputs"]["lora_name"], g["h16p2l1"]["inputs"]["lora_name"]] == [FILES["dmd"], FILES["refiner"]], p2)
    s2 = g["h16samp"]["inputs"]
    check(f"{name}: pass 2 redraws the last 2 of 8 sigmas with the same noise and sampler",
          g["h16sched"]["inputs"]["steps"] == 8 and g["h16split"]["inputs"]["step"] == 6 and s2["sigmas"] == ["h16split", 1]
          and s2["noise"] == g[f["sampler"]]["inputs"]["noise"] and s2["sampler"] == g[f["sampler"]]["inputs"]["sampler"] and s2["latent_image"] == ["h16cat", 0])
    dec = [k for k, v in g.items() if v.get("class_type") in ("VAEDecode", "VAEDecodeAudio")]
    check(f"{name}: every decode (video and sound) reads pass 2 through the VRAM unload; nothing else reads pass 1 but the split",
          dec and all(g[k]["inputs"]["samples"] == ["h16free", 0] for k in dec) and g["h16free"]["inputs"]["any_input"] == ["h16samp", 0]
          and [k for k, v in g.items() for x in (v.get("inputs") or {}).values() if x == [f["sampler"], 0]] == ["h16sep"])
    check(f"{name}: the notes say each part", any(n.startswith("16 GB mode: pass 1 =") for n in notes) and any(n.startswith("16 GB mode: pass 2 =") for n in notes)
          and any("unloaded" in n for n in notes), notes)

g0 = load("ref2va.json")
g, notes = H.apply(g0, {"scale": 1.5, "have": {}, "files": {}, "turbo": True})
check("a ComfyUI with none of the nodes / files: the graph is left as it was, each missing part named with what to install",
      json.dumps(g, sort_keys=True) == json.dumps(g0, sort_keys=True) and any("DENO custom nodes" in n for n in notes)
      and any("Acc 8-step LoRA" in n for n in notes) and any("latent upscale pass left out" in n for n in notes), notes)
have = dict(ALL, DenoTextEncoderUnload=False, BlockSparseAttention=False, VRAM_Debug=False)
g, notes = H.apply(g0, dict(OPT, have=have, kitchen=False))
check("…without the DENO nodes / Sol attention / KJNodes: no unload, no sparse attention, no VRAM node - pass 2 still runs; no kitchen when ComfyUI lacks it",
      "h16teu" not in g and "h16p2sp" not in g and "h16free" not in g and "h16samp" in g and not any(k.endswith("be") and k.startswith("h16") for k in g) and not dangling(g))
g, notes = H.apply(g0, dict(OPT, upscale_stage=True))
check("the ⚙ upscaler stage asked for: 16 GB mode keeps pass 1 + the unload and leaves the upscale to the stage", "h16samp" not in g and "h16teu" in g and any("⚙ upscaler" in n for n in notes))
g, notes = H.apply(g0, dict(OPT, scale=1))
check("upscale x1: no second pass", "h16samp" not in g and any("x1" in n for n in notes))
g, notes = H.apply(g0, dict(OPT, turbo=False))
check("pass 1 in 8 steps off: the graph's own pass 1 (steps / sampler / turbo switch) stays; pass 2 still runs",
      g[H.find(g0)["guider"]]["inputs"]["model"] == g0[H.find(g0)["guider"]]["inputs"]["model"] and "h16samp" in g)
f3 = load("fasth3_omni_r2v.json")
g, notes = H.apply(f3, OPT)
check("a FastH3 Omni graph (sparse attention already, 8 steps) is left alone", json.dumps(g, sort_keys=True) == json.dumps(f3, sort_keys=True) and "FastH3" in notes[0], notes)
check("the upscale is clamped to 1.0-2.0", H.clamp_scale(5) == 2.0 and H.clamp_scale(0.2) == 1.0 and H.clamp_scale("x") == H.DEFAULT_SCALE)
w = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("the video worker applies it for local renders (not RunPod), after FastH3, before the ⚙ upscaler stage; auto = a card of 16 GB or less",
      "import h3_16gb as _h16" in w and w.index("o16 = _vram16_opts(") < w.index('if params.get("upscale_stage"):        # 2.312.0')
      and w.index("if _f3 is not None and _f3.detect(g)") < w.index("o16 = _vram16_opts(") and "gb > 16.5" in w)
print(f"\n{P} passed, {F} failed")
sys.exit(1 if F else 0)
