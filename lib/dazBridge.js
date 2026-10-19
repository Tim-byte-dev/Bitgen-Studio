/* bitGen Studio — lib/dazBridge.js (2.405.0): DAZ STUDIO -> bitGen.
 *
 * Tim (verbatim): "can we have a daz3d to bitgen bridge?" and "can we add option to merge daz3d scene with blender scene
 * - create a dialog for list of objects, lights, cameras to merge. dialogs must have a titlebar".
 *
 * The bridge is a Daz Studio script (daz/bitgen_bridge/bitGen Bridge.dsa - its own dialog, in Daz's Content Library ->
 * Scripts -> bitGen). It renders / exports into Daz's temp folder and POSTs ONE small JSON with those files' paths to
 * /api/daz/send (curl, which Windows 10+ and macOS ship) - bitGen runs on the same computer, so the files are read where
 * Daz wrote them. Kinds:
 *   render   {frames: [png ...], fps, name, prompt, ic_lora, ic_strength, render}  the timeline range rendered by Daz
 *            (Iray / Filament / 3Delight - its render settings) -> daz_<name>.mp4 in Video assets (long side 1280,
 *            multiples of 32, up to 30 s) and, with render, the LTX 2.3 3DREAL job (render -> real, lib/blenderScene)
 *   picture  {file, name}                     one render -> the Gallery (+ Images assets): references, first frames, 🧊
 *   scene    {file: .fbx, name, fps, start, end, width, height, merge}  Daz's scene (figures + rig + animation, props,
 *            lights, cameras) -> Blender: <project>/blender/daz/<name>.blend; opened in the 🟧 .blend preview - or, with
 *            merge and a scene open there, held for the page's MERGE dialog (the objects / lights / cameras to bring in)
 *   figure   {file: .fbx, name, layer}       the selected figure / prop -> a .glb in models3d/ (+ "add as a 3D layer"),
 *            through the Blender bridge's inbox (lib/blender.push) like the Blender add-on's sends
 * Each send is an inbox item (GET /api/daz/inbox?since=) the page shows; merge(id, pick) / openItem(id) / dismiss(id).
 * Blender does the FBX work (scripts/blend_daz.py through lib/blendView.run). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");

const KINDS = ["render", "picture", "scene", "figure"];
const PIC_EXT = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".exr", ".webp"];
let seq = 0;
const items = [];
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const stemOf = (s) => require("./blenderScene").stem(s || "daz");

function item(kind, name) {
  seq += 1;
  const it = { id: Math.random().toString(16).slice(2, 10), seq, kind, name, state: "working", message: "", at: Date.now(),
               project: core.getProject() };
  items.push(it);
  while (items.length > 100) items.shift();
  return it;
}
const touch = (it, patch) => { Object.assign(it, patch); seq += 1; it.seq = seq; return it; };
function find(id) { const it = items.find((x) => x.id === String(id || "")); if (!it) throw bad("no such Daz send", 404); return it; }
const pub = (it) => { const { project, ...rest } = it; void project; return rest; };

/** a local file the bridge wrote: it must be there, with the right kind of name */
function local(p, exts, what) {
  const f = path.resolve(String(p || ""));
  if (!p || !fs.existsSync(f) || !fs.statSync(f).isFile()) throw bad(`${what} is not there: ${p} - bitGen reads the files where Daz wrote them, so both must run on this computer`);
  if (exts && !exts.includes(path.extname(f).toLowerCase())) throw bad(`${what} must be ${exts.join(" / ")}: ${path.basename(f)}`);
  return f;
}
const run = (cmd, args) => new Promise((ok) => execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (e, so, se) => ok({ code: e ? (e.code || 1) : 0, out: String(so || ""), err: String(se || "") })));
async function size(file) {
  const r = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]);
  try { const s = JSON.parse(r.out).streams[0]; return { w: +s.width, h: +s.height }; } catch { return null; }
}
/** the long side at most 1280, both sides multiples of 32 (what LTX takes) */
function fit(w, h, longest) {
  const L = longest || 1280, k = Math.min(1, L / Math.max(w, h));
  const r32 = (v) => Math.floor(v / 32 + 0.5 - 1e-9) * 32;      // a tie rounds down, as the Blender add-on's (1920x1080 -> 1280x704)
  return { w: Math.max(256, r32(w * k)), h: Math.max(256, r32(h * k)) };
}

