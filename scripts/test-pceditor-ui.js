#!/usr/bin/env node
/* bitGen Studio — 2.389.0 THE PHOTOSHOP-STYLE IMAGE EDITOR in a REAL browser.
 * Tim: "can we build our image editor to have the same functionality and look as https://github.com/storytold/photocraft"
 * ("Rebuild ours, in phases"). Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP.
 *   the layout (menu bar, tools, panels) · File ▸ New · an adjustment layer (non-destructive, its mask, live settings,
 *   inside a pass-through / normal group) · clipping · layer styles · Type / Shape / Gradient / Crop / Free Transform /
 *   Clone Stamp / Spot Healing / Dodge tools with the pointer and Photoshop's keys · Quick Mask · Image Size · the
 *   History panel · the command palette · Export As · themes · Flatten */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the editor's Photoshop browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const near = (a, b, t) => a && b && a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= (t == null ? 8 : t));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    const ev = (f, a) => p.evaluate(f, a);
    const E = "window.imageEditorInstance.E";
    const px = (x, y) => ev(([x, y]) => Array.from(document.getElementById("ieCanvas").getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const lpx = (i, x, y) => ev(([i, x, y]) => Array.from(window.imageEditorInstance.state.layers[i].canvas.getContext("2d").getImageData(x, y, 1, 1).data), [i, x, y]);
    const st = async () => ev(() => { const s = window.imageEditorInstance.state; return { w: s.w, h: s.h, n: s.layers.length, active: s.active, tool: s.tool, undo: s.undo.length, sel: s.selCount, types: s.layers.map((l) => l.type).join(",") }; });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (a, c, steps = 12, mods) => { if (mods) await p.keyboard.down(mods); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps }); await p.mouse.up(); if (mods) await p.keyboard.up(mods); await p.waitForTimeout(150); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(80); };
    const menu = async (menuName, cmdId, subs) => {
      await p.click(`#pcMenus .mi[data-menu="${menuName}"]`); await p.waitForTimeout(120);
      for (const s of subs || []) { await p.hover(`.kxmenu div.sub:text-is("${s}")`); await p.waitForTimeout(120); }
      await p.click(`.kxmenu [data-cmd="${cmdId}"]`); await p.waitForTimeout(150);
    };

    // the layout
    const lay = await ev(() => ({ menus: [...document.querySelectorAll("#pcMenus .mi")].map((m) => m.textContent).join(","), tools: [...document.querySelectorAll("#kxTools .ietool")].map((b) => b.dataset.tools).join("|"),
      tabs: [...document.querySelectorAll(".pctabs button[data-tab]")].map((b) => b.dataset.tab).join(","), theme: document.querySelector(".kx").dataset.theme }));
    check("the Photoshop layout: 9 menus, the tool column's 21 buttons (39 tools - 2.390.0: + Object Selection; 2.396.0: the Paint Bucket its own; 2.397.0: + Vertical Type, Type on a Path; 2.421.0: + the Pen group, Path / Direct Selection, Custom Shape), the three panel groups (+ Paths)", lay.menus === "File,Edit,Image,Layer,Select,Filter,View,Window,Help"
      && lay.tools.split("|").length === 26 && lay.tools.split(/[|,]/).length === 97 && lay.tools.startsWith("move,artboard|") &&   /* 2.484.0: + the 🖌 Brush tab; 2.483.0: + Color Sampler, Ruler, Note, Count, Perspective Crop + the Navigator / Histogram / Info / Notes tabs; 2.458.0: + the Chain Dimension tool; 2.447.0: + the Artboard tool */ lay.tools.includes("type,vtype,typepath") && lay.tabs === "pcColor,pcSwatches,pcChar,pcPara,pcNav,pcHist,pcInfo,pcNotes,dkXf,dkShape,dkAlign,dkProps,pcProps,pcAdjs,pcBrush,kxAi,kxCtl,k3d,ksk,kbody,kue,kuecam,kuelights,pcLayers,pcPaths,pcChannels,pcHistory,pcActions,pcComps", lay);

    // File ▸ New
    await menu("File", "file.new");
    await p.fill(".kxdlg.pcd #pdW", "400"); await p.fill(".kxdlg.pcd #pdH", "300"); await p.selectOption(".kxdlg.pcd #pdBg", "white");
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    let s = await st();
    check("File ▸ New: 400 × 300, white", s.w === 400 && s.h === 300 && s.n === 1 && near(await px(10, 10), [255, 255, 255]), s);
    await ev(() => { const E = window.imageEditorInstance.E, g = E.S.layers[0].canvas.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 400, 300); g.fillStyle = "#e02020"; g.fillRect(150, 100, 60, 60); E.S.layers[0].ver++; E.refresh(); E.renderLayersPanel(); });
    const blue = [48, 96, 192];

    // an adjustment layer
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcAdjs"));
    await p.click('.pcadj[data-adj="invert"]'); await p.waitForTimeout(200);
    s = await st();
    check("Adjustments ▸ Invert: an adjustment layer - the composite is inverted, the pixels below are not", s.types === "pixel,adjust" && near(await px(10, 10), [207, 159, 63]) && near(await lpx(0, 10, 10), blue), [s, await px(10, 10)]);
    await p.click('#kxLayers .kxlayer[data-i="1"] .eye'); await p.waitForTimeout(120);
    check("...hidden (👁): the picture as it was", near(await px(10, 10), blue));
    await p.click('#kxLayers .kxlayer[data-i="1"] .eye'); await p.waitForTimeout(120);
    // its mask: black inside a selection = not inverted there
    await ev(() => { const E = window.imageEditorInstance.E; E.changeSel(E.P.rectMask(0, 0, 100, 300, 400, 300), "t"); E.setActive(1, true); E.fillSelection("#000000"); E.deselect(); });
    check("...its mask: painted black on the left = not inverted there, still inverted on the right", near(await px(10, 10), blue) && near(await px(300, 10), [207, 159, 63]), [await px(10, 10), await px(300, 10)]);
    // live settings in Properties: brightness
    await ev(() => window.imageEditorInstance.E.newAdjust("brightness"));
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps"));
    const u0 = (await st()).undo;
    await ev(() => { const r = document.querySelector('#ppParams input[type=range][data-p="brightness"]'); r.value = 100; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(200);
    const br = await px(10, 10);
    check("Properties: a Brightness / Contrast layer's slider re-renders live - one undo step", br[2] > 240 && br[0] > 120 && (await st()).undo === u0 + 1, [br, (await st()).undo - u0]);
    await key("Control+z"); await p.waitForTimeout(150);
    check("...Ctrl+Z puts the setting back", near(await px(10, 10), blue), await px(10, 10));
    await ev(() => window.imageEditorInstance.E.deleteLayer());     // the brightness layer
    // groups: an Invert inside a group - pass-through reaches the picture below, Normal does not
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(1); E.groupActive(); });
    s = await st();
    check("Ctrl+G groups it; the group passes through - the invert still reaches the picture", s.types === "pixel,adjust,group" && near(await px(300, 10), [207, 159, 63]), s);
    await ev(() => { const E = window.imageEditorInstance.E; E.structOp("blend", () => { E.layer().blend = "normal"; }); });
    check("...a Normal group is composited on its own - its adjustment no longer reaches below", near(await px(300, 10), blue), await px(300, 10));
    await ev(() => { const E = window.imageEditorInstance.E; E.ungroupActive(); E.setActive(1); E.deleteLayer(); E.setActive(0); });
    // clipping
    await ev(() => {
      const E = window.imageEditorInstance.E;
      const a = E.makeLayer("Base"); a.canvas.getContext("2d").fillStyle = "#00ff00"; a.canvas.getContext("2d").fillRect(20, 20, 40, 40); E.addLayer(a);
      const c = E.makeLayer("Clip"); c.canvas.getContext("2d").fillStyle = "#ffff00"; c.canvas.getContext("2d").fillRect(0, 0, 400, 300); E.addLayer(c); E.toggleClip();
    });
    check("Create Clipping Mask: the layer shows only where the one below has pixels", near(await px(30, 30), [255, 255, 0]) && near(await px(100, 30), blue), [await px(30, 30), await px(100, 30)]);
    // layer styles
    await ev(() => { const E = window.imageEditorInstance.E; E.deleteLayer(); E.setLayer(E.layer(), "fx", (L) => { L.styles = { stroke: { on: true, size: 4, color: "#ff00ff", opacity: 1, position: "outside" }, shadow: { on: true, color: "#000000", opacity: 1, angle: 90, distance: 20, size: 0 } }; }); });
    check("layer styles: an outside stroke around the pixels, a drop shadow under them", near(await px(18, 40), [255, 0, 255], 30) && near(await px(40, 75), [0, 0, 0], 30) && near(await px(40, 40), [0, 255, 0]),
      [await px(18, 40), await px(40, 75)]);
    const fxRow = await ev(() => !!document.querySelector('#kxLayers .kxlayer.on .fx'));
    check("...the Layers panel marks it fx", fxRow);

    // Type tool (T): click, type, Esc
    await key("t");
    await p.mouse.click(...(await T(200, 220))); await p.waitForTimeout(200);
    await p.keyboard.type("Hi"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    const tl = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { type: L.type, str: L.text && L.text.str, x: L.text && Math.round(L.text.x) }; });
    check("Type (T): a click makes a text layer, typing fills it, Esc commits", tl.type === "text" && tl.str === "Hi" && tl.x === 200, tl);
    // Shape tool (U)
    await key("u");
    await drag(await T(260, 20), await T(360, 80));
    const sh = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { type: L.type, shape: L.shape && [L.shape.kind, L.shape.x, L.shape.y, L.shape.w, L.shape.h] }; });
    check("Shape (U): a drag makes a shape layer (rectangle, its box)", sh.type === "shape" && sh.shape.join() === "rect,260,20,100,60", sh);
    // Gradient (G) on a new layer
    await ev(() => { const E = window.imageEditorInstance.E; E.setFg("#000000"); E.setBg("#ffffff"); E.newLayer(); });
    await key("g");
    check("G = Gradient", (await st()).tool === "gradient");
    await drag(await T(0, 150), await T(399, 150), 8);
    const ga = await ev(() => { const s = window.imageEditorInstance.state, g = s.layers[s.active].canvas.getContext("2d"); return [Array.from(g.getImageData(2, 150, 1, 1).data), Array.from(g.getImageData(396, 150, 1, 1).data), Array.from(g.getImageData(200, 150, 1, 1).data)]; });
    check("...a drag lays a foreground → background gradient", ga[0][0] < 20 && ga[1][0] > 235 && Math.abs(ga[2][0] - 128) < 30, ga);
    await ev(() => window.imageEditorInstance.E.deleteLayer());
    // Shift+G cycles to the paint bucket; M / Shift+M; I = eyedropper
    await key("Shift+g"); const t1 = (await st()).tool; await key("m"); const t2 = (await st()).tool; await key("Shift+m"); const t3 = (await st()).tool; await key("i"); const t4 = (await st()).tool;
    check("Photoshop's keys: Shift+G cycles to the Paint Bucket, M marquee, Shift+M ellipse, I eyedropper", t1 === "fill" && t2 === "rect" && t3 === "ellipse" && t4 === "picker", [t1, t2, t3, t4]);
    // Clone Stamp (S)
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.setSize(16); });
    await key("s");
    await p.keyboard.down("Alt"); await p.mouse.click(...(await T(180, 130))); await p.keyboard.up("Alt");
    await drag(await T(320, 200), await T(330, 200), 4);
    check("Clone Stamp (S): Alt-click the red, paint on the blue - red appears", (await lpx(0, 325, 200))[0] > 150 && (await lpx(0, 325, 200))[2] < 120, await lpx(0, 325, 200));
    // Spot Healing (J) on a speck
    await ev(() => { const L = window.imageEditorInstance.state.layers[0], g = L.canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(98, 248, 5, 5); });
    await key("j");
    await drag(await T(96, 250), await T(104, 250), 4);
    const sp = await lpx(0, 100, 250);
    check("Spot Healing (J): the white speck is filled from around it", sp[0] < 140 && sp[2] > 120, sp);
    // Dodge (O)
    const before = await lpx(0, 60, 200);
    await key("o"); await ev(() => { window.imageEditorInstance.E.setSize(40); window.imageEditorInstance.state.toolStr = 100; });
    for (let k = 0; k < 4; k++) await drag(await T(40, 200), await T(80, 200), 6);
    const after = await lpx(0, 60, 200);
    check("Dodge (O): strokes lighten", after[2] > before[2] + 10, [before, after]);
    // Quick Mask
    await key("q");
    const qm = await ev(() => !!window.imageEditorInstance.state.qm);
    await ev(() => window.imageEditorInstance.E.setSize(30));
    await drag(await T(250, 150), await T(300, 150), 8);
    await key("q");
    s = await st();
    check("Quick Mask (Q): paint the selection, Q again makes it the selection (one step)", qm && s.sel > 1000 && s.sel < 5000, s);
    await key("Control+d");
    // Crop (C) + Enter
    await key("c");
    await drag(await T(50, 40), await T(350, 240));
    await p.locator("#ieStage").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    s = await st();
    check("Crop (C): a box, Enter crops every layer to it", s.w === 300 && s.h === 200, s);
    await key("Control+z"); s = await st();
    check("...Ctrl+Z uncrops", s.w === 400 && s.h === 300, s);
    // Free Transform (Ctrl+T) on the green square: W 200 %
    await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((l) => l.name === "Base"); E.setActive(i); E.setLayer(E.layer(), "no fx", (L) => { L.styles = null; }); });
    await key("Control+t");
    check("Ctrl+T: Free Transform", (await st()).tool === "transform");
    await p.fill("#ptXw", "200"); await p.dispatchEvent("#ptXw", "change"); await p.waitForTimeout(120);
    await p.locator("#ieStage").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    const tr = await ev(() => { const E = window.imageEditorInstance.E; return E.alphaBox(E.layer().canvas); });
    check("...W 200 % and Enter: the square is twice as wide about its centre", tr && tr.w >= 79 && tr.w <= 81 && tr.x >= -1 && tr.x <= 1 && tr.h === 40, tr);
    // Image ▸ Image Size 50 %
    await menu("Image", "image.size");
    await p.fill(".kxdlg.pcd #pdPct", "50"); await p.dispatchEvent(".kxdlg.pcd #pdPct", "input"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    s = await st();
    check("Image ▸ Image Size 50 %: 200 × 150, the text layer scaled with it", s.w === 200 && s.h === 150 && await ev(() => window.imageEditorInstance.state.layers.find((l) => l.type === "text").text.size === 24), s);
    // History panel
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcHistory"));
    const hn = await ev(() => document.querySelectorAll("#pcHistory [data-h]").length);
    await p.click('#pcHistory [data-h="0"]'); await p.waitForTimeout(300);
    s = await st();
    check("History: every step listed; a click on the first goes back to the new document", hn > 15 && s.undo === 0 && s.n === 1 && s.w === 400, [hn, s]);
    await p.click(`#pcHistory [data-h="${hn - 1}"]`); await p.waitForTimeout(300);
    s = await st();
    check("...and a click on the last comes forward again", s.w === 200 && s.undo === hn - 1, s);
    // the command palette
    await key("Control+k");
    await p.fill(".kxdlg.pcd #pdQ", "gaussian"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    const gd = await ev(() => { const h = [...document.querySelectorAll(".kxdlg h4")].map((x) => x.textContent); return h; });
    check("Ctrl+K: the command palette finds Filter ▸ Blur ▸ Gaussian Blur and runs it", gd.includes("Gaussian Blur"), gd);
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg")].find((x) => /Gaussian/.test(x.textContent)); if (d) d.querySelector(".cn").click(); });
    // Export As
    await menu("File", "file.export"); await p.waitForTimeout(600);
    const exInfo = await ev(() => document.querySelector(".kxdlg.pcd #pdInfo").textContent);
    await p.selectOption(".kxdlg.pcd #pdF", "jpeg"); await p.waitForTimeout(600);
    const exJ = await ev(() => document.querySelector(".kxdlg.pcd #pdInfo").textContent);
    check("Export As: the preview and the file's size, per format", /200 × 150 px · PNG · \d+ KB/.test(exInfo) && /JPEG/.test(exJ), [exInfo, exJ]);
    await p.click(".kxdlg.pcd .cn");
    // themes
    await menu("Window", "theme.studio", ["Theme"]);
    check("Window ▸ Theme ▸ Studio (light)", await ev(() => document.querySelector(".kx").dataset.theme) === "studio");
    await menu("Window", "theme.pro", ["Theme"]);
    // flatten
    await menu("Layer", "layer.flatten");
    s = await st();
    check("Layer ▸ Flatten Image: one Background layer", s.n === 1 && s.types === "pixel", s);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await p.evaluate(() => { if (document.fullscreenElement) document.exitFullscreen(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
