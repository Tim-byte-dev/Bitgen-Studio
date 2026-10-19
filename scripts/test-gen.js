#!/usr/bin/env node
/* bitGen Studio — 2.505.0 unit tests: 🌫 GENERATOR LAYERS (fractal noise, gradient ramp - ext/timelinedock/tlgen.js) and
 * 〰 DISTORT (turbulent displace, displacement map - ext/timelinedock/tldist.js), their bake / compile wiring, and a
 * REAL ffmpeg check that worker.py's displace (with the lossless map videos lib/layerBake makes) moves every pixel
 * exactly as the canvas does. Tim: "... and the rest of the After Effects gap list". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const G = require(path.join(ROOT, "ext", "timelinedock", "tlgen.js"));
const D = require(path.join(ROOT, "ext", "timelinedock", "tldist.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));

/* ---- generators */
const f0 = G.clean({ kind: "fractal", complexity: 99, contrast: -5, ftype: "x", seed: 7.6, detail: 3 }), r0 = G.clean({ kind: "ramp", shape: "radial", x0: "a" });
check("clean: fractal defaults / clamps (complexity 1..10, contrast >= 0, type, whole seed, detail 1/4 or 1/2); ramp shape; anything else is no generator",
  f0.complexity === 10 && f0.contrast === 0 && f0.ftype === "basic" && f0.seed === 8 && f0.detail === 0.25 && r0.shape === "radial" && r0.x0 === -320 && G.clean({ kind: "x" }) === null && G.clean(null) === null);
const P1 = G.perm(5), P1b = G.perm(5), P2 = G.perm(6);
check("perm: the same seed gives the same permutation (all 256 values twice over); another seed another", P1 === P1b && P1.length === 512 && new Set(Array.from(P1.slice(0, 256))).size === 256 && P1.some((v, i) => v !== P2[i]));
const o = G.clean(G.DEFAULTS.fractal);
let mn = 1, mx = 0, sum = 0;
for (let y = 0; y < 60; y++) for (let x = 0; x < 80; x++) { const v = G.value(o, x * 9, y * 9, 0); mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; }
check("fractal noise: 0..1, mid grey on average, a real spread", mn >= 0 && mx <= 1 && Math.abs(sum / 4800 - 0.5) < 0.08 && mx - mn > 0.4, { mn, mx, avg: sum / 4800 });
check("deterministic: the same pixel, settings and time give the same value; evolution moves it; offset = moving the pixel",
  G.value(o, 100, 50, 1.5) === G.value(o, 100, 50, 1.5) && G.value(o, 100, 50, 0) !== G.value(o, 100, 50, 1)
  && Math.abs(G.value(Object.assign({}, o, { ox: 40 }), 100, 50, 0) - G.value(o, 140, 50, 0)) < 1e-12);
check("contrast 0 = flat grey (+ brightness); invert flips it",
  Math.abs(G.value(Object.assign({}, o, { contrast: 0 }), 33, 44, 0) - 0.5) < 1e-9 && Math.abs(G.value(Object.assign({}, o, { contrast: 0, bright: 20 }), 3, 4, 0) - 0.7) < 1e-9
  && Math.abs(G.value(Object.assign({}, o, { invert: true }), 33, 44, 0) - (1 - G.value(o, 33, 44, 0))) < 1e-12);
const turbAvg = (t) => { const q = G.clean(Object.assign({}, G.DEFAULTS.fractal, { ftype: t })); let s = 0; for (let i = 0; i < 2000; i++) s += G.value(q, (i % 50) * 11, Math.floor(i / 50) * 11, 0); return s / 2000; };
check("turbulent sharp / smooth: never below 0, darker on average than basic (the creases)", turbAvg("turbulent sharp") < 0.48 && turbAvg("turbulent smooth") < 0.48 && turbAvg("turbulent sharp") > 0.15);
const R = G.clean({ kind: "ramp", shape: "linear", x0: -100, y0: 0, x1: 100, y1: 0 });
check("ramp: 0 at the start, 1 at the end, held past them; radial = the distance from the start over the radius",
  G.rampAt(R, -100, 50) === 0 && G.rampAt(R, 0, -30) === 0.5 && G.rampAt(R, 300, 0) === 1 && G.rampAt(G.clean({ kind: "ramp", shape: "radial", x0: 0, y0: 0, x1: 0, y1: 100 }), 30, 40) === 0.5);
const c = { gen: G.DEFAULTS.fractal, kf: KF.set(KF.set(undefined, 0, { gn_scale: 50 }, 24), 2, { gn_scale: 150 }, 24) };
check("params: a keyed setting (gn_scale) is its key value at tau", G.params(c, 1, KF).scale === 100 && G.params(c, 0, KF).scale === 50 && G.params(c, 9, KF).scale === 150);

