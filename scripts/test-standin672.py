#!/usr/bin/env python3
"""bitGen Studio — 2.672.0 units: a missing MOSS-Image VAE / text encoder swapped for the same model in another size /
precision that ComfyUI DOES list (scripts/comfy_client.py stand_in_files, run from canonicalise_combos by every worker).

Tim's log: node 71 CLIPLoader.clip_name = qwen3.5_9b_w4a8_gptq.safetensors "not in (list of length 28)"; node 72
VAELoader.vae_name = flux2-vae_small.safetensors "not in (list of length 23)" - "ComfyUI lists this file as: ae.safetensors,
flux2-vae.safetensors".
Run: python3 scripts/test-standin672.py
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_client as CC                                    # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


G = {"71": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3.5_9b_w4a8_gptq.safetensors", "type": "moss_image"}},
     "72": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae_small.safetensors"}}}
VAES = ["ae.safetensors", "flux2-vae.safetensors", "sdxl_vae.safetensors"]

g = copy.deepcopy(G)
r = CC.stand_in_files(None, g, {("VAELoader", "vae_name"): VAES, ("CLIPLoader", "clip_name"): ["qwen_3_4b.safetensors"]})
check("Tim's VAE: flux2-vae_small missing, flux2-vae listed -> flux2-vae (said why)",
      g["72"]["inputs"]["vae_name"] == "flux2-vae.safetensors" and any(x[0] == "72" and "stand-in" in x[3] for x in r), r)
check("…no Qwen3.5 9B text encoder at all: left alone (rejected with the catalog hint - nothing else is the same model)",
      g["71"]["inputs"]["clip_name"] == "qwen3.5_9b_w4a8_gptq.safetensors" and not any(x[0] == "71" for x in r), r)
g = copy.deepcopy(G)
CC.stand_in_files(None, g, {("VAELoader", "vae_name"): VAES, ("CLIPLoader", "clip_name"): ["MOSS\\qwen3.5_9b_int8_convrot.safetensors", "t5xxl.safetensors"]})
check("a text encoder variant in a subfolder: w4a8 missing, int8 listed -> MOSS\\qwen3.5_9b_int8_convrot (ComfyUI's spelling)",
      g["71"]["inputs"]["clip_name"] == "MOSS\\qwen3.5_9b_int8_convrot.safetensors", g["71"])
g = copy.deepcopy(G)
CC.stand_in_files(None, g, {("VAELoader", "vae_name"): ["flux2-vae_small.safetensors", "flux2-vae.safetensors"], ("CLIPLoader", "clip_name"): ["qwen3.5_9b_w4a8_gptq.safetensors", "qwen3.5_9b_bf16.safetensors"]})
check("the asked files listed: nothing changes", g == G, g)
g = {"1": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}}}
CC.stand_in_files(None, g, {("VAELoader", "vae_name"): ["flux2-vae_small.safetensors"]})
check("one way only: the small VAE never stands in for the full one (it may not encode)", g["1"]["inputs"]["vae_name"] == "flux2-vae.safetensors")
g = {"1": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae_small.safetensors"}}}
CC.stand_in_files(None, g, {("VAELoader", "vae_name"): ["a/flux2-vae.safetensors", "b/flux2-vae.safetensors"]})
check("two files of the stand-in's name: ambiguous - left alone", g["1"]["inputs"]["vae_name"] == "flux2-vae_small.safetensors")
src = open(os.path.join(HERE, "comfy_client.py"), encoding="utf-8").read()
check("every worker gets it: canonicalise_combos runs stand_in_files", "fixed.extend(stand_in_files(base, graph))" in src)
print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
