#!/usr/bin/env node
/* bitGen Studio — 2.412.0 units: Premiere's smaller jobs - drop-frame timecode, ProRes 4444 with alpha + H.264 10-bit +
 * VAAPI, marker ranges + clip markers, J / L cuts on every video layer and on retimed clips, track targeting + linked
 * selection (a video's sound as its own clip), EQ / multiband / reverb, hue-vs-hue / hue-vs-sat curves, effect keyframes.
 * Tim: "do the smaller jobs and complete the 10 partly done jobs". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const py = (code, cwd) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: cwd || ROOT });

/* ---- 1. drop-frame timecode */
const TC = require(path.join(ROOT, "static", "timecode.js"));
check("canDrop: 29.97 / 59.94 only; rate: 29.97 = 30000/1001", TC.canDrop(29.97) && TC.canDrop(59.94) && !TC.canDrop(30) && !TC.canDrop(23.976) && !TC.canDrop(25)
  && near(TC.rate(29.97), 30000 / 1001) && TC.rate(25) === 25);
check("fmt drop-frame: frame 1800 = 00:01:00;02 (two numbers skipped), 17982 = 00:10:00;00 (the tenth minute keeps them), 1 h = 01:00:00;00",
  TC.fmt(1800, 29.97, true) === "00:01:00;02" && TC.fmt(1799, 29.97, true) === "00:00:59;29" && TC.fmt(17982, 29.97, true) === "00:10:00;00" && TC.fmt(107892, 29.97, true) === "01:00:00;00");
check("...59.94 skips four: 3600 = 00:01:00;04; non-drop unchanged (25: 01:00:00:00)", TC.fmt(3600, 59.94, true) === "00:01:00;04" && TC.fmt(90000, 25) === "01:00:00:00" && TC.fmt(1800, 29.97) === "00:01:00:00");
let rt = true; for (let f = 0; f < 400000; f += 37) if (TC.parse(TC.fmt(f, 29.97, true), 29.97) !== f) { rt = false; break; }
check("parse: ';' = drop-frame (round trip for every frame number tried); a skipped number (00:01:00;00) is not one", rt && Number.isNaN(TC.parse("00:01:00;00", 29.97)) && TC.parse("00:10:00;00", 29.97) === 17982);
check("at(): an hour of real time at 29.97 drop-frame reads 01:00:00;00 from 00:00:00;00; isDrop / norm",
  TC.at(3600, { start: "00:00:00;00", fps: 29.97 }) === "01:00:00;00" && TC.isDrop({ start: "01:00:00:00", fps: 29.97, drop: true }) && !TC.isDrop({ start: "01:00:00;00", fps: 25 })
  && TC.norm("01:00:00:00", 29.97, true) === "01:00:00;00" && TC.norm("1:00:00:00", 25) === "01:00:00:00");
const DL = require(path.join(ROOT, "lib", "deliver.js"));
check("lib/deliver tc(): drop-frame kept ({start ;, drop}); a ';' on 25 fps = non-drop", JSON.stringify(DL.tc({ start: "01:00:00:00", fps: 29.97, drop: true })) === '{"start":"01:00:00;00","fps":29.97,"drop":true}'
  && JSON.stringify(DL.tc({ start: "01:00:00;00", fps: 25 })) === '{"start":"01:00:00:00","fps":25}');
const D = JSON.parse(py(`import deliver as D
D._hw_ok.update({"h264_vaapi": True})
dev = D.vaapi_device
D.vaapi_device = lambda: "/dev/dri/renderD128"
info = {"w": 1920, "h": 1080, "fps": 29.97, "audio": True}
a = lambda d, enc=None, alpha=False: " ".join(D.args_for(d, info, "01:00:00;00", enc, alpha=alpha)[0])
print(json.dumps({"plus": D.tc_plus("01:00:00;00", 29.97, 60), "plus2": D.tc_plus("00:00:59;29", 29.97, 0.0334), "nd": D.tc_plus("01:00:00:00", 25, 1),
  "for25": D.tc_for("01:00:00;00", 25), "for30": D.tc_for("01:00:00;00", 29.97),
  "h10": a({"preset": "h264_10", "quality": "high"}), "p4a": a({"preset": "prores4444"}, alpha=True), "p4": a({"preset": "prores4444"}),
  "va": a({"preset": "h265"}, "hevc_vaapi"), "pre": D.pre_for("h264_vaapi"), "pre2": D.pre_for("libx264"), "hw": {k: list(v) for k, v in D.HW.items()},
  "ids": sorted(D.PRESETS), "tcp": list(D.TC_PRESETS)}))`));
