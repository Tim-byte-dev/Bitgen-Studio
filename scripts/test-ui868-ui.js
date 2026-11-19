#!/usr/bin/env node
/* bitGen Studio — 2.868.0 in a REAL browser: 🗄 the Web editor's DB manager tab on a REAL MariaDB (the CRM's database made first): the
 * site's database picked, its tables, a table's rows; a cell double-clicked + changed, ＋ Row, 🗑 a row (asked), ⌨ SQL with results, a
 * DROP asked first. Against the running app (H3_URL). Needs MariaDB - else SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    const st = await api("/api/db/status");
    if (!st.server) { console.log("SKIP: no MariaDB on the test server"); await b.close(); console.log("\nRESULT: 0 passed, 0 failed"); return; }
    await api("/api/web/create", {});
    const mk = await api("/api/web/db/create", { scope: "project", name: "ui868_site" });
    if (mk.error) throw new Error("db create: " + mk.error);
    await api("/api/web/records", { kind: "clients", record: { name: "Ann Lee", email: "ann@example.com" } });
    await api("/api/web/records", { kind: "clients", record: { name: "Bo Chan", email: "bo@example.com" } });
    let asked = []; p.removeAllListeners("dialog"); p.on("dialog", (d) => { asked.push(d.message()); d.accept().catch(() => {}); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.WbDbm, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.click('#webdock .wbtab[data-tab="dbm"]');
    await p.waitForSelector('#wbDbmTables [data-t="clients"]', { timeout: 30000 });
    const v0 = await ev(() => ({ pick: document.getElementById("wbDbmPick").selectedOptions[0].textContent, n: document.querySelectorAll("#wbDbmTables .it").length }));
    check("🗄 DB tab: the site's database picked ('the site's'), its tables listed", /ui868_site \(the site's\)/.test(v0.pick) && v0.n > 20, v0);
    await p.click('#wbDbmTables [data-t="clients"]');
    await p.waitForSelector(".wbDbmGrid td[data-c='email']", { timeout: 10000 });
    const v1 = await ev(() => ({ rows: document.querySelectorAll(".wbDbmGrid tr[data-i]").length, cols: document.querySelector(".wbDbmCols").textContent }));
    check("clients: its rows (2) and columns (🔑 id …)", v1.rows === 2 && /🔑 id/.test(v1.cols), v1);
    const cell = p.locator(".wbDbmGrid tr[data-i] td[data-c='company']").first();
    await cell.dblclick(); await p.waitForSelector(".wbDbmIn");
    await p.fill(".wbDbmIn", "Tiger's Bakery"); await p.press(".wbDbmIn", "Enter");
    await p.waitForFunction(() => /changed/.test(document.getElementById("wbDbmOut").textContent), null, { timeout: 10000 });
    const crm = await api("/api/web/records?kind=clients");
    check("a cell double-clicked, typed, Enter: saved in the database (the CRM shows it)", crm.items.some((c) => c.company === "Tiger's Bakery"), crm.items.map((c) => c.company));
    await p.click("#wbDbmAdd"); await p.fill('#wbDbmAddForm input[data-col="first_name"]', "Cy"); await p.fill('#wbDbmAddForm input[data-col="email"]', "cy@example.com"); await p.click("#wbDbmAddGo");
    await p.waitForFunction(() => document.querySelectorAll(".wbDbmGrid tr[data-i]").length === 3, null, { timeout: 10000 });
    check("＋ Row: a form of the columns, the row added", true);
    await p.click(".wbDbmGrid [data-del]");
    await p.waitForFunction(() => document.querySelectorAll(".wbDbmGrid tr[data-i]").length === 2, null, { timeout: 10000 });
    check("🗑 a row: asked first, deleted", asked.some((m) => /Delete the row id = /.test(m)), asked);
    await p.click("#wbDbmSqlB"); await p.fill("#wbDbmSqlT", "SELECT first_name, email FROM clients ORDER BY email"); await p.press("#wbDbmSqlT", "Control+Enter");
    await p.waitForSelector("#wbDbmRes table", { timeout: 10000 });
    const res = await ev(() => document.getElementById("wbDbmRes").textContent);
    check("⌨ SQL: Ctrl+Enter runs it, the rows shown", /✓ 2 row\(s\)/.test(res) && /email/.test(res), res.slice(0, 200));
    asked = []; await p.fill("#wbDbmSqlT", "CREATE TABLE tmp868 (a INT); DROP TABLE tmp868;"); await p.click("#wbDbmRun");
    await p.waitForFunction(() => /ran 2 statement/.test(document.getElementById("wbDbmOut").textContent), null, { timeout: 10000 });
    check("...a DROP is asked first", asked.some((m) => /removes or changes/.test(m)), asked);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
