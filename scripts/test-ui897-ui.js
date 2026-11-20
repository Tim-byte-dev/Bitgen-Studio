#!/usr/bin/env node
/* bitGen Studio — 2.897.0 in a REAL browser: 💳 the business details dialog's 🗄 Where they are kept… - a profile saved on this
 * computer, the line says so; 🗄 bitGen's own database picked + ✔ Keep them there: the message (1 sent), the line "🗄 Kept in
 * bitgen_business on bitGen's own database · synced …", ⟳ Sync shown; a profile put straight into the database (as another
 * computer would) shows in Saved details after ⟳ Sync; 📁 back on this computer. Needs MariaDB on the test server's computer -
 * else the database part SKIPs. */
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
const J = async (u, o) => (await fetch(URL_ + u, o)).json();
const post = (u, b) => J(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [];
  try {
    const st0 = await J("api/business/store");
    if (st0.mode !== "file") await post("api/business/store", { mode: "file" });
    const mine = await post("api/business/profiles", { profile: { company: "UI897 Bakery", name: "Rosie Smith", phone: "0412 345 678", services: ["Bread"] } }); made.push(mine.id);
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.bizInfo, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((x) => { x.style.display = "none"; }); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => window.imageEditorInstance.E.bizInfo.dialog("card", {}));
    await p.waitForSelector("#pcbzWhere", { timeout: 10000 }); await p.waitForTimeout(800);
    const f0 = await ev(() => ({ where: document.getElementById("pcbzWhere").textContent, sync: document.getElementById("pcbzSync").hidden, box: document.getElementById("pcbzStore").hidden, picks: [...document.querySelectorAll("#pcbzPick option")].map((o) => o.textContent) }));
    check("💳 the details box says they are kept on this computer (business/profiles.json); no ⟳ Sync; the choices folded away", /Kept on this computer for next time \(business\/profiles\.json\)/.test(f0.where) && f0.sync && f0.box && f0.picks.some((t) => /UI897 Bakery/.test(t)), f0);
    await p.click("#pcbzStoreBtn");
    const f1 = await ev(() => ({ box: document.getElementById("pcbzStore").hidden, file: document.querySelector('input[name="pcbzWhereR"][value="file"]').checked, db: document.getElementById("pcbzDbName").value }));
    check("🗄 Where they are kept… opens the choices: this computer ticked, the database bitgen_business", !f1.box && f1.file && f1.db === "bitgen_business", f1);
    if (!st0.mariadb) { console.log("SKIP: no MariaDB beside the test server - the database part"); }
    else {
      await p.check('input[name="pcbzWhereR"][value="global"]');
      await p.click("#pcbzMove");
      await p.waitForFunction(() => /kept in bitgen_business|⚠/.test(document.getElementById("pcbzStoreMsg").textContent), null, { timeout: 120000 });
      await p.waitForFunction(() => /🗄 Kept/.test(document.getElementById("pcbzWhere").textContent), null, { timeout: 20000 }).catch(() => {});
      const f2 = await ev(() => ({ msg: document.getElementById("pcbzStoreMsg").textContent, where: document.getElementById("pcbzWhere").textContent, sync: document.getElementById("pcbzSync").hidden }));
      check("✔ Keep them there (bitGen's own database): moved - '1 sent from this computer', the line '🗄 Kept in bitgen_business on bitGen's own database · synced …', ⟳ Sync shown",
        /kept in bitgen_business on bitGen's own database \(this computer\) now - \d+ sent from this computer/.test(f2.msg) && /🗄 Kept in bitgen_business on bitGen's own database \(this computer\) · synced/.test(f2.where) && !f2.sync, f2);
      const st1 = await J("api/business/store");
      check("...GET /api/business/store: mode db, global, nothing waiting", st1.mode === "db" && st1.scope === "global" && st1.waiting === 0 && !st1.lastError, st1);
      // another computer's profile straight into the database
      await post("api/db/sql", { scope: "global", db: "bitgen_business", sql: "INSERT INTO business_profiles (id, company, name, front, back, created, updated, updated_by) VALUES ('ui897other', 'UI897 Other Co', 'Sam Lee', '', '', '2026-11-20T01:00:00Z', '2026-11-20T01:00:00Z', 'laptop')" });
      made.push("ui897other");
      await p.click("#pcbzSync");
      await p.waitForFunction(() => [...document.querySelectorAll("#pcbzPick option")].some((o) => /UI897 Other Co/.test(o.textContent)), null, { timeout: 30000 }).catch(() => {});
      const f3 = await ev(() => [...document.querySelectorAll("#pcbzPick option")].map((o) => o.textContent));
      check("⟳ Sync: a profile another computer put in the database shows in Saved details", f3.some((t) => /UI897 Other Co - Sam Lee/.test(t)) && f3.some((t) => /UI897 Bakery/.test(t)), f3);
      const sav = await post("api/business/profiles", { profile: { company: "UI897 Third", name: "Ann" } }); made.push(sav.id);
      const inDb = await post("api/db/sql", { scope: "global", db: "bitgen_business", sql: "SELECT company FROM business_profiles ORDER BY company" });
      check("a save goes to the database at once (the save's answer says where; the row is there)", sav.store && sav.store.mode === "db" && !sav.store.offline && JSON.stringify(inDb).includes("UI897 Third"), { store: sav.store, inDb });
      await p.check('input[name="pcbzWhereR"][value="file"]');
      await p.click("#pcbzMove");
      await p.waitForFunction(() => /kept on this computer only now|⚠/.test(document.getElementById("pcbzStoreMsg").textContent), null, { timeout: 30000 });
      await p.waitForFunction(() => /Kept on this computer for next time/.test(document.getElementById("pcbzWhere").textContent), null, { timeout: 20000 }).catch(() => {});
      const f4 = await ev(() => ({ msg: document.getElementById("pcbzStoreMsg").textContent, where: document.getElementById("pcbzWhere").textContent, picks: [...document.querySelectorAll("#pcbzPick option")].map((o) => o.textContent) }));
      check("📁 back on this computer: said, the line says so, all three still there", /kept on this computer only now/.test(f4.msg) && /Kept on this computer for next time/.test(f4.where) && ["UI897 Bakery", "UI897 Other Co", "UI897 Third"].every((n) => f4.picks.some((t) => t.includes(n))), f4);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    // the test's details out of the database too (into it again for the deletes, then back to a file), then the database itself
    try {
      if (made.length > 1) { await post("api/business/store", { mode: "db", scope: "global" }); for (const id of made) { try { await fetch(URL_ + "api/business/profiles/" + id, { method: "DELETE" }); } catch { /* gone */ } } }
      const st = await J("api/business/store"); if (st.mode !== "file") await post("api/business/store", { mode: "file" });
      if (made.length > 1) await post("api/db/drop", { scope: "global", name: "bitgen_business" });
      if (made.length > 1) await post("api/db/stop", { scope: "global" });   // port 3407 free again for the live tests
    } catch { /* fine */ }
    for (const id of made) { try { await fetch(URL_ + "api/business/profiles/" + id, { method: "DELETE" }); } catch { /* gone */ } }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
