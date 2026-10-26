// bitGen Studio — text-to-speech with voice cloning: OmniVoice (k2-fsa).
//
// Generated speech is written straight into the project's Sound folder, so a
// cloned line behaves like any other sound asset: drag it onto an audio layer,
// or drop it into the audio-reference tray for ref2va.
//
// Runs OmniVoice LOCALLY in its own venv (venvs/omnivoice) via
// scripts/omnivoice_local.py. No server, no HTTP, no API key. 2.264.0:
// OpenAudio/fish-speech was REMOVED — OmniVoice is the engine, for voice
// CLONES (clip + transcript) and DESIGNED voices (a description) alike.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const venv = require("./venv");

const VOICE_RE = /^[A-Za-z0-9._ -]{1,48}$/;

// Live progress for the running synthesis. Loading the model takes minutes on
// a cold start, so the UI polls this rather than staring at a spinner with no
// idea whether anything is happening.
const progress = { busy: false, started: 0, lines: [], last: "" };
function note(line) {
  const t = String(line).replace(/^\[tts\]\s*/, "").trim();
  if (!t) return;
  progress.last = t;
  progress.lines.push({ at: Date.now(), text: t });
  if (progress.lines.length > 200) progress.lines.splice(0, 100);
}
function progressState() {
  return { busy: progress.busy, last: progress.last,
           seconds: progress.busy ? Math.round((Date.now() - progress.started) / 1000) : 0,
           lines: progress.lines.slice(-30).map((l) => l.text) };
}

/* 2.264.0 (Tim: "use ominvoice for voice cloning and tts. remove
   openaudio"): OmniVoice IS the speech engine. Legacy configs with
   tts.engine "openaudio" simply run OmniVoice — no error, no migration;
   the old checkpoint/venv keys are ignored and harmless. */
/* 2.594.0 (Tim: "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts"): + "ming" -
   Ming-3.0 TTS (inclusionAI, 0.5B, 44.1 kHz) installed from Settings ▸ Add-ons (lib/speechAddons.js), spoken by
   scripts/ming_local.py through the repo's own infer.py. A clone needs the clip + its transcript; a designed voice
   uses its VOICE_DESIGN task. Anything else (or a missing install) is OmniVoice as before. */
const ENGINES = ["omnivoice", "ming"];
const MING_LANGS = ["", "English", "Chinese"];
function cfg() {
  const c = (core.getConfig().tts) || {};
  const o = c.omnivoice || {};
  const mg = c.ming || {};
  const engine = c.engine === "ming" ? "ming" : "omnivoice";      // 2.594.0: legacy "openaudio" = OmniVoice still
  return {
    engine,
    // (legacy openaudio keys c.venv / c.checkpoint are ignored — 2.264.0)
    device: c.device || "cuda",
    format: "wav",
    timeout_ms: Math.max(5000, parseInt(c.timeout_ms, 10) || 900000),
    omnivoice: {
      venv: o.venv || "",
      model: o.model || "k2-fsa/OmniVoice",
      num_step: Math.max(4, Math.min(64, parseInt(o.num_step, 10) || 32)),
    },
    ming: { language: MING_LANGS.includes(mg.language) ? mg.language : "English" },
  };
}
const OMNI_HELPER = () => path.join(core.resolvePath("scripts"), "omnivoice_local.py");
const MING_HELPER = () => path.join(core.resolvePath("scripts"), "ming_local.py");
/** The venv + helper speech runs in: OmniVoice, or Ming-3.0 TTS when it is picked (2.594.0). */
function engineRuntime(c) {
  const e = c || cfg();
  if (e.engine === "ming") {
    const p = require("./speechAddons").paths().ming;
    return { engine: "ming", venv: { dir: p.venv, python: p.python, ready: fs.existsSync(p.python) && fs.existsSync(path.join(p.src, "infer.py")) },
             helper: MING_HELPER(), src: p.src, model: p.model,
             install_hint: "Ming-3.0 TTS is not installed — Settings ▸ Add-ons ▸ Ming-3.0 TTS (or pick OmniVoice in Settings ▸ Audio)" };
  }
  return { engine: "omnivoice", venv: venv.venvReady("omnivoice", e.omnivoice.venv), helper: OMNI_HELPER(),
           install_hint: "OmniVoice is not installed — use Install OmniVoice in Settings → Audio" };
}

// ------------------------------------------------------------ voice store
// A cloned voice is a reference clip plus its transcript. Both are needed:
// zero-shot cloning conditions on the pair, and a wrong transcript is the
// usual reason a clone comes out slurred.
const voiceDir = () => {
  const d = path.join(core.projDir(core.getProject()), "voices");
  fs.mkdirSync(d, { recursive: true });
  return d;
};

