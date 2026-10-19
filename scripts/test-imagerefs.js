#!/usr/bin/env node
// lib/imageRefs.js — a FLUX.2 Klein 9B t2i style renders with the reference dock (2.105.0).
// node scripts/test-imagerefs.js
const fs = require("fs"), os = require("os"), path = require("path");
const R = require(path.join(__dirname, "..", "lib", "imageRefs"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const ROOT = path.join(__dirname, "..");

const klein = (wf) => ({ engine: "comfy", arch: "flux2klein9b", workflow: wf });
check("isKlein9b: arch or model file name", R.isKlein9b(klein("x")) && R.isKlein9b({ engine: "comfy", arch: "flux", model: "flux2-klein-9b.safetensors" })
  && !R.isKlein9b({ engine: "comfy", arch: "sdxl", model: "pony.safetensors" }) && !R.isKlein9b({ engine: "sdcli", arch: "flux2klein9b" }), null);

const r1 = R.resolve(klein("comfy_workflows/img_flux2_9b_t2i_verified.json"), 2, ROOT);
check("verified t2i + 2 pictures -> verified edit (2 slots), swapped, with a note naming both graphs",
  r1.swapped && r1.workflow.endsWith("img_flux2_9b_edit_verified.json") && r1.slots === 2 && /instead of img_flux2_9b_t2i_verified/.test(r1.note), r1);
const r2 = R.resolve(klein("comfy_workflows/img_flux2_klein_9b_t2i.json"), 1, ROOT);
check("klein t2i -> klein edit (3 slots)", r2.swapped && r2.workflow.endsWith("img_flux2_klein_edit_9b.json") && r2.slots === 3, r2);
const r3 = R.resolve(klein("comfy_workflows/img_flux2_klein_9b_t2i.json"), 0, ROOT);
check("no pictures -> no swap, no note", !r3.swapped && r3.workflow.endsWith("img_flux2_klein_9b_t2i.json") && r3.note === "", r3);
const r4 = R.resolve({ engine: "comfy", arch: "sdxl", workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json" }, 2, ROOT);
check("not Klein -> never swapped (other families keep the slots rule)", !r4.swapped && r4.note === "", r4);
const r5 = R.resolve(klein("comfy_workflows/img_flux2_klein_edit_9b.json"), 2, ROOT);
check("a style that already has slots is left alone", !r5.swapped && r5.slots === 3, r5);
const r6 = R.resolve(klein("comfy_workflows/img_flux2_klein_9b_ckpt_t2i.json"), 2, ROOT);
check("loader-kind guard: a CHECKPOINT t2i is not swapped onto a UNET edit graph (the patcher would write ckpt into unet_name)",
  !r6.swapped && /same loader \(checkpoint\)/.test(r6.note), r6);
check("loaderKind reads the graph", R.loaderKind(ROOT, "comfy_workflows/img_flux2_klein_9b_ckpt_t2i.json") === "checkpoint"
  && R.loaderKind(ROOT, "comfy_workflows/img_flux2_klein_edit_9b.json") === "unet", null);
// sibling by NAME beside a custom t2i export
const d = fs.mkdtempSync(path.join(os.tmpdir(), "imgrefs-"));
fs.mkdirSync(path.join(d, "comfy_workflows"));
fs.writeFileSync(path.join(d, "comfy_workflows", "mine_t2i.json"), JSON.stringify({ 1: { class_type: "UNETLoader", inputs: {} } }));
fs.writeFileSync(path.join(d, "comfy_workflows", "mine_edit.json"), JSON.stringify({ 1: { class_type: "UNETLoader", inputs: {} }, 2: { class_type: "LoadImage", inputs: { image: "" } } }));
const r7 = R.resolve(klein("comfy_workflows/mine_t2i.json"), 1, d);
check("a user's own *_t2i export finds its *_edit sibling by name", r7.swapped && r7.workflow === "comfy_workflows/mine_edit.json" && r7.slots === 1, r7);
const r8 = R.resolve(klein("comfy_workflows/lonely_t2i.json"), 1, d);
check("no sibling anywhere -> no swap and an honest note", !r8.swapped && /no sibling edit workflow/.test(r8.note), r8);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
