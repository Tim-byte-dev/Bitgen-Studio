#!/usr/bin/env python3
"""bitGen Studio — 3.7.0: 💎 FINE DETAIL (Direct3D-V3) - bitGen's stand-ins for the parts that need compiling
(misc/d3v3_shims: flash_attn, cudavoxelize, fillhole_cpp) checked against references, and misc/d3v3_run.py's pure parts.

Needs PyTorch + numpy + trimesh (the add-on's own environment has them):  <venv>/python scripts/test-d3v3-3700.py
D3V3_SRC=<a Direct3D-V3 checkout> also runs Direct3D-V3's OWN mesh_patches / fill_holes_torch on the stand-ins.
"""
import importlib.util
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
try:
    import numpy as np
    import torch
    import trimesh
except ImportError as e:
    print(f"SKIP: {e.name} is not installed here - run it with the 💎 add-on's Python")
    sys.exit(0)

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else f"\n      got {got!r}"[:700]))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


SH = ROOT / "misc" / "d3v3_shims"
FA = load("flash_attn", SH / "flash_attn.py")
VX = load("cudavoxelize", SH / "cudavoxelize.py")
FH = load("fillhole_cpp", SH / "fillhole_cpp.py")
RUN = load("d3v3_run", ROOT / "misc" / "d3v3_run.py")
torch.manual_seed(0)


def naive(q, k, v):                                 # [L, H, C]
    s = torch.einsum("qhc,khc->hqk", q, k) / q.shape[-1] ** 0.5
    return torch.einsum("hqk,khc->qhc", s.softmax(-1), v)


# ---- flash_attn
qkv = torch.randn(3, 16, 3, 4, 8)
out = FA.flash_attn_qkvpacked_func(qkv)
ref = torch.stack([naive(qkv[b, :, 0], qkv[b, :, 1], qkv[b, :, 2]) for b in range(3)])
check("flash_attn_qkvpacked_func = plain attention per batch", out.shape == (3, 16, 4, 8) and torch.allclose(out, ref, atol=1e-5))
lens = [5, 9, 5, 1, 12]
cu = torch.tensor([0] + list(np.cumsum(lens)), dtype=torch.int32)
pk = torch.randn(sum(lens), 3, 4, 8)
o2 = FA.flash_attn_varlen_qkvpacked_func(pk, cu, max(lens))
ref2 = torch.cat([naive(pk[s:e, 0], pk[s:e, 1], pk[s:e, 2]) for s, e in zip(cu[:-1].tolist(), cu[1:].tolist())])
check("flash_attn_varlen_qkvpacked_func: each packed sequence on its own (mixed lengths, a length 1)", torch.allclose(o2, ref2, atol=1e-5))
lq, lk = [4, 7, 2], [10, 10, 3]
cq = torch.tensor([0] + list(np.cumsum(lq)), dtype=torch.int32)
ck = torch.tensor([0] + list(np.cumsum(lk)), dtype=torch.int32)
q = torch.randn(sum(lq), 4, 8)
kv = torch.randn(sum(lk), 2, 4, 8)
o3 = FA.flash_attn_varlen_kvpacked_func(q, kv, cq, ck, max(lq), max(lk))
ref3 = torch.cat([naive(q[cq[i]:cq[i + 1]], kv[ck[i]:ck[i + 1], 0], kv[ck[i]:ck[i + 1], 1]) for i in range(3)])
check("flash_attn_varlen_kvpacked_func: cross attention, each query sequence to its own key sequence", torch.allclose(o3, ref3, atol=1e-5))
FA.CHUNK = 64                                       # forces many small batches
o4 = FA.flash_attn_varlen_qkvpacked_func(pk, cu, max(lens))
check("…the same answer when split into small chunks", torch.allclose(o4, ref2, atol=1e-5))


# ---- cudavoxelize vs the CUDA kernel's own test (a numpy port of voxel_kernel.cu)
def sat_voxels(V, F, D):
    out = np.zeros(D ** 3, dtype=bool)
    hb = 0.5 / (D - 1)
    for f in F:
        t = V[f].astype(np.float64)
        lo = np.maximum(0, np.floor((t.min(0) + 0.5) * (D - 1)).astype(int) - 9)
        hi = np.minimum(D - 1, np.floor((t.max(0) + 0.5) * (D - 1)).astype(int) + 9)
        e = [t[1] - t[0], t[2] - t[1], t[0] - t[2]]
        axes = [np.eye(3)[0], np.eye(3)[1], np.eye(3)[2], np.cross(e[0], e[1])] + [np.cross(np.eye(3)[a], ed) for a in range(3) for ed in e]
        for i in range(lo[0], hi[0] + 1):
            for j in range(lo[1], hi[1] + 1):
                for k in range(lo[2], hi[2] + 1):
                    c = np.array([i, j, k]) / (D - 1) - 0.5 + hb
                    tv = t - c
                    hit = True
                    for ax in axes:
                        if not ax.any():
                            continue
                        p = tv @ ax
                        r = hb * np.abs(ax).sum()
                        if p.min() > r or p.max() < -r:
                            hit = False
                            break
                    if hit:
                        out[(i * D + j) * D + k] = True
    return out


