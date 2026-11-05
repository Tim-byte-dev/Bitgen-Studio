#!/usr/bin/env node
/* bitGen Studio — 2.667.0 in a REAL browser: THE SKETCHER'S OBJECTS PANEL - Shapes (a row picks the shape, a drag on its face
 * push / pulls it - a group's face too), Construction (📌 keeps the sketch plane, a plane row = draw in it again, 📏 Tape +
 * Ctrl = a construction line the tools snap onto, 🗑), renaming any row by double-clicking its name.
 * Tim (verbatim): "add construction to the objects panel as a heading, planes and construction lines will live in that
 * dropdown, add shapes, for all shapes that are created - user can rename anything in the objects panel, when user clicks a
 * shape allow user to push/pull the shape when dragged"
 * Against the running app (H3_URL). No Playwright = SKIP. H3_SHOT=<dir>: a picture. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.667.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_objects667_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const scr = (q) => ev((q) => { const S = H3PushPull.state, s = S.V.screen(q), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, q);
  const rowsOf = () => ev(() => [...document.querySelectorAll("#ppOutline .orow")].map((r) => ({ key: r.dataset.key, t: (r.querySelector(".olab") || {}).textContent, on: r.classList.contains("on") })));
  const rowAt = (key) => ev((k) => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.dataset.key === k); if (!r) return null; const l = r.querySelector(".olab").getBoundingClientRect(); return [l.left + 12, l.top + l.height / 2]; }, key);
  const drag = async (a, dy) => { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(a[0], a[1] + dy / 2, { steps: 4 }); await p.mouse.move(a[0], a[1] + dy, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300); };
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPCons && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), localStorage.setItem("pp.outline", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M && document.getElementById("ppOutline"), null, { timeout: 40000 });
    // a flat rectangle and a box in a group
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), M = S.M; M.v = []; M.f = []; M.e = []; M.g = []; M.arch = PPArch.empty();
      PPGeo.addFace(M, PPGeo.rectPts([0, 0, 0], [2, 1.5, 0]));
      const g = PPGeo.addFace(M, PPGeo.rectPts([4, 0, 0], [5.5, 1.5, 0])); PPGeo.pushPull(M, g.id, 1); PPGeo.group(M, { f: M.f.filter((F) => F.id !== M.f[0].id).map((F) => F.id), e: [] }, "Crate");
      H3PushPull.commit("shapes", b0); S.T.use("select"); S.V.view("iso"); S.V.frameBox({ min: [-1, -1, 0], max: [7, 3, 2] }); });
    await p.waitForTimeout(500);
    let R = await rowsOf();
    check("the objects panel: a Shapes heading with Shape 1 and the group Crate; a Construction heading with Planes and Construction lines", R.some((r) => r.key === "sec:shapes") && R.some((r) => r.t === "Shape 1") && R.some((r) => r.t === "Crate") && R.some((r) => r.key === "sec:cons") && R.some((r) => r.key === "sec:cplanes") && R.some((r) => r.key === "sec:clines"), R.map((r) => r.key + "=" + r.t));
    // a shape row picks it; a drag on its face push / pulls it
    const shKey = R.find((r) => r.t === "Shape 1").key;
    const at = await rowAt(shKey); await p.mouse.click(at[0], at[1]); await p.waitForTimeout(200);
    const s1 = await ev(() => ({ f: H3PushPull.state.sel.f.length, tool: document.querySelector("#ppTools .on") && document.querySelector("#ppTools .on").title, msg: document.getElementById("ppMsg").textContent }));
    check("Shape 1's row: the shape picked (➤ Select), the row lit, the hint says drag a face to push / pull", s1.f === 1 && /push \/ pull/.test(s1.msg) && (await rowsOf()).find((r) => r.key === shKey).on, s1);
    await drag(await scr([1, 0.75, 0]), -70);
    const s2 = await ev(() => ({ n: H3PushPull.state.M.f.filter((F) => !F.grp).length, msg: document.getElementById("ppMsg").textContent }));
    check("…dragged on its face: pushed / pulled into a solid (6 faces)", s2.n === 6 && /extruded/.test(s2.msg), s2);
    R = await rowsOf();
    check("…the panel calls it Solid 1 now", R.some((r) => r.t === "Solid 1"), R.map((r) => r.t));
    // a group's face dragged
    const g0 = await ev(() => { const M = H3PushPull.state.M; return M.f.filter((F) => F.grp).length; });
    const top = await scr([4.75, 0.75, 1]); await drag(top, -60);
    const g1 = await ev(() => { const S = H3PushPull.state, M = S.M, gid = M.g[0].id, zs = M.f.filter((F) => F.grp === gid).flatMap((F) => F.loops[0].map((i) => M.v[i][2])); return { n: M.f.filter((F) => F.grp).length, top: Math.max(...zs), picked: S.sel.f.length, grp: M.f.filter((F) => F.grp === gid).length }; });
    check("a drag on the group's top face: pushed / pulled (taller), still a group, the group picked", g1.top > 1.05 && g1.n >= g0 && g1.picked === g1.grp, { g0, g1 });
    // rename by double-click
    const crate = (await rowsOf()).find((r) => r.t === "Crate").key;
    const ca = await rowAt(crate); await p.mouse.dblclick(ca[0], ca[1]); await p.waitForTimeout(150);
    await p.keyboard.press("Control+A"); await p.keyboard.type("Tool box"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    check("double-click the group's name, type, Enter: renamed (the group's own name)", await ev(() => H3PushPull.state.M.g[0].name === "Tool box") && (await rowsOf()).some((r) => r.t === "Tool box"));
    const sol = (await rowsOf()).find((r) => r.t === "Solid 1").key;
    const sa = await rowAt(sol); await p.mouse.dblclick(sa[0], sa[1]); await p.waitForTimeout(150);
    await p.keyboard.press("Control+A"); await p.keyboard.type("Plinth"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…Esc: not renamed", (await rowsOf()).some((r) => r.t === "Solid 1"));
    await p.mouse.dblclick(sa[0], sa[1]); await p.waitForTimeout(150); await p.keyboard.press("Control+A"); await p.keyboard.type("Plinth"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    check("…a shape renamed (Plinth), one undo step back", (await rowsOf()).some((r) => r.t === "Plinth") && await ev(() => { H3PushPull.undo(); return true; }) && (await (async () => { await p.waitForTimeout(250); return (await rowsOf()).some((r) => r.t === "Solid 1"); })()));
    await ev(() => H3PushPull.redo()); await p.waitForTimeout(200);
    // a room's wall renamed
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); PPArch.addRoom(S.M.arch, PPArch.rectPts([0, 4], [4, 7]), { name: "Study" }); H3PushPull.commit("room", b0); });
    await p.waitForTimeout(300);
    const wk = await ev(() => "room:" + H3PushPull.state.M.arch.rooms[0].id + ":wall:0");
    const wa = await rowAt(wk); await p.mouse.dblclick(wa[0], wa[1]); await p.waitForTimeout(150); await p.keyboard.press("Control+A"); await p.keyboard.type("North wall"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    check("a room's Wall 1 renamed North wall (kept in arch.labels)", (await rowsOf()).some((r) => r.key === wk && r.t === "North wall") && await ev((k) => H3PushPull.state.M.arch.labels[k] === "North wall", wk));
    // construction: the sketch plane kept, a plane row makes it the sketch plane again
    await ev(() => PPSketchPlane.set([0, 0, 1], [0, 0, 1.2], "a test face", 2)); await p.waitForTimeout(200);
    check("the sketch plane in use shows under Construction (✎ Sketch plane - …) with 📌", (await rowsOf()).some((r) => r.key === "cons:active" && /a test face/.test(r.t)));
    await p.click("#ppPlaneKeep"); await p.waitForTimeout(250);
    const pl = await ev(() => H3PushPull.state.M.arch.cons.planes.map((x) => ({ name: x.name, z: x.p[2] })));
    check("📌 on the chip: kept as Plane 1 (z 1.2) - its row lit (the plane in use)", pl.length === 1 && pl[0].name === "Plane 1" && pl[0].z === 1.2 && (await rowsOf()).find((r) => /^cplane:/.test(r.key)).on, pl);
    await ev(() => PPSketchPlane.clear()); await p.waitForTimeout(150);
    const pk = (await rowsOf()).find((r) => /^cplane:/.test(r.key)).key, pa = await rowAt(pk); await p.mouse.click(pa[0], pa[1]); await p.waitForTimeout(200);
    check("a click on Plane 1: it is the sketch plane again", await ev(() => { const s = PPSketchPlane.get(); return !!s && Math.abs(s.p[2] - 1.2) < 1e-9 && s.label === "Plane 1"; }));
    // a construction line: 📏 Tape measure with Ctrl on the second click
    await ev(() => { PPSketchPlane.clear(); H3PushPull.state.T.use("tape"); }); await p.waitForTimeout(100);
    const a1 = await scr([0, -1, 0]), a2 = await scr([2, -1, 0]);
    await p.mouse.move(a1[0], a1[1], { steps: 3 }); await p.mouse.click(a1[0], a1[1]); await p.mouse.move(a2[0], a2[1], { steps: 4 });
    await p.keyboard.down("Control"); await p.mouse.click(a2[0], a2[1]); await p.keyboard.up("Control"); await p.waitForTimeout(250);
    const ln = await ev(() => H3PushPull.state.M.arch.cons.lines.map((x) => x.name));
    check("📏 Tape measure, Ctrl on the second click: Construction line 1 in Construction", ln.length === 1 && ln[0] === "Construction line 1" && (await rowsOf()).some((r) => r.t === "Construction line 1"), ln);
    const sn = await ev(() => { const S = H3PushPull.state, s = S.V.screen([6, -1, 0]), r = S.V.canvas.getBoundingClientRect(); const e = { clientX: r.left + s[0], clientY: r.top + s[1] }; const q = S.V.snap(e, {}); return { kind: q.kind, y: +q.p[1].toFixed(3) }; });
    check("…the drawing tools snap onto it, far past its two points (On Guide)", sn.kind === "On Guide" && Math.abs(sn.y + 1) < 0.02, sn);
    if (process.env.H3_SHOT) { await p.screenshot({ path: path.join(process.env.H3_SHOT, "objects667.png") }); }
    const lk = (await rowsOf()).find((r) => /^cline:/.test(r.key)).key;
    await ev((k) => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.dataset.key === k); r.querySelector('[data-act="delcons"]').click(); }, lk); await p.waitForTimeout(200);
    check("🗑 on its row: the construction line deleted", await ev(() => H3PushPull.state.M.arch.cons.lines.length === 0));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
