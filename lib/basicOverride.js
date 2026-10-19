// bitGen Studio — lib/basicOverride.js (2.409.0): Basic Settings' OVERRIDE STYLE for EVERY video model.
//
// Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
// including, cfg, steps, seed, model and loras, use prompt from prompt docker or prompt chat when video button is
// pressed".
//
// The page sends `basic` (static/basicset.js collect()) with every video render: {override, steps, cfg, seed, model,
// loras}. With override ON this decides, whatever the style says:
//   steps   > 0 = that many (0 = the model's own)      cfg     the guidance (LTX: CFGGuider / video_cfg / KSampler)
//   seed    -1 = random, else that seed                 model   blank = the style's; else phase 1's model
//   loras   Basic Settings' temporary video LoRAs on top of the style's
// MiniMax H3 (/api/generate), Wan 2.1 / 2.2 (/api/generate -> wan_worker), LTX 2.3 / 2.5 (/api/ltx -> ltx_worker +
// scripts/basic_apply.py) and the scene board (lib/renderSettings basic_model) all read it from here.
"use strict";
const tempLoras = require("./tempLoras");

const SAFE_MODEL = /^[^\0<>|"?*]{1,240}$/;

/** the page's `basic` (a JSON string or an object) -> the override, or null when it is off / absent */
function parse(raw) {
  let b = raw;
  if (typeof b === "string") { try { b = JSON.parse(b || "null"); } catch { b = null; } }
  if (!b || typeof b !== "object" || !(b.override === true || b.override === "true")) return null;
  const st = parseInt(b.steps, 10);
  const c = b.cfg === "" || b.cfg == null ? NaN : Number(b.cfg);
  const sd = parseInt(b.seed, 10);
  const m = String(b.model || "").trim().replace(/\\/g, "/");
  let loras = [];
  try { loras = tempLoras.normalize(Array.isArray(b.loras) ? b.loras : []); } catch { loras = []; }
  return {
    override: true,
    steps: Number.isFinite(st) && st >= 1 && st <= 200 ? st : 0,
    cfg: Number.isFinite(c) && c >= 0 && c <= 30 ? Math.round(c * 100) / 100 : null,
    seed: Number.isFinite(sd) && sd >= 0 ? Math.min(sd, 2 ** 31 - 1) : -1,
    model: m && SAFE_MODEL.test(m) && !m.split("/").includes("..") ? m : "",
    loras,
  };
}

/** a style with the override's model (phase 1) and LoRAs (on top of the style's) - a copy; the style FILE never
 *  changes. No style + a model / LoRAs -> a synthetic one (`synth` = the fields it should carry) */
function withStyle(style, b, o) {
  const opt = o || {};
  if (!b || (!b.model && !(opt.loras && b.loras.length))) return style;
  let st = style ? { ...style } : (opt.synth ? { ...opt.synth } : null);
  if (!st) return style;
  if (b.model) {
    const ph = Array.isArray(st.phases) && st.phases.length ? st.phases.map((p) => ({ ...(p || {}) })) : [{}];
    ph[0].model = b.model;
    st.phases = ph;
    if ("model" in st || opt.topModel) st.model = b.model;     // LTX styles also read style.model
  }
  if (opt.loras && b.loras.length) st.loras = tempLoras.merge(st.loras, b.loras);
  return st;
}

/** the job log's line - what the override decided */
function note(b, what) {
  if (!b) return "";
  const bits = [b.steps ? `steps ${b.steps}` : "steps: the model's own", b.cfg != null ? `cfg ${b.cfg}` : "cfg: the model's own",
                b.seed >= 0 ? `seed ${b.seed}` : "seed random", b.model ? `model ${b.model}` : "the style's model",
                b.loras.length ? `${b.loras.length} LoRA(s) added` : "the style's LoRAs"];
  return `Basic Settings override (${what}): ` + bits.join(", ");
}

module.exports = { parse, withStyle, note };
