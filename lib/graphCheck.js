// bitGen Studio — lib/graphCheck.js (2.587.0): IMPORT & CHECK A COMFYUI WORKFLOW (Settings ▸ ComfyUI ▸ Graphs).
//
// Tim: "in settings -comfyui- graph can we add total number of input images,videos,audio and allow user to import a
// comfy graph, bitgen checks the graph and adds the image/video/audio inputs as needed and saves the output and reports
// missing nodes. This should make bitgen futureproof. bitgen will do a run of the workflow and if successful it will
// save it to workflows if unsuccessful it will report the errors" + "show the graph in the settings-comfyui-graph tab
// when file is imported".
//
//   check(graph, info)    a UI export or an API prompt (+ ComfyUI's /object_info) ->
//                         {api (fixed), media {images, videos, audio}, loaders, outputs, fixes, missing_nodes,
//                          missing_models, controls (suggested), problems, warnings, ok}
//     · the loaders (LoadImage / LoadVideo / LoadAudio ...) are the inputs - the reference dock fills them in order
//     · the outputs: a Preview node becomes its Save node, a video combine with save_output off is turned on - so the
//       result is a file bitGen can collect; none at all = a problem
//     · missing nodes: class types this ComfyUI does not have; missing models: a model file a loader names that is
//       not in ComfyUI's list (the combo's options)
//     · suggested controls: the prompt (from the prompt box), the negative, seed (bitGen's), steps, cfg, width / height,
//       length - wired to the nodes, so the imported workflow runs from Generate ▸ ⚙ Graph at once
//   view(graph, report)   the picture of the graph: {nodes [{id, type, title, x, y, w, h, tags}], links [{from, to}]}
//                         - a UI export's own positions; an API prompt laid out by depth
//   counts(graph)         {images, videos, audio} for either format (the tab's "total number of inputs")
//   placeholders(dir)     a test picture / sound / video for the test run (ffmpeg; a picture without it)
//   stage / readStage     the checked import between ▶ Test run and the save (workspace/graphcheck/<token>/)
// Pure: counts, outputsOf, fixOutputs, missingNodes, missingModels, suggestControls, view, check (scripts/test-graphcheck587.js).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const CG = require("./comfyGraphs");

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number") && Number.isInteger(Number(v[1]));
const LOADER_KIND = { LoadImage: "images", LoadImageMask: "images", LoadImageOutput: "images", ImageBatchLoader: "images",
  LoadVideo: "videos", VHS_LoadVideo: "videos", VHS_LoadVideoPath: "videos", LoadAudio: "audio", VHS_LoadAudio: "audio", LoadAudioUpload: "audio", VHS_LoadAudioUpload: "audio" };
// the nodes that write a file ComfyUI's history reports (graph_worker.py collects by extension)
const SAVERS = { SaveImage: "image", SaveAnimatedWEBP: "video", SaveAnimatedPNG: "video", SaveWEBM: "video", SaveVideo: "video", SaveAudio: "audio",
  SaveAudioMP3: "audio", SaveAudioOpus: "audio", VHS_VideoCombine: "video", "SaveImage|pysssss": "image", SaveGLB: "3d", Save3D: "3d" };
const PREVIEW_TO_SAVE = {
  PreviewImage: { class_type: "SaveImage", kind: "image", keep: ["images"] },
  PreviewAudio: { class_type: "SaveAudio", kind: "audio", keep: ["audio"] },
};
const MODEL_EXT = /\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i;
const TEXT_KEYS = ["text", "prompt", "value", "string", "positive_prompt"];

