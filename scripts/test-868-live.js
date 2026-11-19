#!/usr/bin/env node
/* bitGen Studio — 2.868.0 LIVE: 🗄 the Web editor's DB manager (lib/webDbAdmin.js) on a REAL MariaDB: the site's database found from
 * the CRM's link, a cell changed by the primary key (a value with quotes kept as typed), a row added (blank = the default) and deleted,
 * a view / a table without a key refused, a table as CSV, the whole database as .sql run into a NEW database = the same rows and views.
 * Needs MariaDB - else SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const D = require(path.join(ROOT, "lib/dbServer.js")), f = D.find();
  if (!f || !f.installDb || !/mariadbd/.test(f.bin)) { console.log("SKIP: no MariaDB here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js")), A = require(path.join(ROOT, "lib/webDbAdmin.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t868l-")), P = path.join(tmp, "projects", "Cafe"); fs.mkdirSync(P, { recursive: true });
  D.setBase(tmp, path.join(P, "db")); W.setProjectDir(() => P); DB.setDb(D);
  try {
    W.create(undefined, "Cafe");
    await DB.create({ scope: "project", name: "cafe_site" });
    await D.run("project", "cafe_site", "CREATE TABLE nokey (a INT, b VARCHAR(10)); INSERT INTO nokey VALUES (1, 'x'); CREATE TABLE notes (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(100) NOT NULL DEFAULT 'untitled', body TEXT NULL);");
    const info = await A.info({});
    check("the site's database from the CRM's link; its tables + views with their columns and keys", info.db === "cafe_site" && info.scope === "project" && info.tables.some((t) => t.name === "clients" && t.columns.some((c) => c.name === "id" && c.key === "PRI")) && info.tables.some((t) => t.kind === "view"), info.tables.map((t) => t.name).slice(0, 8));
    const ins = await A.insert({ table: "notes", values: { body: "Rye's back'); DROP TABLE notes; --" } });
    let r = (await D.rows("project", "cafe_site", "notes")).rows;
    check("＋ a row: blank = the column's default ('untitled'), a nasty value kept exactly as typed (parameterised)", ins.insertId === 1 && r[0].title === "untitled" && r[0].body === "Rye's back'); DROP TABLE notes; --", r);
    await A.cell({ table: "notes", key: { id: 1 }, col: "title", value: 'Bread "today"' }); await A.cell({ table: "notes", key: { id: 1 }, col: "body", value: null });
    r = (await D.rows("project", "cafe_site", "notes")).rows;
    check("a cell changed by the primary key; ∅ = NULL", r[0].title === 'Bread "today"' && r[0].body === null, r);
    let e = ""; try { await A.cell({ table: "notes", key: { id: 1 }, col: "title`=1;--", value: "x" }); } catch (x) { e = x.message; }
    let e2 = ""; try { await A.cell({ table: "nokey", key: { a: 1 }, col: "b", value: "y" }); } catch (x) { e2 = x.message; }
    const view = info.tables.find((t) => t.kind === "view"); let e3 = ""; try { await A.remove({ table: view.name, key: {} }); } catch (x) { e3 = x.message; }
    check("refused: a column name that is not a name, a table without a primary key (use SQL), a view", /a name is letters/.test(e) && /no primary key/.test(e2) && /view can not be edited/.test(e3), [e, e2, e3]);
    await A.insert({ table: "notes", values: { title: "Two", body: "line 1\nline, 2" } });
    const csv = await A.exportTable({ table: "notes", format: "csv" });
    check("⤓ CSV: a header line, commas / quotes / new lines quoted", csv.name === "notes.csv" && csv.text.startsWith("id,title,body\r\n") && csv.text.includes('1,"Bread ""today""",\r\n') && csv.text.includes('2,Two,"line 1\nline, 2"'), csv.text);
    const del = await A.remove({ table: "notes", key: { id: 2 } });
    check("🗑 a row by its key", del.affected === 1 && (await D.rows("project", "cafe_site", "notes")).total === 1);
    const dump = await A.dump({});
    await D.createDb("project", "cafe_copy");
    const imp = await A.importSql({ scope: "project", db: "cafe_copy", sql: dump });
    const s1 = await D.schema("project", "cafe_site"), s2 = await D.schema("project", "cafe_copy"), n2 = (await D.rows("project", "cafe_copy", "notes")).rows;
    check("⤓ the whole database as .sql, ⤒ run into a new database: the same tables and views, the rows the same", imp.ok && imp.done > 20 && s1.tables.map((t) => t.name).join() === s2.tables.map((t) => t.name).join() && n2[0].title === 'Bread "today"' && n2[0].body === null, { imp, a: s1.tables.length, b: s2.tables.length });
    const bad = await A.importSql({ scope: "project", db: "cafe_copy", sql: "CREATE TABLE z (a INT); SELECT nonsense FROM nowhere; CREATE TABLE y (a INT);" });
    check("...a .sql with an error: stops there and says which", !bad.ok && bad.done === 1 && /nowhere/.test(bad.error + bad.at), bad);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { try { await D.stop("project"); } catch (e) { /* stopped */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
