#!/usr/bin/env node
/* bitGen Studio — 2.423.0 units: SELECTION REFINEMENT + RETOUCHING (gaps 4 + 5 of the Photoshop list)
 *   1. pcselect.js: box blur, the guided filter, distances, Select and Mask (radius snaps to the real edge, smooth,
 *      feather, contrast, shift edge, a refine band), decontamination, the magnetic lasso's live wire, quick
 *      selection stopping at edges, Select Sky
 *   2. pcretouch.js: Poisson blending (texture kept, light taken), content-aware fill (PatchMatch continues a pattern),
 *      red eye, the background eraser, the mixer brush's colour
 *   3. the wiring: ext.json, the tools in their groups, the Channels tab, the menus, the core hooks
 * Tim: "can we close the gap with 1,2,3,4 and 5 first" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PS = require(path.join(ROOT, "ext", "imageeditdock", "pcselect.js"));
const R = require(path.join(ROOT, "ext", "imageeditdock", "pcretouch.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] == null ? 255 : c[3]; } return d; };

/* ---- 1 */
const ones = PS.boxBlur(new Float32Array(30 * 20).fill(1), 30, 20, 4), ramp = PS.boxBlur(Float32Array.from({ length: 30 }, (_, i) => i), 30, 1, 2);
check("boxBlur: a flat field stays flat (edges counted right), a ramp stays a ramp in the middle", ones.every((v) => near(v, 1, 1e-6)) && near(ramp[10], 10, 1e-5));
const W = 60, H = 40, step = img(W, H, (x) => (x < 30 ? [30, 30, 30] : [220, 220, 220]));
const off = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < 34; x++) off[y * W + x] = 255;
const ref = PS.refine(off, step, W, H, { radius: 8 });
check("Select and Mask, Radius 8: a selection drawn 4 px past a sharp edge snaps back onto it (inside 255 at x = 29, 0 from x = 30)", ref[20 * W + 29] === 255 && ref[20 * W + 30] === 0 && ref[20 * W + 33] === 0 && ref[20 * W + 10] === 255, Array.from(ref.slice(20 * W + 26, 20 * W + 36)));
const sq = new Uint8Array(W * H); for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) sq[y * W + x] = 255;
const fe = PS.refine(sq, step, W, H, { feather: 6 }), ct = PS.refine(fe, step, W, H, { contrast: 100 }), shOut = PS.refine(sq, step, W, H, { shift: 50 }), sm = PS.refine(sq, step, W, H, { smooth: 3 });
check("Feather softens the edge; Contrast makes it hard again; Shift Edge +50 % moves it out (4 px); Smooth keeps a square a square", fe[20 * W + 20] > 40 && fe[20 * W + 20] < 220 && (ct[20 * W + 20] <= 5 || ct[20 * W + 20] >= 250)
  && shOut[20 * W + 17] > 200 && sm[20 * W + 30] === 255 && sm[0] === 0, [fe[20 * W + 20], ct[20 * W + 20], shOut[20 * W + 17]]);
