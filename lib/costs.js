// bitGen Studio — lib/costs.js (2.771.0): THE 💲 COSTS DOCKER - what everything costs: this computer's electricity and every
// platform on its own, and the detailed list behind each.
// Tim (verbatim): "change the runpod docker to Costs, show all costs summary, if user clicks on one of the costs open a detailed
// lists of expenditure for that platform or local" + "Costs Docker should include local costs and all the diferent platform
// costs individually"
//
//   summary(range) -> {range, from, to, currency, rows: [{id, name, icon, cost, usd, sub, note?, error?}], total}
//     local       this computer: the energy while the app ran + the daily supply charge (lib/usageLog.js - the bill's
//                 currency, Settings ▸ General ▸ Energy cost); its jobs
//     runpod      RunPod pods: RunPod's own bill (lib/podCosts.js - today / this month live, other ranges from the days
//                 bitGen kept in usage/days.json) + Serverless endpoints (REST v2 GET /billing/serverless, this month)
//     openrouter  OpenRouter (the LLM / vision LLM - Settings ▸ Remote generation): its own figures for the key (GET /key:
//                 usage_daily / usage_weekly / usage_monthly / usage - US dollars, UTC days) + bitGen's own record of each
//                 call (usage/llm-YYYY-MM.jsonl: model, tokens, the cost OpenRouter reported)
//     api:<id>    each Settings ▸ API service: its API_ renders (the worker's "about $x" - lib/genStats.js) + its LLM calls
//     remote      a remote GPU with a $/hour (Settings ▸ Remote generation: an address / SSH) - usage/days.json remote_cost
//   Every row's `cost` is in the bill's currency (US dollars converted at the day's rate - lib/currency.js) so they add up;
//   `usd` is the platform's own US-dollar figure.
//   detail(id, range) -> that platform's list (days, pods, models, calls, jobs) - routes/costs.js; the page: static/runpoddock.js
// Pure (scripts/test-costs771.js): RANGES, rangeOf, sumDays, llmEntry, llmSummary, orFigure, totalOf, localOf.
"use strict";
const fs = require("fs");
const path = require("path");

