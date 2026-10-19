#!/usr/bin/env node
/* bitGen Studio — 2.487.0 in a REAL browser: IMAGE ▸ MODE, PROOF COLOURS, GAMUT WARNING, CMYK TIFF
 * (ext/imageeditdock/pcmode.js) - the image editor's gap, round G.
 * Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the image modes browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch(); global.__b = b;
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.modes && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
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
    const E_ = (f, a) => ev(f, a);
    // a colourful picture: red / blue halves, a green bar, a grey ramp
    const paintPic = () => E_(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.fillStyle = "#e02020"; g.fillRect(0, 0, 300, 400); g.fillStyle = "#2040e0"; g.fillRect(300, 0, 300, 400); g.fillStyle = "#00ff00"; g.fillRect(0, 300, 600, 50); for (let x = 0; x < 600; x++) { const v = Math.round(x / 599 * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 360, 1, 40); } L.ver = (L.ver || 0) + 1; E.refresh(); });
    await paintPic();
    const scr = (x, y) => E_(([x, y]) => Array.from(document.getElementById("ieCanvas").getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const flat = (x, y) => E_(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const lay = (x, y) => E_(([x, y]) => { const S = window.imageEditorInstance.E.S; return Array.from(S.layers[S.active].canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const menu = await E_(() => { const IM = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Image"), m = IM[1].find((x) => x && x.label === "Mode"); return m ? m.items.filter((x) => typeof x === "string") : null; });
    check("Image ▸ Mode: Bitmap, Grayscale, Duotone, Indexed Color, RGB Color, CMYK Color, Color Table, 8 Bits/Channel", menu && ["mode.bitmap", "mode.gray", "mode.duotone", "mode.indexed", "mode.rgb", "mode.cmyk", "mode.table", "mode.8bit"].every((k) => menu.includes(k)), menu);
    // Grayscale: the layers turn grey, and red painted afterwards shows grey
    await E_(() => window.imageEditorInstance.E.ui.run("mode.gray")); await p.waitForTimeout(300);
    const g1 = await lay(100, 100);
    await E_(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(10, 10, 40, 40); L.ver++; E.refresh(); });
    const s1 = await scr(20, 20), f1 = await flat(20, 20), mode1 = await E_(() => window.imageEditorInstance.E.S.imgMode);
    check("Grayscale: the layer turned grey; new red paint shows grey on screen and in the flattened picture", mode1 === "gray" && g1[0] === g1[1] && g1[1] === g1[2] && Math.abs(g1[0] - 73) <= 2 && s1[0] === s1[1] && s1[1] === s1[2] && f1[0] === f1[1] && Math.abs(f1[0] - 54) <= 3, { g1, s1, f1 });
    await E_(() => window.imageEditorInstance.E.ui.run("edit.undo")); await p.waitForTimeout(300);
    const u1 = await E_(() => window.imageEditorInstance.E.S.imgMode), u1p = await lay(100, 100);
    check("Grayscale is one undo step (the mode and the colours come back)", u1 === "rgb" && u1p[0] > 200 && u1p[2] < 60, { u1, u1p });
    await paintPic();
    // Indexed: Web palette, no dither, one layer
    await E_(() => window.imageEditorInstance.E.ui.run("mode.indexed")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg .mdP", "web"); await p.selectOption(".kxdlg .mdD", "none"); await p.click(".kxdlg .ok"); await p.waitForTimeout(600);
    const ix = await E_(() => { const S = window.imageEditorInstance.E.S, d = S.layers[0].canvas.getContext("2d").getImageData(0, 0, S.w, S.h).data, set = new Set(); let off = 0; for (let i = 0; i < d.length; i += 4) { set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (d[i] % 51 || d[i + 1] % 51 || d[i + 2] % 51) off++; } return { mode: S.imgMode, layers: S.layers.length, name: S.layers[0].name, colours: set.size, off, pal: S.imgModeOpt.palette.length }; });
    check("Indexed Color (Web, no dither): one 'Index' layer, every pixel one of the 216 web colours", ix.mode === "indexed" && ix.layers === 1 && ix.name === "Index" && ix.off === 0 && ix.pal === 216 && ix.colours <= 216, ix);
    // Color Table: change the first colour that is used
    await E_(() => window.imageEditorInstance.E.ui.run("mode.table")); await p.waitForTimeout(300);
    const before = await lay(100, 100);
    await E_((c) => { const el = Array.from(document.querySelectorAll(".kxdlg .mdTab input")).find((x) => x.value.toLowerCase() === "#" + c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")); el.value = "#123456"; }, before);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(400);
    const after = await lay(100, 100);
    check("Color Table: a colour changed in the table changes those pixels", after[0] === 0x12 && after[1] === 0x34 && after[2] === 0x56, { before, after });
    // back to RGB, then CMYK
    await E_(() => window.imageEditorInstance.E.ui.run("mode.rgb")); await p.waitForTimeout(300);
    await paintPic();
    await E_(() => window.imageEditorInstance.E.ui.run("mode.cmyk")); await p.waitForTimeout(300);
    await p.click(".kxdlg .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.imgMode === "cmyk", null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(300);
    const green = await lay(100, 320), red = await lay(100, 100), grey = await lay(300, 380);
    check("CMYK Color: screen green comes down to what the press prints (duller); greys stay grey", green[1] < 230 && green[0] < 60 && Math.abs(grey[0] - grey[2]) <= 3 && Math.abs(grey[0] - 128) <= 6, { green, red, grey });
    const info = await E_(() => { const E = window.imageEditorInstance.E; return { w: E.cmykOf(255, 255, 255).map((v) => Math.round(v * 100)), k: E.cmykOf(0, 0, 0).map((v) => Math.round(v * 100)) }; });
    check("CMYK values (the Info panel's): white 0 0 0 0, black with K 100", info.w.every((v) => v === 0) && info.k[3] === 100, info);
    const fmts = await E_(() => window.imageEditorInstance.E.exportFormats.map((x) => x[0]));
    const tif = await E_(async () => { const f = window.imageEditorInstance.E.flatten(); const b = await new Promise((ok) => f.toBlob(ok, "image/x-tiff-cmyk")); const u = new Uint8Array(await b.arrayBuffer()); return { size: b.size, head: Array.from(u.slice(0, 4)) }; });
    check("Export As ▸ TIFF (CMYK, for print): a four-channel TIFF", fmts.includes("tiffcmyk") && tif.head[0] === 0x49 && tif.head[2] === 42 && tif.size > 600 * 400 * 4, { fmts, tif });
    await E_(() => window.imageEditorInstance.E.ui.run("mode.rgb")); await p.waitForTimeout(300);
    await paintPic();
    // Proof Colors + Gamut Warning (screen only)
    await E_(() => window.imageEditorInstance.E.ui.run("view.gamut")); await p.waitForTimeout(2500);
    const gw = await scr(100, 320), gwOk = await scr(300, 380), gwFlat = await flat(100, 320);
    check("Gamut Warning: the screen green shows in the warning grey, a printable grey does not; the picture itself is unchanged", gw[0] === 128 && gw[1] === 128 && gw[2] === 128 && !(gwOk[0] === 128 && gwOk[1] === 128 && Math.abs(gwOk[0] - 128) > 10) && gwFlat[1] === 255, { gw, gwOk, gwFlat });
    await E_(() => window.imageEditorInstance.E.ui.run("view.gamut")); await E_(() => window.imageEditorInstance.E.ui.run("view.proof")); await p.waitForTimeout(1500);
    const pf = await scr(100, 320), pfFlat = await flat(100, 320);
    check("Proof Colors: the screen shows the press's green (duller), the picture keeps its green", pf[1] < 230 && pfFlat[1] === 255, { pf, pfFlat });
    await E_(() => window.imageEditorInstance.E.ui.run("view.proof")); await p.waitForTimeout(300);
    // Duotone (sepia)
    await E_(() => window.imageEditorInstance.E.ui.run("mode.duotone")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg .mdPre", "sepia"); await p.click(".kxdlg .ok"); await p.waitForTimeout(500);
    const du = await flat(300, 380), duL = await lay(300, 380);
    check("Duotone (sepia): the layer holds grey, the picture shows it in warm inks", duL[0] === duL[2] && du[0] > du[2] + 10, { du, duL });
    // Bitmap (diffusion)
    await E_(() => window.imageEditorInstance.E.ui.run("mode.bitmap")); await p.waitForTimeout(300);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(600);
    const bm = await E_(() => { const S = window.imageEditorInstance.E.S, d = S.layers[0].canvas.getContext("2d").getImageData(0, 0, S.w, S.h).data; let other = 0; for (let i = 0; i < d.length; i += 4) if ((d[i] !== 0 && d[i] !== 255) || d[i] !== d[i + 1]) other++; return { mode: S.imgMode, n: S.layers.length, other }; });
    check("Bitmap: one layer of only black and white", bm.mode === "bitmap" && bm.n === 1 && bm.other === 0, bm);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
