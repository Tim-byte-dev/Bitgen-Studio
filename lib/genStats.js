// bitGen Studio — lib/genStats.js (2.771.0): HOW LONG EACH GENERATION TOOK - its startup, its generation, the total - and
// every time a pod was made ready for one.
// Tim (verbatim): "record the time it takes to prepare a pod for generation each time it needs new uploads or restarts etc.
// record generation for each generation separately - show user startup time, generation time and total time" + "statistics
// go is Statistics Dialog"
//
//   A GENERATION (one line per finished render - not installs, downloads, the timeline's compile or ⚡ live renders):
//     queued   created -> it reached the head of the queue (waiting behind other jobs)
//     startup  the head of the queue -> ComfyUI was handed the workflow: a pod started / made ready (files, node packs,
//              ComfyUI updated / restarted - lib/stylePods.js, lib/podPrep.js), the worker started, the graph built
//              (core.js marks _prepAt when a pod gate first holds the job; the worker's "[meta] {...}" line - printed by
//              scripts/comfy_client.queue right before /prompt - marks _genAt)
//     generation  ComfyUI handed the workflow -> the job finished (an API_ style: the whole run - the service renders)
//     total    startup + generation
//     where    local | runpod (a pod) | api | serverless | url / ssh (a remote GPU) - the pod's id, the label
//     api_usd  an API_ style's own figure ("[api] OpenRouter: about $0.04 for this" - misc/api_worker.py)
//     preps    the pod preparations that ran while it waited (below)
//   A POD PREPARATION (lib/podPrep.prepare + a stopped pod started - lib/stylePods.ready): the pod, how long, its phases in
//     ms (check / update / repair / nodes / restart / download / send / link / start) and the styles
//   Files: usage/genstats-YYYY-MM.jsonl {k: "gen"|"prep", ...} - per machine, beside the usage log (lib/usageLog.js)
//   GET /api/genstats?from&to (routes/genStats.js) -> {gens, preps, totals} for the 📊 Statistics dialog (static/statsdlg.js)
// Pure (scripts/test-genstats771.js): entryFor, phaseOf, phasesOf, summarize, whereOf, toCsv.
"use strict";
const fs = require("fs");
const path = require("path");

