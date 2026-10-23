#!/usr/bin/env python3
"""Unit tests for scripts/comfy_image.py — patching an exported ComfyUI
workflow to render an image style. Run: python3 scripts/test-comfyimage.py

The graphs below are miniature versions of the two shapes ComfyUI actually
produces: the classic KSampler graph (SDXL and most checkpoints) and the split
guider graph (FLUX: RandomNoise + BasicScheduler + SamplerCustomAdvanced, with
no negative prompt at all). If a change makes either of these stop working, it
will stop working on the real thing too.
"""
import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comfy_image as C                                     # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


def raises(name, fn, needle=None):
    try:
        fn()
    except C.PatchError as e:
        if needle and needle.lower() not in str(e).lower():
            check(name, False, f"wrong message: {e}")
        else:
            check(name, True)
        return
    except Exception as e:                                  # noqa: BLE001
        check(name, False, f"raised {type(e).__name__}: {e}")
        return
    check(name, False, "did not raise")


# ------------------------------------------------------------- test graphs
KSAMPLER = {
    "1": {"class_type": "CheckpointLoaderSimple",
          "inputs": {"ckpt_name": "template_sdxl.safetensors"}},
    "2": {"class_type": "CLIPTextEncode",
          "inputs": {"text": "template positive", "clip": ["1", 1]}},
    "3": {"class_type": "CLIPTextEncode",
          "inputs": {"text": "template negative", "clip": ["1", 1]}},
    "4": {"class_type": "EmptyLatentImage",
          "inputs": {"width": 512, "height": 512, "batch_size": 1}},
    "5": {"class_type": "KSampler",
          "inputs": {"seed": 1, "steps": 20, "cfg": 8.0, "denoise": 1.0,
                     "sampler_name": "euler", "scheduler": "normal",
                     "model": ["1", 0], "positive": ["2", 0],
                     "negative": ["3", 0], "latent_image": ["4", 0]}},
    "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
    "7": {"class_type": "SaveImage",
          "inputs": {"filename_prefix": "ComfyUI", "images": ["6", 0]}},
}

