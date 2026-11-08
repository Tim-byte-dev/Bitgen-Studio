#!/usr/bin/env python3
"""bitGen Studio — 2.730.0: FLOWHMR motion capture (non-commercial) as an add-on + the preview's 🕺 Motion.
Tim (verbatim): "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it to
addons with a disclaimer that it is for non commercial use only"
  1. lib/flowhmrAddon.js installFlowhmr with a stand-in pip / git / Hugging Face (node): the notice first; Python 3.13
     refused (numpy < 2); the code + its three submodules (no PHC); torch 2.10.0 + torchvision 0.25.0 from the CUDA index for
     THIS card (cu130 on a 50-series), the authors' requirements WITHOUT their cu118 torch pins, YOLOX -e --no-deps, the FBX
     SDK tried; the public model + YOLOX + the joint regressor; the gated VGGT-Omega / SAM 3D Body refused = said with the
     access pages, the SMPL-H model missing = said with where it goes, the install NOT ready; with access + SMPL-H: ready;
  2. lib/flowhmr.js jobParams refuses while anything is missing; the add-on in Settings ▸ Add-ons with the notice + links;
  3. LIVE misc/flowhmr_worker.py with a stand-in run_v2m_demo_generation.py: moving camera every 10 frames / still camera
     reach FlowHMR's own flags; the .fbx + .npz land in models3d/ as <video>_motion.*, @@OUT the .fbx; no FBX SDK = .npz
     alone, said; out of memory = said with what to try; not installed = said.
Run from repo root: python3 scripts/test-flowhmr730.py"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {str(extra)[:900]}"))
    if not cond:
        FAILED.append(name)


T = Path(tempfile.mkdtemp(prefix="fh730_"))
js = r"""
const fs = require('fs'), path = require('path');
const base = process.argv[1];
process.env.BITGEN_ADDON_BASE = base;
const A = require('./lib/flowhmrAddon');
const calls = [];
let gatedOk = false, pyver = '3.10';
const P = A.paths(base);
const touch = (f) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'x'); };
const run = async (cmd, args, o) => {
  calls.push([cmd, ...args].join(' '));
  const a = args.join(' ');
  if (a.includes("print('PYV")) { o.log('PYV ' + pyver); return 0; }
  if (args[0] === '-m' && args[1] === 'venv') { touch(A.paths(base).python); return 0; }
  if (args[0] === '-c' && a.includes('hf_hub_download') && a.includes('fafsaf1/flowhmr-0.46B')) { touch(P.ckpt); return 0; }
  if (args[0] === '-c' && a.includes('facebook/')) { if (!gatedOk) { o.log('401 Client Error: gated'); return 1; } touch(a.includes('VGGT') ? P.vggt : P.sam3d); return 0; }
  return 0;
};
const fetchRepo = async (url, dest) => {
  calls.push('FETCH ' + url + ' -> ' + path.relative(base, dest));
  if (/flowhmr\/flowhmr/.test(url)) { touch(path.join(dest, 'run_v2m_demo_generation.py')); touch(path.join(dest, 'requirements.txt'));
    fs.writeFileSync(path.join(dest, 'requirements.txt'), '--extra-index-url https://download.pytorch.org/whl/cu118\ntorch==2.5.1+cu118\ntorchvision==0.20.1+cu118\naccelerate==0.30.1\nnumpy>=1.24.0,<2.0  # pinned\n# fbxsdkpy\n');
    touch(path.join(dest, 'tools', 'web', 'requirements.txt')); fs.writeFileSync(path.join(dest, 'tools', 'web', 'requirements.txt'), 'flask>=3.0\nsupervision>=0.25,<0.31\n');
    fs.mkdirSync(path.join(dest, 'third_party', 'YOLOX'), { recursive: true }); fs.mkdirSync(path.join(dest, 'third_party', 'PerpetualHumanoidControl'), { recursive: true }); }
  else touch(path.join(dest, 'setup.py'));
  return { ok: true };
};
const download = async (url, dest) => { calls.push('GET ' + url); touch(dest); return { ok: true }; };
(async () => {
  const log = [];
  const ctx = { log: (l) => log.push(String(l)), run, fetchRepo, download, python: '/py', gpu: { cuda: true, torch: ['cu130', 'cu128'] }, base, git: 'git', hfToken: 'hf_x' };
  pyver = '3.13';
  const r0 = await A.installFlowhmr(Object.assign({}, ctx, { log: () => {} }));
  pyver = '3.10';
  const r1 = await A.installFlowhmr(ctx);
  const req = fs.readFileSync(path.join(base, 'flowhmr', 'requirements-bitgen.txt'), 'utf8');
  const st1 = A.status(base), miss1 = A.missing(base).map((m) => m.id);
  const jp1 = (process.env.BITGEN_ADDON_BASE = base, require('./lib/flowhmr').jobParams('/v/dance.mp4', {}));
  gatedOk = true; touch(P.smplh);
  const log2 = []; const n0 = calls.length;
  const r2 = await A.installFlowhmr(Object.assign({}, ctx, { log: (l) => log2.push(String(l)) }));
  const jp2 = require('./lib/flowhmr').jobParams('/v/dance.mp4', { camera: 'still', every: 7, steps: 500 });
  const ad = require('./lib/addons').list().find((x) => x.id === 'flowhmr');
  console.log(JSON.stringify({ r0, r1, r2, req, st1, miss1, jp1, jp2, calls, calls2: calls.slice(n0), log, log2, status2: A.status(base), ad,
    reql: A.reqLines('--extra-index-url x\ntorch==2.5.1+cu118\ntorchvision==1\n-e foo\nscipy>=1.10.0  # c\n\n') }));
})();
"""
r = subprocess.run(["node", "-e", js, str(T)], cwd=str(ROOT), capture_output=True, text=True, timeout=120)
try:
    J = json.loads(r.stdout.strip().splitlines()[-1])
except Exception:  # noqa: BLE001
    J = {}
    print(r.stdout[-1500:], r.stderr[-1500:])
calls = J.get("calls", [])
check("Python 3.13 refused in words (numpy < 2 has no 3.13 wheels)", J.get("r0", {}).get("ok") is False and "3.10 - 3.12" in J["r0"].get("error", ""), J.get("r0"))
check("the NON-COMMERCIAL notice is the install's first line", J.get("log", [""])[0].startswith("[!!] NON-COMMERCIAL USE ONLY"), J.get("log", [""])[:2])
fetches = [c for c in calls if c.startswith("FETCH")]
check("the code + exactly its three submodules (vggt-omega, YOLOX - an empty submodule folder is fetched, sam-3d-body); never PHC",
      any("flowhmr/flowhmr" in c for c in fetches) and any("vggt-omega" in c for c in fetches) and any("sam-3d-body" in c for c in fetches)
      and any("YOLOX.git" in c for c in fetches) and not any("PerpetualHumanoid" in c for c in fetches), fetches)
torch = [c for c in calls if "torch==2.10.0" in c]
check("torch 2.10.0 + torchvision 0.25.0 from the cu130 index first (an RTX 50-series), never the authors' cu118 pin",
      torch and "torchvision==0.25.0" in torch[0] and "download.pytorch.org/whl/cu130" in torch[0] and not any("cu118" in c for c in calls), torch)
req = J.get("req", "")
check("their requirements without the torch pins / extra index (+ the web ones, wheel, huggingface_hub)", "accelerate==0.30.1" in req and "flask>=3.0" in req
      and "numpy>=1.24.0,<2.0" in req and "torch" not in req.replace("torchdiffeq", "") and "--extra-index-url" not in req and "wheel" in req, req)
check("YOLOX -e --no-deps --no-build-isolation; the FBX SDK tried from INRIA's index", any("--no-build-isolation --no-deps -e" in c and "YOLOX" in c for c in calls)
      and any("fbxsdkpy==2020.1.post2" in c for c in calls))
check("the public files: YOLOX large (GitHub release), the joint regressor (GVHMR), the FlowHMR model (fafsaf1/flowhmr-0.46B flowhmr_latest)",
      any("GET https://github.com/Megvii-BaseDetection/YOLOX/releases" in c for c in calls) and any("smpl_neutral_J_regressor.pt" in c for c in calls)
      and any("fafsaf1/flowhmr-0.46B" in c and "flowhmr_latest" in c for c in calls))
r1 = J.get("r1", {})
check("gated refused + no SMPL-H: NOT ready, says VGGT-Omega, SAM 3D Body, SMPL-H; the log names the access pages + where model.npz goes",
      r1.get("ok") is False and "almost ready" in r1.get("error", "") and set(J.get("miss1", [])) == {"vggt", "sam3d", "smplh"}
      and any("huggingface.co/facebook/VGGT-Omega" in l and "token" in l for l in J.get("log", []))
      and any("mano.is.tue.mpg.de" in l and "model.npz" in l for l in J.get("log", [])), (r1, J.get("miss1")))
check("status says 'almost' with each missing piece and how; jobParams refuses while anything is missing",
      J.get("st1", {}).get("installed") is False and "SMPL-H" in J["st1"].get("note", "") and "Settings ▸ Add-ons ▸ FlowHMR" in str(J.get("jp1", {}).get("error")), (J.get("st1"), J.get("jp1")))
c2 = J.get("calls2", [])
check("Install again with access + SMPL-H in place: ready; nothing fetched again, only the gated files downloaded",
      J.get("r2", {}).get("ok") is True and J.get("status2", {}).get("installed") is True and not any(c.startswith("FETCH") or c.startswith("GET") for c in c2)
      and sum("facebook/" in c for c in c2) == 2 and any("NON-COMMERCIAL" in l for l in J.get("log2", [])[-2:]), (J.get("r2"), c2))
jp = (J.get("jp2") or {}).get("params", {})
check("jobParams when ready: mode flowhmr, camera still, every 7 -> 10 (one of 1 / 5 / 10), steps 500 -> 100, the install's paths, the notice in the note",
      jp.get("mode") == "flowhmr" and jp.get("camera") == "still" and jp.get("every") == 10 and jp.get("steps") == 100
      and jp.get("flowhmr", {}).get("script", "").endswith("run_v2m_demo_generation.py") and "NON-COMMERCIAL" in J["jp2"].get("note", ""), J.get("jp2"))
ad = J.get("ad") or {}
check("Settings ▸ Add-ons: 'FlowHMR motion capture (non-commercial use only)', the warning in what it is for, 4 links (MANO, the two gated pages, GitHub)",
      ad.get("label") == "FlowHMR motion capture (non-commercial use only)" and "NON-COMMERCIAL USE ONLY" in ad.get("for", "")
      and [l["url"] for l in ad.get("links", [])][:3] == ["https://mano.is.tue.mpg.de/", "https://huggingface.co/facebook/VGGT-Omega", "https://huggingface.co/facebook/sam-3d-body-dinov3"], ad)
check("reqLines: no torch family, no index / -e lines, comments stripped", J.get("reql") == ["scipy>=1.10.0"], J.get("reql"))

# 3 LIVE worker with a stand-in FlowHMR
inst = T / "fake" / "FlowHMR"
(inst / "checkpoints" / "flowhmr_latest").mkdir(parents=True)
(inst / "checkpoints" / "flowhmr_latest" / "flowhmr_latest.ckpt").write_text("x")
script = inst / "run_v2m_demo_generation.py"
script.write_text(r'''
import argparse, os, sys, json
p = argparse.ArgumentParser(); p.add_argument("videos", nargs="+"); p.add_argument("--ckpt"); p.add_argument("--steps", type=int)
p.add_argument("--vggt_interval", type=int, default=1); p.add_argument("--static_camera", action="store_true")
a = p.parse_args()
if os.environ.get("FAKE_OOM"):
    print("RuntimeError: CUDA error: out of memory"); sys.exit(1)
stem = os.path.splitext(os.path.basename(a.videos[0]))[0]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", stem); os.makedirs(out, exist_ok=True)
tag = os.path.splitext(os.path.basename(a.ckpt))[0]
open(os.path.join(out, tag + ".npz"), "wb").write(b"NPZ" + json.dumps(vars(a)).encode())
if not os.environ.get("FAKE_NO_FBX"):
    open(os.path.join(out, tag + ".fbx"), "wb").write(b"Kaydara FBX Binary  ")
print("Saved", out, "cwd", os.getcwd(), "backend", os.environ.get("FLOWHMR_ATTENTION_BACKEND"))
''')
clip = T / "my dance.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=24", "-t", "1", "-pix_fmt", "yuv420p", str(clip)], check=True)


def run_worker(name, params, env=None):
    jd = T / name
    jd.mkdir()
    md = jd / "models3d"
    job = {"params": dict({"mode": "flowhmr", "source": str(clip), "camera": "moving", "every": 10, "steps": 20, "models_dir": str(md),
                           "flowhmr": {"python": sys.executable, "script": str(script), "ckpt": str(inst / "checkpoints" / "flowhmr_latest" / "flowhmr_latest.ckpt")}}, **params),
           "config": {}, "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "flowhmr_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=120, env=dict(os.environ, **(env or {})))
    return r, sorted(p.name for p in md.glob("*")) if md.exists() else [], md


r, files, md = run_worker("a", {})
npz = (md / "my_dance_motion.npz").read_bytes() if (md / "my_dance_motion.npz").exists() else b""
check("LIVE moving camera every 10 frames: FlowHMR's own flags (--vggt_interval 10, --steps 20, the ckpt), run in its folder; .fbx + .npz in models3d as my_dance_motion.*; @@OUT the .fbx; the notice in the log",
      r.returncode == 0 and files == ["my_dance_motion.fbx", "my_dance_motion.npz"] and b'"vggt_interval": 10' in npz and b'"static_camera": false' in npz
      and "@@OUT my_dance_motion.fbx" in r.stdout and "NON-COMMERCIAL" in r.stdout and f"cwd {inst}" in r.stdout and "backend query_batched" in r.stdout
      and (md.parent / "out" / "my_dance_motion.fbx").exists(), (r.returncode, files, r.stdout[-1200:]))
r, files, md = run_worker("b", {"camera": "still"}, {"FAKE_NO_FBX": "1"})
npz = (md / "my_dance_motion.npz").read_bytes() if (md / "my_dance_motion.npz").exists() else b""
check("LIVE still camera, no FBX SDK: --static_camera, its own cache name (_still), the .npz alone - said; @@OUT the .npz",
      r.returncode == 0 and files == ["my_dance_motion.npz"] and b'"static_camera": true' in npz and b"my_dance_still" in npz
      and "no .fbx" in r.stdout and "@@OUT my_dance_motion.npz" in r.stdout, (r.returncode, files, r.stdout[-800:]))
r, files, _ = run_worker("c", {}, {"FAKE_OOM": "1"})
check("LIVE out of memory: fails in words with what to try (a still camera / every 10 frames), no file",
      r.returncode != 0 and "out of memory" in r.stdout and "still camera" in r.stdout and not files, r.stdout[-600:])
r, files, _ = run_worker("d", {"flowhmr": {"python": "/nope/python", "script": "/nope/run.py", "ckpt": "/nope/x.ckpt"}})
check("LIVE not installed: fails pointing at Settings ▸ Add-ons ▸ FlowHMR", r.returncode != 0 and "Settings ▸ Add-ons ▸ FlowHMR" in r.stdout, r.stdout[-400:])
core_js = (ROOT / "lib" / "core.js").read_text(encoding="utf-8")
check("wired: core runs mode flowhmr with misc/flowhmr_worker.py; routes/index mounts routes/flowhmr; nothing in misc/server.js",
      'flowhmr: "flowhmr_worker.py"' in core_js and 'require("./flowhmr").mount(app)' in (ROOT / "routes" / "index.js").read_text(encoding="utf-8")
      and "flowhmr" not in (ROOT / "misc" / "server.js").read_text(encoding="utf-8").lower())

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
