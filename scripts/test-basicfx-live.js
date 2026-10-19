#!/usr/bin/env node
/* bitGen Studio — 2.409.0 LIVE against the REAL app (H3_URL, default :8311) with the REAL ffmpeg (and the e2e's stub
 * ComfyUI for the LTX leg):
 *   1. Override style: an LTX job takes Basic Settings' steps (the sigma schedule re-drawn), cfg, seed, model, LoRAs -
 *      read back from the graph it queued; MiniMax H3 and Wan jobs carry them too; override off = as before
 *   2. ✨ effects compiled and measured: a green screen keyed over V1, a crop's see-through edge, blur, sharpen,
 *      vignette, glow, grain, stabilise
 *   3. an adjustment layer: grey for its second only, everything under it, nothing outside it
 * Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
 * ... continue with the premier close gap". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const P = "zz_bfx_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bfx_"));
let nb = 0;
const curl = (a) => execFileSync("curl", ["-s"].concat(a), { encoding: "utf8", maxBuffer: 64 << 20 });
const bodyArg = (b) => { const f = path.join(TMP, "b" + (nb++)); fs.writeFileSync(f, JSON.stringify(b)); return "@" + f; };
const api = (u, body) => { const t = curl(["-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", bodyArg(body)] : []), URL_ + u]); try { return JSON.parse(t || "{}"); } catch { return { raw: t }; } };
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function rgb(f, t, crop) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", (crop ? "crop=" + crop + "," : "") + "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
  const m = [0, 0, 0]; for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i]; return m.map((v) => v / (buf.length / 3));
}
function gray(f, t) { return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 }); }
function edges(f, t, w) { const g = gray(f, t); let s = 0; for (let i = 1; i < g.length; i++) if (i % w) s += Math.abs(g[i] - g[i - 1]); return s / g.length; }
function frameDiff(f, a, b) { const x = gray(f, a), y = gray(f, b); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; }
async function waitJob(id, secs) {
  let st = "";
  for (let i = 0; i < (secs || 240); i++) { const g = api("/api/jobs/" + id); st = g.status; if (st === "done" || st === "failed") break; await sleep(1000); }
  return api("/api/jobs/" + id + "?log_from=0");
}
async function compile(body, label) {
  const j = api("/api/export", body);
  if (!j.id) { check(label + ": accepted", false, j); return null; }
  const g = await waitJob(j.id);
  const out = g.output ? path.join(ROOT, "projects", P, g.output) : "";
  check(label + ": compiled", g.status === "done" && out && fs.existsSync(out), { st: g.status, log: String(g.log || "").slice(-900) });
  if (g.status !== "done") return null;
  const keep = path.join(TMP, "o" + (nb++) + ".mp4"); fs.copyFileSync(out, keep);
  return { file: keep, log: String(g.log || "") };
}
const V = (name, more) => Object.assign({ name, src: "video", in: 0, out: null, dur: 3, start: 0, opacity: 1 }, more || {});
const base = (v1, more) => Object.assign({ video: [v1], video_layers: [], audio: [[]], images: [[]], keep_original_audio: true }, more || {});
const layer = (c) => [{ name: "V2", muted: false, volume: 1, opacity: 1, clips: [c] }];

(async () => {
  api("/api/projects/new", { name: P });
  api("/api/projects/load", { name: P });
  const mk = (name, src) => { ff(["-f", "lavfi", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "12", "-t", "3", path.join(TMP, name)]); curl(["-X", "POST", "-F", "file=@" + path.join(TMP, name), URL_ + "/api/passets"]); };
  mk("bfred.mp4", "color=c=0xc02020:s=640x360:r=30:d=3");
  mk("bfgreen.mp4", "color=c=0x00ff00:s=640x360:r=30:d=3,drawbox=x=220:y=120:w=200:h=120:color=white:t=fill");
  mk("bfblue.mp4", "color=c=0x2040e0:s=640x360:r=30:d=3");
  mk("bfgrey.mp4", "color=c=0x808080:s=640x360:r=30:d=3,drawbox=x=280:y=150:w=80:h=60:color=white:t=fill");
  mk("bfsrc.mp4", "testsrc2=size=640x360:rate=30:duration=3");

  /* ---- 1. the override */
  const bas = { override: true, steps: 12, cfg: 2.5, seed: 4242, model: "ltx-custom.safetensors", loras: [{ path: "my_style.safetensors", weight: 0.7 }] };
  ff(["-f", "lavfi", "-i", "testsrc=size=640x360:duration=1", "-frames:v", "1", path.join(TMP, "face.png")]);
  const lt = JSON.parse(curl(["-X", "POST", "-F", "references=@" + path.join(TMP, "face.png"), "-F", "ltx_mode=i2v", "-F", "seconds=2", "-F", "width=640", "-F", "height=384",
    "-F", "seed=5", "-F", "prompt=The fox turns.", "-F", "ltx_engine=canvas", "-F", "basic=" + JSON.stringify(bas), URL_ + "/api/ltx"]) || "{}");
  const lp = lt.params || {};
  check("LTX job: Basic Settings' seed (not the box's 5), steps / cfg, model on the style, the LoRA added", lp.seed === 4242 && lp.basic && lp.basic.steps === 12 && lp.basic.cfg === 2.5
    && lp.video_style.phases[0].model === "ltx-custom.safetensors" && lp.video_style.loras.some((l) => l.path === "my_style.safetensors"), lt);
  if (lt.id) {
    const g = await waitJob(lt.id, 120);
    const L = String(g.log || "");
    const qf = path.join(ROOT, "workspace", "jobs", lt.id, "ltx_queued.json");
    const q = fs.existsSync(qf) ? JSON.parse(fs.readFileSync(qf, "utf8")) : {};
    const sig = Object.values(q).filter((n) => n.class_type === "ManualSigmas").map((n) => n.inputs.sigmas.split(",").length);
    const guid = Object.values(q).filter((n) => /CFGGuider/.test(n.class_type)).map((n) => n.inputs.cfg != null ? n.inputs.cfg : n.inputs.video_cfg);
    check("LTX graph: the main schedule re-drawn as 12 steps (13 sigmas), the guiders at 2.5, the LoRA + the model + seed 4242, said", g.status === "done" && sig.includes(13)
      && guid.length && guid.every((c) => c === 2.5) && /Basic Settings override \(LTX\): steps 12, cfg 2\.5, seed 4242/.test(L) && /steps 8 -> 12/.test(L) && /my_style\.safetensors @ 0\.7/.test(L)
      && /model: ltx-custom\.safetensors/.test(L), { st: g.status, sig, guid, log: L.slice(-1500) });
  }
  const lt0 = JSON.parse(curl(["-X", "POST", "-F", "references=@" + path.join(TMP, "face.png"), "-F", "ltx_mode=i2v", "-F", "seconds=2", "-F", "seed=5", "-F", "prompt=x",
    "-F", "basic=" + JSON.stringify(Object.assign({}, bas, { override: false })), URL_ + "/api/ltx"]) || "{}");
  check("LTX with Override style OFF: the box's seed, no steps / cfg, the style's own model", lt0.params && lt0.params.seed === 5 && !lt0.params.basic && lt0.params.video_style.phases[0].model !== "ltx-custom.safetensors", lt0.params);
  if (lt0.id) api("/api/jobs/" + lt0.id + "/cancel", {});
  const vs = api("/api/styles?kind=video");
  const VS = (vs.styles || vs || []);
  const h3 = VS.find((s) => s.arch === "minimax-h3" && !/swap|viggle/i.test(s.name)), wan = VS.find((s) => s.arch === "wan22") || VS.find((s) => s.arch === "wan21");
  const gen = (st) => JSON.parse(curl(["-X", "POST", "-F", "mode=t2va", "-F", "prompt=a fox", "-F", "width=640", "-F", "height=352", "-F", "steps=3", "-F", "cfg=4", "-F", "seed=1", "-F", "frames=48",
    "-F", "video_style_id=" + st.id, "-F", "basic=" + JSON.stringify(Object.assign({}, bas, { cfg: 1, model: "my-model.gguf" })), "-F", 'extra_loras=[{"path":"my_style.safetensors","weight":0.7}]', URL_ + "/api/generate"]) || "{}");
  if (h3) {
    const r = gen(h3), p = r.params || {};
    check("MiniMax H3 job: steps 12 / cfg 1 / seed 4242 from Basic Settings, its model on phase 1, the LoRA", p.steps === 12 && p.cfg === 1 && p.seed === 4242 && p.video_style.phases[0].model === "my-model.gguf"
      && p.video_style.loras.some((l) => l.path === "my_style.safetensors"), p);
    if (r.id) api("/api/jobs/" + r.id + "/cancel", {});
  }
  if (wan) {
    const r = gen(wan), p = r.params || {};
    check("Wan job: steps 12, cfg 1 kept (the override's), seed 4242, the model as it is, the LoRA", p.mode === "wan" && p.steps === 12 && p.cfg === 1 && p.seed === 4242 && p.basic_model === "my-model.gguf"
      && p.video_style.loras.some((l) => l.path === "my_style.safetensors"), p);
    if (r.id) api("/api/jobs/" + r.id + "/cancel", {});
  }

  /* ---- 2. effects */
  const red = rgb.bind(null);
  const key = await compile(base(V("bfred.mp4"), { video_layers: layer(V("bfgreen.mp4", { fx: { vfx: { key: { color: "#00ff00", similarity: 0.15, blend: 0.05, spill: 0.5 } } } })) }), "key");
  if (key) {
    const corner = rgb(key.file, 1, "100:80:10:10"), mid = rgb(key.file, 1, "120:80:260:140");
    check("key: the green screen gone - V1's red shows through it, the white box stays", corner[0] > 150 && corner[1] < 70 && mid.every((v) => v > 200), { corner, mid });
    check("key: the worker says it", /effects: keyed #00ff00/.test(key.log), key.log.slice(-500));
  }
  const crop = await compile(base(V("bfred.mp4"), { video_layers: layer(V("bfblue.mp4", { fx: { vfx: { crop: { l: 50, t: 0, r: 0, b: 0 } } } })) }), "crop");
  if (crop) {
    const left = rgb(crop.file, 1, "200:300:20:30"), right = rgb(crop.file, 1, "200:300:420:30");
    check("crop 50 % left: that half see-through (V1's red), the right half still the layer's blue, in place", left[0] > 150 && left[2] < 90 && right[2] > 180 && right[0] < 90, { left, right });
  }
  const plainS = await compile(base(V("bfsrc.mp4")), "plain testsrc2");
  const blur = await compile(base(V("bfsrc.mp4", { fx: { vfx: { blur: 20 } } })), "blur 20");
  const sharp = await compile(base(V("bfsrc.mp4", { fx: { vfx: { sharpen: 2 } } })), "sharpen 2");
  if (plainS && blur && sharp) {
    const e0 = edges(plainS.file, 1, 640), e1 = edges(blur.file, 1, 640), e2 = edges(sharp.file, 1, 640);
    check("blur softens the edges, sharpen hardens them", e1 < e0 * 0.6 && e2 > e0 * 1.05, { plain: e0, blur: e1, sharp: e2 });
  }
  const plainG = await compile(base(V("bfgrey.mp4")), "plain grey");
  const vig = await compile(base(V("bfgrey.mp4", { fx: { vfx: { vignette: 1 } } })), "vignette");
  const glow = await compile(base(V("bfgrey.mp4", { fx: { vfx: { glow: 1 } } })), "glow");
  const grain = await compile(base(V("bfgrey.mp4", { fx: { vfx: { grain: 1 } } })), "grain");
  const stab = await compile(base(V("bfsrc.mp4", { fx: { vfx: { stabilise: true } } })), "stabilise");
  if (plainG && vig) {
    const c = rgb(vig.file, 1, "40:40:0:0")[0], m = rgb(vig.file, 1, "40:40:300:30")[0], c0 = rgb(plainG.file, 1, "40:40:0:0")[0];
    check("vignette: the corners darker (than the plain one and than the top middle)", c < c0 - 20 && c < m - 5, { c, m, c0 });
  }
  if (plainG && glow) {
    const r0 = rgb(plainG.file, 1, "40:30:230:165")[0], r1 = rgb(glow.file, 1, "40:30:230:165")[0];
    check("glow: the grey around the white box lifted", r1 > r0 + 10, { r0, r1 });
  }
  if (plainG && grain) check("grain: the picture moves frame to frame (the plain one does not)", frameDiff(grain.file, 1, 1.034) > 2 && frameDiff(plainG.file, 1, 1.034) < 0.8,
    [frameDiff(grain.file, 1, 1.034), frameDiff(plainG.file, 1, 1.034)]);
  if (stab) check("stabilise: compiled, said", /effects: stabilised/.test(stab.log), stab.log.slice(-400));

  /* ---- 3. an adjustment layer */
  const ad = api("/api/effects/adjustment", {});
  check("POST /api/effects/adjustment makes the placeholder picture", ad.ok && fs.existsSync(path.join(ROOT, "projects", P, "images", "adjustment.png")), ad);
  const adj = await compile(base(V("bfsrc.mp4"), { images: [{ clips: [{ name: "adjustment.png", start: 1, len: 1, opacity: 1, adjust: true, fx: { grade: { saturation: 0 }, vfx: { blur: 20 } } }] }] }), "adjustment layer");
  if (adj && plainS) {
    // per-pixel saturation (max - min of each pixel's RGB), averaged
    const sat = (f, t) => { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
      let s = 0; for (let i = 0; i < b.length; i += 3) s += Math.max(b[i], b[i + 1], b[i + 2]) - Math.min(b[i], b[i + 1], b[i + 2]); return s / (b.length / 3); };
    const a0 = sat(adj.file, 0.5), a1 = sat(adj.file, 1.5), a2 = sat(adj.file, 2.5);
    check("adjustment layer: grey (+ blurred) for its second only - colourful before and after", a1 < 4 && a0 > 40 && a2 > 40 && edges(adj.file, 1.5, 640) < edges(plainS.file, 1.5, 640) * 0.8,
      { a0, a1, a2 });
    check("adjustment layer: the worker says it", /adjustment layer 1\.00-2\.00s: graded, blur 20/.test(adj.log), adj.log.slice(-500));
  }
  void red;
})().catch((e) => { fail++; console.log("FAIL: crashed " + (e.stack || e)); }).finally(() => {
  try { api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
