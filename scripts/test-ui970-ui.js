#!/usr/bin/env node
/* bitGen Studio — 2.970.0 in a REAL browser: the Timeline docker's extra SCREENS. Two text layers (red LAYER A left, green
 * LAYER B right) - the pixels on every screen are counted: the master shows both, screen 2 only red, screen 3 only green;
 * right-click ▸ Swap with the master puts A alone on the big preview and the whole picture on screen 2 (a snapshot is still
 * the whole picture); the badge / the menu put it back; the preview keeps its room in a short docker. Put back after. */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 3000, height: 1500 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // red / green pixels on a canvas (the big preview's #tlCanvas or a screen's)
  const rg = (sel) => ev((s) => { const cv = document.querySelector(s); const g = cv.getContext("2d"); const d = g.getImageData(0, 0, cv.width, cv.height).data; let r = 0, gr = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) r++; else if (d[i + 1] > 180 && d[i] < 110 && d[i + 2] < 140) gr++; } return { r, g: gr }; }, sel);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlScreens && window.TlCanvas && typeof renderTimeline === "function", null, { timeout: 60000 });
    await ev(() => { window.__tl970 = JSON.stringify({ video: tl.video, audio: tl.audio, images: tl.images, vlayers: tl.vlayers, sel: tl.selLayer });
      while (TlScreens.list().length) TlScreens.remove(0);
      tl.video = []; tl.audio = []; tl.vlayers = []; tl.images = []; renderTimeline(); window.toggleMax("timelinedock", true); window.TlFloat && TlFloat.show(false);
      const S = TlCanvas.state; TlCanvas.go(0);
      S.color = "#ff2020"; TlCanvas.addText({ x: S.W * 0.3, y: S.H * 0.5 }); tl.images[0].clips[0].text.content = "LAYER A"; tl.images[0].name = "Title A";
      S.color = "#20ff40"; TlCanvas.addText({ x: S.W * 0.7, y: S.H * 0.5 }); tl.images[1].clips[0].text.content = "LAYER B"; tl.images[1].name = "Title B";
      tlSave(); renderTimeline(); document.activeElement && document.activeElement.blur(); TlCanvas.select && TlCanvas.select(null); TlCanvas.mark(); });
    await sleep(700);
    const e0 = await ev(() => TlScreens.info());
    const st0 = await ev(() => Math.round(document.getElementById("tlStage").getBoundingClientRect().height));
    check("no screens at first: the column is a slim tab; the preview has its room", e0.n === 0 && e0.empty && e0.width <= 30 && st0 >= 190, { e0, st0 });

    // ＋ twice: screen 2 = the picked layer? none picked -> the first free picture layer; then set them
    await p.click("#tlScrAdd"); await sleep(200); await p.click("#tlScrAdd"); await sleep(200);
    await p.selectOption('.tsc[data-i="0"] .tsc-sel', "i:0"); await sleep(200);
    await p.selectOption('.tsc[data-i="1"] .tsc-sel', "i:1"); await sleep(200);
    await ev(() => { TlScreens.width(360); TlCanvas.mark(); }); await sleep(500);
    const e1 = await ev(() => ({ info: TlScreens.info(), ls: localStorage.getItem("h3.tl.screens"), opts: [...document.querySelectorAll('.tsc[data-i="0"] .tsc-sel option')].map((o) => o.textContent) }));
    const m1 = await rg("#tlCanvas"), s2 = await rg('.tsc[data-i="0"] .tsc-cv'), s3 = await rg('.tsc[data-i="1"] .tsc-cv');
    check("＋ adds screens (numbered 2, 3); each picks its layer from the picture layers; kept (h3.tl.screens)",
      e1.info.n === 2 && !e1.info.empty && /"lk":"i:0"/.test(e1.ls) && /"lk":"i:1"/.test(e1.ls) && e1.opts.some((o) => /Title A/.test(o)) && e1.opts.some((o) => /Title B/.test(o)) && e1.opts.some((o) => /^V1/.test(o)), e1);
    check("the master shows the whole picture (red AND green); screen 2 only layer A (red), screen 3 only layer B (green)",
      m1.r > 20 && m1.g > 20 && s2.r > 5 && s2.g === 0 && s3.g > 5 && s3.r === 0, { m1, s2, s3 });
    // they play together: move the time past the texts' end (5 s) - all of them go dark at once
    await ev(() => { TlCanvas.go(6); TlCanvas.mark(); }); await sleep(400);
    const late = { m: await rg("#tlCanvas"), a: await rg('.tsc[data-i="0"] .tsc-cv'), b: await rg('.tsc[data-i="1"] .tsc-cv') };
    await ev(() => { TlCanvas.go(1); TlCanvas.mark(); }); await sleep(400);
    check("in step with the master: at 6 s (after the texts) every screen is empty, back at 1 s they show again", late.m.r + late.m.g === 0 && late.a.r === 0 && late.b.g === 0 && (await rg('.tsc[data-i="0"] .tsc-cv')).r > 5, late);

    // right-click screen 2 -> the menu -> ⇄ Swap with the master
    const sc = await ev(() => { const r = document.querySelector('.tsc[data-i="0"] .tsc-cv').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(sc.x, sc.y, { button: "right" }); await sleep(250);
    const menu = await ev(() => [...document.querySelectorAll(".tsc-menu button")].map((x) => x.textContent + (x.disabled ? " (off)" : "")));
    await p.click(".tsc-menu button:first-child"); await sleep(500);
    const sw = await ev(() => TlScreens.info());
    const m2 = await rg("#tlCanvas"), s2b = await rg('.tsc[data-i="0"] .tsc-cv');
    const snap = await ev(() => { try { const c = document.createElement("canvas"); c.width = TlCanvas.state.W; c.height = TlCanvas.state.H; TlCanvas.paintComp(c.getContext("2d"), TlCanvas.state.t);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0; for (let i = 0; i < d.length; i += 16) { if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) r++; else if (d[i + 1] > 180 && d[i] < 110 && d[i + 2] < 140) g++; } return { r, g }; } catch (e) { return String(e); } });
    check("right-click a screen: ⇄ Swap with the master / ▣ another layer / ＋ / ✕", menu.length === 4 && /⇄ Swap with the master/.test(menu[0]) && /Show another layer/.test(menu[1]) && /Add a screen/.test(menu[2]) && /Remove screen 2/.test(menu[3]), menu);
    check("swapped: the big preview shows layer A alone (no green), screen 2 is the MASTER with the whole picture; the badge says so",
      sw.swap === 0 && sw.only === "i:0" && m2.r > 20 && m2.g === 0 && s2b.r > 5 && s2b.g > 5 && /MASTER/.test(sw.tags[0]) && /SCREEN 2 · Title A/.test(sw.badge), { sw, m2, s2b });
    check("...and the picture the compile / snapshots get is still the whole one (paintComp outside the master view)", snap.r > 20 && snap.g > 20, snap);
    // swap screen 3 instead: 2 goes back, 3 takes over
    await ev(() => TlScreens.swap(1)); await sleep(400);
    const sw3 = await ev(() => TlScreens.info()), m3 = await rg("#tlCanvas");
    check("swapping another screen moves the master there (only one swap at a time)", sw3.swap === 1 && sw3.only === "i:1" && !/MASTER/.test(sw3.tags[0]) && /MASTER/.test(sw3.tags[1]) && m3.g > 20 && m3.r === 0, { sw3, m3 });
    // the badge puts it back
    await p.click("#tlScrBadge"); await sleep(400);
    const back = await ev(() => TlScreens.info()), m4 = await rg("#tlCanvas");
    check("a click on the badge puts the master back on the big preview", back.swap === -1 && back.only === null && back.badge === "" && m4.r > 20 && m4.g > 20, { back, m4 });
    // a double-click swaps; removing the swapped screen puts the master back
    await p.dblclick('.tsc[data-i="1"] .tsc-cv'); await sleep(300);
    const dbl = await ev(() => TlScreens.info().swap);
    await p.click('.tsc[data-i="1"] .tsc-x'); await sleep(300);
    const rm = await ev(() => TlScreens.info());
    check("double-click a screen = swap; ✕ on the swapped screen removes it and the master is back", dbl === 1 && rm.n === 1 && rm.swap === -1 && rm.only === null, { dbl, rm });
    // reorder the layers: the screen follows its layer (by its colour)
    await ev(() => { tl.images.reverse(); renderTimeline(); TlCanvas.mark(); }); await sleep(400);
    const re = await ev(() => ({ list: TlScreens.list(), tag: TlScreens.info().tags[0] }));
    check("the layers reordered: screen 2 still shows Title A (found by its colour, now i:1)", re.list[0].lk === "i:1" && /Title A/.test(re.tag), re);
    // the column's width: wide = the screens side by side
    await ev(() => { TlScreens.add("i:0"); TlScreens.width(700); }); await sleep(400);
    const side = await ev(() => { const a = document.querySelector('.tsc[data-i="0"]').getBoundingClientRect(), c = document.querySelector('.tsc[data-i="1"]').getBoundingClientRect(); return { sameRow: Math.abs(a.top - c.top) < 2, w: TlScreens.info().width }; });
    check("dragged wide (700 px) the screens sit side by side", side.sameRow && side.w >= 690, side);
    // a short docker: the preview keeps its 190 px
    await ev(() => { window.toggleMax("timelinedock", false); document.getElementById("timelinedock").style.height = "260px"; }); await sleep(400);
    const short = await ev(() => Math.round(document.getElementById("tlStage").getBoundingClientRect().height));
    check("a short docker: the preview is not squeezed away (190 px or more)", short >= 190, short);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      await ev(() => { document.getElementById("timelinedock").style.height = ""; window.toggleMax("timelinedock", false); while (TlScreens.list().length) TlScreens.remove(0);
        localStorage.removeItem("h3.tl.screens"); localStorage.removeItem("h3.tl.scrw"); window.TlFloat && TlFloat.show(true);
        const s = JSON.parse(window.__tl970 || "null"); if (s) { tl.video = s.video; tl.audio = s.audio; tl.images = s.images; tl.vlayers = s.vlayers; tl.selLayer = s.sel; tlSave(); renderTimeline(); } });
      await sleep(900);
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
