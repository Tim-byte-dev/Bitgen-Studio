#!/usr/bin/env node
/* bitGen Studio — 2.713.0: the Community server's names + confirmed email, email bans, and the discussions (guests post
 * for an admin to approve), over real HTTP: `php -S` on community/ with SQLite, the emailed codes written to a file
 * (BGC_MAIL_LOG). Also an older (schema 1) database brought up to date, its members asked for a name + email.
 * Tim: "let users enter first name, last name and email - and verify email so if we ban a user they can't just change
 * their username. they don't have to sign up to the community if they don't want to, add a discussions page on tigerart
 * for registered users to talk and allow guest access too" (guests: read and post, approved by an admin; real names:
 * admins only; one account for the app and the website). SKIP without php. */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.713.0 community server test did not run"); process.exit(0); }
const DIR = path.join(__dirname, "..", "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc713-"));
const MAIL = path.join(TMP, "mail.log");
const procs = [];
let BASE = "";
async function call(action, body, token) {
  const r = await fetch(BASE + "/api.php?a=" + action, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { j = {}; }
  return { status: r.status, j };
}
const ok = (r) => r.status === 200 && r.j.ok === true;
const err = (r, s, re) => r.status === s && r.j.ok === false && (!re || re.test(r.j.error));
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const codeFor = (email) => { const m = mails().filter((x) => x.to === email); const c = m.length ? m[m.length - 1].text.match(/\b(\d{6})\b/) : null; return c ? c[1] : null; };
async function server(db, extra) {
  const port = await freePort();
  const p = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DIR], { stdio: "ignore", env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + db, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "200", BGC_MAIL_LOG: MAIL, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }, extra || {}) });
  procs.push(p);
  for (let i = 0; i < 60; i++) { try { await fetch("http://127.0.0.1:" + port + "/api.php?a=info"); break; } catch (e) { await sleep(100); } }
  return "http://127.0.0.1:" + port;
}
const join = async (handle, first, last, email) => {
  const r = await call("register", { handle, password: "pw-" + handle + "-123", first_name: first, last_name: last, email });
  if (ok(r)) await call("verify_email", { code: codeFor(email) }, r.j.token);
  return r;
};
/** PHP against the SQLite file (to age a code, or build a schema-1 database) */
const sql = (db, statements) => spawnSync("php", ["-r", "$p = new PDO('sqlite:' . $argv[1]); foreach (array_slice($argv, 2) as $s) $p->exec($s);", db, ...statements], { encoding: "utf8" });

