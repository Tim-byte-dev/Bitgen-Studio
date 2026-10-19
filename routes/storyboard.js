// bitGen Studio — routes/storyboard.js (2.456.0): THE STORYBOARD's pictures (lib/storyboard.js). Mounted from
// routes/index.js (never server.js).
//   GET  /api/storyboard                         {items: [{n, id, file, label, style, at, rel}]}
//   POST /api/storyboard/:n/plan {sheets, locations, refs}
//                                                {n, prompt, images: [asset names], picked: [{rel, group}]} - the
//                                                references adopted into Images assets so /api/genimage can send them
//   POST /api/storyboard/:n/fromjob {job, style} the finished image job's picture kept as scene n's storyboard picture
//   POST /api/storyboard/:n/clear                {cleared}
//   GET  /api/storyboard/:n/thumb                the picture
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const scenes = require("../lib/scenes");
const projectMedia = require("../lib/projectMedia");
const sb = require("../lib/storyboard");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  const row = (req, res) => {
    const st = scenes.load(req.query.project || (req.body || {}).project), r = scenes.at(st, req.params.n);
    if (!r) { res.status(404).json({ error: `no scene ${req.params.n}` }); return null; }
    return r;
  };
  app.get("/api/storyboard", (req, res) => {
    try { res.json({ items: sb.list(req.query.project, (scenes.load(req.query.project) || {}).list || []) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/storyboard/:n/plan", express.json(), (req, res) => {
    try {
      const b = req.body || {}, r = row(req, res); if (!r) return;
      const prompt = sb.promptFor(r);
      if (!prompt) return res.status(400).json({ error: `scene ${r.n} has no prompt yet - write it first` });
      const media = projectMedia.scan(b.project).images, rels = sb.pickRefs(r, media, { sheets: b.sheets !== false, locations: b.locations !== false, refs: b.refs !== false });
      const images = [], picked = [];
      for (const rel of rels) {
        let name = null;
        try { const a = projectMedia.adopt(b.project, rel); name = a && a.ok ? a.name : null; } catch { name = null; }
        if (typeof name === "string" && name) { images.push(path.basename(name)); picked.push({ rel, group: projectMedia.groupFor(b.project, rel) }); }
      }
      res.json({ n: r.n, id: r.id, prompt, images, picked });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/storyboard/:n/fromjob", express.json(), (req, res) => {
    try {
      const b = req.body || {}, r = row(req, res); if (!r) return;
      const job = core.jobs.get(String(b.job || ""));
      if (!job) return res.status(404).json({ error: "no such job" });
      if (job.status !== "done") return res.status(400).json({ error: `the picture is not ready (${job.status})` });
      const cands = [].concat(job.outputs || [], job.output ? [job.output] : []).map(String).filter(Boolean);
      let src = null;
      for (const c of cands) {
        for (const p of [c, path.join(core.pDir("images"), path.basename(c)), path.join(core.projDir(core.getProject()), "output", path.basename(c))]) if (path.isAbsolute(p) && fs.existsSync(p)) { src = p; break; }
        if (src) break;
      }
      if (!src) return res.status(400).json({ error: "the job made no picture" });
      const out = sb.setFromFile(b.project, r, src, path.basename(src), b.style);
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json(out.item);
    } catch (e) { fail(res, e); }
  });
  app.post("/api/storyboard/:n/clear", express.json(), (req, res) => {
    try { const r = row(req, res); if (!r) return; res.json({ cleared: sb.clear((req.body || {}).project, r) }); } catch (e) { fail(res, e); }
  });
  app.get("/api/storyboard/:n/thumb", (req, res) => {
    try { const r = row(req, res); if (!r) return; const f = sb.file(req.query.project, r); if (!f) return res.status(404).json({ error: "no storyboard picture" }); res.sendFile(f); } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
