#!/usr/bin/env node
/* bitGen Studio — 2.646.0 in a REAL browser: 🎨 ARTIST MODE - Alt+P the colour palette, Ctrl+P the prompt docker over the canvas,
 * Alt+G the Layers panel + ⏳ Pending, and a picture generated from the picked layer without leaving artist mode.
 * Tim (verbatim): "change artist mode colour pallet to alt P, and let user press ctrl P for artist mode, alt G will open the
 * layers panel and pending docker in artist mode so user can still generate an image from the layer they are working on in
 * artist mode". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.646.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.focus && window.H3PromptFront, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    // the prompt docker floating (so opening it with Ctrl+P does not squeeze the image editor's column - its own narrow rule)
    await ev(() => { if (window.PFloat && PFloat.float) PFloat.float(320, 220, 640, 300); });
    // a picture with two layers; the second picked
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(800, 600, "artist646", (g) => { g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); });
      const L = E.makeLayer("sketch"); const g = L.canvas.getContext("2d"); g.fillStyle = "#e03020"; g.fillRect(300, 200, 200, 200); E.addLayer(L, "sketch", false); E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(500);
    const panels0 = await ev(() => !!document.getElementById("pcPanels").offsetWidth);
    await ev(() => window.imageEditorInstance.E.focus.set(true)); await p.waitForTimeout(500);
    const vis = (sel) => ev((sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40)); return !!t && el.contains(t); }, sel);
    check("🎨 artist mode on: the canvas alone (no Layers panel, no Pending)", await ev(() => document.body.classList.contains("ie-focus")) && !(await vis("#pcLayers")) && !(await vis("#pcPend")));

    // Alt+P: the palette (Ctrl+P no longer)
    await p.mouse.move(800, 500); await p.keyboard.press("Alt+p"); await p.waitForTimeout(250);
    check("Alt+P: the colour palette at the pointer", await ev(() => !!document.getElementById("pcFocusPal")));
    await p.keyboard.press("Alt+p"); await p.waitForTimeout(150);
    check("…Alt+P again closes it", await ev(() => !document.getElementById("pcFocusPal")));

    // Alt+G: Layers + Pending over the canvas
    await p.mouse.move(800, 500); await p.keyboard.press("Alt+g"); await p.waitForTimeout(400);
    const side = await ev(() => { const L = document.getElementById("pcLayers"), col = document.getElementById("pcPanels"), r = col.getBoundingClientRect(), st = document.getElementById("ieStage").getBoundingClientRect();
      return { on: window.imageEditorInstance.E.focus.side(), layersTab: !!document.querySelector('#pcPanels button[data-tab="pcLayers"].on'), rows: L.querySelectorAll(".lyr, .kxlyr, [data-id], [data-lid]").length, right: Math.round(innerWidth - r.right), w: Math.round(r.width),
        others: [...col.children].filter((g) => !g.contains(L) && !g.contains(document.getElementById("pcPend")) && getComputedStyle(g).display !== "none").length, stageFull: st.width >= innerWidth - 4, pend: !document.getElementById("pcPend").classList.contains("off") }; });
    check("Alt+G: the Layers panel on the right, over the canvas (the canvas stays full size), its Layers tab picked, the other panels not shown", side.on && side.layersTab && side.right < 40 && side.w >= 200 && side.others === 0 && side.stageFull && await vis("#pcLayers"), side);
    check("…and ⏳ Pending shown", side.pend && await vis("#pcPend"), side);
    check("…still artist mode (no menus, tools, property bar)", await ev(() => document.body.classList.contains("ie-focus") && ["pcMenu", "kxTools", "kxBar"].every((id) => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === "none" || !e.offsetWidth; })));
    // pick the first layer in the panel
    const picked = await ev(() => { const E = window.imageEditorInstance.E; const before = E.S.active; const row = [...document.querySelectorAll("#pcLayers [data-i], #pcLayers [data-id]")].find((r) => /sketch/.test(r.textContent)) ; if (row) row.click(); return { before, after: E.S.active, name: E.layer() && E.layer().name, row: !!row }; });
    check("a layer picked in that panel is the editor's layer", picked.name === "sketch", picked);

    // Ctrl+P: the prompt docker over the artist canvas
    await p.mouse.move(800, 500); await p.keyboard.press("Control+p"); await p.waitForTimeout(600);
    const pr = await ev(() => ({ seen: !H3PromptFront.coveredBy(), focus: (document.activeElement || {}).id, z: (document.querySelector(".pf-front") || { style: {} }).style.zIndex, artist: document.body.classList.contains("ie-focus") }));
    check("Ctrl+P in artist mode: the prompt docker over the full-screen canvas, the prompt box focused, artist mode stays", pr.seen && pr.focus === "prompt" && pr.artist && +pr.z > 2147483000, pr);
    check("…the palette did not open", await ev(() => !document.getElementById("pcFocusPal")));

    // generate from the picked layer: the prompt docker's ▾ Edit -> its button -> a result in ⏳ Pending
    const gen = await ev(async () => {
      const E = window.imageEditorInstance.E; let n = 0; window.__done646 = {};
      E.api.aiedit = async (req) => { const id = "art" + (++n); const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.fillStyle = "#22cc88"; g.fillRect(0, 0, c.width, c.height); window.__done646[id] = c.toDataURL("image/png"); return { jobs: [{ id, seed: 1 }] }; };   // the server's answer: {jobs}
      E.api.awaitResult = (id) => Promise.resolve(window.__done646[id]);                                     // -> the result's url
      if (E.imgOp && E.imgOp.set) E.imgOp.set("edit");
      const gm = document.getElementById("genModeSel"); if (gm && gm.value !== "image") { gm.value = "image"; gm.dispatchEvent(new Event("change")); }
      document.getElementById("prompt").value = "make the red square a green gem";
      const c0 = document.querySelectorAll("#pcPend .ppc").length;
      document.getElementById("go").click();
      for (let t = 0; t < 50 && document.querySelectorAll("#pcPend .ppc").length <= c0; t++) await new Promise((r) => setTimeout(r, 100));
      return { cards: document.querySelectorAll("#pcPend .ppc").length - c0, asked: n, artist: document.body.classList.contains("ie-focus"), label: document.getElementById("go").textContent };
    });
    check("the prompt docker's ✏ Edit in artist mode: the picked layer goes to the edit model, the result waits in ⏳ Pending - artist mode stays", gen.asked >= 1 && gen.cards >= 1 && gen.artist, gen);

    // Alt+G again: hidden; artist mode off: everything back
    await ev(() => document.getElementById("ieStage").focus()); await p.mouse.move(400, 500);
    await p.keyboard.press("Alt+g"); await p.waitForTimeout(300);
    check("Alt+G again hides the Layers panel and Pending (artist mode stays)", !(await ev(() => window.imageEditorInstance.E.focus.side())) && !(await vis("#pcLayers")) && await ev(() => document.body.classList.contains("ie-focus")));
    await ev(() => window.imageEditorInstance.E.focus.set(false)); await p.waitForTimeout(400);
    const off = await ev(() => ({ focus: document.body.classList.contains("ie-focus"), sideCls: document.body.classList.contains("ie-focus-side"), marks: [...document.querySelectorAll(".pcfocus-side, .pcfocus-sidehide, .pcfocus-hide")].map((e) => e.id || e.className).slice(0, 6), panels: !!document.getElementById("pcPanels").offsetWidth, kx: document.getElementById("ieKx").className, w: document.getElementById("imageeditdock").offsetWidth }));
    check("artist mode off: the panels and menus as before (no side marks left)", !off.focus && !off.sideCls && !off.marks.length && off.panels === panels0, { off, panels0 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E; if (E && E.focus) E.focus.set(false); if (window.H3PromptFront) H3PromptFront.unlift(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
