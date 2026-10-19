#!/usr/bin/env node
/* bitGen Studio — 2.421.0 in a REAL browser: the image editor's PEN, PATHS, VECTOR MASKS and CUSTOM SHAPES
 * (ext/imageeditdock/pcpath.js + pcpen.js) - gap 1 of the Photoshop list.
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the pen / paths browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pen && window.PCPath, null, { timeout: 60000 });
    await p.evaluate(() => { const E = window.imageEditorInstance.E; if (E.selHl) E.selHl.hold(true); });   // 2.470.0: these draw and then keep using the tool (no switch to the Move tool after drawing)
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.showTab("pcPaths"); });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(60); };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      shape: L && L.shape ? JSON.parse(JSON.stringify(L.shape)) : null, vmask: L && L.vmask ? JSON.parse(JSON.stringify(L.vmask)) : null, work: s.work ? JSON.parse(JSON.stringify(s.work)) : null,
      paths: JSON.parse(JSON.stringify(s.paths || [])), target: s.ptarget ? JSON.parse(JSON.stringify(s.ptarget)) : null, sel: s.selCount }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const flat = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(80); };
    const anchors = (path) => (path ? path.subs.reduce((n, s) => n + s.pts.length, 0) : 0);

    /* 1 the tool groups */
    await key("p"); const t1 = (await st()).tool; await key("Shift+p"); const t2 = (await st()).tool;
    await key("Shift+p"); await key("Shift+p"); await key("Shift+p"); await key("Shift+p"); const t5 = (await st()).tool;   // 2.425.0: + the Curvature Pen after the Freeform Pen
    await key("a"); const a1 = (await st()).tool; await key("Shift+a"); const a2 = (await st()).tool;
    const btns = await ev(() => [...document.querySelectorAll(".ietool")].map((x) => x.dataset.tools));
    check("P holds Pen, Freeform Pen, (2.425.0 Curvature Pen,) Add / Delete Anchor, Convert Point (Shift+P cycles); A holds Path / Direct Selection; U gains Custom Shape",
      t1 === "pen" && t2 === "freepen" && t5 === "convanchor" && a1 === "pathsel" && a2 === "directsel" && btns.some((x) => x === "shape,customshape"), { t1, t2, t5, a1, a2, btns });

    /* 2 the Pen in Shape mode: a triangle */
    await key("p");
    const remembered = (await st()).tool;
    await ev(() => { const S = window.imageEditorInstance.state; S.penMode = "shape"; S.penOp = "new"; window.imageEditorInstance.E.setTool("pen"); });
    const n0 = (await st()).n;
    await click(100, 300); await click(250, 60); await click(400, 300);
    let s = await st();
    check("Pen (Shape mode): the first click makes a new SHAPE layer (kind path) - each click an anchor, the path still open (P brings back the group's last tool)",
      remembered === "convanchor" && s.n === n0 + 1 && s.type === "shape" && s.shape.kind === "path" && s.shape.path.subs.length === 1 && s.shape.path.subs[0].pts.length === 3 && !s.shape.path.subs[0].closed, s.shape);
    await click(100, 300);
    s = await st();
    const inT = await lpx(250, 220), outT = await lpx(110, 80);
    check("...a click on the first anchor CLOSES it: the triangle is filled with the foreground colour (red inside, clear outside), its box = x / y / w / h",
      s.shape.path.subs[0].closed && inT[0] > 200 && inT[1] < 40 && inT[3] > 200 && outT[3] === 0 && Math.round(s.shape.x) === 100 && Math.round(s.shape.w) === 300 && Math.round(s.shape.h) === 240, { inT, outT, shape: s.shape });
    const shapeId = await ev(() => window.imageEditorInstance.state.layers[window.imageEditorInstance.state.active].id);

    /* 3 a curve: drag = smooth anchor with symmetric handles */
    await ev(() => { const S = window.imageEditorInstance.state; S.penMode = "path"; S.penOp = "add"; S.ptarget = null; window.imageEditorInstance.E.renderOptions(); });
    await click(60, 360); await drag(200, 360, 260, 300); await key("Enter");
    s = await st();
    const sp = s.work && s.work.subs[0] && s.work.subs[0].pts[1];
    check("Pen (Path mode): drawing with no path picked starts the WORK PATH; a drag makes a smooth anchor whose handles mirror (out = the pointer)",
      s.work && s.work.subs.length === 1 && sp && sp.smooth && Math.round(sp.ox) === 260 && Math.round(sp.oy) === 300 && Math.round(sp.ix) === 140 && Math.round(sp.iy) === 420 && s.target && s.target.k === "work", s.work);
    const panel = await ev(() => [...document.querySelectorAll("#pcPaths .pnrow")].map((r) => r.textContent));
    check("...the Paths panel lists the Work Path (and the active shape layer's Shape Path)", panel.includes("Work Path") && panel.some((t) => /Shape Path/.test(t)), panel);

    /* 4 Pen auto add / delete on the work path */
    const before = anchors(s.work);
    const mid = await ev(() => { const S = window.imageEditorInstance.state, Q = window.PCPath, c = Q.segs(S.work.subs[0])[0]; return Q.cubicAt(c, 0.5); });
    await click(mid[0], mid[1]);
    s = await st(); const afterAdd = anchors(s.work);
    await click(mid[0], mid[1]);
    s = await st(); const afterDel = anchors(s.work);
    check("Pen over the path: a click on a segment ADDS an anchor (the curve kept), a click on an anchor DELETES it", afterAdd === before + 1 && afterDel === before, { before, afterAdd, afterDel });

    /* 5 Direct Selection: move an anchor of the triangle shape */
    await ev((id) => { const E = window.imageEditorInstance.E, S = E.S; E.setActive(S.layers.findIndex((L) => L.id === id)); E.pen.setTarget({ k: "shape", id }); }, shapeId);
    await ev(() => window.imageEditorInstance.E.setTool("directsel"));
    const u5 = (await st()).undo;
    await drag(250, 60, 250, 20);
    s = await st();
    const apex = s.shape.path.subs[0].pts[1], newTop = await lpx(250, 40);
    check("Direct Selection: dragging the apex anchor reshapes the shape layer (anchor at 250,20, the others stay; the layer re-drawn there) - one undo step",
      Math.round(apex.x) === 250 && Math.round(apex.y) === 20 && Math.round(s.shape.path.subs[0].pts[0].y) === 300 && newTop[3] > 200 && Math.round(s.shape.y) === 20 && s.undo === u5 + 1, { apex, newTop, y: s.shape.y, u: s.undo, u5 });
    await key("Control+z"); s = await st();
    check("...Ctrl+Z puts the anchor back", Math.round(s.shape.path.subs[0].pts[1].y) === 60, s.shape.path.subs[0].pts[1]);
    await key("Control+Shift+z");

    /* 6 Convert Point: corner -> smooth -> corner */
    await ev(() => window.imageEditorInstance.E.setTool("convanchor"));
    await click(400, 300);
    s = await st(); const sm = s.shape.path.subs[0].pts[2];
    await click(400, 300);
    s = await st(); const co = s.shape.path.subs[0].pts[2];
    check("Convert Point: a click turns a corner smooth (handles along its neighbours) and back to a corner", sm.smooth && (sm.ix !== sm.x || sm.iy !== sm.y) && !co.smooth && co.ix === co.x && co.oy === co.y, { sm, co });

    /* 7 Path Selection: Alt-drag copies a component, Delete removes it, ops */
    await ev(() => window.imageEditorInstance.E.setTool("pathsel"));
    await drag(250, 200, 250, 240, ["Alt"]);
    s = await st();
    check("Path Selection: Alt-drag COPIES the component (2 now, the copy 40 px lower)", s.shape.path.subs.length === 2 && Math.round(s.shape.path.subs[1].pts[0].y) === 340, s.shape.path.subs.map((q) => q.pts[0]));
    await ev(() => document.querySelector('#kxOpts [data-pnsop="subtract"]').click()); await p.waitForTimeout(100);
    s = await st(); const holePx = await lpx(250, 280), keep = await lpx(250, 40);
    check("...its op = Subtract Front Shape: where the copy overlaps, the shape is cut away (the tip above the copy keeps its fill)", s.shape.path.subs[1].op === "subtract" && holePx[3] === 0 && keep[3] > 200, { op: s.shape.path.subs[1].op, holePx, keep });
    await key("Delete");
    s = await st();
    check("...Delete removes the picked component", s.shape.path.subs.length === 1, s.shape.path.subs.length);

    /* 8 Custom Shape: a ring (two components, the inner one subtracted) */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.cshape = "ring"; S.penMode = "shape"; S.penOp = "new"; E.setTool("customshape"); });
    const n1 = (await st()).n;
    await drag(420, 100, 560, 240);
    s = await st(); const ringC = await lpx(490, 170), ringE = await lpx(430, 170);
    check("Custom Shape (Ring): a new shape layer of 2 components - the middle cut out, the ring filled",
      s.n === n1 + 1 && s.shape.kind === "path" && s.shape.path.subs.length === 2 && s.shape.path.subs[1].op === "subtract" && ringC[3] === 0 && ringE[3] > 200, { n: s.n, ringC, ringE });
    const picker = await ev(() => { document.querySelector("#pnCsPick").click(); const n = document.querySelectorAll(".pncspop [data-cs]").length; document.querySelector('.pncspop [data-cs="heart"]').click(); return { n, now: window.imageEditorInstance.state.cshape }; });
    check("...its picker lists the shapes (heart, star, arrow, bubble, ring …) and picks one", picker.n >= 14 && picker.now === "heart", picker);

    /* 9 the Shape tool's ops: a rectangle with a smaller one subtracted = one layer with a hole */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.shapeKind = "rect"; S.shapeOp = "new"; E.setTool("shape"); });
    await drag(40, 40, 200, 160);
    const n2 = (await st()).n;
    await ev(() => document.querySelector('#kxOpts [data-pnshop="subtract"]').click());
    await drag(90, 80, 150, 120);
    s = await st(); const rHole = await lpx(120, 100), rFill = await lpx(60, 60);
    check("Shape tool + Subtract Front Shape: the second rectangle cuts a hole in the SAME layer (now a path shape, 2 components) - one undo step",
      s.n === n2 && s.shape.kind === "path" && s.shape.path.subs.length === 2 && rHole[3] === 0 && rFill[3] > 200, { n: s.n, n2, rHole, rFill, kind: s.shape.kind });
    await ev(() => { window.imageEditorInstance.E.S.shapeOp = "new"; });

    /* 10 path -> selection, fill, stroke; selection -> work path */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); E.pen.setTarget(null); E.S.work = null; });
    await ev(() => { const E = window.imageEditorInstance.E, Q = window.PCPath; E.pen.once("test path", () => { E.S.work = Q.fromShape({ kind: "rect", x: 300, y: 250, w: 100, h: 80 }); E.S.ptarget = { k: "work" }; }); E.pen.paint(); });
    await ev(() => { const r = [...document.querySelectorAll("#pcPaths .pnrow")].find((x) => x.dataset.pk === "work"); r.querySelector("canvas").dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })); });
    s = await st();
    check("Paths panel: Ctrl-click on the work path's thumbnail loads it as the SELECTION (100 x 80 px)", Math.abs(s.sel - 8000) < 200, s.sel);
    await ev(() => window.imageEditorInstance.E.deselect());
    await ev(() => document.querySelector("#pnFillB").click()); await p.waitForTimeout(100);
    const filled = await lpx(350, 290);
    await ev(() => { const E = window.imageEditorInstance.E; E.setFg("#0000ff"); E.setSize(6); document.querySelector("#pnStrokeB").click(); }); await p.waitForTimeout(150);
    const stroked = await lpx(300, 290), inner = await lpx(350, 290);
    check("● Fill Path paints the area with the foreground; ○ Stroke Path draws the brush along it (blue on the edge, the red fill inside kept)",
      filled[0] > 200 && filled[3] > 200 && stroked[2] > 150 && stroked[0] < 120 && inner[0] > 200, { filled, stroked, inner });
    await ev(() => { const E = window.imageEditorInstance.E, P = E.P, S = E.S; E.changeSel(P.ellipseMask(150, 300, 80, 50, S.w, S.h), "test ellipse"); E.pen.setTarget(null); });
    await ev(() => document.querySelector("#pnWorkB").click()); await p.waitForTimeout(150);
    s = await st();
    const back = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, Q = window.PCPath; const m = Q.areaMask(S.work, S.w, S.h, E.cv); let n = 0, both = 0; for (let i = 0; i < m.length; i++) { if (m[i] > 127) n++; if (m[i] > 127 && S.sel[i] > 127) both++; } return { n, both, sel: S.selCount }; });
    check("⟲ Make Work Path from Selection: an ellipse selection becomes a smooth closed path that covers the same pixels (within 3 %)",
      s.work && s.work.subs.length === 1 && s.work.subs[0].closed && s.work.subs[0].pts.length >= 4 && s.work.subs[0].pts.length <= 40 && Math.abs(back.n - back.sel) / back.sel < 0.03 && back.both / back.sel > 0.97, { pts: s.work && s.work.subs[0].pts.length, back });

    /* 11 save / rename / new / delete paths */
    await ev(() => { const r = [...document.querySelectorAll("#pcPaths .pnrow")].find((x) => x.dataset.pk === "work"); r.querySelector(".nm").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
    s = await st();
    check("double-click the Work Path = Save Path (Path 1, picked)", !s.work && s.paths.length === 1 && s.paths[0].name === "Path 1" && s.target.k === "saved", { work: !!s.work, paths: s.paths.map((x) => x.name) });
    await ev(() => document.querySelector("#pnDupB").click());
    s = await st();
    check("⧉ duplicates it (Path 1 copy)", s.paths.length === 2 && s.paths[1].name === "Path 1 copy", s.paths.map((x) => x.name));
    await ev(() => document.querySelector("#pnDelB").click());
    s = await st();
    check("🗑 deletes the picked path", s.paths.length === 1, s.paths.map((x) => x.name));

    /* 12 vector mask */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.deselect(); E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, S.w, S.h); L.ver++; E.refresh();
      E.pen.setTarget({ k: "saved", id: S.paths[0].id }); });
    await ev(() => window.imageEditorInstance.E.ui.run("vmask.path"));
    s = await st();
    const vin = await flat(150, 300), vout = await flat(20, 20);
    const vthumb = await ev(() => document.querySelectorAll("#kxLayers .kxlayer.on canvas.vmk").length);
    check("Layer ▸ Vector Mask: Current Path - the green layer shows only inside the path (an ellipse); its row has a vector-mask thumbnail",
      s.vmask && s.vmask.path.subs.length === 1 && vin[1] > 200 && vin[0] < 60 && vout[0] > 200 && vthumb === 1, { vin, vout, vthumb });
    await ev(() => { const c = document.querySelector("#kxLayers .kxlayer.on canvas.vmk"); c.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })); });
    const voff = await flat(20, 20);
    await key("Control+z");
    const von = await flat(20, 20);
    check("...Shift-click its thumbnail disables it (green everywhere); Ctrl+Z enables it again", voff[0] < 60 && voff[1] > 200 && von[0] > 200, { voff, von });
    await ev(() => { window.imageEditorInstance.E.ui.showTab("pcProps"); });
    await ev(() => { const r = document.querySelector("#ppVFeath"); r.value = 20; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); });
    s = await st(); const edge = await flat(70, 300);
    check("...Properties: the vector mask's Feather softens its edge (half-shown at the edge)", s.vmask.feather === 20 && edge[0] > 30 && edge[0] < 225, { f: s.vmask.feather, edge });
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcPaths"));
    // the move tool carries a linked vector mask
    await ev(() => window.imageEditorInstance.E.setTool("move"));
    const vb0 = (await st()).vmask.path.subs[0].pts[0];
    await drag(300, 200, 340, 200);
    const vb1 = (await st()).vmask.path.subs[0].pts[0];
    check("...the Move tool moves the layer AND its linked vector mask (40 px)", Math.round(vb1.x - vb0.x) === 40 && Math.round(vb1.y - vb0.y) === 0, { vb0, vb1 });
    await ev(() => window.imageEditorInstance.E.ui.run("vmask.raster"));
    s = await st(); const rm = await ev(() => { const L = window.imageEditorInstance.E.layer(); return !!L.mask; });
    check("...Vector Mask: Rasterize turns it into a pixel layer mask (the picture unchanged)", !s.vmask && rm, { vmask: !!s.vmask, rm });

    /* 13 the picture's size changes take the paths along */
    const p0 = await ev(() => JSON.parse(JSON.stringify(window.imageEditorInstance.state.paths[0].path.subs[0].pts[0])));
    await ev(() => window.imageEditorInstance.E.img.size(300, 200));
    const p1 = await ev(() => JSON.parse(JSON.stringify(window.imageEditorInstance.state.paths[0].path.subs[0].pts[0])));
    const shp = await ev((id) => { const L = window.imageEditorInstance.state.layers.find((x) => x.id === id); return L ? { x: L.shape.x, w: L.shape.w } : null; }, shapeId);
    check("Image Size 50 %: saved paths and path shapes scale with the picture", Math.abs(p1.x - p0.x / 2) < 0.6 && Math.abs(p1.y - p0.y / 2) < 0.6 && shp && Math.abs(shp.x - 50) < 1 && Math.abs(shp.w - 150) < 1, { p0, p1, shp });
    await key("Control+z");
    const p2 = await ev(() => JSON.parse(JSON.stringify(window.imageEditorInstance.state.paths[0].path.subs[0].pts[0])));
    check("...and Ctrl+Z puts them back with the picture", Math.abs(p2.x - p0.x) < 1e-6 && Math.abs(p2.y - p0.y) < 1e-6, { p0, p2 });

    /* 14 PSD: a path shape and a vector mask go out and come back as paths */
    const psd = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S, Q = window.PCPath;
      E.newLayer(); const L = E.layer(); L.canvas.getContext("2d").fillStyle = "#123456"; L.canvas.getContext("2d").fillRect(0, 0, S.w, S.h); L.vmask = { path: Q.fromShape({ kind: "ellipse", x: 100, y: 100, w: 200, h: 150 }), on: true, density: 1, feather: 0, linked: true, invert: false };
      const { buf } = await E.psdToBuffer();
      await E.psdOpenBuffer(buf, "paths.psd");
      const shapes = S.layers.filter((x) => x.type === "shape" && x.shape.kind === "path"), vm = S.layers.filter((x) => x.vmask);
      return { shapes: shapes.length, anchors: shapes.map((x) => Q.count(x.shape.path)), vm: vm.length, vmA: vm.map((x) => Q.count(x.vmask.path)), fill: shapes.map((x) => x.shape.fill) };
    });
    check("PSD: path shape layers are saved as Photoshop vector shapes and the vector mask as a vector mask - both open again as editable paths",
      psd.shapes >= 3 && psd.vm === 1 && psd.vmA[0] === 4 && psd.fill.includes("#ff0000"), psd);

    /* 15 SVG out / in */
    const svg = await ev(() => { const E = window.imageEditorInstance.E, Q = window.PCPath; const d = Q.svgDoc(Q.custom("star5", 10, 10, 200, 200), 600, 400, "#ff8800"); E.pen.importSvgText(d, "star.svg", true); const L = E.layer(); return { type: L.type, kind: L.shape && L.shape.kind, n: Q.count(L.shape.path), name: L.name }; });
    check("SVG: a file's outlines come in as a shape layer (Place SVG as Shape Layer) - the star's 10 corners", svg.type === "shape" && svg.kind === "path" && svg.n === 10 && svg.name === "star", svg);

    /* 16 Freeform Pen */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.penMode = "path"; S.penOp = "add"; E.pen.setTarget(null); S.work = null; E.setTool("freepen"); });
    const [fx0, fy0] = await T(100, 100); await p.mouse.move(fx0, fy0); await p.mouse.down();
    for (let i = 1; i <= 40; i++) { const a = i / 40 * Math.PI * 2; const [x, y] = await T(160 - Math.cos(a) * 60, 100 - Math.sin(a) * 60 * 0.8); await p.mouse.move(x, y); }
    await p.mouse.up(); await p.waitForTimeout(150);
    s = await st();
    check("Freeform Pen: a hand-drawn loop becomes a closed work path with a few smooth anchors (not one per mouse move)",
      s.work && s.work.subs.length === 1 && s.work.subs[0].closed && s.work.subs[0].pts.length >= 4 && s.work.subs[0].pts.length <= 16 && s.work.subs[0].pts.some((a) => a.smooth), s.work && s.work.subs[0].pts.length);

    await ev(() => window.imageEditorInstance.E.ui.run("help.guide")); await p.waitForTimeout(800);
    const help = await ev(() => { const d = document.querySelector("dialog.hpdlg[open]"); return d ? d.textContent : ""; });
    check("Help ▸ Image Editor Help… (F1) opens the editor's own help page: the Pen, Paths, vector masks", /The Pen/.test(help) && /The Paths panel/.test(help) && /Vector masks/.test(help), help.slice(0, 300));
    await p.keyboard.press("Escape");
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed - " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