check("deliver.py tc_plus: drop-frame stays drop-frame at the real rate (60 s -> 01:00:59;28; 00:00:59;29 + 1 frame -> 00:01:00;02)",
  D.plus === "01:00:59;28" && D.plus2 === "00:01:00;02" && D.nd === "01:00:01:00", D);
check("tc_for: a drop-frame start on a 25 fps file goes in as non-drop (ffmpeg refuses ';' there), on 29.97 as it is", D.for25 === "01:00:00:00" && D.for30 === "01:00:00;00");

/* ---- 2. ProRes 4444 alpha, H.264 10-bit, VAAPI */
check("presets: + MOV · ProRes 4444 (alpha), MP4 · H.264 10-bit (12; 2.597.0: + MP4 · Social media = 13); both carry the timecode", D.ids.length === 13 && D.ids.includes("social") && !D.tcp.includes("social") && D.ids.includes("prores4444") && D.ids.includes("h264_10")
  && D.tcp.includes("prores4444") && D.tcp.includes("h264_10"), D.ids);
check("H.264 10-bit: libx264 High 10, yuv420p10le, crf 16 (high), AAC 320k, the timecode", /-c:v libx264 .*-crf 16 -profile:v high10 -pix_fmt yuv420p10le/.test(D.h10) && /-b:a 320k/.test(D.h10) && /-timecode 01:00:00;00/.test(D.h10), D.h10);
check("ProRes 4444 with the alpha: the black / white difference matte (blend difference -> negate -> unpremultiply -> alphamerge), profile 4, yuva444p10le, 16-bit alpha, PCM",
  /\[0:v\]format=gbrp,split\[mb\]\[mb2\];\[1:v\]format=gbrp\[mw\]/.test(D.p4a) && /blend=all_mode=difference,format=gray,negate/.test(D.p4a) && /unpremultiply=inplace=0/.test(D.p4a)
  && /alphamerge/.test(D.p4a) && /\[m0\]setsar=1/.test(D.p4a) && /-profile:v 4 -vendor apl0 -alpha_bits 16 -pix_fmt yuva444p10le/.test(D.p4a) && /-c:a pcm_s24le/.test(D.p4a), D.p4a);
check("...without the alpha passes: ProRes 4444 opaque (yuv444p10le)", /-profile:v 4 -vendor apl0 -pix_fmt yuv444p10le/.test(D.p4) && !/\[1:v\]/.test(D.p4), D.p4);
check("VAAPI: listed last for H.264 / H.265 / 10-bit / AV1; frames uploaded (format=nv12,hwupload), CQP, -vaapi_device before the input",
  D.hw.h264[3] === "h264_vaapi" && D.hw.h265_10.includes("hevc_vaapi") && D.hw.av1.includes("av1_vaapi") && /format=nv12,hwupload\[v\]/.test(D.va) && /-c:v hevc_vaapi -rc_mode CQP -qp 24/.test(D.va)
  && JSON.stringify(D.pre) === '["-vaapi_device","/dev/dri/renderD128"]' && D.pre2.length === 0, D);
const DP = read("scripts", "deliver.py"), WK = read("misc/worker.py");
check("deliver.py alpha_passes: the export job run twice more (bg black / white, crf 10, out_name beside the master, no deliverables, no .srt), removed after",
  /def alpha_passes\(final, say\)/.test(DP) && /pr\.update\(\{"bg": bg, "crf": 10, "out_name": f"\{final\.stem\}__alpha_\{bg\}\.mp4"\}\)/.test(DP) && /tl\["deliver"\] = \[\]/.test(DP)
  && /caps\["srt"\] = False/.test(DP) && /Path\(f\)\.unlink\(missing_ok=True\)/.test(DP));
