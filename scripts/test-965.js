#!/usr/bin/env node
// bitGen Studio 2.965.0 - 🎤 Sing it in my voice (Tim: "lets get all of them and add them to a dropdown, we will put a tool row in
// the synth tab of audio docker above the timeline. give it a go button (green triangle inside a circle pointing right). add
// another button to separate the vocal from the instrumental ..."). lib/singVoice.js, lib/singVoiceAddon.js,
// scripts/singvoice_local.py (run for real against stand-in engines), routes/singVoice.js, the 🎹 Synth tab's 🎤 row.
// The browser test is scripts/test-ui965-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t965_"));
const SV = require("../lib/singVoice");
const SS = require("../lib/synthSamples");
const SA = require("../lib/singVoiceAddon");
SV.setBase(tmp); SS.setDir(path.join(tmp, "synth_samples"));
const wav = (f, secs, rate) => {                       // a plain 16-bit mono PCM wav
  rate = rate || 16000; const n = Math.round(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i * 0.05)), 44 + i * 2);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); return f;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t = Date.now(); while (Date.now() - t < (ms || 5000)) { const v = fn(); if (v) return v; await sleep(20); } return fn(); }
const fake = (id, b) => {                              // an engine "installed": its python + its code's marker (+ SoulX's model)
  const p = SV.paths(b || tmp)[id];
  fs.mkdirSync(path.dirname(p.python), { recursive: true }); fs.writeFileSync(p.python, "");
  fs.mkdirSync(path.dirname(path.join(p.src, SV.ENGINES[id].marker)), { recursive: true }); fs.writeFileSync(path.join(p.src, SV.ENGINES[id].marker), "");
  if (id === "soulx") { fs.mkdirSync(path.join(p.models, "SoulX-Singer"), { recursive: true }); fs.writeFileSync(path.join(p.models, "SoulX-Singer", "model-svc.pt"), ""); }
};

