#!/usr/bin/env node
/* bitGen Studio — 2.471.0 in a REAL browser: PARAMETRIC 3D BODIES (ext/imageeditdock/pcbody.js, static/body3d.js,
 * static/body3docc.js - OpenCascade as WebAssembly in the page - and the Blender engine, lib/body3d.js).
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" - the engine: "in settings give user option for 1 and 3 ... add both 1 and 3"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3D bodies browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(60000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.body && window.imageEditorInstance.E.cadBar && window.Body3D, null, { timeout: 60000 });
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
    const E_ = "window.imageEditorInstance.E";
    const waitIdle = async (ms) => { for (let i = 0; i < (ms || 900); i++) { await p.waitForTimeout(100); if (!(await ev(() => window.imageEditorInstance.E.body.busy()))) break; } await p.waitForTimeout(150); };
    const info = () => ev(async () => { const E = window.imageEditorInstance.E, L = E.layer(); if (!E.body.isBody(L)) return { type: L && L.type };
      const m = await E.body.ensureMesh(L), I = window.Body3D.meshInfo(m); return { name: L.name, type: L.type, vol: I.volume, tris: I.tris, feats: L.smart.body.features.map((f) => f.name + (f.off ? "(off)" : "")), engine: m.engine, n: E.S.layers.length, undo: E.S.undo.length, view: L.smart.body.view, w: L.smart.w, h: L.smart.h }; });
    await ev(() => window.Body3D.setEngine("occ"));
    // a sketch: an 80 x 40 rectangle (its lower-left corner at the sketch origin) with a hole r 8
    await ev(() => { const E = window.imageEditorInstance.E, K = window.PCSketch; E.sketch.newSketch(); const L = E.layer(), o = K.pt(L.sketch, L.sketch.origin.pt);
      E.sketch.edit(L, "test shapes", (s) => { K.rect2(s, [o.x, o.y], [o.x + 80, o.y - 40]); K.circle(s, [o.x + 40, o.y - 20], 8); }); });
    await p.waitForTimeout(200);
    const n0 = (await st()).n;
    // SOLID ▸ Extrude
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="solid"]'); await p.waitForTimeout(150);
    const solidTab = await ev(() => [...document.querySelectorAll('.cadbar[data-cadbar="cadbar.ie"] .cbgl')].map((x) => x.textContent));
    check("the CAD toolbar has a SOLID tab: CREATE (Extrude, Revolve) · MODIFY · VIEW · EXPORT", solidTab.length === 4 && /CREATE/.test(solidTab[0]) && /MODIFY/.test(solidTab[1]) && /EXPORT/.test(solidTab[3]), solidTab);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="b_extrude"]'); await p.waitForTimeout(250);
    // 2.494.0: two closed regions (the plate, the hole's disc) -> pick on the canvas first
    const pk0 = await ev(() => window.imageEditorInstance.E.body.picking());
    const so = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), q = window.PCSketch.pt(L.sketch, L.sketch.origin.pt); return [q.x, q.y]; });
    await click(so[0] + 40, so[1] - 20); const pkDisc = await ev(() => window.imageEditorInstance.E.body.picking());
    await click(so[0] + 40, so[1] - 20); await click(so[0] + 8, so[1] - 8);
    const pk1 = await ev(() => window.imageEditorInstance.E.body.picking()), opt = await ev(() => document.getElementById("kxOpts").textContent);
    check("Extrude a sketch with two closed regions: PICK ON THE CANVAS (the Pick Profiles tool) - the disc clicked = it, again = off, the plate clicked = the plate only", !!pk0 && pk0.n === 2 && pk0.picked.length === 0
      && pkDisc.picked.join() === "1" && pk1.picked.join() === "0" && /1 of 2 region/.test(opt), { pk0, pkDisc, pk1, opt });
    await p.click("#bdPkOk"); await p.waitForTimeout(250);
    await p.fill(".kxdlg.pcd #bdD", "depth * 2"); await p.waitForTimeout(80);
    const bad = await ev(() => document.querySelector(".kxdlg.pcd #bdDV").textContent);
    await p.fill(".kxdlg.pcd #bdD", "25"); await p.waitForTimeout(80);
    const good = await ev(() => document.querySelector(".kxdlg.pcd #bdDV").textContent);
    check("Extrude dialog: the sketch, its closed profile, the distance worked out as you type (an unknown name said at once)", /"depth" is not a parameter/.test(bad) && good === "= 25" && /All closed profiles \(1, holes cut out\)/.test(await ev(() => document.querySelector(".kxdlg.pcd").textContent)), { bad, good });
    await p.click(".kxdlg.pcd .ok"); await waitIdle();
    let i1 = await info();
    const sketchHidden = await ev(() => { const E = window.imageEditorInstance.E; return E.S.layers.filter((L) => L.type === "sketch").every((L) => !L.visible); });
    check("Extrude 25 (OpenCascade in the page): a new BODY LAYER (a smart object) - volume 80 x 40 x 25 - π 8² x 25; the sketch hidden", i1.type === "smart" && i1.n === n0 + 1 && Math.abs(i1.vol - (80 * 40 * 25 - Math.PI * 64 * 25)) < 30 && i1.engine === "occ" && sketchHidden && i1.feats.join() === "Extrude1", i1);
    const ink = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), D = L.canvas.getContext("2d").getImageData(0, 0, E.S.w, E.S.h).data; let n = 0; for (let i = 3; i < D.length; i += 4) if (D[i] > 200) n++; return n; });
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    check("the body drawn on its layer (the home view, edges and shading)", ink > 2000, ink);
    // the 🧊 Body tab
    await ev(() => window.imageEditorInstance.E.ui.showTab("kbody")); await p.waitForTimeout(250);
    const tab = await ev(() => document.getElementById("kbodyBody").innerText);
    check("the 🧊 Body tab: the feature list (⬆ Extrude1 - 25), Parameters, View, Look, Export", /Extrude1 - 25/.test(tab) && /Parameters/.test(tab) && /Turn/.test(tab) && /STEP/.test(tab), tab.slice(0, 300));
    // ƒx parameters + a feature using one
    await ev(() => window.imageEditorInstance.E.body.paramsDialog()); await p.waitForTimeout(200);
    await p.click(".kxdlg.pcd #bdParAdd"); await p.waitForTimeout(80);
    await p.fill('.kxdlg.pcd [data-n="0"]', "depth"); await p.press('.kxdlg.pcd [data-n="0"]', "Tab");
    await p.fill('.kxdlg.pcd [data-e="0"]', "25"); await p.press('.kxdlg.pcd [data-e="0"]', "Tab"); await p.waitForTimeout(80);
    await p.click(".kxdlg.pcd #bdParAdd"); await p.fill('.kxdlg.pcd [data-n="1"]', "r"); await p.press('.kxdlg.pcd [data-n="1"]', "Tab"); await p.fill('.kxdlg.pcd [data-e="1"]', "depth / 10"); await p.press('.kxdlg.pcd [data-e="1"]', "Tab"); await p.waitForTimeout(80);
    const parTxt = await ev(() => document.querySelector(".kxdlg.pcd").innerText);
    await p.click(".kxdlg.pcd .ok"); await waitIdle();
    check("ƒx Change Parameters: depth = 25, r = depth / 10 (= 2.5, worked out in the dialog)", /= 2\.5/.test(parTxt) && (await ev(() => window.imageEditorInstance.E.layer().smart.body.params.length)) === 2, parTxt.slice(0, 200));
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); E.body.editFeature(L, L.smart.body.features[0]); }); await p.waitForTimeout(250);
    await p.fill(".kxdlg.pcd #bdD", "depth"); await p.click(".kxdlg.pcd .ok"); await waitIdle();
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), b = JSON.parse(JSON.stringify(L.smart.body)); b.params[0].expr = "50"; return E.body.commit(L, b, "change parameters"); }); await waitIdle();
    const i2 = await info();
    check("PARAMETRIC: Extrude1's distance = depth; depth 25 -> 50 doubles the body", Math.abs(i2.vol - 2 * i1.vol) < 60, [i1.vol, i2.vol]);
    // Fillet r on the top edges (the toolbar), suppress it, back
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="b_fillet"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #bdR", "r"); await p.selectOption(".kxdlg.pcd #bdE", "top"); await p.click(".kxdlg.pcd .ok"); await waitIdle();
    const i3 = await info();
    check("Fillet r (= 5) on the top edges: a little taken away (exact rounds)", i3.feats.join() === "Extrude1,Fillet1" && i3.vol < i2.vol - 300 && i3.vol > i2.vol - 3000, [i2.vol, i3.vol]);
    await ev(() => window.imageEditorInstance.E.ui.showTab("kbody")); await p.waitForTimeout(200);
    await p.click('#kbodyBody [data-on="1"]'); await waitIdle();
    const i4 = await info();
    check("☐ in the feature list suppresses Fillet1 (the body without it, the row struck through)", Math.abs(i4.vol - i2.vol) < 5 && i4.feats[1] === "Fillet1(off)" && (await ev(() => !!document.querySelector("#kbodyBody .ft.off"))), [i4.vol, i4.feats]);
    await p.click('#kbodyBody [data-on="1"]'); await waitIdle();
    // the sketch changes -> the body follows by itself (no undo step of its own)
    const u0 = (await info()).undo;
    await ev(() => { const E = window.imageEditorInstance.E, sk = E.S.layers.find((L) => L.type === "sketch"); const c = sk.sketch.ents.find((e) => e.t === "circle"); c.r = 12; sk.ver++; window.PCSketch.measure(sk.sketch); });
    await ev(() => window.imageEditorInstance.E.body.checkAll()); await waitIdle();
    const i5 = await info();
    check("the sketch edited (the hole r 8 -> 12): the body rebuilt by itself, no undo step of its own", i5.vol < i3.vol - 5000 && i5.undo === u0, [i3.vol, i5.vol, u0, i5.undo]);
    // Undo the fillet (one step) -> without it
    const before = await info();
    await ev(() => { const E = window.imageEditorInstance.E; E.undo(); }); await waitIdle();
    // (undo of the un-suppress = suppressed again)
    const i6 = await info();
    check("Undo: one feature change back (the fillet suppressed again)", i6.feats[1] === "Fillet1(off)" && i6.vol > before.vol, [before.feats, i6.feats]);
    await ev(() => window.imageEditorInstance.E.redo()); await waitIdle();
    // Split Body: this layer keeps x > 40, the other half a new body layer
    const whole = (await info()).vol, nb = (await info()).n;
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="b_split"]'); await p.waitForTimeout(200);
    await p.selectOption(".kxdlg.pcd #bdP", "YZ"); await p.fill(".kxdlg.pcd #bdO", "40"); await p.click(".kxdlg.pcd .ok"); await waitIdle(); await p.waitForTimeout(500); await waitIdle();
    const sp = await ev(async () => { const E = window.imageEditorInstance.E, B = E.S.layers.filter(E.body.isBody), out = []; for (const L of B) { const m = await E.body.ensureMesh(L); out.push({ name: L.name, vol: window.Body3D.meshInfo(m).volume, f: L.smart.body.features.map((f) => f.name + ":" + (f.keep || "")) }); } return out; });
    check("Split Body at x = 40: this body keeps the + side, the − side is a NEW BODY LAYER (both parametric, the halves = the whole)", sp.length === 2 && (await info()).n === nb + 1 && Math.abs(sp[0].vol + sp[1].vol - whole) < 50 && /Split1:pos/.test(sp[0].f.join()) && /neg/.test(sp[1].f.join()), sp);
    // Revolve: a new sketch, a 10 x 30 strip 10 to the right of its Y axis, 360°
    await ev(() => { const E = window.imageEditorInstance.E, K = window.PCSketch; E.sketch.newSketch(); const L = E.layer(), o = K.pt(L.sketch, L.sketch.origin.pt);
      E.sketch.edit(L, "test strip", (s) => { K.rect2(s, [o.x + 10, o.y], [o.x + 20, o.y - 30]); }); });
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="solid"]').catch(() => {}); await p.waitForTimeout(150);
    await ev(() => window.imageEditorInstance.E.body.sketchDialog("revolve")); await p.waitForTimeout(250);
    const axes = await ev(() => [...document.querySelectorAll(".kxdlg.pcd #bdAx option")].map((o) => o.value));
    await p.selectOption(".kxdlg.pcd #bdAx", "y"); await p.fill(".kxdlg.pcd #bdA", "360"); await p.selectOption(".kxdlg.pcd #bdOp", "new"); await p.click(".kxdlg.pcd .ok"); await waitIdle();
    const rv = await info();
    check("Revolve 360° round the sketch's Y axis (or X, or one of its lines): a ring π (20² − 10²) x 30, a new body", axes[0] === "x" && axes[1] === "y" && axes.length > 2 && Math.abs(rv.vol - Math.PI * 300 * 30) < 300 && rv.feats.join() === "Revolve1", { axes, rv });
    // the view: Top, then orbit by dragging; undo
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="bv_top"]'); await waitIdle();
    const vt = (await info()).view;
    await ev(() => window.imageEditorInstance.E.body.orbit(true));
    const q = await ev(() => { const L = window.imageEditorInstance.E.layer(), Q = L.smart.t.quad; return [(Q[0][0] + Q[2][0]) / 2, (Q[0][1] + Q[2][1]) / 2]; });
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    await drag(q[0], q[1], q[0] + 60, q[1] + 20, [], 6); await waitIdle();
    const vo = (await info()).view;
    await ev(() => window.imageEditorInstance.E.body.orbit(false));
    await ev(() => window.imageEditorInstance.E.undo()); await waitIdle();
    const vu = (await info()).view;
    check("VIEW ▸ Top (tilt 90°); 🖐 Orbit: a drag on the body turns it (one undo step - Undo = Top again)", vt.pitch === 90 && vo.yaw === 30 && vu.yaw === 0 && vu.pitch === 90, { vt, vo, vu });
    // export STL (a download)
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), ev(() => window.imageEditorInstance.E.body.exportAs("stl"))]);
    const fs = require("fs"), stlPath = await dl.path(), stl = fs.readFileSync(stlPath);
    check("EXPORT ▸ STL: a binary STL of the body (its triangles)", /\.stl$/.test(dl.suggestedFilename()) && stl.readUInt32LE(80) === rv.tris && stl.length === 84 + rv.tris * 50, [dl.suggestedFilename(), stl.length]);
    const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), ev(() => window.imageEditorInstance.E.body.exportAs("step"))]);
    const step = fs.readFileSync(await dl2.path(), "utf8");
    check("EXPORT ▸ STEP (OpenCascade): an exact solid for other CAD programs", /\.step$/.test(dl2.suggestedFilename()) && /^ISO-10303-21;/.test(step), step.slice(0, 30));
    // the Blender engine (Settings ▸ 3D): the same body built by Blender
    const hasBl = await ev(() => fetch("/api/body3d/settings").then((r) => r.json()).then((j) => j.blender && j.blender.found));
    if (hasBl) {
      await ev(() => window.Body3D.setEngine("blender"));
      await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), b = JSON.parse(JSON.stringify(L.smart.body)); b.features[0].angle = "180"; return E.body.commit(L, b, "edit revolve"); }); await waitIdle(1800);
      const bl = await info();
      check("Settings ▸ 3D = Blender: the same feature built by Blender (half the ring)", bl.engine === "blender" && Math.abs(bl.vol - Math.PI * 300 * 15) < 400, bl);
      await ev(() => window.Body3D.setEngine("occ"));
    } else check("Settings ▸ 3D = Blender: SKIP (no Blender here)", true);
    // Settings ▸ 3D
    const s3 = await ev(() => { const b = document.querySelector('#settings .stabs [data-stab="3d"]'), pane = document.getElementById("stab-3d"); return { b: !!b, radios: pane ? [...pane.querySelectorAll('input[name="s_b3eng"]')].map((x) => x.value) : [] }; });
    check("Settings has a 3D tab: In the browser (OpenCascade) / Blender (on this computer)", s3.b && s3.radios.join() === "occ,blender", s3);
    // → Timeline
    const tl0 = await ev(() => (window.TlM3D ? window.TlM3D.all().length : -1));
    const tlName = await ev(() => window.imageEditorInstance.E.body.toTimeline()); await p.waitForTimeout(800);
    const tl1 = await ev(() => (window.TlM3D ? window.TlM3D.all().length : -1));
    check("EXPORT ▸ → Timeline: a .glb in the project's 3D models and a 3D layer on the timeline", /^body_.*\.glb$/.test(tlName || "") && tl1 === tl0 + 1, { tlName, tl0, tl1 });
    // the live link: the body changed in the image editor -> its timeline file sent again, its 3D layers re-baked
    await ev(() => { window.__rl = []; const o = window.TlBody.reload; window.TlBody.reload = (n) => { window.__rl.push(n); return o(n); }; });
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), b = JSON.parse(JSON.stringify(L.smart.body)); b.look.color = "#ff8800"; b.features[0].angle = "270"; return E.body.commit(L, b, "edit revolve"); }); await waitIdle();
    await p.waitForTimeout(1500);
    const rl = await ev(() => window.__rl);
    const tlTabs = await ev(() => [...document.querySelectorAll("#tlCadBar .cbtab")].map((x) => x.textContent));
    check("the timeline: a SOLID tab (Body → 3D Layer, Update Bodies, Edit in Image Editor); the body edited -> its 3D layer updated by itself", tlTabs.includes("SOLID") && rl.length === 1 && rl[0] === tlName, { tlTabs, rl });
    await ev(() => window.TlCadBar.ui.setTab("solid")); await ev(() => document.querySelector('#tlCadBar .cbb[data-id="b_add"]').click()); await p.waitForTimeout(200);   // (the editor fills the window - a click by script)
    const menuTxt = await ev(() => { const m = document.getElementById("tlBodyMenu"); const t = m ? m.innerText : ""; if (m) m.remove(); return t; });
    check("timeline SOLID ▸ Body → 3D Layer lists the image editor's bodies (the one sent marked)", /Body1/.test(menuTxt) && /Body1 \(2\)/.test(menuTxt) && /on the timeline/.test(menuTxt), menuTxt);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
