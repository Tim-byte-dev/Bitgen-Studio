#!/usr/bin/env node
/* bitGen Studio — 2.850.0 LIVE: 🛒 the built website's shop through PHP against bitGen's MariaDB (myadmin's shop tables).
 * The catalogue (inactive products hidden, a sale price, categories, search), a product page (a form without its CSRF token
 * refused, more than the stock capped / refused, an option out of stock refused), the cart (the totals: tax included, shipping
 * free over its amount, a code), checkout (a bad email refused; the order: its number, items, the stock taken + movements, the
 * client + their address, the code counted, a pending payment, the status history, both e-mails), the order's page only with its
 * key, a code used up, the stock gone between the cart and checkout (nothing saved), the tax added on top.
 * Needs MariaDB (with its install script) and PHP with pdo_mysql - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const B = require(path.join(ROOT, "lib/siteBuild.js")), SA = require(path.join(ROOT, "lib/siteAdmin.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const done = () => { console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };
(async () => {
  const SP = require(path.join(ROOT, "lib/siteShopPhp.js"));
  const lint = ["SHOP_LIB", "SHOP_PAGE", "PRODUCT_PAGE", "CART_PAGE", "CHECKOUT_PAGE", "ORDER_PAGE"].map((k) => spawnSync("php", ["-l"], { input: SP[k], encoding: "utf8" }));
  if (lint[0].error) { console.log("SKIP: no PHP here"); return done(); }
  check("the shop's PHP files are valid PHP (php -l)", lint.every((r) => r.status === 0), lint.map((r) => r.stdout + r.stderr));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t850l-")); B.setDir(tmp);
  B.save({ name: "Bakery", title: "Bob's Bakery", stack: "php", lang: "en", shop: true, pages: [{ title: "Home", w: 1200, h: 800, bg: "#ffffff", els: [{ kind: "text", text: "Fresh bread", size: 30, color: "#111111", box: { x: 0, y: 0, w: 600, h: 40 } }] }], assets: [] });
  const built = await B.build("Bakery", { ai: false }), out = path.join(tmp, "Bakery", "build");
  check("the build: the shop's files + the admin area", built.shop === true && !!built.admin && ["shop.php", "cart.php", "checkout.php", "order.php", "product.php", "inc/shop.php"].every((f) => fs.existsSync(path.join(out, f))));
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || php.status !== 0 || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB or PHP with pdo_mysql here - the live shop"); fs.rmSync(tmp, { recursive: true, force: true }); return done(); }
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "t850d-")); D.setBase(tmpd, path.join(tmpd, "projects", "p1", "db"));
  const mailF = path.join(tmpd, "mail.txt"); fs.writeFileSync(mailF, "");
  let srv = null;
  try {
    SA.setDb(D);
    const inst = await SA.install({ scope: "global", business: "Bob's Bakery" });
    await D.createDb("global", "site_bakery");
    await D.run("global", "site_bakery", fs.readFileSync(path.join(out, "schema.sql"), "utf8"));
    const adm = (sql) => D.run("global", "myadmin", sql).then((r) => { const e = r.results.find((x) => x.ok === false); if (e) throw new Error(e.error + " :: " + e.sql); return r.results[r.results.length - 1].rows || []; });
    check("myadmin made", inst.created === true);
    await adm(`UPDATE settings SET value = '10' WHERE name = 'tax_rate'; UPDATE settings SET value = 'shop@example.com' WHERE name = 'order_email'; UPDATE settings SET value = 'BSB 000-000 Acc 12345678' WHERE name = 'bank_details';
      INSERT INTO categories (name, slug, sort) VALUES ('Bread', 'bread', 1), ('Cakes', 'cakes', 2);
      INSERT INTO products (sku, name, slug, short_description, price, sale_price, stock, track_stock, featured) VALUES ('SD1', 'Sourdough', 'sourdough', 'A slow loaf', 8, NULL, 5, 1, 1), ('CR1', 'Croissant', 'croissant', 'Buttery', 4, 3, 2, 1, 0), ('CK1', 'Birthday Cake', 'birthday-cake', 'Made to order', 20, NULL, 0, 1, 0);
      INSERT INTO products (sku, name, slug, price, stock, active) VALUES ('HD1', 'Secret Loaf', 'secret-loaf', 9, 9, 0);
      INSERT INTO product_categories (product_id, category_id) SELECT p.id, c.id FROM products p, categories c WHERE (p.slug IN ('sourdough', 'croissant') AND c.slug = 'bread') OR (p.slug = 'birthday-cake' AND c.slug = 'cakes');
      INSERT INTO product_variants (product_id, sku, name, price, stock) SELECT id, 'CK1-S', 'Small', 20, 3 FROM products WHERE slug = 'birthday-cake';
      INSERT INTO product_variants (product_id, sku, name, price, stock) SELECT id, 'CK1-L', 'Large', 35, 0 FROM products WHERE slug = 'birthday-cake';
      INSERT INTO shipping_methods (name, price, free_over, sort) VALUES ('Delivery', 10, 50, 0), ('Pick up', 0, NULL, 1);
      INSERT INTO coupons (code, kind, value, max_uses) VALUES ('SAVE10', 'percent', 10, 1);`);
    const ids = {}; for (const r of await adm("SELECT id, slug FROM products")) ids[r.slug] = +r.id;
    const vs = {}; for (const r of await adm("SELECT id, name FROM product_variants")) vs[r.name] = +r.id;
    const ship = {}; for (const r of await adm("SELECT id, name FROM shipping_methods")) ship[r.name] = +r.id;
    const st = D.status().scopes.global;
    await D.run("global", "site_bakery", "CREATE USER IF NOT EXISTS 'web'@'127.0.0.1' IDENTIFIED BY 'webpw'; GRANT ALL ON site_bakery.* TO 'web'@'127.0.0.1'; GRANT ALL ON myadmin.* TO 'web'@'127.0.0.1'; FLUSH PRIVILEGES;");
    const port = 21000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-d", `sendmail_path=cat >> ${mailF}`, "-S", "127.0.0.1:" + port, "-t", out], { env: Object.assign({}, process.env, { DB_HOST: "127.0.0.1;port=" + st.port, DB_NAME: "site_bakery", DB_USER: "web", DB_PASS: "webpw" }), stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 900));
    const mkReq = (jar) => (method, p, body) => new Promise((ok, no) => {
      const h = { Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }; if (body) { h["Content-Type"] = "application/x-www-form-urlencoded"; h["Content-Length"] = Buffer.byteLength(body); }
      const rq = http.request({ host: "127.0.0.1", port, path: p, method, headers: h }, (res) => { for (const c of res.headers["set-cookie"] || []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } let s = ""; res.on("data", (x) => { s += x; }); res.on("end", () => ok({ status: res.statusCode, body: s, loc: res.headers.location || "" })); });
      rq.on("error", no); if (body) rq.write(body); rq.end();
    });
    const form = (o) => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    const csrfOf = (b) => (/name="csrf" value="([0-9a-f]+)"/.exec(b) || [])[1] || "";
    const buyer = mkReq({}), other = mkReq({});
    /* ---- the catalogue */
    const cat = await buyer("GET", "/shop.php"), bread = await buyer("GET", "/shop.php?c=cakes"), find = await buyer("GET", "/shop.php?q=sour");
    check("the catalogue: active products only (the inactive one hidden), the sale price beside the old one, the header's Shop + Cart", cat.status === 200 && /Sourdough/.test(cat.body) && /Croissant/.test(cat.body) && /Birthday Cake/.test(cat.body) && !/Secret Loaf/.test(cat.body) && /<s>\$4\.00<\/s> \$3\.00/.test(cat.body) && /href="cart\.php" class="site-cart"/.test(cat.body), cat.body.slice(0, 600));
    check("a category shows its products only; the search finds by name", /Birthday Cake/.test(bread.body) && !/Sourdough/.test(bread.body) && /Sourdough/.test(find.body) && !/Croissant/.test(find.body));
    const hidden = await buyer("GET", "/product.php?p=secret-loaf");
    check("an inactive product's page is not found", hidden.status === 404);
    /* ---- the product page + the cart */
    const pp = await buyer("GET", "/product.php?p=sourdough");
    const noTok = await buyer("POST", "/product.php?p=sourdough", form({ qty: 2 }));
    const add1 = await buyer("POST", "/product.php?p=sourdough", form({ csrf: csrfOf(pp.body), qty: 2 }));
    check("a product page: its form; without the CSRF token refused; with it -> the cart", /A slow loaf/.test(pp.body) && /Add to cart/.test(pp.body) && /expired/.test(noTok.body) && add1.status === 302 && /cart\.php\?added=1/.test(add1.loc), { noTok: noTok.body.slice(0, 200), add1: add1.status });
    const pc = await buyer("GET", "/product.php?p=croissant");
    await buyer("POST", "/product.php?p=croissant", form({ csrf: csrfOf(pc.body), qty: 5 }));
    const pc2 = await buyer("GET", "/product.php?p=croissant"), more = await buyer("POST", "/product.php?p=croissant", form({ csrf: csrfOf(pc2.body), qty: 1 }));
    const pk = await buyer("GET", "/product.php?p=birthday-cake"), large = await buyer("POST", "/product.php?p=birthday-cake", form({ csrf: csrfOf(pk.body), v: vs.Large, qty: 1 }));
    const small = await buyer("POST", "/product.php?p=birthday-cake", form({ csrf: csrfOf(pk.body), v: vs.Small, qty: 1 }));
    check("more than the stock: capped to what is left (5 croissants -> 2), then refused; an option out of stock shown off + refused; one in stock added",
      /no more of those in stock/.test(more.body) && /Large - \$35\.00 \(out of stock\)/.test(pk.body) && /no more of those in stock/.test(large.body) && small.status === 302, { more: more.body.slice(0, 200), large: large.body.slice(0, 200) });
    const cart = await buyer("GET", "/cart.php");
    // 2 × 8 + 2 × 3 + 20 = 42; Delivery 10 (free over 50) = 52 with the tax inside it: 52 × 10 / 110 = 4.73
    check("the cart: 2 Sourdough, 2 Croissants (capped), 1 Small cake; subtotal $42.00, Delivery $10.00, total $52.00, includes tax $4.73; the header counts 5",
      /value="2" min="0"/.test(cart.body) && /\$42\.00/.test(cart.body) && /<dt>Shipping<\/dt><dd>\$10\.00/.test(cart.body) && /Includes tax \(10%\)<\/dt><dd>\$4\.73/.test(cart.body) && /class="shop-grand">\$52\.00/.test(cart.body) && /Cart \(5\)/.test(cart.body), cart.body.replace(/[\s\S]*<main/, "").slice(0, 1500));
    const qtys = {}; for (const m of cart.body.matchAll(/name="qty\[([0-9:]+)\]" value="(\d+)"/g)) qtys["qty[" + m[1] + "]"] = m[2];
    const upd = await buyer("POST", "/cart.php", form(Object.assign({ csrf: csrfOf(cart.body), ship: ship["Pick up"], coupon: "SAVE10" }, qtys)));
    // 42 - 4.20 = 37.80, pick up free; tax 37.80 × 10 / 110 = 3.44
    check("a code (10% off) and Pick up: discount -$4.20, shipping free, total $37.80 (tax $3.44)", /<dt>Discount<\/dt><dd>-\$4\.20/.test(upd.body) && /<dt>Shipping<\/dt><dd>free/.test(upd.body) && /class="shop-grand">\$37\.80/.test(upd.body) && /\$3\.44/.test(upd.body), upd.body.replace(/[\s\S]*<main/, "").slice(0, 1500));
    /* ---- checkout */
    const co = await buyer("GET", "/checkout.php");
    const addr = { line1: "1 Baker St", city: "Brisbane", state: "QLD", postcode: "4000", country: "Australia" };
    const badMail = await buyer("POST", "/checkout.php", form(Object.assign({ csrf: csrfOf(co.body), name: "Tim Paul", email: "not-an-email", pay: "bank" }, addr)));
    const placed = await buyer("POST", "/checkout.php", form(Object.assign({ csrf: csrfOf(badMail.body), name: "Tim Paul", email: "Tim@Example.com", phone: "0400 000 000", pay: "bank", notes: "Ring the bell" }, addr)));
    check("checkout: bank transfer + pay on pick-up offered; a bad email refused (nothing saved); the right form -> the order's page", /value="bank"/.test(co.body) && /value="pickup"/.test(co.body) && /valid email/.test(badMail.body) && placed.status === 302 && /^order\.php\?n=ORD-00001&k=[0-9a-f]{32}&new=1$/.test(placed.loc), { loc: placed.loc, msg: (/role="alert">([^<]*)/.exec(placed.body) || [])[1], bad: (/role="alert">([^<]*)/.exec(badMail.body) || [])[1] });
    const o = (await adm("SELECT * FROM orders"))[0] || {}, items = await adm("SELECT name, qty, unit_price, total FROM order_items ORDER BY id");
    check("the order: ORD-00001, pending + unpaid, bank, subtotal 42.00 / discount 4.20 / shipping 0.00 / tax 3.44 / total 37.80, the code, Pick up, the address, the note, its 32-letter key",
      o.number === "ORD-00001" && o.status === "pending" && o.payment_status === "unpaid" && o.payment_method === "bank" && +o.subtotal === 42 && +o.discount === 4.2 && +o.shipping === 0 && +o.tax === 3.44 && +o.total === 37.8
      && o.coupon_code === "SAVE10" && o.shipping_method === "Pick up" && o.ship_city === "Brisbane" && o.email === "tim@example.com" && o.notes === "Ring the bell" && /^[0-9a-f]{32}$/.test(o.view_token), o);
    check("its items: 2 × Sourdough 8.00, 2 × Croissant 3.00 (the sale price), 1 × Birthday Cake - Small 20.00", items.length === 3 && items[0].name === "Sourdough" && +items[0].qty === 2 && +items[1].unit_price === 3 && items[2].name === "Birthday Cake - Small" && +items[2].total === 20, items);
    const stock = await adm("SELECT slug, stock FROM products ORDER BY id"), vst = await adm("SELECT name, stock FROM product_variants ORDER BY id"), mv = await adm("SELECT qty_change, reason, order_id FROM stock_movements ORDER BY id");
    check("the stock taken (Sourdough 5 -> 3, Croissant 2 -> 0, Small cake 3 -> 2) with a 'sale' movement each", +stock[0].stock === 3 && +stock[1].stock === 0 && +vst[0].stock === 2 && +vst[1].stock === 0 && mv.length === 3 && mv.every((m) => m.reason === "sale" && +m.order_id === +o.id) && +mv[0].qty_change === -2, { stock, vst, mv });
    const cl = await adm("SELECT first_name, last_name, email, phone, city, postcode, source FROM clients"), pay = await adm("SELECT provider, amount, status FROM payments"), hist = await adm("SELECT status FROM order_status_history"), cp = await adm("SELECT used FROM coupons");
    check("the client made (name split, email, phone, the address, source order); a pending payment for 37.80 (bank); the status history; the code counted",
      cl.length === 1 && cl[0].first_name === "Tim" && cl[0].email === "tim@example.com" && cl[0].city === "Brisbane" && cl[0].postcode === "4000" && cl[0].source === "order" && pay.length === 1 && pay[0].provider === "bank" && +pay[0].amount === 37.8 && pay[0].status === "pending" && hist.length === 1 && hist[0].status === "pending" && +cp[0].used === 1, { cl, pay, hist, cp });
    const mail = fs.readFileSync(mailF, "utf8");
    check("the e-mails: to the buyer (the items, the total, the bank details with the order number as the reference, the order's link) and to the shop", /To: tim@example\.com|To: Tim@Example\.com/i.test(mail) && /To: shop@example\.com/.test(mail) && /Your order ORD-00001/.test(mail) && /Total \$37\.80/.test(mail) && /BSB 000-000 Acc 12345678/.test(mail) && /as the reference/.test(mail) && /order\.php\?n=ORD-00001&k=/.test(mail), mail.slice(0, 1200));
    const page = await buyer("GET", "/" + placed.loc), wrong = await buyer("GET", "/order.php?n=ORD-00001&k=" + "0".repeat(32)), cartAfter = await buyer("GET", "/cart.php");
    check("the order's page with its key: Thank you, the items, the total, how to pay; a wrong key = not found; the cart emptied", /Thank you!/.test(page.body) && /Birthday Cake - Small/.test(page.body) && /\$37\.80/.test(page.body) && /BSB 000-000/.test(page.body) && wrong.status === 404 && /Your cart is empty/.test(cartAfter.body), page.body.replace(/[\s\S]*<main/, "").slice(0, 600));
    /* ---- another buyer: the code used up, the stock gone between the cart and checkout, the tax added on top */
    const oc = await other("GET", "/product.php?p=croissant");
    check("sold out: the croissant's page says Out of stock (no form)", /Out of stock/.test(oc.body) && !/Add to cart/.test(oc.body));
    const os1 = await other("GET", "/product.php?p=sourdough"); await other("POST", "/product.php?p=sourdough", form({ csrf: csrfOf(os1.body), qty: 3 }));
    const oc1 = await other("GET", "/cart.php"), used = await other("POST", "/cart.php", form({ csrf: csrfOf(oc1.body), ["qty[" + ids.sourdough + "]"]: 3, ship: ship.Delivery, coupon: "SAVE10" }));
    check("the code used up (one use) said in the cart, no discount", /That code has been used up/.test(used.body) && !/<dt>Discount/.test(used.body));
    await other("POST", "/cart.php", form({ csrf: csrfOf(used.body), ["qty[" + ids.sourdough + "]"]: 3, ship: ship.Delivery, coupon: "" }));
    await adm(`UPDATE products SET stock = 1 WHERE slug = 'sourdough'`);
    const oco = await other("GET", "/checkout.php"), late = await other("POST", "/checkout.php", form(Object.assign({ csrf: csrfOf(oco.body), name: "Ann Lee", email: "ann@example.com", pay: "pickup" }, addr)));
    const n2 = await adm("SELECT COUNT(*) AS n FROM orders"), s2 = await adm("SELECT stock FROM products WHERE slug = 'sourdough'"), c2 = await adm("SELECT COUNT(*) AS n FROM clients");
    check("the stock gone between the cart and checkout: 'Only 1 of Sourdough left', nothing saved (no order, no client, the stock untouched)", /Only 1 of Sourdough left/.test(late.body) && +n2[0].n === 1 && +s2[0].stock === 1 && +c2[0].n === 1, { body: late.body.replace(/[\s\S]*<main/, "").slice(0, 300), n2, s2, c2 });
    await adm(`UPDATE settings SET value = '0' WHERE name = 'prices_include_tax'`);
    const oc2 = await other("GET", "/cart.php"), fix = await other("POST", "/cart.php", form({ csrf: csrfOf(oc2.body), ["qty[" + ids.sourdough + "]"]: 1, ship: ship.Delivery, coupon: "" }));
    // 8 + Delivery 10 = 18, the tax added: 1.80 -> 19.80
    check("the tax added on top (prices_include_tax 0): $8.00 + $10.00 delivery + Tax (10%) $1.80 = $19.80", /<dt>Tax \(10%\)<\/dt><dd>\$1\.80/.test(fix.body) && /class="shop-grand">\$19\.80/.test(fix.body), fix.body.replace(/[\s\S]*<main/, "").slice(0, 1200));
    const oco2 = await other("GET", "/checkout.php"), placed2 = await other("POST", "/checkout.php", form(Object.assign({ csrf: csrfOf(oco2.body), name: "Ann Lee", email: "ann@example.com", pay: "pickup" }, addr)));
    const o2 = (await adm("SELECT number, total, tax, payment_method FROM orders WHERE id = 2"))[0] || {}, p2 = await other("GET", "/" + placed2.loc);
    check("the second order: ORD-00002, total 19.80, pay on pick-up said on its page", placed2.status === 302 && o2.number === "ORD-00002" && +o2.total === 19.8 && +o2.tax === 1.8 && o2.payment_method === "pickup" && /Please pay when you pick it up/.test(p2.body), { o2, loc: placed2.loc });
  } finally { if (srv) srv.kill(); try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmpd, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
