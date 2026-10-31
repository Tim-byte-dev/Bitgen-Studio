#!/usr/bin/env node
/* bitGen Studio — 2.620.0 in a REAL browser (WebGL, the mouse): THE 📏 PUSHPULL DOCKER BUILDS.
 * Tim: "add architectural tools like floor, walls,windows, ceiling,roof  etc. rooms will be able to be dragged, their  walls
 * can snap to another room and share the wall, door or window etc. add lights, downlights, pendant lights, chandelier lights,
 * ceiling mounted lights etc. when maximized it takes bitgens full window minus the titlebar, it has it's own file menu. send
 * to image editor button and send to time line button - this goes in our new sketchup docker"
 *   ⛶ = the whole window under the title bar, Esc puts it back; U rooms ("4,3"), a room DRAGGED onto another = one shared
 *   wall; D a door in the shared wall, I a window, the door dragged along; X lights (the panel's type); K a ceiling off; Y a
 *   roof + Shift+click a second room under it; 🌙 / ⌂; the panel changes a room (its light follows); Delete + Ctrl+Z; W walls;
 *   V stairs; J a floor; the Build keys stay in the docker; ☰ File (Save as / Rename with its own question box, reopened);
 *   🖼 → Image editor and 🎞 → Timeline buttons; .glb with the lights.
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.620.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_arch_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => {
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP");
      document.getElementById("pushpulldock").scrollIntoView({ block: "start" });
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.T && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForTimeout(600);

    /* ⛶ the whole window under the title bar */
    await ev(() => { const t = document.getElementById("titlebar"); t.classList.remove("hidden"); });
    await p.click("#pushpulldock .maxbtn"); await p.waitForTimeout(400);
    const mx = await ev(() => { const d = document.getElementById("pushpulldock"), r = d.getBoundingClientRect(), t = document.getElementById("titlebar").getBoundingClientRect(); return { maxed: d.classList.contains("maxed"), pos: getComputedStyle(d).position, x: r.x, y: Math.round(r.y), w: r.width, h: Math.round(r.height), W: innerWidth, H: innerHeight, tb: Math.round(t.bottom), cv: document.querySelector("#ppView canvas").getBoundingClientRect().width }; });
    check("⛶ maximize: the docker covers the whole bitGen window under the title bar (its own 3D view grows with it)", mx.maxed && mx.pos === "fixed" && mx.x === 0 && mx.w === mx.W && mx.y === mx.tb && mx.tb > 0 && mx.y + mx.h === mx.H && mx.cv > 1200, mx);
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const hover = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 4 }); };
    const click = async (w, o) => { await hover(w); const [x, y] = await scr(w); await p.mouse.click(x, y, o); await p.waitForTimeout(140); };
    const drag = async (a, z) => { const [x0, y0] = await scr(a), [x1, y1] = await scr(z); await p.mouse.move(x0, y0, { steps: 3 }); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 }); await p.mouse.move(x1, y1, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200); };
    const vcb = async (t) => { await p.keyboard.type(t); await p.keyboard.press("Enter"); await p.waitForTimeout(250); };
    const view = (n) => ev((n) => { H3PushPull.state.V.view(n); }, n);
    const AR = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch || {})));
    const msg = () => ev(() => document.getElementById("ppMsg").textContent);
    const tools = await ev(() => [...document.querySelectorAll("#ppTools button")].map((x) => x.id.replace("ppT_", "")).slice(15));
    check("the Build tools under the modelling tools: Room, Wall, Door, Window, Floor, Ceiling, Roof, Light, Stairs", tools.join() === "room,wall,door,window,floor,ceiling,roof,light,stairs", tools);

    /* their keys stay in the docker */
    const docks0 = await ev(() => [...document.querySelectorAll(".bdock, .secfloat")].map((d) => d.id + ":" + d.className).join("|"));
    await hover([0, 0, 0]);
    for (const k of ["u", "w", "d", "i", "j", "k", "y", "x", "v"]) { await p.keyboard.press(k); await p.waitForTimeout(60); }
    const docks1 = await ev(() => [...document.querySelectorAll(".bdock, .secfloat")].map((d) => d.id + ":" + d.className).join("|"));
    check("U W D I J K Y X V pick the Build tools and nothing else in bitGen moves (no docker shown / hidden)", docks0 === docks1 && (await ev(() => H3PushPull.state.T.name())) === "stairs", { same: docks0 === docks1 });
    await p.keyboard.press("Escape");

    /* two rooms, one dragged onto the other */
    await view("iso"); await hover([0, 0, 0]); await p.keyboard.press("u");
    await click([0, 0, 0]); await hover([3, 2, 0]); await vcb("4,3");
    let A = await AR();
    check("U Room: a click on the origin + \"4,3\" = a 4 × 3 m room (walls, floor, ceiling); the panel shows the next room's settings",
      A.rooms.length === 1 && JSON.stringify(A.rooms[0].pts) === "[[0,0],[4,0],[4,3],[0,3]]" && /Room 1 4 m × 3 m/.test(await msg()) && await ev(() => /Wall height/.test(document.getElementById("ppProps").innerText)), A.rooms);
    await ev(() => H3PushPull.state.V.extents());
    await hover([5, 0.5, 0]); await click([5, 0.5, 0]); await hover([7, 2, 0]); await vcb("3,3");
    await view("top"); await p.keyboard.press(" ");
    await drag([6.5, 2, 0], [5.65, 1.55, 0]);
    A = await AR();
    const r2 = A.rooms[1];
    check("Select + DRAG the second room near the first: its wall snaps onto the first room's - ONE shared wall (and the corner lines up)",
      Math.abs(r2.pts[0][0] - 4) < 1e-6 && Math.abs(r2.pts[0][1]) < 1e-6 && /shares a wall with Room 1/.test(await msg()), { pts: r2.pts, msg: await msg() });
    const wallTops = await ev(() => H3PushPull.state.A.built.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === 1 && Math.abs(pl.rings[0][0][2] - 2.7) < 1e-6).map((pl) => pl.rings.length));
    check("…the walls are one solid round both rooms (its top: one outline + two room holes)", wallTops.join() === "3", wallTops);
    const undoN = await ev(() => H3PushPull.state.undo.length);

    /* a door in the shared wall, a window, the door dragged */
    await p.keyboard.press("d"); await click([4, 1.5, 2.7]);
    A = await AR();
    const dr = A.ops[0], drRoom = A.rooms.find((R) => R.id === dr.room);
    const onShared = dr && (() => { const P = drRoom.pts, a = P[dr.edge], bb = P[(dr.edge + 1) % P.length]; return Math.abs(a[0] - 4) < 1e-6 && Math.abs(bb[0] - 4) < 1e-6; })();
    check("D Door: a click on the shared wall = a door in it (the wall's middle snaps)", dr && dr.kind === "door" && onShared && Math.abs(dr.at - 1.5) < 1e-6 && /a door in Room/.test(await msg()), { dr, msg: await msg() });
    const cut = await ev(() => H3PushPull.state.A.built.polys.filter((pl) => pl.tag.ak === "wall" && pl.n[2] === -1 && pl.rings[0].every((q) => Math.abs(q[2] - 2.1) < 1e-6)).length);
    check("…it goes through the shared wall (one cut, the lintel over it)", cut === 1, cut);
    await view("iso"); await p.keyboard.press("i"); await click([2, 0, 1.4]);
    A = await AR();
    check("I Window: a click on the front wall = a window (sill 90 cm, 1.2 × 1.2 m)", A.ops.length === 2 && A.ops[1].kind === "window" && A.ops[1].sill === 0.9 && A.ops[1].w === 1.2, A.ops);
    await p.keyboard.press(" ");
    await ev(() => { const V = H3PushPull.state.V; V.cam().position.set(6.6, 1.5, 1.5); V.controls.target.set(4, 1.5, 1.1); V.controls.update(); V.draw(); });   // inside the second room, looking at the door
    await drag([4.05, 1.5, 1.0], [4.05, 2.1, 1.0]);
    A = await AR();
    check("Select + drag the door: it slides along its wall", Math.abs(A.ops[0].at - 1.5) > 0.3 && A.ops[0].room === dr.room, A.ops[0]);

    /* lights */
    await view("top"); await p.keyboard.press("x"); await p.waitForTimeout(150);
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; s.value = "pendant"; s.dispatchEvent(new Event("change")); });
    await ev(() => H3PushPull.state.A.cut(true));
    await click([2, 1.5, 0]);
    await ev(() => { const s = [...document.querySelectorAll("#ppProps select")][0]; s.value = "chandelier"; s.dispatchEvent(new Event("change")); });
    await click([5.5, 1.5, 0]);
    A = await AR();
    const room1 = A.rooms[0].id;
    check("X Light: the panel's type - a pendant + a chandelier clicked into the rooms go on their ceilings (2.7 m), each in its room; the middle snaps",
      A.lights.length === 2 && A.lights[0].type === "pendant" && A.lights[1].type === "chandelier" && A.lights.every((L) => Math.abs(L.z - 2.7) < 1e-6) && A.lights[0].room === room1 && Math.abs(A.lights[0].x - 2) < 1e-6 && Math.abs(A.lights[0].y - 1.5) < 1e-6, A.lights);
    await ev(() => H3PushPull.state.A.cut(false));
    const lit = await ev(() => { const A2 = H3PushPull.state.A; let n = 0; A2.fixtures.traverse((o) => { if (o.isLight) n++; }); return n; });
    check("…each is a real light in the 3D view (point / spot) with its fixture", lit >= 2, lit);

    /* ceiling off, a roof over both */
    await view("iso"); await p.keyboard.press("k"); await click([5.5, 1.5, 2.7]);
    A = await AR();
    check("K Ceiling: a click on a room = its ceiling off", A.rooms[1].ceilOn === false && A.rooms[0].ceilOn === true);
    await p.keyboard.press("y"); await click([2, 1.5, 2.7]);
    await p.keyboard.down("Shift"); await click([5.5, 1.5, 2.7]); await p.keyboard.up("Shift");
    A = await AR();
    check("Y Roof: a click on a room = a roof over it; Shift+click the second room = the same roof over both", A.roofs.length === 1 && A.roofs[0].rooms.length === 2 && A.roofs[0].type === "gable", A.roofs);
    await ev(() => H3PushPull.state.V.extents());

    /* night, cut-away */
    await ev(() => document.getElementById("ppNight").click()); await ev(() => document.getElementById("ppCut").click());
    const nc = await ev(() => { const S = H3PushPull.state; let on = 0; S.A.fixtures.traverse((o) => { if (o.isLight && o.visible) on++; }); return { night: S.A.isNight, hemi: S.V.hemi.intensity, sun: S.V.sun.intensity, on, roofs: S.A.group.children.filter((o) => o.userData.layer === "roof").every((o) => !o.visible), btn: document.getElementById("ppNight").textContent }; });
    check("🌙 Night: the sun and sky down, the lights on; ⌂ Cut-away: the roof (and ceilings) hidden", nc.night && nc.hemi < 0.2 && nc.sun === 0 && nc.on >= 2 && nc.roofs && /Day/.test(nc.btn), nc);
    if (process.env.PP_SHOT) { await p.waitForTimeout(300); await p.screenshot({ path: process.env.PP_SHOT }); }
    await ev(() => document.getElementById("ppNight").click()); await ev(() => document.getElementById("ppCut").click());

    /* the panel: a room's wall height - its ceiling light follows; Delete, undo */
    await view("top"); await p.keyboard.press(" "); await ev(() => H3PushPull.state.A.cut(true)); await click([1, 2.5, 0]);
    const ps = await ev(() => ({ sel: H3PushPull.state.T.arch.sel(), txt: document.getElementById("ppProps").innerText }));
    await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => /^Wall height/.test(l.textContent)); const i = r.querySelector("input"); i.value = "3"; i.dispatchEvent(new Event("change")); });
    A = await AR();
    check("Select a room: the panel shows it (name, size, walls, colours, ⟳ ⧉ △ 🗑); its wall height → 3 m and its pendant goes up with the ceiling",
      ps.sel && ps.sel.ak === "room" && /Room 1/.test(ps.txt) && /Walls inside/.test(ps.txt) && /Duplicate/.test(ps.txt) && A.rooms[0].h === 3 && Math.abs(A.lights[0].z - 3) < 1e-6, { ps, h: A.rooms[0].h, z: A.lights[0].z });
    await ev(() => H3PushPull.state.A.cut(false));
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "op", id: S.M.arch.ops[0].id }); });
    await hover([2, 1.5, 0]); await p.keyboard.press("Delete"); await p.waitForTimeout(150);
    const del = (await AR()).ops.length;
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    const und = (await AR()).ops.length;
    check("Delete erases the picked door; Ctrl+Z brings it back (the building is undone with the model)", del === 1 && und === 2 && undoN > 0, { del, und });

    /* walls, stairs, a floor */
    await view("top"); await p.keyboard.press("w");
    await click([0, -1, 0]); await click([3, -1, 0]); await click([3, -2, 0]); await p.keyboard.press("Escape");
    A = await AR();
    const wl = A.rooms.find((R) => R.closed === false);
    check("W Wall: click, click, click, Esc = a free-standing wall (two runs)", wl && wl.pts.length === 3 && /Wall 1/.test(await msg()), A.rooms.map((R) => [R.closed, R.pts.length]));
    await p.keyboard.press("v"); await click([-2, 0, 0]); await hover([-2, 2, 0]); await vcb("3.6");
    await p.keyboard.press("j"); await click([4, -1.5, 0]); await hover([5, -0.5, 0]); await vcb("2,3");
    A = await AR();
    check("V Stairs: the foot + \"3.6\" = a flight 3.6 m long; J Floor: two corners + \"2,3\" = a 2 × 3 m floor", A.stairs.length === 1 && Math.abs(A.stairs[0].len - 3.6) < 1e-6 && A.slabs.length === 1 && JSON.stringify(A.slabs[0].pts.map((q) => q.map((c) => +c.toFixed(6)))) === "[[4,-1.5],[6,-1.5],[6,1.5],[4,1.5]]", { st: A.stairs, sl: A.slabs });

    /* Esc puts the maximized docker back */
    await p.keyboard.press(" "); await hover([3, 1.5, 0]);
    const picked = await ev(() => !!H3PushPull.state.T.arch.sel());
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    const still = await ev(() => document.getElementById("pushpulldock").classList.contains("maxed") && !H3PushPull.state.T.arch.sel());
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    const unmax = await ev(() => { const d = document.getElementById("pushpulldock"); return { maxed: d.classList.contains("maxed"), pos: getComputedStyle(d).position }; });
    check("Esc lets go of what is picked first (still maximized); Esc again (nothing else going) puts the maximized docker back", picked && still && !unmax.maxed && unmax.pos !== "fixed", { picked, still, unmax });
    await ev(() => toggleMax("pushpulldock", true)); await p.waitForTimeout(300);

    /* ☰ File */
    await p.click("#ppFile"); await p.waitForTimeout(150);
    const items = await ev(() => [...document.querySelectorAll(".ppmenu div")].map((d) => d.textContent));
    check("☰ File: New, Open, Save, Save as, Rename, import (project / this computer), Export, → image editor / timeline, Send, Dock (2.624.0: was Restore), Delete, Close",
      ["＋ New", "📂 Open…", "💾 Save as…", "✎ Rename…", "⤒ A 3D model of the project…", "⤓ Export…", "🖼 → the image editor", "🎞 → the timeline", "⇲ Dock - back in its place", "🗑 Delete this model…", "✕ Close the docker"].every((t) => items.some((x) => x.startsWith(t))), items);
    await ev(() => [...document.querySelectorAll(".ppmenu div")].find((d) => d.textContent.startsWith("💾 Save as…")).click()); await p.waitForTimeout(200);
    await p.fill(".ppask input", "House A"); await p.keyboard.press("Enter"); await p.waitForTimeout(600);
    let list = await api("/api/pushpull"), saved = await api("/api/pushpull/" + encodeURIComponent("House A"));
    check("…Save as: its own question box (no browser prompt) - \"House A\" kept in the project WITH the building", (list.models || []).some((x) => x.name === "House A") && saved.model.arch && saved.model.arch.rooms.length === 3 && saved.model.arch.lights.length === 2, list);
    await p.click("#ppFile"); await ev(() => [...document.querySelectorAll(".ppmenu div")].find((d) => d.textContent.startsWith("✎ Rename…")).click()); await p.waitForTimeout(200);
    await p.fill(".ppask input", "House B"); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
    list = await api("/api/pushpull");
    check("…Rename: \"House B\" (\"House A\" gone)", list.models.some((x) => x.name === "House B") && !list.models.some((x) => x.name === "House A"), list.models.map((x) => x.name));
    await ev(() => H3PushPull.newModel()); await p.waitForTimeout(500);
    const empty = await ev(() => !(H3PushPull.state.M.arch && H3PushPull.state.M.arch.rooms.length));
    await ev(() => H3PushPull.open("House B")); await p.waitForTimeout(500);
    A = await AR();
    check("＋ New is empty; opening \"House B\" brings the rooms, door, window, lights, roof back", empty && A.rooms.length === 3 && A.ops.length === 2 && A.lights.length === 2 && A.roofs.length === 1, { empty, n: A.rooms && A.rooms.length });

    /* out: the two buttons + glTF lights */
    const tl1 = await ev(async () => { const n0 = JSON.stringify(tl).length; document.getElementById("ppToTL").click(); await new Promise((r) => setTimeout(r, 1500)); return { has: JSON.stringify(tl).includes("pp_House_B"), grew: JSON.stringify(tl).length > n0, msg: document.getElementById("ppMsg").textContent }; });
    check("🎞 → Timeline (the bar's button): the building as a 3D layer", tl1.has && /timeline/.test(tl1.msg), tl1);
    const ie = await ev(async () => { document.getElementById("ppToIE").click(); await new Promise((r) => setTimeout(r, 1800)); const E = window.imageEditorInstance && window.imageEditorInstance.E; return { w: E && E.S.w, msg: document.getElementById("ppMsg").textContent }; });
    check("🖼 → Image editor (the bar's button): a picture of the view", ie.w > 100 && /image editor/.test(ie.msg), ie);
    const gl = await ev(async () => { const n = await H3PushPull.toProject("glb", { lights: true }); const buf = new Uint8Array(await (await fetch("/api/tlcanvas/model/" + encodeURIComponent(n))).arrayBuffer()); const jl = new DataView(buf.buffer).getUint32(12, true); const J = JSON.parse(new TextDecoder().decode(buf.slice(20, 20 + jl))); return { n, lights: J.extensions && J.extensions.KHR_lights_punctual.lights.length, glass: J.materials.some((m) => m.alphaMode === "BLEND"), size: buf.length }; });
    check("⤓ .glb with the lights: the walls, doors, glass (see-through) and the 2 lights as glTF lights", gl.lights === 2 && gl.glass && gl.size > 20000, gl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
