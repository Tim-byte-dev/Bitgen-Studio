// bitGen Studio — lib/singVoiceAddon.js (2.965.0): Settings ▸ Add-ons ▸ 🎤 Sing in my voice - the three singing voice
// conversion engines, each ticked on its own (lib/singVoice.js runs them; the 🎹 Synth tab's 🎤 row asks for one when it is
// not there - static/needinstall.js "sing_seedvc" / "sing_soulx" / "sing_rvc").
//
//   seedvc  git Plachtaa/seed-vc -> singvoice/seedvc/src; its venv; PyTorch 2.8 (+ torchaudio / torchvision - torchaudio's own
//           save still works without torchcodec) from the CUDA index for this card; requirements.txt without the torch
//           family, the GUI / evaluation packages (gradio, FreeSimpleGUI, sounddevice, jiwer, resemblyzer, modelscope, funasr);
//           a pin pip refuses is tried unpinned. Its singing model, RMVPE, CAM++, BigVGAN and Whisper come from Hugging
//           Face on the first use (its own hf_utils) - ~1.5 GB.
//   soulx   git Soul-AILab/SoulX-Singer -> singvoice/soulx/src; its venv; PyTorch 2.8 + torchaudio; requirements.txt without
//           the torch family, torchcodec, gradio, wandb, nemo_toolkit, funasr, sageattention (the separation / lyric / web
//           parts bitGen does not use); Soul-AILab/SoulX-Singer model-svc.pt + Soul-AILab/SoulX-Singer-Preprocess rmvpe/ into
//           singvoice/soulx/models; openai/whisper-base cached (its content encoder) - ~3.5 GB.
//   rvc     git IAHispano/Applio -> singvoice/rvc/src; its venv; PyTorch 2.11 (its pin; else the newest) + torchaudio;
//           requirements-engine.txt without the torch lines; `core.py prerequisites --no-exe` (the pretrained voices,
//           rmvpe, contentvec) - ~2 GB, and your trained models in singvoice/rvc/voices.
//   Each ends with the helper's import check (scripts/singvoice_local.py check) - a module it names is pip-installed and
//   checked again (6 rounds).
//
//   ITEMS, status(), install(log, picks, deps), remove(log), filterReq(text, drop) (pure - tests)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const ITEMS = [
  { id: "seedvc", label: "Seed-VC (singing, from a clip of your voice - GPL-3.0)", for: "zero-shot singing voice conversion at 44.1 kHz", dflt: true, size: "~6 GB (PyTorch + its packages) + ~1.5 GB of models on the first use" },
  { id: "soulx", label: "SoulX-Singer SVC (from a clip of your voice - Apache-2.0)", for: "zero-shot singing voice conversion (24 kHz)", dflt: false, size: "~6 GB (PyTorch + its packages) + ~3.5 GB of models" },
  { id: "rvc", label: "RVC through Applio (a model trained on your voice - MIT)", for: "the classic: train a model on ~10 minutes of your voice, then convert any vocal", dflt: false, size: "~7 GB (PyTorch + its packages) + ~2 GB of models + your trained voices" },
];
const DROP = {
  seedvc: ["torch", "torchaudio", "torchvision", "gradio", "freesimplegui", "sounddevice", "jiwer", "resemblyzer", "modelscope", "funasr"],
  soulx: ["torch", "torchaudio", "torchvision", "torchcodec", "gradio", "wandb", "nemo_toolkit", "nemo-toolkit", "funasr", "sageattention", "setuptools"],
  rvc: ["torch", "torchaudio", "torchvision"],
};
/** 3.1.0: the NumPy Numba (librosa's) can take - kept as a pip constraint through the install (Numba 0.62: NumPy <= 2.3) */
const NUMPY_CAP = "numpy<2.4";
/** 3.4.1 (Tim: "soulx: installed, but it does not load: ValueError: LlamaConfig accepts only keyword arguments, but found `5`
 *  positional args" + "seedvc: ... OverflowError: cannot convert longdouble infinity to integer"): both pin packages of 2024
 *  (numpy 1.26 / < 2, scipy 1.13 / 1.15, transformers 4.46 / 4.41) that have no wheels for Python 3.13 - on the app's 3.13 pip
 *  fell back to the newest (transformers 5 takes configs by keyword only). Their venvs are now made with a Python they were
 *  written for (lib/pyVersion.js: this computer's 3.10 - 3.12, else uv fetches 3.10), and transformers stays below 5. */
const PY = { seedvc: { want: "3.10", range: "3.10 - 3.12", why: "its pinned numpy 1.26 / scipy 1.13 have no Python 3.13 wheels" },
  soulx: { want: "3.10", range: "3.10 - 3.12", why: "its pinned numpy < 2 / transformers 4.41 have no Python 3.13 wheels" } };
