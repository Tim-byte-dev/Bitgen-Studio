#!/usr/bin/env node
/* bitGen Studio — 2.842.0 in a REAL browser: the 🗄 Database docker - a global database on bitGen's own MariaDB, "create a
 * database for my shop …" in the prompt docker -> the design's SQL in the docker (a stand-in LLM) -> ▶ Run -> the tables / view
 * with their fields -> a table's rows -> ⌨ SQL. Tim: "allow user to create a mysql or mariadb inside the project or global,
 * llm will create all of the tables,fields and views". Needs MariaDB on this computer (else SKIP) and the running app (H3_URL). */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
const SQL = "CREATE TABLE IF NOT EXISTS customers (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL) ENGINE=InnoDB; CREATE TABLE IF NOT EXISTS orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, total DECIMAL(12,2) NOT NULL DEFAULT 0, FOREIGN KEY (customer_id) REFERENCES customers(id)) ENGINE=InnoDB; CREATE OR REPLACE VIEW v_customer_totals AS SELECT c.name, SUM(o.total) AS spent FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id; INSERT INTO customers (name) VALUES ('Ann'), ('Bo');";
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You design MariaDB/.test(all) ? JSON.stringify({ explain: "Customers, their orders, and a view of what each spent.", sql: SQL }) : "an ordinary chat answer";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const st0 = await api("GET", "api/db/status");
  if (!st0.server) { console.log("SKIP: no MariaDB on this computer"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.addInitScript(() => { try { localStorage.setItem("h3.db.scope", "global"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Db && document.getElementById("dbdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const strip = await ev(() => { const b = document.getElementById("tX_dbdock"); return { btn: !!b, inStrip: !!(b && b.closest("#appGrp1")) }; });
    check("the 🗄 Database button is on the top bar's app strip (after 🎞 Slides)", strip.btn && strip.inStrip, strip);
    // the prompt docker: "create a database for my shop …"
    const reply = await ev(async () => { for (const r of window.H3ChatRoutes) { const out = await r("create a database for my shop with customers and orders, and what each customer spent"); if (out != null) return out; } return null; });
    await p.waitForTimeout(500);
    const d1 = await ev(() => ({ shown: !document.getElementById("dbdock").classList.contains("dockgone"), sql: document.getElementById("dbDesignSql").value, explain: document.getElementById("dbExplain").textContent, db: document.getElementById("dbDbSel").value, scope: document.getElementById("dbScope").value }));
    check("\"create a database for my shop …\" in the prompt docker: the 🗄 docker opens (global), a database \"shop\" made, the design's SQL shown to read first (not run)",
      d1.shown && d1.scope === "global" && d1.db === "shop" && /CREATE TABLE IF NOT EXISTS customers/.test(d1.sql) && /CREATE OR REPLACE VIEW v_customer_totals/.test(d1.sql) && /what each spent/.test(d1.explain) && /statement\(s\)/.test(reply || "") && /You design MariaDB/.test(asked.join("\n")), { d1, reply });
    const before = await api("GET", "api/db/schema?scope=global&db=shop");
    check("…nothing runs until ▶ Run (the database is still empty)", before.tables && before.tables.length === 0, before);
    await ev(() => document.getElementById("dbDesignRun").click());
    await p.waitForFunction(() => /✓/.test(document.getElementById("dbDesignOut").textContent) && document.querySelectorAll("#dbTables .dbt").length >= 3, null, { timeout: 15000 });
    const d2 = await ev(() => ({ out: document.getElementById("dbDesignOut").textContent, tables: [...document.querySelectorAll("#dbTables .dbt")].map((x) => x.dataset.t), cols: document.getElementById("dbTables").textContent }));
    check("▶ Run: every statement ✓; the tables (customers, orders) and the view listed with their fields - 🔑 the key, 🔗 the link",
      !/✗/.test(d2.out) && ["customers", "orders", "v_customer_totals"].every((t) => d2.tables.includes(t)) && /🔑 id/.test(d2.cols) && /🔗 customer_id/.test(d2.cols), d2);
    await ev(() => [...document.querySelectorAll("#dbTables .dbt")].find((x) => x.dataset.t === "customers").click());
    await p.waitForFunction(() => /2 row/.test(document.getElementById("dbDataMsg").textContent), null, { timeout: 8000 });
    const d3 = await ev(() => ({ msg: document.getElementById("dbDataMsg").textContent, cells: [...document.querySelectorAll("#dbData td")].map((x) => x.textContent) }));
    check("a table clicked: 📋 Data shows its rows", d3.cells.includes("Ann") && d3.cells.includes("Bo"), d3);
    await ev(() => { document.querySelector('#dbTabs button[data-tab="sql"]').click(); document.getElementById("dbSql").value = "INSERT INTO orders (customer_id, total) VALUES (1, 12.5), (2, 3); SELECT * FROM v_customer_totals ORDER BY name;"; document.getElementById("dbSqlRun").click(); });
    await p.waitForFunction(() => /row\(s\)/.test(document.getElementById("dbSqlOut").textContent) && document.querySelectorAll("#dbSqlOut td").length, null, { timeout: 8000 });
    const d4 = await ev(() => [...document.querySelectorAll("#dbSqlOut td")].map((x) => x.textContent));
    check("⌨ SQL: statements run in order, a SELECT's rows shown (the view sums the orders)", d4.includes("Ann") && d4.includes("12.50") && d4.includes("3.00"), d4);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally {
    try { await api("POST", "api/db/drop", { scope: "global", name: "shop" }); await api("POST", "api/db/stop", { scope: "global" }); } catch (e) { /* fine */ }
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
