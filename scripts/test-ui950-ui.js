#!/usr/bin/env node
/* bitGen Studio — 2.950.0 in a REAL browser (Tim: "in police chase exit full screen or esc should go back to docker view, same
 * with life choices" + "also light the roofs of the buildings, i can't tell where they are"):
 *   🚓 maximized: Esc -> back to the docker, the game paused; the window leaving full screen by itself -> the docker too;
 *      🗗 Exit full screen still does; every roof is the lit roof (a glowing rim), the art pack's tops too
 *   🎓 maximized: Esc -> back to the docker, even with the focus in an answer box; 🗗 Back to the docker still does
 * Against the running app (H3_URL). */
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
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const st = (id) => ev((id) => { const d = document.getElementById(id); return { maxed: d.classList.contains("maxed"), gone: d.classList.contains("dockgone"),
    full: document.body.classList.contains(id === "chasedock" ? "pc-full" : "lc-full"), h: Math.round(d.getBoundingClientRect().height) }; }, id);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Chase && window.H3Life, null, { timeout: 60000 });
    // ---- 🚓
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("dockgone")) toggleDockGone("chasedock", "tX_chasedock"); });
    await p.waitForFunction(() => window.H3Chase.info().ready, null, { timeout: 30000 });
    await ev(() => window.H3Chase.newGame(5)); await p.waitForTimeout(600);
    await ev(() => window.H3Chase.full(true)); await p.waitForTimeout(400);
    check("🚓 maximized = full screen", (await st("chasedock")).full && (await st("chasedock")).maxed);
    await ev(() => window.H3Chase.resume()); await p.waitForTimeout(200);
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    let s = await st("chasedock"), inf = await ev(() => window.H3Chase.info());
    check("🚓 Esc: back to the docker (not maximized, no full screen), the game paused", !s.full && !s.maxed && !s.gone && s.h > 200 && inf.paused, { s, inf });
    await ev(() => window.H3Chase.full(true)); await p.waitForTimeout(400);
    // the window leaves full screen by itself (the browser's own Esc / F11): fullscreenchange with no element
    await ev(() => { if (document.fullscreenElement) return document.exitFullscreen(); document.dispatchEvent(new Event("fullscreenchange")); }); await p.waitForTimeout(500);
    s = await st("chasedock");
    check("🚓 the window leaving full screen by itself: back to the docker too", !s.full && !s.maxed, s);
    await ev(() => window.H3Chase.full(true)); await p.waitForTimeout(400);
    await p.click("#pcExitFull"); await p.waitForTimeout(400);
    s = await st("chasedock");
    check("🚓 🗗 Exit full screen: back to the docker", !s.full && !s.maxed, s);
    const roofs = await ev(() => {
      const V = window.H3Chase._view(); let tops = 0, lit = 0, dark = 0;
      V.scene.traverse((o) => { if (!o.isInstancedMesh || !Array.isArray(o.material) || o.material.length !== 6) return; tops++;
        const m = o.material[2]; if (m.emissiveMap && m.emissiveIntensity > 0 && m.emissiveIntensity <= 0.35 && m.map) lit++; else dark++; });
      return { tops, lit, dark };
    });
    check("🚓 every building's roof is the made roof (map + a faint rim glow, never bright), none missing", roofs.tops > 0 && roofs.lit === roofs.tops && !roofs.dark, roofs);
    const tone = await ev(() => { const t = window.H3Chase._roofTone([80, 82, 88]); const L = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3; }; return { base: L(t.base), rim: L(t.rim), road: 83.3, glow: t.intensity }; });
    check("🚓 with the art pack: the roof a little darker than its asphalt (the rim too), a faint glow", tone.base < tone.road * 0.85 && tone.base > tone.road * 0.6 && tone.rim < tone.road && tone.glow <= 0.25, tone);
    await ev(() => window.H3Chase.newGame(6)); await p.waitForTimeout(400);
    check("🚓 a new city builds again with the shared roof (not thrown away with the old city)", await ev(() => { let ok = 0; window.H3Chase._view().scene.traverse((o) => { if (o.isInstancedMesh && Array.isArray(o.material) && o.material[2].emissiveMap && o.material[2].emissiveMap.image) ok++; }); return ok > 0; }));
    await ev(() => { window.H3Chase.pause("t"); toggleDockGone("chasedock", "tX_chasedock"); });
    // ---- 🎓
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForTimeout(500);
    await ev(() => toggleMax("lifedock", true)); await p.waitForTimeout(300);
    check("🎓 maximized = the whole window", (await st("lifedock")).full);
    await ev(() => { const i = document.createElement("input"); i.id = "t950in"; document.getElementById("lifedock").appendChild(i); i.focus(); });
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    s = await st("lifedock");
    check("🎓 Esc (even typing in a box): back to the docker", !s.full && !s.maxed && !s.gone && s.h > 200, s);
    await ev(() => { const i = document.getElementById("t950in"); if (i) i.remove(); toggleMax("lifedock", true); }); await p.waitForTimeout(300);
    await p.click("#lcExitFull"); await p.waitForTimeout(300);
    s = await st("lifedock");
    check("🎓 🗗 Back to the docker still does", !s.full && !s.maxed, s);
    await ev(() => toggleDockGone("lifedock", "tX_lifedock"));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
