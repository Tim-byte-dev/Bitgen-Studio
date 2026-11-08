#!/usr/bin/env node
/* bitGen Studio — 2.721.0: PINNED DISCUSSIONS + bitGen Studio's OWN DISCUSSIONS on the Community server, over real HTTP
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
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.721.0 pins / notes server test did not run"); process.exit(0); }
const DIR = path.join(__dirname, "..", "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc721-"));
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
  // ---- an older database: schema 4, a topic in it
  const old = spawnSync("php", ["-r", `$p = new PDO('sqlite:${DB}');
    $p->exec("CREATE TABLE bgc_meta (k VARCHAR(40) NOT NULL PRIMARY KEY, v VARCHAR(200) NOT NULL)");
    $p->exec("INSERT INTO bgc_meta (k, v) VALUES ('schema', '4')");
    $p->exec("CREATE TABLE bgc_topics (id INTEGER PRIMARY KEY AUTOINCREMENT, category VARCHAR(16) NOT NULL, title VARCHAR(200) NOT NULL, user_id BIGINT NULL, guest_name VARCHAR(40) NULL, created_at BIGINT NOT NULL, last_at BIGINT NOT NULL, replies INT NOT NULL DEFAULT 0, pending SMALLINT NOT NULL DEFAULT 0, deleted SMALLINT NOT NULL DEFAULT 0)");
    $p->exec("CREATE TABLE bgc_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id BIGINT NOT NULL, user_id BIGINT NULL, guest_name VARCHAR(40) NULL, body TEXT NOT NULL, at BIGINT NOT NULL, pending SMALLINT NOT NULL DEFAULT 0, deleted SMALLINT NOT NULL DEFAULT 0)");
    $t = (int) (microtime(true) * 1000);
    $p->exec("INSERT INTO bgc_topics (category, title, user_id, guest_name, created_at, last_at) VALUES ('help', 'An old question', NULL, 'Old guest', $t, $t)");
    $p->exec("INSERT INTO bgc_posts (topic_id, user_id, guest_name, body, at) VALUES (1, NULL, 'Old guest', 'from before', $t)");`]);
  check("(a schema 4 SQLite database made)", old.status === 0, String(old.stderr));
  fs.mkdirSync(NOTES);
  fs.copyFileSync(path.join(DIR, "notes", "speed-results-2026-11.json"), path.join(NOTES, "speed-results-2026-11.json"));
  note("b-tips.json", { key: "tips-one", rev: 1, category: "help", pinned: false, title: "Tips: one", lines: ["line 1", "line 2"] });
  note("c-bad.json", { key: "Bad Key!", title: "x", body: "y" });
  note("d-bugs.json", { key: "bug-note", title: "Not in bugs", body: "y", category: "bugs" });
  await start({ BGC_NOTES_DIR: NOTES });
  const boss = await join("boss"), ann = await join("ann");
  let r = await call("info");
  check("info: the server says 2.721.0 or newer", ok(r) && /^2\.(72[1-9]|7[3-9]\d)\./.test(r.j.version), r.j);
  r = await call("forum_list", {});
  const real = JSON.parse(fs.readFileSync(path.join(DIR, "notes", "speed-results-2026-11.json"), "utf8"));
  const titles = r.j.topics.map((t) => t.title);
  check("the older database migrated: its topic kept (not pinned); the two good notes posted, the bad key and a 'bugs' note skipped",
    ok(r) && r.j.total === 3 && titles.includes("An old question") && titles.includes("Tips: one") && titles.includes(real.title) && !titles.includes("x") && !titles.includes("Not in bugs"), r.j.topics);
  check("…the pinned note first, pinned: true; by bitGen Studio (official); the others pinned: false", r.j.topics[0].title === real.title && r.j.topics[0].pinned === true
    && JSON.stringify(r.j.topics[0].author) === '{"official":true,"name":"bitGen Studio"}' && r.j.topics.slice(1).every((t) => t.pinned === false), r.j.topics);
  const tSpeed = r.j.topics[0].id, tTips = r.j.topics.find((t) => t.title === "Tips: one").id;
  r = await call("forum_topic", { id: tSpeed });
  check("its text (the real note): the 3090 table, the 5090 numbers, 繁體中文 - one post, official, pinned", ok(r) && r.j.topic.pinned === true && r.j.posts.length === 1 && r.j.posts[0].author.official === true
    && /796 s -> 355 s/.test(r.j.posts[0].body) && /11 s a picture/.test(r.j.posts[0].body) && /== 繁體中文 ==/.test(r.j.posts[0].body) && r.j.posts[0].body === real.lines.join("\n"), r.j.topic);
  check("the real note is within the limits (title <= 120, text <= 8000, general, pinned)", real.title.length <= 120 && real.lines.join("\n").length <= 8000 && real.category === "general" && real.pinned === true && real.rev >= 1);
  r = await call("forum_list", {});
  check("posted once: reading the list again adds nothing", r.j.total === 3);
  // a member's reply on it keeps working; replies count
  r = await call("forum_reply", { topic_id: tSpeed, body: "My 4090: 9 s." }, ann);
  check("a member replies to it", ok(r) && r.j.pending === false);

  // ---- a higher rev updates the text, its reply and pin stay
  note("b-tips.json", { key: "tips-one", rev: 2, category: "help", title: "Tips: one (updated)", lines: ["new text"] });
  r = await call("forum_list", {});
  const tt = r.j.topics.find((t) => t.id === tTips);
  check("rev 2: the same discussion's title updated (no new one)", r.j.total === 3 && tt && tt.title === "Tips: one (updated)", r.j.topics);
  r = await call("forum_topic", { id: tTips });
  check("…and its text", r.j.posts[0].body === "new text", r.j.posts[0]);
  r = await call("forum_topic", { id: tSpeed });
  check("…the other note untouched, its reply kept", r.j.posts.length === 2 && r.j.topic.pinned === true);

  // ---- pin / unpin
  check("admin_forum_pin: a member is refused", err(await call("admin_forum_pin", { topic_id: tTips, pinned: true }, ann), 403));
  r = await call("admin_forum_pin", { topic_id: tSpeed, pinned: false }, boss);
  check("an admin unpins the note", ok(r) && r.j.pinned === false);
  r = await call("forum_list", {});
  check("…unpinned: newest activity first (the note has a reply, so it is still near the top), pinned: false everywhere", r.j.topics.every((t) => t.pinned === false), r.j.topics);
  r = await call("admin_forum_pin", { topic_id: tTips, pinned: true }, boss);
  r = await call("forum_list", {});
  check("an admin pins another discussion: it goes first", ok(r) && r.j.topics[0].id === tTips && r.j.topics[0].pinned === true, r.j.topics);
  check("…a discussion that is not there: 404", err(await call("admin_forum_pin", { topic_id: 99999, pinned: true }, boss), 404));

  // ---- removed by an admin: not posted again (even after the notes change)
  const del = await call("forum_topic", { id: tTips });
  r = await call("forum_delete", { post_id: del.j.posts[0].id }, boss);
  note("b-tips.json", { key: "tips-one", rev: 3, category: "help", title: "Tips: one (again)", lines: ["x"] });
  r = await call("forum_list", {});
  check("a note an admin removed does not come back (a newer rev neither)", !r.j.topics.some((t) => /Tips: one/.test(t.title)) && r.j.total === 2, r.j.topics);

  // ---- nobody else is bitGen Studio
  for (const name of ["bitGen Studio", "BITGEN", "bit-gen studio team"]) {
    r = await call("forum_new", { category: "general", title: "Hello there", body: "x", guest_name: name });
    check(`a guest named "${name}": refused`, err(r, 400, /kept for bitGen Studio/), r.j);
  }
  check("…an ordinary guest name still posts (waits for an admin)", ok(r = await call("forum_new", { category: "general", title: "Hello there", body: "x", guest_name: "Gina" })) && r.j.pending === true);
  php.kill();

  // ---- a BGC_DSN server without BGC_NOTES_DIR: no notes
  fs.rmSync(DB, { force: true });
  await start({});
  r = await call("forum_list", {});
  check("a test / developer server (BGC_DSN, no BGC_NOTES_DIR): no notes posted", ok(r) && r.j.total === 0, r.j);
  php.kill();

  check("API.md: admin_forum_pin, pinned, official, the notes", /admin_forum_pin/.test(fs.readFileSync(path.join(DIR, "API.md"), "utf8")) && /community\/notes/.test(fs.readFileSync(path.join(DIR, "API.md"), "utf8")));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); if (php) php.kill(); process.exit(1); });
