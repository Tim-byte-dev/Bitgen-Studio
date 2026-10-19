// bitGen Studio — routes/modelMgr.js (2.518.0): the 🧩 Model manager's cards (lib/modelCards.js) + ✚ New style.
// Mounted from routes/index.js (never server.js).
//   GET  /api/modelmgr/cards?refresh=1          {models, loras, vae, te, warnings, families, categories, templates}
//   GET  /api/modelmgr/thumb?key=<cat|name>     the card's picture (only files the scan found)
//   POST /api/modelmgr/card   {key, fields}     ✎ your edits -> <stem>.bitgen.json
//   POST /api/modelmgr/style  {model, loras:[{key|path, weight}], name?, template_id?}   ✚ a new style from them
//   2.537.0 (lib/modelInfo.js - the shared <app>/model_info library):
//   GET  /api/modelmgr/info?key=               the info page {card, status, match, url, version, examples, folder}
//   GET  /api/modelmgr/example?key=&n=         one example picture
//   POST /api/modelmgr/fetch {keys | all, kind?, force?, sync?}   ⤓ details + thumbs + examples from Civitai (a queue)
//   GET  /api/modelmgr/fetch                   the queue's progress;  POST /api/modelmgr/fetch/stop
//   GET  /api/modelmgr/used                    {keys} - the models / LoRAs this project's jobs used
"use strict";
const cards = require("../lib/modelCards");

function mount(app) {
  const core = require("../lib/core"), styles = require("../lib/styles");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  app.get("/api/modelmgr/cards", (req, res) => {
    try {
      const d = cards.list({ refresh: req.query.refresh === "1" });
      const all = styles.read(core.STYLES_DIR);
      res.json(Object.assign({}, d, {
        families: Object.entries(cards.FAMILIES).map(([id, f]) => ({ id, label: f.label, category: f.category })),
        categories: cards.CATEGORIES,
        templates: all.filter((s) => !s.chain).map((s) => ({ id: s.id, name: s.name, kind: s.kind || "image", arch: s.arch || "" })),
      }));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/modelmgr/thumb", (req, res) => {
    try {
      const f = cards.thumbFile(String(req.query.key || ""));
      if (!f) return res.status(404).end();
      res.set("Cache-Control", "max-age=300");
      res.sendFile(f);
    } catch (e) { fail(res, e); }
  });
  const MI = require("../lib/modelInfo");
  app.get("/api/modelmgr/info", (req, res) => {
    try { const d = MI.details(String(req.query.key || "")); if (!d) return res.status(404).json({ error: "no such model" }); res.json(d); } catch (e) { fail(res, e); }
  });
  app.get("/api/modelmgr/example", (req, res) => {
    try {
      const h = cards.find(String(req.query.key || "")); const f = h ? MI.examplePath(h.card, req.query.n) : null;
      if (!f) return res.status(404).end();
      res.set("Cache-Control", "max-age=3600"); res.sendFile(f);
    } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/fetch", (req, res) => {
    try { const r = MI.fetch(req.body || {}); if (r.error) return res.status(400).json(r); res.json(r); } catch (e) { fail(res, e); }
  });
  app.get("/api/modelmgr/fetch", (_req, res) => { try { res.json(MI.status()); } catch (e) { fail(res, e); } });
  app.post("/api/modelmgr/fetch/stop", (_req, res) => { try { res.json(MI.stop()); } catch (e) { fail(res, e); } });
  app.get("/api/modelmgr/used", (_req, res) => {
    try {
      const jobs = [];
      try { jobs.push(...require("../lib/jobsInfo").read(core.projDir(core.getProject()))); } catch { /* no project */ }
      const cur = core.getProject();
      for (const id of core.order || []) { const j = core.jobs.get(id); if (j && (!j.project || j.project === cur)) { let meta = null; try { meta = require("../lib/jobMeta").entryMeta(j); } catch { meta = null; } jobs.push({ meta, params: j.params }); } }
      const d = cards.list();
      res.json({ keys: cards.usedKeys(d.models.concat(d.loras), jobs), jobs: jobs.length });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/card", (req, res) => {
    try {
      const b = req.body || {};
      const r = cards.edit(String(b.key || ""), b.fields || {});
      if (r.error) return res.status(400).json(r);
      try { require("../lib/testPlan").event("card_edit", { what: String(b.key || "").split("|").pop() }); } catch { /* the 🧪 checklist */ }
      res.json(r);
    } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/style", (req, res) => {
    try {
      const b = req.body || {};
      const m = cards.find(String(b.model || ""));
      if (!m) return res.status(400).json({ error: "pick a model card first" });
      const loras = (Array.isArray(b.loras) ? b.loras : []).map((l) => {
        const h = l && l.key ? cards.find(String(l.key)) : null;
        return { path: h ? h.card.name : String((l && l.path) || ""), weight: l && l.weight };
      }).filter((l) => l.path && !l.path.includes(".."));
      const all = styles.read(core.STYLES_DIR);
      const r = cards.styleFrom(m.card, { name: b.name, template_id: b.template_id, loras }, all);
      if (r.error) return res.status(400).json({ error: r.error });
      let style;
      try { style = styles.save(core.STYLES_DIR, r.raw); }
      catch (e) { return res.status(e.code === "duplicate-name" ? 409 : 400).json({ error: String(e.message || e), code: e.code || null }); }
      const kinds = (() => { try { return styles.modelKinds(style, core.BASE); } catch { return null; } })();
      const notes = r.notes.slice();
      if (Array.isArray(kinds) && kinds.length && !kinds.includes(m.card.cat))
        notes.push(`its workflow loads ${kinds.join(" / ")} models but this file is in ${m.card.cat} - Settings -> Image -> Model's "make visible" links it across (no copy)`);
      try { require("../lib/testPlan").event("style_from_model", { what: style.name }); } catch { /* the 🧪 checklist */ }
      res.json({ ok: true, style, template: r.template, notes, missing: styles.missingSlots(style) });
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount };
