#!/usr/bin/env node
/* bitGen Studio — 2.612.0 (pure + wiring): a CUT clip stays ONE clip; "✂ to new layer" puts the after-cut part on a new layer.
 * Tim: "when clips are cut the remaining portion is being put next to the part before the cut as a separate clip, it is
 * leaving a black frame that can't be edited - can we merge the before cut and after cut portion of the layer so it is 1
 * continuous clip - add a checkbox to the timeline to cut to new layer - then put the after cut portion on a new layer".
 *   lib/tlJoin.js                 plan, outName, filterOf (+ POST /api/timeline/join in routes/tlJoin.js)
 *   ext/timelinedock/tljoin.js    joinKind, merged, newSlot, plainPicture; applySel wrapped; the box
 *   tlkeys.js (Ctrl+K split to a new layer), tlrange.js (glue: the join is the cut's ↶ step),
 *   canvas.js (a clip about to start is loaded + parked on its first frame - no black frame at a cut) */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const L = require(path.join(R, "lib", "tlJoin.js"));
const J = require(path.join(R, "ext", "timelinedock", "tljoin.js"));
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };

const pl = L.plan({ kind: "video", name: "sub/shot.MOV", src: "video", parts: [[0, 1.0000004], [2, 4]] });
check("plan: the parts of ONE file (rounded), the length, .mp4 for a video (.webm kept - transparency), .flac for a sound",
  pl.name === "shot.MOV" && pl.ext === ".mp4" && pl.dur === 3 && JSON.stringify(pl.parts) === "[[0,1],[2,4]]" && L.plan({ name: "a.webm", parts: [[0, 1], [2, 3]] }).ext === ".webm" && L.plan({ kind: "audio", name: "s.wav", parts: [[0, 1], [2, 3]] }).ext === ".flac", pl);
check("plan refuses in words: no name, one part, a part ending before it starts",
  throws(() => L.plan({ parts: [[0, 1], [2, 3]] }), /which clip/) && throws(() => L.plan({ name: "a.mp4", parts: [[0, 1]] }), /two parts/) && throws(() => L.plan({ name: "a.mp4", parts: [[0, 1], [3, 2]] }), /out after in/));
const taken = new Set(["shot-join1.mp4", "shot-join2.mp4"]);
check("outName: <name>-join<n> - the first free n; a joined clip joined again is not <name>-join1-join1",
  L.outName("shot.mov", ".mp4", (f) => taken.has(f)) === "shot-join3.mp4" && L.outName("shot-join2.mp4", ".mp4", () => false) === "shot-join1.mp4" && L.outName("a b(1).webm", ".webm") === "a b(1)-join1.webm");
const fc = L.filterOf([[0, 1], [2, 4]], true, true);
check("filterOf: each part trimmed (decoded - frame-exact), its time from 0, then one after the other (picture + sound)",
  fc === "[0:v]trim=start=0:end=1,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end=1,asetpts=PTS-STARTPTS[a0];[0:v]trim=start=2:end=4,setpts=PTS-STARTPTS[v1];[0:a]atrim=start=2:end=4,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
  && L.filterOf([[0, 1], [2, 4]], false, true).endsWith("[v0][v1]concat=n=2:v=1:a=0[v]") && L.filterOf([[0, 1], [2, 4]], true, false).endsWith("[a0][a1]concat=n=2:v=0:a=1[a]"), fc);

const h = { name: "a.mp4", src: "video", start: 0, in: 0, out: 1, dur: 4, opacity: 1 }, t = { name: "a.mp4", src: "video", start: 1, in: 2, out: 4, dur: 4, opacity: 1 };
check("joinKind: the two parts of a cut video meet = one FILE; parts that meet in the file too = just longer; a picture = longer",
  J.joinKind(h, t, "video", 24) === "file" && J.joinKind(h, Object.assign({}, t, { in: 1 }), "video", 24) === "extend"
  && J.joinKind({ name: "p.png", start: 0, len: 1 }, { name: "p.png", start: 1, len: 2 }, "image", 24) === "extend");
