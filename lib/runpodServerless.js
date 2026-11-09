// bitGen Studio — lib/runpodServerless.js (2.743.0): RENDER ON A RUNPOD SERVERLESS ENDPOINT - Settings ▸ Remote GPU.
// Tim (verbatim): "can we try using a runpod serverless gpu?"
//
// A serverless endpoint is not a ComfyUI you can talk to: you send ONE job (the workflow + its input files) and get the
// finished files back, paying only while a worker runs it. The workers here all talk ComfyUI (scripts/comfy_client.py:
// /upload/image, /prompt, /history, /view, /free, /system_stats). So this is a small ComfyUI-SHAPED ADAPTER on the app's
// own server at /rpsl (routes/runpodServerless.js): "Use it" points engine.comfy.url at http://127.0.0.1:<port>/rpsl and
// every worker renders through the endpoint unchanged.
//
// THE ENDPOINT  RunPod's own ComfyUI worker (github.com/runpod-workers/worker-comfyui, 5.x - only called over HTTP,
//               nothing of it is in bitGen Studio), with the models on a network volume (/runpod-volume/models/...) and
//               the custom nodes the workflows use baked into its image. Its API, from its handler.py:
//                 POST /v2/<endpoint>/run   {input: {workflow, images: [{name, image: base64}]}}   (10 MB at most)
//                 GET  /v2/<endpoint>/status/<job>  {status: IN_QUEUE|IN_PROGRESS|COMPLETED|FAILED|CANCELLED|TIMED_OUT,
//                      output: {images: [{filename, type: base64|s3_url, data}], errors?} | {error, details}}
//                 POST /v2/<endpoint>/cancel/<job>     GET /v2/<endpoint>/health {jobs: {...}, workers: {idle, running...}}
//               The worker returns only what a node reports under "images" (not temp). So, before the job is sent:
//   VIDEO       a VHS_VideoCombine (reports under "gifs" - the worker drops it) becomes CreateVideo + SaveVideo, ComfyUI's
//               own nodes (SaveVideo reports under "images"); written as the studio's MiniMax H3 workflows write them.
//   SOUND       a SaveAudio* / PreviewAudio (reports under "audio" - dropped) becomes EmptyImage (16x16, one frame a
//               second for 30 minutes) + CreateVideo(audio) + SaveVideo "h3audio-<ext>-<name>": the song rides a tiny
//               video (SaveVideo cuts the sound at frames / fps, so 1800 s is room enough) and comes out of it here with
//               ffmpeg, as <name>_00001_.<ext> again.
//   INPUT FILES every string in the workflow that names a file uploaded to /rpsl/upload/image goes in input.images (the
//               worker puts them in ComfyUI's input folder by name - pictures, videos and sounds alike).
//   RESULTS     saved under workspace/runpod_sls/out/<prompt id>/ and listed in /history the way ComfyUI does - under
//               the save node that wrote each (matched by its filename_prefix); an s3_url (a bucket on the endpoint) is
//               downloaded.
//   NOT THERE   /object_info and /ws: the workers already go on without them (no live steps - a heartbeat instead; the
//               node / model checks are skipped - the endpoint says what is missing when it runs).
// Pure (scripts/test-rpsl743.js): adapt, inputNames, buildRun, savers, nodeFor, toHistory, kindOf, audioName, parseMultipart, health.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const API = () => (process.env.H3_RUNPOD_SLS_API || "https://api.runpod.ai/v2").replace(/\/+$/, "");
const RUN_LIMIT = 10 * 1024 * 1024;                     // RunPod: /run takes 10 MB at most
const AUDIO_SECONDS = 1800;                             // the sound's carrier video: one frame a second, 30 minutes
const AUDIO_SAVE = { SaveAudio: "flac", SaveAudioMP3: "mp3", SaveAudioOpus: "opus", SaveAudioAdvanced: null, PreviewAudio: "flac" };
const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"];
const VID_EXT = [".mp4", ".webm", ".mov", ".mkv", ".avi"];
const AUD_EXT = [".mp3", ".wav", ".flac", ".ogg", ".opus", ".m4a", ".aac"];

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number") && typeof v[1] === "number";
function linkedFrom(g, id) {
  for (const [k, n] of Object.entries(g)) {
    if (!n || typeof n !== "object" || k === id) continue;
    for (const v of Object.values(n.inputs || {})) if (isLink(v) && String(v[0]) === id) return true;
  }
  return false;
}
function freeId(g, want) { let id = want, i = 2; while (g[id]) id = want + "_" + i++; return id; }
const clean = (s) => String(s || "").split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "audio";
/** the sound's extension a save node writes */
function audioExt(n) {
  const ct = n.class_type, fixed = AUDIO_SAVE[ct];
  if (fixed) return fixed;
  const f = String((n.inputs || {}).format || "mp3").toLowerCase();
  return ["mp3", "flac", "opus", "wav", "ogg"].includes(f) ? f : "mp3";
}

