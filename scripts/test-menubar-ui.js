#!/usr/bin/env node
/* bitGen Studio — 2.382.1: the MENU BAR under the title bar, and renaming layers, in a REAL browser.
 * Tim: "move the menubar from the left docker to the main window below the titlebar. allow user to edit the names of
 * the layers".
 * Run against the running app (H3_URL, default the e2e server on :8311). No Playwright here = SKIP (exit 0).
 *   1. #menubar is a full-width row at the top (under the title bar in the app), the app starts under it and ends at
 *      the status bar; it holds ✚ New 📂 💾 📦 📷 ⏺ 🗑 ↺ ⚙ ⏏; the left dock's header is just its title + 📌;
 *      the buttons stay when the left dock is hidden;
 *   2. the canvas's layers list: double-click a name -> edit it in place (Enter keeps, Esc cancels); F2 on the
 *      selected layer; the Name box in Properties; the timeline's track label renames the same layer and the list
 *      follows. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the menu bar browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && typeof dsReady !== "undefined" && dsReady && document.getElementById("capShot") && document.getElementById("projBin"), null, { timeout: 30000 });
    await p.waitForFunction(() => window.H3_PROJECT_READY === true, null, { timeout: 30000 }).catch(() => null);   // 2.389.0: the boot's project load lands first
    await p.waitForTimeout(1200);

    // 1
    const g = await p.evaluate(() => {
      const mb = document.getElementById("menubar").getBoundingClientRect(), app = document.getElementById("app").getBoundingClientRect();
      return { mb: [Math.round(mb.top), Math.round(mb.height), Math.round(mb.width)], appTop: Math.round(app.top), appBottom: Math.round(app.bottom),
        sb: Math.round(document.getElementById("statusbar").getBoundingClientRect().top), w: window.innerWidth,
        btns: [...document.querySelectorAll("#menubar .projbtns > button")].map((x) => x.id),
        ld: [...document.querySelector("#ldock .dockhead").children].map((x) => x.className || x.tagName), ldBtns: document.querySelectorAll("#ldock .projbtns").length };
    });
    check("the menu bar spans the window at the top (under the title bar in the app); the docks start under it and end at the status bar",
      g.mb[0] === 0 && g.mb[1] >= 30 && g.mb[2] === g.w && g.appTop === g.mb[1] && g.appBottom === g.sb, g);
    // 2.519.0: static/ueproject.js adds 🎮 (projUe, the Unreal project) after 📦 - a later, legitimate menu bar button
    check("...it holds the buttons the left dock had: ✚ New 📂 💾 📦 (+ 🎮) 📷 ⏺ 🗑 ↺ ⚙ (+ 2.443.0 🖌) ⏏",
      g.btns.join() === "projNew,projLoad,projSave,projBgp,projUe,capShot,capRec,projBin,projReset,openSettings,thEditBtn,resetModels", g.btns);
    // 2.519.0: static/sidecollapse.js puts its fold caret (.sccaret) first in every side dock's header - still no buttons there
    check("...the left dock's header is just 📌 + its title now (+ the fold caret)", g.ldBtns === 0 && g.ld.join() === "sccaret,pinbtn,H1", g.ld);
    await p.click("#tL"); await p.waitForTimeout(200);
    check("...hiding the left dock leaves the menu bar's buttons where they are",
      await p.evaluate(() => document.getElementById("app").classList.contains("no-left") && document.getElementById("projNew").getBoundingClientRect().width > 0));
    await p.click("#tL"); await p.waitForTimeout(200);

    // 2
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 700);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.images.push(mkLayer("I9", [{ name: "x.png", start: 0, len: 3, opacity: 1 }])); tlSave(); renderTimeline(); TlCanvas.paintLayers();
    });
    await p.waitForTimeout(300);
    const names = () => p.evaluate(() => [tl.images[tl.images.length - 1].name, [...document.querySelectorAll("#tlLayerList .tll-name")].map((x) => x.textContent),
      [...document.querySelectorAll(".tlab .lname")].map((x) => x.textContent)]);
    await p.locator("#tlLayerList .tll-row", { hasText: "I9" }).first().locator(".tll-name").dblclick();
    await p.waitForTimeout(150);
    check("layers list: a double-click on a name edits it IN PLACE (no dialog)",
      await p.evaluate(() => !!document.querySelector(".tll-name.editing[contenteditable=true]") && !document.querySelector("dialog[open]")));
    await p.keyboard.type("Logo"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    let n = await names();
    check("...Enter keeps it: the layer, the list and the timeline's track label all say Logo", n[0] === "Logo" && n[1].includes("Logo") && n[2].includes("Logo"), n);
    await p.locator("#tlLayerList .tll-row", { hasText: "Logo" }).first().locator(".tll-name").dblclick();
    await p.keyboard.type("nope"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("...Esc puts the old name back", (await names())[0] === "Logo");
    await p.locator("#tlLayerList .tll-row", { hasText: "Logo" }).first().click(); await p.waitForTimeout(250);
    await p.hover("#tlCanvasWrap"); await p.keyboard.press("F2"); await p.waitForTimeout(150);
    await p.keyboard.type("Badge"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    check("F2 renames the selected layer", (await names())[0] === "Badge", await names());
    await p.fill("#tlpName", "Brand"); await p.press("#tlpName", "Enter"); await p.waitForTimeout(250);
    n = await names();
    check("the Name box in Properties renames it", n[0] === "Brand" && n[1].includes("Brand") && n[2].includes("Brand"), n);
    await p.locator(".tlab .lname", { hasText: "Brand" }).first().click();
    await p.keyboard.press("Control+A"); await p.keyboard.type("Title card"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    n = await names();
    check("the timeline's track label renames the same layer - the canvas list and Properties follow",
      n[0] === "Title card" && n[1].includes("Title card") && await p.evaluate(() => document.getElementById("tlpName").value) === "Title card", n);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.images = tl.images.filter((L) => !(L.clips || []).some((c) => c.name === "x.png")); tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
