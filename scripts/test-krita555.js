#!/usr/bin/env node
/* bitGen Studio — 2.555.0 units: a selection filled THE KRITA AI PLUGIN'S WAY per model family (lib/kritaInpaint.js,
 * lib/infill.js, lib/aiEdit.js, routes/aiedit.js, the editor's Krita bounds / pre-fills / fill modes).
 * Tim: "is it possible to use the full krita ai technique. i know the generate to selection works with, pony, sdxl,
 * illustrious, klein and flux models in krita" - "the add content type works the best". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const KI = require(path.join(ROOT, "lib", "kritaInpaint.js"));
const IL = require(path.join(ROOT, "lib", "inpaintLatent.js"));
const A = require(path.join(ROOT, "lib", "aiEdit.js"));
const ST = require(path.join(ROOT, "lib", "styles.js"));
const by = (G, c) => Object.entries(G).filter(([, v]) => v && v.class_type === c);
const isLink = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string";
const dangling = (G) => { const bad = []; for (const [k, n] of Object.entries(G)) for (const [i, v] of Object.entries((n && n.inputs) || {})) if (isLink(v) && !G[v[0]]) bad.push(`${k}.${i}->${v[0]}`); return bad; };

/* 1 the families */
const fam = (o) => KI.archOf(o);
check("archOf: Pony / SDXL = sdxl, Illustrious / NoobAI = illu, FLUX.2 / 3 Klein = flux2_9b (4B named = flux2_4b), FLUX.1 = flux, Krea 2, Qwen, SD 1.5",
  fam({ arch: "sdxl", name: "Pony" }) === "sdxl" && fam({ arch: "sdxl", name: "SDXL" }) === "sdxl" && fam({ arch: "sdxl", name: "Illustrious" }) === "illu"
  && fam({ arch: "sdxl", name: "x", model: "noobaiXL.safetensors" }) === "illu" && fam({ arch: "flux2klein9b", name: "FLUX.2 Klein 9B" }) === "flux2_9b"
  && fam({ arch: "flux2klein", name: "Klein 4B" }) === "flux2_4b" && fam({ arch: "flux", name: "FLUX.1 dev" }) === "flux" && fam({ arch: "krea2", name: "Krea 2 Turbo" }) === "krea2"
  && fam({ arch: "qwen-image" }) === "qwen" && fam({ arch: "sd15" }) === "sd15");

/* 2 what ComfyUI has */
const FULL = { online: true, fooocusNodes: true, heads: ["fooocus_inpaint_head.pth"], patches: ["inpaint_v26.fooocus.patch"], lamaNodes: true,
  lamas: ["MAT_Places512_G_fp16.safetensors"], preproc: true, preprocBlack: true, alimama: true, loras: [],
  controlnets: ["noobaiInpainting_v10.fp16.safetensors", "FLUX.1-dev-Controlnet-Inpainting-Beta.safetensors", "control_v11p_sd15_inpaint_fp16.safetensors", "other.safetensors"] };
const C = KI.capsFrom(FULL), C0 = KI.capsFrom({ online: true, controlnets: ["x.safetensors"] });
check("capsFrom: the Fooocus head + patch, MAT, the three inpainting ControlNets picked by name (Krita's names); nothing = nothing",
  C.fooocus && C.fooocus.patch === "inpaint_v26.fooocus.patch" && C.lama === "MAT_Places512_G_fp16.safetensors" && C.cn.illu === "noobaiInpainting_v10.fp16.safetensors"
  && C.cn.flux === "FLUX.1-dev-Controlnet-Inpainting-Beta.safetensors" && C.cn.sd15 === "control_v11p_sd15_inpaint_fp16.safetensors" && !C0.fooocus && !C0.lama && !C0.cn.illu, C);
check("helpersFor (Krita's choice): SDXL / Pony = Fooocus, Illustrious = the NoobAI ControlNet (else Fooocus), SD 1.5 / FLUX.1 = their ControlNet, Remove + MAT; Klein / Krea 2 = none",
  KI.helpersFor("sdxl", C).join() === "fooocus" && KI.helpersFor("illu", C).join() === "cn" && KI.helpersFor("illu", KI.capsFrom(Object.assign({}, FULL, { controlnets: [] }))).join() === "fooocus"
  && KI.helpersFor("sd15", C).join() === "cn" && KI.helpersFor("flux", C).join() === "cn" && KI.helpersFor("sdxl", C, "remove").join() === "fooocus,lama"
  && KI.helpersFor("flux2_9b", C).length === 0 && KI.helpersFor("krea2", C, "generate").length === 0 && KI.helpersFor("sdxl", C0).length === 0);

