// lib/siteBuild.js — 🌐 A WEBSITE FROM THE IMAGE EDITOR'S PAGES (2.843.0).
// Tim (verbatim): "now everything is is place for an ai website builder, we can build the website in image editor and make it in
// the language the user needs like php/mysql, we can generate images, videos and content, edit products with qwen etc." + his
// picks: "Both, chosen per site" (static or PHP + MySQL), "AI makes it responsive", publish = "Push to a GitHub repo" (2.846.0).
//   A SITE   projects/<p>/sites/<name>/ - site.json {name, title, stack static|php, lang, pages: [{slug, title}]},
//            src/<slug>.json (each editor page's elements - pcsite.js), assets/ (its pictures), build/ (the website),
//            preview/ (always static - what bitGen shows; PHP needs a PHP server)
//   BUILD    each page's elements (text, rich text, pictures with their boxes on a 1200 px wide design) -> the LLM writes that
//            page's responsive HTML + CSS (the words and pictures as given) - checked (no scripts, no on* handlers, only the
//            site's own pictures); without an LLM (or when it fails) bitGen lays it out itself: rows by height, flex, wraps on
//            phones. Static: <slug>.html + css/site.css + a nav. PHP + MySQL: <slug>.php with inc/header.php / footer.php,
//            inc/config.php + inc/db.php (PDO), contact.php (a form saved to MySQL - messages), schema.sql, README.txt.
"use strict";
const fs = require("fs"), path = require("path");
let DIR = null, completeFn = null;
function setDir(d) { DIR = d; }
function setComplete(fn) { completeFn = fn; }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
function root() { const d = DIR || require("./core").pDir("sites"); fs.mkdirSync(d, { recursive: true }); return d; }
const slugOf = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "page";
function safeName(n) { const s = String(n || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60); if (!s || /^\.+$/.test(s)) throw bad("give the website a name"); return s; }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const siteDir = (name) => path.join(root(), safeName(name));
function list() {
  return fs.readdirSync(root()).filter((d) => fs.existsSync(path.join(root(), d, "site.json"))).map((d) => { try { return JSON.parse(fs.readFileSync(path.join(root(), d, "site.json"), "utf8")); } catch (e) { return null; } }).filter(Boolean);
}
/** the editor's pages arrive: {name, title, stack, lang, pages: [{title, slug?, w, h, bg, els}], assets: [{name, b64}]} */
function save(o) {
  const a = o || {}, name = safeName(a.name), dir = siteDir(name);
  const pages = (Array.isArray(a.pages) ? a.pages : []).slice(0, 60);
  if (!pages.length) throw bad("the website has no pages");
  const used = new Set();
  const meta = { name, title: String(a.title || name).slice(0, 120), stack: a.stack === "php" ? "php" : "static", lang: /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(a.lang || "") ? a.lang : "en", saved: new Date().toISOString(), pages: [] };
  // 2.848.0: 🔐 the admin area (always with a calendar; else when ticked) + its setup key, kept from build to build
  let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(dir, "site.json"), "utf8")) || {}; } catch (e) { /* a new site */ }
  meta.admin = a.admin === undefined ? !!old.admin : !!a.admin;
  // 2.850.0: 🛒 the shop front end (PHP sites; it brings the admin area - its products, orders and clients live there)
  meta.shop = a.shop === undefined ? !!old.shop : !!a.shop;
  if (meta.shop) { meta.admin = true; meta.stack = "php"; }
  // 2.852.0: the shop's first products (🌐 Build Me a Website) - kept from save to save unless sent again
  const seed = a.seed === undefined ? old.seed : require("./siteAi").cleanSeed(a.seed);
  if (seed) meta.seed = seed;
  if (/^[A-Za-z0-9]{16,64}$/.test(old.adminKey || "")) meta.adminKey = old.adminKey;
  fs.mkdirSync(path.join(dir, "src"), { recursive: true }); fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  pages.forEach((p, i) => {
    let s = i === 0 ? "index" : slugOf(p.slug || p.title || "page-" + (i + 1)); while (used.has(s)) s += "-" + (i + 1); used.add(s);
    meta.pages.push({ slug: s, title: String(p.title || (i === 0 ? "Home" : "Page " + (i + 1))).slice(0, 80) });
    const els = (Array.isArray(p.els) ? p.els : []).slice(0, 400).map((e) => cleanEl(e)).filter(Boolean);
    fs.writeFileSync(path.join(dir, "src", s + ".json"), JSON.stringify({ title: meta.pages[i].title, w: +p.w || 1200, h: +p.h || 800, bg: /^#[0-9a-f]{3,8}$/i.test(p.bg || "") ? p.bg : "#ffffff", els }, null, 1));
  });
  for (const as of (Array.isArray(a.assets) ? a.assets : []).slice(0, 2000)) {
    const n = String(as.name || ""); if (!/^[\w.-]{1,80}\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(n)) continue;
    const b = Buffer.from(String(as.b64 || ""), "base64"); if (!b.length || b.length > 60 * 1024 * 1024) continue;
    fs.writeFileSync(path.join(dir, "assets", n), b);
  }
  fs.writeFileSync(path.join(dir, "site.json"), JSON.stringify(meta, null, 2));
  return meta;
}
function cleanEl(e) {
  if (!e || typeof e !== "object") return null;
  const b = e.box || {}, box = { x: Math.round(+b.x || 0), y: Math.round(+b.y || 0), w: Math.max(1, Math.round(+b.w || 1)), h: Math.max(1, Math.round(+b.h || 1)) };
  if (e.kind === "text") return { kind: "text", text: String(e.text || "").slice(0, 5000), size: Math.max(6, Math.min(200, +e.size || 16)), color: /^#[0-9a-f]{3,8}$|^rgba?\([\d\s.,%]+\)$/i.test(e.color || "") ? e.color : "#222222", bold: !!e.bold, italic: !!e.italic, align: ["left", "center", "right"].includes(e.align) ? e.align : "left", font: String(e.font || "").replace(/[^\w\s-]/g, "").slice(0, 40), box };
  if (e.kind === "rich") return { kind: "rich", html: String(e.html || "").slice(0, 200000), box };
  if (e.kind === "box") return /^#[0-9a-f]{3,8}$/i.test(e.color || "") ? { kind: "box", color: e.color, radius: Math.max(0, Math.min(400, Math.round(+e.radius || 0))), box } : null;   // 2.852.0
  if (e.kind === "calendar") return { kind: "calendar", cal: require("../static/sitecal.js").clean(e.cal), box };   // 2.846.0: 📅 a booking calendar
  if (e.kind === "image") return /^[\w.-]{1,80}\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(e.src || "") ? Object.assign({ kind: "image", src: String(e.src), alt: String(e.alt || "").slice(0, 200), box }, /^[\w.-]{1,80}\.(png|jpe?g|webp)$/i.test(e.poster || "") ? { poster: String(e.poster) } : {}) : null;   // 2.853.0: + a film's poster
  return null;
}
/* ---------- the page's HTML checked: no scripts / handlers / outside resources; only the site's own pictures */
function cleanHtml(html, assets) {
  let h = String(html || "");
  h = h.replace(/<\s*(script|iframe|object|style|noscript|template)\b[\s\S]*?<\/\s*\1\s*>/gi, "");
  h = h.replace(/<\s*\/?\s*(script|iframe|object|embed|base|meta|link|style|noscript|template)\b[^>]*>/gi, "");
  h = h.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  h = h.replace(/(href|src|action)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
  h = h.replace(/<img\b[^>]*>/gi, (tag) => { const m = /\ssrc\s*=\s*("|')([^"']*)\1/i.exec(tag); const s = m ? m[2].replace(/^\.?\/?/, "") : ""; return assets.has(s.replace(/^assets\//, "")) ? tag.replace(m[0], ` src="assets/${s.replace(/^assets\//, "")}"`) : ""; });
  h = h.replace(/<(video|source)\b[^>]*>/gi, (tag) => { const m = /\ssrc\s*=\s*("|')([^"']*)\1/i.exec(tag); if (!m) return tag; const s = m[2].replace(/^\.?\/?(assets\/)?/, ""); if (!assets.has(s)) return ""; let t = tag.replace(m[0], ` src="assets/${s}"`); const pm = /\sposter\s*=\s*("|')([^"']*)\1/i.exec(t); if (pm) { const ps = pm[2].replace(/^\.?\/?(assets\/)?/, ""); t = t.replace(pm[0], assets.has(ps) ? ` poster="assets/${ps}"` : ""); } return t; });   // 2.853.0: a film's poster only from the site's own pictures
  return h.trim();
}
function cleanCss(css) { return String(css || "").replace(/@import[^;]*;?/gi, "").replace(/url\(\s*(['"]?)(?!assets\/|\.\.\/assets\/|data:)[^)]*\)/gi, "none").replace(/expression\s*\(|javascript:|<\/?style>/gi, "").slice(0, 200000); }
/* ---------- bitGen's own layout (no LLM): rows by height, side by side in a row, wrapping on phones */
function rowsOf(els) {
  const s = els.slice().sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x), rows = [];
  for (const e of s) { const r = rows[rows.length - 1]; if (r && e.box.y < r.bottom - Math.min(e.box.h, r.bottom - r.top) * 0.4) { r.els.push(e); r.bottom = Math.max(r.bottom, e.box.y + e.box.h); } else rows.push({ top: e.box.y, bottom: e.box.y + e.box.h, els: [e] }); }
  for (const r of rows) r.els.sort((a, b) => a.box.x - b.box.x);
  return rows;
}
function elHtml(e, W) {
  if (e.kind === "calendar") return calPlace(e.cal.slug);
  if (e.kind === "image") return /\.(mp4|webm)$/i.test(e.src) ? (e.poster ? `<video src="assets/${esc(e.src)}" poster="assets/${esc(e.poster)}" autoplay muted loop playsinline style="width:100%;height:auto"></video>` : `<video src="assets/${esc(e.src)}" controls playsinline style="width:100%;height:auto"></video>`) : `<img src="assets/${esc(e.src)}" alt="${esc(e.alt)}" loading="lazy">`;
  if (e.kind === "rich") return `<div class="rich">${e.html}</div>`;
  const tag = e.size >= 40 ? "h1" : e.size >= 28 ? "h2" : e.size >= 21 ? "h3" : "p";
  const st = `color:${e.color};text-align:${e.align};font-size:clamp(${Math.max(12, Math.round(e.size * 0.6))}px, ${(e.size / W * 100).toFixed(2)}vw, ${Math.round(e.size)}px)${e.bold ? ";font-weight:700" : ""}${e.italic ? ";font-style:italic" : ""}`;
  return `<${tag} style="${st}">${esc(e.text).replace(/\n/g, "<br>")}</${tag}>`;
}
/** 2.846.0: where a calendar goes in a page's HTML (filled in at build: the PHP widget, or a static month) */
const calPlace = (slug) => `<div class="bgcal-place" data-bgcal="${slug}"></div>`;
const CAL_RE = /<div[^>]*\bdata-bgcal="([a-z0-9-]+)"[^>]*>\s*<\/div>/g;
const calsOf = (page) => page.els.filter((e) => e.kind === "calendar");
/** 2.852.0: a row's elements in COLUMNS - things one above another (their widths overlapping) share a column (pure) */
function colsOf(els) {
  const cols = [];
  for (const e of els.slice().sort((a, b) => a.box.x - b.box.x)) {
    const x0 = e.box.x, x1 = e.box.x + e.box.w;
    const c = cols.find((k) => Math.min(x1, k.x1) - Math.max(x0, k.x0) > Math.min(e.box.w, k.x1 - k.x0) * 0.3);
    if (c) { c.els.push(e); c.x0 = Math.min(c.x0, x0); c.x1 = Math.max(c.x1, x1); } else cols.push({ x0, x1, els: [e] });
  }
  for (const c of cols) c.els.sort((a, b) => a.box.y - b.box.y);
  return cols.sort((a, b) => a.x0 - b.x0);
}
const rowsHtml = (els, W) => rowsOf(els).map((r) => { const cols = colsOf(r.els);
  return cols.length === 1 ? `<section class="row">${cols[0].els.map((e) => elHtml(e, W)).join("\n")}</section>`
    : `<section class="row cols">${cols.map((c) => `<div class="col" style="flex:${Math.max(1, Math.round((c.x1 - c.x0) / W * 12))} 1 ${Math.round((c.x1 - c.x0) / W * 100)}%">${c.els.map((e) => elHtml(e, W)).join("\n")}</div>`).join("")}</section>`; }).join("\n");
/** 2.852.0: the coloured BANDS (a box nearly the page's width): the elements sitting on one go in a full-width section of its colour;
 *  smaller boxes are decoration and left out (pure) -> [{band, els} | {els}] top to bottom */
function bandsOf(page) {
  const W = page.w || 1200, all = page.els || [];
  const inside = (a, b) => a !== b && a.box.x >= b.box.x - 2 && a.box.y >= b.box.y - 2 && a.box.x + a.box.w <= b.box.x + b.box.w + 2 && a.box.y + a.box.h <= b.box.y + b.box.h + 2;
  const wide = all.filter((e) => e.kind === "box" && e.box.w >= W * 0.85);
  // a band holding other bands is the backdrop behind them (not a section of its own)
  const bands = wide.filter((b) => !wide.some((x) => inside(x, b))).sort((a, b) => a.box.y - b.box.y);
  const loose = all.filter((e) => e.kind !== "box"), on = new Map(bands.map((b) => [b, []])), out = [];
  for (const e of loose) {
    const cy = e.box.y + e.box.h / 2, cx = e.box.x + e.box.w / 2;
    const b = bands.filter((x) => cy >= x.box.y && cy <= x.box.y + x.box.h && cx >= x.box.x && cx <= x.box.x + x.box.w).pop();   // the top-most band under it
    if (b) on.get(b).push(e); else out.push({ y: e.box.y, els: [e] });
  }
  for (const b of bands) out.push({ y: b.box.y, band: b, els: on.get(b) });
  out.sort((a, b) => a.y - b.y);
  const merged = [];
  for (const g of out) { const l = merged[merged.length - 1]; if (!g.band && l && !l.band) l.els.push(...g.els); else merged.push({ band: g.band || null, els: g.els.slice() }); }
  return merged.filter((g) => g.band || g.els.length);
}
function ownLayout(page) {
  const W = page.w || 1200;
  const html = bandsOf(page).map((g) => (g.band ? `<section class="band" style="background:${g.band.color}">\n${rowsHtml(g.els, W)}\n</section>` : rowsHtml(g.els, W))).join("\n");
  return { html, css: "" };
}
const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5;color:#222;background:var(--page-bg,#fff)}
img,video{max-width:100%;height:auto;display:block}
.site-nav{display:flex;flex-wrap:wrap;gap:4px 18px;align-items:center;padding:12px 24px;border-bottom:1px solid rgba(0,0,0,.1)}
.site-nav a{color:inherit;text-decoration:none;font-weight:600}
.site-nav a[aria-current]{text-decoration:underline}
main{max-width:1200px;margin:0 auto;padding:16px 24px}
.row{margin:0 0 18px}
.row.cols{display:flex;gap:24px;align-items:flex-start}
.row .col{min-width:0}
.band{margin:0 calc(50% - 50vw) 18px;padding:40px max(24px, calc(50vw - 576px))}.band:first-child{margin-top:-16px}.band .row:last-child{margin-bottom:0}
.site-foot{padding:18px 24px;text-align:center;font-size:.9em;opacity:.75;border-top:1px solid rgba(0,0,0,.1)}
form.contact{display:grid;gap:10px;max-width:560px}
form.contact input,form.contact textarea{font:inherit;padding:8px;border:1px solid #bbb;border-radius:4px;width:100%}
form.contact button{font:inherit;padding:9px 18px;border:0;border-radius:4px;background:#222;color:#fff;cursor:pointer;justify-self:start}
@media (max-width:760px){.row.cols{flex-direction:column}main{padding:12px}}
`;
const SYSTEM = `You turn one page of a website design into responsive HTML and CSS. You get the page's elements as JSON - their kind (text, rich = HTML text, image), their words / picture file and their box on a design W pixels wide. Answer with ONE JSON object and nothing else:
{"html": "the page's content: sections in reading order (top to bottom, left to right), the HTML that goes inside <main>", "css": "CSS for classes you use, prefixed with .p-<slug> (the <main> has that class)"}
Rules: a box (kind box) as wide as the page is a full-width coloured BAND: put the elements that sit on it inside one <section> with that background colour (full width, padding); smaller boxes are decoration - leave them out; a calendar element (kind calendar) is written exactly as <div data-bgcal="SLUG"></div> (its slug) where it sits - bitGen fills it in; use EVERY text exactly as given (headings from the big texts: h1 for the biggest, then h2 / h3; p for body text) and every picture as <img src="assets/FILE" alt="…"> with its file name exactly (a file ending .mp4 / .webm is a FILM: <video src="assets/FILE" poster="assets/POSTER" autoplay muted loop playsinline> with its poster when it has one); keep things that sit side by side in the design side by side with CSS grid or flex and let them stack on screens under 760 px; widths in % / fr / rem / clamp(), never fixed pixel widths over 400 px; the given colours; system fonts; a contact form, when the design asks for one, as <form class="contact" method="post" action="contact.php"> with name / email / message fields; no <script>, no <style>, no outside links or pictures, no lorem ipsum.`;
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
async function aiPage(page, slug, W) {
  const els = page.els.map((e) => e.kind === "rich" ? Object.assign({}, e, { html: e.html.slice(0, 20000) }) : e.kind === "calendar" ? { kind: "calendar", slug: e.cal.slug, box: e.box } : e);
  const user = `The page "${page.title}" (slug ${slug}), the design ${W} px wide, background ${page.bg}:\n${JSON.stringify(els)}\n\nThe JSON:`;
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: 0.2, max_tokens: 12000 });
  if (!r || !r.ok) throw new Error("the LLM did not answer" + (r && r.error ? ": " + r.error : ""));
  const p = require("./slideAi").parsePlan(r.text);
  if (!p || typeof p.html !== "string" || !p.html.trim()) throw new Error("the LLM's answer was not a page");
  return { html: p.html, css: typeof p.css === "string" ? p.css : "" };
}
/** every text of the design is in the HTML (a check on the LLM's page - else bitGen's own layout is used) */
function keepsWords(page, html) {
  const plain = String(html).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ");
  const words = page.els.filter((e) => e.kind === "text" && e.text.trim()).map((e) => e.text);
  for (const e of page.els) if (e.kind === "rich") for (const t of String(e.html).split(/<[^>]+>/)) if (t.trim().length >= 3) words.push(t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " "));
  if (!calsOf(page).every((e) => String(html).includes(`data-bgcal="${e.cal.slug}"`))) return false;   // 2.846.0: every calendar kept
  return words.every((w) => plain.includes(w.replace(/\s+/g, " ").trim().slice(0, 60)));
}
function navHtml(meta, slug, ext) { return `<nav class="site-nav"><strong>${esc(meta.title)}</strong>${meta.pages.map((p) => `<a href="${p.slug}${ext}"${p.slug === slug ? ' aria-current="page"' : ""}>${esc(p.title)}</a>`).join("")}</nav>`; }
function htmlDoc(meta, pg, page, main, ext) {
  return `<!DOCTYPE html>\n<html lang="${meta.lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(pg.title)} - ${esc(meta.title)}</title>\n<link rel="stylesheet" href="css/site.css">\n</head>\n<body style="--page-bg:${page.bg}">\n${navHtml(meta, pg.slug, ext)}\n<main class="p-${pg.slug}">\n${main}\n</main>\n<footer class="site-foot">© ${new Date().getFullYear()} ${esc(meta.title)}</footer>\n</body>\n</html>\n`;
}
function rmrf(d) { fs.rmSync(d, { recursive: true, force: true }); }
function copyAssets(dir, out) { const a = path.join(dir, "assets"), o = path.join(out, "assets"); fs.mkdirSync(o, { recursive: true }); for (const f of fs.readdirSync(a)) fs.copyFileSync(path.join(a, f), path.join(o, f)); }
const PHP = {
  config: `<?php\n// The database - set these on your host (Plesk: Databases), or as environment variables.\ndefine('DB_HOST', getenv('DB_HOST') ?: 'localhost');\ndefine('DB_NAME', getenv('DB_NAME') ?: 'website');\ndefine('DB_USER', getenv('DB_USER') ?: 'website');\ndefine('DB_PASS', getenv('DB_PASS') ?: '');\n`,
  db: `<?php\nrequire_once __DIR__ . '/config.php';\nfunction db() {\n  static $pdo = null;\n  if ($pdo === null) {\n    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);\n  }\n  return $pdo;\n}\nfunction h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }\n`,
  contact: (meta, body, title, bg, cal) => `<?php\n${cal ? "require_once __DIR__ . '/inc/calendar.php';\n" : ""}$page_title = ${title ? JSON.stringify(String(title)).replace(/\$/g, "\\$") : "'Contact'"};${bg ? ` $page_bg = ${JSON.stringify(bg)};` : ""}\nrequire __DIR__ . '/inc/db.php';\n$ok = null;\nif ($_SERVER['REQUEST_METHOD'] === 'POST') {\n  $name = trim($_POST['name'] ?? ''); $email = trim($_POST['email'] ?? ''); $message = trim($_POST['message'] ?? '');\n  if ($name !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) && $message !== '' && strlen($message) < 10000) {\n    try { db()->prepare('INSERT INTO messages (name, email, message, ip) VALUES (?, ?, ?, ?)')->execute([$name, $email, $message, $_SERVER['REMOTE_ADDR'] ?? '']); $ok = true; if (is_file(__DIR__ . '/inc/admindb.php')) { require_once __DIR__ . '/inc/admindb.php'; bgadm_client($name, $email, '', 'contact'); } }\n    catch (Throwable $e) { $ok = false; }\n  } else { $ok = false; }\n}\ninclude __DIR__ . '/inc/header.php';\n?>\n<main class="p-contact">\n${body ? body + "\n" : ""}<?php if ($ok === true): ?><p>Thank you - your message has been sent.</p>\n<?php elseif ($ok === false): ?><p>Sorry - please fill in your name, a valid email and a message.</p>\n<?php endif; ?>\n<form class="contact" method="post" action="contact.php">\n<label>Name <input name="name" required maxlength="120"></label>\n<label>Email <input name="email" type="email" required maxlength="200"></label>\n<label>Message <textarea name="message" rows="6" required></textarea></label>\n<button type="submit">Send</button>\n</form>\n</main>\n<?php include __DIR__ . '/inc/footer.php'; ?>\n`,
  schema: "-- The website's tables (run once - Plesk: Databases > phpMyAdmin > Import, or mysql < schema.sql)\nCREATE TABLE IF NOT EXISTS messages (\n  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(120) NOT NULL,\n  email VARCHAR(200) NOT NULL,\n  message TEXT NOT NULL,\n  ip VARCHAR(45) NOT NULL DEFAULT '',\n  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n",
};
function phpHeader(meta) {
  return `<?php if (!isset($page_title)) $page_title = ''; $here = basename($_SERVER['SCRIPT_NAME'], '.php'); ?>\n<!DOCTYPE html>\n<html lang="${meta.lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title><?= htmlspecialchars($page_title) ?> - ${esc(meta.title)}</title>\n<link rel="stylesheet" href="css/site.css">\n</head>\n<body<?= isset($page_bg) ? ' style="--page-bg:' . htmlspecialchars($page_bg) . '"' : '' ?>>\n<nav class="site-nav"><strong>${esc(meta.title)}</strong>${meta.pages.map((p) => `<a href="${p.slug}.php"<?= $here === '${p.slug}' ? ' aria-current="page"' : '' ?>>${esc(p.title)}</a>`).join("")}${meta.shop ? SHOP_NAV : ""}</nav>\n`;
}
// 2.850.0: 🛒 the shop's links in the header (the cart shows how many are in it)
const SHOP_NAV = `<a href="shop.php"<?= in_array($here, ['shop', 'product'], true) ? ' aria-current="page"' : '' ?>>Shop</a><a href="cart.php" class="site-cart"<?= in_array($here, ['cart', 'checkout'], true) ? ' aria-current="page"' : '' ?>>Cart<?php if (function_exists('shop_count') && shop_count() > 0): ?> (<?= (int)shop_count() ?>)<?php endif; ?></a>`;
const phpFooter = (meta) => `<footer class="site-foot">© <?= date('Y') ?> ${esc(meta.title)}</footer>\n</body>\n</html>\n`;
/** build the site -> {pages: [{slug, by: ai|bitgen, why?}], dir} */
async function build(name, opt) {
  const o = opt || {}, dir = siteDir(name), metaFile = path.join(dir, "site.json");
  if (!fs.existsSync(metaFile)) throw bad("no website called " + name, 404);
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")), assets = new Set(fs.readdirSync(path.join(dir, "assets")));
  const parts = [], report = [], cals = new Map(), SC = require("../static/sitecal.js");
  let admin = null, shop = false, seeded = 0;
  const calStatic = (body) => body.replace(CAL_RE, (m0, slug) => (cals.has(slug) ? SC.staticHtml(Object.assign({}, cals.get(slug), { lang: meta.lang })) : ""));
  let css = BASE_CSS;
  for (const pg of meta.pages) {
    const page = JSON.parse(fs.readFileSync(path.join(dir, "src", pg.slug + ".json"), "utf8"));
    let body = null, pcss = "", by = "bitgen", why = "";
    if (o.ai !== false) {
      try { const r = await aiPage(page, pg.slug, page.w); const h = cleanHtml(r.html, assets); if (keepsWords(page, h)) { body = h; pcss = cleanCss(r.css); by = "ai"; } else why = "the LLM left words out"; }
      catch (e) { why = e.message; }
    }
    if (body == null) { const r = ownLayout(page); body = cleanHtml(r.html, assets); }
    parts.push({ pg, page, body }); css += pcss ? `\n/* ${pg.slug} */\n${pcss}\n` : "";
    for (const e of calsOf(page)) if (!cals.has(e.cal.slug)) { cals.set(e.cal.slug, e.cal); css += `\n/* 📅 ${e.cal.slug} */\n` + SC.cssFor(e.cal, e.box.w) + "\n"; }
    report.push(Object.assign({ slug: pg.slug, by }, why ? { why } : {}));
  }
  const out = path.join(dir, "build"), prev = path.join(dir, "preview");
  rmrf(out); rmrf(prev);
  for (const d of [out, prev]) { fs.mkdirSync(path.join(d, "css"), { recursive: true }); fs.writeFileSync(path.join(d, "css", "site.css"), css); copyAssets(dir, d); }
  for (const { pg, page, body } of parts) fs.writeFileSync(path.join(prev, pg.slug + ".html"), htmlDoc(meta, pg, page, calStatic(body), ".html"));
  if (meta.stack === "php") {
    fs.mkdirSync(path.join(out, "inc"), { recursive: true });
    fs.writeFileSync(path.join(out, "inc", "config.php"), PHP.config); fs.writeFileSync(path.join(out, "inc", "db.php"), PHP.db);
    fs.writeFileSync(path.join(out, "inc", "header.php"), phpHeader(meta)); fs.writeFileSync(path.join(out, "inc", "footer.php"), phpFooter(meta));
    fs.writeFileSync(path.join(out, "inc", ".htaccess"), "Require all denied\n");
    const lang = String(meta.lang || "en").replace(/[^\w-]/g, "");
    for (const { pg, page, body } of parts) {
      const hasCal = calsOf(page).length > 0, b2 = body.replace(/<\?/g, "&lt;?").replace(CAL_RE, (m0, slug) => (cals.has(slug) ? `<?php bgcal('${slug}', '${lang}'); ?>` : ""));
      // 2.852.0: a page called Contact gets the contact form (and saves it) under its own words
      if (pg.slug === "contact" && !/<form\b/i.test(b2)) { fs.writeFileSync(path.join(out, "contact.php"), PHP.contact(meta, b2, pg.title, page.bg, hasCal)); continue; }
      fs.writeFileSync(path.join(out, pg.slug + ".php"), `<?php ${hasCal ? "require_once __DIR__ . '/inc/calendar.php'; " : ""}$page_title = ${JSON.stringify(pg.title)}; $page_bg = ${JSON.stringify(page.bg)}; include __DIR__ . '/inc/header.php'; ?>\n<main class="p-${pg.slug}">\n${b2}\n</main>\n<?php include __DIR__ . '/inc/footer.php'; ?>\n`);
    }
    if (cals.size) { const cp = require("./siteCalPhp"); fs.writeFileSync(path.join(out, "inc", "calendar.php"), cp.PHP_WIDGET); fs.writeFileSync(path.join(out, "bgcal-ics.php"), cp.PHP_ICS); }
    if (!meta.pages.some((p) => p.slug === "contact")) fs.writeFileSync(path.join(out, "contact.php"), PHP.contact(meta));
    // 2.848.0: 🔐 the admin area - with every calendar, else when ticked (lib/siteAdminPhp.js; its database lib/siteAdminSql.js)
    if (cals.size || meta.admin) {
      const AP = require("./siteAdminPhp"), AS = require("./siteAdminSql"), first = [...cals.values()][0], adminDb = (first && first.db && first.db.admin) || "myadmin";
      if (!/^[A-Za-z0-9]{16,64}$/.test(meta.adminKey || "")) meta.adminKey = require("crypto").randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 20).padEnd(20, "x");
      fs.writeFileSync(path.join(out, "inc", "config.php"), PHP.config + AP.configPart(meta.adminKey, adminDb, meta.title));
      fs.writeFileSync(path.join(out, "inc", "admindb.php"), AP.ADMIN_DB); fs.writeFileSync(path.join(out, "inc", "admin.php"), AP.ADMIN_LIB); fs.writeFileSync(path.join(out, "inc", "admin_pages.php"), AP.ADMIN_PAGES);
      fs.mkdirSync(path.join(out, "admin"), { recursive: true });
      fs.writeFileSync(path.join(out, "admin", "index.php"), AP.ADMIN_INDEX); fs.writeFileSync(path.join(out, "admin", "admin.css"), AP.ADMIN_CSS);
      fs.writeFileSync(path.join(out, "admin-schema.sql"), AS.schemaSql({ business: meta.title, tz: first && first.tz }));
      admin = { db: adminDb, key: meta.adminKey };
    }
    // 2.850.0: 🛒 the shop front end - catalogue, product, cart, checkout, the order's page (lib/siteShopPhp.js)
    if (meta.shop && admin) {
      const SP = require("./siteShopPhp");
      fs.writeFileSync(path.join(out, "inc", "shop.php"), SP.SHOP_LIB);
      for (const [f, src] of [["shop.php", SP.SHOP_PAGE], ["product.php", SP.PRODUCT_PAGE], ["cart.php", SP.CART_PAGE], ["checkout.php", SP.CHECKOUT_PAGE], ["order.php", SP.ORDER_PAGE]]) if (!meta.pages.some((p) => p.slug + ".php" === f)) fs.writeFileSync(path.join(out, f), src);
      fs.appendFileSync(path.join(out, "css", "site.css"), SP.SHOP_CSS);
      shop = true;
      // 2.852.0: the products the AI planned go in with the admin database's tables (INSERT IGNORE - run again, nothing doubled)
      if (meta.seed) { const sq = require("./siteAi").seedSql(meta.seed); if (sq) { fs.appendFileSync(path.join(out, "admin-schema.sql"), "\n" + sq); seeded = meta.seed.products.length; } }
    }
    fs.writeFileSync(path.join(out, "schema.sql"), PHP.schema + (cals.size ? "\n" + SC.schemaSql() + [...cals.values()].map((c) => SC.seedSql(c)).join("") : ""));
    fs.writeFileSync(path.join(out, "README.txt"), `${meta.title} - made with bitGen Studio\n\nPHP 8 + MySQL / MariaDB.${admin ? `\n\n🔐 THE ADMIN AREA: yoursite/admin/\n- Its database: a second database called ${admin.db} (make it on your host - Plesk: Databases > Add Database - and import admin-schema.sql into it; a host that adds a prefix (e.g. user_${admin.db}) or allows one database only: put that database's name in inc/config.php as ADMIN_DB_NAME - the admin's tables have names of their own).\n- The first visit to /admin/ makes the OWNER login with the setup key: ${admin.key}\n  (ADMIN_SETUP_KEY in inc/config.php - it works only while there is no login yet).\n- Logins: owner > admin > staff; 5 wrong passwords in a row lock a login for 15 minutes; every try is in admin_login_history; every change in admin_audit_log.\n- Clients (bookings and contact messages add them by email), pets, records (consultations, treatments, follow-ups), staff, bookings (approve / cancel / phone bookings / notes), closed days, hours + services, products, categories, coupons, shipping, orders, invoices, payments, reviews, newsletter, settings.` : ""}${shop ? `\n\n🛒 THE SHOP: shop.php (the catalogue - categories, search), product.php, cart.php (quantities, a code, shipping), checkout.php, order.php (each order's own page - its link is in the buyer's e-mail).\n- Products, categories, coupons, shipping methods: /admin/ (a product's picture: put the file in assets/ and its name in the product's image).\n- Settings (/admin/ ▸ Settings): currency, tax_rate, prices_include_tax (1 = the prices include the tax), pay_bank + bank_details, pay_pickup + pickup_note, order_email (who hears of each new order), order_prefix.\n- An order takes the stock (track_stock; allow_backorder lets it go below 0), adds the client, a pending payment and its status history; mark it paid in /admin/ ▸ Orders.\n- Card payments online need the shop's own account with a payment provider - not built in.${seeded ? `\n- admin-schema.sql also puts in the ${seeded} product(s) planned with the site (their pictures are in assets/) - change them in /admin/ ▸ Products.` : ""}` : ""}\n1. Upload everything to the site's folder (Plesk: httpdocs).\n2. Make a database and its user (Plesk: Databases > Add Database), then import schema.sql.\n3. Put the database's name, user and password in inc/config.php (or set DB_HOST / DB_NAME / DB_USER / DB_PASS).\nThe contact form saves messages in the messages table.\n${cals.size ? `\n\n📅 Booking calendars (${[...cals.values()].map((c) => c.name).join(", ")}): inc/calendar.php shows them; their tables are in schema.sql (bg_calendars, bg_cal_hours, bg_cal_services, bg_cal_closed, bg_cal_bookings). A visitor books a time (a service, if the calendar has them), gets a link to see, add to their calendar (bgcal-ics.php) or cancel it, and e-mails when the calendar sends them (PHP mail()). Close a day: add a row to bg_cal_closed. The bookings: the view bg_cal_upcoming (phpMyAdmin) - or bitGen Studio's 📅 Calendar settings ▸ Bookings while you test.` : ""}`);
  } else {
    for (const { pg, page, body } of parts) fs.writeFileSync(path.join(out, pg.slug + ".html"), htmlDoc(meta, pg, page, calStatic(body).replace(/action="contact\.php"/g, 'action="mailto:"'), ".html"));
  }
  meta.built = new Date().toISOString(); meta.report = report; fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  return { name: meta.name, stack: meta.stack, pages: report, admin, shop, preview: `/sites-preview/${encodeURIComponent(meta.name)}/index.html` };
}
/** the built site as a zip (JSZip, MIT) */
async function zip(name) {
  const out = path.join(siteDir(name), "build"); if (!fs.existsSync(out)) throw bad("build the website first", 404);
  const JSZip = require("jszip"), z = new JSZip();
  const walk = (d, rel) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), r = rel ? rel + "/" + f : f; if (fs.statSync(p).isDirectory()) walk(p, r); else z.file(r, fs.readFileSync(p)); } };
  walk(out, ""); return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
/* ---------- 2.853.0: 🛒 the shop's product pictures, changed after the build (✏ edited with the edit model in the studio) */
const ASSET_RE = /^[\w.-]{1,120}\.(png|jpe?g|webp|gif)$/i;
/** the site's planned products with their pictures -> [{name, slug, image, has}] */
function products(name) {
  const dir = siteDir(name), f = path.join(dir, "site.json"); if (!fs.existsSync(f)) throw bad("no website called " + name, 404);
  const meta = JSON.parse(fs.readFileSync(f, "utf8"));
  return ((meta.seed && meta.seed.products) || []).map((p) => ({ name: p.name, slug: p.slug, price: p.price, image: p.image || "", has: !!(p.image && fs.existsSync(path.join(dir, "assets", p.image))) }));
}
/** a picture of the site (its assets/) -> the file's path */
function assetFile(name, file) {
  const f = String(file || ""); if (!ASSET_RE.test(f)) throw bad("not a picture's name", 400);
  const p = path.join(siteDir(name), "assets", f); if (!fs.existsSync(p)) throw bad("not found", 404); return p;
}
/** a product's picture replaced (or given): {name, slug, b64, ext} -> {image}; the file name stays when it had one */
function putProductPicture(o) {
  const a = o || {}, dir = siteDir(a.name), f = path.join(dir, "site.json"); if (!fs.existsSync(f)) throw bad("no website called " + a.name, 404);
  const meta = JSON.parse(fs.readFileSync(f, "utf8")), p = ((meta.seed && meta.seed.products) || []).find((x) => x.slug === a.slug);
  if (!p) throw bad("no product " + a.slug + " in this website", 404);
  const b = Buffer.from(String(a.b64 || ""), "base64"); if (!b.length || b.length > 30 * 1024 * 1024) throw bad("the picture is empty or too big");
  const ext = /^(png|jpe?g|webp)$/i.test(a.ext || "") ? a.ext.toLowerCase() : "png";
  const was = p.image && ASSET_RE.test(p.image) ? p.image : "", base = was ? was.replace(/\.[a-z0-9]+$/i, "") : ("prod-" + p.slug).slice(0, 72);
  p.image = base + "." + ext;
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  if (was && was !== p.image) { try { fs.unlinkSync(path.join(dir, "assets", was)); } catch (e) { /* not there */ } }   // a .jpg in place of a .png: the old file goes
  fs.writeFileSync(path.join(dir, "assets", p.image), b);
  fs.writeFileSync(f, JSON.stringify(meta, null, 2));
  return { image: p.image };
}
function previewFile(name, rel) {
  const d = path.join(siteDir(name), "preview"), p = path.resolve(d, String(rel || "index.html").replace(/^\/+/, ""));
  if (!p.startsWith(path.resolve(d) + path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) throw bad("not found", 404);
  return p;
}
module.exports = { cleanEl, elHtml, products, assetFile, putProductPicture, bandsOf, colsOf, setDir, setComplete, list, save, build, zip, previewFile, cleanHtml, cleanCss, rowsOf, ownLayout, keepsWords, slugOf, SYSTEM, BASE_CSS };
