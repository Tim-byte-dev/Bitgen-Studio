#!/usr/bin/env node
/* bitGen Studio — 2.659.0 in a REAL browser: THE SKETCHER'S 🛣 DRIVEWAY - points clicked on the ground, a double-click ends it
 * (one ↶ step), its curve shown with points and handles; a handle dragged bends it, a point dragged moves it, Delete removes a
 * point; its Select panel (width, kerbs); on the floorplan. Tim (verbatim): "a driveway tool that can be adjusted with bezier curves"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.659.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_drv659_" + process.pid;
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
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPSite && PPSite.makeDrive && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const t = A.terrain = PPTerrain.clean({ x0: -15, y0: -15, cell: 0.5, nx: 60, ny: 60 });
      for (let j = 0; j <= 60; j++) for (let i = 0; i <= 60; i++) t.h[j * 61 + i] = (j - 30) * 0.02; H3PushPull.commit("ground", b0); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(300);
    await ev(() => document.getElementById("ppT_drive").click()); await p.waitForTimeout(150);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    for (const q of [[-10, -6], [0, -6]]) { const s = await scrG(q[0], q[1]); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(90); }
    const s3 = await scrG(6, 4); await p.mouse.dblclick(s3[0], s3[1]); await p.waitForTimeout(400);
    const r = await ev(() => { const S = H3PushPull.state, d = (S.M.arch.drives || [])[0]; return d && { n: d.nodes.length, w: d.w, len: PPSite.driveLength(d), undo: S.undo.length, built: S.A.tags.some((g) => g && g.ak === "drive"), marks: !!(S.TV.marksG && S.TV.marksG.children.length), edit: S.T.terrain.editing() === d.id, onGround: (() => { const z = PPTerrain.at(S.M.arch.terrain, 0, -6); return z; })() }; });
    check("points clicked + a double-click: ONE driveway (3 points, 3 m wide, curved), built, one ↶ step; its points + handles shown", r && r.n === 3 && r.w === 3 && r.len > 17 && r.built && r.undo === u0 + 1 && r.marks && r.edit, { r, u0 });
    // drag node 1's outgoing handle: the curve bends
    const h = await ev(() => { const d = H3PushPull.state.M.arch.drives[0], n = d.nodes[1]; return { p: n.p, b: n.b, a: n.a }; });
    const before = await ev(() => PPSite.bez(H3PushPull.state.M.arch.drives[0].nodes[1], H3PushPull.state.M.arch.drives[0].nodes[2], 0.5));
    const hs = await scrG(h.p[0] + h.b[0], h.p[1] + h.b[1], 0.06), ht = await scrG(h.p[0] + h.b[0] + 4, h.p[1] + h.b[1] - 3, 0.06);
    await p.mouse.move(hs[0], hs[1]); await p.mouse.down(); await p.mouse.move(ht[0], ht[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const after = await ev(() => { const d = H3PushPull.state.M.arch.drives[0], n = d.nodes[1]; return { b: n.b, a: n.a, mid: PPSite.bez(n, d.nodes[2], 0.5), undo: H3PushPull.state.undo.length }; });
    const crossA = Math.abs(after.a[0] * after.b[1] - after.a[1] * after.b[0]);
    check("a handle dragged: the curve bends (its mid moves), the other handle turns with it (opposite), one ↶ step", Math.hypot(after.mid[0] - before[0], after.mid[1] - before[1]) > 0.5 && crossA < 0.05 && after.a[0] * after.b[0] + after.a[1] * after.b[1] < 0 && after.undo === u0 + 2, { before, after });
    // drag node 0
    const n0 = await ev(() => H3PushPull.state.M.arch.drives[0].nodes[0].p);
    const ns = await scrG(n0[0], n0[1], 0.06), nt = await scrG(n0[0] - 2, n0[1] - 3, 0.06);
    await p.mouse.move(ns[0], ns[1]); await p.mouse.down(); await p.mouse.move(nt[0], nt[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const n0b = await ev(() => H3PushPull.state.M.arch.drives[0].nodes[0].p);
    check("a point dragged moves it", Math.abs(n0b[0] - (n0[0] - 2)) < 0.3 && Math.abs(n0b[1] - (n0[1] - 3)) < 0.3, { n0, n0b });
    // Delete: the point under the pointer (the hot one) goes
    await ev(() => H3PushPull.state.V.canvas.focus()); const ns2 = await scrG(n0b[0], n0b[1], 0.06); await p.mouse.move(ns2[0], ns2[1]);
    await p.mouse.down(); await p.mouse.up(); await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    check("Delete removes the picked point (2 left)", await ev(() => H3PushPull.state.M.arch.drives[0].nodes.length === 2));
    // Select: its panel
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "drive", id: S.M.arch.drives[0].id }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const hd = await ev(() => document.querySelector("#ppProps .pph").textContent);
    check("➤ Select a driveway: its panel (name, length)", /^🛣 Driveway 1 · [\d.]+ m long$/.test(hd), hd);
    await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Kerbs"); const i = r.querySelector("input"); i.checked = true; i.dispatchEvent(new Event("change")); }); await p.waitForTimeout(250);
    check("…Kerbs on: built", await ev(() => H3PushPull.state.A.tags.some((g) => g && g.ak === "drive" && g.part === "kerb")));
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    check("📐 the floorplan draws it (its dashed centre line)", await ev(() => H3PushPull.state.V.scene.getObjectByName("pp-plan").children.some((c) => c.material && c.material.isLineDashedMaterial)));
    await ev(() => document.getElementById("ppPlan").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
