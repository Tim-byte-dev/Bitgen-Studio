#!/usr/bin/env node
// bitGen Studio 2.971.0 - the 🌐 360 panorama graph through the REAL patcher (scripts/comfy_image.py, python): the canvas in the
// LoadImage, the trigger + words in the Prompt primitive, the style's LoRA into the model-only slot, the size / seed / steps.
"use strict";
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const L = require(path.join(ROOT, "lib/pano360.js"));
const jp = L.jobParams({ id: "e", name: "Qwen Image 2.1 edit", workflow: "comfy_workflows/img_qwen21_edit.json", loras: [] }, { desc: "a beach", size: "1408", file: "c.png" });
const py = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
g = C.load_workflow(${JSON.stringify(path.join(ROOT, L.WORKFLOW))})
r = C.roles(g)
st = json.loads(sys.argv[1]); pr = json.loads(sys.argv[2])
g2, rep = C.patch(g, st, {"prompt": pr["prompt"], "images": ["c.png"], "seed": 7, "width": pr["width"], "height": pr["height"]})
print(json.dumps({"pos": r["positive"], "neg": r["negative"], "slots": r["image_slots"], "lora_nodes": r.get("lora_nodes"), "g": g2, "rep": rep}))
`, JSON.stringify(jp.style), JSON.stringify(jp)], { encoding: "utf8" });
let R = null;
try { R = JSON.parse(py.stdout); } catch { R = null; }
check("patcher: ran", !!R, py.stderr.slice(-800));
if (R) {
  const g = R.g;
  check("roles: the Prompt primitive is the positive, no negative text node, one picture slot (21), one LoRA slot (11)", R.pos === "9" && R.neg === null && R.slots.join() === "21" && (R.lora_nodes || []).join() === "11", R);
  check("the trigger + the words reach node 9, the canvas reaches node 21", g["9"].inputs.value === L.TRIGGER + " a beach" && g["21"].inputs.image === "c.png");
  check("the LoRA filled into the model-only slot at 0.8 (no extra LoRA node built, the CLIP untouched)",
    g["11"].class_type === "LoraLoaderModelOnly" && g["11"].inputs.lora_name === L.LORA && g["11"].inputs.strength_model === 0.8 && Object.values(g).filter((n) => /LoraLoader/.test(n.class_type)).length === 1 && JSON.stringify(g["10"].inputs.clip) === '["2",0]', g["11"]);
  check("1408 × 704, seed 7, 25 steps, cfg 1 on the sampler", g["12"].inputs.width === 1408 && g["12"].inputs.height === 704 && g["13"].inputs.seed === 7 && g["13"].inputs.steps === 25 && g["13"].inputs.cfg === 1);
}
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
