#!/usr/bin/env node
/* bitGen Studio — 2.852.0 in a REAL browser: 🌐 Build Me a Website (the LLM's plan and the picture jobs stood in):
 *   "build me a website for my bakery" in the prompt docker opens the box with the words, 🛒 / 📅 ticked from them; 🌐 Build it =
 *   a web document of the planned pages (Home, Menu, Book, Contact), each laid out as layers (texts, the photos in their boxes),
 *   the 📅 booking calendar on Book with the planned services, then the site built: PHP + MySQL with the shop, the products in
 *   admin-schema.sql with their pictures, the Contact page's form. The Web ribbon's ✨ Build Me a Website.
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = require("fs").readFileSync(path.join(__dirname, "..", "static", "favicon.png"));   // a real picture for the stood-in jobs
const PLAN = { title: "Rosie's Bakery", tagline: "Baked at dawn", palette: { bg: "#fff8f0", accent: "#8b4513", ink: "#2b1d12", accentInk: "#ffffff" },
  contact: { phone: "0412 345 678", email: "", address: "1 Main St, Fremantle", hours: "7am-3pm Tue-Sun" },
  pages: [{ title: "Home", kind: "home", heading: "Fresh every morning", intro: "Sourdough, pastries and cakes.", cta: "Order a cake", picture: "a rustic bakery counter", sections: [{ heading: "Bread", text: "Slow sourdough.", picture: "sourdough loaves" }, { heading: "Cakes", text: "Celebration cakes.", picture: "a birthday cake" }] },
    { title: "Menu", kind: "menu", heading: "Our menu", intro: "", cta: "", picture: "", sections: [{ heading: "Pastries", text: "Croissants and danishes.", picture: "" }] },
    { title: "Book", kind: "booking", heading: "Book a cake tasting", intro: "Pick a time.", cta: "", picture: "", sections: [] },
    { title: "Contact", kind: "contact", heading: "Contact us", intro: "Say hello.", cta: "", picture: "", sections: [] }],
  products: [{ name: "Sourdough loaf", category: "Bread", price: 8.5, description: "Our classic.", picture: "a sourdough loaf" }, { name: "Croissant", category: "Pastry", price: 4, description: "Buttery.", picture: "a croissant" }],
  booking: { name: "Cake tastings", minutes: 45, services: [{ name: "Wedding cake tasting", mins: 60, price: "$30" }] }, features: { shop: true, booking: true, contact: true } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  let planAsk = null, jobs = 0;
  await p.route("**/api/siteai/plan", async (r) => { planAsk = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: PLAN }) }); });
  await p.route("**/api/genimage", async (r) => { jobs++; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t852-" + jobs }) }); });
  await p.route(/\/api\/jobs\/t852-\d+$/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "done", outputs: ["t852.png"] }) }));
  await p.route("**/outputs/t852.png", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.webAi && window.imageEditorInstance.E.site, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    // an image style for the pictures (the e2e install may have none)
    await ev(() => { const s = document.getElementById("styleSel"); if (s && !s.value) { const o = document.createElement("option"); o.value = "t852style"; o.textContent = "T852"; s.appendChild(o); s.value = "t852style"; } });
    /* ---- the prompt docker's ask */
    const said = await ev(async () => { for (const f of window.H3ChatRoutes || []) { const r = await f("build me a website for my bakery - order cakes online and book a cake tasting"); if (r) return r; } return null; });
    const box = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? { t: d.querySelector("h4").textContent, ask: d.querySelector("#pwaAsk").value, shop: d.querySelector("#pwaShop").checked, book: d.querySelector("#pwaBook").checked, contact: d.querySelector("#pwaContact").checked } : null; });
    check("\"build me a website for my bakery …\" in the prompt docker opens 🌐 Build Me a Website with the words; 🛒 Shop and 📅 Booking ticked from them", /Build Me a Website/.test(said || "") && box && /Build Me a Website/.test(box.t) && /bakery/.test(box.ask) && box.shop && box.book && box.contact, { said, box });
    await p.uncheck(".kxdlg.pcd #pwaAi");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /is built|was not|failed|✗/.test(document.body.innerText) && !window.imageEditorInstance.E.webAi.busy(), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(500);
    const doc = await ev(() => { const E = window.imageEditorInstance.E, out = []; for (let i = 0; i < E.pages.count(); i++) { E.pages.go(i); out.push({ names: E.S.layers.map((L) => L.name + "|" + L.type).slice(0, 30), name: (E.pages.list()[i] || {}).name, n: E.S.layers.length, pics: E.S.layers.filter((L) => /^🖼 /.test(L.name) && L.type !== "shape").length, cal: (E.S.layers.find((L) => L.cal) || {}).cal || null, w: E.S.w, h: E.S.h }); } E.pages.go(0); return out; });
    check("the plan asked with the ticks (shop + booking + contact); a web document of the 4 planned pages, 1440 px wide, in their names", planAsk && planAsk.shop && planAsk.booking && planAsk.contact && doc.length === 4 && doc.map((x) => x.name).join() === "Home,Menu,Book,Contact" && doc.every((x) => x.w === 1440), { planAsk, doc: doc.map((x) => [x.name, x.w, x.h, x.n]) });
    check("the pictures made one job at a time (3 photo boxes + 2 products) and put in their boxes on Home", jobs === 5 && doc[0].pics === 3, { jobs, pics: doc.map((x) => x.pics), names: doc[0].names });
    check("📅 the booking calendar on Book: Cake tastings, 45 min, the planned service", doc[2].cal && doc[2].cal.name === "Cake tastings" && doc[2].cal.slot === 45 && (doc[2].cal.services || [])[0] && doc[2].cal.services[0].name === "Wedding cake tasting", doc[2].cal);
    const last = await ev(() => { const l = window.imageEditorInstance.E.webAi.last; return l ? { site: l.site, imgs: l.products.map((x) => x.image), assets: l.assets.map((x) => x.name) } : null; });
    const name = last && last.site.name;
    check("the site: PHP + MySQL with the admin area and the 🛒 shop; each product's picture a file of its own", last && last.site.stack === "php" && last.site.admin && last.site.shop && last.imgs.join() === "prod-sourdough-loaf.png,prod-croissant.png" && last.assets.length === 2, last);
    const z = await fetch(new URL("/api/sites/zip?name=" + encodeURIComponent(name || "x"), URL_)), zb = Buffer.from(await z.arrayBuffer());
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), zz = await JSZip.loadAsync(zb);
    const rd = async (f) => (zz.file(f) ? zz.file(f).async("string") : "");
    const schema = await rd("admin-schema.sql"), contact = await rd("contact.php"), hdr = await rd("inc/header.php");
    check("built: the shop's pages, the products in admin-schema.sql with their pictures in assets/, the Contact page's words + form, the header's pages + Shop + Cart",
      !!zz.file("shop.php") && /INSERT IGNORE INTO products[^;]*'Sourdough loaf'[^;]*'prod-sourdough-loaf\.png'/.test(schema) && !!zz.file("assets/prod-croissant.png") && /<form class="contact"/.test(contact) && /Say hello/.test(contact)
      && /href="menu\.php"/.test(hdr) && /href="book\.php"/.test(hdr) && /href="cart\.php"/.test(hdr), { files: Object.keys(zz.files).filter((f) => !/\/$/.test(f)).slice(0, 40), contact: contact.slice(0, 300) });
    await ev(() => window.imageEditorInstance.E.views.apply("web")); await p.waitForTimeout(400);
    const rib = await ev(() => !![...document.querySelectorAll("#imageeditdock .cbbtn, #imageeditdock [data-cbid], #imageeditdock button")].find((x) => /Build Me a Website/.test(x.textContent + (x.title || ""))));
    check("the Web ribbon has ✨ Build Me a Website", rib);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
