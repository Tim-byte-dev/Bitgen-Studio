/* bitGen Studio — LTX 2.5 ON COMFY-ORG'S OWN TEMPLATES (2.401.5).
 *
 * Tim (verbatim): "maybe try to find another ltx workflow" - after his all-in-one canvas failed again in his ComfyUI
 * ("ResizeImageMaskNode.execute() missing 1 required positional argument: 'resize_type'", and before it ComfyMath /
 * MediaMixer nodes that are gone or never installed).
 *
 * Comfy-Org publish LTX 2.5 templates (github.com/Comfy-Org/workflow_templates, 2026-08-11): video_ltx2_5_t2v,
 * video_ltx2_5_i2v, video_ltx2_5_flf2v - CORE nodes only (no custom pack at all), one subgraph each. Shipped as
 * comfy_workflows/ltx25_official_{t2v,i2v,flf2v}.json and used for the three plain modes (text / image / first-last
 * frame); the canvas keeps the modes only it has (audio, lipsync, first-middle-last, style transfer, Ripple).
 *
 * The template's subgraph instance carries the job: its widgets are the definition's widget inputs IN DEFINITION
 * ORDER (lib/subgraphs maps them by name). Their internal names differ per template (t2v's prompt is "text", i2v's
 * "value"), their LABELS do not, so each is filled by its role (roleOf): prompt, prompt_enhance (off), duration,
 * width / height (fed by a ResolutionSelector - unwired here, the job's size wins), seed, frame_rate, unet_name,
 * video_vae, audio_vae, clip_name (Gemma text encoder), upscale_model (t2v / i2v), prompt_enhance_model.
 *
 *   prepare(ui, opts) -> {ui, notes, models}   opts {mode, prompt, seconds, width, height, seed, fps, images: [names],
 *                                              prefix, lists: {unet, gguf, vae, clip, upscale}, style: {model, te}}
 *   pickModels(lists, style, mode) -> {unet, gguf, vae, avae, te, up, e2b, notes} | {error}
 * Pure (no fs except template()); scripts/ltx_convert.js runs it, ltx_worker.py swaps a .gguf model onto the GGUF
 * loader and adds the style's LoRAs on the API prompt.
 *
 * 2.402.0 LTX 2.3 (Tim: "https://huggingface.co/fal/LTX-2.3-3DREAL-LoRA, can we use this lora and our blender bridge
 * to layout a 3d scene in blender and render it in bitgen using ltx2.3 - please add a style for ltx2.3"): a second
 * FAMILY, "ltx23" (styles of arch "ltx-2.3"), on Comfy-Org's LTX 2.3 templates (video_ltx2_3_t2v / _i2v / _flf2v and
 * video_ltx2_3_ic_lora - core nodes only), shipped as comfy_workflows/ltx23_official_*.json. Its modes: t2v, i2v, flf
 * and "3dreal" - the IC-LoRA template with fal's 3DREAL LoRA as its ic_lora and the RAW render (a Blender layout, a
 * game viewport, any CG clip) as its control_images: the depth branch (MoGe) is cut out, the render's frames go
 * straight to the guide, its first frame is only a placeholder for the first-frame input (bypassed) unless the
 * reference dock gives a real first picture. LTX 2.3 loads ONE checkpoint (CheckpointLoaderSimple + the audio VAE
 * and the Gemma 3 text encoder from the same file): t2v / i2v want the dev fp8 + the distilled LoRA, flf / 3dreal the
 * distilled fp8; with only the distilled checkpoint t2v / i2v run on it and the distilled LoRA is left out. A LoRA
 * this ComfyUI does not have (the Gemma "abliterated" LoRA) is marked DROP and ltx_graph.official_finish takes its
 * loader out of the API graph (its users wired to what fed it). */
"use strict";
const fs = require("fs");
const path = require("path");

