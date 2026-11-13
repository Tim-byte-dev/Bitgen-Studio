#!/usr/bin/env node
/* bitGen Studio — 2.771.0 browser test: THE 💲 COSTS DOCKER + THE 📊 STATISTICS DIALOG (static/runpoddock.js, static/statsdlg.js,
 * routes/costs.js, routes/genStats.js) on a running studio (H3_URL, default :8311) - run from the studio's own folder (its
 * usage/ gets two generations + a pod preparation for the test, removed afterwards).
 * Tim (verbatim): "add a tab for statistics - change the runpod docker to Costs, show all costs summary, if user clicks on one of
 * the costs open a detailed lists of expenditure for that platform or local" + "record the time it takes to prepare a pod for
 * generation … show user startup time, generation time and total time" + "statistics go is Statistics Dialog, Costs Docker
 * should include local costs and all the diferent platform costs individually"
 * The platforms' figures come from the page's own stand-ins (page.route) - no RunPod / OpenRouter is asked.
 * No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs"), path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.771.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const pad = (n) => String(n).padStart(2, "0");
const now = new Date(), TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const GSF = path.join(ROOT, "usage", `genstats-${now.getFullYear()}-${pad(now.getMonth() + 1)}.jsonl`);

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.771.0 browser test did not run"); process.exit(0); }
  // two generations (a pod render that waited for a preparation, a local one) + the preparation - in this studio's usage/
  let gs0 = null; try { gs0 = fs.readFileSync(GSF); } catch { gs0 = null; }
  const T = Date.now();
  fs.mkdirSync(path.dirname(GSF), { recursive: true });
  fs.appendFileSync(GSF, [
    { k: "prep", v: 1, at: T - 300000, day: TODAY, pod: "pod771", kind: "prepare", ms: 240000, phases: { download: 180000, nodes: 50000, check: 10000 }, styles: ["Krea 2"], problems: [] },
    { k: "gen", v: 1, t: T - 10000, day: TODAY, id: "g771a", project: "default", mode: "image", status: "done", what: "Krea 2", prompt: "a fox", where: "runpod", label: "RunPod pod pod771", pod: "pod771",
      queued_ms: 2000, startup_ms: 250000, gen_ms: 40000, total_ms: 290000, preps: [{ at: T - 300000, ms: 240000, kind: "prepare", phases: { download: 180000, nodes: 50000, check: 10000 } }] },
    { k: "gen", v: 1, t: T - 5000, day: TODAY, id: "g771b", project: "default", mode: "t2va", status: "failed", what: "H3", prompt: "a river", where: "local", label: "this computer", pod: "",
      queued_ms: 0, startup_ms: 8000, gen_ms: 120000, total_ms: 128000 },
  ].map((o) => JSON.stringify(o)).join("\n") + "\n");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const json = (route, j) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
  const asked = [];
  await p.route("**/api/costs?*", (route) => {
    const u = new URL(route.request().url()); asked.push(u.searchParams.get("range"));
    json(route, { range: u.searchParams.get("range"), from: TODAY, to: TODAY, currency: "AUD", total: 12.34, at: Date.now(), rows: [
      { id: "local", icon: "🖥", name: "This computer", cost: 3.21, usd: null, currency: "AUD", sub: "5.00 kWh · 2 jobs" },
      { id: "runpod", icon: "☁", name: "RunPod", cost: 6, usd: 4, currency: "AUD", sub: "1 pod running now · pods" },
      { id: "openrouter", icon: "🧠", name: "OpenRouter", cost: 0.45, usd: 0.3, currency: "AUD", sub: "3 LLM calls by bitGen · OpenRouter's figure today (UTC)" },
      { id: "api:a771", icon: "🔑", name: "Fal (fal)", cost: 0.09, usd: 0.06, currency: "AUD", sub: "1 render" }] });
  });
  await p.route("**/api/costs/local?*", (route) => json(route, { id: "local", currency: "AUD", cost: 3.21, energy: 2.21, supply: 1, wh: 5000,
    days: [{ day: TODAY, wh: 5000, jobs: 2, secs: 7200, energy: 2.21, supply: 1, total: 3.21 }], jobs: [{ t: Date.now(), mode: "image", what: "Krea 2", status: "done", secs: 60, wh: 40, cost: 0.02 }] }));
  await p.route("**/api/costs/runpod?*", (route) => json(route, { id: "runpod", currency: "AUD", days: [{ day: TODAY, pods_usd: 3.5, sls_usd: 0.5, cost: 6 }], serverless: { month_usd: 0.5 } }));
  await p.route("**/api/costs/openrouter?*", (route) => json(route, { id: "openrouter", currency: "AUD", key: { usage_daily: 0.3, usage_weekly: 1, usage_monthly: 4, usage: 9, limit: 20, limit_remaining: 11 },
    figure: { usd: 0.3, said: "today (UTC)" }, own: { count: 3, in: 300, out: 60, cost: 0.004, priced: 2, by_model: [{ model: "or/m1", count: 2, in: 200, out: 40, cost: 0.004 }, { model: "or/free:free", count: 1, in: 100, out: 20, cost: 0 }] },
    calls: [{ t: Date.now(), model: "or/m1", kind: "llm", in: 100, out: 20, cost: 0.002 }, { t: Date.now(), model: "or/free:free", kind: "vlm", in: 100, out: 20, cost: null }] }));
  await p.route("**/api/pods/account*", (route) => json(route, { balance: 42.5, spend_hr: 0.85, spend_limit: 80, under: false, lasts_hr: 50, at: Date.now() }));
  await p.route("**/api/pods/costs*", (route) => json(route, { running: 1, running_hr: 0.44, today_usd: 1.23, month_usd: 17.5, pods: { pod771: { today: 1.2, month: 9.5 } }, at: Date.now() }));
  await p.route("**/api/pods/mine", (route) => json(route, { pods: [{ id: "pod771", name: "Krea pod", status: "RUNNING", cost_hr: 0.44 }] }));
  await p.route("**/api/pods/gpus*", (route) => json(route, { cloud: "SECURE", gpus: [{ id: "NVIDIA A40", name: "A40", memory: 48, price: 0.44, availability: "HIGH", offered: true, max: 8 }] }));
  const vis = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
  try {
    await p.goto(URL0, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.SecFloat && SecFloat.started && SecFloat.windows.runpod && window.H3RunPod && window.H3Stats && document.getElementById("rpBody"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    /* ---- 1 all costs */
    await ev(() => H3RunPod.show(true, ""));
    await p.waitForFunction(() => document.querySelectorAll("#cdSum tbody tr").length >= 4, null, { timeout: 15000 }).catch(() => {});
    const sum = await ev(() => ({ title: (document.querySelector("#sf-runpod .sft") || {}).textContent, rows: [...document.querySelectorAll("#cdSum tbody tr")].map((r) => r.dataset.cdrow),
      total: (document.getElementById("cdTotal") || {}).textContent, det: document.getElementById("cdDetView").hidden, local: (document.querySelector('#cdSum tr[data-cdrow="local"]') || {}).textContent }));
    check("the docker is called 💲 COSTS", /COSTS/.test(sum.title || ""), sum.title);
    check("all costs: a row for this computer and each platform on its own (RunPod, OpenRouter, an API service)", JSON.stringify(sum.rows) === '["local","runpod","openrouter","api:a771"]', sum.rows);
    check("…this computer's row says its kWh and jobs; the total is shown", /This computer/.test(sum.local) && /5\.00 kWh · 2 jobs/.test(sum.local) && /12\.34/.test(sum.total || ""), sum);
    check("…opened on all costs (no platform's list)", sum.det === true && await vis("#cdSum"));
    check("…asked for this month first", asked[0] === "month", asked);
    await p.click('.rpk [data-cdrange="today"]'); await p.waitForTimeout(500);
    check("a range button asks again for those days (Today) and is shown pressed", asked.includes("today") && await ev(() => document.querySelector('.rpk [data-cdrange="today"]').getAttribute("aria-pressed") === "true"), asked);
    /* ---- 2 this computer's list */
    await p.click('#cdSum tr[data-cdrow="local"]');
    await p.waitForFunction(() => document.querySelector("#cdLocalDays tbody tr"), null, { timeout: 10000 }).catch(() => {});
    const loc = await ev(() => ({ title: document.getElementById("cdDetTitle").textContent, days: document.querySelectorAll("#cdLocalDays tbody tr").length, jobs: document.querySelectorAll("#cdLocalJobs tbody tr").length,
      tot: (document.getElementById("cdLocalTot") || {}).textContent, sumHidden: document.getElementById("cdSumView").hidden, rp: document.getElementById("cdRunpod").hidden }));
    check("a click on This computer = its detailed list: energy + supply, day by day, every job", /This computer/.test(loc.title) && loc.days === 1 && loc.jobs === 1 && /Supply charge/.test(loc.tot) && loc.sumHidden && loc.rp, loc);
    await p.click("#cdBack"); await p.waitForTimeout(200);
    check("← All costs goes back to the summary", await vis("#cdSum") && await ev(() => document.getElementById("cdDetView").hidden));
    /* ---- 3 RunPod's list */
    await p.press('#cdSum tr[data-cdrow="runpod"]', "Enter");
    await p.waitForFunction(() => document.getElementById("rpBalance") && document.querySelector("#cdRpDays tbody tr") && document.querySelector("#rpGpus tbody tr"), null, { timeout: 15000 }).catch(() => {});
    const rp = await ev(() => ({ bal: (document.getElementById("rpBalance") || {}).textContent, days: document.querySelectorAll("#cdRpDays tbody tr").length, pods: [...document.querySelectorAll("#rpPods tbody tr")].map((r) => r.dataset.rppod), shown: !document.getElementById("cdRunpod").hidden }));
    check("RunPod's row (Enter on it) = its list: the balance, the pods, by day, the GPU prices", rp.shown && /42\.5/.test(rp.bal) && rp.days === 1 && rp.pods.includes("pod771") && await vis("#rpQ"), rp);
    await p.click("#cdBack"); await p.waitForTimeout(200);
    /* ---- 4 OpenRouter's list */
    await p.click('#cdSum tr[data-cdrow="openrouter"]');
    await p.waitForFunction(() => document.querySelector("#cdModels tbody tr") && document.querySelector("#cdCalls tbody tr"), null, { timeout: 10000 }).catch(() => {});
    const orr = await ev(() => ({ key: (document.getElementById("cdOrKey") || {}).textContent, models: document.querySelectorAll("#cdModels tbody tr").length, calls: [...document.querySelectorAll("#cdCalls tbody tr")].map((r) => r.lastElementChild.textContent), rp: document.getElementById("cdRunpod").hidden }));
    check("OpenRouter's list: its own figures for the key (today / week / month / since made, the limit left) + bitGen's calls by model and one by one", /This month \(UTC\)/.test(orr.key) && /Limit left/.test(orr.key) && orr.models === 2 && orr.calls.length === 2 && orr.calls[1] === "-" && orr.rp, orr);
    await p.click("#cdBack"); await p.waitForTimeout(200);
    /* ---- 5 the 📊 Statistics dialog */
    await p.click("#cdStats");
    await p.waitForFunction(() => document.querySelectorAll("#stGens tbody tr").length >= 2, null, { timeout: 15000 }).catch(() => {});
    const st = await ev(() => ({ shown: !document.getElementById("stDlg").hidden, count: (document.querySelector("#stCount b") || {}).textContent, start: (document.querySelector("#stStartAvg b") || {}).textContent,
      gen: (document.querySelector("#stGenAvg b") || {}).textContent, tot: (document.querySelector("#stTotAvg b") || {}).textContent, preps: (document.querySelector("#stPreps b") || {}).textContent,
      rows: [...document.querySelectorAll("#stGens tbody tr")].map((r) => [...r.children].slice(-3).map((c) => c.textContent).join("|")), range: document.querySelector('#stDlg [data-strange="today"]').getAttribute("aria-pressed") }));
    check("📊 Statistics opens the dialog with the docker's range (Today)", st.shown && st.range === "true", st);
    check("…the totals: 2 generations, average startup / generation / total, the pod preparations", st.count === "2" && st.start === "2 min 9 s" && st.gen === "1 min 20 s" && st.tot === "3 min 29 s" && st.preps === "1", st);
    check("…each generation on its own: startup | generation | total", st.rows.includes("4 min 10 s|40 s|4 min 50 s") && st.rows.includes("8 s|2 min|2 min 8 s"), st.rows);
    await p.click('#stGens tr[data-stgen="g771a"]'); await p.waitForTimeout(200);
    const prep = await ev(() => (document.querySelector("#stGens tr.prep") || {}).textContent || "");
    check("…a pod render clicked shows the preparation it waited for, with its phases", /pod made ready 4 min/.test(prep) && /downloads 3 min/.test(prep) && /node packs 50 s/.test(prep), prep);
    await p.click('#stDlg [data-sttab="preps"]'); await p.waitForTimeout(200);
    const pl = await ev(() => [...document.querySelectorAll("#stPrepList tbody tr")].map((r) => r.textContent));
    check("…Pod preparations: each one - the pod, how long, its phases, the styles", pl.length === 1 && /pod771/.test(pl[0]) && /4 min/.test(pl[0]) && /Krea 2/.test(pl[0]), pl);
    await p.click('#stDlg [data-sttab="where"]'); await p.waitForTimeout(200);
    const bw = await ev(() => [...document.querySelectorAll("#stBy tbody tr")].map((r) => r.firstElementChild.textContent));
    check("…By place: RunPod pods / this computer", bw.includes("RunPod pods") && bw.includes("this computer"), bw);
    const csv = await ev(() => document.getElementById("stCsv").getAttribute("href"));
    check("…⤓ CSV for the list shown", /\/api\/genstats\/csv\?kind=gens&from=/.test(csv), csv);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…Esc closes it", await ev(() => document.getElementById("stDlg").hidden));
    /* ---- 6 the buttons */
    const btns = await ev(() => ({ costs: !!document.getElementById("s_costs"), stats: !!document.getElementById("s_stats"), order: [...((document.getElementById("s_usage") || {}).parentNode || document).querySelectorAll("#s_usage,#s_costs,#s_stats")].map((e) => e.id).join() }));
    check("Settings ▸ General ▸ Energy cost: 📊 Usage… 💲 Costs… 📊 Statistics…", btns.costs && btns.stats && btns.order === "s_usage,s_costs,s_stats", btns);
    await ev(() => H3RunPod.show(false));
    const sb = await ev(() => !!document.getElementById("statCosts"));
    if (sb) {
      await ev(() => document.getElementById("statCosts").click()); await p.waitForTimeout(300);
      check("the System stats' 💲 opens 💲 Costs on all costs (not 📊 Usage)", await ev(() => (SecFloat.state("runpod") || {}).shown && !document.getElementById("cdSumView").hidden && !((SecFloat.state("usage") || {}).shown)));
    } else console.log("NOTE: no System stats energy row on this page (no meters here) - its 💲 not checked");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run", false, String(e && e.stack || e)); }
  finally {
    await ev(() => { try { H3RunPod.show(false); H3Stats.show(false); } catch (e) { /* fine */ } }).catch(() => {});
    await b.close();
    if (gs0) fs.writeFileSync(GSF, gs0); else fs.rmSync(GSF, { force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
