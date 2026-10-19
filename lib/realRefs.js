// bitGen Studio — lib/realRefs.js (2.540.0): A BLENDER / UNREAL RENDER MADE REAL WITH THE REFERENCE DOCKER'S PICTURES.
// Tim (verbatim): "can we make it so the timeline and image-edit renders of blender and unreal use our references from the
// reference docker. so it sees a block in a blender layer, the block is a car, the reference for the car is in our
// reference docker etc. for all objects/meshes and is animated with our 3dreal" (matched by name + set by hand).
//
//   upload(files, refs)     the pictures the objects use -> <project>/temp/realrefs/<token>/ref<i>.<ext> + refs.json
//                           {refs: [{file, desc, role, name}]} -> {token, refs}
//   start(spec)             spec = {kind: "image" | "video", token, items: [{object, box, ref}], frame (a PNG on disk -
//                           the render's FIRST frame / the layer's picture), video (kind video: the render), seconds,
//                           style_id (an edit style; "" = the one that takes the most pictures), prompt, source
//                           ("blender" | "unreal"), ltx: {ic_lora, ic_strength, seed}}
//                           1. an EDIT image job: Picture 1 = the frame, Picture 2… = the references, the prompt says
//                              which object becomes which (static/realrefs.js framePrompt) -> a real first frame
//                           2. kind video: when it is done, LTX 2.3 + 3DREAL with THAT picture as the first frame and the
//                              render as the guide (lib/blenderScene.queue first) - the prompt names every object
//                           -> {id, edit (job id), take, left, note}
//   status(id)              {id, kind, state: edit | real | done | error, edit, real, error, note, picture}
//   editStyles()            the edit styles and how many pictures each takes [{id, name, slots, max}]
//   firstFrame(video, out)  ffmpeg: a video's first frame -> PNG (an Unreal clip)
// A chain is followed on the server (a page that closes does not stop it). Routes: routes/realRefs.js.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");
const R = require("../static/realrefs.js");

const MAX_REFS = 7;
const SIGS = [[".png", [0x89, 0x50, 0x4e, 0x47]], [".jpg", [0xff, 0xd8, 0xff]], [".webp", [0x52, 0x49, 0x46, 0x46]]];
const bad = (msg, status) => { const e = new Error(msg); e.status = status || 400; return e; };
const clean = (t, n) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, n || 200);

function rootDir() { const d = path.join(core.tempDir(), "realrefs"); fs.mkdirSync(d, { recursive: true }); return d; }
function tokDir(token) {
  if (!/^[a-z0-9]{6,32}$/.test(String(token || ""))) throw bad("no such reference set (upload the pictures first)", 404);
  const d = path.join(rootDir(), token); if (!fs.existsSync(d)) throw bad("no such reference set (upload the pictures first)", 404);
  return d;
}
const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** a picture's size from its header (PNG / JPEG) -> [w, h] | null (pure) */
function sizeOf(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf.slice(12, 16).toString("latin1") === "IHDR") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}
/** the size the edit renders at: the frame's aspect, about a megapixel, 16-px steps (pure) */
function renderSize(w, h) {
  const W = Math.max(16, +w || 1024), H = Math.max(16, +h || 576), k = Math.sqrt((1024 * 1024) / (W * H));
  const r16 = (v) => Math.max(256, Math.round(v / 16) * 16);
  return [r16(W * k), r16(H * k)];
}

/** the pictures -> kept for one render */
function upload(files, refs) {
  const list = (files || []).slice(0, MAX_REFS);
  if (!list.length) throw bad("no reference pictures");
  const token = stamp().replace(/[^a-z0-9]/g, "").slice(0, 20), d = path.join(rootDir(), token);
  fs.mkdirSync(d, { recursive: true });
  const out = list.map((f, i) => {
    const buf = f && f.buffer, hit = Buffer.isBuffer(buf) ? SIGS.find(([, sig]) => sig.every((v, j) => buf[j] === v)) : null;
    if (!hit) throw bad(`reference ${i + 1} is not a PNG, JPEG or WebP picture`);
    const file = "ref" + i + hit[0];
    fs.writeFileSync(path.join(d, file), buf);
    const m = (refs || [])[i] || {};
    return { file, desc: clean(m.desc), role: clean(m.role, 30), name: clean(m.name, 120) };
  });
  fs.writeFileSync(path.join(d, "refs.json"), JSON.stringify({ refs: out }, null, 1));
  return { token, refs: out };
}
function readRefs(token) { const d = tokDir(token); let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(d, "refs.json"), "utf8")); } catch { j = {}; } return { dir: d, refs: j.refs || [] }; }

