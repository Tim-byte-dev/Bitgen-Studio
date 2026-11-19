#!/usr/bin/env node
/* bitGen Studio — 2.863.0 units: 💳 card payments on the shop's checkout (Stripe Checkout): the cart-checkout skill's inc/bg-pay.php,
 * paid.php, stripe-webhook.php (source rules - the live test runs them), checkout.php's pay_url, js/bg-shop.js (the same in all three
 * shop skills) going to Stripe's page; the app keeps the keys encrypted (lib/hostFtp.js savePay) and puts them only into the HOST's
 * inc/config.php (☐ withPay - sent even when the host has a config); the docker's 💳 fields. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), SK = "web/skills/cart-checkout/files/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const P = src(SK + "inc/bg-pay.php"), C = src(SK + "checkout.php"), H = src(SK + "stripe-webhook.php"), Pd = src(SK + "paid.php");
  check("bg-pay.php: on only with a real-looking secret key; cents (yen etc. whole); the session from the SERVER's lines with the order number; the success page carries the session id", /sk\|rk\)_\(test\|live\)_/.test(P) && /'jpy'/.test(P) && /client_reference_id' => \$number/.test(P) && /unit_amount' => bg_pay_minor\(\$l\['unit'\]/.test(P) && /\{CHECKOUT_SESSION_ID\}/.test(P));
  check("...paid only when Stripe says paid for THAT order, the same amount + currency; once (payment_status <> 'paid' + rowCount), a payments row", /payment_status'\] \?\? ''\) !== 'paid'/.test(P) && /amount_total'\] \?\? -1\) !== bg_pay_minor/.test(P) && /payment_status <> 'paid'/.test(P) && /INSERT INTO payments/.test(P));
  check("...the webhook signature: HMAC-SHA256 of t.payload, hash_equals, 5 minutes", /hash_hmac\('sha256', \$t \. '\.' \. \$payload/.test(P) && /hash_equals/.test(P) && /\$tol = 300/.test(P));
  check("stripe-webhook.php refuses an unsigned call (400); paid.php checks the session with Stripe and its reference = the order", /bg_pay_sig_ok/.test(H) && /400\);/.test(H) && /client_reference_id'\] \?\? ''\) === \$number/.test(Pd));
  check("checkout.php: pay_url when the key is set (else as before, emailed); the order's currency + a private token kept", /'pay_url' => \$url/.test(C) && /if \(bg_pay_on\(\)\)/.test(C) && /view_token = \?/.test(C));
  const sk = JSON.parse(src("web/skills/cart-checkout/skill.json"));
  check("the skill copies inc/bg-pay.php, paid.php, stripe-webhook.php (bg-pay = a library file, refreshed)", ["inc/bg-pay.php", "paid.php", "stripe-webhook.php"].every((f) => sk.files.includes(f)) && require(path.join(ROOT, "lib/webSkills.js")).LIB("inc/bg-pay.php"));
  const shops = ["cart-checkout", "categories", "product-page"].map((s) => src(`web/skills/${s}/files/js/bg-shop.js`));
  check("js/bg-shop.js the same in the three shop skills, and it goes to pay_url (https only)", shops.every((x) => x === shops[0]) && /j\.pay_url && \/\^https:\\\/\\\/\/\.test\(j\.pay_url\)/.test(shops[0]));
  // the page: the checkout form with a pay_url answer
  const { JSDOM } = require("jsdom");
  const d = new JSDOM('<body data-bg-currency="$"><form data-bg-checkout><input name="name" value="Ann"><input name="email" value="ann@example.com"><button type="submit">Order</button></form></body>', { url: "https://shop.example/checkout.html", runScripts: "outside-only" });
  d.window.localStorage.setItem("bg-cart", JSON.stringify([{ slug: "rye", qty: 1 }]));
  let posted = null; d.window.fetch = async (u, o) => { posted = JSON.parse(o.body); return { status: 200, json: async () => ({ ok: true, number: "ORD-1", pay_url: "https://checkout.stripe.com/c/pay/cs_test_1", message: "Taking you to the card payment…" }) }; };
  d.window.eval(shops[0]); await sleep(30);
  d.window.document.querySelector("form").dispatchEvent(new d.window.Event("submit", { cancelable: true })); await sleep(40);
  check("the page: the order sent, then 'Order ORD-1 - Taking you to the card payment…' on the way to Stripe; the cart emptied", posted && posted.items[0].slug === "rye" && /Order ORD-1 - Taking you to the card payment/.test(d.window.document.body.textContent) && d.window.localStorage.getItem("bg-cart") === "[]", d.window.document.body.innerHTML);
  // the app: keys kept encrypted, into the host's config only
  const W = require(path.join(ROOT, "lib/webProject.js")), HF = require(path.join(ROOT, "lib/hostFtp.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t863-")), PJ = path.join(tmp, "projects", "Shop"); fs.mkdirSync(PJ, { recursive: true });
  W.setProjectDir(() => PJ); HF.setBase(tmp); W.create(undefined, "Shop");
  fs.writeFileSync(path.join(PJ, "www", "inc", "config.php"), "<?php\ndefine('DB_NAME', getenv('DB_NAME') ?: 'shop');\n");
  let threw = ""; try { HF.savePay({ secret: "pk_live_abc12345678" }); } catch (e) { threw = e.message; }
  check("savePay: a publishable key (pk_) refused - the SECRET key, sk_test_ / sk_live_; a bad webhook secret / currency refused", /sk_test_/.test(threw) && (() => { try { HF.savePay({ webhook: "abc" }); return false; } catch (e) { return /whsec_/.test(e.message); } })() && (() => { try { HF.savePay({ currency: "dollars" }); return false; } catch (e) { return /three letters/.test(e.message); } })(), threw);
  const pi = HF.savePay({ secret: "sk_test_abc_12345678", webhook: "whsec_abcdefgh1234", currency: "NZD" });
  const hj = fs.readFileSync(path.join(PJ, "web", "host.json"), "utf8"), kj = fs.readFileSync(path.join(tmp, "settings", "keys.json"), "utf8");
  check("...kept encrypted (not in host.json, not readable in keys.json); the currency + test mode said", pi.hasSecret && pi.hasWebhook && pi.mode === "test" && pi.currency === "nzd" && !/sk_test|whsec_/.test(hj) && !/sk_test|whsec_/.test(kj), { pi, hj });
  const cf = HF.configFor(false, true), local = fs.readFileSync(path.join(PJ, "www", "inc", "config.php"), "utf8");
  check("configFor withPay: STRIPE_SECRET_KEY (the host's copy only), STRIPE_WEBHOOK_SECRET, SHOP_CURRENCY in the HOST's copy; the project's file never has them", cf.pay && cf.text.includes("define('STRIPE_SECRET_KEY', getenv('STRIPE_SECRET_KEY') ?: 'sk_test_abc_12345678');") && /STRIPE_WEBHOOK_SECRET.*whsec_abcdefgh1234/.test(cf.text) && /SHOP_CURRENCY.*'nzd'/.test(cf.text) && !/sk_test|whsec_/.test(local), cf.text);
  check("send: a tick for the card keys (or the password) sends the config even when the host has one; 'never' still never", /cfgMode === "missing" && \(!onHost \|\| o\.withPassword \|\| o\.withPay\)/.test(src("lib/hostFtp.js")));
  HF.savePay({ forget: true });
  check("...✕ forgets them; withPay then refuses (no key)", !HF.payInfo().hasSecret && (() => { try { HF.configFor(false, true); return false; } catch (e) { return /Stripe secret key/.test(e.message); } })());
  const D = src("ext/webdock/dock.html"), J = src("ext/webdock/webdock.js");
  check("the docker: 💳 Card payments in 📤 Host (secret key, webhook, currency, ✕, the tick, the Stripe steps + the test card); routes /api/web/host/pay", ["wbPaySk", "wbPayWh", "wbPayCur", "wbPayForget", "wbHoWithPay"].every((i) => D.includes(`id="${i}"`)) && /4242 4242 4242 4242/.test(D) && /stripe-webhook\.php/.test(D) && /withPay: \$\("wbHoWithPay"\)\.checked/.test(J) && /\/api\/web\/host\/pay/.test(src("routes/webEditor.js")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
