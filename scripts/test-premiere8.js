#!/usr/bin/env node
/* bitGen Studio — 2.413.0 units: the partly-done Premiere items finished - the edit tools on REVERSED and RAMPED clips
 * (frame-exact, static/edittools.js trimEdge; Ctrl+K on retimed clips), edit by transcript on retimed clips, SMART
 * REFRAME (scripts/reframe.py, the "follow" fit), the XML's speed as FCP 7 / Premiere write it (speed-adjusted in / out)
 * checked by another reader (OpenTimelineIO), STABILISE with vidstab (smoothing / locked) + the canvas's steady
 * preview (lib/stabilise.js), and the text presets' bevel PROFILE contour (both contours kept).
 * Tim: "do the smaller jobs and complete the 10 partly done jobs". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const py = (code, cwd) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: cwd || ROOT, maxBuffer: 64 << 20 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p8_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });

/* ---- 1. edit tools on reversed / ramped clips, frame-exact */
const E = require(path.join(ROOT, "static", "edittools.js")), F = require(path.join(ROOT, "static", "clipfx.js"));
const rev = { start: 0, in: 2, out: 6, dur: 10, fx: { reverse: true } };
const t1 = E.trimEdge(rev, "l", 1);
check("a reversed clip's LEFT edge is its source out: trimmed 1 s -> out 5 (the frame now first = the one that was at 1 s)",
  t1.in === 2 && t1.out === 5 && near(F.srcTime(Object.assign({}, rev, t1), 0), F.srcTime(rev, 1)), t1);
check("...its right edge trimmed / both extended: in moves (3), out grows (7) - the source beside each edge", E.trimEdge(rev, "r", -1).in === 3 && E.trimEdge(rev, "l", -1).out === 7);
const rp = { start: 0, in: 0, out: 6, dur: 10, fx: F.normalize({ ramp: [{ p: 0, s: 0.5 }, { p: 1, s: 2 }] }) };
const L = F.clipLen(rp), tr = Object.assign({}, rp, E.trimEdge(rp, "l", 1.3));
let drift = 0; for (let u = 0; u < F.clipLen(tr); u += 0.02) drift = Math.max(drift, Math.abs(F.srcTime(tr, u) - F.srcTime(rp, u + 1.3)));
check("a ramp trimmed 1.3 s at its head: 1.3 s shorter, every remaining frame where it was (under a millisecond-scale drift - not an average rate)",
  near(F.clipLen(tr), L - 1.3, 0.005) && drift < 0.005, { len: F.clipLen(tr), L, drift });
const ex = E.trimEdge(rp, "r", 1.5);
check("a ramp extended 1.5 s at its tail: the new source played at the ramp's END speed (2x = 3 s), a key there", ex.out === 9 && ex.fx.ramp[ex.fx.ramp.length - 1].s === 2 && near(F.clipLen(Object.assign({}, rp, ex)), L + 1.5, 0.02), ex);
check("room: how far an edge can go out - the source beside it at that edge's speed", near(E.room(rp, "r"), 2) && E.room(rp, "l") === 0 && E.room(rev, "l") === 4 && E.room(rev, "r") === 2);
const rl = E.roll({ start: 0, in: 0, out: 4, dur: 10 }, { start: 4, in: 1, out: 5, dur: 10, fx: { reverse: true } }, 0.5);
check("roll onto a reversed clip: the left one grows 0.5 s, the reversed one's left edge (its out) comes in", rl.a.out === 4.5 && rl.b.out === 4.5 && rl.b.in === 1 && rl.b.start === 4.5, rl);
const sd = E.slide({ start: 0, in: 0, out: 3, dur: 10, fx: { speed: 2 } }, { start: 1.5, in: 0, out: 2, dur: 10 }, { start: 3.5, in: 1, out: 4, dur: 10, fx: { reverse: true } }, 0.5);
check("slide between a 2x clip and a reversed one: both neighbours give and take through their own maps", sd.prev.out === 4 && sd.c.start === 2 && sd.next.out === 3.5 && sd.next.start === 4, sd);
const rr = E.ripple([rev, { start: 4, in: 0, out: 2 }], rev, "r", -1);
check("ripple on a reversed clip: 1 s shorter, the clip after it 1 s earlier", rr.clips[0].in === 3 && rr.clips[1].start === 3 && rr.moved === -1, rr);
check("slip on a reversed clip: the source window moves (it used to be refused)", JSON.stringify(E.slip(rev, 1)) === '{"in":3,"out":7,"moved":1}');

