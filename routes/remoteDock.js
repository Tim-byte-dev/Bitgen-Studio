// bitGen Studio — routes/remoteDock.js (2.754.0): the Remote generation docker (static/remotedock.js) and Settings ▸ Remote
// generation ▸ Use remote generation. Mounted from routes/index.js.
//   GET  /api/remotegen                       {enabled, shortcuts: [{id, name, deploy, page}], explore, max}
//   POST /api/remotegen/enabled   {on: true | false | null}   on / off (null = never chosen) -> /api/gpusplit's view
//   POST /api/remotegen/shortcuts {add: {name, link}} | {remove: id}   the pod shortcuts (lib/podShortcuts.js)
"use strict";
const G = require("../lib/gpuSplit");
const P = require("../lib/podShortcuts");

function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/remotegen", wrap(() => ({ enabled: G.enabled(), shortcuts: P.list(), explore: P.EXPLORE, max: P.MAX })));
  app.post("/api/remotegen/enabled", wrap(async (req) => { const MS = require("../lib/modeSwitch"), before = MS.modeOf(), on = (req.body || {}).on; const v = await G.setEnabled(on === null ? null : !!on); return Object.assign({}, v, { mode_switch: await MS.after(before) }); }));   // 2.766.2
  app.post("/api/remotegen/shortcuts", wrap((req) => ({ shortcuts: P.change(req.body || {}) })));
}
module.exports = { mount };
