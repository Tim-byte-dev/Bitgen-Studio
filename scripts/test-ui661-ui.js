#!/usr/bin/env node
/* bitGen Studio — 2.661.0 in a REAL browser: THE SKETCHER'S 🧱 WALL TYPES DOCKER - opened from the bar, the built-in types,
 * Brick veneer used for every exterior wall (one ↶ step, the walls that thick), a layer thinner / added / taken out (the walls
 * follow), a wall's own panel picks a type, ＋ a new type, ✕ deleted.
 * Tim (verbatim): "create a docker to create wall structure like brick, air gap, frame, insulation, gyprock etc. wall thickness etc"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.661.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_wt661_" + process.pid;
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPWallType && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { localStorage.removeItem("pp.walltypes"); localStorage.removeItem("pp.wtcur"); const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.TV && H3PushPull.state.M && document.getElementById("ppWTBtn"), null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      PPArch.addRoom(A, PPArch.rectPts([0, 0], [5, 4]), true); PPArch.addRoom(A, PPArch.rectPts([5, 0], [9, 4]), true); H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(300);
    const wt = (s) => ev((s) => { const b = document.getElementById("ppWT"); return s ? [...b.querySelectorAll(s)].map((x) => x.textContent) : b; }, s);
    check("🧱 Wall types in the bar, the docker shut at first", await ev(() => document.getElementById("ppWTBtn").textContent === "🧱 Wall types" && document.getElementById("ppWT").classList.contains("off")));
    await ev(() => document.getElementById("ppWTBtn").click()); await p.waitForTimeout(200);
    const rows = await wt(".wtrow .n");
    check("…clicked: open, the 8 built-in types (Brick veneer, Double brick, …, Interior stud)", await ev(() => !document.getElementById("ppWT").classList.contains("off")) && rows.length === 8 && rows[0] === "Brick veneer" && rows.includes("Interior stud"), rows);
    await ev(() => [...document.querySelectorAll("#ppWT .wtrow")][0].click()); await p.waitForTimeout(150);
    const lay = await ev(() => ({ n: document.querySelectorAll("#ppWT .lay[data-i]").length, tot: document.getElementById("ppWTTotal").textContent, svg: document.querySelectorAll("#ppWT svg rect").length, k: [...document.querySelectorAll("#ppWT .lay[data-i] select")].map((s) => s.value) }));
    check("Brick veneer: its 5 layers outside to inside (brick, gap, wrap, timber frame, plasterboard), its cut drawn, Wall thickness 251 mm", lay.n === 5 && lay.k.join() === "brick,gap,wrap,timber,plaster" && lay.svg === 5 && lay.tot === "Wall thickness 251 mm", lay);
    const u0 = await ev(() => H3PushPull.state.undo.length);
    await ev(() => document.querySelector('#ppWT [data-use="ext"]').click()); await p.waitForTimeout(300);
    const a1 = await ev(() => { const S = H3PushPull.state, A = S.M.arch, R = A.rooms[0]; return { wt: R.wt, tw0: R.tw[0], n: PPWallType.usedBy(A, "veneer"), kept: A.wtypes.length, undo: S.undo.length, msg: document.getElementById("ppMsg").textContent, row: document.querySelector("#ppWT .wtrow.on .d").textContent }; });
    check("Use it for Exterior walls: the 6 outside walls Brick veneer (251 mm), the shared ones not, one ↶ step, said so, the row counts them",
      a1.n === 6 && a1.tw0 === 0.251 && !a1.wt[1] && a1.kept === 8 && a1.undo === u0 + 1 && /Brick veneer \(251 mm\) for 6 walls/.test(a1.msg) && /251 mm · 6 walls/.test(a1.row), a1);
    const wq = () => ev(() => { const R = H3PushPull.state.M.arch.rooms[0], q = PPArch.wallQuads(R).find((x) => x.i === 0); return +PPArch.segDist(q.quad[0], q.quad[3], q.quad[2]).d.toFixed(4); });
    check("…the wall built that thick", (await wq()) === 0.251);
    await ev(() => { const i = document.querySelector('#ppWT .lay[data-i="0"] input[data-f=t]'); i.value = "90"; i.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(300);
    check("the brick 90 mm: the type 231 mm, its walls follow", (await ev(() => document.getElementById("ppWTTotal").textContent)) === "Wall thickness 231 mm" && (await wq()) === 0.231);
    await ev(() => { const s = document.getElementById("ppWTAdd"); s.value = "board"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(300);
    check("＋ Insulation board: 6 layers, 281 mm", await ev(() => document.querySelectorAll("#ppWT .lay[data-i]").length === 6 && document.getElementById("ppWTTotal").textContent === "Wall thickness 281 mm"));
    await ev(() => document.querySelector('#ppWT .lay[data-i="5"] [data-act=up]').click()); await p.waitForTimeout(250);
    check("↑ moves it further out", (await ev(() => [...document.querySelectorAll("#ppWT .lay[data-i] select")].map((s) => s.value).join())) === "brick,gap,wrap,timber,board,plaster");
    await ev(() => document.querySelector('#ppWT .lay[data-i="4"] [data-act=rm]').click()); await p.waitForTimeout(250);
    check("✕ takes it out: 231 mm again", (await ev(() => document.getElementById("ppWTTotal").textContent)) === "Wall thickness 231 mm" && (await wq()) === 0.231);
    // a wall's own panel
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id, part: "wall", edge: 1 }); S.T.arch.props(); }); await p.waitForTimeout(200);
    await setNum("Wall type", "stud"); await p.waitForTimeout(300);
    const s1 = await ev(() => { const R = H3PushPull.state.M.arch.rooms[0]; return { wt: R.wt[1], tw: R.tw[1], btn: !document.querySelector('#ppWT [data-use="wall"]').disabled }; });
    check("➤ a wall's panel: Wall type = Interior stud (110 mm); the docker's ▮ The picked wall on", s1.wt === "stud" && s1.tw === 0.11 && s1.btn, s1);
    if (process.env.H3_SHOT) { await p.screenshot({ path: path.join(process.env.H3_SHOT, "walltype661.png") }); }
    await ev(() => document.querySelector('#ppWT [data-act="new"]').click()); await p.waitForTimeout(250);
    const nw = await ev(() => ({ cur: PPWallType.current(), n: H3PushPull.state.M.arch.wtypes.length, on: document.querySelector("#ppWT .wtrow.on .n").textContent }));
    check("＋ a new type: kept (9), picked", nw.cur === "wt1" && nw.n === 9 && nw.on === "Wall type 1", nw);
    await ev(() => document.querySelector('#ppWT [data-act="del"]').click()); await p.waitForTimeout(250);
    check("✕ deletes it (8 again)", await ev(() => H3PushPull.state.M.arch.wtypes.length === 8));
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(400);
    check("📐 the floorplan draws the layers' seams", await ev(() => PPPlan.symbols(H3PushPull.state.M.arch, 0, {}).lines.some((l) => l.k === "seam")));
    if (process.env.H3_SHOT) { await p.screenshot({ path: path.join(process.env.H3_SHOT, "walltype661plan.png") }); }
    await ev(() => document.getElementById("ppPlan").click()); await p.waitForTimeout(200);
    await ev(() => document.querySelector('#ppWT [data-act="close"]').click()); await p.waitForTimeout(150);
    check("× shuts the docker", await ev(() => document.getElementById("ppWT").classList.contains("off")));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
