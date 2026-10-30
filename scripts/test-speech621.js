#!/usr/bin/env node
/* bitGen Studio — 2.621.0 (pure + the read with a stand-in engine + wiring): THE SFX DOCKER'S 🗣 SPEECH & DIALOG.
 * Tim: "in the sfx docker can you add an input that the user can copy/paste text, or get input from the llm or type custom
 * text to create speech/dialog user can choose the voice/voices and the text will be read with emotion using omnivoice or
 * ming voices. save formats will be wav or mp3 to save the read voice into assets-audio. The name of the file will be an
 * input above the speech input, description will be below - it would be great if we can save the date,time,description and
 * text in the files metadata"
 *   lib/speechDialog.js: the script (speakers, emotions, tags, pauses), who speaks in what voice / mood, OmniVoice in one
 *   batch / Ming per line with its EMOTION task, the lines joined into one .wav / .mp3 in the Sound (Audio) assets with the
 *   date + time, description, text and voices in its metadata; the LLM's lines tidied. scripts/ming_local.py (emotion),
 *   scripts/omnivoice_local.py (batch). Needs ffmpeg. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const core = require(path.join(R, "lib", "core.js"));
const tts = require(path.join(R, "lib", "tts.js"));
const SD = require(path.join(R, "lib", "speechDialog.js"));

(async () => {
  /* the script */
  const P = SD.parse("Anna (happy): We made it! [laughter]\nBen: Already?\nI thought it took longer.\n\n(sad) It is over.\nThe time is 10:30 now.\nDr Jones [furious]: Out!");
  check("parse: \"Name (emotion): words\", a line without a name goes on with the speaker above, \"(sad) words\", tags kept",
    P.speakers.join() === "Anna,Ben,Dr Jones" && P.lines.length === 6 && P.lines[0].emotion === "happy" && /\[laughter\]$/.test(P.lines[0].text) && P.lines[2].speaker === "Ben" && P.lines[3].emotion === "sad" && P.lines[3].text === "It is over.", P);
  check("…a blank line = a longer pause; \"10:30\" is not a speaker; an alias (furious) is angry", P.lines[3].pause === 2 && P.lines[4].speaker === "Ben" && P.lines[4].text === "The time is 10:30 now." && P.lines[5].emotion === "angry", P.lines);
  const one = SD.parse("Anna: Hello\nBen: hi", { mode: "single" });
  check("one voice reads it all: no speakers, the names read as words", !one.speakers.length && one.lines[0].text === "Anna: Hello");
  const long = SD.parse("Ann: " + "This is a sentence that goes on. ".repeat(40));
  check("a long line is cut at sentence ends (under 600 characters a piece), its pieces close together", long.lines.length >= 2 && long.lines.every((l) => l.text.length <= 600 && l.speaker === "Ann") && long.lines[1].pause === 0);
  check("the emotions: Ming's seven (neutral happy sad angry fearful disgusted surprised) with their labels",
    Object.keys(SD.EMOTIONS).join() === "neutral,happy,sad,angry,fearful,disgusted,surprised" && SD.EMOTIONS.happy.zh === "高兴" && SD.emotionOf("Scared") === "fearful" && SD.emotionOf("laughter") === "");
  const pl = SD.plan(P.lines, { voice: "Narrator", emotion: "neutral", cast: { Anna: { voice: "Anna" }, Ben: { voice: "Ben", emotion: "surprised" } } }, (n) => n === "Anna.happy");
  check("plan: each speaker's voice (the cast, else the Voice), the line's emotion else the speaker's else the Emotion; a voice recorded in that mood (Anna.happy) is used",
    pl[0].voice === "Anna" && pl[0].moodVoice === "Anna.happy" && pl[1].voice === "Ben" && pl[1].emotion === "surprised" && pl[3].emotion === "sad" && pl[5].voice === "Narrator" && pl[5].emotion === "angry", pl);
  check("file names made safe (no folders, no extension)", SD.stemOf("../a/My line?.mp3") === "My line_" && SD.stemOf("  ") === "", SD.stemOf("../a/My line?.mp3"));
  check("the date + time stamp (local) 2026-10-30T15:04:05", SD.stamp(new Date(2026, 9, 30, 15, 4, 5)) === "2026-10-30T15:04:05");
  check("metadata: WAV INFO (title, date, comment = description, ISBJ = the text, artist = voices) / MP3 ID3 (lyrics = the text)",
    SD.metaArgs("wav", { title: "t", date: "d", description: "x", text: "y", voices: "v" }).join("|").includes("ISBJ=y") && SD.metaArgs("mp3", { title: "t", text: "y" }).join("|").includes("lyrics=y"));

  /* the read, with a stand-in engine (ffmpeg tones) */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp621_")), snd = path.join(dir, "sound"); fs.mkdirSync(snd);
  const realP = core.pDir; core.pDir = (k) => (k === "sound" ? snd : realP(k));
  const realRt = tts.engineRuntime, realRead = tts.readVoice, realCfg = tts.cfg;
  const ref = path.join(dir, "anna.wav"); execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=1", ref]);
  tts.cfg = () => Object.assign(realCfg(), { engine: "omnivoice" });
  tts.engineRuntime = (c) => ({ engine: c.engine, venv: { ready: true, python: "py" }, helper: c.engine + "_local.py", src: "/ming", model: "/m", install_hint: "x" });
  tts.readVoice = (n) => (n === "Anna" || n === "Anna.happy" ? { name: n, kind: "clone", path: ref, text: "hi", prompt_cache: null } : n === "Ben" ? { name: n, kind: "design", instruct: "male, low pitch" } : null);
  const calls = [];
  SD.deps.runJson = async (py, helper, job, o) => {
    calls.push({ helper, job });
    const items = job.op === "batch" ? job.items : [job];
    items.forEach((it, i) => { if (o && o.onLog) o.onLog("[tts] line " + (i + 1) + "/" + items.length); execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=" + (200 + 50 * i) + ":duration=0.5", "-ar", "24000", it.out]); });
    return { outs: items.map((x) => x.out) };
  };
  let r = await SD.speak({ name: "Intro dialog", description: "the opening scene", text: "Anna (happy): We made it!\nBen: Already?", engine: "omnivoice", format: "wav", cast: { Anna: { voice: "Anna" }, Ben: { voice: "Ben", emotion: "surprised" } }, pause: 0.3 });
  const b = calls[0];
  check("OmniVoice: ONE batch (the model loads once): Anna's happy line in her happy recording, Ben's designed voice a little faster (surprised)",
    calls.length === 1 && b.job.op === "batch" && b.job.items.length === 2 && b.job.items[0].ref_audio === ref && b.job.items[0].speed === 1 && b.job.items[1].instruct === "male, low pitch" && b.job.items[1].speed === 1.06, b && b.job);
  check("…saved into the Audio (Sound) assets as Intro dialog.wav, 44.1 kHz mono, ~1.3 s (two lines + the pause)",
    r.name === "Intro dialog.wav" && fs.existsSync(path.join(snd, r.name)) && r.lines === 2 && Math.abs(r.duration - 1.3) < 0.08 && /44100/.test(spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels", "-of", "csv=p=0", path.join(snd, r.name)], { encoding: "utf8" }).stdout), r);
  let m = SD.readMeta(r.name);
  check("…its metadata: the title, the date + time, the description, the text, the voices", m.title === "Intro dialog" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(m.date) && m.description === "the opening scene" && m.text === "Anna (happy): We made it!\nBen: Already?" && m.voices === "Anna, Ben", m);
  calls.length = 0;
  r = await SD.speak({ name: "Intro dialog", description: "take 2 - ünïcode", text: "(angry) Get out!", engine: "ming", format: "mp3", voice: "Anna" });
  check("Ming-3.0 TTS: a line at a time with its EMOTION label (愤怒 = angry) and the clone", calls.length === 1 && calls[0].job.op === "speak" && calls[0].job.emotion === "愤怒" && calls[0].job.emotion_en === "angry" && calls[0].job.ref_audio === ref, calls[0] && calls[0].job);
  m = SD.readMeta(r.name);
  const again = await SD.speak({ name: "Intro dialog", text: "Anna: once more", voice: "Anna" });
  check("MP3: Intro dialog.mp3 - ID3 title / date + time / comment / lyrics = the text; a name already there is never written over (Intro dialog_2.wav)", r.name === "Intro dialog.mp3" && again.name === "Intro dialog_2.wav" && m.title === "Intro dialog" && /T\d\d:\d\d/.test(m.date) && m.description === "take 2 - ünïcode" && m.text === "(angry) Get out!", m);
  let e1 = ""; try { await SD.speak({ name: "", text: "x" }); } catch (e) { e1 = e.message; }
  let e2 = ""; try { await SD.speak({ name: "a", text: "Zed: hi", cast: { Zed: { voice: "Nobody" } } }); } catch (e) { e2 = e.message; }
  check("no name / an unknown voice: said in words, nothing written", /give the file a name/.test(e1) && /Nobody/.test(e2) && fs.readdirSync(snd).length === 3, { e1, e2 });
  tts.engineRuntime = (c) => ({ engine: c.engine, venv: { ready: false }, install_hint: "OmniVoice is not installed" });
  let e3 = ""; try { await SD.speak({ name: "a", text: "hi" }); } catch (e) { e3 = e.message; }
  check("an engine that is not installed: where to install it", /not installed/.test(e3));
  tts.engineRuntime = realRt; tts.readVoice = realRead; tts.cfg = realCfg; core.pDir = realP;
  fs.rmSync(dir, { recursive: true, force: true });

  /* the LLM */
  const msgs = SD.llmMessages({ brief: "two friends meet", speakers: ["Anna", "Ben"], emotion: "happy", lines: 6 });
  check("✨ the LLM is asked for \"Name (emotion): words\" lines only, with the cast and the mood", /Name \(emotion\): the words/.test(msgs[0].content) && /Speakers: Anna, Ben/.test(msgs[1].content) && /Mostly happy/.test(msgs[1].content) && /About 6 lines/.test(msgs[1].content));
  check("…its answer tidied: no chatter, numbering, bold or quotes", SD.tidyLlm("Sure! Here is the dialog:\n1. **Anna (happy):** \"Hi there!\"\n- Ben: Hello.") === "Anna (happy): Hi there!\nBen: Hello.", SD.tidyLlm("Sure! Here is the dialog:\n1. **Anna (happy):** \"Hi there!\"\n- Ben: Hello."));

  /* the engines' helpers */
  const py = spawnSync("python3", ["-c", [
    "import sys; sys.path.insert(0, 'scripts'); import ming_local as M, json",
    "f = ['--model_path','--task','--text','--output','--prompt_wav_path','--prompt_text','--use_spk_emb','--emotion','--instruction']",
    "a, _ = M.build_cmd({'text':'hi','model':'m','out':'o.wav','ref_audio':'r.wav','ref_text':'t','emotion':'高兴','emotion_en':'happy'}, f, True)",
    "b, _ = M.build_cmd({'text':'hi','model':'m','out':'o.wav','instruct':'old man','emotion':'悲伤','emotion_en':'sad'}, f, True)",
    "c, _ = M.build_cmd({'text':'hi','model':'m','out':'o.wav','emotion':'悲伤'}, ['--model_path','--task','--text','--output','--controls'], True)",
    "d, _ = M.build_cmd({'text':'hi','model':'m','out':'o.wav','emotion':'悲伤'}, ['--model_path','--task','--text','--output'], True)",
    "print(json.dumps([a, b, c, d], ensure_ascii=False))"].join("\n")], { cwd: R, encoding: "utf8" });
  let M = []; try { M = JSON.parse(py.stdout); } catch (e) { M = [py.stderr]; }
  const has = (a, ...x) => x.every((v, i) => a.indexOf(v) >= 0 && (i === 0 || a.indexOf(v) === a.indexOf(x[i - 1]) + 1));
  check("ming_local.py: a clone + an emotion = --task EMOTION --emotion 高兴 with the clip (--use_spk_emb)", M.length === 4 && has(M[0], "--task", "EMOTION") && has(M[0], "--emotion", "高兴") && M[0].includes("--use_spk_emb") && has(M[0], "--prompt_wav_path", "r.wav"), M);
  check("…a designed voice + an emotion = one FREEFORM instruction; a --controls build gets {\"emotion\": …}; a build with neither reads it plainly (TTS)",
    M.length === 4 && has(M[1], "--task", "FREEFORM") && M[1].includes("old man. Speak with a sad emotion.") && has(M[2], "--controls", "{\"emotion\": \"悲伤\"}") && has(M[3], "--task", "TTS"), M);
  const OV = read("scripts/omnivoice_local.py");
  check("omnivoice_local.py: op \"batch\" loads the model once for every line (load / synth(job, model) / batch)", /def load\(job\):/.test(OV) && /def synth\(job, model=None\):/.test(OV) && /def batch\(job\):/.test(OV) && /if job\.get\("op"\) == "batch":/.test(OV) && /model = load\(job\)\n    outs/.test(OV));

  /* the wiring */
  const DH = read("ext/sfxdock/dock.html"), EJ = JSON.parse(read("ext/sfxdock/ext.json")), JS = read("ext/sfxdock/sfxspeech.js"), RT = read("routes/speechDialog.js"), RI = read("routes/index.js");
  const iName = DH.indexOf('id="spName"'), iText = DH.indexOf('id="spText"'), iDesc = DH.indexOf('id="spDesc"');
  check("the SFX docker: the file name ABOVE the text, the description BELOW it; 📋 Paste, ✨ Write, ＋ tags, Engine, Voice, Emotion, WAV / MP3, the cast, 🗣 Read & save",
    iName > 0 && iName < iText && iText < iDesc && ["spPaste", "spWrite", "spBrief", "spTag", "spMode", "spEngine", "spVoice", "spEmo", "spFmt", "spPause", "spCast", "spGo", "spPlay"].every((id) => DH.includes('id="' + id + '"')) && /<option value="mp3">MP3<\/option>/.test(DH));
  check("its script loads after the SFX docker's; routes /api/speech[/parse|/speak|/progress|/write|/meta] mounted from routes/index.js",
    EJ.scripts.join() === "sfxdock.js,sfxspeech.js" && ["\"/api/speech\"", "\"/api/speech/parse\"", "\"/api/speech/speak\"", "\"/api/speech/progress\"", "\"/api/speech/write\"", "\"/api/speech/meta\""].every((u) => RT.includes(u)) && /require\("\.\/speechDialog"\)\.mount\(app\)/.test(RI)
    && /navigator\.clipboard\.readText/.test(JS) && /\/passets\/sound\//.test(JS) && /refreshAssets/.test(JS));
  check("the stand-in engine (the gate) answers a batch", /if job\.get\("op"\) == "batch":/.test(read("scripts/stub-venv.py")));
  check("server.js untouched by this release", !/speechDialog|\/api\/speech/.test(read("misc/server.js")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed - " + (e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