check("worker.py: the job file handed to deliver (JOB), bg = what shows where nothing is drawn (gaps, the pad, a see-through V1), out_name, no @@OUT for a pass",
  /_dl\.JOB = sys\.argv\[1\]/.test(WK) && /bgc = "white" if params\.get\("bg"\) == "white" else "black"/.test(WK) && /color=\{bgc\}:s=\{Wpx\}x\{Hpx\}/.test(WK)
  && /tpad=stop_mode=add:color=\{bgc\}/.test(WK) && /"color=\{bgc\}"/.test(WK) && /if not params\.get\("bg"\):\s*\n\s*say\("@@OUT " \+ out_name\)/.test(WK));

/* ---- 3. exchange: drop-frame, ranges, clip markers */
const IX = require(path.join(ROOT, "lib", "interchange.js"));
const tlx = { video: [{ name: "a.mp4", src: "video", start: 0, in: 2, out: 8, dur: 10, marks: [{ t: 3, name: "cm", color: "red", d: 1 }] }, { name: "b.mp4", src: "video", start: 6, in: 0, out: 4, dur: 4 }],
  vlayers: [], audio: [], images: [], seqMarkers: [{ t: 1, d: 2, name: "range", color: "blue" }, { t: 5, name: "point" }] };
const odf = { fps: 29.97, tc: { start: "01:00:00;00", fps: 29.97, drop: true }, name: "DF" };
const edl = IX.toEdl(tlx, odf), back = IX.fromEdl(edl, { fps: 29.97 });
check("EDL drop-frame: FCM: DROP FRAME, every timecode HH:MM:SS;FF, read back as drop-frame at 01:00:00;00", /FCM: DROP FRAME/.test(edl) && /01:00:00;00/.test(edl) && !/\d\d:\d\d:\d\d:\d\d/.test(edl.replace(/^TITLE.*$/m, ""))
  && JSON.stringify(back.tl.tc) === '{"start":"01:00:00;00","fps":29.97,"drop":true}' && near(back.tl.video[1].start, 6, 0.02), { edl: edl.slice(0, 300), tc: back.tl.tc });
const xml = IX.toFcpXml(tlx, odf), bx = IX.fromFcpXml(xml, {});
check("FCP XML drop-frame: <displayformat>DF</displayformat> + 01:00:00;00, read back drop-frame", /<string>01:00:00;00<\/string><frame>107892<\/frame><displayformat>DF<\/displayformat>/.test(xml)
  && JSON.stringify(bx.tl.tc) === '{"start":"01:00:00;00","fps":29.97,"drop":true}');
const x25 = IX.toFcpXml(tlx, { fps: 25 }), b25 = IX.fromFcpXml(x25, {});
check("XML: a range marker's <out> is its end (a point keeps -1); a clip marker inside its <clipitem> in source frames; both read back",
  /<marker><name>range<\/name><comment><\/comment><in>25<\/in><out>75<\/out>/.test(x25) && /<marker><name>point<\/name><comment><\/comment><in>125<\/in><out>-1<\/out>/.test(x25)
  && /<marker><name>cm<\/name><comment><\/comment><in>75<\/in><out>100<\/out><color>red<\/color><\/marker><\/clipitem>/.test(x25)
  && JSON.stringify(b25.tl.seqMarkers[0]) === '{"t":1,"name":"range","color":"blue","note":"","d":2}' && JSON.stringify(b25.tl.video[0].marks) === '[{"t":3,"name":"cm","color":"red","note":"","d":1}]', b25.tl);
const ot = JSON.parse(IX.toOtio(tlx, odf));
check("OTIO: the real rate (30000/1001), a range's duration, clip markers on the clip", near(ot.global_start_time.rate, 30000 / 1001) && ot.global_start_time.value === 107892
  && ot.tracks.markers[0].marked_range.duration.value === 60 && ot.tracks.children[0].children[0].markers[0].name === "cm");

