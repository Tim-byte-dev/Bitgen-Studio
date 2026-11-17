#!/usr/bin/env node
/* bitGen Studio — 2.818.0: ✉ MAIL - the pure parts and the pins (no mail server: scripts/test-mail818-live.js has one).
 * lib/mailStore.js (presets, the account shape, never the password to the page, the index merge), lib/secrets.js (the
 * password encrypted like an API key), lib/mailImap.js (folder roles, safe HTML), lib/mailSend.js (addresses, Re: / Fwd:,
 * the quote, the raw message - Bcc not in it), lib/mailAi.js (the prompts and reading the LLM's answers),
 * ext/maildock/mailview.js (the list's order + filter, the frame document, reply targets, text from HTML), the wiring.
 * Tim (verbatim): "I would like a mail docker that resembles outlook but works with ai, our models should be able to read
 * the emails and flag important ones and draft a reply. it should also help us construct an email." */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const WS = fs.mkdtempSync(path.join(os.tmpdir(), "mail818-"));
let CFG = {};
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); }, BASE: WS };
require.cache[coreP] = fake;
const MS = require("../lib/mailStore"), IM = require("../lib/mailImap"), SEND = require("../lib/mailSend"), AI = require("../lib/mailAi"), SEC = require("../lib/secrets");
const V = require("../ext/maildock/mailview.js");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  // ---- accounts
  const g = MS.presetFor("Someone@GMail.com"), o = MS.presetFor("a@hotmail.co.uk"), x = MS.presetFor("me@tigerart.com.au");
  check("presets: Gmail (993 / 465 SSL, app password, files sent mail itself), Outlook.com (587 STARTTLS), others guessed imap./smtp.<domain>",
    g.imap.host === "imap.gmail.com" && g.smtp.port === 465 && g.app && g.sent_auto && o.smtp.host === "smtp-mail.outlook.com" && o.smtp.port === 587 && o.smtp.secure === false
    && !x.known && x.imap.host === "imap.tigerart.com.au" && x.smtp.host === "smtp.tigerart.com.au", { g, o, x });
  let e = null; try { MS.cleanAccount({ email: "nope" }); } catch (er) { e = er; }
  check("a bad address is refused in words", e && e.status === 400 && /email address/.test(e.message));
  const ca = MS.cleanAccount({ email: "tim@gmail.com", name: "  Tim\u0007 Paul ", imap: { host: "imap.gmail.com<script>", port: "abc", secure: "true" } });
  check("cleanAccount: the user defaults to the address, the host cleaned, a bad port -> the SSL default, Gmail = no copy to Sent", ca.user === "tim@gmail.com" && ca.name === "Tim Paul" && ca.imap.host === "imap.gmail.comscript" && ca.imap.port === 993 && ca.save_sent === false && ca.tls_check === true, ca);
  const a = MS.add({ email: "tim@example.com", name: "Tim Paul", pass: "s3cret", imap: { host: "mail.example.com", port: 993, secure: true }, smtp: { host: "mail.example.com", port: 587, secure: false } });
  check("add(): an id of the secrets' shape, the page's view has no password (has_pass)", /^[a-z0-9]{4,20}$/.test(a.id) && a.has_pass && !("pass" in a) && !JSON.stringify(MS.list()).includes("s3cret"), a);
  check("the password sits at mail.accounts.<id>.pass - a key path lib/secrets.js encrypts into settings/keys.json and strips from custom.settings",
    SEC.isKeyPath(`mail.accounts.${a.id}.pass`) && SEC.pick(CFG)[`mail.accounts.${a.id}.pass`] === "s3cret" && !JSON.stringify(SEC.strip(CFG)).includes("s3cret"));
  check("hidePasswords(): GET /api/config's copy has none (and the real config keeps it)", !JSON.stringify(MS.hidePasswords(CFG)).includes("s3cret") && CFG.mail.accounts[a.id].pass === "s3cret");
  const u = MS.update(a.id, { email: "tim@example.com", name: "T. Paul", pass: "" });
  check("update() with an empty password keeps the old one", u.name === "T. Paul" && CFG.mail.accounts[a.id].pass === "s3cret");
  const back = SEC.put({ mail: { accounts: {} } }, { [`mail.accounts.${a.id}.pass`]: "s3cret" });
  check("a removed account's password is not put back by the key store", !back.mail.accounts[a.id]);
  check("settings: what matters + auto flag + minutes (1-120)", JSON.stringify(MS.setSettings({ important: "my accountant", auto_flag: 1, check_min: 999 })) === JSON.stringify({ important: "my accountant", auto_flag: true, check_min: 120 }));
  check("folderKey: safe + distinct ('A/B' vs 'A_B')", /^[A-Za-z0-9._-]+$/.test(MS.folderKey("[Gmail]/Sent Mail")) && MS.folderKey("A/B") !== MS.folderKey("A_B"));
  let bad = null; try { MS.dirOf("../x"); } catch (er) { bad = er; }
  check("an account id cannot reach outside mail/", bad && /bad account id/.test(bad.message));
  const ix = MS.mergeIndex({ uidValidity: "7", msgs: [{ uid: 5, ai: { level: 3 }, snippet: "hi" }] }, [{ uid: 5, date: "2026-11-01T00:00:00Z" }, { uid: 9, date: "2026-11-02T00:00:00Z" }], "7");
  check("mergeIndex keeps the AI flag + snippet, newest first", ix.msgs[0].uid === 9 && ix.msgs[1].ai.level === 3 && ix.msgs[1].snippet === "hi" && !ix.reset, ix);
  check("… a new UIDVALIDITY drops what bitGen knew (the uids mean other emails now)", MS.mergeIndex({ uidValidity: "7", msgs: [{ uid: 5, ai: { level: 3 } }] }, [{ uid: 5 }], "8").msgs[0].ai === undefined);
  MS.remove(a.id);
  check("remove(): the account and its key path gone", !CFG.mail.accounts[a.id] && !SEC.pathsOf(CFG).some((p) => p.includes(a.id)));

  // ---- imap helpers
  check("folder roles: INBOX, special use, then names (Sent Items, Deleted Items, Spam)", IM.specialOf({ path: "INBOX" }) === "inbox" && IM.specialOf({ path: "x", specialUse: "\\Sent" }) === "sent"
    && IM.specialOf({ path: "Sent Items" }) === "sent" && IM.specialOf({ path: "Deleted Items" }) === "trash" && IM.specialOf({ path: "INBOX.Spam", name: "Spam" }) === "junk" && IM.specialOf({ path: "Work" }) === "");
  check("pickFolder prefers the server's special-use flag over a name", IM.pickFolder([{ path: "Sent", special: "sent" }, { path: "[Gmail]/Sent Mail", special: "sent", use: true }], "sent") === "[Gmail]/Sent Mail");
  const sh = IM.safeHtml(`<div onclick="x()" style="color:red">Hi<script>alert(1)</script><iframe src="//evil"></iframe><form action="/steal"><input name=a></form><a href=" javascript:alert(2)">l</a><img src="cid:logo@x"><object data=x>o</object><base href="http://evil/"><meta http-equiv="refresh" content="0;url=http://evil"></div>`, { "logo@x": "data:image/png;base64,QUJD" });
  check("safeHtml: no script / iframe / object / form / base / meta / event attributes / javascript: links; cid: pictures inline",
    !/<script|<iframe|<object|<form|<base|<meta|onclick|javascript:/i.test(sh) && /src="data:image\/png;base64,QUJD"/.test(sh) && /style="color:red"/.test(sh) && /<input/.test(sh), sh);

  // ---- sending helpers
  check("addrList: commas / semicolons / names", JSON.stringify(SEND.addrList("Ann <ann@x.com>; bob@y.org,\n")) === JSON.stringify(["Ann <ann@x.com>", "bob@y.org"]));
  let ae = null; try { SEND.addrList("ann@x.com, nobody"); } catch (er) { ae = er; }
  check("… a bad one refused by name", ae && /"nobody" is not an email address/.test(ae.message));
  check("Re: / Fwd: once (Re: Re: AW: -> Re:)", SEND.replySubject("Re: RE: AW: Hello", "reply") === "Re: Hello" && SEND.replySubject("Fwd: Re: Hi", "forward") === "Fwd: Hi");
  check("the quote: '> ' lines under 'On … wrote:'; a forward's header block", /wrote:\n> line one\n> line two$/.test(SEND.quoteOf({ from: { name: "Bea", address: "b@x" }, date: "2026-11-17T00:00:00Z", text: "line one\nline two" }, "reply"))
    && /Forwarded message ----------\nFrom: b@x/.test(SEND.quoteOf({ from: { address: "b@x" }, subject: "S", text: "t" }, "forward")));
  const acc = { id: "unit1", email: "tim@example.com", name: "Tim Paul" };
  const c = await SEND.compose(acc, { to: "ann@x.com", cc: "bea@y.org", bcc: "boss@z.net", subject: "Hello", text: "Hi", html: "<p>Hi</p>", attachments: [{ name: "a.txt", type: "text/plain", data: Buffer.from("A!").toString("base64") }], inReplyTo: "<m1@x>", references: ["<m0@x>", "<m1@x>"] });
  const raw = c.raw.toString();
  check("compose(): From with the name, To + Cc in the message, Bcc only on the envelope, threading headers, the attachment",
    /^From: Tim Paul <tim@example\.com>/m.test(raw) && /^To: ann@x\.com/m.test(raw) && /^Cc: bea@y\.org/m.test(raw) && !/boss@z\.net/.test(raw) && c.envelope.to.join() === "ann@x.com,bea@y.org,boss@z.net"
    && /^In-Reply-To: <m1@x>/m.test(raw) && /^References: <m0@x> <m1@x>/m.test(raw) && /filename=a\.txt/.test(raw) && /^X-Mailer: bitGen Studio/m.test(raw), raw.slice(0, 600));
  let ne = null; try { await SEND.compose(acc, { subject: "x" }); } catch (er) { ne = er; }
  check("no recipient = refused (a draft is allowed)", ne && /who it goes to/.test(ne.message) && (await SEND.compose(acc, { draft: true, subject: "d" })).raw.length > 0);
  let big = null; try { await SEND.compose(acc, { to: "a@b.co", attachments: [{ name: "big", data: Buffer.alloc(26 * 1024 * 1024).toString("base64") }] }); } catch (er) { big = er; }
  check("over 25 MB of attachments refused before sending", big && /25 MB/.test(big.message));
  // a forward takes the original's kept attachments
  MS.setBody("unit1", "INBOX", 4, { uid: 4, attachments: [{ i: 0, name: "orig.pdf", type: "application/pdf" }] });
  fs.mkdirSync(MS.attDir("unit1", "INBOX", 4), { recursive: true }); fs.writeFileSync(path.join(MS.attDir("unit1", "INBOX", 4), "0"), "%PDF-1.4 x");
  const fw = (await SEND.compose(acc, { to: "a@b.co", subject: "Fwd: x", text: "see below", forwardOf: { folder: "INBOX", uid: 4 } })).raw.toString();
  check("a forward carries the original's attachments", /filename=orig\.pdf/.test(fw));

  // ---- the AI's prompts and answers
  const fp = AI.flagPrompt(["From: a\nSubject: s1\n\nt1", "From: b\nSubject: s2\n\nt2"], "my accountant", "Tim Paul (tim@x)");
  check("flagPrompt: the four levels, the user's own words, who they are, one line per email asked", /3 = urgent/.test(fp[0].content) && /0 = low/.test(fp[0].content) && /my accountant/.test(fp[0].content) && /Tim Paul/.test(fp[0].content)
    && /=== Email 2 ===/.test(fp[1].content) && /Rate all 2 emails/.test(fp[1].content));
  const pf = AI.parseFlags("Sure!\n**1 | 3 | invoice due Friday**\nEmail 2: 0 - newsletter\n3 | 9 | bogus\n#4) 2 | a person writing\n1 | 1 | repeat ignored", 4);
  check("parseFlags reads the shapes models write (bold, 'Email n:', '#n)'), ignores bad levels and repeats", JSON.stringify(pf.map((x) => [x.n, x.level])) === JSON.stringify([[1, 3], [2, 0], [4, 2]]) && pf[0].why === "invoice due Friday", pf);
  check("parseSummary: the summary and the action ('none' = none)", JSON.stringify(AI.parseSummary("Summary: Bea needs receipts.\n**Action:** send them")) === JSON.stringify({ summary: "Bea needs receipts.", action: "send them" }) && AI.parseSummary("FYI only.\nAction: none").action === "");
  check("parseWrite: 'Subject:' line -> the subject, the rest the body", JSON.stringify(AI.parseWrite("Subject: Lunch?\n\nHi Ann,\nLunch?\n\nTim")) === JSON.stringify({ subject: "Lunch?", body: "Hi Ann,\nLunch?\n\nTim" }));
  check("cleanBody: no 'Here is…' opener, no code fence, no Subject line, no wrapping quotes", AI.cleanBody("Here is the reply:\n```\nSubject: x\n\nHi\n```") === "Hi" && AI.cleanBody('"Hi there"') === "Hi there");
  check("plainOf: the HTML's words when there is no text; the quoted history cut", AI.plainOf({ html: "<style>p{}</style><p>Hello&nbsp;<b>you</b></p><div>bye</div>" }) === "Hello you\nbye"
    && AI.plainOf({ text: "Yes, Thursday works.\n\nOn Mon, 16 Nov 2026 at 09:00, Bea <b@x> wrote:\n> old\n> older" }) === "Yes, Thursday works.");
  const exc = AI.excerpt({ from: { name: "Bea", address: "b@x" }, subject: "S" }, { text: "x".repeat(50), attachments: [{ name: "r.csv" }] }, 20);
  check("excerpt: header lines + attachments + the text cut", /^From: Bea <b@x>\nSubject: S/.test(exc) && /Attachments: r\.csv/.test(exc) && /x{20} …$/.test(exc), exc);
  AI.setComplete(async (o2) => ({ ok: true, text: "<think>plan</think>Subject: Hi\n\nHello Ann" }));
  const w = await AI.write({ notes: "say hi", tone: "warm", name: "Tim Paul" });
  check("write(): thinking stripped, subject + body", w.subject === "Hi" && w.body === "Hello Ann", w);
  let wn = null; try { await AI.write({ notes: " " }); } catch (er) { wn = er; }
  check("write() with no notes says so", wn && /say what the email is about/.test(wn.message));

  // ---- the page's pure parts
  const msgs = [{ uid: 1, date: "2026-11-10T00:00:00Z", seen: true, from: { name: "Shop" }, subject: "Sale", ai: { level: 0 } },
    { uid: 2, date: "2026-11-12T00:00:00Z", seen: false, from: { name: "Bea", address: "bea@books" }, subject: "BAS due", ai: { level: 3, why: "deadline" }, flagged: true },
    { uid: 3, date: "2026-11-15T00:00:00Z", seen: false, from: { name: "Ann" }, subject: "Lunch", snippet: "friday?" }];
  check("sortMsgs: newest first / ✨ most important first (unrated after rated)", V.sortMsgs(msgs, "date").map((m) => m.uid).join() === "3,2,1" && V.sortMsgs(msgs, "ai").map((m) => m.uid).join() === "2,1,3");
  check("filterMsgs: unread, ⚑ important (2+), ★ flagged, words (sender, snippet, the AI's reason)", V.filterMsgs(msgs, "unread").length === 2 && V.filterMsgs(msgs, "important").map((m) => m.uid).join() === "2"
    && V.filterMsgs(msgs, "starred").length === 1 && V.filterMsgs(msgs, "all", "bea deadline").length === 1 && V.filterMsgs(msgs, "all", "friday").map((m) => m.uid).join() === "3");
  check("flagOf: level -> class + tip with the reason; none when not rated", V.flagOf(msgs[1]).cls === "mllv3" && /urgent - needs you soon - deadline/.test(V.flagOf(msgs[1]).tip) && V.flagOf(msgs[2]) === null);
  const fd = V.frameDoc("<p>x</p>", false), fd2 = V.frameDoc("<p>x</p>", true);
  check("frameDoc: a content policy with no scripts, internet pictures only when asked, links to the browser", /default-src 'none'; img-src data: cid:;/.test(fd) && !/script-src/.test(fd) && /img-src data: cid: https: http:/.test(fd2) && /<base target="_blank">/.test(fd));
  check("hasRemote: an internet picture or style", V.hasRemote('<img src="https://t.co/p.gif">') && V.hasRemote("<div style=\"background:url('http://x/y.png')\">") && !V.hasRemote('<img src="data:image/png;base64,AA">'));
  const rt = V.replyTargets({ from: { name: "Bea", address: "bea@x.com" }, replyTo: [{ address: "help@x.com" }], to: [{ address: "Tim@E.com" }, { name: "Ann", address: "ann@y.com" }], cc: [{ address: "bea@x.com" }, { address: "c@z.com" }] }, "tim@e.com", true);
  check("replyTargets: Reply-To wins, Reply all puts the others in Cc, never yourself, no repeats", rt.to === "help@x.com" && rt.cc === "Ann <ann@y.com>, bea@x.com, c@z.com", rt);
  check("… replying to your own sent email goes to its recipients", V.replyTargets({ from: { address: "tim@e.com" }, to: [{ address: "ann@y.com" }] }, "tim@e.com", false).to === "ann@y.com");
  check("textOf / htmlOfText: the composer's HTML <-> text (lists, links, paragraphs)", V.textOf('<div>Hi <b>Ann</b></div><div><br></div><ul><li>one</li><li>two</li></ul><a href="https://x.y">site</a>') === "Hi Ann\n\n• one\n• two\n\nsite (https://x.y)"
    && V.htmlOfText("Hi <Ann>,\n\nline1\nline2") === "<div>Hi &lt;Ann&gt;,</div><div><br></div><div>line1<br>line2</div>");
  check("linkify escapes first, then links", V.linkify("<b> https://a.b/c?d=1.") === '&lt;b&gt; <a href="https://a.b/c?d=1" target="_blank" rel="noopener noreferrer">https://a.b/c?d=1</a>.');

  // ---- wiring pins
  const ix2 = read("routes/index.js"), ext = JSON.parse(read("ext/maildock/ext.json")), dock = read("ext/maildock/dock.html");
  check("routes/mail.js mounted from routes/index.js (never server.js); GET /api/config hides the passwords", /require\("\.\/mail"\)\.mount\(app\)/.test(ix2) && !/mail/.test(read("misc/server.js")) && /hidePasswords\(core\.getConfig\(\)\)/.test(ix2));
  check("POST /api/config cannot write mail (its allow-list has no 'mail')", !/"mail"/.test(ix2.slice(ix2.indexOf('app.post("/api/config"'), ix2.indexOf('app.post("/api/config"') + 1500)));
  check("ext/maildock: Mail, its four scripts (the pure view first), a .bdock #maildock + the two dialogs outside it", ext.id === "maildock" && ext.scripts[0] === "mailview.js" && ext.scripts.length === 4
    && /<div class="bdock" id="maildock"/.test(dock) && dock.indexOf('<dialog id="mlCompose"') > dock.lastIndexOf("</div>\n    <dialog") - 1);
  check("the reading frame is sandboxed without scripts or same-origin", /sandbox="allow-popups allow-popups-to-escape-sandbox"/.test(read("ext/maildock/maildock.js")) && !/allow-scripts|allow-same-origin/.test(read("ext/maildock/maildock.js")));
  check("the app strip already has ✉ in group 1 (2.817.0) - the docker's button tX_maildock lands there", /\["tX_maildock", "✉", "Mail"\]/.test(read("static/appstrip.js")));
  check("mail/ is this machine's: .gitignore + make_zips agree", /^mail\/$/m.test(read(".gitignore")) && /! -path "\.\/mail\/\*"/.test(read("scripts/make_zips.sh")));
  const pkg = JSON.parse(read("package.json"));
  check("imapflow (MIT), nodemailer (MIT-0), mailparser (MIT) are dependencies; the stand-in server only a devDependency", pkg.dependencies.imapflow && pkg.dependencies.nodemailer && pkg.dependencies.mailparser && pkg.devDependencies["hoodiecrow-imap"] && !pkg.dependencies["hoodiecrow-imap"]);
  check("credited (About + NOTICE)", /imapflow/.test(read("lib/credits.json")) && /nodemailer/.test(read("lib/credits.json")) && /mailparser/.test(read("lib/credits.json")) && /imapflow/.test(read("misc/NOTICE.md")) && /MIT-0/.test(read("misc/NOTICE.md")));
  check("the help page", /✉ Mail/.test(read("static/help/mail.html")) && /app password/.test(read("static/help/mail.html")));

  fs.rmSync(WS, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: exception " + (e.stack || e)); process.exit(1); });
