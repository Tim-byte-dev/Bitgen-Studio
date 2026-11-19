#!/usr/bin/env node
/* bitGen Studio — 2.863.0 in a REAL browser: 📤 Host ▸ 💳 Card payments against a real FTP server (pyftpdlib): the Stripe keys typed
 * once (a publishable key refused), kept encrypted (the boxes say "kept (test key)"), and ☐ with the card payment keys puts them into the
 * HOST's inc/config.php - sent even though the host already has one - while the project's copy has none. Against the running app (H3_URL).
 * No Playwright / pyftpdlib = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), net = require("net");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
(async () => {
  let pyOk = true; try { execSync("python3 -c 'import pyftpdlib'", { stdio: "ignore" }); } catch (e) { pyOk = false; }
  if (!chromium || !pyOk) { console.log("SKIP: playwright or pyftpdlib is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tui863-")); fs.mkdirSync(path.join(home, "public_html"));
  const port = await freePort();
  const py = `
import sys
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
a = DummyAuthorizer(); a.add_user("tim@tigerart.shop", "Ui-Pass-9", sys.argv[2], perm="elradfmwMT")
h = FTPHandler; h.authorizer = a; h.passive_ports = range(${port + 1}, ${port + 40})
s = FTPServer(("127.0.0.1", int(sys.argv[1])), h); print("ready", flush=True); s.serve_forever()
`;
  const srv = spawn("python3", ["-c", py, String(port), home], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((res, rej) => { srv.stdout.on("data", (d) => /ready/.test(d) && res()); setTimeout(() => rej(new Error("ftp server did not start")), 8000); });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForSelector('#wbTree .it[data-p="index.html"]', { timeout: 15000 });
    await ev(() => fetch("/api/web/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "inc/config.php", text: "<?php\ndefine('DB_NAME', getenv('DB_NAME') ?: 'shop');\n" }) }));
    fs.mkdirSync(path.join(home, "public_html", "inc"), { recursive: true }); fs.writeFileSync(path.join(home, "public_html", "inc", "config.php"), "<?php // the host's own\n");
    await p.click("#wbHost"); await p.waitForSelector("#wbHostForm.on");
    await p.fill("#wbHoServer", "127.0.0.1"); await p.fill("#wbHoPort", String(port)); await p.fill("#wbHoUser", "tim@tigerart.shop"); await p.fill("#wbHoPass", "Ui-Pass-9"); await p.uncheck("#wbHoSecure");
    await p.fill("#wbPaySk", "pk_test_publishable1234");
    await p.click("#wbHoGo");
    await p.waitForFunction(() => /✗/.test(document.getElementById("wbHoOut").textContent), null, { timeout: 15000 });
    check("💳 a publishable key (pk_) refused before anything is sent - the secret key is asked for", await ev(() => /sk_test_/.test(document.getElementById("wbHoOut").textContent)));
    await p.fill("#wbPaySk", "sk_test_bitgenUiTest123"); await p.fill("#wbPayWh", "whsec_uitest12345678"); await p.fill("#wbPayCur", "aud"); await p.check("#wbHoWithPay");
    await p.click("#wbHoGo");
    await p.waitForFunction(() => /✓ \d+ file|✗/.test(document.getElementById("wbHoOut").textContent), null, { timeout: 30000 });
    const out = await ev(() => document.getElementById("wbHoOut").textContent);
    const hostCfg = fs.readFileSync(path.join(home, "public_html", "inc", "config.php"), "utf8");
    const local = await ev(() => fetch("/api/web/file?path=inc/config.php").then((r) => r.json()).then((j) => j.text));
    check("☐ with the card payment keys: the HOST's inc/config.php replaced (it had one) with STRIPE_SECRET_KEY, the webhook secret and the currency; the project's copy has none", /card payment keys/.test(out) && /define\('STRIPE_SECRET_KEY', getenv\('STRIPE_SECRET_KEY'\) \?: 'sk_test_bitgenUiTest123'\);/.test(hostCfg) && /whsec_uitest12345678/.test(hostCfg) && /SHOP_CURRENCY.*'aud'/.test(hostCfg) && !/sk_test|whsec/.test(local), { out, hostCfg, local });
    await p.click("#wbHoNo"); await p.click("#wbHost"); await p.waitForSelector("#wbHostForm.on");
    const kept = await ev(() => ({ sk: document.getElementById("wbPaySk").placeholder, v: document.getElementById("wbPaySk").value, wh: document.getElementById("wbPayWh").placeholder, tick: document.getElementById("wbHoWithPay").checked }));
    check("...opened again: the boxes empty and say 'kept (test key, encrypted)'; the tick off again (asked each time)", kept.v === "" && /kept \(test key, encrypted\)/.test(kept.sk) && /kept \(encrypted\)/.test(kept.wh) && !kept.tick, kept);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); srv.kill(); fs.rmSync(home, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
