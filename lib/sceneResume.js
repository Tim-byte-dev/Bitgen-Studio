// bitGen Studio — lib/sceneResume.js (2.562.0): a scene's job interrupted by a restart comes BACK to its scene when it is
// resumed in the Queue docker.
//
// Tim: "when server is restarted and the job is resumed in the queue docker replace ⚠ the job vanished (server
// restarted?) in the scene in storyboard docker with the progressbar".
// Found: after a restart the board's poll (routes/characters.js syncJobs, lib/sceneEdit.js harvest) found the scene's job
// gone from memory, failed the scene ("the job vanished (server restarted?)") and FORGOT the job id - so ↻ Resume in the
// Queue docker's Pending tab ran the job (same id, routes/index.js) but no scene was waiting for it any more.
//   lost(row, kind, id, resumable)  the row keeps the id it lost (row.lost {job | upjob | qedit}) + the words: resumable
//                                   (an interrupted pending entry in jobs.info) = "interrupted by a restart - ↻ Resume it in
//                                   the Queue docker (Pending) to carry on"
//   relinkRows(list, id)            -> the rows that take the job back: the render job = running again (the card's progress
//                                   bar), the upscale job, the ✎ First frame job - only where nothing newer took its place
//   relink(project, id)             the board loaded, relinked, saved (POST /api/jobs/history/:id/resume)
//   forget(project, id)             a Discarded entry: the rows stop waiting for it
//   resumable(projDir, id)          jobs.info has it pending with its params
//   safeLost(x)                     the sanitizer's (lib/scenes.js safe)
"use strict";

const KINDS = ["job", "upjob", "qedit"];
const ID = /^[\w.-]{1,80}$/;
const WORDS = {
  resumable: "interrupted by a restart - ↻ Resume it in the Queue docker (Pending tab) and it carries on here",
  gone: "the job vanished (server restarted?)",
};

function safeLost(x) {
  if (!x || typeof x !== "object") return undefined;
  const o = {};
  for (const k of KINDS) if (typeof x[k] === "string" && ID.test(x[k])) o[k] = x[k];
  return Object.keys(o).length ? o : undefined;
}

/** jobs.info has `id` as an interrupted pending entry that can be resumed */
function resumable(projDir, id) {
  if (!projDir || !id) return false;
  try { return require("./jobsInfo").read(projDir).some((e) => e && e.id === id && e.state === "pending" && !!e.params); }
  catch { return false; }
}

/** the row remembers the job it lost; -> the words for its ⚠ */
function lost(row, kind, id, isResumable) {
  if (!row || !KINDS.includes(kind) || !id || !ID.test(String(id))) return WORDS.gone;
  row.lost = Object.assign({}, safeLost(row.lost) || {}, { [kind]: String(id) });
  return isResumable ? WORDS.resumable : WORDS.gone;
}

/** the rows waiting for job `id` take it back (mutates them); -> [{n, kind}] */
function relinkRows(list, id, now) {
  const out = [];
  if (!id) return out;
  for (const r of list || []) {
    const L = safeLost(r && r.lost); if (!L) continue;
    for (const k of KINDS) {
      if (L[k] !== id) continue;
      delete L[k];
      if (k === "job") {
        if (r.job) continue;                                   // a newer render took its place
        r.job = id; r.status = "running"; r.error = "";
        r.updated = (now || new Date()).toISOString();
      } else if (k === "upjob") {
        if (r.upjob) continue;
        r.upjob = id; r.error = "";
      } else {
        if (!r.qedit || r.qedit.job) continue;
        r.qedit = Object.assign({}, r.qedit, { job: id, status: "running", error: "" });
      }
      out.push({ n: r.n, kind: k });
    }
    r.lost = safeLost(L);
  }
  return out;
}

/** a row no longer waits for job `id` (the entry was discarded); its words say it plainly */
function forgetRows(list, id) {
  let n = 0;
  for (const r of list || []) {
    const L = safeLost(r && r.lost); if (!L) continue;
    for (const k of KINDS) if (L[k] === id) {
      delete L[k]; n++;
      if (k === "qedit") { if (r.qedit && r.qedit.error === WORDS.resumable) r.qedit = Object.assign({}, r.qedit, { error: "the interrupted job was discarded" }); }
      else if (r.error === WORDS.resumable) r.error = "the interrupted job was discarded";
    }
    r.lost = safeLost(L);
  }
  return n;
}

function withBoard(project, fn) {
  const scenes = require("./scenes");
  const st = scenes.load(project);
  const res = fn(st.list || []);
  if ((Array.isArray(res) ? res.length : res) > 0) scenes.save(st, project);
  return res;
}
const relink = (project, id) => withBoard(project, (list) => relinkRows(list, id));
const forget = (project, id) => withBoard(project, (list) => forgetRows(list, id));

module.exports = { KINDS, WORDS, safeLost, resumable, lost, relinkRows, forgetRows, relink, forget };
