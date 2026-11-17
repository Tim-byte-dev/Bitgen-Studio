#!/usr/bin/env node
/* bitGen Studio — 2.819.0 against the RUNNING app (+ a real browser): the image editor - Ctrl+Shift+A clears every
 * selection, the Lasso's line seen while drawing (Polygonal Lasso / Bézier: the next side follows the pointer), one shape
 * mode for every tool (the property bar's ◻ ⊕ ⊖ ⊗ ⊘ go into it), double-click = the Move tool's handles (no box), a
 * click on the picked shape again = the rotate handles.
 * Tim (verbatim): "when user presses button to combine,add,subtract,intersect shape go into that mode, when using
 * freehand select mask , show the line the user is drawing as they are drawing so they have a visual reference, same
 * with the pen tools. double click on a shape or layer will put it in move transform mode, don't show the bounding box,
 * only show the handles. when user clicks on the same shape again , change the tranform resize/skew handles to rotate
 * handles ... ctrl+shift+A clears all selections"
 * No Playwright = SKIP. H3_SHOTS=<dir> keeps screenshots. */
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

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.shapeMode, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); });
    await p.waitForTimeout(600);
    await ev(() => { const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "pick819.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(500);
    const E = "window.imageEditorInstance.E";
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("draw.automove", false); E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.renderOptions(); });
    await p.waitForTimeout(200);
    // the floating dockers (StoryBoard …) can sit over the picture - out of the way for this test
    await ev(() => document.querySelectorAll(".h3fp.dfm-float").forEach((d) => { d.dataset.t819 = d.style.display; d.style.display = "none"; }));
    const shotDir = process.env.H3_SHOTS || "";
    const shot = async (n) => { if (!shotDir) return; const r = await ev(() => { const r = window.imageEditorInstance.E.stage.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); await p.screenshot({ path: path.join(shotDir, "819-" + n + ".png"), clip: { x: r[0], y: r[1], width: Math.min(900, r[2]), height: Math.min(640, r[3]) } }); };
    const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
    // how much of the overlay is drawn in a small box round (x, y) - canvas pixels
    const ink = (x, y, r) => ev(([x, y, r]) => { const E = window.imageEditorInstance.E, d = E.ov.getContext("2d").getImageData(Math.round(x - r), Math.round(y - r), 2 * r + 1, 2 * r + 1).data; let n = 0, dark = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { n++; if (d[i - 1] + d[i - 2] + d[i - 3] < 200) dark++; } return { n, dark }; }, [x, y, r || 2]);
    const st = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S; return { tool: S.tool, shapeOp: S.shapeOp, drawOp: S.drawOp, penOp: S.penOp, objSel: S.objSel, hasSel: E.hasSel(), multi: E.multi ? E.multi.count() : 0, active: E.layer() ? E.layer().name : null, mode: E.handles ? E.handles.state().mode : null }; });

    /* 1 the Lasso: its line while dragging, black under white, on a WHITE picture */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("lasso"); E.renderOptions(); });
    { const a = await scr(60, 60); await p.mouse.move(a[0], a[1]); await p.mouse.down();
      // a half circle from (60, 60) round to (188, 60) - the line back is the straight one along y = 60
      for (let i = 1; i <= 16; i++) { const t = Math.PI * i / 16, c = await scr(124 - 64 * Math.cos(t), 60 + 64 * Math.sin(t)); await p.mouse.move(c[0], c[1], { steps: 2 }); }
      await p.waitForTimeout(150); await shot("1-lasso");
      const on = await ink(124, 124, 2), back = await ink(124, 60, 2);
      check("Lasso: the line is drawn while dragging, with black in it (seen on a white picture)", on.n > 0 && on.dark > 0, on);
      // 2.830.0 (Tim: "don't close the selection unless the last position is 5px from the start position"): far from the start
      // there is no line back yet, and letting go leaves the line open; ending on the start draws the line back and closes it
      check("…no line back to the start while it ends far from it (2.830.0: it closes only within 5 px of the start)", back.n === 0, back);
      await p.mouse.up(); await p.waitForTimeout(200);
      check("…let go there: no selection yet - the line stays open", !(await st()).hasSel && (await ev(() => !!window.imageEditorInstance.E.S.lassoOpen)));
      const s0 = await scr(60, 60); await p.mouse.move(s0[0] + 1, s0[1] + 1); await p.mouse.down(); await p.mouse.move(s0[0], s0[1], { steps: 2 });
      await p.waitForTimeout(150); const back2 = await ink(124, 60, 2);
      check("…pressed again and ended on the start: the line back to where it started", back2.n > 0, back2);
      await p.mouse.up(); await p.waitForTimeout(200); }
    check("…let go there: a selection", (await st()).hasSel);

    /* 2 Ctrl+Shift+A: every selection cleared */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.renderOptions(); });
    await drag(200, 40, 280, 100);
    await ev(() => { const E = window.imageEditorInstance.E; E.selectAll(); E.S.picks = [E.layer().id]; });
    let s0 = await st();
    await p.keyboard.press("Control+Shift+A"); await p.waitForTimeout(250);
    let s1 = await st();
    const dock = await ev(() => { const t = document.querySelector('.kx .pctabs [data-tab="dkAlign"]'); return !!t && t.classList.contains("on"); });
    check("Ctrl+Shift+A: the selected area, the picked shape and the picks in Layers all cleared (Align and Distribute does not open)", s0.hasSel && s0.objSel !== false && !s1.hasSel && s1.objSel === false && !dock && (await ev(() => (window.imageEditorInstance.E.S.picks || []).length)) === 0, { s0, s1, dock });
    check("…it is on the Select menu as Clear All Selections", await ev(() => !!window.imageEditorInstance.E.ui && typeof window.imageEditorInstance.E.ui.run === "function" && window.imageEditorInstance.E.pickModes && typeof window.imageEditorInstance.E.pickModes.clearAll === "function"));

    /* 3 the Polygonal Lasso: the next side follows the pointer */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("poly"); E.renderOptions(); });
    for (const [x, y] of [[40, 160], [120, 160]]) { const a = await scr(x, y); await p.mouse.click(a[0], a[1]); await p.waitForTimeout(80); }
    { const a = await scr(120, 240); await p.mouse.move(a[0], a[1], { steps: 4 }); await p.waitForTimeout(200); }
    await shot("3-poly");
    check("Polygonal Lasso: the side from the last point on to the pointer is drawn before the click", (await ink(120, 200, 2)).n > 0);
    await p.keyboard.press("Escape"); await ev(() => { const E = window.imageEditorInstance.E; E.S.pts = []; E.deselect(); E.drawOverlay(); });

    /* 4 the Bézier tool: its next segment follows the pointer (the Pen's did already) */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("bezier"); E.renderOptions(); });
    for (const [x, y] of [[40, 260], [140, 260]]) { const a = await scr(x, y); await p.mouse.click(a[0], a[1]); await p.waitForTimeout(100); }
    { const a = await scr(140, 200); await p.mouse.move(a[0], a[1], { steps: 4 }); await p.waitForTimeout(200); }
    await shot("4-bezier");
    check("Bézier tool: the next segment drawn to the pointer before the click", (await ink(140, 230, 2)).n > 0);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);

    /* 5 the modes: a shape picked with the Move tool shows ◻ ⊕ ⊖ ⊗ ⊘ on the property bar; ⊕ goes into Add */
    await ev(() => { const E = window.imageEditorInstance.E; const L = E.S.layers.find((x) => x.type === "shape"); E.setActive(E.S.layers.indexOf(L)); E.setTool("move"); E.S.objSel = true; E.renderOptions(); E.propbar.render(); });
    await p.waitForTimeout(300);
    const pm = await ev(() => [...document.querySelectorAll(".kx [data-pmmode]")].map((b) => b.dataset.pmmode));
    check("a shape picked (the Move tool): the property bar has ◻ ⊕ ⊖ ⊗ ⊘", pm.join() === "new,add,subtract,intersect,exclude", pm);
    await p.$eval('.kx [data-pmmode="add"]', (e) => e.click()); await p.waitForTimeout(250);
    s1 = await st();
    check("⊕ pressed: INTO Add mode - the Shape tool on, every shape tool's mode Add", s1.tool === "shape" && s1.shapeOp === "add" && s1.drawOp === "add" && s1.penOp === "add", s1);
    { const a = await scr(260, 160); await p.mouse.move(a[0], a[1], { steps: 3 }); await p.waitForTimeout(200); }
    await shot("5-badge");
    check("…its sign ⊕ rides beside the pointer", (await ink(260 + 16 / (await ev(() => window.imageEditorInstance.E.S.zoom)), 160 + 14 / (await ev(() => window.imageEditorInstance.E.S.zoom)), 6)).n > 0);
    await drag(250, 70, 320, 130);
    const subs = await ev(() => { const L = window.imageEditorInstance.E.S.layers.filter((x) => x.type === "shape"); return L.map((x) => x.shape.path ? x.shape.path.subs.length : 1); });
    check("…a shape drawn: added to the picked one (one shape layer; since 2.821.0 overlapping parts are joined into one real outline)", subs.length === 1 && subs[0] >= 1, subs);
    // the curve tools' own buttons set the same mode
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("crect"); E.renderOptions(); });
    await p.$eval('#kxOpts [data-dop="subtract"]', (e) => e.click()); await p.waitForTimeout(200);
    s1 = await st();
    check("the rectangle tool's ⊖: the Shape tool's mode follows (one mode)", s1.drawOp === "subtract" && s1.shapeOp === "subtract", s1);
    await ev(() => window.imageEditorInstance.E.shapeModes.go("new", true)); await p.waitForTimeout(100);

    /* 6 double-click = the Move tool's handles - no box; a click again = rotate */
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("sel.clearall"); E.setTool("none"); });
    const L0 = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "shape"), b = E.dockers.boxOf(L); return { b: [b.x, b.y, b.w, b.h] }; });
    const [bx, by, bw, bh] = L0.b, mid = await scr(bx + bw * 0.3, by + bh / 2);
    await p.mouse.dblclick(mid[0], mid[1]); await p.waitForTimeout(250);
    s1 = await st();
    check("double-click on a shape (no tool): the Move tool, the shape picked, the scale handles", s1.tool === "move" && s1.objSel === true && s1.mode === "scale", s1);
    await shot("6-handles");
    const hb = await ev(() => { const b = window.imageEditorInstance.E.handles.box(); return [b.x, b.y, b.w, b.h]; });
    const edge = await ink(hb[0] + hb[2] * 0.25, hb[1], 1), corner = await ink(hb[0], hb[1], 2);
    check("…the handles alone: no box drawn along its sides (a corner handle is there)", edge.n === 0 && corner.n > 0, { edge, corner });
    await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(250);
    check("a click on the same shape again: the ROTATE handles", (await st()).mode === "rotate");
    await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(250);
    check("…again: the scale handles", (await st()).mode === "scale");
    // a double-click on a layer's row in Layers
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("sel.clearall"); E.setTool("lasso"); E.setActive(0); });
    await p.waitForTimeout(200);
    await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((x) => x.type === "shape"); const r = document.querySelector(`.kx .kxlayer[data-i="${i}"]`); r.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    await p.waitForTimeout(250);
    s1 = await st();
    check("a double-click on the shape's row in Layers: the Move tool, it picked, the scale handles", s1.tool === "move" && s1.objSel === true && s1.mode === "scale" && /^Rectangle/.test(s1.active || ""), s1);
    await ev(() => document.querySelectorAll(".h3fp.dfm-float").forEach((d) => { if (d.dataset.t819 != null) { d.style.display = d.dataset.t819; delete d.dataset.t819; } }));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
