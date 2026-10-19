#!/usr/bin/env node
/* bitGen Studio — 2.488.0 in a REAL browser: SELECT SUBJECT (BUILT IN + THE AI MATTE), REMOVE BACKGROUND
 * (ext/imageeditdock/pcsubject.js, routes/subject.js) - the image editor's gap, round H.
 * Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311 - started with H3_E2E=1, so the AI matte's stand-in
 * answers). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the select subject browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.subject && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
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
    // an orange subject on a grainy blue-green gradient
    await E_(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"), id = g.createImageData(600, 400); let s = 3; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      for (let y = 0; y < 400; y++) for (let x = 0; x < 600; x++) { const i = (y * 600 + x) * 4, n = (rnd() - 0.5) * 20, inn = (x - 320) ** 2 / 130 ** 2 + (y - 210) ** 2 / 150 ** 2 < 1; const c = inn ? [200 + n, 90 + n, 40 + n] : [60 + x / 10 + n, 110 + y / 10 + n, 150 + n]; id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0); L.ver = (L.ver || 0) + 1; E.refresh(); });
    const iou = (which) => E_((which) => { const S = window.imageEditorInstance.E.S, m = which === "mask" ? (() => { const L = S.layers[S.active]; const d = L.mask.canvas.getContext("2d").getImageData(0, 0, 600, 400).data, o = new Uint8Array(600 * 400); for (let i = 0; i < o.length; i++) o[i] = d[i * 4]; return o; })() : S.sel; let a = 0, u = 0;
      for (let y = 0; y < 400; y++) for (let x = 0; x < 600; x++) { const s = m[y * 600 + x] > 127, t = (x - 320) ** 2 / 130 ** 2 + (y - 210) ** 2 / 150 ** 2 < 1; if (s && t) a++; if (s || t) u++; } return a / u; }, which);
    const menu = await E_(() => { const C = window.imageEditorInstance.E.ui.CMD; return { auto: !!C.get("sel.subjectauto"), set: !!C.get("sel.subjectset"), rb: !!C.get("layer.removebg"), sam: C.get("sel.subject") && C.get("sel.subject").label }; });
    check("Select ▸ Subject, Subject Settings…, Layer ▸ Remove Background; Segment Anything's is now 'Subject by Words…'", menu.auto && menu.set && menu.rb && menu.sam === "Subject by Words…", menu);
    // built in
    await E_(() => { const E = window.imageEditorInstance.E; E.store.set("subject.method", "builtin"); E.store.set("subject.fake", false); E.ui.run("sel.subjectauto"); });
    await p.waitForFunction(() => window.imageEditorInstance.E.lastSubject, null, { timeout: 30000 }).catch(() => {});
    const b1 = await iou("sel"), m1 = await E_(() => window.imageEditorInstance.E.lastSubject);
    check(`Select ▸ Subject (built in, no download): the subject selected (IoU ${b1.toFixed(3)} ≥ 0.95)`, m1 && m1.method === "builtin" && b1 >= 0.95, { b1, m1 });
    await E_(() => window.imageEditorInstance.E.ui.run("edit.undo")); await p.waitForTimeout(200);
    check("Select Subject is one undo step", await E_(() => window.imageEditorInstance.E.S.selCount === 0));
    // the settings: the AI matte (its stand-in - the e2e server has no model)
    await E_(() => window.imageEditorInstance.E.ui.run("sel.subjectset"));
    await p.waitForSelector(".kxdlg #sbM", { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(200);
    const dlg = await E_(() => ({ m: !!document.querySelector(".kxdlg #sbM"), st: (document.querySelector(".kxdlg #sbState") || {}).textContent, models: Array.from(document.querySelectorAll(".kxdlg #sbModel option")).map((o) => o.value) }));
    check("Subject Settings: the method, the AI models, the AI matte's state + ⬇ Install", dlg.m && /installed|installing/.test(dlg.st || "") && dlg.models[0] === "birefnet-general", dlg);
    await p.selectOption(".kxdlg #sbM", "ai"); await p.click(".kxdlg .ok"); await p.waitForTimeout(200);
    await E_(() => { const E = window.imageEditorInstance.E; E.store.set("subject.fake", true); E.lastSubject = null; E.ui.run("sel.subjectauto"); });
    await p.waitForFunction(() => window.imageEditorInstance.E.lastSubject, null, { timeout: 60000 }).catch(() => {});
    const b2 = await iou("sel"), m2 = await E_(() => window.imageEditorInstance.E.lastSubject);
    check(`Select ▸ Subject (AI matte through the server): the subject selected (IoU ${b2.toFixed(3)} ≥ 0.8)`, m2 && m2.method === "ai" && b2 >= 0.8, { b2, m2 });
    // Remove Background (built in)
    await E_(() => { const E = window.imageEditorInstance.E; E.store.set("subject.method", "builtin"); E.store.set("subject.fake", false); E.lastSubject = null; E.ui.run("sel.none"); E.ui.run("layer.removebg"); });
    await p.waitForFunction(() => window.imageEditorInstance.E.lastSubject, null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(300);
    const b3 = await iou("mask");
    check(`Layer ▸ Remove Background: the subject as the layer's mask (IoU ${b3.toFixed(3)} ≥ 0.95)`, b3 >= 0.95, b3);
    await E_(() => window.imageEditorInstance.E.ui.run("edit.undo")); await p.waitForTimeout(300);
    check("Remove Background undoes in one step (the mask gone)", await E_(() => { const S = window.imageEditorInstance.E.S; return !S.layers[S.active].mask; }));
    await E_(() => window.imageEditorInstance.E.store.set("subject.method", "auto"));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
