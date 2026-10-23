// bitGen Studio — lib/farm.js (2.583.0): THE RENDER FARM, the asking side - a job rendered on a team member's PC.
//
// Tim: "lets just work on the render farm part for now, open the same project, get permission from owner of the client
// to render using their hardware ... a team member can get access to any of the other team members hardware to render
// but only while bitgen is running on that machine and access has been granted".
//
//   "Render on" (the status bar's 🖥 chip, config.team.target): local | <machine id> | spread
//   route(params)         -> the machine a new job goes to, or null = this PC (core.makeJob asks). Only render jobs go
//                            (FARM_MODES); "spread" = the least busy of this PC and the PCs that gave access
//   dispatch(job, m)      the job sent (its paths as @@P@@ / @@B@@ - each PC has the team's projects folder at its own
//                            path), then polled: its log lines, steps and chunks land on THIS job, so the queue, the
//                            scene card and the finish (finishDone: the project's assets, a song's record) work as for a
//                            local job; the output is already in the shared project (the renderer wrote it there)
//   cancel(job) / hello(id) / requestAccess(id, note) / access() / targets()
// Pure (scripts/test-farm583.js): tokenize, expand, outsideRoots, FARM_MODES, pick.
"use strict";
const path = require("path");

// what may be rendered for someone else: generation jobs - never an install / download / tool job, training, the movie
// export or the quick ffmpeg-only jobs (a karaoke overlay, a bridge, stems) that are not worth sending
const NOT_FARM = /^(install_|ft_|lora_|download$|convert$|export$|karaoke$|bridge$|stems$|viggle_native$|tts$|asr$)/;
const isFarmMode = (m) => !!m && !NOT_FARM.test(String(m));
const FARM_MODES = "every generation mode (image, video, music, graph, swap, LTX, Wan, upscales, 3D …)";

/* ------------------------------------------------------------------ pure */
const norm = (p) => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "");
const lc = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
/** absolute paths under the projects folder / the app -> @@P@@/… / @@B@@/… (pure: roots = {P, B}) */
function tokenize(v, roots) {
  const R = Object.entries(roots || {}).filter(([, r]) => r).map(([k, r]) => [k, norm(r)]).sort((a, b) => b[1].length - a[1].length);
  const one = (s) => {
    const n = norm(s);
    for (const [k, r] of R) {
      if (lc(n) === lc(r)) return `@@${k}@@`;
      if (lc(n).startsWith(lc(r) + "/")) return `@@${k}@@/` + n.slice(r.length + 1);
    }
    return s;
  };
  if (typeof v === "string") return one(v);
  if (Array.isArray(v)) return v.map((x) => tokenize(x, roots));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = tokenize(v[k], roots); return o; }
  return v;
}
/** @@P@@/… -> this PC's paths (pure) */
function expand(v, roots) {
  if (typeof v === "string") {
    const m = /^@@([A-Z])@@(?:\/(.*))?$/.exec(v);
    if (m && roots && roots[m[1]]) return m[2] ? path.join(roots[m[1]], ...m[2].split("/")) : roots[m[1]];
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => expand(x, roots));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = expand(v[k], roots); return o; }
  return v;
}
/** absolute paths in the params that are NOT under these roots (a renderer refuses a job that reads elsewhere) (pure) */
function outsideRoots(v, roots, out) {
  const acc = out || [];
  const R = Object.values(roots || {}).filter(Boolean).map((r) => lc(norm(r)));
  if (typeof v === "string") {
    if (/(^|[\\/])\.\.([\\/]|$)/.test(v) && v.length < 1024 && !/\s/.test(v)) { acc.push(v); return acc; }     // a relative path climbing out
    if (/^([A-Za-z]:[\\/]|\/(?!\/))/.test(v) && v.length < 1024 && !/\s{2,}|\n/.test(v)) {
      const n = lc(norm(v));
      if (!R.some((r) => n === r || n.startsWith(r + "/"))) acc.push(v);
    }
  } else if (Array.isArray(v)) v.forEach((x) => outsideRoots(x, roots, acc));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => outsideRoots(x, roots, acc));
  return acc;
}
/** "spread": the least busy - this PC wins a tie (pure) -> "local" | machine id */
function pick(localLoad, machines) {
  let best = { id: "local", load: localLoad };
  for (const m of machines || []) if (m.load < best.load) best = { id: m.id, load: m.load };
  return best.id;
}

