#!/usr/bin/env node
/* bitGen Studio — 2.682.0 in a REAL browser: 🖌 EDIT THEME MODE + SHIFT+CLICK = THE BUTTON'S OWN ACTION. With edit theme
 * mode on a plain click picks a button (its action does not run); Shift+click runs it (nothing picked) - like Alt+click
 * (2.623.0), which still works; Ctrl+Shift+click is edit mode's as before.
 * Tim (verbatim): "when in edit theme mode , shift+click runs the buttons actions"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.682.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const state = () => ev(() => ({ n: window.__zz682 || 0, panel: !!document.getElementById("thEditPanel"), title: (document.querySelector("#thEditPanel .th b") || {}).textContent || "", on: window.H3ThemeEdit.isOn() }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn"), null, { timeout: 60000 });
    await ev(() => { const x = document.createElement("button"); x.id = "zzTe682"; x.textContent = "🧪 Count"; x.style.cssText = "position:fixed;left:700px;top:420px;z-index:5000";
      x.onclick = () => { window.__zz682 = (window.__zz682 || 0) + 1; }; document.body.appendChild(x); });
    await p.click("#thEditBtn"); await p.waitForTimeout(250);
    await p.click("#zzTe682"); await p.waitForTimeout(250);
    const s1 = await state();
    check("edit theme mode, a plain click: the button is picked (the Style panel shows it), its action does NOT run", s1.on && s1.panel && /zzTe682/.test(s1.title) && s1.n === 0, s1);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    await p.click("#zzTe682", { modifiers: ["Shift"] }); await p.waitForTimeout(250);
    const s2 = await state();
    check("Shift+click: the button's own action runs, nothing is picked, edit mode stays on", s2.on && !s2.panel && s2.n === 1, s2);
    await p.click("#zzTe682", { modifiers: ["Alt"] }); await p.waitForTimeout(250);
    const s3 = await state();
    check("Alt+click still does the same (2.623.0)", s3.on && !s3.panel && s3.n === 2, s3);
    await p.click("#zzTe682", { modifiers: ["Control", "Shift"] }); await p.waitForTimeout(250);
    const s4 = await state();
    check("Ctrl+Shift+click: edit mode's as before (the action does not run)", s4.on && s4.n === 2, s4);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    await p.click("#openSettings", { modifiers: ["Shift"] }); await p.waitForTimeout(500);
    const set = await ev(() => ({ open: document.getElementById("settings").open, on: window.H3ThemeEdit.isOn(), panel: !!document.getElementById("thEditPanel") }));
    check("Shift+click ⚙: Settings opens, edit theme mode stays on, nothing picked", set.open && set.on && !set.panel, set);
    await ev(() => { const s = document.getElementById("settings"); if (s.open) s.close(); });
    const tip = await ev(() => document.getElementById("thEditBtn").title);
    check("🖌's tooltip says Shift+click (or Alt+click) runs what it does", /Shift\+click \(or Alt\+click\) runs what it does/.test(tip), tip);
    await ev(() => window.H3ThemeEdit.toggle(false, { force: true }));
    await p.click("#zzTe682"); await p.waitForTimeout(150);
    check("live mode again: a plain click runs it", (await state()).n === 3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
