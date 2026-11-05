#!/usr/bin/env node
/* bitGen Studio — 2.658.0 in a REAL browser: ⛶ MAXIMIZE THAT KNOWS WHERE THE DOCKER IS (static/dockmax.js) - the Sketcher's
 * own bottom handle (--pph); docked: the timeline / image editor / Sketcher grow to the column's height, the dockers below
 * keep their heights and are pushed down, 🗗 / Esc back; floating: the whole window, the other dockers closed, back after.
 * Tim (verbatim): "allow sketcher to be resized vertically when docked. when mamimize button is pressed in docked mode expand
 * to fill empty space dockers that are docked below will be pushed downwards. when maximazi is pressed when it is floating
 * then maximize normally and close other dockers. do the same for timeline and image editor"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.658.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockMax && window.toggleMax && window.toggleMax._dm && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    // the timeline, the video docker and the Sketcher open in the column
    await ev(() => { ["timelinedock", "pushpulldock"].forEach((id) => { const d = document.getElementById(id); if (d.classList.contains("dockgone")) toggleDockGone(id, id === "pushpulldock" ? "tX_pushpulldock" : "tTL"); if (d.classList.contains("collapsed")) toggleCollapse(id); }); });
    await p.waitForTimeout(800);
    const hs = await ev(() => { const d = document.getElementById("pushpulldock"), n = d.nextElementSibling; return { handle: !!(n && n.classList.contains("hsplit") && n.dataset.hresize === "pph"), h: Math.round(d.getBoundingClientRect().height), v: getComputedStyle(document.documentElement).getPropertyValue("--pph").trim(), inCol: d.parentElement.id }; });
    check("the Sketcher docked has its own bottom handle (--pph) and a height of its own", hs.handle && /px$/.test(hs.v) && hs.inCol === "maincol" && hs.h > 100, hs);
    // drag its handle down 60 px (the Sketcher grows)
    const sp = await ev(() => { const r = document.getElementById("pushpulldock").nextElementSibling.getBoundingClientRect(); document.getElementById("pushpulldock").nextElementSibling.scrollIntoView({ block: "center" }); const r2 = document.getElementById("pushpulldock").nextElementSibling.getBoundingClientRect(); return [r2.left + r2.width / 2, r2.top + r2.height / 2]; });
    const v0 = await ev(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pph")));
    await p.mouse.move(sp[0], sp[1]); await p.mouse.down(); await p.mouse.move(sp[0], sp[1] - 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const v1 = await ev(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pph")));
    check("…its handle sizes it (dragged up 60 px = 60 px shorter)", Math.abs(v0 - 60 - v1) <= 2, { v0, v1 });

    /* ---- docked: the timeline grows to the column's height, the dockers below pushed down */
    const before = await ev(() => { const col = document.getElementById("maincol"), tl = document.getElementById("timelinedock"); const below = [...col.querySelectorAll(":scope > .bdock")].filter((d) => d.offsetHeight > 40 && d.compareDocumentPosition(tl) & Node.DOCUMENT_POSITION_PRECEDING && !d.classList.contains("dockgone") && !d.classList.contains("collapsed")).map((d) => [d.id, Math.round(d.getBoundingClientRect().height)]); return { below, colH: col.clientHeight }; });
    await ev(() => document.querySelector('#timelinedock .maxbtn').click()); await p.waitForTimeout(500);
    const dk = await ev((below) => { const col = document.getElementById("maincol"), tl = document.getElementById("timelinedock"), cs = getComputedStyle(col);
      return { mode: tl.dataset.dmMode, push: col.classList.contains("dm-push"), h: Math.round(tl.getBoundingClientRect().height), want: col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 5, tlTop: Math.round(tl.getBoundingClientRect().top - col.getBoundingClientRect().top),
        below: below.map(([id]) => { const d = document.getElementById(id); return [id, Math.round(d.getBoundingClientRect().height), Math.round(d.getBoundingClientRect().top - tl.getBoundingClientRect().bottom)]; }) }; }, before.below);
    check("docked ⛶ (the timeline): it takes the column's whole height, scrolled to its top", dk.mode === "push" && dk.push && Math.abs(dk.h - dk.want) <= 3 && Math.abs(dk.tlTop) <= 12, dk);
    check("…the dockers below keep their heights and are pushed down (below the maximized docker)", before.below.length > 0 && dk.below.every(([id, h, top], i) => Math.abs(h - before.below[i][1]) <= 2 && top >= -2), { before: before.below, after: dk.below });
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    const back = await ev((below) => ({ push: document.getElementById("maincol").classList.contains("dm-push"), maxed: document.getElementById("timelinedock").classList.contains("maxed"), below: below.map(([id]) => Math.round(document.getElementById(id).getBoundingClientRect().height)) }), before.below);
    check("Esc: back - not maximized, the column as it was", !back.push && !back.maxed && back.below.every((h, i) => Math.abs(h - before.below[i][1]) <= 2), { back, before: before.below });

    /* ---- docked: the Sketcher (its own ⛶) grows in the column too - not the whole window */
    await ev(() => document.getElementById("ppMaxBtn").click()); await p.waitForTimeout(500);
    const sk = await ev(() => { const d = document.getElementById("pushpulldock"); return { mode: d.dataset.dmMode, pos: getComputedStyle(d).position, btn: document.getElementById("ppMaxBtn").textContent, tl: !document.getElementById("timelinedock").classList.contains("dockgone") }; });
    check("docked ⛶ (the Sketcher): grows in the column (not fixed over the window), the other dockers stay open, its button is 🗗", sk.mode === "push" && sk.pos !== "fixed" && sk.btn === "🗗" && sk.tl, sk);
    await ev(() => document.getElementById("ppMaxBtn").click()); await p.waitForTimeout(400);

    /* ---- floating: the image editor out of the column = the whole window, the others closed, back after */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock");
      const w = document.createElement("div"); w.id = "zzFloat658"; w.style.cssText = "position:fixed;left:200px;top:150px;width:700px;height:500px;z-index:50"; document.body.appendChild(w); window.__home = d.nextElementSibling; w.appendChild(d); });
    await p.waitForTimeout(400);
    await ev(() => document.querySelector('#imageeditdock .maxbtn').click()); await p.waitForTimeout(600);
    const fl = await ev(() => { const d = document.getElementById("imageeditdock"), r = d.getBoundingClientRect(); return { mode: d.dataset.dmMode, full: d.classList.contains("dockfull"), w: Math.round(r.width), vw: innerWidth, tl: document.getElementById("timelinedock").classList.contains("dockgone"), push: document.getElementById("maincol").classList.contains("dm-push") }; });
    check("floating ⛶ (the image editor): the whole window, the other dockers closed (the timeline gone)", fl.mode === "full" && fl.full && fl.w >= fl.vw - 4 && fl.tl && !fl.push, fl);
    await ev(() => document.querySelector('#imageeditdock .maxbtn').click()); await p.waitForTimeout(700);
    const fb = await ev(() => ({ tl: !document.getElementById("timelinedock").classList.contains("dockgone"), maxed: document.getElementById("imageeditdock").classList.contains("maxed") }));
    check("…🗗: the other dockers back (the timeline open again)", fb.tl && !fb.maxed, fb);
    await ev(() => { const d = document.getElementById("imageeditdock"); window.__home.parentElement.insertBefore(d, window.__home); document.getElementById("zzFloat658").remove(); });

    /* ---- floating: the Sketcher out of the column = the whole window (fixed), the others closed */
    await ev(() => { const d = document.getElementById("pushpulldock"); const w = document.createElement("div"); w.id = "zzFloat658b"; w.style.cssText = "position:fixed;left:100px;top:100px;width:800px;height:600px;z-index:50"; document.body.appendChild(w); window.__home2 = d.nextElementSibling; w.appendChild(d); });
    await ev(() => document.getElementById("ppMaxBtn").click()); await p.waitForTimeout(600);
    const sf = await ev(() => { const d = document.getElementById("pushpulldock"); return { mode: d.dataset.dmMode, pos: getComputedStyle(d).position, tl: document.getElementById("timelinedock").classList.contains("dockgone") }; });
    check("floating ⛶ (the Sketcher): the whole window (fixed), the other dockers closed", sf.mode === "full" && sf.pos === "fixed" && sf.tl, sf);
    await ev(() => document.getElementById("ppMaxBtn").click()); await p.waitForTimeout(600);
    check("…⇲ Dock: the others back", await ev(() => !document.getElementById("timelinedock").classList.contains("dockgone")));
    await ev(() => { const d = document.getElementById("pushpulldock"); window.__home2.parentElement.insertBefore(d, window.__home2); document.getElementById("zzFloat658b").remove(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