const MODES = { t2v: "ltx25_official_t2v.json", i2v: "ltx25_official_i2v.json", flf: "ltx25_official_flf2v.json" };
// 2.402.0: LTX 2.3 - Comfy-Org's templates, + the IC-LoRA one for 3DREAL (render -> real)
const MODES23 = { t2v: "ltx23_official_t2v.json", i2v: "ltx23_official_i2v.json", flf: "ltx23_official_flf2v.json",
                  "3dreal": "ltx23_official_ic_lora.json" };
const FAMILY_MODES = {
  ltx23: [
    { id: "t2v", label: "Text to video", needs: {} },
    { id: "i2v", label: "Image to video (first frame)", needs: { images: 1 } },
    { id: "flf", label: "First / last frame", needs: { images: 2 } },
    { id: "3dreal", label: "3D render -> real (3DREAL, a video)", needs: { video: true } },
  ],
};
const DROP = "__bitgen_drop__";
const DEFAULTS23 = {
  dev: "ltx-2.3-22b-dev-fp8.safetensors",
  distilled: "ltx-2.3-22b-distilled-fp8.safetensors",
  dlora: "ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
  glora: "gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors",
  te: "gemma_3_12B_it_fp4_mixed.safetensors",
  up: "ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
  // fal's 3DREAL IC-LoRA (huggingface.co/fal/LTX-2.3-3DREAL-LoRA): strong-v2 = the newest (multi-scene, audio, better
  // faces), strong = a harder photoreal push, light = faithful / gentle
  iclora: "3DREAL-strong-v2.safetensors",
  iclora_all: ["3DREAL-strong-v2.safetensors", "3DREAL-strong.safetensors", "3DREAL-light.safetensors"],
};
const LTX23 = /ltx[-_ .]?2[._]3/i;
/** "ltx23" for an LTX 2.3 style (arch ltx-2.3), else "ltx25". */
const familyOf = (style) => (style && (style.arch === "ltx-2.3" || style.family === "ltx23") ? "ltx23" : "ltx25");
/** 3DREAL's trigger at the very start of the prompt (the LoRA card: "3DREAL. Make it photorealistic. <scene>"). */
function prompt3d(p) {
  const t = String(p || "").trim();
  if (/^3DREAL\b/i.test(t)) return t.replace(/^3dreal/i, "3DREAL");
  return "3DREAL. Make it photorealistic." + (t ? " " + t : "");
}
const DEFAULTS = {
  unet: "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors",
  vae: "ltx-2.5-video-vae-bf16.safetensors",
  avae: "ltx-2.5-audio-vae-bf16.safetensors",
  te: "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors",
  up: "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors",
  e2b: "gemma4_e2b_it_int8_convrot.safetensors",
};
const LTX25 = /ltx[-_ .]?2[._]5/i;
const base = (p) => String(p || "").split(/[\\/]/).pop();

/** The template file a mode runs on, or "" (the canvas runs it). */
function template(mode, root, family) {
  const f = (family === "ltx23" ? MODES23 : MODES)[String(mode || "")];
  if (!f) return "";
  const p = path.join(root || path.join(__dirname, ".."), "comfy_workflows", f);
  return fs.existsSync(p) ? p : "";
}

/** list -> the entry whose file name is `want` (any folder), else null */
function hit(list, want) {
  if (!want) return null;
  const w = base(want).toLowerCase();
  return (list || []).find((x) => base(x).toLowerCase() === w) || null;
}
const find = (list, rx, not) => (list || []).filter((x) => rx.test(base(x)) && !(not && not.test(base(x)))).sort()[0] || null;

