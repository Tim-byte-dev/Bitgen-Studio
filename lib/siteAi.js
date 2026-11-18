// bitGen Studio — lib/siteAi.js (2.852.0): 🌐 "BUILD ME A WEBSITE FOR MY BAKERY" - the LLM plans a whole website from one ask:
// its pages (Home, About, Menu / Services, Book, Contact …) with headings, words and picture ideas, its colours, the business's
// contact details, and - when it sells or takes bookings - its PRODUCTS (for the 🛒 shop) and its BOOKING SERVICES (for the 📅
// calendar). bitGen lays the pages out in the image editor (ext/imageeditdock/pcwebai.js), makes the pictures and builds the
// site (lib/siteBuild.js); the products go into the shop's database with it (seedSql).
// Tim (verbatim, the plan): "now everything is is place for an ai website builder, we can build the website in image editor and
// make it in the language the user needs like php/mysql , we can generate images , videos and content, edit products with qwen
// etc. it will nearly be a full business management package"
//   wants(text)        what the ask wants (pure): {shop, booking, contact} from its words
//   clean(o, want)     the LLM's JSON -> a plan (pure): 2-6 pages (Home first; a Book page with booking, a Contact page with
//                      contact), products (24 at most, prices as numbers), booking services, palette, contact details
//   seedSql(seed)      the products + categories -> INSERT IGNORE SQL for the admin database (pure; by slug, run again = no doubles)
//   cleanSeed(s)       a seed sent with a site's save (pure)
//   plan({ask, shop, booking, contact}) -> {plan}
"use strict";
const SA = require("./slideAi");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }   // tests
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const clipP = (s, n) => String(s == null ? "" : s).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const { palette } = require("./createAi");
const KINDS = ["home", "about", "menu", "products", "services", "gallery", "team", "faq", "booking", "contact"];
const slugOf = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** what the ask wants, from its words (pure) */
function wants(text) {
  const s = String(text || "");
  return {
    shop: /\b(shop|store|sell|selling|order online|online orders?|buy|e-?commerce|products?|cart|checkout)\b/i.test(s) || /\border\b[^.!?]{0,40}\bonline\b|\bonline\b[^.!?]{0,20}\border/i.test(s),
    booking: /\b(book|booking|bookings|appointments?|reservations?|reserve|schedule a|classes|sessions?)\b/i.test(s),
    contact: !/\bno contact\b/i.test(s),
  };
}
const SHAPE = (w) => `{"title": "the business's name", "tagline": "one line",
 "palette": {"bg": "#rrggbb", "accent": "#rrggbb", "ink": "#rrggbb"},
 "contact": {"phone": "", "email": "", "address": "", "hours": "opening hours in one line"},
 "pages": [{"title": "the menu name (1-2 words)", "kind": "${KINDS.join("|")}", "heading": "the page's big heading", "intro": "1-2 sentences",
   "cta": "a short call to action (max 5 words)", "picture": "one sentence for an image generator: the page's main photo",
   "sections": [{"heading": "...", "text": "2-4 sentences", "picture": "one sentence: the section's photo"}] (2-3 sections)}] (3-6 pages, the first is Home)${w.shop ? `,
 "products": [{"name": "...", "category": "...", "price": 0.00, "description": "1-2 sentences", "picture": "one sentence: the product's photo"}] (6-12 products)` : ""}${w.booking ? `,
 "booking": {"name": "what is booked (e.g. Appointments, Classes)", "minutes": 30, "services": [{"name": "...", "minutes": 30, "price": "e.g. $40"}] (1-6)}` : ""}}`;
const SYSTEM = (w) => `You plan a small business's website; bitGen Studio lays it out, makes the photos and builds it${w.shop ? " with an online shop" : ""}${w.booking ? " with a booking calendar" : ""}. Answer with JSON only, exactly this shape:
${SHAPE(w)}
Rules: write in the language of the request; use the names, prices, products, opening hours and contact details the request gives - NEVER invent phone numbers, emails or addresses (leave them "" when not given); ${w.shop ? "products and prices: the ones the request names, else typical ones for this business at sensible prices; " : ""}${w.booking ? "include a page of kind booking; " : ""}${w.contact ? "include a page of kind contact; " : ""}warm, clear, specific wording (no lorem ipsum); colours that suit the business and are readable; photo ideas that show the real business (no text in the photos).`;

