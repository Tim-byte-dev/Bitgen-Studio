"""bitGen Studio — the native engine's weight store + block streamer (2.352.0). Runs INSIDE venvs/native.

Tim: "can we make the engine replace comfy engine so we can package
independent of comfy?" (after "can we build our own wan2gp engine?").

Wan2GP's core idea, written from scratch here (no Wan2GP / mmgp code):

  PACK    every weight of a big model is kept in system RAM in a compact form
          - int8 with a per-row scale (a bf16 checkpoint is quantised on load),
          or exactly as a ComfyUI int8 / int8-ConvRot / fp8 file stores it (no
          re-quantising), or plain bf16 when the ⚙ asks for full precision;
  STREAM  the model is built empty (meta). Its small parts sit on the GPU for
          good; each big BLOCK (a DiT block, a Qwen3-VL decoder layer) is
          unpacked onto the GPU just before it runs and dropped after, while
          the next block is already being copied on a side CUDA stream.
          VRAM holds ~2 blocks + activations, RAM holds ~half the bf16 size.

ComfyUI's int8 formats (comfy_quant JSON per layer, see lib docs in
HANDOVER): weight int8 + weight_scale (per row or tensor-wise); with
"convrot" the rows were multiplied by a regular Hadamard block (size
convrot_groupsize, a power of 4) before quantising, so un-rotating is the
same block matmul again (the normalised regular Hadamard is symmetric and
orthogonal). Slicing / permuting ROWS (the QKV split, the SwiGLU half swap,
the VAE's per-head QKV reorder) works on the packed form directly, because
both the scale and the rotation are per row / along the input dim.
The ConvRot maths follows comfy-kitchen's portable (eager) implementation
(Apache-2.0, Comfy Org) - re-implemented, not imported.
"""
import json
import math
import threading

import torch

CANCEL = threading.Event()          # set by the server's /cancel: the next block stops the job


class Cancelled(Exception):
    pass

# ------------------------------------------------------------------ packed tensors


class Packed:
    """One weight in RAM. kind: 'f' (plain tensor), 'i8' (int8 + scale), 'i8cr'
    (int8 ConvRot + scale + group), 'f8' (float8 + scale)."""
    __slots__ = ("kind", "data", "scale", "group", "shape", "dtype")

    def __init__(self, kind, data, scale=None, group=0, dtype=torch.bfloat16):
        self.kind, self.data, self.scale, self.group, self.dtype = kind, data, scale, int(group or 0), dtype
        self.shape = tuple(data.shape)

    def rows(self, sl):
        """The same weight restricted to rows sl (a slice or an index tensor)."""
        d = self.data[sl]
        s = self.scale
        if s is not None and s.dim() >= 1 and s.numel() > 1 and s.shape[0] == self.data.shape[0]:
            s = s[sl]
        return Packed(self.kind, d.contiguous(), s.contiguous() if s is not None and s.dim() else s, self.group, self.dtype)

    def nbytes(self):
        return self.data.numel() * self.data.element_size() + (0 if self.scale is None else self.scale.numel() * self.scale.element_size())

    def pin(self):
        try:
            self.data = self.data.pin_memory()
            if self.scale is not None:
                self.scale = self.scale.pin_memory()
        except Exception:                                   # noqa: BLE001  (no CUDA / not enough lockable RAM)
            pass
        return self

    def unpack(self, device, stream=None):
        """-> a plain tensor of self.dtype on device (the int8 maths runs ON the device)."""
        nb = device.type == "cuda"
        d = self.data.to(device, non_blocking=nb)
        if self.kind == "f":
            return d.to(self.dtype)
        s = self.scale.to(device, non_blocking=nb).float()
        if s.dim() == 1 and d.dim() >= 2:
            s = s.reshape(-1, *([1] * (d.dim() - 1)))
        w = d.float() * s
        if self.kind == "i8cr" and self.group > 0:
            w = rotate(w, self.group)
        return w.to(self.dtype)


_H = {}


def hadamard(size, device="cpu", dtype=torch.float32):
    """The normalised REGULAR Hadamard (Kronecker powers of the 4x4 regular one)."""
    key = (size, str(device), dtype)
    if key in _H:
        return _H[key]
    if size < 4 or (size & (size - 1)) or abs(math.log(size, 4) % 1) > 1e-9:
        raise ValueError(f"a ConvRot group must be a power of 4, got {size}")
    h4 = torch.tensor([[1, 1, 1, -1], [1, 1, -1, 1], [1, -1, 1, 1], [-1, 1, 1, 1]], dtype=dtype, device=device)
    h = h4
    while h.shape[0] < size:
        h = torch.kron(h, h4)
    _H[key] = h / math.sqrt(size)
    return _H[key]


