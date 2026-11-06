#!/usr/bin/env node
/* bitGen Studio — 2.695.0: ROOF COVERINGS - ext/pushpulldock/ppstruct.js ROOFMATS / roofMat / roofLoadOf / roofPattern; pparch roof.mat
 * (clean, the covering's colour, its pattern lines); the framing + lintel checks by the covering's weight; the roof panel's
 * Covering (+ the minimum pitch note); ✨ Photo's words (ppreal.js). The browser: scripts/test-ui695-ui.js.
 * Tim (verbatim): "can we add roof material types like colourbond, concrete tiles , etc" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static", "vendor", "polygon-clipping.umd.min.js"));
const S = require(path.join(ROOT, "ext", "pushpulldock", "ppstruct.js"));
const P = require(path.join(ROOT, "ext", "pushpulldock", "pparch.js"));
const H = P.structH;
const M = S.ROOFMATS, keys = Object.keys(M);
check("8 coverings: pre-painted steel (corrugated, ribbed, standing seam), concrete + terracotta tiles, slate, shingles, polycarbonate - each with a weight class, a typical minimum pitch, a colour, a pattern, words",
  keys.length === 8 && ["steel-corr", "steel-rib", "steel-seam", "tile-concrete", "tile-terracotta", "slate", "shingle", "polycarb"].every((k) => M[k]) && keys.every((k) => /^(sheet|tile)$/.test(M[k].load) && M[k].min > 0 && /^#[0-9a-f]{6}$/.test(M[k].col) && /^(down|courses)$/.test(M[k].pat) && M[k].words));
check("generic names only - no brand names in what the user sees (the app's rule)", !/colorbond|colourbond|monier|bristile|lysaght|klip|trimdek|zincalume/i.test(JSON.stringify(M)) && !/"[^"\n]*colou?rbond[^"\n]*"/i.test(fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8")));
const model = (mat, pitch) => { const A = P.empty(), R = P.addRoom(A, P.rectPts([0, 0], [8, 5]), true); P.addOp(A, "window", { room: R.id, edge: 0, at: 3 }, { w: 1.8 }); const rf = P.addRoof(A, [R.id], { type: "hip", pitch: pitch || 22, mat }); return { A, R, rf }; };
const plain = model(""), tile = model("tile-terracotta"), sheet = model("steel-corr");
check("clean keeps a known covering, drops an unknown one", P.clean(JSON.parse(JSON.stringify(tile.A))).roofs[0].mat === "tile-terracotta" && P.clean(JSON.parse(JSON.stringify(Object.assign({}, tile.A, { roofs: [Object.assign({}, tile.rf, { mat: "gold" })] })))).roofs[0].mat === "");
const col = (m) => (P.build(m.A).polys.find((p) => p.tag && p.tag.ak === "roof") || {}).col;
check("the covering's own colour while the roof's colour is the default; a colour picked wins", col(tile) === M["tile-terracotta"].col && col(plain) === P.DEF.roof && (() => { tile.rf.col = "#123456"; const c = col(tile); tile.rf.col = P.DEF.roof; return c === "#123456"; })());
const lines = (m) => P.build(m.A).roofLines.length;
check("its pattern on the roof: sheets = lines down the slope (more for tighter ribs), tiles = courses + joints (many more); no covering = the plain edges only",
  lines(sheet) > lines(plain) + 50 && lines(model("steel-seam")) < lines(sheet) && lines(tile) > lines(sheet) && lines(model("shingle")) > lines(tile));
const out = []; const Q = [[0, 0, 3], [4, 0, 3], [4, 2, 4], [0, 2, 4]], Pw = (x, y, z) => [x, y, z]; const k = S.roofPattern(Q, 0.1, "steel-corr", Pw, out);
check("roofPattern: lines on the face's TOP (its underside + the thickness), down the slope, inside the face", k > 20 && out.every(([a, b]) => Math.abs(a[0] - b[0]) < 1e-9 && a[2] >= 3.1 - 1e-6 && b[2] <= 4.1 + 0.01 && a[1] >= -1e-9 && b[1] <= 2 + 1e-9));
check("the weight: tiles / slate = heavy, sheets / shingles = light; no covering = the model's Roof covering setting", S.roofLoadOf(tile.A, tile.rf) === "tile" && S.roofLoadOf(sheet.A, sheet.rf) === "sheet" && S.roofLoadOf(plain.A, plain.rf) === "sheet" && S.roofLoadOf(Object.assign({}, plain.A, { struct: S.cleanStruct({ roof: "tile" }) }), plain.rf) === "tile");
const rT = S.roofFrames(tile.A, tile.rf, H).checks.rafter, rS = S.roofFrames(sheet.A, sheet.rf, H).checks.rafter;
check("the rafters' check carries the covering's weight (tiles use more of the limit)", rT.util > rS.util * 1.5, [rT.util, rS.util]);
const lT = S.lintel(tile.A, tile.A.ops[0], H), lS = S.lintel(sheet.A, sheet.A.ops[0], H);
check("…and the lintel under a tiled roof is heavier-loaded (a bigger or equal auto size)", lT.g > lS.g && lT.m.D * lT.m.n >= lS.m.D * lS.m.n);
const T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8"), RL = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"), "utf8");
check("wired: the roof fields' Covering (+ the minimum pitch note, check the maker's), the Roof tool keeps it, ✨ Photo names it",
  /selIn\("Covering"/.test(T) && /usually needs at least/.test(T) && /Check the maker's minimum/.test(T) && /mat: r\.mat \|\| ""/.test(T) && /RM\[r\.mat\]\.words/.test(RL));
global.window = globalThis; globalThis.PPStruct = S; const Real = require(path.join(ROOT, "ext", "pushpulldock", "ppreal.js"));
const w = Real.sceneWords ? Real.sceneWords(tile.A, [], {}) : null;
check("✨ Photo's scene words: \"a hip roof of terracotta roof tiles\"", w && w.parts.some((x) => x === "a hip roof of terracotta roof tiles"), w && w.parts);
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
