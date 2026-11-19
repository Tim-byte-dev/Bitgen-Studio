#!/usr/bin/env node
/* bitGen Studio — 2.852.0 units: 🌐 BUILD ME A WEBSITE - lib/siteAi.js (what the ask wants, the plan cleaned: pages, Book /
 * Contact pages, products, booking services; the products as SQL for the admin database), ext/imageeditdock/pcwebai.js (each
 * page's layout, the stack, the ticks from the words, the product picture files, the prompt docker's ask), lib/siteBuild.js
 * (the products put in with admin-schema.sql; a Contact page gets the contact form + its handler under its own words), the
 * wiring. The browser: test-ui852-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const A = require(path.join(ROOT, "lib/siteAi.js")), B0 = require(path.join(ROOT, "lib/siteBuild.js"));
  const w1 = A.wants("Build me a website for my bakery - people can order cakes online and book a cake tasting"), w2 = A.wants("a website for my plumbing business");
  check("what the ask wants: a shop (order online), a booking (book), a contact form unless 'no contact'", w1.shop && w1.booking && w1.contact && !w2.shop && !w2.booking && w2.contact && !A.wants("site, no contact").contact, { w1, w2 });
  const raw = { title: "Rosie's Bakery", tagline: "Baked at dawn", palette: { bg: "#fff8f0", accent: "#8b4513", ink: "#2b1d12" }, contact: { phone: "0412 345 678", email: "", address: "1 Main St", hours: "7am-3pm Tue-Sun" },
    pages: [{ title: "About", kind: "about", heading: "Welcome", intro: "Sourdough every day.", cta: "Order now", picture: "a rustic bakery counter", sections: [{ heading: "Bread", text: "Slow sourdough.", picture: "loaves" }, { heading: "Cakes", text: "For birthdays." }, { heading: "Coffee", text: "Good coffee." }, { heading: "Too many", text: "x" }] },
      { title: "Menu", kind: "menu", heading: "Our menu", sections: [{ heading: "Pastries", text: "Croissants." }] }, { title: "Menu", kind: "nonsense", heading: "Again" }],
    products: [{ name: "Sourdough loaf", category: "Bread", price: "$8.50", description: "Our classic. Long ferment.", picture: "a sourdough loaf" }, { name: "", price: 3 }, { name: "Croissant", category: "Pastry", price: 4, description: "Buttery." }],
    booking: { name: "Cake tastings", minutes: "45", services: [{ name: "Wedding cake tasting", minutes: 60, price: "$30" }] } };
  const p = A.clean(raw, w1);
  check("the plan: the first page is Home; up to 3 sections; menu names unique; a Book page put in (booking) before the Contact page put in at the end (contact)",
    p.pages[0].kind === "home" && p.pages[0].sections.length === 3 && p.pages.map((x) => x.title).join() === "About,Menu,Menu 2,Book,Contact" && p.pages[3].kind === "booking" && p.pages[4].kind === "contact", p.pages.map((x) => [x.title, x.kind]));
  check("products: named ones only, prices as numbers ($8.50 -> 8.5); the booking: its name, minutes, services", p.products.length === 2 && p.products[0].price === 8.5 && p.products[1].price === 4 && p.booking.name === "Cake tastings" && p.booking.minutes === 45 && p.booking.services[0].mins === 60 && p.features.shop && p.features.booking, { pr: p.products, b: p.booking });
  const p2 = A.clean(raw, { shop: false, booking: false, contact: false });
  check("nothing asked: no products, no booking, no Book / Contact page put in; the palette readable", !p2.products.length && !p2.booking && !p2.pages.some((x) => x.kind === "booking" || x.kind === "contact") && /^#[0-9a-f]{6}$/.test(p2.palette.accentInk), p2.pages.map((x) => x.kind));
  check("the LLM is told: the ask's language, never invent phone / email / address, the products + the booking page when wanted", /NEVER invent phone numbers/.test(A.SYSTEM(w1)) && /"products"/.test(A.SYSTEM(w1)) && /kind booking/.test(A.SYSTEM(w1)) && !/"products"/.test(A.SYSTEM(w2)));
  const sql = A.seedSql({ products: [{ name: "Rosie's Loaf", category: "Bread", price: 8.5, description: "Our classic. Long ferment.", image: "prod-rosie-s-loaf.png" }, { name: "Rosie's Loaf", price: 9, image: "../x.png" }] });
  check("the products as SQL for the admin database: INSERT IGNORE (run again = nothing doubled), quotes escaped, the category linked by slug, a second same name gets its own slug, an unsafe picture name dropped",
    /INSERT IGNORE INTO categories \(name, slug, sort\) VALUES \('Bread', 'bread', 1\);/.test(sql) && /'Rosie''s Loaf', 'rosie-s-loaf', 'Our classic\.'/.test(sql) && /8\.50, 0, 0, 'prod-rosie-s-loaf\.png', 1\);/.test(sql) && /'rosie-s-loaf-2'/.test(sql) && /9\.00, 0, 0, '', 1\)/.test(sql)
    && /INSERT IGNORE INTO product_categories[^;]*p\.slug = 'rosie-s-loaf' AND c\.slug = 'bread'/.test(sql) && !/DROP|DELETE/i.test(sql) && A.seedSql(null) === "" && A.cleanSeed({ products: [] }) === null, sql);
  let asked = null;
  A.setComplete(async (o) => { asked = o; return { ok: true, text: "```json\n" + JSON.stringify(raw) + "\n```" }; });
  const r = await A.plan({ ask: "A website for Rosie's Bakery", shop: true, booking: false });
  A.setComplete(async () => ({ ok: true, text: "no idea" })); let err = ""; try { await A.plan({ ask: "x" }); } catch (e) { err = e.message; }
  check("plan(): the ticks win over the words (shop on, booking off), the JSON read, a non-answer said", r.plan.features.shop && !r.plan.features.booking && r.plan.products.length === 2 && /"products"/.test(asked.messages[0].content) && /not a website plan/.test(err), { f: r.plan.features, err });
  /* ---- the layout */
  const W = require(path.join(ROOT, "ext/imageeditdock/pcwebai.js"));
  const L0 = W.pageLayout(p, p.pages[0], 0, 1440), Lb = W.pageLayout(p, p.pages[3], 3, 1440), Lc = W.pageLayout(p, p.pages[4], 4, 1440);
  const pics = L0.els.filter((e) => e.t === "picture"), texts = L0.els.filter((e) => e.t === "text").map((e) => e.str);
  check("a page: the background first as tall as the page, the hero (heading, intro, → call to action, its photo box), the sections' photos + words, the footer; everything inside the page",
    L0.els[0].t === "rect" && L0.els[0].h === L0.h && texts.includes("Welcome") && texts.includes("→ Order now") && pics.length === 2 && pics[0].prompt === "a rustic bakery counter" && pics[1].prompt === "loaves"
    && texts.some((t) => /Rosie's Bakery  ·  0412 345 678/.test(t)) && L0.els.every((e) => e.x >= 0 && e.x + e.w <= 1440 && e.y >= 0 && e.y + e.h <= L0.h), { h: L0.h, texts });
  check("the Book page: a place for the 📅 booking calendar; the Contact page: the details (☎ ⌂ 🕘, no invented email) + room for the form", Lb.cal && Lb.cal.x === 720 && Lb.cal.y > 500 && Lc.els.some((e) => e.t === "text" && /☎  0412 345 678\n⌂  1 Main St\n🕘  7am-3pm/.test(e.str) && !/✉/.test(e.str)) && !Lc.cal, { cal: Lb.cal });
  check("the stack: PHP + MySQL with a shop / booking / contact form, else static; the ticks from the words; a product's picture file; \"build me a website\" asks",
    W.stackOf({ shop: true }) === "php" && W.stackOf({ contact: true }) === "php" && W.stackOf({}) === "static" && W.featuresOf("sell bread online").shop && W.featuresOf("book a table").booking
    && W.prodFile("Rosie's Loaf!", 0) === "prod-rosie-s-loaf.png" && W.prodFile("", 2) === "prod-item-3.png" && W.isAsk("build me a website for my bakery") && W.isAsk("I need a site for my dental clinic") && !W.isAsk("make a flyer for my bakery"));
  /* ---- the build */
  const B = require(path.join(ROOT, "lib/siteBuild.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t852-")); B.setDir(tmp);
  const pg = (t, els) => ({ title: t, w: 1440, h: 1200, bg: "#fff8f0", els });
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", lang: "en", admin: true, shop: true, seed: { products: [{ name: "Sourdough loaf", category: "Bread", price: 8.5, description: "Our classic.", image: "prod-sourdough-loaf.png" }] },
    pages: [pg("Home", [{ kind: "text", text: "Welcome", size: 40, color: "#111111", box: { x: 0, y: 0, w: 600, h: 60 } }]), pg("Contact", [{ kind: "text", text: "Call us on 0412 345 678", size: 20, color: "#111111", box: { x: 0, y: 0, w: 600, h: 40 } }])],
    assets: [{ name: "prod-sourdough-loaf.png", b64: Buffer.from("PNGDATA").toString("base64") }] });
  const r1 = await B.build("Rosie", { ai: false }), out = path.join(tmp, "Rosie", "build");
  const schema = fs.readFileSync(path.join(out, "admin-schema.sql"), "utf8"), contact = fs.readFileSync(path.join(out, "contact.php"), "utf8"), readme = fs.readFileSync(path.join(out, "README.txt"), "utf8");
  check("the build: the planned products go in with admin-schema.sql (after its tables), their picture in assets/, the README says so", /CREATE TABLE IF NOT EXISTS products[\s\S]*INSERT IGNORE INTO products[^;]*'Sourdough loaf'/.test(schema) && fs.existsSync(path.join(out, "assets", "prod-sourdough-loaf.png")) && /also puts in the 1 product\(s\)/.test(readme) && r1.shop, readme.slice(-600));
  check("a page called Contact: its own words, then the contact form, saved by its handler (messages + the client)", /Call us on 0412 345 678/.test(contact) && /<form class="contact" method="post" action="contact\.php">/.test(contact) && /INSERT INTO messages/.test(contact) && /bgadm_client\(\$name, \$email, '', 'contact'\)/.test(contact) && /\$page_title = "Contact";/.test(contact), contact.slice(0, 500));
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", lang: "en", pages: [pg("Home", [])], assets: [] }); await B.build("Rosie", { ai: false });
  check("the products kept on the next save (not sent again)", /'Sourdough loaf'/.test(fs.readFileSync(path.join(out, "admin-schema.sql"), "utf8")));
  fs.rmSync(tmp, { recursive: true, force: true });
  const bp = { w: 1200, els: [{ kind: "box", color: "#8b4513", box: { x: 0, y: 0, w: 1200, h: 400 } }, { kind: "text", text: "Hero", size: 40, box: { x: 80, y: 100, w: 500, h: 60 } }, { kind: "image", src: "a.png", box: { x: 700, y: 50, w: 400, h: 300 } },
    { kind: "text", text: "Below", size: 18, box: { x: 80, y: 500, w: 500, h: 40 } }, { kind: "box", color: "#eeeeee", radius: 8, box: { x: 80, y: 600, w: 200, h: 50 } }, { kind: "box", color: "#1f2933", box: { x: 0, y: 900, w: 1200, h: 60 } }, { kind: "text", text: "Footer", size: 13, box: { x: 80, y: 915, w: 600, h: 20 } }] };
  const g = B0.bandsOf(bp), own = B0.ownLayout ? null : null;
  check("bands: a box as wide as the page = a section of its colour holding what sits on it; the rest between them; a small box left out (pure)",
    g.length === 3 && g[0].band && g[0].band.color === "#8b4513" && g[0].els.map((e) => e.text || e.src).join() === "Hero,a.png" && !g[1].band && g[1].els.map((e) => e.text).join() === "Below" && g[2].band.color === "#1f2933" && g[2].els[0].text === "Footer", g.map((x) => [x.band && x.band.color, x.els.map((e) => e.text || e.src)]));
  const cs = B0.colsOf([{ text: "intro", box: { x: 80, y: 160, w: 500, h: 40 } }, { text: "head", box: { x: 80, y: 100, w: 500, h: 60 } }, { src: "p", box: { x: 700, y: 50, w: 400, h: 300 } }]);
  const nest = B0.bandsOf({ w: 1200, els: [{ kind: "box", color: "#fff8f0", box: { x: 0, y: 0, w: 1200, h: 2000 } }, { kind: "box", color: "#8b4513", box: { x: 0, y: 0, w: 1200, h: 400 } }, { kind: "text", text: "Hero", box: { x: 80, y: 100, w: 500, h: 60 } }, { kind: "text", text: "Body", box: { x: 80, y: 600, w: 500, h: 60 } }] });
  check("columns: things one above another share a column (heading, then intro), the picture beside them; a band holding another band is the backdrop (pure)",
    cs.length === 2 && cs[0].els.map((e) => e.text).join() === "head,intro" && cs[1].els[0].src === "p" && nest.length === 2 && nest[0].band.color === "#8b4513" && nest[0].els[0].text === "Hero" && !nest[1].band && nest[1].els[0].text === "Body", { cs, nest });
  check("pcsite: a plain filled rectangle = a box (a page-sized one = the page's colour), an empty photo box left out; siteBuild keeps boxes, the page AI told about bands, the band CSS full width",
    /els\.push\(\{ kind: "box", color: sh\.fill/.test(src("ext/imageeditdock/pcsite.js")) && /if \(b\.w >= W \* 0\.97 && b\.h >= H \* 0\.97 && !els\.length\) \{ bg = sh\.fill; return; \}/.test(src("ext/imageeditdock/pcsite.js")) && /\^🖼 \//.test(src("ext/imageeditdock/pcsite.js"))
    && /if \(e\.kind === "box"\) return/.test(src("lib/siteBuild.js")) && /full-width coloured BAND/.test(B0.SYSTEM) && /\.band\{margin:0 calc\(50% - 50vw\)/.test(B0.BASE_CSS));
  /* ---- the wiring */
  check("POST /api/siteai/plan (routes/createAi.js, not server.js); pcwebai.js after pccreate.js and installed; File ▸ 🌐 Build Me a Website…; the Web ribbon's ✨ Build Me a Website; Create ▸ 🌐 Website opens it; the build sends the products + their pictures",
    /app\.post\("\/api\/siteai\/plan"/.test(src("routes/createAi.js")) && !/siteai/.test(src("misc/server.js")) && /"pccreate\.js", (?:"pcbizinfo\.js", "pcpropsauto\.js", )?"pcwebai\.js"/.test(src("ext/imageeditdock/ext.json")) && /PCWebAi\.install\(E\)/.test(src("ext/imageeditdock/imageedit.js"))
    && /addCmd\("file\.webai", "🌐 Build Me a Website…"/.test(src("ext/imageeditdock/pcwebai.js")) && /\["cmd", "file\.webai", "Build Me a Website", "✨"\]/.test(src("ext/imageeditdock/pcviews.js")) && /kind === "website" && E\.webAi/.test(src("ext/imageeditdock/pccreate.js"))
    && /a\.seed \? \{ seed: a\.seed \}/.test(src("ext/imageeditdock/pcsite.js")) && /c\.assets\.concat\(Array\.isArray\(a\.assets\)/.test(src("ext/imageeditdock/pcsite.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