/* ---- 2. Ctrl+K and transcript edits on retimed clips */
const MK = require(path.join(ROOT, "static", "tlmarks.js"));
const sps = [{ speed: 2 }, { reverse: true }, rp.fx].map((fx) => {
  const c = { start: 1, in: 1, out: 7, dur: 10, fx }, Lc = F.clipLen(c), at = Lc * 0.4, [a, b] = MK.splitClip(c, 1 + at, "v1");
  return { sum: F.clipLen(a) + F.clipLen(b) - Lc, cont: F.srcTime(b, 0) - F.srcTime(c, at), start: b.start - (1 + at) };
});
check("Ctrl+K on a 2x / reversed / ramped clip: two halves as long as the whole, the right half starts on the frame at the cut",
  sps.every((x) => Math.abs(x.sum) < 0.01 && Math.abs(x.cont) < 0.005 && Math.abs(x.start) < 1e-3), sps);
const X = require(path.join(ROOT, "static", "textedit.js"));
const r2 = X.remove({ start: 2, in: 0, out: 8, dur: 10, fx: { speed: 2 } }, [[2, 4]]);
check("transcript: a word's 2 s of source cut from a 2x clip = 1 s of timeline; the pieces end to end", r2.removed === 1 && JSON.stringify(r2.pieces.map((p) => [p.start, p.in, p.out])) === "[[2,0,2],[3,4,8]]", r2);
const r3 = X.remove({ start: 0, in: 0, out: 8, dur: 10, fx: { reverse: true } }, [[2, 4]]);
check("...a reversed clip: pieces in the order it PLAYS (the end of the source first)", JSON.stringify(r3.pieces.map((p) => [p.start, p.in, p.out])) === "[[0,4,8],[4,0,2]]" && r3.removed === 2, r3);
const r4 = X.remove(rp, [[1, 2]]);
check("...a ramp: each piece re-fitted, what was removed = the timeline time that second took", r4.pieces.length === 2 && near(r4.removed + r4.pieces.reduce((s, p) => s + F.clipLen(p), 0), L, 0.01), r4);
check("splitAt on a reversed clip (scene cuts): pieces where they play", JSON.stringify(X.splitAt({ start: 0, in: 0, out: 8, dur: 10, fx: { reverse: true } }, [3, 6]).map((p) => [p.start, p.in, p.out])) === "[[0,6,8],[2,3,6],[5,0,3]]");

/* ---- 3. the XML's speed */
const IX = require(path.join(ROOT, "lib", "interchange.js"));
const tlx = { video: [{ name: "a.mp4", src: "video", start: 0, in: 2, out: 6, dur: 10, fx: { speed: 2 } }, { name: "b.mp4", src: "video", start: 2, in: 0, out: 4, dur: 10, fx: { reverse: true } },
  { name: "c.mp4", src: "video", start: 6, in: 0, out: 3, dur: 10, fx: { speed: 0.5 } }], vlayers: [], audio: [], images: [] };
const xml = IX.toFcpXml(tlx, { fps: 25, name: "speed" });
const ci = (n) => new RegExp("<clipitem[^>]*><name>" + n + "<\\/name>[\\s\\S]*?<\\/clipitem>").exec(xml)[0];
const fr = (s, t) => +new RegExp("<" + t + ">(-?\\d+)<\\/" + t + ">").exec(s)[1];
const A2 = ci("a\\.mp4"), C2 = ci("c\\.mp4");
check("XML: a remapped clip's in / out in SPEED-ADJUSTED frames (out - in = end - start; source in = in x speed), the clip's duration too",
  fr(A2, "in") === 25 && fr(A2, "out") - fr(A2, "in") === fr(A2, "end") - fr(A2, "start") && fr(C2, "in") === 0 && fr(C2, "out") === 150 && /<duration>125<\/duration>/.test(A2), { A2: A2.slice(0, 300) });
