#!/usr/bin/env node
/* bitGen Studio — 2.935.0 in a REAL browser: 🚓 POLICE CHASE.
 * Hidden the first time, 🚓 on the top bar shows it (⛶ when it would not fit); the city drawn by three.js; a new game, the
 * arrows drive and pick up cash - and never reach the rest of the app; P pauses (nothing drawn), out of focus / hidden pauses;
 * the camera; a render running = lighter or paused (and carries on after); busted to GAME OVER, the name, 🏆 the best ten.
 * Against the running app (H3_URL). WebGL here is SwiftShader (slow - the waits are generous). */
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
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.H3Chase.info());
  // a click on the city where nothing floats over it (the prompt docker floats over the bottom of the column here)
  const clickCity = async () => {
    await ev(() => document.getElementById("pcStage").scrollIntoView({ block: "nearest" }));
    const xy = await ev(() => { const st = document.getElementById("pcStage"), r = st.getBoundingClientRect();
      for (let fy = 0.1; fy < 1; fy += 0.1) for (let fx = 0.9; fx > 0; fx -= 0.1) { const x = r.left + r.width * fx, y = r.top + r.height * fy, e = document.elementFromPoint(x, y);
        if (e && st.contains(e) && !e.closest("#pcScores") && !e.closest("#pcName")) return [x, y]; }
      return null; });
    if (!xy) throw new Error("nothing of the city can be clicked - it is all covered");
    await p.mouse.click(xy[0], xy[1]); };
  try {
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t935")) { sessionStorage.setItem("t935", "1"); localStorage.removeItem("h3.g.chasedock"); localStorage.removeItem("h3.chase.cam"); localStorage.removeItem("h3.chase.render"); localStorage.removeItem("h3.chase.sound"); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Chase && document.getElementById("tX_chasedock"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const v0 = await ev(() => { const btn = document.getElementById("tX_chasedock"); return { gone: document.getElementById("chasedock").classList.contains("dockgone"), grp: btn.parentElement.id, icon: btn.textContent, title: btn.title }; });
    check("hidden the first time; 🚓 sits on the top bar with the mini apps (after SolidCraft and the Sketcher)", v0.gone && v0.grp === "appGrp2" && v0.icon === "🚓" && /Police Chase/.test(v0.title), v0);
    await ev(() => { window.__keys = 0; document.addEventListener("keydown", (e) => { if (/^Arrow|^Key[WASD]$/.test(e.code)) window.__keys++; }); document.getElementById("tX_chasedock").click(); });
    await p.waitForFunction(() => window.H3Chase.info().ready && window.H3Chase.info().drawn > 0, null, { timeout: 60000 });
    await p.waitForTimeout(500);
    const v1 = await ev(() => { const d = document.getElementById("chasedock"), r = d.getBoundingClientRect(), c = document.getElementById("maincol").getBoundingClientRect(), cv = document.querySelector("#pcStage canvas");
      return { shown: !d.classList.contains("dockgone"), inView: r.bottom <= c.bottom + 4, canvas: !!cv && cv.width > 100, msg: document.getElementById("pcMsg").textContent, i: window.H3Chase.info() }; });
    check("🚓 shows it, all in view (⛶ when it would not fit); the city is drawn (three.js), the title says how to play", v1.shown && v1.inView && v1.canvas && /POLICE CHASE/.test(v1.msg) && /cash/.test(v1.msg) && v1.i.phase === "title", v1);
    check("...the title is one picture - nothing keeps drawing", !v1.i.looping);
    // a game
    await ev(() => window.H3Chase.newGame(4242));
    await p.waitForFunction(() => window.H3Chase.info().phase === "play", null, { timeout: 30000 });
    await p.keyboard.press("ArrowLeft");
    await p.waitForFunction(() => window.H3Chase.state().score >= 30, null, { timeout: 30000 }).catch(() => {});
    const v2 = await ev(() => ({ score: window.H3Chase.state().score, hud: document.getElementById("pcScore").textContent, keys: window.__keys, lives: document.getElementById("pcLives").textContent, act: document.activeElement.id }));
    check("← drives the getaway car and picks up cash (the HUD counts it, three cars)", v2.score >= 30 && v2.hud === String(v2.score) || +v2.hud >= 30, v2);
    check("...the arrow keys never reach the rest of the app (the game has the focus)", v2.keys === 0 && v2.act === "pcStage", v2);
    // pause: nothing drawn
    await p.keyboard.press("KeyP");
    await p.waitForTimeout(400);
    const f1 = (await info()).drawn; await p.waitForTimeout(700); const i2 = await info();
    check("P pauses: PAUSED said, the loop stopped - nothing drawn while paused", i2.paused && i2.drawn === f1 && !i2.looping && /PAUSED/.test(await ev(() => document.getElementById("pcMsg").textContent)), { f1, i2 });
    await p.keyboard.press("KeyP");
    await p.waitForTimeout(300);
    check("...P again carries on", !(await info()).paused);
    // out of focus
    await ev(() => document.getElementById("pcRender").focus());
    await p.waitForTimeout(300);
    const i3 = await info();
    check("the game loses the focus (a click elsewhere): paused, said why", i3.paused && /focus/.test(i3.why), i3);
    await clickCity();
    await p.waitForTimeout(300);
    check("...a click on the city carries on", !(await info()).paused);
    // the camera
    await p.keyboard.press("KeyC");
    await p.waitForTimeout(300);
    const c1 = await ev(() => ({ cam: window.H3Chase.info().cam, btn: document.getElementById("pcCam").textContent }));
    await p.keyboard.press("KeyC");
    check("C: the chase camera behind the car, C again: the city", c1.cam === "chase" && /Chase/.test(c1.btn) && (await info()).cam === "city", c1);
    // a render running
    // a render "runs": the app's job list held still for the moment (its poll would reset a hand-set liveJobsById)
    await ev(() => { window.__rj = window.refreshJobs; window.refreshJobs = async () => {}; window.liveJobsById = { t935: { id: "t935", status: "running" } }; });
    await p.waitForTimeout(600);
    const l1 = await info();
    check("a render running, While rendering = play lighter: still playing, lighter", !l1.paused && l1.light, l1);
    await ev(() => { const s = document.getElementById("pcRender"); s.value = "pause"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(700);
    const l2 = await info();
    check("...= pause: paused while it runs, said why", l2.paused && /render/.test(l2.why), l2);
    await ev(() => { window.liveJobsById = {}; window.refreshJobs = window.__rj; });
    await p.waitForTimeout(900);
    check("...the render done: it carries on by itself", !(await info()).paused);
    await ev(() => { const s = document.getElementById("pcRender"); s.value = "light"; s.dispatchEvent(new Event("change")); });
    // hidden
    await ev(() => toggleDockGone("chasedock", "tX_chasedock"));
    await p.waitForTimeout(400);
    const h1 = await info();
    check("the docker hidden: paused (and not drawn)", h1.paused && !h1.looping && !h1.shown, h1);
    await ev(() => toggleDockGone("chasedock", "tX_chasedock"));
    await p.waitForTimeout(600);
    await clickCity();
    await p.waitForTimeout(300);
    // busted to game over -> the name -> 🏆
    await ev(() => { const s = window.H3Chase.state(); s.score = 4321; s.lives = 1; const c = s.police[0]; c.mode = "run"; c.x = s.player.x; c.y = s.player.y; });
    await p.waitForFunction(() => window.H3Chase.info().phase === "over", null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const o1 = await ev(() => ({ msg: document.getElementById("pcMsg").textContent, name: document.getElementById("pcName").classList.contains("on") }));
    check("the last car caught: GAME OVER with the score; a score for the ten asks for a name", /GAME OVER/.test(o1.msg) && /4321/.test(o1.msg) && o1.name, o1);
    const go1 = (await info()).drawn; await p.waitForTimeout(600);
    check("...GAME OVER is one still picture (nothing keeps drawing)", (await info()).drawn === go1 && !(await info()).looping);
    await p.fill("#pcNameIn", "Tester 935");
    const saved = p.waitForResponse((r) => /\/api\/police-chase\/scores$/.test(r.url()) && r.request().method() === "POST", { timeout: 15000 });
    await p.press("#pcNameIn", "Enter");
    const sj = await (await saved).json();
    await p.waitForTimeout(300);
    const o2 = await ev(() => ({ on: document.getElementById("pcScores").classList.contains("on"), me: (document.querySelector("#pcScores tr.me") || {}).textContent || "", best: document.getElementById("pcBest").textContent }));
    check("...Enter saves it (POST /api/police-chase/scores) and 🏆 shows the ten with yours lit", sj.rank >= 1 && o2.on && /Tester 935/.test(o2.me) && /4321/.test(o2.me) && +o2.best >= 4321, { sj, o2 });
    const g = await ev(async () => (await (await fetch("/api/police-chase/scores")).json()).scores.some((x) => x.name === "Tester 935" && x.score === 4321));
    check("...kept on this PC (read back)", g);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(500);
    check("Enter after GAME OVER: a new game", (await info()).phase !== "over" && (await ev(() => window.H3Chase.state().score)) === 0);
    await p.keyboard.press("KeyM");
    check("M: the sound on (off to start with)", (await info()).sound === true);
    await p.keyboard.press("KeyM");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
