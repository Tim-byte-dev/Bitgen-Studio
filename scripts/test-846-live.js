#!/usr/bin/env node
/* bitGen Studio — 2.846.0 LIVE: 📅 a REAL booking through the website's PHP against bitGen's MariaDB - the calendar's tables
 * made by lib/siteCal.install, the site built by lib/siteBuild (PHP + MySQL), php -S serving it: the month, a day's free
 * times, the form (CSRF token), booked, the same time refused, a wrong token refused, one row, 📅 Bookings lists it.
 * Needs MariaDB (with its install script) and PHP with pdo_mysql - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const SC = require(path.join(ROOT, "static/sitecal.js")), SCL = require(path.join(ROOT, "lib/siteCal.js")), B = require(path.join(ROOT, "lib/siteBuild.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  const phpLint = spawnSync("php", ["-l"], { input: require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_WIDGET, encoding: "utf8" });
  if (phpLint.error) console.log("SKIP: no PHP here - php -l"); else check("inc/calendar.php is valid PHP (php -l)", phpLint.status === 0, phpLint.stdout + phpLint.stderr);
  const cal = SC.clean({ name: "Dr O'Neil's clinic", slot: 30, cap: 1, weekStart: 1 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t846l-")); B.setDir(tmp);
  B.save({ name: "Clinic", title: "Clinic", stack: "php", lang: "en", pages: [{ title: "Book", w: 1200, h: 900, bg: "#ffffff", els: [{ kind: "calendar", cal, box: { x: 300, y: 100, w: 480, h: 520 } }] }], assets: [] });
  await B.build("Clinic", { ai: false });
  const out = path.join(tmp, "Clinic", "build");
  /* ---- LIVE: MariaDB + PHP -> a booking through the website */
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || php.status !== 0 || !/pdo_mysql/.test(php.stdout)) console.log("SKIP: no MariaDB (with its install script) or PHP with pdo_mysql here - the live booking");
  else {
    const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "t846d-")); D.setBase(tmpd, path.join(tmpd, "projects", "p1", "db"));
    let srv = null;
    try {
      SCL.setDb(D);
      const liveCal = Object.assign({}, cal, { tz: "UTC", days: 400, lead: 0, hours: [0, 1, 2, 3, 4, 5, 6].map(() => [["00:00", "24:00"]]), db: { scope: "global", name: "site_clinic" } });
      await SCL.install(liveCal); await SCL.install(liveCal);   // twice = updated, no error
      const st = D.status().scopes.global;
      await D.run("global", "site_clinic", "CREATE USER IF NOT EXISTS 'web'@'127.0.0.1' IDENTIFIED BY 'webpw'; GRANT ALL ON site_clinic.* TO 'web'@'127.0.0.1'; FLUSH PRIVILEGES;");
      const port = 18000 + Math.floor(Math.random() * 1000);
      srv = spawn("php", ["-S", "127.0.0.1:" + port, "-t", out], { env: Object.assign({}, process.env, { DB_HOST: "127.0.0.1;port=" + st.port, DB_NAME: "site_clinic", DB_USER: "web", DB_PASS: "webpw" }), stdio: "ignore" });
      await new Promise((r) => setTimeout(r, 800));
      const jar = {};
      const req = (method, p, body) => new Promise((ok, no) => {
        const h = { Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }; if (body) { h["Content-Type"] = "application/x-www-form-urlencoded"; h["Content-Length"] = Buffer.byteLength(body); }
        const rq = http.request({ host: "127.0.0.1", port, path: p, method, headers: h }, (res) => { for (const c of res.headers["set-cookie"] || []) { const [kv] = c.split(";"); const [k, v] = kv.split("="); jar[k] = v; } let s = ""; res.on("data", (d) => { s += d; }); res.on("end", () => ok({ status: res.statusCode, body: s })); });
        rq.on("error", no); if (body) rq.write(body); rq.end();
      });
      const d = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
      const m1 = await req("GET", "/index.php");
      check("LIVE: the page shows the calendar - this month, days you can book as links", m1.status === 200 && /class="bgcal bgcal-dr-o-neil-s-clinic"/.test(m1.body) && /class="bgcal-day open[^"]*" href="[^"]*d=\d{4}-\d{2}-\d{2}/.test(m1.body), m1.body.slice(0, 400));
      const dayP = await req("GET", `/index.php?cal=dr-o-neil-s-clinic&d=${d}`);
      check("LIVE: a day's free times (48 half hours, open all day)", (dayP.body.match(/class="bgcal-slot"/g) || []).length === 48, (dayP.body.match(/bgcal-slot/g) || []).length);
      const formP = await req("GET", `/index.php?cal=dr-o-neil-s-clinic&d=${d}&t=10:00`), tok = (/name="token" value="([0-9a-f]+)"/.exec(formP.body) || [])[1];
      const body = (t) => `cal=dr-o-neil-s-clinic&d=${d}&t=10:00&token=${t}&name=Tim&email=tim%40example.com&phone=0400&notes=first+visit`;
      const b1 = await req("POST", `/index.php?cal=dr-o-neil-s-clinic&d=${d}&t=10:00`, body(tok));
      check("LIVE: the form (CSRF token) books 10:00 - said on the page, the row in bg_cal_bookings", !!tok && /Booked: [^<]* at 10:00/.test(b1.body), b1.body.match(/bgcal-msg[^<]*<|Booked[^<]*/) || b1.body.slice(-300));
      const formQ = await req("GET", `/index.php?cal=dr-o-neil-s-clinic&d=${d}&t=10:00`), tok2 = (/name="token" value="([0-9a-f]+)"/.exec(formQ.body) || [])[1];
      const b2 = await req("POST", `/index.php?cal=dr-o-neil-s-clinic&d=${d}&t=10:00`, body(tok2));
      const bad = await req("POST", `/index.php?cal=dr-o-neil-s-clinic&d=${d}&t=11:00`, `cal=dr-o-neil-s-clinic&d=${d}&t=11:00&token=nope&name=X&email=x%40y.z`);
      const rows = (await D.run("global", "site_clinic", "SELECT name, email, DATE_FORMAT(starts_at, '%H:%i') AS t FROM bg_cal_bookings")).results[0].rows;
      check("LIVE: the same time again = taken (not booked twice); a wrong token refused; one row in the database", /just been taken/.test(b2.body) && /expired/.test(bad.body) && rows.length === 1 && rows[0].t === "10:00" && rows[0].email === "tim@example.com", rows);
      const again = await req("GET", `/index.php?cal=dr-o-neil-s-clinic&d=${d}`);
      check("LIVE: the day now shows 10:00 as taken", /<span class="bgcal-slot taken">10:00<\/span>/.test(again.body));
      const bk = await SCL.bookings(liveCal);
      check("LIVE: lib/siteCal.bookings lists it (📅 Calendar Settings ▸ Bookings)", bk.rows.length === 1 && bk.rows[0].name === "Tim", bk);
    } catch (e) { fail++; console.log("FAIL: LIVE " + (e.stack || e)); }
    finally { if (srv) srv.kill(); try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmpd, { recursive: true, force: true }); }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
