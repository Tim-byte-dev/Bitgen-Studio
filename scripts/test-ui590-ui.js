#!/usr/bin/env node
/* bitGen Studio — 2.590.0 in a REAL browser, against the running app (H3_URL) + a stand-in Unreal Editor started here
 * (scripts/ue-stub.js - bitGen Bridge 1.5.0):
 *   🎨 Artist mode - a labelled button right after the image editor's menus; on / Ctrl+Esc off.
 *   the image editor's TABS ARE DOCKERS - a tab dragged out floats; a tab dropped on that floating docker becomes its tab;
 *   a whole docker (⠿) dropped on another = its tabs join it; a tab dropped at a docker's bottom edge in the panel column =
 *   a docker of its own there; kept over a reload; Window ▸ Reset Docker Tabs puts every tab back.
 *   📺 the Unreal View - an Unreal layer picked = the 📺 docker shows it live (frames from the stand-in), another layer =
 *   it stops and hides; the timeline's 📺 window - an Unreal camera clip at the playhead.
 * Tim: "do i have to keep the unreal window open? show the unreal window in timeline and image-editor when selected. make
 * all the tabs in image-editor into floating dockers but allow dockers to be placed on another docker inside the main
 * docker panel ... when a docker is dropped on another docker make it a tabbed docker - i can't find the full screen
 * canvas button (lets call the full screen canvas button artist mode)". Settings put back. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.590.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

(async () => {
  const UE0 = await (await fetch(URL_ + "api/unreal/settings")).json();
  const stub = await require("./ue-stub").start(39500 + Math.floor(Math.random() * 300));
  await post("api/unreal/settings", { port: stub.port });
  try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.tabdock && window.imageEditorInstance.E.uelive, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
  };
  const box = async (sel) => { const r = await p.locator(sel).first().boundingBox(); if (!r) throw new Error("not on screen: " + sel); return r; };
  const dragTo = async (sel, x, y) => { const r = await box(sel); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + r.width / 2 + 15, r.y + r.height / 2 + 10, { steps: 3 }); await p.mouse.move(x, y, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(250); };
  try {
    await open();
    await ev(() => { window.imageEditorInstance.E.tabdock.reset(); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d"); g.fillStyle = "#406080"; g.fillRect(0, 0, 640, 360); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui590"); setTimeout(ok, 700); }));

    /* ---------------- 🎨 Artist mode */
    const am = await ev(() => { const F = document.getElementById("kxFocus"), r = F.getBoundingClientRect(), M = document.getElementById("pcMenus"); return { after: M.nextElementSibling === F, label: F.textContent.trim(), w: r.width, vis: r.width > 0 && r.right <= document.getElementById("pcMenu").getBoundingClientRect().right }; });
    check("🎨 Artist mode: a labelled button right after the menus, on screen even in a narrow editor (the menu bar wraps instead of cutting it off)", am.after && am.label === "🎨 Artist mode" && am.w > 60 && am.vis && await ev(() => { const m = document.getElementById("pcMenu").getBoundingClientRect(); return [...document.querySelectorAll("#pcMenu .mr > button")].every((x) => { const r = x.getBoundingClientRect(); return !x.offsetWidth || (r.right <= m.right + 1 && r.bottom <= m.bottom + 1); }); }), am);
    await p.click("#kxFocus"); await p.waitForTimeout(300);
    const on = await ev(() => document.body.classList.contains("ie-focus") && !document.getElementById("pcMenu").offsetWidth);
    await p.keyboard.press("Control+Escape"); await p.waitForTimeout(300);
    check("Artist mode on = only the canvas; Ctrl+Esc = back", on && await ev(() => !document.body.classList.contains("ie-focus") && !!document.getElementById("pcMenu").offsetWidth));
    // the rest wants the editor wide (its panel column on screen): full screen with bitGen's bars
    await ev(() => window.imageEditorInstance.E.setFull(true)); await p.waitForTimeout(600);

    /* ---------------- the tabs are dockers */
    await ev(() => { const s = document.querySelector('.pctabs [data-tab="pcSwatches"]'); if (s) s.scrollIntoView(); });
    const stage = await box("#ieStage");
    await dragTo('.pctabs [data-tab="pcSwatches"]', stage.x + 160, stage.y + 140);
    const f1 = await ev(() => { const b = document.querySelector('.pctabs [data-tab="pcSwatches"]'), g = b.closest(".pcgrp"), w = g.parentElement;
      return { win: w.classList.contains("pctdw"), tabs: [...g.querySelectorAll(":scope > .pctabs > button[data-tab]")].map((x) => x.dataset.tab), body: g.contains(document.getElementById("pcSwatches")) && document.getElementById("pcSwatches").classList.contains("on"),
        colorLeft: [...document.querySelectorAll('.pcgrp[data-g="color"] > .pctabs > button[data-tab]')].map((x) => x.dataset.tab), g: g.dataset.g }; });
    check("a tab dragged out onto the canvas = a FLOATING docker of its own (its content with it); its old docker keeps the other tabs",
      f1.win && f1.tabs.join() === "pcSwatches" && f1.body && !f1.colorLeft.includes("pcSwatches") && f1.colorLeft.includes("pcColor"), f1);
    const fw = await box(".pctdw:not(.off)");
    await dragTo('.pctabs [data-tab="pcPaths"]', fw.x + fw.width / 2, fw.y + fw.height / 2);
    const f2 = await ev((g) => ({ tabs: [...document.querySelectorAll(`.pcgrp[data-g="${g}"] > .pctabs > button[data-tab]`)].map((x) => x.dataset.tab), on: document.getElementById("pcPaths").classList.contains("on") }), f1.g);
    check("a tab dropped on that floating docker = a TAB of it (shown)", f2.tabs.join() === "pcSwatches,pcPaths" && f2.on, f2);
    const pr = await box('.pcgrp[data-g="props"]');
    await dragTo(`.pcgrp[data-g="${f1.g}"] > .pctabs > .pctdgrip`, pr.x + pr.width / 2, pr.y + pr.height / 2);
    const f3 = await ev((g) => ({ gone: !document.querySelector(`.pcgrp[data-g="${g}"]`), wins: document.querySelectorAll(".pctdw").length, props: [...document.querySelectorAll('.pcgrp[data-g="props"] > .pctabs > button[data-tab]')].map((x) => x.dataset.tab) }), f1.g);
    check("a whole docker (⠿) dropped on another = all its tabs join it, the floating docker goes", f3.gone && f3.props.includes("pcSwatches") && f3.props.includes("pcPaths"), f3);
    const lg = await box('.pcgrp[data-g="layers"]');
    await dragTo('.pctabs [data-tab="pcHistory"]', lg.x + lg.width / 2, lg.y + lg.height - 4);
    const f4 = await ev(() => { const g = document.querySelector('.pctabs [data-tab="pcHistory"]').closest(".pcgrp"), col = document.getElementById("pcPanels"), kids = [...col.querySelectorAll(":scope > .pcgrp")].filter((x) => !x.classList.contains("off"));
      return { inCol: g.parentElement === col, own: [...g.querySelectorAll(":scope > .pctabs > button[data-tab]")].length === 1, afterLayers: kids.indexOf(g) === kids.indexOf(document.querySelector('.pcgrp[data-g="layers"]')) + 1 }; });
    check("a tab dropped at a docker's bottom edge in the panel column = a docker of its own there (below it)", f4.inCol && f4.own && f4.afterLayers, f4);
    await p.waitForTimeout(400);
    await open();
    const f5 = await ev(() => { const h = document.querySelector('.pctabs [data-tab="pcHistory"]').closest(".pcgrp"); return { hist: h.dataset.g, histCol: h.parentElement === document.getElementById("pcPanels"), sw: document.querySelector('.pctabs [data-tab="pcSwatches"]').closest(".pcgrp").dataset.g }; });
    check("kept over a reload: History in its own docker in the column, Swatches in Properties", /^td\d+$/.test(f5.hist) && f5.histCol && f5.sw === "props", f5);
    await ev(() => window.imageEditorInstance.E.tabdock.reset());
    const f6 = await ev(() => ["pcSwatches:color", "pcPaths:layers", "pcHistory:layers"].every((x) => { const [t, g] = x.split(":"); return document.querySelector('.pctabs [data-tab="' + t + '"]').closest(".pcgrp").dataset.g === g; }) && !document.querySelector('.pcgrp[data-g^="td"] > .pctabs > button[data-tab="pcHistory"]'));
    check("Window ▸ Reset Docker Tabs: every tab back where it started", f6);

    /* ---------------- 📺 the Unreal View (image editor) */
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; c.getContext("2d").fillRect(0, 0, 640, 360); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui590b"); setTimeout(ok, 600); }));
    await ev(async () => { const E = window.imageEditorInstance.E, u = { kind: "scene", camera: { name: "CineCam_Wide" }, w: 640, h: 360 }; const c = await E.unreal.take(u); E.unreal.addLayer(c, u, "UE scene"); E.refresh(); E.renderLayersPanel(); });
    await p.waitForFunction(() => { const i = document.querySelector("#kueLiveView img"); return i && i.naturalWidth > 0 && window.imageEditorInstance.E.uelive.view.frames() >= 2; }, null, { timeout: 30000 });
    const u1 = await ev(() => { const g = document.querySelector('.pctabs [data-tab="kuelive"]').closest(".pcgrp"), w = g.parentElement; return { float: w.classList.contains("pctdw") && !w.classList.contains("off"), st: document.querySelector('#kueLiveView [data-u="st"]').textContent, img: document.querySelector("#kueLiveView img").naturalWidth }; });
    const calls = stub.calls.filter((c) => c.cmd === "frame");
    check("📺 an Unreal layer picked: the Unreal View docker shows (floating) and streams frames of its camera (bridge 'frame', the camera named, the picked size)",
      u1.float && /live · .* fps/.test(u1.st) && u1.img === 640 && calls.length >= 2 && calls[calls.length - 1].args.camera.name === "CineCam_Wide" && calls[calls.length - 1].args.w === 640, { u1, last: calls[calls.length - 1] });
    await ev(() => { const E = window.imageEditorInstance.E; E.S.active = 0; E.renderLayersPanel(); E.refresh(); });
    await p.waitForTimeout(1200);
    const n1 = stub.calls.filter((c) => c.cmd === "frame").length; await p.waitForTimeout(1200); const n2 = stub.calls.filter((c) => c.cmd === "frame").length;
    const u2 = await ev(() => { const g = document.querySelector('.pctabs [data-tab="kuelive"]').closest(".pcgrp"); return { hidden: g.parentElement.classList.contains("off"), running: window.imageEditorInstance.E.uelive.view.running() }; });
    check("another layer picked: the view stops (no more frames asked) and its floating docker hides again", u2.hidden && !u2.running && n2 === n1, { u2, n1, n2 });

    /* ---------------- 📺 the timeline */
    const tl = await ev(async () => {
      const C = window.TlCanvas; if (!C || !window.TlUELive) return { missing: true };
      window.__sel0 = C.selClip;
      const clip = { start: 0, in: 0, ue: { kind: "camera", dur: 4, w: 640, h: 360, keys: [{ t: 0, loc: [0, 0, 100], rot: [0, 0, 0], fov: 50 }, { t: 4, loc: [400, 0, 100], rot: [0, 0, 90], fov: 30 }] } };
      tl.vlayers.push(mkLayer("UE test", [clip]));   // 2.618.0: an Unreal clip shows only while it is on a (shown) layer
      C.selClip = () => ({ c: clip });
      try { playhead = 2; } catch (e) { C.state.t = 2; }   // the timeline's playhead (S.t follows it)
      for (let i = 0; i < 80 && window.TlUELive.view.frames() < 2; i++) await new Promise((r) => setTimeout(r, 150));
      const shown = window.TlUELive.box.shown(), frames = window.TlUELive.view.frames();
      C.selClip = window.__sel0;
      tl.vlayers = tl.vlayers.filter((L) => L.name !== "UE test");
      await new Promise((r) => setTimeout(r, 900));
      return { shown, frames, after: window.TlUELive.box.shown() };
    });
    const tcall = stub.calls.filter((c) => c.cmd === "frame").pop();
    check("timeline: an Unreal camera clip picked = the 📺 window over the preview, its camera at the playhead (between the keys); unpicked = hidden",
      !tl.missing && tl.shown && tl.frames >= 2 && !tl.after && tcall && tcall.args.camera.loc[0] === 200 && Math.abs(tcall.args.camera.rot[2] - 45) < 1e-6, { tl, args: tcall && tcall.args });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { window.imageEditorInstance.E.tabdock.reset(); window.imageEditorInstance.E.setFull(false); }); } catch { /* closed */ }
    try { await post("api/unreal/settings", { port: UE0.port }); } catch { /* fine */ }
    await b.close();
    await stub.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
