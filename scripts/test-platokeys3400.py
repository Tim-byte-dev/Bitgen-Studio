#!/usr/bin/env python3
"""bitGen Studio — 3.4.0: Basic Settings ▸ Text encoder written into the graph a render sends (scripts/plato_keys_apply.py),
and the same answers as lib/platoKeys.js (one set of rules: lib/platoKeys.json).
Tim (verbatim): "add a text encoder dropdown in basic settings to overide the models own. when we overide the text encoder
for our local llm it will automatically use the plato workflows. top option will be styles own." """
import copy, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import plato_keys_apply as PK

P = F = 0
def check(n, c, got=None):
    global P, F
    if c: P += 1; print("PASS: " + n)
    else: F += 1; print("FAIL: " + n + ("" if got is None else "\n      got " + repr(got)[:700]))

H3K = "minimax_h3_32b_pk_ridge_qwen3.5_2b.safetensors"
KEYS = ["moss_image/qwen35_2b_comfy_to_qwen35_9b_moss_ridge.safetensors", "moss_image/qwen35_2b_to_qwen35_9b_moss_image_ridge.safetensors",
        "moss_image/qwen35_9b_to_qwen35_2b_moss_image_ridge.safetensors", "krea2/qwen35_2b_to_qwen3vl_4b_krea2_ridge.safetensors",
        "krea2/qwen35_9b_to_qwen3vl_4b_krea2_ridge.safetensors", "ablations/qwen35_2b_to_qwen3vl_4b_krea2_ridge_norm.safetensors",
        "z_image/qwen3vl_4b_to_zimage_qwen3_4b_ridge.safetensors", H3K]
TE = "qwen3.5_2b_bf16.safetensors"
FEARN = {"input": {"required": {"clip": ["CLIP"], "key_name": [[H3K, "other.safetensors"]], "strength": ["FLOAT", {"default": 1.0}],
                                "key_path": ["STRING", {"default": ""}], "debug": ["BOOLEAN", {"default": False}]}}}
INFO = {"online": True, "encoders": [TE, "qwen3.5_9b_w4a8_gptq.safetensors", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "qwen3vl_4b_fp8_scaled.safetensors"],
        "types": ["stable_diffusion", "qwen_image", "minimax", "moss_image", "krea2", "lumina2"], "official": True, "keys": KEYS,
        "fearn": True, "fearn_keys": [H3K], "fearn_spec": FEARN}

# the rules - the same answers as the Node side
check("parse_key: an official key, a stock-ComfyUI one, Tim's H3 key; ablations / the reverse key skipped",
      PK.parse_key(KEYS[0]) == {"name": KEYS[0], "family": "moss", "source": "qwen352b", "comfy": True, "official": True}
      and PK.parse_key(H3K)["family"] == "h3" and PK.parse_key(H3K)["source"] == "qwen352b" and not PK.parse_key(H3K)["official"]
      and PK.parse_key(KEYS[2]) is None and PK.parse_key(KEYS[5]) is None, [PK.parse_key(k) for k in KEYS])
check("pick_key: the stock-ComfyUI key first; 2B is not 20B", PK.pick_key(KEYS, "LLMs\\qwen3.5_2b-w6a8_convrot.safetensors", "moss") == KEYS[0]
      and PK.pick_key(KEYS, TE, "h3") == H3K and PK.pick_key(KEYS, "qwen3.5_20b.safetensors", "h3") == "" and PK.pick_key(KEYS, TE, "krea2") == KEYS[3])
