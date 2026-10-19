#!/usr/bin/env node
/* bitGen Studio — 2.416.0 LIVE: the bigger Premiere rows (part one) answered by the REAL app (H3_URL, default :8311)
 * with the REAL ffmpeg, then measured:
 *   1. a MASK on a clip's grade (dark inside the ellipse only; inverted = only outside), a TRACKED mask (the dark spot
 *      moves), a mask on an ADJUSTMENT layer (half the frame)
 *   2. 🎯 POST /api/clipfx/track on a moving ball
 *   3. 🎥 POST /api/multicam/sync on two recordings of one moment, then the multi-camera PROGRAM compiled (red angle,
 *      then blue, the chosen angle's sound under both)
 *   4. 🪶 a 2560×1440 clip found heavy, its proxy made (VP9, 960 wide) and served
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem11_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem11_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function gray(f, t, w, h) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", `scale=${w}:${h}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 22 }); }
function rgb(f, t) { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "scale=16:9:flags=area,format=rgb24", "-f", "rawvideo", "-"]); let r = 0, g = 0, bl = 0; for (let i = 0; i < b.length; i += 3) { r += b[i]; g += b[i + 1]; bl += b[i + 2]; } const n = b.length / 3; return [r / n, g / n, bl / n].map(Math.round); }
function rms(f, a, b) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(a), "-t", String(b - a), "-i", f, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 64 << 20 });
  let s = 0, n = 0; for (let i = 0; i + 1 < buf.length; i += 2) { const v = buf.readInt16LE(i) / 32768; s += v * v; n++; } return Math.sqrt(s / Math.max(1, n));
}
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  let st = "";
  for (let i = 0; i < 400; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = api("/api/jobs/" + j.id + "?log_from=0");
  const log = [].concat(g.log || []).join("\n"), out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", st === "done" && out && fs.existsSync(out), { st, log: log.slice(-1200) });
  if (st !== "done") return null;
  const keep = path.join(TMP, "out" + (nb++) + ".mp4"); fs.copyFileSync(out, keep);
  return { file: keep, log };
}
const base = (video, more) => Object.assign({ video, video_layers: [], audio: [], images: [], keep_original_audio: true }, more || {});
const V = (name, more) => Object.assign({ name, src: "video", in: 0, out: null, dur: 3, start: 0, opacity: 1 }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=0xb0b0b0:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=300:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "flat.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=25:d=4", "-f", "lavfi", "-i", "color=c=0xffd040:s=80x80:r=25:d=4", "-filter_complex",
      "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-40,Y-40),38),255,0)'[o];[0:v]eq=brightness=-0.2[b];[b][o]overlay=x='100+t*100':y='140+40*sin(t*2)'",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "ball.mp4")]);
  ff(["-f", "lavfi", "-i", "anoisesrc=d=12:c=pink:r=48000:a=0.3", "-af", "volume='0.3+0.7*abs(sin(t*3))*gt(sin(t*1.7),0)':eval=frame", path.join(TMP, "ev.wav")]);
  ff(["-f", "lavfi", "-i", "color=red:s=320x180:r=25:d=8", "-ss", "1.5", "-t", "8", "-i", path.join(TMP, "ev.wav"), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(TMP, "camA.mp4")]);
  ff(["-f", "lavfi", "-i", "color=blue:s=320x180:r=25:d=8", "-ss", "3.25", "-t", "8", "-i", path.join(TMP, "ev.wav"), "-af", "volume=0.3,highpass=f=300", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(TMP, "camB.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=s=2560x1440:r=25:d=2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", path.join(TMP, "big.mp4")]);
  for (const f of ["flat.mp4", "ball.mp4", "camA.mp4", "camB.mp4", "big.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);

  /* ---- 1. masks */
  const dark = { grade: { exposure: -3 } };
  const ell = { shape: "ellipse", x: 0.5, y: 0.5, w: 0.4, h: 0.4, rot: 0, feather: 0 };
  const m1 = await compile(base([V("flat.mp4", { fx: Object.assign({}, dark, { mask: ell }) })]), "a darkened grade inside an ellipse");
  const m2 = await compile(base([V("flat.mp4", { fx: Object.assign({}, dark, { mask: Object.assign({}, ell, { invert: true }) }) })]), "the same mask inverted");
  if (m1 && m2) {
    const a = gray(m1.file, 1, 32, 18), b = gray(m2.file, 1, 32, 18), c = (g) => g[9 * 32 + 16], k = (g) => g[1 * 32 + 1];
    check("MASK in the compile: the grade only inside the ellipse (centre dark, corner as shot); inverted = only outside; the log says it",
      c(a) < 90 && k(a) > 150 && c(b) > 150 && k(b) < 90 && /the look inside an ellipse/.test(m1.log) && /the look outside an ellipse/.test(m2.log), { a: [c(a), k(a)], b: [c(b), k(b)] });
  }
  const m3 = await compile(base([V("flat.mp4", { fx: Object.assign({}, dark, { mask: Object.assign({}, ell, { w: 0.2, h: 0.3, track: [{ at: 0, x: 0.2, y: 0.5 }, { at: 2, x: 0.8, y: 0.5 }] }) }) })]), "a TRACKED mask");
  if (m3) {
    const a = gray(m3.file, 0.5, 32, 18), b = gray(m3.file, 1.5, 32, 18), at = (g, fx) => g[9 * 32 + Math.round(fx * 32 - 0.5)];
    check("...tracked: the dark spot at 35 % across at 0.5 s, at 65 % at 1.5 s (the track followed)", at(a, 0.35) < 90 && at(a, 0.65) > 150 && at(b, 0.65) < 90 && at(b, 0.35) > 150 && /tracked \(2 samples\)/.test(m3.log),
      { a: [at(a, 0.35), at(a, 0.65)], b: [at(b, 0.35), at(b, 0.65)] });
  }
  const ad = api("/api/effects/adjustment", {});
  const m4 = await compile(base([V("flat.mp4")], { images: [{ clips: [{ name: ad.name || "adjustment.png", start: 0, len: 3, opacity: 1, adjust: true, fx: { grade: { exposure: -3 }, mask: { shape: "rect", x: 0.25, y: 0.5, w: 0.5, h: 1.2, feather: 0 } } }] }] }), "an adjustment layer with a mask");
  if (m4) {
    const a = gray(m4.file, 1, 32, 18);
    check("...an ADJUSTMENT layer's mask: everything under it darkened in the left half only", a[9 * 32 + 6] < 90 && a[9 * 32 + 26] > 150 && /adjustment layer .*the look inside a box/.test(m4.log), { l: a[9 * 32 + 6], r: a[9 * 32 + 26] });
  }

  /* ---- 2. tracking */
  const tk = api("/api/clipfx/track", { name: "ball.mp4", from: 0.5, to: 3, x: 190 / 640, y: (180 + 40 * Math.sin(1)) / 360, w: 0.07, h: 0.12 });
  const err = tk.ok ? Math.max(...tk.track.map((p) => Math.hypot(p.x * 640 - (140 + p.t * 100), p.y * 360 - (180 + 40 * Math.sin(p.t * 2))))) : 999;
  check("🎯 POST /api/clipfx/track: 25 samples a ball's path within 20 px of 640, no gaps", tk.ok && tk.track.length >= 24 && err < 20 && !tk.gaps.length, { err, n: tk.track && tk.track.length, e: tk.error });
  const tb = api("/api/clipfx/track", { name: "ball.mp4", from: 3, to: 3 });
  check("...nothing to track (from = to): refused in words", tb.ok === false && /nothing to track/.test(tb.error || ""), tb);

  /* ---- 3. multi-camera */
  const sy = api("/api/multicam/sync", { names: ["camA.mp4", "camB.mp4"] });
  check("🎥 POST /api/multicam/sync: camB is the same moment 1.75 s after camA, a clear match", sy.ok && sy.results[0].name === "camB.mp4" && Math.abs(sy.results[0].lag - 1.75) < 0.01 && sy.results[0].ok, sy);
  const one = api("/api/multicam/sync", { names: ["camA.mp4"] });
  check("...one angle: refused in words", one.ok === false && /at least two/.test(one.error || ""), one);
  if (sy.ok) {
    const MC = require(path.join(ROOT, "static", "multicam.js"));
    const fsy = MC.fromSync([{ name: "camA.mp4", src: "video", start: 0, in: 0, dur: 8 }, { name: "camB.mp4", src: "video", start: 0, in: 0, dur: 8 }], sy.results);
    const mc = { angles: fsy.angles, sound: 0, cuts: [{ t: 0, a: 0 }] };
    mc.cuts = MC.switchAt(mc, 4, 1);
    const prog = MC.program(mc, 25), sc = MC.soundClip(mc);
    const pv = prog.map((c) => ({ name: c.name, src: c.src, in: c.in, out: c.out, dur: c.dur, start: c.start, opacity: 1, soundOut: true }));
    const out = await compile({ video: pv, video_layers: [], images: [], keep_original_audio: true,
      audio: [{ clips: [{ name: sc.name, src: "video", start: sc.start, in: 0, out: sc.out, dur: sc.dur, volume: 1, role: "voice" }] }] }, "the multi-camera program");
    if (out) {
      const a = rgb(out.file, 2), b = rgb(out.file, 6);
      check("...the program: angle 1 (red) until the cut at 4 s, then angle 2 (blue); the sound angle's sound under both", a[0] > 150 && a[2] < 80 && b[2] > 150 && b[0] < 80 && rms(out.file, 1, 3.5) > 0.01 && rms(out.file, 4.5, 7) > 0.01, { a, b });
    }
  }

  /* ---- 4. proxies */
  const inf = api("/api/proxy/info", { names: ["big.mp4", "flat.mp4"] });
  check("🪶 POST /api/proxy/info: the 2560×1440 clip heavy (its size said), the small one not", inf.ok && inf.info["big.mp4"].heavy && /2560×1440/.test(inf.info["big.mp4"].why) && !inf.info["flat.mp4"].heavy, inf);
  let w = api("/api/proxy/want", { name: "big.mp4" });
  const first = w.state;
  for (let i = 0; i < 120 && w.state === "working"; i++) { await sleep(1000); w = api("/api/proxy/want", { name: "big.mp4" }); }
  const code = w.url ? curl(["-o", path.join(TMP, "px.webm"), "-w", "%{http_code}", URL_ + w.url]) : "";
  const pr = code === "200" ? JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height:format=duration", "-of", "json", path.join(TMP, "px.webm")], { encoding: "utf8" })) : {};
  check("...POST /api/proxy/want: working, then ready; the proxy VP9 960×540, the same length", first === "working" && w.state === "ready" && code === "200" && pr.streams[0].codec_name === "vp9" && pr.streams[0].width === 960 && pr.streams[0].height === 540
    && Math.abs(+pr.format.duration - 2) < 0.1, { first, w, code, pr });

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
