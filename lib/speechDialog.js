// bitGen Studio — lib/speechDialog.js (2.621.0): SPEECH AND DIALOG for the SFX docker - text read with emotion by
// OmniVoice or Ming-3.0 TTS, one voice or a cast of voices, saved as .wav / .mp3 into the project's Audio assets with the
// date / time, the description and the text in the file's own metadata.
//
// Tim (verbatim): "in the sfx docker can you add an input that the user can copy/paste text, or get input from the llm or
// type custom text to create speech/dialog user can choose the voice/voices and the text will be read with emotion using
// omnivoice or ming voices. save formats will be wav or mp3 to save the read voice into assets-audio. The name of the file
// will be an input above the speech input, description will be below - it would be great if we can save the
// date,time,description and text in the files metadata"
//
// THE SCRIPT (parse):   Anna: Hello there.            a line spoken by the speaker "Anna"
//                       Anna (happy): We made it!     … with an emotion
//                       (sad) It is gone.             an emotion for a line (the last / the chosen voice)
//                       a line with no "Name:"        the speaker above goes on (or the chosen voice)
//                       [laughter] [sigh] …           sound tags, kept in the words (the engines read them)
//   Emotions: neutral, happy, sad, angry, fearful, disgusted, surprised (+ joy, excited, upset, scared, shocked … as
//   aliases). A blank line = a longer pause.
// EMOTION, PER ENGINE:
//   Ming-3.0 TTS   its EMOTION task (高兴 悲伤 愤怒 恐惧 厌恶 惊讶 中性) - with a cloned voice too (scripts/ming_local.py)
//   OmniVoice      has no emotion switch: a voice recorded in that mood is used when it exists ("Anna.happy" beside
//                  "Anna" in the voice store), the pace moves a little (happy / angry / surprised faster, sad slower),
//                  and the sound tags ([laughter], [sigh], [surprise-oh] …) are read as sounds
// THE FILE: projects/<p>/sound/<name>.wav|.mp3 (the Audio assets) - never over an existing file (name_2 …). Metadata:
//   WAV  LIST/INFO  INAM title · ICRD date + time · ICMT description · ISBJ the text · IART the voices · IGNR Speech
//   MP3  ID3v2.4    TIT2 title · TDRC date + time · COMM description · USLT the text · TPE1 the voices · TCON Speech
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const EMOTIONS = {
  neutral: { zh: "中性", speed: 1 }, happy: { zh: "高兴", speed: 1.05 }, sad: { zh: "悲伤", speed: 0.92 }, angry: { zh: "愤怒", speed: 1.06 },
  fearful: { zh: "恐惧", speed: 1.08 }, disgusted: { zh: "厌恶", speed: 0.96 }, surprised: { zh: "惊讶", speed: 1.06 },
};
const ALIAS = { joy: "happy", joyful: "happy", glad: "happy", excited: "happy", cheerful: "happy", laughing: "happy", sorrow: "sad", sorrowful: "sad", upset: "sad",
  crying: "sad", tearful: "sad", mad: "angry", furious: "angry", annoyed: "angry", scared: "fearful", afraid: "fearful", fear: "fearful", nervous: "fearful",
  disgust: "disgusted", surprise: "surprised", shocked: "surprised", amazed: "surprised", calm: "neutral", plain: "neutral", flat: "neutral" };
const TAGS = ["[laughter]", "[sigh]", "[confirmation-en]", "[question-en]", "[question-ah]", "[question-oh]", "[surprise-ah]", "[surprise-oh]", "[surprise-wa]", "[dissatisfaction-hnn]"];
const FORMATS = ["wav", "mp3"];
const MAX_TEXT = 20000;

/** an emotion word -> one of EMOTIONS (or "") */
function emotionOf(w) {
  const k = String(w || "").trim().toLowerCase();
  if (!k) return "";
  if (EMOTIONS[k]) return k;
  return ALIAS[k] || "";
}

