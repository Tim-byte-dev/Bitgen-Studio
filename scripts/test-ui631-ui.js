#!/usr/bin/env node
/* bitGen Studio — 2.631.0 in a REAL browser: THE SKETCHER'S VIEW ▾ LISTS ITS CAMERAS - PICKED = THE VIEW FROM THAT CAMERA.
 * Tim: "in sketcher view add camera n to the dropdown when a camera is added. show the view from the camera"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.631.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_camview631_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(500);
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForTimeout(300);
    const opts = () => ev(() => [...document.querySelectorAll("#ppViewSel option")].map((o) => o.value + "=" + o.textContent));
    const o0 = await opts();
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const click = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y); await p.waitForTimeout(200); };
    await ev(() => { const S = H3PushPull.state; S.M.arch = PPArch.empty(); PPArch.addRoom(S.M.arch, [[0, 0], [6, 0], [6, 4], [0, 4]]); S.V.setModel(S.M); S.A.rebuild(); S.V.view("top"); S.V.extents(); });
    await p.keyboard.press("z"); await p.waitForTimeout(150);
    await click([1, 2, 0]); await click([5, 2, 0]);
    await click([5, 1, 0]); await click([5, 3.5, 0]);
    await p.waitForTimeout(200);
    const o1 = await opts();
    check("a camera added = \"📷 Camera 1\" (then 2) in View ▾, under Cameras", !o0.some((x) => /📷/.test(x)) && o1.some((x) => /^cam:\d+=📷 Camera 1$/.test(x)) && o1.some((x) => /^cam:\d+=📷 Camera 2$/.test(x)), { o0, o1 });
    const c1 = await ev(() => H3PushPull.state.M.arch.cams[0]);
    await ev((id) => { const s = document.getElementById("ppViewSel"); s.value = "cam:" + id; s.dispatchEvent(new Event("change")); }, c1.id);
    await p.waitForTimeout(250);
    const v = await ev(() => { const S = H3PushPull.state, k = S.V.cam(), t = S.V.controls.target, g = S.V.scene.getObjectByName("pp-cameras"); return { p: [k.position.x, k.position.y, k.position.z], t: [t.x, t.y, t.z], fov: k.fov, glyphs: g.visible, sel: document.getElementById("ppViewSel").value }; });
    check("picked: the view from Camera 1 - its place, looking its way (+x), its lens; its glyph out of the way; the dropdown says it", near(v.p[0], c1.x) && near(v.p[1], c1.y) && near(v.p[2], c1.z) && v.t[0] > v.p[0] + 1 && near(v.t[1], c1.y, 0.01) && v.fov === c1.fov && !v.glyphs && v.sel === "cam:" + c1.id, { v, c1 });
    // its lens changed in its panel: the view follows
    await ev((id) => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "cam", id }); const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith("Field of view")); const i = r.querySelector("input"); i.value = "50"; i.dispatchEvent(new Event("change")); }, c1.id);
    await p.waitForTimeout(250);
    const fov2 = await ev(() => H3PushPull.state.V.cam().fov);
    check("…its Lens changed in its panel: the view follows (50°)", fov2 === 50, fov2);
    // orbit leaves it
    { const r = await ev(() => { const c = H3PushPull.state.V.canvas.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; }); await p.mouse.move(r[0], r[1]); await p.mouse.down({ button: "middle" }); await p.mouse.move(r[0] + 60, r[1] + 10, { steps: 5 }); await p.mouse.up({ button: "middle" }); await p.waitForTimeout(250); }
    const after = await ev(() => ({ fov: H3PushPull.state.V.cam().fov, glyphs: H3PushPull.state.V.scene.getObjectByName("pp-cameras").visible, sel: document.getElementById("ppViewSel").value }));
    check("an orbit leaves it: the view's own lens back (35°), the cameras shown, the dropdown back to View ▾", after.glyphs && after.sel === "" && after.fov === 35, after);
    // renamed / deleted: the dropdown follows
    await ev((id) => { const S = H3PushPull.state, c = S.M.arch.cams.find((x) => x.id === id); const b0 = S.T.state; void b0; c.name = "Kitchen"; S.T.arch.setSel({ ak: "cam", id }); H3PushPull.info(); }, c1.id);
    const o2 = await opts();
    await ev(() => { document.getElementById("ppProps").querySelector("button") && 0; const S = H3PushPull.state; S.T.arch.setSel({ ak: "cam", id: S.M.arch.cams[1].id }); [...document.querySelectorAll("#ppProps button")].find((x) => /Delete/.test(x.textContent)).click(); });
    await p.waitForTimeout(200);
    const o3 = await opts();
    check("renamed = renamed in the list; deleted = gone from it", o2.some((x) => /=📷 Kitchen$/.test(x)) && !o3.some((x) => /Camera 2/.test(x)) && o3.some((x) => /Kitchen/.test(x)), { o2, o3 });
    /* 2.631.0 (Tim: "add door open and window open properties ... percentage open and a checkbox for direction. add an auto roof and auto floor option") */
    const panelSet = (label, v) => ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith(label)); if (!r) return false; const i = r.querySelector("input, select"); if (i.type === "checkbox") i.checked = !!v; else i.value = v; i.dispatchEvent(new Event("change")); return true; }, [label, v]);
    const dr = await ev(() => { const S = H3PushPull.state, A = S.M.arch, R = A.rooms[0]; const op = PPArch.addOp(A, "door", 0.9, { room: R.id, edge: 0, at: 3 }); S.V.setModel(S.M); S.A.rebuild(); S.T.use("select"); S.T.arch.setSel({ ak: "op", id: op.id }); return op.id; });
    const o1s = await panelSet("Open", "60"), o2s = await panelSet("Opens outward", true);
    const dop = await ev((id) => { const o = H3PushPull.state.M.arch.ops.find((x) => x.id === id); return { open: o.open, dir: o.dir }; }, dr);
    check("a door's panel: Open (%) 60 + Opens outward - kept on it", o1s && o2s && dop.open === 60 && dop.dir === true, dop);
    await p.keyboard.press("u"); await p.waitForTimeout(150);
    const ar = await panelSet("Auto roof", true), af = await panelSet("Auto floor", true);
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); });
    await click([8, 0, 0]); { const [x, y] = await scr([11, 3, 0]); await p.mouse.move(x, y, { steps: 3 }); } await p.keyboard.type("3,3"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const nr = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[A.rooms.length - 1]; return { slab: R.slab, roof: A.roofs.some((rf) => rf.rooms.includes(R.id)), n: A.rooms.length }; });
    check("the Room tool's Auto roof + Auto floor: a new room comes with its roof and a floor slab", ar && af && nr.slab && nr.roof, nr);
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
