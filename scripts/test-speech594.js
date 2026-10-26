#!/usr/bin/env node
/* bitGen Studio — scripts/test-speech594.js (2.594.0): MING-3.0 TTS and BARK 3.0 STT as engines.
 * Tim: "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts ... and add option to use
 * https://underdog.ai/bark as stt engine".
 *   lib/speechAddons.js   the installers step by step (a fake run: Python check, the code, the venv, PyTorch from the
 *                         CUDA index for the card - CPU wheels without one, requirements without torch, the model, the
 *                         check; Bark's missing-module rounds), status, reqLines / pipName
 *   lib/addons.js         the "ming" / "bark" cards (links)
 *   lib/tts.js            engine "ming": the runtime, a REAL speak through scripts/ming_local.py and a fake infer.py
 *                         (clone flags, --use_spk_emb, --task, --language_id, --no_text_normalization, design task)
 *   lib/asr.js            barkFor (what stays on Whisper), a REAL Bark transcribe + transcribeFile through
 *                         scripts/bark_local.py and a fake bark_loader.py (needs numpy + soundfile - else SKIP)
 *   lib/asrLive.js        the live process on Bark (the same line protocol)
 *   the page              Settings ▸ Audio engine picks (static/speechengines.js, index.html)
 * No server; everything in a temp folder. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0, skip = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const SKIP = (n) => { skip++; console.log("SKIP: " + n); };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-speech594-"));
process.env.BITGEN_ADDON_BASE = tmp;
const core = require("../lib/core");
let CFG = {};
core.getConfig = () => CFG;
core.projDir = () => path.join(tmp, "proj");
core.pDir = (k) => { const d = path.join(tmp, "proj", k); fs.mkdirSync(d, { recursive: true }); return d; };
const SA = require("../lib/speechAddons");
const PY = ["python3", "python"].find((p) => spawnSync(p, ["-c", "print(1)"]).status === 0);
const IS_WIN = process.platform === "win32";
const fakeVenv = (venv) => {   // the "venv's python" = this machine's python (a link)
  const bin = path.join(venv, IS_WIN ? "Scripts" : "bin"); fs.mkdirSync(bin, { recursive: true });
  const py = path.join(bin, IS_WIN ? "python.exe" : "python");
  const real = spawnSync(PY, ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).stdout.trim();
  try { fs.symlinkSync(real, py); } catch { fs.copyFileSync(real, py); }
  return py;
};

(async () => {
  try {
    // ---- pure
    const rl = SA.reqLines("torch==2.6.0\ntorchaudio>=2.6\n# c\ntransformers==4.46.3\n pynini==2.1.6\n-e .\nsoundfile\ntorchvision\nnumpy<2\n");
    check("reqLines: no torch / torchaudio / torchvision / pynini, no comments or -e; the rest kept", JSON.stringify(rl) === '["transformers==4.46.3","soundfile","numpy<2"]', rl);
    check("pipName: sklearn -> scikit-learn, cv2 -> opencv-python, a_b -> a-b, junk -> ''", SA.pipName("sklearn.linear") === "scikit-learn" && SA.pipName("cv2") === "opencv-python" && SA.pipName("sentence_piece") === "sentence-piece" && SA.pipName("a b") === "");
    const P = SA.paths();
    check("paths: <app>/ming-tts/{src,.venv,model}, <app>/bark-stt/{.venv,model}", P.ming.src === path.join(tmp, "ming-tts", "src") && P.ming.model === path.join(tmp, "ming-tts", "model") && P.bark.model === path.join(tmp, "bark-stt", "model") && /\.venv/.test(P.bark.python));
    check("status: nothing there = not installed", !SA.mingStatus().installed && SA.mingStatus().note === "not installed" && !SA.barkStatus().installed);

    // ---- the Ming install, step by step (a fake run)
    const calls = [];
    const fakeRun = (answers) => async (cmd, args, o) => {
      calls.push([path.basename(cmd), ...(args || [])].join(" "));
      if (args && args[0] === "-c" && /PYV/.test(args[1])) { o.log("PYV 3.12"); return 0; }
      if (args && args[0] === "-m" && args[1] === "venv") { fakeVenv(args[2]); return 0; }
      if (args && args[0] === "-c" && /snapshot_download/.test(args[1])) { fs.mkdirSync(P.ming.model, { recursive: true }); fs.writeFileSync(path.join(P.ming.model, "config.json"), "{}"); return 0; }
      if (args && args[0] === "-c" && /hf_hub_download/.test(args[1])) { fs.mkdirSync(P.bark.model, { recursive: true }); for (const f of ["model.bark", "bark_loader.py", "NOTICE"]) fs.writeFileSync(path.join(P.bark.model, f), "x"); return 0; }
      if (args && /ming_local\.py$/.test(args[0])) { o.log(JSON.stringify({ ok: true, normalize: false, flags: ["--text"] })); return 0; }
      if (args && /bark_local\.py$/.test(args[0])) { const a = answers.shift() || { ok: true, device: "cuda" }; o.log(JSON.stringify(a)); return 0; }
      return 0;
    };
    const fetchRepo = async (url, dest) => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, "infer.py"), "#"); fs.writeFileSync(path.join(dest, "requirements.txt"), "torch==2.6.0\ntorchaudio==2.6.0\ntransformers==4.46.3\npynini==2.1.6\n"); calls.push("fetch " + url); return { ok: true }; };
    const lines = [];
    const r1 = await SA.installMing({ log: (l) => lines.push(l), run: fakeRun([]), python: "py", gpu: { cuda: true, torch: ["cu128"] }, env: {}, base: tmp, fetchRepo, git: "" });
    const ti = calls.findIndex((c) => /install torch torchaudio --index-url https:\/\/download.pytorch.org\/whl\/cu128/.test(c));
    check("installMing: Python 3.12 ok, the repo fetched, its venv, torch + torchaudio from the cu128 index (a 50-series), then requirements, the model, the check", r1.ok
      && calls.some((c) => c === "fetch https://github.com/inclusionAI/Ming-3.0-tts.git") && ti > 0 && calls.findIndex((c) => / -r .*requirements-h3\.txt/.test(c)) > ti
      && calls.some((c) => /snapshot_download\("inclusionAI\/Ming-3\.0-tts-0\.5B"/.test(c)) && SA.mingStatus().installed, { r1, calls });
    const req = fs.readFileSync(path.join(tmp, "ming-tts", "requirements-h3.txt"), "utf8");
    check("its requirements: without torch / torchaudio / pynini, + huggingface_hub + soundfile", !/torch|pynini/.test(req) && /transformers==4\.46\.3/.test(req) && /huggingface_hub/.test(req), req);
    check("it says text normalisation is off (no pynini) and where to pick the engine", lines.some((l) => /no_text_normalization/.test(l)) && lines.some((l) => /Settings ▸ Audio ▸ Speech engine/.test(l)));
    calls.length = 0;
    const r1b = await SA.installMing({ log: () => {}, run: async (c, a, o) => { if (a[0] === "-c" && /PYV/.test(a[1])) o.log("PYV 3.9"); return 0; }, python: "py", gpu: {}, base: tmp, fetchRepo });
    check("installMing: Python 3.9 is refused (3.10 - 3.13)", !r1b.ok && /3\.10 - 3\.13/.test(r1b.error), r1b);

    // ---- Bark: CPU wheels without a card; a module bark_loader.py asks for is installed, then it loads
    calls.length = 0;
    const r2 = await SA.installBark({ log: () => {}, run: fakeRun([{ missing: "sentencepiece" }, { ok: true, device: "cpu" }]), python: "py", gpu: {}, env: {}, base: tmp });
    check("installBark: no NVIDIA card = the CPU wheels; numpy, soundfile, soxr, constriction, huggingface_hub; the three files; sentencepiece added after the first check",
      r2.ok && calls.some((c) => /install torch --index-url https:\/\/download.pytorch.org\/whl\/cpu/.test(c)) && calls.some((c) => /install numpy soundfile soxr constriction huggingface_hub/.test(c))
      && calls.some((c) => /hf_hub_download/.test(c) && /ConwayResearch\/Underdog-Bark-3\.0/.test(c)) && calls.some((c) => /pip install sentencepiece/.test(c)) && SA.barkStatus().installed, { r2, calls });

    // ---- the add-on cards
    const A = require("../lib/addons");
    const L = A.list(), mc = L.find((a) => a.id === "ming"), bc = L.find((a) => a.id === "bark");
    check("Settings ▸ Add-ons: Ming-3.0 TTS + Bark 3.0 cards (installed now), their links (GitHub + Hugging Face)", mc && bc && mc.installed && bc.installed
      && mc.links.some((l) => l.url === "https://github.com/inclusionAI/Ming-3.0-tts") && bc.links.some((l) => l.url === "https://huggingface.co/ConwayResearch/Underdog-Bark-3.0") && !mc.feature, { mc, bc });

    // ---- TTS: engine ming, a real speak through ming_local.py + a fake infer.py
    const tts = require("../lib/tts");
    CFG = { tts: { engine: "ming", device: "cpu", ming: { language: "English" } } };
    check("tts: engine ming -> the Ming runtime (ming_local.py, its venv); anything else = OmniVoice", tts.cfg().engine === "ming" && tts.engineRuntime().engine === "ming" && /ming_local\.py$/.test(tts.engineRuntime().helper)
      && (() => { CFG = { tts: { engine: "openaudio" } }; const e = tts.cfg().engine; CFG = { tts: { engine: "ming", device: "cpu", ming: { language: "English" } } }; return e === "omnivoice"; })());
    fs.writeFileSync(path.join(P.ming.src, "infer.py"), [
      "import sys, json, struct, os",
      "if '--help' in sys.argv:",
      "    print('usage: infer.py --model_path M --task {TTS,VOICE_DESIGN} --language_id L --text T --prompt_wav_path W --prompt_text P --use_spk_emb --instruct I --output O --no_text_normalization')",
      "    sys.exit(0)",
      "a = sys.argv[1:]",
      "out = a[a.index('--output') + 1]",
      "open(os.path.join(os.path.dirname(out), 'argv.json'), 'w').write(json.dumps(a))",
      "n = 4410",
      "with open(out, 'wb') as f:",
      "    f.write(b'RIFF' + struct.pack('<I', 36 + n * 2) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, 44100, 88200, 2, 16) + b'data' + struct.pack('<I', n * 2) + b'\\0\\0' * n)",
      "print('done')"].join("\n"));
    const vd = path.join(tmp, "proj", "voices"); fs.mkdirSync(vd, { recursive: true });
    fs.writeFileSync(path.join(vd, "tim.wav"), Buffer.alloc(100)); fs.writeFileSync(path.join(vd, "tim.json"), JSON.stringify({ text: "This is my voice." }));
    fs.writeFileSync(path.join(vd, "deep.json"), JSON.stringify({ instruct: "male, deep, slow" }));
    core.getProject = () => "p";
    try {
      const s1 = await tts.speak("Hello from Ming.", "tim", "ming_clone");
      const argv = JSON.parse(fs.readFileSync(path.join(tmp, "proj", "sound", "argv.json"), "utf8"));
      const at = (f) => argv[argv.indexOf(f) + 1];
      check("speak (a clone): infer.py --task TTS + the clip + its transcript + --use_spk_emb, --language_id English, --no_text_normalization (no pynini) -> sound/ming_clone.wav",
        s1.engine === "ming" && s1.name === "ming_clone.wav" && at("--task") === "TTS" && at("--prompt_text") === "This is my voice." && /tim\.wav$/.test(at("--prompt_wav_path"))
        && argv.includes("--use_spk_emb") && at("--language_id") === "English" && argv.includes("--no_text_normalization") && at("--text") === "Hello from Ming." && fs.existsSync(path.join(tmp, "proj", "sound", "ming_clone.wav")), { s1, argv });
      await tts.speak("Deep words.", "deep", "ming_design");
      const a2 = JSON.parse(fs.readFileSync(path.join(tmp, "proj", "sound", "argv.json"), "utf8"));
      check("speak (a designed voice): --task VOICE_DESIGN + the description (the flag read from --help), no clip", a2[a2.indexOf("--task") + 1] === "VOICE_DESIGN" && a2[a2.indexOf("--instruct") + 1] === "male, deep, slow" && !a2.includes("--prompt_wav_path"), a2);
      fs.writeFileSync(path.join(vd, "notext.wav"), Buffer.alloc(100)); fs.writeFileSync(path.join(vd, "notext.json"), "{}");
      let e3 = ""; try { await tts.speak("x", "notext", "bad"); } catch (e) { e3 = e.message; }
      check("speak: a clone without its transcript is refused with what to do", /exact transcript/.test(e3), e3);
      const st = await tts.status();
      check("tts status: engine ming, ming {installed, language, languages}", st.engine === "ming" && st.ming.installed && st.ming.language === "English" && st.ming.languages.includes("Chinese"), st.ming);
    } catch (e) { fail++; console.log("FAIL: ming speak crashed - " + e.message); }

    // ---- ASR: what Bark takes
    const asr = require("../lib/asr");
    const K = { engine: "bark", language: "" };
    check("barkFor: plain speech = Bark; lyrics / word times / another language = faster-whisper (with why); engine whisper = never",
      asr.barkFor({ mode: "speech" }, K).bark && !asr.barkFor({ mode: "lyrics" }, K).bark && !asr.barkFor({ word_timestamps: true }, K).bark
      && /English only/.test(asr.barkFor({ language: "fr" }, K).why) && asr.barkFor({ language: "en" }, K).bark && !asr.barkFor({}, { engine: "whisper" }).bark);
    const hasSf = spawnSync(PY, ["-c", "import numpy, soundfile"]).status === 0;
    const ff = spawnSync("ffmpeg", ["-version"]).status === 0;
    if (!hasSf || !ff) SKIP("a real Bark transcribe (needs numpy + soundfile in " + PY + " and ffmpeg)");
    else {
      fs.writeFileSync(path.join(P.bark.model, "bark_loader.py"), [
        "import numpy as np",
        "class M: pass",
        "def load_model(path, device='cpu'):",
        "    m = M(); m.device = device; return m",
        "def transcribe(model, wave, sr):",
        "    return 'hello world %d' % int(round(len(wave) / sr))"].join("\n"));
      fs.writeFileSync(path.join(P.bark.model, "model.bark"), "x");
      const snd = path.join(tmp, "proj", "sound"); fs.mkdirSync(snd, { recursive: true });
      spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=70", "-ar", "16000", "-ac", "1", path.join(snd, "talk.wav")]);
      CFG = { asr: { engine: "bark", device: "cpu" } };
      try {
        const tr = await asr.transcribe({ name: "talk.wav" });
        check("transcribe (speech) on Bark: a 70 s file in three pieces of <= 30 s (rough times), engine bark, .txt + .srt written",
          tr.engine === "bark" && tr.segments.length === 3 && tr.segments.every((s) => s.end - s.start <= 30.01) && /hello world/.test(tr.text) && tr.files.includes("talk.txt") && tr.files.includes("talk.srt"), tr);
        const tf = await asr.transcribeFile(path.join(snd, "talk.wav"));
        check("transcribeFile on Bark (voice clone transcripts, the phone remote)", tf.engine === "bark" && /hello world/.test(tf.text) && tf.language === "en", tf);
        let le = ""; try { await asr.transcribe({ name: "talk.wav", mode: "lyrics" }); } catch (e) { le = e.message; }
        check("lyrics with Bark picked and no faster-whisper: refused, saying why it needs Whisper", /faster-whisper is not installed/.test(le) && /word times/.test(le), le);
        const live = require("../lib/asrLive");
        const lv = await live.transcribe(path.join(snd, "talk.wav"));
        check("the live transcriber (🎙 voice chat) runs Bark's live mode: ready line, one answer per line", lv.live === true && /hello world/.test(lv.text) && live.status().engine === "bark", { lv, st: live.status() });
        live.stop();
      } catch (e) { fail++; console.log("FAIL: bark crashed - " + e.message); }
    }
    // ---- bark_local.py's cut points (pure, python)
    const cut = spawnSync(PY, ["-c", "import sys; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); import bark_local as b; e=[1.0]*3500; e[1200]=0.0; e[2600]=0.0; print(b.cuts(e, 0.02, 30.0, 18.0)); print(repr(b.text_of({'text': ' a '})), repr(b.text_of(['x', 'y'])))"], { encoding: "utf8" });
    check("bark_local.cuts: pieces of <= 30 s cut at the quietest frame (24 s, 52 s), the rest last; text_of reads str / dict / list",
      /\[\(0\.0, 24\.0\), \(24\.0, 52\.0\), \(52\.0, 70\.0\)\]/.test(cut.stdout) && /'a' 'x y'/.test(cut.stdout), cut.stdout + cut.stderr);
    const mf = spawnSync(PY, ["-c", "import sys; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); import ming_local as m; f=m.parse_flags('--text T --use_spk_emb [--task {TTS}]'); print(f); a,o=m.build_cmd({'text':'hi','model':'M','out':'o.wav'}, f+['--output'], True); print(a)"], { encoding: "utf8" });
    check("ming_local: parse_flags reads --help; build_cmd for no voice = --task TTS + --text + --output, no normalisation flag when pynini is there",
      /'--task', '--text', '--use_spk_emb'/.test(mf.stdout) && /\['infer.py', '--model_path', 'M', '--task', 'TTS', '--text', 'hi', '--output', 'o.wav'\]/.test(mf.stdout), mf.stdout + mf.stderr);

    // ---- the page
    const html = rd("static", "index.html"), js = rd("static", "speechengines.js");
    check("Settings ▸ Audio: the speech engine pick has Ming-3.0 TTS (no longer disabled), its panel (#s_ming), the STT pick with Bark 3.0, speechengines.js loaded",
      /<select id="s_ttsengine" title=/.test(html) && /<option value="ming">Ming-3\.0 TTS/.test(html) && /id="s_ming"/.test(html) && /id="s_minglang"/.test(html)
      && /<select id="s_asrengine"/.test(html) && /<option value="bark">Bark 3\.0/.test(html) && /<script src="\/static\/speechengines\.js">/.test(html));
    check("saveTtsCfg / saveAsrCfg send the engine (+ Ming's language); refreshTts / refreshAsr paint through H3Speech",
      /engine: \$\("s_ttsengine"\) && \$\("s_ttsengine"\)\.value === "ming"/.test(html) && /ming: \{ language: \$\("s_minglang"\)/.test(html) && /engine: \$\("s_asrengine"\)/.test(html)
      && /H3Speech\.paintTts\(j\)/.test(html) && /H3Speech\.paintAsr\(j\)/.test(html) && /installAddon/.test(js) && /H3Addons\.act\(id, "install"\)/.test(js));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { require("../lib/asrLive").stop(); } catch { /* fine */ } try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed${skip ? ", " + skip + " skipped" : ""}`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
