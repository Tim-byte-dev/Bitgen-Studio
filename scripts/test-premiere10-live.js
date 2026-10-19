#!/usr/bin/env node
/* bitGen Studio — 2.415.0 LIVE: the medium Premiere jobs (part two) answered by the REAL app (H3_URL, default :8311)
 * with the REAL ffmpeg, then measured:
 *   1. 🎚 PAN + FADERS + MASTER in the compile: V1 panned hard left (the right channel silent), a sound layer panned
 *      right 50 % (the left at half), a fader at +6 dB (twice the level), the master at -6 dB (half)
 *   2. DISTORT compiled: a mirrored clip's right half = its left half flipped
 *   3. a LAYER's entry drawn as its SHAPE: a white layer wiping in over black - a quarter way through, the right side
 *      white and the left still black
 *   4. 🎯 COLOUR MATCH through the route, then compiled: the warm clip's movie frame lands on the cool clip's colour
 * Tim: "lets do the medium jobs now". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem10_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem10_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** RMS of each channel between a and b seconds */
function rms(f, a, b) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(a), "-t", String(b - a), "-i", f, "-vn", "-ac", "2", "-ar", "48000", "-f", "s16le", "-"], { maxBuffer: 64 << 20 });
  let l = 0, r = 0, n = 0;
  for (let i = 0; i + 3 < buf.length; i += 4) { const L = buf.readInt16LE(i) / 32768, R = buf.readInt16LE(i + 2) / 32768; l += L * L; r += R * R; n++; }
  return [Math.sqrt(l / n), Math.sqrt(r / n)];
}
function frame(f, t, w, h) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", `format=rgb24,scale=${w}:${h}:flags=area,format=rgb24`, "-f", "rawvideo", "-"], { maxBuffer: 16 << 20 }); }
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
const V = (name, more) => Object.assign({ name, src: "video", in: 0, out: null, dur: 3, start: 0, opacity: 1 }, more || {});
const base = (video, more) => Object.assign({ video, video_layers: [], audio: [], images: [], keep_original_audio: true }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=0x404040:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-af", "volume=0.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", path.join(TMP, "tone.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=black:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", "3", path.join(TMP, "black.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=white:s=320x180:r=25:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "white.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=3", "-vf", "format=rgb24,geq=r='X*0.7':g='Y*1.3':b='128+60*sin(X/15)'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "6", path.join(TMP, "pattern.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=2", "-vf", "format=rgb24,geq=r='30+X/2':g='40+Y':b='120+X/4'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", path.join(TMP, "cool.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=2", "-vf", "format=rgb24,geq=r='90+X/3':g='30+Y/2':b='20+X/5'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", path.join(TMP, "warm.mp4")]);
  fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
  ff(["-f", "lavfi", "-i", "sine=frequency=660:duration=3", "-af", "volume=0.25", "-ac", "2", path.join(pdir, "sound", "t660.wav")]);
  for (const f of ["tone.mp4", "black.mp4", "white.mp4", "pattern.mp4", "cool.mp4", "warm.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);

  /* ---- 1. pan / faders / master */
  const c0 = await compile(base([V("tone.mp4")]), "V1 tone, centred");
  const c1 = await compile(base([V("tone.mp4")], { video_pan: -1 }), "V1 tone panned hard left");
  if (c0 && c1) {
    const a = rms(c0.file, 0.5, 2.5), b = rms(c1.file, 0.5, 2.5);
    check("🎚 V1 panned hard left: the left as it was, the right silent (the balance law)", Math.abs(b[0] - a[0]) / a[0] < 0.1 && b[1] < a[1] * 0.02 && /mixer: 1 track\(s\) panned/.test(c1.log), { centred: a, left: b });
  }
  const snd = (vol, pan, more) => base([V("black.mp4")], Object.assign({ keep_original_audio: true, audio: [{ clips: [{ name: "t660.wav", start: 0, in: 0, out: 3, dur: 3, volume: vol, pan, role: "music" }] }] }, more || {}));
  const s0 = await compile(snd(1, 0), "a sound layer, 0 dB, centred");
  const s1 = await compile(snd(1, 0.5), "the sound layer panned right 50 %");
  const s2 = await compile(snd(2, 0), "the sound layer's fader at +6 dB");
  const s3 = await compile(snd(1, 0, { master: { volume: 0.5 } }), "the master at -6 dB");
  if (s0 && s1 && s2 && s3) {
    const a = rms(s0.file, 0.5, 2.5), b = rms(s1.file, 0.5, 2.5), c = rms(s2.file, 0.5, 2.5), d = rms(s3.file, 0.5, 2.5);
    check("...panned right 50 %: the left at half, the right as it was", Math.abs(b[0] / a[0] - 0.5) < 0.06 && Math.abs(b[1] / a[1] - 1) < 0.06, { a, b });
    check("...the fader at +6 dB (2): twice the level (the route no longer caps it at 0 dB)", Math.abs(c[0] / a[0] - 2) < 0.15 && Math.abs(c[1] / a[1] - 2) < 0.15, { a, c });
    check("...the master at -6 dB (0.5): half the level, said in the log", Math.abs(d[0] / a[0] - 0.5) < 0.06 && /mixer: master -6\.0 dB/.test(s3.log), { a, d });
  }

  /* ---- 2. distort */
  const d1 = await compile(base([V("pattern.mp4", { fx: { vfx: { mirror: "h" } } })]), "a mirrored clip");
  if (d1) {
    const f = frame(d1.file, 1.5, 64, 36);
    let worst = 0;
    for (let y = 2; y < 34; y += 3) for (let x = 2; x < 30; x += 3) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(f[(y * 64 + x) * 3 + c] - f[(y * 64 + (63 - x)) * 3 + c]));
    check("DISTORT mirror compiled: the right half = the left half flipped (the log says it)", worst < 14 && /mirrored left to right/.test(d1.log), { worst, log: d1.log.slice(-400) });
  }

  /* ---- 3. a layer's entry as its shape */
  const t1 = await compile(base([V("black.mp4")], { video_layers: [{ name: "V2", muted: false, volume: 1, opacity: 1, transition_in: { type: "wipeleft", dur: 1 }, transition_out: { type: "none", dur: 0.5 },
    clips: [{ name: "white.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0.5, opacity: 1 }] }] }), "a white layer wiping in over black");
  if (t1) {
    const f = frame(t1.file, 0.75, 64, 36), lum = (x) => f[(18 * 64 + x) * 3 + 1];
    const g = frame(t1.file, 2.0, 64, 36);
    check("TRANSITIONS: a quarter way into the layer's wipe the right side is white, the left still the black under it; then all white (the log names the shape)",
      lum(60) > 200 && lum(6) < 40 && g[(18 * 64 + 6) * 3] > 200 && /layer boundary drawn as its shape: wipeleft/.test(t1.log), { right: lum(60), left: lum(6), later: g[(18 * 64 + 6) * 3], log: t1.log.slice(-500) });
  }

  /* ---- 4. colour match */
  const cm = api("/api/clipfx/colourmatch", { clip: { name: "warm.mp4", at: 1 }, ref: { name: "cool.mp4", at: 1 }, strength: 100 });
  check("🎯 POST /api/clipfx/colourmatch: R / G / B curves, the warm clip's mean as matched near the cool one's", cm.ok && cm.curves && cm.curves.r && cm.curves.g && cm.curves.b && Math.max(...cm.after.map((v, i) => Math.abs(v - cm.target[i]))) <= 5, cm);
  const bad = api("/api/clipfx/colourmatch", { clip: { name: "nope.mp4", at: 1 }, ref: { name: "cool.mp4", at: 1 } });
  check("...a clip not in the project: refused in words", bad.ok === false && /not in this project/.test(bad.error || ""), bad);
  if (cm.ok) {
    const m1 = await compile(base([V("warm.mp4", { dur: 2, fx: { grade: { curves: cm.curves } } })]), "the matched clip");
    if (m1) {
      const f = frame(m1.file, 1, 32, 18); const mean = [0, 1, 2].map((c) => { let s = 0; for (let i = c; i < f.length; i += 3) s += f[i]; return s / (f.length / 3); });
      check("...compiled: the matched clip's movie frame has the cool clip's colour (within 7 levels a channel)", mean.every((v, i) => Math.abs(v - cm.target[i]) <= 7), { mean, target: cm.target });
    }
  }

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
