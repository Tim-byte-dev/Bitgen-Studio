#!/usr/bin/env node
/* bitGen Studio — 2.863.0 LIVE: 💳 card payments on the shop's checkout for real - PHP's own server + a REAL MariaDB (the CRM's 🗄
 * database) + a stand-in Stripe API (STRIPE_API_BASE): checkout.php makes the order and a Checkout Session (the server's prices in
 * cents, the order number as the reference) and answers pay_url; paid.php checks the session with Stripe and marks the order paid
 * (🧾 Orders: paid, a payments row) - once; the webhook (a real Stripe signature) marks another one paid; a bad signature, an old one,
 * a wrong amount, another order's session - nothing. Needs PHP (+ curl, pdo_mysql) and MariaDB - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), crypto = require("crypto"), { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (php.status !== 0 || !/\bcurl\b/.test(php.stdout)) { console.log("SKIP: no PHP (with curl) here"); console.log(`\nRESULT: 0 passed, 0 failed`); return; }
  for (const f of ["inc/bg-pay.php", "paid.php", "stripe-webhook.php", "checkout.php"]) check("php -l " + f, spawnSync("php", ["-l", path.join(ROOT, "web/skills/cart-checkout/files", f)]).status === 0);
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB or pdo_mysql here - the live part"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js")), K = require(path.join(ROOT, "lib/webSkills.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t863l-")), P = path.join(tmp, "projects", "Shop"); fs.mkdirSync(P, { recursive: true });
  D.setBase(tmp, path.join(P, "db")); W.setProjectDir(() => P); DB.setDb(D);
  // the stand-in Stripe: sessions kept in memory; GET answers what the test set
  const SESS = {}, SEEN = []; let nextPaid = true, amountFudge = 0;
  const stripe = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
      SEEN.push({ m: req.method, u: req.url, auth: req.headers.authorization, body });
      const send = (o, c) => { res.writeHead(c || 200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
        const q = new URLSearchParams(body), id = "cs_test_" + crypto.randomBytes(6).toString("hex");
        let amt = 0; for (let i = 0; q.get(`line_items[${i}][quantity]`); i++) amt += +q.get(`line_items[${i}][quantity]`) * +q.get(`line_items[${i}][price_data][unit_amount]`);
        SESS[id] = { id, object: "checkout.session", client_reference_id: q.get("client_reference_id"), currency: q.get(`line_items[0][price_data][currency]`), amount_total: amt, payment_intent: "pi_" + id.slice(8), success: q.get("success_url"), q: Object.fromEntries(q) };
        return send({ id, url: "https://checkout.stripe.com/c/pay/" + id });
      }
      const m = /^\/v1\/checkout\/sessions\/(cs_test_\w+)$/.exec(req.url);
      if (req.method === "GET" && m && SESS[m[1]]) return send(Object.assign({}, SESS[m[1]], { payment_status: nextPaid ? "paid" : "unpaid", amount_total: SESS[m[1]].amount_total + amountFudge }));
      send({ error: { message: "No such thing" } }, 404);
    });
  });
  await new Promise((r) => stripe.listen(0, "127.0.0.1", r));
  let srv = null;
  try {
    W.create(undefined, "Shop");
    await DB.create({ scope: "project", name: "shop_site" });
    K.install("cart-checkout");
    W.saveRecord("products", { name: "Sourdough Loaf", price: 8.5, stock: 10, category: "Bread" });
    W.saveRecord("products", { name: "Rye", price: 7, sale: 6, category: "Bread" });
    const i = D.scopeInfo("project"), pw = require(path.join(ROOT, "lib/secrets.js")).store(tmp).read()[i.key] || "";
    const cfgF = path.join(P, "www", "inc", "config.php"), WH = "whsec_testsecret12345";
    fs.writeFileSync(cfgF, fs.readFileSync(cfgF, "utf8").replace(/define\('DB_HOST'[^;]*;/, `define('DB_HOST', '127.0.0.1:${i.port}');`).replace(/define\('DB_USER'[^;]*;/, "define('DB_USER', 'root');").replace(/define\('DB_PASS'[^;]*;/, `define('DB_PASS', '${pw}');`)
      + `define('STRIPE_SECRET_KEY', 'sk_test_bitgen12345678');\ndefine('STRIPE_WEBHOOK_SECRET', '${WH}');\ndefine('SHOP_CURRENCY', 'aud');\ndefine('STRIPE_API_BASE', 'http://127.0.0.1:${stripe.address().port}');\n`);
    const port = 20000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(P, "www")], { stdio: "ignore" });
    for (let k = 0; k < 40; k++) { try { await fetch(`http://127.0.0.1:${port}/robots.txt`); break; } catch (e) { await sleep(150); } }
    const U = (p) => `http://127.0.0.1:${port}/${p}`;
    const order = async () => (await fetch(U("checkout.php"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ slug: "sourdough-loaf", qty: 2, price: 0.01 }, { slug: "rye", qty: 1 }], customer: { name: "Ann Lee", email: "ann@example.com" } }) })).json();
    const o1 = await order(), s1 = Object.values(SESS)[0];
    check("checkout.php with the Stripe key: the order made + pay_url = Stripe's page (the buyer goes there)", o1.ok && /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/.test(o1.pay_url) && o1.total === 23, o1);
    check("...the session: the SERVER's prices in cents (850 x 2 + the sale 600 = 2300, the browser's 0.01 ignored), aud, the order number as the reference, the secret key as the login", s1 && s1.amount_total === 2300 && s1.currency === "aud" && s1.client_reference_id === o1.number && s1.q["line_items[0][price_data][product_data][name]"] === "Sourdough Loaf" && SEEN[0].auth === "Basic " + Buffer.from("sk_test_bitgen12345678:").toString("base64") && /paid\.php\?o=ORD-.*&t=[0-9a-f]{32}&s=\{CHECKOUT_SESSION_ID\}$/.test(s1.success), { s1, a: SEEN[0].auth });
    let ords = (await DB.list("orders")).items;
    check("...in 🧾 Orders it waits as new (not paid) until Stripe says so", ords[0].number === o1.number && ords[0].status === "new", ords[0]);
    // back from Stripe: paid.php
    nextPaid = false; let pg = await (await fetch(U(`paid.php?o=${o1.number}&s=${s1.id}`))).text();
    check("paid.php while Stripe says unpaid: 'Payment not finished', the order not paid", /Payment not finished/.test(pg) && (await DB.list("orders")).items[0].status === "new");
    nextPaid = true; pg = await (await fetch(U(`paid.php?o=${o1.number}&s=${s1.id}`))).text();
    ords = (await DB.list("orders")).items;
    const pays = (await D.run("project", "shop_site", "SELECT provider, reference, amount, currency, status FROM payments")).results[0].rows;
    check("paid.php when Stripe says paid: 'Thank you!', 🧾 Orders paid, a payments row (stripe, the payment intent, 23.00 AUD, succeeded)", /Thank you!/.test(pg) && ords[0].status === "paid" && pays.length === 1 && pays[0].provider === "stripe" && /^pi_/.test(pays[0].reference) && +pays[0].amount === 23 && pays[0].currency === "AUD" && pays[0].status === "succeeded", { ords: ords[0], pays });
    await fetch(U(`paid.php?o=${o1.number}&s=${s1.id}`));
    check("...back again (a reload): nothing twice (still one payment)", (await D.run("project", "shop_site", "SELECT COUNT(*) AS n FROM payments")).results[0].rows[0].n === 1);
    // the webhook
    const o2 = await order(), s2 = SESS[Object.keys(SESS)[1]];
    const ev = (obj, secret, t) => { const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: obj } }); t = t || Math.floor(Date.now() / 1000); const sig = crypto.createHmac("sha256", secret).update(t + "." + payload).digest("hex"); return { payload, header: `t=${t},v1=${sig}` }; };
    const hook = async (e) => { const r = await fetch(U("stripe-webhook.php"), { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": e.header }, body: e.payload }); return { s: r.status, j: await r.json() }; };
    const good = Object.assign({}, s2, { payment_status: "paid" });
    let h = await hook(ev(good, "whsec_wrongsecret999"));
    check("the webhook with a wrong signature: 400, nothing paid", h.s === 400 && (await DB.list("orders")).items[0].status === "new", h);
    h = await hook(ev(good, WH, Math.floor(Date.now() / 1000) - 3600));
    check("...a signature an hour old (a replay): 400", h.s === 400, h);
    h = await hook(ev(Object.assign({}, good, { amount_total: 100 }), WH));
    check("...signed but a different amount: not paid ('amount differs')", h.s === 200 && h.j.result === "amount differs" && (await DB.list("orders")).items[0].status === "new", h);
    h = await hook(ev(good, WH));
    ords = (await DB.list("orders")).items;
    check("...signed and right: order 2 paid in 🧾 Orders (the buyer closed the page - the webhook did it)", h.s === 200 && h.j.result === "paid" && ords[0].number === o2.number && ords[0].status === "paid", { h, o: ords[0] });
    h = await hook(ev(good, WH));
    check("...the same event again: 'already', still two payments", h.j.result === "already" && (await D.run("project", "shop_site", "SELECT COUNT(*) AS n FROM payments")).results[0].rows[0].n === 2, h);
    const o3 = await order(); pg = await (await fetch(U(`paid.php?o=${o3.number}&s=${s1.id}`))).text();
    check("paid.php with ANOTHER order's paid session: not marked paid", /Payment not finished/.test(pg) && (await DB.list("orders")).items[0].status === "new");
    // no key = no card step
    fs.writeFileSync(cfgF, fs.readFileSync(cfgF, "utf8").replace(/define\('STRIPE_SECRET_KEY'[^;]*;\n/, ""));
    const o4 = await order();
    check("without STRIPE_SECRET_KEY: the order as before, no pay_url (bank transfer / pay on pick-up)", o4.ok && !o4.pay_url && /emailed you/.test(o4.message), o4);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { if (srv) srv.kill(); stripe.close(); try { await D.stop("project"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
