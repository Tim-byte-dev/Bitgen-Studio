#!/usr/bin/env node
/* bitGen Studio — 2.475.0 in a REAL browser: THE UNREAL CAMERA in the image editor (pcuecam.js) + the timeline camera's
 * lens, against scripts/ue-stub.js (a stand-in for the Unreal Editor + the bitGen Bridge plugin).
 * Tim (verbatim): "add the unreal camera to image editor allow user to move the camera in the scene to change camera
 * angles, roll, pitch and yaw. add a properties docker for the unreal camera, lens, f-stop, exposure, fov and camera presets"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Unreal camera browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(60000);
  const STUB = await require("./ue-stub.js").start(0);
  let port0 = 30020;
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.ueCam && window.TlUnreal && window.UEBridge, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    port0 = (await ev(() => fetch("/api/unreal/settings").then((r) => r.json()))).port;
    await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port, alphaInverted: false }) }), STUB.port);
    const stills = () => STUB.calls.filter((c) => c.cmd === "still");
    const ue = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return L && L.smart && L.smart.ue ? JSON.parse(JSON.stringify({ ue: L.smart.ue, w: L.smart.w, undo: E.S.undo.length, tool: E.S.tool })) : null; });
    const idle = async () => { for (let i = 0; i < 60; i++) { await p.waitForTimeout(120); if (!(await ev(() => window.imageEditorInstance.E.unreal.busy() || window.imageEditorInstance.E.ueCam.preview()))) break; } await p.waitForTimeout(150); };
    // an Unreal layer through CineCam_Wide
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="unreal"]'); await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_scene"]'); await p.waitForTimeout(700);
    await p.selectOption(".kxdlg.pcd #ueCam", "CineCam_Wide"); await p.fill(".kxdlg.pcd #ueW", "320"); await p.fill(".kxdlg.pcd #ueH", "180"); await p.click(".kxdlg.pcd .ok"); await idle();
    let s0 = await ue();
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_cam"]'); await p.waitForTimeout(150);
    const opts = await ev(() => document.getElementById("kxOpts").innerText);
    check("UNREAL ▸ Camera: the Unreal camera tool (Orbit, Look, Pan, Dolly, Roll, Focus)", (await ue()).tool === "uecam" && ["Orbit", "Look", "Pan", "Dolly", "Roll", "Focus"].every((m) => opts.includes(m)), opts.slice(0, 120));
    // orbit: drag 60 px right
    const n0 = stills().length;
    await drag(300, 200, 332, 200, [], 6); await idle();
    let s1 = await ue(); const zoom = await ev(() => window.imageEditorInstance.state.zoom);
    const prevs = stills().slice(n0, -1), last = stills().slice(-1)[0].args;
    check("drag = ORBIT round the focus point: yaw + 0.3° per screen pixel, the camera moved round; small previews while dragging, then one full-size render, one undo step",
      Math.abs(s1.ue.camera.rot[2] - s0.ue.lastCamera.rot[2] - 32 * zoom * 0.3) < 1.2 && s1.ue.camera.loc[0] !== s0.ue.lastCamera.loc[0] && prevs.length >= 1 && prevs.every((c) => c.args.w <= 480) && last.w === 320 && s1.undo === s0.undo + 1, { cam: s1.ue.camera, prevs: prevs.length, last: last.w, u: [s0.undo, s1.undo] });
    await drag(300, 200, 300, 240, ["Shift"]); await idle(); const s2 = await ue();
    check("Shift + drag = PAN: the place moves, the turn stays", s2.ue.camera.rot.join() === s1.ue.camera.rot.join() && s2.ue.camera.loc.join() !== s1.ue.camera.loc.join(), [s1.ue.camera, s2.ue.camera]);
    await drag(300, 200, 340, 200, ["Alt"]); await idle(); const s3 = await ue();
    check("Alt + drag = ROLL (the horizon tilts)", Math.abs(s3.ue.camera.rot[0] - s2.ue.camera.rot[0]) > 5, s3.ue.camera.rot);
    await drag(300, 200, 330, 180, ["Control"]); await idle(); const s3b = await ue();
    check("Ctrl + drag = LOOK (pitch / yaw where it stands - the place stays)", s3b.ue.camera.loc.join() === s3.ue.camera.loc.join() && s3b.ue.camera.rot[1] !== s3.ue.camera.rot[1], s3b.ue.camera);
    const [wx, wy] = await T(300, 200); await p.mouse.move(wx, wy); await p.mouse.wheel(0, -100); await p.waitForTimeout(600); await idle(); const s4 = await ue();
    check("the wheel = DOLLY forward (one undo step when it rests)", s4.ue.camera.loc.join() !== s3b.ue.camera.loc.join() && s4.ue.camera.rot.join() === s3b.ue.camera.rot.join() && s4.undo === s3b.undo + 1, s4.ue.camera);
    // the 🎥 Camera tab
    await ev(() => window.imageEditorInstance.E.ui.showTab("kuecam")); await p.waitForTimeout(250);
    const tab = await ev(() => document.getElementById("kuecamBody").innerText);
    check("the 🎥 Camera tab: presets, focal length, field of view, filmback, f-stop, focus, exposure, X Y Z, roll / pitch / yaw, From / To Unreal's viewport", ["Presets", "Focal length", "Field of view", "Filmback", "F-stop", "Focus", "EV", "Roll Pitch Yaw", "From Unreal", "To Unreal"].every((w) => tab.includes(w)), tab.slice(0, 300));
    await p.selectOption("#kuecamBody #ucPre", "b:p85"); await p.waitForTimeout(500); await idle();
    const s5 = await ue(), l5 = stills().slice(-1)[0].args;
    check("a lens preset (85mm f/1.8): the lens + the field of view (23.91°) go to Unreal", s5.ue.lens.focal === 85 && s5.ue.lens.fstop === 1.8 && l5.lens.focal === 85 && l5.lens.fstop === 1.8 && Math.abs(l5.camera.fov - 23.91) < 0.02, { lens: s5.ue.lens, sent: l5 });
    const px0 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), q = L.smart.t.quad; return Array.from(L.canvas.getContext("2d").getImageData(Math.round(q[0][0]) + 3, Math.round(q[0][1]) + 3, 1, 1).data); });
    await p.fill("#kuecamBody #ucE", "1"); await p.press("#kuecamBody #ucE", "Tab"); await p.waitForTimeout(500); await idle();
    const px1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), q = L.smart.t.quad; return Array.from(L.canvas.getContext("2d").getImageData(Math.round(q[0][0]) + 3, Math.round(q[0][1]) + 3, 1, 1).data); });
    check("Exposure +1 EV: Unreal draws it brighter", stills().slice(-1)[0].args.lens.exposure === 1 && px1[0] > px0[0] + 40, { px0, px1 });
    await p.fill("#kuecamBody #ucV", "60"); await p.press("#kuecamBody #ucV", "Tab"); await p.waitForTimeout(500); await idle();
    const s6 = await ue();
    check("the field of view 60° -> the focal length follows (31.2 mm on full frame)", Math.abs(s6.ue.lens.focal - 31.2) < 0.11 && Math.abs(s6.ue.camera.fov - 60) < 0.2, s6.ue.lens);
    // click to focus
    await p.click("#kuecamBody #ucFocus"); await p.waitForTimeout(150);
    const fs0 = STUB.calls.filter((c) => c.cmd === "focus_at").length;
    await click(300, 160); await idle();
    const s7 = await ue(), fc = STUB.calls.filter((c) => c.cmd === "focus_at");
    check("🎯 Click to focus: Unreal measures the distance to what is clicked -> the focus distance (one undo step)", fc.length === fs0 + 1 && fc[fc.length - 1].args.u > 0 && fc[fc.length - 1].args.u < 1 && s7.ue.lens.focus >= 300 && s7.undo === s6.undo + 1, { f: fc.slice(-1)[0].args, lens: s7.ue.lens });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    check("...Undo: the focus as it was", ((await ue()).ue.lens.focus || 0) === (s6.ue.lens.focus || 0));
    // To / From Unreal's viewport
    await p.click("#kuecamBody #ucTo"); await p.waitForTimeout(400);
    const vp = STUB.state.viewport;
    check("⇧ To Unreal's viewport: Unreal's level viewport looks through this camera", vp && vp.loc.join() === (await ue()).ue.camera.loc.join(), vp);
    STUB.state.viewport = { loc: [10, 20, 30], rot: [0, -5, 45], fov: 90 };
    await p.click("#kuecamBody #ucFrom"); await idle();
    check("⇩ From Unreal's viewport: the camera = the viewport's", (await ue()).ue.camera.loc.join() === "10,20,30");
    // the timeline camera's lens
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(400);
    const vl0 = await ev(() => tl.vlayers.length);
    await ev(() => window.TlUnreal.cameraNew()); await p.waitForTimeout(800); await p.fill("#tlUeDlg #tuDur", "1"); await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if ((await ev(() => tl.vlayers.length)) > vl0 && !(await ev(() => window.TlUnreal.busy()))) break; }
    await ev(() => window.TlUnreal.keysDialog()); await p.waitForTimeout(200);
    await p.fill("#tlUeDlg #tuLf", "50"); await p.selectOption("#tlUeDlg #tuLa", "2"); await p.fill("#tlUeDlg #tuLd", "250"); await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if (!(await ev(() => window.TlUnreal.busy()))) break; }
    const rc = STUB.calls.filter((c) => c.cmd === "render").slice(-1)[0].args;
    check("timeline Unreal camera ▸ Keys…: a lens (50 mm, f/2, focus 2.5 m) goes with the render; the keys' field of view follows (39.6°)", rc.lens && rc.lens.focal === 50 && rc.lens.fstop === 2 && rc.lens.focus === 250 && Math.abs(rc.camera_keys[0].fov - 39.6) < 0.1, rc.lens);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally {
    try { await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port }) }), port0); } catch (e) { /* closed */ }
    await b.close(); await STUB.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
