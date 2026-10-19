"use strict";
/**
 * jobsInfo.js — THE PROJECT'S JOB QUEUE ON DISK (2.113.0, by instruction).
 *
 * Tim: "save the job queues for the projects, in projects\<name>\jobs.info,
 * mark the jobs as done or pending, load when project loads."
 *
 *     projects/<p>/jobs.info      JSON array, newest last:
 *     { id, state: "pending"|"done", status, mode, prompt, width, height,
 *       output, created, started, finished, params? }
 *
 * `state` is the two-tab answer — PENDING (queued / running / interrupted
 * by a restart) or DONE (done / failed / cancelled); `status` keeps the
 * finer word. A pending entry keeps its `params` so it can be RESUMED after
 * a restart (core.makeJob with the same id and folder); a done entry drops
 * them — the output file is the record.
 *
 * core.js calls record() on every transition (queued, running, done,
 * failed, cancelled). Jobs that ran under another project are recorded in
 * THAT project's file: the job remembers its project at creation.
 */
const fs = require("fs");
const path = require("path");

const FILE = "jobs.info";
const MAX = 400;
const DONE_STATES = ["done", "failed", "cancelled"];

function file(projDir) { return path.join(projDir, FILE); }

function stateOf(status) { return DONE_STATES.includes(status) ? "done" : "pending"; }

function read(projDir) {
  try {
    const j = JSON.parse(fs.readFileSync(file(projDir), "utf8"));
    return Array.isArray(j) ? j.filter((e) => e && e.id) : [];
  } catch { return []; }
}

function write(projDir, list) {
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(file(projDir), JSON.stringify(list.slice(-MAX), null, 2));
}

/** An entry from a live job object (core's shape). */
function entryFor(job) {
  const p = job.params || {};
  const state = stateOf(job.status);
  const e = {
    id: job.id, state, status: job.status,
    mode: p.mode || "", prompt: String(p.prompt || "").slice(0, 400),
    width: p.width || null, height: p.height || null,
    output: job.output || null, outputs: job.outputs || null,
    created: job.created || null, started: job.started || null, finished: job.finished || null,
  };
  if (state === "pending") e.params = p;        // needed to resume after a restart
  if (job.energy) e.energy = job.energy;         // 2.517.0: ⚡ the energy it used (lib/power.js)
  // 2.384.0: what it rendered with (seed, cfg, steps, models, loras) - the Done tab's ⓘ and the preview dialog
  try { const m = require("./jobMeta").entryMeta(job); if (m) e.meta = m; } catch { /* metadata is optional */ }
  return e;
}

/** Upsert the job's entry in its project's file. Never throws. */
function record(projDir, job) {
  try {
    const list = read(projDir);
    const e = entryFor(job);
    const i = list.findIndex((x) => x.id === e.id);
    if (i >= 0) list[i] = e; else list.push(e);
    write(projDir, list);
    return e;
  } catch { return null; }
}

function remove(projDir, id) {
  const list = read(projDir);
  const n = list.filter((x) => x.id !== id);
  if (n.length === list.length) return false;
  write(projDir, n);
  return true;
}

/** Entries not currently in memory: the history a fresh server shows. A
 *  pending one from a previous run is marked `interrupted` so the UI offers
 *  Resume instead of pretending it is running. */
function history(projDir, liveIds) {
  const live = new Set(liveIds || []);
  return read(projDir).filter((e) => !live.has(e.id)).map((e) =>
    e.state === "pending" ? { ...e, status: "interrupted", interrupted: true } : e);
}

/** 2.260.0 ("clear the done queue"): drop every DONE entry, keep the
 *  pending ones (they are the resume list). Returns how many went. */
function clearDone(projDir) {
  const all = read(projDir);
  const keep = all.filter((e) => e.state === "pending");
  if (keep.length === all.length) return 0;
  write(projDir, keep);
  return all.length - keep.length;
}

module.exports = { FILE, MAX, DONE_STATES, file, stateOf, read, write, entryFor, record, remove, history, clearDone };
