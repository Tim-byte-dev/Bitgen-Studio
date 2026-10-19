#!/usr/bin/env node
/* bitGen Studio — 2.397.0 in a REAL browser: the image editor's text along a path, vertical type, warp / circle / 3D
 * text, the new layer styles (Bevel & Emboss, Satin, Pattern Overlay, blend modes, the Styles presets) and the new
 * filters (Lens Flare, Swirl, Drop Shadow, 3D Extrude).
 * Tim (verbatim): "yes please add the text tool improvements, like text along a path , add the filters like lense
 * flare, swirl,drop shadow, 3d text and the overlay styles"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the type / styles / filters browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.textShapeDialog && window.PCStyles, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#000000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, t: L && L.text ? JSON.parse(JSON.stringify(L.text)) : null, styles: L && L.styles ? Object.keys(L.styles).filter((k) => L.styles[k].on) : [] }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const ink = (x0, y0, x1, y1) => ev(([a, b, c, d]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b, c - a, d - b).data; let n = 0; for (let i = 3; i < D.length; i += 4) if (D[i] > 40) n++; return n; }, [x0, y0, x1, y1]);
    const flat = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(80); };

    // 1 the T group
    await key("t"); const k1 = (await st()).tool; await key("Shift+t"); const k2 = (await st()).tool; await key("Shift+t"); const k3 = (await st()).tool;
    check("the T button holds Horizontal Type, Vertical Type and Type on a Path; Shift+T cycles them", k1 === "type" && k2 === "vtype" && k3 === "typepath", [k1, k2, k3]);

    // 2 Type on a Path: drag a curve, type
    const pts = []; for (let i = 0; i <= 16; i++) pts.push(await T(60 + i * 30, 300 - Math.sin(i / 16 * Math.PI) * 180));
    await p.mouse.move(...pts[0]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...q, { steps: 2 }); await p.mouse.up(); await p.waitForTimeout(300);
    await p.keyboard.type("ALONG THE CURVE"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(300);
    let s = await st();
    check("Type on a Path: a dragged line becomes a text layer whose letters follow it (path points kept, relative to the text)",
      s.type === "text" && s.t.str === "ALONG THE CURVE" && s.t.path && s.t.path.kind === "curve" && s.t.path.pts.length >= 3 && s.t.path.pts[0][0] === 0 && s.t.x === 60, s.t);
    const top = await ink(250, 70, 380, 140), flatLine = await ink(150, 280, 450, 310);
    check("...the letters sit on the arch (ink near its top, none on the straight line below)", top > 150 && flatLine < 40, { top, flatLine });
    // reshape: drag the middle point down
    const L1 = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { x: L.text.x, y: L.text.y, pts: L.text.path.pts }; });
    const mid = L1.pts[Math.floor(L1.pts.length / 2)], u0 = (await st()).undo;
    await p.mouse.move(...await T(L1.x + mid[0], L1.y + mid[1])); await p.mouse.down(); await p.mouse.move(...await T(L1.x + mid[0], L1.y + mid[1] + 80), { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    s = await st();
    const mid2 = s.t.path.pts[Math.floor(L1.pts.length / 2)];
    check("...dragging a point of the path reshapes it (one undo step)", Math.abs(mid2[1] - (mid[1] + 80)) < 4 && s.undo === u0 + 1, { mid, mid2, undo: s.undo, u0 });
    // the Type tool clicking BELOW the curve (inside its box) makes a NEW text, not an edit of the path text
    await ev(() => window.imageEditorInstance.E.setTool("type"));   // T picks the group's CURRENT tool (Type on a Path now), like Photoshop
    const n0 = (await st()).n;
    await p.mouse.click(...await T(300, 260)); await p.waitForTimeout(200); await p.keyboard.type("Plain"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(200);
    s = await st();
    check("a path text is hit on its letters only - a click inside its box makes a new text", s.n === n0 + 1 && s.t.str === "Plain" && !s.t.path, { n: s.n, n0, t: s.t && s.t.str });

    // 3 toggles + the Shape dialog on "Plain"
    await p.click('#pcOpts .pttog[data-tg="caps"]').catch(async () => { await ev(() => document.querySelector('.pttog[data-tg="caps"]').click()); }); await p.waitForTimeout(200);
    s = await st();
    check("the options bar's TT makes the text all caps (U̲ S̶ ↕T beside it)", s.t.caps === true && (await ev(() => document.querySelectorAll(".pttog").length)) === 4, s.t);
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); E.setLayer(L, "size", (x) => { x.text.size = 60; x.text.weight = 700; x.text.x = 200; x.text.y = 200; x.text.color = "#2040c0"; }); });
    const before = await ink(0, 0, 600, 400);
    await ev(() => window.imageEditorInstance.E.textShapeDialog()); await p.waitForTimeout(200);
    await p.selectOption(".kxdlg.pcd #tsMode", "warp"); await p.selectOption(".kxdlg.pcd #tsWS", "arc"); await p.fill(".kxdlg.pcd #tsWBn", "80"); await p.dispatchEvent(".kxdlg.pcd #tsWBn", "change"); await p.waitForTimeout(250);
    const warpTop = await ink(200, 160, 420, 200);
    check("⌒ Shape ▸ Warp Arc lifts the middle of the word (live)", (await st()).t.warp && (await st()).t.warp.style === "arc" && warpTop > 20, warpTop);
    await ev(() => { const c = document.querySelector(".kxdlg.pcd #ts3"); c.checked = true; c.dispatchEvent(new Event("change")); }); await p.fill(".kxdlg.pcd #ts3Dn", "16"); await p.dispatchEvent(".kxdlg.pcd #ts3Dn", "change"); await p.waitForTimeout(250);
    const with3d = await ink(0, 0, 600, 400);
    check("...3D extrudes the letters (more ink, down to the right)", (await st()).t.extrude && (await st()).t.extrude.on && with3d > before * 1.3, { before, with3d });
    await p.click(".kxdlg.pcd .cn"); await p.waitForTimeout(250);
    s = await st();
    check("...Cancel puts the text back as it was", !s.t.warp && !s.t.extrude && Math.abs((await ink(0, 0, 600, 400)) - before) < before * 0.05, s.t);
    await ev(() => window.imageEditorInstance.E.textShapeDialog()); await p.waitForTimeout(200);
    await p.selectOption(".kxdlg.pcd #tsMode", "circle"); await p.fill(".kxdlg.pcd #tsCRn", "120"); await p.dispatchEvent(".kxdlg.pcd #tsCRn", "change"); await p.waitForTimeout(200);
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    s = await st();
    check("...Round a circle: the text on a circle (radius 120), OK = one undo step", s.t.path && s.t.path.kind === "circle" && s.t.path.r === 120 && /text shape/.test(await ev(() => { const u = window.imageEditorInstance.state.undo; return u[u.length - 1].label; })), s.t.path);

    // 4 Vertical Type
    await ev(() => window.imageEditorInstance.E.setTool("vtype"));
    await p.mouse.click(...await T(560, 30)); await p.waitForTimeout(200); await p.keyboard.type("ABC"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(200);
    s = await st();
    const vb = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return window.PCDoc.textBox(L.text, L.canvas.getContext("2d")); });
    check("Vertical Type: one letter under the next (the box taller than wide)", s.t.vertical === true && vb.h > vb.w * 2, vb);

    // 5 Layer styles on a shape: bevel, presets, pattern
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = window.PCDoc; const L = E.makeLayer("Box", S.w, S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 100, y: 100, w: 200, h: 150, fill: "#808080" }); D.rasterize(L); E.addLayer(L, "box", false); E.refresh(); });
    const plainTop = await flat(200, 103), plainBot = await flat(200, 246);
    await ev(() => window.imageEditorInstance.E.ui.dlgStyle("bevel")); await p.waitForTimeout(200);
    const fields = await ev(() => [...document.querySelectorAll(".kxdlg.pcd #psRight [data-sk]")].map((e) => e.dataset.sk));
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const bTop = await flat(200, 103), bBot = await flat(200, 246);
    check("Layer Style ▸ Bevel & Emboss (its 11 settings): the top edge lit, the bottom edge shaded", fields.length === 11 && bTop[0] > plainTop[0] + 15 && bBot[0] < plainBot[0] - 15, { fields, plainTop, bTop, bBot });
    const kinds = await ev(() => [...document.querySelectorAll("#pcMenus")].length && window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Layer")[1].find((x) => x && x.label === "Layer Style").items.filter((x) => typeof x === "string" && /^style\./.test(x) && !/copy|paste|clear/.test(x)));
    check("Layer ▸ Layer Style lists all 10 (Bevel & Emboss … Satin … Pattern Overlay … Drop Shadow)", kinds.length === 10 && kinds[0] === "style.bevel" && kinds.includes("style.satin") && kinds.includes("style.patternOverlay"), kinds);
    await ev(() => window.imageEditorInstance.E.ui.dlgStyle()); await p.waitForTimeout(200);
    await p.selectOption(".kxdlg.pcd #psPreset", "Gold"); await p.waitForTimeout(300);
    const gold = await flat(200, 175);
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    s = await st();
    check("Styles ▸ Gold: its styles on (gradient overlay, bevel, drop shadow), the box gold", ["gradientOverlay", "bevel", "shadow"].every((k) => s.styles.includes(k)) && gold[0] > gold[2] + 40, { styles: s.styles, gold });
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), D = window.PCDoc; E.setLayer(L, "pattern", (x) => { x.styles = { patternOverlay: Object.assign({}, D.STYLE_DEFAULTS.patternOverlay, { on: true, pattern: "stripes", c1: "#ff0000", c2: "#0000ff", scale: 200 }) }; }); });
    const pa = await flat(150, 110), pb = await flat(150, 126);
    check("Pattern Overlay (stripes, red / blue) fills the shape in the pattern", (pa[0] > 200 && pb[2] > 200) || (pa[2] > 200 && pb[0] > 200), { pa, pb });
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), D = window.PCDoc; E.setLayer(L, "multiply", (x) => { x.styles = { colorOverlay: Object.assign({}, D.STYLE_DEFAULTS.colorOverlay, { on: true, color: "#ff8080", blend: "multiply" }) }; }); });
    const mu = await flat(200, 175);
    check("a Color Overlay in Multiply darkens the grey by the colour (128 x 1.0, 128 x 0.5)", Math.abs(mu[0] - 128) < 8 && Math.abs(mu[1] - 64) < 8, mu);

    // 6 the filters
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers[0], g = L.canvas.getContext("2d"); g.fillStyle = "#203040"; g.fillRect(0, 0, L.canvas.width, L.canvas.height); L.ver++; E.setActive(0); E.refresh(); });
    await p.click('#pcMenus .mi[data-menu="Filter"]'); await p.waitForTimeout(150);
    const subs = await ev(() => [...document.querySelectorAll(".kxmenu div")].map((d) => d.textContent.trim()));
    await ev(() => window.imageEditorInstance.E.ui.closeMenus());   // (not Esc: with nothing to escape it leaves full screen)
    check("the Filter menu has Render / Distort / Stylize (Lens Flare, Swirl, Drop Shadow, 3D Extrude live there)", ["Render", "Distort", "Stylize"].every((n) => subs.some((t) => t.startsWith(n))), subs);
    const bg0 = await flat(180, 120);
    await ev(() => { localStorage.removeItem("kx.fx.lensflare"); window.imageEditorInstance.E.openFilter("lensflare"); }); await p.waitForTimeout(400);
    const cpt = await T(150, 300);
    await p.mouse.click(...cpt); await p.waitForTimeout(400);   // clear of the dialog (top right)
    const cxy = await ev(() => ({ cx: document.querySelector('.kxdlg [data-n="cx"]').value, cy: document.querySelector('.kxdlg [data-n="cy"]').value, hint: !!document.querySelector(".kxdlg .fxpick") }));
    check("Lens Flare: a click on the picture puts the flare's centre there (25 % / 75 %)", cxy.cx === "25" && cxy.cy === "75" && cxy.hint, cxy);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(500);
    const lf = await ev(() => { const s = window.imageEditorInstance.state, d = s.layers[0].canvas.getContext("2d"); return { c: Array.from(d.getImageData(150, 300, 1, 1).data), far: Array.from(d.getImageData(590, 10, 1, 1).data) }; });
    check("Filter ▸ Render ▸ Lens Flare on the Background: white-hot at the clicked centre, the far corner less so", lf.c[0] > 240 && lf.c[2] > 240 && lf.far[2] < 200, { bg0, lf });
    await key("Control+z");
    const und = await ev(() => Array.from(window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(150, 300, 1, 1).data));
    check("...Ctrl+Z takes it off", und[0] === 0x20 && und[1] === 0x30 && und[2] === 0x40, und);
    // drop shadow / 3D extrude / swirl on a text rasterized to pixels
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = window.PCDoc; const L = E.makeLayer("px", S.w, S.h, "text"); L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "XX", size: 60, weight: 700, color: "#ff0000", x: 40, y: 300 }); D.rasterize(L); E.addLayer(L, "px", false); E.rasterizeLayer(false); E.refresh(); });
    const inkA = await ink(0, 0, 600, 400);
    for (const id of ["dropshadow", "extrude3d"]) { await ev((id) => window.imageEditorInstance.E.openFilter(id), id); await p.waitForTimeout(350); await p.click(".kxdlg .ok"); await p.waitForTimeout(400); }
    const inkB = await ink(0, 0, 600, 400), lastTwo = await ev(() => window.imageEditorInstance.state.undo.slice(-2).map((u) => u.label));
    check("Stylize ▸ Drop Shadow then 3D Extrude on a layer's pixels: more ink (a shadow, the sides), two undo steps", inkB > inkA * 1.4 && lastTwo.join() === "Drop Shadow,3D Extrude", { inkA, inkB, lastTwo });
    await ev(() => window.imageEditorInstance.E.openFilter("swirl")); await p.waitForTimeout(350);
    const swDlg = await ev(() => [...document.querySelectorAll(".kxdlg [data-p]")].map((e) => e.dataset.p));
    await p.click(".kxdlg .ok"); await p.waitForTimeout(400);
    check("Distort ▸ Swirl: its settings (strength, radius, centre, falloff), applied", swDlg.join() === "angle,radius,cx,cy,falloff" && (await ev(() => { const u = window.imageEditorInstance.state.undo; return u[u.length - 1].label; })) === "Swirl", swDlg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await p.evaluate(() => { document.body.classList.remove("ie-full"); if (document.fullscreenElement) document.exitFullscreen(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