function listVoices() {
  let files = [];
  try { files = fs.readdirSync(voiceDir()); } catch { return []; }
  return files.filter((f) => f.endsWith(".json")).map((f) => {
    const base = f.slice(0, -5);
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(voiceDir(), f), "utf8")); } catch {}
    const wav = path.join(voiceDir(), base + ".wav");
    const exists = fs.existsSync(wav);
    const instruct = String(meta.instruct || "").trim();
    return {
      name: base,
      text: meta.text || "",
      instruct,                                    // 2.102.0: a DESIGNED voice (OmniVoice)
      kind: exists ? "clone" : (instruct ? "design" : "broken"),
      saved: meta.saved || null,
      seconds: exists ? core.probeDuration(wav) : null,
      ok: exists || !!instruct,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* VOICE DESIGN (2.102.0): a voice with NO reference clip, only a description
   ("female, low pitch, british accent"). Only OmniVoice can speak it; the
   store keeps it beside the clones so the chat's voice pick-list is one list.
   A description overwrites a clone of the same name only if you delete the
   clone first — never silently. */
function saveDesignVoice(name, instruct) {
  if (!VOICE_RE.test(String(name || "").trim()))
    throw new Error("voice name must be 1-48 chars, letters/numbers/._- only");
  const base = String(name).trim();
  const desc = String(instruct || "").trim().slice(0, 200);
  if (!desc) throw new Error("describe the voice — e.g. \"male, elderly, low pitch, british accent\"");
  if (fs.existsSync(path.join(voiceDir(), base + ".wav")))
    throw new Error(`"${base}" is a cloned voice — delete it first or pick another name`);
  fs.writeFileSync(path.join(voiceDir(), base + ".json"),
    JSON.stringify({ instruct: desc, saved: Date.now() / 1000 }));
  return { name: base, kind: "design", instruct: desc };
}

// `buf` may be any audio container the user picked — m4a/aac, mp3, ogg, flac.
// It used to be written straight to <name>.wav, producing a file that CLAIMS to
// be a wav and is not; anything downstream that trusts the extension then reads
// garbage. Everything is transcoded to real 44.1 kHz mono PCM instead.
function saveVoice(name, text, buf, opts) {
  if (!VOICE_RE.test(String(name || "").trim()))
    throw new Error("voice name must be 1-48 chars, letters/numbers/._- only");
  const base = String(name).trim();
  if (!buf || !buf.length) throw new Error("a reference clip is required");
  const wav = path.join(voiceDir(), base + ".wav");
  const tmp = path.join(require("os").tmpdir(), `h3voice_${Date.now().toString(36)}`);
  fs.writeFileSync(tmp, buf);
  // an optional [start,end) region is cut in the SAME pass as the transcode,
  // so a picked file and a project clip take identical paths
  const o = opts || {};
  const st = Math.max(0, parseFloat(o.start) || 0);
  const en = parseFloat(o.end);
  const trim = isFinite(en) && en > st
    ? ["-ss", st.toFixed(3), "-i", tmp, "-t", (en - st).toFixed(3)]
    : ["-i", tmp];
  const r = require("child_process").spawnSync("ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...trim,
     "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", wav],
    { encoding: "utf8" });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0 || !fs.existsSync(wav))
    throw new Error("could not read that audio file: "
      + (String(r.stderr || "").trim().split("\n").pop() || "unsupported format"));
  const secs = core.probeDuration(wav);
  // 10-30 s is the documented sweet spot; below ~3 s cloning is unreliable
  fs.writeFileSync(path.join(voiceDir(), base + ".json"),
    JSON.stringify({ text: String(text || "").trim(), saved: Date.now() / 1000 }));
  // the two engines want different lengths: OpenAudio 10-30 s, OmniVoice 3-10 s
  const omni = cfg().engine === "omnivoice";
  return { name: base, seconds: secs,
           warn: secs && secs < 3 ? `reference is only ${secs.toFixed(1)}s — ${omni ? "3-10s" : "10-30s"} clones far better`
               : omni && secs && secs > 12 ? `reference is ${secs.toFixed(0)}s — OmniVoice clones best from 3-10s (longer degrades it)`
               : secs && secs > 60 ? `reference is ${secs.toFixed(0)}s — long clips slow every request` : null };
}

function deleteVoice(name) {
  const base = path.basename(String(name || ""));
  if (!VOICE_RE.test(base)) throw new Error("bad voice name");
  for (const ext of [".wav", ".json", ".omnivoice.pt"]) {
    const p = path.join(voiceDir(), base + ext);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
  return { deleted: base };
}

function readVoice(name) {
  const base = path.basename(String(name || ""));
  if (!base || !VOICE_RE.test(base)) return null;
  const wav = path.join(voiceDir(), base + ".wav");
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(voiceDir(), base + ".json"), "utf8")); } catch {}
  if (!fs.existsSync(wav)) {
    const instruct = String(meta.instruct || "").trim();
    if (!instruct) return null;
    return { name: base, kind: "design", instruct, audio: null, text: "", path: null, prompt_cache: null };
  }
  return { name: base, kind: "clone", instruct: "", audio: fs.readFileSync(wav), text: meta.text || "",
           path: wav, prompt_cache: path.join(voiceDir(), base + ".omnivoice.pt") };
}