node = r"""
const P = require(process.argv[1] + "/lib/platoKeys.js"), K = JSON.parse(process.argv[2]);
const out = {};
for (const k of K.keys) out[k] = P.parseKey(k);
out.picks = ["moss", "krea2", "h3", "zimage"].map((f) => [P.pickKey(K.keys, K.te, f), P.pickKey(K.keys, "qwen3vl_4b_fp8_scaled.safetensors", f)]);
out.fam = P.familyOfLoader("qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "minimax") && P.familyOfLoader("qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "minimax").id;
console.log(JSON.stringify(out));
"""
try:
    js = json.loads(subprocess.run(["node", "-e", node, os.path.join(HERE, ".."), json.dumps({"keys": KEYS, "te": TE})],
                                   capture_output=True, text=True, timeout=60).stdout)
    py = {k: PK.parse_key(k) for k in KEYS}
    py["picks"] = [[PK.pick_key(KEYS, TE, f), PK.pick_key(KEYS, "qwen3vl_4b_fp8_scaled.safetensors", f)] for f in ["moss", "krea2", "h3", "zimage"]]
    py["fam"] = PK.family_of_loader("qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "minimax")["id"]
    check("lib/platoKeys.js gives the same answers (parse, pick, family)", js == py, (js, py))
except Exception as e:                       # noqa: BLE001
    check("lib/platoKeys.js gives the same answers (node ran)", False, e)

# H3 (Tim's key, his PlatosKeyPatchCLIP node): the loader keeps type minimax, every CLIP consumer is rewired
G = {"1": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax"}},
     "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 0], "text": "a fox"}},
     "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 0], "text": "blurry"}},
     "4": {"class_type": "RemakeConditioning", "inputs": {"clip": ["1", 0], "vae": ["9", 0], "prompt": "x"}},
     "9": {"class_type": "VAELoader", "inputs": {"vae_name": "v.safetensors"}}}
g, said = copy.deepcopy(G), []
r = PK.apply_text_encoder("http://x", g, TE, say=said.append, info=INFO)
new = [k for k in g if k not in G]
pn = next((g[k] for k in new if g[k]["class_type"] == "PlatosKeyPatchCLIP"), None)
check("H3: the 32B loader loads the 2B (type minimax kept) + PlatosKeyPatchCLIP with Tim's key",
      r["changed"] == ["1"] and g["1"]["inputs"]["clip_name"] == TE and g["1"]["inputs"]["type"] == "minimax" and pn is not None
      and pn["inputs"]["key_name"] == H3K and pn["inputs"]["clip"] == ["1", 0] and pn["inputs"]["strength"] == 1.0 and pn["inputs"]["debug"] is False, (r, g))
check("…both prompts and the Viggle Remake conditioning take the patched CLIP", all(g[k]["inputs"]["clip"] == [new[0], 0] for k in ("2", "3", "4")), g)
check("…said in the job's log", said and said[0].startswith("[text encoder] Basic Settings - MiniMax H3 (node 1): qwen3.5_2b_bf16.safetensors + key " + H3K), said)

# MOSS (official nodes): Load + PatchCLIP, the loader as qwen_image
G2 = {"5": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3.5_9b_w4a8_gptq.safetensors", "type": "moss_image", "device": "default"}},
      "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["5", 0], "text": "a fox"}}}
g = copy.deepcopy(G2)
r = PK.apply_text_encoder("http://x", g, TE, say=lambda t: None, info=INFO)
L = next((k for k in g if g[k]["class_type"] == "plato_keys.Load"), None)
Pt = next((k for k in g if g[k]["class_type"] == "plato_keys.PatchCLIP"), None)
check("MOSS: plato_keys.Load (the stock-ComfyUI key) + plato_keys.PatchCLIP (the node's defaults), the 2B as qwen_image",
      r["changed"] == ["5"] and L and Pt and g[L]["inputs"]["key_name"] == KEYS[0] and g[Pt]["inputs"] == {"clip": ["5", 0], "plato_key": [L, 0], "contrast": 1.0,
      "scale_multiplier": 1.0, "norm_match": "off", "honor_key_template": True, "honor_key_layer": True} and g["5"]["inputs"]["type"] == "qwen_image"
      and g["6"]["inputs"]["clip"] == [Pt, 0], g)

# a GGUF H3 loader becomes a CLIPLoader
g = {"7": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "type": "minimax"}},
     "8": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["7", 0], "text": "x"}}}
PK.apply_text_encoder("http://x", g, TE, say=lambda t: None, info=INFO)
check("a GGUF H3 encoder: the loader becomes a CLIPLoader of the pick", g["7"]["class_type"] == "CLIPLoader" and g["7"]["inputs"]["clip_name"] == TE, g)

# no key / not in ComfyUI / nothing picked / a style of another family
g, said = copy.deepcopy(G2), []
r = PK.apply_text_encoder("http://x", g, "qwen3vl_4b_fp8_scaled.safetensors", say=said.append, info=INFO)
check("no key for the pick on that family: the style's own kept, said", r == {"changed": [], "kept": ["5"]} and g == G2 and "its own encoder kept" in said[0], said)
g, said = copy.deepcopy(G2), []
PK.apply_text_encoder("http://x", g, "nothere.safetensors", say=said.append, info=INFO)
check("a file this ComfyUI does not have: nothing changes, said", g == G2 and "not in this ComfyUI's text encoders" in said[0], said)
g, said = copy.deepcopy(G2), []
check("Style's own (nothing picked): nothing changes, nothing said", PK.apply_text_encoder("http://x", g, "", say=said.append, info=INFO) == {"changed": [], "kept": []} and g == G2 and not said)
g = {"1": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_8b_fp8mixed.safetensors", "type": "flux2"}}, "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 0]}}}
g0, said = copy.deepcopy(g), []
PK.apply_text_encoder("http://x", g, TE, say=said.append, info=INFO)
check("a style of no PlatoKeys family (FLUX.2): nothing changes, said", g == g0 and "nothing changed" in said[0], said)
I2 = dict(INFO, official=False, fearn=False)
g, said = copy.deepcopy(G2), []
PK.apply_text_encoder("http://x", g, TE, say=said.append, info=I2)
check("the PlatoKeys nodes not in ComfyUI: own kept, the add-on named", g == G2 and "Add-ons ▸ 🔑 PlatoKeys" in said[0], said)
os.environ["BITGEN_TEXT_ENCODER"] = TE
g = copy.deepcopy(G2); PK.apply_text_encoder("http://x", g, say=lambda t: None, info=INFO)
check("from the job's environment (BITGEN_TEXT_ENCODER - lib/samplers.js envOf)", g["5"]["inputs"]["clip_name"] == TE)
os.environ.pop("BITGEN_TEXT_ENCODER", None)

src = open(os.path.join(HERE, "comfy_client.py"), encoding="utf-8").read()
w = open(os.path.join(HERE, "..", "misc", "worker.py"), encoding="utf-8").read()
check("queue() applies it before sending; worker.py's own send too",
      "plato_keys_apply.apply_text_encoder(base, graph)" in src.split("def queue(")[1][:900] and "plato_keys_apply.apply_text_encoder(base, graph, say=say)" in w)
print(f"\n{P} passed, {F} failed")
sys.exit(1 if F else 0)
