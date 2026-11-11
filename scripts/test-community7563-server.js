#!/usr/bin/env node
/* bitGen Studio — 2.756.3: JOINING IS FOR PEOPLE on the real Community server (php -S, SQLite).
 * Tim pasted /b_admin/ ▸ Members (bots: random IDs, random names, other people's email addresses), then "yes please go ahead
 * with all 4". Here: looks_made_up on the bots' names and on real names; api.php register without / with the joining
 * check, used twice, wrong, changed; a made-up name refused before any email; set_profile too; users_drop_unconfirmed
 * removes unconfirmed accounts without banning their addresses. SKIP without php. */
"use strict";
const fs = require("fs"), os = require("os"), net = require("net"), path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here"); process.exit(0); }
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const C = require("../lib/community");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc7563s-")), DB = path.join(TMP, "c.db"), MAIL = path.join(TMP, "mail.log");
const HERE = ["127", "0", "0", "1"].join(".");
const ENV = Object.assign({}, process.env, { BGC_POW_BITS: "12", BGC_DSN: "sqlite:" + DB, BGC_MAIL_LOG: MAIL, BGC_REGISTER_PER_HOUR: "100" });
const phpr = (code) => spawnSync("php", ["-r", "define('BGC_TEST', 1); require '" + path.join(DIR, "lib", "boot.php") + "'; " + code], { encoding: "utf8", env: ENV });
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, "utf8").trim().split("\n").filter(Boolean).length : 0);

(async () => {
  const BOTS = ["aJizTlgdmOafqerJwBanQA", "HIcibuCwKqwdfpBxlAmjEAcI oKWsOcCDEuPfNGzHXXzR", "asjMKTeQSkKzuRjKZwFO", "OpkhdSXkNghqyzzTlub", "odEtPslvjylQbEOw", "rNnmnKNPcrCjkTVDPhJXv", "gFTZrmztstikewNXwn", "FGDZQnvbFDEypxgHLBg"];
  const REAL = ["Tim", "Timothy Nolan", "McDonald", "MacArthur", "DeShawn", "LaToya", "Van der Berg", "O'Brien", "Jean-Luc", "Krzysztof", "Strzelczyk", "DiCaprio", "McKenzie-Smith", "José", "Müller", "陈", "山田太郎", "Bjørn", "Nguyen", "Venkataraghavan", "Wolfeschlegelsteinhausenbergerdorff", "D'Angelo", "Llwyd", "Ng"];
  const o = spawnSync("php", ["-r", "require '" + path.join(DIR, "lib", "boot.php") + "'; echo json_encode(['b' => array_map('looks_made_up', " + JSON.stringify(BOTS).replace(/'/g, "\\'").replace(/"/g, "'") + "), 'r' => array_map('looks_made_up', json_decode(file_get_contents('php://stdin'), true))]);"], { encoding: "utf8", env: ENV, input: JSON.stringify(REAL) });
  let got = null; try { got = JSON.parse(o.stdout); } catch (e) { got = o.stdout + o.stderr; }
  check("looks_made_up: every bot name from Tim's list is caught; real names (McDonald, DeShawn, O'Brien, Krzysztof, 陈, Müller, a 35-letter surname ...) are not",
    got && got.b && got.b.every(Boolean) && got.r.every((x) => !x), got);
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, HERE, () => { const p = s.address().port; s.close(() => res(p)); }); });
  const php = spawn("php", ["-S", HERE + ":" + port, "-t", DIR], { stdio: "ignore", env: ENV });
  const URL = "http://" + HERE + ":" + port + "/api.php";
  const api = async (a, b, tok) => { for (let i = 0; i < 40; i++) { try { const r = await fetch(URL + "?a=" + a, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(b || {}) }); return Object.assign({ status: r.status }, await r.json()); } catch (e) { await sleep(100); } } };
  try {
    const who = (h, f, l) => ({ handle: h, password: "pw-" + h + "-1234", first_name: f || "Ada", last_name: l || "Lovelace", email: h + "@example.org" });
    let r = await api("register", who("nopow"));
    check("register without the check: 400 in words, no account, no email", r.status === 400 && /Joining needs bitGen Studio 2\.756\.3 or newer/.test(r.error) && mails() === 0, r);
    let ck = await api("join_check");
    check("join_check: {c, bits 12}", ck.ok && /^\d+\.[0-9a-f]{16}\.[0-9a-f]{64}$/.test(ck.c) && ck.bits === 12, ck);
    const n = await C.solvePow(ck.c, ck.bits);
    r = await api("register", Object.assign(who("ada"), { pow: { c: ck.c, n } }));
    check("…done: joined + the code emailed", r.ok && r.mail_sent && mails() === 1, r);
    r = await api("register", Object.assign(who("ada2"), { pow: { c: ck.c, n } }));
    check("…the same check twice: refused, no email", !r.ok && /used already/.test(r.error) && mails() === 1, r);
    ck = await api("join_check");
    r = await api("register", Object.assign(who("bot1", "aJizTlgdmOafqerJwBanQA", "HIcibuCwKqwdfpBxlAmjEAcI"), { pow: { c: ck.c, n: await C.solvePow(ck.c, ck.bits) } }));
    check("…a made-up first name: refused before any email (the stranger gets nothing)", !r.ok && /real first name/.test(r.error) && mails() === 1, r);
    ck = await api("join_check");
    r = await api("register", Object.assign(who("bot2", "Rob", "oKWsOcCDEuPfNGzHXXzR"), { pow: { c: ck.c, n: await C.solvePow(ck.c, ck.bits) } }));
    check("…a made-up last name: refused", !r.ok && /real last name/.test(r.error), r);
    r = await api("set_profile", { first_name: "asjMKTeQSkKzuRjKZwFO", last_name: "Lovelace", email: "ada@example.org" }, (await api("login", { handle: "ada", password: "pw-ada-1234" })).token);
    check("set_profile with a made-up name: refused too", !r.ok && /real first name/.test(r.error), r);
    // users_drop_unconfirmed: a day old, unconfirmed -> gone, the address not banned
    phpr("$p = new PDO('sqlite:" + DB + "'); $p->exec('UPDATE bgc_users SET created_at = created_at - 86400000');");
    const out = phpr("echo users_drop_unconfirmed(3600000), '|', q_val('SELECT COUNT(*) FROM bgc_users'), '|', q_val('SELECT COUNT(*) FROM bgc_banned_emails');");
    check("users_drop_unconfirmed(1 h): the unconfirmed account removed, no address banned", out.stdout.trim() === "1|0|0", out.stdout + out.stderr);
    ck = await api("join_check");
    r = await api("register", Object.assign(who("ada"), { pow: { c: ck.c, n: await C.solvePow(ck.c, ck.bits) } }));
    check("…the same address can join again afterwards", r.ok, r);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  php.kill(); fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
