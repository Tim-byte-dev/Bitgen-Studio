// bitGen Studio — lib/jobMeta.js (2.384.0): what a job rendered WITH, and how far it has got.
//
// Tim: "when a queue is running add step n of total to the queued item instead of running and time - when the job is
// done add a slideout to the div to show metadata - seed,cfg,steps, model used,loras used (make this a dialog and show
// these details in the preview images/video dialog in a right pane)".
//
//   onLine(job, line)   called by core.log for every worker line:
//                         "[meta] {...}"                     -> job.meta (scripts/comfy_client.print_meta: the graph
//                                                               as queued - seed, steps, cfg, sampler, models, loras)
//                         "... seed -1 -> random seed N"     -> job.meta.seed = N (the seed a "-1" became)
//                         "[comfy] step v/m" / "step v/m"     -> job.step = {n, total} (the sampler's progress)
//                         tqdm "v/m [..."                      -> job.step too (sd-cli and friends)
//   metaOf(job)         the job's metadata: what the worker said, else what was asked (params: seed >= 0, cfg, steps,
//                       the style's model + loras) - {seed, cfg, steps, sampler, models, loras, style, mode, width,
//                       height, prompt, started, finished, seconds}
//   progress(job)       {step, total, pct, elapsed, chunk} for a running job (null when nothing to say)
//   entryMeta(job)      the compact copy jobs.info keeps with a finished job (so the Done tab and the preview dialog
//                       still know it after a restart)
"use strict";

