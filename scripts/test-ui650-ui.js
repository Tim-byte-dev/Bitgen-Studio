#!/usr/bin/env node
/* bitGen Studio — 2.650.0 in a REAL browser: THE SKETCHER HIGHLIGHTS WHAT IS PICKED (the accent) AND WHAT IS UNDER THE POINTER
 * (blue - not over a picked one), in 3D and on the 📐 floorplan.
 * Tim (verbatim): "when an object is selected like a wall etc, highlight it so user knows they have selected the object same in
 * floorplan view, hover over object highlights the object in a different color unless it is selected".
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: pictures there. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.650.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_hl650_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
  const px = async (w) => { await p.waitForTimeout(150); return ev((w) => { const V = H3PushPull.state.V; V.R.render(V.scene, V.cam()); const s = V.screen(w), c = V.canvas, k = c.width / c.getBoundingClientRect().width, t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(Math.round(s[0] * k), Math.round(s[1] * k), 1, 1).data; return [d[0], d[1], d[2]]; }, w); };
  // the highlight meshes now drawn: {acc: tinted in the accent, blue: tinted blue} (3D: the arch view's selection group; plan: its own)
  const tints = (plan) => ev((plan) => { const V = H3PushPull.state.V, acc = new V.T.Color(V.theme.accent || "#f59e2c").getHex(); const g = plan ? V.scene.getObjectByName("pp-plan-hl") : null; let a = 0, bl = 0;
    const walk = (o) => o.traverse((x) => { if (x.isMesh && x.material && x.material.transparent && x.material.color && x.material.opacity < 0.6) { const h = x.material.color.getHex(); if (h === acc) a++; if (h === 0x3b82f6) bl++; } });
    if (plan) walk(g); else V.scene.children.forEach((c) => { if (c.type === "Group" && !c.name) walk(c); });
    return { acc: a, blue: bl }; }, plan);
  const shot = async (n) => { if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, n + ".png") }); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T && H3PushPull.state.P, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" }); PPArch.addRoom(A, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "Bed" });
      A.items = [PPFurn.make("bed_queen", [7, 2], 0, 0)]; A.items[0].id = A.n++; H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); S.T.use("select"); S.A.cut(true); });
    await p.waitForTimeout(500);

    /* ---- 3D: a wall picked = tinted in the accent */
    const wallPt = [0, 2, 1.2];                                                       // the kitchen's west wall, outside face
    const before = await px([-0.08, 2.6, 0.5]);
    let [x, y] = await scr([-0.08, 2.6, 0.5]); await p.mouse.move(x, y); await p.waitForTimeout(150);
    const hov = await tints(false);
    check("3D: the wall under the pointer is tinted BLUE (hover)", hov.blue >= 1 && hov.acc === 0, hov);
    await p.mouse.click(x, y); await p.waitForTimeout(250);
    const sel = await ev(() => H3PushPull.state.T.arch.sel()), t1 = await tints(false), after = await px([-0.08, 2.6, 0.5]);
    check("3D: clicked - that wall is picked and tinted in the accent; no blue over it (hover on a picked thing shows the pick)", sel && sel.part === "wall" && t1.acc >= 1 && t1.blue === 0, { sel, t1 });
    const accRGB = await ev(() => { const c = new H3PushPull.state.V.T.Color(H3PushPull.state.V.theme.accent || "#f59e2c"); return [c.r * 255, c.g * 255, c.b * 255]; });
    const toward = (a, b, c) => Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]) < Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) - 10;
    check("…you can see it: the wall's colour moves toward the accent", toward(before, after, accRGB), { before, after, accRGB });
    await shot("hl650-3d");
    [x, y] = await scr([7, 4.08, 1.2]); await p.mouse.move(x, y); await p.waitForTimeout(200);
    const t2 = await tints(false);
    check("…another thing hovered while one is picked: the picked stays accent, the hovered is blue", t2.acc >= 1 && t2.blue >= 1, t2);
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "item", id: S.M.arch.items[0].id }); }); await p.mouse.move(5, 5); await ev(() => H3PushPull.state.A.setHover(null)); await p.waitForTimeout(200);
    check("…a piece of furniture picked: its own meshes tinted", (await tints(false)).acc >= 1);

    /* ---- the floorplan */
    await ev(() => H3PushPull.state.T.arch.setSel({ ak: "room", id: H3PushPull.state.M.arch.rooms[0].id, part: "wall", edge: 3 }));
    await p.click("#ppPlan"); await p.waitForTimeout(500);
    const pl = await tints(true), wallCol = await ev(() => { const c = new H3PushPull.state.V.T.Color(H3PushPull.state.V.theme.text); return [c.r * 255, c.g * 255, c.b * 255]; });
    const pw = await px([0, 2, 0]), pOther = await px([5, 2, 0]);
    check("floorplan: the picked wall filled in the accent (a plan highlight), the other walls as they were", pl.acc >= 1 && toward(wallCol, pw, accRGB) && !toward(wallCol, pOther, accRGB), { pl, pw, pOther, wallCol });
    [x, y] = await scr([7.5, 3.4, 0]); await p.mouse.move(x, y); await p.waitForTimeout(250);
    const ph = await tints(true), hovered = await ev(() => H3PushPull.state.A.hover);
    check("floorplan: hovering a room fills it in BLUE (the picked wall stays accent)", ph.blue >= 1 && ph.acc >= 1 && hovered && hovered.ak === "room", { ph, hovered });
    await shot("hl650-plan");
    [x, y] = await scr([0, 2, 0]); await p.mouse.move(x, y); await p.waitForTimeout(250);
    check("floorplan: hovering the picked wall shows no blue (it is picked)", (await tints(true)).blue === 0);
    await ev(() => H3PushPull.state.T.arch.setSel(null)); await p.waitForTimeout(150);
    await p.mouse.move(5, 5); await ev(() => H3PushPull.state.A.setHover(null)); await p.waitForTimeout(150);
    check("…nothing picked, nothing hovered: no highlight", JSON.stringify(await tints(true)) === JSON.stringify({ acc: 0, blue: 0 }));
    await p.click("#ppPlan"); await p.waitForTimeout(300);
    check("…the floorplan off: its highlight gone with it", (await ev(() => H3PushPull.state.V.scene.getObjectByName("pp-plan-hl").children.length)) === 0);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (H3PushPull.state.P) H3PushPull.state.P.set(false); H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
