// bitGen Studio — lib/kritaInpaint.js (2.555.0): a selection filled THE KRITA AI PLUGIN'S WAY, per model family.
//
// Tim: "it sort of works but doesn't. is it possible to use the full krita ai technique. i know the generate to selection
// works with, pony, sdxl, illustrious, klein and flux models in krita".
//
// What the plugin does at 100 % (krita-ai-diffusion ai_diffusion/backend/workflow.py inpaint() + detect_inpaint(),
// apply_control(), model/model.py, presets/models.json) - every model gets a helper that was TRAINED to fill:
//   SDXL / Pony      the Fooocus inpaint patch: INPAINT_LoadFooocusInpaint (fooocus_inpaint_head.pth +
//                    inpaint_v26.fooocus.patch) -> INPAINT_VAEEncodeInpaintConditioning (positive, negative, the
//                    picture, the mask) -> INPAINT_ApplyFooocusInpaint on the model; the sampler starts from its latent
//   Illustrious /    the NoobAI inpainting ControlNet (noobaiInpainting_v10): InpaintPreprocessor (black for the
//   NoobAI           selection) -> ControlNetApplyAdvanced, strength 1 over the whole run
//   SD 1.5           control_v11p_sd15_inpaint the same way (InpaintPreprocessor, -1 for the selection)
//   FLUX.1           the Alimama inpainting ControlNet (FLUX.1-dev-Controlnet-Inpainting-Beta):
//                    ControlNetInpaintingAliMamaApply, strength 0.9 over the first half
//   Remove           any model: the selection filled by an inpaint model first (MAT / LaMa: INPAINT_LoadInpaintModel ->
//                    INPAINT_InpaintWithModel) - the picture the sampler starts from has no object any more
//   FLUX.2 Klein,    no helper - the editor fills them with the edit model (2.553.0: the picture as the reference, the
//   Qwen, Krea 2 …   selection green, "Fill the green spaces according to the image.")
// Always (lib/inpaintLatent.js + the editor): differential diffusion, the mask grown + feathered by the selection's size,
// the picture pre-filled (blur of what was there for a fill), the result colour-matched and blended in.
//
// The helpers need the comfyui-inpaint-nodes pack (Acly - lib/nodePacks.json "inpaint"), comfyui_controlnet_aux (the
// preprocessor) and the models (lib/modelCatalog.json group "inpaint"); caps() asks ComfyUI what it has, and a family
// without its helper fills as before. Pure parts tested (scripts/test-krita555.js): archOf, capsFrom, helpersFor, apply.
"use strict";

/** the Krita family of a style */
function archOf(style) {
  const s = style || {};
  const a = String(s.arch || "").toLowerCase();
  const txt = [s.name, s.model, s.workflow, s.id].map((x) => String(x || "")).join(" ").toLowerCase();
  if (/klein|flux2|flux[._ -]?2\b|flux[._ -]?3\b/.test(a + " " + txt)) return /\b4b\b|klein[._ -]?4b|4b[._ -]/.test(txt) ? "flux2_4b" : "flux2_9b";
  if (/krea2/.test(a) || /krea[._ -]?2/.test(txt)) return "krea2";
  if (/qwen/.test(a)) return "qwen";
  if (/z-?image/.test(a)) return "zimage";
  if (/anima/.test(a + " " + txt)) return "anima";
  if (/^sd-?1|sd15|sd1\.5/.test(a)) return "sd15";
  if (/sdxl|pony|illu|noob/.test(a) || /pony|illustrious|noob/.test(txt)) return /illustrious|\billu|noob|\bilxl|wai-?illu/.test(txt) || /illu|noob/.test(a) ? "illu" : "sdxl";
  if (/flux/.test(a)) return "flux";
  return a || "other";
}