const back = IX.fromFcpXml(xml, {});
check("...read back: source in / out, speed and reverse as they were", JSON.stringify(back.tl.video.map((c) => [c.start, c.in, c.out, c.fx])) === '[[0,2,6,{"speed":2}],[2,0,4,{"reverse":true}],[6,0,3,{"speed":0.5}]]', back.tl.video);
const legacy = xml.replace("<in>25</in><out>75</out>", "<in>50</in><out>150</out>");
check("...an XML from bitGen 2.407-2.412 (source frames) still reads right", JSON.stringify(IX.fromFcpXml(legacy, {}).tl.video[0].fx) === '{"speed":2}' && IX.fromFcpXml(legacy, {}).tl.video[0].in === 2 && IX.fromFcpXml(legacy, {}).tl.video[0].out === 6);
fs.writeFileSync(path.join(TMP, "speed.xml"), xml); fs.writeFileSync(path.join(TMP, "speed.otio"), IX.toOtio(tlx, { fps: 25, name: "speed" }));
const OT = spawnSync("python3", ["-c", `import json, opentimelineio as otio
out = {}
for f in ("speed.xml", "speed.otio"):
    t = otio.adapters.read_from_file(f)
    rows = []
    for tr in t.video_tracks():
        for it in tr:
            if isinstance(it, otio.schema.Clip):
                r = it.trimmed_range_in_parent()
                eff = [{"k": e.schema_name(), "s": getattr(e, "time_scalar", None), "md": json.loads(otio.adapters.write_to_string(e, "otio_json"))} for e in it.effects]
                rows.append([it.name, r.start_time.value, r.duration.value, it.source_range.start_time.value, it.source_range.duration.value, eff])
    out[f] = rows
print(json.dumps(out))`], { cwd: TMP, encoding: "utf8" });
if (OT.status !== 0 && /No module named/.test(OT.stderr || "")) { skip++; console.log("SKIP: OpenTimelineIO (pip install opentimelineio otio-fcp-adapter) is not here - the other-reader checks did not run"); }
else {
  const o = JSON.parse(OT.stdout || "{}"), ox = o["speed.xml"] || [], oo = o["speed.otio"] || [];
  const tm = (e) => JSON.stringify(e.md || {});
  check("OpenTimelineIO reading our FCP XML: every clip at its place and length on the timeline; its source range length = its timeline length (the FCP 7 convention); the Time Remap kept (speed 200 / reverse / 50)",
    ox.length === 3 && ox[0][1] === 0 && ox[0][2] === 50 && ox[0][4] === 50 && ox[1][1] === 50 && ox[1][2] === 100 && ox[2][1] === 150 && ox[2][2] === 150
    && /timeremap/.test(tm(ox[0][5][0])) && /"200"|: ?200|>200</.test(tm(ox[0][5][0]).replace(/\\"/g, '"')) && /TRUE/.test(tm(ox[1][5][0])), ox);
  check("OpenTimelineIO reading our OTIO: LinearTimeWarp 2 / -1 / 0.5, the media in-points (2 s = 50, 0, 0), the timeline lengths",
    oo.length === 3 && oo[0][5][0].s === 2 && oo[1][5][0].s === -1 && oo[2][5][0].s === 0.5 && oo[0][3] === 50 && oo[0][2] === 50 && oo[2][2] === 150, oo);
}

/* ---- 4. smart reframe */
ff(["-f", "lavfi", "-i", "color=c=0x203040:s=1280x720:r=25:d=6", "-f", "lavfi", "-i", "color=c=0xffd040:s=160x160:r=25:d=6", "-filter_complex",
  "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-80,Y-80),78),255,0)'[o];[0:v][o]overlay=x='100+t*170':y='280+60*sin(t)'", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "m.mp4")]);
const RF = JSON.parse(py(`import reframe as R
a = R.analyse("m.mp4")
p = R.smooth(a["track"], a["dur"])
err = [abs(x[1] - (180 + 170 * x[0]) / 1280) for x in p if 1.0 < x[0] < 5.0]
sp = max(abs(p[i][1] - p[i - 1][1]) * R.SAMPLE_FPS for i in range(1, len(p)))
x0, y0 = R.cmd_file(p, 25, *R.cover(1280, 720, 720, 1280), 720, 1280, "rf.cmd", t0=1.0, t1=3.0)
print(json.dumps({"n": len(a["track"]), "err": sum(err) / len(err), "speed": sp, "cover": R.cover(1280, 720, 720, 1280), "x0": x0, "lines": open("rf.cmd").read().splitlines()[:2], "nl": len(open("rf.cmd").read().splitlines())}))`, TMP));
check("reframe.analyse + smooth: the moving subject followed (within 6 % of the frame's width on average), the pan no faster than 0.35 frame / s",
  RF.n >= 20 && RF.err < 0.06 && RF.speed <= 0.351, RF);
check("cover: a 9:16 crop of 16:9 scales it to 2276 x 1280; cmd_file: crop@rf x / y every frame of the part kept (from 0 s), clamped inside",
  JSON.stringify(RF.cover) === "[2276,1280]" && RF.nl === 51 && /^0\.0000 crop@rf x \d+, crop@rf y 0;$/.test(RF.lines[0]) && RF.x0 > 0 && RF.x0 < 2276 - 720, RF);
const DV = JSON.parse(py(`import deliver as D, shutil, subprocess
shutil.copy("m.mp4", "master.mp4")
logs = []
run = lambda a, echo_cmd=False: subprocess.run(a, capture_output=True).returncode
made = D.finish("master.mp4", {"deliver": [{"preset": "h264", "aspect": "9:16", "size": "720", "fit": "follow"}, {"preset": "h264", "aspect": "9:16", "size": "720", "fit": "crop", "name": "mid"}]}, logs.append, run)
import numpy as np
def ball(f, t):
    b = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    a = np.frombuffer(b, np.uint8).reshape(1280, 720, 3).astype(int)
    m = (a[..., 0] > 200) & (a[..., 1] > 170) & (a[..., 2] < 120)
    return int(m.sum())
print(json.dumps({"made": made, "log": logs, "follow": [ball("master_h264.mp4", t) for t in (1, 3, 5)], "mid": [ball("master_mid.mp4", t) for t in (1, 3, 5)], "left": [f for f in __import__("os").listdir(".") if f.endswith(".cmd")]}))`, TMP));
check("📤 fit follow: the subject stays in the 9:16 frame all the way (the middle crop loses it at the start and the end); the log says what was followed; the cmd files cleaned up",
  DV.follow.every((x) => x > 3000) && DV.mid[0] < 500 && DV.mid[2] < 500 && DV.log.some((l) => /reframe: following the subject/.test(l)) && !DV.left.some((f) => /_rf\d/.test(f)), DV);
const EP = JSON.parse(read("lib", "exportPresets.json"));
check("exportPresets fits: crop, pad, blur, follow", JSON.stringify(EP.fits) === '["crop","pad","blur","follow"]');

/* ---- 5. stabilise */
check("normVfx stabilise: true (the defaults), {smooth, lock} kept, clamped", F.normVfx({ stabilise: true }).stabilise === true && JSON.stringify(F.normVfx({ stabilise: { smooth: 140, lock: 1 } }).stabilise) === '{"smooth":100,"lock":true}'
  && F.normVfx({ stabilise: { smooth: 50 } }).stabilise === true);
const SB = JSON.parse(py(`import vfx_filters as V
n = []
print(json.dumps({"has": V.has_vidstab(), "cfg": [V.stab_cfg({"stabilise": True}), V.stab_cfg({"stabilise": {"smooth": 80, "lock": True}}), V.stab_cfg({})],
  "det": V.stab_filters({"stabilise": {"smooth": 80, "lock": True}}, {"detect": "C:/x/s.trf"}, 25, []), "tr": V.stab_filters({"stabilise": {"smooth": 80}}, {"trf": "/t/s.trf"}, 25, n), "n": n,
  "ds": V.stab_filters({"stabilise": True}, None, 25, [])}))`));
check("vfx_filters: vidstabdetect (tripod when locked, the path escaped) / vidstabtransform (smoothing 80 % = 60 frames at 25 fps) / deshake without vidstab",
  JSON.stringify(SB.cfg) === "[[50,false],[80,true],null]" && /^vidstabdetect=result='C\\:\/x\/s\.trf':shakiness=6:accuracy=12:tripod=1$/.test(SB.det[0])
  && /^vidstabtransform=input='\/t\/s\.trf':smoothing=60:optzoom=1/.test(SB.tr[0]) && /smoothing 80 %/.test(SB.n[0]) && SB.ds[0] === "deshake", SB);
if (!SB.has) { skip++; console.log("SKIP: this ffmpeg has no vidstab - the two-pass render was not measured"); }
else {
  ff(["-f", "lavfi", "-i", "testsrc2=s=400x260:r=25:d=3", "-vf", "crop=320:180:'40+30*sin(t*17)':'40+25*cos(t*23)'", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "shaky.mp4")]);
  const ST = JSON.parse(py(`import clipfx_render as C, subprocess, statistics
logs = []
run = lambda a, echo_cmd=False: subprocess.run(a, capture_output=True).returncode
out = C.render({"path": "shaky.mp4", "in": 0, "out": 3, "dur": 3, "fx": {"vfx": {"stabilise": {"smooth": 70, "lock": False}}}}, ".", 1, logs.append, run)
def jit(f):
    b = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", f, "-vf", "scale=160:90,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    n = 160 * 90
    fr = [b[i:i + n] for i in range(0, len(b) - n + 1, n)]
    return statistics.mean(sum(abs(a[j] - c[j]) for j in range(40 * 160 + 40, 50 * 160 + 120)) / 800 for a, c in zip(fr, fr[1:]))
C.stab_preview("shaky.mp4", "prev.webm", 50, 0)
p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width:format=duration", "-of", "json", "prev.webm"], capture_output=True, text=True).stdout
print(json.dumps({"logs": logs, "before": jit("shaky.mp4"), "after": jit(out["path"]), "prev": json.loads(p)}))`, TMP));
  check("the clip render: the shake measured first (vidstab), then smoothed - frame-to-frame jitter at least halved", ST.logs.some((l) => /the shake measured \(vidstab\)/.test(l)) && ST.logs.some((l) => /stabilised \(smoothing 70 %\)/.test(l)) && ST.after < ST.before / 2, ST);
  check("the steady preview: the whole file, VP9, 640 wide, its length kept", ST.prev.streams[0].codec_name === "vp9" && ST.prev.streams[0].width === 640 && Math.abs(+ST.prev.format.duration - 3) < 0.15, ST.prev);
}
const SL = require(path.join(ROOT, "lib", "stabilise.js"));
check("lib/stabilise: settings normalized (smooth 0..100, lock), a cache name per file + settings", JSON.stringify(SL.norm({ smooth: 130, lock: 1 })) === '{"smooth":100,"lock":true}'
  && /^shaky_[0-9a-f]{16}\.webm$/.test(SL.keyOf(path.join(TMP, fs.existsSync(path.join(TMP, "shaky.mp4")) ? "shaky.mp4" : "m.mp4").replace("m.mp4", "m.mp4"), SL.norm({})).replace(/^m_/, "shaky_")));

/* ---- 6. bevel profile contour */
const A = require(path.join(ROOT, "static", "vendor", "ag-psd.js")), PP = require(path.join(ROOT, "ext", "imageeditdock", "pcpsd.js")), PS = require(path.join(ROOT, "ext", "imageeditdock", "pcstyles.js"));
const ring = [{ x: 0, y: 0 }, { x: 64, y: 255 }, { x: 128, y: 40 }, { x: 255, y: 255 }], gloss = [{ x: 0, y: 0 }, { x: 128, y: 255 }, { x: 255, y: 0 }];
const buf = A.writePsdBuffer({ width: 64, height: 64, children: [{ name: "t", effects: { bevel: { enabled: true, style: "inner bevel", size: { units: "Pixels", value: 8 }, useShape: true,
  contour: { name: "gloss", curve: gloss }, shapeContour: { name: "ring", curve: ring }, range: 0.6 } } }] });
const lay = A.readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true }).children[0];
check("ag-psd (vendored, 2.413.0): a bevel's two contours both read - contour = the gloss (TrnS), shapeContour = the profile (MpgS)",
  lay.effects.bevel.contour.name === "gloss" && lay.effects.bevel.shapeContour.name === "ring" && lay.effects.bevel.shapeContour.curve.length === 4, lay.effects.bevel);
