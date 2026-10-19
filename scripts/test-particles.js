#!/usr/bin/env node
/* bitGen Studio — 2.506.0 unit tests: ✨ PARTICLES (ext/timelinedock/tlparticles.js via tlgen.js), ☀ LIGHT RAYS
 * (tlrays.js) and 🎞 a VIDEO LAYER BAKED WHOLE BY THE PAGE (tlvbake.js -> lib/tlKeys.vbakeKeys -> worker.py).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 1: particles, light rays, mesh warp, puppet pins). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PT = require(path.join(ROOT, "ext", "timelinedock", "tlparticles.js"));
const G = require(path.join(ROOT, "ext", "timelinedock", "tlgen.js"));
const R = require(path.join(ROOT, "ext", "timelinedock", "tlrays.js"));
const V = require(path.join(ROOT, "ext", "timelinedock", "tlvbake.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));

/* ---- particles */
const o = PT.clean(Object.assign({}, PT.DEFAULTS, { rate: 10, life: 2, speed: 100, speedRand: 0, spread: 0, dir: 0, gravity: 0, sizeRand: 0, ex: 0, ey: 0 }));
check("clean: through tlgen (a 🌫 generator of kind particles), clamps, shapes / emitters from their lists",
  G.clean({ kind: "particles", rate: 99999, shape: "x", emit: "y" }).rate === 2000 && G.clean({ kind: "particles", shape: "x" }).shape === "dot" && G.clean({ kind: "particles", emit: "y" }).emit === "point" && G.live({ gen: { kind: "particles" } }));
const a1 = PT.at(o, 1.05);
check("at: rate 10 for 1.05 s = 11 particles born (0 .. 1.0 s), straight right at 100 px/s: the first is 105 px out, the newest 5",
  a1.length === 11 && Math.abs(a1[0].x - 105) < 1e-9 && Math.abs(a1[10].x - 5) < 1e-9 && a1.every((p) => Math.abs(p.y) < 1e-9), a1.map((p) => p.x));
const a3 = PT.at(o, 3.0);
check("life 2 s: at 3 s only the ones born after 1 s are alive (age <= life); size / opacity follow the age",
  a3.length === 21 && a3.every((p) => p.mix <= 1) && Math.abs(a3[0].size - (o.size0 + (o.size1 - o.size0) * a3[0].mix)) < 1e-9 && a3[a3.length - 1].a > a3[0].a, a3.length);
const g = PT.clean(Object.assign({}, o, { gravity: 200, dir: 0 }));
const pg = PT.at(g, 1.0)[0];
check("gravity: ½ g a² downwards (a 1 s old particle 100 px down at g 200)", Math.abs(pg.y - 100) < 1e-9 && Math.abs(pg.vy - 200) < 1e-9, pg);
const r1 = PT.at(PT.clean(Object.assign({}, PT.DEFAULTS, { seed: 5 })), 1.3), r2 = PT.at(PT.clean(Object.assign({}, PT.DEFAULTS, { seed: 5 })), 1.3), r3 = PT.at(PT.clean(Object.assign({}, PT.DEFAULTS, { seed: 6 })), 1.3);
check("worked out, not simulated: the same seed and time = the same particles (any frame on its own); another seed differs",
  JSON.stringify(r1) === JSON.stringify(r2) && JSON.stringify(r1) !== JSON.stringify(r3));
const pre = PT.at(PT.clean(Object.assign({}, o, { preroll: true })), 0);
check("pre-roll: the air is already full at 0 s (a whole life's worth)", pre.length === 21 && PT.at(o, 0).length === 1, pre.length);
check("rnd: in [0, 1), the same for the same (seed, k, j), spread out", (() => { const v = []; for (let k = 0; k < 2000; k++) v.push(PT.rnd(1, k, 1)); const m = v.reduce((s, x) => s + x, 0) / v.length; return v.every((x) => x >= 0 && x < 1) && Math.abs(m - 0.5) < 0.03 && PT.rnd(1, 7, 2) === PT.rnd(1, 7, 2); })());
check("a huge rate is capped (at most 6000 alive)", PT.at(PT.clean(Object.assign({}, o, { rate: 2000, life: 10 })), 20).length === PT.MAX);
const c = { gen: Object.assign({}, PT.DEFAULTS), kf: KF.set(KF.set(undefined, 0, { gn_rate: 10 }, 24), 2, { gn_rate: 50 }, 24) };
check("keyable: gn_rate's key value at tau (via tlgen.params)", G.params(c, 1, KF).rate === 30);

/* ---- light rays */
const rc = R.clean({ length: 999, threshold: 300, samples: 2, tint: "bad" });
check("rays clean: length <= 300 %, threshold < 255, at least 4 samples, a hex tint", rc.length === 300 && rc.threshold === 254 && rc.samples === 4 && rc.tint === "#ffffff" && R.live({ rays: { on: true } }) && !R.live({ rays: { on: false } }));
check("overscan: the picture grows with the length (at most 2x)", R.overscan(R.clean({ length: 0 })) === 1 && Math.abs(R.overscan(R.clean({ length: 100 })) - 1.6) < 1e-9 && R.overscan(R.clean({ length: 300 })) === 2);
const sc = R.scales(R.clean({ length: 50, intensity: 100, samples: 10 }));
check("samples: zoom 1 .. 1 + length, strengths fading outwards and summing to the intensity",
  sc[0].s === 1 && Math.abs(sc[9].s - 1.5) < 1e-9 && sc[0].a > sc[9].a && Math.abs(sc.reduce((s, x) => s + x.a, 0) - 1) < 1e-9);
