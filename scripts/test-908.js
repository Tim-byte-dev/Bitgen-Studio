#!/usr/bin/env node
// bitGen Studio 2.908.0 - ⏱ the time estimate (lib/timeEstimate.js, routes/timeEstimate.js, static/timeest.js, the
// statistics' est line) + 📷 a captured frame shown in the Gallery (static/lbframe.js showInGallery).
// Run: node scripts/test-908.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const T = require("../lib/timeEstimate");

// features: every route's params
let f = T.features({ mode: "ref2va", video_style_id: "vs1", width: 960, height: 544, frames: 241, steps: 8, cfg: 1 });
check("features: /api/generate's job", f.style === "vs1" && f.kind === "video" && f.w === 960 && f.h === 544 && f.frames === 241 && f.steps === 8 && f.cfg === 1, f);
f = T.features({ mode: "ltx", video_style_id: "l", width: 1280, height: 704, seconds: 5, fps: 24, basic: { steps: 12, cfg: 3 } });
check("features: LTX (seconds x fps, Override's steps / cfg)", f.frames === 120 && f.steps === 12 && f.cfg === 3, f);
f = T.features({ mode: "graph", frames: 1080, video_style_id: "h", est: { style: "h", kind: "video", w: 960, h: 544, steps: 8, cfg: 1 } });
check("features: H3 Long Video's own hint (the size lives in its graph)", f.style === "h" && f.w === 960 && f.frames === 1080 && f.steps === 8, f);
f = T.features({ mode: "image", style_id: "img1", width: 1024, height: 1024, steps: 4 });
check("features: a picture is one frame", f.kind === "image" && f.frames === 1 && f.style === "img1", f);

// ratio + estimate
const a = { w: 960, h: 544, frames: 240, steps: 8, cfg: 1 };
check("ratio: 4x pixels, 2x frames, cfg 3 = two passes", Math.abs(T.ratio({ w: 1920, h: 1088, frames: 480, steps: 8, cfg: 3 }, a) - 16) < 1e-9);
check("ratio: steps 0 (auto) either side = the same", T.ratio({ w: 960, h: 544, frames: 240, steps: 0, cfg: 1 }, a) === 1);
const now = 1e12;
const g = (t, style, est, gen, su, extra) => Object.assign({ k: "gen", status: "done", t, what: "S-" + style, where: "local", gen_ms: gen, startup_ms: su,
  est: est && Object.assign({ style, kind: "video" }, est) }, extra || {});
const gens = [
  g(now - 3600e3, "a", { w: 960, h: 544, frames: 240, steps: 8, cfg: 1 }, 300000, 40000),
  g(now - 7200e3, "a", { w: 960, h: 544, frames: 480, steps: 8, cfg: 1 }, 600000, 60000),
  g(now - 8000e3, "a", null, 999999, 1, { status: "failed" }),
  g(now - 9e6, "b", { w: 1280, h: 720, frames: 120, steps: 20, cfg: 1 }, 100000, 20000),
];
let e = T.estimate(gens, { style: "a", kind: "video", w: 960, h: 544, frames: 888, steps: 8, cfg: 1 }, now);
check("estimate: the same style scaled to 888 frames (failed renders left out)", e && e.basis === "style" && e.n === 2 && e.gen_ms === 1110000 && e.startup_ms === 50000, e);
e = T.estimate(gens, { style: "a", kind: "video", w: 960, h: 544, frames: 240, steps: 8, cfg: 1 }, now - 3600e3 + 60000);
check("estimate: the style rendered a minute ago = warm (the quickest startup)", e.warm && e.startup_ms === 40000, e);
e = T.estimate(gens, { style: "zz", kind: "video", w: 960, h: 544, frames: 240, steps: 8, cfg: 1 }, now);
check("estimate: a style never rendered = other styles of the kind", e && e.basis === "kind" && e.n === 3, e);
check("estimate: nothing of the kind = null", T.estimate(gens, { style: "zz", kind: "image" }, now) === null);
e = T.estimate([g(now - 1e6, "old", null, 200000, 30000, { what: "Old style" })], { style: "x", name: "Old style", kind: "video", w: 960, h: 544, frames: 240 }, now);
check("estimate: a render from before 2.908.0 (no est) matches by name, taken as it was", e && e.gen_ms === 200000 && e.sized === 0, e);
check("dur: 45 s / 6½ min / 25 min / 1 h 20 min", T.dur(45000) === "45 s" && T.dur(390000) === "6½ min" && T.dur(1500000) === "25 min" && T.dur(4800000) === "1 h 20 min",
  [T.dur(45000), T.dur(390000), T.dur(1500000), T.dur(4800000)]);
