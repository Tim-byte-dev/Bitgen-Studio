#!/usr/bin/env node
/* bitGen Studio — 2.445.0 in a REAL browser: THE GRID BUTTONS + THE GRIDS & GUIDES SETTINGS TABS - the image editor (⊞ on
 * its top bar, ⚙ ▸ Grids & Guides) and the timeline's preview canvas (⊞ in its menu bar, ⚙ Timeline settings ▸ Grids &
 * Guides). Tim: "Add a grid toggle button to the top toolbar in video docker and image editor docker ... add a tab for
 * grids/guides, grid spacing, major grid spacing, lines or dots, grid color, guideline color, guideline snap distance."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. SHOTS=<dir> keeps pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the grids browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  let tlBefore = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.gridSpec && window.TlGrid && window.H3Grid, null, { timeout: 60000 });
    await p.waitForFunction(() => typeof cfg === "object" && cfg && cfg.ui, null, { timeout: 20000 }).catch(() => null);
    tlBefore = await ev(() => JSON.stringify((cfg.ui || {}).tl_grid || null));
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => { const E = window.imageEditorInstance.E; E.docs.setTabs(true); E.openDoc(400, 300, "grid.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); }); E.S.grid = false; E.drawOverlay(); });
    await p.waitForTimeout(300);
    const ov = (x, y) => ev(([x, y]) => Array.from(document.getElementById("ieOverlay").getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);

    /* 1 the editor: ⊞ on the top bar */
    const g1 = await ev(() => { const b2 = document.getElementById("kxGridBtn"); return { inBar: !!b2 && b2.parentElement.classList.contains("mr"), beforeFull: !!b2 && b2.nextElementSibling && b2.nextElementSibling.id === "kxFull" }; });
    await p.click("#kxGridBtn"); await p.waitForTimeout(200);
    const g2 = await ev(() => ({ grid: window.imageEditorInstance.E.S.grid, on: document.getElementById("kxGridBtn").classList.contains("on") }));
    check("the image editor: ⊞ on its top bar (before ⛶) turns the grid on", g1.inBar && g1.beforeFull && g2.grid && g2.on, { g1, g2 });

    /* 2 ⚙ ▸ Grids & Guides: spacing 50, major every 2, dots, red at full strength, the guideline colour, the snap distance */
    await p.click("#kxPrefs"); await p.waitForTimeout(250);
    const tabs = await ev(() => [...document.querySelectorAll("#pcPrefs [data-prtab]")].map((x) => x.textContent));
    await ev(() => document.querySelector('#pcPrefs [data-prtab="grid"]').click());
    await ev(() => { const set = (id, v) => { const x = document.getElementById(id); x.value = v; };
      set("igrSp", "50"); set("igrMj", "2"); set("igrSt", "dots"); set("igrGc", "#ff0000"); set("igrGo", "100"); set("igrGd", "#00ff00"); set("igrSn", "14");
      document.querySelector("#pcPrefs .ok").click(); });
    await p.waitForTimeout(300);
    const sn = await ev(() => { const SN = window.imageEditorInstance.E.guides.settings; return { gridPx: SN.gridPx, major: SN.gridMajor, style: SN.gridStyle, color: SN.gridColor, op: SN.gridOpacity, guide: SN.color, dist: SN.dist }; });
    const dotA = await ov(50, 50), between = await ov(50, 25), dotMajor = await ov(100, 100);
    await shot("2-dots");
    check("⚙ ▸ Grids & Guides (a tab of the editor's settings): spacing, major every, lines / dots, grid colour + strength, guideline colour, snap distance - all kept",
      tabs.includes("Grids & Guides") && sn.gridPx === 50 && sn.major === 2 && sn.style === "dots" && sn.color === "#ff0000" && sn.op === 1 && sn.guide === "#00ff00" && sn.dist === 14, { tabs, sn });
    check("...drawn as DOTS: red at the crossings (50,50) and the major one (100,100), nothing between them", dotA[0] > 150 && dotA[3] > 100 && dotMajor[0] > 150 && between[3] < 10, { dotA, dotMajor, between });
    await ev(() => { const E = window.imageEditorInstance.E; E.guides.settings.gridStyle = "lines"; E.drawOverlay(); });
    const line = await ov(50, 25);
    check("...as lines: the line between them is drawn", line[3] > 100 && line[0] > 150, line);
    await p.click("#kxGridBtn"); await p.waitForTimeout(150);
    const off = await ov(50, 25);
    check("⊞ again: the grid off", off[3] < 10 && !(await ev(() => document.getElementById("kxGridBtn").classList.contains("on"))), off);
    await ev(() => { const SN = window.imageEditorInstance.E.guides.settings; Object.assign(SN, { gridPx: 0, gridMajor: 5, gridStyle: "lines", gridColor: "#2680eb", gridOpacity: 0.35, color: "#00b7ff", dist: 8 }); window.imageEditorInstance.E.store.set("snap", SN); });
    await p.click("#kxFull"); await p.waitForTimeout(600);

    /* 3 the timeline's preview canvas: ⊞ in its menu bar */
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      if (window.TlFloat) TlFloat.show(false);
    });
    await p.waitForTimeout(800);
    const t1 = await ev(() => { const b2 = document.getElementById("tlGridBtn"); return { inBar: !!b2 && b2.parentElement.id === "tlbar", afterTools: !!b2 && b2.previousElementSibling && b2.previousElementSibling.id === "tlFloatTog" }; });
    await ev(() => TlGrid.save({ tl_grid: H3Grid.clean({ on: false, spacing: 100, major: 0, style: "lines", color: "#ff0000", opacity: 1 }) }));
    await p.click("#tlGridBtn"); await p.waitForTimeout(500);
    const t2 = await ev(() => { const S = TlCanvas.state, v = S.view, c = document.getElementById("tlCanvas"), k = c.width / c.clientWidth, g = c.getContext("2d");
      const at = (x, y) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data);
      return { on: TlGrid.spec().on, btn: document.getElementById("tlGridBtn").classList.contains("on"), W: S.W, line: at(v.ox + 100 * v.z, v.oy + 37 * v.z), mid: at(v.ox + 50 * v.z, v.oy + 37 * v.z), z: v.z };
    });
    await shot("3-timeline");
    check("the timeline: ⊞ in its menu bar (beside 🧰) turns the grid on over the preview canvas - red on the line at 100 px, not between", t1.inBar && t1.afterTools && t2.on && t2.btn && t2.line[0] > 120 && t2.line[1] < 120 && !(t2.mid[0] > 200 && t2.mid[1] < 60), { t1, t2 });

    /* 4 ⚙ Timeline settings ▸ Grids & Guides */
    await ev(() => TimelineSettings.open("grid")); await p.waitForTimeout(300);
    const ts = await ev(() => ({ tabs: [...document.querySelectorAll("#tlsDlg [data-tlstab]")].map((x) => x.textContent), shown: getComputedStyle(document.querySelector('#tlsDlg [data-tlsbody="grid"]')).display !== "none", sp: document.getElementById("tlgSp").value, on: document.getElementById("tlgOn").checked }));
    await ev(() => { const set = (id, v) => { document.getElementById(id).value = v; }; set("tlgSp", "64"); set("tlgMj", "4"); set("tlgSt", "dots"); set("tlgGd", "#123456"); set("tlgSn", "11"); document.getElementById("tlsSave").click(); });
    await p.waitForFunction(() => !document.getElementById("tlsDlg").open, null, { timeout: 8000 }).catch(() => null);
    const saved = await (await fetch(URL_ + "api/config")).json();
    const tg = (saved.ui || {}).tl_grid || {};
    check("⚙ Timeline settings: General + Grids & Guides tabs; the grid's settings shown (spacing 100, on) and saved in the settings file (64, every 4, dots, the guideline colour, snap 11)",
      ts.tabs.join() === "General,Grids & Guides" && ts.shown && ts.sp === "100" && ts.on && tg.spacing === 64 && tg.major === 4 && tg.style === "dots" && tg.guideColor === "#123456" && tg.snap === 11 && tg.on === true, { ts, tg });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlGrid && document.getElementById("tlGridBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    check("...after a reload the ⊞ is still on (the settings file)", await ev(() => document.getElementById("tlGridBtn").classList.contains("on")));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await fetch(URL_ + "api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui: { tl_grid: tlBefore ? JSON.parse(tlBefore) : { on: false } } }) }); } catch { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
