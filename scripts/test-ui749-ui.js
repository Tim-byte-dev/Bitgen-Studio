#!/usr/bin/env node
/* bitGen Studio — 2.749.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v1 (a stand-in RunPod REST API this test serves on 8399).
 * Tim (verbatim): "please add the remote styles - but actually looks like it ran on runpod"
 *   - the ready-made remote styles are in the image list on Remote;
 *   - Settings ▸ Remote GPU ▸ RunPod Serverless asks RunPod which image the endpoint runs (once, by itself) and says it;
 *   - with the sdxl image: R_SDXL + R_SDXL img2img listed, the FLUX / SD3 / Z-Image ones hidden with why;
 *   - another image picked: its style shows, the SDXL ones hide; "Not known yet": every remote style shows.
 * Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.749.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.749.0 browser test did not run"); process.exit(0); }
  const seen = [];
  const rest = http.createServer((q, s) => {
    seen.push({ url: q.url, auth: q.headers.authorization });
    if (q.headers.authorization !== "Bearer rpa_UI749") { s.writeHead(401); return s.end("{}"); }
    s.writeHead(200, { "Content-Type": "application/json" });
    // 2.755.0: RunPod's REST API v2 - the endpoints with their image
    s.end(JSON.stringify({ endpoints: [{ id: "epui749", image: "runpod/worker-comfyui:5.10.0-sdxl" }], pagination: { nextCursor: null, hasNextPage: false } }));
  });
  try { await new Promise((ok, bad) => { rest.once("error", bad); rest.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.749.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit"), c0 = await api("/api/config");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI749" }, serverless: { endpoint: "epui749", comfy: "0.34.0", show_all: false } });
  await api("/api/remotegpu/use", { mode: "serverless" });
  await api("/api/gpusplit", { where: "remote" });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RpStyles && H3RpStyles.state().map && document.getElementById("styleSel").options.length > 1, null, { timeout: 30000 });
    await sleep(800);
    const lists = () => ev(() => { const o = [...document.getElementById("styleSel").options].filter((x) => x.value && x.dataset.rpsl !== "note");
      return { shown: o.filter((x) => !x.hidden).map((x) => x.textContent), hidden: Object.fromEntries(o.filter((x) => x.hidden && /^R_/.test(x.textContent)).map((x) => [x.textContent, x.title])) }; });
    let L = await lists();
    check("Remote: the ready-made remote styles are in the image list - the endpoint's image asked of RunPod as the page loads (sdxl): R_SDXL and R_SDXL img2img",
      L.shown.includes("R_SDXL") && L.shown.includes("R_SDXL img2img") && (await api("/api/remotegpu/serverless/image")).image === "sdxl", L.shown);
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await p.waitForFunction(() => /RunPod: runpod\/worker-comfyui:5\.10\.0-sdxl/.test((document.getElementById("rgSlsImgMsg") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    const tab = await ev(() => ({ sel: document.getElementById("rgSlsImage").value, msg: document.getElementById("rgSlsImgMsg").textContent }));
    check("Settings ▸ Remote GPU ▸ RunPod Serverless asks RunPod by itself (Bearer key, includeTemplate) and says the image: SDXL",
      tab.sel === "sdxl" && /RunPod: runpod\/worker-comfyui:5\.10\.0-sdxl/.test(tab.msg) && seen.some((x) => x.url === "/v2/serverless?limit=1000" && x.auth === "Bearer rpa_UI749"), { tab, seen });
    await sleep(1200);
    L = await lists();
    check("…with the sdxl image: R_SDXL and R_SDXL img2img listed; the FLUX / SD3 / Z-Image ones hidden, saying why",
      L.shown.includes("R_SDXL") && L.shown.includes("R_SDXL img2img") && !L.shown.some((n) => /^R_(FLUX|SD3|Z-Image)/.test(n))
      && /made for RunPod's flux1-schnell worker image - your endpoint runs the sdxl one/.test(L.hidden["R_FLUX.1 schnell"] || ""), L);
    await p.selectOption("#rgSlsImage", "flux1-schnell"); await sleep(1500);
    L = await lists();
    check("another image picked (FLUX.1 schnell): its style shows, the SDXL ones hide", L.shown.includes("R_FLUX.1 schnell") && !L.shown.includes("R_SDXL") && (await api("/api/remotegpu/serverless/image")).image === "flux1-schnell", L.shown.filter((n) => /^R_/.test(n)));
    await p.selectOption("#rgSlsImage", ""); await sleep(1500);
    L = await lists();
    check("\"Not known yet\": every remote style shows again", ["R_SDXL", "R_FLUX.1 schnell", "R_SD3 Medium"].every((n) => L.shown.includes(n)), L.shown.filter((n) => /^R_/.test(n)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    rest.close();
    await api("/api/remotegpu/serverless/image", { image: "" }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    if ((c0.engine || {}).comfy) await api("/api/config", { engine: { comfy: { url: c0.engine.comfy.url, autostart: c0.engine.comfy.autostart } } }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
