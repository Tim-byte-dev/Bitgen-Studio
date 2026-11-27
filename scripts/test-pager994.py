#!/usr/bin/env python3
"""bitGen Studio 2.994.0 - ⛰ Panorama depth: misc/pager_geo.py (the mesh, the .glb, the stereo 360) and misc/pager_worker.py
end to end with a stand-in for PaGeR's venv Python (no model here - the files it would write are made by the stand-in).
Tim: "is this worth adding? https://pager360.github.io/" -> "yes do it please, first time dl, add disclaimer that these models
are for non-commercial use only"."""
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "misc"))
import numpy as np  # noqa: E402
import pager_geo as G  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS:", name)
    else:
        F += 1
        print("FAIL:", name + ("" if got is None else "\n      got " + str(got)[:500]))


d = G.dirs(4, 8)
check("dirs: bitGen's convention - u 0.5 ahead (-Z), u 0.75 right (+X), the top row up; unit length",
      d[1, 4, 2] < -0.6 and abs(d[1, 4, 0]) < 0.4 and d[1, 6, 0] > 0.6 and d[0, 4, 1] > 0.9 and np.allclose(np.linalg.norm(d, axis=-1), 1.0))
g = G.grid(np.arange(16 * 8, dtype=np.float64).reshape(8, 16), 4, 2)
check("grid: the area mean onto a smaller grid", g.shape == (2, 4) and abs(float(g[0, 0]) - np.arange(16 * 8).reshape(8, 16)[:4, :4].mean()) < 1e-4)
pos, uv, idx = G.mesh(np.full((8, 16), 3.0))
check("mesh: every vertex at its depth along its ray; the seam column doubled (u past 1); triangles inside the vertex list",
      pos.shape == (8 * 17, 3) and np.allclose(np.linalg.norm(pos, axis=1), 3.0) and uv[:, 0].max() > 1.0 and idx.max() < len(pos) and len(idx) == 7 * 16 * 6)
b = G.glb(pos, uv, idx, b"\xff\xd8\xff\xe0jpeg", "t")
magic, ver, total = struct.unpack("<III", b[:12])
jl, jt = struct.unpack("<II", b[12:20])
j = json.loads(b[20:20 + jl])
check("glb: a valid glTF 2.0 binary - header, JSON + BIN chunks 4-byte aligned, unlit, double-sided, the JPEG inside",
      magic == 0x46546C67 and ver == 2 and total == len(b) and jt == 0x4E4F534A and len(b) % 4 == 0 and j["materials"][0]["doubleSided"] is True
      and "KHR_materials_unlit" in j["extensionsUsed"] and j["images"][0]["mimeType"] == "image/jpeg" and j["accessors"][2]["count"] == len(idx)
      and "non-commercial" in j["asset"]["generator"])
H, W = 128, 256
rgb = np.zeros((H, W, 3), np.uint8)
rgb[:] = (40, 40, 200)
dep = np.full((H, W), 20.0)
rgb[60:68, 124:132] = (250, 20, 20)
dep[60:68, 124:132] = 0.5
L, R = G.eye(rgb, dep, 0.064, -1), G.eye(rgb, dep, 0.064, +1)
cx = lambda im: float(np.where(im[60:68, :, 0] > 200)[1].mean())
want = math.asin(0.032 / 0.5) * W / (2 * math.pi)
check("stereo: a near thing moves right in the left eye, left in the right eye, by the angle the eyes see it apart",
      cx(L) > cx(rgb) > cx(R) and abs((cx(L) - cx(rgb)) - want) < 1.0, (cx(rgb), cx(L), cx(R), want))
check("…no holes (the gaps filled from what was behind), far things where they were", int((L.sum(axis=2) == 0).sum()) == 0 and (L[10, 10] == rgb[10, 10]).all())
pole = np.full((H, W), 0.5)
pl = G.eye(rgb, pole, 0.064, -1)
check("…faded to nothing at the poles (no swirl overhead)", (pl[0] == rgb[0]).all())
tb = G.stereo_tb(rgb, dep)
check("stereo_tb: top = left eye, bottom = right eye, twice as high", tb.shape == (2 * H, W, 3) and (tb[:H] == L).all() and (tb[H:] == R).all())

