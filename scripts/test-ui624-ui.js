#!/usr/bin/env node
/* bitGen Studio — 2.624.0 in a REAL browser: THE 📏 PUSHPULL DOCKER - THEME COLOURS, A WALL'S OFFSET FROM A FLOOR'S EDGE,
 * WALLS DRAGGED + SNAPPED ONTO IT, CUT + SLOPED WALL TOPS, FOLLOW CEILING / ROOF + EAVES, DOUBLE-CLICK EMPTY = ORBIT,
 * ⛶ / "⇲ Dock" + ✕ IN ITS TITLE BAR.
 * Tim: "in push/pull docker make it the same theme colors as bitgen. when user creates walls add offset input to offset wall
 * from edge of floor, allow user to drag walls but show snap regions on floor and allow user to snap wall to floor edge, when
 * user double clicks the the top of a wall cut the face allow the use to drag that edge up and down and delete the edge when
 * the del button is pressed and edge is selected. allow user to select edges on the wall to change slope of the wall. in
 * ceiling options add flat ceiling, follow slope of walls, with roof follow slope of walls add eaves width input. when user
 * double clicks empty space deselect everything ang go into orbit mode"
 * + "add a maximize and close button to the puss pull dockers titlebar change maximize button to dock button when maximized"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.624.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_arch624_" + process.pid;
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3PushPullFrame && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => {
      const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); if (d.classList.contains("collapsed")) toggleCollapse("pushpulldock");
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP");
      document.getElementById("titlebar").classList.remove("hidden");
      d.scrollIntoView({ block: "start" });
    });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.T && H3PushPull.state.A, null, { timeout: 40000 });
    await p.waitForTimeout(500);

    /* the title bar: ⛶ / ⇲ Dock, ✕ */
    const tb0 = await ev(() => { const m = document.getElementById("ppMaxBtn"), c = document.getElementById("ppCloseBtn"); return { m: m && m.textContent, mv: !!(m && m.offsetWidth), c: c && c.textContent, cv: !!(c && c.offsetWidth), inHead: !!(m && m.closest(".bhead") && c.closest(".bhead")) }; });
    check("the docker's title bar has ⛶ maximize and ✕ close", tb0.m === "⛶" && tb0.mv && tb0.c === "✕" && tb0.cv && tb0.inHead, tb0);
    await p.click("#ppMaxBtn"); await p.waitForTimeout(400);
    const tb1 = await ev(() => { const d = document.getElementById("pushpulldock"), m = document.getElementById("ppMaxBtn"), r = d.getBoundingClientRect(); return { maxed: d.classList.contains("maxed"), m: m.textContent, title: m.title, w: r.width, W: innerWidth, y: Math.round(r.y), tb: Math.round(document.getElementById("titlebar").getBoundingClientRect().bottom) }; });
    check("⛶: the whole window under the title bar - the button is now \"⇲ Dock\"", tb1.maxed && tb1.m === "⇲ Dock" && /Dock/.test(tb1.title) && tb1.w === tb1.W && tb1.y === tb1.tb, tb1);
    await p.click("#ppMaxBtn"); await p.waitForTimeout(400);
    const tb2 = await ev(() => ({ maxed: document.getElementById("pushpulldock").classList.contains("maxed"), m: document.getElementById("ppMaxBtn").textContent }));
    check("⇲ Dock: back in its place, ⛶ again", !tb2.maxed && tb2.m === "⛶", tb2);
    await p.click("#ppCloseBtn"); await p.waitForTimeout(300);
    const gone = await ev(() => document.getElementById("pushpulldock").classList.contains("dockgone"));
    await ev(() => { toggleDockGone("pushpulldock", "tX_pushpulldock"); }); await p.waitForTimeout(300);
    check("✕: the docker is closed (the dock bar's 📏 shows it again)", gone && !(await ev(() => document.getElementById("pushpulldock").classList.contains("dockgone"))));
    await p.click("#ppMaxBtn"); await p.waitForTimeout(500);

    /* bitGen's theme colours */
    const th = await ev(async () => {
      const V = H3PushPull.state.V, before = V.clear, root = document.documentElement, keep = [root.style.getPropertyValue("--ink"), root.style.getPropertyValue("--tiger")];
      root.style.setProperty("--ink", "#123456"); root.style.setProperty("--tiger", "#33cc99"); window.dispatchEvent(new Event("h3theme"));
      await new Promise((r) => setTimeout(r, 300));
      const got = { before, clear: V.clear, accent: V.theme.accent, view: getComputedStyle(document.getElementById("ppView")).backgroundColor };
      root.style.setProperty("--ink", keep[0]); root.style.setProperty("--tiger", keep[1]); if (!keep[0]) root.style.removeProperty("--ink"); if (!keep[1]) root.style.removeProperty("--tiger"); window.dispatchEvent(new Event("h3theme"));
      await new Promise((r) => setTimeout(r, 200)); got.after = V.clear; return got;
    });
    check("bitGen's theme colours: the 3D view's background is the theme's (--ink), the selection its accent; a theme change repaints it", th.clear === 0x123456 && th.accent.toLowerCase() === "#33cc99" && th.view === "rgb(18, 52, 86)" && th.after === th.before, th);

    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const click = async (w, o) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.click(x, y, o); await p.waitForTimeout(150); };
    const moveTo = async (w) => { const [x, y] = await scr(w); await p.mouse.move(x, y, { steps: 3 }); };
    const vcb = async (t) => { await p.keyboard.type(t); await p.keyboard.press("Enter"); await p.waitForTimeout(250); };
    const AR = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch || {})));
    const msg = () => ev(() => document.getElementById("ppMsg").textContent);
    const panelSet = (label, v) => ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith(label)); if (!r) return false; const i = r.querySelector("input, select"); i.value = v; i.dispatchEvent(new Event("change")); return true; }, [label, v]);

    /* a floor, a room on its corner with the offset */
    await ev(() => H3PushPull.state.V.view("top"));
    await p.keyboard.press("j"); await click([0, 0, 0]); await moveTo([3, 2, 0]); await vcb("6,5");
    await ev(() => H3PushPull.state.V.extents()); await p.waitForTimeout(200);
    await p.keyboard.press("u"); await p.waitForTimeout(150);
    const hasOff = await panelSet("Offset from floor edge", "0.1");
    await click([0, 0, 0.15]); await moveTo([3, 2, 0]); await vcb("4,3");
    let A = await AR();
    const R0 = A.rooms[0];
    check("U Room with \"Offset from floor edge\" 10 cm, drawn on the floor's corner: the walls on its edges sit 10 cm in (outside face), the others where drawn",
      hasOff && R0 && near(R0.pts[0][0], 0.175) && near(R0.pts[0][1], 0.175) && near(R0.pts[2][0], 4) && near(R0.pts[2][1], 3), R0 && R0.pts);

    /* a wall dragged towards the floor's edge: the snap regions, then on the edge */
    await p.keyboard.press(" "); await p.waitForTimeout(100);
    const wy = (R0.pts[1][1] + R0.pts[2][1]) / 2, wx = R0.pts[1][0] + 0.07;
    {
      const [a1, b1] = await scr([wx, wy, 1.5]), [a2, b2] = await scr([5.82, wy, 1.5]);
      await p.mouse.move(a1, b1, { steps: 2 }); await p.mouse.down(); await p.mouse.move((a1 + a2) / 2, b1, { steps: 6 }); await p.mouse.move(a2, b2, { steps: 6 }); await p.waitForTimeout(200);
      const reg = await ev(() => { const V = H3PushPull.state.V, g = V.scene.getObjectByName("pp-preview"); let n = 0; if (g) g.traverse((o) => { if (o.isMesh || o.isLine || o.isLineSegments) n++; }); return { n, msg: document.getElementById("ppMsg").textContent }; });
      await p.mouse.up(); await p.waitForTimeout(250);
      A = await AR();
      const x1 = A.rooms[0].pts[1][0];
      check("Select + drag one wall: the floor's snap regions show while dragging, it lets go ON the floor's edge (10 cm in: centre 6 − 0.1 − 0.075)", reg.n > 0 && near(x1, 5.825) && near(A.rooms[0].pts[0][0], 0.175), { reg, x1 });
    }

    /* a cut in a wall's top, dragged up; an edge's slope; Delete */
    await ev(() => H3PushPull.state.V.view("iso")); await p.waitForTimeout(150);
    let R = (await AR()).rooms[0];
    const mid = [(R.pts[0][0] + R.pts[1][0]) / 2, R.pts[0][1], 2.7];
    { const [x, y] = await scr(mid); await p.mouse.move(x, y, { steps: 3 }); await p.mouse.dblclick(x, y); await p.waitForTimeout(300); }
    A = await AR(); R = A.rooms[0];
    const sel1 = await ev(() => H3PushPull.state.T.arch.sel());
    check("double-click the top of a wall: a cut there (picked, ready to drag)", R.tops && R.tops[0] && R.tops[0].length === 3 && sel1 && sel1.ak === "wpt" && /cut/.test(await msg()), { tops: R.tops, sel1 });
    {
      const [x, y] = await scr(mid), [x2, y2] = await scr([mid[0], mid[1], 4]);
      await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x, (y + y2) / 2, { steps: 5 }); await p.mouse.move(x2, y2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
    }
    A = await AR(); R = A.rooms[0];
    check("…dragged up: the wall's top rises to it from both corners (a gable)", R.tops[0][1][1] > 3.6 && near(R.tops[0][0][1], 2.7) && near(R.tops[0][2][1], 2.7), R.tops[0]);
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "wpt", room: S.M.arch.rooms[0].id, edge: 0, k: 1 }); });
    await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    A = await AR();
    check("…picked + Delete: the cut goes, the wall is flat again", !(A.rooms[0].tops || {})[0], A.rooms[0].tops);
    // the slope: the top edge of the left wall (from the front, its end) - pick the edge and drag it: a shed wall
    const t0 = await ev(() => { const S = H3PushPull.state, R = S.M.arch.rooms[0]; S.T.arch.setSel({ ak: "wtop", room: R.id, edge: 0, k: 0 }); return document.getElementById("ppProps").textContent; });
    const setH = await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].filter((l) => /height/i.test(l.textContent)); if (r.length < 2) return r.length; const i = r[1].querySelector("input"); i.value = "3.5"; i.dispatchEvent(new Event("change")); return r.length; });
    await p.waitForTimeout(200);
    A = await AR(); R = A.rooms[0];
    check("a top EDGE selected: its ends' heights in the panel - one end 3.5 m = the wall slopes (the wall beside follows)", setH >= 2 && R.tops[0] && near(R.tops[0][R.tops[0].length - 1][1], 3.5) && near(R.tops[0][0][1], 2.7) && R.tops[1] && near(R.tops[1][0][1], 3.5), { setH, tops: R.tops, t0: t0.slice(0, 200) });
    await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    A = await AR();
    check("…Delete on the edge: flat again", !(A.rooms[0].tops || {})[0] && !(A.rooms[0].tops || {})[1], A.rooms[0].tops);

    /* the ceiling + the roof follow the walls */
    await ev(() => { const S = H3PushPull.state, A = S.M.arch, R = A.rooms[0]; [0, 2].forEach((i) => { const k = PPArch.cutTop(A, R.id, i, 0.5); PPArch.moveTopPoint(A, R.id, i, k, 4); }); S.V.setModel(S.M); S.T.arch.setSel({ ak: "room", id: R.id }); });
    await p.waitForTimeout(200);
    const ceilOpts = await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => /^Ceiling/.test(l.textContent) && l.querySelector("select")); return r ? [...r.querySelector("select").options].map((o) => o.textContent) : null; });
    await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => /^Ceiling/.test(l.textContent) && l.querySelector("select")); const s = r.querySelector("select"); s.value = "follow"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(250);
    const cz = await ev(() => { const B = H3PushPull.state.A.built; const zz = B.polys.filter((pl) => pl.tag.part === "ceil").flatMap((pl) => pl.rings[0].map((q) => q[2])); return { room: H3PushPull.state.M.arch.rooms[0].ceil, max: Math.max(...zz), min: Math.min(...zz) }; });
    check("the room's Ceiling: None / Flat / Follows the walls' slope - Follows = up under the gable", JSON.stringify(ceilOpts) === JSON.stringify(["None", "Flat", "Follows the walls' slope"]) && cz.room === "follow" && cz.max > 3.7 && cz.min < 2.75, { ceilOpts, cz });
    await ev(() => H3PushPull.state.V.view("iso"));
    await p.click("#ppT_roof"); await p.waitForTimeout(150);
    const roofType = await ev(() => { const r = [...document.querySelectorAll("#ppProps label")].find((l) => l.textContent.startsWith("Type")); return r ? [...r.querySelector("select").options].map((o) => o.value) : []; });
    await panelSet("Type", "follow"); await p.waitForTimeout(150);
    const eav = await panelSet("Eaves width", "0.6"); await p.waitForTimeout(150);
    await ev(() => H3PushPull.state.V.view("top")); await p.waitForTimeout(150);
    R = (await AR()).rooms[0];
    await click([(R.pts[0][0] + R.pts[2][0]) / 2, (R.pts[0][1] + R.pts[2][1]) / 2, 0]);
    A = await AR();
    const rb = await ev(() => { const pl = H3PushPull.state.A.built.polys.filter((x) => x.tag.ak === "roof"); const xs = pl.flatMap((x) => x.rings[0].map((q) => q[0])); return { n: pl.length, x0: Math.min(...xs) }; });
    check("K Roof: \"Follows the walls' slope\" + Eaves width 60 cm - a roof on the walls' tops, 60 cm past them", roofType.includes("follow") && eav && A.roofs.length === 1 && A.roofs[0].type === "follow" && near(A.roofs[0].over, 0.6) && rb.n > 4 && near(rb.x0, R.pts[0][0] - 0.075 - 0.6, 0.01), { roofType, eav, roofs: A.roofs, rb });
    await p.screenshot({ path: path.join(require("os").tmpdir(), "ui624_roof.png") });

    /* double-click empty space: nothing picked, Orbit */
    await p.keyboard.press(" ");
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id }); S.V.view("iso"); });
    await p.waitForTimeout(150);
    { const r = await ev(() => { const c = H3PushPull.state.V.canvas.getBoundingClientRect(); return [c.left + 12, c.top + 12]; }); await p.mouse.dblclick(r[0], r[1]); await p.waitForTimeout(250); }
    const orb = await ev(() => ({ tool: H3PushPull.state.T.name(), sel: H3PushPull.state.T.arch.sel(), f: H3PushPull.state.sel.f.length, msg: document.getElementById("ppMsg").textContent }));
    check("double-click empty space: everything deselected, the Orbit tool", orb.tool === "orbit" && !orb.sel && orb.f === 0 && /Orbit/.test(orb.msg), orb);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("maxed")) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