const RANGES = ["today", "week", "month", "last", "all"];
const r4 = (n) => Math.round((+n || 0) * 10000) / 10000;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** a named range -> {from, to} (YYYY-MM-DD, "" = open) - the same ranges as 📊 Usage (pure) */
function rangeOf(name, now) {
  const d = now ? new Date(now) : new Date();
  if (name === "today") return { from: ymd(d), to: ymd(d) };
  if (name === "week") { const a = new Date(d); a.setDate(a.getDate() - 6); return { from: ymd(a), to: ymd(d) }; }
  if (name === "month") return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: ymd(d) };
  if (name === "last") { const f = new Date(d.getFullYear(), d.getMonth() - 1, 1), t = new Date(d.getFullYear(), d.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
  return { from: "", to: "" };
}
const inR = (day, from, to) => (!from || day >= from) && (!to || day <= to);
/** a field of usage/days.json summed over a range (pure) */
function sumDays(days, from, to, field) { let s = 0; for (const [k, v] of Object.entries(days || {})) if (inR(k, from, to)) s += +((v || {})[field]) || 0; return r4(s); }
/** one LLM answer -> bitGen's record of it (pure); null = nothing to keep (this computer's LLM, a free / unpriced endpoint
 *  that said nothing) - remote = lib/gpuSplit.llmTarget's {provider?, api_id?, model, label} */
function llmEntry(remote, data, kind, now) {
  if (!remote || !(remote.provider === "openrouter" || remote.api_id)) return null;
  const u = (data && data.usage) || {}, t = now || Date.now();
  const cost = u.cost != null && isFinite(+u.cost) ? r4(+u.cost) : null;
  return { t, day: ymd(t), provider: remote.provider === "openrouter" ? "openrouter" : "api", api_id: String(remote.api_id || ""),
    model: String((data && data.model) || remote.model || "").slice(0, 120), kind: String(kind || "llm"),
    in: +u.prompt_tokens || 0, out: +u.completion_tokens || 0, cost };
}
/** calls -> {count, in, out, cost, priced, by_model: [{model, count, in, out, cost}]} (pure) */
function llmSummary(calls) {
  const by = {}, o = { count: 0, in: 0, out: 0, cost: 0, priced: 0 };
  for (const c of calls || []) {
    o.count++; o.in += c.in || 0; o.out += c.out || 0; if (c.cost != null) { o.cost += c.cost; o.priced++; }
    const m = by[c.model || "?"] = by[c.model || "?"] || { model: c.model || "?", count: 0, in: 0, out: 0, cost: 0 };
    m.count++; m.in += c.in || 0; m.out += c.out || 0; m.cost = r4(m.cost + (c.cost || 0));
  }
  o.cost = r4(o.cost);
  o.by_model = Object.values(by).sort((a, b) => (b.cost - a.cost) || (b.count - a.count));
  return o;
}
/** OpenRouter's own figure for a range (pure) - {usd, said} | null (no figure of its own for that range) */
function orFigure(key, range) {
  const k = key || {};
  const f = { today: ["usage_daily", "today (UTC)"], week: ["usage_weekly", "this week (UTC, Monday on)"], month: ["usage_monthly", "this month (UTC)"], all: ["usage", "since the key was made"] }[range];
  if (!f || k[f[0]] == null || !isFinite(+k[f[0]])) return null;
  return { usd: r4(+k[f[0]]), said: f[1] };
}
/** the rows' total in the bill's currency (pure) */
function totalOf(rows) { return r4((rows || []).reduce((s, r) => s + (r && !r.error && r.cost != null ? +r.cost : 0), 0)); }
/** this computer's part of the usage log (pure): usageLog.query()'s days + jobs -> {cost, energy, supply, wh, jobs, days, local_jobs} */
function localOf(q) {
  const t = (q && q.totals) || {};
  const jobs = ((q && q.jobs) || []).filter((j) => !j.remote);
  return { cost: r4((+t.day_energy_cost || 0) + (+t.supply || 0)), energy: +t.day_energy_cost || 0, supply: +t.supply || 0, wh: +t.day_wh || 0,
    days: ((q && q.days) || []).map((d) => ({ day: d.day, wh: d.wh, wh_peak: d.wh_peak, jobs: d.jobs, secs: d.secs, energy: d.cost_energy, supply: d.supply, total: r4((+d.cost_energy || 0) + (+d.supply || 0)) })),
    jobs: jobs.map((j) => ({ t: j.t, mode: j.mode, what: j.what, status: j.status, secs: j.secs, wh: j.energy ? j.energy.wh : null, cost: j.cost ? j.cost.total : null })),
    currency: t.currency || "AUD" };
}

/* ---------------- live */
function core() { return require("./core"); }
function cfg() { try { return core().getConfig() || {}; } catch { return {}; } }
function billCur() { try { return require("./power").priceOf(cfg()).currency || "AUD"; } catch { return "AUD"; } }
function inBill(usd) { try { return r4(require("./currency").usdIn(usd, billCur())); } catch { return r4(usd); } }
function dir() { if (process.env.H3_USAGE_DIR) return process.env.H3_USAGE_DIR; try { return require("./usageLog").dir(); } catch { return path.join(__dirname, "..", "usage"); } }
function readDays() { try { return JSON.parse(fs.readFileSync(path.join(dir(), "days.json"), "utf8")); } catch { return {}; } }
const llmFile = (t) => { const d = new Date(t); return path.join(dir(), `llm-${d.getFullYear()}-${pad(d.getMonth() + 1)}.jsonl`); };
/** lib/llmChat.js, lib/captioner.js, lib/quickPrompt.js: an LLM answered (kept only for OpenRouter / Settings ▸ API) */
function noteLlm(remote, data, kind) {
  try {
    const e = llmEntry(remote, data, kind);
    if (!e) return null;
    fs.mkdirSync(dir(), { recursive: true }); fs.appendFileSync(llmFile(e.t), JSON.stringify(e) + "\n");
    return e;
  } catch { return null; }
}
function readLlm(from, to) {
  let files = []; try { files = fs.readdirSync(dir()).filter((f) => /^llm-\d{4}-\d{2}\.jsonl$/.test(f)).sort(); } catch { files = []; }
  const out = [];
  for (const f of files) {
    const ym = f.slice(4, 11);
    if ((from && ym < from.slice(0, 7)) || (to && ym > to.slice(0, 7))) continue;
    let txt = ""; try { txt = fs.readFileSync(path.join(dir(), f), "utf8"); } catch { txt = ""; }
    for (const l of txt.split("\n")) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (inR(j.day, from, to)) out.push(j); } catch { /* torn */ } }
  }
  return out.sort((a, b) => b.t - a.t);
}
const CACHE = {};
async function cached(k, fn, force) {
  if (!force && CACHE[k] && Date.now() - CACHE[k].at < 50000) return CACHE[k].v;
  const v = await fn();
  CACHE[k] = { at: Date.now(), v };
  return v;
}
function orKey() { return String((((cfg().rgpu || {}).openrouter) || {}).key || "").trim(); }
/** OpenRouter's GET /key for the key in Settings ▸ Remote generation -> its data | {error} */
function orKeyData(force) {
  return cached("or", async () => {
    const k = orKey(); if (!k) return { none: true };
    const OR = require("./openRouter");
    try {
      const r = await fetch(OR.BASE() + "/key", { headers: OR.headers(k), signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) return { error: "OpenRouter refused the API key" };
      if (!r.ok || !j || !j.data) return { error: "OpenRouter did not say what the key used (HTTP " + r.status + ")" };
      return j.data;
    } catch (e) { return { error: "OpenRouter could not be asked: " + String((e && e.message) || e) }; }
  }, force);
}
function rpKey() { return String((((cfg().rgpu || {}).runpod) || {}).key || "").trim(); }
/** RunPod Serverless endpoints' bill this month (REST v2 GET /billing/serverless, by day) -> {month_usd, today_usd, endpoints, days} | {error} */
function serverless(force) {
  return cached("sls", async () => {
    const k = rpKey(); if (!k) return { none: true };
    const PC = require("./podCosts"), A = require("./runpodApi"), now = new Date();
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1), d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const iso = (d) => encodeURIComponent(d.toISOString());
    try {
      const j = await A.call("GET", "/billing/serverless?bucketSize=day&startTime=" + iso(m0) + "&endTime=" + iso(d1), k, null, { timeout: 30000 });
      const rows = PC.recordsOf(j).map((r) => Object.assign({}, r, { podId: r.serverlessId || r.endpointId || r.podId || "" }));
      const s = PC.sumBilling(rows, now);
      return { month_usd: s.month, today_usd: s.today, endpoints: s.pods, days: s.days };
    } catch (e) { return { error: "RunPod's Serverless bill could not be read: " + String((e && e.message) || e) }; }
  }, force);
}
function apisCfg() { return cfg().apis || {}; }

