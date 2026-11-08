#!/usr/bin/env node
/* bitGen Studio — 2.723.0: SUSPEND A MEMBER FOR SOME DAYS on the Community server, over real HTTP (`php -S`, SQLite).
 * Tim: "add 2 buttons next to ban, suspend (input number of days) and make admin" (the buttons: tigerart /b_admin/,
 * scripts/test-admin.js). Here: a schema 5 database gains bgc_users.suspended_until; admin_suspend {handle, days}
 * (admins; 1-3650; 0 lifts; not yourself) signs them out everywhere and refuses sign-in until it ends, told until when;
 * their posts stay; it ends by itself; admin_user shows it. The harness is test-community721-server.js's.
 * (was: 2.721.0: PINNED DISCUSSIONS + bitGen Studio's OWN DISCUSSIONS on the Community server, over real HTTP
 * (`php -S` on community/, SQLite).
 * Tim: "can you add a discussion to the website with that info and pin it please" (the speed results).
 *   an older database (schema 4, a topic in it) gains the columns and keeps its topic; the notes (BGC_NOTES_DIR) are
 *   posted once by "bitGen Studio" (official), pinned ones first; a higher rev updates the text, one an admin removed is
 *   not posted again, a bad note is skipped; admin_forum_pin (admins only, a topic that is gone = 404); a guest cannot be
 *   "bitGen Studio"; a BGC_DSN server without BGC_NOTES_DIR posts none; the real note (community/notes/) is a valid one.
 * SKIP without php. The website's side: tigerart scripts/test-pins.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.723.0 suspend server test did not run"); process.exit(0); }
const DIR = path.join(__dirname, "..", "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc723-"));
const MAIL = path.join(TMP, "mail.log"), DB = path.join(TMP, "c.db"), NOTES = path.join(TMP, "notes");
let BASE = "", php = null;
async function call(action, body, token) {
  const r = await fetch(BASE + "/api.php?a=" + action, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { j = {}; }
  return { status: r.status, j };
}
const ok = (r) => r.status === 200 && r.j.ok === true;
const err = (r, s, re) => r.status === s && r.j.ok === false && (!re || re.test(r.j.error));
const codeFor = (email) => { const m = fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop(); return m.text.match(/\b(\d{6})\b/)[1]; };
const join = async (h) => { const e = h + "@example.com"; const r = await call("register", { handle: h, password: "pw-" + h + "-123", first_name: "F", last_name: "L", email: e }); await call("verify_email", { code: codeFor(e) }, r.j.token); return r.j.token; };
const note = (file, n) => fs.writeFileSync(path.join(NOTES, file), JSON.stringify(n));
async function start(env) {
  const port = await freePort();
  BASE = "http://127.0.0.1:" + port;
  php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DIR], { stdio: "ignore", env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "100", BGC_MAIL_LOG: MAIL, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }, env) });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + "/api.php?a=info"); break; } catch (e) { await sleep(100); } }
}

(async () => {
  // a schema 5 database with a member in it (made by the server itself, then marked 5 and the column taken away is not
  // possible in SQLite - so: a fresh server run, then the meta set back to 5 and the column checked after the restart)
  await start({});
  const boss = await join("boss"), ann = await join("ann");
  let r = await call("info");
  check("info: 2.723.0 or newer", /^2\.(72[3-9]|7[3-9]\d)\./.test(r.j.version), r.j);
  r = await call("forum_new", { category: "help", title: "Ann asks", body: "a question" }, ann);
  const tAnn = r.j.topic_id;
  check("(Ann posts a discussion)", ok(r), r.j);

  // ---- admin_suspend
  check("a member cannot suspend", err(await call("admin_suspend", { handle: "boss", days: 3 }, ann), 403));
  check("an admin cannot suspend themselves", err(await call("admin_suspend", { handle: "boss", days: 3 }, boss), 400, /yourself/));
  check("days out of range (3651): refused", err(await call("admin_suspend", { handle: "ann", days: 3651 }, boss), 400));
  check("nobody by that name: 404", err(await call("admin_suspend", { handle: "nobody", days: 3 }, boss), 404));
  const t0 = Date.now();
  r = await call("admin_suspend", { handle: "ann", days: 3 }, boss);
  const until = Date.parse(r.j.suspended_until);
  check("suspend @ann for 3 days: suspended_until about 3 days from now", ok(r) && Math.abs(until - (t0 + 3 * 86400000)) < 60000, r.j);
  r = await call("me", {}, ann);
  check("…her token is refused - signed out everywhere (her tokens are gone)", err(r, 401, /signed out/), r.j);
  r = await call("login", { handle: "ann", password: "pw-ann-123" });
  check("…she cannot sign in: 403, told until when", err(r, 403, /suspended until \d+ \w+ \d{4}, \d\d:\d\d UTC/), r.j);
  r = await call("forum_topic", { id: tAnn });
  check("…her discussion stays (a suspension is not a ban)", ok(r) && r.j.topic.title === "Ann asks", r.j);
  r = await call("admin_user", { handle: "ann" }, boss);
  check("admin_user shows suspended_until", ok(r) && r.j.user.suspended_until === new Date(until).toISOString(), r.j.user);
  r = await call("admin_suspend", { handle: "ann", days: 0 }, boss);
  check("days 0 lifts it: suspended_until null", ok(r) && r.j.suspended_until === null, r.j);
  r = await call("login", { handle: "ann", password: "pw-ann-123" });
  check("…she signs in again", ok(r) && !!r.j.token, r.j);
  const annTok = r.j.token;

  // ---- it ends by itself: the end set in the past (as if the days went by)
  await call("admin_suspend", { handle: "ann", days: 1 }, boss);
  php.kill(); await sleep(300);
  const past = spawnSync("php", ["-r", `$p = new PDO('sqlite:${DB}'); $p->exec("UPDATE bgc_users SET suspended_until = " . ((int) (microtime(true) * 1000) - 1000) . " WHERE handle = 'ann'");
    $p->exec("UPDATE bgc_meta SET v = '5' WHERE k = 'schema'");`]);
  check("(the day went by - and the database marked schema 5)", past.status === 0, String(past.stderr));
  await start({});
  r = await call("login", { handle: "ann", password: "pw-ann-123" });
  check("a suspension that has ended: she signs in (nothing to lift)", ok(r), r.j);
  r = await call("admin_user", { handle: "ann" }, boss);
  check("…admin_user: suspended_until null once it has ended; the schema 5 database opened fine (the column kept)", ok(r) && r.j.user.suspended_until === null, r.j);
  const meta = spawnSync("php", ["-r", `$p = new PDO('sqlite:${DB}'); echo $p->query("SELECT v FROM bgc_meta WHERE k = 'schema'")->fetchColumn();`]);
  check("…and marked schema 6 again", String(meta.stdout).trim() === "6", String(meta.stdout));
  check("API.md: admin_suspend", /admin_suspend/.test(fs.readFileSync(path.join(DIR, "API.md"), "utf8")));
  php.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); if (php) php.kill(); process.exit(1); });
