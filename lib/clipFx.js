// bitGen Studio — lib/clipFx.js (2.406.0): a clip's speed / reverse / ramp, colour grade + LUT and sound clean-up on
// the server side. The maths is static/clipfx.js (UMD - the same file the page runs), re-exported here, plus:
//   LUT library   <project>/luts/*.cube (this project) and the app's luts/ (every project): list(), read(name),
//                 save(name, text) - checked by parsing it
//   forJob(fx, c) the compile's view of one clip: the normalized fx + the played segments (what
//                 scripts/clipfx_render.py renders) + the grade baked into ONE .cube (<project>/temp/grades/<hash>.cube)
//                 + the clip's timeline length (tl_len) for the span
// routes/clipfx.js serves the library; routes/index.js /api/export calls forJob for every video clip.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const FX = require("../static/clipfx.js");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const SAFE = (name) => path.basename(String(name || "")).replace(/[^A-Za-z0-9 ._()&+-]+/g, "_").slice(0, 120);

function dirs() {
  const c = core();
  const out = [];
  try { out.push(path.join(c.projDir(c.getProject()), "luts")); } catch { /* no project */ }
  out.push(path.join(c.BASE || path.join(__dirname, ".."), "luts"));
  return out;
}
/** every .cube the library has: [{name, where: "project" | "app"}] (a project's own wins a name clash) */
function list() {
  const seen = new Set(), out = [];
  dirs().forEach((d, i) => {
    let names = [];
    try { names = fs.readdirSync(d).filter((f) => /\.cube$/i.test(f)).sort((a, b) => a.localeCompare(b)); } catch { names = []; }
    for (const n of names) if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ name: n, where: i === 0 ? "project" : "app" }); }
  });
  return out;
}
function lutPath(name) {
  const n = SAFE(name);
  if (!/\.cube$/i.test(n)) return null;
  for (const d of dirs()) { const p = path.join(d, n); if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  return null;
}
function read(name) {
  const p = lutPath(name);
  if (!p) throw bad("no LUT called " + name + " - import it first (🎨 Colour -> ＋ LUT)", 404);
  return fs.readFileSync(p, "utf8");
}
/** a .cube into this project's luts/ (checked by parsing it); `app` = the app's luts/ for every project */
function save(name, text, app) {
  let n = SAFE(name);
  if (!/\.cube$/i.test(n)) n += ".cube";
  const L = FX.parseCube(text);                           // throws in words when it is not a 3D .cube
  const d = dirs()[app ? dirs().length - 1 : 0];
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, n), String(text));
  return { name: n, size: L.size, where: app ? "app" : "project" };
}

const cache = new Map();
/** the look baked into one .cube on disk (cached by its key) -> the file's absolute path */
function bakedLut(fx) {
  const key = FX.lookKey(fx);
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  const c = core();
  const d = path.join(c.projDir(c.getProject()), "temp", "grades");
  const f = path.join(d, hash + ".cube");
  if (cache.get(f) === key && fs.existsSync(f)) return f;
  let user = null;
  if (fx.lut) user = FX.parseCube(read(fx.lut));
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(f, FX.toCube(FX.buildLut(fx, user, FX.LUT_SIZE), FX.LUT_SIZE, "bitGen " + (fx.look || "grade")));
  cache.set(f, key);
  return f;
}

/** the compile's view of a clip's fx. c = the clip as the route maps it ({in, out, dur}). null = plain clip */
function forJob(fxIn, c) {
  const fx = FX.normalize(fxIn);
  if (!fx) return null;
  const i0 = +c.in || 0;
  const o0 = c.out != null ? +c.out : (c.dur != null ? +c.dur : null);
  const out = Object.assign({}, fx);
  if (FX.retimed(fx)) {
    if (o0 == null) throw bad("a retimed clip needs its length (trim it once on the timeline) - " + (c.name || "a clip"));
    const L = Math.max(0, o0 - i0);
    out.segments = FX.segments(L, fx).map((s) => Object.assign({ q0: +s.q0.toFixed(4), q1: +s.q1.toFixed(4), s: +s.s.toFixed(4) },
      fx.remap ? { d: +(s.t1 - s.t0).toFixed(4) } : {}));          // 2.501.0: a time remap's pieces carry their timeline length (s < 0 back, 0 a freeze)
    out.tl_len = +FX.timelineLen(L, fx).toFixed(4);
  }
  if (FX.graded(fx)) out.lut_file = bakedLut(fx);
  return out;
}
/** an audio clip's clean-up only ({denoise, voice, gain}) or null */
function afxOnly(fxIn) { const fx = FX.normalize({ afx: fxIn && fxIn.afx ? fxIn.afx : fxIn }); return fx ? fx.afx : null; }