const w = T.words({ ms: 400000, gen_ms: 360000, startup_ms: 40000, lo: 300000, hi: 500000, n: 4, sized: 3, basis: "style", warm: false }, "FastH3 Omni");
check("words: about + the range, the tooltip says where from", w.text === "⏱ about 6½ min (5 min – 8½ min)" && /4 renders of FastH3 Omni here/.test(w.title) && /1 of them from before 2\.908\.0/.test(w.title), w);
check("words: none yet", /no time yet/.test(T.words(null).text));

// the page's request
const TE = require("../static/timeest.js");
let r = TE.requestOf({ mode: "video", vstyle: "v", vname: "FastH3 Omni", width: "544", height: "960", seconds: "37", steps: "0", cfg: "1" });
check("requestOf: video", r.kind === "video" && r.width === 544 && r.height === 960 && r.seconds === 37 && r.cfg === 1, r);
r = TE.requestOf({ mode: "image", istyle: "i", iw: 1024, ih: 768, isteps: "9", icfg: "4", override: false });
check("requestOf: a picture without Override - the style's own size / steps", r.kind === "image" && r.width === 0 && r.steps === 0 && r.cfg === null, r);
r = TE.requestOf({ mode: "image", istyle: "i", iw: 1024, ih: 768, isteps: "9", icfg: "4", override: true });
check("requestOf: a picture with Override - its size / steps / cfg", r.width === 1024 && r.steps === 9 && r.cfg === 4, r);
check("requestOf: chat / speech = no estimate", TE.requestOf({ mode: "chat" }) === null && TE.requestOf({ mode: "speech" }) === null);

// wiring
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
check("genStats.entryFor records est", /out\.est = require\("\.\/timeEstimate"\)\.features\(p\)/.test(src("lib/genStats.js")));
const GS = require("../lib/genStats");
const ent = GS.entryFor({ id: "j", created: 1, started: 2, finished: 10, status: "done", params: { mode: "ref2va", video_style_id: "vs", width: 544, height: 960, frames: 97, steps: 8, cfg: 1 } });
check("genStats.entryFor: the line carries what the render was", ent.est && ent.est.style === "vs" && ent.est.w === 544 && ent.est.frames === 97, ent.est);
check("routes/index.js mounts routes/timeEstimate.js (not server.js)", /require\("\.\/timeEstimate"\)\.mount\(app\)/.test(src("routes/index.js")) && !/timeEstimate/.test(src("misc/server.js")));
check("H3 Long Video's job carries its est hint", /est: \{ style: b\.video_style_id/.test(src("routes/h3LongVideo.js")));
check("index.html loads static/timeest.js", /<script src="\/static\/timeest\.js"><\/script>/.test(src("static/index.html")));
const lb = src("static/lbframe.js");
check("lbframe: a captured frame opens the Gallery's Images tab and lights its tile", /data-gtab="images"/.test(lb) && /lbJustSaved/.test(lb) && /refresh\(j\.gallery \|\| nm\)/.test(lb));
for (const f2 of ["lib/timeEstimate.js", "routes/timeEstimate.js", "static/timeest.js", "static/lbframe.js"]) {
  const bad = src(f2).split("\n").filter((l) => /[,(+]\s*\/\/ /.test(l) && !/^\s*\/\//.test(l) && !/eslint-disable/.test(l));
  check(`${f2}: no // comment mid-expression`, !bad.length, bad);
}
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