const PICK = {
  head: /fooocus_inpaint_head/i,
  patch: /inpaint_v2\d?\.fooocus|inpaint.*\.fooocus\.patch/i,
  lama: /mat_places512|places_512_fulldata|big-?lama/i,
  cn_sd15: /control_v11p_sd15_inpaint|sd15.*inpaint/i,
  cn_flux: /flux.*controlnet.*inpaint|controlnet.*inpaint.*flux|alimama.*inpaint/i,
  cn_illu: /noobai.*inpaint|noob.*inpaint/i,
  lora_klein4b: /klein.*4b.*outpaint|4b-outpaint|LyNiaZ53Tudg0J6sT8Xbx/i,
};
const pick = (list, re) => (list || []).find((n) => re.test(String(n))) || null;
/** what ComfyUI has, from its lists (pure). raw = {online, heads, patches, lamas, controlnets, loras, preproc, preprocBlack, alimama, fooocusNodes, lamaNodes} */
function capsFrom(raw) {
  const r = raw || {};
  const head = r.fooocusNodes ? pick(r.heads, PICK.head) : null, patch = r.fooocusNodes ? pick(r.patches, PICK.patch) : null;
  return {
    online: !!r.online,
    fooocus: head && patch ? { head, patch } : null,
    lama: r.lamaNodes ? pick(r.lamas, PICK.lama) : null,
    preproc: !!r.preproc, preprocBlack: !!r.preprocBlack, alimama: !!r.alimama,
    cn: { sd15: pick(r.controlnets, PICK.cn_sd15), flux: pick(r.controlnets, PICK.cn_flux), illu: pick(r.controlnets, PICK.cn_illu) },
    klein4bLora: pick(r.loras, PICK.lora_klein4b),
  };
}
/** the helpers a family gets (Krita's choice; mode "remove" adds the inpaint model's pre-fill) -> ["fooocus" | "cn" | "lama"] */
function helpersFor(arch, caps, mode) {
  const c = caps || {}, out = [];
  if (arch === "sdxl" && c.fooocus) out.push("fooocus");
  else if (arch === "illu") { if (c.cn && c.cn.illu && c.preproc) out.push("cn"); else if (c.fooocus) out.push("fooocus"); }
  else if (arch === "sd15" && c.cn && c.cn.sd15 && c.preproc) out.push("cn");
  else if (arch === "flux" && c.cn && c.cn.flux && c.alimama) out.push("cn");
  if (mode === "remove" && c.lama) out.push("lama");
  return out;
}
const NAMES = { fooocus: "the Fooocus inpaint patch", cn: "an inpainting ControlNet", lama: "an inpaint model's pre-fill (MAT / LaMa)" };
function describe(arch, helpers, caps) {
  if (!helpers.length) return "";
  const cnName = helpers.includes("cn") ? ((caps.cn || {})[arch === "illu" ? "illu" : arch === "sd15" ? "sd15" : "flux"] || "") : "";
  return " + the Krita AI way: " + helpers.map((h) => (h === "cn" ? `${NAMES.cn} (${cnName})` : NAMES[h])).join(" + ");
}

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number");
const cls = (n) => String((n && n.class_type) || "");

/**
 * The helpers wired into a seamless-fill graph (lib/inpaintLatent.js latentMaskGraph: the crop is "1", the mask "2", one
 * SetLatentNoiseMask the samplers start from). -> {graph, helpers} (graph unchanged when there is nothing to add or the
 * shape is not the expected one). Pure.
 */
