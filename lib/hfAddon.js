// bitGen Studio — lib/hfAddon.js (3.3.0): 🤗 HUGGING FACE DOWNLOADS - hf_xet in every Python the app downloads models with.
// Tim (UniRig's install log: "Xet Storage is enabled for this repo, but the 'hf_xet' package is not installed. Falling back to
// regular HTTP download"): "could you add the hf install to the top of the addons in settings-addons please".
// Most model repos on Hugging Face are stored with Xet now; without the hf_xet package huggingface_hub falls back to plain
// HTTP - slower, and a broken download starts over. This add-on (first in Settings ▸ Add-ons) puts hf_xet into the app's own
// Python and into every add-on's Python environment that is there (UniRig, PaGeR, HunyuanWorld, FlowHMR, 🎤 Sing in my voice,
// the voice kits …). Only hf_xet - huggingface_hub itself is left as each add-on pinned it. New add-on environments get it
// on their own (lib/speechAddons.js makeVenv, lib/pyVersion.js). Its record: runtime/hf-xet.json.
"use strict";
const fs = require("fs");
const path = require("path");
const X = require("./setupExec");

const PKG = "hf_xet";
const SKIP = new Set(["node_modules", ".git", "projects", "outputs", "ComfyUI", "comfy_workflows", "docs", "static", "ext", "scripts", "lib", "routes", "misc", "jobs"]);
const venvPy = (v) => path.join(v, X.IS_WIN ? "Scripts" : "bin", X.IS_WIN ? "python.exe" : "python");
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const ROOT = () => require("./setupRun").ROOT;
const recordOf = (root) => path.join(root || ROOT(), "runtime", "hf-xet.json");

/** every add-on Python environment under the app's folder (a pyvenv.cfg + its python), 3 folders deep at most */
function venvs(root) {
  const out = [], base = root || ROOT();
  const walk = (d, depth) => {
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (list.some((e) => e.isFile() && e.name === "pyvenv.cfg")) { if (isFile(venvPy(d))) out.push(d); return; }
    if (depth >= 3) return;
    for (const e of list) if (e.isDirectory() && !SKIP.has(e.name)) walk(path.join(d, e.name), depth + 1);
  };
  walk(base, 0);
  return out.sort();
}
function status(root) {
  let r = null; try { r = JSON.parse(fs.readFileSync(recordOf(root), "utf8")); } catch { r = null; }
  if (!r || !Array.isArray(r.done)) return { installed: false, note: "not installed - Hugging Face downloads fall back to plain HTTP (slower; a broken download starts over)" };
  return { installed: true, note: `${PKG} in ${r.done.length} Python environment${r.done.length === 1 ? "" : "s"}` + (r.failed && r.failed.length ? ` (${r.failed.length} could not take it)` : "") + (r.at ? " - " + String(r.at).slice(0, 10) : "") };
}
/** hf_xet into one Python (quiet when it is there) -> true when it imports afterwards */
async function into(ctx, py) {
  const run = ctx.run || X.run, log = ctx.log || (() => {}), env = Object.assign({}, ctx.env || process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  if (await run(py, ["-m", "pip", "install", "--upgrade", PKG, "--progress-bar", "off"], { log, env, timeout: 15 * 60000 }) !== 0) return false;
  return (await run(py, ["-c", "import hf_xet"], { log, env, timeout: 60000 })) === 0;
}
async function install(ctx) {
  const log = ctx.log || (() => {}), root = ctx.root || ROOT();
  const list = [].concat(ctx.python ? [{ py: ctx.python, what: "the app's Python" }] : [], venvs(root).map((v) => ({ py: venvPy(v), what: path.relative(root, v) })));
  if (!list.length) return { ok: false, error: "no Python found - the app's setup installs one (Settings ▸ General ▸ Setup)" };
  log(`[..] ${PKG} (Hugging Face's Xet downloads - faster, resumable) into ${list.length} Python environment${list.length === 1 ? "" : "s"}`, false);
  const done = [], failed = [];
  for (const e of list) {
    log(`[..] ${e.what}`, false);
    if (await into(ctx, e.py)) { done.push(e.what); log(`[ok] ${e.what}`, false); } else { failed.push(e.what); log(`[warn] ${e.what}: ${PKG} would not install - its downloads stay plain HTTP`, true); }
  }
  fs.mkdirSync(path.dirname(recordOf(root)), { recursive: true });
  fs.writeFileSync(recordOf(root), JSON.stringify({ pkg: PKG, done, failed, at: new Date().toISOString() }, null, 1));
  if (!done.length) return { ok: false, error: `${PKG} would not install anywhere - see the log` };
  log(`[ok] ${PKG} in ${done.length} of ${list.length}` + (failed.length ? ` (not: ${failed.join(", ")})` : "") + " - add-ons installed later get it on their own", false);
  return { ok: true };
}
async function remove(ctx) {
  const run = ctx.run || X.run, log = ctx.log || (() => {}), root = ctx.root || ROOT();
  const list = [].concat(ctx.python ? [ctx.python] : [], venvs(root).map(venvPy));
  for (const py of list) await run(py, ["-m", "pip", "uninstall", "-y", PKG], { log, env: ctx.env || process.env, timeout: 5 * 60000 });
  try { fs.unlinkSync(recordOf(root)); } catch { /* gone */ }
  return { ok: true };
}
/** for a new add-on environment (makeVenv / uv): hf_xet too - never stops an install */
async function ensure(ctx, py) {
  if (ctx && ctx.noXet) return false;
  const log = ctx.log || (() => {});
  try { const ok = await into(Object.assign({}, ctx, { log: () => {} }), py); if (ok) log(`[ok] ${PKG} (faster Hugging Face downloads)`, false); return ok; } catch { return false; }
}
module.exports = { PKG, venvs, status, install, remove, ensure, recordOf, venvPy };
