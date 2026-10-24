// bitGen Studio — routes/graphCheck.js (2.587.0): Settings ▸ ComfyUI ▸ Graphs ▸ ⤒ Import & check (lib/graphCheck.js).
// Tim: "allow user to import a comfy graph, bitgen checks the graph and adds the image/video/audio inputs as needed and
// saves the output and reports missing nodes ... bitgen will do a run of the workflow and if successful it will save it
// to workflows if unsuccessful it will report the errors" + "show the graph ... when file is imported".
//   POST /api/graphs/check        text/plain JSON {graph, name}  (a big UI export is past express.json's 100 kB)
//                                 -> {token, name, format, converted, report, view}  a UI export is converted with
//                                 ComfyUI's own /object_info; the check is staged (workspace/graphcheck/<token>/)
//   POST /api/graphs/check/:token/test    ▶ the test run: a queue job (graph_worker.py) with a test picture / sound /
//                                 video in every loader and the suggested controls' defaults -> {job}
//   GET  /api/graphs/check/:token         the stage + its test job {status, errors, log}
//   POST /api/graphs/check/:token/save    {name, kind} - only after a test run that finished: comfy_workflows/<name>.json
//                                 (the fixed API prompt) + graphs/<name>.json (the binding with the suggested controls)
//   POST /api/graphs/view         {file}  the inputs it takes + the picture of a workflow in comfy_workflows/
"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");
const core = require("../lib/core");
const GC = require("../lib/graphCheck");
const CG = require("../lib/comfyGraphs");

const WF_DIR = () => path.join(core.BASE, "comfy_workflows");
const stem = (n) => String(n || "").replace(/\.json$/i, "").replace(/[^A-Za-z0-9 _.-]+/g, "_").replace(/^[ ._-]+|[ ._-]+$/g, "").slice(0, 80) || "imported";
const freeName = (dir, base) => { let n = base, i = 2; while (fs.existsSync(path.join(dir, n + ".json"))) n = `${base}_${i++}`; return n; };
const TEST_PROMPT = "a red apple on a wooden table, soft studio light";

/** the job's errors in words (graph_worker.py's ERROR line, ComfyUI's node errors) */
function errorsOf(job) {
  const log = (job && job.log) || [];
  const out = log.filter((l) => /\[worker\] ERROR|node_errors|Error|error:|Exception|not in list|Prompt outputs failed|Required input is missing/i.test(l)).map((l) => String(l).replace(/^\[worker\]\s*ERROR:\s*/, "")).slice(-8);
  return out.length ? out : log.slice(-4);
}
const kindGuess = (r) => (r.outputs.some((o) => o.kind === "video") ? "video" : r.outputs.some((o) => o.kind === "audio") && !r.outputs.some((o) => o.kind === "image") ? "music" : r.outputs.length ? "image" : "any");

