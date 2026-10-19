"""bitGen Studio — the native MiniMax-H3 engine (2.352.0). Runs INSIDE venvs/native.

Renders MiniMax-H3 t2va / fl2va / ref2va (and Viggle-Animate, which is H3
ref2va with its own transformer + LoRA + a frozen prompt) through Hugging Face
diffusers' `minimax_h3` modular pipeline (Apache-2.0) - no ComfyUI. The big
models (the 33B DiT, the Qwen3-VL-32B conditioner) are packed in RAM and
streamed block by block (wstream.py); the VAEs sit on the GPU. Loaded models
stay in RAM between jobs (an LRU under a RAM budget), so only the first
render of a session pays the load.

Each component comes from ONE source:
  {"official": <dir>}   the diffusers folder (Hugging Face download)
  {"comfy": <file>}     a ComfyUI safetensors file - bf16, int8, int8-ConvRot
                        or fp8 - converted on load (wstream key maps), pruned
                        DiTs sized from the file itself; anything else is
                        refused in words (-> download the official one)
The small parts (configs, tokenizer, processor, schedulers) always come from
the official base folder.
"""
import collections
import glob
import json
import os
import time

import numpy as np
import torch

import wstream as W

TE_LAYERS = 51          # H3 reads hidden_states[50]: 51 decoder layers are all it needs
FPS = 24


Shape = W.Shape


def _say_default(m):
    print("[native] " + m, flush=True)


def official_tensors(folder, keep=None, say=None):
    """{key: tensor} from every safetensors file in a diffusers folder (keep(key) filters)."""
    from safetensors import safe_open
    out = {}
    files = sorted(glob.glob(os.path.join(folder, "*.safetensors")))
    if not files:
        raise W.Unsupported(f"no .safetensors files in {folder}")
    for i, f in enumerate(files, 1):
        if say and len(files) > 1:
            say(f"reading {os.path.basename(folder)} {i}/{len(files)} ({os.path.getsize(f) / 2 ** 30:.1f} GB)")
        with safe_open(f, framework="pt") as h:
            for k in h.keys():
                if keep is None or keep(k):
                    out[k] = h.get_tensor(k)
    return out


def header(path):
    """{key: shape} + {layer: comfy_quant conf} of a safetensors file, reading no weight data."""
    from safetensors import safe_open
    shapes, confs = {}, {}
    with safe_open(path, framework="pt") as f:
        for k in f.keys():
            shapes[k] = tuple(f.get_slice(k).get_shape())
        for p in W.comfy_layers(shapes):
            confs[p] = json.loads(bytes(f.get_tensor(p + "comfy_quant").to(torch.uint8).tolist()).decode("utf-8"))
    return shapes, confs


DIT_PREFIXES = ("model.diffusion_model.", "diffusion_model.", "model.", "transformer.")
VAE_PREFIXES = ("first_stage_model.", "vae.", "model.")


def _strip(k, prefixes):
    for p in prefixes:
        if k.startswith(p):
            return k[len(p):]
    return k


