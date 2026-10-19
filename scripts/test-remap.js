#!/usr/bin/env node
/* bitGen Studio — 2.501.0 unit tests: ⏱ TIME REMAPPING ON A CURVE (static/clipfx.js remap, lib/clipFx.forJob, the
 * compile's scripts/clipfx_render.py remap_graph, ext/timelinedock/tlremap.js, static/edittools.js).
 * Tim: "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on)..". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const ET = require(path.join(ROOT, "static", "edittools.js"));
const R = require(path.join(ROOT, "ext", "timelinedock", "tlremap.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

/* a remap: 0-1 s plays source 0-1, 1-2 s holds source 1, 2-3 s plays 1 back to 0, 3-3.5 s races 0 -> 3 */
const RM = [{ t: 0, q: 0 }, { t: 1, q: 1 }, { t: 2, q: 1 }, { t: 3, q: 0 }, { t: 3.5, q: 3 }];
const c = { in: 2, out: 6, fx: { remap: RM } };

/* ---- normalize */
const n1 = FX.normalize({ speed: 3, reverse: true, ramp: [{ p: 0, s: 1 }, { p: 1, s: 2 }], remap: [{ t: 2, q: 1 }, { t: 1, q: 0 }, { t: 1.001, q: 5 }, { t: "x", q: 1 }] });
check("normalize: remap keys sorted, too-close / bad keys dropped, the first moved to 0; it overrides speed, ramp, reverse",
  n1 && n1.remap.length === 2 && n1.remap[0].t === 0 && n1.remap[1].t === 1 && n1.remap[1].q === 1 && !n1.speed && !n1.ramp && !n1.reverse, n1);
check("normalize: one key is no remap; at most 64 keys", FX.normalize({ remap: [{ t: 0, q: 0 }] }) === null
  && FX.normalize({ remap: Array.from({ length: 90 }, (_, i) => ({ t: i, q: i })) }).remap.length === 64);
check("retimed + the timeline length = the last key's time", FX.retimed(FX.normalize(c.fx)) && near(FX.timelineLen(4, FX.normalize(c.fx)), 3.5) && near(FX.clipLen(c), 3.5));

/* ---- time maps */
const st = [[0.5, 2.5], [1.5, 3], [2.25, 2.75], [2.75, 2.25], [3.25, 3.5], [3.5, 5], [9, 5]].map(([t, w]) => [t, FX.srcTime(c, t), w]);
check("srcTime: forward, the freeze, backwards, the race, held past the end", st.every(([, g, w]) => near(g, w)), st);
check("localTime: the first moment a source second shows (forward part / the frozen frame / outside = null)",
  near(FX.localTime(c, 2.5), 0.5) && near(FX.localTime(c, 3), 1) && near(FX.localTime(c, 4.5), 3 + 2.5 / 6) && FX.localTime(c, 7) === null);
const sg = FX.segments(4, FX.normalize(c.fx));
check("segments: one per key pair, s < 0 backwards, 0 a freeze, their own timeline times",
  sg.length === 4 && near(sg[0].s, 1) && near(sg[1].s, 0) && near(sg[2].s, -1) && near(sg[3].s, 6) && near(sg[3].t0, 3) && near(sg[3].t1, 3.5), sg);
const sl = FX.slice(c, 0.5, 2.5);
check("slice: the keys inside re-fitted to the slice (its own in point, time from 0)",
  near(sl.in, 2.5) && near(sl.out, 3) && sl.fx.remap.length === 4 && near(sl.fx.remap[0].q, 0) && near(sl.fx.remap[1].t, 0.5) && near(sl.fx.remap[1].q, 0.5) && near(sl.fx.remap[3].t, 2) && near(sl.fx.remap[3].q, 0)
  && near(FX.srcTime(Object.assign({ in: sl.in, out: sl.out }, { fx: sl.fx }), 1.25), FX.srcTime(c, 1.75)), sl);