/* ------------------------------------------------------------------ pure */
/** the inputs a workflow takes: how many pictures, videos and sounds (either format) */
function counts(graph) {
  const c = { images: 0, videos: 0, audio: 0 };
  if (CG.isApi(graph)) { for (const l of CG.loaderNodes(graph)) c[l.kind]++; return c; }
  if (CG.isUi && CG.isUi(graph)) for (const n of graph.nodes || []) { if (n.mode === 4 || n.mode === 2) continue; const k = LOADER_KIND[n.type]; if (k) c[k]++; }
  return c;
}
/** the nodes that save a file -> [{node, class_type, kind}] */
function outputsOf(api, info) {
  const out = [];
  for (const [id, n] of Object.entries(api || {})) {
    const ct = String((n && n.class_type) || "");
    if (/^Preview/i.test(ct)) continue;                                      // a preview writes no file
    let kind = SAVERS[ct] || "";
    const guess = () => (/audio|mp3|wav|flac/i.test(ct) ? "audio" : /image|png|jpg/i.test(ct) && !/video/i.test(ct) ? "image" : "video");
    if (!kind && /Save/i.test(ct)) kind = guess();                            // SaveVideo, a pack's ChainSegmentSave ...
    if (!kind && /VideoCombine/i.test(ct)) kind = "video";
    if (!kind && info && info[ct] && info[ct].output_node === true) kind = guess();   // ComfyUI's own OUTPUT_NODE flag
    if (kind) out.push({ node: String(id), class_type: ct, kind });
  }
  return out;
}
/** a preview becomes its save node, a combine that does not save does (a new graph) -> {api, fixes} */
function fixOutputs(api) {
  const g = JSON.parse(JSON.stringify(api || {}));
  const fixes = [];
  for (const [id, n] of Object.entries(g)) {
    const to = PREVIEW_TO_SAVE[n && n.class_type];
    if (to) {
      const ins = {};
      for (const k of to.keep) if (n.inputs && k in n.inputs) ins[k] = n.inputs[k];
      ins.filename_prefix = "bitgen_graph";
      g[id] = Object.assign({}, n, { class_type: to.class_type, inputs: ins });
      fixes.push({ node: id, from: n.class_type, to: to.class_type, why: "a preview writes no file - it saves now" });
    }
    if (n && /VideoCombine/i.test(n.class_type || "") && n.inputs && n.inputs.save_output === false) {
      g[id].inputs.save_output = true;
      fixes.push({ node: id, from: n.class_type + " (save_output off)", to: n.class_type + " (save_output on)", why: "the video was not being saved" });
    }
  }
  return { api: g, fixes };
}
/** class types ComfyUI does not have (info = /object_info) */
function missingNodes(api, info) {
  if (!info) return [];
  return [...new Set(Object.values(api || {}).map((n) => String((n && n.class_type) || "")).filter((ct) => ct && !info[ct]))].sort();
}
const optsOf = (spec) => {
  if (!Array.isArray(spec)) return null;
  if (Array.isArray(spec[0])) return spec[0];                                   // the old [[a, b], {...}] form
  if (spec[0] === "COMBO" && spec[1] && Array.isArray(spec[1].options)) return spec[1].options;
  return null;
};
/** model files a node names that ComfyUI does not list -> [{node, class_type, input, value}] */
function missingModels(api, info) {
  const out = [];
  if (!info) return out;
  for (const [id, n] of Object.entries(api || {})) {
    const ci = info[n && n.class_type]; if (!ci || !n.inputs) continue;
    const specs = Object.assign({}, (ci.input || {}).required || {}, (ci.input || {}).optional || {});
    for (const [k, v] of Object.entries(n.inputs)) {
      if (typeof v !== "string" || !MODEL_EXT.test(v)) continue;
      const opts = optsOf(specs[k]); if (!opts) continue;
      const norm = (s) => String(s).replace(/\\/g, "/").toLowerCase();
      if (!opts.some((o) => norm(o) === norm(v) || norm(o).split("/").pop() === norm(v).split("/").pop())) out.push({ node: String(id), class_type: n.class_type, input: k, value: v });
    }
  }
  return out;
}
/** walk back from a sampler's conditioning input to the node that holds the words -> {node, input} | null */
function textBehind(api, link, depth) {
  if (!isLink(link) || (depth || 0) > 8) return null;
  const n = api[String(link[0])]; if (!n || !n.inputs) return null;
  for (const k of TEXT_KEYS) if (typeof n.inputs[k] === "string") return { node: String(link[0]), input: k };
  for (const k of TEXT_KEYS) if (isLink(n.inputs[k])) { const t = textBehind(api, n.inputs[k], (depth || 0) + 1); if (t) return t; }
  for (const v of Object.values(n.inputs)) if (isLink(v)) { const t = textBehind(api, v, (depth || 0) + 1); if (t) return t; }
  return null;
}
/** the controls an imported workflow gets, wired: the prompt / negative (from the prompt box), seed (bitGen's), steps,
 *  cfg, width / height, length (pure) */
