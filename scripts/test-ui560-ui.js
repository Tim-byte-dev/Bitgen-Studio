#!/usr/bin/env node
/* bitGen Studio — 2.560.0 in a REAL browser: the ▣ docker DOCKS by its title bar (the blue drop zone at a docker's edge -
 * above Preview / beside it), comes back docked after a reload, its title bar dragged out floats it again; Basic Settings
 * and the prompt docker dragged by their title bars go IN a ▣ docker, come back in it after a reload, and its small title
 * bar dragged out floats them on their own again (static/dgdock.js, static/dockgroup.js).
 * Tim: "the new docker is now at the right z level but won't dock and won't allow other dockers to doc in it".
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.560.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const open = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && document.getElementById("dgFloat_musicdock") && document.getElementById("tDG"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
  };
  const serverLay = async (ok) => { let o = {}; for (let i = 0; i < 40; i++) { o = await ev(() => fetch("/api/layout/panel").then((r) => r.json())); if (ok(o)) return o; await p.waitForTimeout(400); } return o; };
  const rectOf = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
  const drag = async (a, b, steps) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 12, a.y + 6, { steps: 3 }); await p.mouse.move(b.x, b.y, { steps: steps || 16 }); };
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && window.H3DGDock && window.SecFloat && window.SecFloat.started && window.PFloat && window.PFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(2500);
  };
  try {
    await open(); await boot();
    await ev(() => { const pd = document.getElementById("promptdock"); if (pd && pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); const pv = document.getElementById("previewdock"); if (pv.classList.contains("collapsed")) toggleCollapse("previewdock"); if (pv.classList.contains("dockgone")) toggleDockGone("previewdock", "tPv"); });
    await p.keyboard.press("Control+Alt+KeyD");
    await p.waitForFunction(() => window.H3DockGroup.shown(), null, { timeout: 8000 });
    await ev(() => H3Panels.float("fd-dockers", { x: 760, y: 520, w: 640, h: 300 }));
    await p.waitForTimeout(600);
    // 1 the ▣ docker docks above Preview by its title bar
    const bar = await rectOf('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n');
    const pv = await rectOf("#previewdock");
    await drag(bar, { x: pv.x, y: pv.t + 12 });
    const mid = await ev(() => { const z = document.getElementById("dgZone"); return { on: !!z && z.style.display === "block", label: z ? z.textContent : "" }; });
    await p.mouse.up(); await p.waitForTimeout(800);
    const d1 = await ev(() => { const d = document.getElementById("dgp_fd-dockers"), pv = document.getElementById("previewdock"); const r = H3Panels.get("fd-dockers");
      return { d: !!d, docked: !!d && d.classList.contains("dg-docked"), before: !!d && d.nextElementSibling === pv, col: !!d && d.parentElement && d.parentElement.id, win: !!d && d.contains(r.win), dock: r.perm && r.perm.dock, h: d ? Math.round(d.getBoundingClientRect().height) : 0 }; });
    check("a floating ▣ docker dragged by its title bar to Preview's top edge shows the blue drop zone (\"Dock Docker above Preview\")", mid.on && /above/i.test(mid.label), mid);
    check("...let go = it docks there: a docker in the column right above Preview, its window in it, kept (perm.dock top of previewdock)",
      d1.d && d1.docked && d1.before && d1.win && d1.dock && d1.dock.to === "previewdock" && d1.dock.side === "top" && d1.h > 100, d1);
    await serverLay((o) => o.dockers && o.dockers["fd-dockers"] && o.dockers["fd-dockers"].perm && o.dockers["fd-dockers"].perm.dock && o.dockers["fd-dockers"].perm.dock.to === "previewdock");
    // 2 Basic Settings goes IN it
    await ev(() => { SecFloat.show("basic", true); SecFloat.float("basic", 120, 140, 330, 360); });
    await p.waitForTimeout(400);
    const sfh = await rectOf("#sf-basic > .sfhead .sft");
    const pane = await rectOf("#dgp_fd-dockers .h3fd-pane");
    await drag(sfh, { x: pane.x, y: pane.y });
    const mid2 = await ev(() => { const z = document.getElementById("dgZone"); return { on: !!z && z.style.display === "block", label: z ? z.textContent : "", outlined: H3Panels.get("fd-dockers").win.classList.contains("dg-target") }; });
    await p.mouse.up(); await p.waitForTimeout(800);
    const b1 = await ev(() => { const r = H3Panels.get("sf.basic"), el = document.getElementById("sf-basic"); return { st: r && r.state, dk: r && r.docker, inWin: !!el && H3Panels.get("fd-dockers").win.contains(el), dgin: el.classList.contains("dg-in"), steps: !!el.querySelector("#steps"), float: el.classList.contains("df-float"), h: Math.round(el.getBoundingClientRect().height) }; });
    check("Basic Settings dragged by its title bar over the ▣ docker: outlined, the orange line + \"Basic Settings → Docker\"", mid2.on && /Basic Settings → Docker/.test(mid2.label) && mid2.outlined, mid2);
    check("...let go = IN the ▣ docker (its own settings inside, filling its place)", b1.st === "in" && b1.dk === "fd-dockers" && b1.inWin && b1.dgin && b1.steps && !b1.float && b1.h > 60, b1);
    // 3 the prompt docker too
    await ev(() => PFloat.float(150, 560, 520, 240));
    await p.waitForTimeout(400);
    const pfh = await rectOf("#promptdock > .bhead");
    const pane2 = await rectOf("#dgp_fd-dockers .h3fd-pane");
    await drag({ x: pfh.l + 60, y: pfh.y }, { x: pane2.l + pane2.w * 0.72, y: pane2.y });
    await p.mouse.up(); await p.waitForTimeout(800);
    const pf1 = await ev(() => { const r = H3Panels.get("pf.promptdock"), el = document.getElementById("promptdock"); return { st: r && r.state, inWin: H3Panels.get("fd-dockers").win.contains(el), float: el.classList.contains("pf-float"), tabs: H3Panels.get("fd-dockers").tabs }; });
    check("the prompt docker dragged by its title bar goes in too (beside Basic Settings)", pf1.st === "in" && pf1.inWin && !pf1.float && pf1.tabs.length === 2, pf1);
    await serverLay((o) => o.panels && o.panels["sf.basic"] && o.panels["sf.basic"].state === "in" && o.panels["pf.promptdock"] && o.panels["pf.promptdock"].state === "in");
    // 4 after a reload
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(2500);
    const r2 = await ev(() => { const d = document.getElementById("dgp_fd-dockers"), pv = document.getElementById("previewdock"), w = H3Panels.get("fd-dockers").win;
      return { docked: !!d && d.classList.contains("dg-docked") && d.nextElementSibling === pv, basic: w.contains(document.getElementById("sf-basic")), prompt: w.contains(document.getElementById("promptdock")), st: (H3Panels.get("sf.basic") || {}).state }; });
    check("after a reload: the ▣ docker docked above Preview again, Basic Settings and the prompt docker in it", r2.docked && r2.basic && r2.prompt && r2.st === "in", r2);
    // 5 Basic Settings out by its small title bar
    const mt = await rectOf('#dgp_fd-dockers .h3fp[data-fp="sf.basic"] > .h3fp-t');
    await drag({ x: mt.l + 30, y: mt.y }, { x: 300, y: 260 });
    await p.mouse.up(); await p.waitForTimeout(800);
    const o1 = await ev(() => { const el = document.getElementById("sf-basic"); return { st: (H3Panels.get("sf.basic") || {}).state, float: el.classList.contains("df-float"), dgin: el.classList.contains("dg-in"), body: el.parentElement === document.body, shown: getComputedStyle(el).display !== "none", tabs: H3Panels.get("fd-dockers").tabs }; });
    check("Basic Settings dragged out by its small title bar floats on its own again (its own window, not in the ▣ docker)", o1.st === "home" && o1.float && !o1.dgin && o1.body && o1.shown && o1.tabs.join() === "pf.promptdock", o1);
    // 6 the docked ▣ docker's title bar dragged away floats it
    const hd = await rectOf("#dgp_fd-dockers > .bhead");
    await drag({ x: hd.l + 40, y: hd.y }, { x: 700, y: 400 });
    await p.mouse.up(); await p.waitForTimeout(800);
    const f1 = await ev(() => { const r = H3Panels.get("fd-dockers"); return { st: r.state, wrap: !!document.getElementById("dgp_fd-dockers"), perm: !!r.perm, shown: !r.win.classList.contains("off"), pv: !!document.querySelector("#maincol > #previewdock, #maincol .pf-row > #previewdock") }; });
    check("its title bar dragged away floats the ▣ docker again (no docker in the column; Preview where it was)", f1.st === "float" && !f1.wrap && !f1.perm && f1.shown && f1.pv, f1);
    // 7 beside: a floating ▣ docker dropped at Preview's right edge
    const bar2 = await rectOf('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n'), pv2 = await rectOf("#previewdock");
    await drag(bar2, { x: pv2.r - 10, y: pv2.y });
    await p.mouse.up(); await p.waitForTimeout(800);
    const s1 = await ev(() => { const d = document.getElementById("dgp_fd-dockers"), row = d && d.parentElement; return { row: !!row && row.classList.contains("df-row"), order: row ? [...row.children].map((c) => c.id) : [], dock: (H3Panels.get("fd-dockers").perm || {}).dock }; });
    check("dropped at Preview's right edge it docks beside it (a row: Preview, the ▣ docker)", s1.row && s1.order[0] === "previewdock" && s1.order[1] === "dgp_fd-dockers" && s1.dock && s1.dock.side === "right", s1);
    await ev(() => H3DockGroup.remove("fd-dockers", true)); await p.waitForTimeout(500);
    const g1 = await ev(() => ({ row: !!document.querySelector("#maincol .df-row"), pv: document.getElementById("previewdock").parentElement.id, prompt: document.getElementById("promptdock").classList.contains("pf-float") || !!document.getElementById("promptdock").closest("#maincol") }));
    check("🗑 the docked ▣ docker: the row goes, Preview back in the column, the prompt docker that was in it floats on its own", !g1.row && g1.pv === "maincol" && g1.prompt, g1);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { fs.rmSync(LAYF, { force: true }); } catch (e) { /* fine - no ▣ docker left for the next test */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
