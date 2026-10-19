#!/usr/bin/env node
/* bitGen Studio — 2.481.0 in a REAL browser: THE FILTER MENU, ROUND B (ext/imageeditdock/filters3.js + filters4.js) -
 * the image editor's gap. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the filters round B browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.IEFilters4, null, { timeout: 60000 });
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
    // a checkerboard picture (blurs show at once)
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d");
      for (let y = 0; y < 400; y += 8) for (let x = 0; x < 600; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? "#ffffff" : "#000000"; g.fillRect(x, y, 8, 8); } L.ver = (L.ver || 0) + 1; E.renderLayers(); E.refresh(); });
    const lp = (x, y) => ev(([x, y]) => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const fm = await ev(() => { const M = window.imageEditorInstance.E.ui.MENUS, fl = M.find(([n]) => n === "Filter")[1]; return fl.filter((x) => x && x.label).map((x) => [x.label, x.items.length]); });
    const names = fm.map((x) => x[0]);
    check("the Filter menu: Artistic, Blur, Blur Gallery, Distort, Noise, Other, Pixelate, Render, Sharpen, Sketch, Stylize, Texture (in order)", JSON.stringify(names) === JSON.stringify(["Artistic", "Blur", "Blur Gallery", "Distort", "Noise", "Other", "Pixelate", "Render", "Sharpen", "Sketch", "Stylize", "Texture"]), fm);
    // Iris Blur: a click places the centre
    await ev(() => window.imageEditorInstance.E.ui.run("flt.irisblur")); await p.waitForTimeout(400);
    let spot = null;
    for (const [x, y] of [[150, 200], [100, 100], [100, 300], [450, 100], [450, 300]]) { const [cx, cy] = await T(x, y); if (await ev(([cx, cy]) => { const e = document.elementFromPoint(cx, cy); return !!(e && document.getElementById("ieStage").contains(e)); }, [cx, cy])) { spot = [x, y]; break; } }
    await click(spot[0], spot[1]); await p.waitForTimeout(700);
    const cxy = await ev(() => [document.querySelector('.kxdlg [data-p="cx"]').value, document.querySelector('.kxdlg [data-p="cy"]').value]);
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(600);
    const sharp = await lp(spot[0] + 1, spot[1] + 1), far = await lp(spot[0] < 300 ? 590 : 5, spot[1] < 200 ? 390 : 5), u1 = await ev(() => window.imageEditorInstance.state.undo.length);
    check("Iris Blur: a click puts the centre there; it stays sharp, the far corner blurs; one undo step", +cxy[0] === Math.round(spot[0] / 6) && +cxy[1] === Math.round(spot[1] / 4) && (sharp[0] < 20 || sharp[0] > 235) && far[0] > 40 && far[0] < 215 && u1 === u0 + 1, { spot, cxy, sharp, far });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    // Custom: the kernel grid
    await ev(() => window.imageEditorInstance.E.ui.run("flt.custom")); await p.waitForTimeout(400);
    const boxes = await ev(() => document.querySelectorAll(".kxdlg [data-pt=kernel] .kk").length);
    await p.click(".kxdlg .kkB"); await ev(() => { const n = document.querySelector('.kxdlg [data-n="scale"]'); n.value = 25; n.dispatchEvent(new Event("change")); }); await p.waitForTimeout(600);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(500);
    const cu = await lp(8, 4), uc = await ev(() => window.imageEditorInstance.state.undo.length);
    check("Custom: a 5 x 5 grid of 25 boxes; the Blur preset / 25 averages the checkerboard's edge pixels", boxes === 25 && cu[0] > 40 && cu[0] < 215, { boxes, cu });
    await ev(() => window.imageEditorInstance.E.repeatFilter()); await p.waitForTimeout(500);
    const ur = await ev(() => window.imageEditorInstance.state.undo.length);
    check("Ctrl+F (Last Filter) repeats it - one more undo step", ur === uc + 1, [uc, ur]);
    await ev(() => { const E = window.imageEditorInstance.E; E.undo(); E.undo(); }); await p.waitForTimeout(300);
    // Lighting Effects: preview, Cancel puts it back
    const before = await lp(300, 200);
    await ev(() => window.imageEditorInstance.E.ui.run("flt.lighting")); await p.waitForTimeout(400);
    await ev(() => { const s = document.querySelector('.kxdlg [data-p="ambience"]'); s.value = 0; s.dispatchEvent(new Event("input")); const t = document.querySelector('.kxdlg [data-p="x"]'); t.value = -50; t.dispatchEvent(new Event("input")); }); await p.waitForTimeout(900);
    const lit = await lp(596, 396);
    await p.click(".kxdlg .cn"); await p.waitForTimeout(300);
    const after = await lp(300, 200);
    check("Lighting Effects previews (a dark far corner) and Cancel puts the picture back", (lit[0] + lit[1] + lit[2]) < 200 * 3 && before.join() === after.join(), { lit, before, after });
    // Displace: its map from the layer list
    await ev(() => window.imageEditorInstance.E.ui.run("flt.displace")); await p.waitForTimeout(400);
    const maps = await ev(() => Array.from(document.querySelectorAll(".kxdlg .lpk option")).map((o) => o.textContent));
    await p.click(".kxdlg .cn"); await p.waitForTimeout(200);
    check("Displace takes its map from the merged picture or a layer", maps.includes("The merged picture") && maps.length >= 2, maps);
    // a smart filter
    await ev(() => window.imageEditorInstance.E.ui.run("so.convert")); await p.waitForTimeout(500);
    await ev(() => window.imageEditorInstance.E.ui.run("flt.surfaceblur")); await p.waitForTimeout(500);
    await p.click(".kxdlg .ok").catch(() => {}); await p.waitForTimeout(800);
    const sf = await ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return L.smart ? (L.smart.filters || []).map((f) => f.id) : null; });
    check("on a smart object a round B filter becomes a smart filter (Surface Blur)", Array.isArray(sf) && sf.includes("surfaceblur"), sf);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
