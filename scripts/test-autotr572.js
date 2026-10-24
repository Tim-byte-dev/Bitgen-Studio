#!/usr/bin/env node
/* bitGen Studio — 2.572.0 units: ✨ Auto transition (a transition at every cut between video clips on different layers,
 * nothing moved - the clip before held under the next one: c.tail) and 🔇 Video sound (static/tlseq.js; the export keys:
 * lib/tlKeys.tailKeys, routes/index.js, ext/timelinedock/timelinedock.js exportBody, canvas.js, worker.py + cliptail.py).
 * Tim: "can we have an auto transition button with number of frames input in the timeline menubar. for music videos it is
 * important that the lipsync is timed well. add a mute all button to mute all video layers. i prefer to have a full sound
 * clip and the video lipsync match - the full soundclip prevents abrupt cuts in the song" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const Q = require(path.join(ROOT, "static", "tlseq.js"));
const K = require(path.join(ROOT, "lib", "tlKeys.js"));
const len = (c) => c.out - (c.in || 0);

/* 1 the cuts */
const v1 = { name: "V1" }, L2 = { name: "V2", clips: [{ name: "b.mp4", start: 3, in: 0, out: 4 }] }, L3 = { name: "V3", clips: [{ name: "c.mp4", start: 7, in: 1, out: 3 }] },
  L4 = { name: "V4", clips: [{ name: "gap.mp4", start: 20, in: 0, out: 2 }] }, K5 = { name: "K", karaoke: true, clips: [{ name: "k.png", start: 9, in: 0, out: 2 }] };
const tl = { v1, video: [{ name: "a.mp4", start: 0, in: 0, out: 3 }], vlayers: [L2, L3, L4, K5] };
const cs = Q.cuts(tl, len, 24);
check("cuts: every place one video clip ends where another starts on another layer (V1 -> V2 -> V3); a clip after a gap is not a cut; karaoke left out",
  cs.length === 2 && cs[0].a.name === "a.mp4" && cs[0].b.name === "b.mp4" && cs[0].za === -1 && cs[0].zb === 0 && cs[1].a.name === "b.mp4" && cs[1].b.name === "c.mp4" && cs[1].zb === 1, cs.map((x) => [x.a.name, x.b.name]));
const near = Q.cuts({ video: [{ name: "a", start: 0, in: 0, out: 2 }], vlayers: [{ clips: [{ name: "b", start: 2 + 1 / 24, in: 0, out: 2 }] }] }, len, 24);
check("...a cut a frame off still counts (1.5 frames either way)", near.length === 1);
const pl = Q.planTr(cs, 12, "dissolve", 24, len);
check("planTr: 12 frames = 0.5 s - the clip BEFORE gets a 0.5 s tail, the NEXT clip's layer (drawn above it) the dissolve In; no start changes",
  pl.tails.length === 2 && pl.tails[0].clip.name === "a.mp4" && pl.tails[0].tail === 0.5 && pl.trs[0].layer === L2 && pl.trs[0].key === "transitionIn" && pl.trs[0].tr.type === "dissolve" && pl.trs[0].tr.dur === 0.5
  && tl.video[0].start === 0 && L2.clips[0].start === 3 && L3.clips[0].start === 7);
const short = Q.planTr([{ a: { out: 5 }, b: { out: 0.4 }, la: 1, lb: 2, za: 0, zb: 1 }], 24, "wipeleft", 24, len);
check("...never longer than half the next clip (0.4 s clip -> 0.2 s) and on the frame grid", short.tails[0].tail === Math.round(0.2 * 24) / 24 && short.trs[0].tr.dur === short.tails[0].tail && short.trs[0].tr.type === "wipeleft");
const under = Q.planTr([{ a: { name: "top" }, b: { name: "low" }, la: "LA", lb: "LB", za: 3, zb: 1 }], 6, "dissolve", 24, () => 4);
check("...the next clip's layer drawn UNDER the one before: the one before goes Out over its held frames instead", under.trs[0].layer === "LA" && under.trs[0].key === "transitionOut" && under.trs[0].tr.dur === 0.25);

/* 2 the export keys */
check("tailKeys: a tail (0..4 s) goes to the compile, none = nothing", JSON.stringify(K.tailKeys({ tail: 0.5 })) === '{"tail":0.5}' && JSON.stringify(K.tailKeys({ tail: 9 })) === '{"tail":4}' && JSON.stringify(K.tailKeys({})) === "{}");
const RI = rd("routes", "index.js"), TD = rd("ext", "timelinedock", "timelinedock.js"), CV = rd("ext", "timelinedock", "canvas.js"), WK = rd("misc/worker.py"), SQ = rd("static", "tlseq.js");
check("the tail reaches the compile: the page sends it for V1 and the video layers, the route keeps it for both, the worker renders the tails right after the clip fx",
  (TD.match(/tail: c\.tail > 0 \? c\.tail : undefined/g) || []).length === 2 && (RI.match(/\.\.\.tlKeys\.tailKeys\(c\)/g) || []).length === 2
  && /import cliptail as _ctail/.test(WK) && WK.indexOf("_ctail.prepare(tl") > WK.indexOf("_cfx.prepare(tl") && WK.indexOf("_ctail.prepare(tl") < WK.indexOf('vids = tl["video"]'));
check("the canvas shows the held clip under the next one (at() runs on through its tail; not for pictures)", /function tailOf\(c, kind\) \{ return kind !== "img" && c && \+c\.tail > 0 \? \+c\.tail : 0; \}/.test(CV) && /t < clipEnd\(c, kind\) \+ tailOf\(c, kind\) - 1e-6/.test(CV));
check("the bar: ✨ Auto transition + frames + type, 🔇 Video sound; on = kept on every save AFTER ⛓ Sequential's arranging; a transition the user set stays; off takes away only what it added",
  /id="tlAutoTr"/.test(SQ) && /id="tlAutoTrN" type="number" min="1" max="96"/.test(SQ) && /id="tlAutoTrT"/.test(SQ) && /id="tlMuteV"/.test(SQ)
  && SQ.indexOf("if (on()) apply();") < SQ.indexOf("if (atOn()) applyAuto();") && /if \(cur && cur\.type && cur\.type !== "none" && !t\.layer\["auto_" \+ t\.key\]\) continue;/.test(SQ) && /if \(c && c\.autoTail\) \{ delete c\.tail; delete c\.autoTail; \}/.test(SQ));
check("Sequential never counts a tail (the next clip starts where the clip's own frames end)", /const lenOf = \(c\) => \(c\.len != null && c\.out == null \? imgLen\(c\) : effDur\(c\)\);/.test(SQ) && !/tail/.test(SQ.slice(SQ.indexOf("function arrange"), SQ.indexOf("function cuts"))));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
