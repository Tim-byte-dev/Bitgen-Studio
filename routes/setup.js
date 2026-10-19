// bitGen Studio — THE MODEL CATALOG INSIDE THE STUDIO (2.341.0). Mounted from
// routes/index.js (never server.js).
//
// Tim: "yes please add these downloads to setup, also add the hf cli to
// download direct from hf". The first-run wizard's Models page
// (electron/installer.html) only ran once; this is the same engine
// (lib/setupRun: models / download / hfCli / hfCliInstall) for a studio that
// is already installed - Settings -> Models -> ⤓ Model catalog
// (static/modelsdlg.js).
//
//   POST /api/setup/token          {token}  -> {ok, name} | {ok:false, error}
//   POST /api/setup/models         {token}  -> {groups, paths, rows, free}
//   GET  /api/setup/hfcli                    -> {found, how, version, python}
//   POST /api/setup/hfcli/install            pip install huggingface_hub[hf_xet]
//                                            (in the background - GET /state)
//   POST /api/setup/download       {ids, token, engine: auto|hf|builtin}
//                                            one run at a time, in the background
//   GET  /api/setup/state                    {busy, what, files{id:{state,got,total,error}},
//                                             log[], result, hf}
// The token is used for the run and never written to disk.
//
// 2.520.0 (Tim: "go with all 3 of your recommendations"):
//   GET  /api/setup/packages?hw=<json>        what THIS computer can use with each package (lib/hwPlan) + the
//                                             package installed (config.setup.package) + the hardware answers kept
//   POST /api/setup/answers   {hw}            keep the hardware answers (config.setup.answers)
//   POST /api/setup/upgrade   {package, hw?, token?}   one click from the package you have to a bigger one: the
//                                             install steps it needs (ComfyUI + its node packs when there is none yet,
//                                             the assistant / voices / speech) then the package's models - in the
//                                             background, followed with GET /state (what: "upgrade")
"use strict";
const trap = require("../lib/trap");

const S = () => require("../lib/setupRun");
const LOG_MAX = 300;
const state = { busy: false, what: "", files: {}, log: [], result: null, hf: null, started: 0 };

function emit(e) {
  if (!e) return;
  if (e.type === "log") {
    state.log.push({ line: String(e.line || "").slice(0, 500), err: !!e.err, t: Date.now() });
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  } else if (e.type === "file") {
    state.files[e.id] = { state: e.state, got: e.got || 0, total: e.total || 0, error: e.error || "" };
  } else if (e.type === "done") state.result = { ok: e.ok, done: e.done || [], failed: e.failed || [] };
}
function begin(what) {
  state.busy = true; state.what = what; state.started = Date.now(); state.result = null;
  if (what === "download") state.files = {};
}
const view = () => ({ busy: state.busy, what: state.what, files: state.files, log: state.log.slice(-120),
                      result: state.result, hf: state.hf, started: state.started });