function apply(graph, arch, caps, opts) {
  const o = opts || {}, c = caps || {};
  const helpers = helpersFor(arch, c, o.mode);
  if (!graph || !helpers.length) return { graph, helpers: [] };
  const g = JSON.parse(JSON.stringify(graph));
  const ids = Object.keys(g).filter((k) => g[k] && g[k].class_type);
  const noise = ids.find((k) => cls(g[k]) === "SetLatentNoiseMask");
  if (!noise) return { graph, helpers: [] };
  const soft = g[noise].inputs.mask, enc = String(g[noise].inputs.samples[0]);
  const vae = (g[enc] && g[enc].inputs || {}).vae;
  if (!isLink(soft) || !isLink(vae)) return { graph, helpers: [] };
  let next = Math.max(0, ...ids.map((k) => parseInt(k, 10)).filter(Number.isFinite)) + 1;
  const nid = () => String(next++);
  // what each sampler reads: its own positive / negative / model, or its guider's
  const samplers = ids.filter((k) => isLink((g[k].inputs || {}).latent_image) && String(g[k].inputs.latent_image[0]) === noise);
  if (!samplers.length) return { graph, helpers: [] };
  const holders = samplers.map((k) => {
    const s = g[k];
    if (isLink(s.inputs.positive)) return { s, h: s, pos: "positive", neg: isLink(s.inputs.negative) ? "negative" : null };
    const G = isLink(s.inputs.guider) ? g[String(s.inputs.guider[0])] : null;
    if (G && isLink((G.inputs || {}).positive)) return { s, h: G, pos: "positive", neg: isLink(G.inputs.negative) ? "negative" : null };
    if (G && isLink((G.inputs || {}).conditioning)) return { s, h: G, pos: "conditioning", neg: null };
    return null;
  }).filter(Boolean);
  if (!holders.length) return { graph, helpers: [] };
  const negOf = (H) => {
    if (H.neg) return H.h.inputs[H.neg];
    const z = nid(); g[z] = { class_type: "ConditioningZeroOut", inputs: { conditioning: H.h.inputs[H.pos] } }; return [z, 0];
  };
  const done = [];
  // Remove: the selection filled by MAT / LaMa first - every later step starts from that picture
  let pix = ["1", 0];
  if (helpers.includes("lama")) {
    const lm = nid(), iw = nid();
    g[lm] = { class_type: "INPAINT_LoadInpaintModel", inputs: { model_name: c.lama } };
    g[iw] = { class_type: "INPAINT_InpaintWithModel", inputs: { inpaint_model: [lm, 0], image: ["1", 0], mask: ["2", 1], seed: 834729 } };
    pix = [iw, 0];
    g[enc].inputs.pixels = pix;
    done.push("lama");
  }
  if (helpers.includes("fooocus")) {
    const lf = nid();
    g[lf] = { class_type: "INPAINT_LoadFooocusInpaint", inputs: { head: c.fooocus.head, patch: c.fooocus.patch } };
    for (const H of holders) {
      const vic = nid(), af = nid();
      g[vic] = { class_type: "INPAINT_VAEEncodeInpaintConditioning", inputs: { vae, pixels: pix, mask: soft, positive: H.h.inputs[H.pos], negative: negOf(H) } };
      g[af] = { class_type: "INPAINT_ApplyFooocusInpaint", inputs: { model: H.h.inputs.model, patch: [lf, 0], latent: [vic, 2] } };
      H.h.inputs.model = [af, 0]; H.h.inputs[H.pos] = [vic, 0]; if (H.neg) H.h.inputs[H.neg] = [vic, 1];
      H.s.inputs.latent_image = [vic, 3];
    }
    // the plain noise mask is not read any more (the conditioning node makes the latent) - its nodes go
    const used = (id) => Object.values(g).some((n) => Object.values((n && n.inputs) || {}).some((v) => isLink(v) && String(v[0]) === id));
    if (!used(noise)) delete g[noise];
    if (!used(enc)) delete g[enc];
    done.push("fooocus");
  } else if (helpers.includes("cn")) {
    const name = arch === "illu" ? c.cn.illu : arch === "sd15" ? c.cn.sd15 : c.cn.flux;
    const cl = nid();
    g[cl] = { class_type: "ControlNetLoader", inputs: { control_net_name: name } };
    let pre = null;
    if (arch !== "flux") {
      pre = nid();
      g[pre] = { class_type: "InpaintPreprocessor", inputs: Object.assign({ image: pix, mask: soft }, c.preprocBlack ? { black_pixel_for_xinsir_cn: arch === "illu" } : {}) };
    }
    for (const H of holders) {
      const ap = nid();
      g[ap] = arch === "flux"
        ? { class_type: "ControlNetInpaintingAliMamaApply", inputs: { positive: H.h.inputs[H.pos], negative: negOf(H), control_net: [cl, 0], vae, image: pix, mask: soft, strength: 0.9, start_percent: 0, end_percent: 0.5 } }
        : { class_type: "ControlNetApplyAdvanced", inputs: { positive: H.h.inputs[H.pos], negative: negOf(H), control_net: [cl, 0], image: [pre, 0], vae, strength: 1, start_percent: 0, end_percent: 1 } };
      H.h.inputs[H.pos] = [ap, 0]; if (H.neg) H.h.inputs[H.neg] = [ap, 1];
    }
    done.push("cn");
  }
  return { graph: g, helpers: done, note: describe(arch, done, c) };
}

