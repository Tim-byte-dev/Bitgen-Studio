#!/usr/bin/env node
/* bitGen Studio — 2.422.0 units: SMART OBJECTS + SMART FILTERS, SKEW / DISTORT / PERSPECTIVE / WARP, PUPPET WARP,
 * CONTENT-AWARE SCALE, LIQUIFY (gaps 2 + 3 of the Photoshop list)
 *   1. pcmesh.js: homographies, the warp patch + presets, meshes, triangle maps
 *   2. puppet warp: MLS rigid deformation
 *   3. content-aware scale: seams, shrinking / growing, a protect mask
 *   4. liquify: push, twirl, pucker, bloat, reconstruct, frozen areas, applying a field
 *   5. pcsmart.js: transforms / smart filters moved by a matrix
 *   6. the wiring: ext.json, pcdoc (DEEP, the filter mask, isLive, rasterize), imageedit (the filter mask as a pixel
 *      target, the move tool), pcui hooks, the menus
 * Tim: "can we close the gap with 1,2,3,4 and 5 first" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const X = require(path.join(ROOT, "ext", "imageeditdock", "pcmesh.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
const nearP = (p, q, e) => near(p[0], q[0], e) && near(p[1], q[1], e);

/* ---- 1 */
const Q4 = [[10, 10], [110, 20], [100, 120], [0, 100]], H = X.homography(X.UNIT, Q4);
check("homography: the unit square's corners land on the quad; invertH takes them back", X.UNIT.every((u, i) => nearP(X.applyH(H, u[0], u[1]), Q4[i], 1e-6)) && nearP(X.applyH(X.invertH(H), 100, 120), [1, 1], 1e-9));
const par = X.rectQuad(10, 20, 100, 50).map(([x, y]) => [x + y * 0.3, y]);
check("isAffineQuad: a sheared rectangle is, a perspective quad is not; affineOfQuad = the canvas matrix", X.isAffineQuad(par) && !X.isAffineQuad(Q4)
  && JSON.stringify(X.affineOfQuad(X.rectQuad(10, 20, 100, 50), 50, 25)) === "[2,0,0,2,10,20]");
const Pq = X.patchFromQuad(par);
check("patchFromQuad: on a parallelogram the patch IS the quad (every point), on a perspective quad its corners",
  [[0.2, 0.3], [0.5, 0.5], [0.9, 0.1]].every(([u, v]) => nearP(X.patchPoint(Pq, u, v), X.applyH(X.homography(X.UNIT, par), u, v), 1e-9))
  && [[0, 0], [1, 0], [1, 1], [0, 1]].every((u, i) => nearP(X.patchPoint(X.patchFromQuad(Q4), u[0], u[1]), Q4[i], 1e-9)));
const arc = X.patchPreset(X.rectQuad(0, 0, 300, 100), "arc", 50), flat = X.patchPreset(X.rectQuad(0, 0, 300, 100), "custom", 0);
check("warp presets: Arc 50 lifts the top middle by a quarter of the height and keeps the corners; Custom = the quad", near(X.patchPoint(arc, 0.5, 0)[1], -18.75, 1e-6) === false && X.patchPoint(arc, 0.5, 0)[1] < -15
  && nearP(X.patchPoint(arc, 0, 0), [0, 0], 1e-9) && nearP(X.patchPoint(arc, 1, 1), [300, 100], 1e-9) && nearP(X.patchPoint(flat, 0.5, 0.5), [150, 50], 1e-9) && X.WARP_STYLES.length === 17,
  X.patchPoint(arc, 0.5, 0));
const mq = X.quadMesh(Q4, 8), mp = X.patchMesh(arc, 10);
check("meshes: (n+1)² points, src in 0..1, dst through the quad / the patch", mq.src.length === 81 && mp.dst.length === 121 && nearP(mq.dst[80], Q4[2], 1e-6) && nearP(mq.src[40], [0.5, 0.5]));
const at = X.affineTri([0, 0], [10, 0], [0, 10], [5, 5], [25, 5], [5, 35]), ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
check("affineTri: the canvas matrix taking a triangle onto another (each vertex onto its partner)", nearP(ap(at, 10, 0), [25, 5]) && nearP(ap(at, 0, 10), [5, 35]) && nearP(ap(at, 0, 0), [5, 5]));

