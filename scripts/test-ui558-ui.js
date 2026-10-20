#!/usr/bin/env node
/* bitGen Studio — 2.558.0 in a REAL browser: the ▣ docker in the app's floating band (not 9300 over every docker), the ▣
 * dockers outlined while a docker is dragged, a SIDE docker (References) dragged in by its title bar - its column closes,
 * a stand-in keeps the grid in order, ⇲ puts it back where it was - and the StoryBoard has its ⇱ (static/dockgroup.js).
 * Tim: "the new docker still doesn't work. i suspect it's z-index it too high = putting it above all other dockers so
 * nothing can find its drop zones". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.558.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const keep = fs.existsSync(LAYF) ? fs.readFileSync(LAYF) : null;
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
  try {
    await open();
    await ev(() => { const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP");
      if (document.getElementById("app").classList.contains("no-refs")) document.getElementById("tRefs").click(); });
    await p.keyboard.press("Control+Alt+KeyD");
    await p.waitForFunction(() => window.H3DockGroup.shown(), null, { timeout: 8000 });
    await ev(() => H3Panels.float("fd-dockers", { x: 700, y: 380, w: 760, h: 380 }));
    await p.waitForTimeout(1300);
    const z = await ev(() => { const w = H3Panels.get("fd-dockers").win; return { z: getComputedStyle(w).zIndex, app: w.classList.contains("dg-app") }; });
    check("the ▣ docker sits in the app's floating band (z 45 - the prompt docker 44, Basic Settings 47) - not 9300 over everything", z.app && z.z === "45", z);
    { const pn = await ev(() => { const r = H3Panels.get("fd-dockers").win.querySelector(".h3fd").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await p.mouse.click(pn.x, pn.y); await p.waitForTimeout(150); }
    check("...a press on it brings it to the front of that band (48)", (await ev(() => getComputedStyle(H3Panels.get("fd-dockers").win).zIndex)) === "48");
    const before = await ev(() => { const a = document.getElementById("app"), d = document.getElementById("refsdock"); return { n: a.children.length, i: [...a.children].indexOf(d), prev: d.previousElementSibling && d.previousElementSibling.id, btn: !!document.getElementById("dgFloat_refsdock"), sb: document.getElementById("videodock").dataset.dgDrag === "1" }; });
    check("References (a side docker) has ⇱ and is dragged in by its title; the StoryBoard (its own ⇱) by its title bar too", before.btn && before.sb, before);
    const head = await ev(() => { const h = document.querySelector("#refsdock > .dockhead h1"), r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });   // its title (not its ▾ / 📌)
    const tgt = await ev(() => { const r = document.querySelector('.h3fp[data-fp="fd-dockers"] .h3fd-pane').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(head.x, head.y); await p.mouse.down(); await p.mouse.move(tgt.x, tgt.y, { steps: 14 });
    const mid = await ev(() => ({ outlined: H3Panels.get("fd-dockers").win.classList.contains("dg-target"), tag: (document.getElementById("dgDragTag") || {}).textContent || "" }));
    await p.mouse.up(); await p.waitForTimeout(500);
    const inn = await ev(() => { const a = document.getElementById("app"), ph = document.getElementById("dgph_refsdock"); return { st: (H3Panels.get("bd.refsdock") || {}).state, inWin: !!document.querySelector('.h3fp[data-fp="fd-dockers"] #refsdock'),
      col: a.classList.contains("no-refs"), ph: !!ph, phAt: ph ? [...a.children].indexOf(ph) : -1, n: a.children.length, outlinedAfter: H3Panels.get("fd-dockers").win.classList.contains("dg-target") }; });
    check("while dragged the ▣ docker is outlined; References dragged by its title bar goes IN; its column closes, a stand-in holds its place in the grid",
      mid.outlined && /References → /.test(mid.tag) && inn.st === "in" && inn.inWin && inn.col && inn.ph && inn.phAt === before.i && inn.n === before.n && !inn.outlinedAfter, { mid, inn, before });
    await ev(() => H3Panels.home("bd.refsdock")); await p.waitForTimeout(400);
    const back = await ev(() => { const a = document.getElementById("app"), d = document.getElementById("refsdock"); return { n: a.children.length, i: [...a.children].indexOf(d), prev: d.previousElementSibling && d.previousElementSibling.id, ph: !!document.getElementById("dgph_refsdock"), col: a.classList.contains("no-refs"), w: d.getBoundingClientRect().width }; });
    check("⇲ puts it back where it was (same place in the grid, the stand-in gone, its column open again)", back.i === before.i && back.prev === before.prev && back.n === before.n && !back.ph && !back.col && back.w > 50, { back, before });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
