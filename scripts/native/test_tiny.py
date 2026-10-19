"""bitGen Studio — 2.352.0: the native engine on the REAL diffusers pipeline (tiny random models).

    <python with torch + diffusers@d6726f3 + transformers + peft + av + torchvision> test_tiny.py [scratch dir]

Builds a tiny MiniMax-H3 + Viggle (tiny_h3.py) and ComfyUI-format copies of it
(tiny_comfy.py), then proves on CPU:
  1. the streamed engine renders t2va / fl2va / ref2va BIT-IDENTICAL to the stock pipeline;
  2. ComfyUI files (int8 ConvRot DiT + VAE, int8 text encoder, prefixed keys, fused QKV,
     gate-first SwiGLU, per-head VAE QKV) round-trip every weight and render like the official ones;
  3. int8 RAM packing renders close to bf16/fp32;
  4. a merged LoRA equals diffusers' own load_lora_adapter (Viggle's DMD LoRA path);
  5. the header-only check: OK for readable files, a pruned file sized from its shapes,
     an nvfp4 layer refused in words, a wrong model refused;
  6. the server + client: start, render, keep the models loaded, refuse in words, shut down.
Prints PASS / FAIL lines and RESULT.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import h3_engine as H      # noqa: E402
import wstream as W        # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name, flush=True)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + str(extra)[:500]), flush=True)


root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="native_tiny_")
os.makedirs(root, exist_ok=True)
import tiny_h3      # noqa: E402
base = tiny_h3.build(os.path.join(root, "m"))
vig = os.path.join(root, "m", "Viggle-Animate")
cdir = os.path.join(root, "comfy")
subprocess.run([sys.executable, os.path.join(HERE, "tiny_comfy.py"), base, cdir, "4"], check=True, capture_output=True)
img, wav, clip = os.path.join(root, "ref.png"), os.path.join(root, "voice.wav"), os.path.join(root, "clip.mp4")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=64x64", "-frames:v", "1", img], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:sample_rate=32000", "-t", "3", wav], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=64x32:rate=24", "-frames:v", "124",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", clip], check=True)
OFF = {p: {"official": f"{base}/{p}"} for p in ("transformer", "transformer_ref", "text_encoder", "vae", "audio_vae")}
CF = {"transformer": f"{cdir}/minimax_h3_fl2va_int8_convrot.safetensors", "transformer_ref": f"{cdir}/minimax_h3_ref2va_int8_convrot.safetensors",
      "vae": f"{cdir}/minimax_h3_video_vae_int8_convrot.safetensors", "audio_vae": f"{cdir}/minimax_h3_audio_vae_fp32.safetensors",
      "text_encoder": f"{cdir}/qwen3vl_32b_minimax_h3_int8.safetensors"}
quiet = lambda m: None   # noqa: E731


def job(wf, sources, **kw):
    j = dict(workflow=wf, prompt="<Picture 1> speaks with <Audio 1>" if wf == "ref2va" else "a man walks", num_frames=124,
             width=32, height=32, steps=2, seed=0, base=base, sources=sources, images=[img] if wf == "ref2va" else [],
             audios=[wav] if wf == "ref2va" else [], first=img if wf == "fl2va" else None)
    j.update(kw)
    return j


def stock(j, lora=None, fixed=None):
    from diffusers import ModularPipeline, MiniMaxH3Transformer3DModel
    from diffusers.modular_pipelines.minimax_h3 import MiniMaxH3AudioReference, MiniMaxH3ImageReference, MiniMaxH3VideoReference
    from diffusers.modular_pipelines.minimax_h3 import encoders as E
    pipe = ModularPipeline.from_pretrained(base, workflow=j["workflow"])
    pipe.load_components(pretrained_model_name_or_path=base, dtype=torch.float32)
    if j.get("canvas_short_edge"):
        s = j["canvas_short_edge"]
        pipe.register_to_config(canvas_short_edge=s, canvas_max_pixels=s * max(j["width"], j["height"]), reference_image_short_edge=s)
    kw = dict(prompt=j["prompt"], num_frames=j["num_frames"], height=j["height"], width=j["width"], num_inference_steps=j["steps"],
              generator=torch.Generator().manual_seed(j["seed"]), output_type="np", output=["videos", "audio", "sampling_rate"])
    saved = None
    if lora or fixed:
        t = MiniMaxH3Transformer3DModel.from_pretrained(os.path.join(vig, "transformer"), torch_dtype=torch.float32)
        t.load_lora_adapter(os.path.join(vig, "lora"), weight_name="pytorch_lora_weights.safetensors", prefix=None)
        pipe.transformer_ref = t

        def use_fixed(self_, components, state):
            bs = self_.get_block_state(state)
            bs.prompt_embeds, bs.text_token_tags = fixed["prompt_embeds"].float(), fixed["text_token_tags"]
            self_.set_block_state(state, bs)
            return components, state
        saved = E.MiniMaxH3Ref2VATextEncoderStep.__call__
        E.MiniMaxH3Ref2VATextEncoderStep.__call__ = use_fixed
        kw["prompt"] = fixed["presentation"]
        pipe.scheduler.set_shift(float(j.get("shift") or 3))
    if j["workflow"] == "fl2va":
        from PIL import Image
        kw["image"] = Image.open(img).convert("RGB")
    if j["workflow"] == "ref2va":
        refs = [MiniMaxH3VideoReference.from_file(v) for v in j.get("videos") or []]
        for r in refs:
            if fixed:
                r.audio, r.sample_rate = None, None
        refs += [MiniMaxH3ImageReference.from_file(p) for p in j.get("images") or []]
        refs += [MiniMaxH3AudioReference.from_file(p) for p in j.get("audios") or []]
        kw["references"] = refs
    try:
        r = pipe(**kw)
    finally:
        if saved:
            E.MiniMaxH3Ref2VATextEncoderStep.__call__ = saved
    return (np.clip(np.asarray(r["videos"][0], dtype=np.float32), 0, 1) * 255 + 0.5).astype(np.uint8)


# ---- 1. streamed == stock
eng = H.Engine(say=quiet, device="cpu")
for wf in ("t2va", "fl2va", "ref2va"):
    j = job(wf, OFF)
    a = eng.render(j)["frames"]
    b = stock(j)
    check(f"{wf}: the block-streamed engine is bit-identical to the stock diffusers pipeline", a.shape == b.shape and np.array_equal(a, b),
          (a.shape, int(np.abs(a.astype(int) - b.astype(int)).max())))
check("the models stay loaded between jobs (the cache)", {"dit:transformer", "dit:transformer_ref", "text_encoder", "vae", "audio_vae"}
      <= {e["what"] for e in eng.loaded()}, eng.loaded())

# ---- 2. ComfyUI files
tc = json.load(open(f"{base}/transformer/config.json"))
vc = json.load(open(f"{base}/vae/config.json"))


def roundtrip(comp, fn, strip, off):
    raw = W.read_comfy(CF[comp], strip=strip)
    got = {}
    for k, v in raw.items():
        for tk, tv in fn(k, v):
            got[tk] = tv.unpack(torch.device("cpu")).float() if isinstance(tv, W.Packed) else tv.float()
    ref = H.official_tensors(off)
    miss = [k for k in ref if k not in got]
    worst = max(float((got[k] - ref[k].float()).abs().max() / (ref[k].float().abs().max() + 1e-9)) for k in ref if k in got)
    return miss, worst


m, w = roundtrip("transformer", lambda k, v: W.h3_dit_key(k, v, tc["num_attention_heads"], tc["attention_head_dim"]), H.DIT_PREFIXES, f"{base}/transformer")
check("ComfyUI DiT (int8 ConvRot, fused QKV, gate-first SwiGLU, model.diffusion_model.) -> every diffusers weight within int8 error",
      not m and w < 0.02, (m[:3], w))
m, w = roundtrip("vae", lambda k, v: W.h3_vae_key(k, v, vc["decoder_num_attention_heads"], vc["decoder_attention_head_dim"]), H.VAE_PREFIXES, f"{base}/vae")
check("ComfyUI video VAE (int8 ConvRot, per-head interleaved QKV, original names) -> every weight", not m and w < 0.02, (m[:3], w))
raw = W.read_comfy(CF["text_encoder"])
got = {W.qwen3vl_key(k): (v.unpack(torch.device("cpu")).float() if isinstance(v, W.Packed) else v.float()) for k, v in raw.items()}
ref = H.official_tensors(f"{base}/text_encoder")
check("ComfyUI Qwen3-VL (qwen3vl_32b.transformer., HF-original names, int8) -> every weight",
      not [k for k in ref if k not in got and not k.startswith("lm_head")] and max(
          float((got[k] - ref[k].float()).abs().max() / (ref[k].float().abs().max() + 1e-9)) for k in ref if k in got) < 0.02)
for comp, f in CF.items():
    r = H.check_source(comp, {"comfy": f}, base)
    check(f"header check: the ComfyUI {comp} file is readable ({r['why']})", r["ok"], r)
eng2 = H.Engine(say=quiet, device="cpu")
jr = job("ref2va", {k: {"comfy": v} for k, v in CF.items()})
a = eng2.render(jr)["frames"].astype(float)
b = eng.render(job("ref2va", OFF))["frames"].astype(float)
check("a ref2va render from the ComfyUI files is the official render within int8 noise", np.abs(a - b).mean() < 2.0, np.abs(a - b).mean())

# ---- 3. int8 packing
eng3 = H.Engine(say=quiet, device="cpu", pack_mode="int8", force_pack=True)
a = eng3.render(job("t2va", OFF))["frames"].astype(float)
b = eng.render(job("t2va", OFF))["frames"].astype(float)
st3 = [e for e in eng3.cache.values() if e.get("streamer")]
kinds = {v.kind for e in st3 for v in e["streamer"].store.values()}
check("int8 RAM packing (per-row) renders within int8 noise of full precision", "i8" in kinds and np.abs(a - b).mean() < 2.0, (kinds, np.abs(a - b).mean()))

# ---- 4. Viggle: the merged LoRA == diffusers' adapter
fixed = torch.load(os.path.join(vig, "assets", "fixed_embed_fwd_anyframe.pt"), weights_only=False)
jv = job("ref2va", dict(OFF, transformer_ref={"official": os.path.join(vig, "transformer")}), videos=[clip], images=[img], audios=[],
         width=64, height=32, steps=4, shift=3, canvas_short_edge=32,
         loras=[{"path": os.path.join(vig, "lora", "pytorch_lora_weights.safetensors"), "weight": 1.0}])
a = H.Engine(say=quiet, device="cpu").render(jv, fixed=fixed)["frames"].astype(float)
b = stock(jv, lora=True, fixed=fixed).astype(float)
check("Viggle: the DMD LoRA merged at load renders like diffusers' load_lora_adapter (fp32 rounding only)",
      a.shape == b.shape and np.abs(a - b).max() <= 2, (a.shape, b.shape, np.abs(a - b).max() if a.shape == b.shape else None))
try:
    H.Engine(say=quiet, device="cpu").render(dict(jv, loras=[{"path": CF["audio_vae"], "weight": 1}]), fixed=fixed)
    check("a LoRA that matches no weight is refused in words", False)
except W.Unsupported as e:
    check("a LoRA that matches no weight is refused in words", "matched no weight" in str(e), str(e))

# ---- 5. the header check on bad / odd files
from safetensors.torch import load_file, save_file   # noqa: E402
sd = load_file(CF["transformer"])
pruned = {k: v for k, v in sd.items() if not k.startswith("model.diffusion_model.blocks.1.")}
pf = os.path.join(cdir, "minimax_h3_fl2va_pruned_int8_convrot.safetensors")
save_file(pruned, pf)
r = H.check_source("transformer", {"comfy": pf}, base)
check("a pruned DiT (fewer blocks) is sized from its own shapes", r["ok"] and "1 blocks" in r["why"], r)
bad = dict(sd)
lay = next(k[: -len("comfy_quant")] for k in sd if k.endswith("comfy_quant"))
bad[lay + "comfy_quant"] = torch.tensor(list(json.dumps({"format": "nvfp4"}).encode()), dtype=torch.uint8)
bf = os.path.join(cdir, "minimax_h3_fl2va_nvfp4.safetensors")
save_file(bad, bf)
r = H.check_source("transformer", {"comfy": bf}, base)
check("an nvfp4 layer is refused in words (-> the official download)", not r["ok"] and "nvfp4" in r["why"] and "download" in r["why"], r)
r = H.check_source("transformer", {"comfy": CF["vae"]}, base)
check("a file of another model is refused (not a MiniMax-H3 DiT)", not r["ok"], r)
r = H.check_source("text_encoder", {"comfy": CF["transformer"]}, base)
check("the wrong file for the text encoder is refused with what is missing", not r["ok"] and "missing" in r["why"], r)

# ---- 6. server + client
sys.path.insert(0, os.path.join(os.path.dirname(HERE)))
import native_client as NC   # noqa: E402
port = 8397
logd = os.path.join(root, "logs")
n = {"python": sys.executable, "port": port, "device": "cpu", "idle_exit_min": 10, "log_dir": logd, "app_dir": root}
lines = []
b_url = NC.ensure(n, lines.append)
t0 = time.time()
fin = NC.run(b_url, "h3", dict(job("t2va", OFF), out_frames=os.path.join(root, "o.rgb"), out_audio=os.path.join(root, "o.f32")), lines.append)
t1 = time.time() - t0
t0 = time.time()
fin2 = NC.run(b_url, "h3", dict(job("t2va", OFF, seed=5), out_frames=os.path.join(root, "o.rgb"), out_audio=os.path.join(root, "o.f32")), lines.append)
t2 = time.time() - t0
h = NC.health(b_url)
check("server: renders through the client, the second job reuses the loaded models", fin["meta"]["frames"] == 124 and fin2["meta"]["frames"] == 124
      and any(m["what"] == "dit:transformer" for m in h["loaded"]) and sum("ready in" in ln for ln in lines) == 2, (t1, t2, lines[-6:]))
NC.to_video(fin2["meta"], os.path.join(root, "o.rgb"), os.path.join(root, "o.f32"), os.path.join(root, "o.raw.avi"), os.path.join(root, "o.mp4"),
            ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac"], say=quiet, keep=100)
nf = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0",
                     os.path.join(root, "o.mp4")], capture_output=True, text=True).stdout.strip()
check("to_video: the FFV1 master + the playback file, cut to the frames kept", nf == "100" and os.path.isfile(os.path.join(root, "o.raw.avi")), nf)
try:
    NC.run(b_url, "h3", dict(job("ref2va", dict(OFF, transformer_ref={"comfy": "/nope.safetensors"})), out_frames=os.path.join(root, "x.rgb")), quiet)
    check("server: a missing file is refused in words", False)
except NC.NativeError as e:
    check("server: a missing file is refused in words", "weights are not there" in str(e), str(e))
NC.shutdown(b_url)
time.sleep(1.5)
check("server: /shutdown ends it", NC.health(b_url) is None)
shutil.rmtree(root, ignore_errors=True) if len(sys.argv) < 2 else None
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