sph = trimesh.creation.icosphere(subdivisions=2, radius=0.4)
V = np.asarray(sph.vertices, dtype=np.float32)
Fc = np.asarray(sph.faces, dtype=np.int32)
D = 40
ref = sat_voxels(V, Fc, D)
vox = torch.zeros(D ** 3, dtype=torch.bool)
VX.voxelize(torch.tensor(V), torch.tensor(Fc), vox, len(Fc), D, 8.0)
got = vox.numpy()
extra = int((got & ~ref).sum())
cover = (got & ref).sum() / ref.sum()
check(f"cudavoxelize: EVERY voxel the real kernel marks (got {cover:.4f}) - a missed one could leave a hole", cover == 1.0, float(cover))
check(f"cudavoxelize: few extras ({extra} beside {int(ref.sum())}) - only voxels hugging the surface", extra <= 0.5 * ref.sum(), extra)
# patches of 8: what Direct3D-V3 builds its tokens from - the same set
P = 8


def patches(v):
    g = v.reshape(D, D, D)
    pts = np.argwhere(g)
    occ = set()
    for x, y, z in pts:
        lo = np.array([x, y, z]) // P
        hi = np.minimum(np.array([x, y, z]) + 1, D - 1) // P
        for a in (lo[0], hi[0]):
            for b in (lo[1], hi[1]):
                for c in (lo[2], hi[2]):
                    occ.add((a, b, c))
    return occ


pr, pg = patches(ref), patches(got)
check("cudavoxelize: every patch Direct3D-V3 makes tokens from is there, at most 10 % more (dilated like voxelization.py)", pr <= pg and len(pg) <= 1.1 * len(pr), (len(pr), len(pg), len(pr ^ pg)))

# ---- fillhole_cpp: holes closed, no edge repeated
mesh = trimesh.creation.icosphere(subdivisions=3)
drop = np.array([10, 11, 12, 200, 201, 500])
keep = np.ones(len(mesh.faces), dtype=bool)
keep[drop] = False
holed = trimesh.Trimesh(mesh.vertices, mesh.faces[keep], process=False)
check("the test sphere has holes", not holed.is_watertight)
src = os.environ.get("D3V3_SRC")
if src and Path(src, "direct3d").is_dir():
    sys.modules["fillhole_cpp"] = FH
    sys.modules["cudavoxelize"] = VX
    sys.path.insert(0, src)
    from direct3d.utils.fill_holes import fill_holes_torch      # noqa: E402  Direct3D-V3's own
    from direct3d.utils.voxelization import mesh_patches       # noqa: E402
    faces = fill_holes_torch(torch.tensor(holed.vertices, dtype=torch.float32), torch.tensor(holed.faces, dtype=torch.int64))
    closed = trimesh.Trimesh(holed.vertices, faces.numpy(), process=False)
    check("Direct3D-V3's fill_holes_torch with the stand-in: the sphere is closed again (watertight, consistent winding)", closed.is_watertight and closed.is_winding_consistent, (closed.is_watertight, closed.is_winding_consistent, len(faces)))
    coords = mesh_patches(torch.tensor(V) * 2, torch.tensor(Fc), 64, 8, 150000)
    check("Direct3D-V3's mesh_patches runs on the stand-in voxelizer (tokens [N, 4], batch column 0)", coords.ndim == 2 and coords.shape[1] == 4 and len(coords) > 50 and int(coords[:, 0].abs().sum()) == 0, tuple(coords.shape))
else:
    print("(D3V3_SRC not set - Direct3D-V3's own fill_holes_torch / mesh_patches legs not run)")
    E = holed.edges_sorted
    uniq, cnt = np.unique(E, axis=0, return_counts=True)
    bnd = []
    for f in holed.faces:                                        # the boundary edges, turned to face into the hole
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            k = (min(a, b), max(a, b))
            if cnt[np.where((uniq == k).all(1))[0][0]] == 1:
                bnd.append((b, a))
    new = FH.fill_hole_cuda1(torch.tensor(holed.vertices), torch.tensor(holed.faces, dtype=torch.int32), torch.tensor(bnd, dtype=torch.int32), torch.tensor(uniq, dtype=torch.int32))
    closed = trimesh.Trimesh(holed.vertices, np.vstack([holed.faces, new.numpy()]), process=False)
    check("fill_hole_cuda1: the sphere is closed again (watertight, consistent winding)", closed.is_watertight and closed.is_winding_consistent)
check("fill_hole_cuda1: no boundary = nothing added", FH.fill_hole_cuda1(torch.zeros(3, 3), torch.zeros(0, 3, dtype=torch.int32), torch.zeros(0, 2, dtype=torch.int32), torch.zeros(0, 2, dtype=torch.int32)).shape == (0, 3))

# ---- d3v3_run.py's pure parts
fit = RUN.fit_to(np.array([[0, 0, 0], [2, 4, 6.0]]), np.array([[-1, -1, -1], [1, 1, 1.0]]))
check("fit_to: the detailed mesh put back at the rough model's size and place (its longest side, centred)", np.allclose(fit, [[-1 / 3, -2 / 3, -1], [1 / 3, 2 / 3, 1]]), fit.tolist())
check("stages_for: 1024 = the 512 and 1024 passes; 1536 all three", RUN.stages_for(1024) == [512, 1024] and RUN.stages_for(1536) == [512, 1024, 1536] and RUN.stages_for(512) == [512])
print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
