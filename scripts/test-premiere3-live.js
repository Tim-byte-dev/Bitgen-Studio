#!/usr/bin/env node
/* bitGen Studio — 2.408.0 LIVE against the REAL app (H3_URL, default :8311): the karaoke words (GET / POST
 * /api/karaoke/words; the overlay made with the corrected ones), scene cuts and the transcript route, and a timeline cut
 * by text / split at its shots COMPILED to the right length.
 * Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong. and continue with the
 * premier catchup - do whats most useful next". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
const X = require(path.join(ROOT, "static", "textedit.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem3_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem3_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const api = (u, body) => { const f = body ? path.join(TMP, "b" + (nb++)) : null; if (f) fs.writeFileSync(f, JSON.stringify(body));
  const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(f ? ["--data-binary", "@" + f] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const code = (u, body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body));
  return +curl(["-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@" + f, URL_ + u]); };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
async function job(id) { let st = ""; for (let i = 0; i < 240; i++) { st = api("/api/jobs/" + id).status; if (st === "done" || st === "failed") break; await sleep(1000); } return api("/api/jobs/" + id + "?log_from=0"); }

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);

  /* ---- karaoke words */
  fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
  ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=8", path.join(pdir, "sound", "k3song.wav")]);
  const lyr = "we sing a song of wrong words\nand then we fix them all";
  check("POST /api/karaoke/lyrics", api("/api/karaoke/lyrics", { song: "k3song.wav", text: lyr }).ok === true);
  const w1 = api("/api/karaoke/words?song=k3song.wav");
  check("GET /api/karaoke/words: the timed words the overlay will show + its lyrics text", w1.ok && w1.words.length === 13 && w1.lyrics && !w1.fixed && w1.text === lyr, w1);
  const fixed = w1.words.map((w) => Object.assign({}, w)); fixed[5].text = "right"; fixed[5].start = +(fixed[5].start + 0.1).toFixed(3);
  const sv = api("/api/karaoke/words", { song: "k3song.wav", words: fixed });
  check("POST /api/karaoke/words saves the corrections", sv.ok && sv.words[5].text === "right");
  const w2 = api("/api/karaoke/words?song=k3song.wav");
  check("... GET now answers them (fixed, 'your corrected words')", w2.fixed && w2.how === "your corrected words" && w2.words[5].text === "right" && /right words/.test(w2.text), w2);
  const kj = api("/api/karaoke/song", { song: "k3song.wav", start: 0, dur: 0, width: 640, height: 360 });
  check("the karaoke overlay is made with the corrected words", kj.job && kj.words === 13 && kj.how === "your corrected words", kj);
  if (kj.job) {
    const g = await job(kj.job);
    check("... and renders", g.status === "done" && g.output, { status: g.status, log: String(g.log || "").slice(-400) });
  }
  check("POST /api/karaoke/words for a song not in the project -> 404", code("/api/karaoke/words", { song: "nope.wav", words: [{ text: "a", start: 0, end: 1 }] }) === 404);
  api("/api/karaoke/lyrics", { song: "k3song.wav", text: lyr.replace("song", "tune") });
  const w3 = api("/api/karaoke/words?song=k3song.wav");
  check("new lyrics -> the corrections give way to them", !w3.fixed && w3.words[3].text === "tune" && w3.words[5].text === "wrong", w3.words && w3.words.slice(3, 6));

  /* ---- scene cuts + the transcript route */
  ff(["-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "color=blue:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "testsrc=s=320x180:d=2:r=25",
      "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-filter_complex", "[0][1][2]concat=n=3:v=1[v]", "-map", "[v]", "-map", "3:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "shots.mp4")]);
  curl(["-X", "POST", "-F", "file=@" + path.join(TMP, "shots.mp4"), URL_ + "/api/passets"]);
  const s1 = api("/api/textedit/scenecuts", { name: "shots.mp4" }), s2 = api("/api/textedit/scenecuts", { name: "shots.mp4" });
  check("POST /api/textedit/scenecuts: the two shot changes (2 s, 4 s), cached the second time", s1.ok && JSON.stringify(s1.cuts) === "[2,4]" && s2.cached, [s1, s2]);
  check("... a clip that is not in the project -> 404", code("/api/textedit/scenecuts", { name: "nope.mp4" }) === 404);
  const tw = api("/api/textedit/words", { name: "shots.mp4" });
  const asrOn = (api("/api/captions/info").asr || {}).installed;
  check("POST /api/textedit/words: transcribes, or says speech-to-text is missing (409)", asrOn ? tw.ok && Array.isArray(tw.words) : /not installed/.test(tw.error || ""), tw);

  /* ---- what the page makes, compiled */
  const clip = { name: "shots.mp4", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 };
  const cutPieces = X.remove(clip, [[1, 2]]).pieces;
  const body = (video) => ({ video, video_layers: [], audio: [[]], images: [[]], keep_original_audio: true });
  const c1 = api("/api/export", body(cutPieces));
  const g1 = c1.id ? await job(c1.id) : {};
  const f1 = g1.output ? path.join(pdir, g1.output) : "";
  check("a clip cut by text (1 s out) compiles to 5 s", g1.status === "done" && Math.abs(dur(f1) - 5) < 0.15, { st: g1.status, d: f1 && fs.existsSync(f1) && dur(f1) });
  const splitPieces = X.splitAt(clip, s1.cuts || []);
  const c2 = api("/api/export", body(splitPieces));
  const g2 = c2.id ? await job(c2.id) : {};
  const f2 = g2.output ? path.join(pdir, g2.output) : "";
  check("the clip split at its shots (3 pieces) compiles to the same 6 s", splitPieces.length === 3 && g2.status === "done" && Math.abs(dur(f2) - 6) < 0.15, { n: splitPieces.length, st: g2.status });
})().catch((e) => { fail++; console.log("FAIL: crashed " + (e.stack || e)); }).finally(() => {
  try { api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
