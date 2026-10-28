#!/usr/bin/env node
/* bitGen Studio — 2.608.0 (pure): 5 MORE WARP PRESETS, A WARP GRID ON TEXT / SHAPES, SHAPES FILLED WITH TEXT.
 * Tim: "can we fill shapes with text, please add 5 more preset warps and an interactive warp grid for text and shapes"
 *   static/warpstyles.js   16 styles; the eleven old ones move exactly as before; the new five; extent
 *   static/textfill.js     spanAt / spansAt / intervalAt / wrapIn / fitSize / polyBox
 *   pclivewarp.js          rest / isFlat / toAbs / toRel / wbox;  pcmesh.latPreset;  tlwarp.presetMesh + clean keeps ps
 *   wiring                 pcdoc (live warp first, shape text fill, textBox), pcwarp (live text / shape), pctext (envelope),
 *                          pctextfill, ext.json, index.html, timeline canvas / tlparent / tlshape / tlwarp / tltextfill */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

const W = require(path.join(R, "static", "warpstyles.js"));
check("16 warp styles: the 11 there were + Shell Lower, Shell Upper, Fisheye, Twist, Wedge (Photoshop's order)",
  W.STYLES.length === 16 && W.STYLES.map((s) => s[0]).join() === "arc,arcLower,arcUpper,arch,bulge,shellLower,shellUpper,flag,wave,fish,rise,fisheye,inflate,squeeze,twist,wedge" && W.NEW.join() === "shellLower,shellUpper,fisheye,twist,wedge");
// the old column formulas (2.397.0) - unchanged
const old = (style, bend, u) => { const b = Math.max(-100, Math.min(100, +bend || 0)) / 100, c = 1 - u * u, s = Math.sin(u * Math.PI);
  switch (style) { case "arc": return [-b * c * 0.5, -b * c * 0.5]; case "arcLower": return [0, b * c * 0.5]; case "arcUpper": return [-b * c * 0.5, 0]; case "arch": return [-b * c * 0.55, -b * c * 0.3];
    case "bulge": return [-b * c * 0.4, b * c * 0.4]; case "inflate": { const k = Math.cos(u * Math.PI / 2); return [-b * k * 0.3, b * k * 0.3]; } case "flag": return [b * s * 0.3, b * s * 0.3];
    case "wave": return [b * s * 0.3, b * Math.sin(u * Math.PI - 0.9) * 0.3]; case "fish": return [-b * c * 0.4, b * c * 0.4 * (u < 0 ? 1 : 1 - u)]; case "rise": return [-b * u * 0.5, -b * u * 0.5];
    case "squeeze": return [b * c * 0.3, -b * c * 0.3]; default: return [0, 0]; } };
check("the eleven old styles move exactly as before (column by column)",
  ["arc", "arcLower", "arcUpper", "arch", "bulge", "flag", "wave", "fish", "rise", "inflate", "squeeze"].every((s) => W.isColumn(s) && [-1, -0.5, 0, 0.3, 1].every((u) => [30, -70].every((b) => { const a = W.column(s, b, u), o = old(s, b, u); return near(a[0], o[0]) && near(a[1], o[1]); }))));
const p0 = (s, u, v) => W.point(s, 100, u, v, 2);
check("Shell Lower: the bottom bows down in the middle, the top's ends pinch in; Shell Upper: the top bows up, the bottom pinches",
  p0("shellLower", 0, 1)[1] > 0.5 && near(p0("shellLower", 0, 0)[1], 0) && p0("shellLower", 1, 0)[0] < -0.1 && p0("shellLower", -1, 0)[0] > 0.1 && near(p0("shellLower", 1, 1)[0], 0)
  && p0("shellUpper", 0, 0)[1] < -0.5 && p0("shellUpper", 1, 1)[0] < -0.1 && near(p0("shellUpper", 1, 0)[0], 0));
check("Fisheye: the middle swells - top up, bottom down, sideways out from the centre; the ends stay; the centre stays",
  p0("fisheye", 0, 0)[1] < -0.2 && p0("fisheye", 0, 1)[1] > 0.2 && p0("fisheye", 0.5, 0.5)[0] > 0.02 && p0("fisheye", -0.5, 0.5)[0] < -0.02 && near(p0("fisheye", 1, 0.5)[0], 0) && near(p0("fisheye", 0, 0.5)[1], 0) && !W.isColumn("fisheye"));
const tw = (u, v) => { const d = W.point("twist", 100, u, v, 1); return [(u + 1) / 2 + d[0], v + d[1]]; };
const ang = (q) => Math.atan2(q[1] - 0.5, q[0] - 0.5), dist = (q) => Math.hypot(q[0] - 0.5, q[1] - 0.5);
check("Twist: a point near the middle turns more than one near the edge, both stay as far from the centre (a turn), the centre stays",
  Math.abs(ang(tw(0.2, 0.5)) - ang([0.6, 0.5])) > Math.abs(ang(tw(0.8, 0.5)) - ang([0.9, 0.5])) + 0.2 && near(dist(tw(0.2, 0.5)), 0.1, 1e-9) && near(tw(0, 0.5)[0], 0.5, 1e-9) && !W.isColumn("twist"));
