#!/usr/bin/env node
/* bitGen Studio — 2.847.0 LIVE: 📅 the rest of the booking features through the website's PHP against bitGen's MariaDB:
 * a 2.846.0 database upgraded in place (the new columns), services (a choice -> its length), the buffer round bookings,
 * the most a day, a closed day, approval (waiting), the manage link (see / ⤓ .ics / ✕ cancel, the cancel hours), e-mails to
 * the visitor and the owner (PHP mail() -> a sendmail stand-in). Needs MariaDB (with its install script) and PHP with
 * pdo_mysql - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const SC = require(path.join(ROOT, "static/sitecal.js")), SCL = require(path.join(ROOT, "lib/siteCal.js")), B = require(path.join(ROOT, "lib/siteBuild.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const dayOf = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
(async () => {
  const icsLint = spawnSync("php", ["-l"], { input: require(path.join(ROOT, "lib/siteCalPhp.js")).PHP_ICS, encoding: "utf8" });
  if (icsLint.error) { console.log("SKIP: no PHP here"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); return; }
  check("bgcal-ics.php is valid PHP (php -l)", icsLint.status === 0, icsLint.stdout + icsLint.stderr);
  const d = dayOf(3), shut = dayOf(4);
  const cal = SC.clean({ name: "Salon", slot: 30, cap: 1, buffer: 15, maxDay: 2, approve: true, cancelHours: 1, emails: true, owner: "owner@example.com", from: "shop@example.com",
    services: [{ name: "Cut", mins: 60, price: "$40" }, { name: "Trim", mins: 30 }], closed: [{ day: shut, reason: "Holiday" }],
    tz: "UTC", days: 400, lead: 0, hours: [0, 1, 2, 3, 4, 5, 6].map(() => [["09:00", "17:00"]]), mode: "booking" });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t847l-")); B.setDir(tmp);
  B.save({ name: "Salon", title: "Salon", stack: "php", lang: "en", pages: [{ title: "Book", w: 1200, h: 900, bg: "#ffffff", els: [{ kind: "calendar", cal, box: { x: 300, y: 100, w: 480, h: 520 } }] }], assets: [] });
  await B.build("Salon", { ai: false });
  const out = path.join(tmp, "Salon", "build");
  check("the build has bgcal-ics.php next to the pages", fs.existsSync(path.join(out, "bgcal-ics.php")) && /bgcal_ics\(/.test(fs.readFileSync(path.join(out, "bgcal-ics.php"), "utf8")));
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || php.status !== 0 || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB (with its install script) or PHP with pdo_mysql here - the live bookings"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "t847d-")); D.setBase(tmpd, path.join(tmpd, "projects", "p1", "db"));
  const mailF = path.join(tmpd, "mail.txt"); fs.writeFileSync(mailF, "");
  let srv = null;
  try {
    SCL.setDb(D);
    const liveCal = Object.assign({}, cal, { db: { scope: "global", name: "site_salon" } });
    /* a 2.846.0 database first (its schema from git), then this version's install upgrades it */
    const old = spawnSync("git", ["show", "b563762:static/sitecal.js"], { cwd: ROOT, encoding: "utf8" });
    if (old.status === 0) {
      const oldF = path.join(tmpd, "sitecal846.js"); fs.writeFileSync(oldF, old.stdout); const O = require(oldF);
      await D.createDb("global", "site_salon"); await D.run("global", "site_salon", O.schemaSql() + "\n" + O.seedSql(O.clean(liveCal)));
    } else console.log("SKIP: no git history here - the upgrade from 2.846.0");
    const inst = await SCL.install(liveCal); await SCL.install(liveCal);
    const cols = (await D.run("global", "site_salon", "SHOW COLUMNS FROM bg_cal_bookings")).results[0].rows.map((r) => r.Field);
    check("install: a 2.846.0 database upgraded in place (service + token + cancelled_at on the bookings; the services table) - twice = no error", inst.ok && ["service", "token", "cancelled_at"].every((c) => cols.includes(c)) && inst.tables.includes("bg_cal_services"), cols);
    const st = D.status().scopes.global;
    await D.run("global", "site_salon", "CREATE USER IF NOT EXISTS 'web'@'127.0.0.1' IDENTIFIED BY 'webpw'; GRANT ALL ON site_salon.* TO 'web'@'127.0.0.1'; FLUSH PRIVILEGES;");
    const port = 19000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-d", `sendmail_path=cat >> ${mailF}`, "-S", "127.0.0.1:" + port, "-t", out], { env: Object.assign({}, process.env, { DB_HOST: "127.0.0.1;port=" + st.port, DB_NAME: "site_salon", DB_USER: "web", DB_PASS: "webpw" }), stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 800));
    const jar = {};
    const req = (method, p, body) => new Promise((ok, no) => {
      const h = { Cookie: Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ") }; if (body) { h["Content-Type"] = "application/x-www-form-urlencoded"; h["Content-Length"] = Buffer.byteLength(body); }
      const rq = http.request({ host: "127.0.0.1", port, path: p, method, headers: h }, (res) => { for (const c of res.headers["set-cookie"] || []) { const [kv] = c.split(";"); const [k, v] = kv.split("="); jar[k] = v; } let s = ""; res.on("data", (x) => { s += x; }); res.on("end", () => ok({ status: res.statusCode, body: s, type: res.headers["content-type"] || "" })); });
      rq.on("error", no); if (body) rq.write(body); rq.end();
    });
    const U = (q) => "/index.php?cal=salon&" + q;
    const tokOf = (b) => (/name="token" value="([0-9a-f]+)"/.exec(b) || [])[1];
    const taken = (b) => [...b.matchAll(/<span class="bgcal-slot taken">(\d\d:\d\d)<\/span>/g)].map((m) => m[1]);
    const free = (b) => [...b.matchAll(/<a class="bgcal-slot[^"]*" href="[^"]*t=(\d\d(?:%3A|:)\d\d)[^"]*">/g)].map((m) => m[1].replace("%3A", ":"));
    const book = async (s, t, name, email) => {
      const f1 = await req("GET", U(`d=${d}&s=${s}&t=${t}`)), tk = tokOf(f1.body);
      return req("POST", U(`d=${d}&s=${s}&t=${t}`), `cal=salon&act=book&d=${d}&t=${t}&s=${s}&token=${tk}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`);
    };
    const month = await req("GET", "/index.php");
    check("the month: the closed day is not a link (no free time), the others are", month.status === 200 && !month.body.includes(`d=${shut}`) && /class="bgcal-day open[^"]*" href=/.test(month.body), month.body.slice(0, 300));
    const dayP = await req("GET", U(`d=${d}`));
    check("a day with services: choose one first (Cut · 60 min · $40, Trim · 30 min)", /Cut · 60 min · \$40/.test(dayP.body) && /Trim · 30 min/.test(dayP.body) && !/name="token"/.test(dayP.body), dayP.body.slice(-600));
    const cutP = await req("GET", U(`d=${d}&s=0`));
    check("Cut (60 min): its times end by closing (09:00 … 16:00 = 15)", free(cutP.body).length === 15 && free(cutP.body)[14] === "16:00", free(cutP.body));
    const b1 = await book(0, "10:00", "Tim", "tim@example.com");
    const r1 = (await D.run("global", "site_salon", "SELECT status, service, token, DATE_FORMAT(starts_at, '%H:%i') AS s, DATE_FORMAT(ends_at, '%H:%i') AS e FROM bg_cal_bookings")).results[0].rows;
    check("approval on: the booking waits (pending), the service's length (10:00 – 11:00), a 32-hex manage token; the page links to it",
      /waiting for confirmation/.test(b1.body) && r1.length === 1 && r1[0].status === "pending" && r1[0].service === "Cut" && r1[0].s === "10:00" && r1[0].e === "11:00" && /^[0-9a-f]{32}$/.test(r1[0].token) && b1.body.includes("b=" + r1[0].token), { r1, msg: (b1.body.match(/bgcal-msg[^<]*/) || [])[0] });
    const tok1 = r1[0].token;
    const mail1 = fs.readFileSync(mailF, "utf8");
    check("e-mails: the visitor (received + the manage link) and the owner (to confirm), From the shop's address", /To: tim@example\.com/.test(mail1) && /To: owner@example\.com/.test(mail1) && /From: shop@example\.com/.test(mail1) && mail1.includes("b=" + tok1) && mail1.includes(Buffer.from("Salon: booking received").toString("base64")), mail1.slice(0, 600));
    const trimP = await req("GET", U(`d=${d}&s=1`));
    check("the buffer (15 min) round 10:00 – 11:00: Trim's 09:30 … 11:00 taken, 09:00 and 11:30 free", JSON.stringify(taken(trimP.body)) === JSON.stringify(["09:30", "10:00", "10:30", "11:00"]) && free(trimP.body).includes("09:00") && free(trimP.body).includes("11:30"), { taken: taken(trimP.body), free: free(trimP.body) });
    await book(1, "14:00", "Ann", "ann@example.com");
    const fullP = await req("GET", U(`d=${d}&s=1`)), month2 = await req("GET", "/index.php");
    check("the most a day (2): the day is full - no free times, not a link in the month", free(fullP.body).length === 0 && taken(fullP.body).length > 10 && !month2.body.includes(`d=${d}"`) && !month2.body.includes(`d=${d}&`), { free: free(fullP.body) });
    const man = await req("GET", U(`b=${tok1}`));
    check("the manage link: the booking (Cut, waiting), ⤓ Add to my calendar, Cancel", /Waiting for confirmation/.test(man.body) && /Cut/.test(man.body) && man.body.includes(`bgcal-ics.php?b=${tok1}`) && /Cancel this booking/.test(man.body), man.body.slice(-700));
    const ics = await req("GET", `/bgcal-ics.php?b=${tok1}`), bad = await req("GET", "/bgcal-ics.php?b=0123");
    check("bgcal-ics.php: a calendar file (DTSTART in UTC, the summary, TENTATIVE while it waits); an unknown booking = 404", /text\/calendar/.test(ics.type) && new RegExp(`DTSTART:${d.replace(/-/g, "")}T100000Z`).test(ics.body) && /SUMMARY:Salon - Cut/.test(ics.body) && /STATUS:TENTATIVE/.test(ics.body) && bad.status === 404, ics.body);
    const ct = tokOf(man.body), wrong = await req("POST", U(`b=${tok1}`), `cal=salon&b=${tok1}&act=cancel&token=nope`);
    const can = await req("POST", U(`b=${tok1}`), `cal=salon&b=${tok1}&act=cancel&token=${ct}`);
    const r2 = (await D.run("global", "site_salon", `SELECT status, cancelled_at FROM bg_cal_bookings WHERE token = '${tok1}'`)).results[0].rows[0];
    const ics2 = await req("GET", `/bgcal-ics.php?b=${tok1}`);
    check("✕ cancel: a wrong form token refused; then cancelled (the row + when), the page says so, no Cancel button, the .ics says CANCELLED", /expired/.test(wrong.body) && /Your booking is cancelled/.test(can.body) && !/Cancel this booking/.test(can.body) && r2.status === "cancelled" && !!r2.cancelled_at && /STATUS:CANCELLED/.test(ics2.body), { r2 });
    check("e-mails on cancelling: the visitor + the owner", /booking cancelled/i.test(Buffer.from(((fs.readFileSync(mailF, "utf8").match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/g) || []).map((s) => Buffer.from(s.replace(/^.*\?B\?|\?=$/g, ""), "base64").toString()).join("|"))).toString()) && (fs.readFileSync(mailF, "utf8").match(/To: owner@example\.com/g) || []).length >= 3);
    const trim2 = await req("GET", U(`d=${d}&s=1`));
    check("a cancelled booking frees its time (the day is under its most again; 10:00 bookable)", free(trim2.body).includes("10:00"), { free: free(trim2.body), taken: taken(trim2.body) });
    const r3 = (await D.run("global", "site_salon", "SELECT token FROM bg_cal_bookings WHERE name = 'Ann'")).results[0].rows[0];
    await D.run("global", "site_salon", "UPDATE bg_calendars SET cancel_hours = 1000 WHERE slug = 'salon'");
    const man2 = await req("GET", U(`b=${r3.token}`)), late = await req("POST", U(`b=${r3.token}`), `cal=salon&b=${r3.token}&act=cancel&token=${tokOf(man.body) || ""}`);
    check("the cancel hours: too close to the time = no Cancel button, a cancel refused (get in touch)", !/Cancel this booking/.test(man2.body) && /too late to cancel online/.test(late.body), (late.body.match(/bgcal-msg[^<]*/g) || []));
    const bk = await SCL.bookings(liveCal);
    check("lib/siteCal.bookings: the service and the state of each (📅 Bookings)", bk.rows.length === 2 && bk.rows.some((r) => r.service === "Cut" && r.status === "cancelled") && bk.rows.some((r) => r.service === "Trim" && r.status === "pending"), bk.rows);
  } catch (e) { fail++; console.log("FAIL: LIVE " + (e.stack || e)); }
  finally { if (srv) srv.kill(); try { await D.stop("global"); } catch (e) { /* stopped */ } fs.rmSync(tmpd, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
