#!/usr/bin/env node
/* bitGen Studio — 2.625.0 in a REAL browser: THE 📏 PUSHPULL DOCKER - A WINDOW'S ELEVATION, DOORS / WINDOWS MOVED AND
 * RESIZED BY HAND; A FACE EXTRUDED (+ / − A CUT, DRAGGED BLENDER-STYLE, TWISTED); EDGES MOVED, LENGTH, EXTRUDED INTO A FACE,
 * FILLETED, PICKED SEVERAL / AS THE FACE'S LOOP (Ctrl); A CORNER MOVED; ⛶ BETWEEN THE TITLE BAR AND THE STATUS BAR.
 * Tim: "in window properties add window elevation (height from floor) input. if user clicks a placed window allow the user to
 * move and resized the window,door,etc interactively. if user clicks a face show extrude in the properties panel, positive
 * extrude will extrude positive, negative will cut object, if user moves the face extrude to the face as blender does it, allow
 * user to rotate face twist the extrusion to match the rotated face. if user clicks an edge and moved it resize/move the edge
 * .show edge properties, include extrude edge to create a new face.add fillet to edge properties. allow user to select
 * multiple edges, if user ctrl selects a edge then select the edges that loop the face  if user selects a vertex move vertex."
 * + "fix the miximize button to maximize to full screen but keeping the bitgen titlebar and statusbar"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.625.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_edit625_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3PushPullFrame && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => {
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP");
      document.getElementById("titlebar").classList.remove("hidden");
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.T && H3PushPull.state.A, null, { timeout: 40000 });
    await p.click("#ppMaxBtn"); await p.waitForTimeout(500);
    const mx = await ev(() => { const d = document.getElementById("pushpulldock").getBoundingClientRect(), t = document.getElementById("titlebar").getBoundingClientRect(), s = document.getElementById("statusbar").getBoundingClientRect(); return { top: Math.round(d.top), bottom: Math.round(d.bottom), w: d.width, W: innerWidth, tb: Math.round(t.bottom), sb: Math.round(s.top), sbH: s.height, H: innerHeight }; });
    check("⛶ maximize: the whole width, from bitGen's title bar down to its status bar (both still showing)", mx.top === mx.tb && mx.bottom === mx.sb && mx.sbH > 0 && mx.sb < mx.H && mx.w === mx.W, mx);

    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const click = async (w, o) => { const [x, y] = await scr(w), keys = (o && o.modifiers) || []; await p.mouse.move(x, y, { steps: 3 }); for (const k of keys) await p.keyboard.down(k); await p.mouse.click(x, y); for (const k of keys) await p.keyboard.up(k); await p.waitForTimeout(150); };
    const drag = async (a, z, o) => { const [x0, y0] = await scr(a), [x1, y1] = Array.isArray(z[0]) ? z[0] : await scr(z); if (o && o.ctrl) await p.keyboard.down("Control"); if (o && o.shift) await p.keyboard.down("Shift"); await p.mouse.move(x0, y0, { steps: 2 }); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 }); await p.mouse.move(x1, y1, { steps: 6 }); await p.mouse.up(); if (o && o.ctrl) await p.keyboard.up("Control"); if (o && o.shift) await p.keyboard.up("Shift"); await p.waitForTimeout(250); };
    const AR = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch || {})));
    const msg = () => ev(() => document.getElementById("ppMsg").textContent);
    const panel = () => ev(() => document.getElementById("ppProps").textContent);
    const panelSet = (label, v) => ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith(label)); if (!r) return false; const i = r.querySelector("input, select"); i.value = v; i.dispatchEvent(new Event("change")); return true; }, [label, v]);
    const panelBtn = (t) => ev((t) => { const x = [...document.querySelectorAll("#ppProps button")].find((q) => q.textContent.includes(t)); if (!x) return false; x.click(); return true; }, t);
    const Mo = () => ev(() => { const M = H3PushPull.state.M, bb = PPGeo.bbox(M); return { f: M.f.length, v: M.v.length, bb, sel: H3PushPull.state.sel }; });

    /* ---- doors and windows */
    await ev(() => H3PushPull.state.V.view("top"));
    await p.keyboard.press("u"); await click([0, 0, 0]); { const [x, y] = await scr([3, 2, 0]); await p.mouse.move(x, y, { steps: 3 }); } await p.keyboard.type("4,3"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    await ev(() => { const S = H3PushPull.state, A = S.M.arch, R = A.rooms[0]; PPArch.addOp(A, "window", PPArch.OPS.window.w, { room: R.id, edge: 0, at: 2 }); S.V.setModel(S.M); S.A.rebuild(); });
    await p.keyboard.press(" ");
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "op", id: S.M.arch.ops[0].id }); });
    await p.waitForTimeout(150);
    const pn = await panel();
    const set = await panelSet("Elevation (height from floor)", "1.1"); await p.waitForTimeout(200);
    let A = await AR();
    check("a window picked: its panel has \"Elevation (height from floor)\" - 1.1 m puts it there", /Elevation \(height from floor\)/.test(pn) && set && near(A.ops[0].sill, 1.1), { set, sill: A.ops[0].sill });
    // look at the front wall from outside
    await ev(() => { const V = H3PushPull.state.V; V.cam().position.set(2, -6, 1.6); V.controls.target.set(2, 0, 1.6); V.controls.update(); V.draw(); });
    await p.waitForTimeout(150);
    let op = A.ops[0];
    const x1 = op.at + op.w / 2, zm = 1.1 + op.h / 2, yF = -0.105;
    await drag([x1, yF, zm], [x1 + 0.5, yF, zm]);
    A = await AR();
    check("drag the window's right grip: wider by 50 cm (its left side stays)", near(A.ops[0].w, op.w + 0.5, 0.03) && near(A.ops[0].at - A.ops[0].w / 2, op.at - op.w / 2, 0.02), { before: op, after: A.ops[0], msg: await msg() });
    op = A.ops[0];
    const top = 1.1 + op.h;
    await drag([op.at, yF, top], [op.at, yF, top + 0.3]);
    A = await AR();
    check("…its top grip: 30 cm taller", near(A.ops[0].h, op.h + 0.3, 0.03), { h0: op.h, after: A.ops[0] });
    op = A.ops[0];
    await drag([op.at, yF, 1.1], [op.at, yF, 0.8]);
    A = await AR();
    check("…its bottom grip: the elevation 30 cm lower, the top where it was", near(A.ops[0].sill, 0.8, 0.03) && near(A.ops[0].sill + A.ops[0].h, op.sill + op.h, 0.03), A.ops[0]);
    op = A.ops[0];
    await drag([op.at, yF, op.sill + op.h / 2 - 0.2], [op.at - 0.5, yF, op.sill + op.h / 2 - 0.5]);
    A = await AR();
    check("drag the window itself: along the wall AND up / down (its elevation)", near(A.ops[0].at, op.at - 0.5, 0.05) && near(A.ops[0].sill, op.sill - 0.3, 0.05), { before: op, after: A.ops[0] });
    await ev(() => { const S = H3PushPull.state; S.M.arch = PPArch.empty(); S.T.arch.setSel(null); S.V.setModel(S.M); S.A.rebuild(); });

    /* ---- a box: faces, edges, corners */
    await ev(() => { const S = H3PushPull.state, b = S.T.cancel; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.view("iso"); });
    await p.waitForTimeout(200);
    await click([1, 0.5, 1]);
    let m = await Mo();
    const topId = m.sel.f[0];
    check("click a face: picked, the panel shows Extrude and Twist", m.sel.f.length === 1 && /Face/.test(await panel()) && /Extrude/.test(await panel()) && /Twist/.test(await panel()), { sel: m.sel, panel: (await panel()).slice(0, 200) });
    await panelSet("Extrude", "0.5"); await p.waitForTimeout(100); await panelBtn("Extrude"); await p.waitForTimeout(250);
    m = await Mo();
    check("…Extrude +0.5: out (the box 1.5 m tall)", near(m.bb.max[2], 1.5), m.bb);
    await panelSet("Extrude", "-0.4"); await p.waitForTimeout(250);
    m = await Mo();
    check("…changed to −0.4 (it is the face just extruded): IN - a cut (0.6 m tall now)", near(m.bb.max[2], 0.6), m.bb);
    await ev(() => H3PushPull.state.T.cancel());
    // drag a face (Blender-style)
    m = await Mo();
    const fz = m.bb.max[2];
    await drag([1, 0.5, fz], [1, 0.5, fz + 0.8]);
    m = await Mo();
    check("drag a face up: it is extruded with the pointer (Blender-style)", m.bb.max[2] > fz + 0.4, { fz, bb: m.bb, msg: await msg() });
    const z2 = m.bb.max[2];
    // Ctrl+drag = twist the extrusion just made
    { const [x0, y0] = await scr([1, 0.5, z2]); await p.keyboard.down("Control"); await p.mouse.move(x0, y0, { steps: 2 }); await p.mouse.down(); await p.mouse.move(x0 + 45, y0, { steps: 6 }); await p.mouse.move(x0 + 90, y0, { steps: 6 }); await p.mouse.up(); await p.keyboard.up("Control"); await p.waitForTimeout(250); }
    const tw = await ev(() => { const S = H3PushPull.state, L = S.T.edit && S.T.edit.last ? S.T.edit.last() : null; return { last: L && { d: L.d, twist: L.twist }, tris: S.M.f.filter((F) => F.loops[0].length === 3).length, msg: document.getElementById("ppMsg").textContent }; });
    check("Ctrl+drag the face just extruded: it turns and the extrusion twists with it (its sides two triangles each)", tw.last && Math.abs(tw.last.twist) >= 30 && tw.tris >= 8, tw);

    // a fresh box for the edges
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.setSel(S.sel); S.V.view("iso"); });
    await p.waitForTimeout(200);
    await click([1, 0, 1]);
    m = await Mo();
    check("click an edge: picked (one edge), the panel shows Length, Extrude edge and Fillet", m.sel.k.length === 1 && /Edge/.test(await panel()) && /Length/.test(await panel()) && /Extrude edge/.test(await panel()) && /Fillet/.test(await panel()), { sel: m.sel, panel: (await panel()).slice(0, 300) });
    await click([2, 0.5, 1], { modifiers: ["Shift"] });
    m = await Mo();
    check("Shift+click another edge: two edges picked", m.sel.k.length === 2, m.sel);
    await click([1, 1, 1], { modifiers: ["Control"] });
    m = await Mo();
    check("Ctrl+click an edge: every edge of the loop round its face (4)", m.sel.k.length === 4, m.sel);
    // one edge: length + drag
    await click([1, 0, 1]);
    await panelSet("Length", "1"); await p.waitForTimeout(250);
    m = await Mo();
    const ek = await ev(() => { const S = H3PushPull.state, k = S.sel.k[0]; if (!k) return null; const [a, b] = k.split("_").map(Number); return [S.M.v[a], S.M.v[b]]; });
    check("…its Length 1 m: shortened about its middle (the top bends - its faces split where not flat)", ek && near(Math.hypot(ek[0][0] - ek[1][0], ek[0][1] - ek[1][1], ek[0][2] - ek[1][2]), 1) && near((ek[0][0] + ek[1][0]) / 2, 1), ek);
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.setSel(S.sel); S.V.view("iso"); });
    await p.waitForTimeout(150);
    await drag([1, 0, 1], [1, 0, 1.5], { shift: true });
    m = await Mo();
    check("drag an edge (Shift: one axis): it moves - the box's front top edge up", near(m.bb.max[2], 1.5, 0.08) && m.sel.k.length === 1, { bb: m.bb, sel: m.sel, msg: await msg() });
    // extrude edge + fillet on a fresh box
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.setSel(S.sel); S.V.view("iso"); });
    await p.waitForTimeout(150);
    await click([1, 0, 1]);
    const f0 = (await Mo()).f;
    await panelSet("Distance", "0.5"); await panelSet("Which way", "up"); await panelBtn("Extrude edge"); await p.waitForTimeout(250);
    m = await Mo();
    check("Extrude edge 0.5 m up: a new face from it (a wall on the box's edge)", m.f === f0 + 1 && near(m.bb.max[2], 1.5) && m.sel.f.length === 1, { f0, m });
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.setSel(S.sel); S.V.view("iso"); });
    await p.waitForTimeout(150);
    await click([1, 0, 1]);
    await panelSet("Radius", "0.2"); await panelSet("Pieces", "4"); await panelBtn("Fillet"); await p.waitForTimeout(250);
    m = await Mo();
    check("Fillet (radius 20 cm, 4 pieces): the edge rounded - 4 new faces, the box still closed", m.f === 10 && /rounded/.test(await msg()) && await ev(() => { const M = H3PushPull.state.M, c = new Map(); M.f.forEach((F) => F.loops.forEach((l) => PPGeo.loopEdges(l).forEach(([a, b]) => { const k = PPGeo.edgeKey(a, b); c.set(k, (c.get(k) || 0) + 1); }))); return [...c.values()].every((x) => x === 2); }), { f: m.f, msg: await msg() });

    /* ---- a corner */
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); S.sel = { f: [], e: [], k: [], p: [] }; S.V.setSel(S.sel); S.V.view("iso"); });
    await p.waitForTimeout(150);
    await click([2, 0, 1]);
    m = await Mo();
    check("click a corner: the corner picked (the panel: X / Y / Z)", m.sel.p.length === 1 && /Corner/.test(await panel()), { sel: m.sel, panel: (await panel()).slice(0, 120) });
    await panelSet("Z", "1.4"); await p.waitForTimeout(250);
    m = await Mo();
    check("…Z 1.4: it moves up (its faces split where they bend)", near(m.bb.max[2], 1.4) && m.sel.p.length === 1, { bb: m.bb, sel: m.sel });
    const cp = await ev(() => H3PushPull.state.M.v[H3PushPull.state.sel.p[0]]);
    await drag(cp, [cp[0] + 0.4, cp[1], cp[2]], { shift: true });
    m = await Mo();
    check("…dragged (Shift: one axis): it moves", near(m.bb.max[0], 2.4, 0.08), { bb: m.bb, msg: await msg() });
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
