#!/usr/bin/env node
/* bitGen Studio — 2.466.0 in a REAL browser: OPENTYPE TYPE (pcotype.js + pctype.js - a stylistic set and optical
 * kerning from the Character panel, the font file read and its glyphs drawn), Type: Convert to Shape / Create Work Path,
 * ROUND CORNERS on a joined (merged) shape (pcpath.js roundCorners, Direct Selection's ⌜ Radius), TEXT IN A SHAPE.
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the OpenType / round corners browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.type && window.imageEditorInstance.E.pen, null, { timeout: 60000 });
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
    const alphaOf = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active], D = L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data, o = []; for (let i = 3; i < D.length; i += 4) o.push(D[i] > 100 ? 1 : 0); return o.join(""); });
    const diff = (a, b) => { let d = 0, u = 0, n = 0; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) d++; if (a[i] === "1" || b[i] === "1") u++; if (a[i] === "1" && b[i] === "1") n++; } return { d, iou: u ? n / u : 1 }; };

    /* 1 a text in Poppins (a file this computer has): OpenType from the Character panel */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = E.D; const L = E.makeLayer("Tova", S.w, S.h, "text"); L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "Tova ag 1/2", font: "Poppins", x: 40, y: 60, size: 60, color: "#203040" }); D.rasterize(L); E.addLayer(L, "text", false); E.ui.showTab("pcChar"); });
    await p.waitForTimeout(300);
    const a0 = await alphaOf();
    const panel = await ev(() => ({ n: document.querySelectorAll("#pcChar [data-ot]").length, ss: !!document.getElementById("pcySS"), opt: !!document.querySelector('#pcyKern option[value="optical"]') }));
    check("Character panel: the OpenType buttons (15), a stylistic set list, Kerning Metrics / Optical / 0", panel.n === 15 && panel.ss && panel.opt, panel);
    await p.selectOption("#pcySS", "ss01");
    let state = ""; for (let i = 0; i < 40 && state !== "ready"; i++) { await p.waitForTimeout(250); state = await ev(() => window.PCOType.stateOf(window.imageEditorInstance.E.layer().text)); }
    await p.waitForTimeout(300);
    const a1 = await alphaOf(), d1 = diff(a0, a1), note = await ev(() => document.querySelector("#pcChar .pcty").innerText);
    check("Stylistic set ss01: the font file is read (Poppins-…ttf named in the panel) and the text drawn with its glyphs - it looks different", state === "ready" && /Poppins.*\.ttf/i.test(note) && d1.d > 30 && d1.iou > 0.5, { state, d: d1, note: note.slice(0, 200) });
    const w0 = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).box.w);
    await p.selectOption("#pcyKern", "optical"); await p.waitForTimeout(400);
    const w1 = await ev(() => window.imageEditorInstance.E.type.layout(window.imageEditorInstance.E.layer().text).box.w), ot = await ev(() => JSON.stringify(window.imageEditorInstance.E.layer().text.ot) + "|" + window.imageEditorInstance.E.layer().text.kern);
    check("Kerning ▸ Optical: the letters spaced from their shapes - the line's width changes; the layer keeps {ss01} + optical", Math.abs(w1 - w0) > 1 && ot === '{"ss01":true}|optical', { w0, w1, ot });
    await p.click('#pcChar [data-ot="frac"]'); await p.waitForTimeout(300);
    check("an OpenType button (Fractions) toggles it on the layer (one undo step)", (await ev(() => !!(window.imageEditorInstance.E.layer().text.ot || {}).frac)));
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 2 Type: Convert to Shape - the same letters as outlines (a shape layer in its place) */
    const tA = await alphaOf(), n0 = (await st()).n;
    await ev(() => window.imageEditorInstance.E.ui.run("type.toshape"));
    let s1 = await st(); for (let i = 0; i < 30 && s1.type !== "shape"; i++) { await p.waitForTimeout(200); s1 = await st(); }
    const sA = await alphaOf(), d2 = diff(tA, sA), subs = await ev(() => window.imageEditorInstance.E.layer().shape.path.subs.length);
    check("Type: Convert to Shape: the text layer becomes a shape layer of the same name, its outlines (" + subs + " contours) cover the same pixels", s1.type === "shape" && s1.name === "Tova" && s1.n === n0 && subs >= 9 && d2.iou > 0.85, { type: s1.type, name: s1.name, n: s1.n, n0, subs, d2 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    s1 = await st();
    check("...one undo = the text layer back", s1.type === "text" && s1.n === n0, s1.type);

    /* 3 Type: Create Work Path */
    await ev(() => window.imageEditorInstance.E.ui.run("type.workpath"));
    let wp = 0; for (let i = 0; i < 30 && !wp; i++) { await p.waitForTimeout(200); wp = await ev(() => { const s = window.imageEditorInstance.state; return s.work && s.ptarget && s.ptarget.k === "work" ? s.work.subs.length : 0; }); }
    check("Type: Create Work Path: the outlines as the work path (the text layer stays)", wp >= 9 && (await st()).type === "text", wp);

    /* 4 ROUND CORNERS on a joined shape: two rectangles combined, merged, then rounded (Direct Selection) */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = E.D, Q = window.PCPath;
      const A = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y }), R = (x0, y0, x1, y1) => ({ closed: true, op: "add", pts: [A(x0, y0), A(x1, y0), A(x1, y1), A(x0, y1)] });
      const L = E.makeLayer("Joined", S.w, S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [R(300, 200, 500, 260), R(300, 200, 360, 380)] }, fill: "#aa2200", fillOn: true, strokeOn: false });
      if (Q.syncShape) Q.syncShape(L.shape); D.rasterize(L); E.addLayer(L, "joined", false); E.setTool("pathsel"); E.pen.setTarget({ k: "shape", id: L.id }); E.pen.mergeComponents(); });
    await p.waitForTimeout(300);
    const merged = await ev(() => window.imageEditorInstance.E.layer().shape.path.subs.length);
    const inC = await lpx(302, 202);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("directsel"); E.pen.clearPicks(); }); await p.waitForTimeout(200);
    await ev(() => { const i = document.getElementById("pnDSRad"); i.value = "20"; i.dispatchEvent(new Event("change")); });
    await p.click("#pnDSRound"); await p.waitForTimeout(300);
    const outC = await lpx(302, 202), inner = await lpx(365, 265), anchors = await ev(() => window.imageEditorInstance.E.layer().shape.path.subs[0].pts.length);
    check("Merge Components (one outline), then Direct Selection ▸ ⌜ Radius 20 ▸ Round Corners: the outer corner goes round (its tip empty), the inner corner fills in, 12 anchors", merged === 1 && inC[3] > 200 && outC[3] < 30 && inner[3] > 200 && anchors >= 12, { merged, inC, outC, inner, anchors });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    check("...one undo = the sharp corners back", (await lpx(302, 202))[3] > 200);
    /* 5 TEXT IN A SHAPE: the Type tool clicked inside the picked shape (a diamond) - the text flows inside it */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = E.D, Q = window.PCPath; const A = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y });
      const L = E.makeLayer("Diamond", S.w, S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [A(150, 120), A(260, 230), A(150, 340), A(40, 230)] }] }, fill: "#ddeeff", fillOn: true, strokeOn: false });
      if (Q.syncShape) Q.syncShape(L.shape); D.rasterize(L); E.addLayer(L, "diamond", false); E.setTool("type"); });
    await p.waitForTimeout(200);
    await click(150, 230); await p.waitForTimeout(250);
    const made = await ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.type === "text" && L.text.area ? { n: L.text.area.poly.length, from: L.text.area.from, editing: !!(window.imageEditorInstance.E.textEditing && window.imageEditorInstance.E.textEditing()) } : null; });
    check("Type tool clicked inside the picked shape: a text layer IN that shape (its outline kept), typing at once", made && made.n >= 4 && made.from === "Diamond" && made.editing, made);
    await p.keyboard.type("words flow inside the diamond shape from its narrow top down to the widest middle and back in again", { delay: 5 });
    await click(560, 380); await p.waitForTimeout(300);
    const fl = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "text" && x.text.area), lay = E.type.layout(L.text), T = window.PCType, poly = L.text.area.poly.map(([x, y]) => [L.text.x + x, L.text.y + y]);
      return { n: lay.lines.length, over: lay.overflow, ok: lay.lines.filter((l) => !l.over).every((l) => { const sp = T.bandSpan(poly, l.y, l.y + lay.lh); return sp && l.x >= sp[0] - 0.5 && l.x + l.w <= sp[1] + 0.5; }), w: lay.lines.map((l) => Math.round(l.w)) }; });
    check("...the typed words wrap line by line inside the diamond (short lines at its tips, long in the middle)", fl.n >= 4 && fl.ok && Math.max(...fl.w) > fl.w[0] + 20, fl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
