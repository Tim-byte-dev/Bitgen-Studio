"""bitGen Studio — misc/pager_geo.py (2.994.0): ⛰ PANORAMA DEPTH's geometry - numpy only (no torch), so it is tested on its own
(scripts/test-pager994.py). Used by misc/pager_run.py (in PaGeR's venv) after the model gave the depth.

Directions: bitGen's own panorama convention (lib/glbMerge.js sphere, the Sketcher's scene .glb): u = 0.5 is FRONT (-Z),
u = 0.75 is RIGHT (+X), v = 0 is UP (+Y). A pixel (x, y) of a W x H equirectangular picture looks along
  lon = (x + 0.5) / W * 2 pi - pi,  lat = pi / 2 - (y + 0.5) / H * pi
  dir = (cos lat sin lon, sin lat, -cos lat cos lon)
PaGeR's depth is the distance along that ray (radial, metres).

  grid(depth, w, h)          the depth on a smaller grid (the viewer's .f32 and the mesh)
  dirs(h, w)                 (h, w, 3) unit rays
  mesh(depth_grid)           -> positions (n, 3), uvs (n, 2), indices (m,) - a closed-round grid (the seam column doubled)
  glb(pos, uv, idx, jpeg, name)  -> bytes: one unlit, double-sided, textured mesh (KHR_materials_unlit)
  stereo_tb(rgb, depth, ipd) -> (2H, W, 3): a top / bottom stereo 360 (top = left eye) - each eye's picture moved by the
                                angle a point at its depth shifts between the eyes, near over far (a depth buffer), the
                                gaps filled from the FARTHER side; faded to none at the poles (no swirl overhead)
"""
import json
import math
import struct

import numpy as np


def dirs(h, w):
    x = (np.arange(w, dtype=np.float64) + 0.5) / w
    y = (np.arange(h, dtype=np.float64) + 0.5) / h
    lon = x * 2.0 * math.pi - math.pi
    lat = math.pi / 2.0 - y * math.pi
    cl, sl = np.cos(lat)[:, None], np.sin(lat)[:, None]
    return np.stack([cl * np.sin(lon)[None, :], np.broadcast_to(sl, (h, w)), -cl * np.cos(lon)[None, :]], axis=-1)


def grid(depth, w=512, h=256):
    """area mean onto a w x h grid (depth's own size must be a whole multiple; else nearest rows / columns)"""
    d = np.asarray(depth, dtype=np.float64)
    H, W = d.shape
    if H % h == 0 and W % w == 0:
        return d.reshape(h, H // h, w, W // w).mean(axis=(1, 3)).astype(np.float32)
    ys = ((np.arange(h) + 0.5) * H / h).astype(int).clip(0, H - 1)
    xs = ((np.arange(w) + 0.5) * W / w).astype(int).clip(0, W - 1)
    return d[ys][:, xs].astype(np.float32)


def mesh(depth_grid):
    """a grid of the rays scaled by their depth; one extra column closes the seam (u past 1 - the texture repeats)"""
    d = np.asarray(depth_grid, dtype=np.float64)
    h, w = d.shape
    p = dirs(h, w) * d[..., None]
    p = np.concatenate([p, p[:, :1]], axis=1)                     # the seam: column 0 again
    u = (np.arange(w + 1, dtype=np.float64) + 0.5) / w
    v = (np.arange(h, dtype=np.float64) + 0.5) / h
    uv = np.stack(np.meshgrid(u, v), axis=-1)
    W1 = w + 1
    r, c = np.meshgrid(np.arange(h - 1), np.arange(w), indexing="ij")
    a = (r * W1 + c).ravel()
    b, cc, dd = a + 1, a + W1, a + W1 + 1
    idx = np.stack([a, cc, b, b, cc, dd], axis=1).ravel()
    return p.reshape(-1, 3).astype(np.float32), uv.reshape(-1, 2).astype(np.float32), idx.astype(np.uint32)


def _pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


def glb(pos, uv, idx, jpeg, name="panorama depth"):
    pos = np.ascontiguousarray(pos, dtype=np.float32)
    uv = np.ascontiguousarray(uv, dtype=np.float32)
    idx = np.ascontiguousarray(idx, dtype=np.uint32)
    parts, views, off = [], [], 0
    for blob, target in ((pos.tobytes(), 34962), (uv.tobytes(), 34962), (idx.tobytes(), 34963), (bytes(jpeg), None)):
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(blob)}
        if target:
            v["target"] = target
        views.append(v)
        b = _pad4(blob)
        parts.append(b)
        off += len(b)
    binc = b"".join(parts)
    mn, mx = pos.min(axis=0).tolist(), pos.max(axis=0).tolist()
    g = {
        "asset": {"version": "2.0", "generator": "bitGen Studio ⛰ Panorama depth (PaGeR - non-commercial weights)"},
        "extensionsUsed": ["KHR_materials_unlit"],
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}]}],
        "materials": [{"name": "panorama", "doubleSided": True, "extensions": {"KHR_materials_unlit": {}},
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 1.0}}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9729, "wrapS": 10497, "wrapT": 33071}],
        "images": [{"bufferView": 3, "mimeType": "image/jpeg"}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": int(len(pos)), "type": "VEC3", "min": mn, "max": mx},
            {"bufferView": 1, "componentType": 5126, "count": int(len(uv)), "type": "VEC2"},
            {"bufferView": 2, "componentType": 5125, "count": int(len(idx)), "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(binc)}],
    }
    js = _pad4(json.dumps(g, separators=(",", ":")).encode("utf-8"), b" ")
    total = 12 + 8 + len(js) + 8 + len(binc)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
            + struct.pack("<II", len(binc), 0x004E4942) + binc)


