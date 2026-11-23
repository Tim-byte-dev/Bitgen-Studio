// bitGen Studio — lib/garmentAi.js (2.932.0): 👗 ✨ "describe the garment" - the LLM picks GarmentCode's settings from words.
//
// The LLM is told bitGen's presets and every setting that matters (path, kind, range, the value now - the asymmetric "left"
// copies and the fine collar curve handles left out unless the words ask) and answers ONE JSON object:
//   {"preset": "<id or null>", "set": {"<path>": value ...}, "name": "<a short name>", "say": "<one sentence>"}
// bitGen applies the preset, then the changes, each checked against its range (static/garmentspec.js value) - a path that
// does not exist is dropped, a number out of range is clamped. Without an LLM (or a reply that is not JSON) the words are read
// by bitGen itself: the garment's kind -> a preset, then sleeve / length / neckline / hood / fit words (byWords).
//   describe(words, values, deps) -> {values, preset, name, say, by: "llm" | "words", dropped: [paths]}
//   byWords(words) / parse(text) / prompt(tree, values, words) - pure, for the tests
"use strict";
const spec = require("../static/garmentspec.js");

let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const G = () => require("./garment");

const SKIP = /^(left\.|collar\.(f|b)_bezier_|collar\.(f|b)_flip_curve|sleeve\.smoothing_coeff|sleeve\.opening_dir_mix)/;
function settingLines(tree, values, words) {
  const asym = /asymmetr|one.shoulder|one side|different (left|right)/i.test(String(words || ""));
  return spec.flat(tree).filter((f) => asym || !SKIP.test(f.path)).map((f) => {
    const now = values && f.path in values ? values[f.path] : f.v;
    const r = f.type === "bool" ? "true|false" : f.type === "float" || f.type === "int" ? `${f.range[0]}..${f.range[1]}${f.type === "int" ? " whole" : ""}`
      : f.range.filter((x) => !spec.hidden(x)).map((x) => (x === null ? "null" : String(x))).join("|");
    return `${f.path} (${spec.label(f.path)}): ${r} = ${JSON.stringify(now)}`;
  });
}
const SYS = `You are a sewing-pattern designer. The pattern is made by GarmentCode's garment programs from the settings listed below.
How the settings work: meta.upper is the top (Shirt = loose, FittedShirt = close fitting, null = none), meta.bottom the skirt or
trousers (SkirtCircle = circle / flared skirt, PencilSkirt = straight fitted, Skirt2 = straight 2-panel, SkirtManyPanels = gored,
GodetSkirt = with flared inserts, SkirtLevels = tiered, Pants = trousers / shorts, AsymmSkirtCircle = high-low, null = none),
meta.wb a waistband (only for a bottom without a top). A dress = a top + a skirt; a jumpsuit = a top + Pants.
Lengths are fractions: shirt.length is the top's length in units of the waist-to-hip height (1.2 = just below the hips),
sleeve.length 0.1..1.15 of the arm (0.3 = short sleeve, 1.0 = long), *.length of a skirt / trousers is the fraction of the leg
(0.2 = mini / shorts, 0.45 = knee, 0.7 = midi, 0.95 = floor); widths and flare are multipliers (1 = fitted).
Answer with ONE JSON object and nothing else:
{"preset": "<one preset id from the list, or null>", "set": {"<setting path>": <value>, ...}, "name": "<2-4 word garment name>", "say": "<one plain sentence: what you made>"}
Only use setting paths from the list; values inside their ranges; select values exactly as listed. Change only what the words ask for
(after the preset) - keep the rest.`;
function prompt(tree, values, words, presets) {
  const P = (presets || []).map((p) => `${p.id} = ${p.label}`).join(", ");
  return `Presets: ${P}\n\nSettings (path (words): allowed = now):\n${settingLines(tree, values, words).join("\n")}\n\nThe garment: ${String(words || "").slice(0, 1200)}`;
}
function parse(text) {
  let t = String(text || "");
  try { t = require("./llmChat").stripThinking(t); } catch { /* fine */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { const j = JSON.parse(t.slice(a, b + 1)); return j && typeof j === "object" ? j : null; } catch { return null; }
}

// ---- without an LLM: bitGen reads the words itself
const KINDS = [
  [/\bhood(ie|y|ed)?\b|sweatshirt/i, "hoodie"], [/jump ?suit|overall|boiler ?suit|romper|playsuit/i, "jumpsuit"],
  [/sun ?dress|skater dress|circle dress/i, "sundress"], [/\bdress\b|gown|frock|sheath/i, "dress"],
  [/tier(ed)?|ruffle(d)? skirt|layered skirt/i, "tiered"], [/pencil skirt|straight skirt/i, "pencil"],
  [/\bskirt\b/i, "aline"], [/shorts\b/i, "shorts"], [/trousers|pants|slacks|chinos|jeans/i, "trousers"],
  [/tank|vest top|camisole|\bcami\b|singlet/i, "tank"], [/long[- ]sleeve|sweater|jumper|blouse|top with long/i, "longsleeve"],
  [/t-?shirt|\btee\b|top\b|shirt\b/i, "tshirt"],
];
function byWords(words) {
  const w = String(words || "");
  const kind = (KINDS.find(([re]) => re.test(w)) || [null, null])[1];
  const set = kind ? G().presetValues(kind) : {};
  const top = !!set["meta.upper"], bottom = set["meta.bottom"];
  if (top) {
    if (/sleeveless|no sleeves|strapless/i.test(w)) set["sleeve.sleeveless"] = true;
    else if (/long[- ]sleeve/i.test(w)) { set["sleeve.sleeveless"] = false; set["sleeve.length"] = 1.0; }
    else if (/short[- ]sleeve|cap sleeve/i.test(w)) { set["sleeve.sleeveless"] = false; set["sleeve.length"] = /cap/i.test(w) ? 0.15 : 0.3; }
    else if (/(three[- ]quarter|3\/4)[- ]sleeve/i.test(w)) { set["sleeve.sleeveless"] = false; set["sleeve.length"] = 0.75; }
    if (/strapless/i.test(w)) set["shirt.strapless"] = true;
    if (/v[- ]?neck/i.test(w)) { set["collar.f_collar"] = "VNeckHalf"; set["collar.fc_depth"] = 0.9; }
    else if (/square neck/i.test(w)) set["collar.f_collar"] = "SquareNeckHalf";
    else if (/scoop neck|round neck|crew neck/i.test(w)) set["collar.f_collar"] = "CircleNeckHalf";
    if (/turtle ?neck|polo neck/i.test(w)) set["collar.component.style"] = "Turtle";
    if (/lapel/i.test(w)) set["collar.component.style"] = "SimpleLapel";
    if (/\bhood/i.test(w)) set["collar.component.style"] = "Hood2Panels";
    if (/oversized|loose|baggy|boxy/i.test(w)) set["shirt.width"] = 1.25;
    if (/fitted|tight|slim/i.test(w) && set["meta.upper"] === "Shirt") set["meta.upper"] = "FittedShirt";
    if (/crop(ped)?/i.test(w)) set["shirt.length"] = 0.7;
    else if (/tunic|long top/i.test(w)) set["shirt.length"] = 2.0;
    if (/cuff/i.test(w)) set["sleeve.cuff.type"] = "CuffBand";
  }
  const lenKey = bottom === "Pants" ? "pants.length" : bottom === "PencilSkirt" ? "pencil-skirt.length"
    : bottom === "SkirtLevels" ? "levels-skirt.length" : bottom === "Skirt2" ? "skirt.length" : bottom ? "flare-skirt.length" : null;
  if (lenKey) {
    if (/\bmini\b|short skirt|very short/i.test(w)) set[lenKey] = 0.2;
    else if (/knee/i.test(w)) set[lenKey] = 0.45;
    else if (/\bmidi\b|calf|tea[- ]length/i.test(w)) set[lenKey] = 0.7;
    else if (/maxi|floor|full[- ]length|ankle/i.test(w)) set[lenKey] = 0.95;
    else if (/capri|cropped (trousers|pants)/i.test(w)) set[lenKey] = 0.6;
    if (bottom === "Pants" && /wide[- ]leg|palazzo|flared/i.test(w)) { set["pants.width"] = 1.4; set["pants.flare"] = 1.2; }
    if (bottom === "SkirtCircle" && /full|twirl|circle/i.test(w)) set["flare-skirt.suns"] = 1.0;
  }
  const name = kind ? (G().presets().find((p) => p.id === kind) || {}).label : "";
  return { preset: kind, set, name: name || "", say: kind ? `A ${String(name).toLowerCase()} from your words` + (Object.keys(set).length > Object.keys(G().presetValues(kind)).length ? ", with the details you named." : ".") : "" };
}

/** the LLM's (or the words') answer applied on the values now -> the new values */
function apply(tree, values, ans) {
  const out = Object.assign({}, values || {}), dropped = [];
  if (ans.preset) {
    // a new kind of garment starts from its preset (a top / bottom that is not in it is cleared)
    const pv = G().presetValues(ans.preset);
    if (Object.keys(pv).length) {
      for (const k of ["meta.upper", "meta.wb", "meta.bottom"]) out[k] = null;
      Object.assign(out, pv);
    }
  }
  for (const [p, v] of Object.entries(ans.set || {})) {
    const leaf = spec.leafAt(tree, p);
    if (!leaf) { dropped.push(p); continue; }
    out[p] = spec.value(leaf, v);
  }
  return { values: spec.changed(tree, out), dropped };
}

async function describe(words, values, deps) {
  const w = String(words || "").trim();
  if (!w) throw Object.assign(new Error("say what to make - e.g. \"a knee-length A-line skirt with a waistband\""), { status: 400 });
  const tree = G().schema();
  const now = Object.assign(spec.valuesOf(tree), values || {});
  let ans = null, by = "llm", note = "";
  if (!(deps && deps.noLlm)) {
    try {
      const r = await call({ messages: [{ role: "system", content: SYS }, { role: "user", content: prompt(tree, now, w, G().presets()) }], temperature: 0.2, max_tokens: 900 });
      if (r && r.ok) ans = parse(r.text);
      if (!ans) note = r && r.ok ? "the LLM's answer was not the settings" : "the LLM did not answer" + (r && r.error ? ": " + r.error : "");
    } catch (e) { note = "the LLM did not answer: " + (e.message || e); }
  }
  if (!ans || (!ans.preset && !(ans.set && Object.keys(ans.set).length))) { ans = byWords(w); by = "words"; }
  if (ans.preset && !G().presets().some((p) => p.id === ans.preset)) ans.preset = null;
  const r = apply(tree, ans.preset ? {} : now, ans);
  if (!r.values["meta.upper"] && !r.values["meta.bottom"] && !r.values["meta.wb"])
    throw Object.assign(new Error("which garment? Name it - a T-shirt, a dress, a skirt, trousers, a hoodie…" + (note ? ` (${note})` : "")), { status: 422 });
  return { values: r.values, preset: ans.preset || null, name: String(ans.name || "").slice(0, 60), say: String(ans.say || "").slice(0, 300), by, note, dropped: r.dropped };
}

module.exports = { describe, byWords, parse, prompt, apply, settingLines, setComplete, SYS };
