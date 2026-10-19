/* bitGen Studio — lib/layer3d.js (2.460.0): A DAZ / BLENDER SCENE AS A 3D LAYER OF THE IMAGE EDITOR (the server side).
 *
 * Tim (verbatim): "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d
 * through the image editor or timeline docker. use the image in the daz layer to generate a new image / if we can't do it
 * wit daz directly we can send daz scene to blender" - asked: Blender + an experimental Daz live link.
 *
 * A scene sent from Daz Studio (the bridge's "Scene" - lib/dazBridge.js -> <project>/blender/daz/<name>.blend) or any
 * .blend is copied to <project>/scene3d/<id>/scene.blend (the original is never touched) and kept open in ONE headless
 * Blender per scene (scripts/blend_layer3d.py serve): each render applies the page's camera + pose to the file's own
 * state and writes a PNG - so moving the camera or a bone answers in about a second instead of a Blender start.
 *
 *   sources()                 the scenes to pick: Daz sends (blender/daz/*.blend), the project's .blend files
 *   open(src)                 -> {id, name, meta}: copied + inspected (cameras, the scene camera as an orbit, armatures + bones)
 *   get(id) / list()          a scene's {id, name, source, meta}
 *   render(id, job)           -> {rid}: job = {cam, pose, w, h, engine, samples, transparent, frame} (pure checked: cleanJob)
 *   renderStatus(rid)         {state: queued | running | done | error, error, png, ms}
 *   pngPath(id, file)         a render's file;   close(id) ends that scene's Blender
 * A scene's Blender ends after IDLE_MS without work. Pure: cleanJob, orbitFrom, sizeFor. Routes: routes/layer3d.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const core = require("./core");
const blender = require("./blender");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "blend_layer3d.py");
const ENGINES = ["WORKBENCH", "EEVEE", "CYCLES"];
const IDLE_MS = 5 * 60 * 1000;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const ID = (v) => String(v || "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40);
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================================ pure ================================ */
/** a render job from the page, made safe: the camera (null = the scene's own), the pose (degrees, ±360), the size, the engine */
function cleanJob(j) {
  const o = j || {};
  let cam = null;
  if (o.cam && typeof o.cam === "object") {
    const t = Array.isArray(o.cam.target) ? o.cam.target.slice(0, 3).map((v) => num(v, 0)) : [0, 0, 0];
    while (t.length < 3) t.push(0);
    cam = { target: t, dist: clamp(num(o.cam.dist, 5), 1e-3, 1e6), yaw: num(o.cam.yaw, 0) % 360, pitch: clamp(num(o.cam.pitch, 0), -89.9, 89.9), fov: clamp(num(o.cam.fov, 40), 1, 170) };
  }
  const pose = {};
  for (const [a, bones] of Object.entries((o.pose && typeof o.pose === "object") ? o.pose : {}).slice(0, 20)) {
    if (!bones || typeof bones !== "object") continue;
    const out = {};
    for (const [b, r] of Object.entries(bones).slice(0, 400)) {
      if (!Array.isArray(r)) continue;
      const v = r.slice(0, 3).map((x) => clamp(num(x, 0), -360, 360));
      while (v.length < 3) v.push(0);
      if (v.some((x) => Math.abs(x) > 1e-6)) out[String(b).slice(0, 120)] = v;
    }
    if (Object.keys(out).length) pose[String(a).slice(0, 120)] = out;
  }
  const engine = ENGINES.includes(String(o.engine || "").toUpperCase()) ? String(o.engine).toUpperCase() : "WORKBENCH";
  const frame = o.frame == null || o.frame === "" ? null : Math.round(num(o.frame, 1));
  return { cam, pose, w: Math.round(clamp(num(o.w, 640), 16, 4096)), h: Math.round(clamp(num(o.h, 480), 16, 4096)), engine,
           samples: Math.round(clamp(num(o.samples, 32), 1, 4096)), transparent: !!o.transparent, frame };
}
/** an orbit camera's place (Blender's Z up): target + dist · (cos p cos y, cos p sin y, sin p) */
function orbitFrom(cam) {
  const y = (num(cam.yaw, 0) * Math.PI) / 180, p = (num(cam.pitch, 0) * Math.PI) / 180, d = num(cam.dist, 5), t = cam.target || [0, 0, 0];
  return [t[0] + d * Math.cos(p) * Math.cos(y), t[1] + d * Math.cos(p) * Math.sin(y), t[2] + d * Math.sin(p)];
}
/** a quick render's size: the layer's, the long side at most `longest` */
function sizeFor(w, h, longest) {
  const k = Math.min(1, (longest || 640) / Math.max(1, w, h));
  return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))];
}