const num = (v, d) => { const n = parseFloat(String(v == null ? "" : v).replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : d; };
/** the LLM's JSON -> the plan (pure) */
function clean(o0, want) {
  const o = o0 && typeof o0 === "object" ? o0 : {}, w = Object.assign({ shop: false, booking: false, contact: true }, want || {});
  const c0 = o.contact && typeof o.contact === "object" ? o.contact : { phone: "", email: "", address: typeof o.contact === "string" ? o.contact : "" };
  const contact = { phone: clip(c0.phone, 40), email: clip(c0.email, 80), address: clipP(c0.address, 200), hours: clip(c0.hours, 160) };
  const used = new Set();
  let pages = (Array.isArray(o.pages) ? o.pages : []).slice(0, 6).map((p, i) => {
    const q = p && typeof p === "object" ? p : {};
    let kind = KINDS.includes(String(q.kind || "").toLowerCase()) ? String(q.kind).toLowerCase() : i === 0 ? "home" : /contact/i.test(q.title) ? "contact" : /book|appoint|reserv/i.test(q.title) ? "booking" : "about";
    if (i === 0) kind = "home";
    return { title: clip(q.title, 24) || (i === 0 ? "Home" : "Page " + (i + 1)), kind, heading: clip(q.heading || q.title, 90), intro: clipP(q.intro, 320), cta: clip(q.cta, 40),
      picture: clip(q.picture, 300), sections: (Array.isArray(q.sections) ? q.sections : []).slice(0, 3).map((s) => ({ heading: clip(s && s.heading, 80), text: clipP(s && s.text, 520), picture: clip(s && s.picture, 300) })).filter((s) => s.heading || s.text) };
  }).filter((p) => p.heading || p.intro || p.sections.length || p.kind === "contact" || p.kind === "booking");
  if (!pages.length) pages.push({ title: "Home", kind: "home", heading: clip(o.title, 90) || "Welcome", intro: clip(o.tagline, 320), cta: "", picture: "", sections: [] });
  pages[0].kind = "home"; pages[0].title = pages[0].title || "Home";
  if (w.booking && !pages.some((p) => p.kind === "booking")) pages.splice(Math.max(1, pages.length - (pages[pages.length - 1].kind === "contact" ? 1 : 0)), 0, { title: "Book", kind: "booking", heading: "Book online", intro: "Pick a time that suits you.", cta: "", picture: "", sections: [] });
  if (w.contact && !pages.some((p) => p.kind === "contact")) pages.push({ title: "Contact", kind: "contact", heading: "Contact us", intro: "", cta: "", picture: "", sections: [] });
  if (!w.booking) pages = pages.filter((p, i) => i === 0 || p.kind !== "booking");
  pages = pages.slice(0, 7);
  for (const p of pages) {                        // menu names unique; the slug the site builder will give each one
    let t = p.title, n = 2; while (used.has(t.toLowerCase())) t = p.title + " " + n++;
    used.add(t.toLowerCase()); p.title = t;
    if (p.kind === "booking") p.sections = p.sections.slice(0, 1);
  }
  const products = !w.shop ? [] : (Array.isArray(o.products) ? o.products : []).slice(0, 24).map((x) => ({
    name: clip(x && x.name, 80), category: clip(x && x.category, 40), price: Math.max(0, Math.round(num(x && x.price, 0) * 100) / 100),
    description: clipP(x && x.description, 600), picture: clip(x && x.picture, 300) })).filter((x) => x.name);
  const b0 = o.booking && typeof o.booking === "object" ? o.booking : {};
  const booking = !w.booking ? null : { name: clip(b0.name, 60) || "Appointments", minutes: Math.max(5, Math.min(480, Math.round(num(b0.minutes, 30)))),
    services: (Array.isArray(b0.services) ? b0.services : []).slice(0, 6).map((s) => ({ name: clip(s && s.name, 80), mins: Math.max(5, Math.min(720, Math.round(num(s && (s.minutes || s.mins), 30)))), price: clip(s && s.price, 20) })).filter((s) => s.name) };
  return { title: clip(o.title, 80) || "My website", tagline: clip(o.tagline, 140), palette: palette(o.palette), contact, pages, products, booking, features: { shop: !!w.shop, booking: !!w.booking, contact: !!w.contact } };
}

/** a seed sent with a site's save (pure): {products: [{name, slug, category, price, description, image}]} */
function cleanSeed(s0) {
  const s = s0 && typeof s0 === "object" ? s0 : null; if (!s) return null;
  const used = new Set();
  const products = (Array.isArray(s.products) ? s.products : []).slice(0, 200).map((x) => {
    let slug = slugOf(x && (x.slug || x.name)) || "product"; const b = slug; let n = 2; while (used.has(slug)) slug = b + "-" + n++; used.add(slug);
    const img = String((x && x.image) || ""); return { name: clip(x && x.name, 200), slug, category: clip(x && x.category, 120), price: Math.max(0, Math.round(num(x && x.price, 0) * 100) / 100),
      description: clipP(x && x.description, 2000), image: /^[\w.-]{1,120}\.(png|jpe?g|webp|gif)$/i.test(img) ? img : "" };
  }).filter((x) => x.name);
  return products.length ? { products } : null;
}
const q = (v) => (v == null ? "NULL" : "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'");
/** the products + their categories -> SQL for the admin database (pure; INSERT IGNORE by slug - run again, nothing doubled) */
function seedSql(seed0) {
  const seed = cleanSeed(seed0); if (!seed) return "";
  const cats = []; for (const p of seed.products) if (p.category && !cats.some((c) => c.name === p.category)) cats.push({ name: p.category, slug: slugOf(p.category) || "category" });
  const out = ["-- 🛒 The shop's first products, from bitGen Studio's 🌐 Build Me a Website (run again = nothing doubled; change them in /admin/)"];
  cats.forEach((c, i) => out.push(`INSERT IGNORE INTO categories (name, slug, sort) VALUES (${q(c.name)}, ${q(c.slug)}, ${i + 1});`));
  seed.products.forEach((p, i) => {
    out.push(`INSERT IGNORE INTO products (name, slug, short_description, description, price, stock, track_stock, image, featured) VALUES (${q(p.name)}, ${q(p.slug)}, ${q(p.description.split(/(?<=[.!?])\s/)[0].slice(0, 480))}, ${q(p.description)}, ${p.price.toFixed(2)}, 0, 0, ${q(p.image)}, ${i < 4 ? 1 : 0});`);
    if (p.category) out.push(`INSERT IGNORE INTO product_categories (product_id, category_id) SELECT p.id, c.id FROM products p, categories c WHERE p.slug = ${q(p.slug)} AND c.slug = ${q(slugOf(p.category) || "category")};`);
  });
  return out.join("\n") + "\n";
}

/** {ask, shop, booking, contact} -> {plan} (the ticks win over the words) */
async function plan(o) {
  const a = o || {}, ask = clipP(a.ask, 4000);
  if (!ask) throw bad("say what the website is for - the business, what it sells or offers, its details");
  const w = wants(ask); for (const k of ["shop", "booking", "contact"]) if (typeof a[k] === "boolean") w[k] = a[k];
  const r = await call({ messages: [{ role: "system", content: SYSTEM(w) }, { role: "user", content: ask + "\n\nThe JSON:" }], temperature: 0.6, max_tokens: 6000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const j = SA.parsePlan(r.text);
  if (!j) throw bad("the LLM's answer was not a website plan - try again", 502);
  const p = clean(j, w);
  if (!p.pages.some((x) => x.heading || x.sections.length)) throw bad("the LLM's website was empty - try again", 502);
  return { plan: p };
}
module.exports = { KINDS, wants, clean, cleanSeed, seedSql, slugOf, plan, setComplete, SYSTEM };
