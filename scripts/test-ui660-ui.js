#!/usr/bin/env node
/* bitGen Studio — 2.660.0 in a REAL browser: THE SKETCHER'S WALLS - a wall set interior / exterior in its panel, the Eraser
 * on the wall two rooms share takes just it out (both rooms' - one ↶ step, its door with it), ↶ brings it back, 🗑 Take this
 * wall out in a wall's panel, ↺ Put back in the room's.
 * Tim (verbatim): "allow me to remove just 1 wall from a room, allow me to toggle walls to interior/exterior"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.660.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_walls660_" + process.pid;
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      const R1 = PPArch.addRoom(A, PPArch.rectPts([0, 0], [4, 3]), true); PPArch.addRoom(A, PPArch.rectPts([4, 0], [8, 3]), true);
      PPArch.addOp(A, "door", { room: R1.id, edge: 1, at: 1.5 }); H3PushPull.commit("rooms", b0); S.V.view("top"); S.V.extents(); });
    await p.waitForTimeout(300);
    const sel = (edge) => ev((e) => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id, part: "wall", edge: e }); S.T.arch.props(); }, edge);
    const head = () => ev(() => document.querySelector("#ppProps .pph").textContent);
    await sel(0); await p.waitForTimeout(150);
    const h0 = await head(), opt = await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Interior / exterior"); return r && [...r.querySelectorAll("option")].map((o) => o.textContent); });
    check("➤ a wall's panel: its kind in the heading (exterior), Interior / exterior = Auto (exterior) / Interior / Exterior", /^▮ Wall 1 · Room 1 · exterior$/.test(h0) && opt && opt.join("|") === "Auto (exterior)|Interior|Exterior", { h0, opt });
    await setNum("Interior / exterior", "int"); await p.waitForTimeout(200);
    const k1 = await ev(() => ({ k: H3PushPull.state.M.arch.rooms[0].wkind, h: document.querySelector("#ppProps .pph").textContent }));
    check("…set Interior: kept on the room (wkind), the heading says interior", k1.k[0] === "int" && / · interior$/.test(k1.h), k1);
    await sel(1); await p.waitForTimeout(150);
    check("…the wall the two rooms share: Auto (interior)", /· interior$/.test(await head()) && /🗑 Take this wall out/.test(await ev(() => document.getElementById("ppProps").textContent)));
    // the Eraser on the shared wall (its top, seen from above)
    const u0 = await ev(() => H3PushPull.state.undo.length);
    await ev(() => H3PushPull.state.T.use("eraser")); await p.waitForTimeout(100);
    const pt = await ev(() => { const S = H3PushPull.state, R = S.M.arch.rooms[0], s = S.V.screen([4, 1.5, R.z + R.h]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(400);
    const e1 = await ev(() => { const S = H3PushPull.state, A = S.M.arch; return { n: A.rooms.length, g1: A.rooms[0].gone, g2: A.rooms[1].gone, ops: A.ops.length, undo: S.undo.length, msg: document.getElementById("ppMsg").textContent }; });
    check("⌫ the Eraser on the shared wall: just that wall out of BOTH rooms (the rooms stay), its door gone, one ↶ step, said so",
      e1.n === 2 && JSON.stringify(e1.g1) === "[1]" && JSON.stringify(e1.g2) === "[3]" && e1.ops === 0 && e1.undo === u0 + 1 && /(Wall 2 taken out of Room 1 \(and Room 2's wall 4|Wall 4 taken out of Room 2 \(and Room 1's wall 2)/.test(e1.msg), { e1, u0 });
    if (process.env.H3_SHOT) { await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents(); }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(process.env.H3_SHOT, "walls660.png") }); await ev(() => H3PushPull.state.V.view("top")); }
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("↶ brings the wall (and its door) back", await ev(() => { const A = H3PushPull.state.M.arch; return A.rooms[0].gone.length === 0 && A.rooms[1].gone.length === 0 && A.ops.length === 1; }));
    // a wall's panel: 🗑 Take this wall out (an outside wall: just it)
    await sel(2); await p.waitForTimeout(150);
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => /Take this wall out/.test(x.textContent)).click()); await p.waitForTimeout(300);
    const t1 = await ev(() => { const A = H3PushPull.state.M.arch; return { g1: A.rooms[0].gone, g2: A.rooms[1].gone, sel: H3PushPull.state.T.arch.sel(), wl: PPArch.wallQuads(A.rooms[0]).length }; });
    check("🗑 Take this wall out (an outside wall): only it - 3 walls left, the room picked", JSON.stringify(t1.g1) === "[2]" && t1.g2.length === 0 && t1.wl === 3 && t1.sel && t1.sel.ak === "room" && !t1.sel.part, t1);
    await ev(() => H3PushPull.state.T.arch.props()); await p.waitForTimeout(150);
    const pb = await ev(() => { const b = [...document.querySelectorAll("#ppProps button")].find((x) => /↺ Put back/.test(x.textContent)); return b && b.textContent; });
    check("the room's panel: ↺ Put back wall 3", pb === "↺ Put back wall 3", pb);
    await ev(() => [...document.querySelectorAll("#ppProps button")].find((x) => /↺ Put back/.test(x.textContent)).click()); await p.waitForTimeout(300);
    check("…clicked: the wall is back", await ev(() => H3PushPull.state.M.arch.rooms[0].gone.length === 0));
    // Shift+Eraser: the whole room
    await ev(() => H3PushPull.state.T.use("eraser"));
    const pt2 = await ev(() => { const S = H3PushPull.state, R = S.M.arch.rooms[1], s = S.V.screen([8, 1.5, R.z + R.h]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.keyboard.down("Shift"); await p.mouse.click(pt2[0], pt2[1]); await p.keyboard.up("Shift"); await p.waitForTimeout(400);
    check("Shift+Eraser on a wall: the whole room", await ev(() => H3PushPull.state.M.arch.rooms.length === 1));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
