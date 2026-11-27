#!/usr/bin/env node
/* bitGen Studio — 3.1.0: SoulX / Seed-VC load (NumPy kept where Numba can take it; Seed-VC's own imports checked) + the Edit
 * Booth's 💾 Save song (every layer -> an MP3 / a WAV).
 * Tim: "soulx: installed, but it does not load: missing module: Numba needs NumPy 2.3 or less. Got NumPy 2.4. seed vc also
 * installs but doesn't start. add a button to edit booth timeline to save as mp3 or wav. compile all the layers into a song" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

// ---- SoulX / Seed-VC
const pin = execFileSync("python3", ["-c", "import sys; sys.path.insert(0, 'scripts'); import singvoice_local as S; print(S.numpy_pin('Numba needs NumPy 2.3 or less. Got NumPy 2.4.'), S.numpy_pin('Numba needs NumPy 2.5 or less. Got NumPy 2.6.'), S.numpy_pin('No module named foo'))"], { cwd: ROOT, encoding: "utf8" }).trim();
check("numpy_pin: Numba's complaint -> the NumPy to go back to (numpy<2.4, numpy<2.6); anything else none", pin === "numpy<2.4 numpy<2.6 None", pin);
const SL = src("scripts/singvoice_local.py"), SV = src("lib/singVoiceAddon.js"), SVA = require(path.join(ROOT, "lib/singVoiceAddon.js"));
check("the check: an ImportError that is Numba's NumPy complaint -> {error, pin}; numba imported for every engine (librosa's)", /pin = numpy_pin\(str\(e\)\)/.test(SL) && /return \{"error": str\(e\), "pin": pin\}/.test(SL) && /import numba  # noqa/.test(SL));
check("…Seed-VC: inference.py itself loaded (its imports - what 'does not start' hit), its --help exit caught", /spec_from_file_location\("seedvc_inference_check", os\.path\.join\(src, "inference\.py"\)\)/.test(SL) && /except SystemExit:/.test(SL));
check("the install: NumPy kept < 2.4 by a pip constraints file through the list (and one by one); a pin from the check is pip-installed and checked again",
  SVA.NUMPY_CAP === "numpy<2.4" && (SV.match(/"-c", cf/g) || []).length === 3 && /if \(chk && chk\.pin\) \{/.test(SV) && /\["-m", "pip", "install", chk\.pin/.test(SV));

// ---- 💾 Save song
const SS = require(path.join(ROOT, "lib/synthSong.js"));
check("stemOf: a safe file stem (the extension, odd characters out), 'song' when empty", SS.stemOf("My Song: take 2!.mp3") === "My Song take 2" && SS.stemOf("") === "song" && SS.stemOf("../../x") === "x");
const fa = SS.ffArgs("in.wav", "out.mp3", "mp3", { title: "Hey", date: "2026-11-28" }), fw = SS.ffArgs("in.wav", "out.wav", "wav", { title: "Hey" });
check("ffArgs: MP3 = LAME 320 kb/s, ID3v2.4, 44.1 kHz stereo, title / date / encoded_by; WAV = 16-bit PCM + its INFO tags",
  fa.join(" ").includes("-ac 2 -ar 44100 -c:a libmp3lame -b:a 320k -id3v2_version 4") && fa.includes("title=Hey") && fa.includes("encoded_by=bitGen Studio") && fa[fa.length - 1] === "out.mp3"
  && fw.join(" ").includes("-c:a pcm_s16le") && fw.includes("ISFT=bitGen Studio"));
// a real save: a 1 s stereo WAV -> MP3 and WAV, in a throw-away project
const core = require(path.join(ROOT, "lib/core.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "song3100_")), realP = core.pDir;
core.pDir = (k) => path.join(tmp, k);
try {
  const wav = path.join(tmp, "mix.wav");
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ac", "2", "-ar", "48000", wav]);
  const m = SS.save(wav, "My Song", "mp3"), m2 = SS.save(wav, "My Song", "mp3"), w = SS.save(wav, "My Song", "wav");
  const probe = (f) => spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,channels,sample_rate:format_tags=title", "-of", "json", f], { encoding: "utf8" }).stdout;
  const pm = JSON.parse(probe(path.join(tmp, "sound", m.name))), pw = JSON.parse(probe(path.join(tmp, "sound", w.name)));
  check("save: an MP3 in the Sound assets (44.1 kHz stereo, its title tag) + a copy in the gallery (song_…); a second one does not overwrite",
    m.name === "My Song.mp3" && m2.name === "My Song (2).mp3" && pm.streams[0].codec_name === "mp3" && pm.streams[0].channels === 2 && pm.streams[0].sample_rate === "44100" && pm.format.tags.title === "My Song"
    && m.gallery === "song_My Song.mp3" && fs.existsSync(path.join(tmp, "output", m.gallery)) && Math.abs(m.seconds - 1) < 0.15, { m, m2, pm });
  check("…a WAV the same way (16-bit PCM)", w.name === "My Song.wav" && pw.streams[0].codec_name === "pcm_s16le" && w.format === "wav");
} finally { core.pDir = realP; fs.rmSync(tmp, { recursive: true, force: true }); }
const RS = src("routes/synth.js"), TL = src("ext/synthdock/synthtl.js"), DH = src("ext/synthdock/dock.html");
check("POST /api/synth/song (routes/synth.js -> lib/synthSong.save, the upload removed after)", /app\.post\("\/api\/synth\/song", upload\.single\("file"\)/.test(RS) && /require\("\.\.\/lib\/synthSong"\)\.save\(f\.path, b\.name, b\.format\)/.test(RS) && /finally \{ gone\(\[f\]\); \}/.test(RS));
check("💾 Save song in the timeline's bar: a name, MP3 / WAV (kept), ⬇ a copy; saveSong = render() of every layer -> /api/synth/song",
  /id="sySong"/.test(DH) && /id="sySongFmt"[^>]*><option value="mp3">MP3<\/option><option value="wav">WAV<\/option>/.test(DH) && /id="sySongDl" type="checkbox" checked/.test(DH)
  && /return render\(48000\)\.then/.test(TL) && /root\.fetch\("\/api\/synth\/song"/.test(TL) && /h3\.synth\.song\.fmt/.test(TL));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