/** the script -> {lines: [{speaker, emotion, text, pause}], speakers} - pure */
function parse(text, opts) {
  const o = opts || {};
  const single = o.mode === "single";
  const out = [], speakers = [];
  let cur = "", gap = 0;
  const raw = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  for (const ln of raw) {
    const s = ln.trim();
    if (!s) { gap++; continue; }
    let speaker = cur, emotion = "", words = s;
    // a speaker: one to three words, each starting with a letter ("Anna", "Dr Jones", "Old Man Ray"), then ":" + a space
    const m = single ? null : /^([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F'.-]{0,20}(?: [A-Za-z\u00C0-\u024F][\w\u00C0-\u024F'.-]{0,20}){0,2})\s*(?:\(([^)]{1,24})\)|\[([^\]]{1,24})\])?\s*:\s+(.+)$/.exec(s);
    if (m && !/^(https?|ftp)$/i.test(m[1].trim())) { speaker = m[1].trim(); emotion = emotionOf(m[2] || m[3]); words = m[4].trim(); if ((m[2] || m[3]) && !emotion) words = "(" + (m[2] || m[3]) + ") " + words; }
    const e2 = /^[([]\s*([A-Za-z]{3,12})\s*[)\]]\s*(.+)$/.exec(words);    // (sad) words  /  [happy] words
    if (e2 && emotionOf(e2[1])) { emotion = emotionOf(e2[1]); words = e2[2].trim(); }
    if (!words) continue;
    if (!single && speaker && !speakers.includes(speaker)) speakers.push(speaker);
    cur = speaker;
    chunks(words).forEach((w, i) => out.push({ speaker: single ? "" : speaker, emotion, text: w, pause: i === 0 && out.length ? (gap ? 2 : 1) : 0 }));
    gap = 0;
  }
  return { lines: out, speakers };
}
/** a long line cut at sentence ends (under ~600 characters a piece) */
function chunks(t) {
  if (t.length <= 600) return [t];
  const parts = t.match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [t], out = [];
  let buf = "";
  parts.forEach((p) => { if ((buf + p).length > 600 && buf) { out.push(buf.trim()); buf = ""; } buf += p; });
  if (buf.trim()) out.push(buf.trim());
  return out.flatMap((x) => (x.length > 600 ? x.match(/.{1,600}(\s|$)/g).map((y) => y.trim()) : [x])).filter(Boolean);
}

