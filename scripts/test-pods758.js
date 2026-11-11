#!/usr/bin/env node
/* bitGen Studio — 2.758.0 units: P_ pod styles + a pod's loading progress.
 * Tim (verbatim): "when pods are chosen only show pod styles,I am trying with this pod ComfyUI - Qwen Image - ZiT - Boogu -
 * Krea , how can i choose the model?" (asked: "Both" - the pod's models and its workflows) + "can you show progess of pod
 * loading?" (asked: "Stages + timed bar") + "use overide settings when pods load but disable checkpoints and lora loader,
 * overide settings will be for step, seed and cfg and the size and aspect ratio". */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pods758-"));
let CFG = { rgpu: { mode: "runpod", runpod: { pod_id: "abc123", pod_name: "My Qwen pod", port: 3000, cost_hr: 0.69 }, engine: { provider: "runpod", runpod: "pods" }, enabled: true, split: { where: "remote" } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: TMP, BASE: ROOT };
require.cache[coreP] = fake;
const PP = require("../lib/podProgress"), PS = require("../lib/podStyles"), S = require("../lib/styles"), G = require("../lib/gpuSplit"), RP = require("../lib/rpslStyles");

// ---- the loading progress
check("stages: waiting for a machine -> starting the container -> ComfyUI starting -> pod loaded",
  PP.stageOf({ status: "PROVISIONING" }) === 0 && PP.stageOf({ status: "RUNNING", uptime: 0 }) === 1 && PP.stageOf({ status: "RUNNING", uptime: 40 }) === 2
  && PP.stageOf({ status: "RUNNING", has_runtime: true }) === 2 && PP.stageOf({ status: "RUNNING", uptime: 99, ready: true }) === 3 && PP.stageOf({ status: "EXITED" }) === 0);
let pr = PP.progress({ status: "RUNNING", uptime: 60 }, 180, 420);
check("timed bar: 3 min of a 7-minute load = 43 %, 4 min left; never 100 % before ComfyUI answers",
  pr.stage === 2 && pr.pct === 43 && pr.left === 240 && PP.progress({ status: "RUNNING", uptime: 60 }, 900, 420).pct === 97 && PP.progress({ status: "RUNNING", ready: true }, 400, 420).pct === 100, pr);
pr = PP.progress({ status: "RUNNING", uptime: 10 }, 120, 0);
check("…no load timed before: the stage's place, creeping a little, never past the next stage", pr.expect === 0 && pr.pct >= 40 && pr.pct < 100 && PP.progress({ status: "PROVISIONING" }, 9999, 0).pct < 15, pr);
let L = PP.remember({}, "abc123", "ls250824/run-comfyui-image:latest", 431.6);
check("remember / expectOf: a load's time kept by pod and by image; another pod of the same image expects it too; nonsense times ignored",
  PP.expectOf(L, "abc123", "x") === 432 && PP.expectOf(L, "zzz", "ls250824/run-comfyui-image:latest") === 432 && PP.expectOf(L, "zzz", "other") === 0
  && JSON.stringify(PP.remember(L, "a", "b", -5)) === JSON.stringify(L) && Object.keys([...Array(50)].reduce((m, _, i) => PP.remember(m, "p" + i, "", 10), {})).length === 40, L);
const RG = rd("lib", "remoteGpu.js");
check("lib/remoteGpu.js podState sends the progress, times the load from RunPod's start (or when first seen) and keeps it in rgpu.pod_loads",
  /progress: prog \};/.test(RG) && /c\.rgpu\.pod_loads = PP\.remember\(loads, m\.id, image, elapsed\)/.test(RG) && /Date\.parse\(m\.started_at/.test(RG));
const vm = require("vm"), ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(rd("static", "podload.js"), ctx);
const W = ctx.window.H3PodLoad;
check("static/podload.js: the words under the bar - '3/4 ComfyUI starting (the template may be downloading its models) · 3 min of about 7', '1/4 waiting for a GPU machine · 40 s so far', 'pod loaded in 7 min'",
  W.line(PP.progress({ status: "RUNNING", uptime: 60 }, 180, 420)) === "3/4 ComfyUI starting (the template may be downloading its models) · 3 min of about 7 min"
  && W.line(PP.progress({ status: "PROVISIONING" }, 40, 0)) === "1/4 waiting for a GPU machine · 40 s so far" && W.line(Object.assign(PP.progress({ status: "RUNNING", ready: true }, 420, 0), { took: 420 })) === "pod loaded in 7 min"
  && W.mins(3900) === "1 h 5 min", W.line(PP.progress({ status: "RUNNING", uptime: 60 }, 180, 420)));
check("…the PODS docker draws it under the pod while it loads (2.758.0: the pods live only there now)", /H3PodLoad\.bar\(st\)/.test(rd("static", "podsdock.js")) && !/rgdPodList|rgdCuts/.test(rd("static", "remotedock.js"))
  && /<script src="\/static\/podload\.js"><\/script>/.test(rd("static", "index.html")));

// ---- P_ styles
check("starterFor: the template's model files -> bitGen's own style for them (Qwen Image, Z-Image Turbo, Krea 2, FLUX.1 Krea / dev, SDXL); an unknown one (Boogu) -> none",
  PS.starterFor("qwen_image_2.1_int8_convrot.safetensors") === "qwen2_1" && PS.starterFor("qwen_image_edit_2511_bf16.safetensors") === "Qwen Image Edit 2511"
  && PS.starterFor("z_image_turbo_bf16.safetensors") === "R_Z-Image Turbo" && PS.starterFor("krea2_turbo_fp8_scaled.safetensors") === "Krea 2 Turbo"
  && PS.starterFor("krea2_raw-Q8_0.gguf") === "Krea 2 Raw GGUF" && PS.starterFor("flux1-krea-dev_fp8_scaled.safetensors") === "R_FLUX.1 dev"
  && PS.starterFor("sd_xl_base_1.0.safetensors") === "SDXL" && PS.starterFor("boogu_v2.safetensors") === "" && PS.starterFor("sub/dir/Z-Image-Turbo.gguf") === "R_Z-Image Turbo");
check("…each starter named there exists", ["qwen2_1", "Qwen Image Edit 2511", "R_Z-Image Turbo", "Krea 2 Turbo", "Krea 2 Raw GGUF", "R_FLUX.1 dev", "SDXL", "FLUX.2 Klein 9B", "R_SD3 Medium", "R_FLUX.1 schnell"].every((n) => S.STARTER_STYLES.some((s) => s.name === n)));
check("closest: the same file, else the same name in another folder, else the most shared words; nothing shared = none",
  PS.closest("ae.safetensors", ["ae.safetensors"]) === "ae.safetensors" && PS.closest("qwen_3_4b.safetensors", ["zimage/qwen_3_4b.safetensors"]) === "zimage/qwen_3_4b.safetensors"
  && PS.closest("qwen3vl_4b_fp8_scaled.safetensors", ["clip_l.safetensors", "qwen3vl_4b_bf16.safetensors"]) === "qwen3vl_4b_bf16.safetensors" && PS.closest("t5xxl.safetensors", ["clip_l.safetensors"]) === "");
const wf = JSON.parse(rd("comfy_workflows", "img_krea2_turbo_t2i.json"));
const sw = PS.swapFiles(wf, "krea/krea2_turbo_bf16.safetensors", { text_encoders: ["qwen3vl_4b_bf16.safetensors"], vae: ["qwen_image_vae.safetensors"] });
const loaders = Object.values(sw.graph).filter((n) => /Loader/.test(n.class_type) && !/Lora/.test(n.class_type)).map((n) => n.inputs.unet_name || n.inputs.clip_name || n.inputs.vae_name);
check("swapFiles: bitGen's Krea 2 workflow with the pod's files - its model, its closest text encoder; the VAE it has already kept; the original untouched",
  loaders.join() === "krea/krea2_turbo_bf16.safetensors,qwen3vl_4b_bf16.safetensors,qwen_image_vae.safetensors" && sw.swapped.length === 2 && !sw.kept.length
  && JSON.stringify(wf).includes("krea2_turbo_fp8_scaled"), { loaders, sw: sw.swapped });
check("kindOfGraph: Save Image = picture, a video / song save = not a picture style (for now), nothing saved = none",
  PS.kindOfGraph({ 1: { class_type: "SaveImage" } }) === "image" && PS.kindOfGraph({ 1: { class_type: "VHS_VideoCombine" } }) === "video" && PS.kindOfGraph({ 1: { class_type: "SaveAudioMP3" } }) === "music" && PS.kindOfGraph({}) === "");
check("styleName: P_ + the workflow's / model's name", PS.styleName("Qwen Image 2512 (fast).json") === "P_Qwen Image 2512 (fast)" && PS.styleName("P_x") === "P_x" && PS.styleName("a/b:c") === "P_a b c");

const pod = S.save(TMP, { name: "my flow", kind: "image", engine: "comfy", arch: "flux", workflow: "comfy_workflows/pod/x.json", runs_on: "pod", pod_id: "abc-123!", pod_port: 3000, pod_auto: true });
check("a style saved with Runs on: RunPod pod = P_<name>, its pod (letters and digits), its ComfyUI port; no missing slots (the pod has the models)",
  pod.name === "P_my flow" && pod.runs_on === "pod" && pod.pod_id === "abc123" && pod.pod_port === 3000 && pod.pod_auto && S.missingSlots(pod).length === 0, pod);
const back = S.save(TMP, Object.assign({}, pod, { runs_on: "local" }));
check("…back to This computer: P_ and the pod fields go", back.name === "my flow" && !("pod_id" in back) && back.runs_on === "local", back);

// ---- only P_ styles when Pods are picked
const set = (o) => Object.assign({ where: "remote", pods: true, sls: false, show_all: false }, o);
check("Basic Settings ▸ GPU on RunPod ▸ Pods (Remote / Both): only P_ styles show - local, R_ and API_ ones hidden, the template too",
  RP.hideWhy({ runs_on: "pod" }, { ok: true }, set()) === null && /only P_ pod styles/.test(RP.hideWhy({ runs_on: "local" }, { ok: true }, set()))
  && /only P_/.test(RP.hideWhy({ runs_on: "remote" }, { ok: true }, set({ where: "both" }))) && /only P_/.test(RP.hideWhy({ runs_on: "api" }, { ok: true }, set()))
  && /template\.hide = st\.pods && st\.where !== "local"/.test(rd("lib", "rpslStyles.js")));
check("…not on Pods (Serverless, or Local): a P_ style is hidden (it needs a pod); the rest as before",
  /Pods shows it/.test(RP.hideWhy({ runs_on: "pod" }, { ok: true }, set({ pods: false }))) && /Pods shows it/.test(RP.hideWhy({ runs_on: "pod" }, { ok: true }, set({ where: "local" })))
  && RP.hideWhy({ runs_on: "local" }, { ok: true }, set({ where: "local" })) === null);

// ---- where a P_ style renders
let t = G.podTarget({ name: "P_x" }, CFG.rgpu);
check("forJob / podTarget: a P_ style renders on its own pod, else the pod in use, through RunPod's proxy at its ComfyUI port",
  t.url === "https://abc123-3000.proxy.runpod.net" && t.pod_id === "abc123" && /My Qwen pod/.test(t.label) && t.cost_hr === 0.69
  && G.podTarget({ name: "P_y", pod_id: "zz9", pod_port: 8188 }, CFG.rgpu).url === "https://zz9-8188.proxy.runpod.net"
  && /no pod is picked/.test(G.podTarget({ name: "P_z" }, {}).error), t);
const fj = G.forJob(JSON.parse(JSON.stringify(Object.assign({ engine: { comfy: { url: "http://127.0.0.1:8188" } } }, CFG))), { mode: "image", style: { name: "P_x", runs_on: "pod" } });
check("…the job's ComfyUI address = the pod's (ComfyUI here not started), said in the job log", fj.config.engine.comfy.url === "https://abc123-3000.proxy.runpod.net" && fj.config.engine.comfy.autostart === false && /a pod style\) renders on RunPod pod/.test(fj.note), fj.note);