/* 3 the graphs */
const sdxl = IL.latentMaskGraph(JSON.parse(rd("comfy_workflows", "img_sdxl_t2i.json")), { grow: 20, feather: 32 });
const f = KI.apply(sdxl, "sdxl", C, { mode: "generate" });
const ks = by(f.graph, "KSampler")[0][1].inputs, vic = by(f.graph, "INPAINT_VAEEncodeInpaintConditioning")[0], af = by(f.graph, "INPAINT_ApplyFooocusInpaint")[0];
check("SDXL / Pony: INPAINT_VAEEncodeInpaintConditioning (the crop, the soft mask, the prompts) -> the sampler's prompts + latent; INPAINT_ApplyFooocusInpaint on the differential-diffusion model; the plain noise mask gone; no broken links",
  f.helpers.join() === "fooocus" && vic[1].inputs.pixels[0] === "1" && f.graph[vic[1].inputs.mask[0]].class_type === "ImageToMask" && ks.positive.join() === `${vic[0]},0` && ks.negative.join() === `${vic[0]},1`
  && ks.latent_image.join() === `${vic[0]},3` && ks.model[0] === af[0] && f.graph[af[1].inputs.model[0]].class_type === "DifferentialDiffusion" && af[1].inputs.latent.join() === `${vic[0]},2`
  && !by(f.graph, "SetLatentNoiseMask").length && dangling(f.graph).length === 0 && /Fooocus inpaint patch/.test(f.note), { h: f.helpers, d: dangling(f.graph) });
const il = KI.apply(sdxl, "illu", C, {}), ilk = by(il.graph, "KSampler")[0][1].inputs, cna = by(il.graph, "ControlNetApplyAdvanced")[0], pre = by(il.graph, "InpaintPreprocessor")[0];
check("Illustrious: InpaintPreprocessor (black for the selection - the xinsir / NoobAI way) -> ControlNetApplyAdvanced (strength 1, the whole run) with noobaiInpainting; the noise mask stays",
  il.helpers.join() === "cn" && pre[1].inputs.black_pixel_for_xinsir_cn === true && cna[1].inputs.image[0] === pre[0] && cna[1].inputs.strength === 1 && cna[1].inputs.end_percent === 1
  && by(il.graph, "ControlNetLoader")[0][1].inputs.control_net_name === C.cn.illu && ilk.positive[0] === cna[0] && by(il.graph, "SetLatentNoiseMask").length === 1 && dangling(il.graph).length === 0);
const s15 = KI.apply(sdxl, "sd15", C, {});
check("SD 1.5: the same with control_v11p_sd15_inpaint, no black pixel (the -1 of the classic preprocessor)", s15.helpers.join() === "cn" && by(s15.graph, "InpaintPreprocessor")[0][1].inputs.black_pixel_for_xinsir_cn === false);
// a FLUX.1 graph with a BasicGuider (no negative)
const flux = { "10": { class_type: "UNETLoader", inputs: {} }, "11": { class_type: "DualCLIPLoader", inputs: {} }, "12": { class_type: "VAELoader", inputs: {} },
  "13": { class_type: "CLIPTextEncode", inputs: { text: "x", clip: ["11", 0] } }, "14": { class_type: "FluxGuidance", inputs: { conditioning: ["13", 0], guidance: 3.5 } },
  "15": { class_type: "BasicGuider", inputs: { model: ["10", 0], conditioning: ["14", 0] } }, "16": { class_type: "EmptySD3LatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "17": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["18", 0], guider: ["15", 0], sampler: ["19", 0], sigmas: ["20", 0], latent_image: ["16", 0] } },
  "18": { class_type: "RandomNoise", inputs: { noise_seed: 1 } }, "19": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } }, "20": { class_type: "BasicScheduler", inputs: { model: ["10", 0], steps: 20, denoise: 1 } },
  "21": { class_type: "VAEDecode", inputs: { samples: ["17", 0], vae: ["12", 0] } }, "22": { class_type: "SaveImage", inputs: { images: ["21", 0] } } };
const fl = KI.apply(IL.latentMaskGraph(flux, {}), "flux", C, {}), ali = by(fl.graph, "ControlNetInpaintingAliMamaApply")[0], gd = by(fl.graph, "BasicGuider")[0][1];
check("FLUX.1: ControlNetInpaintingAliMamaApply (the crop, the soft mask, 0.9 over the first half) feeds the guider; a guider without a negative gets a zeroed one; DifferentialDiffusion on the guider's model",
  fl.helpers.join() === "cn" && gd.inputs.conditioning.join() === `${ali[0]},0` && ali[1].inputs.strength === 0.9 && ali[1].inputs.end_percent === 0.5 && ali[1].inputs.image[0] === "1"
  && fl.graph[ali[1].inputs.negative[0]].class_type === "ConditioningZeroOut" && fl.graph[gd.inputs.model[0]].class_type === "DifferentialDiffusion" && dangling(fl.graph).length === 0, dangling(fl.graph));
