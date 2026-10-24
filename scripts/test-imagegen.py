#!/usr/bin/env python3
"""Unit tests for scripts/image_gen.py — the sd-cli image argv.

Run: python3 scripts/test-imagegen.py

These are worth having because the argv is the whole feature: nothing else in
the image path can be wrong in a way that still produces a picture. They run
without sd-cli, without a model and without a GPU, which is exactly why the
builder is a pure function in its own file.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import image_gen as G                                       # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      got " + repr(got) if got is not None else ""))


def pair(argv, flag):
    """The value that follows `flag`, or None."""
    return argv[argv.index(flag) + 1] if flag in argv else None


CFG = {"sd_cli": "sd-cli.exe", "lora_dir": "loras",
       "flags": {"offload_cpu": "--offload-to-cpu"}, "gpu": {}}


def style(**kw):
    s = {"id": "st_1", "name": "test", "arch": "flux",
         "model": "flux1-dev.safetensors", "vae": "ae.safetensors",
         "te": ["clip_l.safetensors", "t5xxl.safetensors"], "loras": []}
    s.update(kw)
    return s


# ------------------------------------------------------- the catalogue itself
check("catalogue lists the five requested architectures",
      sorted(a["id"] for a in G.archs())
      == sorted(["anima", "flux", "flux2klein9b", "flux3klein", "krea2", "sdxl", "z-image", "qwen-image"]),
      [a["id"] for a in G.archs()])
for a in G.archs():
    check(f"{a['id']}: has a model flag, defaults and te slots",
          a["model_flag"].startswith("-") and a["defaults"]["steps"] >= 1
          and isinstance(a["te"], list), a)
    check(f"{a['id']}: default sampler is a real sampler",
          a["defaults"]["sampler"] in G.catalogue()["samplers"], a["defaults"]["sampler"])

# ----------------------------------------------------------------- flux basics
argv = G.build_image_command({"prompt": "a lovely cat"}, CFG, style(), "out.png")
check("flux: model goes to --diffusion-model",
      pair(argv, "--diffusion-model") == "flux1-dev.safetensors", argv)
check("flux: the two text encoders use --clip_l and --t5xxl",
      pair(argv, "--clip_l") == "clip_l.safetensors"
      and pair(argv, "--t5xxl") == "t5xxl.safetensors", argv)
check("flux: --mode img_gen, NOT vid_gen",
      "img_gen" in argv and "vid_gen" not in argv, argv)
check("flux: no video flags leak in (the 4n+1 grid is a VIDEO rule)",
      not any(f in argv for f in
              ["--video-frames", "--audio-vae", "--fps", "--increase-ref-index"]), argv)
check("flux: architecture defaults fill steps/cfg",
      pair(argv, "--steps") == "20" and pair(argv, "--cfg-scale") == "1", argv)
check("flux: output path is passed", pair(argv, "--output") == "out.png", argv)
check("flux: distilled arch sends no negative prompt",
      "--negative-prompt" not in argv, argv)

# clip_skip -1 means "let sd.cpp decide" and must not be emitted at all
check("flux: clip_skip -1 is omitted rather than passed",
      "--clip-skip" not in argv, argv)

# ------------------------------------------------------ the 0-is-not-absent trap
# `+v || default` turns every legitimate 0 into the default. A clip_skip of 0
# and a cfg of 0 are real values, and a slider that cannot reach one end is a
# bug the user cannot describe.
argv = G.build_image_command({"prompt": "p", "clip_skip": 0, "cfg": 0},
                             CFG, style(), "o.png")
check("clip_skip 0 survives (0 is a value, not an absence)",
      pair(argv, "--clip-skip") == "0", argv)
check("cfg 0 survives", pair(argv, "--cfg-scale") == "0", argv)

# and an ABSENT override must not beat the style's own setting
argv = G.build_image_command({"prompt": "p"}, CFG,
                             style(steps=7, cfg=3.5, width=768, height=512), "o.png")
check("an absent override falls through to the style",
      pair(argv, "--steps") == "7" and pair(argv, "--cfg-scale") == "3.5"
      and pair(argv, "--width") == "768" and pair(argv, "--height") == "512", argv)
argv = G.build_image_command({"prompt": "p", "steps": 12}, CFG, style(steps=7), "o.png")
check("a present override beats the style", pair(argv, "--steps") == "12", argv)

# ------------------------------------------------------------------- LoRA stack
st = style(loras=[{"path": "loras/filmgrain.safetensors", "weight": 0.75},
                  {"path": "C:\\models\\loras\\face.safetensors", "weight": 1.2}])
argv = G.build_image_command({"prompt": "a cat"}, CFG, st, "o.png")
p = pair(argv, "--prompt")
check("LoRAs become <lora:name:weight> tokens on the prompt",
      "<lora:filmgrain:0.75>" in p and "<lora:face:1.2>" in p, p)
check("the LoRA token carries the STEM, not the path",
      ".safetensors" not in p and "loras/" not in p, p)
check("--lora-model-dir is passed when a style has LoRAs",
      pair(argv, "--lora-model-dir") == "loras", argv)
check("the prompt text itself survives in front of the tokens",
      p.startswith("a cat "), p)
check("no --lora-model-dir when the style has none",
      "--lora-model-dir" not in G.build_image_command({"prompt": "x"}, CFG,
                                                      style(), "o.png"), None)
# THE SLIDER TRAP: 0 is "this LoRA off", not "default 1.0"
p0 = pair(G.build_image_command({"prompt": "x"}, CFG,
                                style(loras=[{"path": "a.safetensors", "weight": 0}]),
                                "o.png"), "--prompt")
check("a LoRA weight of 0 stays 0 (not silently 1.0)", "<lora:a:0>" in p0, p0)
check("a LoRA with no weight defaults to 1",
      "<lora:a:1>" in pair(G.build_image_command(
          {"prompt": "x"}, CFG, style(loras=[{"path": "a.safetensors"}]), "o.png"),
          "--prompt"), None)
check("a LoRA row with an empty path is dropped, not passed as <lora::1>",
      G.lora_tokens([{"path": "  ", "weight": 1}]) == [], G.lora_tokens([{"path": " "}]))

# ------------------------------------------------------- per-architecture shapes
argv = G.build_image_command({"prompt": "p"}, CFG,
                             style(arch="sdxl", model="sdxl.safetensors", vae="",
                                   te=["", ""]), "o.png")
check("sdxl: a full checkpoint goes to -m",
      pair(argv, "-m") == "sdxl.safetensors" and "--diffusion-model" not in argv, argv)
check("sdxl: empty optional slots emit no flag",
      "--vae" not in argv and "--clip_l" not in argv, argv)
check("sdxl: a negative prompt IS passed on a cfg architecture",
      pair(G.build_image_command({"prompt": "p", "negative": "blurry"}, CFG,
                                 style(arch="sdxl", model="m.safetensors",
                                       vae="", te=["", ""]), "o.png"),
           "--negative-prompt") == "blurry", None)
check("sdxl: clip_skip 2 is passed",
      pair(argv, "--clip-skip") == "2", argv)

for aid, model in [("z-image", "z.gguf"), ("flux2klein9b", "klein.safetensors"),
                   ("qwen-image", "qwen.gguf")]:
    a = G.arch_by_id(aid)
    argv = G.build_image_command({"prompt": "p"}, CFG,
                                 style(arch=aid, model=model, vae="ae.sft",
                                       te=["te.gguf"]), "o.png")
    check(f"{aid}: the text encoder uses --llm (not --t5xxl)",
          pair(argv, "--llm") == "te.gguf" and "--t5xxl" not in argv, argv)
    check(f"{aid}: model + vae passed", pair(argv, "--diffusion-model") == model
          and pair(argv, "--vae") == "ae.sft", argv)

# qwen-image's --flow-shift 3 is architecture-mandated but must never fight a
# user who set it themselves — the same rule build_command() uses for --backend.
argv = G.build_image_command({"prompt": "p"}, CFG,
                             style(arch="qwen-image", model="q.gguf", vae="v",
                                   te=["t"]), "o.png")
check("qwen-image: --flow-shift 3 is applied automatically",
      pair(argv, "--flow-shift") == "3", argv)
argv = G.build_image_command({"prompt": "p", "extra_args": "--flow-shift 5"}, CFG,
                             style(arch="qwen-image", model="q.gguf", vae="v",
                                   te=["t"]), "o.png")
check("qwen-image: the user's own --flow-shift wins",
      argv.count("--flow-shift") == 1 and pair(argv, "--flow-shift") == "5", argv)

# ------------------------------------------------------------- gpu + extra args
argv = G.build_image_command({"prompt": "p"},
                             {**CFG, "gpu": {"vae_tiling": True, "offload_cpu": True}},
                             style(), "o.png")
check("gpu settings carry over (vae tiling + cpu offload)",
      "--vae-tiling" in argv and "--offload-to-cpu" in argv, argv)
argv = G.build_image_command({"prompt": "p", "extra_args": "--diffusion-fa -v"},
                             CFG, style(), "o.png")
check("extra args are appended verbatim",
      argv[-2:] == ["--diffusion-fa", "-v"], argv[-4:])
check("a user-set --sampling-method is not doubled",
      G.build_image_command({"prompt": "p", "extra_args": "--sampling-method heun"},
                            CFG, style(), "o.png").count("--sampling-method") == 1, None)

# ---------------------------------------------------------------- missing slots
check("a style with no model reports it",
      G.missing_slots(style(model="")) == ["model"], G.missing_slots(style(model="")))
check("flux with an empty T5 slot reports T5-XXL",
      G.missing_slots(style(te=["clip_l.safetensors", ""])) == ["T5-XXL"],
      G.missing_slots(style(te=["clip_l.safetensors", ""])))
check("sdxl needs neither VAE nor text encoders",
      G.missing_slots(style(arch="sdxl", model="m.safetensors", vae="", te=["", ""])) == [],
      None)
check("a complete style reports nothing missing", G.missing_slots(style()) == [], None)
check("an unknown architecture is reported, not crashed on",
      len(G.missing_slots(style(arch="nope"))) == 1, None)
try:
    G.build_image_command({"prompt": "p"}, CFG, style(arch="nope"), "o.png")
    check("an unknown architecture raises rather than building nonsense", False, None)
except ValueError:
    check("an unknown architecture raises rather than building nonsense", True)

# ------------------------------------------------------------ mode flag override
argv = G.build_image_command({"prompt": "p"},
                             {**CFG, "flags": {"image_mode": "--mode custom_gen"}},
                             style(), "o.png")
check("the image mode flag is configurable (sd.cpp renames things)",
      "custom_gen" in argv, argv)

# ===== "Value not in list": name the file ComfyUI actually has (2.84.1) ======
# The real rejection Tim hit said only that the name was not in a list of 430.
# The file WAS there, under a different prefix -- ComfyUI names each entry
# relative to whichever search path it was found under, and a folder that is
# itself a search path in extra_model_paths.yaml contributes no prefix at all.
import comfy_client as _CC
LIST430 = ["B04082026_Klein9B.safetensors", "sdxl/detail.safetensors",
           "flux/other.safetensors", "JIBMIX/JibMixKlein_v10.SAFETENSORS"]
n = _CC.nearest_values(LIST430, "flux_2_klein_9B/B04082026_Klein9B.safetensors")
check("the same filename under a different prefix is suggested first",
      n and n[0] == "B04082026_Klein9B.safetensors", n)
n2 = _CC.nearest_values(LIST430, "jibmixklein_v10.safetensors")
check("a case- and folder-only difference is found too",
      "JIBMIX/JibMixKlein_v10.SAFETENSORS" in n2, n2)
check("nothing similar yields nothing rather than a wrong guess",
      _CC.nearest_values(LIST430, "totally_unrelated_xyz.safetensors") == [], None)
check("an exact match is not offered as a correction to itself",
      "sdxl/detail.safetensors" not in
      _CC.nearest_values(LIST430, "sdxl/detail.safetensors"), None)
check("an empty list or empty value never throws",
      _CC.nearest_values([], "x") == [] and _CC.nearest_values(LIST430, "") == [], None)
check("suggestions are capped, so an error stays readable",
      len(_CC.nearest_values(["a/m.safetensors", "b/m.safetensors", "c/m.safetensors",
                              "d/m.safetensors", "e/m.safetensors", "f/m.safetensors"],
                             "z/m.safetensors")) <= 4, None)
# the combo list is read from the SAME place ComfyUI validates against
INFO = {"UNETLoader": {"input": {"required": {
    "unet_name": [["a.safetensors", "b.safetensors"], {}],
    "weight_dtype": [["default"], {}]}}}}
_real = _CC.object_info
_CC.object_info = lambda base, ct=None, timeout=15: INFO if ct == "UNETLoader" else None
try:
    check("the accepted values come from /object_info for that exact input",
          _CC.combo_values("http://x", "UNETLoader", "unet_name")
          == ["a.safetensors", "b.safetensors"], None)
    check("a non-combo input yields no list rather than junk",
          _CC.combo_values("http://x", "UNETLoader", "weight_dtype") == ["default"], None)
    check("an unreachable server yields no suggestion, not a crash",
          _CC.combo_values("http://x", "Nope", "unet_name") == [], None)
    rej = {"node_errors": {"70": {"errors": [{"message": "Value not in list",
            "extra_info": {"input_name": "unet_name",
                           "received_value": "flux_klein_9B/a.safetensors"}}]}}}
    g = {"70": {"class_type": "UNETLoader", "inputs": {}}}
    out = "\n".join(_CC.describe_rejection(rej, g, "http://x"))
    check("the rejection names the entry ComfyUI actually lists",
          "a.safetensors" in out and "ComfyUI lists this file as" in out, out)
    check("...and explains WHY the prefix differs, once",
          out.count("relative to the search path".upper()[:0] + "RELATIVE TO THE SEARCH PATH") == 1, out)
    check("without a graph the output is exactly what it always was",
          "ComfyUI lists this file as" not in "\n".join(_CC.describe_rejection(rej)), None)
finally:
    _CC.object_info = _real

# ===== the same path, spelled the other way (2.84.2) ========================
# Tim's rejection, twice: our folder scan wrote "flux_2_klein_9B/B04.safetensors"
# and ComfyUI's list held "flux_2_klein_9B\\B04.safetensors". Same file. Combo
# validation is an exact string match, so the render died for a model that was
# sitting right there.
WIN = {"UNETLoader": {"input": {"required": {
           "unet_name": [["flux_klein_9B\\jibMix.safetensors", "other.safetensors"], {}]}}},
       "LoraLoader": {"input": {"required": {
           "lora_name": [["flux_2_klein_9B\\B04.safetensors"], {}]}}}}
_real2 = _CC.object_info
_CC.object_info = lambda base, ct=None, timeout=15: (
    {ct: WIN[ct]} if ct in WIN else None)
try:
    G = {"_comment": ["ignored"],
         "70": {"class_type": "UNETLoader",
                "inputs": {"unet_name": "flux_klein_9B/jibMix.safetensors"}},
         "101": {"class_type": "LoraLoader",
                 "inputs": {"lora_name": "flux_2_klein_9B/B04.safetensors",
                            "strength_model": 1.0, "model": ["70", 0]}}}
    fixed = _CC.canonicalise_combos("http://x", G)
    check("a forward-slash name is rewritten to ComfyUI's backslash spelling",
          G["70"]["inputs"]["unet_name"] == "flux_klein_9B\\jibMix.safetensors",
          G["70"]["inputs"])
    check("...for LoRA slots too, which failed in the same render",
          G["101"]["inputs"]["lora_name"] == "flux_2_klein_9B\\B04.safetensors",
          G["101"]["inputs"])
    check("...and each repair is reported, never silent",
          len(fixed) == 2 and fixed[0][0] == "70" and fixed[0][1] == "unet_name", fixed)
    check("a non-combo input beside it is left alone",
          G["101"]["inputs"]["strength_model"] == 1.0, G["101"]["inputs"])
    check("a link input is never mistaken for a filename",
          G["101"]["inputs"]["model"] == ["70", 0], G["101"]["inputs"])
    # ALREADY CORRECT MUST BE A NO-OP: a second pass may not keep rewriting.
    again = _CC.canonicalise_combos("http://x", G)
    check("a name that already matches exactly is not touched", again == [], again)
    # AMBIGUITY IS LEFT TO FAIL. Rendering with quietly the wrong model looks
    # like a bad checkpoint and costs more than an error does.
    _CC.object_info = lambda base, ct=None, timeout=15: {ct: {"input": {"required": {
        "unet_name": [["a\\m.safetensors", "b\\m.safetensors"], {}]}}}} if ct else None
    G2 = {"70": {"class_type": "UNETLoader", "inputs": {"unet_name": "c/m.safetensors"}}}
    check("a name matching NOTHING is left for the validator to reject",
          _CC.canonicalise_combos("http://x", G2) == []
          and G2["70"]["inputs"]["unet_name"] == "c/m.safetensors", G2)
    G3 = {"70": {"class_type": "UNETLoader", "inputs": {"unet_name": "M.SAFETENSORS"}}}
    check("...and so is one that could mean two different files",
          _CC.canonicalise_combos("http://x", G3) == [], G3)
    _CC.object_info = lambda base, ct=None, timeout=15: None
    G4 = {"70": {"class_type": "UNETLoader", "inputs": {"unet_name": "x/y.safetensors"}}}
    check("an unreachable ComfyUI changes nothing rather than blanking a value",
          _CC.canonicalise_combos("http://x", G4) == []
          and G4["70"]["inputs"]["unet_name"] == "x/y.safetensors", G4)
finally:
    _CC.object_info = _real2

# ===== the Errno-22 explainer (2.81.2) ==========================
# The raw execution_error event for the ComfyUI-on-Windows stderr crash gives a
# user nothing to act on, and the same message was pasted back four times while
# two wrong fixes shipped. comfy_client recognises it and appends instructions.
import comfy_client as CC
tim = [["execution_error", {"node_id": "64", "node_type": "SamplerCustomAdvanced",
        "executed": ["73"], "exception_message": "[Errno 22] Invalid argument\n",
        "exception_type": "OSError", "traceback": ["..."]}]]
exp = CC.explain_execution_error(tim)
check("the Windows stderr crash is recognised and explained",
      "known ComfyUI-on-Windows stderr crash" in exp, exp[:160])
check("...and every line carries the worker prefix, so the app console keeps shape",
      all(l.startswith("[worker]") for l in exp.strip().splitlines() if l.strip()),
      [l for l in exp.splitlines() if l.strip() and not l.startswith("[worker]")][:2])
check("...naming the three ways out in order (2.100.0: the real-console button first)",
      "Relaunch ComfyUI in a real console" in exp and "TQDM_DISABLE=1" in exp
      and "UPDATE ComfyUI-Manager" in exp
      and exp.index("Relaunch ComfyUI") < exp.index("TQDM_DISABLE") < exp.index("UPDATE ComfyUI-Manager"),
      None)
check("...and telling the user to clear ComfyUI FIRST (2.83.1)",
      "clear-comfy.bat" in exp, exp[-260:])
# An instruction naming a file that is not in the zip is worse than no
# instruction: it reads as a broken install.
check("...and that file actually ships",
      os.path.exists(os.path.join(os.path.dirname(os.path.dirname(
          os.path.abspath(__file__))), "misc", "clear-comfy.bat")), None)
check("an ordinary error gets NO speculation appended",
      CC.explain_execution_error([["execution_error",
        {"exception_type": "ValueError", "exception_message": "boom"}]]) == "", None)
check("the explainer never throws on junk",
      CC.explain_execution_error(None) == "" and CC.explain_execution_error([]) == ""
      and CC.explain_execution_error([{"a": object}]) == "" if True else False, None)

print("=======================")
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
