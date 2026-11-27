#!/usr/bin/env node
/* bitGen Studio — 3.3.0: 🤗 Hugging Face downloads (hf_xet) first in Settings ▸ Add-ons (lib/hfAddon.js).
 * Tim (UniRig's log: "Xet Storage is enabled for this repo, but the 'hf_xet' package is not installed. Falling back to regular
 * HTTP download"): "could you add the hf install to the top of the addons in settings-addons please" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const HF = require(path.join(ROOT, "lib/hfAddon.js")), A = require(path.join(ROOT, "lib/addons.js"));
check("🤗 Hugging Face downloads is FIRST in Settings ▸ Add-ons", A.LIST[0].id === "hf" && /Hugging Face downloads/.test(A.LIST[0].label) && typeof A.LIST[0].status === "function");
(async () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "hf3300_"));
  const mk = (d) => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "pyvenv.cfg"), "home = x"); const py = HF.venvPy(d); fs.mkdirSync(path.dirname(py), { recursive: true }); fs.writeFileSync(py, ""); return d; };
  try {
    const u = mk(path.join(t, "unirig", ".venv")), p = mk(path.join(t, "pager", ".venv")), s = mk(path.join(t, "singvoice", "soulx", "venv"));
    mk(path.join(t, "node_modules", "x", ".venv")); mk(path.join(t, "a", "b", "c", "d", ".venv"));   // skipped: node_modules, too deep
    fs.mkdirSync(path.join(t, "half", ".venv"), { recursive: true }); fs.writeFileSync(path.join(t, "half", ".venv", "pyvenv.cfg"), "");   // no python in it
    const vs = HF.venvs(t);
    check("venvs: every add-on environment under the app (pyvenv.cfg + its python), 3 folders deep; not node_modules, not a half-made one", vs.join() === [p, s, u].sort().join(), vs);
    check("status before: not installed (says downloads fall back to plain HTTP)", !HF.status(t).installed && /plain HTTP/.test(HF.status(t).note));
    const calls = [], run = async (exe, args) => { calls.push(exe + " " + args.join(" ")); return exe === HF.venvPy(p) ? 1 : 0; };   // PaGeR's pip refuses
    const logs = [], r = await HF.install({ python: "/app/py", run, root: t, log: (l) => logs.push(l) });
    const st = HF.status(t), rec = JSON.parse(fs.readFileSync(HF.recordOf(t), "utf8"));
    check("install: hf_xet (only - not huggingface_hub) into the app's Python + each environment, checked by importing it", r.ok && calls.filter((c) => / -m pip install --upgrade hf_xet --progress-bar off$/.test(c)).length === 4 && calls.filter((c) => / -c import hf_xet$/.test(c)).length === 3 && !calls.some((c) => /huggingface_hub/.test(c)), calls);
    check("…one that would not take it is said and recorded; status = installed in 3 (1 could not)", rec.done.length === 3 && rec.failed.length === 1 && /pager/.test(rec.failed[0]) && st.installed && /hf_xet in 3 Python environments \(1 could not take it\)/.test(st.note) && logs.some((l) => /\[warn\] pager/.test(l)), { rec, st });
    const ens = []; const ok = await HF.ensure({ run: async (e, a) => { ens.push(a.join(" ")); return 0; }, log: () => {} }, "/v/py"), bad = await HF.ensure({ run: async () => { throw new Error("x"); } }, "/v/py");
    check("ensure (a new environment): hf_xet in, never stops an install (an error = false)", ok === true && ens[0] === "-m pip install --upgrade hf_xet --progress-bar off" && bad === false && (await HF.ensure({ noXet: true }, "/v")) === false);
    const rm = []; await HF.remove({ python: "/app/py", run: async (e, a) => { rm.push(a.join(" ")); return 0; }, root: t, log: () => {} });
    check("remove: pip uninstall hf_xet everywhere, the record gone", rm.filter((x) => x === "-m pip uninstall -y hf_xet").length === 4 && !HF.status(t).installed);
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  check("new add-on environments get it on their own: makeVenv (lib/speechAddons.js) and the uv path (lib/pyVersion.js)", /await require\("\.\/hfAddon"\)\.ensure\(ctx, vpy\);/.test(src("lib/speechAddons.js")) && /await require\("\.\/hfAddon"\)\.ensure\(ctx, vpy\);/.test(src("lib/pyVersion.js")));
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