/* ---- 2 */
const r90 = X.mlsRigid([[0, 0], [10, 0]], [[0, 0], [0, 10]], [5, 5]);
check("MLS rigid: two pins turned 90° turn the point with them; a pin's own place goes to its target; still pins = no change; one pin = a move",
  nearP(r90, [-5, 5], 1e-9) && nearP(X.mlsRigid([[0, 0], [10, 0]], [[3, 4], [10, 0]], [0, 0]), [3, 4]) && nearP(X.mlsRigid([[0, 0], [10, 0], [0, 10]], [[0, 0], [10, 0], [0, 10]], [3, 4]), [3, 4], 1e-9)
  && nearP(X.mlsRigid([[2, 2]], [[5, 7]], [10, 10]), [13, 15]), r90);
const box = { x: 0, y: 0, w: 100, h: 50 }, pm0 = X.puppetMesh(box, [{ x: 10, y: 25, X: 10, Y: 25 }, { x: 90, y: 25, X: 90, Y: 25 }], 10);
const pm1 = X.puppetMesh(box, [{ x: 10, y: 25, X: 10, Y: 25 }, { x: 50, y: 25, X: 50, Y: 25 }, { x: 90, y: 25, X: 90, Y: 45 }], 10);
check("puppetMesh: still pins = the plain grid; the right pin pulled down bends the right end down, the left end stays", pm0.dst.every((p, k) => nearP(p, [pm0.src[k][0] * 100, pm0.src[k][1] * 50], 1e-6))
  && pm1.dst[5 * 11 + 10][1] > 40 && Math.abs(pm1.dst[5 * 11 + 1][1] - 25) < 3);

/* ---- 3 */
const W = 60, Hh = 20, img = new Uint8ClampedArray(W * Hh * 4);
const tex = (x, y) => ((x * 37 + y * 91) % 255);
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, inB = (x >= 5 && x < 15) || (x >= 45 && x < 55); img[i] = inB ? tex(x, y) : 128; img[i + 1] = inB ? 255 - tex(x, y) : 128; img[i + 2] = 128; img[i + 3] = 255; }
const E0 = X.energy(img, W, Hh), sm = X.seam(E0, W, Hh);
check("energy + seam: the cheapest seam keeps out of both textured blocks (it runs through the flat grey)", Array.from(sm).every((x) => !(x >= 4 && x <= 15) && !(x >= 44 && x <= 55)), Array.from(sm));
const blockCols = (d, w) => { let n = 0; for (let x = 0; x < w; x++) { let tx = 0; for (let y = 0; y < Hh; y++) { const i = (y * w + x) * 4; if (d[i] !== 128 || d[i + 1] !== 128) tx++; } if (tx > Hh / 2) n++; } return n; };
const nar = X.carve(img, W, Hh, 40, Hh), wid = X.carve(img, W, Hh, 80, Hh);
check("carve narrower (60 -> 40): both textured blocks kept whole (20 columns of texture), only the grey went", nar.length === 40 * Hh * 4 && blockCols(nar, 40) === 20, blockCols(nar, 40));
check("carve wider (60 -> 80): the grey doubled, the blocks still 20 columns", wid.length === 80 * Hh * 4 && blockCols(wid, 80) === 20, blockCols(wid, 80));
const tall = X.carve(img, W, Hh, W, 30);
check("carve taller (20 -> 30 rows) through the transpose", tall.length === W * 30 * 4);
const flatImg = new Uint8ClampedArray(W * Hh * 4).fill(128), prot = new Uint8Array(W * Hh);
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; flatImg[i + 3] = 255; if (x >= 20 && x < 30) { flatImg[i] = 255; prot[y * W + x] = 255; } }
const pc = X.carve(flatImg, W, Hh, 30, Hh, prot); let reds = 0; for (let i = 0; i < pc.length; i += 4) if (pc[i] === 255) reds++;
check("...a PROTECT mask keeps a flat red block whole (it would go first without it)", reds === 10 * Hh, reds);