const rm = KI.apply(sdxl, "sdxl", C, { mode: "remove" }), iw = by(rm.graph, "INPAINT_InpaintWithModel")[0];
check("Remove: MAT / LaMa fills the selection first (INPAINT_InpaintWithModel on the crop + the hard mask); Fooocus starts from that picture",
  rm.helpers.join() === "lama,fooocus" && iw[1].inputs.mask.join() === "2,1" && by(rm.graph, "INPAINT_VAEEncodeInpaintConditioning")[0][1].inputs.pixels[0] === iw[0] && dangling(rm.graph).length === 0);
check("nothing to add (Krea 2, or ComfyUI without the helpers) = the graph untouched", KI.apply(sdxl, "krea2", C, {}).graph === sdxl && KI.apply(sdxl, "sdxl", C0, {}).graph === sdxl);

/* 4 the plan */
const all = ST.read(path.join(ROOT, "styles"), "image"), pony = all.find((s) => s.name === "Pony"), krea = all.find((s) => s.name === "Krea 2 Turbo");
const pp = A.plan(pony, { mode: "generate", prompt: "a red ball", mask_grow: 20, mask_feather: 32 }, ROOT, C), p0 = A.plan(pony, { mode: "generate", prompt: "x" }, ROOT, C0);
const pr = A.plan(pony, { mode: "remove", prompt: "" }, ROOT, C), kr = A.plan(krea, { mode: "remove", prompt: "" }, ROOT, C0);
check("plan: Pony with Fooocus = ITS OWN graph + the patch (Pony stays Pony); without = the SDXL inpaint export as before; Remove with MAT at full strength, without at 0.9",
  pp.graph && pp.helpers.join() === "fooocus" && /img_sdxl_t2i/.test(pp.workflow) && /SDXL inpaint UNet/.test(p0.note) && pr.denoise == null && kr.denoise === 0.9, { pp: pp.note, p0: p0.note });
const en = A.engines(all, ROOT, C), ep = en.inpaint.find((x) => x.name === "Pony"), ek = en.inpaint.find((x) => x.name === "Krea 2 Turbo");
check("engines: Pony says helper fooocus (not 'latent' - it fills itself, never through 👁); Krea 2 none (latent)", ep && ep.helper === "fooocus" && ep.latent === false && ek && !ek.helper && ek.latent === true, { ep, ek });
check("missing(): says per family what to add (and that ComfyUI must run)", KI.missing({ online: false })[0].includes("not running") && KI.missing(C0).some((m) => /Fooocus/.test(m)) && KI.missing(C).length === 0, KI.missing(C));
check("add content through the edit model = \"Add the object to the scene.\" (Krita's add_object)", A.fillEditPlan(all.find((s) => s.name === "Qwen Image Edit 2511"), { mode: "generate", fill_kind: "add", prompt: "a dog" }, ROOT).prompt === "Add the object to the scene.\na dog");

