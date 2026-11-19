#!/usr/bin/env node
/* bitGen Studio — 2.861.0 LIVE: 📅 book.php and 📍 contact.php for real - PHP's own server on the project's www + a REAL MariaDB
 * (the CRM's 🗄 database with its "Bookings" calendar): the calendar's info, a day's free times, a booking that lands in the CRM's
 * 📅 Bookings (+ 👤 Clients), the same time again refused (one at a time), a time outside the hours refused, the robot trap, a closed day;
 * the contact form into ✉ Messages, the trap, a bad email, 5 a 10 minutes. Needs PHP (+ pdo_mysql) and MariaDB - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const php = spawnSync("php", ["-m"], { encoding: "utf8" });
  if (php.status !== 0) { console.log("SKIP: no PHP here"); console.log(`\nRESULT: 0 passed, 0 failed`); return; }
  for (const f of ["booking/files/book.php", "contact-map/files/contact.php"]) check("php -l " + f, spawnSync("php", ["-l", path.join(ROOT, "web/skills", f)]).status === 0);
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin) || !/pdo_mysql/.test(php.stdout)) { console.log("SKIP: no MariaDB or pdo_mysql here - the live part"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js")), K = require(path.join(ROOT, "lib/webSkills.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t861l-")), P = path.join(tmp, "projects", "Cafe"); fs.mkdirSync(P, { recursive: true });
  D.setBase(tmp, path.join(P, "db")); W.setProjectDir(() => P); DB.setDb(D);
  let srv = null;
  try {
    W.create(undefined, "Cafe");
    await DB.create({ scope: "project", name: "cafe_site" });
    K.install("booking"); K.install("contact-map");
    // the calendar: every day 09:00 - 17:00, 30-minute steps, one at a time, no notice, a 60-minute service; tomorrow closed
    const day = (n) => { const t = new Date(Date.now() + n * 86400000); return t.toISOString().slice(0, 10); };
    const sql = ["UPDATE bg_calendars SET slot_minutes = 30, capacity = 1, lead_hours = 0, days_ahead = 60, buffer_minutes = 0, max_per_day = 0, approve = 0, timezone = 'UTC' WHERE slug = 'bookings'",
      "DELETE FROM bg_cal_hours", ...[0, 1, 2, 3, 4, 5, 6].map((w) => `INSERT INTO bg_cal_hours (calendar_id, weekday, opens, closes) SELECT id, ${w}, '09:00:00', '17:00:00' FROM bg_calendars WHERE slug = 'bookings'`),
      "DELETE FROM bg_cal_services", "INSERT INTO bg_cal_services (calendar_id, sort, name, minutes, price) SELECT id, 0, 'Consult', 60, '$50' FROM bg_calendars WHERE slug = 'bookings'",
      `INSERT INTO bg_cal_closed (calendar_id, day, reason) SELECT id, '${day(2)}', 'holiday' FROM bg_calendars WHERE slug = 'bookings'`].join(";\n");
    await D.run("project", "cafe_site", sql);
    const i = D.scopeInfo("project"), pw = require(path.join(ROOT, "lib/secrets.js")).store(tmp).read()[i.key] || "";
    const cfgF = path.join(P, "www", "inc", "config.php");
    fs.writeFileSync(cfgF, fs.readFileSync(cfgF, "utf8").replace(/define\('DB_HOST'[^;]*;/, `define('DB_HOST', '127.0.0.1:${i.port}');`).replace(/define\('DB_USER'[^;]*;/, "define('DB_USER', 'root');").replace(/define\('DB_PASS'[^;]*;/, `define('DB_PASS', '${pw}');`));
    const port = 19000 + Math.floor(Math.random() * 1000);
    srv = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(P, "www")], { stdio: "ignore" });
    for (let k = 0; k < 40; k++) { try { await fetch(`http://127.0.0.1:${port}/robots.txt`); break; } catch (e) { await sleep(150); } }
    const U = (p) => `http://127.0.0.1:${port}/${p}`, J = async (p, body) => { const r = await fetch(U(p), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); return Object.assign(await r.json(), { http: r.status }); };
    const info = await J("book.php?cal=bookings&info=1");
    check("book.php info: the calendar's name, its services (Consult 60 min $50), 60 days ahead", info.ok && info.name === "Bookings" && info.services[0].name === "Consult" && info.services[0].minutes === 60 && info.ahead === 60, info);
    const d1 = day(1), t1 = await J(`book.php?cal=bookings&day=${d1}&service=0`);
    check("...a day's times: 09:00 - 16:00 in 30-minute steps for a 60-minute service (15 times), all free", t1.ok && t1.times.length === 15 && t1.times[0].time === "09:00" && t1.times[14].time === "16:00" && t1.times.every((t) => t.free), t1);
    const b1 = await J("book.php?cal=bookings", { day: d1, time: "10:00", service: 0, name: "Ann Lee", email: "ann@example.com", phone: "0400", notes: "first visit", website: "" });
    check("a booking: taken ('You are booked for …')", b1.ok && b1.http === 200 && b1.status === "booked" && /booked for/.test(b1.message), b1);
    const bk = (await DB.list("bookings")).items, cl = (await DB.list("clients")).items;
    check("...it shows in the CRM's 📅 Bookings (10:00, 60 minutes, Consult, confirmed) and 👤 Clients", bk.length === 1 && bk[0].date === d1 && bk[0].time === "10:00" && bk[0].length === 60 && bk[0].service === "Consult" && bk[0].status === "confirmed" && /Ann Lee <ann@example.com>/.test(bk[0].client) && cl.some((c) => c.email === "ann@example.com"), { bk, cl });
    const t2 = await J(`book.php?cal=bookings&day=${d1}&service=0`), tk = (h) => (t2.times.find((t) => t.time === h) || {}).free;
    check("...now 09:30, 10:00, 10:30 are taken (they overlap the hour), 09:00 and 11:00 still free", tk("09:30") === false && tk("10:00") === false && tk("10:30") === false && tk("09:00") === true && tk("11:00") === true, t2.times.slice(0, 6));
    const b2 = await J("book.php?cal=bookings", { day: d1, time: "10:30", service: 0, name: "Bo", email: "bo@example.com" });
    check("the same time again (overlapping): refused (409 'just gone') - checked again on the server", !b2.ok && b2.http === 409 && /just gone/.test(b2.message), b2);
    const b3 = await J("book.php?cal=bookings", { day: d1, time: "16:30", service: 0, name: "Bo", email: "bo@example.com" });
    check("a time that runs past closing (16:30 + 60 min): refused", !b3.ok && b3.http === 409, b3);
    const tc = await J(`book.php?cal=bookings&day=${day(2)}&service=0`);
    check("a closed day: closed, no times", tc.ok && tc.closed === true && tc.times.length === 0, tc);
    const bot = await J("book.php?cal=bookings", { day: d1, time: "13:00", service: 0, name: "Bot", email: "bot@example.com", website: "http://spam" });
    const bad = await J("book.php?cal=bookings", { day: d1, time: "13:00", service: 0, name: "X", email: "nope" });
    check("the robot trap: a thank-you and nothing kept; a bad email: 400", bot.ok && (await DB.list("bookings")).items.length === 1 && bad.http === 400);
    // contact
    const c1 = await J("contact.php", { name: "Cat", email: "cat@example.com", subject: "Catering", message: "Do you cater for 40?", website: "" });
    const msgs = (await DB.list("messages")).items;
    check("contact.php: the message into the CRM's ✉ Messages (new)", c1.ok && /Thank you, Cat/.test(c1.message) && msgs.length === 1 && msgs[0].subject === "Catering" && msgs[0].status === "new" && msgs[0].email === "cat@example.com", { c1, msgs });
    const c2 = await J("contact.php", { name: "Bot", email: "b@example.com", message: "buy", website: "x" }), c3 = await J("contact.php", { name: "Cat", email: "bad", message: "hi" });
    check("...the trap keeps nothing, a bad email 400", c2.ok && (await DB.list("messages")).items.length === 1 && c3.http === 400);
    let last; for (let k = 0; k < 5; k++) last = await J("contact.php", { name: "Cat", email: "cat@example.com", message: "again " + k });
    check("...more than 5 in 10 minutes from one address: 429", last.http === 429 && /wait a few minutes/.test(last.message), last);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { if (srv) srv.kill(); try { await D.stop("project"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
