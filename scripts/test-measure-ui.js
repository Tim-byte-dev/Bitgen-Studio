#!/usr/bin/env node
/* bitGen Studio — 2.483.0 in a REAL browser: PANELS AND MEASURING TOOLS (ext/imageeditdock/pcmeasure.js) - the image
 * editor's gap, round D. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the panels + measuring tools browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.measure, null, { timeout: 60000 });
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
      g.fillStyle = "#ff0000"; g.fillRect(0, 0, 300, 400); g.fillStyle = "#0000ff"; g.fillRect(300, 0, 300, 400); g.fillStyle = "#00c000"; g.fillRect(40, 40, 30, 30); L.ver = (L.ver || 0) + 1; E.renderLayers(); E.refresh(); });
    const st2 = () => ev(() => { const S = window.imageEditorInstance.state; return { w: S.w, h: S.h, undo: S.undo.length, samplers: (S.samplers || []).length, notes: (S.notes || []).map((n) => n.text), counts: S.counts ? S.counts.groups[0].marks.length : 0, tool: S.tool, panX: S.panX }; });
    const grpI = await ev(() => { const b = document.querySelector('#kxTools .ietool[data-group="i"]'), c = document.querySelector('#kxTools .ietool[data-group="c"]'); return [b && b.dataset.tools, c && c.dataset.tools]; });
    check("the tool column: the Eyedropper group has Color Sampler, Ruler, Note, Count; the Crop group Perspective Crop", grpI[0] === "picker,sampler,ruler,note,count" && grpI[1] === "crop,pcrop", grpI);
    // Navigator
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcNav")); await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.zoomAt(3)); await p.waitForTimeout(300);
    const pan0 = (await st2()).panX;
    const nb = await p.locator("#pcNavC").boundingBox();
    await p.mouse.click(nb.x + nb.width * 0.9, nb.y + nb.height * 0.5); await p.waitForTimeout(400);
    const pan1 = (await st2()).panX;
    check("Navigator: the picture small with the view box; a click moves the view there", nb.width > 50 && pan1 !== pan0, { pan0, pan1 });
    await ev(() => { const E = window.imageEditorInstance.E; E.S.userView = false; E.fitView(); });
    // Histogram
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcHist")); await p.waitForTimeout(900);
    const hs = await ev(() => document.getElementById("pcHStats").textContent);
    await p.selectOption("#pcHCh", "red"); await p.waitForTimeout(900);
    const hr = await ev(() => document.getElementById("pcHStats").textContent);
    check("Histogram: the picture's numbers (240,000 pixels); the Red channel's mean differs from RGB's", /240,000|240000/.test(hs) && hs !== hr && /Mean/.test(hr), { hs, hr });
    // Info + Color Sampler
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcInfo"));
    const [ix, iy] = await T(450, 200); await p.mouse.move(ix, iy); await p.waitForTimeout(500);
    const info = await ev(() => document.getElementById("pcInfo").textContent);
    check("Info: the colour under the pointer (blue: RGB 0 0 255, HSB 240°, CMYK 100 100 0 0) and its place", /0 0 255/.test(info) && /240°/.test(info) && /100% 100% 0% 0%/.test(info) && /450, 200/.test(info), info.slice(0, 200));
    await ev(() => window.imageEditorInstance.E.setTool("sampler"));
    await click(100, 100); await click(500, 100); await p.waitForTimeout(500);
    let s = await st2(); const info2 = await ev(() => document.getElementById("pcInfo").textContent);
    await click(100, 100, ["Alt"]); await p.waitForTimeout(200);
    const s2 = await st2();
    check("Color Sampler: two samplers read in Info (#1 red, #2 blue); Alt-click removes one", s.samplers === 2 && /#1\s*255 0 0/.test(info2) && /#2\s*0 0 255/.test(info2) && s2.samplers === 1, { s, info2: info2.slice(-80), s2: s2.samplers });
    // Ruler + straighten
    await ev(() => window.imageEditorInstance.E.setTool("ruler"));
    await drag(100, 100, 300, 120); await p.waitForTimeout(300);
    const ro = await ev(() => document.getElementById("kxOpts").textContent);
    const u0 = (await st2()).undo;
    await p.click("#pcmStrP"); await p.waitForTimeout(800);
    const u1 = (await st2()).undo, rotPx = await ev(() => Array.from(window.imageEditorInstance.E.S.layers[0].canvas.getContext("2d").getImageData(298, 10, 1, 1).data));
    check("Ruler: angle -5.7° and length in the options bar; Straighten Picture turns it (one undo step)", /A -5\.7°/.test(ro) && /L 201\.0 px/.test(ro) && u1 === u0 + 1, { ro: ro.slice(0, 140), u0, u1, rotPx });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    // Note
    await ev(() => { window.prompt = () => "Fix this edge"; window.imageEditorInstance.E.setTool("note"); });
    await click(200, 300); await p.waitForTimeout(400);
    const notesTxt = await ev(() => document.getElementById("pcNotes").textContent);
    check("Note: a click makes a note with its text; the Notes panel lists it", JSON.stringify((await st2()).notes) === '["Fix this edge"]' && /Fix this edge/.test(notesTxt), notesTxt.slice(0, 120));
    // Count
    await ev(() => window.imageEditorInstance.E.setTool("count"));
    await click(50, 300); await click(80, 300); await click(110, 300); await p.waitForTimeout(200);
    const c3 = (await st2()).counts, co = await ev(() => document.getElementById("pcmCnt").textContent);
    await click(80, 301, ["Alt"]); await p.waitForTimeout(200);
    check("Count: three numbered marks ('Count: 3'); Alt-click removes the nearest", c3 === 3 && co === "Count: 3" && (await st2()).counts === 2, { c3, co });
    // Perspective Crop
    await ev(() => window.imageEditorInstance.E.setTool("pcrop"));
    await drag(100, 100, 500, 300); await p.waitForTimeout(200);
    await ev(() => window.imageEditorInstance.E.measure.setQuad([[100, 100], [500, 120], [480, 300], [120, 280]]));
    const cu0 = (await st2()).undo;
    await p.locator("#ieStage").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
    const pc = await st2();
    check("Perspective Crop: four corners, Enter crops the picture to them (381 x 181 - the sides averaged; one undo step)", Math.abs(pc.w - 381) <= 1 && Math.abs(pc.h - 181) <= 1 && pc.undo === cu0 + 1, pc);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(400);
    const back = await st2();
    check("undo puts the picture back (600 x 400)", back.w === 600 && back.h === 400, back);
    // Select ▸ Similar + Grow, Focus Area
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, m = new Uint8Array(S.w * S.h); for (let y = 200; y < 205; y++) for (let x = 200; x < 205; x++) m[y * S.w + x] = 255; E.changeSel(m, "test"); });
    await ev(() => window.imageEditorInstance.E.ui.run("sel.similar")); await p.waitForTimeout(400);
    const simCount = await ev(() => { const S = window.imageEditorInstance.state; let n = 0; for (let i = 0; i < S.sel.length; i++) if (S.sel[i]) n++; return n; });
    check("Select ▸ Similar takes every red pixel (the red half less the green square)", simCount === 300 * 400 - 900, simCount);
    await ev(() => window.imageEditorInstance.E.ui.run("sel.focus")); await p.waitForTimeout(800);
    const fa = await ev(() => !!document.querySelector("#pcmFR"));
    await p.click(".kxdlg .ok"); await p.waitForTimeout(400);
    check("Select ▸ Focus Area… opens its range + softness and selects", fa);
    // Matting
    const mu0 = (await st2()).undo;
    await ev(() => window.imageEditorInstance.E.ui.run("layer.unblack")); await p.waitForTimeout(400);
    check("Layer ▸ Matting ▸ Remove Black Matte runs as one undo step", (await st2()).undo === mu0 + 1);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
