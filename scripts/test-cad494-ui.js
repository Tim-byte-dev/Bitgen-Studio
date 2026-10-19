/* bitGen Studio — 2.494.0 in a REAL browser: THE CAD WORKINGS REFINED - the ⌬ CAD button, Create Sketch hidden while sketching,
 * the Offset tool on a chain drawn every which way, ＋ at a picked line's end, Finish Sketch -> SOLID, picking the profile,
 * the view cube + Shift-middle orbit (ext/imageeditdock/pcsketch*.js, pccadbar.js, pcbody.js, static/cadbar.js, tlcadbar.js).
 * Tim (verbatim): "add orbit and pan viewport like fusion 360 does / select shape to extrude,revolve like fusion 360 does /
 * offset doesn't work. when user clicks create sketch hide the create sketch button, when user clicks finish sketch go to
 * solids / when user selects a line in sketch mode allow user to add lines. refine the cad workings / add a cad button in
 * the edit image toolbar and the video editor toolbox. only show cad tools when the cad button is selected or a sketch is selected"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the CAD workings browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(60000);
  const ev = (f, a) => p.evaluate(f, a);
  try {

    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.body && window.imageEditorInstance.E.cadBar && window.Body3D && window.TlCadBar, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const hover = async (x, y) => { const [a, c] = await T(x, y); await p.mouse.move(a, c, { steps: 3 }); await p.waitForTimeout(100); };
    const barShown = () => ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display !== "none");
    const has = (id) => ev((i) => !!document.querySelector('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="' + i + '"]'), id);
    const areas = () => ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return window.PCSketch.profiles(L.sketch, { withPaths: false }).map((q) => Math.round(q.area)).sort((a, b) => a - b); });
    const waitIdle = async (ms) => { for (let i = 0; i < (ms || 900); i++) { await p.waitForTimeout(100); if (!(await ev(() => window.imageEditorInstance.E.body.busy()))) break; } await p.waitForTimeout(150); };
    await ev(() => window.Body3D.setEngine("occ"));

    // 1. the ⌬ CAD button: the toolbar only with a sketch / body picked, or pinned
    const b0 = await barShown(), btn = await ev(() => { const b = document.getElementById("pcCadBtn"); return b ? { col: b.parentElement.id, on: b.classList.contains("on") } : null; });
    await ev(() => document.getElementById("pcCadBtn").click()); await p.waitForTimeout(150); const b1 = await barShown();
    await ev(() => document.getElementById("pcCadBtn").click()); await p.waitForTimeout(150); const b2 = await barShown();
    check("the ⌬ CAD button in the tool column: no sketch picked = no CAD toolbar; pressed = shown; again = hidden", !b0 && btn && btn.col === "kxTools" && !btn.on && b1 && !b2, { b0, btn, b1, b2 });

    // 2. a sketch: the toolbar shows by itself, Create Sketch hidden while sketching
    await ev(() => window.imageEditorInstance.E.ui.run("layer.newsketch")); await p.waitForTimeout(250);
    check("New Sketch: the CAD toolbar shows by itself (SKETCH tab, SELECT first); Create Sketch hidden while the sketch is edited", (await barShown()) && !(await has("c_newsketch")) && (await has("sk_select"))
      && (await ev(() => window.imageEditorInstance.E.cadBar.ui.tab())) === "sketch" && /SELECT/.test(await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"] .cbgl').textContent)));
    // a rectangle drawn every which way (2 of its 4 lines backwards)
    await ev(() => { const E = window.imageEditorInstance.E, K = window.PCSketch; const L = E.layer(); E.sketch.edit(L, "test rect", (s) => { const a = K.addPoint(s, 100, 100), b = K.addPoint(s, 300, 100), c = K.addPoint(s, 300, 200), d = K.addPoint(s, 100, 200); K.line(s, a, b); K.line(s, c, b); K.line(s, c, d); K.line(s, a, d); }); });
    // 3. Offset: the tool, pick one line = its chain, the pointer's side
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="c_offset"]'); await p.waitForTimeout(150);
    const tool1 = await ev(() => window.imageEditorInstance.state.tool);
    await click(200, 100); const pk = await ev(() => window.imageEditorInstance.E.sketch.offPicked());
    await hover(200, 85); await hover(200, 80);
    const typed = await ev(() => document.getElementById("skOffT").value);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + "-offset.png" });
    const u0 = await ev(() => window.imageEditorInstance.state.undo.length);
    await click(200, 80); const a1 = await areas(), u1 = await ev(() => window.imageEditorInstance.state.undo.length);
    check("SKETCH ▸ Offset = the Offset tool; a click on one line picks its whole chain (4); the pointer 20 out -> the distance box says 20", tool1 === "sk_offset" && pk && pk.length === 4 && typed === "20", { tool1, pk, typed });
    check("…click: the rectangle drawn every which way offset OUT all round (200 x 100 -> 240 x 140) - one undo step", JSON.stringify(a1) === "[20000,33600]" && u1 === u0 + 1, { a1, u0, u1 });
    await click(300, 150); await hover(260, 150); await hover(250, 150);
    await p.keyboard.press("5"); await p.waitForTimeout(80); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    const a2 = await areas();
    check("…pick the rectangle again, the pointer inside, type 5 + Enter: 5 IN all round (190 x 90)", JSON.stringify(a2) === "[17100,20000,33600]", a2);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    check("…undo: that offset gone (one step)", JSON.stringify(await areas()) === "[20000,33600]", await areas());
    // a refused edit leaves the sketch as it was
    const rb = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), n = L.sketch.ents.length; const r = E.sketch.edit(L, "refused", (s) => { window.PCSketch.addPoint(s, 5, 5); window.PCSketch.line(s, s.pts[s.pts.length - 1].id, s.pts[0].id); return false; }); return { r, same: L.sketch.ents.length === n }; });
    check("an edit that is refused (cannot solve) leaves the sketch as it was", rb.r === false && rb.same, rb);

    // 4. ＋ at a picked line's end: draw on from there
    await ev(() => window.imageEditorInstance.E.setTool("sk_select")); await p.keyboard.press("Escape").catch(() => {});
    await click(200, 100);
    const ph = await ev(() => { const E = window.imageEditorInstance.E, sel = E.sketch.sel(); const e = sel.length ? window.PCSketch.ent(E.layer().sketch, sel[0].id) : null; return { sel: sel.map((q) => q.k), h: E.sketch.plusHandles(), p1: e && e.p1, p2: e && e.p2 }; });
    const h0 = ph.h[0];
    if (h0) await click(h0.x, h0.y);
    const tool2 = await ev(() => window.imageEditorInstance.state.tool);
    await click(60, 40); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    const nl = await ev(([a, b]) => { const s = window.imageEditorInstance.E.layer().sketch; return s.ents.filter((e) => e.t === "line" && !e.axis && (e.p1 === a || e.p1 === b || e.p2 === a || e.p2 === b)).length; }, [ph.p1, ph.p2]);
    check("Sketch Select a line: ＋ at both its ends; click one = the Line tool going on from that end (a new line joined to it)", ph.sel.join() === "ent" && ph.h.length === 2 && tool2 === "sk_line" && nl >= 4, { ph, tool2, nl });

    // 5. Finish Sketch -> SOLID
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="sketch"]').catch(() => {}); await p.waitForTimeout(100);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="c_finish"]'); await p.waitForTimeout(200);
    const fin = await ev(() => ({ tab: window.imageEditorInstance.E.cadBar.ui.tab(), tool: window.imageEditorInstance.state.tool }));
    await ev(() => window.imageEditorInstance.E.cadBar.ui.setTab("sketch")); await p.waitForTimeout(100);
    check("Finish Sketch: the Move tool + the CAD toolbar on its SOLID tab; Create Sketch back (not sketching now)", fin.tab === "solid" && fin.tool === "move" && (await has("c_newsketch")), fin);

    // 6. picking the profile
    const pre = await ev(() => { const E = window.imageEditorInstance.E, s = E.layer().sketch, K = window.PCSketch; const pr = K.profiles(s, { withPaths: false }), inner = K.profileAt(s, 200, 150, pr), ids = pr[inner].loop.map((q) => q.e); E.sketch.setSel(ids.map((id) => ({ k: "ent", id }))); E.body.pickProfiles("extrude"); const d = document.querySelector(".kxdlg.pcd"); const out = { inner, dlg: !!d, some: d && d.querySelector('input[name="bdPr"][value="some"]').checked, on: d ? [...d.querySelectorAll("[data-pi]")].filter((x) => x.checked).map((x) => +x.dataset.pi) : null, picking: E.body.picking() }; if (d) d.querySelector(".cn").click(); E.sketch.setSel([]); return out; });
    check("Extrude with the rectangle's lines picked (Sketch Select): straight to the dialog with that region ticked", pre.dlg && pre.some && pre.on.join() === String(pre.inner) && !pre.picking, pre);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="solid"]'); await p.waitForTimeout(100);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="b_extrude"]'); await p.waitForTimeout(200);
    const pk2 = await ev(() => ({ pick: window.imageEditorInstance.E.body.picking(), tool: window.imageEditorInstance.state.tool }));
    await hover(200, 150); await click(200, 150);
    const pk3 = await ev(() => window.imageEditorInstance.E.body.picking());
    await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    check("SOLID ▸ Extrude with nothing picked (2 regions): the Pick Profiles tool - click the inner region = it; Enter = the dialog", pk2.tool === "bd_profile" && pk2.pick && pk2.pick.n === 2 && pk3 && pk3.picked.join() === String(pre.inner)
      && (await ev(() => !!document.querySelector(".kxdlg.pcd #bdD"))), { pk2, pk3 });
    await p.fill(".kxdlg.pcd #bdD", "20"); await p.click(".kxdlg.pcd .ok"); await waitIdle();
    const body = await ev(async () => { const E = window.imageEditorInstance.E, L = E.layer(); if (!E.body.isBody(L)) return null; const m = await E.body.ensureMesh(L); return { vol: window.Body3D.meshInfo(m).volume, prof: L.smart.body.features[0].profiles }; });
    check("…OK: a body of that region only (200 x 100 x 20)", body && Math.abs(body.vol - 200 * 100 * 20) < 50 && JSON.stringify(body.prof) === "[" + pre.inner + "]", body);

    // 7. the view cube + Shift-middle orbit
    const cube = await ev(() => { const c = document.getElementById("bdCube"), r = c.getBoundingClientRect(), s = document.getElementById("ieStage").getBoundingClientRect(); return { shown: c.style.display !== "none", inStage: r.left >= s.left && r.right <= s.right + 1 && r.top >= s.top, x: r.left, y: r.top }; });
    const front = await ev(() => { const L = window.imageEditorInstance.E.layer(), f = window.PCBody.cubeFaces(L.smart.body.view, 96).find((q) => q.name === "front"); return f ? f.pts.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]) : null; });
    if (front) { await p.mouse.click(cube.x + front[0], cube.y + front[1]); await waitIdle(); }
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + "-cube.png" });
    const v1 = await ev(() => window.imageEditorInstance.E.layer().smart.body.view);
    check("the VIEW CUBE (top right of the canvas while the body is picked): click its FRONT face = the front view", cube.shown && cube.inStage && !!front && v1.yaw === 0 && v1.pitch === 0 && v1.roll === 0, { cube, front, v1 });
    const u2 = await ev(() => window.imageEditorInstance.state.undo.length);
    const [mx, my] = await T(300, 200);
    await p.mouse.move(mx, my); await p.keyboard.down("Shift"); await p.mouse.down({ button: "middle" }); await p.mouse.move(mx + 60, my + 20, { steps: 6 }); await p.mouse.up({ button: "middle" }); await p.keyboard.up("Shift"); await waitIdle();
    const v2 = await ev(() => window.imageEditorInstance.E.layer().smart.body.view), u3 = await ev(() => window.imageEditorInstance.state.undo.length);
    check("Shift + middle-drag on the canvas orbits the body (turn + tilt follow the drag) - one undo step", v2.yaw === 30 && v2.pitch === 10 && u3 === u2 + 1, { v2, u2, u3 });
    await p.click('#bdCube [data-nav="home"]'); await waitIdle();
    const v3 = await ev(() => window.imageEditorInstance.E.layer().smart.body.view);
    check("…the cube's ⌂ Home = the corner view again", v3.yaw === -35 && v3.pitch === 25, v3);
    check("the CAD toolbar stays while the body is picked; a plain layer picked = hidden again", (await barShown()) && (await ev(() => { const E = window.imageEditorInstance.E; E.setActive(0); E.drawOverlay(); return document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display === "none" && document.getElementById("bdCube").style.display === "none"; })));

    // 8. the timeline's ⌬ CAD button
    const tl0 = await ev(() => document.getElementById("tlCadBar").style.display);
    await ev(() => document.getElementById("tlCadBtn").click()); await p.waitForTimeout(120);
    const tl1 = await ev(() => ({ d: document.getElementById("tlCadBar").style.display, on: document.getElementById("tlCadBtn").classList.contains("on"), col: document.getElementById("tlCadBtn").parentElement.id }));
    await ev(() => document.getElementById("tlCadBtn").click());
    check("the timeline's ⌬ CAD button (its tool column): the CAD toolbar off until pressed, then on", tl0 === "none" && tl1.d === "" && tl1.on && tl1.col === "tlTools", { tl0, tl1 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
