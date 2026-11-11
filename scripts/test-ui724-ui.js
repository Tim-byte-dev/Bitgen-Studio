#!/usr/bin/env node
/* bitGen Studio — 2.724.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): THE FLOATING
 * DIALOGS SHARE ONE ORDER (static/floatz.js). 💬 Community floating and a ▣ docker floating over the same spot: a press on
 * the ▣ docker puts it on top, 💬 Community opened again (its status-bar button) comes back on top of it, a press on either
 * swaps them (a real mouse - what is under the pointer where they overlap); Basic Settings joins the same order; every
 * floating dialog sits over the docked app and the status bar and under the ⊞ Docker configs panel; Community docked
 * inside a docker leaves the order (no z of its own). No server / no Playwright = SKIP.
 * Tim (verbatim): "the community dialog is going behind the custom dialog, give floating dialogs the highest z-index's" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.724.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.724.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3FloatZ && window.SecFloat && SecFloat.windows && SecFloat.windows.community && window.H3DockGroup && window.H3Panels, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    check("H3FloatZ is on the page (band 60-199)", await ev(() => H3FloatZ.BAND.base === 60 && H3FloatZ.BAND.cap === 199 && typeof H3FloatZ.raise === "function"));

    // 💬 Community floating at one spot
    await ev(() => { if (SecFloat.state("community").shown) SecFloat.show("community", false); });
    await p.click("#tCm"); await p.waitForTimeout(500);
    await ev(() => SecFloat.windows.community.panel.float(420, 200, 420, 460)); await p.waitForTimeout(400);
    // a ▣ docker over the same spot
    await ev(() => H3DockGroup.toggle(true)); await p.waitForFunction(() => H3DockGroup.shown(), null, { timeout: 8000 });
    const gid = await ev(() => { const g = [...document.querySelectorAll(".h3fp.dg-app")].find((w) => w.querySelector(".h3fd") && !w.classList.contains("off")); return g ? g.id : null; });
    const gwin = await ev(() => { const r = H3Panels.get("fd-dockers") || null; return r && r.win ? r.win.id || "" : null; });
    await ev(() => H3Panels.float("fd-dockers", { x: 560, y: 260, w: 560, h: 380 })); await p.waitForTimeout(800);
    const spot = { x: 700, y: 420 };   // inside both
    const under = () => ev((s) => { const t = document.elementFromPoint(s.x, s.y); const c = document.getElementById("sf-community"), g = H3Panels.get("fd-dockers").win;
      return c.contains(t) ? "community" : g.contains(t) ? "docker" : (t && (t.id || t.className)) || null; }, spot);
    const zs = () => ev(() => ({ c: +getComputedStyle(document.getElementById("sf-community")).zIndex, g: +getComputedStyle(H3Panels.get("fd-dockers").win).zIndex }));
    check("the two overlap (Community at 420,200 420x460; the ▣ docker at 560,260 560x380)", !!(await under()), { gid, gwin });

    // a press on the ▣ docker (its title bar) - it goes on top
    const gt = await ev(() => { const h = H3Panels.get("fd-dockers").win.querySelector(".h3fp-t"); const r = h.getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height / 2 }; });
    await p.mouse.click(gt.x, gt.y); await p.waitForTimeout(200);
    let u = await under(), z = await zs();
    check("a press on the ▣ docker: Community STAYS over it (2.763.5: the floating dialogs over every docker)", u === "community" && z.c > z.g && z.g >= 61, { u, z });
    // 💬 Community opened again from the status bar - back on top (the bug: it stayed behind)
    await p.click("#tCm"); await p.waitForTimeout(250); await p.click("#tCm"); await p.waitForTimeout(400);
    u = await under(); z = await zs();
    check("💬 Community shown again (its status-bar button): ON TOP of the ▣ docker", u === "community" && z.c > z.g, { u, z });
    // a press back and forth with the real mouse
    await p.mouse.click(gt.x, gt.y); await p.waitForTimeout(200);
    check("…press the ▣ docker again: Community still over it", (await under()) === "community");
    const ct = await ev(() => { const h = document.querySelector("#sf-community .sfhead"); const r = h.getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
    await p.mouse.click(ct.x, ct.y); await p.waitForTimeout(200);
    u = await under(); z = await zs();
    check("…press Community (its title bar): it goes over the ▣ docker", u === "community" && z.c > z.g, { u, z });
    // Basic Settings (another SecFloat window) joins the same order
    const bs = await ev(() => { if (!SecFloat.windows.basic) return null; SecFloat.show("basic", true); const w = SecFloat.windows.basic; if (w.panel.mode() !== "float") w.panel.float(600, 230, 330, 420);
      return { top: H3FloatZ.top() === w.el, z: +getComputedStyle(w.el).zIndex }; });
    await p.waitForTimeout(200);
    const all = await ev(() => H3FloatZ.list().map((w) => ({ id: w.id, z: +getComputedStyle(w).zIndex })));
    check("Basic Settings shown: it joins the same order, on top (each dialog its own z, one step apart, all in 61-199)",
      bs && bs.top && all.length >= 3 && new Set(all.map((x) => x.z)).size === all.length && all.every((x, i) => x.z === 61 + i && x.z < 200), { bs, all });
    // over the docked app and the status bar, under the ⊞ Docker configs panel
    const lv = await ev(() => { const sbz = +getComputedStyle(document.getElementById("statusbar")).zIndex || 0, dc = document.getElementById("dockCfgPanel");
      const dcz = dc ? +getComputedStyle(dc).zIndex : 300; const docked = +getComputedStyle(document.getElementById("previewdock") || document.body).zIndex || 0;
      return { sbz, dcz, docked, min: Math.min(...H3FloatZ.list().map((w) => +getComputedStyle(w).zIndex)), max: Math.max(...H3FloatZ.list().map((w) => +getComputedStyle(w).zIndex)) }; });
    check("every floating dialog is over the status bar and the docked dockers, under the ⊞ Docker configs panel", lv.min > lv.sbz && lv.min > lv.docked && lv.max < lv.dcz, lv);
    // THE BUG: a named docker made with ⊞ Docker configs ▸ ▣ New docker… (H3Panels.newDocker - it was 9300, over everything)
    const nd = await ev(() => { H3Panels.newDocker({ id: "t724-named", name: "Mine" }); H3Panels.float("t724-named", { x: 520, y: 240, w: 520, h: 400 });
      const w = H3Panels.get("t724-named").win; return { body: w.parentElement === document.body, z: +getComputedStyle(w).zIndex, top: H3FloatZ.top() === w, cz: +getComputedStyle(document.getElementById("sf-community")).zIndex }; });
    await p.waitForTimeout(300);
    const under2 = () => ev((s) => { const t = document.elementFromPoint(s.x, s.y); return document.getElementById("sf-community").contains(t) ? "community" : H3Panels.get("t724-named").win.contains(t) ? "named" : "other"; }, spot);
    check("a ⊞ named docker floating over the app: in the band (not 9300), under the floating dialogs (2.763.5)", nd.body && nd.z >= 61 && nd.z < 200 && !nd.top && nd.z < nd.cz, nd);
    await p.click("#tCm"); await p.waitForTimeout(250); await p.click("#tCm"); await p.waitForTimeout(400);
    let u2 = await under2();
    check("💬 Community opened again: over the named docker (it went behind it before)", u2 === "community", u2);
    const nt = await ev(() => { const h = H3Panels.get("t724-named").win.querySelector(".h3fp-t"); const r = h.getBoundingClientRect(); return { x: r.left + r.width * 0.85, y: r.top + r.height / 2 }; });   // the part Community does not cover
    await p.mouse.click(nt.x, nt.y); await p.waitForTimeout(200); u2 = await under2();
    const ct2 = await ev(() => { const h = document.querySelector("#sf-community .sfhead"); const r = h.getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
    await p.mouse.click(ct2.x, ct2.y); await p.waitForTimeout(200);
    check("…press the named docker: Community stays over it; press Community: still over it", u2 === "community" && (await under2()) === "community", u2);
    await ev(() => { H3Panels.show("t724-named", false); });
    // docked inside a docker: out of the order, no z of its own
    const dk = await ev(() => new Promise((res) => { const host = document.getElementById("timelinedock") || document.getElementById("previewdock"); SecFloat.windows.community.panel.dockTo(host, "inside");
      setTimeout(() => { const c = document.getElementById("sf-community"); res({ mode: SecFloat.windows.community.panel.mode(), z: c.style.zIndex, inList: H3FloatZ.list().includes(c) }); }, 400); }));
    check("Community docked inside a docker: no z of its own, out of the order", dk.mode === "tab" && dk.z === "" && !dk.inList, dk);
    const fl = await ev(() => { SecFloat.windows.community.panel.float(420, 200, 420, 460); SecFloat.show("community", true); const c = document.getElementById("sf-community"); return { top: H3FloatZ.top() === c, z: +getComputedStyle(c).zIndex }; });
    check("…floated again and brought forward: on top again", fl.top && fl.z >= 61, fl);
    // tidy
    await ev(() => { SecFloat.show("community", false); if (SecFloat.windows.basic) SecFloat.show("basic", false); H3DockGroup.toggle(false); try { H3Panels.remove("t724-named"); } catch (e) { /* fine */ } });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
