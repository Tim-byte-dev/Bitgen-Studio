// bitGen Studio — routes/features.js (2.593.0): Settings ▸ General ▸ Add-ons in the studio - Face fix, ControlNet.
// Mounted by routes/index.js (never server.js); the switches, the checks and the downloads are lib/featureAddons.js.
//   GET  /api/features              {features: {facefix, controlnet}, status: {id: {installed, missing, note}}}
//   POST /api/features {id, on, download?}  switch one on / off; ON = what it is missing starts downloading (Settings ▸ Add-ons
//                                   shows the job; download:false = only the switch) -> {features, queued: [ids]}
// A moment after start, every add-on that is on is checked the same way (FA.autoCheck).
"use strict";
const FA = require("../lib/featureAddons");

function view() {
  const status = {};
  for (const id of FA.IDS) {
    if (!FA.enabled(id)) continue;
    try { const s = FA.status(id); status[id] = { installed: s.installed, missing: s.missing, note: s.note }; }
    catch (e) { status[id] = { installed: false, missing: [], note: e.message }; }
  }
  return { features: FA.features(), status };
}

function mount(app) {
  app.get("/api/features", (_req, res) => res.json(view()));
  app.post("/api/features", (req, res) => {
    const b = req.body || {};
    const id = String(b.id || "");
    if (!FA.ADDONS[id]) return res.status(400).json({ error: "no such add-on " + id });
    FA.setEnabled(id, b.on === true);
    const queued = b.on === true && b.download !== false ? FA.ensure([id]) : [];   // download:false = switch only (the gate)
    res.json(Object.assign(view(), { queued }));
  });
  if (!process.env.BITGEN_NO_AUTOCHECK) {
    const t = setTimeout(() => { try { FA.autoCheck(); } catch (e) { console.error("[bitgen-studio] add-on check: " + e.message); } }, 8000);
    if (t.unref) t.unref();
  }
}
module.exports = { mount, view };