/** the summary: one row for this computer and one for each platform */
async function summary(range, force) {
  const rg = RANGES.includes(range) ? range : "month", { from, to } = rangeOf(rg), cur = billCur(), rows = [];
  // ---- this computer
  let q = null; try { q = require("./usageLog").query(from, to); } catch { q = null; }
  const L = localOf(q);
  rows.push({ id: "local", icon: "🖥", name: "This computer", cost: L.cost, usd: null, currency: cur,
    sub: (L.wh / 1000).toFixed(L.wh >= 10000 ? 1 : 2) + " kWh · " + L.jobs.length + " job" + (L.jobs.length === 1 ? "" : "s") + (L.supply ? " · supply charge included" : "") });
  const days = readDays();
  // ---- RunPod
  const hasRp = !!rpKey();
  const podsDays = sumDays(days, from, to, "pods_usd");
  if (hasRp || podsDays) {
    let c = null, sl = null;
    if (hasRp) [c, sl] = await Promise.all([require("./podCosts").costs(force).catch((e) => ({ error: String(e.message || e) })), serverless(force)]);
    let usd = rg === "today" && c && !c.error ? +c.today_usd || 0 : rg === "month" && c && !c.error ? +c.month_usd || 0 : sumDays(readDays(), from, to, "pods_usd");
    let slUsd = 0;
    if (sl && !sl.error && !sl.none) slUsd = rg === "today" ? +sl.today_usd || 0 : rg === "month" ? +sl.month_usd || 0 : sumDays(Object.fromEntries(Object.entries(sl.days || {}).map(([k, v]) => [k, { s: v }])), from, to, "s");
    usd = r4(usd + slUsd);
    rows.push({ id: "runpod", icon: "☁", name: "RunPod", cost: inBill(usd), usd, currency: cur,
      sub: (c && c.running ? c.running + " pod" + (c.running > 1 ? "s" : "") + " running now · " : "") + "pods" + (slUsd ? " + Serverless" : ""),
      note: !["today", "month"].includes(rg) ? "from the days bitGen kept of RunPod's bill" : "", error: (c && c.error) || "" });
  }
  // ---- OpenRouter
  const calls = readLlm(from, to), orCalls = calls.filter((x) => x.provider === "openrouter");
  if (orKey() || orCalls.length) {
    const k = await orKeyData(force), f = k && !k.error && !k.none ? orFigure(k, rg) : null, own = llmSummary(orCalls);
    const usd = f ? f.usd : own.cost;
    rows.push({ id: "openrouter", icon: "🧠", name: "OpenRouter", cost: inBill(usd), usd, currency: cur,
      sub: own.count + " LLM call" + (own.count === 1 ? "" : "s") + " by bitGen" + (f ? " · OpenRouter's figure " + f.said : " · bitGen's own record"), error: k && k.error ? k.error : "" });
  }
  // ---- Settings ▸ API services
  let gens = []; try { gens = require("./genStats").query(from, to).gens; } catch { gens = []; }
  for (const [id, a] of Object.entries(apisCfg())) {
    const jobs = gens.filter((g) => g.api_id === id), ac = calls.filter((x) => x.api_id === id);
    if (!a.use && !jobs.length && !ac.length) continue;
    const usd = r4(jobs.reduce((s, g) => s + (+g.api_usd || 0), 0) + llmSummary(ac).cost);
    const unpriced = jobs.filter((g) => g.api_usd == null).length;
    rows.push({ id: "api:" + id, icon: "🔑", name: String(a.name || id) + " (" + String(a.service || "API") + ")", cost: inBill(usd), usd, currency: cur,
      sub: jobs.length + " render" + (jobs.length === 1 ? "" : "s") + (ac.length ? " · " + ac.length + " LLM call" + (ac.length === 1 ? "" : "s") : "") + (unpriced ? " · " + unpriced + " the service gave no price for" : "") });
  }
  // ---- a remote GPU with a $/hour (not RunPod - its bill is above)
  const rc = sumDays(days, from, to, "remote_cost");
  if (rc) rows.push({ id: "remote", icon: "🌐", name: "Remote GPU", cost: rc, usd: null, currency: cur, sub: (sumDays(days, from, to, "remote_secs") / 3600).toFixed(1) + " h at its $/hour (Settings ▸ Remote generation)" });
  return { range: rg, from, to, currency: cur, rows, total: totalOf(rows), at: Date.now() };
}

