// lib/webProject.js — 2.856.0 🌐 the WEB EDITOR's files (Tim: "please make a separate docker for web editor, separate it into
// 4 tabs, CRM, WYSIWYG, code, preview, add a collapsible files panel ... in the project menu, new dialog add a checkbox for
// website - if it is checked then build a www folder inside the project name and all of the necessary folders").
//   projects/<p>/www/        the website itself (what goes on the host): index.html, about.html, contact.html, 404.html,
//                            css/ js/ images/ fonts/ media/ inc/ admin/ data/ uploads/, robots.txt, .htaccess
//   www/data/content.json    the CMS part: posts + products (public - the site reads it)
//   projects/<p>/web/crm.json the CRM part: clients, bookings, orders, messages (PRIVATE - never inside www/)
//   projects/<p>/web/trash/  deleted files (moved, not destroyed)
// Every path is checked to stay inside www/ (no "..", no absolute paths, no links out).
"use strict";
const fs = require("fs"), path = require("path");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let projFn = null;
function setProjectDir(f) { projFn = f; }   // tests
const core = () => require("./core");
const pdir = (name) => projFn ? projFn(name) : (name ? core().projDir(name) : path.dirname(core().pDir("www")));
const root = (name) => path.join(pdir(name), "www");
const priv = (name) => path.join(pdir(name), "web");
const FOLDERS = ["css", "js", "images", "fonts", "media", "inc", "admin", "data", "uploads"];
const TEXT = /\.(html?|css|js|mjs|json|txt|md|xml|svg|php|htaccess|csv|ini|webmanifest|map|ts|scss|less|yml|yaml|env\.example)$|(^|\/)\.htaccess$/i;
const PIC = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
const MAX_TEXT = 5 * 1024 * 1024;

const page = (title, body, desc) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc || ""}">
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="images/favicon.svg">
</head>
<body>
  <header class="site-head">
    <a class="brand" href="index.html">{{SITE}}</a>
    <nav><a href="index.html">Home</a> <a href="about.html">About</a> <a href="contact.html">Contact</a></nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-foot">© <span data-year></span> {{SITE}}</footer>
  <script src="js/main.js"></script>
