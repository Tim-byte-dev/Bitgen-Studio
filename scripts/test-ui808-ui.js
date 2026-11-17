#!/usr/bin/env node
/* bitGen Studio — 2.808.0 against the RUNNING app (+ a real browser): a ▣ custom docker docked as a column keeps the dockers
 * put in it, and sits with the docked dockers - under every floating one.
 * Tim (verbatim): "please fix the new custom docker in this case settings but fix all custom dockers that would be made. it
 * doesn't hold it's contents(other dockers) after restart and is in front of other dockers like model manager and gpu, but it
 * is a placeholder docker it should be at the level of the system docker + 1"
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 2400, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const rectOf = (s) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, s);
  const drag = async (a, c) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 12, a.y + 6, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 16 }); await p.mouse.up(); await p.waitForTimeout(900); };
  const boot = async () => { await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && window.H3DGDock && window.SecFloat && window.SecFloat.started && window.PFloat && window.PFloat.started, null, { timeout: 60000 }); await p.waitForTimeout(5000); };
  const inside = () => ev(() => ({ st: (H3Panels.get("sf.basic") || {}).state, in: !!(H3Panels.get("fd-dockers") && H3Panels.get("fd-dockers").win.contains(document.getElementById("sf-basic"))) }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" }); await boot();
    await ev(() => { const a = document.getElementById("app"); if (a.classList.contains("no-refs")) document.getElementById("tRefs").click(); for (const k of Object.keys(SecFloat.windows)) SecFloat.show(k, false); });
    await p.keyboard.press("Control+Alt+KeyD"); await p.waitForTimeout(800);
    await ev(() => H3Panels.float("fd-dockers", { x: 900, y: 300, w: 520, h: 300 })); await p.waitForTimeout(600);
    const s = await ev(() => { const s = H3DGDock.seams().find((x) => x.before === "refsdock"); const a = document.getElementById("app").getBoundingClientRect(); return s ? { x: s.x, y: a.top + a.height * 0.55 } : null; });
    await drag(await rectOf('.h3fp[data-fp="fd-dockers"] > .h3fp-t .h3fp-n'), s);
    check("the ▣ docker docked as a column (between System and References)", await ev(() => !!document.getElementById("dgp_fd-dockers")));
    await ev(() => { SecFloat.show("basic", true); SecFloat.float("basic", 1200, 160, 330, 360); }); await p.waitForTimeout(500);
    await drag(await rectOf("#sf-basic > .sfhead .sft"), await rectOf("#dgp_fd-dockers .h3fd-pane"));
    check("Basic Settings dragged into it", (await inside()).in);
    // z: a floating docker (🧩 Model manager) over the column is on top
    await ev(() => { SecFloat.show("modelmgr", true); SecFloat.float("modelmgr", 300, 450, 500, 400); }); await p.waitForTimeout(800);
    const z = await ev(() => { const c = document.getElementById("dgp_fd-dockers").getBoundingClientRect(), w = document.getElementById("sf-modelmgr").getBoundingClientRect();
      const e = document.elementFromPoint(Math.max(c.left + 5, w.left + 5), Math.max(c.top + 200, w.top + 60));
      return { hit: e && (e.closest(".secfloat,.h3fp,.bdock") || {}).id, colZ: getComputedStyle(document.getElementById("dgp_fd-dockers")).zIndex, iso: getComputedStyle(document.getElementById("dgp_fd-dockers")).isolation }; });
    check("a floating docker (🧩 Model manager) over it is on top - the docked ▣ docker is z 1 (System docker + 1), its own stacking context", z.hit === "sf-modelmgr" && z.colZ === "1" && z.iso === "isolate", z);
    await ev(() => SecFloat.show("modelmgr", false));
    // a ⊞ layout / workspace putting Basic Settings back where it used to be: it stays in
    await ev(() => SecFloat.applyStates({ basic: { mode: "float", shown: true, x: 100, y: 100, w: 300, h: 300 } }));
    check("a layout restoring Basic Settings' old place (SecFloat.applyStates) leaves it in the ▣ docker", (await inside()).in && (await inside()).st === "in");
    // something takes it out anyway: back in within a second or two
    await ev(() => document.body.appendChild(document.getElementById("sf-basic"))); await p.waitForTimeout(2500);
    check("taken out by anything but the user: put back in its ▣ docker (not forgotten)", (await inside()).in && (await inside()).st === "in");
    // restart
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(3000);
    const after = await inside();
    check("after a restart: the column and Basic Settings in it", (await ev(() => !!document.getElementById("dgp_fd-dockers"))) && after.in && after.st === "in", after);
    // the user drags it out: it floats (not put back)
    const mt = await ev(() => { const e = document.querySelector('#dgp_fd-dockers .h3fp[data-fp="sf.basic"] > .h3fp-t'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
    await drag(mt, { x: 1500, y: 500 }); await p.waitForTimeout(2500);
    check("the user dragging it out = it floats and stays out", !(await inside()).in && (await inside()).st !== "in", await inside());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
