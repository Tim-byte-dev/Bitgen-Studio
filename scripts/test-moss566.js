#!/usr/bin/env node
/* bitGen Studio — 2.566.0 units: MOSS-Image - its two image styles and ComfyUI graphs, its files in the model list, its
 * family on the Model manager's cards, and Settings ▸ Add-ons ▸ MOSS-Image (lib/mossAddon.js).
 * Tim: "can you add this model type to bitgen please...https://huggingface.co/Comfy-Org/MOSS-Image, add an option in
 * add-ons to download and install it". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  /* 1 the graphs (ComfyUI's own template, flattened) */
  const W = JSON.parse(rd("comfy_workflows", "img_moss_image_t2i.json")), WB = JSON.parse(rd("comfy_workflows", "img_moss_image_base_t2i.json"));
  const by = (g, c) => Object.values(g).filter((n) => n && n.class_type === c);
  const ks = by(W, "KSampler")[0].inputs, slg = by(WB, "SkipLayerGuidanceDiTSimple")[0].inputs;   // 2.668.0: SLG on the Base only (the official templates)
  check("img_moss_image_t2i.json: UNET (SFT int8) -> 4 model-only LoRA slots -> KSampler (2.668.0: no skip layer guidance - the official SFT template has it off) 25 steps, cfg 2.5, er_sde / simple; CLIPLoader type moss_image (Qwen3.5 9B w4a8); the small FLUX.2 VAE; EmptyFlux2LatentImage; a real negative",
    by(W, "UNETLoader")[0].inputs.unet_name === "moss_image_sft_int8_convrot.safetensors" && by(W, "LoraLoaderModelOnly").length === 4
    && by(W, "CLIPLoader")[0].inputs.type === "moss_image" && by(W, "CLIPLoader")[0].inputs.clip_name === "qwen3.5_9b_w4a8_gptq.safetensors" && by(W, "VAELoader")[0].inputs.vae_name === "flux2-vae_small.safetensors"
    && !by(W, "SkipLayerGuidanceDiTSimple").length
    && ks.steps === 25 && ks.cfg === 2.5 && ks.sampler_name === "er_sde" && ks.scheduler === "simple" && ks.model[0] === "104" && by(W, "EmptyFlux2LatentImage").length === 1
    && W[ks.negative[0]].class_type === "CLIPTextEncode" && /worst quality/.test(W[ks.negative[0]].inputs.text) && !by(W, "ModelSamplingAuraFlow").length && !by(W, "ModelSamplingSD3").length);
  const ksb = by(WB, "KSampler")[0].inputs, nm = (o) => JSON.stringify(Object.assign({}, o, { model: null }));
  check("img_moss_image_base_t2i.json: the same graph with the Base checkpoint + skip layer guidance (layer 22, 0 - 50 %) between the LoRAs and the KSampler", by(WB, "UNETLoader")[0].inputs.unet_name === "moss_image_base_int8_convrot.safetensors" && nm(ksb) === nm(ks) && ksb.model[0] === "80"
    && slg.single_layers === "22" && slg.double_layers === "" && slg.start_percent === 0 && slg.end_percent === 0.5 && slg.model[0] === "104");
  const py = spawnSync("python3", ["-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
g = C.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_moss_image_t2i.json"))})
out = C.patch(g, {"name": "MOSS-Image", "arch": "moss", "steps": 25, "cfg": 2.5, "negative": "nsfw, worst quality", "loras": [{"path": "moss_style.safetensors", "weight": 0.8}]}, {"prompt": "a fox in the snow", "seed": 7, "width": 1280, "height": 720})
G, rep = out[0], out[1]
print(json.dumps({"p": G["74"]["inputs"]["text"], "n": G["75"]["inputs"]["text"], "w": G["66"]["inputs"]["width"], "h": G["66"]["inputs"]["height"], "seed": G["3"]["inputs"]["seed"],
  "lora": [G[k]["inputs"].get("lora_name") for k in ("101", "102", "103", "104") if k in G], "ks": G["3"]["inputs"]["model"][0], "rep": rep}))`], { encoding: "utf8" });
  let P = {}; try { P = JSON.parse(py.stdout.trim().split("\n").pop()); } catch { P = { err: py.stderr }; }
  check("the worker fills it (scripts/comfy_image.patch): the prompt, the negative, the size into EmptyFlux2LatentImage, the seed, the style's LoRA in slot 1 (the empty slots bypassed), the KSampler fed by that LoRA",
    P.p === "a fox in the snow" && P.n === "nsfw, worst quality" && P.w === 1280 && P.h === 720 && P.seed === 7 && (P.lora || []).join() === "moss_style.safetensors" && /^10[1-4]$/.test(P.ks), P);

  /* 2 the styles, the architecture, the model list, the cards */
  const S = require(path.join(ROOT, "lib", "styles.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moss566-"));
  try {
    const made = S.restoreStarters(tmp, ["MOSS-Image", "MOSS-Image Base"], "image");
    const list = S.read(tmp, "image"), m1 = list.find((x) => x.name === "MOSS-Image"), m2 = list.find((x) => x.name === "MOSS-Image Base");
    check("the image styles MOSS-Image (SFT) and MOSS-Image Base - arch moss, ComfyUI, their graphs, 25 steps / cfg 2.5, 1024², the template's negative (seeded like every built-in; ↺ / the add-on put them back)",
      made.join() === "MOSS-Image,MOSS-Image Base" && m1 && m1.arch === "moss" && m1.engine === "comfy" && m1.workflow === "comfy_workflows/img_moss_image_t2i.json" && m1.steps === 25 && m1.cfg === 2.5 && m1.width === 1024
      && /jpeg artifact/.test(m1.negative) && m2 && m2.workflow === "comfy_workflows/img_moss_image_base_t2i.json", { made, m1 });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const AR = JSON.parse(rd("lib", "imageArch.json")).archs.find((a) => a.id === "moss");
  check("imageArch: moss - ComfyUI only, Qwen3.5 9B (moss_image), the small FLUX.2 VAE, a negative, 25 / 2.5", AR && AR.comfy_only && AR.negative && /moss_image/.test(AR.te[0].hint) && /flux2-vae_small/.test(AR.vae.hint) && AR.defaults.steps === 25 && AR.defaults.cfg === 2.5);
  const CAT = JSON.parse(rd("lib", "modelCatalog.json")), MS = CAT.models.filter((m) => m.group === "moss");
  check("modelCatalog: group moss - SFT / Base int8 + bf16 (diffusion_models), the w4a8 + int8 text encoders (text_encoders), the VAE (vae), all from Comfy-Org/MOSS-Image",
    CAT.groups.some((g) => g.id === "moss") && MS.map((m) => m.id).join() === "moss_sft_int8,moss_base_int8,moss_sft_bf16,moss_base_bf16,moss_te,moss_te_int8,moss_vae"
    && MS.every((m) => m.repo === "Comfy-Org/MOSS-Image" && m.as === path.basename(m.file)) && MS.find((m) => m.id === "moss_te").dest === "comfy/text_encoders" && MS.find((m) => m.id === "moss_vae").dest === "comfy/vae"
    && MS.filter((m) => /int8|bf16/.test(m.id) && !/te/.test(m.id)).every((m) => m.dest === "comfy/diffusion_models"));
  const MC = require(path.join(ROOT, "lib", "modelCards.js"));
  check("the Model manager knows the family: moss_image_*.safetensors / \"MOSS-Image\" -> MOSS-Image (its styles as templates)",
    MC.nameFamily("MOSS/moss_image_sft_int8_convrot.safetensors") === "moss" && MC.baseFamily("MOSS-Image") === "moss" && MC.FAMILIES.moss.template.join() === "MOSS-Image,MOSS-Image Base" && MC.nameFamily("qwen3.5_9b_w4a8_gptq.safetensors") === "qwen");

  /* 3 the add-on */
  const M = require(path.join(ROOT, "lib", "mossAddon.js"));
  check("wanted: the text encoder + VAE always, the models ticked (none ticked = SFT)", M.wanted([]).join() === "sft,te,vae" && M.wanted(["base", "sft_bf16"]).join() === "base,sft_bf16,te,vae" && M.wanted(["bogus"]).join() === "te,vae");
  const t2 = fs.mkdtempSync(path.join(os.tmpdir(), "moss566p-"));
  try {
    const pl = { ok: true, models: t2, customNodes: "", python: "" };
    const s0 = M.status(pl);
    check("status: nothing yet = not installed, every item listed with its size (SFT / te / VAE ticked by default, te + VAE needed)", !s0.installed && s0.items.length === 7 && s0.items.find((i) => i.id === "te").need && s0.items.find((i) => i.id === "sft").dflt && /5\.4 GB/.test(s0.items[0].size) && /not installed/.test(s0.note), s0);
    const got = [], logs = [];
    const fakeDl = async (m) => { got.push(m.id); const p = path.join(t2, m.dest.split("/").slice(1).join("/"), m.as); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); return { ok: true }; };
    const r1 = await M.install((l, e) => logs.push((e ? "! " : "") + l), ["base"], { place: pl, download: fakeDl, comfy: async () => ({ online: true, moss: false }), styles: () => ["MOSS-Image Base"] });
    check("install: the ticked model + the text encoder + the VAE into ComfyUI's folders, the styles put back; an old ComfyUI (no moss_image) is told to update",
      r1.ok && got.join() === "moss_base_int8,moss_te,moss_vae" && fs.existsSync(path.join(t2, "diffusion_models", "moss_image_base_int8_convrot.safetensors")) && fs.existsSync(path.join(t2, "text_encoders", "qwen3.5_9b_w4a8_gptq.safetensors"))
      && logs.some((l) => /image styles back: MOSS-Image Base/.test(l)) && logs.some((l) => /^! .*cannot run MOSS-Image: it needs ComfyUI 0\.42\.2 or newer.*Update ComfyUI/.test(l)), { got, logs });
    const s1 = M.status(pl);
    check("...status: installed (a model + its text encoder + VAE), what is there ✓", s1.installed && s1.items.find((i) => i.id === "base").present && !s1.items.find((i) => i.id === "sft").present && /ready: /.test(s1.note), s1.note);
    const r2 = await M.install(() => {}, ["te_int8"], { place: pl, download: fakeDl, comfy: async () => ({ online: false }), styles: () => [] });
    check("...no model ticked = said (the text encoder alone renders nothing)", !r2.ok && /tick at least one MOSS-Image model/.test(r2.error));
    const r3 = await M.remove(() => {}, pl);
    check("remove: the downloaded files go", r3.ok && !fs.existsSync(path.join(t2, "diffusion_models", "moss_image_base_int8_convrot.safetensors")) && !M.status(pl).installed);
  } finally { fs.rmSync(t2, { recursive: true, force: true }); }
  const ff = (types) => async () => ({ ok: true, json: async () => ({ CLIPLoader: { input: { required: { clip_name: [["a"]], type: [types] } } } }) });
  const c1 = await M.comfySupport({ url: "http://comfy", fetch: ff(["flux2", "krea2", "moss_image"]) }), c2 = await M.comfySupport({ url: "http://comfy", fetch: ff(["flux2", "krea2"]) });
  const c3 = await M.comfySupport({ url: "http://comfy", fetch: async () => { throw new Error("ECONNREFUSED"); } }), c4 = await M.comfySupport({ url: "", fetch: ff(["moss_image"]) });
  check("comfySupport: the running ComfyUI's CLIPLoader type list with moss_image = supported, without = too old; not running / no ComfyUI = offline",
    c1.online && c1.moss && c2.online && !c2.moss && !c3.online && !c4.online, { c1, c2, c3, c4 });
  // 2.668.0 (Tim: "moss image is not working"): 0.41.x / 0.42.1 list moss_image but render noise - the version decides
  const fv = (types, ver) => async (u) => ({ ok: true, json: async () => (/system_stats/.test(u) ? (ver ? { system: { comfyui_version: ver } } : {}) : { CLIPLoader: { input: { required: { clip_name: [["a"]], type: [types] } } } }) });
  const v1 = await M.comfySupport({ url: "http://comfy", fetch: fv(["moss_image"], "0.41.3") }), v2 = await M.comfySupport({ url: "http://comfy", fetch: fv(["moss_image"], "0.42.1") }), v3 = await M.comfySupport({ url: "http://comfy", fetch: fv(["moss_image"], "0.42.2") }), v4 = await M.comfySupport({ url: "http://comfy", fetch: fv(["moss_image"], "0.44.0") });
  check("comfySupport + the version: 0.41.3 / 0.42.1 list moss_image but are not ok (noise), 0.42.2 / 0.44.0 are", v1.moss && v1.ok === false && v2.ok === false && v3.ok === true && v4.ok === true && v3.version === "0.42.2", { v1, v2, v3, v4 });
  check("versionOk: 0.42.10 >= 0.42.2, 1.0.0 >= 0.42.2, 0.42.1 < 0.42.2, odd = unknown (null)", M.versionOk("0.42.10") === true && M.versionOk("v1.0.0") === true && M.versionOk("0.42.1") === false && M.versionOk("dev") === null);
  const t1 = M.tooOldMessage(v2), t2b = M.tooOldMessage(v3), t3 = M.tooOldMessage({ online: false }), t4 = M.tooOldMessage({ online: true, moss: true, version: null });
  check("tooOldMessage: 0.42.1 = 'renders pure noise - update ComfyUI'; 0.42.2 / offline / an unknown version with moss_image = nothing to say", /\(0\.42\.1\) cannot run MOSS-Image: it needs ComfyUI 0\.42\.2 or newer - 0\.42\.1 knows the model but renders pure noise/.test(t1) && t2b === null && t3 === null && t4 === null, { t1, t2b, t3, t4 });
  const RG = rd("routes", "mossGuard.js"), RI = rd("routes", "index.js");
  check("routes/mossGuard.js: a MOSS-Image picture refused (409, the words) before it is queued, mounted right before POST /api/genimage (not server.js)", /style\.arch !== "moss"/.test(RG) && /status\(409\)/.test(RG) && /tooOldMessage/.test(RG) && RI.indexOf('require("./mossGuard").mount(app)') > 0 && RI.indexOf('require("./mossGuard").mount(app)') < RI.indexOf('app.post("/api/genimage"'));
  const AD = require(path.join(ROOT, "lib", "addons.js")), A = AD.LIST.find((x) => x.id === "moss");
  const SA = rd("static", "addons.js"), SD = rd("lib", "styleDoctor.js");
  check("Settings ▸ Add-ons lists MOSS-Image (its files with sizes, ticked by default, the needed ones always); install / remove run lib/mossAddon.js; a ComfyUI too old for moss_image is explained when a render fails",
    A && /MOSS-Image/.test(A.label) && /0\.42\.2/.test(A.needs) && /Text encoder - Qwen3\.5 9B w4a8 7\.3 GB/.test(A.size) && Array.isArray(A.status().items)
    && /var on = it\.need \|\|/.test(SA) && /it\.need \? " disabled" : ""|running \|\| a\.busy \|\| it\.need \? " disabled"/.test(SA) && /moss_image\$\/i\.test\(m\[2\]\.trim\(\)\) \? " \(MOSS-Image needs ComfyUI 0\.42\.2 or newer\)"/.test(SD));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