check("…kept two (in words): ripple off (they don't meet), another file, a retimed clip, a cut-out, a text / 3D clip, a text picture",
  /do not meet/.test(J.joinKind(h, Object.assign({}, t, { start: 2 }), "video", 24)) && /same file/.test(J.joinKind(h, Object.assign({}, t, { name: "b.mp4" }), "video", 24))
  && /retimed/.test(J.joinKind(Object.assign({}, h, { fx: { speed: 2 } }), t, "video", 24)) && /retimed/.test(J.joinKind(h, Object.assign({}, t, { fx: { reverse: true } }), "video", 24))
  && /cut-out/.test(J.joinKind(Object.assign({}, h, { cut: { from: 0 } }), t, "video", 24)) && /text/.test(J.joinKind(Object.assign({}, h, { m3d: {} }), t, "video", 24))
  && /text/.test(J.joinKind({ name: "x.png", start: 0, len: 1, text: {} }, { name: "x.png", start: 1, len: 1, text: {} }, "image", 24)) && J.joinKind(h, null, "video", 24) === "the cut left one part");
const m = J.merged(Object.assign({ _tlj: "j1_0", kf: [{ at: 0.2, op: 1 }] }, h), t, "video", { name: "a-join1.mp4", dur: 3, src: "video" });
check("merged: the first part's settings (keyframes too), the new file from 0 for both parts' length; just longer: its out / len",
  m.name === "a-join1.mp4" && m.in === 0 && m.out === 3 && m.dur === 3 && m.start === 0 && m.kf.length === 1 && !("_tlj" in m)
  && J.merged(h, Object.assign({}, t, { in: 1 }), "video", null).out === 4 && J.merged({ name: "p", start: 0, len: 1 }, { name: "p", start: 1, len: 2.5 }, "image", null).len === 3.5
  && !("src" in J.merged({ name: "s.wav", src: "video", start: 0, in: 0, out: 1 }, { name: "s.wav", start: 1, in: 2, out: 3 }, "audio", { name: "s-join1.flac", dur: 2 })));
check("newSlot: the after-cut layer right above - V1's is the first video layer",
  JSON.stringify(J.newSlot("v1")) === JSON.stringify({ arr: "vlayers", at: 0 }) && J.newSlot("vl:2").at === 3 && J.newSlot("vl:2").arr === "vlayers" && J.newSlot("a:0").arr === "audio" && J.newSlot("i:1").at === 2 && J.newSlot("x") === null);

const S = read("ext/timelinedock/tljoin.js"), RT = read("routes/tlJoin.js"), RI = read("routes/index.js");
check("the page: applySel wrapped - the clips the cut's end goes through tagged, their parts found after it, ONE ↶ step (TlRange.glue), the join over POST /api/timeline/join; the box kept (h3.tl.cutNew)",
  /root\.applySel = w/.test(S) && /c\._tlj = base \+ i/.test(S) && /fetch\("\/api\/timeline\/join"/.test(S) && /TlRange\.glue\(\)/.test(S) && /"h3\.tl\.cutNew"/.test(S) && /id="tlCutNew"/.test(S) && /toNewLayer\(lk, moved\)/.test(S));
check("the server: routes/tlJoin.js mounted from routes/index.js (POST /api/timeline/join -> lib/tlJoin.join)",
  /app\.post\("\/api\/timeline\/join"/.test(RT) && /tlJoin\.join\(req\.body/.test(RT) && /require\("\.\/tlJoin"\)\.mount\(app\)/.test(RI));
const K = read("ext/timelinedock/tlkeys.js"), RG = read("ext/timelinedock/tlrange.js"), CV = read("ext/timelinedock/canvas.js");
check("Ctrl+K split honours the box (the part after it on a new layer); tlrange's glue(); canvas: a clip starting within a second loaded + parked on its first frame",
  /TlJoin\.toNew\(\)/.test(K) && /TlJoin\.toNewLayer\(k, after\[k\]\)/.test(K) && /function glue\(\) \{ lastAt = Date\.now\(\); \}/.test(RG) && /glue: glue/.test(RG)
  && /ahead > 0 && ahead <= PREROLL/.test(CV) && /var PREROLL = 1\.0;/.test(CV));
const ej = JSON.parse(read("ext/timelinedock/ext.json")).scripts;
check("tljoin.js loads after tlframe.js", ej.indexOf("tljoin.js") === ej.indexOf("tlframe.js") + 1);
check("server.js untouched by this release", !/tlJoin|timeline\/join/.test(read("misc/server.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
