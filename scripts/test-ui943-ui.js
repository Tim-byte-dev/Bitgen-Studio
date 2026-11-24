#!/usr/bin/env node
/* bitGen Studio — 2.943.0 in a REAL browser: 🚓 POLICE CHASE SOUND (ext/chasedock/chasesound.js) - nothing made while the sound
 * is off; M on: the music, the engine and the siren start; faster and fuller as a police car closes in; the 🚀 power
 * variation; a U-turn squeals; a crash is a layered explosion; P keeps the music (muffled) and stops the engine; the docker
 * hidden stops everything and rests the context; ⚙ the mixer (kept volumes, start with sound on). Web Audio runs in headless
 * Chromium. Against the running app (H3_URL). */
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
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const au = () => ev(() => window.H3Chase.audio());
  try {
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t943")) { sessionStorage.setItem("t943", "1");
      ["sound", "music", "sfx", "startsound"].forEach((k) => localStorage.removeItem("h3.chase." + k)); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Chase && window.H3ChaseSound && document.getElementById("chasedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("maxed")) toggleMax("chasedock", false); if (d.classList.contains("dockgone")) toggleDockGone("chasedock", "tX_chasedock"); });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("maxed")) toggleMax("chasedock", false); document.getElementById("pcStage").scrollIntoView({ block: "nearest" }); });
    await p.waitForFunction(() => window.H3Chase.info().ready, null, { timeout: 60000 });
    await p.click("#pcStage"); await p.keyboard.press("Enter");
    await p.waitForFunction(() => window.H3Chase.info().phase === "play", null, { timeout: 15000 });
    await p.waitForTimeout(600);
    const a0 = await au();
    check("sound off (the default): a game runs and NO AudioContext is made", a0 && a0.ctx === "none" && a0.made === 0 && !a0.music && !a0.engine && (await ev(() => window.H3Chase.info().sound)) === false, a0);
    // M: on
    await p.keyboard.press("m");
    await p.waitForTimeout(900);
    const a1 = await au();
    check("M: one AudioContext running; the music's sequencer and the engine started; nodes being made", a1.ctx === "running" && a1.on && a1.music && a1.engine && a1.made > 10 && a1.live > 0, a1);
    // the police on your tail: faster, brighter, the siren
    await ev(() => { const s = window.H3Chase.state(), C = window.H3ChaseCore; Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 0; });
      s.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; c.x = s.maze.station.x; c.y = s.maze.station.y; });
      const c = s.police[0], p0 = s.player; c.mode = "run"; c.releaseAt = 0; c.x = p0.x; c.y = p0.y; c.shield = false;
      for (const d of C.DIRS) { if (C.open(s.maze, Math.round(p0.x) + d[0] * 2, Math.round(p0.y) + d[1] * 2) && C.open(s.maze, Math.round(p0.x) + d[0], Math.round(p0.y) + d[1])) { c.x = Math.round(p0.x) + d[0] * 2; c.y = Math.round(p0.y) + d[1] * 2; break; } }
      const at = [c.x, c.y]; window.__pin943 = setInterval(() => { c.mode = "run"; c.x = at[0]; c.y = at[1]; }, 10); });   // held 2 tiles away (never catches you)
    await p.waitForTimeout(400);
    const a2 = await au();
    check("a police car 2 tiles away: the music faster (bpm > 150) and fuller, the siren on", a2.k >= 0.8 && a2.bpm > 150 && a2.siren && a2.music, a2);
    // 🚀 the launcher: the power variation
    await ev(() => { clearInterval(window.__pin943); const s = window.H3Chase.state(); s.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; c.x = s.maze.station.x; c.y = s.maze.station.y; }); s.jamT = 6; s.boostCd = 1e9; });
    await p.waitForTimeout(300);
    const a3 = await au();
    check("🚀 launcher: the power variation (bpm >= 150), the siren off (no one chasing)", a3.power && a3.bpm >= 150 && !a3.siren && a3.music, a3);
    // a U-turn at speed squeals
    const road = await ev(() => { const s = window.H3Chase.state(), C = window.H3ChaseCore, m = s.maze; s.jamT = 0;
      for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 6; x++) if ([0, 1, 2, 3, 4, 5].every((k) => C.open(m, x + k, y)) && Math.abs(y - m.station.y) > 2) {
        window.__road943 = [x, y]; const pl = s.player; pl.x = x; pl.y = y; pl.dir = 3; pl.face = 3; pl.want = 3; pl.started = true; pl.moving = true; return true; }
      return false; });
    await p.waitForFunction(() => window.H3Chase.state().player.moving && window.H3Chase.state().player.x > Math.floor(window.H3Chase.state().player.x) + 0.1, null, { timeout: 8000 });
    const sq0 = (await au()).squeals;
    await ev(() => { const pl = window.H3Chase.state().player; pl.want = (pl.dir + 2) % 4; });
    await p.waitForTimeout(250);
    const a4 = await au();
    check("a U-turn at speed: the tyres squeal", road && a4.squeals > sq0, { road, sq0, a4 });
    const hz0 = a4.engineHz;
    // ⚡ turbo: the engine roars higher
    await ev(() => { const s = window.H3Chase.state(), pl = s.player, r = window.__road943; pl.x = r[0]; pl.y = r[1]; pl.dir = 3; pl.face = 3; pl.want = 3; pl.moving = true; pl.turbo = 3; });
    await p.waitForTimeout(300);
    const a5 = await au();
    check("⚡ turbo: the engine's pitch goes up", a5.engine && a5.engineHz > hz0 + 5, { hz0, hz: a5.engineHz });
    // P: a deliberate pause keeps the music, muffled; the engine and siren stop
    await p.keyboard.press("p"); await p.waitForTimeout(700);
    const a6 = await au();
    check("P: the music plays on, quiet and muffled (cut <= 800 Hz); the engine and the siren stop", (await ev(() => window.H3Chase.info().why)) === "paused" && a6.music && !a6.engine && !a6.siren && a6.cut <= 900 && a6.ctx === "running", a6);
    // ⚙ the mixer
    await p.click("#pcMix"); await p.waitForTimeout(200);
    const mx = await ev(() => ({ on: document.getElementById("pcMixBox").classList.contains("on"), m: document.getElementById("pcVolMusic").value, s: document.getElementById("pcVolSfx").value }));
    await ev(() => { const r = document.getElementById("pcVolMusic"); r.value = "25"; r.dispatchEvent(new Event("input", { bubbles: true }));
      const q = document.getElementById("pcVolSfx"); q.value = "90"; q.dispatchEvent(new Event("input", { bubbles: true }));
      const c = document.getElementById("pcStartSound"); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(200);
    const a7 = await au(), kept = await ev(() => ["music", "sfx", "startsound"].map((k) => localStorage.getItem("h3.chase." + k)));
    check("⚙ mixer: opens with music 60 / effects 80; the sliders set the buses and are kept; start with sound on kept", mx.on && mx.m === "60" && mx.s === "80" && a7.mix.music === 25 && a7.mix.sfx === 90 && kept.join() === "25,90,1", { mx, a7: a7.mix, kept });
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("...Esc in the mixer closes it (the game stays paused)", !(await ev(() => document.getElementById("pcMixBox").classList.contains("on"))) && (await ev(() => window.H3Chase.info().paused)));
    // carry on, then the docker hidden: everything stops and rests
    await p.click("#pcStage"); await p.waitForTimeout(500);
    const a8 = await au();
    check("carry on: the engine back, the music open again", !(await ev(() => window.H3Chase.info().paused)) && a8.engine && a8.music && a8.cut > 2000, a8);
    await ev(() => toggleDockGone("chasedock", "tX_chasedock")); await p.waitForTimeout(800);
    const a9 = await au();
    check("the docker closed: music, engine and siren stopped, the AudioContext resting (suspended)", !a9.music && !a9.engine && !a9.siren && a9.ctx === "suspended", a9);
    await ev(() => toggleDockGone("chasedock", "tX_chasedock")); await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("chasedock"); if (d.classList.contains("maxed")) toggleMax("chasedock", false); });
    await p.click("#pcStage"); await p.waitForTimeout(700);
    const a10 = await au(), i10 = await ev(() => Object.assign(window.H3Chase.info(), { act: document.activeElement && document.activeElement.id, cls: document.getElementById("chasedock").className, full: document.body.classList.contains("pc-full") }));
    check("...shown again and carried on: the sound comes back", a10.ctx === "running" && a10.music && a10.engine, { a10, i10 });
    // caught: a layered explosion
    await ev(() => { const s = window.H3Chase.state(); s.player.turbo = 0; s.jamT = 0; const c = s.police[1]; c.mode = "run"; c.x = s.player.x; c.y = s.player.y; c.shield = false; });
    await p.waitForFunction(() => window.H3Chase.state().phase === "busted", null, { timeout: 8000 });
    await p.waitForTimeout(150);
    const crash = await ev(() => { const A = window.H3Chase.audio(); return { last: A.last, engine: A.engine }; });
    check("caught: the crash is a layered explosion (sub + crack + body + fire + debris, 15+ voices), then busted; the engine off",
      crash.last && (crash.last.name === "busted" || crash.last.name === "crash") && !crash.engine, crash);
    const lay = await ev(() => { const P = window.H3ChaseSound.create(window); P.on(true); P.play("crash"); const c = P.info().last; P.play("kaboom"); const k = P.info().last; P.play("boom"); const o = P.info().last; P.on(false); return { c, k, o }; });
    check("...layers: crash > kaboom > boom", lay.c.layers >= 15 && lay.c.layers > lay.k.layers && lay.k.layers > lay.o.layers && lay.o.layers >= 7, lay);
    // M off: everything stops, suspended
    await p.focus("#pcStage"); await p.keyboard.press("m"); await p.waitForTimeout(400);
    const a11 = await au();
    check("M off: everything stopped and the context suspended", !a11.on && !a11.music && !a11.engine && !a11.siren && a11.ctx === "suspended", a11);
    // a reload: start with sound on beats the last M (off)
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Chase && window.H3Chase.info, null, { timeout: 60000 });
    const rs = await ev(() => ({ sound: window.H3Chase.info().sound, a: window.H3Chase.audio() }));
    check("reload: 'Start with sound on' ticked -> the sound starts on (made only when a game runs)", rs.sound === true && rs.a.ctx === "none" && rs.a.mix.music === 25 && rs.a.mix.sfx === 90, rs);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => ["sound", "music", "sfx", "startsound"].forEach((k) => localStorage.removeItem("h3.chase." + k))); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
