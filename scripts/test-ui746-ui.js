#!/usr/bin/env node
/* bitGen Studio — 2.746.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): REMOTE STYLES.
 * Tim (verbatim): "when radio is selected for local show local styles, remote show remote styles (create remote styles),
 * both , show all styles" + "A Runs on setting per style ... add text input in styles for endpoints if remote style is
 * selected, prefix remote style names with R_ add this on save if it is not there"
 *   - Settings ▸ Image, Video and Audio ▸ Music styles: "Runs on" under the name (This computer / Remote GPU), the endpoint
 *     box only for Remote GPU;
 *   - SDXL saved as Remote GPU + an endpoint: the server keeps runs_on / endpoint and names it R_SDXL; the form shows it;
 *   - Basic Settings ▸ GPU Local = only this computer's styles in the lists; Remote = only R_SDXL; Both = every style;
 *   - saved back as This computer: SDXL again, no endpoint.
 * Put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.746.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.746.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit"), c0 = await api("/api/config");
  const sdxl = (await api("/api/styles?kind=image")).styles.find((s) => s.name === "SDXL");
  // a remote GPU to switch to: RunPod Serverless (nothing is sent in this test)
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI746" }, serverless: { endpoint: "epui746", comfy: "0.34.0", show_all: false } });
  await api("/api/remotegpu/use", { mode: "serverless" });
  await api("/api/gpusplit", { where: "local" });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RunsOn && window.H3RpStyles && H3RpStyles.state().map && document.getElementById("styleSel").options.length > 1, null, { timeout: 30000 });
    await sleep(800);
    await ev(() => toggleSec("gpu", false));   // 2.747.0: Basic Settings ▸ GPU is closed by default
    // the editors
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="image"]').click(); });
    await sleep(500);
    await ev((id) => { const l = document.getElementById("s_stylelist"); l.value = id; l.dispatchEvent(new Event("change")); }, sdxl.id);
    await sleep(700);
    const ed = await ev(() => {
      const box = document.getElementById("s_strunson"), name = document.getElementById("s_stname");
      return { box: !!box, after: !!box && !!(name.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING), radios: [...document.querySelectorAll('input[name="s_strunson"]')].map((i) => i.value + (i.checked ? "*" : "")),
        ep: getComputedStyle(document.getElementById("s_step")).display, mu: !!document.getElementById("s_murunson"), vs: !!document.getElementById("s_vsrunson") || !!(window.H3RunsOn && H3RunsOn.build("vs")) };
    });
    check("Settings ▸ Image: \"Runs on\" under the style's name - This computer (picked) / Remote GPU, no endpoint box yet; the Music and Video editors have it too", ed.box && ed.after
      && ed.radios.join() === "local*,remote" && ed.ep === "none" && ed.mu && ed.vs, ed);
    await p.check('input[name="s_strunson"][value="remote"]'); await sleep(200);
    const epShown = await ev(() => getComputedStyle(document.getElementById("s_step")).display !== "none");
    await p.fill("#s_step", "ohkr3evlck2bxn");
    await ev(() => document.getElementById("s_stsave").click());
    await p.waitForFunction(() => /^R_SDXL$/.test(document.getElementById("s_stname").value), null, { timeout: 8000 }).catch(() => {});
    const saved = (await api("/api/styles?kind=image")).styles.find((s) => s.id === sdxl.id);
    const form = await ev(() => ({ name: document.getElementById("s_stname").value, r: (document.querySelector('input[name="s_strunson"]:checked') || {}).value, ep: document.getElementById("s_step").value }));
    check("Remote GPU: the endpoint box shows; 💾 Save -> the server keeps runs_on remote + the endpoint and names it R_SDXL; the form shows that", epShown && saved.name === "R_SDXL" && saved.runs_on === "remote"
      && saved.endpoint === "ohkr3evlck2bxn" && form.name === "R_SDXL" && form.r === "remote" && form.ep === "ohkr3evlck2bxn", { saved: { n: saved.name, r: saved.runs_on, e: saved.endpoint }, form });
    await ev(() => document.getElementById("settings").close());
    // the lists follow Basic Settings ▸ GPU
    const lists = () => ev(() => { const o = [...document.getElementById("styleSel").options].filter((x) => x.value && x.dataset.rpsl !== "note"); return { shown: o.filter((x) => !x.hidden).map((x) => x.textContent), hidden: o.filter((x) => x.hidden).map((x) => x.textContent), note: ([...document.getElementById("styleSel").options].find((x) => x.dataset.rpsl === "note") || {}).textContent || "" }; });
    const pick = async (w) => { await p.check(`input[name="gpuWhere"][value="${w}"]`); await sleep(1300); return lists(); };
    let L = await pick("local");
    check("GPU Local: the image list shows this computer's styles, not R_SDXL; its last line says why", L.hidden.join() === "R_SDXL" && L.shown.length > 3 && /1 remote styles hidden: Basic Settings ▸ GPU is on Local/.test(L.note), { hidden: L.hidden, note: L.note, n: L.shown.length });
    L = await pick("remote");
    check("GPU Remote: only the remote style R_SDXL shows", L.shown.join() === "R_SDXL" && L.hidden.length > 3 && /GPU is on Remote/.test(L.note), { shown: L.shown, note: L.note });
    check("…and it is the one picked (a hidden pick moved to it)", await ev(() => document.getElementById("styleSel").selectedOptions[0].textContent === "R_SDXL"));
    L = await pick("both");
    check("GPU Both: every style", L.hidden.length === 0 && L.shown.includes("R_SDXL") && L.shown.length > 4 && !L.note, L.hidden);
    const line = await ev(() => document.getElementById("gpuLine").textContent);
    check("…the line: R_ styles on the remote GPU, the others here", /^R_ styles: RunPod Serverless epui746 · other styles: this computer/.test(line), line);
    // back to this computer
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="image"]').click(); });
    await sleep(400);
    await ev((id) => { const l = document.getElementById("s_stylelist"); l.value = id; l.dispatchEvent(new Event("change")); }, sdxl.id);
    await sleep(500);
    await p.check('input[name="s_strunson"][value="local"]'); await sleep(100);
    await ev(() => document.getElementById("s_stsave").click());
    await p.waitForFunction(() => document.getElementById("s_stname").value === "SDXL", null, { timeout: 8000 }).catch(() => {});
    const back = (await api("/api/styles?kind=image")).styles.find((s) => s.id === sdxl.id);
    check("saved back as This computer: SDXL again, local, no endpoint", back.name === "SDXL" && back.runs_on === "local" && back.endpoint === "", { n: back.name, r: back.runs_on, e: back.endpoint });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    await api("/api/styles", { id: sdxl.id, kind: "image", runs_on: "local" }).catch(() => {});
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    if (v0.mode && v0.mode !== "local") await api("/api/remotegpu/use", { mode: v0.mode }).catch(() => {});
    if ((c0.engine || {}).comfy) await api("/api/config", { engine: { comfy: { url: c0.engine.comfy.url, autostart: c0.engine.comfy.autostart } } }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
