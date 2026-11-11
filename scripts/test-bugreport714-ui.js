#!/usr/bin/env node
/* bitGen Studio — 2.714.0 in a REAL browser: 🐞 Bug report ▸ 📤 Save and send against the REAL community server
 * (community/api.php under `php -S`, SQLite) and a running studio (H3_URL, or H3_PORT - default 8311). Not signed in:
 * says it goes anonymously, sends anonymously (it waits for an admin), ✓ sent in Earlier reports. Signed in with a
 * confirmed email: says it goes as you, sends as you (live, under Bug reports); ☑ Send anonymously overrides it;
 * 📤 sends an earlier report. The admins get the logs + the marked-up screenshot (a JPEG). The new words in 日本語.
 * No php / studio / Playwright = SKIP.
 * Tim: "have the app allow the user to send the bug report to the db if they are registered. if not registered bug
 * report will be sent as anon" */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { execSync, spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.714.0 browser test did not run"); process.exit(0); }
try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here - the 2.714.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const post = async (u, b, tok) => { const r = await fetch(u, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(b || {}) }); return r.json(); };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.714.0 browser test did not run"); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-bug714-")), port = await freePort(), MAIL = path.join(tmp, "mail.log");
  const php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(ROOT, "community")], { env: Object.assign({}, process.env, { BGC_POW_BITS: "0", BGC_DSN: "sqlite:" + path.join(tmp, "c.db"), BGC_MAIL_LOG: MAIL, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "50" }), stdio: "ignore" });
  const API = "http://127.0.0.1:" + port + "/api.php", A = (a) => API + "?a=" + a;
  const codeFor = (email) => { const m = fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop(); return m.text.match(/\b(\d{6})\b/)[1]; };
  const member = async (h) => { const e = h + "@example.com"; const r = await post(A("register"), { handle: h, password: "pw-" + h + "-123", first_name: "F", last_name: "L", email: e, display: h === "tim" ? "Tim" : h }); await post(A("verify_email"), { code: codeFor(e) }, r.token); return r.token; };
  for (let i = 0; i < 50; i++) { try { const j = await post(A("info")); if (j.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  const b = await chromium.launch();
  try {
    const boss = await member("boss");
    await member("tim");
    await post(URL0 + "api/community/url", { url: API }); await post(URL0 + "api/community/signout", {});
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3BugReport && window.SecFloat && SecFloat.windows && SecFloat.windows.bugreport, null, { timeout: 30000 });
    await p.evaluate(() => H3BugReport.open(true)); await p.waitForSelector("#brSend", { state: "visible", timeout: 10000 });
    await p.waitForFunction(() => /anonymously/.test(document.getElementById("brWho").textContent), null, { timeout: 10000 });
    check("not signed in: the docker says it goes anonymously (join to send as you - optional)", /join the 💬 Community to send it as you \(optional\)/.test(await p.textContent("#brWho")));
    // a screenshot to send: a picture drawn into the canvas, marked
    await p.evaluate(() => new Promise((res) => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const x = c.getContext("2d"); x.fillStyle = "#335"; x.fillRect(0, 0, 640, 360); const im = new Image(); im.onload = () => { const S = H3BugReport.state(); S.img = im; S.marks = [{ t: "box", x0: 10, y0: 10, x1: 200, y1: 120 }]; res(); }; im.src = c.toDataURL("image/png"); }));
    await p.evaluate(() => { const c = document.getElementById("brCanvas"); c.width = 640; c.height = 360; c.style.display = ""; });
    await p.fill("#brTitle", "Export hangs at 99 percent"); await p.fill("#brWhat", "The export bar stops at 99% and never finishes.");
    await p.click("#brSend");
    await p.waitForFunction(() => /sent anonymously/.test(document.getElementById("brMsg").textContent), null, { timeout: 30000 });
    const m1 = await p.evaluate(() => ({ t: document.getElementById("brMsg").textContent, href: (document.querySelector("#brMsg a") || {}).href }));
    check("📤 Save and send, not signed in: sent anonymously, 'shows once an admin approves it', a link to its discussion", /it shows once an admin approves it/.test(m1.t) && /\/discussions\.php\?t=\d+$/.test(m1.href || ""), m1);
    await p.waitForFunction(() => document.querySelector("#brList .bsent"), null, { timeout: 10000 });
    check("Earlier reports: ✓ sent on it, linking to its discussion", await p.evaluate(() => /discussions\.php\?t=\d+/.test(document.querySelector("#brList .bsent").href)));
    let pend = await post(A("admin_forum_pending"), {}, boss);
    const ap = (pend.posts || []).find((x) => x.title === "Export hangs at 99 percent");
    check("the server: waiting for an admin, under Bug reports, by Anonymous", ap && ap.category === "bugs" && ap.guest_name === "Anonymous", pend);
    const t1 = await post(A("forum_topic"), { id: ap.topic_id }, boss);
    check("the admins get the details from the app (system, logs, recorded steps)", t1.bug && t1.bug.details && t1.bug.details.system && t1.bug.details.logs && Object.keys(t1.bug.details.logs).length > 0 && Array.isArray(t1.bug.details.recorded), t1.bug && Object.keys(t1.bug.details || {}));
    const shot = await post(A("bug_shot"), { bug_id: t1.bug.id }, boss);
    check("... and the marked-up screenshot, as a JPEG", shot.ok && shot.type === "jpeg" && shot.data.length > 1000, shot.type);
    // signed in (a confirmed member)
    const j = await post(URL0 + "api/community/join", { mode: "login", handle: "tim", password: "pw-tim-123", url: API });
    await p.evaluate(() => { H3BugReport.show(false); }); await p.evaluate(() => H3BugReport.open(true));
    await p.waitForFunction(() => /sends it as Tim \(@tim\)/.test(document.getElementById("brWho").textContent), null, { timeout: 10000 });
    check("signed in: the docker says it goes as you", j.ok && /you can follow its discussion and reply/.test(await p.textContent("#brWho")));
    await p.click("#brNew");
    await p.fill("#brTitle", "Waveform missing on long clips"); await p.fill("#brWhat", "Clips over 10 minutes show no waveform.");
    await p.click("#brSend");
    await p.waitForFunction(() => /sent as @tim/.test(document.getElementById("brMsg").textContent), null, { timeout: 30000 });
    let list = await post(A("forum_list"), { category: "bugs" });
    check("📤 signed in: sent as @tim, live under Bug reports at once", (list.topics || []).some((t) => t.title === "Waveform missing on long clips" && t.author.handle === "tim"), list.topics);
    await p.click("#brNew"); await p.check("#brAnon");
    await p.fill("#brTitle", "Private bug"); await p.fill("#brWhat", "Rather not say who I am.");
    await p.click("#brSend");
    await p.waitForFunction(() => /sent anonymously/.test(document.getElementById("brMsg").textContent), null, { timeout: 30000 });
    pend = await post(A("admin_forum_pending"), {}, boss);
    check("☑ Send anonymously: anonymous even when signed in", (pend.posts || []).some((x) => x.title === "Private bug" && x.guest_name === "Anonymous"));
    await p.uncheck("#brAnon");
    // an earlier report saved as a file, then 📤
    await p.click("#brNew"); await p.fill("#brTitle", "Saved first"); await p.fill("#brWhat", "Then sent.");
    await p.click("#brSave"); await p.waitForFunction(() => /saved bug-/.test(document.getElementById("brMsg").textContent), null, { timeout: 15000 });
    await p.waitForFunction(() => [...document.querySelectorAll("#brList .bi")].some((x) => /Saved first/.test(x.textContent) && x.querySelector("[data-send]")), null, { timeout: 10000 });
    await p.evaluate(() => [...document.querySelectorAll("#brList .bi")].find((x) => /Saved first/.test(x.textContent)).querySelector("[data-send]").click());
    await p.waitForFunction(() => /sent as @tim/.test(document.getElementById("brMsg").textContent), null, { timeout: 30000 });
    list = await post(A("forum_list"), { category: "bugs" });
    check("📤 on an earlier report sends it (as @tim)", (list.topics || []).some((t) => t.title === "Saved first"));
    // 日本語
    await p.selectOption("#uiLangSel", "ja"); await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "ja");
    await p.waitForTimeout(400);
    const ja = await p.evaluate(() => ({ send: document.getElementById("brSend").textContent, anon: document.getElementById("brAnon").parentElement.textContent, who: document.getElementById("brWho").textContent }));
    check("日本語: 保存して送信, 匿名で送信, and who it goes as", /保存して送信/.test(ja.send) && /匿名で送信/.test(ja.anon) && /として送信されます/.test(ja.who), ja);
    await p.selectOption("#uiLangSel", "en"); await p.waitForFunction(() => document.documentElement.getAttribute("data-uilang") === "en");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally { await post(URL0 + "api/community/signout", {}).catch(() => 0); await b.close(); php.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
