// bitGen Studio — lib/modelFit.js (2.540.3): DOES A MODEL FIT A STYLE'S WORKFLOW?
//
// Tim's first install from GitHub: "all image models work except sdxl and qwen2_1 and flux3klein" - the logs showed
// Qwen Image 2.1 edit rendering with anima/animakimi_v13 ("mat1 and mat2 shapes cannot be multiplied (35x4096 and
// 1024x2048)") and FLUX 3 Klein with illustrious/perfectdeliberate_v30 ("'NoneType' object has no attribute 'shape'"):
// Basic Settings' checkpoint override (or the 🧩 Model manager's "Override the style's model") was on, and it was put
// into EVERY style's workflow, whatever family the model is. A checkpoint only works in a workflow built for its
// family: an SDXL / Illustrious / Pony file in an SDXL workflow, a FLUX 3 Klein file in a FLUX 3 Klein one.
//
//   fit(style, modelName, family?) -> {ok, family, label, arch, styleArch, why}
//       the model's family: the 🧩 card's (your edit > Civitai > the file's header > its name) when one is given, else
//       guessed from the name (lib/modelCards.nameFamily); a family with no architecture (other, HiDream…) or a style
//       with none = ok (nothing to compare - the render decides)
//   familyOf(modelName) -> the card's family (the Model manager's scan, cached) or the name's guess
//   note(style, f) -> the line the worker log shows when the override is left out for this render
"use strict";
const MC = require("./modelCards");

const norm = (s) => String(s || "").replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();

/** the model's family: the Model manager's card for that file, else its name */
function familyOf(modelName) {
  const n = norm(modelName);
  if (!n) return "";
  try {
    const d = MC.list();
    const c = ((d && d.models) || []).find((m) => norm(m.name) === n || norm(m.name).endsWith("/" + n) || n.endsWith("/" + norm(m.name)));
    if (c && c.family) return c.family;
  } catch { /* no ComfyUI folder - the name decides */ }
  try { return MC.nameFamily(n) || ""; } catch { return ""; }
}

/** does modelName's family render with style's architecture? (pure when family is given) */
function fit(style, modelName, family) {
  const fam = family !== undefined ? family : familyOf(modelName);
  const F = MC.FAMILIES[fam] || null;
  const arch = F ? (F.arch || "") : "";
  const styleArch = String((style && style.arch) || "");
  const base = { family: fam || "", label: F ? F.label : "", arch, styleArch };
  if (styleArch && F && F.kind && F.kind !== "image") return Object.assign({ ok: false, why: `${/^[AEIOU]/i.test(F.label) ? "an" : "a"} ${F.label} model is a ${F.kind} model` }, base);
  if (!styleArch || !arch) return Object.assign({ ok: true, why: !styleArch ? "the style has no architecture" : "the model's family is not known" }, base);
  const ok = arch === styleArch;
  return Object.assign({ ok, why: ok ? "" : `${/^[AEIOU]/i.test(F.label) ? "an" : "a"} ${F.label} model does not load in a ${styleArch} workflow` }, base);
}

function note(style, f, modelName) {
  return `the checkpoint override ${String(modelName).split(/[\\/]/).pop()} (${f.label || f.family}) does not fit "${(style && style.name) || "this style"}" (${f.styleArch}) - `
    + `left out for this render, the style's own model is used. Untick Override style in Basic Settings (or the 🧩 Model manager's override), or pick a style made for ${f.label || "that model"}.`;
}

module.exports = { fit, familyOf, note, norm };