const d = PS.dist(sq, W, H);
check("dist: half a pixel on the edge, growing away from it on both sides", near(d[20 * W + 20], 0.5) && near(d[20 * W + 25], 5.5, 0.6) && near(d[20 * W + 10], 9.5, 0.6));
const halo = img(W, H, (x) => (x < 30 ? [255, 0, 0] : [0, 0, 255])), soft = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) soft[y * W + x] = x < 28 ? 255 : x < 32 ? 128 : 0;
const dc = PS.decontaminate(halo, soft, W, H, 1, 4), at = (20 * W + 31) * 4;
check("Decontaminate Colors: a half-transparent edge pixel's blue fringe turns towards the inside's red", dc[at] > 100 && dc[at + 2] < 160 && halo[at + 2] === 255, [dc[at], dc[at + 2]]);
const box = img(80, 60, (x, y) => (x >= 20 && x < 60 && y >= 15 && y < 45 ? [230, 230, 230] : [20, 20, 20]));
const wire = PS.liveWire(PS.edgeCost(box, 80, 60), 80, 60, [20, 15], [59, 44], 15);
check("magnetic lasso: the live wire from one corner of a bright box to the opposite one runs ALONG the box's edges (not across it)", wire.length > 60 && wire.every(([x, y]) => x <= 21 || x >= 58 || y <= 16 || y >= 43), wire.length);
const qg = PS.quickGrow(box, 80, 60, 30, 30, 5, 40, 0.3, PS.sobel(PS.gray(box, 80, 60), 80, 60));
let inQ = 0, outQ = 0; for (let y = 0; y < 60; y++) for (let x = 0; x < 80; x++) if (qg[y * 80 + x]) { if (x >= 20 && x < 60 && y >= 15 && y < 45) inQ++; else outQ++; }
check("quick selection: a dab inside the box grows over it and stops at its edges", inQ > 300 && outQ === 0, { inQ, outQ });
const land = img(60, 40, (x, y) => (y < 15 ? [120, 170, 230] : [40 + (x * 7 + y * 13) % 60, 120 + (x * 7 + y * 13) % 60, 40]));
const sky = PS.skyMask(land, 60, 40); let gmax = 0; for (let i = 16 * 60; i < 60 * 40; i++) gmax = Math.max(gmax, sky[i]);
check("Select Sky: the blue top selected, the textured ground not", sky[5 * 60 + 30] === 255 && sky[14 * 60 + 30] > 200 && gmax < 40, { top: sky[5 * 60 + 30], gmax });

/* ---- 2 */
const dst = img(80, 60, () => [100, 100, 100]), src = img(80, 60, (x, y) => (x === 40 && y === 30 ? [230, 230, 230] : [180, 180, 180]));
const pm = new Uint8Array(80 * 60); for (let y = 20; y < 40; y++) for (let x = 30; x < 50; x++) pm[y * 80 + x] = 255;
const pb = R.poisson(dst, src, pm, 80, 60);
check("Poisson: inside the mask the source's detail (a bright dot, +50) on the destination's light (100 around it); outside untouched", near(pb[(25 * 80 + 35) * 4], 100, 1) && near(pb[(30 * 80 + 40) * 4], 150, 2) && pb[(5 * 80 + 5) * 4] === 100, [pb[(25 * 80 + 35) * 4], pb[(30 * 80 + 40) * 4]]);
const stripes = img(80, 60, (x) => ((x >> 2) % 2 ? [220, 220, 220] : [40, 40, 40])), hole = new Uint8Array(80 * 60);
for (let y = 20; y < 40; y++) for (let x = 30; x < 50; x++) { hole[y * 80 + x] = 255; const i = (y * 80 + x) * 4; stripes[i] = 255; stripes[i + 1] = 0; stripes[i + 2] = 0; }
const ca = R.inpaint(stripes, 80, 60, hole, {}); let good = 0;
for (let y = 20; y < 40; y++) for (let x = 30; x < 50; x++) { const i = (y * 80 + x) * 4, want = (x >> 2) % 2 ? 220 : 40; if (Math.abs(ca[i] - want) < 40 && ca[i + 1] === ca[i]) good++; }
check("content-aware fill (PatchMatch): a red hole in vertical stripes is filled with the stripes, in step (≥ 95 %)", good >= 380, good);
const eye = img(60, 60, (x, y) => ((x - 30) ** 2 + (y - 30) ** 2 < 64 ? [220, 30, 40] : [200, 180, 160])), re = R.redEye(eye, 60, 60, 30, 30, {});
check("red eye: the red pupil found from a click (≈ 200 px) and darkened; the skin round it untouched", re.n > 150 && re.n < 260 && re.rgba[(30 * 60 + 30) * 4] < 60 && re.rgba[(5 * 60 + 5) * 4] === 200, re.n);
const bg = img(20, 20, (x) => (x < 10 ? [0, 0, 255] : [255, 255, 0])), nb = R.bgEraseDab(bg, 20, 20, 10, 10, 8, [0, 0, 255], 60, null);
check("background eraser: in the brush, the sampled blue goes transparent, the yellow stays", nb > 50 && bg[(10 * 20 + 5) * 4 + 3] === 0 && bg[(10 * 20 + 15) * 4 + 3] === 255, nb);
const bg2 = img(20, 20, () => [0, 0, 255]); R.bgEraseDab(bg2, 20, 20, 10, 10, 8, [0, 0, 255], 60, [0, 0, 250]);
check("...Protect Foreground Color: that colour is never erased", bg2[(10 * 20 + 10) * 4 + 3] === 255);
const mc = R.mixColor([255, 0, 0], [0, 0, 255], 1, 0.5);
check("mixer brush: wet paint takes half the canvas's colour at Mix 50 %", near(mc[0], 127.5) && near(mc[2], 127.5) && R.mixColor([255, 0, 0], [0, 0, 255], 0, 1)[0] === 255);

