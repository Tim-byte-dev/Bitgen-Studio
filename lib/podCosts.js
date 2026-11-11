// bitGen Studio — lib/podCosts.js (2.761.0): WHAT YOUR RUNPOD PODS COST - Basic Settings ▸ GPU's 💲 line + 📊 Usage.
// Tim (verbatim): "add the cost in basics settings refresh after every minute to show total cost, keep track of all costs
// like we do with electricity"
//   RunPod's own bill (REST v2 GET /billing/pods - this month by day + today by hour, startTime AND endTime, US dollars:
//   GPU + CPU + disk) + the pods running now ($/h). The page asks once a minute (kept 50 s here).
//   -> {running: n, running_hr, today_usd, month_usd, pods: {id: {today, month}}, at, error?}
//   Every local day of the month goes into usage/days.json as pods_usd + pods_cost (in the Energy cost currency, the day's
//   rate - lib/currency.js) so 📊 Usage puts the pods on the bill beside the electricity; lib/usageLog.js no longer adds a
//   pod's $/h itself while a pod is in use (RunPod's bill counts it, the hours bitGen was closed too).
// Pure (scripts/test-podsetup761.js): sumBilling, recordsOf.
"use strict";
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const r4 = (n) => Math.round((+n || 0) * 10000) / 10000;
/** a billing answer's rows (pure): v2 {records: [...]} or a bare array (v1) */
function recordsOf(j) { return Array.isArray(j) ? j : (j && Array.isArray(j.records) ? j.records : []); }
/** hour rows -> {days: {YYYY-MM-DD (local): usd}, pods: {id: {today, month}}, today, month} (pure; now = the local today) */
function sumBilling(rows, now) {
  const today = ymd(now || Date.now()), days = {}, pods = {};
  let month = 0, tday = 0;
  for (const r of rows || []) {
    const t = Date.parse(r.startTime || r.time || ""), amt = +(r.totalAmount != null ? r.totalAmount : r.amount) || 0;
    if (!isFinite(t) || !amt) continue;
    const d = ymd(t), id = String(r.podId || "");
    days[d] = r4((days[d] || 0) + amt); month += amt;
    const p = pods[id] = pods[id] || { today: 0, month: 0 };
    p.month = r4(p.month + amt);
    if (d === today) { tday += amt; p.today = r4(p.today + amt); }
  }
  return { days, pods, today: r4(tday), month: r4(month) };
}

/** 2.761.1: the month's DAY rows + today's HOUR rows (pure) -> one view: today and each pod's today from the hours
 *  (the local day), the month and the other days from the days (today's day row replaced by the hours) */
function mergeBilling(m, h, today) {
  const days = Object.assign({}, m.days);
  delete days[today];
  if (h.today) days[today] = h.today;
  const month = r4(Object.values(days).reduce((a, v) => a + v, 0)), pods = {};
  for (const id of new Set(Object.keys(m.pods).concat(Object.keys(h.pods)))) {
    const a = m.pods[id] || { today: 0, month: 0 }, b = h.pods[id] || { today: 0, month: 0 };
    pods[id] = { today: b.today, month: r4(a.month - a.today + b.today) };
  }
  return { days, pods, today: h.today, month };
}
/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
let LAST = null;
/** the costs now (cached 50 s) */
async function costs(force) {
  if (!force && LAST && Date.now() - LAST.at < 50000) return LAST;
  const A = require("./runpodApi"), key = String((rg().runpod || {}).key || "").trim();
  if (!key) return (LAST = { running: 0, running_hr: 0, today_usd: 0, month_usd: 0, pods: {}, at: Date.now(), error: "a RunPod API key first (Settings ▸ Remote generation)" });
  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const out = { running: 0, running_hr: 0, today_usd: 0, month_usd: 0, pods: {}, at: Date.now() };
  try {
    const list = (await require("./pods").mine()).pods || [];
    for (const p of list) if (/RUNNING|STARTING|PROVISIONING/.test(p.status)) { out.running++; out.running_hr = r4(out.running_hr + (+p.cost_hr || 0)); }
  } catch (e) { out.error = String(e.message || e); }
  try {
    // 2.761.1 (Tim: "RunPod's bill could not be read: RunPod answered HTTP 400: startTime and endTime must be provided
    // together"): both ends, always - the month by DAY (its start to tomorrow) and today by HOUR (local midnight to the
    // next hour, so today is this computer's day, not UTC's)
    const iso = (d) => encodeURIComponent(d.toISOString());
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const h1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
    const [jd, jh] = await Promise.all([
      A.call("GET", "/billing/pods?bucketSize=day&startTime=" + iso(m0) + "&endTime=" + iso(d1), key, null, { timeout: 30000 }),
      A.call("GET", "/billing/pods?bucketSize=hour&startTime=" + iso(d0) + "&endTime=" + iso(h1), key, null, { timeout: 30000 })]);
    const s = mergeBilling(sumBilling(recordsOf(jd), now), sumBilling(recordsOf(jh), now), ymd(now));
    out.today_usd = s.today; out.month_usd = s.month; out.pods = s.pods;
    record(s.days);
  } catch (e) { out.error = out.error || ("RunPod's bill could not be read: " + String(e.message || e)); }
  return (LAST = out);
}
/** RunPod's figure for each day -> usage/days.json pods_usd + pods_cost (the bill's currency) */
function record(days) {
  try {
    const fs = require("fs"), path = require("path"), U = require("./usageLog"), dir = U.dir(), f = path.join(dir, "days.json");
    let all = {}; try { all = JSON.parse(fs.readFileSync(f, "utf8")); } catch { all = {}; }
    let cur = "AUD"; try { cur = require("./power").priceOf(core().getConfig()).currency || "AUD"; } catch { /* AUD */ }
    let changed = false;
    for (const [d, usd] of Object.entries(days || {})) {
      const o = all[d] = all[d] || {};
      if (o.pods_usd === usd) continue;
      o.pods_usd = usd; o.pods_cost = r4(require("./currency").usdIn(usd, cur)); changed = true;
    }
    if (changed) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(all, null, 1)); }
  } catch { /* the usage log never breaks the app */ }
}
module.exports = { sumBilling, mergeBilling, recordsOf, costs, record };