const CAPS = { seedvc: [NUMPY_CAP, "transformers<5"], soulx: [NUMPY_CAP, "transformers<5"], rvc: [NUMPY_CAP] };
const TORCH = { seedvc: ["torch==2.8.0", "torchaudio==2.8.0", "torchvision==0.23.0"], soulx: ["torch==2.8.0", "torchaudio==2.8.0"], rvc: ["torch==2.11.0", "torchaudio==2.11.0"] };
const REQ = { seedvc: "requirements.txt", soulx: "requirements.txt", rvc: "requirements-engine.txt" };
const EXTRA = { seedvc: ["soundfile", "huggingface_hub"], soulx: ["soundfile", "huggingface_hub", "librosa"], rvc: ["soundfile"] };

/** a requirements file without the lines this install leaves out (and pip options, comments, the torch index lines) - pure */
function filterReq(text, drop) {
  const no = (drop || []).map((d) => d.toLowerCase());
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l && !/^(-|--)/.test(l))
    .filter((l) => { const n = (/^([A-Za-z0-9_.\-]+)/.exec(l) || [])[1]; return n && !no.includes(n.toLowerCase()) && !/--index-url/.test(l); });
}
/** "numpy==1.26.4; python_version < '3.12'" -> "numpy" (a pin pip refuses, tried again without it) */
const unpinned = (r) => r.split(";")[0].replace(/\s*(==|>=|<=|~=|<|>).*$/, "").trim();

function status() {
  const SV = require("./singVoice");
  const items = ITEMS.map((it) => Object.assign({ present: SV.engineStatus(it.id).installed }, it));
  const have = items.filter((i) => i.present);
  return { installed: have.length > 0, items,
           note: have.length ? have.map((i) => i.label.replace(/ \(.*\)$/, "")).join(", ") + " · " + SV.paths().root : "not installed" };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const want = (Array.isArray(picks) && picks.length ? picks : ITEMS.filter((i) => i.dflt).map((i) => i.id)).filter((id) => ITEMS.some((i) => i.id === id));
  if (!want.length) return { ok: false, error: "tick at least one engine" };
  const SA = require("./speechAddons"), X = require("./setupExec");
  const m = d.machine || (() => { const SR = require("./setupRun"); let gpu = {}; try { gpu = require("./setupGpu").detect(); } catch { gpu = {}; } return { python: SR.appPython(), gpu, env: SR.env() }; })();
  const ctx = Object.assign({ log, run: d.run || X.run, fetchRepo: d.fetchRepo, git: d.git }, m);
  const errors = [];
  for (const id of want) {
    log(`[..] ── ${ITEMS.find((i) => i.id === id).label} ──`, false);
    const r = await one(id, ctx, SA, d);
    if (!r.ok) { errors.push(`${id}: ${r.error}`); log(`[error] ${id}: ${r.error}`, true); }
  }
  return errors.length ? { ok: false, error: errors.join(" · ") } : { ok: true };
}

