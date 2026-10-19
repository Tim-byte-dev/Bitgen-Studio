#!/usr/bin/env node
/* bitGen Studio — 2.425.0 in a REAL browser: CORELDRAW'S CURVE TOOLS (F5), SHAPE TOOL (F10), OUTLINE PEN (F12),
 * CONVERT TO CURVES (Ctrl+Q), VECTOR LINE <-> PATH, PHOTOSHOP'S CURVATURE PEN, RUBBER BAND, PATH ALIGN / DISTRIBUTE
 * (ext/imageeditdock/pcvline.js + pcbezier.js).
 * Tim (verbatim): "continue with the photoshop gap closure, add a bezier line tool that can be a vector and converted to
 * a path and back to a vector. make the bezier line tool the same as coreldraw" - keys "Corel keys: F5 + F10".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the vector line browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.vline, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#d01010"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (pts, mods) => { await p.waitForTimeout(120); for (const m of mods || []) await p.keyboard.down(m); const q = []; for (const [x, y] of pts) q.push(await T(x, y)); await p.mouse.move(...q[0]); await p.mouse.down(); for (const r of q.slice(1)) await p.mouse.move(r[0], r[1], { steps: 5 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(120); };
    const dbl = async (x, y) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); await p.mouse.dblclick(a, c); await p.waitForTimeout(200); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(150); };
    const tool = (t) => ev((t) => window.imageEditorInstance.E.setTool(t), t);
    const L = () => ev(() => { const s = window.imageEditorInstance.state, A = s.layers[s.active], sh = A && A.shape; return { n: s.layers.length, undo: s.undo.length, name: A && A.name, type: A && A.type, line: sh && sh.line ? sh.line : null, w: sh && sh.strokeW, fillOn: sh && sh.fillOn,
      subs: sh && sh.path ? sh.path.subs.map((q) => ({ closed: q.closed, n: q.pts.length, types: q.pts.map((a) => (!a.smooth ? "c" : a.sym ? "y" : "s")).join(""), pts: q.pts.map((a) => [Math.round(a.x), Math.round(a.y)]) })) : null, kind: sh && sh.kind }; });
    const apx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, A = s.layers[s.active]; return Array.from(A.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const opt = async (sel, v) => { await p.selectOption("#kxOpts " + sel, v); await p.waitForTimeout(200); };

    /* 1 keys + the tool column */
    await key("F5");
    const t1 = await ev(() => window.imageEditorInstance.state.tool);
    await key("F5");
    const t2 = await ev(() => window.imageEditorInstance.state.tool);
    await key("F10");
    const t3 = await ev(() => window.imageEditorInstance.state.tool);
    const groups = await ev(() => [...document.querySelectorAll("#kxTools .ietool")].map((x) => x.dataset.tools));
    check("F5 = the Bézier tool, F5 again = the next curve tool (Freehand), F10 = the Shape tool; the column has the F5 group, F10 and the Curvature Pen in P",
      t1 === "bezier" && t2 === "freehand" && t3 === "shapetool" && groups.some((g) => /^bezier,freehand,line2,polyline,curve3,bspline,cpen(,cmedia)?$/.test(g)) && groups.includes("shapetool") && groups.some((g) => /^pen,freepen,curvpen,/.test(g)), [t1, t2, t3, groups]);

    /* 2 Bézier: click = cusp, drag = smooth, Enter ends */
    await tool("bezier");
    const n0 = (await L()).n, u0 = (await L()).undo;
    await click(80, 300);
    await drag([[250, 120], [330, 120]]);
    await click(420, 300);
    await key("Enter");
    let s = await L();
    check("Bézier: click, drag, click, Enter = a VECTOR LINE layer \"Curve n\" with 3 nodes (cusp, smooth, cusp), one undo step a node",
      s.n === n0 + 1 && /^Curve \d+$/.test(s.name) && s.type === "shape" && s.kind === "path" && s.line && s.subs.length === 1 && !s.subs[0].closed && s.subs[0].n === 3 && s.subs[0].types === "csc" && s.undo === u0 + 3, s);
    const ink = await apx(250, 120);
    check("...drawn: its outline in the foreground colour where the curve passes (the smooth node at 250,120)", ink[3] > 200 && ink[0] > 150 && ink[1] < 80, ink);

    /* 3 carry on from its open end; close a new one; Esc drops */
    await click(420, 300); await click(500, 360); await key("Enter");
    s = await L();
    check("Bézier from an open end of the active line carries THAT line on (4 nodes, still one layer)", s.n === n0 + 1 && s.subs[0].n === 4 && s.subs[0].pts[3][0] === 500, s);
    await click(100, 60); await click(200, 60); await click(150, 20, ["Control"]); await click(100, 60);
    s = await L();
    check("...a click on the first node closes it (a new line, closed, 3 nodes); Ctrl constrained the third to 15° steps", s.n === n0 + 2 && s.subs[0].closed && s.subs[0].n === 3, s);
    const u1 = (await L()).undo, n1 = (await L()).n;
    await click(300, 200); await click(350, 220); await key("Escape");
    s = await L();
    check("...Esc drops the line being drawn (its layer and its undo steps)", s.n === n1 && s.undo === u1, [s.n, n1, s.undo, u1]);

    /* 4 the property bar: arrowheads, style, width */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.active = S.layers.findIndex((x) => x.shape && x.shape.path && x.shape.path.subs[0] && x.shape.path.subs[0].pts.length === 4); E.renderLayersPanel(); E.renderOptions(); });
    await opt("#vlEnd", "arrow"); await opt("#vlStyle", "dash");
    await p.fill("#kxOpts #vlW", "6"); await p.dispatchEvent("#kxOpts #vlW", "change"); await p.waitForTimeout(200);
    s = await L();
    const tip = await apx(497, 357);
    check("property bar: end arrowhead, dashed, width 6 - on the line (an undo step each) and drawn (the arrowhead's tip is solid)", s.line.end === "arrow" && s.line.style === "dash" && s.w === 6 && tip[3] > 200, [s.line, s.w, tip]);

    /* 5 the Shape tool (F10) */
    await key("F10");
    const nd = s.subs[0].pts[1];
    await click(nd[0], nd[1]);
    await ev(() => document.querySelector('#kxOpts [data-vlnt="symmetrical"]').click()); await p.waitForTimeout(150);
    s = await L();
    check("Shape tool: click a node, ⇔ Symmetrical (the property bar) - its type", s.subs[0].types[1] === "y", s.subs[0].types);
    await drag([[nd[0], nd[1]], [nd[0] + 30, nd[1] + 40]]);
    s = await L();
    check("...drag a node: it moves", Math.abs(s.subs[0].pts[1][0] - (nd[0] + 30)) <= 2 && Math.abs(s.subs[0].pts[1][1] - (nd[1] + 40)) <= 2, s.subs[0].pts);
    const seg = await ev(() => { const E = window.imageEditorInstance.E, A = E.layer(), c = window.PCPath.segs(A.shape.path.subs[0])[2]; return window.PCPath.cubicAt(c, 0.5).map(Math.round); });
    await dbl(seg[0], seg[1]);
    s = await L();
    check("...double-click the line: a node added there (5)", s.subs[0].n === 5, s.subs[0]);
    await key("Delete");
    s = await L();
    check("...Delete removes the picked node (4 again)", s.subs[0].n === 4, s.subs[0]);
    await ev(() => window.imageEditorInstance.E.vline.pick([[0, 0]])); await ev(() => document.querySelector("#kxOpts #vlToCurve").click()); await p.waitForTimeout(100);
    await ev(() => window.imageEditorInstance.E.vline.pick([[0, 2]])); await ev(() => document.querySelector("#kxOpts #vlBreak").click()); await p.waitForTimeout(150);
    s = await L();
    check("...Break curve at a middle node: two sub-paths", s.subs.length === 2 && s.subs[0].n === 3 && s.subs[1].n === 2, s.subs);
    await ev(() => window.imageEditorInstance.E.vline.pick([[0, 2], [1, 0]])); await ev(() => document.querySelector("#kxOpts #vlJoin").click()); await p.waitForTimeout(150);
    s = await L();
    check("...Join two nodes: one sub-path again", s.subs.length === 1 && s.subs[0].n === 4, s.subs);
    await ev(() => { window.imageEditorInstance.E.vline.pick([[0, 0]]); document.querySelector("#kxOpts #vlExt").click(); }); await p.waitForTimeout(150);
    s = await L();
    check("...Extend curve to close", s.subs[0].closed === true, s.subs[0]);

    /* 6 vector line -> path -> vector line */
    const before = await L();
    await ev(() => window.imageEditorInstance.E.ui.run("vl.topath")); await p.waitForTimeout(150);
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    const asPath = await ev(() => { const S = window.imageEditorInstance.state; const e = S.paths[S.paths.length - 1]; return { n: S.layers.length, paths: S.paths.length, name: e && e.name, vec: e && e.vec && e.vec.line, subs: e && e.path.subs.length }; });
    check("Vector Line: Convert to Path - the layer goes, a saved path named after it remembers its outline pen", asPath.n === before.n - 1 && asPath.name === before.name && asPath.vec && asPath.vec.end === "arrow" && asPath.subs === 1, asPath);
    await ev(() => window.imageEditorInstance.E.ui.run("vl.frompath")); await p.waitForTimeout(150);
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    s = await L();
    const paths2 = await ev(() => window.imageEditorInstance.state.paths.length);
    check("...Make from Path: the same line back (name, width, dashes, arrowhead, nodes) and the path gone", s.n === before.n && s.name === before.name && s.w === 6 && s.line.style === "dash" && s.line.end === "arrow" && JSON.stringify(s.subs) === JSON.stringify(before.subs) && paths2 === asPath.paths - 1, [s, before.subs]);
    await key("Control+z"); await key("Control+z");
    s = await L();
    check("...both undo (the line back as it was before Convert to Path)", s.n === before.n && JSON.stringify(s.subs) === JSON.stringify(before.subs), s);

    /* 7 a plain Pen path -> a vector line in the curve tools' outline */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, Q = window.PCPath; E.pen.once("work", () => { S.work = { subs: [{ closed: false, op: "add", pts: [Q.anchor(50, 380), Q.anchor(200, 330), Q.anchor(350, 380)] }] }; S.ptarget = { k: "work" }; }); });
    await ev(() => document.querySelector("#pcPaths") || window.imageEditorInstance.E.ui.showTab("pcPaths"));
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcPaths")); await p.waitForTimeout(150);
    await p.click("#pnVLineB"); await p.waitForTimeout(150); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(250);
    s = await L();
    check("the Paths panel's 〰: the work path becomes a vector line (3 nodes, the curve tools' outline)", s.type === "shape" && s.line && s.subs[0].n === 3 && !s.subs[0].closed, s);

    /* 8 Convert to Curves (Ctrl+Q) */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, D = E.D; E.pen.once("rect", () => { const R = E.makeLayer("Rect", S.w, S.h, "shape"); R.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "rect", x: 400, y: 40, w: 120, h: 80, fill: "#2050c0" }); D.rasterize(R); E.pen.insertLayer(R); }); E.renderLayersPanel(); });
    await key("Control+q");
    s = await L();
    check("Convert to Curves (Ctrl+Q): a rectangle becomes a vector line - 4 cusp nodes, closed, still filled", s.name === "Rect" && s.kind === "path" && s.line && s.subs[0].n === 4 && s.subs[0].closed && s.fillOn !== false, s);

    /* 9 the other curve tools */
    const cnt = async () => (await L()).n;
    let c0 = await cnt();
    await tool("freehand"); await drag([[60, 150], [90, 170], [130, 150], [170, 175], [210, 150]]);
    s = await L();
    check("Freehand: a drag = a line, smoothed into a few nodes", s.n === c0 + 1 && s.line && s.subs[0].n >= 2 && s.subs[0].n < 12, s.subs);
    c0 = s.n;
    await click(60, 230); await click(220, 230);
    s = await L();
    check("...click, click = a straight line", s.n === c0 + 1 && s.subs[0].n === 2, s.subs);
    c0 = s.n;
    await tool("line2"); await drag([[300, 230], [420, 260]]);
    s = await L();
    check("2-Point Line: a drag = a straight line", s.n === c0 + 1 && s.subs[0].n === 2 && s.subs[0].pts[1][0] === 420, s.subs);
    c0 = s.n;
    await tool("polyline"); await click(60, 300); await click(120, 260); await click(180, 300); await dbl(240, 260);
    s = await L();
    check("Polyline: clicks + a double-click = straight segments (4 nodes, cusps)", s.n === c0 + 1 && s.subs[0].n === 4 && /^c+$/.test(s.subs[0].types), s.subs);
    c0 = s.n;
    await click(330, 60); await click(400, 60); await click(365, 110); await click(330, 60);
    s = await L();
    check("...a click on its first point closes a polyline", s.n === c0 + 1 && s.subs[0].closed && s.subs[0].n === 3, s.subs);
    c0 = s.n;
    await tool("curve3"); await drag([[300, 320], [460, 320]]); await p.mouse.move(...(await T(380, 260)), { steps: 3 }); await click(380, 260);
    s = await L();
    const mid = await ev(() => { const c = window.PCPath.segs(window.imageEditorInstance.E.layer().shape.path.subs[0])[0]; return window.PCPath.cubicAt(c, 0.5).map(Math.round); });
    check("3-Point Curve: drag the chord, click the bend - it passes through that point", s.n === c0 + 1 && s.subs[0].n === 2 && Math.abs(mid[0] - 380) <= 2 && Math.abs(mid[1] - 260) <= 2, [s.subs, mid]);
    c0 = s.n;
    await tool("bspline"); await click(470, 380); await click(500, 300); await click(550, 360); await dbl(580, 280);
    s = await L();
    const sp = await ev(() => window.imageEditorInstance.E.layer().shape.line.spline);
    check("B-Spline: clicks = control points (kept on the line), the curve from the first to the last", s.n === c0 + 1 && sp && sp.pts.length === 4 && !sp.closed && s.subs[0].pts[0][0] === 470 && s.subs[0].pts[s.subs[0].n - 1][0] === 580, [sp, s.subs]);
    const pb = JSON.stringify(s.subs);
    await key("F10"); await drag([[500, 300], [500, 240]]);
    s = await L();
    const sp2 = await ev(() => window.imageEditorInstance.E.layer().shape.line.spline);
    check("...the Shape tool moves a control point - the curve follows", sp2.pts[1][1] === 240 && JSON.stringify(s.subs) !== pb, [sp2, s.subs]);
    c0 = s.n;
    await tool("cpen"); await click(40, 40); await click(140, 40); await key("Enter");
    s = await L();
    await click(90, 40);
    const s2 = await L();
    check("CorelDRAW's Pen: draws like the Bézier; with Auto add-delete a click on the active line adds a node", s.n === c0 + 1 && s.subs[0].n === 2 && s2.subs[0].n === 3, [s.subs, s2.subs]);

    /* 10 the Outline Pen (F12) */
    await key("F12");
    await p.waitForSelector(".kxdlg.pcd #opW"); await p.fill(".kxdlg.pcd #opW", "9"); await p.selectOption(".kxdlg.pcd #opA0", "circle"); await p.selectOption(".kxdlg.pcd #opK", "square");
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(200);
    s = await L();
    check("Outline Pen (F12): width 9, a circle at the start, square caps", s.w === 9 && s.line.start === "circle" && s.line.cap === "square", [s.w, s.line]);

    /* 11 SVG and PSD keep the line */
    const svg = await ev(() => window.imageEditorInstance.E.vline.exportSvg());
    c0 = (await L()).n;
    await ev((t) => window.imageEditorInstance.E.vlineSvg(t, "back.svg"), svg);
    s = await L();
    check("SVG: exported with the outline pen (data-bitgen-vline, the circle as a real outline) and placed back as the same vector line", /data-bitgen-vline/.test(svg) && /<path d="M/.test(svg) && s.n === c0 + 1 && s.line.start === "circle" && s.w === 9 && s.subs[0].n === 3, [svg.slice(0, 200), s]);
    const psd = await ev(async () => {
      const E = window.imageEditorInstance.E, { buf } = await E.psdToBuffer();
      const lines0 = E.S.layers.filter((x) => x.shape && x.shape.line).map((x) => [x.name, x.shape.line.end, x.shape.line.start, x.shape.line.style]);
      await E.psdOpenBuffer(buf, "lines.psd");
      const lines1 = E.S.layers.filter((x) => x.shape && x.shape.line).map((x) => [x.name, x.shape.line.end, x.shape.line.start, x.shape.line.style]);
      return { lines0, lines1 };
    });
    check("PSD: saved and opened again - every vector line comes back with its outline pen (arrowheads, dashes - kept in the file's XMP)", psd.lines0.length >= 8 && JSON.stringify(psd.lines0) === JSON.stringify(psd.lines1), psd);

    /* 12 the Curvature Pen + path align */
    await ev(() => { window.imageEditorInstance.E.S.penMode = "path"; });
    await tool("curvpen"); await click(100, 200); await click(200, 120); await click(300, 200); await key("Enter");
    const cvp = await ev(() => { const S = window.imageEditorInstance.state, w = S.work, Q = window.PCPath, sub = w && w.subs[w.subs.length - 1]; if (!sub) return null; const pts = Q.flatten(sub, 0.2); return { n: sub.pts.length, smooth: sub.pts[1].smooth, near: Math.min(...pts.map(([x, y]) => Math.hypot(x - 200, y - 120))) }; });
    check("Curvature Pen: three clicks = a smooth curve THROUGH the middle point (a smooth anchor there)", cvp && cvp.n === 3 && cvp.smooth && cvp.near < 0.5, cvp);
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, Q = window.PCPath; E.pen.once("comps", () => { S.work = { subs: [Q.fromShape({ kind: "rect", x: 50, y: 50, w: 40, h: 40 }).subs[0], Q.fromShape({ kind: "rect", x: 150, y: 90, w: 40, h: 40 }).subs[0], Q.fromShape({ kind: "rect", x: 330, y: 20, w: 40, h: 40 }).subs[0]] }; S.ptarget = { k: "work" }; }); });
    await tool("pathsel");
    await click(70, 70); await click(170, 110, ["Shift"]); await click(350, 40, ["Shift"]);
    await ev(() => document.querySelector('#kxOpts [data-palign="top"]').click()); await p.waitForTimeout(150);
    let tops = await ev(() => window.imageEditorInstance.state.work.subs.map((q) => Math.round(window.PCPath.bbox({ subs: [q] }).y)));
    await ev(() => document.querySelector('#kxOpts [data-palign="dh"]').click()); await p.waitForTimeout(150);
    const cx = await ev(() => window.imageEditorInstance.state.work.subs.map((q) => { const b = window.PCPath.bbox({ subs: [q] }); return Math.round(b.x + b.w / 2); }));
    check("Path Selection: Align top edges, then Distribute horizontal centres (evenly spaced)", tops.every((t) => t === 20) && cx[1] - cx[0] === cx[2] - cx[1], [tops, cx]);

    /* 13 Rubber Band option */
    await tool("pen");
    const rb = await ev(() => !!document.querySelector("#kxOpts #pnRubber"));
    check("the Pen's options have Rubber Band", rb);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