/* ---- the export */
const CF = require(path.join(ROOT, "lib", "clipFx.js"));
const job = CF.forJob(c.fx, { in: 2, out: 6, name: "a" });
check("forJob: the segments carry their timeline length d; tl_len = 3.5", job.segments.length === 4 && job.segments.every((s) => "d" in s) && near(job.segments[1].d, 1) && near(job.segments[3].d, 0.5) && near(job.tl_len, 3.5), job);
check("forJob: a speed / ramp clip's segments stay as they were (no d)", CF.forJob({ speed: 2 }, { in: 0, out: 4 }).segments.every((s) => !("d" in s)));
const pieces = JSON.parse(py("import clipfx_render as R\nprint(json.dumps(R.remap_pieces(" + JSON.stringify(job.segments) + ", 4.0, 24.0)))"));
check("remap_pieces: fwd / hold / back / fwd with their lengths", pieces.map((p) => p[0]).join() === "fwd,hold,back,fwd" && near(pieces[2][1], 0) && near(pieces[2][2], 1) && near(pieces[3][4], 6) && near(pieces.reduce((a, p) => a + p[3], 0), 3.5), pieces);
const gr = JSON.parse(py("import clipfx_render as R\ng = R.graph(dict(segments=" + JSON.stringify(job.segments) + "), dict(video=True, audio=True, fps=24.0, alpha=False, w=160, h=90), 4.0)\nprint(json.dumps(g))"));
check("the graph: each piece trimmed, reversed / held (tpad clone), joined; sound reversed / silent for the freeze; 3.5 s",
  near(gr[3], 3.5) && /reverse,setpts=\(PTS-STARTPTS\)\/1\.0+,fps=24/.test(gr[0]) && /tpad=stop_mode=clone:stop_duration=1\.0000/.test(gr[0]) && /concat=n=4:v=1:a=0\[vr\]/.test(gr[0])
  && /areverse/.test(gr[0]) && /aevalsrc=0\|0:s=48000:c=stereo:d=1\.0000\[at1\]/.test(gr[0]) && /concat=n=4:v=0:a=1\[ar\]/.test(gr[0]), gr[0].slice(0, 900));
