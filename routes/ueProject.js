// bitGen Studio — routes/ueProject.js (2.513.0): 🎮 Load UE project (lib/ueProject.js). Mounted from routes/index.js
// (never server.js).
//   GET  /api/ue/project            {current, recent, editor} (+ inspect of the current one when it is still there)
//   POST /api/ue/project/inspect    {path} -> what the project has (plugin, plugins on, the editor, Unreal running)
//   POST /api/ue/project/load       {path, install?, enable?, restart?, closeOthers?} -> the steps done
//   POST /api/ue/project/editor     {path} -> UnrealEditor's path set by hand
"use strict";
const express = require("express");
const uep = require("../lib/ueProject");

function mount(app) {
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/ue/project", async (_req, res) => {
    const c = uep.cfg(); let info = null;
    if (c.current) { try { info = await uep.inspect(c.current); } catch (e) { info = null; } }
    res.json({ ok: true, ...c, info });
  });
  app.post("/api/ue/project/inspect", express.json(), async (req, res) => { try { res.json({ ok: true, ...(await uep.inspect((req.body || {}).path)) }); } catch (e) { fail(res, e); } });
  app.post("/api/ue/project/load", express.json(), async (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...(await uep.load(b.path, { install: b.install !== false, enable: b.enable !== false, restart: b.restart !== false, closeOthers: !!b.closeOthers })) }); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/ue/project/editor", express.json(), (req, res) => { try { res.json({ ok: true, ...uep.setEditor((req.body || {}).path) }); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
