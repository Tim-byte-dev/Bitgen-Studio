#!/usr/bin/env node
/* bitGen Studio — 2.495.0 units: THE COLOUR BLEND MODES (hue / saturation / color / luminosity - canvas.js blendYUV,
 * worker.py _hsl_blend) + VIDEO LAYERS FOLLOWING A PARENT (tlparent.js worldKeys / keysOf / simplify, timelinedock.js
 * tlTfKf, worker.py _kf_expr as a balanced tree).
 * Tim (verbatim): "fix the parented layers so video layers can follow. is there someway to get hue saturation, clor,
 * luminosity blend modes to work?" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const CV = read("ext", "timelinedock", "canvas.js");
const src = CV.slice(CV.indexOf("function yuvOf("), CV.indexOf("function blendYUV("));
const mixYUV = new Function(src + "\nreturn mixYUV;")();

/* ---- the sums */
const G = [128, 128, 128], R = [220, 40, 40], Bl = [40, 60, 220];
const y = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
check("luminosity: a grey layer on red = red's colour at grey's brightness (Y 128)", Math.abs(y(mixYUV("luminosity", ...R, ...G)) - 128) < 1.5 && mixYUV("luminosity", ...R, ...G)[0] > mixYUV("luminosity", ...R, ...G)[2]);
check("color: a red layer on grey = grey's brightness, red's colour", Math.abs(y(mixYUV("color", ...G, ...R)) - 128) < 1.5 && mixYUV("color", ...G, ...R)[0] > 150);
check("hue: blue's hue on a red base keeps red's brightness + strength (now bluish); on grey (no strength) = grey", (() => { const o = mixYUV("hue", ...R, ...Bl); return o[2] > o[0] && Math.abs(y(o) - y(R)) < 1.5; })() && mixYUV("hue", ...G, ...Bl).join() === "128,128,128");
check("saturation: grey's (none) strength on red = red's grey; red's strength on grey = grey (no direction)", (() => { const o = mixYUV("saturation", ...R, ...G); return Math.abs(o[0] - o[1]) <= 1 && Math.abs(o[1] - o[2]) <= 1; })() && mixYUV("saturation", ...G, ...R).join() === "128,128,128");