/** the file name made safe (no extension, no folders) */
function stemOf(name) {
  return String(name || "").trim().split(/[\\/]/).pop().replace(/\.(wav|mp3)$/i, "").replace(/[\\/:*?"<>|]+/g, "_").replace(/[^\w .()'-]+/g, "_").replace(/^[.\s_]+/, "").slice(0, 80).trim();
}
function freeName(dir, stem, ext) {
  let n = stem + "." + ext, i = 2;
  while (fs.existsSync(path.join(dir, n))) n = stem + "_" + (i++) + "." + ext;
  return n;
}
/** who speaks a line, in what voice and mood */
function plan(lines, job, voiceExists) {
  const cast = job.cast && typeof job.cast === "object" ? job.cast : {};
  return lines.map((L) => {
    const c = (L.speaker && cast[L.speaker]) || {};
    const voice = String(c.voice || job.voice || "").trim() || null;
    const emotion = L.emotion || emotionOf(c.emotion) || emotionOf(job.emotion) || "neutral";
    // a voice recorded in this mood ("Anna.happy") beside the voice itself
    const moodVoice = voice && emotion !== "neutral" && voiceExists && voiceExists(voice + "." + emotion) ? voice + "." + emotion : null;
    return Object.assign({}, L, { voice, emotion, moodVoice });
  });
}
/** the ffmpeg -metadata pairs for the file */
function metaArgs(fmt, m) {
  const pairs = fmt === "mp3"
    ? [["title", m.title], ["date", m.date], ["comment", m.description], ["lyrics", m.text], ["artist", m.voices], ["genre", "Speech"], ["encoded_by", "bitGen Studio"]]
    : [["title", m.title], ["date", m.date], ["comment", m.description], ["ISBJ", m.text], ["artist", m.voices], ["genre", "Speech"], ["ISFT", "bitGen Studio"]];
  return pairs.filter(([, v]) => v != null && String(v) !== "").flatMap(([k, v]) => ["-metadata", k + "=" + String(v)]);
}
/** the local date + time as "2026-10-30T15:20:00" (what the file says it was made at) */
function stamp(d) {
  const t = d || new Date(), p = (n) => String(n).padStart(2, "0");
  return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()) + "T" + p(t.getHours()) + ":" + p(t.getMinutes()) + ":" + p(t.getSeconds());
}

/* ---------------- the work */
const progress = { busy: false, started: 0, step: 0, total: 0, last: "", lines: [] };
function note(t) { const s = String(t || "").replace(/^\[tts\]\s*/, "").trim(); if (!s) return; progress.last = s; progress.lines.push(s); if (progress.lines.length > 80) progress.lines.splice(0, 40); }
function progressState() { return { busy: progress.busy, step: progress.step, total: progress.total, last: progress.last, seconds: progress.busy ? Math.round((Date.now() - progress.started) / 1000) : 0, lines: progress.lines.slice(-12) }; }
const deps = { runJson: (...a) => require("./venv").runJson(...a) };     // tests swap this

/** read and save: job = {name, description, text, engine, format, mode, voice, emotion, cast, pause} */
async function speak(job) {
  const tts = require("./tts");
  const j = job || {};
  const text = String(j.text || "").trim();
  if (!text) throw new Error("nothing to read - paste, type or ✨ write the text first");
  if (text.length > MAX_TEXT) throw new Error("the text is too long (" + MAX_TEXT + " characters at most)");
  const stem = stemOf(j.name);
  if (!stem) throw new Error("give the file a name (above the text)");
  const fmt = FORMATS.includes(String(j.format || "").toLowerCase()) ? String(j.format).toLowerCase() : "wav";
  if (progress.busy) throw new Error("a speech is being made already - wait for it");
  const base = tts.cfg(), engine = j.engine === "ming" || j.engine === "omnivoice" ? j.engine : base.engine;
  const c = Object.assign({}, base, { engine });
  const rt = tts.engineRuntime(c);
  if (!rt.venv.ready) throw new Error(rt.install_hint);
  const { lines } = parse(text, { mode: j.mode });
  if (!lines.length) throw new Error("nothing to read");
  const voices = new Map();
  const getVoice = (n) => { if (!n) return null; if (!voices.has(n)) voices.set(n, tts.readVoice(n)); return voices.get(n); };
  const P = plan(lines, j, (n) => !!getVoice(n));
  P.forEach((L) => { if (L.voice && !getVoice(L.voice)) throw new Error("voice \"" + L.voice + "\" is not in Settings ▸ Audio ▸ Voices"); });
  const pause = Math.max(0, Math.min(5, isFinite(+j.pause) ? +j.pause : 0.35));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bitgen-speech-"));
  progress.busy = true; progress.started = Date.now(); progress.step = 0; progress.total = P.length; progress.lines = []; progress.last = "starting " + engine + "…";
  try {
    const outs = P.map((_, i) => path.join(tmp, "line" + String(i).padStart(4, "0") + ".wav"));
    const vjob = (L) => { const v = getVoice(L.moodVoice || L.voice); return { ref_audio: v && v.kind === "clone" ? v.path : null, ref_text: v ? v.text : "", instruct: v && v.kind === "design" ? v.instruct : "", prompt_cache: v ? v.prompt_cache : null }; };
    if (engine === "omnivoice") {
      const items = P.map((L, i) => Object.assign({ text: L.text, out: outs[i], speed: L.moodVoice ? 1 : (EMOTIONS[L.emotion] || EMOTIONS.neutral).speed }, vjob(L)));
      note("OmniVoice: " + items.length + " line(s) - the model loads once");
      const r = await deps.runJson(rt.venv.python, rt.helper, { op: "batch", items, model: c.omnivoice.model, device: c.device, num_step: c.omnivoice.num_step },
        { timeout_ms: c.timeout_ms * Math.max(1, Math.ceil(items.length / 4)), onLog: (l) => { note(l); const m = /line (\d+)\/(\d+)/.exec(l); if (m) progress.step = +m[1]; } });
      if (r && r.error) throw new Error(r.error);
    } else {
      for (let i = 0; i < P.length; i++) {
        const L = P[i]; progress.step = i + 1; note("Ming-3.0 TTS: line " + (i + 1) + "/" + P.length + (L.emotion !== "neutral" ? " (" + L.emotion + ")" : ""));
        const r = await deps.runJson(rt.venv.python, rt.helper, Object.assign({ op: "speak", src: rt.src, model: rt.model, text: L.text, out: outs[i], device: c.device, language: c.ming.language,
          emotion: L.emotion !== "neutral" ? EMOTIONS[L.emotion].zh : "", emotion_en: L.emotion }, vjob(L)), { timeout_ms: c.timeout_ms, onLog: note });
        if (r && r.error) throw new Error(r.error);
      }
    }
    outs.forEach((o, i) => { if (!fs.existsSync(o) || fs.statSync(o).size < 64) throw new Error("line " + (i + 1) + " came out empty"); });
    // one file: the lines with their pauses, 44.1 kHz mono, the metadata in it
    note("joining " + outs.length + " line(s) into one " + fmt);
    const dir = core.pDir("sound"); fs.mkdirSync(dir, { recursive: true });
    const file = freeName(dir, stem, fmt), dest = path.join(dir, file);
    const when = stamp();
    const who = [...new Set(P.map((L) => L.voice || "(the engine's voice)"))].join(", ");
    const meta = { title: stem, date: when, description: String(j.description || "").trim().slice(0, 2000), text, voices: who };
    const args = ["-hide_banner", "-loglevel", "error", "-y"];
    outs.forEach((o) => args.push("-i", o));
    const fc = [], ins = [];
    P.forEach((L, i) => {
      const gap = i === 0 ? 0 : L.pause === 0 ? Math.min(pause, 0.15) : pause * L.pause;   // a long line's next piece: a breath
      fc.push("[" + i + ":a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=mono" + (gap > 0 ? ",adelay=" + Math.round(gap * 1000) + ":all=1" : "") + "[a" + i + "]");
      ins.push("[a" + i + "]");
    });
    fc.push(ins.join("") + "concat=n=" + P.length + ":v=0:a=1[out]");
    args.push("-filter_complex", fc.join(";"), "-map", "[out]", "-ac", "1", "-ar", "44100");
    if (fmt === "mp3") args.push("-c:a", "libmp3lame", "-q:a", "2", "-id3v2_version", "4", "-write_id3v1", "0");
    else args.push("-c:a", "pcm_s16le");
    args.push(...metaArgs(fmt, meta), dest);
    const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(dest)) throw new Error("ffmpeg could not join the lines: " + (String(r.stderr || "").trim().split("\n").pop() || "failed"));
    note("saved " + file);
    return { ok: true, name: file, kind: "sound", format: fmt, engine, lines: P.length, duration: core.probeDuration(dest), meta,
      plan: P.map((L) => ({ speaker: L.speaker, voice: L.voice, emotion: L.emotion, mood: L.moodVoice || null })) };
  } finally {
    progress.busy = false;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
}
/** the metadata a sound asset carries (ffprobe) */
function readMeta(name) {
  const f = path.join(core.pDir("sound"), path.basename(String(name || "")));
  if (!fs.existsSync(f)) { const e = new Error("no such sound asset"); e.status = 404; throw e; }
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", f], { encoding: "utf8" });
  let t = {}; try { t = (JSON.parse(r.stdout || "{}").format || {}).tags || {}; } catch { t = {}; }
  const g = (k) => t[k] || t[k.toUpperCase()] || t[k.toLowerCase()] || "";
  return { name: path.basename(f), title: g("title"), date: g("date"), description: g("comment"), text: g("lyrics") || g("ISBJ") || t["lyrics-eng"] || "", voices: g("artist"), genre: g("genre"), tags: t };
}

/* ---------------- ✨ the LLM writes it */
function llmMessages(o) {
  const b = o || {};
  const who = (Array.isArray(b.speakers) ? b.speakers : String(b.speakers || "").split(",")).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  const sys = "You write lines to be READ ALOUD by a text-to-speech voice. Output ONLY the spoken lines, one per line, each in the form\n"
    + "Name (emotion): the words\n"
    + "Emotion is one of: " + Object.keys(EMOTIONS).join(", ") + ". You may put these sound tags inside the words where they fit: " + TAGS.slice(0, 3).join(" ") + " " + TAGS[7] + ".\n"
    + "No titles, no stage directions, no narration in brackets, no markdown, no quotes round the words. Keep each line under 40 words.";
  const user = (b.brief ? "Write: " + String(b.brief).trim().slice(0, 1500) : "Write a short, natural exchange.") + "\n"
    + (who.length ? "Speakers: " + who.join(", ") + (who.length === 1 ? " (a monologue)" : "") + ".\n" : "Speakers: invent one or two names.\n")
    + (b.lines ? "About " + Math.max(1, Math.min(60, +b.lines || 8)) + " lines.\n" : "")
    + (b.emotion && emotionOf(b.emotion) ? "Mostly " + emotionOf(b.emotion) + ".\n" : "");
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}
/** the LLM's answer tidied into script lines (markdown, quotes, numbering and empty chatter out) */
function tidyLlm(t) {
  return String(t || "").replace(/<think>[\s\S]*?<\/think>/gi, "").split(/\r?\n/).map((s) => s.trim()
    .replace(/^[-*•\d.)\s]+(?=[A-Za-z])/, "").replace(/\*\*/g, "").replace(/^#+\s*/, "")
    .replace(/:\s*["“](.*)["”]\s*$/, ": $1")).filter((s) => s && !/^(here (is|are)|sure|certainly|okay)[ ,!:]/i.test(s)).join("\n").trim();
}

module.exports = { EMOTIONS, ALIAS, TAGS, FORMATS, MAX_TEXT, emotionOf, parse, chunks, stemOf, freeName, plan, metaArgs, stamp, speak, readMeta, llmMessages, tidyLlm, progressState, deps };
