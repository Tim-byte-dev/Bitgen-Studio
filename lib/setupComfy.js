// bitGen Studio — SETUP: ComfyUI, new or existing (2.331.0).
//
// Tim: "on the first page offer comfyui, input with folder select button for
// existing comfyui package". NEW: the official manual install
// (docs.comfy.org/installation/manual_install) on every OS - a clone, its
// OWN venv, the PyTorch build for THIS GPU (lib/setupGpu.torchIndexes),
// requirements, and a run.bat / run.sh the app launches. EXISTING: the
// folder is validated (main.py; the portable build's python_embeded or a
// venv) and nothing in it is touched except adding missing node packs.
// Re-running repairs a half install in place (every step is an ensure).
"use strict";
const fs = require("fs");
const path = require("path");
const X = require("./setupExec");
const Packs = require("./setupPacks");

const COMFY_REPO = () => process.env.BITGEN_COMFY_REPO || "https://github.com/Comfy-Org/ComfyUI.git";
const IS_WIN = process.platform === "win32";
const venvPy = (dir) => (IS_WIN ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python"));

/**
 * What is in a folder the user points at? -> {ok, main, root, python, how,
 * customNodes, portable} or {ok:false, error}. main = the folder with
 * main.py; root = what Settings -> ComfyUI should hold (the portable
 * build's top folder, so its python_embeded launches it).
 */
function inspectDir(dir) {
  const d = path.resolve(String(dir || ""));
  if (!dir || !fs.existsSync(d)) return { ok: false, error: `folder not found: ${d}` };
  const has = (...p) => fs.existsSync(path.join(d, ...p));
  let main = "", root = d, portable = false;
  if (has("python_embeded") && has("ComfyUI", "main.py")) { main = path.join(d, "ComfyUI"); portable = true; }
  else if (has("main.py") && has("comfy")) main = d;
  else if (has("ComfyUI", "main.py")) { main = path.join(d, "ComfyUI"); root = main; }
  if (!main) return { ok: false, error: `${d} is not a ComfyUI folder (no main.py - pick the folder that contains it, or the portable build's top folder)` };
  const cands = [];
  if (portable) cands.push([path.join(d, "python_embeded", IS_WIN ? "python.exe" : "python"), "the portable build's python_embeded"]);
  for (const v of ["venv", ".venv"]) {
    cands.push([venvPy(path.join(main, v)), `ComfyUI/${v}`]);
    if (root !== main || d !== main) cands.push([venvPy(path.join(d, v)), `${v} beside ComfyUI`]);
  }
  const hit = cands.find(([p]) => fs.existsSync(p));
  return { ok: true, main, root, portable, python: hit ? hit[0] : "", how: hit ? hit[1] : "",
           customNodes: path.join(main, "custom_nodes"), models: path.join(main, "models") };
}

/** The launch script the app picks first (lib/comfy.js detectLaunch). */
function writeRunScript(main) {
  if (IS_WIN) {
    const p = path.join(main, "run.bat");
    fs.writeFileSync(p, ["@echo off", "cd /d %~dp0", "venv\\Scripts\\python.exe -s main.py %*", ""].join("\r\n"));
    return p;
  }
  const p = path.join(main, "run.sh");
  fs.writeFileSync(p, ["#!/bin/sh", 'cd "$(dirname "$0")"', 'exec venv/bin/python -s main.py "$@"', ""].join("\n"));
  fs.chmodSync(p, 0o755);
  return p;
}

/** PyTorch for this machine into the venv (skipped when it already has a
 *  CUDA build, or BITGEN_SETUP_SKIP_TORCH is set - the tests). */
async function ensureTorch(py, gpu, ctx) {
  const log = ctx.log || (() => {});
  if (process.env.BITGEN_SETUP_SKIP_TORCH) { log("[test] torch install skipped (BITGEN_SETUP_SKIP_TORCH)", false); return { ok: true }; }
  // keep an existing build - unless it is CPU-only on a CUDA machine
  const have = (await captureTorch(py, ctx.env)).trim();
  if (have && (!gpu.cuda || /\+cu\d+/.test(have))) { log(`[ok] torch ${have} already in the venv`, false); return { ok: true }; }
  const pip = ["-m", "pip", "install", "--upgrade", "torch", "torchvision", "torchaudio", "--progress-bar", "off"];
  if (gpu.cuda) {
    for (const idx of gpu.torch.length ? gpu.torch : ["cu128"]) {
      log(`[..] PyTorch for ${gpu.main ? gpu.main.name : "this GPU"} (${idx} wheels, ~3 GB)`, false);
      const code = await X.run(py, pip.concat(["--index-url", `https://download.pytorch.org/whl/${idx}`]), { log, env: ctx.env });
      if (code === 0) {
        const v = await captureTorch(py, ctx.env);
        if (/\+cu\d+/.test(v)) { log(`[ok] torch ${v.trim()} (CUDA build)`, false); return { ok: true, index: idx }; }
      }
      log(`[warn] the ${idx} wheels did not install here - trying the next`, true);
    }
    return { ok: false, error: "no CUDA build of PyTorch would install - update the NVIDIA driver, then run setup again" };
  }
  const code = await X.run(py, process.platform === "darwin" ? pip
    : pip.concat(["--index-url", "https://download.pytorch.org/whl/cpu"]), { log, env: ctx.env });
  return code === 0 ? { ok: true, index: process.platform === "darwin" ? "mps" : "cpu" }
    : { ok: false, error: "PyTorch did not install - see the log" };
}

function captureTorch(py, env) {
  return new Promise((resolve) => {
    let out = "";
    const { spawn } = require("child_process");
    let c;
    try { c = spawn(py, ["-c", "import torch; print(torch.__version__)"], { env: env || process.env, windowsHide: true }); }
    catch { return resolve(""); }
    c.stdout.on("data", (d) => { out += d; });
    c.on("error", () => resolve(""));
    c.on("close", () => resolve(out));
  });
}

/**
 * A NEW ComfyUI in <dir>/ComfyUI. ctx = {git, python (a Python 3.10+ to
 * make the venv from), gpu (lib/setupGpu profile), log, env}.
 * -> {ok, main, root, python, customNodes, models} or {ok:false, error}
 */
async function installNew(dir, ctx) {
  const log = ctx.log || (() => {});
  const main = path.join(path.resolve(dir), "ComfyUI");
  fs.mkdirSync(path.dirname(main), { recursive: true });
  if (fs.existsSync(path.join(main, "main.py"))) log(`[ok] ComfyUI already in ${main} - keeping it, repairing what is missing`, false);
  else {
    log(`[..] ComfyUI -> ${main}`, false);
    const r = await Packs.fetchRepo(COMFY_REPO(), main, { git: ctx.git, log });
    if (!r.ok || !fs.existsSync(path.join(main, "main.py"))) return { ok: false, error: `could not fetch ComfyUI: ${r.error || "no main.py after the clone"}` };
  }
  const venv = path.join(main, "venv");
  const py = venvPy(venv);
  if (!fs.existsSync(py)) {
    if (!ctx.python) return { ok: false, error: "no Python 3.10+ to build ComfyUI's environment with" };
    log("[..] ComfyUI's own Python environment (venv)", false);
    const code = await X.run(ctx.python, ["-m", "venv", venv], { log, env: ctx.env });
    if (code !== 0 || !fs.existsSync(py)) return { ok: false, error: "creating the venv failed - see the log" };
  }
  await X.run(py, ["-m", "pip", "install", "--upgrade", "pip", "--progress-bar", "off"], { log, env: ctx.env });
  const t = await ensureTorch(py, ctx.gpu || { cuda: false, torch: [] }, ctx);
  if (!t.ok) return { ok: false, error: t.error };
  log("[..] ComfyUI's requirements", false);
  const code = await X.run(py, ["-m", "pip", "install", "-r", path.join(main, "requirements.txt"), "--progress-bar", "off"],
    { log, env: ctx.env });
  if (code !== 0) return { ok: false, error: "ComfyUI's requirements did not install - see the log" };
  writeRunScript(main);
  log(`[ok] ComfyUI installed: ${main} (launch: ${IS_WIN ? "run.bat" : "run.sh"})`, false);
  return { ok: true, main, root: main, python: py, customNodes: path.join(main, "custom_nodes"), models: path.join(main, "models") };
}

module.exports = { COMFY_REPO, inspectDir, writeRunScript, ensureTorch, installNew, venvPy };