/* ---- the compile's graph = the canvas's sums */
const sys = "import sys, json; sys.argv=['x']; sys.path.insert(0, '.'); import worker\n";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hsl495-"));
try {
  const A = path.join(tmp, "a.png"), B = path.join(tmp, "b.png");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=96x64:d=1", "-frames:v", "1", A]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "rgbtestsrc=s=96x64:d=1,hue=h=40", "-frames:v", "1", B]);
  const raw = (f) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 24 });
  const a = raw(A), b = raw(B), res = {};
  for (const mode of ["hue", "saturation", "color", "luminosity"]) {
    const g = execFileSync("python3", ["-c", sys + `parts = ["[0:v]format=gbrp[bA0]", "[1:v]format=gbrp[fp0]"]\nworker._hsl_blend(parts, "bA0", "fp0", "${mode}", "o", 0)\nprint(";".join(parts))`], { cwd: ROOT, encoding: "utf8" }).trim();
    const out = path.join(tmp, mode + ".png");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", A, "-i", B, "-filter_complex", g, "-map", "[o]", "-frames:v", "1", out]);
    const o = raw(out); let d = 0, big = 0;
    for (let i = 0; i < o.length; i += 3) { const w = mixYUV(mode, a[i], a[i + 1], a[i + 2], b[i], b[i + 1], b[i + 2]); for (let k = 0; k < 3; k++) { const e = Math.abs(w[k] - o[i + k]); d += e; if (e > 6) big++; } }
    res[mode] = { mean: Math.round(d / o.length * 100) / 100, big: Math.round(big / o.length * 10000) / 100 };
  }
  check("worker._hsl_blend (lut2 / mergeplanes in YUV) = the canvas's sums: hue / saturation / color / luminosity (mean difference under 1.5, under 2 % of values off by more than 6)",
    Object.values(res).every((r) => r.mean < 1.5 && r.big < 2), res);
} catch (e) { check("the colour modes through ffmpeg", false, String(e.message).slice(0, 400)); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
const W = read("worker.py");
check("worker: the colour modes go through _hsl_blend (not ffmpeg's blend, which has none), labelled hz… (no clash with the graph's own labels)", /_HSL = \("hue", "saturation", "color", "luminosity"\)/.test(W)
  && /if blend in _HSL:\n\s+_hsl_blend\(parts, f"bA\{i\}", f"fp\{i\}", blend, f"bx\{i\}", i\)/.test(W) && /f"\[hz\{l\}\{i\}\]"/.test(W));

/* ---- the balanced tree */
const py = execFileSync("python3", ["-c", sys + [
  "import random, re",
  "random.seed(7)",
  "def if_(c, a, b): return a if c else b",
  "def lt(a, b): return 1 if a < b else 0",
  "def clip(v, lo, hi): return max(lo, min(hi, v))",
  "bad, depth = 0, 0",
  "for n in (1, 2, 3, 7, 40, 300):",
  "    kf = sorted([{'at': round(random.uniform(0, 30), 3), 'x': random.uniform(-500, 500), 'ease': random.choice([None, 'in', 'out', 'inout', 'hold'])} for _ in range(n)], key=lambda k: k['at'])",
  "    e = worker._kf_expr(kf, 'x', -1, 'T')",
  "    d, m = 0, 0",
  "    for ch in e:",
  "        if ch == '(': d += 1; m = max(m, d)",
  "        elif ch == ')': d -= 1",
  "    if n == 300: depth = m",
  "    ev = e.replace('if(', 'if_(')",
  "    for T in [random.uniform(-1, 31) for _ in range(60)] + [k['at'] for k in kf]:",
  "        if abs(eval(ev, {'if_': if_, 'lt': lt, 'clip': clip, 'T': T}) - worker._kf_value(kf, T, 'x', -1)) > 1e-3: bad += 1",
  "print(json.dumps([bad, depth]))"].join("\n")], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
const [bad, depth] = JSON.parse(py);
check("worker._kf_expr: a BALANCED tree of if()s - the same curve as _kf_value (1 … 300 keys, every ease, at the keys too) and 300 keys nest ~log2 deep, not 300", bad === 0 && depth < 60, { bad, depth });

/* ---- video layers follow their parent */
const TP = require(path.join(ROOT, "ext", "timelinedock", "tlparent.js"));
const ts = [], vs = []; for (let i = 0; i <= 96; i++) { ts.push(i / 24); vs.push(200 * Math.sin(i / 24 * 1.7)); }
const keep = TP.simplify(ts, vs, 0.25);
const lerpAt = (k, t) => { for (let j = 0; j + 1 < k.length; j++) { const a = k[j], b = k[j + 1]; if (t >= ts[a] && t <= ts[b]) return vs[a] + (vs[b] - vs[a]) * (t - ts[a]) / (ts[b] - ts[a]); } return NaN; };
check("simplify (Ramer-Douglas-Peucker): a fast sine sampled 97 times -> fewer points, every sample within 0.25 px of the straight pieces", keep.length < 90 && keep[0] === 0 && keep[keep.length - 1] === 96 && ts.every((t, i) => Math.abs(lerpAt(keep, t) - vs[i]) <= 0.25 + 1e-9), keep.length);
const sm = ts.map((t, i) => ({ at: t, x: vs[i], y: 10, scale: 1 + t / 10, rot: 0 }));
const ks = TP.keysOf(sm, { xy: 0.25, scale: 0.0005, rot: 0.05 }, 390);
check("keysOf: x / y keys where the path bends, scale keys (a straight ramp = 2), no rotation keys (it never turns)", ks.filter((k) => k.x != null).length === keep.length && ks.filter((k) => k.scale != null).length === 2 && !ks.some((k) => k.rot != null) && ks.every((k, i) => !i || k.at >= ks[i - 1].at), ks.length);
check("keysOf: at most `max` keys (the tolerances double until it fits)", TP.keysOf(sm, { xy: 0.25, scale: 0.0005, rot: 0.05 }, 12).length <= 12);
const PA = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js");
check("tlparent: a VIDEO layer can follow (the ⛓ Parent list for every kind - the old '(video layers can be parents)' note gone); worldKeys samples world() each frame, keeps its own opacity / colour / anchor keys",
  !/video layers can be parents\)/.test(PA) && /function worldKeys\(c, kind\)/.test(PA) && /var MOVE = \["x", "y", "scale", "rot", "to", "ti"\]/.test(PA) && /worldKeys: worldKeys/.test(PA));
check("timelinedock: a video-layer clip with a parent sends its world keys (tlTfKf) to the compile", /\.\.\.tlTfKf\(c\),/.test(TD) && /function tlTfKf\(c(?:, kind)?\) \{ return \(?c\.parent(?: \|\| \(window\.TlExpr && TlExpr\.moves && TlExpr\.moves\(c\)\)\))? && window\.TlParent && TlParent\.worldKeys \? TlParent\.worldKeys\(c, (?:kind \|\| )?"vl"\)/.test(TD));
const TB = read("ext", "timelinedock", "tlblend.js"), TK = require(path.join(ROOT, "lib", "tlKeys.js"));
check("the 4 colour modes offered (tlblend.js 17), let through (lib/tlKeys.js), drawn by blendYUV on the canvas (not the GPU path)", /\["luminosity", "Luminosity"\]/.test(TB) && ["hue", "saturation", "color", "luminosity"].every((m) => TK.BLENDS.includes(m) && TK.layerKeys({ blend: m }).blend === m)
  && /hue: "yuv", saturation: "yuv", color: "yuv", luminosity: "yuv"/.test(CV) && /if \(BLENDS\[Ly\.L\.blend\] === "yuv"\) \{ blendYUV\(pg, lc, Ly\.L\.blend\); return; \}/.test(CV));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
