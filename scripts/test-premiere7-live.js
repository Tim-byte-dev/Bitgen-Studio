#!/usr/bin/env node
/* bitGen Studio — 2.412.0 LIVE: the smaller Premiere jobs, compiled by the REAL app (H3_URL, default :8311) with the REAL
 * ffmpeg, then measured:
 *   1. ProRes 4444 WITH ALPHA: see-through in V1's leading gap (alpha 0), a 50 % picture over it = half see-through,
 *      opaque over V1's clip; H.264 10-bit (High 10, yuv420p10le) carrying a DROP-FRAME timecode (01:00:00;00)
 *   2. J / L cuts on a video layer (V2): the next clip's 880 Hz heard over the previous one's last second, its 440 Hz
 *      silenced there; a 2x clip's L at its speed
 *   3. a video clip's sound taken out (🔗) and moved 1 s later: the picture plays silent, its sound plays from 1 s
 *   4. EQ / multiband / reverb on a sound clip: compiled, the log names them; the low shelf cut lowers a 100 Hz tone
 *   5. hue vs sat: a green picture taken to grey
 *   6. effect keyframes: a vignette from none to full - the corner bright at the start, dark at the end
 * Tim: "do the smaller jobs and complete the 10 partly done jobs". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem7_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem7_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,pix_fmt,width,height:format=duration:format_tags=timecode:stream_tags=timecode", "-of", "json", f], { encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}
const V = (pr) => (pr.streams || []).find((s) => s.codec_type === "video") || {};
const tcOf = (pr) => ((pr.format || {}).tags || {}).timecode || ((pr.streams || []).map((s) => (s.tags || {}).timecode).find(Boolean)) || "";
function rmsDb(f, a, b, band) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(a), "-t", String(b - a), "-i", f, "-af", (band ? "bandpass=f=" + band + ":w=60," : "") + "astats", "-f", "null", "-"], { encoding: "utf8" });
  const m = /Overall[\s\S]*?RMS level dB:\s*(-?[\d.]+|-inf)/.exec(r.stderr || "");
  return m ? (m[1] === "-inf" ? -120 : +m[1]) : NaN;
}
function rgba(f, t) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgba", "-f", "rawvideo", "-"], { maxBuffer: 256 << 20 }); }
function rgbAt(f, t) { const b = rgba(f, t), m = [0, 0, 0]; for (let i = 0; i < b.length; i += 4) { m[0] += b[i]; m[1] += b[i + 1]; m[2] += b[i + 2]; } return m.map((v) => v / (b.length / 4)); }
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

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
  fs.mkdirSync(path.join(pdir, "images"), { recursive: true });
  const mk = (name, color, tone, d) => ff(["-f", "lavfi", "-i", `color=c=${color}:s=320x180:r=30:d=${d}`, "-f", "lavfi", "-i", `sine=frequency=${tone}:sample_rate=48000:duration=${d}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "12", "-c:a", "aac", "-shortest", path.join(TMP, name)]);
  mk("a440.mp4", "0x406080", 440, 4); mk("b880.mp4", "0x806040", 880, 4); mk("grn.mp4", "0x20c040", 660, 2); mk("wht.mp4", "0xe0e0e0", 330, 2);
  for (const f of ["a440.mp4", "b880.mp4", "grn.mp4", "wht.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);
  ff(["-f", "lavfi", "-i", "color=c=0xff0000:s=100x100", "-frames:v", "1", path.join(pdir, "images", "red.png")]);
  ff(["-f", "lavfi", "-i", "sine=frequency=100:sample_rate=48000:duration=3", path.join(pdir, "sound", "low100.wav")]);

  /* ---- 1. ProRes 4444 alpha + H.264 10-bit drop-frame */
  const q = await compile(base([{ name: "a440.mp4", src: "video", in: 0, out: 2, dur: 4, start: 1, opacity: 1 }], {
    images: [{ clips: [{ name: "red.png", start: 0, len: 3, opacity: 0.5 }] }],
    deliver: [{ preset: "prores4444" }, { preset: "h264_10", fps: "30" }], tc: { start: "01:00:00:00", fps: 29.97, drop: true } }), "ProRes 4444 alpha + H.264 10-bit");
  if (q) {
    const st = path.basename(q.master, ".mp4"), p4 = path.join(pdir, st + "_prores4444.mov");
    const h10 = path.join(pdir, fs.readdirSync(pdir).find((f) => f.startsWith(st + "_h264_10") && f.endsWith(".mp4")) || "none");   // named with its fps
    const a = probe(p4), h = probe(h10);
    check("<project>_prores4444.mov: ProRes 4444 with an alpha plane (yuva444p1xle)", V(a).codec_name === "prores" && /4444/.test(V(a).profile || "") && /^yuva444p1\dle$/.test(V(a).pix_fmt || ""), V(a));
    const al = (t, x, y) => { const b = rgba(p4, t); const i = (y * 320 + x) * 4; return b[i + 3]; };
    const g0 = al(0.5, 5, 5), half = al(0.5, 160, 90), solid = al(1.5, 5, 5);
    check("...see-through where nothing is drawn (V1's gap: alpha 0), the 50 % picture half see-through over it, opaque over V1's clip", g0 < 12 && half > 100 && half < 160 && solid > 245, { g0, half, solid });
    const px = rgba(p4, 0.5), i = (90 * 320 + 160) * 4;
    check("...the colour there is the picture's own (red), not mixed with the black", px[i] > 200 && px[i + 1] < 50 && px[i + 2] < 50, [px[i], px[i + 1], px[i + 2]]);
    check("<project>_h264_10.mp4: High 10, yuv420p10le, drop-frame timecode 01:00:00;00 (30 fps file)", /High 10/.test(V(h).profile || "") && V(h).pix_fmt === "yuv420p10le" && tcOf(h) === "01:00:00;00", { v: V(h), tc: tcOf(h) });
    check("the log: the alpha from the black / white passes; the passes' files cleaned up", /the alpha from the black \/ white passes/.test(q.log) && !fs.readdirSync(pdir).some((f) => /__alpha_/.test(f)), q.log.slice(-600));
  }

  /* ---- 2. J / L cuts on V2, and a retimed clip's */
  const j2 = await compile(base([{ name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }], {
    keep_original_audio: false,
    video_layers: [{ name: "V2", volume: 1, opacity: 1, clips: [{ name: "a440.mp4", src: "video", in: 0, out: 2, dur: 4, start: 0, opacity: 1 },
      { name: "b880.mp4", src: "video", in: 1, out: 3, dur: 4, start: 2, opacity: 1, split: { lead: 1 } }] }] }), "J cut on V2");
  if (j2) {
    const hi = rmsDb(j2.file, 1.2, 1.8, 880), lo = rmsDb(j2.file, 1.2, 1.8, 440), before = rmsDb(j2.file, 0.2, 0.8, 880);
    check("V2's J cut: the next clip's 880 Hz heard over the last second of the previous one, whose 440 Hz is silenced there (880 absent before)", hi > lo + 20 && hi > before + 20, { hi, lo, before });
    check("...the log says the layer's clip is silenced under the cut", /silenced under 1 J \/ L cut/.test(j2.log), j2.log.slice(-600));
  }
  const j3 = await compile(base([{ name: "a440.mp4", src: "video", in: 0, out: 2, dur: 4, start: 0, opacity: 1, fx: { speed: 2 }, split: { tail: 1 } },
    { name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 1, opacity: 1 }]), "L cut on a 2x clip");
  if (j3) {
    const t440 = rmsDb(j3.file, 1.2, 1.8, 440), after = rmsDb(j3.file, 2.2, 2.8, 440);   // atempo keeps the pitch
    check("a 2x clip's L cut: its sound runs on for 1 s after its picture (at its speed, the pitch kept) over the next clip, then stops", t440 > -40 && after < t440 - 20 && /J \/ L cuts: 1 split edit/.test(j3.log), { t440, after });
  }

  /* ---- 3. a video's sound as its own clip, moved 1 s later */
  const s3 = await compile(base([{ name: "a440.mp4", src: "video", in: 0, out: 3, dur: 4, start: 0, opacity: 1, soundOut: true, link: "ln1" }], {
    audio: [{ name: "V1 sound", clips: [{ name: "a440.mp4", src: "video", start: 1, in: 0, out: 3, dur: 4, volume: 1, role: "voice", link: "ln1" }] }] }), "sound taken out + moved");
  if (s3) {
    const early = rmsDb(s3.file, 0.1, 0.8, 440), late = rmsDb(s3.file, 1.3, 2.5, 440);
    check("the picture plays silent (0-1 s: no 440 Hz), its sound - from the video file - plays from 1 s", early < -60 && late > -40, { early, late });
  }

  /* ---- 4. EQ / multiband / reverb */
  const e4 = await compile(base([{ name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }], {
    keep_original_audio: false,
    audio: [{ clips: [{ name: "low100.wav", start: 0, in: 0, out: 2, dur: 3, volume: 1, fx: { afx: { eq: { low: -12 } } } }] },
            { clips: [{ name: "low100.wav", start: 0, in: 0, out: 2, dur: 3, volume: 0.0001 }] }] }), "EQ low cut");
  const e5 = await compile(base([{ name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }], {
    keep_original_audio: false, audio: [{ clips: [{ name: "low100.wav", start: 0, in: 0, out: 2, dur: 3, volume: 1 }] }] }), "the same tone, no EQ");
  if (e4 && e5) {
    const cut = rmsDb(e4.file, 0.3, 1.5), flat = rmsDb(e5.file, 0.3, 1.5);
    check("EQ low -12 dB: the 100 Hz tone comes out quieter than without it", cut < flat - 6, { cut, flat });
  }
  const e6 = await compile(base([{ name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }], {
    keep_original_audio: false, audio: [{ clips: [{ name: "low100.wav", start: 0, in: 0, out: 2, dur: 3, volume: 1, fx: { afx: { eq: { low: 3, mid: -2, high: 2 }, comp: 0.5, reverb: { mix: 0.6, room: "hall" } } } }] }] }), "EQ + multiband + reverb");
  if (e6) check("...EQ + multiband + reverb compiled, the log names them", /sound eq, comp, reverb/.test(e6.log), e6.log.slice(-800));

  /* ---- 5. hue vs sat */
  const h5 = await compile(base([{ name: "grn.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1,
    fx: { grade: { hcurves: { hs: [[0, 0.5], [0.25, 0.5], [0.36, 0], [0.47, 0.5], [1, 0.5]] } } } }]), "hue vs sat");
  if (h5) {
    const c = rgbAt(h5.file, 1);
    check("hue vs sat: the green (≈ 135°) taken to grey (R ≈ G ≈ B)", Math.abs(c[1] - c[0]) < 18 && Math.abs(c[1] - c[2]) < 18, c);
  }

  /* ---- 6. effect keyframes */
  const k6 = await compile(base([{ name: "wht.mp4", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1,
    fx: { vfx: { kf: [{ at: 0, vignette: 0 }, { at: 2, vignette: 1 }] } } }]), "vignette keyframes");
  if (k6) {
    const corner = (t) => { const b = rgba(k6.file, t); let s = 0; for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) s += b[(y * 320 + x) * 4]; return s / 100; };
    const c0 = corner(0.05), c1 = corner(1.9);
    check("effect keyframes: the vignette grows - the corner bright at the start, dark at the end; the log says keyframed", c0 > 190 && c1 < c0 - 60 && /vignette keyframed/.test(k6.log), { c0, c1, log: k6.log.slice(-500) });
  }

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
