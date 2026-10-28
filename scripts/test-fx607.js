#!/usr/bin/env node
/* bitGen Studio — 2.607.0 (pure): text presets kept through shapes, every OS font in the font lists.
 * Tim: "is it possible to keep the text presets when operations when shape tools like 3d , warp etc are used. Use all the
 * fonts that are installed in the os. add text presets to timeline and other text tools as well"
 *   static/fontlist.js merge        the common fonts first, the computer's after: sorted, no repeats (any case), no
 *                                   hidden "." / "@" families
 *   ext/imageeditdock/pcfxshape.js  shaped(t) - which texts need it (a preset AND a shape / 3D / vertical / caps ...),
 *                                   keyOf - the drawing's key ignores the preset id, the turn and the skew
 *   static/textfx.js                the page API names the shaped drawing needs (renderFace, faceLive, inkHeight ...)
 *   wiring                          pcdoc.js asks PCFxShape first; ext.json loads it; index.html loads fontlist.js;
 *                                   tltextanim.js no longer hides the animators of a preset text; m3d face texture */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");

const F = require(path.join(R, "static", "fontlist.js"));
const m = F.merge(["", "Arial", "Impact", "arial"], ["impact", "Zed Sans", ".SF NS Text", "@MS Gothic", "Bahnschrift", "Arial", "Bahnschrift", "  ", "abc"]);
check("fontlist.merge: the common list kept in order (one of each), the computer's below - sorted, no repeats in any case, no hidden families",
  JSON.stringify(m.common) === JSON.stringify(["", "Arial", "Impact"]) && JSON.stringify(m.more) === JSON.stringify(["abc", "Bahnschrift", "Zed Sans"]), m);
check("fontlist: watches every font list (image editor Type tool / Properties / Character, timeline text / 3D text / captions, karaoke)",
  ["#ptFont", "#ppTFont", "#pcyFont", "#tlpFont", "#tlp3Font", "#tcapFont", "#ks_font"].every((s) => F.SELECTORS.split(",").includes(s)), F.SELECTORS);

global.PCText = require(path.join(R, "ext", "imageeditdock", "pctext.js"));
const X = require(path.join(R, "ext", "imageeditdock", "pcfxshape.js"));
const base = { str: "Hi", x: 0, y: 0, size: 40, font: "Arial", color: "#fff" };
check("pcfxshape.shaped: a preset + warp / 3D / circle / vertical / caps = yes; a straight preset text or a shape with no preset = no",
  X.shaped(Object.assign({ fx: "style:gold", warp: { style: "arc", bend: 40 } }, base)) && X.shaped(Object.assign({ fx: "a", extrude: { on: true, depth: 10 } }, base))
  && X.shaped(Object.assign({ fx: "a", path: { kind: "circle", r: 90 } }, base)) && X.shaped(Object.assign({ fx: "a", vertical: true }, base)) && X.shaped(Object.assign({ fx: "a", caps: true }, base))
  && !X.shaped(Object.assign({ fx: "a" }, base)) && !X.shaped(Object.assign({ warp: { style: "arc", bend: 40 } }, base)) && !X.shaped(Object.assign({ fx: "a", warp: { style: "arc", bend: 0 } }, base)));
const k1 = X.keyOf(Object.assign({ fx: "a", rot: 30, xm: [1, 0, 0.2, 1], warp: { style: "arc", bend: 40 } }, base), 100, 80);
const k2 = X.keyOf(Object.assign({ fx: "b", warp: { style: "arc", bend: 40 } }, base), 100, 80);
const k3 = X.keyOf(Object.assign({ fx: "a", warp: { style: "arc", bend: 41 } }, base), 100, 80);
check("pcfxshape.keyOf: the turn / skew / preset id are not part of the drawing (pcdoc turns it after); the warp is", k1 === k2 && k1 !== k3, { k1, k3 });
check("pcfxshape.sideColor: a side colour set wins", X.sideColor({ extrude: { color: "#123456" } }, null) === "#123456");

const tfx = read("static/textfx.js");
check("textfx.js: one stack for the straight word and a shaped one (stack / renderFace / faceLive / faceFull / inkHeight / avgColor / setSharp)",
  /function stack\(P, sil, W, H, m, inkW, inkH, hRef, dilate\)/.test(tfx) && /function renderFace\(/.test(tfx) && /renderFace, faceLive, faceFull, inkOf, inkHeight, avgColor, setSharp/.test(tfx));
const tf = require(path.join(R, "static", "textfx.js"));
check("textfx.js still loads in Node (the pure parts)", typeof tf.normalize === "function" && typeof tf.scaleStyles === "function");
check("pcdoc.js: a shaped text with a preset is drawn by PCFxShape first", /PCFxShape\.shaped\(L\.text\) && root\.PCFxShape\.draw\(g, L\.text/.test(read("ext/imageeditdock/pcdoc.js")));
const ej = JSON.parse(read("ext/imageeditdock/ext.json")).scripts;
check("imageeditdock ext.json loads pcfxshape.js after pctext / pctype / pcruns", ej.indexOf("pcfxshape.js") > ej.indexOf("pcruns.js") && ej.indexOf("pcruns.js") > ej.indexOf("pctext.js"), ej.slice(15, 26));
check("index.html loads static/fontlist.js", /<script src="\/static\/fontlist\.js"><\/script>/.test(read("static/index.html")));
const ta = read("ext/timelinedock/tltextanim.js");
check("tltextanim.js: a preset text gets animators / a path (no early return on fx) and its picture goes through the preset",
  !/!Pn \|\| c\.text\.fx\) return/.test(ta) && /function withPreset\(c, t, fx, face, sig, size\)/.test(ta));
check("tlparent.js: a bake draws text presets SHARP", /X\.setSharp\(true\)/.test(read("ext/timelinedock/tlparent.js")));
const m3 = read("static/m3d.js");
check("m3d.js: 3D text with a preset - the face is the preset's picture, the sides its colour", /function fxFace\(m\)/.test(m3) && /MeshBasicMaterial\(\{ map: t \}\)/.test(m3) && /fx \? fxMats\(/.test(m3));
check("timeline new text: textDefaults takes the last preset (TlTextFx.newFx), Properties with nothing selected offer it",
  /TlTextFx\.newFx\(\)/.test(read("ext/timelinedock/canvas.js")) && /TlTextFx\.newTextRow\(P\)/.test(read("ext/timelinedock/canvas.js")) && /function newTextRow\(P\)/.test(read("ext/timelinedock/textfx.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
