// bitGen Studio — lib/singVoice.js (2.965.0): 🎤 SING IT IN MY VOICE - singing voice conversion for the 🎹 Synth tab.
//
// Tim (verbatim): "is there a local model that will use my voice to sing a song that is already generated with the same
// notes and feelings?" -> "lets get all of them and add them to a dropdown, we will put a tool row in the synth tab of audio
// docker above the timeline. give it a go button (green triangle inside a circle pointing right). add another button to
// separate the vocal from the instrumental in the same toolbar, separate the layer into 2 additional layers,1 layer is the
// original track, 1 layer is the vocal and 1 layer the instrumental . these buttons will work on the selected layer."
//
// THE ENGINES (each in its own folder + venv under <install>/singvoice/, installed from Settings ▸ Add-ons ▸ Sing in my
// voice - lib/singVoiceAddon.js); scripts/singvoice_local.py runs them:
//   seedvc  Seed-VC (Plachtaa, GPL-3.0) - its 44.1 kHz singing model, zero-shot: a 1-30 s clip of the voice (25 s used)
//   soulx   SoulX-Singer SVC (Soul-AILab, Apache-2.0) - zero-shot, a clip (30 s used), its RMVPE pitch, 24 kHz out
//   rvc     RVC through Applio (IAHispano, MIT) - a voice MODEL trained on ~10 minutes of the voice (train() here)
// The voice is only the TIMBRE: the notes, timing, vibrato and feeling come from the song's own vocal.
// YOUR VOICE: clips in <install>/sing_voices/ (recorded in the tab or added from a file; 44.1 kHz mono WAV) - one picked
// for the zero-shot engines, several picked to train an RVC model (<install>/singvoice/rvc/voices/<name>/, Applio's logs).
//
//   ENGINES, paths(base), engineStatus(id), status()      {engines: [{id, label, ref, installed, note}], clips, models}
//   clips: listClips(), addClip(file, name) (ffmpeg -> 44.1 kHz mono WAV, 15 min at most), clipFile(name), removeClip(name)
//   rvcModels(logs?)                                      [{name, pth, index, epochs}] - Applio's newest weights + index
//   jobs (one at a time - the GPU): convert(o), separate(o), train(o) -> {job} ; job(id) -> {id, kind, state, lines, result, error}
//     convert {engine, sample (a My samples name), clip | model, shift, quality} -> result {name} (a new My samples WAV)
//     separate {sample} -> result {vocals, instrumental} (My samples WAVs, demucs - lib/stems.js)
//     train {name, clips [names], epochs} -> result {model}
//   An engine that is not installed: {needs: "sing_<engine>"} (status 409) - the page's Download / Cancel box (needinstall.js).
//   setRun(fn) / setBase(dir): the tests.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const IS_WIN = process.platform === "win32";
const venvPy = (v) => path.join(v, IS_WIN ? "Scripts" : "bin", IS_WIN ? "python.exe" : "python");
const ENGINES = {
  seedvc: { id: "seedvc", label: "Seed-VC - singing, from a clip of your voice", short: "Seed-VC", ref: "clip", licence: "GPL-3.0",
            repo: "https://github.com/Plachtaa/seed-vc", marker: "inference.py" },
  soulx: { id: "soulx", label: "SoulX-Singer SVC - from a clip of your voice", short: "SoulX-Singer", ref: "clip", licence: "Apache-2.0",
           repo: "https://github.com/Soul-AILab/SoulX-Singer", marker: path.join("cli", "inference_svc.py") },
  rvc: { id: "rvc", label: "RVC (Applio) - a model trained on your voice", short: "RVC", ref: "model", licence: "MIT",
         repo: "https://github.com/IAHispano/Applio", marker: "core.py" },
};
const ORDER = ["seedvc", "soulx", "rvc"];
const QUALITY = ["fast", "good", "best"];
const MAX_CLIP_SECONDS = 900;