/* ---- distortions */
const t1 = D.fieldTurb(D.clean({ kind: "turb", amount: 30, size: 40, seed: 2 }), 64, 48, 0.5), t2 = D.fieldTurb(D.clean({ kind: "turb", amount: 30, size: 40, seed: 2 }), 64, 48, 0.5);
const mxd = Math.max(...Array.from(t1.dx).map(Math.abs), ...Array.from(t1.dy).map(Math.abs));
check("turbulent displace: whole pixels, at most the amount (and 127), the same every time, both directions used",
  t1.dx.every((v, i) => v === t2.dx[i]) && mxd <= 30 && mxd > 5 && t1.dx.some((v) => v < 0) && t1.dx.some((v) => v > 0) && t1.dy.some((v) => v !== 0), mxd);
check("clean: amounts kept to ±127 (an 8-bit map's reach); a map needs a layer; off when nothing moves",
  D.clean({ kind: "turb", amount: 900 }).amount === 127 && !D.live({ dist: { kind: "map", src: "", mx: 9 } }) && D.live({ dist: { kind: "map", src: "u1", mx: 9 } }) && !D.live({ dist: { kind: "turb", amount: 0 } }));
const grey = new Uint8ClampedArray(4 * 4 * 4).fill(128), white = new Uint8ClampedArray(4 * 4 * 4).fill(255);
const fm = D.fieldMap(D.clean({ kind: "map", src: "u", mx: 20, my: -10 }), grey, 4, 4), fw = D.fieldMap(D.clean({ kind: "map", src: "u", mx: 20, my: -10 }), white, 4, 4);
check("displacement map: mid grey moves nothing; white moves the full max (across +, up-down by its sign)", fm.dx.every((v) => Math.abs(v) <= 0) && fw.dx.every((v) => v === 20) && fw.dy.every((v) => v === -10), [Array.from(fm.dx), Array.from(fw.dx), Array.from(fw.dy)]);
const src = new Uint8ClampedArray(4 * 1 * 4); for (let i = 0; i < 4; i++) src.set([i * 60, 0, 0, 255], i * 4);
const out = D.displace(src, 4, 1, { dx: Int8Array.from([1, 1, 5, -9]), dy: Int8Array.from([0, 0, 0, 0]) });
check("displace: each pixel from (x + dx), the edges smeared", out[0] === 60 && out[4] === 120 && out[8] === 180 && out[12] === 0, Array.from(out));
const mb = D.mapBytes({ dx: Int8Array.from([0, 127, -127]), dy: Int8Array.from([5, 0, -1]), w: 3, h: 1 });
check("mapBytes: 128 + the offset (128 = still)", Array.from(mb.x).join() === "128,255,1" && Array.from(mb.y).join() === "133,128,127");

/* ---- the REAL compile path: lossless map videos + worker.py's displace == the canvas's displace */
try {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "dist_")), W = 96, H = 64;
  // a source frame with detail everywhere
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; rgb[i] = (x * 37 + y * 11) & 255; rgb[i + 1] = (x * 5 + y * 23) & 255; rgb[i + 2] = ((x ^ y) * 9) & 255; }
  fs.writeFileSync(path.join(T, "src.rgb"), rgb);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-i", path.join(T, "src.rgb"), "-frames:v", "1", "-c:v", "ffv1", path.join(T, "src.mkv")]);
  const f = D.fieldTurb(D.clean({ kind: "turb", amount: 40, size: 30, complexity: 2, seed: 9 }), W, H, 0.25), m = D.mapBytes(f);
  for (const [ax, bytes] of [["x", m.x], ["y", m.y]]) {
    const g = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) g[i * 3] = g[i * 3 + 1] = g[i * 3 + 2] = bytes[i];
    fs.writeFileSync(path.join(T, ax + ".rgb"), g);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-i", path.join(T, ax + ".rgb"), path.join(T, ax + ".png")]);
    // exactly lib/layerBake.encode's lossless arguments
    execFileSync("ffmpeg", ["-y", "-v", "error", "-framerate", "24", "-i", path.join(T, ax + ".png"), "-frames:v", "1", "-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "gbrp", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-f", "webm", path.join(T, ax + ".webm")]);
  }
  // exactly worker.py's chain for one overlay (i = 0 here)
  const fc = "[0:v]setpts=PTS-STARTPTS,format=gbrp[dsb];[1:v]setpts=PTS-STARTPTS,format=gbrp[dsx];[2:v]setpts=PTS-STARTPTS,format=gbrp[dsy];"
    + "[dsx][dsb]scale2ref[dsx2][dsb2];[dsy][dsb2]scale2ref[dsy2][dsb3];[dsb3][dsx2][dsy2]displace=edge=smear,format=rgba[out]";
  const got = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(T, "src.mkv"), "-i", path.join(T, "x.webm"), "-i", path.join(T, "y.webm"), "-filter_complex", fc, "-map", "[out]", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 24 });
  const rgba = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) rgba.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255], i * 4);
  const want = D.displace(rgba, W, H, f);
  let exact = 0, worst = 0;
  for (let i = 0; i < W * H; i++) { let e = 0; for (let k = 0; k < 3; k++) e = Math.max(e, Math.abs(got[i * 4 + k] - want[i * 4 + k])); if (e === 0) exact++; worst = Math.max(worst, e); }
  const decoded = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(T, "x.webm"), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gbrp", "-"]);
  let mapErr = 0; for (let i = 0; i < W * H; i++) mapErr = Math.max(mapErr, Math.abs(decoded[i] - m.x[i]));
  check("the compile: the lossless map video keeps the map exactly; ffmpeg's displace (worker.py's chain) = the canvas's displace on >= 97% of pixels",
    got.length === W * H * 4 && mapErr === 0 && exact / (W * H) >= 0.99, { exact: exact / (W * H), worst, mapErr });
  fs.rmSync(T, { recursive: true, force: true });
} catch (e) { check("the compile check ran (ffmpeg)", false, String(e.message || e).slice(0, 400)); }

