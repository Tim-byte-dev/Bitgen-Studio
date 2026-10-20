#!/usr/bin/env node
/* bitGen Studio — 2.444.0 in a REAL browser: the image editor's ✨ EDIT / GENERATE RUN FROM THE PROMPT DOCKER
 * (pcpromptlink.js) + its ⚙ SETTINGS (pcprefs.js). Tim: "when image edit docker is open and the edit tab is clicked,
 * change the dropdown in the prompt docker to qwen2.1 edit, change the generate button to edit, remove the edit button
 * and model dropdown from the edit tab ... when the generate tab is clicked use the selected layer and generate from the
 * prompt docker into the selection of the selected layer (blend with the current selected layer like how krita ai does
 * it). add the settings button to the right of the image-editor menubar".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. The AI is stubbed. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the prompt docker link browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.promptLink, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(1500);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      window.__pl = [];
      E.api.aiedit = async (req) => { window.__pl.push({ prompt: req.prompt, mode: req.mode, style: req.style_id, w: req.width, h: req.height }); return { jobs: [{ id: "pl" + window.__pl.length, seed: 5 }] }; };
      E.api.awaitResult = async () => { const r = window.__pl[window.__pl.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      E.docs.setTabs(true);
      E.openDoc(200, 150, "pl.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 200, 150); });
      const L = E.makeLayer("Paint", 200, 150); E.addLayer(L, "t", false);
      E.selectAll(); E.deselect();
      const a = new Uint8Array(200 * 150); for (let y = 40; y < 110; y++) a.fill(255, y * 200 + 50, y * 200 + 150); E.applyShape(a, "replace", "t");
      // an image style list with the Qwen edit in it (the e2e install may not have it)
      const sel = document.getElementById("styleSel");
      if (![...sel.options].some((o) => /qwen.*2\.1.*edit/i.test(o.textContent))) { const o = document.createElement("option"); o.value = "zzq21"; o.textContent = "Qwen Image 2.1 edit"; sel.appendChild(o); }
      if (document.getElementById("genModeSel").value !== "image") { document.getElementById("genModeSel").value = "image"; document.getElementById("genModeSel").onchange(); }
      window.__styleBefore = sel.value === "zzq21" ? (sel.options[0] || {}).value : sel.value;
      sel.value = window.__styleBefore;
      E.ui.showTab("kxAi");
    });
    await p.waitForTimeout(300);
    const btn = (sel) => ev((s) => { const x = document.querySelector(s); return x ? getComputedStyle(x).display !== "none" && x.getClientRects().length > 0 : false; }, sel);

    /* 1 the Edit tab: the prompt docker's style = Qwen Image 2.1 edit, its button = Edit, the panel's button + model gone */
    await ev(() => document.querySelector('#kxModes [data-mode="edit"]').click()); await p.waitForTimeout(300);
    const e1 = await ev(() => ({ style: document.getElementById("styleSel").selectedOptions[0].textContent, go: document.getElementById("go").textContent, note: document.getElementById("kxPdNote").textContent }));
    const hidden = { run: await btn("#kxRun"), model: await btn("#kxRowEdit"), prompt: await btn("#iePrompt"), note: await btn("#kxPdNote") };
    await shot("1-edit");
    check("the ✨ AI panel's Edit tab: the prompt docker's image style becomes Qwen Image 2.1 edit, its button reads ✏ Edit", /qwen image 2\.1 edit/i.test(e1.style) && e1.go === "✏ Edit", e1);
    check("...the panel's own ✨ Edit button, its model row and its prompt box are gone; a line says to use the prompt docker", !hidden.run && !hidden.model && !hidden.prompt && hidden.note && /prompt docker/.test(e1.note), hidden);
    const q0 = await ev(() => GENQUEUE.waiting(GQ).length + (GENQUEUE.running(GQ) ? 1 : 0));
    const nE = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "make it red"; runGenerate(); });
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, nE, { timeout: 15000 });   // 2.543.0: an Edit is a new layer
    const r1 = await ev(() => ({ req: window.__pl[0], q: GENQUEUE.waiting(GQ).length + (GENQUEUE.running(GQ) ? 1 : 0), top: window.imageEditorInstance.E.S.layers.map((L) => L.name) }));
    check("...the prompt docker's Edit runs the EDITOR's edit with its prompt (nothing goes into the generate queue) - 2.543.0: the result a new layer", r1.req && r1.req.mode === "edit" && r1.req.prompt === "make it red" && r1.q === q0 && r1.top.some((n) => /edit: make it red/.test(n)), { r1, q0 });
    await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((L) => /edit: make it red/.test(L.name)); if (i >= 0) { E.S.layers.splice(i, 1); E.S.active = E.S.layers.findIndex((L) => L.name === "Paint"); E.refresh(); E.renderLayersPanel(); } });

    /* 2 the Generate tab: the style back, the button Generate; it renders into the selection; ✔ Apply blends into the layer */
    await ev(() => document.querySelector('#kxModes [data-mode="generate"]').click()); await p.waitForTimeout(300);
    const g1 = await ev(() => ({ style: document.getElementById("styleSel").value, was: window.__styleBefore, go: document.getElementById("go").textContent }));
    check("the Generate tab: the prompt docker's style is put back, its button reads ✨ Generate (the panel's own button gone too)", g1.style === g1.was && g1.go === "✨ Generate" && !(await btn("#kxRun")), g1);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { document.getElementById("prompt").value = "a red ball"; runGenerate(); });
    // 2.549.0 (Tim: "when in image-edit mode a generated image is becoming the canvas instead of a new layer"): a NEW LAYER
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n0, { timeout: 15000 });
    await p.waitForTimeout(300);
    const a2 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, P0 = S.layers.find((x) => x.name === "Paint"), N = S.layers.find((x) => /✨ generate: a red ball/.test(x.name));
      const px = (L, x, y) => Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
      return { req: window.__pl[window.__pl.length - 1], n: S.layers.length, name: N && N.name, inN: N && px(N, 100, 75), outN: N && px(N, 10, 10), inP: px(P0, 100, 75), results: S.results.length }; });
    await shot("2-newlayer");
    check("...the prompt docker's Generate renders the selection with its prompt", a2.req.mode === "generate" && a2.req.prompt === "a red ball", a2);
    check("...the result is a NEW LAYER (2.549.0 - it blended into Paint): magenta inside the selection, nothing outside it, Paint untouched, nothing left over the canvas",
      a2.n === n0 + 1 && !!a2.name && a2.inN[0] > 240 && a2.inN[1] < 20 && a2.inN[3] > 240 && a2.outN[3] === 0 && a2.inP[3] === 0 && a2.results === 0, { a2, n0 });
    const u = await ev(() => { const E = window.imageEditorInstance.E; E.undo(); return E.S.layers.length; });
    check("...one undo takes it out", u === n0, u);

    /* 3 another tab: not linked - the prompt docker as before */
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps")); await p.waitForTimeout(300);
    const o3 = await ev(() => ({ go: document.getElementById("go").textContent, take: window.H3TakeGenerate("image", "x") }));
    check("the ✨ AI panel not showing: the button is the prompt docker's own again and its Generate is not taken", !/Edit|✨/.test(o3.go) && o3.take === false, o3);

    /* 4 ⚙ at the right of the editor's menu bar: the editor's settings */
    const g4 = await ev(() => { const mr = document.querySelector("#imageeditdock .pcmenu .mr"); return { last: mr && mr.lastElementChild && mr.lastElementChild.id, cmd: window.imageEditorInstance.E.ui.CMD.has("edit.prefs") }; });
    await ev(() => document.getElementById("kxPrefs").click()); await p.waitForTimeout(250);
    const d4 = await ev(() => ({ open: !!document.getElementById("pcPrefs"), tabs: [...document.querySelectorAll("#pcPrefs [data-prtab]")].map((x) => x.textContent) }));
    await ev(() => { const s = document.getElementById("prCount"); s.value = "3"; document.querySelector("#pcPrefs .ok").click(); });
    const c4 = await ev(() => ({ count: window.imageEditorInstance.E.S.count, panel: document.getElementById("kxCount").value }));
    await shot("4-prefs");
    check("⚙ at the right end of the editor's menu bar (and Edit ▸ Preferences…) opens the editor's settings - ✨ AI, Interface; a change is kept", g4.last === "kxPrefs" && g4.cmd && d4.open && d4.tabs.includes("✨ AI") && d4.tabs.includes("Interface") && c4.count === 3 && c4.panel === "3", { g4, d4, c4 });
    await ev(() => { const E = window.imageEditorInstance.E; E.S.count = 1; E.store.set("count", 1); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
