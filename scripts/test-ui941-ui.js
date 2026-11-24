#!/usr/bin/env node
/* bitGen Studio — 2.941.0 in a REAL browser: 🔒 Settings ▸ Security ▸ Email (optional) + 💬 Join the community - a wrong email
 * is refused, a right one kept; Join closes Settings, opens 💬 Community with its join form filled (user ID, display name,
 * email; the password left empty) and sends nothing to the community. Against the running app (H3_URL). */
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
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const sent = []; p.on("request", (r) => { if (/\/api\/community\/(join|call\/)/.test(r.url()) && r.method() === "POST" && /join/.test(r.url())) sent.push(r.url()); });
  const ev = (f, a) => p.evaluate(f, a);
  const api = (url, body) => ev(([u, bo]) => fetch(u, bo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bo) } : {}).then((r) => r.json()), [url, body]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Security && window.H3Community && document.getElementById("sec_join"), null, { timeout: 30000 });
    await api("/api/security", { ask: false, user: "", name: "", email: "" });
    await api("/api/community/signout", {});
    await ev(() => window.H3Community.refresh());
    await ev(() => document.getElementById("openSettings").click()); await p.waitForTimeout(400);
    await p.click('#settings .stabs button[data-stab="security"]'); await p.waitForTimeout(500);
    await p.fill("#sec_email", "not-an-email"); await p.click("#sec_save"); await p.waitForTimeout(500);
    check("Email: a wrong one is refused and said so", /doesn't look right/.test(await ev(() => document.getElementById("sec_msg").textContent)) && (await api("/api/security")).email === "");
    await p.fill("#sec_name", "Timmy"); await p.fill("#sec_user", "tim paul"); await p.fill("#sec_email", "tim@example.com");
    await p.click("#sec_join");
    await p.waitForTimeout(1200);
    const s = await api("/api/security");
    check("💬 Join the community: what was typed is saved first (email kept on this PC)", s.email === "tim@example.com" && s.name === "Timmy" && s.user === "tim paul", s);
    const o = await ev(() => { const g = (id) => (document.getElementById(id) || {}).value; const panel = document.getElementById("cmHandle");
      return { settings: document.getElementById("settings").open, shown: !!(panel && panel.offsetParent), handle: g("cmHandle"), display: g("cmDisplay"), email: g("cmEmail"), pass: g("cmPass") }; });
    check("...Settings closes, 💬 Community opens with the join form filled (user ID, name, email) and the password left to you",
      !o.settings && o.shown && o.handle === "tim_paul" && o.display === "Timmy" && o.email === "tim@example.com" && o.pass === "", o);
    check("...nothing sent to the community (Join isn't pressed)", !sent.length, sent);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { try { await api("/api/security", { ask: false, user: "", name: "", email: "" }); } catch (e) { /* gone */ } await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
