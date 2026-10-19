// bitGen Studio — lib/blender.js (2.385.0): the BLENDER BRIDGE on the server.
//
// Tim: "is it possible for us to create a blender to bitgen bridge?" -> asked how much: "Add-on + Blender render bake".
//
//  Blender -> bitGen (the add-on, blender/bitgen_bridge): "Send to bitGen" exports the selection / the scene as glTF
//  (.glb) and POSTs it here; it lands in the project's models3d/ and in the INBOX, which the page reads
//  (ext/timelinedock/m3dblender.js) to add a 3D layer - or, for a model already on the timeline, to reload it and
//  re-bake its layers (the live link: the add-on sends again on every Save).
//  bitGen -> Blender (the render bake): a 3D layer set to "Render with Blender" is rendered by a local Blender, headless
//  (scripts/blender_render.py), frame by frame into the same frames folder the browser bake uses, then encoded by
//  lib/m3d.encode() into video/m3d_<id>.webm for the compile.
//
//   settings() / saveSettings(o)   {path, engine: eevee | cycles | workbench, samples, gpu} in the settings (config.blender)
//   find()                         the Blender to run: the one set, else the usual install folders / PATH (null = none)
//   info()                         {path, found, version, engine, samples, gpu} (the version asked of Blender once, cached)
//   push(name, buf, layer)         a model from the add-on -> models3d/ + the inbox; {name, seq, project}
//   inbox(since)                   {seq, items: [{seq, name, layer, at, project}]} newer than `since`
//   render(id, job)                start rendering a layer -> {id, state}; job = {spec, w, h, fps, frames, parts}
//   status(id)                     {state: running | done | error, done, of, error, result}
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFile } = require("child_process");
const core = require("./core");
const m3d = require("./m3d");

const ENGINES = ["eevee", "cycles", "workbench"];
const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "blender_render.py");
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);

/* ---- settings */
function settings() {
  const c = (core.getConfig() || {}).blender || {};
  return { path: String(c.path || ""), engine: ENGINES.includes(c.engine) ? c.engine : "eevee",
           samples: Math.max(0, Math.min(4096, Math.round(Number(c.samples) || 0))), gpu: !!c.gpu };
}
function saveSettings(o) {
  o = o || {};
  const cfg = core.getConfig() || {};
  const cur = settings();
  const next = {
    path: o.path !== undefined ? String(o.path || "").trim() : cur.path,
    engine: ENGINES.includes(o.engine) ? o.engine : cur.engine,
    samples: o.samples !== undefined ? Math.max(0, Math.min(4096, Math.round(Number(o.samples) || 0))) : cur.samples,
    gpu: o.gpu !== undefined ? !!o.gpu : cur.gpu,
  };
  cfg.blender = next;
  core.setConfig(cfg);
  versionCache = {};
  return next;
}

/* ---- where Blender is */
function exists(p) { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } }
function newestIn(dir, rel) {
  let ents = [];
  try { ents = fs.readdirSync(dir); } catch { return null; }
  const hits = ents.filter((e) => /^blender/i.test(e)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map((e) => path.join(dir, e, rel)).filter(exists);
  return hits[0] || null;
}
function onPath(exe) {
  for (const d of String(process.env.PATH || "").split(path.delimiter)) {
    const p = path.join(d, exe);
    if (exists(p)) return p;
  }
  return null;
}
function find() {
  const s = settings();
  if (s.path) return exists(s.path) ? s.path : null;
  if (process.env.H3_BLENDER && exists(process.env.H3_BLENDER)) return process.env.H3_BLENDER;
  if (process.platform === "win32") {
    for (const pf of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], "C:\\Program Files"]) {
      const hit = pf && newestIn(path.join(pf, "Blender Foundation"), "blender.exe");
      if (hit) return hit;
    }
    return onPath("blender.exe");
  }
  if (process.platform === "darwin") {
    const mac = "/Applications/Blender.app/Contents/MacOS/Blender";
    if (exists(mac)) return mac;
  }
  return onPath("blender") || ["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender"].find(exists) || null;
}
let versionCache = {};
function version(exe) {
  if (!exe) return Promise.resolve(null);
  if (versionCache[exe] !== undefined) return Promise.resolve(versionCache[exe]);
  return new Promise((ok) => {
    execFile(exe, ["-b", "--factory-startup", "--python-expr", "import bpy; print('H3BV', bpy.app.version_string)"],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
        const m = /H3BV\s+(\S+)/.exec(String(out || ""));
        versionCache[exe] = m ? m[1] : null;
        ok(versionCache[exe]);
      });
  });
}
async function info() {
  const s = settings(), exe = find();
  return { ...s, found: exe, version: await version(exe) };
}

