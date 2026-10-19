#!/usr/bin/env node
/* bitGen Studio — 2.432.0 in a REAL browser: Settings ▸ THEMES (static/themes.js) + the UI size, and ⊞ DOCKER LAYOUT
 * keeping what is on screen + the floating panels (static/dockcfg.js, secfloat.js, ext/timelinedock/stagedock.js).
 * Tim: "create a themes tab in the settings dialog - have a ui size slider to adjust the size of fonts and the ui. save
 * the visibility status of the dockers as well, and their positions and sizes when save layout button under docker
 * layout". Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the themes / docker layout browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const KEY = "chatdock+timelinedock";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  // the dockers' record as it was (the test shows / hides dockers - the next tests get it back)
  let dsWas = null;
  try { dsWas = await api("/api/docker-status"); } catch { /* older */ }
  try {
    try { await api("/api/docker-cfg/delete", { key: KEY }); } catch { /* none */ }
    await api("/api/docker-cfg/settings", { auto: true });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { for (const k of ["h3.theme", "h3.accent", "h3.scale"]) localStorage.removeItem(k); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Theme && window.DockCfg && window.DockCfg.started && window.SecFloat && window.SecFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const css = (v) => ev((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);

    /* 1 the tab */
    await ev(() => { document.getElementById("settings").showModal(); document.querySelector('#settings [data-stab="themes"]').click(); });
    await p.waitForTimeout(200);
    const tab = await ev(() => ({ shown: getComputedStyle(document.getElementById("stab-themes")).display !== "none", cards: [...document.querySelectorAll("#s_themes [data-theme-id]")].map((x) => x.dataset.themeId), on: (document.querySelector("#s_themes .on") || {}).dataset,
      size: !!document.querySelector("#stab-themes #s_uiscale"), notGeneral: !document.querySelector("#stab-general #s_uiscale") }));
    check("Settings ▸ Themes: Dark / Darker / Slate / Light / High contrast (Dark on), the accent, the UI size slider (moved here from General)",
      tab.shown && tab.cards.join() === "dark,darker,slate,light,contrast" && tab.on && tab.on.themeId === "dark" && tab.size && tab.notGeneral, tab);

    /* 2 a theme: the app's colours, the editor's bitGen theme follows, kept after a reload */
    await p.click('#s_themes [data-theme-id="light"]'); await p.waitForTimeout(150);
    const lt = { panel: await css("--panel"), ink: await css("--ink"), text: await css("--text"), scheme: await ev(() => document.documentElement.style.colorScheme), th: await ev(() => document.documentElement.dataset.theme),
      body: await ev(() => getComputedStyle(document.body).backgroundColor) };
    check("Light: the app's colours change (panels white, text dark, the page background light, color-scheme light)", lt.panel === "#ffffff" && lt.ink === "#f3f1ec" && lt.text === "#26221b" && lt.scheme === "light" && lt.th === "light" && lt.body === "rgb(243, 241, 236)", lt);
    const kxCss = await ev(() => { const k = document.querySelector(".kx[data-theme=bitgen]"); return k ? { panel: getComputedStyle(k).getPropertyValue("--pc-panel").trim(), menu: getComputedStyle(k.querySelector(".pcmenu")).backgroundColor } : null; });
    check("...the image editor's bitGen theme follows (its panels white too - it reads the theme's --th-* colours)", !kxCss || (kxCss.panel === "#ffffff" && kxCss.menu === "rgb(255, 255, 255)"), kxCss);
    await p.fill("#s_accent", "#2266dd"); await p.dispatchEvent("#s_accent", "input"); await p.waitForTimeout(100);
    const ac = { t: await css("--tiger"), d: await css("--tiger-deep"), v: await ev(() => document.getElementById("s_accentv").textContent) };
    check("an accent of your own: --tiger is it, --tiger-deep a darker shade", ac.t === "#2266dd" && ac.d !== "#2266dd" && /^#[0-9a-f]{6}$/.test(ac.d) && ac.v === "#2266dd", ac);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Theme, null, { timeout: 30000 });
    const kept = { th: await ev(() => document.documentElement.dataset.theme), panel: await css("--panel"), t: await css("--tiger") };
    check("...kept: after a reload Light + the accent are on <html> again (before the page paints - themes.js is in <head>)", kept.th === "light" && kept.panel === "#ffffff" && kept.t === "#2266dd", kept);
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.DockCfg && window.DockCfg.started && window.SecFloat && window.SecFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { document.getElementById("settings").showModal(); document.querySelector('#settings [data-stab="themes"]').click(); });
    await p.click("#s_accentreset"); await p.click('#s_themes [data-theme-id="dark"]'); await p.waitForTimeout(100);
    check("Reset + Dark: bitGen's own colours back", await css("--tiger") === "#f59e2c" && await css("--panel") === "#1d1a15");

    /* 3 the UI size: fonts and the whole UI, 60 - 175 %, the dock's slider in step */
    await p.fill("#s_uiscale", "150"); await p.dispatchEvent("#s_uiscale", "input"); await p.waitForTimeout(100);
    const sz = await ev(() => ({ root: getComputedStyle(document.documentElement).fontSize, dock: document.getElementById("uiscale").value, v: document.getElementById("s_uiscalev").textContent, min: document.getElementById("s_uiscale").min, max: document.getElementById("s_uiscale").max, body: getComputedStyle(document.body).fontSize }));
    check("UI size 150 %: the root font 21 px (every rem-sized font and panel with it), the left dock's slider in step; 60 - 175 %", sz.root === "21px" && sz.dock === "150" && sz.v === "150%" && sz.min === "60" && sz.max === "175" && sz.body === "21px", sz);
    await p.click("#s_uiscalereset"); await p.waitForTimeout(100);
    check("...Reset = 100 % (14 px)", await ev(() => getComputedStyle(document.documentElement).fontSize) === "14px");
    await ev(() => document.getElementById("settings").close());

    /* 4 ⊞ Docker layout: Save layout keeps what is on screen + the floating panels; Load puts it back */
    const setOnly = (ids) => ev((ids) => {
      for (const [btn, id] of Object.entries(window.H3GoneDocks)) {
        const el = document.getElementById(id); if (!el) continue;
        const want = ids.includes(id), gone = el.classList.contains("dockgone");
        if (want === gone) toggleDockGone(id, btn);
        if (want && el.classList.contains("collapsed")) toggleCollapse(id);
      }
    }, ids);
    await setOnly(["timelinedock", "chatdock", "musicdock"]); await p.waitForTimeout(300);
    await ev(() => { if (!document.getElementById("musicdock").classList.contains("collapsed")) toggleCollapse("musicdock"); });   // Music: on screen, collapsed
    await ev(() => { if (!document.getElementById("app").classList.contains("no-refs")) document.getElementById("tRefs").click(); });   // References hidden
    const fid = await ev(() => Object.keys(window.SecFloat.windows)[0]);
    await ev((id) => { window.SecFloat.show(id, true); window.SecFloat.float(id, 420, 260, 380, 300); }, fid);
    await p.waitForTimeout(500);
    await p.click("#dockCfgBtn"); await p.waitForTimeout(200);
    const lbl = await ev(() => ({ save: document.getElementById("dockCfgSave").textContent, head: document.querySelector("#dockCfgPanel .dct").textContent }));
    await ev(() => document.getElementById("dockCfgSave").click()); await p.waitForTimeout(800);
    const dbg = await ev(() => ({ msg: (document.getElementById("dockCfgMsg") || {}).textContent, key: window.DockCfg.openKey() }));
    let file = {};
    for (let i = 0; i < 25; i++) { file = await api("/api/docker-cfg"); if ((file.configs || {})[KEY]) break; await p.waitForTimeout(200); }
    const v = ((file.configs || {})[KEY] || { variants: [] }).variants[0] || {};
    check("⊞ Docker layout ▸ 💾 Save layout: docker.cfg keeps which dockers are on screen (Music collapsed, the others hidden), the side docks (References hidden) and the floating panels' places / sizes",
      lbl.save === "💾 Save layout" && lbl.head === "Docker layout" && v.vis && v.vis.bottom.musicdock && v.vis.bottom.musicdock.collapsed && !v.vis.bottom.musicdock.gone && v.vis.bottom.videodock && v.vis.bottom.videodock.gone
      && v.vis.side.refs === true && v.floats && v.floats[fid] && v.floats[fid].shown && v.floats[fid].x === 420 && v.floats[fid].w === 380, { lbl, dbg, keys: Object.keys(file.configs || {}), vk: Object.keys(v), vis: v.vis, f: v.floats && v.floats[fid] });
    // change everything
    await ev(() => { if (document.getElementById("app").classList.contains("no-refs")) document.getElementById("tRefs").click(); });
    await ev((id) => { window.SecFloat.float(id, 60, 120, 300, 200); }, fid);
    await setOnly(["timelinedock", "chatdock", "videodock"]); await p.waitForTimeout(400);
    await p.click("#dockCfgBtn"); await p.waitForTimeout(150);
    if (!(await ev(() => document.getElementById("dockCfgPanel").style.display !== "none"))) { await p.click("#dockCfgBtn"); await p.waitForTimeout(150); }
    await ev((k) => { const b = document.querySelector(`#dockCfgPanel [data-dcapply="${k}"]`); if (b) b.click(); }, KEY);
    await p.waitForTimeout(900);
    const back = await ev((id) => { const g = (x) => document.getElementById(x).classList; const st = window.SecFloat.state(id);
      return { tl: !g("timelinedock").contains("dockgone") && !g("timelinedock").contains("collapsed"), ch: !g("chatdock").contains("dockgone"), video: g("videodock").contains("dockgone"),
        music: !g("musicdock").contains("dockgone") && g("musicdock").contains("collapsed"), refs: document.getElementById("app").classList.contains("no-refs"), x: st.x, w: st.w, shown: st.shown }; }, fid);
    check("Load: the layout's dockers open (the others away, Music back on screen collapsed), References hidden again, the floating panel back where it was, as big",
      back.tl && back.ch && back.video && back.music && back.refs && back.x === 420 && back.w === 380 && back.shown, back);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally {
    try { await api("/api/docker-cfg/delete", { key: KEY }); } catch { /* fine */ }
    try { if (dsWas && dsWas.docks) await api("/api/docker-status", { docks: dsWas.docks, floats: dsWas.floats || {} }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
