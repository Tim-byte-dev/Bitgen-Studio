// bitGen Studio — A PYTHON OF THE VERSION AN ADD-ON NEEDS (2.997.0).
//
// Tim: "rig it unirig won't install..✗ UniRig needs Python 3.11 (its Blender module bpy 4.2 is 3.11 only) and uv was not
// found to fetch one". UniRig (3.11 exactly), PaGeR (3.10 - 3.12) and the Garment designer (3.10 - 3.12) each fell back to
// uv when the app's Python did not fit - but nothing ever installed uv, so on a machine without it they could not install.
//
// venvFor(ctx, o) makes the add-on's venv from the first that fits:
//   1 the app's own Python (Settings ▸ Paths / the setup's runtime)
//   2 the venv already there (an earlier install)
//   3 another Python on this computer of a fitting version: Windows' py launcher (py -3.11), the usual install folders
//     (%LOCALAPPDATA%\Programs\Python\Python311, C:\Python311, Program Files), python3.11 on the PATH
//   4 uv - found (the runtime's runtime/uv, the PATH, ~/.local/bin, ~/.cargo/bin) or put in runtime/uv by the app's own
//     Python (pip install uv into runtime/uv-pip, the uv program copied to runtime/uv - already on the app's runtime PATH);
//     uv then downloads that Python into runtime/uv-python (UV_PYTHON_INSTALL_DIR - it stays in the app's folder) and makes
//     the venv with it.
// o = {venv, want: "3.11" (what uv fetches), fits(minor) -> bool, label ("UniRig"), why ("its Blender module bpy 4.2 is
//      3.11 only")} -> {python} | {error}
// ctx.uv set (a path, or null) = tests: that uv (or none), no looking round this computer and no installing; ctx.runtimeRoot
// = another runtime folder (tests).
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const X = require("./setupExec");

const SA = () => require("./speechAddons");
const SR = () => require("./setupRun");
const has = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function runtimeRoot() { return path.join(SR().ROOT, "runtime"); }
/** where uv is put / its Pythons go (pure) */
function places(root) {
  const r = root || runtimeRoot();
  return { uvDir: path.join(r, "uv"), uvExe: path.join(r, "uv", X.IS_WIN ? "uv.exe" : "uv"), pipDir: path.join(r, "uv-pip"), pyDir: path.join(r, "uv-python") };
}
/** "3.11" -> 11 (pure) */
const minorOf = (ver) => { const m = /^3\.(\d+)/.exec(String(ver || "")); return m ? +m[1] : -1; };

