#!/usr/bin/env node
/* bitGen Studio — 2.414.0 units: the MEDIUM Premiere jobs (part one)
 *   1. NESTED SEQUENCES (lib/nest.js): the render's name, the fingerprint (session state ignored), status / adopt,
 *      the loop check through nests of nests; the page's payload builder (TlExportBody) sending V2+ J / L cuts and
 *      a sound clip's file; /api/export's nest branch
 *   2. the FCP 7 XML carrying Basic Motion (position / scale / rotation + ◆ keys), opacity / level keyframes, the grade
 *      (a record + a baked .cube named in the clip) and the captions (Text generators) - out and back, and read by
 *      another reader (OpenTimelineIO)
 *   3. FCPXML 1.10 for Final Cut Pro X (lib/fcpxml.js): the storyline, connected lanes, timeMap, adjust-*, keyframes,
 *      markers, captions, tcStart - out and back; another reader (OpenTimelineIO's fcpx adapter) places the clips
 *   4. edit by transcript across a WHOLE LAYER / the WHOLE SEQUENCE (static/textedit.js units / applyUnits)
 * Tim: "lets do the medium jobs now". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p9_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const hasOtio = spawnSync("python3", ["-c", "import opentimelineio"], { encoding: "utf8" }).status === 0;
const hasFcpx = hasOtio && spawnSync("python3", ["-c", "import otio_fcpx_xml_adapter"], { encoding: "utf8" }).status === 0;

/* ---- 1. nested sequences */
const NEST = require(path.join(ROOT, "lib", "nest.js"));
const TLS = require(path.join(ROOT, "lib", "timelines.js"));
check("outName: nest_<name>_<hash8>.mp4 (a re-render is a new file - no stale cached picture); odd characters made safe",
  NEST.outName("Intro cut", "0123456789abcdef") === "nest_Intro_cut_01234567.mp4" && NEST.outName("a.b-c", null) === "nest_a.b-c.mp4");
const t0 = { video: [{ name: "a.mp4", in: 0, out: 2, start: 0 }], playhead: 1.2, sel: { a: 0, b: 1 }, selLayer: "v1", deliver: [{ preset: "h264" }] };
check("fingerprint: the session's own state (position marker, selection, the export queue) does not make it look changed; a trim does",
  NEST.fingerprint(t0) === NEST.fingerprint(Object.assign({}, t0, { playhead: 3, sel: null, selLayer: "vl:0", deliver: [] }))
  && NEST.fingerprint(t0) !== NEST.fingerprint(Object.assign({}, t0, { video: [{ name: "a.mp4", in: 0, out: 1.5, start: 0 }] })));
const PD = path.join(TMP, "proj");
fs.mkdirSync(PD, { recursive: true });
TLS.write(PD, "inner", { video: [{ name: "a.mp4", in: 0, out: 2, start: 0 }] });
TLS.write(PD, "middle", { video: [{ name: "x.mp4", in: 0, out: 2, start: 0 }], vlayers: [{ name: "⧉ inner", clips: [{ name: "nest_inner.mp4", nest: "inner", in: 0, out: 2, start: 0 }] }] });
TLS.write(PD, "main", { video: [{ name: "nest_middle.mp4", nest: "middle", in: 0, out: 2, start: 0 }] });
check("uses: the nests a timeline holds (V1 and the layers)", NEST.uses(TLS.read(PD, "middle")).join() === "inner" && NEST.uses(TLS.read(PD, "main")).join() === "middle");
check("cycle: nesting main into inner = a loop (inner <- middle <- main), through a nest of a nest; inner into a fresh one is fine",
  NEST.cycle(PD, "inner", "main") === true && NEST.cycle(PD, "middle", "main") === true && NEST.cycle(PD, "main", "inner") === false && NEST.cycle(PD, "other", "inner") === false);
const h = NEST.hashOf(PD, "inner");
const st0 = NEST.status(PD, ["inner", "nope"]);
check("status: the stored timeline's hash, not rendered yet; a missing timeline: hash null", st0.inner.hash === h && st0.inner.exists === false && st0.nope.hash === null, st0);
ff(["-f", "lavfi", "-i", "color=c=red:s=160x90:r=25:d=1.6", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(PD, NEST.outName("inner", h))]);
const ad = NEST.adopt(PD, "inner");
check("adopt: the compiled nest moved into video/ ({file, dur, hash}), gone from the project root",
  ad.file === NEST.outName("inner", h) && near(ad.dur, 1.6, 0.05) && ad.hash === h && fs.existsSync(path.join(PD, "video", ad.file)) && !fs.existsSync(path.join(PD, ad.file)), ad);
