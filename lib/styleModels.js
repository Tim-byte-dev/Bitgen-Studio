/* bitGen Studio — WHAT A VIDEO STYLE RENDERS WITH (2.401.0, Basic Settings' style card - static/stylecard.js).
 *
 * Tim (verbatim): "show the selected video style settings with it's model in basic settings . allow user to quick
 * change the model".
 *
 * A style's phase with a blank model means "the workflow's own" - which tells nobody anything. This reads the
 * workflow the style would run (its own file for the mode, else Settings -> ComfyUI's template for that mode) and
 * lists its model loaders in graph order - the same order worker.py apply_video_style maps phases[i] onto
 * (MODEL_LOADER_KEYS unet_name / ckpt_name / model_name), so the card can say "the workflow's own:
 * minimax_h3_ref2va_pruned_int8_convrot.safetensors". A Wan style has no workflow: wan_worker.py picks the files
 * from ComfyUI's list by family and mode (auto). Pure + a file read; routes/styleCard.js serves it. */
"use strict";
const fs = require("fs");
const path = require("path");

const KEYS = ["unet_name", "ckpt_name", "model_name"];
const UI_LOADER = /^(UNETLoader|UnetLoaderGGUF|UnetLoaderGGUFAdvanced|CheckpointLoaderSimple|CheckpointLoader|ImageOnlyCheckpointLoader|DiffusionModelLoaderKJ)$/;
const MODEL_EXT = /\.(safetensors|gguf|ckpt|pt|pth|sft|bin)$/i;

/** [{node, cls, key, name}] - the graph's MODEL loaders in graph order (API export or UI export). */
function loadersOf(g) {
  const out = [];
  if (!g || typeof g !== "object") return out;
  if (Array.isArray(g.nodes)) {                                     // a UI export: the canvas order
    for (const n of g.nodes) {
      if (!n || !UI_LOADER.test(String(n.type || ""))) continue;
      const w = (Array.isArray(n.widgets_values) ? n.widgets_values : []).find((x) => typeof x === "string" && MODEL_EXT.test(x));
      if (w) out.push({ node: String(n.id), cls: String(n.type), key: "widget", name: w });
    }
    return out;
  }
  for (const [nid, v] of Object.entries(g)) {                      // an API export: key order = graph order
    if (String(nid).startsWith("_") || !v || typeof v !== "object") continue;
    const ins = v.inputs || {};
    const key = KEYS.find((k) => typeof ins[k] === "string");
    if (key) out.push({ node: String(nid), cls: String(v.class_type || ""), key, name: ins[key] });
  }
  return out;
}

// an arch that runs ONE canvas whatever the mode (lib/ltx.js WORKFLOW)
const ARCH_WORKFLOW = { "ltx-2.5": "comfy_workflows/LTX25_All_In_One.json" };

/** The workflow file the style runs for `mode`: {rel, abs, mode, own} or null. In order: an arch's own canvas (LTX),
 *  the style's file for the mode (a board style's .json is converted from its .ui.json on first use - the UI export
 *  answers until then), a board chain named after the style (comfy_workflows/<name>.json), the Settings -> ComfyUI
 *  template for the mode. */
function workflowFor(style, mode, base, config) {
  const st = style || {};
  const abs = (rel) => (path.isAbsolute(rel) ? rel : path.join(base, rel));
  const hit = (rel, m, own) => (rel && fs.existsSync(abs(rel)) ? { rel, abs: abs(rel), mode: m, own } : null);
  if (ARCH_WORKFLOW[st.arch]) return hit(ARCH_WORKFLOW[st.arch], mode || "ref2va", true);
  const order = [...new Set([mode, "ref2va", "t2va", "fl2va"].filter(Boolean))];
  for (const m of order) {
    const rel = String(((st.workflows || {})[m]) || "").trim();
    if (!rel) continue;
    const got = hit(rel, m, true) || hit(rel.replace(/(\.ui)?\.json$/i, ".ui.json"), m, true);
    if (got) return got;
  }
  const named = st.name ? hit(`comfy_workflows/${path.basename(String(st.name))}.json`, mode || "ref2va", true) : null;
  if (named) return named;
  const tpl = ((((config || {}).engine || {}).comfy || {}).workflows) || {};
  for (const m of order) {
    const got = hit(String(tpl[m] || "").trim(), m, false);
    if (got) return got;
  }
  return null;
}

/** What the style renders with: {auto, workflow, mode, own, loaders: [names], note}. */
function forStyle(style, opts) {
  const o = opts || {};
  const st = style || {};
  if (/^wan/i.test(String(st.arch || ""))) {
    return { auto: true, workflow: "", loaders: [],
      note: "Wan builds its graph itself: a blank model = the Wan file ComfyUI lists for the family and mode (t2v / i2v / flf2v / vace, high + low on 2.2)" };
  }
  if (st.arch === "ltx-2.3") {                                 // 2.402.0: lib/ltxOfficial.pickModels23
    return { auto: true, workflow: "", loaders: [],
      note: "LTX 2.3 runs Comfy-Org's templates: a blank model = the LTX 2.3 checkpoint ComfyUI lists (dev fp8 for text / image, distilled fp8 for first-last and 3DREAL)" };
  }
  const wf = workflowFor(st, o.mode || "ref2va", o.base || process.cwd(), o.config);
  if (!wf) return { auto: false, workflow: "", loaders: [], note: "the style's workflow file is not on disk" };
  let g = null;
  try { g = JSON.parse(fs.readFileSync(wf.abs, "utf8")); } catch (e) { return { auto: false, workflow: wf.rel, loaders: [], note: "could not read " + wf.rel }; }
  const loaders = loadersOf(g);
  return { auto: false, workflow: wf.rel, mode: wf.mode, own: wf.own, loaders: loaders.map((l) => l.name),
    note: `${path.basename(wf.rel)} (${wf.own ? "the style's" : "the template"} ${wf.mode} workflow): ${loaders.length} model loader(s)` };
}

module.exports = { KEYS, loadersOf, workflowFor, forStyle };