/** the workflow made ready for the endpoint's worker -> {graph, notes} (pure; the input is not changed) */
function adapt(graph) {
  const g = JSON.parse(JSON.stringify(graph || {})), notes = [];
  for (const id of Object.keys(g)) {
    const n = g[id];
    if (!n || typeof n !== "object" || id.startsWith("_")) continue;
    const ins = n.inputs || {};
    if (n.class_type === "VHS_VideoCombine") {
      if (ins.save_output === false) continue;          // a preview - nothing to bring back
      if (linkedFrom(g, id)) { notes.push(`node ${id} VHS_VideoCombine is wired into another node - left as it is (the endpoint will not return it)`); continue; }
      const cv = freeId(g, id + "_cv");
      const fps = isLink(ins.frame_rate) ? ins.frame_rate : (+ins.frame_rate || 24);
      g[cv] = { class_type: "CreateVideo", _meta: { title: "Create Video (for RunPod Serverless)" }, inputs: Object.assign({ images: ins.images, fps }, isLink(ins.audio) ? { audio: ins.audio } : {}) };
      g[id] = { class_type: "SaveVideo", _meta: { title: "Save Video (for RunPod Serverless)" }, inputs: { video: [cv, 0], filename_prefix: String(ins.filename_prefix || "video/ComfyUI"), format: "auto", codec: "auto" } };
      notes.push(`node ${id}: VHS_VideoCombine -> CreateVideo + SaveVideo (the endpoint returns SaveVideo's file)`);
      continue;
    }
    if (n.class_type in AUDIO_SAVE) {
      if (!isLink(ins.audio)) continue;
      const ext = audioExt(n), name = clean(ins.filename_prefix || "audio");
      const ei = freeId(g, id + "_frames"), cv = freeId(g, id + "_cv");
      g[ei] = { class_type: "EmptyImage", _meta: { title: "the sound's carrier (RunPod Serverless)" }, inputs: { width: 16, height: 16, batch_size: AUDIO_SECONDS, color: 0 } };
      g[cv] = { class_type: "CreateVideo", _meta: { title: "Create Video (RunPod Serverless)" }, inputs: { images: [ei, 0], fps: 1.0, audio: ins.audio } };
      g[id] = { class_type: "SaveVideo", _meta: { title: "Save Video (RunPod Serverless)" }, inputs: { video: [cv, 0], filename_prefix: `h3audio-${ext}-${name}`, format: "mp4", codec: "auto" } };
      notes.push(`node ${id}: ${n.class_type} -> the sound in a small video (taken out again here as .${ext})`);
    }
  }
  return { graph: g, notes };
}
/** the uploaded files the workflow names (pure): have(name) -> bool */
function inputNames(graph, have) {
  const out = [];
  for (const [id, n] of Object.entries(graph || {})) {
    if (!n || typeof n !== "object" || id.startsWith("_")) continue;
    for (const v of Object.values(n.inputs || {})) {
      if (typeof v !== "string" || !v || v.length > 300) continue;
      const nm = v.replace(/\s*\[(input|output|temp)\]$/, "").split(/[\\/]/).pop();
      if (nm && !out.includes(nm) && have(nm)) out.push(nm);
    }
  }
  return out;
}
/** the /run body (pure): files [{name, buf}] -> {body (string), bytes} or throws a 413-style error past 10 MB */
function buildRun(graph, files) {
  const images = (files || []).map((f) => ({ name: f.name, image: Buffer.from(f.buf).toString("base64") }));
  const body = JSON.stringify({ input: Object.assign({ workflow: graph }, images.length ? { images } : {}) });
  const bytes = Buffer.byteLength(body);
  if (bytes > RUN_LIMIT) {
    const big = (files || []).map((f) => `${f.name} ${(f.buf.length / 1048576).toFixed(1)} MB`).join(", ");
    const e = new Error(`the job is ${(bytes / 1048576).toFixed(1)} MB with its input files (${big || "no files"}) - RunPod takes 10 MB at most `
      + "per job (base64 adds a third). Use smaller / shorter input files, or render this one on a pod or this computer.");
    e.status = 413; throw e;
  }
  return { body, bytes };
}
function kindOf(name) {
  const e = path.extname(String(name || "")).toLowerCase();
  return IMG_EXT.includes(e) ? "images" : VID_EXT.includes(e) ? "videos" : AUD_EXT.includes(e) ? "audio" : "files";
}
/** "h3audio-mp3-song_00001_.mp4" -> {ext: "mp3", name: "song_00001_.mp3"} | null (pure) */
function audioName(fn) {
  const m = /^h3audio-([a-z0-9]+)-(.+)\.(mp4|webm|mkv|mov)$/i.exec(String(fn || ""));
  return m ? { ext: m[1].toLowerCase(), name: m[2] + "." + m[1].toLowerCase() } : null;
}
/** the save nodes of an (adapted) workflow -> [{id, stem}] - a result is filed under the node that wrote it (pure) */
const SAVERS = ["SaveImage", "SaveVideo", "SaveAnimatedWEBP", "SaveAnimatedPNG", "SaveWEBM", "PreviewImage"];
function savers(graph) {
  const out = [];
  for (const [id, n] of Object.entries(graph || {})) {
    if (!n || typeof n !== "object" || id.startsWith("_") || !SAVERS.includes(n.class_type)) continue;
    const pre = (n.inputs || {}).filename_prefix;
    out.push({ id, stem: typeof pre === "string" ? pre.split(/[\\/]/).pop() : "" });
  }
  return out.sort((a, b) => b.stem.length - a.stem.length);           // the longest prefix that fits wins
}
function nodeFor(fn, list) {
  const f = String(fn || "");
  const hit = (list || []).find((x) => x.stem && (f.startsWith(x.stem + "_") || f.startsWith(x.stem)));
  return hit ? hit.id : (list && list.length === 1 ? list[0].id : "runpod");
}
/** a finished job -> ComfyUI's history entry (pure). files [{filename, node?}] already saved here; sub = the job */
function toHistory(st, files, sub) {
  const s = st || {};
  const msg = (t) => ({ status: { status_str: "error", completed: false, messages: [["execution_error", { node_id: "", node_type: "RunPod Serverless", exception_type: "RunPodServerless", exception_message: t, traceback: [] }]] }, outputs: {} });
  if (s.status === "FAILED" || s.status === "CANCELLED" || s.status === "TIMED_OUT") {
    const why = typeof s.error === "string" ? s.error : s.output && s.output.error ? s.output.error + (s.output.details ? ": " + [].concat(s.output.details).join("; ") : "") : "";
    return msg(`the RunPod job ${s.status === "TIMED_OUT" ? "ran out of time (the endpoint's execution timeout)" : s.status.toLowerCase()}${why ? " - " + String(why).slice(0, 900) : ""}`);
  }
  if (s.output && s.output.error) return msg(String(s.output.error) + (s.output.details ? ": " + [].concat(s.output.details).join("; ").slice(0, 900) : ""));
  if (!files || !files.length) return msg("the endpoint finished but sent no files back - its worker returns pictures and Save Video files only"
    + (s.output && s.output.errors ? " (" + [].concat(s.output.errors).join("; ").slice(0, 600) + ")" : "") + ", and needs worker-comfyui 5.x");
  const outputs = {};
  for (const f of files) {
    const o = outputs[f.node || "runpod"] = outputs[f.node || "runpod"] || {};
    (o[kindOf(f.filename)] = o[kindOf(f.filename)] || []).push({ filename: f.filename, subfolder: sub, type: "output" });
  }
  return { status: { status_str: "success", completed: true, messages: [] }, outputs };
}
/** the one file of a multipart upload named "image" -> {name, buf} | null (pure) */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ""));
  if (!m || !Buffer.isBuffer(buf)) return null;
  const b = Buffer.from("--" + (m[1] || m[2]).trim());
  let pos = buf.indexOf(b);
  while (pos >= 0) {
    const next = buf.indexOf(b, pos + b.length);
    if (next < 0) break;
    const part = buf.subarray(pos + b.length + 2, next - 2);       // past CRLF, before CRLF
    const he = part.indexOf("\r\n\r\n");
    if (he > 0) {
      const head = part.subarray(0, he).toString("utf8");
      const fn = /filename="([^"]*)"/i.exec(head), nm = /name="([^"]*)"/i.exec(head);
      if (fn && nm && nm[1] === "image") return { name: path.basename(fn[1].replace(/\\/g, "/")), buf: part.subarray(he + 4) };
    }
    pos = next;
  }
  return null;
}
/** RunPod's /health -> one line (pure) */
function health(j) {
  const w = (j && j.workers) || {}, q = (j && j.jobs) || {};
  const ready = (+w.idle || 0) + (+w.ready || 0), run = +w.running || 0, init = +w.initializing || 0;
  return `workers: ${ready} ready, ${run} running${init ? ", " + init + " starting" : ""}${w.throttled ? ", " + w.throttled + " throttled" : ""}${w.unhealthy ? ", " + w.unhealthy + " unhealthy" : ""}`
    + ` · jobs: ${+q.inQueue || 0} waiting, ${+q.inProgress || 0} running, ${+q.completed || 0} done, ${+q.failed || 0} failed`
    + (ready + run + init === 0 ? " (no worker up: the first job starts one - a cold start can take minutes)" : "");
}