def _fill(img, zb, filled):
    """each gap takes the nearest filled pixel on its left or right in the row - the FARTHER of the two (what was behind)"""
    h, w = filled.shape
    cols = np.arange(w)[None, :].repeat(h, axis=0)
    li = np.where(filled, cols, -1)
    li = np.maximum.accumulate(li, axis=1)
    ri = np.where(filled, cols, w)
    ri = np.flip(np.minimum.accumulate(np.flip(ri, axis=1), axis=1), axis=1)
    rows = np.arange(h)[:, None].repeat(w, axis=1)
    lz = np.where(li >= 0, zb[rows, li.clip(0, w - 1)], -1.0)
    rz = np.where(ri < w, zb[rows, ri.clip(0, w - 1)], -1.0)
    take_r = rz > lz
    src = np.where(take_r, ri, li).clip(0, w - 1)
    gap = ~filled & ((li >= 0) | (ri < w))
    out = img.copy()
    out[gap] = img[rows[gap], src[gap]]
    return out


def eye(rgb, depth, ipd, side):
    """one eye's picture: side -1 = left (near things move right), +1 = right"""
    rgb = np.asarray(rgb)
    d = np.maximum(np.asarray(depth, dtype=np.float64), 0.05)
    h, w = d.shape
    lat = math.pi / 2.0 - (np.arange(h) + 0.5) / h * math.pi
    fade = (np.cos(lat) ** 2)[:, None]                             # none at the poles
    ang = np.arcsin(np.clip((ipd / 2.0) / d, 0.0, 0.99)) * fade
    shift = -side * ang * w / (2.0 * math.pi)
    xs = np.arange(w)[None, :] + shift
    tx = np.rint(xs).astype(np.int64) % w
    ys = np.arange(h)[:, None].repeat(w, axis=1)
    zb = np.full((h, w), np.inf)
    np.minimum.at(zb, (ys.ravel(), tx.ravel()), d.ravel())
    win = d.ravel() <= zb[ys.ravel(), tx.ravel()]
    out = np.zeros_like(rgb)
    out[ys.ravel()[win], tx.ravel()[win]] = rgb.reshape(h * w, -1)[win]
    filled = np.isfinite(zb)
    zf = np.where(filled, zb, -1.0)
    return _fill(out, zf, filled)


def stereo_tb(rgb, depth, ipd=0.064):
    return np.concatenate([eye(rgb, depth, ipd, -1), eye(rgb, depth, ipd, +1)], axis=0)
