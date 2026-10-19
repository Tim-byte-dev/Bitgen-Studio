#!/usr/bin/env node
/* bitGen Studio — 2.500.0 units: ⏱ TIME on a layer (ext/timelinedock/tltime.js - motion blur, posterize time, echo;
 * canvas.js, tlparent.js, timelinedock.js, lib/tlKeys.js timeKeys, routes, worker.py).
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const T = require(path.join(ROOT, "ext", "timelinedock", "tltime.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e);
check("clean: nothing on = null; numbers kept in range", T.clean({}) === null && T.clean({ blur: false, post: 0 }) === null && JSON.stringify(T.clean({ blur: true, shutter: 9999, samples: 99 })) === JSON.stringify({ blur: true, shutter: 720, samples: 16, post: 0 })
  && T.clean({ echo: { n: 50, dt: 0, i0: 2, decay: -1 } }).echo.n === 8 && near(T.clean({ echo: { dt: 0 } }).echo.dt, 1 / 24));
const c = { start: 1, tm: { post: 4 } };
check("postT: posterize time holds the layer on a grid from the clip's start (4 a second: 1.30 s -> 1.25, 1.49 -> 1.25, 1.50 -> 1.50)", near(T.postT(c, 1.3), 1.25) && near(T.postT(c, 1.49), 1.25) && near(T.postT(c, 1.5), 1.5) && T.postT({ start: 0 }, 0.37) === 0.37);
const s = T.samples({ tm: { blur: true, shutter: 180, samples: 8 } }, 2, 24);
check("samples: motion blur at 180° with 8 samples a frame = the 4 sample times ending at the frame (1 / 192 s apart)", s.length === 4 && s[0] === 2 && near(s[1], 2 - 1 / 192) && near(s[3], 2 - 3 / 192) && T.samples({ tm: { blur: false, post: 3 } }, 2, 24).length === 1);
check("samples: 360° = all of them, a small shutter at least 2", T.samples({ tm: { blur: true, shutter: 360, samples: 6 } }, 1, 24).length === 6 && T.samples({ tm: { blur: true, shutter: 10, samples: 6 } }, 1, 24).length === 2);
const e = T.echoes({ start: 0, tm: { echo: { n: 3, dt: 0.1, i0: 0.8, decay: 0.5 } } }, 1);
check("echoes: farthest first, 0.1 s apart, strength 0.8 then halving", e.length === 3 && near(e[0].t, 0.7) && near(e[2].t, 0.9) && near(e[2].w, 0.8) && near(e[1].w, 0.4) && near(e[0].w, 0.2));
check("echoes: never before the clip's start", T.echoes({ start: 0.95, tm: { echo: { n: 3, dt: 0.1 } } }, 1).length === 0 && T.echoes({ start: 0.85, tm: { echo: { n: 3, dt: 0.1 } } }, 1).length === 1);
const TK = require(path.join(ROOT, "lib", "tlKeys.js"));
check("tlKeys.timeKeys: clean, or nothing", JSON.stringify(TK.timeKeys({})) === "{}" && TK.timeKeys({ tm: { blur: true } }).tm.samples === 8 && TK.timeKeys({ tm: { echo: { n: 99 } } }).tm.echo.n === 8 && JSON.stringify(TK.timeKeys({ tm: { blur: false } })) === "{}");
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js"), RT = read("routes", "index.js"), W = read("worker.py"), TT = read("ext", "timelinedock", "tltime.js");
check("canvas: a layer with ⏱ drawn by TlTime.draw (both paths: echoes back to front, the blur's samples added with 'lighter' at 1 / n = the premultiplied average), posterize holds the video frame, never on the GPU path",
  (CV.match(/TlTime\.draw\(/g) || []).length === 2 && /(?:srcAt|vidAt)\(c, c\.tm && window\.TlTime && TlTime\.postT \? TlTime\.postT\(c, t\) : t\)/.test(CV) && /\|\| c\.pin \|\| c\.tm(?: \|\| c\.\w+)*; \}\)/.test(CV) && /one\(mg, c, kind, tt, pic, 1 \/ ts\.length, "lighter"\)/.test(TT));
check("the compile: pictures baked (sigOf tm), video layers send tm (routes ...tlKeys.timeKeys)", /tm: p\.tm \|\| null/.test(TP) && /TlTime\.on\(c\)\)[\s\S]{0,600}?\); \};/.test(TP) && /tm: window\.TlTime && TlTime\.clean \? TlTime\.clean\(c\.tm\) \|\| undefined : undefined/.test(TD) && /\.\.\.tlKeys\.timeKeys\(c\),/.test(RT));
check("worker: motion blur = the move sampled N times a frame (fps = 24 N, perspective on that clock) + premultiply, tmix=frames=K, unpremultiply; posterize = setpts floor; echo = delayed copies overlaid back to front on a clear canvas",
  /rate = KF_FPS \* nsamp/.test(W) && /tvx = f"\(\(in-1\)\/\{rate\}\)"/.test(W) && /,premultiply=inplace=1,tmix=frames=\{min\(kblur, nsamp\)\},unpremultiply=inplace=1/.test(W) && /setpts='floor\(T\*\{post:\.4f\}\+0\.000001\)\/\{post:\.4f\}\/TB'/.test(W)
  && /colorchannelmixer=aa=0\[ez\{i\}\]/.test(W) && /setpts=PTS\+\{k \* dt_e:\.4f\}\/TB,colorchannelmixer=aa=\{w_e:\.4f\}/.test(W) && /def _kf_perspective\(kf, tf, frame_w, frame_h, tv=None\):/.test(W));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tltime.js after tltrack.js; ⏱ Time in the Properties (motion blur + shutter / samples, posterize fps, echo copies / apart / first / fade)", EXT.indexOf("tltime.js") === EXT.indexOf("tltrack.js") + 1 && /id="tlpTmBlur"/.test(TT) && /tlpTmPo/.test(TT) && /tlpTmEc/.test(TT) && /tlpTmEf/.test(TT));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
