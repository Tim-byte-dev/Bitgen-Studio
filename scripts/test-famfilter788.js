#!/usr/bin/env node
/* bitGen Studio — 2.788.0 units: Basic Settings' Override lists filtered by the prompt docker's styles' family + type
 * (lib/famFilter.js, routes/famFilter.js, static/famfilter.js, the index.html cmCombo + static/basicset.js hooks).
 * Pure - no studio, no network. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const FF = require("../lib/famFilter"), FC = require("../static/famfilter.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- the rule of a style
const krea = FF.rule({ id: "k", name: "Krea 2 Raw", arch: "krea2" }, "image");
check("an image style: the families of its architecture, type image", krea.families.join() === "krea" && krea.labels.join() === "Krea" && krea.type === "image" && krea.style === "Krea 2 Raw", krea);
const sdxl = FF.rule({ name: "Illustrious", arch: "sdxl" }, "image");
check("SDXL workflows take SDXL / Pony / Illustrious / NoobAI / SD 1.5 files (as lib/modelFit)", ["sdxl", "pony", "illustrious", "noobai", "sd15"].every((f) => sdxl.families.includes(f)) && !sdxl.families.includes("wan"), sdxl);
check("type: an edit / Kontext / inpaint / Fill style = image edit; a family that only edits too", FF.typeOf({ name: "Qwen Image 2.1 edit", arch: "qwen-image" }, "image") === "image edit"
  && FF.typeOf({ name: "FLUX.1 Kontext edit", arch: "flux" }) === "image edit" && FF.typeOf({ name: "FLUX Fill inpaint", arch: "flux" }) === "image edit"
  && FF.typeOf({ name: "Fibo 2.0 Dev", arch: "fibo2" }, "image") === "image edit" && FF.typeOf({ name: "Krea 2 Turbo", arch: "krea2" }, "image") === "image"
  && FF.typeOf({ name: "Refiller", arch: "sdxl" }, "image") === "image");
const h3 = FF.rule({ name: "MiniMax H3 SS", arch: "minimax-h3" }, "video"), ltx = FF.rule({ name: "LTX 2.5", arch: "ltx-2.5" }, "video"), wan = FF.rule({ name: "Wan 2.2", arch: "wan22" }, "video");
check("a video style: MiniMax H3 / LTX / Wan, type video", h3.families.join() === "h3" && ltx.families.join() === "ltx" && wan.families.join() === "wan" && h3.type === "video" && h3.kind === "video");
check("no style / a custom or unknown architecture = no families (nothing filtered)", FF.rule(null, "image").families.length === 0 && FF.rule({ name: "C", arch: "custom" }, "video").families.length === 0 && FF.rule({ name: "P-H3 Image", arch: "ph3" }, "image").families.length === 0);

// ---- a file's family + type
const cards = [{ cat: "checkpoints", name: "Krea2/mine_v1.safetensors", family: "krea", category: "image" }, { cat: "loras", name: "film_grain.safetensors", family: "illustrious", category: "image" }];
check("info: the Model manager's card first (your family even when the name says nothing)", JSON.stringify(FF.info("checkpoints", "Krea2/mine_v1.safetensors", cards, [])) === '{"family":"krea","category":"image"}'
  && FF.info("loras", "film_grain.safetensors", cards, []).family === "illustrious");
check("info: no card = the name (an edit in the name = image edit), nothing to tell = no family", JSON.stringify(FF.info("diffusion_models", "qwen_image_2.1_edit_fp8.safetensors", [], [])) === '{"family":"qwen","category":"image edit"}'
  && FF.info("diffusion_models", "qwen_image_fp8.safetensors", [], []).category === "image" && FF.info("checkpoints", "mystery_v3.safetensors", [], []).family === ""
  && FF.info("diffusion_models", "wan2.2_t2v_14B.safetensors", [], []).category === "video");
const inv = { id: "podA1", name: "Krea pod", files: [{ cat: "checkpoints", rel: "Models/sdxl_base.safetensors", kind: "model", state: "on" }] };
check("info: a pod's <pod name>/<file> is judged by the file, not the pod's name", FF.info("checkpoints", "Krea pod/Models/sdxl_base.safetensors", [], [inv]).family === "sdxl");

// ---- picking (server + page agree)
const files = [{ name: "a.safetensors", family: "krea", category: "image" }, { name: "b", family: "sdxl", category: "image" }, { name: "c", family: "", category: "" }, { name: "d", family: "other" }, { name: "e", family: "krea", category: "image edit" }];
const P = FF.pick(files, krea);
check("pick: the family's files of the style's type, no family = kept apart, the rest out", P.fit.map((f) => f.name).join() === "a.safetensors" && P.unknown.map((f) => f.name).join() === "c,d" && P.out.map((f) => f.name).sort().join() === "b,e", P);
const klein = FF.rule({ name: "FLUX.2 Klein 9B edit", arch: "flux2klein9b" }, "image");
const PK = FF.pick([{ name: "flux-2-klein-9b.safetensors", family: "flux2", category: "image" }], klein);
check("pick: a family with no file of the type keeps its files (Klein's edit style renders with its picture model)", klein.type === "image edit" && PK.fit.length === 1, PK);
check("pick: no families = everything", FF.pick(files, FF.rule(null, "image")).fit.length === files.length);
const info = { "checkpoints|a.safetensors": { family: "krea", category: "image" }, "checkpoints|b": { family: "sdxl", category: "image" }, "loras|c": { family: "" }, "checkpoints|e": { family: "krea", category: "image edit" } };
const cf = [{ name: "a.safetensors", category: "checkpoints" }, { name: "b", category: "checkpoints" }, { name: "c", category: "loras" }, { name: "e", category: "checkpoints" }, { name: "z", category: "checkpoints" }];
const C = FC.pick(cf, info, krea);
check("page pick: fitting first, then no family (marked), the count hidden", C.files.map((f) => f.name).join() === "a.safetensors,c,z" && C.fit === 1 && C.unknown.size === 2 && C.out === 2, { names: C.files.map((f) => f.name), fit: C.fit, out: C.out });
check("page pick: no rule / no families = null (the list as it was)", FC.pick(cf, info, null) === null && FC.pick(cf, info, { families: [] }) === null);
check("which list: picture checkpoint + picture LoRAs = image, video Model + video LoRAs = video, others none", FC.kindOfId("imgCkpt", "") === "image" && FC.kindOfId("", "tliRows") === "image" && FC.kindOfId("vidModel", "") === "video" && FC.kindOfId("", "tlvRows") === "video" && FC.kindOfId("s_stckpt", "") === null && FC.kindOfId("", "cnLoras") === null);
const nt = FC.noteText(krea, { fit: 4, unknown: new Set([1]), out: 9 }, { fit: 2, unknown: new Set(), out: 0 }, false);
check("the line: the style, family + type, models and LoRAs counted", nt === "For Krea 2 Raw: Krea · image - 4 models + 1 family not known, 9 hidden · 2 LoRAs", nt);
check("the line: one model / one LoRA said in the singular", /1 model \+ 1 family not known · 1 LoRA$/.test(FC.noteText(krea, { fit: 1, unknown: new Set([1]), out: 0 }, { fit: 1, unknown: new Set(), out: 0 }, false)));
check("the line: Show all on / no family to filter by", /^Showing every model and LoRA/.test(FC.noteText(krea, null, null, true)) && /family is not known/.test(FC.noteText(FF.rule({ name: "P-H3 Image", arch: "ph3" }, "image"))) && FC.noteText(FF.rule(null, "image")) === "");

// ---- wiring
const IX = src("static/index.html"), BS = src("static/basicset.js"), RI = src("routes/index.js"), RF = src("routes/famFilter.js");
check("cmCombo asks H3FamFilter.files, marks no-family files, says why a picked file is hidden", /H3FamFilter\.files\(inp, files\)/.test(IX) && /family not known/.test(IX) && /FF\.hid\(cur\) \? FF\.why/.test(IX));
check("index.html loads famfilter.js", /<script src="\/static\/famfilter\.js"><\/script>/.test(IX));
check("the video Model list goes through H3FamFilter.names; H3Basic.refill", /H3FamFilter\.names\("video", pairs\)/.test(BS) && /refill: refill/.test(BS));
check("routes: /api/famfilter mounted from routes/index.js (after remoteModels)", /require\("\.\/remoteModels"\)\.mount\(app\);\n(  require\("\.\/gpuCards"\)\.mount\(app\);[^\n]*\n)?(  require\("\.\/mmSources"\)\.mount\(app\);[^\n]*\n)?  require\("\.\/famFilter"\)\.mount\(app\);/.test(RI) && /app\.post\("\/api\/famfilter"/.test(RF));
let route = null; require("../routes/famFilter").mount({ post: (p, f) => { route = f; } });
let out = null; route({ body: { image: "", video: "", files: [{ cat: "checkpoints", name: "krea2_raw.safetensors" }] } }, { json: (j) => { out = j; }, status: () => ({ json: (j) => { out = j; } }) });
check("the route answers rules + each file's family", out && out.rules && out.rules.image.families.length === 0 && out.info["checkpoints|krea2_raw.safetensors"] && out.info["checkpoints|krea2_raw.safetensors"].family === "krea", out);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