# FLUX shape: no negative prompt anywhere, sampling split across three nodes,
# and the prompt reaching the guider through a FluxGuidance node.
FLUX = {
    "10": {"class_type": "UNETLoader",
           "inputs": {"unet_name": "flux1-dev.safetensors", "weight_dtype": "default"}},
    "11": {"class_type": "DualCLIPLoader",
           "inputs": {"clip_name1": "clip_l.safetensors",
                      "clip_name2": "t5xxl.safetensors", "type": "flux"}},
    "12": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
    "13": {"class_type": "CLIPTextEncode",
           "inputs": {"text": "template prompt", "clip": ["11", 0]}},
    "14": {"class_type": "FluxGuidance",
           "inputs": {"guidance": 3.5, "conditioning": ["13", 0]}},
    "15": {"class_type": "BasicGuider", "inputs": {"model": ["10", 0], "conditioning": ["14", 0]}},
    "16": {"class_type": "RandomNoise", "inputs": {"noise_seed": 42}},
    "17": {"class_type": "BasicScheduler",
           "inputs": {"scheduler": "simple", "steps": 20, "denoise": 1.0, "model": ["10", 0]}},
    "18": {"class_type": "EmptySD3LatentImage",
           "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
    "19": {"class_type": "SamplerCustomAdvanced",
           "inputs": {"noise": ["16", 0], "guider": ["15", 0],
                      "sampler": ["20", 0], "sigmas": ["17", 0], "latent_image": ["18", 0]}},
    "20": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
    "21": {"class_type": "VAEDecode", "inputs": {"samples": ["19", 0], "vae": ["12", 0]}},
    "22": {"class_type": "SaveImage", "inputs": {"filename_prefix": "flux", "images": ["21", 0]}},
}

STYLE = {"id": "st_1", "name": "T", "arch": "sdxl", "engine": "comfy",
         "model": "", "vae": "", "te": [], "loras": []}


def val(g, nid, key):
    return g[nid]["inputs"][key]


# ------------------------------------------------------------ role discovery
r = C.roles(KSAMPLER)
check("KSampler graph: the sampler is found by its positive+negative pair",
      r["sampler"] == "5", r["sampler"])
check("KSampler graph: positive and negative prompts are told apart",
      r["positive"] == "2" and r["negative"] == "3", r)
check("KSampler graph: the latent is found through the sampler", r["latent"] == "4", r)
check("KSampler graph: seed/steps/cfg nodes found", r["seed"] == ["5"]
      and r["steps"] == ["5"] and r["cfg"] == ["5"], r)
check("KSampler graph: the save node is found", r["save"] == ["7"], r)

r = C.roles(FLUX)
check("FLUX graph: the prompt is traced through FluxGuidance to the text node",
      r["positive"] == "13", r["positive"])
check("FLUX graph: no negative prompt is invented where none exists",
      r["negative"] is None, r["negative"])
check("FLUX graph: noise_seed counts as a seed", r["seed"] == ["16"], r["seed"])
check("FLUX graph: steps found on the scheduler, not the sampler",
      r["steps"] == ["17"], r["steps"])
check("FLUX graph: a graph with no cfg widget reports none", r["cfg"] == [], r["cfg"])
check("FLUX graph: the latent is found", r["latent"] == "18", r["latent"])
check("FLUX graph: the model source is traced through the guider",
      r["model_src"] == "10", r["model_src"])
check("FLUX graph: the two text encoders are found in slot order",
      [k for _n, k in r["loaders"]["te"]] == ["clip_name1", "clip_name2"],
      r["loaders"].get("te"))

# ---------------------------------------------------------------- patching
g, rep = C.patch(KSAMPLER, STYLE, {"prompt": "a lighthouse", "seed": 7,
                                   "steps": 12, "cfg": 6.5,
                                   "width": 768, "height": 512, "batch": 3})
check("the prompt reaches the positive node", val(g, "2", "text") == "a lighthouse", g["2"])
check("the template's negative is left alone when none was given",
      val(g, "3", "text") == "template negative", g["3"])
check("seed, steps and cfg are set", val(g, "5", "seed") == 7
      and val(g, "5", "steps") == 12 and val(g, "5", "cfg") == 6.5, g["5"])
check("width/height reach the latent", val(g, "4", "width") == 768
      and val(g, "4", "height") == 512, g["4"])
check("a batch is ONE run with batch_size, not N runs",
      val(g, "4", "batch_size") == 3, g["4"])
check("the caller's graph is never mutated",
      KSAMPLER["2"]["inputs"]["text"] == "template positive", KSAMPLER["2"])
check("the patch is reported for the log", any("prompt" in x for x in rep), rep)

g, _ = C.patch(KSAMPLER, {**STYLE, "negative": "blurry"}, {"prompt": "x"})
check("a style's negative prompt is used", val(g, "3", "text") == "blurry", g["3"])

g, _ = C.patch(FLUX, STYLE, {"prompt": "a fox", "seed": 5, "steps": 8})
check("FLUX: the prompt reaches the text node", val(g, "13", "text") == "a fox", g["13"])
check("FLUX: noise_seed is set", val(g, "16", "noise_seed") == 5, g["16"])
check("FLUX: steps reach the scheduler", val(g, "17", "steps") == 8, g["17"])
# cfg is NOT the same number as FLUX guidance; writing 1.0 into guidance would
# flatten the image, so guidance stays as the template has it.
g, _ = C.patch(FLUX, {**STYLE, "cfg": 1.0}, {"prompt": "x"})
check("FLUX: cfg does NOT overwrite FluxGuidance", val(g, "14", "guidance") == 3.5, g["14"])

# an absent value must leave the template's own setting standing
g, _ = C.patch(KSAMPLER, {**STYLE, "steps": None}, {"prompt": "x"})
check("an unset value leaves the template's own value alone",
      val(g, "5", "steps") == 20, g["5"])
# ...but a 0 is a value, not an absence
g, _ = C.patch(KSAMPLER, STYLE, {"prompt": "x", "cfg": 0})
check("a cfg of 0 is applied, not treated as absent", val(g, "5", "cfg") == 0.0, g["5"])
g, _ = C.patch(KSAMPLER, STYLE, {"prompt": "x", "seed": 0})
check("a seed of 0 is applied", val(g, "5", "seed") == 0, g["5"])
# A negative seed means "random". This test USED to assert that the template's
# own seed was left alone -- which is what made every render byte-identical,
# because a template carries whatever seed its author last used. Leaving the
# export's value is right for steps and cfg; for a seed it defeats the entire
# point of generating again. The check now pins the INTENT.
g, _ = C.patch(KSAMPLER, STYLE, {"prompt": "x", "seed": -1})
check("a seed of -1 draws a real random seed rather than keeping the template's",
      isinstance(val(g, "5", "seed"), int) and val(g, "5", "seed") != 1, g["5"])
g2, _ = C.patch(KSAMPLER, STYLE, {"prompt": "x", "seed": -1})
check("...and a different one on the next run",
      val(g, "5", "seed") != val(g2, "5", "seed"),
      [val(g, "5", "seed"), val(g2, "5", "seed")])

# ---------------------------------------------------------------- overrides
g, _ = C.patch(KSAMPLER, {**STYLE, "model": "my_sdxl.safetensors"}, {"prompt": "x"})
check("a model override reaches the checkpoint loader",
      val(g, "1", "ckpt_name") == "my_sdxl.safetensors", g["1"])
g, _ = C.patch(FLUX, {**STYLE, "model": "m.gguf", "vae": "v.sft",
                      "te": ["a.sft", "b.sft"]}, {"prompt": "x"})
check("overrides reach unet/vae/both text encoders in slot order",
      val(g, "10", "unet_name") == "m.gguf" and val(g, "12", "vae_name") == "v.sft"
      and val(g, "11", "clip_name1") == "a.sft"
      and val(g, "11", "clip_name2") == "b.sft", [g["10"], g["11"], g["12"]])
g, _ = C.patch(FLUX, {**STYLE, "te": ["", "only_second.sft"]}, {"prompt": "x"})
check("an empty override slot is skipped, not blanked",
      val(g, "11", "clip_name1") == "clip_l.safetensors"
      and val(g, "11", "clip_name2") == "only_second.sft", g["11"])
# An override that cannot be applied is FATAL: rendering with the template's
# model instead produces a perfectly good picture of the wrong thing.
raises("overriding a VAE a workflow does not load is refused",
       lambda: C.patch(KSAMPLER, {**STYLE, "vae": "x.sft"}, {"prompt": "x"}),
       "no vae loader")
raises("overriding more text encoders than the workflow has is refused",
       lambda: C.patch(KSAMPLER, {**STYLE, "te": ["a", "b"]}, {"prompt": "x"}),
       "text-encoder")

# -------------------------------------------------------------- LoRA stacks
st = {**STYLE, "loras": [{"path": "flux/grain.safetensors", "weight": 0.75},
                         {"path": "face.safetensors", "weight": 0}]}
g, rep = C.patch(KSAMPLER, st, {"prompt": "x"})
loras = {n: v for n, v in g.items() if "Lora" in v["class_type"]}
check("one node is built per LoRA", len(loras) == 2, list(loras))
check("a LoRA with a CLIP available uses the full LoraLoader",
      all(v["class_type"] == "LoraLoader" for v in loras.values()), loras)
check("the ComfyUI lora name keeps its subfolder and extension",
      any(v["inputs"]["lora_name"] == "flux/grain.safetensors" for v in loras.values()),
      loras)
# THE TRAP: 0 is "off but still in the stack", not "default 1.0"
check("a LoRA weight of 0 stays 0",
      any(v["inputs"]["strength_model"] == 0 for v in loras.values()), loras)
check("a LoRA weight of 0.75 stays 0.75",
      any(v["inputs"]["strength_model"] == 0.75 for v in loras.values()), loras)
check("the sampler now takes its model THROUGH the lora chain",
      g["5"]["inputs"]["model"] != ["1", 0], g["5"]["inputs"]["model"])
check("both text encoders take their clip through the chain too",
      g["2"]["inputs"]["clip"] != ["1", 1] and g["3"]["inputs"]["clip"] != ["1", 1],
      [g["2"]["inputs"], g["3"]["inputs"]])
# The chain must be a chain, not two nodes both reading the checkpoint.
ids = sorted(loras, key=lambda k: int(k))
check("the second LoRA feeds off the first, forming a chain",
      loras[ids[1]]["inputs"]["model"] == [ids[0], 0], loras)
check("no lora node was rewired to its own output",
      all(v["inputs"]["model"] != [n, 0] for n, v in loras.items()), loras)
check("VAEDecode still reads the ORIGINAL vae, not a lora output",
      g["6"]["inputs"]["vae"] == ["1", 2], g["6"])

# FLUX has a CLIP too, so it also gets full LoraLoaders
g, _ = C.patch(FLUX, {**STYLE, "loras": [{"path": "x.safetensors", "weight": 1}]},
               {"prompt": "x"})
lo = [v for v in g.values() if "Lora" in v["class_type"]]
check("FLUX: the guider takes its model through the lora",
      g["15"]["inputs"]["model"] != ["10", 0] and len(lo) == 1, g["15"])
check("FLUX: the scheduler's model input is rewired too (both consumers)",
      g["17"]["inputs"]["model"] == g["15"]["inputs"]["model"], g["17"])

# A graph with no CLIP anywhere must use the model-only loader rather than
# inventing a clip link that would fail validation.
NOCLIP = copy.deepcopy(KSAMPLER)
NOCLIP["2"]["inputs"].pop("clip")
NOCLIP["3"]["inputs"].pop("clip")
g, _ = C.patch(NOCLIP, {**STYLE, "loras": [{"path": "a.safetensors"}]}, {"prompt": "x"})
check("a graph with no CLIP uses LoraLoaderModelOnly",
      any(v["class_type"] == "LoraLoaderModelOnly" for v in g.values()), None)
check("a LoRA with no weight defaults to 1",
      any(v["inputs"].get("strength_model") == 1.0 for v in g.values()
          if "Lora" in v["class_type"]), None)
check("an empty LoRA path adds no node",
      not any("Lora" in v["class_type"] for v in
              C.patch(KSAMPLER, {**STYLE, "loras": [{"path": "  "}]}, {"prompt": "x"})[0].values()),
      None)

# ------------------------------------------------------------ refusals
AMBIG = {"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "a"}},
         "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "b"}},
         "3": {"class_type": "SaveImage", "inputs": {"images": ["1", 0]}}}
raises("two unwired prompts are refused rather than guessed at",
       lambda: C.patch(AMBIG, STYLE, {"prompt": "x"}), "positive")
raises("a workflow with no text node at all is refused",
       lambda: C.patch({"1": {"class_type": "SaveImage", "inputs": {"images": ["2", 0]}}},
                       STYLE, {"prompt": "x"}), "no text prompt")
raises("a workflow that saves nothing is refused",
       lambda: C.patch({"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "a"}}},
                       STYLE, {"prompt": "x"}), "never saves")

# ---------------------------------------------------------- workflow loading
import tempfile                                             # noqa: E402
d = tempfile.mkdtemp()
p = os.path.join(d, "ui_export.json")
with open(p, "w", encoding="utf-8") as fh:
    json.dump({"nodes": [], "links": [], "version": 0.4}, fh)
raises("a UI workflow export is named as the wrong format",
       lambda: C.load_workflow(p), "export (api)")
p2 = os.path.join(d, "api.json")
with open(p2, "w", encoding="utf-8") as fh:
    json.dump(KSAMPLER, fh)
check("a real Export (API) file loads", len(C.load_workflow(p2)) == len(KSAMPLER), None)
p3 = os.path.join(d, "junk.json")
with open(p3, "w", encoding="utf-8") as fh:
    json.dump({"a": {"inputs": {}}}, fh)
raises("a json file that is not a workflow is named as such",
       lambda: C.load_workflow(p3), "class_type")


# =====================================================================
# THE SHIPPED FLUX.2 KLEIN 9B TEMPLATES
# Node types, widget names and defaults came from ComfyUI's own published
# template, so these tests are checking OUR handling of a real graph shape,
# not a shape invented to make the code look right.
# =====================================================================
HERE = os.path.dirname(os.path.abspath(__file__))
WF = os.path.join(HERE, "..", "comfy_workflows")

for fn, distilled in (("img_flux2_klein_9b_t2i.json", True),
                      ("img_flux2_klein_9b_ckpt_t2i.json", True),
                      ("img_flux2_klein_base_9b_t2i.json", False)):
    g = C.load_workflow(os.path.join(WF, fn))
    label = "klein 9B distilled" if distilled else "klein 9B base"
    r = C.roles(g)
    check(f"{label}: the prompt node is found through CFGGuider",
          r["positive"] == "74", r["positive"])
    check(f"{label}: the latent is found across the split sampler",
          r["latent"] == "66", r["latent"])
    # FLUX.2 puts positive/negative on CFGGuider and latent_image on the separate
    # SamplerCustomAdvanced, so "the sampler" is two nodes and a naive walk finds
    # no latent at all.
    check(f"{label}: seed/steps/cfg land on three DIFFERENT nodes",
          r["seed"] == ["73"] and r["steps"] == ["62"] and r["cfg"] == ["63"], r)
    check(f"{label}: Flux2Scheduler counts as a size node alongside the latent",
          set(r["size_nodes"]) == {"62", "66"}, r["size_nodes"])
    check(f"{label}: all four LoRA slots are found in chain order",
          r["lora_nodes"] == ["101", "102", "103", "104"], r["lora_nodes"])
    check(f"{label}: the model is traced through the LoRA chain",
          r["model_src"] == "104", r["model_src"])

    st = {"id": "s", "name": label, "arch": "flux2klein9b", "engine": "comfy",
          "model": "", "vae": "", "te": [], "loras": []}
    g2, rep = C.patch(g, st, {"prompt": "a barn", "seed": 5, "steps": 6,
                              "width": 768, "height": 512, "batch": 2})
    check(f"{label}: the prompt reaches node 74", val(g2, "74", "text") == "a barn", g2["74"])
    check(f"{label}: size reaches BOTH the latent and the scheduler",
          val(g2, "66", "width") == 768 and val(g2, "62", "width") == 768, [g2["66"], g2["62"]])
    check(f"{label}: batch_size goes on the latent only",
          val(g2, "66", "batch_size") == 2 and "batch_size" not in g2["62"]["inputs"], g2["66"])
    check(f"{label}: steps reach the scheduler, seed the noise node",
          val(g2, "62", "steps") == 6 and val(g2, "73", "noise_seed") == 5, [g2["62"], g2["73"]])
    # WITH NO LORAS SET, ALL FOUR SLOTS MUST BE GONE. An empty lora_name is not
    # a no-op in ComfyUI: it fails validation outright.
    check(f"{label}: with no LoRAs, all four slots are bypassed away",
          not any("Lora" in v["class_type"] for v in g2.values()),
          [k for k, v in g2.items() if "Lora" in v["class_type"]])
    check(f"{label}: bypassing rewires the model back to the UNET loader",
          g2["63"]["inputs"]["model"] == ["70", 0], g2["63"]["inputs"])
    check(f"{label}: bypassing rewires the clip back to the CLIP loader",
          g2["74"]["inputs"]["clip"] == ["71", 0], g2["74"]["inputs"])
    check(f"{label}: no dangling link survives the bypass",
          all(not (C._is_link(v) and v[0] not in g2)
              for n in g2.values() for v in n["inputs"].values()), None)

    # THE CHECKPOINT VARIANT: same graph, different loader. The patcher matches
    # on INPUT KEY, not class name, so the model name has to land in ckpt_name
    # here and unet_name there with no special case anywhere.
    if fn.endswith("ckpt_t2i.json"):
        check(f"{label}: node 70 is a CheckpointLoaderSimple",
              g["70"]["class_type"] == "CheckpointLoaderSimple", g["70"]["class_type"])
        g4, rep4 = C.patch(g, dict(st, model="aisha_klein.safetensors"), {"prompt": "x"})
        check(f"{label}: the model name lands in ckpt_name, not unet_name",
              val(g4, "70", "ckpt_name") == "aisha_klein.safetensors", g4["70"])
        # Outputs 1 (CLIP) and 2 (VAE) of a FLUX.2 checkpoint are usually empty,
        # because the file carries the transformer alone. Connecting one would
        # fail at load, so nothing may reference them — the text encoder and VAE
        # keep coming from their own loaders.
        used = [(nid, k, v[1]) for nid, n in g4.items() if not nid.startswith("_")
                for k, v in n["inputs"].items()
                if C._is_link(v) and str(v[0]) == "70"]
        check(f"{label}: only the MODEL output of the checkpoint is used",
              all(slot == 0 for _, _, slot in used), used)
        check(f"{label}: the text encoder still comes from the CLIP loader",
              g4["74"]["inputs"]["clip"] == ["71", 0], g4["74"]["inputs"])
        check(f"{label}: and the VAE from the VAE loader",
              g4["65"]["inputs"]["vae"] == ["72", 0], g4["65"]["inputs"])
        # It must be the SAME graph otherwise — a divergence here is a second
        # template to maintain rather than one file with one node swapped.
        base = C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json"))
        check(f"{label}: identical to the UNETLoader template apart from node 70",
              {k: v for k, v in g.items() if k not in ("70", "_comment")}
              == {k: v for k, v in base.items() if k not in ("70", "_comment")}, None)

    # two LoRAs: slots 101/102 filled, 103/104 bypassed
    st2 = dict(st, loras=[{"path": "flux/grain.safetensors", "weight": 0.6},
                          {"path": "face.safetensors", "weight": 0}])
    g3, rep3 = C.patch(g, st2, {"prompt": "x"})
    check(f"{label}: the first two slots are FILLED, not newly built",
          val(g3, "101", "lora_name") == "flux/grain.safetensors"
          and val(g3, "102", "lora_name") == "face.safetensors", None)
    check(f"{label}: a weight of 0 survives into the slot",
          val(g3, "102", "strength_model") == 0, g3["102"]["inputs"])
    check(f"{label}: strength_clip matches strength_model",
          val(g3, "101", "strength_clip") == 0.6, g3["101"]["inputs"])
    check(f"{label}: the two unused slots are bypassed",
          "103" not in g3 and "104" not in g3, [k for k in g3 if k.startswith("10")])
    check(f"{label}: the chain ends at the last FILLED slot",
          g3["63"]["inputs"]["model"] == ["102", 0], g3["63"]["inputs"])
    check(f"{label}: no LoRA node was added when slots sufficed",
          len([k for k, v in g3.items() if "Lora" in v["class_type"]]) == 2, None)

    # more LoRAs than slots -> extras are built
    st5 = dict(st, loras=[{"path": f"l{i}.safetensors", "weight": 1} for i in range(5)])
    g5, _ = C.patch(g, st5, {"prompt": "x"})
    check(f"{label}: a fifth LoRA is built when the four slots are full",
          len([k for k, v in g5.items() if "Lora" in v["class_type"]]) == 5, None)

# THE DISTILLED TRAP, ITS OWN TEST. ComfyUI's distilled template feeds the
# POSITIVE text node through ConditioningZeroOut and calls it "negative", so
# both conditioning inputs trace back to node 74. Writing a negative prompt
# there would replace the prompt with "blurry" and render THAT.
gd = C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json"))
rd = C.roles(gd)
check("distilled: the zeroed negative is NOT mistaken for a prompt node",
      rd["negative"] is None and rd["zeroed_negative"] is True, rd["negative"])
gd2, _ = C.patch(gd, {"id": "s", "arch": "flux2klein9b", "engine": "comfy",
                      "negative": "blurry, low quality", "loras": []},
                 {"prompt": "a lighthouse"})
check("distilled: a negative prompt CANNOT overwrite the positive one",
      val(gd2, "74", "text") == "a lighthouse", gd2["74"])
gb = C.load_workflow(os.path.join(WF, "img_flux2_klein_base_9b_t2i.json"))
gb2, _ = C.patch(gb, {"id": "s", "arch": "flux2klein9b", "engine": "comfy",
                      "negative": "blurry", "loras": []}, {"prompt": "a lighthouse"})
check("base: a REAL negative prompt node does get the negative prompt",
      val(gb2, "74", "text") == "a lighthouse" and val(gb2, "67", "text") == "blurry",
      [gb2["74"], gb2["67"]])


# ===================== THE IMAGE-EDIT TEMPLATE (3 image slots) =============
ED = C.load_workflow(os.path.join(WF, "img_flux2_klein_edit_9b.json"))
red = C.roles(ED)
check("edit: all three LoadImage slots are found in order",
      red["image_slots"] == ["81", "82", "83"], red["image_slots"])
check("edit: the four LoRA slots are found too",
      red["lora_nodes"] == ["101", "102", "103", "104"], red["lora_nodes"])
check("edit: it has a real negative prompt node", red["negative"] == "67", red["negative"])
# An edit keeps the SOURCE picture's dimensions: width/height are links from
# GetImageSize, so the style's size must not be written over them.
check("edit: the size comes from the image, so there are no size widgets to set",
      red["size_nodes"] == [], red["size_nodes"])

STE = {"id": "s", "arch": "flux2klein9b", "engine": "comfy", "loras": []}
ge, rep = C.patch(ED, STE, {"prompt": "add a hat", "images": ["ref1.png"],
                            "width": 512, "height": 512})
check("edit: one image fills slot 1", val(ge, "81", "image") == "ref1.png", ge["81"])
check("edit: the two unused image slots are gone",
      [k for k, v in ge.items() if v["class_type"] == "LoadImage"] == ["81"], None)
check("edit: their scale/encode/reference nodes went with them",
      len([k for k, v in ge.items() if v["class_type"] == "ReferenceLatent"]) == 2, None)
check("edit: the conditioning chain is rewired around the removed slots",
      ge["63"]["inputs"]["positive"] == ["121", 0]
      and ge["63"]["inputs"]["negative"] == ["131", 0], ge["63"]["inputs"])
check("edit: GetImageSize still reads the surviving image",
      ge["100"]["inputs"]["image"] == ["91", 0], ge["100"])
check("edit: the style's size does NOT overwrite the source dimensions",
      C._is_link(ge["66"]["inputs"]["width"]), ge["66"]["inputs"])
check("edit: no dangling link survives the bypass",
      all(not (C._is_link(v) and v[0] not in ge)
          for n in ge.values() for v in n["inputs"].values()), None)

ge2, _ = C.patch(ED, STE, {"prompt": "x", "images": ["a.png", "b.png", "c.png"]})
check("edit: three images fill all three slots",
      sorted(k for k, v in ge2.items() if v["class_type"] == "LoadImage") == ["81", "82", "83"], None)
check("edit: three reference blocks chain into the guider",
      len([k for k, v in ge2.items() if v["class_type"] == "ReferenceLatent"]) == 6, None)
check("edit: batch still goes on the latent",
      C.patch(ED, STE, {"prompt": "x", "images": ["a.png"], "batch": 3})[0]["66"]["inputs"]["batch_size"] == 3, None)

# An edit with nothing to edit is refused rather than queued: there would also
# be no source for the output size.
raises("edit: no reference image is refused with an explanation",
       lambda: C.patch(ED, STE, {"prompt": "x", "images": []}), "reference image")
raises("edit: more images than slots is refused",
       lambda: C.patch(ED, STE, {"prompt": "x", "images": ["1", "2", "3", "4"]}), "slot")
# ...and images handed to a workflow that cannot take them
raises("images given to a text-to-image workflow are refused, not ignored",
       lambda: C.patch(C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json")),
                       STE, {"prompt": "x", "images": ["a.png"]}), "no loadimage")

# ---------------------------------------------------------------------------
# THE 2.72.0 REGRESSION: a Windows separator in a subfoldered model name.
# ComfyUI matches combo values EXACTLY and spells subfolders with forward
# slashes, so this came back as
#   node 70: Value not in list [unet_name] = flux_klein_9B\aisha....safetensors
# with the file sitting exactly where it should. Only names WITH A SUBFOLDER can
# carry it, which is why every earlier test (all loose filenames) stayed green.
T2I = C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json"))
_bs = C.patch(T2I, {**STE, "model": "flux_klein_9B\\aisha.safetensors"}, {"prompt": "x"})[0]
_un = [n["inputs"]["unet_name"] for n in _bs.values() if "unet_name" in n.get("inputs", {})]
check("a backslash in a model override is normalised to ComfyUI's spelling",
      _un and _un[0] == "flux_klein_9B/aisha.safetensors", _un)
check("comfy_name normalises every shape a hand-typed value arrives in",
      C.comfy_name("a\\b\\c.safetensors") == "a/b/c.safetensors"
      and C.comfy_name("  /flux/x.sft  ") == "flux/x.sft"
      and C.comfy_name("plain.safetensors") == "plain.safetensors"
      and C.comfy_name(None) == "", None)
check("a LoRA name goes through the same rule",
      C.comfy_lora_name("flux\\grain.safetensors") == "flux/grain.safetensors", None)

# ===== the shipped verified templates (2.75.0) =====================
# Tim exported these from a ComfyUI session where they RENDER, so anything the
# patcher cannot do with them is the patcher's fault, not the template's. They
# are the first shipped graphs that drive the prompt and the size from shared
# Primitive nodes, and before 2.75.0 that made the text-to-image one fail
# outright ("no text prompt node could be found") because every writer here
# correctly skips a link and nobody followed it one hop to the widget.
for name, slots in [("img_flux2_9b_t2i_verified.json", 0),
                    ("img_flux2_9b_edit_verified.json", 2)]:
    g = C.load_workflow(os.path.join(WF, name))
    r = C.roles(g)
    check(f"{name}: a prompt node is found", bool(r["positive"]), r["positive"])
    check(f"{name}: the model loader is found",
          bool(r["loaders"].get("model")), r["loaders"])
    check(f"{name}: it saves something", bool(r["save"]), r["save"])
    check(f"{name}: {slots} reference image slot(s)",
          len(r["image_slots"]) == slots, r["image_slots"])
    # colon-separated node ids come out of ComfyUI's subgraph flattening and
    # must not be assumed numeric anywhere
    check(f"{name}: subgraph-style node ids are handled",
          any(":" in k for k in g), list(g)[:4])

    out, report = C.patch(g, {"engine": "comfy",
                              "loras": [{"path": "flux/grain.safetensors", "weight": 0.8}]},
                          {"prompt": "PROMPT UNDER TEST", "seed": 42, "steps": 7,
                           "cfg": 3.5, "width": 768, "height": 512, "batch": 1,
                           "images": ["a.png", "b.png"][:slots] or None})
    joined = " | ".join(report)
    # THE PROMPT MUST ACTUALLY LAND. A patch that "succeeds" while the template
    # keeps its own prompt renders a vintage motorcycle whatever you typed.
    txt = json.dumps(out)
    check(f"{name}: the prompt reaches the graph",
          "PROMPT UNDER TEST" in txt, joined)
    check(f"{name}: the template's own prompt is gone",
          "vintage motorcycle" not in txt and "on the dolphin" not in txt, joined)
    # LoRAs: neither template carries a LoRA node, so one must be BUILT and
    # wired in front of every model AND clip consumer
    built = [k for k in out if k not in g]
    check(f"{name}: a LoRA node is built for a template that has none",
          len(built) == 1 and "Lora" in out[built[0]]["class_type"], built)
    lid = built[0]
    check(f"{name}: the built LoRA takes the model from the loader",
          out[lid]["inputs"]["model"][0] == r["model_src"], out[lid]["inputs"])
    check(f"{name}: the built LoRA carries the style's weight",
          out[lid]["inputs"]["strength_model"] == 0.8, out[lid]["inputs"])
    # ...and the consumers must now read from it, or the LoRA loads and does
    # nothing at all — the quietest possible failure
    guider = r["sampler"]
    check(f"{name}: the model consumer is rewired through the LoRA",
          out[guider]["inputs"]["model"] == [lid, 0], out[guider]["inputs"]["model"])
    # EVERY clip consumer, found by class rather than by role. The first version
    # of this check read r["positive"] and asked "if it has a clip input" — but
    # in the text-to-image graph that role is the PrimitiveStringMultiline, which
    # has no clip, so the assertion SKIPPED and proved nothing. A guard that can
    # silently not run is worse than no guard: it reads green either way.
    encs = [k for k, n in out.items()
            if "CLIPTextEncode" in str(n.get("class_type") or "")]
    check(f"{name}: every text encoder is rewired through the LoRA's clip",
          encs and all(out[k]["inputs"].get("clip") == [lid, 1] for k in encs),
          {k: out[k]["inputs"].get("clip") for k in encs})
    # ...and nothing may still read the raw loader, or half the graph would run
    # without the LoRA and the result would just look slightly wrong
    src = r["clip_src"]
    bypassers = [k for k, n in out.items()
                 if k != lid and any(isinstance(v, list) and v and v[0] == src
                                     for v in C._ins(n).values())]
    check(f"{name}: nothing bypasses the LoRA to read the CLIP loader directly",
          not bypassers, bypassers)

# A STACK OF LoRAs MUST CHAIN, not race. Each one takes the previous one's model
# AND clip, the last one feeds the consumers, and a weight of 0 stays in the
# chain rather than being dropped — "off but still in the stack" is a setting,
# and silently removing it would make the slider's 0 mean something different
# from every other value.
for name in ("img_flux2_9b_t2i_verified.json", "img_flux2_9b_edit_verified.json"):
    g = C.load_workflow(os.path.join(WF, name))
    r = C.roles(g)
    out, report = C.patch(g, {"engine": "comfy", "loras": [
        {"path": "a.safetensors", "weight": 0.8},
        {"path": "b.safetensors", "weight": 0.5},
        {"path": "c.safetensors", "weight": 0.0}]},
        {"prompt": "x", "images": ["a.png", "b.png"] if r["image_slots"] else None})
    built = [k for k in out if k not in g]
    check(f"{name}: three LoRAs build three nodes", len(built) == 3, built)
    names = [out[k]["inputs"]["lora_name"] for k in built]
    check(f"{name}: a zero-weight LoRA stays in the stack, switched off",
          "c.safetensors" in names
          and out[built[2]]["inputs"]["strength_model"] == 0.0, names)
    check(f"{name}: each LoRA takes the previous one's model and clip",
          out[built[1]]["inputs"]["model"] == [built[0], 0]
          and out[built[1]]["inputs"]["clip"] == [built[0], 1]
          and out[built[2]]["inputs"]["model"] == [built[1], 0]
          and out[built[2]]["inputs"]["clip"] == [built[1], 1],
          [out[k]["inputs"] for k in built])
    check(f"{name}: the LAST LoRA is what the sampler reads",
          out[r["sampler"]]["inputs"]["model"] == [built[2], 0],
          out[r["sampler"]]["inputs"]["model"])

# size: the text-to-image graph drives both dimensions from PrimitiveInt nodes,
# and the edit graph computes them from the reference picture. One must be
# written and the other must NOT be.
g = C.load_workflow(os.path.join(WF, "img_flux2_9b_t2i_verified.json"))
out, report = C.patch(g, {"engine": "comfy"},
                      {"prompt": "x", "width": 768, "height": 512})
check("t2i: a size behind a shared PrimitiveInt is written",
      out["75:68"]["inputs"]["value"] == 768
      and out["75:69"]["inputs"]["value"] == 512,
      [out["75:68"]["inputs"], out["75:69"]["inputs"]])
check("t2i: the size report names the nodes it touched",
      any("768x512" in l for l in report), report)
g2 = C.load_workflow(os.path.join(WF, "img_flux2_9b_edit_verified.json"))
out2, report2 = C.patch(g2, {"engine": "comfy"},
                        {"prompt": "x", "width": 768, "height": 512,
                         "images": ["a.png", "b.png"]})
check("edit: a size COMPUTED from the reference image is left alone",
      C._is_link(out2["92:115"]["inputs"]["width"])
      and C._is_link(out2["92:109"]["inputs"]["width"]),
      [out2["92:115"]["inputs"], out2["92:109"]["inputs"]])
check("edit: and it says so rather than pretending it applied the size",
      any("reference image" in l for l in report2), report2)

# is_primitive is narrow ON PURPOSE: overwriting a COMPUTED value would resize
# somebody's photo. GetImageSize is not a primitive however much it looks like
# a source of numbers.
check("only a Primitive* node holding a literal is writable",
      C.is_primitive({"class_type": "PrimitiveInt", "inputs": {"value": 1024}})
      and not C.is_primitive({"class_type": "GetImageSize", "inputs": {"image": ["1", 0]}})
      and not C.is_primitive({"class_type": "PrimitiveInt", "inputs": {"value": ["9", 0]}}),
      None)
check("widget_key answers None for a computed value rather than guessing",
      C.widget_key({"n": {"class_type": "Flux2Scheduler",
                          "inputs": {"width": ["7", 0]}}}, "n", "width") is None
      and C.widget_key({"n": {"class_type": "Flux2Scheduler",
                              "inputs": {"width": 512}}}, "n", "width") == "width",
      None)

# ===== seed -1 must actually randomise (2.78.0) =====================
# It used to leave the template's own noise_seed alone. The shipped t2i template
# carries noise_seed 0, so every render came back byte-identical and Tim
# reasonably concluded the LoRA was not loading. "Leave the template's value" is
# right for steps and cfg -- the export is a better guess than anything invented
# here -- and exactly wrong for a seed.
g = C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json"))
seeds, reports = set(), []
for _ in range(6):
    out, rep = C.patch(g, {"engine": "comfy"}, {"prompt": "x", "seed": -1})
    seeds.add(out["73"]["inputs"]["noise_seed"])
    reports.append(rep)
check("seed -1 gives a different seed every time",
      len(seeds) >= 5, sorted(seeds))
check("...and none of them is the template's own value",
      0 not in seeds, sorted(seeds))
# THE CEILING IS PART OF THE CONTRACT, not an implementation detail. 2.78.0 drew
# from the full int64 space and the very next render died with OSError inside the
# node consuming RandomNoise, on a graph otherwise identical to one that had just
# worked. 0..2**32-1 is what ComfyUI's own UI, A1111 and numpy.random.seed all
# accept, and 4 billion images per prompt is not a limit anybody reaches.
check("a random seed stays inside the range every backend accepts",
      all(0 <= x < 2**32 for x in seeds), sorted(seeds)[-3:])
check("...and is a plain int, not a float or a string",
      all(isinstance(x, int) and not isinstance(x, bool) for x in seeds),
      [type(x).__name__ for x in seeds])
check("the chosen seed is REPORTED, so a picture can be reproduced",
      any("seed" in l and "random" in l for l in reports[0]), reports[0])
# the number in the report has to be the number in the graph, or it is a
# reproduction instruction that does not reproduce anything
out, rep = C.patch(g, {"engine": "comfy"}, {"prompt": "x", "seed": -1})
line = [l for l in rep if l.startswith("seed ")][0]
check("the reported seed is the one actually written",
      str(out["73"]["inputs"]["noise_seed"]) in line,
      [line, out["73"]["inputs"]["noise_seed"]])
# an explicit seed is still honoured exactly -- that is how you USE the
# reported number
out2, _ = C.patch(g, {"engine": "comfy"}, {"prompt": "x", "seed": 42})
check("an explicit seed is used verbatim", out2["73"]["inputs"]["noise_seed"] == 42,
      out2["73"]["inputs"]["noise_seed"])
out3, _ = C.patch(g, {"engine": "comfy"}, {"prompt": "x", "seed": 0})
check("seed 0 is a real seed, not 'unset'", out3["73"]["inputs"]["noise_seed"] == 0,
      out3["73"]["inputs"]["noise_seed"])
# and a style-level seed still reaches it
out4, _ = C.patch(g, {"engine": "comfy", "seed": 7}, {"prompt": "x"})
check("a seed from the style is honoured too", out4["73"]["inputs"]["noise_seed"] == 7,
      out4["73"]["inputs"]["noise_seed"])
# ===== the shipped template's LoRA chain must survive the bypass ==========
# Tim's log showed slot 101 filled and 102-104 bypassed. If bypassing did not
# rewire the consumers back to 101, the LoRA would load and be connected to
# nothing -- the quietest possible failure, and indistinguishable from "the
# LoRA does not work" from the outside.
g = C.load_workflow(os.path.join(WF, "img_flux2_klein_9b_t2i.json"))
out, rep = C.patch(g, {"engine": "comfy",
                       "loras": [{"path": "B010726.safetensors", "weight": 1}]},
                   {"prompt": "x", "seed": 1})
check("the one LoRA fills the first slot",
      out["101"]["inputs"]["lora_name"] == "B010726.safetensors", out["101"]["inputs"])
check("the empty slots are removed",
      all(k not in out for k in ("102", "103", "104")), list(out))
check("the guider reads the model THROUGH the filled slot",
      out["63"]["inputs"]["model"] == ["101", 0], out["63"]["inputs"]["model"])
check("the text encoder reads the clip THROUGH it too",
      out["74"]["inputs"]["clip"] == ["101", 1], out["74"]["inputs"]["clip"])
check("no link points at a slot that was removed",
      not [1 for n in out.values() for v in C._ins(n).values()
           if isinstance(v, list) and v and v[0] in ("102", "103", "104")], None)

# ===== the MiniMax Music3 template (2.89.0) =================================
# Shipped as the template for music styles. The worker path that renders it is
# NOT built yet, so what is pinned here is the file: that it parses, that every
# link resolves, and that it still names the inputs the patcher will target.
# A template with a dangling link is a bug you only find at render time, and
# ComfyUI's subgraph ids ("37:6") are exactly the kind of thing a well-meaning
# tidy-up breaks.
MUSIC = os.path.join(WF, "audio_minimax_music3.json")
if os.path.exists(MUSIC):
    mg = C.load_workflow(MUSIC)
    nodes = {k: v for k, v in mg.items() if not k.startswith("_")}
    check("music: the template parses as an API workflow", len(nodes) > 5, len(nodes))
    dangling = [(nid, k, v) for nid, n in nodes.items()
                for k, v in n["inputs"].items()
                if C._is_link(v) and str(v[0]) not in nodes]
    check("music: every link resolves — subgraph ids like '37:6' are load-bearing "
          "and must not be renumbered", not dangling, dangling)
    keys = {k for n in nodes.values() for k in n["inputs"]}
    for want in ("caption", "lyrics", "max_duration", "seed", "steps", "cfg",
                 "unet_name", "clip_name", "vae_name"):
        check(f"music: the template exposes {want} for the patcher to fill",
              want in keys, sorted(keys))
    classes = {n.get("class_type") for n in nodes.values()}
    check("music: it saves AUDIO, not an image — this is why it needs its own "
          "worker path rather than reusing the image one",
          any("Audio" in str(c) for c in classes)
          and not any(c == "SaveImage" for c in classes), sorted(classes))
    check("music: the seed feeds BOTH the text encode and the sampler, so the "
          "two cannot drift apart",
          sum(1 for n in nodes.values() for v in n["inputs"].values()
              if C._is_link(v) and mg.get(str(v[0]), {}).get("class_type") == "SeedNode") >= 2,
          None)

# ===== patching the Music3 template (2.90.0) =================================
# The 2.89.0 block above pins the FILE. This pins what the patcher DOES with
# it, against the real template rather than a toy graph: which node gets the
# lyrics, which the caption, where the sampler choice lands, and that an image
# style's sd-cli sampler name is NOT written into a graph ComfyUI would refuse.
if os.path.exists(MUSIC):
    mg = C.load_workflow(MUSIC)
    MSTYLE = {"kind": "music", "engine": "comfy", "arch": "minimax-music3",
              "caption": "Global Metadata: Genre: synthwave.", "max_duration": 42,
              "sampler": "dpmpp_2m", "scheduler": "karras", "steps": 9, "cfg": 2.25}
    g, rep = C.patch(mg, MSTYLE, {"prompt": "[verse]\nneon rain", "seed": 11, "batch": 2})
    check("music: the PROMPT goes into `lyrics` on the Music3 encoder (37:13)",
          val(g, "37:13", "lyrics") == "[verse]\nneon rain", g["37:13"]["inputs"])
    check("music: the style's caption goes into `caption` on the same node",
          val(g, "37:13", "caption") == "Global Metadata: Genre: synthwave.", g["37:13"]["inputs"])
    check("music: the two are never swapped",
          "neon rain" not in str(val(g, "37:13", "caption")), None)
    check("music: max_duration reaches the encoder as an int",
          val(g, "37:13", "max_duration") == 42 and isinstance(val(g, "37:13", "max_duration"), int),
          g["37:13"]["inputs"])
    check("music: the encoder's own cfg_scale is deliberately NOT the style's cfg",
          val(g, "37:13", "cfg_scale") == mg["37:13"]["inputs"]["cfg_scale"], g["37:13"]["inputs"])
    check("music: seed reaches the SeedNode, which feeds both encode and sampler",
          val(g, "37:38", "seed") == 11, g["37:38"]["inputs"])
    check("music: steps and cfg reach the KSampler (37:9)",
          val(g, "37:9", "steps") == 9 and val(g, "37:9", "cfg") == 2.25, g["37:9"]["inputs"])
    check("music: the style's sampler/scheduler are written to the KSampler",
          val(g, "37:9", "sampler_name") == "dpmpp_2m" and val(g, "37:9", "scheduler") == "karras",
          g["37:9"]["inputs"])
    check("music: a batch is batch_size on the audio latent (37:15), one queued prompt",
          val(g, "37:15", "batch_size") == 2, g["37:15"]["inputs"])
    check("music: the report names every write, for the job log",
          any("lyrics" in x for x in rep) and any("caption" in x for x in rep)
          and any("duration 42s" in x for x in rep) and any("dpmpp_2m" in x for x in rep), rep)
    check("music: the template is never mutated",
          mg["37:13"]["inputs"]["lyrics"] != "[verse]\nneon rain", None)

    # an empty caption keeps the template's worked example (template-is-a-better-default)
    g, _ = C.patch(mg, {**MSTYLE, "caption": ""}, {"prompt": "x"})
    check("music: an empty style caption leaves the template's caption standing",
          val(g, "37:13", "caption") == mg["37:13"]["inputs"]["caption"], None)
    # the per-request max_duration beats the style's
    g, _ = C.patch(mg, MSTYLE, {"prompt": "x", "max_duration": 7})
    check("music: a per-request max_duration beats the style's", val(g, "37:13", "max_duration") == 7, None)
    # a blank sampler keeps the template's
    g, _ = C.patch(mg, {**MSTYLE, "sampler": "", "scheduler": ""}, {"prompt": "x"})
    check("music: a blank sampler/scheduler keeps the template's choice",
          val(g, "37:9", "sampler_name") == mg["37:9"]["inputs"]["sampler_name"]
          and val(g, "37:9", "scheduler") == mg["37:9"]["inputs"]["scheduler"], g["37:9"]["inputs"])

    # ---- the cross-kind refusals, in the user's terms ----
    raises("music: an IMAGE graph handed to a music style is refused for having no SaveAudio",
           lambda: C.patch(KSAMPLER, MSTYLE, {"prompt": "x"}), "never saves audio")
    raises("music: the Music3 graph handed to an IMAGE style is refused for having no SaveImage",
           lambda: C.patch(mg, STYLE, {"prompt": "x"}), "never saves an image")
    # an sd-cli sampler name on an IMAGE style must never be written into a graph
    g, _ = C.patch(KSAMPLER, {**STYLE, "sampler": "euler_a", "scheduler": "karras"}, {"prompt": "x"})
    check("an image style's sd-cli sampler name is NOT written into the graph "
          "(ComfyUI would answer 'value not in list')",
          val(g, "5", "sampler_name") == "euler" and val(g, "5", "scheduler") == "normal",
          g["5"]["inputs"])
    # roles() vocabulary: the keys the worker relies on exist
    r = C.roles(mg)
    check("music: roles() finds the caption, duration, sampler-widget and save_audio nodes",
          r["caption"] == ["37:13"] and "37:13" in r["duration"]
          and "37:9" in r["sampler_widgets"] and r["save_audio"], 
          {k: r[k] for k in ("caption", "duration", "sampler_widgets", "save_audio")})
    check("music: the positive prompt node is the Music3 encoder, found by its `lyrics` key",
          r["positive"] == "37:13", r["positive"])

print("=======================")

# ---- 2.209.0 (Tim: "up to 3 reference images from the refs docker, if the
# reference images are not there bypass the unused nodes"): the REAL
# img_flux2_klein_edit_9b.json, patched with 1, 2 and 3 pictures. Every
# unused slot's whole chain (LoadImage -> ImageScaleToTotalPixels ->
# VAEEncode -> BOTH ReferenceLatent nodes) must vanish, the conditioning
# must splice through, and no surviving input may point at a removed node —
# a dangling link is exactly the shape of a validation card.
REAL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "..", "comfy_workflows",
                                   "img_flux2_klein_edit_9b.json")))
