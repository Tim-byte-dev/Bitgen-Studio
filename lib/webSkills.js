// lib/webSkills.js — 2.859.0 🧩 WEB SKILLS (Tim: "add skills/scripts for galleries - picture,video-audio-3d models, layout, css, ajax,
// login, categories, product page,checkout etc"). bitGen's own components in web/skills/<id>/ (our own code - the 3D viewer reuses the
// app's three.js build, MIT, its licence copied beside it):
//   skill.json  {name, icon, group, description, head [css], scripts [js], files [paths], needs?: "php", app_files?: {www path: app path}}
//   files/      what is copied into www/ (library files bg-* are refreshed; pages and pictures of yours are never overwritten)
//   snippet.html the markup put into the page;  SKILL.md  the sheet the LLM is given (✨)
// install(id) copies the files; the page side puts the snippet + the <link> / <script> tags into the open page. ✨ ai({ask, skills})
// = the LLM writes one section with those skills' sheets (routed by words when none are picked), the files installed.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "web", "skills"), APP = path.join(__dirname, "..");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let completeFn = null;
function setComplete(f) { completeFn = f; }   // tests
const W = () => require("./webProject");
function meta(id) {
  const d = path.join(ROOT, String(id || "").replace(/[^\w-]/g, "")), f = path.join(d, "skill.json");
  if (!fs.existsSync(f)) throw bad("no web skill " + id, 404);
  return Object.assign({ id: path.basename(d), head: [], scripts: [], files: [] }, JSON.parse(fs.readFileSync(f, "utf8")), { dir: d });
}
function list() {
  return { skills: (fs.existsSync(ROOT) ? fs.readdirSync(ROOT).sort() : []).filter((d) => fs.existsSync(path.join(ROOT, d, "skill.json"))).map((d) => {
    const m = meta(d); return { id: m.id, name: m.name, icon: m.icon, group: m.group, description: m.description, needs: m.needs || null, head: m.head, scripts: m.scripts, files: m.files.concat(Object.keys(m.app_files || {})) };
  }) };
}
const snippet = (id) => fs.readFileSync(path.join(meta(id).dir, "snippet.html"), "utf8");
const sheet = (id) => fs.readFileSync(path.join(meta(id).dir, "SKILL.md"), "utf8");
/** refreshed on every install: bitGen's library files (bg-*, vendor/) - the rest only when not there yet */
const LIB = (rel) => /(^|\/)bg-[\w.-]+$/.test(rel) || /^js\/vendor\//.test(rel);
/** copy a skill's files into www -> {skill, copied, kept, head, scripts, snippet, needs} */
function install(id) {
  const m = meta(id); if (!W().has()) W().create();
  const copied = [], kept = [];
  const put = (rel, from) => {
    const to = W().safe(rel);
    if (fs.existsSync(to) && !LIB(rel)) { kept.push(rel); return; }
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); copied.push(rel);
  };
  for (const rel of m.files) put(rel, path.join(m.dir, "files", rel));
  for (const [rel, app] of Object.entries(m.app_files || {})) { const from = path.join(APP, app); if (fs.existsSync(from)) put(rel, from); }
  return { skill: m.id, name: m.name, copied, kept, head: m.head, scripts: m.scripts, snippet: snippet(m.id), needs: m.needs || null };
}
const ROUTES = [[/\b(video|film|clip)s?\b/i, "gallery-video"], [/\b(audio|music|songs?|podcast|tracks?|playlist)\b/i, "gallery-audio"], [/\b3d|models?\b|\bglb\b/i, "gallery-3d"],
  [/\b(gallery|galleries|photos?|pictures?|portfolio|images?)\b/i, "gallery-pictures"], [/\b(cart|checkout|basket|order)\b/i, "cart-checkout"], [/\b(product page|one product|product detail)/i, "product-page"],
  [/\b(shop|store|products?|catalog(ue)?|categor(y|ies))\b/i, "categories"], [/\b(log ?in|sign ?in|members?|account|register)\b/i, "login"], [/\b(news|posts?|blog|load|ajax|form)\b/i, "ajax"]];
function route(ask) { const out = []; for (const [re, id] of ROUTES) if (re.test(String(ask || "")) && !out.includes(id)) out.push(id); if (!out.length) out.push("layout"); return out.slice(0, 3); }
const RULES = `You write ONE section of a web page (HTML only - no <html>, <head> or <body>, no <script> or <style> tags, no inline event handlers) for a site
made with bitGen Studio's web skills. Use ONLY the classes, attributes and files the skill sheets below give (they are already on the site): the theme's
.bg-btn / .bg-card / .bg-form, the layout's .bg-section / .bg-wrap / .bg-grid / .bg-cols, and each skill's own markup. Real, specific words for the
business - no lorem ipsum. Pictures: images/<name>.jpg (say in an HTML comment which pictures to add), videos and sounds: media/<name>. Answer with
the HTML only, in one \`\`\`html block.`;
/** ✨ the LLM writes one section with the skills -> {html, skills (installed)} */
async function ai(o) {
  const a = o || {}, ask = String(a.ask || "").trim(); if (!ask) throw bad("say what the section should be");
  const known = list().skills.map((s) => s.id);
  const ids = (Array.isArray(a.skills) && a.skills.length ? a.skills.filter((x) => known.includes(x)) : route(ask)).slice(0, 4);
  const use = Array.from(new Set(["theme", "layout"].concat(ids)));
  const sys = RULES + "\n\n" + use.map((id) => sheet(id)).join("\n\n");
  const llm = completeFn || ((x) => require("./llmChat").complete(require("./core"), x));
  const r = await llm({ messages: [{ role: "system", content: sys }, { role: "user", content: ask.slice(0, 4000) }], temperature: 0.4, max_tokens: 4000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const m = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(r.text || ""), html = clean(m ? m[1] : String(r.text || ""));
  if (!html.trim()) throw bad("the LLM's answer had no HTML", 502);
  return { html, skills: use.map(install) };
}
/** what the LLM gives is put on the page: no scripts, no inline handlers, no javascript: links */
function clean(h) {
  return String(h).replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/<\/?(html|head|body|style|iframe|object|embed)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"').trim() + "\n";
}
module.exports = { ROOT, list, meta, snippet, sheet, install, route, ai, clean, setComplete, LIB };
