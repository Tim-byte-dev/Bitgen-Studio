// routes/garment.js — 2.932.0: 👗 the Garment designer (lib/garment.js, lib/garmentAi.js, lib/garmentPdf.js; the add-on
// lib/garmentAddon.js). Mounted from routes/index.js (never server.js).
//   GET    /api/garment                  {installed, note, schema, presets, mannequins {female, male}, papers, list}
//   POST   /api/garment/make             {name, values {path: v}, body {sex, height, bust, waist, hips}} -> the garment
//   POST   /api/garment/describe         {words, values} -> {values, preset, name, say, by, note, dropped}
//   POST   /api/garment/:slug/pdf        {paper a4|letter|a3|a0, sa (cm)} -> {name, url, pages, sheets}
//   GET    /api/garment/list             [garment ...]
//   GET    /api/garment/file/:slug/:file the pattern's SVG / outline / specification / a PDF
//   GET    /api/garment/:slug            one garment
//   DELETE /api/garment/:slug
//   POST   /api/garment/:slug/drape      {fabric, color "#rrggbb", frames} -> {id} (2.933.0, one at a time; 409 without Blender)
//   GET    /api/garment/drape/:id        {state, pct, note, result (meta.drape with urls)}
"use strict";
const express = require("express");

function wrap(fn) {
  return async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  };
}

function mount(app) {
  const G = () => require("../lib/garment");
  const json = express.json({ limit: "1mb" });
  app.get("/api/garment", wrap(async () => {
    const st = require("../lib/garmentAddon").status();
    return Object.assign({}, st, { schema: G().schema(), presets: G().presets(), mannequins: G().mannequins(),
      papers: Object.entries(require("../lib/garmentPdf").PAPERS).map(([id, p]) => ({ id, label: p.label })), list: G().list() });
  }));
  app.get("/api/garment/list", wrap(async () => G().list()));
  app.post("/api/garment/make", json, wrap(async (req) => G().make(req.body || {})));
  app.post("/api/garment/describe", json, wrap(async (req) => {
    const b = req.body || {};
    return require("../lib/garmentAi").describe(b.words, b.values, { noLlm: b.no_llm === true || b.no_llm === 1 });
  }));
  app.post("/api/garment/:slug/pdf", json, wrap(async (req) => G().pdf(req.params.slug, req.body || {})));
  app.get("/api/garment/file/:slug/:file", (req, res) => {
    try {
      const f = G().fileOf(req.params.slug, req.params.file);
      if (/\.pdf$/.test(f)) res.setHeader("Content-Disposition", `attachment; filename="${req.params.slug}-${req.params.file}"`);
      res.sendFile(f);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
  // 2.933.0: 🧍 the drape on the mannequin (lib/garmentDrape.js - Blender's cloth)
  app.post("/api/garment/:slug/drape", json, wrap(async (req) => require("../lib/garmentDrape").start(req.params.slug, req.body || {})));
  app.get("/api/garment/drape/:id", wrap(async (req) => require("../lib/garmentDrape").get(req.params.id)));
  app.get("/api/garment/:slug", wrap(async (req) => G().get(req.params.slug)));
  app.delete("/api/garment/:slug", wrap(async (req) => G().remove(req.params.slug)));
}

module.exports = { mount };
