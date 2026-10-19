// bitGen Studio — BASIC SETTINGS -> CONTROLNET (2.316.0, reshaped 2.317.0).
//
// Tim (verbatim, 2.316.0): "add controlnet accordian menuitem to basic
// settings in left docker, checkbox - use controlnet, dropdown-types,
// dropdown-preprocessor, dropdown model folder, dropdown model, cfg slider,
// steps slider, lora folder, lora dropdown, add lora button, lora weight
// slider. show the first image generated, the controlnet preprocessor gen and
// the final generation in the gallery"
// 2.317.0 (Tim): "the model will be a diffusion model or checkpoint, the
// preprocessor will be the controlnet model from controlnet folder in
// comfyui, this will generate an image in one model, create the controlnet
// image then generate the image from the second model. second model can be
// sdxl or flux klein etc."
//
// One record per project, projects/<p>/controlnet_basic.json (v 2):
//   enabled     "Use ControlNet"
//   type        pose | scribble | lineart | depth - which annotator node makes
//               the control image (its own default annotator model)
//   controlnet  THE "PREPROCESSOR" DROPDOWN: the ControlNet model from
//               ComfyUI's models/controlnet
//   model       THE SECOND MODEL: a checkpoint or diffusion model that renders
//               the final image; model_cat = its ComfyUI category
//   cfg / steps the second render's; null = its workflow's own
//   strength    ControlNetApplyAdvanced strength (1)
//   use_main_prompt / prompt / negative / end  2.321.0 (Tim: "add the second
//               model prompt + negative prompt, the strength slider and the
//               end slider and a checkbox above the positive prompt to use
//               prompt docker prompt"): use_main_prompt (default ON) = the
//               second model renders the prompt docker's prompt; OFF = its
//               own `prompt`; `negative` ("" = the first render's); `end` =
//               ControlNetApplyAdvanced end_percent (0.05..1, default 1)
//   pose_face   2.322.0 - DWPose's face points (default OFF: a cartoon's
//               face landmarks squeeze a real face into cartoon proportions)
//   final_only  2.320.0 (Tim: "show the final image only, if checked don't
//               show the first generation or controlnet image in the gallery,
//               put them in projectname\temp\controlnet, name them
//               gen_filename, ctn_filename, use the ctn filename to generate
//               the final image") - the job gets temp_dir =
//               projects/<p>/temp/controlnet (routes/index.js)
// The second model's workflow (secondStyle): an image style that already
// uses that file (its workflow, text encoder, VAE) - else a shipped template
// by family (FLUX.2 Klein unet / base / checkpoint, else a checkpoint ->
// SDXL). The ControlNet LoRAs ("cnet" temporary list) ride the second model.
"use strict";
const fs = require("fs");
const path = require("path");
const cnTypes = require("./controlnetTypes");

const FILE = "controlnet_basic.json";
const CATS = ["checkpoints", "diffusion_models"];
const DEFAULTS = Object.freeze({ v: 2, enabled: false, type: "pose", controlnet: "", model: "",
  model_cat: "", cfg: null, steps: null, strength: 1, final_only: false,
  use_main_prompt: true, prompt: "", negative: "", end: 1, pose_face: false });
const TEMPLATES = Object.freeze({
  sdxl: "comfy_workflows/img_sdxl_t2i.json",
  klein: "comfy_workflows/img_flux2_klein_9b_t2i.json",
  klein_base: "comfy_workflows/img_flux2_klein_base_9b_t2i.json",
  klein_ckpt: "comfy_workflows/img_flux2_klein_9b_ckpt_t2i.json",
});

function str(v, n) {
  const s = String(v == null ? "" : v).trim();
  return s && !s.includes("..") ? s.slice(0, n) : "";
}
const slash = (s) => String(s || "").replace(/\\/g, "/");
// prompts keep every character (an ellipsis is not a path escape)
const text = (v, n) => String(v == null ? "" : v).replace(/\r\n/g, "\n").trim().slice(0, n);

