#!/usr/bin/env node
/* bitGen Studio — 2.946.0 in a REAL browser: 🎓 LIFE CHOICES - 🎲 a pair of dice every turn: the dice and their luck shown
 * with a 2-12 meter, double six says roll again, your own last roll stays in view while the bots play. Against the running app (H3_URL). */
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
  try {
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t946")) { sessionStorage.setItem("t946", "1"); localStorage.removeItem("h3.life.save"); localStorage.setItem("h3.life.speed", "fast"); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && document.getElementById("lifedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); window.H3Life.newGame({ name: "Tester 946", bots: 2, seed: 6 }); });
    const lbl = await ev(() => document.getElementById("lcRoll").textContent);
    check("your turn: 🎲 Roll the dice", lbl === "🎲 Roll the dice", lbl);
    // the pair forced to 4 + 6 (the button still rolls)
    await ev(() => { const r = window.H3LifeCore.roll; window.__dice = [4, 6]; window.H3LifeCore.roll = (s, a, b2) => (a == null && window.__dice ? r(s, window.__dice[0], window.__dice[1]) : r(s, a, b2)); });
    await p.click("#lcRoll"); await p.waitForTimeout(450);
    const d1 = await ev(() => { const el = document.getElementById("lcDice"), L = window.H3Life.state().luck; return { txt: el.textContent, on: [...el.querySelectorAll(".meter i")].findIndex((i) => i.classList.contains("on")), cells: el.querySelectorAll(".meter i").length, L, cash: window.H3Life.state().players[0].cash }; });
    check("the dice shown (⚃⚅), 4 + 6 = 10 - a bit lucky: a birthday gift +$150; the meter lit at 10 of 2-12",
      /⚃⚅/.test(d1.txt) && /4 \+ 6 = 10/.test(d1.txt) && /a bit lucky/.test(d1.txt) && /birthday gift/.test(d1.txt) && /\+\$150/.test(d1.txt) && d1.cells === 11 && d1.on === 8 && d1.cash === 650, d1);
    // answer whatever comes, let the bots roll: your last roll stays in view
    const z = await ev(() => { const s = window.H3Life.state(); return s.puz && { kind: s.puz.p.kind, a: String(s.puz.p.answer), ch: s.puz.p.choices }; });
    if (z && z.kind === "choice") await p.click('[data-ans="' + z.ch.indexOf(z.a) + '"]'); else if (z) { await p.fill("#lcAns", z.a); await p.keyboard.press("Enter"); }
    await p.waitForTimeout(150); await p.keyboard.press("Enter");
    await ev(() => { window.__dice = null; });
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending && window.H3Life.state().luck.who !== 0, null, { timeout: 20000 });
    const d2 = await ev(() => document.getElementById("lcDice").textContent);
    check("the bots roll the pair too; your own last roll stays in view under theirs", /(Ava|Kai) rolled \d \+ \d = \d+/.test(d2) && /Your last roll: 4 \+ 6 = 10/.test(d2), d2);
    // double six: roll again
    await ev(() => { window.__dice = [6, 6]; });
    await p.click("#lcRoll"); await p.waitForTimeout(450);
    const z2 = await ev(() => { const s = window.H3Life.state(); return s.puz && { kind: s.puz.p.kind, a: String(s.puz.p.answer), ch: s.puz.p.choices }; });
    if (z2 && z2.kind === "choice") await p.click('[data-ans="' + z2.ch.indexOf(z2.a) + '"]'); else if (z2) { await p.fill("#lcAns", z2.a); await p.keyboard.press("Enter"); }
    await p.waitForTimeout(150); if (z2) await p.keyboard.press("Enter");
    await p.waitForTimeout(250);
    const d3 = await ev(() => ({ h: (document.querySelector("#lcAct h4") || {}).textContent, dice: document.getElementById("lcDice").textContent, me: window.H3Life.info().human }));
    check("double six: brilliant luck (a bursary), 🎲 roll again - still your turn", d3.me && /Double six - roll again/.test(d3.h) && /brilliant luck/.test(d3.dice) && /roll again/.test(d3.dice), d3);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => { ["h3.life.save", "h3.life.speed"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("h3.g.lifedock", "1"); }); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
