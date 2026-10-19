#!/usr/bin/env node
/* bitGen Studio — 2.413.0 LIVE: the partly-done Premiere items, answered by the REAL app (H3_URL, default :8311) with
 * the REAL ffmpeg, then measured:
 *   1. 📤 fit "follow": a 9:16 version that keeps the moving subject in frame (the middle crop loses it)
 *   2. ✨ stabilise in the compile: the shake measured (vidstab) + smoothed - the jitter at least halved
 *   3. the steady preview: POST /api/clipfx/stabilise -> working -> ready, the file served (VP9, 640 wide)
 *   4. a REVERSED clip split in two (Ctrl+K's maths) compiles to the same pictures as the whole clip
 * Tim: "do the smaller jobs and complete the 10 partly done jobs". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem8_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem8_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MK = require(path.join(ROOT, "static", "tlmarks.js"));
function gray(f, t, w, h) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 }); }
function yellow(f, t) {
  const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", f], { encoding: "utf8" })).streams[0];
  const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 256 << 20 });
  let n = 0; for (let i = 0; i < b.length; i += 3) if (b[i] > 200 && b[i + 1] > 170 && b[i + 2] < 120) n++;
  return { n, w: pr.width, h: pr.height };
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
  return { file: keep, master: out, log };
}
const base = (video, more) => Object.assign({ video, video_layers: [], audio: [[]], images: [[]], keep_original_audio: true }, more || {});
const hasVidstab = /vidstabtransform/.test(spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" }).stdout || "");

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=0x203040:s=1280x720:r=25:d=6", "-f", "lavfi", "-i", "color=c=0xffd040:s=160x160:r=25:d=6", "-f", "lavfi", "-i", "sine=frequency=300:duration=6", "-filter_complex",
    "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-80,Y-80),78),255,0)'[o];[0:v][o]overlay=x='100+t*170':y='280+60*sin(t)'", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "ball.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=s=400x260:r=25:d=3", "-f", "lavfi", "-i", "sine=frequency=500:duration=3", "-vf", "crop=320:180:'40+30*sin(t*17)':'40+25*cos(t*23)'",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "shaky.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=frequency=400:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "count.mp4")]);
  for (const f of ["ball.mp4", "shaky.mp4", "count.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);

  /* ---- 1. smart reframe */
  const q = await compile(base([{ name: "ball.mp4", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 }], {
    deliver: [{ preset: "h264", aspect: "9:16", size: "720", fit: "follow" }, { preset: "h264", aspect: "9:16", size: "720", fit: "crop", name: "mid" }] }), "reframe export");
  if (q) {
    // named by lib/deliver (the frame; the second of the same kind gets _2): the queue's order = follow, then the middle
    const st = path.basename(q.master, ".mp4"), hs = fs.readdirSync(pdir).filter((f) => f.startsWith(st + "_h264") && f.endsWith(".mp4")).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const fo = path.join(pdir, hs[0] || "none.mp4"), mid = path.join(pdir, hs[1] || "none.mp4");
    const a = [1, 3, 5].map((t) => yellow(fo, t)), b = [1, 3, 5].map((t) => yellow(mid, t));
    check("📤 follow: 720x1280, the moving subject in frame at 1, 3 and 5 s; the middle crop loses it at 1 and 5 s", a.every((x) => x.n > 3000 && x.w === 720 && x.h === 1280) && b[0].n < 500 && b[2].n < 500, { a, b });
    check("...the log: what was followed", /reframe: following the subject/.test(q.log), q.log.slice(-600));
  }

  /* ---- 2. stabilise in the compile */
  if (!hasVidstab) { skip++; console.log("SKIP: this ffmpeg has no vidstab - the two-pass stabilise was not measured"); }
  else {
    const s2 = await compile(base([{ name: "shaky.mp4", src: "video", in: 0, out: 3, dur: 3, start: 0, opacity: 1, fx: { vfx: { stabilise: { smooth: 70, lock: false } } } }]), "stabilised compile");
    if (s2) {
      const jit = (f) => { let s = 0, n = 0, prev = null; for (let t = 0.2; t < 2.8; t += 0.12) { const g = gray(f, t, 160, 90); if (prev) { let d = 0; for (let y = 30; y < 60; y++) for (let x = 40; x < 120; x++) d += Math.abs(g[y * 160 + x] - prev[y * 160 + x]); s += d / 2400; n++; } prev = g; } return s / n; };
      const before = jit(path.join(TMP, "shaky.mp4")), after = jit(s2.file);
      check("✨ stabilise (vidstab, smoothing 70 %): the shake measured, the frame-to-frame jitter at least halved", /the shake measured \(vidstab\)/.test(s2.log) && /stabilised \(smoothing 70 %\)/.test(s2.log) && after < before / 2, { before, after, log: s2.log.slice(-500) });
    }
    /* ---- 3. the steady preview */
    let j = api("/api/clipfx/stabilise", { name: "shaky.mp4", smooth: 50, lock: false });
    const first = j.state;
    for (let i = 0; i < 120 && j.state === "working"; i++) { await sleep(1000); j = api("/api/clipfx/stabilise", { name: "shaky.mp4", smooth: 50, lock: false }); }
    const code = j.url ? curl(["-o", path.join(TMP, "steady.webm"), "-w", "%{http_code}", URL_ + j.url]) : "";
    const pr = code === "200" ? JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width", "-of", "json", path.join(TMP, "steady.webm")], { encoding: "utf8" })).streams : [];
    check("POST /api/clipfx/stabilise: working, then ready; GET the file: VP9, 640 wide (+ its sound)", first === "working" && j.state === "ready" && code === "200" && pr[0].codec_name === "vp9" && pr[0].width === 640 && pr.length === 2, { first, j, code, pr });
    const bad = api("/api/clipfx/stabilise", { name: "nope.mp4" });
    check("...a clip not in the project: refused in words", !bad.ok && /not in this project/.test(bad.error || ""), bad);
  }

  /* ---- 4. a reversed clip split = the same pictures */
  const whole = { name: "count.mp4", src: "video", in: 0.5, out: 3.5, dur: 4, start: 0, opacity: 1, fx: { reverse: true } };
  const halves = MK.splitClip(whole, 1.2, "v1");
  const w1 = await compile(base([whole]), "a reversed clip"), w2 = await compile(base(halves), "the same reversed clip split at 1.2 s");
  if (w1 && w2) {
    let worst = 0; for (const t of [0.3, 1.0, 1.5, 2.4]) { const a = gray(w1.file, t, 80, 45), b = gray(w2.file, t, 80, 45); let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); worst = Math.max(worst, d / a.length); }
    check("the reversed clip split in two (Ctrl+K - it used to be refused) plays the same pictures as the whole one", halves.length === 2 && halves[1].start === 1.2 && worst < 6, { worst, halves });
  }

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed` + (skip ? `, ${skip} skipped` : ""));
  process.exit(fail ? 1 : 0);
})();
