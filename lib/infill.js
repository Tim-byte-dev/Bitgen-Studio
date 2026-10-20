"use strict";
/**
 * infill.js — WHICH GRAPH FILLS A SELECTION (2.108.0).
 *
 * The image editor sends a CROP (the selection plus context) and a MASK PNG
 * (transparent = fill). The render must run at the crop's size and take both
 * pictures. Per style family:
 *
 *   style.inpaint_workflow      a graph the user exported for it — always wins;
 *                               1 LoadImage = the hole is the alpha ("rgba"),
 *                               2 LoadImage = picture + mask ("crop+mask")
 *   FLUX.2 Klein 9B             its reference-latent EDIT graph (lib/imageRefs):
 *                               slot 1 = the crop; the mask is not consumed by
 *                               the graph, the editor composites under it, so
 *                               the result is "regenerate the crop from the
 *                               prompt, keep everything outside the selection"
 *   anything with a checkpoint  comfy_workflows/img_inpaint_sdxl.json — Tim's
 *   loader (SDXL / Pony /       export (2.108.1): dreamshaperXL CLIP/VAE, the
 *   Illustrious …)              SDXL inpaint UNet, SDXL refiner; ONE LoadImage
 *                               whose ALPHA is the mask (LoadImage MASK =
 *                               1 - alpha, transparent = inpaint). Runs SELF-
 *                               CONTAINED: only prompt/negative/seed/picture
 *                               are written, never the style's model or steps.
 *
 *   2.550.0 ANY OTHER STYLE   its OWN text-to-image graph made an inpaint graph (lib/inpaintLatent.js: the crop
 *   (Krea 2, FLUX.2 / FLUX 3 encoded + a noise mask on the latent + DifferentialDiffusion) - a SEAMLESS fill
 *   Klein, Qwen, Z-Image …)     like the Krita AI plugin (Tim: "when a selection is made, it generates a new image not
 *                               a seamless fill/blend like the krita ai does"); `graph` is that graph (the route writes
 *                               it), input "crop+mask"; Refine works (a denoise on the real pixels)
 *
 * Returns {workflow, slots, note} or throws when nothing can take a mask.
 */
const fs = require("fs");
const path = require("path");
const imageRefs = require("./imageRefs");

const SDXL_INPAINT = path.join("comfy_workflows", "img_inpaint_sdxl.json");

function exists(baseDir, rel) { return !!rel && fs.existsSync(path.isAbsolute(rel) ? rel : path.join(baseDir, rel)); }

/** How many model loaders a graph carries. ONE (the FLUX Fill export) means
 *  the style's model/LoRAs can be written into it; SEVERAL (Tim's SDXL
 *  export: inpaint UNet + checkpoint + refiner) means the graph must run as
 *  exported, because overriding one loader breaks the others. */
function modelLoaders(baseDir, rel) {
  try {
    const g = JSON.parse(fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(baseDir, rel), "utf8"));
    return Object.values(g).filter((v) => v && /CheckpointLoader|UNETLoader|UnetLoaderGGUF/i.test(String(v.class_type || ""))).length;
  } catch { return 0; }
}

