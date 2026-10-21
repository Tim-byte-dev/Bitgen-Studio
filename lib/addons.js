// bitGen Studio — lib/addons.js (2.540.4): THE ADD-ONS - optional engines installed from Settings ▸ Add-ons.
//
// Tim: "all generation works except for yue2, can we add an add ons tab to settings - install yue2?" (his log: "YuE2 is
// not installed - run get-yue2.ps1 once"). One list of the optional engines, what each is for, what it needs and how
// big it is, whether it is installed, and an Install / Remove that runs IN the app (no PowerShell window), one at a
// time, every line in a log the tab shows.
//
//   YuE2 (the "YuE2" music style): its own venv at <app>/yue2/.venv (where music_worker.py looks), the app's Python
//     (3.10-3.13), PyTorch 2.10.0 - the version the pipeline pins - from the PyTorch CUDA index for THIS card first
//     (cu130 / cu128 - PyPI's Windows wheel is CPU-only), then the pinned pipeline yue2-infer 0.1.6 from its GitHub
//     release zip (no git needed). The model (m-a-p/YuE2-3B + its VAE) downloads on the first song.
//   Viggle (native): the existing installer (routes/native.js) - its job runs in the queue; shown here with its state.
//   2.557.0 AI fill models: the image editor's Krita-AI fill helpers - a node pack + the model files ticked in the tab
//     (lib/aiFillAddon.js); an add-on may list items (status().items) and install(opts.items) gets the ticked ones.
//
//   list()                       -> [{id, label, for, needs, size, installed, note, busy, actions}]
//   installYue2(ctx)             ctx = {log, run (X.run), python, gpu, env, base} -> {ok, error}
//   start(id) / remove(id)       one job at a time -> {ok} | {error}; job() -> {id, action, state, lines[], error}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const YUE2 = {
  tag: "yue2-v0.1.6",
  torch: "2.10.0",
  pkg: "yue2-infer @ https://github.com/multimodal-art-projection/YuE/archive/refs/tags/yue2-v0.1.6.zip",
  model: "m-a-p/YuE2-3B",
};
const IS_WIN = process.platform === "win32";

