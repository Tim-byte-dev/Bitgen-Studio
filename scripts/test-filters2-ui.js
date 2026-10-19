#!/usr/bin/env node
/* bitGen Studio — 2.480.0 in a REAL browser: MORE ADJUSTMENTS + APPLY IMAGE (ext/imageeditdock/filters2.js) - the
 * image editor's gap, round A. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the adjustments round A browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.filters2, null, { timeout: 60000 });
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
    const E_ = "window.imageEditorInstance.E";
    // a picture: red left, blue right, a grey band
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d");
      g.fillStyle = "#ff0000"; g.fillRect(0, 0, 300, 400); g.fillStyle = "#0000ff"; g.fillRect(300, 0, 300, 400); g.fillStyle = "#808080"; g.fillRect(0, 350, 600, 50); L.ver = (L.ver || 0) + 1; E.renderLayers(); E.refresh(); });
    const lp = (x, y) => ev(([x, y]) => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const flat = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const menus = await ev(() => { const M = window.imageEditorInstance.E.ui.MENUS, img = M.find(([n]) => n === "Image")[1], adj = img.find((x) => x && x.label === "Adjustments").items, lay = M.find(([n]) => n === "Layer")[1].find((x) => x && x.label === "New Adjustment Layer").items;
      return { adj, applyAfterTrim: img.indexOf("image.applyimage") === img.indexOf("image.trim") + 1, lay }; });
    check("Image ▸ Adjustments has Shadows / Highlights, HDR Toning, Selective Color, Replace Color, Match Color, Color Lookup; Apply Image… after Trim; New Adjustment Layer has Selective Color + Color Lookup",
      ["adj.shadowshighlights", "adj.hdrtoning", "adj.selectivecolor", "adj.replacecolor", "adj.matchcolor", "adj.colorlookup"].every((x) => menus.adj.includes(x)) && menus.applyAfterTrim && menus.lay.includes("adjl.selectivecolor") && menus.lay.includes("adjl.colorlookup"), menus);
    // Selective Color
    await ev(() => window.imageEditorInstance.E.openFilter("selectivecolor")); await p.waitForTimeout(300);
    const scUi = await ev(() => { const d = document.querySelector(".kxdlg [data-pt=selcolor]"); return d ? { ranges: d.querySelectorAll(".scR option").length, sliders: d.querySelectorAll(".scS").length } : null; });
    await ev(() => { const d = document.querySelector(".kxdlg [data-pt=selcolor]"); d.querySelector('input[value=absolute]').click(); const s = d.querySelector('.scS[data-k=c]'); s.value = 100; s.dispatchEvent(new Event("input")); s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(500);
    const scPrev = await lp(100, 100);
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(300);
    const scDone = await lp(100, 100), blue = await lp(400, 100), u1 = await ev(() => window.imageEditorInstance.state.undo.length);
    check("Selective Color's dialog: the nine ranges, C / M / Y / K, Absolute; Reds + 100 % cyan previews and applies (red -> black), blue untouched, one undo step",
      scUi && scUi.ranges === 9 && scUi.sliders === 4 && scPrev[0] === 0 && scDone[0] === 0 && blue.join() === "0,0,255,255" && u1 === u0 + 1, { scUi, scPrev, scDone, blue, u0, u1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    // Replace Color: the eyedropper
    await ev(() => window.imageEditorInstance.E.openFilter("replacecolor")); await p.waitForTimeout(300);
    // a point on the blue half that the dialog does not cover
    let spot = null;
    for (const [x, y] of [[450, 150], [580, 30], [580, 330], [320, 30], [320, 330], [450, 30], [450, 330]]) {
      const [cx, cy] = await T(x, y);
      if (await ev(([cx, cy]) => { const e = document.elementFromPoint(cx, cy); return !!(e && document.getElementById("ieStage").contains(e)); }, [cx, cy])) { spot = [x, y]; break; }
    }
    await click(spot[0], spot[1]); await p.waitForTimeout(300);
    const picked = await ev(() => document.querySelector('.kxdlg [data-p="color"]').value);
    await ev(() => { const n = document.querySelector('.kxdlg [data-n="hue"]'); n.value = 180; n.dispatchEvent(new Event("change")); }); await p.waitForTimeout(500);
    const rcB = await lp(spot[0], spot[1]), rcR = await lp(100, 100);
    await p.click(".kxdlg .cn"); await p.waitForTimeout(200);
    const rcBack = await lp(spot[0], spot[1]);
    check("Replace Color: a click on the picture picks the colour (blue); hue 180 turns the blue yellow, the red stays; Cancel puts it back", picked === "#0000ff" && rcB[0] > 200 && rcB[1] > 200 && rcB[2] < 60 && rcR.join() === "255,0,0,255" && rcBack.join() === "0,0,255,255", { picked, rcB, rcR, rcBack });
    // Color Lookup: a look, then a .cube from the library
    const N = 5; let cube = `TITLE "inv"\nLUT_3D_SIZE ${N}\n`; for (let bb = 0; bb < N; bb++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) cube += `${1 - r / (N - 1)} ${1 - g / (N - 1)} ${1 - bb / (N - 1)}\n`;
    const saved = await ev(async (c) => (await fetch("/api/luts?name=bgtest_invert.cube", { method: "POST", headers: { "Content-Type": "text/plain" }, body: c })).json(), cube);
    await ev(() => window.imageEditorInstance.E.openFilter("colorlookup")); await p.waitForTimeout(800);
    const opts = await ev(() => Array.from(document.querySelectorAll(".kxdlg .lpS option")).map((o) => o.value));
    await p.selectOption(".kxdlg .lpS", "look:mono"); await p.waitForTimeout(600);
    const mono = await lp(100, 100);
    const lutKey = opts.find((v) => /bgtest_invert/.test(v));
    if (lutKey) { await p.selectOption(".kxdlg .lpS", lutKey); await p.waitForTimeout(900); }
    const inv = await lp(100, 100);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(300);
    check("Color Lookup lists the timeline's looks + the LUT library; 'mono' makes red grey; a library .cube (inverting) inverts red to cyan", opts.includes("look:mono") && !!lutKey && mono[0] === mono[1] && mono[1] === mono[2] && inv[0] < 3 && inv[1] > 252 && inv[2] > 252, { saved, opts: opts.slice(0, 12), mono, inv });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    // adjustment layers: Selective Color + Color Lookup, edited in Properties
    await ev(() => { const E = window.imageEditorInstance.E; E.newAdjust("selectivecolor"); }); await p.waitForTimeout(400);
    await ev(() => { const b = document.querySelector('[data-tab="pcProps"], #pcPropsTab'); if (b) b.click(); const E = window.imageEditorInstance.E; if (E.ui.showTab) E.ui.showTab("pcProps"); E.renderLayersPanel && E.renderLayersPanel(); });
    await p.waitForTimeout(400);
    const hasW = await ev(() => !!document.querySelector("#ppParams [data-pt=selcolor]"));
    await ev(() => { const d = document.querySelector("#ppParams [data-pt=selcolor]"); if (!d) return; d.querySelector('input[value=absolute]').click(); const s = d.querySelector('.scS[data-k=k]'); s.value = 100; s.dispatchEvent(new Event("input")); s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(600);
    const adjF = await flat(100, 100), adjB = await flat(450, 100);
    check("a Selective Color adjustment layer: its ranges in Properties; Reds + 100 % black darkens the red in the picture (not the blue)", hasW && adjF[0] < 60 && adjB.join() === "0,0,255,255", { hasW, adjF, adjB });
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.deleteLayer(); });
    await p.waitForTimeout(300);
    // Match Color from the merged picture (a cool source on a warm layer)
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.fillStyle = "#30a0e0"; g.fillRect(0, 0, 600, 300); L.name = "cool source"; L.ver = (L.ver || 0) + 1; E.renderLayers(); E.renderLayersPanel(); });
    const coolId = await ev(() => { const S = window.imageEditorInstance.state; return S.layers[S.active].id; });
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(0); });
    await ev(() => window.imageEditorInstance.E.openFilter("matchcolor")); await p.waitForTimeout(300);
    const msOpts = await ev(() => Array.from(document.querySelectorAll(".kxdlg .lsS option")).map((o) => o.textContent));
    await ev((id) => { const s = document.querySelector(".kxdlg .lsS"); s.value = String(id); s.dispatchEvent(new Event("change")); }, coolId); await p.waitForTimeout(700);
    const mcR = await lp(100, 100);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(300);
    check("Match Color: another layer as the source ('cool source' listed); the red layer takes its blue colour", msOpts.includes("cool source") && mcR[2] > mcR[0], { msOpts, mcR });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    // Apply Image: the cool layer's red channel multiplied onto the bottom layer
    await ev(() => window.imageEditorInstance.E.ui.run("image.applyimage")); await p.waitForTimeout(300);
    await ev((id) => { const s = document.querySelector(".kxdlg .lpk"); s.value = String(id); s.dispatchEvent(new Event("change")); const c = document.querySelector('.kxdlg [data-p="channel"]'); c.value = "red"; c.dispatchEvent(new Event("change")); }, coolId);
    await p.waitForTimeout(600);
    const aiTop = await lp(100, 100), aiLow = await lp(100, 330);
    await p.click(".kxdlg .ok"); await p.waitForTimeout(300);
    check("Image ▸ Apply Image…: the cool layer's red channel (0x30) multiplied onto red where it covers, nothing below it", Math.abs(aiTop[0] - 48) <= 2 && aiLow.join() === "255,0,0,255", { aiTop, aiLow });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
