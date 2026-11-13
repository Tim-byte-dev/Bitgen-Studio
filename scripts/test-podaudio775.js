#!/usr/bin/env node
/* bitGen Studio — 2.775.0: TEXT TO SPEECH, SPEECH TO TEXT AND SONG SEPARATION ON A POD (lib/podAudio.js) + YuE2's own program
 * kept off pods (lib/stylePods.js comfyStyle). Stubbed config and pod - nothing spawned (scripts/test-podaudio775-py.js runs
 * the pod's Python for real).
 * Tim (verbatim): "when we create the pod can we have a button for tts, stt and demacus(sheet music) and allow bitgen to clone
 * voices and store the voice locally until user selects that voice" + "i am hoping for the same functionality for people with
 * minipc or gpu poor, if they are willing to rent gpu's" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { runpod: { key: "k", pod_id: "" }, pod_audio: {} } };
const PROJ = fs.mkdtempSync(path.join(os.tmpdir(), "pa775p-"));
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(ROOT, "styles"), resolvePath: (p) => path.resolve(ROOT, p),
  projDir: () => PROJ, getProject: () => "p", pDir: (k) => { const d = path.join(PROJ, k); fs.mkdirSync(d, { recursive: true }); return d; }, probeDuration: () => 1 });
const A = require("../lib/podAudio");

(async () => {
  // ---- pure
  check("kindsOf: only tts / stt / stems, once each", JSON.stringify(A.kindsOf(["tts", "x", "stems", "tts"])) === '["tts","stems"]');
  const r = { runpod: { pod_id: "podB" }, pod_audio: { podA: ["tts", "stt"], podB: ["tts"] } };
  check("pick: remote + pods - the pod in use first when it is ticked, else any pod ticked for the kind",
    A.pick(r, "tts", true, { pods: true }, "remote") === "podB" && A.pick(r, "stt", true, { pods: true }, { where: "both", per: true, stt: true }) === "podA" && A.pick(r, "stt", true, { pods: true }, { where: "both", per: true, stt: false }) === "" && A.pick(r, "stems", true, { pods: true }, "remote") === "");
  check("…Local, remote generation off, or Serverless = this computer", A.pick(r, "tts", true, { pods: true }, "local") === "" && A.pick(r, "tts", false, { pods: true }, "remote") === "" && A.pick(r, "tts", true, { pods: false }, "remote") === "");
  const job = { text: "hi", out: "/home/u/proj/sound/tts_x.wav", ref_audio: "/home/u/proj/voices/Anna.wav", ref_text: "hello", prompt_cache: "/home/u/cache.pt",
    items: [{ text: "a", ref_audio: "/home/u/proj/voices/Bob.wav", out: "/tmp/sp_1.wav" }] };
  check("filesOf: the inputs a helper reads (audio / file / ref_audio, each item's ref_audio)", JSON.stringify(A.filesOf(job).map((f) => f.file)) === JSON.stringify(["/home/u/proj/voices/Anna.wav", "/home/u/proj/voices/Bob.wav"]));
  const OUT = "/workspace/ComfyUI/output/bitgen-audio/j1";
  const pj = A.rewrite(job, { "/home/u/proj/voices/Anna.wav": "/workspace/bitgen-audio/in/aa.wav", "/home/u/proj/voices/Bob.wav": "/workspace/bitgen-audio/in/bb.wav" }, OUT);
  check("rewrite: inputs -> their pod paths, outputs -> the pod ComfyUI's output folder, prompt_cache dropped, the local job untouched",
    pj.ref_audio === "/workspace/bitgen-audio/in/aa.wav" && pj.items[0].ref_audio === "/workspace/bitgen-audio/in/bb.wav" && pj.out === OUT + "/tts_x.wav" && pj.items[0].out === OUT + "/sp_1.wav" && pj.prompt_cache === null && job.out === "/home/u/proj/sound/tts_x.wav", pj);
  const sj = { file: "/p/song.mp3", out_dir: "/home/u/proj/sound", stem: "song", layers: 4 };
  const m = A.mapBack({ vocals: OUT + "/song_vocals.wav", drums: OUT + "/song_drums.wav", n: 4, other: "not a file" }, sj, OUT);
  check("mapBack: the pod's files -> where this computer wanted them (out_dir / out by name), the answer with local paths",
    m.answer.vocals === path.join("/home/u/proj/sound", "song_vocals.wav") && m.answer.n === 4 && m.files.length === 2 && m.files[0].pod === OUT + "/song_vocals.wav", m);
  const ic = A.installCode(["tts", "stems"]), rc = A.runCode({ id: "j1", job: { a: 1 }, python: "/x/py", helper: "/x/h.py", dir: "/x/jobs/j1", out: OUT });
  const PJ = require("../lib/podJob");
  check("installCode / runCode are pod jobs lib/podJob.js can detach: their status file, THREAD line and marker",
    PJ.statusName(ic) === ".bitgen_aud_inst.json" && PJ.markerOf(ic) === "bitgen-aud-inst-started" && ic.includes(PJ.THREAD) && /omnivoice/.test(ic) && /demucs/.test(ic) && !/faster-whisper/.test(ic)
    && PJ.statusName(rc) === ".bitgen_aud_j1.json" && PJ.markerOf(rc) === "bitgen-aud-started" && rc.includes(PJ.THREAD), { s1: PJ.statusName(ic), s2: PJ.statusName(rc) });
  check("…the venvs reuse the pod's PyTorch (--system-site-packages) under /workspace (kept while stopped); ffmpeg installed when missing",
    /--system-site-packages/.test(ic) && /\/workspace\/bitgen-audio/.test(ic) && /apt-get install -y -qq ffmpeg/.test(ic));

  // ---- a job on a (stubbed) pod
  const G = require("../lib/gpuSplit");
  G.enabled = () => true; G.engineOf = () => ({ pods: true }); G.split = () => ({ where: "remote" });
  CFG.rgpu.pod_audio = {};
  check("wanted: nothing ticked = this computer", !A.wanted("tts"));
  A.setKinds("pod9", ["tts", "stems"]);
  check("setKinds: the pod's ticks saved (rgpu.pod_audio) - wanted(tts) yes, wanted(stt) no", JSON.stringify(CFG.rgpu.pod_audio.pod9) === '["tts","stems"]' && A.wanted("tts") && !A.wanted("stt") && A.podFor("stems") === "pod9");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pa775-")), clip = path.join(tmp, "Anna.wav"), out = path.join(tmp, "sound", "tts_anna.wav");
  fs.writeFileSync(clip, "RIFF-voice-clip");
  const calls = { put: [], kernel: [], get: [], ready: 0 };
  let STATUS = {};
  A.setDeps({
    ready: async (p, port, say, noStart) => { calls.ready++; return { pod_id: p, jupyter_url: "J", comfy_url: "C", comfy_dir: "/workspace/ComfyUI" }; },
    portOf: () => 8188,
    kernel: async (w, wrapped, code) => { calls.kernel.push(code); const s = PJ.statusName(code); STATUS[s] = /aud_inst/.test(s) ? { running: false, state: "done", done: ["tts", "stems"], failed: {} } : null; return "bitgen-started"; },
    status: async (p, name) => {
      if (name === ".bitgen_aud_inst.json") return STATUS[name];
      const code = calls.kernel[calls.kernel.length - 1], jobJ = JSON.parse(JSON.parse(/JOB = json\.loads\((".*?")\);/.exec(code)[1]));
      return { running: false, log: ["loading OmniVoice", "speaking 2 s"], result: { ok: true, out: jobJ.out }, error: "" };
    },
    put: async (w, file, dir, name) => { calls.put.push(dir + "/" + name); },
    get: async (w, pod, local) => { calls.get.push([pod, local]); fs.mkdirSync(path.dirname(local), { recursive: true }); fs.writeFileSync(local, "WAV"); },
    sleep: async () => {}, poll: 1,
  });
  const logs = [];
  const ans = await A.run("tts", { text: "hello there", out, ref_audio: clip, ref_text: "hello", num_step: 32 }, { onLog: (l) => logs.push(l) });
  check("run(tts): installed first (once), the helpers + the voice clip sent, the job run on the pod, the speech fetched to where this computer wanted it",
    ans.out === out && fs.readFileSync(out, "utf8") === "WAV" && calls.put.some((x) => /scripts\/omnivoice_local\.py$/.test(x)) && calls.put.some((x) => /scripts\/ta_compat\.py$/.test(x))
    && calls.put.some((x) => /\/workspace\/bitgen-audio\/in\/[0-9a-f]{16}\.wav$/.test(x)) && calls.get.length === 1 && /\/workspace\/ComfyUI\/output\/bitgen-audio\/\w+\/tts_anna\.wav$/.test(calls.get[0][0]), { ans, calls });
  check("…the pod's log lines reach the caller (the voice clip's name, then its own lines)", logs.some((l) => /sending Anna\.wav/.test(l)) && logs.includes("loading OmniVoice") && logs.includes("speaking 2 s"), logs);
  const put1 = calls.put.length;
  await A.run("tts", { text: "again", out: path.join(tmp, "sound", "tts_2.wav"), ref_audio: clip, ref_text: "hello" }, {});
  check("…the same voice again: nothing sent again (the clip is on the pod; the voice stays in this computer's store)", calls.put.length === put1, calls.put.slice(put1));
  A.setDeps(Object.assign({}, { ready: async () => ({ pod_id: "pod9", jupyter_url: "J", comfy_url: "C", comfy_dir: "/workspace/ComfyUI" }), portOf: () => 8188, kernel: async () => "bitgen-started",
    status: async (p, n) => n === ".bitgen_aud_inst.json" ? { running: false, done: ["tts", "stems"], failed: {} } : { running: false, log: ["RuntimeError: CUDA out of memory"], result: null, error: "RuntimeError: CUDA out of memory" },
    put: async () => {}, get: async () => {}, sleep: async () => {}, poll: 1 }));
  let err = null; try { await A.run("stems", { file: clip, out_dir: tmp, stem: "s", layers: 2 }, {}); } catch (e) { err = e; }
  check("…a job that fails on the pod says why", err && /on the pod: RuntimeError: CUDA out of memory/.test(err.message), err && err.message);
  // install failing for a kind
  A.INST.pod9 = null; delete A.INST.pod9;
  A.setDeps({ ready: async () => ({ pod_id: "pod9", jupyter_url: "J", comfy_url: "C", comfy_dir: "/workspace/ComfyUI" }), portOf: () => 8188, kernel: async () => "bitgen-started",
    status: async () => ({ running: false, state: "done", done: [], failed: { tts: "pip install did not work - ERROR: No matching distribution found for omnivoice" } }), put: async () => {}, get: async () => {}, sleep: async () => {}, poll: 1 });
  err = null; try { await A.run("tts", { text: "x", out }, {}); } catch (e) { err = e; }
  check("…an engine that could not be installed stops the job with pip's own line", err && /Text to speech could not be set up on the pod pod9 - Text to speech: pip install did not work - ERROR: No matching distribution/.test(err.message), err && err.message);
  // ticked on a stopped pod: not started for it
  delete A.INST.pod9;
  A.setDeps({ ready: async (p, port, say, noStart) => { if (noStart) throw Object.assign(new Error("the pod is stopped"), { stopped: true }); return {}; }, portOf: () => 8188, kernel: async () => "", status: async () => null, put: async () => {}, get: async () => {}, sleep: async () => {}, poll: 1 });
  const lr = await A.install("pod9", ["stt"], null, { noStart: true });
  check("install with noStart on a stopped pod: not started, left for when it runs", lr.later === true && !lr.ok, lr);
  A.setDeps(null);

  // ---- the callers: tts.speak goes to the pod when wanted (no OmniVoice on this computer needed)
  CFG.tts = { engine: "omnivoice", omnivoice: { venv: path.join(tmp, "no-venv") } };
  const T = require("../lib/tts");
  const st = await T.status();
  check("tts.status: Text to speech on a pod counts as installed (on_pod names it)", st.installed === true && st.on_pod === "pod9", { installed: st.installed, on_pod: st.on_pod });
  const S = require("../lib/stems");
  CFG.stems = {};
  check("stems.runtime: Song separation on a pod = installed (here: false)", S.runtime().installed === true && S.runtime().on_pod === "pod9" && S.runtime().here === false);
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  check("tts.speak / speechDialog / asr (both) / stems.separate hand their job to podAudio.run when a pod takes it",
    /require\("\.\/podAudio"\)\.run\("tts"/.test(src("lib/tts.js")) && /require\("\.\/podAudio"\)\.run\("tts"/.test(src("lib/speechDialog.js"))
    && (src("lib/asr.js").match(/require\("\.\/podAudio"\)\.run\("stt"/g) || []).length === 2 && /require\("\.\/podAudio"\)\.run\("stems"/.test(src("lib/stems.js")));
  check("a pod made with Audio ticked keeps them (lib/pods.js create); its setup installs them (lib/podMade.js afterLoad)",
    /o\.audio\.length\) require\("\.\/podAudio"\)\.setKinds\(p\.id, o\.audio\)/.test(src("lib/pods.js")) && /if \(D\.audio\) D\.audio\(id\)/.test(src("lib/podMade.js")));

  // ---- YuE2's own program never asks for a pod
  const SP = require("../lib/stylePods");
  check("comfyStyle: a ComfyUI style yes, YuE2's own program (engine yue2) no", SP.comfyStyle({ engine: "comfy" }) && SP.comfyStyle({}) && !SP.comfyStyle({ engine: "yue2" }));
  check("…gate: a YuE2 song in remote mode renders here (no pod asked for or started)", SP.gate({ mode: "music", style: { id: "yue2", name: "YuE2", kind: "music", engine: "yue2" } }) === null);
  check("…willUsePod says so", SP.willUsePod("music", { id: "yue2", kind: "music", engine: "yue2" }).pod === false);

  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(PROJ, { recursive: true, force: true });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
