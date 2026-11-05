#!/usr/bin/env node
/* bitGen Studio — 2.662.0 in a REAL browser: THE SKETCHER'S WALLS END SQUARE + A NEW WALL DRAGGED OUT OF A CORNER / AN END -
 * a picked wall's piece is a rectangle (no mitred point), the corner lights up under the pointer, a drag out of its side
 * draws a new wall that way (one ↶ step), out of the new wall's end another one, from the top any way.
 * Tim (verbatim): "end walls in a square not a triangle when drawing a room , add a segment to the end of each wall so user
 * can drag another wall from any side of the end of walls"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.662.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_joint662_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scrG = (x, y) => ev(([x, y]) => { const S = H3PushPull.state, t = S.M.arch.terrain, z = t ? PPTerrain.at(t, x, y) : 0, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y]);
  const setNum = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === l); const i = r.querySelector("input,select"); i.value = String(v); i.dispatchEvent(new Event("change")); }, [label, v]);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      PPArch.addRoom(A, PPArch.rectPts([0, 0], [4, 3]), true); H3PushPull.commit("rooms", b0); S.T.use("select"); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(300);
    const q = await ev(() => PPArch.wallQuads(H3PushPull.state.M.arch.rooms[0]).find((w) => w.i === 0).quad);
    check("a wall's piece ends square at its corners (a rectangle from corner to corner, no point)", JSON.stringify(q) === JSON.stringify([[0, 0.075], [4, 0.075], [4, -0.075], [0, -0.075]]), q);
    const scr = (x, y, z) => ev(([x, y, z]) => { const S = H3PushPull.state, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]);
    // the outer corner at (4, 0) seen from above: its top (any way)
    const c = await scr(4.04, -0.04, 2.7);
    await p.mouse.move(c[0], c[1]); await p.waitForTimeout(200);
    const hv = await ev(() => ({ cur: H3PushPull.state.V.canvas.style.cursor, msg: document.getElementById("ppMsg").textContent }));
    check("the pointer on the room's outside corner: it lights up, says drag a new wall out", hv.cur === "crosshair" && /drag out of a side for a new wall/.test(hv.msg), hv);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    const to = await scr(7, 0, 0);
    await p.mouse.down(); await p.mouse.move((c[0] + to[0]) / 2, c[1], { steps: 4 }); await p.mouse.move(to[0], to[1], { steps: 6 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(400);
    const w1 = await ev(() => { const S = H3PushPull.state, A = S.M.arch, R = A.rooms[1]; return R && { n: A.rooms.length, closed: R.closed, pts: R.pts.map((p) => p.map((v) => +v.toFixed(2))), t: R.t, h: R.h, undo: S.undo.length, sel: S.T.arch.sel(), msg: document.getElementById("ppMsg").textContent }; });
    check("dragged from the corner's top: a new wall from the corner (4, 0) to where the pointer let go, the room's height / thickness, one ↶ step, picked",
      w1 && w1.n === 2 && w1.closed === false && JSON.stringify(w1.pts[0]) === "[4,0]" && Math.abs(w1.pts[1][0] - 7) < 0.15 && Math.abs(w1.pts[1][1]) < 0.15 && w1.h === 2.7 && w1.undo === u0 + 1 && w1.sel && w1.sel.ak === "room" && /drawn out of Room 1's corner/.test(w1.msg), { w1, u0 });
    // from the side: a perspective view, the end face of the new wall (facing +x) - straight on
    await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(300);
    const end = await ev(() => { const R = H3PushPull.state.M.arch.rooms[1]; return R.pts[1]; });
    const e1 = await ev(([x, y]) => { const S = H3PushPull.state, R = S.M.arch.rooms[1], j = PPArch.joints(R).find((j) => j.kind === "end" && j.k === 1); return { out: j.out, poly: j.poly }; }, end);
    check("the new wall's far end has its end piece (a square cap facing on)", e1 && Math.abs(e1.out[0] - 1) < 0.05, e1);
    // its end face: press a little in from the cap's outer face, half way up, drag on along x
    const ef = await scr(end[0] + 0.075, end[1] + 0.02, 1.2);
    const hit = await ev(([x, y]) => { const S = H3PushPull.state, el = S.V.canvas, r = el.getBoundingClientRect(); const h = S.A.pick({ clientX: x, clientY: y }); return h && { n: h.n, p: h.point, tag: h.tag }; }, ef);
    const far = await scr(end[0] + 2, end[1], 0);
    await p.mouse.move(ef[0], ef[1]); await p.waitForTimeout(150); await p.mouse.down(); await p.mouse.move(ef[0] + 10, ef[1], { steps: 3 }); await p.mouse.move(far[0], far[1], { steps: 8 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(400);
    const w2 = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[2]; return { n: A.rooms.length, pts: R && R.pts.map((p) => p.map((v) => +v.toFixed(2))) }; });
    check("…out of the new wall's end face: another wall on along its line (only along that side's way)", w2.n === 3 && Math.abs(w2.pts[0][0] - end[0]) < 1e-6 && Math.abs(w2.pts[1][1] - end[1]) < 1e-6 && w2.pts[1][0] > end[0] + 0.5, { w2, end, hit });
    if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, "joint662.png") });
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(250);
    check("↶ takes the last one back", await ev(() => H3PushPull.state.M.arch.rooms.length === 2));
    // a press on the wall itself (not its corner) still picks / moves the wall
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); }); await p.waitForTimeout(250);
    const mid = await scr(2, 0, 2.7); await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(250);
    const sl = await ev(() => H3PushPull.state.T.arch.sel());
    check("a click on the wall away from its corners still picks that wall", sl && sl.ak === "room" && sl.part === "wall" && sl.edge === 0, sl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
