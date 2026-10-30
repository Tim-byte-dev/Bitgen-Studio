#!/usr/bin/env node
/* bitGen Studio — 2.618.0 in a REAL browser: A BRIDGE LAYER DELETED OR HIDDEN = ITS BRIDGE CLOSED, ITS SCENE NOT SHOWN.
 * Tim: "when the blender or unreal or daz layer is deleted or made "hidden" or deleted then close the bridge and don't show
 * the scene in image editor or timeline".
 *   image editor: an Unreal layer streaming in 📺 -> hidden: no more frames, the picture gone, the docker hidden; shown +
 *   picked: live again; deleted: closed. A Blender layer with the scene tools open -> hidden: the tools close, NO new
 *   layer is made, the scene closes (the timeline's 🟧 preview too, POST /api/blendview/close). A 3D (Daz / Blender)
 *   layer -> deleted: POST /api/layer3d/<id>/close + /api/daz/live/clear.
 *   timeline: an Unreal clip on a layer streaming in its 📺 window -> the layer hidden (👁): closed + hidden; the clip
 *   deleted: closed.
 * Against the running app (H3_URL) + the stand-in Unreal Editor (scripts/ue-stub.js). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.618.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (u, b) => (await fetch(URL_ + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

(async () => {
  const UE0 = await (await fetch(URL_ + "api/unreal/settings")).json().catch(() => ({}));
  const stub = await require("./ue-stub").start(39800 + Math.floor(Math.random() * 150));
  await post("api/unreal/settings", { port: stub.port });
  try { await post("api/docker-status", { docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }); } catch { /* older */ }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const reqs = []; p.on("request", (r) => { if (r.method() === "POST" && /\/api\/(blendview\/close|layer3d\/[^/]+\/close|daz\/live\/clear)/.test(r.url())) reqs.push(r.url().replace(/^https?:\/\/[^/]+/, "")); });
  const ev = (f, a) => p.evaluate(f, a);
  const frames = () => stub.calls.filter((c) => c.cmd === "frame").length;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.uelive && window.imageEditorInstance.E.bridgeOff && window.TlBlend && window.TlUELive, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); window.imageEditorInstance.E.setFull(true); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; c.getContext("2d").fillRect(0, 0, 640, 360); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui618"); setTimeout(ok, 700); }));

    /* ---- image editor: an Unreal layer */
    await ev(async () => { const E = window.imageEditorInstance.E, u = { kind: "scene", camera: { name: "CineCam_Wide" }, w: 640, h: 360 }; const c = await E.unreal.take(u); E.unreal.addLayer(c, u, "UE scene"); E.refresh(); E.renderLayersPanel(); });
    await p.waitForFunction(() => window.imageEditorInstance.E.uelive.view.frames() >= 2, null, { timeout: 30000 });
    await ev(() => { const E = window.imageEditorInstance.E; E.layer().visible = false; E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(1200);
    const h1 = frames(); await p.waitForTimeout(1200); const h2 = frames();
    const u1 = await ev(() => { const E = window.imageEditorInstance.E, g = document.querySelector('.pctabs [data-tab="kuelive"]').closest(".pcgrp");
      return { running: E.uelive.view.running(), img: !!document.querySelector("#kueLiveView img"), st: document.querySelector('#kueLiveView [data-u="st"]').textContent, hidden: g.parentElement.classList.contains("off") }; });
    check("image editor: the Unreal layer HIDDEN (👁) - the 📺 live view closes: no more frames asked, the picture gone, its docker hidden",
      !u1.running && !u1.img && /hidden - its view is closed/.test(u1.st) && u1.hidden && h2 === h1, { u1, h1, h2 });
    await ev(() => { const E = window.imageEditorInstance.E; E.layer().visible = true; E.refresh(); E.renderLayersPanel(); });
    await p.waitForFunction(() => window.imageEditorInstance.E.uelive.view.running(), null, { timeout: 15000 }).catch(() => {});
    const back = await ev(() => window.imageEditorInstance.E.uelive.view.running());
    await ev(() => { const E = window.imageEditorInstance.E; E.deleteLayer ? E.deleteLayer() : E.ui.run("layer.delete"); E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(1200);
    const d1 = frames(); await p.waitForTimeout(1200); const d2 = frames();
    const u2 = await ev(() => ({ running: window.imageEditorInstance.E.uelive.view.running(), img: !!document.querySelector("#kueLiveView img"), st: document.querySelector('#kueLiveView [data-u="st"]').textContent }));
    check("…shown again: live again; DELETED: closed (no frames, no picture)", back && !u2.running && !u2.img && /deleted - its view is closed/.test(u2.st) && d2 === d1, { back, u2, d1, d2 });

    /* ---- image editor: a 3D (Daz / Blender) layer */
    reqs.length = 0;
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      E.structOp("new 3D layer", () => { const L = E.makeLayer("3D: daz scene", S.w, S.h, "pixel"); L.l3d = { id: "zz618", name: "daz scene", cam: null, pose: {}, objs: {} }; S.layers = E.D.insert(S.layers, L, null, false); S.active = S.layers.indexOf(L); });
      E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.deleteLayer ? E.deleteLayer() : E.ui.run("layer.delete"); E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(1000);
    check("a 3D (Daz / Blender) layer DELETED: its scene's Blender is closed and Daz's waiting commands dropped", reqs.includes("/api/layer3d/zz618/close") && reqs.includes("/api/daz/live/clear"), reqs);

    /* ---- image editor: a Blender layer with the scene tools open */
    reqs.length = 0;
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      E.structOp("new Blender layer", () => { const L = E.makeLayer("🟧 demo", S.w, S.h, "pixel"); L.bscene = { stem: "demo618", source: "/nowhere/demo618.blend" }; S.layers = E.D.insert(S.layers, L, null, false); S.active = S.layers.indexOf(L); });
      E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(800);
    await ev(() => { window.TlBlend.state.st = { stem: "demo618" }; window.imageEditorInstance.E.blendLayer.start(); });   // the scene "open" (no Blender here)
    await p.waitForFunction(() => window.imageEditorInstance.E.blendLayer.isOpen() && window.TlBlend.host(), null, { timeout: 15000 });
    await p.waitForTimeout(500);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => { window.TlBlend.state.st = { stem: "demo618" }; const E = window.imageEditorInstance.E; E.blendLayer.target().visible = false; E.refresh(); E.renderLayersPanel(); });
    await p.waitForTimeout(1000);
    const bl = await ev(() => { const E = window.imageEditorInstance.E; return { open: E.blendLayer.isOpen(), wrap: document.getElementById("ieBlendWrap").style.display, host: !!window.TlBlend.host(), n: E.S.layers.length, st: window.TlBlend.state.st, on: window.TlBlend.state.on,
      tl: document.getElementById("tlBlendView").classList.contains("on"), home: document.getElementById("tlBlendView").parentElement.id }; });
    check("a Blender layer HIDDEN with the scene tools open: the tools close, NO new layer is made, the scene closes (the timeline's 🟧 preview too) and the server forgets it",
      !bl.open && bl.wrap === "none" && !bl.host && bl.n === n0 && bl.st === null && !bl.on && !bl.tl && bl.home === "tlCanvasWrap" && reqs.includes("/api/blendview/close"), { bl, n0, reqs });

    /* ---- timeline: an Unreal clip on a layer */
    await ev(() => window.imageEditorInstance.E.setFull(false));
    const t0 = await ev(async () => {
      const C = window.TlCanvas;
      const d = document.getElementById("timelinedock"); if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      const clip = { name: "ue.mp4", src: "video", start: 0, in: 0, out: 4, dur: 4, ue: { kind: "camera", dur: 4, w: 640, h: 360, keys: [{ t: 0, loc: [0, 0, 100], rot: [0, 0, 0], fov: 50 }, { t: 4, loc: [400, 0, 100], rot: [0, 0, 90], fov: 30 }] } };
      tl.vlayers.push(mkLayer("UE1", [clip])); tlSave(); renderTimeline();
      window.__ue = clip; C.select(clip, C.layerOf(clip));
      for (let i = 0; i < 80 && window.TlUELive.view.frames() < 2; i++) await new Promise((r) => setTimeout(r, 150));
      return { shown: window.TlUELive.box.shown(), frames: window.TlUELive.view.frames() };
    });
    await ev(() => { const L = tl.vlayers.find((x) => x.name === "UE1"); L.visible = false; tlSave(); renderTimeline(); });
    await p.waitForTimeout(1200);
    const a1 = frames(); await p.waitForTimeout(1000); const a2 = frames();
    const t1 = await ev(() => ({ shown: window.TlUELive.box.shown(), running: window.TlUELive.view.running(), img: !!document.querySelector("#tlUELive img") }));
    check("timeline: an Unreal clip streaming in its 📺 window - its LAYER HIDDEN (👁): the view closes (no frames, no picture) and the window hides",
      t0.shown && t0.frames >= 2 && !t1.shown && !t1.running && !t1.img && a2 === a1, { t0, t1, a1, a2 });
    await ev(async () => { const L = tl.vlayers.find((x) => x.name === "UE1"); L.visible = true; tlSave(); renderTimeline(); window.TlCanvas.select(window.__ue, window.TlCanvas.layerOf(window.__ue));
      for (let i = 0; i < 60 && !window.TlUELive.view.running(); i++) await new Promise((r) => setTimeout(r, 150)); });
    const again = await ev(() => window.TlUELive.view.running() && window.TlUELive.box.shown());
    await ev(() => { const L = tl.vlayers.find((x) => x.name === "UE1"); L.clips = []; tlSave(); renderTimeline(); });
    await p.waitForTimeout(1200);
    const t2 = await ev(() => ({ shown: window.TlUELive.box.shown(), running: window.TlUELive.view.running() }));
    check("…shown again + picked: live again; the CLIP DELETED: closed and hidden", again && !t2.shown && !t2.running, { again, t2 });
    await ev(() => { tl.vlayers = tl.vlayers.filter((x) => x.name !== "UE1"); tlSave(); renderTimeline(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { window.imageEditorInstance.E.setFull(false); }); } catch { /* closed */ }
    try { await post("api/unreal/settings", { port: UE0.port }); } catch { /* fine */ }
    await b.close();
    await stub.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
