#!/usr/bin/env node
/* bitGen Studio — 2.570.0 units: 🖊 PEN TABLET in the image editor - the pressure curve, the lightest touch / full
 * pressure window, the levels a pen reports, tilt, the eraser end and side button, every brush's pressure, the pen brushes
 * (ext/imageeditdock/pctablet.js pure, brushes.js, brushdyn.js tilt; the wiring in imageedit.js / pcdraw.js / ext.json).
 * Tim: "can we add pen tools like xp pen with levels of pressure for freehand drawing?" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = require(path.join(ROOT, "ext", "imageeditdock", "pctablet.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "brushes.js"));
const BD = require(path.join(ROOT, "ext", "imageeditdock", "brushdyn.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-3);

/* 1 the curve */
check("curveAt: linear is the identity; the ends are kept; values stay in 0..1", near(T.curveAt(T.CURVES.linear, 0.37), 0.37) && T.curveAt(T.CURVES.soft, 0) === 0 && near(T.curveAt(T.CURVES.soft, 1), 1) && T.curveAt(T.CURVES.scurve, 2) <= 1);
const mono = (pts) => { let last = -1; for (let i = 0; i <= 100; i++) { const v = T.curveAt(pts, i / 100); if (v < last - 1e-9) return false; last = v; } return true; };
check("...soft gives more at a light touch, firm less (soft > linear > firm at 25 %); every preset rises smoothly (never back down)",
  T.curveAt(T.CURVES.soft, 0.25) > 0.35 && T.curveAt(T.CURVES.xsoft, 0.25) > T.curveAt(T.CURVES.soft, 0.25) && T.curveAt(T.CURVES.firm, 0.25) < 0.2 && T.curveAt(T.CURVES.xfirm, 0.25) < T.curveAt(T.CURVES.firm, 0.25)
  && Object.values(T.CURVES).every(mono) && T.curveAt(T.CURVES.scurve, 0.2) < 0.2 && T.curveAt(T.CURVES.scurve, 0.8) > 0.8);
check("cleanCurve: sorted, inside 0..1, both ends there, points too close merged, at most 12",
  JSON.stringify(T.cleanCurve([[0.5, 2], [0.2, 0.1], [0.201, 0.3]])) === "[[0,0],[0.2,0.1],[0.5,1],[1,1]]" && T.cleanCurve(Array.from({ length: 30 }, (_, i) => [i / 30, i / 30])).length === 12);
check("mapPressure: below the lightest touch = the thinnest, from full pressure on = 100 %, the curve in between; no contact = 0",
  T.mapPressure(0.05, { lo: 10, hi: 100 }) === 0 && T.mapPressure(0.85, { lo: 0, hi: 80 }) === 1 && near(T.mapPressure(0.55, { lo: 10, hi: 100 }), 0.5) && T.mapPressure(0, {}) === 0
  && T.mapPressure(0.25, { preset: "soft" }) > T.mapPressure(0.25, { preset: "linear" }) && near(T.mapPressure(0.3, { curve: [[0, 0], [1, 1]] }), 0.3));

/* 2 the pen */
const steps = (n) => Array.from({ length: 60 }, (_, i) => (200 + i * 3) / n).concat([401 / n, 500 / n, 501 / n]);   // (a stroke rarely sends two neighbouring levels - a few do)
check("levelsOf: the finest step between the values the pen sent -> its levels (8192 / 4096 / 2048 …); too few = 0",
  T.levelsOf(steps(8192)) === 8192 && T.levelsOf(steps(2048)) === 2048 && T.levelsOf(steps(4096).map((v) => Math.fround(v))) === 4096 && T.levelsOf([0.1, 0.2]) === 0);
const t1 = T.tiltOf({ tiltX: 30, tiltY: 0 }), t2 = T.tiltOf({ tiltX: 0, tiltY: -60 }), t3 = T.tiltOf({ tiltX: 0, tiltY: 0, altitudeAngle: Math.PI / 2, azimuthAngle: 0 });
check("tiltOf: the way the pen leans (angle) and how far (upright 0 .. 60° = 1); altitude / azimuth when the browser gives them",
  near(t1.angle, 0) && near(t1.amount, 0.5) && near(t2.angle, -Math.PI / 2) && near(t2.amount, 1) && t3.amount === 0 && near(T.tiltOf({ altitudeAngle: Math.PI / 4, azimuthAngle: 1 }).amount, 0.75) && near(T.tiltOf({ altitudeAngle: Math.PI / 4, azimuthAngle: 1 }).angle, 1));
check("isEraserEnd: a pen with buttons bit 32 or button 5 (Windows Ink's eraser); isBarrel: the side button; a mouse is neither",
  T.isEraserEnd({ pointerType: "pen", buttons: 32 }) && T.isEraserEnd({ pointerType: "pen", button: 5 }) && !T.isEraserEnd({ pointerType: "pen", buttons: 1, button: 0 }) && !T.isEraserEnd({ pointerType: "mouse", buttons: 32 })
  && T.isBarrel({ pointerType: "pen", button: 2 }) && !T.isBarrel({ pointerType: "mouse", button: 2 }));
