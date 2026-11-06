#!/usr/bin/env node
/* bitGen Studio — 2.663.0 in a REAL browser: SPLIT A WALL (double-click, 3D + floorplan), A PIECE MOVED OUT (new walls join it
 * to the room) / TAKEN OUT, THE WALL TOOL STARTING ON A ROOM'S WALL, A CLICKED FACE = THE SKETCH PLANE (a rectangle drawn in a
 * wall's plane) + ⊥ LOOK AT.
 * Tim (verbatim): "when user clicks a face, make that the sketch plane, add a look at button like fusion 360 has ... the wall
 * tool walls can start and finish from the room walls anywhere along the wall or snap to an edge the user created when double
 * clicking. allow user to select segments of the wall after a split(dbl click) and delete / move the selected wall, if user
 * moves the segment add walls on each side of the segment and join to the main room - this will work in floorplan and 3d mode"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.663.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_split663_" + process.pid;
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPSketchPlane && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV && H3PushPull.state.M && document.getElementById("ppLookAt"), null, { timeout: 40000 });
    const reset = () => ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      PPArch.addRoom(A, PPArch.rectPts([0, 0], [6, 4]), true); H3PushPull.commit("rooms", b0); S.T.use("select"); S.V.view("top"); S.V.extents(); });
    await reset(); await p.waitForTimeout(300);
    const scr = (x, y, z) => ev(([x, y, z]) => { const S = H3PushPull.state, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]);
    const pts = () => ev(() => H3PushPull.state.M.arch.rooms[0].pts.map((p) => p.map((v) => +v.toFixed(2))));
    // split twice from above (the south wall at x = 2 and x = 4) - the wall picked first (its panel opens: the view settles)
    { const c0 = await scr(1, 0, 2.7); await p.mouse.click(c0[0], c0[1]); await p.waitForTimeout(400); }
    for (const x of [2, 4]) { const c = await scr(x, 0, 2.7); await p.mouse.dblclick(c[0], c[1]); await p.waitForTimeout(350); }
    const s1 = await pts(), m1 = await ev(() => document.getElementById("ppMsg").textContent);
    check("double-click the wall (from above) twice: split at x = 2 and x = 4 - the south wall three pieces, said so", s1.length === 6 && Math.abs(s1[1][0] - 2) < 0.06 && Math.abs(s1[2][0] - 4) < 0.06 && s1[1][1] === 0 && s1[2][1] === 0 && /split in two/.test(m1), { s1, m1 });
    // pick the middle piece and drag it out (south) by 1 m
    let mid = await scr(3, 0, 2.7); await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(400);
    mid = await scr(3, 0, 2.7); const out = await scr(3, -1, 2.7);
    await p.mouse.move(mid[0], mid[1]); await p.mouse.down(); await p.mouse.move(mid[0], mid[1] + 8, { steps: 3 }); await p.mouse.move(out[0], out[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const s2 = await pts(), sel2 = await ev(() => H3PushPull.state.T.arch.sel());
    check("the middle piece dragged out 1 m: a new wall each side joins it to the room (a bay), still picked", s2.length === 8 && s2[1][0] === s2[2][0] && s2[3][0] === s2[4][0] && s2[2][1] === s2[3][1] && s2[2][1] < -0.7 && s2[2][1] > -1.4 && s2[1][1] === 0 && s2[4][1] === 0 && sel2 && sel2.part === "wall" && sel2.edge === 2, { s2, sel2 });
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("↶: the bay back to the straight split wall", JSON.stringify(await pts()) === JSON.stringify(s1));
    // pick the middle piece, Delete: just it out
    await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(400); mid = await scr(3, 0, 2.7); await p.mouse.click(mid[0], mid[1]); await p.waitForTimeout(300);
    await ev(() => document.getElementById("ppView").focus()); await p.keyboard.press("Delete"); await p.waitForTimeout(300);
    const g = await ev(() => H3PushPull.state.M.arch.rooms[0].gone);
    check("the middle piece picked + Delete: only it taken out (an opening 2 m wide)", JSON.stringify(g) === "[1]", g);
    // the floorplan: split there too
    await reset(); await p.waitForTimeout(200);
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    const pc = await scr(0, 2, 0); await p.mouse.dblclick(pc[0], pc[1]); await p.waitForTimeout(350);
    const fp = await pts();   // 2.696.0: where clicked, to the pixel (the bar's height changes the view's scale) - within 2 cm
    check("📐 the floorplan: double-click a wall splits it too (at the point clicked, within 2 cm)", fp.length === 5 && JSON.stringify(fp.slice(0, 4)) === "[[0,0],[6,0],[6,4],[0,4]]" && fp[4][0] === 0 && Math.abs(fp[4][1] - 2) <= 0.02, fp);
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(300);
    // the Wall tool: starts on the room's wall anywhere along it
    await ev(() => { const S = H3PushPull.state; S.T.use("wall"); S.V.view("top"); S.V.extents(); }); await p.waitForTimeout(200);
    await p.waitForTimeout(300); const w0 = await scr(3.03, 4.02, 2.7);
    await p.mouse.move(w0[0], w0[1]); await p.waitForTimeout(100); await p.mouse.click(w0[0], w0[1]); await p.waitForTimeout(250); const w1 = await scr(3, 1.5, 0);
    await p.mouse.move(w1[0], w1[1], { steps: 4 }); await p.mouse.click(w1[0], w1[1]); await p.waitForTimeout(250); await p.mouse.dblclick(w1[0], w1[1]); await p.waitForTimeout(400);
    const nw = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[1]; return R && R.pts.map((p) => p.map((v) => +v.toFixed(3))); });
    check("✏ the Wall tool: its start caught on the room's wall line (y = 4 exactly, where pointed along it); seen from above its next point is where pointed (not caught on the up axis)", nw && nw[0][1] === 4 && Math.abs(nw[0][0] - 3.03) < 0.06 && Math.abs(nw[1][1] - 1.5) < 0.1, { nw, msg: await ev(() => document.getElementById("ppMsg").textContent), n: await ev(() => H3PushPull.state.M.arch.rooms.length) });
    // the corner piece: a click picks it, its width
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.V.view("top"); S.V.extents(); }); await p.waitForTimeout(250);
    let cc = await scr(6.04, -0.04, 2.7); await p.mouse.click(cc[0], cc[1]); await p.waitForTimeout(300);
    const js = await ev(() => ({ sel: H3PushPull.state.T.arch.sel(), head: (document.querySelector("#ppProps .pph") || {}).textContent }));
    check("▪ a click on the room's corner picks the corner piece (its own panel)", js.sel && js.sel.ak === "joint" && js.sel.k === 1 && /^▪ Corner of Wall 1 \+ Wall 2 · Room 1$/.test(js.head), js);
    await setNum("Width (a pier round the corner) (m)", 0.5); await p.waitForTimeout(300);
    const jw = await ev(() => { const R = H3PushPull.state.M.arch.rooms[0], j = PPArch.joints(R).find((x) => x.k === 1); return { jw: R.jw, maxx: Math.max(...j.poly.map((q) => q[0])) }; });
    check("…Width 0.5 m: a pier round the corner (kept on the room, the piece 25 cm each way)", jw.jw[1] && jw.jw[1].w === 0.5 && Math.abs(jw.maxx - 6.25) < 1e-6, jw);
    await ev(() => document.getElementById("ppView").focus()); await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    check("…Delete: back to the wall's own size", await ev(() => !H3PushPull.state.M.arch.rooms[0].jw[1]));
    // a face clicked = the sketch plane, ⊥ Look at
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(300);
    const f = await scr(1, 0, 1.2); await p.mouse.click(f[0], f[1]); await p.waitForTimeout(250);
    const sp = await ev(() => { const s = PPSketchPlane.get(); return s && { n: s.n.map((v) => +v.toFixed(3)), chip: document.getElementById("ppPlaneChip").textContent, shown: getComputedStyle(document.getElementById("ppPlaneChip")).display }; });
    check("➤ a wall's outside face clicked: the sketch plane (facing -y), the chip names it", sp && sp.n[1] === -1 && sp.shown !== "none" && /✎/.test(sp.chip), sp);
    await ev(() => document.getElementById("ppLookAt").click()); await p.waitForTimeout(300);
    const cam = await ev(() => { const c = H3PushPull.state.V.cam(), t = H3PushPull.state.V.state ? null : null; const d = [c.position.x, c.position.y, c.position.z]; return d; });
    const look = await ev(() => { const S = H3PushPull.state, c = S.V.cam(), q = PPSketchPlane.get().p; const d = [c.position.x - q[0], c.position.y - q[1], c.position.z - q[2]], L = Math.hypot(...d); return d.map((v) => +(v / L).toFixed(3)); });
    check("⊥ Look at: the view straight at it (from -y)", look[1] < -0.99, { look, cam });
    // ▭ a rectangle drawn in the wall's plane
    await ev(() => H3PushPull.state.T.use("rect")); await p.waitForTimeout(100);
    const r0 = await scr(1.5, -0.075, 0.5), r1 = await scr(2.5, -0.075, 1.5);
    await p.mouse.click(r0[0], r0[1]); await p.waitForTimeout(100); await p.mouse.click(r1[0], r1[1]); await p.waitForTimeout(300);
    const face = await ev(() => { const M = H3PushPull.state.M; return M.v.length >= 4 ? M.v.slice(-4).map((v) => [+v[0].toFixed(2), +v[1].toFixed(2), +v[2].toFixed(2)]) : M.v; });
    check("▭ Rectangle: drawn in the sketch plane (upright on the wall's face, every corner at the same y)", Array.isArray(face) && face.length === 4 && face.every((v) => Math.abs(v[1] - face[0][1]) < 0.01) && Math.max(...face.map((v) => v[2])) - Math.min(...face.map((v) => v[2])) > 0.5, face);
    await ev(() => { H3PushPull.state.T.use("select"); }); await ev(() => document.getElementById("ppPlaneOff").click()); await p.waitForTimeout(150);
    check("✕ ends the sketch plane", await ev(() => !PPSketchPlane.get() && getComputedStyle(document.getElementById("ppPlaneChip")).display === "none"));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