/* ---- 4 */
const F = X.field(40, 40);
X.liq(F, "push", 20, 20, 8, 1, 4, 0);
const [pdx] = X.sampleF(F, 20, 20);
check("liquify push: under the brush each pixel now shows what was BEHIND it along the drag (dx = -4 at the centre), none outside", near(pdx, -4, 1e-6) && X.sampleF(F, 2, 2)[0] === 0, pdx);
const dot = new Uint8ClampedArray(40 * 40 * 4); for (let i = 3; i < dot.length; i += 4) dot[i] = 255; dot[(20 * 40 + 16) * 4] = 255;
const moved = X.applyField(dot, 40, 40, F);
check("applyField: the red dot at (16, 20) shows at (20, 20) after the push", moved[(20 * 40 + 20) * 4] > 200 && moved[(20 * 40 + 16) * 4] < 60, [moved[(20 * 40 + 20) * 4], moved[(20 * 40 + 16) * 4]]);
X.liq(F, "reconstruct", 20, 20, 8, 1, 0, 0); const half = X.sampleF(F, 20, 20)[0];
for (let k = 0; k < 4; k++) X.liq(F, "reconstruct", 20, 20, 8, 1, 0, 0);
check("reconstruct paints it back gradually (half per full-pressure dab at the centre, gone after a few)", near(half, -2, 1e-6) && Math.abs(X.sampleF(F, 20, 20)[0]) < 0.2, half);
const T2 = X.liq(X.field(40, 40), "twirl", 20, 20, 10, 1, 0, 0), Pk = X.liq(X.field(40, 40), "pucker", 20, 20, 10, 1, 0, 0), Bl = X.liq(X.field(40, 40), "bloat", 20, 20, 10, 1, 0, 0);
check("twirl turns round the centre, pucker samples farther out (content pulled in), bloat nearer (pushed out)", X.sampleF(T2, 25, 20)[1] !== 0 && X.sampleF(Pk, 25, 20)[0] > 0 && X.sampleF(Bl, 25, 20)[0] < 0);
const fr = new Uint8Array(40 * 40).fill(255), Fz = X.liq(X.field(40, 40), "push", 20, 20, 8, 1, 4, 0, fr);
check("a FROZEN area does not move", Fz.dx.every((v) => v === 0));
const fo = X.fieldIn(X.fieldOut(F));
check("a field to / from plain numbers", fo.w === 40 && fo.dx.length === 1600 && near(fo.dx[20 * 40 + 20], Math.round(F.dx[20 * 40 + 20] * 10) / 10, 1e-6));

/* ---- 5 */
const SM = require(path.join(ROOT, "ext", "imageeditdock", "pcsmart.js"));
const t = SM.mapT({ quad: X.rectQuad(10, 10, 100, 50), warp: null }, [0.5, 0, 0, 0.5, 0, 0]);
const fl = SM.mapFilters([{ id: "puppet", pins: [{ x: 10, y: 10, X: 20, Y: 20 }], box: { x: 0, y: 0, w: 100, h: 100 } }, { id: "liquify", field: "x", box: { x: 0, y: 0, w: 600, h: 400 } }, { id: "gaussian", params: {} }], [1, 0, 0, 1, -50, 30]);
check("smart objects: Image Size / crop move the transform (quad x 0.5) and the puppet pins / liquify box (not the source)", JSON.stringify(t.quad[2]) === "[55,30]"
  && fl[0].pins[0].X === -30 && fl[0].pins[0].y === 40 && fl[0].box.x === -50 && fl[1].box.y === 30 && fl[1].field === "x");