function mount(app) {
  app.post("/api/setup/token", trap.guard(async (req, res) => {
    res.json(await require("../lib/setupModels").checkToken(String((req.body || {}).token || "")));
  }));

  app.post("/api/setup/models", trap.guard(async (req, res) => {
    const r = await S().models(String((req.body || {}).token || "").trim());
    res.json({ ...r, free: S().freeSpace() });
  }));

  app.get("/api/setup/hfcli", trap.guard(async (_req, res) => {
    state.hf = await S().hfCli();
    res.json(state.hf);
  }));

  app.post("/api/setup/hfcli/install", trap.guard((_req, res) => {
    if (state.busy) return res.status(409).json({ error: `busy: ${state.what} is running - wait for it` });
    begin("hfcli");
    S().hfCliInstall(emit).then((r) => { state.hf = r; }, (e) => emit({ type: "log", line: "[error] " + (e && e.message || e), err: true }))
      .finally(() => { state.busy = false; });
    res.json({ ok: true, ...view() });
  }));

  app.post("/api/setup/download", trap.guard((req, res) => {
    const b = req.body || {};
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: "tick at least one model" });
    if (state.busy) return res.status(409).json({ error: `busy: ${state.what} is running - wait for it` });
    const engine = ["auto", "hf", "builtin"].includes(b.engine) ? b.engine : "auto";
    begin("download");
    for (const id of ids) state.files[id] = { state: "wait", got: 0, total: 0, error: "" };
    S().download(ids, String(b.token || "").trim(), emit, { engine })
      .catch((e) => { emit({ type: "log", line: "[error] " + (e && e.message || e), err: true }); state.result = { ok: false, done: [], failed: [{ id: "*", error: String(e && e.message || e) }] }; })
      .finally(() => { state.busy = false; });
    res.json({ ok: true, ...view() });
  }));

  app.get("/api/setup/state", (_req, res) => res.json(view()));

  /* 2.520.0: the in-app "This computer & package" (static/hwpanel.js) */
  const answersOf = (q) => {
    if (q && typeof q === "object") return q;
    try { const a = JSON.parse(String(q || "")); if (a && typeof a === "object") return a; } catch { /* none */ }
    const cfg = require("../lib/core").getConfig() || {};
    return ((cfg.setup || {}).answers) || null;
  };
  app.get("/api/setup/packages", trap.guard((req, res) => {
    const cfg = require("../lib/core").getConfig() || {};
    const pk = S().packages(answersOf(req.query.hw), { omnivoice: true });
    const comfyDir = String(((cfg.engine || {}).comfy || {}).dir || "").trim();
    res.json(Object.assign(pk, { installed: ((cfg.setup || {}).package) || (comfyDir ? "full" : ""), answers: ((cfg.setup || {}).answers) || null,
      comfy: comfyDir, busy: state.busy, what: state.what, gpu_list: require("../lib/hwPlan").GPUS }));
  }));
  app.post("/api/setup/answers", trap.guard((req, res) => {
    const C = require("../lib/core"), cfg = C.getConfig();
    const hw = (req.body || {}).hw;
    cfg.setup = Object.assign({}, cfg.setup || {}, { answers: hw && typeof hw === "object" ? hw : null });
    C.setConfig(cfg);
    res.json({ ok: true, answers: cfg.setup.answers });
  }));
  app.post("/api/setup/upgrade", trap.guard((req, res) => {
    const b = req.body || {};
    const Hw = require("../lib/hwPlan");
    if (!Hw.ORDER.includes(b.package) || b.package === "editor") return res.status(400).json({ error: "pick the package to move to" });
    if (state.busy) return res.status(409).json({ error: `busy: ${state.what} is running - wait for it` });
    const C = require("../lib/core"), cfg = C.getConfig();
    const hw = answersOf(b.hw);
    const dir = String(((cfg.engine || {}).comfy || {}).dir || "").trim();
    const abs = dir ? C.resolvePath(dir) : "";
    const plan = { package: b.package, hw: hw || undefined, comfy: abs ? { mode: "existing", dir: abs } : { mode: "new", dir: require("path").join(C.BASE, "comfy") },
                   omnivoice: true, whisper: true, llama: true, check: true };
    const token = String(b.token || ((cfg.hf || {}).token) || "").trim();
    begin("upgrade"); state.files = {};
    emit({ type: "log", line: `[..] moving to the ${(Hw.PACKAGES.find((k) => k.id === b.package) || {}).label} package` + (abs ? ` (your ComfyUI in ${abs})` : " - ComfyUI is installed first") });
    (async () => {
      const r = await S().install(plan, emit);
      if (!r.ok && ((r.steps.python && !r.steps.python.ok) || (r.steps.comfy && !r.steps.comfy.ok))) { state.result = { ok: false, done: [], failed: [{ id: "install", error: "the install stopped - the log says why" }] }; return; }
      const m = await S().models(token, { omnivoice: true, package: b.package, hw: hw || undefined });
      const ids = m.rows.filter((x) => x.ticked).map((x) => x.id);
      emit({ type: "log", line: `[..] ${ids.length} model file(s) for the package` + (token ? "" : " (no Hugging Face token: the gated ones are skipped)") });
      for (const id of ids) state.files[id] = { state: "wait", got: 0, total: 0, error: "" };
      if (ids.length) await S().download(ids, token, emit, { engine: "auto" });
      else state.result = { ok: true, done: [], failed: [] };
      // the package is in (a model that did not download can be fetched later from Model downloads)
      const c2 = C.getConfig(); c2.setup = Object.assign({}, c2.setup || {}, { package: b.package }); C.setConfig(c2);
      emit({ type: "log", line: `[ok] the ${b.package} package is installed` });
    })().catch((e) => { emit({ type: "log", line: "[error] " + (e && e.message || e), err: true }); state.result = { ok: false, done: [], failed: [{ id: "*", error: String(e && e.message || e) }] }; })
      .finally(() => { state.busy = false; });
    res.json({ ok: true, ...view() });
  }));
}

module.exports = { mount, emit, state };
