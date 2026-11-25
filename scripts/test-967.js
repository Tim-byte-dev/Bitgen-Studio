#!/usr/bin/env node
// bitGen Studio 2.967.0 - the four 🎤 extras (Tim: "cool, go with the next" - the 2.965.0 ideas not built): ■ Stop for a
// running job, Key "Auto", ⧉ Mix (your voice over the instrumental -> one file) and 🎧 hear yourself while recording.
// lib/venv.js (onSpawn, group, stopProc), lib/singVoice.js (cancel, auto_shift), lib/stems.js (onSpawn), routes/singVoice.js,
// scripts/singvoice_local.py (run for real against a stand-in Seed-VC), ext/synthdock (synthsing.js, synthtl.js, dock.html).
// Spawns python3 (NOT in ci-units). The browser test is scripts/test-ui967-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t967_"));
const V = require("../lib/venv");
const SV = require("../lib/singVoice");
const SS = require("../lib/synthSamples");
SV.setBase(tmp); SS.setDir(path.join(tmp, "synth_samples"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t = Date.now(); while (Date.now() - t < (ms || 5000)) { const v = fn(); if (v) return v; await sleep(25); } return fn(); }
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const wav = (f, secs) => {
  const rate = 16000, n = Math.round(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i * 0.05)), 44 + i * 2);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); return f;
};
const fake = (id) => {
  const p = SV.paths(tmp)[id];
  fs.mkdirSync(path.dirname(p.python), { recursive: true }); fs.writeFileSync(p.python, "");
  fs.mkdirSync(path.dirname(path.join(p.src, SV.ENGINES[id].marker)), { recursive: true }); fs.writeFileSync(path.join(p.src, SV.ENGINES[id].marker), "");
  if (id === "soulx") { fs.mkdirSync(path.join(p.models, "SoulX-Singer"), { recursive: true }); fs.writeFileSync(path.join(p.models, "SoulX-Singer", "model-svc.pt"), ""); }
};

