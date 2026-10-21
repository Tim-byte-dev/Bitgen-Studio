#!/usr/bin/env node
/* bitGen Studio — 2.561.0 in a REAL browser: a ▣ docker dropped on the SEAM between two columns (References | Assets, the
 * main column | Queue) becomes a column of its own - the full height, its splitter sizes it, back after a reload, ▾ folds
 * it to a strip, its title bar dragged away floats it again and the grid is the app's own again (static/dgdock.js).
 * Tim: "new docker docks, but allow it to also dock between vertical dockers so it becomes a new vertical docker".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.561.0 browser test did not run"); process.exit(0); }
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
  const order = () => ev(() => [...document.getElementById("app").children].filter((k) => getComputedStyle(k).display !== "none" && getComputedStyle(k).position !== "fixed").map((k) => k.id || (k.dataset.resize ? "split:" + k.dataset.resize : k.className)));
  const seam = (before) => ev((b) => { const s = H3DGDock.seams().find((x) => x.before === b); const a = document.getElementById("app").getBoundingClientRect(); return s ? { x: s.x, y: a.top + a.height * 0.55 } : null; }, before);
  try {
    await open(); await boot();
    await ev(() => { const a = document.getElementById("app"); if (a.classList.contains("no-refs")) document.getElementById("tRefs").click(); if (a.classList.contains("no-assets")) document.getElementById("tAssets").click();
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(500);
    await p.keyboard.press("Control+Alt+KeyD");
    await p.waitForFunction(() => window.H3DockGroup.shown(), null, { timeout: 8000 });
    await ev(() => H3Panels.float("fd-dockers", { x: 760, y: 300, w: 520, h: 300 }));
    await p.waitForTimeout(600);
    const s1 = await seam("assetsdock");
    check("the seams: References | Assets is one (the window's edges and every two columns)", !!s1, await ev(() => H3DGDock.seams()));
    const bar = await rectOf('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n');
    await drag(bar, s1);
    const mid = await ev(() => { const z = document.getElementById("dgZone"); const r = z ? z.getBoundingClientRect() : null; return { on: !!z && z.style.display === "block", label: z ? z.textContent : "", h: r ? r.height : 0 }; });
    await p.mouse.up(); await p.waitForTimeout(900);
    check("dragged by its title bar onto the seam: a tall blue strip \"New column: Docker between References and Assets\"", mid.on && /New column: Docker between References and Assets/.test(mid.label) && mid.h > 300, mid);
    const o1 = await order();
    const c1 = await ev(() => { const d = document.getElementById("dgp_fd-dockers"), a = document.getElementById("app"), r = d ? d.getBoundingClientRect() : {}, ar = a.getBoundingClientRect();
      return { col: !!d && d.classList.contains("dg-col"), w: Math.round(r.width || 0), h: Math.round(r.height || 0), ah: Math.round(ar.height), grid: a.style.gridTemplateColumns, refs: Math.round(document.getElementById("refsdock").getBoundingClientRect().width), assets: Math.round(document.getElementById("assetsdock").getBoundingClientRect().width), main: Math.round(document.getElementById("maincol").getBoundingClientRect().width), dock: (H3Panels.get("fd-dockers").perm || {}).dock, win: d && d.contains(H3Panels.get("fd-dockers").win) }; });
    const i = o1.indexOf("dgp_fd-dockers");
    check("let go = a column of its own between them: References, its splitter, the ▣ column, its splitter, Assets", i > 0 && o1[i - 2] === "refsdock" && o1[i - 1] === "split:refs" && o1[i + 1] === "dgcs_fd-dockers" && o1[i + 2] === "assetsdock", o1);
    check("...the full height, 340 px wide, the other columns still there; kept as perm.dock {col, before assetsdock}",
      c1.col && c1.win && Math.abs(c1.w - 340) <= 3 && c1.h >= c1.ah - 4 && c1.refs > 60 && c1.assets > 60 && c1.main > 190 && /340px/.test(c1.grid) && c1.dock && c1.dock.mode === "col" && c1.dock.before === "assetsdock", c1);
    const sp = await rectOf("#dgcs_fd-dockers");
    await p.mouse.move(sp.x, sp.y); await p.mouse.down(); await p.mouse.move(sp.x + 50, sp.y, { steps: 5 }); await p.mouse.move(sp.x + 100, sp.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(500);
    const w2 = await ev(() => Math.round(document.getElementById("dgp_fd-dockers").getBoundingClientRect().width));
    check("its splitter sizes it (+100 px)", Math.abs(w2 - 440) <= 4, w2);
    await serverLay((o) => o.dockers && o.dockers["fd-dockers"] && o.dockers["fd-dockers"].perm && o.dockers["fd-dockers"].perm.dock && o.dockers["fd-dockers"].perm.dock.dw >= 436);
    // Basic Settings into the column ▣ docker
    await ev(() => { SecFloat.show("basic", true); SecFloat.float("basic", 900, 160, 330, 360); }); await p.waitForTimeout(400);
    const sfh = await rectOf("#sf-basic > .sfhead .sft"), pane = await rectOf("#dgp_fd-dockers .h3fd-pane");
    await drag(sfh, { x: pane.x, y: pane.y }); await p.mouse.up(); await p.waitForTimeout(800);
    check("Basic Settings dragged over the column ▣ docker goes in it", (await ev(() => (H3Panels.get("sf.basic") || {}).state === "in" && H3Panels.get("fd-dockers").win.contains(document.getElementById("sf-basic")))));
    // reload
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(2500);
    const o2 = await order(), w3 = await ev(() => { const d = document.getElementById("dgp_fd-dockers"); return d ? Math.round(d.getBoundingClientRect().width) : 0; });
    const j = o2.indexOf("dgp_fd-dockers");
    check("after a reload: the column back between References and Assets, 440 px, Basic Settings in it",
      j > 0 && o2[j - 2] === "refsdock" && o2[j + 2] === "assetsdock" && Math.abs(w3 - 440) <= 4 && (await ev(() => H3Panels.get("fd-dockers").win.contains(document.getElementById("sf-basic")))), { o2, w3 });
    // ▾ folds it to a strip
    const hd = await rectOf("#dgp_fd-dockers > .bhead");
    await p.mouse.click(hd.l + 10, hd.t + 10); await p.waitForTimeout(500);
    const wc = await ev(() => Math.round(document.getElementById("dgp_fd-dockers").getBoundingClientRect().width));
    check("▾ folds the column to a narrow strip", wc <= 40, wc);
    await p.mouse.click(hd.l + 10, hd.t + 10); await p.waitForTimeout(500);
    // to the right of the main column: its title bar dragged onto the main column | Queue seam
    const hasQ = await ev(() => document.getElementById("qdock").getBoundingClientRect().width > 60);
    if (hasQ) {
      const hd2 = await rectOf("#dgp_fd-dockers > .bhead");
      await p.mouse.move(hd2.l + 40, hd2.t + 12); await p.mouse.down(); await p.mouse.move(hd2.l + 60, hd2.t + 40, { steps: 4 });
      await p.waitForTimeout(200);
      const s2 = await seam("qdock");
      await p.mouse.move(s2.x, s2.y, { steps: 16 }); await p.mouse.up(); await p.waitForTimeout(900);
      const o3 = await order(), k = o3.indexOf("dgp_fd-dockers");
      check("torn out by its title bar and dropped on the main column | Queue seam: the main column, its splitter, the ▣ column, Queue's splitter, Queue", k > 0 && o3[k - 2] === "maincol" && o3[k - 1] === "dgcs_fd-dockers" && o3[k + 1] === "split:qdock" && o3[k + 2] === "qdock" && o3.indexOf("dgcs_fd-dockers") === k - 1, o3);
    } else check("(Queue column hidden here - the right-side seam not tried)", true);
    // dragged away = floats, the app's own grid again
    const hd3 = await rectOf("#dgp_fd-dockers > .bhead");
    await drag({ x: hd3.l + 40, y: hd3.t + 12 }, { x: 800, y: 420 }); await p.mouse.up(); await p.waitForTimeout(800);
    const f1 = await ev(() => ({ st: H3Panels.get("fd-dockers").state, wrap: !!document.getElementById("dgp_fd-dockers"), sp: !!document.getElementById("dgcs_fd-dockers"), grid: document.getElementById("app").style.gridTemplateColumns, main: Math.round(document.getElementById("maincol").getBoundingClientRect().width) }));
    check("its title bar dragged away floats it; no column, no splitter, the app's own grid", f1.st === "float" && !f1.wrap && !f1.sp && f1.grid === "" && f1.main > 300, f1);
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