check("Wedge: the left end stays, the right end narrows (a taper) - drawn column by column", W.isColumn("wedge") && near(W.column("wedge", 60, -1)[0], 0) && W.column("wedge", 60, 1)[0] > 0.2 && W.column("wedge", 60, 1)[1] < -0.2);
const ex = W.extent("shellLower", 80, 4), ex2 = W.extent("twist", 80, 1);
check("extent: how far each reaches past the box (Shell Lower down, Twist all round)", ex.down > 0.4 && ex.up < 0.01 && ex2.up > 0.03 && ex2.left > 0.03 && ex2.right > 0.03 && ex2.down > 0.03, { ex, ex2 });

const F = require(path.join(R, "static", "textfill.js"));
const circ = []; for (let i = 0; i < 128; i++) { const a = i / 128 * 2 * Math.PI; circ.push([200 + 150 * Math.cos(a), 200 + 150 * Math.sin(a)]); }
check("spanAt: the outline's top and bottom under x (null outside); spansAt: the stretches of a line inside",
  near(F.spanAt(circ, 200)[0], 50, 0.5) && near(F.spanAt(circ, 200)[1], 350, 0.5) && F.spanAt(circ, 30) === null && F.spansAt(circ, 200).length === 1 && near(F.spansAt(circ, 200)[0][0], 50, 0.5));
const ring = circ.concat([circ[0]]).concat(circ.map(([x, y]) => [200 + (x - 200) * 0.5, 200 + (y - 200) * 0.5]).concat([[275, 200]]).reverse());
check("…a ring (a hole): two stretches through the middle; intervalAt the widest band fully inside", F.spansAt(ring, 205).length === 2 && F.intervalAt(circ, 190, 210) && F.intervalAt(circ, 190, 210)[1] - F.intervalAt(circ, 190, 210)[0] > 295, F.spansAt(ring, 205));
const m10 = (s) => s.length * 10, words = "the quick brown fox jumps over the lazy dog and keeps running round the circle";
const wr = F.wrapIn(words, m10, circ, 20, "center");
check("wrapIn: the words wrap inside the circle - every word placed, each line inside the circle at its height, the middle lines longest",
  !wr.overflow && wr.lines.map((l) => l.text).join(" ") === words && wr.lines.every((l) => { const sp = F.intervalAt(circ, l.y, l.y + 20); return sp && l.x >= sp[0] - 0.5 && l.x + l.w <= sp[1] + 0.5; })
  && Math.max(...wr.lines.map((l) => l.w)) > wr.lines[0].w, wr.lines);
check("…too many words for the shape = overflow", F.wrapIn(words.repeat(20), m10, circ, 20, "center").overflow === true);
const fit = F.fitSize((s) => !F.wrapIn(words, (x) => x.length * s * 0.55, circ, s * 1.2, "center").overflow, 4, 300);
check("fitSize: the biggest size that still fits (one more px does not)", fit > 10 && !F.wrapIn(words, (x) => x.length * fit * 0.55, circ, fit * 1.2, "center").overflow && F.wrapIn(words, (x) => x.length * (fit + 1) * 0.55, circ, (fit + 1) * 1.2, "center").overflow, fit);

const LW = require(path.join(R, "ext", "imageeditdock", "pclivewarp.js"));
const r1 = LW.rest(null), r3 = LW.rest({ c: 3, r: 3, us: [0, 1 / 3, 2 / 3, 1], vs: [0, 1 / 3, 2 / 3, 1] });
check("live warp grid: the flat lattice (4 x 4 for one patch, 10 x 10 for 3 x 3), isFlat, toAbs / toRel round trip, the warped box",
  r1.length === 16 && near(r1[5][0], 1 / 3) && r3.length === 100 && LW.isFlat({ P: r1, G: null }) && !LW.isFlat({ P: r1.map((p, k) => (k === 0 ? [-0.2, 0] : p)), G: null })
  && JSON.stringify(LW.toRel(LW.toAbs(r1, { x: 10, y: 20, w: 300, h: 100 }), { x: 10, y: 20, w: 300, h: 100 })) === JSON.stringify(r1.map((p) => p.map((v) => Math.round(v * 1e6) / 1e6)))
  && JSON.stringify(LW.wbox({ P: r1.map((p, k) => (k === 0 ? [-0.1, -0.5] : p)) }, { x: 100, y: 100, w: 200, h: 100 })) === JSON.stringify({ x: 80, y: 50, w: 221, h: 151 }));
