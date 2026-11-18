#!/usr/bin/env node
/* bitGen Studio — 2.857.0 LIVE: 🗄 the CRM makes the site's database and links to it (lib/webDb.js) against a REAL MariaDB:
 * the database made with the admin's tables, the booking calendar ("Bookings") and the contact form's messages (+ subject /
 * status); the project's records brought in once (crm.json -> crm.imported.json); www/inc/config.php points the site at it
 * (no password); the CRM's Clients / Bookings / Orders / Messages read + written there (parameterised - a quote in a name is
 * just a quote); a row the SITE writes (a booking, a contact message, an order) shows in the CRM = live; unlink = the project's
 * file again. Needs MariaDB (with its install script) - else SKIP (GitHub's CI has none). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin)) { console.log("SKIP: no MariaDB here"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); return; }
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t857l-")), P = path.join(tmp, "projects", "Rosie");
  fs.mkdirSync(P, { recursive: true }); D.setBase(tmp, path.join(P, "db")); W.setProjectDir(() => P); DB.setDb(D);
  try {
    W.create(undefined, "Rosie");
    W.saveRecord("clients", { name: "Ann Lee", email: "ann@example.com", phone: "0400 111 222" });
    W.saveRecord("bookings", { client: "Ann Lee <ann@example.com>", service: "Cake tasting", date: "2026-12-03", time: "10:30", length: 45, status: "confirmed" });
    W.saveRecord("messages", { name: "Bob", email: "bob@example.com", subject: "Gluten free?", message: "Do you bake gluten free bread?" });
    check("not linked yet: the CRM is the project's file", (await DB.status()).linked === false && DB.link() === null);
    const r = await DB.create({ scope: "project" });
    check("🗄 created + linked: rosie_site made on this project's MariaDB, the project's records brought in (crm.json -> crm.imported.json)", r.linked && r.name === "rosie_site" && r.made && r.imported.clients === 1 && r.imported.bookings === 1 && r.imported.messages === 1
      && !fs.existsSync(path.join(P, "web", "crm.json")) && fs.existsSync(path.join(P, "web", "crm.imported.json")) && DB.link().name === "rosie_site", r);
    const tabs = (await D.run("project", "rosie_site", "SHOW TABLES")).results[0].rows.map((x) => Object.values(x)[0]);
    check("the site's tables: the admin's (clients, orders, order_items, products, settings …), the booking calendar's, messages", ["clients", "orders", "order_items", "products", "settings", "admin_users", "bg_calendars", "bg_cal_bookings", "messages"].every((t) => tabs.includes(t)), tabs);
    const cfg = fs.readFileSync(path.join(P, "www", "inc", "config.php"), "utf8");
    check("www/inc/config.php points the site's PHP at it (DB_NAME + ADMIN_DB_NAME = rosie_site) - NO password written", /define\('DB_NAME', getenv\('DB_NAME'\) \?: 'rosie_site'\);/.test(cfg) && /define\('ADMIN_DB_NAME', getenv\('ADMIN_DB_NAME'\) \?: 'rosie_site'\);/.test(cfg) && /define\('DB_PASS', getenv\('DB_PASS'\) \?: ''\);/.test(cfg), cfg);
    let cl = (await DB.list("clients")).items, bk = (await DB.list("bookings")).items, ms = (await DB.list("messages")).items;
    check("the brought-in records read back from the database (name split + joined, the booking's time and length, its status mapped)", cl[0].name === "Ann Lee" && cl[0].email === "ann@example.com" && bk[0].date === "2026-12-03" && bk[0].time === "10:30" && bk[0].length === 45 && bk[0].status === "confirmed" && /ann@example\.com/.test(bk[0].client) && ms[0].subject === "Gluten free?", { cl, bk, ms });
    const a = await DB.put("clients", { name: "O'Brien'); DROP TABLE clients; --", email: "x@example.com" });
    check("a client added (parameterised: a quote is just a quote - the table is still there)", a.saved && a.saved.name === "O'Brien'); DROP TABLE clients; --" && (await DB.list("clients")).items.length === 2, a.saved);
    await DB.put("clients", { id: a.saved.id, name: "Pat O'Brien", phone: "0400 999 000", email: "pat@example.com" });
    cl = (await DB.list("clients")).items;
    check("changed by id", cl.find((x) => x.id === a.saved.id).name === "Pat O'Brien" && cl.find((x) => x.id === a.saved.id).phone === "0400 999 000");
    const o = await DB.put("orders", { client: "pat@example.com", total: 42.5, status: "paid", items: "2 x Sourdough" });
    check("an order added (a number made, paid = payment paid)", o.saved && /^ORD-/.test(o.saved.number) && o.saved.total === 42.5 && o.saved.status === "paid" && (await D.run("project", "rosie_site", "SELECT payment_status FROM orders")).results[0].rows[0].payment_status === "paid", o.saved);
    // the SITE writes (as its PHP does): a booking, a contact message, an order with items -> the CRM shows them (live)
    await D.run("project", "rosie_site", "INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, service, status, source) SELECT id, '2026-12-05 14:00:00', '2026-12-05 14:30:00', 'Web Visitor', 'web@example.com', 'Birthday cake', 'booked', 'website' FROM bg_calendars LIMIT 1");
    await D.run("project", "rosie_site", "INSERT INTO messages (name, email, message) VALUES ('Site Form', 'form@example.com', 'Hello from the site')");
    await D.run("project", "rosie_site", "INSERT INTO orders (number, status, total, email) VALUES ('ORD-WEB1', 'pending', 19.00, 'shop@example.com')");
    await D.run("project", "rosie_site", "INSERT INTO order_items (order_id, name, qty, unit_price, total) SELECT id, 'Croissant', 3, 4, 12 FROM orders WHERE number = 'ORD-WEB1'");
    bk = (await DB.list("bookings")).items; ms = (await DB.list("messages")).items; const os2 = (await DB.list("orders")).items;
    check("LIVE: what the site's visitors book, send and order shows in the CRM (booked = confirmed, the order's items)", bk.some((x) => x.client === "Web Visitor <web@example.com>" && x.status === "confirmed" && x.source === "website") && ms[0].name === "Site Form" && ms[0].status === "new" && os2.find((x) => x.number === "ORD-WEB1").items === "3 x Croissant" && os2.find((x) => x.number === "ORD-WEB1").status === "new", { bk, ms, os2 });
    const web = bk.find((x) => x.client.startsWith("Web Visitor"));
    await DB.put("bookings", { id: web.id, client: web.client, service: web.service, date: web.date, time: "15:00", length: 60, status: "done" });
    const row = (await D.run("project", "rosie_site", `SELECT DATE_FORMAT(starts_at,'%H:%i') s, DATE_FORMAT(ends_at,'%H:%i') e, status FROM bg_cal_bookings WHERE id = ${+web.id}`)).results[0].rows[0];
    check("a booking changed in the CRM changes the site's row (time, length, status)", row.s === "15:00" && row.e === "16:00" && row.status === "done", row);
    await DB.put("messages", { id: ms[0].id, remove: true }); await DB.put("orders", { id: os2.find((x) => x.number === "ORD-WEB1").id, remove: true });
    check("removed from the CRM = removed from the database (an order with its items)", !(await DB.list("messages")).items.some((x) => x.name === "Site Form") && !(await D.run("project", "rosie_site", "SELECT COUNT(*) n FROM order_items")).results[0].rows[0].n);
    const st = await DB.status();
    check("status: linked, reached, the counts", st.linked && st.ok && st.counts.clients === 2 && st.scope === "project", st);
    const again = await DB.create({ scope: "project" });
    check("created again: the database kept (not made), nothing imported twice", again.name === "rosie_site" && !again.made && again.imported === null && (await DB.list("clients")).items.length === 2, again);
    DB.unlink();
    check("unlink: the CRM is the project's file again (the database left as it is)", DB.link() === null && (await D.run("project", "rosie_site", "SELECT COUNT(*) n FROM clients")).results[0].rows[0].n === 2);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { try { await D.stop("project"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
