// bitGen Studio — lib/podCosts.js (2.761.0): WHAT YOUR RUNPOD PODS COST - Basic Settings ▸ GPU's 💲 line + 📊 Usage.
// Tim (verbatim): "add the cost in basics settings refresh after every minute to show total cost, keep track of all costs
// like we do with electricity"
//   RunPod's own bill (REST v2 GET /billing/pods - bucketSize hour from the start of this month, every pod, US dollars:
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
    const j = await A.call("GET", "/billing/pods?bucketSize=hour&startTime=" + encodeURIComponent(m0.toISOString()), key, null, { timeout: 30000 });
    const s = sumBilling(recordsOf(j), now);
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
module.exports = { sumBilling, recordsOf, costs, record };