def dit_config_for(base_cfg, shapes):
    """The DiT config a (possibly pruned) ComfyUI file needs: its block count + FFN width from the shapes."""
    cfg = dict(base_cfg)
    ks = {_strip(k, DIT_PREFIXES): v for k, v in shapes.items()}
    blocks = sorted({int(k.split(".")[1]) for k in ks if k.startswith("blocks.") and k.split(".")[1].isdigit()})
    if not blocks:
        raise W.Unsupported("not a MiniMax-H3 DiT file (no blocks.N keys)")
    if blocks != list(range(len(blocks))):
        raise W.Unsupported(f"the blocks are not numbered 0..{len(blocks) - 1} (a pruning layout the engine does not know)")
    cfg["num_layers"] = len(blocks)
    ffn = {v[0] // 2 for k, v in ks.items() if k.endswith(".mlp.fc1.weight") and k.startswith("blocks.")}
    if len(ffn) != 1:
        raise W.Unsupported(f"the FFN width differs between blocks ({sorted(ffn)[:4]}) - not loadable")
    cfg["ffn_dim"] = ffn.pop()
    rf = sorted({int(k.split(".")[2]) for k in ks if k.startswith("token_refiner.blocks.")})
    if rf:
        cfg["num_refiner_layers"] = len(rf)
    return cfg


def need(src, what):
    """A source that points at nothing is said in words (not a FileNotFoundError)."""
    p = src.get("comfy") or src.get("official") or ""
    if not p or not os.path.exists(p):
        raise W.Unsupported(f"the {what} weights are not there ({p or 'no source set'}) - the swap dialog's ⚙ -> Viggle native "
                            "-> ⤓ Install or 🔍 Use my ComfyUI files")


class Engine:
    def __init__(self, say=_say_default, device=None, ram_budget_gb=None, pack_mode="int8", pin=True, force_pack=False):
        self.say = say
        self.device = torch.device(device) if device else torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.dtype = torch.bfloat16 if self.device.type == "cuda" else torch.float32
        self.pack_mode = pack_mode if (self.device.type == "cuda" or force_pack) else "bf16"   # CPU: exact unless a test forces int8
        self.pin = pin
        self.ram_budget = (ram_budget_gb or 0) * 2 ** 30
        self.cache = collections.OrderedDict()      # key -> {"model", "streamer", "bytes"}
        self._patch_device()

    # ---------------------------------------------------------- housekeeping
    def _patch_device(self):
        from diffusers.modular_pipelines.minimax_h3 import modular_pipeline as MP
        dev = self.device
        # the streamed models keep their big blocks on "meta" between calls - the pipeline must not guess from them
        MP.MiniMaxH3ModularPipeline._execution_device = property(lambda _self: dev)

    def _get(self, key):
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def _put(self, key, entry):
        self.cache[key] = entry
        self._evict(keep=key)

    def _evict(self, keep=None, need=0):
        if not self.ram_budget:
            return
        while sum(e["bytes"] for e in self.cache.values()) + need > self.ram_budget and len(self.cache) > 1:
            k = next(iter(self.cache))
            if k == keep:
                break
            e = self.cache.pop(k)
            if e.get("streamer"):
                e["streamer"].close()
            self.say(f"unloaded {k[0]} to stay under the RAM budget")
            del e
        torch.cuda.empty_cache() if self.device.type == "cuda" else None

    def unload(self):
        for e in self.cache.values():
            if e.get("streamer"):
                e["streamer"].close()
        self.cache.clear()
        import gc
        gc.collect()
        if self.device.type == "cuda":
            torch.cuda.empty_cache()

    def loaded(self):
        return [{"what": k[0], "source": k[1], "gb": round(e["bytes"] / 2 ** 30, 1)} for k, e in self.cache.items()]

    # ---------------------------------------------------------- the stores
    def _pack_all(self, sd):
        dev = self.device if self.device.type == "cuda" else None
        out = {}
        n, step = len(sd), max(1, len(sd) // 10)
        for i, (k, v) in enumerate(sd.items(), 1):
            if n > 200 and i % step == 0:
                self.say(f"packing the weights {int(100 * i / n)}%" + (" (int8 in RAM)" if self.pack_mode == "int8" else ""))
            if isinstance(v, W.Packed):
                v.dtype = self.dtype
                out[k] = v
            else:
                out[k] = W.pack(v, "int8" if self.pack_mode == "int8" else "none", self.dtype, dev)
        return out

    def _merge_loras(self, store, loras, key_map, want):
        for lo in loras or []:
            from safetensors.torch import load_file
            sd = load_file(lo["path"])
            sd = {_strip(k, DIT_PREFIXES + ("base_model.model.",)): v for k, v in sd.items()}
            direct = any(k.replace(".lora_A.weight", ".weight").replace(".lora_B.weight", ".weight") in want for k in sd)
            deltas = W.lora_delta(sd, (lambda k, d: [(k, d)]) if direct else key_map, float(lo.get("weight", 1.0)))
            hit = 0
            for tk, d in deltas.items():
                if tk not in store:
                    continue
                base = store[tk]
                dev = self.device if self.device.type == "cuda" else torch.device("cpu")
                w = (base.unpack(dev) if isinstance(base, W.Packed) else base.to(dev)).float() + d.to(dev)
                store[tk] = W.pack(w, "int8" if self.pack_mode == "int8" else "none", self.dtype, dev)
                hit += 1
            if not hit:
                raise W.Unsupported(f"the LoRA {os.path.basename(lo['path'])} matched no weight of the model")
            self.say(f"LoRA {os.path.basename(lo['path'])} @ {lo.get('weight', 1.0)} merged into {hit} weights")

    def _nbytes(self, store):
        return sum(v.nbytes() if isinstance(v, W.Packed) else v.numel() * v.element_size() for v in store.values())

    # ---------------------------------------------------------- components
    def dit(self, which, src, base, loras=()):
        """which: transformer (t2va/fl2va) | transformer_ref (ref2va). -> the streamed model."""
        from diffusers import MiniMaxH3Transformer3DModel
        key = ("dit:" + which, json.dumps(src, sort_keys=True), self.pack_mode, json.dumps(list(loras), sort_keys=True))
        e = self._get(key)
        if e:
            return e["model"]
        for k in [k for k in self.cache if k[0] == "dit:" + which]:     # one copy per partition
            self.cache.pop(k)["streamer"].close()
        need(src, which)
        t0 = time.time()
        # an official folder brings its own config (Viggle's transformer); a ComfyUI file is sized from base + its shapes
        cpath = os.path.join(src["official"], "config.json") if "official" in src else os.path.join(base, which, "config.json")
        cfg = json.load(open(cpath, encoding="utf-8"))
        cfg = {k: v for k, v in cfg.items() if not k.startswith("_")}
        if "comfy" in src:
            shapes, _c = header(src["comfy"])
            cfg = dit_config_for(cfg, shapes)
            self.say(f"reading {os.path.basename(src['comfy'])} (ComfyUI file, {cfg['num_layers']} blocks)")
            raw = W.read_comfy(src["comfy"], strip=DIT_PREFIXES)
            sd = {}
            for k, v in raw.items():
                for tk, tv in W.h3_dit_key(k, v, cfg["num_attention_heads"], cfg["attention_head_dim"]):
                    sd[tk] = tv
        else:
            self.say(f"reading {src['official']} (the official weights)")
            sd = official_tensors(src["official"], say=self.say)
        model = W.empty_model(MiniMaxH3Transformer3DModel, cfg)
        want = W.expected(model)
        W.check(sd, want, f"MiniMax-H3 {which}")
        sd = {k: v for k, v in sd.items() if k in want}
        store = self._pack_all(sd)
        del sd
        heads, hd = cfg["num_attention_heads"], cfg["attention_head_dim"]
        self._merge_loras(store, loras, lambda k, d: W.h3_dit_key(k, d, heads, hd), want)
        units = [(f"token_refiner.refiner_blocks.{i}", model.token_refiner.refiner_blocks[i]) for i in range(len(model.token_refiner.refiner_blocks))]
        units += [(f"transformer_blocks.{i}", b) for i, b in enumerate(model.transformer_blocks)]
        st = W.Streamer(model, store, units, self.device, self.dtype, say=self.say, pin=self.pin)
        model.eval()
        self._put(key, {"model": model, "streamer": st, "bytes": self._nbytes(store)})
        self.say(f"{which} ready in {time.time() - t0:.0f}s")
        return model

    def text_encoder(self, src, base):
        from transformers import Qwen3VLConfig, Qwen3VLForConditionalGeneration
        key = ("text_encoder", json.dumps(src, sort_keys=True), self.pack_mode, "")
        e = self._get(key)
        if e:
            return e["model"]
        need(src, "text encoder")
        t0 = time.time()
        cfg = Qwen3VLConfig.from_pretrained(os.path.join(base, "text_encoder"))
        full = cfg.text_config.num_hidden_layers
        cfg.text_config.num_hidden_layers = min(full, TE_LAYERS)

        def keep(k):
            if ".layers." in k and k.startswith("model.language_model.layers."):
                return int(k.split(".")[3]) < TE_LAYERS
            return not k.startswith("lm_head.")
        if "comfy" in src:
            self.say(f"reading {os.path.basename(src['comfy'])} (ComfyUI text encoder)")
            raw = W.read_comfy(src["comfy"])
            sd = {}
            for k, v in raw.items():
                tk = W.qwen3vl_key(k)
                if tk and keep(tk):
                    sd[tk] = v
        else:
            self.say(f"reading {src['official']} (the official Qwen3-VL, {cfg.text_config.num_hidden_layers} of {full} layers)")
            sd = official_tensors(src["official"], keep=keep)
        model = W.empty_model(Qwen3VLForConditionalGeneration, cfg)
        want = {k: v for k, v in W.expected(model).items() if not k.startswith("lm_head.")}
        n_have = len({k.split(".")[3] for k in sd if k.startswith("model.language_model.layers.")})
        if n_have <= TE_LAYERS - 1:
            raise W.Unsupported(f"the text encoder has {n_have} decoder layers - H3 needs more than {TE_LAYERS - 1}")
        W.check(sd, want, "the Qwen3-VL text encoder")
        store = self._pack_all({k: v for k, v in sd.items() if k in want})
        del sd
        units = [(f"model.visual.blocks.{i}", b) for i, b in enumerate(model.model.visual.blocks)]
        units += [(f"model.language_model.layers.{i}", b) for i, b in enumerate(model.model.language_model.layers)]
        st = W.Streamer(model, store, units, self.device, self.dtype, say=self.say, pin=self.pin)
        model.eval()
        self._put(key, {"model": model, "streamer": st, "bytes": self._nbytes(store)})
        self.say(f"text encoder ready in {time.time() - t0:.0f}s")
        return model

    def vae(self, which, src, base):
        """which: vae | audio_vae (small: fully on the device)."""
        from diffusers import AutoencoderKLMiniMaxH3, AutoencoderKLMiniMaxH3Audio
        cls = AutoencoderKLMiniMaxH3 if which == "vae" else AutoencoderKLMiniMaxH3Audio
        key = (which, json.dumps(src, sort_keys=True), "", "")
        e = self._get(key)
        if e:
            return e["model"]
        need(src, which)
        cfgp = os.path.join(base, which, "config.json")
        cfg = {k: v for k, v in json.load(open(cfgp, encoding="utf-8")).items() if not k.startswith("_")}
        if "comfy" in src:
            raw = W.read_comfy(src["comfy"], strip=VAE_PREFIXES)
            sd = {}
            for k, v in raw.items():
                if which == "vae":
                    for tk, tv in W.h3_vae_key(k, v, cfg["decoder_num_attention_heads"], cfg["decoder_attention_head_dim"]):
                        sd[tk] = tv
                else:
                    sd[k] = v
        else:
            sd = official_tensors(src["official"])
        model = W.empty_model(cls, cfg)
        want = W.expected(model)
        W.check(sd, want, "the " + ("video" if which == "vae" else "audio") + " VAE")
        # the VAEs keep full precision on the GPU (the audio one is fp32 in the release)
        store = {k: (v.unpack(torch.device("cpu")).float() if isinstance(v, W.Packed) else v) for k, v in sd.items() if k in want}
        vdt = self.dtype if which == "vae" else torch.float32
        st = W.Streamer(model, {k: W.Packed("f", v, dtype=vdt if v.is_floating_point() else v.dtype) for k, v in store.items()},
                        [], self.device, vdt, say=lambda m: None, pin=False)
        model.eval()
        self._put(key, {"model": model, "streamer": st, "bytes": 0})
        return model

    # ---------------------------------------------------------- the pipeline
    def pipeline(self, base, workflow, text=True):
        from diffusers import ModularPipeline
        key = ("pipe:" + workflow, base, "text" if text else "fixed", "")
        e = self._get(key)
        if e:
            return e["model"]
        pipe = ModularPipeline.from_pretrained(base, workflow=workflow)
        # a frozen prompt (Viggle) needs no tokenizer / processor
        names = ["scheduler", "audio_scheduler"] + (["tokenizer", "processor"] if text and os.path.isdir(os.path.join(base, "tokenizer")) else [])
        pipe.load_components(names=names, pretrained_model_name_or_path=base)
        self.cache[key] = {"model": pipe, "streamer": None, "bytes": 0}
        return pipe

    def render(self, job, fixed=None):
        """job: workflow, prompt, images, audios, videos, first, last, num_frames, width, height, steps, seed,
        shift, base, sources{transformer|transformer_ref, text_encoder, vae, audio_vae}, loras.
        fixed: a Viggle-style frozen prompt {prompt_embeds, text_token_tags, presentation} (no text encoder).
        -> {"frames": uint8 [F,H,W,3], "audio": float32 [C,S] | None, "sr": int}"""
        from diffusers.modular_pipelines.minimax_h3 import (MiniMaxH3AudioReference, MiniMaxH3ImageReference,
                                                            MiniMaxH3VideoReference)
        from diffusers.modular_pipelines.minimax_h3 import encoders as E
        wf = job["workflow"]
        base, src = job["base"], job["sources"]
        part = "transformer_ref" if wf == "ref2va" else "transformer"
        pipe = self.pipeline(base, wf, text=fixed is None)
        if job.get("canvas_short_edge"):
            s = int(job["canvas_short_edge"])
            pipe.register_to_config(canvas_short_edge=s, canvas_max_pixels=s * max(int(job["width"]), int(job["height"])),
                                    **({"reference_image_short_edge": s} if wf == "ref2va" else {}))
        setattr(pipe, part, self.dit(part, src[part], base, job.get("loras") or ()))
        pipe.vae = self.vae("vae", src["vae"], base)
        pipe.audio_vae = self.vae("audio_vae", src["audio_vae"], base)
        steps = [E.MiniMaxH3TextEncoderStep, E.MiniMaxH3FL2VATextEncoderStep, E.MiniMaxH3Ref2VATextEncoderStep]
        saved = {c: c.__call__ for c in steps}
        if fixed is not None:
            def use_fixed(self_, components, state):
                bs = self_.get_block_state(state)
                bs.prompt_embeds = fixed["prompt_embeds"].to(components._execution_device, self.dtype)
                bs.text_token_tags = fixed["text_token_tags"]
                self_.set_block_state(state, bs)
                return components, state
            for c in steps:
                c.__call__ = use_fixed
        else:
            pipe.text_encoder = self.text_encoder(src["text_encoder"], base)
        if job.get("shift"):
            pipe.scheduler.set_shift(float(job["shift"]))
        kw = dict(prompt=fixed["presentation"] if fixed is not None else job["prompt"], num_frames=int(job["num_frames"]),
                  height=int(job["height"]), width=int(job["width"]), num_inference_steps=int(job["steps"]),
                  generator=torch.Generator().manual_seed(int(job["seed"])), output_type="np",
                  output=["videos", "audio", "sampling_rate"])
        if wf == "fl2va":
            from PIL import Image
            if job.get("first"):
                kw["image"] = Image.open(job["first"]).convert("RGB")
            if job.get("last"):
                kw["last_image"] = Image.open(job["last"]).convert("RGB")
        if wf == "ref2va":
            refs = [MiniMaxH3VideoReference.from_file(p) for p in job.get("videos") or []]
            if fixed is not None:          # Viggle: the clip's sound is dropped, as in its training
                for r in refs:
                    r.audio, r.sample_rate = None, None
            refs += [MiniMaxH3ImageReference.from_file(p) for p in job.get("images") or []]
            refs += [MiniMaxH3AudioReference.from_file(p) for p in job.get("audios") or []]
            kw["references"] = refs
        t0 = time.time()
        try:
            r = pipe(**kw)
        finally:
            for c, f in saved.items():
                c.__call__ = f
            for e in self.cache.values():
                if e.get("streamer"):
                    e["streamer"].reset()
        v = np.asarray(r["videos"][0], dtype=np.float32)
        if not np.isfinite(v).all():
            raise W.Unsupported(f"the model produced NaN / inf pixels ({float((~np.isfinite(v)).mean()):.0%}) - the render would be black")
        a = r.get("audio") if isinstance(r, dict) else None
        a = a[0].float().cpu().numpy() if a is not None and a[0] is not None else None
        self.say(f"rendered {v.shape[0]} frames {v.shape[2]}x{v.shape[1]} in {time.time() - t0:.0f}s"
                 + (f", peak {torch.cuda.max_memory_allocated() / 2 ** 30:.1f} GiB VRAM" if self.device.type == "cuda" else ""))
        return {"frames": (np.clip(v, 0, 1) * 255 + 0.5).astype(np.uint8), "audio": a, "sr": int(r.get("sampling_rate") or 0)}


def write_outputs(res, out_frames, out_audio):
    """Raw RGB24 frames + raw float32 interleaved audio for the app's ffmpeg (it builds the FFV1 master)."""
    f = res["frames"]
    with open(out_frames, "wb") as fh:
        fh.write(np.ascontiguousarray(f).tobytes())
    meta = {"frames": int(f.shape[0]), "height": int(f.shape[1]), "width": int(f.shape[2]), "sr": res["sr"], "channels": 0}
    if res["audio"] is not None and out_audio:
        a = res["audio"]
        a = a if a.ndim == 2 else a[None]
        with open(out_audio, "wb") as fh:
            fh.write(np.ascontiguousarray(a.T.astype(np.float32)).tobytes())
        meta["channels"] = int(a.shape[0])
    return meta


# ---------------------------------------------------------- the header-only check


def check_source(what, src, base):
    """-> {"ok": bool, "why": str, "gb": float} without loading weights (what: transformer | transformer_ref |
    text_encoder | vae | audio_vae)."""
    try:
        if "official" in src:
            files = glob.glob(os.path.join(src["official"], "*.safetensors"))
            if not files:
                return {"ok": False, "why": "not downloaded", "gb": 0}
            return {"ok": True, "why": "official weights", "gb": round(sum(os.path.getsize(f) for f in files) / 2 ** 30, 1)}
        path = src["comfy"]
        shapes, confs = header(path)
        bad = {c.get("format") for c in confs.values() if c.get("format") not in ("int8_tensorwise", "float8_e4m3fn", "float8_e5m2")}
        if bad:
            return {"ok": False, "why": f"its '{sorted(bad)[0]}' quantisation cannot be read - download the official weights", "gb": 0}
        gb = round(os.path.getsize(path) / 2 ** 30, 1)
        if what in ("transformer", "transformer_ref"):
            from diffusers import MiniMaxH3Transformer3DModel
            cfg = {k: v for k, v in json.load(open(os.path.join(base, what, "config.json"), encoding="utf-8")).items() if not k.startswith("_")}
            cfg = dit_config_for(cfg, shapes)
            sd = {}
            for k, s in shapes.items():
                k2 = _strip(k, DIT_PREFIXES)
                if any(k2.endswith(x) for x in ("comfy_quant", "weight_scale", "input_scale")):
                    continue
                for tk, tv in W.h3_dit_key(k2, Shape(s), cfg["num_attention_heads"], cfg["attention_head_dim"]):
                    sd[tk] = tv
            W.check(sd, W.expected(W.empty_model(MiniMaxH3Transformer3DModel, cfg)), what)
            return {"ok": True, "why": f"ComfyUI file ({cfg['num_layers']} blocks, ffn {cfg['ffn_dim']})", "gb": gb}
        if what == "text_encoder":
            from transformers import Qwen3VLConfig, Qwen3VLForConditionalGeneration
            cfg = Qwen3VLConfig.from_pretrained(os.path.join(base, "text_encoder"))
            cfg.text_config.num_hidden_layers = min(cfg.text_config.num_hidden_layers, TE_LAYERS)
            sd = {}
            for k, s in shapes.items():
                if any(k.endswith(x) for x in ("comfy_quant", "weight_scale", "input_scale")):
                    continue
                tk = W.qwen3vl_key(k)
                if tk and not tk.startswith("lm_head.") and not (tk.startswith("model.language_model.layers.") and int(tk.split(".")[3]) >= TE_LAYERS):
                    sd[tk] = Shape(s)
            want = {k: v for k, v in W.expected(W.empty_model(Qwen3VLForConditionalGeneration, cfg)).items() if not k.startswith("lm_head.")}
            W.check(sd, want, "text encoder")
            return {"ok": True, "why": "ComfyUI file", "gb": gb}
        from diffusers import AutoencoderKLMiniMaxH3, AutoencoderKLMiniMaxH3Audio
        cfg = {k: v for k, v in json.load(open(os.path.join(base, what, "config.json"), encoding="utf-8")).items() if not k.startswith("_")}
        sd = {}
        for k, s in shapes.items():
            k2 = _strip(k, VAE_PREFIXES)
            if any(k2.endswith(x) for x in ("comfy_quant", "weight_scale", "input_scale")):
                continue
            if what == "vae":
                for tk, tv in W.h3_vae_key(k2, Shape(s), cfg["decoder_num_attention_heads"], cfg["decoder_attention_head_dim"]):
                    sd[tk] = tv
            else:
                sd[k2] = Shape(s)
        cls = AutoencoderKLMiniMaxH3 if what == "vae" else AutoencoderKLMiniMaxH3Audio
        W.check(sd, W.expected(W.empty_model(cls, cfg)), what)
        return {"ok": True, "why": "ComfyUI file", "gb": gb}
    except W.Unsupported as e:
        return {"ok": False, "why": str(e), "gb": 0}
    except Exception as e:                                             # noqa: BLE001
        return {"ok": False, "why": f"{type(e).__name__}: {e}"[:300], "gb": 0}
