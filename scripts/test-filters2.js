#!/usr/bin/env node
/* bitGen Studio — 2.480.0: MORE OF IMAGE ▸ ADJUSTMENTS + APPLY IMAGE (ext/imageeditdock/filters2.js) - the image
 * editor's gap, round A. Tim (verbatim): "close the photoshop gap."
 * Shadows / Highlights, HDR Toning, Selective Color, Replace Color, Match Color, Color Lookup, Apply Image: the maths
 * on small pictures, Lab both ways, the colour ranges, where they go in the menus / adjustment layers, the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
const FX = require(path.join(X, "filters.js")), D = require(path.join(X, "pcdoc.js")), F2 = require(path.join(X, "filters2.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const px = (list) => Uint8ClampedArray.from(list.flatMap((c) => (c.length === 3 ? [...c, 255] : c)));
const at = (a, i) => Array.from(a.slice(i * 4, i * 4 + 4));

F2.register(FX, D); F2.register(FX, D);
const adj = FX.FILTERS.filter((f) => f.group === "Adjustments").map((f) => f.id);
const idx = (id) => adj.indexOf(id);
check("register (twice = once): in the Adjustments menu where Photoshop has them - Color Lookup after Channel Mixer, Selective Color after Gradient Map, then Shadows / Highlights + HDR Toning, Match / Replace Color after Desaturate",
  idx("colorlookup") === idx("channelmixer") + 1 && idx("selectivecolor") === idx("gradientmap") + 1 && idx("shadowshighlights") === idx("selectivecolor") + 1 && idx("hdrtoning") === idx("shadowshighlights") + 1
  && idx("matchcolor") === idx("desaturate") + 1 && idx("replacecolor") === idx("matchcolor") + 1 && adj.filter((x) => x === "colorlookup").length === 1, adj);
const kinds = D.ADJ_KINDS.map((k) => k[0]);
check("adjustment layers: + Color Lookup (after Channel Mixer), + Selective Color (after Gradient Map); Apply Image is not an adjustment", kinds.indexOf("colorlookup") === kinds.indexOf("channelmixer") + 1 && kinds.indexOf("selectivecolor") === kinds.indexOf("gradientmap") + 1 && FX.byId("applyimage").group === "Image" && !adj.includes("applyimage"), kinds);
// Lab
let worst = 0; for (let k = 0; k < 600; k++) { const c = [(k * 37) % 256, (k * 91) % 256, (k * 53) % 256], b = F2.lab2rgb(...F2.rgb2lab(...c)); worst = Math.max(worst, ...b.map((v, i) => Math.abs(v - c[i]))); }
const W = F2.rgb2lab(255, 255, 255), K = F2.rgb2lab(0, 0, 0), Rr = F2.rgb2lab(255, 0, 0);
check("Lab: white 100 / 0 / 0, black 0, red ~ 53 / 80 / 67; there and back within half a level", Math.abs(W[0] - 100) < 0.01 && Math.abs(W[1]) < 0.01 && Math.abs(K[0]) < 0.01 && Math.abs(Rr[0] - 53.2) < 0.5 && Math.abs(Rr[1] - 80.1) < 0.6 && worst < 0.5, { worst, Rr });
// Selective Color
const w1 = F2.selWeights(255, 0, 0), w2 = F2.selWeights(255, 255, 0), w3 = F2.selWeights(128, 128, 128), w4 = F2.selWeights(250, 250, 250), w5 = F2.selWeights(5, 5, 5), w6 = F2.selWeights(0, 255, 255);
check("the colour ranges: red is all Reds, yellow all Yellows, cyan all Cyans, mid grey all Neutrals, near white Whites, near black Blacks", w1.reds === 1 && !w1.yellows && w2.yellows === 1 && !w2.reds && w6.cyans === 1 && w3.neutrals === 1 && !w3.reds && w4.whites > 0.9 && w5.blacks > 0.9, { w1, w2, w6 });
const sc = F2.emptySel(); sc.ranges.reds.c = 100; sc.mode = "absolute";
const src = px([[255, 0, 0], [0, 0, 255], [128, 128, 128]]);
let o = FX.run("selectivecolor", src, 3, 1, { sel: sc });
check("Selective Color absolute: Reds + 100 % cyan takes the red out of red; blue and grey untouched", at(o, 0)[0] === 0 && JSON.stringify(at(o, 1)) === "[0,0,255,255]" && JSON.stringify(at(o, 2)) === "[128,128,128,255]", [at(o, 0), at(o, 1)]);
sc.mode = "relative"; o = FX.run("selectivecolor", src, 3, 1, { sel: sc });
const sc2 = F2.emptySel(); sc2.ranges.reds.c = -100; const o2 = FX.run("selectivecolor", px([[200, 60, 60]]), 1, 1, { sel: sc2 });
check("Selective Color relative: in proportion to the ink there (pure red has no cyan ink - no change); - cyan on a dull red brightens its red", at(o, 0)[0] === 255 && at(o2, 0)[0] > 200, [at(o, 0), at(o2, 0)]);
const sc3 = F2.emptySel(); sc3.ranges.neutrals.k = 50; sc3.mode = "absolute"; const o3 = FX.run("selectivecolor", px([[128, 128, 128], [255, 0, 0]]), 2, 1, { sel: sc3 });
check("Selective Color: Neutrals + black darkens the grey, not the pure red", at(o3, 0)[0] < 128 && at(o3, 1)[0] === 255, [at(o3, 0), at(o3, 1)]);
// Shadows / Highlights
const grad = []; for (let i = 0; i < 64; i++) grad.push([i * 4, i * 4, i * 4]);
const sh = FX.run("shadowshighlights", px(grad), 64, 1, { shadows: 60, sradius: 0, highlights: 0 });
const hl = FX.run("shadowshighlights", px(grad), 64, 1, { shadows: 0, highlights: 60, hradius: 0 });
check("Shadows / Highlights: the shadows lifted, the highlights left; highlights pulled down, the shadows left", at(sh, 8)[0] > 32 && at(sh, 63)[0] === 252 && at(hl, 60)[0] < 240 && at(hl, 4)[0] === 16, [at(sh, 8), at(sh, 63), at(hl, 60), at(hl, 4)]);
// HDR Toning
const scene = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) scene.push(x < 8 ? [20 + y, 30, 40, 200] : [230, 220 - y, 210, 255]);
const hd = FX.run("hdrtoning", px(scene), 16, 16, { radius: 4, strength: 80 }), hd2 = FX.run("hdrtoning", px(scene), 16, 16, { radius: 4, strength: 0, detail: 0, exposure: 1, saturation: 0 });
check("HDR Toning: the dark half lifted and the bright half held (local), alpha kept; +1 stop brighter", at(hd, 0)[0] > 20 && at(hd, 15)[0] <= 255 && at(hd, 0)[3] === 200 && at(hd2, 0)[2] > 40, [at(hd, 0), at(hd, 15), at(hd2, 0)]);
// Replace Color
const rc = FX.run("replacecolor", px([[255, 0, 0], [0, 0, 255], [240, 20, 20]]), 3, 1, { color: "#ff0000", fuzziness: 40, hue: 120 });
check("Replace Color: red (and near red) turned green by +120° hue; blue untouched", at(rc, 0)[1] > 200 && at(rc, 0)[0] < 60 && JSON.stringify(at(rc, 1)) === "[0,0,255,255]" && at(rc, 2)[1] > at(rc, 2)[0], [at(rc, 0), at(rc, 2)]);
check("Replace Color's colour has the eyedropper (a click on the picture picks it)", FX.byId("replacecolor").params[0].eyedrop === true);
// Match Color
const warm = []; for (let i = 0; i < 64; i++) warm.push([200 + (i % 5), 120 + (i % 7), 60]);
const cool = []; for (let i = 0; i < 64; i++) cool.push([40, 90 + (i % 9), 200 - (i % 6)]);
const stats = F2.labStats(px(cool));
const mc = FX.run("matchcolor", px(warm), 64, 1, { source: { id: "x", stats } }), ms = F2.labStats(mc);
check("Match Color: the picture takes the source's colour (its Lab means move to the source's)", Math.abs(ms.mean[2] - stats.mean[2]) < 6 && Math.abs(ms.mean[1] - stats.mean[1]) < 6 && at(mc, 0)[2] > at(mc, 0)[0], { got: ms.mean, want: stats.mean });
const mf = FX.run("matchcolor", px(warm), 64, 1, { source: { id: "x", stats }, fade: 100 }), m0 = FX.run("matchcolor", px(warm), 64, 1, {});
check("Match Color: Fade 100 % = as it was; no source = as it was", at(mf, 3).join() === px(warm).slice(12, 16).join() && at(m0, 3).join() === px(warm).slice(12, 16).join());
// Color Lookup
const C = require(path.join(ROOT, "static", "clipfx.js"));
const look = "teal & orange";
const cl = FX.run("colorlookup", px([[120, 100, 80]]), 1, 1, { lut: "look:" + look });
const N = 5; let cube = `TITLE "inv"\nLUT_3D_SIZE ${N}\n`; for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) cube += `${1 - r / (N - 1)} ${1 - g / (N - 1)} ${1 - b / (N - 1)}\n`;
F2.LUTS.set("lut:inv.cube", C.parseCube(cube));
const ci = FX.run("colorlookup", px([[255, 0, 64]]), 1, 1, { lut: "lut:inv.cube" }), ch = FX.run("colorlookup", px([[255, 0, 64]]), 1, 1, { lut: "lut:inv.cube", opacity: 50 }), cn = FX.run("colorlookup", px([[9, 9, 9]]), 1, 1, { lut: "lut:missing.cube" });
check("Color Lookup: a look from the timeline's list changes the colour; a .cube (an inverting one) inverts; Amount 50 % mixes; an unloaded LUT leaves it", at(cl, 0).join() !== "120,100,80,255" && Math.abs(at(ci, 0)[0] - 0) <= 1 && Math.abs(at(ci, 0)[1] - 255) <= 1 && Math.abs(at(ci, 0)[2] - 191) <= 2 && Math.abs(at(ch, 0)[0] - 128) <= 2 && at(cn, 0).join() === "9,9,9,255", [at(cl, 0), at(ci, 0), at(ch, 0)]);
// Apply Image
const Wd = 4, Hd = 2, white = new Uint8ClampedArray(Wd * Hd * 4).fill(255), half = new Uint8ClampedArray(Wd * Hd * 4);
for (let i = 0; i < Wd * Hd; i++) { half[i * 4] = i % Wd < 2 ? 0 : 255; half[i * 4 + 1] = 128; half[i * 4 + 2] = 255; half[i * 4 + 3] = 255; }
F2.SOURCES.set("white", { data: white, W: Wd, H: Hd }); F2.SOURCES.set("half", { data: half, W: Wd, H: Hd });
const lay = new Uint8ClampedArray(Wd * Hd * 4); for (let i = 0; i < Wd * Hd; i++) lay.set([200, 100, 50, i === 0 ? 0 : 255], i * 4);
const a1 = FX.run("applyimage", lay, Wd, Hd, { source: "white", blending: "multiply" }), a2 = FX.run("applyimage", lay, Wd, Hd, { source: "half", channel: "red", blending: "multiply" });
const a3 = FX.run("applyimage", lay.slice(8 * 0, 4 * 2), 2, 1, { source: "half", channel: "red", blending: "multiply" }, { x: 2, y: 1, W: Wd, H: Hd });
const a4 = FX.run("applyimage", lay, Wd, Hd, { source: "half", channel: "red", invert: true, blending: "multiply", opacity: 50 });
check("Apply Image: multiply by white = no change; by the source's red channel (0 on the left) = black on the left; a piece of the picture reads the source at its place; invert + 50 %; transparency kept",
  at(a1, 1).join() === "200,100,50,255" && at(a2, 1).join() === "0,0,0,255" && at(a2, 2).join() === "200,100,50,255" && at(a3, 0).join() === "200,100,50,0" && at(a4, 1).join() === "200,100,50,255" && at(a4, 2)[0] === 100 && at(a1, 0)[3] === 0,
  [at(a1, 1), at(a2, 1), at(a2, 2), at(a3, 0), at(a4, 2)]);
check("Apply Image: the 11 blend modes", F2.BLENDS.length === 11 && F2.blendOne("screen", 0, 255) === 255 && F2.blendOne("difference", 200, 50) === 150 && F2.blendOne("darken", 10, 20) === 10 && Math.round(F2.blendOne("overlay", 64, 128)) === 64);
check("FX.run passes where the piece is (ctx), the whole picture when not told", (() => { let got = null; const f = { id: "zz_ctx", group: "Image", params: [], apply: (s, w, h, p, c) => { got = c; return s; } }; FX.FILTERS.push(f); FX.run("zz_ctx", new Uint8ClampedArray(8), 2, 1, {}); const a = got; FX.run("zz_ctx", new Uint8ClampedArray(8), 2, 1, {}, { x: 5, y: 6, W: 9, H: 9 }); FX.FILTERS.pop(); return a.W === 2 && a.x === 0 && got.x === 5; })());
check("every new one: a name, its parameters with defaults, a pad for the blurring ones", F2.FILTERS2.every((f) => f.name && Array.isArray(f.params) && typeof f.apply === "function") && FX.pad(FX.byId("shadowshighlights"), {}) >= 45 && FX.pad(FX.byId("hdrtoning"), {}) >= 90 && JSON.stringify(FX.defaults(FX.byId("selectivecolor")).sel.ranges.reds) === '{"c":0,"m":0,"y":0,"k":0}');
// wiring
const ie = fs.readFileSync(path.join(X, "imageedit.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(X, "ext.json"), "utf8")).scripts;
check("the wiring: filters2.js loads just before imageedit.js; the dialog / Properties draw + bind kinds of their own (and Reset redraws them); the eyedropper; the piece's place to FX.run; installed",
  ext.indexOf("filters2.js") < ext.indexOf("imageedit.js") && ext.indexOf("filters2.js") > ext.indexOf("pcuelights.js") && /E\.paramTypes\[q\.type\]\.html\(q, v, E\)/.test(ie) && /box\.querySelectorAll\("\[data-pt\]"\)[\s\S]{0,400}T\.bind\(el, q, params, changed, E\)/.test(ie) && /dlg\.querySelectorAll\("\[data-pt\]"\)/.test(ie)
  && /q\.type === "color" && q\.eyedrop/.test(ie) && /FX\.run\(f\.id, orig\.data, R\.w, R\.h, params, \{ x: R\.x, y: R\.y, W: S\.w, H: S\.h \}\)/.test(ie) && /win\.IEFilters2\.install\(E\)/.test(ie));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
