// bitGen Studio — routes/cadGen.js (2.581.0): ✨ Generate in the 📐 SolidCraft docker (lib/cadGen.js, cad_worker.py).
//   GET  /api/cadgen/status          {runner, cadrille, llm, note}
//   POST /api/cadgen/picture         the raw picture (image/png | jpeg | webp, up to 40 MB) -> {picture: id}
//   POST /api/cadgen/generate        {prompt, engine: auto | cadrille | llm, name?, picture?: id} -> {ok, id, name, engine}
//   POST /api/cadgen/run             {code, name?} -> {ok, id} - the ✎ edited code run again
//   GET  /api/cadgen/job?id=         {state, stage, lines, engine, code, result: {ok, volume, editable, reason, commands,
//                                    step, obj}, error, name} - the part's files are projects/<p>/solidcraft/<name>.step/.obj
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const CG = require("../lib/cadGen");

const send = (res, d) => res.status(d && d.error ? (d.status || 400) : 200).json(d);

/** a picture's type -> its extension, or "" when it is not one the engines read (pure) */
function extOf(type) { const m = /^image\/(png|jpe?g|webp)$/i.exec(String(type || "").split(";")[0].trim()); return m ? (m[1].toLowerCase() === "jpg" ? "jpeg" : m[1].toLowerCase()) : ""; }
const PICS = new Map();          // id -> temporary file (the newest 8)
const picDir = () => { const d = path.join(os.tmpdir(), "bitgen-cadgen"); fs.mkdirSync(d, { recursive: true }); return d; }

function mount(app) {
  app.get("/api/cadgen/status", (_req, res) => { try { res.json(CG.status()); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
  app.post("/api/cadgen/picture", express.raw({ type: () => true, limit: "40mb" }), (req, res) => {
    try {
      const ext = extOf(req.headers["content-type"]);
      if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "the picture must be a PNG, JPEG or WebP" });
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const f = path.join(picDir(), id + "." + ext);
      fs.writeFileSync(f, req.body);
      PICS.set(id, f);
      while (PICS.size > 8) { const [k, old] = PICS.entries().next().value; PICS.delete(k); try { fs.unlinkSync(old); } catch { /* fine */ } }
      res.json({ picture: id });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post("/api/cadgen/generate", (req, res) => {
    try {
      const b = req.body || {};
      let image = "";
      if (b.picture) { image = PICS.get(String(b.picture)) || ""; if (!image) return res.status(400).json({ error: "that picture is gone - pick it again" }); }
      send(res, CG.start({ prompt: b.prompt, engine: b.engine, name: b.name, image }));
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post("/api/cadgen/run", (req, res) => {
    try { const b = req.body || {}; if (!String(b.code || "").trim()) return res.status(400).json({ error: "no code" }); send(res, CG.start({ code: b.code, name: b.name })); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.get("/api/cadgen/job", (req, res) => { const j = CG.job(req.query.id); if (!j) return res.status(404).json({ error: "no such job" }); res.json(j); });
}

module.exports = { mount, extOf };
