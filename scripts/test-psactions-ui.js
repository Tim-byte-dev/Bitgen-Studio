#!/usr/bin/env node
/* bitGen Studio — 2.427.0 in a REAL browser: ACTIONS (record / play / edit) AND FILE ▸ AUTOMATE ▸ BATCH
 * (ext/imageeditdock/pcactions.js, lib/batchStore.js, routes/batch.js).
 * Tim: "continue with the photoshop gap closure" - the agreed order: 2.427.0 Actions + batch.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the actions browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const RUN = "zz_psactions_" + process.pid;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.removeItem("kx.actions.sets"); localStorage.removeItem("kx.actions.buttons"); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.actions, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    const newDoc = (w, h, col) => ev(([w, h, col]) => { const E = window.imageEditorInstance.E; E.openDoc(w, h, "act.png", (g) => { g.fillStyle = col; g.fillRect(0, 0, w, h); }); }, [w, h, col]);
    await newDoc(400, 300, "#808080");
    const st = () => ev(() => { const S = window.imageEditorInstance.state, L = S.layers[S.active]; return { w: S.w, h: S.h, n: S.layers.length, undo: S.undo.length, op: L && Math.round(L.opacity * 100), blend: L && L.blend, dlg: document.querySelectorAll(".kx .kxdlg").length }; });
    const px = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const tab = () => ev(() => window.imageEditorInstance.E.ui.showTab("pcActions"));
    const A = () => ev(() => window.imageEditorInstance.E.actions.sets());

    /* 1 the panel + the Default Actions */
    await tab();
    const sets = await A();
    const rows = await ev(() => document.querySelectorAll("#pcActions .actlist .ar").length);
    check("the Actions tab (next to History): the Default Actions set with 5 actions", sets.length === 1 && sets[0].name === "Default Actions" && sets[0].actions.length === 5 && rows >= 6, [sets.map((s) => s.actions.map((a) => a.name)), rows]);

    /* 2 play one */
    const c0 = await px(2, 2);
    await ev(() => window.imageEditorInstance.E.actions.select(0, 0)); await p.click("#actPlay"); await p.waitForTimeout(500);
    const c1 = await px(2, 2), m1 = await px(200, 150);
    check("▶ Vignette: the corners darker, the middle as it was (one undo step)", c1[0] < c0[0] - 20 && Math.abs(m1[0] - 128) <= 3 && (await st()).undo === 1, [c0, c1, m1]);

    /* 3 record */
    await newDoc(400, 300, "#808080");
    await tab();
    await p.click("#actNew"); await p.waitForTimeout(150);
    await p.fill(".kxdlg.pcd #actN", "My Action"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    check("＋ New Action: named, and recording starts (●)", await ev(() => window.imageEditorInstance.E.actions.recording()), await A());
    // Image Size: width 200 (the height follows)
    await p.click('#pcMenus .mi[data-menu="Image"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="image.size"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "200"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    // Canvas Size, cancelled: no step
    await p.click('#pcMenus .mi[data-menu="Image"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="image.canvas"]'); await p.waitForTimeout(200);
    await p.click(".kxdlg.pcd .cn"); await p.waitForTimeout(200);
    // a filter through its dialog
    await ev(() => window.imageEditorInstance.E.ui.run("flt.gaussian")); await p.waitForTimeout(300);
    await p.click(".kx .kxdlg .ok"); await p.waitForTimeout(300);
    // the Layers panel: a new layer, its opacity, its blend mode
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcLayers")); await p.waitForTimeout(100);
    await p.click("#kxLAdd"); await p.waitForTimeout(150);
    await p.fill("#kxLOpacityN", "40"); await p.dispatchEvent("#kxLOpacityN", "change"); await p.waitForTimeout(150);
    await p.selectOption("#kxBlend", "multiply"); await p.waitForTimeout(150);
    await tab(); await p.click("#actStop"); await p.waitForTimeout(200);
    let act = (await A())[0].actions.find((a) => a.name === "My Action");
    const kinds = act && act.steps.map((s) => s.kind + ":" + (s.id || s.what));
    check("■ stops: the steps - Image Size (with its dialog's values), Gaussian Blur (its settings), New Layer, Set Opacity 40, Set Blend Mode; the cancelled Canvas Size is not there",
      act && JSON.stringify(kinds) === JSON.stringify(["cmd:image.size", "filter:gaussian", "cmd:layer.new", "set:opacity", "set:blend"]) && act.steps[0].dialog.values.pdW === "200" && act.steps[0].dialog.changed.includes("pdW") && act.steps[1].params && act.steps[3].value === 40 && act.steps[4].value === "multiply", act);
    const recState = await st();

    /* 4 play it on another picture */
    await newDoc(400, 300, "#808080");
    const ai = (await A())[0].actions.findIndex((a) => a.name === "My Action");
    await ev((ai) => window.imageEditorInstance.E.actions.select(0, ai), ai);
    const r = await ev(async (ai) => { const E = window.imageEditorInstance.E; return await E.actions.play(E.actions.sets()[0].actions[ai], 0); }, ai);
    let s = await st();
    check("▶ played on a fresh picture: the same result (200 x 150, a new layer at 40 % multiply), no dialog left open", r.ok && s.w === 200 && s.h === 150 && s.n === recState.n && s.op === 40 && s.blend === "multiply" && s.dlg === 0, [r, s, recState]);

    /* 5 a step switched off; the dialog toggle */
    await newDoc(400, 300, "#808080");
    await ev((ai) => { const E = window.imageEditorInstance.E, a = E.actions.sets()[0].actions[ai]; a.open = true; E.actions.select(0, ai); }, ai);
    await tab();
    await p.click(`#pcActions .ar[data-a="${ai}"][data-i="2"] .ck`); await p.waitForTimeout(100);
    await p.click(`#pcActions .ar[data-a="${ai}"][data-i="0"] .md`); await p.waitForTimeout(100);
    act = (await A())[0].actions[ai];
    const pr = ev(async (ai) => { const E = window.imageEditorInstance.E; return await E.actions.play(E.actions.sets()[0].actions[ai], 0); }, ai);
    await p.waitForTimeout(600);
    const open = await ev(() => { const d = document.querySelector(".kx .kxdlg.pcd"); return d ? { w: d.querySelector("#pdW").value } : null; });
    await p.fill(".kxdlg.pcd #pdW", "100"); await p.click(".kxdlg.pcd .ok");
    const r2 = await pr; s = await st();
    check("☐ a step off is skipped; ▢ the dialog toggle stops in Image Size (its recorded 200 in it) - changed to 100 there, the rest plays on",
      act.steps[2].on === false && act.steps[0].modal === true && open && open.w === "200" && r2.ok && s.w === 100 && s.n === 1 && s.op === 40, [act.steps.map((x) => [x.on, x.modal]), open, r2, s]);

    /* 6 Insert Stop; a function key; Button Mode */
    await ev((ai) => { const E = window.imageEditorInstance.E; E.actions.select(0, ai, 4); }, ai);
    await ev(() => window.imageEditorInstance.E.ui.run("act.stop")); await p.waitForTimeout(150);
    await p.fill(".kxdlg.pcd #actM", "Check it"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(150);
    act = (await A())[0].actions[ai];
    check("Insert Stop: a Stop step after the picked one", act.steps[5] && act.steps[5].kind === "stop" && act.steps[5].msg === "Check it", act.steps.map((x) => x.kind));
    await ev((ai) => { const E = window.imageEditorInstance.E, a = E.actions.sets()[0].actions[ai]; a.steps.forEach((x) => { x.modal = false; x.on = true; }); a.key = "F8"; E.actions.setSets(E.actions.sets()); }, ai);
    await newDoc(400, 300, "#808080");
    await p.locator("#ieStage").focus(); await p.keyboard.press("F8"); await p.waitForTimeout(700);
    const stopDlg = await ev(() => { const d = document.querySelector(".kx .kxdlg.pcd"); return d ? d.textContent : ""; });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    s = await st();
    check("F8 (the action's function key) plays it; its Stop shows the message, Continue goes on", /Check it/.test(stopDlg) && s.w === 200 && s.blend === "multiply", [stopDlg, s]);
    await ev(() => window.imageEditorInstance.E.ui.run("act.buttons")); await tab();
    const btns = await ev(() => document.querySelectorAll("#pcActions .actbtns button").length);
    await ev(() => window.imageEditorInstance.E.ui.run("act.buttons"));
    check("Button Mode: a button per action", btns === 6, btns);

    /* 7 save / load */
    const saved = await ev(() => window.imageEditorInstance.E.actions.saveActions());
    check("Save Actions: a .json of the set (bitgenActions)", saved.bitgenActions === 1 && saved.sets[0].actions.length === 6);

    /* 8 batch */
    const res = await ev(async (run) => {
      const E = window.imageEditorInstance.E, files = [];
      for (const [n, c] of [["one.png", "#ff0000"], ["two.png", "#00aa00"], ["three.jpg", "#0000ff"]]) {
        const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80; const g = cv.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, 120, 80);
        const blob = await new Promise((ok) => cv.toBlob(ok, /jpg$/.test(n) ? "image/jpeg" : "image/png", 0.9)); files.push(new File([blob], n, { type: blob.type }));
      }
      files.push(new File([new Blob(["not a picture"])], "bad.png", { type: "image/png" }));
      const a = E.actions.sets()[0].actions.find((x) => x.name === "Black & White Punch");
      const rep = await E.actions.batch({ action: a, files, onError: "log", dest: "project", run, suffix: "-bw", format: "png", quality: 0.9 });
      const list = await (await fetch("/api/batch/list?run=" + encodeURIComponent(run))).json();
      const blob = await (await fetch(`/api/batch/file/${encodeURIComponent(run)}/one-bw.png`)).blob();
      const img = await createImageBitmap(blob), cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
      const d = Array.from(g.getImageData(10, 10, 1, 1).data);
      const runs = await (await fetch("/api/batch/runs")).json();
      return { rep: { done: rep.done, errors: rep.errors, saved: rep.saved }, files: list.files.map((f) => f.name), d, runs: runs.runs.map((x) => x.run) };
    }, RUN);
    check("Batch: Black & White Punch over 3 pictures (+ 1 broken file logged, the rest go on) - saved to the project's batch/<run> as <name>-bw.png",
      res.rep.done === 3 && res.rep.errors.length === 1 && /bad\.png/.test(res.rep.errors[0]) && JSON.stringify(res.files) === '["one-bw.png","three-bw.png","two-bw.png"]' && res.runs.includes(RUN), res);
    check("...each result went through the action (red came out grey)", Math.abs(res.d[0] - res.d[1]) <= 3 && Math.abs(res.d[1] - res.d[2]) <= 3, res.d);
    const done = await ev(() => { const d = document.querySelector(".kx .kxdlg.pcd"); const t = d ? d.textContent : ""; if (d) d.querySelector(".ok").click(); return t; });
    check("...a report at the end (done, where, the errors)", /3 of 4 picture\(s\) done/.test(done) && /bad\.png/.test(done), done);

    /* 9 the menus */
    const menu = await ev(() => ({ batch: !!window.imageEditorInstance.E.ui.CMD.get("act.batch"), win: window.imageEditorInstance.E.ui.CMD.get("win.pcActions").key }));
    check("File ▸ Automate: Batch…; Window ▸ Actions (Alt+F9)", menu.batch && menu.win === "Alt+F9", menu);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { for (const d of fs.readdirSync(path.join(ROOT, "projects"))) { const f = path.join(ROOT, "projects", d, "batch", RUN); if (fs.existsSync(f)) { fs.rmSync(f, { recursive: true, force: true }); try { fs.rmdirSync(path.dirname(f)); } catch { /* others */ } } } } catch { /* none */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
