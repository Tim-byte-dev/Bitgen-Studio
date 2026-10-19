#!/usr/bin/env node
/* bitGen Studio — 2.452.0 in a REAL browser: the Move tool's SCALE / ROTATE HANDLES and TRANSFORM OPTIONS
 * (pchandles.js). Tim: "add handles to the selected object to rotate and scale when move tool is selected.single click
 * on the layer scales(shift scales uniform), double click rotates." Against the running app (H3_URL, default :8311).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the handles browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.handles, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.docs.setTabs(true); E.openDoc(600, 400, "hd.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); });
      E.newLayer(); const L = E.layer(); L.name = "Box"; const g = L.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(200, 150, 100, 100); L.ver++; E.refresh(); E.deselect(); E.setTool("move");
    });
    await p.waitForTimeout(300);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const box = () => ev(() => { const E = window.imageEditorInstance.E; E.handles && (E.handles.state()); const b = E.dockers.boxOf(E.layer()); return b ? [b.x, b.y, b.w, b.h] : null; });
    const drag = async (x0, y0, x1, y1, mods) => { const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(250); };

    /* 1 the handles show on the Move tool; the options bar has the transform options */
    const b0 = await box(), opts = await ev(() => ["xhAng", "xhRot", "xhL90", "xhR90", "xhFH", "xhFV", "xhSW", "xhSH", "xhSc"].every((id) => document.getElementById(id)));
    const ink = await ev(() => { const o = document.getElementById("ieOverlay") || document.querySelector("#ieStage canvas:last-of-type"); return o ? o.id : ""; });
    await shot("1-scale");
    check("the Move tool: scale handles round the active layer (its box 200,150 100x100); the options bar has Transform: angle ↻, ⟲90 ⟳90, ⇋ ⇵, W % x H % ⤡",
      JSON.stringify(b0) === "[200,150,100,100]" && opts && (await ev(() => window.imageEditorInstance.E.handles.state().mode)) === "scale", { b0, opts, ink });

    /* 2 a corner handle dragged: scales from the opposite corner; Shift keeps the proportions */
    await drag(300, 250, 350, 270);
    const b1 = await box();
    check("the bottom-right handle dragged to (350, 270): 150 x 120 from the top-left corner (one undo step)", b1 && Math.abs(b1[0] - 200) <= 1 && Math.abs(b1[2] - 150) <= 2 && Math.abs(b1[3] - 120) <= 2, b1);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const bu = await box();
    await drag(300, 250, 360, 260, ["Shift"]);
    const b2 = await box();
    check("...undo puts it back; with Shift the proportions are kept (160 x 160)", JSON.stringify(bu) === "[200,150,100,100]" && b2 && Math.abs(b2[2] - b2[3]) <= 2 && Math.abs(b2[2] - 160) <= 3, { bu, b2 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 3 a side handle: one way only */
    await drag(300, 200, 340, 230);
    const b3 = await box();
    check("the right side handle: wider only (140 x 100)", b3 && Math.abs(b3[2] - 140) <= 2 && Math.abs(b3[3] - 100) <= 1, b3);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 4 double click = the rotate handles; a corner turns it 45° (Shift = 15° steps) */
    const [mx, my] = await T(250, 200); await p.mouse.dblclick(mx, my); await p.waitForTimeout(250);
    const md = await ev(() => window.imageEditorInstance.E.handles.state().mode);
    await shot("4-rotate");
    // the top-right corner (300, 150) round the centre (250, 200) to straight above-right ... 45° on
    await drag(300, 150, 250 + 70.7, 200, ["Shift"]);
    const b4 = await box(), px4 = await ev(() => Array.from(window.imageEditorInstance.E.layer().canvas.getContext("2d").getImageData(250, 135, 1, 1).data));
    await shot("4b-turned");
    check("double-click = the ROTATE handles; a corner dragged a quarter turn round (Shift = 15° steps) turns it 45°: a diamond about 141 wide, red straight above the centre", md === "rotate" && b4 && Math.abs(b4[2] - 141) <= 4 && px4[0] > 200 && px4[3] > 200, { md, b4, px4 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const [cx, cy] = await T(250, 200); await p.mouse.click(cx, cy); await p.waitForTimeout(200);
    check("a single click: back to the scale handles", (await ev(() => window.imageEditorInstance.E.handles.state().mode)) === "scale");

    /* 5 a drag inside still MOVES the layer */
    await drag(250, 200, 280, 220);
    const b5 = await box();
    check("a drag inside the layer (not on a handle) moves it as before", b5 && b5[0] === 230 && b5[1] === 170 && b5[2] === 100, b5);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);

    /* 6 the options bar: ⟳90, flip, W % x H % */
    await ev(() => { document.getElementById("xhSW").value = "50"; document.getElementById("xhSW").onchange(); document.getElementById("xhSc").click(); });
    await p.waitForTimeout(200);
    const b6 = await box();
    await ev(() => window.imageEditorInstance.E.undo());
    check("Transform options: W 50 % (🔗 = H too) ⤡ = 50 x 50 round the centre", b6 && Math.abs(b6[2] - 50) <= 1 && Math.abs(b6[3] - 50) <= 1 && Math.abs(b6[0] - 225) <= 1, b6);

    /* 7 type turns and stays type; a shape stays a path */
    const t7 = await ev(() => {
      const E = window.imageEditorInstance.E, L = E.makeLayer("Text", 600, 400, "text"); L.text = Object.assign({}, E.D.TEXT_DEFAULT, { str: "TURN", x: 380, y: 60, size: 48, color: "#0000ff" }); E.D.rasterize(L); E.addLayer(L, "t", false);
      E.setActive(E.S.layers.indexOf(L)); E.handles.byOptions("rotate", 90); return { type: L.type, rot: L.text.rot, str: L.text.str };
    });
    check("type: ⟳90 turns it and it stays editable type (t.rot 90)", t7.type === "text" && t7.rot === 90 && t7.str === "TURN", t7);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