REAL = {k: v for k, v in REAL.items() if not str(k).startswith("_")}


def integrity(g):
    """Input links that point at nodes no longer in the graph."""
    bad = []
    for nid, n in g.items():
        for k, v in (n.get("inputs") or {}).items():
            if isinstance(v, list) and len(v) == 2 and str(v[0]) not in g:
                bad.append((nid, k, v))
    return bad


for n_refs in (1, 2, 3):
    g = copy.deepcopy(REAL)
    imgs = [f"ref{i}.png" for i in range(1, n_refs + 1)]
    g, rep = C.apply_images(g, imgs)
    loads = sorted(nid for nid, nn in g.items()
                   if "loadimage" in str(nn.get("class_type", "")).lower())
    check(f"klein edit, {n_refs} ref(s): exactly {n_refs} LoadImage slot(s) survive",
          len(loads) == n_refs, loads)
    check(f"klein edit, {n_refs} ref(s): no surviving input points at a removed node",
          integrity(g) == [], integrity(g))
    pos, neg = g["63"]["inputs"]["positive"], g["63"]["inputs"]["negative"]
    check(f"klein edit, {n_refs} ref(s): the guider's conditioning splices to the last SURVIVING ReferenceLatent pair",
          str(pos[0]) in g and str(neg[0]) in g
          and g[str(pos[0])]["class_type"] == "ReferenceLatent"
          and g[str(neg[0])]["class_type"] == "ReferenceLatent", (pos, neg))
    n_ref_nodes = sum(1 for nn in g.values()
                      if nn.get("class_type") == "ReferenceLatent")
    check(f"klein edit, {n_refs} ref(s): {2 * n_refs} ReferenceLatent nodes remain (a positive+negative pair per picture)",
          n_ref_nodes == 2 * n_refs, n_ref_nodes)
    check(f"klein edit, {n_refs} ref(s): the output size still reads from slot 1's scaler",
          str(g["100"]["inputs"]["image"][0]) in g, g["100"]["inputs"])