check("…only text and shape layers take it; on() wants a lattice", LW.can({ type: "text", text: {} }) && LW.can({ type: "shape", shape: {} }) && !LW.can({ type: "pixel" }) && LW.on({ type: "shape", shape: { mesh: { P: r1 } } }) && !LW.on({ type: "text", text: {} }));
global.H3Warps = W;
const X = require(path.join(R, "ext", "imageeditdock", "pcmesh.js"));
const lp = X.latPreset(X.rectQuad(0, 0, 300, 100), "twist", 70, 3, 3);
check("pcmesh: 17 Transform ▸ Warp choices (Custom + 16); latPreset Twist on a 3 x 3 lattice (corners where the style sends them); patchPreset Fisheye moves points sideways",
  X.WARP_STYLES.length === 17 && lp.P.length === 100 && lp.G.c === 3 && near(X.latCorners(lp.P, lp.G)[0][0], 0, 1e-6) && near(X.latCorners(lp.P, lp.G)[2][1], 100, 1e-6)
  && X.patchPreset(X.rectQuad(0, 0, 300, 100), "fisheye", 80).some((q, k) => Math.abs(q[0] - X.patchFromQuad(X.rectQuad(0, 0, 300, 100))[k][0]) > 1));
const TW = require(path.join(R, "ext", "timelinedock", "tlwarp.js"));
const pm = TW.presetMesh(W, "arc", 50, 8, 4, 3);
check("timeline: a preset as the ⌗ mesh (9 x 5 points; Arc lifts the top middle a quarter), clean() keeps which preset", pm.length === 45 && near(pm[4][1], -0.25, 1e-5) && near(pm[0][1], 0, 1e-9) && TW.clean({ cols: 8, rows: 4, mesh: pm, ps: "arc", pb: 50 }).ps === "arc" && !TW.clean({ ps: "<x>" }).ps);
const TF = require(path.join(R, "ext", "imageeditdock", "pctextfill.js"));
check("pctextfill: the repeat fill's defaults", TF.TFILL_DEFAULT.on && TF.TFILL_DEFAULT.leading > 1 && TF.TFILL_DEFAULT.stagger === true);

const doc = read("ext/imageeditdock/pcdoc.js"), wp = read("ext/imageeditdock/pcwarp.js"), ptx = read("ext/imageeditdock/pctext.js");
check("wiring - image editor: pcdoc warps a live layer first + fills a shape with text + the warped box; pcwarp's live text / shape grid (warp only, one undo step); pctext's envelope; ⌗ Warp Grid buttons",
  /PCLiveWarp\.on\(L\) && root\.PCLiveWarp\.draw\(L, \(\) => paint\(L, g, c\)\)/.test(doc) && /PCTextFill\.fillShape\(g, s, drawShape0\)/.test(doc) && /t\.mesh && t\._wbox/.test(doc)
  && /if \(LW && LW\.can\(L\)\)/.test(wp) && /label: "warp grid"/.test(wp) && /X\.latPreset\(Q\.quad, Q\.style, Q\.bend, 3, 3\)/.test(wp) && /function drawEnvelope\(g, t\)/.test(ptx) && /id="ptWarpGrid"/.test(ptx)
  && /id="ptSTextFill"/.test(read("ext/imageeditdock/pctextfill.js")) && /PCTextFill\.install\(E\)/.test(read("ext/imageeditdock/imageedit.js")));
const ej = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, tj = JSON.parse(read("ext/timelinedock/ext.json")).scripts, ix = read("static/index.html");
check("ext.json / index.html: pctextfill + pclivewarp after pcfxshape; tltextfill last; warpstyles.js + textfill.js in the page",
  ej.indexOf("pctextfill.js") === ej.indexOf("pcfxshape.js") + 1 && ej.indexOf("pclivewarp.js") === ej.indexOf("pctextfill.js") + 1 && tj[tj.length - 1] === "tltextfill.js"
  && /<script src="\/static\/warpstyles\.js"><\/script>/.test(ix) && /<script src="\/static\/textfill\.js"><\/script>/.test(ix));
check("wiring - timeline: canvas draws a text in a shape (TlTextFill.picture), the bake takes it (and its shape), tlshape's 🅰 Text fill, tlwarp's ⌇ Preset",
  /TlTextFill\.picture\(c,/.test(read("ext/timelinedock/canvas.js")) && /TlTextFill && TlTextFill\.live\(c\)/.test(read("ext/timelinedock/tlparent.js")) && /inshape: ins\.shape/.test(read("ext/timelinedock/tlparent.js"))
  && /H3TextFill\.repeatAt\(g, s\.tfill/.test(read("ext/timelinedock/tlshape.js")) && /id="tlpWpPs"/.test(read("ext/timelinedock/tlwarp.js")));
check("font previews (Tim: \"make the font in the fonts dropdown the same font as the name\"): fontlist.js writes each option in its font and the list in the picked one; selsearch.js draws a row in its option's font",
  /o\.style\.fontFamily = familyCss\(o\.value\)/.test(read("static/fontlist.js")) && /sel\.style\.fontFamily = sel\.value \? familyCss/.test(read("static/fontlist.js")) && /font-family:\$\{esc\(x\.font\)\}/.test(read("static/selsearch.js")));
check("server.js untouched by this release", !/warpstyles|textfill|livewarp/i.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
