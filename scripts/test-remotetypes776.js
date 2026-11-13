#!/usr/bin/env node
/* bitGen Studio — 2.776.0: EVERY TYPE OF WORK LOCAL OR REMOTE (lib/gpuSplit.js TYPES / onRemote / set per; static/remotetypes.js
 * rowsOf / noteOf; songs their own kind; lib/stylePods.js podJob and lib/podAudio.js pick follow each type's choice).
 * Stubbed config. Tim (verbatim): "add all the types to remote generation. Music - local/remote, tts-local/remote,
 * stt-local/remote, separate all of the choices into sections neatly justified with an editable(theme)border and bg color etc" */
"use strict";
const path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, runpod: { key: "k", pod_id: "podU" }, pod_audio: {} } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(ROOT, "styles"), resolvePath: (p) => path.resolve(ROOT, p) });
const G = require("../lib/gpuSplit");
const R = require("../static/remotetypes.js");

check("TYPES: image, video, music, tts, stt, stems; songs are their own kind", JSON.stringify(G.TYPES) === '["image","video","music","tts","stt","stems"]' && G.kindOf("music") === "music" && G.kindOf("t2va") === "video");
check("onRemote before per: Remote = everything, Both = the old boxes (music with video), Local = nothing",
  G.onRemote({ where: "remote" }, "tts") && G.onRemote({ where: "both", video: true }, "music") && !G.onRemote({ where: "both", video: false }, "music") && !G.onRemote({ where: "local", image: true }, "image"));
check("…per: each type's own choice, on Remote as on Both", !G.onRemote({ where: "remote", per: true, music: false }, "music") && G.onRemote({ where: "both", per: true, tts: true }, "tts") && !G.onRemote({ where: "local", per: true, tts: true }, "tts"));
// set: the first per change keeps what Remote meant for the others
G.set = G.set;   // (real)
let v; try { v = G.set({ per: true, music: false }); } catch (e) { v = { error: e.message }; }
const sp = CFG.rgpu.split;
check("set({per, music: false}) on Remote: music local, every other type stays remote (they were), per saved",
  sp.per === true && sp.music === false && sp.image === true && sp.video === true && sp.tts === true && sp.stt === true && sp.stems === true, sp);
check("…the view gives each type's choice (types) for the docker", v && v.types && v.types.music === "local" && v.types.image === "remote", v && v.types);
try { G.set({ image: false }); } catch (e) { /* fine */ }
check("…the old Both boxes (no per) still work as before", CFG.rgpu.split.image === false && CFG.rgpu.split.per === true);
const SP = require("../lib/stylePods");
check("stylePods.podJob follows the type: per + music local = not to a pod; video remote = to a pod",
  !SP.podJob(true, { pods: true }, { where: "remote", per: true, music: false }, "music", true) && SP.podJob(true, { pods: true }, { where: "remote", per: true, video: true }, "video", false));
const A = require("../lib/podAudio");
const r = { runpod: { pod_id: "podU" }, pod_audio: { podU: ["tts"] } };
check("podAudio.pick follows the type: tts Remote = its pod, Local = here", A.pick(r, "tts", true, { pods: true }, { where: "both", per: true, tts: true }) === "podU" && A.pick(r, "tts", true, { pods: true }, { where: "both", per: true, tts: false }) === "");
// autoTick: Remote picked for an audio kind and no pod has it - the pod in use gets it
CFG.rgpu.pod_audio = {};
A.install = async () => ({ ok: true });   // (no pod here)
const t = A.autoTick("stt");
check("autoTick: no pod ticked for Speech to text - the pod in use (podU) gets the tick", t === "podU" && JSON.stringify(CFG.rgpu.pod_audio.podU) === '["stt"]', CFG.rgpu.pod_audio);
// the docker's rows
const V = { types: { image: "remote", video: "local", music: "remote", tts: "remote", stt: "local", stems: "remote" }, engine: { pods: true }, remote: null, audio: { tts: "podU", stt: "", stems: "" } };
const gen = R.rowsOf(V, "gen"), au = R.rowsOf(V, "audio");
check("rowsOf: Generation = Image / Video / Music, Audio = Text to speech / Speech to text / Song separation, each Local or Remote",
  gen.map((x) => x.label + ":" + x.remote).join() === "Image:true,Video:false,Music:true" && au.map((x) => x.label + ":" + x.remote).join() === "Text to speech:true,Speech to text:false,Song separation:true", { gen, au });
check("noteOf: an audio kind on Remote names its pod, or says no pod has it; Local = no line",
  /on the pod podU/.test(R.noteOf(V, "tts")) && /no pod has it yet/.test(R.noteOf(V, "stems")) && R.noteOf(V, "stt") === "" && /on its style's pod/.test(R.noteOf(V, "image")));
check("…audio on Serverless: it runs on a pod", /pick RunPod ▸ Pods/.test(R.noteOf(Object.assign({}, V, { engine: { pods: false } }), "tts")));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
