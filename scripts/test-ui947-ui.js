#!/usr/bin/env node
/* bitGen Studio — 2.947.0 in a REAL browser: 🎓 LIFE CHOICES - 💸 budget, 🛡 insurance and tax on your turn: food and fun
 * picked, cover ticked, the quarter's bills itemised, a birthday's tax return, ❤ wellbeing in the players' table. Against the running app (H3_URL). */
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
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t947")) { sessionStorage.setItem("t947", "1"); localStorage.removeItem("h3.life.save"); localStorage.setItem("h3.life.speed", "instant"); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && window.H3LifeMoney && document.getElementById("lifedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); const s = window.H3Life.newGame({ name: "Tester 947", bots: 1, seed: 9 });
      Object.assign(s.players[0], { ring: "jobs", pos: 0, age: 25.75, qual: "trade", cash: 40000, job: { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 } }); window.H3Life.act(); window.H3Life.draw(); });
    const th = await ev(() => [...document.querySelectorAll("#lcPlayers th")].map((t) => t.textContent));
    check("❤ wellbeing in the players' table", th.includes("❤"), th);
    await p.click("#lcMoney summary"); await p.waitForTimeout(150);
    const m0 = await ev(() => ({ food: [...document.querySelectorAll("#lcFood option")].map((o) => o.textContent), fun: [...document.querySelectorAll("#lcFun option")].map((o) => o.textContent), covers: [...document.querySelectorAll("#lcMoney [data-cover]")].map((c) => c.getAttribute("data-cover")) }));
    check("💸 Budget: food (cook at home / a mix / eat out) and fun (picnics < cinema < concerts < a holiday) with their prices; 🛡 health, car, home cover",
      m0.food.length === 3 && /Cook at home - \$1,500/.test(m0.food[0]) && m0.fun.length === 4 && /Picnics.*\$150/.test(m0.fun[0]) && /holiday.*\$2,800/.test(m0.fun[3]) && m0.covers.join() === "health,car,home", m0);
    await p.selectOption("#lcFun", "picnic"); await p.selectOption("#lcFood", "home");
    await p.check('#lcMoney [data-cover="health"]');
    const st = await ev(() => { const q = window.H3Life.state().players[0]; return { b: q.budget, ins: q.ins }; });
    check("...picked: food at home, picnics, health cover on (kept in the game)", st.b.food === "home" && st.b.fun === "picnic" && st.ins.health && !st.ins.car, st);
    await ev(() => { const r = window.H3LifeCore.roll; window.H3LifeCore.roll = (s, a, b2) => (a == null ? r(s, 3, 4) : r(s, a, b2)); });   // an ordinary roll (3 + 4), 3 squares on
    await p.click("#lcRoll"); await p.waitForTimeout(400);
    for (let k = 0; k < 4 && (await ev(() => !!window.H3Life.state().pending && window.H3Life.info().human)); k++) {
      await ev(() => { const s = window.H3Life.state(); if (s.pending.type === "puzzle") { s.puz && (s.puz.done = { ok: false }); window.H3LifeCore.answer(s, false); s.puz = null; } else window.H3LifeCore.choose(s, s.pending.options.filter((o) => !o.off).pop().id); window.H3Life.act(); });
      await p.waitForTimeout(150);
    }
    await ev(() => window.H3Life.speed("instant"));                       // the bots play their turns
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    await ev(() => { const d = document.getElementById("lcMoney"); if (d && !d.open) d.open = true; });
    const after = await ev(() => { const q = window.H3Life.state().players[0]; return { txt: (document.getElementById("lcMoney") || {}).textContent || "", bills: q.lastBills, tax: q.lastTax, wb: q.wellbeing }; });
    check("the quarter's bills itemised (rent, utilities, phone + internet, getting around, food $1,500, fun $150, insurance $650)",
      after.bills && after.bills.food === 1500 && after.bills.fun === 150 && after.bills.insurance === 650 && /Last quarter's bills/.test(after.txt) && /rent \$4,200/.test(after.txt) && /insurance \$650/.test(after.txt), after);
    check("his 26th birthday: 🧾 a tax return - income, deductions, taxable, tax, withheld and the refund / bill", after.tax && after.tax.age === 26 && /Tax return at 26/.test(after.txt) && /(refund|bill) \$/.test(after.txt), after.tax);
    await p.screenshot({ path: "/tmp/life4.png", clip: { x: 1120, y: 60, width: 380, height: 620 } });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => { ["h3.life.save", "h3.life.speed"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("h3.g.lifedock", "1"); }); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
