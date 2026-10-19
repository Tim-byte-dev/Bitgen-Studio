#!/usr/bin/env node
/* bitGen Studio — 2.482.0 in a REAL browser: THE DEVELOP FILTER + LENS CORRECTION (ext/imageeditdock/filters5.js) -
 * the image editor's gap, round C. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the develop filter browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.IEFilters5, null, { timeout: 60000 });
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
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 600, 0); gr.addColorStop(0, "#202060"); gr.addColorStop(1, "#e0a040"); g.fillStyle = gr; g.fillRect(0, 0, 600, 400); L.ver = (L.ver || 0) + 1; E.renderLayers(); E.refresh(); });
    const lp = (x, y) => ev(([x, y]) => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const fm = await ev(() => { const fl = window.imageEditorInstance.E.ui.MENUS.find(([n]) => n === "Filter")[1]; return { d: fl.indexOf("flt.develop") === fl.indexOf("so.smartfilters") + 1, l: fl.indexOf("flt.lenscorrection") === fl.indexOf("flt.develop") + 1 }; });
    check("Filter ▸ Develop Filter… after Smart Filters, Lens Correction… after it", fm.d && fm.l, fm);
    // the shortcut opens it
    await p.locator("#ieStage").focus(); await p.keyboard.press("Alt+Shift+Control+KeyA"); await p.waitForTimeout(500);
    const tabs = await ev(() => Array.from(document.querySelectorAll(".kxdlg .dvT")).map((b) => b.dataset.t));
    check("Alt+Shift+Ctrl+A opens the Develop Filter: nine tabs", tabs.join() === "Basic,Curve,Color,Grading,Detail,Optics,Geometry,Effects,Presets", tabs);
    const before = await lp(300, 200);
    await p.click('.kxdlg .dvT[data-t="Presets"]'); await p.click('.kxdlg .dvP[data-p="Black & White"]'); await p.waitForTimeout(900);
    const bw = await lp(300, 200);
    await p.click('.kxdlg .dvT[data-t="Basic"]');
    const bwBox = await ev(() => document.querySelector(".kxdlg .dvBW").checked);
    check("a preset (Black & White) previews grey and sets the Basic tab's B&W box", bw[0] === bw[1] && bw[1] === bw[2] && before[0] !== before[2] && bwBox, { before, bw, bwBox });
    await ev(() => { const s = document.querySelector('.kxdlg .dvS[data-k="exposure"]'); s.value = 1; s.dispatchEvent(new Event("input")); s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(900);
    const ex = await lp(300, 200);
    check("Exposure +1 brightens the preview", ex[0] > bw[0] + 20, { bw, ex });
    await ev(() => { document.querySelector(".kxdlg .dvAuto").click(); }); await p.waitForTimeout(700);
    const autoEx = await ev(() => +document.querySelector('.kxdlg .dvN[data-k="exposure"]').value);
    check("✨ Auto sets the Basic sliders from the picture", Number.isFinite(autoEx) && autoEx !== 1, autoEx);
    await p.click('.kxdlg .dvT[data-t="Presets"]'); await p.fill(".kxdlg .dvUN", "My look"); await p.click(".kxdlg .dvUS"); await p.waitForTimeout(300);
    const userBtn = await ev(() => !!document.querySelector('.kxdlg .dvU[data-u="My look"]'));
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(700);
    const applied = await lp(300, 200), u1 = await ev(() => window.imageEditorInstance.state.undo.length);
    check("💾 Save as preset keeps it (a button of its own); OK applies the develop (grey) as one undo step", userBtn && applied[0] === applied[2] && u1 === u0 + 1, { userBtn, applied, u0, u1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    await ev(() => window.imageEditorInstance.E.ui.run("flt.develop")); await p.waitForTimeout(500);
    const kept = await ev(() => { document.querySelector('.kxdlg .dvT[data-t="Presets"]').click(); return !!document.querySelector('.kxdlg .dvU[data-u="My look"]'); });
    await p.click(".kxdlg .cn"); await p.waitForTimeout(300);
    check("the saved preset is there the next time", kept);
    // Lens Correction
    await ev(() => window.imageEditorInstance.E.ui.run("flt.lenscorrection")); await p.waitForTimeout(500);
    await ev(() => { const a = document.querySelector('.kxdlg [data-n="angle"]'); a.value = 12; a.dispatchEvent(new Event("change")); const e = document.querySelector('.kxdlg [data-p="edge"]'); e.value = "transparent"; e.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(1200);
    const corner = await lp(2, 2);
    const grid = await ev(() => { const E = window.imageEditorInstance.E; E.drawOverlay(); const ov = document.querySelector("#ieStage canvas.ov, #ieOverlay, #ieStage canvas:last-of-type"); return !!ov; });
    await p.click(".kxdlg .cn"); await p.waitForTimeout(400);
    const back = await lp(2, 2);
    check("Lens Correction: an angle with transparent edges previews see-through corners; Cancel puts them back", corner[3] === 0 && back[3] === 255 && grid, { corner, back });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
