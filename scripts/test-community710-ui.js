#!/usr/bin/env node
/* bitGen Studio — 2.710.0 in a REAL browser: the 💬 Community panel against the REAL community server (community/api.php
 * under `php -S`, SQLite) and a running studio (H3_URL, or H3_PORT - default 8311). A second member ("bob") is driven
 * straight through the API. Join from the panel, the Help room both ways, find bob -> + Add friend -> bob accepts ->
 * friends, a private chat both ways, the badge for a message while the panel is closed, ⚑ report, a refused DM to a
 * non-friend, sign out, leave. No php / server / Playwright = SKIP.
 * Tim (verbatim): "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a
 * user id to bitgen they join the community and can add other users as friends, first they ask, then if approved they
 * become friends. this should enable people to get help" */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.710.0 browser test did not run"); process.exit(0); }
try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here - the 2.710.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const post = async (u, b, tok) => { const r = await fetch(u, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(b || {}) }); return r.json(); };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.710.0 browser test did not run"); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-cm710-")), port = await freePort();
  const php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(ROOT, "community")], { env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + path.join(tmp, "c.db"), BGC_ADMINS: "boss" }), stdio: "ignore" });
  const API = "http://127.0.0.1:" + port + "/api.php", A = (a) => API + "?a=" + a;
  for (let i = 0; i < 50; i++) { try { const j = await post(A("info")); if (j.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  const before = await (await fetch(URL0 + "api/community")).json();
  const b = await chromium.launch();
  try {
    const bob = (await post(A("register"), { handle: "bob", password: "bobs-password", display: "Bob" })).token;
    await post(A("send"), { to: "help", body: "Hi all, I am Bob" }, bob);
    await post(URL0 + "api/community/url", { url: API });
    await post(URL0 + "api/community/signout", {});
    const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3Community && document.getElementById("tCm"), null, { timeout: 30000 });
    const sb = await p.evaluate(() => ({ inBar: document.getElementById("tCm").parentElement.id, text: document.getElementById("tCm").textContent }));
    check("💬 Community sits on the status bar", sb.inBar === "statusbar" && /Community/.test(sb.text), sb);
    await p.click("#tCm"); await p.waitForSelector("#cmJoin", { timeout: 10000 });
    await p.fill("#cmHandle", "Alice_1"); await p.fill("#cmDisplay", "Alice"); await p.fill("#cmPass", "alices-password");
    await p.click("#cmJoin");
    await p.waitForFunction(() => /Hi all, I am Bob/.test((document.getElementById("cmList") || {}).textContent || ""), null, { timeout: 15000 });
    const j1 = await p.evaluate(() => ({ who: document.getElementById("cmWho").textContent, tabs: [...document.querySelectorAll("#cmTabs button")].map((x) => x.textContent) }));
    const st = await (await fetch(URL0 + "api/community")).json();
    check("Join from the panel: a user ID + password -> a member, the Help room shows what others wrote; the token stays on the server side",
      /Alice \(@alice_1\)/.test(j1.who) && j1.tabs[0] === "Help" && /^Friends/.test(j1.tabs[1]) && st.joined && st.handle === "alice_1" && !("token" in st), { j1, st });
    await p.fill("#cmText", "How do I make a 16 GB card work?"); await p.press("#cmText", "Enter");
    await p.waitForFunction(() => /16 GB card/.test(document.getElementById("cmList").textContent));
    const bp = await post(A("poll"), { since: 0 }, bob);
    check("…a Help question from the panel reaches the others (Bob's poll)", (bp.messages || []).some((m) => m.room === "help" && m.from === "alice_1" && /16 GB card/.test(m.body)), bp);
    await post(A("send"), { to: "help", body: "Turn on 16 GB mode in Settings" }, bob);
    await p.waitForFunction(() => /Turn on 16 GB mode/.test(document.getElementById("cmList").textContent), null, { timeout: 15000 });
    check("…Bob's answer arrives in the panel on its own (polling)", true);
    const dm0 = await p.evaluate(async () => (await (await fetch("/api/community/call/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: "bob", body: "hi" }) })).json()));
    check("a private message to someone who is not a friend is refused", dm0.ok === false && dm0.status === 403, dm0);
    // friends: find bob, ask; bob accepts
    await p.evaluate(() => document.querySelectorAll("#cmTabs button")[1].click());
    await p.fill("#cmFind", "bo"); await p.press("#cmFind", "Enter");
    await p.waitForSelector('#cmFound [data-handle="bob"] button', { timeout: 10000 });
    await p.evaluate(() => [...document.querySelectorAll('#cmFound [data-handle="bob"] button')].find((x) => /Add friend/.test(x.textContent)).click());
    await p.waitForFunction(() => /asked/.test(document.getElementById("cmMsg").textContent), null, { timeout: 10000 });
    const bf = await post(A("friends"), {}, bob);
    check("Find -> + Add friend: Bob is asked (his friend requests list Alice); she waits for him", (bf.incoming || []).some((u) => u.handle === "alice_1") && await p.evaluate(() => /Waiting for them/.test(document.getElementById("cmBody").textContent)), bf);
    await post(A("friend_respond"), { handle: "alice_1", accept: true }, bob);
    await p.evaluate(() => H3Community.refresh()); await p.evaluate(() => H3Community.show("friends"));
    await p.waitForFunction(() => [...document.querySelectorAll("#cmBody .cmrow")].some((r) => r.dataset.handle === "bob" && /💬/.test(r.textContent)), null, { timeout: 10000 });
    check("Bob accepts -> friends: he is in her Friends with 💬", true);
    await p.evaluate(() => [...document.querySelectorAll('#cmBody .cmrow[data-handle="bob"] button')].find((x) => x.textContent === "💬").click());
    await p.fill("#cmText", "Thanks Bob!"); await p.click("#cmSend");
    await p.waitForFunction(() => /Thanks Bob!/.test(document.getElementById("cmList").textContent));
    const bp2 = await post(A("poll"), { since: 0 }, bob);
    check("a private chat with a friend: her message reaches only him (a dm, to bob)", (bp2.messages || []).some((m) => m.room === "dm" && m.to === "bob" && m.body === "Thanks Bob!"), bp2.messages);
    // closed panel -> a badge for Bob's reply
    await p.click("#tCm");
    await post(A("send"), { to: "alice_1", body: "Any time <b>friend</b>" }, bob);
    await p.evaluate(() => H3Community.refresh());
    await p.waitForFunction(() => { const s = document.querySelector("#tCm .cmbadge"); return s && !s.hidden && +s.textContent >= 1; }, null, { timeout: 25000 });
    check("the panel closed: a reply shows as a badge on 💬 Community", true);
    await p.click("#tCm"); await p.evaluate(() => H3Community.show("@bob"));
    await p.waitForFunction(() => /Any time <b>friend<\/b>/.test(document.getElementById("cmList").textContent));
    check("…what people write is shown as text (an HTML tag stays visible, nothing is made of it)", await p.evaluate(() => !document.querySelector("#cmList b") && /<b>friend<\/b>/.test(document.getElementById("cmList").textContent)));
    // report
    await p.evaluate(() => [...document.querySelectorAll("#cmList .cmm")].find((m) => /Any time/.test(m.textContent)).querySelector("button.act").click());
    await p.fill("#cmList .cmrep input", "testing a report"); await p.press("#cmList .cmrep input", "Enter");
    await p.waitForFunction(() => /reported/.test(document.getElementById("cmMsg").textContent));
    const boss = (await post(A("register"), { handle: "boss", password: "boss-password" })).token;
    const rep = await post(A("admin_reports"), {}, boss);
    check("⚑ report: the admins see it (reason + the message)", (rep.reports || []).some((r) => r.reason === "testing a report"), rep);
    // sign out, leave
    await p.evaluate(() => document.getElementById("cmMore").click());
    await p.evaluate(() => [...document.querySelectorAll("#cmBody button")].find((x) => x.textContent === "Sign out").click());
    await p.waitForSelector("#cmSignIn", { timeout: 10000 });
    check("⋯ Sign out: back to Join / Sign in, the ID remembered", (await (await fetch(URL0 + "api/community")).json()).joined === false);
    await p.fill("#cmHandle", "alice_1"); await p.fill("#cmPass", "alices-password"); await p.click("#cmSignIn");
    await p.waitForSelector("#cmList", { timeout: 10000 });
    await p.evaluate(() => document.getElementById("cmMore").click());
    await p.fill("#cmLeavePass", "alices-password");
    await p.evaluate(() => [...document.querySelectorAll("#cmBody button")].find((x) => /Leave and delete/.test(x.textContent)).click());
    await p.waitForFunction(() => /you left/.test(document.getElementById("cmMsg").textContent), null, { timeout: 10000 });
    const gone = await post(A("login"), { handle: "alice_1", password: "alices-password" });
    check("⋯ Leave (with the password): the user ID is deleted on the community server", gone.ok === false, gone);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await post(URL0 + "api/community/signout", {}); await post(URL0 + "api/community/url", { url: before.url || "" }); } catch (e) { /* best effort */ }
  php.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
