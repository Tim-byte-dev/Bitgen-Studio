#!/usr/bin/env node
/* bitGen Studio — 2.686.0: THE LINE-ART RESTYLE'S PURE PARTS - lib/aiEdit.js lineArtNet (the line-art ControlNet of the
 * style's family), controls() keeping the union type, plan() Generate over the whole picture for restyle=1;
 * static/lbrestyle.js chooseHow; scripts/cn_stage.py apply_controlnet union_type. The jobs: scripts/test-ui686-ui.js.
 * Tim (verbatim): "if the style is not an edit style in preview image change style, create a lineart drawing first then use
 * controlnet to generate the image" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const A = require(path.join(ROOT, "lib", "aiEdit.js")), R = require(path.join(ROOT, "static", "lbrestyle.js"));
const NAMES = ["xinsir-union-promax-sdxl.safetensors", "control_v11p_sd15_lineart_fp16.safetensors", "flux-lineart-controlnet.safetensors",
  "noobaiInpainting_v10.fp16.safetensors", "FLUX.1-dev-ControlNet-Union-Pro.safetensors", "controlnet-depth-sdxl.safetensors"];
const pick = (st, n) => A.lineArtNet(st, n || NAMES);
check("Illustrious / Pony / SDXL: the SDXL union ProMax (union: told it is line art) - never an inpaint / depth one",
  ["Illustrious", "Pony"].every((name) => pick({ name, model: name.toLowerCase() + ".safetensors" }).model === "xinsir-union-promax-sdxl.safetensors") && pick({ arch: "sdxl" }).union === true
  && pick({ arch: "sdxl" }, ["controlnet-depth-sdxl.safetensors", "noobaiInpainting_v10.fp16.safetensors"]).error);
check("a family's own LINE-ART model beats its union one", pick({ arch: "sdxl" }, ["xinsir-union-promax-sdxl.safetensors", "mistoLine_sdxl_lineart.safetensors"]).model === "mistoLine_sdxl_lineart.safetensors");
check("SD 1.5 -> its line-art model; FLUX.1 -> a FLUX one (not FLUX.2 / 3)", pick({ arch: "sd15" }).model === "control_v11p_sd15_lineart_fp16.safetensors" && pick({ arch: "flux" }).model === "flux-lineart-controlnet.safetensors"
  && pick({ arch: "flux" }, ["flux2-lineart.safetensors"]).error);
const kr = pick({ arch: "krea2", name: "Krea 2" }), none = pick({ arch: "sdxl" }, ["control_v11p_sd15_lineart.safetensors"]);
check("a family with none (Krea 2) / none of that family in the folder: said in words - what to get", /model family \(krea2\)/.test(kr.error) && /SDXL \/ Pony \/ Illustrious line-art ControlNet/.test(none.error) && /Add-ons ▸ ControlNet/.test(none.error), { kr, none });
const c = A.controls([{ type: "lineart", model: "x.safetensors", strength: 0.85, end: 0.9, union_type: A.UNION_LINEART }, { type: "lineart", model: "y.safetensors", union_type: "bad" }], []);
check("controls(): the union type kept (ComfyUI's own name) - an unknown one dropped", c[0].union_type === "canny/lineart/anime_lineart/mlsd" && !("union_type" in c[1]) && c[0].strength === 0.85 && c[0].end === 0.9, c);
const base = fs.mkdtempSync(path.join(os.tmpdir(), "rs686-")); fs.mkdirSync(path.join(base, "comfy_workflows"));
fs.writeFileSync(path.join(base, "comfy_workflows", "t2i.json"), JSON.stringify({ "3": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "a" } }, "5": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["3", 1] } }, "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["3", 1] } }, "7": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } }, "8": { class_type: "KSampler", inputs: { model: ["3", 0], positive: ["5", 0], negative: ["6", 0], latent_image: ["7", 0], seed: 0, steps: 25, cfg: 6, denoise: 1 } }, "9": { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 2] } }, "10": { class_type: "SaveImage", inputs: { images: ["9", 0] } } }));
const st = { id: "x", name: "Illustrious", engine: "comfy", kind: "image", workflow: "comfy_workflows/t2i.json" };
const pg = A.plan(st, { mode: "generate", whole: "1", restyle: "1", prompt: "anime" }, base, null);
let plain = ""; try { A.plan(st, { mode: "generate", whole: "1", prompt: "x" }, base, null); } catch (e) { plain = e.message; }
check("plan(): Generate over the whole picture for the restyle = the style's own graph at full strength; the image editor's own Generate unchanged",
  pg.whole && pg.denoise == null && !pg.selfContained && /no inpaint path/.test(plain), { whole: pg.whole, d: pg.denoise, plain });
fs.rmSync(base, { recursive: true, force: true });
const ch = [R.chooseHow("edit", { model: "x" }), R.chooseHow("refine", { model: "x" }), R.chooseHow(null, { model: "x" }), R.chooseHow("refine", { error: "none" }), R.chooseHow(null, { error: "none" })];
check("chooseHow(): an edit model edits; any other style with a line-art ControlNet = line art; without one = Refine (picture to picture) with the reason, else none",
  ch[0].how === "edit" && ch[1].how === "lineart" && ch[2].how === "lineart" && ch[3].how === "refine" && ch[3].why === "none" && ch[4].how === null, ch);
const py = execFileSync("python3", ["-I", "-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import cn_stage as N
g = {"1": {"class_type": "KSampler", "inputs": {"positive": ["2", 0], "negative": ["3", 0], "model": ["4", 0]}}, "2": {"class_type": "CLIPTextEncode", "inputs": {}}, "3": {"class_type": "CLIPTextEncode", "inputs": {}}, "5": {"class_type": "VAEDecode", "inputs": {"vae": ["4", 2]}}}
a, n1 = N.apply_controlnet(json.loads(json.dumps(g)), "l.png", "u.safetensors", 0.85, 0.9, union_type="canny/lineart/anime_lineart/mlsd")
b, n2 = N.apply_controlnet(json.loads(json.dumps(g)), "l.png", "m.safetensors", 1.0, 1.0)
cl = lambda x, c: [k for k, v in x.items() if v["class_type"] == c]
ua = cl(a, "SetUnionControlNetType"); ap = [a[k] for k in cl(a, "ControlNetApplyAdvanced")]
print(json.dumps({"u": a[ua[0]]["inputs"]["type"] if ua else None, "fed": ap[0]["inputs"]["control_net"][0] == ua[0], "plain_union": len(cl(b, "SetUnionControlNetType")), "note": n1[0]}))
`], { encoding: "utf8" });
const P = JSON.parse(py.trim());
check("cn_stage.apply_controlnet union_type: loader -> SetUnionControlNetType (line art) -> the apply; without it nothing extra; the note says so",
  P.u === "canny/lineart/anime_lineart/mlsd" && P.fed && P.plain_union === 0 && /as canny\/lineart/.test(P.note), P);
const W = fs.readFileSync(path.join(ROOT, "misc", "image_worker.py"), "utf8");
check("the worker asks the running ComfyUI for SetUnionControlNetType's types before using one (else the union model's auto)", /object_info\(base, "SetUnionControlNetType"\)/.test(W) && /union_type=ut/.test(W));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
