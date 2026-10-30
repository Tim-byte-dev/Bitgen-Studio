// bitGen Studio — routes/pushPull.js (2.619.0): the 📏 PushPull docker's models (lib/pushPull.js). Mounted from routes/index.js.
//   GET    /api/pushpull               {models: [{name, saved, size}]}
//   GET    /api/pushpull/:name         {model, view, saved}
//   POST   /api/pushpull/:name         {model, view} -> {name, saved}
//   DELETE /api/pushpull/:name         to the recycle bin
"use strict";
const pp = require("../lib/pushPull");

function mount(app) {
  const express = require("express");
  const J = express.json({ limit: "33mb" });
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/pushpull", (_req, res) => { try { res.json({ models: pp.list() }); } catch (e) { fail(res, e); } });
  app.get("/api/pushpull/:name", (req, res) => { try { res.json(pp.read(req.params.name)); } catch (e) { fail(res, e); } });
  app.post("/api/pushpull/:name", J, (req, res) => { try { res.json(pp.write(req.params.name, req.body || {})); } catch (e) { fail(res, e); } });
  app.delete("/api/pushpull/:name", (req, res) => { try { res.json(pp.remove(req.params.name)); } catch (e) { fail(res, e); } });
}
module.exports = { mount };
