// lib/webDb.js — 2.857.0 🗄 the CRM's LIVE database (Tim: "have the crm create the sites database and then link to it so it will be
// live"). The Web editor's 🗂 CRM ▸ 🗄 Create the site's database…:
//   WHERE   project  = bitGen's own MariaDB for this project (on this computer - build and try the site)
//           external = your server (🗄 Database ▸ ⚙ Your server: the live site's MySQL / MariaDB on the host)
//   MAKES   one database (made when missing; on your server the one it gives is used when CREATE DATABASE is refused) with the
//           admin's tables (lib/siteAdminSql.js - clients, orders, order_items …, the views), the booking calendar's tables + a
//           "Bookings" calendar (static/sitecal.js via lib/siteCal.js), the contact form's messages table (+ subject / status)
//   BRINGS  the records kept in the project until now (web/crm.json) in once - the file is then renamed crm.imported.json
//   LINKS   projects/<p>/web/db.json {scope, name, at} - from then on Clients / Bookings / Orders / Messages are read from and written
//           to that database (what the site's visitors book, order and send shows at once - ⟳ / every 30 s in the docker)
//   SITE    www/inc/config.php gets DB_HOST / DB_NAME / DB_USER (+ ADMIN_DB_NAME = the same database) so the site's PHP uses it;
//           the password is NEVER written there by bitGen (getenv or typed on the server - DEPLOY.md / the docker says so)
// The SQL is parameterised (mysql2 execute) - nothing the user typed goes into SQL text.
"use strict";
const fs = require("fs"), path = require("path");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let D = () => require("./dbServer");
let W = () => require("./webProject");
function setDb(fake) { D = () => fake; }   // tests
const privDir = () => path.join(path.dirname(W().root()), "web");
const linkFile = () => path.join(privDir(), "db.json");
function link() { try { const j = JSON.parse(fs.readFileSync(linkFile(), "utf8")); return j && j.name ? j : null; } catch (e) { return null; } }
function unlink() { try { fs.unlinkSync(linkFile()); } catch (e) { /* none */ } return { linked: false }; }
const nameOf = (s) => { const n = String(s || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48); return /^[a-z_]/.test(n) ? n : "site_" + (n || "db"); };
const MSG_SQL = `CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const MSG_UP = ["ALTER TABLE messages ADD COLUMN subject VARCHAR(200) NOT NULL DEFAULT ''", "ALTER TABLE messages ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'new'"];

async function q(sql, params) {
  const L = link(); if (!L) throw bad("the CRM is not linked to a database", 409);
  const c = await D().conn(L.scope, L.name);
  try { const [rows] = await c.execute(sql, params || []); return rows; } finally { try { await c.end(); } catch (e) { /* closed */ } }
}
/** 🗄 make the site's database + link the CRM to it -> {scope, name, made, imported, config} */
async function create(o) {
  const a = o || {}, scope = a.scope === "external" ? "external" : "project";
  const ext = scope === "external" ? D().externalCfg() : null;
  if (ext && !ext.host) throw bad("set up your server first - 🗄 Database ▸ ⚙ Your server (the host, user, password)", 412);
  let name = nameOf(a.name || (ext && ext.database) || path.basename(path.dirname(W().root())) + "_site");
  let made = false;
  try { const list = await D().databases(scope); if (!list.includes(name)) { await D().createDb(scope, name); made = true; } }
  catch (e) {
    if (scope !== "external" || !ext.database) throw e;
    name = ext.database;   // a host that refuses CREATE DATABASE: its own database
  }
  // the admin's tables + views, the booking calendar + "Bookings", the contact form's messages
  const SC = require("./siteCal"); SC.setDb && SC.setDb(D());
  const cal = await SC.install({ name: "Bookings", slug: "bookings", kind: "appointments", tz: a.tz || "UTC", mode: "booking", db: { scope, name, admin: name }, adminOn: true });
  if (cal.admin && cal.admin.ok === false) throw bad("the admin tables were refused: " + cal.admin.error);
  await D().run(scope, name, MSG_SQL);
  for (const s of MSG_UP) { try { await D().run(scope, name, s); } catch (e) { /* there already */ } }
  fs.mkdirSync(privDir(), { recursive: true });
  fs.writeFileSync(linkFile(), JSON.stringify({ scope, name, at: new Date().toISOString() }, null, 2));
  const imported = a.importLocal === false ? null : await importLocal();
  const config = writeConfig(scope, name, ext);
  return { linked: true, scope, name, made, imported, config, tables: (cal.admin && cal.admin.tables || []).length + 7 };
}
/** the records kept in the project (web/crm.json) into the database, once */
async function importLocal() {
  const f = path.join(privDir(), "crm.json"); if (!fs.existsSync(f)) return null;
  let d = {}; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; }
  const n = { clients: 0, bookings: 0, orders: 0, messages: 0 };
  for (const k of Object.keys(n)) for (const r of (d[k] || []).slice().reverse()) { await save(k, Object.assign({}, r, { id: undefined })); n[k]++; }
  fs.renameSync(f, path.join(privDir(), "crm.imported.json"));
  return n;
}
/** www/inc/config.php: the database's host / name / user for the site's PHP (made, or those lines changed) - no password */
function writeConfig(scope, name, ext) {
  const www = W().root(); if (!fs.existsSync(www)) return null;
  const f = path.join(www, "inc", "config.php"); fs.mkdirSync(path.dirname(f), { recursive: true });
  const host = scope === "external" ? ext.host + (ext.port && ext.port !== 3306 ? ":" + ext.port : "") : "localhost";
  const user = scope === "external" ? ext.user : "your_db_user";
  const val = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const want = { DB_HOST: host, DB_NAME: name, DB_USER: user, ADMIN_DB_NAME: name };
  let t = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : `<?php\n// The site's database - written by bitGen Studio's Web editor (🗂 CRM ▸ 🗄). The password is never written here by bitGen:\n// set DB_PASS on the server (an environment variable, or type it below on the server only).\n`;
  for (const [k, v] of Object.entries(want)) {
    const re = new RegExp(`define\\('${k}',[^;]*;`);
    const line = `define('${k}', getenv('${k}') ?: '${val(v)}');`;
    t = re.test(t) ? t.replace(re, line) : t.replace(/\?>\s*$/, "") + line + "\n";
  }
  if (!/define\('DB_PASS'/.test(t)) t += "define('DB_PASS', getenv('DB_PASS') ?: '');   // type it here ON THE SERVER only\n";
  if (!/define\('ADMIN_DB_PASS'/.test(t)) t += "define('ADMIN_DB_PASS', getenv('ADMIN_DB_PASS') !== false ? getenv('ADMIN_DB_PASS') : DB_PASS);\n";
  fs.writeFileSync(f, t);
  return "inc/config.php";
}
async function status() {
  const L = link(); if (!L) return { linked: false };
  let ok = true, error = null, counts = null;
  try { const r = await q("SELECT (SELECT COUNT(*) FROM clients) AS clients, (SELECT COUNT(*) FROM bg_cal_bookings) AS bookings, (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM messages) AS messages"); counts = r[0]; }
  catch (e) { ok = false; error = e.message; }
  return { linked: true, scope: L.scope, name: L.name, at: L.at, ok, error, counts };
}

/* ---------------- the CRM's kinds <-> the tables */
const BST = { pending: "pending", confirmed: "booked", done: "done", cancelled: "cancelled" }, BST_IN = { pending: "pending", booked: "confirmed", done: "done", cancelled: "cancelled" };
const OST = { new: "pending", paid: "paid", sent: "shipped", done: "completed", cancelled: "cancelled", refunded: "refunded" }, OST_IN = { pending: "new", paid: "paid", processing: "paid", shipped: "sent", completed: "done", cancelled: "cancelled", refunded: "refunded" };
const S = (v, n) => String(v == null ? "" : v).slice(0, n);
const num = (v) => { const n = +v; return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const splitName = (n) => { const p = S(n, 160).trim().split(/\s+/); return [p.slice(0, Math.max(1, p.length - 1)).join(" ").slice(0, 80), p.length > 1 ? p[p.length - 1].slice(0, 80) : ""]; };
const day = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : new Date().toISOString().slice(0, 10);
const hm = (s) => /^\d{1,2}:\d{2}$/.test(String(s || "")) ? String(s).padStart(5, "0") : "09:00";
async function records(kind) {
  if (kind === "clients") return (await q("SELECT id, first_name, last_name, company, email, phone, tags, notes, created_at FROM clients ORDER BY id DESC LIMIT 5000"))
    .map((r) => ({ id: String(r.id), name: (r.first_name + " " + r.last_name).trim(), email: r.email || "", phone: r.phone, company: r.company, tags: r.tags, notes: r.notes || "", created: String(r.created_at || "") }));
  if (kind === "bookings") return (await q("SELECT id, DATE_FORMAT(starts_at, '%Y-%m-%d') AS d, DATE_FORMAT(starts_at, '%H:%i') AS t, TIMESTAMPDIFF(MINUTE, starts_at, ends_at) AS len, name, email, service, status, notes, source FROM bg_cal_bookings ORDER BY starts_at DESC, id DESC LIMIT 5000"))
    .map((r) => ({ id: String(r.id), client: r.name + (r.email ? " <" + r.email + ">" : ""), service: r.service, date: r.d, time: r.t, length: r.len, status: BST_IN[r.status] || "pending", notes: r.notes || "", source: r.source }));
  if (kind === "orders") return (await q("SELECT o.id, o.number, DATE_FORMAT(o.created_at, '%Y-%m-%d') AS d, o.total, o.status, o.notes, o.email, TRIM(CONCAT(IFNULL(c.first_name,''), ' ', IFNULL(c.last_name,''))) AS cname, (SELECT GROUP_CONCAT(CONCAT(i.qty, ' x ', i.name) SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) AS items FROM orders o LEFT JOIN clients c ON c.id = o.client_id ORDER BY o.created_at DESC, o.id DESC LIMIT 5000"))
    .map((r) => ({ id: String(r.id), number: r.number, client: r.cname || r.email || "", date: r.d, items: r.items || "", total: num(r.total), status: OST_IN[r.status] || "new", notes: r.notes || "" }));
  if (kind === "messages") return (await q("SELECT id, name, email, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS d FROM messages ORDER BY created_at DESC, id DESC LIMIT 5000"))
    .map((r) => ({ id: String(r.id), name: r.name, email: r.email, subject: r.subject || "", message: r.message, status: ["new", "read", "answered", "spam"].includes(r.status) ? r.status : "new", date: r.d }));
  throw bad("no records called " + kind);
}
const idOf = (r) => { const n = parseInt(r && r.id, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
async function save(kind, r0) {
  const r = r0 || {}, id = idOf(r);
  if (r.remove) {
    if (!id) throw bad("no such record", 404);
    const T = { clients: "clients", bookings: "bg_cal_bookings", orders: "orders", messages: "messages" }[kind]; if (!T) throw bad("no records called " + kind);
    if (kind === "orders") await q("DELETE FROM order_items WHERE order_id = ?", [id]);
    await q(`DELETE FROM ${T} WHERE id = ?`, [id]); return null;
  }
  if (kind === "clients") {
    const [fn, ln] = splitName(r.name);
    const v = [fn, ln, S(r.company, 120), S(r.email, 200) || null, S(r.phone, 40), S(r.tags, 255), S(r.notes, 60000)];
    if (id) { await q("UPDATE clients SET first_name = ?, last_name = ?, company = ?, email = ?, phone = ?, tags = ?, notes = ? WHERE id = ?", v.concat(id)); return id; }
    return (await q("INSERT INTO clients (first_name, last_name, company, email, phone, tags, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin')", v)).insertId;
  }
  if (kind === "bookings") {
    const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(S(r.client, 300)), name = S(m ? m[1] : r.client, 120) || "-", email = S(m ? m[2] : "", 200);
    const start = day(r.date) + " " + hm(r.time) + ":00", len = Math.max(5, Math.min(1440, Math.round(+r.length || 60)));
    const v = [start, start, len, name, email, S(r.service, 80), BST[r.status] || "pending", S(r.notes, 20000)];
    if (id) { await q("UPDATE bg_cal_bookings SET starts_at = ?, ends_at = DATE_ADD(?, INTERVAL ? MINUTE), name = ?, email = ?, service = ?, status = ?, notes = ? WHERE id = ?", v.concat(id)); return id; }
    const cal = await q("SELECT id FROM bg_calendars ORDER BY id LIMIT 1"); if (!cal.length) throw bad("the database has no booking calendar - 🗄 Create the site's database again");
    return (await q("INSERT INTO bg_cal_bookings (calendar_id, starts_at, ends_at, name, email, service, status, notes, source) VALUES (?, ?, DATE_ADD(?, INTERVAL ? MINUTE), ?, ?, ?, ?, ?, 'admin')", [cal[0].id].concat(v))).insertId;
  }
  if (kind === "orders") {
    const st = OST[r.status] || "pending", paid = st === "paid" || st === "shipped" || st === "completed" ? "paid" : st === "refunded" ? "refunded" : "unpaid";
    const notes = S(r.notes, 20000) + (r.items && !id ? (r.notes ? "\n" : "") + "Items: " + S(r.items, 5000) : "");
    if (id) { await q("UPDATE orders SET total = ?, status = ?, payment_status = ?, notes = ? WHERE id = ?", [num(r.total), st, paid, S(r.notes, 20000), id]); return id; }
    const number = S(r.number, 30) || "ORD-" + Date.now().toString(36).toUpperCase();
    const em = /\S+@\S+/.exec(S(r.client, 300));
    return (await q("INSERT INTO orders (number, status, payment_status, subtotal, total, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [number, st, paid, num(r.total), num(r.total), em ? em[0] : "", notes, day(r.date) + " 12:00:00"])).insertId;
  }
  if (kind === "messages") {
    const v = [S(r.name, 120) || "-", S(r.email, 200), S(r.subject, 200), S(r.message, 60000), ["new", "read", "answered", "spam"].includes(r.status) ? r.status : "new"];
    if (id) { await q("UPDATE messages SET name = ?, email = ?, subject = ?, message = ?, status = ? WHERE id = ?", v.concat(id)); return id; }
    return (await q("INSERT INTO messages (name, email, subject, message, status) VALUES (?, ?, ?, ?, ?)", v)).insertId;
  }
  throw bad("no records called " + kind);
}
const CRM = ["clients", "bookings", "orders", "messages"];
/** what the routes call: {kind, items} / {kind, items, saved} - the same shape as the project's file */
async function list(kind) { return { kind, items: await records(kind), live: link() }; }
async function put(kind, rec) {
  const id = await save(kind, rec), items = await records(kind);
  return { kind, items, saved: id ? items.find((x) => x.id === String(id)) || null : null, live: link() };
}
module.exports = { setDb, link, unlink, nameOf, create, importLocal, writeConfig, status, records, save, list, put, CRM, BST, OST };