/* ---- wiring */
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js"), RI = read("routes", "index.js"),
  TK = read("lib", "tlKeys.js"), LB = read("lib", "layerBake.js"), WK = read("worker.py"), TG = read("ext", "timelinedock", "tlgen.js"), TS = read("ext", "timelinedock", "tldist.js");
check("canvas: a generator layer's picture (the frame's size); 〰 applied in both paths (full size for the bake, smaller while playing); never on the GPU path",
  /else if \(c\.gen && window\.TlGen && TlGen\.picture\) \{[\s\S]{0,260}w = S\.W; h = S\.H;/.test(CV) && /TlDist\.apply\(pic, c, t - \(c\.start \|\| 0\), false\)/.test(CV) && /TlDist\.apply\(pic, c, t - \(c\.start \|\| 0\), S\.playing\)/.test(CV)
  && /c\.pin \|\| c\.tm \|\| c\.dist \|\| c\.gen(?: \|\| c\.\w+)*; \}/.test(CV));
check("the compile: generator / distorted picture layers baked (TlParent.bakeAll + their settings in the signature, the bake sent); video layers' maps baked (lossless) and sent as dmapx / dmapy",
  /\(window\.TlGen && TlGen\.live && TlGen\.live\(c\)\) \|\| \(window\.TlDist && TlDist\.live && TlDist\.live\(c\)\)/.test(TP) && /chain\.push\(\{ (?:[a-z0-9]+: p\.[a-z0-9]+ \|\| null, )*gen: p\.gen \|\| null, dist: p\.dist \|\| null,/.test(TP)
  && /\(c\.gen && window\.TlGen && TlGen\.live\(c\)\) \|\| \(c\.dist && window\.TlDist && TlDist\.live\(c\)\)(?: \|\| \([^)]*\([^)]*\)\))*\) && c\.bake/.test(TD) && /dbake: c\.dbake && window\.TlDist && TlDist\.live\(c\) \? c\.dbake : undefined/.test(TD)
  && /function distKeys\(c\)/.test(TK) && /\.\.\.tlKeys\.distKeys\(c\),/.test(RI) && /\(o \|\| \{\}\)\.lossless === true/.test(LB) && /"-lossless", "1", "-pix_fmt", "gbrp"/.test(LB)
  && /lossless: true/.test(TS) && /TlParent\.bakeAll = function \(\) \{ return Promise\.resolve\(prevBake\.apply\(this, arguments\)\)\.then\(bakeAllMaps\); \};/.test(TS));
check("worker: the two map inputs after the mask videos; displace=edge=smear on planar RGB before the masks (which then read the displaced clip)",
  /dmap_in\[i\] = \(nxt_in, nxt_in \+ 1\)/.test(WK) && /\[dsb3\{i\}\]\[dsx2\{i\}\]\[dsy2\{i\}\]displace=edge=smear,format=rgba\[dsd\{i\}\]/.test(WK) && /parts\.append\(f"\{src_v\}setpts=PTS-STARTPTS,format=rgba\[mb\{i\}\]"\)/.test(WK)
  && WK.indexOf("if i in dmap_in:") < WK.indexOf("if i in mask_in:"));
check("the page: the 🌫 tool (click = fractal noise, drag = a ramp), 🌫 Generator and 〰 Distort in the Properties (keyable gn_ / ds_ settings)",
  /C\.addTool\(\{ id: "gen", icon: "🌫"/.test(TG) && /id="tlpGnKind"/.test(TG) && /data-gnk=/.test(TG) && /id="tlpDsKind"/.test(TS) && /id="tlpDsSrc"/.test(TS) && /data-dsk=/.test(TS));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlgen.js then tldist.js after tltime.js (2.506.0: tlvbake + tlparticles between)", EXT.indexOf("tlgen.js") > EXT.indexOf("tltime.js") && EXT.indexOf("tldist.js") === EXT.indexOf("tlgen.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