const st = (PP.effectsToStyles || PP.pure.effectsToStyles)(lay.effects).styles;
check("effectsToStyles: bevel.gloss AND bevel.shape (+ range 60 %) - no longer one or the other", st.bevel.gloss && st.bevel.gloss[1][1] === 255 && st.bevel.shape && st.bevel.shape.length === 4 && st.bevel.range === 60, st.bevel);
const w = 48, h = 48, AL = new Float32Array(w * h); for (let y = 8; y < 40; y++) for (let x = 8; x < 40; x++) AL[y * w + x] = 1;
const plain = PS.bevelShade(AL, w, h, { size: 6 }), prof = PS.bevelShade(AL, w, h, { size: 6, shape: st.bevel.shape, range: 60 });
let dif = 0; for (let i = 0; i < plain.length; i++) dif += Math.abs(plain[i] - prof[i]);
let flips = 0; for (let x = 9; x < 24; x++) if (Math.sign(prof[20 * w + x]) !== Math.sign(prof[20 * w + x + 1]) && Math.abs(prof[20 * w + x]) > 0.02) flips++;
check("bevelShade with the profile: the light across the bevel changes (a ring contour lights and shades it more than once)", dif > 20 && flips >= 1, { dif, flips });
const TFX = require(path.join(ROOT, "static", "textfx.js"));
check("textfx presets keep the profile (cleanStyles shape) and only count a lost one when there is none", JSON.stringify(TFX.cleanStyles({ bevel: { on: true, shape: [[0, 0], [64, 255], [255, 255]] } }).bevel.shape) === "[[0,0],[64,255],[255,255]]"
  && /bv\.useShape && !bv\.shapeContour && !bv\.contour\) notes\.glossLost\+\+/.test(read("static", "textfx.js")));

