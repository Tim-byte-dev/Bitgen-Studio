// bitGen Studio — lib/usageLog.js (2.520.0): THE USAGE LOG - every job's energy and cost, and every day the app ran.
// Tim (verbatim): "keep a detailed list of usage the the user can review"
//
//   JOBS   usage/usage-YYYY-MM.jsonl - one line per finished job (done / failed / cancelled), written by core.js when
//          it ends: when, how long, mode, style, project, status, the energy (GPU / CPU, peak / off-peak, average and
//          peak watts) and what it cost at the prices of that moment (energy, peak / off-peak, its supply share), the
//          remote GPU it ran on (Settings -> Remote GPU) and that machine's $/hour share
//   DAYS   usage/days.json - every 5 minutes the meters' totals since the last tick are added to the day: all the energy
//          while the app ran (jobs + idle - whatever else used the card then too), its peak share, its cost, how long
//          the app ran, the remote GPU's hours and cost; a day's bill = that energy + the full daily supply charge
//   📊 Usage (Settings -> General -> Energy cost) shows both (routes/usage.js), totals per range, a CSV for each.
//   The folder is per machine (usage/ - never in a package).
// Pure (scripts/test-usage520.js): entryFor, dayAdd, summarize, toCsv, inRange.
"use strict";
const fs = require("fs");
const path = require("path");

