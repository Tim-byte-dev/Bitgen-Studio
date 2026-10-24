#!/usr/bin/env node
/* bitGen Studio — 2.564.0 units: 🎙 the voice chat - the page's voice-activity detector, the wav it sends, the option
 * matcher, the actions' map (static/voicechat.js); the LLM's turn (lib/voiceAgent.js); the live transcriber kept up
 * (lib/asrLive.js + scripts/asr_live.py, here with a stand-in process); the routes (routes/voice.js).
 * Tim: "i think we just use a mic to talk to the app instead to ask for prompt, change style, create..." / "can it be like
 * live chat" / "great, lets do the voice next". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const V = require(path.join(ROOT, "static", "voicechat.js"));
const A = require(path.join(ROOT, "lib", "voiceAgent.js"));

(async () => {
  /* 1 the detector */
  const run = (seq) => { let st = null; const ev = []; for (const [rms, ms] of seq) for (let t = 0; t < ms; t += 85) { const r = V.vadStep(st, rms, 85); st = r.st; if (r.ev) ev.push(r.ev); } return ev; };
  check("vadStep: a quiet room, 1.2 s of talk, quiet again = start then end", run([[0.003, 1000], [0.08, 1200], [0.003, 1200]]).join() === "start,end");
  check("...an 85 ms click (one block) starts nothing; a 250 ms bump starts and is dropped (too short for words)", run([[0.003, 800], [0.09, 85], [0.003, 1500]]).length === 0 && run([[0.003, 800], [0.09, 255], [0.003, 1500]]).join() === "start,drop");
  check("...a short pause inside a sentence does not end it; a long talk is cut at 25 s (and goes on as the next turn)", run([[0.003, 600], [0.08, 900], [0.004, 400], [0.08, 900], [0.003, 1200]]).join() === "start,end" && run([[0.003, 600], [0.08, 26000]]).join() === "start,end,start");
  check("...the room's level is learnt: a hum below the speech threshold never starts anything", run([[0.008, 3000], [0.011, 3000]]).length === 0);

  /* 2 the wav */
  const s48 = new Float32Array(4800).fill(0.5), d = V.downsample(s48, 48000, 16000);
  const wav = new DataView(V.encodeWav(d, 16000));
  check("downsample 48 kHz -> 16 kHz (a third of the samples, the level kept); encodeWav = a 16 kHz mono 16-bit wav",
    d.length === 1600 && Math.abs(d[100] - 0.5) < 1e-6 && wav.getUint32(0, false) === 0x52494646 && wav.getUint32(24, true) === 16000 && wav.getUint16(22, true) === 1
    && wav.getUint16(34, true) === 16 && wav.getUint32(40, true) === 3200 && wav.byteLength === 44 + 3200);

  /* 3 the page's helpers */
  const opts = [{ value: "", text: "— none —" }, { value: "q21", text: "Qwen Image 2.1 edit" }, { value: "k9", text: "FLUX.2 Klein 9B" }, { value: "video", text: "🎬 Video" }, { value: "720", text: "720p" }];
  check("matchOption: words to the option (exact, part of the name, most words shared); nothing near = null",
    V.matchOption(opts, "klein") === "k9" && V.matchOption(opts, "qwen edit") === "q21" && V.matchOption(opts, "video") === "video" && V.matchOption(opts, "720") === "720" && V.matchOption(opts, "pony") === null);
  check("DOCKS / MODES / SETTING_IDS: the dockers by their words (statusbar buttons, side columns, floating panels), the video modes, Basic Settings' fields",
    V.DOCKS.storyboard.el === "videodock" && V.DOCKS.references.app === "no-refs" && V.DOCKS["basic settings"].sf === "basic" && V.MODES.fl === "fl2va" && V.SETTING_IDS.resolution === "resSel" && V.SETTING_IDS.override === "ovrStyle"
    && A.DOCKERS.every((k) => V.DOCKS[k]) && A.SETTINGS.every((k) => V.SETTING_IDS[k]));
  check("speakable: no code, no tags, no markdown or emoji in its voice", V.speakable("Done! **New** prompt: `x` <image1> 🎬 ok") === "Done! New prompt: x ok");

  /* 4 the LLM's turn */
  check("clean: a catalogue action (enum words loosely, numbers, text); unknown / missing a value = null",
    JSON.stringify(A.clean({ do: "set_generate", what: "Image" })) === '{"do":"set_generate","what":"image"}' && A.clean({ do: "render_scene", n: "3" }).n === 3 && A.clean({ action: "set_prompt", args: { text: "a fox" } }).text === "a fox"
    && A.clean({ do: "set_style", kind: "video" }) === null && A.clean({ do: "format_disk" }) === null && A.clean({ do: "set_setting", name: "volume", value: "3" }) === null);
  const rude = "<think>They want { a fox }...</think>\nSure! Here you go:\n```json\n{\"say\": \"A red fox in the snow - generating now.\", \"actions\": [{\"do\": \"set_prompt\", \"text\": \"A red fox trots through deep snow at dawn\"}, {\"do\": \"generate\"}, {\"do\": \"rm_rf\"},],}\n```\nAnything else?";
  const P = A.parse(rude);
  check("parse: a local model's answer in its clothes (a think block with braces, prose, a code fence, trailing commas) -> say + the known actions, the unknown dropped",
    P.say === "A red fox in the snow - generating now." && P.actions.map((x) => x.do).join() === "set_prompt,generate" && P.dropped.length === 1, P);
  check("...a plain answer (no JSON) = it is said, nothing done", JSON.stringify(A.parse("Sure, which style?")) === '{"say":"Sure, which style?","actions":[],"dropped":[]}');
  const M = A.messages({ text: "make it rain", history: Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "t" + i })),
    state: { prompt: "a fox", generate: "video", video_style: "LTX", video_styles: ["LTX", "H3"], settings: { steps: "8", seconds: "5" }, scenes: 3 } });
  check("messages: the system lists every action and asks for ONE JSON object, short spoken words; the last 12 turns; the app's state and what was said",
    Object.keys(A.ACTIONS).every((k) => M[0].content.includes(`"do": "${k}"`)) && /ONE JSON object/.test(M[0].content) && M.length === 14
    && /Prompt now: a fox/.test(M[13].content) && /Video style: LTX - available: LTX \| H3/.test(M[13].content) && /Basic Settings: steps 8, seconds 5/.test(M[13].content) && /\[the user said\] make it rain$/.test(M[13].content));

  /* 5 the live transcriber (a stand-in process speaking its protocol) */
  const L = require(path.join(ROOT, "lib", "asrLive.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "asrlive564-"));
  const fake = path.join(tmp, "fake_live.py");
  fs.writeFileSync(fake, "import json,sys\nprint(json.dumps({'ready':True,'device':'cpu','model':'tiny'}),flush=True)\nfor l in sys.stdin:\n  j=json.loads(l)\n  print(json.dumps({'id':j['id'],'text':'heard '+j['audio'].split('/')[-1],'language':'en'}),flush=True)\n");
  const w1 = path.join(tmp, "a.wav"); fs.writeFileSync(w1, Buffer.from(V.encodeWav(new Float32Array(1600), 16000)));
  try {
    L.configure({ python: "python3", script: fake });
    const t1 = await L.transcribe(w1), t2 = await L.transcribe(w1);
    const s1 = L.status();
    check("asrLive: one process, the model loaded once - each turn one line in, one line out (live), status says it runs", t1.text === "heard a.wav" && t1.live && t2.text === "heard a.wav" && s1.running && s1.ready && s1.model === "tiny", { t1, s1 });
    L.stop();
    check("...stop() ends it (the model's memory back)", !L.status().running);
    const bad = path.join(tmp, "bad_live.py"); fs.writeFileSync(bad, "import json\nprint(json.dumps({'fatal':'no model here'}),flush=True)\n");
    L.configure({ python: "python3", script: bad });
    let fb = null; try { fb = await L.transcribe(w1); } catch (e) { fb = { error: e.message }; }
    check("...a live transcriber that cannot start = the one-shot path answers instead (live false, the reason noted)", fb && fb.live === false && /no model here/.test(fb.note || "") || /not installed|nothing was transcribed/.test((fb && fb.error) || ""), fb);
  } finally { L.configure(null); L.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }

  /* 6 the wiring */
  const RV = rd("routes", "voice.js"), RI = rd("routes", "index.js"), IX = rd("static", "index.html"), VC = rd("static", "voicechat.js"), PY = rd("scripts", "asr_live.py");
  check("routes: hear (multipart wav -> asrLive) / turn (voiceAgent.messages -> the LLM -> parse) / status / stop, mounted from routes/index.js - nothing in server.js",
    /app\.post\("\/api\/voice\/hear", upload\.single\("audio"\)/.test(RV) && /voiceAgent\.messages\(\{ text, history: b\.history, state: b\.state \}\)/.test(RV) && /voiceAgent\.parse\(/.test(RV)
    && /require\("\.\/voice"\)\.mount\(app\);/.test(RI) && !/voice/.test(rd("misc/server.js")));
  check("the page: voicechat.js loaded; 🎙 Voice in the statusbar + Ctrl+Alt+V; the mic with echo cancelling; it does not listen while it speaks; actions shown as they run",
    /<script src="\/static\/voicechat\.js"><\/script>/.test(IX) && /b\.id = "tVoice"/.test(VC) && /e\.ctrlKey && e\.altKey/.test(VC) && /echoCancellation: true/.test(VC)
    && /if \(!S\.listen \|\| S\.busy \|\| S\.speaking\)/.test(VC) && /bubble\("did", did\)/.test(VC));
  check("complete() already answers {ok, text}: no route reads it again with readReply (2.563.0's 🤖 Write and the phone's chat said \"[object Object]\")",
    !/readReply\(r\)|readReply\(rr\)/.test(RV + rd("routes", "sceneedit.js") + rd("routes", "remote.js")) && /stripThinking\(rr\.text \|\| ""\)/.test(rd("routes", "sceneedit.js")) && /stripThinking\(r\.text \|\| ""\)/.test(RV));
  check("asr_live.py: the model loaded once, one JSON line per utterance, the GPU falling back to the CPU", /say\(\{"ready": True/.test(PY) && /for line in sys\.stdin:/.test(PY) && /model, used = load\("cpu", "int8"\), "cpu"/.test(PY) && /if "asr_live" in helper:/.test(rd("scripts", "stub-venv.py")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
