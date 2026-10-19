#!/usr/bin/env node
/* bitGen Studio — 2.514.0 in a REAL browser: DOCKERS (side dockers fold to a strip; the image editor's dockers fold,
 * close, View ▸ Dockers with ✓) and EDIT THEME MODE (hide, text, size, handles, move, the leaving box, themes/<name>.tmp).
 * Tim: "when the dockers are docked make them into dropdowns ... when user closes a docker close it. show dockers
 * visibility in view->dockers->all dockers<tick mark if visible> / when in edit mode allow user to hide the element and to
 * change the text. allow user to resize elements height x width / add handles to the selected element ... / when user
 * exits ... offer msgbox to save theme, save theme as, reset theme / when working on theme use theme name.tmp".
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder. No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.514 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const THEMES = path.join(ROOT, "themes");
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.panels && window.H3SideCollapse && window.H3ThemeEdit, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { try { localStorage.removeItem("h3.sc.ldock"); } catch (e) { /* fine */ } H3SideCollapse.set("ldock", false); localStorage.removeItem("h3.themeStyles"); H3ThemeEdit.setStyles({}); });

    /* 1. a side docker folds to a strip */
    const w0 = await ev(() => document.getElementById("ldock").getBoundingClientRect().width);
    await p.click("#ldock .sccaret"); await p.waitForTimeout(300);
    const f1 = await ev(() => ({ w: document.getElementById("ldock").getBoundingClientRect().width, cls: document.getElementById("app").classList.contains("sc-ldock"), scroll: getComputedStyle(document.querySelector("#ldock > .scroll")).display, title: getComputedStyle(document.querySelector("#ldock > .dockhead h1")).display }));
    await p.click("#ldock > .dockhead"); await p.waitForTimeout(300);
    const w2 = await ev(() => document.getElementById("ldock").getBoundingClientRect().width);
    check("a side docker's ▾ folds it to a thin strip with its title (its content hidden); a click on the strip opens it again", w0 > 100 && f1.cls && f1.w <= 32 && f1.scroll === "none" && f1.title !== "none" && Math.abs(w2 - w0) < 2, { w0, f1, w2 });

    /* 2. the image editor's dockers */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; ["layers", "color", "props"].forEach((g) => { E.panels.open(g); E.panels.fold(g, false); }); });
    await p.waitForTimeout(300);
    const L = '#pcPanels > .pcgrp[data-g="layers"]';
    const h0 = await ev((s) => document.querySelector(s).getBoundingClientRect().height, L);
    await p.click(L + " .pccaret"); await p.waitForTimeout(300);
    const fo = await ev((s) => { const g = document.querySelector(s); return { h: g.getBoundingClientRect().height, tabs: g.querySelector(".pctabs").getBoundingClientRect().height, col: g.classList.contains("pccol"), car: g.querySelector(".pccaret").textContent }; }, L);
    await p.click(L + " .pctabs button[data-tab]"); await p.waitForTimeout(300);
    const un = await ev((s) => document.querySelector(s).classList.contains("pccol"), L);
    check("docked: the Layers group's ▾ folds it to its tab strip (▸); a tab opens it again", fo.col && fo.car === "▸" && fo.h <= fo.tabs + 3 && h0 > fo.h + 40 && !un, { h0, fo, un });
    await p.click(L + " .pcx"); await p.waitForTimeout(300);
    const cl = await ev((s) => ({ off: document.querySelector(s).classList.contains("off"), vis: window.imageEditorInstance.E.panels.visible("layers") }), L);
    await p.click('#pcMenus .mi[data-menu="View"]'); await p.waitForTimeout(200);
    await p.hover('.kxmenu .sub:has-text("Dockers")'); await p.waitForTimeout(250);
    const items = await ev(() => [...document.querySelectorAll('.kxmenu[data-depth="1"] [data-cmd]')].map((d) => [d.dataset.cmd, d.classList.contains("chk")]));
    await p.click('.kxmenu [data-cmd="view.dock.layers"]'); await p.waitForTimeout(300);
    const back = await ev(() => window.imageEditorInstance.E.panels.visible("layers"));
    check("✕ closes the Layers group; View ▸ Dockers lists All Dockers + the editor's dockers - Layers without ✓, Colour / Properties with ✓; clicking Layers brings it back",
      cl.off && !cl.vis && items[0][0] === "view.dock.all" && !items[0][1] && items.some((x) => x[0] === "view.dock.layers" && !x[1]) && items.some((x) => x[0] === "view.dock.color" && x[1]) && items.some((x) => x[0] === "view.dock.props" && x[1]) && back, { cl, items, back });
    await ev(() => window.imageEditorInstance.E.panels.float("color")); await p.waitForTimeout(400);
    await p.click('.h3fp[data-fp="ie.color"] .h3fp-x'); await p.waitForTimeout(300);
    const fc = await ev(() => { const P = H3Panels.get("ie.color"); return { st: P.state, off: P.el.classList.contains("off"), vis: window.imageEditorInstance.E.panels.visible("color") }; });
    await ev(() => window.imageEditorInstance.E.ui.run("view.dock.all")); await p.waitForTimeout(300);
    const all = await ev(() => ["layers", "color", "props"].every((g) => window.imageEditorInstance.E.panels.visible(g)));
    check("a FLOATING group's ✕ closes it (back in the column, hidden); View ▸ Dockers ▸ All Dockers shows every one again", fc.st === "home" && fc.off && !fc.vis && all, { fc, all });
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(500);

    /* 3. edit theme mode */
    const name = await ev(() => H3Theme.current().name || "Untitled");
    for (const f of [name + ".tmp", "zzTheme514.json", "zzTheme514.tmp"]) fs.rmSync(path.join(THEMES, f), { force: true });   // a run before may have left them
    await p.click("#thEditBtn"); await p.waitForTimeout(400);
    const tgt = "#resetModels";
    await p.click(tgt); await p.waitForTimeout(400);
    const panelOk = await ev(() => !!document.getElementById("thEditPanel") && document.getElementById("teScope").value === "#resetModels" && !!document.querySelector("#thEditHandles .teh[data-dir=e]"));
    await p.fill("#teText", "Eject"); await p.waitForTimeout(250);
    await p.fill("#teW", "120"); await p.dispatchEvent("#teW", "input"); await p.waitForTimeout(250);
    const t1 = await ev((s) => { const el = document.querySelector(s); return { text: (el.querySelector(".h3lb") || {}).textContent, w: Math.round(el.getBoundingClientRect().width) }; }, tgt);
    check("edit theme mode: the picked ⏏ button gets a Style panel with handles; Text = its words replaced; W 120 = 120 px wide", panelOk && t1.text === "Eject" && t1.w === 120, { panelOk, t1 });
    const hb = await p.locator('#thEditHandles .teh[data-dir="e"]').boundingBox();
    await p.mouse.move(hb.x + 4, hb.y + 4); await p.mouse.down(); await p.mouse.move(hb.x + 44, hb.y + 4, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const hb2 = await p.locator('#thEditHandles .teh[data-dir="w"]').boundingBox();
    await p.mouse.move(hb2.x + 4, hb2.y + 4); await p.mouse.down(); await p.mouse.move(hb2.x - 16, hb2.y + 4, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const r1 = await ev(() => H3ThemeEdit.styles()["#resetModels"]);
    await ev(() => { const P = document.getElementById("thEditPanel"); P.style.left = "900px"; P.style.top = "300px"; P.dataset.moved = "1"; });   // out of the way of the element
    const eb = await p.locator(tgt).boundingBox();
    await p.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2); await p.mouse.down(); await p.mouse.move(eb.x + eb.width / 2 + 30, eb.y + eb.height / 2 + 12, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
    const r2 = await ev(() => Object.assign({}, H3ThemeEdit.styles()["#resetModels"], { panel: document.getElementById("teDx").value }));
    check("the handles: the right one +40 px wider (160), the left one 20 px wider again with the right edge kept (180, moved -20); dragging the element moves it (+30, +12) and the panel follows",
      r1.w === 180 && r1.dx === -20 && r2.dx === 10 && r2.dy === 12 && r2.panel === "10", { r1, r2 });
    await p.check("#teHide"); await p.waitForTimeout(500);
    const faint = await ev((s) => getComputedStyle(document.querySelector(s)).opacity, tgt);
    const tmpFile = path.join(THEMES, name + ".tmp");
    const hasTmp = () => fs.existsSync(tmpFile) && /resetModels/.test(fs.readFileSync(tmpFile, "utf8"));
    for (let k = 0; k < 30 && !hasTmp(); k++) await p.waitForTimeout(200);   // written 500 ms after the change (a cold server: longer)
    const tmpThere = hasTmp();
    check("Hide: faint and dashed while editing (so it can be picked again); every change written to themes/<name>.tmp", +faint < 0.5 && tmpThere, { faint, tmpFile, tmpThere });
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    await p.click("#thEditBtn"); await p.waitForTimeout(400);
    const boxUp = await ev(() => ({ box: !!document.getElementById("thExitBox"), on: H3ThemeEdit.isOn(), btns: [...document.querySelectorAll("#thExitBox button")].map((x) => x.textContent.trim()) }));
    check("leaving with changes: a box - Save theme / Save theme as… / Reset theme / Not now / Cancel (edit mode stays on until one is chosen)", boxUp.box && boxUp.on && /Save theme/.test(boxUp.btns[0]) && boxUp.btns.includes("Save theme as…") && boxUp.btns.includes("↺ Reset theme") && boxUp.btns.includes("Not now") && boxUp.btns.includes("Cancel"), boxUp);
    await p.click("#thxReset"); await p.waitForTimeout(800);
    const afterReset = await ev((s) => ({ on: H3ThemeEdit.isOn(), rule: H3ThemeEdit.styles()["#resetModels"] || null, disp: getComputedStyle(document.querySelector(s)).display, text: document.querySelector(s).textContent.trim() }), tgt);
    check("↺ Reset theme: back to how it was (no rule, shown, its own words), edit mode left, the .tmp removed", !afterReset.on && !afterReset.rule && afterReset.disp !== "none" && afterReset.text === "⏏" && !fs.existsSync(tmpFile), { afterReset, tmp: fs.existsSync(tmpFile) });
    // save as
    await p.click("#thEditBtn"); await p.waitForTimeout(300);
    await p.click(tgt); await p.waitForTimeout(300); await p.check("#teHide"); await p.waitForTimeout(300);
    await p.keyboard.press("Escape"); await p.click("#thEditBtn"); await p.waitForTimeout(300);
    await p.click("#thxAs"); await p.fill("#thxName", "zzTheme514"); await p.click("#thxAsGo"); await p.waitForTimeout(1200);
    const saved = path.join(THEMES, "zzTheme514.json");
    const sv = await ev((s) => ({ on: H3ThemeEdit.isOn(), disp: getComputedStyle(document.querySelector(s)).display, name: H3Theme.current().name }), tgt);
    check("Save theme as…: themes/zzTheme514.json holds the hidden element; live mode hides it; the theme is now that one; no .tmp left",
      fs.existsSync(saved) && /"hide": true/.test(fs.readFileSync(saved, "utf8")) && !sv.on && sv.disp === "none" && sv.name === "zzTheme514" && !fs.existsSync(tmpFile) && !fs.existsSync(path.join(THEMES, "zzTheme514.tmp")), sv);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await ev(() => { H3ThemeEdit.setStyles({}); H3Theme.choose("dark"); localStorage.removeItem("h3.sc.ldock"); H3SideCollapse.set("ldock", false); }); } catch { /* closed */ }
    try { await fetch(URL_ + "api/themes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "zzTheme514" }) }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
