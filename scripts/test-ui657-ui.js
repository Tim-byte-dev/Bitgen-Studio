#!/usr/bin/env node
/* bitGen Studio — 2.657.0 in a REAL browser: THE SKETCHER'S 🏊 POOL - two corners on the ground make a pool (one ↶ step), the
 * ground levelled round it and cut away under it, its panel in Select (deep end, decking), on the floorplan, deleted.
 * Tim (verbatim): "... and a swimming pool creator(with edge tiles or decking)"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.657.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_pool657_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scrG = (x, y) => ev(([x, y]) => { const S = H3PushPull.state, t = S.M.arch.terrain, z = t ? PPTerrain.at(t, x, y) : 0, s = S.V.screen([x, y, z]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, [x, y]);
  const setNum = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === l); const i = r.querySelector("input,select"); i.value = String(v); i.dispatchEvent(new Event("change")); }, [label, v]);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPSite && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const t = A.terrain = PPTerrain.clean({ x0: -15, y0: -15, cell: 0.5, nx: 60, ny: 60 });
      for (let j = 0; j <= 60; j++) for (let i = 0; i <= 60; i++) t.h[j * 61 + i] = (i - 30) * 0.03; H3PushPull.commit("ground", b0); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(300);
    const btn = await ev(() => { const b = document.getElementById("ppT_pool"); return b && { icon: b.textContent, title: b.title }; });
    check("🏊 Pool under Ground (no key: its title has none)", btn && btn.icon === "🏊" && /^Pool - /.test(btn.title), btn);
    await ev(() => document.getElementById("ppT_pool").click()); await p.waitForTimeout(150);
    const pn = await ev(() => ({ shape: !!document.getElementById("ppPoolShape"), edge: document.getElementById("ppPoolEdge").value }));
    check("its panel: shape, depths, edge (tiles by default), level, level the ground round it", pn.shape && pn.edge === "tiles", pn);
    const tri0 = await ev(() => H3PushPull.state.V.scene.getObjectByName("pp-terrain").children.find((c) => c.isMesh).geometry.index.count);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    const a = await scrG(-4, -2), c = await scrG(4, 2);
    await p.mouse.click(a[0], a[1]); await p.waitForTimeout(100); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500);
    const r = await ev(() => { const S = H3PushPull.state, A = S.M.arch, q = A.pools[0], t = A.terrain; return q && { n: A.pools.length, sz: PPSite.size(q), z: q.z, pads: t.pads.length, padName: t.pads[0] && t.pads[0].name, edgeGround: PPTerrain.at(t, 4, 0), undo: S.undo.length, water: S.A.tags.some((g) => g && g.ak === "pool" && g.part === "water"), tri: S.V.scene.getObjectByName("pp-terrain").children.find((c) => c.isMesh).geometry.index.count }; });
    check("two corners: ONE pool 8 × 4 m at the ground's level, built (water), one ↶ step", r && r.n === 1 && Math.abs(r.sz.l - 8) < 0.15 && Math.abs(r.sz.w - 4) < 0.15 && Math.abs(r.z) < 0.05 && r.water && r.undo === u0 + 1, { r, u0 });
    check("…the ground levelled round it (a pad named after it) and cut away under it", r.pads === 1 && /^Pool 1 surround$/.test(r.padName) && Math.abs(r.edgeGround - (r.z - 0.03)) < 0.01 && r.tri < tri0, { r, tri0 });
    // Select it: its own panel
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "pool", id: S.M.arch.pools[0].id }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const hd = await ev(() => document.querySelector("#ppProps .pph").textContent);
    check("➤ Select a pool: its panel (name, the water's volume)", /^🏊 Pool 1 · [\d.]+ m³ of water$/.test(hd), hd);
    await setNum("Deep end (m)", 2.5); await p.waitForTimeout(150);
    await setNum("Edge", "both"); await p.waitForTimeout(250);
    const r2 = await ev(() => { const S = H3PushPull.state, q = S.M.arch.pools[0]; return { deep: q.deep, edge: q.edge, deck: S.A.tags.some((g) => g && g.ak === "pool" && g.part === "deck"), deckRow: [...document.querySelectorAll("#ppProps .ppr span")].some((x) => x.textContent === "Decking's width (m)") }; });
    check("…Deep end 2.5 m, Edge = tiles + decking: the decking built, its width in the panel", r2.deep === 2.5 && r2.edge === "both" && r2.deck && r2.deckRow, r2);
    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(process.env.H3_SHOT, "pool657.png") }); }
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    const pl = await ev(() => H3PushPull.state.V.scene.getObjectByName("pp-plan").children.filter((c) => c.isSprite).length);
    check("📐 the floorplan shows it (its name + size)", pl >= 2, pl);
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(300);
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "pool", id: S.M.arch.pools[0].id }); S.T.arch.props(); [...document.querySelectorAll("#ppProps button")].find((x) => /Delete/.test(x.textContent)).click(); }); await p.waitForTimeout(250);
    check("🗑 Delete removes it", await ev(() => H3PushPull.state.M.arch.pools.length === 0));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
