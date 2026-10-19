#!/usr/bin/env node
/* bitGen Studio — 2.532.0 in a REAL browser:
 *   🏠 ⬚ SELECT - a sofa's corner square sizes it (the opposite corner stays), its ↻ handle turns it in 15° steps; a box
 *      selects several, R turns them about their middle, Delete removes them (Ctrl+Z brings them back), Shift+click adds;
 *   📷 THE WALKING CAMERA - dragged through the plan the 3D view looks through it as it moves; ← → turn, ↑ ↓ tilt; hold
 *      Shift = it rises to 3 m over the roof (no higher), hold Alt = it sinks to the ground floor (no lower);
 *   ▁ ⛶ ✕ - a floating docker minimized to its title bar, maximized between the menu bar and the statusbar and back,
 *      closed;
 *   🧪 - what was just used is ticked in the test list by itself and kept (auto ✓).
 * Against the running app (H3_URL, default :8311). Nothing is saved (the example house is never stored). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.532 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const near = (a, b, e) => Math.abs(a - b) <= (e || 0.011);

(async () => {
  // 2.534.0: the test list ticks itself only in 🧪 Test mode - on for this run, put back after
  const mode0 = !!(await api("/api/testplan")).mode;
  await api("/api/testplan/mode", { on: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const at = async (x, y) => ev(([x, y]) => { const S = H3House.state(), r = document.getElementById("hbPlan").getBoundingClientRect(); return [r.left + x * S.zoom + S.ox, r.top + y * S.zoom + S.oy]; }, [x, y]);
  const drag = async (from, to, steps, opt) => { const a = await at(...from), z = await at(...to); if (opt && opt.shift) await p.keyboard.down("Shift"); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: steps || 8 }); await p.mouse.up(); if (opt && opt.shift) await p.keyboard.up("Shift"); await p.waitForTimeout(150); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3House && document.getElementById("hbBody") && window.SecFloat && SecFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.click("#hbBtn"); await p.waitForTimeout(800);
    // the example, the sofa moved into an open spot of the plan so its handles are clear; maximize the House window for room
    const set = await ev(() => {
      const m = H3HouseGeo.example(); m.name = "E2E house 532";
      H3House.load(m); const S = H3House.state(); S.sel = null; S.zoom = 60; S.ox = 80; S.oy = 80; H3House.setView("plan"); H3House.setTool("select");
      const sofa = S.m.items.find((i) => i.type === "sofa") || S.m.items[0];
      return { sofa: sofa.id, cam: S.m.cameras[0].id };
    });
    await p.focus("#hbBody");

    /* ---- ⬚ one piece: its handles */
    let s0 = await ev((id) => { const S = H3House.state(), o = S.m.items.find((i) => i.id === id); S.sel = { kind: "item", id }; S.multi = null; H3House.setTool("select"); return JSON.parse(JSON.stringify(o)); }, set.sofa);
    const hs = await ev((id) => { const S = H3House.state(); return H3House.handles("item", S.m.items.find((i) => i.id === id)); }, set.sofa);
    check("⬚ a selected sofa has 4 corner squares (size) + a ↻ handle (turn)", hs.filter((h) => h.h === "scale").length === 4 && hs.filter((h) => h.h === "rot").length === 1, hs);
    const c1 = hs.find((h) => h.h === "scale" && h.su === 1 && h.sv === 1), opp = hs.find((h) => h.h === "scale" && h.su === -1 && h.sv === -1);
    const a = s0.rot * Math.PI / 180, u = [Math.cos(a), Math.sin(a)];
    await drag(c1.p, [c1.p[0] + u[0] * 0.4, c1.p[1] + u[1] * 0.4], 10);
    const s1 = await ev((id) => JSON.parse(JSON.stringify(H3House.state().m.items.find((i) => i.id === id))), set.sofa);
    const hs1 = await ev((id) => H3House.handles("item", H3House.state().m.items.find((i) => i.id === id)), set.sofa);
    const opp1 = hs1.find((h) => h.h === "scale" && h.su === -1 && h.sv === -1);
    check("dragging a corner 0.4 m along its width: 0.4 m wider, the same depth, the opposite corner where it was", near(s1.w, s0.w + 0.4, 0.06) && near(s1.d, s0.d, 0.06) && near(opp1.p[0], opp.p[0], 0.04) && near(opp1.p[1], opp.p[1], 0.04), { s0, s1, opp, opp1 });
    const rh = hs1.find((h) => h.h === "rot");
    // drag the ↻ handle to the sofa's right (90° clockwise from where the knob is) -> +90°
    const cen = [s1.x, s1.y], kv = [rh.p[0] - cen[0], rh.p[1] - cen[1]], to = [cen[0] - kv[1], cen[1] + kv[0]];
    await drag(rh.p, to, 12);
    const s2 = await ev((id) => JSON.parse(JSON.stringify(H3House.state().m.items.find((i) => i.id === id))), set.sofa);
    check("↻ dragged a quarter turn round: the sofa turns 90° (15° steps)", ((s2.rot - s1.rot) % 360 + 360) % 360 === 90 && s2.rot % 15 === 0, [s1.rot, s2.rot]);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(150); await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
    const s3 = await ev((id) => JSON.parse(JSON.stringify(H3House.state().m.items.find((i) => i.id === id))), set.sofa);
    check("Ctrl+Z twice: its size and angle back", near(s3.w, s0.w) && s3.rot === s0.rot, [s0, s3]);

    /* ---- several: a box, R, Delete, Shift+click */
    const box = await ev(() => { const S = H3House.state(), r = S.m.rooms.find((x) => x.name === "Living room") || S.m.rooms[0]; const xs = r.poly.map((q) => q[0]), ys = r.poly.map((q) => q[1]); return { a: [Math.min(...xs) + 0.05, Math.min(...ys) + 0.05], b: [Math.max(...xs) - 0.05, Math.max(...ys) - 0.05], id: r.id }; });
    const inBox = await ev((bx) => H3House.boxPick(bx.a, bx.b), box);
    await ev(() => { const S = H3House.state(); S.sel = null; S.multi = null; });
    // the box must start on an empty spot: just outside the house, over the room
    const out0 = await ev(() => { const S = H3House.state(); let x0 = 1e9, y0 = 1e9; S.m.walls.forEach((w) => { x0 = Math.min(x0, w.a[0], w.b[0]); y0 = Math.min(y0, w.a[1], w.b[1]); }); return [x0 - 0.6, y0 - 0.6]; });
    await drag(out0, box.b, 12);
    const sel = await ev(() => { const S = H3House.state(); return { n: S.multi ? S.multi.length : 0, kinds: (S.multi || []).map((q) => q.kind), side: document.getElementById("hbProps").textContent.slice(0, 120) }; });
    check("⬚ a box from an empty spot: everything inside it selected (pieces, the room, its walls) + the side panel says how many", sel.n >= 3 && sel.kinds.includes("item") && /selected/.test(sel.side) && sel.n >= inBox.length, { sel, inBox: inBox.length });
    const before = await ev(() => { const S = H3House.state(); return S.multi.map((q) => JSON.stringify(H3House.state().m[{ item: "items", room: "rooms", wall: "walls", camera: "cameras", stairs: "stairs", person: "people" }[q.kind]].find((o) => o.id === q.id))); });
    await p.keyboard.press("r"); await p.waitForTimeout(200);
    const turned = await ev(() => { const S = H3House.state(), q = S.multi.find((z) => z.kind === "item"), o = S.m.items.find((i) => i.id === q.id); return { n: S.multi.length, o: JSON.parse(JSON.stringify(o)) }; });
    const ob = JSON.parse(before[sel.kinds.indexOf("item")]);
    check("R: they turn 15° about their middle (a piece moves round it and turns with it), still selected", turned.n === sel.n && ((turned.o.rot - ob.rot) % 360 + 360) % 360 === 15 && (Math.abs(turned.o.x - ob.x) + Math.abs(turned.o.y - ob.y)) > 0.01, { ob, o: turned.o });
    await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
    const nItems = await ev(() => H3House.state().m.items.length);
    await ev((bx) => { const S = H3House.state(); S.multi = H3House.boxPick(bx.a, bx.b); S.sel = S.multi[0]; }, box);
    await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    const gone = await ev(() => ({ items: H3House.state().m.items.length, multi: H3House.state().multi }));
    check("Delete: all of them go", gone.items < nItems && !gone.multi, [nItems, gone]);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z: back", await ev(() => H3House.state().m.items.length) === nItems);
    // Shift+click: one, then another
    const two = await ev(() => { const S = H3House.state(); const its = S.m.items.filter((i) => i.floor === 0 && i.w * i.d > 0.5).slice(0, 2); S.sel = null; S.multi = null; return its.map((i) => [i.x, i.y, i.id]); });
    let pt = await at(two[0][0], two[0][1]); await p.mouse.click(pt[0], pt[1]);
    pt = await at(two[1][0], two[1][1]); await p.keyboard.down("Shift"); await p.mouse.click(pt[0], pt[1]); await p.keyboard.up("Shift"); await p.waitForTimeout(250);
    const sh = await ev(() => (H3House.state().multi || []).map((q) => q.id));
    check("Shift+click adds a second piece (2 selected)", sh.length === 2 && sh.includes(two[0][2]) && sh.includes(two[1][2]), sh);
    await p.keyboard.press("Escape");

    /* ---- 📷 the walking camera */
    const cam0 = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id); S.sel = { kind: "camera", id }; S.multi = null; S.look = "orbit"; return JSON.parse(JSON.stringify(c)); }, set.cam);
    await drag([cam0.x, cam0.y], [cam0.x - 1, cam0.y + 0.5], 10);
    await p.waitForFunction((id) => { const S = H3House.state(); return S.look === id && S.view === "both" && S.three && S.three.built; }, set.cam, { timeout: 30000 });
    await p.waitForTimeout(400);
    const look = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id), t = S.three, E = H3HouseGeo.elevations(S.m); return { c: JSON.parse(JSON.stringify(c)), pos: [t.cam.position.x, t.cam.position.y, t.cam.position.z], y: E[c.floor] + c.z }; }, set.cam);
    check("📷 dragged on the plan: the 3D view comes up and looks through it (its eye where it now stands)", near(look.c.x, cam0.x - 1, 0.06) && near(look.pos[0], look.c.x, 0.02) && near(look.pos[2], look.c.y, 0.02) && near(look.pos[1], look.y, 0.02), look);
    // the 3D eye follows WHILE it is dragged (each move)
    const mid = await (async () => { const a2 = await at(look.c.x, look.c.y), z2 = await at(look.c.x + 0.8, look.c.y); await p.mouse.move(a2[0], a2[1]); await p.mouse.down(); await p.mouse.move(z2[0], z2[1], { steps: 6 }); const r = await ev(() => H3House.state().three.cam.position.x); await p.mouse.up(); return r; })();
    check("…and follows it while it moves (before the mouse is let go)", near(mid, look.c.x + 0.8, 0.08), [mid, look.c.x + 0.8]);
    await p.focus("#hbBody");
    const y0 = await ev((id) => JSON.parse(JSON.stringify(H3House.state().m.cameras.find((x) => x.id === id))), set.cam);
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowUp");
    await p.waitForTimeout(100);
    const y1 = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id), d = new S.three.T.Vector3(); S.three.cam.getWorldDirection(d); return { c: JSON.parse(JSON.stringify(c)), d: [d.x, d.y, d.z] }; }, set.cam);
    const ya = y1.c.yaw * Math.PI / 180, pa = y1.c.pitch * Math.PI / 180;
    check("→ → ↑: yaw +6°, pitch +2° - the 3D view turns with it", ((y1.c.yaw - y0.yaw) % 360 + 360) % 360 === 6 && near(y1.c.pitch, y0.pitch + 2) && near(y1.d[0], Math.cos(ya) * Math.cos(pa), 0.02) && near(y1.d[1], Math.sin(pa), 0.02), { y0, y1 });
    check("…the arrows turned it - they did not move it", near(y1.c.x, y0.x) && near(y1.c.y, y0.y));
    const R = await ev(() => H3HouseGeo.heightRange(H3House.state().m));
    await p.keyboard.down("Shift"); await p.waitForTimeout(700);
    const up1 = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id); return H3HouseGeo.elevations(S.m)[c.floor] + c.z; }, set.cam);
    await p.waitForTimeout(Math.ceil((R.max - up1) / 2 * 1000) + 3000);
    await p.keyboard.up("Shift"); await p.waitForTimeout(250);
    const top = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id); return { abs: H3HouseGeo.elevations(S.m)[c.floor] + c.z, eye: S.three.cam.position.y, walk: !!S.walk }; }, set.cam);
    check("hold Shift: it rises (2 m a second) …", up1 > y0.z + 0.3, [y0.z, up1]);
    check("…and stops 3 m over the roof (" + R.max + " m) - the 3D eye with it; let go = it stops", near(top.abs, R.max, 0.02) && near(top.eye, R.max, 0.03) && !top.walk && near(R.max - R.top, 3), [top, R]);
    await p.keyboard.down("Alt"); await p.waitForTimeout(Math.ceil((R.max - R.min) / 2 * 1000) + 3500); await p.keyboard.up("Alt"); await p.waitForTimeout(250);   // 2.539.0: + room for slow frames (a frame step is capped at 0.1 s)
    const low = await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id); return { abs: H3HouseGeo.elevations(S.m)[c.floor] + c.z, floor: c.floor }; }, set.cam);
    check("hold Alt: it sinks to the ground floor (" + R.min + " m) and no lower", near(low.abs, R.min, 0.02) && low.floor === 0, low);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
    check("Ctrl+Z undoes a rise / sink in one step", await ev((id) => { const S = H3House.state(), c = S.m.cameras.find((x) => x.id === id); return H3HouseGeo.elevations(S.m)[c.floor] + c.z; }, set.cam) > R.min + 1);
    // a Shift+click on another piece while the camera is selected is a click - the camera does not rise
    const zc = await ev((id) => H3House.state().m.cameras.find((x) => x.id === id).z, set.cam);
    pt = await at(two[0][0], two[0][1]); await p.keyboard.down("Shift"); await p.mouse.click(pt[0], pt[1]); await p.keyboard.up("Shift"); await p.waitForTimeout(200);
    check("a quick Shift+click while the camera is picked does not lift it", near(await ev((id) => H3House.state().m.cameras.find((x) => x.id === id).z, set.cam), zc), zc);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "ui532-walk.png") });

    /* ---- ▁ ⛶ ✕ on a floating docker (the 🧪 Testing docker) */
    await ev(() => { SecFloat.show("testdock", true); SecFloat.float("testdock", 400, 200, 420, 500); });
    await p.waitForTimeout(400);
    const r0 = await ev(() => { const r = document.getElementById("sf-testdock").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    check("the title bar has ▁ ⛶ ✕", await ev(() => ["sfmin", "sfmax", "sfx"].every((c) => document.querySelector("#sf-testdock .sfhead ." + c))));
    await p.click("#sf-testdock .sfmin"); await p.waitForTimeout(250);
    const mn = await ev(() => { const el = document.getElementById("sf-testdock"), r = el.getBoundingClientRect(), hd = el.querySelector(".sfhead").getBoundingClientRect(); return { min: el.classList.contains("sf-min"), h: r.height, head: hd.height, body: getComputedStyle(el.querySelector(".sfbody")).display }; });
    check("▁: only its title bar (a docker's collapsed bar)", mn.min && mn.body === "none" && mn.h <= mn.head + 6, mn);
    await p.dblclick("#sf-testdock .sft"); await p.waitForTimeout(250);
    const r1 = await ev(() => { const el = document.getElementById("sf-testdock"), r = el.getBoundingClientRect(); return [el.classList.contains("sf-min"), r.height]; });
    check("…a double-click on the title opens it again at its height", !r1[0] && Math.abs(r1[1] - r0[3]) < 3, [r1, r0]);
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(300);
    const mx = await ev(() => { const r = document.getElementById("sf-testdock").getBoundingClientRect(), mb = document.getElementById("menubar").getBoundingClientRect(), sb = document.getElementById("statusbar").getBoundingClientRect(); const el = document.getElementById("sf-testdock"), sp = SecFloat.pure.maxSpan(innerWidth, SecFloat.sideCols(el, r.height)); return { r: [r.left, r.top, r.width, r.height], mb: mb.bottom, sb: sb.top, vw: innerWidth, sp, ic: document.querySelector("#sf-testdock .sfmax").textContent }; });
    // 2.538.0: between the open side columns (Gallery, Queue, References, Assets, the left docker) - test-ui538 checks those
    check("⛶: the whole window between the menu bar and the statusbar (and the open side dockers) - the button turns to 🗗", Math.abs(mx.r[0] - mx.sp.x) < 2 && Math.abs(mx.r[1] - mx.mb) < 3 && Math.abs(mx.r[2] - mx.sp.w) < 3 && Math.abs(mx.r[1] + mx.r[3] - mx.sb) < 4 && mx.ic === "🗗", mx);
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(300);
    const r2 = await ev(() => { const r = document.getElementById("sf-testdock").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    check("🗗: back where it was, as big as it was", r2.every((v, i) => Math.abs(v - r0[i]) < 3), [r0, r2]);
    await p.click("#sf-testdock .sfx"); await p.waitForTimeout(250);
    check("✕ closes the docker", await ev(() => document.getElementById("sf-testdock").classList.contains("sf-hidden") && !SecFloat.state("testdock").shown));

    /* ---- 🧪 the test list ticked itself and kept it */
    await p.waitForTimeout(600);
    const st = await api("/api/testplan");
    const row = (id) => st.rows.find((r) => r.id === id) || {};
    const want = ["dk_min", "dk_max", "hs_size", "hs_box", "hs_walk", "hx_list"].filter((id) => id !== "hx_list");
    check("🧪 what was used ticked itself: ▁ ⛶ (dk_min / dk_max), ⬚ size / box (hs_size / hs_box), 📷 walk (hs_walk)", want.every((id) => row(id).state === "pass"), want.map((id) => [id, row(id).state, row(id).how]));
    check("…and is kept (auto ✓) - it stays after a restart", want.every((id) => row(id).kept === true || /^you:/.test(row(id).how || "")), want.map((id) => [id, row(id).kept]));
    await ev(() => { SecFloat.show("testdock", true); return H3TestDock.refresh(); }); await p.waitForTimeout(400);
    check("…the 🧪 docker shows it as 'auto ✓'", await ev(() => /auto ✓/.test((document.querySelector('#tdList [data-id="hs_walk"]') || {}).textContent || "")));
    await ev(() => SecFloat.show("testdock", false));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "ui532.png") });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } await api("/api/testplan/mode", { on: mode0 }).catch(() => {}); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
