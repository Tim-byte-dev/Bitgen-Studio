#!/usr/bin/env node
/* bitGen Studio — 2.685.0: A WHOLE-PICTURE REFINE (THE IMAGE PREVIEW'S 🎨 CHANGE STYLE) IS IMAGE TO IMAGE WITH THE STYLE'S OWN
 * GRAPH - lib/infill.js whole(), lib/aiEdit.js plan(); lib/imgOverride.js summary(). A checkpoint style (SDXL / Pony /
 * Illustrious) used to fall to the SDXL inpaint export run as exported, which dropped the style's model + LoRAs and Basic
 * Settings' Override. The jobs themselves: scripts/test-ui685-ui.js.
 * Tim (verbatim): "i don't think the overide style in basic settings is being used in the preview change style" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const infill = require(path.join(ROOT, "lib", "infill.js")), aiEdit = require(path.join(ROOT, "lib", "aiEdit.js")), IO = require(path.join(ROOT, "lib", "imgOverride.js"));

const base = fs.mkdtempSync(path.join(os.tmpdir(), "rs685-"));
fs.mkdirSync(path.join(base, "comfy_workflows"));
const T2I = { "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sdxl.safetensors" } },
  "5": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["3", 1] } }, "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["3", 1] } },
  "7": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "8": { class_type: "KSampler", inputs: { model: ["3", 0], positive: ["5", 0], negative: ["6", 0], latent_image: ["7", 0], seed: 0, steps: 25, cfg: 6, sampler_name: "euler", scheduler: "normal", denoise: 1 } },
  "9": { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 2] } }, "10": { class_type: "SaveImage", inputs: { images: ["9", 0] } } };
fs.writeFileSync(path.join(base, "comfy_workflows", "t2i.json"), JSON.stringify(T2I));
const sdxl = { id: "st_x", name: "Illustrious", engine: "comfy", kind: "image", workflow: "comfy_workflows/t2i.json", model: "ill.safetensors", loras: [] };

const w = infill.whole(sdxl, base);
const cl = w && Object.values(w.graph).map((n) => n.class_type);
check("whole(): a checkpoint style's own graph, the picture as the starting latent (VAEEncode -> SetLatentNoiseMask), no empty latent left, not self-contained",
  w && w.whole && !w.selfContained && w.input === "crop+mask" && cl.includes("VAEEncode") && cl.includes("SetLatentNoiseMask") && !cl.includes("EmptyLatentImage") && w.workflow === sdxl.workflow, w && { cl, sc: w.selfContained });
check("whole(): a graph it cannot use (no empty latent) / an sd-cli style = null (resolve() as before)",
  infill.whole({ engine: "comfy", workflow: "comfy_workflows/none.json" }, base) === null && infill.whole(Object.assign({}, sdxl, { engine: "sdcli" }), base) === null);
const pl = aiEdit.plan(sdxl, { mode: "refine", whole: "1", strength: "70", prompt: "anime style" }, base, null);
check("plan(): Refine over the WHOLE picture with a checkpoint style = that image-to-image plan at the strength (0.70), the style's model kept for the worker",
  pl.whole && !pl.selfContained && pl.denoise === 0.7 && pl.graph && /style's own graph t2i\.json/.test(pl.note), { whole: pl.whole, sc: pl.selfContained, d: pl.denoise, note: pl.note });
let threw = ""; try { aiEdit.plan(sdxl, { mode: "refine", strength: "70", prompt: "x" }, base, null); } catch (e) { threw = e.message; }
check("plan(): a Refine in a SELECTION (no whole) still takes resolve()'s inpaint path (here: none -> said in words)", /no inpaint path/.test(threw), threw);
let ed = null, edErr = ""; try { ed = aiEdit.plan(sdxl, { mode: "generate", whole: "1", prompt: "x" }, base, null); } catch (e) { edErr = e.message; }
check("plan(): only Refine changes - Generate over the whole picture keeps resolve() (here: no inpaint path, said)", !(ed && ed.whole) && /no inpaint path/.test(edErr), { ed, edErr });
check("summary(): steps, CFG, the checkpoint's file name, temporary LoRAs - empty when nothing rode along",
  IO.summary({ steps: 37, cfg: 3.3, styled: { model_override: true, model: "checkpoints\\SDXL/jugg.safetensors" } }, 2) === "steps 37, CFG 3.3, checkpoint jugg.safetensors, 2 temporary LoRAs"
  && IO.summary({ steps: null, cfg: null, styled: {} }, 0) === "" && IO.summary(null, 1) === "");
const R = fs.readFileSync(path.join(ROOT, "routes", "aiedit.js"), "utf8"), L = fs.readFileSync(path.join(ROOT, "static", "lbrestyle.js"), "utf8");
check("wired: /api/aiedit answers `override` {applied, note}; the preview says it (Override: …) while it renders",
  /override: ovInfo/.test(R) && /IO\.summary\(ov,/.test(R) && /j\.override/.test(L) && /" · Override: "/.test(L));
fs.rmSync(base, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