/* ---- 4. markers: ranges + clip markers */
const MK = require(path.join(ROOT, "static", "tlmarks.js")), FX = require(path.join(ROOT, "static", "clipfx.js"));
check("one(): a range keeps d (> 0), a point has none", MK.one({ t: 1, d: 2.5 }).d === 2.5 && !("d" in MK.one({ t: 1, d: 0 })));
const cF = { start: 10, in: 2, out: 8 }, cS = { start: 10, in: 2, out: 8, fx: { speed: 2 } }, cR = { start: 10, in: 2, out: 8, fx: { reverse: true } };
check("clipMarkAt: a marker on source second 5 sits at 13 s (1:1), 11.5 s (2x), 13 s (reversed: from the out-point) - trimmed away = null",
  MK.clipMarkAt(cF, "v1", { t: 5 }, FX) === 13 && MK.clipMarkAt(cS, "v1", { t: 5 }, FX) === 11.5 && MK.clipMarkAt(cR, "v1", { t: 5 }, FX) === 13 && MK.clipMarkAt(cF, "v1", { t: 9 }, FX) === null);
const cR2 = Object.assign({}, cR); const am = MK.addClipMark(cR2, "v1", 11, { name: "x" }, FX); cR2.in = 1;
check("addClipMark: on the reversed clip at 11 s = source 7; trimming its in-point keeps it on its frame (still 11 s); the same frame again = that marker",
  am.m.t === 7 && MK.clipMarkAt(cR2, "v1", am.m, FX) === 11 && !MK.addClipMark(cR2, "v1", 11.01, { name: "y" }, FX).added && cR2.marks[0].name === "y");
const ramp = { start: 0, in: 0, out: 6, fx: FX.normalize({ ramp: [{ p: 0, s: 0.5 }, { p: 1, s: 2 }] }) };
const rm = MK.addClipMark(ramp, "v1", 3, {}, FX);
check("a ramped clip: a marker placed at 3 s returns at 3 s (FX.localTime inverts srcTime)", near(MK.clipMarkAt(ramp, "v1", rm.m, FX), 3, 1e-3));
check("pictures: markers count from the clip's start", MK.clipMarkAt({ start: 4, len: 3 }, "img", { t: 1 }) === 5 && MK.clipMarkAt({ start: 4, len: 3 }, "img", { t: 4 }) === null);
check("allTimes: sequence markers, a range's end, every clip's markers on the timeline", JSON.stringify(MK.allTimes({ seqMarkers: [{ t: 1, d: 2 }], video: [Object.assign({ marks: [{ t: 5 }] }, cF)] }, FX)) === "[1,3,13]");
const sp1 = MK.splitClip(Object.assign({ marks: [{ t: 3 }] }, cF), 12, "v1"), sp2 = MK.splitClip({ start: 0, len: 4, marks: [{ t: 1 }, { t: 3 }] }, 2, "img");
check("splitClip: both halves get their own copy of the markers (each shows the ones on its frames); a picture's right half moves them back",
  sp1[0].marks !== sp1[1].marks && sp1[0].marks[0].t === 3 && JSON.stringify(sp2[0].marks.map((m) => m.t)) === "[1]" && JSON.stringify(sp2[1].marks.map((m) => m.t)) === "[1]");
let inv = 0; for (const c of [cF, cS, cR, ramp]) for (let t = 0; t < FX.clipLen(Object.assign({}, c)); t += 0.05) inv = Math.max(inv, Math.abs(FX.localTime(c, FX.srcTime(c, t)) - t));
check("clipfx localTime is srcTime's inverse (1:1, 2x, reversed, ramped)", inv < 1e-9 && FX.localTime(cF, 1) === null, inv);