(async () => {
  const DB = path.join(TMP, "c.db");
  BASE = await server(DB);

  // ---- joining: names + an email address ---------------------------------------------------------------------------
  let r = await call("register", { handle: "oldapp", password: "password123" });
  check("an older bitGen (no name / email) is told to update", err(r, 400, /first name, last name and email/), r.j);
  r = await call("register", { handle: "nomail", password: "password123", first_name: "A", last_name: "B", email: "not-an-email" });
  check("a bad email address -> 400", err(r, 400, /not an email/), r.j);
  r = await call("register", { handle: "noname", password: "password123", first_name: "", last_name: "B", email: "x@example.com" });
  check("an empty first name -> 400", err(r, 400, /first name/i), r.j);
  r = await call("register", { handle: "Tim", password: "pw-tim-123", first_name: "Tim", last_name: "Paul", email: "Tim.Paul+bitgen@Gmail.com" });
  check("register: {token, user (no real name in it), profile {verified: false}, mail_sent}", ok(r) && r.j.profile.verified === false && r.j.mail_sent === true && !("first_name" in r.j.user) && !("email" in r.j.user), r.j);
  const tim = r.j.token;
  const m = mails().pop();
  check("the code went to the address, from noreply@<the site>, with the code in subject and text", m && m.to === "Tim.Paul+bitgen@Gmail.com" && /^noreply@/.test(m.from) && /code: \d{6}$/.test(m.subject) && /Hi Tim,/.test(m.text) && /15 minutes/.test(m.text), m);
  r = await call("register", { handle: "tim2", password: "pw-tim2-123", first_name: "T", last_name: "P", email: "timpaul@googlemail.com" });
  check("one account per person: Gmail dots / +tag / googlemail are the same address -> 409", err(r, 409, /already has an account/), r.j);

  // ---- before the address is confirmed ------------------------------------------------------------------------------
  r = await call("send", { to: "help", body: "hello" }, tim);
  check("not confirmed: chat refused with need: verify", err(r, 403, /Confirm your email/) && r.j.need === "verify", r.j);
  r = await call("me", {}, tim);
  check("not confirmed: me works and shows the profile", ok(r) && r.j.profile.verified === false && r.j.profile.first_name === "Tim" && r.j.profile.email === "Tim.Paul+bitgen@Gmail.com", r.j);
  r = await call("forum_list", {}, tim);
  check("not confirmed: reading the discussions works", ok(r));
  r = await call("forum_new", { category: "help", title: "Hello there", body: "hi" }, tim);
  check("not confirmed: posting refused (need: verify)", err(r, 403) && r.j.need === "verify", r.j);
  r = await call("verify_email", { code: "000000" === codeFor("Tim.Paul+bitgen@Gmail.com") ? "111111" : "000000" }, tim);
  check("a wrong code: 400, says how many tries are left", err(r, 400, /4 tries left/), r.j);
  r = await call("verify_email", { code: codeFor("Tim.Paul+bitgen@Gmail.com") }, tim);
  check("the right code: confirmed", ok(r) && r.j.profile.verified === true, r.j);
  r = await call("send", { to: "help", body: "hello" }, tim);
  check("confirmed: chat works", ok(r), r.j);
  r = await call("login", { handle: "tim", password: "pw-tim-123" });
  check("login says the profile is confirmed", ok(r) && r.j.profile.verified === true, r.j);

  // tries, running out, asking again
  r = await call("register", { handle: "slow", password: "pw-slow-123", first_name: "S", last_name: "Low", email: "slow@example.com" }); const slow = r.j.token;
  for (let i = 0; i < 5; i++) await call("verify_email", { code: "999999" === codeFor("slow@example.com") ? "888888" : "999999" }, slow);
  r = await call("verify_email", { code: codeFor("slow@example.com") }, slow);
  check("after 5 wrong codes even the right one is refused (429 - ask for a new one)", err(r, 429, /new one/), r.j);
  r = await call("resend_code", {}, slow);
  check("resend_code: a new code goes", ok(r) && r.j.mail_sent === true, r.j);
  sql(DB, ["UPDATE bgc_users SET code_expires = 1 WHERE handle = 'slow'"]);
  r = await call("verify_email", { code: codeFor("slow@example.com") }, slow);
  check("a code past its 15 minutes -> 400 run out", err(r, 400, /run out/), r.j);
  for (let i = 0; i < 3; i++) await call("resend_code", {}, slow);
  r = await call("resend_code", {}, slow);
  check("resend_code: 4 an hour, then 429", err(r, 429, /wait an hour/), r.j);

  // ---- set_profile -------------------------------------------------------------------------------------------------
  r = await join("ann", "Ann", "Lee", "ann@example.com"); const ann = r.j.token;
  r = await call("set_profile", { first_name: "Anne", last_name: "Lee", email: "ann@example.com" }, ann);
  check("set_profile: new names, same address -> still confirmed, no email", ok(r) && r.j.profile.first_name === "Anne" && r.j.profile.verified === true && r.j.mail_sent === false, r.j);
  r = await call("set_profile", { first_name: "Anne", last_name: "Lee", email: "tim.paul@gmail.com" }, ann);
  check("set_profile: someone else's address (as Gmail sees it) -> 409", err(r, 409), r.j);
  r = await call("set_profile", { first_name: "Anne", last_name: "Lee", email: "anne@example.org" }, ann);
  check("set_profile: a new address -> not confirmed until its code is typed (a code went to it)", ok(r) && r.j.profile.verified === false && r.j.mail_sent === true && codeFor("anne@example.org"), r.j);
  r = await call("send", { to: "help", body: "x" }, ann); check("... and meanwhile chat waits for it", err(r, 403) && r.j.need === "verify");
  r = await call("verify_email", { code: codeFor("anne@example.org") }, ann); check("... confirmed again", ok(r) && r.j.profile.verified === true);

  // ---- real names: admins only ----------------------------------------------------------------------------------------
  r = await join("boss", "Big", "Boss", "boss@example.com"); const boss = r.j.token;
  r = await call("search", { q: "ann" }, tim);
  check("search shows user ID + display name only - no real name, no email", ok(r) && r.j.users.length && !JSON.stringify(r.j).includes("Anne") && !JSON.stringify(r.j).includes("example.org"), r.j);
  r = await call("admin_user", { handle: "ann" }, tim); check("admin_user: not an admin -> 403", err(r, 403));
  r = await call("admin_user", { handle: "ann" }, boss);
  check("admin_user: an admin sees the real name and email", ok(r) && r.j.user.first_name === "Anne" && r.j.user.last_name === "Lee" && r.j.user.email === "anne@example.org" && r.j.user.verified === true, r.j);

  // ---- a ban bans the address -----------------------------------------------------------------------------------------
  r = await join("troll", "Tr", "Oll", "Troll.Face+1@gmail.com"); const troll = r.j.token;
  r = await call("admin_ban", { handle: "troll", banned: true }, boss); check("admin bans troll", ok(r));
  r = await call("register", { handle: "troll2", password: "pw-troll2-123", first_name: "N", last_name: "Ew", email: "trollface@gmail.com" });
  check("a banned person cannot come back under a new user ID (same address, as Gmail sees it) -> 403", err(r, 403, /cannot join/), r.j);
  r = await call("set_profile", { first_name: "A", last_name: "B", email: "troll.face@googlemail.com" }, ann);
  check("... nor can anyone move their account to the banned address", err(r, 403, /cannot join/), r.j);
  r = await call("admin_ban", { handle: "troll", banned: false }, boss);
  r = await call("register", { handle: "troll3", password: "pw-troll3-123", first_name: "N", last_name: "Ew", email: "someone.new@example.com" });
  check("an unbanned address is free again (and other addresses always were)", ok(r), r.j);
  r = await call("admin_ban", { handle: "troll", banned: true }, boss);

  // ---- the discussions --------------------------------------------------------------------------------------------------
  r = await call("forum_list", {});
  check("forum_list without an account: the categories (2.714.0: + bugs), no topics yet", ok(r) && r.j.categories.map((c) => c.id).join() === "help,bugs,showcase,ideas,general" && r.j.topics.length === 0, r.j);
  r = await call("forum_list", {}, "f".repeat(64)); check("a bad token on a guest-or-member action -> 401 (not silently a guest)", err(r, 401));
  r = await call("forum_new", { category: "help", title: "How do I start?", body: "First time here.\nWhere do I begin?" }, tim);
  check("a member starts a discussion - live at once", ok(r) && r.j.pending === false && r.j.topic_id > 0, r.j);
  const t1 = r.j.topic_id;
  r = await call("forum_new", { category: "help", title: "Guest question", body: "Can I use it on a laptop?", guest_name: "Visitor Vee" });
  check("a guest starts one - it waits for an admin (pending)", ok(r) && r.j.pending === true, r.j);
  const g1 = r.j.topic_id, g1post = r.j.post_id;
  r = await call("forum_new", { category: "help", title: "No name", body: "x" }); check("a guest needs a name", err(r, 400, /Your name/), r.j);
  r = await call("forum_new", { category: "nope", title: "Bad cat", body: "x" }, tim); check("an unknown category -> 400", err(r, 400, /category/), r.j);
  r = await call("forum_new", { category: "help", title: "Hi", body: "x" }, tim); check("a 2-character title -> 400", err(r, 400, /title/i), r.j);
  r = await call("forum_list", {});
  check("the list shows the member's discussion, not the guest's (waiting)", ok(r) && r.j.topics.length === 1 && r.j.topics[0].id === t1 && r.j.topics[0].author.handle === "tim" && !("pending" in r.j), r.j);
  r = await call("forum_topic", { id: g1 }); check("a waiting discussion is not there for guests (404)", err(r, 404));
  r = await call("forum_list", {}, boss); check("admins are told how many posts wait", ok(r) && r.j.pending === 1, r.j);
  r = await call("admin_forum_pending", {}, tim); check("admin_forum_pending: not an admin -> 403", err(r, 403));
  r = await call("admin_forum_pending", {}, boss);
  check("admin_forum_pending lists the guest's post (new topic, name, text)", ok(r) && r.j.posts.length === 1 && r.j.posts[0].new_topic === true && r.j.posts[0].guest_name === "Visitor Vee" && /laptop/.test(r.j.posts[0].body), r.j);
  r = await call("admin_forum_moderate", { post_id: g1post, approve: true }, boss); check("approve it", ok(r));
  r = await call("forum_list", {});
  check("approved: the guest's discussion is listed, by the guest's name marked guest", ok(r) && r.j.topics.some((t) => t.id === g1 && t.author.guest === true && t.author.name === "Visitor Vee"), r.j);
  r = await call("forum_reply", { topic_id: t1, body: "Start with the guide." }, ann);
  check("a member replies - live", ok(r) && r.j.pending === false, r.j);
  const annReply = r.j.post_id;
  r = await call("forum_reply", { topic_id: t1, body: "Me too!", guest_name: "Gus" });
  check("a guest replies - waits", ok(r) && r.j.pending === true, r.j);
  const gusReply = r.j.post_id;
  r = await call("forum_topic", { id: t1 });
  check("the topic: 2 posts (the guest's reply waits), replies 1, no real names anywhere", ok(r) && r.j.posts.length === 2 && r.j.topic.replies === 1 && r.j.posts[0].first === true && /Where do I begin/.test(r.j.posts[0].body) && !/Anne|Paul|example/.test(JSON.stringify(r.j)), r.j);
  r = await call("forum_topic", { id: t1 }, boss);
  check("an admin sees the waiting reply too (pending: true) and may delete anything", ok(r) && r.j.posts.length === 3 && r.j.posts[2].pending === true && r.j.posts.every((p) => p.can_delete), r.j);
  r = await call("admin_forum_moderate", { post_id: gusReply, approve: false }, boss); check("refuse the guest's reply", ok(r));
  r = await call("forum_topic", { id: t1 }, boss); check("... it is gone for good", r.j.posts.length === 2, r.j.posts.length);
  r = await call("forum_delete", { post_id: annReply }, tim); check("deleting someone else's post -> 403", err(r, 403));
  r = await call("forum_delete", { post_id: annReply }, ann); check("deleting your own post", ok(r) && r.j.topic_deleted === false);
  r = await call("forum_topic", { id: t1 }); check("... it is gone and replies is 0", r.j.posts.length === 1 && r.j.topic.replies === 0, r.j.topic);
  for (let i = 0; i < 3; i++) await call("forum_reply", { topic_id: t1, body: "guest " + i, guest_name: "Gus" });
  r = await call("forum_reply", { topic_id: t1, body: "one more", guest_name: "Gus" });
  check("guests: 4 posts an hour from one address, then 429", err(r, 429, /4 times an hour/), r.j);
  // a banned member's discussions disappear; a member who leaves shows as (left)
  r = await call("forum_new", { category: "general", title: "Troll post", body: "nonsense" }, troll);
  check("a banned member cannot post (signed out)", err(r, 401), r.j);
  r = await join("leaver", "Lea", "Ver", "leaver@example.com"); const leaver = r.j.token;
  r = await call("forum_new", { category: "showcase", title: "My first film", body: "Look!" }, leaver); const t3 = r.j.topic_id;
  r = await call("delete_account", { password: "pw-leaver-123" }, leaver);
  r = await call("forum_topic", { id: t3 });
  check("a member who left: their discussion stays, from (left)", ok(r) && r.j.topic.author.left === true && r.j.posts[0].author.name === "(left)", r.j.topic);
  r = await call("forum_list", { category: "showcase" }); check("forum_list by category", ok(r) && r.j.topics.length === 1 && r.j.topics[0].id === t3, r.j);
  r = await call("forum_delete", { post_id: r.j.topics.length ? (await call("forum_topic", { id: t3 })).j.posts[0].id : 0 }, boss);
  check("an admin deletes a first post -> the whole discussion goes", ok(r) && r.j.topic_deleted === true && err(await call("forum_topic", { id: t3 }), 404), r.j);
  r = await call("forum_new", { category: "general", title: "Paging test", body: "p0" }, tim); const tp = r.j.topic_id;
  for (let i = 1; i <= 31; i++) await call("forum_reply", { topic_id: tp, body: "p" + i }, i % 2 ? ann : boss);
  r = await call("forum_topic", { id: tp, page: 2 });
  check("posts come 30 a page (page 2 of 2 holds the 31st and 32nd)", ok(r) && r.j.pages === 2 && r.j.page === 2 && r.j.posts.length === 2 && r.j.posts[1].body === "p31", { pages: r.j.pages, n: (r.j.posts || []).length });

  // ---- an older database (schema 1) -------------------------------------------------------------------------------------
  const OLD = path.join(TMP, "old.db");
  sql(OLD, ["CREATE TABLE bgc_meta (k VARCHAR(40) NOT NULL PRIMARY KEY, v VARCHAR(200) NOT NULL)", "INSERT INTO bgc_meta VALUES ('schema', '1')",
    "CREATE TABLE bgc_users (id INTEGER PRIMARY KEY AUTOINCREMENT, handle VARCHAR(24) NOT NULL UNIQUE, display VARCHAR(40) NOT NULL, pass_hash VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, last_seen BIGINT NOT NULL DEFAULT 0, banned SMALLINT NOT NULL DEFAULT 0)"]);
  const hash = spawnSync("php", ["-r", "echo password_hash(base64_encode(hash('sha384', 'old-password-1', true)), PASSWORD_DEFAULT);"], { encoding: "utf8" }).stdout;
  sql(OLD, [`INSERT INTO bgc_users (handle, display, pass_hash, created_at, last_seen, banned) VALUES ('oldie', 'Oldie', '${hash}', 1, 1, 0)`]);
  BASE = await server(OLD);
  r = await call("login", { handle: "oldie", password: "old-password-1" });
  check("schema 1 -> 2: an older member still signs in; their profile needs a name + email", ok(r) && r.j.profile.needs_profile === true && r.j.profile.verified === false, r.j);
  const oldie = r.j.token;
  r = await call("send", { to: "help", body: "hi" }, oldie); check("... and is asked for them before chatting (need: profile)", err(r, 403, /name and email/) && r.j.need === "profile", r.j);
  r = await call("set_profile", { first_name: "Old", last_name: "Timer", email: "old@example.com" }, oldie);
  r = await call("verify_email", { code: codeFor("old@example.com") }, oldie);
  r = await call("send", { to: "help", body: "back again" }, oldie); check("... then, confirmed, chats as before", ok(r), r.j);
  const cols = spawnSync("php", ["-r", "$p = new PDO('sqlite:' . $argv[1]); echo json_encode([$p->query('SELECT v FROM bgc_meta WHERE k = \"schema\"')->fetchColumn(), $p->query(\"SELECT sql FROM sqlite_master WHERE name = 'bgc_users_email'\")->fetchColumn()]);", OLD], { encoding: "utf8" }).stdout;
  check("the old database is brought up to the current schema (2+) with the unique email index", /^\["[2-9]","CREATE UNIQUE INDEX bgc_users_email/.test(cols), cols);

  console.log("\n" + pass + " passed, " + fail + " failed");
  procs.forEach((p) => p.kill());
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); procs.forEach((p) => p.kill()); process.exit(1); });
