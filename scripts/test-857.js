#!/usr/bin/env node
/* bitGen Studio — 2.857.0 units: 🗄 the CRM's live database (lib/webDb.js) with a stand-in database server: your server not set
 * up = said (412); a host that refuses CREATE DATABASE = its own database used; www/inc/config.php = the host, name, user, never
 * a password (an existing config's lines changed in place, the rest kept); the routes send the customers' kinds to the database
 * only while linked; the docker's 🗄 box + form. The real MariaDB run is test-857-live.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const W = require(path.join(ROOT, "lib/webProject.js")), DB = require(path.join(ROOT, "lib/webDb.js")), SC = require(path.join(ROOT, "lib/siteCal.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t857-")), P = path.join(tmp, "Shop"); fs.mkdirSync(P); W.setProjectDir(() => P); W.create(undefined, "Shop");
  const calls = []; let ext = { host: "", port: 3306, user: "", database: "" }, refuseCreate = false;
  const fake = { externalCfg: () => ext, databases: async () => { calls.push("databases"); if (refuseCreate) throw new Error("Access denied"); return []; }, createDb: async (s, n) => { calls.push("create " + s + " " + n); return { ok: true, name: n }; },
    run: async (s, db, sql) => { calls.push("run " + s + " " + db + " " + sql.slice(0, 30)); return { results: [{ ok: true, rows: [] }] }; }, conn: async () => ({ execute: async () => [[]], end: async () => {} }) };
  DB.setDb(fake); SC.setDb(fake);
  let e1 = null; try { await DB.create({ scope: "external" }); } catch (e) { e1 = e; }
  check("🌐 your server not set up: said (412), nothing made", e1 && e1.status === 412 && /⚙ Your server/.test(e1.message) && !calls.length, e1 && e1.message);
  ext = { host: "db.tigerart.com.au", port: 3307, user: "timpaul_site", database: "timpaul_bitgen" }; refuseCreate = true;
  const r = await DB.create({ scope: "external", importLocal: false });
  check("a host that refuses to list / make databases: its own database (from ⚙ Your server) is used and linked", r.name === "timpaul_bitgen" && !r.made && DB.link().scope === "external" && DB.link().name === "timpaul_bitgen" && calls.some((c) => /^run external timpaul_bitgen/.test(c)), { r, calls });
  const cfg = fs.readFileSync(path.join(P, "www/inc/config.php"), "utf8");
  check("www/inc/config.php: the host:port, database, user (+ the admin's = the same database); the password only from the server", /'DB_HOST'\) \?: 'db\.tigerart\.com\.au:3307'/.test(cfg) && /'DB_NAME'\) \?: 'timpaul_bitgen'/.test(cfg) && /'DB_USER'\) \?: 'timpaul_site'/.test(cfg) && /'ADMIN_DB_NAME'\) \?: 'timpaul_bitgen'/.test(cfg) && /define\('DB_PASS', getenv\('DB_PASS'\) \?: ''\);/.test(cfg), cfg);
  fs.writeFileSync(path.join(P, "www/inc/config.php"), "<?php\ndefine('DB_HOST', getenv('DB_HOST') ?: 'old');\ndefine('DB_PASS', getenv('DB_PASS') ?: 'secret-on-server');\ndefine('SMTP', 'keep me');\n");
  DB.writeConfig("project", "shop_site", null);
  const cfg2 = fs.readFileSync(path.join(P, "www/inc/config.php"), "utf8");
  check("an existing config: those lines changed in place, its password + other lines kept", new RegExp("'DB_HOST'\\) \\?: '" + "local" + "host'").test(cfg2) && /secret-on-server/.test(cfg2) && /keep me/.test(cfg2) && (cfg2.match(/define\('DB_HOST'/g) || []).length === 1 && /'DB_NAME'\) \?: 'shop_site'/.test(cfg2), cfg2);
  check("database names: from the project, letters / digits / _", DB.nameOf("Rosie's Bakery_site") === "rosie_s_bakery_site" && DB.nameOf("2026 shop") === "site_2026_shop");
  DB.unlink(); fs.rmSync(tmp, { recursive: true, force: true });
  const R = src("routes/webEditor.js"), H = src("ext/webdock/webdock.js"), DH = src("ext/webdock/dock.html");
  check("the routes: the customers' kinds go to the database only while linked (posts / products stay in content.json); /api/web/db, /create, /unlink", /live = \(k\) => DB\(\)\.CRM\.includes\(k\) && !!DB\(\)\.link\(\)/.test(R) && /app\.post\("\/api\/web\/db\/create"/.test(R) && /app\.post\("\/api\/web\/db\/unlink"/.test(R) && DB.CRM.join() === "clients,bookings,orders,messages");
  check("the docker: 🗄 Create the site's database… (this project / your server, a name, bring the records), 🟢 Live + Unlink, read again every 30 s; MariaDB missing = the Database docker's download box", /id="wbDbForm"/.test(DH) && /value="project" checked/.test(DH) && /value="external"/.test(DH) && /id="wbDbImport" checked/.test(DH) && /🟢 Live: /.test(H) && /30000\)/.test(H) && /H3Db\.ready\(\)/.test(H));
  check("the SQL is parameterised (execute with ?) - no typed value in SQL text", /c\.execute\(sql, params/.test(src("lib/webDb.js")) && !/\$\{r\.|\$\{S\(/.test(src("lib/webDb.js").split("async function save")[1].split("const CRM")[0].replace(/DELETE FROM \$\{T\}/, "")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
