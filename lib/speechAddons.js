// bitGen Studio — lib/speechAddons.js (2.594.0): TWO MORE SPEECH ENGINES as add-ons - Ming-3.0 TTS and Underdog Bark 3.0 STT.
//
// Tim (verbatim): "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts ... and add option to use
// https://underdog.ai/bark as stt engine".
//
//   Ming-3.0 TTS (inclusionAI, 0.5B, 44.1 kHz): <app>/ming-tts/
//     src/      the GitHub repo (git clone, or GitHub's zip when there is no git) - its infer.py is what speaks
//     .venv/    its own Python (3.10 - 3.13): PyTorch + torchaudio from the CUDA index for THIS card (cu128 on a 50-series;
//               the repo's own reference stack is torch 2.6 / CUDA 12.4 on Linux), then requirements.txt WITHOUT its torch
//               lines (a line pip refuses is skipped and named - pynini, the text normaliser, usually is on Windows: the
//               helper then speaks with --no_text_normalization)
//     model/    inclusionAI/Ming-3.0-tts-0.5B from Hugging Face
//     scripts/ming_local.py runs infer.py: a cloned voice = --task TTS + the clip + its transcript (+ --use_spk_emb), a
//     designed voice = --task VOICE_DESIGN + the description (the flag is read from infer.py --help).
//   Underdog Bark 3.0 STT (Conway Research, 163 MB, from NVIDIA Parakeet, CC-BY-4.0, ENGLISH ONLY, no word times): <app>/bark-stt/
//     .venv/    PyTorch (CUDA when there is a card) + numpy, soundfile, soxr, constriction, huggingface_hub (+ whatever
//               bark_loader.py still asks for - the check names the missing module and it is installed, up to 6 rounds)
//     model/    model.bark + bark_loader.py + NOTICE from ConwayResearch/Underdog-Bark-3.0
//     scripts/bark_local.py: one-shot (lib/asr.js) and live (lib/asrLive.js, the 🎙 voice chat).
//
//   paths(base)                  {ming: {dir, src, venv, python, model}, bark: {dir, venv, python, model}}
//   mingStatus(base) / barkStatus(base)   {installed, note}
//   installMing(ctx) / installBark(ctx)   ctx = {log, run (setupExec.run), python, gpu, env, base, fetchRepo, git} -> {ok, error}
//   reqLines(text)               requirements.txt without torch / torchaudio / torchvision (and pynini) - pure
//   pipName(module)              the pip package for a missing import (sklearn -> scikit-learn ...) - pure
// Installed from Settings ▸ Add-ons (lib/addons.js entries "ming" and "bark") or the Settings ▸ Audio buttons (the same job).
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const IS_WIN = process.platform === "win32";
const MING = { repo: "https://github.com/inclusionAI/Ming-3.0-tts", model: "inclusionAI/Ming-3.0-tts-0.5B" };
const BARK = { repo: "ConwayResearch/Underdog-Bark-3.0", files: ["model.bark", "bark_loader.py", "NOTICE"],
               pip: ["numpy", "soundfile", "soxr", "constriction", "huggingface_hub"] };
const venvPy = (v) => path.join(v, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;     // the env: the tests' temp folder
  const md = path.join(b, "ming-tts"), bd = path.join(b, "bark-stt");
  return {
    ming: { dir: md, src: path.join(md, "src"), venv: path.join(md, ".venv"), python: venvPy(path.join(md, ".venv")), model: path.join(md, "model") },
    bark: { dir: bd, venv: path.join(bd, ".venv"), python: venvPy(path.join(bd, ".venv")), model: path.join(bd, "model") },
  };
}
const has = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const nonEmpty = (d) => { try { return fs.readdirSync(d).some((f) => !f.startsWith(".")); } catch { return false; } };

function mingStatus(base) {
  const p = paths(base).ming;
  const py = has(p.python), src = has(path.join(p.src, "infer.py")), model = nonEmpty(p.model);
  const ok = py && src && model;
  return { installed: ok, note: ok ? p.dir : !py && !src && !model ? "not installed" :
    `partly there (${[py ? "" : "its Python", src ? "" : "the code", model ? "" : "the model"].filter(Boolean).join(", ")} missing) - Install again` };
}
function barkStatus(base) {
  const p = paths(base).bark;
  const py = has(p.python), files = BARK.files.slice(0, 2).every((f) => has(path.join(p.model, f)));
  const ok = py && files;
  return { installed: ok, note: ok ? p.dir : !py && !files ? "not installed" : `partly there (${py ? "the model files" : "its Python"} missing) - Install again` };
}

/** requirements.txt minus the torch family (installed from the CUDA index first) and pynini (conda-only on Windows) */
function reqLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !/^(-e\s|--)/.test(l))
    .filter((l) => !/^(torch|torchaudio|torchvision|pynini)\b/i.test(l.replace(/\s+/g, "")));
}
const PIP_OF = { sklearn: "scikit-learn", cv2: "opencv-python", yaml: "pyyaml", PIL: "pillow", soundfile: "soundfile",
                 google: "protobuf", omegaconf: "omegaconf", hydra: "hydra-core", Levenshtein: "python-Levenshtein" };
