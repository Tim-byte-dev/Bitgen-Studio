#!/usr/bin/env node
/* bitGen Studio — 2.439.0 in a REAL browser: the image editor's PROPERTY BAR (pcpropbar.js) - X Y W H + 🔒, a
 * rectangle's four corner radii (a CorelDRAW live rectangle and a Shape-tool rectangle), the outline width and the line
 * style picker - and the CorelDRAW shape tools' DRAW MODES (⊕ Add / ⊖ Subtract into the picked shape).
 * Tim: "add width and height in a top toolbar in image editor - add a lock button next to the width x height inputs to
 * lock aspect ratio. when rectangle shape is drawn add border-radius inputs for each side like in coreldraw ..."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the property bar browser test did not run"); process.exit(0); }
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
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.propbar, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.setTabs(true); E.openDoc(400, 300, "propbar.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); }); E.S.fg = "#000000"; E.S.lastColor = "#3366cc"; });
    const pt = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const drag = async (x0, y0, x1, y1) => { const [a, bb] = await pt(x0, y0), [c, d] = await pt(x1, y1); await p.mouse.move(a, bb); await p.mouse.down(); await p.mouse.move(c, d, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
    const L = () => ev(() => { const E = window.imageEditorInstance.E, A = E.layer(); return { name: A.name, n: E.S.layers.length, box: E.dockers.boxOf(A), shape: A.shape ? { kind: A.shape.kind, gen: A.shape.gen, radii: A.shape.radii, strokeW: A.shape.strokeW, style: A.shape.line && A.shape.line.style, subs: A.shape.path ? A.shape.path.subs.map((s) => s.op) : null } : null }; });
    const val = (id) => ev((id) => (document.getElementById(id) || {}).value, id);

    /* 1 a CorelDRAW rectangle: the bar */
    await ev(() => window.imageEditorInstance.E.setTool("crect")); await p.waitForTimeout(150);
    await ev(() => { const b = document.querySelector('[data-dop="new"]'); if (b) b.click(); });
    await drag(50, 50, 250, 150);
    const r1 = await L();
    const bar1 = await ev(() => ({ ids: [...document.querySelectorAll("#pcObjBar input, #pcObjBar button")].map((x) => x.id), shown: getComputedStyle(document.getElementById("pcObjBar")).display !== "none" }));
    await shot("1-rect-bar");
    check("a rectangle drawn: the property bar - X Y W H + 🔒, its four corners + 🔗, the outline width + the line style", bar1.shown && ["pbX", "pbY", "pbW", "pbLock", "pbH", "pbC0", "pbC1", "pbC2", "pbC3", "pbRL", "pbOW", "pbLS"].every((i) => bar1.ids.includes(i)), bar1);
    check("...X Y W H = its box (50, 50, 200 × 100)", Math.round(+(await val("pbX"))) === 50 && Math.round(+(await val("pbY"))) === 50 && Math.round(+(await val("pbW"))) === 200 && Math.round(+(await val("pbH"))) === 100, r1.box);
    // W 300 with 🔒 on: H follows (150)
    const lockOn = await ev(() => document.getElementById("pbLock").classList.contains("on"));
    if (!lockOn) await p.click("#pbLock");
    await p.fill("#pbW", "300"); await p.press("#pbW", "Enter"); await p.waitForTimeout(300);
    const r2 = await L();
    check("W 300 with 🔒: the height follows (300 × 150), from its top-left", Math.round(r2.box.w) === 300 && Math.round(r2.box.h) === 150 && Math.round(r2.box.x) === 50 && Math.round(r2.box.y) === 50, r2.box);
    await p.click("#pbLock"); await p.waitForTimeout(100);
    await p.fill("#pbH", "100"); await p.press("#pbH", "Enter"); await p.waitForTimeout(300);
    const r3 = await L();
    check("🔓: H 100 changes the height only (300 × 100)", Math.round(r3.box.w) === 300 && Math.round(r3.box.h) === 100, r3.box);
    await p.fill("#pbX", "20"); await p.press("#pbX", "Enter"); await p.waitForTimeout(300);
    check("X 20 moves it", Math.round((await L()).box.x) === 20);
    // corners: 🔗 all four, then one
    const rlOn = await ev(() => document.getElementById("pbRL").classList.contains("on"));
    if (!rlOn) await p.click("#pbRL");
    await p.fill("#pbC0", "20"); await p.press("#pbC0", "Enter"); await p.waitForTimeout(300);
    const c1 = await L();
    await p.click("#pbRL"); await p.waitForTimeout(100);
    await p.fill("#pbC2", "5"); await p.press("#pbC2", "Enter"); await p.waitForTimeout(300);
    const c2 = await L();
    check("corners: 🔗 = all four (20); unlinked, ⌟ alone (5) - the live rectangle keeps its corners", JSON.stringify(c1.shape.gen.corners) === "[20,20,20,20]" && JSON.stringify(c2.shape.gen.corners) === "[20,20,5,20]" && c2.shape.gen.type === "rect", [c1.shape.gen, c2.shape.gen]);
    const cornerPx = await ev(() => { const E = window.imageEditorInstance.E, A = E.layer(), d = A.canvas.getContext("2d"); return [d.getImageData(21, 51, 1, 1).data[3], d.getImageData(318, 148, 1, 1).data[3], d.getImageData(60, 100, 1, 1).data[3]]; });
    check("...drawn: the round top-left corner is empty, the small bottom-right one filled, the middle filled", cornerPx[0] === 0 && cornerPx[1] > 200 && cornerPx[2] > 200, cornerPx);
    // outline width + line style
    await p.fill("#pbOW", "4"); await p.press("#pbOW", "Enter"); await p.waitForTimeout(250);
    await p.click("#pbLS"); await p.waitForTimeout(150);
    const pics = await ev(() => document.querySelectorAll(".pclspop div svg").length);
    await p.click('.pclspop [data-v="dash"]'); await p.waitForTimeout(250);
    const ow = await L();
    await shot("2-styles");
    check("outline width 4 (presets in its list) + the line style picked from pictures (dashed)", ow.shape.strokeW === 4 && ow.shape.style === "dash" && pics >= 5 && (await ev(() => document.querySelectorAll("#pbWList option").length)) >= 10, { ow: ow.shape, pics });

    /* 2 ⊖ Subtract: an ellipse cut out of the rectangle - no new layer, the rectangle's own outline kept */
    const nBefore = (await L()).n;
    await ev(() => window.imageEditorInstance.E.setTool("cellipse")); await p.waitForTimeout(150);
    await ev(() => document.querySelector('[data-dop="subtract"]').click());
    await drag(100, 60, 160, 110);
    const sub = await L();
    const hole = await ev(() => { const d = window.imageEditorInstance.E.layer().canvas.getContext("2d"); return [d.getImageData(130, 85, 1, 1).data[3], d.getImageData(250, 120, 1, 1).data[3]]; });
    await shot("3-subtract");
    check("⊖ Subtract with the rectangle picked: no new layer - the ellipse is cut out of it (a hole), the rest of it as it was", sub.n === nBefore && JSON.stringify(sub.shape.subs) === '["add","subtract"]' && hole[0] === 0 && hole[1] > 200, { sub, hole });
    await ev(() => document.querySelector('[data-dop="add"]').click());
    await drag(330, 200, 380, 260);
    const add = await L();
    const added = await ev(() => window.imageEditorInstance.E.layer().canvas.getContext("2d").getImageData(355, 230, 1, 1).data[3]);
    check("⊕ Add: a second shape becomes a part of the same layer", add.n === nBefore && add.shape.subs.join() === "add,subtract,add" && added > 200, add.shape.subs);
    const un = await ev(() => { const E = window.imageEditorInstance.E; E.undo(); E.undo(); const A = E.layer(); return { subs: A.shape.path.subs.length, gen: !!A.shape.gen }; });
    check("...undo twice: the rectangle as it was (its live corners back)", un.subs === 1 && un.gen, un);
    await ev(() => document.querySelector('[data-dop="new"]').click());

    /* 3 a Shape-tool rectangle: four radii of its own */
    await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc; const R = E.makeLayer("PS rect", 400, 300, "shape"); R.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 100, y: 180, w: 200, h: 100, fill: "#cc3333" }); D.rasterize(R); E.addLayer(R, "t", false); });
    await p.waitForTimeout(900);
    if (!(await ev(() => document.getElementById("pbRL").classList.contains("on")))) await p.click("#pbRL");
    await p.fill("#pbC1", "30"); await p.press("#pbC1", "Enter"); await p.waitForTimeout(250);
    await p.click("#pbRL");
    await p.fill("#pbC3", "0"); await p.press("#pbC3", "Enter"); await p.waitForTimeout(250);
    const ps = await L();
    const psPx = await ev(() => { const d = window.imageEditorInstance.E.layer().canvas.getContext("2d"); return [d.getImageData(298, 182, 1, 1).data[3], d.getImageData(101, 278, 1, 1).data[3]]; });
    check("a Shape-tool rectangle: radii of its own [30, 30, 30, 0] - its top right rounded, its bottom left square", JSON.stringify(ps.shape.radii) === "[30,30,30,0]" && psPx[0] === 0 && psPx[1] > 200, { radii: ps.shape.radii, psPx });

    /* 4 a pixel layer: W / H scale its pixels */
    await ev(() => { const E = window.imageEditorInstance.E; const P = E.makeLayer("Pix", 400, 300); const g = P.canvas.getContext("2d"); g.fillStyle = "#00aa00"; g.fillRect(10, 10, 40, 20); E.addLayer(P, "t", false); });
    await p.waitForTimeout(900);
    const pb0 = { w: +(await val("pbW")), h: +(await val("pbH")), corners: await ev(() => !!document.getElementById("pbC0")) };
    if (!(await ev(() => document.getElementById("pbLock").classList.contains("on")))) await p.click("#pbLock");
    await p.fill("#pbW", "80"); await p.press("#pbW", "Enter"); await p.waitForTimeout(400);
    const pb1 = await L();
    check("a pixel layer: W × H = its pixels' box (40 × 20, no corners); W 80 with 🔒 = 80 × 40 (± a resampled edge pixel)", pb0.w === 40 && pb0.h === 20 && !pb0.corners && Math.abs(pb1.box.w - 80) <= 2 && Math.abs(pb1.box.h - 40) <= 2, { pb0, box: pb1.box });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