let BASE = null, RUN = null;
function setBase(d) { BASE = d || null; }
function setRun(fn) { RUN = fn || null; }
function base() { return BASE || process.env.BITGEN_ADDON_BASE || core.BASE; }
function paths(b) {
  const root = path.join(b || base(), "singvoice");
  const one = (id) => { const dir = path.join(root, id); return { dir, src: path.join(dir, "src"), venv: path.join(dir, ".venv"), python: venvPy(path.join(dir, ".venv")) }; };
  const p = { root, seedvc: one("seedvc"), soulx: one("soulx"), rvc: one("rvc"), clips: path.join(b || base(), "sing_voices") };
  p.soulx.models = path.join(p.soulx.dir, "models");
  p.rvc.logs = path.join(p.rvc.dir, "voices");
  return p;
}
const has = (f) => { try { return fs.existsSync(f); } catch { return false; } };
function engineStatus(id, b) {
  const E = ENGINES[id]; if (!E) return { installed: false, note: "no such engine" };
  const p = paths(b)[id];
  const py = has(p.python), code = has(path.join(p.src, E.marker));
  const model = id !== "soulx" || has(path.join(p.models, "SoulX-Singer", "model-svc.pt"));
  const ok = py && code && model;
  return { installed: ok, note: ok ? p.dir : !py && !code ? "not installed" :
    `partly there (${[py ? "" : "its Python", code ? "" : "its code", model ? "" : "its model"].filter(Boolean).join(", ")} missing) - Install again` };
}

/* ---------------- your voice: the clips ---------------- */
const safeName = (n) => require("./sfx").safeName(n);
function clipDir(b) { const d = paths(b).clips; fs.mkdirSync(d, { recursive: true }); return d; }
function listClips(b) {
  const d = paths(b).clips;                                        // read only - the folder is made by the first clip
  let names = [];
  try { names = fs.readdirSync(d).filter((n) => /\.wav$/i.test(n) && !n.startsWith(".")); } catch { names = []; }
  return names.map((n) => { const st = fs.statSync(path.join(d, n)); return { name: n, size: st.size, mtime: st.mtimeMs / 1000, seconds: wavSeconds(path.join(d, n)) }; })
    .sort((a, b2) => b2.mtime - a.mtime);
}
/** a plain PCM WAV's length from its header (null when it cannot tell) */
function wavSeconds(f) {
  try {
    const fd = fs.openSync(f, "r"), h = Buffer.alloc(4096); fs.readSync(fd, h, 0, 4096, 0); fs.closeSync(fd);
    if (h.toString("ascii", 0, 4) !== "RIFF") return null;
    let o = 12, rate = 0, block = 0;
    while (o + 8 <= h.length) {
      const id = h.toString("ascii", o, o + 4), len = h.readUInt32LE(o + 4);
      if (id === "fmt ") { rate = h.readUInt32LE(o + 12); block = h.readUInt16LE(o + 20); }
      if (id === "data") return rate && block ? Math.round(len / (rate * block) * 10) / 10 : null;
      o += 8 + len + (len % 2);
    }
  } catch { /* not a wav */ }
  return null;
}
function clipFile(name, b) {
  const n = safeName(name); if (!n || !/\.wav$/i.test(n)) return null;
  const f = path.join(paths(b).clips, n);
  return has(f) ? f : null;
}
/** a recording or a file -> a 44.1 kHz mono WAV among your clips -> {name} | {error} */
function addClip(src, original, b) {
  const stem = (safeName(String(original || "my voice")) || "my voice").replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 60) || "my voice";
  const d = clipDir(b), name = require("./sfx").freeName(d, stem + ".wav"), out = path.join(d, name);
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-map", "0:a:0", "-t", String(MAX_CLIP_SECONDS),
                                 "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", out], { encoding: "utf8", timeout: 300000 });
  if (r.status !== 0 || !has(out)) { try { fs.unlinkSync(out); } catch { /* none */ } return { error: `${stem}: its sound could not be read${r.error ? " - is ffmpeg installed?" : ""}` }; }
  return { name, seconds: wavSeconds(out) };
}
function removeClip(name, b) {
  const f = clipFile(name, b); if (!f) return { status: 404, error: `no clip called ${name}` };
  fs.unlinkSync(f); return { name: path.basename(f) };
}

/* ---------------- RVC voice models (Applio's models folder) ---------------- */
function rvcModels(logs) {
  const d = logs || paths().rvc.logs, out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return out; }
  for (const n of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(d, n)); } catch { continue; }
    let best = null, step = -1, epochs = 0;
    for (const f of files) {
      const m = /_(\d+)e_(\d+)s\.pth$/.exec(f);
      if (m && f.startsWith(n + "_") && +m[2] > step) { best = f; step = +m[2]; epochs = +m[1]; }
    }
    const idx = files.includes(n + ".index") ? n + ".index" : files.find((f) => /\.index$/.test(f));
    if (best && idx) out.push({ name: n, pth: path.join(d, n, best), index: path.join(d, n, idx), epochs });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function status() {
  return { engines: ORDER.map((id) => Object.assign({ id, label: ENGINES[id].label, short: ENGINES[id].short, ref: ENGINES[id].ref, licence: ENGINES[id].licence }, engineStatus(id))),
           clips: listClips(), models: rvcModels(), quality: QUALITY, busy: JOB && JOB.state === "running" ? { id: JOB.id, kind: JOB.kind } : null };
}

