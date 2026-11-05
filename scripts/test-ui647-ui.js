#!/usr/bin/env node
/* bitGen Studio — 2.647.0 in a REAL browser: THE SKETCHER'S 📐 FLOORPLAN, Esc = no tool + 🔄 Orbit everywhere, a room's
 * WIDTH × LENGTH. Tim (verbatim): "add floorplan view to sketcher, the buttons will still draw what they are set too but with
 * floorplan symbols in floorplan mode. esc deselects all tools and changes to orbit mode in all views, rooms will have width
 * and length properties". Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: the plan's picture there. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.647.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_plan647_" + process.pid;
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
  const tool = () => ev(() => H3PushPull.state.T.name());
  const asel = () => ev(() => H3PushPull.state.T.arch.sel());
  const head = () => ev(() => (document.querySelector("#ppProps .pph") || {}).textContent || "");
  const setNum = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === l); if (!r) return false; const i = r.querySelector("input"); i.value = String(v); i.dispatchEvent(new Event("change")); return true; }, [label, v]);
  // the colour of the view's pixel at a world point (the drawing buffer is kept)
  const px = async (w) => { await p.waitForTimeout(120); return ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), c = V.canvas, k = c.width / c.getBoundingClientRect().width, t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const g = t.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(Math.round(s[0] * k), Math.round(s[1] * k), 1, 1).data; return [d[0], d[1], d[2]]; }, w); };
  const lum = (c) => (c[0] + c[1] + c[2]) / 3;
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.P && window.PPPlan, null, { timeout: 40000 });
    // a kitchen + a bedroom sharing a wall: a door, a double door, a window, stairs, a light, a bed
    await ev(() => {
      const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty();
      const K = PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" }); const B = PPArch.addRoom(A, [[5, 0], [9, 0], [9, 4], [5, 4]], { name: "Bed" });
      PPArch.addOp(A, "door", 0.9, { room: K.id, edge: 0, at: 2 }); PPArch.addOp(A, "door", 1.6, { room: K.id, edge: 3, at: 2, style: "double" });
      PPArch.addOp(A, "window", 1.2, { room: B.id, edge: 2, at: 2, style: "double" }); PPArch.addOp(A, "door", 0.8, { room: B.id, edge: 3, at: 2 });
      A.stairs.push({ id: A.n++, x: 0.6, y: 1.2, ang: 0, w: 0.9, len: 2.6, rise: 2.7, z: 0, col: "#b08a62" });
      PPArch.addLight(A, "downlight", [2.5, 3, 2.68], { room: K.id });
      A.items = [PPFurn.make("bed_queen", [7, 2], 0, 0) || PPFurn.make(PPFurn.pieces()[0].type, [7, 2], 0, 0)]; A.items[0].id = A.n++;
      H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); S.T.use("select");
    });
    await p.waitForTimeout(500);
    const cam0 = await ev(() => H3PushPull.state.V.state());

    // ---- 📐 on
    await p.click("#ppPlan"); await p.waitForTimeout(600);
    const on = await ev(() => { const S = H3PushPull.state, V = S.V, c = V.cam(), d = new V.T.Vector3(); c.getWorldDirection(d); const sc = V.scene;
      return { on: S.P.on(), btn: document.getElementById("ppPlan").classList.contains("on"), ortho: V.isOrtho, down: d.z, hidden: ["pp-arch", "pp-fixtures", "pp-furniture"].every((n) => !sc.getObjectByName(n).visible), last: S.P.last(), kids: S.P.group.children.length, clear: V.clear.toString(16), bg: new V.T.Color(V.theme.bg).getHexString() }; });
    check("📐 Plan: straight down, parallel, the 3D building hidden, the plan drawn (fills, lines, labels), in the theme's colours (2.649.0 - its background)", on.on && on.btn && on.ortho && on.down < -0.999 && on.hidden && on.last && on.last.fills >= 5 && on.last.lines >= 20 && on.last.texts >= 6 && on.clear === on.bg, on);
    if (process.env.H3_SHOT) { const fs = require("fs"); const png = await ev(() => H3PushPull.state.V.canvas.toDataURL("image/png")); fs.writeFileSync(path.join(process.env.H3_SHOT, "plan647.png"), Buffer.from(png.split(",")[1], "base64")); }
    const wallPx = await px([2.5, 4, 0]), floorPx = await px([3.5, 2.2, 0]), outPx = await px([-1.45, 2.45, 0]);
    const thc = await ev(() => { const t = H3PushPull.state.V.theme, c = (h) => { const n = parseInt(String(h).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }; return { text: c(t.text), bg: c(t.bg) }; });
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    check("…in the theme's colours: walls in its text colour, outside its background, a room's floor neither", dist(wallPx, thc.text) < 40 && dist(outPx, thc.bg) < 30 && dist(floorPx, thc.bg) > 6 && dist(floorPx, thc.text) > 60, { wallPx, floorPx, outPx, thc });
    const doorGap = await px([2, 0, 0]);
    check("…a door is a gap in the wall (not solid)", dist(doorGap, thc.text) > 60, doorGap);

    // ---- picking on the plan
    let [x, y] = await scr([1.9, 0.5, 0]); await p.mouse.click(x, y); await p.waitForTimeout(250);
    check("a click in the door's swing picks the door", (await asel())?.ak === "op", await asel());
    [x, y] = await scr([4.2, 3.2, 0]); await p.mouse.click(x, y); await p.waitForTimeout(250);
    check("a click inside a room picks the room - its panel: Width 5, Length 4", (await asel())?.ak === "room" && /Kitchen/.test(await head()) && await ev(() => ["Width (m)", "Length (m)"].every((l) => [...document.querySelectorAll("#ppProps .ppr span")].some((s) => s.textContent === l))), { s: await asel(), h: await head() });
    await setNum("Width (m)", 6); await p.waitForTimeout(300);
    const w6 = await ev(() => ({ pts: H3PushPull.state.M.arch.rooms[0].pts, label: !!H3PushPull.state.P.group.children.length }));
    check("…Width 6: the room is 6 wide (its first corner kept)", JSON.stringify(w6.pts) === "[[0,0],[6,0],[6,4],[0,4]]", w6);
    await setNum("Length (m)", 4.5); await p.waitForTimeout(300);
    check("…Length 4.5", await ev(() => JSON.stringify(H3PushPull.state.M.arch.rooms[0].pts)) === "[[0,0],[6,0],[6,4.5],[0,4.5]]");
    await p.keyboard.press("Control+z"); await p.keyboard.press("Control+z"); await p.waitForTimeout(300);

    // ---- the tools draw on the plan
    await ev(() => H3PushPull.tool("room")); await p.waitForTimeout(150);
    await setNum("Width (m)", 3); await setNum("Length (m)", 2.5); await p.waitForTimeout(150);
    const n0 = await ev(() => H3PushPull.state.M.arch.rooms.length);
    [x, y] = await scr([10.5, -3.5, 0]); await p.mouse.move(x, y); await p.waitForTimeout(100); await p.mouse.click(x, y); await p.waitForTimeout(400);
    const nr = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[A.rooms.length - 1], s = PPArch.roomSize(R); return { n: A.rooms.length, w: s.w, l: s.l, t: H3PushPull.state.P.last().texts, msg: (document.getElementById("ppStatus") || document.getElementById("ppMsg") || {}).textContent, tool: H3PushPull.state.T.name(), o: H3PushPull.state.T.arch.opts.room }; });
    check("Room tool, Width 3 × Length 2.5: ONE click on the plan puts a 3 × 2.5 room there - drawn as a plan", nr.n === n0 + 1 && Math.abs(nr.w - 3) < 0.02 && Math.abs(nr.l - 2.5) < 0.02 && await ev(() => H3PushPull.state.P.on()), nr);
    await setNum("Width (m)", 0); await setNum("Length (m)", 0);
    await ev(() => H3PushPull.tool("door")); await p.waitForTimeout(150);
    const o0 = await ev(() => H3PushPull.state.M.arch.ops.length);
    await ev(() => H3PushPull.state.V.extents()); await p.waitForTimeout(250);
    const mid = await ev(() => { const A = H3PushPull.state.M.arch, R = A.rooms[A.rooms.length - 1], a = R.pts[2], b = R.pts[3]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0]; });
    [x, y] = await scr(mid); await p.mouse.move(x, y); await p.waitForTimeout(150); await p.mouse.click(x, y); await p.waitForTimeout(400);
    const dr = await ev(() => ({ n: H3PushPull.state.M.arch.ops.length, gap: null }));
    check("Door tool: a click on the new room's wall in the plan puts a door in it", dr.n === o0 + 1, dr);
    const gap2 = await px(mid);
    check("…drawn as a plan door (a gap in the wall)", dist(gap2, (await ev(() => { const t = H3PushPull.state.V.theme, n = parseInt(t.text.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }))) > 60, gap2);

    // ---- Esc: no tool, nothing picked, Orbit - on the plan
    await ev(() => H3PushPull.tool("wall")); [x, y] = await scr([2, 7, 0]); await p.mouse.click(x, y); await p.waitForTimeout(100);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc in the floorplan (the Wall tool half way): no tool - 🔄 Orbit, the step dropped", (await tool()) === "orbit" && await ev(() => !Object.keys(H3PushPull.state.T.arch.state()).length && document.getElementById("ppT_orbit").classList.contains("on")), await tool());
    [x, y] = await scr([4, 2, 0]);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 160, y + 90, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
    const turned = await ev(() => { const V = H3PushPull.state.V, d = new V.T.Vector3(); V.cam().getWorldDirection(d); return { z: d.z, up: V.cam().up.z }; });
    check("…Orbit on the plan turns it round - it stays flat (straight down)", turned.z < -0.999, turned);

    // ---- other views end it; 📐 again = the 3D view as it was
    await ev(() => { const s = document.getElementById("ppViewSel"); s.value = "iso"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(400);
    const iso = await ev(() => { const S = H3PushPull.state; return { on: S.P.on(), btn: document.getElementById("ppPlan").classList.contains("on"), shown: S.V.scene.getObjectByName("pp-arch").visible, plan: S.P.group.visible }; });
    check("View ▾ Iso ends the floorplan: the 3D building back", !iso.on && !iso.btn && iso.shown && !iso.plan, iso);
    await ev((c) => H3PushPull.state.V.restore(c), cam0); await p.waitForTimeout(150);
    const st1 = await ev(() => H3PushPull.state.V.state());
    await ev(() => { const s = document.getElementById("ppViewSel"); s.value = "plan"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(400);
    check("View ▾ 📐 Floorplan turns it on too", await ev(() => H3PushPull.state.P.on() && document.getElementById("ppPlan").classList.contains("on")));
    await p.click("#ppPlan"); await p.waitForTimeout(400);
    const back = await ev(() => H3PushPull.state.V.state());
    check("📐 again: the 3D view as it was before the plan (camera, perspective)", !(await ev(() => H3PushPull.state.P.on())) && back.ortho === st1.ortho && back.p.every((v, i) => Math.abs(v - st1.p[i]) < 1e-3), { back, st1 });

    // ---- Esc in the 3D view: a picked room + the Select tool -> nothing picked, Orbit
    await ev(() => { H3PushPull.tool("select"); H3PushPull.state.T.arch.setSel({ ak: "room", id: H3PushPull.state.M.arch.rooms[0].id }); });
    await p.mouse.move(800, 500); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc in the 3D view: ONE press - nothing picked, 🔄 Orbit", (await tool()) === "orbit" && !(await asel()) && await ev(() => H3PushPull.state.T.arch.props && !document.querySelector("#ppProps .pph")?.textContent.includes("Kitchen")), { t: await tool(), s: await asel() });
    await ev(() => { H3PushPull.state.V.extents(); H3PushPull.tool("line"); }); await p.waitForTimeout(200); [x, y] = await scr([-1, 6, 0]); await p.mouse.click(x, y); await p.waitForTimeout(80);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    const ln = await ev(() => ({ t: H3PushPull.state.T.name(), st: Object.keys(H3PushPull.state.T.state()) }));
    check("…a Line half way: Esc ends it - 🔄 Orbit", ln.t === "orbit" && !ln.st.length, ln);
    const e2 = await ev(() => { const S = H3PushPull.state; return { r: S.T.escape(), t: S.T.name(), sel: S.sel, a: S.T.arch.sel(), g: S.group }; });
    check("…Esc in Orbit (2.648.0): ➤ Select - still the Sketcher's (it never docks a maximized Sketcher)", e2.r === true && e2.t === "select", e2);

    // ---- a camera's view ends the floorplan; Esc there = Orbit too
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch; A.cams = A.cams || []; A.cams.push({ id: A.n++, name: "Camera 1", x: 2, y: -3, z: 1.6, yaw: 0, pitch: 0, roll: 0, fov: 60 }); H3PushPull.commit("camera", b0); });
    await p.click("#ppPlan"); await p.waitForTimeout(300);
    await ev(() => { const S = H3PushPull.state, c = S.M.arch.cams[0]; S.T.arch.lookThrough(c); S.T.arch.setSel({ ak: "cam", id: c.id }); H3PushPull.tool("select"); }); await p.waitForTimeout(300);
    check("looking through a camera ends the floorplan", await ev(() => !H3PushPull.state.P.on() && H3PushPull.state.T.arch.through() != null));
    await p.mouse.move(800, 500); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc in a camera's view: the camera let go, 🔄 Orbit", (await tool()) === "orbit" && !(await asel()), { t: await tool(), s: await asel() });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (window.H3PushPull && H3PushPull.state.P) H3PushPull.state.P.set(false); if (window.H3PushPullFrame) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
