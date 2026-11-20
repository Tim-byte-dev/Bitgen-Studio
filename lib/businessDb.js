// lib/businessDb.js — 2.897.0: 💳 the business details (lib/businessProfiles.js) kept in MariaDB - bitGen's own database for
// everything (127.0.0.1, lib/dbServer.js scope "global") or YOUR server (scope "external" - several computers then share one set of
// details). Tim (2.875.0): "save all the contact information to a json file for now, later we will add it to mariadb" -> PARKED item 5
// -> "lets go with the parked item".
//   THE TABLES (database `bitgen_business` by default - the columns are 2.875.0's FIELDS + card_size):
//     business_profiles  id, company, name, role, address, phone, email, website, front, back, abn, card_size, logo_name,
//                        logo_type, logo (the picture itself, so another computer has it too), created, updated, updated_by
//     business_services  profile_id, pos, service      (one row a service, in order)
//     business_colours   profile_id, pos, colour       (#rrggbb, the first the main colour)
//     business_meta      k, v                          (schema = 1)
//     business_card_stocks  2.898.0: your label / card stocks (lib/cardStocks.js - the image editor's 📇 Business Card Sheet): id,
//                        name (one each), paper_w, paper_h, across_n, down_n, card_w, card_h, top_mm, left_mm, pitch_across,
//                        pitch_down (mm), created, updated, updated_by - business/card_stocks.json then this computer's copy
//   HOW: business/profiles.json stays THIS computer's copy - every reader (Accounts, invoices, ✨ Create) reads it as before. In a
//   database: a save / delete goes to the database at once (waiting in business/store.json `pending` when it does not answer, sent
//   with the next sync); a list first syncs - the waiting ones sent (unless the database's copy is newer: then it wins), then the
//   database's rows become this computer's copy (logos fetched only when they changed). Moving there sends every profile here that
//   the database does not have yet (a shared server's own rows kept); moving back keeps the database's rows here, the database untouched.
//   store()  {mode: "file" | "db", scope, db, pending: {save, remove, stockSave, stockRemove: [ids]}, lastSync, lastError}
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const BP = () => require("./businessProfiles");
let D = () => require("./dbServer");
function setDb(fake) { D = () => fake; }   // tests
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const DB_DEFAULT = "bitgen_business", SCHEMA_V = 1;
const file = () => path.join(BP().root(), "store.json");
function store() {
  let s = {}; try { s = JSON.parse(fs.readFileSync(file(), "utf8")) || {}; } catch (e) { /* none yet = a file */ }
  const pend = s.pending || {};
  return { mode: s.mode === "db" ? "db" : "file", scope: s.scope === "external" ? "external" : "global", db: /^[\w$]{1,64}$/.test(s.db || "") ? s.db : DB_DEFAULT,
    pending: { save: [...new Set(pend.save || [])], remove: [...new Set(pend.remove || [])], stockSave: [...new Set(pend.stockSave || [])], stockRemove: [...new Set(pend.stockRemove || [])] }, lastSync: s.lastSync || "", lastError: s.lastError || "", count: s.count || 0, stocks: s.stocks || 0 };
}
function setStore(s) { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file() + ".part", JSON.stringify(s, null, 1)); fs.renameSync(file() + ".part", file()); return s; }
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS business_profiles (id VARCHAR(32) NOT NULL PRIMARY KEY, company VARCHAR(120) NOT NULL DEFAULT '', name VARCHAR(120) NOT NULL DEFAULT '',"
    + " role VARCHAR(120) NOT NULL DEFAULT '', address VARCHAR(300) NOT NULL DEFAULT '', phone VARCHAR(60) NOT NULL DEFAULT '', email VARCHAR(160) NOT NULL DEFAULT '',"
    + " website VARCHAR(200) NOT NULL DEFAULT '', front TEXT, back TEXT, abn VARCHAR(20) NOT NULL DEFAULT '', card_size VARCHAR(24) NOT NULL DEFAULT '',"
    + " logo_name VARCHAR(64) NOT NULL DEFAULT '', logo_type VARCHAR(40) NOT NULL DEFAULT '', logo LONGBLOB NULL, created VARCHAR(32) NOT NULL DEFAULT '',"
    + " updated VARCHAR(32) NOT NULL DEFAULT '', updated_by VARCHAR(64) NOT NULL DEFAULT '', KEY by_company (company), KEY by_name (name))"
    + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS business_services (profile_id VARCHAR(32) NOT NULL, pos SMALLINT NOT NULL, service VARCHAR(120) NOT NULL, PRIMARY KEY (profile_id, pos),"
    + " CONSTRAINT fk_bsv_profile FOREIGN KEY (profile_id) REFERENCES business_profiles (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS business_colours (profile_id VARCHAR(32) NOT NULL, pos SMALLINT NOT NULL, colour CHAR(7) NOT NULL, PRIMARY KEY (profile_id, pos),"
    + " CONSTRAINT fk_bco_profile FOREIGN KEY (profile_id) REFERENCES business_profiles (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS business_meta (k VARCHAR(40) NOT NULL PRIMARY KEY, v VARCHAR(200) NOT NULL DEFAULT '') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  // 2.898.0: the card stocks (mm) - one name each
  "CREATE TABLE IF NOT EXISTS business_card_stocks (id VARCHAR(32) NOT NULL PRIMARY KEY, name VARCHAR(60) NOT NULL, paper_w DECIMAL(7,2) NOT NULL, paper_h DECIMAL(7,2) NOT NULL,"
    + " across_n SMALLINT NOT NULL, down_n SMALLINT NOT NULL, card_w DECIMAL(7,2) NOT NULL, card_h DECIMAL(7,2) NOT NULL, top_mm DECIMAL(7,2) NOT NULL DEFAULT 0,"
    + " left_mm DECIMAL(7,2) NOT NULL DEFAULT 0, pitch_across DECIMAL(7,2) NOT NULL, pitch_down DECIMAL(7,2) NOT NULL, created VARCHAR(32) NOT NULL DEFAULT '',"
    + " updated VARCHAR(32) NOT NULL DEFAULT '', updated_by VARCHAR(64) NOT NULL DEFAULT '', UNIQUE KEY by_name (name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];
const CS = () => require("./cardStocks");
/** a stock into the database (its name taken by another id there = that row updated: one name, one stock) */
async function putStock(c, s) {
  await c.query("INSERT INTO business_card_stocks (id, name, paper_w, paper_h, across_n, down_n, card_w, card_h, top_mm, left_mm, pitch_across, pitch_down, created, updated, updated_by)"
    + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), paper_w = VALUES(paper_w), paper_h = VALUES(paper_h), across_n = VALUES(across_n),"
    + " down_n = VALUES(down_n), card_w = VALUES(card_w), card_h = VALUES(card_h), top_mm = VALUES(top_mm), left_mm = VALUES(left_mm), pitch_across = VALUES(pitch_across),"
    + " pitch_down = VALUES(pitch_down), updated = VALUES(updated), updated_by = VALUES(updated_by)",
  [s.id, s.name, s.paper.w, s.paper.h, s.cols, s.rows, s.cw, s.ch, s.top, s.left, s.hpitch, s.vpitch, s.created || "", s.updated || "", who()]);
}
/** the database's stocks -> lib/cardStocks.js's shape */
async function stocksOf(c) {
  const [rows] = await c.query("SELECT id, name, paper_w, paper_h, across_n, down_n, card_w, card_h, top_mm, left_mm, pitch_across, pitch_down, created, updated, updated_by FROM business_card_stocks ORDER BY name");
  return rows.map((r) => ({ id: r.id, name: r.name, paper: { w: +r.paper_w, h: +r.paper_h }, cols: +r.across_n, rows: +r.down_n, cw: +r.card_w, ch: +r.card_h, top: +r.top_mm, left: +r.left_mm,
    hpitch: +r.pitch_across, vpitch: +r.pitch_down, created: r.created, updated: r.updated, updated_by: r.updated_by }));
}
const COLS = ["company", "name", "role", "address", "phone", "email", "website", "front", "back", "abn", "card_size"];
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif" };
const who = () => { try { return os.hostname().slice(0, 64); } catch (e) { return ""; } };
/** a connection to the store's database (made - and its tables - when missing); fn(c) then closed */
async function withDb(st, fn) {
  if (st.scope === "external") { const c0 = D().externalCfg(); if (!c0.host) throw bad("set up your database server first - 🗄 Database on the top bar ▸ Your server"); }
  else if (!D().find()) throw bad("MariaDB is not on this computer yet - ⬇ download it in 🗄 Database on the top bar", 409);
  await D().createDb(st.scope, st.db);
  const c = await D().conn(st.scope, st.db);
  try {
    for (const q of SCHEMA) await c.query(q);
    await c.query("INSERT INTO business_meta (k, v) VALUES ('schema', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [String(SCHEMA_V)]);
    return await fn(c);
  } finally { try { await c.end(); } catch (e) { /* closed */ } }
}
/** one profile (+ its logo) into the database - its services and colours replaced - in one transaction */
async function putOne(c, p) {
  const logo = p.logo ? BP().logoBuffer(p.id) : null, ext = p.logo ? path.extname(p.logo).toLowerCase() : "";
  await c.beginTransaction();
  try {
    await c.query(`INSERT INTO business_profiles (id, ${COLS.join(", ")}, logo_name, logo_type, logo, created, updated, updated_by) VALUES (?, ${COLS.map(() => "?").join(", ")}, ?, ?, ?, ?, ?, ?)`
      + ` ON DUPLICATE KEY UPDATE ${COLS.map((k) => `${k} = VALUES(${k})`).join(", ")}, logo_name = VALUES(logo_name), logo_type = VALUES(logo_type), logo = VALUES(logo), updated = VALUES(updated), updated_by = VALUES(updated_by)`,
    [p.id].concat(COLS.map((k) => (p[k] == null ? "" : String(p[k])))).concat([logo ? p.logo : "", logo ? TYPES[ext] || "" : "", logo, p.created || "", p.updated || "", who()]));
    await c.query("DELETE FROM business_services WHERE profile_id = ?", [p.id]);
    await c.query("DELETE FROM business_colours WHERE profile_id = ?", [p.id]);
    for (const [i, sv] of (p.services || []).entries()) await c.query("INSERT INTO business_services (profile_id, pos, service) VALUES (?, ?, ?)", [p.id, i, sv]);
    for (const [i, co] of (p.colours || []).entries()) await c.query("INSERT INTO business_colours (profile_id, pos, colour) VALUES (?, ?, ?)", [p.id, i, co]);
    await c.commit();
  } catch (e) { try { await c.rollback(); } catch (er) { /* gone */ } throw e; }
}
/** the database's profiles -> [{id, ...fields, services, colours, logo: "<id>.<ext>" | "", created, updated, updated_by}] (no logo bytes) */
async function rowsOf(c) {
  const [rows] = await c.query(`SELECT id, ${COLS.join(", ")}, logo_name, created, updated, updated_by FROM business_profiles ORDER BY created, id`);
  const [sv] = await c.query("SELECT profile_id, service FROM business_services ORDER BY profile_id, pos");
  const [co] = await c.query("SELECT profile_id, colour FROM business_colours ORDER BY profile_id, pos");
  return rows.map((r) => Object.assign({}, r, { front: r.front || "", back: r.back || "", logo: r.logo_name || "",
    services: sv.filter((x) => x.profile_id === r.id).map((x) => x.service), colours: co.filter((x) => x.profile_id === r.id).map((x) => x.colour) }));
}
/** the database's rows become this computer's copy (only the logos that changed or are missing fetched) */
async function pullInto(c) {
  const rows = await rowsOf(c), here = new Map(BP().raw().map((p) => [p.id, p])), need = rows.filter((r) => r.logo && (!here.has(r.id) || here.get(r.id).updated !== r.updated || here.get(r.id).logo !== r.logo || !BP().hasLogo(r)));
  const logos = {};
  for (const r of need) { const [x] = await c.query("SELECT logo FROM business_profiles WHERE id = ?", [r.id]); if (x[0] && x[0].logo) logos[r.id] = Buffer.from(x[0].logo); else r.logo = ""; }
  BP().adopt(rows, logos);
  return rows.length;
}
/** send what waits (a save the database has newer is left - theirs wins), then the database's rows here */
async function syncWith(c, st) {
  const notes = [];
  for (const id of st.pending.remove) await c.query("DELETE FROM business_profiles WHERE id = ?", [id]);
  const here = new Map(BP().raw().map((p) => [p.id, p]));
  for (const id of st.pending.save) {
    const p = here.get(id); if (!p) continue;
    const [x] = await c.query("SELECT updated, updated_by FROM business_profiles WHERE id = ?", [id]);
    if (x[0] && x[0].updated > (p.updated || "")) { notes.push(`${p.company || p.name}: changed on ${x[0].updated_by || "another computer"} since - that copy kept`); continue; }
    await putOne(c, p);
  }
  for (const id of st.pending.stockRemove) await c.query("DELETE FROM business_card_stocks WHERE id = ?", [id]);
  const stocksHere = new Map(CS().raw().map((x) => [x.id, x]));
  for (const id of st.pending.stockSave) {
    const x0 = stocksHere.get(id); if (!x0) continue;
    const [x] = await c.query("SELECT updated, updated_by FROM business_card_stocks WHERE id = ? OR name = ?", [id, x0.name]);
    if (x[0] && x[0].updated > (x0.updated || "")) { notes.push(`the card stock "${x0.name}": changed on ${x[0].updated_by || "another computer"} since - that copy kept`); continue; }
    await putStock(c, x0);
  }
  const n = await pullInto(c), stocks = CS().adopt(await stocksOf(c));
  return { count: n, stocks, notes };
}
const waitingOf = (st) => st.pending.save.length + st.pending.remove.length + st.pending.stockSave.length + st.pending.stockRemove.length;
const failed = (st, e) => { st.lastError = e.message || String(e); setStore(st); return st.lastError; };
/** GET: where they are kept + how it went */
function status() {
  const st = store(); let ext = null; try { const e = D().externalCfg(); ext = e.host ? { host: e.host, port: e.port, user: e.user } : null; } catch (e) { /* no module */ }
  let server = false; try { server = !!D().find(); } catch (e) { /* none */ }
  return { mode: st.mode, scope: st.scope, db: st.db, waiting: waitingOf(st), lastSync: st.lastSync, lastError: st.lastError, count: st.mode === "db" ? st.count : BP().raw().length, stocks: st.mode === "db" ? (st.stocks || 0) : CS().raw().length, external: ext, mariadb: server, where: whereWords(st, ext) };
}
function whereWords(st, ext) {
  if (st.mode !== "db") return "on this computer (business/profiles.json)";
  return st.scope === "external" ? `in ${st.db} on your server${ext ? " " + ext.host : ""}` : `in ${st.db} on bitGen's own database (this computer)`;
}
/** sync now (a list does this first) -> {ok, count, notes} | {ok: false, offline: why} - never throws (this computer's copy stays) */
async function sync() {
  const st = store(); if (st.mode !== "db") return { ok: true, file: true };
  try {
    const r = await withDb(st, (c) => syncWith(c, st));
    Object.assign(st, { pending: { save: [], remove: [], stockSave: [], stockRemove: [] }, lastSync: new Date().toISOString(), lastError: "", count: r.count, stocks: r.stocks }); setStore(st);
    return { ok: true, count: r.count, stocks: r.stocks, notes: r.notes };
  } catch (e) { return { ok: false, offline: failed(st, e), waiting: waitingOf(st) }; }
}
/** after a save / a delete here: into the database now, or waiting for it */
async function changed(kind, id) {
  const st = store(); if (st.mode !== "db") return { ok: true, file: true };
  // "save" / "remove" = a business profile; 2.898.0: "stock-save" / "stock-remove" = a card stock
  const k = { remove: "remove", "stock-save": "stockSave", "stock-remove": "stockRemove" }[kind] || "save";
  st.pending[k] = [...new Set(st.pending[k].concat([String(id)]))];
  if (k === "remove") st.pending.save = st.pending.save.filter((x) => x !== String(id));
  if (k === "stockRemove") st.pending.stockSave = st.pending.stockSave.filter((x) => x !== String(id));
  setStore(st);
  return sync();
}
/** 🗄 keep them in a database ({scope, db}) or 📁 back on this computer ({mode: "file"}) */
async function move(o0) {
  const o = o0 || {}, st = store();
  if (o.mode === "file") {
    if (st.mode === "db") { const r = await sync(); if (!r.ok && waitingOf(st)) throw bad(`the database did not answer (${r.offline}) - some changes are still waiting to go there; try again when it answers`, 409); }
    setStore({ mode: "file", scope: st.scope, db: st.db, pending: { save: [], remove: [], stockSave: [], stockRemove: [] }, lastSync: st.lastSync, lastError: "" });
    return Object.assign({ ok: true, moved: "file" }, status());
  }
  const scope = o.scope === "external" ? "external" : "global", db = String(o.db || DB_DEFAULT).trim();
  if (!/^[\w$]{1,64}$/.test(db)) throw bad("a database name is letters, digits, _ or $ (at most 64)");
  const nx = { mode: "db", scope, db, pending: { save: [], remove: [], stockSave: [], stockRemove: [] }, lastSync: "", lastError: "" };
  let sent = 0, had = 0, stocksSent = 0;
  await withDb(nx, async (c) => {
    const there = new Set((await c.query("SELECT id FROM business_profiles"))[0].map((r) => r.id)); had = there.size;
    for (const p of BP().raw()) if (!there.has(p.id)) { await putOne(c, p); sent++; }
    // 2.898.0: the card stocks too (a name the database has already keeps the database's)
    const names = new Set((await c.query("SELECT name FROM business_card_stocks"))[0].map((r) => String(r.name).toLowerCase()));
    for (const x of CS().raw()) if (!names.has(String(x.name).toLowerCase())) { await putStock(c, x); stocksSent++; }
    nx.count = await pullInto(c); nx.stocks = CS().adopt(await stocksOf(c));
  });
  nx.lastSync = new Date().toISOString(); setStore(nx);
  return Object.assign({ ok: true, moved: "db", sent, had, stocksSent }, status());
}
/** one at a time (a list's sync, a save, Accounts' look in the background) - store.json's waiting list never lost between two */
let chain = Promise.resolve();
const one = (fn) => (...a) => { const r = chain.then(() => fn(...a)); chain = r.catch(() => {}); return r; };
module.exports = { DB_DEFAULT, SCHEMA, COLS, setDb, store, status, sync: one(sync), changed: one(changed), move: one(move), rowsOf, stocksOf };