check("...status now: rendered (exists)", NEST.status(PD, ["inner"]).inner.exists === true);
TLS.write(PD, "inner", { video: [{ name: "a.mp4", in: 0, out: 1, start: 0 }] });
check("...the nested timeline saved again: a NEW hash (the clip's ↻ out of date) and its render not there yet", NEST.hashOf(PD, "inner") !== h && NEST.status(PD, ["inner"]).inner.exists === false);
let bad = null; try { NEST.adopt(PD, "inner"); } catch (e) { bad = e; }
check("adopt before the compile: refused in words (404)", bad && bad.status === 404 && /not there yet/.test(bad.message), bad && bad.message);
const tld = read("ext", "timelinedock", "timelinedock.js"), rix = read("routes", "index.js"), nx = read("ext", "timelinedock", "nest.js");
check("the page's payload is ONE builder (TlExportBody): V2+ clips send split + soundOut, sound clips their src, the nest's queue / range off",
  /window\.TlExportBody = exportBody/.test(tld) && /split: c\.split \|\| undefined, soundOut: c\.soundOut \|\| undefined(, \.\.\.tlLayerKeys\(X, L\))? \}\)\),/.test(tld)   /* 2.519.0: 2.491.0 spreads the layer's blend + matte keys after them */ && /src: c\.src \|\| undefined,/.test(tld)
  && /deliver: o\.nest( \|\| o\.preview)? \? undefined/.test(tld) && /body: JSON\.stringify\(exportBody\(tl\)\)/.test(tld));
