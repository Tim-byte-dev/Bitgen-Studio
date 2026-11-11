#!/usr/bin/env node
/* bitGen Studio — 2.760.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_FX_API=http://127.0.0.1:8395 (this test's stand-in rates service) and H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2
 * (its stand-in RunPod).
 * Tim (verbatim): "put music stems and sfx as tabs in an new docker called audio, remove those buttons from the statusbar -
 * it is getting cluttered. in general tab add currency (AUD,USD,CNY,JPY)etc. convert to this currency when showing prices"
 * + "in pods docker add a button for my pods (only show my pods when this is clicked), when creating a pod hide all the
 * templates, after the pod is created only show my pods"
 *   - the statusbar: one Audio button; the Audio docker's title bar: Audio + 🎵 Music · 🎚 Stems · 💥 SFX; one on screen
 *   - Settings ▸ General ▸ Currency: AUD -> the PODS docker's pod in A$ (the dollars on hover); a typed rate; back to USD
 *   - the PODS docker: the templates without the pods; 🖥 My pods: the pods without the templates
 * Put back afterwards (USD, no typed rate, the remote settings as they were). No server / no Playwright / a port busy = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.760.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());
const listen = (srv, port) => new Promise((ok, bad) => { srv.once("error", bad); srv.listen(port, "127.0.0.1", ok); });

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.760.0 browser test did not run"); process.exit(0); }
  const fx = http.createServer((q, s) => { s.setHeader("Content-Type", "application/json"); s.end(JSON.stringify([{ date: "2026-11-10", base: "USD", quote: "AUD", rate: 1.53 }, { date: "2026-11-10", base: "USD", quote: "JPY", rate: 152 }])); });
  const POD = { id: "pod760", name: "Audio pod", desiredStatus: "EXITED", status: "EXITED", imageName: "x/comfy:1", gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, costPerHr: 0.69, ports: ["8188/http"] };
  const rp = http.createServer((q, s) => {
    const send = (code, j) => { s.writeHead(code, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    if (q.headers.authorization !== "Bearer rpa_UI760") return send(401, {});
    if (q.method === "GET" && q.url === "/v2/pods?limit=1000") return send(200, { pods: [POD] });
    if (q.method === "GET" && q.url === "/v2/pods/" + POD.id) return send(200, POD);
    if (/^\/v2\/catalog\/templates\?source=official/.test(q.url)) return send(200, { templates: [{ id: "tpl760aa", name: "ComfyUI 760", image: "x/comfy:1", disk: 40, ports: ["8188/http"], category: "NVIDIA" }], pagination: { hasNextPage: false } });
    if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: [], pagination: { hasNextPage: false } });
    send(404, {});
  });
  try { await listen(fx, 8395); } catch { console.log("SKIP: port 8395 is busy - the 2.760.0 browser test did not run"); process.exit(0); }
  try { await listen(rp, 8399); } catch { fx.close(); console.log("SKIP: port 8399 is busy - the 2.760.0 browser test did not run"); process.exit(0); }
  const c0 = await api("/api/currency"), v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit");
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI760", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "local", engine: { provider: "runpod", runpod: "pods" } });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Audio && window.H3Money && window.H3Pods && document.querySelector("#musicdock .autabs") && window.SecFloat && SecFloat.windows.pods && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await sleep(800);
    /* ---- the Audio docker */
    const sb = await ev(() => ({ old: ["tMu", "tSt", "tSfx"].filter((i) => document.getElementById(i)), au: !!document.getElementById("tAu"), text: (document.getElementById("tAu") || {}).textContent }));
    check("the statusbar: Music / Stems / SFX gone, one Audio button", sb.old.length === 0 && sb.au && sb.text === "Audio", sb);
    const st = () => ev(() => ({ on: H3Audio.IDS.filter((i) => !document.getElementById(i).classList.contains("dockgone")), lit: document.getElementById("tAu").classList.contains("on") }));
    await ev(() => H3Audio.toggle(false)); await sleep(300);
    check("…dark while the Audio docker is hidden", (await st()).on.length === 0 && !(await st()).lit, await st());
    await p.click("#tAu"); await sleep(500);
    let s = await st();
    check("Audio shows the Audio docker - one of its three, the button lit", s.on.length === 1 && s.lit, s);
    const head = await ev((id) => { const h = document.querySelector("#" + id + " .bhead"); return { text: [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(), tabs: [...h.querySelectorAll("[data-autab]")].map((x) => x.textContent) }; }, s.on[0]);
    check("…its title bar: Audio with the tabs 🎵 Music · 🎚 Stems · 💥 SFX", /^▾ Audio$/.test(head.text) && head.tabs.join("|") === "🎵 Music|🎚 Stems|💥 SFX", head);
    await p.click("#" + s.on[0] + ' [data-autab="stemsdock"]'); await sleep(500);
    s = await st();
    check("the Stems tab: Stems on screen, the others put away, its tab lit", s.on.join() === "stemsdock" && s.lit && (await ev(() => document.querySelector('#stemsdock [data-autab="stemsdock"]').classList.contains("on"))), s);
    await p.click('#stemsdock [data-autab="sfxdock"]'); await sleep(500);
    check("the SFX tab: SFX alone", (await st()).on.join() === "sfxdock");
    await p.click("#tAu"); await sleep(400);
    check("Audio again hides it (dark)", (await st()).on.length === 0 && !(await st()).lit);
    await p.click("#tAu"); await sleep(400);
    check("…and brings back the tab picked last (SFX)", (await st()).on.join() === "sfxdock");
    await ev(() => toggleDockGone("musicdock")); await sleep(400);
    check("anything that opens Music (a workspace, a saved layout, voice chat) opens it as the Audio docker's tab - SFX steps aside", (await st()).on.join() === "musicdock");
    /* ---- the PODS docker: two views */
    await ev(() => { window.H3_POD_POLL = 300; H3Pods.show(true); }); await sleep(400);
    await p.click("#pdRefresh");
    await p.waitForFunction(() => document.querySelectorAll("#pdTpl .pdCard").length === 1 && document.querySelector('#pdPods [data-pod="pod760"]'), null, { timeout: 10000 }).catch(() => {});
    const seen = (sel) => ev((x) => { const e = document.querySelector(x); return !!e && e.offsetParent !== null; }, sel);
    check("PODS: the templates (All) without the pods; 🖥 My pods with their count", (await seen("#pdTpl .pdCard")) && !(await seen("#pdPods")) && (await ev(() => document.querySelector('[data-pdsrc="mine"] .n').textContent)) === "1");
    await p.click('[data-pdsrc="mine"]'); await sleep(300);
    check("🖥 My pods: the pods alone - no template cards, no search, no filters", (await seen('#pdPods [data-pod="pod760"]')) && !(await seen("#pdTpl")) && !(await seen("#pdQ")) && !(await seen("#pdKind"))
      && /^1 pod on your RunPod account$/.test(await ev(() => document.getElementById("pdMsg").textContent)));
    const cost = () => ev(() => { const m = document.querySelector('#pdPods [data-pod="pod760"] .h3money'); return m ? { t: m.textContent, h: m.title } : null; });
    check("…its price in US dollars while USD is picked", (await cost()).t === "$0.69/h", await cost());
    /* ---- Settings ▸ General ▸ Currency */
    await ev(() => { document.getElementById("settings").showModal ? document.getElementById("settings").showModal() : null; const t = document.querySelector('#settings [data-stab="general"]'); if (t) t.click(); }); await sleep(400);
    check("Settings ▸ General: Currency with AUD, USD, CNY, JPY …", await ev(() => ["AUD", "USD", "CNY", "JPY"].every((c) => [...document.getElementById("s_cur").options].some((o) => o.value === c))));
    await p.selectOption("#s_cur", "AUD");
    await p.waitForFunction(() => /1 USD = 1\.53 AUD/.test(document.getElementById("s_curmsg").textContent), null, { timeout: 10000 }).catch(() => {});
    check("AUD: the day's rate fetched and said (1 USD = 1.53 AUD), the box for your own rate shown", /1 USD = 1\.53 AUD \(the reference rate of 2026-11-10\)/.test(await ev(() => document.getElementById("s_curmsg").textContent)) && (await seen("#s_currate")),
      await ev(() => document.getElementById("s_curmsg").textContent));
    await sleep(300);
    let c = await cost();
    check("…the pod's price at once in A$ (0.69 × 1.53), the US dollars and the rate on hover", c.t === "A$1.06/h" && c.h === "$0.69/h · 1 USD = 1.53 AUD (2026-11-10)", c);
    await p.fill("#s_currate", "2"); await p.press("#s_currate", "Tab"); await sleep(700);
    c = await cost();
    check("a rate typed (1 USD = 2 AUD) is used instead - said so on hover", c.t === "A$1.38/h" && /\(your rate\)/.test(c.h) && /Your rate/.test(await ev(() => document.getElementById("s_curmsg").textContent)), c);
    await p.fill("#s_currate", ""); await p.press("#s_currate", "Tab"); await sleep(500);
    await p.selectOption("#s_cur", "USD"); await sleep(700);
    check("USD again: US dollars, the rate box hidden", (await cost()).t === "$0.69/h" && !(await seen("#s_currate")));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close(); fx.close();
    await api("/api/currency", { code: "AUD", manual: "" }).catch(() => {});
    await api("/api/currency", { code: (c0 && c0.code) || "USD" }).catch(() => {});
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: Object.assign({ key: "", pod_id: "", pod_name: "", cost_hr: 0, port: 8188 }, v0.runpod || {}), serverless: Object.assign({ endpoint: "" }, v0.serverless || {}) }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
