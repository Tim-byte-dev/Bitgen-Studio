#!/usr/bin/env node
/* bitGen Studio — 2.771.0 unit test: 💲 THE COSTS DOCKER (lib/costs.js, routes/costs.js, static/runpoddock.js pure part + its
 * buttons, the LLM calls kept by lib/llmChat.js / lib/captioner.js / lib/quickPrompt.js).
 * Tim (verbatim): "change the runpod docker to Costs, show all costs summary, if user clicks on one of the costs open a detailed
 * lists of expenditure for that platform or local" + "Costs Docker should include local costs and all the diferent platform
 * costs individually"
 * The app's settings, the usage log, RunPod and OpenRouter are stand-ins here (require.cache / fetch) - nothing is asked over the
 * network and the tree's usage/ is never touched (H3_USAGE_DIR). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cost771-"));
process.env.H3_USAGE_DIR = TMP;
process.env.H3_OPENROUTER_API = "https://or.stand-in/api/v1";
const ROOT = path.join(__dirname, "..");
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());

/* ---- stand-ins for the app's own modules (the same files lib/costs.js requires) */
const CFG = { rgpu: { runpod: { key: "rk" }, openrouter: { key: "ok-key" } }, apis: { a1: { name: "Fal", service: "fal", use: true }, a2: { name: "Spare", service: "replicate", use: false } } };
const stub = (rel, exp) => { const f = require.resolve(path.join(ROOT, "lib", rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
stub("core", { getConfig: () => CFG, BASE: TMP });
stub("power", { priceOf: () => ({ currency: "AUD" }) });
stub("currency", { usdIn: (u) => (+u || 0) * 1.5 });
stub("usageLog", { dir: () => TMP, query: () => ({
  totals: { day_energy_cost: 2, supply: 1, day_wh: 5000, currency: "AUD" },
  days: [{ day: TODAY, wh: 5000, wh_peak: 1000, jobs: 2, secs: 7200, cost_energy: 2, supply: 1 }],
  jobs: [{ t: 2, mode: "image", what: "Krea 2", status: "done", secs: 60, energy: { wh: 40 }, cost: { total: 0.02 } },
    { t: 1, mode: "image", what: "on a pod", status: "done", secs: 60, remote: { mode: "runpod", label: "pod" } }] }) });
const PC = require("../lib/podCosts");
let costsAsked = 0;
PC.costs = async () => { costsAsked++; return { running: 1, running_hr: 0.44, today_usd: 1.2, month_usd: 10, pods: {}, at: Date.now() }; };
const RA = require("../lib/runpodApi");
let slsUrl = "";
RA.call = async (m, p) => { slsUrl = p; return { records: [{ startTime: new Date().toISOString(), amount: 0.5, serverlessId: "ep1" }] }; };
let orAsked = 0;
global.fetch = async (url) => { orAsked++; return { ok: true, status: 200, json: async () => ({ data: { usage_daily: 0.3, usage_weekly: 1, usage_monthly: 4, usage: 9, limit: 20, limit_remaining: 11, is_free_tier: false, label: "sk-or…" } }) }; };
fs.writeFileSync(path.join(TMP, "days.json"), JSON.stringify({ [TODAY]: { pods_usd: 1.2, remote_cost: 0.7, remote_secs: 3600 }, "2001-01-01": { pods_usd: 99 } }));

const C = require("../lib/costs");
const P = require("../static/runpoddock.js");
const GS = require("../lib/genStats");

(async () => {
  /* ---- pure */
  check("RANGES: today / 7 days / this month / last month / everything", JSON.stringify(C.RANGES) === '["today","week","month","last","all"]');
  const d0 = new Date(2026, 10, 13);
  check("rangeOf: the same days as 📊 Usage", C.rangeOf("today", d0).from === "2026-11-13" && C.rangeOf("week", d0).from === "2026-11-07" && C.rangeOf("month", d0).from === "2026-11-01"
    && C.rangeOf("last", d0).from === "2026-10-01" && C.rangeOf("last", d0).to === "2026-10-31" && C.rangeOf("all", d0).from === "");
  check("sumDays: a field over a range", C.sumDays({ "2026-11-01": { a: 1 }, "2026-11-05": { a: 2.5 }, "2026-10-31": { a: 9 } }, "2026-11-01", "2026-11-30", "a") === 3.5);
  check("llmEntry: this computer's LLM = nothing kept", C.llmEntry(null, { usage: { cost: 1 } }) === null && C.llmEntry({ provider: "runpod" }, {}) === null);
  const le = C.llmEntry({ provider: "openrouter", model: "x/y" }, { model: "x/y:free", usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.00123 } }, "vlm", Date.UTC(2026, 10, 13, 3));
  check("llmEntry: an OpenRouter answer - model, tokens, the cost it reported", le.provider === "openrouter" && le.model === "x/y:free" && le.in === 100 && le.out === 20 && le.cost === 0.0012 && le.kind === "vlm", le);
  check("llmEntry: a Settings ▸ API LLM (its api_id); no cost said = null", (() => { const a = C.llmEntry({ api_id: "a1", model: "gpt" }, { usage: { prompt_tokens: 5 } }); return a.provider === "api" && a.api_id === "a1" && a.cost === null; })());
  const ls = C.llmSummary([{ model: "m1", in: 10, out: 2, cost: 0.01 }, { model: "m1", in: 5, out: 1, cost: null }, { model: "m2", in: 1, out: 1, cost: 0.03 }]);
  check("llmSummary: calls, tokens, priced, by model (dearest first)", ls.count === 3 && ls.in === 16 && ls.priced === 2 && ls.cost === 0.04 && ls.by_model[0].model === "m2" && ls.by_model[1].count === 2, ls);
  check("orFigure: OpenRouter's own figure per range (UTC); last month = none", C.orFigure({ usage_daily: 1, usage_weekly: 2, usage_monthly: 3, usage: 4 }, "week").usd === 2 && C.orFigure({ usage: 4 }, "all").said === "since the key was made" && C.orFigure({ usage: 4 }, "last") === null);
  check("totalOf: rows with an error left out", C.totalOf([{ cost: 1 }, { cost: 2.5 }, { cost: 9, error: "x" }]) === 3.5);
  const lo = C.localOf({ totals: { day_energy_cost: 2, supply: 1, day_wh: 5000, currency: "AUD" }, days: [{ day: "d", cost_energy: 2, supply: 1 }], jobs: [{ t: 1 }, { t: 2, remote: { mode: "runpod" } }] });
  check("localOf: energy + supply; only the jobs that ran on this computer", lo.cost === 3 && lo.jobs.length === 1 && lo.days[0].total === 3 && lo.currency === "AUD", lo);

  /* ---- the LLM calls kept */
  const n1 = C.noteLlm({ provider: "openrouter", model: "or/m" }, { usage: { prompt_tokens: 50, completion_tokens: 10, cost: 0.002 } }, "llm");
  C.noteLlm({ api_id: "a1", model: "fal-llm" }, { usage: { prompt_tokens: 7, completion_tokens: 3, cost: 0.01 } }, "llm");
  C.noteLlm(null, { usage: { cost: 5 } }, "llm");
  check("noteLlm: OpenRouter + Settings ▸ API calls kept in usage/llm-YYYY-MM.jsonl, this computer's not", n1 && fs.readdirSync(TMP).some((f) => /^llm-\d{4}-\d{2}\.jsonl$/.test(f)) && C.readLlm("", "").length === 2);

  /* ---- a render on an API_ style (its price from the worker's line) */
  GS.recordGen({ id: "apijob", status: "done", created: Date.now() / 1000 - 40, started: Date.now() / 1000 - 30, finished: Date.now() / 1000, _apiUsd: 0.05, _ranOn: { api: true, label: "API_Fal" }, params: { mode: "image", style: { api_id: "a1", name: "API_Fal pictures" } } });

  /* ---- the summary */
  const s = await C.summary("today");
  const row = (id) => s.rows.find((r) => r.id === id);
  check("summary: a row each - this computer, RunPod, OpenRouter, the API in use, the remote GPU (the unused API with nothing is left out)",
    JSON.stringify(s.rows.map((r) => r.id)) === JSON.stringify(["local", "runpod", "openrouter", "api:a1", "remote"]), s.rows.map((r) => r.id));
  check("summary: this computer = energy + supply, in the bill's currency", row("local").cost === 3 && row("local").usd === null && row("local").currency === "AUD" && /5\.00 kWh · 1 job/.test(row("local").sub), row("local"));
  check("summary: RunPod today = RunPod's live bill + Serverless today, converted for the total", row("runpod").usd === 1.7 && row("runpod").cost === 2.55 && costsAsked === 1 && /\/billing\/serverless\?bucketSize=day&startTime=.*&endTime=/.test(slsUrl) && /Serverless/.test(row("runpod").sub), row("runpod"));
  check("summary: OpenRouter today = its usage_daily (its own figure for the key)", row("openrouter").usd === 0.3 && /OpenRouter's figure today \(UTC\)/.test(row("openrouter").sub) && /1 LLM call/.test(row("openrouter").sub), row("openrouter"));
  check("summary: the API service = its renders' prices + its LLM calls", Math.abs(row("api:a1").usd - 0.06) < 1e-9 && /1 render · 1 LLM call/.test(row("api:a1").sub) && /Fal \(fal\)/.test(row("api:a1").name), row("api:a1"));
  check("summary: a remote GPU with a $/hour (usage/days.json)", row("remote").cost === 0.7 && /1\.0 h/.test(row("remote").sub), row("remote"));
  check("summary: the total adds every row in the bill's currency", Math.abs(s.total - (3 + 2.55 + 0.45 + 0.09 + 0.7)) < 1e-6, s.total);
  const m = await C.summary("month");
  check("summary month: RunPod = its month bill + Serverless month; OpenRouter = usage_monthly", m.rows.find((r) => r.id === "runpod").usd === 10.5 && m.rows.find((r) => r.id === "openrouter").usd === 4);
  const all = await C.summary("all");
  check("summary everything: RunPod from the days bitGen kept (said so); OpenRouter = usage", all.rows.find((r) => r.id === "runpod").usd === r4(1.2 + 99 + 0.5) && /days bitGen kept/.test(all.rows.find((r) => r.id === "runpod").note) && all.rows.find((r) => r.id === "openrouter").usd === 9, all.rows);
  const bad = await C.summary("nonsense");
  check("summary: an unknown range = this month", bad.range === "month");
  check("summary: OpenRouter asked once in 50 s (kept)", orAsked === 1, orAsked);

  /* ---- the detailed lists */
  const dl = await C.detail("local", "today");
  check("detail local: energy, supply, by day, its jobs", dl.cost === 3 && dl.days.length === 1 && dl.jobs.length === 1 && dl.jobs[0].what === "Krea 2", dl);
  const dr = await C.detail("runpod", "all");
  check("detail runpod: day by day - pods + Serverless", dr.days.length === 2 && dr.days[0].day === TODAY && dr.days[0].pods_usd === 1.2 && dr.days[0].sls_usd === 0.5 && dr.serverless.month_usd === 0.5, dr.days);
  const dor = await C.detail("openrouter", "today");
  check("detail openrouter: its figures for the key + bitGen's calls by model and one by one", dor.key.usage_monthly === 4 && dor.key.limit_remaining === 11 && dor.figure.usd === 0.3 && dor.own.count === 1 && dor.calls[0].model === "or/m", dor);
  const da = await C.detail("api:a1", "today");
  check("detail api: its renders (price, how long) + its LLM calls", da.jobs.length === 1 && da.jobs[0].usd === 0.05 && da.jobs[0].total_ms > 0 && da.own.count === 1 && da.name === "Fal", da);
  const dre = await C.detail("remote", "today");
  check("detail remote: day by day", dre.days.length === 1 && dre.days[0].cost === 0.7);
  check("detail: an unknown id says so", /no such cost/.test((await C.detail("nope", "today")).error));

  /* ---- the page's pure part */
  check("runpoddock: the five ranges", P.RANGE_NAMES.map((r) => r[0]).join() === "today,week,month,last,all");
  check("runpoddock durText / kwhText", P.durText(42000) === "42 s" && P.durText(185000) === "3 min 5 s" && P.kwhText(5000) === "5.00 kWh" && P.kwhText(25000) === "25.0 kWh");
  check("runpoddock: the 2.763.5 parts are still there", typeof P.podRows === "function" && P.lastsText(50) === "about 2 days");

  /* ---- the page, the routes, the hooks */
  const rp = src("static/runpoddock.js");
  check("the docker is 💲 COSTS (SecFloat id runpod kept - its place / docking are remembered)", /SecFloat\.add\(\{ id: "runpod", title: "💲 COSTS"/.test(rp));
  check("…all costs: a row per place (GET /api/costs), a row clicked = its list (GET /api/costs/:id), ← All costs back", /getj\("\/api\/costs\?range="/.test(rp) && /"\/api\/costs\/" \+ encodeURIComponent\(id\)/.test(rp) && /id="cdBack"/.test(rp) && /tr\[data-cdrow\]/.test(rp));
  check("…RunPod's list keeps its Balance / Usage / GPU prices and gains By day", /id="rpBal"/.test(rp) && /id="rpUse"/.test(rp) && /id="rpGpus"/.test(rp) && /id="rpDays"/.test(rp));
  check("…📊 Statistics opens the Statistics dialog with the docker's range", /H3Stats\.show\(true, \{ range: S\.range \}\)/.test(rp));
  check("…the RunPod buttons open RunPod's list, the others all costs", /show\(undefined, "runpod"\)/.test(rp) && /H3RunPod\.show\(true, "runpod"\)/.test(src("static/podsdock.js")) && /H3RunPod\.show\(true, ""\)/.test(src("static/powerstats.js")) && /id = "s_costs"/.test(rp));
  check("picking Local no longer closes 💲 Costs (this computer's costs are in it)", /\["rgen", "pods"\]\.forEach/.test(src("static/gpusplit.js")));
  check("routes/costs.js mounted from routes/index.js (not server.js)", /require\("\.\/costs"\)\.mount\(app\)/.test(src("routes/index.js")) && !/costs/.test(src("misc/server.js")));
  check("the LLM answers are kept by llmChat / captioner / quickPrompt", ["lib/llmChat.js", "lib/captioner.js", "lib/quickPrompt.js"].every((f) => /require\("\.\/costs"\)\.noteLlm\(remote, /.test(src(f))));

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
function r4(n) { return Math.round(n * 10000) / 10000; }
