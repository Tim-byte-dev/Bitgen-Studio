#!/usr/bin/env node
/* bitGen Studio — 2.420.0 LIVE: 🤖 AI inside the timeline against the REAL app (H3_URL, default :8311): a clip's frame
 * at a moment (and past its end: its last frame), a finished render probed into a clip, the beats of a song on the
 * timeline (cached), and a render through /api/generate the way the 🤖 dialog sends it (fl2va from a frame).
 * Tim: "yes, please add your 2 suggestions" (AI inside the timeline). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_tlai_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "tlai_"));
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
  return { file: keep, master: out, log };
}
const base = (video, more) => Object.assign({ video, video_layers: [], audio: [], images: [], keep_original_audio: true }, more || {});
const V = (name, more) => Object.assign({ name, src: "video", in: 0, out: null, dur: 3, start: 0, opacity: 1 }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=red:s=320x180:r=24:d=2", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=24:d=2", "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "rb.mp4")]);
  ff(["-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*880*t)*exp(-40*mod(t,0.5))':s=44100:d=8", "-ac", "2", path.join(TMP, "song.wav")]);
  for (const f of ["rb.mp4", "song.wav"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);
  const px = (f) => { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-frames:v", "1", "-vf", "scale=1:1,format=rgb24", "-f", "rawvideo", "-"]); return [b[0], b[1], b[2]]; };
  const fr = api("/api/tlai/frame", { name: "rb.mp4", t: 0.5 });
  const c1 = fr.url ? curl(["-o", path.join(TMP, "f1.png"), "-w", "%{http_code}", URL_ + fr.url]) : "";
  const fr2 = api("/api/tlai/frame", { name: "rb.mp4", t: 3.9 }), fr3 = api("/api/tlai/frame", { name: "rb.mp4", t: 99 });
  if (fr2.url) curl(["-o", path.join(TMP, "f2.png"), URL_ + fr2.url]);
  if (fr3.url) curl(["-o", path.join(TMP, "f3.png"), URL_ + fr3.url]);
  const a = c1 === "200" ? px(path.join(TMP, "f1.png")) : [], b = fr2.url ? px(path.join(TMP, "f2.png")) : [], c = fr3.url ? px(path.join(TMP, "f3.png")) : [];
  check("POST /api/tlai/frame: the picture at 0.5 s (red), at 3.9 s (blue) and past the end (its last frame - blue) as PNGs",
    c1 === "200" && a[0] > 180 && a[2] < 80 && b[2] > 180 && b[0] < 80 && c[2] > 180, { fr, a, b, c, fr3 });
  check("...a frame of a file not in the project = 404; a file name outside temp/tlai = 404", /not in this project/.test(api("/api/tlai/frame", { name: "nope.mp4", t: 0 }).error || "")
    && /no such frame/.test(api("/api/tlai/frame/..%2Fpackage.json").error || ""));
  const pr = api("/api/tlai/probe", { name: "rb.mp4" });
  check("POST /api/tlai/probe: a file as a clip (its folder, length, size)", pr.ok && pr.name === "rb.mp4" && pr.src === "video" && Math.abs(pr.dur - 4) < 0.1 && pr.w === 320 && pr.h === 180, pr);
  const bt = api("/api/tlai/beats", { name: "song.wav", start: 0, dur: 8 }), bt2 = api("/api/tlai/beats", { name: "song.wav", start: 0, dur: 8 });
  check("POST /api/tlai/beats: the song's 120 BPM, its beats every 0.5 s; asked again = cached", bt.ok && Math.abs(bt.tempo - 120) < 1.5 && bt.beats.length >= 12 && !bt.cached && bt2.cached === true, { t: bt.tempo, n: bt.beats && bt.beats.length, c: bt2.cached });
  // a render the way the dialog sends it: fl2va with the frame as its first picture, the prompt + the negative
  const gj = JSON.parse(curl(["-X", "POST", "-F", "mode=fl2va", "-F", "prompt=a red room turns blue", "-F", "negative=blurry", "-F", "width=320", "-F", "height=192", "-F", "frames=49", "-F", "seed=-1", "-F", "format=mp4",
    "-F", "references=@" + path.join(TMP, "f1.png") + ";type=image/png", URL_ + "/api/generate"]) || "{}");
  let st = "";
  for (let i = 0; i < 120 && gj.id; i++) { const g = api("/api/jobs/" + gj.id); st = g.status; if (st !== "running" && st !== "queued") break; await sleep(1000); }
  const g = gj.id ? api("/api/jobs/" + gj.id) : {};
  const outN = String((g.outputs && g.outputs[0]) || g.output || "").split(/[\\/]/).pop();
  const pr2 = outN ? api("/api/tlai/probe", { name: outN }) : {};
  check("a 🤖 render (fl2va from the frame, the negative with it) finishes and probes into a clip (its folder, ~2 s)", st === "done" && pr2.ok && ["output", "video"].includes(pr2.src) && pr2.dur > 1.5 && g.params && g.params.negative_prompt === "blurry",
    { st, outN, pr2, neg: g.params && g.params.negative_prompt, e: gj.error });

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
