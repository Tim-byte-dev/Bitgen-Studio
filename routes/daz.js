// bitGen Studio — routes/daz.js (2.405.0): the Daz Studio bridge (lib/dazBridge.js). Mounted from routes/index.js
// (never server.js).
//
//   GET  /api/daz/ping                  {ok, app, version, project, blender}   the bridge's "Test connection"
//   POST /api/daz/send   {kind, ...}    render | picture | scene | figure (paths of the files Daz wrote) -> the item,
//                                        answered when it is finished (up to 5 minutes, else "working")
//   GET  /api/daz/inbox?since=          {seq, items}                           what the page shows / the merge dialog
//   GET  /api/daz/item/:id
//   POST /api/daz/merge  {id, names, camera, range}                            the merge dialog's Merge
//   POST /api/daz/open   {id}                                                  "Open on its own"
//   POST /api/daz/dismiss {id}
//   2.461.0 - the EXPERIMENTAL live link (lib/dazLive.js; Daz runs "bitGen Live Link"):
//   GET  /api/daz/live                  {connected, last, info: {figure, bones, camera}, queued}   the page's status
//   POST /api/daz/live/cmd   {type: view | pose | reset, ...}                                    the page queues one
//   POST /api/daz/live/poll  {since, info}  -> {seq, cmds}                                        Daz asks (about 1 / s)
//   POST /api/daz/live/clear  -> {dropped}   (2.618.0) the commands still waiting dropped - their 3D layer was deleted / hidden
"use strict";
const daz = require("../lib/dazBridge");
const live = require("../lib/dazLive");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "8mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ ok: false, error: String((e && e.message) || e) });
  app.get("/api/daz/ping", (_req, res) => res.json(daz.ping()));
  app.post("/api/daz/send", J, async (req, res) => {
    try {
      const r = daz.send(req.body || {});
      const wait = Math.max(0, Math.min(300000, +((req.body || {}).wait_ms) || 300000));
      const done = await Promise.race([r.finished, new Promise((ok) => setTimeout(() => ok(null), wait))]);
      const it = done || daz.find(r.item.id);
      res.status(it.state === "error" ? 400 : 200).json({ ok: it.state !== "error", ...it, error: it.state === "error" ? it.message : undefined });
    } catch (e) { fail(res, e); }
  });
  app.get("/api/daz/inbox", (req, res) => res.json(daz.inbox(req.query.since)));
  app.get("/api/daz/item/:id", (req, res) => { try { res.json(daz.find(req.params.id)); } catch (e) { fail(res, e); } });
  app.post("/api/daz/merge", J, async (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...(await daz.merge(b.id, { names: b.names, camera: b.camera, range: b.range })) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/daz/open", J, async (req, res) => { try { res.json({ ok: true, ...(await daz.openItem((req.body || {}).id)) }); } catch (e) { fail(res, e); } });
  app.post("/api/daz/dismiss", J, (req, res) => { try { res.json({ ok: true, ...daz.dismiss((req.body || {}).id) }); } catch (e) { fail(res, e); } });
  app.get("/api/daz/live", (_req, res) => res.json(live.status()));
  app.post("/api/daz/live/cmd", J, (req, res) => { try { res.json({ ok: true, ...live.push(req.body || {}) }); } catch (e) { fail(res, e); } });
  app.post("/api/daz/live/poll", J, (req, res) => res.json(live.poll(req.body || {})));
  app.post("/api/daz/live/clear", (_req, res) => res.json({ ok: true, dropped: live.clear() }));   // 2.618.0: a 3D layer deleted / hidden
}

module.exports = { mount };
