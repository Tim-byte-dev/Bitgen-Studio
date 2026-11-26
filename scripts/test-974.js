#!/usr/bin/env node
// bitGen Studio 2.974.0 - (1) the Edit Booth's parts each get their own height; (2) the SFX tab's 🧬 Clone a voice (a waveform,
// START / END markers, the part saved as a voice, then picked to read the text); (3) the read file goes to the gallery too.
// Tim: "in audio docker edith booth, allow me to resize all the panels heights individually. in the sfx tab add clone voice, then
// add that voice to read the text. add the saved file to the gallery. the clone voice will show a wave form and the user will be
// able to select a region of the waveform with a draggable start marker and a draggable end marker to use as the sample"
// The browser leg is test-ui974-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
(async () => {
  const VC = require(path.join(ROOT, "ext/sfxdock/sfxclone.js"));
  const d = new Float32Array(1000); for (let i = 0; i < 1000; i++) d[i] = i < 500 ? 0 : Math.sin(i) * 0.5;
  const pk = VC.peaks(d, 10);
  check("peaks(): min / max a column - silence 0, the loud half ±0.5", pk.length === 20 && pk[0] === 0 && pk[1] === 0 && pk[18] < -0.45 && pk[19] > 0.45);
  check("clampRegion(): inside the sound, never shorter than 0.5 s; START pushed past END stops 0.5 s before it; the shaded part moves whole",
    JSON.stringify(VC.clampRegion(-2, 50, 20, "b")) === '{"a":0,"b":20}' && JSON.stringify(VC.clampRegion(9.9, 10, 20, "a")) === '{"a":9.5,"b":10}'
    && JSON.stringify(VC.clampRegion(5, 5.1, 20, "b")) === '{"a":5,"b":5.5}' && JSON.stringify(VC.clampRegion(17, 22, 20, "both")) === '{"a":15,"b":20}' && JSON.stringify(VC.clampRegion(-3, 2, 20, "both")) === '{"a":0,"b":5}');
  check("quality(): under 3 s short, OmniVoice past 12 s long, 3-10 s good", VC.quality(2, "omnivoice").level === "short" && VC.quality(14, "omnivoice").level === "long" && VC.quality(14, "openaudio").level === "good" && VC.quality(6, "omnivoice").level === "good" && VC.fmtS(75.5) === "1:15.50");

  /* the read file: in the Audio assets AND the gallery (output/speech_<name>) */
  const core = require(path.join(ROOT, "lib/core")), tts = require(path.join(ROOT, "lib/tts")), SD = require(path.join(ROOT, "lib/speechDialog"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp974_")), snd = path.join(dir, "sound"), outd = path.join(dir, "output"); fs.mkdirSync(snd);
  const realP = core.pDir, realRt = tts.engineRuntime, realRead = tts.readVoice, realCfg = tts.cfg, realRun = SD.deps.runJson;
  try {
    core.pDir = (k) => (k === "sound" ? snd : k === "output" ? outd : realP(k));
    tts.cfg = () => Object.assign(realCfg(), { engine: "omnivoice" });
    tts.engineRuntime = (c) => ({ engine: c.engine, venv: { ready: true, python: "py" }, helper: c.engine + "_local.py", install_hint: "x" });
    tts.readVoice = () => null;
    SD.deps.runJson = async (py, helper, job) => { (job.items || [job]).forEach((it) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=0.5", it.out])); return {}; };
    const r1 = await SD.speak({ name: "Hello there", text: "Hello there.", format: "wav" }), r2 = await SD.speak({ name: "Hello there", text: "Again.", format: "mp3" });
    check("🗣 Read: saved in the Audio assets AND copied to the gallery (output/speech_<name>, never over another)",
      r1.gallery === "speech_Hello there.wav" && fs.existsSync(path.join(snd, "Hello there.wav")) && fs.existsSync(path.join(outd, "speech_Hello there.wav"))
      && fs.statSync(path.join(outd, r1.gallery)).size === fs.statSync(path.join(snd, r1.name)).size && r2.gallery === "speech_Hello there.mp3", { r1, r2 });
  } finally { core.pDir = realP; tts.engineRuntime = realRt; tts.readVoice = realRead; tts.cfg = realCfg; SD.deps.runJson = realRun; fs.rmSync(dir, { recursive: true, force: true }); }

  /* the pins */
  const D = src("ext/sfxdock/dock.html"), J = src("ext/sfxdock/sfxclone.js"), SP = src("ext/sfxdock/sfxspeech.js"), EJ = JSON.parse(src("ext/sfxdock/ext.json"));
  check("SFX: 🧬 Clone a voice above 🗣 Speech & dialog - 📂 a file, 🎙 a recording, a sound of this project; the waveform with START / END markers (sliders for the keyboard), Start / End seconds, ▶ the part, a name, the words (✍), 🧬 Save voice",
    D.indexOf('<details id="vcBox" open>') > 0 && D.indexOf('<details id="vcBox" open>') < D.indexOf('<details id="spBox" open>') && ["vcOpen", "vcFile", "vcRec", "vcProj", "vcCanvas", "vcA", "vcB", "vcPlay", "vcName", "vcText", "vcWords", "vcSave"].every((id) => D.includes('id="' + id + '"'))
    && /id="vcMA" data-m="a" tabindex="0" role="slider"/.test(D) && /id="vcMB" data-m="b" tabindex="0" role="slider"/.test(D) && EJ.scripts.join() === "sfxdock.js,sfxclone.js,sfxspeech.js");
  check("🧬 Save voice = POST /api/tts/voices with the file + name + words + start / end (the server cuts the part: tts.saveVoice), then the voice is PICKED in 🗣 Speech & dialog",
    /fd\.append\("start", String\(S\.a\)\); fd\.append\("end", String\(S\.b\)\);\s*const r = await fetch\("\/api\/tts\/voices"/.test(J) && /if \(SP && SP\.load\) await SP\.load\(\);/.test(J) && /v\.value = name; v\.dispatchEvent\(new root\.Event\("change"/.test(J)
    && /fetch\("\/api\/asr\/transcribe-upload"/.test(J) && /s\.start\(0, S\.a, S\.b - S\.a\)/.test(J));
  check("🗣 Read shows the gallery's Audio tab when the copy is there", /if \(j\.gallery\) showInGallery\(\);/.test(SP) && /\.gtabs button\[data-gtab="audio"\]/.test(SP));
  const SD2 = src("ext/synthdock/synthdock.js"), DH = src("ext/synthdock/dock.html");
  check("Edit Booth: a grip under each part (role separator) - drag, ↑ ↓, double-click / Enter = its own height; kept (h3.synth.secH); a sized part scrolls inside, its content stretches",
    /g\.className = "sysecgrip"; g\.id = "sySecG_" \+ x\[0\]; g\.tabIndex = 0;/.test(SD2) && /g\.setAttribute\("role", "separator"\)/.test(SD2) && /LS\.set\("secH", JSON\.stringify\(all\)\)/.test(SD2)
    && /g\.addEventListener\("dblclick", function \(\) \{ setSecH\(x\[0\], null\); \}\)/.test(SD2) && /\.sysec\.sized > \.sysecbody \{ overflow: auto; \}/.test(DH) && /\.sysec\.sized > \.sysecbody > \* \{ flex: 1 0 auto; \}/.test(DH));
  check("nothing added to misc/server.js; 2.974.0 or later", !/sfxclone|secH/.test(src("misc/server.js")) && require("../package.json").version >= "2.974.0");
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