/* ================================ files ================================ */
function projDir() { return core.projDir(core.getProject()); }
function baseDir() { const d = path.join(projDir(), "scene3d"); fs.mkdirSync(d, { recursive: true }); return d; }
function sceneDir(id) { const i = ID(id); if (!i) throw bad("no scene id"); return path.join(baseDir(), i); }
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

function sources() {
  const out = [], seen = new Set();
  const add = (f, kind) => { const r = path.resolve(f); if (seen.has(r)) return; seen.add(r); const st = fs.statSync(r); out.push({ path: r, name: path.basename(r).replace(/\.blend$/i, ""), kind, at: st.mtimeMs, size: st.size }); };
  const scan = (d, kind) => { try { for (const f of fs.readdirSync(d)) if (/\.blend$/i.test(f)) add(path.join(d, f), kind); } catch { /* none */ } };
  const P = projDir();
  scan(path.join(P, "blender", "daz"), "daz");
  scan(path.join(P, "blender"), "blender");
  scan(path.join(P, "models3d"), "blender");
  return out.sort((a, b) => b.at - a.at);
}

/** run a one-shot Blender command of blend_layer3d.py */
function once(args) {
  const exe = blender.find();
  if (!exe) return Promise.reject(bad("Blender was not found - set its path in 🟧 Blender settings (blender.exe / Blender.app / blender)", 404));
  return new Promise((resolve, reject) => {
    execFile(exe, ["-b", "--factory-startup", "-P", SCRIPT, "--", ...args.map(String)], { cwd: ROOT, windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout) => {
      const lines = String(stdout || "").split(/\r?\n/), e = lines.find((l) => l.startsWith("H3L error "));
      if (e) return reject(bad(e.slice(10)));
      if (err) return reject(bad("Blender stopped: " + (err.message || err)));
      resolve(lines);
    });
  });
}

async function open(src) {
  const f = path.resolve(String(src || ""));
  if (!src || !/\.blend$/i.test(f) || !fs.existsSync(f)) throw bad("pick a .blend (a scene sent from Daz Studio, or one of the project's)");
  const name = path.basename(f).replace(/\.blend$/i, "");
  const id = (ID(name).slice(0, 24) || "scene") + "-" + Math.random().toString(16).slice(2, 8);
  const d = sceneDir(id);
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(f, path.join(d, "scene.blend"));
  await once(["inspect", path.join(d, "scene.blend"), path.join(d, "meta.json")]);
  const info = { id, name, source: f, at: Date.now() };
  fs.writeFileSync(path.join(d, "info.json"), JSON.stringify(info, null, 1));
  return get(id);
}
function get(id) {
  const d = sceneDir(id), info = readJSON(path.join(d, "info.json"), null);
  if (!info) throw bad("no such 3D scene in this project - open it again", 404);
  return Object.assign({}, info, { meta: readJSON(path.join(d, "meta.json"), {}) });
}
function list() {
  let ds = []; try { ds = fs.readdirSync(baseDir()); } catch { /* none */ }
  return ds.map((x) => readJSON(path.join(baseDir(), x, "info.json"), null)).filter(Boolean).sort((a, b) => b.at - a.at);
}

