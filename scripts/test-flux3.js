#!/usr/bin/env node
/* bitGen Studio — 2.502.0 unit tests: FLUX 3 IMAGE KLEIN (the three templates + the base edit sibling, the starters,
 * the catalogue, the arch, the FLUX-3-only reference swap, the edit / infill engines, the patcher on the real graphs)
 * and EDIT IMAGE MODE's image dropdown (ext/imageeditdock/ieeditonly.js).
 * Tim: "add flux 3 klein model" + "in edit image mode, show only models that can edit the images in the image dropdown". */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const wf = (n) => JSON.parse(read("comfy_workflows", n));
const nodes = (g) => Object.entries(g).filter(([k]) => !k.startsWith("_"));
const cls = (g, c) => nodes(g).filter(([, v]) => v.class_type === c);
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8" });

const T = wf("img_flux3_klein_t2i.json"), B = wf("img_flux3_klein_base_t2i.json"), E = wf("img_flux3_klein_edit.json"), BE = wf("img_flux3_klein_base_edit.json");
const unet = (g) => cls(g, "UNETLoader")[0][1].inputs.unet_name;
check("templates: FLUX 3 weights (distilled sd / base), Qwen3-VL 4B on CLIPLoader type flux3, flux2-vae",
  unet(T) === "flux3-image-klein-int8-convrot.safetensors" && unet(B) === "flux3-image-klein-base-int8-convrot.safetensors"
  && unet(E) === unet(T) && unet(BE) === unet(B)
  && [T, B, E, BE].every((g) => { const c = cls(g, "CLIPLoader")[0][1].inputs; return c.clip_name === "qwen3vl_4b_int8_convrot.safetensors" && c.type === "flux3" && cls(g, "VAELoader")[0][1].inputs.vae_name === "flux2-vae.safetensors"; }));
check("templates: core nodes only (CFGGuider + BasicScheduler simple + SamplerCustomAdvanced + EmptyFlux2LatentImage), 4 LoRA slots",
  [T, B, E, BE].every((g) => cls(g, "CFGGuider").length === 1 && cls(g, "BasicScheduler")[0][1].inputs.scheduler === "simple" && cls(g, "SamplerCustomAdvanced").length === 1
    && cls(g, "EmptyFlux2LatentImage").length === 1 && cls(g, "LoraLoader").length === 4 && !cls(g, "Flux2Scheduler").length));
check("distilled: zeroed negative, cfg 1, 16 steps; base: a real negative, cfg 3.5, 50 steps",
  cls(T, "ConditioningZeroOut").length === 1 && T["63"].inputs.cfg === 1 && T["62"].inputs.steps === 16
  && !cls(B, "ConditioningZeroOut").length && cls(B, "CLIPTextEncode").length === 2 && B["63"].inputs.cfg === 3.5 && B["62"].inputs.steps === 50
  && BE["63"].inputs.cfg === 3.5 && BE["62"].inputs.steps === 50);
check("edit: 4 picture slots, each LoadImage -> 1 MP -> VAEEncode -> a ReferenceLatent pair; the chain ends on the guider; picture 1 sets the size",
  cls(E, "LoadImage").length === 4 && cls(E, "ReferenceLatent").length === 8 && E["63"].inputs.positive[0] === "124" && E["63"].inputs.negative[0] === "134"
  && E["124"].inputs.conditioning[0] === "123" && E["134"].inputs.conditioning[0] === "133" && E["100"].inputs.image[0] === "91" && E["66"].inputs.width[0] === "100");
// every link points at a node that exists
const dangling = [T, B, E, BE].flatMap((g) => nodes(g).flatMap(([id, v]) => Object.values(v.inputs || {}).filter((x) => Array.isArray(x) && x.length === 2 && typeof x[0] === "string" && !g[x[0]]).map((x) => id + "->" + x[0])));
check("templates: no dangling links", !dangling.length, dangling);

