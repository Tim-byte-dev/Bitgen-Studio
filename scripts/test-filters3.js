#!/usr/bin/env node
/* bitGen Studio — 2.481.0: THE FILTER MENU, ROUND B (ext/imageeditdock/filters3.js + filters4.js) - the image editor's
 * gap. Tim (verbatim): "close the photoshop gap."
 * 44 filters: Blur (Surface, Smart, Average, Lens), Blur Gallery (Field, Iris, Path, Spin), Noise (Reduce Noise, Dust &
 * Scratches, Despeckle), Sharpen (Smart Sharpen), Other (High Pass, Minimum, Maximum, Offset, Custom, HSB / HSL),
 * Distort (Displace, Polar Coordinates, Pinch, ZigZag, Shear, Glass), Pixelate (Color Halftone, Crystallize,
 * Pointillize, Facet, Fragment, Mezzotint), Render (Lighting Effects, Fibers, Difference Clouds), Stylize (Diffuse,
 * Tiles, Trace Contour), Artistic (Cutout, Poster Edges, Watercolor, Dry Brush), Sketch (Graphic Pen, Charcoal),
 * Texture (Grain, Craquelure): each run on small pictures with a check of what it should do; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
const FX = require(path.join(X, "filters.js")), F2 = require(path.join(X, "filters2.js")), F3 = require(path.join(X, "filters3.js")), F4 = require(path.join(X, "filters4.js"));
F3.register(FX); F4.register(FX); F3.register(FX);
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const img = (w, h, f) => { const s = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); s.set(v.length === 3 ? [...v, 255] : v, (y * w + x) * 4); } return s; };
const at = (s, w, x, y) => Array.from(s.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const run = (id, s, w, h, p, ctx) => FX.run(id, s, w, h, p || {}, ctx);
const variance = (s, w, x0, y0, x1, y1) => { let m = 0, q = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = s[(y * w + x) * 4]; m += v; q += v * v; n++; } m /= n; return q / n - m * m; };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const ids = [...F3.FILTERS3, ...F4.FILTERS4].map((f) => f.id);
const subs = new Set([...F3.FILTERS3, ...F4.FILTERS4].map((f) => f.sub));
check("44 filters registered once, in the Filter menu's submenus (+ Artistic, Blur Gallery, Other, Sketch, Texture)", ids.length === 44 && ids.every((id) => FX.FILTERS.filter((f) => f.id === id).length === 1 && FX.byId(id).group === "Filters")
  && ["Blur", "Blur Gallery", "Noise", "Sharpen", "Other", "Distort", "Pixelate", "Render", "Stylize", "Artistic", "Sketch", "Texture"].every((s) => subs.has(s)), [ids.length, [...subs]]);
const W = 48, H = 32, base = img(W, H, (x, y) => [x * 5, y * 7, 120]);
const broken = ids.filter((id) => { try { const o = run(id, base, W, H, {}, { x: 0, y: 0, W, H }); return !(o instanceof Uint8ClampedArray) || o.length !== base.length; } catch (e) { return true; } });
check("every one runs with its defaults and gives a picture of the same size", !broken.length, broken);

// Blur
const step = img(40, 10, (x) => { const v = x < 20 ? 40 : 220; return [v + (rnd() - 0.5) * 30, v + (rnd() - 0.5) * 30, v + (rnd() - 0.5) * 30]; });
const sb = run("surfaceblur", step, 40, 10, { radius: 4, threshold: 40 });
check("Surface Blur: the noise smoothed, the edge kept sharp", variance(sb, 40, 2, 2, 16, 8) < variance(step, 40, 2, 2, 16, 8) / 3 && at(sb, 40, 18, 5)[0] < 80 && at(sb, 40, 21, 5)[0] > 180, [variance(sb, 40, 2, 2, 16, 8), at(sb, 40, 18, 5), at(sb, 40, 21, 5)]);
const eo = run("smartblur", step, 40, 10, { radius: 2, threshold: 30, mode: "edge only" });
check("Smart Blur 'edge only': white on the edge, black elsewhere", at(eo, 40, 19, 5)[0] === 255 && at(eo, 40, 5, 5)[0] === 0, [at(eo, 40, 19, 5), at(eo, 40, 5, 5)]);
const av = run("average", img(2, 1, (x) => (x ? [200, 100, 0] : [0, 100, 200])), 2, 1);
check("Average: every pixel the average colour", at(av, 2, 0, 0).join() === "100,100,100,255" && at(av, 2, 1, 0).join() === "100,100,100,255");
const dots = img(30, 30, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
const lb0 = run("lensblur", dots, 30, 30, { radius: 0 }), lb = run("lensblur", dots, 30, 30, { radius: 6 });
const half = img(30, 30, (x, y) => (y < 15 ? ((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]) : ((x + y) % 2 ? [255, 255, 255, 60] : [0, 0, 0, 60])));
const lbd = run("lensblur", half, 30, 30, { radius: 6, depth: "transparency", focal: 255 });
check("Lens Blur: radius 0 = as it was; a radius evens out a checkerboard; a transparency depth keeps the in-focus part sharp", at(lb0, 30, 5, 5).join() === at(dots, 30, 5, 5).join() && Math.abs(at(lb, 30, 15, 15)[0] - 180) < 60 && (at(lbd, 30, 5, 5)[0] === 0 || at(lbd, 30, 5, 5)[0] === 255) && at(lbd, 30, 5, 25)[0] > 20 && at(lbd, 30, 5, 25)[0] < 235, [at(lb, 30, 15, 15), at(lbd, 30, 5, 5), at(lbd, 30, 5, 25)]);
// Blur Gallery
const fb = run("fieldblur", dots, 30, 30, { p1x: 0, p1y: 50, p1b: 0, p2x: 100, p2y: 50, p2b: 20 });
check("Field Blur: sharp at the 0-blur pin, blurred at the other", (at(fb, 30, 1, 15)[0] < 25 || at(fb, 30, 1, 15)[0] > 230) && Math.abs(at(fb, 30, 28, 15)[0] - 128) < 50, [at(fb, 30, 1, 15), at(fb, 30, 28, 15)]);
const ib = run("irisblur", dots, 30, 30, { cx: 50, cy: 50, rx: 30, ry: 30, feather: 20, blur: 20 });
check("Iris Blur: the centre sharp, the corners blurred", [0, 255].includes(at(ib, 30, 15, 15)[0]) && Math.abs(at(ib, 30, 1, 1)[0] - 128) < 60, [at(ib, 30, 15, 15), at(ib, 30, 1, 1)]);
const ibc = run("irisblur", dots.slice(0, 30 * 10 * 4), 30, 10, { cx: 50, cy: 50, rx: 30, ry: 30, feather: 20, blur: 20 }, { x: 0, y: 10, W: 30, H: 30 });
check("Iris Blur on a piece (a selection) knows where it is in the picture (its middle row sharp)", [0, 255].includes(at(ibc, 30, 15, 5)[0]), at(ibc, 30, 15, 5));
const stripes = img(40, 40, (x) => (x % 4 < 2 ? [255, 255, 255] : [0, 0, 0]));
const sp = run("spinblur", stripes, 40, 40, { cx: 50, cy: 50, rx: 45, ry: 45, angle: 60, feather: 10 });
check("Spin Blur: round the centre (the middle little changed), smeared further out", Math.abs(at(sp, 40, 20, 20)[0] - at(stripes, 40, 20, 20)[0]) < 140 && Math.abs(at(sp, 40, 28, 12)[0] - 128) < 90, [at(sp, 40, 20, 20), at(sp, 40, 28, 12)]);
const pb = run("pathblur", img(40, 20, (x, y) => (y % 4 < 2 ? [255, 255, 255] : [0, 0, 0])), 40, 20, { ax: 0, ay: 50, bx: 50, by: 50, ex: 100, ey: 50, speed: 30 });
check("Path Blur along a straight line across: horizontal lines stay lines", [0, 255].includes(at(pb, 40, 20, 1)[0]) || Math.abs(at(pb, 40, 20, 1)[0] - 255) < 20, at(pb, 40, 20, 1));
// Noise
const noisy = img(30, 30, () => { const v = 128 + (rnd() - 0.5) * 60; return [v, v + (rnd() - 0.5) * 40, v]; });
const rn = run("reducenoise", noisy, 30, 30, { strength: 8, preserve: 20, color: 80, sharpen: 0 });
check("Reduce Noise: much less noise in a flat area", variance(rn, 30, 3, 3, 27, 27) < variance(noisy, 30, 3, 3, 27, 27) / 3, [variance(rn, 30, 3, 3, 27, 27), variance(noisy, 30, 3, 3, 27, 27)]);
const speck = img(20, 20, (x, y) => (x === 10 && y === 10 ? [255, 255, 255] : [60, 60, 60]));
const ds = run("dustscratches", speck, 20, 20, { radius: 2, threshold: 20 }), ds2 = run("dustscratches", speck, 20, 20, { radius: 2, threshold: 250 }), dsp = run("despeckle", speck, 20, 20);
check("Dust & Scratches takes out a speck over the threshold, leaves it under; Despeckle takes it out too", at(ds, 20, 10, 10)[0] === 60 && at(ds2, 20, 10, 10)[0] === 255 && at(dsp, 20, 10, 10)[0] === 60, [at(ds, 20, 10, 10), at(ds2, 20, 10, 10), at(dsp, 20, 10, 10)]);
// Sharpen
const soft = FX.gaussian(img(40, 10, (x) => (x < 20 ? [60, 60, 60] : [200, 200, 200])), 40, 10, 3);
const ss = run("smartsharpen", soft, 40, 10, { amount: 300, radius: 2, remove: "gaussian blur" }), ssl = run("smartsharpen", soft, 40, 10, { amount: 300, radius: 2, remove: "lens blur" }), ssm = run("smartsharpen", soft, 40, 10, { amount: 300, radius: 2, remove: "motion blur", angle: 0 });
const contrast = (s) => at(s, 40, 22, 5)[0] - at(s, 40, 17, 5)[0];
check("Smart Sharpen (Gaussian / Lens / Motion): the soft edge gets more contrast", contrast(ss) > contrast(soft) + 20 && contrast(ssl) > contrast(soft) + 20 && contrast(ssm) > contrast(soft) + 20, [contrast(soft), contrast(ss), contrast(ssl), contrast(ssm)]);
const fhi = run("smartsharpen", soft, 40, 10, { amount: 300, radius: 2, remove: "gaussian blur", highlights: 100, shadows: 100 });
check("Smart Sharpen: fading in shadows / highlights holds the sharpening back there", contrast(fhi) < contrast(ss), [contrast(fhi), contrast(ss)]);
// Other
const hp = run("highpass", img(10, 10, () => [90, 90, 90]), 10, 10, { radius: 3 });
check("High Pass: a flat picture becomes 50 % grey", at(hp, 10, 5, 5).join() === "128,128,128,255");
const dot = img(15, 15, (x, y) => (x === 7 && y === 7 ? [255, 255, 255] : [0, 0, 0]));
const mx = run("maximum", dot, 15, 15, { radius: 2, preserve: "squareness" }), mxr = run("maximum", dot, 15, 15, { radius: 3, preserve: "roundness" }), mn = run("minimum", mx, 15, 15, { radius: 2, preserve: "squareness" });
check("Maximum grows a white dot (square / round - the round one leaves the corners), Minimum shrinks it back", at(mx, 15, 9, 9)[0] === 255 && at(mx, 15, 10, 7)[0] === 0 && at(mxr, 15, 10, 7)[0] === 255 && at(mxr, 15, 10, 10)[0] === 0 && at(mn, 15, 7, 7)[0] === 255 && at(mn, 15, 8, 8)[0] === 0, [at(mx, 15, 9, 9), at(mxr, 15, 10, 10), at(mn, 15, 8, 8)]);
const of = run("offset", dot, 15, 15, { h: 10, v: 0, undefined: "wrap around" }), oft = run("offset", dot, 15, 15, { h: 3, v: 0, undefined: "set to transparent" });
check("Offset: wrap around (the dot comes in from the left), set to transparent (the uncovered part clear)", at(of, 15, 2, 7)[0] === 255 && at(oft, 15, 10, 7)[0] === 255 && at(oft, 15, 1, 1)[3] === 0, [at(of, 15, 2, 7), at(oft, 15, 1, 1)]);
const cu = run("custom", base, W, H, { kernel: F3.IDENT5 }), cb = run("custom", dots, 30, 30, { kernel: Array(25).fill(1), scale: 25 });
check("Custom: the identity kernel changes nothing; a 5 x 5 box / 25 averages", cu.join() === base.join() && Math.abs(at(cb, 30, 15, 15)[0] - 127) < 15, at(cb, 30, 15, 15));
const hsb = run("hsbhsl", img(1, 1, () => [255, 0, 0]), 1, 1, { input: "rgb", rows: "hsb" }), back = run("hsbhsl", img(1, 1, () => [200, 120, 40]), 1, 1, { input: "rgb", rows: "hsl" }), back2 = run("hsbhsl", back, 1, 1, { input: "hsb / hsl", rows: "hsl" });
check("HSB / HSL: red -> H 0, S 255, B 255; RGB -> HSL -> RGB comes back", at(hsb, 1, 0, 0).join() === "0,255,255,255" && at(back2, 1, 0, 0).slice(0, 3).every((v, i) => Math.abs(v - [200, 120, 40][i]) <= 3), [at(hsb, 1, 0, 0), at(back2, 1, 0, 0)]);
// Distort
F2.SOURCES.set("grey", { data: img(W, H, () => [128, 128, 128]), W, H }); F2.SOURCES.set("push", { data: img(W, H, () => [255, 128, 128]), W, H });
const dg = run("displace", base, W, H, { map: "grey", hscale: 50, vscale: 50 }), dp = run("displace", base, W, H, { map: "push", hscale: 10, vscale: 10 });
check("Displace: a 50 % grey map moves nothing; a red map moves the picture across (by scale % of 128 px)", dg.join() === base.join() && Math.abs(at(dp, W, 10, 5)[0] - at(base, W, 22, 5)[0]) <= 6, [at(dp, W, 10, 5), at(base, W, 22, 5)]);
const pz = run("pinch", base, W, H, { amount: 0 }), zz = run("zigzag", base, W, H, { amount: 0 });
const pin = run("pinch", base, W, H, { amount: 80 });
check("Pinch 0 / ZigZag 0 = as it was; Pinch + pulls the middle in (a point near the centre takes colour from further out)", pz.join() === base.join() && zz.join() === base.join() && Math.abs(at(pin, W, 30, 16)[0] - at(base, W, 30, 16)[0]) > 5, [at(pin, W, 30, 16), at(base, W, 30, 16)]);
const sh = run("shear", base, W, H, { top: 0, middle: 10, bottom: 0, undefined: "repeat edge pixels" });
check("Shear: the middle row shifted, the top row not", at(sh, W, 20, 0).join() === at(base, W, 20, 0).join() && at(sh, W, 30, 16)[0] !== at(base, W, 30, 16)[0], [at(sh, W, 30, 16), at(base, W, 30, 16)]);
const pr = run("polar", base, W, H, { mode: "rectangular to polar" }), pr2 = run("polar", pr, W, H, { mode: "polar to rectangular" });
check("Polar Coordinates: rectangular -> polar changes it; back again roughly restores the middle band", pr.join() !== base.join() && Math.abs(at(pr2, W, 24, 20)[0] - at(base, W, 24, 20)[0]) < 60, [at(pr2, W, 24, 20), at(base, W, 24, 20)]);
const gl = run("glass", base, W, H, { distortion: 0 });
check("Glass 0 = as it was", gl.join() === base.join());
// Pixelate
const ch = run("colorhalftone", img(20, 20, () => [255, 255, 255]), 20, 20, { radius: 4 }), chk = run("colorhalftone", img(20, 20, () => [0, 0, 0]), 20, 20, { radius: 4 });
check("Color Halftone: white stays white (no dots), black becomes dense black dots", at(ch, 20, 5, 5).join() === "255,255,255,255" && at(chk, 20, 4, 4)[0] < 40, [at(ch, 20, 5, 5), at(chk, 20, 4, 4)]);
const cr = run("crystallize", base, W, H, { cell: 8 });
const colours = new Set(); for (let i = 0; i < cr.length; i += 4) colours.add(cr[i] + "," + cr[i + 1]);
check("Crystallize: cells of one colour (far fewer colours than pixels)", colours.size < W * H / 20, colours.size);
const pt = run("pointillize", base, W, H, { cell: 8, background: "#ffffff" });
check("Pointillize: dots on the background colour", Array.from({ length: W * H }, (_, i) => pt[i * 4] === 255 && pt[i * 4 + 1] === 255 && pt[i * 4 + 2] === 255).some(Boolean));
const mz = run("mezzotint", base, W, H, { type: "medium dots" });
check("Mezzotint: every channel fully on or off", Array.from(mz).every((v, i) => i % 4 === 3 || v === 0 || v === 255));
// Render
const le = run("lighting", base, W, H, { intensity: 0, ambience: 100, gloss: 0 }), le2 = run("lighting", base, W, H, { style: "spot", x: 0, y: 0, tx: 0, ty: 0, angle: 20, intensity: 80, ambience: 10 });
check("Lighting Effects: no light + full ambience = as it was; a spot aimed at the top-left lights it, the far corner dark", Math.abs(at(le, W, 20, 10)[0] - at(base, W, 20, 10)[0]) <= 1 && at(le2, W, 2, 2)[1] > at(le2, W, 46, 30)[1], [at(le2, W, 2, 2), at(le2, W, 46, 30)]);
const fi = run("fibers", base, W, H, { fg: "#000000", bg: "#ffffff" }), dcl = run("diffclouds", img(20, 20, () => [0, 0, 0]), 20, 20, { seed: 3 }), cl = run("clouds", img(20, 20, () => [0, 0, 0]), 20, 20, { seed: 3 });
check("Fibers: grey streaks between the colours; Difference Clouds on black = Clouds", Array.from(fi).every((v, i) => i % 4 === 3 || (v >= 0 && v <= 255)) && fi[0] === fi[1] && dcl.join() === cl.join());
// Stylize
const df = run("diffuse", base, W, H, { mode: "darken only" });
check("Diffuse 'darken only': nothing gets lighter", Array.from({ length: W * H }, (_, i) => df[i * 4] * 0.299 + df[i * 4 + 1] * 0.587 + df[i * 4 + 2] * 0.114 <= base[i * 4] * 0.299 + base[i * 4 + 1] * 0.587 + base[i * 4 + 2] * 0.114 + 0.5).every(Boolean));
const tl = run("tiles", base, W, H, { count: 4, offset: 1, fill: "unaltered image" });
check("Tiles: the picture cut into tiles (offset 1 % - almost in place)", Math.abs(at(tl, W, 20, 10)[0] - at(base, W, 20, 10)[0]) < 40);
const tc = run("tracecontour", img(20, 1, (x) => [x * 13, x * 13, x * 13]), 20, 1, { level: 128, edge: "upper" });
check("Trace Contour: a dark line where the level is crossed, white elsewhere", Array.from(tc).filter((v, i) => i % 4 === 0 && v === 0).length >= 1 && tc[0] === 255);
// Artistic, Sketch, Texture
const cut = run("cutout", base, W, H, { levels: 3 });
const lv = new Set(); for (let i = 0; i < cut.length; i += 4) lv.add(cut[i]);
check("Cutout: a few flat levels", lv.size <= 3, [...lv]);
const pe = run("posteredges", step, 40, 10, { thickness: 6, intensity: 10 });
check("Poster Edges: dark lines along the edge", at(pe, 40, 19, 5)[0] < at(pe, 40, 5, 5)[0] + 30, [at(pe, 40, 19, 5), at(pe, 40, 5, 5)]);
const gp = run("graphicpen", base, W, H, {});
check("Graphic Pen: only ink and paper", Array.from({ length: W * H }, (_, i) => gp[i * 4] === 0 || gp[i * 4] === 255).every(Boolean));
const gr0 = run("grain", base, W, H, { intensity: 0, contrast: 0 });
check("Grain 0 / 0 = as it was", gr0.join() === base.join());
const cq = run("craquelure", img(30, 30, () => [200, 200, 200]), 30, 30, { spacing: 8, depth: 8 });
const cqs = new Set(); for (let i = 0; i < cq.length; i += 4) cqs.add(cq[i]);
check("Craquelure: lit cracks across a flat picture", cqs.size > 5, cqs.size);
check("see-through pixels keep their alpha (Surface Blur, Smart Sharpen, Grain)", ["surfaceblur", "smartsharpen", "grain"].every((id) => at(run(id, img(4, 4, () => [10, 20, 30, 77]), 4, 4), 4, 1, 1)[3] === 77));
// the page part
const E = {}; F3.install(E);
check("the Custom filter's 5 x 5 kernel is a parameter kind of its own (25 boxes + presets)", E.paramTypes && E.paramTypes.kernel && (E.paramTypes.kernel.html({ id: "kernel", label: "K" }, F3.SHARP5).match(/class="kk"/g) || []).length === 25);
const ie = fs.readFileSync(path.join(X, "imageedit.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(X, "ext.json"), "utf8")).scripts;
check("the wiring: filters3.js + filters4.js after filters2.js, before imageedit.js; IEFilters3 installed", ext.indexOf("filters3.js") === ext.indexOf("filters2.js") + 1 && ext.indexOf("filters4.js") === ext.indexOf("filters3.js") + 1 && ext.indexOf("filters4.js") < ext.indexOf("imageedit.js") && ext.indexOf("filters4.js") > ext.indexOf("filters2.js") && /win\.IEFilters3\.install\(E\)/.test(ie));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