function resolve(style, baseDir, opts) {   // 2.552.0: opts {grow, feather} = the mask's grow / feather (lib/inpaintLatent.js)
  const s = style || {};
  if (s.engine !== "comfy") throw new Error(`"${s.name || s.id}" is an sd-cli style — infill needs a ComfyUI image style`);
  if (s.inpaint_workflow && exists(baseDir, s.inpaint_workflow))
  {
    const slots = imageRefs.slotsIn(baseDir, s.inpaint_workflow);
    const sc = modelLoaders(baseDir, s.inpaint_workflow) > 1;
    return { workflow: s.inpaint_workflow, slots, takesMask: slots >= 2, input: slots >= 2 ? "crop+mask" : "rgba",
             selfContained: sc,
             note: `infill with the style's inpaint workflow ${path.basename(s.inpaint_workflow)} (${slots >= 2 ? "crop + mask" : "alpha = hole"}; `
                 + (sc ? "runs as exported — several model loaders" : "the style's model and LoRAs are applied") + ")" };
  }
  // 2.550.0: the checkpoint styles keep Tim's SDXL inpaint export (below); every other graph with an empty latent fills
  // seamlessly through its own model
  // 2.555.0 (Tim: "is it possible to use the full krita ai technique ... pony, sdxl, illustrious, klein and flux"): the
  // style's family gets the Krita AI plugin's helper when ComfyUI has it (lib/kritaInpaint.js - opts.caps): SDXL / Pony
  // the Fooocus inpaint patch, Illustrious / SD 1.5 / FLUX.1 an inpainting ControlNet, Remove an inpaint model first. A
  // checkpoint style WITH its helper fills with its OWN model now (Pony stays Pony); without it, the SDXL export as before
  const KI = require("./kritaInpaint");
  const o = opts || {};
  const arch = KI.archOf(s), famHelp = o.caps ? KI.helpersFor(arch, o.caps, "generate") : [];
  if ((imageRefs.loaderKind(baseDir, s.workflow) !== "checkpoint" || famHelp.length) && exists(baseDir, s.workflow)) {
    let g = null;
    try { g = JSON.parse(fs.readFileSync(path.isAbsolute(s.workflow) ? s.workflow : path.join(baseDir, s.workflow), "utf8")); } catch { g = null; }
    let lm = g ? require("./inpaintLatent").latentMaskGraph(g, opts) : null;
    if (lm) {
      const k = o.caps ? KI.apply(lm, arch, o.caps, { mode: o.mode }) : { graph: lm, helpers: [] };
      lm = k.graph;
      return { workflow: s.workflow, graph: lm, slots: 2, takesMask: true, input: "crop+mask", selfContained: false, arch, helpers: k.helpers,
               note: `seamless fill with the style's own graph ${path.basename(s.workflow)} (the picture encoded + a latent noise mask + differential diffusion)` + (k.note || "") };
    }
  }
  if (imageRefs.isKlein9b(s)) {
    const r = imageRefs.resolve(s, 1, baseDir);
    const wf = r.swapped ? r.workflow : (imageRefs.slotsIn(baseDir, s.workflow) > 0 ? s.workflow : null);
    if (wf) return { workflow: wf, slots: imageRefs.slotsIn(baseDir, wf), takesMask: false, input: "crop", selfContained: false,
                     note: `infill via ${imageRefs.isKlein3 && imageRefs.isKlein3(s) ? "FLUX 3" : "FLUX.2"} Klein edit graph ${path.basename(wf)} (the crop is <Picture 1>; the editor blends the result under the mask)` };
  }
  const kind = imageRefs.loaderKind(baseDir, s.workflow);
  if (kind === "checkpoint" && exists(baseDir, SDXL_INPAINT)) {
    // Tim's export (2.108.1): ONE LoadImage whose alpha is the mask, its own
    // inpaint UNet + refiner — run self-contained (no model/steps overrides)
    const slots = imageRefs.slotsIn(baseDir, SDXL_INPAINT);
    return { workflow: SDXL_INPAINT, slots, takesMask: slots >= 2, input: slots >= 2 ? "crop+mask" : "rgba",
             selfContained: modelLoaders(baseDir, SDXL_INPAINT) > 1,
             note: `infill with ${path.basename(SDXL_INPAINT)} (SDXL inpaint UNet + refiner; the hole is the picture's alpha)` };
  }
  throw new Error(`"${s.name || s.id}" has no inpaint path: give the style an inpaint_workflow (a ComfyUI graph with two LoadImage nodes — picture, mask), or use a FLUX.2 Klein 9B or checkpoint-based style`);
}

module.exports = { resolve, modelLoaders, SDXL_INPAINT };
