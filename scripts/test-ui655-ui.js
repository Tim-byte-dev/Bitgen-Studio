#!/usr/bin/env node
/* bitGen Studio — 2.655.0 in a REAL browser: 🩹 RESTORE STARTS BY ITSELF - Ctrl+click sends the restore to the edit model,
 * Shift+click the colourising restore, a plain click sends nothing, no photo = not started (the AI stubbed - what is SENT).
 * Tim (verbatim): "can u add ctrl click starts the job automatically, a click starts the colorize job automatically"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.655.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const note = () => ev(() => (document.getElementById("ptRestoreNote") || {}).textContent || "");
  const sent = () => ev(() => window.__sent.slice());
  const reset = () => ev(() => { window.__sent.length = 0; document.getElementById("prompt").value = "her dress was dark green"; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PtRestore && H3PtRestore.clickAction && window.H3ImgOp && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (!d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); rgClear(); renderTray();
      const g = document.getElementById("genModeSel"); g.value = "video"; g.onchange();
      const E = window.imageEditorInstance.E; window.__sent = []; E.api.aiedit = async (req) => { window.__sent.push({ mode: req.mode, prompt: req.prompt, crop: !!req.crop }); return { jobs: [{ id: "stub" + window.__sent.length }] }; }; });
    await ev(() => H3PromptFront.front()); await p.waitForTimeout(900);

    /* ---- no photo: Ctrl+click starts nothing */
    await reset(); await p.click("#ptRestore", { modifiers: ["Control"] }); await p.waitForTimeout(1900);
    const n0 = await note(), s0 = await sent();
    check("Ctrl+click with no photo: nothing sent, the note says it was not started and what to do", s0.length === 0 && /^🩹 Not started - put the photo in the 🖼 References docker/.test(n0), { n0, s0 });

    /* ---- a photo in the References docker */
    await ev(async () => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const g = c.getContext("2d"); g.fillStyle = "#8a7a60"; g.fillRect(0, 0, 320, 240);
      const bl = await new Promise((ok) => c.toBlob(ok, "image/png")); const f = new File([bl], "old-photo.png", { type: "image/png" });
      refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "" }); renderTray(); });
    await p.waitForTimeout(600);
    await reset(); await p.click("#ptRestore"); await p.waitForTimeout(1900);
    check("a plain click still only sets it up (nothing sent)", (await sent()).length === 0, await sent());

    await reset(); await p.click("#ptRestore", { modifiers: ["Control"] });
    const n1 = await note();
    await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
    const s1 = await sent();
    check("Ctrl+click: the note says it is restoring the References picture and starting", /^🩹 Restoring the picture in the 🖼 References docker - starting ✏ Edit/.test(n1), n1);
    check("…the restore starts by itself: ONE ✏ Edit job with the restore instruction (no colourising), the photo and the typed words",
      s1.length === 1 && s1[0].mode === "edit" && s1[0].crop && /^Restore this photo:/.test(s1[0].prompt) && !/colourise/.test(s1[0].prompt) && /her dress was dark green$/.test(s1[0].prompt), s1);

    await reset(); await p.click("#ptRestore", { modifiers: ["Shift"] });
    const n2 = await note();
    await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
    const s2 = await sent();
    check("Shift+click: the colourising restore starts by itself (one job, the instruction + colourise)",
      /^🎨 Restoring and colourising/.test(n2) && s2.length === 1 && s2[0].mode === "edit" && /^Restore this photo:/.test(s2[0].prompt) && (s2[0].prompt.match(/colourise/g) || []).length === 1, { n2, s2 });

    // two quick Ctrl+clicks = one job (the newer click wins)
    await reset(); await p.click("#ptRestore", { modifiers: ["Control"] }); await p.waitForTimeout(250); await p.click("#ptRestore", { modifiers: ["Control"] });
    await p.waitForTimeout(2600);
    check("two quick Ctrl+clicks start ONE job", (await sent()).length === 1, await sent());

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  try { await ev(() => { rgClear(); renderTray(); }); } catch { /* fine */ }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
