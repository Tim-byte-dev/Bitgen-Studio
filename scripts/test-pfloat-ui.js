#!/usr/bin/env node
/* bitGen Studio — 2.389.0 THE FLOATING PROMPT DOCKER in a REAL browser.
 * Tim: "make our prompt docker floating but allow user to snap to another docker - a drag and drop snap "P" will toggle
 * the prompt unless typing in an input" (snap: "Both"; "P = prompt everywhere").
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP.
 *   it floats by default · P hides / shows it (never while typing; Shift+P is not it) · magnetic edges · a header
 *   click still collapses it, a drag does not · drop on a dock's left edge = beside it (a row), remembered over a
 *   reload · drag it out = floating again · drop on a bottom edge = in the column, an ordinary dock again · a side
 *   docker takes it · docker_status.json keeps it all */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the floating prompt browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const post = (docks) => fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks }) });
// a busy machine can drop one request - try again (the gate saw "fetch failed" once while the box was under load)
const getDs1 = async () => { for (let i = 0; ; i++) { try { return (await (await fetch(URL_ + "api/docker-status")).json()).docks.promptdock; } catch (e) { if (i >= 5) throw e; await new Promise((ok) => setTimeout(ok, 400 * (i + 1))); } } };
/* the page saves a moment after the drop (and the layout's own debounced save follows) - read until it has landed */
const getDs = async (want) => { let d = null; for (let i = 0; i < 20; i++) { d = await getDs1(); if (!want || want(d)) return d; await new Promise((ok) => setTimeout(ok, 150)); } return d; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const boot = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.PFloat && window.PFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(700);
  };
  const st = () => p.evaluate(() => {
    const e = document.getElementById("promptdock"), r = e.getBoundingClientRect(), par = e.parentElement;
    return { float: e.classList.contains("pf-float"), free: e.classList.contains("pf-free"), side: e.classList.contains("pf-side"), gone: e.classList.contains("dockgone"),
      collapsed: e.classList.contains("collapsed"), parent: par.id || par.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      fixed: typeof fixedVar === "function" ? fixedVar(e) : "?", next: e.nextElementSibling && e.nextElementSibling.className, badge: !!e.querySelector(".pf-badge") };
  });
  const head = async () => { const bb = await p.locator("#promptdock .bhead").boundingBox(); return [bb.x + 40, bb.y + bb.height / 2]; };
  const dragTo = async (from, to, steps = 18) => { await p.mouse.move(...from); await p.mouse.down(); await p.mouse.move(from[0] + 20, from[1] + 15, { steps: 3 }); await p.mouse.move(...to, { steps }); await p.waitForTimeout(80); const z = await p.evaluate(() => { const z = document.getElementById("pfZone"); return getComputedStyle(z).display === "none" ? "" : z.textContent; }); await p.mouse.up(); await p.waitForTimeout(350); return z; };
  try {
    await post({ promptdock: { floating: true, x: -1, y: -1, float_w: 0, float_h: 0, dock_to: "", dock_side: "", hidden: false, state: "open" },
      timelinedock: { hidden: false, state: "open", maximized: false, height: 300 }, imageeditdock: { maximized: false } });
    await boot();
    let s = await st();
    check("the prompt docker floats by default: a window of its own (not in the column, not a column dock), on screen, its P badge",
      s.float && s.free && s.parent === "" && s.fixed === null && !s.gone && s.x >= 0 && s.y >= 0 && s.y + 30 <= 1050 && s.w >= 320 && s.badge, s);
    // P
    await p.mouse.click(5, 5); await p.keyboard.press("p"); await p.waitForTimeout(150);
    const hid = await st();
    const btn = await p.evaluate(() => document.getElementById("tP").classList.contains("on"));
    await p.keyboard.press("p"); await p.waitForTimeout(150);
    s = await st();
    check("P hides it (its status-bar button goes dark), P again shows it", hid.gone && !btn && !s.gone, [hid.gone, btn, s.gone]);
    await p.focus("#prompt"); await p.keyboard.press("p"); await p.waitForTimeout(150);
    const typed = await p.evaluate(() => document.getElementById("prompt").value);
    s = await st();
    check("...not while typing: in the prompt box P is a letter", !s.gone && /p$/.test(typed), [s.gone, typed.slice(-5)]);
    await p.evaluate(() => { const t = document.getElementById("prompt"); t.value = t.value.replace(/p$/, ""); t.blur(); });
    await p.mouse.click(5, 5); await p.keyboard.press("Shift+P"); await p.waitForTimeout(150);
    check("...and Shift+P is not P (it is the timeline's Path tool)", !(await st()).gone);
    // magnetic: dragged to 6 px from the window's left edge -> 0
    const h0 = await head();
    const z0 = await dragTo(h0, [46 + 6 - 40 + 40, 300]);
    s = await st();
    void z0;
    // the drag put the titlebar's grab point at x = 52 -> the window's left edge at 52 - 40 = 12... snap needs <= 10: aim at 6
    await dragTo(await head(), [(await head())[0] - s.x + 6, 320]);
    s = await st();
    check("magnetic edges: let go 6 px from the window's left edge, it sticks to it", s.float && s.x === 0, s);
    // a click on the header collapses it; a drag does not
    const c0 = (await st()).collapsed;
    await p.click("#promptdock .bhead", { position: { x: 60, y: 12 } }); await p.waitForTimeout(150);
    const c1 = (await st()).collapsed;
    await p.click("#promptdock .bhead", { position: { x: 60, y: 12 } }); await p.waitForTimeout(150);
    await dragTo(await head(), [(await head())[0] + 200, 300]);
    const c2 = (await st()).collapsed;
    check("a header click still collapses it to its titlebar (and back); a drag never does", !c0 && c1 && !c2, [c0, c1, c2]);
    // drop on a dock's LEFT edge -> beside it
    const tid = await p.evaluate(() => { const t = [...document.querySelectorAll("#maincol > .bdock")].find((d) => d.id !== "promptdock" && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && d.offsetHeight > 140); return t ? t.id : "timelinedock"; });
    const tb = await p.locator("#" + tid).boundingBox();
    const zl = await dragTo(await head(), [tb.x + 25, tb.y + tb.height / 2]);
    s = await st();
    let ds = await getDs((d) => d.floating === false);
    check(`drop zones: over ${tid}'s left edge it lights "left of", the drop docks it BESIDE ${tid} (a row; its width by the splitter)`,
      /left of/.test(zl) && s.parent === "pf-row" && !s.float && s.free && ds.floating === false && ds.dock_to === tid && ds.dock_side === "left"
      && await p.evaluate((id) => { const r = document.getElementById("promptdock").parentElement; return r.children[0].id === "promptdock" && r.children[1].className === "pf-vs" && r.children[2].id === id; }, tid), [zl, s, ds]);
    await boot();
    s = await st();
    check("...remembered: after a reload it is still beside it", s.parent === "pf-row" && await p.evaluate((id) => document.getElementById("promptdock").parentElement.contains(document.getElementById(id)), tid), s);
    // drag it out -> floating again (the row unwrapped)
    // 2.390.0: a point no drop zone covers - the middle of the biggest open column dock (a fixed [800, 700] fell in the
    // video dock's bottom band in the gate, where earlier legs leave other dock heights)
    const free = await p.evaluate(() => { const d = [...document.querySelectorAll("#maincol > .bdock")].filter((x) => x.id !== "promptdock" && !x.classList.contains("dockgone") && !x.classList.contains("collapsed") && !x.contains(document.getElementById("promptdock")))
      .sort((a, b) => b.offsetHeight - a.offsetHeight)[0]; const r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await dragTo(await head(), free);
    s = await st();
    ds = await getDs((d) => d.floating === true);
    check("dragging a docked prompt's titlebar floats it again (the row is gone)", s.float && s.parent === "" && ds.floating === true && !(await p.evaluate(() => document.querySelector(".pf-row"))), [s, ds]);
    // drop on a dock's BOTTOM edge -> an ordinary dock in the column, below it
    const tb2 = await p.locator("#" + tid).boundingBox();
    const zb = await dragTo(await head(), [tb2.x + tb2.width / 2, tb2.y + tb2.height - 12]);
    s = await st();
    const order = await p.evaluate((id) => { const t = document.getElementById(id), e = document.getElementById("promptdock"); let n = t.nextElementSibling; if (n && n.classList.contains("hsplit")) n = n.nextElementSibling; return n === e; }, tid);
    check(`drop on ${tid}'s bottom edge: in the column right below it, a column dock again (its own height, its own splitter)`, /below/.test(zb) && s.parent === "maincol" && !s.free && s.fixed === "ph" && order && s.next === "hsplit", [zb, s, order]);
    // a side docker
    const side = await p.evaluate(() => ["refsdock", "assetsdock", "qdock", "rdock", "ldock"].find((id) => { const e = document.getElementById(id); return e && e.offsetWidth > 100 && e.offsetHeight > 300; }));
    if (side) {
      const sb = await p.locator("#" + side).boundingBox();
      const zs = await dragTo(await head(), [sb.x + sb.width / 2, sb.y + 20]);
      s = await st();
      check(`a side docker (${side}) takes it at its top`, /above/.test(zs) && s.parent === side && s.side && s.free, [zs, s]);
    } else check("a side docker is on screen to test with", false);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await post({ promptdock: { floating: true, x: -1, y: -1, dock_to: "", dock_side: "", hidden: false, state: "open" } }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