(async () => {
  // ---- engines + status
  const st0 = SV.status();
  check("three engines in the dropdown's order - Seed-VC, SoulX-Singer SVC, RVC (Applio); a clip for the first two, a model for RVC; none installed",
    st0.engines.map((e) => e.id + ":" + e.ref + ":" + e.installed).join() === "seedvc:clip:false,soulx:clip:false,rvc:model:false" && /Seed-VC/.test(st0.engines[0].label) && /Applio/.test(st0.engines[2].label), st0.engines);
  fake("seedvc"); fake("rvc");
  const p0 = SV.paths(tmp).soulx; fs.mkdirSync(path.dirname(p0.python), { recursive: true }); fs.writeFileSync(p0.python, ""); fs.mkdirSync(path.join(p0.src, "cli"), { recursive: true }); fs.writeFileSync(path.join(p0.src, "cli", "inference_svc.py"), "");
  check("installed = its python + its code (+ SoulX's model-svc.pt): SoulX without its model says what is missing",
    SV.engineStatus("seedvc").installed && SV.engineStatus("rvc").installed && !SV.engineStatus("soulx").installed && /its model/.test(SV.engineStatus("soulx").note), SV.engineStatus("soulx"));
  fake("soulx");
  // ---- your voice: clips
  const rec = wav(path.join(tmp, "in", "take.wav"), 2.5, 22050);
  const a1 = SV.addClip(rec, "My voice.webm");
  check("a clip -> a 44.1 kHz mono WAV among your clips (its length read from the header)", a1.name === "My voice.wav" && Math.abs(a1.seconds - 2.5) < 0.05 && SV.listClips().length === 1, a1);
  const a2 = SV.addClip(rec, "My voice.webm");
  check("a second clip of the same name is numbered, not overwritten", a2.name !== a1.name && SV.listClips().length === 2, a2);
  check("clipFile: only a .wav among your clips (no ../)", SV.clipFile(a1.name) && !SV.clipFile("../" + a1.name.replace(".wav", "")) && !SV.clipFile("x.txt"));
  check("a file with no sound in it is refused in words", /could not be read/.test((SV.addClip(path.join(ROOT, "package.json"), "nope.json").error) || ""));
  SV.removeClip(a2.name);
  // ---- RVC models
  const logs = SV.paths(tmp).rvc.logs;
  ["tim_100e_2000s.pth", "tim_300e_6000s.pth", "G_6000.pth", "tim.index"].forEach((f) => { fs.mkdirSync(path.join(logs, "tim"), { recursive: true }); fs.writeFileSync(path.join(logs, "tim", f), ""); });
  fs.mkdirSync(path.join(logs, "half"), { recursive: true }); fs.writeFileSync(path.join(logs, "half", "half_10e_100s.pth"), "");
  const ms = SV.rvcModels(logs);
  check("rvcModels: Applio's newest weights (most steps) + the index; a model with no index is not offered (and never G_ / D_ checkpoints)",
    ms.length === 1 && ms[0].name === "tim" && /tim_300e_6000s\.pth$/.test(ms[0].pth) && ms[0].epochs === 300 && /tim\.index$/.test(ms[0].index), ms);
  // ---- convert
  const sample = SS.add(wav(path.join(tmp, "in", "dry vocal.wav"), 1.2), "dry Song 12-00-00.wav").name;
  let bad = [];
  for (const [o, re, st] of [[{ engine: "nope", sample }, /pick a voice model/, 400], [{ engine: "seedvc", sample: "missing.wav", clip: a1.name }, /no sample/, 404],
                              [{ engine: "seedvc", sample }, /Record or 📂 add a clip/, 400], [{ engine: "rvc", sample, model: "who" }, /train an RVC model/, 400]]) {
    try { SV.convert(o); bad.push("no error " + JSON.stringify(o)); } catch (e) { if (!re.test(e.message) || e.status !== st) bad.push(e.status + " " + e.message); }
  }
  check("convert refuses in words: an unknown model, a sample that is not there, no clip, no trained model", !bad.length, bad);
  fs.rmSync(SV.paths(tmp).soulx.python);
  let e409 = null; try { SV.convert({ engine: "soulx", sample, clip: a1.name }); } catch (e) { e409 = e; }
  check("an engine not installed: 409 with needs sing_soulx (the page's Download / Cancel box)", e409 && e409.status === 409 && e409.needs === "sing_soulx", e409 && { s: e409.status, n: e409.needs });
  fake("soulx");
  const seen = [];
  SV.setRun(async (py, script, body, o) => { seen.push({ py, script, body }); o.onLog("[sing] working"); fs.writeFileSync(body.out, fs.readFileSync(body.source)); return { out: body.out, seconds: 1.2 }; });
  const j1 = SV.convert({ engine: "seedvc", sample, clip: a1.name, shift: 40, quality: "best" });
  let busy = null; try { SV.convert({ engine: "seedvc", sample, clip: a1.name }); } catch (e) { busy = e; }
  await until(() => j1.state !== "running");
  const b1 = seen[0].body;
  check("Seed-VC job: its venv's python runs scripts/singvoice_local.py with the vocal, your clip, the key (clamped to +24), the quality",
    j1.state === "done" && seen[0].py === SV.paths(tmp).seedvc.python && /singvoice_local\.py$/.test(seen[0].script) && b1.task === "convert" && b1.engine === "seedvc" && b1.shift === 24 && b1.quality === "best" && b1.ref === SV.clipFile(a1.name) && b1.src_dir === SV.paths(tmp).seedvc.src, { j1, b1 });
  check("...the result is a new My samples WAV named after the song and the voice; one job at a time (409 busy)",
    j1.result.name === "Song 12-00-00 (My voice - Seed-VC).wav" && SS.fileOf(j1.result.name) && j1.result.voice === "My voice" && busy && busy.status === 409 && j1.lines.some((l) => /working/.test(l)), { r: j1.result, busy: busy && busy.message });
  const j2 = SV.convert({ engine: "soulx", sample, clip: a1.name }); await until(() => j2.state !== "running");
  const j3 = SV.convert({ engine: "rvc", sample, model: "tim", shift: -3 }); await until(() => j3.state !== "running");
  check("SoulX gets its models folder; RVC its weights, index and models folder (no clip)",
    seen[1].body.models_dir === SV.paths(tmp).soulx.models && seen[1].body.quality === "good" && seen[2].body.pth === ms[0].pth && seen[2].body.index === ms[0].index && seen[2].body.logs_dir === logs && !seen[2].body.ref && seen[2].body.shift === -3 && j3.state === "done", [seen[1].body, seen[2].body]);
  SV.setRun(async () => ({ error: "CUDA out of memory" }));
  const j4 = SV.convert({ engine: "seedvc", sample, clip: a1.name }); await until(() => j4.state !== "running");
  check("an engine's error is the job's error, in its own words", j4.state === "error" && /CUDA out of memory/.test(j4.error) && SV.job(j4.id) === j4 && !SV.job("other"), j4.error);
  // ---- train
  bad = [];
  for (const [o, re] of [[{ name: "my voice!", clips: [a1.name] }, /letters, numbers/], [{ name: "me", clips: [] }, /pick the clips/]]) { try { SV.train(o); bad.push("no error"); } catch (e) { if (!re.test(e.message)) bad.push(e.message); } }
  SV.setRun(async (py, script, body, o) => { seen.push({ body, files: fs.readdirSync(body.dataset) }); const d = path.join(body.logs_dir, body.name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, body.name + "_" + body.epochs + "e_1000s.pth"), ""); fs.writeFileSync(path.join(d, body.name + ".index"), ""); return { pth: "x", index: "y", minutes: 1 }; });
  const j5 = SV.train({ name: "my voice", clips: [a1.name], epochs: 5 }); await until(() => j5.state !== "running");
  const tb = seen[seen.length - 1];
  check("train: a name of letters / numbers (spaces -> _), the clips you tick copied into a dataset folder, epochs at least 20; the new model is offered",
    !bad.length && j5.state === "done" && tb.body.task === "train" && tb.body.name === "my_voice" && tb.body.epochs === 20 && tb.files.join() === "001.wav" && j5.result.model === "my_voice" && SV.rvcModels().some((m) => m.name === "my_voice") && j5.lines.some((l) => /under 2 minutes/.test(l)), { bad, j5: j5.result, tb });
  // ---- separate (demucs) - not installed here = 409 needs demucs
  let es = null; try { SV.separate({ sample }); } catch (e) { es = e; }
  const demucs = require("../lib/stems").runtime().installed;
  check("separate: no demucs = 409 needs demucs (else it runs)", demucs || (es && es.status === 409 && es.needs === "demucs"), es && es.message);
  SV.setRun(null);
  // ---- the Python helper, run for real against stand-in engine programs
  const H = path.join(ROOT, "scripts", "singvoice_local.py"), work = path.join(tmp, "helper");
  const sv = path.join(work, "seedvc"); fs.mkdirSync(sv, { recursive: true });
  fs.writeFileSync(path.join(sv, "inference.py"), "import sys,os,json,shutil\na=sys.argv[1:]\nd=dict(zip(a[::2],a[1::2]))\nos.makedirs(d['--output'],exist_ok=True)\njson.dump(d,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'args.json'),'w'))\nshutil.copy(d['--source'],os.path.join(d['--output'],'vc_x.wav'))\n");
  const ap = path.join(work, "applio"); fs.mkdirSync(ap, { recursive: true });
  fs.writeFileSync(path.join(ap, "core.py"), "import sys,os,json,shutil\na=sys.argv[1:]\nlog=os.path.join(os.path.dirname(os.path.abspath(__file__)),'calls.json')\ncalls=json.load(open(log)) if os.path.exists(log) else []\ncalls.append(a+['LOGS='+os.environ.get('APPLIO_LOGS_DIR','')])\njson.dump(calls,open(log,'w'))\nif a[0]=='infer':\n  d=dict(zip(a[1::2],a[2::2])); shutil.copy(d['--input-path'],d['--output-path'])\nif a[0]=='train':\n  n=a[a.index('--model-name')+1]; d=os.path.join(os.environ['APPLIO_LOGS_DIR'],n); os.makedirs(d,exist_ok=True)\n  open(os.path.join(d,n+'_300e_4000s.pth'),'w').write('x'); open(os.path.join(d,n+'.index'),'w').write('x')\n");
  const runPy = (job) => { const jf = path.join(work, "job.json"); fs.writeFileSync(jf, JSON.stringify(job)); const r = spawnSync("python3", [H, jf], { encoding: "utf8" }); const line = r.stdout.trim().split("\n").pop(); try { return JSON.parse(line); } catch { return { raw: r.stdout + r.stderr }; } };
  const vocal = wav(path.join(work, "vocal.wav"), 0.6), ref = SV.clipFile(a1.name);
  const h1 = runPy({ task: "convert", engine: "seedvc", src_dir: sv, source: vocal, ref, out: path.join(work, "out1.wav"), shift: 3, quality: "fast", device: "cpu" });
  const args1 = JSON.parse(fs.readFileSync(path.join(sv, "args.json"), "utf8"));
  check("helper ▸ Seed-VC: its inference.py with the singing model (--f0-condition True), no auto pitch, the key, 25 steps for fast, fp16 off on the CPU; its output moved to ours",
    h1.out === path.join(work, "out1.wav") && fs.existsSync(h1.out) && args1["--f0-condition"] === "True" && args1["--auto-f0-adjust"] === "False" && args1["--semi-tone-shift"] === "3" && args1["--diffusion-steps"] === "25" && args1["--fp16"] === "False" && args1["--target"] === ref, { h1, args1 });
  const pth = path.join(work, "v.pth"), idx = path.join(work, "v.index"); fs.writeFileSync(pth, "x"); fs.writeFileSync(idx, "x");
  const h2 = runPy({ task: "convert", engine: "rvc", src_dir: ap, source: vocal, pth, index: idx, logs_dir: path.join(work, "voices"), out: path.join(work, "out2.wav"), shift: -2, device: "cpu" });
  const h3 = runPy({ task: "train", engine: "rvc", src_dir: ap, logs_dir: path.join(work, "voices"), name: "tim", dataset: work, epochs: 300, device: "cpu" });
  const calls = JSON.parse(fs.readFileSync(path.join(ap, "calls.json"), "utf8"));
  const c = (k) => calls.find((x) => x[0] === k) || [];
  check("helper ▸ RVC: core.py infer (the model, its index, rmvpe, the key); training = preprocess -> extract -> train (flags, no values) with Applio's models folder set; the newest weights + index back",
    h2.out && fs.existsSync(h2.out) && c("infer").includes("rmvpe") && c("infer")[c("infer").indexOf("--pitch") + 1] === "-2" &&
    calls.map((x) => x[0]).join() === "infer,preprocess,extract,train" && c("train").includes("--save-only-latest") && c("train")[c("train").indexOf("--save-only-latest") + 1] === "--save-every-weights" &&
    c("extract")[c("extract").indexOf("--gpu") + 1] === "-" && calls.every((x) => x[x.length - 1] === "LOGS=" + path.join(work, "voices")) && /tim_300e_4000s\.pth$/.test(h3.pth) && /tim\.index$/.test(h3.index), { h2, h3, calls });
  const h4 = runPy({ task: "convert", engine: "seedvc", src_dir: sv, source: vocal, ref: path.join(work, "nope.wav"), out: path.join(work, "o.wav") });
  const h5 = runPy({ task: "train", engine: "rvc", src_dir: ap, name: "bad name", dataset: work });
  check("helper refuses in words: no clip of your voice, a bad model name", /no clip of your voice/.test(h4.error || "") && /model name/.test(h5.error || ""), [h4, h5]);
  const HS = src("scripts/singvoice_local.py");
  check("helper ▸ SoulX-Singer: its RMVPE pitch on the reference (30 s at most) and the vocal, audio read without torchaudio.load (patched), build_model + process, generated.wav moved to ours",
    /from preprocess\.tools\.f0_extraction import F0Extractor/.test(HS) && /ref = ref\[: 44100 \* 30\]/.test(HS) && /AU\.load_wav = load_wav/.test(HS) && /SVC\.build_model\(model_path=ckpt/.test(HS) && /SVC\.process\(a, config, model\)/.test(HS) && /"generated\.wav"/.test(HS));
  // ---- the add-on
  check("filterReq drops the torch family and what bitGen does not use; pins kept; unpinned for a second try",
    SA.filterReq("torch==2.4.0\ntorchaudio==2.4.0\n--index-url x\ngradio==5\nlibrosa==0.10.2  # yes\nnumpy<2.0.0\n-e .\nFreeSimpleGUI==5", SA.DROP.seedvc).join() === "librosa==0.10.2,numpy<2.0.0"
    && SA.filterReq("nemo_toolkit==2.6.1\ntorchcodec==0.10.0\nsoundfile==0.13.1", SA.DROP.soulx).join() === "soundfile==0.13.1" && SA.unpinned("scipy==1.17.1; python_version < \"3.12\"") === "scipy");
  check("PyTorch pins: 2.8 for Seed-VC / SoulX (torchaudio's own save, no torchcodec), Applio's own 2.11", SA.TORCH.seedvc[0] === "torch==2.8.0" && SA.TORCH.soulx[1] === "torchaudio==2.8.0" && SA.TORCH.rvc[0] === "torch==2.11.0");
  const ib = path.join(tmp, "install");
  const ran = [];
  const frun = async (cmd, args, o) => { ran.push([path.basename(cmd)].concat(args).join(" ")); if (args[0] === "-m" && args[1] === "venv") { fs.mkdirSync(path.dirname(path.join(args[2], "bin", "python")), { recursive: true }); fs.writeFileSync(path.join(args[2], "bin", "python"), ""); fs.mkdirSync(path.join(args[2], "Scripts"), { recursive: true }); fs.writeFileSync(path.join(args[2], "Scripts", "python.exe"), ""); }
    if (args[0] === "-c" && /PYV/.test(args[1])) o.log("PYV 3.12"); if (/singvoice_local/.test(args[0] || "")) o.log('{"ok": true, "cuda": true, "torch": "2.8.0+cu128"}'); return 0; };
  const fetchRepo = async (url, dest) => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, "inference.py"), ""); fs.writeFileSync(path.join(dest, "requirements.txt"), "torch==2.4.0\nlibrosa==0.10.2\ngradio==5\n"); return { ok: true }; };
  const lines = [];
  SV.setBase(ib);
  const ir = await SA.install((l) => lines.push(l), ["seedvc"], { run: frun, fetchRepo, machine: { python: "/usr/bin/python3", gpu: { cuda: true, torch: ["cu128"] }, env: {} }, base: ib });
  const reqf = fs.readFileSync(path.join(SV.paths(ib).seedvc.dir, "requirements-bitgen.txt"), "utf8");
  check("install (Seed-VC, a stand-in runner): its code, a venv, PyTorch 2.8 from cu128, its requirements without torch / gradio (+ soundfile, huggingface_hub), the import check",
    ir.ok && ran.some((r) => /-m venv/.test(r)) && ran.some((r) => /torch==2\.8\.0 torchaudio==2\.8\.0 torchvision==0\.23\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cu128/.test(r)) &&
    reqf === "librosa==0.10.2\nsoundfile\nhuggingface_hub\n" && ran.some((r) => /singvoice_local\.py/.test(r)) && lines.some((l) => /Seed-VC loads \(torch 2\.8\.0\+cu128, CUDA\)/.test(l)), { ir, ran, reqf, lines: lines.slice(-4) });
  const A = require("../lib/addons").list().find((x) => x.id === "singvoice");
  check("Settings ▸ Add-ons ▸ 🎤 Sing in my voice: three engines to tick (Seed-VC by default), its links, sizes and licences",
    A && A.items && A.items.map((i) => i.id).join() === "seedvc,soulx,rvc" && A.items[0].dflt && !A.items[2].dflt && /GPL-3\.0/.test(A.needs) && /Apache-2\.0/.test(A.needs) && /MIT/.test(A.needs), A && { items: A.items, needs: A.needs });
  SV.setBase(tmp);
  // ---- statics
  const D = src("ext/synthdock/dock.html"), J = src("ext/synthdock/synthsing.js"), TJ = src("ext/synthdock/synthtl.js"), TC = src("ext/synthdock/synthtlcore.js"), E = JSON.parse(src("ext/synthdock/ext.json"));
  check("the 🎤 row sits above the timeline's bar inside the timeline part: model ▾, voice ▾, 🎙 Record, 📂, 🎓 Train, Key, quality, ▶ go, ✂ Separate vocals",
    D.indexOf('id="sySing"') > D.indexOf('id="syTL"') && D.indexOf('id="sySing"') < D.indexOf('<div class="sytlbar">') &&
    ["sySingEngine", "sySingVoice", "sySingRec", "sySingAdd", "sySingTrain", "sySingKey", "sySingQ", "sySingGo", "sySingSep", "sySingMsg"].every((id) => D.includes('id="' + id + '"')));
  check("▶ is a green triangle inside a circle pointing right", /<button class="sysinggo" id="sySingGo"[\s\S]*?<circle cx="12" cy="12" r="10\.5" fill="none"[\s\S]*?<path d="M9\.5 7\.2 L17\.2 12 L9\.5 16\.8 Z" fill="currentColor"\/>/.test(D) && /\.sysinggo \{[^}]*color: #2ee66b/.test(D));
  check("both buttons work on the PICKED layer (rendered dry); separate = +vocals +instrumental, the original kept (muted); a whole song is separated before ▶",
    /function selLayer\(\) \{ var t = TL\(\); if \(!t\) return -1; var i = t\.info\(\)\.sel;/.test(J) && /TL\(\)\.renderDry\(i\)/.test(J) && /role: "vocals"/.test(J) && /role: "instrumental"/.test(J) && /t\.patchLayer\(i, \{ mute: true \}\)/.test(J) &&
    /var whole = l\.role !== "vocals" && l\.role !== "voice";/.test(J) && /H3NeedInstall\.ensure\("sing_" \+ e\.id, why\)/.test(J));
  check("the timeline: renderDry (alone, unmuted, 100% centre, no effects / lanes - put back after) and patchLayer; roles kept in the saved timeline",
    /function renderDry\(i\)/.test(TJ) && /l\.fx = T\.cleanFx\(null\); l\.auto = T\.cleanAuto\(null\);/.test(TJ) && /renderDry: renderDry, (renderMix: renderMix, )?patchLayer: patchLayer,/.test(TJ) && /var ROLES = \["vocals", "instrumental", "voice"\];/.test(TC) &&
    require("../ext/synthdock/synthtlcore.js").cleanTL({ layers: [{ name: "a", role: "vocals", clips: [] }, { name: "b", role: "evil", clips: [] }] }).layers.map((l) => l.role || "-").join() === "vocals,-");
  check("ext.json: synthsing.js after the timeline", E.scripts.indexOf("synthsing.js") === E.scripts.indexOf("synthtl.js") + 1);
  const NI = src("static/needinstall.js"), RI = src("routes/index.js");
  check("the Download / Cancel box knows the three engines (one item of the add-on each, sent with the install)",
    ["sing_seedvc", "sing_soulx", "sing_rvc"].every((k) => NI.includes(k + ": {")) && /items: \["soulx"\]/.test(NI) && /JSON\.stringify\(P\.items \? \{ items: P\.items \} : \{\}\)/.test(NI));
  check("routes/singVoice.js mounted from routes/index.js (never server.js); the engines and your clips stay out of git and the zips",
    /require\("\.\/singVoice"\)\.mount\(app\);/.test(RI) && !/singVoice/.test(src("misc/server.js")) && /^singvoice\/$/m.test(src(".gitignore")) && /^sing_voices\/$/m.test(src(".gitignore")) && /^sing_voices\/$/m.test(src("misc/_gitignore")) && /! -path "\.\/singvoice\/\*"/.test(src("scripts/make_zips.sh")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
