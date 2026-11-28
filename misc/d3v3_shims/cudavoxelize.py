"""bitGen Studio — misc/d3v3_shims/cudavoxelize.py (3.7.0): a STAND-IN for Direct3D-V3's compiled voxelizer
(third_party/voxelization: CUDA, needs the CUDA toolkit + a C++ compiler to build), used by 💎 Fine detail ONLY when the real
module does not import (misc/d3v3_run.py loads it then).

voxelize(vertices [V, 3] float, faces [F, 3] int, voxel [D^3] bool (filled in place), n_tri, dim, threshold)
The real kernel marks every voxel a triangle touches (a triangle / box separating-axis test); voxel (i, j, k) spans
[i / (D-1) - 0.5, + 1 / (D-1)] in x, likewise j in y and k in z, index i*D*D + j*D + k. Here each triangle is sampled on a grid
of points a QUARTER of a voxel apart (no point of a triangle is further than that from a sample), and every voxel within that
distance of a sample is marked: every voxel the real kernel marks, plus a few it would not that lie within a quarter of a
voxel of the surface (a token more, never a hole). Direct3D-V3 dilates the voxels into patches right after. Runs on the
tensors' device (the GPU in practice), chunked.
"""
import itertools

import torch

STAND_IN = True
POINTS = 1 << 21                                 # sample points a chunk at most
STEP = 0.25                                      # the sample spacing, in voxels
OFFS = list(itertools.product((-1.0, 1.0), repeat=3))


def _grid(n, device):
    i = torch.arange(n + 1, device=device)
    a, b = torch.meshgrid(i, i, indexing="ij")
    keep = (a + b) <= n
    return torch.stack((a[keep], b[keep]), dim=1).float() / n    # [P, 2] barycentric steps


def voxelize(vertices, faces, voxel, n_tri, dim, threshold=8.0):
    D = int(dim)
    v = vertices.float()
    f = faces.long()[: int(n_tri)]
    if not len(f):
        return
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    ab, ac = b - a, c - a
    L = torch.stack(((b - a).norm(dim=1), (c - b).norm(dim=1), (a - c).norm(dim=1)), dim=1).amax(dim=1)
    h = STEP / (D - 1)
    n = torch.clamp(torch.ceil(L / h), min=1).long()
    offs = [torch.tensor(o, device=v.device, dtype=torch.float32) * h for o in OFFS]
    for nv in torch.unique(n).tolist():
        sel = (n == nv).nonzero().squeeze(1)
        w = _grid(int(nv), v.device)                                   # [P, 2]
        per = max(1, POINTS // len(w))
        for s in range(0, len(sel), per):
            t = sel[s:s + per]
            P = a[t, None, :] + ab[t, None, :] * w[None, :, :1] + ac[t, None, :] * w[None, :, 1:]   # [T, P, 3]
            for o in offs:                                             # every voxel within one spacing of a sample
                q = torch.floor((P + o + 0.5) * (D - 1)).long().clamp_(0, D - 1)
                voxel[((q[..., 0] * D + q[..., 1]) * D + q[..., 2]).reshape(-1)] = True
