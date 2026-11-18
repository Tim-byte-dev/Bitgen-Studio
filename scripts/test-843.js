#!/usr/bin/env node
/* bitGen Studio — 2.843.0 units: 🌐 a website from the image editor's pages (static or PHP + MySQL; the AI makes it responsive).
 *   lib/siteBuild save / build (a stand-in LLM; its page checked - words kept, no scripts, only the site's pictures; bitGen's own
 *   layout when it fails) / zip / previewFile; pcsite alphaBox / plainColour / figHtml; the wiring. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const B = require(path.join(ROOT, "lib/siteBuild.js")), P = require(path.join(ROOT, "ext/imageeditdock/pcsite.js"));
const { JSDOM } = require("jsdom");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t843-")); B.setDir(tmp);
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const pages = [{ title: "Home", w: 1200, h: 900, bg: "#fdf6e3", els: [
      { kind: "text", text: "Tiger Bakery", size: 56, color: "#8a3b12", bold: true, align: "center", box: { x: 100, y: 40, w: 1000, h: 70 } },
      { kind: "image", src: "p0-l3.jpg", alt: "bread", box: { x: 60, y: 160, w: 520, h: 360 } },
      { kind: "text", text: "Fresh bread every morning.", size: 20, color: "#333", box: { x: 640, y: 180, w: 480, h: 60 } },
      { kind: "image", src: "../../etc/passwd", box: { x: 0, y: 0, w: 1, h: 1 } }, { kind: "weird" }] },
    { title: "About us", els: [{ kind: "rich", html: "<h2>Our story</h2><p>Since 1990.</p>", box: { x: 0, y: 0, w: 1200, h: 300 } }] }];
  const meta = B.save({ name: "Tiger Bakery", title: "Tiger Bakery", stack: "static", lang: "en", pages, assets: [{ name: "p0-l3.jpg", b64: PNG }, { name: "../evil.php", b64: PNG }] });
  check("save: site.json (the first page = index, slugs from titles), the elements cleaned (a path out of the site and an unknown kind dropped), only the site's pictures kept",
    meta.pages.map((p) => p.slug).join() === "index,about-us" && fs.existsSync(path.join(tmp, "Tiger Bakery", "assets", "p0-l3.jpg")) && !fs.existsSync(path.join(tmp, "evil.php")) && JSON.parse(fs.readFileSync(path.join(tmp, "Tiger Bakery", "src", "index.json"), "utf8")).els.length === 3, meta);
  const rows = B.rowsOf(JSON.parse(fs.readFileSync(path.join(tmp, "Tiger Bakery", "src", "index.json"), "utf8")).els);
  check("rowsOf: the title alone, then the picture and its words side by side", rows.length === 2 && rows[1].els.map((e) => e.kind).join() === "image,text", rows.map((r) => r.els.length));
  const dirty = B.cleanHtml('<h1 onclick="x()">Hi</h1><script>alert(1)</script><img src="assets/p0-l3.jpg" onerror="y()"><img src="http://evil/x.png"><a href="javascript:alert(1)">a</a><iframe src="x"></iframe>', new Set(["p0-l3.jpg"]));
  check("cleanHtml: no scripts / iframes / on* handlers / javascript: links; only the site's own pictures", dirty === '<h1>Hi</h1><img src="assets/p0-l3.jpg"><a href="#">a</a>', dirty);
  check("cleanCss: no @import, no outside url()s", B.cleanCss("@import url(x.css); .a{background:url(http://evil/x.png)} .b{background:url(assets/p.png)}") === " .a{background:none} .b{background:url(assets/p.png)}");
  // the AI writes page 1 well, leaves words out on page 2 -> bitGen's own layout there
  let calls = [];
  B.setComplete(async (o) => { calls.push(o.messages[1].content); return /About us/.test(o.messages[1].content)
    ? { ok: true, text: JSON.stringify({ html: "<h2>Something else</h2>", css: "" }) }
    : { ok: true, text: "```json\n" + JSON.stringify({ html: '<section class="hero"><h1>Tiger Bakery</h1></section><section class="two"><img src="assets/p0-l3.jpg" alt="bread"><p>Fresh bread every morning.</p></section><script>x</script>', css: ".p-index .two{display:grid;grid-template-columns:1fr 1fr}@media(max-width:760px){.p-index .two{grid-template-columns:1fr}}" }) + "\n```" }; });
  const r1 = await B.build("Tiger Bakery");
  const out = path.join(tmp, "Tiger Bakery", "build"), idx = fs.readFileSync(path.join(out, "index.html"), "utf8"), about = fs.readFileSync(path.join(out, "about-us.html"), "utf8"), css = fs.readFileSync(path.join(out, "css", "site.css"), "utf8");
  check("build (static): the AI's page used when it keeps every word (its script taken out), bitGen's own layout where it did not; a nav, the page colour, responsive CSS, the pictures copied",
    r1.pages[0].by === "ai" && r1.pages[1].by === "bitgen" && /left words out/.test(r1.pages[1].why) && /<h1>Tiger Bakery<\/h1>/.test(idx) && !/<script/.test(idx) && /<nav class="site-nav">.*href="about-us\.html"/.test(idx) && /--page-bg:#fdf6e3/.test(idx)
    && /<h2>Our story<\/h2>/.test(about) && /grid-template-columns:1fr 1fr/.test(css) && /@media \(max-width:760px\)/.test(css) && fs.existsSync(path.join(out, "assets", "p0-l3.jpg")) && /The page "Home" \(slug index\), the design 1200 px wide/.test(calls[0]), r1);
  check("…the preview (static) is there too; previewFile never leaves it", fs.existsSync(path.join(tmp, "Tiger Bakery", "preview", "index.html")) && (() => { try { B.previewFile("Tiger Bakery", "../site.json"); return false; } catch (e) { return e.status === 404; } })());
  // PHP + MySQL, no LLM
  B.save({ name: "Tiger Bakery", title: "Tiger Bakery", stack: "php", pages, assets: [] });
  const r2 = await B.build("Tiger Bakery", { ai: false });
  const php = (f) => fs.readFileSync(path.join(out, f), "utf8");
  check("build (PHP + MySQL): each page .php with the shared header / footer, the nav to .php pages, contact.php saving to MySQL (PDO, prepared), schema.sql, config from the host, inc/ closed to the web, README",
    r2.stack === "php" && r2.pages.every((p) => p.by === "bitgen") && /\$page_title = "Home"; \$page_bg = "#fdf6e3"; include __DIR__ \. '\/inc\/header\.php';/.test(php("index.php")) && /href="about-us\.php"/.test(php("inc/header.php"))
    && /prepare\('INSERT INTO messages \(name, email, message, ip\) VALUES \(\?, \?, \?, \?\)'\)/.test(php("contact.php")) && /CREATE TABLE IF NOT EXISTS messages/.test(php("schema.sql")) && /getenv\('DB_PASS'\)/.test(php("inc/config.php")) && /Require all denied/.test(php("inc/.htaccess")) && /schema\.sql/.test(php("README.txt")) && !fs.existsSync(path.join(out, "index.html")), r2);
  const z = await B.zip("Tiger Bakery"), JSZip = require("jszip"), zz = await JSZip.loadAsync(z);
  check("zip: the built site", ["index.php", "about-us.php", "contact.php", "inc/db.php", "css/site.css", "schema.sql"].every((n) => zz.file(n)));
  B.setComplete(null);
  // the page side
  const W = 8, H = 6, d = new Uint8ClampedArray(W * H * 4); for (let y = 2; y < 4; y++) for (let x = 4; x < 8; x++) d[(y * W + x) * 4 + 3] = 255;
  const solid = new Uint8ClampedArray(W * H * 4).map((v, i) => (i % 4 === 3 ? 255 : i % 4 === 0 ? 200 : 10));
  check("alphaBox / plainColour", JSON.stringify(P.alphaBox(d, W, H)) === JSON.stringify({ x: 4, y: 2, w: 4, h: 2 }) && P.plainColour(solid, W, H) === "#c80a0a" && P.plainColour(d, W, H) === null);
  const fh = P.figHtml('<p>Text</p><p data-fig="f1" style="padding-top:200px"><i>Figure 1: red</i></p><p data-fig="f2" style="padding-top:9px"><br></p>', { f1: "p0-f9.png" }, doc);
  check("figHtml: a WP figure's place -> <figure><img><figcaption>; a place with no picture dropped", fh === '<p>Text</p><figure><img src="assets/p0-f9.png" alt="Figure 1: red"><figcaption>Figure 1: red</figcaption></figure>', fh);
  const RI = read("routes/index.js"), SV = read("misc/server.js"), EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), PS = read("ext/imageeditdock/pcsite.js");
  check("the wiring: /api/sites + /sites-preview from routes/index.js (not server.js); pcsite after pcdoctpl, installed after it; File ▸ 🌐 Build Website…",
    /require\("\.\/sites"\)\.mount\(app\)/.test(RI) && !/api\/sites/.test(SV) && EX.scripts.indexOf("pcsite.js") === EX.scripts.indexOf("pcdoctpl.js") + 1 && IE.indexOf("PCSite.install(E)") > IE.indexOf("PCDocTpl.install(E)") && /addCmd\("file\.website", "🌐 Build Website…"/.test(PS));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
