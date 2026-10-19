#!/usr/bin/env node
/* bitGen Studio — 2.410.0 LIVE: 📤 In / Out only, 🖼 Export frame and markers through ⇄ Exchange, answered by the REAL
 * app (H3_URL, default :8311) with the REAL ffmpeg, then measured.
 * Tim: "continue with the next stages of the premier gap closure".
 *   1. one compile with the In / Out part (1 s - 3 s) of a 4 s movie: every deliverable is that part only
 *      (<project>_<name>_io.<ext>, 2.0 s), its first frame = the master's frame at 1 s, its timecode moved on 1 s, its
 *      .srt cut + shifted; the master stays whole
 *   2. POST /api/deliver/still: a PNG saved by its timecode, listed + downloadable; not a PNG -> refused
 *   3. ⇄ the markers out through the route's FCP XML / EDL / OTIO and back in
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem5_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem5_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body, raw) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, raw ? body : JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration:format_tags=timecode:stream_tags=timecode", "-of", "json", f], { encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}
const tcOf = (pr) => ((pr.format || {}).tags || {}).timecode || ((pr.streams || []).map((s) => (s.tags || {}).timecode).find(Boolean)) || "";
const dur = (pr) => +((pr.format || {}).duration || 0);
function lumaAt(f, t) {
  if (!fs.existsSync(f)) return NaN;
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
  let s = 0; for (const v of buf) s += v; return s / buf.length;
}
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  let st = "";
  for (let i = 0; i < 300; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = api("/api/jobs/" + j.id + "?log_from=0");
  const log = [].concat(g.log || []).join("\n"), out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", st === "done" && out && fs.existsSync(out), { st, log: log.slice(-900) });
  return st === "done" ? { master: out, log } : null;
}

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  // 4 s of grey that brightens (so a frame tells its time) + a tone
  ff(["-f", "lavfi", "-i", "color=c=gray:s=640x360:r=30:d=4,geq=lum='30+40*T':cb=128:cr=128", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", path.join(TMP, "p5.mp4")]);
  curl(["-X", "POST", "-F", "file=@" + path.join(TMP, "p5.mp4"), URL_ + "/api/passets"]);
  const clip = { name: "p5.mp4", src: "video", in: 0, out: null, dur: 4, start: 0, opacity: 1 };
  const caps = { cues: [{ start: 0.5, end: 1.5, text: "early" }, { start: 2, end: 2.5, text: "inside" }, { start: 3.5, end: 3.9, text: "late" }], burn: false, srt: true };

  /* ---- 1. In / Out only */
  const q = await compile({ video: [clip], video_layers: [], audio: [[]], images: [[]], keep_original_audio: true, captions: caps,
    deliver: [{ preset: "h264" }, { preset: "wav" }], tc: { start: "01:00:00:00", fps: 30 }, deliverRange: "io", sel: { a: 1, b: 3 } }, "In / Out export");
  if (q) {
    const st = path.basename(q.master, ".mp4");
    const io = path.join(pdir, st + "_h264_io.mp4"), wav = path.join(pdir, st + "_wav_io.wav");
    const pm = probe(q.master), pi = probe(io), pw = probe(wav);
    check("the master is the whole movie (4 s); the log says In / Out only 1.00-3.00 s", Math.abs(dur(pm) - 4) < 0.15 && /In \/ Out only: 1\.00-3\.00 s/.test(q.log), [dur(pm), q.log.slice(-500)]);
    check("<project>_h264_io.mp4 + <project>_wav_io.wav: 2.0 s each (the part only)", fs.existsSync(io) && Math.abs(dur(pi) - 2) < 0.12 && fs.existsSync(wav) && Math.abs(dur(pw) - 2) < 0.06, [dur(pi), dur(pw)]);
    const l0 = lumaAt(io, 0.05), m1 = lumaAt(q.master, 1.05), m0 = lumaAt(q.master, 0.05);
    check("...its first frame is the master's at 1 s (not at 0 s)", Math.abs(l0 - m1) < 6 && Math.abs(l0 - m0) > 15, { l0, m1, m0 });
    check("...its timecode starts where the part starts (01:00:01:00)", tcOf(pi) === "01:00:01:00", tcOf(pi));
    const srt = io.replace(/\.mp4$/, ".srt");
    const s = fs.existsSync(srt) ? fs.readFileSync(srt, "utf8") : "";
    check("...its .srt holds the part's captions, shifted: the cue across In clipped to it, the one inside moved 1 s earlier, the one after Out dropped",
      s === "1\n00:00:00,000 --> 00:00:00,500\nearly\n\n2\n00:00:01,000 --> 00:00:01,500\ninside\n", s);
    const lst = api("/api/deliver/files");
    check("GET /api/deliver/files lists the _io deliverables", (lst.files || []).some((f) => f.name === st + "_h264_io.mp4") && (lst.files || []).some((f) => f.name === st + "_wav_io.wav"), lst);
  }
  /* the whole movie again (no range): plain names */
  const q2 = await compile({ video: [clip], video_layers: [], audio: [[]], images: [[]], keep_original_audio: true, deliver: [{ preset: "wav" }], deliverRange: "all", sel: { a: 1, b: 3 } }, "whole-movie export");
  if (q2) {
    const st = path.basename(q2.master, ".mp4"), w = path.join(pdir, st + "_wav.wav");
    check("Range = the whole movie: <project>_wav.wav, 4 s (the selection ignored)", fs.existsSync(w) && Math.abs(dur(probe(w)) - 4) < 0.06, fs.readdirSync(pdir));
  }

  /* ---- 2. 🖼 Export frame */
  const png = path.join(TMP, "f.png");
  ff(["-f", "lavfi", "-i", "color=c=0x336699:s=640x360", "-frames:v", "1", png]);
  const sv = JSON.parse(curl(["-X", "POST", "-H", "Content-Type: image/png", "--data-binary", "@" + png, URL_ + "/api/deliver/still?t=3.2&fps=25"]) || "{}");
  check("POST /api/deliver/still: <project>_frame_00h00m03s05.png beside the movies, the bytes as sent", sv.ok && sv.name === P + "_frame_00h00m03s05.png"
    && fs.existsSync(path.join(pdir, sv.name)) && fs.readFileSync(path.join(pdir, sv.name)).equals(fs.readFileSync(png)), sv);
  check("...listed under the delivered files and downloadable", (api("/api/deliver/files").files || []).some((f) => f.name === sv.name)
    && curl(["-o", "/dev/null", "-w", "%{http_code}", URL_ + "/api/deliver/file/" + encodeURIComponent(sv.name)]) === "200");
  const bad = JSON.parse(curl(["-X", "POST", "-H", "Content-Type: image/png", "--data-binary", "not a picture at all, just words that go on for a while", URL_ + "/api/deliver/still?t=1"]) || "{}");
  check("...not a PNG -> refused in words (400)", !bad.ok && /not a PNG/.test(bad.error || ""), bad);

  /* ---- 3. markers through ⇄ */
  const tl = { video: [{ name: "p5.mp4", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }], v1: { name: "V1" }, vlayers: [], audio: [], images: [],
               seqMarkers: [{ t: 1, name: "Verse", color: "red", note: "first" }, { t: 2.5, name: "Chorus", color: "cyan" }] };
  const textApi = (u, text) => { const t = curl(["-X", "POST", "-H", "Content-Type: text/plain", "--data-binary", bodyArg(text, true), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
  const ex = (format) => textApi("/api/interchange/export", JSON.stringify({ tl, format, fps: 25, tc: { start: "01:00:00:00", fps: 25 }, name: "Marks" }));
  const tx = ex("fcpxml").text || "", te = ex("edl").text || "", to = ex("otio").text || "";
  check("⇄ FCP XML out carries the markers", /<marker><name>Verse<\/name><comment>first<\/comment><in>25<\/in><out>-1<\/out><color>red<\/color><\/marker>/.test(tx) && /<in>63<\/in>/.test(tx), tx.slice(0, 400));
  check("⇄ EDL out: * LOC: lines (record timecode, colour, name)", /\* LOC: 01:00:01:00 RED\s+Verse/.test(te) && /\* LOC: 01:00:02:13 CYAN\s+Chorus/.test(te), te);
  check("⇄ OTIO out: Marker.2 on the stack", /"Marker\.2"/.test(to) && /"CYAN"/.test(to), to.slice(0, 300));
  const bx = textApi("/api/interchange/import?filename=marks.xml&fps=25", tx), be = textApi("/api/interchange/import?filename=marks.edl&fps=25", te);
  const mx = (bx.tl || {}).seqMarkers || [], me = (be.tl || {}).seqMarkers || [];
  check("⇄ XML / EDL back in: the markers return (time to the frame, name, colour; the XML's comment)", mx.length === 2 && mx[0].name === "Verse" && mx[0].note === "first"
    && mx[0].color === "red" && Math.abs(mx[1].t - 2.52) < 0.01 && me.length === 2 && me[1].name === "Chorus" && me[1].color === "cyan" && Math.abs(me[0].t - 1) < 1e-6, { mx, me });

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
