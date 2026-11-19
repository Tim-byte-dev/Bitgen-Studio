#!/usr/bin/env node
/* bitGen Studio — 2.866.0 units: the WYSIWYG's ◧ blocks + 📱 phone / tablet layout (ext/webdock/wbwys.js pure parts), the shop's
 * data-category / data-view="pictures" (js/bg-shop.js, the same in all three shop skills) and the booking sheet's own fields folded into
 * the contact message (js/bg-contact.js) - in jsdom; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const Y = require(path.join(ROOT, "ext/webdock/wbwys.js")), K = require(path.join(ROOT, "lib/webSkills.js"));
  check("the blocks: gallery (pictures / video / audio / 3D), calendar, booking sheet, product pictures, category, hero, header (top), footer (end) - each on a real skill", Y.BLOCKS.map((b) => b.id).join() === "gallery,calendar,sheet,products,category,hero,header,footer" && Y.BLOCKS[0].sub.map((s) => s[0]).join() === "gallery-pictures,gallery-video,gallery-audio,gallery-3d" && Y.BLOCKS.filter((b) => b.skill).every((b) => K.meta(b.skill)) && Y.BLOCKS.find((b) => b.id === "header").where === "top" && Y.BLOCKS.find((b) => b.id === "footer").where === "end");
  const t = '<html><head><title>x</title></head><body><main>hi</main>\n<script src="js/a.js"></script>\n</body></html>', r1 = Y.responsive(t), r2 = Y.responsive(r1);
  check("📱 responsive: the viewport line + <style id=\"bg-responsive\"> (1024 px two columns, 640 px one, absolute places let go); again = still one, the viewport once", /<meta name="viewport" content="width=device-width, initial-scale=1">/.test(r1) && /max-width: 1024px/.test(r1) && /max-width: 640px/.test(r1) && /position: static !important/.test(r1) && (r2.match(/bg-responsive/g) || []).length === 1 && (r2.match(/viewport/g) || []).length === 1);
  check("place: top = after <body>, end = before the page's scripts", /<body>\n<header>H<\/header><main>/.test(Y.place(t, "<header>H</header>", "top")) && /<\/main>\n<footer>F<\/footer>\n<script/.test(Y.place(t, "<footer>F</footer>", "end")));
  check("the editor-only dashed boxes name what the site fills (catalogue, category, booking, news, map)", /data-category\]:empty::before \{ content: "🗂/.test(Y.PH_CSS) && /data-bg-book\]:empty::before/.test(Y.PH_CSS) && /data-bg-map\]:empty::before/.test(Y.PH_CSS));
  const shops = ["cart-checkout", "categories", "product-page"].map((s) => src(`web/skills/${s}/files/js/bg-shop.js`)), css = ["cart-checkout", "categories", "product-page"].map((s) => src(`web/skills/${s}/files/css/bg-shop.css`));
  check("bg-shop.js + bg-shop.css still the same in the three shop skills", shops.every((x) => x === shops[0]) && css.every((x) => x === css[0]) && /\.bg-pics/.test(css[0]));
  const { JSDOM } = require("jsdom");
  const prods = { products: [{ name: "Rye", slug: "rye", category: "Bread", price: 7, image: "images/rye.jpg" }, { name: "Tart <b>", slug: "tart", category: "Cakes", price: 9, image: "images/tart.jpg" }, { name: "Plain", slug: "plain", category: "Bread", price: 3 }] };
  const shopPage = (html) => { const d = new JSDOM(html, { url: "https://s.example/shop.html", runScripts: "outside-only" }); d.window.fetch = async () => ({ ok: true, status: 200, json: async () => prods }); d.window.eval(shops[0]); return d; };
  let d = shopPage('<div data-bg-catalog data-view="pictures"></div>'); await sleep(40);
  const pics = [...d.window.document.querySelectorAll(".bg-pic")].map((a) => [a.getAttribute("href"), a.querySelector("span").textContent]);
  check("🛍 data-view=\"pictures\": the products WITH a picture, each linking to its page, the name as text", JSON.stringify(pics) === JSON.stringify([["product.html?p=rye", "Rye"], ["product.html?p=tart", "Tart <b>"]]) && !d.window.document.querySelector(".bg-pic b"), pics);
  d = shopPage('<div data-bg-catalog data-category="Bread"></div>'); await sleep(40);
  const names = [...d.window.document.querySelectorAll(".bg-product-card")].map((c) => c.textContent);
  check("🗂 data-category=\"Bread\": that category picked (its chip on, only its products)", names.length === 2 && names.every((n) => /Rye|Plain/.test(n)) && (d.window.document.querySelector(".bg-chips button.on") || {}).textContent === "Bread", names);
  const sent = []; d = new JSDOM(`<body>${Y.BLOCKS.find((b) => b.id === "sheet").html}</body>`, { url: "https://s.example/", runScripts: "outside-only" });
  d.window.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, message: "Thanks" }) }; };
  d.window.eval(src("web/skills/contact-map/files/js/bg-contact.js")); await sleep(30);
  const F = d.window.document.querySelector("form"); F.elements.name.value = "Ann"; F.elements.email.value = "a@b.co"; F.elements.day.value = "2026-12-01"; F.elements.time.value = "19:00"; F.elements.message.value = "window seat";
  F.dispatchEvent(new d.window.Event("submit", { cancelable: true })); await sleep(30);
  check("📋 the booking sheet's day / time / people go into the message as 'Label: value' lines (contact.php keeps only its four fields); subject 'Booking request'", sent.length === 1 && sent[0].subject === "Booking request" && /Day: 2026-12-01/.test(sent[0].message) && /How many people: 2/.test(sent[0].message) && /\n\nwindow seat$/.test(sent[0].message) && !("day" in sent[0]), sent[0]);
  const E = JSON.parse(src("ext/webdock/ext.json")), D = src("ext/webdock/dock.html");
  check("wiring: wbwys.js loaded; the toolbar / flyout / auto-hide styles (the top bar folds unless hovered or focused)", E.scripts.includes("wbwys.js") && /#wbBlocks \{/.test(D) && /#wbBlkFly/.test(D) && /#webdock\.wbautohide #wbTopBar:not\(:hover\):not\(:focus-within\)/.test(D));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
