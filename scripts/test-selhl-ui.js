#!/usr/bin/env node
/* bitGen Studio — 2.470.0 in a REAL browser: PICKING LIKE A DRAWING / CAD PROGRAM + THE CAD TOOLBAR (pcselhl.js,
 * pccadbar.js, static/cadbar.js, ext/timelinedock/tlcadbar.js + tlselhl.js).
 * Tim (verbatim): "on mouseover of a shape or object or smart object, highlight the border ... then use a different
 * highlight color when it is selected. automatically select the move tool once the shape is drawn (on mouseup) when i
 * click away from the shape deselect it ... make the sketch toolbar a top docker like fusion 360 in image editor and timeline"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the picking / CAD toolbar browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.selHl && window.imageEditorInstance.E.cadBar && window.TlCadBar, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    const ovCount = () => ev(() => { const E = window.imageEditorInstance.E; E.drawOverlay(); const c = E.ov, D = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let o = 0, b = 0;
      for (let i = 0; i < D.length; i += 4) { const r = D[i], g = D[i + 1], bl = D[i + 2], a = D[i + 3]; if (a < 200) continue; if (r > 225 && g > 110 && g < 165 && bl < 70) o++; else if (r < 100 && g > 130 && g < 190 && bl > 220) b++; } return { orange: o, blue: b }; });
    const tab = async (sel, t) => { await p.click(`${sel} .cbtab[data-tab="${t}"]`); await p.waitForTimeout(120); };
    // the toolbar along the top, over the tool options
    // 2.494.0: the toolbar shows only while a sketch / body is picked - or pinned with the ⌬ CAD button in the tool column
    const hid0 = await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display);
    await ev(() => document.getElementById("pcCadBtn").click()); await p.waitForTimeout(150);
    check("the ⌬ CAD button (the tool column): the CAD toolbar hidden until it is pressed (or a sketch is picked), then shown + the button lit", hid0 === "none" && (await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display)) === "" && (await ev(() => document.getElementById("pcCadBtn").classList.contains("on"))), hid0);
    const bar = await ev(() => { const el = document.querySelector('.cadbar[data-cadbar="cadbar.ie"]'), k = document.getElementById("kxBar"); return el ? { tabs: [...el.querySelectorAll(".cbtab")].map((x) => x.textContent), before: el.nextElementSibling === k, groups: [...el.querySelectorAll(".cbgl")].map((x) => x.textContent) } : null; });
    check("the CAD toolbar over the tool options: SKETCH · SHAPES tabs; SELECT / CREATE / MODIFY / CONSTRAINTS / INSPECT / INSERT / FINISH SKETCH groups", !!bar && bar.before && bar.tabs.slice(0, 2).join() === "SKETCH,SHAPES" && /SELECT/.test(bar.groups[0]) && /CREATE/.test(bar.groups[1]) && bar.groups.length === 7 && /FINISH SKETCH/.test(bar.groups[6]), bar);
    await tab('.cadbar[data-cadbar="cadbar.ie"]', "shapes");
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="crect"]'); await p.waitForTimeout(150);
    let s = await st();
    check("SHAPES ▸ Rectangle picks the rectangle tool (its button lit)", s.tool === "crect" && await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="crect"]').classList.contains("on")), s.tool);
    await drag(100, 100, 260, 220);
    await p.waitForTimeout(250);
    s = await st();
    const o1 = await ovCount();
    check("on mouse-up after drawing: the Move tool, the new rectangle picked - its outline orange", s.tool === "move" && s.type === "shape" && o1.orange > 200, { s: [s.tool, s.type, s.n], o1 });
    await click(450, 330); await p.waitForTimeout(150);
    const o2 = await ovCount(), sel2 = await ev(() => window.imageEditorInstance.state.objSel);
    check("a click on empty canvas: nothing picked - no orange outline, no handles", sel2 === false && o2.orange < 20, { sel2, o2 });
    const [hx, hy] = await T(180, 160); await p.mouse.move(hx, hy, { steps: 4 }); await p.waitForTimeout(150);
    const o3 = await ovCount(), hov = await ev(() => { const h = window.imageEditorInstance.E.selHl.hover(); return h && h.type; });
    check("the pointer over the rectangle: its outline blue (it can be picked)", hov === "shape" && o3.blue > 200 && o3.orange < 20, { hov, o3 });
    const [ex, ey] = await T(500, 50); await p.mouse.move(ex, ey, { steps: 3 }); await p.waitForTimeout(120);
    const o3b = await ovCount();
    check("off it again: no outline", o3b.blue < 20, o3b);
    const box0 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return E.dockers.boxOf(L); });
    await drag(180, 160, 230, 190); await p.waitForTimeout(200);
    const box1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return { b: E.dockers.boxOf(L), sel: E.S.objSel, type: L.type }; });
    check("press on the rectangle + drag: picked (orange) and moved 50, 30", box1.sel === true && box1.type === "shape" && Math.abs(box1.b.x - box0.x - 50) <= 2 && Math.abs(box1.b.y - box0.y - 30) <= 2, { box0, box1 });
    // a drag on empty canvas moves nothing
    await click(520, 360);
    await drag(520, 360, 560, 380); await p.waitForTimeout(150);
    const box2 = await ev(() => { const E = window.imageEditorInstance.E; return E.dockers.boxOf(E.layer()); });
    check("a drag that starts on empty canvas moves nothing", Math.abs(box2.x - box1.b.x) <= 1 && Math.abs(box2.y - box1.b.y) <= 1, { box2, b1: box1.b });
    // Esc
    await click(200, 180); await key("Escape");
    check("Esc with the Move tool: nothing picked", (await ev(() => window.imageEditorInstance.state.objSel)) === false);
    // a second shape; then a click on the first picks it
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="cellipse"]'); await drag(380, 60, 520, 160); await p.waitForTimeout(250);
    s = await st(); const ell = s.name;
    await click(200, 180); await p.waitForTimeout(120);
    const s2 = await st();
    check("Ellipse drawn (the Move tool again), then a click on the rectangle picks the rectangle", s.tool === "move" && s2.type === "shape" && s2.name !== ell && s2.n === s.n, { s: [s.tool, ell], s2: [s2.name, s2.n] });
    // the sketch tab: a sketch tool -> the tab follows
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbtab[data-tab="sketch"]'); await p.waitForTimeout(100);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="c_newsketch"]'); await p.waitForTimeout(250);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="sk_line"]'); await p.waitForTimeout(150);
    const sk = await ev(() => { const E = window.imageEditorInstance.E, el = document.querySelector('.cadbar[data-cadbar="cadbar.ie"]'); return { tool: E.S.tool, type: E.layer().type, tab: E.cadBar.ui.tab(), consOn: !el.querySelector('.cbb[data-id="k_parallel"]').disabled, n: el.querySelectorAll(".cbin .cbb").length }; });
    check("SKETCH ▸ Create Sketch makes a sketch layer, Line picks the sketch line tool; the 12 constraint buttons on", sk.tool === "sk_line" && sk.type === "sketch" && sk.tab === "sketch" && sk.consOn && sk.n === 12, sk);
    await click(100, 300); await click(250, 300); await key("Escape"); await p.waitForTimeout(100);
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbgl[data-menu="1"]'); await p.waitForTimeout(120);
    const menu = await ev(() => { const m = document.querySelector(".cbmenu"); return m ? [...m.querySelectorAll(".mi")].map((x) => x.textContent) : null; });
    check("CREATE ▾ lists every create tool (Slot, Spline, 3-Point Circle …) - Create Sketch hidden while the sketch is being edited", !!menu && menu.length >= 11 && !menu.some((x) => /Create Sketch/.test(x)) && menu.some((x) => /Slot/.test(x)) && menu.some((x) => /Spline/.test(x)), menu);
    await p.keyboard.press("Escape"); await ev(() => { const m = document.querySelector(".cbmenu"); if (m) m.remove(); });
    await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="c_finish"]'); await p.waitForTimeout(150);
    check("FINISH SKETCH: the Move tool", (await st()).tool === "move");
    // the shape tools with the auto-move switched off
    await ev(() => window.imageEditorInstance.E.selHl.autoMove(false));
    await tab('.cadbar[data-cadbar="cadbar.ie"]', "shapes"); await p.click('.cadbar[data-cadbar="cadbar.ie"] .cbb[data-id="crect"]'); await drag(60, 260, 120, 330); await p.waitForTimeout(200);
    check("after drawing with \"Then Move Tool\" off: the tool stays", (await st()).tool === "crect");
    await ev(() => window.imageEditorInstance.E.selHl.autoMove(true));
    // Window ▸ CAD Toolbar
    await ev(() => window.imageEditorInstance.E.ui.run("win.cadbar"));
    const hid = await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display);
    await ev(() => window.imageEditorInstance.E.ui.run("win.cadbar"));
    check("Window ▸ CAD Toolbar hides / shows it", hid === "none" && (await ev(() => document.querySelector('.cadbar[data-cadbar="cadbar.ie"]').style.display)) === "");
    // the timeline's toolbar
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(500);
    const tlHid = await ev(() => document.getElementById("tlCadBar").style.display);
    await ev(() => document.getElementById("tlCadBtn").click()); await p.waitForTimeout(150);
    check("the timeline's ⌬ CAD button (the canvas's tool column) shows the CAD toolbar (hidden until then)", tlHid === "none" && (await ev(() => document.getElementById("tlCadBar").style.display)) === "" && (await ev(() => document.getElementById("tlCadBtn").classList.contains("on"))), tlHid);
    const tl = await ev(() => { const el = document.getElementById("tlCadBar"); return el ? { tabs: [...el.querySelectorAll(".cbtab")].map((x) => x.textContent), next: el.nextElementSibling && el.nextElementSibling.id } : null; });
    check("the timeline: the CAD toolbar over the preview row (CREATE · 3D · SKETCH)", !!tl && tl.tabs.slice(0, 3).join() === "CREATE,3D,SKETCH" && tl.next === "tlStage", tl);
    await ev(() => window.TlCadBar.ui.setTab("create"));
    await p.click('#tlCadBar .cbb[data-id="t_hand"]'); await p.waitForTimeout(100);
    const tlTool = await ev(() => window.TlCanvas.state.tool);
    await p.click('#tlCadBar .cbb[data-id="t_move"]');
    check("timeline CREATE ▸ Hand picks the Hand tool", tlTool === "hand", tlTool);
    await ev(() => window.TlCadBar.ui.setTab("sketch"));
    await p.click('#tlCadBar .cbb[data-id="s_blank"]'); await p.waitForTimeout(500);
    const ts = await ev(() => { const E = window.imageEditorInstance.E, C = window.TlCanvas.state; return { name: E.S.name || (E.doc && E.doc.name), w: E.S.w, h: E.S.h, W: C.W, H: C.H, type: E.layer().type }; });
    check("timeline SKETCH ▸ Sketch on a Blank Picture: the image editor at the timeline's size with a sketch layer", ts.w === ts.W && ts.h === ts.H && ts.type === "sketch", ts);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
