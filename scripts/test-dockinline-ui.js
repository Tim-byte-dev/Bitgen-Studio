#!/usr/bin/env node
/* bitGen Studio — 2.401.4 in a REAL browser: Basic Settings and LLM tokens docked INSIDE the left docker's list.
 * Tim (verbatim): "add dropzones to the left docker so the basic settings and llm info can be docked inside the left docker"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the left docker inline test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const post = (body) => fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const F = { shown: false, x: -1, y: -1, w: 0, h: 0, mode: "float", to: "", side: "", at: "" };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const ready = () => p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.SecFloat && SecFloat.started
    && SecFloat.windows.basic && SecFloat.windows.basic.placed, null, { timeout: 60000 });
  try {
    await post({ floats: { basic: F, llmtok: F, camera: F } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ready();
    await p.waitForTimeout(800);
    // a drag of a panel's title bar to (x, y)
    const drag = async (id, to) => {
      const h = await ev((i) => { const r = document.querySelector(`#sf-${i} .sfhead`).getBoundingClientRect(); return { x: r.left + 40, y: r.top + 10 }; }, id);
      await p.mouse.move(h.x, h.y); await p.mouse.down();
      await p.mouse.move(h.x + 25, h.y + 10, { steps: 3 });
      await p.mouse.move(to.x, to.y, { steps: 12 });
      await p.waitForTimeout(150);
      const z = await ev(() => { const z = document.getElementById("dfZone"); return { on: z.style.display === "block", cls: z.className, txt: z.textContent }; });
      await p.mouse.up(); await p.waitForTimeout(400);
      return z;
    };
    await ev(() => { SecFloat.show("camera", false); SecFloat.show("basic", true); SecFloat.show("llmtok", true); SecFloat.float("basic", 760, 160, 330, 480); SecFloat.float("llmtok", 1120, 160, 300, 220); });
    await p.waitForTimeout(300);
    const at1 = await ev(() => { const l = document.querySelector("#ldock > .scroll").getBoundingClientRect(); const s = document.getElementById("stats").getBoundingClientRect(); return { x: l.left + 120, y: s.bottom + 4 }; });
    const z1 = await drag("basic", at1);
    const r1 = await ev(() => { const el = document.getElementById("sf-basic"); return { cls: el.className, inList: el.parentElement && el.parentElement.matches("#ldock > .scroll"), next: el.nextElementSibling && el.nextElementSibling.id, st: SecFloat.state("basic"), h: Math.round(el.getBoundingClientRect().height), body: document.getElementById("sec-basic").offsetHeight }; });
    check("dragged over the left docker's list a line lights between its sections ('Dock Basic Settings in Settings - above the panel buttons'); dropped, it sits IN the list there at its natural height",
      z1.on && /inline/.test(z1.cls) && z1.txt === "Dock Basic Settings in Settings - above the panel buttons"
      && /df-inline/.test(r1.cls) && r1.inList && r1.next === "sfLaunch" && r1.st.mode === "dock" && r1.st.to === "ldock" && r1.st.side === "inline" && r1.st.at === "sfLaunch"
      && r1.h > r1.body, { z1, r1 });
    const at2 = await ev(() => { const h = [...document.querySelectorAll("#ldock > .scroll > h2.sec")].find((x) => /System/.test(x.textContent)); const r = h.getBoundingClientRect(); return { x: r.left + 100, y: r.top + 2 }; });
    const z2 = await drag("llmtok", at2);
    const r2 = await ev(() => { const l = document.querySelector("#ldock > .scroll"); const kids = [...l.children].map((c) => c.id || (c.dataset && c.dataset.sec) || c.className.split(" ")[0]); return { kids, st: SecFloat.state("llmtok") }; });
    check("LLM tokens dropped above System: first in the list (above System), Basic Settings still above the panel buttons",
      /above System/.test(z2.txt) && r2.kids[0] === "sf-llmtok" && r2.st.at === "sec-system" && r2.kids.indexOf("sf-basic") === r2.kids.indexOf("sfLaunch") - 1, { z2, r2 });
    await p.waitForTimeout(600);
    await p.reload({ waitUntil: "domcontentloaded" });
    await ready();
    await p.waitForTimeout(1200);
    const r3 = await ev(() => { const l = document.querySelector("#ldock > .scroll"); const kids = [...l.children].map((c) => c.id || (c.dataset && c.dataset.sec) || c.className.split(" ")[0]);
      return { kids, b: document.getElementById("sf-basic").className, t: document.getElementById("sf-llmtok").className }; });
    check("kept over a reload (docker_status.json floats side inline + at): LLM tokens first, Basic Settings above the panel buttons, both inline",
      r3.kids[0] === "sf-llmtok" && r3.kids.indexOf("sf-basic") === r3.kids.indexOf("sfLaunch") - 1 && /df-inline/.test(r3.b) && /df-inline/.test(r3.t), r3);
    // S hides / shows it in place; dragging its title bar out floats it again
    await ev(() => SecFloat.show("basic", false));
    const hid = await ev(() => document.getElementById("sf-basic").offsetParent === null);
    await ev(() => SecFloat.show("basic", true));
    const back = await ev(() => { const el = document.getElementById("sf-basic"); return el.offsetParent !== null && /df-inline/.test(el.className); });
    const z4 = await drag("basic", { x: 900, y: 300 });
    const r4 = await ev(() => { const el = document.getElementById("sf-basic"); return { cls: el.className, inList: !!el.parentElement.matches("#ldock > .scroll"), st: SecFloat.state("basic") }; });
    // (where it lands depends on the layout - floating, or another docker's zone; what matters is it LEFT the list)
    check("hidden / shown in place; its title bar dragged out of the list takes it out of the list (floating / docked where it was let go)",
      hid && back && !/df-inline/.test(r4.cls) && !r4.inList && r4.st.side !== "inline" && r4.st.at === "", { hid, back, z4, r4 });
    // the left docker's header still takes it as a tab
    const at5 = await ev(() => { const r = document.querySelector("#ldock > .dockhead").getBoundingClientRect(); return { x: r.left + 120, y: r.top + r.height / 2 + 4 }; });
    const z5 = await drag("basic", at5);
    const m5 = await ev(() => SecFloat.state("basic").mode);
    check("the left docker's title bar still takes it INSIDE as a tab", /inside/.test(z5.cls) && m5 === "tab", { z5, m5 });
    // one panel inline ABOVE the other (at = sf-basic): restored in that order after a reload
    await post({ floats: { basic: { ...F, shown: true, mode: "dock", to: "ldock", side: "inline", at: "sfLaunch" },
                           llmtok: { ...F, shown: true, mode: "dock", to: "ldock", side: "inline", at: "sf-basic" } } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await ready();
    await p.waitForTimeout(1200);
    const r6 = await ev(() => [...document.querySelector("#ldock > .scroll").children].map((c) => c.id).filter(Boolean));
    check("LLM tokens kept ABOVE Basic Settings (at = the other panel) over a reload, Basic Settings above the panel buttons",
      r6.indexOf("sf-llmtok") === r6.indexOf("sf-basic") - 1 && r6.indexOf("sf-basic") === r6.indexOf("sfLaunch") - 1, r6);
    check("no page errors", !errs.length, errs);
  } catch (e) {
    check("ran without throwing", false, String(e && e.stack || e));
  } finally {
    await post({ floats: { basic: F, llmtok: F } }).catch(() => {});
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
