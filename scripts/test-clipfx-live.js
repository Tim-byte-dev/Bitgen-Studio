#!/usr/bin/env node
/* bitGen Studio — 2.406.0: the timeline clip fx, the mix and the captions COMPILED by the REAL app (H3_URL, default
 * :8311) with the REAL ffmpeg, then measured.
 * Tim: "lets start closing the gap and go with your suggestions as you see fit" (speed ramps / reverse, a colour grade
 * with LUTs, caption tracks from the transcript, audio clean-up + ducking + loudness).
 *   1. speed 200 % -> half as long; reversed -> the picture runs backwards (it gets darker); a ramp -> exactly the
 *      length static/clipfx.js gives (the preview's maths)
 *   2. an identity LUT changes nothing (the colour path is clean); +1 stop of exposure is brighter; a look is applied
 *   3. the mix: the music ducks under the voice (quieter while V1 speaks than after), the loudness lands on -14 LUFS
 *   4. sound clean-up on a sound clip is rendered; 🎧 preview = before + gap + after
 *   5. captions burned into the picture where the cue is (and not after it) + a .srt beside the movie
 *   6. refusals in words: a retimed clip without its length, a missing LUT, a bad .cube
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_clipfx_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "clipfx_"));
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let nb = 0;
const bodyArg = (body) => { const f = path.join(TMP, "body" + (nb++) + ".json"); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };   // a LUT is too big for argv
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: ["ignore", "pipe", "pipe"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function dur(f) { return +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim(); }
function mean(f, t, crop) {
  const vf = (crop ? "crop=" + crop + "," : "") + "format=gray";
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", vf, "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
  let s = 0; for (const b of buf) s += b; return s / Math.max(1, buf.length);
}
function rgbMean(f, t) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
  const m = [0, 0, 0]; for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i]; return m.map((v) => v / (buf.length / 3));
}
function rmsDb(f, a, b, band) {
  const r = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-ss", String(a), "-t", String(b - a), "-i", f, "-af",
    (band ? "bandpass=f=" + band + ":w=40," : "") + "astats", "-f", "null", "-"], { encoding: "utf8" });
  const m = /Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/.exec(r.stderr || "");
  return m ? (m[1] === "-inf" ? -120 : +m[1]) : NaN;
}
function lufs(f) {
  const r = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+)\s*LUFS/.exec(r.stderr || "");
  return m ? +m[1] : NaN;
}
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  let st = "";
  for (let i = 0; i < 240; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = api("/api/jobs/" + j.id + "?log_from=0");
  const log = String(g.log || "");
  const out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", st === "done" && out && fs.existsSync(out), { st, out, log: log.slice(-900) });
  if (st !== "done") return null;
  // the compile is always <project>.mp4 - keep each one (and its .srt) under its own name
  const keep = path.join(TMP, "out" + (nb++) + ".mp4");
  fs.copyFileSync(out, keep);
  const srt = out.replace(/\.[^.]+$/, ".srt");
  if (fs.existsSync(srt)) { fs.copyFileSync(srt, keep.replace(/\.mp4$/, ".srt")); fs.unlinkSync(srt); }
  return { file: keep, log };
}
const V = (fx, extra) => Object.assign({ name: "fxbase.mp4", src: "video", in: 0, out: null, dur: 4, start: 0, opacity: 1, fx }, extra || {});
const base = (v, more) => Object.assign({ video: [v], video_layers: [], audio: [[]], images: [[]], keep_original_audio: true }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  // 4 s, 30 fps, a picture that gets BRIGHTER every frame (Y = 20 + 50 t) + a "voice" (440 Hz) for the first 2 s
  const bf = path.join(TMP, "fxbase.mp4");
  ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=30:d=4,geq=lum='20+50*T':cb=128:cr=128",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4,volume=enable='gt(t,2)':volume=0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", bf]);
  // a colourful still clip (for the colour checks)
  const cf = path.join(TMP, "fxcolor.mp4");
  ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", cf]);
  // music: 220 Hz for 4 s
  const mf = path.join(TMP, "fxmusic.wav");
  ff(["-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=4", "-ac", "2", mf]);
  for (const f of [bf, cf]) curl(["-X", "POST", "-F", "file=@" + f, URL_ + "/api/passets"]);
  fs.mkdirSync(path.join(ROOT, "projects", P, "sound"), { recursive: true });
  fs.copyFileSync(mf, path.join(ROOT, "projects", P, "sound", "fxmusic.wav"));

  /* ---- 1. time */
  const plain = await compile(base(V(null)), "plain");
  if (plain) check("plain: 4 s, brightening", Math.abs(dur(plain.file) - 4) < 0.15 && mean(plain.file, 3.5) > mean(plain.file, 0.3) + 60, [dur(plain.file), mean(plain.file, 0.3), mean(plain.file, 3.5)]);
  const fast = await compile(base(V({ speed: 2 })), "speed 200 %");
  if (fast) {
    check("speed 200 %: 2 s long", Math.abs(dur(fast.file) - 2) < 0.12, dur(fast.file));
    check("speed 200 %: frame at 1 s = the source's 2 s", Math.abs(mean(fast.file, 1) - mean(plain.file, 2)) < 6, [mean(fast.file, 1), mean(plain.file, 2)]);
    check("speed 200 %: the worker says it", /fx fxbase\.mp4: speed 2x/.test(fast.log), fast.log.slice(-600));
  }
  const rev = await compile(base(V({ reverse: true })), "reverse");
  if (rev) {
    check("reverse: 4 s, darkening (starts where the source ends)", Math.abs(dur(rev.file) - 4) < 0.15 && mean(rev.file, 0.2) > mean(rev.file, 3.6) + 60, [mean(rev.file, 0.2), mean(rev.file, 3.6)]);
  }
  const rampFx = FX.normalize({ ramp: FX.RAMPS["slow → fast"] });
  const want = FX.timelineLen(4, rampFx);
  const ramp = await compile(base(V(rampFx)), "ramp slow → fast");
  if (ramp) {
    check("ramp: the length static/clipfx.js gives (" + want.toFixed(2) + " s)", Math.abs(dur(ramp.file) - want) < 0.15, dur(ramp.file));
    const c = { in: 0, out: 4, fx: rampFx };
    const t1 = want * 0.25, t2 = want * 0.8;
    const s1 = FX.srcTime(c, t1), s2 = FX.srcTime(c, t2);   // the source's own frame at those seconds (the plain compile)
    check("ramp: the frames are where the preview puts them", Math.abs(mean(ramp.file, t1) - mean(plain.file, s1)) < 6
      && Math.abs(mean(ramp.file, t2) - mean(plain.file, s2)) < 6, [mean(ramp.file, t1), mean(plain.file, s1), mean(ramp.file, t2), mean(plain.file, s2)]);
  }
  const rr = await compile(base(V({ speed: 0.5, reverse: true, blend: "blend" }), { keep_original_audio: true }), "half speed reversed + frame blend");
  if (rr) check("half speed reversed: 8 s, darkening", Math.abs(dur(rr.file) - 8) < 0.2 && mean(rr.file, 0.3) > mean(rr.file, 7.6) + 60, [dur(rr.file), mean(rr.file, 0.3), mean(rr.file, 7.6)]);

  /* ---- 2. colour */
  const C = (fx) => ({ name: "fxcolor.mp4", src: "video", in: 0, out: null, dur: 2, start: 0, opacity: 1, fx });
  const ident = FX.toCube(FX.buildLut({}, null, 33), 33, "identity");
  const lf = path.join(TMP, "ident.cube"); fs.writeFileSync(lf, ident);
  const sv = JSON.parse(curl(["-X", "POST", "-H", "Content-Type: text/plain", "--data-binary", "@" + lf, URL_ + "/api/luts?name=identity%20test"]) || "{}");
  check("＋ LUT: saved into the project as identity test.cube (33³)", sv.ok && sv.name === "identity test.cube" && sv.size === 33 && fs.existsSync(path.join(ROOT, "projects", P, "luts", "identity test.cube")), sv);
  const lst = api("/api/luts");
  check("GET /api/luts lists it (project) + the looks + the ramps", (lst.luts || []).some((l) => l.name === "identity test.cube" && l.where === "project") && lst.looks["teal & orange"] && lst.ramps["slow middle"], lst);
  const cp = await compile(base(C(null)), "colour: plain");
  const ci = await compile(base(C({ lut: "identity test.cube" })), "colour: identity LUT");
  if (cp && ci) {
    const a = rgbMean(cp.file, 1), b = rgbMean(ci.file, 1);
    check("identity LUT: the colours unchanged (< 2.5 levels per channel)", a.every((v, i) => Math.abs(v - b[i]) < 2.5), [a, b]);
    check("identity LUT: the worker baked one .cube", /graded \+ LUT identity test\.cube/.test(ci.log) && fs.readdirSync(path.join(ROOT, "projects", P, "temp", "grades")).some((f) => /\.cube$/.test(f)), ci.log.slice(-500));
  }
  const ce = await compile(base(V({ grade: { exposure: 1 } })), "colour: +1 stop");
  if (plain && ce) check("+1 stop: brighter (the grey clip)", mean(ce.file, 1) > mean(plain.file, 1) + 15, [mean(plain.file, 1), mean(ce.file, 1)]);
  const cm = await compile(base(C({ grade: FX.LOOKS.mono, look: "mono" })), "colour: the mono look");
  if (cm) { const m = rgbMean(cm.file, 1); check("mono look: grey (the channels within 3 levels)", Math.abs(m[0] - m[1]) < 3 && Math.abs(m[1] - m[2]) < 3, m); }
  const cw = await compile(base(C({ grade: { temperature: 80 } })), "colour: warm");
  if (cp && cw) { const a = rgbMean(cp.file, 1), b = rgbMean(cw.file, 1); check("temperature +80: redder, less blue", b[0] - b[2] > a[0] - a[2] + 10, [a, b]); }

  /* ---- 3. the mix */
  const mixBody = (mix) => base(V(null), {
    video_role: "voice", mix,
    audio: [{ clips: [{ name: "fxmusic.wav", start: 0, in: 0, out: null, dur: 4, volume: 1, role: "music" }] }] });
  const nd = await compile(mixBody(null), "mix: no ducking");
  const dk = await compile(mixBody({ duck: { on: true, amount: 18 } }), "mix: ducking 18 dB");
  if (nd && dk) {
    const dIn = rmsDb(dk.file, 0.4, 1.8, 220), dOut = rmsDb(dk.file, 2.6, 3.8, 220), nIn = rmsDb(nd.file, 0.4, 1.8, 220);
    check("ducking: the music is quieter while V1 speaks than after it (> 6 dB)", dOut - dIn > 6, { dIn, dOut });
    check("ducking: and quieter than with no ducking (> 6 dB)", nIn - dIn > 6, { nIn, dIn });
    check("ducking: the worker says it", /the music \(1\) ducks about 18 dB under the voices \(1\)/.test(dk.log), dk.log.slice(-600));
  }
  const ld = await compile(mixBody({ loudness: { on: true, target: -14 } }), "mix: loudness -14");
  if (ld) check("loudness: -14 LUFS (± 1.5)", Math.abs(lufs(ld.file) + 14) < 1.5, lufs(ld.file));
  const ld2 = await compile(mixBody({ loudness: { on: true, target: -23 } }), "mix: loudness -23");
  if (ld2) check("loudness: -23 LUFS (± 1.5)", Math.abs(lufs(ld2.file) + 23) < 1.5, lufs(ld2.file));

  /* ---- 4. sound clean-up */
  const af = await compile(base(V(null), { audio: [{ clips: [{ name: "fxmusic.wav", start: 0, in: 0, out: null, dur: 4, volume: 1, fx: { afx: { voice: true, denoise: 0.5, gain: -6 } } }] }] }), "sound clean-up");
  if (af) {
    check("sound clean-up: rendered (voice, denoise, gain)", /fx fxmusic\.wav: sound voice, denoise, gain/.test(af.log), af.log.slice(-600));
    check("sound clean-up: the movie keeps its 4 s", Math.abs(dur(af.file) - 4) < 0.15, dur(af.file));
  }
  const pv = path.join(TMP, "pv.wav");
  curl(["-o", pv, "-X", "POST", "-H", "Content-Type: application/json", "--data-binary", JSON.stringify({ name: "fxmusic.wav", at: 0.5, secs: 2, afx: { gain: -12 } }), URL_ + "/api/clipfx/afx-preview"]);
  let pvd = 0; try { pvd = dur(pv); } catch { pvd = 0; }
  check("🎧 preview: 2 s before + 0.4 s gap + 2 s after", Math.abs(pvd - 4.4) < 0.1, pvd);
  if (pvd) check("🎧 preview: the after half is the quieter one (-12 dB)", rmsDb(pv, 0.2, 1.8) - rmsDb(pv, 2.6, 4.2) > 9, [rmsDb(pv, 0.2, 1.8), rmsDb(pv, 2.6, 4.2)]);

  /* ---- 5. captions */
  const caps = { cues: [{ start: 0.3, end: 1.6, text: "HELLO CAPTIONS" }, { start: 1.6, end: 1.2, text: "bad times dropped" }],
                 style: { size: 12, box: true, box_color: "#ff0000", box_opacity: 1, position: "bottom" }, burn: true, srt: true };
  const cc = await compile(base(C(null), { captions: caps }), "captions");
  if (cc && cp) {
    const crop = "320:50:0:130";
    check("captions: burned in while the cue is up (a red box at the bottom)", rgbMeanCrop(cc.file, 1, crop)[0] - rgbMeanCrop(cp.file, 1, crop)[0] > 40, [rgbMeanCrop(cc.file, 1, crop), rgbMeanCrop(cp.file, 1, crop)]);
    check("captions: gone after it", Math.abs(rgbMeanCrop(cc.file, 1.8, crop)[0] - rgbMeanCrop(cp.file, 1.8, crop)[0]) < 4, [rgbMeanCrop(cc.file, 1.8, crop), rgbMeanCrop(cp.file, 1.8, crop)]);
    const srt = cc.file.replace(/\.[^.]+$/, ".srt");
    const st = fs.existsSync(srt) ? fs.readFileSync(srt, "utf8") : "";
    check("captions: a .srt beside the movie (the bad cue dropped)", /^1\n00:00:00,300 --> 00:00:01,600\nHELLO CAPTIONS\n/.test(st) && !/bad times/.test(st), st);
  }
  const srtOnly = await compile(base(C(null), { captions: Object.assign({}, caps, { burn: false }) }), "captions: .srt only");
  if (srtOnly && cp) {
    check("captions .srt only: the picture untouched", Math.abs(rgbMeanCrop(srtOnly.file, 1, "320:50:0:130")[0] - rgbMeanCrop(cp.file, 1, "320:50:0:130")[0]) < 4);
    check("captions .srt only: the .srt is there", fs.existsSync(srtOnly.file.replace(/\.[^.]+$/, ".srt")));
  }

  /* ---- 6. refusals */
  const e1 = api("/api/export", base({ name: "fxbase.mp4", src: "video", in: 0, out: null, start: 0, fx: { speed: 2 } }));
  check("a retimed clip with no length: refused in words", /needs its length/.test(e1.error || ""), e1);
  const e2 = api("/api/export", base(C({ lut: "nope.cube" })));
  check("a missing LUT: refused in words", /no LUT called nope\.cube/.test(e2.error || ""), e2);
  check("a bad .cube: refused (400)", +curl(["-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "-H", "Content-Type: text/plain", "--data-binary", "TITLE x\n0 0 0\n", URL_ + "/api/luts?name=bad.cube"]) === 400);
  const one = JSON.parse(curl(["-X", "POST", "-H", "Content-Type: text/plain", "--data-binary", "LUT_1D_SIZE 2\n0 0 0\n1 1 1\n", URL_ + "/api/luts?name=oned.cube"]) || "{}");
  check("a 1D LUT: refused in words", /1D LUT/.test(one.error || ""), one);

  function rgbMeanCrop(f, t, crop) {
    const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "crop=" + crop + ",format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
    const m = [0, 0, 0]; for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i]; return m.map((v) => v / (buf.length / 3));
  }
})().catch((e) => { fail++; console.log("FAIL: crashed " + (e.stack || e)); }).finally(() => {
  try { api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
