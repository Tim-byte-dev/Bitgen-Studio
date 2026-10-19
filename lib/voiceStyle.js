"use strict";
/**
 * voiceStyle.js — SPEECH WITH EXPRESSION, IN THE VOICE OF THE REFERENCE, NEVER ITS WORDS (2.363.0).
 *
 * Tim: "can we get the llm to learn how to make the character speak with expression and emotion using the
 * reference audio but not saying the words in the reference audio. right now the renders are speaking crap but
 * also have the scripted words".
 *
 * Why the renders babble: the scene's lines reached MiniMax H3 as plain prose (`@anna says: "Hi."`) and each
 * voice clip only as "<Audio 2> speaks with the voice of ..." - the model had no marked dialogue to lock onto,
 * so it voiced its own invented speech AND it heard the reference clip as content to say. H3's own syntax (the
 * pack's guide) is a marked line, `says, in the timbre of <Audio 1>, <d>[English] Hi.</d>`: prose speech
 * "renders gibberish vocals", and a voice reference is a TIMBRE.
 *
 *   speech(text, hasVoice)   every spoken line -> H3 dialogue: the delivery the writer gave (emotion, manner)
 *                            stays OUTSIDE the <d>, the words go INSIDE verbatim, and a character with a
 *                            voice in this render speaks "in the timbre of @tag_voice"
 *   binding(prompt, tags)    the closing lines: each voice is the character's timbre only (pitch, accent,
 *                            texture, emotional colour) and is never said; only the <d> lines are spoken
 *   voiceLabel               how the reference map describes a voice clip
 *   sample(file, dir)        a voice clip as the model gets it: leading silence off, at most VOICE_MAX s - a
 *                            short clean sample gives the timbre with far less speech to copy
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const VOICE_MAX = 8;              // seconds of a voice reference the model hears
const LANG = "English";
// speaking verbs (any of say / says / said / saying ...)
const VERBS = ["say", "ask", "repl", "answer", "whisper", "shout", "yell", "call", "cr", "mutter", "murmur", "laugh",
  "sob", "snap", "plead", "beg", "scream", "sigh", "growl", "hiss", "insist", "admit", "add", "continu", "breath",
  "teas", "warn", "jok", "demand", "announc", "stammer", "whimper", "grumbl", "exclaim", "declar", "speak", "said",
  "spoke", "tell", "told"];
const VERB_RE = new RegExp(`\\b(${VERBS.join("|")})(s|es|ies|ied|ed|d|e|y|ing)?\\b`, "i");

const voiceLabel = "voice timbre only - its pitch, accent, texture and emotional colour; never repeat the words heard in it";

/** "[English] words" unless the line already names its language ("[Spanish] ..."). */
function inner(words) {
  const w = String(words || "").trim().replace(/<\/?d>/gi, "");
  return /^\[[A-Za-z][\w -]*\]/.test(w) ? w : `[${LANG}] ${w}`;
}

/**
 * Spoken lines -> H3 dialogue. A spoken line is "@tag <verb>[, delivery]: "words"" (the writer's shape) or
 * "@tag <verb> ... "words"" inside a sentence. hasVoice(tag) says whether the tag's voice rides this render.
 * -> {text, lines: n converted}
 */
