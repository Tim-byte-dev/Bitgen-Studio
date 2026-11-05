#!/usr/bin/env node
/* bitGen Studio — 2.678.0: P-H3 IMAGE - the add-on (lib/ph3Addon.js), the catalog (group ph3 + the MiniMax H3 FL2VA it
 * shares with the video), the image architecture + the two starter styles, the guard (routes/ph3Guard.js), an EDIT model
 * for the editor / the preview's 🎨 Style (lib/aiEdit.js). The workflows: scripts/test-ph3678.py.
 * Tim (verbatim): "please add this image edit model, https://huggingface.co/PrunaAI/P-H3-Image-Comfy" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const P = require(path.join(ROOT, "lib", "ph3Addon.js")), M = require(path.join(ROOT, "lib", "setupModels.js"));
const cat = JSON.parse(read("lib/modelCatalog.json")), ph3 = cat.models.filter((m) => m.group === "ph3");
check("the catalog: P-H3's LoRA, int8 text encoder, int8 VAE, w4a8 prompt upsampler from PrunaAI/P-H3-Image-Comfy - in ComfyUI's loras / text_encoders / vae",
  ph3.map((m) => m.as).join() === "p-h3-image_lora_bf16.safetensors,p-h3-image_text_encoder_int8_convrot.safetensors,p-h3-image_vae_int8_convrot.safetensors,p-h3-image_prompt_upsampler_w4a8.safetensors"
  && ph3.every((m) => m.repo === "PrunaAI/P-H3-Image-Comfy" && m.size > 1e9) && ph3.map((m) => m.dest).join() === "comfy/loras,comfy/text_encoders,comfy/vae,comfy/text_encoders" && cat.groups.some((g) => g.id === "ph3"), ph3);
check("the add-on: everything needed (LoRA, text encoder, VAE, upsampler + the MiniMax H3 FL2VA the video already has)", P.wanted([]).join() === "lora,te,vae,up,h3" && P.ITEMS.find((i) => i.id === "h3").files[0] === "h3_fl2va" && M.byId("h3_fl2va").group === "video");
(async () => {
  const log = [], got = [], made = [];
  const r = await P.install((l) => log.push(l), [], { place: { ok: true, models: "/x/models" }, download: async (m) => { got.push(m.id); return { ok: true, skipped: m.id === "h3_fl2va" }; }, styles: (n) => { made.push(...n); return n; }, comfy: async () => ({ online: true, ph3: false }) });
  check("install: the four P-H3 files + the transformer (\"already there\" when the video has it), the two styles back, the licence said", r.ok && got.join() === "ph3_lora,ph3_te,ph3_vae,ph3_up,h3_fl2va" && made.join() === "P-H3 Image,P-H3 Image Edit" && log.some((l) => /h3_fl2va_pruned_int8_convrot\.safetensors \(already there\)/.test(l)) && log.some((l) => /MiniMax H3 Community License/.test(l)), log);
  check("…a ComfyUI without the P-H3 nodes: said (update to the nightly / 0.44)", log.some((l) => /no PH3ImageConditioning node/.test(l) && /nightly/.test(l)));
  const fake = (has) => async (u) => ({ ok: /system_stats/.test(u) || has, json: async () => (has ? { PH3ImageConditioning: {} } : {}) });
  const yes = await P.comfySupport({ url: "http://c", fetch: fake(true) }), no = await P.comfySupport({ url: "http://c", fetch: fake(false) });
  check("comfySupport: /object_info/PH3ImageConditioning there = ph3; a 404 on a running ComfyUI = online, no ph3", yes.online && yes.ph3 && no.online && !no.ph3 && P.missingMessage(yes) === null && /cannot run P-H3 Image/.test(P.missingMessage(no)) && P.missingMessage({ online: false }) === null);
  const lr = []; const rm = await P.remove((l) => lr.push(l), { models: "/nowhere/models" });
  check("remove: P-H3's own files only - the MiniMax H3 transformer stays (the video needs it)", rm.ok && /the MiniMax H3 transformer stays/.test(lr.join("\n")));
  const A = JSON.parse(read("lib/imageArch.json")).archs.find((a) => a.id === "ph3");
  check("the architecture ph3: ComfyUI only, no negative, 8 steps / cfg 1, 2048 x 2048", A && A.comfy_only && A.negative === false && A.defaults.steps === 8 && A.defaults.cfg === 1 && A.defaults.width === 2048);
  const s1 = JSON.parse(read("styles/image/P-H3 Image.json")), s2 = JSON.parse(read("styles/image/P-H3 Image Edit.json"));
  check("the starter styles: P-H3 Image (text to image) + P-H3 Image Edit, arch ph3, their workflows", s1.arch === "ph3" && s1.workflow === "comfy_workflows/img_ph3_t2i.json" && s2.workflow === "comfy_workflows/img_ph3_edit.json" && s2.name === "P-H3 Image Edit");
  const AE = require(path.join(ROOT, "lib", "aiEdit.js"));
  let e1 = null, e2 = ""; try { e1 = AE.editGraph(s2, ROOT); } catch (e) { e1 = null; } try { AE.editGraph(s1, ROOT); } catch (e) { e2 = e.message; }
  check("P-H3 Image Edit is an EDIT model (the image editor's ✨ Edit, the preview's 🎨 Style): 8 picture slots; the text-to-image style is not", e1 && e1.slots === 8 && /cannot follow an edit instruction/.test(e2), e1);
  const IX = read("routes/index.js"), G = read("routes/ph3Guard.js"), AD = read("lib/addons.js");
  check("the guard (routes/ph3Guard.js) before POST /api/genimage refuses arch ph3 on a ComfyUI without the nodes (409); the add-on registered; never server.js",
    /require\("\.\/ph3Guard"\)\.mount\(app\)/.test(IX) && /style\.arch !== "ph3"/.test(G) && /res\.status\(409\)/.test(G) && /id: "ph3", label: "P-H3 Image/.test(AD) && !/ph3/i.test(read("misc/server.js")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
