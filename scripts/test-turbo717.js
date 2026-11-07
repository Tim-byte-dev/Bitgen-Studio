#!/usr/bin/env node
/* bitGen Studio — 2.717.0: THE FASTER FIRST FRAMES + the accelerator fixes, the app's side (no ComfyUI needed).
 * Tim: "can we add the faster 8 step turbo model and fix the problems he talked about" - then, asked which route
 * (Qwen Image 2.1 and the Turbo8 LoRA are both under the Qwen Research License - non-commercial only): "Both,
 * commercial-safe default". The worker's side (Veda / Long video / Spectrum): scripts/test-turbo717.py. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const S = require("../lib/styles");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const t8 = S.STARTER_STYLES.find((s) => s.name === "Qwen Image 2.1 edit Turbo8");
check("a starter style 'Qwen Image 2.1 edit Turbo8': the Qwen 2.1 edit graph, 8 steps, cfg 1, the Turbo8 LoRA at 1",
  t8 && t8.workflow === "comfy_workflows/img_qwen21_edit.json" && t8.steps === 8 && t8.cfg === 1 && t8.loras.length === 1 && t8.loras[0].path === "turbo8_lora_step2500.safetensors" && t8.loras[0].weight === 1, t8);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t717-"));
S.seedStarters(tmp);
const seeded = S.read(tmp, "image").find((s) => s.name === "Qwen Image 2.1 edit Turbo8");
check("…seeded into a styles folder (a running install gets it on restart)", seeded && seeded.steps === 8 && seeded.loras[0].path === "turbo8_lora_step2500.safetensors", seeded);
fs.rmSync(tmp, { recursive: true, force: true });
const cat = JSON.parse(rd("lib/modelCatalog.json")).models, by = (id) => cat.find((m) => m.id === id) || {};
check("the model catalog: the Turbo8 LoRA (chriswritescode/Turbo8-LoRA-Qwen-Image-2.1 -> comfy/loras), marked non-commercial",
  by("qwen21_turbo8").repo === "chriswritescode/Turbo8-LoRA-Qwen-Image-2.1" && by("qwen21_turbo8").file === "turbo8_lora_step2500.safetensors" && by("qwen21_turbo8").dest === "comfy/loras" && /non-commercial/.test(by("qwen21_turbo8").for));
check("…Qwen Image 2.1 says non-commercial; the 2511 Lightning LoRA says commercial use is fine (Apache 2.0)", /non-commercial/.test(by("qwen21").for) && /Apache 2\.0/.test(by("qwen_lightning").for));

// the first frame's default
const R = require("../routes/sceneedit"), A = require("../lib/aiEdit"), styles = require("../lib/styles"), M = require("../lib/setupModels");
const fake = [{ id: "a", name: "Qwen Image 2.1 edit" }, { id: "b", name: "Qwen Image Edit 2511" }, { id: "c", name: "Qwen Image 2.1 edit Turbo8" }, { id: "d", name: "FLUX.1 Kontext edit" }];
const keep = { engines: A.engines, read: styles.read, present: M.present };
A.engines = () => ({ edit: fake }); styles.read = () => [];
M.present = () => true;
let e = R.editEngines();
check("editEngines with Qwen Image Edit 2511 installed: the default is 2511 (commercial-safe), 'wide' = Qwen Image 2.1 edit (not Turbo8)", e.default === "b" && e.wide === "a", e);
M.present = () => false;
e = R.editEngines();
check("…without 2511 on disk (a 20 GB model - the full package): Qwen Image 2.1 edit stays the default", e.default === "a" && e.wide === "a", e);
Object.assign(A, { engines: keep.engines }); styles.read = keep.read; M.present = keep.present;
const RT = rd("routes/sceneedit.js");
check("the run: a blank pick = Auto; more than three pictures -> Qwen 2.1 edit with a non-commercial note; 2511 gets picture slots added (composePlan) and the prompt in its own words (Picture n)",
  RT.includes('const chosen = String(b.style_id || q.style_id || "")') && RT.includes("Qwen Research License: non-commercial use only") && RT.includes("aiEdit.composePlan(style, pl.images.length, core.BASE)")
  && RT.includes('require("../lib/refWords").retag(pl.prompt, wording)') && RT.includes("if (b.style_id) q.style_id"));
const W = require("../lib/refWords");
check("refWords.retag: the planner's <image2> becomes 2511's Picture 2", /Picture 2/.test(W.retag("Put the woman from <image2> into <image1>.", "picture")));
// the video style
check("a video style keeps veda_action only as keep (the default = big-motion shots skip Veda)",
  S.normVideoAccel({ veda: "on", veda_action: "keep" }).veda_action === "keep" && !("veda_action" in S.normVideoAccel({ veda: "on", veda_action: "skip" })) && !("veda_action" in S.normVideoAccel({ veda: "off", veda_action: "keep" })));
const H = rd("static/index.html");
check("the video style's 'Veda on action shots too' (#s_vsvedaaction): read into accel.veda_action, set when a style opens",
  H.includes('id="s_vsvedaaction"') && H.includes('veda_action: $("s_vsvedaaction") && $("s_vsvedaaction").checked ? "keep" : "skip"') && H.includes('$("s_vsvedaaction").checked = vac.veda_action === "keep"'));
const Q = rd("ext/videodock/qedit.js");
check("the scene card's style list starts with Auto (value \"\", named after the default)", Q.includes('<option value=""') && Q.includes("Auto - "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
