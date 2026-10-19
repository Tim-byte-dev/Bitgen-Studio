/* bitGen Studio — A .blend IN THE PREVIEW CANVAS (2.403.0): the server side.
 *
 * Tim (verbatim): "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene,
 * select the segment we want to render to real? even better id we could edit the scene, move objects etc" - edits =
 * move / rotate / scale, hide / duplicate / delete, keyframes; where they go: "an option dropdown in the properties for
 * blender in our toolbox - to write back to blender, copy to new file, only render in our scene, keep the blender
 * filename.tmp in current project folder. save it as .blend if save button is pressed".
 *
 * Per project, in <project>/blender/:
 *   <stem>.tmp          the working copy of the .blend (opened by Blender, never the original)
 *   <stem>.glb          what the preview shows (scripts/blend_scene.py export), <stem>.meta.json its range / objects
 *   <stem>.edits.json   the page's edits, glTF-local (applied by Blender on save / render; never baked in until Save)
 *   <stem>.info.json    {stem, source (the original .blend), mode, opened, saved}
 *   <stem>.blend        written by 💾 Save (always); "write back" also saves over the original (Blender keeps the old
 *                       one as .blend1), "copy" saves <stem>_bitgen.blend beside it; "bitgen" = only the project's
 *   current.json        which scene the preview has open
 *
 *   open(path, {fresh})        -> info + meta + edits (an existing working copy of the same file is reopened unless fresh)
 *   current()                  -> the open scene or null;   glbPath(stem)
 *   setEdits(stem, edits)      -> the cleaned edits saved;  setMode(stem, mode)
 *   save(stem, {mode})         -> {written: [paths], notes, ...state}: Blender bakes the edits into the working copy + the outputs, re-exports, edits cleared
 *   render(stem, opts)         -> {id}: frames start..end through the scene camera or the page's view -> mp4 ->
 *                                 lib/blenderScene.save (Video assets) and, with render, the LTX 2.3 3DREAL job
 *   renderStatus(id)
 * Blender runs headless (lib/blender.find); scripts/blend_scene.py does the work. routes/blendView.js mounts it. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const core = require("./core");
const blender = require("./blender");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "blend_scene.py");
const MODES = ["bitgen", "writeback", "copy"];
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const stemOf = (p) => (path.basename(String(p || "")).replace(/\.(blend\d*|tmp)$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, " ")
  .trim().replace(/\s+/g, "_") || "scene").slice(0, 60);
const STEM = (s) => String(s || "").replace(/[^A-Za-z0-9._()-]+/g, "").slice(0, 60);
function dir() { const d = path.join(core.projDir(core.getProject()), "blender"); fs.mkdirSync(d, { recursive: true }); return d; }
const file = (stem, ext) => path.join(dir(), STEM(stem) + ext);
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 1), "utf8");

/** run scripts/blend_scene.py: resolves {code, lines, error, out}; onLine sees every whole line */
function run(args, onLine, exeOverride) {
  const exe = exeOverride || blender.find();
  if (!exe) return Promise.reject(bad("Blender was not found - set its path in 🟧 Blender settings (blender.exe / Blender.app / blender)", 404));
  return new Promise((resolve) => {
    const child = spawn(exe, ["-b", "--factory-startup", "-P", SCRIPT, "--", ...args.map(String)], { cwd: ROOT, windowsHide: true });
    const lines = [];
    let part = "", error = null, out = null;
    const take = (d) => {
      const t = part + String(d);
      const ls = t.split(/\r?\n/);
      part = ls.pop();
      for (const ln of ls) {
        lines.push(ln);
        if (lines.length > 400) lines.shift();
        let m = /H3B error: (.*)$/.exec(ln);
        if (m) error = m[1].trim();
        m = /H3B done (.*)$/.exec(ln);
        if (m) out = m[1].trim();
        if (onLine) try { onLine(ln); } catch { /* fine */ }
      }
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", (e) => resolve({ code: -1, lines, error: String(e.message || e), out: null, child }));
    child.on("close", (code) => resolve({ code, lines, error: error || (code !== 0 ? `Blender stopped (exit ${code}): ` + lines.slice(-3).join(" ").slice(0, 400) : null), out, child }));
    if (onLine) onLine({ child });
  });
}

function state(stem) {
  const s = STEM(stem);
  const info = readJSON(file(s, ".info.json"), null);
  if (!info) return null;
  let v = 0;
  try { v = Math.round(fs.statSync(file(s, ".glb")).mtimeMs); } catch { v = 0; }
  return { ...info, meta: readJSON(file(s, ".meta.json"), {}), edits: readJSON(file(s, ".edits.json"), { objects: {} }),
           glb: `/api/blendview/glb?stem=${encodeURIComponent(s)}&v=${v}`, project: core.getProject() };
}

async function exportGlb(stem, exe) {
  const r = await run(["export", file(stem, ".tmp"), file(stem, ".glb"), file(stem, ".meta.json")], null, exe);
  if (r.error || !fs.existsSync(file(stem, ".glb"))) throw bad("Blender could not read the scene: " + (r.error || "no .glb written"), 500);
}

async function open(src, opts) {
  const o = opts || {};
  const p = path.resolve(String(src || ""));
  if (!/\.blend\d*$/i.test(p)) throw bad("pick a Blender file (.blend)");
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw bad("the file is not there: " + p, 404);
  const head = Buffer.alloc(7);
  try { const fd = fs.openSync(p, "r"); fs.readSync(fd, head, 0, 7, 0); fs.closeSync(fd); } catch { /* checked below */ }
  const magic = head.toString("latin1");
  // a .blend starts BLENDER (or is zstd / gzip compressed: 28 B5 2F FD / 1F 8B)
  if (magic !== "BLENDER" && !(head[0] === 0x28 && head[1] === 0xb5) && !(head[0] === 0x1f && head[1] === 0x8b))
    throw bad(path.basename(p) + " is not a Blender file");
  const stem = stemOf(p);
  const prev = readJSON(file(stem, ".info.json"), null);
  const same = prev && path.resolve(prev.source || "") === p && fs.existsSync(file(stem, ".tmp"));
  if (!same || o.fresh) {
    fs.copyFileSync(p, file(stem, ".tmp"));
    writeJSON(file(stem, ".edits.json"), { objects: {} });
  }
  const info = { stem, source: p, mode: (prev && same && MODES.includes(prev.mode)) ? prev.mode : "bitgen",
                 opened: Date.now(), saved: same ? prev.saved || null : null };
  writeJSON(file(stem, ".info.json"), info);
  if (!same || o.fresh || !fs.existsSync(file(stem, ".glb"))) await exportGlb(stem, o.exe);
  writeJSON(path.join(dir(), "current.json"), { stem });
  return state(stem);
}

function current() {
  const c = readJSON(path.join(dir(), "current.json"), null);
  return c && c.stem ? state(c.stem) : null;
}
function close() { try { fs.unlinkSync(path.join(dir(), "current.json")); } catch { /* none */ } return { ok: true }; }
function glbPath(stem) { const f = file(stem, ".glb"); return fs.existsSync(f) ? f : null; }

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const vec = (a, n, d) => (Array.isArray(a) && a.length === n ? a.map(num) : d);
function trs(e) {
  if (!e || typeof e !== "object") return null;
  return { t: vec(e.t, 3, [0, 0, 0]), r: vec(e.r, 4, [0, 0, 0, 1]), s: vec(e.s, 3, [1, 1, 1]) };
}
/** the page's edits, cleaned: only known fields, numbers, sane ids */
function clean(edits) {
  const out = { objects: {} };
  const objs = (edits && edits.objects) || {};
  for (const [id, e] of Object.entries(objs).slice(0, 2000)) {
    const k = String(id).slice(0, 120);
    if (!k || !e || typeof e !== "object") continue;
    const c = {};
    if (e.base) c.base = trs(e.base);
    if (e.keys && typeof e.keys === "object") {
      c.keys = {};
      for (const [f, v] of Object.entries(e.keys).slice(0, 5000)) if (Number.isFinite(+f)) c.keys[String(Math.round(+f))] = trs(v);
      if (!Object.keys(c.keys).length) delete c.keys;
    }
    if (e.hidden !== undefined) c.hidden = !!e.hidden;
    if (e.deleted) c.deleted = true;
    if (e.src) c.src = String(e.src).slice(0, 120);
    // 2.404.0: a model added in the preview (+ Model) - a file in the project's models3d/
    if (e.import) c.import = path.basename(String(e.import)).slice(0, 120);
    if (Object.keys(c).length) out.objects[k] = c;
  }
  // 2.461.0: the figure pose {armature: {bone: [x, y, z] degrees}} (scripts/blend_pose.py) - checked like the 3D layer's
  const pose = edits && edits.pose ? require("./layer3d").cleanJob({ pose: edits.pose }).pose : {};
  if (Object.keys(pose).length) out.pose = pose;
  return out;
}
function setEdits(stem, edits) {
  if (!readJSON(file(stem, ".info.json"), null)) throw bad("that scene is not open", 404);
  const c = clean(edits);
  writeJSON(file(stem, ".edits.json"), c);
  return { ok: true, objects: Object.keys(c.objects).length };
}
function setMode(stem, mode) {
  const info = readJSON(file(stem, ".info.json"), null);
  if (!info) throw bad("that scene is not open", 404);
  if (!MODES.includes(mode)) throw bad("mode: " + MODES.join(" | "));
  info.mode = mode;
  writeJSON(file(stem, ".info.json"), info);
  return state(stem);
}

/** the edits as Blender reads them: an added model's name -> its absolute path in models3d/ (a temp file beside) */
function blenderEdits(stem) {
  const e = readJSON(file(stem, ".edits.json"), { objects: {} });
  let any = false;
  for (const v of Object.values(e.objects || {})) {
    if (!v || !v.import) continue;
    const p = require("./m3d").modelPath(v.import);
    if (p) { v.import = p; any = true; } else delete v.import;
  }
  if (!any) return file(stem, ".edits.json");
  const out = file(stem, ".edits.blender.json");
  writeJSON(out, e);
  return out;
}

/** 💾 Save: the project's <stem>.blend always; + the original ("writeback") or <stem>_bitgen.blend ("copy") */
async function save(stem, opts) {
  const o = opts || {};
  const info = readJSON(file(stem, ".info.json"), null);
  if (!info) throw bad("that scene is not open", 404);
  const mode = MODES.includes(o.mode) ? o.mode : (MODES.includes(info.mode) ? info.mode : "bitgen");
  const outs = [file(stem, ".blend")];
  if (mode === "writeback") outs.push(info.source);
  if (mode === "copy") outs.push(path.join(path.dirname(info.source), STEM(stem) + "_bitgen.blend"));
  const r = await run(["save", file(stem, ".tmp"), blenderEdits(stem), ...outs], null, o.exe);
  if (r.error) throw bad("Blender could not save: " + r.error, 500);
  // the working copy = what was saved; the edits are in it now
  fs.copyFileSync(outs[0], file(stem, ".tmp"));
  writeJSON(file(stem, ".edits.json"), { objects: {} });
  await exportGlb(stem, o.exe);
  info.mode = mode;
  info.saved = { at: Date.now(), to: outs };
  writeJSON(file(stem, ".info.json"), info);
  return { ...state(stem), written: outs, notes: r.lines.filter((l) => l.startsWith("H3B note ")).map((l) => l.slice(9)) };
}

/* ---- render a segment -> Video assets (+ LTX 2.3 3DREAL) */
const renders = new Map();
function renderStatus(id) {
  const j = renders.get(String(id));
  if (!j) return { state: "none" };
  return { state: j.state, done: j.done, of: j.of, error: j.error, name: j.name || null, job: j.job || null, note: j.note || null, realrefs: j.realrefs || null, objects2d: j.objects2d || undefined };
}
function render(stem, opts) {
  const o = opts || {};
  const info = readJSON(file(stem, ".info.json"), null);
  if (!info) throw bad("that scene is not open", 404);
  const meta = readJSON(file(stem, ".meta.json"), {});
  const start = Math.round(num(o.start) || meta.frame_start || 1), end = Math.round(num(o.end) || meta.frame_end || start);
  if (end < start) throw bad("the segment ends before it starts");
  const fps = meta.fps || 24;
  if ((end - start + 1) / fps > 30.5) throw bad(`the segment is ${((end - start + 1) / fps).toFixed(1)} s - LTX takes up to 30 s; pick a shorter one`);
  let view = null;
  if (o.view && Array.isArray(o.view.matrix) && o.view.matrix.length === 16) view = { matrix: o.view.matrix.map(num), fov: Math.max(1, Math.min(170, num(o.view.fov) || 50)) };
  if (!view && !meta.camera) throw bad("the scene has no camera - use the preview's free view (🎥 This view) or add one in Blender");
  const id = Math.random().toString(16).slice(2, 10);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3_blendview_"));
  const jobFile = path.join(tmp, "job.json");
  const out = path.join(tmp, STEM(stem) + ".mp4");
  // 2.540.0: with the reference docker's pictures (lib/realRefs.js): the first frame + where each mesh is on it
  const rr = o.realrefs && o.realrefs.token ? o.realrefs : null;
  const still = rr ? path.join(require("./realRefs").tokDir(rr.token), "frame-" + id + ".png") : null;
  writeJSON(jobFile, { start, end, engine: ["WORKBENCH", "EEVEE", "SCENE"].includes(String(o.engine || "").toUpperCase()) ? String(o.engine).toUpperCase() : "WORKBENCH",
                       view, out, ...(rr ? { still, objects2d: true } : {}) });
  const J = { state: "running", done: 0, of: end - start + 1, error: null };
  renders.set(id, J);
  run(["render", file(stem, ".tmp"), blenderEdits(stem), jobFile], (ln) => {
    const m = typeof ln === "string" && /H3B frame (\d+)\/(\d+)/.exec(ln);
    if (m) { J.done = +m[1]; J.of = +m[2]; }
  }, o.exe).then((r) => {
    if (r.error || !fs.existsSync(out)) { J.state = "error"; J.error = r.error || "no video written"; return; }
    const res = readJSON(jobFile + ".out.json", {});
    const scene = require("./blenderScene");
    const saved = scene.save(fs.readFileSync(out), { name: STEM(stem) + `_${start}-${end}`, frames: res.frames, fps: res.fps });
    J.name = saved.name;
    if (rr) {                                   // 2.540.0: the references -> a real first frame -> 3DREAL animates it
      const boxes = {}; (res.objects2d || []).forEach((b) => { boxes[b.id] = b.box; });
      const items = (rr.items || []).map((it) => Object.assign({}, it, { box: boxes[it.object] || null }));
      if (!res.still || !fs.existsSync(res.still)) { J.state = "error"; J.error = "Blender wrote no first frame"; return; }
      const c = require("./realRefs").start({ kind: "video", source: "blender", token: rr.token, items, frame: res.still, video: saved.path, seconds: saved.seconds,
        style_id: rr.style_id, prompt: o.prompt, ltx: { width: res.width, height: res.height, ic_lora: o.ic_lora, ic_strength: o.ic_strength, seed: o.seed } });
      J.realrefs = c.id; J.job = c.edit; J.note = c.note;
      J.objects2d = res.objects2d || [];
    } else if (o.render) {
      const q = scene.queue(saved, { prompt: o.prompt, width: res.width, height: res.height, ic_lora: o.ic_lora, ic_strength: o.ic_strength, seed: o.seed });
      if (q.error) { J.state = "error"; J.error = q.error; return; }
      J.job = q.job.id;
      J.note = q.note;
      try { q.job.log.push(`[blender] ${info.source ? path.basename(info.source) : stem}: frames ${start}-${end}` + (view ? " through the preview's view" : " through the scene camera")); } catch { /* fine */ }
    }
    J.state = "done";
  }).catch((e) => { J.state = "error"; J.error = String(e.message || e); })
    .finally(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } });
  return { id, state: "running", of: J.of };
}

/** 2.405.0: the working copy changed outside (a Daz merge) - export it again -> the state */
async function reexport(stem, exe) {
  if (!readJSON(file(stem, ".info.json"), null)) throw bad("that scene is not open", 404);
  await exportGlb(stem, exe);
  return state(stem);
}
const tmpPath = (stem) => file(stem, ".tmp");

module.exports = { MODES, stemOf, open, current, close, glbPath, setEdits, setMode, save, render, renderStatus, clean, state, run, dir,
                   reexport, tmpPath };