/* ---- 7. wiring */
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts, CV = read("ext", "timelinedock", "canvas.js"), IH = read("static", "index.html"), RC = read("routes", "clipfx.js");
check("the page: stabilise.js before canvas.js; canvas vidUrl plays the steady file; trimHandles through H3EditTools.trimEdge; the routes for the steady preview",
  EXT.indexOf("stabilise.js") >= 0 && EXT.indexOf("stabilise.js") < EXT.indexOf("canvas.js") && /TlStab\.url\(c\)/.test(CV) && /ET\.trimEdge\(c, "l"/.test(IH) && /ET\.trimEdge\(c, "r"/.test(IH)
  && /app\.post\("\/api\/clipfx\/stabilise"/.test(RC) && /app\.get\("\/api\/clipfx\/stabilised\/:file"/.test(RC));
check("clipfx.js: smoothing + locked beside stabilise, the steady preview's state", /id="tfxStabS"/.test(read("ext", "timelinedock", "clipfx.js")) && /id="tfxStabL"/.test(read("ext", "timelinedock", "clipfx.js")) && /tfxStabState/.test(read("ext", "timelinedock", "clipfx.js")));
check("server.js untouched; package.json 2.413.0 or later", !/stabilise|reframe|trimEdge/.test(read("server.js")) && JSON.parse(read("package.json")).version.localeCompare("2.413.0", undefined, { numeric: true }) >= 0);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed` + (skip ? `, ${skip} skipped` : ""));
process.exit(fail ? 1 : 0);
