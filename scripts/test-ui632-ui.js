#!/usr/bin/env node
/* bitGen Studio — 2.632.0 in a REAL browser: THE SKETCHER'S CAMERAS - PICKED (EVEN INSIDE A ROOM), MOVED, TURNED; Esc / A
 * DOUBLE-CLICK ON EMPTY SPACE DESELECT EVERYTHING.
 * Tim: "please check the camera select move rotate and deselect, double clicking on empty space or esc should deselect everything"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.632.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_camsel632_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const st = () => ev(() => ({ tool: H3PushPull.state.T.name(), asel: H3PushPull.state.T.arch.sel(), msel: H3PushPull.state.sel, cam: H3PushPull.state.M.arch.cams[0] }));
    const empty = () => ev(() => { const c = H3PushPull.state.V.canvas.getBoundingClientRect(); return [c.left + 15, c.top + c.height - 15]; });
    const none = (s) => !s.asel && !s.msel.f.length && !s.msel.e.length && !s.msel.k.length && !(s.msel.p || []).length;
    // a closed room (ceiling + roof) with a camera inside it, a box beside it
    await ev(() => { const S = H3PushPull.state, M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([8, 0, 0], [9, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1);
      M.arch = PPArch.empty(); const R = PPArch.addRoom(M.arch, [[0, 0], [6, 0], [6, 4], [0, 4]]); PPArch.addRoof(M.arch, [R.id], { type: "hip" }); M.arch.cams.push({ id: 50, name: "Camera 1", x: 2, y: 2, z: 1.6, yaw: 0, pitch: 0, fov: 60 }); M.arch.n = 60;
      S.M = M; S.V.setModel(M); S.A.rebuild(); S.V.view("iso"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(300);
    let [x, y] = await scr([2, 2, 1.6]); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(200);
    let s = await st();
    check("a camera inside a room (under its ceiling + roof) is picked by a click - not the room (it is drawn over everything)", s.asel && s.asel.ak === "cam" && s.asel.id === 50, s.asel);
    [x, y] = await scr([2, 2, 1.6]);                                   // the panel opened: the view is narrower now
    const [x2, y2] = await scr([3, 2.5, 1.6]); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move((x + x2) / 2, (y + y2) / 2, { steps: 5 }); await p.mouse.move(x2, y2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    s = await st(); s.msg = await ev(() => document.getElementById("ppMsg").textContent); s.room = await ev(() => H3PushPull.state.M.arch.rooms[0].pts[0]);
    check("…dragged: it moves (the room stays)", near(s.cam.x, 3, 0.05) && near(s.cam.y, 2.5, 0.05) && s.asel && s.asel.ak === "cam" && await ev(() => H3PushPull.state.M.arch.rooms[0].pts[0][0] === 0), s);
    await p.keyboard.press("r"); await p.waitForTimeout(100); await p.keyboard.press("r"); await p.waitForTimeout(100);
    const y1 = (await st()).cam.yaw;
    await p.keyboard.press("Shift+R"); await p.waitForTimeout(150);
    const y2b = (await st()).cam.yaw;
    check("…R turns it 15° (twice = 30°), Shift+R back 15°", y1 === 30 && y2b === 15, { y1, y2b });
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    s = await st();
    check("Esc: nothing picked", none(s), s);
    // a model face + then Esc; an edge + Esc
    [x, y] = await scr([8.5, 0.5, 1]); await p.mouse.click(x, y); await p.waitForTimeout(150);
    const f1 = (await st()).msel.f.length;
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    check("a face picked + Esc: nothing picked", f1 === 1 && none(await st()), f1);
    // double-click on empty space after picking the camera
    [x, y] = await scr([3, 2.5, 1.6]); await p.mouse.click(x, y); await p.waitForTimeout(150);
    const was = (await st()).asel;
    const [ex, ey] = await empty(); await p.mouse.dblclick(ex, ey); await p.waitForTimeout(250);
    s = await st();
    check("the camera picked + a double-click on empty space: nothing picked (and the Orbit tool)", was && was.ak === "cam" && none(s) && s.tool === "orbit", { was, s });
    // Esc with a Build tool going: first deselects, then Select
    await ev(() => { const S = H3PushPull.state; S.T.use("camera"); S.T.arch.setSel({ ak: "cam", id: 50 }); });
    await p.keyboard.press("Escape"); await p.waitForTimeout(120);
    const s1 = await st();
    await p.keyboard.press("Escape"); await p.waitForTimeout(120);
    const s2 = await st();
    check("Esc with a Build tool (📷 Camera) and a camera picked: nothing picked, then ⬚ Select", !s1.asel && s1.tool === "camera" && s2.tool === "select", { s1: { t: s1.tool, a: s1.asel }, s2: s2.tool });
    // 2.632.0 (Tim: "when in orbit mode use orbit icon not a hand")
    const cur = await ev(() => { const S = H3PushPull.state; S.T.use("orbit"); const o = getComputedStyle(S.V.canvas).cursor; S.T.use("pan"); const pn = getComputedStyle(S.V.canvas).cursor; S.T.use("select"); return { o, pn }; });
    check("🔄 Orbit: the pointer is an orbit cursor (two arrows round a dot), not the hand (✋ Pan keeps the hand)", /data:image\/svg\+xml/.test(cur.o) && !/grab/.test(cur.o) && /grab/.test(cur.pn), cur.o.slice(0, 60) + " | " + cur.pn);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (H3PushPullFrame.maxed()) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
