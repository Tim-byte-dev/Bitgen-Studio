"""bitGen Studio — write ComfyUI-format copies of a (tiny) official H3 layout (2.352.0, test tool).

    <python> tiny_comfy.py <official MiniMax-H3 dir> <out dir> [group]

The inverse of wstream's key maps, so the converter is tested against the
format as ComfyUI stores it: the DiT under "model.diffusion_model." with a
fused contiguous qkv_proj and gate-first mlp.fc1, int8 ConvRot per layer
(comfy_quant JSON + weight_scale); the video VAE with the original names and
the per-head INTERLEAVED to_qkv, int8 ConvRot; the audio VAE unchanged under
"vae."; the Qwen3-VL text encoder under "qwen3vl_32b.transformer." in the
HF-original spelling (model.layers / visual.), plain per-row int8.
"""
import json
import os
import sys

import torch
from safetensors.torch import save_file

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wstream as W          # noqa: E402
from h3_engine import official_tensors   # noqa: E402


def quant_conf(fmt, convrot=False, group=256):
    c = {"format": fmt}
    if convrot:
        c.update(convrot=True, convrot_groupsize=group)
    return torch.tensor(list(json.dumps(c).encode("utf-8")), dtype=torch.uint8)


def put_quant(out, key, w, group, convrot=True):
    """w (2-D) -> ComfyUI int8_tensorwise(+ConvRot) layer at key ('<layer>.weight')."""
    layer = key[: -len("weight")]
    ww = w.float()
    if convrot:
        ww = W.rotate(ww, group)
    q, s = W.quantize_rows(ww)
    out[key] = q
    out[layer + "weight_scale"] = s.reshape(-1, 1)
    out[layer + "comfy_quant"] = quant_conf("int8_tensorwise", convrot, group)


def dit(src_dir, out_path, heads, head_dim, group):
    sd = official_tensors(src_dir)
    out = {}
    inv = {"transformer_blocks.": "blocks.", "token_refiner.refiner_blocks.": "token_refiner.blocks.",
           "time_embedder.linear_1.": "time_embedder.proj_in.", "time_embedder.linear_2.": "time_embedder.proj_out.",
           "audio_proj_in.": "audio_patch_proj.", "proj_in.": "video_patch_proj.", "context_embedder.": "condition_proj.",
           "norm_out.norm.": "final_layer.norm.", "norm_out.linear.": "final_layer.adaln_proj.linear.",
           "audio_proj_out.": "final_layer.audio_out.", "proj_out.": "final_layer.video_out.",
           ".attn.norm_q.": ".attn.q_norm.", ".attn.norm_k.": ".attn.k_norm.", ".attn.to_out.0.": ".attn.out_proj.",
           ".ff.net.2.": ".mlp.fc2."}
    done = set()
    for k in sorted(sd):
        if k in done:
            continue
        if ".attn.to_q.weight" in k:
            p = k[: -len("to_q.weight")]
            t = torch.cat([sd[p + "to_q.weight"], sd[p + "to_k.weight"], sd[p + "to_v.weight"]])
            done |= {p + "to_q.weight", p + "to_k.weight", p + "to_v.weight"}
            nk = p + "qkv_proj.weight"
        elif ".ff.net.0.proj.weight" in k:
            v, g = sd[k].chunk(2)
            t, nk = torch.cat([g, v]), k.replace(".ff.net.0.proj.weight", ".mlp.fc1.weight")
        elif ".attn.to_k." in k or ".attn.to_v." in k:
            continue
        else:
            t, nk = sd[k], k
        for a, b in inv.items():
            if nk.startswith(a) or (a.startswith(".") and a in nk):
                nk = nk.replace(a, b, 1)
        key = "model.diffusion_model." + nk
        if t.dim() == 2 and t.shape[1] % group == 0 and t.numel() >= 64 and "norm" not in nk:
            put_quant(out, key, t, group)
        else:
            out[key] = t.contiguous()
    save_file(out, out_path)


