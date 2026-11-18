#!/usr/bin/env node
/* bitGen Studio — 2.853.0 units: 🎬 THE HERO VIDEO + 🛒 PRODUCT PICTURES - lib/siteAi.js (the plan's film idea when asked),
 * lib/siteBuild.js (a film with its poster: muted, looping; the poster only from the site's own pictures; the shop's products,
 * a picture of the site, a product's picture put in - a .jpg in place of a .png drops the old file), routes/sites.js, pcsite.js
 * (a 🎬 layer = the film + its poster), pcwebai.js (the 🎬 tick, the film job, 🛒 Product Pictures with the edit model (Qwen
 * first), 🛒 Save to the Product), pcdoc.js (undo keeps a layer's film), the Web ribbon. The browser: test-ui853-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const A = require(path.join(ROOT, "lib/siteAi.js"));
  const raw = { title: "Rosie's Bakery", video: "slow pan over warm loaves on a bakery counter", pages: [{ title: "Home", kind: "home", heading: "Hi", picture: "a bakery counter" }] };
  const v1 = A.clean(raw, { video: true }), v2 = A.clean({ pages: [{ heading: "x", picture: "pic" }] }, { video: true }), v3 = A.clean(raw, { video: false });
  check("the plan's film: the LLM's idea when asked, else the hero's picture idea; none when not asked", v1.video === raw.video && v1.features.video && v2.video === "pic" && !v3.video && !v3.features.video, { v1: v1.video, v2: v2.video, v3: v3.video });
  check("the LLM told of the film only when it is asked for", /"video"/.test(A.SYSTEM({ video: true })) && !/"video"/.test(A.SYSTEM({ video: false })));
  let asked = null;
  A.setComplete(async (o) => { asked = o; return { ok: true, text: JSON.stringify(raw) }; });
  const r = await A.plan({ ask: "a website for my bakery", video: true }), r0 = await A.plan({ ask: "a website for my bakery with a video" });
  check("plan(): the 🎬 tick asks for the film; the words alone do not", r.plan.features.video && r.plan.video && !r0.plan.features.video, { a: r.plan.features, b: r0.plan.features });
  /* ---- the build */
  const B = require(path.join(ROOT, "lib/siteBuild.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t853-")); B.setDir(tmp);
  const film = B.cleanEl({ kind: "image", src: "hero.mp4", poster: "p0-l3-poster.jpg", box: { x: 0, y: 0, w: 800, h: 400 } }), bad = B.cleanEl({ kind: "image", src: "hero.mp4", poster: "../x.jpg", box: {} });
  check("a film element keeps a safe poster, drops an unsafe one", film.poster === "p0-l3-poster.jpg" && !("poster" in bad), { film, bad });
  const h = B.elHtml(film);
  check("a film with a poster plays muted and looping, no controls (a hero); without one it has controls", /<video src="assets\/hero\.mp4" poster="assets\/p0-l3-poster\.jpg" autoplay muted loop playsinline/.test(h) && /controls/.test(B.elHtml(bad)) && !/controls/.test(h), h);
  const ch = B.cleanHtml('<video src="assets/hero.mp4" poster="http://evil.example/x.jpg" autoplay muted loop></video><video src="hero.mp4" poster="p.jpg"></video><video src="nope.mp4"></video>', new Set(["hero.mp4", "p.jpg"]));
  check("the page AI's films: an outside poster taken out, the site's own one kept, a film the site has not got taken out", !/evil/.test(ch) && /poster="assets\/p\.jpg"/.test(ch) && !/nope/.test(ch) && (ch.match(/<video /g) || []).length === 2, ch);
  check("the page AI is told how a film is written (its poster, muted, looping)", /\.mp4 \/ \.webm is a FILM/.test(B.SYSTEM) && /poster="assets\/POSTER" autoplay muted loop playsinline/.test(B.SYSTEM));
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", shop: true, seed: { products: [{ name: "Sourdough loaf", category: "Bread", price: 8.5, image: "prod-sourdough-loaf.png" }, { name: "Croissant", price: 4 }] },
    pages: [{ title: "Home", w: 1440, h: 900, els: [film] }], assets: [{ name: "prod-sourdough-loaf.png", b64: Buffer.from("PNG1").toString("base64") }, { name: "hero.mp4", b64: Buffer.from("MP4").toString("base64") }, { name: "p0-l3-poster.jpg", b64: Buffer.from("JPG").toString("base64") }] });
  const pr = B.products("Rosie");
  check("the shop's products: name, slug, price, picture, whether it is there", pr.length === 2 && pr[0].slug === "sourdough-loaf" && pr[0].has && pr[0].image === "prod-sourdough-loaf.png" && !pr[1].has && pr[1].image === "", pr);
  let e1 = ""; try { B.assetFile("Rosie", "../site.json"); } catch (e) { e1 = e.message; }
  let e2 = ""; try { B.assetFile("Rosie", "missing.png"); } catch (e) { e2 = e.message; }
  check("a picture of the site: its path; a path out of assets/ refused; a missing one = not found", fs.readFileSync(B.assetFile("Rosie", "prod-sourdough-loaf.png"), "utf8") === "PNG1" && !!e1 && /not found/.test(e2), { e1, e2 });
  const o1 = B.putProductPicture({ name: "Rosie", slug: "croissant", b64: Buffer.from("NEW").toString("base64"), ext: "png" });
  const o2 = B.putProductPicture({ name: "Rosie", slug: "sourdough-loaf", b64: Buffer.from("JPEG").toString("base64"), ext: "jpg" });
  const dir = path.join(tmp, "Rosie", "assets");
  check("a product's picture put in: a new one named after the product; a .jpg in place of the .png renames it and drops the old file; site.json knows",
    o1.image === "prod-croissant.png" && fs.readFileSync(path.join(dir, "prod-croissant.png"), "utf8") === "NEW" && o2.image === "prod-sourdough-loaf.jpg" && !fs.existsSync(path.join(dir, "prod-sourdough-loaf.png"))
    && B.products("Rosie").every((x) => x.has) && JSON.parse(fs.readFileSync(path.join(tmp, "Rosie", "site.json"), "utf8")).seed.products[0].image === "prod-sourdough-loaf.jpg", { o1, o2, files: fs.readdirSync(dir) });
  let e3 = ""; try { B.putProductPicture({ name: "Rosie", slug: "nope", b64: "QQ==" }); } catch (e) { e3 = e.message; }
  let e4 = ""; try { B.putProductPicture({ name: "Rosie", slug: "croissant", b64: "" }); } catch (e) { e4 = e.message; }
  check("refused: a product the site has not got, an empty picture", /no product nope/.test(e3) && /empty/.test(e4), { e3, e4 });
  await B.build("Rosie", { ai: false });
  const out = path.join(tmp, "Rosie", "build"), idx = fs.readFileSync(path.join(out, "index.php"), "utf8"), schema = fs.readFileSync(path.join(out, "admin-schema.sql"), "utf8");
  check("built again: the hero film with its poster on Home, both in assets/; the products' new pictures in admin-schema.sql", /<video src="assets\/hero\.mp4" poster="assets\/p0-l3-poster\.jpg" autoplay muted loop playsinline/.test(idx) && fs.existsSync(path.join(out, "assets", "hero.mp4")) && /'prod-sourdough-loaf\.jpg'/.test(schema) && /'prod-croissant\.png'/.test(schema), idx.slice(0, 600));
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ---- the wiring */
  const W = src("ext/imageeditdock/pcwebai.js"), R = src("routes/sites.js");
  check("routes/sites.js (not server.js): GET products, GET a picture of the site, POST a product's picture", /app\.get\("\/api\/sites\/products"/.test(R) && /app\.get\("\/api\/sites\/asset"/.test(R) && /app\.post\("\/api\/sites\/product-picture"/.test(R) && !/product-picture/.test(src("misc/server.js")));
  check("pcsite: a 🎬 layer = the film + its poster cropped from the layer", /L\.webVideo && \/\^\[\\w\.-\]\{1,80\}\\\.\(mp4\|webm\)\$\/i\.test\(L\.webVideo\)/.test(src("ext/imageeditdock/pcsite.js")) && /poster: n/.test(src("ext/imageeditdock/pcsite.js")));
  check("pcwebai: the 🎬 tick sent with the plan; the film made with the prompt docker's video style (from the hero photo = fl2va, else t2va, 5 s at 24 fps); the hero layer tagged hero.mp4",
    /id="pwaVideo"/.test(W) && /video: !!a\.video/.test(W) && /videoStyleSel/.test(W) && /fromUrl \? "fl2va" : "t2va"/.test(W) && /film\(plan\.video \|\| hero\.prompt, heroUrl, 5\)/.test(W) && /heroL\.webVideo = "hero\.mp4"/.test(W) && /Math\.round\(secs \* 24\)/.test(W));
  check("pcwebai: 🛒 Product Pictures - the edit model (Qwen first), ✏ Edit / ✔ Use it / ✕ Keep / 🖼 Open / 📁 Replace, 🌐 Build again; 🛒 Save to the Product; File commands + the Web ribbon",
    /\/qwen\/i\.test/.test(W) && /mode: "edit"/.test(W) && /pwp-ok/.test(W) && /pwp-no/.test(W) && /pwp-o\b/.test(W) && /pwp-f/.test(W) && /pwpBuild/.test(W) && /addCmd\("file\.prodpics", "🛒 Product Pictures…"/.test(W) && /addCmd\("file\.prodsave", "🛒 Save to the Product"/.test(W)
    && /\["cmd", "file\.prodpics", "Product Pictures", "🛒"\]/.test(src("ext/imageeditdock/pcviews.js")));
  check("undo keeps a layer's film (pcdoc DEEP)", /DEEP\.push\("webVideo"\)/.test(src("ext/imageeditdock/pcdoc.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
