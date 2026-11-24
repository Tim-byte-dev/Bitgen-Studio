#!/usr/bin/env node
/* bitGen Studio — 2.945.0 in a REAL browser: 🎓 LIFE CHOICES - the LAND & HOUSES ring: drawn outside, a renovator bought
 * from its square, renovated at a Builder (the square turns into a good house worth more), a lot's hover tip, a 2.944.0
 * save upgraded on load. Against the running app (H3_URL). */
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
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t945")) { sessionStorage.setItem("t945", "1"); localStorage.removeItem("h3.life.save"); localStorage.setItem("h3.life.speed", "fast"); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && document.getElementById("lifedock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForFunction(() => document.body.classList.contains("lc-full"), null, { timeout: 8000 });
    await p.waitForTimeout(500);
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); const s = window.H3Life.newGame({ name: "Tester 945", bots: 1, seed: 3 });
      const q = s.players[0]; Object.assign(q, { ring: "estate", pos: 2, open: true, paydays: 3, qual: "trade", cash: 500000, job: { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 } }); window.H3Life.act(); window.H3Life.draw(); });
    const ring = await ev(() => { const g = window.H3Life._geo(), e = g.sq.filter((q) => q.ring === "estate"), inv = g.sq.filter((q) => q.ring === "invest"); return { n: e.length, outside: Math.min(...e.map((q) => q.r0)) >= Math.max(...inv.map((q) => q.r1)), lots: e.filter((q) => q.kind === "lot").length }; });
    check("the land & houses ring drawn outside the investment ring: 20 squares, 15 lots", ring.n === 20 && ring.outside && ring.lots === 15, ring);
    const col = () => ev(() => { const g = window.H3Life._geo(), q = g.sq.find((z) => z.ring === "estate" && z.i === 3), c = document.getElementById("lcBoard"), d = Math.min(2, devicePixelRatio || 1);
      const px = c.getContext("2d").getImageData(Math.round((q.cx + Math.cos((q.a0 + q.a1) / 2) * (q.r1 - q.r0) * 0.35) * d), Math.round((q.cy + Math.sin((q.a0 + q.a1) / 2) * (q.r1 - q.r0) * 0.35) * d), 1, 1).data; return [px[0], px[1], px[2]]; });
    const c0 = await col();
    await ev(() => { const r = window.H3LifeCore.roll; window.H3LifeCore.roll = (s, d) => r(s, d || 1); });   // the die shows 1 (the button still rolls)
    await p.click("#lcRoll"); await p.waitForTimeout(300);
    const pd = await ev(() => { const s = window.H3Life.state(); return s.pending && { kind: s.pending.kind, title: s.pending.title, text: s.pending.text }; });
    check("🎲 onto the Weatherboard renovator: for sale, it says it needs renovating", pd && pd.kind === "buy" && /Weatherboard renovator/.test(pd.title) && /needs renovating/.test(pd.text), pd);
    await p.click('[data-opt="buy:e3"]'); await p.waitForTimeout(300);
    check("...bought from its button", (await ev(() => window.H3Life.state().estate[3].owner)) === 0);
    await p.waitForFunction(() => window.H3Life.info().human && !window.H3Life.info().pending, null, { timeout: 20000 });
    await ev(() => { const s = window.H3Life.state(); s.players[0].ring = "estate"; s.players[0].pos = 3; window.H3Life.act(); });
    await p.click("#lcRoll"); await p.waitForTimeout(300);
    const wk = await ev(() => [...document.querySelectorAll("#lcAct [data-opt]")].map((x) => x.getAttribute("data-opt")));
    check("a 🏗 Builder square: renovate your renovator (or Not now)", wk.join() === "reno:e3,done", wk);
    await p.click('[data-opt="reno:e3"]'); await p.waitForTimeout(400);
    const after = await ev(() => { const e = window.H3Life.state().estate[3]; return { type: e.type, value: e.value }; });
    const c1 = await col();
    check("...renovated: a good house worth more; its square changes colour on the board", after.type === "good" && after.value === 465000 && c1.join() !== c0.join(), { after, c0, c1 });
    const at = await ev(() => { const g = window.H3Life._geo(), q = g.sq.find((z) => z.ring === "estate" && z.i === 1), r = document.getElementById("lcBoard").getBoundingClientRect(); return [r.left + q.cx, r.top + q.cy]; });
    await p.mouse.move(at[0], at[1]); await p.waitForTimeout(200);
    const tip = await ev(() => document.getElementById("lcTip").textContent);
    check("hover a block of land: what it is, its worth and what building costs", /Hilltop block/.test(tip) && /block of land/.test(tip) && /Build: \$320,000/.test(tip), tip);
    // a 2.944.0 save (no estate) loads with the ring
    await ev(() => { const s = JSON.parse(JSON.stringify(window.H3Life.state())); delete s.estate; localStorage.setItem("h3.life.save", JSON.stringify(s)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Life && window.H3Life.state(), null, { timeout: 60000 });
    check("a game saved by 2.944.0 loads with the land & houses ring", (await ev(() => Object.keys(window.H3Life.state().estate || {}).length)) === 15);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await p.evaluate(() => { ["h3.life.save", "h3.life.speed"].forEach((k) => localStorage.removeItem(k)); localStorage.setItem("h3.g.lifedock", "1"); }); } catch (e) { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
