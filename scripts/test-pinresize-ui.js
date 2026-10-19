#!/usr/bin/env node
/* bitGen Studio — 2.384.1: a 📌 pinned dock can still be sized, and unpinning frees it (REAL browser).
 * Tim: "when the pin on the left of the docker titlebar is pressed and a max height is already set, then set the
 * max-height to zero and allow user to change the height of the docker and press the pin again to set max height" /
 * "once i set the height the first time it doen't allow me to change the height of the set docker at all".
 * The cause: a pinned VIDEO dock stopped being the elastic one but did not become a fixed one either - no seam moved it.
 *   1. 📌 the video dock: max = the height it shows, it becomes a fixed dock at that height (--vh);
 *   2. its seam shrinks it, and grows it back no further than the pin;
 *   3. 📌 again: max 0, elastic again, a seam above gives it any height; 📌 again: the NEW height is the max;
 *   4. a reload keeps the pin and the height;
 *   5. the bottom (prompt) dock, pinned, shrinks by its own seam even with nothing open below it, and stays that size.
 * Run against the running app (H3_URL, default the e2e server on :8311). No Playwright here = SKIP (exit 0). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the pin resize browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
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
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const H = (id) => p.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().height), id);
  const seam = (above) => p.evaluate((a) => {          // the visible splitter right under a dock
    const s = [...document.querySelectorAll("#maincol > .hsplit")].find((x) => x.previousElementSibling.id === a && x.offsetHeight > 0);
    const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, above);
  const drag = async (above, dy) => {
    const s = await seam(above);
    await p.mouse.move(s.x, s.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(s.x, s.y + dy * k / 6);
    await p.mouse.up(); await p.waitForTimeout(450);
  };
  const ready = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady, null, { timeout: 20000 });
    await p.waitForTimeout(800);
  };
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
    const docks = { previewdock: E({ height: 220 }), timelinedock: E({ height: 200 }), videodock: E({ height: 280 }), promptdock: E({ height: 150, floating: false, dock_to: "" }) };   // 2.389.0: the prompt as a COLUMN dock here (it floats by default)
    for (const id of ["imageeditdock", "comfydock", "musicdock", "stemsdock", "sfxdock", "chatdock", "consoledock"]) docks[id] = E({ state: "closed", height: 170 });
    for (const id of ["ldock", "refs", "assets", "qdock", "rdock"]) docks[id] = E({ width: 220 });
    await api("POST", "/api/docker-status", { docks });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ready();

    // 1
    const v0 = await H("videodock");
    await p.click("#videodock .pinbtn"); await p.waitForTimeout(400);
    const pin = await p.evaluate(() => ({ max: dsEntry("videodock").max_height, vh: cssPx("vh"), fixed: fixedVar(document.getElementById("videodock")),
      cls: document.getElementById("maincol").classList.contains("vd-pinned") }));
    check("📌 the video dock: max = the height it shows, a FIXED dock at that height (--vh)",
      pin.max === v0 && pin.vh === v0 && pin.fixed === "vh" && pin.cls && (await H("videodock")) === v0, { v0, pin });

    // 2
    await drag("videodock", -60);
    check("...its own seam shrinks it (the dock below takes the room)", (await H("videodock")) === v0 - 60, await H("videodock"));
    await drag("videodock", 120);
    check("...and grows it back no further than the pin", (await H("videodock")) === v0, await H("videodock"));

    // 3
    await p.click("#videodock .pinbtn"); await p.waitForTimeout(400);
    check("📌 again: max-height 0, the video dock is the elastic one again",
      await p.evaluate(() => dsEntry("videodock").max_height === 0 && !document.getElementById("maincol").classList.contains("vd-pinned")
        && !document.querySelector("#videodock .pinbtn").classList.contains("on")));
    const t0 = await H("timelinedock"), vA = await H("videodock");
    await drag("timelinedock", -80);
    const vB = await H("videodock");
    check("...any height again: past the old pin (the timeline gave it 80px)", (await H("timelinedock")) === t0 - 80 && vB === vA + 80 && vB > v0, { vA, vB, v0 });
    await p.click("#videodock .pinbtn"); await p.waitForTimeout(400);
    const st = await status((d) => d.videodock.max_height === vB);
    check("📌 once more: the NEW height is the max (docker_status.json too)", st.videodock.max_height === vB && (await H("videodock")) === vB, st.videodock);

    // 4
    await p.reload({ waitUntil: "domcontentloaded" });
    await ready();
    check("a reload keeps the pin and the height", (await H("videodock")) === vB
      && await p.evaluate(() => document.getElementById("maincol").classList.contains("vd-pinned") && document.querySelector("#videodock .pinbtn").classList.contains("on")),
      await H("videodock"));
    await p.click("#videodock .pinbtn"); await p.waitForTimeout(300);

    // 5
    const pr0 = await H("promptdock");
    await p.click("#promptdock .pinbtn"); await p.waitForTimeout(300);
    await drag("promptdock", -50);
    await p.waitForTimeout(300);
    check("the bottom dock (prompt) pinned: its own seam shrinks it with nothing open below, and it stays that size",
      (await H("promptdock")) === pr0 - 50 && await p.evaluate(() => dsEntry("promptdock").max_height) === pr0, [pr0, await H("promptdock")]);
    await p.click("#promptdock .pinbtn"); await p.waitForTimeout(300);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    await api("POST", "/api/docker-status", orig).catch(() => null);
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
