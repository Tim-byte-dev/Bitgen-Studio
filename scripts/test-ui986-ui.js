#!/usr/bin/env node
/* bitGen Studio — 2.986.0 in a REAL browser: ✂ Separate (a picked group at once; a click on an imported model's group - split
 * by its meshes' names); ↶ puts it back; the arrow keys: ↑ ↓ ← → pan, Ctrl+↑ / ↓ zoom, Ctrl+← everything in view, Ctrl+→ to
 * what is picked. Tim: "in sketcher can you add a tool the will separate a selected layer into layers. use arrows for zoom in
 * out pan left and right. crtl + up arrow zooms in, ctrl+down arrow zooms out, ctrl + left resets zoom, ctrl + right zooms to
 * selected . up,down left and right pan" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
/** our own little glTF: a seat (a flat quad) and two legs (two quads) - meshes "Seat" and "Leg", the legs touching the seat */
function chairGltf() {
  const quads = [[[0, 0.5, 0], [1, 0.5, 0], [1, 0.5, 1], [0, 0.5, 1]], [[0, 0, 0], [0.1, 0, 0], [0.1, 0.5, 0], [0, 0.5, 0]], [[0.9, 0, 0], [1, 0, 0], [1, 0.5, 0], [0.9, 0.5, 0]]];
  const tri = (q) => [q[0], q[1], q[2], q[0], q[2], q[3]];
  const seat = tri(quads[0]), legs = tri(quads[1]).concat(tri(quads[2]));
  const f = (pts) => Buffer.from(new Float32Array([].concat(...pts)).buffer);
  const b1 = f(seat), b2 = f(legs), buf = Buffer.concat([b1, b2]);
  const mm = (pts) => ({ min: [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k]))) });
  return JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0, 1] }], nodes: [{ name: "Seat", mesh: 0 }, { name: "Leg", mesh: 1 }],
    meshes: [{ name: "Seat", primitives: [{ attributes: { POSITION: 0 } }] }, { name: "Leg", primitives: [{ attributes: { POSITION: 1 } }] }],
    accessors: [Object.assign({ bufferView: 0, componentType: 5126, count: seat.length, type: "VEC3" }, mm(seat)), Object.assign({ bufferView: 1, componentType: 5126, count: legs.length, type: "VEC3" }, mm(legs))],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: b1.length }, { buffer: 0, byteOffset: b1.length, byteLength: b2.length }],
    buffers: [{ byteLength: buf.length, uri: "data:application/octet-stream;base64," + buf.toString("base64") }] });
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1900, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const groups = () => ev(() => H3PushPull.state.M.g.map((g) => g.name).sort());
  const cam = () => ev(() => { const V = H3PushPull.state.V, c = V.cam(), t = V.controls.target; return { t: [t.x, t.y, t.z], d: c.position.distanceTo(t) / (c.zoom || 1) }; });
  let vb = null;
  const key = async (k) => { await p.mouse.move(vb.l + vb.w / 2, vb.t + vb.h / 2); await p.keyboard.press(k); await p.waitForTimeout(80); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V && document.getElementById("ppT_separate"), null, { timeout: 40000 });
    await p.waitForTimeout(1500);                                         // the last model opens first - then a new one
    await ev(() => H3PushPull.newModel()); await p.waitForFunction(() => H3PushPull.state.M.f.length === 0 && !H3PushPull.state.M.g.length, null, { timeout: 10000 });
    vb = await ev(() => { const r = document.getElementById("ppView").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });

    // two boxes as ONE group, picked -> ✂ splits them at once
    await ev(() => {
      const G = PPGeo, S = H3PushPull.state, before = H3PushPull.snapshot();
      for (const x of [0, 3]) { const F = G.addFace(S.M, [[x, 0, 0], [x + 1, 0, 0], [x + 1, 1, 0], [x, 1, 0]]); G.pushPull(S.M, F.id, 1); }
      G.group(S.M, { f: S.M.f.map((f) => f.id) }, "Two boxes"); H3PushPull.commit("test", before);
      H3PushPull.setSel({ f: S.M.f.map((f) => f.id) });
    });
    check("✂ Separate is in the toolbox (after 🔍 Zoom)", await ev(() => { const z = document.getElementById("ppT_zoom"), s = document.getElementById("ppT_separate"); return !!s && z.nextElementSibling === s && /Separate/.test(s.title); }));
    await p.click("#ppT_separate"); await p.waitForTimeout(200);
    check("a group picked + ✂: a group per loose piece (\"Two boxes 1 / 2\"), back to ➤ Select", (await groups()).join() === "Two boxes 1,Two boxes 2" && (await ev(() => H3PushPull.state.T.name())) === "select" && /separated into 2 groups/.test(await ev(() => document.getElementById("ppMsg").textContent)), await groups());
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("Ctrl+Z: one group again (one undo step)", (await groups()).join() === "Two boxes", await groups());

    // an imported model: ✂ then a click on it -> split by its meshes' names
    await ev(async (txt) => { const u = URL.createObjectURL(new Blob([txt], { type: "model/gltf+json" })); await H3PushPull.importModel("chair.gltf", u); }, chairGltf());
    await p.waitForTimeout(300);
    const nm = await ev(() => [...new Set(H3PushPull.state.M.f.filter((f) => f.grp === H3PushPull.state.M.g.find((g) => g.name === "chair").id).map((f) => f.nm))].sort());
    check("⤒ an import keeps each mesh's name on its faces", nm.join() === "Leg,Seat", nm);
    await ev(() => H3PushPull.setSel({})); await p.click("#ppT_separate");
    const at = await ev(() => { const S = H3PushPull.state, gid = S.M.g.find((g) => g.name === "chair").id, F = S.M.f.find((f) => f.grp === gid && f.nm === "Seat"); const c = [0, 1, 2].map((k) => F.loops[0].reduce((a, v) => a + S.M.v[v][k], 0) / F.loops[0].length); S.V.frameBox({ min: c.map((v) => v - 0.6), max: c.map((v) => v + 0.6) }); const s = S.V.screen(c), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.mouse.click(at[0], at[1]); await p.waitForTimeout(250);
    check("✂ + a click on the imported chair: split BY ITS MESHES - \"chair · Seat\" + \"chair · Leg\" (both legs one group)", (await groups()).filter((n) => /^chair/.test(n)).join() === "chair · Leg,chair · Seat", await groups());

    // the arrow keys
    await ev(() => { H3PushPull.setSel({}); H3PushPull.state.V.view("iso"); H3PushPull.state.V.extents(); }); await p.waitForTimeout(100);
    const a0 = await cam(); await key("ArrowUp"); const a1 = await cam();
    check("↑ pans up (the target rises in this view, the distance kept)", a1.t[2] > a0.t[2] + 0.05 && Math.abs(a1.d - a0.d) < 1e-6, [a0, a1]);
    await key("ArrowDown"); const a2 = await cam();
    check("↓ pans back", a2.t.every((v, i) => Math.abs(v - a0.t[i]) < 1e-6), [a0, a2]);
    await key("ArrowRight"); const a3 = await cam(); await key("ArrowLeft"); const a4 = await cam();
    check("→ / ← pan sideways and back", Math.hypot(a3.t[0] - a0.t[0], a3.t[1] - a0.t[1]) > 0.1 && a4.t.every((v, i) => Math.abs(v - a0.t[i]) < 1e-6), [a3, a4]);
    await key("Control+ArrowUp"); const z1 = await cam(); await key("Control+ArrowDown"); await key("Control+ArrowDown"); const z2 = await cam();
    check("Ctrl+↑ zooms in, Ctrl+↓ zooms out", a4.d / z1.d > 1.1 && z2.d / z1.d > 1.25, [a4.d, z1.d, z2.d]);
    await key("ArrowLeft"); await key("ArrowLeft"); await key("Control+ArrowUp");
    await key("Control+ArrowLeft"); const r1 = await cam();
    check("Ctrl+← resets: everything in view again (as ⤢)", r1.t.every((v, i) => Math.abs(v - a0.t[i]) < 1e-6) && Math.abs(r1.d - a0.d) < 1e-6, [a0, r1]);
    await ev(() => { const S = H3PushPull.state, g = S.M.g.find((x) => x.name === "Two boxes"); H3PushPull.setSel({ f: S.M.f.filter((f) => f.grp === g.id).map((f) => f.id) }); });
    await key("Control+ArrowRight"); const s1 = await cam();
    check("Ctrl+→ zooms to what is picked (the boxes)", s1.d < r1.d && /zoomed to/.test(await ev(() => document.getElementById("ppMsg").textContent)), [r1, s1]);
    // a line half-way: plain arrows keep the axis, Ctrl+arrows still move the view
    await ev(() => { H3PushPull.setSel({}); H3PushPull.tool("line"); });
    await p.mouse.click(vb.l + vb.w / 2, vb.t + vb.h / 2 + 30); await p.waitForTimeout(80);
    const l0 = await cam(); await key("ArrowRight"); const l1 = await cam();
    check("a line half-way: → keeps the red axis, the view stays", l1.t.every((v, i) => v === l0.t[i]) && /red axis/.test(await ev(() => document.getElementById("ppMsg").textContent)));
    await key("Control+ArrowDown"); const l2 = await cam();
    check("…Ctrl+↓ still zooms out", l2.d > l1.d * 1.1);
    await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
