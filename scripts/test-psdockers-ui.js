#!/usr/bin/env node
/* bitGen Studio — 2.429.0 in a REAL browser: CORELDRAW'S DOCKERS - Transform, Shaping, Align and Distribute, Object
 * Properties (ext/imageeditdock/pcdockers.js).
 * Tim: "i would like all the drawing tools from coreldraw and the tool dockers" - the agreed order: the dockers after the
 * drawing tools. Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the dockers browser test did not run"); process.exit(0); }
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
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.removeItem("kx.dk.s"); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.dockers, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    // three shapes: a red rectangle, a blue ellipse overlapping it, a green square; a pixel layer with a dot
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, P = window.PCDraw;
      E.openDoc(800, 500, "dk.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 800, 500); });
      const mk = (name, gen, fill) => { const L = E.vline.newLine({ closed: false, op: "add", pts: [] }, name, { fill, fillOn: true, strokeW: 0, strokeOn: false }); L.shape.path = P.genPath(gen); L.shape.gen = gen; window.PCPath.syncShape(L.shape); E.D.rasterize(L); return L; };
      mk("R", { type: "rect", frame: { cx: 150, cy: 150, w: 200, h: 100, rot: 0 }, corners: [0, 0, 0, 0] }, "#ff0000");
      mk("B", { type: "ellipse", frame: { cx: 260, cy: 170, w: 160, h: 120, rot: 0 } }, "#0000ff");
      mk("G", { type: "rect", frame: { cx: 600, cy: 120, w: 80, h: 80, rot: 0 }, corners: [0, 0, 0, 0] }, "#00aa00");
      const L = E.makeLayer("Dot", S.w, S.h, "pixel"); const g = L.canvas.getContext("2d"); g.fillStyle = "#000"; g.fillRect(500, 350, 40, 40); E.addLayer(L, "dot", false);
      S.undo = []; E.refresh(); E.renderLayersPanel();
    });
    const pick = (names, active) => ev(([names, active]) => { const E = window.imageEditorInstance.E, S = E.S; S.picks = S.layers.filter((x) => names.includes(x.name)).map((x) => x.id); E.setActive(S.layers.findIndex((x) => x.name === active)); E.renderLayersPanel(); }, [names, active]);
    const bx = (name) => ev((name) => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.name === name); return L ? E.dockers.boxOf(L) : null; }, name);
    const r = (v) => Math.round(v);

    /* 1 the group opens from Window ▸ Dockers */
    const hidden0 = await ev(() => document.querySelector('.pcgrp[data-g="dock"]').classList.contains("off"));
    await ev(() => window.imageEditorInstance.E.ui.run("dk.transform")); await p.waitForTimeout(200);
    const shown = await ev(() => !document.querySelector('.pcgrp[data-g="dock"]').classList.contains("off") && document.querySelector("#dkXf").classList.contains("on"));
    check("the dockers: hidden until Window ▸ Dockers: Transform (Alt+F7) opens them (Transform / Shaping / Align / Object tabs)", hidden0 && shown && (await ev(() => [...document.querySelectorAll('.pcgrp[data-g="dock"] [data-tab]')].map((x) => x.dataset.tab).join())) === "dkXf,dkShape,dkAlign,dkProps");

    /* 2 Transform: position (relative), rotate, scale + mirror, size, skew, copies */
    await pick(["R"], "R");
    await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.fill("#dkXf #dkX", "40"); await p.dispatchEvent("#dkXf #dkX", "change"); await p.fill("#dkXf #dkY", "-20"); await p.dispatchEvent("#dkXf #dkY", "change");
    await p.click("#dkXf #dkApply"); await p.waitForTimeout(200);
    let b1 = await bx("R");
    check("Transform ▸ Position (relative 40, -20): the rectangle moved (still live)", r(b1.x) === 90 && r(b1.y) === 80 && await ev(() => !!window.imageEditorInstance.E.layer().shape.gen), b1);
    await p.click('#dkXf [data-dkt="rotate"]'); await p.fill("#dkXf #dkA", "90"); await p.dispatchEvent("#dkXf #dkA", "change"); await p.click("#dkXf #dkApply"); await p.waitForTimeout(200);
    b1 = await bx("R");
    check("...Rotate 90° about the centre: 100 wide, 200 tall now (curves)", Math.abs(b1.w - 100) < 1 && Math.abs(b1.h - 200) < 1 && await ev(() => !window.imageEditorInstance.E.layer().shape.gen), b1);
    await p.click('#dkXf [data-dkt="scale"]'); await p.fill("#dkXf #dkSX", "50"); await p.dispatchEvent("#dkXf #dkSX", "change"); await p.click("#dkXf #dkMH"); await p.click("#dkXf #dkApply"); await p.waitForTimeout(200);
    b1 = await bx("R");
    check("...Scale 50 % proportional + mirror ⇆: half the size", Math.abs(b1.w - 50) < 1 && Math.abs(b1.h - 100) < 1, b1);
    await p.click('#dkXf [data-dkt="size"]'); await p.fill("#dkXf #dkW", "120"); await p.dispatchEvent("#dkXf #dkW", "change"); await p.click("#dkXf #dkApply"); await p.waitForTimeout(200);
    b1 = await bx("R");
    check("...Size W 120 (proportional): 120 x 240", Math.abs(b1.w - 120) < 1 && Math.abs(b1.h - 240) < 1, b1);
    await ev(() => { for (let i = 0; i < 4; i++) window.imageEditorInstance.E.undo(); });
    b1 = await bx("R");
    check("...each is one undo step (4 undos: back where it started)", r(b1.x) === 50 && r(b1.y) === 100 && r(b1.w) === 200, b1);
    await p.click('#dkXf [data-dkt="position"]'); await p.fill("#dkXf #dkX", "0"); await p.dispatchEvent("#dkXf #dkX", "change"); await p.fill("#dkXf #dkY", "30"); await p.dispatchEvent("#dkXf #dkY", "change");
    await p.fill("#dkXf #dkCp", "2"); await p.dispatchEvent("#dkXf #dkCp", "change"); await p.click("#dkXf #dkApply"); await p.waitForTimeout(300);
    const copies = await ev(() => window.imageEditorInstance.state.layers.filter((x) => /^R/.test(x.name)).map((x) => Math.round(window.imageEditorInstance.E.dockers.boxOf(x).y)));
    check("...Copies 2: two duplicates, each 30 px further", copies.join() === "100,130,160", copies);
    await ev(() => { const E = window.imageEditorInstance.E; for (let i = 0; i < 4; i++) E.undo(); E.ui.run("dk.transform"); });
    await ev(() => { const s = window.imageEditorInstance.E.dockers.settings; s.copies = 0; });
    // a pixel layer
    await pick(["Dot"], "Dot");
    await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.click('#dkXf [data-dkt="rotate"]'); await p.fill("#dkXf #dkA", "45"); await p.dispatchEvent("#dkXf #dkA", "change"); await p.fill("#dkXf #dkCp", "0"); await p.dispatchEvent("#dkXf #dkCp", "change"); await p.click("#dkXf #dkApply"); await p.waitForTimeout(250);
    const dot = await bx("Dot");
    check("...a pixel layer turns too (45°: its box ~ 40 √2)", Math.abs(dot.w - 57) <= 3 && Math.abs(dot.h - 57) <= 3, dot);

    /* 3 Shaping */
    await ev(() => window.imageEditorInstance.E.ui.run("dk.shaping")); await pick(["R", "B"], "R");
    await ev(() => window.imageEditorInstance.E.dockers.paint());
    const n0 = await ev(() => window.imageEditorInstance.state.layers.length);
    await p.click('#dkShape [data-shp="weld"]'); await p.waitForTimeout(400);
    let w = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return { n: S.layers.length, name: L.name, fill: L.shape.fill, box: window.imageEditorInstance.E.dockers.boxOf(L), names: S.layers.map((x) => x.name) }; });
    check("Shaping ▸ Weld: one shape (the target's red) covering both, the two originals gone", w.n === n0 - 1 && /weld/.test(w.name) && w.fill === "#ff0000" && Math.abs(w.box.x - 50) < 2 && Math.abs(w.box.x + w.box.w - 340) < 2 && !w.names.includes("B"), w);
    await ev(() => window.imageEditorInstance.E.undo());
    await pick(["R", "B"], "R"); await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.click('#dkShape [data-shp="trim"]'); await p.waitForTimeout(400);
    const trimmed = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active]; const c = E.flatten().getContext("2d"); return { name: L.name, at: Array.from(c.getImageData(230, 160, 1, 1).data), keep: S.layers.map((x) => x.name) }; });
    check("...Trim: the target minus the ellipse (where they overlapped is not red now); the source left as it was asked", /trimmed/.test(trimmed.name) && !(trimmed.at[0] > 200 && trimmed.at[2] < 60), trimmed);
    await ev(() => window.imageEditorInstance.E.undo());
    await pick(["R", "B"], "R"); await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.click('#dkShape [data-shp="intersect"]'); await p.waitForTimeout(400);
    w = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return { name: L.name, box: window.imageEditorInstance.E.dockers.boxOf(L) }; });
    check("...Intersect: only the overlap (x from the ellipse's left edge to the rectangle's right)", /intersection/.test(w.name) && Math.abs(w.box.x - 180) < 3 && Math.abs(w.box.x + w.box.w - 250) < 3, w);
    await ev(() => window.imageEditorInstance.E.undo());

    /* 4 Align and Distribute */
    await ev(() => window.imageEditorInstance.E.ui.run("dk.align")); await pick(["R", "B", "G"], "G");
    await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.click('#dkAlign [data-al="top"]'); await p.waitForTimeout(250);
    const tops = await ev(() => ["R", "B", "G"].map((n) => Math.round(window.imageEditorInstance.E.dockers.boxOf(window.imageEditorInstance.state.layers.find((x) => x.name === n)).y)));
    check("Align ▸ top to the active object (G at 80): all three tops at 80", tops.join() === "80,80,80", tops);
    await ev(() => { const s = document.querySelector("#dkAlign #dkAT"); s.value = "page-center"; s.dispatchEvent(new Event("change")); });
    await p.click('#dkAlign [data-al="hcenter"]'); await p.waitForTimeout(250);
    const cx = await ev(() => ["R", "B", "G"].map((n) => { const b = window.imageEditorInstance.E.dockers.boxOf(window.imageEditorInstance.state.layers.find((x) => x.name === n)); return Math.round(b.x + b.w / 2); }));
    check("...centres to the page centre (400)", cx.every((v) => v === 400), cx);
    await ev(() => { const E = window.imageEditorInstance.E; E.undo(); E.undo(); });
    await p.click('#dkAlign [data-di="hspace"]'); await p.waitForTimeout(250);
    const gaps = await ev(() => { const bs = ["R", "B", "G"].map((n) => window.imageEditorInstance.E.dockers.boxOf(window.imageEditorInstance.state.layers.find((x) => x.name === n))).sort((a, b) => a.x - b.x); return [Math.round(bs[1].x - (bs[0].x + bs[0].w)), Math.round(bs[2].x - (bs[1].x + bs[1].w))]; });
    check("...Distribute spacing horizontally: equal gaps", Math.abs(gaps[0] - gaps[1]) <= 1, gaps);

    /* 5 Object Properties */
    await ev(() => window.imageEditorInstance.E.ui.run("dk.props")); await pick(["G"], "G"); await ev(() => window.imageEditorInstance.E.dockers.paint());
    await p.click('#dkProps [data-fk="linear"]'); await p.waitForTimeout(200);
    await ev(() => { const a = document.querySelector("#dkProps #dkF2"); a.value = "#ffff00"; a.dispatchEvent(new Event("change")); }); await p.waitForTimeout(200);
    const grad = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), b = E.dockers.boxOf(L), c = E.flatten().getContext("2d"); return { g: L.shape.fillGrad, l: Array.from(c.getImageData(Math.round(b.x + 3), Math.round(b.y + b.h / 2), 1, 1).data), rr: Array.from(c.getImageData(Math.round(b.x + b.w - 3), Math.round(b.y + b.h / 2), 1, 1).data) }; });
    check("Object Properties ▸ Fill: Linear gradient green -> yellow (left green, right yellow)", grad.g && grad.g.type === "linear" && grad.l[1] > 120 && grad.l[0] < 60 && grad.rr[0] > 200 && grad.rr[1] > 200, grad);
    await p.fill("#dkProps #dkOW", "6"); await p.dispatchEvent("#dkProps #dkOW", "change"); await p.waitForTimeout(150);
    check("...Outline width 6", (await ev(() => window.imageEditorInstance.E.layer().shape.strokeW)) === 6);
    const svg = await ev(() => window.PCBez.svgLine(window.imageEditorInstance.E.layer().shape));
    check("...the gradient goes into the SVG (linearGradient)", /<linearGradient/.test(svg) && /url\(#bg/.test(svg));

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
