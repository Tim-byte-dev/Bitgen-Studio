// bitGen Studio — lib/sceneSeed.js (2.384.0): which seed a board scene renders with, and the seed it used.
//
// Tim: "add the seed input to the scenes in videodocker too, so user can reuse scene. add option in settings of video
// docker to reuse same seed for all scenes and the seed input (show last seed used with option to set as seed)".
//
//   seedFor(project, r, fallback)  -> {seed, why}: the scene's OWN seed (r.user_seed, set on its card - r.seed is the
//                                     screenplay plan's shot seed) wins; else the
//                                     video docker's ⚙ "same seed for all scenes" (its seed; -1 there = the last seed
//                                     used); else `fallback` (-1 = a fresh random seed, which the worker picks and
//                                     reports)
//   setSceneSeed(project, n, v)    the card's seed box: a whole number, or blank / -1 = none (back to the ⚙ rule)
//   harvest(project, st, r, job)   a finished take: the seed it ACTUALLY used (the job's metadata - a "-1" became a
//                                  real number) and its render time go on the scene (r.seed_used, r.render_seconds,
//                                  r.meta), and the ⚙'s "last seed used" becomes it
"use strict";
const core = require("./core");
const scenes = require("./scenes");
const renderSettings = require("./renderSettings");
const jobMeta = require("./jobMeta");

function pdir(project) { return core.projDir(project || core.getProject()); }

function seedFor(project, r, fallback) {
  const fb = Number.isFinite(fallback) ? fallback : -1;
  const own = renderSettings.seedVal(r && r.user_seed, null);
  if (own != null && own >= 0) return { seed: own, why: `seed ${own} (scene ${r.n}'s own)` };
  const s = renderSettings.read(pdir(project));
  if (s.seed_mode === "same") {
    if (s.seed >= 0) return { seed: s.seed, why: `seed ${s.seed} (the video docker's ⚙: the same seed for every scene)` };
    if (s.last_seed != null) return { seed: s.last_seed, why: `seed ${s.last_seed} (the ⚙: the same seed for every scene - the last seed used)` };
  }
  return { seed: fb, why: fb >= 0 ? `seed ${fb}` : "seed: a fresh random one" };
}

/** The job params of a scene render get the scene's own / the ⚙'s same seed (force_seed: it beats a plan-linked
 *  seed); with neither, they are left as built. Returns the note to show, or null. */
function apply(project, r, params) {
  const own = seedFor(project, r, -1);
  if (!(own.seed >= 0) || !params) return null;
  params.seed = own.seed;
  params.force_seed = true;
  return own.why;
}

/** core.makeJob, before a job starts: a board SCENE's job (params.scene.n) gets the scene's seed rule - an upscale
 *  job reuses the seed its take was rendered with. Returns a note for the job's log, or null. */
function beforeJob(params, project) {
  const sc = params && params.scene;
  if (!sc || !Number.isInteger(sc.n) || sc.bridge) return null;
  const r = scenes.at(scenes.load(project), sc.n);
  if (!r) return null;
  if (sc.upscale) {
    if (Number.isSafeInteger(r.seed_used) && r.seed_used >= 0) {
      params.seed = r.seed_used; params.force_seed = true;
      return `seed ${r.seed_used} (the take's own - the upscale refines what it rendered)`;
    }
    return null;
  }
  return apply(project, r, params);
}

function setSceneSeed(project, n, v) {
  const st = scenes.load(project);
  const r = scenes.at(st, n);
  if (!r) { const e = new Error("no such scene"); e.status = 404; throw e; }
  const sv = renderSettings.seedVal(v, null);
  if (sv == null || sv < 0) delete r.user_seed; else r.user_seed = sv;
  scenes.save(st, project);
  return { n: r.n, user_seed: r.user_seed != null ? r.user_seed : null, seed_used: r.seed_used != null ? r.seed_used : null };
}

function harvest(project, st, n, job) {
  if (!job) return st;
  const r = scenes.at(st, n);
  if (!r) return st;
  const m = jobMeta.metaOf(job) || {};
  if (Number.isFinite(m.seed) || /^\d+$/.test(String(m.seed || ""))) {
    r.seed_used = m.seed;
    if (Number.isSafeInteger(Number(m.seed)))
      try { renderSettings.save(pdir(project), { last_seed: Number(m.seed) }); } catch { /* the board still files the take */ }
  }
  if (Number.isFinite(m.seconds)) r.render_seconds = m.seconds;
  const em = jobMeta.entryMeta(job);
  if (em) r.meta = em;
  return st;
}

module.exports = { seedFor, apply, beforeJob, setSceneSeed, harvest };
