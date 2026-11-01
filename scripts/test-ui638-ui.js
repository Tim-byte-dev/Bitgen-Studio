#!/usr/bin/env node
/* bitGen Studio — 2.638.0 in a REAL browser: THE 📐 SOLIDCRAFT DOCKER'S ⛶ = THE WHOLE WINDOW, THE OTHER DOCKERS CLOSED;
 * 🗗 / Esc = THE LAYOUT AS IT WAS (which were open, folded, their sizes).
 * Tim: "make the solidcraft docker full screen and close the other dockers on maximize, on restore go back to the layout it
 * was in before maximized"
 * Against the running app (H3_URL). SolidCraft need not be installed (the docker is shown for the test). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.638.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockFull && document.getElementById("solidcraftdock") && document.getElementById("solidcraftdock").classList.contains("dockfull"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    // the layout before: prompt + timeline shown, music shown but folded, the timeline a set height; SolidCraft shown
    const before = await ev(() => {
      const show = (id, btn) => { const d = document.getElementById(id); if (d && d.classList.contains("dockgone")) toggleDockGone(id, btn); };
      // not installed here: shown anyway for the test (the docker hides itself again every so often)
      const st = document.createElement("style"); st.textContent = "html body #solidcraftdock.sc-absent{display:flex!important} html body #tX_solidcraftdock.sc-absent{display:inline-block!important}"; document.head.appendChild(st);
      show("promptdock", "tP"); show("timelinedock", "tTL"); show("musicdock", "tMu"); show("solidcraftdock", "tX_solidcraftdock");
      const sc = document.getElementById("solidcraftdock"); if (sc.classList.contains("collapsed")) toggleCollapse("solidcraftdock");
      const mu = document.getElementById("musicdock"); if (mu && !mu.classList.contains("collapsed")) toggleCollapse("musicdock");
      document.getElementById("titlebar").classList.remove("hidden");
      return { on: Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]).sort(),
        folded: !!(mu && mu.classList.contains("collapsed")), tlStyle: document.getElementById("timelinedock").getAttribute("style") || "" };
    });
    await p.click('#solidcraftdock .maxbtn'); await p.waitForTimeout(500);
    const mx = await ev(() => { const d = document.getElementById("solidcraftdock"), r = d.getBoundingClientRect();
      return { on: Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width),
        tb: Math.round(document.getElementById("titlebar").getBoundingClientRect().bottom), sb: Math.round(document.getElementById("statusbar").getBoundingClientRect().top), iw: innerWidth, pos: getComputedStyle(d).position, kept: !!localStorage.getItem("h3.dockfull.solidcraftdock") }; });
    check("⛶: SolidCraft covers the whole window between the title bar and the status bar; every other docker is closed", before.on.length >= 4 && mx.on.join() === "solidcraftdock" && mx.pos === "fixed" && Math.abs(mx.top - mx.tb) <= 1 && Math.abs(mx.bottom - mx.sb) <= 1 && mx.w === mx.iw && mx.kept, { before, mx });
    const fh = await ev(() => { const h = document.getElementById("scFrameHold"); return { body: document.querySelector("#solidcraftdock > .bbody").getBoundingClientRect().height, hold: h.style.display === "none" ? null : h.getBoundingClientRect().height }; });
    check("…its body (and the SolidCraft frame, when installed) grows with it", fh.body > 600 && (fh.hold === null || fh.hold > 500), fh);
    await p.click('#solidcraftdock .maxbtn'); await p.waitForTimeout(600);
    const back = await ev(() => ({ on: Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]).sort(),
      folded: document.getElementById("musicdock").classList.contains("collapsed"), tlStyle: document.getElementById("timelinedock").getAttribute("style") || "", pos: getComputedStyle(document.getElementById("solidcraftdock")).position, kept: !!localStorage.getItem("h3.dockfull.solidcraftdock") }));
    check("🗗 Restore: the same dockers open again, the music docker still folded, the timeline its size - the layout as it was", back.on.join() === before.on.join() && back.folded === before.folded && back.tlStyle === before.tlStyle && back.pos !== "fixed" && !back.kept, { before, back });
    // Esc restores too
    await p.click('#solidcraftdock .maxbtn'); await p.waitForTimeout(400);
    await p.mouse.click(5, 500); await p.keyboard.press("Escape"); await p.waitForTimeout(600);
    const esc = await ev(() => ({ on: Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]).sort(), maxed: document.getElementById("solidcraftdock").classList.contains("maxed") }));
    check("Esc restores the same way", !esc.maxed && esc.on.join() === before.on.join(), esc);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
