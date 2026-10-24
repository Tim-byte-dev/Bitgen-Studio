// bitGen Studio — lib/liveGen.js (2.588.0): ⚡ LIVE GENERATION for the image editor (the Krita AI plugin's live mode).
//
// Tim: "add live generation mode like krita has". The editor sends the canvas every time it changes (a stroke, an
// undo, a new layer - ext/imageeditdock/pclive.js); each one is a small Refine of the whole picture (/api/aiedit with
// live=1). This file keeps that from flooding the app:
//   - one CLIENT (a browser tab: live_id) has at most ONE live render waiting: a newer one cancels the older queued one
//     (latest wins - the running one finishes, it is nearly done)
//   - a live render goes to the head of the queue (core.makeJob opts.front) and skips the queue preset's rest and the
//     VRAM clear before each job (image_worker.py) - the model stays loaded, the next stroke renders at once
//   - it is never in the queue docker, jobs.info or the assets (no_assets); its files are throw-away: when one finishes,
//     the client's older live jobs (and their pictures, their inputs in ComfyUI's input folder) are removed - the last
//     KEEP stay so the editor can still load the one it is showing
//   clientId(v)                 -> a safe id ("" when none)
//   supersede(core, client)     cancels the client's queued live renders -> [ids]
//   track(client, job)          remembers the job as the client's newest
//   finished(core, job)         after a live job ends: prune the client's older ones -> {removed}
//   prune(core, client, keep)   -> {removed: n}
//   state(client)               -> {jobs: [ids], running}
"use strict";
const fs = require("fs");
const path = require("path");

const KEEP = 3;                    // the newest finished live renders kept (the shown one + a little slack)
const MAX_CLIENTS = 32;
const C = new Map();               // client -> {ids: [job ids, oldest first], touched}

const clientId = (v) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
const rec = (client) => { let r = C.get(client); if (!r) { r = { ids: [], touched: Date.now() }; C.set(client, r); trim(); } return r; };
function trim() {
  if (C.size <= MAX_CLIENTS) return;
  const old = [...C.entries()].sort((a, b) => a[1].touched - b[1].touched).slice(0, C.size - MAX_CLIENTS);
  for (const [k] of old) C.delete(k);
}

/** cancel the client's live renders that have not started (latest wins) -> the ids cancelled */
function supersede(core, client) {
  const r = C.get(clientId(client)); if (!r) return [];
  const out = [];
  for (const id of r.ids) {
    const j = core.jobs.get(id);
    if (j && j.status === "queued") { j.status = "cancelled"; out.push(id); }
  }
  // out of the queue at once (pump would skip them, but a long queue would keep them in memory)
  if (out.length && Array.isArray(core.queue)) for (let i = core.queue.length - 1; i >= 0; i--) if (out.includes(core.queue[i].id)) core.queue.splice(i, 1);
  return out;
}

function track(client, job) {
  const r = rec(clientId(client));
  r.ids.push(job.id); r.touched = Date.now();
  job.params.live_client = clientId(client);
}

/** the files a live job made or used: its picture(s) in the output folder, its inputs */
function filesOf(core, job) {
  const out = [];
  const names = [...new Set([].concat(job.outputs || [], job.output ? [job.output] : []))];
  for (const n of names) {
    try { for (const d of core.outputDirs(job.project)) { const p = path.join(d, path.basename(String(n))); if (fs.existsSync(p)) out.push(p); } } catch { /* no project */ }
  }
  for (const p of [].concat((job.params || {}).images || [], (job.params || {}).live_inputs || [])) if (p) out.push(String(p));
  if ((job.params || {}).workflow && /aiedit-[a-z0-9]+-(fill|edit|ref)\.json$/.test(String(job.params.workflow))) out.push(String(job.params.workflow));
  return out;
}

function forget(core, job) {
  let n = 0;
  for (const p of filesOf(core, job)) { try { fs.rmSync(p, { force: true }); n++; } catch { /* in use - next time */ } }
  try { if (job.dir && /[\\/]jobs[\\/][a-f0-9]+$/.test(job.dir)) fs.rmSync(job.dir, { recursive: true, force: true }); } catch { /* fine */ }
  core.jobs.delete(job.id);
  const i = core.order.indexOf(job.id); if (i >= 0) core.order.splice(i, 1);
  return n;
}

/** keep the newest `keep` finished live renders of the client; the rest (finished / failed / cancelled) go */
function prune(core, client, keep) {
  const r = C.get(clientId(client)); if (!r) return { removed: 0 };
  const k = keep == null ? KEEP : Math.max(0, keep | 0);
  const ended = r.ids.filter((id) => { const j = core.jobs.get(id); return !j || !["queued", "running"].includes(j.status); });
  const done = ended.filter((id) => { const j = core.jobs.get(id); return j && j.status === "done"; });
  const keepIds = new Set(done.slice(-k));
  let removed = 0;
  for (const id of ended) {
    if (keepIds.has(id)) continue;
    const j = core.jobs.get(id);
    if (j) { forget(core, j); removed++; }
    r.ids.splice(r.ids.indexOf(id), 1);
  }
  return { removed };
}

function finished(core, job) {
  const client = (job.params || {}).live_client;
  return client ? prune(core, client) : { removed: 0 };
}

function state(client) {
  const r = C.get(clientId(client));
  return { jobs: r ? r.ids.slice() : [] };
}

module.exports = { KEEP, clientId, supersede, track, prune, finished, state, filesOf, _reset: () => C.clear() };