function suggestControls(api) {
  const g = api || {}, C = [];
  const add = (c) => { if (c.targets.length) C.push(c); };
  const samplers = Object.entries(g).filter(([, n]) => n && n.inputs && (isLink(n.inputs.positive) || ("steps" in n.inputs && ("seed" in n.inputs || "noise_seed" in n.inputs))));
  const pos = [], neg = [];
  for (const [, n] of samplers) {
    const p = textBehind(g, n.inputs.positive, 0); if (p && !pos.some((x) => x.node === p.node)) pos.push(p);
    const q = textBehind(g, n.inputs.negative, 0); if (q && !neg.some((x) => x.node === q.node) && !pos.some((x) => x.node === q.node)) neg.push(q);
  }
  if (!pos.length) {                                         // no sampler found: the first text encoder's words
    for (const [id, n] of Object.entries(g)) {
      if (!n || !n.inputs || !/TextEncode|Prompt/i.test(n.class_type || "")) continue;
      const k = TEXT_KEYS.find((x) => typeof n.inputs[x] === "string"); if (k) { pos.push({ node: String(id), input: k }); break; }
    }
  }
  const val = (t) => (g[t.node] && g[t.node].inputs ? g[t.node].inputs[t.input] : "");
  add({ id: "prompt", type: "text", label: "Prompt", source: "prompt", hint: "empty = the prompt box", default: pos[0] ? String(val(pos[0])) : "", multiline: true, targets: pos });
  add({ id: "negative", type: "text", label: "Negative", source: "negative", hint: "empty = the negative prompt", default: neg[0] ? String(val(neg[0])) : "", multiline: true, targets: neg });
  const scal = (keys) => { const t = []; for (const [id, n] of Object.entries(g)) { if (!n || !n.inputs) continue; for (const k of keys) if (typeof n.inputs[k] === "number") { t.push({ node: String(id), input: k }); break; } } return t; };
  const first = (t) => (t[0] ? Number(val(t[0])) : 0);
  const seeds = scal(["seed", "noise_seed"]);
  add({ id: "seed", type: "spinner", label: "Seed", source: "seed", hint: "bitGen's seed (Basic Settings)", min: 0, max: 4294967295, step: 1, default: first(seeds), targets: seeds });
  const steps = scal(["steps"]);
  add({ id: "steps", type: "slider", label: "Steps", min: 1, max: Math.max(60, first(steps)), step: 1, default: first(steps) || 20, targets: steps });
  const cfg = scal(["cfg"]);
  add({ id: "cfg", type: "slider", label: "CFG", min: 0, max: Math.max(15, first(cfg)), step: 0.1, default: first(cfg), targets: cfg });
  const wh = Object.entries(g).filter(([, n]) => n && n.inputs && typeof n.inputs.width === "number" && typeof n.inputs.height === "number");
  add({ id: "width", type: "spinner", label: "Width", min: 64, max: 8192, step: 16, default: wh[0] ? wh[0][1].inputs.width : 1024, targets: wh.map(([id]) => ({ node: String(id), input: "width" })) });
  add({ id: "height", type: "spinner", label: "Height", min: 64, max: 8192, step: 16, default: wh[0] ? wh[0][1].inputs.height : 1024, targets: wh.map(([id]) => ({ node: String(id), input: "height" })) });
  const len = scal(["length", "num_frames", "frames"]);
  add({ id: "length", type: "spinner", label: "Length (frames)", min: 1, max: 2000, step: 1, default: first(len) || 1, targets: len });
  return C;
}
/** the picture of the graph (pure): a UI export keeps its own layout; an API prompt is laid out by depth */
function view(graph, report) {
  const R = report || {}, tag = {};
  const mark = (id, t) => { (tag[String(id)] = tag[String(id)] || []).push(t); };
  for (const l of R.loaders || []) mark(l.node, l.kind === "images" ? "image" : l.kind === "videos" ? "video" : "audio");
  for (const o of R.outputs || []) mark(o.node, "output");
  for (const f of R.fixes || []) mark(f.node, "fixed");
  for (const m of R.missing_models || []) mark(m.node, "model");
  const missing = new Set(R.missing_nodes || []);
  if (CG.isUi && CG.isUi(graph)) {
    const nodes = (graph.nodes || []).map((n) => {
      const t = (tag[String(n.id)] || []).slice();
      const k = LOADER_KIND[n.type]; if (k && !t.length) t.push(k === "images" ? "image" : k === "videos" ? "video" : "audio");
      if (missing.has(n.type)) t.push("missing");
      if (n.mode === 4 || n.mode === 2) t.push("bypassed");
      if (/^(Save|Preview)/.test(n.type || "") && !t.includes("output")) t.push("output");
      const pos = Array.isArray(n.pos) ? n.pos : [n.pos && n.pos[0] || 0, n.pos && n.pos[1] || 0];
      const size = Array.isArray(n.size) ? n.size : [n.size && n.size[0] || 220, n.size && n.size[1] || 80];
      return { id: String(n.id), type: String(n.type || "?"), title: String(n.title || n.type || "?"), x: +pos[0] || 0, y: +pos[1] || 0, w: Math.max(80, +size[0] || 220), h: Math.max(30, Math.min(600, +size[1] || 80)), tags: t };
    });
    const ids = new Set(nodes.map((n) => n.id));
    const links = (graph.links || []).map((l) => (Array.isArray(l) ? { from: String(l[1]), to: String(l[3]) } : { from: String(l.origin_id), to: String(l.target_id) })).filter((l) => ids.has(l.from) && ids.has(l.to));
    return { nodes, links, layout: "ui" };
  }
  const api = graph || {}, ids = Object.keys(api);
  const deps = {}; for (const id of ids) deps[id] = Object.values((api[id] || {}).inputs || {}).filter(isLink).map((v) => String(v[0])).filter((d) => d in api);
  const depth = {}, seen = new Set();
  const dOf = (id) => { if (depth[id] != null) return depth[id]; if (seen.has(id)) return 0; seen.add(id); depth[id] = deps[id].length ? 1 + Math.max(...deps[id].map(dOf)) : 0; return depth[id]; };
  ids.forEach(dOf);
  const col = {};
  const nodes = ids.sort((a, b) => depth[a] - depth[b] || Number(a) - Number(b)).map((id) => {
    const d = depth[id]; col[d] = (col[d] || 0) + 1;
    const ct = String((api[id] || {}).class_type || "?");
    const t = (tag[id] || []).slice(); if (missing.has(ct)) t.push("missing");
    const title = ((api[id] || {})._meta || {}).title || ct;
    return { id, type: ct, title: String(title), x: d * 280, y: (col[d] - 1) * 120, w: 220, h: 80, tags: t };
  });
  const links = []; for (const id of ids) for (const d of deps[id]) links.push({ from: d, to: id });
  return { nodes, links, layout: "depth" };
}
/** the whole check (pure given info) - graph = an API prompt (a UI export is converted by the caller) */
function check(api, info) {
  const fx = fixOutputs(api);
  const g = fx.api;
  const loaders = CG.loaderNodes(g);
  const media = { images: 0, videos: 0, audio: 0 }; for (const l of loaders) media[l.kind]++;
  const outputs = outputsOf(g, info);
  const missing_nodes = missingNodes(g, info), missing_models = missingModels(g, info);
  const problems = [], warnings = [];
  if (!info) warnings.push("ComfyUI is not running - the nodes and models could not be checked (start it and check again)");
  if (missing_nodes.length) problems.push("ComfyUI does not have these nodes: " + missing_nodes.join(", ") + " - install their node packs (ComfyUI-Manager ▸ Install Missing Custom Nodes), restart ComfyUI, check again");
  if (!outputs.length) problems.push("the workflow saves nothing - add a Save node (SaveImage / SaveVideo / SaveAudio / a video combine) at its end");
  if (missing_models.length) warnings.push("model files ComfyUI does not have: " + missing_models.map((m) => m.value).join(", ") + " - the test run will fail until they are in ComfyUI's models folders (🧩 Model manager / Settings ▸ Add-ons)");
  const controls = suggestControls(g);
  return { api: g, media, loaders, outputs, fixes: fx.fixes, missing_nodes, missing_models, controls, problems, warnings, ok: !problems.length,
    node_count: Object.keys(g).length };
}