def vae(src_dir, out_path, heads, head_dim, group):
    sd = official_tensors(src_dir)
    out = {}
    order = W._interleave_order(heads, head_dim)
    inv_order = torch.empty_like(order)
    inv_order[order] = torch.arange(order.numel())
    done = set()
    for k in sorted(sd):
        if k in done:
            continue
        if ".attn.to_q." in k and k.startswith("decoder."):
            pre, suf = k.split(".attn.to_q.")
            fused = torch.cat([sd[f"{pre}.attn.to_q.{suf}"], sd[f"{pre}.attn.to_k.{suf}"], sd[f"{pre}.attn.to_v.{suf}"]])
            done |= {f"{pre}.attn.to_{x}.{suf}" for x in "qkv"}
            t, nk = fused[inv_order], f"{pre}.attn.to_qkv.{suf}"
        elif (".attn.to_k." in k or ".attn.to_v." in k) and k.startswith("decoder."):
            continue
        elif ".ff.net.0.proj." in k:
            u, g = sd[k].chunk(2)
            t, nk = torch.cat([g, u]), k.replace(".ff.net.0.proj.", ".ff.w1.")
        else:
            t, nk = sd[k], k
            nk = nk.replace(".ff.net.2.", ".ff.w2.").replace(".attn.to_out.0.", ".attn.to_out.").replace("decoder.proj_in.", "decoder.x_embedder.")
            if nk.startswith("encoder.down_blocks."):
                level, rest = nk[len("encoder.down_blocks."):].split(".", 1)
                rest = rest.replace("resnets.", "block.", 1).replace("conv_shortcut.", "nin_shortcut.", 1).replace("downsamplers.0.", "downsample.", 1)
                nk = f"encoder.down.{level}.{rest}"
        key = "vae." + nk
        if t.dim() == 2 and t.shape[1] % group == 0 and t.numel() >= 64 and nk.endswith(".weight"):
            put_quant(out, key, t, group)
        else:
            out[key] = t.contiguous()
    save_file(out, out_path)


def audio_vae(src_dir, out_path):
    save_file({"vae." + k: v.contiguous() for k, v in official_tensors(src_dir).items()}, out_path)


def text_encoder(src_dir, out_path):
    sd = official_tensors(src_dir)
    out = {}
    for k, v in sd.items():
        if k.startswith("lm_head."):
            continue
        nk = k.replace("model.language_model.", "model.").replace("model.visual.", "visual.")
        key = "qwen3vl_32b.transformer." + nk
        if v.dim() == 2 and v.numel() >= 64 and ("proj" in nk) and "visual." not in nk:
            put_quant(out, key, v, 0, convrot=False)
        else:
            out[key] = v.contiguous()
    save_file(out, out_path)


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    group = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    os.makedirs(dst, exist_ok=True)
    tc = json.load(open(os.path.join(src, "transformer", "config.json")))
    vc = json.load(open(os.path.join(src, "vae", "config.json")))
    dit(os.path.join(src, "transformer"), os.path.join(dst, "minimax_h3_fl2va_int8_convrot.safetensors"), tc["num_attention_heads"], tc["attention_head_dim"], group)
    dit(os.path.join(src, "transformer_ref"), os.path.join(dst, "minimax_h3_ref2va_int8_convrot.safetensors"), tc["num_attention_heads"], tc["attention_head_dim"], group)
    vae(os.path.join(src, "vae"), os.path.join(dst, "minimax_h3_video_vae_int8_convrot.safetensors"), vc["decoder_num_attention_heads"], vc["decoder_attention_head_dim"], group)
    audio_vae(os.path.join(src, "audio_vae"), os.path.join(dst, "minimax_h3_audio_vae_fp32.safetensors"))
    text_encoder(os.path.join(src, "text_encoder"), os.path.join(dst, "qwen3vl_32b_minimax_h3_int8.safetensors"))
    print("ok", dst)
