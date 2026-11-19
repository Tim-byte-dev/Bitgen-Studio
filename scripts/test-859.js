#!/usr/bin/env node
/* bitGen Studio — 2.859.0 units: 🧩 THE WEB SKILLS (web/skills/<id>/, lib/webSkills.js): 11 skills (galleries: pictures, video,
 * audio, 3D; theme, layout, AJAX, catalogue with categories, product page, cart + checkout, member login), each with its files,
 * markup and sheet; install = the files into www (bitGen's bg-* library files refreshed, your pages kept), the 3D viewer gets the
 * app's three.js + its licence; ✨ = routed by words, the LLM's HTML cleaned (no scripts / handlers / javascript:), installed;
 * the page side's addToPage (links + scripts once, the snippet at the cursor / before </main>, paths for a page in a folder). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const W = require(path.join(ROOT, "lib/webProject.js")), K = require(path.join(ROOT, "lib/webSkills.js"));
  const L = K.list().skills, ids = L.map((s) => s.id);
  check("the 2.859.0 skills: the galleries (pictures, video, audio, 3D), theme, layout, AJAX, catalogue, product page, cart + checkout, login (2.861.0 added three)", ["gallery-pictures", "gallery-video", "gallery-audio", "gallery-3d", "theme", "layout", "ajax", "categories", "product-page", "cart-checkout", "login"].every((x) => ids.includes(x)) && L.length >= 11, ids);
  const every = L.every((s) => s.name && s.icon && s.group && s.description && s.files.length && fs.existsSync(path.join(K.ROOT, s.id, "snippet.html")) && fs.existsSync(path.join(K.ROOT, s.id, "SKILL.md")) && s.files.every((f) => f.startsWith("js/vendor/") || fs.existsSync(path.join(K.ROOT, s.id, "files", f))) && s.head.concat(s.scripts).every((f) => s.files.includes(f)));
  check("each: name, icon, group, description, its files there, its markup + sheet; every <link> / <script> it needs is one of its files", every);
  check("the PHP ones say they need PHP (checkout, login); the shop's prices are worked out on the server", L.find((s) => s.id === "cart-checkout").needs === "php" && L.find((s) => s.id === "login").needs === "php" && /prices come from data\/content\.json\s*\n?\/\/ HERE/.test(src("web/skills/cart-checkout/files/checkout.php")) && /password_hash/.test(src("web/skills/login/files/inc/bg-auth.php")) && /hash_equals/.test(src("web/skills/login/files/inc/bg-auth.php")));
  check("our own code (no third-party files) - except the 3D viewer's three.js, copied from the app with its MIT licence", !fs.readdirSync(K.ROOT).some((d) => fs.existsSync(path.join(K.ROOT, d, "files", "js", "vendor"))) && JSON.parse(src("web/skills/gallery-3d/skill.json")).app_files["js/vendor/LICENSE-three.txt"] === "static/vendor/LICENSE-three.txt");
  const seen = {}, differ = [];
  for (const s of L) for (const f of s.files) { const fp = path.join(K.ROOT, s.id, "files", f); if (!fs.existsSync(fp)) continue; const t = fs.readFileSync(fp, "utf8"); if (seen[f] != null && seen[f] !== t) differ.push(f); seen[f] = t; }
  check("a library file shared by several skills (bg-shop.js, bg-gallery.*, inc/bg-db.php) is the same in each - whichever is added last", !differ.length && seen["js/bg-shop.js"] && seen["inc/bg-db.php"], differ);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t859-")), P = path.join(tmp, "Shop"); fs.mkdirSync(P); W.setProjectDir(() => P); W.create(undefined, "Shop");
  const www = path.join(P, "www");
  fs.writeFileSync(path.join(www, "shop.html"), "MY SHOP PAGE"); fs.mkdirSync(path.join(www, "js"), { recursive: true }); fs.writeFileSync(path.join(www, "js", "bg-shop.js"), "OLD");
  const r = K.install("categories");
  check("＋ install: the files into www - bitGen's bg-* library refreshed, your own shop.html kept; the head / scripts / markup back", r.copied.includes("js/bg-shop.js") && r.copied.includes("css/bg-shop.css") && r.kept.includes("shop.html") && fs.readFileSync(path.join(www, "shop.html"), "utf8") === "MY SHOP PAGE" && /data-bg-catalog/.test(fs.readFileSync(path.join(www, "js", "bg-shop.js"), "utf8")) && r.head[0] === "css/bg-shop.css" && /data-bg-catalog/.test(r.snippet), r);
  const r3 = K.install("gallery-3d");
  check("🧊 the 3D gallery: the app's three.js + its licence copied into js/vendor, loaded before bg-model.js", fs.statSync(path.join(www, "js/vendor/three-m3d.min.js")).size > 500000 && fs.existsSync(path.join(www, "js/vendor/LICENSE-three.txt")) && r3.scripts.join() === "js/vendor/three-m3d.min.js,js/bg-model.js", r3.scripts);
  check("✨ routing by words: gallery / video / songs / 3D / shop / cart / login; nothing = layout", K.route("a photo gallery").includes("gallery-pictures") && K.route("our videos").includes("gallery-video") && K.route("a playlist of our songs").includes("gallery-audio") && K.route("3d models of our chairs").includes("gallery-3d") && K.route("the shop's categories").includes("categories") && K.route("cart and checkout").includes("cart-checkout") && K.route("member login").includes("login") && K.route("hello")[0] === "layout");
  let asked = null;
  K.setComplete(async (o) => { asked = o; return { ok: true, text: '```html\n<section class="bg-section"><div class="bg-gallery" onclick="steal()"><a href="javascript:alert(1)">x</a></div><script>bad()</script><iframe src="//evil"></iframe></section>\n```' }; });
  const a = await K.ai({ ask: "a gallery of our cakes" });
  check("✨ the LLM is given the rules + theme + layout + the routed skills' sheets; its HTML cleaned (no script / iframe / on* / javascript:); the skills installed", /ONE section of a web page/.test(asked.messages[0].content) && /# Picture gallery/.test(asked.messages[0].content) && /# Layout/.test(asked.messages[0].content)
    && !/script|iframe|onclick|javascript:/i.test(a.html) && /class="bg-gallery"/.test(a.html) && a.skills.map((s) => s.skill).join() === "theme,layout,gallery-pictures" && fs.existsSync(path.join(www, "js/bg-gallery.js")), a);
  fs.rmSync(tmp, { recursive: true, force: true });
  // the page side
  const sb = { document: { readyState: "complete", getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} } };
  new Function("window", src("ext/webdock/webdock.js"))(sb);
  const add = sb.H3Web.addToPage, sk = { head: ["css/bg-gallery.css"], scripts: ["js/bg-gallery.js"], snippet: '<div class="bg-gallery"><a href="images/a.jpg"><img src="images/a.jpg"></a></div>\n' };
  const page = "<html><head><title>t</title></head><body><main><h1>x</h1></main></body></html>";
  const t1 = add(page, "index.html", sk), t2 = add(t1, "index.html", sk);
  check("addToPage: the <link> before </head>, the markup before </main>, the <script> before </body>; added again = no second link / script", /<link rel="stylesheet" href="css\/bg-gallery\.css">\n<\/head>/.test(t1) && /<\/div>\n\n?<\/main>/.test(t1) && /<script src="js\/bg-gallery\.js"><\/script>\n<\/body>/.test(t1) && (t2.match(/bg-gallery\.css/g) || []).length === 1 && (t2.match(/bg-gallery\.js/g) || []).length === 1 && (t2.match(/class="bg-gallery"/g) || []).length === 2, t1);
  const t3 = add(page, "blog/post.html", sk), t4 = add(page, "index.html", sk, page.indexOf("<h1>"));
  check("a page in a folder gets ../ on every path; at the cursor = there", /href="\.\.\/css\/bg-gallery\.css"/.test(t3) && /src="\.\.\/js\/bg-gallery\.js"/.test(t3) && /href="\.\.\/images\/a\.jpg"/.test(t3) && t4.indexOf('class="bg-gallery"') < t4.indexOf("<h1>"), t3);
  const DH = src("ext/webdock/dock.html"), RW = src("routes/webEditor.js");
  check("the wiring: 🧩 Skills in the Web editor (＋ Add to the page, ✨ ticks + Write the section), /api/web/skills, /add, /ai", /id="wbSk"/.test(DH) && /id="wbSkAsk"/.test(DH) && /app\.get\("\/api\/web\/skills"/.test(RW) && /app\.post\("\/api\/web\/skills\/add"/.test(RW) && /app\.post\("\/api\/web\/skills\/ai"/.test(RW));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