def rotate(w, group):
    """W @ blockdiag(H)^T along the input dim (its own inverse for this H)."""
    shape = w.shape
    w2 = w.reshape(shape[0], -1)
    out_f, in_f = w2.shape
    if in_f % group:
        raise ValueError(f"in_features {in_f} is not a multiple of the ConvRot group {group}")
    h = hadamard(group, w2.device, w2.dtype)
    return torch.matmul(w2.reshape(out_f, in_f // group, group), h.T).reshape(shape)


def quantize_rows(w):
    """bf16/fp32 -> (int8, per-row fp32 scale). Symmetric, round to nearest."""
    w2 = w.float().reshape(w.shape[0], -1) if w.dim() >= 2 else w.float().reshape(1, -1)
    scale = (w2.abs().amax(dim=1, keepdim=True) / 127.0).clamp(min=1e-30)
    q = torch.round(w2 / scale).clamp(-127, 127).to(torch.int8)
    return q.reshape(w.shape), scale.reshape(-1)


def pack(t, mode="int8", dtype=torch.bfloat16, device=None):
    """A plain tensor -> Packed. mode int8: 2-D+ weights quantised per row (small / 1-D ones stay plain)."""
    if mode == "int8" and t.dim() >= 2 and t.numel() >= 4096 and t.is_floating_point():
        dev = device if device is not None and device.type == "cuda" else t.device
        q, s = quantize_rows(t.to(dev))
        return Packed("i8", q.cpu(), s.cpu(), dtype=dtype)
    return Packed("f", t.to(dtype) if t.is_floating_point() else t, dtype=dtype if t.is_floating_point() else t.dtype)


# ------------------------------------------------------------------ ComfyUI files


class Unsupported(Exception):
    pass


def comfy_layers(names):
    """{prefix: True} for every layer carrying a comfy_quant record."""
    return {n[: -len("comfy_quant")] for n in names if n.endswith("comfy_quant")}


def read_comfy(path, strip=(), device=None):
    """A ComfyUI safetensors file -> {key (prefix stripped): Packed | tensor}. Quantised layers stay packed.
    Unknown formats (nvfp4, w4a8, convrot_w4a4 ...) raise Unsupported in words."""
    from safetensors import safe_open
    out = {}
    with safe_open(path, framework="pt") as f:
        names = list(f.keys())
        qlayers = comfy_layers(names)
        confs = {}
        for p in qlayers:
            raw = f.get_tensor(p + "comfy_quant")
            confs[p] = json.loads(bytes(raw.to(torch.uint8).tolist()).decode("utf-8"))
        skip = {p + s for p in qlayers for s in ("comfy_quant", "weight_scale", "input_scale", "weight_scale_2",
                                                  "pre_quant_scale", "weight_s_channel")}
        for n in names:
            if n in skip:
                continue
            key = n
            for s in strip:
                if key.startswith(s):
                    key = key[len(s):]
                    break
            layer = n[: -len("weight")] if n.endswith("weight") else None
            if layer is not None and layer in qlayers:
                c = confs[layer]
                fmt = str(c.get("format") or (c.get("params") or {}).get("format") or "")
                scale = f.get_tensor(layer + "weight_scale").float()
                data = f.get_tensor(n)
                if fmt == "int8_tensorwise":
                    conv = bool(c.get("convrot", (c.get("params") or {}).get("convrot", False)))
                    grp = int(c.get("convrot_groupsize", (c.get("params") or {}).get("convrot_groupsize", 256))) if conv else 0
                    if data.dtype != torch.int8:
                        data = data.view(torch.int8)
                    scale = scale.reshape(-1) if scale.numel() > 1 else scale.reshape(())
                    out[key] = Packed("i8cr" if conv else "i8", data, scale, grp)
                elif fmt in ("float8_e4m3fn", "float8_e5m2"):
                    want = torch.float8_e4m3fn if fmt == "float8_e4m3fn" else torch.float8_e5m2
                    if data.dtype != want:
                        data = data.view(want)
                    out[key] = Packed("f8", data, scale.reshape(-1) if scale.numel() > 1 else scale.reshape(()))
                else:
                    raise Unsupported(f"{path}: layer {layer.rstrip('.')} uses the '{fmt}' quantisation, which the native "
                                      "engine cannot read (int8 / int8-ConvRot / fp8 / bf16 files can be used)")
            else:
                out[key] = f.get_tensor(n)
    return out


# ------------------------------------------------------------------ the H3 key maps (ComfyUI / original -> diffusers)
# The renames and the two tensor transforms follow diffusers' scripts/convert_minimax_h3_to_diffusers.py
# (Apache-2.0). ComfyUI's DiT reads its fused QKV as contiguous [q; k; v] (chunk(3), no load-time reorder),
# so its files are already in that layout; its VAE decoder splits QKV PER HEAD (view(..., heads, 3*dim_head)),
# i.e. the original interleave, which the VAE map reorders.

class Shape:
    """A tensor stand-in for the header-only check (shapes, no data)."""
    def __init__(self, shape):
        self.shape = tuple(shape)

    def rows(self, sl):
        n = self.shape[0]
        k = len(range(*sl.indices(n))) if isinstance(sl, slice) else len(sl)
        return Shape((k,) + self.shape[1:])


def _rows(t, sl):
    return t.rows(sl) if isinstance(t, (Packed, Shape)) else t[sl].contiguous()


def _cat_rows(a, b):
    if isinstance(a, Shape):
        return Shape((a.shape[0] + b.shape[0],) + a.shape[1:])
    if isinstance(a, Packed):
        s = a.scale
        if s is not None and s.dim() >= 1 and s.numel() > 1:
            s = torch.cat([a.scale, b.scale])
        return Packed(a.kind, torch.cat([a.data, b.data]).contiguous(), s, a.group, a.dtype)
    return torch.cat([a, b]).contiguous()


def _nrows(t):
    return t.shape[0]


def h3_dit_key(k, t, heads, head_dim):
    """One DiT key/tensor -> [(diffusers key, tensor | Packed)]."""
    if k == "rope.inv_freq":
        return []
    tk = k
    if tk.startswith("token_refiner.blocks."):
        tk = tk.replace("token_refiner.blocks.", "token_refiner.refiner_blocks.", 1)
    elif tk.startswith("blocks."):
        tk = tk.replace("blocks.", "transformer_blocks.", 1)
    for a, b in (("time_embedder.proj_in.", "time_embedder.linear_1."), ("time_embedder.proj_out.", "time_embedder.linear_2."),
                 ("video_patch_proj.", "proj_in."), ("audio_patch_proj.", "audio_proj_in."),
                 ("condition_proj.", "context_embedder."), ("final_layer.norm.", "norm_out.norm."),
                 ("final_layer.adaln_proj.linear.", "norm_out.linear."), ("final_layer.video_out.", "proj_out."),
                 ("final_layer.audio_out.", "audio_proj_out."), (".attn.q_norm.", ".attn.norm_q."),
                 (".attn.k_norm.", ".attn.norm_k."), (".attn.out_proj.", ".attn.to_out.0.")):
        tk = tk.replace(a, b)
    if tk.endswith(".attn.qkv_proj.weight"):
        inner = heads * head_dim
        if _nrows(t) != 3 * inner:
            raise Unsupported(f"{k}: {_nrows(t)} rows, expected 3 x {inner}")
        p = tk[: -len("qkv_proj.weight")]
        return [(p + "to_q.weight", _rows(t, slice(0, inner))), (p + "to_k.weight", _rows(t, slice(inner, 2 * inner))),
                (p + "to_v.weight", _rows(t, slice(2 * inner, 3 * inner)))]
    if tk.endswith(".mlp.fc1.weight"):
        h = _nrows(t) // 2
        return [(tk.replace(".mlp.fc1.weight", ".ff.net.0.proj.weight"), _cat_rows(_rows(t, slice(h, 2 * h)), _rows(t, slice(0, h))))]
    return [(tk.replace(".mlp.fc2.", ".ff.net.2."), t)]


def _interleave_order(heads, head_dim):
    """Row order taking per-head [q k v] blocks to [q_all; k_all; v_all]."""
    idx = torch.arange(heads * 3 * head_dim).reshape(heads, 3, head_dim)
    return idx.permute(1, 0, 2).reshape(-1)


def h3_vae_key(k, t, heads, head_dim):
    if k == "decoder.mask_token":
        return []
    if ".attn.to_qkv." in k:
        order = _interleave_order(heads, head_dim)
        r = _rows(t, order)
        inner = heads * head_dim
        pre, suf = k.split(".attn.to_qkv.")
        return [(f"{pre}.attn.to_q.{suf}", _rows(r, slice(0, inner))), (f"{pre}.attn.to_k.{suf}", _rows(r, slice(inner, 2 * inner))),
                (f"{pre}.attn.to_v.{suf}", _rows(r, slice(2 * inner, 3 * inner)))]
    tk = k
    if tk.startswith("encoder.down."):
        level, rest = tk[len("encoder.down."):].split(".", 1)
        rest = rest.replace("block.", "resnets.", 1).replace("nin_shortcut.", "conv_shortcut.", 1).replace("downsample.", "downsamplers.0.", 1)
        tk = f"encoder.down_blocks.{level}.{rest}"
    tk = tk.replace("decoder.x_embedder.", "decoder.proj_in.").replace(".attn.to_out.", ".attn.to_out.0.")
    tk = tk.replace(".ff.w1.", ".ff.net.0.proj.").replace(".ff.w2.", ".ff.net.2.")
    if ".ff.w1." in k:
        h = _nrows(t) // 2
        return [(tk, _cat_rows(_rows(t, slice(h, 2 * h)), _rows(t, slice(0, h))))]
    return [(tk, t)]


def qwen3vl_key(k):
    """A ComfyUI / HF-original Qwen3-VL key -> transformers' Qwen3VLForConditionalGeneration key (or None)."""
    for s in ("qwen3vl_32b.transformer.", "qwen3vl.transformer.", "transformer."):
        if k.startswith(s):
            k = k[len(s):]
            break
    if k.startswith("model.language_model.") or k.startswith("model.visual.") or k == "lm_head.weight":
        return k
    if k.startswith("model.layers.") or k.startswith("model.embed_tokens.") or k.startswith("model.norm."):
        return "model.language_model." + k[len("model."):]
    if k.startswith("visual."):
        return "model." + k
    if k.startswith("language_model."):
        return "model." + k
    if k.startswith("layers.") or k.startswith("embed_tokens.") or k.startswith("norm."):
        return "model.language_model." + k
    return None


# ------------------------------------------------------------------ building + streaming


def expected(model):
    return {k: tuple(v.shape) for k, v in model.state_dict().items()}


def check(sd, want, what, allow_missing=()):
    """Every expected key present with its shape; extra keys only if unused. -> [] or raise Unsupported."""
    missing = [k for k in want if k not in sd and not any(k.startswith(a) for a in allow_missing)]
    bad = [(k, tuple(sd[k].shape), want[k]) for k in want if k in sd and tuple(sd[k].shape) != want[k]]
    if missing or bad:
        raise Unsupported(f"{what}: the file does not match the model - {len(missing)} weight(s) missing"
                          + (f" (e.g. {missing[0]})" if missing else "") + f", {len(bad)} with the wrong shape"
                          + (f" (e.g. {bad[0][0]} {bad[0][1]} vs {bad[0][2]})" if bad else ""))
    return [k for k in sd if k not in want]


class Streamer:
    """Keeps a model's weights packed in RAM and puts each unit on the device only while it runs."""

    def __init__(self, model, store, units, device, dtype, say=print, prefetch=True, pin=True):
        self.model, self.store, self.device, self.dtype, self.say = model, store, device, dtype, say
        self.units = list(units)                        # [(name, module)]
        self.names = {id(m): i for i, (_n, m) in enumerate(self.units)}
        self.cuda = device.type == "cuda"
        self.stream = torch.cuda.Stream(device) if (self.cuda and prefetch) else None
        self.ready = {}                                 # unit index -> (event | None, {param path: tensor})
        unit_prefix = [n + "." for n, _m in self.units]
        self.unit_keys = [[k for k in store if k.startswith(p)] for p in unit_prefix]
        in_unit = {k for ks in self.unit_keys for k in ks}
        if pin and self.cuda:
            for k in in_unit:
                if isinstance(store[k], Packed):
                    store[k].pin()
        # the resident part: every non-unit weight, on the device for good
        for k, v in store.items():
            if k not in in_unit:
                _set(model, k, (v.unpack(device) if isinstance(v, Packed) else v.to(device, dtype if v.is_floating_point() else v.dtype)))
        for mod in model.modules():                     # buffers (rotary tables ...) move too
            for bn, b in list(mod._buffers.items()):
                if b is not None and b.device.type != "meta":
                    mod._buffers[bn] = b.to(device)
        self.hooks = []
        for i, (_n, m) in enumerate(self.units):
            self.hooks.append(m.register_forward_pre_hook(self._pre))
            self.hooks.append(m.register_forward_hook(self._post))
        ram = sum(v.nbytes() if isinstance(v, Packed) else v.numel() * v.element_size() for v in store.values())
        self.say(f"{len(self.units)} blocks streamed, {ram / 2 ** 30:.1f} GB packed in RAM")

    def _load(self, i):
        out = {}
        for k in self.unit_keys[i]:
            v = self.store[k]
            out[k] = v.unpack(self.device) if isinstance(v, Packed) else v.to(self.device, self.dtype if v.is_floating_point() else v.dtype, non_blocking=self.cuda)
        return out

    def _launch(self, i):
        if i >= len(self.units) or i in self.ready:
            return
        if self.stream is not None:
            with torch.cuda.stream(self.stream):
                t = self._load(i)
                ev = torch.cuda.Event()
                ev.record(self.stream)
            self.ready[i] = (ev, t)
        else:
            self.ready[i] = (None, self._load(i))

    def _pre(self, module, _args):
        if CANCEL.is_set():
            raise Cancelled("cancelled")
        i = self.names[id(module)]
        self._launch(i)
        ev, t = self.ready.pop(i)
        if ev is not None:
            torch.cuda.current_stream(self.device).wait_event(ev)
        for k, v in t.items():
            if ev is not None:
                v.record_stream(torch.cuda.current_stream(self.device))
            _set(self.model, k, v)
        self._launch(i + 1 if i + 1 < len(self.units) else 0)   # the next one (the first again for the next step)

    def _post(self, module, _args, _out):
        i = self.names[id(module)]
        for k in self.unit_keys[i]:
            _set(self.model, k, torch.empty(_get(self.model, k).shape, device="meta", dtype=_get(self.model, k).dtype))

    def reset(self):
        """After a stopped / failed run: no block left on the device, no prefetch pending."""
        self.ready.clear()
        for i in range(len(self.units)):
            for k in self.unit_keys[i]:
                cur = _get(self.model, k)
                if cur.device.type != "meta":
                    _set(self.model, k, torch.empty(cur.shape, device="meta", dtype=cur.dtype))

    def close(self):
        self.reset()
        for h in self.hooks:
            h.remove()
        self.ready.clear()


def _owner(model, key):
    mod = model
    parts = key.split(".")
    for p in parts[:-1]:
        mod = getattr(mod, p)
    return mod, parts[-1]


def _get(model, key):
    m, n = _owner(model, key)
    return m._parameters[n] if n in m._parameters else m._buffers[n]


def _set(model, key, t):
    m, n = _owner(model, key)
    if n in m._parameters:
        m._parameters[n] = torch.nn.Parameter(t, requires_grad=False)
    else:
        m._buffers[n] = t


def empty_model(cls, config, **kw):
    """The model skeleton on meta (buffers real) - no weights read yet."""
    from accelerate import init_empty_weights
    with init_empty_weights(include_buffers=False):
        return cls.from_config(config, **kw) if hasattr(cls, "from_config") else cls(config, **kw)


def lora_delta(lora_sd, key_map, strength):
    """A LoRA file (lora_A/lora_B or lora_down/lora_up [+ alpha]) -> {target base key: delta fp32}, keys mapped
    by key_map(original weight key) -> [(target key, row slice | None)] like the base weights."""
    groups = {}
    for k, v in lora_sd.items():
        for a, b in ((".lora_A.weight", "A"), (".lora_B.weight", "B"), (".lora_down.weight", "A"), (".lora_up.weight", "B"),
                     (".alpha", "alpha")):
            if k.endswith(a):
                groups.setdefault(k[: -len(a)], {})[b] = v
                break
    out = {}
    for base, g in groups.items():
        if "A" not in g or "B" not in g:
            continue
        A, B = g["A"].float(), g["B"].float()
        r = A.shape[0]
        sc = float(strength) * (float(g["alpha"]) / r if "alpha" in g else 1.0)
        d = (B.reshape(B.shape[0], -1) @ A.reshape(r, -1)).reshape(B.shape[0], *A.shape[1:]) * sc
        for tk, t in key_map(base + ".weight", d):
            out[tk] = out.get(tk, 0) + (t if not isinstance(t, Packed) else t.unpack(torch.device("cpu")).float())
    return out
