#!/usr/bin/env node
/* bitGen Studio — 2.544.0 in a REAL browser: theme edit mode's ☐ hidden in Expert mode.
 * Tim: "in theme edit mode, add a checkbox for visibility in expert mode to the properties dialog. this will change the
 * visibility of the element in expert mode but not in basic mode". 🖌 edit mode, click the 🎤 Speak button, tick the box:
 * leaving edit mode it is gone with Expert mode on and back with it off; edit mode with Expert on shows it faint so it can
 * be picked; untick = always there. Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.544.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn") && document.getElementById("micBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { H3ThemeEdit.setStyles({}); document.documentElement.classList.remove("expert"); });
    const shown = () => ev(() => { const m = document.getElementById("micBtn"); return { disp: getComputedStyle(m).display, op: getComputedStyle(m).opacity, out: getComputedStyle(m).outlineColor, rule: H3ThemeEdit.styles()["#micBtn"] || null }; });
    await ev(() => H3ThemeEdit.toggle(true)); await p.waitForTimeout(300);
    await ev(() => H3ThemeEdit.pick(document.getElementById("micBtn"))); await p.waitForTimeout(400);
    const box = await ev(() => { const x = document.getElementById("teXHide"); return x ? { label: x.parentElement.textContent.trim(), checked: x.checked } : null; });
    check("the Style panel has ☐ hidden in Expert mode (beside ☐ hidden)", box && /hidden in Expert mode/.test(box.label) && !box.checked, box);
    await p.click("#teXHide"); await p.waitForTimeout(300);
    const r1 = await shown();
    check("ticked: the rule keeps xhide (Basic mode: still shown, even in edit mode)", r1.rule && r1.rule.xhide === true && r1.disp !== "none" && r1.op === "1", r1);
    await ev(() => document.documentElement.classList.add("expert")); await p.waitForTimeout(200);
    const r2 = await shown();
    check("...Expert mode on, still in edit mode: faint with a blue dashed outline (so it can be picked again)", r2.disp !== "none" && +r2.op < 0.5 && /38, 128, 235/.test(r2.out), r2);
    await ev(() => H3ThemeEdit.toggle(false, { force: true })); await p.waitForTimeout(300);
    const r3 = await shown();
    check("...edit mode left: Expert mode on = the element is gone", r3.disp === "none", r3);
    await ev(() => document.documentElement.classList.remove("expert")); await p.waitForTimeout(200);
    const r4 = await shown();
    check("...Basic mode (Expert off) = it is back", r4.disp !== "none" && r4.op === "1", r4);
    await ev(() => { H3ThemeEdit.toggle(true); H3ThemeEdit.pick(document.getElementById("micBtn")); }); await p.waitForTimeout(400);
    const c5 = await ev(() => document.getElementById("teXHide").checked);
    await p.click("#teXHide"); await p.waitForTimeout(300);
    await ev(() => { H3ThemeEdit.toggle(false, { force: true }); document.documentElement.classList.add("expert"); }); await p.waitForTimeout(200);
    const r5 = await shown();
    check("picked again the box shows ticked; unticked = shown in Expert mode too (the rule gone)", c5 === true && r5.disp !== "none" && !r5.rule, { c5, r5 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { try { await ev(() => { H3ThemeEdit.setStyles({}); document.documentElement.classList.remove("expert"); }); } catch { /* fine */ } await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