check("/api/export: nest -> out_name nest_<name>_<hash>.mp4 (routes/nest.js mounted from routes/index.js, not server.js)",
  /nestLib\.outName\(t\.nest, nestLib\.hashOf\(/.test(rix) && /out_name: nestOut/.test(rix) && /require\("\.\/nest"\)\.mount\(app, core\)/.test(rix) && !/nest/.test(read("misc/server.js")));
const ej = JSON.parse(read("ext", "timelinedock", "ext.json"));
check("the timeline dock loads nest.js (⧉, the ↻ badge, Re-render / Open in Properties)", JSON.stringify(ej).includes("nest.js") && /tlNestBtn/.test(nx) && /tlpNestRe/.test(nx) && /tlpNestOpen/.test(nx) && /out of date/.test(nx));

/* ---- 2. FCP 7 XML extras */
const IX = require(path.join(ROOT, "lib", "interchange.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));
const TL = { v1: { name: "V1" }, video: [{ name: "a.mp4", src: "video", in: 1, out: 5, dur: 10, start: 0, opacity: 1,
    tf: { x: 0, y: 0, scale: 1.2, rot: 10 }, kf: [{ at: 0, op: 0.2 }, { at: 2, op: 1, x: 300, y: -60 }, { at: 3, x: 0, y: 40 }],
    fx: { grade: { exposure: 0.5, contrast: 20 } } }, { name: "c.mp4", src: "video", in: 0, out: 3, dur: 3, start: 6, fx: { speed: 0.5, reverse: true } }],
  vlayers: [{ name: "V2", clips: [{ name: "b.mp4", src: "video", in: 0, out: 2, dur: 4, start: 1, opacity: 0.5, fx: { speed: 2, vfx: { blur: 4 } } }, { name: "b.mp4", src: "video", in: 1, out: 2, dur: 4, start: 7 }] }],
  audio: [{ name: "A1", clips: [{ name: "m.wav", start: 0.48, in: 0, out: 4, dur: 4, kf: [{ at: 0, vol: 0 }, { at: 1, vol: 1 }] }] }], images: [],
  seqMarkers: [{ t: 2.48, name: "beat", color: "red" }],
  captions: { cues: [{ start: 0.48, end: 1.48, text: "Hello there" }, { start: 8, end: 9, text: "A & B <ok>" }], visible: true } };
const luts = [];
const x7 = IX.toFcpXml(TL, { fps: 25, w: 1920, h: 1080, lut: (c, fx) => { luts.push(fx); return "t_luts/a_1.cube"; } });
check("XML: Basic Motion (scale 120 %, rotation, center keyframes at the clip's <in> + frames into it: 25+50, 25+75)",
  /<effectid>basic<\/effectid>/.test(x7) && /<parameterid>scale<\/parameterid><name>Scale<\/name><valuemin>0<\/valuemin><valuemax>1000<\/valuemax><value>120<\/value>/.test(x7)
  && /<keyframe><when>75<\/when><value><horiz>0\.15625<\/horiz><vert>-0\.055556<\/vert><\/value><\/keyframe><keyframe><when>100<\/when><value><horiz>0<\/horiz><vert>0\.037037<\/vert><\/value><\/keyframe>/.test(x7));
check("XML: opacity keyframes (20 % -> 100 %), the sound layer's level keyframes (0 -> 1)",
  /<parameterid>opacity<\/parameterid>[^]*?<keyframe><when>25<\/when><value>20<\/value><\/keyframe><keyframe><when>75<\/when><value>100<\/value><\/keyframe>/.test(x7)
  && /<parameterid>level<\/parameterid>[^]*?<keyframe><when>0<\/when><value>0<\/value><\/keyframe><keyframe><when>25<\/when><value>1<\/value><\/keyframe>/.test(x7));
check("XML: the grade in words + the baked .cube named in the clip's comment (asked once for the graded clip); the record for bitGen",
  luts.length === 1 && /<mastercomment1>bitGen grade: exposure \+0\.5, contrast \+20 - baked as t_luts\/a_1\.cube/.test(x7) && /<mastercomment4>bitgen:[A-Za-z0-9+/=]+<\/mastercomment4>/.test(x7), luts);
check("XML: the captions as a track of Text generators (escaped)", (x7.match(/<generatoritem /g) || []).length === 2 && /<effectid>Text<\/effectid>/.test(x7) && /<value>A &amp; B &lt;ok&gt;<\/value>/.test(x7));
const b7 = IX.fromFcpXml(x7, { fps: 25 }).tl;
const a7 = b7.video[0], v27 = b7.vlayers[0].clips[0];
check("...read back: scale 1.2, rotation 10, the position keys (300, -60) / (0, 40), the opacity keys, the grade (record)",
  a7.tf && a7.tf.scale === 1.2 && a7.tf.rot === 10 && a7.kf.find((k) => k.at === 2 && k.x === 300 && k.y === -60) && a7.kf.find((k) => k.at === 3 && k.x === 0 && k.y === 40)
  && a7.kf.find((k) => k.at === 0 && k.op === 0.2) && a7.opacity === 1 && a7.fx && a7.fx.grade && a7.fx.grade.exposure === 0.5, a7);
check("...a V2 clip: its 2x speed (Time Remap) AND its blur (the record) - one fx", v27.fx && v27.fx.speed === 2 && v27.fx.vfx && v27.fx.vfx.blur === 4 && v27.opacity === 0.5, v27);
check("...the sound's level keys, the captions (2 cues), the reversed half-speed clip", JSON.stringify(b7.audio[0].clips[0].kf) === '[{"at":0,"vol":0},{"at":1,"vol":1}]'
  && b7.captions && b7.captions.cues.length === 2 && b7.captions.cues[1].text === "A & B <ok>" && b7.video[1].fx.reverse === true && b7.video[1].fx.speed === 0.5, { a: b7.audio[0].clips[0], cap: b7.captions, v: b7.video[1] });
check("...the static position held under keys round-trips through the tween (KF.value at 2.5 s the same)", near(KF.value(a7.kf, 2.5, "x", 0), KF.value(TL.video[0].kf, 2.5, "x", 0), 0.5));
if (hasOtio) {
  fs.writeFileSync(path.join(TMP, "x7.xml"), x7);
  const r = spawnSync("python3", ["-c", `import opentimelineio as otio,json,sys
t=otio.adapters.read_from_file(sys.argv[1])
print(json.dumps([[tr.kind,[c.name for c in tr if isinstance(c, otio.schema.Clip)]] for tr in t.tracks]))`, path.join(TMP, "x7.xml")], { encoding: "utf8" });
  let tr = null; try { tr = JSON.parse(r.stdout); } catch { /* fail below */ }
  check("OpenTimelineIO reads the XML with the extras (3 video tracks: V1, V2, the captions; 2 audio)", tr && tr.filter((t) => t[0] === "Video").length === 3 && tr[2][1].join("|") === "Hello there|A & B <ok>", r.stderr || tr);
} else { skip++; console.log("SKIP: OpenTimelineIO is not installed - another reader did not check the XML"); }

/* ---- 3. FCPXML */
const FC = require(path.join(ROOT, "lib", "fcpxml.js"));
check("rational times: 0s, whole seconds, frames over the base, NTSC 1001/30000", FC.rt(0, 25) === "0s" && FC.rt(50, 25) === "2s" && FC.rt(38, 25) === "38/25s" && FC.rt(3, 29.97) === "3003/30000s"
  && near(FC.secsOf("3003/30000s"), 0.1001) && FC.secsOf("2s") === 2);
const xf = FC.toFcpx(TL, { fps: 25, w: 1920, h: 1080, tc: { start: "01:00:00:00", fps: 25 }, name: "my cut", lut: () => "my cut_luts/a_1.cube",
  abs: (x) => "/media/" + x.name });
check("FCPXML 1.10: a format, an asset per file (media-rep file:// path), library > event > project 'my cut' > sequence tcStart 3600s",
  /^<\?xml[^]*<fcpxml version="1\.10">/.test(xf) && /<format id="r1" frameDuration="1\/25s" width="1920" height="1080"/.test(xf) && /<media-rep kind="original-media" src="file:\/\/\/media\/a\.mp4"\/>/.test(xf)
  && /<project name="my cut"><sequence format="r1" duration="12s" tcStart="3600s" tcFormat="NDF"/.test(xf));
check("...the primary storyline: a.mp4 at 3600s, a gap, c.mp4 (timeMap: reversed half speed); V2 on lane 1, the sound lane -1, captions above",
  /<spine><asset-clip ref="r\d+" offset="3600s" name="a\.mp4" start="1s" duration="4s">/.test(xf) && /<gap name="Gap" offset="3604s" start="0s" duration="2s">/.test(xf)
  && /<timeMap><timept time="0s" value="3s" interp="linear"\/><timept time="6s" value="0s" interp="linear"\/><\/timeMap>/.test(xf)
  && /lane="1" offset="2s" name="b\.mp4"/.test(xf) && /lane="-1" offset="37\/25s" name="m\.wav"/.test(xf) && /<caption lane="2" offset="37\/25s"/.test(xf));
check("...adjust-transform (FCP X units: frame height = 100, y up, counter-clockwise) with keys, adjust-blend keys, adjust-volume dB keys, a marker, the grade note",
  /<adjust-transform position="27\.7778 5\.5556" scale="1\.2 1\.2" rotation="-10">/.test(xf) && /<keyframe time="3s" value="27\.7778 5\.5556"\/>/.test(xf)
  && /<adjust-blend amount="0\.2"><param name="amount"><keyframeAnimation><keyframe time="1s" value="0\.2"\/><keyframe time="3s" value="1"\/>/.test(xf)
  && /<keyframe time="0s" value="-96dB"\/><keyframe time="1s" value="0dB"\/>/.test(xf) && /<marker start="87\/25s" duration="1\/25s" value="beat"\/>/.test(xf)
  && /<note>bitGen grade: exposure \+0\.5, contrast \+20 - baked as my cut_luts\/a_1\.cube \(Effects → Custom LUT\) · bitgen:/.test(xf));
const bf = FC.fromFcpx(xf, { fps: 25 });
const fa = bf.tl.video[0];
check("...read back: V1 a.mp4 (1..5) + c.mp4 reversed half speed (0..3) at 6 s; V2's 2x clip at 1 s and its plain one at 7 s",
  bf.tl.video.length === 2 && fa.in === 1 && fa.out === 5 && bf.tl.video[1].start === 6 && bf.tl.video[1].fx.reverse && bf.tl.video[1].fx.speed === 0.5 && bf.tl.video[1].in === 0 && bf.tl.video[1].out === 3
  && bf.tl.vlayers[0].clips.length === 2 && bf.tl.vlayers[0].clips[0].fx.speed === 2 && bf.tl.vlayers[0].clips[0].start === 1 && bf.tl.vlayers[0].clips[1].start === 7, bf.tl);
check("...moves + keys, opacity keys, the grade, the sound's keys, the captions, the marker, the start timecode, the name",
  fa.tf && fa.tf.scale === 1.2 && fa.tf.rot === 10 && fa.kf.find((k) => k.at === 2 && k.x === 300 && k.y === -60) && fa.kf.find((k) => k.at === 0 && k.op === 0.2) && fa.fx.grade.contrast === 20
  && bf.tl.audio[0].clips[0].kf.length === 2 && bf.tl.captions.cues.length === 2 && bf.tl.seqMarkers.length === 1 && near(bf.tl.seqMarkers[0].t, 2.48, 0.01) && bf.tl.tc.start === "01:00:00:00" && bf.name === "my cut", { fa, a: bf.tl.audio, m: bf.tl.seqMarkers, tc: bf.tl.tc });
const ntsc = FC.toFcpx({ v1: {}, video: [{ name: "a.mp4", in: 0, out: 2, dur: 2, start: 0 }], vlayers: [], audio: [], images: [] }, { fps: 29.97, tc: { start: "01:00:00;00", fps: 29.97, drop: true } });
check("...29.97 drop-frame: frameDuration 1001/30000s, tcFormat DF, read back as 29.97 with ; timecode", /frameDuration="1001\/30000s"/.test(ntsc) && /tcFormat="DF"/.test(ntsc)
  && FC.fromFcpx(ntsc, {}).fps === 29.97 && FC.fromFcpx(ntsc, {}).tl.tc.start === "01:00:00;00");
let fe = null; try { FC.fromFcpx("<fcpxml version='1.10'><resources/><library><event/></library></fcpxml>", {}); } catch (e) { fe = e; }
check("...an FCPXML with no project: refused in words", fe && /export a PROJECT/.test(fe.message));
const fm = FC.fromFcpx(xf, { fps: 25, find: (n) => (n === "b.mp4" ? null : { src: "video", kind: "video" }) });
check("...media not in the project listed (b.mp4), the rest opened", fm.missing.join() === "b.mp4" && fm.tl.video.length === 2 && !fm.tl.vlayers.length);
if (hasFcpx) {
  const plain = FC.toFcpx(Object.assign({}, TL, { images: [] }), { fps: 25, w: 1920, h: 1080, abs: (x) => "/media/" + x.name });
  fs.writeFileSync(path.join(TMP, "x.fcpxml"), plain);
  const r = spawnSync("python3", ["-c", `import opentimelineio as otio,json,sys
c=otio.adapters.read_from_file(sys.argv[1], adapter_name="fcpx_xml")
t=c[0] if isinstance(c, otio.schema.SerializableCollection) else c
print(json.dumps([[tr.kind,[[x.name,x.range_in_parent().start_time.value] for x in tr if isinstance(x, otio.schema.Clip)]] for tr in t.tracks]))`, path.join(TMP, "x.fcpxml")], { encoding: "utf8" });
  let tr = null; try { tr = JSON.parse(r.stdout); } catch { /* fail below */ }
  const flat = tr ? tr.map((t) => t[1].map((c) => c.join("@")).join(",")) : [];
  check("OpenTimelineIO's FCP X reader places every clip where it plays (a 0, c 150; b 25 and 175; m.wav 12 frames in)",
    tr && flat.includes("a.mp4@0,c.mp4@150") && flat.includes("b.mp4@25,b.mp4@175") && flat.includes("m.wav@12"), r.stderr || tr);
} else { skip++; console.log("SKIP: OpenTimelineIO's FCP X adapter (otio-fcpx-xml-adapter) is not installed - another reader did not check the FCPXML"); }
const rx = read("routes", "interchange.js"), ux = read("ext", "timelinedock", "interchange.js");
check("the route: format fcpx -> .fcpxml, an .fcpxml read back as Final Cut Pro X; each graded clip's look baked (clipFx.bakedLut) beside it",
  /fcpx: "fcpxml"/.test(rx) && /fcpx\.fromFcpx\(text, o\)/.test(rx) && /clipFx\.bakedLut\(fx\)/.test(rx) && /_luts\//.test(rx));
check("⇄ Exchange: FCPXML in the list, .fcpxml accepted, the moves / keyframes / markers / captions sent (not stripped), 'Kept' says what travels",
  /\["fcpx", "FCPXML 1\.10/.test(ux) && /accept="\.xml,\.fcpxml,\.edl"/.test(ux) && !/delete o\.kf/.test(ux) && /seqMarkers: tl\.seqMarkers/.test(ux) && /captions: tl\.captions/.test(ux) && /Not carried: 3D layers/.test(ux));

/* ---- 4. transcript across a layer / the sequence */
const X = require(path.join(ROOT, "static", "textedit.js"));
const mk = () => ({ v1: { name: "V1" }, video: [{ name: "a.mp4", start: 0, in: 0, out: 4, dur: 4 }, { name: "b.mp4", start: 4, in: 0, out: 3, dur: 3 }],
  vlayers: [{ name: "V2", clips: [{ name: "c.mp4", start: 5, in: 0, out: 2, dur: 2 }] }, { name: "Karaoke", karaoke: true, clips: [{ name: "k.webm", start: 0, in: 0, out: 9, dur: 9 }] }],
  audio: [{ name: "Music", role: "music", clips: [{ name: "m.wav", start: 6, in: 0, out: 4, dur: 4 }] }, { name: "VO", role: "voice", clips: [{ name: "vo.wav", start: 1, in: 0, out: 1, dur: 1 }, { name: "vo.wav", start: 8, in: 2, out: 3, dur: 3 }] }],
  images: [{ name: "I1", clips: [{ name: "p.png", start: 7.5, len: 1 }] }] });
const T1 = mk();
const us = X.units(T1, "seq");
check("units (the whole sequence): V1, the video layers, the 🗣 voice sound layer - in the order they play; not the music, the karaoke, the pictures",
  us.map((u) => u.c.name + "@" + u.c.start).join() === "a.mp4@0,vo.wav@1,b.mp4@4,c.mp4@5,vo.wav@8", us.map((u) => u.c.name + "@" + u.c.start));
check("units (a layer / a clip): every clip on V1; the pieces of one file", X.units(T1, "layer", { lk: "v1" }).length === 2 && X.units(T1, "clip", { lk: "a:1", name: "vo.wav" }).length === 2 && X.units(T1, "layer", { lk: "a:0" }).length === 1);
const r1 = X.applyUnits(T1, us, (u) => (u.c.name === "a.mp4" ? [[1, 2]] : u.c.name === "c.mp4" ? [[0.5, 1]] : []), true);
check("a cut in a.mp4 (1 s) + one in c.mp4 (0.5 s) across the SEQUENCE: 1.5 s out of 2 clips; every layer after each cut moves up (music 6 -> 5 (it starts inside c.mp4: only the first cut moves it), the picture 7.5 -> 6, the later voice 8 -> 6.5)",
  r1.total === 1.5 && r1.made === 2 && JSON.stringify(T1.video.map((c) => [c.start, c.in, c.out])) === "[[0,0,1],[1,2,4],[3,0,3]]"
  && JSON.stringify(T1.vlayers[0].clips.map((c) => [c.start, c.in, c.out])) === "[[4,0,0.5],[4.5,1,2]]" && T1.audio[0].clips[0].start === 5 && T1.images[0].clips[0].start === 6 && T1.audio[1].clips[1].start === 6.5 && T1.audio[1].clips[0].start === 1,
  { r1, v: T1.video, v2: T1.vlayers[0].clips, a: T1.audio, i: T1.images[0].clips });
const T2 = mk();
X.applyUnits(T2, X.units(T2, "layer", { lk: "v1" }), (u) => (u.c.name === "a.mp4" ? [[1, 2]] : []), false);
check("...the same cut for a LAYER only: V1 ripples, the other layers stay where they were", T2.video[2].start === 3 && T2.vlayers[0].clips[0].start === 5 && T2.audio[0].clips[0].start === 6, T2.video);
check("tlAt: a word's source second -> where it plays (a 2x clip: 3 s of source at 1 s into it)", X.tlAt({ start: 2, in: 1, out: 5, fx: { speed: 2 } }, 3) === 3 && X.tlAt({ start: 2, in: 1, out: 5 }, 3) === 4);
const te = read("ext", "timelinedock", "textedit.js");
check("📝 the panel: a scope (this clip / its whole layer / the whole sequence), each file transcribed once, words keyed clip|word, the sequence's cut syncs every layer",
  /id="tteScope"/.test(te) && /the whole sequence/.test(te) && /data-u="/.test(te) && /applyUnits\(tl, list, function \(u\) \{ return rangesFor\(u, u\.k\); \}, scope === "seq"\)/.test(te) && /wordsBy\[nm\] = j\.words/.test(te));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed` + (skip ? `, ${skip} skipped` : ""));
process.exit(fail ? 1 : 0);