/* ---- starters, arch, catalogue */
const ST = read("lib", "styles.js");
check("starters: FLUX 3 Klein / base / edit (arch flux3klein, comfy)",
  /name: "FLUX 3 Klein", arch: "flux3klein", engine: "comfy",\s*workflow: "comfy_workflows\/img_flux3_klein_t2i\.json",\s*steps: 16, cfg: 1/.test(ST)
  && /name: "FLUX 3 Klein base", arch: "flux3klein"[\s\S]{0,120}img_flux3_klein_base_t2i\.json[\s\S]{0,40}steps: 50, cfg: 3\.5/.test(ST)
  && /name: "FLUX 3 Klein edit", arch: "flux3klein"[\s\S]{0,120}img_flux3_klein_edit\.json/.test(ST));
const AR = JSON.parse(read("lib", "imageArch.json")).archs.find((a) => a.id === "flux3klein");
check("arch flux3klein: ComfyUI only, distilled defaults", AR && AR.comfy_only === true && AR.defaults.steps === 16 && AR.defaults.cfg === 1);
const sdcpp = py("import image_gen as G\ntry:\n  G.build_image_command({'prompt':'x'}, {}, {'arch':'flux3klein','model':'m.safetensors'}, 'o.png'); print('ran')\nexcept ValueError as e: print('refused', e)");
check("sd.cpp refuses FLUX 3 in words (ComfyUI only)", /^refused .*ComfyUI only/.test(sdcpp.trim()), sdcpp);
const CAT = JSON.parse(read("lib", "modelCatalog.json")).models;
const want = { "flux3-image-klein-int8-convrot.safetensors": "diffusion_models", "flux3-image-klein-base-int8-convrot.safetensors": "diffusion_models", "qwen3vl_4b_int8_convrot.safetensors": "text_encoders" };
check("catalogue: the three FLUX 3 files from black-forest-labs/flux-3-image-klein-comfy, into ComfyUI's folders (the VAE = FLUX.2's)",
  Object.entries(want).every(([f, d]) => CAT.some((m) => m.repo === "black-forest-labs/flux-3-image-klein-comfy" && m.as === f && m.file === d + "/" + f && m.dest === "comfy/" + d))
  && CAT.some((m) => m.id === "flux2_vae"));

/* ---- the reference swap: FLUX 3 only onto FLUX 3 */
const R = require(path.join(ROOT, "lib", "imageRefs.js"));
const s3 = { engine: "comfy", arch: "flux3klein", workflow: "comfy_workflows/img_flux3_klein_t2i.json" };
const s3b = { engine: "comfy", arch: "flux3klein", workflow: "comfy_workflows/img_flux3_klein_base_t2i.json" };
const s2 = { engine: "comfy", arch: "flux2klein9b", workflow: "comfy_workflows/img_flux2_klein_9b_t2i.json" };
const r3 = R.resolve(s3, 2, ROOT), r3b = R.resolve(s3b, 1, ROOT), r2 = R.resolve(s2, 1, ROOT), r0 = R.resolve(s3, 0, ROOT);
check("swap: FLUX 3 t2i + pictures -> the FLUX 3 edit graph; base -> the base edit graph; FLUX.2 stays on FLUX.2; no pictures = no swap",
  r3.swapped && r3.workflow.endsWith("img_flux3_klein_edit.json") && /FLUX 3 Klein with 2/.test(r3.note) && r3b.workflow.endsWith("img_flux3_klein_base_edit.json")
  && r2.swapped && /flux2/.test(r2.workflow) && !R.siblings(ROOT, s2.workflow).some((c) => /flux3/.test(c)) && !R.siblings(ROOT, s3.workflow, true).some((c) => /flux2/.test(c)) && !r0.swapped,
  { r3, r3b, r2 });
check("isKlein3: by arch, model or workflow; FLUX.2 is not", R.isKlein3(s3) && R.isKlein3({ engine: "comfy", model: "flux3_image_klein_sd_bf16.safetensors" }) && !R.isKlein3(s2) && R.isKlein9b(s3));

/* ---- the editor's engines (the Edit model list + edit image mode's dropdown) */
const A = require(path.join(ROOT, "lib", "aiEdit.js")), IF = require(path.join(ROOT, "lib", "infill.js"));
const L = [Object.assign({ id: "f3", name: "FLUX 3 Klein", kind: "image" }, s3), { id: "f3e", name: "FLUX 3 Klein edit", kind: "image", engine: "comfy", workflow: "comfy_workflows/img_flux3_klein_edit.json" },
  { id: "sd", name: "SDXL", kind: "image", engine: "comfy", arch: "sdxl", workflow: "comfy_workflows/img_sdxl_t2i.json" }];
