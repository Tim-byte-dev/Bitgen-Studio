#!/usr/bin/env node
/* bitGen Studio — 2.673.0 in a REAL browser: THE 🛤 ROAD TOOL - the six types as pictures, an avenue clicked over a hill
 * (too steep: ⚠ + ⛏ Cut the ground / 🚇 Tunnel in the panel), cut to an even grade (the ground cut), a road drawn across it
 * (a junction: traffic lights + signs built), Alt+click a road + drag a point, a road picked with Select (its panel), the
 * floorplan draws them.
 * Tim (verbatim): "in sketcher add a road tool like Sim City's road tool, to draw roads on the map, roads will follow the
 * contour of the ground unless too steep, then offer a tunnel or cut the terrain to pass. offer several types of roads just
 * like sim city, autoplace traffic lights  and signs etc"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: pictures. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.673.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_roads673_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scrG = (x, y, dz) => ev(([x, y, dz]) => { const S = H3PushPull.state, t = S.M.arch.terrain, z = (t ? PPTerrain.at(t, x, y) : 0) + (dz || 0), s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y, dz]);
  const clickAt = async (x, y, opt) => { const s = await scrG(x, y); await p.mouse.click(s[0], s[1], opt); await p.waitForTimeout(90); };
  const parts = () => ev(() => { const c = {}; PPArch.build(H3PushPull.state.M.arch).polys.forEach((q) => { if (q.tag && q.tag.ak === "road") c[q.tag.part] = (c[q.tag.part] || 0) + 1; }); return c; });
  const shot = async (name) => { if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, "roads673-" + name + ".png") }); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPRoads && window.PPRoadTools && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); localStorage.removeItem("pp.roadopt"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV, null, { timeout: 40000 });
    // a hill 12 m high, 30 % slopes, in a 120 x 80 m ground
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const t = A.terrain = PPTerrain.clean({ x0: -60, y0: -40, cell: 1, nx: 120, ny: 80 });
      for (let j = 0; j <= 80; j++) for (let i = 0; i <= 120; i++) { const x = -60 + i; t.h[j * 121 + i] = Math.max(0, 12 - Math.abs(x) * 0.3); } H3PushPull.commit("ground", b0); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(300);
    await ev(() => document.getElementById("ppT_road").click()); await p.waitForTimeout(200);
    const types = await ev(() => [...document.querySelectorAll("#ppProps .pproads button")].map((x) => ({ t: x.dataset.road, svg: !!x.querySelector("svg"), on: x.classList.contains("on") })));
    check("🛤 Road: the six types as pictures - Dirt, Street, Road (picked), One-way, Avenue, Highway", types.map((x) => x.t).join() === "dirt,street,road,oneway,avenue,highway" && types.every((x) => x.svg) && types.find((x) => x.on).t === "road", types);
    await ev(() => document.querySelector('#ppProps .pproads button[data-road="avenue"]').click()); await p.waitForTimeout(150);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    await clickAt(-50, 0); await clickAt(0, 0.5);
    const s3 = await scrG(50, 0); await p.mouse.dblclick(s3[0], s3[1]); await p.waitForTimeout(500);
    const r1 = await ev(() => { const S = H3PushPull.state, r = (S.M.arch.roads || [])[0]; return r && { type: r.type, mode: r.mode, n: r.nodes.length, steep: PPRoads.profile(S.M.arch, r).steep, undo: S.undo.length, status: (document.getElementById("ppStatus") || {}).textContent || "", btn: [...document.querySelectorAll("#ppProps button")].map((x) => x.textContent) }; });
    check("clicked over the hill + a double-click: ONE avenue on the ground, flagged too steep (30 % > 8 %), one ↶ step", r1 && r1.type === "avenue" && r1.mode === "follow" && r1.n === 3 && r1.steep && r1.undo === u0 + 1, r1);
    check("…the panel offers ⛏ Cut the ground and 🚇 Tunnel / bridge", r1 && r1.btn.includes("⛏ Cut the ground") && r1.btn.includes("🚇 Tunnel / bridge"), r1 && r1.btn);
    await shot("steep");
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => x.textContent === "⛏ Cut the ground").click()); await p.waitForTimeout(500);
    const r2 = await ev(() => { const S = H3PushPull.state, A = S.M.arch, r = A.roads[0], pr = PPRoads.profile(A, r); return { mode: r.mode, grade: pr.grade, cut: r.cut, top: PPTerrain.at(A.terrain, 0, 0), undo: S.undo.length }; });
    check("⛏ Cut the ground: an even grade (≤ 8 %), the hill cut down under it, one more ↶ step", r2.mode === "cut" && r2.grade <= 0.082 && r2.cut > 100 && r2.top < 11 && r2.undo === u0 + 2, r2);
    // a road across it: a junction with traffic lights
    await ev(() => document.querySelector('#ppProps .pproads button[data-road="road"]').click()); await p.waitForTimeout(150);
    await clickAt(-30, -30); const s4 = await scrG(-30, 30); await p.mouse.dblclick(s4[0], s4[1]); await p.waitForTimeout(500);
    const J = await ev(() => PPRoads.junctions(H3PushPull.state.M.arch).filter((j) => j.arms.length >= 3).map((j) => ({ kind: j.kind, n: j.arms.length })));
    const pt = await parts();
    check("a road drawn across the avenue: a junction with traffic lights on its four approaches, signs + crossings built", J.length === 1 && J[0].kind === "signal" && J[0].n === 4 && pt.sign > 20 && pt.crossing > 0 && pt.junction === 1, { J, pt });
    await shot("junction");
    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state, z = PPTerrain.at(S.M.arch.terrain, -30, 0), n = [0.5, -0.75, 0.45], L = Math.hypot(...n); S.V.lookAlong(n.map((x) => x / L), [-30, 0, z + 2], 30); }); await p.waitForTimeout(500); await shot("lights"); await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); }); await p.waitForTimeout(300); }
    // Alt+click the road: its points; drag one
    await ev(() => H3PushPull.state.V.canvas.focus());
    await p.keyboard.down("Alt"); await clickAt(-30, 10); await p.keyboard.up("Alt"); await p.waitForTimeout(200);   // mouse.click takes no modifiers
    const ed = await ev(() => { const S = H3PushPull.state, T = S.T.terrain.roads(); return { id: T.editing(), want: S.M.arch.roads[1].id, draft: !!T.state().draft }; });
    const n0 = await ev(() => H3PushPull.state.M.arch.roads[1].nodes[0].p);
    const a = await scrG(n0[0], n0[1], 0.12), bb = await scrG(n0[0] + 5, n0[1] - 4, 0.12);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(bb[0], bb[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
    const n1 = await ev(() => H3PushPull.state.M.arch.roads[1].nodes[0].p);
    check("Alt+click a road: its points shown; a point dragged moves it (the road graded again)", ed.id === ed.want && Math.abs(n1[0] - (n0[0] + 5)) < 0.6 && Math.abs(n1[1] - (n0[1] - 4)) < 0.6, { ed, n0, n1 });
    // ➤ Select a road: its panel
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "road", id: S.M.arch.roads[0].id }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const head = await ev(() => { const h = document.querySelector("#ppProps .pph"); return h ? h.textContent : ""; });
    const labs = await ev(() => [...document.querySelectorAll("#ppProps .ppr > span")].map((s) => s.textContent));
    check("➤ Select a road: its panel - name, type, past steep ground, curved, lights + signs, which side traffic keeps to", /^🛤 Avenue 1 · \d+/.test(head) && ["Name", "Type", "Past steep ground", "Traffic lights + signs (every road)", "Traffic keeps to the"].every((l) => labs.includes(l)), { head, labs });
    const plan = await ev(() => { const P = PPPlan.symbols(H3PushPull.state.M.arch, 0); return { fills: P.fills.filter((f) => f.tag && f.tag.ak === "road").length, names: P.texts.filter((t) => /Avenue 1|Road 1/.test(t.t)).length }; });
    check("the floorplan: both roads filled + named", plan.fills === 2 && plan.names === 2, plan);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
