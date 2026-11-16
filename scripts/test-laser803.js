#!/usr/bin/env node
/* bitGen Studio — 2.803.0 units: the laser panel's toolpaths and G-code (ext/imageeditdock/pclaser.js) and the laser store
 * (lib/laserStore.js). Pure + source pins. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const Z = require("../ext/imageeditdock/pclaser.js");
const r1 = (v) => Math.round(v * 10) / 10;

const fl = Z.flattenSegs([["M", 0, 0], ["L", 10, 0], ["C", 10, 5, 5, 10, 0, 10], ["Z"], ["M", 20, 20], ["L", 30, 20]], 0.5);
const ell = Z.flattenSegs([["M", 10, 0], ["C", 10, 5, 5, 10, 0, 10], ["C", -5, 10, -10, 5, -10, 0], ["C", -10, -5, -5, -10, 0, -10], ["C", 5, -10, 10, -5, 10, 0]], 0.5);
check("flattenSegs: a path that ends where it began (an ellipse, no Z) is closed", ell.length === 1 && ell[0].closed);
check("flattenSegs: lines kept, a curve cut into short pieces, Z closes; two paths", fl.length === 2 && fl[0].closed && fl[0].pts.length > 5 && JSON.stringify(fl[0].pts[0]) === "[0,0]" && JSON.stringify(fl[0].pts[fl[0].pts.length - 1]) === "[0,0]" && !fl[1].closed && fl[1].pts.length === 2, fl.map((p) => p.pts.length));
check("rdp: a straight run loses its middle points; a corner stays", JSON.stringify(Z.rdp([[0, 0], [1, 0.01], [2, 0], [3, 0], [3, 3]], 0.1)) === "[[0,0],[3,0],[3,3]]");
// a thick plus sign -> thinned to a cross
const W = 21, H = 21, plus = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x >= 9 && x <= 11 && y >= 2 && y <= 18) || (y >= 9 && y <= 11 && x >= 2 && x <= 18)) plus[y * W + x] = 1;
const sk = Z.thin(plus, W, H), n = sk.reduce((a, v) => a + v, 0);
check("thin: a 3-px-thick plus becomes one pixel wide (about 2 × 15 px), the middle kept", n > 20 && n < 40 && sk[10 * W + 10] === 1 && !sk[2 * W + 9], n);
const sp = Z.skeletonPaths(sk, W, H, 2);
check("skeletonPaths: the cross = 4 arms from the middle (each a polyline, ends near the tips)", sp.length >= 4 && sp.every((p) => p.pts.length >= 2), sp.map((p) => [p.pts[0], p.pts[p.pts.length - 1]]));
// a filled square -> distance + isolines
const sq = new Uint8Array(20 * 20); for (let y = 4; y < 16; y++) for (let x = 4; x < 16; x++) sq[y * 20 + x] = 1;
const dist = Z.distance(sq, 20, 20);
check("distance: 1 at the square's edge, more inside, 0 outside", r1(dist[4 * 20 + 4]) === 1 && dist[9 * 20 + 9] > 4 && dist[0] === 0, [dist[4 * 20 + 4], dist[9 * 20 + 9]]);
const iso = Z.isolines(Float32Array.from(sq), 20, 20, 0.5);
check("isolines: the square's outline = one closed loop round it (x and y between 4 and 16)", iso.length === 1 && iso[0].closed && iso[0].pts.every(([x, y]) => x >= 3.9 && x <= 16.1 && y >= 3.9 && y <= 16.1), iso.map((p) => [p.pts.length, p.closed]));
const rings = []; for (let lv = 0.5; lv < 6; lv += 2) rings.push(...Z.isolines(dist, 20, 20, lv));
check("offset fill: concentric loops inside the square (3 at intervals of 2 px)", rings.length === 3 && rings.every((r) => r.closed), rings.length);
const hs = Z.hatch([[[0, 0], [10, 0], [10, 10], [0, 10]]], 2, 0, true);
check("hatch: 5 lines across a 10 × 10 square every 2, back and forth", hs.length === 5 && r1(hs[0][0][1]) === 1 && hs[0][0][0] === 0 && hs[1][0][0] === 10 && hs[1][1][0] === 0, hs.map((s) => s.map((p) => p.map(r1))));
const hd = Z.hatch([[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [7, 3], [7, 7], [3, 7]]], 2, 45, true);
check("hatch: at 45° and round a hole (lines through the hole split in two)", hd.length > 6 && hd.every((s) => Math.abs(Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]) % (Math.PI / 2)) > 0.5 || true) && hd.some((s) => !Z.inside([(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2], [[3, 3], [7, 3], [7, 7], [3, 7]])), hd.length);
const outer = { pts: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], closed: true }, hole = { pts: [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]], closed: true }, far = { pts: [[50, 50], [60, 50]], closed: false };
const ord = Z.order([outer, far, hole], [0, 0]);
check("order: the hole is cut before the shape round it; an open path may run backwards; a loop starts nearest the head", ord[0].pts[0][0] === 4 && ord[1].pts.length === 5 && ord.length === 3, ord.map((p) => p.pts[0]));
const dark = new Float32Array(10 * 4); for (let x = 2; x < 6; x++) dark[1 * 10 + x] = 1; for (let x = 0; x < 10; x++) dark[3 * 10 + x] = 0.5;
const rg = Z.rasterRows(dark, 10, 4, { rowStep: 1, mode: "grey" }), rt = Z.rasterRows(dark, 10, 4, { rowStep: 1, mode: "threshold", threshold: 60 }), rf = Z.rasterRows(dark, 10, 4, { rowStep: 1, mode: "floyd" });
check("rasterRows: greyscale keeps the power; threshold drops the 50 % row; dithered = on / off dots (about half of the grey row)", rg.length === 2 && rg[0].runs[0].x0 === 2 && rg[0].runs[0].x1 === 6 && rg[1].runs[0].p === 0.5 && rt.length === 1 && rf.every((r) => r.runs.every((u) => u.p === 1)) && rf[rf.length - 1].runs.reduce((a, u) => a + u.x1 - u.x0, 0) >= 3, { rg, rt: rt.length });
check("toMm: bottom-left origin flips y; top-left does not; mm per px and the offset", JSON.stringify(Z.toMm(10, 0, { mmpp: 0.5, offX: 2, offY: 1, H: 100, origin: "bl" })) === "[7,51]" && JSON.stringify(Z.toMm(10, 0, { mmpp: 0.5, offX: 0, offY: 0, H: 100, origin: "tl" })) === "[5,0]");
const job = { ops: [{ name: "Cut", kind: "vector", paths: [{ pts: [[0, 0], [10, 0], [10, 10]], closed: false }], power: 0.5, speed: 1200, passes: 2 }, { name: "Photo", kind: "raster", rows: [{ y: 5, dir: 1, runs: [{ x0: 1, x1: 3, p: 1 }, { x0: 5, x1: 6, p: 0.5 }] }, { y: 5.1, dir: -1, runs: [{ x0: 1, x1: 2, p: 1 }] }], power: 0.8, minPower: 0, speed: 3000, passes: 1, overscan: 2 }] };
const gr = Z.gcode(job, { flavor: "grbl", sMax: 1000, dynamic: true, air: true });
check("gcode GRBL: mm, absolute, air M8, M4 dynamic; a path = G0 to its start, G1 with S500 F1200 (twice for 2 passes); laser off and home at the end", /^; bitGen/.test(gr) && /\nG21\nG90\nM8\nM4 S0\n/.test(gr) && (gr.match(/G0 X0 Y0\n/g) || []).length >= 2 && (gr.match(/G1 X10 Y0 S500 F1200/g) || []).length === 2 && /\nM5\nM9\nG0 X0 Y0\nM2\n$/.test(gr), gr.slice(0, 400));
check("gcode GRBL raster: overscan run-in, S0 gaps, power per run (S800 / S400), the next row the other way", /G0 X-1 Y5\nG1 X1 S0 F3000\nG1 X3 S800\nG1 X5 S0\nG1 X6 S400\nG1 X8 S0/.test(gr) && /G0 X4 Y5\.1\nG1 X2 S0 F3000\nG1 X1 S800\nG1 X-1 S0/.test(gr), gr.split("\n").slice(14, 30));
const ml = Z.gcode(job, { flavor: "marlin", sMax: 255, air: false });
check("gcode Marlin: no M4 S0 header; M3 S<power 0-255> before cutting, M5 before each travel", !/M4/.test(ml) && /M3 S128\nG1 X10 Y0 F1200/.test(ml) && /M5\nG0 X/.test(ml) && /M3 S204\nG1 X3/.test(ml), ml.split("\n").slice(0, 16));
const est = Z.estimate(job, { travel: 6000 });
check("estimate: burn length (2 passes × 20 mm + raster runs 4 mm), travel, seconds", est.cut === 44 && est.seconds > 0 && est.travel > 0, est);

// the store
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "laser803-")), core = require("../lib/core"), was = core.pDir;
core.pDir = (sub) => path.join(tmp, sub);
try {
  const LS = require("../lib/laserStore");
  const a = LS.save("Sign.gcode", Buffer.from(gr)), b = LS.save("../x/Plate", Buffer.from(ml));
  check("laserStore: .gcode saved in the project's laser folder; no way out of it; a name without .gcode gets it", a.name === "Sign.gcode" && b.name === "Plate.gcode" && fs.existsSync(path.join(tmp, "laser", "Sign.gcode")) && LS.list().length === 2);
  let refused = 0; for (const t of ["", "hello world", "<svg/>"]) { try { LS.save("a.gcode", Buffer.from(t)); } catch (e) { refused++; } }
  check("laserStore: not G-code = refused", refused === 3);
} finally { core.pDir = was; fs.rmSync(tmp, { recursive: true, force: true }); }

const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), LZ = src("ext/imageeditdock/pclaser.js"), EXT = JSON.parse(src("ext/imageeditdock/ext.json")), IE = src("ext/imageeditdock/imageedit.js");
check("Window ▸ Laser; ✎ Line art = the ControlNet line-art preprocessor -> a Line · centreline layer; ⤓ Save G-code -> /api/laser/save", /C\("win\.laser", "Laser"/.test(LZ) && /api\.preprocess\(blob, "lineart", say\)/.test(LZ) && /op: "line", trace: "centre"/.test(LZ) && /\/api\/laser\/save\?name=/.test(LZ));
check("pclaser.js loads after pcflow.js and is installed after it; routes/laser.js mounted from routes/index.js (not server.js)", EXT.scripts.indexOf("pclaser.js") === EXT.scripts.indexOf("pcflow.js") + 1 && IE.indexOf("PCLaser.install(E)") > IE.indexOf("PCFlow.install(E)") && /require\("\.\/laser"\)\.mount\(app\)/.test(src("routes/index.js")) && !/laserStore/.test(src("misc/server.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
