// bitGen Studio — SETUP: the whole install, start to finish (2.331.0).
//
// Tim (verbatim): "create a windows 11 type installer for the package, on
// the first page offer comfyui, input with folder select button for existing
// comfyui package, comfyui nodes (if existing) if not existing install all
// the custom nodes used in this project, omnivoice, after installing all the
// packages offer a list of models that can be downloaded from HF that we use
// in this project, before the list have an input for hf token. if no hf
// token only download non-gated models. Do a gpu check, set up bitgen studio
// for the hardware the user is using. I would like the use to be able to
// start using bitgen studio immediately after setup with no further action
// needed" - and: "make it crossplatform".
//
// The wizard (electron/installer.html) and the headless CLI
// (scripts/setup-cli.js) BOTH drive this module - one engine, no
// PowerShell. Every step is an ensure (re-running repairs in place), every
// line goes to the caller's emit() AND <app>/setup.log.
//
//   detect()          the machine: GPU profile + the hardware plan, Python,
//                     git, what is installed, the default ComfyUI folder
//   inspectComfy(d)   an existing ComfyUI: valid? its python, the packs
//   install(plan, e)  python -> ComfyUI (new | existing) -> node packs ->
//                     settings for this hardware -> OmniVoice (+ whisper)
//                     -> llama.cpp -> a node import check
//   models(token)     the catalog, inspected live, pre-ticked for the GPU
//   download(ids, token, e)  the files, one after another, resumable
//   finish()          .setup-done - the app opens straight into the studio
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const X = require("./setupExec");
const Gpu = require("./setupGpu");
const Tune = require("./setupTune");
const Packs = require("./setupPacks");
const Comfy = require("./setupComfy");
const Models = require("./setupModels");
const Llama = require("./setupLlama");
const Hw = require("./hwPlan");                   // 2.519.0: the package for this computer

const ROOT = path.join(__dirname, "..");
const DONE = () => path.join(ROOT, ".setup-done");
const PENDING = () => path.join(ROOT, ".setup-pending");
let core = null;
const Core = () => core || (core = require("./core"));

/** The app's own portable tools (the installer's bootstrap puts them in
 *  runtime/) - first on PATH for everything setup starts. */
