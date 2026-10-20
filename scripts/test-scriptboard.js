#!/usr/bin/env node
/* bitGen Studio — 2.323.0: THE SCENE-BY-SCENE BOARD (no looping chains).
 * Run: node scripts/test-scriptboard.js
 * Tim (verbatim): "i would like to get rid of the looping workflows and
 * replace them with the ref2va and fl2va but i would like to keep the voices
 * and characters(reference pictures and character sheets and refmod) and tags
 * ... can we add scenes to the video docker, and the llm counts the scenes
 * (or we have a txt file with number of scenes) and populates the scenes with
 * the soundtrack being optional. if screenplay then there won't be a song,
 * but i would still like to render with the nativeaudio workflow"
 *   1. nativeAudio.plan with NO song: voices take the audio slots, each
 *      speaking character is bound to its voice; fl2va carries no audio;
 *   2. mvWriter's dialogue mode (guide, problems, repair, cleanPrompt);
 *   3. the scene count (field / scenes.txt / request / LLM) + the board;
 *   4. the wiring (routes, the dock pickers). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const NA = require(path.join(ROOT, "lib", "nativeAudio"));
const W = require(path.join(ROOT, "lib", "mvWriter"));
const SC = require(path.join(ROOT, "lib", "sceneCount"));

// ---- 1. the plan without a song --------------------------------------------------------------
{
  const imgMeta = [{ file: "/x/anna.png", name: "anna.png", tag: "anna", kind: "sheet" },
                   { file: "/x/ben.png", name: "ben.png", tag: "ben", kind: "sheet" }];
  const audMeta = [{ file: "/x/anna.wav", tag: "anna_voice", kind: "voice", label: "Anna" },
                   { file: "/x/ben.wav", tag: "ben_voice", kind: "voice", label: "Ben" }];
  const p = NA.plan({ anchor: "reference", prompt: '@anna says: "Hi."\n@ben replies: "Hello."',
                      imgMeta, audMeta, song: "", window: null, n: 1 });
  check("no song, Ref: ref2va with the VOICES as the audio references (no song slot), said",
    p.mode === "ref2va" && JSON.stringify(p.audios) === '["/x/anna.wav","/x/ben.wav"]'
    && p.notes.some((x) => /no song: the native-audio model makes the sound itself/.test(x)), p);
  // 2.363.0: the lines are H3 dialogue in each character's timbre; a voice is never said
  check("...each speaking character speaks in its own voice's timbre (<d> dialogue) and never says the voice clip's words",
    p.prompt.includes("<Picture 1> says, in the timbre of <Audio 1>: <d>[English] Hi.</d>")
    && p.prompt.includes("<Picture 2> replies, in the timbre of <Audio 2>: <d>[English] Hello.</d>")
    && p.prompt.includes("<Picture 1> never says the words heard in <Audio 1>.") && p.prompt.includes("<Picture 2> never says the words heard in <Audio 2>.")
    && p.prompt.includes("Only the lines inside <d>...</d> are spoken"), p.prompt);
  const withSong = NA.plan({ anchor: "reference", prompt: "@anna sings", imgMeta, audMeta, song: "/s/song.mp3", window: { start: 0, dur: 5 }, n: 1 });
  check("...with a song nothing changes: the song is <Audio 1>, no voice binding line",
    withSong.audios[0] === "/s/song.mp3" && !/speaks with the voice/.test(withSong.prompt), withSong.audios);
  const fl = NA.plan({ anchor: "first", prompt: '@anna says: "Hi."', imgMeta, audMeta, song: "",
                       frame: { file: "/f.png", name: "f.png", label: "the end" }, n: 2 });
  check("no song, First (fl2va): no audio at all (the model voices the lines), said",
    fl.mode === "fl2va" && fl.audios.length === 0 && fl.notes.some((x) => /model voices the lines itself/.test(x)), fl);
  check("voiceBinding only binds a character that HAS a voice in this render",
    NA.voiceBinding("@anna and @carl talk", { anna: "<Picture 1>", anna_voice: "<Audio 1>", carl: "<Picture 2>" })
      === "\n\n@anna speaks with the voice of @anna_voice.");
}

// ---- 2. the dialogue writer ---------------------------------------------------------------------
{
  const cast = [{ name: "Anna", tag: "anna" }, { name: "Ben", tag: "ben" }];
  check("modeOf: a board song -> song (music video); none -> dialogue (screenplay)",
    W.modeOf({ audio: "s.mp3" }) === "song" && W.modeOf({}) === "dialogue");
  const gd = W.guide(cast, [], [], "dialogue"), gs = W.guide(cast, [], [], "song");
  check("the dialogue guide: spoken lines as @tag says: \"...\", seconds per scene, the model makes the sound, cast only - the song guide unchanged",
    gd.includes('     @anna <verb>, <delivery>: "<the words>"') && /"seconds": 8/.test(gd) && /The model makes the SOUND itself/.test(gd)
    && /@anna, @ben/.test(gd) && /NO DIALOGUE, EVER/.test(gs) && !/NO DIALOGUE, EVER/.test(gd), gd.slice(0, 200));
  check("problems (dialogue): speech is fine, no singing line demanded; chain markup / invented tags still flagged",
    W.problems({ prompt: ['@anna says: "Hi."'] }, cast, [], [], "dialogue").length === 0
    && W.problems({ prompt: ["(S1) <d>hi</d> @zed"] }, cast, [], [], "dialogue").length === 3
    && W.problems({ prompt: ['@anna says: "Hi."'] }, cast, [], [], "song").some((x) => /singing line/.test(x)));
  const rp = W.repair({ seconds: 20, prompt: ["(S2) <d>Over here!</d>", "@zed waves"] }, cast, [], [], "dialogue");
  check("repair (dialogue): seconds -> length (held 3-15 s), (S2) <d> -> @ben says: \"...\", an invented tag un-tagged, no singing line added",
    rp.shot.length === 15 * 24 + 1 && rp.shot.prompt[0] === '@ben says: "Over here!"' && rp.shot.prompt[1] === "zed waves"
    && !rp.shot.prompt.join(" ").includes("lip"), rp);
  const cp = W.cleanPrompt("(S1): <d>Stay.</d>\n@anna walks", "dialogue", ["anna", "ben"]);
  check("render clean (dialogue): the words stay, spoken by the cast tag; the song mode still strips them",
    cp.text.split("\n")[0] === '@anna says: "Stay."' && !/<d>/.test(W.cleanPrompt("<d>x</d>", "song").text), cp);
}

// ---- 3. the scene count + the board ----------------------------------------------------------------
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sc-"));
  try {
    check("no field, no scenes.txt, no number in the request -> null (the LLM decides)", SC.pick(null, d, 0) === null);
    fs.writeFileSync(path.join(d, "scenes.txt"), "scenes: 7\n");
    check("scenes.txt's first number (1-40) when the field is blank; the field wins over it; the request's number last",
      SC.fromFile(d) === 7 && SC.pick("", d, 3).n === 7 && SC.pick("5", d, 3).n === 5
      && SC.pick("5", d, 3).source === "the StoryBoard's Scenes field" && SC.pick("", d, 3).source === "scenes.txt");
    fs.writeFileSync(path.join(d, "scenes.txt"), "99");
    check("...an out-of-range file is ignored; then the request's number",
      SC.fromFile(d) === 0 && SC.pick(null, d, 4).n === 4 && SC.pick(null, d, 4).source === "your request");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  const SL = read("lib", "scenes.js");
  check("the board keeps scene_count (1-40); a screenplay scene's seconds become its Duration when the board has no song",
    SL.includes("if (Number.isFinite(c) && c >= 1 && c <= 40) b.scene_count = c; }")
    && SL.includes("scene_count: safe(prev).scene_count,")
    && SL.includes("&& !safe(prev).audio"));
}

// ---- 4. the wiring -----------------------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), DH = read("ext", "videodock", "dock.html"), VC = read("ext", "videodock", "characters.js");
  check("queueScene: no song on a native board = a no-song render (no_song), the scene's own duration, the dialogue clean",
    RC.includes('const noSong = !!(conv && convName === "MMH3_NativeAudio_MV" && !upExport && !songPath);')
    && RC.includes("...(noSong ? { no_song: true } : {}),")
    && RC.includes("const secs = [Number(r.audio_dur), Number(sh2.seconds)].find((x) => Number.isFinite(x) && x > 0);")
    && RC.includes('mvWriter.cleanPrompt(jobPrompt, noSong ? "dialogue" : "song",'));
  check("the writer: the board's mode rides guide / problems / repair / storyOnly / globalNote; the count from the field / scenes.txt / request; the last split never decides a screenplay",
    RC.includes("const wMode = mvWriter.modeOf(scenes.load(b.project));")
    && RC.includes("mvWriter.problems(cand, cast, envs.list(b.project),\n                                             chapterRefs.tags(b.project), wMode)")
    && RC.includes("const pk = sceneCount.pick(scenes.load(b.project).scene_count,")
    && RC.includes('|| (native && wMode === "dialogue" ? ""'));
  check("GET/POST /api/scenes/count (the field, and scenes.txt's number)",
    RC.includes('app.get("/api/scenes/count"') && RC.includes('app.post("/api/scenes/count"')
    && RC.includes("file_n: sceneCount.fromFile("));
  check("the dock: the pickers offer ONLY Native audio (ref2va / fl2va), H3_Video_Ref and (2.338.0) LTX 2.5 - no Character chain; a chain board moves to the native flow once; the Scenes field",
    !DH.includes('<option value="">Character chain</option>') && (DH.match(/<option value="MMH3_NativeAudio_MV">Native audio · ref2va \/ fl2va<\/option>/g) || []).length === 2
    && VC.includes('var VD_FLOWS = [["MMH3_NativeAudio_MV", "Native audio · ref2va / fl2va"], ["H3_Video_Ref", "H3_Video_Ref"],')
    && VC.includes('["LTX25", "LTX 2.5 · text / first-last / lipsync"],') && VC.includes('["H3_Viggle", "H3_Viggle · motion video performed (ref2va / fl2va)"]];')      // 2.338.0 + 2.352.0
    && VC.includes('if (VD_FLOW_IDS.indexOf(scState.style || "") < 0 && !scFlowMoved) {')
    && DH.includes('<input type="number" id="scCount" min="1" max="40"')
    && VC.includes('scPost("/api/scenes/count", { n: scState.scene_count || null })'));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
