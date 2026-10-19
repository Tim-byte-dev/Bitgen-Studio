#!/usr/bin/env node
/* bitGen Studio — 2.509.0 unit tests: ✍ MOTION SKETCH, ≈ THE WIGGLER, ⌇ THE SMOOTHER (ext/timelinedock/tlmotion.js).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 3: motion sketch, the wiggler, the smoother). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const M = require(path.join(ROOT, "ext", "timelinedock", "tlmotion.js"));

const nz = []; for (let i = 0; i <= 400; i++) nz.push(M.noise1(3, i / 40));
check("noise1: -1..1, the same for the same seed, continuous (small steps between close points), another seed differs",
  nz.every((v) => v >= -1 && v <= 1) && M.noise1(3, 2.37) === M.noise1(3, 2.37) && nz.every((v, i) => i === 0 || Math.abs(v - nz[i - 1]) < 0.12) && M.noise1(4, 2.37) !== M.noise1(3, 2.37));
const line = []; for (let i = 0; i <= 24; i++) line.push([i / 24, i * 10, 50]);
check("rdp2: a straight steady move = its two ends", M.rdp2(line, 0.5).length === 2);
const corner = []; for (let i = 0; i <= 24; i++) corner.push([i / 24, i <= 12 ? i * 10 : 120, i <= 12 ? 0 : (i - 12) * 10]);
const kc = M.rdp2(corner, 0.5);
check("rdp2: an L-shaped path keeps its corner (3 keys)", kc.length === 3 && kc[1][0] === 0.5 && kc[1][1] === 120, kc);
const circ = []; for (let i = 0; i <= 96; i++) circ.push([i / 24, 100 * Math.cos(i / 96 * 2 * Math.PI), 100 * Math.sin(i / 96 * 2 * Math.PI)]);
const k1 = M.sketchKeys(circ, 1), k8 = M.sketchKeys(circ, 8);
check("sketchKeys: a circle kept within the smoothing (more smoothing = fewer keys), the first and last sample kept",
  k1.length > k8.length && k8.length >= 5 && k1[0][0] === 0 && k1[k1.length - 1][0] === 4, [k1.length, k8.length]);
const big = []; for (let i = 0; i < 6000; i++) big.push([i / 24, Math.sin(i * 0.9) * 200, Math.cos(i * 1.7) * 200]);
check("sketchKeys: at most 400 keys", M.sketchKeys(big, 0.01).length <= 400);
const flat = () => 10;
const ws = M.wiggleKeys(flat, 0, 2, { freq: 4, amount: 20, noise: "smooth", seed: 5 }), wj = M.wiggleKeys(flat, 0, 2, { freq: 4, amount: 20, noise: "jagged", seed: 5 });
check("wiggleKeys: keys at 2x the rate (smooth) / the rate (jagged), within ± amount of the curve, the ends where they were",
  ws.length === 17 && wj.length === 9 && ws.every((k) => Math.abs(k[1] - 10) <= 20) && wj.every((k) => Math.abs(k[1] - 10) <= 20) && ws[0][1] === 10 && ws[16][1] === 10 && wj[0][1] === 10 && wj.some((k) => Math.abs(k[1] - 10) > 5), [ws.length, wj.length]);
const ramp = (t) => t * 100, wr = M.wiggleKeys(ramp, 0, 1, { freq: 2, amount: 0, seed: 1 });
check("wiggleKeys: amount 0 = the curve itself (it rides on the existing keys)", wr.every((k) => Math.abs(k[1] - k[0] * 100) < 1e-3));
check("wiggleKeys: the same seed = the same wiggle, another seed differs",
  JSON.stringify(M.wiggleKeys(flat, 0, 2, { freq: 3, amount: 9, seed: 2 })) === JSON.stringify(M.wiggleKeys(flat, 0, 2, { freq: 3, amount: 9, seed: 2 })) && JSON.stringify(M.wiggleKeys(flat, 0, 2, { freq: 3, amount: 9, seed: 3 })) !== JSON.stringify(M.wiggleKeys(flat, 0, 2, { freq: 3, amount: 9, seed: 2 })));
const jit = (t) => t * 50 + (Math.round(t * 24) % 2 ? 6 : -6);
const sm = M.smoothKeys(jit, 0, 2, 24, 2, 2);
const rough = (f) => { let s = 0; for (let i = 1; i < 48; i++) s += Math.abs(f(i / 24 + 1 / 24) - 2 * f(i / 24) + f(i / 24 - 1 / 24)); return s; };
const val = (K, t) => { for (let i = 0; i + 1 < K.length; i++) if (t >= K[i][0] && t <= K[i + 1][0]) return K[i][1] + (K[i + 1][1] - K[i][1]) * (t - K[i][0]) / (K[i + 1][0] - K[i][0]); return K[K.length - 1][1]; };
check("smoothKeys: a jittery curve comes out calmer and in fewer keys, the ends kept", rough((t) => val(sm, t)) < rough(jit) / 3 && sm.length < 49 && sm[0][1] === jit(0) && sm[sm.length - 1][1] === jit(2), [sm.length, rough((t) => val(sm, t)), rough(jit)]);
const TM = read("ext", "timelinedock", "tlmotion.js");
check("the page: ✍ Motion Sketch (Shift+K) plays from the playhead and keys x / y; the 〰 Motion Properties: sketch speed / smooth, ≈ Wiggler (per s, amount, smooth / jagged, x, y apart, seed), ⌇ Smoother (frames, tolerance)",
  /id: "sketch", icon: "✍"/.test(TM) && /key: "shift\+k"/.test(TM) && /KF\.set\(c\.kf, f \/ FPS, \{ x: x, y: y \}, FPS\)/.test(TM) && /id="tlpMoWig"/.test(TM) && /id="tlpMoSmo"/.test(TM) && /id="tlpMoNz"/.test(TM) && /id="tlpMoAp"/.test(TM) && /num\("tlpMoSpd"/.test(TM));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlmotion.js after tlwarp.js", EXT.indexOf("tlmotion.js") > EXT.indexOf("tlwarp.js") && EXT.indexOf("tlwarp.js") > 0);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