/* ---------------- the jobs (one at a time - they all want the graphics card) ---------------- */
let JOB = null, SEQ = 0;
const HELPER = () => path.join(core.resolvePath("scripts"), "singvoice_local.py");
function job(id) { return JOB && (!id || JOB.id === id) ? JOB : null; }
function err(status, message, extra) { return Object.assign(new Error(message), { status }, extra || {}); }
function start(kind, label, fn) {
  if (JOB && JOB.state === "running") throw err(409, `busy: ${JOB.label} is still running`);
  const j = { id: "sing" + (++SEQ) + "_" + Date.now().toString(36), kind, label, state: "running", lines: [], result: null, error: null, started: Date.now() };
  const log = (l) => { const s = String(l).replace(/\r/g, "").slice(0, 500); if (!s.trim()) return; j.lines.push(s); if (j.lines.length > 3000) j.lines.splice(0, j.lines.length - 3000); };
  Object.defineProperty(j, "procs", { value: [], enumerable: false });   // 2.967.0: what ■ Stop ends (never sent to the page)
  JOB = j;
  Promise.resolve().then(() => fn(log, j)).then((r) => {
    if (j.cancelled) { j.state = "cancelled"; j.ended = Date.now(); return; }
    j.result = r; j.state = "done"; j.ended = Date.now(); log("[ok] " + label + " - done");
  }, (e) => {
    j.ended = Date.now();
    if (j.cancelled) { j.state = "cancelled"; j.error = "stopped"; return; }
    j.error = String((e && e.message) || e); j.state = "error"; log("[error] " + j.error);
  });
  return j;
}
/** the job still wanted? (■ Stop between two steps - nothing more is added to My samples) */
function alive(j) { if (j && j.cancelled) throw new Error("stopped"); }
/** 2.967.0: ■ Stop - the running job's processes ended (their whole tree); the job ends "cancelled" */
function cancel(id) {
  const j = job(id);
  if (!j) throw err(404, "no such job (it may have finished)");
  if (j.state !== "running") return { ok: true, state: j.state };
  j.cancelled = true;
  const n = j.procs.filter((p) => (STOP || require("./venv").stopProc)(p)).length;
  j.lines.push("[stop] ■ stopped" + (j.kind === "train" ? " - Applio keeps what it saved so far: 🎓 Train the same name again to carry on from there" : ""));
  return { ok: true, state: "stopping", stopped: n };
}
let STOP = null;
/** tests: what ends a process */
function setStop(fn) { STOP = fn || null; }
function runHelper(python, jobBody, o, j) {
  const fn = RUN || ((py, script, body, opts) => require("./venv").runJson(py, script, body, opts));
  const opts = Object.assign({ group: true }, o || {}, j ? { onSpawn: (p) => { j.procs.push(p); if (j.cancelled) (STOP || require("./venv").stopProc)(p); } } : {});
  return fn(python, HELPER(), jobBody, opts);
}
/** a My samples name -> its file (404 when it is not there) */
function sampleFile(name) {
  const f = require("./synthSamples").fileOf(name);
  if (!f) throw err(404, `no sample called ${name} in My samples`);
  return f;
}
function outName(sampleName, tag) {
  const stem = String(sampleName || "vocal").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^(sep|dry) /, "").slice(0, 60);
  return `${stem} (${tag}).wav`;
}
/** into My samples (the timeline's "my:" sounds) -> its name there */
function toSamples(file, name) {
  const r = require("./synthSamples").add(file, name);
  if (r.error) throw err(500, r.error);
  return r.name;
}

