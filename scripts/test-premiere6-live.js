#!/usr/bin/env node
/* bitGen Studio — 2.411.0 LIVE: 📤 MP4 · AV1 and MP4 · H.265 10-bit from the REAL app (H3_URL, default :8311) with the
 * REAL ffmpeg, then measured with ffprobe; ⚡ the graphics card's encoder asked for where none works -> the software
 * encoder, said in the log (never a failed export).
 * Tim: "yes please and any premier leftovers that you can do comfortably". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_prem6_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "prem6_"));
let nb = 0;
const curl = (args) => execFileSync("curl", ["-s"].concat(args), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bodyArg = (body) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(body)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,codec_tag_string,pix_fmt,width,height:format=duration:format_tags=timecode:stream_tags=timecode", "-of", "json", f], { encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}
const vs = (pr) => (pr.streams || []).find((s) => s.codec_type === "video") || {};
const as = (pr) => (pr.streams || []).find((s) => s.codec_type === "audio") || {};
const tcOf = (pr) => ((pr.format || {}).tags || {}).timecode || ((pr.streams || []).map((s) => (s.tags || {}).timecode).find(Boolean)) || "";
const dur = (pr) => +((pr.format || {}).duration || 0);

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const pdir = path.join(ROOT, "projects", P);
  ff(["-f", "lavfi", "-i", "color=c=gray:s=640x360:r=30:d=2,geq=lum='30+60*T':cb=128:cr=128", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", path.join(TMP, "p6.mp4")]);
  curl(["-X", "POST", "-F", "file=@" + path.join(TMP, "p6.mp4"), URL_ + "/api/passets"]);
  const clip = { name: "p6.mp4", src: "video", in: 0, out: null, dur: 2, start: 0, opacity: 1 };
  const j = api("/api/export", { video: [clip], video_layers: [], audio: [[]], images: [[]], keep_original_audio: true,
    deliver: [{ preset: "av1", quality: "small" }, { preset: "h265_10" }], tc: { start: "01:00:00:00", fps: 30 }, deliverHw: true });
  if (!j.id) check("accepted", false, j);
  let st = "";
  for (let i = 0; j.id && i < 400; i++) { const g = api("/api/jobs/" + j.id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  const g = j.id ? api("/api/jobs/" + j.id + "?log_from=0") : {};
  const log = [].concat(g.log || []).join("\n"), out = g.output ? path.join(pdir, g.output) : "";
  check("compiled (with ⚡ the graphics card asked for)", st === "done" && out && fs.existsSync(out), { st, log: log.slice(-900) });
  if (st === "done") {
    const stem = path.basename(out, ".mp4");
    const fa = path.join(pdir, stem + "_av1.mp4"), fh = path.join(pdir, stem + "_h265_10.mp4");
    const pa = probe(fa), ph = probe(fh);
    check("<project>_av1.mp4: AV1 video, AAC sound, 2 s, the timecode", fs.existsSync(fa) && vs(pa).codec_name === "av1" && as(pa).codec_name === "aac" && Math.abs(dur(pa) - 2) < 0.15 && tcOf(pa) === "01:00:00:00", pa);
    check("<project>_h265_10.mp4: HEVC 10-bit (yuv420p10le, hvc1), AAC, 2 s, the timecode", fs.existsSync(fh) && vs(ph).codec_name === "hevc" && vs(ph).pix_fmt === "yuv420p10le"
      && vs(ph).codec_tag_string === "hvc1" && as(ph).codec_name === "aac" && Math.abs(dur(ph) - 2) < 0.15 && tcOf(ph) === "01:00:00:00", ph);
    const hwSaid = log.match(/export \d\/2 [^\n]*(graphics card's \w+|no graphics-card encoder works here - [\w-]+ \(software\))/g) || [];
    const usedCard = hwSaid.filter((l) => /graphics card's/.test(l)).length;
    check("the log says, for each, which encoder ⚡ got: the card's, or none works here -> the software one (" + (usedCard ? "a card here" : "no card here") + ")",
      hwSaid.length === 2 && (usedCard ? true : hwSaid.every((l) => /\(software\)/.test(l)) && /libx265/.test(log)), { hwSaid, tail: log.slice(-700) });
    const lst = api("/api/deliver/files");
    check("GET /api/deliver/files lists both", (lst.files || []).some((f) => f.name === stem + "_av1.mp4") && (lst.files || []).some((f) => f.name === stem + "_h265_10.mp4"), lst);
  }
  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
