#!/usr/bin/env node
/* bitGen Studio — 3.7.0: 💎 FINE DETAIL (Direct3D-V3) in the Sketcher - the add-on (lib/d3v3Addon.js: what is missing, the
 * install with a fake runner - flash-attn and the compiled parts falling back to bitGen's stand-ins, a gated DINOv3), the job
 * (jobParams), the route (routes/d3v3.js), the dialog's pure parts (ppdetail.js) and the wiring. The stand-ins' maths:
 * scripts/test-d3v3-3700.py; the real clicks: scripts/test-ui3700-ui.js.
 * Tim: "can you add this to sketcher. https://dreamtechai.github.io/Direct3D-V3/" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const A = require(path.join(ROOT, "lib/d3v3Addon.js"));
const D = require(path.join(ROOT, "ext/pushpulldock/ppdetail.js"));

(async () => {
  // ---- pure parts
  const req = A.reqLines("torch>=2.5\ntorchvision\nnumpy\n# a comment\ntrimesh>=4\nflash-attn\ngradio==6.32.0\n-e .\ntransformers>=4.57\n");
  check("reqLines: torch / torchvision / flash-attn / gradio (the demo) left to bitGen, the rest kept", req.join() === "numpy,trimesh>=4,transformers>=4.57", req);
  const rel = [{ draft: false, assets: [
    { name: "flash_attn-2.8.3+cu128torch2.8.0cxx11abiFALSE-cp311-cp311-win_amd64.whl", browser_download_url: "u311" },
    { name: "flash_attn-2.8.3+cu128torch2.9.0cxx11abiFALSE-cp312-cp312-win_amd64.whl", browser_download_url: "u29" },
    { name: "flash_attn-2.8.3+cu128torch2.8.0cxx11abiFALSE-cp312-cp312-win_amd64.whl", browser_download_url: "u312" }] }];
  check("pickFlashWheel: this Python (cp312) + win_amd64 + torch 2.8 + a cu12x build - not 3.11's, not torch 2.9's",
    A.pickFlashWheel(rel, { py: "cp312", torch: "2.8.0" }) === "u312" && A.pickFlashWheel(rel, { py: "cp311" }) === "u311" && A.pickFlashWheel(rel, { py: "cp313" }) === null);
  check("pickFlashWheel: drafts and prereleases skipped", A.pickFlashWheel([{ prerelease: true, assets: rel[0].assets }], { py: "cp312" }) === null);
  check("roughOk: a .glb / .obj / .ply / .stl - not a rigged copy", D.roughOk("car.glb") && D.roughOk("a.OBJ") && D.roughOk("s.ply") && !D.roughOk("x.fbx") && !D.roughOk("man_rigged.glb"));
  check("detailName: <name>_detail.glb, a made rough model's _rough left off", D.detailName("my car_rough.glb") === "my_car_detail.glb" && D.detailName("vase.obj") === "vase_detail.glb");

  // ---- the install, with a fake runner: Python 3.12 here, flash-attn and the compiled parts do not install -> stand-ins
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "d3v3-")), p = A.paths(base);
  check("not installed: every part missing, the note says what it is", A.missing(base).length === 8 && /not installed/.test(A.status(base).note) && /DINOv3/.test(A.status(base).note));
  const SA = require(path.join(ROOT, "lib/speechAddons.js")), realOk = SA.pythonOk;
  SA.pythonOk = async () => ({ ver: "3.12" });
  const calls = [], logs = [];
  let gated = false, first = ""; const toks = [];
  const run = async (exe, args, o) => {
    calls.push(path.basename(exe) + " " + args.join(" ") + (o && o.cwd ? " @" + path.basename(o.cwd) : ""));
    if (args[0] === "-m" && args[1] === "venv") { fs.mkdirSync(path.dirname(p.python), { recursive: true }); fs.writeFileSync(p.python, "#!"); return 0; }
    if (args[0] === "-c" && /PYV/.test(args[1])) { if (o && o.log) o.log("PYV 3.12"); return 0; }
    if (args.includes("flash-attn")) return 1;                                   // no wheel, no compiler
    if (args.includes("./third_party/voxelization")) return 1;                   // no CUDA toolkit
    if (args[0] === "-c" && /snapshot_download/.test(args[1])) toks.push((o && o.env && o.env.HF_TOKEN) || "");
    if (args[0] === "-c" && /dinov3/.test(args[1])) return gated ? 1 : 0;
    return 0;
  };
  const fetchRepo = async (_u, dest) => { fs.mkdirSync(path.join(dest, "direct3d"), { recursive: true }); fs.writeFileSync(path.join(dest, "direct3d", "pipeline.py"), "x"); fs.writeFileSync(path.join(dest, "requirements.txt"), "torch>=2.5\ntrimesh>=4\npyfqmr\n"); return { ok: true }; };
  let r;
  try {
    gated = true;
    r = await A.installD3({ base, run, python: "/usr/bin/python3", gpu: { cuda: true, torch: ["cu128"] }, uv: "uv", log: (l) => logs.push(l), fetchRepo, hfToken: "hf_x" });
    check("a gated DINOv3: the install stops with how to get it (accept the licence, the token in Settings ▸ Paths)", r && !r.ok && /DINOv3/.test(r.error) && /accept/.test(r.error) && /Settings ▸ Paths ▸ Hugging Face/.test(r.error), r);
    check("…and the Direct3D-V3 weights + BiRefNet stay done (each its own step)", fs.existsSync(p.marker("w_d3")) && fs.existsSync(p.marker("w_biref")) && !fs.existsSync(p.marker("w_dino")));
    gated = false; first = calls.join("\n"); calls.length = 0;
    r = await A.installD3({ base, run, python: "/usr/bin/python3", gpu: { cuda: true, torch: ["cu128"] }, uv: "uv", log: (l) => logs.push(l), fetchRepo, hfToken: "hf_x" });
  } finally { SA.pythonOk = realOk; }
  const txt = calls.join("\n");
  check("Install again: ok - only DINOv3 fetched this time", r && r.ok && /dinov3/.test(txt) && !/wushuang98/.test(txt) && !/BiRefNet/.test(txt), { r, txt: txt.slice(0, 500) });
  const all = logs.join("\n");
  check("the app's Python 3.12 fits (3.11 - 3.12): its venv is made from it, PyTorch 2.8 for the card (cu128)", /-m venv /.test(first) && /torch==2\.8\.0 torchvision==0\.23\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cu128/.test(first), first.slice(0, 600));
  check("flash-attn would not install -> bitGen's stand-in, said, not a failure", fs.readFileSync(p.marker("flash"), "utf8") === "standin" && /stand-in \(PyTorch's own attention/.test(all));
  check("the voxelizer + hole filler built in the code's folder (--no-build-isolation), else the stand-ins", fs.readFileSync(p.marker("ext"), "utf8") === "standin" && /--no-build-isolation \.\/third_party\/voxelization \.\/third_party\/fill_holes .*@Direct3D-V3/.test(first) && /stand-ins are used/.test(all));
  check("requirements: the repo's minus torch, plus what bitGen needs", /trimesh>=4/.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")) && !/^torch/m.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")));
  check("installed: nothing missing; the note names the stand-ins in use", A.missing(base).length === 0 && /stand-ins for flash-attn and the voxelizer/.test(A.status(base).note), A.status(base));
  check("your Hugging Face token goes to every download (DINOv3 is gated)", toks.length === 4 && toks.every((t) => t === "hf_x"), toks);
  // ---- the job
  process.env.BITGEN_ADDON_BASE = base;
  const pic = path.join(base, "pic.png"), rough = path.join(base, "car_rough.glb"); fs.writeFileSync(pic, "png"); fs.writeFileSync(rough, "glb");
  const jp = A.jobParams(pic, rough, { resolution: 1536, faces: "all", low: true, steps: 99, cfg: 30, models_dir: base });
  check("jobParams: mode d3v3, 1536, faces all = none, Low memory = 60 000 tokens, steps / cfg kept in range, the name without _rough",
    jp.params && jp.params.mode === "d3v3" && jp.params.resolution === 1536 && jp.params.target_faces === null && jp.params.max_tokens === 60000 && jp.params.steps === 50 && jp.params.cfg === 15 && jp.params.name === "car" && jp.params.d3v3.python === p.python, jp);
  const jd = A.jobParams(pic, rough, { resolution: 777, models_dir: base });
  check("jobParams: an unknown detail = 1024, faces 500 000, 150 000 tokens, seed 2026", jd.params.resolution === 1024 && jd.params.target_faces === 500000 && jd.params.max_tokens === 150000 && jd.params.seed === 2026, jd.params);
  check("jobParams: a rough model that is not a mesh file / a missing picture refused", /\.glb/.test(A.jobParams(pic, pic).error) && /picture/.test(A.jobParams(path.join(base, "no.png"), rough).error));
  delete process.env.BITGEN_ADDON_BASE;
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "d3v3e-")); process.env.BITGEN_ADDON_BASE = empty;
  const jm = A.jobParams(pic, rough);
  check("jobParams: not installed -> {error, missing} (the route answers 409 needs d3v3)", jm.error && Array.isArray(jm.missing) && jm.missing.length === 8, jm);
  // ---- the route (a fake app; the project's own folders, unique names, cleaned up)
  const handlers = {}; const app = { get: (u, ...f) => { handlers["GET " + u] = f[f.length - 1]; }, post: (u, ...f) => { handlers["POST " + u] = f[f.length - 1]; } };
  require(path.join(ROOT, "routes/d3v3.js")).mount(app);
  const core = require(path.join(ROOT, "lib/core.js")), m3d = require(path.join(ROOT, "lib/m3d.js"));
  const PN = "zz_d3v3_" + process.pid, out = core.pDir("output"); fs.mkdirSync(out, { recursive: true });
  const picF = path.join(out, PN + ".png"), modF = path.join(m3d.dir(), PN + ".glb"); fs.writeFileSync(picF, "png"); fs.writeFileSync(modF, "glb");
  const call = (k, body) => new Promise((ok) => { const res = { code: 200, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); } }; handlers[k]({ body }, res); });
  try {
    const g = await call("GET /api/d3v3");
    check("GET /api/d3v3: installed false, what is missing, the stand-ins", g.j.installed === false && g.j.missing.length === 8 && Array.isArray(g.j.standins), g.j);
    const a = await call("POST /api/d3v3", { picture: PN + ".png", where: "output", model: PN + ".glb", resolution: 1024 });
    check("POST /api/d3v3 not installed: 409 needs d3v3 (the page opens the add-on's Download box)", a.code === 409 && a.j.needs === "d3v3", a);
    const b = await call("POST /api/d3v3", { picture: "nope.png", model: PN + ".glb" });
    const c = await call("POST /api/d3v3", { picture: PN + ".png", model: "../../etc.glb" });
    check("POST /api/d3v3: a picture / model not in the project = 404", b.code === 404 && c.code === 404, [b, c]);
  } finally { fs.rmSync(picF, { force: true }); fs.rmSync(modF, { force: true }); delete process.env.BITGEN_ADDON_BASE; fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(empty, { recursive: true, force: true }); }

  // ---- the wiring
  const AD = require(path.join(ROOT, "lib/addons.js")), entry = (AD.LIST || []).find((x) => x.id === "d3v3");
  check("Settings ▸ Add-ons lists 💎 Fine detail (Direct3D-V3) with status / install / remove and its links", entry && typeof entry.install === "function" && typeof entry.remove === "function" && entry.links().length === 4 && /DINOv3/.test(entry.needs));
  check("lib/core.js runs mode d3v3 with misc/d3v3_worker.py", /d3v3: "d3v3_worker\.py"/.test(read("lib/core.js")) && fs.existsSync(path.join(ROOT, "misc/d3v3_worker.py")) && fs.existsSync(path.join(ROOT, "misc/d3v3_run.py")));
  check("the stand-ins are shipped (flash_attn, cudavoxelize, fillhole_cpp)", ["flash_attn", "cudavoxelize", "fillhole_cpp"].every((m) => fs.existsSync(path.join(ROOT, "misc/d3v3_shims", m + ".py"))));
  check("routes/index.js mounts routes/d3v3.js; server.js untouched", /require\("\.\/d3v3"\)\.mount\(app\)/.test(read("routes/index.js")) && !/d3v3/.test(read("misc/server.js")));
  check("pictureOf: one copy in lib/to3d.js, routes/sceneAI.js passes it on", /function pictureOf/.test(read("lib/to3d.js")) && !/function pictureOf/.test(read("routes/sceneAI.js")) && typeof require(path.join(ROOT, "routes/sceneAI.js")).pictureOf === "function");
  const ext = JSON.parse(read("ext/pushpulldock/ext.json")), dock = read("ext/pushpulldock/dock.html"), dk = read("ext/pushpulldock/ppdock.js");
  check("the Sketcher: 💎 Fine detail beside 🦴 Rig, ppdetail.js loaded, the button wired", ext.scripts.includes("ppdetail.js") && /id="ppDetail"[\s\S]{0,600}id="ppRig"/.test(dock) && /H3Detail\.open\(\)/.test(dk));
  check("misc/NOTICE.md credits Direct3D-V3 and DINOv3's licence", /Direct3D-V3/.test(read("misc/NOTICE.md")) && /DINOv3/.test(read("misc/NOTICE.md")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
