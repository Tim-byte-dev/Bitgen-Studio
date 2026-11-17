#!/usr/bin/env node
/* bitGen Studio — 2.809.0 against the RUNNING app (+ a real browser): the image editor's right-click menu - Copy, Paste,
 * 🎨 Artist Mode; in artist mode Show Layers + ⏳ Pending, 🟧 Blender Scene, ✨ Prompt, Exit Artist Mode.
 * Tim (verbatim): "in image editor right click context menu add copy, paste, artist mode, when in artist mode add show layers,
 * blender scene,prompt, exit artist mode". No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.focusMenu, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); });   // the editor full size (the stage has room)
    await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "menu809.png", (g) => { g.fillStyle = "#3366aa"; g.fillRect(0, 0, 400, 300); }));
    await p.waitForTimeout(500);
    const menu = async () => {
      const r = await ev(() => { const s = window.imageEditorInstance.E.stage.getBoundingClientRect(); return { x: s.left + s.width / 2, y: s.top + s.height / 2 }; });
      await p.mouse.click(r.x, r.y, { button: "right" }); await p.waitForTimeout(300);
      return ev(() => { const m = [...document.querySelectorAll(".kxmenu")].pop(); return m ? [...m.querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd) : []; });
    };
    const close = () => p.keyboard.press("Escape");
    const m1 = await menu();
    check("right-click on the canvas: Copy and Paste (after the clicked thing's own items, before Duplicate / Delete), 🎨 Artist Mode at the end", m1.indexOf("edit.copy") >= 0 && m1.indexOf("edit.paste") === m1.indexOf("edit.copy") + 1 && m1.indexOf("layer.dup") > m1.indexOf("edit.paste") && m1[m1.length - 1] === "view.focus", m1);
    check("…and no artist-mode items outside artist mode", !m1.some((c) => /^focus\./.test(c)), m1);
    await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "view.focus"); await p.waitForTimeout(700);
    check("🎨 Artist Mode from the menu turns it on", await ev(() => window.imageEditorInstance.E.focus.on()));
    const m2 = await menu();
    check("in artist mode: Copy, Paste … then Show Layers, 🟧 Blender Scene, ✨ Prompt, Exit Artist Mode", m2.includes("edit.copy") && m2.includes("edit.paste") && m2.slice(-4).join() === "focus.layers,focus.blender,focus.prompt,focus.exit" && !m2.includes("view.focus"), m2);
    await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "focus.layers"); await p.waitForTimeout(500);
    check("Show Layers: the Layers panel + ⏳ Pending over the canvas (Alt+G)", await ev(() => window.imageEditorInstance.E.focus.side()));
    const m3 = await menu();
    const chk = await ev(() => { const d = [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="focus.layers"]'); return d && d.classList.contains("chk"); });
    check("…ticked in the menu while shown", chk && m3.includes("focus.layers"), chk);
    await close();
    // ✨ Prompt: the prompt docker brought over the canvas
    let fronted = 0; await ev(() => { const P = window.H3PromptFront; window.__pf = 0; if (P) { const f = P.front; P.front = function () { window.__pf++; return f.apply(this, arguments); }; } });
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "focus.prompt"); await p.waitForTimeout(500);
    fronted = await ev(() => window.__pf);
    check("✨ Prompt brings the prompt docker over the canvas (H3PromptFront.front)", fronted === 1, fronted);
    await ev(() => { if (window.H3PromptFront && H3PromptFront.unlift) H3PromptFront.unlift(); const d = document.getElementById("promptdock"); if (d && !d.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(400);
    // 🟧 Blender Scene: the scene tools open / close (a stand-in for the timeline's tools - no Blender here)
    await ev(() => { window.__att = 0; window.TlBlend = { state: { st: null, meta: {}, frame: 1, view: "scene", E: [] }, attach(h) { window.__att++; this._h = h; return Promise.resolve(null); }, detach() { this._h = null; }, host() { return this._h; }, open: () => Promise.resolve(null), snapshot: () => null, view: () => null }; });
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "focus.blender"); await p.waitForTimeout(600);
    const bl = await ev(() => ({ att: window.__att, open: window.imageEditorInstance.E.blendLayer.isOpen() }));
    check("🟧 Blender Scene opens the Blender scene tools over the canvas", bl.att === 1 && bl.open, bl);
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "focus.blender"); await p.waitForTimeout(400);
    check("…again closes them", !(await ev(() => window.imageEditorInstance.E.blendLayer.isOpen())));
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "focus.exit"); await p.waitForTimeout(600);
    check("Exit Artist Mode leaves it", !(await ev(() => window.imageEditorInstance.E.focus.on())));
    // Copy / Paste work from the menu
    await p.waitForTimeout(600);
    await ev(() => { const s = window.imageEditorInstance.E.stage.getBoundingClientRect(); if (s.height < 50) { const f = document.getElementById("kxFull"); if (f) f.click(); } });   // the editor full size again (this test's small window)
    await p.waitForTimeout(600);
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "edit.copy"); await p.waitForTimeout(200);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await menu(); await ev((c) => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="' + c + '"]').click(), "edit.paste"); await p.waitForTimeout(400);
    const n1 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    check("Copy then Paste from the menu: a pasted layer", n1 === n0 + 1, { n0, n1 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