// ---- Basic Settings' override with a pod style
const IDX = rd("routes", "index.js");
check("routes/index.js: a P_ picture style takes Basic Settings' steps / seed / CFG / size (2.762.0: and its checkpoint - sent to the pod), never its temporary LoRAs, LoRA weights or the Model manager's pick; the pod workflow keeps its own numbers otherwise",
  /if \(podStyle\) \{ delete b\.extra_loras; delete b\.lora_weights; delete b\.mm_override; \}/.test(IDX)
  && /if \(podStyle\) styled = Object\.assign\(\{\}, styled, \{ steps: null, cfg: null, width: null, height: null, sampler: "", clip_skip: null \}\);/.test(IDX));
check("…a P_ video style: Basic Settings' model and LoRAs left out (steps / seed / CFG stay)", /if \(podVs && podVs\.runs_on === "pod"\) \{ if \(bo\) \{ bo\.model = ""; bo\.loras = \[\]; \} f\.extra_loras = "\[\]"; \}/.test(IDX));
const PL = rd("static", "podload.js");
check("static/podload.js: with a P_ style picked, Basic Settings' LoRA sliders and temporary LoRAs (pictures) / model box and temporary LoRAs (video) are switched off; RunPod ▸ Pods ticks Override style",
  /image: \["imgLoras", "tliRows"\], video: \["vidModel", "tlvRows"\]/.test(PL) && /t\.name === "gpuRunpod" && t\.value === "pods" && t\.checked/.test(PL) && /A checkpoint picked below is sent to the pod once/.test(PL));   // 2.762.0: the checkpoint box is open
