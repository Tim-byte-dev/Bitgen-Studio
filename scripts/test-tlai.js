#!/usr/bin/env node
/* bitGen Studio — 2.420.0 units: 🤖 AI INSIDE THE TIMELINE
 *   1. scripts/beats.py finds the beats of click tracks (120 and 95 BPM, with noise) to within 30 ms
 *   2. static/tlai.js: the gap under the position marker, the render size / frames, TAKES (a new take in the same slot,
 *      switching back), the ripple an extension makes, the beat cuts and markers
 *   3. the wiring: routes/tlai mounted, the page's 🤖 dialog renders with the prompt docker + ⊖ negative docker through
 *      /api/generate or /api/ltx
 * Tim: "yes, please add your 2 suggestions" (AI inside the timeline). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tlai_"));

/* ---- 1. beats */
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*880*t)*exp(-40*mod(t,0.5))':s=44100:d=12", "-ac", "1", path.join(TMP, "c120.wav")]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*600*t)*exp(-30*mod(t-0.1,60/95))':s=44100:d=15", "-f", "lavfi", "-i", "anoisesrc=d=15:c=pink:a=0.05",
  "-filter_complex", "amix=inputs=2", "-ac", "1", path.join(TMP, "c95.wav")]);
const B = (f, a) => JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts", "beats.py"), path.join(TMP, f)].concat(a || []), { encoding: "utf8" }));
const b120 = B("c120.wav"), b95 = B("c95.wav");
const near = (beats, grid, off) => beats.filter((t) => t > 0.3).every((t) => { const k = Math.round((t - off) / grid); return Math.abs(t - (off + k * grid)) < 0.03; });
check("beats.py: a 120 BPM click track -> 120 BPM, a beat every 0.5 s on the clicks (within 30 ms)", Math.abs(b120.tempo - 120) < 1.5 && b120.beats.length >= 20 && near(b120.beats, 0.5, 0), { t: b120.tempo, b: b120.beats.slice(0, 6) });
check("...95 BPM under pink noise -> 95 BPM, on the clicks", Math.abs(b95.tempo - 95) < 1.5 && near(b95.beats, 60 / 95, 0.1), { t: b95.tempo, b: b95.beats.slice(0, 6) });
const bp = B("c120.wav", ["3", "4"]);
check("...a stretch of it (start 3 s, 4 s long): beats in ITS seconds; silence = no beats", bp.dur === 4 && near(bp.beats, 0.5, 0) && bp.beats.every((t) => t <= 4.01), bp);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "3", path.join(TMP, "sil.wav")]);
check("...silence = no beats", B("sil.wav").beats.length === 0);

/* ---- 2. the maths */
const A = require(path.join(ROOT, "static", "tlai.js"));
const V1 = [{ name: "a.mp4", start: 0, in: 0, out: 4, dur: 10 }, { name: "b.mp4", start: 6, in: 2, out: 5, dur: 8 }];
check("gapAt: the empty stretch of V1 under t (4 - 6), none on a clip, after the last clip up to `end`, none past it",
  JSON.stringify(A.gapAt(V1, 5, 20)) === '{"a":4,"b":6}' && A.gapAt(V1, 1, 20) === null && JSON.stringify(A.gapAt(V1, 12, 15)) === '{"a":9,"b":15}' && A.gapAt(V1, 12, 0) === null);
check("size: the long side <= 1280, multiples of 32, at least 256; frames: 24 a second, at least 25",
  JSON.stringify(A.size(1920, 1080)) === '{"w":1280,"h":736}' && JSON.stringify(A.size(1080, 1920)) === '{"w":736,"h":1280}' && JSON.stringify(A.size(320, 180)) === '{"w":320,"h":256}'
  && A.frames(4) === 96 && A.frames(0.5) === 25);
