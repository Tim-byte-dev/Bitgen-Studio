// bitGen Studio — lib/imgOverride.js (2.676.0): BASIC SETTINGS' "OVERRIDE STYLE" FOR A RENDER THAT IS NOT GENERATE'S.
//
// Tim (verbatim): "in the image preview dialog, add a button with a dropdown to change the style of the picture,
// photoreal, pixar, 2.5D, anime,cartoon. use the style chosen in prompt unless overide is checked to generate the image
// from the image being previewed"
// The preview's 🎨 Style (static/lbrestyle.js) renders through /api/aiedit (routes/aiedit.js). With Override style ON the
// client sends Basic Settings' values as `ovr` (the same ones Generate sends - index.html imgBasicsBody); this applies
// them to the style copy the job renders with, the way POST /api/genimage does:
//   lora_weights  the style's LoRA strengths (styles.applyLoraWeights)
//   model         a checkpoint picked in Basic Settings - only where it fits the style's workflow (lib/modelFit.js)
//   extra_loras   Basic Settings' temporary LoRAs, after the style's own (lib/tempLoras.js)
//   mm_override   the 🧩 Model manager's pick
//   steps, cfg    -> the job's params (null = the style's own)
// parse(text) -> the ovr object | null (bad / empty JSON = none)
// apply(style, ovr, deps) -> {styled, note, steps, cfg}   deps = {styles, modelFit, tempLoras} (the tests pass fakes)
// summary(ov, extraCount) -> "steps 30, CFG 6, checkpoint x.safetensors, 1 temporary LoRA" (2.685.0 - said in the preview)
"use strict";

function parse(text) {
  if (!text) return null;
  let o = null; try { o = typeof text === "string" ? JSON.parse(text) : text; } catch { return null; }
  return o && typeof o === "object" && !Array.isArray(o) ? o : null;
}
function num(v, lo, hi) { const x = Number(v); return v !== "" && v != null && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; }
function apply(style, ovr, deps) {
  const d = deps || {}, S = d.styles || require("./styles"), MF = d.modelFit || require("./modelFit"), TL = d.tempLoras || require("./tempLoras");
  const o = ovr || {};
  let styled = S.applyLoraWeights(style, o.lora_weights && typeof o.lora_weights === "object" ? o.lora_weights : null), note = "";
  if (typeof o.model === "string" && o.model.trim() && !o.model.includes("..")) {
    const mf = MF.fit(styled, o.model.trim());
    if (mf.ok) styled = Object.assign({}, styled, { model: o.model.trim().slice(0, 300), model_override: true });
    else note = MF.note(styled, mf, o.model.trim());
  }
  const extra = TL.normalize(o.extra_loras);
  if (extra.length) styled = Object.assign({}, styled, { loras: TL.merge(styled.loras, extra) });
  if (o.mm_override === true) styled = Object.assign({}, styled, { mm_override: true });
  return { styled, note, steps: num(o.steps, 1, 200), cfg: num(o.cfg, 0, 40) };
}
/** 2.685.0: what Override put on the render, in a few words for the caller (the preview's bar) -> "steps 30, CFG 6, …" */
function summary(ov, extraCount) {
  if (!ov) return "";
  const out = [];
  if (ov.steps != null) out.push("steps " + ov.steps);
  if (ov.cfg != null) out.push("CFG " + ov.cfg);
  if (ov.styled && ov.styled.model_override && ov.styled.model) out.push("checkpoint " + String(ov.styled.model).split(/[\\/]/).pop());
  if (extraCount) out.push(extraCount + " temporary LoRA" + (extraCount > 1 ? "s" : ""));
  return out.join(", ");
}

module.exports = { parse, apply, summary };