const r3 = (x) => Math.round((+x || 0) * 1000) / 1000;
const r4 = (x) => Math.round((+x || 0) * 10000) / 10000;
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** a finished job -> its usage line (pure: price = power.priceOf, remote = remoteGpu.current() | null) */
function entryFor(job, price, remote) {
  const PW = require("./power");
  const p = job.params || {}, e = job.energy || null;
  const t = Math.round((job.finished || Date.now() / 1000) * 1000), st = job.started ? Math.round(job.started * 1000) : null;
  const secs = st ? Math.max(0, Math.round((t - st) / 1000)) : (e ? e.secs : 0);
  const c = e ? PW.jobCost(e.wh, e.secs, price || {}, e.wh_peak) : (price && price.supply_day > 0 ? PW.jobCost(0, secs, price) : null);
  const out = {
    t, day: ymd(t), started: st, id: job.id, project: job.project || "", mode: p.mode || "", status: job.status || "",
    what: String(p.style_name || p.video_style_name || (p.lora && p.lora.name ? (p.lora.full ? "Fine-tune " : "LoRA ") + p.lora.name : "") || (p.ft && p.ft.name ? (p.mode === "lora_merge" ? "Bake " : "Fine-tune ") + p.ft.name : "") || "").slice(0, 80),
    prompt: String(p.prompt || "").replace(/\s+/g, " ").slice(0, 140), secs,
    energy: e ? { wh: r3(e.wh), gpu_wh: r3(e.gpu_wh), cpu_wh: e.cpu_measured ? r3(e.cpu_wh) : null, wh_peak: e.wh_peak != null ? r3(e.wh_peak) : null,
                  avg_w: e.avg_w, peak_w: e.peak_w } : null,
    cost: c ? { total: c.total, energy: c.energy, supply: c.supply, peak: c.peak != null ? c.peak : null, offpeak: c.offpeak != null ? c.offpeak : null,
                currency: (price && price.currency) || "AUD" } : null,
  };
  if (remote && remote.mode && remote.mode !== "local") {
    out.remote = { mode: remote.mode, label: remote.label || "", cost_hr: +remote.cost_hr || 0 };
    if (out.remote.cost_hr > 0) out.remote.cost = r4(secs * out.remote.cost_hr / 3600);
  }
  return out;
}
/** add one tick to a day (pure): d = the day's record, dv = {wh, wh_peak, secs, remote_secs, remote_cost} */
function dayAdd(d, dv, price) {
  const o = Object.assign({ wh: 0, wh_peak: 0, secs: 0, cost_energy: 0, remote_secs: 0, remote_cost: 0 }, d || {});
  o.wh = r3(o.wh + (+dv.wh || 0)); o.wh_peak = r3(o.wh_peak + (+dv.wh_peak || 0)); o.secs += Math.round(+dv.secs || 0);
  // unrounded (jobCost rounds to cents above a cent - a day of ticks would drift)
  const pr = price || {}, w = +dv.wh || 0, pw = Math.max(0, Math.min(w, +dv.wh_peak || 0));
  const tou = pr.peak_price_kwh > 0 && Array.isArray(pr.peak_windows) && pr.peak_windows.length;
  const cost = tou ? (pw / 1000) * pr.peak_price_kwh + ((w - pw) / 1000) * (pr.price_kwh || 0) : pr.price_kwh > 0 ? (w / 1000) * pr.price_kwh : 0;
  o.cost_energy = r4(o.cost_energy + cost);
  o.remote_secs += Math.round(+dv.remote_secs || 0); o.remote_cost = r4(o.remote_cost + (+dv.remote_cost || 0));
  return o;
}
function inRange(day, from, to) { return (!from || day >= from) && (!to || day <= to); }
/** the review: jobs + days in a range -> totals (pure) */
function summarize(jobs, days, price) {
  const sup = (price && price.supply_day) || 0;
  const dayRows = Object.keys(days || {}).sort().map((k) => {
    const d = days[k];
    const jobsDay = (jobs || []).filter((j) => j.day === k);
    const jobWh = jobsDay.reduce((a, j) => a + ((j.energy && j.energy.wh) || 0), 0);
    return { day: k, wh: d.wh, wh_peak: d.wh_peak, wh_jobs: r3(jobWh), jobs: jobsDay.length, secs: d.secs, cost_energy: d.cost_energy, supply: sup,
             remote_secs: d.remote_secs || 0, remote_cost: d.remote_cost || 0, total: r4((d.cost_energy || 0) + sup + (d.remote_cost || 0)) };
  });
  const sum = (arr, f) => r4(arr.reduce((a, x) => a + (+f(x) || 0), 0));
  return {
    days: dayRows, jobs: (jobs || []).slice().sort((a, b) => b.t - a.t),
    totals: {
      jobs: (jobs || []).length, job_secs: sum(jobs || [], (j) => j.secs), job_wh: sum(jobs || [], (j) => j.energy && j.energy.wh),
      job_wh_peak: sum(jobs || [], (j) => j.energy && j.energy.wh_peak), job_cost: sum(jobs || [], (j) => j.cost && j.cost.total),
      remote_cost: sum(jobs || [], (j) => j.remote && j.remote.cost),
      days: dayRows.length, day_wh: sum(dayRows, (d) => d.wh), day_wh_peak: sum(dayRows, (d) => d.wh_peak), day_energy_cost: sum(dayRows, (d) => d.cost_energy),
      supply: r4(sup * dayRows.length), bill: sum(dayRows, (d) => d.total), currency: (price && price.currency) || "AUD",
    },
  };
}
/** CSV (pure): kind jobs | days */
function toCsv(kind, rows) {
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  if (kind === "days") {
    const head = ["day", "kwh", "peak_kwh", "offpeak_kwh", "jobs_kwh", "jobs", "app_hours", "energy_cost", "supply_charge", "remote_hours", "remote_cost", "total"];
    return [head.join(",")].concat(rows.map((d) => [d.day, r4(d.wh / 1000), r4(d.wh_peak / 1000), r4((d.wh - d.wh_peak) / 1000), r4(d.wh_jobs / 1000), d.jobs,
      r4(d.secs / 3600), d.cost_energy, d.supply, r4((d.remote_secs || 0) / 3600), d.remote_cost || 0, d.total].map(q).join(","))).join("\n") + "\n";
  }
  const head = ["finished", "day", "id", "project", "mode", "what", "status", "minutes", "kwh", "peak_kwh", "gpu_kwh", "cpu_kwh", "avg_w", "peak_w", "cost", "energy_cost", "peak_cost", "offpeak_cost", "supply_share", "currency", "remote", "remote_cost", "prompt"];
  return [head.join(",")].concat(rows.map((j) => {
    const e = j.energy || {}, c = j.cost || {};
    return [new Date(j.t).toISOString(), j.day, j.id, j.project, j.mode, j.what, j.status, r3(j.secs / 60), e.wh != null ? r4(e.wh / 1000) : "", e.wh_peak != null ? r4(e.wh_peak / 1000) : "",
      e.gpu_wh != null ? r4(e.gpu_wh / 1000) : "", e.cpu_wh != null ? r4(e.cpu_wh / 1000) : "", e.avg_w, e.peak_w, c.total, c.energy, c.peak, c.offpeak, c.supply, c.currency,
      j.remote ? j.remote.label || j.remote.mode : "", j.remote ? j.remote.cost : "", j.prompt].map(q).join(",");
  })).join("\n") + "\n";
}

