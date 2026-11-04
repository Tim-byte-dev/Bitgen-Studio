#!/usr/bin/env node
/* bitGen Studio — 2.653.0 in a REAL browser: THE SKETCHER'S ⛰ TERRAIN - the ground made with the first click, the brush
 * (raise / Shift lower / flatten with Alt+click), contour lines drawn (closed, picked, re-levelled, erased) and the ground
 * shaped to them, a heightmap picture, the ground levelled under the rooms, the contours on the floorplan, saved and read back.
 * Tim (verbatim): "... and terrain elevation tools like contour lines and shape the ground to match the contours."
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.653.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_ter653_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
// a 64 × 16 grey ramp PNG: black on the left (west) to white on the right (east)
function rampPng() {
  const zlib = require("zlib"), W = 64, H = 16, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const v = Math.round(x / (W - 1) * 255), o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = raw[o + 1] = raw[o + 2] = v; } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
  const at = (x, y) => ev(([x, y]) => { const t = H3PushPull.state.M.arch.terrain; return t ? PPTerrain.at(t, x, y) : null; }, [x, y]);
  const onGround = async (x, y) => scr([x, y, await at(x, y)]);
  const setNum = (id, v) => ev(([id, v]) => { const i = document.getElementById(id); i.value = String(v); i.dispatchEvent(new Event("change")); }, [id, v]);
  const mode = (m) => ev((m) => document.querySelector('#ppTerModes button[data-mode="' + m + '"]').click(), m);
  const shot = async (n) => { if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, n + ".png") }); };
  const undoN = () => ev(() => H3PushPull.state.undo.length);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPTerrain && window.PPTerrainTools && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T && H3PushPull.state.TV, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, [[0, 0], [6, 0], [6, 4], [0, 4]], { name: "Cabin" });
      H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(400);

    /* ---- the tool + the ground made by the first click */
    const btn = await ev(() => { const b = document.getElementById("ppT_terrain"); const sep = [...document.querySelectorAll("#ppTools .pptsep")].map((x) => x.textContent); return b && { icon: b.textContent, title: b.title, sep }; });
    check("⛰ Terrain on the toolbar (Alt+G) after a 'Ground' separator", btn && btn.icon === "⛰" && /\(Alt\+G\)/.test(btn.title) && btn.sep.includes("Ground"), btn);
    const cc = await scr([3, 2, 0]); await p.mouse.move(cc[0], cc[1]); await ev(() => H3PushPull.state.V.canvas.focus()); await p.keyboard.press("Alt+g"); await p.waitForTimeout(150);
    const p0 = await ev(() => ({ tool: H3PushPull.state.T.name(), make: !!document.getElementById("ppTerMake"), shown: getComputedStyle(document.getElementById("ppProps")).display }));
    check("Alt+G = the Terrain tool; no ground yet: its panel offers ＋ Make the ground", p0.tool === "terrain" && p0.make && p0.shown === "block", p0);
    const c0 = await scr([3, 2, 0]); await p.mouse.click(c0[0], c0[1]); await p.waitForTimeout(400);
    const g0 = await ev(() => { const S = H3PushPull.state, t = S.M.arch.terrain, m = S.V.scene.getObjectByName("pp-terrain"); return t && { nx: t.nx, ny: t.ny, cell: t.cell, x0: t.x0, y0: t.y0, z: t.h[0], col: t.col, meshes: m ? m.children.filter((c) => c.isMesh).length : 0, modes: !!document.getElementById("ppTerModes") }; });
    check("the first click makes the ground round the building (≥ 40 m, 0.5 m cells), just under its floor, grass - in the view and the panel's modes",
      g0 && g0.nx * g0.cell >= 40 && g0.cell === 0.5 && g0.x0 < -10 && g0.y0 < -10 && Math.abs(g0.z + 0.03) < 1e-6 && g0.col === "mat:grass" && g0.meshes === 1 && g0.modes, g0);
    await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(200);

    /* ---- ⬆ raise: a drag across the ground (one undo step) */
    await mode("raise"); await setNum("ppTerR", 4); await setNum("ppTerS", 0.3);
    const u0 = await undoN(), h0 = await at(12, 2);
    const a = await onGround(10, 2), bb = await onGround(14, 2);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(a[0] + (bb[0] - a[0]) * k / 8, a[1] + (bb[1] - a[1]) * k / 8); await p.mouse.up(); await p.waitForTimeout(250);
    const h1 = await at(12, 2), far = await at(-12, -12), u1 = await undoN();
    check("⬆ Raise: a drag lifts the ground under the brush (not far from it) - one ↶ step", h1 - h0 > 0.3 && Math.abs(far + 0.03) < 1e-6 && u1 === u0 + 1, { h0, h1, far, u0, u1 });
    const ring = await ev(() => !!H3PushPull.state.V.scene.getObjectByName("pp-terrain-ui").children.length);
    check("…the brush's circle follows the pointer on the ground", ring);
    // Shift = the other way
    const a2 = await onGround(12, 2); await p.keyboard.down("Shift"); await p.mouse.move(a2[0], a2[1]); await p.mouse.down(); await p.mouse.move(a2[0] + 3, a2[1] + 1); await p.mouse.up(); await p.keyboard.up("Shift"); await p.waitForTimeout(200);
    const h2 = await at(12, 2);
    check("…Shift+drag lowers it", h2 < h1 - 0.1, { h1, h2 });
    await ev(() => H3PushPull.undo()); await ev(() => H3PushPull.undo()); await p.waitForTimeout(200);
    check("↶ twice: the ground as it was", Math.abs((await at(12, 2)) - h0) < 1e-6, await at(12, 2));

    /* ---- ▬ flatten: Alt+click takes the height */
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), t = S.M.arch.terrain; PPTerrain.brush(t, "raise", -10, 8, 3, 1.5); H3PushPull.commit("sculpt", b0); });
    await mode("flatten"); const fz = await at(-10, 8); const fp = await onGround(-10, 8);
    await p.keyboard.down("Alt"); await p.mouse.click(fp[0], fp[1]); await p.keyboard.up("Alt"); await p.waitForTimeout(150);
    const tg = await ev(() => ({ o: H3PushPull.state.T.terrain.opts.target, box: +document.getElementById("ppTerTarget").value }));
    check("▬ Flatten: Alt+click the ground = its height in the panel", Math.abs(tg.o - fz) < 0.05 && Math.abs(tg.box - tg.o) < 1e-3, { tg, fz });

    /* ---- 〰 contours: a closed line at 2 m, the ground shaped to it */
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch.terrain.h = S.M.arch.terrain.h.map(() => 0); H3PushPull.commit("ground", b0); });
    await mode("contour"); await setNum("ppTerZ", 2); await setNum("ppTerStep", 1);
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); }); await p.waitForTimeout(250);
    const ring2 = [[-14, -14], [-6, -14], [-6, -6], [-14, -6]];
    for (const q of ring2) { const s = await scr([q[0], q[1], 2]); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(80); }
    const dr = await ev(() => H3PushPull.state.T.terrain.state().draft);
    check("〰 Contour: the clicks draw a line at its elevation (shown while drawn)", dr && dr.pts.length === 4 && dr.z === 2, dr);
    const s0 = await scr([-14, -14, 2]); await p.mouse.click(s0[0], s0[1]); await p.waitForTimeout(300);
    const C1 = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { cs: t.contours.map((c) => ({ z: c.z, n: c.pts.length, closed: c.closed })), mid: PPTerrain.at(t, -10, -10), edge: PPTerrain.at(t, -14, -10), next: H3PushPull.state.T.terrain.opts.cz }; });
    check("…a click on its start closes it - the ground shaped to it (2 m on and inside the line), the next line's elevation +1 m",
      C1.cs.length === 1 && C1.cs[0].closed && C1.cs[0].n === 4 && C1.cs[0].z === 2 && Math.abs(C1.mid - 2) < 0.05 && Math.abs(C1.edge - 2) < 0.05 && C1.next === 3, C1);
    // an open line at 0 by double-click
    await setNum("ppTerZ", 0);
    for (const q of [[8, -18], [8, 18]]) { const s = await scr([q[0], q[1], 0]); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(80); }
    const s3 = await scr([18, 18, 0]); await p.mouse.dblclick(s3[0], s3[1]); await p.waitForTimeout(300);
    const C2 = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { cs: t.contours.map((c) => ({ z: c.z, n: c.pts.length, closed: c.closed })), between: PPTerrain.at(t, 0, -10), tool: H3PushPull.state.T.name() }; });
    check("…an open line ended by a double-click (the tool kept); between the lines the ground slopes 2 -> 0 m",
      C2.cs.length === 2 && !C2.cs[1].closed && C2.cs[1].n === 3 && C2.between > 0.2 && C2.between < 1.8 && C2.tool === "terrain", C2);
    await shot("ter653-contours");
    // pick + re-level + delete
    const sp = await scr([-10, -14, 2]); await p.mouse.click(sp[0], sp[1]); await p.waitForTimeout(200);
    const pk = await ev(() => ({ id: H3PushPull.state.T.terrain.picked(), box: !!document.getElementById("ppTerCz") }));
    check("…a click on a drawn line picks it (its elevation in the panel)", pk.id != null && pk.box, pk);
    await setNum("ppTerCz", 3); await p.waitForTimeout(200);
    const C3 = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { z: t.contours[0].z, mid: PPTerrain.at(t, -10, -10) }; });
    check("…its elevation changed to 3 m - the ground follows", C3.z === 3 && Math.abs(C3.mid - 3) < 0.05, C3);
    await ev(() => H3PushPull.state.V.canvas.focus()); await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    const C4 = await ev(() => H3PushPull.state.M.arch.terrain.contours.map((c) => c.z));
    check("…Delete erases the picked line", C4.length === 1 && C4[0] === 0, C4);
    // Esc drops a line being drawn and goes to Orbit
    const e1 = await scr([0, 10, 0]); await p.mouse.click(e1[0], e1[1]); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    const es = await ev(() => ({ tool: H3PushPull.state.T.name(), n: H3PushPull.state.M.arch.terrain.contours.length, ui: H3PushPull.state.V.scene.getObjectByName("pp-terrain-ui").children.length }));
    check("Esc: the line being drawn is dropped, the tool is 🔄 Orbit", es.tool === "orbit" && es.n === 1 && es.ui === 0, es);

    /* ---- 🖼 heightmap */
    await ev(() => H3PushPull.state.T.use("terrain")); await mode("raise"); await setNum("ppTerLo", 0); await setNum("ppTerHi", 5);
    await p.setInputFiles("#ppTerFile", { name: "ramp.png", mimeType: "image/png", buffer: rampPng() });
    await p.waitForFunction(() => { const t = H3PushPull.state.M.arch.terrain; return Math.abs(PPTerrain.at(t, t.x0 + t.nx * t.cell, t.y0) - 5) < 0.05; }, null, { timeout: 8000 }).catch(() => {});
    const hm = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { w: PPTerrain.at(t, t.x0, t.y0 + 5), e: PPTerrain.at(t, t.x0 + t.nx * t.cell, t.y0 + 5), mid: PPTerrain.at(t, t.x0 + t.nx * t.cell / 2, t.y0 + 5) }; });
    check("🖼 a heightmap picture: black (west) = Lowest 0 m, white (east) = Highest 5 m, grey between", Math.abs(hm.w) < 0.05 && Math.abs(hm.e - 5) < 0.05 && hm.mid > 2 && hm.mid < 3, hm);

    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(300); await shot("ter653-iso"); }
    /* ---- ⌂ level under the rooms */
    await ev(() => document.getElementById("ppTerLevel").click()); await p.waitForTimeout(200);
    const lv = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return [PPTerrain.at(t, 3, 2), PPTerrain.at(t, 1, 1), PPTerrain.at(t, 5, 3)]; });
    check("⌂ Level under the rooms: the ground under the cabin just below its floor", lv.every((z) => Math.abs(z + 0.03) < 0.01), lv);

    /* ---- the floorplan shows the contours */
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    const pl = await ev(() => { const S = H3PushPull.state, g = S.V.scene.getObjectByName("pp-plan"), tr = S.V.scene.getObjectByName("pp-terrain"); return { on: S.P.on(), contour: g.children.filter((c) => (c.isLine || c.isLineSegments) && c.renderOrder === 2.5).length, labels: g.children.filter((c) => c.isSprite).length, hid: tr.visible }; });
    check("📐 the floorplan: the ground's contour lines drawn under the plan (the 3D ground hidden)", pl.on && pl.contour > 10 && pl.labels > 1 && pl.hid === false, pl);
    await shot("ter653-plan");
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(300);

    /* ---- material, sides, remove + saved */
    await ev(() => { const i = document.getElementById("ppTerSides"); i.checked = false; i.dispatchEvent(new Event("change")); }); await p.waitForTimeout(150);
    const sd = await ev(() => H3PushPull.state.M.arch.terrain.sides);
    check("☐ Earth sides turns the ground's edges off", sd === false, sd);
    await ev(() => H3PushPull.save(true)); await p.waitForTimeout(300);
    const nm = await ev(() => H3PushPull.state.name);
    const saved = await api("/api/pushpull/" + encodeURIComponent(nm));
    const T2 = saved.model && saved.model.arch && saved.model.arch.terrain;
    check("saved: the ground (its heights, contours, settings) is in the .pp3d", T2 && T2.h.length === (T2.nx + 1) * (T2.ny + 1) && T2.contours.length === 1 && T2.sides === false, T2 && { n: T2.h.length, c: T2.contours.length });
    const glb = await ev(() => { const m = H3PushPull.meshes(); return m.filter((x) => x.name === "Ground").length; });
    check("the ground goes out with the model (.glb / sends)", glb === 1, glb);
    await ev(() => document.getElementById("ppTerRemove").click()); await p.waitForTimeout(200);
    const gone = await ev(() => ({ t: H3PushPull.state.M.arch.terrain, m: H3PushPull.state.V.scene.getObjectByName("pp-terrain").children.length }));
    await ev(() => H3PushPull.undo()); await p.waitForTimeout(200);
    const back = await ev(() => !!H3PushPull.state.M.arch.terrain);
    check("🗑 Remove the ground (the view empties) - ↶ brings it back", gone.t === null && gone.m === 0 && back, { gone, back });

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
