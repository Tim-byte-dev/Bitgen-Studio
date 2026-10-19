#!/usr/bin/env node
/* bitGen Studio — 2.498.0 units: BÉZIER MASKS (ext/timelinedock/tlmask.js; canvas.js, tlparent.js, timelinedock.js,
 * lib/tlKeys.js maskKeys, routes/index.js, worker.py alphamerge).
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const M = require(path.join(ROOT, "ext", "timelinedock", "tlmask.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e);
const area = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const sq = [M.pt(0.25, 0.25), M.pt(0.75, 0.25), M.pt(0.75, 0.75), M.pt(0.25, 0.75)];
check("pt: a corner point (its handles on it), kept to 5 places", JSON.stringify(M.pt(0.123456789, 0.5)) === JSON.stringify({ x: 0.12346, y: 0.5, ix: 0.12346, iy: 0.5, ox: 0.12346, oy: 0.5 }));
check("segs + flatten: a square mask on a 200 x 100 picture = 100 x 50 px (corners: straight pieces)", near(area(M.flatten(sq, 200, 100, 8)), 5000, 1e-6) && M.segs(sq, 200, 100).length === 4 && M.segs(sq, 200, 100, false).length === 3);
// a circle-ish: 4 smooth points with handles (k = 0.5523)
const k = 0.5523 * 0.25, ci = [{ x: 0.5, y: 0.25, ix: 0.5 - k, iy: 0.25, ox: 0.5 + k, oy: 0.25 }, { x: 0.75, y: 0.5, ix: 0.75, iy: 0.5 - k, ox: 0.75, oy: 0.5 + k }, { x: 0.5, y: 0.75, ix: 0.5 + k, iy: 0.75, ox: 0.5 - k, oy: 0.75 }, { x: 0.25, y: 0.5, ix: 0.25, iy: 0.5 + k, ox: 0.25, oy: 0.5 - k }];
check("Bézier points (handles): four smooth points make a circle (area π r², within 0.5 %)", near(area(M.flatten(ci, 400, 400, 32)), Math.PI * 100 * 100, Math.PI * 100 * 100 * 0.005), area(M.flatten(ci, 400, 400, 32)));
const big = sq.map((p) => M.pt((p.x - 0.5) * 1.5 + 0.5, (p.y - 0.5) * 1.5 + 0.5));
const m = { pts: sq, keys: [{ at: 0, pts: sq }, { at: 2, pts: big }] };
check("pathAt: the keyed path glides between its keys (smooth: half way at 1 s), holds before / after; no keys = its points",
  near(M.pathAt(m, 1)[0].x, (0.25 + 0.125) / 2, 1e-9) && M.pathAt(m, -1) === sq && M.pathAt(m, 5) === big && M.pathAt({ pts: sq }, 1) === sq && M.animated(m) && !M.animated({ pts: sq }));
check("lerpPts: point by point (the handles too); different counts = the first", near(M.lerpPts(sq, big, 0.5)[2].ox, (0.75 + 0.875) / 2) && M.lerpPts(sq, big.slice(0, 3), 0.5) === sq);
const b = { cx: 300, cy: 200, w: 200, h: 100, rot: 90 };
const u = M.toLocal(b, 300, 300), back = M.toPic(b, u[0], u[1]);
check("toLocal / toPic: a picture point <-> the layer's own 0..1 (its place, size and turn), there and back", near(u[0], 1, 1e-9) && near(u[1], 0.5, 1e-9) && near(back[0], 300, 1e-9) && near(back[1], 300, 1e-9) && near(M.toLocal({ cx: 0, cy: 0, w: 10, h: 10, rot: 0 }, 0, 0)[0], 0.5));
check("live: only a mask that is on, closed and has 3 points works", M.live({ masks: [{ pts: sq }] }) && !M.live({ masks: [{ pts: sq, on: false }] }) && !M.live({ masks: [{ pts: sq, closed: false }] }) && !M.live({ masks: [{ pts: sq.slice(0, 2) }] }) && !M.live({}));
check("sig: changes with the settings and (for a keyed mask) with time", M.sig({ masks: [{ pts: sq, feather: 1 }] }, 0) !== M.sig({ masks: [{ pts: sq, feather: 2 }] }, 0) && M.sig({ masks: [m] }, 0) !== M.sig({ masks: [m] }, 1) && M.sig({ masks: [{ pts: sq }] }, 0) === M.sig({ masks: [{ pts: sq }] }, 1));
check("the modes: add, subtract, intersect, difference", M.MODES.join() === "add,subtract,intersect,difference");
const TK = require(path.join(ROOT, "lib", "tlKeys.js"));
check("lib/tlKeys.maskKeys: nothing without a mask video (or one not on disk)", JSON.stringify(TK.maskKeys({})) === "{}" && JSON.stringify(TK.maskKeys({ mbake: "tlb_nope_m.webm" })) === "{}" && JSON.stringify(TK.maskKeys(null)) === "{}");
// wiring
const MK = read("ext", "timelinedock", "tlmask.js"), CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js"), RT = read("routes", "index.js"), W = read("worker.py");
check("the canvas draws masked pictures (both its paths), never the GPU path while a mask is on", (CV.match(/if \(c\.masks && window\.TlMask && TlMask\.apply\) pic = TlMask\.apply\(pic, c, t - \(c\.start \|\| 0\)\);/g) || []).length === 2 && /\(Ly\.clips \|\| \[\]\)\.some\(function \(c\) \{ return (?:\(c\.masks && c\.masks\.length\)(?: \|\| c\.\w+)*|c\.masks && c\.masks\.length); \}\)/.test(CV));
check("tlmask: the ✒ Mask Pen (Shift+M; click / drag / close on the first point / Enter / Esc; drag points + handles, Alt = one handle; keyed masks get a key), ✒ Masks in the Properties (on, mode, feather, expansion, opacity, invert, ◇, ✕)",
  /id: "maskpen", icon: "✒"/.test(MK) && /key: "shift\+m"/.test(MK) && /function keyHere\(m, c, P\)/.test(MK) && /data-mkmode=/.test(MK) && /data-mkinv=/.test(MK) && /data-mkkey=/.test(MK) && /\["feather", "feather px"\], \["expand", "expansion px"\], \["op", "opacity %"\]/.test(MK));
check("the compile: masked pictures baked (TlParent), a video layer's masks -> a grey mask video (TlParent.bakeAll chained), sent as mbake -> maskv", /masked\(x\.c\)\) && !x\.c\.nul/.test(TP) && /masks: p\.masks \|\| null/.test(TP) && /TlParent\.bakeAll = function \(\) \{ return Promise\.resolve\(prevBake\.apply\(this, arguments\)\)\.then\(bakeMasks\); \};/.test(MK)
  && /mbake: c\.mbake && c\.masks && c\.masks\.length \? c\.mbake : undefined/.test(TD) && /\.\.\.tlKeys\.maskKeys\(c\),/.test(RT));
check("worker: the mask videos are inputs AFTER every other one; the clip gets alphamerge (scale2ref) before its transitions + transform", /mask_in, nxt_in = \{\}, 1 \+ len\(overlays\) \+ len\(imgs\) \+ len\(clips\)/.test(W) && /\[mq\{i\}\]\[mb\{i\}\]scale2ref\[mr\{i\}\]\[mc\{i\}\]/.test(W) && /\[mc\{i\}\]\[mr\{i\}\]alphamerge\[mm\{i\}\]/.test(W)
  && W.indexOf("mask_in, nxt_in") > W.indexOf('args += a_extra + ["-i", c["path"]]') && /sin, sout = _shape\(parts, src_v,/.test(W));
check("a text on a path reaches the compile baked (the 2.496.0 gap: its bake was not sent without animators)", /\(c\.text\.onpath && c\.text\.onpath\.on !== false\)/.test(TD));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlmask.js after tlexpr.js", EXT.indexOf("tlmask.js") === EXT.indexOf("tlexpr.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
