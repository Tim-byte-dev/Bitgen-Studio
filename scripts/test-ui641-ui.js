#!/usr/bin/env node
/* bitGen Studio — 2.641.0 in a REAL browser: THE SKETCHER'S CAMERA PICKED, MOVED AND TURNED.
 * Tim (verbatim): "dont show camera bounding box, single click on camera selects camera ,click and drag on the camera moves the
 * camera show 3d move widget , double click changes to 3d rotate widget, clicking on ANOTHER object deselects the camera and
 * selects the new object". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.641.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_camwidget641_" + process.pid;
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
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const sel = () => ev(() => H3PushPull.state.T.arch.sel());
    const cam = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.cams[0])));
    // what the view draws for the pick: outline boxes (render order 12), move arrows, rotate rings; the camera body's colour
    const drawn = () => ev(() => { let box = 0, axis = 0, ring = 0; H3PushPull.state.V.scene.traverse((o) => { if (o.userData && o.userData.axis) axis++; else if (o.userData && o.userData.ring) ring++; else if (o.isLineSegments && o.renderOrder === 12) box++; });
      let body = null; H3PushPull.state.V.scene.traverse((o) => { if (o.userData && o.userData.camBody) body = "#" + o.material.color.getHexString(); });
      return { box, axis, ring, body, gizmo: H3PushPull.state.T.arch.gizmo() }; });
    await ev(() => { const S = H3PushPull.state, M = PPGeo.newModel();
      M.arch = PPArch.empty(); PPArch.addRoom(M.arch, [[0, 0], [6, 0], [6, 4], [0, 4]]); M.arch.cams.push({ id: 50, name: "Camera 1", x: 2, y: 2, z: 1.6, yaw: 0, pitch: 0, fov: 60 }); M.arch.n = 60;
      S.M = M; S.V.setModel(M); S.A.rebuild(); S.A.cut(true); S.V.view("iso"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(300);
    const blue = (await drawn()).body;

    // a single click on the camera: picked, lit, the MOVE arrows, no bounding box
    let [x, y] = await scr([2, 2, 1.6]); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(250);
    let s = await sel(), d = await drawn();
    check("a single click on the camera picks it", s && s.ak === "cam" && s.id === 50, s);
    check("…no bounding box round it - the camera itself lights up (not its usual blue)", d.box === 0 && d.body !== blue, { d, blue });
    check("…the 3D move widget: three arrows (X / Y / Z, line + tip each), no rotate rings", d.axis === 6 && d.ring === 0 && d.gizmo === "move", d);

    // click + drag on the camera: it moves (on its own height), the move widget stays
    [x, y] = await scr([2, 2, 1.6]); let [x2, y2] = await scr([3, 2.5, 1.6]);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move((x + x2) / 2, (y + y2) / 2, { steps: 5 }); await p.mouse.move(x2, y2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
    let c = await cam(); d = await drawn();
    check("click + drag on the camera moves it (x 3, y 2.5 - its height kept), still picked, the move arrows with it", near(c.x, 3, 0.06) && near(c.y, 2.5, 0.06) && near(c.z, 1.6) && (await sel()).ak === "cam" && d.axis === 6, { c, d });
    // the Z arrow: up only
    const tip = await scr([c.x, c.y, c.z + 0.45]), up = await scr([c.x, c.y, c.z + 0.95]);
    await p.mouse.move(tip[0], tip[1], { steps: 2 }); await p.waitForTimeout(100);
    const hot = await ev(() => H3PushPull.state.A.axisHot);
    await p.mouse.down(); await p.mouse.move(up[0], up[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
    const c2 = await cam();
    check("the blue Z arrow (lit yellow under the pointer) drags the camera straight up (x, y kept, 1 cm steps)", hot === "z" && near(c2.x, c.x) && near(c2.y, c.y) && near(c2.z, 2.1, 0.08) && near(c2.z * 100, Math.round(c2.z * 100), 1e-6), { hot, c, c2 });
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z puts it back down", near((await cam()).z, 1.6));

    // a double-click on the camera: the ROTATE widget; again: the move arrows
    c = await cam(); [x, y] = await scr([c.x, c.y, c.z]);
    await p.mouse.dblclick(x, y); await p.waitForTimeout(250);
    d = await drawn(); s = await sel();
    check("a double-click on the camera: the 3D rotate widget (3 rings), the arrows gone, still picked", d.ring === 3 && d.axis === 0 && d.gizmo === "rotate" && s && s.ak === "cam", { d, s });
    await p.mouse.dblclick(x, y); await p.waitForTimeout(250);
    d = await drawn();
    check("…double-click again: the move arrows back", d.axis === 6 && d.ring === 0 && d.gizmo === "move", d);
    await p.mouse.dblclick(x, y); await p.waitForTimeout(250);                 // rotate again for the next step

    // clicking ANOTHER object: the camera unpicked, that one picked
    const [fx, fy] = await scr([5.2, 3.3, 0]); await p.mouse.click(fx, fy); await p.waitForTimeout(250);
    s = await sel(); d = await drawn();
    check("a click on another object (the floor): it is picked - the camera is not (no arrows / rings, back to blue)", s && s.ak === "room" && d.axis === 0 && d.ring === 0 && d.body === blue, { s, d });
    // the camera's frustum lines no longer take a click meant for what is near them
    c = await cam(); const [nx, ny] = await scr([c.x + 0.45, c.y + 0.2, c.z]);
    await ev(() => H3PushPull.state.T.arch.setSel(null));
    await p.mouse.click(nx, ny); await p.waitForTimeout(250);
    s = await sel();
    check("a click just beside the camera's lines (not on the camera) picks what is there, not the camera", !s || s.ak !== "cam", s);
    // picked again after another object: the move arrows (not the rotate rings it had)
    [x, y] = await scr([c.x, c.y, c.z]); await p.mouse.click(x, y); await p.waitForTimeout(250);
    d = await drawn();
    check("picked again: the move widget (another object picked in between reset it)", (await sel()).ak === "cam" && d.axis === 6 && d.ring === 0, d);
    // the panel's buttons
    await ev(() => [...document.querySelectorAll("#ppProps .ppbtns button")].find((b0) => b0.textContent.startsWith("⟳ Rotate")).click()); await p.waitForTimeout(200);
    check("the camera's panel: ⟳ Rotate shows the rings (✥ Move the arrows)", (await drawn()).ring === 3);
    // Esc: nothing picked
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc: nothing picked, the widget gone", !(await sel()) && (await drawn()).ring === 0 && (await drawn()).axis === 0);
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
