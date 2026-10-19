#!/usr/bin/env node
/* bitGen Studio — 2.472.0 in a REAL browser: THE UNREAL ENGINE 5.8 BRIDGE against scripts/ue-stub.js (a stand-in for
 * the Unreal Editor + the bitGen Bridge plugin): Settings ▸ 3D ▸ Unreal, the image editor's Unreal + MetaHuman layers
 * (pcunreal.js), the timeline's Unreal layer, MetaHuman layer and Unreal camera (tlunreal.js).
 * Tim (verbatim): "can we add an unreal engine 5.8 bridge ... we can add metahuman layer, ue5.8 layer, ue5.8 camera in
 * our timeline?"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Unreal bridge browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.unreal && window.TlUnreal && window.UEBridge, null, { timeout: 60000 });
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
    // Settings ▸ 3D ▸ Unreal Engine
    await ev(() => window.Settings3D.open()); await p.waitForTimeout(400);
    await p.click("#s_ueTest"); await p.waitForTimeout(600);
    const sTxt = await ev(() => document.getElementById("s_ueSt").textContent), portShown = await ev(() => document.getElementById("s_uePort").value);
    await ev(() => document.getElementById("settings").close());
    check("Settings ▸ 3D ▸ Unreal Engine: the bridge port, Test connection = ✓ the engine + the project", /✓ Unreal 5\.8\.1-stub/.test(sTxt) && /StubProject/.test(sTxt) && +portShown === STUB.port, { sTxt, portShown });
    // the image editor: UNREAL ▸ Unreal Layer
    await ev(() => window.imageEditorInstance.E.cadBar.show(true)); await p.waitForTimeout(200);   // the CAD toolbar is off by default since 2.513.0
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="unreal"]'); await p.waitForTimeout(150);
    const ueTab = await ev(() => [...document.querySelectorAll('.cadbar[data-cadbar="cadbar.ie"] .cbgl')].map((x) => x.textContent));
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_scene"]'); await p.waitForTimeout(700);
    const opts = await ev(() => ({ lv: [...document.querySelectorAll(".kxdlg.pcd #ueLv option")].map((o) => o.value), cam: [...document.querySelectorAll(".kxdlg.pcd #ueCam option")].map((o) => o.value) }));
    check("image editor UNREAL tab (Layers / Camera / Bridge); New Unreal Layer lists the project's levels and the level's cameras", ueTab.length >= 3 && /LAYERS/.test(ueTab[0]) && opts.lv.includes("/Game/Maps/Street") && opts.cam.includes("CineCam_Wide"), { ueTab, opts });
    await p.selectOption(".kxdlg.pcd #ueCam", "CineCam_Wide"); await p.fill(".kxdlg.pcd #ueW", "320"); await p.fill(".kxdlg.pcd #ueH", "180");
    const n0 = (await st()).n;
    await p.click(".kxdlg.pcd .ok");
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); if ((await st()).n > n0) break; }
    const L1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return { type: L.type, ue: L.smart && L.smart.ue, w: L.smart && L.smart.w, px: Array.from(L.canvas.getContext("2d").getImageData(30, 80, 1, 1).data), name: L.name }; });
    check("Render: an Unreal layer (a smart object) of Unreal's picture through CineCam_Wide (320 x 180, fitted to the canvas)", L1.type === "smart" && L1.ue.kind === "scene" && L1.ue.camera.name === "CineCam_Wide" && L1.w === 320 && L1.px[2] > 200 && L1.px[3] === 255, L1);
    // 🎮 Unreal tab: turn 15 -> render again (Unreal is told), one undo step
    await ev(() => window.imageEditorInstance.E.ui.showTab("kue")); await p.waitForTimeout(250);
    const u0 = (await st()).undo;
    await p.fill("#kueBody #ueYaw", "15"); await p.click("#kueBody #ueRe");
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); if ((await st()).undo > u0) break; }
    const last = STUB.calls.filter((c) => c.cmd === "still").slice(-1)[0];
    const L2 = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { yaw: L.smart.ue.camera.yaw, src: L.smart.src }; });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const L3 = await ev(() => { const L = window.imageEditorInstance.E.layer(); return { yaw: L.smart.ue.camera.yaw }; });
    check("🎮 Unreal tab: Turn 15° -> ⟳ Render again (Unreal gets the nudge) - one undo step", last.args.camera.yaw === 15 && L2.yaw === 15 && L3.yaw === 0, { last: last.args.camera, L2, L3 });
    // MetaHuman layer: clear background, the pose
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_mh"]'); await p.waitForTimeout(700);
    await p.selectOption(".kxdlg.pcd #ueMh", "/Game/MetaHumans/Kai/BP_Kai.BP_Kai"); await p.selectOption(".kxdlg.pcd #ueAn", "/Game/Anims/Wave.Wave"); await p.fill(".kxdlg.pcd #ueT", "0.5");
    await p.selectOption(".kxdlg.pcd #ueFr", "full"); await p.fill(".kxdlg.pcd #ueW", "300"); await p.fill(".kxdlg.pcd #ueH", "400");
    const n1 = (await st()).n;
    await p.click(".kxdlg.pcd .ok");
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); if ((await st()).n > n1) break; }
    const M = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), q = L.smart.t.quad, cx = Math.round((q[0][0] + q[2][0]) / 2), cy = Math.round((q[0][1] + q[2][1]) / 2), g = L.canvas.getContext("2d");
      return { name: L.name, kind: L.smart.ue.kind, corner: g.getImageData(Math.round(q[0][0]) + 2, Math.round(q[0][1]) + 2, 1, 1).data[3], mid: g.getImageData(cx, cy, 1, 1).data[3] }; });
    const mc = STUB.calls.filter((c) => c.cmd === "still").slice(-1)[0].args;
    check("New MetaHuman Layer: Kai in the Wave pose at 0.5 s, full body, only the figure on a clear background", M.kind === "metahuman" && /Kai/.test(M.name) && M.corner === 0 && M.mid === 255 && mc.only_metahuman && mc.alpha && mc.metahuman.anim === "/Game/Anims/Wave.Wave" && mc.metahuman.time === 0.5 && mc.camera.loc[0] === 420, { M, mc });
    // the timeline: UNREAL ▸ Unreal Layer (a sequence)
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(500);
    const tlTab = await ev(() => [...document.querySelectorAll("#tlCadBar .cbtab")].map((x) => x.textContent));
    const vl0 = await ev(() => tl.vlayers.length);
    await ev(() => window.TlUnreal.sceneDialog()); await p.waitForTimeout(800);
    await p.selectOption("#tlUeDlg #tuWhat", "seq:/Game/Cine/Seq_Intro.Seq_Intro"); await p.fill("#tlUeDlg #tuDur", "1"); await p.fill("#tlUeDlg #tuW", "96"); await p.fill("#tlUeDlg #tuH", "54"); await p.fill("#tlUeDlg #tuF", "12");
    await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if ((await ev(() => tl.vlayers.length)) > vl0 && !(await ev(() => window.TlUnreal.busy()))) break; }
    const T1 = await ev(() => { const L = tl.vlayers[tl.vlayers.length - 1], c = L.clips[0]; return { name: L.name, file: c.name, dur: c.dur, ue: c.ue }; });
    const vid = await ev((f) => fetch("/video/" + encodeURIComponent(f), { method: "HEAD" }).then((r) => r.status).catch(() => 0), T1.file);
    check("timeline UNREAL tab; Unreal Layer = Seq_Intro rendered by the Movie Render Queue -> a video layer UE1 at the playhead (12 frames / 12 fps = 1 s)", tlTab.includes("UNREAL") && T1.name === "UE1" && /^ue_j.*\.mp4$/.test(T1.file) && Math.abs(T1.dur - 1) < 1e-6 && T1.ue.kind === "sequence", { tlTab, T1, vid });
    // the Unreal camera: a key from the viewport, a second at 2 s, render again
    await ev(() => window.TlUnreal.cameraNew()); await p.waitForTimeout(800);
    await p.fill("#tlUeDlg #tuDur", "1"); await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); const n = await ev(() => tl.vlayers.length); if (n > vl0 + 1 && !(await ev(() => window.TlUnreal.busy()))) break; }
    const C1 = await ev(() => { const s = window.TlCanvas.selClip(); return s && s.c.ue ? { kind: s.c.ue.kind, keys: s.c.ue.keys.length, file: s.c.name, layer: s.Ly && s.Ly.L ? s.Ly.L.name : "" } : null; });
    await ev(() => { const s = window.TlCanvas.selClip(); window.TlCanvas.go(s.c.start + 0.75); });
    const nk = await ev(() => window.TlUnreal.addKey());
    await ev(() => window.TlUnreal.again()); for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if (!(await ev(() => window.TlUnreal.busy()))) break; }
    const C2 = await ev(() => { const s = window.TlCanvas.selClip(); return { keys: s.c.ue.keys.map((k) => k.t), file: s.c.name }; });
    const rc = STUB.calls.filter((c) => c.cmd === "render").slice(-1)[0].args;
    check("Unreal Camera: a camera layer from the viewport (1 key); ＋ Key at the playhead (0.75 s) from Unreal's viewport; Render Again sends both keys and replaces the clip's video",
      C1 && C1.kind === "camera" && C1.keys === 1 && /UE Cam1/.test(C1.layer) && nk === 2 && C2.keys.join() === "0,0.75" && C2.file !== C1.file && rc.camera_keys.length === 2 && rc.camera_keys[1].loc.join() === "-400,-200,200", { C1, nk, C2, rc: rc.camera_keys });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally {
    try { await ev(() => window.imageEditorInstance.E.cadBar.show(false)); } catch { /* fine */ }
    try { await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port }) }), port0); } catch (e) { /* closed */ }
    await b.close(); await STUB.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