function pipName(mod) {
  const m = String(mod || "").split(".")[0].trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(m)) return "";
  return PIP_OF[m] || m.replace(/_/g, "-");
}

/* ---------------- shared steps */
function envOf(ctx) { return Object.assign({}, ctx.env || process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1", PIP_NO_INPUT: "1" }); }
async function pythonOk(ctx, what) {
  const run = ctx.run || X.run, py = ctx.python;
  if (!py) return { error: "no Python found - the app's setup installs one (Settings ▸ General ▸ Setup), or set Python in Settings ▸ Paths" };
  let ver = "";
  await run(py, ["-c", "import sys; print('PYV %d.%d' % sys.version_info[:2])"], { log: (l) => { const m = /PYV (\d+\.\d+)/.exec(l); if (m) ver = m[1]; }, env: envOf(ctx) });
  const [maj, min] = ver.split(".").map(Number);
  if (!ver || maj !== 3 || min < 10 || min > 13) return { error: `${what} needs Python 3.10 - 3.13; ${py} is ${ver || "not runnable"}` };
  return { ver };
}
async function makeVenv(ctx, venv) {
  const run = ctx.run || X.run, log = ctx.log || (() => {}), vpy = venvPy(venv);
  if (!fs.existsSync(vpy)) {
    log(`[..] its own Python environment: ${venv}`, false);
    fs.mkdirSync(path.dirname(venv), { recursive: true });
    if (await run(ctx.python, ["-m", "venv", venv], { log, env: envOf(ctx) }) !== 0 || !fs.existsSync(vpy)) return { error: "could not make the venv " + venv };
  } else log(`[ok] venv already there: ${venv}`, false);
  await run(vpy, ["-m", "pip", "install", "--upgrade", "pip", "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 10 * 60000 });
  return { python: vpy };
}
/** torch (+ extras) from the CUDA index for this card; the CPU wheels when there is no NVIDIA card */
async function installTorch(ctx, vpy, pkgs) {
  const run = ctx.run || X.run, log = ctx.log || (() => {});
  const idx = require("./addons").torchIndexes(ctx.gpu);
  const tries = idx.length ? idx : ["cpu"];
  for (const i of tries) {
    log(`[..] PyTorch (${i} wheels${i === "cpu" ? " - no NVIDIA card found, it runs on the CPU (slow)" : ", ~3 GB"})`, false);
    const code = await run(vpy, ["-m", "pip", "install", ...pkgs, "--index-url", `https://download.pytorch.org/whl/${i}`, "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 60 * 60000 });
    if (code === 0) { log(`[ok] ${pkgs.join(" + ")} (${i})`, false); return { ok: true, index: i }; }
    log(`[warn] the ${i} wheels did not install - trying the next`, true);
  }
  return { error: "PyTorch would not install - update the NVIDIA driver and try again" };
}
/** a Hugging Face download with the venv's own huggingface_hub (resumes; HF_TOKEN from the environment) */
async function hfGet(ctx, vpy, code, what) {
  const run = ctx.run || X.run, log = ctx.log || (() => {});
  log(`[..] ${what} from Hugging Face`, false);
  const rc = await run(vpy, ["-c", code], { log, env: envOf(ctx), timeout: 3 * 60 * 60000 });
  return rc === 0 ? { ok: true } : { error: `could not download ${what} - see the log above (a gated model needs your Hugging Face token in Settings)` };
}
const pyStr = (s) => JSON.stringify(String(s));

/* ---------------- Ming-3.0 TTS */
async function installMing(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base).ming;
  const pv = await pythonOk(ctx, "Ming-3.0 TTS"); if (pv.error) return { ok: false, error: pv.error };
  log(`[ok] Python ${pv.ver} (${ctx.python})`, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!fs.existsSync(path.join(p.src, "infer.py"))) {
    log(`[..] the Ming-3.0 TTS code (${MING.repo})`, false);
    const fr = await (ctx.fetchRepo || require("./setupPacks").fetchRepo)(MING.repo + ".git", p.src, { log, git: ctx.git === undefined ? X.which("git") : ctx.git, env: envOf(ctx) });
    if (!fr.ok) return { ok: false, error: "could not fetch the Ming-3.0 TTS code: " + (fr.error || "see the log") };
    if (!fs.existsSync(path.join(p.src, "infer.py"))) return { ok: false, error: "the Ming-3.0 TTS code came without infer.py - the repository changed; tell us" };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await makeVenv(ctx, p.venv); if (v.error) return { ok: false, error: v.error };
  const t = await installTorch(ctx, v.python, ["torch", "torchaudio"]); if (t.error) return { ok: false, error: t.error };
  // its requirements without the torch family; one refused line is skipped and named, not the whole install
  let req = [];
  try { req = reqLines(fs.readFileSync(path.join(p.src, "requirements.txt"), "utf8")); } catch { req = []; }
  req.push("huggingface_hub", "soundfile");
  const rf = path.join(p.dir, "requirements-h3.txt");
  fs.writeFileSync(rf, req.join("\n") + "\n");
  log(`[..] its Python packages (${req.length})`, false);
  const skipped = [];
  if (await run(v.python, ["-m", "pip", "install", "-r", rf, "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 60 * 60000 }) !== 0) {
    log("[warn] pip refused the list as a whole - one package at a time", true);
    for (const r of req) if (await run(v.python, ["-m", "pip", "install", r, "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 30 * 60000 }) !== 0) skipped.push(r);
  }
  if (skipped.length) log(`[warn] skipped (pip could not install them here): ${skipped.join(", ")}${skipped.some((s) => /pynini/i.test(s)) ? "" : ""}`, true);
  const g = await hfGet(ctx, v.python, `from huggingface_hub import snapshot_download; snapshot_download(${pyStr(MING.model)}, local_dir=${pyStr(p.model)})`, `the model ${MING.model} (~2 GB)`);
  if (g.error) return { ok: false, error: g.error };
  // the import check (no speech): infer.py's flags + whether text normalisation (pynini) is there
  let chk = null;
  await run(v.python, [path.join(core.resolvePath("scripts"), "ming_local.py"), "--check", p.src, p.model], { log: (l) => { const s = String(l); if (s.startsWith("{")) { try { chk = JSON.parse(s); } catch { /* not it */ } } else log(s, false); }, env: envOf(ctx), timeout: 10 * 60000 });
  if (chk && chk.error) return { ok: false, error: "installed, but Ming-3.0 TTS does not start: " + chk.error };
  if (chk && !chk.normalize) log("[ok] text normalisation (pynini) is not available here - it speaks with --no_text_normalization (write numbers as words for the best reading)", false);
  log(`[ok] Ming-3.0 TTS installed: ${p.dir}. Pick it in Settings ▸ Audio ▸ Speech engine.`, false);
  return { ok: true, skipped };
}

/* ---------------- Underdog Bark 3.0 STT */
async function installBark(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base).bark;
  const pv = await pythonOk(ctx, "Bark 3.0"); if (pv.error) return { ok: false, error: pv.error };
  log(`[ok] Python ${pv.ver} (${ctx.python})`, false);
  fs.mkdirSync(p.model, { recursive: true });
  const v = await makeVenv(ctx, p.venv); if (v.error) return { ok: false, error: v.error };
  const t = await installTorch(ctx, v.python, ["torch"]); if (t.error) return { ok: false, error: t.error };
  log(`[..] ${BARK.pip.join(", ")}`, false);
  if (await run(v.python, ["-m", "pip", "install", ...BARK.pip, "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 30 * 60000 }) !== 0)
    return { ok: false, error: "pip could not install " + BARK.pip.join(", ") + " - see the log above" };
  const g = await hfGet(ctx, v.python, `from huggingface_hub import hf_hub_download\nfor f in ${JSON.stringify(BARK.files)}:\n    print(hf_hub_download(${pyStr(BARK.repo)}, f, local_dir=${pyStr(p.model)}))`, `${BARK.repo} (163 MB)`);
  if (g.error) return { ok: false, error: g.error };
  // bark_loader.py may import more than the list above: the check names the module, it is installed, again (6 rounds)
  const helper = path.join(core.resolvePath("scripts"), "bark_local.py");
  for (let round = 0; round < 6; round++) {
    let chk = null;
    await run(v.python, [helper, "--check", p.model], { log: (l) => { const s = String(l); if (s.startsWith("{")) { try { chk = JSON.parse(s); } catch { /* not it */ } } }, env: envOf(ctx), timeout: 10 * 60000 });
    if (chk && chk.ok) { log(`[ok] Bark 3.0 loads (${chk.device || "cpu"})`, false); break; }
    const pkg = chk && chk.missing ? pipName(chk.missing) : "";
    if (!pkg) return { ok: false, error: "installed, but Bark 3.0 does not load: " + ((chk && chk.error) || "no answer from the check") };
    log(`[..] bark_loader.py also needs ${chk.missing} -> pip install ${pkg}`, false);
    if (await run(v.python, ["-m", "pip", "install", pkg, "--progress-bar", "off"], { log, env: envOf(ctx), timeout: 30 * 60000 }) !== 0) return { ok: false, error: `pip could not install ${pkg} (bark_loader.py needs ${chk.missing})` };
    if (round === 5) return { ok: false, error: "Bark 3.0 still does not load after installing what it asked for - see the log" };
  }
  log(`[ok] Bark 3.0 installed: ${p.dir}. Pick it in Settings ▸ Audio ▸ Speech-to-text engine. English only, no word times - lyrics, captions and other timed work stay on faster-whisper.`, false);
  return { ok: true };
}

function removeDir(which) {
  return async (log) => {
    const d = paths()[which].dir;
    log(`[..] removing ${d}`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

module.exports = { MING, BARK, paths, mingStatus, barkStatus, reqLines, pipName, installMing, installBark, installTorch, removeDir };
