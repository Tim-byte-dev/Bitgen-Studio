// bitGen Studio — lib/createAi.js (2.849.0): ✨ Create With the AI - the LLM writes the WORDS (and colours, picture ideas)
// of a flyer, a brochure (tri-fold), a business card or a website; bitGen lays them out in the image editor
// (ext/imageeditdock/pccreate.js). Documents / stories go through lib/docAi.js, invoices through lib/docTemplates.js.
// Tim (verbatim): "make the llm help me create the documents and stories and flyers and brochures and business cards and
// website and invoices please"
"use strict";
const SA = require("./slideAi");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }   // tests
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const KINDS = ["flyer", "brochure", "card", "website"];
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const clipP = (s, n) => String(s == null ? "" : s).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : d);
const list = (a, n, len) => (Array.isArray(a) ? a : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
/** colours: background, accent, ink - readable (ink differs from background) */
function palette(p0) {
  const p = p0 && typeof p0 === "object" ? p0 : {}, bg = hex(p.bg || p.background, "#ffffff"), accent = hex(p.accent || p.primary, "#1f6feb");
  let ink = hex(p.ink || p.text, "#1f2933");
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  if (Math.abs(lum(ink) - lum(bg)) < 0.45) ink = lum(bg) > 0.5 ? "#1f2933" : "#ffffff";
  return { bg, accent, ink, accentInk: lum(accent) > 0.6 ? "#1f2933" : "#ffffff" };
}
const SHAPES = {
  flyer: `{"headline": "short, strong (max 8 words)", "subheadline": "one line", "body": "2-4 sentences", "bullets": ["3-5 short points"], "cta": "the call to action (max 6 words)", "contact": "phone / email / web / address on one or two lines", "footer": "small print, dates or the offer's terms", "palette": {"bg": "#rrggbb", "accent": "#rrggbb", "ink": "#rrggbb"}, "picture": "one sentence for an image generator - what the main picture shows"}`,
  brochure: `{"title": "the brochure's title (cover)", "tagline": "the cover's line", "panels": [{"heading": "...", "body": "2-4 sentences", "bullets": ["..."]}] (exactly 4 panels: the 3 inside panels then the inside flap), "back": {"heading": "Contact us", "body": "about / how to find us"}, "contact": "phone / email / web / address", "palette": {"bg": "#rrggbb", "accent": "#rrggbb", "ink": "#rrggbb"}, "pictures": ["up to 3 one-sentence picture ideas: the cover's first"]}`,
  card: `{"name": "the person's name", "role": "job title", "company": "the business", "tagline": "max 6 words", "phone": "...", "email": "...", "web": "...", "address": "...", "palette": {"bg": "#rrggbb", "accent": "#rrggbb", "ink": "#rrggbb"}}`,
  website: `{"title": "the site's name", "tagline": "one line", "pages": [{"title": "Home|About|Services|... (the menu name, 1-2 words)", "heading": "the page's big heading", "intro": "1-2 sentences", "sections": [{"heading": "...", "text": "2-4 sentences"}] (2-3 sections)}] (3-5 pages, the first is Home), "contact": "phone / email / address", "palette": {"bg": "#rrggbb", "accent": "#rrggbb", "ink": "#rrggbb"}}`,
};
const SYSTEM = (kind) => `You write the words of a ${kind === "card" ? "business card" : kind} for a small business or person; bitGen Studio lays them out. Answer with JSON only, exactly this shape:
${SHAPES[kind]}
Rules: write in the language of the request; use the names, numbers, prices, dates and contact details the request gives - never invent phone numbers, emails, prices or addresses (leave them "" when not given); short, clear, persuasive wording; colours that suit the business and are readable (ink dark on a light background, or light on a dark one).`;
/** the LLM's JSON -> a clean plan of that kind */
function clean(kind, o0) {
  const o = o0 && typeof o0 === "object" ? o0 : {}, pal = palette(o.palette);
  if (kind === "flyer") return { kind, headline: clip(o.headline || o.title, 90), subheadline: clip(o.subheadline || o.tagline, 140), body: clipP(o.body, 700), bullets: list(o.bullets, 6, 100), cta: clip(o.cta, 60), contact: clipP(o.contact, 200), footer: clip(o.footer, 200), palette: pal, picture: clip(o.picture, 300) };
  if (kind === "brochure") {
    const panels = (Array.isArray(o.panels) ? o.panels : []).slice(0, 4).map((p) => ({ heading: clip(p && p.heading, 80), body: clipP(p && p.body, 600), bullets: list(p && p.bullets, 5, 100) })).filter((p) => p.heading || p.body);
    while (panels.length < 4) panels.push({ heading: "", body: "", bullets: [] });
    return { kind, title: clip(o.title || o.headline, 80), tagline: clip(o.tagline, 140), panels, back: { heading: clip(o.back && o.back.heading, 80) || "Contact us", body: clipP(o.back && o.back.body, 500) }, contact: clipP(o.contact, 240), palette: pal, pictures: list(o.pictures, 3, 300) };
  }
  if (kind === "card") return { kind, name: clip(o.name, 60), role: clip(o.role || o.title, 60), company: clip(o.company, 60), tagline: clip(o.tagline, 60), phone: clip(o.phone, 40), email: clip(o.email, 80), web: clip(o.web || o.website, 80), address: clip(o.address, 120), palette: pal };
  const pages = (Array.isArray(o.pages) ? o.pages : []).slice(0, 6).map((p, i) => ({
    title: clip(p && p.title, 24) || (i === 0 ? "Home" : "Page " + (i + 1)), heading: clip(p && (p.heading || p.title), 90), intro: clipP(p && p.intro, 300),
    sections: (Array.isArray(p && p.sections) ? p.sections : []).slice(0, 3).map((s) => ({ heading: clip(s && s.heading, 80), text: clipP(s && s.text, 500) })).filter((s) => s.heading || s.text) }));
  if (!pages.length) pages.push({ title: "Home", heading: clip(o.title, 90), intro: clip(o.tagline, 300), sections: [] });
  pages[0].title = pages[0].title || "Home";
  return { kind: "website", title: clip(o.title, 80), tagline: clip(o.tagline, 140), pages, contact: clipP(o.contact, 240), palette: pal };
}
/** {kind, ask} -> {plan} */
async function plan(o) {
  const a = o || {}, kind = KINDS.includes(a.kind) ? a.kind : "";
  if (!kind) throw bad("make what? (flyer, brochure, card or website)");
  const ask = clipP(a.ask, 4000); if (!ask) throw bad("say what it is for - the business, the offer, the details");
  const r = await call({ messages: [{ role: "system", content: SYSTEM(kind) }, { role: "user", content: ask + "\n\nThe JSON:" }], temperature: 0.6, max_tokens: kind === "website" ? 4000 : 1800 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const j = SA.parsePlan(r.text);
  if (!j) throw bad("the LLM's answer was not the " + kind + " - try again", 502);
  const p = clean(kind, j);
  const empty = kind === "flyer" ? !p.headline && !p.body : kind === "brochure" ? !p.title && !p.panels.some((x) => x.body) : kind === "card" ? !p.name && !p.company : !p.pages.some((x) => x.heading || x.sections.length);
  if (empty) throw bad("the LLM's " + kind + " was empty - try again", 502);
  return { plan: p };
}
module.exports = { plan, clean, palette, setComplete, KINDS };
