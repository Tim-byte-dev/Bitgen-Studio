#!/usr/bin/env node
// bitGen Studio 2.994.0 - ⛰ Panorama depth (PaGeR) as an add-on: its install (a stand-in machine), the job, the route, the
// panorama view's depth, and the NON-COMMERCIAL disclaimer wherever it is offered. Tim: "is this worth adding?
// https://pager360.github.io/" -> "yes do it please, first time dl, add disclaimer that these models are for non-commercial use
// only". Python side: test-pager994.py; browser: test-ui994-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const A = require("../lib/pagerAddon.js");
const NC = /NON-COMMERCIAL use only/;

(async () => {
  check("NOTICE: code Apache-2.0, the weights CC BY-NC 4.0 - NON-COMMERCIAL use only, not for paid / commercial work", /Apache-2\.0/.test(A.NOTICE) && /CC BY-NC 4\.0/.test(A.NOTICE) && NC.test(A.NOTICE) && /not for paid or commercial work/.test(A.NOTICE));
  check("its links: the code and the weights (the weights' link says non-commercial)", A.LINKS.length === 2 && A.LINKS[0].url === "https://github.com/prs-eth/PaGeR" && /non-commercial/.test(A.LINKS[1].label) && /prs-eth\/PaGeR$/.test(A.LINKS[1].url));
  check("reqLines: its requirements without torch / torchvision / gradio (bitGen installs torch for the card)",
    JSON.stringify(A.reqLines("torch>=2.0\ntorchvision\nnumpy<2  # x\n\n# c\neinops\ngradio>=5\n-e .\nopen_clip_torch")) === JSON.stringify(["numpy<2", "einops", "open_clip_torch"]));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "t994-"));
  try {
    check("not installed: every missing part named, the note says non-commercial", A.missing(T).map((m) => m.id).join() === "venv,code,packages,weights" && !A.status(T).installed && NC.test(A.status(T).note));
    // the install on a stand-in machine: what is run, in what order
    const calls = [], logs = [];
    const venvPy = require("../lib/speechAddons").venvPy;
    const run = async (cmd, args, o) => {
      calls.push({ cmd: path.basename(String(cmd)), args: args.map(String), cwd: o && o.cwd ? path.basename(o.cwd) : "" });
      if (args[0] === "-c" && /PYV/.test(args[1])) (o.log || (() => {}))("PYV 3.11");
      const vi = args.indexOf("venv"); if (args[0] === "-m" && vi === 1) { const vp = venvPy(args[2]); fs.mkdirSync(path.dirname(vp), { recursive: true }); fs.writeFileSync(vp, "py"); }
      return 0;
    };
    const fetchRepo = async (url, dest) => { fs.mkdirSync(path.join(dest, "src"), { recursive: true }); fs.writeFileSync(path.join(dest, "src", "pager.py"), "x"); fs.writeFileSync(path.join(dest, "requirements.txt"), "torch>=2.0\ntorchvision\nnumpy<2\neinops\nopen_clip_torch\n"); return { ok: true, url }; };
    const r = await A.installPager({ log: (l) => logs.push(l), run, fetchRepo, python: "/usr/bin/python3", gpu: {}, base: T, git: "git" });
    const pips = calls.filter((c) => c.args.includes("install")).map((c) => c.args.join(" "));
    const reqFile = fs.readFileSync(path.join(T, "pager", "requirements-bitgen.txt"), "utf8");
    check("install: the disclaimer is its first line", NC.test(logs[0]), logs[0]);
    check("…the code fetched, its own Python (the app's 3.11 fits 3.10 - 3.12), PyTorch for the card, its requirements minus torch, then `pip install -e . --no-deps` in its folder",
      r.ok && fs.existsSync(path.join(T, "pager", "PaGeR", "src", "pager.py")) && pips.some((x) => /torch==2\.8\.0 torchvision==0\.23\.0/.test(x)) && !/^torch|^torchvision/m.test(reqFile) && /einops/.test(reqFile)
      && calls.some((c) => c.args.join(" ").startsWith("-m pip install -e . --no-deps") && c.cwd === "PaGeR"), { r, pips });
    const hf = calls.find((c) => c.args[0] === "-c" && /hf_hub_download/.test(c.args[1]));
    check("…the weights at install (config.yaml + model.safetensors of prs-eth/PaGeR) and CLIP ViT-B-32 - the first run needs nothing more", hf && /"prs-eth\/PaGeR"/.test(hf.args[1]) && /model\.safetensors/.test(hf.args[1]) && /ViT-B-32/.test(hf.args[1]));
    check("…installed: nothing missing, the note says where it is used + non-commercial", A.missing(T).length === 0 && A.status(T).installed && /⛰ Depth in the 🌐 Panorama 3D view/.test(A.status(T).note) && NC.test(A.status(T).note));
    const again = calls.length; await A.installPager({ log: () => {}, run, fetchRepo, python: "/usr/bin/python3", gpu: {}, base: T, git: "git" });
    check("…installing again skips what is there (no PyTorch / weights again)", !calls.slice(again).some((c) => /torch==|hf_hub_download/.test(c.args.join(" "))));
  } finally { fs.rmSync(T, { recursive: true, force: true }); }
  const pic = path.join(os.tmpdir(), "t994 pano.png"); fs.writeFileSync(pic, "x");
  const jp = A.jobParams(pic, { scene: "outdoor", ipd: 0.2 });
  check("jobParams: not installed (here) -> the error says where to install it, with what is missing", jp.error && /Settings ▸ Add-ons ▸ ⛰ Panorama depth/.test(jp.error) && jp.missing.length > 0);
  check("…a picture that is not there / not a picture = refused in words", /not there/.test(A.jobParams(path.join(os.tmpdir(), "nope.png")).error) && /PNG, JPEG or WebP/.test(A.jobParams(__filename).error));
  fs.unlinkSync(pic);
  const RI = src("routes/index.js"), RD = src("routes/panoDepth.js"), AD = src("lib/addons.js"), NI = src("static/needinstall.js"), CO = src("lib/core.js"), LB = src("static/lbpano.js"), NO = src("misc/NOTICE.md");
  check("the route: mounted from routes/index.js; GET status (+ notice) / POST a picture (bytes or a project file) -> a job; 409 needs pager",
    /require\("\.\/panoDepth"\)\.mount\(app\)/.test(RI) && /app\.get\("\/api\/panodepth"/.test(RD) && /app\.post\("\/api\/panodepth"/.test(RD) && /needs: jp\.missing \? "pager"/.test(RD) && /notice: A\.NOTICE/.test(RD) && !/panodepth|pager/i.test(src("misc/server.js")));
  check("the job: mode panodepth -> misc/pager_worker.py (core's WORKER_FOR); its helpers beside it", /panodepth: "pager_worker\.py"/.test(CO) && ["pager_worker.py", "pager_run.py", "pager_geo.py"].every((f) => fs.existsSync(path.join(ROOT, "misc", f))) && /"pager_worker\.py", "pager_run\.py", "pager_geo\.py"/.test(src("lib/miscMigrate.js")));
  check("Settings ▸ Add-ons: ⛰ Panorama depth (PaGeR) - its label, what it is for and the download box all say non-commercial",
    /id: "pager", label: "⛰ Panorama depth \(PaGeR\) - non-commercial use only"/.test(AD) && /The weights are CC BY-NC 4\.0: NON-COMMERCIAL use only/.test(AD)
    && /pager: \{ name: "⛰ Panorama depth \(PaGeR\) - non-commercial use only"/.test(NI) && /for NON-COMMERCIAL use only/.test(NI) && /status: "\/api\/panodepth", addon: "pager"/.test(NI));
  const LP = require("../static/lbpano.js");
  const g = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  check("lbpano depthAt: the depth at a texture point, bilinear, wrapping round at the seam (u 0 = between the last and first column)",
    LP.depthAt(g, 4, 2, 0.125, 0.75) === 1 && LP.depthAt(g, 4, 2, 0.375, 0.25) === 6 && LP.depthAt(g, 4, 2, 0, 0.75) === 2.5 && LP.depthAt(g, 4, 2, 0.25, 0.5) === 3.5);
  check("the panorama view: ⛰ Depth asks to download the first time (H3NeedInstall pager), says non-commercial in its title + message; I / J / K / L step; Home back",
    /H3NeedInstall\.ensure\("pager"/.test(LB) && /id="lb_panodepth"/.test(LB) && NC.test(LP.DEPTH_NOTE) && /DEPTH_NOTE \+ '\.">⛰ Depth<\/button>/.test(LB) && /I: "fwd"/.test(LB) && /S\.depth\.pos = \[0, 0, 0\]/.test(LB));
  check("misc/NOTICE.md: PaGeR - code Apache-2.0, weights CC BY-NC 4.0 non-commercial", /PaGeR/.test(NO) && /CC BY-NC 4\.0/.test(NO.slice(NO.indexOf("PaGeR") - 200, NO.indexOf("PaGeR") + 600)));
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
