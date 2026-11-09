#!/usr/bin/env python3
"""bitGen Studio — 2.741.0 units: ACE-STEP 1.5 as a music style (comfy_workflows/audio_ace_step_1_5.json, the
patcher's ACE block in scripts/comfy_image.py, lib/musicArch.json, lib/modelCatalog.json).
Tim (verbatim): "yes please" (to adding ACE-Step) + "ace step can use loras"
  - the workflow is ComfyUI's own split template in API form: exactly its node classes, every input named as ComfyUI's
    source defines it (comfy_extras/nodes_ace.py, nodes_audio.py, nodes_model_advanced.py, nodes.py), every link to a
    node that exists;
  - the patcher: the lyrics are the prompt, the caption goes to `tags`, the duration to the encoder AND the latent, the
    style's bpm / key / time signature / language to the encoder (blank = the template's), the seed to the language
    model and the sampler, the Turbo numbers to the sampler;
  - a music style's LoRAs are model-only loaders between the model and ModelSamplingAuraFlow (an image style's keep
    LoraLoader with the clip);
  - the catalogue has the four files the workflow loads, in the folders its loaders read."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import comfy_image as C  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:600]))


WF = os.path.join(ROOT, "comfy_workflows", "audio_ace_step_1_5.json")
g = C.load_workflow(WF)
nodes = {k: v for k, v in g.items() if not k.startswith("_")}
# the input names as ComfyUI's source defines them (links included)
SPEC = {
    "UNETLoader": {"unet_name", "weight_dtype"},
    "DualCLIPLoader": {"clip_name1", "clip_name2", "type", "device"},
    "VAELoader": {"vae_name"},
    "TextEncodeAceStepAudio1.5": {"clip", "tags", "lyrics", "seed", "bpm", "duration", "timesignature", "language", "keyscale",
                                  "generate_audio_codes", "cfg_scale", "temperature", "top_p", "top_k", "min_p"},
    "ConditioningZeroOut": {"conditioning"},
    "EmptyAceStep1.5LatentAudio": {"seconds", "batch_size"},
    "ModelSamplingAuraFlow": {"model", "shift", "sampling"},
    "KSampler": {"model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"},
    "VAEDecodeAudio": {"samples", "vae"},
    "SaveAudioAdvanced": {"audio", "filename_prefix", "format", "format.quality"},
}
check("the workflow: ComfyUI's ACE-Step 1.5 split template's ten nodes", sorted(n["class_type"] for n in nodes.values()) == sorted(SPEC), sorted(n["class_type"] for n in nodes.values()))
bad = [(k, n["class_type"], sorted(set(n["inputs"]) ^ SPEC[n["class_type"]])) for k, n in nodes.items() if set(n["inputs"]) != SPEC.get(n["class_type"])]
check("…every input named as ComfyUI's source names it", not bad, bad)
dangling = [(k, i, v) for k, n in nodes.items() for i, v in n["inputs"].items() if isinstance(v, list) and str(v[0]) not in nodes]
check("…every link goes to a node that exists", not dangling, dangling)
enc = nodes["94"]["inputs"]
check("…its combos hold values the encoder offers (type ace, 4 beats, en, E minor)", nodes["105"]["inputs"]["type"] == "ace" and enc["timesignature"] in ("2", "3", "4", "6")
      and enc["language"] == "en" and enc["keyscale"] == "E minor" and nodes["107"]["inputs"]["format"] == "mp3", enc)

arch = next(a for a in json.load(open(os.path.join(ROOT, "lib", "musicArch.json")))["archs"] if a["id"] == "ace-step-1.5")
style = {"kind": "music", "engine": "comfy", "arch": "ace-step-1.5", "caption": "Dark synthwave, male vocal", "max_duration": 90,
         "steps": 8, "cfg": 1, "sampler": "euler", "scheduler": "simple", "bpm": 98, "keyscale": "A minor", "timesig": "3", "language": "ja",
         "loras": [{"path": "ace\\chiptune.safetensors", "weight": 0.8}, {"path": "ace_vocal.safetensors", "weight": 1}]}
out, rep = C.patch(g, style, {"prompt": "[Verse]\nla la", "seed": 42})
e = out["94"]["inputs"]
check("patch: the lyrics are the prompt, the caption is the tags", e["lyrics"] == "[Verse]\nla la" and e["tags"] == "Dark synthwave, male vocal", {k: e[k] for k in ("lyrics", "tags")})
check("…the duration in the encoder and the latent", e["duration"] == 90.0 and out["98"]["inputs"]["seconds"] == 90, (e["duration"], out["98"]["inputs"]["seconds"]))
check("…bpm, key, time signature and language from the style", (e["bpm"], e["keyscale"], e["timesignature"], e["language"]) == (98, "A minor", "3", "ja"), e)
check("…one seed for the language model and the sampler", e["seed"] == 42 and out["3"]["inputs"]["seed"] == 42)
ks = out["3"]["inputs"]
check("…Turbo's sampler numbers (8 steps, cfg 1, euler / simple)", (ks["steps"], ks["cfg"], ks["sampler_name"], ks["scheduler"]) == (8, 1.0, "euler", "simple"), ks)
lo = [(k, n) for k, n in out.items() if not k.startswith("_") and "Lora" in n["class_type"]]
check("…the LoRAs are model-only loaders, chained, in order, with their strengths", [n["class_type"] for _, n in lo] == ["LoraLoaderModelOnly"] * 2
      and lo[0][1]["inputs"]["model"] == ["104", 0] and lo[1][1]["inputs"]["model"] == [lo[0][0], 0]
      and lo[0][1]["inputs"]["strength_model"] == 0.8 and lo[0][1]["inputs"]["lora_name"].endswith("chiptune.safetensors"), lo)
check("…between the model and ModelSamplingAuraFlow; the text encoders untouched", out["78"]["inputs"]["model"] == [lo[1][0], 0] and out["94"]["inputs"]["clip"] == ["105", 0])
check("…the report says what went where", any(r.startswith("ace-step: node(s) 94 - tags") and "bpm 98" in r for r in rep), rep)

out2, rep2 = C.patch(g, {"kind": "music", "engine": "comfy", "arch": "ace-step-1.5", "caption": "", "bpm": None, "keyscale": "", "timesig": "", "language": ""}, {"prompt": "words", "seed": 1})
e2 = out2["94"]["inputs"]
check("a style that leaves them blank keeps the template's (caption, bpm, key, beats, language); no LoRA nodes",
      (e2["tags"], e2["bpm"], e2["keyscale"], e2["timesignature"], e2["language"]) == (enc["tags"], enc["bpm"], enc["keyscale"], enc["timesignature"], enc["language"])
      and not any("Lora" in n["class_type"] for k, n in out2.items() if not k.startswith("_")), e2)

# an IMAGE style keeps LoraLoader with the clip (the model-only rule is the music styles')
img = {"10": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "x.safetensors"}},
       "11": {"class_type": "CLIPTextEncode", "inputs": {"text": "a", "clip": ["10", 1]}},
       "12": {"class_type": "CLIPTextEncode", "inputs": {"text": "b", "clip": ["10", 1]}},
       "13": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
       "14": {"class_type": "KSampler", "inputs": {"model": ["10", 0], "seed": 1, "steps": 20, "cfg": 7, "sampler_name": "euler", "scheduler": "normal", "positive": ["11", 0], "negative": ["12", 0], "latent_image": ["13", 0], "denoise": 1}},
       "15": {"class_type": "VAEDecode", "inputs": {"samples": ["14", 0], "vae": ["10", 2]}},
       "16": {"class_type": "SaveImage", "inputs": {"images": ["15", 0], "filename_prefix": "x"}}}
out3, _ = C.patch(img, {"kind": "image", "loras": [{"path": "style.safetensors", "weight": 0.6}]}, {"prompt": "cat", "seed": 3})
il = [n for k, n in out3.items() if "Lora" in n["class_type"]]
check("an image style's LoRA is still a LoraLoader on the model AND the clip", len(il) == 1 and il[0]["class_type"] == "LoraLoader" and il[0]["inputs"]["strength_clip"] == 0.6, il)

cat = json.load(open(os.path.join(ROOT, "lib", "modelCatalog.json")))["models"]
want = {"acestep_v1.5_turbo.safetensors": "comfy/diffusion_models", "qwen_0.6b_ace15.safetensors": "comfy/text_encoders",
        "qwen_1.7b_ace15.safetensors": "comfy/text_encoders", "ace_1.5_vae.safetensors": "comfy/vae"}
got = {os.path.basename(m["file"]): m["dest"] for m in cat if m.get("repo") == "Comfy-Org/ace_step_1.5_ComfyUI_files"}
check("the catalogue has the four files the workflow loads, in its loaders' folders, in group music", got == want
      and all(m["group"] == "music" for m in cat if m.get("repo") == "Comfy-Org/ace_step_1.5_ComfyUI_files"), got)
loaded = {nodes["104"]["inputs"]["unet_name"], nodes["105"]["inputs"]["clip_name1"], nodes["105"]["inputs"]["clip_name2"], nodes["106"]["inputs"]["vae_name"]}
check("…the same four names the workflow loads", loaded == set(want), sorted(loaded))
check("the catalogue entry: comfy, the workflow hint, two text encoder slots, Turbo defaults, LoRAs, the encoder's option lists",
      arch["engine"] == "comfy" and arch["workflow_hint"] == "comfy_workflows/audio_ace_step_1_5.json" and len(arch["te"]) == 2
      and arch["defaults"] == {"steps": 8, "cfg": 1, "sampler": "euler", "scheduler": "simple", "max_duration": 120} and arch["loras"] is True
      and arch["meta"]["timesigs"] == ["2", "3", "4", "6"] and "ja" in arch["meta"]["languages"] and len(arch["meta"]["keyscales"]) == 34, arch)

print(f"\n{P} passed, {F} failed")
sys.exit(1 if F else 0)