const c = { name: "a.mp4", src: "video", start: 2, in: 1, out: 4, dur: 10, opacity: 0.8, tf: { x: 5, y: 0, scale: 1, rot: 0 }, kf: [{ at: 0, op: 1 }], fx: { grade: { exposure: 1 }, speed: 2 } };
const t1 = A.addTake(c, { name: "take2.mp4", src: "output", in: 0, out: 5, dur: 5 });
check("addTake: the new file in the SAME slot (start, length kept: 3 s of its 5), place / opacity / keyframes / grade kept, the speed dropped (it plays straight); the old file is take 1",
  t1.name === "take2.mp4" && t1.src === "output" && t1.start === 2 && t1.in === 0 && Math.abs(t1.out - 1.5) < 1e-6 && t1.opacity === 0.8 && t1.tf.x === 5 && t1.kf.length === 1 && t1.fx.grade && t1.fx.speed === undefined
  && t1.takes.length === 2 && t1.takes[0].name === "a.mp4" && t1.takes[0].in === 1 && t1.take === 1, t1);
const c2 = Object.assign({}, c, { fx: undefined });
const t2 = A.addTake(c2, { name: "t.mp4", src: "output", in: 0, out: 2, dur: 2 });
check("...a take SHORTER than the slot plays whole (2 s of a 3 s slot); useTake(0) brings the first file back exactly",
  Math.abs(t2.out - 2) < 1e-6 && (() => { const u = A.useTake(t2, 0); return u.name === "a.mp4" && u.in === 1 && u.out === 4 && u.take === 0 && u.takes.length === 2; })(), t2);
const r = A.rippleAfter(V1, 4, 2.5);
check("rippleAfter: every clip from the end of the extended clip on moves by the extension (6 -> 8.5); the ones before stay", r[0].start === 0 && r[1].start === 8.5);
const beats = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
check("beatCuts: inside the clip only (2 - 5 s on the timeline, a song starting at 1 s), every 2nd beat; beatMarks between two times",
  JSON.stringify(A.beatCuts(beats, { start: 2, in: 1, out: 4 }, 1, 1)) === "[2.5,3,3.5,4,4.5]" && JSON.stringify(A.beatCuts(beats, { start: 2, in: 1, out: 4 }, 2, 1)) === "[2.5,3.5,4.5]"
  && JSON.stringify(A.beatMarks(beats, 1, 2, 2, 4)) === "[2.5,3.5]");

/* ---- 3. the wiring */
const TJ = read("ext", "timelinedock", "tlai.js"), IX = read("routes", "index.js");
check("routes/tlai.js mounted (frame, probe, beats); the 🤖 dialog + static/tlai.js loaded", /require\("\.\/tlai"\)\.mount\(app\)/.test(IX) && /\/api\/tlai\/beats/.test(read("routes", "tlai.js"))
  && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("tlai.js") && /<script src="\/static\/tlai\.js"><\/script>/.test(read("static", "index.html")));
check("the renders use the PROMPT DOCKER and the ⊖ NEGATIVE DOCKER, through /api/ltx for an LTX style, else /api/generate (fl2va with a first frame, else t2va)",
  /var p = \$\("prompt"\); return p \? p\.value\.trim\(\) : "";/.test(TJ) && /if \(neg\) fd\.append\("negative", neg\);/.test(TJ) && /url = "\/api\/ltx";/.test(TJ) && /fd\.append\("mode", first \? "fl2va" : "t2va"\);/.test(TJ)
  && /write what to render in the prompt docker/.test(TJ));
check("the four tools: 🔁 New take (+ ⇆ takes), ⇥ Extend from the last frame, 🎞 B-roll (gap / cutaway with its sound off), ✂ beats (markers / cuts)",
  /id="taiTake"/.test(TJ) && /id="taiTakes"/.test(TJ) && /id="taiExtend"/.test(TJ) && /<option value="cut">a cutaway/.test(TJ) && /L\.muted = true;/.test(TJ) && /id="taiMarkBeats"/.test(TJ) && /id="taiCutBeats"/.test(TJ));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