</body>
</html>
`;
function starter(site) {
  const S = (t) => t.split("{{SITE}}").join(site);
  return {
    "index.html": S(page(site, `    <section class="hero">\n      <h1>Welcome to ${site}</h1>\n      <p>Say what you do in one line.</p>\n      <a class="btn" href="contact.html">Get in touch</a>\n    </section>\n    <section class="cards">\n      <article><h2>What we do</h2><p>A few words about it.</p></article>\n      <article><h2>Why us</h2><p>A few words about it.</p></article>\n      <article><h2>Where to find us</h2><p>A few words about it.</p></article>\n    </section>`, "The home page of " + site)),
    "about.html": S(page("About - " + site, `    <section><h1>About us</h1><p>Our story.</p></section>`, "About " + site)),
    "contact.html": S(page("Contact - " + site, `    <section><h1>Contact us</h1>\n      <form class="contact" method="post" action="#">\n        <label>Name <input name="name" required></label>\n        <label>Email <input name="email" type="email" required></label>\n        <label>Message <textarea name="message" rows="5" required></textarea></label>\n        <button class="btn" type="submit">Send</button>\n      </form>\n    </section>`, "Contact " + site)),
    "404.html": S(page("Page not found - " + site, `    <section><h1>Page not found</h1><p><a href="index.html">Back to the home page</a></p></section>`, "")),
    "css/style.css": `/* ${site} - the site's look */\n:root { --bg: #ffffff; --ink: #1d1d1f; --accent: #e8590c; --soft: #f4f4f5; --max: 1100px; }\n* { box-sizing: border-box; }\nbody { margin: 0; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }\na { color: var(--accent); }\nimg { max-width: 100%; height: auto; }\n.site-head, .site-foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px max(16px, calc((100% - var(--max)) / 2)); }\n.site-head nav a { margin-left: 16px; text-decoration: none; color: var(--ink); }\n.brand { font-weight: 700; font-size: 1.2rem; text-decoration: none; color: var(--ink); }\nmain section { padding: 40px max(16px, calc((100% - var(--max)) / 2)); }\n.hero { background: var(--soft); text-align: center; padding-top: 80px; padding-bottom: 80px; }\n.hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin: 0 0 12px; }\n.btn { display: inline-block; padding: 10px 22px; border-radius: 6px; background: var(--accent); color: #fff; text-decoration: none; border: 0; font: inherit; cursor: pointer; }\n.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }\n.cards article { background: var(--soft); padding: 20px; border-radius: 8px; }\n.contact { display: grid; gap: 12px; max-width: 520px; }\n.contact input, .contact textarea { width: 100%; padding: 8px; font: inherit; }\n.site-foot { color: #777; font-size: .9rem; border-top: 1px solid #e5e5e5; }\n@media (max-width: 640px) { .site-head { flex-direction: column; } .site-head nav a { margin: 0 8px; } }\n`,
    "js/main.js": `// ${site} - the site's script\ndocument.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });\n`,
    "images/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#e8590c"/><text x="16" y="22" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif">${(site[0] || "W").toUpperCase().replace(/[<&>"]/g, "")}</text></svg>\n`,
    "data/content.json": JSON.stringify({ posts: [], products: [] }, null, 2) + "\n",
    "robots.txt": "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /inc/\n",
    ".htaccess": "# the site's server rules (Apache)\nOptions -Indexes\nErrorDocument 404 /404.html\n<FilesMatch \"\\.(json)$\">\n  Header set Cache-Control \"no-cache\"\n</FilesMatch>\n",
    "inc/README.txt": "Shared PHP parts (header, footer, database settings) go here - robots.txt keeps search engines out.\n",
    "admin/README.txt": "The site's admin area goes here - keep it behind a login.\n",
  };
}
/** make projects/<p>/www with every folder + the starter files (a file already there is never overwritten) -> {made, kept} */
function create(name, site) {
  const r = root(name), made = [], kept = [];
  fs.mkdirSync(r, { recursive: true });
  for (const f of FOLDERS) fs.mkdirSync(path.join(r, f), { recursive: true });
  const nm = String(site || name || path.basename(pdir(name)) || "My website").replace(/[<>&"]/g, "").slice(0, 80);
  for (const [rel, text] of Object.entries(starter(nm))) {
    const f = path.join(r, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f)) { kept.push(rel); continue; }
    fs.writeFileSync(f, text); made.push(rel);
  }
  fs.mkdirSync(priv(name), { recursive: true });
  const crm = path.join(priv(name), "crm.json"); if (!fs.existsSync(crm)) fs.writeFileSync(crm, JSON.stringify(emptyCrm(), null, 2));
  return { root: r, folders: FOLDERS, made, kept };
}
function has(name) { return fs.existsSync(root(name)); }
/** a path inside www/ -> its full path (refused: absolute, "..", NUL, a link that leads out) */
function safe(rel, name) {
  const r = path.resolve(root(name)), s = String(rel == null ? "" : rel).replace(/\\/g, "/").replace(/^\/+/, "");
  if (/\0/.test(s) || s.split("/").some((x) => x === "..")) throw bad("that path leaves the website folder");
  const f = path.resolve(r, s);
  if (f !== r && !f.startsWith(r + path.sep)) throw bad("that path leaves the website folder");
  // a link inside www that leads out: the nearest part of the path that is there, as the disk really has it
  let g = f; while (g !== r && !fs.existsSync(g)) g = path.dirname(g);
  if (fs.existsSync(g)) { const real = fs.realpathSync(g), rr = fs.realpathSync(r); if (real !== rr && !real.startsWith(rr + path.sep)) throw bad("that path leaves the website folder"); }
  return f;
}
const relOf = (f, name) => path.relative(root(name), f).split(path.sep).join("/");
function needRoot(name) { if (!has(name)) throw bad("this project has no website yet - 🌐 Make the www folder", 404); }
/** the files: [{path, dir, size, mtime}] folders first, A-Z */
function tree(name) {
  needRoot(name); const out = [];
  const walk = (d, depth) => {
    if (depth > 12 || out.length > 5000) return;
    const items = fs.readdirSync(d, { withFileTypes: true }).filter((e) => !e.isSymbolicLink()).sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
    for (const e of items) {
      const f = path.join(d, e.name), st = fs.statSync(f);
      out.push({ path: relOf(f, name), dir: e.isDirectory(), size: e.isDirectory() ? 0 : st.size, mtime: st.mtimeMs, text: !e.isDirectory() && TEXT.test(e.name), pic: !e.isDirectory() && PIC.test(e.name) });
      if (e.isDirectory()) walk(f, depth + 1);
    }
  };
  walk(root(name), 0);
  return { files: out, root: "www" };
}
function read(rel, name) {
  needRoot(name); const f = safe(rel, name);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) throw bad("no file " + rel, 404);
  if (!TEXT.test(f)) throw bad("that is not a text file - it opens in the preview", 415);
  const st = fs.statSync(f); if (st.size > MAX_TEXT) throw bad("that file is over 5 MB", 413);
  return { path: relOf(f, name), text: fs.readFileSync(f, "utf8"), mtime: st.mtimeMs };
}
/** save a text file (made with its folders); mtime = the one it was opened at -> a change on disk since is refused (409) */
function write(rel, text, mtime, name) {
  needRoot(name); const f = safe(rel, name);
  if (f === path.resolve(root(name))) throw bad("give the file a name");
  if (!TEXT.test(f)) throw bad("only text files are written here (html, css, js, json, php, svg, txt …)");
  const t = String(text == null ? "" : text); if (Buffer.byteLength(t) > MAX_TEXT) throw bad("that file is over 5 MB", 413);
  if (mtime && fs.existsSync(f) && Math.abs(fs.statSync(f).mtimeMs - mtime) > 2) throw bad("the file changed on disk since you opened it - open it again", 409);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t);
  return { path: relOf(f, name), size: Buffer.byteLength(t), mtime: fs.statSync(f).mtimeMs };
}
function mkdir(rel, name) { needRoot(name); const f = safe(rel, name); if (fs.existsSync(f)) throw bad(rel + " is already there", 409); fs.mkdirSync(f, { recursive: true }); return { path: relOf(f, name) }; }
function rename(from, to, name) {
  needRoot(name); const a = safe(from, name), b = safe(to, name);
  if (a === path.resolve(root(name))) throw bad("the www folder itself is not renamed");
  if (!fs.existsSync(a)) throw bad("no " + from, 404); if (fs.existsSync(b)) throw bad(to + " is already there", 409);
  fs.mkdirSync(path.dirname(b), { recursive: true }); fs.renameSync(a, b); return { path: relOf(b, name) };
}
/** delete = moved to projects/<p>/web/trash/<time> <name> (never destroyed here) */
function remove(rel, name) {
  needRoot(name); const f = safe(rel, name);
  if (f === path.resolve(root(name))) throw bad("the www folder itself is not deleted here");
  if (!fs.existsSync(f)) throw bad("no " + rel, 404);
  const t = path.join(priv(name), "trash"); fs.mkdirSync(t, { recursive: true });
  const to = path.join(t, new Date().toISOString().replace(/[:.]/g, "-") + " " + path.basename(f));
  fs.renameSync(f, to); return { trashed: path.basename(to) };
}
/** a file from this computer (base64) into a folder of the site */
function upload(rel, b64, name) {
  needRoot(name); const f = safe(rel, name);
  if (!/^[\w .()-]+\.[a-z0-9]{1,8}$/i.test(path.basename(f))) throw bad("a file name is letters, digits, - _ . ( )");
  const buf = Buffer.from(String(b64 || ""), "base64"); if (!buf.length) throw bad("the file is empty"); if (buf.length > 60 * 1024 * 1024) throw bad("over 60 MB", 413);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return { path: relOf(f, name), size: buf.length };
}
/** a file to show in the preview (served as-is from www/) */
function file(rel, name) { needRoot(name); let f = safe(rel || "index.html", name); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) throw bad("not found", 404); return f; }

/* ---------------- 🗂 CMS: pages (the .html files' title / description / heading), posts + products (data/content.json) */
const attr = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unattr = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const txt = (s) => unattr(String(s || "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
function pageInfo(html) {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html), d = /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i.exec(html), h = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return { title: t ? txt(t[1]) : "", description: d ? unattr(d[1]) : "", h1: h ? txt(h[1]) : "" };
}
function pages(name) {
  needRoot(name);
  return { pages: tree(name).files.filter((x) => !x.dir && /\.html?$/i.test(x.path) && !/^(admin|inc)\//.test(x.path)).map((x) => Object.assign({ path: x.path }, pageInfo(fs.readFileSync(safe(x.path, name), "utf8")))) };
}
/** change a page's title / description / main heading in its HTML (only those spots) */
function setPage(rel, o, name) {
  const f = safe(rel, name); if (!/\.html?$/i.test(f) || !fs.existsSync(f)) throw bad("no page " + rel, 404);
  let h = fs.readFileSync(f, "utf8"); const a = o || {};
  if (a.title !== undefined) { const v = attr(String(a.title).slice(0, 200)); h = /<title[^>]*>[\s\S]*?<\/title>/i.test(h) ? h.replace(/(<title[^>]*>)[\s\S]*?(<\/title>)/i, (_, x, y) => x + v + y) : h.replace(/<head[^>]*>/i, (m) => m + `\n  <title>${v}</title>`); }
  if (a.description !== undefined) { const v = attr(String(a.description).slice(0, 400)); h = /<meta\s+name=["']description["'][^>]*>/i.test(h) ? h.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${v}">`) : h.replace(/<\/title>/i, `</title>\n  <meta name="description" content="${v}">`); }
  if (a.h1 !== undefined && /<h1[^>]*>[\s\S]*?<\/h1>/i.test(h)) { const v = attr(String(a.h1).slice(0, 300)); h = h.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/i, (_, x, y) => x + v + y); }
  fs.writeFileSync(f, h); return Object.assign({ path: relOf(f, name) }, pageInfo(h));
}
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const S = (v, n) => String(v == null ? "" : v).slice(0, n || 200);
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const N = (v) => { const n = +v; return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const KINDS = {
  posts: (x) => ({ id: S(x.id, 40) || id(), title: S(x.title), slug: slug(x.slug || x.title), date: S(x.date, 10) || new Date().toISOString().slice(0, 10), image: S(x.image, 200), body: S(x.body, 100000), published: x.published !== false }),
  products: (x) => ({ id: S(x.id, 40) || id(), name: S(x.name), slug: slug(x.slug || x.name), category: S(x.category, 80), price: N(x.price), sale: x.sale === "" || x.sale == null ? null : N(x.sale), stock: x.stock === "" || x.stock == null ? null : Math.max(0, Math.round(+x.stock || 0)) /* blank = not counted; 0 = sold out */, image: S(x.image, 200), description: S(x.description, 20000), published: x.published !== false }),
  clients: (x) => ({ id: S(x.id, 40) || id(), name: S(x.name), email: S(x.email, 160), phone: S(x.phone, 40), company: S(x.company, 120), tags: S(x.tags, 200), notes: S(x.notes, 20000), created: S(x.created, 30) || new Date().toISOString() }),
  bookings: (x) => ({ id: S(x.id, 40) || id(), client: S(x.client, 160), service: S(x.service, 120), date: S(x.date, 10), time: S(x.time, 5), length: Math.max(0, Math.round(+x.length || 60)), status: ["pending", "confirmed", "done", "cancelled"].includes(x.status) ? x.status : "pending", notes: S(x.notes, 5000) }),
  orders: (x) => ({ id: S(x.id, 40) || id(), number: S(x.number, 30), client: S(x.client, 160), date: S(x.date, 10) || new Date().toISOString().slice(0, 10), items: S(x.items, 5000), total: N(x.total), status: ["new", "paid", "sent", "done", "cancelled", "refunded"].includes(x.status) ? x.status : "new", notes: S(x.notes, 5000) }),
  messages: (x) => ({ id: S(x.id, 40) || id(), name: S(x.name), email: S(x.email, 160), subject: S(x.subject, 200), message: S(x.message, 20000), date: S(x.date, 30) || new Date().toISOString(), status: ["new", "read", "answered", "spam"].includes(x.status) ? x.status : "new" }),
};
const CMS = ["posts", "products"], CRM = ["clients", "bookings", "orders", "messages"];
const emptyCrm = () => ({ clients: [], bookings: [], orders: [], messages: [] });
const cmsFile = (name) => path.join(root(name), "data", "content.json"), crmFile = (name) => path.join(priv(name), "crm.json");
function readJson(f, empty) { try { return Object.assign(empty(), JSON.parse(fs.readFileSync(f, "utf8"))); } catch { return empty(); } }
/** the records of one kind (posts / products in www/data/content.json, the CRM's in web/crm.json) */
function records(kind, name) {
  needRoot(name); if (!KINDS[kind]) throw bad("no records called " + kind);
  const d = CMS.includes(kind) ? readJson(cmsFile(name), () => ({ posts: [], products: [] })) : readJson(crmFile(name), emptyCrm);
  return { kind, items: (d[kind] || []).map(KINDS[kind]) };
}
/** add / change one record (by id) -> it; one with remove: true is taken out */
function saveRecord(kind, rec, name) {
  needRoot(name); if (!KINDS[kind]) throw bad("no records called " + kind);
  const cms = CMS.includes(kind), f = cms ? cmsFile(name) : crmFile(name);
  const d = cms ? readJson(f, () => ({ posts: [], products: [] })) : readJson(f, emptyCrm);
  const list = (d[kind] || []).map(KINDS[kind]), r = rec || {};
  const i = r.id ? list.findIndex((x) => x.id === r.id) : -1;
  if (r.remove) { if (i < 0) throw bad("no such record", 404); list.splice(i, 1); }
  else { const c = KINDS[kind](Object.assign(i >= 0 ? list[i] : {}, r)); if (i >= 0) list[i] = c; else { if (list.length >= 20000) throw bad("too many records"); list.unshift(c); } }
  d[kind] = list; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2));
  return { kind, items: list, saved: r.remove ? null : list[i >= 0 ? i : 0] };
}
/** 2.858.0: a built website (lib/siteBuild's <site>/build) copied INTO www - the build's files replace the ones of the same name,
 *  everything else in www stays (your own files, the CRM's data). inc/config.php already in www is kept (the CRM's database
 *  link, a password typed on the server); the build's defines it lacks (the admin's setup key …) are added to it. */
