#!/usr/bin/env node
/* bitGen Studio — 2.609.0 in a REAL browser: THE IMAGE EDITOR'S PANEL COLUMN TAKES ANY FLOATING DOCKER, KEPT.
 * Tim: "add docker dropzones to the image-editor panel where layers are in so user can add floating dockers to that
 * panel. pending docker should be able to dock in that panel" + "also keep the dockers status and parent dockers saved .
 * when the parent docker is visible keep all child dockers within the parent".
 *   drag by the title over the column: an orange drop line; let go = docked in the column - a main docker floated with ⇱
 *   (Assets), a ▣ named docker, Basic Settings, ⏳ Pending; the column bar: fold (kept), drag to another place, drag out =
 *   floats again; the image editor hidden = they hide with it, shown = back inside it; a RELOAD puts every one back in
 *   the column, in its order, folded as it was.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.609.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.coldock && window.H3Panels && window.H3DockGroup && window.SecFloat && window.SecFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
  };
  // drag (x0, y0) -> (x1, y1) in steps; mid = a callback while still pressed
  const drag = async (x0, y0, x1, y1, mid) => {
    await p.mouse.move(x0, y0); await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12);
    await p.waitForTimeout(120);
    const got = mid ? await mid() : null;
    await p.mouse.up(); await p.waitForTimeout(400);
    return got;
  };
  const colPoint = () => ev(() => { const c = document.getElementById("pcPanels").getBoundingClientRect(), parts = [...document.querySelectorAll("#pcPanels > .pcgrp:not(.off), #pcPanels > .pcfd")].filter((x) => x.offsetParent !== null); const l = parts[parts.length - 1].getBoundingClientRect(); return { x: Math.round(c.left + c.width / 2), y: Math.round(Math.min(c.bottom - 6, l.bottom - 6)) }; });
  const markOn = () => ev(() => { const m = document.getElementById("h3fpZone"); const z = document.getElementById("dgZone"); return !!((m && m.style.display !== "none") || (z && z.style.display === "block")); });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await boot();
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(500);
    // the editor big in the main column (not full screen: the app's floating dockers float over the main column)
    const full = async () => { await ev(() => { document.documentElement.style.setProperty("--eh", "900px"); const d = document.getElementById("imageeditdock"); d.scrollIntoView(); window.dispatchEvent(new Event("resize")); }); await p.waitForTimeout(500);
      await ev(() => { const E = window.imageEditorInstance.E; if (!window.imageEditorInstance.state.w) E.openDoc(400, 300, "dock.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300); }); }); await p.waitForTimeout(300); };
    await full();
    check("the image editor's panel column is a drop host for every floating docker", await ev(() => H3Panels.zones().includes("ie.column") && !!document.getElementById("pcPanels")));

    /* 1 a main docker floated with ⇱ (Assets) */
    await ev(() => H3DockGroup.floatDock("assetsdock")); await p.waitForTimeout(500);
    let t = await ev(() => { const w = document.querySelector('.h3fp[data-fp="bd.assetsdock"]'); const r = w.querySelector(".h3fp-t").getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + 12), st: H3Panels.get("bd.assetsdock").state }; });
    let to = await colPoint();
    let mk = await drag(t.x, t.y, to.x, to.y, markOn);
    let s1 = await ev(() => ({ st: H3Panels.get("bd.assetsdock").state, inCol: !!document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"] #assetsdock'), vis: document.getElementById("assetsdock").getBoundingClientRect().height > 50 }));
    check("Assets floated with ⇱, dragged by its title over the column: the drop line shows; let go = docked IN the column (state zone)", t.st === "float" && mk && s1.st === "zone" && s1.inCol && s1.vis, { t, mk, s1 });

    /* 2 a ▣ named docker */
    await ev(() => { window.__fd = H3Panels.newDocker({ name: "Zone Test" }).id; H3Panels.float(__fd, { x: 300, y: 200, w: 300, h: 260 }); });
    await p.waitForTimeout(300);
    t = await ev(() => { const r = H3Panels.get(__fd).win.querySelector(".h3fp-t").getBoundingClientRect(); return { x: Math.round(r.left + 30), y: Math.round(r.top + 12) }; });
    to = await colPoint();
    mk = await drag(t.x, t.y, to.x, to.y, markOn);
    const s2 = await ev(() => ({ st: H3Panels.get(__fd).state, inCol: !!document.querySelector(`#pcPanels > .pcfd[data-fd="${__fd}"] .h3fp.h3fp-zoned`), cfg: !!document.querySelector(`#pcPanels > .pcfd[data-fd="${__fd}"] [data-fdact="cfg"]`) }));
    check("a ▣ named docker dragged in: docked in the column (its ⚙ menu on the column bar)", mk && s2.st === "zone" && s2.inCol && s2.cfg, { mk, s2 });

    /* 3 Basic Settings (a SecFloat window) */
    await ev(() => { SecFloat.show("basic", true); SecFloat.float("basic", 260, 160, 360, 300); });
    await p.waitForTimeout(500);
    t = await ev(() => { const r = document.querySelector("#sf-basic .sfhead").getBoundingClientRect(); return { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2) }; });
    to = await colPoint();
    mk = await drag(t.x, t.y, to.x, to.y, markOn);
    await p.waitForTimeout(400);
    const s3 = await ev(() => ({ st: (H3Panels.get("sf.basic") || {}).state, inCol: !!document.querySelector('#pcPanels > .pcfd[data-fd="sf.basic"] #sf-basic.dg-in'), ctl: !!document.querySelector("#pcPanels #sec-basic") }));
    check("Basic Settings dragged by its title bar over the column: docked in it, its settings inside", mk && s3.st === "zone" && s3.inCol && s3.ctl, { mk, s3 });

    /* 3b the prompt docker */
    const hasPf = await ev(() => !!(document.getElementById("promptdock") && window.PFloat && PFloat.float));
    if (hasPf) {
      await ev(() => { const d = document.getElementById("promptdock"); if (d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("promptdock"); PFloat.float(240, 520, 420, 260); });
      await p.waitForTimeout(500);
      t = await ev(() => { const r = document.querySelector("#promptdock > .bhead").getBoundingClientRect(); return { x: Math.round(r.left + 60), y: Math.round(r.top + r.height / 2), fl: document.getElementById("promptdock").classList.contains("pf-float") }; });
      to = await colPoint();
      mk = await drag(t.x, t.y, to.x, to.y, markOn);
      await p.waitForTimeout(400);
      const s3b = await ev(() => ({ st: (H3Panels.get("pf.promptdock") || {}).state, inCol: !!document.querySelector('#pcPanels > .pcfd[data-fd="pf.promptdock"] #promptdock.dg-in') }));
      check("the prompt docker (floating) dragged by its title over the column: docked in it", t.fl && mk && s3b.st === "zone" && s3b.inCol, { t, mk, s3b });
      await ev(() => H3Panels.zoneOut("pf.promptdock", { x: 200, y: 500, w: 420, h: 260 })); await p.waitForTimeout(600);
      const s3c = await ev(() => ({ st: (H3Panels.get("pf.promptdock") || {}).state, fl: document.getElementById("promptdock").classList.contains("pf-float"), out: !document.querySelector("#pcPanels #promptdock") }));
      check("…⇱ from the column: the prompt docker floats on its own again", s3c.out && s3c.fl, s3c);
    }

    /* 4 ⏳ Pending */
    await ev(() => window.imageEditorInstance.E.pending.show()); await p.waitForTimeout(200);
    t = await ev(() => { const r = document.getElementById("ppHead").getBoundingClientRect(); return { x: Math.round(r.left + 30), y: Math.round(r.top + 10) }; });
    to = await colPoint();
    mk = await drag(t.x, t.y, to.x, to.y, markOn);
    const s4 = await ev(() => ({ st: (H3Panels.get("ie.pending") || {}).state, inCol: !!document.querySelector('#pcPanels > .pcfd[data-fd="ie.pending"] #pcPend'), pos: getComputedStyle(document.getElementById("pcPend")).position, vis: document.getElementById("pcPend").offsetParent !== null }));
    check("⏳ Pending dragged by its title over the column: the drop line; docked in the column (in its place, not floating)", mk && s4.st === "zone" && s4.inCol && s4.pos === "relative" && s4.vis, { mk, s4 });

    /* 5 the column bar: fold (kept), move within the column */
    await p.click('#pcPanels > .pcfd[data-fd="bd.assetsdock"] [data-fdact="fold"]'); await p.waitForTimeout(200);
    const f1 = await ev(() => ({ fold: document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"]').classList.contains("fold"), kept: window.imageEditorInstance.E.store.get("pc.fd.f.bd.assetsdock", false) }));
    check("▾ on its bar folds it to the bar - kept", f1.fold && f1.kept === true, f1);
    const before = await ev(() => [...document.querySelectorAll("#pcPanels > .pcfd")].map((x) => x.dataset.fd));
    t = await ev(() => { const h = document.querySelector('#pcPanels > .pcfd[data-fd="ie.pending"] > .pcfdh'); h.scrollIntoView({ block: "center" }); const r = h.getBoundingClientRect(); return { x: Math.round(r.left + 50), y: Math.round(r.top + 10) }; });
    const tgt = await ev(() => { const r = document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 4) }; });
    await drag(t.x, t.y, tgt.x, tgt.y);
    const mv = await ev(() => ({ order: [...document.querySelectorAll("#pcPanels > .pcfd")].map((x) => x.dataset.fd), st: H3Panels.get("ie.pending").state }));
    check("its bar dragged above Assets: moved there in the column (still docked)", mv.order[0] === "ie.pending" && before[0] === "bd.assetsdock" && mv.st === "zone", { before, mv, tgt });

    /* 6 the parent hidden / shown: the docked ones go and come back WITH it */
    await ev(() => toggleDockGone("imageeditdock", "tIE")); await p.waitForTimeout(500);
    const h1 = await ev(() => ({ assets: document.getElementById("assetsdock").offsetParent !== null || document.getElementById("assetsdock").getBoundingClientRect().width > 0, pend: document.getElementById("pcPend").getBoundingClientRect().width > 0, st: H3Panels.get("bd.assetsdock").state, stillIn: !!document.querySelector('#pcPanels #assetsdock') }));
    await ev(() => toggleDockGone("imageeditdock", "tIE")); await p.waitForTimeout(600);
    const h2 = await ev(() => ({ pend: document.getElementById("pcPend").getBoundingClientRect().width > 0, inside: (() => { const c = document.getElementById("pcPanels").getBoundingClientRect(), r = document.getElementById("pcPend").getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1; })(), st: H3Panels.get("ie.pending").state }));
    check("the image editor hidden: its docked dockers hide with it (still docked in it); shown again: back, inside its column",
      !h1.assets && !h1.pend && h1.st === "zone" && h1.stillIn && h2.pend && h2.inside && h2.st === "zone", { h1, h2 });

    /* 7 kept: a reload puts them back */
    const order0 = await ev(() => [...document.querySelectorAll("#pcPanels > .pcfd")].map((x) => x.dataset.fd));
    await ev(() => H3Panels.flush()); await p.waitForTimeout(800);
    const lay = await ev(() => fetch("/api/layout/panel").then((r) => r.json()));
    const kept = (id) => (lay.panels[id] || lay.dockers[id] || {});
    check("panel_layout.cfg keeps each one as docked in the column (state zone, host ie.column, its place)",
      ["bd.assetsdock", "sf.basic", "ie.pending"].every((id) => kept(id).state === "zone" && kept(id).zone && kept(id).zone.host === "ie.column" && kept(id).zone.key) && kept(await ev(() => __fd)).state === "zone", { a: kept("bd.assetsdock"), s: kept("sf.basic"), p: kept("ie.pending") });
    const fdId = await ev(() => __fd);
    await p.reload({ waitUntil: "domcontentloaded" });
    await boot();
    await full();
    await p.waitForTimeout(2500);
    const r1 = await ev((fd) => ({ order: [...document.querySelectorAll("#pcPanels > .pcfd")].map((x) => x.dataset.fd), states: ["bd.assetsdock", "sf.basic", "ie.pending", fd].map((id) => (H3Panels.get(id) || {}).state),
      assets: !!document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"] #assetsdock'), basic: !!document.querySelector('#pcPanels > .pcfd[data-fd="sf.basic"] #sf-basic'), pend: !!document.querySelector('#pcPanels > .pcfd[data-fd="ie.pending"] #pcPend'),
      fd: !!document.querySelector(`#pcPanels > .pcfd[data-fd="${fd}"] .h3fp`), fold: document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"]').classList.contains("fold") }), fdId);
    check("after a RELOAD every one is back in the column - in the same order, Assets still folded",
      r1.assets && r1.basic && r1.pend && r1.fd && r1.states.every((s) => s === "zone") && JSON.stringify(r1.order) === JSON.stringify(order0) && r1.fold, { r1, order0 });

    /* 8 out again: drag the bar out of the column = it floats */
    t = await ev(() => { const h = document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"] > .pcfdh'); h.scrollIntoView({ block: "center" }); const r = h.getBoundingClientRect(); return { x: Math.round(r.left + 60), y: Math.round(r.top + 10) }; });
    await drag(t.x, t.y, 700, 400);
    const o1 = await ev(() => ({ st: H3Panels.get("bd.assetsdock").state, gone: !document.querySelector('#pcPanels > .pcfd[data-fd="bd.assetsdock"]'), inWin: !!document.querySelector('.h3fp[data-fp="bd.assetsdock"] #assetsdock') }));
    check("its bar dragged out of the column: Assets floats again (its window), its place in the column goes", o1.st === "float" && o1.gone && o1.inWin, o1);
    await ev(() => document.querySelector('#pcPanels > .pcfd[data-fd="ie.pending"]').scrollIntoView({ block: "center" }));
    await p.click('#pcPanels > .pcfd[data-fd="ie.pending"] [data-fdact="out"]'); await p.waitForTimeout(300);
    const o2 = await ev(() => ({ st: H3Panels.get("ie.pending").state, pos: getComputedStyle(document.getElementById("pcPend")).position, parent: document.getElementById("pcPend").parentElement === window.imageEditorInstance.E.kx }));
    check("⇱ on Pending's bar: it floats on its own inside the editor again", o2.st === "home" && o2.pos === "absolute" && o2.parent, o2);

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try {
      await ev(() => {
        for (const id of ["bd.assetsdock", "sf.basic", "ie.pending"]) { const r = H3Panels.get(id); if (r && r.state !== "home" && r.home) H3Panels.home(id); }
        H3Panels.list().filter((d) => d.kind === "docker" && /zone-test/.test(d.id)).forEach((d) => H3Panels.remove(d.id));
        SecFloat.show("basic", false); H3Panels.flush();
      });
      await p.waitForTimeout(600);
    } catch { /* closed */ }
    await b.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
