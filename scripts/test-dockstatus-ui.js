#!/usr/bin/env node
/* bitGen Studio — 2.381.0: docker_status.json, 📌 pins and the new maximize in a REAL browser.
 * Tim: "remove checkboxes in queue menubar / create a file for docker status - docker_status.json / keep docker open,
 * closed, hidden, height, width,max-height,max-width, maximized values in this file / when a docker is open resize
 * other open dockers to their max height, add a pin button to the left of each docker. if pin is toggled, max-height
 * is set at the current height of the docker, if toggled again max-height = 0 so user can select any height they
 * want for the docker until the height is pinned. / the height and the width of the dockers will be the current
 * height, this will be loaded first. if maximized the docker will expand to maximum height unless other dockers are
 * open. if other dockers are open they will expand to their height or max-height(the lesser value). All dockers will
 * be able to be resized if they are open even if they are maximized".
 * Run against the running app (H3_URL, default the e2e server on :8311). It rewrites that install's
 * docker_status.json and puts the original back at the end. No Playwright here = SKIP (exit 0).
 *   1. the record is in the page's head (window.H3_DOCK_STATUS = GET /api/docker-status) and applied at boot;
 *   2. 📌 is the first thing in every dock's header; a pin sets max_height = the current height, a pinned dock is
 *      dragged no further than it (shrinking still works), unpinning frees it;
 *   3. opening a dock puts the other open PINNED docks back at their max height;
 *   4. maximize: the other docks stay open at their height, the maximized dock takes the rest, its seam still drags;
 *      reload keeps all of it;
 *   5. the queue's menu bar has no ⏹ / ⏹✕ boxes. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the docker status browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
// 2.382.1: a request the busy e2e server drops ("fetch failed") is tried again, not the end of the test
const api = async (method, p, body) => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(URL_ + p.replace(/^\//, ""), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      return await r.json();
    } catch (e) { if (i >= 5) throw e; await new Promise((ok) => setTimeout(ok, 500 * (i + 1))); }
  }
};
const E = (o) => ({ state: "open", hidden: false, max_height: 0, max_width: 0, maximized: false, ...o });

(async () => {
  const orig = await api("GET", "/api/docker-status");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const H = (id) => p.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().height), id);
  const seam = (id) => p.evaluate((i) => {          // the splitter right under a dock
    let n = document.getElementById(i).nextElementSibling;
    while (n && !(n.classList && n.classList.contains("hsplit"))) n = n.nextElementSibling;
    const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  const drag = async (id, dy) => {
    const s = await seam(id);
    await p.mouse.move(s.x, s.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(s.x, s.y + dy * k / 6);
    await p.mouse.up(); await p.waitForTimeout(250);
  };
  // the page writes the record debounced (400 ms) - under load the POST can land later: poll until it says what is asked
  const status = async (want) => {
    let d = null;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(i ? 250 : 500);
      d = (await api("GET", "/api/docker-status")).docks;
      if (!want || want(d)) break;
    }
    return d;
  };
  try {
    // a known layout: preview, timeline, video and prompt open; the rest closed
    const closed = ["imageeditdock", "comfydock", "musicdock", "stemsdock", "sfxdock", "chatdock", "consoledock"];
    const docks = { previewdock: E({ height: 220 }), timelinedock: E({ height: 200 }), videodock: E({ height: 280 }), promptdock: E({ height: 150, floating: false, dock_to: "" }) };   // 2.389.0: the prompt as a COLUMN dock here (it floats by default)
    for (const id of closed) docks[id] = E({ state: "closed", height: 170 });
    for (const id of ["ldock", "refs", "assets", "qdock", "rdock"]) docks[id] = E({ width: 220 });
    await api("POST", "/api/docker-status", { docks });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady, null, { timeout: 20000 });
    await p.waitForTimeout(600);

    // 1
    const head = await p.evaluate(() => window.H3_DOCK_STATUS && window.H3_DOCK_STATUS.docks.timelinedock);
    check("the record is in the page's head (window.H3_DOCK_STATUS) - loaded before the rest of the boot", head && head.height === 200 && head.state === "open", head);
    check("...and applied: timeline 200px, prompt 150px, the closed docks closed",
      (await H("timelinedock")) === 200 && (await H("promptdock")) === 150
      && await p.evaluate((c) => c.every((id) => document.getElementById(id).classList.contains("collapsed")), closed), [await H("timelinedock"), await H("promptdock")]);

    // 2
    check("📌 is the FIRST thing in every dock's header (11 bottom docks + 5 side docks)",
      await p.evaluate(() => [...document.querySelectorAll("#maincol .bdock")].filter((d) => ["previewdock", "timelinedock", "videodock", "imageeditdock", "comfydock", "musicdock", "stemsdock", "sfxdock", "chatdock", "promptdock", "consoledock"].includes(d.id)).every((d) => d.querySelector(".bhead").firstChild.classList.contains("pinbtn"))   // 2.579.0: the 11 built-in ones (an extension docker, e.g. 📐 SolidCraft, is not in docker_status.json)
        // (a side dock's fold caret, static/sidecollapse.js, sits before it - the pin is the first thing after it)
        && ["ldock", "refsdock", "assetsdock", "qdock", "rdock"].every((id) => { const h = document.getElementById(id).querySelector(".dockhead"), f = h.firstElementChild; return f.classList.contains("pinbtn") || (f.classList.contains("sccaret") && f.nextElementSibling && f.nextElementSibling.classList.contains("pinbtn")); })
        && document.querySelectorAll(".pinbtn").length === 16));
    await p.click("#timelinedock .pinbtn");
    let st = await status((d) => d.timelinedock.max_height > 0);
    check("📌 pin: max_height = the dock's current height (200), the button lit, written to docker_status.json",
      st.timelinedock.max_height === 200 && await p.evaluate(() => document.querySelector("#timelinedock .pinbtn").classList.contains("on")), st.timelinedock);
    await drag("timelinedock", 120);
    check("...a pinned dock is dragged no further than its max-height", (await H("timelinedock")) === 200, await H("timelinedock"));
    await drag("timelinedock", -60);
    check("...but it can still be made smaller", (await H("timelinedock")) === 140, await H("timelinedock"));
    await drag("timelinedock", 60);
    await p.click("#timelinedock .pinbtn");
    st = await status((d) => d.timelinedock.max_height === 0);
    check("📌 again: max_height = 0", st.timelinedock.max_height === 0 && await p.evaluate(() => !document.querySelector("#timelinedock .pinbtn").classList.contains("on")), st.timelinedock);
    await drag("timelinedock", 80);
    check("...and the user picks any height again (200 -> 280)", (await H("timelinedock")) === 280, await H("timelinedock"));
    await drag("timelinedock", -80);

    // 3
    await p.evaluate(() => setVar("ph", 150)); await p.waitForTimeout(150);
    await p.click("#promptdock .pinbtn");               // pinned at 150
    await p.evaluate(() => setVar("ph", 110));          // the user made it smaller than its pin
    await p.waitForTimeout(200);
    await p.click("#musicdock .bhead");                 // a dock opens
    await p.waitForTimeout(500);
    check("opening a dock puts the other open PINNED docks back at their max height (prompt 110 -> 150), the new dock open",
      (await H("promptdock")) === 150 && await p.evaluate(() => !document.getElementById("musicdock").classList.contains("collapsed")), await H("promptdock"));

    // 4
    await p.evaluate(() => setVar("th", 150)); await p.waitForTimeout(300);
    const thNormal = await p.evaluate(() => cssPx("th"));
    const before = { pv: await H("previewdock"), pr: await H("promptdock"), mu: await H("musicdock"), vd: await H("videodock"), tl: await H("timelinedock") };
    await p.click("#timelinedock .maxbtn");
    await p.waitForTimeout(600);
    const after = { pv: await H("previewdock"), pr: await H("promptdock"), mu: await H("musicdock"), vd: await H("videodock"), tl: await H("timelinedock") };
    check("maximize: the other OPEN docks stay open at their own height (preview, prompt, music, the video dock), nothing minimized",
      after.pv === before.pv && after.pr === before.pr && after.mu === before.mu && after.vd === await p.evaluate(() => cssPx("vh"))
      && await p.evaluate(() => !document.querySelector(".minned")), { before, after });
    check("...the maximized dock takes the room they leave (the column filled to the status bar)",
      after.tl > before.tl && await p.evaluate(() => {
        const col = document.getElementById("maincol"), kids = [...col.children].filter((n) => n.offsetHeight > 0);
        const padB = parseInt(getComputedStyle(col).paddingBottom, 10) || 0;
        return Math.abs(col.getBoundingClientRect().top + col.clientHeight - padB - kids[kids.length - 1].getBoundingClientRect().bottom) <= 3;
      }), { before, after });
    st = await status((d) => d.timelinedock.maximized);
    check("...written: timelinedock maximized, its height still its NORMAL height", st.timelinedock.maximized === true && st.timelinedock.height === thNormal, [st.timelinedock, thNormal]);
    const vd0 = await H("videodock"), tl0 = await H("timelinedock");
    await drag("timelinedock", 40);
    check("the maximized dock still resizes: its seam moves the dock below (video -40, timeline +40)",
      Math.abs((await H("videodock")) - (vd0 - 40)) <= 2 && Math.abs((await H("timelinedock")) - (tl0 + 40)) <= 2, [vd0, await H("videodock"), tl0, await H("timelinedock")]);
    const pv0 = await H("previewdock");
    await drag("previewdock", 30);
    check("...and the dock ABOVE it grows into it (preview +30, the maximized dock gives)",
      Math.abs((await H("previewdock")) - (pv0 + 30)) <= 2 && Math.abs((await H("timelinedock")) - (tl0 + 10)) <= 3, [pv0, await H("previewdock"), await H("timelinedock")]);
    const pvNow = await p.evaluate(() => cssPx("pvh"));
    await status((d) => d.previewdock.height === pvNow && d.timelinedock.maximized);   // written before the reload
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady, null, { timeout: 20000 });
    await p.waitForTimeout(800);
    check("reload: still maximized, the prompt still 📌 at 150, music still open, the preview at its new height",
      await p.evaluate(() => document.getElementById("timelinedock").classList.contains("maxed") && document.querySelector("#promptdock .pinbtn").classList.contains("on")
        && !document.getElementById("musicdock").classList.contains("collapsed"))
      && (await H("promptdock")) === 150 && Math.abs((await H("previewdock")) - (pv0 + 30)) <= 2, [await H("promptdock"), await H("previewdock")]);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    check("Escape restores: not maximized (written), the timeline back at its normal height",
      await p.evaluate(() => !document.querySelector(".maxed")) && (await status((d) => !d.timelinedock.maximized)).timelinedock.maximized === false && (await H("timelinedock")) === thNormal, [await H("timelinedock"), thNormal]);
    await p.click("#tT"); await p.waitForTimeout(100);
    st = await status((d) => d.timelinedock.hidden);
    check("the status-bar toggle writes hidden: true; again -> false", st.timelinedock.hidden === true, st.timelinedock);
    await p.click("#tT");

    // 5
    check("the queue's menu bar: no ⏹ / ⏹✕ boxes, no checkboxes",
      await p.evaluate(() => !document.getElementById("qStopJob") && !document.getElementById("qStopAll") && !document.querySelector("#qdock .qfhead input")));
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await api("POST", "/api/docker-status", orig);
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
