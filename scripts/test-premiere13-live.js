#!/usr/bin/env node
/* bitGen Studio — 2.418.0 LIVE: ⚡ a RENDER PREVIEW by the REAL app (H3_URL, default :8311) with the REAL compile:
 * POST /api/export {preview: id} writes preview_<id>.mp4 (not the project's movie, no deliverables), /api/tlrender/adopt
 * moves it into cache/preview, GET serves it - the same picture as the movie.
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
const P = "zz_prem13_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem13_"));
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
  ff(["-f", "lavfi", "-i", "color=c=0x808080:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=300:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(TMP, "grey.mp4")]);
  curl(["-X", "POST", "-F", "file=@" + path.join(TMP, "grey.mp4"), URL_ + "/api/passets"]);
  const heavy = { grade: { exposure: -1.5 }, vfx: { vignette: 0.6 } };
  const id = "a1b2c3d4" + (process.pid >>> 0).toString(16).padStart(8, "0").slice(-8);
  const pv = await compile(base([V("grey.mp4", { fx: heavy })], { preview: id, deliver: [{ preset: "mp3" }] }), "⚡ a preview render");
  if (pv) {
    check("the compile wrote preview_<id>.mp4 - not the project's movie, no deliverable beside it", path.basename(pv.master) === "preview_" + id + ".mp4" && !fs.existsSync(path.join(pdir, P + ".mp4"))
      && !fs.readdirSync(pdir).some((f) => /_mp3\.mp3$/.test(f)), { master: pv.master, files: fs.readdirSync(pdir) });
    const ad = api("/api/tlrender/adopt", { id });
    const code = ad.url ? curl(["-o", path.join(TMP, "pv.mp4"), "-w", "%{http_code}", URL_ + ad.url]) : "";
    check("POST /api/tlrender/adopt: into cache/preview/<id>.mp4 (3 s); GET /api/tlrender/file serves it", ad.ok && ad.file === id + ".mp4" && Math.abs(ad.dur - 3) < 0.15 && fs.existsSync(path.join(pdir, "cache", "preview", id + ".mp4"))
      && !fs.existsSync(pv.master) && code === "200", { ad, code });
    const mv = await compile(base([V("grey.mp4", { fx: heavy })]), "the movie itself");
    if (mv && code === "200") {
      const a = gray(path.join(TMP, "pv.mp4"), 1, 32, 18), b = gray(mv.file, 1, 32, 18);
      let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
      check("...the preview IS the movie's picture (graded + vignetted alike, within 3 levels)", d <= 3 && a[9 * 32 + 16] < 110, { d, c: a[9 * 32 + 16] });
    }
  }
  check("a bad preview id is refused (400); adopting one never rendered = 404; a file outside cache/preview = 404",
    /hex digits/.test(api("/api/export", base([V("grey.mp4")], { preview: "../x" })).error || "") && /not there/.test(api("/api/tlrender/adopt", { id: "ffffffff" }).error || "")
    && /no such preview/.test(api("/api/tlrender/file/package.json").error || ""));

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
