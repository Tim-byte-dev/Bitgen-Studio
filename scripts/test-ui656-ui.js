#!/usr/bin/env node
/* bitGen Studio — 2.656.0 in a REAL browser: THE SKETCHER'S ✂ CUT / FILL - a pad drawn on a sloping ground (corners, back on
 * the first), flat at the mean level, cut + filled with batters, one ↶ step; picked, re-levelled from the panel, its outline
 * forgotten with Delete; on the floorplan. Tim (verbatim): "can you add a cut/fill landscaping tool to sketcher"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.656.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_pad656_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const at = (x, y) => ev(([x, y]) => PPTerrain.at(H3PushPull.state.M.arch.terrain, x, y), [x, y]);
  const scrG = async (x, y) => { const z = await at(x, y); return ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, z]); };
  const setNum = (id, v) => ev(([id, v]) => { const i = document.getElementById(id); i.value = String(v); i.dispatchEvent(new Event("change")); }, [id, v]);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPTerrain && PPTerrain.addPad && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV, null, { timeout: 40000 });
    // a ground sloping up to the east (+1 m every 10 m)
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const t = A.terrain = PPTerrain.clean({ x0: -15, y0: -15, cell: 0.5, nx: 60, ny: 60 });
      for (let j = 0; j <= 60; j++) for (let i = 0; i <= 60; i++) t.h[j * 61 + i] = (i - 30) * 0.05; H3PushPull.commit("ground", b0); S.V.view("top"); S.V.extents(); S.T.use("terrain"); });
    await p.waitForTimeout(400);
    await ev(() => document.querySelector('#ppTerModes button[data-mode="pad"]').click()); await p.waitForTimeout(150);
    const pm = await ev(() => ({ auto: !!document.getElementById("ppPadAuto"), b: !!document.getElementById("ppPadNewBatter") }));
    check("✂ Cut / fill in the Terrain modes: its panel (level = the mean, batter, earthworks)", pm.auto && pm.b, pm);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    for (const c of [[-4, -3], [4, -3], [4, 3], [-4, 3], [-4, -3]]) { const s = await scrG(c[0], c[1]); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(90); }
    await p.waitForTimeout(300);
    const r = await ev(() => { const S = H3PushPull.state, t = S.M.arch.terrain, q = t.pads[0]; return q && { z: q.z, cut: q.cut, fill: q.fill, n: q.pts.length, mid: PPTerrain.at(t, 0, 0), e: PPTerrain.at(t, 3.5, 0), w: PPTerrain.at(t, -3.5, 0), far: PPTerrain.at(t, 13, 0), undo: S.undo.length, z0: !!document.getElementById("ppPadZ") }; });
    check("the corners + back on the first: ONE pad - flat inside at the mean level, cut on the high side, filled on the low side, far ground untouched, one ↶ step",
      r && r.n === 4 && Math.abs(r.z) < 0.05 && Math.abs(r.e - r.z) < 0.01 && Math.abs(r.w - r.z) < 0.01 && r.cut > 1 && r.fill > 1 && Math.abs(r.far - 1.3) < 1e-6 && r.undo === u0 + 1 && r.z0, { r, u0 });
    // picked: a new level from the panel
    await setNum("ppPadZ", 0.5); await p.waitForTimeout(250);
    const r2 = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { z: t.pads[0].z, mid: PPTerrain.at(t, 0, 0), e: PPTerrain.at(t, 3.5, 2) }; });
    check("the picked pad's Level 0.5 m - cut / filled again, flat at it", r2.z === 0.5 && Math.abs(r2.mid - 0.5) < 1e-3 && Math.abs(r2.e - 0.5) < 1e-3, r2);
    // the floorplan shows it
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    const pl = await ev(() => { const g = H3PushPull.state.V.scene.getObjectByName("pp-plan"); return { dashed: g.children.filter((c) => c.material && c.material.isLineDashedMaterial).length, sprites: g.children.filter((c) => c.isSprite).length }; });
    check("📐 the floorplan: the pad's dashed outline + its labels", pl.dashed >= 1 && pl.sprites >= 2, pl);
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(300);
    // click inside it = picked; Delete forgets the outline (the ground keeps its shape)
    await ev(() => H3PushPull.state.T.terrain.escape()); await ev(() => H3PushPull.state.T.use("terrain"));
    await ev(() => document.querySelector('#ppTerModes button[data-mode="pad"]').click());
    const s0 = await scrG(0, 1); await p.mouse.click(s0[0], s0[1]); await p.waitForTimeout(150);
    const pk = await ev(() => ({ picked: H3PushPull.state.T.terrain.state(), box: !!document.getElementById("ppPadZ") }));
    check("a click inside a pad picks it (its panel)", pk.box, pk);
    await ev(() => H3PushPull.state.V.canvas.focus()); await p.mouse.move(s0[0], s0[1]); await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    const fg = await ev(() => { const t = H3PushPull.state.M.arch.terrain; return { n: t.pads.length, mid: PPTerrain.at(t, 0, 0) }; });
    check("Delete forgets the outline - the ground keeps its shape", fg.n === 0 && Math.abs(fg.mid - 0.5) < 1e-3, fg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
