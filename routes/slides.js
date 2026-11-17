// bitGen Studio — 🎞 Slides (2.831.0). Mounted from routes/index.js (never server.js); the work is lib/slideFiles.js +
// lib/slidePptx.js.
//   GET    /api/slides                  [{name, size, mtime}] - the project's decks
//   GET    /api/slides/file?name=       the deck
//   POST   /api/slides/file             {name, deck} -> {name, size}
//   DELETE /api/slides/file?name=
//   POST   /api/slides/export/pptx      {name, deck} -> the .pptx (also kept in the project's slides folder)
//   2.832.0 (lib/slidePptxIn.js):
//   POST   /api/slides/import           a .pptx (raw body) -> {deck, notes}
//   POST   /api/slides/export/pdf?name= a PDF the page made (raw body) -> {name, size} (kept in the project's slides folder)
"use strict";
const express = require("express");
const SF = require("../lib/slideFiles");
function wrap(fn) {
  return async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
}
function mount(app) {
  const J = express.json({ limit: "90mb" });
  app.get("/api/slides", wrap(() => ({ files: SF.list() })));
  app.get("/api/slides/file", wrap((req) => SF.read(req.query.name)));
  app.post("/api/slides/file", J, wrap((req) => SF.write((req.body || {}).name, (req.body || {}).deck)));
  app.delete("/api/slides/file", wrap((req) => SF.remove(req.query.name)));
  app.post("/api/slides/export/pptx", J, async (req, res) => {
    try {
      const b = req.body || {}, buf = await require("../lib/slidePptx").toPptx(b.deck);
      const name = SF.safeName(b.name).replace(/\.bgk$/i, ".pptx");
      try { require("fs").writeFileSync(require("path").join(SF.dir(), name), buf); } catch (e) { /* the download still goes */ }
      res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`, "X-File-Name": encodeURIComponent(name) });
      res.send(buf);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
  app.post("/api/slides/import", express.raw({ type: () => true, limit: "200mb" }), wrap(async (req) => {
    if (!req.body || !req.body.length) throw Object.assign(new Error("no file came"), { status: 400 });
    if (req.body[0] !== 0x50 || req.body[1] !== 0x4b) throw Object.assign(new Error("that is not a .pptx presentation (an older .ppt? save it as .pptx first)"), { status: 400 });
    return require("../lib/slidePptxIn").fromPptx(req.body);
  }));
  app.post("/api/slides/export/pdf", express.raw({ type: () => true, limit: "300mb" }), wrap((req) => {
    if (!req.body || req.body.slice(0, 5).toString() !== "%PDF-") throw Object.assign(new Error("that is not a PDF"), { status: 400 });
    const name = SF.safeName(req.query.name).replace(/\.bgk$/i, ".pdf"), f = require("path").join(SF.dir(), name);
    require("fs").writeFileSync(f, req.body);
    return { name, size: req.body.length };
  }));
}
module.exports = { mount };