const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ms = (v) => Math.max(0, Math.round(+v || 0));
const RX_META = /^\s*\[meta\]\s*\{/;
const RX_APIUSD = /^\s*\[api\][^\n]*?about \$\s*([\d.]+)/i;
// modes that are not a generation (installs, downloads, compiles) - core.js passes its TOOL_MODES too
const NOT_GEN = new Set(["export", "karaoke", "download", "convert", "install_llm", "install_sdcli", "install_whisper", "install_omnivoice",
  "install_demucs", "install_aitoolkit", "install_unsloth"]);

/** where a job ran (pure): job._ranOn {mode, label} | {api: true} */
function whereOf(job) {
  const r = (job && job._ranOn) || null, p = (job && job.params) || {}, st = p.video_style || p.style || {};
  const pod = String((p.pod_job && p.pod_job.pod_id) || (st.runs_on === "pod" && st.pod_id) || "");
  if (r && r.api) return { where: "api", label: String(r.label || "API"), api_id: String(st.api_id || ""), pod: "" };
  if (pod) return { where: "runpod", label: "RunPod pod " + pod, pod };
  if (r && r.mode && r.mode !== "local") return { where: String(r.mode), label: String(r.label || r.mode), pod: "" };
  return { where: "local", label: "this computer", pod: "" };
}
/** a finished job -> its statistics line (pure); preps = the pod preparations that ran while it waited */
function entryFor(job, preps) {
  const p = job.params || {};
  const created = Math.round((+job.created || 0) * 1000), started = job.started ? Math.round(job.started * 1000) : 0;
  const finished = Math.round((+job.finished || Date.now() / 1000) * 1000);
  const head = job._prepAt || started || finished;                 // the head of the queue
  const gen = job._genAt || (started && started <= finished ? started : finished);   // ComfyUI handed the workflow
  const w = whereOf(job);
  const out = {
    k: "gen", v: 1, t: finished, day: ymd(finished), id: String(job.id || ""), project: String(job.project || ""), mode: String(p.mode || ""),
    status: String(job.status || ""),
    what: String(p.style_name || p.video_style_name || (p.style && p.style.name) || (p.video_style && p.video_style.name) || "").slice(0, 80),
    prompt: String(p.prompt || "").replace(/\s+/g, " ").slice(0, 120),
    where: w.where, label: w.label, pod: w.pod,
    queued_ms: created && head >= created ? ms(head - created) : 0,
    startup_ms: ms(Math.min(gen, finished) - head),
    gen_ms: job._genAt || started ? ms(finished - Math.max(gen, head)) : 0,
  };
  out.total_ms = out.startup_ms + out.gen_ms;
  if (!job._genAt && !started) out.never_started = true;          // stopped before it ran (its pod could not be used)
  if (w.api_id) out.api_id = w.api_id;
  if (job._apiUsd) out.api_usd = Math.round(job._apiUsd * 10000) / 10000;
  if (preps && preps.length) out.preps = preps.map((x) => ({ at: x.at, ms: x.ms, kind: x.kind, phases: x.phases }));
  return out;
}
/** a pod-preparation note -> its phase (pure) */
function phaseOf(note) {
  const n = String(note || "").toLowerCase();
  if (/repair/.test(n)) return "repair";
  if (/restart|reboot/.test(n)) return "restart";
  if (/updat(e|ing) comfyui|comfyui on the (new )?pod is (updated|already)|older than .* needs/.test(n)) return "update";
  if (/node pack|custom node|nodes these workflows/.test(n)) return "nodes";
  if (/download|waiting for the pod's jupyter/.test(n)) return "download";
  if (/sending|sent |upload/.test(n)) return "send";
  if (/linked into|looking for .* on the pod|to list the new files/.test(n)) return "link";
  if (/starting the stopped pod|waiting for the pod|pod is starting|loading/.test(n)) return "start";
  return "check";
}
/** timed notes [{t, note}] + the end -> {phase: ms} (pure): each note's phase lasts until the next note */
function phasesOf(notes, end) {
  const out = {};
  const l = (notes || []).filter((x) => x && x.t).sort((a, b) => a.t - b.t);
  for (let i = 0; i < l.length; i++) {
    const until = i + 1 < l.length ? l[i + 1].t : (end || l[i].t);
    const ph = phaseOf(l[i].note);
    out[ph] = (out[ph] || 0) + ms(until - l[i].t);
  }
  return out;
}
const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
/** the dialog's figures (pure): totals + averages for all, per place and per mode */
function summarize(gens, preps) {
  const g = (gens || []).slice().sort((a, b) => b.t - a.t), pr = (preps || []).slice().sort((a, b) => b.at - a.at);
  const group = (key) => {
    const by = {};
    for (const x of g) { const k = x[key] || "?"; (by[k] = by[k] || []).push(x); }
    return Object.keys(by).sort().map((k) => ({ key: k, label: key === "where" ? (by[k][0].where === "local" ? "this computer" : by[k][0].where === "runpod" ? "RunPod pods" : by[k][0].label) : k,
      count: by[k].length, startup_avg: avg(by[k].map((x) => x.startup_ms)), gen_avg: avg(by[k].map((x) => x.gen_ms)), total_avg: avg(by[k].map((x) => x.total_ms)),
      total_ms: by[k].reduce((s, x) => s + x.total_ms, 0) }));
  };
  const phases = {};
  for (const p of pr) for (const [k, v] of Object.entries(p.phases || {})) phases[k] = (phases[k] || 0) + v;
  const done = g.filter((x) => x.status === "done");
  return {
    gens: g, preps: pr,
    totals: {
      count: g.length, done: done.length, failed: g.filter((x) => x.status === "failed").length,
      startup_ms: g.reduce((s, x) => s + x.startup_ms, 0), gen_ms: g.reduce((s, x) => s + x.gen_ms, 0), total_ms: g.reduce((s, x) => s + x.total_ms, 0),
      startup_avg: avg(g.map((x) => x.startup_ms)), gen_avg: avg(g.map((x) => x.gen_ms)), total_avg: avg(g.map((x) => x.total_ms)),
      gen_avg_done: avg(done.map((x) => x.gen_ms)),
      preps: pr.length, prep_ms: pr.reduce((s, x) => s + x.ms, 0), prep_avg: avg(pr.map((x) => x.ms)), phases,
      by_where: group("where"), by_mode: group("mode"),
    },
  };
}
/** CSV (pure): kind gens | preps */
function toCsv(kind, rows) {
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const sec = (v) => Math.round((+v || 0) / 100) / 10;
  if (kind === "preps") {
    const P = ["check", "start", "update", "repair", "nodes", "restart", "download", "send", "link"];
    return [["when", "day", "pod", "kind", "styles", "seconds"].concat(P.map((x) => x + "_s")).concat(["problems"]).join(",")]
      .concat((rows || []).map((r) => [new Date(r.at).toISOString(), ymd(r.at), r.pod, r.kind, (r.styles || []).join(" / "), sec(r.ms)]
        .concat(P.map((x) => sec((r.phases || {})[x]))).concat([(r.problems || []).length]).map(q).join(","))).join("\n") + "\n";
  }
  return [["finished", "day", "id", "project", "mode", "what", "status", "where", "pod", "queued_s", "startup_s", "generation_s", "total_s", "pod_preps", "api_usd", "prompt"].join(",")]
    .concat((rows || []).map((r) => [new Date(r.t).toISOString(), r.day, r.id, r.project, r.mode, r.what, r.status, r.where, r.pod, sec(r.queued_ms), sec(r.startup_ms),
      sec(r.gen_ms), sec(r.total_ms), (r.preps || []).length, r.api_usd != null ? r.api_usd : "", r.prompt].map(q).join(","))).join("\n") + "\n";
}

/* ---------------- live */
function dir() { if (process.env.H3_USAGE_DIR) return process.env.H3_USAGE_DIR; try { return require("./usageLog").dir(); } catch { return path.join(__dirname, "..", "usage"); } }
function fileOf(t) { const d = new Date(t); return path.join(dir(), `genstats-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.jsonl`); }
function write(o, t) { try { fs.mkdirSync(dir(), { recursive: true }); fs.appendFileSync(fileOf(t), JSON.stringify(o) + "\n"); } catch { /* the statistics never break a job */ } }
const RECENT = [];   // the last pod preparations (a job takes those that ran while it waited)

/** core.js log(): the worker's lines that mark a moment */
function onLine(job, line) {
  if (!job || typeof line !== "string") return;
  if (!job._genAt && RX_META.test(line)) job._genAt = Date.now();
  const m = RX_APIUSD.exec(line);
  if (m && isFinite(+m[1])) job._apiUsd = (job._apiUsd || 0) + (+m[1]);
}
/** core.js pump(): a pod gate holds the job at the head of the queue (startup counts from here) */
function prepMark(job) { if (job && !job._prepAt) job._prepAt = Date.now(); }
/** core.js: a job ended -> its line (null = not a generation) */
function recordGen(job, opts) {
  try {
    const p = (job && job.params) || {};
    if (!job || !["done", "failed", "cancelled"].includes(job.status) || p.live || NOT_GEN.has(String(p.mode || "")) || (opts && opts.tool)) return null;
    if (job._genStat) return null;   // once
    job._genStat = true;
    const from = job._prepAt || (job.started ? job.started * 1000 : Date.now()), to = (job.started ? job.started * 1000 : 0) || (job.finished || Date.now() / 1000) * 1000;
    const pod = whereOf(job).pod;
    const preps = RECENT.filter((x) => (!pod || x.pod === pod) && x.at + x.ms >= from - 1000 && x.at <= to + 1000);
    const e = entryFor(job, preps);
    write(e, e.t);
    return e;
  } catch { return null; }
}
/** a pod preparation that ran: {pod, kind: "prepare" | "start", at, notes: [{t, note}], end?, styles?, problems?} */
function recordPrep(o) {
  try {
    const end = o.end || Date.now(), at = o.at || end;
    const e = { k: "prep", v: 1, at, day: ymd(at), pod: String(o.pod || ""), kind: String(o.kind || "prepare"), ms: ms(end - at),
      phases: o.phases || phasesOf(o.notes, end), styles: (o.styles || []).map(String).slice(0, 12), problems: (o.problems || []).map((x) => String(x).slice(0, 300)).slice(0, 12) };
    RECENT.push(e); if (RECENT.length > 60) RECENT.shift();
    write(e, at);
    return e;
  } catch { return null; }
}
/** gens + preps in [from, to] (YYYY-MM-DD; "" = open) */
function query(from, to) {
  const inR = (d) => (!from || d >= from) && (!to || d <= to);
  let files = [];
  try { files = fs.readdirSync(dir()).filter((f) => /^genstats-\d{4}-\d{2}\.jsonl$/.test(f)).sort(); } catch { files = []; }
  const gens = [], preps = [];
  for (const f of files) {
    const ym = f.slice(9, 16);
    if ((from && ym < from.slice(0, 7)) || (to && ym > to.slice(0, 7))) continue;
    let txt = ""; try { txt = fs.readFileSync(path.join(dir(), f), "utf8"); } catch { txt = ""; }
    for (const line of txt.split("\n")) {
      if (!line.trim()) continue;
      try { const j = JSON.parse(line); if (!inR(j.day)) continue; if (j.k === "gen") gens.push(j); else if (j.k === "prep") preps.push(j); } catch { /* a torn line */ }
    }
  }
  return summarize(gens, preps);
}
module.exports = { entryFor, phaseOf, phasesOf, summarize, whereOf, toCsv, onLine, prepMark, recordGen, recordPrep, query, NOT_GEN, RECENT, dir };
