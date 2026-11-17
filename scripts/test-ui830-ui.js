#!/usr/bin/env node
/* bitGen Studio — 2.830.0 against the RUNNING app (+ a real browser). Tim: "can you add a transparency gradient of images,shapes,
 * text etc can be transparent along the gradient, coreldraw has this feature. so it will start at x% opacity and finish at y%. add a
 * slider to the interactive line that controls the gradient to change the position of the fades etc , do this for both gradient
 * types and drop shadow. when using freehand select tool or pen etc don't close the selection unless the last position is 5px
 * from the start position".
 *   Transparency tool (Gradient group): a drag across a red bar = solid at the press, see-through at the pointer; one undo; the
 *   diamond (fade slider) dragged to a quarter = half way there; an end handle dragged; Start % in the bar; radial; ✕ Remove.
 *   Gradient tool on a vector shape: its line + the fade slider (fillGrad.mid). Drop Shadow tool: the diamond = the opacity.
 *   Lasso: let go far from the start = no selection, the line stays open; press again goes on; ending within 5 px closes;
 *   Enter closes an open one; Esc lets it go. Polygonal lasso: a click on its start closes. Freeform pen: open unless it ends
 *   within 5 px of its start. H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
  const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
  const px = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, c = E.flatten(); return Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
  const sh = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.styles && L.styles.shadow ? JSON.parse(JSON.stringify(L.styles.shadow)) : null; });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.shadowTool && window.imageEditorInstance.E.transp, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); });
    await p.waitForTimeout(600);
    await ev(() => { const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "transp830.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(300);
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run("layer.new"); const L = E.layer(); L.name = "Red"; const g = L.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(100, 100, 200, 80); E.refresh(); E.renderLayersPanel(); });

    const E_ = (f, x) => ev(f, x);
    const tp = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.transp ? JSON.parse(JSON.stringify(L.transp)) : null; });
    const sel = () => ev(() => { const S = window.imageEditorInstance.E.S; return S.sel ? S.sel.reduce((n, v) => n + (v ? 1 : 0), 0) : 0; });
    const scrDist = (d) => ev((d) => d * window.imageEditorInstance.E.S.zoom, d);
    void E_; void scrDist;

    // the Transparency tool
    check("the Transparency tool is in the Gradient group (G) with its own icon", await ev(() => { const E = window.imageEditorInstance.E; return !!E.tools.transparency && [...document.querySelectorAll("[data-tools]")].some((b) => /^gradient,dropshadow,transparency/.test(b.dataset.tools)); }));
    await ev(() => { localStorage.setItem("pc.tp.a0", "100"); localStorage.setItem("pc.tp.a1", "0"); localStorage.setItem("pc.tp.mid", "50"); localStorage.setItem("pc.tp.type", "linear"); const E = window.imageEditorInstance.E; E.setTool("gradient"); E.setTool("transparency"); E.setActive(E.S.layers.findIndex((l) => l.name === "Red")); });
    const u0 = await ev(() => window.imageEditorInstance.E.S.undo.length);
    await drag(100, 140, 300, 140);
    const t1 = await tp();
    check("press in the red bar + drag across it: a linear transparency, solid at the press, see-through at the end", t1 && t1.on && t1.type === "linear" && t1.a0 === 1 && t1.a1 === 0, t1);
    check("…one undo step", (await ev(() => window.imageEditorInstance.E.S.undo.length)) === u0 + 1);
    const pA = await px(104, 140), pM = await px(200, 140), pZ = await px(296, 140);
    check("…drawn: red at the start, half see-through (pink) in the middle, almost white at the end", pA[1] < 30 && pM[1] > 100 && pM[1] < 160 && pM[0] > 240 && pZ[1] > 235, { pA, pM, pZ });
    await shot("1-transparency");
    await drag(200, 140, 150, 140);
    const t2 = await tp(), pQ = await px(150, 140);
    check("the diamond on the line (the fade slider) dragged to a quarter: half way there", Math.abs(t2.mid - 0.25) < 0.03 && pQ[1] > 100 && pQ[1] < 160 && (await px(200, 140))[1] > 170, { t2, pQ });
    await drag(300, 140, 250, 140);
    const t3 = await tp(), l3 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return E.transp.toPx(L.transp, E.transp.layerBox(L, E.S.w, E.S.h)); });
    check("an end handle dragged: the line ends there (past it = the end opacity)", Math.abs(l3.x1 - 250) < 3 && (await px(270, 140))[1] > 235, { t3, l3 });
    await ev(() => { const r = document.querySelector("#ptpA0"); r.value = "60"; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); });
    check("Start in the options bar changes the picked layer at once (60 %)", Math.abs((await tp()).a0 - 0.6) < 0.01 && (await px(104, 140))[1] > 80);
    await ev(() => document.querySelector('[data-tpt="radial"]').click());
    check("◎ makes it radial", (await tp()).type === "radial");
    await ev(() => { window.imageEditorInstance.E.renderOptions(); document.querySelector("#ptpOff").click(); });
    check("✕ Remove takes it off - the bar solid red again", (await tp()) === null && (await px(200, 140))[1] < 30);
    await ev(() => window.imageEditorInstance.E.undo());
    check("…undo brings it back", !!(await tp()));
    await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo()); await ev(() => window.imageEditorInstance.E.undo());

    // the Gradient tool's line on a vector shape
    await ev(() => { const E = window.imageEditorInstance.E; E.store.set("draw.automove", false); E.setTool("shape"); E.S.shapeOp = "new"; E.S.shapeKind = "rect"; E.renderOptions(); });
    await drag(60, 200, 340, 280);
    await ev(() => { localStorage.setItem("img.t.gmid", "50"); const E = window.imageEditorInstance.E; E.S.gradMid = 50; E.S.gradKind = "bw"; E.S.gradType = "linear"; E.setTool("gradient"); });
    await drag(60, 240, 340, 240);
    const gr = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L.shape && L.shape.fillGrad ? JSON.parse(JSON.stringify(L.shape.fillGrad)) : null; });
    const g1 = await gr();
    check("the Gradient tool on a vector shape: its gradient fill from the drag, half way in the middle", g1 && Math.abs(g1.x0 - 60) < 2 && Math.abs(g1.x1 - 340) < 2 && Math.abs((g1.mid == null ? 0.5 : g1.mid) - 0.5) < 0.01, g1);
    check("…the line stays on the shape with the fade slider (diamond) in the middle", await ev(() => { const E = window.imageEditorInstance.E, l = E.transp.fillLine(E.layer()); return !!l && Math.abs(l.mid - 0.5) < 0.01; }));
    const gm0 = await px(200, 240);
    await drag(200, 240, 130, 240);
    const g2 = await gr(), gq = await px(130, 240), gm1 = await px(200, 240);
    check("the fade slider dragged to a quarter: mid 0.25, grey half way there, lighter in the middle than before", Math.abs(g2.mid - 0.25) < 0.03 && gq[0] > 100 && gq[0] < 160 && gm1[0] > gm0[0] + 30, { g2, gq, gm0, gm1 });
    await drag(340, 240, 300, 240);
    check("…an end of the line dragged moves the gradient's end", Math.abs((await gr()).x1 - 300) < 2);
    await shot("2-gradient-fade");

    // the Drop Shadow tool's opacity slider
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("dropshadow"); E.setActive(E.S.layers.findIndex((l) => l.name === "Red")); });
    await drag(140, 140, 190, 180);
    const h = await ev(() => window.imageEditorInstance.E.shadowTool.handleOf(window.imageEditorInstance.E.layer()));
    check("a drop shadow's line has the opacity slider at its opacity along the line", h && Math.abs(h.sx - (h.ax + (h.x - h.ax) * h.op)) < 0.5, h);
    await drag(h.sx, h.sy, h.ax + (h.x - h.ax) * 0.3, h.ay + (h.y - h.ay) * 0.3);
    const so = await ev(() => window.imageEditorInstance.E.layer().styles.shadow.opacity);
    check("…dragged a third of the way along: the shadow's opacity 30 %", Math.abs(so - 0.3) < 0.04, so);
    await ev(() => window.imageEditorInstance.E.undo());
    check("…one undo step", Math.abs((await ev(() => window.imageEditorInstance.E.layer().styles.shadow.opacity)) - h.op) < 0.01);

    // the lasso closes only within 5 px of its start
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.run ? E.ui.run("select.none") : null; E.setTool("lasso"); E.setZoom ? E.setZoom(1) : null; });
    await ev(() => { const E = window.imageEditorInstance.E; if (E.S.sel) E.setSel(null); });
    const path3 = async (pts) => { const s = []; for (const [x, y] of pts) s.push(await scr(x, y)); await p.mouse.move(s[0][0], s[0][1]); await p.mouse.down(); for (const q of s.slice(1)) await p.mouse.move(q[0], q[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200); };
    await path3([[40, 40], [140, 40], [140, 120]]);
    check("let go far from the start: no selection, the freehand line stays open", (await sel()) === 0 && (await ev(() => { const S = window.imageEditorInstance.E.S; return !!S.lassoOpen && S.pts.length > 2; })));
    const z = await ev(() => window.imageEditorInstance.E.S.zoom);
    await path3([[60, 120], [40, 60], [40, 40 + 2 / z]]);
    const n1 = await sel();
    check("press again: it goes on from its end; finished within 5 px of the start = the selection (the whole shape)", n1 > 5000 && !(await ev(() => window.imageEditorInstance.E.S.lassoOpen)), n1);
    await ev(() => window.imageEditorInstance.E.setSel(null));
    await path3([[200, 40], [300, 40], [300, 120]]);
    await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    check("Enter closes an open freehand line as it is", (await sel()) > 2000);
    await ev(() => window.imageEditorInstance.E.setSel(null));
    await path3([[200, 40], [300, 40], [300, 120]]); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    check("Esc lets an open one go (no selection, no line)", (await sel()) === 0 && (await ev(() => window.imageEditorInstance.E.S.pts.length)) === 0);
    await ev(() => window.imageEditorInstance.E.setTool("poly"));
    for (const [x, y] of [[40, 200], [140, 200], [140, 280], [40 + 2 / z, 200 + 1 / z]]) { const q = await scr(x, y); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(80); }
    check("the Polygonal Lasso: a click within 5 px of its start closes it", (await sel()) > 3000 && (await ev(() => window.imageEditorInstance.E.S.pts.length)) === 0);
    await ev(() => window.imageEditorInstance.E.setSel(null));

    // the freeform pen: open unless it ends within 5 px of its start
    const subs = () => ev(() => { const E = window.imageEditorInstance.E, P = E.pen && E.pen.targetInfo ? E.pen.targetInfo() : null; const path = P && P.path ? P.path : E.S.work; return path && path.subs ? path.subs.map((s) => !!s.closed) : null; });
    await ev(() => window.imageEditorInstance.E.setTool("freepen"));
    await path3([[220, 200], [320, 200], [320, 270], [240, 262]]);
    const o1 = await subs();
    check("the Freeform Pen ended 16 px from its start: an OPEN path", o1 && o1.length && o1[o1.length - 1] === false, o1);
    await path3([[220, 200], [320, 200], [320, 270], [220 + 2 / z, 202 / 1]]);
    const o2 = await subs();
    check("…ended within 5 px of its start: closed", o2 && o2[o2.length - 1] === true, o2);
    await shot("3-lasso");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