function normalize(b, old) {
  let src = { ...DEFAULTS, ...(old || {}), ...(b || {}) };
  // a 2.316.0 record kept the ControlNet in `model`: it moves to `controlnet`
  const was = { ...(old || {}), ...(b || {}) };
  if (was.v !== 2 && was.model && !was.controlnet) src = { ...src, controlnet: was.model, model: "", model_cat: "" };
  const out = { ...DEFAULTS };
  out.enabled = src.enabled === true;
  out.final_only = src.final_only === true;
  out.pose_face = src.pose_face === true;                      // 2.322.0
  out.type = cnTypes.normType(src.type) || "pose";
  out.controlnet = str(src.controlnet, 300);
  out.model = str(src.model, 300);
  out.model_cat = CATS.includes(String(src.model_cat)) ? String(src.model_cat) : "";
  const c = src.cfg === "" || src.cfg == null ? NaN : Number(src.cfg);
  out.cfg = Number.isFinite(c) && c > 0 && c <= 30 ? Math.round(c * 10) / 10 : null;
  const st = parseInt(src.steps, 10);
  out.steps = Number.isFinite(st) && st >= 1 && st <= 150 ? st : null;
  const sg = Number(src.strength);
  out.strength = Number.isFinite(sg) ? Math.max(0, Math.min(2, Math.round(sg * 100) / 100)) : 1;
  out.use_main_prompt = src.use_main_prompt !== false;          // 2.321.0: ON unless unticked
  out.prompt = text(src.prompt, 4000);
  out.negative = text(src.negative, 2000);
  const en = Number(src.end);
  out.end = Number.isFinite(en) ? Math.max(0.05, Math.min(1, Math.round(en * 100) / 100)) : 1;
  return out;
}

function fileFor(projDir) { return path.join(projDir, FILE); }

function read(projDir) {
  try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); }
  catch { return normalize({}); }
}

function save(projDir, patch) {
  const n = normalize(patch, read(projDir));
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(n, null, 2));
  return n;
}

/** The second model's style: {style, how} or {error}. styleList = the
 *  image styles (lib/styles read). baseDir checks the template ships. */
function secondStyle(rec, styleList, baseDir) {
  const r = normalize(rec);
  if (!r.model) return { error: "pick the second model (Basic Settings -> ControlNet -> Model) - the "
    + "checkpoint or diffusion model that renders the final image" };
  const own = (styleList || []).find((s) => s && s.kind !== "music" && !s.chain
    && (s.engine || "comfy") === "comfy" && s.workflow && slash(s.model) === slash(r.model));
  if (own) return { style: { ...own, loras: [] },
    how: `the image style "${own.name}" (it renders ${r.model}) - its workflow, text encoder and VAE` };
  const n = path.basename(slash(r.model)).toLowerCase();
  let wf = "", arch = "";
  if (/klein/.test(n)) {
    arch = "flux2klein9b";
    wf = r.model_cat === "checkpoints" ? TEMPLATES.klein_ckpt : /base/.test(n) ? TEMPLATES.klein_base : TEMPLATES.klein;
  } else if (r.model_cat !== "diffusion_models") { arch = "sdxl"; wf = TEMPLATES.sdxl; }
  if (!wf) return { error: `no workflow is known for the diffusion model ${r.model} - save an image style `
    + "that uses it (Settings -> Image) and ControlNet renders the final image through that style" };
  if (baseDir && !fs.existsSync(path.join(baseDir, wf)))
    return { error: `${wf} is missing - restore it from the install zip` };
  return { style: { id: "cn_second", name: `ControlNet: ${path.basename(slash(r.model))}`, kind: "image",
                    engine: "comfy", arch, workflow: wf, model: r.model, model_override: true, loras: [] },
           how: `${path.basename(wf)} with ${r.model}` };
}

/** What an image job carries: null (off), {error}, or the block. */
function jobSpec(rec, loras, styleList, baseDir) {
  const r = normalize(rec);
  if (!r.enabled) return null;
  if (!r.controlnet) return { error: "Use ControlNet is ticked but no ControlNet is picked "
    + "(Basic Settings -> ControlNet -> Preprocessor, a model from ComfyUI's models/controlnet) - pick one, or untick Use ControlNet" };
  if (!r.use_main_prompt && !r.prompt) return { error: "the second model's prompt is empty "
    + "(Basic Settings -> ControlNet) - write it, or tick Use prompt docker prompt" };
  const sec = secondStyle(r, styleList, baseDir);
  if (sec.error) return { error: sec.error };
  const t = cnTypes.TYPES.find((x) => x.id === r.type);
  return { type: r.type, node: t.node, controlnet: r.controlnet, strength: r.strength,
           cfg: r.cfg, steps: r.steps, second: sec.style, second_how: sec.how, final_only: r.final_only,
           end: r.end, use_main_prompt: r.use_main_prompt, pose_face: r.pose_face,
           ...(r.use_main_prompt ? {} : { prompt: r.prompt }), ...(r.negative ? { negative: r.negative } : {}),
           loras: (Array.isArray(loras) ? loras : []).map((l) => ({ path: l.path, weight: l.weight })) };
}

module.exports = { FILE, CATS, DEFAULTS, TEMPLATES, normalize, read, save, fileFor, secondStyle, jobSpec };