/** the edit styles + how many pictures each takes (a Qwen Image Edit Plus graph gets slots up to 3) */
function editStyles() {
  const styles = require("./styles"), aiEdit = require("./aiEdit");
  let list = []; try { list = styles.read(core.STYLES_DIR, "image"); } catch { list = []; }
  const out = [];
  for (const e of aiEdit.engines(list, core.BASE).edit) {
    const s = list.find((x) => x.id === e.id); if (!s) continue;
    let slots = 1, max = 1;
    try { const g = aiEdit.editGraph(s, core.BASE); slots = g.slots || 1; max = slots; try { aiEdit.composePlan(s, Math.max(slots, 3), core.BASE); max = Math.max(slots, 3); } catch { /* as it is */ } } catch { continue; }
    out.push({ id: s.id, name: s.name, slots, max });
  }
  return out.sort((a, b) => b.max - a.max || a.name.localeCompare(b.name));
}
/** the style an edit runs on + its graph for n pictures -> {style, workflow, graph | null, take} (take = pictures used) */
function planFor(styleId, n) {
  const styles = require("./styles"), aiEdit = require("./aiEdit");
  const all = editStyles(); if (!all.length) throw bad("no edit style - add Qwen Image Edit 2511, Qwen Image 2.1 edit or a FLUX.2 Klein edit style (Settings -> Image)");
  const pick = all.find((x) => x.id === styleId) || all[0];
  const style = styles.byId(core.STYLES_DIR, pick.id);
  const take = Math.max(1, Math.min(n, pick.max));
  const e = aiEdit.editGraph(style, core.BASE);
  if (take <= e.slots) return { style, workflow: e.workflow, graph: null, take };
  const p = aiEdit.composePlan(style, take, core.BASE);
  return { style, workflow: p.workflow, graph: p.graph, take };
}

const CHAINS = new Map();
function status(id) { const c = CHAINS.get(String(id)); if (!c) throw bad("no such render", 404); return Object.assign({}, c, { timer: undefined }); }

