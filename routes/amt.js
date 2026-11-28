// bitGen Studio — routes/amt.js (3.11.0): ✍ CONTINUE - the Anticipatory Music Transformer writes the next bars of a note clip
// (the Edit Booth's 🎹 piano roll; lib/amtAddon.js, lib/amtNotes.js; each run is a job - misc/amt_worker.py, mode "amt").
// Mounted from routes/index.js (never server.js).
//
//   GET  /api/amt                {installed, ready, models {small, medium, large}, note, instr [{id, label}]}
//   POST /api/amt/continue       {notes [{m, t, d, v}], bpm, bars 1..8, model small | medium | large, top_p, instr, only, seed}
//                                -> {job, from, to}   409 {needs: "amt", missing} when the add-on / that model is not here
//   GET  /api/amt/notes/:id      the job's new notes in the clip's own time -> {status, notes [{m, t, d, v}], from, to, device}
//                                (202 {status} while it waits / writes)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const A = require("../lib/amtAddon");
const AN = require("../lib/amtNotes");

function mount(app) {
  const J = require("express").json({ limit: "4mb" });
  app.get("/api/amt", (_req, res) => {
    try { const s = A.status(); res.json({ installed: s.installed, ready: A.ready(), models: A.haveModels(), note: s.note, instr: AN.INSTR }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/amt/continue", J, (req, res) => {
    try {
      const b = req.body || {};
      const jp = A.jobParams({ notes: b.notes, bpm: b.bpm, bars: b.bars, model: b.model, top_p: b.top_p, instr: b.instr, only: b.only, seed: b.seed });
      if (jp.error) return res.status(jp.status || 400).json({ error: jp.error, missing: jp.missing || null, needs: jp.status === 409 ? "amt" : null });
      const job = core.makeJob(jp.params); job.chunk = { i: 0, n: 1 };
      res.json({ job: core.jobDict(job), from: jp.plan.from, to: jp.plan.to });
    } catch (e) { res.status(e.status || 500).json({ error: String(e.message || e) }); }
  });
  app.get("/api/amt/notes/:id", (req, res) => {
    const job = core.jobs.get(req.params.id);
    if (!job || !job.params || job.params.mode !== "amt") return res.status(404).json({ error: "no such ✍ Continue job" });
    if (job.status === "failed" || job.status === "cancelled") {
      const why = (job.log || []).slice(-12).reverse().find((l) => /ERROR/.test(l)) || "";
      return res.status(409).json({ status: job.status, error: why.replace(/^.*ERROR:\s*/, "") || "✍ Continue " + job.status });
    }
    if (job.status !== "done") return res.status(202).json({ status: job.status, progress: require("../lib/jobMeta").progress(job) });
    try {
      const j = JSON.parse(fs.readFileSync(path.join(job.dir, "amt", "notes.json"), "utf8"));
      const pl = job.params.plan;
      res.json({ status: "done", notes: AN.back(j.notes, pl, { v: job.params.vel }), from: pl.from, to: pl.to, device: j.device || "" });
    } catch (e) { res.status(500).json({ error: "the new notes are gone: " + e.message }); }
  });
}
module.exports = { mount };