/* ------------------------------------------------------------------ live */
const T = () => require("./team");
const core = () => require("./core");
let fetchFn = null;
function setFetch(f) { fetchFn = f; }
const F = () => fetchFn || fetch;
const addrCache = new Map();          // machine id -> working base URL
const accessCache = new Map();        // machine id -> {at, hello}

function roots() { const C = core(); return { P: C.PROJECTS_DIR, B: C.BASE }; }
/** the team's projects folder in use on this PC? (else a job's files are not where the others look) */
function sharedProjects() {
  const c = T().cfg(); if (!c.folder) return false;
  const marker = T().readJson(path.join(core().PROJECTS_DIR, ".bitgen-team.json"));
  const pin = T().pinned();
  return !!(marker && pin && marker.team === pin.team);
}
async function baseUrl(m) {
  if (addrCache.has(m.id)) return addrCache.get(m.id);
  for (const ip of m.addresses || []) {
    const u = `http://${ip}:${m.port || 8312}`;
    try {
      const r = await F()(u + "/farm/ping", { signal: AbortSignal.timeout(1500) });
      const j = r.ok ? await r.json() : null;
      if (j && j.id === m.id) { addrCache.set(m.id, u); return u; }
    } catch { /* the next address */ }
  }
  throw new Error(`${m.member}'s PC (${m.name}) does not answer - is bitGen running there, and the PC on the network / Tailscale?`);
}
async function call(m, method, p, body) {
  const u = await baseUrl(m);
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = Object.assign({ "Content-Type": "application/json" }, T().signHeaders(method, p.split("?")[0], raw));
  let r;
  try { r = await F()(u + p, { method, headers: h, body: method === "GET" ? undefined : raw, signal: AbortSignal.timeout(15000) }); }
  catch (e) { addrCache.delete(m.id); throw new Error(`${m.member}'s PC did not answer: ${e.message || e}`); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `HTTP ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
const byId = (id) => T().machines().find((m) => m.id === id);

/** what this PC may do on each online team PC -> [{id, name, member, online, sharing, access, pending, load, jobs}] */
async function targets(fresh) {
  const ms = T().machines().filter((m) => !m.me);
  const out = [];
  await Promise.all(ms.map(async (m) => {
    const row = { id: m.id, name: m.name, member: m.member, online: m.online, sharing: !!m.sharing, access: null, pending: false, error: "",
      load: (m.jobs || []).filter((j) => j.status === "running" || j.status === "queued").length, jobs: m.jobs || [] };
    if (m.online && m.sharing) {
      const c = accessCache.get(m.id);
      if (!fresh && c && Date.now() - c.at < 20000) Object.assign(row, c.v);
      else {
        try { const h = await call(m, "POST", "/farm/hello", {}); const v = { access: h.access || null, pending: !!h.pending }; accessCache.set(m.id, { at: Date.now(), v }); Object.assign(row, v); }
        catch (e) { row.error = e.message; }
      }
    }
    out.push(row);
  }));
  return out.sort((a, b) => (b.online - a.online) || String(a.member).localeCompare(String(b.member)));
}
const allowedNow = (a, now) => !!a && (a.level === "unrestricted" || (a.level === "window" && (now == null ? Date.now() : now) >= +new Date(a.from) && (now == null ? Date.now() : now) <= +new Date(a.to)));

/** a new job: which PC renders it? -> machine record | null (this PC) */
function route(params) {
  const c = T().cfg();
  const target = c.target || "local";
  if (target === "local" || !c.folder || !isFarmMode((params || {}).mode)) return null;
  if (!sharedProjects()) return null;                         // the others could not see this project's files
  if (target === "spread") {
    const C = core();
    const localLoad = C.queue.length + (C.isRunning() ? 1 : 0);
    const cands = T().machines().filter((m) => !m.me && m.online && m.sharing)
      .filter((m) => { const a = accessCache.get(m.id); return a && allowedNow(a.v.access); })
      .map((m) => ({ id: m.id, load: (m.jobs || []).filter((j) => j.status === "running" || j.status === "queued").length }));
    const id = pick(localLoad, cands);
    return id === "local" ? null : byId(id) || null;
  }
  return byId(target) || { id: target, name: "the chosen PC", member: "?", addresses: [], offline: true };
}

/** the job sent and followed */
function dispatch(job, m) {
  const C = core();
  const fail = (why) => { job.status = "failed"; job.finished = Date.now() / 1000; C.log(job, "[team] " + why); C.recordJob(job); };
  (async () => {
    if (m.offline || !m.online) return fail(`${m.member && m.member !== "?" ? m.member + "'s PC" : "that PC"} is not online - 🖥 Render on ▸ This PC, or another PC`);
    let rid;
    try {
      const label = String(job.params.label || job.params.scene_name || job.params.title || job.params.prompt || job.params.mode).replace(/\s+/g, " ").slice(0, 80);
      const r = await call(m, "POST", "/farm/jobs", { project: job.project, params: tokenize(job.params, roots()), label });
      rid = r.id;
    } catch (e) { return fail(`${m.member}'s PC refused the job: ${e.message}`); }
    job.remote.id = rid;
    C.log(job, `[team] queued on ${m.name} (${m.member}) as ${rid}`);
    C.recordJob(job);
    let from = 0, misses = 0;
    for (;;) {
      await new Promise((r) => setTimeout(r, 1500));
      if (job.status === "cancelled") return;
      let s;
      try { s = await call(m, "GET", `/farm/jobs/${rid}?log_from=${from}`); misses = 0; }
      catch (e) { misses += e.status >= 400 && e.status < 500 ? 5 : 1; if (misses > 40) return fail(`lost ${m.member}'s PC: ${e.message}`); continue; }   // refused (4xx): give up after ~12 s, a lost network after ~1 min
      for (const l of s.log || []) C.log(job, l);
      from = s.log_next || from;
      if (s.status === "running" && job.status !== "running") { job.status = "running"; job.started = Date.now() / 1000; C.recordJob(job); }
      if (s.status === "done") {
        job.output = s.output; job.outputs = s.outputs || null; job.finished = Date.now() / 1000;
        if (!job.started) job.started = job.created;
        for (let i = 0; i < 20 && !C.outputExists(job.output, job.project); i++) await new Promise((r) => setTimeout(r, 1000));   // the NAS catching up
        if (job.output && C.outputExists(job.output, job.project)) C.finishDone(job);
        else return fail(`${m.member}'s PC finished, but ${job.output} is not in the project's output folder here`);
        C.log(job, `[team] rendered on ${m.name} (${m.member})`);
        C.recordJob(job);
        return;
      }
      if (s.status === "failed" || s.status === "cancelled") return fail(`on ${m.member}'s PC: ${s.status}${s.error ? " - " + s.error : ""}`);
    }
  })().catch((e) => fail(String((e && e.message) || e)));
}
function cancel(job) {
  const m = byId(job.remote && job.remote.machine);
  if (!m || !job.remote.id) return;
  call(m, "POST", `/farm/jobs/${job.remote.id}/cancel`, {}).catch(() => { /* it ends there anyway */ });
}
async function hello(id) { const m = byId(id); if (!m) throw new Error("that PC is not in the team list"); accessCache.delete(id); return call(m, "POST", "/farm/hello", {}); }
async function requestAccess(id, note) { const m = byId(id); if (!m) throw new Error("that PC is not in the team list"); accessCache.delete(id); return call(m, "POST", "/farm/request", { note: String(note || "").slice(0, 200) }); }

module.exports = { FARM_MODES, isFarmMode, tokenize, expand, outsideRoots, pick, allowedNow, roots, sharedProjects, route, dispatch, cancel, hello, requestAccess, targets, setFetch, _caches: { addrCache, accessCache } };
