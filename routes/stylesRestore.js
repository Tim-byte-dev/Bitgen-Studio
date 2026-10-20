// bitGen Studio — routes/stylesRestore.js (2.547.0): the built-in styles back (lib/styles.js missingStarters /
// restoreStarters). Mounted from routes/index.js.
// Tim: "the krea2 style is gone, please add them back".
//   GET  /api/styles/missing?kind=image|video|music   -> {missing: [names]} the built-in styles whose file is not there
//   POST /api/styles/restore {names?: [..], kind?}     -> {made: [names], styles} writes them (never over a file)
"use strict";
const styles = require("../lib/styles");
const core = require("../lib/core");

function mount(app) {
  const express = require("express");
  const kindOf = (k) => (styles.KINDS.includes(String(k || "")) ? String(k) : undefined);
  app.get("/api/styles/missing", (req, res) => {
    try { res.json({ missing: styles.missingStarters(core.STYLES_DIR, kindOf(req.query.kind)) }); }
    catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
  app.post("/api/styles/restore", express.json({ limit: "64kb" }), (req, res) => {
    try {
      const b = req.body || {};
      const names = Array.isArray(b.names) ? b.names.map((x) => String(x).slice(0, 120)).slice(0, 200) : null;
      const made = styles.restoreStarters(core.STYLES_DIR, names, kindOf(b.kind));
      res.json({ made, styles: styles.read(core.STYLES_DIR) });
    } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  });
}
module.exports = { mount };