/** Which files the job runs on, from what ComfyUI lists. */
function pickModels(lists, style, mode) {
  const L = lists || {}, st = style || {}, notes = [];
  const unets = L.unet || [], ggufs = L.gguf || [], vaes = L.vae || [], clips = L.clip || [], ups = L.upscale || [];
  // the transformer: the style's file, the template's int8, any LTX 2.5 safetensors, any LTX 2.5 GGUF
  let unet = null, gguf = false;
  const want = base(st.model);
  if (want) {
    unet = hit(unets, want) || hit(ggufs, want);
    gguf = !!unet && /\.gguf$/i.test(unet);
    if (!unet) notes.push(`the style's model ${want} is not in ComfyUI's lists - the best LTX 2.5 file it has instead`);
  }
  if (!unet) unet = hit(unets, DEFAULTS.unet);
  if (!unet) unet = find(unets, LTX25, /upscal|vae|audio|lora/i);
  if (!unet) { unet = find(ggufs, LTX25); gguf = !!unet; }
  if (!unet) return { error: `no LTX 2.5 model in ComfyUI - put ${DEFAULTS.unet} in models/diffusion_models (or the GGUF LTX-2.5-Distilled-Q4_K_M.gguf in models/diffusion_models with ComfyUI-GGUF) - Setup -> Models -> LTX` };
  const vae = hit(vaes, DEFAULTS.vae) || find(vaes, /ltx.*video.*vae|ltx.*vae.*video/i);
  const avae = hit(vaes, DEFAULTS.avae) || find(vaes, /ltx.*audio.*vae|ltx.*vae.*audio/i);
  if (!vae || !avae) return { error: `the LTX 2.5 ${!vae ? "video" : "audio"} VAE is not in ComfyUI's models/vae - ${!vae ? DEFAULTS.vae : DEFAULTS.avae} (Setup -> Models -> LTX)` };
  const te = hit(clips, base(st.te)) || hit(clips, DEFAULTS.te) || find(clips, /gemma.?4.*(12b|27b|ltx)/i) || find(clips, /gemma/i);
  if (!te) return { error: `no Gemma text encoder for LTX 2.5 in ComfyUI's models/text_encoders - ${DEFAULTS.te}` };
  let up = null;
  if (mode !== "flf") {
    up = hit(ups, DEFAULTS.up) || find(ups, /ltx.*2[._]5.*(upscal|spatial)/i) || find(ups, /ltx.*(upscal|spatial)/i);
    if (!up) return { error: `the LTX 2.5 x2 latent upscaler is not in ComfyUI's models/latent_upscale_models - ${DEFAULTS.up}` };
  }
  // the prompt enhancer is switched OFF - its small Gemma is only validated, never loaded: any listed file will do
  let e2b = hit(clips, DEFAULTS.e2b) || find(clips, /gemma.?4.?e2b/i);
  if (!e2b) { e2b = te; notes.push("no small Gemma (gemma4_e2b) for the prompt enhancer - it is off; the text encoder stands in for its loader"); }
  if (gguf) notes.push(`model ${unet} (GGUF - run on ComfyUI-GGUF's loader)`);
  return { unet, gguf, vae, avae, te, up, e2b, notes };
}

/** 2.402.0: which files an LTX 2.3 job runs on. lists {ckpt, te, loras, upscale} (ComfyUI's CheckpointLoaderSimple,
 *  LTXAVTextEncoderLoader, LoraLoaderModelOnly, LatentUpscaleModelLoader lists), style {model, te}, want {ic_lora}. */
