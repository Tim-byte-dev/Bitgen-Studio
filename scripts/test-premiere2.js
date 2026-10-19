#!/usr/bin/env node
/* bitGen Studio — 2.407.0 unit tests: colour wheels / curves / HSL secondaries (static/clipfx.js), the edit tools
 * (static/edittools.js), timecode (static/timecode.js), J / L cuts (lib/splitEdit.js), the export queue
 * (lib/deliver.js + scripts/deliver.py) and the exchange (lib/interchange.js: FCP XML / EDL / OTIO out, XML / EDL in).
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do". */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const ED = require(path.join(ROOT, "static", "edittools.js"));
const TC = require(path.join(ROOT, "static", "timecode.js"));
const SPL = require(path.join(ROOT, "lib", "splitEdit.js"));
const DL = require(path.join(ROOT, "lib", "deliver.js"));
const IX = require(path.join(ROOT, "lib", "interchange.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

/* ---- colour */
const n1 = FX.normalize({ grade: { wheels: { lift: { x: 3, y: 0, l: 0 }, gamma: { x: 0, y: 0, l: 0 } }, curves: { m: [[0, 0], [1, 1]], r: [[1, 1], [0, 0], [0.5, 0.7]] }, hsl: [{ hue: 400, width: 5, shift: 10 }, { hue: 10, shift: 0 }] } });
check("normalize: a wheel's puck kept in the disc, an idle wheel / identity curve / idle HSL range dropped, hue wrapped, width clamped",
  JSON.stringify(n1.grade) === JSON.stringify({ wheels: { lift: { x: 1, y: 0, l: 0 } }, curves: { r: [[0, 0], [0.5, 0.7], [1, 1]] }, hsl: [{ hue: 40, width: 10, shift: 10, sat: 0, lum: 0 }] }), n1);
const cf = FX.curveFn([[0, 0], [0.25, 0.1], [0.75, 0.9], [1, 1]]);
let mono = true, prev = -1; for (let x = 0; x <= 1; x += 0.01) { const y = cf(x); if (y < prev - 1e-9) mono = false; prev = y; }
check("curveFn: through its points, monotone (no overshoot)", near(cf(0.25), 0.1) && near(cf(0.75), 0.9) && mono && cf(-1) === 0 && cf(2) === 1);
check("lift +0.5 lifts the shadows, leaves white", FX.gradeRgb(0.1, 0.1, 0.1, { wheels: { lift: { x: 0, y: 0, l: 0.5 } } })[0] > 0.2 && near(FX.gradeRgb(1, 1, 1, { wheels: { lift: { x: 0, y: 0, l: 0.5 } } })[0], 1));
check("gamma +0.5 brightens the mids, keeps black and white", FX.gradeRgb(0.5, 0.5, 0.5, { wheels: { gamma: { x: 0, y: 0, l: 0.5 } } })[0] > 0.55 && near(FX.gradeRgb(0, 0, 0, { wheels: { gamma: { l: 0.5, x: 0, y: 0 } } })[0], 0));
const blueGain = FX.gradeRgb(0.5, 0.5, 0.5, { wheels: { gain: { x: Math.cos(240 * Math.PI / 180), y: Math.sin(240 * Math.PI / 180), l: 0 } } });
check("a gain puck toward blue (240°) pushes blue up, red and green down", blueGain[2] > 0.6 && blueGain[0] < 0.48 && blueGain[1] < 0.48, blueGain);
check("the red curve lifts only red", (() => { const o = FX.gradeRgb(0.5, 0.5, 0.5, { curves: { r: [[0, 0], [0.5, 0.7], [1, 1]] } }); return near(o[0], 0.7) && near(o[1], 0.5); })());
const sky = FX.gradeRgb(0.3, 0.5, 0.9, { hsl: [{ hue: 215, width: 60, shift: 0, sat: -100, lum: 0 }] });
const skin = FX.gradeRgb(0.9, 0.6, 0.45, { hsl: [{ hue: 215, width: 60, shift: 0, sat: -100, lum: 0 }] });
check("an HSL range on blue greys the sky, leaves skin alone", Math.abs(sky[0] - sky[2]) < 0.05 && near(skin[0], 0.9, 0.01) && near(skin[2], 0.45, 0.01), [sky, skin]);
check("an HSL hue shift turns that range", (() => { const o = FX.gradeRgb(0.2, 0.8, 0.2, { hsl: [{ hue: 120, width: 60, shift: 120, sat: 0, lum: 0 }] }); return o[2] > o[1]; })());
check("the advanced grade is in the look's key (the baked LUT follows it)", FX.lookKey({ grade: { curves: { m: [[0, 0], [0.5, 0.6], [1, 1]] } } }) !== FX.lookKey({ grade: { curves: { m: [[0, 0], [0.5, 0.4], [1, 1]] } } }));
const lut = FX.buildLut({ grade: { wheels: { gain: { x: 0, y: 0, l: 0.4 } } } }, null, 9);
check("buildLut bakes the wheels (white clipped to 1, mid raised)", near(lut[lut.length - 1], 1) && lut[(4 * 81 + 4 * 9 + 4) * 3] > 0.55);

/* ---- edit tools */
const a = { name: "a", start: 0, in: 0, out: 4, dur: 10 }, b = { name: "b", start: 4, in: 1, out: 5, dur: 10 }, c = { name: "c", start: 8, in: 0, out: 3, dur: 3 };
check("slip: other frames, same place and length; clamped to the media", JSON.stringify(ED.slip(b, 1)) === '{"in":2,"out":6,"moved":1}' && ED.slip(b, -5).in === 0 && ED.slip(b, 99).out === 10);
const r1 = ED.roll(a, b, 1);
check("roll: the cut moves, the total stays", r1.a.out === 5 && r1.b.in === 2 && r1.b.start === 5 && ED.len(r1.a) + ED.len(r1.b) === 8);
check("roll: clamped by the right clip's media head", ED.roll(a, b, -10).b.in === 0 && ED.roll(a, b, -10).moved === -1);
const s1 = ED.slide(a, b, c, 1);
check("slide: the clip moves, the neighbours give and take, the content stays", s1.c.start === 5 && s1.c.in === 1 && s1.prev.out === 5 && s1.next.in === 1 && s1.next.start === 9);
check("slide: clamped by the next clip's media (c is already at in 0)", ED.slide(a, b, c, -2).moved === 0 || ED.slide(a, b, c, -2).moved === -0);
const rp = ED.ripple([a, b, c], a, "r", -1);
check("ripple tail -1: a shorter, b and c 1 s earlier", JSON.stringify(rp.clips.map((x) => [x.start, x.in, x.out])) === "[[0,0,3],[3,1,5],[7,0,3]]" && rp.moved === -1);
const rp2 = ED.ripple([a, b, c], b, "l", 1);
check("ripple head +1: b starts later in its media, c closes up", JSON.stringify(rp2.clips.map((x) => [x.start, x.in, x.out])) === "[[0,0,4],[4,2,5],[7,0,3]]");
check("neighbours: the touching clips", ED.neighbours([a, b, c], b).prev === a && ED.neighbours([a, b, c], b).next === c && ED.neighbours([a, c], a).next === null);
const f2 = { name: "f", start: 0, in: 0, out: 10, dur: 20, fx: { speed: 2 } };
check("a 2x clip: 1 s of slip = 2 s of source", JSON.stringify(ED.slip(f2, 1)) === '{"in":2,"out":12,"moved":1}');
// 2.413.0: a reversed clip is edited too (it used to be refused) - test-premiere8.js covers it frame by frame
const sr = ED.slip({ name: "r", in: 0, out: 4, dur: 10, fx: { reverse: true } }, 1);
check("a reversed clip: slipped like any other (2.413.0 - it used to be refused)", sr.in === 1 && sr.out === 5, sr);

/* ---- timecode */
check("timecode: fmt / parse / at, 25 and 23.976 (on 24)", TC.fmt(90000, 25) === "01:00:00:00" && TC.parse("01:00:00:00", 25) === 90000 && TC.at(1.5, { start: "01:00:00:00", fps: 25 }) === "01:00:01:12"
  && TC.fmt(TC.frames(1, 23.976), 23.976) === "00:00:01:00" && Number.isNaN(TC.parse("00:00:00:25", 25)) && TC.base(29.97).ntsc && TC.base(29.97).tb === 30);

/* ---- J / L cuts */
const raw = [{ name: "a", split: null }, { name: "b", split: { lead: 1, tail: 0.5 } }, { name: "c", split: { lead: 3 }, fx: { speed: 2 } }];
const mapped = [{ path: "/v/a", start: 0, in: 0, out: 4, dur: 10 }, { path: "/v/b", start: 4, in: 2, out: 6, dur: 6.2 }, { path: "/v/c", start: 8, in: 0, out: 4, dur: 4 }];
const sp = SPL.forJob(raw, mapped, 0.8);
check("J / L: b's sound 1 s early (from its media before in) and 0.2 s late (what its media has), the neighbours silenced there; a retimed clip has none",
  sp.track && sp.track.clips.length === 2 && JSON.stringify(sp.track.clips.map((x) => [x.start, x.in, x.out, x.split, x.role, x.volume])) === '[[3,1,2,"J","voice",0.8],[8,6,6.2,"L","voice",0.8]]'
  && JSON.stringify(sp.mute) === "[[3,4],[8,8.2]]", sp);
check("J / L: none -> no track", SPL.forJob([{}], [mapped[0]], 1).track === null && SPL.norm({ lead: 0, tail: 0 }) === null);

/* ---- export queue */
const q = DL.normalize([{ preset: "h265", aspect: "9:16", size: "1080", fit: "blur", fps: "24" }, { preset: "nope" }, { preset: "prores" }, { preset: "prores" }, { preset: "wav", size: "999" }]);
check("deliver.normalize: unknown presets out, names from the settings, made unique, bad values back to defaults",
  JSON.stringify(q.map((d) => d.name)) === '["h265_9x16_1080p_24fps","prores","prores_2","wav"]' && q[3].size === "source" && q[0].quality === "standard", q);
check("deliver.tc: HH:MM:SS:FF + fps, else null", DL.tc({ start: "01:00:00:00", fps: 24 }).fps === 24 && DL.tc({ start: "1:00" }) === null);
const fr = JSON.parse(py(`import deliver as D
f=lambda d,w,h: list(D.frame(d,w,h))
print(json.dumps({"a":f({"aspect":"9:16","size":"1080"},1920,1080),"b":f({"aspect":"1:1","size":"source"},1920,1080),"c":f({},1280,720),
 "d":f({"aspect":"4:5","size":"720"},1920,1080),"e":f({"preset":"gif","size":"1080"},1920,1080),"g":f({"aspect":"21:9","size":"1080"},1920,1080),
 "ids":sorted(D.PRESETS), "args":D.args_for({"preset":"h265","quality":"high","aspect":"9:16","size":"1080","fit":"blur","fps":"24"},{"w":1920,"h":1080,"fps":30,"audio":True},"01:00:00:00")[0]}))`));
check("deliver.py frame: 9:16 1080 = 1080x1920, 1:1 source = 1080x1080, as is = the master, 4:5 720 = 720x900, a GIF 360 tall at most, 21:9 = 2520x1080",
  JSON.stringify([fr.a, fr.b, fr.c, fr.d, fr.e, fr.g]) === "[[1080,1920],[1080,1080],[1280,720],[720,900],[640,360],[2520,1080]]", fr);
check("deliver.py reads the same presets as lib/deliver.js", JSON.stringify(fr.ids) === JSON.stringify(DL.PRESETS.presets.map((p) => p.id).sort()));
const ar = fr.args.join(" ");
check("deliver.py H.265 args: blurred fill, 24 fps, crf 18 (high), hvc1, AAC 320k, the timecode", /boxblur/.test(ar) && /fps=24/.test(ar) && /-crf 18/.test(ar) && /hvc1/.test(ar) && /-b:a 320k/.test(ar) && /-timecode 01:00:00:00/.test(ar), ar);

/* ---- exchange */
const tl = { video: [{ name: "shot1.mp4", src: "video", start: 0, in: 1, out: 5, dur: 10 }, { name: "shot2.mp4", src: "output", start: 4, in: 0, out: 4, dur: 4, fx: { speed: 2 } }],
  v1: { name: "V1", volume: 0.8 }, vlayers: [{ name: "V2", clips: [{ name: "over.webm", src: "video", start: 1, in: 0, out: 2, dur: 2, opacity: 0.5 }] }],
  audio: [{ name: "A1", volume: 1, clips: [{ name: "music.wav", start: 0, in: 0, out: 6, dur: 30, volume: 0.5 }] }],
  images: [{ name: "I1", clips: [{ name: "title.png", start: 2, len: 3 }] }] };
const abs = (x) => (x.kind === "audio" ? "/proj/sound/" : x.kind === "image" ? "/proj/images/" : "/proj/" + (x.src === "video" ? "video" : "output") + "/") + x.name;
const xml = IX.toFcpXml(tl, { fps: 25, tc: { start: "01:00:00:00", fps: 25 }, w: 1280, h: 720, name: "Cut <1>", abs });
check("FCP XML: xmeml 5, the sequence (escaped name), 25 fps, 1280x720, the start timecode", /<xmeml version="5">/.test(xml) && /<name>Cut &lt;1&gt;<\/name>/.test(xml) && /<timebase>25<\/timebase><ntsc>FALSE<\/ntsc>/.test(xml)
  && /<width>1280<\/width><height>720<\/height>/.test(xml) && /<string>01:00:00:00<\/string><frame>90000<\/frame>/.test(xml));
check("FCP XML: 3 video tracks (V1, V2, the stills), 2 audio tracks (V1's sound, A1), files by path, defined once",
  (xml.match(/<track>/g) || []).length === 5 && /file:\/\/localhost\/proj\/video\/shot1\.mp4/.test(xml) && (xml.match(/<file id="file-1">/g) || []).length === 1 && /<file id="file-1"\/>/.test(xml));
check("FCP XML: shot1 in 25 out 125 at 0-100; shot2 at 200 % (Time Remap), 100-150", /<start>0<\/start><end>100<\/end><in>25<\/in><out>125<\/out>/.test(xml)
  && /<start>100<\/start><end>150<\/end><in>0<\/in><out>100<\/out>/.test(xml) && /<parameterid>speed<\/parameterid>.*?<value>200<\/value>/.test(xml));
check("FCP XML: opacity 50 on V2, levels 0.5 on the music, 0.8 on V1's sound", /<parameterid>opacity<\/parameterid>.*?<value>50<\/value>/.test(xml) && /<value>0\.5<\/value>/.test(xml) && /<value>0\.8<\/value>/.test(xml));
const has = { "shot1.mp4": { src: "video", kind: "video" }, "shot2.mp4": { src: "output", kind: "video" }, "over.webm": { src: "video", kind: "video" }, "music.wav": { src: "sound", kind: "audio" }, "title.png": { src: "images", kind: "image" } };
const back = IX.fromFcpXml(xml, { find: (nm) => has[nm] || null });
const bt = back.tl;
check("XML in: V1 = the two shots (times, trims, src, speed 2), V2 = the overlay (50 %), I1 = the still, A1 = the music (0.5); V1's sound track not doubled; the timecode",
  bt.video.length === 2 && near(bt.video[0].in, 1) && near(bt.video[0].out, 5) && bt.video[0].src === "video" && bt.video[1].src === "output" && bt.video[1].fx.speed === 2 && near(bt.video[1].start, 4)
  && bt.vlayers.length === 1 && bt.vlayers[0].clips[0].opacity === 0.5 && bt.images.length === 1 && near(bt.images[0].clips[0].len, 3) && bt.audio.length === 1 && bt.audio[0].clips[0].volume === 0.5
  && bt.tc.start === "01:00:00:00" && back.name === "Cut <1>" && back.missing.length === 0, bt);
const miss = IX.fromFcpXml(xml, { find: (nm) => (nm === "shot2.mp4" ? null : has[nm]) });
check("XML in: a file not in the project is listed missing and left out", miss.missing.join() === "shot2.mp4" && miss.tl.video.length === 1);
let xe = ""; try { IX.fromFcpXml("<x/>", {}); } catch (e) { xe = e.message; }
check("XML in: not an FCP XML -> said", /no <sequence>/.test(xe));
const edl = IX.toEdl(tl, { fps: 25, tc: { start: "01:00:00:00", fps: 25 }, name: "Cut" });
check("EDL: CMX3600 title, NDF, V1's two events with record timecodes from 01:00:00:00, an M2 line at 50 fps for the 2x clip, clip names",
  /^TITLE: Cut\nFCM: NON-DROP FRAME/.test(edl) && /001  SHOT1    AA\/V  C        00:00:01:00 00:00:05:00 01:00:00:00 01:00:04:00/.test(edl)
  && /002  SHOT2    AA\/V  C        00:00:00:00 00:00:04:00 01:00:04:00 01:00:06:00/.test(edl) && /M2   SHOT2    0050\.0 +00:00:00:00/.test(edl) && /\* FROM CLIP NAME: shot2\.mp4/.test(edl), edl);
const eb = IX.fromEdl(edl, { fps: 25, find: (nm) => has[nm] || null });
check("EDL in: the two events back on V1 (the hour taken off, speed 2 from M2, its source 0..4)", eb.tl.video.length === 2 && near(eb.tl.video[1].start, 4) && eb.tl.video[1].fx.speed === 2
  && near(eb.tl.video[1].out, 4) && near(eb.tl.video[0].in, 1) && eb.tl.tc.start === "01:00:00:00", eb.tl.video);
const ot = JSON.parse(IX.toOtio(tl, { fps: 25, abs }));
const vt = ot.tracks.children.filter((t) => t.kind === "Video"), at = ot.tracks.children.filter((t) => t.kind === "Audio");
check("OTIO: Timeline.1, 3 video + 2 audio tracks, a Gap before V2's clip, LinearTimeWarp 2 on shot2", ot.OTIO_SCHEMA === "Timeline.1" && vt.length === 3 && at.length === 2
  && vt[1].children[0].OTIO_SCHEMA === "Gap.1" && vt[0].children[1].effects[0].time_scalar === 2 && /file:\/\/localhost\/proj\/output\/shot2\.mp4/.test(vt[0].children[1].media_reference.target_url));
check("fileUrl / urlPath: Windows drives and spaces", IX.fileUrl("C:\\My Media\\a b.mp4") === "file://localhost/C:/My%20Media/a%20b.mp4" && IX.urlPath("file://localhost/C:/My%20Media/a%20b.mp4") === "C:/My Media/a b.mp4");
check("parseXml: attributes, nesting, entities, CDATA, self-closing", (() => { const r = IX.parseXml('<a x="1"><b>t &amp; u</b><c y=\'2\'/><d><![CDATA[<z>]]></d></a>'); const A = r.kids[0]; return A.attrs.x === "1" && A.kids[0].text === "t & u" && A.kids[1].attrs.y === "2" && A.kids[2].text === "<z>"; })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
