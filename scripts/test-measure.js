#!/usr/bin/env node
/* bitGen Studio — 2.483.0: PANELS AND MEASURING TOOLS (ext/imageeditdock/pcmeasure.js) - the image editor's gap,
 * round D. Tim (verbatim): "close the photoshop gap."
 * The pure parts: the histogram + its numbers, HSB / CMYK readouts, the ruler's angle + straightening, the perspective
 * crop's size, Grow / Similar, the focus map, Defringe / Remove Black / White Matte, sampler averages, Transform
 * Selection; the tools added to the Eyedropper / Crop groups; documents + .bgi keep the marks; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
globalThis.PCUI = require(path.join(X, "pcui.js"));
const M = require(path.join(X, "pcmeasure.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const img = (w, h, f) => { const s = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); s.set(v.length === 3 ? [...v, 255] : v, (y * w + x) * 4); } return s; };
const two = img(4, 1, (x) => (x < 2 ? [0, 0, 0] : [255, 255, 255]));
const h = M.histogram(two, "rgb", null), hm = M.histogram(two, "rgb", Uint8Array.from([1, 0, 0, 0])), hc = M.histogram(img(1, 1, () => [10, 20, 30]), "colors");
check("histogram: two black + two white = mean 127.5, std 127.5, median 0, 4 pixels; a mask counts only its pixels; 'colors' counts R, G and B", h.n === 4 && Math.abs(h.mean - 127.5) < 1e-9 && Math.abs(h.std - 127.5) < 1e-9 && h.median === 0 && h.bins[0] === 2 && h.bins[255] === 2 && hm.n === 1 && hc.n === 3 && hc.bins[20] === 1, [h.mean, h.std, hm.n, hc.n]);
check("histogram: see-through pixels never count; luminosity / red / green / blue", M.histogram(img(2, 1, (x) => (x ? [9, 9, 9, 0] : [255, 0, 0])), "red").n === 1 && M.histogram(img(1, 1, () => [255, 0, 0]), "luminosity").bins[76] === 1);
check("HSB / CMYK readouts: red = 0° 100% 100% / 0 100 100 0; black = K 100", M.toHsb(255, 0, 0).join() === "0,100,100" && M.toCmyk(255, 0, 0).join() === "0,100,100,0" && M.toCmyk(0, 0, 0).join() === "0,0,0,100" && M.toHsb(0, 0, 255)[0] === 240);
const a = M.angleOf(0, 10, 10, 0), b = M.angleOf(0, 0, 10, 1);
check("ruler: up-right 45° (counter-clockwise), length; straighten a slightly tilted line by its angle; a near-vertical one to upright", Math.abs(a.angle - 45) < 1e-9 && Math.abs(a.length - Math.SQRT2 * 10) < 1e-9 && Math.abs(M.straightenBy(b.angle) - b.angle) < 1e-9 && Math.abs(M.straightenBy(88)) - 2 < 1e-9 && M.straightenBy(88) < 0, [a, b.angle, M.straightenBy(88)]);
check("perspective crop size: the average of opposite sides", JSON.stringify(M.rectOfQuad([[0, 0], [100, 10], [110, 90], [0, 80]])) === JSON.stringify({ w: 105, h: 80 }));
const blob = img(10, 1, (x) => (x < 4 ? [100, 100, 100] : x === 4 ? [110, 110, 110] : x < 7 ? [200, 0, 0] : [100, 100, 100]));
const s0 = new Uint8Array(10); s0[0] = 255;
const g = M.grow(s0, blob, 10, 1, 20), sm = M.similar(s0, blob, 10, 1, 20);
check("Grow spreads along touching pixels within the tolerance (0-4, not past the red); Similar takes every alike pixel (also 7-9)", Array.from(g).join() === "255,255,255,255,255,0,0,0,0,0" && Array.from(sm).join() === "255,255,255,255,255,0,0,255,255,255", [Array.from(g), Array.from(sm)]);
const sharpBlur = img(40, 20, (x, y) => (x < 20 ? ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]) : [128, 128, 128]));
const fm = M.focusMap(sharpBlur, 40, 20, 2);
check("focus map: the detailed half is sharp (near 1), the flat half 0", fm[10 * 40 + 5] > 0.8 && fm[10 * 40 + 35] === 0, [fm[10 * 40 + 5], fm[10 * 40 + 35]]);
const fr = img(5, 1, (x) => [[0, 0, 0, 0], [255, 0, 0, 128], [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255]][x]);
const df = M.defringe(fr, 5, 1, 1);
check("Defringe: the red half-transparent edge pixel takes the solid green's colour, its alpha kept", Array.from(df.slice(4, 8)).join() === "0,255,0,128", Array.from(df.slice(4, 8)));
const blackMatte = img(1, 1, () => [64, 0, 0, 128]), whiteMatte = img(1, 1, () => [255, 127, 127, 128]);
check("Remove Black Matte: 64 at half alpha was 128 on black; Remove White Matte: the white taken out", Math.abs(M.unmatte(blackMatte, false)[0] - 128) <= 1 && Math.abs(M.unmatte(whiteMatte, true)[1] - 0) <= 2 && M.unmatte(blackMatte, false)[3] === 128);
const chk = img(3, 3, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
check("sampler: a point, a 3 x 3 average", M.sampleAvg(chk, 3, 3, 1, 1, 1)[0] === 0 && M.sampleAvg(chk, 3, 3, 1, 1, 3)[0] === Math.round(255 * 4 / 9));
const sq = new Uint8Array(100); for (let y = 4; y < 6; y++) for (let x = 4; x < 6; x++) sq[y * 10 + x] = 255;
const mv = M.transformMask(sq, 10, 10, { dx: 3, dy: 0 }), big = M.transformMask(sq, 10, 10, { sx: 300, sy: 300 }), cnt = (m) => Array.from(m).filter((v) => v).length;
check("Transform Selection: moved by 3 px; scaled 300 % (more pixels, same centre)", mv[4 * 10 + 7] === 255 && mv[4 * 10 + 4] === 0 && cnt(big) > 20 && big[4 * 10 + 4] === 255, [cnt(mv), cnt(big)]);
const gi = globalThis.PCUI.GROUPS.find((x) => x && x.k === "i").tools.map((t) => t[0]), gc = globalThis.PCUI.GROUPS.find((x) => x && x.k === "c").tools.map((t) => t[0]);
check("the tool column: Eyedropper + Color Sampler, Ruler, Note, Count (I); Crop + Perspective Crop (C); with icons", gi.join() === "picker,sampler,ruler,note,count" && gc.join() === "crop,pcrop" && ["sampler", "ruler", "note", "count", "pcrop"].every((k) => globalThis.PCUI.ICON[k]), [gi, gc]);
const docs = fs.readFileSync(path.join(X, "pcdocs.js"), "utf8"), bgi = fs.readFileSync(path.join(X, "pcbgi.js"), "utf8"), ie = fs.readFileSync(path.join(X, "imageedit.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(X, "ext.json"), "utf8")).scripts;
check("each document keeps its samplers, notes and count marks (pcdocs DOC_KEYS); the .bgi keeps them", /"samplers", "notes", "counts"/.test(docs) && /samplers: \[\], notes: \[\], counts: null/.test(docs) && /marks: \{ samplers: clone\(S\.samplers/.test(bgi) && /const mk = m\.marks/.test(bgi));
check("the wiring: pcmeasure.js after pcui.js and filters5.js, before imageedit.js; installed", ext.indexOf("pcmeasure.js") > ext.indexOf("pcui.js") && ext.indexOf("pcmeasure.js") === ext.indexOf("filters5.js") + 1 && ext.indexOf("pcmeasure.js") < ext.indexOf("imageedit.js") && /win\.PCMeasure\.install\(E\)/.test(ie));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
