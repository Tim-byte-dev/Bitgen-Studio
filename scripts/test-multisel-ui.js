#!/usr/bin/env node
/* bitGen Studio — 2.474.0 in a REAL browser: NO TOOL, THE SELECTION BOX, SEVERAL LAYERS PICKED (pcmultisel.js,
 * pcselhl.js, the Layers panel in pcui.js, the core's Move tool + Del).
 * Tim (verbatim): "esc deselects all tools. when no tool selected click and drag shows a dashed bounding box that selects
 * everything in the bounding box. shift + select layer in layer docker selects every layer between the 2 shift+click
 * layers, ctrl+click adds or removes layers from the selection. del deletes all selected layers."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the selection-box browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.multi && window.imageEditorInstance.E.tools.none, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    const pk = () => ev(() => { const E = window.imageEditorInstance.E; return { tool: E.S.tool, picks: E.multi.list().map((L) => L.name).sort(), active: E.layer() && E.layer().name, objSel: E.S.objSel, n: E.S.layers.length, undo: E.S.undo.length }; });
    // three rectangles: A, B, C
    for (const [nm, x0, y0, x1, y1] of [["A", 50, 50, 150, 130], ["B", 200, 60, 300, 140], ["C", 400, 250, 520, 350]]) {
      await ev(() => window.imageEditorInstance.E.setTool("crect")); await drag(x0, y0, x1, y1); await p.waitForTimeout(200);
      await ev((nm) => { const E = window.imageEditorInstance.E; E.layer().name = nm; E.renderLayersPanel(); }, nm);
    }
    await key("Escape");
    let s = await pk();
    const opts = await ev(() => document.getElementById("kxOpts").innerText);
    check("Esc = no tool (and nothing picked) - the options bar says what dragging does", s.tool === "none" && s.picks.length === 0 && s.objSel === false && /No tool/.test(opts) && /drag a box/.test(opts), { s, opts: opts.slice(0, 80) });
    // left to right: wholly inside
    const [a0, a1] = await T(30, 30), [b0, b1] = await T(320, 160);
    await p.mouse.move(a0, a1); await p.mouse.down(); await p.mouse.move(b0, b1, { steps: 6 });
    const mid = await ev(() => { const E = window.imageEditorInstance.E, b = E.multi.box(); E.drawOverlay(); return b; });
    await p.mouse.up(); await p.waitForTimeout(150);
    s = await pk();
    check("a drag with no tool shows the dashed box; left to right picks what is WHOLLY inside (A, B - not C)", mid && Math.round(mid.w) === 290 && s.picks.join() === "A,B" && s.tool === "none", { mid, s });
    // right to left: touching
    await drag(560, 380, 280, 100); await p.waitForTimeout(150);
    s = await pk();
    check("right to left picks what the box TOUCHES (B, C)", s.picks.join() === "B,C", s);
    await click(560, 30); s = await pk();
    check("a click on nothing: nothing picked", s.picks.length === 0 && s.objSel === false, s);
    await click(100, 90); await click(460, 300, ["Shift"]); s = await pk();
    check("no tool: a click picks A, Shift-click adds C", s.picks.join() === "A,C" && s.active === "C", s);
    // the Layers panel
    const row = async (nm, mods) => { const i = await ev((nm) => { const E = window.imageEditorInstance.E; return E.S.layers.findIndex((L) => L.name === nm); }, nm); for (const m of mods || []) await p.keyboard.down(m); await p.click(`#kxLayers .kxlayer[data-i="${i}"] .nm`); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(120); };
    await row("A"); await row("C", ["Shift"]); s = await pk();
    const rowsOn = await ev(() => document.querySelectorAll("#kxLayers .kxlayer.pick").length);
    check("Layers panel: click A, Shift-click C = A, B and C (every layer between), the rows lit", s.picks.join() === "A,B,C" && rowsOn >= 2, { s, rowsOn });
    await row("B", ["Control"]); s = await pk();
    check("Ctrl-click B takes it away (A, C left)", s.picks.join() === "A,C", s);
    await row("B", ["Control"]); await row("B", ["Control"]); s = await pk();
    check("Ctrl-click adds it back, again takes it away", s.picks.join() === "A,C", s);
    // the Move tool moves them together, one undo step
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    const boxes = () => ev(() => { const E = window.imageEditorInstance.E; const o = {}; for (const L of E.S.layers) if (/^[ABC]$/.test(L.name)) { const b = E.dockers.boxOf(L); o[L.name] = [Math.round(b.x), Math.round(b.y)]; } return o; });
    const b0x = await boxes(), u0 = (await pk()).undo;
    await drag(100, 90, 120, 100); await p.waitForTimeout(200);
    const b1x = await boxes(), u1 = (await pk()).undo;
    check("the Move tool: a drag on A moves A and C together (+20, +10), B stays; one undo step", b1x.A[0] - b0x.A[0] === 20 && b1x.C[1] - b0x.C[1] === 10 && b1x.B[0] === b0x.B[0] && u1 === u0 + 1, { b0x, b1x, u0, u1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    const b2x = await boxes();
    check("...Undo puts both back", b2x.A[0] === b0x.A[0] && b2x.C[0] === b0x.C[0], b2x);
    // Del deletes every picked layer
    s = await pk(); const n0 = s.n;
    await key("Delete"); s = await pk();
    const names = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    check("Del deletes every picked layer (A and C) in one step; B stays", s.n === n0 - 2 && names.includes("B") && !names.includes("A") && !names.includes("C"), { n0, s, names });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    check("...Undo brings both back", (await pk()).n === n0);
    // Esc twice: no tool, then what Esc did before (leaves full screen)
    await key("Escape"); const full1 = await ev(() => document.body.classList.contains("ie-full"));
    await key("Escape"); const full2 = await ev(() => document.body.classList.contains("ie-full"));
    check("Esc again (no tool, nothing picked) does what it did before: leaves full screen", (await pk()).tool === "none" && full1 !== full2, { full1, full2 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