function pickModels23(lists, style, mode, want) {
  const L = lists || {}, st = style || {}, w = want || {}, notes = [];
  const ckpts = L.ckpt || [], tes = L.te || [], loras = L.loras || [], ups = L.upscale || [];
  const isDist = (x) => /distill/i.test(base(x));
  const wantDev = mode === "t2v" || mode === "i2v";
  let ckpt = null;
  if (base(st.model)) {
    ckpt = hit(ckpts, st.model);
    if (!ckpt) notes.push(`the style's model ${base(st.model)} is not in ComfyUI's checkpoints - the best LTX 2.3 file it has instead`);
  }
  if (!ckpt) ckpt = hit(ckpts, wantDev ? DEFAULTS23.dev : DEFAULTS23.distilled) || hit(ckpts, wantDev ? DEFAULTS23.distilled : DEFAULTS23.dev)
    || find(ckpts.filter((x) => isDist(x) === !wantDev), LTX23) || find(ckpts, LTX23);
  if (!ckpt) return { error: `no LTX 2.3 checkpoint in ComfyUI's models/checkpoints - put ${DEFAULTS23.distilled} there (huggingface.co/Lightricks/LTX-2.3-fp8; Setup -> Models -> Video - LTX 2.3)` };
  const te = hit(tes, st.te) || hit(tes, DEFAULTS23.te) || find(tes, /gemma.?3.*12b/i) || find(tes, /gemma/i);
  if (!te) return { error: `no Gemma 3 12B text encoder in ComfyUI's models/text_encoders - ${DEFAULTS23.te} (huggingface.co/Comfy-Org/ltx-2)` };
  let dlora = DROP;
  if (wantDev && !isDist(ckpt)) {
    dlora = hit(loras, DEFAULTS23.dlora) || find(loras, /ltx.?2[._]3.*distill/i);
    if (!dlora) return { error: `the LTX 2.3 dev checkpoint needs the distilled LoRA ${DEFAULTS23.dlora} in models/loras (huggingface.co/Comfy-Org/ltx-2.3) - or put the distilled checkpoint ${DEFAULTS23.distilled} in models/checkpoints` };
  } else if (wantDev) notes.push(`${base(ckpt)} is the distilled checkpoint - the template's distilled LoRA is left out`);
  let glora = hit(loras, DEFAULTS23.glora) || find(loras, /gemma.*abliterat/i);
  if (!glora) glora = DROP;                                  // (said by prepare when the template has one)
  let up = null;
  if (wantDev) {
    up = hit(ups, DEFAULTS23.up) || find(ups, /ltx.?2[._]3.*(spatial|upscal)/i);
    if (!up) return { error: `the LTX 2.3 x2 spatial upscaler is not in ComfyUI's models/latent_upscale_models - ${DEFAULTS23.up} (huggingface.co/Lightricks/LTX-2.3)` };
  }
  let iclora = null;
  if (mode === "3dreal") {
    iclora = hit(loras, w.ic_lora);
    if (w.ic_lora && !iclora) notes.push(`${base(w.ic_lora)} is not in ComfyUI's loras - the 3DREAL file it has instead`);
    for (const f of DEFAULTS23.iclora_all) if (!iclora) iclora = hit(loras, f);
    if (!iclora) iclora = find(loras, /3d.?real/i);
    if (!iclora) return { error: `fal's 3DREAL IC-LoRA is not in ComfyUI's models/loras - put ${DEFAULTS23.iclora} (or 3DREAL-light / 3DREAL-strong) there: huggingface.co/fal/LTX-2.3-3DREAL-LoRA (Setup -> Models -> Video - LTX 2.3)` };
  }
  return { ckpt, te, dlora, glora, up, iclora, distilled: isDist(ckpt), notes };
}

/** the subgraph instance + its definition */
function instanceOf(ui) {
  const defs = ((ui.definitions || {}).subgraphs) || [];
  for (const n of ui.nodes || []) {
    const d = defs.find((x) => String(x.id) === String(n.type));
    if (d) return { inst: n, def: d };
  }
  return null;
}
const WT = ["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"];
/** What a subgraph widget input IS, by its label (then its name): prompt, enhance, seconds, width, height, seed,
 *  fps, unet, vae, avae, te, up, e2b - or null (left as the template saved it). */