const RX_META = /^\s*\[meta\]\s*(\{.*\})\s*$/;
const RX_RANDSEED = /seed\s*-1\s*->\s*random seed\s+(\d+)/i;
const RX_SEEDUSED = /\bseed used:?\s*(\d+)/i;
const RX_STEP = /\bstep\s+(\d+)\s*\/\s*(\d+)/i;
const RX_TQDM = /(?:^|\s|\|)(\d+)\/(\d+)\s*\[/;

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function onLine(job, line) {
  if (!job || typeof line !== "string") return;
  const s = line.replace(/\r?\n$/, "");
  let m = RX_META.exec(s);
  if (m) {
    try {
      const j = JSON.parse(m[1]);
      if (j && typeof j === "object") {
        job.meta = { ...(job.meta || {}), ...j };
        // a batch queues one graph per picture: every seed it used is kept
        if (Number.isFinite(j.seed)) {
          const all = new Set([...((job.meta.seeds_used) || []), j.seed]);
          job.meta.seeds_used = [...all].slice(-16);
        }
      }
    } catch { /* not JSON after all */ }
    return;
  }
  m = RX_RANDSEED.exec(s);
  if (m) { job.meta = { ...(job.meta || {}), seed: +m[1] }; return; }
  m = RX_SEEDUSED.exec(s);
  // a plan's seed can be longer than a JS number holds exactly - kept as its digits then
  if (m && m[1]) { job.meta = { ...(job.meta || {}), seed: m[1].length > 15 ? m[1] : +m[1] }; return; }
  m = RX_STEP.exec(s) || RX_TQDM.exec(s);
  if (m) {
    const n = +m[1], total = +m[2];
    if (total > 0 && n >= 0 && n <= total && total < 100000) job.step = { n, total };
  }
}

function styleOf(p) {
  return (p && (p.video_style || p.style || p.image_style)) || null;
}

function fromParams(job) {
  const p = (job && job.params) || {};
  const st = styleOf(p);
  const out = {};
  const sd = num(p.seed);
  if (sd != null && sd >= 0) out.seed = sd;
  const cf = num(p.cfg);
  if (cf != null) out.cfg = cf;
  const stp = num(p.steps);
  if (stp != null && stp > 0) out.steps = stp;
  if (st) {
    const models = [];
    if (typeof st.model === "string" && st.model) models.push(st.model.split(/[\\/]/).pop());
    (Array.isArray(st.phases) ? st.phases : []).forEach((ph) => {
      if (ph && typeof ph.model === "string" && ph.model) models.push(ph.model.split(/[\\/]/).pop());
    });
    if (models.length) out.models = [...new Set(models)];
    const loras = (Array.isArray(st.loras) ? st.loras : []).filter((l) => l && (l.path || l.name))
      .map((l) => ({ name: String(l.path || l.name).split(/[\\/]/).pop(), weight: num(l.weight) }));
    if (loras.length) out.loras = loras;
    if (st.name) out.style = st.name;
  }
  if (!out.style && (p.video_style_name || p.style_name)) out.style = p.video_style_name || p.style_name;
  return out;
}

function metaOf(job) {
  if (!job) return null;
  const p = job.params || {};
  const said = job.meta || {};
  const base = fromParams(job);
  const m = { ...base, ...said };
  // the graph's models / loras win; the style's are the fallback (a graph with no loader names says nothing)
  if ((!said.models || !said.models.length) && base.models) m.models = base.models;
  if ((!said.loras || !said.loras.length) && base.loras) m.loras = base.loras;
  m.mode = p.mode || null;
  m.width = p.width || null;
  m.height = p.height || null;
  m.prompt = typeof p.prompt === "string" ? p.prompt.slice(0, 2000) : null;
  m.started = job.started || null;
  m.finished = job.finished || null;
  m.seconds = job.started && job.finished ? Math.round((job.finished - job.started) * 10) / 10 : null;
  return m;
}

function progress(job) {
  if (!job || job.status !== "running") return null;
  const now = Date.now() / 1000;
  const st = job.step || null;
  return {
    step: st ? st.n : null, total: st ? st.total : null,
    pct: st && st.total ? Math.round(st.n / st.total * 100) : null,
    elapsed: job.started ? Math.max(0, Math.round(now - job.started)) : 0,
    chunk: job.chunk || null,
  };
}

function entryMeta(job) {
  const m = metaOf(job);
  if (!m) return null;
  const keep = {};
  for (const k of ["seed", "seeds_used", "cfg", "steps", "sampler", "models", "loras", "style", "seconds"])
    if (m[k] != null && !(Array.isArray(m[k]) && !m[k].length)) keep[k] = m[k];
  return Object.keys(keep).length ? keep : null;
}

module.exports = { onLine, metaOf, progress, entryMeta, fromParams };

/* ---- lookups (routes/jobMeta.js) - required lazily so core can require this file without a cycle */
const pathMod = require("path");
const base = (n) => pathMod.basename(String(n || ""));
function outputsOf(o) {
  return [o && o.output, ...((o && o.outputs) || [])].filter(Boolean).map(base);
}

/** The metadata of the job that made `name` (a gallery output, a scene take, a video asset): the jobs in memory,
 *  then this project's jobs.info, then the board's scenes (a take is filed under scene_<n>.mp4). */
function findByOutput(name) {
  const core = require("./core");
  const want = base(name);
  if (!want) return null;
  for (const id of [...core.order].reverse()) {
    const j = core.jobs.get(id);
    if (j && j.status === "done" && outputsOf(j).includes(want))
      return { source: "job", id: j.id, mode: (j.params || {}).mode || null, meta: metaOf(j) };
  }
  const pdir = core.projDir(core.getProject());
  try {
    const list = require("./jobsInfo").read(pdir);
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.state === "done" && outputsOf(e).includes(want))
        return { source: "jobs.info", id: e.id, mode: e.mode || null,
                 meta: { ...(e.meta || {}), mode: e.mode, width: e.width, height: e.height, prompt: e.prompt,
                         started: e.started, finished: e.finished } };
    }
  } catch { /* no history */ }
  try {
    const st = require("./scenes").load();
    for (const r of st.list || []) {
      const takes = [r.output, ...((r.takes || []).map((t) => (t && (t.file || t.name)) || t))].filter(Boolean).map(base);
      if (takes.includes(want) && (r.meta || r.seed_used != null))
        return { source: "scene", id: r.job || null, scene: r.n, mode: "scene",
                 meta: { ...(r.meta || {}), ...(r.seed_used != null ? { seed: r.seed_used } : {}),
                         prompt: (r.prompt || []).join("\n").slice(0, 2000) } };
    }
  } catch { /* no board */ }
  return null;
}

/** The seed of the most recently finished job that said one (memory, then jobs.info). */
function lastSeed() {
  const core = require("./core");
  let best = null;
  for (const j of core.jobs.values()) {
    const m = j.status === "done" ? metaOf(j) : null;
    if (m && Number.isFinite(m.seed) && (!best || (j.finished || 0) > best.finished))
      best = { seed: m.seed, id: j.id, finished: j.finished || 0 };
  }
  if (best) return best;
  try {
    const list = require("./jobsInfo").read(core.projDir(core.getProject()));
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.state === "done" && e.meta && Number.isFinite(e.meta.seed)) return { seed: e.meta.seed, id: e.id, finished: e.finished || 0 };
    }
  } catch { /* none */ }
  return null;
}

module.exports.findByOutput = findByOutput;
module.exports.lastSeed = lastSeed;
