#!/usr/bin/env node
/* bitGen Studio — 2.810.0 against the RUNNING app (+ a real browser): the image editor's Shape tool - the shape buttons
 * pick the mode (click new, Shift+click replace, Ctrl+click add, Alt+click subtract), its right-click items (Shape tool
 * only), ✂ Trim, ⇋ Mirror, ⧈ Offset.
 * Tim (verbatim): "in image editor, click on shape will draw new shapes, shift+click on shape will change shape to new
 * shape clicked, ctrl+ click will add shape to existing shape (boolean) , alt + click will subtract new selected shape
 * from shape on selected layer ... add the shape options to the right click context menu when shape tool is selected
 * only. add a trim button so shapes can be trimmed like in fusion 360. Add mirror and offset buttons for selected shapes"
 * No Playwright = SKIP. */
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
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "shape810.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(500);
    const E = "window.imageEditorInstance.E";
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("draw.automove", false); E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.renderOptions(); });
    await p.waitForTimeout(200);
    // canvas point -> screen
    const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const shapes = () => ev(() => window.imageEditorInstance.E.S.layers.filter((L) => L.type === "shape").map((L) => ({ id: L.id, name: L.name, kind: L.shape.kind, subs: L.shape.path ? L.shape.path.subs.map((s) => [s.op, s.closed, !!s.nofill]) : null, box: [Math.round(L.shape.x), Math.round(L.shape.y), Math.round(L.shape.w), Math.round(L.shape.h)], fill: L.shape.fill })));
    const active = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L ? { id: L.id, type: L.type } : null; });
    const sk = (k, mods) => p.click(`#kxOpts [data-sk="${k}"]`, { modifiers: mods || [] }).then(() => p.waitForTimeout(250));

    await drag(40, 40, 140, 120);
    let sh = await shapes();
    check("a drag with the Shape tool draws a rectangle shape layer (New)", sh.length === 1 && sh[0].kind === "rect", sh);
    const id1 = sh[0].id;
    await sk("ellipse", ["Shift"]);
    sh = await shapes();
    check("Shift+click ◯: the picked rectangle becomes an ellipse now, mode Replace", sh.length === 1 && sh[0].kind === "ellipse" && await ev(() => window.imageEditorInstance.E.S.shapeOp) === "replace", sh);
    await sk("rect");
    sh = await shapes();
    check("a plain click on ▭: mode New, the picked shape left as it is", sh[0].kind === "ellipse" && await ev(() => window.imageEditorInstance.E.S.shapeOp) === "new", sh);
    await sk("ellipse", ["Control"]);
    check("Ctrl+click: mode Add", await ev(() => window.imageEditorInstance.E.S.shapeOp) === "add");
    await drag(110, 60, 190, 140);
    sh = await shapes();
    check("drawn in Add mode: joined into the picked shape (one layer, 2 components)", sh.length === 1 && sh[0].kind === "path" && sh[0].subs.length === 2 && sh[0].subs[1][0] === "add", sh);
    await sk("rect", ["Alt"]);
    check("Alt+click: mode Subtract", await ev(() => window.imageEditorInstance.E.S.shapeOp) === "subtract");
    await drag(60, 80, 90, 100);
    sh = await shapes();
    check("drawn in Subtract mode: a subtract component in the same shape", sh.length === 1 && sh[0].subs.length === 3 && sh[0].subs[2][0] === "subtract", sh);
    const opsBar = await ev(() => [...document.querySelectorAll("#kxOpts [data-pnshop]")].map((b) => b.dataset.pnshop + (b.classList.contains("on") ? "*" : "")));
    check("the Ops buttons show the mode, ⇄ Replace beside ▣ New", opsBar.includes("subtract*") && opsBar.indexOf("replace") === opsBar.indexOf("new") + 1, opsBar);
    // Replace: the next shape takes the picked layer's place (its look kept)
    await ev(() => { const E = window.imageEditorInstance.E; E.setLayer(E.layer(), "fill", (L) => { L.shape.fill = "#ff0000"; }); });
    await sk("triangle", ["Shift"]);
    await drag(220, 150, 300, 260);
    sh = await shapes();
    check("drawn in Replace mode: the same layer, now the new shape where it was drawn, its fill kept", sh.length === 1 && sh[0].id === id1 && sh[0].kind === "triangle" && sh[0].box.join() === "220,150,80,110" && sh[0].fill === "#ff0000", sh);
    // the right-click menu
    const menu = async () => {
      const r = await scr(380, 20); await p.mouse.click(r[0], r[1], { button: "right" }); await p.waitForTimeout(300);
      const items = await ev(() => { const m = [...document.querySelectorAll(".kxmenu")].pop(); return m ? [...m.children].map((d) => d.dataset.cmd || (d.className === "sub" ? "▸" + d.textContent : d.tagName)) : []; });
      await p.keyboard.press("Escape"); await ev(() => window.imageEditorInstance.E.ui.closeMenus()); return items;
    };
    const m1 = await menu();
    check("right-click with the Shape tool: the modes first, then Shape ▸, ✂ Trim, Mirror ▸, Offset…", m1.slice(0, 5).join() === "shape.mode.new,shape.mode.replace,shape.mode.add,shape.mode.subtract,shape.mode.intersect" && m1.includes("▸Shape") && m1.includes("shape.trim") && m1.includes("▸⇋ Mirror") && m1.includes("shape.offset"), m1);
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    const m2 = await menu();
    check("…and none of them with another tool (the Move tool)", !m2.some((c) => /^shape\.(mode|kind|trim|flip|mir|offset)|Mirror|▸Shape/.test(c)), m2);
    await ev(() => window.imageEditorInstance.E.setTool("shape"));
    // ✂ Trim: two overlapping circles in one shape - trim both inside arcs = one closed outline
    await ev(() => { const E = window.imageEditorInstance.E, P = window.PCPath; E.structOp("t", () => { E.S.layers = E.S.layers.filter((L) => L.type !== "shape"); }); const L = E.makeLayer("Circles", E.S.w, E.S.h, "shape"); L.shape = Object.assign({}, E.D.SHAPE_DEFAULT, { kind: "path", fill: "#22aa44", path: { subs: [P.ellipseSub(150, 150, 60, 60), P.ellipseSub(230, 150, 60, 60)] } }); P.syncShape(L.shape); E.D.rasterize(L); E.addLayer(L, "circles", false); });
    await p.click("#kxOpts #psoTrim"); await p.waitForTimeout(200);
    check("✂ Trim on the bar: the Trim tool", await ev(() => window.imageEditorInstance.E.S.tool) === "shapetrim");
    let a = await scr(210, 150); await p.mouse.move(a[0], a[1]); await p.waitForTimeout(200);
    const plan = await ev(() => { const h = window.imageEditorInstance.E.shapeOps.planAt(210, 150); return h ? { cuts: h.plan.cuts.length, whole: h.plan.whole } : null; });
    check("hovering an arc: the piece between the two crossings is the one shown (2 cuts)", plan && plan.cuts === 2 && !plan.whole, plan);
    await p.mouse.click(a[0], a[1]); await p.waitForTimeout(200);
    a = await scr(170, 150); await p.mouse.click(a[0], a[1]); await p.waitForTimeout(250);
    sh = await shapes();
    check("both inside arcs trimmed: one CLOSED outline round the two circles (filled)", sh.length === 1 && sh[0].subs.length === 1 && sh[0].subs[0][1] === true && !sh[0].subs[0][2] && sh[0].box[2] >= 198 && sh[0].box[2] <= 202, sh);
    const u0 = await ev(() => window.imageEditorInstance.E.S.undo.length);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    sh = await shapes();
    check("Ctrl+Z puts the last trimmed arc back (one step per trim)", sh[0].subs.length === 2, sh);
    await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(150);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    check("Esc: back to the Shape tool", await ev(() => window.imageEditorInstance.E.S.tool) === "shape");
    // ⇋ Mirror
    await ev(() => { const E = window.imageEditorInstance.E, P = window.PCPath; const L = E.makeLayer("Tri", E.S.w, E.S.h, "shape"); L.shape = Object.assign({}, E.D.SHAPE_DEFAULT, { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [P.anchor(20, 200), P.anchor(80, 200), P.anchor(20, 280)] }] } }); P.syncShape(L.shape); E.D.rasterize(L); E.addLayer(L, "tri", false); });
    await p.click("#kxOpts #psoMirror"); await p.waitForTimeout(200);
    const mi = await ev(() => [...[...document.querySelectorAll(".kxmenu")].pop().querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd));
    check("⇋ Mirror ▾: Flip Horizontal / Vertical, Mirror Copy Right / Left / Down / Up", mi.join() === "shape.flipH,shape.flipV,shape.mirRight,shape.mirLeft,shape.mirDown,shape.mirUp", mi);
    await ev(() => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="shape.mirRight"]').click()); await p.waitForTimeout(250);
    let tri = (await shapes()).find((s) => s.name === "Tri");
    check("Mirror Copy → Right: the mirrored copy joined in - the shape twice as wide", tri.box.join() === "20,200,120,80" && tri.subs.length === 2, tri);
    const pts = await ev(() => { const L = window.imageEditorInstance.E.layer(); return L.shape.path.subs.map((s) => window.PCPath.signedArea(s.pts.map((a) => [a.x, a.y])) > 0); });
    check("…its copy wound the same way (no hole where they meet)", pts[0] === pts[1], pts);
    await ev(() => window.imageEditorInstance.E.ui.run("shape.flipV")); await p.waitForTimeout(200);
    const flipped = await ev(() => { const L = window.imageEditorInstance.E.layer(); return L.shape.path.subs[0].pts.map((a) => [Math.round(a.x), Math.round(a.y)]); });
    check("⇵ Flip Vertical: flipped in its own box", JSON.stringify(flipped) === JSON.stringify([[20, 280], [20, 200], [80, 280]]) || flipped.some((q) => q[0] === 80 && q[1] === 280), flipped);
    // ⧈ Offset
    await ev(() => { const E = window.imageEditorInstance.E; E.structOp("t", () => { E.S.layers = E.S.layers.filter((L) => L.name !== "Tri" && L.name !== "Circles"); }); });
    await ev(() => window.imageEditorInstance.E.setTool("shape"));
    await sk("rect"); await drag(100, 100, 200, 160);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("shape"); });
    await p.click("#kxOpts #psoOff"); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #psoDD", "10"); await ev(() => { document.querySelector(".kxdlg.pcd #psoDK").checked = true; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    sh = await shapes();
    const off = sh.find((s) => /^Offset of/.test(s.name));
    check("⧈ on the bar: Offset +10 (Keep): a new layer above, the outline 10 px bigger all round", off && Math.abs(off.box[0] - 90) <= 1 && Math.abs(off.box[2] - 120) <= 2 && Math.abs(off.box[3] - 80) <= 2, sh);
    await ev(() => { const E = window.imageEditorInstance.E; const L = E.S.layers.find((x) => x.type === "shape" && !/^Offset/.test(x.name)); E.setActive(E.S.layers.indexOf(L)); E.renderOptions(); });
    await ev(() => window.imageEditorInstance.E.ui.run("shape.offset")); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #psoDD", "-20"); await ev(() => { document.querySelector(".kxdlg.pcd #psoDK").checked = false; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    sh = await shapes();
    const own = sh.find((s) => !/^Offset/.test(s.name));
    check("Offset… from the menu, −20, Keep off: the shape itself shrinks 20 px all round", own && Math.abs(own.box[0] - 120) <= 1 && Math.abs(own.box[2] - 60) <= 2 && Math.abs(own.box[3] - 20) <= 2, own);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