check("the model-file check skips P_ styles; Runs on has ◉ RunPod pod with its pod ID (blank = the pod in use)",
  /st0\.runs_on === "pod"\) return \{ skip: "a P_ pod style/.test(rd("routes", "modelsFound.js")) && /\["pod", "RunPod pod", /.test(rd("static", "runson.js")) && /if \(v === "pod"\) return \{ runs_on: "pod", endpoint: "", pod_id:/.test(rd("static", "runson.js")));
check("routes/pods.js: GET /api/pods/:id/comfy + POST /api/pods/:id/styles, before /:id/:action; the PODS docker's 🎨 Styles opens them",
  rd("routes", "pods.js").indexOf('"/api/pods/:id/styles"') < rd("routes", "pods.js").indexOf('"/api/pods/:id/:action"') && /data-pdsty/.test(rd("static", "podsdock.js")) && /🎨 Make P_ styles/.test(PL));
const PD = rd("static", "podsdock.js");
check("pod shortcuts on the PODS docker's cards (Tim: \"add to pod's card in pods docker can bitgen fill in the template link automatically?\"): ☆ keeps the template (its own ID - no link to paste), ★ Shortcuts lists them with Deploy ↗; a private template's link can still be pasted there",
  /\["star", "★ Shortcuts"\]/.test(PD) && /data-pdstar=/.test(PD) && /star\(\{ id: id, name: t\.name \|\| "" \}, !isStar\(id\)\)/.test(PD) && /class="btn ghost pdDeploy"/.test(PD) && /id="pdCutLink"/.test(PD) && /Explore RunPod templates ↗/.test(PD)
  && require("../lib/podShortcuts").templateId("abc12345xy") === "abc12345xy");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