function runtimeDirs() {
  const r = path.join(ROOT, "runtime");
  return X.IS_WIN
    ? [path.join(r, "node"), path.join(r, "python"), path.join(r, "python", "Scripts"), path.join(r, "git", "cmd"),
       path.join(r, "ffmpeg", "bin"), path.join(r, "uv")]
    : [path.join(r, "node", "bin"), path.join(r, "python", "bin"), path.join(r, "ffmpeg"), path.join(r, "uv")];
}
function env() {
  const e = Object.assign({}, process.env, { PYTHONUNBUFFERED: "1", PIP_NO_INPUT: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const dirs = runtimeDirs().filter((d) => fs.existsSync(d));
  const key = Object.keys(e).find((k) => k.toUpperCase() === "PATH") || "PATH";
  e[key] = dirs.concat([e[key] || ""]).join(path.delimiter);
  return e;
}

function logFile(line, err) {
  try { fs.appendFileSync(path.join(ROOT, "setup.log"), (err ? "! " : "  ") + line + "\n"); } catch { /* never fatal */ }
}

/** The app's Python (config.python, the bootstrap's runtime python first). */
function appPython() {
  const cfgPy = String((Core().getConfig() || {}).python || "").trim();
  const cands = [cfgPy, X.which(X.IS_WIN ? "python" : "python3", runtimeDirs()), X.which("python", runtimeDirs())].filter(Boolean);
  return cands[0] || "";
}

async function pythonVersion(py) {
  let out = "";
  const code = await X.run(py, ["-c", "import sys; print('PYV', sys.version_info[0], sys.version_info[1])"],
    { log: (l) => { if (l.startsWith("PYV")) out = l; }, env: env() });
  const m = /PYV (\d+) (\d+)/.exec(out);
  return code === 0 && m ? { major: +m[1], minor: +m[2] } : null;
}

/* 2.355.0 (Tim: "give option in the initial install to install native viggle, show size to dl. if not
   selected then make viggle=2 in components.txt"): what installing Viggle (native) would download - its
   Python environment (~5 GB: CUDA torch + diffusers) and the model parts the ComfyUI folder does not
   already have (lib/nativeEngine: the files the ComfyUI workflows name are used, not downloaded). */
const VENV_GB = 5;
function vigglePlan(comfyDir, root) {
  const base = root || ROOT;
  try {
    const C = Core();
    const NE = require("./nativeEngine");
    const cfg = JSON.parse(JSON.stringify(C.getConfig() || {}));
    if (comfyDir) { cfg.engine = cfg.engine || {}; cfg.engine.comfy = { ...(cfg.engine.comfy || {}), dir: comfyDir }; }
    const r = NE.refreshConfig(cfg, { BASE: base, MODELS_DIR: C.MODELS_DIR, resolvePath: C.resolvePath, save: null,
      comfyExtra: () => { try { return require("./comfyPaths").read(); } catch { return {}; } } });
    const venv = fs.existsSync(r.p.python);
    const rd = NE.readiness(r.res, venv, "viggle");
    const fromComfy = Object.values(r.res).filter((x) => x.workflow && (x.how === "comfy" || NE.trusted(x))).map((x) => x.workflow.name);
    const value = (require("./components").read(base) || {})["viggle native"] || "";
    return { installed: rd.ready, gb: rd.gb, venv_gb: venv ? 0 : VENV_GB, total_gb: Math.round((rd.gb + (venv ? 0 : VENV_GB)) * 10) / 10,
             from_comfy: fromComfy, value };
  } catch (e) {
    return { installed: false, gb: 0, venv_gb: VENV_GB, total_gb: 0, from_comfy: [], value: "", error: e.message };
  }
}

/** 2.355.0: the wizard's answer -> components.txt ("viggle native=0" = install on the next start, 2 = do not). */
function viggleChoice(want, say, root) {
  const base = root || ROOT;
  const Cm = require("./components");
  const cur = (Cm.read(base) || {})["viggle native"];
  const plan = vigglePlan("", base);
  const value = plan.installed ? "1" : (want ? "0" : "2");
  Cm.write(base, { "viggle native": value });
  if (say) say(value === "1" ? "[ok] Viggle (native) is already installed (components.txt: viggle native=1)"
    : value === "0" ? `[ok] Viggle (native) installs when the studio opens - ~${plan.total_gb} GB (components.txt: viggle native=0; follow it in the queue)`
    : "[ok] Viggle (native) is not installed (components.txt: viggle native=2 - the swap dialog's ⚙ can install it later)");
  return { value, was: cur, plan };
}

/** 2.519.0: the hardware the wizard uses - the answers it asked for (lib/hwPlan.fromAnswers) on top of what was found */
function hardware(answers) {
  const found = Gpu.detect();
  const a = answers && typeof answers === "object" ? answers : null;
  return a && Object.keys(a).some((k) => a[k] !== "" && a[k] != null) ? Hw.fromAnswers(a, process.platform, found) : found;
}
/** 2.519.0: the package page - every package, what this computer can use with it, its download */
function packages(answers, opts) {
  const p = hardware(answers);
  return Object.assign(Hw.plan(p, Models.CATALOG, { omnivoice: !(opts && opts.omnivoice === false) }), { gpu: p, plan: Tune.summary(p) });
}

/** The machine, for the wizard's first page. */
function detect() {
  const gpu = Gpu.detect();
  const cfg = Core().getConfig() || {};
  const c = ((cfg.engine || {}).comfy || {});
  const configured = String(c.dir || "").trim();
  let existing = null;
  if (configured) existing = Comfy.inspectDir(path.isAbsolute(configured) ? configured : path.join(ROOT, configured));
  return {
    platform: process.platform, arch: process.arch,
    gpu, plan: Tune.summary(gpu), recommended: Tune.recommend(gpu, { omnivoice: true }),
    hw: Hw.plan(gpu, Models.CATALOG, { omnivoice: true }), gpu_list: Hw.GPUS,      // 2.519.0: the packages + the cards to pick from
    python: appPython(), git: X.which("git", runtimeDirs()),
    ffmpeg: X.which("ffmpeg", runtimeDirs()),
    comfy: { configured: configured ? (existing && existing.ok ? existing.root : configured) : "",
             defaultDir: path.join(ROOT, "comfy") },
    omnivoice: fs.existsSync(require("./venv").venvReady("omnivoice", ((cfg.tts || {}).omnivoice || {}).venv).python),
    llama: fs.existsSync(path.join(ROOT, "llama-cpp", X.IS_WIN ? "llama-server.exe" : "llama-server")),
    viggle: vigglePlan(configured ? (existing && existing.ok ? existing.root : configured) : ""),   // 2.355.0
    done: fs.existsSync(DONE()),
  };
}

/** An existing ComfyUI the user picked: valid + which packs it lacks. */
function inspectComfy(dir) {
  const r = Comfy.inspectDir(dir);
  if (!r.ok) return r;
  return { ...r, packs: Packs.status(r.customNodes).map((p) => ({ id: p.id, folder: p.folder, for: p.for, present: p.present, where: p.where })),
           viggle: vigglePlan(r.root) };   // 2.355.0: this ComfyUI's Viggle files lower the download
}

/** Where a folder goes in Settings: relative when inside the app. */
function settingDir(abs) {
  const rel = path.relative(ROOT, abs);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : abs;
}

/** The engine installers in worker.py (OmniVoice / faster-whisper), run
 *  straight from a job file - the SAME code the app's Settings buttons run. */
async function workerInstall(which, gpu, log) {
  const C = Core();
  const cfg = C.getConfig();
  const V = require("./venv");
  const sub = which === "omnivoice" ? ((cfg.tts || {}).omnivoice || {}).venv : (cfg.asr || {}).venv;
  const dir = V.venvDir(which, sub);
  if (fs.existsSync(V.venvPython(dir))) { log(`[ok] ${which} already installed (${dir})`, false); return { ok: true, skipped: true }; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgjob-"));
  const job = {
    params: { mode: `install_${which}`, venv: dir, torch_index: gpu.cuda ? "" : "cpu", source: "",
              device: gpu.cuda ? (which === "whisper" ? "auto" : "cuda") : "cpu",
              cuda_capability: gpu.cc || 0, weights_repo: "", weights_dir: "", hf_token: "" },
    config: cfg, app_dir: ROOT, output_dir: tmp,
  };
  const jf = path.join(tmp, "job.json");
  fs.writeFileSync(jf, JSON.stringify(job));
  const code = await X.run(appPython(), ["-u", path.join(ROOT, "misc", "worker.py"), jf], { log, env: env(), cwd: ROOT });
  fs.rmSync(tmp, { recursive: true, force: true });
  return code === 0 ? { ok: true } : { ok: false, error: `${which} install exited ${code} - see the log` };
}

/** ComfyUI's own import check: loads every custom node and exits. */
async function nodeCheck(comfy, log) {
  if (!comfy.python) return { ok: true, skipped: true, failed: [] };
  const failed = [];
  const code = await X.run(comfy.python, ["-s", path.join(comfy.main, "main.py"), "--quick-test-for-ci", "--dont-print-server"],
    { log: (l, e) => { log(l, e); const m = /IMPORT FAILED\)?:?\s*(.+)$/.exec(l); if (m) failed.push(path.basename(m[1].trim())); },
      env: env(), cwd: comfy.main });
  return { ok: code === 0 && !failed.length, code, failed };
}

/**
 * THE INSTALL. plan = {comfy: {mode: "new"|"existing", dir}, omnivoice,
 * whisper, llama}. emit({type: "step"|"log"|"done", ...}). -> results
 */
async function install(plan, emit) {
  const say = (line, err) => { logFile(line, err); emit({ type: "log", line, err: !!err }); };
  const step = (id, state, extra) => emit(Object.assign({ type: "step", id, state }, extra || {}));
  logFile(`==== setup ${new Date().toISOString()} ${JSON.stringify(plan)} ====`);
  const p = plan || {};
  const gpu = hardware(p.hw);                                         // 2.519.0: the answers when setup asked
  const pkg = Hw.ORDER.includes(p.package) ? p.package : "";          // 2.519.0: "editor" = no ComfyUI, no models
  const results = { ok: true, steps: {}, warnings: [] };
  const fail = (id, error) => { results.ok = false; results.steps[id] = { ok: false, error }; step(id, "err", { error }); say(`[error] ${error}`, true); };
  const E = env();

  // 1. Python
  step("python", "run");
  const py = appPython();
  const v = py ? await pythonVersion(py) : null;
  if (!v || v.major < 3 || (v.major === 3 && v.minor < 10)) {
    fail("python", py ? `Python 3.10+ is needed (${py} is ${v ? v.major + "." + v.minor : "not runnable"})`
      : "no Python found - the installer's bootstrap puts one in runtime/python");
    emit({ type: "done", ...results });
    return results;
  }
  say(`[ok] Python ${v.major}.${v.minor} (${py})`);
  step("python", "ok");

  // 2. ComfyUI (2.519.0: not for the Editor package - no AI engine, no models)
  const git = X.which("git", runtimeDirs());
  let comfy = null;
  const noComfy = pkg === "editor" || (p.comfy || {}).mode === "none";
  if (noComfy) say("[ok] the Editor package: no ComfyUI and no models - Settings -> Models adds AI later");
  else step("comfy", "run");
  if (noComfy) { /* nothing to install */ }
  else if ((p.comfy || {}).mode === "existing") {
    comfy = Comfy.inspectDir(p.comfy.dir);
    if (!comfy.ok) { fail("comfy", comfy.error); emit({ type: "done", ...results }); return results; }
    say(`[ok] using the ComfyUI in ${comfy.root}` + (comfy.python ? ` (python: ${comfy.how})` : " - its Python was not found; node pack requirements cannot be installed"));
    if (!comfy.python) results.warnings.push("ComfyUI's Python was not found: the node packs were added but their requirements were not installed");
  } else {
    comfy = await Comfy.installNew((p.comfy || {}).dir || path.join(ROOT, "comfy"), { git, python: py, gpu, log: say, env: E });
    if (!comfy.ok) { fail("comfy", comfy.error); emit({ type: "done", ...results }); return results; }
  }
  if (comfy) { results.comfy = { root: comfy.root, main: comfy.main, python: comfy.python }; step("comfy", "ok"); }

  // 3. node packs
  if (comfy) step("packs", "run");
  const miss = comfy ? Packs.missing(comfy.customNodes) : [];
  if (comfy) {
  say(miss.length ? `[..] ${miss.length} node pack(s) to add: ${miss.map((m) => m.folder).join(", ")}` : "[ok] every node pack is already there");
  const packFails = [];
  for (const pack of miss) {
    emit({ type: "sub", id: "packs", label: pack.folder });
    let r;                                              // 2.540.2: one pack can never stop the rest
    try { r = await Packs.install(pack, comfy.customNodes, { git, python: comfy.python, log: say, env: E }); }
    catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    if (!r.ok) { packFails.push(pack.folder); say(`[warn] ${pack.folder}: ${r.error}`, true); }
  }
  if (packFails.length) results.warnings.push(`node packs that did not install: ${packFails.join(", ")} (ComfyUI-Manager can retry them)`);
  results.steps.packs = { ok: !packFails.length, failed: packFails };
  step("packs", packFails.length ? "warn" : "ok");
  }

  // 4. Settings for THIS hardware (+ the ComfyUI folder, started with the app)
  step("settings", "run");
  const C = Core();
  const cfg = C.getConfig();
  Tune.merge(cfg, Tune.patch(gpu, { when: new Date().toISOString(), python: py }));
  cfg.engine = cfg.engine || {};
  cfg.engine.comfy = cfg.engine.comfy || {};
  if (comfy) { cfg.engine.comfy.dir = settingDir(comfy.root); cfg.engine.comfy.autostart = true; }
  else cfg.engine.comfy.autostart = false;                            // 2.519.0: the Editor package has no ComfyUI to start
  // 2.519.0: the package and the hardware it was chosen for (what the wizard asked, when it asked)
  cfg.setup = Object.assign({}, cfg.setup || {}, { package: pkg || (comfy ? "full" : "editor"),
    hw: { gpu: gpu.main ? gpu.main.name : gpu.other ? gpu.other.name : "", vram_gb: gpu.vram_gb || (gpu.other ? gpu.other.vram_gb : 0), ram_gb: gpu.ram_gb,
          cpu: (gpu.cpu && gpu.cpu.model) || "", asked: !!gpu.manual } });
  C.setConfig(cfg);
  for (const l of Tune.summary(gpu)) say(`[ok] ${l}`);
  if (comfy) say(`[ok] Settings -> ComfyUI folder: ${cfg.engine.comfy.dir} (starts with the app)`);
  if (pkg) say(`[ok] package: ${(Hw.PACKAGES.find((k) => k.id === pkg) || {}).label || pkg}`);
  // 2.355.0: the Viggle (native) box -> components.txt (0 = the first start installs it, 2 = do not install)
  if (typeof p.viggle === "boolean") results.viggle = viggleChoice(p.viggle, say);
  step("settings", "ok");

  // 5. OmniVoice (+ faster-whisper)
  for (const which of ["omnivoice", "whisper"]) {
    if (!p[which]) continue;
    step(which, "run");
    const r = await workerInstall(which, gpu, say);
    if (!r.ok) { results.warnings.push(`${which}: ${r.error}`); step(which, "warn", { error: r.error }); }
    else step(which, "ok");
  }

  // 6. llama.cpp (the assistant's engine)
  if (p.llama !== false) {
    step("llama", "run");
    const r = await Llama.install(ROOT, { log: say, env: E });
    if (!r.ok) { results.warnings.push(`llama.cpp: ${r.error}`); step("llama", "warn", { error: r.error }); }
    else step("llama", "ok");
  }

  // 7. does ComfyUI load every pack?
  if (p.check !== false && comfy) {
    step("check", "run");
    const r = await nodeCheck(comfy, say);
    if (r.failed && r.failed.length) {
      results.warnings.push(`these node packs failed to import in ComfyUI: ${r.failed.join(", ")} - update ComfyUI and the pack (ComfyUI-Manager)`);
      step("check", "warn");
    } else step("check", r.ok || r.skipped ? "ok" : "warn");
  }

  results.paths = { comfyModels: comfy ? comfy.models : "", app: ROOT };
  results.package = pkg || "";
  try { fs.writeFileSync(path.join(ROOT, "setup.json"), JSON.stringify({ when: new Date().toISOString(), plan: p, package: pkg || "", gpu: { name: gpu.main && gpu.main.name, vram_gb: gpu.vram_gb, tier: gpu.tier, asked: !!gpu.manual }, comfy: results.comfy, warnings: results.warnings }, null, 2)); }
  catch { /* the record is a courtesy */ }
  emit({ type: "done", ...results });
  return results;
}

/** The ComfyUI models folder + app root for the model page. */
function modelPaths() {
  const cfg = Core().getConfig() || {};
  const dir = String(((cfg.engine || {}).comfy || {}).dir || "").trim();
  const r = dir ? Comfy.inspectDir(path.isAbsolute(dir) ? dir : path.join(ROOT, dir)) : { ok: false };
  return { comfyModels: r.ok ? r.models : path.join(ROOT, "comfy", "ComfyUI", "models"), app: ROOT };
}

/** The model page: every catalog entry, inspected live, the right ones pre-ticked. */
async function models(token, opts) {
  const o = opts || {};
  const gpu = hardware(o.hw);                                          // 2.519.0: the answers when setup asked
  const paths = modelPaths();
  const rows = await Models.inspect(null, token, paths);
  // 2.519.0: the chosen package ticks its models; without one, the hardware's (2.331.0)
  const rec = new Set(Hw.ORDER.includes(o.package) ? Hw.packageModels(gpu, o.package, { omnivoice: !!o.omnivoice })
    : Tune.recommend(gpu, { omnivoice: !!o.omnivoice }));
  return { groups: Models.CATALOG.groups, paths,
           rows: rows.map((r) => ({ ...r, ticked: r.available && !r.present && rec.has(r.id), recommended: rec.has(r.id) })) };
}

/** Download the ticked ids one after another; settle Settings for what landed. */
async function download(ids, token, emit, opts) {
  const engine = String((opts && opts.engine) || "auto");               // 2.341.0: auto | hf | builtin
  const force = !!(opts && opts.force);                                  // 2.601.0: ⟳ Download again - a downloaded file is fetched again
  const say = (line, err) => { logFile(line, err); emit({ type: "log", line, err: !!err }); };
  const paths = modelPaths();
  const want = new Set(ids || []);
  // a vision model and its projector only make sense together
  for (const m of Models.CATALOG.models) if (want.has(m.id) && m.with) want.add(m.with);
  const rows = (await Models.inspect(Models.CATALOG.models.filter((m) => want.has(m.id)), token, paths));
  const done = [], failed = [];
  for (const r of rows) {
    if (!r.available) { failed.push({ id: r.id, error: r.why }); emit({ type: "file", id: r.id, state: "err", error: r.why }); say(`[skip] ${r.label}: ${r.why}`, true); continue; }
    emit({ type: "file", id: r.id, state: "run", got: 0, total: r.size });
    let last = 0;
    const res = await Models.download(r, { token, paths, python: appPython(), env: env(), log: say, engine, force, dirs: runtimeDirs(),
      onProgress: (pr) => { const now = Date.now(); if (now - last > 400 || pr.got === pr.total) { last = now; emit({ type: "file", id: r.id, state: "run", got: pr.got, total: pr.total }); } } });
    if (res.ok) { done.push(r); emit({ type: "file", id: r.id, state: "ok" }); }
    else { failed.push({ id: r.id, error: res.error }); emit({ type: "file", id: r.id, state: "err", error: res.error }); say(`[error] ${r.label}: ${res.error}`, true); }
  }
  const patch = Models.settingsFor(done, paths);
  if (Object.keys(patch).length) {
    const C = Core();
    C.setConfig(Tune.merge(C.getConfig(), patch));
    if (patch.llm) say(`[ok] the assistant loads ${patch.llm.last_file}`);
    if (patch.captioner) say("[ok] the vision model is set up for pictures in the prompt");
  }
  const out = { type: "done", ok: !failed.length, done: done.map((d) => d.id), failed };
  emit(out);
  return out;
}

/** Free bytes on the drive the models go to (the models folder or its nearest existing parent). */
function freeSpace() {
  let d = modelPaths().comfyModels;
  while (d && !fs.existsSync(d)) { const up = path.dirname(d); if (up === d) break; d = up; }
  try { const s = fs.statfsSync(d); return s.bavail * s.bsize; } catch { return 0; }
}

/** 2.341.0: is the Hugging Face CLI there? -> {found, how, version, python} */
async function hfCli() {
  const HFC = require("./hfCli");
  const py = appPython();
  const cli = await HFC.find(py, runtimeDirs(), env());
  return { found: !!cli, how: cli ? cli.how : "", version: await HFC.version(py, env()), python: py || "" };
}
/** 2.341.0: pip install the Hugging Face CLI into the app's Python. */
async function hfCliInstall(emit) {
  const say = (line, err) => { logFile(line, err); if (emit) emit({ type: "log", line, err: !!err }); };
  const r = await require("./hfCli").install(appPython(), { log: say, env: env() });
  say(r.ok ? `[ok] Hugging Face CLI ready (huggingface_hub ${r.version})` : `[error] ${r.error}`, !r.ok);
  return { ...r, ...(await hfCli()) };
}

/** Setup is over: the next start opens the studio (and ComfyUI with it). */
function finish() {
  try { fs.writeFileSync(DONE(), new Date().toISOString() + "\n"); } catch { /* read-only app folder */ }
  try { fs.rmSync(PENDING(), { force: true }); } catch { /* none */ }
  return { ok: true };
}

/** Should the app open the setup wizard first? (the installer leaves
 *  .setup-pending; H3_SETUP=1 forces; otherwise the old no-ComfyUI gate). */
function wanted(fallback) {
  if (process.env.H3_SETUP === "1") return true;
  if (fs.existsSync(PENDING())) return true;
  if (fs.existsSync(DONE())) return false;
  return !!fallback;
}

module.exports = { ROOT, runtimeDirs, env, appPython, detect, hardware, packages, inspectComfy, settingDir, workerInstall, nodeCheck, vigglePlan, viggleChoice, VENV_GB,
                   install, modelPaths, models, download, finish, wanted, hfCli, hfCliInstall, freeSpace };
