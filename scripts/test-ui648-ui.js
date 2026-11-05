#!/usr/bin/env node
/* bitGen Studio — 2.648.0 in a REAL browser: SHIFT + RIGHT-DRAG ZOOMS (forward = in, back = out), ⊡ ZOOM TO SELECTION and the
 * POINTER icon - in the Sketcher, the timeline's canvas and the image editor.
 * Tim (verbatim): "add zoom control, shift + drag foward = zoom in, shift + drag back = zoom out, add a zoom to selection
 * tool, change the selection icon to a pointer. do these changes for sketcher,timeline and image editor" (Shift + the RIGHT
 * button, the pick / move tools get the pointer - Tim's picks). Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.648.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_zoom648_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  // Shift + right-drag from (x, y) by dy px (negative = forward / up)
  const sdrag = async (x, y, dy) => { await p.mouse.move(x, y); await p.keyboard.down("Shift"); await p.mouse.down({ button: "right" }); await p.mouse.move(x, y + dy / 2, { steps: 4 }); await p.mouse.move(x, y + dy, { steps: 4 }); await p.mouse.up({ button: "right" }); await p.keyboard.up("Shift"); await p.waitForTimeout(200); };
  const menus = () => ev(() => [...document.querySelectorAll(".ctxmenu, .h3ctx, .pcctx, .tlctx, .cmenu, [role=menu]")].filter((m) => m.offsetParent !== null && getComputedStyle(m).display !== "none").length);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ZoomDrag && window.H3PointerIcon && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    check("the helpers load: H3ZoomDrag (forward = in: factor(-100) ≈ 1.82, back = out), H3PointerIcon", await ev(() => { const f = H3ZoomDrag.factor; return Math.abs(f(-100) - 1.822) < 0.01 && f(100) < 1 && H3ZoomDrag.isPress({ button: 2, shiftKey: true }) && !H3ZoomDrag.isPress({ button: 0, shiftKey: true }) && !H3ZoomDrag.isPress({ button: 2, shiftKey: true, ctrlKey: true }) && /<path d="M6 3/.test(H3PointerIcon.svg()); }));

    /* ================= the Sketcher ================= */
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" }); PPArch.addRoom(A, [[12, 0], [14, 0], [14, 2], [12, 2]], { name: "Shed" }); H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(400);
    check("Sketcher: ⬚ Select is a pointer (an arrow)", await ev(() => { const b = document.getElementById("ppT_select"); return !!b.querySelector("svg path") && b.dataset.icon === "pointer" && /Select/.test(b.title); }));
    const vc = await ev(() => { const r = H3PushPull.state.V.canvas.getBoundingClientRect(); return [r.left + r.width * 0.6, r.top + r.height * 0.55]; });
    const sk = () => ev(() => { const V = H3PushPull.state.V, c = V.cam(); return { d: c.position.distanceTo(V.controls.target), t: V.controls.target.toArray(), zoom: c.zoom }; });
    const w0 = await ev(([x, y]) => { const V = H3PushPull.state.V, r = V.canvas.getBoundingClientRect(), q = V.ray({ clientX: x, clientY: y }); return q; }, vc);
    const s0 = await sk(); await sdrag(vc[0], vc[1], -120); const s1 = await sk();
    check("Sketcher: Shift + right-drag FORWARD zooms in (the eye closer)", s1.d < s0.d * 0.7, { s0, s1 });
    await sdrag(vc[0], vc[1], 240); const s2 = await sk();
    check("…BACK zooms out (farther than before)", s2.d > s0.d * 1.2, { s0, s2 });
    check("…no right-click menu opened by the drags; Select still the tool (the drag did not pick / pan)", (await menus()) === 0 && await ev(() => H3PushPull.state.T.name() === "select"));
    // the point pressed stays put while zooming
    const keep = await ev(([x, y]) => { const V = H3PushPull.state.V, r = V.canvas.getBoundingClientRect(), sx = x - r.left, sy = y - r.top; const pt = (() => { const q = V.ray({ clientX: x, clientY: y }), t = V.controls.target, c = V.cam(), d = new V.T.Vector3(); c.getWorldDirection(d); const k = ((t.x - q.o[0]) * d.x + (t.y - q.o[1]) * d.y + (t.z - q.o[2]) * d.z) / (q.d[0] * d.x + q.d[1] * d.y + q.d[2] * d.z); return [q.o[0] + q.d[0] * k, q.o[1] + q.d[1] * k, q.o[2] + q.d[2] * k]; })();
      V.zoomAt(1.8, sx, sy); const s = V.screen(pt); return Math.hypot(s[0] - sx, s[1] - sy); }, vc);
    check("…round the point pressed (it stays under the pointer: within 2 px)", keep < 2, keep);
    // ⊡ zoom to the picked room
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[1].id }); });
    await p.click("#ppZoomSel"); await p.waitForTimeout(300);
    const zs = await ev(() => { const V = H3PushPull.state.V, r = V.canvas.getBoundingClientRect(), c = V.screen([13, 1, 1.35]); return { t: V.controls.target.toArray().map((v) => +v.toFixed(2)), off: [c[0] - r.width / 2, c[1] - r.height / 2].map(Math.round), msg: document.getElementById("ppMsg").textContent }; });
    check("Sketcher ⊡ Zoom to selection: the picked room (the Shed) in the middle of the view", Math.abs(zs.t[0] - 13) < 0.05 && Math.abs(zs.t[1] - 1) < 0.05 && Math.abs(zs.off[0]) < 6 && Math.abs(zs.off[1]) < 6 && /zoomed to/.test(zs.msg), zs);
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel(null); }); await p.click("#ppZoomSel"); await p.waitForTimeout(200);
    check("…nothing picked: everything in view", /nothing picked/.test(await ev(() => document.getElementById("ppMsg").textContent)));
    // the floorplan: Shift + right-drag keeps it flat
    await p.click("#ppPlan"); await p.waitForTimeout(400);
    const pz0 = await sk(); await sdrag(vc[0], vc[1], -100);
    const pz1 = await ev(() => { const V = H3PushPull.state.V, d = new V.T.Vector3(); V.cam().getWorldDirection(d); return { zoom: V.cam().zoom, down: d.z }; });
    check("…on the 📐 floorplan: Shift + right-drag forward zooms in, it stays straight down", pz1.zoom > pz0.zoom * 1.4 && pz1.down < -0.999, { pz0, pz1 });
    await p.click("#ppPlan"); await p.waitForTimeout(300);

    // Esc (Tim: "if in orbit mode and the user press esc go to select, esc any other time will go to orbit mode - do not dock
    // the maximized docker when esc is pressed")
    await ev(() => H3PushPull.tool("select")); await p.mouse.move(vc[0], vc[1]);
    await p.keyboard.press("Escape"); await p.waitForTimeout(120); const e1 = await ev(() => H3PushPull.state.T.name());
    await p.keyboard.press("Escape"); await p.waitForTimeout(120); const e2 = await ev(() => H3PushPull.state.T.name());
    await p.keyboard.press("Escape"); await p.waitForTimeout(120); const e3 = await ev(() => H3PushPull.state.T.name());
    check("Sketcher Esc: Select -> 🔄 Orbit, in Orbit -> ➤ Select, then Orbit again", e1 === "orbit" && e2 === "select" && e3 === "orbit", [e1, e2, e3]);
    await p.mouse.move(4, 4); await ev(() => { document.activeElement && document.activeElement.blur(); }); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…Esc never docks the maximized Sketcher (the pointer off it too)", await ev(() => document.getElementById("pushpulldock").classList.contains("maxed")));

    // the pick tool: a click = one thing, Ctrl+click adds, a drag of one of them moves them all, a click on one = only it
    await ev(() => { const S = H3PushPull.state; S.V.view("top"); S.V.extents(); H3PushPull.tool("select"); }); await p.waitForTimeout(300);
    const scrW = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    const pk = () => ev(() => H3PushPull.state.T.arch.picked().map((t) => t.ak + ":" + t.id));
    let [mx, my] = await scrW([1, 3.5, 0]); await p.mouse.click(mx, my); await p.waitForTimeout(150);
    const one = await pk();
    [mx, my] = await scrW([13.5, 1.5, 0]); await p.keyboard.down("Control"); await p.mouse.click(mx, my); await p.keyboard.up("Control"); await p.waitForTimeout(150);
    const two = await pk(), head2 = await ev(() => (document.querySelector("#ppProps .pph") || {}).textContent);
    check("a click picks ONE thing; Ctrl+click adds another (the panel: 2 picked)", one.length === 1 && two.length === 2 && /2 picked/.test(head2), { one, two, head2 });
    const r0 = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts[0][0]));
    await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.move(mx + 70, my, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const r1 = await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts[0][0]));
    check("…dragging one of them moves both rooms the same way", r1[0] - r0[0] > 0.3 && Math.abs((r1[0] - r0[0]) - (r1[1] - r0[1])) < 1e-6 && (await pk()).length === 2, { r0, r1 });
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…one undo step puts them both back", JSON.stringify(await ev(() => H3PushPull.state.M.arch.rooms.map((R) => R.pts[0][0]))) === JSON.stringify(r0));
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id }); S.T.arch.setMore([{ ak: "room", id: S.M.arch.rooms[1].id }]); S.T.arch.props(); });
    await p.mouse.move(vc[0], vc[1]); await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    const nDel = await ev(() => H3PushPull.state.M.arch.rooms.length);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(250);
    check("…Delete erases every picked part (one undo brings them back)", nDel === 0 && await ev(() => H3PushPull.state.M.arch.rooms.length === 2), nDel);
    await ev(() => H3PushPullFrame.toggleMaxed(false)); await p.waitForTimeout(300);

    /* ================= the image editor ================= */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForFunction(() => window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.zoomToSel, null, { timeout: 30000 });
    await ev(() => { const E = window.imageEditorInstance.E; if (E.setFull) E.setFull(true); else if (E.toggleFull) E.toggleFull(); }); await p.waitForTimeout(600);
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(1200, 800, "zoom648", (g) => { g.fillStyle = "#3060c0"; g.fillRect(0, 0, 1200, 800); }); }); await p.waitForTimeout(500);
    check("image editor: ✥ Move is a pointer (an arrow) on the tool column; ⊡ Zoom to Selection beside 🔍", await ev(() => { const b = document.querySelector('#kxTools .ietool[data-group="v"]'); return !!b && b.dataset.tool === "move" && b.querySelector("path").getAttribute("d") === H3PointerIcon.PATH && !!document.getElementById("pcZoomSel"); }));
    const st = await ev(() => { const r = window.imageEditorInstance.E.stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const iz = () => ev(() => window.imageEditorInstance.E.S.zoom);
    const z0 = await iz(); await sdrag(st[0], st[1], -100); const z1 = await iz(); await sdrag(st[0], st[1], 200); const z2 = await iz();
    check("image editor: Shift + right-drag forward zooms in, back zooms out", z1 > z0 * 1.6 && z2 < z0 * 0.8, { z0, z1, z2 });
    check("…no menu, nothing painted (the picture still one colour)", (await menus()) === 0 && await ev(() => { const L = window.imageEditorInstance.E.S.layers[0], d = L.canvas.getContext("2d").getImageData(600, 400, 1, 1).data; return d[0] === 0x30 && d[2] === 0xc0; }));
    // a selection, then ⊡
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, m = new Uint8Array(S.w * S.h); for (let y = 100; y < 200; y++) for (let x = 900; x < 1100; x++) m[y * S.w + x] = 255; E.setSel(m); });
    await p.click("#pcZoomSel"); await p.waitForTimeout(250);
    const isel = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, st = E.stage; return { z: S.zoom, cx: Math.round(S.panX + 1000 * S.zoom - st.clientWidth / 2), cy: Math.round(S.panY + 150 * S.zoom - st.clientHeight / 2), fill: Math.round(200 * S.zoom), w: st.clientWidth }; });
    check("image editor ⊡ Zoom to Selection: the selection's box in the middle, filling the view", Math.abs(isel.cx) <= 2 && Math.abs(isel.cy) <= 2 && isel.fill > isel.w * 0.5, isel);
    check("…View ▸ Zoom to Selection (Ctrl+Alt+0) is a command", await ev(() => { const c = window.imageEditorInstance.E.ui.CMD.get("view.zoomsel"); return !!c && c.key === "Alt+Ctrl+0"; }));
    // 🎨 Artist mode: Shift + right-drag zooms (still artist mode); Shift + right-CLICK leaves it
    await ev(() => { const E = window.imageEditorInstance.E; if (E.setFull) E.setFull(false); E.focus.set(true); }); await p.waitForTimeout(500);
    const a0 = await iz(); await sdrag(800, 500, -80); const a1 = await iz();
    check("🎨 artist mode: Shift + right-drag zooms - artist mode stays", a1 > a0 * 1.4 && await ev(() => document.body.classList.contains("ie-focus")), { a0, a1 });
    await p.mouse.move(800, 500); await p.keyboard.down("Shift"); await p.mouse.down({ button: "right" }); await p.mouse.up({ button: "right" }); await p.keyboard.up("Shift"); await p.waitForTimeout(300);
    check("…Shift + right-CLICK (no drag) still leaves artist mode", await ev(() => !document.body.classList.contains("ie-focus")));

    /* ================= the timeline's canvas ================= */
    await ev(() => { const d = document.getElementById("timelinedock"); if (d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("timelinedock", "tT"); if (/collapsed/.test(d.className)) toggleCollapse("timelinedock"); setVar("th", 820); if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click(); });
    // (this test layout keeps the timeline in a 255 px column: it is pinned big for the test)
    await ev(() => { const d = document.getElementById("timelinedock"); d.dataset.t648 = d.getAttribute("style") || ""; d.style.cssText += ";position:fixed;left:20px;top:40px;width:1500px;height:900px;z-index:9000"; window.dispatchEvent(new Event("resize")); }); await p.waitForTimeout(800);
    await p.waitForFunction(() => window.TlCanvas && TlCanvas.zoomToSel && document.getElementById("tlCanvas").getBoundingClientRect().width > 100, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    check("timeline: ✥ Move is a pointer (an arrow); ⊡ Zoom to selection beside ⤢", await ev(() => { const b = document.getElementById("tlTool_move"); return !!b.querySelector("svg path") && b.dataset.icon === "pointer" && !!document.getElementById("tlTool_zsel"); }));
    const tc = await ev(() => { const r = document.getElementById("tlCanvas").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const tz = () => ev(() => TlCanvas.view().z);
    const t0 = await tz(); await sdrag(tc[0], tc[1], -100); const t1 = await tz(); await sdrag(tc[0], tc[1], 200); const t2 = await tz();
    check("timeline canvas: Shift + right-drag forward zooms in, back zooms out", t1 > t0 * 1.6 && t2 < t0 * 0.8, { t0, t1, t2 });
    check("…no right-click menu after the drags", (await menus()) === 0);
    // a text layer picked -> ⊡
    await ev(() => TlCanvas.setTool("text")); const [qx, qy] = await ev(() => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(TlCanvas.state.W * 0.8, TlCanvas.state.H * 0.2); return [r.left + s.x, r.top + s.y]; });
    await p.mouse.click(qx, qy); await p.waitForTimeout(400); await p.keyboard.type("Zoom"); await ev(() => { document.activeElement && document.activeElement.blur(); TlCanvas.setTool("move"); }); await p.waitForTimeout(300);
    const hasSel = await ev(() => typeof tlSelClip !== "undefined" && !!tlSelClip);
    await ev(() => document.getElementById("tlTool_zsel").click()); await p.waitForTimeout(300);
    const tzs = await ev(() => { const v = TlCanvas.view(), c = tlSelClip, Ly = TlCanvas.layerOf(c), b = TlCanvas.box(c, Ly.kind), r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(b.cx, b.cy); return { z: v.z, fit: v.fit, off: [s.x - r.width / 2, s.y - r.height / 2].map(Math.round) }; });
    check("timeline ⊡ Zoom to selection: the picked layer in the middle, zoomed in on it", hasSel && !tzs.fit && Math.abs(tzs.off[0]) <= 2 && Math.abs(tzs.off[1]) <= 2 && tzs.z > t0, Object.assign({ hasSel, t0 }, tzs));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E; if (E && E.focus) E.focus.set(false); if (window.H3PushPullFrame) H3PushPullFrame.toggleMaxed(false); const d = document.getElementById("timelinedock"); if (d && d.dataset.t648 != null) d.setAttribute("style", d.dataset.t648); }); } catch { /* fine */ }
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
