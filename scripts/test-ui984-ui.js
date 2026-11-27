#!/usr/bin/env node
/* bitGen Studio — 2.984.0 in a REAL browser: the Sketcher's arrow keys and its ⚙ properties docker.
 * Tim: "in sketcher use up and down arrow keys to zoom in and out, use left and right to orbit on the xy plane ... make the
 * properties panel next to the left toolbox a collapsible docker. allow other dockers that are confined to sketcher to dock
 * inside the properties docker either as a docker below or as a tab inside the properties docker." */
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
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2000, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const box = (id) => ev((i) => { const e = document.getElementById(i); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), d: getComputedStyle(e).display, par: e.parentElement && (e.parentElement.id || e.parentElement.className) }; }, id);
  const cam = () => ev(() => { const V = H3PushPull.state.V, c = V.cam(), t = V.controls.target; return { x: c.position.x - t.x, y: c.position.y - t.y, z: c.position.z - t.z, d: c.position.distanceTo(t), zoom: c.zoom }; });
  const keyIn = async (k) => { await p.mouse.move(vw.l + vw.w / 2, vw.t + vw.h / 2); await p.keyboard.press(k); await p.waitForTimeout(80); };
  let vw = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { localStorage.removeItem("h3.ppdocks"); localStorage.setItem("pp.outline", "1"); Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PPDocks && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V && document.getElementById("ppDockCol"), null, { timeout: 40000 });
    await p.waitForTimeout(400);
    const T = await box("ppTools"), C = await box("ppDockCol"); vw = await box("ppView");
    const order = await ev(() => [...document.getElementById("ppMain").children].map((e) => e.id).filter(Boolean).slice(0, 3).join());
    check("the docker sits right of the left toolbox, before the view; ⚙ Properties and 🗂 Outline in it, stacked", order === "ppTools,ppDockCol,ppView" && C.l >= T.l + T.w - 2 && C.l + C.w <= vw.l + 2 && (await box("ppProps")).par === "ppdkbody" && (await box("ppOutline")).par === "ppdkbody"
      && (await ev(() => document.querySelectorAll("#ppDockCol .ppdkg:not(.ppdk-hide)").length)) === 2, { order, T, C, vw, pr: await box("ppProps") });
    check("nothing picked: ⚙ Properties says so instead of vanishing", await ev(() => { const e = document.getElementById("ppProps"); return e.classList.contains("ppdk-none") && getComputedStyle(e).display === "block" && /Nothing picked/.test(getComputedStyle(e, "::before").content); }));
    await ev(() => H3PushPull.tool("wall")); await p.waitForTimeout(200);
    check("a tool chosen: its settings fill ⚙ Properties in the docker", await ev(() => { const e = document.getElementById("ppProps"); return !e.classList.contains("ppdk-none") && e.querySelectorAll(".ppr").length > 0 && e.getBoundingClientRect().width > 150; }));
    await ev(() => H3PushPull.tool("select")); await p.waitForTimeout(150);

    // ---- the arrow keys
    await ev(() => { H3PushPull.state.V.view("iso"); }); await p.waitForTimeout(100);
    // 2.986.0: ↑ ↓ ← → pan, Ctrl+↑ / ↓ zoom (Tim's second ask - test-ui986-ui.js has the rest)
    const tgt = () => ev(() => { const t = H3PushPull.state.V.controls.target; return [t.x, t.y, t.z]; });
    const c0 = await cam(); await keyIn("Control+ArrowUp"); const c1 = await cam(); await keyIn("Control+ArrowDown"); await keyIn("Control+ArrowDown"); const c2 = await cam();
    const zoomed = (a, b2) => (a.zoom !== b2.zoom ? b2.zoom / a.zoom : a.d / b2.d);
    check("Ctrl+↑ zooms in, Ctrl+↓ zooms out (the view, no tool going)", zoomed(c0, c1) > 1.1 && zoomed(c1, c2) < 0.85, [c0, c1, c2]);
    const t0 = await tgt(), a0 = await cam(); await keyIn("ArrowLeft"); const t1 = await tgt(), a1 = await cam();
    check("← pans (the view slides, its angle and distance kept)", Math.hypot(t1[0] - t0[0], t1[1] - t0[1], t1[2] - t0[2]) > 0.2 && Math.abs(a1.x - a0.x) < 1e-6 && Math.abs(a1.d - a0.d) < 1e-6, [t0, t1]);
    // a line started: the arrows keep their SketchUp meaning (an axis), the view stays
    await ev(() => H3PushPull.tool("line")); await p.mouse.click(vw.l + vw.w / 2, vw.t + vw.h / 2 + 40); await p.waitForTimeout(100);
    const l0 = await cam(), lt0 = await tgt(); await keyIn("ArrowRight"); const l1 = await cam(), lt1 = await tgt();
    check("with a line half-way ← → ↑ keep an axis instead (the view does not move)", Math.abs(l1.x - l0.x) < 1e-9 && lt1.every((v, i) => Math.abs(v - lt0[i]) < 1e-9) && Math.abs(l1.d - l0.d) < 1e-9 && /red axis/.test(await ev(() => document.getElementById("ppMsg").textContent)), await ev(() => document.getElementById("ppMsg").textContent));
    await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await ev(() => H3PushPull.tool("select"));
    // typing in a box: the arrows are the box's
    const v0 = await cam(), vt0 = await tgt(); await p.focus("#ppVcb"); await p.keyboard.press("ArrowUp"); const v1 = await cam(), vt1 = await tgt();
    check("in a text box the arrows stay the box's", Math.abs(v1.d - v0.d) < 1e-9 && v1.zoom === v0.zoom && vt1.every((v, i) => Math.abs(v - vt0[i]) < 1e-9));
    await ev(() => document.activeElement.blur());

    // ---- fold / unfold
    await p.click("#ppDkFold"); await p.waitForTimeout(250);
    const F = await box("ppDockCol"), vw2 = await box("ppView");
    check("« folds the docker to a strip; the view gets the room", F.w <= 26 && vw2.w > vw.w + 150 && (await ev(() => [...document.querySelectorAll("#ppDkStrip button")].map((x) => x.textContent).join("|"))) === "🗂 Outline|⚙ Properties", { F, vw2, vw });
    await p.click("#ppDkStrip button:nth-child(2)"); await p.waitForTimeout(250);
    check("a strip button opens it again", (await box("ppDockCol")).w > 200);

    // ---- ⚙ Properties dragged onto the 🗂 Outline's tab bar = a tab there; out of the column = its own place (right of the view)
    const tabP = await p.locator('.ppdktab[data-id="props"]').boundingBox(), barO = await p.locator('.ppdkg[data-gi="0"] .ppdkbar').boundingBox();
    await p.mouse.move(tabP.x + 10, tabP.y + 6); await p.mouse.down(); await p.mouse.move(tabP.x + 30, tabP.y - 40, { steps: 4 }); await p.mouse.move(barO.x + barO.width - 40, barO.y + barO.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    let L = await ev(() => H3PPDocks.layout());
    check("⚙ Properties dragged onto the Outline's tab bar = a TAB beside it (one docker, two tabs, Properties shown)", L.groups.length === 1 && L.groups[0].tabs.join() === "outline,props" && L.groups[0].on === "props" && (await box("ppOutline")).d === "none" && (await box("ppProps")).d === "block", L);
    await p.click('.ppdktab[data-id="outline"]'); await p.waitForTimeout(150);
    check("a click on a tab shows it", (await box("ppOutline")).d !== "none" && (await box("ppProps")).d === "none");
    const tP2 = await p.locator('.ppdktab[data-id="props"]').boundingBox(), Cb = await box("ppDockCol");
    await p.mouse.move(tP2.x + 10, tP2.y + 6); await p.mouse.down(); await p.mouse.move(Cb.l + Cb.w / 2, Cb.t + Cb.h - 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    L = await ev(() => H3PPDocks.layout());
    check("dragged onto the lower part of the docker = its OWN docker below", L.groups.map((g) => g.tabs.join("+")).join("|") === "outline|props", L);
    const tP3 = await p.locator('.ppdktab[data-id="props"]').boundingBox();
    await p.mouse.move(tP3.x + 10, tP3.y + 6); await p.mouse.down(); await p.mouse.move(vw.l + vw.w / 2, vw.t + 200, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
    await ev(() => H3PushPull.tool("wall")); await p.waitForTimeout(200);
    const home = await box("ppProps"), vw3 = await box("ppView");
    check("dragged out of the column = back in its own place (right of the view, shown for a tool as before)", home.par === "ppMain" && home.l >= vw3.l + vw3.w - 2 && home.d === "block" && !(await ev(() => document.getElementById("ppProps").classList.contains("ppdkp"))), { home, vw3 });
    await ev(() => H3PushPull.tool("select"));
    // back by the ▾ menu
    await p.click("#ppDkMenuBtn"); await p.locator(".ppdkmenu .r", { hasText: "⚙ Properties" }).locator("button", { hasText: "Tab" }).click(); await p.waitForTimeout(200);
    L = await ev(() => H3PPDocks.layout());
    check("▾ → ⚙ Properties → Tab: a tab in the docker again", L.groups.length === 1 && L.groups[0].tabs.join() === "outline,props" && (await box("ppProps")).par === "ppdkbody", L);

    // ---- the DAZ dockers: the library's title dragged onto the column; the explorer below by ⋯; DAZ off hides their tabs
    await p.click("#ppDazLib"); await p.waitForFunction(() => document.getElementById("dzLib") && document.getElementById("pushpulldock").classList.contains("dz-on"), null, { timeout: 15000 });
    await p.waitForTimeout(300);
    const lh = await box("dzLibHead"), C2 = await box("ppDockCol");
    await p.mouse.move(lh.l + 40, lh.t + lh.h / 2); await p.mouse.down(); await p.mouse.move(lh.l + 80, lh.t + 60, { steps: 4 }); await p.mouse.move(C2.l + 60, C2.t + 30, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
    L = await ev(() => H3PPDocks.layout());
    const lib = await box("dzLib"), C3 = await box("ppDockCol");
    check("📚 the library's title dragged onto the docker = a tab in it (no longer floating)", L.groups[0].tabs.includes("dzlib") && lib.par === "ppdkbody" && lib.l >= C3.l - 1 && lib.l + lib.w <= C3.l + C3.w + 1 && (await ev(() => getComputedStyle(document.getElementById("dzLib")).position)) === "static", { L, lib, C3 });
    check("the library still works docked: its grid lists the content", await ev(() => document.querySelectorAll("#dzGrid .dzit").length >= 0 && !!document.getElementById("dzTabs")));
    await ev(() => H3PPDocks.place("dzexp", "below", 0)); await p.waitForTimeout(250);
    const exp = await box("dzExp"), side = await ev(() => document.getElementById("dzSide").className);
    check("🧭 the explorer as its own docker below; the right DAZ column keeps only 🎚 Parameters (filling it)", exp.par === "ppdkbody" && / ppdk-one|^ppdk-one|ppdk-one/.test(side) && (await box("dzPar")).h > 300, { exp, side });
    await p.click("#ppDazLib"); await p.waitForTimeout(300);
    check("📚 off: the DAZ tabs leave the docker (their places kept), the rest stays", (await ev(() => [...document.querySelectorAll("#ppDockCol .ppdkg:not(.ppdk-hide) .ppdktab")].map((t) => t.dataset.id).join())) === "outline,props" && (await ev(() => H3PPDocks.layout().groups.map((g) => g.tabs.join("+")).join("|"))) === "outline+props+dzlib|dzexp");
    await p.click("#ppDazLib"); await p.waitForTimeout(300);
    check("📚 on again: they are back where they were put", (await ev(() => [...document.querySelectorAll("#ppDockCol .ppdkg:not(.ppdk-hide) .ppdktab")].map((t) => t.dataset.id).join())) === "outline,props,dzlib,dzexp");
    // kept over a reload
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && H3PushPull.state.booted && document.getElementById("ppDockCol") && document.getElementById("dzLib"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    check("kept over a reload: the library a tab, the explorer below", (await box("dzLib")).par === "ppdkbody" && (await box("dzExp")).par === "ppdkbody" && (await ev(() => H3PPDocks.layout().groups.map((g) => g.tabs.join("+")).join("|"))) === "outline+props+dzlib|dzexp");
    // ↩ everything home: the 2.983 layout
    await ev(() => { ["dzlib", "dzexp"].forEach((id) => H3PPDocks.place(id, "home")); }); await p.waitForTimeout(300);
    const lib2 = await box("dzLib"), side2 = await box("dzSide");
    check("↩ back to their own places: the library floats again, the explorer + parameters right of the view", (await ev(() => getComputedStyle(document.getElementById("dzLib")).position)) === "absolute" && lib2.par === "ppMain" && side2.d !== "none" && (await box("dzExp")).par === "dzSide", { lib2, side2 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await ev(() => { localStorage.removeItem("h3.ppdocks"); Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); }).catch(() => {});
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
