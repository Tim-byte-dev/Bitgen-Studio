#!/usr/bin/env node
/* bitGen Studio — 2.860.0 in a REAL browser: the Web editor's 📤 Host panel against a real FTP server (pyftpdlib, plain FTP):
 * the fields filled and kept, ✓ Test says what is there, 📤 Send to host fills the bar and the files land in public_html; the CRM's
 * database form shows "the site reaches it as" + the cPanel steps only for 🌐 your server. Against the running app (H3_URL).
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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "tui860-")); fs.mkdirSync(path.join(home, "public_html"));
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
    await p.click("#wbHost"); await p.waitForSelector("#wbHostForm.on");
    const d0 = await ev(() => ({ dir: document.getElementById("wbHoDir").value, sec: document.getElementById("wbHoSecure").checked, ph: document.getElementById("wbHoPass").placeholder }));
    check("📤 Host opens: public_html and FTPS by default, asks for the FTP password", d0.dir === "public_html" && d0.sec && /FTP account's password/.test(d0.ph), d0);
    await p.fill("#wbHoServer", "127.0.0.1"); await p.fill("#wbHoPort", String(port)); await p.fill("#wbHoUser", "tim@tigerart.shop"); await p.fill("#wbHoPass", "Ui-Pass-9");
    await p.uncheck("#wbHoSecure");
    await p.click("#wbHoTest");
    await p.waitForFunction(() => /✓ logged|✗/.test(document.getElementById("wbHoOut").textContent), null, { timeout: 15000 });
    const t1 = await ev(() => ({ t: document.getElementById("wbHoOut").textContent, pw: document.getElementById("wbHoPass").value }));
    check("✓ Test logs in to the real FTP server, says it is NOT encrypted and what is in public_html; the password box emptied (kept encrypted)", /✓ logged in - NOT encrypted - \/public_html: 0 item/.test(t1.t) && t1.pw === "", t1);
    await p.click("#wbHoGo");
    await p.waitForFunction(() => /✓ \d+ file|✗/.test(document.getElementById("wbHoOut").textContent), null, { timeout: 30000 });
    const t2 = await ev(() => ({ t: document.getElementById("wbHoOut").textContent, bar: document.getElementById("wbHoBar").value }));
    check("📤 Send to host: the files land in public_html (index.html there), the bar full, how many said", /✓ \d+ file\(s\) sent/.test(t2.t) && t2.bar === 1 && fs.existsSync(path.join(home, "public_html", "index.html")), t2);
    await p.click("#wbHoNo"); await p.click("#wbHost"); await p.waitForSelector("#wbHostForm.on");
    const d1 = await ev(() => ({ s: document.getElementById("wbHoServer").value, u: document.getElementById("wbHoUser").value, ph: document.getElementById("wbHoPass").placeholder, sec: document.getElementById("wbHoSecure").checked, last: document.getElementById("wbHoOut").textContent }));
    check("...opened again: the server, user and FTPS choice kept, the password said kept, the last send shown", d1.s === "127.0.0.1" && d1.u === "tim@tigerart.shop" && /kept on this computer/.test(d1.ph) && d1.sec === false && /Last sent/.test(d1.last), d1);
    await p.click("#wbHoGo");
    await p.waitForFunction(() => /✓ nothing changed|✗/.test(document.getElementById("wbHoOut").textContent), null, { timeout: 30000 });
    check("...sent again: nothing changed = nothing sent", await ev(() => /✓ nothing changed/.test(document.getElementById("wbHoOut").textContent)));
    // the database form's cPanel part
    await ev(() => document.querySelector('#wbCrmNav [data-kind="clients"]').click());
    await p.waitForSelector("#wbDbMake", { timeout: 10000 }).catch(() => {});
    const hasMake = await ev(() => !!document.getElementById("wbDbMake"));
    if (hasMake) {
      await p.click("#wbDbMake");
      const hid = await ev(() => getComputedStyle(document.getElementById("wbDbExt")).display);
      await p.check('input[name="wbDbScope"][value="external"]');
      const shown = await ev(() => ({ d: getComputedStyle(document.getElementById("wbDbExt")).display, v: document.getElementById("wbDbSite").value, t: document.getElementById("wbDbExt").textContent }));
      check("🗄 the database form: for 🌐 your server, 'the site reaches it as' localhost + the cPanel steps; hidden for this computer", hid === "none" && shown.d === "flex" && shown.v === "localhost" && /Remote MySQL/.test(shown.t), { hid, shown });
    } else check("🗄 the database form reachable (the CRM not linked)", false);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); srv.kill(); fs.rmSync(home, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
