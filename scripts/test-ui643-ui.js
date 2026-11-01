#!/usr/bin/env node
/* bitGen Studio — 2.643.0 in a REAL browser: THE SKETCHER'S CAMERA MOVED / TURNED WHILE LOOKING THROUGH IT.
 * Tim (verbatim): "if user selects the camera and is in camera view, when user clicks rotate or move in properties the show the
 * right transform widget and let the user move or rotate the camera with the widget, esc deselects the camera".
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.643.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_camview643_" + process.pid;
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
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1], s[2]]; }, w);
    const cam = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.cams[0])));
    const drawn = () => ev(() => { let axis = 0, ring = 0; H3PushPull.state.V.scene.traverse((o) => { if (o.userData && o.userData.axis) axis++; if (o.userData && o.userData.ring) ring++; }); return { axis, ring, gizmo: H3PushPull.state.T.arch.gizmo(), through: H3PushPull.state.T.arch.through() }; });
    const btn = (re) => ev((src) => { const b0 = [...document.querySelectorAll("#ppProps .ppbtns button")].find((x) => new RegExp(src).test(x.textContent)); if (b0) b0.click(); return !!b0; }, re.source);
    await ev(() => { const S = H3PushPull.state, M = PPGeo.newModel();
      M.arch = PPArch.empty(); PPArch.addRoom(M.arch, [[0, 0], [8, 0], [8, 6], [0, 6]]); M.arch.cams.push({ id: 50, name: "Camera 1", x: 1.5, y: 3, z: 1.6, yaw: 0, pitch: 0, fov: 60 }); M.arch.n = 60;
      S.M = M; S.V.setModel(M); S.A.rebuild(); S.V.view("iso"); S.V.extents(); S.T.use("select"); S.T.arch.setSel({ ak: "cam", id: 50 }); });
    await p.waitForTimeout(300);
    check("the camera picked, its panel has 👁 Look through, ✥ Move and ⟳ Rotate", await ev(() => ["👁 Look through", "✥ Move", "⟳ Rotate"].every((t) => [...document.querySelectorAll("#ppProps .ppbtns button")].some((x) => x.textContent.startsWith(t)))));
    await btn(/^👁 Look through/); await p.waitForTimeout(300);
    let d = await drawn();
    check("👁 Look through: the view is the camera's (the camera still picked)", d.through === 50 && (await ev(() => H3PushPull.state.T.arch.sel())).ak === "cam", d);

    // ✥ Move while looking through it: the arrows IN FRONT of the view (not in the eye)
    await btn(/^✥ Move/); await p.waitForTimeout(250);
    let c = await cam(); const W = await ev((c) => PPCam.widgetAt(c), c);
    const ctr = await scr(W.c), view = await ev(() => { const r = H3PushPull.state.V.canvas.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    d = await drawn();
    check("✥ Move in camera view: the move arrows shown in front of the view (on screen), still looking through it", d.axis === 6 && d.ring === 0 && d.through === 50 && ctr[2] < 1 && ctr[0] > view[0] && ctr[0] < view[2] && ctr[1] > view[1] && ctr[1] < view[3], { d, ctr, view });
    // drag the green Y arrow: the camera moves along Y (the view goes with it)
    const ya = await scr(W.c.map((v, k) => v + [0, 1, 0][k] * 0.3)), yb = await scr(W.c.map((v, k) => v + [0, 1, 0][k] * 0.42));
    await p.mouse.move(ya[0], ya[1], { steps: 2 }); await p.waitForTimeout(100);
    const hotY = await ev(() => H3PushPull.state.A.axisHot);
    await p.mouse.down(); await p.mouse.move(ya[0] + (yb[0] - ya[0]) * 6, ya[1] + (yb[1] - ya[1]) * 6, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
    const c2 = await cam(), vp = await ev(() => H3PushPull.state.V.cam().position.toArray());
    check("…the Y arrow (lit under the pointer) dragged: the camera moves along Y only, the view moves with it", hotY === "y" && c2.y > c.y + 0.2 && near(c2.x, c.x) && near(c2.z, c.z) && near(vp[1], c2.y, 0.01) && (await drawn()).through === 50, { hotY, c, c2, vp });
    // ⟳ Rotate: the rings in front; the blue (turn) ring dragged round turns it - and the view
    await btn(/^⟳ Rotate/); await p.waitForTimeout(250);
    d = await drawn();
    check("⟳ Rotate in camera view: the rotate rings in front of the view, the arrows gone", d.ring === 3 && d.axis === 0 && d.through === 50, d);
    c = await cam();
    const R = await ev((c) => PPCam.rings("cam", c, PPCam.widgetAt(c)), c), yaw = R.rings.find((r) => r.key === "yaw");
    const pts = []; for (const i of [12, 14, 16, 18, 20]) pts.push(await scr(yaw.pts[i]));    // the near half of the ring (below the eye: an open ellipse)
    await p.mouse.move(pts[0][0], pts[0][1], { steps: 2 }); await p.mouse.down();
    for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(300);
    const c3 = await cam(), look = await ev(() => { const V = H3PushPull.state.V, t = V.controls.target, q = V.cam().position; return Math.atan2(-(t.y - q.y), t.x - q.x) * 180 / Math.PI; });
    const turned = Math.abs((((c3.yaw - c.yaw) % 360) + 540) % 360 - 180);
    check("…the turn ring dragged round: the camera turns (yaw), the view looks its new way", turned >= 10 && near(((look % 360) + 360) % 360, c3.yaw, 1.5) && (await drawn()).through === 50, { yaw0: c.yaw, yaw1: c3.yaw, look });
    // Esc: the camera unpicked (the docker stays maximized)
    await ev(() => H3PushPull.state.V.canvas.focus()); await p.mouse.move(view[0] + 30, view[3] - 30);
    await p.keyboard.press("Escape"); await p.waitForTimeout(250);
    const e1 = await ev(() => ({ sel: H3PushPull.state.T.arch.sel(), maxed: H3PushPullFrame.maxed() }));
    d = await drawn();
    check("Esc deselects the camera - no widget; the Sketcher stays maximized", !e1.sel && d.axis === 0 && d.ring === 0 && e1.maxed, { e1, d });
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