const ROLES = ["voice", "music", "sfx"];
/** a layer / clip role for the mix (scripts/mixfx.py) - anything else falls back to `dflt` */
function role(v, dflt) { return ROLES.includes(v) ? v : dflt; }

/** 2.516.0: ◇ KEYFRAMES ON ANY PROPERTY (static/anykeys.js forCompile, sent as c.ak): the effects' keys made safe ->
 *  {vfx: [{at, lens, warp_amount|size|speed, key_similarity|blend|spill}], grade: [{at, fx}], warp_type} or null */
const AKV = { lens: [-100, 100], warp_amount: [0, 100], warp_size: [5, 100], warp_speed: [0, 5], key_similarity: [0.01, 0.5], key_blend: [0, 0.5], key_spill: [0, 1] };
function cleanAk(ak) {
  if (!ak || typeof ak !== "object") return null;
  const out = {};
  if (Array.isArray(ak.vfx)) {
    const v = ak.vfx.slice(0, 400).filter((k) => k && Number.isFinite(+k.at) && +k.at >= 0).map((k) => {
      const o = { at: Math.round(+k.at * 10000) / 10000 };
      for (const q of Object.keys(AKV)) if (k[q] != null && Number.isFinite(+k[q])) o[q] = Math.min(AKV[q][1], Math.max(AKV[q][0], +k[q]));
      return o;
    }).filter((k) => Object.keys(k).length > 1).sort((a, b) => a.at - b.at);
    if (v.length) out.vfx = v;
  }
  if (ak.warp_type === "wave" || ak.warp_type === "twirl") out.warp_type = ak.warp_type;
  if (Array.isArray(ak.grade)) {
    const g = ak.grade.slice(0, 24).filter((k) => k && Number.isFinite(+k.at) && +k.at >= 0 && k.fx && typeof k.fx === "object").sort((a, b) => a.at - b.at);
    if (g.length >= 2) out.grade = g;
  }
  return Object.keys(out).length ? out : null;
}
/** the keyed effects into the compile's fx: vfx.kf gets the effects' keys; lut_keys = the look re-made at the colour keys */
function withAk(fx, ak) {
  const out = fx ? Object.assign({}, fx) : {};
  if (ak.vfx) {
    const v = out.vfx = Object.assign({}, out.vfx || {});
    if (ak.vfx.some((k) => k.warp_amount != null || k.warp_size != null || k.warp_speed != null) && !v.warp && ak.warp_type)
      v.warp = { type: ak.warp_type, amount: 0, size: ak.warp_type === "wave" ? 20 : 60, speed: 0 };
    const kf = (v.kf || []).map((k) => Object.assign({}, k));
    for (const k of ak.vfx) { const same = kf.find((x) => Math.abs(x.at - k.at) < 1e-3); if (same) Object.assign(same, k); else kf.push(Object.assign({}, k)); }
    v.kf = kf.sort((a, b) => a.at - b.at);
  }
  if (ak.grade) {
    out.lut_keys = ak.grade.map((k) => ({ at: +k.at, file: bakedLut(FX.normalize(k.fx) || {}) }));
    if (!out.lut_file) out.lut_file = out.lut_keys[0].file;
  }
  return out;
}