/* ---------------- live */
function dir() { return path.join(require("./core").BASE, "usage"); }
function monthFile(t) { const d = new Date(t); return path.join(dir(), `usage-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.jsonl`); }
function priceNow() { try { return require("./power").priceOf(require("./core").getConfig()); } catch { return {}; } }
function remoteNow() { try { return require("./remoteGpu").current(); } catch { return null; } }
/** core.js: a job ended */
function recordJob(job) {
  try {
    if (!job || !["done", "failed", "cancelled"].includes(job.status)) return null;
    const e = entryFor(job, priceNow(), remoteNow());
    fs.mkdirSync(dir(), { recursive: true });
    fs.appendFileSync(monthFile(e.t), JSON.stringify(e) + "\n");
    return e;
  } catch { return null; }
}
const T = { last: null, timer: null };
function readDays() { try { return JSON.parse(fs.readFileSync(path.join(dir(), "days.json"), "utf8")); } catch { return {}; } }
/** add the meters' energy since the last tick to today */
function tick(now) {
  try {
    const PW = require("./power"), st = PW.stats(), E = st.energy || {};
    const t = now || Date.now();
    const cur = { t, wh: (+E.gpu_wh || 0) + (+E.cpu_wh || 0), wh_peak: +E.peak_wh || 0 };
    const rem = remoteNow();
    if (T.last) {
      const dv = { wh: Math.max(0, cur.wh - T.last.wh), wh_peak: Math.max(0, cur.wh_peak - T.last.wh_peak), secs: Math.max(0, (t - T.last.t) / 1000) };
      if (rem && rem.mode && rem.mode !== "local") { dv.remote_secs = dv.secs; dv.remote_cost = (+rem.cost_hr || 0) * dv.secs / 3600; }
      const days = readDays(), k = ymd(t);
      days[k] = dayAdd(days[k], dv, priceNow());
      fs.mkdirSync(dir(), { recursive: true });
      fs.writeFileSync(path.join(dir(), "days.json"), JSON.stringify(days, null, 1));
    }
    T.last = cur;
  } catch { /* the log never breaks the app */ }
}
function start() {
  if (T.timer) return;
  tick();
  T.timer = setInterval(() => tick(), 5 * 60 * 1000);
  if (T.timer.unref) T.timer.unref();
}
/** jobs + days in [from, to] (YYYY-MM-DD) */
function query(from, to) {
  tick();
  let files = [];
  try { files = fs.readdirSync(dir()).filter((f) => /^usage-\d{4}-\d{2}\.jsonl$/.test(f)).sort(); } catch { files = []; }
  const jobs = [];
  for (const f of files) {
    const ym = f.slice(6, 13);
    if ((from && ym < from.slice(0, 7)) || (to && ym > to.slice(0, 7))) continue;
    for (const line of fs.readFileSync(path.join(dir(), f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { const j = JSON.parse(line); if (inRange(j.day, from, to)) jobs.push(j); } catch { /* a torn line */ }
    }
  }
  const all = readDays(), days = {};
  for (const k of Object.keys(all)) if (inRange(k, from, to)) days[k] = all[k];
  return summarize(jobs, days, priceNow());
}

module.exports = { entryFor, dayAdd, summarize, toCsv, inRange, ymd, recordJob, tick, start, query, dir };
