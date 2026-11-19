#!/usr/bin/env node
/* bitGen Studio — 2.871.0 in a REAL browser: the Character creator's sheet tab - a prompt, the image styles of the prompt docker and
 * ✨ Generate under 📂 Load picture; the line under it says Override style off = the style's own settings, on + the prompt docker's
 * style = Basic Settings now, on + another style = that style's saved Basic Settings (sent with the render); the made picture opens in
 * the sheet's canvas and joins the character's generations. The render itself is answered by the test (no ComfyUI here).
 * Against the running app (H3_URL). */
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
  const sent = [], gens = [];
  await p.route("**/api/genimage", async (route) => { sent.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ json: { id: "fake871", status: "queued" } }); });
  await p.route("**/api/jobs/fake871", (route) => route.fulfill({ json: { id: "fake871", status: "done", outputs: ["hero871.png"] } }));
  await p.route("**/outputs/hero871.png", (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  await p.route("**/api/characters/gens", async (route) => { if (route.request().method() === "POST") { gens.push(JSON.parse(route.request().postData() || "{}")); return route.fulfill({ json: { gens: [] } }); } return route.continue(); });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic") && document.getElementById("styleSel") && document.getElementById("styleSel").options.length > 1, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const c = document.getElementById("ovrStyle"); if (c && c.checked) c.click(); document.getElementById("chNewPic").click(); });
    await p.waitForFunction(() => document.getElementById("h3sPicStyle") && document.getElementById("h3sPicStyle").options.length > 0, null, { timeout: 15000 });
    const v0 = await ev(() => {
      const ss = document.getElementById("styleSel"), ps = document.getElementById("h3sPicStyle"), row = document.getElementById("h3sPicBar");
      return { mine: [...ps.options].map((o) => o.value), theirs: [...ss.options].filter((o) => o.value).map((o) => o.value), pick: ps.value, prompt: ss.value,
        afterLoad: row && row.previousElementSibling && row.previousElementSibling.contains(document.getElementById("chSheetLoad")),
        inDlg: !!row.closest("#chMaskDlg"), btn: document.getElementById("h3sPicGo").textContent, note: document.getElementById("h3sPicNote").textContent };
    });
    check("the sheet tab's row under 📂 Load picture: a prompt, the prompt docker's image styles (its style picked), ✨ Generate", v0.afterLoad && v0.inDlg && v0.mine.join() === v0.theirs.join() && v0.pick === v0.prompt && /Generate/.test(v0.btn), v0);
    check("...Override style off: the line says the style's own settings", /Override style is off - the style's own settings/.test(v0.note), v0.note);
    const other = v0.theirs.find((x) => x !== v0.prompt);
    await ev(() => document.getElementById("ovrStyle").click());
    const v1 = await ev(() => document.getElementById("h3sPicNote").textContent);
    check("Override style ticked + the prompt docker's style: Basic Settings now", /Override style: Basic Settings now/.test(v1), v1);
    await ev((id) => {
      const SB = window.H3StyleBasic, f0 = SB.file;
      SB.file = () => { const f = Object.assign({}, f0() || {}); f.styles = Object.assign({}, f.styles || {}, { ["image:" + id]: { basic: { imgRes: "1024", imgAr: "16:9", imgSteps: "12", imgCfg: "3.5", imgSeed: "7", imgCkpt: "" } } }); return f; };
    }, other);
    await p.selectOption("#h3sPicStyle", other);
    const v2 = await ev(() => document.getElementById("h3sPicNote").textContent);
    check("...another style picked: THAT style's saved Basic Settings, said", /this style's Basic Settings · 1024 × 576, 12 steps, CFG 3\.5, seed 7/.test(v2), v2);
    await p.fill("#h3sPicPrompt", "a red-haired pirate captain, full body");
    await p.press("#h3sPicPrompt", "Enter");
    await p.waitForFunction(() => /✓ made/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const s0 = sent[0] || {};
    check("Enter = ✨ Generate: /api/genimage with the words, the picked style and its saved settings", s0.prompt === "a red-haired pirate captain, full body" && s0.style_id === other && s0.width === 1024 && s0.height === 576 && s0.steps === 12 && s0.cfg === 3.5 && s0.seed === 7, s0);
    await p.waitForFunction(() => { const c = document.getElementById("chMaskCanvas"); return c && c.width === 8; }, null, { timeout: 10000 }).catch(() => {});
    const v3 = await ev(() => ({ w: document.getElementById("chMaskCanvas").width, open: document.getElementById("chMaskDlg").open }));
    check("...the picture opens in the sheet's canvas (the dialog stays open) and joins the character's generations", v3.w === 8 && v3.open && gens.length === 1 && gens[0].add[0] === "/outputs/hero871.png", { v3, gens });
    await ev(() => document.getElementById("ovrStyle").click());
    await p.selectOption("#h3sPicStyle", other);
    await ev(() => document.getElementById("h3sPicGo").click());
    for (let i = 0; i < 40 && sent.length < 2; i++) await p.waitForTimeout(100);
    await p.waitForFunction(() => /✓ made/.test(document.getElementById("h3sPicNote").textContent) && !document.getElementById("h3sPicGo").disabled, null, { timeout: 15000 });
    const s1 = sent[1] || {};
    check("Override style off again: only the words + the style go (its own settings)", s1.style_id === other && !("steps" in s1) && !("width" in s1) && !("seed" in s1), s1);
    await p.fill("#h3sPicPrompt", "");
    await ev(() => document.getElementById("h3sPicGo").click());
    const v4 = await ev(() => document.getElementById("h3sPicNote").textContent);
    check("no words: asked for, nothing sent", /write what the character looks like first/.test(v4) && sent.length === 2, v4);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForFunction(() => document.getElementById("h3sPicStyle") && document.getElementById("h3sPicStyle").options.length > 0, null, { timeout: 15000 });
    const v5 = await ev(() => document.getElementById("h3sPicStyle").value);
    check("the picked style is kept over a reload", v5 === other, v5);
    check("no page errors", !errs.length, errs);
  } catch (e) { check("no exception: " + (e && e.stack || e), false); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