/* ---- 5. J / L cuts everywhere */
const SE = require(path.join(ROOT, "lib", "splitEdit.js"));
const jl = SE.forJob([{ split: { lead: 1, tail: 1 }, fx: { speed: 2 } }, { split: { lead: 1 }, fx: { reverse: true } }],
  [{ path: "a", in: 4, out: 8, dur: 12, start: 2 }, { path: "b", in: 1, out: 5, dur: 9, start: 6 }], 1);
check("a 2x clip: its J = 2 s of source before its in-point at 2x (tempo 2) over the timeline's 1 s before it; its L the 2 s after its out",
  JSON.stringify(jl.track.clips[0]) === '{"path":"a","start":1,"in":2,"out":4,"dur":12,"volume":1,"role":"voice","split":"J","tempo":2}'
  && jl.track.clips[1].in === 8 && jl.track.clips[1].out === 10 && jl.track.clips[1].start === 4, jl);
check("a reversed clip: its J = the source AFTER its out-point, played backwards (rev); V1's own sound silenced there",
  jl.track.clips[2].in === 5 && jl.track.clips[2].out === 6 && jl.track.clips[2].rev === true && JSON.stringify(jl.mute) === "[[1,2],[4,5],[5,6]]", jl);
const L1 = [{ clips: [{}, { split: { lead: 0.5 } }] }], ml = [{ volume: 0.8, clips: [{ path: "x", in: 0, out: 3, start: 0 }, { path: "y", in: 2, out: 5, start: 3 }] }], ex = [];
SE.forLayers(L1, ml, ex);
check("a video layer (V2+): the J joins the sound track at the layer's volume, the neighbour on that layer is silenced under it (amute)",
  ex.length === 1 && ex[0].path === "y" && ex[0].in === 1.5 && ex[0].volume === 0.8 && JSON.stringify(ml[0].clips[0].amute) === "[[2.5,3]]" && !ml[0].clips[1].amute, { ex, ml });