function roleOf(d) {
  const l = String(d.label || d.localized_name || "").toLowerCase(), n = String(d.name || ""), t = String(d.type || "");
  if (!WT.includes(t)) return null;                           // pictures / control frames are wired, not typed
  if (/prompt_?enhance_?model/.test(l)) return "e2b";
  if (/prompt_?enhance/.test(l)) return "enhance";
  if (l === "prompt" || (!l && t === "STRING")) return "prompt";   // 2.3's t2v / flf: an unlabelled "value" / "text"
  if (/duration|seconds|length/.test(l)) return "seconds";
  if (/^width/.test(l)) return "width";
  if (/^height/.test(l)) return "height";
  if (/seed/.test(l) || n === "noise_seed") return "seed";
  if (/^fps$|frame_?rate|fram_?rate/.test(l)) return "fps";
  if (/video_?vae/.test(l)) return "vae";
  if (/audio_?vae/.test(l)) return "avae";
  if (/upscale/.test(l)) return "up";
  // 2.402.0: LTX 2.3
  if (l === "ckpt_name" || (!l && /^ckpt_name/.test(n))) return "ckpt";
  if (/distilled_?lora/.test(l)) return "dlora";
  if (l === "ic_lora") return "iclora";
  if (l === "lora_strength") return "icstr";
  if (l === "lora") return "glora";
  if (l === "text_encoder" || (!l && n === "text_encoder")) return "te";
  if (n === "unet_name") return "unet";
  if (n === "clip_name") return "te";
  return null;
}

/** a link's id / origin / target, both link shapes */
const lid = (l) => String(Array.isArray(l) ? l[0] : l.id);
function unlink(ui, ids) {
  const drop = new Set([...ids].map(String));
  ui.links = (ui.links || []).filter((l) => !drop.has(lid(l)));
  for (const n of ui.nodes) {
    for (const out of n.outputs || []) if (Array.isArray(out.links)) out.links = out.links.filter((x) => !drop.has(String(x)));
    for (const inp of n.inputs || []) if (inp.link != null && drop.has(String(inp.link))) inp.link = null;
  }
}
/** 2.402.0 3DREAL: the render's frames straight into control_images (the MoGe depth branch cut out), the render on
 *  LoadVideo, Video Slice = the clip's window, the first-frame input bypassed unless a real first picture is given. */
function rewire3d(ui, inst, def, o, notes) {
  const ctl = (inst.inputs || []).find((i) => /control/i.test(String(i.label || "")) || i.name === "input_1");
  const lv = ui.nodes.find((n) => n.type === "LoadVideo");
  const vs = ui.nodes.find((n) => n.type === "Video Slice");
  if (!ctl || !lv || !vs) throw new Error("Comfy-Org's LTX 2.3 IC-LoRA template has no control_images / LoadVideo / Video Slice - re-download it");
  if (!o.video) throw new Error("3D render -> real needs the render: a video in the reference dock (or send it from Blender)");
  // the depth branch (a subgraph instance fed by Video Slice) + its preview go
  const defs = new Set(((ui.definitions || {}).subgraphs || []).map((d) => String(d.id)));
  const gone = new Set(ui.nodes.filter((n) => n !== inst && (defs.has(String(n.type)) || n.type === "PreviewImage")).map((n) => String(n.id)));
  const dead = (ui.links || []).filter((l) => { const a = Array.isArray(l) ? [l[1], l[3]] : [l.origin_id, l.target_id]; return gone.has(String(a[0])) || gone.has(String(a[1])); }).map(lid);
  unlink(ui, dead);
  ui.nodes = ui.nodes.filter((n) => !gone.has(String(n.id)));
  ui.definitions.subgraphs = ui.definitions.subgraphs.filter((d) => String(d.id) === String(def.id));
  // Video Slice -> GetVideoComponents -> control_images
  const nid = 1 + Math.max(0, ...ui.nodes.map((n) => +n.id || 0));
  let L = 1 + Math.max(0, ...(ui.links || []).map((l) => +lid(l) || 0));
  if (!vs.outputs || !vs.outputs[0]) vs.outputs = [{ name: "VIDEO", type: "VIDEO", links: [] }];
  vs.outputs[0].links = (vs.outputs[0].links || []).concat([L]);
  ui.links.push([L, vs.id, 0, nid, 0, "VIDEO"]);
  const L2 = L + 1;
  ui.nodes.push({ id: nid, type: "GetVideoComponents", pos: [0, 0], size: [240, 120], flags: {}, order: 0, mode: 0,
    inputs: [{ name: "video", type: "VIDEO", link: L }],
    outputs: [{ name: "images", type: "IMAGE", links: [L2] }, { name: "audio", type: "AUDIO", links: [] },
              { name: "fps", type: "FLOAT", links: [] }], properties: {}, widgets_values: [] });
  ui.links.push([L2, nid, 0, inst.id, (inst.inputs || []).indexOf(ctl), "IMAGE"]);
  ctl.link = L2;
  lv.widgets_values = [String(o.video), "image"];
  const secs = Math.max(1, Math.round(+o.seconds || 5));
  vs.widgets_values = [Math.max(0, +o.video_start || 0), secs, false];
  notes.push(`3DREAL: the render ${o.video} from ${Math.max(0, +o.video_start || 0)}s, ${secs}s -> control frames (no depth pass)`);
  // the first frame: a real picture conditions it; without one the render's own first frame only fills the input
  const real = !!o.first_real;
  for (const n of def.nodes || []) if (n.type === "LTXVImgToVideoInplace") {
    const w = Array.isArray(n.widgets_values) ? n.widgets_values : [1, false];
    n.widgets_values = [w[0] == null ? 1 : w[0], !real];
  }
  notes.push(real ? "3DREAL: the first picture sets the first frame" : "3DREAL: no first picture - the first-frame conditioning is bypassed (the render leads)");
}