async function one(id, ctx, SA, d) {
  const SV = require("./singVoice"), P = SV.paths(d.base)[id], E = SV.ENGINES[id];
  const log = ctx.log, run = ctx.run, env = SA.envOf(ctx);
  const pv = await SA.pythonOk(ctx, E.short);
  if (pv.error && !PY[id]) return { ok: false, error: pv.error };
  if (!pv.error) log(`[ok] the app's Python ${pv.ver} (${ctx.python})`, false);
  fs.mkdirSync(P.dir, { recursive: true });
  // 1 the code
  if (!fs.existsSync(path.join(P.src, E.marker))) {
    log(`[..] its code (${E.repo})`, false);
    const fr = await (ctx.fetchRepo || require("./setupPacks").fetchRepo)(E.repo + ".git", P.src, { log, git: ctx.git === undefined ? require("./setupExec").which("git") : ctx.git, env });
    if (!fr.ok) return { ok: false, error: "could not fetch the code: " + (fr.error || "see the log") };
    if (!fs.existsSync(path.join(P.src, E.marker))) return { ok: false, error: `the code came without ${E.marker} - the repository changed; tell us` };
  } else log(`[ok] the code is there: ${P.src}`, false);
  // 2 its Python + PyTorch (the pin, else the newest from the same index)
  const v = PY[id] ? await (d.venvFor || require("./pyVersion").venvFor)(ctx, Object.assign({ venv: P.venv, label: E.short, fits: (m) => m >= 10 && m <= 12 }, PY[id]))
    : await SA.makeVenv(ctx, P.venv);
  if (v.error) return { ok: false, error: v.error };
  let t = await SA.installTorch(ctx, v.python, TORCH[id]);
  if (t.error) { log("[warn] the pinned PyTorch would not install - the newest for this card", true); t = await SA.installTorch(ctx, v.python, TORCH[id].map(unpinned)); }
  if (t.error) return { ok: false, error: t.error };
  // 3 its packages (a refused line: one at a time, then unpinned)
  let req = [];
  try { req = filterReq(fs.readFileSync(path.join(P.src, REQ[id]), "utf8"), DROP[id]); } catch { req = []; }
  req = req.concat(EXTRA[id].filter((x) => !req.some((r) => unpinned(r).toLowerCase() === x.toLowerCase())));
  const rf = path.join(P.dir, "requirements-bitgen.txt");
  fs.writeFileSync(rf, req.join("\n") + "\n");
  // 3.1.0: Numba (librosa's) supports NumPy up to 2.3 - a constraints file keeps pip from bringing 2.4 in with the list
  const cf = path.join(P.dir, "constraints-bitgen.txt"); fs.writeFileSync(cf, CAPS[id].join("\n") + "\n");   // 3.4.1: + transformers<5
  log(`[..] its Python packages (${req.length})`, false);
  const skipped = [];
  if (await run(v.python, ["-m", "pip", "install", "-r", rf, "-c", cf, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 }) !== 0) {
    log("[warn] pip refused the list as a whole - one package at a time", true);
    for (const r of req) {
      if (await run(v.python, ["-m", "pip", "install", r, "-c", cf, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) === 0) continue;
      const u = unpinned(r);
      if (u !== r && await run(v.python, ["-m", "pip", "install", u, "-c", cf, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) === 0) { log(`[ok] ${u} (without the pin ${r})`, false); continue; }
      skipped.push(r);
    }
  }
  if (skipped.length) log(`[warn] skipped (pip could not install them here): ${skipped.join(", ")}`, true);
  // 4 the models
  const py = (code, what) => SA.hfGet(ctx, v.python, code, what);
  const q = (s) => JSON.stringify(String(s));
  if (id === "soulx") {
    let g = await py(`from huggingface_hub import snapshot_download; snapshot_download("Soul-AILab/SoulX-Singer", local_dir=${q(path.join(P.models, "SoulX-Singer"))}, allow_patterns=["model-svc.pt", "*.yaml", "*.json"])`, "SoulX-Singer SVC (model-svc.pt, ~2.8 GB)");
    if (g.error) return { ok: false, error: g.error };
    g = await py(`from huggingface_hub import snapshot_download; snapshot_download("Soul-AILab/SoulX-Singer-Preprocess", local_dir=${q(path.join(P.models, "SoulX-Singer-Preprocess"))}, allow_patterns=["rmvpe/*"])`, "its pitch tracker (RMVPE)");
    if (g.error) return { ok: false, error: g.error };
    g = await py(`from transformers import WhisperFeatureExtractor, WhisperModel; WhisperFeatureExtractor.from_pretrained("openai/whisper-base"); WhisperModel.from_pretrained("openai/whisper-base")`, "Whisper base (its content encoder)");
    if (g.error) return { ok: false, error: g.error };
  } else if (id === "rvc") {
    log("[..] Applio's prerequisites (pretrained voices, rmvpe, contentvec)", false);
    if (await run(v.python, ["core.py", "prerequisites", "--pretraineds-hifigan", "--models", "--no-exe"], { log, env: Object.assign({}, env, { APPLIO_LOGS_DIR: P.logs }), cwd: P.src, timeout: 3 * 3600000 }) !== 0)
      return { ok: false, error: "Applio's prerequisites did not download - see the log" };
    fs.mkdirSync(P.logs, { recursive: true });
  } else log("[ok] Seed-VC fetches its singing model (~1.5 GB) from Hugging Face on the first conversion", false);
  // 5 the import check - a module it names is installed, then checked again
  const helper = path.join(core.resolvePath("scripts"), "singvoice_local.py");
  for (let round = 0; round < 6; round++) {
    const jf = path.join(P.dir, "check.json");
    fs.writeFileSync(jf, JSON.stringify({ task: "check", engine: id, src_dir: P.src }));
    let chk = null;
    await run(v.python, [helper, jf], { log: (l) => { const s = String(l); if (s.startsWith("{")) { try { chk = JSON.parse(s); } catch { /* not it */ } } }, env, timeout: 10 * 60000 });
    if (chk && chk.ok) { log(`[ok] ${E.short} loads (torch ${chk.torch}, ${chk.cuda ? "CUDA" : "the CPU - slow"})`, false); break; }
    // 3.1.0: Numba refuses the NumPy pip brought in ("Numba needs NumPy 2.3 or less. Got NumPy 2.4.") -> that NumPy pinned back
    if (chk && chk.pin) {
      log(`[..] ${chk.error} -> pip install "${chk.pin}"`, false);
      if (await run(v.python, ["-m", "pip", "install", chk.pin, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0) return { ok: false, error: `pip could not install ${chk.pin}` };
      continue;
    }
    const pkg = chk && chk.missing ? SA.pipName(chk.missing) : "";
    if (!pkg) return { ok: false, error: "installed, but it does not load: " + ((chk && chk.error) || "no answer from the check") };
    log(`[..] it also needs ${chk.missing} -> pip install ${pkg}`, false);
    if (await run(v.python, ["-m", "pip", "install", pkg, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0) return { ok: false, error: `pip could not install ${pkg}` };
    if (round === 5) return { ok: false, error: "it still does not load after installing what it asked for - see the log" };
  }
  log(`[ok] ${E.short} installed: ${P.dir}`, false);
  return { ok: true, skipped };
}

async function remove(log) {
  const SV = require("./singVoice"), d = SV.paths().root;
  log(`[..] removing ${d} (your clips in ${SV.paths().clips} are kept)`, false);
  const ok = require("./setupPacks").safeRm(d, log);
  return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
}

module.exports = { NUMPY_CAP, PY, CAPS, ITEMS, DROP, TORCH, status, install, remove, filterReq, unpinned };
