#!/usr/bin/env node
/* bitGen Studio — 2.952.0 in a REAL browser (Tim: "make the dialog draggable. when user presses enter while waiting for dice roll
 * then roll the dice"): the puzzle box drags with the mouse (kept inside the game, remembered, double-click = back to its place);
 * Enter rolls when it is your roll - focus on the page, on one of the game's buttons, after Carry on - but not while typing in
 * a box elsewhere in the app, and not with a panel open. Against the running app (H3_URL). */
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
  // play on (bots instant) until it is YOUR roll / YOUR puzzle
  const until = async (want) => {
    let i = await info();
    for (let n = 0; n < 40 && !want(i); n++) {
      if (i.human && i.pending === "choice") await ev(() => { const x = document.querySelector("#lcAct [data-opt]:not([disabled])"); if (x) x.click(); });
      else if (i.puzzle && i.puzzle.done) await ev(() => document.getElementById("lcOn").click());
      else if (i.human && i.pending === "puzzle") await ev(() => { const s = window.H3Life.state(); const a = s.puz.p; const el = document.querySelector('[data-ans="0"]'); if (el) el.click(); else { document.getElementById("lcAns").value = String(a.answer); document.getElementById("lcSubmit").click(); } });
      else if (i.human && !i.pending) await ev(() => document.getElementById("lcRoll").click());
      await p.waitForTimeout(350); i = await info();
    }
    return i;
  };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life, null, { timeout: 60000 });
    saved = await ev(() => { try { return [localStorage.getItem("h3.life.save"), localStorage.getItem("h3.life.pzpos")]; } catch (e) { return [null, null]; } });
    await ev(() => { try { localStorage.removeItem("h3.life.pzpos"); } catch (e) { /* */ } const d = document.getElementById("lifedock"); if (d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); });
    await p.waitForTimeout(500);
    await ev(() => { document.getElementById("lcSetup").classList.remove("on"); const sp = document.getElementById("lcSpeed"); sp.value = "instant"; sp.dispatchEvent(new Event("change"));
      return window.H3Life.newGame({ name: "T952", bots: 1, skill: 0.65, retire: 30 }); });
    await p.waitForTimeout(300);
    // ---- Enter rolls
    await ev(() => { if (document.activeElement) document.activeElement.blur(); });
    let r0 = (await info()).round, t0 = (await info()).turn;
    await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    let i1 = await info();
    check("Enter with the focus on the page: the dice roll", !!i1.centre && (i1.pending || i1.turn !== t0 || i1.round !== r0), i1);
    i1 = await until((i) => i.human && !i.pending && !i.puzzle);
    await ev(() => document.getElementById("lcHelpBtn").focus());
    await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    let i2 = await info();
    check("Enter with the focus on one of the game's buttons (❔): it rolls - not that button's click", (i2.pending || i2.turn !== i1.turn || i2.round !== i1.round)
      && !(await ev(() => document.getElementById("lcHelp").classList.contains("on"))), i2);
    // with a panel open: no roll
    i2 = await until((i) => i.human && !i.pending && !i.puzzle);
    await ev(() => { document.getElementById("lcHelp").classList.add("on"); document.activeElement && document.activeElement.blur(); });
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    let i3 = await info();
    check("Enter with ❔ How to play open: no roll", !i3.pending && i3.turn === i2.turn && i3.round === i2.round && JSON.stringify(i3.centre) === JSON.stringify(i2.centre), i3);
    await ev(() => document.getElementById("lcHelp").classList.remove("on"));
    // typing elsewhere in the app (not full screen): Enter is left alone
    await ev(() => { const t = document.createElement("textarea"); t.id = "t952"; document.body.appendChild(t); t.focus(); });
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const i4 = await info();
    check("Enter while typing in a box elsewhere in the app: no roll", !i4.pending && i4.turn === i2.turn && i4.round === i2.round, i4);
    await ev(() => document.getElementById("t952").remove());
    // ---- the box drags
    const iz = await until((i) => i.human && i.pending === "puzzle" && i.puzzle && !i.puzzle.done);
    check("a puzzle: the box is open", iz.dialog, iz);
    const box = await ev(() => { const r = document.querySelector("#lcPz > .lcpzBox").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await p.mouse.move(box.x + box.w - 8, box.y + box.h - 6); await p.mouse.down();
    await p.mouse.move(box.x + box.w - 108, box.y + box.h - 306, { steps: 6 }); await p.mouse.up();
    const moved = await ev(() => { const r = document.querySelector("#lcPz > .lcpzBox").getBoundingClientRect(); return { x: r.left, y: r.top, pos: localStorage.getItem("h3.life.pzpos"), off: window.H3Life._pzOff() }; });
    check("drag the box: it follows the mouse (100 left, 300 up) and the spot is remembered", Math.abs(moved.x - (box.x - 100)) < 3 && Math.abs(moved.y - (box.y - 300)) < 3 && moved.pos === "-100,-300", { box, moved });
    await p.mouse.move(box.x + box.w - 108, box.y + box.h - 306); await p.mouse.down();
    await p.mouse.move(box.x - 3000, box.y - 3000, { steps: 4 }); await p.mouse.up();
    const kept = await ev(() => { const r = document.querySelector("#lcPz > .lcpzBox").getBoundingClientRect(), m = document.getElementById("lcMain").getBoundingClientRect(); return { r: [r.left, r.top], m: [m.left, m.top] }; });
    check("dragged far off: it stops at the edge of the game (still in view)", Math.abs(kept.r[0] - kept.m[0]) < 2 && Math.abs(kept.r[1] - kept.m[1]) < 2, kept);
    const ansBefore = await ev(() => { const a = document.getElementById("lcAns"); return a ? a.value : null; });
    if (ansBefore !== null) { await p.click("#lcAns"); await p.keyboard.type("12"); }
    check("the answer box still takes clicks and typing (no drag there)", ansBefore === null || await ev(() => document.getElementById("lcAns").value === "12"));
    const at = await ev(() => { const r = document.querySelector("#lcPz > .lcpzBox").getBoundingClientRect(); return [r.right - 8, r.bottom - 6]; });
    await p.mouse.dblclick(at[0], at[1]); await p.waitForTimeout(150);
    const back = await ev(() => { const r = document.querySelector("#lcPz > .lcpzBox").getBoundingClientRect(); return { x: r.left, y: r.top, pos: localStorage.getItem("h3.life.pzpos") }; });
    check("double-click: back to its place", Math.abs(back.x - box.x) < 3 && Math.abs(back.y - box.y) < 3 && back.pos === "0,0", { box, back });
    // ---- after Carry on, Enter rolls (the focus left the closed box)
    await ev(() => { const s = window.H3Life.state(); const el = document.querySelector('[data-ans="0"]'); if (el) el.click(); else { document.getElementById("lcAns").value = String(s.puz.p.answer); document.getElementById("lcSubmit").click(); } });
    await p.waitForTimeout(200);
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);                     // Carry on (its button has the focus)
    const i5 = await until((i) => i.human && !i.pending && !i.puzzle);
    const r5 = { round: i5.round, turn: i5.turn };
    check("the box closed: the focus is not left in it", await ev(() => !document.getElementById("lcPz").contains(document.activeElement)));
    await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    const i6 = await info();
    check("...and Enter rolls again", i6.pending || i6.turn !== r5.turn || i6.round !== r5.round, i6);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    try { await ev((sv) => { try { if (sv[0]) localStorage.setItem("h3.life.save", sv[0]); else localStorage.removeItem("h3.life.save"); if (sv[1]) localStorage.setItem("h3.life.pzpos", sv[1]); else localStorage.removeItem("h3.life.pzpos"); } catch (e) { /* */ }
      if (typeof toggleMax === "function") toggleMax("lifedock", false); const d = document.getElementById("lifedock"); if (!d.classList.contains("dockgone")) toggleDockGone("lifedock", "tX_lifedock"); }, saved || [null, null]); } catch (e) { /* */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
