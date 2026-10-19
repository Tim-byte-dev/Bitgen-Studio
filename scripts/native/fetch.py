"""bitGen Studio — download the native engine's official weights (2.352.0). Runs INSIDE venvs/native.

    python fetch.py <root> <component>[,<component>...] [--dry-run]

components (mirrors lib/nativeEngine.js COMPONENTS):
  base             MiniMaxAI/MiniMax-H3: the model index, every config.json,
                   tokenizer, processor, both schedulers, the weight indexes (~25 MB)
  vae / audio_vae  the video VAE (10.4 GB) / the audio VAE (0.6 GB)
  text_encoder     Qwen3-VL-32B - ONLY the shards holding the 51 decoder layers
                   (+ vision tower) H3 reads (the index says which), ~54 GB of 66.7
  transformer      the fl2va / t2va DiT (66.3 GB)
  transformer_ref  the ref2va DiT (66.3 GB)
  viggle           Viggle/Viggle-Animate transformer (~66 GB)
  viggle_lora      Viggle's DMD LoRA only (lora/, ~2.5 GB)
  viggle_assets    Viggle's frozen prompt embedding only (assets/, a few MB)
Resumable (an interrupted download carries on); the token comes from HF_TOKEN.
"""
import json
import os
import shutil
import sys

H3 = "MiniMaxAI/MiniMax-H3"
VIGGLE = "Viggle/Viggle-Animate"
TE_LAYERS = 51
SIMPLE = {
    "base": (H3, "MiniMax-H3", ["modular_model_index.json", "model_index.json", "LICENSE", "*/config.json",
                                "*/*.index.json", "tokenizer/*", "processor/*", "scheduler/*", "audio_scheduler/*",
                                "text_encoder/*.json", "text_encoder/*.txt"], 0.03),
    "vae": (H3, "MiniMax-H3", ["vae/*"], 10.4),
    "audio_vae": (H3, "MiniMax-H3", ["audio_vae/*"], 0.6),
    "transformer": (H3, "MiniMax-H3", ["transformer/*"], 66.3),
    "transformer_ref": (H3, "MiniMax-H3", ["transformer_ref/*"], 66.3),
    "viggle": (VIGGLE, "Viggle-Animate", ["transformer/*", "LICENSE", "LICENSE-CODE", "NOTICE", "README.md"], 66),
    # 2.353.0: the DMD LoRA on its own (a missing LoRA no longer pulls the 66 GB transformer)
    "viggle_lora": (VIGGLE, "Viggle-Animate", ["lora/*", "LICENSE", "LICENSE-CODE", "NOTICE"], 2.5),
    "viggle_assets": (VIGGLE, "Viggle-Animate", ["assets/*", "LICENSE", "LICENSE-CODE", "NOTICE"], 0.01),
}


def say(m):
    print("[fetch] " + m, flush=True)


def fail(m):
    say("ERROR: " + m)
    sys.exit(1)


def te_shards(index_path):
    """The text-encoder shards that hold what H3 reads (decoder layers < 51, the vision tower, embeddings)."""
    idx = json.load(open(index_path, encoding="utf-8"))["weight_map"]
    need = set()
    for k, f in idx.items():
        if k.startswith("lm_head."):
            continue
        if k.startswith("model.language_model.layers."):
            if int(k.split(".")[3]) >= TE_LAYERS:
                continue
        need.add(f)
    return sorted(need)


def main(argv):
    if len(argv) < 3:
        fail("usage: fetch.py <root> <component,...> [--dry-run]")
    root = os.path.abspath(argv[1])
    comps = [c for c in argv[2].split(",") if c]
    dry = "--dry-run" in argv
    bad = [c for c in comps if c not in SIMPLE and c != "text_encoder"]
    if bad:
        fail(f"unknown component(s): {', '.join(bad)}")
    os.makedirs(root, exist_ok=True)
    if "text_encoder" in comps and "base" not in comps:
        comps = ["base"] + comps                         # the shard index comes with base
    gb = sum(SIMPLE[c][3] for c in comps if c in SIMPLE) + (54 if "text_encoder" in comps else 0)
    free = shutil.disk_usage(root).free / 2 ** 30
    say(f"into {root}: {', '.join(comps)} - up to ~{gb:.0f} GB (less if some is already there), {free:.0f} GB free")
    if not dry and free < gb * 0.3 and free < 20:
        fail(f"only {free:.0f} GB free on that drive - the swap dialog's ⚙ -> Viggle native -> the folder puts the weights elsewhere")
    if dry:
        for c in comps:
            if c in SIMPLE:
                repo, sub, inc, g = SIMPLE[c]
                say(f"would fetch {c}: {repo} ({', '.join(inc)}) -> {os.path.join(root, sub)}")
            else:
                say(f"would fetch text_encoder: {H3} text_encoder shards for layers < {TE_LAYERS} -> {os.path.join(root, 'MiniMax-H3')}")
        return 0
    try:
        from huggingface_hub import snapshot_download
    except Exception as e:                                        # noqa: BLE001
        fail(f"huggingface_hub is not in the native venv ({e}) - ⤓ Install again")
    token = os.environ.get("HF_TOKEN") or None

    def get(repo, sub, inc, what):
        dest = os.path.join(root, sub)
        say(f"{what}: {repo} -> {dest}")
        try:
            snapshot_download(repo_id=repo, local_dir=dest, allow_patterns=inc, token=token, max_workers=8)
        except Exception as e:                                    # noqa: BLE001
            name, text = type(e).__name__, str(e)
            if "Gated" in name or "gated" in text or "401" in text or "403" in text:
                fail(f"{repo} is gated: open https://huggingface.co/{repo} while logged in, accept its license, then set "
                     "that account's token in Settings (Hugging Face token) and ⤓ Install again")
            fail(f"downloading {what} failed: {name}: {text[:300]}")
    for c in comps:
        if c == "text_encoder":
            continue
        repo, sub, inc, _g = SIMPLE[c]
        get(repo, sub, inc, c)
    if "text_encoder" in comps:
        ip = os.path.join(root, "MiniMax-H3", "text_encoder", "model.safetensors.index.json")
        if not os.path.isfile(ip):
            fail("the text encoder's shard index did not come down with base - ⤓ Install again")
        shards = te_shards(ip)
        say(f"text_encoder: {len(shards)} of {len(set(json.load(open(ip))['weight_map'].values()))} shards hold the "
            f"{TE_LAYERS} layers H3 reads")
        get(H3, "MiniMax-H3", ["text_encoder/" + s for s in shards], "text_encoder")
    say("done: " + ", ".join(comps))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