/* ------------------------------------------------------------------ the staged import */
const stageRoot = (core) => path.join(core.WORKSPACE || path.join(core.BASE, "workspace"), "graphcheck");
function stage(core, data) {
  const token = crypto.randomBytes(6).toString("hex");
  const d = path.join(stageRoot(core), token); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "stage.json"), JSON.stringify(Object.assign({ token, at: Date.now() }, data), null, 1));
  // old stages go (a day)
  try { for (const x of fs.readdirSync(stageRoot(core))) { const p = path.join(stageRoot(core), x); if (x !== token && Date.now() - fs.statSync(p).mtimeMs > 86400000) fs.rmSync(p, { recursive: true, force: true }); } } catch { /* fine */ }
  return token;
}
function readStage(core, token) {
  if (!/^[a-f0-9]{12}$/.test(String(token || ""))) return null;
  try { return JSON.parse(fs.readFileSync(path.join(stageRoot(core), token, "stage.json"), "utf8")); } catch { return null; }
}
function writeStage(core, st) { fs.writeFileSync(path.join(stageRoot(core), st.token, "stage.json"), JSON.stringify(st, null, 1)); }
const stageDir = (core, token) => path.join(stageRoot(core), token);

/** a small test picture / sound / video for the test run -> {images, videos, audio} paths (made once) */
function placeholders(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const { spawnSync } = require("child_process");
  const ff = (args) => spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", timeout: 60000 }).status === 0;
  const img = path.join(dir, "bitgen_test.png"), wav = path.join(dir, "bitgen_test.wav"), vid = path.join(dir, "bitgen_test.mp4");
  if (!fs.existsSync(img) && !ff(["-f", "lavfi", "-i", "testsrc2=s=768x768", "-frames:v", "1", img])) fs.writeFileSync(img, tinyPng());
  if (!fs.existsSync(wav)) ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-ac", "2", "-ar", "44100", wav]);
  if (!fs.existsSync(vid)) ff(["-f", "lavfi", "-i", "testsrc2=s=768x432:r=24", "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", vid]);
  return { images: fs.existsSync(img) ? img : "", audio: fs.existsSync(wav) ? wav : "", videos: fs.existsSync(vid) ? vid : "" };
}
/** a 64x64 grey PNG without any tool */
function tinyPng() {
  const zlib = require("zlib"), W = 64, H = 64;
  const raw = Buffer.alloc((W * 3 + 1) * H, 0x80); for (let y = 0; y < H; y++) raw[y * (W * 3 + 1)] = 0;
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

module.exports = { LOADER_KIND, SAVERS, counts, outputsOf, fixOutputs, missingNodes, missingModels, suggestControls, textBehind, view, check,
  stage, readStage, writeStage, stageDir, placeholders, tinyPng };
