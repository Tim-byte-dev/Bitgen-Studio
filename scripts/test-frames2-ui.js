#!/usr/bin/env node
/* bitGen Studio — 2.453.0 in a REAL browser: FRAMES LIKE CORELDRAW'S POWERCLIP (pcframes.js + pchandles.js). Tim: "lock
 * contents to the frame when put in frame like in coreldraw, make frame behave like coreldraw frame, right click context
 * menu to enter frame and edit contents of the frame. right click context menu to finish editing frame. move scale and
 * rotate frames contents with selected frame". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the frames 2 browser test did not run"); process.exit(0); }
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
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.frames && window.imageEditorInstance.E.handles, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      if (E.guides && E.guides.settings) Object.assign(E.guides.settings, { snap: false });
      E.docs.setTabs(true); E.openDoc(600, 400, "frames2.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 400); });
      const P = E.makeLayer("Pic", 600, 400), g = P.canvas.getContext("2d"); g.fillStyle = "#e00000"; g.fillRect(150, 100, 200, 150); E.addLayer(P, "t", false);
      const F = E.makeLayer("Frame", 600, 400, "shape"); F.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 200, y: 125, w: 100, h: 100, fill: "#ffee00" }); D.rasterize(F); E.addLayer(F, "t", false);
      E.frames.place([P], F, false); E.setTool("move");
    });
    await p.waitForTimeout(300);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods) => { const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(300); };
    const boxes = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S, F = S.layers.find((L) => L.name === "Frame"), P = S.layers.find((L) => L.name === "Pic");
      const bb = (L) => { const b = E.dockers.boxOf(L); return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)] : null; };
      return { F: bb(F), P: bb(P), active: E.layer().name, inside: P.parent === F.id }; });
    const b0 = await boxes();

    /* 1 the contents are LOCKED: with the picture the active layer, a Move-tool drag moves the FRAME (and the picture with it) */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === "Pic")); });
    await drag(250, 175, 280, 195);
    const b1 = await boxes();
    check("locked: the picture inside the frame is the active layer, but the Move tool takes the FRAME - both moved 30, 20 (one undo step)",
      b0.inside && b1.active === "Frame" && b1.F[0] === b0.F[0] + 30 && b1.F[1] === b0.F[1] + 20 && b1.P[0] === b0.P[0] + 30 && b1.P[1] === b0.P[1] + 20, { b0, b1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 2 the frame's scale handle: the contents scale with it */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === "Frame")); E.handles.setMode("scale"); });
    await p.waitForTimeout(150);
    await drag(300, 225, 350, 275);
    const b2 = await boxes();
    await shot("2-scaled");
    check("dragging the frame's corner handle (x1.5 from its top-left): the picture inside scales with it (200x150 -> 300x225, about the same corner)",
      b2.F && Math.abs(b2.F[2] - 150) <= 2 && b2.P && Math.abs(b2.P[2] - 300) <= 3 && Math.abs(b2.P[3] - 225) <= 3 && Math.abs(b2.P[0] - (200 + (150 - 200) * 1.5)) <= 3, { b0, b2 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const bu = await boxes();
    check("...one undo puts both back", JSON.stringify(bu.F) === JSON.stringify(b0.F) && JSON.stringify(bu.P) === JSON.stringify(b0.P), { bu, b0 });

    /* 3 rotate: ⟳90 on the frame turns the contents too */
    await ev(() => window.imageEditorInstance.E.handles.byOptions("rotate", 90)); await p.waitForTimeout(300);
    const b3 = await boxes();
    check("⟳90 on the frame: the picture turns with it (200 x 150 -> 150 x 200)", b3.P && Math.abs(b3.P[2] - 150) <= 3 && Math.abs(b3.P[3] - 200) <= 3, b3);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 4 right-click: Edit Frame Contents; then the picture moves alone; right-click: Finish Editing Frame (first) */
    const [cx, cy] = await T(250, 175);
    await p.mouse.click(cx, cy, { button: "right" }); await p.waitForTimeout(250);
    const m1 = await ev(() => [...document.querySelectorAll(".kxmenu > div")].map((d) => d.dataset.cmd || d.textContent).filter(Boolean));
    await shot("4-menu");
    await ev(() => document.querySelector('.kxmenu [data-cmd="frame.edit"]').click()); await p.waitForTimeout(300);
    const ed = await ev(() => window.imageEditorInstance.E.frames.editing() != null && window.imageEditorInstance.E.layer().name);
    check("right-click on the frame: a menu with Edit Frame Contents, Extract Contents, Lock Contents to Frame (+ Duplicate / Delete); Edit = the contents active", m1[0] === "frame.edit" && m1.includes("frame.extract") && m1.includes("frame.lock") && m1.includes("layer.del") && ed === "Pic", { m1, ed });
    await drag(250, 175, 270, 175);
    const b4 = await boxes();
    check("...editing: the picture moves ALONE (the frame stays)", b4.P[0] === b0.P[0] + 20 && JSON.stringify(b4.F) === JSON.stringify(b0.F), { b4, b0 });
    await p.mouse.click(cx, cy, { button: "right" }); await p.waitForTimeout(250);
    const m2 = await ev(() => [...document.querySelectorAll(".kxmenu > div")].map((d) => d.dataset.cmd).filter(Boolean));
    await ev(() => document.querySelector('.kxmenu [data-cmd="frame.finish"]').click()); await p.waitForTimeout(300);
    const fin = await ev(() => ({ ed: window.imageEditorInstance.E.frames.editing(), act: window.imageEditorInstance.E.layer().name }));
    check("right-click while editing: Finish Editing Frame first; it goes back to normal mode (the frame active)", m2[0] === "frame.finish" && fin.ed == null && fin.act === "Frame", { m2, fin });

    /* 5 double-click on the frame = the rotate handles (not editing) */
    await p.mouse.dblclick(cx, cy); await p.waitForTimeout(250);
    const d5 = await ev(() => ({ mode: window.imageEditorInstance.E.handles.state().mode, ed: window.imageEditorInstance.E.frames.editing() }));
    check("a double-click on the frame = the rotate handles (editing is on the right-click menu now)", d5.mode === "rotate" && d5.ed == null, d5);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