/** one render made real (see the header) */
function start(spec) {
  const s = spec || {}, kind = s.kind === "video" ? "video" : "image";
  const { dir, refs } = readRefs(s.token);
  if (!s.frame || !fs.existsSync(s.frame)) throw bad("the render's picture is missing");
  if (kind === "video" && !(s.video && fs.existsSync(s.video))) throw bad("the render's video is missing");
  // the items whose reference is in the set
  const items = (Array.isArray(s.items) ? s.items : []).slice(0, 60).map((it) => ({ object: clean(it.object, 80), box: Array.isArray(it.box) && it.box.length === 4 ? it.box.map(Number) : null, ref: parseInt(it.ref, 10) }))
    .filter((it) => it.object && refs[it.ref]);
  if (!items.length) throw bad("no object has a reference picture - pick one for an object (or name the objects after the references)");
  const used = [...new Set(items.map((it) => it.ref))];
  const plan = planFor(String(s.style_id || ""), 1 + used.length);
  const keep = used.slice(0, plan.take - 1), left = used.length - keep.length;
  const its = items.filter((it) => keep.includes(it.ref));
  const qwen21 = (() => { try { return require("./qwenRefs").isQwen21Style(plan.style, core.BASE); } catch { return false; } })();
  const rs = refs.map((r) => ({ desc: r.desc, role: r.role, name: r.name }));
  const fp = R.framePrompt(its, rs, s.prompt, { kind: s.source === "unreal" ? "unreal" : "blender", tags: qwen21 });
  const buf = fs.readFileSync(s.frame), sz = sizeOf(buf) || [1280, 720], [w, h] = renderSize(sz[0], sz[1]);
  const id = "rr" + stamp().replace(/[^a-z0-9]/g, "");
  const frame = path.join(dir, "frame" + (path.extname(s.frame) || ".png"));
  if (path.resolve(s.frame) !== path.resolve(frame)) fs.copyFileSync(s.frame, frame);
  let workflow = plan.workflow;
  if (plan.graph) { workflow = path.join(dir, id + "-edit.json"); fs.writeFileSync(workflow, JSON.stringify(plan.graph, null, 1)); }
  const styles = require("./styles"), imageSeed = require("./imageSeed");
  const first = imageSeed.forRequest(null);
  const p = { mode: "image", prompt: fp.prompt.slice(0, 7000), style: styles.applyLoraWeights(plan.style, null), style_id: plan.style.id, style_name: plan.style.name,
    width: w, height: h, batch: 1, workflow, aiedit: "compose", images: [frame].concat(fp.pics.filter((k) => keep.includes(k)).map((k) => path.join(dir, refs[k].file))),
    workflow_note: `${s.source === "unreal" ? "Unreal" : "Blender"} render -> real with ${keep.length} reference picture(s) (Picture 1 = the render)`, no_assets: kind === "image",
    seed: first.seed, seed_random: first.random, realrefs: id };
  const A = core.makeJob(p);
  A.chunk = { i: 0, n: 1 };
  try { A.log.push(`[realrefs] ${its.map((it) => `${it.object} -> ${refs[it.ref].desc || refs[it.ref].name}`).join("; ")}` + (left ? ` (${left} more picture(s) left out: ${plan.style.name} takes ${plan.take})` : "")); } catch { /* fine */ }
  const C = { id, kind, source: s.source === "unreal" ? "unreal" : "blender", state: "edit", edit: A.id, real: null, error: "", picture: "", take: keep.length, left,
    note: `${keep.length} reference picture(s) with ${plan.style.name}` + (left ? ` - ${left} left out (it takes ${plan.take - 1})` : ""), at: Date.now() };
  CHAINS.set(id, C);
  try { require("./testPlan").event("realrefs", { what: C.source + " " + kind }); } catch { /* the 🧪 checklist */ }
  if (kind === "video") {
    const vprompt = R.videoPrompt(its, rs, s.prompt);
    C.timer = setInterval(() => {
      const j = core.jobs.get(A.id); if (!j) return;
      if (j.status === "failed" || j.status === "cancelled") { clearInterval(C.timer); C.state = "error"; C.error = "the first-frame edit " + j.status; return; }
      if (j.status !== "done" || !j.output) return;
      clearInterval(C.timer);
      const pic = core.outputDirs().map((d) => path.join(d, path.basename(j.output))).find((f) => fs.existsSync(f));
      if (!pic) { C.state = "error"; C.error = "the first-frame picture is not in the outputs"; return; }
      C.picture = path.basename(pic);
      const scene = require("./blenderScene");
      const q = scene.queue({ path: s.video, name: path.basename(s.video), seconds: Math.max(1, Math.min(30, Math.round(+s.seconds || 5))) },
        { prompt: vprompt, width: (s.ltx || {}).width, height: (s.ltx || {}).height, ic_lora: (s.ltx || {}).ic_lora, ic_strength: (s.ltx || {}).ic_strength, seed: (s.ltx || {}).seed, first: pic });
      if (q.error) { C.state = "error"; C.error = q.error; return; }
      C.real = q.job.id; C.state = "real";
      try { q.job.log.push(`[realrefs] first frame ${C.picture} (the references) -> LTX 2.3 3DREAL animates it along the render`); } catch { /* fine */ }
      const t2 = setInterval(() => { const b = core.jobs.get(C.real); if (!b) return; if (["done", "failed", "cancelled"].includes(b.status)) { clearInterval(t2); C.state = b.status === "done" ? "done" : "error"; if (b.status !== "done") C.error = "the 3DREAL render " + b.status; } }, 3000);
      if (t2.unref) t2.unref();
    }, 2000);
    if (C.timer.unref) C.timer.unref();
  } else {
    const t = setInterval(() => { const j = core.jobs.get(A.id); if (!j) return; if (["done", "failed", "cancelled"].includes(j.status)) { clearInterval(t); C.state = j.status === "done" ? "done" : "error"; if (j.status !== "done") C.error = "the edit " + j.status; } }, 2000);
    if (t.unref) t.unref();
  }
  return { id, edit: A.id, take: keep.length, left, note: C.note, prompt: p.prompt };
}

/** a video's first frame -> PNG (ffmpeg) */
function firstFrame(video, out) {
  return new Promise((ok, no) => execFile("ffmpeg", ["-y", "-v", "error", "-i", video, "-frames:v", "1", out], { maxBuffer: 4 << 20 },
    (err, _o, se) => (err || !fs.existsSync(out) ? no(bad("could not read the first frame: " + String(se || (err && err.message) || "").trim().split("\n").pop(), 500)) : ok(out))));
}

module.exports = { MAX_REFS, sizeOf, renderSize, upload, readRefs, editStyles, planFor, start, status, firstFrame, tokDir, CHAINS };