function mount(app) {
  app.post("/api/graphs/check", express.text({ type: () => true, limit: "64mb" }), async (req, res) => {
    let b = {};
    try { b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; } catch (e) { return res.status(400).json({ error: "that is not a workflow (JSON): " + e.message }); }
    const ui = b.graph;
    if (!ui || typeof ui !== "object") return res.status(400).json({ error: "no workflow in the request" });
    const fmt = CG.format(ui);
    if (fmt !== "api" && fmt !== "ui") return res.status(400).json({ error: "not a ComfyUI workflow - expected a saved workflow (nodes + links) or an API prompt" });
    let info = null;
    try { info = await require("../lib/comfy").objectInfo(15000); } catch { info = null; }
    // a node list without even ComfyUI's own core nodes is not a real answer (a proxy, a stub) - checked as if offline
    if (info && typeof info === "object" && !(info.KSampler || info.SaveImage || info.LoadImage || info.CheckpointLoaderSimple)) info = null;
    let api = fmt === "api" ? ui : null, converted = false, convertNotes = [], unknown = [];
    if (fmt === "ui") {
      if (!info) return res.status(503).json({ error: "this is a saved (UI) workflow - ComfyUI must be running to read it (its node list says which value is which). Start ComfyUI (Settings ▸ ComfyUI ▸ Start) and import again.", view: GC.view(ui, {}), counts: GC.counts(ui) });
      let out;
      try { out = require("../lib/graphToApi").convert(ui, info); } catch (e) { return res.status(400).json({ error: "could not read the workflow: " + e.message, view: GC.view(ui, {}) }); }
      if (!out.graph) {
        unknown = out.unknown || [];
        return res.json({ token: "", name: stem(b.name), format: fmt, converted: false, view: GC.view(ui, { missing_nodes: unknown }), counts: GC.counts(ui),
          report: { ok: false, media: GC.counts(ui), loaders: [], outputs: [], fixes: [], missing_nodes: unknown, missing_models: [], controls: [], node_count: (ui.nodes || []).length,
            problems: ["ComfyUI does not have these nodes: " + unknown.join(", ") + " - install their node packs (ComfyUI-Manager ▸ Install Missing Custom Nodes), restart ComfyUI and import again"], warnings: [] } });
      }
      api = out.graph; converted = true; convertNotes = [].concat(out.dropped && out.dropped.length ? [`${out.dropped.length} bypassed / pass-through node(s) left out`] : [], out.warnings || []);
    }
    const r = GC.check(api, info);
    r.warnings = convertNotes.concat(r.warnings);
    const name = stem(b.name);
    const token = GC.stage(core, { name, format: fmt, converted, api: r.api, report: Object.assign({}, r, { api: undefined }), kind: kindGuess(r) });
    const rep = Object.assign({}, r); delete rep.api;
    res.json({ token, name, format: fmt, converted, kind: kindGuess(r), report: rep, view: GC.view(fmt === "ui" ? ui : r.api, r), counts: r.media });
  });

  app.post("/api/graphs/check/:token/test", (req, res) => {
    const st = GC.readStage(core, req.params.token);
    if (!st) return res.status(404).json({ error: "that import is gone - import the workflow again" });
    if (!st.report.ok) return res.status(400).json({ error: (st.report.problems || []).join(" · ") || "the check found problems" });
    if ((core.getConfig().engine || {}).backend !== "comfy") return res.status(400).json({ error: "the test run goes through ComfyUI - set Settings ▸ ComfyUI ▸ Engine to ComfyUI API" });
    const binding = { controls: st.report.controls || [] };
    const seed = Math.floor(Math.random() * 2147483647);
    const vals = CG.fillSources(binding, {}, { prompt: TEST_PROMPT, negative: "", seed });
    const ap = CG.apply(st.api, binding, vals);
    const ph = GC.placeholders(path.join(GC.stageDir(core, st.token), "inputs"));
    const refs = {};
    for (const k of CG.REF_KINDS) { const n = (st.report.media || {})[k] || 0; refs[k] = ph[k] ? Array.from({ length: n }, () => ({ name: path.basename(ph[k]), path: ph[k] })) : []; }
    const fill = CG.assignRefs(ap.graph, refs, new Set());
    const missingPh = CG.REF_KINDS.filter((k) => (st.report.media || {})[k] && !ph[k]);
    const job = core.makeJob({
      mode: "graph", graph: fill.graph, graph_name: "test run: " + st.name, graph_file: "(⤒ Import & check)", graph_kind: st.kind,
      seed, seed_random: true, no_assets: true, graph_check: st.token, prompt: "Test run of the imported workflow " + st.name,
      graph_uploads: fill.assigned.map((a) => ({ node: a.node, input: a.input, path: a.path, kind: a.kind })),
      graph_applied: ap.applied.map((a) => `${a.label} → node ${a.node}.${a.input} = ${JSON.stringify(a.value).slice(0, 80)}`)
        .concat(fill.assigned.map((a) => `test ${a.kind} → node ${a.node}.${a.input}`)),
      graph_warnings: ap.warnings.concat(fill.warnings, missingPh.map((k) => `no test ${k} could be made (ffmpeg) - its loader was bypassed`)),
    }, null, null, { local: true });
    st.job = job.id; st.tested_at = Date.now(); GC.writeStage(core, st);
    res.json({ job: job.id });
  });

  app.get("/api/graphs/check/:token", (req, res) => {
    const st = GC.readStage(core, req.params.token);
    if (!st) return res.status(404).json({ error: "that import is gone - import the workflow again" });
    const j = st.job ? core.jobs.get(st.job) : null;
    const job = j ? { id: j.id, status: j.status, output: j.output, outputs: j.outputs || null, log: (j.log || []).slice(-14), errors: j.status === "failed" || j.status === "cancelled" ? errorsOf(j) : [] }
      : st.job ? { id: st.job, status: "gone", errors: ["the test job is no longer in the queue (bitGen restarted?) - ▶ Test run again"] } : null;
    res.json({ token: st.token, name: st.name, kind: st.kind, saved: st.saved || null, job });
  });

  app.post("/api/graphs/check/:token/save", (req, res) => {
    const st = GC.readStage(core, req.params.token);
    if (!st) return res.status(404).json({ error: "that import is gone - import the workflow again" });
    const j = st.job ? core.jobs.get(st.job) : null;
    if (!j || j.status !== "done") return res.status(409).json({ error: "it is saved after a test run that worked - ▶ Test run first" });
    if (st.saved) return res.json(Object.assign({ ok: true, already: true }, st.saved));
    const b = req.body || {};
    fs.mkdirSync(WF_DIR(), { recursive: true });
    const wf = freeName(WF_DIR(), stem(b.name || st.name));
    fs.writeFileSync(path.join(WF_DIR(), wf + ".json"), JSON.stringify(st.api, null, 2));
    const file = "comfy_workflows/" + wf + ".json";
    const kind = CG.KINDS.includes(String(b.kind)) ? String(b.kind) : st.kind;
    let gname = String(b.name || st.name).trim() || wf, g = null;
    for (let i = 1; i < 50 && !g; i++) {
      try { g = CG.save(core.GRAPHS_DIR, { name: i === 1 ? gname : `${gname} ${i}`, file, kind, controls: st.report.controls || [], notes: `imported ${new Date().toISOString().slice(0, 10)} - tested OK (${j.output || "output"})` }); }
      catch (e) { if (e.code !== "duplicate-name") return res.status(400).json({ error: String(e.message || e) }); }
    }
    st.saved = { file, graph: g ? { id: g.id, name: g.name } : null, output: j.output || null };
    GC.writeStage(core, st);
    res.json(Object.assign({ ok: true }, st.saved));
  });

  app.post("/api/graphs/view", (req, res) => {
    const f = String((req.body || {}).file || "").replace(/\\/g, "/").replace(/^comfy_workflows\//i, "");
    if (!f || f.includes("..")) return res.status(400).json({ error: "a workflow in comfy_workflows/" });
    let g;
    try { g = JSON.parse(fs.readFileSync(path.join(WF_DIR(), f), "utf8")); } catch (e) { return res.status(404).json({ error: "could not read comfy_workflows/" + f + ": " + e.message }); }
    const fmt = CG.format(g);
    const r = fmt === "api" ? GC.check(g, null) : { loaders: [], outputs: [], fixes: [], missing_nodes: [], missing_models: [] };
    res.json({ format: fmt, counts: GC.counts(g), outputs: r.outputs || [], view: GC.view(g, r) });
  });
}

module.exports = { mount, errorsOf };
