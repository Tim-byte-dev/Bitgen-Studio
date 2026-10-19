#!/usr/bin/env node
/* bitGen Studio — 2.496.0 units: MERGE PATHS + FREEHAND SHAPE PATHS (ext/timelinedock/tlshape.js), TEXT ON A PATH
 * (tltextanim.js), ROVING KEYFRAMES (static/keyframes.js rove, tlgraph.js Rove, canvas.js keysChanged).
 * Tim (verbatim): "Merge Paths, freehand shape paths, text on a path, roving keyframes, and the rest of the After Effects
 * gap list" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const S = require(path.join(ROOT, "ext", "timelinedock", "tlshape.js"));
const TA = require(path.join(ROOT, "ext", "timelinedock", "tltextanim.js"));
const K = require(path.join(ROOT, "static", "keyframes.js"));
const area = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const near = (a, b, e) => Math.abs(a - b) <= e;

/* ---- merge paths */
const M = {}; for (const m of S.MODES) M[m] = S.merge([{ pts: sq(0, 0, 100, 100) }, { pts: sq(50, 50, 100, 100), mode: m }]).map((L) => Math.abs(area(L)));
check("merge: two 100 x 100 squares overlapping a quarter - add 17500, subtract 7500, intersect 2500, exclude 2 x 7500 (within 1 %)",
  M.add.length === 1 && near(M.add[0], 17500, 175) && M.subtract.length === 1 && near(M.subtract[0], 7500, 75) && M.intersect.length === 1 && near(M.intersect[0], 2500, 25) && M.exclude.length === 2 && M.exclude.every((a) => near(a, 7500, 75)), M);
const circ = (cx, cy, r) => Array.from({ length: 64 }, (_, i) => [cx + r * Math.cos(i / 64 * Math.PI * 2), cy + r * Math.sin(i / 64 * Math.PI * 2)]);
const hole = S.merge([{ pts: sq(0, 0, 200, 200) }, { pts: circ(100, 100, 50), mode: "subtract" }]);
check("merge: a circle subtracted inside a square = the square + a HOLE (a loop the other way round), few points (thinned)", hole.length === 2 && area(hole[0]) * area(hole[1]) < 0
  && near(Math.max(...hole.map((L) => Math.abs(area(L)))), 40000, 400) && near(Math.min(...hole.map((L) => Math.abs(area(L)))), 7854, 120) && hole.every((L) => L.length < 120), hole.map((L) => [Math.round(area(L)), L.length]));
const g = S.rasterize([sq(0, 0, 10, 10)], 0, 0, 20, 20, 1);
check("rasterize: a 10 x 10 square on a 20 x 20 grid = 100 cells; contours: one loop round it", g.reduce((a, b) => a + b, 0) === 100 && S.contours(g, 20, 20, 0, 0, 1).length === 1);
const shp = (o) => Object.assign({}, S.DEFAULTS, o);
let O = S.outlines(shp({ kind: "rect", w: 200, h: 100, more: [{ kind: "ellipse", w: 60, h: 60, x: 0, y: 0, mode: "subtract" }] }), 0);
check("a shape layer with TWO paths (⧉ ＋ Path), no Merge Paths: two groups, each filled on its own", O.groups.length === 2 && O.groups.every((G) => G.closed) && O.lines.length === 2);
O = S.outlines(shp({ kind: "rect", w: 200, h: 100, merge: true, more: [{ kind: "ellipse", w: 60, h: 60, x: 0, y: 0, mode: "subtract" }] }), 0);
check("⊕ Merge Paths on: ONE group - the rectangle with an elliptic hole (2 loops, filled even-odd)", O.groups.length === 1 && O.groups[0].lines.length === 2 && O.closed);
const O2 = S.outlines(shp({ kind: "rect", w: 200, h: 100, merge: true, offset: true, oamt: 10, more: [{ kind: "ellipse", w: 60, h: 60, mode: "subtract" }] }), 0);
const ar = (G) => G.lines.map((L) => Math.abs(area(L))).sort((a, b) => b - a);
check("Offset Paths after Merge Paths: the outline grows 10 px AND the hole shrinks 10 px (a hole goes the other way)", (() => { const a0 = ar(O.groups[0]), a1 = ar(O2.groups[0]); return a1[0] > a0[0] + 2500 && a1[1] < a0[1] - 1000; })(), [ar(O.groups[0]), ar(O2.groups[0])]);
check("pathOf: a sub-path placed (x, y, turned)", (() => { const p = S.pathOf({ kind: "rect", w: 20, h: 10, x: 100, y: 50, rot: 90 }); const xs = p.pts.map((q) => Math.round(q[0])), ys = p.pts.map((q) => Math.round(q[1])); return Math.min(...xs) === 95 && Math.max(...xs) === 105 && Math.min(...ys) === 40 && Math.max(...ys) === 60 && p.mode === "add"; })());

