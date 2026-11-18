#!/usr/bin/env node
/* bitGen Studio — 2.850.0 units: 🛒 the built website's shop front end: lib/siteShopPhp.js (the catalogue, product, cart,
 * checkout and order pages + inc/shop.php: the cart in the session, totals, tax included / added, an order in one
 * transaction with the stock locked, CSRF, the order's private key), lib/siteAdminSql.js (the shop's settings, the orders'
 * payment method + key, the upgrade for an older myadmin), lib/siteBuild.js (the 🛒 tick: PHP + the admin area, the files,
 * the header's Shop + Cart, the CSS, the README), the studio's tick. The real thing through PHP + MariaDB: test-850-live.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const SP = require(path.join(ROOT, "lib/siteShopPhp.js")), lib = SP.SHOP_LIB, PAGES = ["SHOP_PAGE", "PRODUCT_PAGE", "CART_PAGE", "CHECKOUT_PAGE", "ORDER_PAGE"], all = [lib, ...PAGES.map((k) => SP[k])].join("\n");
  check("no JavaScript template holes in the PHP (no ${ and no back-ticks)", ["SHOP_LIB", ...PAGES].every((k) => !/\$\{/.test(SP[k]) && !SP[k].includes("`")));
  check("every page loads inc/shop.php and the site's header + footer", PAGES.every((k) => SP[k].includes("require_once __DIR__ . '/inc/shop.php';") && SP[k].includes("inc/header.php") && SP[k].includes("inc/footer.php")));
  check("every POST form carries the CSRF token and every POST is checked (hash_equals)", (all.match(/<form method="post"/g) || []).length === (all.match(/<form method="post"[^>]*>\s*<\?= shop_csrf_field\(\) \?>/g) || []).length
    && (all.match(/<form method="post"/g) || []).length === 3 && /hash_equals\(shop_csrf\(\)/.test(lib) && ["PRODUCT_PAGE", "CART_PAGE", "CHECKOUT_PAGE"].every((k) => SP[k].includes("shop_post_ok()")));
  check("no request value is put into SQL text (prepared statements; only the page's own WHERE pieces)", !/(query|prepare)\([^;]*\.\s*\$_(GET|POST|REQUEST|SESSION)/.test(all) && !/(query|prepare)\([^;]*\.\s*\$(qs|f|key|code)\b/.test(all));
  check("the output escaped: names, descriptions, the search and the messages through h(); a picture only from assets/ with a safe name", (all.match(/<\?= h\(/g) || []).length > 25 && /shop_img\(\$f\) \{ \$f = basename/.test(lib) && /\^\[\\w\.-\]\{1,120\}\\\.\(png\|jpe\?g\|webp\|gif\|svg\)\$/.test(lib));
  check("the session cookie: httponly, SameSite=Lax, secure on https", /'httponly' => true, 'samesite' => 'Lax', 'secure' =>/.test(lib));
  check("the cart: keys product[:variant], quantities 1 - 999, only active products / variants, never more than the stock when it is tracked and back-orders are off",
    /\^\(\\d\+\)\(\?::\(\\d\+\)\)\?\$/.test(lib) && /min\(999/.test(lib) && /active = 1/.test(lib) && /function shop_room\(\$p, \$v\) \{ \$track = \(int\)\$p\['track_stock'\] && !\(int\)\$p\['allow_backorder'\]/.test(lib));
  check("prices: the sale price when lower; a variant's own price", /sale_price'\] !== null && \(float\)\$p\['sale_price'\] < \(float\)\$p\['price'\]/.test(lib) && /if \(\$v && \$v\['price'\] !== null\) return \(float\)\$v\['price'\]/.test(lib));
  check("a code: active, its dates, used up, the least spend; percent / fixed / free shipping", /SELECT \* FROM coupons WHERE code = \? AND active = 1/.test(lib) && /max_uses/.test(lib) && /min_spend/.test(lib) && /kind'\] === 'percent'/.test(lib) && /kind'\] === 'free_shipping'\) \$ship = 0/.test(lib));
  check("shipping free over its amount; the tax inside the prices (rate / (100 + rate)) or added on top (Settings: prices_include_tax)", /free_over'\] !== null && \$sub - \$disc >= \(float\)\$method\['free_over'\]/.test(lib) && /\$base \* \$rate \/ \(100 \+ \$rate\)/.test(lib) && /\$base \* \$rate \/ 100/.test(lib) && /prices_include_tax/.test(lib));
  check("an order in ONE transaction: each product + variant row locked (FOR UPDATE), the stock checked again, rolled back on any error",
    /beginTransaction\(\)/.test(lib) && /FROM products WHERE id = \? AND active = 1 FOR UPDATE/.test(lib) && /FROM product_variants WHERE id = \? FOR UPDATE/.test(lib) && /FROM coupons WHERE id = \? FOR UPDATE/.test(lib) && /rollBack\(\)/.test(lib) && /->commit\(\)/.test(lib));
  check("the order: its number (order prefix + 5 digits), a private key (random_bytes), items, the stock taken + stock_movements (sale), the code counted, the status history, a pending payment, the client by email + their address",
    /str_pad\(\(string\)\$oid, 5, '0', STR_PAD_LEFT\)/.test(lib) && /\$tok = bin2hex\(random_bytes\(16\)\)/.test(lib) && /INSERT INTO order_items/.test(lib) && /stock = stock - \?/.test(lib) && /INSERT INTO stock_movements[^;]*'sale'/.test(lib)
    && /used = used \+ 1/.test(lib) && /INSERT INTO order_status_history/.test(lib) && /INSERT INTO payments[^;]*'pending'/.test(lib) && /bgadm_client\(\$f\['name'\], \$f\['email'\], \$f\['phone'\], 'order'\)/.test(lib) && /address_line1 = IF\(address_line1 = ''/.test(lib));
  check("a database error is never shown to the buyer: only ShopRefused reasons reach the page, anything else = 'could not be saved'", /class ShopRefused extends Exception/.test(lib) && /\$e instanceof ShopRefused \? \$e : new ShopRefused\('The order could not be saved/.test(lib) && /catch \(ShopRefused \$e\)/.test(SP.CHECKOUT_PAGE) && !/RuntimeException/.test(all));
  check("the temporary order number fits the column (30) and the key is 32", /'TMP-' \. substr\(\$tok, 0, 24\)/.test(lib));
  check("e-mails: the buyer (the items, the total, how to pay, the order's link) and the shop (order_email, else the business's email); the subject encoded", /shop_mail\(\$f\['email'\]/.test(lib) && /shop_mail\(shop_set\('order_email', shop_set\('email', ''\)\)/.test(lib) && /base64_encode\(\$subject\)/.test(lib) && /order\.php\?' \. http_build_query\(\['n' => \$number, 'k' => \$tok\]\)/.test(lib));
  check("how to pay: bank transfer (the bank details, the order number as the reference) and / or on pick-up, as Settings say", /pay_bank/.test(lib) && /pay_pickup/.test(lib) && /bank_details/.test(lib) && /pickup_note/.test(lib) && /as the reference/.test(lib));
  check("the order's page only with its key (hash_equals) - else not found", /hash_equals\(\$o\['view_token'\], \(string\)\(\$_GET\['k'\] \?\? ''\)\)/.test(SP.ORDER_PAGE) && /http_response_code\(404\)/.test(SP.ORDER_PAGE));
  check("the catalogue: categories, search (name, short description, SKU), featured first; the product page: pictures, options (out of stock ones off), quantity", /product_categories WHERE category_id = \?/.test(SP.SHOP_PAGE) && /p\.name LIKE \?/.test(SP.SHOP_PAGE) && /featured DESC/.test(SP.SHOP_PAGE) && /product_images/.test(SP.PRODUCT_PAGE) && /\(out of stock\)/.test(SP.PRODUCT_PAGE));
  check("checkout asks the address only when the shop ships; a valid email; the payment one of Settings'", /if \(shop_methods\(\)\): \?><fieldset><legend>Send it to/.test(SP.CHECKOUT_PAGE) && /FILTER_VALIDATE_EMAIL/.test(SP.CHECKOUT_PAGE) && /!isset\(\$pays\[\$f\['pay'\]\]\)/.test(SP.CHECKOUT_PAGE));
  /* ---- the database */
  const AS = require(path.join(ROOT, "lib/siteAdminSql.js")), sql = AS.schemaSql({ business: "Bakery" });
  check("myadmin's orders: payment_method + view_token; the settings: prices_include_tax, bank_details, pay_bank, pay_pickup, pickup_note, order_email", /payment_method VARCHAR\(20\) NOT NULL DEFAULT ''/.test(sql) && /view_token CHAR\(32\) NOT NULL DEFAULT ''/.test(sql)
    && ["prices_include_tax", "bank_details", "pay_bank", "pay_pickup", "pickup_note", "order_email"].every((k) => sql.includes("('" + k + "'")));
  check("an older myadmin upgraded (ALTER TABLE orders ADD … each alone) when it is there already", AS.upgradeSql().length === 2 && AS.upgradeSql().every((q) => /^ALTER TABLE orders ADD COLUMN/.test(q)) && /upgradeSql\(\)/.test(src("lib/siteAdmin.js")));
  check("the admin's Settings page names the shop's settings", ["prices_include_tax", "bank_details", "pay_bank", "pay_pickup", "pickup_note", "order_email"].every((k) => new RegExp("'" + k + "' =>").test(require(path.join(ROOT, "lib/siteAdminPhp.js")).ADMIN_PAGES)));
  /* ---- the build */
  const B = require(path.join(ROOT, "lib/siteBuild.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t850-")); B.setDir(tmp);
  const page = (els) => ({ title: "Home", w: 1200, h: 800, bg: "#ffffff", els });
  B.save({ name: "Bakery", title: "Bob's Bakery", stack: "static", lang: "en", shop: true, pages: [page([{ kind: "text", text: "Fresh bread", size: 30, color: "#111111", box: { x: 0, y: 0, w: 600, h: 40 } }])], assets: [] });
  const r1 = await B.build("Bakery", { ai: false }), out = path.join(tmp, "Bakery", "build"), meta = JSON.parse(fs.readFileSync(path.join(tmp, "Bakery", "site.json"), "utf8"));
  const files = ["inc/shop.php", "shop.php", "product.php", "cart.php", "checkout.php", "order.php", "admin/index.php", "admin-schema.sql"];
  check("🛒 ticked: PHP + the admin area made for it (even if Static was chosen); the shop's files; build says shop", r1.shop === true && !!r1.admin && meta.stack === "php" && meta.admin === true && files.every((f) => fs.existsSync(path.join(out, f))), { r1, missing: files.filter((f) => !fs.existsSync(path.join(out, f))) });
  const hdr = fs.readFileSync(path.join(out, "inc", "header.php"), "utf8"), css = fs.readFileSync(path.join(out, "css", "site.css"), "utf8"), rd = fs.readFileSync(path.join(out, "README.txt"), "utf8");
  check("the header: Shop + Cart (the count when the cart has some); the shop's CSS in site.css; the README's 🛒 part", /<a href="shop\.php"/.test(hdr) && /<a href="cart\.php" class="site-cart"/.test(hdr) && /shop_count\(\)/.test(hdr) && /\.shop-grid\{/.test(css) && /🛒 THE SHOP/.test(rd) && /prices_include_tax/.test(rd));
  B.save({ name: "Bakery", title: "Bob's Bakery", stack: "php", lang: "en", pages: [page([])], assets: [] }); const r2 = await B.build("Bakery", { ai: false });
  check("the tick kept on the next save", r2.shop === true && fs.existsSync(path.join(out, "cart.php")));
  B.save({ name: "Plain", title: "Plain", stack: "php", lang: "en", admin: true, pages: [page([])], assets: [] }); const r3 = await B.build("Plain", { ai: false }); const h3 = fs.readFileSync(path.join(tmp, "Plain", "build", "inc", "header.php"), "utf8");
  check("no shop without the tick (the admin area alone stays shop-less)", !r3.shop && !!r3.admin && !fs.existsSync(path.join(tmp, "Plain", "build", "shop.php")) && !/shop\.php/.test(h3));
  B.save({ name: "Own", title: "Own", stack: "php", lang: "en", shop: true, pages: [page([]), { title: "Shop", w: 1200, h: 800, bg: "#ffffff", els: [] }], assets: [] }); await B.build("Own", { ai: false });
  check("a page of the site's own called shop is not overwritten", !fs.readFileSync(path.join(tmp, "Own", "build", "shop.php"), "utf8").includes("The catalogue - made by bitGen"));
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ---- the studio */
  const ps = src("ext/imageeditdock/pcsite.js");
  check("the studio: Build Website's 🛒 Shop tick (sent with the save, remembered; ticking it picks PHP + the admin area), the shop's files said; not in server.js",
    /id="siteShop"/.test(ps) && /shop: !!a\.shop/.test(ps) && /shopT\.checked\) \{ dlg\.querySelector\("#siteStack"\)\.value = "php"/.test(ps) && /if \(r\.shop\) say/.test(ps) && !/siteShop/i.test(src("misc/server.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
