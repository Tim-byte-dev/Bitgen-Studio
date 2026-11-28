"""bitGen Studio — misc/d3v3_shims/fillhole_cpp.py (3.7.0): a STAND-IN for Direct3D-V3's compiled hole filler
(third_party/fill_holes: C++ / CUDA, needs the CUDA toolkit + a C++ compiler to build), used by 💎 Fine detail ONLY when the
real module does not import (misc/d3v3_run.py loads it then).

fill_hole_cuda1(vertices [V, 3], faces [F, 3] int32, boundary_edges [K, 2] int32, unique_edges [E, 2] int32) -> [M, 3] int32
The new faces that close the mesh's holes (the caller adds them; no new vertices). Like the original: the boundary edges
(already turned to face into the hole) are walked into closed loops; each loop is then filled as a fan from one of its
corners - the corner is chosen so no new edge repeats an edge the mesh already has (a repeated edge would make the surface
non-manifold); a loop with no such corner, or over MAX_LOOP corners, is left open.
"""
import torch

STAND_IN = True
MAX_LOOP = 2000


def _loops(edges):
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    used, loops = set(), []
    for start in list(nxt.keys()):
        if (start, nxt[start][0]) in used:
            continue
        loop, cur, seen = [start], start, {start}
        ok = False
        while True:
            cands = [x for x in nxt.get(cur, []) if (cur, x) not in used]
            if not cands:
                break
            x = cands[0]
            used.add((cur, x))
            if x == start:
                ok = True
                break
            if x in seen:
                break
            loop.append(x)
            seen.add(x)
            cur = x
        if ok and len(loop) >= 3:
            loops.append(loop)
    return loops


def _fan(loop, have):
    n = len(loop)
    if n == 3:
        return [tuple(loop)]
    for k in range(min(n, 64)):
        apex = loop[k]
        diag = [loop[(k + i) % n] for i in range(2, n - 1)]
        if all((min(apex, d), max(apex, d)) not in have for d in diag):
            return [(apex, loop[(k + i) % n], loop[(k + i + 1) % n]) for i in range(1, n - 1)]
    return []


def fill_hole_cuda1(vertices, faces, boundary_edges, unique_edges):
    E = boundary_edges.to("cpu").tolist()
    loops = _loops([(int(a), int(b)) for a, b in E])
    if not loops:
        return torch.empty((0, 3), dtype=torch.int32)
    have = set((min(int(a), int(b)), max(int(a), int(b))) for a, b in unique_edges.to("cpu").tolist())
    out = []
    for lp in loops:
        if len(lp) > MAX_LOOP:
            continue
        tri = _fan(lp, have)
        for t in tri:
            have.update({(min(t[0], t[1]), max(t[0], t[1])), (min(t[1], t[2]), max(t[1], t[2])), (min(t[2], t[0]), max(t[2], t[0]))})
        out.extend(tri)
    return torch.tensor(out, dtype=torch.int32).reshape(-1, 3) if out else torch.empty((0, 3), dtype=torch.int32)