/* ---- freehand */
const ring = Array.from({ length: 80 }, (_, i) => [300 + 60 * Math.cos(i / 79 * Math.PI * 2), 200 + 40 * Math.sin(i / 79 * Math.PI * 2)]);
const f1 = S.freehand(ring, 12), f2 = S.freehand(ring.slice(0, 40), 12);
check("freehand: a drawn loop that ends where it began = a CLOSED path round its middle (thinned + smoothed, ~120 x 80)", f1.closed && f1.path.length > 8 && f1.path.length < 80 && near(f1.w, 120, 4) && near(f1.h, 80, 4) && near(f1.cx, 300, 3) && near(f1.cy, 200, 3), { c: f1.closed, n: f1.path.length, w: f1.w, h: f1.h });
check("freehand: half of it = an OPEN line", !f2.closed && f2.path.length >= 3);
const fp = S.outlines(shp({ kind: "path", path: f2.path, pw: f2.w, ph: f2.h, w: f2.w * 2, h: f2.h, closed: false, strokeW: 4, fillOp: 0 }), 0);
check("a freehand OPEN path: an open line (no fill), W x 2 stretches it", !fp.closed && fp.groups.length === 1 && !fp.groups[0].closed && near(Math.max(...fp.lines[0].map((q) => q[0])) - Math.min(...fp.lines[0].map((q) => q[0])), f2.w * 2, 4));
const tr = S.outlines(shp({ kind: "path", path: [[-50, 0], [50, 0]], pw: 100, ph: 1, w: 100, h: 1, closed: false, trim: true, tstart: 25, tend: 75 }), 0).lines[0];
check("Trim Paths on an open line: 25 % - 75 % = the middle half (no wrap)", near(tr[0][0], -25, 1e-6) && near(tr[tr.length - 1][0], 25, 1e-6) && tr.every((q) => q[0] >= -25 - 1e-6 && q[0] <= 25 + 1e-6), tr);
const zz = S.outlines(shp({ kind: "path", path: [[-50, 0], [50, 0]], pw: 100, ph: 1, w: 100, h: 1, closed: false, zig: true, zsize: 5, zridges: 4 }), 0).lines[0];
check("Zig Zag on an open line keeps its ends (not joined round)", near(zz[0][0], -50, 1e-6) && near(zz[zz.length - 1][0], 50, 1e-6));

/* ---- text on a path */
const arc = TA.pathPoly({ path: "arc", r: 200, span: 180 }, 0), cir = TA.pathPoly({ path: "circle", r: 100 }, 0), wav = TA.pathPoly({ path: "wave", amp: 30, wl: 200 }, 500);
check("pathPoly: an arc (open, round its middle, 180° = a half circle 400 wide), a circle (closed), a wave (open, at least the text's width)", !arc.closed && near(Math.max(...arc.pts.map((q) => q[0])) - Math.min(...arc.pts.map((q) => q[0])), 400, 0.5)
  && cir.closed && !wav.closed && Math.max(...wav.pts.map((q) => q[0])) - Math.min(...wav.pts.map((q) => q[0])) >= 500 * 1.15 - 1);
