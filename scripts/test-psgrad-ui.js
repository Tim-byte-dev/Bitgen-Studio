#!/usr/bin/env node
/* bitGen Studio — 2.434.0 in a REAL browser: the GRADIENT EDITOR (pcgrad.js) with the Gradient tool / a Gradient fill
 * layer / a shape's gradient fill, LAYER COMPS (pccomps.js) and SMART FILTER BLEND MODES (pcsmart.js).
 * Tim: "add anything else in our gap list that will fit this turn" (the 2.430.0 message). Against the running app
 * (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the gradient editor / comps browser test did not run"); process.exit(0); }
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
    await p.evaluate(() => { try { for (const k of ["kx.grad.tool", "kx.grad.mine", "kx.t.gkind"]) localStorage.removeItem(k); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.gradEdit && window.imageEditorInstance.E.comps, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.setTabs(true); E.openDoc(400, 200, "grad.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 200); }); E.S.fg = "#ff0000"; E.S.bg = "#0000ff"; });
    const px = (x, y, i) => ev(([x, y, i]) => { const S = window.imageEditorInstance.E.S, L = S.layers[i == null ? S.active : i]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y, i]);

    /* 1 the editor: presets, the bar, stops */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("gradient"); });
    await p.click("#ptGEdit"); await p.waitForTimeout(250);
    const d0 = await ev(() => ({ title: (document.querySelector(".kxdlg.pcd h4") || {}).textContent, pre: document.querySelectorAll(".gedlg .gpre button").length, stops: document.querySelectorAll(".gedlg .gst").length }));
    check("the Gradient tool's gradient button opens the Gradient Editor: 12 presets, the bar with its 2 stops (Foreground to Background)", /Gradient Editor/.test(d0.title) && d0.pre === 12 && d0.stops === 2, d0);
    const bar = await (await p.$("#geStops")).boundingBox();
    await p.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2); await p.waitForTimeout(100);
    await p.fill("#geC", "#00ff00"); await p.dispatchEvent("#geC", "input");
    await p.fill("#geA", "50"); await p.dispatchEvent("#geA", "change");
    let g = await ev(() => window.imageEditorInstance.E.gradDlg.get());
    check("a click under the bar = a new stop there (3 now); its colour (green) and opacity (50 %)", g.stops.length === 3 && g.stops[1].t === 0.5 && g.stops[1].c === "#00ff00" && g.stops[1].a === 0.5 && g.stops[0].c === "fg" && g.stops[2].c === "bg", g);
    // drag the middle stop to 25 %, then a 4th, dragged down off = deleted
    const st1 = await (await p.$('.gedlg .gst[data-si="1"]')).boundingBox();
    await p.mouse.move(st1.x + 6, st1.y + 8); await p.mouse.down(); await p.mouse.move(bar.x + bar.width * 0.25, st1.y + 8, { steps: 6 }); await p.mouse.up();
    g = await ev(() => window.imageEditorInstance.E.gradDlg.get());
    check("...dragging a stop moves it (to 25 %)", Math.abs(g.stops[1].t - 0.25) < 0.02 && g.stops[1].c === "#00ff00", g.stops.map((s) => s.t));
    await p.mouse.click(bar.x + bar.width * 0.75, bar.y + bar.height / 2); await p.waitForTimeout(80);
    const n4 = await ev(() => window.imageEditorInstance.E.gradDlg.get().stops.length);
    const st3 = await (await p.$('.gedlg .gst[data-si="2"]')).boundingBox();
    await p.mouse.move(st3.x + 6, st3.y + 8); await p.mouse.down(); await p.mouse.move(st3.x + 6, st3.y + 80, { steps: 6 }); await p.mouse.up();
    const n3 = await ev(() => window.imageEditorInstance.E.gradDlg.get().stops.length);
    check("...a 4th stop, dragged down off the bar = deleted (3 again)", n4 === 4 && n3 === 3, [n4, n3]);
    await p.click("#geNew"); await p.waitForTimeout(80);
    const mine = await ev(() => document.querySelectorAll(".gedlg .gpre button").length);
    check("...New keeps it among the presets (13)", mine === 13, mine);
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click()); await p.waitForTimeout(150);
    const tool = await ev(() => { const S = window.imageEditorInstance.E.S; return { kind: S.gradKind, n: S.gradCustom.stops.length, sel: document.getElementById("ptGKind").value }; });
    check("OK: the Gradient tool's Colours = Custom (the editor's 3 stops)", tool.kind === "custom" && tool.n === 3 && tool.sel === "custom", tool);
    // draw it left -> right: red, green half see-through at 25 %, blue
    const pt = (x, y) => ev(([x, y]) => { const r = document.getElementById("kxPaper").getBoundingClientRect(), z = window.imageEditorInstance.E.S.zoom; return [r.left + x * z, r.top + y * z]; }, [x, y]);
    { const [a1, b1] = await pt(0, 100), [a2, b2] = await pt(399, 100); await p.mouse.move(a1, b1); await p.mouse.down(); await p.mouse.move(a2, b2, { steps: 10 }); await p.mouse.up(); }
    await p.waitForTimeout(200);
    const L0 = await px(2, 100, 0), Lq = await px(100, 100, 0), L1 = await px(397, 100, 0);
    check("the Gradient tool draws the custom gradient: red at the left, the half see-through green at 25 % (over the white), blue at the right",
      L0[0] > 240 && L0[1] < 20 && L1[2] > 240 && L1[0] < 20 && Lq[1] > 180 && Lq[0] > 100 && Lq[2] > 100, [L0, Lq, L1]);

    /* 2 a Gradient fill layer: Properties ▸ Edit… */
    await ev(() => { const E = window.imageEditorInstance.E; E.newFill("gradient"); });
    await p.waitForTimeout(150);
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps"));
    await p.waitForTimeout(100);
    const hasEdit = await ev(() => !!document.getElementById("ppFEdit"));
    await p.click("#ppFEdit"); await p.waitForTimeout(150);
    await ev(() => { const E = window.imageEditorInstance.E; E.gradDlg.set(window.PCGrad.PRESETS[3]); document.querySelector(".kxdlg.pcd .ok").click(); });
    await p.waitForTimeout(200);
    const fl = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { n: L.fill.stops && L.fill.stops.length, c1: L.fill.c1, c2: L.fill.c2, undo: window.imageEditorInstance.E.S.undo.slice(-1)[0].label }; });
    check("a Gradient fill layer: Properties ▸ the gradient button = the editor; OK keeps its stops (Spectrum: 7) as one undo step", hasEdit && fl.n === 7 && fl.c1 === "#ff0000" && fl.c2 === "#ff0000" && /gradient/.test(fl.undo), fl);
    await ev(() => window.imageEditorInstance.E.undo());

    /* 3 a vector shape's gradient fill (Object Properties) -> its SVG */
    await ev(() => { const E = window.imageEditorInstance.E, P = window.PCDraw;
      const L = E.vline.newLine({ closed: false, op: "add", pts: [] }, "Box", { fill: "#888888", fillOn: true, strokeW: 0, strokeOn: false });
      L.shape.path = P.genPath({ type: "rect", frame: { cx: 200, cy: 100, w: 300, h: 120, rot: 0 }, corners: [0, 0, 0, 0] }); window.PCPath.syncShape(L.shape);
      L.shape.fillGrad = { type: "linear", c1: "#000000", c2: "#ffffff", angle: 0 }; E.D.rasterize(L); E.refresh(); E.renderLayersPanel(); E.ui.run("dk.props"); });
    await p.waitForTimeout(200);
    await p.click("#dkFE"); await p.waitForTimeout(150);
    await ev(() => { const E = window.imageEditorInstance.E; E.gradDlg.set({ name: "t", stops: [{ t: 0, c: "#ff0000", a: 1 }, { t: 0.5, c: "#00ff00", a: 0.5 }, { t: 1, c: "#0000ff", a: 1 }] }); document.querySelector(".kxdlg.pcd .ok").click(); });
    await p.waitForTimeout(200);
    const sv = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { n: (L.shape.fillGrad.stops || []).length, svg: window.PCBez.svgLine(L.shape) }; });
    check("Object Properties ▸ the gradient button: the shape's gradient fill gets the editor's stops - and its SVG has them (with the half opacity)", sv.n === 3 && /<stop offset="0.5" stop-color="#00ff00" stop-opacity="0.5"\/>/.test(sv.svg), sv);

    /* 4 layer comps */
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.showTab("pcComps"); });
    const empty = await ev(() => /No layer comps yet/.test(document.getElementById("pcComps").textContent));
    await ev(() => { const E = window.imageEditorInstance.E; E.comps.make("All", { vis: true, pos: true, look: true }); });
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers.find((x) => x.name === "Box"); L.visible = false; S.layers[0].opacity = 0.5; E.shiftLayer(S.layers.find((x) => x.name === "Box"), 0, 0); E.refresh(); E.renderLayersPanel(); });
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers.find((x) => x.name === "Box"); L.shape.x = (L.shape.x || 0); E.shiftLayer(L, 50, 20); E.comps.make("Box hidden", { vis: true, pos: true, look: true }); });
    const c2 = await ev(() => { const E = window.imageEditorInstance.E; return { rows: [...document.querySelectorAll("#pcComps .lcrow .nm")].map((x) => x.firstChild.textContent), on: document.querySelector("#pcComps .lcrow.on .nm").firstChild.textContent }; });
    check("Layer Comps: the panel (Window ▸ Layer Comps / the Comps tab): ＋ keeps the layers' state - two comps (+ Last Document State), the newest applied", empty && c2.rows.join() === "Last Document State,All,Box hidden" && c2.on === "Box hidden", c2);
    const undo0 = await ev(() => window.imageEditorInstance.E.S.undo.length);
    await ev(() => document.querySelector('#pcComps [data-ap]:not([data-ap="last"])').click());
    await p.waitForTimeout(150);
    const a1 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers.find((x) => x.name === "Box"); return { vis: L.visible, op: S.layers[0].opacity, x: Math.round(E.dockers.boxOf(L).x), undo: S.undo.length, label: S.undo.slice(-1)[0].label, last: !!document.querySelector('#pcComps [data-lc="last"]') }; });
    check("▶ on \"All\": the Box shown again, the Background's opacity back, the Box where it was (position) - one undo step; Last Document State kept", a1.vis === true && a1.op === 1 && a1.x === 50 && a1.undo === undo0 + 1 && /layer comp: All/.test(a1.label) && a1.last, a1);
    await ev(() => document.getElementById("lcNext").click()); await p.waitForTimeout(100);
    const a2 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers.find((x) => x.name === "Box"); return { vis: L.visible, op: S.layers[0].opacity, x: Math.round(E.dockers.boxOf(L).x) }; });
    check("...▶ (next): \"Box hidden\" - hidden, half opacity, moved 50 px", a2.vis === false && a2.op === 0.5 && a2.x === 100, a2);
    await ev(() => window.imageEditorInstance.E.undo());
    const a3 = await ev(() => { const S = window.imageEditorInstance.E.S; return { vis: S.layers.find((x) => x.name === "Box").visible, op: S.layers[0].opacity }; });
    check("...undo takes the comp back", a3.vis === true && a3.op === 1, a3);
    const perDoc = await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(100, 100, "other.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 100, 100); }); const n = E.comps.list().length; const id = E.docs.list().find((d) => d.name === "grad.png").id; E.docs.activate(id); return [n, E.comps.list().length]; });
    check("...each document keeps its own comps (a new one has none; back = 2)", perDoc[0] === 0 && perDoc[1] === 2, perDoc);

    /* 5 smart filter blend modes */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      const L = E.makeLayer("Grey", S.w, S.h, "pixel"); const g = L.canvas.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, S.w, S.h); E.addLayer(L, "grey", false);
      E.smart.convert(); const A = E.layer(); A.smart.filters.push({ id: "invert", params: {}, on: true, opacity: 1, blend: "multiply" }); E.smart.render(A); E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(200);
    const mul = await px(200, 100);
    await ev(() => { const it = document.querySelector("#kxLayers .sfitem"); it.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
    await p.waitForTimeout(150);
    const bo = await ev(() => ({ title: document.querySelector(".kxdlg.pcd h4").textContent, modes: document.querySelectorAll("#sfBl option").length, cur: document.getElementById("sfBl").value }));
    await ev(() => { const s = document.getElementById("sfBl"); s.value = "screen"; document.querySelector(".kxdlg.pcd .ok").click(); });
    await p.waitForTimeout(250);
    const scr = await px(200, 100);
    const row = await ev(() => document.querySelector("#kxLayers .sfitem .nm").textContent);
    check("a smart filter's Blending Options: a Mode (24) + Opacity; Invert in Multiply = grey x its inverse (~64), in Screen (~191); the row says the mode",
      /Blending Options/.test(bo.title) && bo.modes === 24 && bo.cur === "multiply" && Math.abs(mul[0] - 64) <= 2 && Math.abs(scr[0] - 191) <= 2 && /screen/.test(row), { bo, mul, scr, row });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
