#!/usr/bin/env node
/* bitGen Studio — 2.951.0 in a REAL browser (Tim: "for life choices, use a dialog to show questions, add a calculator to the
 * dialog, show the dice roll in the center circle"): 🎲 Roll -> the dice in the board's centre circle (the dice' white faces
 * there), the puzzle opens in the dialog over the board; the calculator's keys work out 12 × 7 = 84, ➜ puts it in the answer
 * box, Enter in the calculator never answers or rolls, ÷ 0 is said in words, C clears; the answer from the dialog is counted
 * and Carry on closes it. Against the running app (H3_URL). */
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
  let saved = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && window.H3LifeCalc, null, { timeout: 60000 });
    saved = await ev(() => { try { return localStorage.getItem("h3.life.save"); } catch (e) { return null; } });
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForTimeout(500);
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); return window.H3Life.newGame({ name: "T951", bots: 1, skill: 0.65, retire: 30 }); });
    await p.waitForTimeout(300);
    let i0 = await info();
    check("a new game: nothing rolled yet - no dice in the centre, no dialog", !i0.centre && !i0.dialog, i0);
    await ev(() => { const sp = document.getElementById("lcSpeed"); sp.value = "instant"; sp.dispatchEvent(new Event("change")); });
    await p.click("#lcRoll"); await p.waitForTimeout(400);
    let i1 = await info();
    // not every square is a puzzle (a library, a choice): play on until YOUR puzzle comes up
    for (let n = 0; n < 30 && !(i1.human && i1.pending === "puzzle"); n++) {
      if (i1.human && i1.pending === "choice") await ev(() => { const b = document.querySelector("#lcAct [data-opt]:not([disabled])"); if (b) b.click(); });
      else if (i1.human && !i1.pending) await p.click("#lcRoll");
      else if (i1.puzzle && i1.puzzle.done) await p.click("#lcOn");
      await p.waitForTimeout(400); i1 = await info();
    }
    const px = await ev(() => { const c = document.getElementById("lcBoard"), g = window.H3Life._geo(), x = c.getContext("2d"), k = c.width / c.getBoundingClientRect().width;
      const d = Math.max(16, g.R * 0.078), top = g.cy - g.R * 0.035 - d / 2, gap = d * 0.28;
      // low on the left die's face, between the pips: its cream face
      const at = x.getImageData(Math.round((g.cx - gap / 2 - d / 2) * k), Math.round((top + d * 0.5 + d * 0.38) * k), 1, 1).data; return [at[0], at[1], at[2]]; });
    check("🎲 Roll: the pair of dice in the centre circle (their cream faces drawn there), the total = the luck", i1.centre && i1.centre.dice.length === 2 && i1.centre.total === i1.centre.dice[0] + i1.centre.dice[1]
      && px[0] > 200 && px[1] > 200 && px[2] > 180, { c: i1.centre, px });
    check("...the puzzle opens in the dialog over the board (the side panel only points at it)", i1.pending === "puzzle" && i1.dialog
      && await ev(() => !!document.querySelector("#lcPz #lcPzHead") && !document.querySelector("#lcAct .q") && /the box over the board/.test(document.getElementById("lcAct").textContent)), i1);
    // the puzzle as a number one, so the calculator can feed it
    await ev(() => { const s = window.H3Life.state(); s.puz.p = { kind: "number", topic: "math", level: "hs", q: "What is 12 × 7?", answer: 84, secs: 90 }; s.puz.left = 90; window.H3Life.act(); });
    await p.waitForTimeout(150);
    for (const k of ["1", "2", "×", "7"]) await p.click(`#lcCalc [data-k="${k}"]`);
    const peek = await ev(() => document.getElementById("lcCalcOut").textContent);
    await p.click('#lcCalc [data-k="="]');
    const c1 = await ev(() => ({ in: document.getElementById("lcCalcIn").value, out: document.getElementById("lcCalcOut").textContent }));
    check("🧮 the keys: 12 × 7 shows = 84 as you go, = puts 84 in the display", peek === "= 84" && c1.in === "84" && c1.out === "12×7 =", { peek, c1 });
    await p.click("#lcCalcUse");
    check("➜ Use as the answer: 84 in the answer box", await ev(() => document.getElementById("lcAns").value) === "84");
    await p.fill("#lcCalcIn", "5/0"); await p.press("#lcCalcIn", "Enter"); await p.waitForTimeout(150);
    const c2 = await ev(() => ({ out: document.getElementById("lcCalcOut").textContent, bad: document.getElementById("lcCalcOut").classList.contains("bad"), i: window.H3Life.info(), ans: document.getElementById("lcAns").value }));
    check("Enter in the calculator works the sum out - never answers or rolls; ÷ 0 said in words", /÷ 0 has no answer/.test(c2.out) && c2.bad && c2.i.puzzle && !c2.i.puzzle.done && c2.ans === "84", c2);
    await p.click('#lcCalc [data-k="C"]');
    check("C clears", await ev(() => document.getElementById("lcCalcIn").value === "" && document.getElementById("lcCalcOut").textContent === ""));
    await p.click("#lcSubmit"); await p.waitForTimeout(150);
    const done = await ev(() => ({ ok: !!document.querySelector("#lcPz .ok"), on: !!document.getElementById("lcOn"), right: window.H3Life.state().players[0].right }));
    check("Answer from the dialog: ✔ Right, Carry on in the dialog", done.ok && done.on, done);
    await p.click("#lcOn"); await p.waitForTimeout(300);
    const i2 = await info();
    check("Carry on: the dialog closes, the dice stay in the centre", !i2.dialog && !i2.puzzle && i2.centre && i2.centre.dice.length === 2, i2);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await ev((sv) => { try { if (sv) localStorage.setItem("h3.life.save", sv); else localStorage.removeItem("h3.life.save"); } catch (e) { /* */ }
      if (typeof toggleMax === "function") toggleMax("lifedock", false); const d = document.getElementById("lifedock"); if (!d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); }, saved); } catch (e) { /* */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
