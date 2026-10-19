#!/usr/bin/env node
/* bitGen Studio — 2.363.0: SPEECH WITH EXPRESSION, IN THE VOICE OF THE REFERENCE, NEVER ITS WORDS.
 * Run: node scripts/test-voicestyle.js
 * Tim: "can we get the llm to learn how to make the character speak with expression and emotion using the
 * reference audio but not saying the words in the reference audio. right now the renders are speaking crap but
 * also have the scripted words".
 *   1. lib/voiceStyle.speech: the writer's lines -> H3 dialogue (delivery outside, words inside <d>[English] ...</d>,
 *      "in the timbre of" the character's voice); quoted signs / titles untouched; a line already marked kept;
 *   2. binding: each voice is timbre only and never said; only the <d> lines are spoken;
 *   3. sample (ffmpeg LIVE): a long voice clip -> 8 s, leading silence off, cached; a short one untouched;
 *   4. the native plan (no song): the whole prompt as the model gets it; fl2va lines marked too; a song scene
 *      unchanged; the voice header in the reference map;
 *   5. the writers: the screenplay writer's rule (every line carries its emotion, voices are timbre only), the
 *      prompt LLM's reference rule, the chain's voice line;
 *   6. 2.364.0 (Tim: "i think the llm is not following directions"): free prompts - whatever the LLM writes, the
 *      enhance reply and every prompt render mark the spoken lines (markSpeech), the dock's voice, the rule. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
const V = require(path.join(ROOT, "lib", "voiceStyle"));
const NA = require(path.join(ROOT, "lib", "nativeAudio"));
const MV = require(path.join(ROOT, "lib", "mvWriter"));
const RC = require(path.join(ROOT, "lib", "refContext"));
const SP = require(path.join(ROOT, "lib", "screenplay"));

// ---- 1. speech
const has = (t) => t !== "carl";
let s = V.speech([
  '@anna says: "Hi."',
  '@ben replies softly, with a tired half-smile: "I kept all of them."',
  '@anna whispers, voice trembling with fear: “Is someone there?”',
  '@anna looks at the sign "EXIT" and walks on.',
  'She hears @ben shout "Run!" from the roof.',
  '@carl, grinning: "Got you."',
  '@anna says, in the timbre of <Audio 1>, <d>[English] Already marked.</d>',
  '@ben asks: "[Spanish] ¿Dónde estás?"'].join("\n"), has);
const L = s.text.split("\n");
check("the writer's line -> H3 dialogue in the character's timbre: <verb>, in the timbre of @x_voice: <d>[English] words</d>",
  L[0] === "@anna says, in the timbre of @anna_voice: <d>[English] Hi.</d>", L[0]);
check("...the emotion / manner the writer gave stays OUTSIDE the <d>, the words inside verbatim (curly quotes too)",
  L[1] === "@ben replies softly, with a tired half-smile, in the timbre of @ben_voice: <d>[English] I kept all of them.</d>"
  && L[2] === "@anna whispers, voice trembling with fear, in the timbre of @anna_voice: <d>[English] Is someone there?</d>", [L[1], L[2]]);
check("a quoted sign is not speech; speech inside a sentence is marked and the sentence goes on",
  L[3] === '@anna looks at the sign "EXIT" and walks on.'
  && L[4] === "She hears @ben shout, in the timbre of @ben_voice: <d>[English] Run!</d> from the roof.", [L[3], L[4]]);
check("a character with no voice in this render: marked dialogue, no timbre; the whole-line shape needs no verb",
  L[5] === "@carl, grinning: <d>[English] Got you.</d>", L[5]);
check("a line already in H3 syntax is kept; a line naming its own language keeps it",
  L[6] === '@anna says, in the timbre of <Audio 1>, <d>[English] Already marked.</d>'
  && L[7] === "@ben asks, in the timbre of @ben_voice: <d>[Spanish] ¿Dónde estás?</d>" && s.lines === 6, [L[6], L[7], s.lines]);

// ---- 2. binding
const b = V.binding(s.text, { anna: "<Picture 1>", anna_voice: "<Audio 1>", ben: "<Picture 2>", carl: "<Picture 3>" });
check("binding: a voice is its character's timbre only and is never said; only the <d> lines are spoken",
  b.includes("@anna's voice is @anna_voice - its timbre only (pitch, accent, texture, emotional colour); @anna never says the words heard in @anna_voice.")
  && !b.includes("@ben's voice") && !b.includes("@carl's voice")
  && b.includes("Only the lines inside <d>...</d> are spoken, each with the emotion written beside it - no other speech, no mumbling, no invented words."), b);
check("binding with no speech and no voices adds nothing", V.binding("@anna walks.", { anna: "<Picture 1>" }) === "");

// ---- 3. the voice sample (ffmpeg)
const T = fs.mkdtempSync(path.join(os.tmpdir(), "voice363_"));
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
try {
  const long = path.join(T, "anna long.wav"), short = path.join(T, "ben.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-f", "lavfi", "-i",
    "sine=frequency=220:duration=14", "-filter_complex", "[0:a]atrim=0:1.5[s];[1:a]volume=0.5[v];[s][v]concat=n=2:v=0:a=1", long], { stdio: "ignore" });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=3", short], { stdio: "ignore" });
  const a = V.sample(long, T);
  check("a 15.5 s voice clip with 1.5 s of silence first -> an 8 s timbre sample that starts on the voice",
    a.trimmed && a.file !== long && Math.abs(dur(a.file) - V.VOICE_MAX) < 0.1, { a, d: dur(a.file) });
  const vd = require("child_process").spawnSync("ffmpeg", ["-v", "info", "-i", a.file, "-af", "atrim=0:0.3,volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const mean = parseFloat((/mean_volume: (-?[\d.]+) dB/.exec(String(vd)) || [])[1]);
  check("...the leading silence is gone (the first 0.3 s is the voice)", Number.isFinite(mean) && mean > -30, mean);
  check("...cached: the same clip gives the same sample file", V.sample(long, T).file === a.file);
  const b2 = V.sample(short, T);
  check("a clip already short (3 s) is used as it is; a missing file comes back untouched",
    !b2.trimmed && b2.file === short && V.sample(path.join(T, "none.wav"), T).file === path.join(T, "none.wav"));

  // ---- 4. the native plan
  const imgMeta = [{ file: "/x/anna.png", name: "anna.png", tag: "anna", kind: "sheet", label: "Anna" },
                   { file: "/x/ben.png", name: "ben.png", tag: "ben", kind: "sheet", label: "Ben" }];
  const audMeta = [{ file: long, tag: "anna_voice", kind: "voice", label: "Anna" }];
  const p = NA.plan({ anchor: "reference", prompt: '@anna steps closer, eyes wet.\n@anna whispers, voice trembling: "Is someone there?"\n@ben replies, warm: "Only me."',
                      imgMeta, audMeta, song: "", window: null, n: 1, tmpDir: T });
  check("no song, Ref: the prompt the model gets - Anna's line in her voice's timbre, Ben's marked, the voice never said",
    p.prompt.includes("<Audio 1> is @anna_voice - the voice timbre of Anna: copy only its pitch, accent, texture and emotional colour, never the words heard in it.")
    && p.prompt.includes("<Picture 1> whispers, voice trembling, in the timbre of <Audio 1>: <d>[English] Is someone there?</d>")
    && p.prompt.includes("<Picture 2> replies, warm: <d>[English] Only me.</d>")
    && p.prompt.includes("<Picture 1>'s voice is <Audio 1> - its timbre only") && p.prompt.includes("<Picture 1> never says the words heard in <Audio 1>.")
    && !/says: "/.test(p.prompt), p.prompt);
  check("...the voice rides as its 8 s sample, and the notes say both things",
    p.audios.length === 1 && p.audios[0] !== long && /voice_anna_long_/.test(p.audios[0])
    && p.notes.some((x) => /1 voice clip\(s\) trimmed to a 8 s timbre sample/.test(x))
    && p.notes.some((x) => /2 spoken line\(s\) marked as H3 dialogue/.test(x)), { a: p.audios, n: p.notes });
  const fl = NA.plan({ anchor: "first", prompt: '@anna says, softly: "Stay."', imgMeta, audMeta, song: "",
                       frame: { file: "/f.png", name: "f.png", label: "the end" }, n: 2, tmpDir: T });
  check("no song, First (fl2va - no voices): the line is still marked dialogue, no timbre", /says, softly: <d>\[English\] Stay\.<\/d>/.test(fl.prompt) && !/timbre/.test(fl.prompt), fl.prompt);
  const sg = NA.plan({ anchor: "reference", prompt: "@anna sings", imgMeta, audMeta, song: "/s/song.mp3", window: { start: 0, dur: 5 }, n: 3, tmpDir: T });
  check("a song scene: no dialogue marking, no binding (the song is the voice)", !/<d>/.test(sg.prompt) && !/never says the words/.test(sg.prompt.split("\n\n").slice(1).join("\n\n")), sg.prompt);
} finally { fs.rmSync(T, { recursive: true, force: true }); }

// ---- 5. the writers
const g = MV.guide([{ name: "Anna", tag: "anna" }, { name: "Ben", tag: "ben" }], [], [], "dialogue");
check("the screenplay writer: every line carries its EMOTION and manner, the face/body before it, voices are timbre only - never their words",
  g.includes('     @anna <verb>, <delivery>: "<the words>"') && g.includes("EVERY line gets one") && g.includes("trembling with fear")
  && g.includes("Never quote, transcribe or reuse what a voice clip says") && g.includes('@anna says, quietly, voice catching: \\"You kept the ticket.\\"'), g.slice(0, 400));
const blk = RC.block({ pictures: [{ n: 1, subject: 1, role: "person", name: "ava.png", desc: "a woman" }], videos: [], audios: [{ n: 1, name: "voice.wav" }] });
check("the prompt LLM: a voice reference is timbre only (never quote it); speech in H3 syntax with the emotion outside the tags",
  blk.includes("her voice is <Audio 1>") && blk.includes("never words to say: never quote or reuse what the audio says")
  && blk.includes("she whispers, voice trembling, in the timbre of <Audio 1>, <d>[English] Is someone there?</d>"), blk);
check("the character chain's voice line: timbre only", /\(S1\) using the provided voice reference \(its timbre only - never its words\)/
  .test(SP.voiceAssignments ? SP.voiceAssignments([{ name: "Vera", tag: "vera", voices: ["v.wav"] }]) : fs.readFileSync(path.join(ROOT, "lib", "screenplay.js"), "utf8").replace("(${c.slot})", "(S1)")));

// ---- 6. 2.364.0 (Tim: "i think the llm is not following directions"): free prompts (the prompt docker)
const TIM = "<subject 1> is the woman in <Picture 1>.\n<subject 2> is the reception area and desk from <Picture 2>.\n\n"
  + "The shot is a medium shot. She has a radiant, cheery, and energetic expression as she looks toward the camera and says with a "
  + "bright, welcoming smile: \"Thank you!\" The background shows a sun-drenched villa. Sound: soft music, and her voice is clear and inviting.";
let ms = V.markSpeech(TIM);
check("2.364.0: Tim's enhanced prompt - the spoken line becomes H3 dialogue (the smile outside, the words inside), the rest untouched",
  ms.lines === 1 && ms.text.includes("says with a bright, welcoming smile: <d>[English] Thank you!</d> The background shows a sun-drenched villa.")
  && ms.text.startsWith("<subject 1> is the woman in <Picture 1>.") && ms.voice === ""
  && ms.text.endsWith("Only the lines inside <d>...</d> are spoken, with the emotion written beside them - no other speech, no mumbling, no invented words."), ms);
ms = V.markSpeech('A hotel called "The Palace" glows. Her voice is <Audio 1>. She whispers, trembling, "Stay." She reads the sign "EXIT".');
check("2.364.0: a quoted NAME or sign is not speech; the voice the prompt names is used as the timbre and said to be timbre only",
  ms.lines === 1 && ms.text.includes('called "The Palace"') && ms.text.includes('sign "EXIT"')
  && ms.text.includes("She whispers, trembling, in the timbre of <Audio 1>: <d>[English] Stay.</d>")
  && ms.text.includes("<Audio 1> gives the speaker's voice timbre only (pitch, accent, texture) - the words heard in it are never said."), ms.text);
ms = V.markSpeech("She says, in the timbre of <Audio 1>, <d>[English] Hi.</d> Then she leaves.");
check("2.364.0: a prompt already in H3 syntax is left exactly as it is", ms.lines === 0 && ms.text === "She says, in the timbre of <Audio 1>, <d>[English] Hi.</d> Then she leaves.", ms);
check("2.364.0: the dock's voice - the one the prompt names, else the ONE sound whose name says voice, else none",
  V.dockVoice("her voice is <Audio 2>", ["a.wav", "b.wav"]) === "<Audio 2>" && V.dockVoice("x", ["music.mp3", "anna_voice.wav"]) === "<Audio 2>"
  && V.dockVoice("x", ["music.mp3"]) === "" && V.dockVoice("x", ["v1_voice.wav", "v2_voice.wav"]) === "");
const RI = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
check("2.364.0 / 2.365.0: ✨ enhance teaches the syntax AND formats its reply; every prompt render formats its prompt and logs it",
  RI.includes('require("../lib/voiceStyle").ENHANCE_RULE,') && RI.includes('require("../lib/voiceStyle").TEACHING,')
  && RI.includes("const ms = vs.formatSpeech(tagged, { audioNames: eDock.audios.map((a) => a.name) });")
  && RI.includes("const ms = vs.formatSpeech(prompt, { audioNames: auNames });")
  && RI.includes('if (speechNote) try { job.log.push("[bitgen-studio] " + speechNote); } catch {}')
  && V.ENHANCE_RULE.includes("<d>[English] Thank you!</d>") && V.ENHANCE_RULE.includes("never write speech as plain quotes"));

// ---- 7. 2.365.0 (Tim: "the prompt was created by bitgen, can u teach the llm to write a proper formatted prompt")
const TIM2 = "<subject 1> is the woman in <Picture 1>.\n<subject 2> is the reception area and desk from <Picture 2>.\n"
  + "The woman in <Picture 1> is the charismatic host of a luxury travel ad, looking directly at the camera.\nThe voice is only the timbre of <Audio 1>.\n\n"
  + "The shot is a medium shot. She looks toward the camera and says with a bright, welcoming smile: <d>Thank you!</d> The background shows a villa. "
  + "Sound: the voice is the timbre of <Audio 1>, clear and inviting; there is no extra speaking, murmurs, or vocalizations other than the scripted line. "
  + "do not invent words to speak. only speak the words between <d>...</d>. DO NOT SPEAK AUDIO 1";
const fs1 = V.formatSpeech(TIM2, {});
check("2.365.0: Tim's prompt - <Subject n>, the voice defined once after the subjects, the line in its timbre with [English]",
  fs1.text.startsWith("<Subject 1> is the woman in <Picture 1>.\n<Subject 2> is the reception area and desk from <Picture 2>.\n<Audio 1> is the voice timbre for <Subject 1> - pitch, accent and tone only.\n")
  && fs1.text.includes("says with a bright, welcoming smile, in the timbre of <Audio 1>, <d>[English] Thank you!</d> The background shows a villa."), fs1.text);
check("2.365.0: the stray voice sentence, the stacked negatives and the <d>...</d> instruction are gone - ONE closing line instead",
  !/The voice is only the timbre/.test(fs1.text) && !/DO NOT SPEAK/.test(fs1.text) && !/invent words/.test(fs1.text) && !/extra speaking/.test(fs1.text)
  && !/between <d>/.test(fs1.text) && fs1.text.includes("Sound: the voice is the timbre of <Audio 1>, clear and inviting.")
  && (fs1.text.match(/Only the lines inside <d>\.\.\.<\/d> are spoken/g) || []).length === 1, fs1.text);
check("2.365.0: the pass is idempotent (a formatted prompt comes back unchanged, nothing reported)",
  V.formatSpeech(fs1.text, {}).text === fs1.text && V.formatSpeech(fs1.text, {}).changes.length === 0);
const st = V.formatSpeech('She does not speak until the door opens, then whispers, "Who is it?"', {});
check("2.365.0: a story negative is not an instruction (kept); a prompt with no speech is untouched",
  st.text.startsWith("She does not speak until the door opens, then whispers: <d>[English] Who is it?</d>")
  && V.formatSpeech("A cat walks across a sunny kitchen. Sound: birds outside.", {}).changes.length === 0, st.text);
check("2.365.0: the shape is taught everywhere a prompt is written - the chat brief, the reference block, ✨ enhance - with the worked example",
  V.TEACHING.includes("HOW A MINIMAX H3 VIDEO PROMPT IS WRITTEN") && V.TEACHING.includes(V.EXAMPLE)
  && V.EXAMPLE.includes("<Audio 1> is the voice timbre for <Subject 1>") && V.EXAMPLE.includes("in the timbre of <Audio 1>, <d>[English] Thank you!</d>")
  && RC.block({ pictures: [{ n: 1, subject: 1, role: "person", name: "a.png", desc: "x" }], videos: [], audios: [] }).includes("HOW A MINIMAX H3 VIDEO PROMPT IS WRITTEN")
  && fs.readFileSync(path.join(ROOT, "lib", "llmChat.js"), "utf8").includes("SPEECH in a video prompt: each spoken line inline"));

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
