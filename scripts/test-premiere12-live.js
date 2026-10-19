#!/usr/bin/env node
/* bitGen Studio — 2.417.0 LIVE: the bigger Premiere rows (part two) answered by the REAL app (H3_URL, default :8311)
 * with the REAL ffmpeg, then measured:
 *   1. 📤 deliverables in HDR10 (HEVC 10-bit, PQ) and HLG (AV1 10-bit); an HDR10 clip on the timeline tone-mapped
 *   2. ⇄ the timeline as an AAF (exports/, downloaded, read back with pyaaf2)
 *   3. 🔊 a reversed 2x clip's sound rendered for the canvas
 *   4. 🧩 motion graphics templates: the built-ins, place (pictures copied in), save / list / delete
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
const P = "zz_prem12_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem12_"));
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
  // the same grey as an HDR10 (PQ, BT.2020) file - what a phone / camera HDR clip is
  const hdrChain = "zscale=tin=bt709:pin=bt709:min=bt709:rin=tv:t=linear:npl=203:p=bt709,format=gbrpf32le,zscale=p=bt2020:t=smpte2084:m=bt2020nc:r=tv:npl=203,format=yuv420p10le";
  ff(["-f", "lavfi", "-i", "color=c=0x808080:s=320x180:r=25:d=3", "-vf", "format=yuv420p," + hdrChain, "-c:v", "libx265", "-x265-params", "log-level=error", "-pix_fmt", "yuv420p10le",
      "-color_primaries", "bt2020", "-color_trc", "smpte2084", "-colorspace", "bt2020nc", path.join(TMP, "hdrgrey.mp4")]);
  ff(["-f", "lavfi", "-i", "sine=f=440:d=2,apad=pad_dur=2", "-f", "lavfi", "-i", "testsrc=s=160x120:r=25:d=4", "-c:a", "aac", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", "-t", "4", path.join(TMP, "tone.mp4")]);
  execFileSync("python3", ["-c", "from PIL import Image; Image.new('RGBA', (200, 60), (200, 40, 40, 255)).save(" + JSON.stringify(path.join(TMP, "zz_bar.png")) + ")"]);
  for (const f of ["grey.mp4", "hdrgrey.mp4", "tone.mp4", "zz_bar.png"]) curl(["-X", "POST", "-F", "file=@" + path.join(TMP, f), URL_ + "/api/passets"]);
  const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", f], { encoding: "utf8" })).streams;
  const y10 = (f) => { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-frames:v", "1", "-vf", "format=yuv420p10le", "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 }); return b.readUInt16LE(2 * (90 * 320 + 160)); };

  /* ---- 1. HDR out + in */
  const q = await compile(base([V("grey.mp4")], { deliver: [{ preset: "h265_10", colour: "hdr10" }, { preset: "av1", colour: "hlg" }, { preset: "h264", colour: "hdr10" }] }), "deliverables in HDR10 / HLG");
  if (q) {
    const d = path.dirname(q.master || ""), st = path.basename(q.master || "", ".mp4");
    const hf = path.join(d, st + "_h265_10_hdr10.mp4"), af = path.join(d, st + "_av1_hlg.mp4"), sf = path.join(d, st + "_h264.mp4");
    const hs = fs.existsSync(hf) ? probe(hf)[0] : {}, as = fs.existsSync(af) ? probe(af)[0] : {};
    check("📤 HDR10: hevc 10-bit, PQ / BT.2020 tagged, the grey at its HDR level (≈ 429 of 1023); the log names it",
      hs.codec_name === "hevc" && hs.pix_fmt === "yuv420p10le" && hs.color_transfer === "smpte2084" && hs.color_primaries === "bt2020" && Math.abs(y10(hf) - 429) <= 8 && /HDR10 \(PQ, BT\.2020\)/.test(q.log), { hs, y: fs.existsSync(hf) && y10(hf) });
    check("📤 HLG: AV1 10-bit, arib-std-b67 tagged; an 8-bit H.264 asked for HDR stays SDR (named plain)",
      as.codec_name === "av1" && as.pix_fmt === "yuv420p10le" && as.color_transfer === "arib-std-b67" && fs.existsSync(sf) && probe(sf)[0].color_transfer !== "smpte2084", { as, sf: fs.existsSync(sf) });
  }
  const hin = await compile(base([V("hdrgrey.mp4")]), "an HDR10 clip on the timeline");
  if (hin) {
    const g = gray(hin.file, 1, 32, 18)[9 * 32 + 16];
    check("an HDR source is tone-mapped into the SDR master: the grey comes back grey (≈ 126, not washed out ≈ 90 or bright ≈ 170); the log says it", Math.abs(g - 126) <= 6 && /PQ HDR tone-mapped/.test(hin.log), { g, log: hin.log.slice(-600) });
  }

  /* ---- 2. AAF */
  const tl = { video: [{ name: "grey.mp4", src: "video", start: 0, in: 0.4, out: 2.4, dur: 3 }], audio: [{ name: "A1", clips: [{ name: "tone.mp4", src: "video", start: 1, in: 0, out: 2, dur: 4 }] }],
    images: [{ name: "I1", clips: [{ name: "zz_bar.png", start: 0, len: 2 }] }] };
  const ex = api("/api/interchange/export", { tl, format: "aaf", fps: 25, tc: { start: "10:00:00:00", fps: 25 }, name: "zz aaf" });
  check("⇄ POST /api/interchange/export format aaf: the .aaf in exports/, 1 picture + its sound + A1 (mono pairs), the still said", ex.ok && ex.file === "zz aaf.aaf" && ex.tracks.video === 1 && ex.tracks.audio >= 2
    && fs.existsSync(path.join(pdir, "exports", "zz aaf.aaf")) && /zz_bar\.png/.test(ex.notes.join()), ex);
  const code = curl(["-o", path.join(TMP, "dl.aaf"), "-w", "%{http_code}", URL_ + "/api/interchange/file/" + encodeURIComponent("zz aaf.aaf")]);
  let rb = null;
  try {
    rb = JSON.parse(execFileSync("python3", ["-c", `
import aaf2, json
with aaf2.open(${JSON.stringify(path.join(TMP, "dl.aaf"))}) as f:
    comp = list(f.content.toplevel())[0]
    out = []
    for s in comp.slots:
        seg = s.segment
        if seg.media_kind == "Timecode": out.append(["tc", seg.start]); continue
        out.append([s.name, seg.media_kind, [[type(c).__name__, c.length, getattr(c, "start", None)] for c in seg.components]])
    print(json.dumps(out))`], { encoding: "utf8" }));
  } catch (e) { rb = String(e.message || e).slice(0, 300); }
  check("...GET /api/interchange/file: the AAF downloads; read back: timecode 10:00:00:00, V1 = clip 50 frames from frame 10", code === "200" && Array.isArray(rb) && rb[0][1] === 900000
    && rb[1][1] === "Picture" && rb[1][2][0][0] === "SourceClip" && rb[1][2][0][1] === 50 && rb[1][2][0][2] === 10, { code, rb });
  check("...only .aaf files from exports/ (no path tricks)", /no such export/.test(api("/api/interchange/file/package.json").error || ""));

  /* ---- 3. the sound of a reversed clip */
  let w = api("/api/clipfx/retimesound", { name: "tone.mp4", in: 0, out: 4, dur: 4, fx: { speed: 2, reverse: true } });
  const first = w.state;
  for (let i = 0; i < 60 && w.state === "working"; i++) { await sleep(500); w = api("/api/clipfx/retimesound", { name: "tone.mp4", in: 0, out: 4, dur: 4, fx: { speed: 2, reverse: true } }); }
  const c2 = w.url ? curl(["-o", path.join(TMP, "rs.webm"), "-w", "%{http_code}", URL_ + w.url]) : "";
  const du = c2 === "200" ? +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(TMP, "rs.webm")], { encoding: "utf8" }) : 0;
  check("🔊 POST /api/clipfx/retimesound: working, then ready; the sound 2 s (2x), the silent end first, louder after", (first === "working" || first === "ready") && w.state === "ready" && c2 === "200" && Math.abs(du - 2) < 0.1
    && rms(path.join(TMP, "rs.webm"), 0.05, 0.8) < 0.01 && rms(path.join(TMP, "rs.webm"), 1.15, 1.9) > 0.05, { first, w, c2, du });
  check("...a straight clip is refused (it plays its own sound)", /not retimed/.test(api("/api/clipfx/retimesound", { name: "tone.mp4", in: 0, out: 4, fx: {} }).error || ""));

  /* ---- 4. motion graphics templates */
  const ls = api("/api/mogrt");
  check("🧩 GET /api/mogrt: the 4 built-ins (Lower third, Title card, End card, Corner tag) with their fields", ls.ok && ["lower-third", "title-card", "end-card", "corner-tag"].every((id) => (ls.templates || []).some((t) => t.id === id && t.builtin && t.fields.length)), ls);
  const pl = api("/api/mogrt/lower-third/place", {});
  check("...POST place: its picture copied into this project's images (mg_lower-third_lt_bar.png), the clip pointing at it", pl.ok && fs.existsSync(path.join(pdir, "images", "mg_lower-third_lt_bar.png"))
    && pl.template.layers[0].clips[0].name === "mg_lower-third_lt_bar.png" && pl.template.fields.map((f) => f.label).join() === "Name,Title", pl);
  const id = "zz-test-" + process.pid;
  const sv = api("/api/mogrt", { id, name: "ZZ test", w: 1920, h: 1080, layers: [{ name: "Bar", clips: [{ name: "zz_bar.png", start: 0, len: 3, tf: { x: 0, y: 0, scale: 1, rot: 0 } }] },
    { name: "T", text: true, clips: [{ start: 0.5, len: 2, text: { content: "Hello", size: 50 }, label: "Greeting" }] }] });
  const ls2 = api("/api/mogrt"), mine = (ls2.templates || []).find((t) => t.id === id);
  check("...POST /api/mogrt saves one (its picture kept with it); listed as saved, its field named", sv.ok && sv.pictures === 1 && mine && !mine.builtin && mine.fields[0].label === "Greeting"
    && fs.existsSync(path.join(ROOT, "mogrt", "user", id, "zz_bar.png")), { sv, mine });
  check("...a picture not in the project is refused; a built-in cannot be deleted", /not in this project/.test(api("/api/mogrt", { name: "x", layers: [{ name: "B", clips: [{ name: "nope.png", start: 0, len: 1 }] }] }).error || "")
    && /built-in/.test(JSON.parse(curl(["-X", "DELETE", URL_ + "/api/mogrt/title-card"]) || "{}").error || ""));
  const del = JSON.parse(curl(["-X", "DELETE", URL_ + "/api/mogrt/" + id]) || "{}");
  check("...DELETE removes a saved one (and its pictures)", del.ok && !fs.existsSync(path.join(ROOT, "mogrt", "user", id + ".json")) && !fs.existsSync(path.join(ROOT, "mogrt", "user", id)), del);
  try { fs.rmdirSync(path.join(ROOT, "mogrt", "user")); } catch { /* other saved templates */ }

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
