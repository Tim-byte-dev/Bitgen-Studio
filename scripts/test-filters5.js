#!/usr/bin/env node
/* bitGen Studio — 2.482.0: THE DEVELOP FILTER + LENS CORRECTION (ext/imageeditdock/filters5.js) - the image editor's
 * gap, round C. Tim (verbatim): "close the photoshop gap."
 * The develop pipeline (white balance, exposure, tone, presence, the point curve, the colour mixer, black & white,
 * grading, detail, optics, geometry, effects), ✨ Auto, the presets, Lens Correction (distortion, fringes, vignette,
 * perspective, angle, edges), the page part (the tabbed panel, the commands), the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
const FX = require(path.join(X, "filters.js")), F3 = require(path.join(X, "filters3.js")), F5 = require(path.join(X, "filters5.js"));
F3.register(FX); F5.register(FX); F5.register(FX);
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const img = (w, h, f) => { const s = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); s.set(v.length === 3 ? [...v, 255] : v, (y * w + x) * 4); } return s; };
const at = (s, w, x, y) => Array.from(s.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const W = 48, H = 32, base = img(W, H, (x, y) => [40 + x * 4, 30 + y * 6, 120]);
const dev = (o, s, w, h) => { const d = Object.assign(F5.DEV_DEFAULT(), o); return FX.run("develop", s || base, w || W, h || H, { dev: d }); };
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
check("registered once; not in the auto-built menus (group Develop) - the commands add them", FX.FILTERS.filter((f) => f.id === "develop").length === 1 && FX.byId("develop").group === "Develop" && FX.byId("lenscorrection").group === "Develop");
check("all zero = exactly the picture", dev({}).join() === base.join());
const mid = [20, 16];
check("Exposure +1 brighter, -1 darker", lum(at(dev({ exposure: 1 }), W, ...mid)) > lum(at(base, W, ...mid)) + 20 && lum(at(dev({ exposure: -1 }), W, ...mid)) < lum(at(base, W, ...mid)) - 20);
const warm = at(dev({ temp: 60 }), W, ...mid), cool = at(dev({ temp: -60 }), W, ...mid), b0 = at(base, W, ...mid);
check("Temperature: + warmer (more red, less blue), - cooler; Tint + = more green", warm[0] > b0[0] && warm[2] < b0[2] && cool[2] > b0[2] && at(dev({ tint: 60 }), W, ...mid)[1] > b0[1], [warm, cool, b0]);
const ramp = img(64, 1, (x) => [x * 4, x * 4, x * 4]);
const ct = dev({ contrast: 60 }, ramp, 64, 1);
check("Contrast: darks darker, lights lighter, the middle stays", at(ct, 64, 8, 0)[0] < 32 && at(ct, 64, 56, 0)[0] > 224 && Math.abs(at(ct, 64, 32, 0)[0] - 128) < 12, [at(ct, 64, 8, 0), at(ct, 64, 56, 0), at(ct, 64, 32, 0)]);
const sh = dev({ shadows: 80 }, ramp, 64, 1), hl = dev({ highlights: -80 }, ramp, 64, 1), bl = dev({ blacks: -80 }, ramp, 64, 1), wh = dev({ whites: 80 }, ramp, 64, 1);
check("Shadows + lifts the darks (not the lights); Highlights - pulls the lights (not the darks); Blacks - crushes; Whites + brightens the top", at(sh, 64, 16, 0)[0] > 70 && at(sh, 64, 60, 0)[0] - 240 < 4 && at(hl, 64, 48, 0)[0] < 180 && at(hl, 64, 8, 0)[0] === 32 && at(bl, 64, 4, 0)[0] < 10 && at(wh, 64, 56, 0)[0] > 228,
  [at(sh, 64, 16, 0), at(hl, 64, 48, 0), at(bl, 64, 4, 0), at(wh, 64, 56, 0)]);
const sat = at(dev({ saturation: 80 }), W, ...mid), des = at(dev({ saturation: -100 }), W, ...mid);
check("Saturation: + more colourful, -100 grey", (Math.max(...sat.slice(0, 3)) - Math.min(...sat.slice(0, 3))) > (Math.max(...b0.slice(0, 3)) - Math.min(...b0.slice(0, 3))) && Math.max(...des.slice(0, 3)) - Math.min(...des.slice(0, 3)) <= 2, [sat, des]);
const vg = dev({ vibrance: 100 }, img(2, 1, (x) => (x ? [200, 60, 60] : [130, 115, 110])), 2, 1);
check("Vibrance lifts a dull colour more than a saturated one", (at(vg, 2, 0, 0)[0] - at(vg, 2, 0, 0)[2]) / 20 > (at(vg, 2, 1, 0)[0] - at(vg, 2, 1, 0)[2]) / 140, [at(vg, 2, 0, 0), at(vg, 2, 1, 0)]);
const red = img(4, 1, () => [220, 40, 30]), mx = F5.DEV_DEFAULT(); mx.mix.red = { h: 0, s: -100, l: 0 }; const mixed = dev(mx, red, 4, 1);
const mxh = F5.DEV_DEFAULT(); mxh.mix.red = { h: 100, s: 0, l: 0 }; const shifted = dev(mxh, red, 4, 1);
check("the colour mixer: red's saturation -100 greys only the reds; red's hue + turns it towards orange", Math.abs(at(mixed, 4, 0, 0)[0] - at(mixed, 4, 0, 0)[2]) < 30 && at(shifted, 4, 0, 0)[1] > 60, [at(mixed, 4, 0, 0), at(shifted, 4, 0, 0)]);
const bw = at(dev({ bw: true }), W, ...mid);
check("Black & White: grey", bw[0] === bw[1] && bw[1] === bw[2], bw);
const gr = F5.DEV_DEFAULT(); gr.grade.sh = { h: 220, s: 100, l: 0 }; const graded = dev(gr, ramp, 64, 1);
check("Grading: a blue shadow tint shows in the darks, not the lights", at(graded, 64, 6, 0)[2] > at(graded, 64, 6, 0)[0] + 8 && Math.abs(at(graded, 64, 60, 0)[2] - at(graded, 64, 60, 0)[0]) < 10, [at(graded, 64, 6, 0), at(graded, 64, 60, 0)]);
const cv = F5.DEV_DEFAULT(); cv.curve = { rgb: [[0, 255], [255, 0]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] };
check("the point curve (an inverting one) inverts", Math.abs(at(dev(cv, ramp, 64, 1), 64, 10, 0)[0] - (255 - 40)) <= 2);
const edge = FX.gaussian(img(40, 4, (x) => (x < 20 ? [60, 60, 60] : [200, 200, 200])), 40, 4, 2);
const shp = dev({ sharpen: 120 }, edge, 40, 4);
check("Detail: sharpening adds edge contrast", at(shp, 40, 21, 2)[0] - at(shp, 40, 18, 2)[0] > at(edge, 40, 21, 2)[0] - at(edge, 40, 18, 2)[0] + 20);
const flatn = img(30, 30, (x, y) => { const v = 128 + ((x * 7 + y * 13) % 11 - 5) * 6; return [v, v, v]; });
const nr = dev({ nrLum: 100 }, flatn, 30, 30), varOf = (s) => { let m = 0, q = 0, n = 0; for (let i = 0; i < s.length; i += 4) { m += s[i]; q += s[i] * s[i]; n++; } m /= n; return q / n - m * m; };
check("Detail: noise reduction lowers the noise", varOf(nr) < varOf(flatn) / 2, [varOf(nr), varOf(flatn)]);
const grey = img(40, 40, () => [180, 180, 180]), vgn = dev({ vignette: -80 }, grey, 40, 40), pcv = dev({ pcVig: 80 }, grey, 40, 40);
check("Optics vignetting - darkens the corners, not the centre; the after-crop vignette + lightens them", at(vgn, 40, 1, 1)[0] < 120 && at(vgn, 40, 20, 20)[0] === 180 && at(pcv, 40, 1, 1)[0] > 200, [at(vgn, 40, 1, 1), at(vgn, 40, 20, 20), at(pcv, 40, 1, 1)]);
const grid = img(40, 40, (x, y) => (x % 10 === 0 || y % 10 === 0 ? [0, 0, 0] : [255, 255, 255]));
const rot = dev({ rotate: 8 }, grid, 40, 40), dist = dev({ distortion: 60 }, grid, 40, 40);
check("Geometry / optics: rotation and distortion move the lines; the centre stays put", rot.join() !== grid.join() && dist.join() !== grid.join() && at(dist, 40, 20, 20).join() === at(grid, 40, 20, 20).join());
const gn = dev({ grain: 80 }, grey, 40, 40);
check("Effects: grain adds texture", varOf(gn) > 10, varOf(gn));
const auto = F5.autoBasic(img(30, 30, (x) => [20 + x, 20 + x, 20 + x]));
check("✨ Auto on a dark, flat picture: brighter exposure, more contrast", auto.exposure > 0.5 && auto.contrast > 0, auto);
check("8 built-in presets, each a full setting that develops (Black & White = grey)", Object.keys(F5.PRESETS).length === 8 && Object.keys(F5.PRESETS).every((n) => { const d = F5.withPreset(n); return d.mix && d.grade && dev(d).length === base.length; }) && (() => { const p = at(dev(F5.withPreset("Black & White")), W, ...mid); return p[0] === p[1]; })());
check("hueBand: pure red is all Reds; 45° is shared by Orange and Yellow", Math.abs(F5.hueBand(0).red - 1) < 1e-6 && F5.hueBand(45).orange > 0.4 && F5.hueBand(45).yellow > 0.4);
const piece = FX.run("develop", base.slice(0, W * 8 * 4), W, 8, { dev: Object.assign(F5.DEV_DEFAULT(), { pcVig: -80 }) }, { x: 0, y: 12, W, H });
check("on a piece of the picture (a selection) the vignette is placed by where the piece is (its middle row barely changes)", Math.abs(at(piece, W, 24, 4)[0] - at(base, W, 24, 4)[0]) < 6, [at(piece, W, 24, 4), at(base, W, 24, 4)]);
// Lens Correction
check("Lens Correction with nothing set = as it was", FX.run("lenscorrection", base, W, H, {}).join() === base.join());
const lt = FX.run("lenscorrection", grid, 40, 40, { angle: 10, edge: "transparent" }), le = FX.run("lenscorrection", grid, 40, 40, { scale: 70, edge: "background colour", edgeColor: "#ff0000" });
check("Lens Correction: turning with transparent edges leaves see-through corners; scaling down fills with the edge colour", at(lt, 40, 0, 0)[3] === 0 && at(le, 40, 0, 0).join() === "255,0,0,255", [at(lt, 40, 0, 0), at(le, 40, 0, 0)]);
const fr = FX.run("lenscorrection", grid, 40, 40, { redcyan: 100 });
check("Lens Correction: a red / cyan fix moves only the red channel", Array.from({ length: 1600 }, (_, i) => fr[i * 4 + 1] === grid[i * 4 + 1] && fr[i * 4 + 2] === grid[i * 4 + 2]).every(Boolean) && Array.from({ length: 1600 }, (_, i) => fr[i * 4] !== grid[i * 4]).some(Boolean));
const pv = FX.run("lenscorrection", grid, 40, 40, { vert: 60 });
check("Lens Correction: vertical perspective changes the top differently from the bottom", JSON.stringify(at(pv, 40, 5, 2)) !== JSON.stringify(at(grid, 40, 5, 2)) || JSON.stringify(at(pv, 40, 5, 37)) !== JSON.stringify(at(grid, 40, 5, 37)));
// the page part
const E = { S: { layers: [], active: 0 }, store: { _: {}, get(k, d) { return k in this._ ? this._[k] : d; }, set(k, v) { this._[k] = v; } }, ui: { addCmd: (...a) => (E.cmds = (E.cmds || []).concat([a])) }, overlayHooks: [] };
F5.install(E);
const html = E.paramTypes.develop.html({ id: "dev" }, F5.DEV_DEFAULT());
check("the Develop panel: nine tabs (Basic … Presets), the Basic sliders, B&W + Auto, the mixer, grading, presets + save", ["Basic", "Curve", "Color", "Grading", "Detail", "Optics", "Geometry", "Effects", "Presets"].every((t) => html.includes(`data-t="${t}"`)) && /dvBW/.test(html) && /dvAuto/.test(html) && /dvHue/.test(html) && /dvGr/.test(html) && /dvUS/.test(html) && (html.match(/class="dvS"/g) || []).length >= 40);
check("the commands: Filter ▸ Develop Filter… (Alt+Shift+Ctrl+A) after Smart Filters, Lens Correction… (Alt+Shift+Ctrl+R) after it; a grid overlay", E.cmds && E.cmds.some((c) => c[0] === "flt.develop" && c[2] === "Alt+Shift+Ctrl+A" && c[5][1] === "so.smartfilters") && E.cmds.some((c) => c[0] === "flt.lenscorrection" && c[5][1] === "flt.develop") && E.overlayHooks.length === 1);
const ie = fs.readFileSync(path.join(X, "imageedit.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(X, "ext.json"), "utf8")).scripts;
check("the wiring: filters5.js after filters4.js, before imageedit.js; installed", ext.indexOf("filters5.js") === ext.indexOf("filters4.js") + 1 && ext.indexOf("filters5.js") < ext.indexOf("imageedit.js") && /win\.IEFilters5\.install\(E\)/.test(ie));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