g = copy.deepcopy(REAL)
try:
    C.apply_images(g, ["a.png", "b.png", "c.png", "d.png"])
    check("klein edit: a FOURTH picture is refused with the slot count in the message", False)
except C.PatchError as e:
    check("klein edit: a FOURTH picture is refused with the slot count in the message",
          "3 reference-image slot(s)" in str(e), str(e))

# ---- 2.210.0 (Tim's second card: unet 'flux-2-klein-9b-fp8.safetensors'
# "not in (list of length 56) ... ComfyUI lists this file as:
# flux-2-klein-9b.safetensors"): the whole bundled Klein family must load
# THE VERIFIED NAME — the one Tim's hardware has confirmed via the verified
# t2i — not an -fp8 variant no card has ever shown present. The base family
# is excluded on purpose: it NAMES the base model.
WFD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "comfy_workflows")


def model_names(fname):
    g = json.load(open(os.path.join(WFD, fname)))
    return sorted({(n.get("inputs") or {}).get(k)
                   for n in g.values() if isinstance(n, dict)
                   for k in ("unet_name", "ckpt_name")
                   if (n.get("inputs") or {}).get(k)})


VERIFIED_UNET = model_names("img_flux2_9b_t2i_verified.json")
check("the verified t2i names exactly one model file (the family's anchor)",
      len(VERIFIED_UNET) == 1, VERIFIED_UNET)
