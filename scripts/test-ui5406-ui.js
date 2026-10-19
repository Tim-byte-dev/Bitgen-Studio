#!/usr/bin/env node
/* bitGen Studio — 2.540.6 in a REAL browser: theme edit mode's size handles.
 * Tim: "the ui breaks when i try to resize anything". Pick a button, drag its left handle and let go away from it:
 * the size stops following the mouse when the button is let go; the click after the drag does not pick the page
 * (<html>), so the next drag sizes the button, not the whole UI; the page is never scrolled sideways; a broken rule
 * this browser already holds (html moved / sized) is cleaned when the app loads. Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.540.6 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  // a browser that already holds the broken rule from before 2.540.6
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("t5406")) { sessionStorage.setItem("t5406", "1"); localStorage.setItem("h3.themeStyles", JSON.stringify({ html: { w: 4, dx: -391, bg: "#111111" } })); } } catch (e) { /* fine */ } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const healed = await ev(() => ({ st: H3ThemeEdit.styles(), tr: getComputedStyle(document.documentElement).translate, w: document.documentElement.getBoundingClientRect().width }));
    check("a broken rule already in this browser (html moved -391 px, 4 px wide) is cleaned on load - its colour kept", JSON.stringify(healed.st) === JSON.stringify({ html: { bg: "#111111" } }) && healed.tr === "none" && healed.w > 1000, healed);
    await ev(() => H3ThemeEdit.setStyles({}));
    await p.click("#thEditBtn");
    const bt = await ev(() => { const e = [...document.querySelectorAll("button[id]")].find((x) => x.offsetParent && !x.closest("#thEditPanel") && x.id !== "thEditBtn" && x.getBoundingClientRect().left > 120 && x.getBoundingClientRect().top < 300 && x.getBoundingClientRect().width > 14);
      const r = e.getBoundingClientRect(); return { id: e.id, x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width) }; });
    await p.mouse.click(bt.x, bt.y); await p.waitForTimeout(250);
    check("click a button in edit mode -> it is picked (its own #id)", await ev(() => H3ThemeEdit.scope()) === "#" + bt.id, await ev(() => H3ThemeEdit.scope()));
    const hp = (d) => ev((dir) => { const r = document.querySelector(`#thEditHandles .teh[data-dir=${dir}]`).getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; }, d);
    // the top handle: drag up + sideways (the handle does not follow sideways - the release is away from it)
    let h = await hp("n");
    await p.mouse.move(h.x, h.y); await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(h.x + i * 25, h.y + i);
    await p.mouse.up(); await p.waitForTimeout(150);
    const r1 = await ev((id) => H3ThemeEdit.styles()["#" + id], bt.id);
    for (let i = 1; i <= 10; i++) await p.mouse.move(h.x + 300 - i * 20, h.y + 200 + i * 10);
    await p.waitForTimeout(150);
    const after = await ev(() => H3ThemeEdit.styles());
    check("the top handle sizes it (shorter); let go away from the handle and move the mouse: nothing changes any more", r1 && r1.h > 0 && JSON.stringify(after) === JSON.stringify({ ["#" + bt.id]: r1 }), { r1, after });
    check("…the click after the drag did not pick the page (<html> / <body>)", await ev(() => H3ThemeEdit.scope()) === "#" + bt.id, await ev(() => H3ThemeEdit.scope()));
    // the right handle: wider
    h = await hp("e");
    await p.mouse.move(h.x, h.y); await p.mouse.down();
    for (let i = 1; i <= 8; i++) await p.mouse.move(h.x + i * 5, h.y + i * 6);
    await p.mouse.up(); await p.waitForTimeout(150);
    const r2 = await ev(() => H3ThemeEdit.styles());
    check("…the next drag (the right handle) sizes the same button, wider by the drag (only its rule)", Object.keys(r2).join() === "#" + bt.id && Math.abs(r2["#" + bt.id].w - (bt.w + 40)) <= 2, { r2, bt });
    const pg = await ev(() => ({ sl: document.documentElement.scrollLeft + document.body.scrollLeft, tr: getComputedStyle(document.documentElement).translate + "|" + getComputedStyle(document.body).translate, x: document.body.getBoundingClientRect().left }));
    check("the page itself is not moved, sized or scrolled", pg.sl === 0 && pg.tr === "none|none" && pg.x === 0, pg);
    check("setRule on html / body: colours yes, a size or a move never", JSON.stringify(await ev(() => [H3ThemeEdit.setRule("body", { dx: -300, w: 50 }), H3ThemeEdit.setRule("html", { dx: -5, color: "#eeeeee" })])) === JSON.stringify([null, { color: "#eeeeee" }]));
    await ev(() => { H3ThemeEdit.setStyles({}); H3ThemeEdit.toggle(false, { force: true }); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
