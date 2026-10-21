// bitGen Studio — routes/storyboard.js (2.456.0): THE STORYBOARD's pictures (lib/storyboard.js). Mounted from
// routes/index.js (never server.js).
//   GET  /api/storyboard                         {items: [{n, id, file, label, style, at, rel}]}
//   POST /api/storyboard/:n/plan {sheets, locations, refs, prev, llm, style_id}
//                                                {n, prompt, images: [asset names], picked: [{rel, group}], roles, prev,
//                                                llm, note} - the references adopted into Images assets so /api/genimage
//                                                can send them; 2.568.0: the scene before's last frame first, the prompt
//                                                written by the LLM from the scene (lib/storyboardPlan.js)
//   POST /api/storyboard/:n/fromjob {job, style, prompt} the finished image job's picture kept as scene n's storyboard picture
//   POST /api/storyboard/:n/set {kind: project, rel | kind: frame, scene, time}   2.568.0: change it - any picture of the
//                                                project / a frame of a take (the scene picker's 🎬 / 🎞 / 📁 tabs)
//   POST /api/storyboard/:n/upload (multipart image)                              2.568.0: change it - a file
//   POST /api/storyboard/:n/clear                {cleared}
//   GET  /api/storyboard/:n/thumb                the picture
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const scenes = require("../lib/scenes");
const projectMedia = require("../lib/projectMedia");
const sb = require("../lib/storyboard");
const sbPlan = require("../lib/storyboardPlan");       // 2.568.0
const sceneRefs = require("../lib/sceneRefs");

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
  app.post("/api/storyboard/:n/plan", express.json(), async (req, res) => {
    try {
      const b = req.body || {};
      res.json(await sbPlan.plan(b.project, req.params.n, { sheets: b.sheets, locations: b.locations, refs: b.refs, prev: b.prev, llm: b.llm, style_id: b.style_id }));
    } catch (e) { fail(res, e); }
  });
  /* 2.568.0: change it - a picture of the project, a frame of a take, a file */
  app.post("/api/storyboard/:n/set", express.json(), (req, res) => {
    let tmp = null;
    try {
      const b = req.body || {}, st = scenes.load(b.project), r = scenes.at(st, req.params.n);
      if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
      let src = "", label = "";
      if (b.kind === "frame") {
        const from = scenes.at(st, b.scene);
        if (!from) return res.status(404).json({ error: `no scene ${b.scene}` });
        const t = b.time === undefined || b.time === null || b.time === "" ? null : +b.time;
        tmp = sceneRefs.extractFrame(require("../lib/sceneFrames").takeOf(from), Number.isFinite(t) ? t : null);
        if (!tmp) return res.status(400).json({ error: `scene ${from.n} has no rendered take to take a frame from` });
        src = tmp; label = Number.isFinite(t) ? `scene ${from.n} at ${Math.round(t * 10) / 10}s` : `the last frame of scene ${from.n}`;
      } else if (b.kind === "project") {
        src = projectMedia.resolve(b.project, b.rel);
        if (!src || projectMedia.kindOfFile(src) !== "images") return res.status(404).json({ error: `${b.rel} is not a picture in this project` });
        label = b.label ? String(b.label).slice(0, 80) : `${projectMedia.groupFor(b.project, b.rel)}: ${path.basename(String(b.rel))}`;
      } else return res.status(400).json({ error: "kind must be project or frame" });
      const out = sb.setFromFile(b.project, r, src, label, "chosen");
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json(Object.assign({ note: `scene ${r.n}'s storyboard picture: ${label}` }, out.item));
    } catch (e) { fail(res, e); }
    finally { if (tmp) try { fs.unlinkSync(tmp); } catch { /* gone */ } }
  });
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 60 * 1024 * 1024 });
  app.post("/api/storyboard/:n/upload", upload.single("image"), (req, res) => {
    const f = req.file;
    try {
      const st = scenes.load((req.body || {}).project), r = scenes.at(st, req.params.n);
      if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
      if (!f) return res.status(400).json({ error: "no picture sent" });
      const name = path.basename(String(f.originalname || "picture.png")), ext = path.extname(name).toLowerCase();
      if (!/^\.(png|jpe?g|webp|bmp|gif)$/.test(ext)) return res.status(400).json({ error: "that is not a picture (png / jpeg / webp / bmp / gif)" });
      const named = f.path + ext; fs.renameSync(f.path, named); f.path = named;
      const out = sb.setFromFile((req.body || {}).project, r, named, "file: " + name, "chosen");
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json(Object.assign({ note: `scene ${r.n}'s storyboard picture: ${name}` }, out.item));
    } catch (e) { fail(res, e); }
    finally { if (f && f.path) try { fs.unlinkSync(f.path); } catch { /* gone */ } }
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
      const out = sb.setFromFile(b.project, r, src, path.basename(src), b.style, b.prompt);   // 2.568.0: + the prompt it was made from
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
