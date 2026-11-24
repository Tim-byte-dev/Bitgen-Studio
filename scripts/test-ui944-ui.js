#!/usr/bin/env node
/* bitGen Studio — 2.944.0 in a REAL browser: 🎓 LIFE CHOICES stage 1 - 🎓 on the top bar opens it to the whole window, the
 * set-up (name from bitGen, bots, retire age), the 2D board drawn (54 squares, hover tips), a puzzle answered right and one
 * wrong, the bots playing on their own, the fork's three paths, the factory to the investment ring, the game kept over a
 * reload, a finished game's score saved, back to the docker. Against the running app (H3_URL). */
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
  const info = () => ev(() => window.H3Life.info());
  try {
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t944")) { sessionStorage.setItem("t944", "1");
      ["h3.life.save", "h3.g.lifedock", "h3.life.speed", "h3.life.name"].forEach((k) => localStorage.removeItem(k)); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && document.getElementById("lifedock"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const first = await ev(() => ({ gone: document.getElementById("lifedock").classList.contains("dockgone"), btn: !!document.querySelector("#appGrp2 #tX_lifedock"), icon: (document.getElementById("tX_lifedock") || {}).textContent }));
    check("hidden the first time; 🎓 in the top bar's mini-app group", first.gone && first.btn && first.icon === "🎓", first);
    await ev(() => fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tester 944" }) }));
    await p.click("#tX_lifedock");
    await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await p.waitForTimeout(600);
    const f1 = await ev(() => { const r = document.getElementById("lifedock").getBoundingClientRect(); return { r: [r.left, r.top, r.width, r.height], W: innerWidth, H: innerHeight, setup: document.getElementById("lcSetup").classList.contains("on"), name: document.getElementById("lcName").value }; });
    check("🎓: the whole window (maximized), the set-up open with bitGen's name for you", f1.r[0] <= 1 && f1.r[1] <= 1 && f1.r[2] >= f1.W - 2 && f1.r[3] >= f1.H - 2 && f1.setup && f1.name === "Tester 944", f1);
    await p.selectOption("#lcBots", "3"); await p.selectOption("#lcRetire", "30"); await p.selectOption("#lcSpeed", "fast");
    await p.click("#lcStart"); await p.waitForTimeout(500);
    const g1 = await ev(() => { const s = window.H3Life.state(); return { n: s.players.length, me: s.players[0].name, bots: s.players.slice(1).map((q) => q.bot), retire: s.retire }; });
    check("a game: you + 3 bots (a saver, a tycoon, a risk-taker), retire at 30", g1.n === 4 && g1.me === "Tester 944" && g1.bots.join() === "saver,tycoon,risk" && g1.retire === 30, g1);
    const px = await ev(() => { const c = document.getElementById("lcBoard"), x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0, k = 0; for (let i = 0; i < d.length; i += 4 * 97) { n++; if (d[i] + d[i + 1] + d[i + 2] > 120) k++; } return { lit: k / n, sq: window.H3Life.info().squares }; });
    check("the 2D board is drawn: 74 squares in rings (high school, college, apprenticeship, jobs, investment, land & houses since 2.945.0)", px.sq === 74 && px.lit > 0.2, px);
    // hover a square: its tip
    const at = await ev(() => { const g = window.H3Life._geo(), q = g.sq.find((z) => z.ring === "invest" && z.i === 15), r = document.getElementById("lcBoard").getBoundingClientRect(); return [r.left + q.cx, r.top + q.cy]; });
    await p.mouse.move(at[0], at[1]); await p.waitForTimeout(200);
    const tip = await ev(() => { const t = document.getElementById("lcTip"); return { on: t.style.display === "block", txt: t.textContent }; });
    check("hover a square: what it does (the Office tower, its price, for sale)", tip.on && /Office tower/.test(tip.txt) && /For sale/.test(tip.txt), tip);
    await p.mouse.move(5, 5);
    // your turn: roll -> a high school puzzle; answer it right
    await p.click("#lcRoll"); await p.waitForTimeout(300);
    let i1 = await info();
    const tryAnswer = async (right) => {
      const z = await ev(() => { const s = window.H3Life.state(); return s.puz && { kind: s.puz.p.kind, answer: String(s.puz.p.answer), choices: s.puz.p.choices || null }; });
      if (!z) return null;
      if (z.kind === "choice") { const idx = z.choices.findIndex((c) => right ? c === z.answer : c !== z.answer); await p.click('[data-ans="' + idx + '"]'); }
      else { await p.fill("#lcAns", right ? z.answer : "zzz"); await p.keyboard.press("Enter"); }
      await p.waitForTimeout(150);
      return z;
    };
    if (i1.pending !== "puzzle") { await ev(() => { const s = window.H3Life.state(); }); }
    const z1 = i1.pending === "puzzle" ? await tryAnswer(true) : null;
    const v1 = await ev(() => ({ ok: !!document.querySelector("#lcPz .ok"), on: !!document.getElementById("lcOn"), timer: !!document.getElementById("lcTime") }));
    check("🎲 Roll -> a high school puzzle with a clock; the right answer -> ✔ Right", i1.pending === "puzzle" && z1 && v1.ok && v1.on, { i1, v1 });
    const cash0 = await ev(() => window.H3Life.state().players[0].cash);
    await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    const me1 = await ev(() => { const q = window.H3Life.state().players[0]; return { right: q.hsRight, iq: q.iq, cash: q.cash }; });
    check("...Enter carries on: +$250 (and a quarter's pocket of nothing), IQ +2, 1 of 5", me1.right === 1 && me1.iq === 102 && me1.cash === cash0 + 250, me1);
    // the bots play by themselves until it is your turn again
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    const r2 = await ev(() => { const s = window.H3Life.state(); return { round: s.round, botsMoved: s.players.slice(1).every((q) => q.age > 16), log: s.log.length }; });
    check("the bots take their turns by themselves (fast), then it is yours again", r2.round === 2 && r2.botsMoved, r2);
    // a wrong answer: the right one shown
    let z2 = null; for (let t = 0; t < 6 && !z2; t++) { await p.click("#lcRoll"); await p.waitForTimeout(250); if ((await info()).pending === "puzzle") z2 = await tryAnswer(false); else await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 }); }
    const v2 = await ev(() => ({ no: (document.querySelector("#lcPz .no") || {}).textContent || "" }));
    check("a wrong answer: ✘ and the right answer shown", z2 && /The answer:/.test(v2.no) && v2.no.includes(z2.answer), { z2, v2 });
    await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    check("...counted (1 of 3 allowed)", (await ev(() => window.H3Life.state().players[0].hsWrong)) === 1);
    // straight to the fork: four right in a row
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    await ev(() => { const q = window.H3Life.state().players[0]; q.hsRight = 4; });
    for (let t = 0; t < 8; t++) {
      if ((await info()).pending === "choice") break;
      await p.click("#lcRoll"); await p.waitForTimeout(250);
      if ((await info()).pending === "puzzle") { await tryAnswer(true); await p.keyboard.press("Enter"); await p.waitForTimeout(200); }
      if ((await info()).pending !== "choice") await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    }
    const fork = await ev(() => ({ q: window.H3Life.state().players[0].qual, btns: [...document.querySelectorAll("#lcAct [data-opt]")].map((x) => x.getAttribute("data-opt") + (x.disabled ? "-off" : "")) }));
    check("5 right: the diploma and the fork - 🎓 college, 🔧 trades, 🏭 factory (all open)", fork.q === "diploma" && fork.btns.join() === "college,trade,factory", fork);
    await p.click('[data-opt="factory"]'); await p.waitForTimeout(300);
    const fac = await ev(() => { const q = window.H3Life.state().players[0]; return { ring: q.ring, job: q.job && q.job.title, row: document.querySelector("#lcPlayers tr.now, #lcPlayers tr") && document.getElementById("lcPlayers").textContent.includes("Factory hand") }; });
    check("🏭 the factory: straight to the investment ring as a Factory hand (in the players' table)", fac.ring === "invest" && fac.job === "Factory hand" && fac.row, fac);
    // kept over a reload
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    const before = await ev(() => JSON.stringify(window.H3Life.state()));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Life && window.H3Life.state(), null, { timeout: 60000 });
    const after = await ev(() => JSON.stringify(window.H3Life.state()));
    check("a reload carries on with the same game (saved after every move)", before === after);
    // a finished game: play it out (you retired), the score saved
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForTimeout(500);
    await ev(() => { const s = window.H3Life.state(); s.players[0].age = 29.9; window.H3Life.speed("instant"); });
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    await p.click("#lcRoll"); await p.waitForTimeout(300);
    for (let t = 0; t < 4 && (await info()).pending; t++) {
      if ((await info()).pending === "puzzle") { await tryAnswer(true); await p.keyboard.press("Enter"); }
      else await ev(() => { const o = window.H3Life.state().pending.options.filter((x) => !x.off).pop(); document.querySelector('[data-opt="' + o.id + '"]').click(); });
      await p.waitForTimeout(200);
    }
    await p.waitForFunction(() => window.H3Life.info().over, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const sc = await ev(() => fetch("/api/life-choices/scores").then((r) => r.json()));
    const over = await ev(() => document.getElementById("lcAct").textContent);
    check("you retire at 30, the bots play the rest instantly; the standings; your score saved on this PC", /Everyone has retired/.test(over) && sc.scores.some((x) => x.name === "Tester 944" && x.retire === 30), { over: over.slice(0, 200), sc });
    await ev(() => toggleMax("lifedock", true)); await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await p.click("#lcExitFull"); await p.waitForTimeout(400);
    check("🗗 Back to the docker", !(await ev(() => document.body.classList.contains("lc-full") || document.getElementById("lifedock").classList.contains("maxed"))));
    await p.screenshot({ path: "/tmp/ui944.png" });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => { ["h3.life.save", "h3.life.speed", "h3.life.name"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("h3.g.lifedock", "1"); return fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "" }) }); }); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