/* 5 caps() asks ComfyUI per class */
(async () => {
  const seen = [];
  const fake = async (u) => { seen.push(u); const cl = decodeURIComponent(u.split("/object_info/")[1]);
    const body = { INPAINT_LoadFooocusInpaint: { input: { required: { head: [["fooocus_inpaint_head.pth"]], patch: [["inpaint_v26.fooocus.patch"]] } } },
      ControlNetLoader: { input: { required: { control_net_name: ["COMBO", { options: ["noobaiInpainting_v10.fp16.safetensors"] }] } } },
      InpaintPreprocessor: { input: { required: { image: ["IMAGE"], mask: ["MASK"] }, optional: { black_pixel_for_xinsir_cn: ["BOOLEAN"] } } } }[cl];
    return { ok: !!body, json: async () => (body ? { [cl]: body } : {}) }; };
  const c = await KI.caps({ fresh: true, fetch: fake });
  check("caps(): one small /object_info/<class> request per helper; both combo forms read; the optional preprocessor input seen",
    seen.length === 6 && seen.every((u) => /\/object_info\//.test(u)) && c.online && c.fooocus && c.cn.illu && c.preproc && c.preprocBlack && !c.lama, c);
  /* 6 wiring */
  const IE = rd("ext", "imageeditdock", "imageedit.js"), RA = rd("routes", "aiedit.js"), IF = rd("lib", "infill.js"), NP = JSON.parse(rd("lib", "nodePacks.json")), MC = JSON.parse(rd("lib", "modelCatalog.json"));
  check("route: /api/aiedit asks caps() and plans with it; engines lists helper + krita.missing; infill applies the helper (checkpoint styles with one fill with their own model)",
    /caps = await kritaInpaint\.caps\(\)/.test(RA) && /aiEdit\.plan\(style, b, core\.BASE, caps\)/.test(RA) && /krita: \{ online: caps\.online, missing: kritaInpaint\.missing\(caps\) \}/.test(RA)
    && /KI\.apply\(lm, arch, o\.caps, \{ mode: o\.mode \}\)/.test(IF) && /!== "checkpoint" \|\| famHelp\.length/.test(IF));
  check("setup: comfyui-inpaint-nodes in the node packs; the Fooocus head + patch, MAT, the NoobAI / FLUX / SD 1.5 inpainting ControlNets in the model list (group inpaint)",
    NP.packs.some((p) => p.id === "inpaint" && /Acly\/comfyui-inpaint-nodes/.test(p.url)) && MC.groups.some((g) => g.id === "inpaint")
    && ["fooocus_head", "fooocus_patch", "mat_places", "cn_noobai_inpaint", "cn_flux_inpaint", "cn_sd15_inpaint"].every((id) => MC.models.some((m) => m.id === id && m.group === "inpaint")));
  check("editor: Krita's bounds (kritaBounds), fill modes (Add content default - grey; Fill - blur; Expand - border + blur), a helper style never goes through 👁",
    /P\.kritaBounds = function/.test(IE) && /S\.fillMode = store\.get\("fillMode", "add"\)/.test(IE) && /id="kxFillMode"/.test(IE) && /P\.maskedBlur\(fid\.data, cropMask, box\.w, box\.h, px\(65\), px\(9\)\)/.test(IE)
    && /!fillInfo\.helper\)\)/.test(IE) && /req\.fill_kind = mode === "generate" \? \(kind === "add" \? "add" : "generate"\) : mode/.test(IE));
  // Krita's bounds and pre-fills (the editor's pure helpers)
  const P = new Function("P", IE.slice(IE.indexOf("P.maskParams = function"), IE.indexOf("/** The size to RENDER a crop at")) + IE.slice(IE.indexOf("P.morph = function"), IE.indexOf("P.morph = function") + IE.slice(IE.indexOf("P.morph = function")).indexOf("\n  };\n") + 5) + "; return P;")({});
  const kb = P.kritaBounds({ x: 300, y: 200, w: 100, h: 100 }, 1600, 1200, 1);
  check("kritaBounds: a 100 px selection -> mask bounds 256 (the minimum, multiple of 8) centred on it; the context >= 512 square and inside the picture",
    kb.mask.w === 256 && kb.mask.h === 256 && kb.mask.x === 222 && kb.context.w >= 512 && kb.context.h >= 512 && kb.context.x >= 0 && kb.context.y >= 0 && kb.context.x <= 300 && kb.context.x + kb.context.w >= 400, kb);
  const W = 40, H = 40, rgba = new Uint8ClampedArray(W * H * 4), m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { rgba.set([200, 20, 20, 255], i * 4); if (i % W >= 10 && i % W < 30 && ((i / W) | 0) >= 10 && ((i / W) | 0) < 30) m[i] = 255; }
  const g = Uint8ClampedArray.from(rgba); P.maskedFill(g, m, W, H, 3);
  const at = (a, x, y) => Array.from(a.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
  check("Add content's pre-fill: the selection's middle neutral grey, a soft falloff inside its edge, outside untouched", at(g, 20, 20).every((v) => Math.abs(v - 127) <= 2) && at(g, 5, 5).join() === "200,20,20" && at(g, 10, 20)[0] > 127, { mid: at(g, 20, 20), edge: at(g, 10, 20) });
  const st = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { const v = ((i % W) >> 1) % 2 ? 255 : 0; st.set([v, v, v, 255], i * 4); }
  const bl = Uint8ClampedArray.from(st); P.maskedBlur(bl, m, W, H, 25, 3);
  check("Fill's pre-fill: inside the selection black / white stripes become a blur (mid grey), outside untouched",
    Math.abs(at(bl, 20, 20)[0] - 127) < 40 && Math.abs(at(bl, 21, 20)[0] - 127) < 40 && at(bl, 2, 2)[0] === st[(2 * W + 2) * 4], { a: at(bl, 20, 20), b: at(bl, 21, 20) });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