/** the Python version of `py` (args = its leading args, e.g. ["-3.11"] for the py launcher) -> "3.11" | "" */
async function verOf(ctx, py, args) {
  const run = ctx.run || X.run; let ver = "";
  try { await run(py, (args || []).concat(["-c", "import sys; print('PYV %d.%d' % sys.version_info[:2])"]), { log: (l) => { const m = /PYV (\d+\.\d+)/.exec(l); if (m) ver = m[1]; }, env: SA().envOf(ctx), timeout: 60000 }); } catch { /* not runnable */ }
  return ver;
}
/** the usual places a Python 3.<minor> is installed on this computer (pure-ish: env + platform) */
function candidates(minor, env, isWin) {
  const e = env || process.env, out = [], n = "3" + minor;
  if (isWin) {
    const la = e.LOCALAPPDATA || path.join(e.USERPROFILE || os.homedir(), "AppData", "Local");
    out.push(path.join(la, "Programs", "Python", "Python" + n, "python.exe"));
    for (const pf of [e.ProgramFiles, e["ProgramFiles(x86)"], "C:\\Program Files"].filter(Boolean)) out.push(path.join(pf, "Python" + n, "python.exe"));
    out.push("C:\\Python" + n + "\\python.exe");
  } else out.push("/usr/bin/python3." + minor, "/usr/local/bin/python3." + minor, "/opt/homebrew/bin/python3." + minor, path.join(os.homedir(), ".pyenv", "shims", "python3." + minor));
  return out;
}
/** another Python of a fitting version on this computer -> its path | null (the py launcher answers with sys.executable) */
async function findInstalled(ctx, o, minors) {
  const run = ctx.run || X.run, log = ctx.log || (() => {});
  for (const mi of minors) {
    if (X.IS_WIN) {
      const pyl = X.which("py", []);
      if (pyl) { let exe = ""; try { await run(pyl, ["-3." + mi, "-c", "import sys; print('PYEXE ' + sys.executable)"], { log: (l) => { const m = /PYEXE (.+)$/.exec(String(l).trim()); if (m) exe = m[1].trim(); }, env: SA().envOf(ctx), timeout: 60000 }); } catch { /* no such version */ }
        if (exe && has(exe) && minorOf(await verOf(ctx, exe)) === mi) { log(`[ok] Python 3.${mi} on this computer (the py launcher): ${exe}`, false); return exe; } }
    }
    const onPath = X.which("python3." + mi, []);
    for (const c of [onPath].concat(candidates(mi, process.env, X.IS_WIN)).filter(Boolean)) {
      if (!has(c)) continue;
      if (minorOf(await verOf(ctx, c)) === mi) { log(`[ok] Python 3.${mi} on this computer: ${c}`, false); return c; }
    }
  }
  return null;
}
/** uv: found, or put in runtime/uv with the app's own Python -> its path | null */
async function uvFor(ctx, root) {
  if (ctx.uv !== undefined) return ctx.uv;
  const run = ctx.run || X.run, log = ctx.log || (() => {}), P = places(root || ctx.runtimeRoot), home = os.homedir();
  const found = X.which("uv", SR().runtimeDirs().concat([path.join(home, ".local", "bin"), path.join(home, ".cargo", "bin")]));
  if (found) return found;
  if (!ctx.python) return null;
  log("[..] uv (it fetches the Python this add-on needs) - into the app's runtime folder: " + P.uvDir, false);
  fs.mkdirSync(P.pipDir, { recursive: true });
  if (await run(ctx.python, ["-m", "pip", "install", "--upgrade", "--target", P.pipDir, "uv", "--progress-bar", "off"], { log, env: SA().envOf(ctx), timeout: 15 * 60000 }) !== 0) return null;
  const built = [path.join(P.pipDir, "bin", X.IS_WIN ? "uv.exe" : "uv"), path.join(P.pipDir, "Scripts", "uv.exe")].find(has);
  if (!built) { log("[warn] pip installed uv but its program is not where it should be (" + P.pipDir + ")", true); return null; }
  fs.mkdirSync(P.uvDir, { recursive: true });
  fs.copyFileSync(built, P.uvExe);
  if (!X.IS_WIN) try { fs.chmodSync(P.uvExe, 0o755); } catch { /* fine */ }
  log("[ok] uv: " + P.uvExe, false);
  return P.uvExe;
}
async function venvFor(ctx, o) {
  const run = ctx.run || X.run, log = ctx.log || (() => {}), vpy = SA().venvPy(o.venv), label = o.label || "this add-on";
  const need = `${label} needs Python ${o.range || o.want}${o.why ? " (" + o.why + ")" : ""}`;
  // 1 the app's own Python
  const pv = await SA().pythonOk(ctx, label);
  if (!pv.error && o.fits(minorOf(pv.ver))) return SA().makeVenv(ctx, o.venv);
  // 2 the venv already there
  if (has(vpy)) return { python: vpy };
  log(`[..] ${need} - the app's Python is ${pv.ver || "not usable"}; looking for one`, false);
  // 3 another Python on this computer
  if (ctx.uv === undefined) {
    const minors = [minorOf(o.want)].concat([10, 11, 12, 13].filter((m) => m !== minorOf(o.want) && o.fits(m)));
    const other = await findInstalled(ctx, o, minors);
    if (other) { const r = await SA().makeVenv(Object.assign({}, ctx, { python: other }), o.venv); if (!r.error) return r; log("[warn] " + r.error, true); }
  }
  // 4 uv fetches it
  const uv = await uvFor(ctx);
  if (!uv) return { error: `${need}. No Python ${o.want} was found on this computer and uv could not be installed (see the log) - install Python ${o.want} from python.org (or "winget install Python.Python.${o.want}"), then Install again` };
  const P = places(ctx.runtimeRoot), env = Object.assign({}, SA().envOf(ctx), ctx.uv === undefined ? { UV_PYTHON_INSTALL_DIR: P.pyDir } : {});
  log(`[..] uv makes a Python ${o.want} environment for ${label}${o.why ? " (" + o.why + ")" : ""}`, false);
  if (await run(uv, ["venv", "--seed", "-p", o.want, o.venv], { log, env, timeout: 20 * 60000 }) !== 0 || !has(vpy))
    return { error: `uv could not make a Python ${o.want} environment - see the log above` };
  return { python: vpy };
}

module.exports = { venvFor, uvFor, findInstalled, candidates, places, minorOf, verOf };
