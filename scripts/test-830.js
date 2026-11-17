#!/usr/bin/env node
/* bitGen Studio — 2.830.0 units. Tim: "can you add a transparency gradient of images,shapes, text etc can be transparent along the
 * gradient, coreldraw has this feature. so it will start at x% opacity and finish at y%. add a slider to the interactive line that
 * controls the gradient to change the position of the fades etc , do this for both gradient types and drop shadow. when using
 * freehand select tool or pen etc don't close the selection unless the last position is 5px from the start position".
 *   ext/imageeditdock/pctransp.js (ease / clean / toPx / fromPx / project / opacityAt / boxOf), pcdoc midEase / midStops (a
 *   gradient fill's fade point), pcstyles stopsOf (the Gradient tool's `t` stops + the fade point), pcpickmodes rubberOf (the
 *   lasso's closing line only within 5 px; an open lasso's side to the pointer), and the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const X = (f) => require(path.join(ROOT, "ext/imageeditdock", f));
const T = X("pctransp.js"), D = X("pcdoc.js"), PS = X("pcstyles.js"), M = X("pcpickmodes.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

check("ease: the fade is half way at the fade point (0.5 -> 0.5, 0.25 -> 0.25, 0.8 -> 0.8), the ends stay the ends",
  near(T.ease(0.5, 0.5), 0.5) && near(T.ease(0.25, 0.25), 0.5) && near(T.ease(0.8, 0.8), 0.5) && T.ease(0, 0.3) === 0 && T.ease(1, 0.3) === 1 && near(T.ease(0.3, 0.5), 0.3));
const c0 = T.clean({}), c1 = T.clean({ type: "spiral", a0: 2, a1: -1, mid: 1.5 });
check("clean: solid at the start, see-through at the end, across the middle, half way in the middle; out-of-range values clamped", c0.type === "linear" && c0.a0 === 1 && c0.a1 === 0 && c0.mid === 0.5 && c0.u0 === 0 && c0.u1 === 1 && c1.type === "linear" && c1.a0 === 1 && c1.a1 === 0 && c1.mid === 0.98, [c0, c1]);
const box = { x: 100, y: 50, w: 200, h: 100 }, f = T.fromPx(120, 60, 280, 140, box), l = T.toPx(f, box);
check("the line kept as fractions of the layer's box - back to the same picture points (it moves / grows with the layer)", near(l.x0, 120) && near(l.y0, 60) && near(l.x1, 280) && near(l.y1, 140) && near(f.u0, 0.1) && near(f.v1, 0.9), [f, l]);
const tp = Object.assign({ a0: 0.8, a1: 0.2, mid: 0.5 }, T.fromPx(100, 100, 300, 100, box));
check("opacityAt: 80 % at the start, 20 % at the end, 50 % half way; before / after the line = the end values",
  near(T.opacityAt(tp, box, 100, 77), 0.8) && near(T.opacityAt(tp, box, 300, 10), 0.2) && near(T.opacityAt(tp, box, 200, 140), 0.5) && near(T.opacityAt(tp, box, 20, 0), 0.8) && near(T.opacityAt(tp, box, 400, 0), 0.2));
const tq = Object.assign({}, tp, { mid: 0.25 });
check("…the fade slider at 25 %: half way (50 %) a quarter along, further on nearer the end", near(T.opacityAt(tq, box, 150, 0), 0.5) && T.opacityAt(tq, box, 200, 0) < 0.4);
const tr = Object.assign({}, tp, { type: "radial" });
check("…radial: by the distance from the start (the middle) - the same opacity all round", near(T.opacityAt(tr, box, 200, 100), 0.5) && near(T.opacityAt(tr, box, 100, 200), 0.5) && near(T.opacityAt(tr, box, 100, 100), 0.8));
check("project: along a line (clamped 0..1)", near(T.project("linear", { x0: 0, y0: 0, x1: 10, y1: 0 }, 5, 99), 0.5) && T.project("linear", { x0: 0, y0: 0, x1: 10, y1: 0 }, -5, 0) === 0 && T.project("linear", { x0: 0, y0: 0, x1: 10, y1: 0 }, 50, 0) === 1);
const W = 40, H = 20, data = new Uint8ClampedArray(W * H * 4); for (let y = 4; y < 12; y++) for (let x = 10; x < 30; x++) data[(y * W + x) * 4 + 3] = 255;
const bx = T.boxOf(data, W, H), b0 = T.boxOf(new Uint8ClampedArray(W * H * 4), W, H);
check("boxOf: what a layer draws (to 2 px), the whole picture when it draws nothing", bx.x === 10 && bx.y === 4 && Math.abs(bx.w - 20) <= 2 && Math.abs(bx.h - 8) <= 2 && b0.w === W && b0.h === H, [bx, b0]);

const ms = D.midStops([[0, "rgba(0,0,0,1)"], [1, "#ffffff"]], 0.25, 4);
check("pcdoc midStops: a gradient fill's fade point - half way (grey 128) a quarter along, the ends kept", ms.length === 5 && ms[1][0] === 0.25 && /rgba\(128,128,128,1\)/.test(ms[1][1]) && /rgba\(0,0,0,1\)/.test(ms[0][1]) && /rgba\(255,255,255,1\)/.test(ms[4][1]), ms);
check("…midEase = the transparency's ease", near(D.midEase(0.25, 0.25), T.ease(0.25, 0.25)) && near(D.midEase(0.7, 0.5), 0.7));
const so = PS.stopsOf ? PS.stopsOf({ stops: [{ t: 0, c: "#000000" }, { t: 1, c: "#ffffff" }] }) : null;
check("pcstyles: a text's gradient from the Gradient tool (stops with `t`) keeps its two ends (it was read as both at 0 - one colour)", !PS.stopsOf || (so[0].at === 0 && so[1].at === 1), so);
const sm = PS.stopsOf ? PS.stopsOf({ stops: [{ t: 0, c: "#000000" }, { t: 1, c: "#ffffff" }], mid: 0.25 }) : null;
check("…with a fade point: 25 stops, grey half way a quarter along", !PS.stopsOf || (sm.length === 25 && sm[6].at === 0.25 && sm[6].c === "#808080"), sm && sm[6]);

const lasso = [[0, 0], [30, 0], [30, 30], [3, 3]], far = [[0, 0], [30, 0], [30, 30], [20, 20]];
check("the lasso's line back to its start shows only within 5 px of the start (it closes only there)", JSON.stringify(M.rubberOf("lasso", lasso, null, true, { closeR: 5 })) === "[3,3,0,0]" && M.rubberOf("lasso", far, null, true, { closeR: 5 }) === null);
check("…an OPEN lasso (let go elsewhere) shows a straight side from its end to the pointer; the old call is unchanged", JSON.stringify(M.rubberOf("lasso", far, [50, 50], false, { open: true })) === "[20,20,50,50]" && M.rubberOf("lasso", far, [50, 50], false, { open: false }) === null && JSON.stringify(M.rubberOf("lasso", far, null, true)) === "[20,20,0,0]");

// the wiring
const ie = read("ext/imageeditdock/imageedit.js"), doc = read("ext/imageeditdock/pcdoc.js"), ui = read("ext/imageeditdock/pcui.js"), ej = JSON.parse(read("ext/imageeditdock/ext.json"));
check("pcdoc: the layer's pixels times the transparency (masked), kept in undo (DEEP)", /PCTransp\.alphaFor\(env, L, content, W, H\)/.test(doc) && /const DEEP = \["control", "locks", "styles", "transp"/.test(doc));
check("the Transparency tool in the Gradient group (Shift+G), its icon; installed after the Drop Shadow tool; loaded (ext.json)", /\["transparency", "Transparency Tool/.test(ui) && /transparency: '<rect/.test(ui) && /PCTransp\.install\(E\)/.test(ie) && ej.scripts.indexOf("pctransp.js") === ej.scripts.indexOf("pcshadowtool.js") + 1);
check("duplicate / smart object keep the transparency", /\["styles", "transp", "adj"/.test(ie) && /"styles", "transp", "vmask"\]/.test(read("ext/imageeditdock/pcsmart.js")));
check("the Gradient tool's Fade option + a vector shape / text fill keep it (mid)", /rangeOpt\("ptGMid", "Fade"/.test(read("ext/imageeditdock/pctools.js")) && (read("ext/imageeditdock/pctools.js").match(/mid: S\.gradMid \/ 100/g) || []).length === 2);
check("the Drop Shadow line's opacity slider (pcshadowtool along / slider drag)", /function along\(h, x, y\)/.test(read("ext/imageeditdock/pcshadowtool.js")) && /drag = \{ Ly: cur, slider: true, h \}/.test(read("ext/imageeditdock/pcshadowtool.js")));
check("ONE close distance - 5 px on screen - for the lasso, polygonal lasso, magnetic lasso, pen, freeform pen and every curve tool",
  /closeR: \(\) => 5 \/ \(S\.zoom \|\| 1\)/.test(ie) && /S\.lassoOpen = \{ mode: d\.mode \}/.test(ie) && /case "poly": if \(S\.pts\.length >= 3 && E\.nearStart/.test(ie)
  && (read("ext/imageeditdock/pcvline.js").match(/CLOSE\(\)/g) || []).length >= 6 && (read("ext/imageeditdock/pcpen.js").match(/<= CLOSE\(\)/g) || []).length === 2 && /E\.closeR \? E\.closeR\(\)/.test(read("ext/imageeditdock/pcrefine.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
