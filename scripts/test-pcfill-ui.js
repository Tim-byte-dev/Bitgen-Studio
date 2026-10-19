#!/usr/bin/env node
/* bitGen Studio — 2.396.0 in a REAL browser: the image editor's New background, the colour swap (a plain Background
 * takes the new background colour), the swatches, the Paint Bucket button and its Foreground / Background / Gradient
 * fill; every tool in the tool column does something on a drag.
 * Tim (verbatim): "can we do more work on the image editor, start with making the tools in the toolbar functional -
 * when new make the background the color in the background select, when swap with foreground change the background
 * color, add a bucket fill/gradient fill"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the bucket / swap browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const near = (a, b, t) => a && b && a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= (t == null ? 6 : t));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.swapColors, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { localStorage.removeItem("kx.fg"); const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    const lpx = (i, x, y) => ev(([i, x, y]) => Array.from(window.imageEditorInstance.state.layers[i].canvas.getContext("2d").getImageData(x, y, 1, 1).data), [i, x, y]);
    const st = () => ev(() => { const s = window.imageEditorInstance.state; return { w: s.w, h: s.h, n: s.layers.length, tool: s.tool, undo: s.undo.length, fg: s.fg, bg: s.bg, last: (s.undo[s.undo.length - 1] || {}).label }; });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (a, c, steps = 10) => { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps }); await p.mouse.up(); await p.waitForTimeout(200); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(80); };
    const setCols = (fg, bg) => ev(([f, g]) => { const E = window.imageEditorInstance.E; E.setFg(f); E.setBg(g); }, [fg, bg]);

    // the swatches
    const sw = await ev(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }; return { fg: r("kxFg"), bg: r("kxBg"), sx: r("kxSwap"), sd: r("kxDef"), ring: getComputedStyle(document.getElementById("kxFg")).boxShadow }; });
    check("the swatches: 22 px colours, ringed (a dark one shows), ⇄ and ◩ 13 px buttons", sw.fg[0] >= 22 && sw.bg[0] >= 22 && sw.sx[0] >= 13 && sw.sd[0] >= 13 && /154, 145, 127/.test(sw.ring), sw);

    // File ▸ New: the background colour
    await setCols("#000000", "#2050c0");
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    const nd = await ev(() => ({ v: document.querySelector(".kxdlg.pcd #pdBg").value, sw: getComputedStyle(document.getElementById("pdBgSw")).backgroundColor }));
    await p.fill(".kxdlg.pcd #pdW", "300"); await p.fill(".kxdlg.pcd #pdH", "200");
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    check("File ▸ New: Background starts on 'Background colour' (its swatch shown), the new picture is that colour", nd.v === "bg" && nd.sw === "rgb(32, 80, 192)" && near(await lpx(0, 5, 5), [32, 80, 192]) && near(await lpx(0, 295, 195), [32, 80, 192]), [nd, await lpx(0, 5, 5)]);

    // ⇄ swap: the plain Background takes the new background colour
    const u0 = (await st()).undo;
    await p.click("#kxSwap"); await p.waitForTimeout(250);
    let s = await st();
    check("⇄ swap: foreground blue, background black - the plain Background is now black (one undo step)", s.fg === "#2050c0" && s.bg === "#000000" && near(await lpx(0, 150, 100), [0, 0, 0]) && s.undo === u0 + 1 && s.last === "background colour", [s, await lpx(0, 150, 100)]);
    await key("Control+z");
    check("...Ctrl+Z: the Background blue again (the colours stay swapped)", near(await lpx(0, 150, 100), [32, 80, 192]) && (await st()).fg === "#2050c0");
    await key("x");
    s = await st();
    check("X swaps back: fg black, bg blue - the Background (blue) already is the background colour, so nothing to repaint", s.fg === "#000000" && s.bg === "#2050c0" && near(await lpx(0, 150, 100), [32, 80, 192]) && s.undo === u0, s);
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcColor")); await p.waitForTimeout(100);
    await p.click("#pcCSwap"); await p.waitForTimeout(250);
    check("the Color panel's ⇄ does the same (the Background black)", (await st()).bg === "#000000" && near(await lpx(0, 150, 100), [0, 0, 0]));
    // not plain = not repainted
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#e02020"; g.fillRect(0, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); });
    const u1 = (await st()).undo;
    await p.click("#kxSwap"); await p.waitForTimeout(250);
    check("...a Background that is no longer one plain colour is left alone (only the swatches swap)", near(await lpx(0, 10, 10), [224, 32, 32]) && near(await lpx(0, 200, 10), [0, 0, 0]) && (await st()).undo === u1 && (await st()).bg === "#2050c0");

    // the Paint Bucket button
    const tb = await ev(() => [...document.querySelectorAll("#kxTools .ietool")].map((x) => x.dataset.tools));
    check("the tool column: Gradient and Paint Bucket are two buttons", tb.includes("gradient") && tb.includes("fill"), tb);
    await p.click('#kxTools .ietool[data-tools="fill"]'); await p.waitForTimeout(150);
    const op = await ev(() => ({ tool: window.imageEditorInstance.state.tool, src: [...document.querySelectorAll("#pfSrc option")].map((o) => o.value).join(), contig: !!document.getElementById("pfContig"), all: !!document.getElementById("pfAll"), opa: !!document.getElementById("pfOp") }));
    check("...its button picks it; options: Fill (Foreground / Background / Gradient), Tolerance, Contiguous, All layers, Opacity", op.tool === "fill" && op.src === "fg,bg,gradient" && op.contig && op.all && op.opa, op);
    await ev(() => window.imageEditorInstance.E.setTool("rect"));
    await key("g"); const k1 = (await st()).tool; await key("Shift+g"); const k2 = (await st()).tool; await key("Shift+g"); const k3 = (await st()).tool;
    check("G picks the last used of Gradient / Paint Bucket (the bucket, just used); Shift+G cycles between the two", k1 === "fill" && k2 === "gradient" && k3 === "fill", [k1, k2, k3]);

    // bucket: foreground into the red half only (contiguous)
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 300, 200); g.fillStyle = "#e02020"; g.fillRect(0, 0, 100, 200); g.fillRect(200, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); E.deselect(); });
    await p.click('#kxTools .ietool[data-tools="fill"]');
    await setCols("#10c040", "#202020");
    await p.mouse.click(...(await T(50, 100))); await p.waitForTimeout(250);
    check("Fill Foreground: a click fills the connected red area with the foreground - the other red area and the white stay",
      near(await lpx(0, 50, 100), [16, 192, 64]) && near(await lpx(0, 250, 100), [224, 32, 32]) && near(await lpx(0, 150, 100), [255, 255, 255]) && (await st()).last === "fill",
      [await lpx(0, 50, 100), await lpx(0, 250, 100), await lpx(0, 150, 100)]);
    // contiguous off + Background
    await ev(() => { const c = document.getElementById("pfContig"); c.checked = false; c.dispatchEvent(new Event("change")); const s2 = document.getElementById("pfSrc"); s2.value = "bg"; s2.dispatchEvent(new Event("change")); });
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#e02020"; g.fillRect(0, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); });
    await p.mouse.click(...(await T(250, 100))); await p.waitForTimeout(250);
    check("Fill Background, Contiguous off: EVERY red pixel takes the background colour, the white stays",
      near(await lpx(0, 50, 100), [32, 32, 32]) && near(await lpx(0, 250, 100), [32, 32, 32]) && near(await lpx(0, 150, 100), [255, 255, 255]), [await lpx(0, 50, 100), await lpx(0, 250, 100)]);
    await ev(() => { const c = document.getElementById("pfContig"); c.checked = true; c.dispatchEvent(new Event("change")); });
    // Gradient: click = top -> bottom of the clicked area (the white middle band)
    await ev(() => { const s2 = document.getElementById("pfSrc"); s2.value = "gradient"; s2.dispatchEvent(new Event("change")); });
    await setCols("#000000", "#ffffff");
    await ev(() => { const S = window.imageEditorInstance.E.S; S.gradKind = "fgbg"; S.gradType = "linear"; S.gradRev = false; });
    const hint = await ev(() => !!document.querySelector("#kxOpts .pfhint"));
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(100, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); });
    await p.mouse.click(...(await T(150, 100))); await p.waitForTimeout(300);
    const gtop = await lpx(0, 150, 3), gmid = await lpx(0, 150, 100), gbot = await lpx(0, 150, 196), gout = await lpx(0, 50, 100);
    check("Fill Gradient, a click: the white area gets the foreground → background gradient top to bottom - only that area",
      hint && gtop[0] < 25 && Math.abs(gmid[0] - 128) < 25 && gbot[0] > 230 && near(gout, [32, 32, 32]) && (await st()).last === "gradient fill", [hint, gtop, gmid, gbot, gout]);
    // Gradient: a drag sets the direction (left -> right), radial off
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(100, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); });
    await drag(await T(100, 100), await T(199, 100));
    const gl = await lpx(0, 103, 50), gr = await lpx(0, 196, 150), gm = await lpx(0, 150, 20);
    check("Fill Gradient, a drag: left → right across the area (the drag's direction)", gl[0] < 25 && gr[0] > 230 && Math.abs(gm[0] - 128) < 25 && near(await lpx(0, 250, 100), [32, 32, 32]), [gl, gm, gr]);
    // Opacity 50 %
    await ev(() => { const s2 = document.getElementById("pfSrc"); s2.value = "fg"; s2.dispatchEvent(new Event("change")); const o = document.getElementById("pfOpN"); o.value = "50"; o.dispatchEvent(new Event("change")); });
    await setCols("#000000", "#ffffff");
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(100, 0, 100, 200); E.S.layers[0].ver++; E.refresh(); });
    await p.mouse.click(...(await T(150, 100))); await p.waitForTimeout(250);
    check("Opacity 50 %: black over white = mid grey", near(await lpx(0, 150, 100), [128, 128, 128], 10), await lpx(0, 150, 100));
    await ev(() => { const o = document.getElementById("pfOpN"); o.value = "100"; o.dispatchEvent(new Event("change")); });
    // inside a selection: the selection is filled
    await ev(() => { const E = window.imageEditorInstance.E; E.changeSel(E.P.rectMask(110, 10, 140, 40, 300, 200), "t"); });
    await setCols("#ff00ff", "#ffffff");
    await p.mouse.click(...(await T(120, 20))); await p.waitForTimeout(250);
    check("a click inside a selection fills the selection (not past it)", near(await lpx(0, 120, 20), [255, 0, 255]) && !near(await lpx(0, 150, 60), [255, 0, 255]), [await lpx(0, 120, 20), await lpx(0, 150, 60)]);
    await ev(() => window.imageEditorInstance.E.deselect());

    // every tool in the column does something on a drag (the ones that need a step first say so)
    const tools = await ev(() => [...document.querySelectorAll("#kxTools .ietool")].map((x) => x.dataset.tools).join(",").split(","));
    const sig = () => ev(() => { const s = window.imageEditorInstance.state, c = document.getElementById("ieCanvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 53) h = (h * 31 + d[i]) >>> 0;
      return JSON.stringify([h, s.selCount, s.layers.length, s.undo.length, s.zoom, s.panX, s.panY, s.fg, s.layers.map((l) => l.ver).join()]) + "|" + document.getElementById("ieStatus").textContent; });
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#30a030"; g.fillRect(0, 0, 150, 200); g.fillStyle = "#ffffff"; g.fillRect(100, 50, 100, 100); E.S.layers[0].ver++; E.refresh(); E.deselect(); });
    const dead = [];
    for (const t of tools) {
      await ev((t) => { const E = window.imageEditorInstance.E; E.deselect(); E.setTool(t); }, t); await p.waitForTimeout(80);
      const a = await sig();
      await drag(await T(60, 60), await T(220, 150));
      if (t === "poly") { await p.mouse.click(...(await T(60, 150))); await p.mouse.dblclick(...(await T(200, 60))); }
      if (t === "type") { await p.keyboard.type("Hi"); await p.keyboard.press("Escape"); }
      if (t === "crop") { await p.keyboard.press("Enter"); }
      await p.waitForTimeout(250);
      if (a === await sig()) dead.push(t);
      if (t === "crop") await key("Control+z");
    }
    check("every tool in the column does something on a drag (or says what it needs first)", dead.length === 0 && tools.length === 92, { dead, n: tools.length });   // 2.463.0: + 9 sketch tools; 2.462.0: + the 8 sketch tools; 2.458.0: + the Chain Dimension tool; 2.447.0: + the Artboard tool; 2.428.0: + the F6 shape tools, Artistic Media, the F8 dimension / connector tools; 2.425.0: + the Curvature Pen, the F5 curve tools, the F10 Shape tool; 2.397.0: + Vertical Type, Type on a Path; 2.421.0: + the pen tools, path selection, custom shape
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { if (document.body.classList.contains("ie-full")) window.imageEditorInstance.E.setFull(false); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