let rendered = null;
try {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remap-")), src = path.join(dir, "src.mp4"), out = path.join(dir, "out.mkv");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "nullsrc=s=160x90:r=24:d=4,geq=lum='min(235,16+T*50)':cb=128:cr=128,format=yuv420p", "-f", "lavfi", "-i", "sine=f=440:d=4", "-shortest", "-c:v", "libx264", "-c:a", "aac", src]);
  const g = JSON.parse(py("import clipfx_render as R\nfrom pathlib import Path\ninfo = R._probe(Path(" + JSON.stringify(src) + "))\nprint(json.dumps(R.graph(dict(segments=" + JSON.stringify(job.segments) + "), info, 4.0)[0]))"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-filter_complex", g, "-map", "[v]", "-map", "[a]", "-c:v", "ffv1", "-c:a", "pcm_s16le", out]);
  const lum = (t) => { const b = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", out, "-frames:v", "1", "-vf", "scale=1:1,format=gray", "-f", "rawvideo", "-"]); return b[0]; };
  const want = (q) => (16 + q * 50 - 16) * 255 / 219;                // the limited-range luma, read back as full range
  rendered = [[0.5, 0.5], [1.5, 1], [2.75, 0.25], [3.25, 1.5]].map(([t, q]) => [t, lum(t), Math.round(want(q))]);
  const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" });
  rendered.push(["dur", dur]);
  check("the render: the frames show the remapped source seconds (forward, frozen, backwards, raced) and it lasts 3.5 s",
    rendered.slice(0, 4).every(([, g2, w]) => Math.abs(g2 - w) <= 8) && near(dur, 3.5, 0.06), rendered);
  fs.rmSync(dir, { recursive: true, force: true });
} catch (e) { check("the render (ffmpeg)", false, String(e.message || e).slice(0, 400)); }

/* ---- the curve editor's maths */
const plain = R.start({ in: 1, out: 5 }, FX), fast = R.start({ in: 0, out: 4, fx: { speed: 2 } }, FX), back = R.start({ in: 0, out: 4, fx: { reverse: true } }, FX);
const ramp = { in: 0, out: 6, fx: FX.normalize({ ramp: [{ p: 0, s: 0.5 }, { p: 1, s: 2 }] }) }, rs = R.start(ramp, FX);
check("start: the keys play the clip as it is (straight / a speed / reversed / a ramp sampled)",
  JSON.stringify(plain) === JSON.stringify([{ t: 0, q: 0 }, { t: 4, q: 4 }]) && near(fast[1].t, 2) && near(fast[1].q, 4) && near(back[0].q, 4) && near(back[1].q, 0)
  && rs.length === 9 && rs.every((k) => near(FX.srcTime(Object.assign({}, ramp, { fx: { remap: rs } }), k.t), FX.srcTime(ramp, k.t), 1e-3)), { plain, fast, back, rs });
const ak = R.addKey(RM, 0.5), ak2 = R.addKey(RM, 1.005);
check("addKey: a key on the curve where it is; none when one is that close", ak.rm.length === 6 && ak.i === 1 && near(ak.rm[1].q, 0.5) && ak2.rm.length === 5 && ak2.i === 1);
const fz = R.freeze([{ t: 0, q: 0 }, { t: 4, q: 4 }], 1, 2);
check("freeze: a flat stretch at the playhead, the rest later", JSON.stringify(fz) === JSON.stringify([{ t: 0, q: 0 }, { t: 1, q: 1 }, { t: 3, q: 1 }, { t: 6, q: 4 }]), fz);
const mk = R.moveKey(RM, 2, 9, -3, 4), mk0 = R.moveKey(RM, 0, 5, 2, 4);
check("moveKey: never past its neighbours, the source kept inside, the first key stays at 0", near(mk[2].t, 2.98) && mk[2].q === 0 && mk0[0].t === 0 && mk0[0].q === 2, { mk, mk0 });
check("delKey: not the first, never below 2 keys", R.delKey(RM, 2).length === 4 && R.delKey(RM, 0).length === 5 && R.delKey(RM.slice(0, 2), 1).length === 2);

/* ---- the edit tools */
const c4 = { in: 0, out: 4, start: 0, fx: { remap: [{ t: 0, q: 0 }, { t: 4, q: 4 }] } };
const er = ET.trimEdge(c4, "r", 1), el = ET.trimEdge(c4, "l", -1), es = ET.trimEdge(c4, "r", -1);
check("trimEdge: lengthening a remapped clip holds its edge frame (right / left); shortening slices the keys",
  near(FX.clipLen(Object.assign({}, c4, er)), 5) && er.fx.remap.length === 3 && near(er.fx.remap[2].q, 4)
  && near(FX.clipLen(Object.assign({}, c4, el)), 5) && el.fx.remap[0].q === 0 && near(el.fx.remap[1].t, 1)
  && near(FX.clipLen(Object.assign({}, c4, es)), 3) && near(es.out, 3), { er, el, es });

/* ---- the page wiring */
const CV = read("ext", "timelinedock", "canvas.js"), RS = read("ext", "timelinedock", "retimesound.js"), CX = read("ext", "timelinedock", "clipfx.js"), TR = read("ext", "timelinedock", "tlremap.js");
check("canvas: a remapped clip is seek-driven (its frames follow the curve); its sound is the retimed-sound file",
  /function seekDriven\(c\) \{ return retimed\(c\) && !!\(c\.fx\.reverse \|\| c\.fx\.ramp \|\| c\.fx\.remap\); \}/.test(CV) && /remap: c\.fx\.remap \} \};/.test(RS) && (RS.match(/c\.fx\.remap\)/g) || []).length >= 2);
check("🎬 Speed: ⏱ Time remap (on, ◇ Key, ❄ Freeze, the curve, the key row); speed / reverse / ramp off while it is on",
  /TlRemap\.html\(c, fx\)/.test(CX) && /TlRemap\.wire\(c, d, commit, lenTxt\)/.test(CX) && /fx\.ramp \|\| fx\.remap \? " disabled"/.test(CX)
  && ["tfxRmOn", "tfxRmKey", "tfxRmFrz", "tfxRmCv", "tfxRmT", "tfxRmQ", "tfxRmDel"].every((id) => TR.includes('id="' + id + '"')));
check("captions / karaoke / a new AI take know a remap", /remap: c\.fx\.remap \} : undefined/.test(read("ext", "timelinedock", "captions.js")) && /fx\.reverse \|\| fx\.ramp \|\| fx\.remap/.test(read("ext", "timelinedock", "karaokegen.js")) && /delete o\.fx\.remap;/.test(read("static", "tlai.js")));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlremap.js right after clipfx.js", EXT.indexOf("tlremap.js") === EXT.indexOf("clipfx.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
