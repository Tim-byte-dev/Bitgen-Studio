// bitGen Studio — routes/quickprompts.js (2.451.0): the prompt docker's quick prompts (lib/quickPrompts.js -
// <install>/quick_prompts.json). Mounted from routes/index.js (never server.js).
//   GET  /api/quickprompts              {prompts: [{name, text, at}]}
//   POST /api/quickprompts/save {text}  {name, saved, replaced}
//   POST /api/quickprompts/delete {name} {removed}
"use strict";
const store = require("../lib/quickPrompts");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/quickprompts", (_req, res) => { try { res.json({ prompts: store.list() }); } catch (e) { fail(res, e); } });
  app.post("/api/quickprompts/save", express.json({ limit: "256kb" }), (req, res) => { try { res.json(store.save((req.body || {}).text)); } catch (e) { fail(res, e); } });
  app.post("/api/quickprompts/delete", express.json(), (req, res) => { try { res.json(store.remove((req.body || {}).name)); } catch (e) { fail(res, e); } });
}

module.exports = { mount };
