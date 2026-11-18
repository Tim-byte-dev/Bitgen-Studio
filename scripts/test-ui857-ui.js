#!/usr/bin/env node
/* bitGen Studio — 2.857.0 in a REAL browser against the real server + a REAL MariaDB: the Web editor's 🗂 CRM ▸ 🗄 Create the
 * site's database…: a client kept in the project -> 🗄 Create and link (this project's MariaDB) -> 🟢 Live, the client brought in;
 * the SITE writes a contact message (as its PHP would) -> ✉ Messages shows it; a client added in the CRM is a row in the
 * database; Unlink. Needs MariaDB here - else SKIP. Against the running app (H3_URL). No Playwright = SKIP. */
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
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  const st = await api("/api/db/status");
  if (!st.server) { console.log("SKIP: no MariaDB on the test server"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/web/create", {});
    await api("/api/web/records", { kind: "clients", record: { name: "Ann Lee", email: "ann@example.com" } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && document.getElementById("webdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForSelector("#wbDbMake", { timeout: 20000 });
    await p.click('#webdock .wbtab[data-tab="crm"]'); await p.click('#wbCrmNav [data-kind="clients"]');
    await p.waitForSelector("#wbCrmList tr.r");
    const before = await ev(() => ({ box: document.getElementById("wbDbBox").textContent, note: document.getElementById("wbCrmNote").textContent }));
    check("not linked: 📁 Kept in the project (not live) + 🗄 Create the site's database…", /Kept in the project/.test(before.box) && /web\/crm\.json/.test(before.note), before);
    await p.click("#wbDbMake");
    await p.fill("#wbDbName", "rosie_live");
    await p.click("#wbDbGo");
    await p.waitForFunction(() => /Live: rosie_live/.test(document.getElementById("wbDbBox").textContent) || /✗/.test(document.getElementById("wbDbMsg").textContent), null, { timeout: 120000 });
    const after = await ev(() => ({ box: document.getElementById("wbDbBox").textContent, msg: document.getElementById("wbMsg").textContent, err: document.getElementById("wbDbMsg").textContent, rows: [...document.querySelectorAll("#wbCrmList tr.r td")].map((t) => t.textContent), note: document.getElementById("wbCrmNote").textContent }));
    check("🗄 Create and link: 🟢 Live: rosie_live (this computer), the project's client brought in, the note says live", /Live: rosie_live/.test(after.box) && /this computer/.test(after.box) && /brought in 1 clients/.test(after.msg) && /inc\/config\.php/.test(after.msg) && after.rows.includes("Ann Lee") && /Live from the database rosie_live/.test(after.note), after);
    // the site writes a contact message
    const ins = await api("/api/db/sql", { scope: "project", db: "rosie_live", sql: "INSERT INTO messages (name, email, message) VALUES ('Site Visitor', 'v@example.com', 'Do you deliver?')" });
    await p.click('#wbCrmNav [data-kind="messages"]');
    await p.waitForFunction(() => [...document.querySelectorAll("#wbCrmList tr.r td")].some((t) => t.textContent === "Site Visitor"), null, { timeout: 10000 });
    check("LIVE: a message the site's contact form wrote shows in ✉ Messages", true, ins);
    await p.click('#wbCrmNav [data-kind="clients"]'); await p.click("#wbCrmNew");
    await p.fill("#wbF_name", "Pat Smith"); await p.fill("#wbF_email", "pat@example.com"); await p.click("#wbFSave");
    await p.waitForFunction(() => [...document.querySelectorAll("#wbCrmList tr.r td")].some((t) => t.textContent === "Pat Smith"), null, { timeout: 10000 });
    const rows = await api("/api/db/sql", { scope: "project", db: "rosie_live", sql: "SELECT first_name, last_name, email FROM clients ORDER BY id" });
    const rr = ((rows.results || [])[0] || {}).rows || [];
    check("a client added in the CRM is a row in the site's database (name split)", rr.some((x) => x.first_name === "Pat" && x.last_name === "Smith" && x.email === "pat@example.com"), rr);
    await p.click("#wbDbUnlink");
    await p.waitForFunction(() => /Kept in the project/.test(document.getElementById("wbDbBox").textContent), null, { timeout: 10000 });
    check("Unlink: back to the project's file", true);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { try { await api("/api/db/stop", { scope: "project" }); } catch (e) { /* stopped */ } await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
