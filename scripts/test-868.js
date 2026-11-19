#!/usr/bin/env node
/* bitGen Studio — 2.868.0 units: 🗄 the Web editor's DB manager - lib/webDbAdmin.js with a stand-in database (the SQL it sends is
 * parameterised, names checked, the CRM's link used, no key = refused), CSV cells, the tab's danger() check (asked before DROP / DELETE /
 * UPDATE …, not for words inside quotes); the wiring (the 🗄 DB tab, routes, wbdbm.js). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const A = require(path.join(ROOT, "lib/webDbAdmin.js")), W = require(path.join(ROOT, "lib/webProject.js")), real = require(path.join(ROOT, "lib/dbServer.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t868-")), PJ = path.join(tmp, "projects", "Cafe"); fs.mkdirSync(path.join(PJ, "web"), { recursive: true });
  W.setProjectDir(() => PJ);
  const sent = [];
  const schema = { tables: [{ name: "notes", kind: "table", columns: [{ name: "id", key: "PRI" }, { name: "title", key: "" }] }, { name: "v", kind: "view", columns: [{ name: "x", key: "" }] }, { name: "nokey", kind: "table", columns: [{ name: "a", key: "" }] }] };
  A.setDb({ ident: real.ident, schema: async () => schema, conn: async () => ({ execute: async (s, a) => { sent.push([s, a]); return [{ affectedRows: 1, insertId: 7 }]; }, end: async () => {} }) });
  let e = ""; try { A.where({}); } catch (x) { e = x.message + x.status; }
  check("no database named and the CRM not linked: said (409)", /Create the site's database/.test(e) && /409/.test(e), e);
  fs.writeFileSync(path.join(PJ, "web", "db.json"), JSON.stringify({ scope: "external", name: "tigeqa_shop" }));
  check("...linked: the CRM's database (and scope) by default; a name given is checked", JSON.stringify(A.where({})) === JSON.stringify({ scope: "external", db: "tigeqa_shop" }) && (() => { try { A.where({ db: "x; DROP" }); return false; } catch (x) { return true; } })());
  await A.cell({ table: "notes", key: { id: 3 }, col: "title", value: "it's" });
  await A.insert({ table: "notes", values: { title: "T", nope: "x", id: "" } });
  await A.remove({ table: "notes", key: { id: 3 } });
  check("the SQL: UPDATE / INSERT / DELETE with ? for every value, only the table's own columns (unknown + blank left out), LIMIT 1 on a key", sent[0][0] === "UPDATE `notes` SET `title` = ? WHERE `id` = ? LIMIT 1" && JSON.stringify(sent[0][1]) === '["it\'s",3]' && sent[1][0] === "INSERT INTO `notes` (`title`) VALUES (?)" && sent[2][0] === "DELETE FROM `notes` WHERE `id` = ? LIMIT 1", sent);
  const refuse = async (f) => { try { await f(); return ""; } catch (x) { return x.message; } };
  check("refused: a view, a table without a key, a missing key, an unknown column, an unknown table", /view/.test(await refuse(() => A.cell({ table: "v", key: {}, col: "x", value: 1 }))) && /no primary key/.test(await refuse(() => A.remove({ table: "nokey", key: { a: 1 } }))) && /key is missing/.test(await refuse(() => A.remove({ table: "notes", key: {} }))) && /no column/.test(await refuse(() => A.cell({ table: "notes", key: { id: 1 }, col: "zz", value: 1 }))) && /no table/.test(await refuse(() => A.cell({ table: "zz", key: {}, col: "a" }))));
  check("CSV cells: plain, quotes doubled, commas / new lines quoted, NULL empty", A.csvCell("a") === "a" && A.csvCell('say "hi"') === '"say ""hi"""' && A.csvCell("a,b") === '"a,b"' && A.csvCell("a\nb") === '"a\nb"' && A.csvCell(null) === "");
  const M = require(path.join(ROOT, "ext/webdock/wbdbm.js"));
  check("the tab asks before DROP / DELETE / UPDATE / TRUNCATE / ALTER - not for the words inside quotes; not for SELECT / INSERT", M.danger("DROP TABLE x") && M.danger("delete from a") && M.danger("UPDATE a SET b=1") && !M.danger("SELECT * FROM t WHERE note = 'please drop by'") && !M.danger("INSERT INTO t VALUES ('delete me')"));
  const R = src("routes/webEditor.js"), D = src("ext/webdock/dock.html"), E = JSON.parse(src("ext/webdock/ext.json")), Wj = src("ext/webdock/webdock.js");
  check("wiring: the 🗄 DB tab + its pane in the main column, wbdbm.js loaded and painted by paintTab, /api/web/dbm (+ cell, insert, delete, import, export)", /data-tab="dbm"/.test(D) && /data-pane="dbm" id="wbDbm"/.test(D) && E.scripts.includes("wbdbm.js") && /St\.tab === "dbm" && root\.WbDbm/.test(Wj) && ["/api/web/dbm\"", "/api/web/dbm/cell", "/api/web/dbm/insert", "/api/web/dbm/delete", "/api/web/dbm/import", "/api/web/dbm/export"].every((u) => R.includes(u)));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