const px = new Uint8ClampedArray([255, 255, 255, 255, 100, 100, 100, 255, 255, 0, 0, 0]);
const bp = R.bright(px, 150, "#ff0000");
check("bright-pass: white kept (tinted red), dim grey gone, a see-through pixel gives nothing", bp[0] === 255 && bp[1] === 0 && bp[3] === 255 && bp[4] === 0 && bp[7] === 0 && bp[11] === 0, Array.from(bp));

/* ---- the video-layer bake */
V.register("x", (q) => !!q.fx1); V.register("bad", () => { throw new Error("no"); });
check("TlVBake: needs = any registered effect (a throwing one says no); the signature leaves out the bake fields",
  V.needs({ fx1: 1 }) && !V.needs({}) && V.sig({ a: 1, vbake: "x", vbakeSig: "y", bake: "z" }) === V.sig({ a: 1 }) && V.sig({ a: 1 }) !== V.sig({ a: 2 }));
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js"), TK = read("lib", "tlKeys.js"),
  RI = read("routes", "index.js"), W = read("worker.py"), TG = read("ext", "timelinedock", "tlgen.js"), TR = read("ext", "timelinedock", "tlrays.js"), TV = read("ext", "timelinedock", "tlvbake.js");
check("canvas: rays after the masks in both paths; a picture bigger than its box (_ow) drawn that much bigger, centred; never on the GPU path",
  /TlRays\.apply\(pic, c, t - \(c\.start \|\| 0\), false\)/.test(CV) && /TlRays\.apply\(pic, c, t - \(c\.start \|\| 0\), S\.playing\)/.test(CV)
  && /g\.drawImage\(pic, -b\.w \* ow \/ 2, -b\.h \* ow \/ 2, b\.w \* ow, b\.h \* ow\)/.test(CV) && /tg\.drawImage\(pic, -b\.w \* pow \/ 2, -b\.h \* pow \/ 2, b\.w \* pow, b\.h \* pow\)/.test(CV) && /c\.gen \|\| c\.rays(?: \|\| c\.\w+)*; \}/.test(CV));
check("the compile: rays / anything TlVBake needs bake a picture layer (+ the signature); a video layer is baked whole (seeked frame by frame) and sent as vbake -> vbaked",
  /TlRays\.live\(c\)\)[\s\S]{0,300}TlVBake\.needs\(c\)\)\); \};/.test(TP) && /chain\.push\(\{ rays: p\.rays \|\| null, warp: p\.warp \|\| null, d3: p\.d3 \|\| null,/.test(TP)
  && /vbake: c\.vbake && window\.TlVBake && TlVBake\.needs\(c\) \? c\.vbake : undefined/.test(TD) && /function vbakeKeys\(c\)/.test(TK) && /\.\.\.tlKeys\.vbakeKeys\(c\),/.test(RI)
  && /seek\(v, (?:\(C\.vidAt \|\| C\.srcAt\)|C\.srcAt)\(c, t\)\)/.test(TV) && /C\.drawClip\(g, c, Ly, t\);/.test(TV) && /TlParent\.bakeAll = function \(\) \{ return Promise\.resolve\(prevBake\.apply\(this, arguments\)\)\.then\(bakeAll\); \};/.test(TV));
check("worker: a baked video layer's file is an input; its overlay = those frames placed at the centre while it is on (+ its fades), its masks / maps not used, its sound from its own file",
  /vb_in\[i\] = nxt_in/.test(W) && /parts\.append\(f"\[\{vb_in\[i\]\}:v\]setpts=PTS-STARTPTS\+\{s0:\.3f\}\/TB,format=rgba\{vfade\}\[ov\{i\}\]"\)/.test(W)
  && W.indexOf("if i in vb_in:") < W.indexOf("if i in dmap_in:") && (W.match(/if c\.get\("vbaked"\) and Path\(c\["vbaked"\]\)\.exists\(\):\n\s+continue/g) || []).length === 2);
check("the page: Shift+click with the 🌫 tool = particles there; the generator kind list has Particles; ☀ Light rays in the Properties (keyable ry_)",
  /add\(Object\.assign\(\{\}, TlParticles\.DEFAULTS, \{ ex: Math\.round\(d\.x0 - W2\), ey: Math\.round\(d\.y0 - H2\) \}\), "Particles"\)/.test(TG) && />Particles<\/option>/.test(TG)
  && /id="tlpRyOn"/.test(TR) && /data-ryk=/.test(TR) && /TlVBake\.register\("rays", live\)/.test(TR));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlvbake.js, tlparticles.js before tlgen.js; tlrays.js after tldist.js", EXT.indexOf("tlvbake.js") < EXT.indexOf("tlparticles.js") && EXT.indexOf("tlparticles.js") < EXT.indexOf("tlgen.js") && EXT.indexOf("tlrays.js") > EXT.indexOf("tldist.js"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