check("mouseSpeedPressure: a slow mouse is heavy, a fast one light (15 % at least)", T.mouseSpeedPressure(0) === 1 && T.mouseSpeedPressure(2) < 0.5 && T.mouseSpeedPressure(100) === 0.15);

/* 3 every brush */
const marker = B.byId("marker"), basic = B.byId("basic");
const m1 = T.presetFor(marker, { size: true, minSize: 20 }), m2 = T.presetFor(marker, { opacity: true }), m3 = T.presetFor(basic, { size: true });
check("presetFor: Pressure -> size / opacity added to a brush that does not use it (its own smallest size), a brush that does keeps its own; off = the same preset",
  m1.pressure.size && !m1.pressure.flow && m1.minSize === 0.2 && m2.pressure.flow && !m2.pressure.size && m3 === basic && T.presetFor(marker, {}) === marker && marker.pressure.size === false);
check("...so the brush engine scales it: the Marker at a light touch is thinner than at full pressure", B.atPressure(m1, 40, 1, 0.1).size < B.atPressure(m1, 40, 1, 1).size && B.atPressure(marker, 40, 1, 0.1).size === 40);

/* 4 the pen brushes + tilt */
const pens = B.PRESETS.filter((p) => p.pen);
check("7 pen brushes (G-pen, Mapping pen, Brush pen, Real pencil, Fineliner, Technical pen, Calligraphy): inking pens taper to a point, the Fineliner is even, the pencil keeps more of its width",
  pens.map((p) => p.id).join() === "gpen,mapping,brushpen,realpencil,fineliner,techpen,callig" && B.byId("gpen").minSize < 0.1 && B.atPressure(B.byId("gpen"), 10, 1, 0.05).size < 2
  && B.atPressure(B.byId("fineliner"), 3, 1, 0.1).size === 3 && B.byId("realpencil").pressure.flow && B.byId("realpencil").minSize >= 0.5);
const callig = B.byId("callig");
const flat = BD.dynAt(callig.dyn, () => 0.5, 1, 0, 1, null), turned = BD.dynAt(callig.dyn, () => 0.5, 1, 0, 1, { angle: Math.PI / 2, amount: 0.5 });
const rd2 = BD.dynAt({ shape: Object.assign({}, callig.dyn.shape, { roundControl: "tilt", angleControl: "off" }) }, () => 0.5, 1, 0, 1, { angle: 0, amount: 1 });
check("Calligraphy: a flat 45° nib (active dynamics); Angle control: Tilt turns it with the pen, nothing without a pen; Roundness control: Tilt flattens a leaning pen",
  BD.active(callig) && near(flat.angle, Math.PI / 4) && near(flat.round, 0.22) && near(turned.angle, Math.PI / 4 + Math.PI / 2) && near(rd2.round, 0.25));

/* 5 the wiring */
const IE = rd("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")), BDS = rd("ext", "imageeditdock", "brushdyn.js"), PD = rd("ext", "imageeditdock", "pcdraw.js"), PT = rd("ext", "imageeditdock", "pctablet.js");
check("every brush-like tool asks the tablet (pressureOf), every stroke's preset gets its \"every brush\" pressure; the eraser end's button 5 draws; the sketch tool's pen too",
  /const pressureOf = \(e\) => \(E\.tablet \? E\.tablet\.pressure\(e\)/.test(IE) && /if \(E\.tablet && E\.tablet\.preset\) preset = E\.tablet\.preset\(preset\);/.test(IE)
  && /!\(e\.pointerType === "pen" && e\.button === 5 && E\.tablet\)/.test(IE) && (PD.match(/E\.tablet \? E\.tablet\.pressure\(e\) : e\.pressure/g) || []).length === 2);
check("installed after the 🖌 Brush tab (its 🖊 Pen tab goes next to it), loaded before the editor; brushdyn asks PCTablet.tilt() for each dab; Angle / Roundness control offer Pen tilt",
  IE.indexOf("win.PCTablet.install(E)") > IE.indexOf("win.IEBrushDyn.install(E)") && EXT.scripts.indexOf("pctablet.js") >= 0 && EXT.scripts.indexOf("pctablet.js") < EXT.scripts.indexOf("imageedit.js")
  && /root\.PCTablet && root\.PCTablet\.tilt \? root\.PCTablet\.tilt\(\) : null/.test(BDS) && /\["tilt", "Pen tilt"\]/.test(BDS) && /"dyn\.shape\.roundControl"/.test(BDS));
check("the Pen tab: a test pad, the levels, the curve with its presets, the lightest touch / full pressure, every brush, the pen's ends and button, Windows Ink named when the pressure is stuck",
  /id="ptPad"/.test(PT) && /levels/.test(PT) && /id="ptCurve"/.test(PT) && /id="ptLo"/.test(PT) && /id="ptHi"/.test(PT) && /id="ptSize"/.test(PT) && /id="ptOpa"/.test(PT) && /id="ptErase"/.test(PT) && /id="ptBarrel"/.test(PT)
  && /turn on Windows Ink in the pen driver/.test(PT) && /stage\.addEventListener\("pointerdown", \(e\) => \{\n      if \(!S\.w \|\| e\.pointerType !== "pen"\) return;/.test(PT));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