function speech(text, hasVoice) {
  let n = 0;
  const has = typeof hasVoice === "function" ? hasVoice : () => false;
  const out = String(text || "").split("\n").map((line) => {
    if (/<d>/i.test(line)) return line;                        // already H3 dialogue
    // @tag <stuff with a speaking verb, no quotes> [:,]? "words"[.]
    // the writer's whole-line shape ("@tag <anything>: "words"") is speech even without a verb
    const whole = /^\s*@[A-Za-z][\w-]*[^"@\n]*:\s*[“"][^"”]+[”"]\s*\.?\s*$/.test(line);
    return line.replace(/(@([A-Za-z][\w-]*))([^"@\n]{0,160}?)\s*[:,]?\s*[“"]([^"”]+)[”"](\s*\.(?=\s|$))?/g, (m, at, tag, mid, words) => {
      if (!whole && !VERB_RE.test(mid)) return m;              // a quoted title or sign, not speech
      n++;
      const lead = (at + mid).replace(/[\s,:]+$/, "");
      const timbre = has(tag) && !/in the timbre of/i.test(mid) ? `, in the timbre of @${tag}_voice` : "";
      return `${lead}${timbre}: <d>${inner(words)}</d>`;
    });
  });
  return { text: out.join("\n"), lines: n };
}

/** The closing lines for a render whose characters speak (tags = refMap's tag -> number map). */
function binding(prompt, tags) {
  const said = new Set();
  const out = [];
  String(prompt || "").replace(/(^|[^\w@<])@([A-Za-z][\w-]*)/g, (m, pre, t) => {
    const k = t.toLowerCase();
    if (!k.endsWith("_voice") && !said.has(k) && tags[k] && tags[k + "_voice"]) {
      said.add(k);
      out.push(`@${t}'s voice is @${t}_voice - its timbre only (pitch, accent, texture, emotional colour); `
        + `@${t} never says the words heard in @${t}_voice.`);
    }
    return m;
  });
  const speaks = /<d>/i.test(String(prompt || ""));
  if (speaks) out.push("Only the lines inside <d>...</d> are spoken, each with the emotion written beside it - "
    + "no other speech, no mumbling, no invented words.");
  return out.length ? "\n\n" + out.join("\n") : "";
}

/** A voice clip trimmed for the model (leading silence off, <= VOICE_MAX s); the original when it is short or
 *  ffmpeg is missing. Cached by path + mtime in dir. -> {file, trimmed, seconds} */
function sample(file, dir) {
  let st;
  try { st = fs.statSync(file); } catch { return { file, trimmed: false }; }
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
                       { encoding: "utf8", timeout: 30000 });
  const secs = pr.status === 0 ? parseFloat(pr.stdout) : NaN;
  if (Number.isFinite(secs) && secs <= VOICE_MAX + 0.25) return { file, trimmed: false, seconds: secs };
  const key = crypto.createHash("sha1").update(file + ":" + st.mtimeMs + ":" + VOICE_MAX).digest("hex").slice(0, 12);
  const out = path.join(dir || require("os").tmpdir(), `voice_${path.basename(file, path.extname(file)).replace(/[^\w-]+/g, "_")}_${key}.wav`);
  if (fs.existsSync(out)) return { file: out, trimmed: true, seconds: VOICE_MAX };
  try { fs.mkdirSync(path.dirname(out), { recursive: true }); } catch {}
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-af",
    `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,atrim=0:${VOICE_MAX},afade=t=out:st=${VOICE_MAX - 0.15}:d=0.15`,
    "-ar", "48000", "-c:a", "pcm_s16le", out], { encoding: "utf8", timeout: 60000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { file, trimmed: false, seconds: secs };
  return { file: out, trimmed: true, seconds: Math.min(VOICE_MAX, secs || VOICE_MAX) };
}

/** The writer's rule for spoken lines (lib/mvWriter.dialogueGuide). */
function writerRule(lead, other) {
  return [
    "1. DIALOGUE is a line of its own, exactly:",
    `     @${lead} <verb>, <delivery>: "<the words>"`,
    "   - verb: says / asks / replies / whispers / shouts / laughs / sobs / mutters ...",
    "   - delivery: the EMOTION and HOW it sounds - EVERY line gets one, e.g. \"voice",
    "     trembling with fear\", \"warm and teasing\", \"flat and exhausted\", \"barely",
    "     holding back tears\", \"with a nervous laugh\", \"low, through clenched teeth\".",
    "   Put the matching face and body in the action beat before the line (her jaw",
    "   tightens, his eyes glisten, she exhales and looks away).",
    "   Keep it short - about 2.5 words a second of the scene, a few lines per",
    "   scene at most. Never write <d>...</d> or speaker IDs like (S1) - the app",
    "   marks the lines for the model itself.",
    "   VOICES: each character's voice clip gives ONLY their timbre (pitch, accent,",
    "   texture). Never quote, transcribe or reuse what a voice clip says - write",
    "   only this scene's own words.",
  ];
}

module.exports = { VOICE_MAX, LANG, VERBS, voiceLabel, inner, speech, binding, sample, writerRule };

/* ---- 2.364.0 (Tim: "i think the llm is not following directions" - the prompt docker's LLM wrote
   `says with a bright, welcoming smile: "Thank you!"` - prose speech, the babble H3 makes of it): ANY spoken
   line in a free prompt (no @tags - "she says ...: "..."") is marked the same way, deterministically, whatever
   the LLM wrote. Used on the ✨ enhance reply and on every prompt-docker render (/api/generate). */
const SPEAK_STEMS = ["say", "ask", "repl", "answer", "whisper", "shout", "yell", "cr", "mutter", "murmur", "laugh",
  "sob", "plead", "beg", "scream", "sigh", "growl", "hiss", "insist", "exclaim", "declar", "speak", "said", "spoke",
  "stammer", "whimper", "announc", "greet", "chirp", "beam"];
const SPEAK_RE_SRC = `\\b(?:${SPEAK_STEMS.join("|")})(?:s|es|ies|ied|ed|d|e|y|ing)?\\b`;

/** The <Audio n> the prompt itself names as a voice / timbre ("her voice is <Audio 1>"), or "". */
function voiceRef(text) {
  const t = String(text || "");
  const a = /(?:voice|timbre|speaks? (?:with|in))[^.<\n]{0,40}(<Audio \d+>)/i.exec(t)
         || /(<Audio \d+>)[^.<\n]{0,40}(?:voice|timbre)/i.exec(t);
  return a ? a[1] : "";
}

/**
 * Mark every spoken line of a free prompt as H3 dialogue. opts.voice = "<Audio n>" (else read from the prompt).
 * -> {text, lines, voice}
 */
function markSpeech(text, opts) {
  const o = opts || {};
  const src = String(text || "");
  const voice = o.voice !== undefined ? o.voice : voiceRef(src);
  let n = 0;
  // never touch what is already inside <d>...</d>
  const parts = src.split(/(<d>[\s\S]*?<\/d>)/i);
  const re = new RegExp(`(${SPEAK_RE_SRC})([^"“”<>\\n.!?]{0,100}?)\\s*[:,]?\\s*[“"]([^"”\\n]{1,400})[”"]`, "gi");
  const out = parts.map((p) => (/^<d>/i.test(p) ? p : p.replace(re, (m, verb, mid, words) => {
    n++;
    const lead = (verb + mid).replace(/[\s,:]+$/, "");
    const timbre = voice && !/timbre of/i.test(mid) ? `, in the timbre of ${voice}` : "";
    return `${lead}${timbre}: <d>${inner(words)}</d>`;
  }))).join("");
  let text2 = out;
  if (n && !/only the lines inside <d>/i.test(text2)) {
    text2 = text2.replace(/\s*$/, "") + "\n\nOnly the lines inside <d>...</d> are spoken, with the emotion written beside "
      + "them - no other speech, no mumbling, no invented words."
      + (voice ? ` ${voice} gives the speaker's voice timbre only (pitch, accent, texture) - the words heard in it are never said.` : "");
  }
  return { text: text2, lines: n, voice };
}

/** The ✨ enhance rule for spoken lines (routes/index.js /api/enhance). */
const ENHANCE_RULE = "- Every SPOKEN line in MiniMax H3's dialogue syntax, its emotion OUTSIDE the tags and the exact words INSIDE: "
  + "she says warmly, with a bright smile, in the timbre of <Audio 1>, <d>[English] Thank you!</d> - a voice reference "
  + "(<Audio n>) gives ONLY the timbre, never words to say; never write speech as plain quotes (it renders as babble).";

module.exports.voiceRef = voiceRef;
module.exports.markSpeech = markSpeech;
module.exports.ENHANCE_RULE = ENHANCE_RULE;
module.exports.SPEAK_STEMS = SPEAK_STEMS;

/** The dock's voice for a free prompt: the <Audio n> the prompt names, else the ONE reference sound whose file
 *  name says it is a voice (voice / vox / vocal / speech / narration / dialogue / line), else "". */
function dockVoice(text, audioNames) {
  const named = voiceRef(text);
  if (named) return named;
  const names = (audioNames || []).map((x) => String(x || ""));
  const hits = names.map((nm, i) => (/voice|vox|vocal|speech|speak|narrat|dialog|line|talk/i.test(nm) ? i + 1 : 0)).filter(Boolean);
  return hits.length === 1 ? `<Audio ${hits[0]}>` : "";
}
module.exports.dockVoice = dockVoice;

/* ---- 2.365.0 (Tim: "the prompt was created by bitgen, can u teach the llm to write a proper formatted prompt
   please"): ONE teaching block - the exact shape of a MiniMax H3 prompt with speech, with a worked example - for
   every LLM that writes one (the prompt chat, ✨ enhance, the reference dock block), and ONE tidy pass that
   puts whatever the model wrote into that shape (formatSpeech). */
const EXAMPLE = [
  "<Subject 1> is the woman in <Picture 1>, the charismatic host of a luxury travel ad.",
  "<Subject 2> is the reception area and desk in <Picture 2>.",
  "<Audio 1> is the voice timbre for <Subject 1> - pitch, accent and tone only.",
  "",
  "Medium shot. The camera pans past the gold sign on the desk of <Subject 2> and reveals <Subject 1> standing behind it. "
    + "She looks into the camera and says with a bright, welcoming smile, in the timbre of <Audio 1>, <d>[English] Thank you!</d> "
    + "She then holds her warm smile in silence as the camera slowly pushes in. Golden-hour sunlight, clean commercial look. "
    + "Sound: only her line in <d>, then a soft sea breeze and gentle room tone.",
].join("\n");

const TEACHING = [
  "HOW A MINIMAX H3 VIDEO PROMPT IS WRITTEN (follow this shape exactly):",
  "1. Definitions first, one per line: \"<Subject 1> is the woman in <Picture 1>.\" (capital S), one line per",
  "   subject; then the voice: \"<Audio 1> is the voice timbre for <Subject 1> - pitch, accent and tone only.\"",
  "2. Then ONE paragraph: the shot, the camera move, the action, the light - refer to people as <Subject n>.",
  "3. SPEECH: each line inline, the emotion OUTSIDE the tags, the exact words INSIDE, with the language:",
  "   she says with a bright smile, in the timbre of <Audio 1>, <d>[English] Thank you!</d>",
  "   Never plain quotes, never <d> without [English], never speech in a separate sentence about the voice.",
  "4. A voice reference is a TIMBRE: the character never says the words heard in <Audio n>.",
  "5. After a short line give the speaker something SILENT to do (she holds her smile as the camera pushes",
  "   in) - a clip longer than its lines gets filled with invented speech.",
  "6. End with ONE Sound line: \"Sound: only her line in <d>, then <ambience>.\" NEVER stack negatives",
  "   (\"do not speak\", \"no murmurs\", \"DO NOT SPEAK AUDIO 1\") - each one invites the speech it forbids.",
  "EXAMPLE:",
  EXAMPLE,
].join("\n");

const PERSON_RE = /\b(woman|man|girl|boy|host|hostess|person|lady|guy|singer|presenter|actor|actress|character|child|kid|narrator|he|she|her|his|performer|dancer|model|speaker)\b/i;
// a sentence / clause that only repeats "do not speak" in some form (the stacked negatives)
const NEG_RE = /\b(no|not|don'?t|never|without|only)\b[^.;!?]*\b(speak|speaks|speaking|spoken|say|says|saying|words?|murmurs?|mumbl\w*|vocali[sz]ations?|talk\w*|invent\w*)\b/i;
const NEG_SPEC_RE = /\b(extra|invent\w*|scripted|other than|audio\s*\d|murmur\w*|vocali[sz]\w*|mumbl\w*|only speak|between\s*<d>)/i;
const CLOSING = "Only the lines inside <d>...</d> are spoken - no other speech, no mumbling, no invented words.";

/**
 * Put a video prompt into the H3 shape, whatever wrote it. opts = {voice, audioNames}. Steps:
 *   <subject n> -> <Subject n>; plain-quoted speech -> <d> (markSpeech); a bare <d> gets [English]; every <d> line
 *   gets "in the timbre of <Audio n>" when there is a voice; the voice is defined once after the subject lines;
 *   stray "the voice is only the timbre of <Audio n>." lines and stacked speech negatives go, replaced by one
 *   closing line. -> {text, changes: [what], voice}
 */
function formatSpeech(text, opts) {
  const o = opts || {};
  const changes = [];
  let t = String(text || "");
  const t0 = t;
  t = t.replace(/<\s*subject\s*(\d+)\s*>/gi, (m, n) => `<Subject ${n}>`);
  if (t !== t0) changes.push("<subject n> -> <Subject n>");
  const voice = o.voice !== undefined && o.voice ? o.voice : dockVoice(t, o.audioNames || []);
  // the closing line (ours, from an earlier pass) is set aside and written again at the end - the pass is idempotent
  t = t.split("\n").filter((l) => !/^\s*Only the lines inside <d>\.\.\.<\/d> are spoken/i.test(l)).join("\n").replace(/\s+$/, "");
  // an instruction that names the placeholder ("only speak the words between <d>...</d>") is not a line to say
  let meta = 0;
  t = t.split("\n").map((line) => line.split(/(?<=[.!?])\s+/).filter((sen) => {
    const hit = /<d>\s*(?:\.\.\.|…)?\s*<\/d>/i.test(sen) && !/only the lines inside <d>/i.test(sen);
    if (hit) meta++;
    return !hit;
  }).join(" ")).join("\n");
  if (meta) changes.push(`${meta} instruction(s) about "<d>...</d>" folded into one closing line`);
  const ms = markSpeech(t, { voice });
  if (ms.lines) { t = ms.text.replace(/\n\nOnly the lines inside <d>\.\.\.<\/d> are spoken[^\n]*$/, ""); changes.push(`${ms.lines} quoted line(s) -> <d>`); }
  // a bare <d> gets its language
  let bare = 0;
  t = t.replace(/<d>(?!\s*\[)([\s\S]*?)<\/d>/gi, (m, w) => { bare++; return `<d>${inner(w)}</d>`; });
  if (bare) changes.push(`[English] added to ${bare} <d> line(s)`);
  // every <d> line in the voice's timbre
  if (voice) {
    let added = 0;
    const parts = t.split(/(<d>[\s\S]*?<\/d>)/i);
    for (let i = 1; i < parts.length; i += 2) {
      const before = parts[i - 1];
      const cut = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n"), before.lastIndexOf("</d>"));
      const tail = before.slice(cut + 1);
      if (/timbre of/i.test(tail) || !/\S/.test(tail)) continue;
      parts[i - 1] = before.slice(0, cut + 1) + tail.replace(/[\s:,]*$/, "") + `, in the timbre of ${voice}, `;
      added++;
    }
    if (added) { t = parts.join(""); changes.push(`${added} <d> line(s) put in the timbre of ${voice}`); }
  }
  // the stray voice sentences and the stacked negatives
  let removed = 0;
  const lines = t.split("\n").map((line) => {
    if (/<d>/i.test(line) && !/[.!?]\s/.test(line)) return line;
    const sentences = line.split(/(?<=[.!?])\s+/);
    const kept = sentences.map((sen) => {
      if (/^\s*the voice is (only )?(the )?timbre of <Audio \d+>\s*[.!]?\s*$/i.test(sen)) { removed++; return ""; }
      if (/<d>/i.test(sen)) return sen;
      const clauses = sen.split(/;\s*/);
      const ck = clauses.filter((c) => {
        const bad = NEG_RE.test(c) && NEG_SPEC_RE.test(c);
        if (bad) removed++;
        return !bad;
      });
      if (!ck.length) return "";
      let s2 = ck.join("; ");
      if (ck.length < clauses.length && !/[.!?]\s*$/.test(s2)) s2 = s2.replace(/\s*$/, ".");
      return s2;
    }).filter((x) => x !== "");
    return kept.join(" ");
  });
  if (removed) { t = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, ""); changes.push(`${removed} repeated "do not speak" instruction(s) folded into one closing line`); }
  // the voice defined once, with the subjects
  if (voice && !new RegExp(`${voice.replace(/[<>]/g, (c) => "\\" + c)} is (the )?voice timbre`, "i").test(t)) {
    const ls = t.split("\n");
    let last = -1;
    for (let i = 0; i < ls.length; i++) { if (/^\s*<Subject \d+>\s+is\b/.test(ls[i])) last = i; else if (last >= 0 && ls[i].trim()) break; }
    const subs = ls.filter((l) => /^\s*<Subject \d+>\s+is\b/.test(l));
    const people = subs.filter((l) => PERSON_RE.test(l));
    const who = (people.length === 1 ? people[0] : subs.length === 1 ? subs[0] : "").match(/<Subject \d+>/);
    if (last >= 0 && who) {
      ls.splice(last + 1, 0, `${voice} is the voice timbre for ${who[0]} - pitch, accent and tone only.`);
      t = ls.join("\n");
      changes.push(`the voice defined: ${voice} is the voice timbre for ${who[0]}`);
    }
  }
  // one closing line
  if (/<d>/i.test(t) && !/only the lines inside <d>/i.test(t)) {
    t = t.replace(/\s*$/, "") + "\n\n" + CLOSING
      + (voice ? ` ${voice} gives the voice timbre only - the words heard in it are never said.` : "");
    if (changes.length) changes.push("one closing line: only the <d> lines are spoken");
  }
  return { text: t, changes, voice };
}

module.exports.TEACHING = TEACHING;
module.exports.EXAMPLE = EXAMPLE;
module.exports.CLOSING = CLOSING;
module.exports.formatSpeech = formatSpeech;