const yueDir = (base) => path.join(base || core.BASE, "yue2");
const yueVenv = (base) => path.join(yueDir(base), ".venv");
const venvPy = (v) => path.join(v, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const yueCli = (base) => path.join(yueVenv(base), IS_WIN ? "Scripts" : "bin", IS_WIN ? "yue2.exe" : "yue2");

/** The CUDA wheel indexes to try for this machine (setupGpu's choice; cu128 when it cannot tell). */
function torchIndexes(gpu) {
  const g = gpu || {};
  if (!g.cuda) return [];
  return (Array.isArray(g.torch) && g.torch.length ? g.torch : ["cu128"]).filter((x) => /^cu\d+$/.test(x));
}

/** The YuE2 install, step by step (pure apart from ctx.run / the file system - the tests pass a fake run). */
async function installYue2(ctx) {
  const log = ctx.log || (() => {});
  const run = ctx.run || X.run;
  const env = Object.assign({}, ctx.env || process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const base = ctx.base || core.BASE;
  const py = ctx.python;
  if (!py) return { ok: false, error: "no Python found - the app's setup installs one (Settings ▸ General ▸ Setup), or set Python in Settings ▸ Paths" };
  const idx = torchIndexes(ctx.gpu);
  if (!idx.length) return { ok: false, error: "YuE2 needs an NVIDIA GPU with CUDA (BF16, ~24 GB VRAM) - none was found on this computer" };
  // the app's Python must be 3.10 - 3.13 (the pipeline: >=3.10; PyTorch 2.10 has wheels up to 3.13)
  let ver = "";
  await run(py, ["-c", "import sys; print('PYV %d.%d' % sys.version_info[:2])"], { log: (l) => { const m = /PYV (\d+\.\d+)/.exec(l); if (m) ver = m[1]; }, env });
  const [maj, min] = ver.split(".").map(Number);
  if (!ver || maj !== 3 || min < 10 || min > 13) return { ok: false, error: `YuE2 needs Python 3.10 - 3.13; ${py} is ${ver || "not runnable"}` };
  log(`[ok] Python ${ver} (${py})`, false);
  fs.mkdirSync(yueDir(base), { recursive: true });
  const venv = yueVenv(base), vpy = venvPy(venv);
  if (!fs.existsSync(vpy)) {
    log(`[..] its own Python environment: ${venv}`, false);
    if (await run(py, ["-m", "venv", venv], { log, env }) !== 0 || !fs.existsSync(vpy)) return { ok: false, error: "could not make the venv " + venv };
  } else log(`[ok] venv already there: ${venv}`, false);
  await run(vpy, ["-m", "pip", "install", "--upgrade", "pip", "--progress-bar", "off"], { log, env, timeout: 10 * 60000 });
  // PyTorch first, from the CUDA index (PyPI's Windows torch is CPU-only, and the pipeline pins torch==2.10.0)
  let torchOk = false;
  for (const i of idx) {
    log(`[..] PyTorch ${YUE2.torch} (${i} wheels, ~3 GB)`, false);
    const code = await run(vpy, ["-m", "pip", "install", `torch==${YUE2.torch}`, "--index-url", `https://download.pytorch.org/whl/${i}`, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 });
    if (code === 0) { torchOk = true; log(`[ok] torch ${YUE2.torch}+${i}`, false); break; }
    log(`[warn] the ${i} wheels did not install - trying the next`, true);
  }
  if (!torchOk) return { ok: false, error: `PyTorch ${YUE2.torch} with CUDA would not install - update the NVIDIA driver and try again` };
  log(`[..] the YuE2 pipeline (${YUE2.tag})`, false);
  if (await run(vpy, ["-m", "pip", "install", YUE2.pkg, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 }) !== 0)
    return { ok: false, error: `pip could not install ${YUE2.tag} - see the log above` };
  if (!fs.existsSync(yueCli(base))) return { ok: false, error: `installed, but ${yueCli(base)} is not there - see the log above` };
  log(`[ok] YuE2 installed: ${yueCli(base)}`, false);
  log(`[ok] pick the "YuE2" style in the Music docker. The first song downloads ${YUE2.model} from Hugging Face (one time), later songs work offline.`, false);
  return { ok: true };
}

/* ---------------- the one running job */
let J = null;   // {id, action, state: running | done | error, lines: [], error, started, finished}
function job() { return J; }
function busy() { return !!(J && J.state === "running"); }
function startJob(id, action, fn) {
  if (busy()) return { error: `${J.id} is already being ${J.action === "remove" ? "removed" : "installed"} - one at a time` };
  J = { id, action, state: "running", lines: [], error: "", started: Date.now(), finished: 0 };
  const me = J;
  const log = (line, err) => { me.lines.push((err ? "! " : "") + String(line)); if (me.lines.length > 4000) me.lines.splice(0, me.lines.length - 4000); };
  Promise.resolve().then(() => fn(log)).then((r) => {
    me.state = r && r.ok ? "done" : "error"; me.error = (r && r.error) || ""; me.finished = Date.now();
    log(r && r.ok ? `[done] ${id} ${action === "remove" ? "removed" : "installed"}` : `[failed] ${me.error}`, !(r && r.ok));
  }).catch((e) => { me.state = "error"; me.error = String((e && e.message) || e); me.finished = Date.now(); log("[failed] " + me.error, true); });
  return { ok: true, job: J };
}

/** The app's Python + this machine's GPU (lazy - setupRun / setupGpu are heavy). */
function machine() {
  const SR = require("./setupRun");
  let gpu = {};
  try { gpu = require("./setupGpu").detect(); } catch { gpu = {}; }
  return { python: SR.appPython(), gpu, env: SR.env() };
}

/* ---------------- the list */
const LIST = [
  { id: "yue2", label: "YuE2 music",
    for: "Songs from lyrics + a style caption with the \"YuE2\" style in the Music docker (vocals, instruments, 48 kHz stereo)",
    needs: "an NVIDIA GPU with BF16 and ~24 GB VRAM; the app's Python 3.10 - 3.13",
    size: "~5 GB now (PyTorch 2.10 + the pipeline, in its own venv) + the model (~10 GB) on the first song",
    status(base) { const ok = fs.existsSync(yueCli(base)); return { installed: ok, note: ok ? yueCli(base) : (fs.existsSync(venvPy(yueVenv(base))) ? "its venv is there but the pipeline is not - Install again" : "not installed") }; },
    install() { const m = machine(); return (log) => installYue2(Object.assign({ log }, m)); },
    remove() { return async (log) => { const d = yueDir(); log(`[..] removing ${d}`, false); const ok = require("./setupPacks").safeRm(d, log); return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` }; }; } },
  // 2.557.0 (Tim: "add download ai fill models to addons tab in settings dialog"): the image editor's selection fill the
  // Krita AI way (lib/kritaInpaint.js) - the node pack + the models you tick (lib/aiFillAddon.js)
  { id: "aifill", label: "AI fill models (the Krita AI way)",
    for: "Generate / Fill / Remove in a selection in the image editor fill like the Krita AI plugin - SDXL / Pony with the Fooocus inpaint patch, Illustrious / FLUX.1 / SD 1.5 with inpainting ControlNets, Remove with MAT",
    needs: "ComfyUI (its folder set in Settings ▸ ComfyUI); restart ComfyUI once after the first install",
    get size() { return "the node pack (small) + the models you tick: " + require("./aiFillAddon").ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./aiFillAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./aiFillAddon").install(log, picks); },
    remove() { return (log) => require("./aiFillAddon").remove(log); } },
  // 2.566.0 (Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image, add an option
  // in add-ons to download and install it"): MOSS-Image's files from Comfy-Org/MOSS-Image (lib/mossAddon.js)
  { id: "moss", label: "MOSS-Image (image model)",
    for: "The MOSS-Image image styles (OpenMOSS's open 5B model - strong text in pictures and layouts): SFT for pictures, Base for LoRAs",
    needs: "ComfyUI from 16 Oct 2026 or later (its own MOSS-Image nodes - no node pack); about 14 GB of VRAM with the int8 files (a 16 GB card)",
    get size() { const M = require("./mossAddon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")}${/\(/.test(i.label) ? " " + i.label.match(/\(([^)]*)\)/)[1] : ""} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", "); },
    status() { return require("./mossAddon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./mossAddon").install(log, picks); },
    remove() { return (log) => require("./mossAddon").remove(log); } },
  // 2.573.0 (Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni"): FastH3 Omni's model from
  // FastVideo/FastH3-Omni-Comfy + H3's shared encoder / VAEs when missing (lib/fasth3Addon.js)
  { id: "fasth3", label: "FastH3 Omni (video model, 8 steps)",
    for: "The FastH3 Omni video style and StoryBoard Workflow: MiniMax H3's reference-to-video (pictures, videos, voices -> video with sound) distilled to 8 steps by FastVideo - several times faster than H3's own",
    needs: "ComfyUI 0.43 or later (its own nodes - no node pack; Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI); about the VRAM of MiniMax H3's int8 model (a 24-32 GB card). The weights carry the MiniMax H3 Community License",
    get size() { const M = require("./fasth3Addon"); return "the files you tick: " + M.ITEMS.map((i) => `${i.label.replace(/ \(.*\)$/, "")}${/\(/.test(i.label) ? " " + i.label.match(/\(([^)]*)\)/)[1] : ""} ${require("./aiFillAddon").fmt(i.files.reduce((s, id) => s + ((require("./setupModels").byId(id) || {}).size || 0), 0))}`).join(", ") + " (the shared H3 files only when missing)"; },
    status() { return require("./fasth3Addon").status(); },
    install(opts) { const picks = (opts || {}).items; return (log) => require("./fasth3Addon").install(log, picks); },
    remove() { return (log) => require("./fasth3Addon").remove(log); } },
  { id: "viggle", label: "Viggle (native)",
    for: "The native Viggle engine for character swaps without ComfyUI (the swap dialog's ⚙ Native)",
    needs: "an NVIDIA GPU; uses the ComfyUI model files it finds",
    size: "its own venv (~6 GB) + only the model files your ComfyUI does not have",
    external: true,
    status() {
      try { const s = require("../routes/native").statusView(); const j = s.job; return { installed: !!s.viggle.ready, note: s.viggle.note || (s.viggle.ready ? "ready" : "not installed"), busy: !!(j && (j.status === "queued" || j.status === "running")) }; }
      catch (e) { return { installed: false, note: "status unavailable: " + e.message }; }
    } },
];

function list() {
  return LIST.map((a) => {
    const s = a.status();
    const mine = J && J.id === a.id && J.state === "running";
    return { id: a.id, label: a.label, for: a.for, needs: a.needs, size: a.size, external: !!a.external,
             installed: !!s.installed, note: s.note || "", busy: !!(s.busy || mine),
             items: s.items || undefined,                      // 2.557.0: pick what to download (AI fill models)
             actions: a.external ? ["install"] : s.installed ? ["reinstall", "remove"] : ["install"] };
  });
}

function start(id, action, opts) {   // 2.557.0: opts {items} - what to download (an add-on with a list)
  const a = LIST.find((x) => x.id === id);
  if (!a) return { error: "no add-on " + id };
  if (a.external) {           // Viggle: its own installer + queue job
    const r = require("../routes/native").install({});
    return r.status >= 400 ? { error: (r.body && r.body.error) || "could not start" } : { ok: true, external: true, job: r.body };
  }
  if (action === "remove") return startJob(id, "remove", a.remove());
  return startJob(id, "install", a.install(opts || {}));
}

module.exports = { YUE2, LIST, list, start, startJob, job, busy, installYue2, torchIndexes, yueDir, yueVenv, yueCli, venvPy, _reset: () => { J = null; } };
