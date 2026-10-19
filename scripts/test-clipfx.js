#!/usr/bin/env node
/* bitGen Studio — 2.406.0 unit tests: the timeline clip fx maths (static/clipfx.js - the page, the canvas and the
 * compile share it), the keep / cut and span maths for a retimed clip, the export's keys (lib/clipFx), the caption
 * track (lib/captions.js + scripts/captions_ass.py) and the mix's filtergraph (scripts/mixfx.py).
 * Tim: "lets start closing the gap and go with your suggestions as you see fit". No app, no ffmpeg needed. */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const E = require(path.join(ROOT, "lib", "timelineEdit.js"));
const SP = require(path.join(ROOT, "lib", "timelineSpan.js"));
const CAP = require(path.join(ROOT, "lib", "captions.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

/* ---- normalize */
check("normalize: identity -> null", FX.normalize({ speed: 1, grade: { exposure: 0, saturation: 100 }, afx: { denoise: 0 } }) === null);
check("normalize: clamps + drops the defaults", JSON.stringify(FX.normalize({ speed: 50, grade: { exposure: 9, saturation: 100, hue: -500 }, blend: "flow" }))
  === JSON.stringify({ speed: 10, blend: "flow", grade: { exposure: 3, hue: -180 } }), FX.normalize({ speed: 50, grade: { exposure: 9, saturation: 100, hue: -500 }, blend: "flow" }));
check("normalize: a ramp overrides the speed, keys sorted, 8 at most", (() => { const n = FX.normalize({ speed: 3, ramp: [{ p: 1, s: 2 }, { p: 0, s: 0.5 }] }); return !n.speed && n.ramp[0].p === 0 && n.ramp[1].s === 2; })());
check("normalize: a one-key ramp is no ramp", FX.normalize({ ramp: [{ p: 0, s: 2 }] }) === null);
check("normalize: a LUT name must be a plain .cube", FX.normalize({ lut: "../x.cube" }) === null && FX.normalize({ lut: "a.cube" }).lut_mix === 1);
check("normalize: sound clean-up kept", JSON.stringify(FX.normalize({ afx: { voice: 1, denoise: 2, gain: -40 } }).afx) === JSON.stringify({ denoise: 1, voice: true, gain: -24 }));
check("normalize: a look label alone is nothing", FX.normalize({ look: "mono" }) === null);

/* ---- time */
const c2 = { in: 1, out: 11, fx: { speed: 2 } };
check("speed 2: 10 s -> 5 s", near(FX.clipLen(c2), 5));
check("speed 2: srcTime(1 s) = in + 2", near(FX.srcTime(c2, 1), 3));
check("speed 0.5: 4 s -> 8 s", near(FX.clipLen({ in: 0, out: 4, fx: { speed: 0.5 } }), 8));
const cr = { in: 2, out: 6, fx: { reverse: true } };
check("reverse: same length, starts at out, ends at in", near(FX.clipLen(cr), 4) && near(FX.srcTime(cr, 0), 6) && near(FX.srcTime(cr, 4), 2));
const ramp = FX.normalize({ ramp: FX.RAMPS["slow → fast"] });
const sg = FX.segments(4, ramp);
check("ramp: 16 segments for 4 s, contiguous, slow to fast", sg.length === 16 && sg.every((s, i) => i === 0 || near(s.t0, sg[i - 1].t1)) && sg[0].s < 1 && sg[15].s > 2);
check("ramp: the timeline length = the sum of the segments", near(FX.timelineLen(4, ramp), sg.reduce((a, s) => a + (s.q1 - s.q0) / s.s, 0)));
let mono = true, prev = -1;
for (let t = 0; t < FX.timelineLen(4, ramp); t += 0.05) { const q = FX.srcTime({ in: 0, out: 4, fx: ramp }, t); if (q < prev - 1e-9) mono = false; prev = q; }
check("ramp: srcTime only moves forward", mono);
check("ramp: srcTime at the end = out", near(FX.srcTime({ in: 0, out: 4, fx: ramp }, 99), 4));
check("rate: speed 2 = 2 source s per timeline s", near(FX.rate(c2), 2));
check("segments: plain = one at speed 1", FX.segments(3, null).length === 1 && FX.segments(3, null)[0].s === 1);

/* ---- slice (keep / cut) */
const sl = FX.slice({ in: 0, out: 10, fx: { speed: 2 } }, 1, 3);
check("slice speed 2: timeline 1..3 = source 2..6", near(sl.in, 2) && near(sl.out, 6) && sl.fx.speed === 2);
const sr = FX.slice({ in: 0, out: 10, fx: { reverse: true } }, 0, 4);
check("slice reversed: timeline 0..4 = source 6..10", near(sr.in, 6) && near(sr.out, 10));
const sm = FX.slice({ in: 0, out: 4, fx: ramp }, 0, FX.timelineLen(4, ramp) / 2);
check("slice of a ramp: the ramp re-fitted (starts slow, ends at the speed of the cut)", sm.fx.ramp[0].s < 1 && sm.fx.ramp[sm.fx.ramp.length - 1].p === 1, sm);
check("timelineEdit.extent: a 2x clip covers half", JSON.stringify(E.extent({ start: 3, in: 0, out: 10, fx: { speed: 2 } }, "video")) === "[3,8]");
check("timelineEdit.extent: plain unchanged", JSON.stringify(E.extent({ start: 3, in: 1, out: 4 }, "video")) === "[3,6]");
const kept = E.apply ? E.apply("keep", [{ name: "a", start: 0, in: 0, out: 10, dur: 10, fx: { speed: 2 } }], "video", 1, 3, { ripple: false }) : null;
check("keep on a 2x clip: source 2..6, 2 s on the timeline", kept && kept.length === 1 && near(kept[0].in, 2) && near(kept[0].out, 6) && near(E.extent(kept[0], "video")[1] - E.extent(kept[0], "video")[0], 2), kept);
check("timelineSpan: tl_len wins", SP.clipLength({ in: 0, out: 10, tl_len: 5 }) === 5 && SP.sceneEnd({ video: [{ start: 1, in: 0, out: 10, tl_len: 5 }] }) === 6);
const spanPy = py("import timeline_span as t; print(t.clip_length({'in':0,'out':10,'tl_len':5}), t.scene_end({'video':[{'start':1,'in':0,'out':10,'tl_len':5}]}))").trim();
check("timeline_span.py: tl_len wins too", spanPy === "5.0 6.0", spanPy);

/* ---- colour */
const id = FX.buildLut({}, null, 9);
let maxd = 0;
for (let z = 0, i = 0; z < 9; z++) for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++, i += 3) maxd = Math.max(maxd, Math.abs(id[i] - x / 8), Math.abs(id[i + 1] - y / 8), Math.abs(id[i + 2] - z / 8));
check("buildLut: no grade = identity, R fastest", maxd < 1e-6);
const cube = FX.parseCube(FX.toCube(FX.buildLut({ grade: { saturation: 0 } }, null, 17), 17, "t"));
check("toCube -> parseCube round trip (17³)", cube.size === 17 && cube.data.length === 17 * 17 * 17 * 3);
const g = FX.sampleCube(cube, 0.9, 0.2, 0.1);
check("a saturation-0 cube makes grey", near(g[0], g[1], 2e-3) && near(g[1], g[2], 2e-3), g);
check("gradeRgb: +1 stop brighter, mid grey", FX.gradeRgb(0.5, 0.5, 0.5, { exposure: 1 })[0] > 0.65);
check("gradeRgb: warm = redder", (() => { const o = FX.gradeRgb(0.5, 0.5, 0.5, { temperature: 50 }); return o[0] > o[2] + 0.05; })());
check("gradeRgb: hue 120° turns red to green", (() => { const o = FX.gradeRgb(0.8, 0.1, 0.1, { hue: 120 }); return o[1] > o[0] && o[1] > o[2]; })());
check("the LUT under the grade, mixed", (() => {
  const inv = { size: 2, min: [0, 0, 0], max: [1, 1, 1], data: new Float32Array([1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0]) };
  const full = FX.buildLut({ lut: "inv.cube", lut_mix: 1 }, inv, 2), half = FX.buildLut({ lut: "inv.cube", lut_mix: 0.5 }, inv, 2);
  return near(full[0], 1) && near(half[0], 0.5);
})());
let threw = ""; try { FX.parseCube("LUT_3D_SIZE 2\n0 0 0\n"); } catch (e) { threw = e.message; }
check("parseCube: a short table refused in words", /needs 8/.test(threw), threw);
check("lookKey: same look same key, the LUT mix counts", FX.lookKey({ grade: { hue: 2 } }) === FX.lookKey({ grade: { hue: 2 } }) && FX.lookKey({ lut: "a.cube", lut_mix: 1 }) !== FX.lookKey({ lut: "a.cube", lut_mix: 0.5 }));

/* ---- the export's keys */
const L = require(path.join(ROOT, "lib", "clipFx.js"));
const k = L.clipKeys({ name: "a.mp4", in: 1, out: null, dur: 9, fx: { speed: 2 } });
check("clipKeys: segments + tl_len (untrimmed: in..dur)", k.fx.segments.length === 1 && k.fx.segments[0].q1 === 8 && k.tl_len === 4 && k.fx.tl_len === undefined, k);
check("clipKeys: no fx -> nothing", JSON.stringify(L.clipKeys({ name: "a" })) === "{}");
let e1 = ""; try { L.clipKeys({ name: "a.mp4", in: 0, fx: { reverse: true } }); } catch (e) { e1 = e.message + e.status; }
check("clipKeys: a retimed clip with no length -> 400 in words", /needs its length.*400$/.test(e1), e1);
check("soundKeys: music by default, the clean-up only", JSON.stringify(L.soundKeys({ fx: { speed: 2, afx: { gain: 3 } } })) === JSON.stringify({ role: "music", fx: { afx: { gain: 3 } } }));
check("role: unknown -> the default", L.role("dj", "voice") === "voice" && L.role("sfx", "voice") === "sfx");
check("mixCfg: off -> null, clamped", L.mixCfg({ duck: { on: false } }) === null && L.mixCfg({ duck: { on: true, amount: 99 } }).duck.amount === 30 && L.mixCfg({ loudness: { on: 1, target: -99 } }).loudness.target === -30);

/* ---- the compile's filtergraphs (python) */
const gph = JSON.parse(py(`import clipfx_render as R
info={"video":True,"audio":True,"fps":30.0,"alpha":False,"dur":4,"vcodec":"h264"}
g1=R.graph({"segments":[{"q0":0,"q1":4,"s":2}]},info,4)
g2=R.graph({"segments":[{"q0":0,"q1":2,"s":0.5},{"q0":2,"q1":4,"s":2}],"reverse":True,"blend":"flow","lut_file":"C:\\\\x y\\\\a'b.cube","afx":{"voice":True,"gain":-3}},info,4)
print(json.dumps({"g1":g1,"g2":g2,"at":R.atempo(5),"at2":R.atempo(0.2)}))`));
check("render graph: speed 2 = setpts/2 + atempo 2, 2 s", /setpts=PTS\/2\.0+/.test(gph.g1[0]) && /atempo=2\.0/.test(gph.g1[0]) && near(gph.g1[3], 2), gph.g1);
check("render graph: a ramp = trims + concat, reversed first, flow, the LUT path escaped, the clean-up, 5 s", /reverse,split=2/.test(gph.g2[0]) && /concat=n=2:v=1:a=0/.test(gph.g2[0])
  && /minterpolate/.test(gph.g2[0]) && /lut3d=file='C\\:\/x y\/a\\'b\.cube'/.test(gph.g2[0]) && /areverse/.test(gph.g2[0]) && /highpass=f=80/.test(gph.g2[0]) && /volume=-3\.00dB/.test(gph.g2[0]) && near(gph.g2[3], 5), gph.g2);
check("atempo: 5x and 0.2x as chains of 0.5..2", JSON.stringify(gph.at) === JSON.stringify(["atempo=2.0", "atempo=2.0", "atempo=1.250000"]) && JSON.stringify(gph.at2) === JSON.stringify(["atempo=0.5", "atempo=0.5", "atempo=0.800000"]), gph);
const mx = JSON.parse(py(`import mixfx as M
p=[]; out=M.mix(p,[("[a0]","voice"),("[a1]","music"),("[a2]","sfx")],{"duck":{"on":True,"amount":12},"loudness":{"on":True,"target":-16}})
q=[]; M.mix(q,[("[a0]","music")],{"duck":{"on":True}})
print(json.dumps({"p":p,"out":out,"q":q,"act":[M.active(None),M.active({"duck":{"on":True}})]}))`));
check("mix: the music keyed by the voices, the sfx untouched, loudnorm -16", mx.out === "[aout]" && mx.p.some((x) => /sidechaincompress/.test(x) && x.startsWith("[dkm][dkvk]"))
  && mx.p.some((x) => /^\[dkvo\]\[dkmd\]\[a2\]amix=inputs=3/.test(x)) && /loudnorm=I=-16\.0:TP=-1\.5/.test(mx.p[mx.p.length - 1]), mx.p);
check("mix: ducking with no voice = left as is (one input, anull)", mx.q.length === 2 && /anull\[aout\]$/.test(mx.q[1]), mx.q);
check("mix: active only when something is on", mx.act[0] === false && mx.act[1] === true);

/* ---- captions */
const words = CAP.wordsOf([{ start: 0, end: 2, text: "one two", words: [{ start: 0.1, end: 0.5, word: "one" }, { start: 0.6, end: 1, word: "two." }] },
                          { start: 3, end: 4, text: "three four", words: [] }]);
check("wordsOf: timed words kept, an untimed segment spread", words.length === 4 && words[2].start === 3 && near(words[3].start, 3.5));
const clip = { name: "a", start: 10, in: 0, out: 5, fx: { speed: 2 } };
check("tlTime: a 2x clip at 10 s - source 4 s -> 12 s; outside the trim -> null", near(CAP.tlTime(clip, 4), 12, 1e-3) && CAP.tlTime(clip, 6) === null);
check("tlTime: reversed - source 5 -> its start", near(CAP.tlTime({ start: 0, in: 0, out: 5, fx: { reverse: true } }, 5), 0, 1e-3));
const many = []; for (let i = 0; i < 30; i++) many.push({ start: i * 0.3, end: i * 0.3 + 0.25, word: "word" + i });
const cues = CAP.cut(many, { maxChars: 30 });
check("cut: cues of 30 chars at most, in order, not overlapping", cues.every((c) => c.text.length <= 30) && cues.every((c, i) => i === 0 || c.start >= cues[i - 1].end), cues.slice(0, 3));
check("cut: a sentence end closes a cue", CAP.cut([{ start: 0, end: 0.4, word: "Hello" }, { start: 0.5, end: 0.9, word: "there." }, { start: 1, end: 1.3, word: "Next" }], { maxChars: 42 }).length === 2);
check("speakers: V1 + voice layers + voice sound layers; music and muted out", CAP.speakers({
  video: [{ name: "v.mp4" }], v1: {}, vlayers: [{ clips: [{ name: "o.mp4" }] }, { role: "music", clips: [{ name: "m.mp4" }] }],
  audio: [{ clips: [{ name: "song.wav" }] }, { role: "voice", clips: [{ name: "vo.wav" }] }, { role: "voice", muted: true, clips: [{ name: "x.wav" }] }] }).map((c) => c.name).join() === "v.mp4,o.mp4,vo.wav");
(async () => {
  const seen = [];
  const r = await CAP.build({ video: [{ name: "v.mp4", start: 2, in: 1, out: 5 }, { name: "v.mp4", start: 10, in: 0, out: 1 }], v1: {},
    audio: [{ role: "voice", clips: [{ name: "quiet.wav", start: 0, in: 0, out: 3 }] }] }, {
    transcribe: async (name) => { seen.push(name); if (name === "quiet.wav") throw new Error("nothing was transcribed — is there speech"); return { segments: [{ start: 0, end: 6, text: "a b c", words: [{ start: 0.5, end: 0.8, word: "a" }, { start: 1.5, end: 1.8, word: "b" }, { start: 4.2, end: 4.6, word: "c." }] }], cached: true }; } });
  check("build: each file transcribed once", seen.join() === "v.mp4,quiet.wav", seen);
  check("build: the words on the timeline (each clip's trim + start), the silent one skipped",
    r.cues.map((c) => c.text).join("|") === "b|c.|a" && near(r.cues[0].start, 2.5) && near(r.cues[1].start, 5.2) && near(r.cues[2].start, 10.5)
    && r.sources[0].words === 3 && r.skipped[0].why === "no speech", r);
  let e3 = ""; try { await CAP.build({ video: [], v1: {} }); } catch (e) { e3 = e.message; }
  check("build: nothing speaks -> said", /nothing on the timeline speaks/.test(e3), e3);
  const n = CAP.normalize({ cues: [{ start: 2, end: 3, text: " hi " }, { start: 1, end: 0.5, text: "bad" }, { start: 0, end: 1, text: "" }], style: { size: 99, color: "red", position: "side" }, srt: true });
  check("normalize captions: bad cues out, style clamped, burn by default", n.cues.length === 1 && n.cues[0].text === "hi" && n.style.size === 20 && n.style.color === "#ffffff" && n.style.position === "bottom" && n.burn && n.srt, n);
  check("normalize captions: off / empty -> null", CAP.normalize({ cues: [], burn: true }) === null && CAP.normalize({ cues: [{ start: 0, end: 1, text: "x" }], burn: false, srt: false }) === null
    && CAP.normalize({ cues: [{ start: 0, end: 1, text: "x" }], visible: false }) === null);
  check("toSrt", CAP.toSrt([{ start: 61.5, end: 3725.004, text: "x" }]) === "1\n00:01:01,500 --> 01:02:05,004\nx\n");
  const as = JSON.parse(py(`import captions_ass as C
c={"cues":[{"start":0.5,"end":1.25,"text":"Hi {there}\\nyou"},{"start":3,"end":2,"text":"bad"}],"style":{"size":10,"box":True,"box_color":"#ff0000","box_opacity":0.5,"position":"top","margin":5}}
print(json.dumps({"ass":C.ass(c,1920,1080),"srt":C.srt(c)}))`));
  check("ASS: the frame size, the style (108 px, top, a half-clear red box), the cue escaped", /PlayResX: 1920\nPlayResY: 1080/.test(as.ass) && /Style: Cap,Arial,108,&H00FFFFFF,&H000000FF,&H800000FF,&H800000FF,-1,0,0,0,100,100,0,0,3,/.test(as.ass)
    && /,8,115,115,54,1\n/.test(as.ass) && /Dialogue: 0,0:00:00\.50,0:00:01\.25,Cap,,0,0,0,,Hi \(there\)\\Nyou/.test(as.ass) && !/bad/.test(as.ass), as.ass);
  check("SRT (python) = SRT (node)", as.srt === CAP.toSrt([{ start: 0.5, end: 1.25, text: "Hi {there}\nyou" }]), [as.srt, CAP.toSrt([{ start: 0.5, end: 1.25, text: "Hi {there}\nyou" }])]);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
