#!/usr/bin/env node
/* bitGen Studio — 2.696.0 in a REAL browser: THE SKETCHER'S PHOTO STYLE DROPDOWN. #ppRealStyle left of ✨ Photo lists the image edit
 * styles; the one picked is what ✨ Photo runs (the prompt docker's style untouched) and stays picked after a reload.
 * Tim (verbatim): "add a dropdown to the left of the photo button with image edit styles this will be exclusive to sketcher - keep
 * the last one used as selected"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.696.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  // the AI server stubbed from the start: two edit styles; what /api/aiedit is sent is kept
  await p.addInitScript(() => {
    window.__sent = []; const real = window.fetch.bind(window), J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json" } });
    window.fetch = async (u, o) => { const s = String(u);
      if (s.startsWith("/api/aiedit/engines")) return J({ edit: [{ id: "t696_qwen", name: "Qwen Edit (test)" }, { id: "t696_klein", name: "Klein Edit (test)" }], defaults: { edit: "t696_qwen" } });
      if (s === "/api/aiedit") { window.__sent.push({ style: o.body.get("style_id") }); return J({ jobs: [{ id: "t696job" }] }); }
      if (s.startsWith("/api/jobs/t696job")) return J({ status: "error" });
      return real(u, o); };
  });
  try {
    const boot = async () => {
      await p.goto(URL_, { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3SketcherReal && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
      await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
      await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
      await p.waitForFunction(() => { const s = document.getElementById("ppRealStyle"); return s && s.options.length === 2; }, null, { timeout: 15000 });
    };
    await boot();
    await ev(() => { try { localStorage.removeItem("pp.realStyle"); } catch (e) { /* fine */ } });
    const sel = () => ev(() => { const s = document.getElementById("ppRealStyle"); return { v: s.value, opts: [...s.options].map((o) => o.textContent), next: s.nextElementSibling && s.nextElementSibling.id, kept: localStorage.getItem("pp.realStyle"), prompt: (document.getElementById("styleSel") || {}).value }; });
    const s0 = await sel();
    check("the bar: a Photo style dropdown right before ✨ Photo, listing the image edit styles", s0.next === "ppReal" && JSON.stringify(s0.opts) === JSON.stringify(["Qwen Edit (test)", "Klein Edit (test)"]), s0);
    const prompt0 = s0.prompt;
    await p.selectOption("#ppRealStyle", "t696_klein"); await p.waitForTimeout(200);
    const s1 = await sel();
    check("picking Klein: kept (pp.realStyle), the prompt docker's style untouched", s1.kept === "t696_klein" && s1.prompt === prompt0, s1);
    await ev(async () => { try { await H3SketcherReal.run(""); } catch (e) { /* the stub's job ends in an error */ } }); await p.waitForTimeout(800);
    const sent = await ev(() => window.__sent.map((r) => r.style));
    check("✨ Photo runs with the Sketcher's pick (Klein), not the prompt docker's style", sent.length >= 1 && sent[0] === "t696_klein", sent);
    await boot();
    const s2 = await sel();
    check("after a reload: still Klein (the last one used stays picked)", s2.v === "t696_klein", s2);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
