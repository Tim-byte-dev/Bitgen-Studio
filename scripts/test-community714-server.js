#!/usr/bin/env node
/* bitGen Studio — 2.714.0: bug reports on the Community server, over real HTTP (`php -S` on community/, SQLite):
 * bug_report from a confirmed member (live) and anonymously (waits for an admin), the screenshot (PNG / JPEG only, by
 * its bytes), the details (logs ...) for admins only, the 7 MB limit for bug_report alone, the "bugs" category (its
 * discussions come from bug_report, not forum_new), status, refuse = gone, the export rows (worst first), rate limits.
 * Tim: "can we also add the bug report discussion to the website and have the app allow the user to send the bug report
 * to the db if they are registered. if not registered bug report will be sent as anon. compile the list of bugs so i can
 * give it to you". SKIP without php. */
"use strict";
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
if (spawnSync("php", ["-v"]).status !== 0) { console.log("SKIP: no php here - the 2.714.0 bug report server test did not run"); process.exit(0); }
const DIR = path.join(__dirname, "..", "community");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bgc714-"));
const MAIL = path.join(TMP, "mail.log"), DB = path.join(TMP, "c.db");
let BASE = "", php = null;
async function call(action, body, token, raw) {
  const r = await fetch(BASE + "/api.php?a=" + action, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: raw !== undefined ? raw : JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { j = {}; }
  return { status: r.status, j };
}
const ok = (r) => r.status === 200 && r.j.ok === true;
const err = (r, s, re) => r.status === s && r.j.ok === false && (!re || re.test(r.j.error));
const codeFor = (email) => { const m = fs.readFileSync(MAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.to === email).pop(); return m.text.match(/\b(\d{6})\b/)[1]; };
const join = async (h) => { const e = h + "@example.com"; const r = await call("register", { handle: h, password: "pw-" + h + "-123", first_name: "F", last_name: "L", email: e }); await call("verify_email", { code: codeFor(e) }, r.j.token); return r.j.token; };
// the smallest real pictures
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64");
const bug = (o) => Object.assign({ title: "The timeline freezes", severity: "crash", area: "Timeline", app_version: "2.714.0", happened: "It froze when I dragged a clip.",
  expected: "The clip moves.", steps: "1. open the timeline\n2. drag a clip", details: { system: { os: "Windows 11", gpu: "RTX 4080 (16 GB)", ram_gb: 64 }, recorded: [{ t: "00:03", what: "clicked Timeline" }],
    page_errors: ["TypeError: x is undefined"], logs: { "app.txt": "line 1\nline 2\nSECRET-LOG-LINE" } }, screenshot: "data:image/png;base64," + PNG, source: "app" }, o || {});

(async () => {
  const port = await freePort();
  BASE = "http://127.0.0.1:" + port;
  php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", DIR], { stdio: "ignore", env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BGC_ADMINS: "boss", BGC_REGISTER_PER_HOUR: "100", BGC_MAIL_LOG: MAIL, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }) });
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + "/api.php?a=info"); break; } catch (e) { await sleep(100); } }
  const tim = await join("tim"), boss = await join("boss");
  let r = await call("info"); check("info: version 2.714.0 or later", /^2\.(71[4-9]|7[2-9]\d)\./.test(r.j.version), r.j);

  // ---- a member sends one ------------------------------------------------------------------------------------------------
  r = await call("bug_report", bug(), tim);
  check("a member's bug report: live at once, not anonymous", ok(r) && r.j.pending === false && r.j.anonymous === false && r.j.topic_id > 0 && r.j.bug_id > 0, r.j);
  const b1 = r.j;
  r = await call("forum_list", { category: "bugs" });
  check("it is a discussion under Bug reports, with its status (Open), severity and version", ok(r) && r.j.topics.length === 1 && r.j.topics[0].title === "The timeline freezes" && r.j.topics[0].bug.status === "open" && r.j.topics[0].bug.status_label === "Open" && /Crash/.test(r.j.topics[0].bug.severity_label) && r.j.topics[0].bug.app_version === "2.714.0", r.j.topics);
  r = await call("forum_topic", { id: b1.topic_id });
  const pub = JSON.stringify(r.j);
  check("the public sees the title, the words and the facts - not the logs, system, errors or screenshot", ok(r) && /It froze when I dragged a clip/.test(r.j.posts[0].body) && /Severity: 💥 Crash/.test(r.j.posts[0].body) && r.j.bug.has_details === true && r.j.bug.has_shot === true && !("details" in r.j.bug) && !/SECRET-LOG-LINE|RTX 4080|TypeError/.test(pub), r.j.bug);
  r = await call("forum_topic", { id: b1.topic_id }, tim);
  check("... a member (even its writer) does not either", !("details" in r.j.bug));
  r = await call("forum_topic", { id: b1.topic_id }, boss);
  check("an admin sees the details (system, steps, errors, logs)", ok(r) && r.j.bug.details && r.j.bug.details.system.gpu === "RTX 4080 (16 GB)" && r.j.bug.details.logs["app.txt"].includes("SECRET-LOG-LINE") && r.j.bug.details.page_errors[0] === "TypeError: x is undefined", r.j.bug);
  r = await call("bug_shot", { bug_id: b1.bug_id }, tim); check("bug_shot: not an admin -> 403", err(r, 403));
  r = await call("bug_shot", { bug_id: b1.bug_id }, boss);
  check("bug_shot: an admin gets the PNG back as it was sent", ok(r) && r.j.type === "png" && r.j.data === PNG, r.j);
  r = await call("forum_reply", { topic_id: b1.topic_id, body: "Same here on 2.714.0." }, boss);
  check("people reply to a bug's discussion like any other", ok(r));

  // ---- anonymous ---------------------------------------------------------------------------------------------------------
  r = await call("bug_report", bug({ title: "Anonymous crash", screenshot: "data:image/jpeg;base64," + JPG }));
  check("no token: anonymous, waits for an admin", ok(r) && r.j.pending === true && r.j.anonymous === true, r.j);
  const a1 = r.j;
  r = await call("forum_list", { category: "bugs" }); check("... not listed yet", !r.j.topics.some((t) => t.title === "Anonymous crash"));
  r = await call("admin_forum_pending", {}, boss);
  const pend = (r.j.posts || []).find((p) => p.topic_id === a1.topic_id);
  check("the admins' waiting list has it, marked as a bug report", pend && pend.category === "bugs" && pend.new_topic === true && pend.guest_name === "Anonymous", r.j.posts);
  r = await call("admin_forum_moderate", { post_id: pend.id, approve: true }, boss);
  r = await call("forum_list", { category: "bugs" });
  check("approved: listed, by Anonymous", r.j.topics.some((t) => t.title === "Anonymous crash" && t.author.guest && t.author.name === "Anonymous"), r.j.topics);
  r = await call("bug_shot", { bug_id: a1.bug_id }, boss); check("a JPEG screenshot kept as jpeg", ok(r) && r.j.type === "jpeg", r.j);
  r = await call("bug_report", bug({ title: "Spam bug", screenshot: "" }));
  const spam = r.j;
  r = await call("admin_forum_pending", {}, boss);
  r = await call("admin_forum_moderate", { post_id: (r.j.posts || []).find((p) => p.topic_id === spam.topic_id).id, approve: false }, boss);
  r = await call("bug_shot", { bug_id: spam.bug_id }, boss);
  check("refused: the anonymous bug report is gone for good (its bug too)", err(r, 404));
  r = await call("bug_report", bug({ title: "Website guest", screenshot: "", details: undefined, guest_name: "Pat", source: "web" }));
  check("a website guest can give a name", ok(r) && r.j.pending === true);
  let sentAnon = 3, last;                                     // a1, the spam one, the website guest
  while (sentAnon < 5) { last = await call("bug_report", bug({ title: "Filler " + sentAnon, screenshot: "" })); if (ok(last)) sentAnon++; else break; }
  r = await call("bug_report", bug({ title: "One too many" }));
  check("anonymous: 5 bug reports an hour from one address, then 429", sentAnon === 5 && err(r, 429, /an hour/), [sentAnon, r.j]);

  // ---- checks ------------------------------------------------------------------------------------------------------------
  r = await call("bug_report", bug({ title: "x" }), tim); check("a title under 3 characters -> 400", err(r, 400, /title/));
  r = await call("bug_report", bug({ happened: "", steps: "" }), tim); check("no words about what happened -> 400", err(r, 400, /what happened/));
  r = await call("bug_report", bug({ screenshot: "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64") }), tim);
  check("a 'screenshot' that is not a picture -> 400", err(r, 400, /PNG or JPEG/), r.j);
  r = await call("bug_report", bug({ severity: "nonsense", title: "Odd severity" }), tim);
  check("an unknown severity becomes 'broken'", ok(r) && (await call("forum_list", { category: "bugs" })).j.topics.find((t) => t.title === "Odd severity").bug.severity === "broken");
  const big = "x".repeat(200000);
  r = await call("bug_report", bug({ title: "Big logs", details: { logs: { "app.txt": big } } }), tim);
  check("a bug_report may be bigger than 16 KB (200 KB of logs)", ok(r), r.j);
  r = await call("send", { to: "help", body: "hi", pad: "x".repeat(20000) }, tim);
  check("... other actions still stop at 16 KB", err(r, 413, /16 KB/), r.j);
  r = await call("bug_report", null, tim, JSON.stringify(bug({ details: { logs: { "a.txt": "y".repeat(7400000) } } })));
  check("over 7 MB -> 413", err(r, 413, /7 MB/), r.j);
  r = await call("bug_report", bug({ details: { logs: { "a.txt": "z".repeat(2200000) } } }), tim);
  check("details over 2 MB -> 413 in words", err(r, 413, /too big/), r.j);
  r = await call("forum_new", { category: "bugs", title: "Sneaky", body: "x" }, tim);
  check("forum_new into Bug reports -> 400: a bug has its own form", err(r, 400, /own form/), r.j);
  const unconf = (await call("register", { handle: "newbie", password: "pw-newbie-123", first_name: "N", last_name: "B", email: "newbie@example.com" })).j.token;
  r = await call("bug_report", bug(), unconf);
  check("a member who has not confirmed the email: told to (need: verify) - the app sends anonymously then", err(r, 403) && r.j.need === "verify", r.j);

  // ---- status, export ----------------------------------------------------------------------------------------------------
  r = await call("admin_bug_status", { bug_id: b1.bug_id, status: "fixed" }, tim); check("status: not an admin -> 403", err(r, 403));
  r = await call("admin_bug_status", { bug_id: b1.bug_id, status: "bogus" }, boss); check("status: an unknown one -> 400", err(r, 400));
  r = await call("admin_bug_status", { bug_id: b1.bug_id, status: "working" }, boss);
  check("status: Being fixed", ok(r) && r.j.status_label === "Being fixed");
  r = await call("forum_topic", { id: b1.topic_id }); check("... shown on its discussion", r.j.bug.status === "working");
  const exp = spawnSync("php", ["-r", "define('BGC','t'); require 'lib/boot.php'; echo json_encode(array_map(fn($r) => [$r['id'], $r['severity'], $r['status'], count($r['replies']), $r['shot_type']], bug_export_rows($argv[1])));", "open"],
    { cwd: DIR, env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }), encoding: "utf8" });
  let rows = []; try { rows = JSON.parse(exp.stdout); } catch (e) { rows = exp.stdout + exp.stderr; }
  check("bug_export_rows(open): open + being fixed, the worst severity first, with the replies and the screenshot type", Array.isArray(rows) && rows.length >= 5 && rows[0][1] === "crash" && rows.some((x) => x[0] === b1.bug_id && x[2] === "working" && x[3] === 1 && x[4] === "png"), rows);
  await call("admin_bug_status", { bug_id: b1.bug_id, status: "fixed" }, boss);
  const exp2 = spawnSync("php", ["-r", "define('BGC','t'); require 'lib/boot.php'; echo json_encode([count(bug_export_rows('open')), count(bug_export_rows('all')), bug_counts()]);"],
    { cwd: DIR, env: Object.assign({}, process.env, { BGC_DSN: "sqlite:" + DB, BITGEN_PRIVATE_DIR: path.join(TMP, "none") }), encoding: "utf8" });
  let c2 = null; try { c2 = JSON.parse(exp2.stdout); } catch (e) { c2 = exp2.stdout + exp2.stderr; }
  check("a fixed bug leaves the open list but stays in 'all'; bug_counts per status", Array.isArray(c2) && c2[1] === c2[0] + 1 && c2[2].fixed === 1, c2);
  const leaver = await join("leaver");
  r = await call("bug_report", bug({ title: "Left behind" }), leaver);
  await call("delete_account", { password: "pw-leaver-123" }, leaver);
  r = await call("forum_list", { category: "bugs" });
  check("a member who leaves: their bug report stays, from (left)", r.j.topics.some((t) => t.title === "Left behind" && t.author.left), r.j.topics.map((t) => t.title));

  console.log("\n" + pass + " passed, " + fail + " failed");
  php.kill();
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); if (php) php.kill(); process.exit(1); });
