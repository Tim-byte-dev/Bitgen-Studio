#!/usr/bin/env node
/* bitGen Studio — 2.639.0 in a REAL browser: THE SKETCHER'S 🗂 OUTLINE DOCKER (rooms ▸ walls, floor, ceiling, skirting,
 * cornice, doors, windows; 👁; room groups), A WALL DRAGGED ACROSS ITS LINE / FREELY WITH Alt, Shift+click = THE ROOM.
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.639.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_outline639_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); try { localStorage.removeItem("pp.outline"); } catch (e) {} });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && document.getElementById("ppOutline"), null, { timeout: 40000 });
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    // two rooms drawn with the Room tool's model functions, a door
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); const R1 = PPArch.addRoom(S.M.arch, [[0, 0], [4, 0], [4, 3], [0, 3]]); PPArch.addRoom(S.M.arch, [[6, 0], [9, 0], [9, 3], [6, 3]]); PPArch.addOp(S.M.arch, "door", 0.9, { room: R1.id, edge: 0, at: 2 }); H3PushPull.commit("rooms", b0); S.V.view("top"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(400);
    const rows = await ev(() => [...document.querySelectorAll("#ppOutline .orow .olab")].map((x) => x.textContent));
    check("🗂 Outline beside the view: Room groups, Rooms ▸ Room 1 ▸ Wall 1…4, Floor 1, Ceiling 1, Skirting 1, Cornice 1, Door 1; Room 2 ▸ Ceiling 2",
      ["Room 1", "Wall 1", "Wall 4", "Floor 1", "Ceiling 1", "Skirting 1", "Cornice 1", "Door 1", "Room 2", "Ceiling 2"].every((l) => rows.includes(l)) && rows[0].startsWith("Room groups"), rows);
    // a row picks it
    await ev(() => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.querySelector(".olab").textContent === "Wall 2"); r.querySelector(".olab").click(); });
    await p.waitForTimeout(200);
    const s1 = await ev(() => ({ sel: H3PushPull.state.T.arch.sel(), on: (document.querySelector("#ppOutline .orow.on .olab") || {}).textContent }));
    check("a click on Wall 2 picks Room 1's wall 2 (lit in the outline)", s1.sel && s1.sel.ak === "room" && s1.sel.part === "wall" && s1.sel.edge === 1 && s1.on === "Wall 2", s1);
    // 👁 Ceiling 1 off
    await ev(() => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.querySelector(".olab").textContent === "Ceiling 1"); r.querySelector('[data-act="eye"]').click(); });
    await p.waitForTimeout(200);
    const h1 = await ev(() => ({ hide: H3PushPull.state.M.arch.hide.slice(), ceil: H3PushPull.state.A.built.polys.some((x) => x.tag.part === "ceil" && x.tag.id === H3PushPull.state.M.arch.rooms[0].id) }));
    check("👁 on Ceiling 1: hidden (not in the view) - kept in the model", h1.hide.some((k) => /:ceil$/.test(k)) && !h1.ceil, h1);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z shows it again", await ev(() => !H3PushPull.state.M.arch.hide.length));
    // room groups
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); PPOutline.newGroup(S.M.arch, "Ground floor", S.M.arch.rooms.map((R) => R.id)); H3PushPull.commit("group", b0); });
    await p.waitForTimeout(200);
    await ev(() => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.querySelector(".olab").textContent === "Ground floor"); r.querySelector('[data-act="eye"]').click(); });
    await p.waitForTimeout(250);
    const g1 = await ev(() => ({ polys: H3PushPull.state.A.built ? H3PushPull.state.A.built.polys.length : 0, dim: [...document.querySelectorAll("#ppOutline .orow.dim .olab")].map((x) => x.textContent).length }));
    check("a room group's 👁 off: both its rooms gone from the view (their parts dimmed in the outline)", g1.polys === 0 && g1.dim >= 10, g1);
    await ev(() => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.querySelector(".olab").textContent === "Ground floor"); r.querySelector('[data-act="eye"]').click(); });
    await p.waitForTimeout(250);
    // drag Room 1's east wall (x=4) 1 m east: across its line
    const R = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.rooms[0].pts)));
    let [x0, y0] = await scr([4, 1.5, 1.4]), [x1, y1] = await scr([5, 2.5, 1.4]);
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250);
    let pts = await R();
    check("a wall dragged (east, and a bit north): it moves across its own line only - x to 5, its ends keep their y", near(pts[1][0], 5, 0.12) && near(pts[2][0], 5, 0.12) && near(pts[1][1], 0, 0.02) && near(pts[2][1], 3, 0.02), pts);
    // Alt: free
    [x0, y0] = await scr([pts[1][0], 1.5, 1.4]); [x1, y1] = await scr([pts[1][0] + 0.5, 2.5, 1.4]);
    await p.keyboard.down("Alt"); await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await p.mouse.move(x1, y1, { steps: 4 }); await p.mouse.up(); await p.keyboard.up("Alt"); await p.waitForTimeout(250);
    const pts2 = await R();
    check("Alt+drag: the wall moves freely (east AND north) - the walls beside it stretch", near(pts2[1][0] - pts[1][0], 0.5, 0.12) && near(pts2[1][1], 1, 0.12) && near(pts2[2][1], 4, 0.12), { pts, pts2 });
    // Shift+click: the whole room
    await ev(() => H3PushPull.state.T.arch.setSel(null)); await p.waitForTimeout(200);
    [x0, y0] = await scr([pts2[0][0], 1.5, 1.4]);                         // the panel closed: the view is wider now
    await p.keyboard.down("Shift"); await p.mouse.click(x0 + 2, y0); await p.keyboard.up("Shift"); await p.waitForTimeout(200);
    const s2 = await ev(() => H3PushPull.state.T.arch.sel());
    check("Shift+click on a wall picks the entire room", s2 && s2.ak === "room" && !s2.part, s2);
    // the outline off / on
    await p.click("#ppOutlineBtn"); await p.waitForTimeout(150);
    const off = await ev(() => document.getElementById("ppOutline").classList.contains("off"));
    await p.click("#ppOutlineBtn"); await p.waitForTimeout(150);
    check("🗂 Outline in the bar hides / shows the docker", off && await ev(() => !document.getElementById("ppOutline").classList.contains("off")));
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