function convert(o) {
  o = o || {};
  const id = String(o.engine || ""), E = ENGINES[id];
  if (!E) throw err(400, "pick a voice model: " + ORDER.join(" / "));
  if (!engineStatus(id).installed) throw err(409, `${E.short} is not installed`, { needs: "sing_" + id });
  const src = sampleFile(o.sample);
  // 2.967.0: shift "auto" = Seed-VC / SoulX-Singer move the song to where your clip sits (RVC has no such thing: ±0)
  const auto = o.shift === "auto" && E.ref === "clip";
  const P = paths()[id], body = { task: "convert", engine: id, src_dir: P.src, source: src, shift: auto ? 0 : Math.max(-24, Math.min(24, Math.round(Number(o.shift) || 0))),
                                  auto_shift: auto, quality: QUALITY.includes(o.quality) ? o.quality : "good", device: "auto" };
  let voice = "";
  if (E.ref === "clip") {
    const c = clipFile(o.clip); if (!c) throw err(400, "🎙 Record or 📂 add a clip of your voice first (10-30 seconds)");
    body.ref = c; voice = path.basename(c, ".wav");
    if (id === "soulx") body.models_dir = P.models;
  } else {
    const m = rvcModels().find((x) => x.name === String(o.model || ""));
    if (!m) throw err(400, "train an RVC model of your voice first (🎓 Train), or pick one");
    body.pth = m.pth; body.index = m.index; body.logs_dir = P.logs; voice = m.name;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3sing_"));
  body.out = path.join(tmp, "out.wav");
  return start("convert", `${E.short}: ${path.basename(src)} in ${voice}'s voice`, async (log, j) => {
    log(`[..] ${E.short} - ${path.basename(src)}, the voice: ${voice}, key ${auto ? "auto (fitted to your voice)" : (body.shift >= 0 ? "+" : "") + body.shift}, ${body.quality}`);
    try {
      const r = await runHelper(P.python, body, { timeout_ms: 3 * 3600000, onLog: log }, j);
      alive(j);
      if (r.error) throw new Error(r.error);
      if (!has(body.out)) throw new Error(`${E.short} wrote no sound`);
      const name = toSamples(body.out, outName(o.sample, `${voice} - ${E.short}`));
      return { name, engine: id, voice, seconds: r.seconds || null };
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}

function separate(o) {
  o = o || {};
  const S = require("./stems");
  if (!S.runtime().installed) throw err(409, "Song separation (demucs) is not installed", { needs: "demucs" });
  const src = sampleFile(o.sample);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3sep_"));
  const stem = String(o.sample).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^(sep|dry) /, "").slice(0, 60) || "song";
  return start("separate", `✂ separating ${path.basename(src)}`, async (log, j) => {
    log(`[..] demucs - the vocal apart from the instrumental: ${path.basename(src)}`);
    try {
      const r = await S.separate(null, { file: src, out_dir: tmp, stem: "song", onLog: log, onSpawn: (p) => { j.procs.push(p); if (j.cancelled) (STOP || require("./venv").stopProc)(p); } });
      alive(j);
      const vocals = toSamples(path.join(tmp, r.vocals), `${stem} - vocals.wav`);
      const instrumental = toSamples(path.join(tmp, r.instrumental), `${stem} - instrumental.wav`);
      return { vocals, instrumental };
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}

function train(o) {
  o = o || {};
  if (!engineStatus("rvc").installed) throw err(409, "RVC (Applio) is not installed", { needs: "sing_rvc" });
  const name = String(o.name || "").trim().replace(/\s+/g, "_");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw err(400, "a name of letters, numbers, - and _ (up to 40)");
  const files = (Array.isArray(o.clips) ? o.clips : []).map((n) => clipFile(n)).filter(Boolean);
  if (!files.length) throw err(400, "pick the clips of your voice to train on (about 10 minutes together is best)");
  const total = files.reduce((t, f) => t + (wavSeconds(f) || 0), 0);
  const epochs = Math.max(20, Math.min(1000, Math.round(Number(o.epochs) || 300)));
  const P = paths().rvc;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "h3rvcdata_"));
  files.forEach((f, i) => fs.copyFileSync(f, path.join(data, `${String(i + 1).padStart(3, "0")}.wav`)));
  return start("train", `🎓 training the RVC model "${name}"`, async (log, j) => {
    log(`[..] 🎓 ${name}: ${files.length} clip${files.length === 1 ? "" : "s"}, ${Math.round(total / 6) / 10} minutes of your voice, ${epochs} epochs`);
    if (total < 120) log("[warn] under 2 minutes of your voice - it will train, but 10 minutes sounds far more like you");
    try {
      const r = await runHelper(P.python, { task: "train", engine: "rvc", src_dir: P.src, logs_dir: P.logs, name, dataset: data, epochs, device: "auto" }, { timeout_ms: 24 * 3600000, onLog: log }, j);
      alive(j);
      if (r.error) throw new Error(r.error);
      const m = rvcModels().find((x) => x.name === name);
      if (!m) throw new Error("training finished but the model is not in " + P.logs);
      return { model: name, epochs: m.epochs, minutes: r.minutes || null };
    } finally { fs.rmSync(data, { recursive: true, force: true }); }
  });
}

module.exports = { ENGINES, ORDER, QUALITY, paths, engineStatus, status, listClips, addClip, clipFile, removeClip, wavSeconds, rvcModels,
  convert, separate, train, job, cancel, setRun, setStop, setBase, outName, HELPER };