function importBuild(buildDir, name) {
  if (!fs.existsSync(buildDir)) throw bad("build the website first", 404);
  if (!has(name)) create(name);
  const r = root(name); let copied = 0, merged = null;
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const from = path.join(d, e.name), sub = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { walk(from, sub); continue; }
      if (!e.isFile()) continue;
      const to = safe(sub, name);
      if (sub === "inc/config.php" && fs.existsSync(to)) {
        let mine = fs.readFileSync(to, "utf8"); const add = [];
        for (const m of fs.readFileSync(from, "utf8").matchAll(/^define\('([A-Z_]+)',[^\n]*;\s*$/gm)) if (!new RegExp("define\\('" + m[1] + "'").test(mine)) add.push(m[0].trim());
        if (add.length) { mine = mine.replace(/\?>\s*$/, "").replace(/\s*$/, "\n") + "// added by 🌐 Build Website\n" + add.join("\n") + "\n"; fs.writeFileSync(to, mine); }
        merged = add.length; continue;
      }
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); copied++;
    }
  };
  walk(buildDir, "");
  return { copied, configMerged: merged, root: "www" };
}
module.exports = { importBuild, FOLDERS, setProjectDir, root, create, has, safe, tree, read, write, mkdir, rename, remove, upload, file, pageInfo, pages, setPage, KINDS, CMS, CRM, records, saveRecord };
