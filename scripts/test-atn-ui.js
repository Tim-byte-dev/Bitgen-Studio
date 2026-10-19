#!/usr/bin/env node
/* bitGen Studio — 2.469.0 in a REAL browser: PHOTOSHOP .atn ACTIONS (pcatn.js + pcactions.js) - the sample "Photo Fix"
 * set (scripts/atn-fixture.js, written the way Photoshop writes .atn files) loaded into the Actions panel and played:
 * filters with their settings, duplicate, opacity, blend mode, rotate, flip, selections, a Stop, the unmatched step off.
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the .atn browser test did not run"); process.exit(0); }
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
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.actions && window.PCAtn, null, { timeout: 60000 });
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
    const { bytes } = require("./atn-fixture.js");
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(300, 200, "atn.png", (g) => { g.fillStyle = "#808080"; g.fillRect(0, 0, 300, 200); g.fillStyle = "#ff0000"; g.fillRect(0, 0, 150, 200); }); E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#000000"; g.fillRect(100, 50, 100, 100); L.ver++; E.refresh(); E.ui.showTab("pcActions"); });
    await p.waitForTimeout(250);
    const got = await ev((arr) => { const r = window.imageEditorInstance.E.actions.loadAtn(new Uint8Array(arr), "photo-fix.atn"); return { name: r.set.name, n: r.set.actions.length, mapped: r.notes.mapped, skipped: r.notes.skipped }; }, Array.from(bytes));
    await p.waitForTimeout(200);
    const panel = await ev(() => document.querySelector("#pcActions").innerText);
    check("Actions ▸ Load Actions… with a Photoshop .atn: the set \"Photo Fix\" (2 actions, 12 steps matched, 1 switched off) in the Actions panel", got.name === "Photo Fix" && got.n === 2 && got.mapped === 12 && got.skipped === 1 && /Photo Fix/.test(panel) && /Soften/.test(panel), { got, panel: panel.slice(0, 300) });
    // played without stopping in Unsharp Mask's dialog
    const s1 = await ev(async () => {
      const E = window.imageEditorInstance.E, A = E.actions, sets = A.sets(), set = sets.find((x) => x.name === "Photo Fix");
      for (const a of set.actions) for (const st of a.steps) delete st.modal; A.setSets(sets);
      const a = A.sets().find((x) => x.name === "Photo Fix").actions[0], n0 = E.S.layers.length;
      const r = await A.play(a, 0, true), L = E.layer();
      return { ok: r.ok, err: r.error, steps: r.steps, added: E.S.layers.length - n0, opacity: Math.round(L.opacity * 100), blend: L.blend, edge: Array.from(L.canvas.getContext("2d").getImageData(100, 100, 1, 1).data) };
    });
    check("\"Soften\" played: Gaussian Blur 3.5 (the box's edge soft), Unsharp Mask, Duplicate Layer, opacity 65, Multiply, Hue / Saturation - 6 steps", s1.ok && s1.steps === 6 && s1.added === 1 && s1.opacity === 65 && s1.blend === "multiply" && s1.edge[3] > 10 && s1.edge[3] < 245, s1);
    // the second action: rotate, flip, select all, inverse, a Stop with Continue (the test presses it), the rest off
    const pr = ev(async () => { const E = window.imageEditorInstance.E, A = E.actions, a = A.sets().find((x) => x.name === "Photo Fix").actions[1]; const r = await A.play(a, 0, true); return { ok: r.ok, err: r.error, steps: r.steps, w: E.S.w, h: E.S.h, sel: E.S.selCount, n: E.S.layers.length }; });
    let stopTxt = "";
    for (let i = 0; i < 40 && !stopTxt; i++) { await p.waitForTimeout(150); stopTxt = await ev(() => { const d = [...document.querySelectorAll(".kxdlg")].find((x) => /Action Stopped/.test(x.textContent)); if (!d) return ""; const t = d.textContent; d.querySelector(".ok").click(); return t; }); }
    const s2 = await pr;
    check("\"Turn + misc\" played: rotated 90° (300 x 200 -> 200 x 300), flipped, Select All then Inverse (nothing selected), the Stop's message with Continue; the unmatched + the off steps skipped", s2.ok && s2.steps === 5 && s2.w === 200 && s2.h === 300 && s2.sel === 0 && /Check the sky/.test(stopTxt) && s2.n === 3, { s2, stopTxt: stopTxt.slice(0, 120) });
    await ev(() => { const A = window.imageEditorInstance.E.actions; A.setSets(A.sets().filter((x) => x.name !== "Photo Fix")); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
