#!/usr/bin/env node
/* bitGen Studio — 2.454.0 in a REAL browser: THE IMAGE EDITOR'S PANEL COLUMN AS A DOCKER with DROP ZONES, every tab
 * group floating (pcpanels.js + static/floatpanels.js). Tim: "make the panel in the image editor a resizable docker
 * with dropzones for the other dockers. make all the tab groups into floating dockers that can dock in another docker
 * like the panel docker". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the panel docker browser test did not run"); process.exit(0); }
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
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.panels && window.H3Panels, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { if (!document.body.classList.contains("ie-full")) document.getElementById("kxFull").click(); }); await p.waitForTimeout(800);
  };
  let keep = null;
  try {
    await open();
    keep = await ev(() => ({ order: window.imageEditorInstance.E.store.get("pc.order", null), w: window.imageEditorInstance.E.store.get("pc.sideW", 0) }));
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("pc.order", null); E.store.set("pc.sideW", 0); E.ui.run("win.panelshome"); });
    await p.waitForTimeout(300);
    /* 1 every group floats */
    const fl = await ev(() => ["color", "dock", "props", "layers"].map((g) => !!document.querySelector(`#pcPanels .pcgrp[data-g="${g}"] .pcfloat`)));
    const o0 = await ev(() => window.imageEditorInstance.E.panels.order());
    check("⇱ on EVERY tab group: Colour, the Corel dockers, Properties (Properties / Adjustments / ✨ AI / ◈ Control), Layers", fl.every(Boolean), { fl, o0 });
    await p.click('.pcgrp[data-g="props"] .pcfloat'); await p.waitForTimeout(400);
    const s1 = await ev(() => ({ st: window.H3Panels.get("ie.props").state, inCol: !!document.querySelector('#pcPanels > .pcgrp[data-g="props"]') }));
    check("the Properties group floats (a window of its own, out of the column)", s1.st === "float" && !s1.inCol, s1);

    /* 2 dragged by its title over the column: an orange line where it goes; dropped above Colour = docked there */
    const tb = await (await p.$('.h3fp[data-fp="ie.props"] .h3fp-t')).boundingBox();
    const cr = await ev(() => { const r = document.querySelector('#pcPanels > .pcgrp[data-g="color"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 }; });
    await p.mouse.move(tb.x + 40, tb.y + 10); await p.mouse.down(); await p.mouse.move(cr.x, cr.y, { steps: 10 }); await p.waitForTimeout(150);
    const mk = await ev(() => { const m = document.getElementById("h3fpZone"); return m && m.style.display !== "none" ? Math.round(m.getBoundingClientRect().width) : 0; });
    await shot("2-zone");
    await p.mouse.up(); await p.waitForTimeout(400);
    const o2 = await ev(() => ({ order: window.imageEditorInstance.E.panels.order(), st: window.H3Panels.get("ie.props").state, kept: window.imageEditorInstance.E.store.get("pc.order", null) }));
    check("dragged over the top of the Colour group: an orange drop line across the column; dropped = docked in the column ABOVE Colour (kept)",
      mk > 150 && o2.st === "home" && o2.order[0] === "props" && o2.order.indexOf("props") < o2.order.indexOf("color") && JSON.stringify(o2.kept) === JSON.stringify(o2.order), { mk, o2 });

    /* 3 the Layers group floated and dropped at the END of the column */
    await p.click('.pcgrp[data-g="layers"] .pcfloat'); await p.waitForTimeout(400);
    const tb3 = await (await p.$('.h3fp[data-fp="ie.layers"] .h3fp-t')).boundingBox();
    const end = await ev(() => { const c = document.getElementById("pcPanels").getBoundingClientRect(); const gs = [...document.querySelectorAll("#pcPanels > .pcgrp:not(.off)")]; const last = gs[gs.length - 1].getBoundingClientRect(); return { x: c.left + c.width / 2, y: Math.min(c.bottom - 8, last.bottom - 10) }; });
    await p.mouse.move(tb3.x + 40, tb3.y + 10); await p.mouse.down(); await p.mouse.move(end.x, end.y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400);
    const o3 = await ev(() => window.imageEditorInstance.E.panels.order().filter((g) => g !== "dock"));
    check("the Layers group floated, then dropped at the bottom of the column: docked last", o3[o3.length - 1] === "layers", o3);

    /* 4 the column's left edge drags its width */
    const w0 = await ev(() => document.getElementById("pcPanels").getBoundingClientRect().width);
    const g = await (await p.$("#pcSideGrip")).boundingBox();
    await p.mouse.move(g.x + 2, g.y + 200); await p.mouse.down(); await p.mouse.move(g.x - 98, g.y + 200, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const w1 = await ev(() => ({ w: document.getElementById("pcPanels").getBoundingClientRect().width, kept: window.imageEditorInstance.E.store.get("pc.sideW", 0) }));
    check("the column's left edge dragged 100 px left: the panel column 100 px wider (kept)", Math.abs(w1.w - w0 - 100) <= 3 && Math.abs(w1.kept - w1.w) <= 1, { w0, w1 });

    /* 5 a reload: the order and the width are back */
    const before = await ev(() => window.imageEditorInstance.E.panels.order());
    await open();
    const after = await ev(() => ({ order: window.imageEditorInstance.E.panels.order(), w: document.getElementById("pcPanels").getBoundingClientRect().width }));
    check("after a reload: the groups in the order they were left, the column as wide", JSON.stringify(after.order) === JSON.stringify(before) && Math.abs(after.w - w1.w) <= 2, { before, after });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev((k) => { const E = window.imageEditorInstance.E; E.store.set("pc.order", k ? k.order : null); E.store.set("pc.sideW", k ? k.w : 0); E.ui.run("win.panelshome"); }, keep); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
