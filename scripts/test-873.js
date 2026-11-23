#!/usr/bin/env node
/* bitGen Studio — 2.873.0 units: the character sheet's 3D mannequins (static/mannequin3d.js, static/mannequins/,
 * routes/charSheetH3.js /mannequin, ext/videodock/h3sheet.js 🧍 + the OPTIONAL Dress it).
 * Tim (verbatim): "can you create the mannequin character sheet using a 3d mannequin, for male and female, try to be as
 * close to anatomically correct as possible for our character sheet creator" + "do number 1 but make dress it optional,
 * dressing often leads to unwanted artifacts and the clothes described won't fit properly" */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const M = require("../static/mannequin3d.js");
const near = (a, b, t) => Math.abs(a - b) <= t;
const m = M.measure("male"), f = M.measure("female");
// the canon (head units)
check("male: 8 heads, the head one head tall, the crotch at the half", m.heads === 8 && m.headHeight === 1 && m.crotch === 4, m);
check("female: 7.5 heads, the crotch at the half", f.heads === 7.5 && f.headHeight === 1 && f.crotch === 3.75, f);
check("male shoulders about two heads wide (bideltoid 2-2.3), the waist narrower than the shoulders and the hips", m.shoulders >= 2 && m.shoulders <= 2.3 && m.waist < m.hips && m.waist < m.shoulders, m);
check("female: shoulders narrower than the male's, the hips about as wide as the shoulders, a narrow waist",
  f.shoulders < m.shoulders && f.hips / f.shoulders > m.hips / m.shoulders && f.hips / f.shoulders > 0.85 && f.waist / f.hips < m.waist / m.hips, f);
for (const [n, x] of [["male", m], ["female", f]]) {
  const P = M.PROPS[n];
  check(`${n}: the elbow at the waist, the wrist at the crotch, the fingertips at mid-thigh`,
    near(x.elbow, P.marks.navel, 0.3) && near(x.wrist, x.crotch, 0.3) && x.armTip < x.crotch - 0.5 && x.armTip > x.knee + 0.6, x);
  check(`${n}: the knee about a quarter of the height up`, near(x.knee / x.heads, 0.255, 0.03), x.knee / x.heads);
  const j = M.joints(n);
  check(`${n}: the right side mirrors the left`, j.elbowR[0] === -j.elbowL[0] && j.kneeR[1] === j.kneeL[1] && j.wristR[2] === j.wristL[2]);
}
check("real heights (2.928.0: the display mannequins): 182 cm (male), 171 cm (female)", M.PROPS.male.height_m === 1.82 && M.PROPS.female.height_m === 1.71);
check("views: front, side, back, three-quarter, the head from the front and the side", ["front", "side", "back", "threequarter", "head", "headside"].every((v) => M.VIEWS.includes(v)));
// the pictures shipped
const png = (p) => { const b = fs.readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.slice(1, 4).toString() }; };
for (const n of ["male", "female"]) {
  const fr = png(path.join(ROOT, "static/mannequins", n + "_front.png")), sh = png(path.join(ROOT, "static/mannequins", n + "_sheet.png"));
  check(`static/mannequins/${n}: front 832 x 1216 (the start picture), side, back, the sheet (2.928.0: 2600 x 2400, the display mannequin's)`,
    fr.sig === "PNG" && fr.w === 832 && fr.h === 1216 && sh.w >= 2400 && sh.h >= 1350
    && ["side", "back"].every((v) => png(path.join(ROOT, "static/mannequins", n + "_" + v + ".png")).w === 832));
}
// the route + the panel
const R = src("routes/charSheetH3.js"), HS = src("ext/videodock/h3sheet.js");
check("POST /api/charsheet/h3/mannequin: male / female only, the front copied into the project's Images as mannequin-<sex>.png",
  /app\.post\("\/api\/charsheet\/h3\/mannequin"/.test(R) && /M\.SEXES\.includes\(sex\)/.test(R) && /"mannequin-" \+ sex \+ "\.png"/.test(R) && /\/passets\/images\//.test(R));
const win = { localStorage: { getItem: () => null, setItem: () => {} } };
const ctx = { window: win, document: { getElementById: () => null }, localStorage: win.localStorage, console };
vm.createContext(ctx); vm.runInContext(HS, ctx);
const D = win.H3SheetDesign;
// 2.934.0 (Tim: "the mannequin sheet is the reference sheet of poses and camera angles and another image must be loaded or
// generated"): the mannequin is no longer the start picture and Dress it is gone - scripts/test-934.js pins the new way
check("h3sheet.js: 🧍 Mannequin… (Male 8 heads / Female 7.5 heads) asks the route for it (2.934.0: its sheet = the reference, not the start picture)",
  /id="h3sMannequin"/.test(HS) && /Male \(8 heads\)/.test(HS) && /Female \(7\.5 heads\)/.test(HS) && /fetch\("\/api\/charsheet\/h3\/mannequin"/.test(HS)
  && !/H3CharSheetPic\.open\(x\.j\.url/.test(HS) && typeof D.loadMannequin === "function");
check("...2.934.0: Dress it is gone (the mannequin is never the character)", !/id="h3sDress"/.test(HS) && !D.dressBody && !/dressBody/.test(HS));
check("the figure is bitGen's own: scripts/make_mannequins.js renders it with the app's three.js (2.928.0: the display mannequin, static/mannequinGloss.js)", /three-m3d\.min\.js/.test(src("scripts/make_mannequins.js")) && /H3MannequinGloss\.render/.test(src("scripts/make_mannequins.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