# ---- the worker end to end: a stand-in "venv python" writes what pager_run.py would and says @@RESULT
with tempfile.TemporaryDirectory() as T:
    T = Path(T)
    src = T / "pager" / "PaGeR"
    (src / "src").mkdir(parents=True)
    (src / "src" / "pager.py").write_text("# stand-in")
    fake = T / "fake_run.py"
    fake.write_text(
        "import json, sys, os\n"
        "a = json.load(open(sys.argv[2]))\n"
        "if os.environ.get('FAKE_OOM'): print('CUDA out of memory. Tried to allocate 2 GiB'); sys.exit(1)\n"
        "s, o = a['stem'], a['out_dir']\n"
        "files = {'preview': s + '_depth.png', 'depth16': s + '_depth16.png', 'normals': s + '_normals.png', 'sky': s + '_sky.png', 'grid': s + '_depth.f32', 'mesh': s + '_depth.glb', 'stereo': s + '_360_TB.png', 'meta': s + '_depth.json'}\n"
        "[open(os.path.join(o, n), 'wb').write(b'x') for n in files.values()]\n"
        "print('[pager] the depth, the normals and the sky (indoor scale)')\n"
        "print('@@RESULT ' + json.dumps({'scene': 'indoor', 'near': 1.2, 'median': 4.0, 'seconds': 3.1, 'files': files, 'cwd': os.getcwd()}))\n")
    py = T / "py.sh"
    py.write_text(f"#!/bin/sh\nexec {sys.executable} {fake} \"$@\"\n")
    py.chmod(0o755)
    pic = T / "My Pano.png"
    pic.write_bytes(b"png")
    out, models = T / "output", T / "models3d"
    run = lambda env=None: subprocess.run([sys.executable, str(ROOT / "misc" / "pager_worker.py"), str(T / "job.json")], cwd=str(T), capture_output=True, text=True, env=dict(os.environ, **(env or {})))
    job = {"output_dir": str(out), "params": {"mode": "panodepth", "source": str(pic), "name": "My_Pano", "scene": "auto", "ipd": 0.064, "stereo": True, "mesh": True,
                                              "models_dir": str(models), "pager": {"python": str(py), "src": str(src), "repo": "prs-eth/PaGeR"}}}
    (T / "job.json").write_text(json.dumps(job))
    r = run()
    lines = r.stdout.splitlines()
    outs = json.loads(next(x[7:] for x in lines if x.startswith("@@OUTS ")))
    check("the worker: the disclaimer first, PaGeR run in its folder, @@OUTS = the stereo 360 + the coloured depth, @@MODEL3D = the mesh",
          r.returncode == 0 and "NON-COMMERCIAL" in lines[0] and outs == ["My_Pano_360_TB.png", "My_Pano_depth.png"] and "@@MODEL3D My_Pano_depth.glb" in lines, r.stdout[-800:] + r.stderr[-400:])
    check("…the gallery gets the stereo 360, the coloured depth and the view's .f32 / .json; models3d the mesh + depth16 / normals / sky",
          sorted(os.listdir(out)) == sorted(["My_Pano_360_TB.png", "My_Pano_depth.png", "My_Pano_depth.f32", "My_Pano_depth.json"])
          and sorted(os.listdir(models)) == sorted(["My_Pano_depth.glb", "My_Pano_depth16.png", "My_Pano_normals.png", "My_Pano_sky.png"]), (os.listdir(out), os.listdir(models)))
    r2 = run()
    check("a second run of the same picture never writes over the first (My_Pano_2_…)", r2.returncode == 0 and (out / "My_Pano_2_360_TB.png").exists(), r2.stdout[-300:])
    r3 = run({"FAKE_OOM": "1"})
    check("PaGeR stops (out of memory): the job fails with its words + the 12 GB hint", r3.returncode != 0 and "out of memory" in r3.stdout and "12 GB" in r3.stdout, r3.stdout[-400:])
    job["params"]["pager"]["python"] = str(T / "nope")
    (T / "job.json").write_text(json.dumps(job))
    r4 = run()
    check("not installed: says where to install it", r4.returncode != 0 and "Settings ▸ Add-ons ▸ ⛰ Panorama depth" in r4.stdout)
run_src = (ROOT / "misc" / "pager_run.py").read_text(encoding="utf-8")
check("pager_run.py calls PaGeR as its own app.py does (Pager(Path(repo), cfg=cfg, device), the cube faces, the scale head, float16, the logging helpers)",
      all(x in run_src for x in ["Pager(Path(repo), cfg=cfg, device=device)", "pager.get_intrinsics_extrinsics(image_size=face_size, fov=cube_fov)",
                                 "erp_to_cubemap(img, face_w=face_size, fov=cube_fov)", "skip_heads=skip", "dtype=torch.float16",
                                 "prepare_depth_for_logging(pager", "prepare_normals_for_logging(pager", "cubemap_to_erp(torch.sigmoid(sky_pred.float())"]))
print(f"\nRESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