/* ---------------- live */
function core() { return require("./core"); }
function root() { return path.join(core().WORKSPACE || path.join(core().BASE, "workspace"), "runpod_sls"); }
const IN = () => path.join(root(), "in");
const OUT = () => path.join(root(), "out");
function settings() {
  const r = (core().getConfig() || {}).rgpu || {};
  const s = r.serverless || {};
  return { key: String((r.runpod || {}).key || "").trim(), endpoint: String(s.endpoint || "").trim().replace(/[^A-Za-z0-9_-]/g, ""), cost_hr: +s.cost_hr || 0 };
}
async function rp(method, p, body, o) {
  const s = Object.assign(settings(), o || {});
  if (!s.key) { const e = new Error("a RunPod API key first (Settings ▸ Remote GPU)"); e.status = 400; throw e; }
  if (!s.endpoint) { const e = new Error("the serverless endpoint's ID first (Settings ▸ Remote GPU)"); e.status = 400; throw e; }
  const r = await fetch(`${API()}/${s.endpoint}${p}`, { method, headers: { Authorization: "Bearer " + s.key, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(120000) });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { j = null; }
  if (r.status === 401 || r.status === 403) { const e = new Error("RunPod refused the API key"); e.status = 401; throw e; }
  if (r.status === 404) { const e = new Error(`RunPod does not know the endpoint ${s.endpoint}`); e.status = 404; throw e; }
  if (!r.ok) { const e = new Error(`RunPod answered HTTP ${r.status}${txt ? ": " + txt.slice(0, 200) : ""}`); e.status = 502; throw e; }
  return j || {};
}
async function test(o) {
  try { const j = await rp("GET", "/health", undefined, o); return { ok: true, line: health(j), health: j }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}
const JOBS = new Map();          // prompt id -> {rid, status, created, history, notes}
function sweep() {
  const old = Date.now() - 24 * 3600 * 1000;
  for (const d of [IN(), OUT()]) {
    let names = []; try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) { const p = path.join(d, n); try { if (fs.statSync(p).mtimeMs < old) fs.rmSync(p, { recursive: true, force: true }); } catch { /* gone */ } }
  }
  for (const [k, j] of JOBS) if (j.created < old) JOBS.delete(k);
}
function upload(name, buf) {
  fs.mkdirSync(IN(), { recursive: true });
  const nm = path.basename(String(name || "upload").replace(/\\/g, "/")).replace(/[^\w.\- ()[\]]+/g, "_") || "upload";
  fs.writeFileSync(path.join(IN(), nm), buf);
  return { name: nm, subfolder: "", type: "input" };
}
function ffmpeg(args) {
  return new Promise((res) => {
    let p; try { p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }); } catch (e) { res({ ok: false, err: String(e.message || e) }); return; }
    let err = ""; p.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
    p.on("error", (e) => res({ ok: false, err: String(e.message || e) }));
    p.on("close", (c) => res({ ok: c === 0, err }));
  });
}
const CODEC = { mp3: ["-c:a", "libmp3lame", "-q:a", "0"], flac: ["-c:a", "flac"], wav: ["-c:a", "pcm_s16le"], opus: ["-c:a", "libopus", "-b:a", "192k"], ogg: ["-c:a", "libvorbis", "-q:a", "6"] };
/** save the endpoint's files here -> [{filename}] */
async function collect(pid, output, saveList) {
  const dir = path.join(OUT(), pid);
  fs.mkdirSync(dir, { recursive: true });
  let list = Array.isArray(output && output.images) ? output.images : [];
  if (!list.length && output && typeof output.message === "string") list = [{ filename: "ComfyUI_00001_.png", type: /^https?:/.test(output.message) ? "s3_url" : "base64", data: output.message }];   // worker < 5.0
  const files = [];
  for (const it of list) {
    const fn = path.basename(String(it.filename || "file_" + files.length).replace(/\\/g, "/"));
    let buf;
    if (it.type === "s3_url" || /^https?:\/\//.test(String(it.data || ""))) {
      const r = await fetch(it.data, { signal: AbortSignal.timeout(600000) });
      if (!r.ok) throw new Error(`could not download ${fn} from the endpoint's bucket (HTTP ${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
    } else buf = Buffer.from(String(it.data || "").replace(/^data:[^,]*,/, ""), "base64");
    const p = path.join(dir, fn);
    fs.writeFileSync(p, buf);
    const a = audioName(fn);
    if (a) {
      const r = await ffmpeg(["-y", "-v", "error", "-i", p, "-vn", ...(CODEC[a.ext] || CODEC.mp3), path.join(dir, a.name)]);
      if (!r.ok) throw new Error(`could not take the sound out of ${fn} (ffmpeg: ${(r.err || "").trim().slice(-200)})`);
      try { fs.unlinkSync(p); } catch { /* fine */ }
      files.push({ filename: a.name, node: nodeFor(fn, saveList) });
    } else files.push({ filename: fn, node: nodeFor(fn, saveList) });
  }
  return files;
}
async function poll(pid) {
  const j = JOBS.get(pid); if (!j || j.history) return;
  let st;
  try { st = await rp("GET", "/status/" + encodeURIComponent(j.rid), undefined, j.ep ? { endpoint: j.ep } : undefined); j.miss = 0; }
  catch (e) {
    j.miss = (j.miss || 0) + 1;
    if (j.miss >= 8) j.history = toHistory({ status: "FAILED", error: "RunPod stopped answering about the job: " + String(e.message || e) }, [], pid);
    else setTimeout(() => poll(pid), 5000).unref();
    return;
  }
  j.status = st.status || j.status;
  if (st.status === "COMPLETED") {
    try { j.files = await collect(pid, st.output || {}, j.savers); j.history = toHistory(st, j.files, pid); }
    catch (e) { j.history = toHistory({ status: "FAILED", error: String(e.message || e) }, [], pid); }
    j.secs = ((+st.executionTime || 0) + (+st.delayTime || 0)) / 1000;
    return;
  }
  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) { j.history = toHistory(st, [], pid); return; }
  setTimeout(() => poll(pid), 2500).unref();
}
/** POST /prompt {prompt, client_id} -> {prompt_id, number, node_errors} | throws {status, body} */
async function prompt(b, ep) {   // ep (2.746.0): a remote style's own endpoint - blank = Settings ▸ Remote GPU's
  sweep();
  const graph = b && b.prompt;
  if (!graph || typeof graph !== "object") { const e = new Error("no workflow"); e.status = 400; throw e; }
  const { graph: g, notes } = adapt(graph);
  const names = inputNames(g, (nm) => { try { return fs.statSync(path.join(IN(), nm)).isFile(); } catch { return false; } });
  const files = names.map((nm) => ({ name: nm, buf: fs.readFileSync(path.join(IN(), nm)) }));
  const { body } = buildRun(g, files);
  const r = await rp("POST", "/run", body, ep ? { endpoint: ep } : undefined);
  if (!r.id) { const e = new Error("RunPod did not take the job" + (r.error ? ": " + r.error : "")); e.status = 502; throw e; }
  const pid = crypto.randomUUID();
  JOBS.set(pid, { rid: r.id, ep: ep || "", status: r.status || "IN_QUEUE", created: Date.now(), history: null, notes, inputs: names, savers: savers(g) });
  setTimeout(() => poll(pid), 2000).unref();
  return { prompt_id: pid, number: JOBS.size, node_errors: {}, runpod_job: r.id, notes };
}
function history(pid) {
  if (pid) { const j = JOBS.get(pid); return j && j.history ? { [pid]: j.history } : {}; }
  const o = {}; for (const [k, j] of JOBS) if (j.history) o[k] = j.history; return o;
}
function queueView() {
  const run = [], wait = [];
  for (const [k, j] of JOBS) if (!j.history) (j.status === "IN_PROGRESS" ? run : wait).push([0, k, {}, {}, []]);
  return { queue_running: run, queue_pending: wait };
}
async function interrupt() {
  const live = [...JOBS.entries()].filter(([, j]) => !j.history);
  for (const [pid, j] of live) { try { await rp("POST", "/cancel/" + encodeURIComponent(j.rid), undefined, j.ep ? { endpoint: j.ep } : undefined); } catch { /* it may have ended */ } j.history = toHistory({ status: "CANCELLED" }, [], pid); }
  return { cancelled: live.length };
}
function viewPath(filename, subfolder) {
  const sub = String(subfolder || "").replace(/[^A-Za-z0-9-]/g, ""), fn = path.basename(String(filename || "").replace(/\\/g, "/"));
  if (!sub || !fn) return null;
  const p = path.join(OUT(), sub, fn);
  return p.startsWith(OUT() + path.sep) && fs.existsSync(p) ? p : null;
}
function stats(ep) {
  const s = settings(), e = ep || s.endpoint;
  return { system: { os: "RunPod Serverless", comfyui_version: "RunPod Serverless" + (e ? " (endpoint " + e + ")" : ""), python_version: "", embedded_python: false }, devices: [] };
}
function jobs() { return [...JOBS.entries()].map(([k, j]) => ({ prompt_id: k, runpod_job: j.rid, status: j.history ? j.history.status.status_str : j.status, files: j.files || [], notes: j.notes, secs: j.secs || null })); }

module.exports = { API, RUN_LIMIT, AUDIO_SECONDS, adapt, inputNames, buildRun, kindOf, audioName, savers, nodeFor, toHistory, parseMultipart, health,
  settings, test, upload, prompt, history, queueView, interrupt, viewPath, stats, jobs, _jobs: JOBS };
