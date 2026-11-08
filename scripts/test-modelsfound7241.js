#!/usr/bin/env node
/* bitGen Studio — 2.724.1: A CATALOGUE MODEL SAVED UNDER ANOTHER NAME IS OFFERED FOR DOWNLOAD (lib/modelsFound.js sourceOf).
 * Tim's "Models not found" box: "yue2_convrot_int8.safetensors goes in models/checkpoints (the style) - Not in bitGen's
 * download list - download it yourself (Civitai, Hugging Face) into models/checkpoints". The catalogue HAS it: it downloads
 * checkpoints/yue2_3b_int8_convrot.safetensors and saves it AS yue2_convrot_int8.safetensors (lib/setupModels.js:
 * m.as || basename(m.file)) - sourceOf only compared the download's own name. Now: the saved name.
 *   every catalogue entry with "as" is found by that name; a download's own name that is NOT what it is saved as is not
 *   matched (diffusion_pytorch_model.safetensors is four xinsir ControlNets); the YuE2 ComfyUI style's checkpoint, missing
 *   from a ComfyUI folder, comes with ⬇ Download (yue2); entries without "as" unchanged (the Turbo8 LoRA). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mf7241-"));
process.env.BITGEN_MODELS_FOUND = path.join(tmp, "misc", "models_found.json");
const MF = require("../lib/modelsFound");
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "modelCatalog.json"), "utf8"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const y = MF.sourceOf("yue2_convrot_int8.safetensors", CAT);
check("Tim's box: yue2_convrot_int8.safetensors = the catalogue's YuE2 3B (int8), from Comfy-Org/YuE2 into comfy/checkpoints", y && y.id === "yue2" && y.repo === "Comfy-Org/YuE2" && y.dest === "comfy/checkpoints" && y.size > 3e9, y);
check("…in a sub-folder / with Windows separators too", (MF.sourceOf("music\\yue2_convrot_int8.safetensors", CAT) || {}).id === "yue2");
const renamed = CAT.models.filter((m) => m.as && m.dest !== "hf-cache");
const saved = (m) => String(m.as || m.file).split("/").pop();
const wrong = renamed.filter((m) => { const s = MF.sourceOf(m.as, CAT); return !s || saved(CAT.models.find((x) => x.id === s.id)) !== m.as; });
check("every catalogue entry saved under another name (" + renamed.length + ") is found by the name it is saved as (the same file listed twice, e.g. flux2-vae, = the first)", renamed.length >= 10 && wrong.length === 0, wrong.map((m) => m.id));
check("…e.g. the H3 latent upscaler, the xinsir OpenPose ControlNet, the Klein outpaint LoRA",
  (MF.sourceOf("minimax_h3_latent_upscaler_3d_bf16.safetensors", CAT) || {}).id === "h3_latent_up" && (MF.sourceOf("xinsir-openpose-sdxl.safetensors", CAT) || {}).id === "cn_sdxl_openpose"
  && (MF.sourceOf("flux-2-klein-4B-outpaint-lora.safetensors", CAT) || {}).id === "klein4b_outpaint");
check("a download's own name that is not what it is saved as matches nothing (diffusion_pytorch_model.safetensors - four ControlNets)", MF.sourceOf("diffusion_pytorch_model.safetensors", CAT) === null && MF.sourceOf("yue2_3b_int8_convrot.safetensors", CAT) === null);
check("entries without 'as' as before (the Turbo8 LoRA); an unknown name = null", (MF.sourceOf("turbo8_lora_step2500.safetensors", CAT) || {}).id === "qwen21_turbo8" && MF.sourceOf("nope.safetensors", CAT) === null);

// the YuE2 ComfyUI style through check(): missing from a ComfyUI folder -> offered with ⬇ Download
const st = (require("../lib/styles").STARTER_STYLES || []).find((s) => s.name === "YuE2 ComfyUI");   // the shipped style
const style = st;
check("the shipped YuE2 ComfyUI style loads yue2_convrot_int8.safetensors (lib/styles.js)", !!st && st.model === "yue2_convrot_int8.safetensors" && /audio_yue2\.json$/.test(st.workflow || ""), st);
const comfy = path.join(tmp, "ComfyUI");
fs.mkdirSync(path.join(comfy, "models", "checkpoints"), { recursive: true });
MF.target = () => ({ dir: comfy, extraPaths: "", remote: false, why: "" });
const graph = JSON.parse(fs.readFileSync(path.join(ROOT, style.workflow || "comfy_workflows/audio_yue2.json"), "utf8"));
const r = MF.check(MF.needs(graph, style, "music", {}));
const yr = (r.missing || []).find((m) => m.name === "yue2_convrot_int8.safetensors");
check("the YuE2 ComfyUI style, its checkpoint not in models/checkpoints: missing WITH a download (yue2) - the box shows ⬇ Download, not 'download it yourself'",
  r.checked && yr && yr.cat === "checkpoints" && yr.source && yr.source.id === "yue2", { checked: r.checked, why: r.why, missing: r.missing });
fs.writeFileSync(path.join(comfy, "models", "checkpoints", "yue2_convrot_int8.safetensors"), "x");
MF.build();
const r2 = MF.check(MF.needs(graph, style, "music", {}));
check("…once it is there (the download saves it under that name): not missing", r2.checked && !(r2.missing || []).some((m) => m.name === "yue2_convrot_int8.safetensors"), r2.missing);
check("lib/setupModels.js saves a download as m.as || basename(m.file) - the name sourceOf now matches", /m\.as \|\| path\.basename\(m\.file\)/.test(fs.readFileSync(path.join(ROOT, "lib", "setupModels.js"), "utf8")));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
