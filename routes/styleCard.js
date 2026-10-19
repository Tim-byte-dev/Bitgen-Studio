/* bitGen Studio — Basic Settings' video style card (2.401.0, lib/styleModels.js, static/stylecard.js).
 *
 *   GET /api/stylecard/:id?mode=ref2va   what the style renders with when a phase's model is blank: the workflow's
 *                                        own model loaders in phase order (or "auto" for Wan) */
"use strict";
const core = require("../lib/core");
const styles = require("../lib/styles");
const styleModels = require("../lib/styleModels");

function mount(app) {
  app.get("/api/stylecard/:id", (req, res) => {
    const st = styles.read(core.STYLES_DIR, "video").find((s) => s.id === String(req.params.id));
    if (!st) return res.status(404).json({ error: "no such video style" });
    const mode = ["t2va", "ref2va", "fl2va"].includes(String(req.query.mode)) ? String(req.query.mode) : "ref2va";
    res.json({ id: st.id, ...styleModels.forStyle(st, { mode, base: core.BASE, config: core.resolvedConfig() }) });
  });
}

module.exports = { mount };