for f in ("img_flux2_klein_9b_t2i.json", "img_flux2_klein_edit_9b.json",
          "img_flux2_klein_9b_ckpt_t2i.json"):
    check(f"{f} loads the VERIFIED model name — never an -fp8 variant no card has shown present",
          model_names(f) == VERIFIED_UNET, (f, model_names(f), VERIFIED_UNET))

# 2.337.0: Qwen Image 2.1 takes its pictures as OPTIONAL autogrow inputs
# (images.image_N) straight from LoadImage - an unused slot leaves no
# dangling link behind
_q21 = C.load_workflow(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "comfy_workflows", "img_qwen21_edit.json"))
_r = C.roles(_q21)
check("qwen 2.1: 8 slots, the prompt on the Primitive, no negative (one encoder feeds both)",
      len(_r["image_slots"]) == 8 and _r["positive"] == "9" and _r["negative"] is None, (_r["image_slots"], _r["positive"], _r["negative"]))
_g, _rep = C.apply_images(copy.deepcopy(_q21), ["loc.png", "ava.png"], _r)
_enc = next(v for v in _g.values() if v.get("class_type") == "TextEncodeQwenImage21")["inputs"]
check("qwen 2.1: 2 pictures fill image_1 / image_2; the 6 unused slots and their images.image_N keys are gone",
      sorted(k for k in _enc if k.startswith("images.")) == ["images.image_1", "images.image_2"]
      and sum(1 for v in _g.values() if v.get("class_type") == "LoadImage") == 2
      and all(str(v[0]) in _g for v in _enc.values() if isinstance(v, list)), sorted(_enc))

