#!/usr/bin/env node
/* bitGen Studio — 2.856.0 units: 🌐 THE WEB EDITOR - lib/webProject.js (☑ Website = projects/<p>/www with its folders + starter
 * pages, never overwriting; paths kept inside www; the tree; read / write (a change on disk refused) / mkdir / rename / delete
 * to web/trash / upload; 🗂 CMS pages (title / description / heading in the HTML), posts + products in www/data/content.json,
 * the CRM's clients / bookings / orders / messages in web/crm.json - private), routes/webEditor.js + the New project ☑,
 * ext/webdock (the 4 tabs, the files panel; withBase / putBody / rows). The browser: test-ui856-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const err = (fn) => { try { fn(); return ""; } catch (e) { return (e.status || "") + " " + e.message; } };
const W = require(path.join(ROOT, "lib/webProject.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t856-")), P = path.join(tmp, "Rosie"); fs.mkdirSync(P);
W.setProjectDir(() => P);
check("no www yet: has() false, the tree says to make it (404)", !W.has() && /no website yet/.test(err(() => W.tree())));
const c = W.create(undefined, "Rosie's Bakery");
const www = path.join(P, "www");
check("☑ Website: projects/<p>/www with css js images fonts media inc admin data uploads + the starter pages / css / js / content.json / robots / .htaccess",
  W.FOLDERS.every((f) => fs.statSync(path.join(www, f)).isDirectory()) && ["index.html", "about.html", "contact.html", "404.html", "css/style.css", "js/main.js", "data/content.json", "robots.txt", ".htaccess", "images/favicon.svg"].every((f) => fs.existsSync(path.join(www, f)))
  && /Welcome to Rosie's Bakery/.test(fs.readFileSync(path.join(www, "index.html"), "utf8")) && fs.existsSync(path.join(P, "web", "crm.json")) && !fs.existsSync(path.join(www, "crm.json")), c);
fs.writeFileSync(path.join(www, "index.html"), "MINE");
const c2 = W.create(undefined, "x");
check("made again: a file already there is kept (never overwritten)", fs.readFileSync(path.join(www, "index.html"), "utf8") === "MINE" && c2.kept.includes("index.html") && !c2.made.length, c2);
fs.writeFileSync(path.join(www, "index.html"), fs.readFileSync(path.join(www, "about.html"), "utf8").replace("About us", "Home"));
const bads = ["../secret.txt", "css/../../x", "/etc/passwd", "a\0b"].map((p) => err(() => W.safe(p)));
check("paths stay inside www: .., absolute (taken as inside), NUL refused", /leaves/.test(bads[0]) && /leaves/.test(bads[1]) && W.safe("/etc/passwd") === path.join(www, "etc/passwd") && /leaves/.test(bads[3]), bads);
try { fs.symlinkSync(os.tmpdir(), path.join(www, "out")); } catch (e) { /* no links here */ }
check("a link leading out of www is refused (and left out of the tree)", !fs.existsSync(path.join(www, "out")) || (/leaves/.test(err(() => W.safe("out/x"))) && !W.tree().files.some((f) => f.path === "out")));
const t = W.tree().files;
check("the tree: folders first, paths with /, text / picture flags", t[0].dir && t.find((f) => f.path === "css/style.css").text && t.find((f) => f.path === "images/favicon.svg").pic && t.find((f) => f.path === "js").dir, t.slice(0, 4));
const r = W.read("css/style.css"), w = W.write("css/style.css", r.text + "\n/* more */", r.mtime);
check("read + write a text file (its mtime back)", /--accent/.test(r.text) && /more/.test(W.read("css/style.css").text) && w.mtime > 0);
check("a change on disk since it was opened = 409; a picture is not opened as text (415); no name / not text refused", /^409/.test(err(() => W.write("css/style.css", "x", r.mtime - 1000))) && (W.upload("images/x.png", "UE5H"), /^415/.test(err(() => W.read("images/x.png")))) && /give the file a name/.test(err(() => W.write("", "x"))) && /only text/.test(err(() => W.write("a.exe", "x"))));
W.write("services/index.html", "<h1>S</h1>");
check("a new file in a new folder is made with its folder", fs.existsSync(path.join(www, "services/index.html")));
W.mkdir("blog"); W.rename("services", "blog/services");
check("mkdir + rename / move (a name already there = 409)", fs.existsSync(path.join(www, "blog/services/index.html")) && /^409/.test(err(() => W.rename("about.html", "contact.html"))) && /^409/.test(err(() => W.mkdir("blog"))));
const d = W.remove("blog");
check("delete = moved to the project's web/trash (not destroyed, not in www); the www folder itself refused", !fs.existsSync(path.join(www, "blog")) && fs.readdirSync(path.join(P, "web", "trash")).some((x) => x.endsWith(" blog")) && /not deleted/.test(err(() => W.remove(""))), d);
const u = W.upload("images/logo.png", Buffer.from("PNGDATA").toString("base64"));
check("upload: a file from this computer into a folder; bad names refused", u.size === 7 && fs.readFileSync(path.join(www, "images/logo.png"), "utf8") === "PNGDATA" && /file name/.test(err(() => W.upload("images/a;b.png", "QQ=="))));
check("the preview's file: a folder = its index.html, missing = 404", W.file("") === path.join(www, "index.html") && /^404/.test(err(() => W.file("nope.html"))));
// CMS pages
const pg = W.pages().pages;
check("🗂 pages: each .html (not admin / inc) with its title, description, main heading", pg.length === 4 && pg.find((x) => x.path === "about.html").title === "About - Rosie's Bakery" && pg.find((x) => x.path === "about.html").h1 === "About us" && /About Rosie/.test(pg.find((x) => x.path === "about.html").description), pg);
const sp = W.setPage("about.html", { title: "About <Rosie> & co", description: 'Fresh "daily"', h1: "Our story" });
const ah = fs.readFileSync(path.join(www, "about.html"), "utf8");
check("a page's title / description / heading changed in the HTML only (escaped), the rest as written", sp.title === "About <Rosie> & co" && /<title>About &lt;Rosie&gt; &amp; co<\/title>/.test(ah) && /content="Fresh &quot;daily&quot;"/.test(ah) && /<h1>Our story<\/h1>/.test(ah) && /css\/style\.css/.test(ah), ah.slice(0, 400));
// records
const p1 = W.saveRecord("products", { name: "Sourdough Loaf", price: "8.5", stock: "12", category: "Bread" }).saved;
W.saveRecord("posts", { title: "We are open!", body: "Come in." });
const cj = JSON.parse(fs.readFileSync(path.join(www, "data/content.json"), "utf8"));
check("🛍 products + 📰 posts in www/data/content.json (the site reads it): cleaned (numbers, slugs, ids)", cj.products[0].price === 8.5 && cj.products[0].stock === 12 && cj.products[0].slug === "sourdough-loaf" && p1.id && cj.posts[0].slug === "we-are-open" && cj.posts[0].published === true, cj);
const cl = W.saveRecord("clients", { name: "Ann Lee", email: "ann@example.com" }).saved;
W.saveRecord("bookings", { client: "Ann Lee", date: "2026-12-01", time: "10:00", status: "confirmed" });
W.saveRecord("bookings", { client: "Bob", status: "weird" });
W.saveRecord("clients", { id: cl.id, phone: "0400 000 000" });
const crm = JSON.parse(fs.readFileSync(path.join(P, "web", "crm.json"), "utf8"));
check("👤 clients / 📅 bookings in web/crm.json (private - NOT in www); an edit by id keeps the rest; an unknown status = the first", crm.clients.length === 1 && crm.clients[0].email === "ann@example.com" && crm.clients[0].phone === "0400 000 000" && crm.bookings.length === 2 && crm.bookings.find((b) => b.client === "Bob").status === "pending" && !fs.readFileSync(path.join(www, "data/content.json"), "utf8").includes("Ann"), crm);
W.saveRecord("clients", { id: cl.id, remove: true });
check("remove one; an unknown kind refused", W.records("clients").items.length === 0 && /no records called/.test(err(() => W.records("nope"))) && /^404/.test(err(() => W.saveRecord("clients", { id: "x", remove: true }))));
fs.rmSync(tmp, { recursive: true, force: true });
/* ---- the page side (pure) */
global.window = undefined;
const H = (() => { const g = {}; new Function("window", src("ext/webdock/webdock.js"))(g); return g.H3Web; })();
check("the page's pure parts load without a page (no document = nothing wired)", H === undefined || typeof H === "object");
const sandbox = { document: { readyState: "complete", getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} } };
new Function("window", src("ext/webdock/webdock.js").replace(/^\(function \(root\)/m, "(function (root)"))(sandbox);
const X = sandbox.H3Web;
check("withBase: a <base> to the page's folder in /web-preview/ (after <head>) - the file's text untouched", X.withBase("<html><head><title>t</title></head><body>x</body></html>", "blog/a b.html") === '<html><head><base href="/web-preview/blog/">' + "<title>t</title></head><body>x</body></html>" && X.withBase("<p>", "index.html").startsWith('<base href="/web-preview/">'));
check("putBody: only the body's inside replaced (doctype, head, body attributes kept)", X.putBody('<!DOCTYPE html><html><head><title>t</title></head><body class="home">\n<p>old</p>\n</body></html>', "<p>new</p>") === '<!DOCTYPE html><html><head><title>t</title></head><body class="home"><p>new</p></body></html>');
const rw = X.rows([{ path: "css", dir: true }, { path: "css/a.css" }, { path: "images", dir: true }, { path: "images/x/y.png" }, { path: "index.html" }], new Set(["css"]));
check("the tree's rows: a folder's files only while it is open, with their depth", rw.map((r) => r.path + ":" + r.depth).join() === "css:0,css/a.css:1,images:0,index.html:0", rw);
check("every CRM kind has fields + columns; search over every value", Object.keys(X.FIELDS).join() === "pages,posts,products,clients,bookings,orders,messages" && Object.keys(X.COLS).every((k) => X.COLS[k].every((c) => X.FIELDS[k].some((f) => f[0] === c))) && X.match({ a: "Ann Lee" }, "lee") && !X.match({ a: "Ann" }, "bob"));
/* ---- the wiring */
const DH = src("ext/webdock/dock.html"), EX = JSON.parse(src("ext/webdock/ext.json")), IX = src("static/index.html"), RI = src("routes/index.js");
check("the docker: 4 tabs (🗂 CRM, ✎ WYSIWYG, </> Code, 👁 Preview), the collapsible files panel on the right, its own ext (webdock)", EX.id === "webdock" && /data-tab="crm"[\s\S]*data-tab="wys"[\s\S]*data-tab="code"[\s\S]*data-tab="prev"/.test(DH) && /id="wbMain"[\s\S]*id="wbFiles"/.test(DH) && /#wbFiles\.shut/.test(DH) && /id="wbWys"[^>]*sandbox="allow-same-origin"/.test(DH));
check("the top bar's 🌐 Web editor (app strip); routes/webEditor.js mounted (not server.js)", /\["tX_webdock", "🌐", "Web editor"\]/.test(src("static/appstrip.js")) && /require\("\.\/webEditor"\)\.mount\(app\)/.test(RI) && !/webEditor|webProject/.test(src("misc/server.js")));
check("Project ▸ ✚ New: ☑ Website sent, the server makes www for the new project", /id="npWeb"/.test(IX) && /website: \$\("npWeb"\)\.checked/.test(IX) && /if \(b\.website\) out\.www = require\("\.\.\/lib\/webProject"\)\.create\(out\.name\)/.test(RI));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
