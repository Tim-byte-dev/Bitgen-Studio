#!/usr/bin/env node
/* bitGen Studio — 2.713.0 in a REAL browser: the 💬 Community panel's new steps against the REAL community server
 * (community/api.php under `php -S`, SQLite, the emailed codes in a file - BGC_MAIL_LOG) and a running studio (H3_URL, or
 * H3_PORT - default 8311): Join asks for a first + last name and an email address; the code step (a wrong code says so,
 * Send a new code, Confirm) before the Help room opens; ⋯ ▸ Your details (Change -> a new address -> its code); the
 * Discussions link; a member from before 2.713.0 asked for a name + email on sign-in; the new words in 简体中文.
 * No php / studio / Playwright = SKIP.
 * Tim: "let users enter first name, last name and email - and verify email so if we ban a user they can't just change
 * their username" */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { execSync, spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.713.0 browser test did not run"); process.exit(0); }
try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here - the 2.713.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const post = async (u, b, tok) => { const r = await fetch(u, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(b || {}) }); return r.json(); };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.713.0 browser test did not run"); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-cm713-")), port = await freePort(), MAIL = path.join(tmp, "mail.log"), DB = path.join(tmp, "c.db");
  const php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(ROOT, "community")], { env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BGC_MAIL_LOG: MAIL }), stdio: "ignore" });
  const API = "http://127.0.0.1:" + port + "/api.php", A = (a) => API + "?a=" + a;
  const codeFor = (email) => { const m = fs.existsSync(MAIL) ? fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop() : null; return m ? m.text.match(/\b(\d{6})\b/)[1] : ""; };
  for (let i = 0; i < 50; i++) { try { const j = await post(A("info")); if (j.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  const b = await chromium.launch();
  const btnText = (p, t) => p.evaluate((t) => [...document.querySelectorAll("#cmBody button")].find((x) => x.textContent === t).click(), t);
  try {
    await post(URL0 + "api/community/url", { url: API }); await post(URL0 + "api/community/signout", {});
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3Community && document.getElementById("tCm"), null, { timeout: 30000 });
    await p.evaluate(() => { if (!H3Community.isOpen()) H3Community.toggle(true); }); await p.waitForSelector("#cmJoin", { timeout: 10000 });
    const jv = await p.evaluate(() => ({ ids: ["cmHandle", "cmPass", "cmFirst", "cmLast", "cmEmail", "cmDisplay"].every((i) => document.getElementById(i)), hint: document.getElementById("cmBody").textContent }));
    check("Join: user ID, password + (new here) first name, last name, email, display name; says only admins see them", jv.ids && /Only the community's admins see your name and email address/.test(jv.hint), jv);
    await p.fill("#cmHandle", "nina"); await p.fill("#cmPass", "ninas-password"); await p.click("#cmJoin");
    await p.waitForFunction(() => /first and last name/.test(document.getElementById("cmMsg").textContent));
    check("Join without a name: asked for it, nothing sent", !fs.existsSync(MAIL) || !codeFor("nina@example.com"));
    await p.fill("#cmFirst", "Nina"); await p.fill("#cmLast", "Novak"); await p.fill("#cmEmail", "nina@example.com"); await p.click("#cmJoin");
    await p.waitForSelector("#cmCode", { timeout: 15000 });
    const v1 = await p.evaluate(() => ({ body: document.getElementById("cmBody").textContent, tabs: document.querySelectorAll("#cmTabs button").length, msg: document.getElementById("cmMsg").textContent }));
    check("the code step: the address shown, no Help / Friends tabs yet, 'a code is on its way'", /nina@example\.com/.test(v1.body) && v1.tabs === 0 && /on its way/.test(v1.msg) && codeFor("nina@example.com"), v1);
    await p.fill("#cmCode", codeFor("nina@example.com") === "000000" ? "111111" : "000000"); await p.click("#cmVerify");
    await p.waitForFunction(() => /not right/.test(document.getElementById("cmMsg").textContent));
    check("a wrong code: the server's words (tries left)", /4 tries left/.test(await p.textContent("#cmMsg")));
    const mailsTo = (e) => fs.readFileSync(MAIL, "utf8").trim().split("\n").filter((l) => JSON.parse(l).to === e).length;
    const before = mailsTo("nina@example.com");
    await btnText(p, "Send a new code"); await p.waitForFunction(() => /new code is on its way/.test(document.getElementById("cmMsg").textContent));
    check("Send a new code: another email with a code goes", mailsTo("nina@example.com") === before + 1, [before, mailsTo("nina@example.com")]);
    await p.fill("#cmCode", codeFor("nina@example.com")); await p.press("#cmCode", "Enter");
    await p.waitForSelector("#cmList", { timeout: 15000 });
    const v2 = await p.evaluate(() => ({ tabs: [...document.querySelectorAll("#cmTabs button")].map((x) => x.textContent), msg: document.getElementById("cmMsg").textContent }));
    check("Confirm (Enter): the Help room and Friends open; 'welcome'", v2.tabs[0] === "Help" && /^Friends/.test(v2.tabs[1]) && /welcome/.test(v2.msg), v2);
    // ⋯ : your details, the discussions link, change the address
    await p.click("#cmMore"); await p.waitForSelector("#cmForum");
    const mv = await p.evaluate(() => ({ href: document.getElementById("cmForum").href, target: document.getElementById("cmForum").target, body: document.getElementById("cmBody").textContent }));
    check("⋯: Your details (Nina Novak - nina@example.com, only admins see them) + a Discussions link on the server's site, opened outside", /Nina Novak - nina@example\.com/.test(mv.body) && /Only the admins see these/.test(mv.body) && mv.href === "http://127.0.0.1:" + port + "/discussions.php" && mv.target === "_blank", mv);
    await btnText(p, "Change"); await p.waitForSelector("#cmPSave");
    await p.fill("#cmPEmail", "nina.n@example.org"); await p.click("#cmPSave");
    await p.waitForSelector("#cmCode", { timeout: 10000 });
    check("Change to a new address: back to the code step, a code went to the NEW address", /nina\.n@example\.org/.test(await p.textContent("#cmBody")) && codeFor("nina.n@example.org"));
    await p.fill("#cmCode", codeFor("nina.n@example.org")); await p.click("#cmVerify"); await p.waitForSelector("#cmList", { timeout: 10000 });
    // in Chinese: the new words
    await p.evaluate(() => [...document.querySelectorAll("#cmBody button, #cmMore")].find((x) => x.id === "cmMore").click()); await p.waitForSelector("#cmForum");
    await p.selectOption("#uiLangSel", "zh-CN"); await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "zh-CN");
    await p.waitForTimeout(400);
    const zh = await p.evaluate(() => ({ forum: document.getElementById("cmForum").textContent, body: document.getElementById("cmBody").textContent }));
    check("简体中文: ⋯ in Chinese (讨论区, 你的资料), the person's own details left as typed", /打开网站上的讨论区/.test(zh.forum) && /你的资料/.test(zh.body) && /Nina Novak - nina\.n@example\.org/.test(zh.body), zh);
    await p.selectOption("#uiLangSel", "en"); await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en");
    // a member from before 2.713.0: no email -> asked on sign-in
    const old = await post(A("register"), { handle: "olden", password: "oldens-password", first_name: "O", last_name: "L", email: "olden@example.com" });
    spawnSync("php", ["-r", "$p = new PDO('sqlite:' . $argv[1]); $p->exec(\"UPDATE bgc_users SET email = NULL, email_key = NULL, first_name = NULL, last_name = NULL, email_verified = 0 WHERE handle = 'olden'\");", DB]);
    await post(URL0 + "api/community/signout", {}); await p.evaluate(() => H3Community.refresh()); await p.waitForSelector("#cmSignIn", { timeout: 10000 });
    await p.fill("#cmHandle", "olden"); await p.fill("#cmPass", "oldens-password"); await p.click("#cmSignIn");
    await p.waitForSelector("#cmPSave", { timeout: 10000 });
    const ov = await p.evaluate(() => ({ body: document.getElementById("cmBody").textContent, back: [...document.querySelectorAll("#cmBody button")].some((x) => x.textContent === "Back") }));
    check("an older member signs in: asked for a name + email (no way past it)", /now asks every member for a name and an email address/.test(ov.body) && !ov.back && old.ok, ov);
    await p.fill("#cmPFirst", "Old"); await p.fill("#cmPLast", "En"); await p.fill("#cmPEmail", "olden@example.com"); await p.click("#cmPSave");
    await p.waitForSelector("#cmCode", { timeout: 10000 }); await p.fill("#cmCode", codeFor("olden@example.com")); await p.click("#cmVerify");
    await p.waitForSelector("#cmList", { timeout: 10000 });
    check("... then the code, then the Help room as before", true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally { await post(URL0 + "api/community/signout", {}).catch(() => 0); await b.close(); php.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
