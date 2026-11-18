#!/usr/bin/env node
/* bitGen Studio — 2.842.0 units: 🗄 databases - bitGen's own MariaDB per project / global, or your server; the LLM designs
 * the tables, fields and views.
 *   dbServer splitSql / downloadFor / scopeInfo / ident; dbAi checkSql (no DROP TABLE, no GRANT …) / design (a stand-in LLM);
 *   dbdock wants / gridHtml; the wiring. With a MariaDB on this computer (mariadbd on the PATH or /usr/sbin): a real server -
 *   made, started (root's own password), a database, a design run, the schema with keys / links / a view, rows, stopped. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const D = require(path.join(ROOT, "lib/dbServer.js")), A = require(path.join(ROOT, "lib/dbAi.js")), K = require(path.join(ROOT, "ext/dbdock/dbdock.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  const sp = D.splitSql("CREATE TABLE a (x VARCHAR(5) DEFAULT ';'); -- a comment; here\n/* block; */ INSERT INTO a VALUES ('it''s; ok'), (\"q;\");\n# hash; comment\nSELECT `we;ird` FROM a");
  check("splitSql: statements split on ; outside quotes, back-ticks and comments", sp.length === 3 && /DEFAULT ';'/.test(sp[0]) && /'it''s; ok'/.test(sp[1]) && /"q;"/.test(sp[1]) && /`we;ird`/.test(sp[2]), sp);
  check("downloadFor: Windows .zip / Linux tarball from archive.mariadb.org, none for macOS (Homebrew)", /winx64-packages\/mariadb-[\d.]+-winx64\.zip$/.test(D.downloadFor("win32", "x64").url) && /linux-systemd-x86_64\.tar\.gz$/.test(D.downloadFor("linux", "x64").url) && D.downloadFor("darwin", "arm64") === null);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t842-")); D.setBase(tmp, path.join(tmp, "projects", "p1", "db"));
  const g = D.scopeInfo("global"), p = D.scopeInfo("project");
  let e1 = null; try { D.scopeInfo("nope"); } catch (e) { e1 = e; }
  check("scopes: global on 3407 in <app>/db, a project its own port (3408+) in projects/<p>/db, nothing else", g.port === 3407 && g.dir === path.join(tmp, "db") && p.port >= 3408 && p.port < 3908 && p.dir === path.join(tmp, "projects", "p1", "db") && e1 && e1.status === 400);
  let e2 = null; try { D.ident("x; DROP"); } catch (e) { e2 = e; }
  check("ident: names are letters / digits / _ / $ only", D.ident("shop_1") === "shop_1" && e2 && e2.status === 400);
  const c1 = A.checkSql("CREATE TABLE IF NOT EXISTS t (id INT); CREATE OR REPLACE VIEW v AS SELECT 1; CREATE INDEX i ON t(id); ALTER TABLE t ADD c INT; INSERT INTO t VALUES (1); DROP TABLE t; GRANT ALL ON *.* TO x; SELECT 1 INTO OUTFILE '/tmp/x'; DROP VIEW v");
  check("checkSql: tables / views / indexes / ALTER / sample rows / DROP VIEW kept; DROP TABLE, GRANT, INTO OUTFILE, a bare SELECT left out", c1.statements.length === 6 && c1.problems.length === 3 && !c1.statements.some((s) => /DROP TABLE|GRANT|OUTFILE/.test(s)), c1);
  let seen = null;
  A.setComplete(async (o) => { seen = o; return { ok: true, text: '```json\n{"explain":"Customers and orders.","sql":"CREATE TABLE IF NOT EXISTS customers (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL) ENGINE=InnoDB; CREATE TABLE IF NOT EXISTS orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, total DECIMAL(12,2) NOT NULL DEFAULT 0, FOREIGN KEY (customer_id) REFERENCES customers(id)) ENGINE=InnoDB; CREATE OR REPLACE VIEW v_customer_totals AS SELECT c.name, SUM(o.total) AS spent FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id; DROP TABLE old_stuff;"}\n```' }; });
  const ds = await A.design({ ask: "a shop with customers and orders, and what each customer spent", schema: { tables: [{ name: "old_stuff", kind: "table", columns: [{ name: "id", type: "int", key: "PRI" }] }] }, db: "shop" });
  check("design: the LLM is told what is there and what is wanted; its SQL kept without the DROP TABLE (said as left out); the explain",
    ds.statements === 3 && !/DROP/.test(ds.sql) && ds.left.length === 1 && ds.explain === "Customers and orders." && /TABLE old_stuff \(id int PK\)/.test(seen.messages[1].content) && /never DROP TABLE/.test(seen.messages[0].content), ds);
  check("dbdock wants: create / make / design … database / tables (not spreadsheets, invoices …); gridHtml escapes and shows NULL",
    K.wants("create a database for my shop with customers and orders") && K.wants("Please design the tables for a library") && K.wants("make a spreadsheet of my database") === null && K.wants("make an invoice database") === null && K.wants("hello there") === null
    && /<td title="&lt;b&gt;">&lt;b&gt;<\/td>/.test(K.gridHtml(["a", "b"], [{ a: "<b>", b: null }])) && /NULL/.test(K.gridHtml(["a", "b"], [{ a: 1, b: null }])));
  // a real MariaDB, when this computer has one
  const f = D.find();
  if (!f) console.log("SKIP: no MariaDB on this computer - the live part");
  else {
    try {
      const s1 = await D.start("global"), dbs0 = await D.databases("global");
      await D.createDb("global", "shop");
      const r = await D.run("global", "shop", ds.sql + "; INSERT INTO customers (name) VALUES ('Ann'), ('Bo'); INSERT INTO orders (customer_id, total) VALUES (1, 10.5), (1, 4.5), (2, 7)");
      const sc = await D.schema("global", "shop"), v = (await D.run("global", "shop", "SELECT * FROM v_customer_totals ORDER BY name")).results[0];
      const ord = sc.tables.find((t) => t.name === "orders");
      check("a real MariaDB: started (root's own password), a database, the design run, the schema (key, the link orders.customer_id -> customers.id, the view), the view's rows",
        s1.ok && s1.port === 3407 && !dbs0.includes("mysql") && r.results.every((x) => x.ok) && ord && ord.columns.find((c) => c.name === "customer_id").ref === "customers.id" && sc.tables.some((t) => t.kind === "view" && t.name === "v_customer_totals")
        && v.rows.length === 2 && +v.rows[0].spent === 15 && D.status().scopes.global.running, { r, v });
      const bad = await D.run("global", "shop", "INSERT INTO orders (customer_id) VALUES (99); SELECT 1");
      check("…a bad statement stops the run with MariaDB's reason (the foreign key)", bad.results.length === 1 && !bad.results[0].ok && /foreign key/i.test(bad.results[0].error), bad);
      const rw = await D.rows("global", "shop", "customers", 1, 1);
      check("…rows: a page of a table + how many there are", rw.total === 2 && rw.rows.length === 1 && rw.rows[0].name === "Bo" && rw.columns.join() === "id,name", rw);
      await D.stop("global"); const s2 = await D.start("global"), still = await D.databases("global"); await D.stop("global");
      check("…stopped and started again: the data is kept, root's password works", s2.ok && still.includes("shop") && !D.status().scopes.global.running);
    } catch (e) { check("a real MariaDB: " + e.message, false); D.stopAll(); }
  }
  A.setComplete(null);
  const RI = read("routes/index.js"), SV = read("misc/server.js"), EX = JSON.parse(read("ext/dbdock/ext.json")), DH = read("ext/dbdock/dock.html"), AS = read("static/appstrip.js"), XS = read("lib/exitSweep.js"), GI = read(".gitignore"), PK = JSON.parse(read("package.json"));
  check("the wiring: /api/db from routes/index.js (not server.js); the 🗄 docker (ext/dbdock) on the app strip; its servers stopped when bitGen exits; mariadb/ + db/ git-ignored; mysql2 (MIT)",
    /require\("\.\/db"\)\.mount\(app\)/.test(RI) && !/\/api\/db\b/.test(SV) && EX.id === "dbdock" && EX.scripts.includes("dbdock.js") && /<div class="bdock" id="dbdock"/.test(DH) && /\["tX_dbdock", "🗄", "Database"\]/.test(AS)
    && /require\("\.\/dbServer"\)\.stopAll\(\)/.test(XS) && /^\/mariadb\/$/m.test(GI) && /^\/db\/$/m.test(GI) && PK.dependencies.mysql2);
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); D.stopAll(); process.exit(1); });
