#!/usr/bin/env node
/* bitGen Studio — 2.628.0 in a REAL browser: THE SKETCHER'S 🛋 FURNITURE (the House builder's library) + THE PROJECT'S 3D MODELS;
 * ⛶ MAXIMIZED = EVERY OTHER DOCKER CLOSED (and back on ⇲ Dock).
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker. when
 * maximized sketcher takes the full screen except for bitgen titlebar and statusbar, all the other dockers are closed"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.628.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_furn628_" + process.pid;
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPFurn && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    // the prompt + timeline dockers shown, then the Sketcher maximized: they close; ⇲ Dock: they are back
    const open0 = await ev(() => {
      const show = (id, btn) => { const d = document.getElementById(id); if (d && d.classList.contains("dockgone")) toggleDockGone(id, btn); };
      show("promptdock", "tP"); show("timelinedock", "tTL");
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      document.getElementById("titlebar").classList.remove("hidden");
      return Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]);
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    await p.click("#ppMaxBtn"); await p.waitForTimeout(600);
    const mx = await ev(() => ({ on: Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]), sb: !!document.getElementById("statusbar").getBoundingClientRect().height, tb: Math.round(document.getElementById("titlebar").getBoundingClientRect().bottom), top: Math.round(document.getElementById("pushpulldock").getBoundingClientRect().top) }));
    check("⛶ maximized: every other docker is closed (only the Sketcher's button lit), the title bar and status bar stay", open0.length > 2 && open0.includes("promptdock") && mx.on.join() === "pushpulldock" && mx.sb && mx.top === mx.tb, { open0, mx });
    await p.click("#ppMaxBtn"); await p.waitForTimeout(600);
    const back = await ev(() => Object.keys(H3GoneDocks).filter((k) => document.getElementById(k) && document.getElementById(k).classList.contains("on")).map((k) => H3GoneDocks[k]));
    check("⇲ Dock: the same dockers open again", open0.slice().sort().join() === back.slice().sort().join(), { open0, back });
    await p.click("#ppMaxBtn"); await p.waitForTimeout(500);

    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const click = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(200); };
    const AR = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch || {})));
    const panel = () => ev(() => document.getElementById("ppProps").textContent);
    // a room to furnish (floor at 0.5 m)
    await ev(() => { const S = H3PushPull.state; S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, [[0, 0], [5, 0], [5, 4], [0, 4]], { z: 0.5 }); S.V.setModel(S.M); S.A.rebuild(); S.V.view("top"); S.V.extents(); });
    const tools = await ev(() => [...document.querySelectorAll("#ppTools button")].map((x) => x.id.replace("ppT_", "")).slice(15));
    check("the Build tools end with 🛋 Furniture (A) (+ 2.629.0: 📷 Camera)", tools.slice(-2).join() === "furniture,camera", tools);
    await p.keyboard.press("a"); await p.waitForTimeout(200);
    const pn = await panel();
    check("🛋 Furniture: the panel - the House builder's categories (Living … Outside) + the project's 3D models, the pieces as buttons", /Category/.test(pn) && await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; return [...s.options].map((o) => o.value).join() === "Living,Dining,Kitchen,Bedroom,Bathroom,Lights,Outside,People,3D models"; }) && /Sofa \(3 seats\)/.test(pn), pn.slice(0, 200));
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; s.value = "Bedroom"; s.dispatchEvent(new Event("change")); });
    await ev(() => { const x = document.querySelector('#ppProps button[data-type="bed_double"]'); x.click(); });
    await p.keyboard.press("r"); await p.waitForTimeout(150);
    await click([2.5, 2, 0.5]);
    let A = await AR();
    const it = A.items && A.items[0];
    check("pick Double bed, R (90°), click in the room: the bed on the room's floor (0.5 m), turned 90°", it && it.type === "bed_double" && near(it.x, 2.5, 0.08) && near(it.y, 2, 0.08) && near(it.z, 0.5) && it.rot === 90, A.items);
    const g = await ev(() => { const f = H3PushPull.state.V.scene.getObjectByName("pp-furniture"); return f ? { n: f.children.length, meshes: f.children[0] ? f.children[0].children.length : 0, tex: f.children[0] ? f.children[0].children.some((m) => !!m.material.map) : false } : null; });
    check("…drawn in 3D with the House builder's parts, materials and textures", g && g.n === 1 && g.meshes >= 2 && g.tex, g);
    // select it, drag, delete
    await p.keyboard.press(" "); await p.waitForTimeout(100);
    await click([2.5, 2, 1.0]);
    const ps = await panel();
    check("Select: a click on it picks it - its panel (Width / Depth / Height / Turn / Up from the floor / ⟳ 90° / ⧉ / 🗑)", /🛋 Double bed/.test(ps) && /Width/.test(ps) && /Up from the floor/.test(ps) && /Duplicate/.test(ps), ps.slice(0, 200));
    { const [x0, y0] = await scr([2.5, 2, 1.0]), [x1, y1] = await scr([3.5, 2, 1.0]); await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, y0, { steps: 5 }); await p.mouse.move(x1, y1, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250); }
    A = await AR();
    check("…dragged 1 m: it moves (on the room's floor)", near(A.items[0].x, 3.5, 0.1) && near(A.items[0].z, 0.5), A.items[0]);
    await ev(() => H3PushPull.save(true)); await p.waitForTimeout(400);
    const saved = await ev(async () => { const n = (document.getElementById("ppName").value || "model 1").trim(); const j = await (await fetch("/api/pushpull/" + encodeURIComponent(n))).json(); return (j.model && j.model.arch && j.model.arch.items) || null; });
    check("saved with the model (its arch.items)", saved && saved.length === 1 && saved[0].type === "bed_double", saved);
    await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    A = await AR();
    check("…Delete removes it", A.items.length === 0, A.items);
    // the project's 3D models
    await ev(() => H3PushPull.state.T.use("select"));
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); const F = PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [1, 1, 0], [0, 0, 1])); PPGeo.pushPull(M, F.id, 1); M.arch = S.M.arch; S.M = M; S.V.setModel(M); });
    const mn = await ev(() => H3PushPull.toProject("glb"));
    await ev(() => { const S = H3PushPull.state; const M = PPGeo.newModel(); M.arch = S.M.arch; S.M = M; S.V.setModel(M); });
    await p.keyboard.press("a"); await p.waitForTimeout(150);
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; s.value = "3D models"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction((n) => !!document.querySelector('#ppProps button[data-model="' + n + '"]'), mn, { timeout: 8000 }).catch(() => {});
    const has = await ev((n) => !!document.querySelector('#ppProps button[data-model="' + n + '"]'), mn);
    await ev((n) => { const x = document.querySelector('#ppProps button[data-model="' + n + '"]'); if (x) x.click(); }, mn);
    await p.waitForFunction(() => H3PushPull.state.M.f.length >= 6, null, { timeout: 15000 }).catch(() => {});
    const im = await ev(() => ({ f: H3PushPull.state.M.f.length, g: H3PushPull.state.M.g.length }));
    check("🛋 ▸ 3D models: the project's models listed; one clicked comes in as a group", has && im.f >= 6 && im.g >= 1, { mn, has, im });
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