/* ---------- render: frames -> mp4 -> Video assets (+ the 3DREAL job) */
async function doRender(it, b) {
  const list = (Array.isArray(b.frames) ? b.frames : []).map(String);
  if (list.length < 2) throw bad("the render needs at least two frames (set the play range in Daz's timeline)");
  const frames = list.map((f, i) => local(f, PIC_EXT, `frame ${i + 1}`)).sort((a, c) => a.localeCompare(c, undefined, { numeric: true }));
  const fps = Math.max(1, Math.min(120, Math.round(+b.fps || 30)));
  const maxF = Math.floor(30 * fps);
  const use = frames.slice(0, maxF);
  const notes = [];
  if (frames.length > maxF) notes.push(`${frames.length} frames - the first ${maxF} kept (LTX takes up to 30 s)`);
  const s0 = await size(use[0]);
  if (!s0) throw bad("ffprobe could not read the first frame " + path.basename(use[0]));
  const t = fit(s0.w, s0.h);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3_daz_"));
  try {
    use.forEach((f, i) => {
      const d = path.join(tmp, `f_${String(i + 1).padStart(5, "0")}${path.extname(f).toLowerCase()}`);
      try { fs.linkSync(f, d); } catch { fs.copyFileSync(f, d); }
    });
    const ext = path.extname(use[0]).toLowerCase();
    const out = path.join(tmp, "daz.mp4");
    touch(it, { message: `encoding ${use.length} frames ${s0.w}x${s0.h} -> ${t.w}x${t.h} at ${fps} fps …` });
    const r = await run("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "f_%05d" + ext),
      "-vf", `scale=${t.w}:${t.h}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", out]);
    if (r.code || !fs.existsSync(out)) throw bad("ffmpeg could not make the video: " + r.err.slice(-300), 500);
    const scene = require("./blenderScene");
    const saved = scene.save(fs.readFileSync(out), { name: b.name || "daz", frames: use.length, fps, prefix: "daz_" });
    touch(it, { video: saved.name, seconds: saved.seconds, width: t.w, height: t.h });
    if (b.render) {
      const q = scene.queue(saved, { prompt: b.prompt, width: t.w, height: t.h, ic_lora: b.ic_lora, ic_strength: b.ic_strength, seed: b.seed });
      if (q.error) { notes.push(q.error); }
      else {
        touch(it, { job: q.job.id });
        try { q.job.log.push(`[daz] ${saved.name}: ${use.length} frames from Daz Studio -> LTX 2.3 3DREAL (render -> real)`); } catch { /* fine */ }
      }
    }
    return `${use.length} frames -> Video assets ${saved.name} (${t.w}x${t.h}, ${saved.seconds} s)` + (it.job ? ` · LTX 2.3 3DREAL job ${it.job}` : "")
      + (notes.length ? " · " + notes.join(" · ") : "");
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
}

/* ---------- picture: the Gallery + Images assets */
function doPicture(it, b) {
  const f = local(b.file, PIC_EXT, "the render");
  const out = core.pDir("output");
  fs.mkdirSync(out, { recursive: true });
  const auto = require("./autoAssets");
  const base = "daz_" + stemOf(b.name || path.basename(f));
  let name = base + path.extname(f).toLowerCase(), k = 1;
  while (fs.existsSync(path.join(out, name))) name = `${base}_${++k}${path.extname(f).toLowerCase()}`;
  fs.copyFileSync(f, path.join(out, name));
  const reg = auto.register(name, { outputDir: out, videoDir: core.pDir("video"), imageDir: core.pDir("images"), soundDir: core.pDir("sound") });
  touch(it, { picture: name });
  return `${name} -> the Gallery` + (reg.added ? ` and Images assets (${reg.name})` : "");
}

/* ---------- scene: FBX -> .blend -> the preview / the merge dialog */
function dazDir() { const d = path.join(core.projDir(core.getProject()), "blender", "daz"); fs.mkdirSync(d, { recursive: true }); return d; }
async function doScene(it, b) {
  const fbx = local(b.file, [".fbx"], "the FBX");
  const bv = require("./blendView");
  const d = dazDir();
  const base = bv.stemOf(b.name || path.basename(fbx));
  let stem = base;
  for (let k = 2; fs.existsSync(path.join(d, stem + ".blend")); k++) stem = `${base}_${k}`;
  const out = path.join(d, stem + ".blend"), infoF = path.join(d, stem + ".info.json");
  try { fs.copyFileSync(fbx, path.join(d, stem + ".fbx")); } catch { /* the copy is a keepsake */ }
  touch(it, { message: "Blender is reading the Daz scene …" });
  const fps = Math.max(1, Math.round(+b.fps || 30));
  const r = await bv.run(["daz_scene", fbx, out, infoF, fps, Math.round(+b.start || 0), Math.round(+b.end || 0), Math.round(+b.width || 0), Math.round(+b.height || 0)], null, b.exe);
  if (r.error || !fs.existsSync(out)) throw bad("Blender could not read the Daz scene: " + (r.error || "no .blend"), 500);
  const info = JSON.parse(fs.readFileSync(infoF, "utf8"));
  const notes = r.lines.filter((l) => l.startsWith("H3B note ")).map((l) => l.slice(9));
  touch(it, { blend: out, stem, objects: info.objects, fps: info.fps, camera: info.camera, frames: [info.frame_start, info.frame_end], notes });
  const cur = bv.current();
  if (b.merge && cur && cur.stem) {
    touch(it, { merge: true, into: cur.stem });
    return { state: "merge", message: `${info.objects.length} object(s) from Daz - pick what to merge into ${cur.stem} (bitGen's merge dialog)` };
  }
  const st = await bv.open(out, { fresh: true, exe: b.exe });
  touch(it, { opened: st.stem, merge: false });
  return `${info.objects.length} object(s) -> blender/daz/${stem}.blend, open in the 🟧 preview` + (b.merge ? " (no scene was open to merge into)" : "");
}

/** the merge dialog's answer: pick = {names: [...], camera, range} */
async function merge(id, pick, exe) {
  const it = find(id);
  if (it.kind !== "scene" || it.state !== "merge") throw bad("that Daz send is not waiting to be merged");
  const p = pick || {};
  const names = (Array.isArray(p.names) ? p.names : []).map(String).filter((n) => (it.objects || []).some((o) => o.name === n));
  if (!names.length) throw bad("pick at least one object to merge");
  const bv = require("./blendView");
  const cur = bv.current();
  if (!cur || !cur.stem) {               // the scene was closed meanwhile: open the Daz scene on its own
    const st = await bv.open(it.blend, { fresh: true, exe });
    touch(it, { state: "done", opened: st.stem, message: "no scene open any more - the Daz scene opened on its own" });
    return st;
  }
  const tmp = bv.tmpPath(cur.stem);
  try { fs.copyFileSync(tmp, tmp + ".premerge"); } catch { /* first merge */ }
  const pickF = path.join(dazDir(), it.stem + ".pick.json");
  const cam = p.camera && names.includes(String(p.camera)) ? String(p.camera) : null;
  fs.writeFileSync(pickF, JSON.stringify({ names, camera: cam, range: p.range !== false, fps: it.fps }));
  const r = await bv.run(["merge", tmp, it.blend, pickF, tmp], null, exe);
  if (r.error) throw bad("Blender could not merge: " + r.error, 500);
  const st = await bv.reexport(cur.stem, exe);
  const notes = r.lines.filter((l) => l.startsWith("H3B note ")).map((l) => l.slice(9));
  touch(it, { state: "done", merged: names, mergedInto: cur.stem, message: notes.join(" · ") });
  return { ...st, merged: names, notes };
}
async function openItem(id, exe) {
  const it = find(id);
  if (!it.blend) throw bad("that Daz send has no scene to open");
  const st = await require("./blendView").open(it.blend, { fresh: true, exe });
  touch(it, { state: "done", opened: st.stem, message: "opened on its own" });
  return st;
}
function dismiss(id) { const it = find(id); touch(it, { state: it.state === "merge" ? "done" : it.state, dismissed: true }); return pub(it); }

/* ---------- figure: FBX -> .glb -> models3d (+ a 3D layer) */
async function doFigure(it, b) {
  const fbx = local(b.file, [".fbx"], "the FBX");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3_dazfig_"));
  try {
    const glb = path.join(tmp, "model.glb");
    touch(it, { message: "Blender is converting the figure …" });
    const r = await require("./blendView").run(["fbx2glb", fbx, glb], null, b.exe);
    if (r.error || !fs.existsSync(glb)) throw bad("Blender could not convert the figure: " + (r.error || "no .glb"), 500);
    const pushed = require("./blender").push(stemOf(b.name || path.basename(fbx)) + ".glb", fs.readFileSync(glb), !!b.layer);
    touch(it, { model: pushed.name });
    return `models3d/${pushed.name}` + (b.layer ? " - added as a 3D layer on the timeline" : " - ＋ Model in the 🟧 preview, or a 3D layer");
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
}

/** POST /api/daz/send -> {ok, id, state, message} (the Daz script shows the message) */
function send(body) {
  const b = body || {};
  const kind = String(b.kind || "");
  if (!KINDS.includes(kind)) throw bad("kind: " + KINDS.join(" | "));
  const it = item(kind, String(b.name || "daz").slice(0, 80));
  const work = kind === "render" ? doRender(it, b) : kind === "picture" ? Promise.resolve().then(() => doPicture(it, b))
    : kind === "scene" ? doScene(it, b) : doFigure(it, b);
  const finished = work.then((m) => {
    if (m && typeof m === "object") touch(it, m); else touch(it, { state: "done", message: String(m || "") });
    return pub(it);
  }).catch((e) => { touch(it, { state: "error", message: String((e && e.message) || e) }); return pub(it); });
  return { finished, item: it };
}
function inbox(since) {
  const s = Number(since) || 0;
  return { seq, items: items.filter((i) => i.seq > s && i.project === core.getProject()).map(pub) };
}
function ping() {
  let v = "";
  try { v = require("../package.json").version; } catch { v = ""; }
  let bl = null;
  try { bl = require("./blender").find(); } catch { bl = null; }
  return { ok: true, app: "bitGen Studio", version: v, project: core.getProject(), blender: !!bl };
}

module.exports = { KINDS, send, inbox, merge, openItem, dismiss, ping, fit, find: (id) => pub(find(id)) };
