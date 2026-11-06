#!/usr/bin/env node
/* bitGen Studio — 2.690.0 in a REAL browser: THE SKETCHER'S WALLS SNAP TO OTHER WALLS' ENDS AND STAY JOINED. The Wall tool pulls
 * a point onto another wall's end / corner when it is close (15 cm, or 14 px; the tip says "⊕ joined"; Shift = free); a wall
 * finished there is JOINED (A.joins - kept by a save); dragging the new wall moves the old wall's joined end with it (it grows /
 * shrinks), live and on release, one ↶ step; dragging the old one moves the new one's end; a wall drawn out of an end piece is
 * joined too.
 * Tim (verbatim): "snap walls to the end of other walls when they are close, when the new wall snaps to another wall join the walls
 * together so when the new wall moves the old walls resize"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.690.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const r3 = (v) => Math.round(v * 1000) / 1000;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPArch && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); S.M.f = []; S.M.v = []; S.M.e = []; H3PushPull.commit("clear", b0);
      PPArch.addRoom(S.M.arch, PPArch.rectPts([-1, -1], [7, 5]), true); S.V.view("top"); S.V.extents(); S.M.arch.rooms = []; S.V.draw && S.V.draw(); });
    await p.waitForTimeout(400);
    const scr = (x, y) => ev(([x, y]) => { const S = H3PushPull.state, s = S.V.screen([x, y, 0]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y]);
    const click = async (x, y, o) => { const q = await scr(x, y); await p.mouse.move(q[0], q[1]); await p.waitForTimeout(60); if (o && o.shift) await p.keyboard.down("Shift"); await p.mouse.click(q[0], q[1]); if (o && o.shift) await p.keyboard.up("Shift"); await p.waitForTimeout(o && o.wait || 250); };
    const finish = async (x, y, o) => { const q = await scr(x, y); if (o && o.shift) await p.keyboard.down("Shift"); await p.mouse.dblclick(q[0], q[1]); if (o && o.shift) await p.keyboard.up("Shift"); await p.waitForTimeout(400); };   // double-click = the wall ends
    // Wall 1: 0,0 -> 4,0
    await ev(() => H3PushPull.state.T.use("wall")); await p.waitForTimeout(150);
    await click(0, 0); await finish(4, 0);
    const w1 = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts));
    // Wall 2: starts NEAR wall 1's end (10 cm off) -> pulled onto it
    const near = await scr(4.08, 0.07); await p.mouse.move(near[0], near[1]); await p.waitForTimeout(150);
    const tip = await ev(() => [...document.querySelectorAll("#ppView div")].filter((d) => d.style.position === "absolute" && /pointer-events: none/.test(d.style.cssText)).map((d) => d.textContent).join(" | "));   // the view's tip
    await click(4.08, 0.07);
    await finish(4, 3);
    const A1 = await ev(() => { const A = H3PushPull.state.M.arch; return { rooms: A.rooms.map((R) => ({ id: R.id, name: R.name, pts: R.pts.map((q) => q.map((v) => Math.round(v * 1000) / 1000)) })), joins: A.joins, msg: document.getElementById("ppMsg").textContent }; });
    check("Wall 1 drawn 0,0 -> 4,0", w1.length === 1 && JSON.stringify(w1[0].map((q) => q.map(r3))) === "[[0,0],[4,0]]", w1);
    check("Wall 2 started 10 cm off Wall 1's end: pulled ONTO it (4, 0) - and the two are joined (said)", A1.rooms.length === 2 && JSON.stringify(A1.rooms[1].pts[0]) === "[4,0]" && A1.joins.length === 1 && /⊕ joined to 1 wall end/.test(A1.msg), A1);
    check("…the pointer near the end: the tip says ⊕ joined", /joined/.test(tip), tip.slice(0, 200));
    // drag Wall 2 one metre to the right: Wall 1's end follows (grows to 5 m)
    await ev(() => H3PushPull.state.T.use("select")); await p.waitForTimeout(150);
    const g0 = await scr(4, 1.6), g1 = await scr(5, 1.6);
    await p.mouse.move(g0[0], g0[1]); await p.mouse.down(); await p.mouse.move(g0[0] + 6, g0[1], { steps: 2 }); await p.mouse.move(g1[0], g1[1], { steps: 10 });
    await p.waitForTimeout(150);
    const live = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts.map((q) => q.map((v) => Math.round(v * 100) / 100))));
    await p.mouse.up(); await p.waitForTimeout(400);
    const A2 = await ev(() => { const A = H3PushPull.state.M.arch; return { pts: A.rooms.map((R) => R.pts.map((q) => q.map((v) => Math.round(v * 1000) / 1000))), joins: A.joins }; });
    check("drag Wall 2 1 m to the right: Wall 1's joined end goes WITH it while dragging (Wall 1 4 m -> 5 m)", Math.abs(live[1][0][0] - 5) < 0.06 && Math.abs(live[0][1][0] - live[1][0][0]) < 0.001 && live[0][0][0] === 0, live);
    check("…let go: Wall 1 is 5 m long (its other end still at 0, 0), the join moved to 5, 0", Math.abs(A2.pts[1][0][0] - 5) < 0.06 && A2.pts[0][1][0] === A2.pts[1][0][0] && A2.pts[0][1][1] === 0 && JSON.stringify(A2.pts[0][0]) === "[0,0]" && A2.joins[0].p[0] === A2.pts[0][1][0], A2);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    const A3 = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts));
    check("…↶ one step: both walls back (4 m, Wall 2 at x 4)", JSON.stringify(A3[0].map((q) => q.map(r3))) === "[[0,0],[4,0]]" && r3(A3[1][0][0]) === 4, A3);
    // drag Wall 1 (the old one) up 1 m: Wall 2's joined end follows it
    const h0 = await scr(2, 0), h1 = await scr(2, 1);
    await p.mouse.move(h0[0], h0[1]); await p.mouse.down(); await p.mouse.move(h0[0], h0[1] - 6, { steps: 2 }); await p.mouse.move(h1[0], h1[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400);
    const A4 = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts.map((q) => q.map((v) => Math.round(v * 1000) / 1000))));
    check("drag the OLD wall (Wall 1) 1 m up: Wall 2's joined end follows (Wall 2 shrinks 3 m -> 2 m)", Math.abs(A4[0][0][1] - 1) < 0.06 && A4[1][0][1] === A4[0][1][1] && A4[1][1][1] === 3, A4);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    // Shift: free - no pull, no join
    await ev(() => H3PushPull.state.T.use("wall")); await p.waitForTimeout(150);
    await click(0.08, 0.07, { shift: true }); await finish(0, -2, { shift: true });
    const A5 = await ev(() => { const A = H3PushPull.state.M.arch; return { start: A.rooms[2] && A.rooms[2].pts[0].map((v) => Math.round(v * 100) / 100), joins: A.joins.length }; });
    check("Shift held: the wall starts where clicked (not pulled onto Wall 1's end), not joined", A5.start && (A5.start[0] !== 0 || A5.start[1] !== 0) && A5.joins === 1, A5);
    const kept = await ev(() => { const c = PPArch.clean(JSON.parse(JSON.stringify(H3PushPull.state.M.arch))); return c.joins.length === 1 && c.joins[0].p.join() === "4,0"; });
    check("the join is kept through a save / load (PPArch.clean)", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