/* ---- 6 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, DOC = read("ext", "imageeditdock", "pcdoc.js"), IE = read("ext", "imageeditdock", "imageedit.js"),
  UI = read("ext", "imageeditdock", "pcui.js"), SMJ = read("ext", "imageeditdock", "pcsmart.js"), WJ = read("ext", "imageeditdock", "pcwarp.js");
check("ext.json: pcmesh after pcpath; pcsmart, pcwarp after pcpen, before imageedit.js; installed in that order", EXT.indexOf("pcmesh.js") > EXT.indexOf("pcpath.js") && EXT.indexOf("pcmesh.js") < EXT.indexOf("pctools.js") && EXT.indexOf("pcsmart.js") > EXT.indexOf("pcpen.js")
  && EXT.indexOf("pcwarp.js") === EXT.indexOf("pcsmart.js") + 1 && EXT.indexOf("pcwarp.js") < EXT.indexOf("imageedit.js") && IE.indexOf("PCSmart.install(E)") < IE.indexOf("PCWarp.install(E)"));
check("pcdoc: smart settings undo (DEEP), the filter mask is kept like the mask, isLive (text / shape / fill / smart), a smart layer is drawn by PCSmart",
  /const DEEP = \[[^\]]*"smart"[^\]]*\]/.test(DOC) && /s\.fmask = L\.fmask \|\| null;/.test(DOC) && /L\.fmask = s\.fmask \|\| null;/.test(DOC) && /const isLive = \(L\) => !!L && \(L\.type === "text" \|\| L\.type === "shape" \|\| L\.type === "fill" \|\| L\.type === "smart"( \|\| L\.type === "sketch")?\);/.test(DOC)
  && /if \(L\.type === "smart"\) \{ if \(L\.smart && root\.PCSmart\) root\.PCSmart\.render\(L\); return; \}/.test(DOC));
check("imageedit: the FILTER mask is a paint target (whichOf, beginPx / endPx / undo re-render the smart object), live layers via D.isLive, the move tool moves a smart object's transform",
  /const whichOf = \(L\) => \(S\.qm \? "qm" : onMask\(L\) \? \(S\.fmaskEdit && L\.fmask \? "fmask" : "mask"\) : null\);/.test(IE) && /if \(isF\) \{ L\.fmask\.ver = \(L\.fmask\.ver \|\| 0\) \+ 1; D\.rasterize\(L\); \}/.test(IE)
  && /if \(e\.fmask && e\.L\.fmask\) \{ e\.L\.fmask\.ver = \(e\.L\.fmask\.ver \|\| 0\) \+ 1; D\.rasterize\(e\.L\); \}/.test(IE) && (IE.match(/D\.isLive\(L\)/g) || []).length >= 4 && /E\.smartShift\(L, dx, dy\)/.test(IE)
  && !/S\.qm \? "qm" : onMask\(L\) \? "mask" : null/.test(IE));
check("pcui: the smart object's thumbnail (▣, double-click = Edit Contents), the Smart Filters rows hook, Properties hooks, Rasterize + Free Transform on it",
  /if \(Ly\.type === "smart" && E\.smartEdit\) return E\.smartEdit\(Ly\);/.test(UI) && /E\.ui\.layerExtra\(Ly, i, row, box\)/.test(UI) && /E\.ui\.smartProps\(A\)/.test(UI) && /\/\^\(text\|shape\|fill\|smart\)\$\//.test(UI)
  && /isPixel\(\) \|\| \(hasL\(\) && L\(\)\.type === "smart"\)/.test(UI));
check("the menus: Layer ▸ Smart Objects (convert, via copy, edit / replace / export contents, to layers, rasterize), Filter ▸ Convert for Smart Filters / Liquify (Shift+Ctrl+X), Edit ▸ Transform: Skew / Distort / Perspective / Warp, Puppet Warp, Content-Aware Scale",
  ["so.convert", "so.copy", "so.edit", "so.replace", "so.export", "so.layers", "so.raster", "so.smartfilters"].every((c) => SMJ.includes(`C("${c}"`))
  && ["xf.skew", "xf.distort", "xf.perspective", "xf.warp", "xf.puppet", "xf.cas", "flt.liquify"].every((c) => WJ.includes(`C("${c}"`)) && /"Liquify…", "Shift\+Ctrl\+X"/.test(WJ));
check("smart filters: Filter / Adjustments / Ctrl+F on a smart object ADD a filter (E.openFilter / repeatFilter / applyFilter wrapped), each with on / off, settings, opacity (2.434.0: + a blend mode - Blending Options), order, delete, one filter mask",
  /E\.openFilter = function \(id, again\) \{ const L = smartTarget\(\); if \(L\) return smartFilter\(L, id, again\);/.test(SMJ) && /E\.repeatFilter = function/.test(SMJ) && /E\.applyFilter = function/.test(SMJ)
  && /Smart filter mask - click to paint on it/.test(SMJ) && /"delete smart filter"/.test(SMJ) && /"smart filter order"/.test(SMJ) && /"smart filter (opacity|blending)"/.test(SMJ));
check("server.js untouched", !/pcsmart|pcwarp|pcmesh/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