/** one platform's detailed list */
async function detail(id, range, force) {
  const rg = RANGES.includes(range) ? range : "month", { from, to } = rangeOf(rg), cur = billCur(), base = { id, range: rg, from, to, currency: cur };
  if (id === "local") {
    let q = null; try { q = require("./usageLog").query(from, to); } catch { q = null; }
    return Object.assign(base, localOf(q), { currency: cur });
  }
  if (id === "runpod") {
    const days = readDays(), sl = await serverless(force);
    const list = Object.keys(days).filter((k) => inR(k, from, to) && (days[k].pods_usd || ((sl && sl.days) || {})[k])).sort().reverse()
      .map((k) => ({ day: k, pods_usd: +days[k].pods_usd || 0, sls_usd: +(((sl && sl.days) || {})[k]) || 0, cost: inBill((+days[k].pods_usd || 0) + (+(((sl && sl.days) || {})[k]) || 0)) }));
    return Object.assign(base, { days: list, serverless: sl && !sl.none ? sl : null });
  }
  if (id === "openrouter") {
    const calls = readLlm(from, to).filter((x) => x.provider === "openrouter"), k = await orKeyData(force);
    return Object.assign(base, { key: k && !k.none ? { usage_daily: k.usage_daily, usage_weekly: k.usage_weekly, usage_monthly: k.usage_monthly, usage: k.usage, limit: k.limit,
      limit_remaining: k.limit_remaining, is_free_tier: k.is_free_tier, label: k.label, error: k.error || "" } : null, figure: k && !k.error ? orFigure(k, rg) : null,
      own: llmSummary(calls), calls: calls.slice(0, 200) });
  }
  if (/^api:/.test(id)) {
    const aid = id.slice(4), a = apisCfg()[aid] || {};
    let gens = []; try { gens = require("./genStats").query(from, to).gens; } catch { gens = []; }
    const jobs = gens.filter((g) => g.api_id === aid), calls = readLlm(from, to).filter((x) => x.api_id === aid);
    return Object.assign(base, { name: a.name || aid, service: a.service || "", jobs: jobs.map((g) => ({ t: g.t, mode: g.mode, what: g.what, status: g.status, total_ms: g.total_ms, usd: g.api_usd != null ? g.api_usd : null })),
      own: llmSummary(calls), calls: calls.slice(0, 200) });
  }
  if (id === "remote") {
    const days = readDays();
    return Object.assign(base, { days: Object.keys(days).filter((k) => inR(k, from, to) && days[k].remote_cost).sort().reverse().map((k) => ({ day: k, secs: days[k].remote_secs || 0, cost: days[k].remote_cost })) });
  }
  return Object.assign(base, { error: "no such cost: " + id });
}
module.exports = { RANGES, rangeOf, sumDays, llmEntry, llmSummary, orFigure, totalOf, localOf, noteLlm, readLlm, summary, detail };
