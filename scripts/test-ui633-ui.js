#!/usr/bin/env node
/* bitGen Studio — 2.633.0 in a REAL browser: THE SKETCHER'S ROTATE RINGS (YAW / PITCH / ROLL) FOR CAMERAS AND FURNITURE, THEIR
 * INPUTS, A CAMERA'S LENS (FISHEYE … 200 mm), FOCAL LENGTH AND FIELD OF VIEW.
 * Tim: "can you add interactive rotate , roll,yaw,pitch for camera and furniture, add the inputs to it's properties, include fov ,
 * lense, 35mm,50mm,200mm, fisheye,wide angle etc."
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.633.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_rot633_" + process.pid;
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
    const panelSet = (label, v) => ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith(label)); if (!r) return false; const i = r.querySelector("input, select"); i.value = v; i.dispatchEvent(new Event("change")); return true; }, [label, v]);
    const cam = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.cams[0])));
    const item = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.items[0])));
    await ev(() => { const S = H3PushPull.state, A = PPArch.empty(); A.cams.push({ id: 50, name: "Camera 1", x: 2, y: 2, z: 1.6, yaw: 0, pitch: 0, roll: 0, fov: 60 });
      A.items.push(Object.assign(PPFurn.make("armchair", [5, 2], 0, 0), { id: 51 })); A.n = 60; S.M.arch = A; S.V.setModel(S.M); S.A.rebuild(); S.V.view("top"); S.V.extents(); S.T.use("select"); S.T.arch.setSel({ ak: "cam", id: 50 }); });
    await p.waitForTimeout(300);
    /* the inputs */
    const pn = await ev(() => document.getElementById("ppProps").textContent);
    const lenses = await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith("Lens")); return r ? [...r.querySelector("select").options].map((o) => o.textContent) : []; });
    check("a camera's panel: Turn (yaw), Tilt (pitch), Roll, Lens (Fisheye, Ultra wide, Wide angle, 35 mm, 50 mm, 85 mm, 135 mm, 200 mm, Custom), Focal length, Field of view",
      /Turn \(yaw\)/.test(pn) && /Tilt \(pitch\)/.test(pn) && /Roll/.test(pn) && /Focal length/.test(pn) && /Field of view/.test(pn) && ["Fisheye (8 mm)", "Wide angle (24 mm)", "35 mm", "50 mm (normal)", "200 mm (telephoto)", "Custom"].every((x) => lenses.includes(x)), { pn: pn.slice(0, 300), lenses });
    await panelSet("Lens", "200"); await p.waitForTimeout(150);
    let c = await cam();
    const f200 = c.fov;
    await panelSet("Lens", "fisheye"); await p.waitForTimeout(150); c = await cam(); const ffish = c.fov;
    await panelSet("Focal length", "35"); await p.waitForTimeout(150); c = await cam(); const f35 = c.fov;
    await panelSet("Field of view", "27"); await p.waitForTimeout(150);
    const mmIn = await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith("Focal length")); return +r.querySelector("input").value; });
    check("Lens 200 mm = 6.9° field of view; Fisheye = 112.6°; Focal length 35 mm = 37.8°; Field of view 27° = 50 mm (full frame)", f200 === 6.9 && ffish === 112.6 && f35 === 37.8 && near(mmIn, 50, 0.6), { f200, ffish, f35, mmIn });
    await panelSet("Roll", "20"); await p.waitForTimeout(150);
    c = await cam();
    check("Roll 20°: kept on the camera (its glyph turns with it)", c.roll === 20, c);
    /* the rings: drag the yaw ring a quarter round (top view) */
    await ev(() => H3PushPull.state.T.arch.setSel({ ak: "cam", id: 50 }));
    await p.waitForTimeout(150);
    const ringsShown = await ev(() => { let n = 0; H3PushPull.state.V.scene.traverse((o) => { if (o.userData && o.userData.ring) n++; }); return n; });
    const R0 = await ev(() => PPCam.rings("cam", H3PushPull.state.M.arch.cams[0]));
    const yawRing = R0.rings.find((r) => r.key === "yaw");
    const pA = await scr(yawRing.pts[6]), pB = await scr(yawRing.pts[18]), pC = await scr(yawRing.pts[30]);
    await p.mouse.move(pA[0], pA[1]); await p.mouse.down(); await p.mouse.move(pB[0], pB[1], { steps: 8 }); await p.mouse.move(pC[0], pC[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    c = await cam();
    check("zoom extents takes the cameras in too; a picked camera shows 3 rings (yaw / pitch / roll); dragging round the yaw ring half way turns it 180°", ringsShown === 3 && near(Math.abs(((c.yaw - 0 + 540) % 360) - 180), 180, 6), { ringsShown, c });
    /* a piece of furniture: pitch + roll in its panel and the pitch ring */
    await ev(() => H3PushPull.state.T.arch.setSel({ ak: "item", id: 51 }));
    await p.waitForTimeout(150);
    const ipn = await ev(() => document.getElementById("ppProps").textContent);
    await panelSet("Pitch", "15"); await panelSet("Roll", "-10"); await p.waitForTimeout(150);
    let it = await item();
    const rotZ = await ev(() => { const f = H3PushPull.state.V.scene.getObjectByName("pp-furniture"); const g = f.children.find((x) => x.userData.tag.id === 51); return [g.rotation.x, g.rotation.y, g.rotation.order]; });
    check("a piece's panel: Turn (yaw), Pitch, Roll - 15° / -10° tip it in 3D", /Turn \(yaw\)/.test(ipn) && /Pitch/.test(ipn) && /Roll/.test(ipn) && it.pitch === 15 && it.roll === -10 && near(rotZ[0], 15 * Math.PI / 180) && near(rotZ[1], -10 * Math.PI / 180) && rotZ[2] === "ZXY", { it, rotZ });
    await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(150);
    const R1 = await ev(() => PPCam.rings("item", H3PushPull.state.M.arch.items[0]));
    const yr = R1.rings.find((r) => r.key === "yaw");
    const q0 = await scr(yr.pts[6]), q1 = await scr(yr.pts[12]), q2 = await scr(yr.pts[18]);
    const r0 = it.rot;
    await p.mouse.move(q0[0], q0[1]); await p.mouse.down(); await p.mouse.move(q1[0], q1[1], { steps: 6 }); await p.mouse.move(q2[0], q2[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    it = await item();
    check("…its yaw ring dragged a quarter round: it turns 90° (5° steps); the rest stays", Math.abs(Math.abs(((it.rot - r0 + 540) % 360) - 180) - 90) < 8 && it.pitch === 15 && it.roll === -10, { r0, it });
    // undo takes the turn back
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    it = await item();
    check("Ctrl+Z takes the turn back", it.rot === r0, it);
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
