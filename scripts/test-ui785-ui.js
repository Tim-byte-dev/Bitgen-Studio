#!/usr/bin/env node
/* bitGen Studio — 2.785.0 browser test: "Runs on" - one dropdown per type at the top of the ☁ Remote generation docker
 * (Local / RunPod / OpenRouter / LAN / Team), Set all, the old radio groups hidden, Pods on the status bar only with a row on
 * RunPod. Needs a running studio (H3_URL, default :8311 - H3_E2E=1) with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 */
"use strict";
const http = require("http");
let chromium; try { ({ chromium } = require("playwright")); } catch { chromium = null; }
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.785.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.785.0 browser test did not run"); process.exit(0); }
  const rp = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(/^\/v2\/pods/.test(q.url) ? JSON.stringify({ pods: [], pagination: { hasNextPage: false } }) : "{}"); });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.785.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), e0 = await api("/api/remotegen");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI785" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/remotehosts", { kind: "all", host: "local" });
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.addInitScript(() => { window.H3_RBTN_POLL = 800; });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteHosts && document.getElementById("tRgen") && window.SecFloat && SecFloat.windows.rgen, null, { timeout: 30000 });
    await sleep(1200);
    await p.click("#tRgen");
    await p.waitForFunction(() => document.querySelectorAll("#rhGrid select").length === 9, null, { timeout: 15000 }).catch(() => {});
    const vis = (sel) => ev((s) => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== "none"; }, sel);
    const rows = await ev(() => [...document.querySelectorAll("#rhGrid .rhName")].map((x) => x.textContent));
    check("Runs on: Set all + Image, Video, Music, Text to speech, Speech to text, Song separation, LLM, Vision LLM - each a dropdown, first in the docker",
      rows.join("|") === "Set all|Image|Video|Music|Text to speech|Speech to text|Song separation|LLM|Vision LLM" && (await ev(() => document.getElementById("rgdBody").firstElementChild.id === "rgdWhere")), rows);
    check("the old radio groups are gone from sight (All local / All remote / Both, Remote servers, each type's Local / Remote, the LLM rows)",
      !(await vis("#gpuWhere")) && !(await vis('input[name="gpuProv"]')) && !(await vis('input[name="rt_image"]')) && !(await vis('input[name="rp_llm"]')) && !(await vis('#gpuLlmWhere .rpRow')));
    const opt = await ev(() => { const o = (k) => [...document.querySelector('#rhGrid select[data-rhkind="' + k + '"]').options].map((x) => (x.disabled ? "-" : "+") + x.value); return { image: o("image"), llm: o("llm"), stems: o("stems") }; });
    // 2.786.0: OpenRouter makes pictures + video (lib/orRender.js) - open on Image now
    check("Local / RunPod / OpenRouter / LAN / Team; LAN + Team greyed everywhere, OpenRouter greyed on Song separation, open on Image and the LLM",
      opt.image.join() === "+local,+runpod,+openrouter,-lan,-team" && opt.llm.join() === "+local,+runpod,+openrouter,-lan,-team" && opt.stems.join() === "+local,+runpod,-openrouter,-lan,-team", opt);
    check("everything Local: no Pods button", !(await vis("#tPods")));

    await p.selectOption('#rhGrid select[data-rhkind="image"]', "runpod"); await sleep(1800);
    let g = await api("/api/gpusplit"), h = await api("/api/remotehosts");
    check("Image ▸ RunPod: Image goes to RunPod, the rest stays here (where = both, per type)", h.hosts.image === "runpod" && h.hosts.video === "local" && g.where === "both" && g.types.image === "remote" && g.types.video === "local", { where: g.where, hosts: h.hosts });
    await p.waitForFunction(() => { const e = document.getElementById("tPods"); return e && e.style.display !== "none"; }, null, { timeout: 6000 }).catch(() => {});
    check("…a row on RunPod: Pods shows on the status bar", await vis("#tPods"));

    await p.selectOption('#rhGrid select[data-rhkind="image"]', "local"); await sleep(1500);
    await p.selectOption('#rhGrid select[data-rhkind="llm"]', "openrouter"); await sleep(1800);
    h = await api("/api/remotehosts"); g = await api("/api/gpusplit");
    check("LLM ▸ OpenRouter alone: the LLM there, nothing on RunPod", h.hosts.llm === "openrouter" && !h.any_runpod && h.hosts.image === "local" && g.where === "both", h.hosts);
    await sleep(1500);
    check("…no row on RunPod: Pods hidden", !(await vis("#tPods")));

    await p.selectOption('#rhGrid select[data-rhkind="all"]', "runpod"); await sleep(2000);
    h = await api("/api/remotehosts");
    check("Set all ▸ RunPod: every type on RunPod (LLM and Vision LLM too)", Object.values(h.hosts).every((x) => x === "runpod"), h.hosts);
    check("…Set all shows RunPod", (await ev(() => document.querySelector('#rhGrid select[data-rhkind="all"]').value)) === "runpod");
    await p.selectOption('#rhGrid select[data-rhkind="all"]', "local"); await sleep(2000);
    h = await api("/api/remotehosts"); g = await api("/api/gpusplit");
    check("Set all ▸ Local: everything here (where = local)", Object.values(h.hosts).every((x) => x === "local") && g.where === "local", { where: g.where, hosts: h.hosts });
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await api("/api/remotehosts", { kind: "all", host: "local" }).catch(() => {});
    await api("/api/gpusplit", { where: g0.where || "local", per: false, engine: g0.engine || undefined }).catch(() => {});
    await api("/api/remotegen/enabled", { on: !!e0.enabled }).catch(() => {});
    rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
