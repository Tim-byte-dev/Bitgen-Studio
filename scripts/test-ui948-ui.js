#!/usr/bin/env node
/* bitGen Studio — 2.948.0 in a REAL browser: 🎓 LIFE CHOICES - 🏘 share a house from 💸 Budget, the dice bring housemate luck
 * (shown under the dice), the quarter's rent halves. Against the running app (H3_URL). */
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
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t948")) { sessionStorage.setItem("t948", "1"); localStorage.removeItem("h3.life.save"); localStorage.setItem("h3.life.speed", "instant"); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && document.getElementById("lifedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); const s = window.H3Life.newGame({ name: "Tester 948", bots: 1, seed: 4 });
      Object.assign(s.players[0], { ring: "jobs", pos: 0, qual: "trade", cash: 40000, job: { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 } }); window.H3Life.act(); });
    await p.click("#lcMoney summary"); await p.waitForTimeout(150);
    const opts = await ev(() => [...document.querySelectorAll("#lcHousing option")].map((o) => o.textContent));
    check("💸 Budget ▸ Housing: rent on your own or share a house (about half)", opts.length === 2 && /on my own - rent \$4,200/.test(opts[0]) && /Share a house - rent \$2,300/.test(opts[1]), opts);
    await p.selectOption("#lcHousing", "share"); await p.waitForTimeout(200);
    const hint = await ev(() => ({ h: window.H3Life.state().players[0].budget.housing, txt: document.getElementById("lcMoney") ? document.getElementById("lcMoney").textContent : "" }));
    check("...sharing: kept, and the panel warns the dice bring housemate luck", hint.h === "share" && /housemate luck/.test(hint.txt), hint);
    await ev(() => { const r = window.H3LifeCore.roll; window.H3LifeCore.roll = (s, a, b2) => (a == null ? r(s, 5, 6) : r(s, a, b2)); });
    await p.click("#lcRoll"); await p.waitForTimeout(400);
    const d = await ev(() => document.getElementById("lcDice").textContent);
    check("5 + 6 = 11: under the dice, 🏘 movie nights with great housemates (❤ +3)", /🏘 Movie nights with great housemates/.test(d) && /❤ \+3/.test(d), d);
    for (let k = 0; k < 4 && (await ev(() => !!window.H3Life.state().pending && window.H3Life.info().human)); k++) {
      await ev(() => { const s = window.H3Life.state(); if (s.pending.type === "puzzle") { window.H3LifeCore.answer(s, false); s.puz = null; } else window.H3LifeCore.choose(s, s.pending.options.filter((o) => !o.off).pop().id); });
    }
    await ev(() => window.H3Life.speed("instant"));
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    const bl = await ev(() => window.H3Life.state().players[0].lastBills);
    check("...the quarter's rent $2,300 and bills $450 while sharing", bl && bl.rent === 2300 && bl.utilities === 450, bl);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => { ["h3.life.save", "h3.life.speed"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("h3.g.lifedock", "1"); }); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