async function status() {
  const c = cfg();
  const ov = venv.venvReady("omnivoice", c.omnivoice.venv);
  const SA = require("./speechAddons"), ms = SA.mingStatus(), mp = SA.paths().ming;
  const ready = c.engine === "ming" ? ms.installed : ov.ready;
  return { engine: c.engine, engines: ENGINES,
           device: c.device, format: c.format,
           venv: ov.dir, python: ov.python, installed: ready, reachable: ready,
           omnivoice: { venv: ov.dir, installed: ov.ready, model: c.omnivoice.model, num_step: c.omnivoice.num_step },
           ming: { installed: ms.installed, note: ms.note, dir: mp.dir, language: c.ming.language, languages: MING_LANGS },   // 2.594.0
           voices: listVoices() };
}

// Synthesize and save into the project's Sound folder, where it is picked up
// by the asset tray, the timeline and the audio-reference tray alike.
async function speak(text, voiceName, outName, opts) {
  const c = cfg();
  const say = String(text || "").trim();
  if (!say) throw new Error("nothing to say — enter some text");
  if (say.length > 5000) throw new Error("text is too long (5000 char limit)");
  const voice = voiceName ? readVoice(voiceName) : null;
  if (voiceName && !voice) throw new Error(`voice "${voiceName}" not found`);
  // a designed voice has no clip: only OmniVoice can speak it (2.102.0)
  const rt = engineRuntime(c);          // 2.264.0: OmniVoice speaks clones AND designs

  const v = rt.venv;
  if (!v.ready)
    throw new Error(rt.install_hint + " (expected " + v.python + ")");

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const stem = String(outName || "").trim().replace(/[^A-Za-z0-9._ -]+/g, "_")
    || `tts_${voice ? voice.name.replace(/[^A-Za-z0-9]+/g, "") + "_" : ""}${stamp}`;
  const file = stem.endsWith("." + c.format) ? stem : `${stem}.${c.format}`;
  const dest = path.join(core.pDir("sound"), file);
  progress.busy = true; progress.started = Date.now();
  progress.lines = []; progress.last = "starting…";
  const job = rt.engine === "ming"
    ? { op: "speak", src: rt.src, model: rt.model, text: say, out: dest, device: c.device, language: c.ming.language,   // 2.594.0
        ref_audio: voice && voice.kind === "clone" ? voice.path : null, ref_text: voice ? voice.text : "",
        instruct: voice && voice.kind === "design" ? voice.instruct : "" }
    : { text: say, out: dest, model: c.omnivoice.model, device: c.device,
                num_step: c.omnivoice.num_step,
                ref_audio: voice ? voice.path : null, ref_text: voice ? voice.text : "",
                instruct: voice && voice.kind === "design" ? voice.instruct : "",
                prompt_cache: voice ? voice.prompt_cache : null };
  note(`engine: ${rt.engine}`);
  try {
  await venv.runJson(v.python, rt.helper, job, { timeout_ms: c.timeout_ms,
       onLog: (l) => { note(l); if (opts && opts.onLog) opts.onLog(l); } });
  } finally { progress.busy = false; }
  if (!fs.existsSync(dest)) throw new Error("synthesis finished but wrote no audio");
  const bytes = fs.statSync(dest).size;
  if (bytes < 128) throw new Error("synthesis produced an empty file");
  return { name: file, kind: "sound", bytes, engine: rt.engine,
           duration: core.probeDuration(dest), voice: voice ? voice.name : null };
}

/** Import test of the OmniVoice venv (no model download) — status panel. */
async function checkOmnivoice() {
  const c = cfg();
  const v = venv.venvReady("omnivoice", c.omnivoice.venv);
  if (!v.ready) return { ok: false, installed: false, venv: v.dir, error: "not installed" };
  try {
    const j = await venv.runJson(v.python, OMNI_HELPER(), { op: "check" }, { timeout_ms: 120000 });
    return Object.assign({ installed: true, venv: v.dir }, j);
  } catch (e) { return { ok: false, installed: true, venv: v.dir, error: e.message }; }
}

module.exports = { ENGINES, MING_LANGS, cfg, engineRuntime, progressState, status, listVoices, saveVoice,
                   saveDesignVoice, deleteVoice, readVoice, speak, checkOmnivoice };
