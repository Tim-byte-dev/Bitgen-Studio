#!/usr/bin/env node
/* bitGen Studio — 2.848.0 LIVE: 🔐 the built website's admin area through PHP against bitGen's MariaDB.
 * The calendar's upload makes the admin database "myadmin" (25 tables + 4 views); /admin/ first = the owner set up with the
 * setup key (a wrong key refused); a visitor's booking makes its client; approve (e-mail) / cancel / a phone booking / a form
 * without its CSRF token refused; closed days + hours edited on the website survive the calendar's next upload; clients,
 * pets, records, products (the web name made, a used SKU refused); a staff login can't open logins / products; five wrong
 * passwords lock a login (every try in the login history); a contact message makes a client.
 * Needs MariaDB (with its install script) and PHP with pdo_mysql - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const SC = require(path.join(ROOT, "static/sitecal.js")), SCL = require(path.join(ROOT, "lib/siteCal.js")), B = require(path.join(ROOT, "lib/siteBuild.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const dayOf = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
(async () => {
  const P = require(path.join(ROOT, "lib/siteAdminPhp.js"));
  const lint = ["ADMIN_DB", "ADMIN_LIB", "ADMIN_PAGES", "ADMIN_INDEX"].map((k) => spawnSync("php", ["-l"], { input: P[k], encoding: "utf8" }));
  if (lint[0].error) { console.log("SKIP: no PHP here"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); return; }
  check("the admin's PHP files are valid PHP (php -l)", lint.every((r) => r.status === 0), lint.map((r) => r.stdout + r.stderr));
  const d = dayOf(3), shut = dayOf(5);
  const cal = SC.clean({ name: "Vet", slot: 30, cap: 1, approve: true, emails: true, owner: "owner@example.com", from: "vet@example.com", services: [{ name: "Check-up", mins: 30 }],
    closed: [{ day: shut, reason: "Studio day" }], tz: "UTC", days: 400, lead: 0, hours: [0, 1, 2, 3, 4, 5, 6].map(() => [["09:00", "17:00"]]), mode: "booking" });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t848l-")); B.setDir(tmp);
  B.save({ name: "Vet", title: "Happy Paws Vet", stack: "php", lang: "en", pages: [{ title: "Book", w: 1200, h: 900, bg: "#ffffff", els: [{ kind: "calendar", cal, box: { x: 300, y: 100, w: 480, h: 520 } }] }], assets: [] });
  const built = await B.build("Vet", { ai: false }), out = path.join(tmp, "Vet", "build");
  check("the build: /admin/ (index.php + admin.css), inc/admin.php + admin_pages.php + admindb.php, admin-schema.sql, the setup key in config.php + README",
    !!built.admin && built.admin.db === "myadmin" && /^[A-Za-z0-9]{20}$/.test(built.admin.key) && ["admin/index.php", "admin/admin.css", "inc/admin.php", "inc/admin_pages.php", "inc/admindb.php", "admin-schema.sql"].every((f) => fs.existsSync(path.join(out, f)))
    && fs.readFileSync(path.join(out, "inc/config.php"), "utf8").includes(built.admin.key) && fs.readFileSync(path.join(out, "README.txt"), "utf8").includes(built.admin.key), built.admin);
  const again = await B.build("Vet", { ai: false });
  check("the setup key is kept from build to build", again.admin.key === built.admin.key);
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || php.status !== 0 || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB or PHP with pdo_mysql here - the live admin"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "t848d-")); D.setBase(tmpd, path.join(tmpd, "projects", "p1", "db"));
  const mailF = path.join(tmpd, "mail.txt"); fs.writeFileSync(mailF, "");
  let srv = null;
  try {
    SCL.setDb(D);
    const liveCal = Object.assign({}, cal, { db: { scope: "global", name: "site_vet" } });
    const inst = await SCL.install(liveCal);
    const adm = (sql) => D.run("global", "myadmin", sql).then((r) => r.results[0].rows || []);
    const site = (sql) => D.run("global", "site_vet", sql).then((r) => r.results[0].rows || []);
    const tabs = await adm("SHOW FULL TABLES");
    check("the calendar's upload made the admin database myadmin when it was not there (25 tables + 4 views)", inst.admin && inst.admin.ok && inst.admin.created === true && tabs.length === 29, { admin: inst.admin, n: tabs.length });
    const st = D.status().scopes.global;
    await D.run("global", "site_vet", "CREATE USER IF NOT EXISTS 'web'@'127.0.0.1' IDENTIFIED BY 'webpw'; GRANT ALL ON site_vet.* TO 'web'@'127.0.0.1'; GRANT ALL ON myadmin.* TO 'web'@'127.0.0.1'; FLUSH PRIVILEGES;");
    const port = 20000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-d", `sendmail_path=cat >> ${mailF}`, "-S", "127.0.0.1:" + port, "-t", out], { env: Object.assign({}, process.env, { DB_HOST: "127.0.0.1;port=" + st.port, DB_NAME: "site_vet", DB_USER: "web", DB_PASS: "webpw" }), stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 900));
    const mkReq = (jar) => (method, p, body) => new Promise((ok, no) => {
      const h = { Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }; if (body) { h["Content-Type"] = "application/x-www-form-urlencoded"; h["Content-Length"] = Buffer.byteLength(body); }
      const rq = http.request({ host: "127.0.0.1", port, path: p, method, headers: h }, (res) => { for (const c of res.headers["set-cookie"] || []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); } let s = ""; res.on("data", (x) => { s += x; }); res.on("end", () => ok({ status: res.statusCode, body: s, loc: res.headers.location || "" })); });
      rq.on("error", no); if (body) rq.write(body); rq.end();
    });
    const form = (o) => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    const csrfOf = (b) => (/name="csrf" value="([0-9a-f]+)"/.exec(b) || [])[1] || "";
    const owner = mkReq({}), visitor = mkReq({}), staffR = mkReq({});
    /* ---- the first owner */
    const s0 = await owner("GET", "/admin/");
    const bad = await owner("POST", "/admin/?p=setup", form({ csrf: csrfOf(s0.body), key: "nope", username: "owner", email: "o@example.com", password: "a-long-password", password2: "a-long-password" }));
    const s1 = await owner("GET", "/admin/");
    const ok = await owner("POST", "/admin/?p=setup", form({ csrf: csrfOf(s1.body), key: built.admin.key, username: "owner", full_name: "Olive Owner", email: "o@example.com", password: "a-long-password", password2: "a-long-password" }));
    const dash = await owner("GET", "/admin/index.php?p=dashboard");
    const users = await adm("SELECT username, role, password_hash FROM admin_users");
    check("/admin/ first = Set up the admin; a wrong setup key refused; the right one makes the OWNER (a password hash, never the password) and logs in -> the dashboard",
      /Set up the admin/.test(s0.body) && /not the setup key/.test(bad.body) && ok.status === 302 && /Dashboard/.test(dash.body) && /Welcome/.test(dash.body) && users.length === 1 && users[0].role === "owner" && /^\$2y\$/.test(users[0].password_hash) && !users[0].password_hash.includes("a-long-password"), { s0: s0.body.slice(0, 200), dash: dash.body.slice(0, 300) });
    const s2 = await mkReq({})("GET", "/admin/");
    check("once there is a login, /admin/ is the login page (the template: business name, username, password)", /<h1>Log in<\/h1>/.test(s2.body) && /Happy Paws Vet/.test(s2.body) && /autocomplete="current-password"/.test(s2.body), s2.body.slice(0, 300));
    /* ---- a visitor books -> a client */
    const U = (q) => "/index.php?cal=vet&" + q;
    const f1 = await visitor("GET", U(`d=${d}&s=0&t=10:00`));
    await visitor("POST", U(`d=${d}&s=0&t=10:00`), form({ cal: "vet", act: "book", d, t: "10:00", s: 0, token: (/name="token" value="([0-9a-f]+)"/.exec(f1.body) || [])[1], name: "Tim Paul", email: "Tim@Example.com", phone: "0400 000 000" }));
    const cl = await adm("SELECT id, first_name, last_name, email, phone, source FROM clients");
    const bk = await site("SELECT id, status, client_id FROM bg_cal_bookings");
    check("a visitor's booking makes its client in myadmin (by email, lower case; name split; phone; source booking) and the booking points at it", cl.length === 1 && cl[0].email === "tim@example.com" && cl[0].first_name === "Tim" && cl[0].last_name === "Paul" && cl[0].source === "booking" && bk.length === 1 && bk[0].status === "pending" && +bk[0].client_id === +cl[0].id, { cl, bk });
    const dash2 = await owner("GET", "/admin/index.php?p=dashboard");
    check("the dashboard counts the booking waiting for approval and lists it", /<b>1<\/b><span>Waiting for approval/.test(dash2.body) && /Tim Paul/.test(dash2.body));
    /* ---- approve / CSRF / cancel / a phone booking */
    const bp = await owner("GET", "/admin/index.php?p=bookings");
    await owner("POST", "/admin/index.php?p=bookings", form({ csrf: csrfOf(bp.body), act: "approve", id: bk[0].id }));
    const bk2 = (await site("SELECT status FROM bg_cal_bookings"))[0], mail = fs.readFileSync(mailF, "utf8");
    check("✓ Approve: booked, the visitor e-mailed (confirmed), in the audit log", bk2.status === "booked" && mail.includes(Buffer.from("Vet: booking confirmed").toString("base64")) && (await adm("SELECT action FROM admin_audit_log WHERE action = 'booking approve'")).length === 1, { bk2 });
    const forged = await owner("POST", "/admin/index.php?p=bookings", form({ act: "cancel", id: bk[0].id }));
    check("a form without its CSRF token changes nothing", (await site("SELECT status FROM bg_cal_bookings"))[0].status === "booked" && forged.status === 302);
    const bp2 = await owner("GET", "/admin/index.php?p=bookings");
    await owner("POST", "/admin/index.php?p=bookings", form({ csrf: csrfOf(bp2.body), act: "cancel", id: bk[0].id }));
    await owner("POST", "/admin/index.php?p=bookings", form({ csrf: csrfOf(bp2.body), act: "add", calendar_id: (await site("SELECT id FROM bg_calendars"))[0].id, d, t: "14:00", minutes: 45, service: "Vaccination", name: "Ann Lee", email: "ann@example.com", phone: "0411" }));
    const rows = await site("SELECT name, status, source, client_id, TIMESTAMPDIFF(MINUTE, starts_at, ends_at) AS m FROM bg_cal_bookings ORDER BY id");
    check("✕ Cancel = cancelled; ＋ a phone booking = booked (source admin, 45 min) with its client made", rows[0].status === "cancelled" && rows[1].name === "Ann Lee" && rows[1].status === "booked" && rows[1].source === "admin" && +rows[1].m === 45 && !!rows[1].client_id, rows);
    /* ---- closed days + hours survive the next upload */
    const cp = await owner("GET", "/admin/index.php?p=closed"), calId = (await site("SELECT id FROM bg_calendars"))[0].id, x1 = dayOf(10), x2 = dayOf(11);
    await owner("POST", "/admin/index.php?p=closed", form({ csrf: csrfOf(cp.body), act: "add", calendar_id: calId, d1: x1, d2: x2, reason: "Conference" }));
    const hp = await owner("GET", "/admin/index.php?p=hours");
    const hf = { csrf: csrfOf(hp.body), slot: 30, cap: 1, buffer: 0, maxday: 0, cancel: 24, notify: "owner@example.com", approve: 1, emails: 1, "sv[0][name]": "Check-up", "sv[0][mins]": 30, "sv[1][name]": "Desexing", "sv[1][mins]": 120 };
    for (const dd of [0, 2, 3, 4, 5, 6]) { hf[`open[${dd}]`] = 1; hf[`h[${dd}][0][0]`] = "08:00"; hf[`h[${dd}][0][1]`] = "12:00"; }
    await owner("POST", "/admin/index.php?p=hours", form(hf));
    await SCL.install(liveCal);   // the studio uploads the calendar again
    const closed = await site("SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, source FROM bg_cal_closed ORDER BY day"), hrs = await site("SELECT weekday, TIME_FORMAT(opens, '%H:%i') o FROM bg_cal_hours ORDER BY weekday"), svc = await site("SELECT name FROM bg_cal_services ORDER BY sort");
    check("days closed on the website (a range, source admin) and its hours + services (Monday shut, 8-12, Desexing) are KEPT when the studio uploads the calendar again; the studio's own closed day too",
      closed.some((r) => r.day === x1 && r.source === "admin") && closed.some((r) => r.day === x2 && r.source === "admin") && closed.some((r) => r.day === shut && r.source === "studio") && !hrs.some((r) => +r.weekday === 1) && hrs.every((r) => r.o === "08:00") && svc.map((r) => r.name).join() === "Check-up,Desexing", { closed, hrs, svc });
    await SCL.install(Object.assign({}, liveCal, { forceHours: true }));
    const hrs2 = await site("SELECT weekday FROM bg_cal_hours WHERE weekday = 1");
    check("…unless the studio is told to replace them (forceHours)", hrs2.length === 1 && +(await site("SELECT admin_edited FROM bg_calendars"))[0].admin_edited === 0);
    /* ---- clients, pets, records, products */
    const cls = await owner("GET", "/admin/index.php?p=t&t=clients&q=tim");
    const cv = await owner("GET", "/admin/index.php?p=client&id=" + cl[0].id);
    check("Clients: the search finds Tim; his page shows his bookings", /tim@example\.com/.test(cls.body) && !/ann@example\.com/.test(cls.body) && /Tim Paul/.test(cv.body) && /cancelled/.test(cv.body), cls.body.slice(-600));
    const pe = await owner("GET", `/admin/index.php?p=e&t=pets&client_id=${cl[0].id}`);
    const pr = await owner("POST", `/admin/index.php?p=e&t=pets&client_id=${cl[0].id}`, form({ csrf: csrfOf(pe.body), client_id: cl[0].id, name: "Rex", species: "Dog", breed: "Kelpie", sex: "male", desexed: 1, weight_kg: "21.5", microchip: "956000012345678", active: 1 }));
    const re = await owner("GET", `/admin/index.php?p=e&t=client_records&client_id=${cl[0].id}`), petId = (await adm("SELECT id FROM pets"))[0].id;
    await owner("POST", `/admin/index.php?p=e&t=client_records`, form({ csrf: csrfOf(re.body), client_id: cl[0].id, pet_id: petId, kind: "vaccination", title: "C5 booster", body: "Given left shoulder.", follow_up_on: dayOf(365) }));
    const pets = await adm("SELECT name, weight_kg, desexed FROM pets"), recs = await adm("SELECT kind, title, created_by FROM client_records"), fu = await adm("SELECT pet FROM v_follow_ups");
    check("Pets + records: Rex (21.5 kg, desexed) and a vaccination record by the owner, its follow-up in v_follow_ups", pr.status === 302 && pets[0].name === "Rex" && +pets[0].weight_kg === 21.5 && +pets[0].desexed === 1 && recs[0].kind === "vaccination" && +recs[0].created_by === 1 && fu[0].pet === "Rex", { pets, recs, fu });
    const ppg = await owner("GET", "/admin/index.php?p=e&t=products");
    await owner("POST", "/admin/index.php?p=e&t=products", form({ csrf: csrfOf(ppg.body), sku: "DOG-FOOD-5", name: "Dry Dog Food 5 kg", price: "49.95", stock: 3, track_stock: 1, active: 1 }));
    const dup = await owner("POST", "/admin/index.php?p=e&t=products", form({ csrf: csrfOf(ppg.body), sku: "DOG-FOOD-5", name: "Another", price: "1", active: 1 }));
    const prods = await adm("SELECT slug, price FROM products"), low = await adm("SELECT name FROM v_low_stock");
    check("Products: the web name made from the name, a used SKU refused in words, low stock in v_low_stock", prods.length === 1 && prods[0].slug === "dry-dog-food-5-kg" && +prods[0].price === 49.95 && /already used/.test(dup.body) && low[0].name === "Dry Dog Food 5 kg", { prods, dup: (dup.body.match(/msg bad[^<]*<?[^<]*/) || [])[0] });
    /* ---- logins: staff, roles, lock-out, history */
    const up = await owner("GET", "/admin/index.php?p=users");
    await owner("POST", "/admin/index.php?p=users", form({ csrf: csrfOf(up.body), act: "add", username: "sam", full_name: "Sam Staff", email: "sam@example.com", role: "staff", password: "sam-password-1" }));
    const lg = await staffR("GET", "/admin/");
    const li = await staffR("POST", "/admin/index.php?p=login", form({ csrf: csrfOf(lg.body), username: "sam", password: "sam-password-1" }));
    const su = await staffR("GET", "/admin/index.php?p=users"), sp = await staffR("GET", "/admin/index.php?p=t&t=products"), sc = await staffR("GET", "/admin/index.php?p=t&t=clients");
    check("a STAFF login: logs in, can see clients, can't open Logins or Products (403)", li.status === 302 && su.status === 403 && sp.status === 403 && sc.status === 200 && !/p=users/.test(sc.body), { li: li.status, su: su.status, sp: sp.status });
    const attacker = mkReq({}); let last = null;
    for (let i = 0; i < 5; i++) { const g = await attacker("GET", "/admin/"); last = await attacker("POST", "/admin/index.php?p=login", form({ csrf: csrfOf(g.body), username: "sam", password: "wrong-" + i })); }
    const g2 = await attacker("GET", "/admin/"), right = await attacker("POST", "/admin/index.php?p=login", form({ csrf: csrfOf(g2.body), username: "sam", password: "sam-password-1" }));
    const hist = await adm("SELECT success, reason FROM admin_login_history WHERE username = 'sam' ORDER BY id");
    check("five wrong passwords lock the login (the 5th says so); then even the right one is refused while locked; every try in admin_login_history",
      /locked for a while/.test(last.body) && right.status === 200 && /locked for a while/.test(right.body) && hist.filter((h) => +h.success === 0).length === 6 && hist.some((h) => h.reason === "wrong password - locked") && hist.some((h) => +h.success === 1), hist);
    const lh = await owner("GET", "/admin/index.php?p=history");
    check("Login history (owner): every login and failed try with its reason and address", /failed: wrong password - locked/.test(lh.body) && /127\.0\.0\.1/.test(lh.body));
    /* ---- the contact form makes a client */
    await D.run("global", "site_vet", fs.readFileSync(path.join(out, "schema.sql"), "utf8"));   // the site's own tables (messages) as a host imports them
    await visitor("POST", "/contact.php", form({ name: "Cleo Contact", email: "cleo@example.com", message: "Do you see cats?" }));
    check("a contact message makes a client (source contact)", (await adm("SELECT source FROM clients WHERE email = 'cleo@example.com'"))[0].source === "contact");
    const lo = await owner("GET", "/admin/index.php?p=dashboard");
    await owner("POST", "/admin/index.php?p=logout", form({ csrf: csrfOf(lo.body) }));
    const after = await owner("GET", "/admin/index.php?p=dashboard");
    check("Log out ends the session (the dashboard asks to log in again)", /<h1>Log in<\/h1>/.test(after.body));
  } catch (e) { fail++; console.log("FAIL: LIVE " + (e.stack || e)); }
  finally { if (srv) srv.kill(); try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmpd, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
