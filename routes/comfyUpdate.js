// bitGen Studio — routes/comfyUpdate.js (2.573.0): ⤓ Update ComfyUI (Settings ▸ ComfyUI ▸ Engine ▸ ⟳ ComfyUI updates).
// Mounted by routes/index.js (never server.js); the work is lib/comfyUpdate.js.
//   GET  /api/comfy/update/info              {ok, error, root, main, mode, version, channel}
//   POST /api/comfy/update/check   {fetch?, channel?}  {current, latest, master, newer, behind, channel, mode, error}
//   POST /api/comfy/update/start   {channel?, force?}  -> {ok} | 409 {error}   (one at a time)
//   GET  /api/comfy/update/job?from=N        {job: {state, from, to, mode, channel, restarted, error}, lines[], next}
//   POST /api/comfy/update/channel {channel}  "latest" | "stable" - saved (config.update.comfy_channel)
"use strict";
const U = require("../lib/comfyUpdate");
const core = require("../lib/core");

function mount(app) {
  app.get("/api/comfy/update/info", (_req, res) => {
    const W = U.where();
    res.json({ ok: W.ok, error: W.error || "", root: W.root || "", main: W.main || "", version: W.version || "",
      mode: !W.ok ? "" : W.updater ? "portable" : W.git ? "git" : "other", channel: U.channelOf(core.getConfig()) });
  });
  app.post("/api/comfy/update/check", async (req, res) => {
    const b = req.body || {};
    try { res.json(await U.check({ fetch: b.fetch !== false, channel: b.channel })); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post("/api/comfy/update/start", (req, res) => {
    const b = req.body || {};
    const r = U.start({ channel: b.channel, force: b.force === true });
    if (r.error) return res.status(409).json(r);
    res.json(r);
  });
  app.get("/api/comfy/update/job", (req, res) => {
    const j = U.job();
    if (!j) return res.json({ job: null, lines: [], next: 0 });
    const from = Math.max(0, Math.min(j.lines.length, parseInt(req.query.from, 10) || 0));
    res.json({ job: { state: j.state, from: j.from, to: j.to, mode: j.mode, channel: j.channel, restarted: j.restarted, error: j.error },
               lines: j.lines.slice(from), next: j.lines.length });
  });
  app.post("/api/comfy/update/channel", (req, res) => {
    const r = U.setChannel(String((req.body || {}).channel || ""));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
}
module.exports = { mount };
