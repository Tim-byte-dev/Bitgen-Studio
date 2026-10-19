"use strict";
/**
 * imageRefs.js — REFERENCE PICTURES FOR A FLUX.2 KLEIN 9B RENDER (2.105.0).
 *
 * Tim: "for a flux 9b model use the reference images as the reference images
 * for generation".
 *
 * FLUX.2 Klein has no separate "edit" model: the same 9B weights take
 * reference latents, and the graph shipped as "edit" is simply the
 * text-to-image graph with LoadImage → ReferenceLatent slots wired in. So a
 * text-to-image style can render WITH the reference dock by running its
 * sibling edit workflow, without the user saving a second style or picking
 * anything: pictures in the dock → the references are used; empty dock → the
 * plain text-to-image graph runs as before.
 *
 * Only FLUX.2 Klein 9B styles are swapped (arch `flux2klein9b`); every other
 * family keeps the 2.9x rule: a workflow with LoadImage slots gets the dock,
 * one without refuses it. The sibling is found by NAME beside the style's own
 * workflow (`*_t2i*.json` → `*_edit*.json`, with the verified pair as the
 * fallback), and the swap is recorded on the job so the log says which graph
 * ran and why.
 */
const fs = require("fs");
const path = require("path");

const KLEIN = /flux2klein|flux2_klein|flux\.?2.*klein|flux3klein|flux3[-_]?(image[-_])?klein|flux\.?\s?3.*klein/i;
// 2.502.0: FLUX 3 Image Klein swaps the same way - but ONLY onto FLUX 3 graphs (its weights, text encoder and
// CLIPLoader type differ; a FLUX.2 edit graph would load the wrong model)
const KLEIN3 = /flux3klein|flux3[-_]?(image[-_])?klein|flux\.?\s?3.*klein/i;
const VERIFIED_EDIT = path.join("comfy_workflows", "img_flux2_9b_edit_verified.json");
const KLEIN_EDIT = path.join("comfy_workflows", "img_flux2_klein_edit_9b.json");
const KLEIN3_EDIT = path.join("comfy_workflows", "img_flux3_klein_edit.json");

function isKlein9b(style) {
  const s = style || {};
  return s.engine === "comfy" && (KLEIN.test(String(s.arch || "")) || KLEIN.test(String(s.model || "")));
}
/** 2.502.0: a FLUX 3 Klein style (its arch, model or workflow says so) */
function isKlein3(style) {
  const s = style || {};
  return s.engine === "comfy" && [s.arch, s.model, s.workflow].some((v) => KLEIN3.test(String(v || "")));
}

/** Which loader family a graph uses, so a checkpoint-style is never swapped
 *  onto a UNET-loader graph (the patcher would write the checkpoint name
 *  into unet_name and ComfyUI would refuse it). */
function loaderKind(baseDir, rel) {
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
    const g = JSON.parse(fs.readFileSync(p, "utf8"));
    const types = Object.values(g).map((v) => String((v || {}).class_type || ""));
    if (types.some((t) => /CheckpointLoader/i.test(t))) return "checkpoint";
    if (types.some((t) => /UNETLoader|UnetLoaderGGUF/i.test(t))) return "unet";
    return "";
  } catch { return ""; }
}

function slotsIn(baseDir, rel) {
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(baseDir, rel);
    const g = JSON.parse(fs.readFileSync(p, "utf8"));
    return Object.entries(g).filter(([k, v]) => !k.startsWith("_") && v
      && /loadimage/i.test(String(v.class_type || ""))).length;
  } catch { return 0; }
}

/** Candidate sibling workflows for a t2i workflow, most specific first. */
function siblings(baseDir, rel, flux3) {
  const out = [];
  const r = String(rel || "");
  if (flux3 || KLEIN3.test(r)) {                  // 2.502.0: FLUX 3 -> FLUX 3 graphs only
    if (/_base_t2i/i.test(r)) out.push(r.replace(/_base_t2i/i, "_base_edit"));
    if (/t2i/i.test(r)) out.push(r.replace(/t2i/i, "edit"));
    out.push(KLEIN3_EDIT);
    const seen3 = new Set();
    return out.filter((c) => {
      if (seen3.has(c) || c === r) return false;
      seen3.add(c);
      return fs.existsSync(path.isAbsolute(c) ? c : path.join(baseDir, c));
    });
  }
  if (/t2i/i.test(r)) out.push(r.replace(/t2i/i, "edit"));
  // the klein "verified" pair is named *_9b_t2i_verified / *_9b_edit_verified;
  // the base pair img_flux2_klein_9b_t2i / img_flux2_klein_edit_9b
  if (/klein/i.test(r)) out.push(KLEIN_EDIT);
  out.push(VERIFIED_EDIT, KLEIN_EDIT);
  const seen = new Set();
  return out.filter((c) => {
    if (seen.has(c) || c === r) return false;
    seen.add(c);
    return fs.existsSync(path.isAbsolute(c) ? c : path.join(baseDir, c));
  });
}

/**
 * Decide the workflow for one render. Returns
 *   { workflow, slots, swapped: bool, note }  — always; `swapped` is true only
 * when a Klein t2i style is switched to its reference-conditioned sibling.
 */
function resolve(style, nImages, baseDir) {
  const own = String((style || {}).workflow || "");
  const ownSlots = slotsIn(baseDir, own);
  const n = Math.max(0, parseInt(nImages, 10) || 0);
  if (!n || ownSlots > 0 || !isKlein9b(style))
    return { workflow: own, slots: ownSlots, swapped: false, note: "" };
  const ownKind = loaderKind(baseDir, own);
  const k3 = isKlein3(style), fam = k3 ? "FLUX 3 Klein" : "FLUX.2 Klein 9B";
  for (const c of siblings(baseDir, own, k3)) {
    const s = slotsIn(baseDir, c);
    if (s > 0 && ownKind && loaderKind(baseDir, c) && loaderKind(baseDir, c) !== ownKind) continue;
    if (s > 0)
      return { workflow: c, slots: s, swapped: true,
               note: `${fam} with ${n} reference picture(s): using ${path.basename(c)} `
                   + `(${s} slot(s)) instead of ${path.basename(own)} so the references condition the render` };
  }
  return { workflow: own, slots: 0, swapped: false,
           note: `${fam}: ${n} reference picture(s) given but no sibling edit workflow with LoadImage slots `
               + `and the same loader (${ownKind || "unknown"}) was found beside ${path.basename(own)} — rendering text-to-image` };
}

module.exports = { isKlein9b, isKlein3, slotsIn, siblings, loaderKind, resolve };
