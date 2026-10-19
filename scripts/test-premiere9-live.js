#!/usr/bin/env node
/* bitGen Studio — 2.414.0 LIVE: the medium Premiere jobs answered by the REAL app (H3_URL, default :8311) with the REAL
 * ffmpeg, then measured:
 *   1. a NESTED SEQUENCE: a named timeline compiled as one clip (/api/export {nest} -> nest_<name>_<hash>.mp4, no
 *      deliverables), adopted into video/, used on another timeline's layer and compiled there (its picture on top);
 *      saved again -> its hash moves on (out of date); a loop refused in words
 *   2. the XML's GRADE: the .cube baked beside the export IS the compile's look (the source through it = the compiled
 *      frame); FCPXML out and back in through the route
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
const P = "zz_prem9_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem9_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body)); return "@" + f; };
const api = (u, body, type) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: " + (type || "application/json"), ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function rgbAt(f, t) {
  const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
  let r = 0, g = 0, bl = 0; const n = b.length / 3; for (let i = 0; i < b.length; i += 3) { r += b[i]; g += b[i + 1]; bl += b[i + 2]; }
  return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
}
// measured in RGB (scaling a busy picture in YUV first averages different colours)
function raw(f, t, vf) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24," + (vf ? vf + "," : "") + "scale=64:36:flags=area,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 }); }
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  let st = "";
  for (let i = 0; i < 400; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = api("/api/jobs/" + j.id + "?log_from=0");
  const log = [].concat(g.log || []).join("\n"), out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", st === "done" && out && fs.existsSync(out), { st, log: log.slice(-1200) });
  if (st !== "done") return null;
  return { file: out, output: g.output, log };
}
// the payload as the page's TlExportBody builds it (ext/timelinedock/timelinedock.js)
const body = (X, more) => Object.assign({ video: (X.video || []).map((c) => ({ name: c.name, src: c.src || "output", in: c.in, out: c.out, opacity: 1, start: c.start || 0, dur: c.dur, fx: c.fx })),
  video_role: "voice", video_muted: false, video_volume: 1, video_opacity: 1,
  video_layers: (X.vlayers || []).map((L) => ({ name: L.name, muted: false, volume: 1, opacity: 1, clips: L.clips.map((c) => ({ name: c.name, src: c.src || "output", in: c.in, out: c.out, opacity: 1, start: c.start || 0, dur: c.dur })), role: "voice" })),
  audio: [], images: [], keep_original_audio: true }, more || {});

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=0xd02020:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=frequency=500:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "red.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=0x2040d0:s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=frequency=300:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "blue.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=frequency=400:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "pat.mp4")]);
  // mid tones in every direction (a grade shows; nothing clips) - for the .cube check
  ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=3", "-vf", "format=rgb24,geq=r='40+X/2':g='50+Y':b='170-X/3'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", path.join(TMP, "grad.mp4")]);
  for (const f of ["red.mp4", "blue.mp4", "pat.mp4", "grad.mp4"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);

  /* ---- 1. nested sequence */
  const inner = { video: [{ name: "red.mp4", src: "video", in: 0.5, out: 2.5, dur: 3, start: 0 }], vlayers: [], audio: [], images: [], playhead: 1 };
  const sv = api("/api/timelines/inner", { tl: inner, activate: false });
  const ok = api("/api/nest/check", { outer: "main", inner: "inner" });
  check("the nested timeline saved (not made active); /api/nest/check main <- inner: fine, its hash", sv.saved && sv.name === "inner" && ok.ok && /^[0-9a-f]{16}$/.test(ok.hash || ""), { sv, ok });
  const self = api("/api/nest/check", { outer: "inner", inner: "inner" });
  check("...a timeline into itself: refused in words", self.ok === false && /cannot be nested in itself/.test(self.error || ""), self);
  const n1 = await compile(body(inner, { nest: "inner", deliver: [{ preset: "h264", aspect: "9:16", size: "720" }], captions: { cues: [{ start: 0, end: 1, text: "x" }], burn: false, srt: true } }), "the nest's compile");
  if (n1) {
    check("...its file is nest_inner_<hash8>.mp4 in the project root; no deliverable, no .srt (a nest is a clip, not a release)",
      n1.output === "nest_inner_" + ok.hash.slice(0, 8) + ".mp4" && !fs.readdirSync(pdir).some((f) => /^nest_inner.*_h264|\.srt$/.test(f)), { out: n1.output, files: fs.readdirSync(pdir) });
    const ad = api("/api/nest/adopt", { name: "inner" });
    check("/api/nest/adopt: moved into video/ ({file, dur 2 s, hash})", ad.ok && ad.file === n1.output && Math.abs(ad.dur - 2) < 0.1 && ad.hash === ok.hash && fs.existsSync(path.join(pdir, "video", ad.file)) && !fs.existsSync(n1.file), ad);
    const st = api("/api/nest/status?names=inner");
    check("/api/nest/status: up to date (same hash, the file there)", st.ok && st.status.inner.hash === ad.hash && st.status.inner.exists === true, st);
    // the outer timeline: blue on V1, the nest on a layer from 0.5 s
    const outer = { video: [{ name: "blue.mp4", src: "video", in: 0, out: 4, dur: 4, start: 0 }],
      vlayers: [{ name: "⧉ inner", clips: [{ name: ad.file, src: "video", in: 0, out: ad.dur, dur: ad.dur, start: 0.5, nest: "inner", nestHash: ad.hash }] }], audio: [], images: [] };
    const m1 = await compile(body(outer), "the outer timeline holding the nest");
    if (m1) {
      const a = rgbAt(m1.file, 0.2), b = rgbAt(m1.file, 1.5), c = rgbAt(m1.file, 3.2);
      check("...the nested timeline plays where it sits (red over the blue from 0.5 to 2.5 s), the blue around it", a[2] > 150 && b[0] > 150 && b[2] < 90 && c[2] > 150, { a, b, c });
    }
    api("/api/timelines/main", { tl: outer, activate: true });
    const loop = api("/api/nest/check", { outer: "inner", inner: "main" });
    check("...nesting main into inner (main already holds inner): a loop - refused in words", loop.ok === false && /would be a loop/.test(loop.error || ""), loop);
    api("/api/timelines/inner", { tl: Object.assign({}, inner, { video: [{ name: "red.mp4", src: "video", in: 0.5, out: 1.5, dur: 3, start: 0 }] }), activate: false });
    const st2 = api("/api/nest/status?names=inner");
    check("the nested timeline trimmed and saved: a new hash (the clip's ↻ out of date), its render not made yet", st2.status.inner.hash !== ad.hash && st2.status.inner.exists === false, st2);
  }

  /* ---- 2. the grade's .cube = the compile's look; FCPXML through the route */
  const gfx = { grade: { exposure: 0.6, contrast: 25, saturation: 140, temperature: 30 } };
  const g1 = await compile(body({ video: [{ name: "grad.mp4", src: "video", in: 0, out: 3, dur: 3, start: 0, fx: gfx }] }), "a graded clip");
  const ex = api("/api/interchange/export", { tl: { v1: { name: "V1" }, video: [{ name: "grad.mp4", src: "video", in: 0, out: 3, dur: 3, start: 0, fx: gfx }], vlayers: [], audio: [], images: [] }, format: "fcpxml", fps: 25, name: "graded" }, "text/plain");
  const cube = ex.luts && ex.luts[0] ? path.join(pdir, "exports", ex.luts[0]) : "";
  check("⇄ XML: the graded clip's look baked as exports/graded_luts/grad_1.cube, named in the clip's comment",
    ex.ok && ex.luts.length === 1 && ex.luts[0] === "graded_luts/grad_1.cube" && fs.existsSync(cube) && /LUT_3D_SIZE 33/.test(fs.readFileSync(cube, "utf8")) && /baked as graded_luts\/grad_1\.cube/.test(ex.text), { ok: ex.ok, luts: ex.luts });
  if (g1 && cube) {
    const a = raw(g1.file, 1.5), b = raw(path.join(TMP, "grad.mp4"), 1.5, "lut3d=file='" + cube.replace(/'/g, "\\'") + "'");
    let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); d /= a.length;
    const s0 = raw(path.join(TMP, "grad.mp4"), 1.5); let d0 = 0; for (let i = 0; i < a.length; i++) d0 += Math.abs(a[i] - s0[i]); d0 /= a.length;
    check("...the source through that .cube IS the compiled frame (another editor applying it sees bitGen's grade)", d < 6 && d0 > 12, { through: d, ungraded: d0 });
  }
  const fx = api("/api/interchange/export", { tl: { v1: { name: "V1" }, video: [{ name: "blue.mp4", src: "video", in: 0, out: 2, dur: 4, start: 0 }, { name: "red.mp4", src: "video", in: 1, out: 3, dur: 3, start: 2, fx: { speed: 2 } }],
    vlayers: [{ name: "V2", clips: [{ name: "pat.mp4", src: "video", in: 0, out: 1, dur: 3, start: 0.5, tf: { x: 40, y: 0, scale: 0.5, rot: 0 } }] }], audio: [], images: [] }, format: "fcpx", fps: 25, name: "for fcp", tc: { start: "01:00:00:00", fps: 25 } }, "text/plain");
  check("⇄ FCPXML: for fcp.fcpxml, the media's real paths (file://…/video/blue.mp4)", fx.ok && fx.file === "for fcp.fcpxml" && fs.existsSync(path.join(pdir, "exports", fx.file))
    && fx.text.includes("file://" + path.join(pdir, "video", "blue.mp4").split("/").map(encodeURIComponent).join("/")), { ok: fx.ok, file: fx.file, err: fx.error });
  const im = api("/api/interchange/import?filename=" + encodeURIComponent("for fcp.fcpxml") + "&fps=25", fx.text || "", "text/plain");
  check("...imported back (the route reads an .fcpxml as Final Cut Pro X): V1 blue + red at 2x, V2 pat moved / scaled, 01:00:00:00, nothing missing",
    im.ok && im.tl.video.length === 2 && im.tl.video[1].fx.speed === 2 && im.tl.video[1].start === 2 && im.tl.vlayers[0].clips[0].tf.scale === 0.5 && im.tl.vlayers[0].clips[0].tf.x === 40 && im.tl.tc.start === "01:00:00:00" && !im.missing.length && im.name === "for fcp", im);

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
