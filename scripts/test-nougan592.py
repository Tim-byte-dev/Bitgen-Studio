#!/usr/bin/env python3
"""bitGen Studio — 2.592.0 units: Nougan_Nodes' 🎭 regional character LoRA (scripts/comfy_regions.py) and ⏱ Prompt Relay
(scripts/prompt_relay.py, misc/ltx_worker.py). Run: python3 scripts/test-nougan592.py

Tim: "lets just add the regional character lora and prompt relay".
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "misc"))
import comfy_image as C                                     # noqa: E402
import comfy_regions as R                                   # noqa: E402
import prompt_relay as P                                    # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:1200] if got is not None else ""))


def wf(name):
    return C.load_workflow(str(ROOT / "comfy_workflows" / name))


def readers(g, nid):
    return sorted((v["class_type"], k) for v in g.values() for k, x in (v.get("inputs") or {}).items()
                  if isinstance(x, list) and len(x) == 2 and str(x[0]) == str(nid))


# ============================== 🎭 regional character LoRAs ==============================
Z = [{"x": 0, "y": 0, "w": 0.5, "h": 1, "text": "Tim, a man in a blue coat", "lora": "chars\\tim.safetensors", "lora_strength": 0.9},
     {"x": 0.5, "y": 0, "w": 0.5, "h": 1, "text": "Ana, a woman in red", "lora": "chars/ana.safetensors"},
     {"x": 0.3, "y": 0.7, "w": 0.3, "h": 0.3, "text": "a small dog"}]
P0 = {"prompt": "two friends in a park", "width": 1024, "height": 768, "seed": 3}

g0 = wf("img_flux2_9b_t2i_verified.json")
g, rep = C.patch(g0, {"name": "t"}, dict(P0, regions=Z))
ch = [k for k, v in g.items() if v["class_type"] == R.CHAR_NODE]
n = g[ch[0]]["inputs"] if ch else {}
rg = json.loads(n.get("regions") or "{}")
check("FLUX.2: the boxes with a 🎭 LoRA go to ONE NouganRegionalCharacterLoRA - LoRA A / B as ComfyUI names them (forward "
      "slashes), their strengths, the node's feather; regions = {global: the scene, regions: [char a|b, x, y, w, h, text]}",
      len(ch) == 1 and n["lora_a"] == "chars/tim.safetensors" and n["lora_b"] == "chars/ana.safetensors" and n["strength_a"] == 0.9
      and n["strength_b"] == 1.0 and n["feather"] == R.CHAR_FEATHER and rg.get("global") == "two friends in a park"
      and [(r["char"], r["x"], r["w"], r["text"][:3]) for r in rg.get("regions", [])] == [("a", 0.0, 0.5, "Tim"), ("b", 0.5, 0.5, "Ana")], (n, rg))
guider = [k for k, v in g.items() if v["class_type"] == "CFGGuider"][0]
check("...its MODEL into the guider (after the style's LoRAs), its CONDITIONING into the guider's positive; the "
      "ConditioningZeroOut negative still reads the scene's own encoder; the dog's box (no LoRA) is an area prompt on top",
      g[guider]["inputs"]["model"] == [ch[0], 0] and readers(g, ch[0]) == [("CFGGuider", "model"), ("ConditioningCombine", "conditioning_1")]
      and n["model"] == g0[guider]["inputs"]["model"] and sum(1 for l in rep if l.startswith("zone ")) == 1
      and any("LoRA A chars/tim.safetensors @ 0.9 in box(es) 1; LoRA B chars/ana.safetensors @ 1 in box(es) 2" in l for l in rep), (readers(g, ch[0]), rep[-3:]))
check("...its clip = the scene encoder's CLIP (the CLIPLoader), not the Primitive holding the words",
      n["clip"] == g0[R.encoder(g0, g0[guider]["inputs"]["positive"][0])]["inputs"]["clip"], n["clip"])

ge, repe = C.patch(wf("img_flux2_9b_edit_verified.json"), {"name": "t"}, dict(P0, regions=Z[:2], images=["a.png"]))
che = [k for k, v in ge.items() if v["class_type"] == R.CHAR_NODE]
check("FLUX.2 edit: the node's conditioning feeds the ReferenceLatent chain (the picture is still added after it), the model the guider",
      len(che) == 1 and ("ReferenceLatent", "conditioning") in readers(ge, che[0]) and ("CFGGuider", "model") in readers(ge, che[0]), readers(ge, che[0]) if che else ge)
gq, repq = C.patch(wf("img_qwen21_edit.json"), {"name": "t"}, dict(P0, regions=Z[:2], images=["a.png"]))
chq = [k for k, v in gq.items() if v["class_type"] == R.CHAR_NODE]
check("Qwen Image Edit: its encoder takes the picture (TextEncodeQwenImageEdit*) - kept; only the node's MODEL is used and "
      "both boxes' words go on as area prompts (said)",
      len(chq) == 1 and readers(gq, chq[0]) == [("KSampler", "model")] and sum(1 for l in repq if l.startswith("zone ")) == 2
      and any("keeps the picture" in l for l in repq), (readers(gq, chq[0]) if chq else None, repq[-3:]))
for f in ("img_krea2_turbo_t2i.json", "img_flux3_klein_t2i.json", "img_sdxl_t2i.json"):
    gk, _ = C.patch(wf(f), {"name": "t"}, dict(P0, regions=Z[:1]))
    ck = [k for k, v in gk.items() if v["class_type"] == R.CHAR_NODE]
    check(f"{f}: one 🎭 box = the node with LoRA B = A at strength 0 (only region a), wired into the sampler's model + positive",
          len(ck) == 1 and gk[ck[0]]["inputs"]["strength_b"] == 0.0 and gk[ck[0]]["inputs"]["lora_b"] == gk[ck[0]]["inputs"]["lora_a"]
          and any(k == "model" for _c, k in readers(gk, ck[0])) and len(readers(gk, ck[0])) >= 2, readers(gk, ck[0]) if ck else None)
try:
    C.patch(wf("img_flux2_9b_t2i_verified.json"), {"name": "t"}, dict(P0, regions=Z[:2] + [dict(Z[2], lora="chars/third.safetensors")])); ok = False
except C.PatchError as e:
    ok = "2 different character LoRAs at most" in str(e)
check("three different character LoRAs = refused in words (the node has A and B)", ok)
gn, repn = C.patch(wf("img_flux2_9b_t2i_verified.json"), {"name": "t"}, dict(P0, regions=[dict(Z[2])]))
check("zones without a 🎭 LoRA work as before (area prompts, no Nougan node)", not any(v["class_type"] == R.CHAR_NODE for v in gn.values())
      and sum(1 for l in repn if l.startswith("zone ")) == 1)

# ============================== ⏱ Prompt Relay ==============================
rel = P.parse("cinematic, 35mm film, a red fox in the snow\n[0-2s] the fox sniffs the ground\n[2s] it looks up | twice\n"
              "  [3.5 - 9 s]  it runs off\n[4-5] \n")
check("parse: untimed lines = the global prompt; [0-2s] / [2s] / [3.5 - 9 s] = timed lines sorted by start; an empty one dropped",
      rel and rel["global"] == "cinematic, 35mm film, a red fox in the snow"
      and [(s["start"], s["end"], s["text"]) for s in rel["segments"]] == [(0.0, 2.0, "the fox sniffs the ground"), (2.0, None, "it looks up | twice"), (3.5, 9.0, "it runs off")], rel)
check("parse: nothing timed = None (an ordinary prompt - no Prompt Relay)", P.parse("a fox\nin the snow") is None and P.parse("") is None)
check("lengths: each line from its start to the next one's, the first from 0, the last to the end of the clip (frames at the fps)",
      P.lengths(rel["segments"], 5, 24) == [48, 36, 36] and sum(P.lengths(rel["segments"], 5, 24)) == 120
      and P.lengths([{"start": 1}, {"start": 30}], 5, 25) == [125] and P.lengths([{"start": 0.4}, {"start": 0.42}], 2, 24) == [10, 38], P.lengths(rel["segments"], 5, 24))
check("flat: one prompt (the global words, then each line's)", P.flat(rel) == "cinematic, 35mm film, a red fox in the snow. the fox sniffs the ground. it looks up | twice. it runs off", P.flat(rel))

T = Path(tempfile.mkdtemp(prefix="nougan592_"))
(T / "oi.json").write_text((ROOT / "scripts" / "fixtures" / "ltx25_object_info.json").read_text(encoding="utf-8"))
FILES = {"unet": ["ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors"], "gguf": [],
         "vae": ["ltx-2.5-video-vae-bf16.safetensors", "ltx-2.5-audio-vae-bf16.safetensors"],
         "clip": ["gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors"], "upscale": ["ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"]}
SPEC = {"input": {"required": {"model": ["MODEL"], "clip": ["CLIP"], "latent": ["LATENT"], "global_prompt": ["STRING", {"multiline": True}],
                               "local_prompts": ["STRING", {"multiline": True}], "segment_lengths": ["STRING", {"default": ""}],
                               "epsilon": ["FLOAT", {"default": 0.001}], "max_frames": ["INT", {"default": 0}]},
                  "optional": {"relay_options": ["RELAY_OPTIONS"]}}, "output": ["MODEL", "CONDITIONING"]}
for mode, f in (("t2v", "ltx25_official_t2v.json"), ("i2v", "ltx25_official_i2v.json")):
    (T / "o.json").write_text(json.dumps({"mode": mode, "prompt": "GLOBAL", "seconds": 5, "width": 640, "height": 384, "seed": 7,
                                          "fps": 24, "images": ["a.png"], "prefix": "x", "lists": FILES}))
    r = subprocess.run(["node", str(ROOT / "scripts" / "ltx_convert.js"), "oconvert", str(ROOT / "comfy_workflows" / f), str(T / "o.json"),
                        str(T / "oi.json"), str(T / f"api_{mode}.json")], capture_output=True, text=True, timeout=60)
    g = json.loads((T / f"api_{mode}.json").read_text())["graph"] if r.returncode == 0 else {}
    fp = P.first_pass(g)
    g2, notes = P.splice(g, rel, 5, 24, SPEC)
    rid = [k for k, v in g2.items() if v["class_type"] == P.NODE]
    ri = g2[rid[0]]["inputs"] if rid else {}
    guiders = {k: v for k, v in g2.items() if v["class_type"] == "LTXVDualCFGGuider"}
    first = fp[0][0] if fp else None
    second = [k for k in guiders if k != first]
    check(f"LTX 2.5 {mode} (Comfy-Org's two-stage template): the FIRST pass is the sampler on the empty video latent; the "
          "detail pass (through LTXVLatentUpsampler) is not", len(fp) == 1 and g[fp[0][1]]["class_type"] == "EmptyLTXVLatentVideo" and len(second) == 1, fp)
    check(f"{mode}: PromptRelayEncode - model = the first pass's, clip = the positive encoder's, latent = the empty video latent, "
          "global / 'a | b | c' (a '|' in a line becomes '/') / '48,36,36' / epsilon; a widget we do not set gets its default",
          ri.get("model") == g[first]["inputs"]["model"] and ri.get("latent") == [fp[0][1], 0] and ri.get("global_prompt") == rel["global"]
          and ri.get("local_prompts") == "the fox sniffs the ground | it looks up / twice | it runs off" and ri.get("segment_lengths") == "48,36,36"
          and ri.get("epsilon") == P.EPSILON and ri.get("max_frames") == 0 and "relay_options" not in ri, ri)
    cond = guiders[first]["inputs"]["positive"]
    check(f"{mode}: the first pass's guider: model = the relay's MODEL; positive / negative = its OWN copy of LTXVConditioning whose "
          "positive is the relay's CONDITIONING (negative + frame rate kept); the detail pass keeps the model and the global prompt",
          guiders[first]["inputs"]["model"] == [rid[0], 0] and g2[cond[0]]["class_type"] == "LTXVConditioning" and cond[0] != g[first]["inputs"]["positive"][0]
          and g2[cond[0]]["inputs"]["positive"] == [rid[0], 1] and g2[cond[0]]["inputs"]["negative"] == g[g[first]["inputs"]["positive"][0]]["inputs"]["negative"]
          and guiders[second[0]]["inputs"] == g[second[0]]["inputs"] and any("detail pass" in x for x in notes), (guiders, notes))
try:
    P.splice({"1": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "latent_image": ["4", 0]}},
              "4": {"class_type": "EmptyLatentImage", "inputs": {}}}, rel, 5, 24, SPEC); ok = False
except ValueError as e:
    ok = "EmptyLTXVLatentVideo" in str(e)
check("splice: a graph with no empty LTX video latent = a ValueError in words (the worker then renders one prompt)", ok)
try:
    P.splice(g, rel, 5, 24, {"input": {"required": dict(SPEC["input"]["required"], secret=["STRING"])}}); ok = False
except ValueError as e:
    ok = "secret" in str(e)
check("splice: a newer node with a required input we cannot fill = refused, never queued half-wired", ok)

# Tim's canvas: the guider behind a pass-through (easy cleanGpuUsed), the empty latent behind LTXVImgToVideoInplaceKJ
CANVAS = {
    "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "ltx.gguf"}},
    "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "g.safetensors"}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": "a fox"}},
    "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": "blurry"}},
    "5": {"class_type": "LTXVConditioning", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "frame_rate": 24}},
    "6": {"class_type": "LTXVDualCFGGuider", "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 1]}},
    "7": {"class_type": "easy cleanGpuUsed", "inputs": {"anything": ["6", 0]}},
    "8": {"class_type": "EmptyLTXVLatentVideo", "inputs": {"width": 640, "height": 384, "length": 97, "batch_size": 1}},
    "9": {"class_type": "LTXVImgToVideoInplaceKJ", "inputs": {"latent": ["8", 0]}},
    "10": {"class_type": "easy cleanGpuUsed", "inputs": {"anything": ["9", 0]}},
    "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"guider": ["7", 0], "latent_image": ["10", 0]}},
    "12": {"class_type": "VHS_VideoCombine", "inputs": {"images": ["11", 0]}}}
gc, nc = P.splice(CANVAS, P.parse("a fox\n[0-2s] sniffs\n[2-4s] looks up"), 4, 24, None)
rc = [k for k, v in gc.items() if v["class_type"] == P.NODE]
check("Tim's canvas shape: the guider found through easy cleanGpuUsed, the empty latent through LTXVImgToVideoInplaceKJ; a "
      "single pass = the guider gets the relay's model + its own LTXVConditioning copy",
      len(rc) == 1 and gc["6"]["inputs"]["model"] == [rc[0], 0] and gc[gc["6"]["inputs"]["positive"][0]]["inputs"]["positive"] == [rc[0], 1]
      and gc[rc[0]]["inputs"]["latent"] == ["8", 0] and gc[rc[0]]["inputs"]["segment_lengths"] == "48,48", (gc.get(rc[0]) if rc else None, nc))

# the worker's two steps (a fake ComfyUI)
import ltx_worker as W                                       # noqa: E402
said = []
W.say = lambda s: said.append(s)


class FakeComfy:
    def __init__(self, has):
        self.has = has

    def object_info(self, base, ct):
        return {ct: SPEC} if self.has and ct == P.NODE else {}


W._comfy = FakeComfy(False)
pr = {"prompt": "a fox\n[0-2s] sniffs\n[2s] looks up", "seconds": 4, "fps": 24}
r0, s0 = W.relay_prepare("http://x", pr)
check("worker: no Prompt Relay in ComfyUI = one prompt from all the lines, said (Settings ▸ Add-ons ▸ Nougan Nodes)",
      r0 is None and pr["prompt"] == "a fox. sniffs. looks up" and any("Nougan Nodes" in x for x in said), (pr, said))
W._comfy = FakeComfy(True)
pr = {"prompt": "a fox\n[0-2s] sniffs\n[2s] looks up", "seconds": 4, "fps": 24}
r1, s1 = W.relay_prepare("http://x", pr)
check("worker: with it = the graph gets the global lines (the node encodes the timed ones)", r1 and s1 and pr["prompt"] == "a fox")
g3 = W.relay_apply(json.loads((T / "api_t2v.json").read_text())["graph"], r1, s1, pr)
check("worker: relay_apply wires it in + prunes; the log names the lines", any(v["class_type"] == P.NODE for v in g3.values())
      and any("⏱ Prompt Relay" in x and "sniffs" in x for x in said))
gbad = {"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "a fox", "clip": ["2", 0]}}, "9": {"class_type": "SaveVideo", "inputs": {}}}
g4 = W.relay_apply(gbad, r1, s1, pr)
check("worker: a graph it cannot go into = the timed lines back in the prompt as one (said)", g4["1"]["inputs"]["text"] == "a fox. sniffs. looks up"
      and any("could not be wired" in x for x in said))
pr2 = {"prompt": "just a fox", "seconds": 4}
check("worker: an ordinary prompt is left alone", W.relay_prepare("http://x", pr2) == (None, None) and pr2["prompt"] == "just a fox")
src = (ROOT / "misc" / "ltx_worker.py").read_text(encoding="utf-8")
check("worker: both LTX paths (Comfy-Org's templates + Tim's canvas) run relay_apply before the queue; relay_prepare before the uploads",
      src.count("graph = relay_apply(graph,") == 2 and src.index("relay_prepare(base, params)") < src.index("# 1. uploads"))

# the page's parser says the same
node = subprocess.run(["node", "-e", "const R=require(process.argv[1]);const t=require('fs').readFileSync(0,'utf8');process.stdout.write(JSON.stringify(R.parse(t)))",
                       str(ROOT / "static" / "promptrelay.js")], input="cinematic, 35mm film, a red fox in the snow\n[0-2s] the fox sniffs the ground\n[2s] it looks up | twice\n  [3.5 - 9 s]  it runs off\n[4-5] \n",
                      capture_output=True, text=True, timeout=30)
js = json.loads(node.stdout or "null")
check("static/promptrelay.js parses the same prompt the same way (the ⏱ button's twin)", js == json.loads(json.dumps(rel)), (js, rel))

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: FAIL" if FAIL else "RESULT: PASS")
sys.exit(1 if FAIL else 0)
