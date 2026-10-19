#!/usr/bin/env node
/* bitGen Studio — 2.398.0 in a REAL browser: the prompt docker's height, and Basic Settings / LLM tokens as dockers.
 * Tim (verbatim): "the prompt docker won't allow me to resize it's height. make the basic settings and llm dialogs into
 * dockers with the ability to dock next to another docker or within another docker"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the dockable panels browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); }
};
const post = (body) => fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const status = () => fetch(URL_ + "api/docker-status").then((r) => r.json());
const RESET = { floats: { basic: { shown: false, x: -1, y: -1, w: 0, h: 0, mode: "float", to: "", side: "", dw: 0, dh: 0, active: false },
                          llmtok: { shown: false, x: -1, y: -1, w: 0, h: 0, mode: "float", to: "", side: "", dw: 0, dh: 0, active: false } } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1050 } });
  const errs = [];
  let before = null;                   // the bottom dockers as they were (shown / collapsed) - put back at the end
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const drag = async (x0, y0, x1, y1, mods) => {
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move(x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 8 }); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(350);
  };
  const rect = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
  const boot = async () => {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.PFloat && PFloat.started && window.SecFloat && SecFloat.started && window.DockFloat, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
  };
  try {
    await post(RESET);
    await boot();

    // the earlier legs may leave dockers hidden: the prompt, video and console dockers shown for this run (put back after)
    before = await ev(() => [...document.querySelectorAll("#maincol .bdock")].map((d) => [d.id, d.classList.contains("dockgone"), d.classList.contains("collapsed")]));
    await ev(() => { for (const id of ["promptdock", "videodock", "consoledock"]) { const d = document.getElementById(id); if (d && d.classList.contains("dockgone")) toggleDockGone(id, null); }
      for (const id of ["promptdock", "videodock"]) { const d = document.getElementById(id); if (d && d.classList.contains("collapsed")) toggleCollapse(id); }
      // the side dockers this run docks into, shown (their buttons - the same as a click)
      window.__dfSides = [];
      for (const [cls, btn] of [["no-left", "tL"], ["no-refs", "tRefs"], ["no-assets", "tAssets"], ["no-queue", "tQ"]])
        if (document.getElementById("app").classList.contains(cls)) { document.getElementById(btn).click(); window.__dfSides.push(btn); } });
    await p.waitForTimeout(500);

    // ---- 1 the floating prompt: every edge sizes it
    await ev(() => PFloat.float(380, 220, 700, 260));
    await p.waitForTimeout(300);
    let r = await rect("#promptdock");
    await drag(r.x + r.w / 2, r.b - 1, r.x + r.w / 2, r.b + 150);
    const r1 = await rect("#promptdock");
    await drag(r1.x + r1.w / 2, r1.y + 2, r1.x + r1.w / 2, r1.y - 60);
    const r2 = await rect("#promptdock");
    await drag(r2.x + 2, r2.y + r2.h / 2, r2.x - 50, r2.y + r2.h / 2);
    const r3 = await rect("#promptdock");
    await drag(r3.r - 3, r3.b - 3, r3.r + 40, r3.b + 30);
    const r4 = await rect("#promptdock");
    check("the floating prompt docker: its BOTTOM edge sizes its height (+150), its top edge (+60, the bottom held), its left edge, its corner",
      Math.abs(r1.h - (r.h + 150)) <= 3 && Math.abs(r1.y - r.y) <= 1 && Math.abs(r2.h - (r1.h + 60)) <= 3 && Math.abs(r2.b - r1.b) <= 2
      && Math.abs(r3.w - (r2.w + 50)) <= 3 && Math.abs(r3.r - r2.r) <= 2 && r4.w > r3.w + 30 && r4.h > r3.h + 20, { r, r1, r2, r3, r4 });
    await p.waitForTimeout(500);
    const st1 = (await status()).docks.promptdock;
    check("...docker_status.json keeps its size and place", Math.abs(st1.float_h - r4.h) <= 2 && Math.abs(st1.float_w - r4.w) <= 2 && st1.x === Math.round(r4.x), st1);

    // ---- 2 the prompt docked in the column with nothing open below it: its own handle now grows it
    await ev(() => {
      for (const d of document.querySelectorAll("#maincol .bdock")) if (!["videodock", "consoledock", "promptdock"].includes(d.id) && !d.classList.contains("dockgone")) toggleDockGone(d.id, null);
      if (document.getElementById("consoledock").classList.contains("dockgone")) toggleDockGone("consoledock", null);
      if (!document.getElementById("consoledock").classList.contains("collapsed")) toggleCollapse("consoledock");
    });
    await p.waitForTimeout(500);
    await ev(() => PFloat.dockTo(document.getElementById("consoledock"), "top"));
    await p.waitForTimeout(600);
    const d0 = await rect("#promptdock");
    const sp = await rect("#promptdock + .hsplit");
    await drag(sp.x + sp.w / 2, sp.y + sp.h / 2, sp.x + sp.w / 2, sp.y + sp.h / 2 + 120);
    const d1 = await rect("#promptdock");
    const below = await ev(() => [...document.querySelectorAll("#maincol .bdock")].filter((d) => d.id !== "promptdock" && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && d.getBoundingClientRect().top > document.getElementById("promptdock").getBoundingClientRect().top).length);
    check("docked in the column with nothing open below (the console collapsed): dragging its own handle down GROWS it - the dock above gives the room",
      below === 0 && d1.h >= d0.h + 100 && d1.y < d0.y - 90, { d0, d1, below });
    const sp2 = await rect("#promptdock + .hsplit");             // (it grew upwards - its handle stays at the column's foot)
    await drag(sp2.x + sp2.w / 2, sp2.y + sp2.h / 2, sp2.x + sp2.w / 2, sp2.y + sp2.h / 2 - 80);
    const d2 = await rect("#promptdock");
    check("...and dragging it back up shrinks it again", d2.h < d1.h - 60, { d1, d2 });

    // ---- 3 the prompt in a side docker: its bottom edge sizes it
    await ev(() => PFloat.dockTo(document.getElementById("qdock"), "top"));
    await p.waitForTimeout(500);
    const q0 = await rect("#promptdock");
    await drag(q0.x + q0.w / 2, q0.b - 2, q0.x + q0.w / 2, q0.b + 100);
    const q1 = await rect("#promptdock");
    check("in a side docker (Queue): its bottom edge sizes its height", q1.h >= q0.h + 90 && Math.abs(q1.y - q0.y) <= 1, { q0, q1 });
    await ev(() => PFloat.float(1260, 700, 560, 220));        // out of the way of the dockers the panels go to below

    // ---- 4 Basic Settings: S, then dropped on the Settings docker's title bar = a tab inside it
    await p.mouse.move(1000, 900);
    await p.keyboard.press("s"); await p.waitForTimeout(300);
    const f0 = await ev(() => document.getElementById("sf-basic").className);
    check("S shows Basic Settings floating, eight resize handles on it", /df-float/.test(f0) && /dfm-float/.test(f0) && (await ev(() => document.querySelectorAll("#sf-basic > .dfg").length)) === 8, f0);
    let h = await rect("#sf-basic .sft");
    const lh = await rect("#ldock > .dockhead");
    await drag(h.x + 5, h.y + 5, lh.x + lh.w / 2, lh.y + lh.h - 6);
    const t1 = await ev(() => ({ cls: document.getElementById("sf-basic").className, par: document.getElementById("sf-basic").parentElement.id,
      tabs: [...document.querySelectorAll("#ldock > .dftabs button")].map((x) => x.dataset.dft + (x.classList.contains("on") ? "*" : "")).join("|"),
      hostHidden: getComputedStyle(document.querySelector("#ldock > .scroll, #ldock > .projbar")).display === "none",
      vis: document.getElementById("sf-basic").getBoundingClientRect().height > 100, seed: !!document.getElementById("seed") && document.getElementById("seed").getBoundingClientRect().width > 0 }));
    check("dropped on the Settings docker's title bar: INSIDE it as a tab (Settings | Basic Settings*), the docker's own content hidden, its controls live",
      /df-tabbed/.test(t1.cls) && t1.par === "ldock" && t1.tabs === "__host|basic*" && t1.hostHidden && t1.vis && t1.seed, t1);
    await ev(() => document.querySelector('#ldock > .dftabs [data-dft="__host"]').click()); await p.waitForTimeout(200);
    const t2 = await ev(() => ({ basic: getComputedStyle(document.getElementById("sf-basic")).display, host: getComputedStyle(document.querySelector("#ldock > .scroll, #ldock > .projbar")).display }));
    await ev(() => document.querySelector('#ldock > .dftabs [data-dft="basic"]').click()); await p.waitForTimeout(200);
    const t3 = await ev(() => getComputedStyle(document.getElementById("sf-basic")).display);
    check("...its tabs switch: Settings shows the docker, Basic Settings the panel", t2.basic === "none" && t2.host !== "none" && t3 !== "none", { t2, t3 });

    // ---- 5 LLM tokens: L, dropped on the References docker's TOP edge = stacked inside it; its bottom edge sizes it
    await p.mouse.move(1000, 900);
    await p.keyboard.press("l"); await p.waitForTimeout(300);
    h = await rect("#sf-llmtok .sft");
    const rf = await rect("#refsdock");
    await drag(h.x + 5, h.y + 5, rf.x + rf.w / 2, rf.y + 4);
    const s1 = await ev(() => ({ cls: document.getElementById("sf-llmtok").className, par: document.getElementById("sf-llmtok").parentElement.id,
      after: (document.getElementById("sf-llmtok").previousElementSibling || {}).className }));
    check("LLM tokens dropped on the References docker's top edge: stacked at its top, under its title bar", /df-side/.test(s1.cls) && s1.par === "refsdock" && /dockhead/.test(s1.after || ""), s1);
    const s2 = await rect("#sf-llmtok");
    await drag(s2.x + s2.w / 2, s2.b - 2, s2.x + s2.w / 2, s2.b + 80);
    const s3 = await rect("#sf-llmtok");
    check("...its bottom edge sizes its height there", s3.h >= s2.h + 70, { s2, s3 });

    // ---- 6 over a docker's middle it just floats
    h = await rect("#sf-llmtok .sft");
    const as = await rect("#assetsdock");
    await drag(h.x + 5, h.y + 5, as.x + as.w / 2, as.y + as.h / 2);
    const m1 = await ev(() => document.getElementById("sf-llmtok").className);
    check("dragged out and let go over the MIDDLE of a docker: it floats there (no docking)", /df-float/.test(m1) && !/df-side|df-tabbed/.test(m1), m1);

    // ---- 7 beside a bottom docker (a row), below one (the column)
    const vd = await rect("#videodock");
    h = await rect("#sf-llmtok .sft");
    await drag(h.x + 5, h.y + 5, vd.r - 8, vd.y + vd.h / 2);
    const w1 = await ev(() => { const e = document.getElementById("sf-llmtok"), v = document.getElementById("videodock"); return { cls: e.className, row: e.parentElement.className, vw: Math.round(v.getBoundingClientRect().width), ew: Math.round(e.getBoundingClientRect().width), sameRow: e.parentElement === v.parentElement, z: e.style.zIndex }; });
    check("dropped on the video docker's RIGHT edge: beside it in a row (the video docker still shown, no floating z-order left on it)",
      /df-inrow/.test(w1.cls) && /df-row/.test(w1.row) && w1.sameRow && w1.vw > 150 && w1.ew >= 200 && w1.z === "", w1);
    const e0 = await rect("#sf-llmtok");
    await drag(e0.x + 2, e0.y + e0.h / 2, e0.x - 60, e0.y + e0.h / 2);
    const e1 = await rect("#sf-llmtok");
    check("...its inner edge sizes its width", e1.w >= e0.w + 50, { e0, e1 });
    h = await rect("#sf-llmtok .sft");
    const vd2 = await rect("#videodock");
    await drag(h.x + 5, h.y + 5, vd2.x + vd2.w / 2, vd2.b - 8);
    const b1 = await ev(() => { const e = document.getElementById("sf-llmtok"); return { cls: e.className, par: e.parentElement.id, prev: (e.previousElementSibling || {}).className, h: Math.round(e.getBoundingClientRect().height) }; });
    check("dropped on the video docker's BOTTOM edge: below it in the column", /df-stack/.test(b1.cls) && b1.par === "maincol" && b1.h > 80, b1);
    await p.waitForTimeout(600);

    // ---- 8 kept over a reload
    const kept = (await status()).floats;
    check("docker_status.json keeps where each is: Basic Settings a tab in the Settings docker, LLM tokens below the video docker",
      kept.basic.mode === "tab" && kept.basic.to === "ldock" && kept.basic.active === true && kept.llmtok.mode === "dock" && kept.llmtok.to === "videodock" && kept.llmtok.side === "bottom", kept);
    await boot();
    const re = await ev(() => ({ b: document.getElementById("sf-basic").className, bp: document.getElementById("sf-basic").parentElement.id, l: document.getElementById("sf-llmtok").className,
      lp: document.getElementById("sf-llmtok").parentElement.id, tabs: [...document.querySelectorAll("#ldock > .dftabs button")].map((x) => x.dataset.dft + (x.classList.contains("on") ? "*" : "")).join("|") }));
    check("...and after a reload they come back there", /df-tabbed/.test(re.b) && re.bp === "ldock" && re.tabs === "__host|basic*" && /df-stack/.test(re.l) && re.lp === "maincol", re);

    // ---- 9 S hides the tab and shows it again; the tab dragged out floats
    await p.mouse.move(1000, 900);
    await p.keyboard.press("s"); await p.waitForTimeout(250);
    const g1 = await ev(() => ({ strip: !!document.querySelector("#ldock > .dftabs"), host: getComputedStyle(document.querySelector("#ldock > .scroll, #ldock > .projbar")).display }));
    await p.keyboard.press("s"); await p.waitForTimeout(250);
    const g2 = await ev(() => [...document.querySelectorAll("#ldock > .dftabs button")].map((x) => x.dataset.dft + (x.classList.contains("on") ? "*" : "")).join("|"));
    check("S hides the tabbed panel (the tab strip goes, the docker shows) and S brings it back as the shown tab", !g1.strip && g1.host !== "none" && g2 === "__host|basic*", { g1, g2 });
    const tb = await rect('#ldock > .dftabs [data-dft="basic"]');
    const mid = await rect("#assetsdock");                       // a docker's middle: no drop zone there
    await drag(tb.x + 15, tb.y + tb.h / 2, mid.x + mid.w / 2, mid.y + mid.h / 2);
    const out = await ev(() => ({ cls: document.getElementById("sf-basic").className, strip: !!document.querySelector("#ldock > .dftabs") }));
    check("its tab dragged out of the docker: floating again, the docker's tab strip gone", /df-float/.test(out.cls) && !out.strip, out);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await post(RESET); } catch { /* fine */ }
    try {
      await ev((bf) => {
        for (const id of ["basic", "llmtok"]) { SecFloat.show(id, false); SecFloat.float(id, null, null, null, null); SecFloat.show(id, false); }
        PFloat.float();
        for (const btn of window.__dfSides || []) document.getElementById(btn).click();
        for (const [id, gone, col] of bf || []) {
          const d = document.getElementById(id); if (!d) continue;
          if (d.classList.contains("dockgone") !== gone) toggleDockGone(id, null);
          if (!gone && d.classList.contains("collapsed") !== col) toggleCollapse(id);
        }
      }, before);
      await p.waitForTimeout(1200);
      await post(RESET);
      const after = await ev(() => ({ gone: [...document.querySelectorAll("#maincol .bdock")].filter((d) => d.classList.contains("dockgone")).map((d) => d.id).join(), app: document.getElementById("app").className }));
      console.log("put back: " + JSON.stringify(after));
    } catch (e) { console.log("put back failed: " + (e && e.message)); }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
