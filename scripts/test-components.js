#!/usr/bin/env node
/* bitGen Studio — 2.353.0: components.txt + Viggle (native) installed on start with the ComfyUI workflow's models.
 * Run: node scripts/test-components.js
 * Tim: "check to see if viggle native is installed on start, add a file components.txt ... viggle native=1 /
 * viggle native=0, if start finds viggle=0 then install viggle, check if comfy workflow for the component
 * exists, if it exists use the models in the workflow so user doesn't have to dl new ones".
 *   1. lib/components: the file (header, 1 / 0, skip kept, other lines kept), the start decision;
 *   2. lib/nativeEngine: the model names a workflow holds (API + UI exports), which files exist in ComfyUI's
 *      folders (a subfolder, a Windows \ name), used first, NOT downloaded until a check fails; the DMD LoRA
 *      is its own download;
 *   3. routes/components + routes/native end to end on a temp install (makeJob stubbed, a fake venv whose
 *      python is the stub checker): the start check writes 0 and queues ONE install that fetches only what
 *      the workflow files do not cover; after it, the files are checked, the one the engine cannot read is
 *      downloaded by a follow-up install, and components.txt turns 1 when all is there; skip is respected;
 *      the test server (H3_E2E) never installs. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "lib", "components"));
const NE = require(path.join(ROOT, "lib", "nativeEngine"));
const touch = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body === undefined ? "x" : body); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "comp_"));

// ---- 1. the file + the decision
const B1 = path.join(tmp, "b1");
fs.mkdirSync(B1);
C.write(B1, { "viggle native": "0" });
let txt = fs.readFileSync(path.join(B1, "components.txt"), "utf8");
check("components.txt: a header saying what 0 / 1 / 2 mean (2.355.0), then 'viggle native=0'",
  txt.startsWith("# bitGen Studio components - 0 = install it on the next start, 1 = installed, 2 = do not install")
  && /\nviggle native=0\n$/.test(txt) && C.read(B1)["viggle native"] === "0", txt);
fs.appendFileSync(path.join(B1, "components.txt"), "My Tool = 1\n");
C.write(B1, { "viggle native": "1" });
check("rewriting keeps the other lines (and reads them case / space tolerant)", C.read(B1)["viggle native"] === "1" && C.read(B1)["my tool"] === "1");
const D = (o) => C.decide({ key: "viggle native", installed: false, current: "0", busy: false, allowed: true, ...o });
check("2.355.0: 0 -> install; 1 -> nothing (even when its files are gone - said); 2 -> do not install; installed -> 1 (a 2 installed by hand too)",
  D({ current: "0" }).action === "install" && D({ current: "1" }).action === "none" && D({ current: "1" }).value === "1"
  && /set it to 0 to install it again/.test(D({ current: "1" }).why) && D({ current: "2" }).action === "none" && D({ current: "2" }).value === "2"
  && D({ current: "2", installed: true }).value === "1" && C.isSkip("2"));
check("the decision: not installed -> 0 + install; installed -> 1; skip -> kept, nothing; busy -> no second install; not allowed -> 0 only",
  D({}).action === "install" && D({}).value === "0" && D({ installed: true }).value === "1" && D({ installed: true }).action === "none"
  && D({ current: "skip" }).action === "none" && D({ current: "skip" }).value === "skip" && D({ current: "OFF" }).action === "none"
  && D({ busy: true }).action === "none" && D({ allowed: false }).action === "none" && D({ current: undefined }).action === "install");

// ---- 2. the workflow's models
const api = { 1: { class_type: "UNETLoader", inputs: { unet_name: "viggle\\minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors" } },
  2: { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "viggle_animate_dmd_lora_r64.safetensors", model: ["1", 0] } },
  3: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_int8_convrot.safetensors" } },
  4: { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_nvfp4.safetensors" } } };
const ui = { nodes: [{ type: "VAELoader", widgets_values: ["MiniMax-H3-audio_vae.safetensors"] }, { type: "X", widgets_values: [3, "text"] }] };
check("namesIn: the model files an API graph and a UI export name", NE.namesIn(api).length === 4
  && JSON.stringify(NE.namesIn(ui)) === '["MiniMax-H3-audio_vae.safetensors"]');
const B2 = path.join(tmp, "b2");
touch(path.join(B2, "comfy_workflows", "viggle_animate_h3_api.json"), JSON.stringify(api));
touch(path.join(B2, "comfy_workflows", "a_scene.json"), JSON.stringify({ ...ui, nodes: ui.nodes.concat([{ widgets_values: ["other_minimax_h3_video_vae_bf16.safetensors"] }]) }));
touch(path.join(B2, "comfy_workflows", "e2e_api.json"), JSON.stringify({ 1: { inputs: { vae_name: "minimax_h3_audio_vae_e2e.safetensors" } } }));
const wm = NE.workflowModels(B2);
check("workflowModels: the Viggle workflow first (its video VAE wins over a scene graph's), the audio VAE from another workflow, "
  + "an nvfp4 file and the e2e graphs skipped",
  wm.viggle.name.endsWith("minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors") && wm.viggle.workflow === "viggle_animate_h3_api.json"
  && wm.vae.name === "minimax_h3_video_vae_int8_convrot.safetensors" && wm.audio_vae.name === "MiniMax-H3-audio_vae.safetensors"
  && wm.audio_vae.workflow === "a_scene.json" && wm.viggle_lora.name === "viggle_animate_dmd_lora_r64.safetensors", wm);
const CM = path.join(tmp, "ComfyUI", "models");
touch(path.join(CM, "diffusion_models", "viggle", "minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors"));
touch(path.join(CM, "diffusion_models", "another_viggle_int8.safetensors"));
touch(path.join(CM, "loras", "viggle_animate_dmd_lora_r64.safetensors"));
touch(path.join(CM, "vae", "minimax_h3_video_vae_int8_convrot.safetensors"));
const roots = NE.comfyRoots(path.join(tmp, "ComfyUI"), {}, null);
const wf = NE.workflowFiles(B2, roots);
check("workflowFiles: the named files found in ComfyUI's folders (a subfolder, written with \\ in the workflow); the audio VAE it names is not there",
  wf.viggle.file === path.join(CM, "diffusion_models", "viggle", "minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors")
  && wf.viggle_lora && wf.vae && !wf.audio_vae, wf);
const cands = NE.withWorkflow(NE.candidates(roots), wf);
check("the workflow's file is the first candidate", cands.viggle[0] === wf.viggle.file && cands.viggle.length === 2);
const P = NE.paths({ dir: path.join(tmp, "w") }, tmp, "/m", null);
let res = NE.resolve(NE.cfgOf({}), P, cands, wf);
check("resolve: each component knows the workflow file (not checked yet); fetchList does NOT download them - only base, the audio VAE, "
  + "Viggle's prompt embedding (no 66 GB transformer, no 10 GB VAE, no LoRA)",
  res.viggle.workflow.from === "viggle_animate_h3_api.json" && res.viggle.how === "unchecked"
  && NE.fetchList(res, "viggle").join() === "base,audio_vae,viggle_assets", NE.fetchList(res, "viggle"));
const checks = {};
for (const f of cands.viggle) checks[NE.fileKey(f)] = { ok: true, why: "ok" };
checks[NE.fileKey(wf.viggle_lora.file)] = { ok: false, why: "not a LoRA the engine reads" };
res = NE.resolve(NE.cfgOf({ native: { checks } }), P, cands, wf);
check("checked: of two readable Viggle files the workflow's one is used; a workflow LoRA that FAILED its check is downloaded - on its own "
  + "(viggle_lora, 2.5 GB, not the 66 GB viggle download)",
  res.viggle.file === wf.viggle.file && res.viggle.how === "comfy" && NE.fetchList(res, "viggle").join() === "base,audio_vae,viggle_lora,viggle_assets",
  NE.fetchList(res, "viggle"));

// ---- 3. the start check + the install, end to end on a temp install
const core = require(path.join(ROOT, "lib", "core"));
const B3 = path.join(tmp, "b3");
touch(path.join(B3, "comfy_workflows", "viggle_animate_h3_api.json"), JSON.stringify({ ...api, 4: undefined }));
touch(path.join(B3, "comfy_workflows", "scene.json"), JSON.stringify({ 9: { inputs: { vae_name: "MiniMax-H3-audio_vae.safetensors" } } }));
touch(path.join(CM, "vae", "MiniMax-H3-audio_vae.safetensors"));
const W = path.join(tmp, "weights"), V = path.join(tmp, "venv");
const py = path.join(V, process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
const conf = { engine: { comfy: { dir: path.join(tmp, "ComfyUI") } }, native: { dir: W, venv: V }, hf: {} };
const saved = { BASE: core.BASE, getConfig: core.getConfig, setConfig: core.setConfig, makeJob: core.makeJob };
const jobs = new Map(), made = [];
core.BASE = B3;
core.getConfig = () => conf;
core.setConfig = (c) => { Object.assign(conf, c); };
core.makeJob = (p) => { const j = { id: "j" + (made.length + 1), params: p, status: "queued", log: [] }; made.push(p); jobs.set(j.id, j); core.order.push(j.id); return j; };
const realJobs = core.jobs;
const orderLen = core.order.length;
Object.defineProperty(core, "jobs", { value: jobs, configurable: true, writable: true });
const prevE2E = process.env.H3_E2E;
delete process.env.H3_E2E;
const RC = require(path.join(ROOT, "routes", "components"));
const RN = require(path.join(ROOT, "routes", "native"));
(async () => {
  try {
    const quiet = [];
    let out = await RC.check({ say: (m) => quiet.push(m) });
    const p1 = made[0] || {};
    check("start, nothing installed: components.txt says viggle native=0 and ONE install is queued (on start) - the venv + only base and "
      + "Viggle's prompt embedding; the Viggle model, its DMD LoRA and both VAEs come from the ComfyUI files the workflows name",
      C.read(B3)["viggle native"] === "0" && made.length === 1 && p1.mode === "install_native"
      && JSON.stringify(p1.fetch_components) === '["base","viggle_assets"]' && Object.keys(p1.comfy_files).sort().join() === "audio_vae,vae,viggle,viggle_lora"
      && /\(on start - components\.txt\)/.test(p1.prompt) && /your ComfyUI files \(named in viggle_animate_h3_api\.json, scene\.json\)/.test(p1.prompt)
      && quiet.some((m) => /viggle native is not installed - installing it - with your ComfyUI files/.test(m)), { p1, quiet, file: C.read(B3) });
    out = await RC.check({ say: () => {} });
    check("a second start while it runs: no second install", made.length === 1 && out.decisions["viggle native"].why.includes("already running"));
    // the install "ran": the venv (a python that answers like check.py, the LoRA made unreadable) + base + the embedding
    fs.mkdirSync(path.dirname(py), { recursive: true });
    fs.writeFileSync(py, `#!/bin/sh\nexec python3 ${JSON.stringify(path.join(ROOT, "scripts", "stub-native-server.py"))} --check "$@"\n`);
    fs.chmodSync(py, 0o755);
    const lora = path.join(CM, "loras", "viggle_animate_dmd_lora_r64.safetensors");
    fs.renameSync(lora, path.join(CM, "loras", "viggle_animate_dmd_lora_r64_unreadable.safetensors"));
    fs.writeFileSync(path.join(B3, "comfy_workflows", "viggle_animate_h3_api.json"),
      JSON.stringify({ ...api, 2: { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "viggle_animate_dmd_lora_r64_unreadable.safetensors" } }, 4: undefined }));
    for (const f of ["MiniMax-H3/modular_model_index.json", "MiniMax-H3/transformer_ref/config.json", "Viggle-Animate/assets/fixed_embed_fwd_anyframe.pt"]) touch(path.join(W, f));
    jobs.get("j1").status = "done"; jobs.get("j1").finished = Date.now() / 1000;
    await RN.afterInstall("j1", false);
    const p2 = made[1] || {};
    check("after the install: the ComfyUI files are checked; the one the engine cannot read (the LoRA) is downloaded by ONE follow-up install - "
      + "just viggle_lora; components.txt still 0",
      made.length === 2 && JSON.stringify(p2.fetch_components) === '["viggle_lora"]' && C.read(B3)["viggle native"] === "0"
      && jobs.get("j1").log.some((m) => /the engine cannot use viggle_lora from ComfyUI - downloading it/.test(m)), { p2, log: jobs.get("j1").log });
    touch(path.join(W, "Viggle-Animate", "lora", "pytorch_lora_weights.safetensors"));
    jobs.get("j2").status = "done"; jobs.get("j2").finished = Date.now() / 1000;
    await RN.afterInstall("j2", true);
    const st = RN.statusView();
    check("after the follow-up: installed - the Viggle model + both VAEs from ComfyUI, the LoRA and the small parts downloaded; components.txt says 1",
      C.read(B3)["viggle native"] === "1" && made.length === 2 && st.viggle.ready
      && st.components.find((c) => c.id === "viggle").how === "comfy" && st.components.find((c) => c.id === "viggle_lora").how === "official", st.viggle);
    out = await RC.check({ say: () => {} });
    check("the next start: installed -> 1, nothing queued", out.values["viggle native"] === "1" && made.length === 2);
    C.write(B3, { "viggle native": "skip" });
    fs.rmSync(path.join(W, "Viggle-Animate", "assets"), { recursive: true });
    out = await RC.check({ say: () => {} });
    check("skip in components.txt: kept, and nothing installed on start even when a part is missing",
      out.values["viggle native"] === "skip" && made.length === 2 && out.decisions["viggle native"].action === "none");
    C.write(B3, { "viggle native": "0" });
    process.env.H3_E2E = "1";
    out = await RC.check({ say: () => {} });
    check("the test server (H3_E2E) never installs on start: 0 written, nothing queued", out.values["viggle native"] === "0" && made.length === 2
      && /install on start is off here/.test(out.decisions["viggle native"].why));
    process.env.BITGEN_COMPONENTS_INSTALL = "1";
    check("...unless BITGEN_COMPONENTS_INSTALL=1", RC.allowed() === true);
    delete process.env.BITGEN_COMPONENTS_INSTALL;
  } catch (e) {
    check("the end-to-end run threw", false, String(e && e.stack || e));
  } finally {
    core.BASE = saved.BASE; core.getConfig = saved.getConfig; core.setConfig = saved.setConfig; core.makeJob = saved.makeJob;
    Object.defineProperty(core, "jobs", { value: realJobs, configurable: true, writable: true });
    core.order.length = orderLen;
    if (prevE2E === undefined) delete process.env.H3_E2E; else process.env.H3_E2E = prevE2E;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // ---- 4. 2.355.0: the setup wizard's Viggle (native) box
  {
    const S = require(path.join(ROOT, "lib", "setupRun"));
    const R4 = fs.mkdtempSync(path.join(os.tmpdir(), "comp4_"));
    fs.mkdirSync(path.join(R4, "comfy_workflows"));
    const plan = S.vigglePlan("", R4);
    check("setup: the size to download - the Python environment (~5 GB) + every model part when nothing is there (~79.5 GB)",
      !plan.installed && plan.venv_gb === S.VENV_GB && plan.gb > 70 && Math.abs(plan.total_gb - (plan.gb + S.VENV_GB)) < 0.11, plan);
    const lines = [];
    let r4 = S.viggleChoice(false, (m) => lines.push(m), R4);
    check("setup, box unticked: components.txt viggle native=2 (do not install), said", r4.value === "2" && C.read(R4)["viggle native"] === "2"
      && /viggle native=2/.test(lines[0]), lines);
    r4 = S.viggleChoice(true, (m) => lines.push(m), R4);
    check("setup, box ticked: viggle native=0 - the first start installs it; the size said", r4.value === "0" && C.read(R4)["viggle native"] === "0"
      && /installs when the studio opens - ~[0-9.]+ GB/.test(lines[1]), lines);
    fs.rmSync(R4, { recursive: true, force: true });
    const H = fs.readFileSync(path.join(ROOT, "electron", "installer.html"), "utf8");
    const SR = fs.readFileSync(path.join(ROOT, "lib", "setupRun.js"), "utf8");
    const CLI = fs.readFileSync(path.join(ROOT, "scripts", "setup-cli.js"), "utf8");
    check("the wizard: an unticked Viggle (native) box with the download size (less with an existing ComfyUI's Viggle files), sent as plan.viggle; "
      + "setup writes it in the settings step; the CLI has --viggle / --no-viggle",
      H.includes('<input type="checkbox" id="cb_viggle">') && H.includes("Download: ~${v.total_gb} GB") && H.includes("viggleNote(r.viggle);")
      && H.includes('viggle: $("cb_viggle").checked };') && SR.includes('if (typeof p.viggle === "boolean") results.viggle = viggleChoice(p.viggle, say);')
      && SR.includes("viggle: vigglePlan(r.root) };") && CLI.includes('else if (a === "--viggle") o.viggle = true;') && /viggle: o\.viggle(, *\n? *package: o\.package, hw: o\.hw)? \}, show\);/.test(CLI));   // 2.519.0: + the package / the answers
  }
  // ---- 5. the wiring
  const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
  const GI = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  check("wiring: routes/components mounted from routes/index.js (not server.js); components.txt is per machine (.gitignore)",
    IDX.includes('require("./components").mount(app);') && !fs.readFileSync(path.join(ROOT, "misc", "server.js"), "utf8").includes("components")
    && /\ncomponents\.txt\n/.test(GI));
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