const pa = TA.placeAt(cir, 0), pq = TA.placeAt(cir, Math.PI * 100 / 2), plen = pa.len;
check("placeAt: the circle starts at the top running clockwise (turn 0), a quarter round = the right side (turn 90°); a closed path wraps", near(plen, 2 * Math.PI * 100, 0.5) && near(pa.y, Math.min(...cir.pts.map((q) => q[1])), 0.5) && near(Math.abs(pa.ang), 0, 0.03)
  && near(pq.x, 100, 0.6) && near(pq.ang, Math.PI / 2, 0.03) && near(TA.placeAt(cir, plen + 10).x, TA.placeAt(cir, 10).x, 1e-6));
const pe = TA.placeAt(arc, -50);
check("placeAt: an open path runs on straight past its ends", near(pe.x, arc.pts[0][0] + Math.cos(pe.ang) * -50, 1e-6));
check("pathPoly flip: the other way round (inside a circle)", (() => { const f = TA.pathPoly({ path: "circle", r: 100, flip: true }, 0); return near(Math.abs(TA.placeAt(f, 0).ang), Math.PI, 0.05); })());
const TT = read("ext", "timelinedock", "tltextanim.js");
check("tltextanim: 〰 On a path (arc / circle / wave / a shape layer's outline; radius, span, height, wavelength, start % keyable tp_off / tp_r, other way); live() bakes it", /id="tlpTpOn"/.test(TT) && /\["off", "r"\]\.forEach/.test(TT) && /onPath\(c\)\)\); \};   \/\/ 2\.496\.0/.test(TT) && /function onPathPicture\(/.test(TT) && /TlShape\.outlines\(TlShape\.at\(hit\.c, tau\), tau\)/.test(TT));

/* ---- roving */
const kf = [{ at: 0, x: 0, y: 0 }, { at: 0.2, x: 100, y: 0, rove: true, scale: 2 }, { at: 1.5, x: 100, y: 300, rove: true, ease: "in" }, { at: 4, x: 400, y: 300 }];
const rv = K.rove(kf), pos = rv.filter((k) => k.x != null);
check("rove: roving keys timed by the path's length (100 + 300 + 300 px over 4 s: 0.571 s, 2.286 s) - an even speed; their tweens straight", near(pos[1].at, 0.571, 1e-3) && near(pos[2].at, 2.286, 1e-3) && !pos[2].ease && !pos[0].ease, pos);
check("rove: what else a roving key sets (its scale) stays at its old time; the input untouched", rv.some((k) => k.scale === 2 && k.at === 0.2 && k.x == null) && kf[1].at === 0.2 && kf[1].scale === 2);
check("rove: no roving key = the same array; the first / last never rove", K.rove([{ at: 0, x: 0, y: 0 }]).length === 1 && (() => { const a = [{ at: 0, x: 0, y: 0 }, { at: 1, x: 1, y: 1 }]; return K.rove(a) === a; })() && !K.rove([{ at: 0, x: 0, y: 0, rove: true }, { at: 1, x: 10, y: 0 }])[0].rove);
const cur = K.rove([{ at: 0, x: 0, y: 0, to: [0, -100] }, { at: 1, x: 100, y: 0, rove: true, ti: [0, -100] }, { at: 2, x: 200, y: 0 }]).filter((k) => k.x != null);
check("rove: a CURVED stretch counts longer than a straight one (the Bézier's length)", cur[1].at > 1.2, cur.map((k) => k.at));
const CV = read("ext", "timelinedock", "canvas.js"), TG = read("ext", "timelinedock", "tlgraph.js"), TS = read("ext", "timelinedock", "tlshape.js");
check("wiring: keysChanged re-times roving keys; the Graph Editor's Rove button (position keys, not the first / last)", /if \(c && c\.kf && KF\.rove\) c\.kf = KF\.rove\(c\.kf\);/.test(CV) && /id="tgRove"/.test(TG) && /function roveSel\(\)/.test(TG));
check("wiring: the ✎ Freehand tool (Shift+Q; Alt = into the picked shape layer), ⧉ ＋ Path / ⊕ Merge Paths in the Properties, each group filled even-odd", /id: "freehand", icon: "✎"/.test(TS) && /key: "shift\+q"/.test(TS) && /id="tlpShPAdd"/.test(TS) && /data-shb="merge"/.test(TS) && /g\.fill\("evenodd"\)/.test(TS));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