/* ---------------- what ComfyUI has (live, cached a minute) ---------------- */
let cached = null, cachedAt = 0;
function combo(node, key) {
  try {
    const spec = ((node.input || {}).required || {})[key] || ((node.input || {}).optional || {})[key];
    if (Array.isArray(spec)) return Array.isArray(spec[0]) ? spec[0] : ((spec[1] || {}).options || []);
    return (spec && spec.options) || [];
  } catch (e) { return []; }
}
const hasInput = (node, key) => !!(node && node.input && ((node.input.required || {})[key] || (node.input.optional || {})[key]));
async function caps(opt) {
  const o = opt || {};
  if (!o.fresh && cached && Date.now() - cachedAt < 60000) return cached;
  let url = "";
  try { url = require("./comfy").comfyCfg().url; } catch (e) { url = ""; }
  const fetchFn = o.fetch || (typeof fetch === "function" ? fetch : null);
  const get = async (cl) => {
    if (!url || !fetchFn) return null;
    try {
      const r = await fetchFn(`${url}/object_info/${encodeURIComponent(cl)}`, { signal: AbortSignal.timeout(o.timeout || 4000) });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j[cl] ? j[cl] : null;
    } catch (e) { return null; }
  };
  const [foo, lam, pre, cnl, lora, ali] = await Promise.all(["INPAINT_LoadFooocusInpaint", "INPAINT_LoadInpaintModel", "InpaintPreprocessor",
    "ControlNetLoader", "LoraLoaderModelOnly", "ControlNetInpaintingAliMamaApply"].map(get));
  const out = capsFrom({ online: !!(cnl || lora), fooocusNodes: !!foo, heads: foo ? combo(foo, "head") : [], patches: foo ? combo(foo, "patch") : [],
    lamaNodes: !!lam, lamas: lam ? combo(lam, "model_name") : [], preproc: !!pre, preprocBlack: hasInput(pre, "black_pixel_for_xinsir_cn"),
    controlnets: cnl ? combo(cnl, "control_net_name") : [], loras: lora ? combo(lora, "lora_name") : [], alimama: !!ali });
  cached = out; cachedAt = Date.now();
  return out;
}
/** what is missing for the Krita way, in words, per family (for the editor's hint) */
function missing(c) {
  const k = c || {}, out = [];
  if (!k.online) return ["ComfyUI is not running - start it to fill the Krita AI way"];
  // 2.557.0: all of it downloads from Settings ▸ Add-ons ▸ AI fill models (lib/aiFillAddon.js)
  if (!k.fooocus) out.push("SDXL / Pony: the Fooocus inpaint patch (comfyui-inpaint-nodes + fooocus_inpaint_head.pth, inpaint_v26.fooocus.patch in models/inpaint)");
  if (!(k.cn && k.cn.illu) || !k.preproc) out.push("Illustrious / NoobAI: noobaiInpainting_v10 in models/controlnet (+ comfyui_controlnet_aux)");
  if (!(k.cn && k.cn.flux) || !k.alimama) out.push("FLUX.1: FLUX.1-dev-Controlnet-Inpainting-Beta in models/controlnet");
  if (!(k.cn && k.cn.sd15) || !k.preproc) out.push("SD 1.5: control_v11p_sd15_inpaint in models/controlnet");
  if (!k.lama) out.push("Remove: MAT_Places512_G_fp16 (or big-lama.pt) in models/inpaint");
  return out.map((m) => m + " - Settings ▸ Add-ons ▸ AI fill models downloads it");
}

module.exports = { archOf, capsFrom, helpersFor, apply, caps, missing, PICK, reset: () => { cached = null; cachedAt = 0; } };   // 2.557.0: reset = ask ComfyUI again (after an Add-ons install)
