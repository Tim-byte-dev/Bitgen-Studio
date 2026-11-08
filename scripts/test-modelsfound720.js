#!/usr/bin/env node
/* bitGen Studio — 2.720.0: AFTER A FAILED RENDER, ARE ITS MODELS MISSING? (lib/modelsFound.js afterFail, lib/core.js)
 * Tim: "if worker exits with code 1 , check for models if models are not found ask if user wants to dl models"
 *   the names ComfyUI refused read from the log (both of its wordings), what the job's own style + workflow load (image,
 *   video, Wan), afterFail on a failed job: job.models_missing + a [models] line; a refused name that IS on disk is not
 *   missing; a job rendered on another PC / a done job / no ComfyUI folder = nothing; jobDict serves it; the wiring.
 * The box it opens: scripts/test-ui720-ui.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mf720-"));
process.env.BITGEN_MODELS_FOUND = path.join(tmp, "misc", "models_found.json");
const MF = require("../lib/modelsFound");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const names = (rows) => rows.map((r) => r.name);

// ---- the log (Tim's, word for word)
const TIM = ["[worker] ERROR: ComfyUI rejected the workflow:", "Prompt outputs failed validation",
  "  node 22: Value not in list [lora_name] = turbo8_lora_step2500.safetensors",
  "    lora_name: 'turbo8_lora_step2500.safetensors' not in (list of length 492)",
  "[bitgen-studio] worker exited with code 1."];
let n = MF.namesFromLog(TIM);
check("namesFromLog (Tim's log): turbo8_lora_step2500.safetensors once, a LoRA, refused by ComfyUI", n.length === 1 && n[0].name === "turbo8_lora_step2500.safetensors" && n[0].cat === "loras" && n[0].from === "comfyui", n);
n = MF.namesFromLog(["Value not in list [unet_name] = flux\\klein.safetensors", "clip_name2: 'clip_l.safetensors' not in ['a']", "Value not in list [ckpt_name] = sdxl/j.safetensors",
  "Value not in list [type] = flux3", "Value not in list [sampler_name] = euler_x"]);
check("…unet / clip_name2 / ckpt, each with its folder; an option ComfyUI lacks (type, sampler) is no model file",
  JSON.stringify(n.map((x) => [x.name, x.cat])) === JSON.stringify([["flux\\klein.safetensors", "diffusion_models"], ["clip_l.safetensors", "text_encoders"], ["sdxl/j.safetensors", "checkpoints"]]), n);

// ---- what a job loads
const job = { id: "j1", status: "failed", log: TIM.slice(), params: { mode: "image", workflow: "comfy_workflows/img_qwen21_edit.json",
  style: { kind: "image", engine: "comfy", workflow: "comfy_workflows/img_qwen21_edit.json", model: "", vae: "", te: [""], loras: [{ path: "turbo8_lora_step2500.safetensors", weight: 1 }] } } };
const wf = names(MF.loaderFiles(JSON.parse(rd("comfy_workflows/img_qwen21_edit.json")))).filter((x) => !/lora/i.test(x));
let rows = MF.jobNeeds(job);
check("jobNeeds (an image job): the refused LoRA + the workflow's model files, once each", names(rows).includes("turbo8_lora_step2500.safetensors") && wf.every((w) => names(rows).includes(w)) && names(rows).length === wf.length + 1, rows);
rows = MF.jobNeeds({ status: "failed", log: [], params: { mode: "ref2va", video_style: { kind: "video", arch: "wan22", phases: [{ model: "wan_hi.safetensors" }], te: [""], loras: [] } } });
check("…a Wan job: the style's own files (Wan picks the rest)", JSON.stringify(names(rows)) === JSON.stringify(["wan_hi.safetensors"]), rows);

// ---- afterFail against real folders
const comfy = path.join(tmp, "ComfyUI");
const put = (rel) => { const f = path.join(comfy, "models", rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x"); };
wf.forEach((w) => put((/vae/i.test(w) ? "vae/" : /qwen3vl|text|clip/i.test(w) ? "text_encoders/" : "diffusion_models/") + w));
fs.mkdirSync(path.join(comfy, "models", "loras"), { recursive: true });
const T = { dir: comfy, extraPaths: "", remote: false, why: "" };
MF.target = () => T;
const said = [];
const j1 = JSON.parse(JSON.stringify(job));
let r = MF.afterFail(j1, (l) => said.push(l));
check("afterFail (Tim's job, the LoRA not on disk): job.models_missing = the Turbo8 LoRA with its catalogue download", r && j1.models_missing && j1.models_missing.missing.length === 1
  && j1.models_missing.missing[0].name === "turbo8_lora_step2500.safetensors" && j1.models_missing.missing[0].source && j1.models_missing.missing[0].source.id === "qwen21_turbo8" && j1.models_missing.at > 0, j1.models_missing);
check("…and a [models] line in the job's log: which file, the app offers to download", said.length === 1 && /^\[models\] 1 model file\(s\) .*turbo8_lora_step2500\.safetensors - the app offers to download them/.test(said[0]), said);
put("loras/turbo8_lora_step2500.safetensors");
const j2 = JSON.parse(JSON.stringify(job));
check("a name ComfyUI refused that IS on disk (ComfyUI has not re-read its folders): not missing - nothing asked", MF.afterFail(j2) === null && !j2.models_missing, j2.models_missing);
fs.unlinkSync(path.join(comfy, "models", "loras", "turbo8_lora_step2500.safetensors"));
check("a job rendered on another member's PC (remote / farm): not checked here", MF.afterFail(Object.assign(JSON.parse(JSON.stringify(job)), { remote: { member: "x" } })) === null);
check("a job that did not fail: nothing", MF.afterFail(Object.assign(JSON.parse(JSON.stringify(job)), { status: "done" })) === null);
T.why = "no ComfyUI folder is set (Settings ▸ ComfyUI ▸ Folder)";
check("no ComfyUI folder here: nothing (the worker's own message stands)", MF.afterFail(JSON.parse(JSON.stringify(job))) === null);
T.why = "";
check("afterFail never throws (a job with nothing in it)", MF.afterFail({ status: "failed" }) === null && MF.afterFail(null) === null);

// ---- jobDict + the wiring
const C = require("../lib/core");
check("jobDict serves models_missing (null when nothing is missing)", C.jobDict(Object.assign({ log: [] }, j1)).models_missing === j1.models_missing && C.jobDict({ id: "x", log: [], params: {} }).models_missing === null);
const core = rd("lib/core.js"), i = core.indexOf("worker exited with code ${code}.");
check("lib/core.js: a failed job (the worker's error exit) runs afterFail right after the exit line", i > 0 && /require\("\.\/modelsFound"\)\.afterFail\(job, \(l\) => log\(job, l\)\)/.test(core.slice(i, i + 600)));
check("POST /api/models/check {job_id} checks that job again (after ⬇ Download)", /if \(b\.job_id\)/.test(rd("routes/modelsFound.js")) && /MF\.check\(MF\.jobNeeds\(job\)\)/.test(rd("routes/modelsFound.js")));
check("the queue's poll hands the job list to H3ModelsFound.watchJobs", /H3ModelsFound\.watchJobs\(list\)/.test(rd("static/index.html")));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
