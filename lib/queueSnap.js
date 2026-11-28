// bitGen Studio — lib/queueSnap.js (3.15.0): every queued job keeps the Settings it was QUEUED with.
// Tim (verbatim): "save settings for every queued item separately so queued item doesn't take on settings that change while
// the queue is running"
// Before: a job's params (prompt, style, size, steps, Basic Settings' sampler ...) were fixed when it was queued, but the
// Settings (custom.settings - ComfyUI's options, models, paths, free-before-render, 16 GB mode ...) and the project's render
// settings (the H3 size fit) were read when it STARTED - a change made while the queue ran reached every job still waiting.
//   take(job, cfg, proj)    at makeJob: a copy of the resolved Settings + the render settings it depends on, kept on the job
//                           NON-enumerable (never in jobs.info, the queue list or a job's JSON) and without the API keys
//   use(job, live)          at start: {config (the queued copy, the API keys from now - a fixed key still works), changed
//                           (what differs from now, in words), h3_fit}; a job with no copy (one restored after a restart):
//                           the live ones
// Pure apart from the job it is given (scripts/test-31500.js).
"use strict";
const KEY = "_queuedSettings";

function strip(cfg) { const c = structuredClone(cfg || {}); delete c.apis; return c; }

function take(job, cfg, extra) {
  if (!job || !cfg) return;
  Object.defineProperty(job, KEY, { value: { cfg: strip(cfg), extra: Object.assign({}, extra || {}), at: Date.now() }, enumerable: false, writable: true, configurable: true });
}

/** the top-level Settings sections that differ (engine.comfy.x style paths, a few) */
function diff(a, b, pre, out) {
  const ks = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
  for (const k of ks) {
    if (out.length >= 6) break;
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined, p = pre ? pre + "." + k : k;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x) && p.split(".").length < 3) diff(x, y, p, out);
    else out.push(p);
  }
  return out;
}

function use(job, live) {
  const s = job && job[KEY];
  if (!s) return { config: live, changed: [], h3_fit: null, queued: false };
  const config = structuredClone(s.cfg);
  if (live && live.apis) config.apis = structuredClone(live.apis);
  const changed = diff(s.cfg, strip(live), "", []);
  try { delete job[KEY]; } catch { /* fine */ }
  return { config, changed, h3_fit: s.extra.h3_fit || null, queued: true, at: s.at };
}

module.exports = { take, use, KEY, diff };
