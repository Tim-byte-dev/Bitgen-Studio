// bitGen Studio — routes/dazBody.js (2.981.0): 📷 A DAZ BODY FROM A PHOTO (lib/dazBodyFit.js) - mounted from routes/index.js
// (never server.js). Two ways, the user tries the one they pick (DAZ Tools ▸ 🧭 Explorer ▸ 📷 Body from a photo) and keeps
// the better one. Not a replacement for Daz Studio - light tasks; Daz Studio is a very powerful character creator.
//   POST /api/dazlib/body/marks {picture, where}            the Vision model's body points -> {points (0..1000), w, h}
//   POST /api/dazlib/body/fit   {root, rel, dials, points, w, h, height_cm}   A: the figure's body dials fitted
//                                -> {dials [{url, value}], changed [{label, from, to}], target, before, after, error}
//   POST /api/dazlib/body/scan  {picture, where, engine, name} B1: the photo -> a 3D shape (a queue job) -> {job, model}
//   POST /api/dazlib/body/wrap  {root, rel, dials, scan, turn, name}             B2: the figure wrapped onto the scan ->
//                                <project>/dazmorphs/<name>.json -> {custom, moved_mm, align, vertices}
"use strict";
const fs = require("fs");
const path = require("path");
const D = require("../lib/dazLib");
const BF = require("../lib/dazBodyFit");
function fail(res, e) { res.status((e && e.status) || 500).json({ error: String((e && e.message) || e) }); }
function bad(m, s) { const e = new Error(m); e.status = s || 400; return e; }
function picture(name, where) { const p = require("./sceneAI").pictureOf(name, where); if (!p) throw bad("that picture is not in this project: " + name, 404); return p; }
function sizeOf(file) {
  const r = require("child_process").spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file], { encoding: "utf8" });
  const m = /(\d+)x(\d+)/.exec(r.stdout || ""); return m ? { w: +m[1], h: +m[2] } : { w: 1000, h: 1000 };
}
/** the figure of a .duf + its dial values by id (the .duf's own + the ones sent) */
function figureOf(b) {
  const duf = D.abs(b.root, b.rel), sc = D.sceneNodes(duf); if (!sc.fig) throw bad("no figure in " + path.basename(duf));
  const fig = D.figureData(sc.fig, duf), FX = require("../static/dazformula.js"), set = {};
  for (const m of sc.modifiers) { const v = m.channel && (m.channel.current_value != null ? m.channel.current_value : m.channel.value); if (m.url && +v) set[FX.parseUrl(m.url).id] = +v; }
  for (const d of b.dials || []) if (d && d.url) set[FX.parseUrl(d.url).id] = +d.value || 0;
  return { duf, fig, set };
}
function urlOf(rec) {
  const r = D.roots().find((x) => path.resolve(rec.file).startsWith(path.resolve(x) + path.sep)); if (!r) return null;
  return "/" + path.relative(r, rec.file).split(path.sep).map(encodeURIComponent).join("/") + "#" + encodeURIComponent(rec.id);
}
/** the figure's vertices (metres) with its dials + their ERCs, and its triangles */
function shaped(fig, set) {
  const DM = require("../lib/dazMuscle"), sol = DM.solve(fig.file, set), V = (fig.geo.vertices || {}).values || [], P = new Float64Array(V.length * 3);
  V.forEach((p, i) => { P[i * 3] = p[0]; P[i * 3 + 1] = p[1]; P[i * 3 + 2] = p[2]; });
  for (const m of sol.shape) for (const d of m.deltas) if (d[0] < V.length) { P[d[0] * 3] += d[1] * m.w; P[d[0] * 3 + 1] += d[2] * m.w; P[d[0] * 3 + 2] += d[3] * m.w; }
  for (let i = 0; i < P.length; i++) P[i] *= D.CM;
  const T = []; for (const q of (fig.geo.polylist || {}).values || []) { const vs = q.slice(2); for (let t = 1; t + 1 < vs.length; t++) T.push(vs[0], vs[t], vs[t + 1]); }
  return { pos: P, tris: Uint32Array.from(T) };
}
function mount(app) {
  const J = require("express").json({ limit: "4mb" });
  app.post("/api/dazlib/body/marks", J, async (req, res) => {
    const b = req.body || {};
    try {
      const pic = picture(b.picture, b.where), t = (await require("../lib/captioner").describe(require("../lib/core"), [{ path: pic, prompt: BF.BODY_PROMPT, max_tokens: 700 }]))[0];
      const points = BF.parseBody(t); if (!points) return res.status(422).json({ error: "the Vision model found no whole body in that photo (a standing person, head to feet - and is a Vision model chosen in the prompt docker?)", answer: String(t || "").slice(0, 300) });
      res.json(Object.assign({ points }, sizeOf(pic)));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/body/fit", J, (req, res) => {
    const b = req.body || {};
    try {
      if (!b.points) throw bad("no body points - mark the photo first");
      const { fig, set } = figureOf(b), ix = require("../lib/dazMuscle").index(fig.file), target = BF.features(BF.toPixels(b.points, b.w, b.h)).f;
      if (Object.keys(target).length < 3) throw bad("too few body points in the photo to fit (head to feet, shoulders, hips)", 422);
      const r = BF.fitDials({ fig, ix, set0: set, target, heightCm: +b.height_cm || 0 });
      const dials = Object.entries(r.set).filter(([, v]) => v).map(([id, v]) => { const m = ix.mods.get(id); return m ? { url: urlOf(m), value: v } : null; }).filter((x) => x && x.url);
      res.json({ dials, changed: r.changed, target, before: r.before, after: r.after, error: r.error, height_cm: { before: r.height.before, after: r.height.after }, tried: r.dials, note: D.NOT_DAZ });
    } catch (e) { fail(res, e); }
  });
  // 2.982.0: 📏 height / weight / tape measurements -> the figure's own body dials (measure_only: just the numbers now)
  app.post("/api/dazlib/body/measures", J, (req, res) => {
    const b = req.body || {};
    try {
      const { fig, set } = figureOf(b), ix = require("../lib/dazMuscle").index(fig.file), T = b.target || {}, target = {};
      for (const k of ["height", "weight", "chest", "waist", "hips"]) if (+T[k] > 0) target[k] = +T[k];
      if (b.measure_only || !Object.keys(target).length) return res.json({ now: BF.measureNow(fig, ix, set) });
      if (target.height && (target.height < 40 || target.height > 260)) throw bad("a height between 40 and 260 cm");
      if (target.weight && (target.weight < 3 || target.weight > 300)) throw bad("a weight between 3 and 300 kg");
      const r = BF.fitMeasures({ fig, ix, set0: set, target, build: b.build });
      const dials = Object.entries(r.set).filter(([, v]) => v).map(([id, v]) => { const m = ix.mods.get(id); return m ? { url: urlOf(m), value: v } : null; }).filter((x) => x && x.url);
      res.json({ dials, changed: r.changed, before: r.before, after: r.after, target, tried: r.dials, note: D.NOT_DAZ });
    } catch (e) { fail(res, e); }
  });
  // 2.982.0: 🎬 a motion (Mixamo, retargeted in 🕺 Pose) baked into a copy of the character's .glb
  app.post("/api/dazlib/motion/bake", require("express").json({ limit: "64mb" }), (req, res) => {
    const b = req.body || {};
    try {
      const m3d = require("../lib/m3d"), src = path.join(m3d.dir(), path.basename(String(b.model || "")));
      if (!b.model || !fs.existsSync(src)) throw bad("that character is not in the project's 3D models: " + b.model, 404);
      const r = require("../lib/glbAnim").addAnimation(fs.readFileSync(src), { name: b.clip, times: b.times, rotations: b.rotations, translations: b.translations, weights: b.weights });
      const stem = path.basename(src).replace(/\.glb$/i, ""), clip = BF.safeName(b.clip || "motion").replace(/ /g, "_") || "motion";
      const saved = m3d.saveModel(stem + "_" + clip + ".glb", r.glb);
      res.json({ model: (saved && saved.name) || stem + "_" + clip + ".glb", channels: r.channels, skipped: r.skipped, frames: (b.times || []).length });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/body/scan", J, (req, res) => {
    const b = req.body || {};
    try { const pic = picture(b.picture, b.where), j = require("../lib/to3d").queue(pic, { engine: b.engine, model_name: BF.safeName((b.name || "body") + "_scan").replace(/ /g, "_") }); res.json({ job: j.id, model: j.model }); } catch (e) { fail(res, e); }
  });
  app.post("/api/dazlib/body/wrap", J, (req, res) => {
    const b = req.body || {};
    try {
      const { fig, set } = figureOf(b), f = path.join(require("../lib/m3d").dir(), path.basename(String(b.scan || "")));
      if (!b.scan || !fs.existsSync(f)) throw bad("the scan is not in the project's 3D models: " + b.scan, 404);
      const scan = BF.readGlbMesh(fs.readFileSync(f)); if (!scan.tris.length) throw bad("the scan has no triangles");
      const body = shaped(fig, set), align = BF.alignScan(scan.pos, body.pos, !!b.turn), sp = BF.applyAlign(scan.pos, align), n = body.pos.length / 3;
      const r = BF.wrap({ pos: body.pos, tris: body.tris, trust: BF.trustOf(fig, n), scan: { pos: sp, tris: scan.tris } });
      const deltas = []; for (let i = 0; i < n; i++) { const d = [0, 1, 2].map((k) => (r.pos[i * 3 + k] - body.pos[i * 3 + k]) / D.CM); if (Math.hypot(d[0], d[1], d[2]) > 0.05) deltas.push([i, +d[0].toFixed(3), +d[1].toFixed(3), +d[2].toFixed(3)]); }
      const name = BF.saveMorph(b.name || "wrap", { figure: b.rel, vertices: n, deltas, scan: path.basename(f), align, made: Date.now() });
      res.json({ custom: name, moved_mm: +(r.moved * 1000).toFixed(1), moved_vertices: deltas.length, vertices: n, align, scan: path.basename(f) });
    } catch (e) { fail(res, e); }
  });
}
module.exports = { mount, figureOf, urlOf, shaped };
