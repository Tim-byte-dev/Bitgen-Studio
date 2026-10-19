#!/usr/bin/env node
/* bitGen Studio — 2.468.0 in a REAL browser: MORE ACTIONS (pcactionsx.js + pcactions.js) - a brush stroke and a
 * marquee selection recorded and played on a picture half the size, Insert Conditional (landscape / portrait), File ▸
 * Scripts: Image Processor (JPEG fitted), Automate: Create Droplet (a tile pictures are dropped on).
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the actions extra browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.actionsX, null, { timeout: 60000 });
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
    const TAG = "zzax" + process.pid;
    const newDoc = (w, h) => ev(([w, h]) => { const E = window.imageEditorInstance.E; E.openDoc(w, h, "ax.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); }); E.newLayer(); }, [w, h]);
    await newDoc(600, 400); await p.waitForTimeout(300);
    await ev((tag) => { const A = window.imageEditorInstance.E.actions, s = A.sets(); s.push({ name: tag, open: true, actions: [{ name: "Strokes", steps: [], open: true }, { name: "Land", steps: [{ kind: "set", what: "opacity", value: 50 }] }, { name: "Port", steps: [{ kind: "set", what: "opacity", value: 20 }] }, { name: "Cond", steps: [], open: true }] }); A.setSets(s); A.select(s.length - 1, 0); A.startRec(); window.imageEditorInstance.E.ui.showTab("pcActions"); }, TAG);

    /* 1 record a brush stroke + a marquee selection by hand */
    await ev(() => { const E = window.imageEditorInstance.E; E.setFg("#ff0000"); E.setTool("paint"); E.S.size = 20; });
    await drag(100, 100, 300, 100); await p.waitForTimeout(150);
    await ev(() => window.imageEditorInstance.E.setTool("rect")); await drag(350, 50, 450, 150); await p.waitForTimeout(150);
    await ev(() => window.imageEditorInstance.E.actions.stopRec());
    const steps = await ev((tag) => { const s = window.imageEditorInstance.E.actions.sets().find((x) => x.name === tag); return s.actions[0].steps.map((x) => ({ kind: x.kind, tool: x.tool, n: x.pts ? x.pts.length : 0, how: x.how, subs: x.path ? x.path.subs.length : 0, fg: x.fg, size: x.size })); }, TAG);
    check("recording: a Brush stroke (its points, size 20, red) and a hand-made selection (its outline) are steps", steps.length === 2 && steps[0].kind === "stroke" && steps[0].tool === "paint" && steps[0].n >= 2 && steps[0].fg === "#ff0000" && steps[0].size === 20 && steps[1].kind === "sel" && steps[1].subs === 1, steps);

    /* 2 played on a picture half the size: the stroke + the selection where they were, scaled */
    await newDoc(300, 200); await p.waitForTimeout(200);
    await ev(() => window.imageEditorInstance.E.setFg("#0000ff"));
    const r = await ev(async (tag) => { const A = window.imageEditorInstance.E.actions, si = A.sets().findIndex((x) => x.name === tag); return await A.play(A.sets()[si].actions[0], 0, true); }, TAG);
    const red = await lpx(100, 50), off = await lpx(100, 120);
    const selN = await ev(() => window.imageEditorInstance.state.selCount), tool = await ev(() => window.imageEditorInstance.state.tool), fg = await ev(() => window.imageEditorInstance.state.fg);
    check("played on 300 x 200: the red stroke at half scale (y 50), the selection 50 x 50 at (175, 25); the tool and colour left as they were", r.ok && red[0] > 200 && red[2] < 60 && red[3] > 200 && off[3] === 0 && Math.abs(selN - 2601) < 260 && tool === "rect" && fg === "#0000ff", { r, red, off, selN, tool, fg });

    /* 3 Insert Conditional… (the dialog): landscape -> Land (opacity 50) else Port (20) */
    await ev((tag) => { const A = window.imageEditorInstance.E.actions, si = A.sets().findIndex((x) => x.name === tag); A.select(si, 3); window.imageEditorInstance.E.ui.run("act.cond"); }, TAG);
    await p.waitForSelector(".kxdlg.pcd #cdT");
    await p.selectOption(".kxdlg.pcd #cdT", "landscape");
    await p.selectOption(".kxdlg.pcd #cdA", JSON.stringify([TAG, "Land"])); await p.selectOption(".kxdlg.pcd #cdB", JSON.stringify([TAG, "Port"]));
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(150);
    const playCond = () => ev(async (tag) => { const E = window.imageEditorInstance.E, A = E.actions, a = A.sets().find((x) => x.name === tag).actions[3]; const r = await A.play(a, 0, true); return [r.ok, Math.round(E.layer().opacity * 100), a.steps.length, a.steps[0] && a.steps[0].kind]; }, TAG);
    const c1 = await playCond();
    await newDoc(200, 300); await p.waitForTimeout(150);
    const c2 = await playCond();
    check("Insert Conditional: on a landscape picture it plays Land (opacity 50), on a portrait one Port (20)", c1[0] && c1[1] === 50 && c1[2] === 1 && c1[3] === "cond" && c2[0] && c2[1] === 20, { c1, c2 });

    /* 4 Image Processor: two pictures -> JPEG fitted in 100 x 100 into the project's batch/<name>-JPEG */
    const proc = await ev(async (tag) => {
      const E = window.imageEditorInstance.E, files = [];
      for (const [n, c, w, h] of [["one.png", "#ff0000", 400, 200], ["two.png", "#00aa00", 120, 300]]) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, w, h); const b = await new Promise((ok) => cv.toBlob(ok, "image/png")); files.push(new File([b], n, { type: "image/png" })); }
      E.ui.run("act.processor"); await new Promise((r) => setTimeout(r, 200));
      const d = [...document.querySelectorAll(".kxdlg.pcd")].pop(); d.__setFiles(files);
      d.querySelector("#ipR").value = tag; d.querySelector("#ipJR").checked = true; d.querySelector("#ipJW").value = 100; d.querySelector("#ipJH").value = 100;
      E.processorReport = null; d.querySelector(".ok").click();
      for (let i = 0; i < 100 && !E.processorReport; i++) await new Promise((r) => setTimeout(r, 100));
      const rep = E.processorReport, list = await (await fetch("/api/batch/list?run=" + encodeURIComponent(tag + "-JPEG"))).json();
      const blob = await (await fetch(`/api/batch/file/${encodeURIComponent(tag + "-JPEG")}/one.jpg`)).blob(), img = await createImageBitmap(blob);
      return { done: rep && rep.done, saved: rep && rep.saved, files: (list.files || []).map((f) => f.name), w: img.width, h: img.height, type: blob.type };
    }, TAG);
    check("File ▸ Scripts: Image Processor: 2 pictures saved as JPEG fitted inside 100 x 100 (400 x 200 -> 100 x 50) in batch/<name>-JPEG", proc.done === 2 && proc.files.length === 2 && proc.w === 100 && proc.h === 50, proc);

    /* 5 a DROPLET: made from the dialog, a tile in the Actions panel, pictures dropped on it */
    await ev((tag) => { const A = window.imageEditorInstance.E.actions, si = A.sets().findIndex((x) => x.name === tag); A.select(si, 1); window.imageEditorInstance.E.ui.run("act.droplet"); }, TAG);
    await p.waitForSelector(".kxdlg.pcd #dpN"); await p.fill(".kxdlg.pcd #dpN", TAG + "drop"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    const tile = await ev((tag) => { const el = [...document.querySelectorAll("#pcActions [data-drop]")].find((x) => x.textContent.includes(tag + "drop")); return el ? el.dataset.drop : null; }, TAG);
    const dropped = await ev(async (id) => {
      const E = window.imageEditorInstance.E, cv = document.createElement("canvas"); cv.width = 80; cv.height = 60; cv.getContext("2d").fillRect(0, 0, 80, 60);
      const b = await new Promise((ok) => cv.toBlob(ok, "image/png")), dt = new DataTransfer(); dt.items.add(new File([b], "dropped.png", { type: "image/png" }));
      E.batchReport = null; document.querySelector(`#pcActions [data-drop="${id}"]`).dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      for (let i = 0; i < 100 && !E.batchReport; i++) await new Promise((r) => setTimeout(r, 100));
      return E.batchReport;
    }, tile);
    await ev(() => { const d = [...document.querySelectorAll(".kxdlg.pcd")].find((x) => /Batch Done/.test(x.textContent)); if (d) d.querySelector(".ok").click(); });
    check("Automate: Create Droplet: a 💧 tile in the Actions panel; a picture dropped on it is processed (the Land action) and saved", !!tile && dropped && dropped.done === 1 && dropped.saved.length === 1, { tile, dropped });
    await ev((id) => { const s = window.imageEditorInstance.E; s.store.set("actions.droplets", (s.store.get("actions.droplets", []) || []).filter((x) => x.id !== id)); const A = s.actions; A.setSets(A.sets().filter((x) => !/^zzax/.test(x.name))); }, tile);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally {
    await b.close();
    try { for (const d of fs.readdirSync(path.join(ROOT, "projects"))) { const bd = path.join(ROOT, "projects", d, "batch"); if (!fs.existsSync(bd)) continue; for (const r of fs.readdirSync(bd)) if (/^(zzax|droplet-zzax)/.test(r)) fs.rmSync(path.join(bd, r), { recursive: true, force: true }); } } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
