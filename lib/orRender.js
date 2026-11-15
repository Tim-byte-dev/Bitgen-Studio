/* bitGen Studio — lib/orRender.js (2.786.0): PICTURES AND VIDEO RENDERED ON OPENROUTER (paid) - an "openrouter/<id>" model picked
 * in Basic Settings (Use model ticked), or ☁ Remote generation ▸ Runs on ▸ Image / Video = OpenRouter.
 *
 * Tim (verbatim): "if use model is selected and an openrouter model is selected use openrouter" + (the agreed design) the
 * picked model decides where it runs; OpenRouter does not take Basic Settings' steps / CFG / sampler / LoRAs; the price is
 * shown before a paid render and kept in 💲 Costs.
 *
 *   modelFor(kind, picked)   -> {id, entry, why} | {error} | null (not OpenRouter):
 *                              picked "openrouter/<id>" = that model (Use model + Override style);
 *                              else Runs on <kind> = OpenRouter -> rgpu.openrouter.use[kind], else the first of your list
 *   styleFor(base, kind, m, o) the render's style: the job's style copy with runs_on "api", api_id "__openrouter",
 *                              api_model <id>, api_extra {duration / aspect_ratio snapped to what the model takes} -
 *                              misc/api_worker.py run_openrouter renders it (POST /images · POST /videos -> poll -> content)
 *   jobApis(cfg, params)       job.json's config.apis gets OpenRouter's key (Settings ▸ Remote generation ▸ OpenRouter) for
 *                              such a job - lib/core.js startJob
 *   check(kind, picked, o)     POST /api/ormodels/check (static/orcost.js asks before a render is sent): {openrouter, id, name,
 *                              estimate {usd, text}, ignored: [Basic Settings parts OpenRouter does not take]}
 *   runs / setRuns             rgpu.openrouter.runs {image, video} - lib/remoteHosts.js reads / writes it
 * Pure (scripts/test-ormodels786.js): PREFIX, idOf, styleFor, IGNORED.
 */
"use strict";
const PREFIX = "openrouter/";
const API_ID = "__openrouter";
const KINDS = ["image", "video"];
/** "openrouter/google/veo-3.1" -> "google/veo-3.1"; anything else -> "" (pure) */
function idOf(picked) {
  const s = String(picked || "").trim();
  return s.toLowerCase().startsWith(PREFIX) && s.length > PREFIX.length ? s.slice(PREFIX.length) : "";
}
/** what Basic Settings sends that OpenRouter does not take (pure) - said in the log and before the render */
const IGNORED = { image: ["steps", "CFG", "sampler / scheduler", "LoRAs"], video: ["steps", "CFG", "LoRAs"] };
/** the style a job renders with on OpenRouter (pure): a COPY - the style file never changes.
 *  base = the job's style (or null), m = your list's entry ({id, name, caps}), o = {w, h, seconds} */
function styleFor(base, kind, m, o) {
  const OM = require("./orModels"), x = o || {}, extra = {};
  if (kind === "video") {
    extra.duration = OM.snapDuration(m.caps, x.seconds);
    const a = OM.snapAspect(m.caps, x.w, x.h); if (a) extra.aspect_ratio = a;
  } else {
    const a = OM.snapAspect(m.caps, x.w, x.h); if (a) extra.aspect_ratio = a;
  }
  const s = Object.assign({}, base || {}, { runs_on: "api", api_id: API_ID, api_model: m.id, api_extra: extra, api_auto: false,
    name: "OpenRouter · " + (m.name || m.id), openrouter: { id: m.id, name: m.name || m.id, from_style: base ? base.name || "" : "" } });
  delete s.loras; delete s.workflow; delete s.workflows;
  return s;
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function runs() { const r = (rg().openrouter || {}).runs || {}; return { image: !!r.image, video: !!r.video }; }
function setRuns(want) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, o = r.openrouter = Object.assign({}, r.openrouter || {});
  o.runs = Object.assign(runs(), {});
  for (const k of KINDS) if (k in (want || {})) o.runs[k] = !!want[k];
  core().setConfig(c);
  return runs();
}
function useOf(kind) { return String((((rg().openrouter || {}).use) || {})[kind] || ""); }
function setUse(kind, id) {
  const c = core().getConfig(), r = c.rgpu = c.rgpu || { mode: "local" }, o = r.openrouter = Object.assign({}, r.openrouter || {});
  o.use = Object.assign({}, o.use || {}, { [kind]: String(id || "").slice(0, 200) });
  core().setConfig(c);
}
function modelFor(kind, picked) {
  if (!KINDS.includes(kind)) return null;
  const OM = require("./orModels"), id = idOf(picked);
  if (id) {
    const m = OM.find(id, kind);
    if (!m) return { error: `${id} is not in your OpenRouter ${kind === "image" ? "picture" : "video"} models - add it in 🧩 Model manager ▸ ☁ OpenRouter (＋)` };
    if (m.dead) return { error: `${m.name || id} is no longer on OpenRouter (red in 🧩 Model manager) - pick another model, or 🗑 it there` };   // 2.792.0
    return { id, entry: m, why: "picked in Basic Settings" };
  }
  if (!runs()[kind]) return null;
  const list = OM.mine()[kind].filter((x) => !x.dead), want = useOf(kind), m = list.find((x) => x.id === want) || list[0];   // 2.792.0: not a dead one
  if (!m) return { error: `☁ Remote generation ▸ Runs on ▸ ${kind === "image" ? "Image" : "Video"} is OpenRouter, but your OpenRouter ${kind === "image" ? "picture" : "video"} models list has none OpenRouter still lists - add one in 🧩 Model manager ▸ ☁ OpenRouter (＋)` };
  return { id: m.id, entry: m, why: "☁ Runs on ▸ " + (kind === "image" ? "Image" : "Video") + " = OpenRouter" };
}
/** the key check every OpenRouter render needs */
function keyError() { return require("./openRouter").cfg().key ? "" : "OpenRouter needs an API key - ☁ Remote generation ▸ ⚙ Settings ▸ Remote generation ▸ OpenRouter (openrouter.ai/keys)"; }
function check(kind, picked, o) {
  const k = kind === "video" ? "video" : "image", r = modelFor(k, picked);
  if (!r) return { openrouter: false };
  if (r.error) return { openrouter: true, error: r.error };
  const ke = keyError(); if (ke) return { openrouter: true, error: ke };
  const x = o || {}, est = require("./orModels").estimate(r.entry, { n: x.n, seconds: x.seconds, w: x.w, h: x.h });
  return { openrouter: true, id: r.id, name: r.entry.name, why: r.why, free: !!r.entry.free, estimate: est, ignored: IGNORED[k], price: r.entry.price };
}
/** job.json gets OpenRouter's key for an OpenRouter render (lib/core.js) - nothing else changes */
function jobApis(cfg, params) {
  const p = params || {}, st = p.video_style || p.style || {};
  if (st.api_id !== API_ID) return false;
  const o = ((cfg.rgpu || {}).openrouter) || {};
  cfg.apis = { [API_ID]: { name: "OpenRouter", service: "openrouter", key: String(o.key || ""), use: true, ...(process.env.H3_OPENROUTER_API ? { base: process.env.H3_OPENROUTER_API.replace(/\/+$/, "") } : {}) } };
  return true;
}
const isOrStyle = (st) => !!(st && st.api_id === API_ID);
module.exports = { PREFIX, API_ID, KINDS, IGNORED, idOf, styleFor, runs, setRuns, useOf, setUse, modelFor, keyError, check, jobApis, isOrStyle };
