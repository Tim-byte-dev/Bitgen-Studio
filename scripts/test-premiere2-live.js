#!/usr/bin/env node
/* bitGen Studio — 2.407.0 LIVE: the 📤 Export queue, J / L cuts, the advanced colour grade and ⇄ Exchange COMPILED /
 * answered by the REAL app (H3_URL, default :8311) with the REAL ffmpeg, then measured.
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
 *   1. one compile -> H.265, ProRes 422 HQ, DNxHR HQ, a 9:16 WebM (blurred fill), a GIF, WAV, MP3 and a 1:1 24 fps
 *      H.264: the right codecs, sizes and rates, the start timecode in the MP4 / MOV, listed + downloadable
 *   2. a J cut: the second clip's sound starts 1 s before its picture and the first clip's is silenced there; an L cut
 *      runs it on after its picture
 *   3. curves + a gain wheel compiled = static/clipfx.js's numbers
 *   4. FCP XML / EDL / OTIO out of the route (the project's paths, kept in exports/), XML + EDL back in
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem2_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem2_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body, raw) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, raw ? body : JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const textApi = (u, text) => { const t = curl(["-X", "POST", "-H", "Content-Type: text/plain", "--data-binary", bodyArg(text, true), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt:format=duration:format_tags=timecode:stream_tags=timecode", "-of", "json", f], { encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}
const V = (pr) => (pr.streams || []).find((s) => s.codec_type === "video") || {};
const A = (pr) => (pr.streams || []).find((s) => s.codec_type === "audio") || {};
const tcOf = (pr) => ((pr.format || {}).tags || {}).timecode || ((pr.streams || []).map((s) => (s.tags || {}).timecode).find(Boolean)) || "";
function rmsDb(f, a, b, band) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(a), "-t", String(b - a), "-i", f, "-af", "bandpass=f=" + band + ":w=60,astats", "-f", "null", "-"], { encoding: "utf8" });
  const m = /Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/.exec(r.stderr || "");
  return m ? (m[1] === "-inf" ? -120 : +m[1]) : NaN;
}
function rgbAt(f, t) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
  const m = [0, 0, 0]; for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i]; return m.map((v) => v / (buf.length / 3));
}
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  let st = "";
  for (let i = 0; i < 300; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = api("/api/jobs/" + j.id + "?log_from=0");
  const log = String(g.log || ""), out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", st === "done" && out && fs.existsSync(out), { st, log: log.slice(-900) });
  if (st !== "done") return null;
  const keep = path.join(TMP, "out" + (nb++) + ".mp4"); fs.copyFileSync(out, keep);
  return { file: keep, master: out, log };
}
const base = (video, more) => Object.assign({ video, video_layers: [], audio: [[]], images: [[]], keep_original_audio: true }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  // 1280x720 grey that brightens + a 440 Hz tone; a second clip (6 s) with 880 Hz; a mid-grey still clip for colour
  ff(["-f", "lavfi", "-i", "color=c=gray:s=1280x720:r=30:d=4,geq=lum='40+30*T':cb=128:cr=128", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", path.join(TMP, "p2a.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=0x305070:s=1280x720:r=30:d=6", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=6",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", path.join(TMP, "p2b.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=0x808080:s=640x360:r=30:d=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "8", "-c:a", "aac", "-shortest", path.join(TMP, "p2grey.mp4")]);
  for (const f of ["p2a.mp4", "p2b.mp4", "p2grey.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);
  const cA = { name: "p2a.mp4", src: "video", in: 0, out: null, dur: 4, start: 0, opacity: 1 };

  /* ---- 1. the export queue */
  const pr = api("/api/deliver/presets");
  check("GET /api/deliver/presets: 12 presets (2.411.0: + AV1, H.265 10-bit; 2.412.0: + ProRes 4444, H.264 10-bit), sizes, aspects, fits", (pr.presets || []).length >= 12 && pr.aspects.includes("9:16") && pr.fits.includes("blur"), pr);
  const dl = [{ preset: "h265" }, { preset: "prores" }, { preset: "dnxhr", size: "720" }, { preset: "webm", aspect: "9:16", size: "720", fit: "blur" }, { preset: "gif", size: "480" },
              { preset: "wav" }, { preset: "mp3" }, { preset: "h264", aspect: "1:1", size: "480", fit: "crop", fps: "24", quality: "small" }];
  const q = await compile(base([cA], { deliver: dl, tc: { start: "01:00:00:00", fps: 30 } }), "export queue (8 formats)");
  if (q) {
    const d = path.dirname(q.master), st = path.basename(q.master, ".mp4");
    const F = (n, e) => path.join(d, `${st}_${n}.${e}`);
    const want = [["h265", "mp4"], ["prores", "mov"], ["dnxhr_720p", "mov"], ["webm_9x16_720p", "webm"], ["gif_480p", "gif"], ["wav", "wav"], ["mp3", "mp3"], ["h264_1x1_480p_24fps", "mp4"]];
    check("export queue: every file beside the master", want.every(([n, e]) => fs.existsSync(F(n, e))), want.filter(([n, e]) => !fs.existsSync(F(n, e))));
    check("export queue: the worker's lines", /export queue: 8 deliverable\(s\)/.test(q.log) && /export queue done:/.test(q.log), q.log.slice(-800));
    const h5 = probe(F("h265", "mp4")), prs = probe(F("prores", "mov")), dn = probe(F("dnxhr_720p", "mov")), wb = probe(F("webm_9x16_720p", "webm")), gf = probe(F("gif_480p", "gif"));
    const wv = probe(F("wav", "wav")), m3 = probe(F("mp3", "mp3")), sq = probe(F("h264_1x1_480p_24fps", "mp4"));
    check("H.265: hevc 1280x720 + aac, timecode 01:00:00:00", V(h5).codec_name === "hevc" && V(h5).width === 1280 && A(h5).codec_name === "aac" && tcOf(h5) === "01:00:00:00", [V(h5), tcOf(h5)]);
    check("ProRes 422 HQ: prores HQ 10-bit 4:2:2 + 24-bit PCM, timecode", V(prs).codec_name === "prores" && /HQ/i.test(V(prs).profile || "") && V(prs).pix_fmt === "yuv422p10le" && A(prs).codec_name === "pcm_s24le" && tcOf(prs) === "01:00:00:00", [V(prs), A(prs), tcOf(prs)]);
    check("DNxHR HQ: dnxhd 1280x720 4:2:2", V(dn).codec_name === "dnxhd" && V(dn).width === 1280 && V(dn).pix_fmt === "yuv422p", V(dn));
    check("WebM 9:16 720: vp9 720x1280 + opus", V(wb).codec_name === "vp9" && V(wb).width === 720 && V(wb).height === 1280 && A(wb).codec_name === "opus", [V(wb), A(wb)]);
    check("GIF: gif 640x360 at most, no sound", V(gf).codec_name === "gif" && V(gf).height === 360 && !A(gf).codec_name, V(gf));
    check("WAV 24-bit 48 kHz, MP3: sound only", A(wv).codec_name === "pcm_s24le" && !V(wv).codec_name && A(m3).codec_name === "mp3", [A(wv), A(m3)]);
    check("1:1 480 24 fps H.264: 480x480 at 24/1", V(sq).codec_name === "h264" && V(sq).width === 480 && V(sq).height === 480 && V(sq).r_frame_rate === "24/1", V(sq));
    const lst = api("/api/deliver/files");
    check("GET /api/deliver/files lists the master + the 8", (lst.files || []).length >= 9 && lst.files.some((f) => f.name === st + ".mp4"), lst);
    const got = path.join(TMP, "dl.mp3");
    curl(["-o", got, URL_ + "/api/deliver/file/" + encodeURIComponent(st + "_mp3.mp3")]);
    check("GET /api/deliver/file downloads one", fs.existsSync(got) && fs.statSync(got).size === fs.statSync(F("mp3", "mp3")).size);
    check("... and refuses a file that is not a delivery", /no delivered file/.test(api("/api/deliver/file/package.json").error || ""));
  }

  /* ---- 2. J / L cuts */
  const cB = (split) => ({ name: "p2b.mp4", src: "video", in: 1, out: 4, dur: 6, start: 4, opacity: 1, split });
  const jj = await compile(base([cA, cB({ lead: 1 })]), "J cut");
  if (jj) {
    const hi = rmsDb(jj.file, 3.2, 3.8, 880), lo = rmsDb(jj.file, 3.2, 3.8, 440), before = rmsDb(jj.file, 2.0, 2.8, 880), after = rmsDb(jj.file, 2.0, 2.8, 440);
    check("J cut: the second clip's sound (880 Hz) plays the second before its picture, the first clip's (440) is silenced there",
      hi > -40 && lo < hi - 25 && before < -60 && after > -40, { hi, lo, before, after });
    check("J cut: the worker says it", /J \/ L cuts: 1 split edit/.test(jj.log), jj.log.slice(-500));
    check("J cut: the picture still cuts at 4 s (the movie is 7 s)", Math.abs(+execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", jj.file], { encoding: "utf8" }) - 7) < 0.15);
  }
  // L: the 880 Hz clip first (source 1..3, its media runs to 6), the 440 Hz one after it at 2 s
  const ll = await compile(base([{ name: "p2b.mp4", src: "video", in: 1, out: 3, dur: 6, start: 0, opacity: 1, split: { tail: 1 } }, Object.assign({}, cA, { start: 2 })]), "L cut");
  if (ll) {
    const b2 = rmsDb(ll.file, 2.2, 2.8, 880), a2 = rmsDb(ll.file, 2.2, 2.8, 440), a3 = rmsDb(ll.file, 3.3, 3.9, 440);
    check("L cut: the first clip's sound runs on 1 s over the second's picture, whose own sound comes back after", b2 > -40 && a2 < b2 - 25 && a3 > -40, { b2, a2, a3 });
  }

  // 2.407.0 regression: a trimmed clip (cut to vp9) then an untrimmed h264 one used to join into a minutes-long file
  const mixed = await compile(base([{ name: "p2b.mp4", src: "video", in: 1, out: 3, dur: 6, start: 0, opacity: 1 }, Object.assign({}, cA, { start: 2 })]), "V1: a trimmed clip then an untrimmed one");
  if (mixed) check("V1 join with a trimmed + an untrimmed clip: 6 s, not minutes (one codec for the join)", Math.abs(+execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mixed.file], { encoding: "utf8" }) - 6) < 0.2
    && /the join needs one codec/.test(mixed.log), mixed.log.slice(-400));

  /* ---- 3. the advanced grade = the shared maths */
  const G = { name: "p2grey.mp4", src: "video", in: 0, out: null, dur: 2, start: 0, opacity: 1 };
  const plain = await compile(base([G]), "grey plain");
  const grade = { curves: { m: [[0, 0], [0.5, 0.72], [1, 1]] }, wheels: { gain: { x: Math.cos(4.19), y: Math.sin(4.19), l: 0 } } };
  const gr = await compile(base([Object.assign({}, G, { fx: { grade } })]), "grey with curves + a blue gain wheel");
  if (plain && gr) {
    const p = rgbAt(plain.file, 1), g = rgbAt(gr.file, 1), want = FX.gradeRgb(p[0] / 255, p[1] / 255, p[2] / 255, FX.normalize({ grade }).grade).map((v) => v * 255);
    check("curves + gain wheel compiled = static/clipfx.js (within 6 levels), blue over red", g.every((v, i) => Math.abs(v - want[i]) < 6) && g[2] > g[0] + 10, { plain: p, compiled: g, want });
  }

  /* ---- 4. exchange */
  const tl = { video: [{ name: "p2a.mp4", src: "video", start: 0, in: 0, out: 4, dur: 4 }, { name: "p2b.mp4", src: "video", start: 4, in: 1, out: 4, dur: 6, fx: { speed: 2 } }],
               v1: { name: "V1" }, vlayers: [], audio: [], images: [] };
  const ex = textApi("/api/interchange/export", JSON.stringify({ tl, format: "fcpxml", fps: 30, tc: { start: "01:00:00:00", fps: 30 }, w: 1280, h: 720, name: "Prem Cut" }));
  const vd = path.join(ROOT, "projects", P, "video").replace(/\\/g, "/");
  check("⇄ FCP XML out: the project's own paths, kept in exports/", ex.ok && ex.file === "Prem Cut.xml" && ex.text.includes("file://localhost" + (vd.startsWith("/") ? "" : "/") + vd.split("/").map(encodeURIComponent).join("/").replace(/%3A/g, ":") + "/p2a.mp4")
    && fs.existsSync(path.join(ROOT, "projects", P, "exports", "Prem Cut.xml")), (ex.text || ex.error || "").slice(0, 600));
  const im = textApi("/api/interchange/import?filename=cut.xml", ex.text || "");
  check("⇄ XML back in: both clips matched in this project, speed 2 kept, the timecode", im.ok && im.tl.video.length === 2 && im.missing.length === 0 && im.tl.video[1].fx.speed === 2 && im.tl.tc.start === "01:00:00:00", im);
  const ed = textApi("/api/interchange/export", JSON.stringify({ tl, format: "edl", fps: 30, tc: { start: "01:00:00:00", fps: 30 }, name: "Prem Cut" }));
  const ei = textApi("/api/interchange/import?filename=cut.edl&fps=30", ed.text || "");
  check("⇄ EDL out and back in", ed.ok && /^TITLE: Prem Cut/.test(ed.text) && ei.ok && ei.tl.video.length === 2 && Math.abs(ei.tl.video[1].start - 4) < 0.05, { ed: (ed.text || "").slice(0, 300), ei });
  const oo = textApi("/api/interchange/export", JSON.stringify({ tl, format: "otio", fps: 30, name: "Prem Cut" }));
  check("⇄ OTIO out: JSON Timeline.1", oo.ok && JSON.parse(oo.text).OTIO_SCHEMA === "Timeline.1");
  const bad = textApi("/api/interchange/import?filename=x.edl", "hello");
  check("⇄ a file that is not an EDL / XML: said (400)", /no events/.test(bad.error || ""), bad);
  const miss = textApi("/api/interchange/import?filename=x.xml", (ex.text || "").replace(/p2b\.mp4/g, "elsewhere.mp4"));
  check("⇄ media not in the project: listed missing", miss.ok && miss.missing.join() === "elsewhere.mp4" && miss.tl.video.length === 1, miss);
})().catch((e) => { fail++; console.log("FAIL: crashed " + (e.stack || e)); }).finally(() => {
  try { api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
