#!/usr/bin/env node
/* bitGen Studio — 2.848.0 units: 🔐 the website's admin area + its database (myadmin): lib/siteAdminSql.js (the tables, keys,
 * views, settings), lib/siteAdmin.js install (made when not there), lib/siteCal.install calls it, static/sitecal.js (days
 * closed on the website + hours edited there kept, bookings tied to clients), lib/siteAdminPhp.js (the login's safety:
 * hashes, lock-out, history, CSRF, session cookie, roles, prepared statements), lib/siteBuild.js (the files, the setup key
 * kept, only with a calendar or the tick), the studio's tick + the calendar's admin database field.
 * The real thing through PHP + MariaDB: test-848-live.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const AS = require(path.join(ROOT, "lib/siteAdminSql.js")), sql = AS.schemaSql({ business: "Happy Paws", tz: "Australia/Brisbane" });
  const names = AS.tableNames();
  const need = ["admin_users", "admin_login_history", "admin_audit_log", "settings", "clients", "pets", "staff", "client_records", "categories", "products", "product_categories", "product_images", "product_variants",
    "addresses", "shipping_methods", "coupons", "orders", "order_items", "order_status_history", "invoices", "invoice_items", "payments", "stock_movements", "reviews", "newsletter_subscribers"];
  check("myadmin: logins + their history + audit, settings, clients, pets, staff, records, and a whole shop (25 tables)", need.every((t) => names.includes(t)) && names.length === 25, names);
  const creates = sql.match(/CREATE TABLE IF NOT EXISTS \w+/g) || [];
  check("every table CREATE TABLE IF NOT EXISTS, InnoDB, utf8mb4 (run again = nothing lost)", creates.length === 25 && (sql.match(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/g) || []).length === 25 && !/DROP /i.test(sql));
  const order = names.reduce((m, n, i) => (m[n] = i, m), {});
  const refs = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE/g)].flatMap((m) => [...m[2].matchAll(/REFERENCES (\w+)\(id\)/g)].map((r) => [m[1], r[1]]));
  check("every foreign key points at a table made before it (or itself)", refs.length > 25 && refs.every(([t, r]) => order[r] !== undefined && order[r] <= order[t]), refs.filter(([t, r]) => !(order[r] <= order[t])));
  check("the login table: unique username, a password HASH (255), roles owner / admin / staff, failed tries + locked until; the history: who, ok, why, address, browser",
    /admin_users_username \(username\)/.test(sql) && /password_hash VARCHAR\(255\)/.test(sql) && /role ENUM\('owner','admin','staff'\)/.test(sql) && /failed_logins/.test(sql) && /locked_until DATETIME/.test(sql)
    && /admin_login_history[\s\S]*success TINYINT[\s\S]*reason[\s\S]*ip VARCHAR\(45\)[\s\S]*user_agent/.test(sql));
  check("clients for a vet / dentist / shop: names, company, unique email, phones, address, birth date, emergency contact, preferred contact, marketing, notes; pets (species, breed, microchip, weight); records (consultation, treatment, prescription, follow-up, vaccination)",
    /clients_email \(email\)/.test(sql) && /emergency_phone/.test(sql) && /preferred_contact/.test(sql) && /marketing_opt_in/.test(sql) && /microchip/.test(sql) && /weight_kg DECIMAL/.test(sql) && /'consultation','treatment','prescription','follow_up','vaccination'/.test(sql));
  check("the shop: products (SKU, prices, stock, tax), variants, categories (nested), orders (status + payment status + totals + shipping address), items, status history, payments, invoices, coupons, stock movements",
    /products_sku \(sku\)/.test(sql) && /sale_price/.test(sql) && /fk_categories_parent/.test(sql) && /payment_status ENUM/.test(sql) && /ship_postcode/.test(sql) && /fk_osh_order/.test(sql) && /'percent','fixed','free_shipping'/.test(sql) && /qty_change/.test(sql));
  check("4 views (client summary, low stock, sales by day, follow-ups) + the settings filled once (INSERT IGNORE - the business's name and time zone)", AS.viewNames().join() === "v_client_summary,v_low_stock,v_sales_by_day,v_follow_ups" && /INSERT IGNORE INTO settings[^;]*\('business_name', 'Happy Paws'\)[^;]*\('timezone', 'Australia\/Brisbane'\)/.test(sql));
  /* ---- install */
  const A = require(path.join(ROOT, "lib/siteAdmin.js")), ran = [];
  A.setDb({ databases: async () => ["site_x"], createDb: async (s, n) => ran.push(["create", s, n]), run: async (s, db, q) => { ran.push(["run", s, db]); return { results: [{ ok: true }] }; } });
  const i1 = await A.install({ scope: "global" });
  A.setDb({ databases: async () => ["myadmin"], createDb: async () => ran.push(["create again"]), run: async () => ({ results: [{ ok: true }] }) });
  const i2 = await A.install({ scope: "global" });
  A.setDb({ databases: async () => [], createDb: async () => {}, run: async () => ({ results: [{ ok: false, error: "denied", sql: "CREATE TABLE x" }] }) });
  let err = ""; try { await A.install({}); } catch (e) { err = e.message; }
  check("install: no database called myadmin = made (then its tables); there already = not made again, its tables run (nothing lost); a refusal said",
    i1.created === true && i1.db === "myadmin" && ran[0].join() === "create,global,myadmin" && i2.created === false && !ran.some((r) => r[0] === "create again") && /refused: denied/.test(err), { i1, i2, ran });
  const SCL = require(path.join(ROOT, "lib/siteCal.js")), ran2 = [];
  SCL.setDb({ databases: async () => [], createDb: async (s, n) => ran2.push(n), run: async (s, db) => { ran2.push("run " + db); return { results: [{ ok: true }] }; } });
  const ci = await SCL.install({ name: "Dental", db: { scope: "project", name: "site_dental", admin: "clinic_admin" } });
  check("a calendar's upload makes its admin database too (its name from the calendar - myadmin unless set)", ci.admin && ci.admin.ok && ci.admin.db === "clinic_admin" && ran2.includes("clinic_admin") && ran2.includes("run clinic_admin"), { admin: ci.admin, ran2 });
  /* ---- the calendar's tables */
  const SC = require(path.join(ROOT, "static/sitecal.js")), seed = SC.seedSql(SC.clean({ name: "Dental", closed: [{ day: "2026-12-24" }] })), seedF = SC.seedSql(SC.clean({ name: "Dental" }), { force: true });
  check("the calendar's upload keeps what the website's admin changed: hours + services only when not admin_edited (unless forced), only the studio's closed days replaced (INSERT IGNORE)",
    /DELETE FROM bg_cal_hours WHERE calendar_id = \(SELECT id FROM bg_calendars WHERE slug = 'dental' AND admin_edited = 0\)/.test(seed) && /DELETE FROM bg_cal_closed[^;]*AND source = 'studio'/.test(seed) && /INSERT IGNORE INTO bg_cal_closed[^;]*'studio'/.test(seed)
    && !/admin_edited = 0 WHERE/.test(seed) && /UPDATE bg_calendars SET admin_edited = 0 WHERE slug = 'dental'/.test(seedF));
  check("the calendar's schema + upgrade: closed days' source, admin_edited, bookings' client_id / admin_note / source", ["source VARCHAR(10) NOT NULL DEFAULT 'studio'", "admin_edited TINYINT(1)", "client_id INT UNSIGNED NULL", "admin_note VARCHAR(500)", "source VARCHAR(10) NOT NULL DEFAULT 'website'"].every((x) => SC.schemaSql().includes(x))
    && ["bg_cal_closed ADD COLUMN source", "bg_calendars ADD COLUMN admin_edited", "bg_cal_bookings ADD COLUMN client_id", "bg_cal_bookings ADD COLUMN admin_note"].every((x) => SC.upgradeSql().some((q) => q.includes(x))) && SC.clean({}).db.admin === "myadmin");
  /* ---- the PHP */
  const P = require(path.join(ROOT, "lib/siteAdminPhp.js")), lib = P.ADMIN_LIB, pages = P.ADMIN_PAGES;
  check("no JavaScript template holes in the PHP (no ${ and no back-ticks)", ["ADMIN_DB", "ADMIN_LIB", "ADMIN_PAGES", "ADMIN_INDEX"].every((k) => !/\$\{/.test(P[k]) && !P[k].includes("`")));
  check("the login: password_hash / password_verify (a dummy hash checked for an unknown user - the same time), rehash when needed, 5 wrong = locked 15 min, 20 wrong from one address = stopped, every try logged, a new session id on login",
    /password_verify\(\$password, \$u\['password_hash'\]\)/.test(lib) && /password_verify\(\$password, password_hash\('-'/.test(lib) && /password_needs_rehash/.test(lib) && /ADM_MAX_FAILS = 5/.test(lib) && /ADM_LOCK_MIN = 15/.test(lib) && /ADM_IP_FAILS = 20/.test(lib)
    && (lib.match(/adm_log_login\(/g) || []).length >= 7 && /session_regenerate_id\(true\); \$_SESSION\['adm_uid'\]/.test(lib));
  check("the session: its own cookie (bgadmin), httponly, SameSite, secure on https, 2 hours idle; frames refused, no caching; CSRF checked with hash_equals",
    /session_name\('bgadmin'\)/.test(lib) && /'httponly' => true, 'samesite' => 'Lax', 'secure' => \$https/.test(lib) && /ADM_IDLE = 7200/.test(lib) && /X-Frame-Options: DENY/.test(lib) && /hash_equals\(adm_csrf\(\)/.test(lib));
  const forms = (pages.match(/<form method="post"/g) || []).length + (pages.match(/<form class="card" method="post"/g) || []).length, withCsrf = (pages.match(/adm_csrf_field\(\)/g) || []).length;
  check("every POST form carries the CSRF token; every change goes through adm_post_ok", forms > 10 && withCsrf >= forms && (pages.match(/adm_post_ok\(\)/g) || []).length >= 10, { forms, withCsrf });
  check("no request value is put into SQL text (prepared statements; table + column names only from the page's own list)", !/(query|prepare)\([^;]*\.\s*\$_(GET|POST|REQUEST)/.test(pages + lib) && /\$sp = adm_spec\(\$t\); if \(!\$sp\) adm_go/.test(pages));
  check("the first owner only with the setup key while there is no login (in a transaction - never twice); roles owner > admin > staff; only an owner makes / changes an owner; you can't turn yourself off",
    /hash_equals\(ADMIN_SETUP_KEY/.test(pages) && /COUNT\(\*\) FROM admin_users FOR UPDATE/.test(pages) && /'owner' => 3/.test(lib) && /\$role === 'owner' && \$me\['role'\] !== 'owner'/.test(pages) && /\(int\)\$u\['id'\] !== \(int\)\$me\['id'\]/.test(pages));
  check("the pages: dashboard, bookings (approve / cancel e-mailed, phone booking, note), closed days, hours + services, clients (pets, records, bookings, orders), orders (status history), logins, login history, audit log, settings, my account",
    ["adm_p_dashboard", "adm_p_bookings", "adm_p_closed", "adm_p_hours", "adm_p_client", "adm_p_order", "adm_p_users", "adm_p_history", "adm_p_audit", "adm_p_settings", "adm_p_account", "adm_p_setup", "adm_p_login"].every((f) => pages.includes("function " + f + "("))
    && /booking confirmed/.test(pages) && /booking cancelled/.test(pages) && /source = 'admin'/.test(pages) && /admin_edited = 1/.test(pages));
  check("a booking (calendar widget) and a contact message make / find the client by email (bgadm_client)", /bgadm_client\(\$name, \$email, \$phone, 'booking'\)/.test(require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_WIDGET) && /bgadm_client\(\$name, \$email, '', 'contact'\)/.test(src("lib/siteBuild.js")) && /function bgadm_client/.test(P.ADMIN_DB));
  /* ---- the build */
  const B = require(path.join(ROOT, "lib/siteBuild.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t848-")); B.setDir(tmp);
  const page = (els) => ({ title: "Home", w: 1200, h: 800, bg: "#ffffff", els });
  B.save({ name: "Shop", title: "Bob's Shop", stack: "php", lang: "en", admin: true, pages: [page([{ kind: "text", text: "Hi", size: 30, color: "#111111", box: { x: 0, y: 0, w: 600, h: 40 } }])], assets: [] });
  const r1 = await B.build("Shop", { ai: false }), out = path.join(tmp, "Shop", "build");
  B.save({ name: "Shop", title: "Bob's Shop", stack: "php", lang: "en", pages: [page([{ kind: "text", text: "Hi", size: 30, color: "#111111", box: { x: 0, y: 0, w: 600, h: 40 } }])], assets: [] });
  const r2 = await B.build("Shop", { ai: false }), cfg = fs.readFileSync(path.join(out, "inc", "config.php"), "utf8");
  check("a PHP site with 🔐 ticked (no calendar) gets /admin/, admin-schema.sql and the setup key; the tick + the key kept on the next save / build; the site name in config.php",
    !!r1.admin && r1.admin.db === "myadmin" && fs.existsSync(path.join(out, "admin", "index.php")) && /CREATE TABLE IF NOT EXISTS admin_users/.test(fs.readFileSync(path.join(out, "admin-schema.sql"), "utf8")) && !!r2.admin && r2.admin.key === r1.admin.key && cfg.includes("define('SITE_NAME', 'Bob\\'s Shop');") && cfg.includes(r1.admin.key), { r1: r1.admin, r2: r2.admin });
  B.save({ name: "Plain", title: "Plain", stack: "php", lang: "en", pages: [page([])], assets: [] }); const r3 = await B.build("Plain", { ai: false });
  B.save({ name: "Stat", title: "Stat", stack: "static", lang: "en", admin: true, pages: [page([])], assets: [] }); const r4 = await B.build("Stat", { ai: false });
  check("no admin without the tick or a calendar; none on a static site", !r3.admin && !fs.existsSync(path.join(tmp, "Plain", "build", "admin")) && !r4.admin);
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ---- the studio */
  check("the studio: Build Website's 🔐 Admin area tick (sent with the save, remembered), the setup key said; 📅 Calendar Settings ▸ Database: the admin database's name + Replace the hours edited on the website; POST /api/siteadmin/install (routes/siteCal.js, not server.js)",
    /id="siteAdmin"/.test(src("ext/imageeditdock/pcsite.js")) && /admin: !!a\.admin/.test(src("ext/imageeditdock/pcsite.js")) && /setup key \$\{r\.admin\.key\}/.test(src("ext/imageeditdock/pcsite.js"))
    && /id="pccAdminDb"/.test(src("ext/imageeditdock/pccalendar.js")) && /id="pccForce"/.test(src("ext/imageeditdock/pccalendar.js")) && /\/api\/siteadmin\/install/.test(src("routes/siteCal.js")) && !/siteadmin/i.test(src("misc/server.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
