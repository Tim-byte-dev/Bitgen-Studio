#!/usr/bin/env node
/* bitGen Studio — 2.942.0 in a REAL browser: 🚓 POLICE CHASE - ⛶ = full screen like the image editor's (Tim's "artist mode") (the game alone, no bars or
 * title bar, the window full screen; Esc pauses and stays; 🗗 Exit / Ctrl+Esc / Shift+right-click leave), the getaway car
 * explodes when caught, the launcher fires by itself and a police car hit explodes (fire, smoke, bits drawn), ⚡ boosts drawn
 * and taken. Against the running app (H3_URL). WebGL here is SwiftShader (slow). */
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
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Chase && document.getElementById("chasedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("maxed")) toggleMax("chasedock", false); if (d.classList.contains("dockgone")) toggleDockGone("chasedock", "tX_chasedock"); });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("maxed")) toggleMax("chasedock", false); });
    await p.waitForTimeout(500);
    // ⛶ = full screen like the image editor's (Tim's "artist mode")
    await ev(() => document.getElementById("pcMaxBtn").scrollIntoView({ block: "nearest" }));
    await p.click("#pcMaxBtn");
    await p.waitForFunction(() => document.body.classList.contains("pc-full"), null, { timeout: 8000 });
    await p.waitForTimeout(800);
    const f1 = await ev(() => { const st = document.getElementById("pcStage").getBoundingClientRect(), d = document.getElementById("chasedock").getBoundingClientRect();
      const top = document.elementFromPoint(innerWidth / 2, 3), mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { d: [d.left, d.top, d.width, d.height], W: innerWidth, H: innerHeight, stH: st.height, head: getComputedStyle(document.querySelector("#chasedock > .bhead")).display,
        exitBtn: getComputedStyle(document.getElementById("pcExitFull")).display, topIn: !!(top && top.closest("#chasedock")), midIn: !!(mid && mid.closest("#chasedock")), fs: !!document.fullscreenElement }; });
    check("⛶: the game alone on the whole window - no bars, no docker title bar - and the window full screen (like the image editor's 🎨 Full Screen)",
      f1.d[0] <= 1 && f1.d[1] <= 1 && f1.d[2] >= f1.W - 2 && f1.d[3] >= f1.H - 2 && f1.head === "none" && f1.topIn && f1.midIn && f1.stH > f1.H * 0.85 && f1.exitBtn !== "none" && f1.fs, f1);
    await p.click("#pcStage"); await p.keyboard.press("Enter"); await p.waitForTimeout(800);
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    const f2 = await ev(() => ({ full: document.body.classList.contains("pc-full"), paused: window.H3Chase.info().paused }));
    check("...Esc pauses the game and it stays full screen (frameless)", f2.full && f2.paused, f2);
    await p.keyboard.press("Control+Escape"); await p.waitForTimeout(600);
    const f3 = await ev(() => ({ full: document.body.classList.contains("pc-full"), max: document.getElementById("chasedock").classList.contains("maxed"), fs: !!document.fullscreenElement }));
    check("...Ctrl+Esc: back to the docker (not maximized, the window's full screen left)", !f3.full && !f3.max && !f3.fs, f3);
    await p.click("#pcMaxBtn"); await p.waitForFunction(() => document.body.classList.contains("pc-full"), null, { timeout: 8000 }); await p.waitForTimeout(400);
    await p.click("#pcExitFull"); await p.waitForTimeout(500);
    check("...🗗 Exit full screen too", !(await ev(() => document.body.classList.contains("pc-full") || document.getElementById("chasedock").classList.contains("maxed"))));
    await p.click("#pcMaxBtn"); await p.waitForFunction(() => document.body.classList.contains("pc-full"), null, { timeout: 8000 }); await p.waitForTimeout(400);
    await p.keyboard.down("Shift"); await p.mouse.click(700, 500, { button: "right" }); await p.keyboard.up("Shift"); await p.waitForTimeout(500);
    check("...Shift+right-click too", !(await ev(() => document.body.classList.contains("pc-full"))));
    // the game: full screen again for the rest
    await p.click("#pcMaxBtn"); await p.waitForFunction(() => document.body.classList.contains("pc-full"), null, { timeout: 8000 }); await p.waitForTimeout(600);
    await p.click("#pcStage"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    await p.waitForFunction(() => window.H3Chase.state().phase === "play" || window.H3Chase.info().phase === "play", null, { timeout: 15000 });
    // 🚀 armed, a police car two car lengths away on a straight: it fires by itself, the car blows up
    const setup = await ev(() => { const s = window.H3Chase.state(), C = window.H3ChaseCore, m = s.maze;
      for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 4; x++) if ([0, 1, 2, 3].every((k) => C.open(m, x + k, y)) && Math.abs(y - m.station.y) > 2) {
        Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 0; });
        s.player.x = x; s.player.y = y; s.player.face = 3; s.player.dir = 3; s.player.started = false; s.player.want = -1;
        s.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; c.x = m.station.x; c.y = m.station.y; c.shield = false; });
        const c = s.police[0]; c.mode = "jammed"; c.x = x + 1.5; c.y = y; c.dir = 1; s.jamT = 6; s.boostCd = 1e9; return true; }
      return false; });
    await p.waitForFunction(() => window.H3Chase.state().police[0].mode === "wreck", null, { timeout: 15000 });
    await p.waitForTimeout(350);
    const w1 = await ev(() => { const V = window.H3Chase._view && window.H3Chase._view(); return V ? { live: V.parts.live.length, fire: V.parts.live.filter((q) => q.kind === "fire").length, smoke: V.parts.live.filter((q) => q.kind === "smoke").length, bits: V.parts.live.filter((q) => q.kind === "bit").length } : null; });
    check("🚀 the launcher fired by itself at the police car two car lengths away; it EXPLODED - fire, smoke and flying bits drawn", setup && w1 && w1.fire > 5 && w1.smoke > 5 && w1.bits > 3, w1);
    await p.screenshot({ path: "/tmp/ui942-wreck.png" });
    // ⚡ a boost right ahead: taken, turbo
    await ev(() => { const s = window.H3Chase.state(); s.jamT = 0; s.boosts = [{ x: Math.round(s.player.x) + 1, y: Math.round(s.player.y), t: 10 }]; });
    await p.waitForTimeout(300);
    const bv = await ev(() => { const V = window.H3Chase._view(); return V.boostPool.filter((o) => o.visible).length; });
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(() => window.H3Chase.state().player.turbo > 0, null, { timeout: 8000 });
    await p.waitForTimeout(200);
    const tv = await ev(() => ({ flames: window.H3Chase._view().player.turbo.every((f) => f.visible), bar: getComputedStyle(document.getElementById("pcTurbo")).display }));
    check("⚡ a boost drawn on the road; driving over it: TURBO - flames on the car, the ⚡ bar", bv === 1 && tv.flames && tv.bar === "block", { bv, tv });
    // caught: the getaway car explodes
    await ev(() => { const s = window.H3Chase.state(); s.player.turbo = 0; const c = s.police[1]; c.mode = "run"; c.x = s.player.x; c.y = s.player.y; });
    await p.waitForFunction(() => window.H3Chase.state().phase === "busted", null, { timeout: 8000 });
    await p.waitForTimeout(450);
    const cr = await ev(() => { const V = window.H3Chase._view(), s = window.H3Chase.state(); return { crash: s.fx.some((f) => f.kind === "crash"), fire: V.parts.live.filter((q) => q.kind === "fire").length, rolled: Math.abs(V.player.inner.rotation.z) > 0.5, charred: V.player.charK > 0.5 }; });
    check("caught: your car EXPLODES - a big burst, thrown and rolled, burnt out", cr.crash && cr.fire > 8 && cr.rolled && cr.charred, cr);
    await p.screenshot({ path: "/tmp/ui942-crash.png" });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
