"""bitGen Studio — misc/d3v3_shims/flash_attn.py (3.7.0): a STAND-IN for flash-attn 2, used by 💎 Fine detail (Direct3D-V3)
ONLY when the real package does not import (misc/d3v3_run.py loads it then). FlashAttention 2 needs a wheel built for this
exact Python + PyTorch + CUDA (Windows: none for many combinations) or an hour of compiling; this does the same sums with
PyTorch's own scaled_dot_product_attention - slower and hungrier for memory, the same answer.

The three calls Direct3D-V3 makes (direct3d/models/sparse_atten.py):
  flash_attn_qkvpacked_func(qkv [B, N, 3, H, C])                                  -> [B, N, H, C]
  flash_attn_varlen_qkvpacked_func(qkv [T, 3, H, C], cu_seqlens, max_seqlen)       -> [T, H, C]
  flash_attn_varlen_kvpacked_func(q [Tq, H, C], kv [Tk, 2, H, C], cu_q, cu_k, mq, mk) -> [Tq, H, C]
A variable-length batch is many sequences packed end to end (cu_seqlens = their starts); sequences of the same length are
gathered and run together, so thousands of windows are a few calls, not thousands.
"""
import torch
import torch.nn.functional as F

STAND_IN = True
__version__ = "0.0.0+bitgen-sdpa"
CHUNK = 1 << 22                                  # elements of q a call at most (memory)


def _sdpa(q, k, v, scale=None, causal=False):    # [B, L, H, C] each
    o = F.scaled_dot_product_attention(q.transpose(1, 2), k.transpose(1, 2), v.transpose(1, 2), scale=scale, is_causal=causal)
    return o.transpose(1, 2)


def flash_attn_func(q, k, v, dropout_p=0.0, softmax_scale=None, causal=False, **_):
    return _sdpa(q, k, v, softmax_scale, causal)


def flash_attn_qkvpacked_func(qkv, dropout_p=0.0, softmax_scale=None, causal=False, **_):
    q, k, v = qkv.unbind(2)
    return _sdpa(q, k, v, softmax_scale, causal)


def _varlen(q, k, v, cu_q, cu_k, scale, causal):
    sq, sk = cu_q.tolist(), cu_k.tolist()
    out = torch.empty_like(q)
    groups = {}
    for i in range(len(sq) - 1):
        lq, lk = sq[i + 1] - sq[i], sk[i + 1] - sk[i]
        if lq > 0:
            groups.setdefault((lq, lk), []).append(i)
    H, C = q.shape[1], q.shape[2]
    for (lq, lk), idx in groups.items():
        per = max(1, CHUNK // max(1, lq * H * C))
        for s in range(0, len(idx), per):
            part = idx[s:s + per]
            st_q = torch.tensor([sq[i] for i in part], device=q.device)
            st_k = torch.tensor([sk[i] for i in part], device=q.device)
            iq = st_q[:, None] + torch.arange(lq, device=q.device)[None]          # [b, lq]
            if lk:
                ik = st_k[:, None] + torch.arange(lk, device=q.device)[None]      # [b, lk]
                out[iq] = _sdpa(q[iq], k[ik], v[ik], scale, causal)
            else:
                out[iq] = 0
    return out


def flash_attn_varlen_qkvpacked_func(qkv, cu_seqlens, max_seqlen=None, dropout_p=0.0, softmax_scale=None, causal=False, **_):
    q, k, v = qkv.unbind(1)
    return _varlen(q, k, v, cu_seqlens, cu_seqlens, softmax_scale, causal)


def flash_attn_varlen_kvpacked_func(q, kv, cu_seqlens_q, cu_seqlens_k, max_seqlen_q=None, max_seqlen_k=None, dropout_p=0.0,
                                    softmax_scale=None, causal=False, **_):
    k, v = kv.unbind(1)
    return _varlen(q, k, v, cu_seqlens_q, cu_seqlens_k, softmax_scale, causal)


def flash_attn_varlen_func(q, k, v, cu_seqlens_q, cu_seqlens_k, max_seqlen_q=None, max_seqlen_k=None, dropout_p=0.0,
                           softmax_scale=None, causal=False, **_):
    return _varlen(q, k, v, cu_seqlens_q, cu_seqlens_k, softmax_scale, causal)