# 2.582.0: Fibo 2.0 (TextEncodeFibo2: images.image_N straight from LoadImage, one encoder = positive + negative + latent)
_fb = C.load_workflow(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "comfy_workflows", "img_fibo2_edit.json"))
_r = C.roles(_fb)
check("fibo 2.0: 4 slots, the prompt on the Primitive, the latent + size from the encoder, no separate negative",
      _r["image_slots"] == ["21", "22", "23", "24"] and _r["positive"] == "9" and _r["negative"] is None and _r["latent"] == "10" and _r["size_nodes"] == ["10"], _r)
_out = C.patch(_fb, {"name": "Fibo 2.0 Edit Turbo", "model": "fibo2_edit_turbo-Q4_0.gguf", "steps": 4, "cfg": 1, "negative": ""},
               {"prompt": "make <image_1> snowy", "width": 832, "height": 1216, "seed": 7})
_g = _out[0] if isinstance(_out, tuple) else _out
_e = _g["10"]["inputs"]
check("fibo 2.0: a .gguf as the style's Model loads with UnetLoaderGGUF (low VRAM); the size on the encoder; no picture = every slot gone",
      _g["1"]["class_type"] == "UnetLoaderGGUF" and _g["1"]["inputs"]["unet_name"] == "fibo2_edit_turbo-Q4_0.gguf" and (_e["width"], _e["height"]) == (832, 1216)
      and not any(k.startswith("images.") for k in _e) and _g["9"]["inputs"]["value"] == "make <image_1> snowy" and _g["13"]["inputs"]["seed"] == 7, (_g["1"], _e))
_g2, _rep = C.apply_images(copy.deepcopy(_fb), ["crop.png"], _r)
check("fibo 2.0: the crop fills image_1, the three unused slots are gone", sorted(k for k in _g2["10"]["inputs"] if k.startswith("images.")) == ["images.image_1"] and _g2["21"]["inputs"]["image"] == "crop.png")

print("=======================")
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
