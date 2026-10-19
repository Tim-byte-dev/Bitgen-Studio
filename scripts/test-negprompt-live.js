#!/usr/bin/env node
/* bitGen Studio — 2.419.0 LIVE: the ⊖ negative prompt reaches the jobs of the REAL app (H3_URL, default :8311):
 * /api/generate (MiniMax H3 -> negative_prompt; a Wan style -> negative), /api/ltx (an LTX style -> negative),
 * /api/genimage (an image style -> negative), and nothing is sent / used when the docker is empty (the style's own).
 * The jobs are cancelled straight away - only their parameters are checked.
 * Tim: "use negative prompts with models that accept it". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_negp_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "negp_"));
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
  const form = (u, fields) => { const a = ["-X", "POST"]; for (const [k, v] of Object.entries(fields)) a.push("-F", k + "=" + v); a.push(URL_ + u); const t = curl(a); try { return JSON.parse(t); } catch { return { raw: t }; } };
  const cancel = (id) => { if (id) try { curl(["-X", "POST", URL_ + "/api/jobs/" + id + "/cancel"]); } catch { /* fine */ } };
  const params = (id) => (api("/api/jobs/" + id).params || {});
  const NEG = "blurry, extra fingers, watermark";

  const h3 = form("/api/generate", { mode: "t2va", prompt: "a fox in the snow", cfg: "3", width: "192", height: "108", frames: "25", negative: NEG });
  const h3p = h3.id ? params(h3.id) : {}; cancel(h3.id);
  const h3b = form("/api/generate", { mode: "t2va", prompt: "a fox in the snow", width: "192", height: "108", frames: "25" });
  const h3bp = h3b.id ? params(h3b.id) : {}; cancel(h3b.id);
  check("/api/generate (MiniMax H3): the negative -> negative_prompt (used by true CFG at cfg > 1); none sent = none set", h3p.negative_prompt === NEG && h3p.cfg === 3 && h3bp.negative_prompt === undefined, { h3p: { n: h3p.negative_prompt, cfg: h3p.cfg, e: h3.error }, h3bp: h3bp.negative_prompt });

  const vs = (api("/api/styles?kind=video").styles || api("/api/styles?kind=video") || []);
  const list = Array.isArray(vs) ? vs : (vs.styles || []);
  const wanSt = list.find((s) => /wan/i.test(String(s.arch || ""))), ltxSt = list.find((s) => s.ltx || /ltx/i.test(String(s.arch || "")));
  if (wanSt) {
    const w = form("/api/generate", { mode: "t2va", prompt: "a fox in the snow", width: "832", height: "480", frames: "49", video_style_id: wanSt.id, negative: NEG });
    const wp = w.id ? params(w.id) : {}; cancel(w.id);
    const w0 = form("/api/generate", { mode: "t2va", prompt: "a fox in the snow", width: "832", height: "480", frames: "49", video_style_id: wanSt.id });
    const wp0 = w0.id ? params(w0.id) : {}; cancel(w0.id);
    check("/api/generate with a Wan style: the docker's negative beats the style's; empty = the style's own (" + wanSt.name + ")", wp.negative === NEG && wp0.negative === String(wanSt.negative || ""), { wp: wp.negative, wp0: wp0.negative, e: w.error || w0.error });
  } else check("a Wan style to try (skipped: none in this install)", true);
  if (ltxSt) {
    const l = form("/api/ltx", { prompt: "a fox in the snow", seconds: "2", width: "512", height: "320", seed: "1", video_style_id: ltxSt.id, ltx_mode: "t2v", negative: NEG });
    const lp = l.id ? params(l.id) : (l.params || {}); cancel(l.id);
    check("/api/ltx with an LTX style: the negative in the job (" + ltxSt.name + ")", lp.negative === NEG, { lp: lp.negative, e: l.error });
  } else check("an LTX style to try (skipped: none in this install)", true);

  const is = api("/api/styles?kind=image");
  const ilist = Array.isArray(is) ? is : (is.styles || []);
  const sd = ilist.find((s) => s.arch === "sdxl") || ilist[0];
  if (sd) {
    const g = api("/api/genimage", { prompt: "a fox in the snow", style_id: sd.id, negative: NEG, batch: 1 });
    const id = g.id || (g.jobs && g.jobs[0] && g.jobs[0].id);
    const gp = id ? params(id) : {}; cancel(id);
    check("/api/genimage: the negative in the image job (" + sd.name + ")", gp.negative === NEG, { gp: gp.negative, g: JSON.stringify(g).slice(0, 200) });
  } else check("an image style to try (skipped)", true);

  api("/api/projects/load", { name: "default" });
  try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
