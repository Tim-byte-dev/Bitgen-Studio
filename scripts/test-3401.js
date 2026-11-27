#!/usr/bin/env node
/* bitGen Studio — 3.4.1: SoulX-Singer and Seed-VC load - their environments made with the Python they were written for.
 * Tim's install log: "[error] soulx: installed, but it does not load: ValueError: LlamaConfig accepts only keyword arguments, but
 * found `5` positional args." + "seedvc: installed, but it does not load: OverflowError: cannot convert longdouble infinity to
 * integer". Both pin 2024 packages (numpy 1.26 / < 2, scipy 1.13, transformers 4.4x) with no Python 3.13 wheels - on the app's
 * 3.13 pip took the newest instead (transformers 5: configs by keyword only). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PV = require(path.join(ROOT, "lib/pyVersion.js")), SA = require(path.join(ROOT, "lib/speechAddons.js")), SVA = require(path.join(ROOT, "lib/singVoiceAddon.js"));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv3401_")), keep = { PATH: process.env.PATH, HOME: process.env.HOME };
  const bin = path.join(tmp, "bin"); fs.mkdirSync(bin);
  process.env.PATH = bin; process.env.HOME = path.join(tmp, "home");
  const mkPy = (vpy) => { fs.mkdirSync(path.dirname(vpy), { recursive: true }); fs.writeFileSync(vpy, "#!"); };
  try {
    // an old 3.13 venv + the app's 3.13 + a Python 3.10 on this computer
    const v = path.join(tmp, "soulx", ".venv"), vpy = SA.venvPy(v); mkPy(vpy); fs.writeFileSync(path.join(v, "marker"), "old");
    const p310 = path.join(bin, "python3.10"); fs.writeFileSync(p310, "#!");
    const vers = { "/app/py": "3.13", [vpy]: "3.13", [p310]: "3.10" }, calls = [], logs = [];
    const run = async (exe, args, opt) => {
      calls.push(exe + " " + args.join(" "));
      if (args.includes("-c") && /PYV/.test(args[args.length - 1])) { const ver = exe === vpy && fs.existsSync(path.join(v, "marker")) ? "3.13" : exe === vpy ? "3.10" : vers[exe]; if (ver) opt.log("PYV " + ver); return ver ? 0 : 1; }
      if (args[0] === "-m" && args[1] === "venv") { mkPy(SA.venvPy(args[2])); return 0; }
      return 0;
    };
    const r = await PV.venvFor({ python: "/app/py", run, runtimeRoot: path.join(tmp, "rt"), log: (l) => logs.push(l) },
      Object.assign({ venv: v, label: "SoulX-Singer", fits: (m) => m >= 10 && m <= 12 }, SVA.PY.soulx));
    check("a venv made with a Python that does not fit (3.13) is made again - from this computer's 3.10", r.python === vpy && !fs.existsSync(path.join(v, "marker"))
      && calls.some((c) => c === p310 + " -m venv " + v) && logs.some((l) => /was made with Python 3\.13 - SoulX-Singer needs Python 3\.10 - 3\.12/.test(l)), { r, calls, logs });
    // a venv that fits is kept
    const calls2 = []; fs.writeFileSync(path.join(v, "keepme"), "1");
    const r2 = await PV.venvFor({ python: "/app/py", run: async (exe, args, opt) => { calls2.push(exe + " " + args.join(" ")); if (/PYV/.test(args[args.length - 1])) { opt.log("PYV " + (exe === vpy ? "3.10" : "3.13")); } return 0; }, runtimeRoot: path.join(tmp, "rt") },
      Object.assign({ venv: v, label: "SoulX-Singer", fits: (m) => m >= 10 && m <= 12 }, SVA.PY.soulx));
    check("…a venv of a fitting Python stays as it is", r2.python === vpy && fs.existsSync(path.join(v, "keepme")) && !calls2.some((c) => /-m venv/.test(c)), calls2);
  } finally { process.env.PATH = keep.PATH; process.env.HOME = keep.HOME; fs.rmSync(tmp, { recursive: true, force: true }); }

  check("Seed-VC and SoulX ask for Python 3.10 - 3.12 (uv fetches 3.10); RVC keeps the app's Python",
    SVA.PY.seedvc.want === "3.10" && SVA.PY.soulx.want === "3.10" && SVA.PY.seedvc.range === "3.10 - 3.12" && !SVA.PY.rvc
    && /PY\[id\] \? await \(d\.venvFor \|\| require\("\.\/pyVersion"\)\.venvFor\)\(ctx, Object\.assign\(\{ venv: P\.venv, label: E\.short, fits: \(m\) => m >= 10 && m <= 12 \}, PY\[id\]\)\)/.test(src("lib/singVoiceAddon.js")));
  check("pip's constraints: numpy < 2.4 and transformers < 5 (a pin pip refuses never pulls transformers 5 in)",
    SVA.CAPS.seedvc.join() === "numpy<2.4,transformers<5" && SVA.CAPS.soulx.join() === "numpy<2.4,transformers<5" && SVA.CAPS.rvc.join() === "numpy<2.4"
    && /fs\.writeFileSync\(cf, CAPS\[id\]\.join\("\\n"\) \+ "\\n"\)/.test(src("lib/singVoiceAddon.js")));
  // the install with a fake run: the venv comes from venvFor with those options
  const t2 = fs.mkdtempSync(path.join(os.tmpdir(), "sv3401b_"));
  try {
    const SV = require(path.join(ROOT, "lib/singVoice.js")), P = SV.paths(t2).seedvc;
    fs.mkdirSync(P.src, { recursive: true }); fs.writeFileSync(path.join(P.src, SV.ENGINES.seedvc.marker), ""); fs.writeFileSync(path.join(P.src, "requirements.txt"), "numpy==1.26.4\ntransformers==4.46.3\ntorch==2.4.0\n");
    let asked = null; const runs = [];
    const res = await SVA.install(() => {}, ["seedvc"], { base: t2, machine: { python: "/app/py", gpu: {}, env: process.env },
      venvFor: async (ctx, o) => { asked = o; mkPy(SA.venvPy(o.venv)); return { python: SA.venvPy(o.venv) }; },
      run: async (exe, args, opt) => { runs.push(args.join(" ")); if (/PYV/.test(args[args.length - 1])) opt.log("PYV 3.13"); if (args[0] && /singvoice_local\.py$/.test(args[0])) opt.log(JSON.stringify({ ok: true, torch: "2.8.0", cuda: true })); return 0; } });
    const cons = fs.readFileSync(path.join(P.dir, "constraints-bitgen.txt"), "utf8");
    check("install (app Python 3.13): Seed-VC's venv from pyVersion.venvFor (3.10 - 3.12), its list installed with the constraints, loads",
      res.ok && asked && asked.want === "3.10" && asked.fits(10) && asked.fits(12) && !asked.fits(13) && cons === "numpy<2.4\ntransformers<5\n"
      && runs.some((a) => /-m pip install -r .*requirements-bitgen\.txt -c .*constraints-bitgen\.txt/.test(a)), { res, asked, cons, runs });
  } finally { fs.rmSync(t2, { recursive: true, force: true }); }
  check("the install check says WHERE it broke (the last frame: folder/file:line in function)",
    /traceback\.extract_tb\(e\.__traceback__\)/.test(src("scripts/singvoice_local.py")) && /" \(%s:%d in %s\)"/.test(src("scripts/singvoice_local.py")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