(async () => {
  // ---- venv.runJson hands its process over; stopProc ends it AND what it started
  const helper = path.join(tmp, "slow.py"), pidf = path.join(tmp, "kid.pid");
  fs.writeFileSync(helper, "import subprocess,sys,time\nk=subprocess.Popen(['sleep','30'])\nopen(sys.argv[0].replace('slow.py','kid.pid'),'w').write(str(k.pid))\nsys.stderr.write('started\\n');sys.stderr.flush()\nk.wait()\nprint('{\"ok\": true}')\n");
  let child = null; const lines = [];
  const pr = V.runJson("python3", helper, {}, { group: true, onSpawn: (p) => { child = p; }, onLog: (l) => lines.push(l), timeout_ms: 20000 }).then((r) => ({ r }), (e) => ({ e: e.message }));
  await until(() => fs.existsSync(pidf) && fs.readFileSync(pidf, "utf8"), 8000);
  const kid = +fs.readFileSync(pidf, "utf8");
  check("runJson: onSpawn gets the process; group = its own process group (not on Windows)", child && child.pid > 0 && child.h3Group === (process.platform !== "win32") && alive(kid), { pid: child && child.pid, kid });
  const s1 = V.stopProc(child), out1 = await pr;
  await until(() => !alive(kid), 3000);
  check("stopProc: the helper AND the program it started are ended; runJson rejects (no JSON came)", s1 && out1.e && !alive(kid), { s1, out1, kidAlive: alive(kid) });
  check("stopProc on a process that is gone: false, no throw", V.stopProc(child) === false && V.stopProc(null) === false);
  check("stopProc on Windows = taskkill /T /F (the whole tree)", /taskkill", \["\/pid", String\(p\.pid\), "\/T", "\/F"\]/.test(src("lib/venv.js")) && /process\.kill\(-p\.pid, "SIGKILL"\)/.test(src("lib/venv.js")));

  // ---- singVoice: ■ Stop a job
  fake("seedvc"); fake("rvc");
  const clip = SV.addClip(wav(path.join(tmp, "in", "me.wav"), 1.5), "Me.wav");
  const song = SS.add(wav(path.join(tmp, "in", "song.wav"), 1), "dry My song 10-00-00.wav").name;
  const stops = [], seen = [];
  SV.setStop((p) => { stops.push(p.pid); p.die(); return true; });
  SV.setRun((py, script, body, o) => new Promise((resolve, reject) => {
    seen.push({ body, o: { group: o.group, spawn: typeof o.onSpawn } });
    const p = { pid: 4242, die: () => reject(new Error("killed")) };
    o.onSpawn(p); o.onLog("[sing] working");
    if (body.fast) resolve({ out: body.out });
  }));
  const j1 = SV.convert({ engine: "seedvc", sample: song, clip: clip.name, shift: 2, quality: "fast" });
  await sleep(30);
  check("a job's processes are kept for ■ Stop (asked with group: true) - and never sent to the page", seen[0] && seen[0].o.group === true && seen[0].o.spawn === "function" && !Object.keys(j1).includes("procs") && JSON.stringify(j1).indexOf("4242") < 0, seen[0]);
  const c1 = SV.cancel(j1.id);
  await until(() => j1.state !== "running", 3000);
  check("cancel: its processes ended; the job ends \"cancelled\" (not an error), a [stop] line; nothing added to My samples",
    c1.ok && c1.state === "stopping" && c1.stopped === 1 && stops.join() === "4242" && j1.state === "cancelled" && j1.result === null && j1.lines.some((l) => /^\[stop\] ■ stopped$/.test(l)) && !j1.lines.some((l) => /^\[error\]/.test(l)) && SS.list().length === 1, { c1, j1, n: SS.list().length });
  check("cancel again (it has ended): ok, its state; an unknown job: 404", SV.cancel(j1.id).state === "cancelled" && (() => { try { SV.cancel("nope"); return false; } catch (e) { return e.status === 404; } })());
  // a process that arrives after ■ (between two steps) is ended at once
  SV.setRun((py, script, body, o) => new Promise((resolve, reject) => { setTimeout(() => { const p = { pid: 77, die: () => reject(new Error("killed")) }; o.onSpawn(p); }, 120); }));
  const j2 = SV.convert({ engine: "seedvc", sample: song, clip: clip.name });
  SV.cancel(j2.id);
  await until(() => j2.state !== "running", 3000);
  check("■ before the engine had started: it is ended the moment it starts; the job ends cancelled", j2.state === "cancelled" && stops.includes(77), { j2: j2.state, stops });
  // a result that arrives after ■ is thrown away
  SV.setRun(async (py, script, body, o) => { o.onSpawn({ pid: 5, die: () => {} }); await sleep(150); fs.writeFileSync(body.out, fs.readFileSync(body.source)); return { out: body.out }; });
  const j3 = SV.convert({ engine: "seedvc", sample: song, clip: clip.name });
  SV.cancel(j3.id);
  await until(() => j3.state !== "running", 3000);
  check("a job that finishes anyway after ■ adds nothing (cancelled, My samples unchanged)", j3.state === "cancelled" && SS.list().length === 1, { s: j3.state, n: SS.list().length });
  const tr = SV.train({ name: "tim", clips: [clip.name], epochs: 100 });
  await sleep(20); SV.cancel(tr.id); await until(() => tr.state !== "running", 3000);
  check("🎓 training stopped: cancelled; the line says Applio keeps what it saved (🎓 Train the same name again)", tr.state === "cancelled" && tr.lines.some((l) => /Applio keeps what it saved so far: 🎓 Train the same name again/.test(l)), tr.lines);
  check("a stopped job leaves the way free for the next", (() => { try { const j = SV.convert({ engine: "seedvc", sample: song, clip: clip.name }); SV.cancel(j.id); return true; } catch (e) { return e.message; } })() === true);
  await sleep(200);

  // ---- Key "Auto"
  seen.length = 0;
  SV.setRun(async (py, script, body, o) => { seen.push(body); o.onSpawn({ pid: 1, die: () => {} }); fs.writeFileSync(body.out, fs.readFileSync(body.source)); return { out: body.out, seconds: 1 }; });
  const ja = SV.convert({ engine: "seedvc", sample: song, clip: clip.name, shift: "auto" });
  await until(() => ja.state !== "running", 3000);
  check("Key Auto on Seed-VC: auto_shift true with shift 0; the log says auto", seen[0] && seen[0].auto_shift === true && seen[0].shift === 0 && ja.lines.some((l) => /key auto \(fitted to your voice\)/.test(l)) && ja.state === "done", { b: seen[0], l: ja.lines });
  const ms = path.join(SV.paths(tmp).rvc.logs, "tim"); fs.mkdirSync(ms, { recursive: true }); fs.writeFileSync(path.join(ms, "tim_100e_900s.pth"), ""); fs.writeFileSync(path.join(ms, "tim.index"), "");
  const jr = SV.convert({ engine: "rvc", sample: song, model: "tim", shift: "auto" });
  await until(() => jr.state !== "running", 3000);
  const jn = SV.convert({ engine: "seedvc", sample: song, clip: clip.name, shift: -3 });
  await until(() => jn.state !== "running", 3000);
  check("RVC has no Auto key (auto_shift false, ±0); a number stays a number (auto_shift false)", seen[1].auto_shift === false && seen[1].shift === 0 && seen[2].auto_shift === false && seen[2].shift === -3, seen.slice(1).map((b) => [b.auto_shift, b.shift]));
  SV.setRun(null); SV.setStop(null);

  // ---- the helper, for real, against a stand-in Seed-VC
  const H = path.join(ROOT, "scripts", "singvoice_local.py"), work = path.join(tmp, "helper"), sv = path.join(work, "seedvc");
  fs.mkdirSync(sv, { recursive: true });
  fs.writeFileSync(path.join(sv, "inference.py"), "import sys,os,json,shutil\na=sys.argv[1:]\nd=dict(zip(a[::2],a[1::2]))\nos.makedirs(d['--output'],exist_ok=True)\njson.dump(d,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'args.json'),'w'))\nshutil.copy(d['--source'],os.path.join(d['--output'],'vc_x.wav'))\n");
  const runPy = (job) => { const jf = path.join(work, "job.json"); fs.writeFileSync(jf, JSON.stringify(job)); const r = spawnSync("python3", [H, jf], { encoding: "utf8" }); try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { return { raw: r.stdout + r.stderr }; } };
  const vocal = wav(path.join(work, "vocal.wav"), 0.5), ref = SV.clipFile(clip.name);
  const h1 = runPy({ task: "convert", engine: "seedvc", src_dir: sv, source: vocal, ref, out: path.join(work, "o1.wav"), shift: 0, auto_shift: true, quality: "fast", device: "cpu" });
  const a1 = JSON.parse(fs.readFileSync(path.join(sv, "args.json"), "utf8"));
  const h2 = runPy({ task: "convert", engine: "seedvc", src_dir: sv, source: vocal, ref, out: path.join(work, "o2.wav"), shift: 2, auto_shift: true, quality: "fast", device: "cpu" });
  const a2 = JSON.parse(fs.readFileSync(path.join(sv, "args.json"), "utf8"));
  check("helper ▸ Seed-VC with Key Auto: --auto-f0-adjust True (shift 0); a shift of its own wins (--auto-f0-adjust False, +2)",
    h1.out && a1["--auto-f0-adjust"] === "True" && a1["--semi-tone-shift"] === "0" && h2.out && a2["--auto-f0-adjust"] === "False" && a2["--semi-tone-shift"] === "2", { a1, a2 });
  const py = src("scripts/singvoice_local.py");
  check("helper ▸ SoulX-Singer: auto_shift from auto_of (the same rule)", /a\.save_dir, a\.auto_shift, a\.pitch_shift = work, auto_of\(job\), shift_of\(job\)/.test(py) && /def auto_of\(job\):[\s\S]{0,260}return bool\(job\.get\("auto_shift"\)\) and shift_of\(job\) == 0/.test(py));

  // ---- the wiring
  const R = src("routes/singVoice.js"), ST = src("lib/stems.js"), SVJ = src("lib/singVoice.js");
  check("route: POST /api/sing/job/:id/cancel -> SV.cancel (routes/singVoice.js, never server.js)", /app\.post\("\/api\/sing\/job\/:id\/cancel", \(req, res\) => \{ try \{ res\.json\(SV\.cancel\(/.test(R) && !/sing\/job/.test(src("misc/server.js")));
  check("✂ demucs can be stopped too: stems.separate passes onSpawn + group on to runJson", /onSpawn: o\.onSpawn, group: !!o\.onSpawn/.test(ST) && /S\.separate\(null, \{ file: src, out_dir: tmp, stem: "song", onLog: log, onSpawn:/.test(SVJ));
  const D = src("ext/synthdock/dock.html"), JS = src("ext/synthdock/synthsing.js"), TL = src("ext/synthdock/synthtl.js");
  const order = ["sySingEngine", "sySingVoice", "sySingRec", "sySingMon", "sySingAdd", "sySingTrain", "sySingKey", "sySingQ", "sySingGo", "sySingStop", "sySingSep", "sySingMix", "sySingMsg"].map((id) => D.indexOf('id="' + id + '"'));
  check("the row: 🎙 Record, 🎧, 📂 … ▶, ■ Stop (hidden until something runs), ✂ Separate vocals, ⧉ Mix", order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])) && /id="sySingStop" type="button" hidden/.test(D) && /id="sySingMon" type="button" aria-pressed="false"/.test(D), order);
  check("Key: Auto first (not for RVC - disabled with a model engine), then -12 .. +12", /<option value=\\"auto\\"[^>]*>Auto<\/option>/.test(JS) && /ao\.disabled = model; if \(model && k\.value === "auto"\) k\.value = "0";/.test(JS) && /shift: kv === "auto" && e\.ref !== "model" \? "auto"/.test(JS));
  check("■ Stop: cancels the server job (or stops at the next step before one exists); the job's \"cancelled\" ends ▶ / ✂ / ⧉ / 🎓 quietly",
    /function stop\(\)[\s\S]{0,300}cancelJob\(G\.jobId\)/.test(JS) && /r\.job\.state === "cancelled"\) reject\(stopped\(\)\)/.test(JS) && /if \(G\.stopped\) cancelJob\(j\.id\);/.test(JS) && /■ Stopped - nothing added/.test(JS) && /■ Stopped - nothing split/.test(JS) && /■ Stopped - Applio keeps what it saved so far/.test(JS));
  check("⧉ Mix: the voice layer + its instrumental rendered as they sit (renderMix: their Vol / effects; muted ones heard) -> My samples, the Sound assets, a new layer; the two muted",
    /function renderMix\(list\)/.test(TL) && /\[\]\.concat\(only\)\.indexOf\(i\) >= 0 && !l\.mute/.test(TL) && /renderMix: renderMix/.test(TL) && /t\.renderMix\(\[m\.v, m\.ins\]\)/.test(JS) && /fd\.append\("to", "sound"\)/.test(JS) && /t\.patchLayer\(m\.v, \{ mute: true \}\); t\.patchLayer\(m\.ins, \{ mute: true \}\)/.test(JS));
  check("🎧: the mic to the speakers only while recording (MediaStreamSource -> destination), closed on ■; remembered (h3.synth.sing.mon)",
    /createMediaStreamSource\(r\.h3stream\)/.test(JS) && /s\.connect\(c\.destination\)/.test(JS) && /monOff\(mr\); G\.rec = null;/.test(JS) && /LS\.set\("mon", G\.mon \? "1" : "0"\)/.test(JS));
  check("nothing in synthsing.js shadows stop() (boot's keydown stopper is `hold`)", (JS.match(/\bvar stop\b|\bfunction stop\b/g) || []).length === 1 && /var hold = function \(e\) \{ e\.stopPropagation\(\); \};/.test(JS));
  check("the version is 2.967.0", require("../package.json").version === "2.967.0");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