const en = A.engines(L, ROOT);
check("engines: FLUX 3 Klein (via its edit sibling) and FLUX 3 Klein edit can edit; SDXL t2i cannot",
  en.edit.map((s) => s.id).join() === "f3,f3e", en.edit);
const eg = A.editGraph(L[0], ROOT), inf = IF.resolve(L[0], ROOT);
check("edit + infill notes name FLUX 3", /FLUX 3 Klein edit graph img_flux3_klein_edit\.json/.test(eg.note) && /FLUX 3 Klein edit graph/.test(inf.note), [eg.note, inf.note]);

/* ---- the patcher on the real edit graph: one picture -> slots 2-4 gone, the chain healed */
const pat = JSON.parse(py("import comfy_image as C, os\ng = C.load_workflow(os.path.join(" + JSON.stringify(path.join(ROOT, "comfy_workflows")) + ", 'img_flux3_klein_edit.json'))\n"
  + "g2, rep = C.patch(g, {'id':'s','arch':'flux3klein','engine':'comfy','loras':[]}, {'prompt':'make the jacket red','images':['a.png']})\n"
  + "print(json.dumps({'li':[k for k,v in g2.items() if v['class_type']=='LoadImage'],'rl':len([k for k,v in g2.items() if v['class_type']=='ReferenceLatent']),'pos':g2['63']['inputs']['positive'],'neg':g2['63']['inputs']['negative'],'txt':g2['74']['inputs']['text'],'loras':len([k for k,v in g2.items() if 'Lora' in v['class_type']]),'img':g2['81']['inputs']['image']}))"));
check("patcher: one picture fills slot 1, slots 2-4 and their reference nodes removed, the guider reads slot 1's pair, LoRA slots bypassed",
  pat.li.join() === "81" && pat.rl === 2 && pat.pos[0] === "121" && pat.neg[0] === "131" && pat.txt === "make the jacket red" && pat.loras === 0 && pat.img === "a.png", pat);
const pt = JSON.parse(py("import comfy_image as C, os\ng = C.load_workflow(os.path.join(" + JSON.stringify(path.join(ROOT, "comfy_workflows")) + ", 'img_flux3_klein_t2i.json'))\n"
  + "g2, rep = C.patch(g, {'id':'s','arch':'flux3klein','engine':'comfy','loras':[],'negative':'blurry'}, {'prompt':'a lighthouse','steps':12,'width':768,'height':1024,'seed':5})\n"
  + "print(json.dumps({'txt':g2['74']['inputs']['text'],'steps':g2['62']['inputs']['steps'],'w':g2['66']['inputs']['width'],'h':g2['66']['inputs']['height'],'seed':g2['73']['inputs']['noise_seed']}))"));
check("patcher on t2i: the prompt (a negative cannot overwrite it - distilled), steps on BasicScheduler, size on the latent, the seed",
  pt.txt === "a lighthouse" && pt.steps === 12 && pt.w === 768 && pt.h === 1024 && pt.seed === 5, pt);

/* ---- edit image mode's dropdown */
const IO = require(path.join(ROOT, "ext", "imageeditdock", "ieeditonly.js"));
const ed = new Set(["e1", "e2"]);
check("pick: keeps an edit style, else the remembered one, else the first that can edit; none -> null",
  IO.pick(["a", "e1", "e2"], ed, "e2", "e1") === "e2" && IO.pick(["a", "e1", "e2"], ed, "a", "e2") === "e2" && IO.pick(["a", "e1", "e2"], ed, "a", "zz") === "e1"
  && IO.pick(["a", "b"], ed, "a", null) === null);
const IOS = read("ext", "imageeditdock", "ieeditonly.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("the page: /api/aiedit/engines' edit list, options hidden + disabled (never removed), restored when the editor closes; loaded after mount.js",
  /fetch\("\/api\/aiedit\/engines"\)/.test(IOS) && /o\.hidden = hide; o\.disabled = hide;/.test(IOS) && /pref\.set\("ie\.styleWas"/.test(IOS)
  && EXT.indexOf("ieeditonly.js") === EXT.indexOf("mount.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
