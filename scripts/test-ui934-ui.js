#!/usr/bin/env node
/* bitGen Studio — 2.934.0 in a REAL browser: THE MANNEQUIN SHEET IS THE REFERENCE.
 * Tim (verbatim): "in character sheet editor the mannequin sheet is the reference sheet of poses and camera angles and another
 * image must be loaded or generated to create the character sheet."
 * 🧍 Male: the start picture stays empty, the Layout box draws the mannequin's sheet (its shape), the views its sheet shows are
 * ticked, ▶ Generate sheet without a picture sends nothing; with the character's picture it sends template=mannequin:male;
 * the pick comes back after a reload; Mannequin… (none) = the designer's own layout again. The render is the test's. (H3_URL) */
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
const EMPTY = () => { const d = document.getElementById("chMaskCanvas").getContext("2d").getImageData(2, 2, 1, 1).data; return d[0] === 12 && d[1] === 10 && d[2] === 8; };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sheets = [];
  await p.route("**/api/charsheet/h3", async (route) => {
    if (route.request().method() === "GET") { const r = await route.fetch(); const j = await r.json(); j.installed = true; return route.fulfill({ json: j }); }
    sheets.push(route.request().postDataBuffer().toString("latin1")); route.fulfill({ json: { id: "fake934", status: "queued", input: "x.png", refs: ["", "", ""], summary: "8 views" } });
  });
  await p.route("**/api/charsheet/h3/preview", (route) => route.fulfill({ json: { offline: true, summary: "" } }));
  await p.route("**/api/jobs/fake934", (route) => route.fulfill({ json: { id: "fake934", status: "queued" } }));
  await p.route("**/outputs/char934.png", (route) => route.fulfill({ body: PNG, contentType: "image/png" }));
  const open = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForFunction(() => document.getElementById("h3sMannequin") && document.getElementById("h3sTpl"), null, { timeout: 15000 });
  };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign, null, { timeout: 60000 });
    await ev(() => localStorage.removeItem("h3sheet.v1"));
    await open();
    await ev(() => window.H3SheetDesign.refresh());
    await p.selectOption("#h3sMannequin", "male");
    await p.waitForFunction(() => /is the reference sheet/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    await p.waitForTimeout(500);
    const v1 = await ev((E) => { const cv = document.getElementById("h3sCv"), t = document.getElementById("h3sTpl"), lg = document.getElementById("h3sLayout");
      return { empty: new Function("return (" + E + ")()")(), ratio: cv.height / cv.width, size: document.getElementById("h3sSize").textContent, tpl: t.value, lg: lg.checked && lg.disabled,
               views: [...document.querySelectorAll("#h3sViews input:checked")].map((c) => c.value), MQ: window.H3SheetDesign.MQ_VIEWS }; }, EMPTY.toString());
    check("🧍 Male: the start picture stays empty (another picture makes the character)", v1.empty, v1);
    check("...its reference sheet is drawn in the Layout box (2600 x 2400 shape), said, Template ▾ on the mannequin, the Layout guide locked",
      Math.abs(v1.ratio - 2400 / 2600) < 0.03 && /^Reference: Male display mannequin \(8 heads\) - the sheet follows its poses and camera angles/.test(v1.size) && v1.tpl === "__mq" && v1.lg, v1);
    check("...the views its sheet shows are ticked", v1.views.slice().sort().join() === v1.MQ.slice().sort().join(), v1.views);
    await ev(() => document.getElementById("chSheetGen").click());
    await p.waitForTimeout(500);
    check("▶ Generate sheet with no character picture: nothing sent, asked to load one", sheets.length === 0 && /load a picture first/.test(await ev(() => document.body.innerText)));
    await ev(() => window.H3CharSheetPic.open("/outputs/char934.png", "char934.png"));
    await p.waitForFunction((E) => !new Function("return (" + E + ")()")(), EMPTY.toString(), { timeout: 10000 }).catch(() => {});
    check("...the character picture comes in (📂 / ✨ - here opened by the test) and the mannequin is still the reference", await ev(() => window.H3SheetDesign.reference().id) === "mannequin:male");
    await ev(() => document.getElementById("chSheetGen").click());
    for (let i = 0; i < 50 && !sheets.length; i++) await p.waitForTimeout(100);
    check("...▶ Generate sheet: the character picture + template=mannequin:male", sheets.length === 1 && /name="template"\r\n\r\nmannequin:male\r\n/.test(sheets[0]) && /name="image"; filename=/.test(sheets[0]), sheets[0] && sheets[0].slice(0, 300));
    // a reload keeps the pick
    await p.reload({ waitUntil: "domcontentloaded" });
    await open();
    await p.waitForFunction(() => window.H3SheetDesign.reference(), null, { timeout: 15000 }).catch(() => {});
    const v2 = await ev(() => ({ r: (window.H3SheetDesign.reference() || {}).id, sel: document.getElementById("h3sMannequin").value }));
    check("the mannequin reference is kept over a reload", v2.r === "mannequin:male" && v2.sel === "male", v2);
    await p.selectOption("#h3sMannequin", "");
    const v3 = await ev(() => ({ r: window.H3SheetDesign.reference(), tpl: document.getElementById("h3sTpl").value, lg: document.getElementById("h3sLayout").disabled }));
    check("Mannequin… (none): no reference - the designer's own layout, the Layout guide free", v3.r === null && v3.tpl === "" && v3.lg === false, v3);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
