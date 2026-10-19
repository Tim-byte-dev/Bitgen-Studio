"use strict";
/**
 * bitGen Studio — Viggle (native) status + install for the swap dialog's ⚙ (2.351.0; 2.352.0: a view of
 * the shared native engine - routes/native.js).
 *
 *   GET  /api/viggle-native/status    ready? what is missing (the native engine's Viggle readiness)
 *   POST /api/viggle-native/config    {dir?} where the native engine's weights live
 *   POST /api/viggle-native/check     🔍 read the ComfyUI files' headers -> use the ones the engine can read
 *   POST /api/viggle-native/install   the native engine's install job, for what Viggle still needs
 */
const core = require("../lib/core");
const NE = require("../lib/nativeEngine");

function native() { return require("./native"); }

function statusView() {
  const s = native().statusView();
  const v = s.viggle;
  const comps = s.components.filter((c) => c.need.includes("viggle"));
  return { ready: v.ready, venv_ready: s.venv_ready, weights_ready: !v.missing.length, missing: v.labels, note: v.note,
           download_gb: v.gb, root: s.paths.root, dir_setting: s.settings.dir, job: s.job,
           // 2.353.0: workflow = the file Tim's ComfyUI workflow names for it (used instead of a download)
           sources: comps.map((c) => ({ id: c.id, label: c.label, how: c.how, file: c.file || "",
                                        workflow: c.workflow ? c.workflow.name : "", workflow_from: c.workflow ? c.workflow.from : "" })) };
}

function mount(app) {
  app.get("/api/viggle-native/status", (_req, res) => res.json(statusView()));

  app.post("/api/viggle-native/config", (req, res) => {
    const b = req.body || {};
    const config = core.getConfig();
    config.native = { ...NE.defaults(), ...(config.native || {}), ...NE.settingsSafe({ dir: typeof b.dir === "string" ? b.dir : undefined }) };
    core.setConfig(config);
    res.json(statusView());
  });

  // 2.352.0: 🔍 use my ComfyUI files - the header check, then the sources are chosen again
  app.post("/api/viggle-native/check", async (_req, res) => {
    const r = await native().runCheck();
    if (r.error) return res.status(400).json({ error: r.error, ...statusView() });
    res.json({ checked: r.checked || 0, ...statusView() });
  });

  app.post("/api/viggle-native/install", (req, res) => {
    const r = native().install({ use: "viggle", torch_index: (req.body || {}).torch_index });
    res.status(r.status).json(r.status === 200 ? { ...r.body, ...statusView() } : r.body);
  });
}

module.exports = { mount, statusView };
