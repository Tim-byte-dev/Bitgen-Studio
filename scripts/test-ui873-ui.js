#!/usr/bin/env node
/* bitGen Studio — 2.873.0 in a REAL browser: the Character creator's sheet tab - 🧍 Mannequin… Male / Female loads bitGen's
 * 3D mannequin as the start picture (kept in the project's Images, opened in the sheet's canvas at 832 x 1216); Dress it is off
 * by default; ticked, the style list holds only the edit styles and ✨ Generate sends the mannequin as picture 1 with the
 * clothes; without a mannequin it asks for one. The render is answered by the test. Against the running app (H3_URL).
 * 2.934.0 (Tim: "the mannequin sheet is the reference sheet of poses and camera angles and another image must be loaded or
 * generated"): picking a mannequin leaves the start picture alone, its reference sheet is drawn in the Layout box; Dress it is
 * gone and ✨ Generate makes the character from words (scripts/test-ui934-ui.js has the rest). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [];
  await p.route("**/api/genimage", async (route) => { sent.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ json: { id: "fake873", status: "queued" } }); });
  await p.route("**/api/jobs/fake873", (route) => route.fulfill({ json: { id: "fake873", status: "done", outputs: ["dressed873.png"] } }));
  await p.route("**/outputs/dressed873.png", (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  await p.route("**/api/characters/gens", (route) => route.request().method() === "POST" ? route.fulfill({ json: { gens: [] } }) : route.continue());
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic") && document.getElementById("styleSel") && document.getElementById("styleSel").options.length > 1, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { localStorage.removeItem("h3sheet.v1"); document.getElementById("chNewPic").click(); });
    await p.waitForFunction(() => document.getElementById("h3sMannequin"), null, { timeout: 15000 });
    const v0 = await ev(() => ({ opts: [...document.getElementById("h3sMannequin").options].map((o) => o.value), dress: !!document.getElementById("h3sDress") }));
    check("🧍 Mannequin… with Male / Female (+ 2.874.0 ＋ Add your own); 2.934.0: no Dress it", v0.opts.join() === ",male,female,__add" && v0.dress === false, v0);
    await p.selectOption("#h3sMannequin", "male");
    await p.waitForFunction(() => /is the reference sheet/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const v2 = await ev(() => { const d = document.getElementById("chMaskCanvas").getContext("2d").getImageData(2, 2, 1, 1).data;
      return { empty: d[0] === 12 && d[1] === 10 && d[2] === 8, note: document.getElementById("h3sPicNote").textContent, r: window.H3SheetDesign.reference() }; });
    check("Male: NOT opened as the start picture (the canvas stays empty); its sheet is the reference (8 heads said)",
      v2.empty && v2.r && v2.r.id === "mannequin:male" && /Male display mannequin \(8 heads\)/.test(v2.note) && /📂 load or ✨ generate/.test(v2.note), v2);
    await p.waitForFunction(() => document.getElementById("h3sPicStyle").options.length > 0, null, { timeout: 15000 });
    await p.fill("#h3sPicPrompt", "a knight in a red wool coat");
    await ev(() => document.getElementById("h3sPicGo").click());
    await p.waitForFunction(() => /✓ made/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const s0 = sent[0] || {};
    check("✨ Generate makes the CHARACTER from words (no mannequin picture sent), said in the mannequin's poses", s0.prompt === "a knight in a red wool coat" && !s0.images
      && /in the 🧍 mannequin's poses and camera angles/.test(await ev(() => document.getElementById("h3sPicNote").textContent)), s0);
    await p.selectOption("#h3sMannequin", "female");
    await p.waitForFunction(() => /Female display mannequin \(7\.5 heads\) is the reference sheet/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    check("Female: the reference now", await ev(() => window.H3SheetDesign.reference().id) === "mannequin:female");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
