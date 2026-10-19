#!/usr/bin/env node
/* bitGen Studio — 2.476.0 in a REAL browser: UNREAL LIGHTS, VOLUMETRIC LIGHTS AND FOG (pcuelights.js, static/uerig.js,
 * tlunreal.js) against scripts/ue-stub.js (a stand-in for the Unreal Editor + the bitGen Bridge plugin).
 * Tim (verbatim): "allow user to add unreal lights to the scene, volumetric lights, volumetric fog etc. in bitgen image
 * editor and timeline. it would be good to be able to do it all in one app - bitgen studio."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Unreal lights browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.ueLights && window.TlUnreal && window.UERig, null, { timeout: 60000 });
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
    const last = () => STUB.calls.filter((c) => c.cmd === "still").slice(-1)[0].args;
    const ue = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return L && L.smart && L.smart.ue ? JSON.parse(JSON.stringify({ ue: L.smart.ue, undo: E.S.undo.length, tool: E.S.tool })) : null; });
    const idle = async () => { await p.waitForTimeout(450); for (let i = 0; i < 60; i++) { await p.waitForTimeout(120); if (!(await ev(() => window.imageEditorInstance.E.unreal.busy()))) break; } await p.waitForTimeout(150); };
    const pix = (fx, fy) => ev(([fx, fy]) => { const E = window.imageEditorInstance.E, L = E.layer(), q = L.smart.t.quad; const x = Math.round(q[0][0] + (q[1][0] - q[0][0]) * fx), y = Math.round(q[0][1] + (q[3][1] - q[0][1]) * fy); return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [fx, fy]);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="unreal"]'); await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_scene"]'); await p.waitForTimeout(700);
    await p.selectOption(".kxdlg.pcd #ueCam", "CineCam_Wide"); await p.fill(".kxdlg.pcd #ueW", "320"); await p.fill(".kxdlg.pcd #ueH", "180"); await p.click(".kxdlg.pcd .ok"); await idle();
    const fig0 = await pix(0.5, 0.6), bg0 = await pix(0.05, 0.1);
    // UNREAL ▸ Lights & Fog: the neon preset (two rect lights + volumetric fog)
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_fog"]'); await p.waitForTimeout(250);
    await p.selectOption("#kuelightsBody [data-pre]", "neon"); await idle();
    let s = await ue(), a = last();
    const fig1 = await pix(0.5, 0.6), bg1 = await pix(0.05, 0.1);
    check("💡 Lights tab ▸ the Neon preset: two rect lights (magenta, cyan, volumetric) + volumetric fog go to Unreal with the still; the picture changes (lit + fogged)",
      s.ue.rig.lights.length === 2 && s.ue.rig.lights.every((l) => l.type === "rect" && l.volumetric > 1) && s.ue.rig.fog.on && s.ue.rig.fog.volumetric && a.rig.lights.length === 2 && a.rig.fog.volumetric === true
      && fig1.join() !== fig0.join() && bg1.join() !== bg0.join(), { lights: s.ue.rig.lights.map((l) => [l.name, l.color]), fog: s.ue.rig.fog, fig0, fig1, bg0, bg1 });
    // ＋ Point, its colour
    const u0 = s.undo;
    await p.click('#kuelightsBody [data-add="point"]'); await idle();
    s = await ue();
    check("＋ Point: a third light, placed in front of the camera, one undo step", s.ue.rig.lights.length === 3 && s.ue.rig.lights[2].type === "point" && s.undo === u0 + 1 && last().rig.lights.length === 3, s.ue.rig.lights[2]);
    await ev(() => { const i = document.querySelector('#kuelightsBody .box input[data-k="color"]'); i.value = "#ff0000"; i.dispatchEvent(new Event("change")); }); await idle();
    check("its colour (red) goes to Unreal", last().rig.lights[2].color === "#ff0000");
    await ev(() => { const i = document.querySelector('#kuelightsBody .box input[data-k="volumetric"]'); i.value = "6"; i.dispatchEvent(new Event("change")); }); await idle();
    check("its volumetric scattering (light shafts in the fog)", last().rig.lights[2].volumetric === 6);
    // the light tool: markers, drag
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="u_lights"]'); await p.waitForTimeout(150);
    const mk = await ev(() => window.imageEditorInstance.E.ueLights.markers());
    check("UNREAL ▸ Lights: the light tool shows each light where it is in the picture (3 markers in front of the camera)", (await ue()).tool === "uelight" && mk.length === 3 && mk.every((m) => m.z > 0), mk);
    const m0 = mk[2], scr = await ev(([u, v]) => { const L = window.imageEditorInstance.E.layer(), q = L.smart.t.quad; return [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * v]; }, [m0.u, m0.v]);
    const uA = (await ue()).undo;
    await drag(scr[0], scr[1], scr[0] + 40, scr[1] + 10); await idle();
    const mk2 = await ev(() => window.imageEditorInstance.E.ueLights.markers()), m1 = mk2.find((m) => m.id === m0.id), sB = await ue();
    check("drag a marker: the light moves across the picture at the same distance from the camera (one undo step)", m1 && m1.u > m0.u + 0.05 && Math.abs(m1.z - m0.z) < 1 && sB.undo === uA + 1 && last().rig.lights.find((l) => l.id === m0.id).loc.join() === sB.ue.rig.lights.find((l) => l.id === m0.id).loc.join(), { m0, m1 });
    const scr2 = await ev(([u, v]) => { const L = window.imageEditorInstance.E.layer(), q = L.smart.t.quad; return [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * v]; }, [m1.u, m1.v]);
    await drag(scr2[0], scr2[1], scr2[0], scr2[1] + 40, ["Shift"]); await idle();
    const m2 = (await ev(() => window.imageEditorInstance.E.ueLights.markers())).find((m) => m.id === m0.id);
    check("Shift + drag: nearer / further (the depth changes, it stays on the same spot of the picture)", m2.z > m1.z * 1.2 && Math.abs(m2.u - m1.u) < 0.01, { m1, m2 });
    const r0 = (await ue()).ue.rig.lights.find((l) => l.id === mk[0].id).rot, sc0 = await ev(([u, v]) => { const L = window.imageEditorInstance.E.layer(), q = L.smart.t.quad; return [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * v]; }, [mk[0].u, mk[0].v]);
    await drag(sc0[0], sc0[1], sc0[0] + 30, sc0[1], ["Alt"]); await idle();
    const r1 = (await ue()).ue.rig.lights.find((l) => l.id === mk[0].id).rot;
    check("Alt + drag: turns its aim", r1[2] !== r0[2], { r0, r1 });
    // on / off, a fog preset, keep, delete, undo
    await ev(() => window.imageEditorInstance.E.ui.showTab("kuelights")); await p.waitForTimeout(200);
    await ev((id) => { const c = document.querySelector(`#kuelightsBody [data-on="${id}"]`); c.checked = false; c.dispatchEvent(new Event("change")); }, mk[1].id); await idle();
    check("☐ switches a light off (it goes as off)", last().rig.lights.find((l) => l.id === mk[1].id).on === false);
    await p.selectOption("#kuelightsBody [data-fpre]", "mist"); await idle();
    check("a fog preset (Morning mist): density, falloff, volumetric", last().rig.fog.density === 0.05 && last().rig.fog.falloff === 0.8 && last().rig.fog.volumetric === true, last().rig.fog);
    await ev(() => { const c = document.querySelector("#kuelightsBody [data-keep]"); c.checked = true; c.dispatchEvent(new Event("change")); }); await idle();
    check("\"keep them in the Unreal level\" goes too", last().rig.keep === true);
    const before = (await ue()).ue.rig.lights.length;
    await ev((id) => document.querySelector(`#kuelightsBody [data-del="${id}"]`).click(), mk[2].id); await idle();
    const after = (await ue()).ue.rig.lights.length;
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(250);
    check("✕ deletes a light; Undo brings it back", after === before - 1 && (await ue()).ue.rig.lights.length === before, { before, after });
    // the timeline: Lights & Fog of an Unreal clip, the image editor's lights
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(400);
    const vl0 = await ev(() => tl.vlayers.length);
    await ev(() => window.TlUnreal.sceneDialog()); await p.waitForTimeout(800);
    await p.selectOption("#tlUeDlg #tuWhat", "seq:/Game/Cine/Seq_Intro.Seq_Intro"); await p.fill("#tlUeDlg #tuDur", "1"); await p.fill("#tlUeDlg #tuW", "96"); await p.fill("#tlUeDlg #tuH", "54"); await p.fill("#tlUeDlg #tuF", "12");
    await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if ((await ev(() => tl.vlayers.length)) > vl0 && !(await ev(() => window.TlUnreal.busy()))) break; }
    await ev(() => window.TlUnreal.lightsDialog()); await p.waitForTimeout(300);
    const dlgTxt = await ev(() => document.getElementById("tlUeDlg").innerText);
    await ev(() => document.querySelector("#tlUeDlg #tuIeRig").click()); await p.waitForTimeout(200);
    await ev(() => document.querySelector('#tlUeDlg [data-add="spot"]').click()); await p.waitForTimeout(150);
    await ev(() => document.querySelector("#tlUeDlg .ok").click());
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); if (!(await ev(() => window.TlUnreal.busy()))) break; }
    const rc = STUB.calls.filter((c) => c.cmd === "render").slice(-1)[0].args;
    check("timeline UNREAL ▸ Lights & Fog… (the same panel): ⇦ the image editor's lights + one more spot -> the render carries them (4 lights, the mist)", /Lights/.test(dlgTxt) && /Fog/.test(dlgTxt) && rc.rig && rc.rig.lights.length === 4 && rc.rig.fog.density === 0.05, rc.rig && { n: rc.rig.lights.length, fog: rc.rig.fog });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally {
    try { await ev((port) => fetch("/api/unreal/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port }) }), port0); } catch (e) { /* closed */ }
    await b.close(); await STUB.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