/* ---- the add-on's sends: models3d/ + the inbox */
let seq = 0;
const items = [];
function push(name, buf, layer) {
  if (!m3d.MODEL_EXT.includes(path.extname(m3d.safeName(name)).toLowerCase())) throw bad("send a model file (.glb, .gltf, .fbx or .obj)");
  const saved = m3d.saveModel(name, buf);
  seq += 1;
  const it = { seq, name: saved.name, layer: !!layer, at: Date.now(), project: core.getProject(), bytes: saved.bytes };
  items.push(it);
  while (items.length > 200) items.shift();
  return it;
}
function inbox(since) {
  const s = Number(since) || 0;
  return { seq, items: items.filter((i) => i.seq > s && i.project === core.getProject()) };
}

/* ---- the render bake */
const jobs = new Map();           // id -> {state, done, of, error, result, child, started}
function status(id) {
  const j = jobs.get(ID(id));
  if (!j) return { state: "none" };
  return { state: j.state, done: j.done, of: j.of, error: j.error || null, result: j.result || null, engine: j.engine || null,
           seconds: Math.round(((j.ended || Date.now()) - j.started) / 100) / 10 };
}
function textureFor(spec) {
  const map = spec && spec.mat && spec.mat.map;
  return map ? m3d.modelPath(map) : null;
}
function render(id, job, opts) {
  const i = ID(id);
  if (!i) throw bad("a 3D layer id is required");
  const exe = (opts && opts.exe) || find();
  if (!exe) throw bad("Blender was not found - set its path in 🧊 Blender settings (blender.exe / Blender.app / blender)", 404);
  if (!job || !job.spec || typeof job.spec !== "object") throw bad("the layer's 3D spec is required");
  const old = jobs.get(i);
  if (old && old.state === "running") { try { old.child.kill(); } catch { /* gone */ } }
  const frames = Array.isArray(job.frames) ? job.frames.slice(0, 24 * 60 * 5) : [];
  if (!frames.length) throw bad("no frames to render");
  const spec = job.spec;
  let model = null, font = null;
  if (spec.type === "model") {
    model = m3d.modelPath(spec.model);
    if (!model) throw bad("the model file " + (spec.model || "?") + " is not in this project's models3d", 404);
  } else {
    font = m3d.fontFile(spec.font, !!spec.bold, !!spec.italic);
  }
  const out = m3d.frameDir(i);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const s = settings();
  const w = Math.max(16, Math.min(4096, Math.round(Number(job.w || spec.w) || 640)));
  const h = Math.max(16, Math.min(4096, Math.round(Number(job.h || spec.h) || 640)));
  const fps = Math.max(1, Math.min(60, Math.round(Number(job.fps) || 24)));
  const jobFile = path.join(os.tmpdir(), `h3_blender_${i}_${Date.now()}.json`);
  fs.writeFileSync(jobFile, JSON.stringify({ spec, w, h, fps, frames, model, font, texture: textureFor(spec), parts: job.parts || {},
    out, engine: (opts && opts.engine) || s.engine, samples: s.samples, gpu: s.gpu }), "utf8");
  const J = { state: "running", done: 0, of: frames.length, error: null, result: null, started: Date.now(), engine: null };
  jobs.set(i, J);
  const child = spawn(exe, ["-b", "--factory-startup", "-P", SCRIPT, "--", jobFile], { cwd: ROOT, windowsHide: true });
  J.child = child;
  let tail = "";
  const line = (ln) => {
    let m = /H3B frame (\d+)\/(\d+)/.exec(ln);
    if (m) { J.done = Math.max(J.done, +m[1]); J.of = +m[2]; return; }
    m = /H3B done (\d+)/.exec(ln);
    if (m) { J.done = Math.max(J.done, +m[1]); J.finished = true; return; }
    m = /H3B engine (\S+)/.exec(ln);
    if (m) J.engine = m[1];
    m = /H3B error: (.*)$/.exec(ln);
    if (m) J.error = m[1].trim();
  };
  // whole lines only: a chunk can end in the middle of one
  const reader = () => {
    let part = "";
    return (d) => {
      const t = String(d);
      tail = (tail + t).slice(-4000);
      const lines = (part + t).split(/\r?\n/);
      part = lines.pop();
      lines.forEach(line);
    };
  };
  child.stdout.on("data", reader());
  child.stderr.on("data", reader());
  child.on("error", (e) => { J.state = "error"; J.error = String(e.message || e); J.ended = Date.now(); });
  child.on("close", async (code) => {
    try { fs.unlinkSync(jobFile); } catch { /* fine */ }
    if (J.state !== "running") return;
    if (code !== 0 || (!J.finished && J.done < frames.length)) {
      J.state = "error";
      J.error = J.error || `Blender stopped (exit ${code}) after ${J.done} of ${frames.length} frames: `
        + tail.trim().split(/\n/).slice(-3).join(" ").slice(0, 400);
      J.ended = Date.now();
      return;
    }
    try {
      J.result = await m3d.encode(i, { fps, frames: frames.length });
      J.state = "done";
    } catch (e) { J.state = "error"; J.error = String(e.message || e); }
    J.ended = Date.now();
  });
  return { id: i, state: "running", of: frames.length };
}

module.exports = { ENGINES, settings, saveSettings, find, version, info, push, inbox, render, status };
