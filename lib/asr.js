// bitGen Studio — speech-to-text / lyric extraction.
//
// Runs faster-whisper LOCALLY in its own venv (venvs/whisper) via
// scripts/asr_local.py. No server, no HTTP, no API key — the model file lives
// on this machine and nothing leaves it.
//
// Works on VIDEO as well as sound: anything that is not already a mono 16 kHz
// wav is demuxed with ffmpeg first, because that is what every Whisper build
// wants and handing it an mp4 is the usual cause of a confusing 400.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");
const venv = require("./venv");

function cfg() {
  const c = core.getConfig().asr || {};
  return {
    venv: c.venv || "",
    model: c.model || "base",            // tiny/base/small/medium/large-v3
    model_dir: c.model_dir || "",
    device: c.device || "auto",
    compute_type: c.compute_type || "",
    language: c.language || "",          // "" = let the model detect
    vad: !!c.vad,
    timeout_ms: Math.max(10000, parseInt(c.timeout_ms, 10) || 1800000),
  };
}
const HELPER = () => path.join(core.resolvePath("scripts"), "asr_local.py");

const OUT_DIR = () => {
  const d = path.join(core.projDir(core.getProject()), "transcripts");
  fs.mkdirSync(d, { recursive: true });
  return d;
};

// Locate a project asset by name across the sound/video folders.
function findAsset(name) {
  const base = path.basename(String(name || ""));
  if (!base) return null;
  for (const d of [core.pDir("sound"), core.pDir("video"), core.pDir("output"),
                   path.join(core.projDir(core.getProject()), "final")]) {
    const p = path.join(d, base);
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

// Whisper wants 16 kHz mono PCM. Feeding it an mp4/webm directly either fails
// or silently transcribes the wrong stream, so always normalise first.
function toWav16k(src) {
  const out = path.join(os.tmpdir(), `h3asr_${Date.now().toString(36)}.wav`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out],
    { encoding: "utf8" });
  if (r.error) throw new Error("ffmpeg not runnable: " + r.error.message);
  if (r.status !== 0 || !fs.existsSync(out))
    throw new Error("could not extract audio: "
      + String(r.stderr || "").trim().split("\n").pop());
  return out;
}

const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, "0");
function srtTime(t) {
  const ms = Math.round((t % 1) * 1000);
  return `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)},${pad(ms, 3)}`;
}
function lrcTime(t) {
  return `[${pad(t / 60)}:${pad(t % 60)}.${pad(Math.round((t % 1) * 100), 2)}]`;
}
function toSrt(segs) {
  return segs.map((s, i) =>
    `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text.trim()}\n`).join("\n");
}
// LRC is the lyric format karaoke players and most tagging tools read.
function toLrc(segs, title) {
  return (title ? `[ti:${title}]\n` : "")
    + segs.map((s) => `${lrcTime(s.start)}${s.text.trim()}`).join("\n") + "\n";
}

async function status() {
  const c = cfg();
  let files = [];
  try { files = fs.readdirSync(OUT_DIR()).sort(); } catch {}
  const v = venv.venvReady("whisper", c.venv);
  return { model: c.model, language: c.language, device: c.device,
           venv: v.dir, python: v.python, installed: v.ready,
           reachable: v.ready, transcripts: files };
}

// name  : an asset in the project's sound/video folders
// mode  : "speech" (plain transcript) | "lyrics" (timed, also writes .lrc)
async function transcribe(opts) {
  const o = opts || {};
  const c = cfg();
  const src = findAsset(o.name);
  if (!src) throw new Error(`asset not found: ${o.name || "(none)"}`);

  let wav = src, tmp = null;
  if (!/\.wav$/i.test(src) || o.force !== false) { wav = tmp = toWav16k(src); }
  const dur = core.probeDuration(wav);

  const v = venv.venvReady("whisper", c.venv);
  if (!v.ready)
    throw new Error("faster-whisper is not installed — use Install faster-whisper "
                  + "in Settings → Audio (expected " + v.python + ")");

  let j;
  try {
    j = await venv.runJson(v.python, HELPER(), {
      audio: wav, model: c.model, model_dir: c.model_dir,
      device: c.device, compute_type: c.compute_type,
      language: (o.language || c.language || "").trim(),
      mode: o.mode === "lyrics" ? "lyrics" : "speech",
      word_timestamps: o.word_timestamps !== false,
      vad: c.vad,
    }, { timeout_ms: c.timeout_ms, onLog: o.onLog });
  } finally {
    if (tmp) { try { fs.unlinkSync(tmp); } catch {} }
  }

  const segs = (j.segments || [])
    .map((s) => ({ start: +s.start || 0, end: +s.end || 0,
                   text: String(s.text || "").trim(),
                   words: Array.isArray(s.words) ? s.words : [] }))
    .filter((s) => s.text);
  const text = String(j.text || segs.map((s) => s.text).join(" ")).trim();
  if (!text) throw new Error("nothing was transcribed — is there speech on this track?");

  const stem = path.basename(src).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._ -]+/g, "_");
  const written = [];
  const write = (ext, body) => {
    const p = path.join(OUT_DIR(), stem + ext);
    fs.writeFileSync(p, body, "utf8");
    written.push(path.basename(p));
  };
  write(".txt", text + "\n");
  if (segs.length) {
    write(".srt", toSrt(segs));
    if (o.mode === "lyrics") write(".lrc", toLrc(segs, stem));
  }
  return { name: path.basename(src), mode: o.mode === "lyrics" ? "lyrics" : "speech",
           language: j.language || (o.language || c.language || "") || null, duration: dur,
           device: j.device || null,
           text, segments: segs, files: written };
}

function readTranscript(file) {
  const base = path.basename(String(file || ""));
  if (!/\.(txt|srt|lrc)$/i.test(base)) return null;
  const p = path.join(OUT_DIR(), base);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// Transcribe a file straight off disk. Unlike transcribe(), this takes no
// project asset and writes no .txt/.srt — it is for short one-off jobs like
// filling in a voice clone's transcript.
async function transcribeFile(file) {
  const c = cfg();
  const v = venv.venvReady("whisper", c.venv);
  if (!v.ready)
    throw new Error("faster-whisper is not installed — use Install faster-whisper in Settings → Audio");
  const wav = toWav16k(file);
  try {
    const j = await venv.runJson(v.python, HELPER(), {
      audio: wav, model: c.model, model_dir: c.model_dir, device: c.device,
      compute_type: c.compute_type, language: c.language,
      mode: "speech", word_timestamps: false, vad: c.vad,
    }, { timeout_ms: c.timeout_ms });
    const text = String(j.text || (j.segments || []).map((x) => x.text).join(" ")).trim();
    if (!text) throw new Error("nothing was transcribed — is there speech in that clip?");
    return { text, language: j.language || null };
  } finally { try { fs.unlinkSync(wav); } catch {} }
}

module.exports = { transcribeFile, cfg, status, transcribe, readTranscript, toSrt, toLrc, findAsset, OUT_DIR };
