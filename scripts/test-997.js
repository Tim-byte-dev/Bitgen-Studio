#!/usr/bin/env node
/* bitGen Studio — 2.997.0: an add-on's Python of the version it needs (lib/pyVersion.js) - UniRig, PaGeR, the Garment designer.
 * Tim: "rig it unirig won't install..✗ UniRig needs Python 3.11 (its Blender module bpy 4.2 is 3.11 only) and uv was not
 * found to fetch one" - nothing ever installed uv. Now: the app's Python, the venv there, another Python on this computer,
 * else uv (found, or installed by the app's Python into runtime/uv) fetches it into runtime/uv-python. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PV = require(path.join(ROOT, "lib/pyVersion.js")), SA = require(path.join(ROOT, "lib/speechAddons.js")), X = require(path.join(ROOT, "lib/setupExec.js"));

check("minorOf / places: 3.11 -> 11; uv in runtime/uv (on the app's runtime PATH), its Pythons in runtime/uv-python",
  PV.minorOf("3.11") === 11 && PV.minorOf("") === -1 && PV.places("/R").uvDir === path.join("/R", "uv") && PV.places("/R").pyDir === path.join("/R", "uv-python") && require(path.join(ROOT, "lib/setupRun.js")).runtimeDirs().some((d) => d.endsWith(path.join("runtime", "uv"))));
const cw = PV.candidates(11, { LOCALAPPDATA: "C:\\U\\AppData\\Local", ProgramFiles: "C:\\Program Files" }, true), cp = PV.candidates(11, {}, false);
check("candidates: Windows' usual folders (LOCALAPPDATA\\Programs\\Python\\Python311, Program Files, C:\\Python311); elsewhere python3.11 in /usr/bin, /usr/local/bin, Homebrew, pyenv",
  cw.some((c) => /AppData.Local.Programs.Python.Python311.python\.exe$/.test(c)) && cw.some((c) => /Program Files.Python311/.test(c)) && cw.includes("C:\\Python311\\python.exe") && cp.includes("/usr/bin/python3.11") && cp.some((c) => /homebrew/.test(c)));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pyv997_")), keep = { PATH: process.env.PATH, HOME: process.env.HOME };
  const bin = path.join(tmp, "bin"); fs.mkdirSync(bin);
  process.env.PATH = bin; process.env.HOME = path.join(tmp, "home");                          // no uv, no python3.x on the PATH
  const mkPy = (vpy) => { fs.mkdirSync(path.dirname(vpy), { recursive: true }); fs.writeFileSync(vpy, "#!"); };
  // a fake computer: vers = {exe: "3.x"}; pip of the app's Python can install uv (pipOk); uv makes the venv
  const fake = (vers, o) => { const calls = []; const run = async (exe, args, opt) => {
    calls.push({ exe, args: args.join(" "), env: opt && opt.env });
    if (args.includes("-c") && /PYV/.test(args[args.length - 1])) { if (vers[exe]) opt.log("PYV " + vers[exe]); return vers[exe] ? 0 : 1; }
    if (args[0] === "-m" && args[1] === "venv") { mkPy(SA.venvPy(args[2])); return 0; }
    if (args[0] === "-m" && args[1] === "pip" && args.includes("--target")) { if (!o.pipOk) return 1; const t = args[args.indexOf("--target") + 1]; mkPy(path.join(t, "bin", X.IS_WIN ? "uv.exe" : "uv")); return 0; }
    if (args[0] === "venv") { mkPy(SA.venvPy(args[4])); return 0; }
    return 0; }; return { run, calls }; };
  const O = (venv) => ({ venv, want: "3.11", fits: (m) => m === 11, label: "UniRig", why: "its Blender module bpy 4.2 is 3.11 only" });
  try {
    // 1 the app's Python is 3.11
    let F = fake({ "/app/py": "3.11" }, {}), v = path.join(tmp, "a", ".venv"), r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: path.join(tmp, "rt") }, O(v));
    check("the app's Python is 3.11: its venv from it (no uv, nothing looked for)", r.python === SA.venvPy(v) && F.calls.some((c) => c.exe === "/app/py" && /^-m venv /.test(c.args)) && !F.calls.some((c) => /uv/.test(c.args)), F.calls);
    // 2 the app's is 3.13, a Python 3.11 on the PATH
    const p311 = path.join(bin, "python3.11"); fs.writeFileSync(p311, "#!");
    F = fake({ "/app/py": "3.13", [p311]: "3.11" }, {}); v = path.join(tmp, "b", ".venv"); r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: path.join(tmp, "rt") }, O(v));
    check("the app's is 3.13, python3.11 on this computer: the venv made from THAT one (no uv)", r.python === SA.venvPy(v) && F.calls.some((c) => c.exe === p311 && /^-m venv /.test(c.args)) && !F.calls.some((c) => /--target/.test(c.args)), F.calls.map((c) => c.exe + " " + c.args));
    fs.unlinkSync(p311);
    // 3 no other Python, no uv: the app's Python installs uv into runtime/uv, uv fetches 3.11 into runtime/uv-python
    const rt = path.join(tmp, "rt"); F = fake({ "/app/py": "3.13" }, { pipOk: true }); v = path.join(tmp, "c", ".venv");
    const logs = []; r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: rt, log: (l) => logs.push(l) }, O(v));
    const uvCall = F.calls.find((c) => c.args.startsWith("venv --seed -p 3.11 "));
    check("no Python 3.11 here and no uv: pip install uv --target runtime/uv-pip by the app's Python, uv copied to runtime/uv",
      F.calls.some((c) => c.exe === "/app/py" && /-m pip install --upgrade --target .*uv-pip uv/.test(c.args)) && fs.existsSync(PV.places(rt).uvExe), F.calls.map((c) => c.exe + " " + c.args));
    check("…then uv venv --seed -p 3.11 with UV_PYTHON_INSTALL_DIR = runtime/uv-python (the Python stays in the app's folder); the venv ready",
      uvCall && uvCall.exe === PV.places(rt).uvExe && uvCall.env.UV_PYTHON_INSTALL_DIR === PV.places(rt).pyDir && r.python === SA.venvPy(v) && logs.some((l) => /uv makes a Python 3\.11 environment for UniRig/.test(l)), { uvCall, r });
    // 4 uv already in runtime/uv: used, not installed again
    F = fake({ "/app/py": "3.13" }, { pipOk: true }); v = path.join(tmp, "d", ".venv");
    process.env.PATH = PV.places(rt).uvDir;
    r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: rt }, O(v));
    check("uv found (on the PATH / the runtime): used as it is, no pip install", r.python && !F.calls.some((c) => /--target/.test(c.args)) && F.calls.some((c) => c.args.startsWith("venv --seed -p 3.11")), F.calls.map((c) => c.exe + " " + c.args));
    process.env.PATH = bin;
    // 5 nothing works: said how to fix it
    F = fake({ "/app/py": "3.13" }, { pipOk: false }); v = path.join(tmp, "e", ".venv");
    r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: path.join(tmp, "rt2") }, O(v));
    check("no Python 3.11, uv cannot be installed: the error says what it needs and how (python.org / winget install Python.Python.3.11, then Install again)",
      r.error && /UniRig needs Python 3\.11 \(its Blender module bpy 4\.2 is 3\.11 only\)/.test(r.error) && /winget install Python\.Python\.3\.11/.test(r.error), r);
    // 6 the venv already there: kept
    F = fake({ "/app/py": "3.13" }, {}); r = await PV.venvFor({ python: "/app/py", run: F.run, runtimeRoot: path.join(tmp, "rt3") }, O(path.join(tmp, "c", ".venv")));
    check("the add-on's venv already there (an earlier install): used, nothing made", r.python === SA.venvPy(path.join(tmp, "c", ".venv")) && !F.calls.some((c) => /venv|--target/.test(c.args.replace(/^-c .*/, ""))), F.calls);
  } finally { process.env.PATH = keep.PATH; if (keep.HOME === undefined) delete process.env.HOME; else process.env.HOME = keep.HOME; fs.rmSync(tmp, { recursive: true, force: true }); }

  // the three add-ons use it
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  check("UniRig (3.11 exactly), PaGeR (3.10 - 3.12, fetches 3.11) and the Garment designer (3.10 - 3.12, fetches 3.12) all go through pyVersion.venvFor",
    /pyVersion"\)\.venvFor\(ctx, \{ venv: p\.venv, want: "3\.11", fits: \(m\) => m === 11, label: "UniRig"/.test(src("lib/rigAddon.js"))
    && /pyVersion"\)\.venvFor\(ctx, \{ venv: p\.venv, want: "3\.11", range: "3\.10 - 3\.12", fits: \(m\) => m >= 10 && m <= 12, label: "PaGeR"/.test(src("lib/pagerAddon.js"))
    && /pyVersion"\)\.venvFor\([\s\S]{0,80}want: "3\.12", range: "3\.10 - 3\.12"/.test(src("lib/garmentAddon.js"))
    && !/uv was not found to fetch one/.test(src("lib/rigAddon.js") + src("lib/pagerAddon.js") + src("lib/garmentAddon.js")));
  check("runtime/ (uv, its Pythons) is this machine's own: in .gitignore, misc/_gitignore and the zips' excludes",
    /^\/runtime\/$/m.test(src(".gitignore")) && /^\/runtime\/$/m.test(src("misc/_gitignore")) && /! -path "\.\/runtime\/\*"/.test(src("scripts/make_zips.sh")));
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