/* ================================ one Blender per open scene ================================ */
const procs = new Map();       // scene id -> {child, ready, queue: [r], cur, timer}
const renders = new Map();     // rid -> {id, state, error, png, ms, at}
let rseq = 0;
function proc(id) {
  let p = procs.get(id);
  if (p && !p.dead) return p;
  const exe = blender.find();
  if (!exe) throw bad("Blender was not found - set its path in 🟧 Blender settings (blender.exe / Blender.app / blender)", 404);
  const child = spawn(exe, ["-b", "--factory-startup", "-P", SCRIPT, "--", "serve", path.join(sceneDir(id), "scene.blend")], { cwd: ROOT, windowsHide: true });
  p = { child, ready: false, queue: [], cur: null, timer: null, dead: false, part: "" };
  procs.set(id, p);
  const onLine = (ln) => {
    if (ln === "H3L ready") { p.ready = true; next(id); return; }
    if (!p.cur) return;
    const r = renders.get(p.cur);
    if (ln.startsWith("H3L done ")) { const m = ln.slice(9).match(/^(.*) (\d+)$/); Object.assign(r, { state: "done", png: path.basename(m ? m[1] : ln.slice(9)), ms: m ? +m[2] : 0 }); p.cur = null; next(id); }
    else if (ln.startsWith("H3L error ")) { Object.assign(r, { state: "error", error: ln.slice(10) }); p.cur = null; next(id); }
  };
  child.stdout.on("data", (d) => { const t = p.part + String(d), ls = t.split(/\r?\n/); p.part = ls.pop(); ls.forEach(onLine); });
  child.stderr.on("data", () => { /* Blender's own noise */ });
  child.on("exit", () => {
    p.dead = true; procs.delete(id);
    for (const rid of [p.cur, ...p.queue].filter(Boolean)) { const r = renders.get(rid); if (r && (r.state === "queued" || r.state === "running")) Object.assign(r, { state: "error", error: "Blender stopped" }); }
  });
  child.on("error", (e) => { p.dead = true; procs.delete(id); for (const rid of [p.cur, ...p.queue].filter(Boolean)) { const r = renders.get(rid); if (r) Object.assign(r, { state: "error", error: String(e.message || e) }); } });
  return p;
}
function next(id) {
  const p = procs.get(id); if (!p || !p.ready || p.cur) return;
  clearTimeout(p.timer);
  const rid = p.queue.shift();
  if (!rid) { p.timer = setTimeout(() => close(id), IDLE_MS); return; }
  const r = renders.get(rid); r.state = "running";
  p.cur = rid;
  p.child.stdin.write(JSON.stringify(Object.assign({ cmd: "render", out: path.join(sceneDir(id), "renders", `r${rid}.png`) }, r.job)) + "\n");
}
function render(id, job) {
  get(id);
  const j = cleanJob(job);
  const p = proc(ID(id));
  // a newer QUICK render replaces the quick ones still waiting (the camera moved on)
  if (j.engine === "WORKBENCH") for (const q of p.queue.slice()) { const r = renders.get(q); if (r && r.job.engine === "WORKBENCH") { r.state = "error"; r.error = "replaced by a newer view"; p.queue.splice(p.queue.indexOf(q), 1); } }
  const rid = String(++rseq);
  renders.set(rid, { id: ID(id), state: "queued", error: null, png: null, ms: 0, at: Date.now(), job: j });
  while (renders.size > 200) renders.delete(renders.keys().next().value);
  p.queue.push(rid);
  next(ID(id));
  return { rid, state: "queued" };
}
function renderStatus(rid) {
  const r = renders.get(String(rid || ""));
  if (!r) return { state: "error", error: "no such render" };
  return { state: r.state, error: r.error, ms: r.ms, png: r.png ? `/api/layer3d/${r.id}/png?f=${encodeURIComponent(r.png)}` : null };
}
function pngPath(id, f) {
  const n = path.basename(String(f || "")); if (!/^r\d+\.png$/.test(n)) return null;
  const p = path.join(sceneDir(id), "renders", n); return fs.existsSync(p) ? p : null;
}
function close(id) {
  const p = procs.get(ID(id)); if (!p) return { ok: true };
  clearTimeout(p.timer);
  try { p.child.stdin.write(JSON.stringify({ cmd: "quit" }) + "\n"); } catch { /* gone */ }
  setTimeout(() => { try { p.child.kill(); } catch { /* gone */ } }, 3000);
  procs.delete(ID(id));
  return { ok: true };
}
process.on("exit", () => { for (const p of procs.values()) { try { p.child.kill(); } catch { /* gone */ } } });

module.exports = { ENGINES, cleanJob, orbitFrom, sizeFor, sources, open, get, list, render, renderStatus, pngPath, close };
