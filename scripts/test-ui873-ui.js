#!/usr/bin/env node
/* bitGen Studio — 2.873.0 in a REAL browser: the Character creator's sheet tab - 🧍 Mannequin… Male / Female loads bitGen's
 * 3D mannequin as the start picture (kept in the project's Images, opened in the sheet's canvas at 832 x 1216); Dress it is off
 * by default; ticked, the style list holds only the edit styles and ✨ Generate sends the mannequin as picture 1 with the
 * clothes; without a mannequin it asks for one. The render is answered by the test. Against the running app (H3_URL). */
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
  let editId = "";
  await p.route("**/api/genimage", async (route) => { sent.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ json: { id: "fake873", status: "queued" } }); });
  await p.route("**/api/jobs/fake873", (route) => route.fulfill({ json: { id: "fake873", status: "done", outputs: ["dressed873.png"] } }));
  await p.route("**/outputs/dressed873.png", (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  await p.route("**/api/characters/gens", (route) => route.request().method() === "POST" ? route.fulfill({ json: { gens: [] } }) : route.continue());
  await p.route("**/api/aiedit/engines", async (route) => {
    const r = await route.fetch(); const j = await r.json(); editId = ((j.edit || [])[0] || {}).id || "";
    route.fulfill({ json: j });
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic") && document.getElementById("styleSel") && document.getElementById("styleSel").options.length > 1, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { localStorage.removeItem("h3sheet.v1"); document.getElementById("chNewPic").click(); });
    await p.waitForFunction(() => document.getElementById("h3sMannequin"), null, { timeout: 15000 });
    const v0 = await ev(() => ({ opts: [...document.getElementById("h3sMannequin").options].map((o) => o.value), dress: document.getElementById("h3sDress").checked }));
    check("🧍 Mannequin… with Male / Female (+ 2.874.0 ＋ Add your own); Dress it off by default", v0.opts.join() === ",male,female,__add" && v0.dress === false, v0);
    // Dress it ticked with no mannequin yet -> asked for one
    await ev(() => document.getElementById("h3sDress").click());
    await p.waitForFunction(() => document.getElementById("h3sPicStyle").options.length > 0 && document.getElementById("h3sPicPrompt").placeholder.includes("clothes"), null, { timeout: 15000 });
    await p.fill("#h3sPicPrompt", "a red wool coat and black jeans");
    await ev(() => document.getElementById("h3sPicGo").click());
    const v1 = await ev(() => document.getElementById("h3sPicNote").textContent);
    check("Dress it without a mannequin: asked for one, nothing sent", /pick a 🧍 mannequin first/.test(v1) && sent.length === 0, v1);
    // load the male mannequin
    await p.selectOption("#h3sMannequin", "male");
    await p.waitForFunction(() => /mannequin loaded/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    await p.waitForFunction(() => { const c = document.getElementById("chMaskCanvas"); return c && c.width > 100; }, null, { timeout: 10000 }).catch(() => {});
    const v2 = await ev(() => { const c = document.getElementById("chMaskCanvas"); return { w: c.width, h: c.height, note: document.getElementById("h3sPicNote").textContent, m: window.H3SheetDesign.mannequin() }; });
    check("Male: the mannequin opens in the sheet's canvas (832 x 1216 kept in proportion), kept as mannequin-male.png, said with its 8 heads",
      v2.w > 100 && Math.abs(v2.h / v2.w - 1216 / 832) < 0.02 && v2.m.name === "mannequin-male.png" && /Male mannequin loaded \(8 heads\)/.test(v2.note), v2);
    const v3 = await ev(() => [...document.getElementById("h3sPicStyle").options].map((o) => o.value));
    check("...Dress it ticked: only the edit styles are offered", editId && v3.includes(editId) && v3.length <= (await ev(() => document.getElementById("styleSel").options.length)), { v3, editId });
    await ev(() => document.getElementById("h3sPicGo").click());
    await p.waitForFunction(() => /✓ made/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const s0 = sent[0] || {};
    check("✨ Generate dresses it: the mannequin as picture 1, the clothes, an edit style", (s0.images || []).join() === "mannequin-male.png" && /^Dress the mannequin in <Picture 1>: a red wool coat and black jeans\./.test(s0.prompt) && v3.includes(s0.style_id), s0);
    // the female one, Dress it off
    await ev(() => document.getElementById("h3sDress").click());
    await p.selectOption("#h3sMannequin", "female");
    await p.waitForFunction(() => /Female mannequin loaded \(7\.5 heads\)/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const v4 = await ev(() => ({ note: document.getElementById("h3sPicNote").textContent, ph: document.getElementById("h3sPicPrompt").placeholder }));
    check("Female, Dress it off: loaded, the line says dressing is optional, the prompt describes a character again", /tick Dress it to put clothes on it first \(optional\)/.test(v4.note) && /Describe the character/.test(v4.ph), v4);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
