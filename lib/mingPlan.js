// bitGen Studio — lib/mingPlan.js (3.13.0): ✨ Create With the AI ▸ 🧩 Layered image - the prompt docker's LLM plans the LAYERS
// of a design from what you say it is for; the image editor's 🧩 Ming Layered Design box (ext/imageeditdock/pcming.js) opens with
// them filled in, and Ming-Image makes the design and splits it into those layers.
// Tim (verbatim): "add a template in ai generated dialog for layered image - use ming image for the layered image"
//   plan({ask}) -> {rows: [{name, desc, where}] (front first, the background last), style, lighting, aspect "w:h", w, h}
//   clean(o)    the LLM's JSON made safe (pure: scripts/test-31300.js)
"use strict";
const ML = require("./mingLayers");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }   // tests
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const one = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const ASPECTS = { "1:1": [1, 1], "4:5": [4, 5], "3:4": [3, 4], "2:3": [2, 3], "9:16": [9, 16], "5:4": [5, 4], "4:3": [4, 3], "3:2": [3, 2], "16:9": [16, 9], "1:2": [1, 2], "2:1": [2, 1] };
const SYSTEM = `You plan a layered graphic design for Ming-Image, an image model that draws a design from a list of layers and then splits it into those layers (each a separate transparent layer the user can edit). Answer with JSON only, exactly this shape:
{"aspect": "one of ${Object.keys(ASPECTS).join(" | ")}", "style": "the look in one sentence (medium, mood, colours, typography)", "lighting": "one sentence", "layers": [{"name": "a short layer name (1-3 words)", "desc": "what is in this layer: the object or text and how it looks; quote every word it shows exactly once, e.g. \\"SUMMER SALE\\"; colours as #hex", "where": "one of ${Object.keys(ML.WHERE).join(" | ")}"}]}
Rules: 3 to 7 layers; the FRONT-most layer first and the background LAST (its where: all); one layer per separate thing a user would want to move or recolour (a headline, a product, a logo, a badge, a decoration, the background); write in the language of the request; use the names, prices and words the request gives - never invent phone numbers, prices or addresses.`;

/** the LLM's JSON -> {rows, style, lighting, aspect, w, h} (pure) */
function clean(o0) {
  const o = o0 && typeof o0 === "object" ? o0 : {};
  const list = Array.isArray(o.layers) ? o.layers : Array.isArray(o.rows) ? o.rows : [];
  const rows = ML.clean(list.map((r) => ({ name: r && (r.name || r.title), desc: r && (r.desc || r.description), where: r && String(r.where || "").toLowerCase().replace(/\s+/g, "-").replace(/^center$/, "centre") })));
  if (rows.length > 1 && !/background|backdrop/i.test(rows[rows.length - 1].name)) {
    const bi = rows.findIndex((r) => /background|backdrop/i.test(r.name));
    if (bi >= 0) rows.push(rows.splice(bi, 1)[0]);            // the background last, whatever order the LLM gave
  }
  const asp = ASPECTS[String(o.aspect || "").replace(/\s+/g, "")] ? String(o.aspect).replace(/\s+/g, "") : "1:1";
  const [a, b] = ASPECTS[asp], sz = ML.sizeFor(a * 1000, b * 1000, 1024);
  return { rows, style: one(o.style, 600), lighting: one(o.lighting, 400), aspect: asp, w: sz.w, h: sz.h };
}

/** {ask} -> {plan} */
async function plan(o) {
  const ask = String((o || {}).ask || "").trim().slice(0, 4000);
  if (!ask) throw bad("say what the layered image is for - the subject, the words on it, the look");
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: ask + "\n\nThe JSON:" }], temperature: 0.6, max_tokens: 1500 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const j = require("./slideAi").parsePlan(r.text);
  const p = clean(j);
  if (p.rows.length < 2) throw bad("the LLM's layer plan was empty - try again (or say more about what goes in it)", 502);
  return { plan: p };
}
module.exports = { plan, clean, setComplete, SYSTEM, ASPECTS };
