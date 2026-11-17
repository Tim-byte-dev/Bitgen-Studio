// lib/slideAi.js — 🎞 ✨ SLIDES BY THE LLM (2.833.0).
//
// Tim: "yes, plese do part 3" (the agreed Slides part 3: "make slides about …" in the prompt docker / from an outline / a
// document -> slides by the LLM + generated pictures; ✨ rewrite a slide, shorter, speaker notes). The LLM is the prompt
// docker's (lib/llmChat.complete, like lib/sheetAi.js); it answers with one JSON plan that is cleaned here and built by the page
// (ext/slidesdock/slideai.js) with slidecore's layouts. setComplete(fn) for tests.
//   planDeck({ask, text, count, pictures})  -> {plan: {title, subtitle, slides: [{layout, title, points, points2, notes, picture}]}}
//   outlinePlan(text)                       -> the same plan from an outline as written (no LLM): "# title" / a plain line =
//                                              a slide's title, "- " / "* " / "1." lines = its points, "> " lines = its notes
//   rewriteSlide({title, points, notes, how: better | shorter | fix | notes}) -> {title, points, notes}
//   cleanPlan(o, count)  parsePlan(text)
"use strict";

let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n);
const LAYOUTS = ["content", "two", "section", "picture", "titleonly"];

function parsePlan(text) {
  let t = String(text || "");
  try { t = require("./llmChat").stripThinking(t); } catch (e) { /* fine */ }
  t = t.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  const body = t.slice(a, b + 1);
  for (const s of [body, body.replace(/,\s*([}\]])/g, "$1").replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false")]) { try { const o = JSON.parse(s); if (o && typeof o === "object") return o; } catch (e) { /* the next */ } }
  return null;
}
const list = (v, n, len) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : []).map((x) => clip(typeof x === "object" && x ? x.text || x.point || "" : x, len || 200).replace(/^(?:[-*•]+\s*|\d{1,2}[.)]\s+)/, "")).filter(Boolean).slice(0, n);
/** an LLM's (or an outline's) plan made safe: known layouts, at most `count` slides, short points */
function cleanPlan(o, count) {
  const p = o && typeof o === "object" ? o : {};
  const max = Math.max(1, Math.min(40, Math.round(+count || 40)));
  const slides = (Array.isArray(p.slides) ? p.slides : []).filter((s) => s && typeof s === "object").slice(0, max).map((s) => {
    let layout = LAYOUTS.includes(s.layout) ? s.layout : "content";
    const points = list(s.points || s.bullets || s.body, 8), points2 = list(s.points2 || s.right, 8), picture = clip(s.picture || s.image || "", 300);
    if (layout === "two" && !points2.length) { if (points.length > 3) points2.push(...points.splice(Math.ceil(points.length / 2))); else layout = "content"; }
    if (layout === "content" && !points.length && !picture) layout = "titleonly";
    return { layout, title: clip(s.title || s.heading, 160), points, points2: layout === "two" ? points2 : [], notes: clip(s.notes || s.speaker_notes || "", 2000), picture: layout === "picture" || picture ? picture : "" };
  }).filter((s) => s.title || s.points.length);
  return { title: clip(p.title, 160), subtitle: clip(p.subtitle, 200), slides };
}
/** an outline as written -> a plan (no LLM) */
function outlinePlan(text) {
  const out = { title: "", subtitle: "", slides: [] }; let cur = null;
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    const pt = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l), note = /^>\s?(.*)$/.exec(l), head = /^#+\s*(.*)$/.exec(l);
    if (pt && cur) cur.points.push(pt[1].trim());
    else if (note && cur) cur.notes += (cur.notes ? "\n" : "") + note[1].trim();
    else if (pt && !cur) { cur = { layout: "content", title: "", points: [pt[1].trim()], notes: "" }; out.slides.push(cur); }
    else {
      const t = head ? head[1].trim() : l;
      if (!out.title && /^#\s/.test(l) && !out.slides.length) { out.title = t; continue; }
      cur = { layout: "content", title: t, points: [], notes: "" }; out.slides.push(cur);
    }
  }
  if (!out.title && out.slides.length > 1 && !out.slides[0].points.length) { out.title = out.slides.shift().title; }
  return cleanPlan(out);
}
const SYSTEM_PLAN = `You write presentations (slide decks). Answer with ONE JSON object and nothing else:
{"title": "the deck's title", "subtitle": "one short line",
 "slides": [{"layout": "content|two|section|picture|titleonly", "title": "the slide's title",
   "points": ["short point", "..."], "points2": ["the right column's points - only for two"],
   "notes": "what the speaker says on this slide, 2-4 sentences",
   "picture": "for a picture slide: what the picture shows, one sentence for an image generator"}]}
Rules: the title slide is made from "title" / "subtitle" - do not put it in "slides". Each point is short (at most 12 words), 3-6 points a slide. "section" starts a part (title only). "two" compares or splits into two columns. Write in the language of the request. Keep to facts in the given text when there is one; do not invent numbers.`;
async function ask(system, user, max, temp) {
  const r = await call({ messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: temp == null ? 0.4 : temp, max_tokens: max || 2600 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  return r.text;
}
async function planDeck(o) {
  const a = o || {}, words = clip(a.ask, 2000), text = clip(a.text, 24000), n = Math.max(1, Math.min(40, Math.round(+a.count || 8)));
  if (!words && !text) throw bad("say what the slides are about (or give a text / an outline)");
  const user = (words ? "What the presentation is about / the request: " + words + "\n" : "")
    + (text ? "\nThe text to make it from (use what it says):\n\"\"\"\n" + text + "\n\"\"\"\n" : "")
    + `\nMake ${n} slides after the title slide.` + (a.pictures ? " Make about a third of them picture slides (layout \"picture\") with a \"picture\" description." : " No picture slides.")
    + "\n\nThe JSON:";
  const plan = parsePlan(await ask(SYSTEM_PLAN, user, Math.min(8000, 600 + n * 320)));
  if (!plan) throw bad("the LLM's answer was not a slide plan - try again", 502);
  const c = cleanPlan(plan, n);
  if (!c.slides.length) throw bad("the LLM's plan had no slides - try again", 502);
  if (!a.pictures) c.slides.forEach((s) => { s.picture = ""; if (s.layout === "picture") s.layout = "content"; });
  return { plan: c };
}
const SYSTEM_SLIDE = `You improve one slide of a presentation. Answer with ONE JSON object and nothing else:
{"title": "...", "points": ["...", "..."], "notes": "..."}
Keep the slide's language and meaning; do not invent facts or numbers.`;
const HOW = {
  better: "Rewrite it to be clearer and more engaging: a strong title, 3-6 short points (at most 12 words each). Keep the notes' meaning (improve them too).",
  shorter: "Make it shorter: a short title, at most 4 points of at most 8 words each. Keep the notes as they are.",
  fix: "Only fix spelling, grammar and punctuation - change nothing else. Keep the notes (fixed the same way).",
  notes: "Keep the title and points exactly as they are; write the speaker notes: what to say on this slide, 3-5 natural sentences.",
};
async function rewriteSlide(o) {
  const a = o || {}, how = HOW[a.how] ? a.how : "better";
  const title = clip(a.title, 300), points = list(a.points, 20, 400), notes = clip(a.notes, 4000);
  if (!title && !points.length) throw bad("the slide has no words to work on");
  const user = `The slide:\ntitle: ${JSON.stringify(title)}\npoints: ${JSON.stringify(points)}\nnotes: ${JSON.stringify(notes)}\n\n${HOW[how]}\n\nThe JSON:`;
  const r = parsePlan(await ask(SYSTEM_SLIDE, user, 1200, how === "fix" ? 0 : 0.4));
  if (!r) throw bad("the LLM's answer was not a slide - try again", 502);
  const out = { title: clip(r.title, 300) || title, points: list(r.points, 12, 400), notes: clip(r.notes, 4000) };
  if (how === "notes") { out.title = title; out.points = points; }
  if (!out.points.length && points.length && how !== "shorter") out.points = points;
  if (!out.notes && how !== "notes") out.notes = notes;
  return out;
}
module.exports = { setComplete, parsePlan, cleanPlan, outlinePlan, planDeck, rewriteSlide, SYSTEM_PLAN, SYSTEM_SLIDE, HOW };