/** Fill the template for one job. Returns {ui, notes, models} or throws an Error with the words. */
function prepare(ui0, opts) {
  const o = opts || {};
  const fam = o.family === "ltx23" ? "ltx23" : "ltx25";
  const NAME = fam === "ltx23" ? "LTX 2.3" : "LTX 2.5";
  const ui = JSON.parse(JSON.stringify(ui0));
  const notes = [];
  const pair = instanceOf(ui);
  if (!pair) throw new Error(`not a Comfy-Org ${NAME} template (no subgraph instance)`);
  const { inst, def } = pair;
  const m = fam === "ltx23" ? pickModels23(o.lists, o.style, o.mode, { ic_lora: o.ic_lora }) : pickModels(o.lists, o.style, o.mode);
  if (m.error) throw new Error(m.error);
  notes.push(...m.notes);
  const W = Math.max(64, Math.round((+o.width || 1280) / 32) * 32), H = Math.max(64, Math.round((+o.height || 720) / 32) * 32);
  if (W !== +o.width || H !== +o.height) notes.push(`size ${o.width}x${o.height} -> ${W}x${H} (LTX wants multiples of 32)`);
  const byRole = {
    prompt: o.mode === "3dreal" ? prompt3d(o.prompt) : String(o.prompt || ""), enhance: false,
    seconds: Math.max(1, Math.round(+o.seconds || 5)),
    width: W, height: H, seed: Math.max(0, Math.floor(+o.seed || 0)), fps: Math.max(1, Math.round(+o.fps || 24)),
    unet: m.unet, vae: m.vae, avae: m.avae, te: m.te, up: m.up, e2b: m.e2b,
    ckpt: m.ckpt, dlora: m.dlora, glora: m.glora, iclora: m.iclora,
    icstr: Math.max(0, Math.min(2, o.ic_strength == null || o.ic_strength === "" ? 1 : +o.ic_strength)),
  };
  // the instance's widgets: the definition's widget inputs in order, each by its ROLE (the internal names differ
  // per template - t2v's prompt is "text", i2v's "value" - the labels do not: prompt, duration, width ...)
  const wdefs = (def.inputs || []).filter((d) => WT.includes(String(d.type || "")));
  const old = Array.isArray(inst.widgets_values) ? inst.widgets_values : [];
  inst.widgets_values = wdefs.map((d, i) => { const r = roleOf(d); return r && byRole[r] != null ? byRole[r] : old[i]; });
  const roles = Object.fromEntries(wdefs.map((d) => [String(d.name), roleOf(d)]));
  // the job's size wins over a ResolutionSelector wired into width / height
  const drop = new Set();
  for (const inp of inst.inputs || []) {
    if (!["width", "height"].includes(roles[String(inp.name)]) || inp.link == null) continue;
    drop.add(String(inp.link)); inp.link = null;
  }
  if (drop.size) {
    unlink(ui, drop);
    // a selector left feeding nothing goes
    ui.nodes = ui.nodes.filter((n) => !(n.type === "ResolutionSelector" && !(n.outputs || []).some((x) => (x.links || []).length)));
    notes.push(`size ${W}x${H} (the template's resolution picker unwired)`);
  }
  if (o.mode === "3dreal") rewire3d(ui, inst, def, o, notes);
  // pictures: the LoadImage behind the instance's first image input, then the second (first / last frame)
  const imgIns = (inst.inputs || []).filter((i) => /IMAGE/.test(String(i.type || "")) && i.link != null
    && !/control/i.test(String(i.label || "")) && !(o.mode === "3dreal" && i.name === "input_1"));
  const imgs = Array.isArray(o.images) ? o.images : [];
  const need = o.mode === "flf" ? 2 : (o.mode === "i2v" || o.mode === "3dreal") ? 1 : 0;
  if (imgs.length < need) throw new Error(o.mode === "3dreal" ? "3D render -> real needs a first-frame picture (the worker takes it from the render)"
    : `${NAME} ${o.mode === "flf" ? "first / last frame needs two pictures" : "image to video needs a picture"} in the reference dock`);
  imgIns.slice(0, need).forEach((inp, k) => {
    const l = (ui.links || []).find((x) => lid(x) === String(inp.link));
    const from = l && (Array.isArray(l) ? l[1] : l.origin_id);
    const li = ui.nodes.find((n) => String(n.id) === String(from) && n.type === "LoadImage");
    if (li) { li.widgets_values = [imgs[k], "image"]; notes.push(`${k === 0 ? (need === 2 ? "first frame" : "picture") : "last frame"}: ${imgs[k]}`); }
  });
  for (const n of ui.nodes) if (n.type === "SaveVideo") {
    const w = Array.isArray(n.widgets_values) ? n.widgets_values : [];
    n.widgets_values = [o.prefix || "bitgen_ltx"].concat(w.length > 1 ? w.slice(1) : ["auto", "auto"]);
  }
  ui.nodes = ui.nodes.filter((n) => n.type !== "MarkdownNote" && n.type !== "Note");
  const want = fam === "ltx23"
    ? ["prompt", "width", "height", "seed", "fps", "ckpt", "te"].concat(o.mode === "3dreal" ? ["iclora"] : ["seconds"])
    : ["prompt", "seconds", "width", "height", "seed", "fps", "unet", "vae", "te"];
  const miss = want.filter((r) => !Object.values(roles).includes(r));
  if (miss.length) throw new Error(`Comfy-Org's ${NAME} template has no ${miss.join(" / ")} input - re-download it`);
  if (m.glora === DROP && Object.values(roles).includes("glora")) notes.push(`no ${DEFAULTS23.glora} in models/loras - the text encoder runs without it`);
  if (m.iclora) notes.push(`3DREAL IC-LoRA ${m.iclora} @ ${byRole.icstr}`);
  if (m.ckpt) notes.push(`checkpoint ${m.ckpt} · text encoder ${m.te}`);
  notes.push(`Comfy-Org's ${NAME} ${o.mode} template: ${W}x${H}, ${byRole.seconds}s at ${byRole.fps} fps, seed ${byRole.seed}`);
  return { ui, notes, models: m };
}

module.exports = { MODES, MODES23, FAMILY_MODES, DEFAULTS, DEFAULTS23, DROP, familyOf, prompt3d, template, pickModels,
                   pickModels23, prepare, instanceOf, roleOf };
