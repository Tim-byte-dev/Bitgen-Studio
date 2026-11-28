// bitGen Studio — lib/layerScene.js (3.14.0): 🏞 Scene in Layers - the LLM plans a scene as separate layers for the image
// editor (ext/imageeditdock/pcscene.js): a background, the objects in it (each made whole, on its own layer, stood on the
// ground) and the words (real text layers).
// Tim (verbatim): "can we use code to create the layers using an image model, like background scenic lake, horse, cabin,
// road, text layers, etc ... horse layer will be a full horse adjusted to the position of the road, we can move the horse up
// and down the road, and maybe add a perspective tool?" / "lets do both, it will be one for a photo composition and one for
// creating posters and artwork etc"
//   plan({ask, mode}) -> {plan: {rows, style, lighting, camera, horizon, aspect, w, h}}
//   clean(o)           the LLM's JSON made safe (pure: scripts/test-31400.js)
"use strict";
const ML = require("./mingLayers");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const one = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const KINDS = ["background", "object", "text"];
const ASPECTS = { "1:1": [1, 1], "4:5": [4, 5], "3:4": [3, 4], "2:3": [2, 3], "9:16": [9, 16], "5:4": [5, 4], "4:3": [4, 3], "3:2": [3, 2], "16:9": [16, 9], "2:1": [2, 1] };
const MAX = 10;
const SYSTEM = `You plan a picture as SEPARATE LAYERS for an image editor: one background (the empty place - landscape, room, sky, road - with no movable objects in it), then each object that should be its own movable layer (a person, an animal, a vehicle, a building, a prop), then any words. Answer with JSON only, exactly this shape:
{"aspect": "one of ${Object.keys(ASPECTS).join(" | ")}", "style": "the look in one sentence", "lighting": "one sentence: the light and its direction", "camera": "one short phrase: the viewpoint, e.g. eye level, slightly from above", "horizon": a number 0-100 (where the horizon line is, % from the top),
 "layers": [{"name": "1-3 words", "kind": "background | object | text", "desc": "for background / object: what it looks like (colours, pose, which way it faces); for text: the exact words", "where": "one of ${Object.keys(ML.WHERE).join(" | ")}", "size": a number (an object's height, % of the picture's height, 5-100; a text's letter height, % of the picture's height, 3-20), "ground": true if it stands on the ground}]}
Rules: exactly ONE background, first; objects front-most last is NOT required - list them in any order; at most ${MAX} layers; an object far away is small and its where is higher up, near the horizon; write in the language of the request; use the words, names and prices the request gives - never invent phone numbers, prices or addresses.`;

const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
/** the LLM's JSON -> {rows, style, lighting, camera, horizon, aspect, w, h} (pure) */
function clean(o0) {
  const o = o0 && typeof o0 === "object" ? o0 : {};
  const list = (Array.isArray(o.layers) ? o.layers : Array.isArray(o.rows) ? o.rows : []).slice(0, MAX * 2);
  let rows = list.map((r) => {
    const x = r && typeof r === "object" ? r : {};
    const kind = KINDS.includes(String(x.kind || "").toLowerCase()) ? String(x.kind).toLowerCase() : "object";
    const where = String(x.where || "").toLowerCase().replace(/\s+/g, "-").replace(/^center$/, "centre");
    return { name: one(x.name, 40), kind, desc: one(x.desc || x.description || x.text, 400), where: ML.WHERE[where] ? where : kind === "background" ? "all" : "centre",
      size: Math.round(kind === "text" ? num(x.size, 3, 20, 8) : num(x.size, 5, 100, 35)), ground: kind === "object" && x.ground !== false && x.ground !== "false" };
  }).filter((r) => r.name || r.desc);
  rows.forEach((r) => { if (!r.name) r.name = r.kind === "text" ? r.desc.slice(0, 24) : r.desc.split(/[,.]/)[0].slice(0, 24); if (!r.desc) r.desc = r.name; });
  const bgs = rows.filter((r) => r.kind === "background");
  rows = (bgs.length ? [Object.assign({}, bgs[0], { where: "all", ground: false })] : [{ name: "Background", kind: "background", desc: "a simple plain backdrop", where: "all", size: 100, ground: false }])
    .concat(rows.filter((r) => r.kind !== "background")).slice(0, MAX);
  const asp = ASPECTS[String(o.aspect || "").replace(/\s+/g, "")] ? String(o.aspect).replace(/\s+/g, "") : "16:9";
  const [a, b] = ASPECTS[asp], sz = ML.sizeFor(a * 1000, b * 1000, 1024);
  return { rows, style: one(o.style, 400), lighting: one(o.lighting, 300), camera: one(o.camera, 120), horizon: Math.round(num(o.horizon, 5, 95, 45)), aspect: asp, w: sz.w, h: sz.h };
}

/** {ask, mode "photo" | "poster"} -> {plan} */
async function plan(o) {
  const ask = String((o || {}).ask || "").trim().slice(0, 4000);
  if (!ask) throw bad("say what the scene is - the place, what is in it, the words on it, the look");
  const how = (o || {}).mode === "poster" ? "It is a poster / artwork: bold, designed, words welcome." : "It is a photo composition: realistic, one consistent photograph.";
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: ask + "\n\n" + how + "\n\nThe JSON:" }], temperature: 0.6, max_tokens: 1600 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const p = clean(require("./slideAi").parsePlan(r.text));
  if (p.rows.length < 2) throw bad("the LLM's plan had nothing in the scene - try again (or say more about what is in it)", 502);
  return { plan: p };
}
module.exports = { plan, clean, setComplete, SYSTEM, KINDS, MAX };
