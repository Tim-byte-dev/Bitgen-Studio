// lib/webDbAdmin.js — 2.868.0 🗄 the Web editor's DB manager tab (Tim: "add a db manager tab to web builder").
// Works on the site's database - the one the CRM is linked to (web/db.json), or any database of this project's MariaDB / your server.
// Reading (tables, rows, SQL) goes through lib/dbServer.js; THIS file adds the edits a manager needs, every one parameterised (mysql2
// execute with ?; names checked by dbServer.ident and against the table's own columns):
//   cell({scope, db, table, key {col: value}, col, value})  UPDATE one field of the row its primary key names (value null = NULL)
//   insert({…, table, values {col: value}})                  INSERT a row (only the table's columns; blank = the column's default)
//   remove({…, table, key})                                  DELETE the row its primary key names
//   exportTable({…, table, format csv|sql}) / dump({…})       a table as CSV, or the whole database as SQL (CREATE TABLE + INSERTs)
//   importSql({…, sql})                                       run a .sql file (any number of statements, in batches; stops at an error)
// A table without a primary key can be read and exported but not edited row by row (SQL still can).
"use strict";
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
let D = () => require("./dbServer");
function setDb(f) { D = () => f; }
function where(o) {
  const a = o || {}; let scope = a.scope, db = a.db;
  if (!db) { const L = require("./webDb").link(); if (!L) throw bad("the site has no database yet - 🗂 CRM ▸ 🗄 Create the site's database (or pick one)", 409); scope = L.scope; db = L.name; }
  scope = scope === "external" ? "external" : "project";
  return { scope, db: D().ident(db) };
}
async function info(o) {
  const w = where(o), s = await D().schema(w.scope, w.db);
  return Object.assign({}, w, { tables: s.tables });
}
async function tableOf(w, table) {
  const t = D().ident(table), s = await D().schema(w.scope, w.db), T = s.tables.find((x) => x.name === t);
  if (!T) throw bad("no table called " + t, 404);
  return T;
}
const pkOf = (T) => T.columns.filter((c) => c.key === "PRI").map((c) => c.name);
function keyWhere(T, key) {
  const pk = pkOf(T); if (!pk.length) throw bad(`${T.name} has no primary key - change it with SQL`, 409);
  const k = key || {}; if (!pk.every((c) => c in k)) throw bad("the row's key is missing");
  return { sql: pk.map((c) => "`" + c + "` = ?").join(" AND "), args: pk.map((c) => k[c]) };
}
const run = async (w, sql, args) => { const c = await D().conn(w.scope, w.db); try { const [r] = await c.execute(sql, args || []); return r; } finally { try { await c.end(); } catch (e) { /* closed */ } } };
async function cell(o) {
  const w = where(o), T = await tableOf(w, o.table); if (T.kind === "view") throw bad("a view can not be edited");
  const col = D().ident(o.col); if (!T.columns.some((c) => c.name === col)) throw bad("no column " + col);
  const k = keyWhere(T, o.key), v = o.value === null || o.value === undefined ? null : String(o.value);
  const r = await run(w, "UPDATE `" + T.name + "` SET `" + col + "` = ? WHERE " + k.sql + " LIMIT 1", [v].concat(k.args));
  return { ok: true, affected: r.affectedRows };
}
async function insert(o) {
  const w = where(o), T = await tableOf(w, o.table); if (T.kind === "view") throw bad("a view can not be edited");
  const vals = o.values || {}, cols = T.columns.filter((c) => c.name in vals && vals[c.name] !== "" && vals[c.name] != null);
  const r = cols.length ? await run(w, "INSERT INTO `" + T.name + "` (" + cols.map((c) => "`" + c.name + "`").join(", ") + ") VALUES (" + cols.map(() => "?").join(", ") + ")", cols.map((c) => String(vals[c.name])))
    : await run(w, "INSERT INTO `" + T.name + "` () VALUES ()");
  return { ok: true, insertId: r.insertId || null };
}
async function remove(o) {
  const w = where(o), T = await tableOf(w, o.table); if (T.kind === "view") throw bad("a view can not be edited");
  const k = keyWhere(T, o.key), r = await run(w, "DELETE FROM `" + T.name + "` WHERE " + k.sql + " LIMIT 1", k.args);
  return { ok: true, affected: r.affectedRows };
}
const csvCell = (v) => { if (v === null || v === undefined) return ""; const s = v instanceof Date ? v.toISOString() : Buffer.isBuffer(v) ? v.toString("base64") : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function allRows(w, t) { const c = await D().conn(w.scope, w.db); try { const [r, f] = await c.query("SELECT * FROM `" + t + "`"); return { rows: r, cols: (f || []).map((x) => x.name), c: null }; } finally { try { await c.end(); } catch (e) { /* closed */ } } }
async function exportTable(o) {
  const w = where(o), T = await tableOf(w, o.table);
  if (o.format === "sql") return { name: T.name + ".sql", type: "application/sql", text: await dump(Object.assign({}, o, { only: [T.name] })) };
  const { rows, cols } = await allRows(w, T.name);
  return { name: T.name + ".csv", type: "text/csv", text: [cols.map(csvCell).join(",")].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\r\n") + "\r\n" };
}
async function dump(o) {
  const w = where(o), s = await D().schema(w.scope, w.db), c = await D().conn(w.scope, w.db);
  const out = [`-- ${w.db} - written by bitGen Studio's Web editor (🗄 DB) ${new Date().toISOString()}`, "SET FOREIGN_KEY_CHECKS = 0;", ""];
  try {
    const tables = s.tables.filter((t) => t.kind === "table" && (!o.only || o.only.includes(t.name))), views = s.tables.filter((t) => t.kind === "view" && !o.only);
    for (const t of tables) {
      const [[cr]] = await c.query("SHOW CREATE TABLE `" + t.name + "`");
      out.push("DROP TABLE IF EXISTS `" + t.name + "`;", cr["Create Table"] + ";");
      const [rows] = await c.query("SELECT * FROM `" + t.name + "`");
      for (let i = 0; i < rows.length; i += 100) {
        const part = rows.slice(i, i + 100), cols = Object.keys(part[0]);
        out.push("INSERT INTO `" + t.name + "` (" + cols.map((x) => "`" + x + "`").join(", ") + ") VALUES\n" + part.map((r) => "(" + cols.map((x) => c.escape(r[x])).join(", ") + ")").join(",\n") + ";");
      }
      out.push("");
    }
    for (const v of views) { const [[cr]] = await c.query("SHOW CREATE VIEW `" + v.name + "`"); out.push("DROP VIEW IF EXISTS `" + v.name + "`;", String(cr["Create View"]).replace(/DEFINER=`[^`]*`@`[^`]*`\s*/i, "") + ";", ""); }
  } finally { try { await c.end(); } catch (e) { /* closed */ } }
  out.push("SET FOREIGN_KEY_CHECKS = 1;");
  return out.join("\n") + "\n";
}
async function importSql(o) {
  const w = where(o), list = D().splitSql(o.sql); if (!list.length) throw bad("no SQL in it");
  if (String(o.sql || "").length > 50 * 1024 * 1024) throw bad("that file is over 50 MB - load it on the server", 413);
  let done = 0; const c = await D().conn(w.scope, w.db);
  try { for (const q of list) { try { await c.query(q); done++; } catch (e) { return { ok: false, done, total: list.length, error: e.message, at: q.slice(0, 200) }; } } }
  finally { try { await c.end(); } catch (e) { /* closed */ } }
  return { ok: true, done, total: list.length };
}
module.exports = { setDb, where, info, cell, insert, remove, exportTable, dump, importSql, csvCell, pkOf };
