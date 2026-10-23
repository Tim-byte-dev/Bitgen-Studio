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
//   2.575.0 (lib/modelMedia.js - your pictures / videos / sounds of a model, its thumbnail, their prompts):
//   GET  /api/modelmgr/media?key=              {items, thumb}
//   GET  /api/modelmgr/media/file?key=&id=     one of them
//   POST /api/modelmgr/media                   multipart {key, file} | JSON {key, src: output|images|video|sound, name}
//   POST /api/modelmgr/media/update {key, id, meta?, name?};  POST /api/modelmgr/media/delete {key, id}
//   POST /api/modelmgr/thumb                   multipart {key, file} | JSON {key, item} | JSON {key, src, name} | JSON {key, example: n} (2.576.0)
//   POST /api/modelmgr/thumb/clear {key}
//   2.579.0 (lib/modelDelete.js - Tim: "allow user to delete models in model manager ... delete it from the disk too"):
//   GET  /api/modelmgr/delete?key=             what a delete removes {name, size, sidecars, info, styles}
//   POST /api/modelmgr/delete {key}            the model file + its sidecars + its model_info page, from the disk
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
        model_types: cards.MODEL_TYPES,                                 // 2.575.0
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
  /* ---- 2.575.0: your media of a model (lib/modelMedia) */
  const MM = require("../lib/modelMedia"), MED = require("../lib/mediaMeta");
  const os = require("os"), fs = require("fs");
  let up = null;
  const upload = () => { if (!up) up = require("multer")({ dest: os.tmpdir(), limits: { fileSize: MM.MAX_BYTES, files: 1 } }).single("file"); return up; };
  const cardOf = (key) => { const h = cards.find(String(key || "")); return h ? h.card : null; };
  const done = (res, r) => { if (r && r.error) return res.status(400).json(r); try { cards.invalidate && cards.invalidate(); } catch { /* fine */ } res.json(r); };
  // a file from the project (the gallery / Assets): the path is resolved here, never taken from the request
  const fromProject = (b) => { const p = MED.resolve(String(b.src || ""), String(b.name || "")); if (!p) { const e = new Error(`${b.name || "that file"} is not in this project's ${b.src || "files"}`); e.status = 400; throw e; } return p; };
  app.get("/api/modelmgr/media", (req, res) => {
    try { const c = cardOf(req.query.key); if (!c) return res.status(404).json({ error: "no such model" }); res.json(MM.list(c)); } catch (e) { fail(res, e); }
  });
  app.get("/api/modelmgr/media/file", (req, res) => {
    try { const c = cardOf(req.query.key); const f = c ? MM.filePath(c, String(req.query.id || "")) : null; if (!f) return res.status(404).end(); res.set("Cache-Control", "max-age=3600"); res.sendFile(f); } catch (e) { fail(res, e); }
  });
  const withUpload = (handler) => (req, res) => {
    const go = () => { try { handler(req, res); } catch (e) { fail(res, e); } finally { if (req.file && req.file.path) fs.unlink(req.file.path, () => {}); } };
    if (req.is("multipart/form-data")) upload()(req, res, (err) => { if (err) return res.status(400).json({ error: String(err.message || err) }); go(); });
    else go();
  };
  app.post("/api/modelmgr/media", withUpload((req, res) => {
    const b = req.body || {}, c = cardOf(b.key);
    if (!c) return res.status(404).json({ error: "no such model" });
    let meta = null; try { meta = b.meta ? (typeof b.meta === "string" ? JSON.parse(b.meta) : b.meta) : null; } catch { meta = null; }
    if (req.file) return done(res, MM.add(c, { path: req.file.path, name: req.file.originalname, meta, src: "upload" }));
    const p = fromProject(b);
    // a render of this app: its job record knows more than the file (lib/mediaMeta.lookup)
    if (!meta) { const hit = MED.lookup({ src: b.src, name: b.name }); if (hit) meta = hit.meta; }
    done(res, MM.add(c, { path: p, name: require("path").basename(p), meta, src: String(b.src || "") }));
  }));
  app.post("/api/modelmgr/media/update", (req, res) => {
    try { const b = req.body || {}, c = cardOf(b.key); if (!c) return res.status(404).json({ error: "no such model" }); done(res, MM.update(c, String(b.id || ""), b)); } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/media/delete", (req, res) => {
    try { const b = req.body || {}, c = cardOf(b.key); if (!c) return res.status(404).json({ error: "no such model" }); done(res, MM.remove(c, String(b.id || ""))); } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/thumb", withUpload((req, res) => {
    const b = req.body || {}, c = cardOf(b.key);
    if (!c) return res.status(404).json({ error: "no such model" });
    if (req.file) return done(res, MM.setThumb(c, { path: req.file.path, name: req.file.originalname }));
    if (b.item) return done(res, MM.setThumb(c, { item: String(b.item) }));
    // 2.576.0: one of Civitai's example pictures of it (Ctrl+↓ in the viewer)
    if (b.example != null && b.example !== "") { const f = MI.examplePath(c, b.example); if (!f) return res.status(404).json({ error: "no such example picture" }); return done(res, MM.setThumb(c, { path: f, name: require("path").basename(f) })); }
    const p = fromProject(b);
    done(res, MM.setThumb(c, { path: p, name: require("path").basename(p) }));
  }));
  app.post("/api/modelmgr/thumb/clear", (req, res) => {
    try { const c = cardOf((req.body || {}).key); if (!c) return res.status(404).json({ error: "no such model" }); done(res, MM.clearThumb(c)); } catch (e) { fail(res, e); }
  });
  app.get("/api/modelmgr/delete", (req, res) => {
    try { const r = require("../lib/modelDelete").check(String(req.query.key || "")); res.status(r.error ? 404 : 200).json(r); } catch (e) { fail(res, e); }
  });
  app.post("/api/modelmgr/delete", (req, res) => {
    try {
      const r = require("../lib/modelDelete").remove(String((req.body || {}).key || ""));
      if (r.error) return res.status(/no such/.test(r.error) ? 404 : 409).json(r);
      res.json(r);
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
