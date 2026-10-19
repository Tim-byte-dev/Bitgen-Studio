#!/usr/bin/env node
/* bitGen Studio — 2.450.0 units: THE WARP GRID + SPLIT LINES and the LIQUIFY EXTRAS (ext/imageeditdock/pcmesh.js maths,
 * pcwarp.js / pcsmart.js wiring): an exact split (the picture does not move), a split taken away, Photoshop's grid,
 * an anchor's handles, a drag's weights, the gridded mesh; liquify's Smooth / Push Left; Face-Aware Liquify's field. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const X = require(path.join(ROOT, "ext", "imageeditdock", "pcmesh.js"));
const P = X.patchPreset([[0, 0], [100, 0], [100, 50], [0, 50]], "arc", 60);
const dist = (A, GA, B, GB) => { let m = 0; for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const a = X.latPoint(A, GA, i / 12, j / 12), b = X.latPoint(B, GB, i / 12, j / 12); m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1])); } return m; };

const s1 = X.latSplit(P, null, "v", 0.3), s2 = X.latSplit(s1.P, s1.G, "h", 0.6);
check("latSplit: a vertical then a horizontal split line - 2 x 2 patches (7 x 7 points), knots where asked, the warp's shape EXACTLY the same",
  s2.P.length === 49 && JSON.stringify(s2.G) === '{"c":2,"r":2,"us":[0,0.3,1],"vs":[0,0.6,1]}' && dist(P, null, s2.P, s2.G) < 1e-9, { G: s2.G, d: dist(P, null, s2.P, s2.G) });
check("latSplit: on an existing line or the edge = nothing", X.latSplit(s2.P, s2.G, "v", 0.3).P.length === 49 && X.latSplit(P, null, "h", 0).P.length === 16);
const u1 = X.latUnsplit(s2.P, s2.G, "h", 1), u2 = X.latUnsplit(u1.P, u1.G, "v", 1);
check("latUnsplit: the split lines taken away again - back to the single patch (its handles stretched back exactly), G null", u2.G === null && u2.P.length === 16 && u2.P.every((p, k) => Math.hypot(p[0] - P[k][0], p[1] - P[k][1]) < 1e-9));
const g3 = X.latGrid(P, null, 3, 3), g2 = X.latGrid(g3.P, g3.G, 2, 4);
check("latGrid (Photoshop's Grid menu): 3 x 3 = 10 x 10 points at thirds, same shape; then 2 x 4 (custom) - the old lines that are not on it go",
  g3.P.length === 100 && Math.abs(g3.G.us[1] - 1 / 3) < 1e-9 && dist(P, null, g3.P, g3.G) < 1e-9 && g2.G.c === 2 && g2.G.r === 4 && g2.P.length === 7 * 13 && JSON.stringify(g2.G.us) === "[0,0.5,1]", { g3: g3.G, g2: g2.G });
check("latCorners / latNear: the outer corners of any grid; an anchor (where lines cross) brings its handles, a handle alone none; the single patch = the old corner rule",
  JSON.stringify(X.latCorners(g3.P, g3.G)) === JSON.stringify([P[0], P[3], P[15], P[12]]) && JSON.stringify(X.latNear(g3.G, 3)) === "[2,4,13]" && X.latNear(g3.G, 4).length === 0
  && JSON.stringify(X.latNear(null, 0)) === "[1,4]" && JSON.stringify(X.latNear(null, 15)) === "[14,11]");
const w = X.latWeights(s2.G, 0.8, 0.2); let n = 0, sw = 0; w.forEach((v) => { if (v) n++; sw += v; });
check("latWeights: a drag inside bends only the patch under it (16 weights, summing to 1)", n <= 16 && n >= 9 && Math.abs(sw - 1) < 1e-9 && w[0] === 0, { n, sw });
const m = X.meshOf({ quad: X.latCorners(s2.P, s2.G), warp: s2.P, wgrid: s2.G });
check("meshOf: a gridded warp (t.wgrid) draws through its lattice (finer: 48 x 48)", m.n === 48 && Math.hypot(m.dst[0][0] - P[0][0], m.dst[0][1] - P[0][1]) < 1e-9 && m.dst.length === 49 * 49, m.n);

// liquify: Push Left and Smooth
const f = X.field(60, 60); X.liq(f, "pushleft", 30, 30, 12, 1, 0, -3, null);
check("liq pushleft: dragged UP, the pixels go LEFT (the field takes them from the right: dx > 0, dy ~ 0); s < 0 (Alt) = right", f.dx[30 * 60 + 30] > 2 && Math.abs(f.dy[30 * 60 + 30]) < 1e-6
  && (() => { const g = X.field(60, 60); X.liq(g, "pushleft", 30, 30, 12, -1, 0, -3, null); return g.dx[30 * 60 + 30] < -2; })());
const rough = X.field(60, 60); for (let i = 0; i < rough.dx.length; i++) rough.dx[i] = (i % 2) * 4;
const tv = (F) => { let a = 0; for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) a += Math.abs(F.dx[y * 60 + x] - F.dx[y * 60 + x + 1]); return a; };
const t0 = tv(rough); for (let k = 0; k < 4; k++) X.liq(rough, "smooth", 30, 30, 16, 1, 0, 0, null);
check("liq smooth: the distortion evened out under the brush (far less change from pixel to pixel)", tv(rough) < t0 * 0.5, { t0, t1: tv(rough) });

// Face-Aware Liquify
const face = X.faceGuess(100, 100, 60, 80);
check("faceGuess: eyes either side above the middle, the nose below it, the mouth lower; FACE_KEYS = the 13 sliders",
  face.eyes[0][0] < 100 && face.eyes[1][0] > 100 && face.eyes[0][1] < 100 && face.nose[1] > 100 && face.mouth[1] > face.nose[1] && X.FACE_KEYS.length === 13
  && ["eyeSize", "eyeHeight", "eyeWidth", "eyeDist", "noseHeight", "noseWidth", "smile", "mouthWidth", "mouthHeight", "forehead", "chin", "jaw", "faceWidth"].every((k) => X.FACE_KEYS.some(([q]) => q === k)));
const E1 = X.faceField(200, 200, face, { eyeSize: 100 }), e = face.eyes[0], at = (F, x, y) => [F.dx[Math.round(y) * 200 + Math.round(x)], F.dy[Math.round(y) * 200 + Math.round(x)]];
const right = at(E1, e[0] + 8, e[1]), mouthP = at(E1, face.mouth[0] + 30, face.mouth[1]);
const S1 = X.faceField(200, 200, face, { smile: 100 }), corner = at(S1, face.mouth[0] + face.mw, face.mouth[1]);
const W1 = X.faceField(200, 200, face, { faceWidth: 100 }), side = at(W1, 100 + 60 * 0.9, 100);
const Z = X.faceField(200, 200, face, {});
check("faceField: Eye Size + = each eye bigger (right of it takes from nearer its centre: dx < 0), the mouth untouched; Smile + lifts the mouth's corners (dy > 0 = from below); Face Width + pushes the sides out; all 0 = no change",
  right[0] < -0.5 && mouthP[0] === 0 && corner[1] > 1 && side[0] < -0.5 && Z.dx.every((v) => v === 0) && Z.dy.every((v) => v === 0), { right, mouthP, corner, side });

const WP = read("ext", "imageeditdock", "pcwarp.js"), SM = read("ext", "imageeditdock", "pcsmart.js");
check("wiring: pcwarp - Grid / columns x rows / the three Split buttons, Alt-click unsplit, corners / handles / weights through the lattice, a smart object keeps t.wgrid; Liquify + Smooth (E), Push Left (O), the Face tool (A), 13 sliders added to the brushes' field on OK; pcsmart draws X.meshOf(t) and moves t.wgrid along",
  /id="xfWG"/.test(WP) && /id="xfGC"/.test(WP) && /data-xfsplit/.test(WP) && /unsplitAt\(fx, fy\)/.test(WP) && /X\.latCorners\(Q\.warp, Q\.wgrid\)/.test(WP) && /X\.latNear\(Q\.wgrid, k\)/.test(WP) && /X\.latWeights\(Q\.wgrid/.test(WP)
  && /wgrid: L\.smart\.t\.warp && L\.smart\.t\.wgrid/.test(WP) && /\["smooth", "Smooth \(E\)/.test(WP) && /\["pushleft", "Push Left \(O\)/.test(WP) && /\["face", "Face Tool \(A\)/.test(WP) && /X\.FACE_KEYS\.map/.test(WP) && /const T0 = total\(\)/.test(WP)
  && /X\.drawMesh\(g, src, X\.meshOf\(t\)\)/.test(SM) && /wgrid: JSON\.parse\(JSON\.stringify\(t\.wgrid\)\)/.test(SM));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