const RI = read("routes", "index.js");
check("the route: J / L on the layers (forLayers), a sound clip from a video file plays from it (src), a picture whose sound is out is silent",
  /splitEdit\.forLayers\(/.test(RI) && /core\.pDir\(c\.src === "video" \? "video" : c\.src === "output" \? "output" : "sound"\)/.test(RI) && /targetsLib\.silentSpans\(/.test(RI) && /m\.amute = m\.amute \|\| \[\]/.test(RI));
check("worker.py: a layer clip's amute silences its sound there; a J / L of a retimed clip plays at its speed (atempo chain) / backwards (areverse)",
  /amx = \(",volume=volume=0:enable='"/.test(WK) && /def _atempo\(s\):/.test(WK) && /pre \+= "areverse,"/.test(WK));
const AT = JSON.parse(py(`import importlib.util
spec = importlib.util.spec_from_file_location("w", "misc/worker.py")
src = open("misc/worker.py", encoding="utf-8").read()
i = src.index("def _atempo(s):"); j = src.index("def _fade_any(c):")
ns = {}; exec(src[i:j], ns)
print(json.dumps([ns["_atempo"](4), ns["_atempo"](0.2), ns["_atempo"](1.5)]))`));
check("_atempo: 4x = 2 x 2, 0.2x = 0.5 x 0.5 x 0.8 (each step inside 0.5..2), 1.5 = one step", AT[0] === "atempo=2.000000,atempo=2.000000" && AT[1] === "atempo=0.500000,atempo=0.500000,atempo=0.800000" && AT[2] === "atempo=1.500000", AT);

/* ---- 6. track targeting + linked selection */
const TG = require(path.join(ROOT, "static", "tltargets.js"));
const tg = { video: [{ name: "v.mp4", src: "video", start: 2, in: 1, out: 5, dur: 9 }], vlayers: [{ name: "V2", clips: [] }], audio: [], images: [], v1: { name: "V1" } };
const snd = TG.separate(tg, tg.video[0], "v1", "V1");
check("separate: the picture's sound becomes a clip on 'V1 sound' (same file, src, start, in, out; role voice), linked; the picture plays silent",
  tg.audio.length === 1 && tg.audio[0].name === "V1 sound" && snd.src === "video" && snd.start === 2 && snd.in === 1 && snd.out === 5 && snd.role === "voice"
  && snd.link && snd.link === tg.video[0].link && tg.video[0].soundOut === true, tg);
let snap = TG.sync(tg, null);
tg.video[0].start = 4; snap = TG.sync(tg, snap);
check("linked selection on: the picture moved -> its sound follows (and the other way round)", snd.start === 4 && snap._moved === 1);
snd.in = 2; snd.out = 4; snap = TG.sync(tg, snap);
check("...the sound trimmed -> the picture's trim follows", tg.video[0].in === 2 && tg.video[0].out === 4);
tg.linkSel = false; tg.video[0].start = 7; snap = TG.sync(tg, snap);
check("linked selection off: each moves on its own (the link kept)", snd.start === 4 && tg.video[0].link === snd.link);
tg.linkSel = true; snap = TG.sync(tg, snap);
TG.unlink(tg, tg.video[0]); tg.video[0].start = 9; snap = TG.sync(tg, snap);
check("unlink: no link, each its own for good (the sound stays at 4 s); relink pairs them again", !tg.video[0].link && snd.start === 4 && TG.relink(tg, tg.video[0]) === snd && snd.link === tg.video[0].link);
TG.putBack(tg, tg.video[0]);
check("putBack: the separate clip (and its emptied 'V1 sound' layer) gone, the picture's own sound back", !tg.audio.length && !tg.video[0].soundOut && !tg.video[0].link);
let refused = ""; try { TG.separate(tg, { name: "r", fx: { speed: 2 } }, "v1"); } catch (e) { refused = e.message; }
check("a retimed clip's sound is not taken out (its sound follows its speed) - said in words", /retimed/.test(refused), refused);
check("targeted(): the ◎ layers' keys (v1, vl:i, i:i, a:i), none = the highlighted one",
  JSON.stringify(TG.targeted({ v1: { target: true }, vlayers: [{}, { target: true }], images: [], audio: [{ target: true }] }, "v1")) === '["v1","vl:1","a:0"]' && JSON.stringify(TG.targeted({ vlayers: [] }, "vl:0")) === '["vl:0"]');
check("silentSpans: a picture whose sound is out is silent over its length", JSON.stringify(TG.silentSpans([{ start: 1, in: 0, out: 3, soundOut: true }, { start: 5, in: 0, out: 2 }])) === "[[1,4]]");

/* ---- 7. EQ, multiband, reverb */
const af = FX.normalize({ afx: { eq: { low: 4, mid: -3, high: 13, midHz: 2500 }, comp: 0.6, reverb: { mix: 0.5, room: "hall" } } });
check("afx: eq (clamped to ±12, the mid's frequency), comp, reverb {mix, room} normalized; an unknown room = 'room'",
  JSON.stringify(af.afx) === '{"eq":{"low":4,"mid":-3,"high":12,"midHz":2500},"comp":0.6,"reverb":{"mix":0.5,"room":"hall"}}' && FX.normalize({ afx: { reverb: { mix: 0.2, room: "cave" } } }).afx.reverb.room === "room", af);
const AC = JSON.parse(py(`import clipfx_render as C
print(json.dumps(C.afx_chain({"eq": {"low": 4, "mid": -3, "high": 2}, "comp": 0.6, "reverb": {"mix": 0.5, "room": "hall"}, "gain": 1})))`));
check("clipfx_render.afx_chain: bass / equalizer / treble, mcompand (3 bands) + its make-up, aecho taps of the hall, then the gain",
  /^bass=g=4\.00:f=120$/.test(AC[0]) && /^equalizer=f=1000:t=q:w=1:g=-3\.00$/.test(AC[1]) && /^treble=g=2\.00:f=8000$/.test(AC[2]) && /^mcompand=.* 200 \| .* 3000 \| .* 22000,volume=/.test(AC[3])
  && /^aecho=0\.9:[\d.]+:80\|147\|229\|331\|450\|590\|760:/.test(AC[4]) && AC[5] === "volume=1.00dB", AC);
const ff = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=300:d=0.5", "-filter_complex", "[0:a]" + AC.join(",") + "[a]", "-map", "[a]", "-f", "null", "-"], { encoding: "utf8" });
check("...ffmpeg takes that chain", ff.status === 0, ff.stderr);

/* ---- 8. hue curves */
const hg = FX.normalize({ grade: { hcurves: { hh: [[0, 0.5], [0.333, 0.75], [1, 0.5]], hs: [[0, 0.5], [0.667, 0], [1, 0.5]] } } }).grade;
const grn = FX.gradeRgb(0, 1, 0, { hcurves: { hh: hg.hcurves.hh } }), blu = FX.gradeRgb(0, 0, 1, { hcurves: { hs: hg.hcurves.hs } }), gry = FX.gradeRgb(0.5, 0.5, 0.5, hg);
check("hue vs hue: green (120°) pushed +90° toward azure; hue vs sat: blue taken to grey; grey untouched", grn[2] > 0.6 && grn[0] < 0.4 && near(blu[0], blu[2], 0.01) && near(gry[0], 0.5, 1e-6) && near(gry[2], 0.5, 1e-6), { grn, blu, gry });
check("flat hue curves (all 0.5) normalize away; they bake into the LUT (lookKey changes)", !FX.normalize({ grade: { hcurves: { hh: [[0, 0.5], [1, 0.5]] } } })
  && FX.lookKey({ grade: hg }) !== FX.lookKey({ grade: {} }));

/* ---- 9. effect keyframes */
const vk = FX.normVfx({ blur: 2, kf: [{ at: 0, blur: 0, crop: { l: 0 } }, { at: 2, blur: 10, crop: { l: 20 } }, { at: 1, glow: 0.5 }] });
const v05 = FX.vfxAt(vk, 0.5), v3 = FX.vfxAt(vk, 3);
check("vfx.kf normalized (sorted by time); vfxAt: straight lines between keys that set a value, held outside",
  vk.kf.length === 3 && vk.kf[1].at === 1 && v05.blur === 2.5 && v05.crop.l === 5 && v05.glow === 0.5 && v3.blur === 10 && v3.crop.l === 20 && !("kf" in v05), { vk, v05 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p7_"));
const VB = JSON.parse(py(`import vfx_filters as VF
parts = []
n = VF.build(parts, "[0:v]", "[v]", {"kf": [{"at": 0, "blur": 0, "sharpen": 0, "vignette": 0, "crop": {"l": 0, "t": 0, "r": 0, "b": 0}}, {"at": 2, "blur": 20, "sharpen": 2, "vignette": 1, "crop": {"l": 40, "t": 10, "r": 0, "b": 0}}]}, 320, 180, tag="t", clip=True, dur=2, fps=25)
print(json.dumps({"parts": parts, "notes": n, "any": VF.any_vfx({"kf": [{"at": 0, "blur": 1}]}), "alpha": VF.needs_alpha({"kf": [{"at": 0, "crop": {"l": 3}}]})}))`, TMP));
const g = VB.parts.join(";");
check("vfx_filters with keyframes: the command file first (sendcmd), gblur@ by command, sharpen = the strongest mixed in by a blend@ opacity, vignette's angle an expression of t, the crop a moving mask (geq on T -> alphamerge)",
  /^\[0:v\]sendcmd=f='/.test(VB.parts[0]) && /gblur@tb=sigma=/.test(g) && /blend@tsharpen=all_mode=normal/.test(g) && /vignette=angle='if\(gt\(/.test(g) && /:eval=frame/.test(g)
  && /geq=lum='255\*between\(X/.test(g) && /alphamerge/.test(g) && VB.any && VB.alpha, VB.notes);
const cmd = fs.readFileSync(path.join(TMP, "t_kf.cmd"), "utf8").trim().split("\n");
check("...the command file: a line per frame step (sigma and opacity rising to the end)", cmd.length > 50 && /^0\.0000 gblur@tb sigma 0\.000;$/.test(cmd[0]) && cmd.some((l) => /blend@tsharpen all_opacity 1\.0000;/.test(l)), cmd.slice(0, 3));
fs.rmSync(TMP, { recursive: true, force: true });

/* ---- 10. the page's wiring */
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("ext.json: targets.js after markers.js, before tlkeys.js; index.html loads /static/tltargets.js", EXT.indexOf("targets.js") > EXT.indexOf("markers.js") && EXT.indexOf("targets.js") < EXT.indexOf("tlkeys.js")
  && /<script src="\/static\/tltargets\.js"><\/script>/.test(read("static", "index.html")));
{
  const ctx = { window: null, document: { readyState: "complete", getElementById: () => null, addEventListener() {} }, setTimeout() {}, console };
  ctx.window = { addEventListener() {} };
  vm.createContext(ctx);
  vm.runInContext(read("ext", "timelinedock", "tlkeys.js"), ctx);
  const K = ctx.window.TlKeys;
  check("Ctrl+Shift+M = a clip marker (anywhere in the timeline); in the shortcut map", K.action("M", { ctrl: true, shift: true, alt: false, meta: false }, false, true) === "clipMarker" && K.KEYS.some((k) => k[0] === "Ctrl+Shift+M"));
}
const TK = read("ext", "timelinedock", "tlkeys.js"), MJ = read("ext", "timelinedock", "markers.js");
check("Ctrl+K with no clip selected: every ◎ targeted layer (TlTargets.targeted)", /var lks = window\.TlTargets \? TlTargets\.targeted\(\)/.test(TK));
check("markers.js: ranges (band + end handle), clip markers on the clips (.tlcmk), the editor's length + ⟦ ⟧ In / Out, Shift+M / Alt+M through every marker",
  /function wireEnd\(/.test(MJ) && /function paintClips\(\)/.test(MJ) && /id="tlmkLen"/.test(MJ) && /id="tlmkIo"/.test(MJ) && /allTimes/.test(MJ));
const CF = read("ext", "timelinedock", "clipfx.js"), CP = read("ext", "timelinedock", "colourpanel.js"), CV = read("ext", "timelinedock", "canvas.js");
check("clipfx.js: J / L on V2+ too (no retimed refusal), EQ / mid at / multiband / reverb sliders, ◆ effect keys (key here, go, ✕, clear)",
  /sel\.Ly\.kind === "v1" \|\| sel\.Ly\.kind === "vl"/.test(CF) && !/J \/ L cut is not made on a/.test(CF) && /tfxEq_/.test(CF) && /tfxComp/.test(CF) && /tfxRoom/.test(CF) && /tfxKfAdd/.test(CF) && /tfxKfClear/.test(CF));
check("colourpanel.js: H/H and H/S tabs (grade.hcurves, the ends wrap); canvas.js draws keyframed effects at their time and mutes a picture whose sound is out",
  /data-ch="hh"/.test(CP) && /data-ch="hs"/.test(CP) && /red wraps/.test(CP) && /H3ClipFx\.vfxAt\(fx\.vfx/.test(CV) && /!!c\.soundOut/.test(CV));
check("📤 dialog: drop-frame (tdlDrop) + the overlay pack (ProRes 4444); ⇄ dialog: drop-frame (tixDrop)", /id="tdlDrop"/.test(read("ext", "timelinedock", "deliver.js")) && /"overlay": \[\{ preset: "prores4444"/.test(read("ext", "timelinedock", "deliver.js"))
  && /id="tixDrop"/.test(read("ext", "timelinedock", "interchange.js")));
const SC = JSON.parse(read("docs", "shortcuts.json"));
check("docs/shortcuts.json: Ctrl+Shift+M", SC.groups.some((gg) => gg.rows.some((r) => r[0] === "Ctrl+Shift+M")));
check("server.js untouched; package.json 2.412.0 or later", !/tltargets|splitEdit|alpha_passes/.test(read("misc/server.js")) && JSON.parse(read("package.json")).version.localeCompare("2.412.0", undefined, { numeric: true }) >= 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
