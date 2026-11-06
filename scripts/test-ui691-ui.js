#!/usr/bin/env node
/* bitGen Studio — 2.691.0 in a REAL browser: THE SKETCHER'S NEW WALLS BUTT UP TO THE OLD ONES, AND THE LAST-SET THICKNESS. A wall
 * drawn with the Wall tool onto another wall's end (joined) has no square cap there - the old wall's end is shaped round the corner
 * (one clean outline, no notch); a wall drawn across a room from wall to wall stops at the walls' inside faces; the thickness typed
 * in the Wall tool / a picked wall or room is the next walls' (over 2 = millimetres; a stored 2 m = back to 150 mm).
 * Tim (verbatim): "the ends of the walls are not mitered or shaped, the new wall will butt up to the existing walls, even in rooms,
 * use last set wall thickness for the wall thickness right now u have it set at 2m"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.691.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  // Tim's stuck 2 m (a size in mm typed into the metre box, held at its top)
  await p.addInitScript(() => { try { if (!sessionStorage.getItem("t691")) { sessionStorage.setItem("t691", "1"); const o = JSON.parse(localStorage.getItem("pp.archopt") || "{}"); o.wall = Object.assign({}, o.wall, { t: 2 }); o.room = Object.assign({}, o.room, { t: 2 }); localStorage.setItem("pp.archopt", JSON.stringify(o)); } } catch (e) { /* fine */ } });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPArch && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); S.M.f = []; S.M.v = []; S.M.e = []; H3PushPull.commit("clear", b0);
      PPArch.addRoom(S.M.arch, PPArch.rectPts([-1, -1], [9, 6]), true); S.V.view("top"); S.V.extents(); S.M.arch.rooms = []; S.V.draw && S.V.draw(); });
    await p.waitForTimeout(400);
    const scr = (x, y) => ev(([x, y]) => { const S = H3PushPull.state, s = S.V.screen([x, y, 0]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y]);
    const click = async (x, y) => { const q = await scr(x, y); await p.mouse.move(q[0], q[1]); await p.waitForTimeout(60); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(900); };
    const finish = async (x, y) => { const q = await scr(x, y); await p.mouse.move(q[0], q[1]); await p.waitForTimeout(60); await p.mouse.dblclick(q[0], q[1]); await p.waitForTimeout(500); };
    const thick = () => ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => /^(Wall thickness|Thickness \(all)/.test(x.querySelector("span").textContent)); return r ? +r.querySelector("input").value : null; });
    const typeThick = (v) => ev((v) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => /^(Wall thickness|Thickness \(all)/.test(x.querySelector("span").textContent)); const i = r.querySelector("input"); i.value = String(v); i.dispatchEvent(new Event("change")); }, v);
    await ev(() => H3PushPull.state.T.use("wall")); await p.waitForTimeout(200);
    const t0 = await thick();
    check("a stored 2 m wall thickness (mm typed into the metre box, held at 2 m) is back to 150 mm", t0 === 0.15, t0);
    await typeThick(200); await p.waitForTimeout(200);
    const t1 = await thick();
    check("typing 200 in the Wall tool's thickness = 200 mm (0.2 m), not held at 2 m", t1 === 0.2, t1);
    // Wall 1, then Wall 2 onto its end at an angle (joined)
    await click(0, 0); await finish(4, 0);
    await click(4, 0); await finish(5.5, 2.6);
    const J = await ev(() => { const A = H3PushPull.state.M.arch; return { t: A.rooms.map((R) => R.t), joins: A.joins.length, w1: PPArch.joints(A.rooms[0]).map((j) => ({ k: j.k, shaped: !!j.shaped })), w2: PPArch.joints(A.rooms[1]).map((j) => j.k) }; });
    check("both walls drawn 0.2 m thick (the thickness just typed)", J.t.length === 2 && J.t.every((t) => t === 0.2), J);
    check("Wall 2 onto Wall 1's end: joined, Wall 2 has NO cap there (it butts), Wall 1's end is shaped round the corner", J.joins === 1 && J.w2.indexOf(0) < 0 && J.w1.some((j) => j.k === 1 && j.shaped), J);
    const pl = await ev(() => { const A = H3PushPull.state.M.arch, pc = window.polygonClipping, parts = []; A.rooms.forEach((R) => { PPArch.wallQuads(R).forEach((q) => parts.push([q.quad.concat([q.quad[0]])])); PPArch.joints(R).forEach((j) => parts.push([j.poly.concat([j.poly[0]])])); });
      const U = pc.union.apply(null, parts), rg = U[0][0].slice(0, -1); return { n: U.length, holes: U[0].length, c: rg.filter((b, i) => { const a = rg[(i - 1 + rg.length) % rg.length], c = rg[(i + 1) % rg.length]; return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-9; }).length }; });
    check("…the two walls make ONE clean outline - 6 corners, no notch (shaped like one wall drawn round the corner)", pl.n === 1 && pl.holes === 1 && pl.c === 6, pl);
    // a room, and a wall across it from wall to wall
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); const R = PPArch.addRoom(S.M.arch, PPArch.rectPts([0, 3], [5, 6]), true, { t: 0.3 }); R.t = 0.3; H3PushPull.commit("room", b0); });
    await p.waitForTimeout(300);
    await ev(() => H3PushPull.state.T.use("wall")); await p.waitForTimeout(200);
    await click(2.5, 3.02); await finish(2.5, 5.98);
    const Pq = await ev(() => { const A = H3PushPull.state.M.arch, W = A.rooms[A.rooms.length - 1]; return { pts: W.pts, quad: PPArch.wallQuads(W)[0].quad.map((q) => q.map((v) => Math.round(v * 1000) / 1000)), caps: PPArch.joints(W).length }; });
    check("a wall across the room from wall to wall: its ends on the walls' lines, cut to the INSIDE faces (y 3.15 / 5.85), no caps into the walls", Pq.caps === 0 && Pq.quad.every((q) => q[1] === 3.15 || q[1] === 5.85), Pq);
    // a picked wall's thickness = the next wall's
    await ev(() => { const S = H3PushPull.state, A = S.M.arch; S.T.use("select"); S.T.arch.setSel({ ak: "room", id: A.rooms[0].id }); }); await p.waitForTimeout(300);
    await typeThick(0.25); await p.waitForTimeout(300);
    await ev(() => H3PushPull.state.T.use("wall")); await p.waitForTimeout(200);
    const t2 = await thick();
    await click(7, 0); await finish(7, 2);
    const t3 = await ev(() => { const A = H3PushPull.state.M.arch; return [A.rooms[0].t, A.rooms[A.rooms.length - 1].t]; });
    check("a picked wall set to 0.25 m: the Wall tool's thickness is 0.25 m now, and the next wall drawn is 0.25 m", t2 === 0.25 && t3[0] === 0.25 && t3[1] === 0.25, { t2, t3 });
    const kept = await ev(() => JSON.parse(localStorage.getItem("pp.archopt")).wall.t);
    check("…kept for next time (the Room tool's too)", kept === 0.25 && JSON.parse(await ev(() => localStorage.getItem("pp.archopt"))).room.t === 0.25, kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
