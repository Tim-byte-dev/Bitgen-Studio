#!/usr/bin/env node
/* bitGen Studio — 2.716.0 in a REAL browser: the COMMUNITY'S LANGUAGE PACKS in Settings ▸ Languages, against a real
 * Community server (community/api.php under `php -S`, SQLite) and a running studio (H3_URL, or H3_PORT - default 8311).
 * Nothing shared yet says so; a pack another member shared (approved by an admin) is listed with who shared it and
 * installs in one click (then "Installed", in the language dropdown); ⇪ Share on an installed pack asks for a note and
 * sends it as you (it waits for an admin - "Your shared packs" says so), approved it shows as shared, ✕ takes it off;
 * signed out, Share says to sign in; a community that cannot be reached says so. No php / studio / Playwright = SKIP.
 * Tim (verbatim): "if we could have a master pack so users can translate the strings and upload to tigerart for the
 * community it would be ideal" */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.716.0 browser test did not run"); process.exit(0); }
try { execSync("php -v", { stdio: "ignore" }); } catch { console.log("SKIP: no php here - the 2.716.0 browser test did not run"); process.exit(0); }
const LP = require("../lib/langPacks"), U = require("../lib/unzip"), Z = require("../lib/zipWrite");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const post = async (u, b, tok) => { const r = await fetch(u, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(b || {}) }); return r.json(); };
const MASTER = LP.masterZip();
function pack(meta, words) {
  const ents = U.entries(MASTER).map((e) => ({ name: e.name, data: U.read(MASTER, e) }));
  const pj = ents.find((e) => e.name === "pack.json"), ui = ents.find((e) => e.name === "ui.json");
  pj.data = JSON.stringify(Object.assign(JSON.parse(pj.data), meta));
  const u = JSON.parse(ui.data); Object.assign(u.strings, words || {}); ui.data = JSON.stringify(u);
  return Z.zip(ents.map((e) => ({ name: e.name, data: e.data, deflate: true })));
}
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.716.0 browser test did not run"); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-lp716-")), port = await freePort(), MAIL = path.join(tmp, "mail.log");
  const php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", path.join(ROOT, "community")], { env: Object.assign({}, process.env, { BGC_POW_BITS: "0", BGC_DSN: "sqlite:" + path.join(tmp, "c.db"), BGC_MAIL_LOG: MAIL, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "50", BITGEN_PRIVATE_DIR: path.join(tmp, "none") }), stdio: "ignore" });
  const API = "http://127.0.0.1:" + port + "/api.php", A = (a) => API + "?a=" + a;
  const codeFor = (email) => { const m = fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop(); return m.text.match(/\b(\d{6})\b/)[1]; };
  const member = async (h) => { const e = h + "@example.com"; const r = await post(A("register"), { handle: h, password: "pw-" + h + "-123", first_name: "F", last_name: "L", email: e }); await post(A("verify_email"), { code: codeFor(e) }, r.token); return r.token; };
  for (let i = 0; i < 50; i++) { try { const j = await post(A("info")); if (j.ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  await post(URL0 + "api/langpacks/remove", { id: "ko" }).catch(() => {});
  const b = await chromium.launch();
  try {
    const boss = await member("boss"), ann = await member("ann");
    await member("tim");
    await post(URL0 + "api/community/url", { url: API }); await post(URL0 + "api/community/signout", {});
    const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: "en-US" })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3LangPacks && document.querySelector('#settings .stabs [data-stab="langs"]'), null, { timeout: 30000 });
    await p.evaluate(() => { const d = document.getElementById("settings"); if (typeof window.openSettings === "function") window.openSettings(); else d.showModal(); document.querySelector('#settings .stabs [data-stab="langs"]').click(); });
    await p.waitForFunction(() => /No shared language packs yet/.test(document.getElementById("s_lpcm").textContent), null, { timeout: 15000 }).catch(() => {});
    check("Shared by the community: nothing shared yet says so", await p.evaluate(() => /No shared language packs yet/.test(document.getElementById("s_lpcm").textContent) ? true : document.getElementById("s_lpcm").textContent) === true);
    // ann shares a Korean pack, the admin approves it
    const up = await post(A("pack_upload"), { zip: Buffer.from(pack({ id: "ko", name: "Korean", native: "한국어", version: "1", authors: ["Ann"] }, { Themes: "테마", General: "일반" })).toString("base64"), note: "The main window" }, ann);
    await post(A("admin_pack_moderate"), { id: up.id, approve: true }, boss);
    await p.click("#s_lpcmref");
    await p.waitForSelector('#s_lpcm [data-cm="' + up.id + '"]', { timeout: 15000 }).catch(() => {});
    const row = await p.evaluate((id) => { const r = document.querySelector('#s_lpcm [data-cm="' + id + '"]'); return r ? r.textContent : null; }, up.id);
    check("…a pack another member shared: listed - 한국어 (Korean · ko), v1, @ann, its note, ⤓ Install", row && /한국어/.test(row) && /Korean · ko/.test(row) && /v1/.test(row) && /@ann/.test(row) && /The main window/.test(row) && /⤓ Install/.test(row), row);
    await p.click('#s_lpcm [data-cm="' + up.id + '"] [data-cminstall]');
    await p.waitForFunction(() => document.querySelector('#s_lplist [data-lp="ko"]') && /Installed/.test(document.getElementById("s_lpcm").textContent), null, { timeout: 15000 }).catch(() => {});
    const inst = await p.evaluate(() => ({ msg: document.getElementById("s_lpmsg").textContent, mine: !!document.querySelector('#s_lplist [data-lp="ko"]'), cm: document.getElementById("s_lpcm").textContent, opts: [...document.querySelectorAll("#uiLangSel option")].map((o) => o.value) }));
    check("⤓ Install: installed in one click - in the list and the language dropdown, the community row says Installed", /Installed 한국어 \(ko\)/.test(inst.msg) && inst.mine && /Installed/.test(inst.cm) && inst.opts.includes("ko"), inst);
    // ⇪ Share - signed out first
    await p.click('#s_lplist [data-lp="ko"] [data-lpshare]');
    await p.fill("#s_lpnote", "Korean, the main window");
    await p.click("#s_lpsend");
    await p.waitForFunction(() => /sign in to 💬 Community/.test(document.getElementById("s_lpmsg").textContent), null, { timeout: 15000 }).catch(() => {});
    check("⇪ Share signed out: says to sign in to 💬 Community first", await p.evaluate(() => /sign in to 💬 Community first/.test(document.getElementById("s_lpmsg").textContent) ? true : document.getElementById("s_lpmsg").textContent) === true);
    // signed in as tim
    await post(URL0 + "api/community/join", { mode: "login", handle: "tim", password: "pw-tim-123", url: API });
    await p.click("#s_lpsend");
    await p.waitForFunction(() => /Sent 한국어 v1/.test(document.getElementById("s_lpmsg").textContent), null, { timeout: 30000 }).catch(() => {});
    const sent = await p.evaluate(() => ({ msg: document.getElementById("s_lpmsg").textContent, mine: document.getElementById("s_lpmine").textContent }));
    check("…signed in: sent as you, 'shows for everyone once an admin has checked it'; Your shared packs: waiting for an admin", /Sent 한국어 v1 - it shows for everyone once an admin has checked it/.test(sent.msg) && /Your shared packs/.test(sent.mine) && /waiting for an admin/.test(sent.mine), sent);
    const pend = (await post(A("pack_list"), {}, boss)).pending;
    check("…the admin sees it waiting, from tim, with the note and the app's coverage (2 words of the app)", pend.length === 1 && pend[0].by.handle === "tim" && /main window/.test(pend[0].note) && pend[0].counts.coverage.ui.done === 2, pend);
    await post(A("admin_pack_moderate"), { id: pend[0].id, approve: true }, boss);
    await p.click("#s_lpcmref");
    await p.waitForFunction(() => /anyone can install it/.test(document.getElementById("s_lpmine").textContent), null, { timeout: 15000 }).catch(() => {});
    check("approved: Your shared packs says shared - anyone can install it", await p.evaluate(() => /shared - anyone can install it/.test(document.getElementById("s_lpmine").textContent)));
    await p.click("#s_lpmine [data-cmdelete]");
    await p.waitForFunction(() => /Taken off the community/.test(document.getElementById("s_lpmsg").textContent), null, { timeout: 15000 }).catch(() => {});
    check("✕: taken off the community", await p.evaluate(() => /Taken off the community/.test(document.getElementById("s_lpmsg").textContent) && !/Your shared packs/.test(document.getElementById("s_lpmine").textContent)));
    // the community cannot be reached
    await post(URL0 + "api/community/url", { url: "http://127.0.0.1:" + (await freePort()) + "/api.php" });
    await p.click("#s_lpcmref");
    await p.waitForFunction(() => /could not be reached/.test(document.getElementById("s_lpcm").textContent), null, { timeout: 30000 }).catch(() => {});
    check("a community that cannot be reached: says so (the installed packs still work)", await p.evaluate(() => /could not be reached/.test(document.getElementById("s_lpcm").textContent) && !!document.querySelector('#s_lplist [data-lp="ko"]')));
    check("no page errors", errs.length === 0, errs);
  } finally {
    await post(URL0 + "api/community/url", { url: API }).catch(() => 0);
    await post(URL0 + "api/community/signout", {}).catch(() => 0);
    await post(URL0 + "api/community/url", { url: "https://tigerart.com.au/bitgen-community/api.php" }).catch(() => 0);
    await post(URL0 + "api/langpacks/remove", { id: "ko" }).catch(() => 0);
    await b.close(); php.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
