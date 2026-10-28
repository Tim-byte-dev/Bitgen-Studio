#!/usr/bin/env node
/* bitGen Studio — 2.613.0 (pure + wiring): ▼ RANGES MARKED WITH CTRL WHILE IT PLAYS, cut / sped up all at once; the time
 * under the pointer; the playback speed.
 *   ext/timelinedock/tlranges.js  rangeOf, hueOf, union, speedRange (with the real split + speed maths), hoverText; wiring
 *   canvas.js   setRate / S.prate (▶ / Space play at the speed picked)   tljoin.js  joinChain (one file for N parts)
 *   tlkeys.js   Ctrl (tap) in the shortcut list */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const G = require(path.join(R, "ext", "timelinedock", "tlranges.js"));
const M = require(path.join(R, "static", "tlmarks.js"));
const FX = require(path.join(R, "static", "clipfx.js"));

check("rangeOf: either order, whole frames, at least one frame long", JSON.stringify(G.rangeOf(2.51, 1.02, 24)) === JSON.stringify({ a: 1, b: 2.5 }) && G.rangeOf(1, 1.01, 24) === null && G.rangeOf(0, 1 / 24, 24).b === 0.041667);
check("hueOf: neighbouring ranges get clearly different colours", [1, 2, 3, 4, 5].map(G.hueOf).every((h, i, a) => i === 0 || Math.min(Math.abs(h - a[i - 1]), 360 - Math.abs(h - a[i - 1])) > 60));
check("union: overlapping / touching ranges merged, the LATEST first (cut from the end - the earlier times stay put)",
  JSON.stringify(G.union([{ a: 1, b: 2 }, { a: 5, b: 6 }, { a: 1.5, b: 3 }, { a: 3, b: 3.5 }])) === JSON.stringify([{ a: 5, b: 6 }, { a: 1, b: 3.5 }]) && G.union([]).length === 0);
const len = (c) => FX.retimed(c.fx) ? FX.clipLen(c) : c.out - c.in;
const split = (c, t) => M.splitClip(c, t, "vl", 1 / 24);
const clips = [{ name: "a.mp4", start: 0, in: 0, out: 6, dur: 6 }, { name: "b.mp4", start: 6, in: 0, out: 2, dur: 2 }];
const r = G.speedRange(clips, 1, 3, 4, { split, len, ripple: true });
check("speedRange: split at both ends, the middle 4x faster (2 s -> 0.5 s), what follows moved up 1.5 s (another clip too)",
  JSON.stringify(r.clips.map((c) => [c.name, c.start, c.in, c.out, (c.fx || {}).speed || 1])) === JSON.stringify([["a.mp4", 0, 0, 1, 1], ["a.mp4", 1, 1, 3, 4], ["a.mp4", 1.5, 3, 6, 1], ["b.mp4", 4.5, 0, 2, 1]]) && r.saved === 1.5 && r.n === 1, r);
const r2 = G.speedRange(clips, 5, 7, 2, { split, len, ripple: false });
check("…across two clips: both parts sped up and packed from the start; ripple off: what follows stays (a gap)",
  JSON.stringify(r2.clips.map((c) => [c.name, c.start, c.in, c.out, (c.fx || {}).speed || 1])) === JSON.stringify([["a.mp4", 0, 0, 5, 1], ["a.mp4", 5, 5, 6, 2], ["b.mp4", 5.5, 0, 1, 2], ["b.mp4", 7, 1, 2, 1]]) && r2.saved === 1, r2);
const r3 = G.speedRange([{ name: "a.mp4", start: 0, in: 0, out: 4, fx: { speed: 4 } }], 0, 1, 4, { split, len, ripple: true });
check("…an already fast clip: at most 10x", r3.clips[0].fx.speed === 10);
let e1 = "", e2 = "";
try { G.speedRange([{ name: "a.mp4", start: 0, in: 0, out: 4, fx: { reverse: true } }], 1, 2, 2, { split, len }); } catch (e) { e1 = e.message; }
try { G.speedRange(clips, 9, 10, 2, { split, len }); } catch (e) { e2 = e.message; }
check("…refused in words: a reversed clip in the range, an empty range", /reversed/.test(e1) && /no clip/.test(e2), [e1, e2]);
check("hoverText: timecode · seconds · frame", G.hoverText(2.04, 24, "00:00:02:01") === "00:00:02:01 · 2.04 s · f 48" && G.hoverText(0.5, 24, "") === "0.50 s · f 12");

const S = read("ext/timelinedock/tlranges.js");
check("the page: a Ctrl TAP (pressed + let go alone, any other key / press cancels) while it plays or over the timeline; ▼ in the ruler + a band on the layer; drag shows the frame (TlCanvas.go); right-click / Del removes",
  /if \(e\.key === "Control"\) \{ if \(!e\.repeat\) armed = performance\.now\(\); return; \}/.test(S) && /if \(!playing\(\) && !overTl\(\)\) return;/.test(S) && /ruler\.appendChild\(mark\(r, i, side\)\)/.test(S) && /tlrband/.test(S)
  && /if \(t !== r\[side\]\) \{ r\[side\] = t; paint\(\); show\(t\); \}/.test(S) && /addEventListener\("contextmenu"/.test(S) && /hsla\(/.test(S));
check("✂ Cut all: /api/timeline/edit per range from the end, the pieces of a clip cut more than once joined (TlJoin.joinChain); ⏩ Speed up: speedRange with H3Marks.splitClip; tl.ranges kept with the timeline",
  /fetch\("\/api\/timeline\/edit"/.test(S) && /TlJoin\.joinChain\(/.test(S) && /H3Marks\.splitClip\(c, t,/.test(S) && /T\.ranges = \[\]/.test(S) && /h3\.tl\.prate/.test(S));
const CV = read("ext/timelinedock/canvas.js"), J = read("ext/timelinedock/tljoin.js"), K = read("ext/timelinedock/tlkeys.js");
check("canvas: ▶ / Space play at S.prate; setRate changes it now when playing forwards; exported",
  /S\.rate = typeof rate === "number" && rate \? rate : \(S\.prate \|\| 1\)/.test(CV) && /function setRate\(r\)/.test(CV) && /setRate: setRate/.test(CV));
check("tljoin: joinChain - two parts or more of one clip into one file; tlkeys: Ctrl (tap) listed",
  /async function joinChain\(lk, kind, ps\)/.test(J) && /parts: ps\.map/.test(J) && /\["Ctrl \(tap\)"/.test(K));
const ej = JSON.parse(read("ext/timelinedock/ext.json")).scripts;
check("tlranges.js loads after tljoin.js", ej.indexOf("tlranges.js") === ej.indexOf("tljoin.js") + 1);
check("server.js untouched by this release", !/tlranges|TlRanges/.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