/** the keys /api/export adds to a VIDEO clip (V1 or a layer's): {fx, tl_len} or {} - c = what the page sent */
function clipKeys(c) {
  if (!c || (!c.fx && !c.ak)) return {};
  let fx = c.fx ? forJob(c.fx, { in: Math.max(0, +c.in || 0), out: +c.out || null, dur: +c.dur || null, name: c.name }) : null;
  const ak = cleanAk(c.ak);                                    // 2.516.0
  if (ak) fx = withAk(fx, ak);
  if (!fx || !Object.keys(fx).length) return {};
  const out = { fx };
  if (fx.tl_len != null) { out.tl_len = fx.tl_len; delete fx.tl_len; }
  return out;
}
/** the keys /api/export adds to a SOUND clip: its clean-up ({fx: {afx}}) and its role (a sound track defaults to music) */
function soundKeys(c) {
  const out = { role: role(c && c.role, "music") };
  const a = afxOnly(c && c.fx);
  if (a) out.fx = { afx: a };
  return out;
}
/** tl.mix as the worker reads it: {duck: {on, amount}, loudness: {on, target}} or null when both are off */
function mixCfg(m) {
  if (!m || typeof m !== "object") return null;
  const d = m.duck || {}, l = m.loudness || {};
  const num = (v, a, b, dflt) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : dflt; };
  const out = { duck: { on: !!d.on, amount: num(d.amount, 3, 30, 12) },
                loudness: { on: !!l.on, target: num(l.target, -30, -6, -14) } };
  return out.duck.on || out.loudness.on ? out : null;
}

/** the 🎧 preview: `secs` of a clip's sound from `at` - first as it is, then cleaned up (scripts/clipfx_render.py
 *  preview, so it is the compile's own filters) -> the wav's path (in the OS temp folder; the route deletes it) */
function afxPreview(o) {
  const { spawnSync } = require("child_process");
  const os = require("os");
  const c = core();
  const src = require("./asr").findAsset(o && o.name);
  if (!src) throw bad("not in this project: " + ((o && o.name) || "(none)"), 404);
  const afx = afxOnly(o && o.afx) || {};
  const out = path.join(os.tmpdir(), "h3afx_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".wav");
  const py = ((c.getConfig().paths || {}).python) || (process.platform === "win32" ? "python" : "python3");
  const r = spawnSync(py, [path.join(c.resolvePath("scripts"), "clipfx_render.py"), "preview", src,
    String(Math.max(0, +(o && o.at) || 0)), String(Math.max(0.5, Math.min(30, +(o && o.secs) || 6))), JSON.stringify(afx), out],
  { encoding: "utf8", timeout: 120000 });
  if (r.status !== 0 || !fs.existsSync(out))
    throw bad("the preview could not be made: " + (String(r.stderr || (r.error && r.error.message) || "").trim().split("\n").pop() || "ffmpeg failed"), 500);
  return out;
}

/** 2.409.0: an ADJUSTMENT LAYER clip (a picture-layer clip marked adjust) -> {adjust: {lut_file, vfx}} for worker.py
 *  (applied to everything under it while it is on the timeline) or {} */
function adjustKeys(c) {
  if (!c || !c.adjust) return {};
  const fx = FX.normalize(c.fx) || {};
  const out = {};
  if (FX.graded(fx)) out.lut_file = bakedLut(fx);
  if (fx.vfx) {
    const v = Object.assign({}, fx.vfx);
    delete v.crop; delete v.key; delete v.stabilise;           // a clip's own - an adjustment has no picture of its own
    if (Object.keys(v).length) out.vfx = v;
  }
  if (fx.mask) out.mask = fx.mask;                             // 2.416.0: its look only inside / outside a shape
  return { adjust: out };
}

/** /api/export's first look: every video clip's fx can be compiled (a retimed clip knows its length, its LUT exists) -
 *  throws in words (status 400 / 404) so the route answers instead of failing half-way through the job */
function check(t) {
  const all = [].concat(t.video || [], ...((t.video_layers || []).map((L) => (L && L.clips) || [])));
  all.forEach((c) => { if (c && typeof c === "object") clipKeys(c); });
}

module.exports = Object.assign({}, FX, { cleanAk, withAk, dirs, list, lutPath, read, save, bakedLut, forJob, afxOnly,
                                         ROLES, role, clipKeys, soundKeys, mixCfg, check, afxPreview, adjustKeys });
