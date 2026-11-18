#!/usr/bin/env node
/* bitGen Studio — 2.859.0 LIVE: the 🧩 web skills' PHP for real - every .php of web/skills is valid (php -l); then with a REAL
 * MariaDB (the CRM's 🗄 database, lib/webDb.js) and PHP's own server on the project's www: checkout.php takes an order (priced from
 * data/content.json on the server - the browser's prices ignored, a sold-out product left out, the client made) that the CRM's
 * 🧾 Orders then shows; register.php / login.php / account.php (?me=1) / logout.php with CSRF, a wrong password refused.
 * Needs PHP (+ pdo_mysql) and MariaDB - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (php.status !== 0) { console.log("SKIP: no PHP here"); console.log(`\nRESULT: 0 passed, 0 failed`); return; }
  const phps = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.php$/.test(e.name)) phps.push(f); } })(path.join(ROOT, "web", "skills"));
  const lint = phps.map((f) => spawnSync("php", ["-l", f], { encoding: "utf8" }));
  check("every PHP file of the web skills is valid PHP (php -l)", phps.length >= 7 && lint.every((r) => r.status === 0), lint.filter((r) => r.status).map((r) => r.stdout + r.stderr));
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB or pdo_mysql here - the live part"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js")), K = require(path.join(ROOT, "lib/webSkills.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t859l-")), P = path.join(tmp, "projects", "Shop"); fs.mkdirSync(P, { recursive: true });
  D.setBase(tmp, path.join(P, "db")); W.setProjectDir(() => P); DB.setDb(D);
  let srv = null;
  try {
    W.create(undefined, "Shop");
    const db = await DB.create({ scope: "project", name: "shop_site" });
    for (const id of ["cart-checkout", "categories", "login"]) K.install(id);
    W.saveRecord("products", { name: "Sourdough Loaf", price: 8.5, stock: 10, category: "Bread" });
    W.saveRecord("products", { name: "Rye", price: 7, sale: 6, category: "Bread" });
    W.saveRecord("products", { name: "Gone Cake", price: 30, stock: 0, category: "Cakes" });
    // the site's PHP gets the local database's login (on a host: typed on the server)
    const i = D.scopeInfo("project"), pw = require(path.join(ROOT, "lib/secrets.js")).store(tmp).read()[i.key] || "";
    const cfgF = path.join(P, "www", "inc", "config.php");
    fs.writeFileSync(cfgF, fs.readFileSync(cfgF, "utf8").replace(/define\('DB_HOST'[^;]*;/, `define('DB_HOST', '127.0.0.1:${i.port}');`).replace(/define\('DB_USER'[^;]*;/, "define('DB_USER', 'root');").replace(/define\('DB_PASS'[^;]*;/, `define('DB_PASS', '${pw}');`));
    const port = 18000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(P, "www")], { stdio: "ignore" });
    for (let k = 0; k < 40; k++) { try { await fetch(`http://127.0.0.1:${port}/robots.txt`); break; } catch (e) { await sleep(150); } }
    const U = (p) => `http://127.0.0.1:${port}/${p}`;
    const co = await (await fetch(U("checkout.php"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ slug: "sourdough-loaf", qty: 2, price: 0.01 }, { slug: "rye", qty: 1 }, { slug: "gone-cake", qty: 1 }, { slug: "nope", qty: 5 }], customer: { name: "Ann Lee", email: "ann@example.com", address: "1 Main St", city: "Perth" } }) })).json();
    check("checkout.php: the order taken - priced on the server from content.json (2 x 8.50 + the sale 6.00 = 23.00, the browser's 0.01 ignored), the sold-out and unknown ones left out", co.ok && /^ORD-\d{8}-[0-9A-F]{6}$/.test(co.number) && co.total === 23, co);
    const ords = (await DB.list("orders")).items, cl = (await DB.list("clients")).items;
    check("...it shows in the CRM's 🧾 Orders (its items) and 👤 Clients (made from the email)", ords[0].number === co.number && ords[0].items === "2 x Sourdough Loaf, 1 x Rye" && ords[0].status === "new" && cl.some((c) => c.email === "ann@example.com" && c.name === "Ann Lee"), { ords, cl });
    const bad = await fetch(U("checkout.php"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ slug: "rye", qty: 1 }], customer: { name: "X", email: "not-an-email" } }) });
    check("...a bad email refused (400)", bad.status === 400);
    // login
    const jar = {}; const req = async (p, form) => {
      const h = { Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }; if (form) h["Content-Type"] = "application/x-www-form-urlencoded";
      const r = await fetch(U(p), { method: form ? "POST" : "GET", headers: h, body: form ? new URLSearchParams(form).toString() : undefined, redirect: "manual" });
      for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) { const [kv] = c.split(";"); const [k, v] = kv.split("="); jar[k] = v; }
      return { status: r.status, loc: r.headers.get("location"), text: await r.text() };
    };
    const csrf = (t) => (/name="csrf" value="([0-9a-f]+)"/.exec(t) || [])[1];
    let pg = await req("register.php"); const t1 = csrf(pg.text);
    const noCsrf = await req("register.php", { name: "Pat", email: "pat@example.com", password: "a-long-password" });
    check("register.php: a form without its CSRF token refused", /out of date/.test(noCsrf.text));
    const reg = await req("register.php", { csrf: t1, name: "Pat Smith", email: "pat@example.com", password: "a-long-password" });
    const me = await req("account.php?me=1");
    check("register = logged in (→ account.php); account.php?me=1 says who", reg.status === 302 && reg.loc === "account.php" && JSON.parse(me.text).name === "Pat Smith");
    pg = await req("account.php"); const out = await req("logout.php", { csrf: csrf(pg.text) });
    const after = await req("account.php?me=1");
    check("logout (POST + CSRF) ends it", out.status === 302 && after.status === 401);
    pg = await req("login.php"); let lg = await req("login.php", { csrf: csrf(pg.text), email: "pat@example.com", password: "wrong-password!" });
    check("a wrong password refused", /do not match/.test(lg.text));
    lg = await req("login.php", { csrf: csrf(lg.text), email: "pat@example.com", password: "a-long-password", next: "account.php" });
    const acc = await req("account.php");
    check("login with the right one -> account.php with the member's name", lg.status === 302 && /Hello Pat Smith/.test(acc.text));
    const row = (await D.run("project", "shop_site", "SELECT email, pass_hash FROM bg_site_users")).results[0].rows[0];
    check("the password is stored hashed (bcrypt / argon), never as typed", row.email === "pat@example.com" && /^\$2y\$|^\$argon2/.test(row.pass_hash) && !row.pass_hash.includes("a-long-password"), row.email);
    for (let k = 0; k < 6; k++) { pg = await req("login.php"); lg = await req("login.php", { csrf: csrf(pg.text), email: "pat@example.com", password: "nope-nope-nope" }); }
    check("5 wrong tries = a 10-minute wait", /Too many tries/.test(lg.text));
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { if (srv) srv.kill(); try { await D.stop("project"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
