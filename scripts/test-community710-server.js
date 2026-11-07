#!/usr/bin/env node
/* bitGen Studio — 2.710.0: the bitGen Community SERVER (community/api.php, PHP) over real HTTP: every action in
 * community/API.md, the limits, the bans and blocks, the token-in-body fallback, the 16 KB body cap, .htaccess.
 * Starts `php -S 127.0.0.1:<free port> -t community` with BGC_DSN=sqlite:<temp file>, BGC_ADMINS=alice and a raised
 * register limit (BGC_REGISTER_PER_HOUR), then kills it and deletes the database. No dependencies (Node 18+, php).
 * Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id
 * to bitgen they join the community and can add other users as friends, first they ask, then if approved they become
 * friends. this should enable people to get help" */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.710.0 community server test did not run"); process.exit(0); }

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const REG_LIMIT = 12;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc710-"));
const DB = path.join(TMP, "community.db");
const MAIL = path.join(TMP, "mail.log");                 // 2.713.0: the emailed codes land here (BGC_MAIL_LOG)
/** the newest code emailed to this address */
const codeFor = (email) => { const ls = fs.existsSync(MAIL) ? fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((m) => m.to === email) : []; const m = ls.length ? ls[ls.length - 1].text.match(/\b(\d{6})\b/) : null; return m ? m[1] : null; };
let idn = 0;
/** 2.713.0: what joining needs now besides a handle and password - a name and an email address (unique per call) */
const P = () => ({ first_name: "First", last_name: "Last", email: "u" + (++idn) + "@example.com" });
let php = null, BASE = "";

function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** one call: {status, j, h} - token as Bearer unless opts.bodyToken / opts.noHeader */
async function call(action, body, token, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token && !opts.bodyToken) headers.Authorization = "Bearer " + token;
  const b = Object.assign({}, body || {}); if (token && opts.bodyToken) b.token = token;
  const r = await fetch(BASE + "/api.php?a=" + encodeURIComponent(action), { method: opts.method || "POST", headers, body: opts.method === "GET" ? undefined : (opts.raw !== undefined ? opts.raw : JSON.stringify(b)) });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) { j = { notJson: text.slice(0, 300) }; }
  return { status: r.status, j, h: r.headers };
}
const ok = (r) => r.status === 200 && r.j && r.j.ok === true;
const err = (r, s) => r.status === s && r.j && r.j.ok === false && typeof r.j.error === "string" && r.j.error.length > 0;

