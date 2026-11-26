#!/usr/bin/env node
// bitGen Studio 2.976.0 - 🦴 RIG IT (UniRig, MIT): a skeleton + skin weights for a project 3D model (a person, an animal, a
// creature made by 🧊 Convert to 3D / 🧱 Picture → 3D scene) -> <name>_rigged.glb. The add-on (lib/rigAddon.js) installed with
// a fake run (no network), the worker's five commands (misc/rig_worker.py, python), the route + the Sketcher's 🦴 Rig ▾.
// Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with facegen?" ->
// "yes please". The browser leg is test-ui976-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
(async () => {
  const A = require(path.join(ROOT, "lib/rigAddon.js")), R = require(path.join(ROOT, "ext/pushpulldock/pprig.js"));
  check("reqLines(): UniRig's requirements without torch / flash_attn / numpy / wandb / spconv (bitGen installs those its own way)",
    JSON.stringify(A.reqLines("transformers==4.51.3\npython-box\nbpy==4.2\nflash_attn\nwandb\nnumpy\n# c\ntrimesh\n-f x")) === JSON.stringify(["transformers==4.51.3", "python-box", "bpy==4.2", "trimesh"]));
  const rel = [{ draft: false, assets: [{ name: "flash_attn-2.8.3+cu128torch2.7.0cxx11abiFALSE-cp311-cp311-win_amd64.whl", browser_download_url: "u27" },
    { name: "flash_attn-2.8.3+cu128torch2.8.0cxx11abiFALSE-cp312-cp312-win_amd64.whl", browser_download_url: "u312" }] },
    { draft: false, assets: [{ name: "flash_attn-2.8.2+cu128torch2.8.0cxx11abiFALSE-cp311-cp311-win_amd64.whl", browser_download_url: "good" }] }];
  check("pickFlashWheel(): Python 3.11 + win_amd64 + torch 2.8 + a cu12x build (not 2.7, not cp312); nothing fits -> null",
    A.pickFlashWheel(rel, { plat: "win_amd64", torch: "2.8.0" }) === "good" && A.pickFlashWheel(rel, { plat: "win_amd64", torch: "2.9.0" }) === null && A.pickFlashWheel(null) === null);
  check("pprig: canRig (models, not what is already rigged) + rigName", R.canRig("car.glb") && R.canRig("dog.FBX") && !R.canRig("bench_rigged.glb") && !R.canRig("x.png") && R.rigName("my dog.glb") === "my_dog_rigged.glb");

  /* the install with a fake run: Python 3.12 -> uv makes 3.11; torch, the packages, PyG, spconv (cu126 fails -> cu124), flash-attn
     (Linux: pip), the checkpoints */
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "rig976_")), calls = [];
  const p = A.paths(base);
  fs.mkdirSync(p.src, { recursive: true }); fs.writeFileSync(p.run, "# run"); fs.writeFileSync(path.join(p.src, "requirements.txt"), "transformers==4.51.3\nbpy==4.2\nflash_attn\n");
  const run = async (exe, args) => {
    calls.push([path.basename(exe), args.join(" ")]);
    if (args[0] === "-c" && /PYV/.test(args[1])) return 0;
    if (exe === "uv") { fs.mkdirSync(path.dirname(p.python), { recursive: true }); fs.writeFileSync(p.python, "#!"); return 0; }
    if (args.includes("spconv-cu126")) return 1;
    return 0;
  };
  const SA = require(path.join(ROOT, "lib/speechAddons.js")), realOk = SA.pythonOk;
  SA.pythonOk = async () => ({ ver: "3.12" });
  const logs = [];
  let r;
  try { r = await A.installRig({ base, run, python: "/usr/bin/python3", gpu: { cuda: true, torch: ["cu128"] }, uv: "uv", log: (l) => logs.push(l), fetchRepo: async () => ({ ok: true }) }); }
  finally { SA.pythonOk = realOk; }
  const txt = calls.map((c) => c.join(" ")).join("\n");
  check("install: ok; Python 3.12 here -> uv makes a Python 3.11 venv (bpy 4.2 is 3.11 only)", r && r.ok && /^uv venv --seed -p 3\.11 /m.test(txt), { r, txt: txt.slice(0, 600) });
  check("install: torch 2.8.0 from the card's CUDA index, then the packages file (no flash_attn / torch in it)", /torch==2\.8\.0 torchvision==0\.23\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cu128/.test(txt)
    && !/flash_attn/.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")) && /numpy==1\.26\.4/.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")));
  check("install: torch_scatter + torch_cluster from PyG's torch 2.8.0 + cu128 page; spconv cu126 failed -> cu124", /torch_scatter torch_cluster -f https:\/\/data\.pyg\.org\/whl\/torch-2\.8\.0\+cu128\.html/.test(txt) && /spconv-cu124/.test(txt) && !/spconv-cu121/.test(txt));
  check("install: flash-attn by pip off Windows; the checkpoints from VAST-AI/UniRig; ready after", /flash-attn --no-build-isolation/.test(txt) && /VAST-AI\/UniRig/.test(txt) && A.missing(base).length === 0 && A.status(base).installed);
  check("status(): nothing there -> not installed (+ what it is)", !A.status(path.join(base, "nope")).installed && A.missing(path.join(base, "nope")).length === 5);
  fs.rmSync(base, { recursive: true, force: true });

  /* the worker's commands (python) */
  const out = require("child_process").execFileSync("python3", ["-c", [
    "import sys, json; sys.path.insert(0, sys.argv[1]); import rig_worker as w; from pathlib import Path",
    "s, o = w.plan('py', Path('/w/dog.glb'), Path('/w'), {'name': 'dog', 'seed': 7, 'faces': 40000}, 'T')",
    "print(json.dumps([[a, ' '.join(map(str, c)), str(e)] for a, c, e in s] + [str(o)]))",
    "s2, o2 = w.plan('py', Path('/w/dog.glb'), Path('/w'), {'name': 'dog', 'skin': False}, 'T')", "print(len(s2))"].join("\n"), path.join(ROOT, "misc")], { encoding: "utf8" }).trim().split("\n");
  const st = JSON.parse(out[0]);
  check("worker: extract -> skeleton -> extract the skeleton -> skin -> merge onto the ORIGINAL model; skin off = 3 steps",
    st.length === 6 && /-m src\.data\.extract .*--faces_target_count=40000 .*--input=\/w\/dog\.glb --output_dir=\/w\/npz1/.test(st[0][1])
    && /run\.py --task=configs\/task\/quick_inference_skeleton_articulationxl_ar_256\.yaml --seed=7 --input=\/w\/dog\.glb --output=\/w\/skeleton\/dog\.fbx --npz_dir=\/w\/npz1/.test(st[1][1])
    && /--input=\/w\/skeleton\/dog\.fbx --output_dir=\/w\/npz2/.test(st[2][1]) && /quick_inference_unirig_skin\.yaml .*--data_name=raw_data\.npz/.test(st[3][1])
    && /src\.inference\.merge .*--source=\/w\/skin\/dog\.fbx --target=\/w\/dog\.glb --output=\/w\/dog_rigged\.glb/.test(st[4][1]) && st[5] === "/w/dog_rigged.glb" && out[1] === "3", st);

  /* jobParams */
  const tg = path.join(os.tmpdir(), "rig976.glb"); fs.writeFileSync(tg, "glTF");
  check("jobParams(): a model that is not there / not a model / the add-on not installed -> each says so (Settings ▸ Add-ons)",
    /not in this project/.test(A.jobParams(path.join(os.tmpdir(), "nope976.glb")).error) && /UniRig rigs \.glb/.test(A.jobParams(__filename).error)
    && /Settings ▸ Add-ons ▸ 🦴 Rig it/.test(A.jobParams(tg).error) && Array.isArray(A.jobParams(tg).missing));
  fs.rmSync(tg, { force: true });

  /* wiring */
  const idx = src("routes/index.js"), core = src("lib/core.js"), ad = require(path.join(ROOT, "lib/addons.js")).LIST.find((a) => a.id === "unirig");
  check("wiring: routes/rig.js from routes/index.js (never server.js), WORKER_FOR rig, the misc/ list, the add-on (size / needs / links)",
    /require\("\.\/rig"\)\.mount\(app\)/.test(idx) && !/rig/.test(src("misc/server.js").replace(/[A-Za-z]rig|rig[A-Za-z]/g, "")) && /rig: "rig_worker\.py"/.test(core) && /"rig_worker\.py"/.test(src("lib/miscMigrate.js"))
    && ad && /7 GB/.test(ad.size) && /8 GB/.test(ad.needs) && ad.links().length === 2);
  const ext = JSON.parse(src("ext/pushpulldock/ext.json")).scripts;
  check("the Sketcher: 🦴 Rig ▾ (#ppRig) + pprig.js loaded; the 🧱 dialog's objects each a 🦴 Rig", /id="ppRig"/.test(src("ext/pushpulldock/dock.html")) && ext.includes("pprig.js") && /H3Rig/.test(src("ext/pushpulldock/ppdock.js")) && /data-rig=/.test(src("ext/pushpulldock/ppscene.js")));
  check("the docs: USAGE + CHANGELOG + NOTICE (UniRig MIT)", /🦴 Rig it/.test(src("docs/USAGE.md")) && /2\.976\.0/.test(src("misc/CHANGELOG.md")) && /UniRig/.test(src("misc/NOTICE.md")));
  console.log(`\n${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
