#!/usr/bin/env node
/* bitGen Studio — 2.458.0 in a REAL browser: AUTO / FLOORPLAN DIMENSIONS + the CHAIN DIMENSION tool (pcdimauto.js) -
 * ⌂ Floorplan on a dimension tool's bar (every wall outside + the overall size, one group, one undo), Layer ▸ Auto
 * Dimension (the overall width + height), Layer ▸ Floorplan Dimensions… (its options), the chain (points, Enter /
 * double-click, the place: every part + the total).
 * Tim: "add an auto dimension feature and floorplan dimension feature"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the auto dimensions browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
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
  const tag = "zzda" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dims, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc; Object.assign(E.guides.settings, { snap: true, guides: true, objects: true, nodes: true, midpoints: false, intersections: true, page: false });
      E.docs.setTabs(true); E.openDoc(520, 340, "dima.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 520, 340); });
      const P = E.makeLayer("Block", 520, 340); const g = P.canvas.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(60, 100, 200, 80); E.addLayer(P, "t", false);
      const T = E.makeLayer("Room", 520, 340, "shape"); T.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", fillOn: false, strokeOn: true, strokeW: 3, stroke: "#333333", path: { subs: [{ closed: true, op: "add", pts: [[330, 170], [470, 170], [470, 230], [400, 230], [400, 290], [330, 290]].map(([x, y]) => ({ x, y, ix: x, iy: y, ox: x, oy: y })) }] } });
      window.PCPath.syncShape(T.shape); D.rasterize(T); E.addLayer(T, "t", false);
      Object.assign(E.S.cd, { unit: "px", dec: 1, fpOff: 24 }); E.setTool("cdimpar"); });
    await p.waitForTimeout(400);
    const sc = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    const click = async (x, y) => { const [a, bb] = await sc(x, y); await p.mouse.move(a, bb, { steps: 2 }); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(160); };
    const setOf = (n) => ev((n) => { const E = window.imageEditorInstance.E, W = E.S.layers.find((L) => L.name === n); if (!W) return null;
      const gs = E.S.layers.filter((L) => L.parent === W.id && E.dimGroups.isGroup(L));
      return { n: gs.length, lens: gs.map((G) => Math.round(E.dimGroups.geom(G.dimg).len * 10) / 10), kinds: gs.map((G) => G.dimg.kind), d0: gs.map((G) => E.dimGroups.geom(G.dimg).d0.map((v) => Math.round(v))), parts: gs.every((G) => E.S.layers.filter((x) => x.parent === G.id).length === 3), active: E.layer() === W }; }, n);
    const pick = (n) => ev((n) => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === n)); }, n);
    const sorted = (a) => a.slice().sort((x, y) => x - y).join();

    /* 1 ⌂ Floorplan on the dimension tool's bar, the Room picked */
    await pick("Room"); await p.waitForTimeout(300);
    const bar = await ev(() => ({ auto: !!document.querySelector("#kxOpts #cdAuto"), plan: !!document.querySelector("#kxOpts #cdPlan"), off: (document.querySelector("#kxOpts #cdOff") || {}).value }));
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await p.click("#kxOpts #cdPlan"); await p.waitForTimeout(400);
    const fp = await setOf("Floorplan Room");
    await shot("1-floorplan");
    check("the dimension tool's bar: ↔ distance (24), ⊞ Auto, ⌂ Floorplan", bar.auto && bar.plan && bar.off === "24", bar);
    check("⌂ Floorplan on the L-shaped Room: a dimension group outside every wall (140 60 70 60 70 120) + the overall 140 x 120, held in \"Floorplan Room\" (picked)", fp && fp.n === 8 && sorted(fp.lens) === sorted([140, 60, 70, 60, 70, 120, 140, 120]) && fp.parts && fp.active, fp);
    check("...the walls outside the room (the top one 24 above it at y 146), the overall width further out", fp && fp.d0.some((d) => d[1] === 146 && d[0] === 330) && fp.kinds.filter((k) => k === "horizontal").length === 1 && fp.kinds.filter((k) => k === "vertical").length === 1, fp && fp.d0);
    await ev(() => window.imageEditorInstance.E.undo());
    check("...one undo step takes them all away", (await ev(() => window.imageEditorInstance.E.S.layers.length)) === n0);

    /* 2 Layer ▸ Auto Dimension on the Block (a picture layer: its box) */
    await pick("Block");
    await ev(() => window.imageEditorInstance.E.ui.run("layer.autodim")); await p.waitForTimeout(300);
    const au = await setOf("Size of Block");
    check("Layer ▸ Auto Dimension on the Block: its width 200 (above) + height 80 (beside), in \"Size of Block\"", au && au.n === 2 && au.lens.join() === "200,80" && au.kinds.join() === "horizontal,vertical", au);

    /* 3 Layer ▸ Floorplan Dimensions… : walls only, 16 px out */
    await pick("Room");
    await ev(() => window.imageEditorInstance.E.ui.run("layer.floorplan")); await p.waitForTimeout(300);
    await p.fill(".kxdlg.pcd #fpOff", "16"); await p.uncheck(".kxdlg.pcd #fpAll"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const fp2 = await setOf("Floorplan Room");
    check("Layer ▸ Floorplan Dimensions…: 16 px out, no overall size = the 6 walls (the top one at y 154)", fp2 && fp2.n === 6 && fp2.d0.some((d) => d[1] === 154), fp2);

    /* 4 the Chain Dimension tool: the Block's top - corner, side middle, corner - Enter, then the place */
    await ev(() => window.imageEditorInstance.E.setTool("cdimchain")); await p.waitForTimeout(200);
    const inF8 = await ev(() => !!window.imageEditorInstance.E.ui.CMD.has("tool.cdimchain") && window.imageEditorInstance.E.S.tool === "cdimchain");
    await click(62, 102); await click(161, 98); await click(258, 101);
    const cs = await ev(() => window.imageEditorInstance.E.dimAuto.chain());
    await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    await click(150, 60);
    const c1 = await setOf("Chain Dimension 1");
    await shot("4-chain");
    check("Chain Dimension: 3 snapped points (60,100 160,100 260,100), Enter, a click above: 100 + 100 and the total 200, horizontal, one group", inF8 && JSON.stringify(cs.pts) === "[[60,100],[160,100],[260,100]]" && c1 && c1.n === 3 && c1.lens.join() === "100,100,200" && c1.kinds.every((k) => k === "horizontal"), { inF8, cs, c1 });
    check("...the parts on the line through the click (y 60), the total further out", c1 && c1.d0[0][1] === 60 && c1.d0[2][1] < 60, c1 && c1.d0);
    // a double-click ends it too; Ctrl = vertical
    await click(260, 100);
    const [dx, dy] = await sc(260, 180); await p.mouse.dblclick(dx, dy); await p.waitForTimeout(200);
    const ph = await ev(() => window.imageEditorInstance.E.dimAuto.chain().ph);
    const [px2, py2] = await sc(300, 140); await p.mouse.move(px2, py2); await p.keyboard.down("Control"); await p.mouse.down(); await p.mouse.up(); await p.keyboard.up("Control"); await p.waitForTimeout(250);
    const c2 = await setOf("Chain Dimension 2");
    check("...a double-click ends the points; Ctrl = vertical: the Block's right side 80", ph === 1 && c2 && c2.n === 1 && c2.lens[0] === 80 && c2.kinds[0] === "vertical", { ph, c2 });
    await click(10, 10); await p.keyboard.press("Escape");
    check("...Esc cancels a chain", (await ev(() => window.imageEditorInstance.E.dimAuto.chain().pts.length)) === 0);
    const menu = await ev(() => { const m = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Layer"); return m ? ["layer.autodim", "layer.floorplan"].every((id) => m[1].includes(id)) : false; });
    check("Layer ▸ Auto Dimension / Floorplan Dimensions… in the menu", menu);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