async function main() {
  // ---- the files ---------------------------------------------------------------------------------------------------
  const phpFiles = ["api.php", "config.sample.php", ...fs.readdirSync(path.join(DIR, "lib")).filter((f) => f.endsWith(".php")).map((f) => "lib/" + f)];
  const lint = phpFiles.map((f) => [f, spawnSync("php", ["-l", path.join(DIR, f)], { encoding: "utf8" })]);
  check("php -l: every PHP file (" + phpFiles.length + ") has no syntax error", lint.every(([, r]) => r.status === 0), lint.filter(([, r]) => r.status !== 0).map(([f, r]) => f + ": " + r.stdout + r.stderr));
  const hta = fs.existsSync(path.join(DIR, ".htaccess")) ? fs.readFileSync(path.join(DIR, ".htaccess"), "utf8") : "";
  check(".htaccess exists: denies all, grants only api.php", /Require all denied/.test(hta) && /<Files "api\.php">[\s\S]*Require all granted[\s\S]*<\/Files>/.test(hta));
  check(".htaccess: lib/ and config.php denied by name too (+ *.db, *.sql, *.md)", /RewriteRule \^lib/.test(hta) && /config\\\.php/.test(hta) && /\\\.db\$/.test(hta) && /\\\.sql\$/.test(hta) && /\\\.md\$/.test(hta));
  const libHta = fs.existsSync(path.join(DIR, "lib/.htaccess")) ? fs.readFileSync(path.join(DIR, "lib/.htaccess"), "utf8") : "";
  check("lib/.htaccess denies everything", /Require all denied/.test(libHta));
  const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  check(".gitignore: community/config.php and community/*.db never go in git", /^community\/config\.php$/m.test(gi) && /^community\/\*\.db$/m.test(gi));
  check("config.sample.php documents dsn / user / pass / admins / rules and the env overrides", ["'dsn'", "'user'", "'pass'", "'admins'", "'rules'", "BGC_DSN", "BGC_ADMINS"].every((k) => fs.readFileSync(path.join(DIR, "config.sample.php"), "utf8").includes(k)));
  const libs = phpFiles.filter((f) => f.startsWith("lib/"));
  check("every lib/*.php refuses to run unless loaded (boot.php - the loader - prints nothing)", libs.filter((f) => f !== "lib/boot.php").every((f) => /if \(!defined\('BGC'\)\) \{ http_response_code\(404\); exit; \}/.test(fs.readFileSync(path.join(DIR, f), "utf8"))) && !/echo|print/.test(fs.readFileSync(path.join(DIR, "lib/boot.php"), "utf8")));
  const allSrc = phpFiles.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n");
  check("no ->query( / ->exec( with input: the only exec() calls are fixed statements (schema, SET NAMES, PRAGMA)", !/->query\(/.test(allSrc) && (allSrc.match(/->exec\(/g) || []).length <= 8);

  // ---- the server -------------------------------------------------------------------------------------------------
  const port = await freePort(); BASE = "http://127.0.0.1:" + port;
  php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DIR], { env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BGC_ADMINS: "Alice", BGC_REGISTER_PER_HOUR: String(REG_LIMIT), BGC_MAIL_LOG: MAIL }), stdio: ["ignore", "pipe", "pipe"] });
  let phpLog = ""; php.stdout.on("data", (d) => { phpLog += d; }); php.stderr.on("data", (d) => { phpLog += d; });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { try { await fetch(BASE + "/api.php?a=info"); up = true; } catch (e) { await sleep(100); } }
  check("php -S started on 127.0.0.1:" + port, up, phpLog.slice(0, 400)); if (!up) return;

  // ---- info / the envelope ----------------------------------------------------------------------------------------
  let r = await call("info");
  check("info: {name, version 2.713.0, rules, users 0, help_room help}", ok(r) && r.j.name && r.j.version === "2.713.0" && typeof r.j.rules === "string" && r.j.users === 0 && r.j.help_room === "help", r.j);
  check("replies: Content-Type application/json; charset=utf-8 + X-Content-Type-Options nosniff", /^application\/json; charset=utf-8$/i.test(r.h.get("content-type") || "") && r.h.get("x-content-type-options") === "nosniff");
  check("the first request made the tables (SQLite file exists)", fs.existsSync(DB));
  r = await call("info", null, null, { method: "GET" }); check("GET info works (a browser check that the server is up)", ok(r));
  r = await call("me", null, null, { method: "GET" }); check("GET of anything else -> 405", err(r, 405), r);
  r = await call("nope"); check("unknown action -> 400 JSON", err(r, 400) && /json/.test(r.h.get("content-type")), r);
  r = await call("register", null, null, { raw: "{not json" }); check("bad JSON -> 400", err(r, 400), r);
  r = await call("register", null, null, { raw: "[1,2]" }); check("a JSON array body -> 400", err(r, 400), r);

  // ---- register ---------------------------------------------------------------------------------------------------
  let regCount = 0;     // register calls that got past validation (they count toward the per-IP limit)
  const T = {};
  // 2.713.0: joining = a name + an email address, then the emailed code
  const reg = async (handle, display) => {
    const p = P(); const x = await call("register", Object.assign({ handle, password: "pw-" + handle.toLowerCase() + "-123" }, p, display ? { display } : {})); regCount++;
    if (ok(x)) { const v = await call("verify_email", { code: codeFor(p.email) }, x.j.token); if (!ok(v)) console.log("verify failed for " + handle, v.j); }
    return x;
  };
  r = await reg("Alice", "Alice A");
  check("register: {token (64 hex), user {handle lower-case, display, online}}", ok(r) && /^[0-9a-f]{64}$/.test(r.j.token) && r.j.user.handle === "alice" && r.j.user.display === "Alice A" && r.j.user.online === true, r.j);
  T.alice = r.j.token;
  for (const h of ["bob", "carol", "dave", "eve", "frank"]) { r = await reg(h); check("register " + h, ok(r) && r.j.user.display === h, r.j); T[h] = r.j.token; }
  r = await reg("BOB"); check("register: a taken handle (any case) -> 409", err(r, 409), r);
  r = await reg("help"); check("register: \"help\" (the Help room's name) -> 409", err(r, 409), r);
  for (const bad of ["ab", "has space", "x".repeat(25), "émile", "a/b", ""]) {
    r = await call("register", { ...P(), handle: bad, password: "password123" }); check("register: bad handle " + JSON.stringify(bad) + " -> 400", err(r, 400), r);
  }
  r = await call("register", { ...P(), handle: "shorty", password: "1234567" }); check("register: a 7-character password -> 400", err(r, 400), r);
  r = await call("register", { ...P(), handle: "longpw", password: "p".repeat(201) }); check("register: a 201-character password -> 400", err(r, 400), r);
  r = await call("register", { ...P(), handle: "ctrl", password: "password123", display: "bad\u0007name" }); check("register: a display with a control character -> 400", err(r, 400), r);
  r = await call("register", { ...P(), handle: "longdisp", password: "password123", display: "d".repeat(41) }); check("register: a 41-character display -> 400", err(r, 400), r);
  r = await call("register", { ...P(), handle: 123, password: "password123" }); check("register: a number for handle -> 400", err(r, 400), r);
  r = await call("info"); check("info: users = 6", r.j.users === 6, r.j);

  // ---- login / me -------------------------------------------------------------------------------------------------
  let loginFails = 0;
  r = await call("login", { handle: "alice", password: "wrong-password" }); loginFails++;
  check("login: wrong password -> 401", err(r, 401), r);
  r = await call("login", { handle: "nobody", password: "whatever-pass" }); loginFails++;
  check("login: unknown user -> 401 (same words as a wrong password)", err(r, 401), r);
  r = await call("login", { handle: "ALICE", password: "pw-alice-123" });
  check("login: right (handle in any case) -> a new token + user", ok(r) && /^[0-9a-f]{64}$/.test(r.j.token) && r.j.token !== T.alice && r.j.user.handle === "alice", r.j);
  const aliceLoginToken = r.j.token;
  r = await call("me", null, T.alice); check("me: alice is admin (BGC_ADMINS=Alice)", ok(r) && r.j.user.handle === "alice" && r.j.admin === true, r.j);
  r = await call("me", null, T.bob); check("me: bob is not admin", ok(r) && r.j.user.handle === "bob" && r.j.admin === false, r.j);
  r = await call("me"); check("me: no token -> 401", err(r, 401), r);
  r = await call("me", null, "0".repeat(64)); check("me: an unknown token -> 401", err(r, 401), r);
  r = await call("me", null, T.bob, { bodyToken: true }); check("token-in-body fallback: no Authorization header, {token} in the body -> works", ok(r) && r.j.user.handle === "bob", r.j);

  // ---- search / friends -------------------------------------------------------------------------------------------
  r = await call("search", { q: "car" }, T.bob); check("search: prefix on handle, relation none", ok(r) && r.j.users.length === 1 && r.j.users[0].handle === "carol" && r.j.users[0].relation === "none" && "online" in r.j.users[0], r.j);
  r = await call("search", { q: "alice a" }, T.bob); check("search: prefix on display (any case)", ok(r) && r.j.users.length === 1 && r.j.users[0].handle === "alice", r.j);
  r = await call("search", { q: "%" }, T.bob); check("search: % is literal, not a wildcard", ok(r) && r.j.users.length === 0, r.j);
  r = await call("search", { q: "bo" }, T.bob); check("search: never myself", ok(r) && r.j.users.length === 0, r.j);
  r = await call("search", { q: "" }, T.bob); check("search: empty q -> 400", err(r, 400), r);
  r = await call("friend_request", { handle: "carol" }, T.bob); check("friend_request bob -> carol: requested", ok(r) && r.j.status === "requested", r.j);
  r = await call("friend_request", { handle: "carol" }, T.bob); check("friend_request again: still requested", ok(r) && r.j.status === "requested", r.j);
  r = await call("search", { q: "car" }, T.bob); check("search relation: requested (I asked)", r.j.users[0].relation === "requested", r.j);
  r = await call("search", { q: "bo" }, T.carol); check("search relation: incoming (they asked)", r.j.users[0].relation === "incoming", r.j);
  r = await call("friends", null, T.carol); check("friends: carol's incoming has bob (+ at)", ok(r) && r.j.incoming.length === 1 && r.j.incoming[0].handle === "bob" && /Z$/.test(r.j.incoming[0].at) && r.j.friends.length === 0, r.j);
  r = await call("friends", null, T.bob); check("friends: bob's outgoing has carol", ok(r) && r.j.outgoing.length === 1 && r.j.outgoing[0].handle === "carol", r.j);
  r = await call("poll", { since: 0 }, T.carol); check("poll: incoming = 1 waiting request", ok(r) && r.j.incoming === 1, r.j);
  r = await call("friend_respond", { handle: "bob", accept: true }, T.carol); check("friend_respond accept -> friends", ok(r) && r.j.status === "friends", r.j);
  r = await call("friends", null, T.bob); check("friends: bob + carol are friends (+ since), no requests left", r.j.friends.length === 1 && r.j.friends[0].handle === "carol" && /^\d{4}-\d\d-\d\dT.*Z$/.test(r.j.friends[0].since) && r.j.outgoing.length === 0, r.j);
  r = await call("search", { q: "car" }, T.bob); check("search relation: friend", r.j.users[0].relation === "friend", r.j);
  r = await call("friend_request", { handle: "carol" }, T.bob); check("friend_request to a friend: friends", r.j.status === "friends", r.j);
  r = await call("friend_request", { handle: "dave" }, T.bob);
  r = await call("friend_respond", { handle: "bob", accept: false }, T.dave); check("friend_respond decline -> declined", ok(r) && r.j.status === "declined", r.j);
  r = await call("friend_respond", { handle: "bob", accept: true }, T.dave); check("friend_respond with no request -> 404", err(r, 404), r);
  r = await call("friend_respond", { handle: "bob", accept: "yes" }, T.dave); check("friend_respond: accept must be a boolean -> 400", err(r, 400), r);
  r = await call("friends", null, T.bob); check("declined: bob's outgoing is empty", r.j.outgoing.length === 0, r.j);
  r = await call("friend_request", { handle: "ghost" }, T.bob); check("friend_request to nobody -> 404", err(r, 404), r);
  r = await call("friend_request", { handle: "bob" }, T.bob); check("friend_request to myself -> 400", err(r, 400), r);
  r = await call("friend_request", { handle: "eve" }, T.dave); check("mutual: dave asks eve -> requested", r.j.status === "requested", r.j);
  r = await call("friend_request", { handle: "dave" }, T.eve); check("mutual: eve asks dave back -> friends at once", ok(r) && r.j.status === "friends", r.j);
  r = await call("friend_remove", { handle: "eve" }, T.dave); check("friend_remove (unfriend) -> {}", ok(r) && Object.keys(r.j).length === 1, r.j);
  r = await call("friends", null, T.eve); check("friend_remove: eve's friends no longer has dave", r.j.friends.length === 0, r.j);
  await call("friend_request", { handle: "frank" }, T.bob);
  r = await call("friend_remove", { handle: "frank" }, T.bob); check("friend_remove cancels my request", ok(r), r);
  r = await call("poll", { since: 0 }, T.frank); check("... frank's incoming = 0", r.j.incoming === 0, r.j);

  // ---- send ---------------------------------------------------------------------------------------------------------
  r = await call("send", { to: "help", body: "  hello help  " }, T.bob);
  check("send to help: {message {id, room help, from, from_display, to null, body trimmed, at}}", ok(r) && r.j.message.id > 0 && r.j.message.room === "help" && r.j.message.from === "bob" && r.j.message.from_display === "bob" && r.j.message.to === null && r.j.message.body === "hello help" && /Z$/.test(r.j.message.at), r.j);
  const helpId = r.j.message.id;
  r = await call("send", { to: "carol", body: "hi carol\nline two" }, T.bob);
  check("send to a friend: room dm, to carol, newline kept", ok(r) && r.j.message.room === "dm" && r.j.message.to === "carol" && r.j.message.body === "hi carol\nline two", r.j);
  const dmId = r.j.message.id;
  r = await call("send", { to: "dave", body: "hi dave" }, T.bob); check("send to a non-friend -> 403", err(r, 403), r);
  r = await call("send", { to: "ghost", body: "hi" }, T.bob); check("send to nobody -> 404", err(r, 404), r);
  r = await call("send", { to: "help", body: "   " }, T.bob); check("send: empty body -> 400", err(r, 400), r);
  r = await call("send", { to: "help", body: "x".repeat(2001) }, T.bob); check("send: 2001 characters -> 400", err(r, 400), r);
  r = await call("send", { to: "help", body: "é".repeat(2000) }, T.bob); check("send: 2000 characters (2-byte UTF-8) is fine", ok(r) && r.j.message.body.length === 2000, r);
  const longId = r.j.message.id;
  r = await call("send", { to: "help", body: "<script>alert(1)</script> & co" }, T.carol);
  check("send: HTML is stored as text, and goes out with < and & escaped in the JSON", ok(r) && r.j.message.body === "<script>alert(1)</script> & co", r.j);
  const carolHelpId = r.j.message.id;

  // ---- poll ---------------------------------------------------------------------------------------------------------
  r = await call("poll", { since: 0 }, T.carol);
  const ids = (x) => x.j.messages.map((m) => m.id);
  check("poll (carol, since 0): the Help room + her DM, oldest first, + now", ok(r) && JSON.stringify(ids(r)) === JSON.stringify([helpId, dmId, longId, carolHelpId]) && /Z$/.test(r.j.now) && Array.isArray(r.j.deleted) && r.j.deleted.length === 0, r.j);
  r = await call("poll", { since: 0 }, T.dave); check("poll (dave): the Help room only - not bob <-> carol's DM", JSON.stringify(ids(r)) === JSON.stringify([helpId, longId, carolHelpId]), r.j);
  r = await call("poll", { since: dmId }, T.carol); check("poll since: only ids > since", JSON.stringify(ids(r)) === JSON.stringify([longId, carolHelpId]), r.j);
  r = await call("poll", { since: -1 }, T.carol); check("poll: since -1 -> 400", err(r, 400), r);
  r = await call("poll", { since: 0, at: "yesterday" }, T.carol); check("poll: a bad at -> 400", err(r, 400), r);
  r = await call("search", { q: "car" }, T.dave); check("poll marks the user seen: carol is online", r.j.users[0].online === true, r.j);
  r = await call("poll", { since: carolHelpId }, T.carol); const at1 = r.j.now;
  await sleep(5);
  r = await call("admin_delete", { id: helpId }, T.bob); check("admin_delete by a non-admin -> 403", err(r, 403), r);
  r = await call("admin_delete", { id: helpId }, T.alice); check("admin_delete by alice -> {}", ok(r), r);
  r = await call("admin_delete", { id: 999999 }, T.alice); check("admin_delete of no message -> 404", err(r, 404), r);
  r = await call("poll", { since: carolHelpId, at: at1 }, T.carol); check("poll with at: deleted = [the id] (a client drops it)", ok(r) && JSON.stringify(r.j.deleted) === JSON.stringify([helpId]) && r.j.messages.length === 0, r.j);
  const at2 = r.j.now; await sleep(5);
  r = await call("poll", { since: carolHelpId, at: at2 }, T.carol); check("poll with the next at: deleted is empty again", r.j.deleted.length === 0, r.j);
  r = await call("poll", { since: 0 }, T.carol); check("poll: a deleted message never comes back", !ids(r).includes(helpId), r.j);

  // ---- history ------------------------------------------------------------------------------------------------------
  const more = [];
  for (let i = 1; i <= 5; i++) { r = await call("send", { to: "help", body: "more " + i }, T.dave); more.push(r.j.message.id); }
  r = await call("history", { room: "help", limit: 2 }, T.carol); check("history help limit 2: the newest 2, oldest first", ok(r) && JSON.stringify(ids(r)) === JSON.stringify(more.slice(3)), r.j);
  r = await call("history", { room: "help", before: more[3], limit: 2 }, T.carol); check("history before: the 2 before that id", JSON.stringify(ids(r)) === JSON.stringify([more[1], more[2]]), r.j);
  r = await call("history", { room: "help" }, T.carol); check("history default limit 50: all Help messages but the deleted one", JSON.stringify(ids(r)) === JSON.stringify([longId, carolHelpId, ...more]), r.j);
  r = await call("history", { room: "carol" }, T.bob); check("history with a friend: our DMs", ok(r) && JSON.stringify(ids(r)) === JSON.stringify([dmId]), r.j);
  r = await call("history", { room: "bob" }, T.carol); check("history from the other side: the same DMs", JSON.stringify(ids(r)) === JSON.stringify([dmId]), r.j);
  r = await call("history", { room: "help", limit: 201 }, T.carol); check("history: limit 201 -> 400", err(r, 400), r);
  r = await call("history", { room: "help", limit: 0 }, T.carol); check("history: limit 0 -> 400", err(r, 400), r);
  r = await call("history", { room: "ghost" }, T.carol); check("history: no such user -> 404", err(r, 404), r);

  // ---- block / unblock ----------------------------------------------------------------------------------------------
  await call("send", { to: "help", body: "bob speaks" }, T.bob);
  r = await call("block", { handle: "bob" }, T.dave); check("block -> {}", ok(r), r);
  r = await call("poll", { since: 0 }, T.dave); check("block hides the blocked user's Help messages from the blocker (poll)", ok(r) && r.j.messages.every((m) => m.from !== "bob") && r.j.messages.length > 0, r.j);
  r = await call("history", { room: "help" }, T.dave); check("... and from history", r.j.messages.every((m) => m.from !== "bob"), r.j);
  r = await call("poll", { since: 0 }, T.carol); check("... but not from anyone else", r.j.messages.some((m) => m.from === "bob"), r.j);
  r = await call("friend_request", { handle: "dave" }, T.bob); check("block stops requests: bob -> dave 403", err(r, 403), r);
  r = await call("friend_request", { handle: "bob" }, T.dave); check("... either way: dave -> bob 403", err(r, 403), r);
  r = await call("search", { q: "da" }, T.bob); check("search leaves out who blocked me", r.j.users.length === 0, r.j);
  r = await call("search", { q: "bo" }, T.dave); check("search leaves out who I blocked", r.j.users.length === 0, r.j);
  r = await call("block", { handle: "bob" }, T.carol); check("carol blocks her friend bob", ok(r), r);
  r = await call("friends", null, T.bob); check("block ends the friendship", r.j.friends.length === 0, r.j);
  r = await call("send", { to: "carol", body: "hello?" }, T.bob); check("block stops DMs: bob -> carol 403", err(r, 403), r);
  r = await call("send", { to: "bob", body: "hello?" }, T.carol); check("... either way: carol -> bob 403", err(r, 403), r);
  r = await call("unblock", { handle: "bob" }, T.carol); check("unblock -> {}", ok(r), r);
  r = await call("friend_request", { handle: "carol" }, T.bob); check("after unblock a request works again (the friendship stays ended)", ok(r) && r.j.status === "requested", r.j);
  await call("friend_respond", { handle: "bob", accept: true }, T.carol);
  r = await call("unblock", { handle: "bob" }, T.dave);
  r = await call("poll", { since: 0 }, T.dave); check("unblock: bob's Help messages show again", r.j.messages.some((m) => m.from === "bob"), r.j);

  // ---- report / admin_reports ---------------------------------------------------------------------------------------
  r = await call("report", { id: longId, reason: "spammy" }, T.carol); check("report -> {}", ok(r), r);
  r = await call("report", { id: longId, reason: "" }, T.carol); check("report: empty reason -> 400", err(r, 400), r);
  r = await call("report", { id: longId, reason: "r".repeat(501) }, T.carol); check("report: 501-character reason -> 400", err(r, 400), r);
  r = await call("report", { id: 999999, reason: "x" }, T.carol); check("report: no such message -> 404", err(r, 404), r);
  r = await call("report", { id: dmId, reason: "x" }, T.dave); check("report: somebody else's DM -> 404", err(r, 404), r);
  r = await call("admin_reports", null, T.bob); check("admin_reports by a non-admin -> 403", err(r, 403), r);
  r = await call("admin_reports", null, T.alice);
  check("admin_reports: [{id, message, reporter, reason, at}]", ok(r) && r.j.reports.length === 1 && r.j.reports[0].id > 0 && r.j.reports[0].message.id === longId && r.j.reports[0].reporter === "carol" && r.j.reports[0].reason === "spammy" && /Z$/.test(r.j.reports[0].at), r.j);

  // ---- admin_ban ----------------------------------------------------------------------------------------------------
  r = await call("send", { to: "help", body: "eve was here" }, T.eve); const eveMsg = r.j.message.id;
  r = await call("admin_ban", { handle: "eve", banned: true }, T.bob); check("admin_ban by a non-admin -> 403", err(r, 403), r);
  r = await call("admin_ban", { handle: "eve", banned: true }, T.alice); check("admin_ban eve -> {}", ok(r), r);
  r = await call("me", null, T.eve); check("ban: eve's token is rejected (401)", err(r, 401), r);
  r = await call("login", { handle: "eve", password: "pw-eve-123" }); check("ban: eve's login -> 403", err(r, 403), r);
  r = await call("poll", { since: 0 }, T.carol); check("ban: eve's messages are hidden", !ids(r).includes(eveMsg), r.j);
  r = await call("search", { q: "ev" }, T.carol); check("ban: eve is left out of search", r.j.users.length === 0, r.j);
  r = await call("info"); check("info: users counts the not-banned (5)", r.j.users === 5, r.j);
  r = await call("admin_ban", { handle: "ghost", banned: true }, T.alice); check("admin_ban of nobody -> 404", err(r, 404), r);
  r = await call("admin_ban", { handle: "eve", banned: "yes" }, T.alice); check("admin_ban: banned must be a boolean -> 400", err(r, 400), r);
  r = await call("admin_ban", { handle: "eve", banned: false }, T.alice); check("admin_ban banned:false lifts it", ok(r), r);
  r = await call("login", { handle: "eve", password: "pw-eve-123" }); check("... eve can sign in again, her messages show again", ok(r) && ids(await call("poll", { since: 0 }, T.carol)).includes(eveMsg), r.j);

  // ---- the 16 KB body cap -------------------------------------------------------------------------------------------
  r = await call("send", { to: "help", body: "hi", pad: "x".repeat(17000) }, T.bob); check("a request body over 16 KB is refused (413)", err(r, 413), r);
  r = await call("poll", { since: 0 }, T.bob); check("... and nothing was sent", !r.j.messages.some((m) => m.body === "hi" && m.from === "bob"), r.j);

  // ---- send's rate limit --------------------------------------------------------------------------------------------
  let sent = 0, first429 = 0;
  for (let i = 1; i <= 31; i++) { r = await call("send", { to: "help", body: "flood " + i }, T.frank); if (ok(r)) sent++; else if (r.status === 429 && !first429) first429 = i; }
  check("send: 30 messages a minute go through, the 31st -> 429", sent === 30 && first429 === 31 && err(r, 429), { sent, first429, last: r.j });

  // ---- register's rate limit (per IP) -------------------------------------------------------------------------------
  let n = 0; while (regCount < REG_LIMIT) { r = await reg("filler" + (++n)); }
  check("register: the per-IP limit lets " + REG_LIMIT + " through (BGC_REGISTER_PER_HOUR)", ok(r), r);
  r = await reg("onetoomany"); check("register: one more from the same IP -> 429", err(r, 429), r);

  // ---- delete_account -----------------------------------------------------------------------------------------------
  r = await call("delete_account", { password: "not-franks" }, T.frank); check("delete_account: wrong password -> 403 (not 401 - that would sign bitGen out)", err(r, 403), r);
  r = await call("delete_account", { password: "pw-frank-123" }, T.frank); check("delete_account -> {}", ok(r), r);
  r = await call("me", null, T.frank); check("delete_account: the token is gone (401)", err(r, 401), r);
  r = await call("login", { handle: "frank", password: "pw-frank-123" }); loginFails++; check("delete_account: frank cannot log in (401)", err(r, 401), r);
  r = await call("poll", { since: 0 }, T.carol); const left = r.j.messages.filter((m) => /^flood /.test(m.body));
  check("delete_account: frank's messages stay, from \"(left)\"", left.length === 30 && left.every((m) => m.from === "(left)" && m.from_display === "(left)"), left.slice(0, 2));

  // ---- logout -------------------------------------------------------------------------------------------------------
  r = await call("logout", null, aliceLoginToken); check("logout -> {}", ok(r), r);
  r = await call("me", null, aliceLoginToken); check("logout: that token is rejected (401)", err(r, 401), r);
  r = await call("me", null, T.alice); check("logout: only that token - alice's other one still works", ok(r) && r.j.admin === true, r.j);
  r = await call("logout"); check("logout without a token -> 401", err(r, 401), r);

  // ---- login's failure limit (last: it locks this IP out) -----------------------------------------------------------
  let lock = 0;
  while (loginFails < 10) { r = await call("login", { handle: "dave", password: "wrong-wrong" }); loginFails++; if (r.status !== 401) break; }
  check("login: wrong passwords are 401 until 10 failures from this IP", r.status === 401 && loginFails === 10, r);
  r = await call("login", { handle: "dave", password: "pw-dave-123" }); lock = r.status;
  check("login: after 10 failures in 15 minutes -> 429, even with the right password", err(r, 429), r);

  // ---- nothing leaked ------------------------------------------------------------------------------------------------
  check("no 500 and no PHP warning / error in the server log (nothing leaked)", !/\[500\]/.test(phpLog) && !/(Warning|Fatal|Notice|Deprecated|Stack trace)/.test(phpLog), phpLog.split("\n").filter((l) => /(Warning|Fatal|Notice|Deprecated)/.test(l)).slice(0, 5));
  void lock;
}

main().catch((e) => { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }).finally(() => {
  try { if (php) php.kill("SIGKILL"); } catch (e) { /* gone */ }
  setTimeout(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* tmp */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }, 150);
});