/* ---- 3 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, UI = read("ext", "imageeditdock", "pcui.js"), IE = read("ext", "imageeditdock", "imageedit.js"),
  RF = read("ext", "imageeditdock", "pcrefine.js"), HL = read("ext", "imageeditdock", "pcheal.js"), TL = read("ext", "imageeditdock", "pctools.js");
check("ext.json: pcselect, pcretouch (pure) after pcmesh; pcrefine, pcheal after pcwarp; installed", EXT.indexOf("pcselect.js") > EXT.indexOf("pcmesh.js") && EXT.indexOf("pcretouch.js") > EXT.indexOf("pcselect.js")
  && EXT.indexOf("pcrefine.js") > EXT.indexOf("pcwarp.js") && EXT.indexOf("pcheal.js") > EXT.indexOf("pcrefine.js") && EXT.indexOf("pcheal.js") < EXT.indexOf("imageedit.js") && /PCRefine\.install\(E\)/.test(IE) && /PCHeal\.install\(E\)/.test(IE));
check("the tools: L + Magnetic Lasso, W + Quick Selection, J + Patch / Content-Aware Move / Red Eye, B + Mixer Brush, E + Background / Magic Eraser",
  /\["lasso", "Lasso Tool"\], \["poly", "Polygonal Lasso Tool"\], \["maglasso", "Magnetic Lasso Tool"\]/.test(UI) && /\["qsel", "Quick Selection Tool"\]/.test(UI) && /\["patch", "Patch Tool"\], \["cmove", "Content-Aware Move Tool"\], \["redeye", "Red Eye Tool"\]/.test(UI)
  && /\["mixer", "Mixer Brush Tool"\]/.test(UI) && /\["bgerase", "Background Eraser Tool"\], \["magicerase", "Magic Eraser Tool"\]/.test(UI));
check("the menus: Select and Mask (Alt+Ctrl+R), Sky, Save / Load Selection, Channels; Edit ▸ Content-Aware Fill + Fill ▸ Content-Aware",
  /C\("sel\.mask", "Select and Mask…", "Alt\+Ctrl\+R"/.test(RF) && /C\("sel\.sky", "Sky"/.test(RF) && /C\("sel\.save"/.test(RF) && /C\("sel\.load"/.test(RF) && /C\("win\.pcChannels"/.test(RF)
  && /C\("edit\.cafill", "Content-Aware Fill…"/.test(HL) && /<option value="ca">Content-Aware<\/option>/.test(UI));
check("the core: channels (saved selections) undo with the layers and clear on open; a tool's after(stroke) hook (the healing brush's Poisson pass); pctools' dab helpers shared",
  /channels: \(S\.channels \|\| \[\]\)\.map/.test(IE) && /S\.channels = \[\];/.test(IE) && /if \(TT && TT\.after\) \{ try \{ TT\.after\(L, d, rect, px\); \}/.test(IE) && /E\.dab = \{ dabTool, pixelDab, weights, rangeOpt, bindRange/.test(TL) && /T\.heal\.after = healAfter/.test(HL));
check("the Channels tab between Paths and History", /tab\("layers", "pcPaths", "Paths"\)\}\$\{tab\("layers", "pcChannels", "Channels"\)\}\$\{tab\("layers", "pcHistory", "History"\)\}/.test(IE));
check("server.js untouched", !/pcselect|pcretouch|pcrefine|pcheal/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
