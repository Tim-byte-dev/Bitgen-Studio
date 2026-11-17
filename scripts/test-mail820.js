#!/usr/bin/env node
/* bitGen Studio — 2.820.0 units: ✉ Mail finished - the account kept after ✓ Test / on Close, several emails at once
 * (lib/mailBatch.js), the server search, contacts for the composer (ext/maildock/mailcontacts.js), ⤓ older, new folders. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const MB = require(path.join(ROOT, "lib", "mailBatch.js"));
const C = require(path.join(ROOT, "ext", "maildock", "mailcontacts.js"));

check("uidSet: unique positive uids (strings / a comma list too); none = refused", JSON.stringify(MB.uidSet([3, "3", 5, -1, "x"])) === "[3,5]" && JSON.stringify(MB.uidSet("7,8")) === "[7,8]" && (() => { try { MB.uidSet([]); return false; } catch (e) { return /no emails/.test(e.message); } })());
check("opFlags: seen / unseen / flag / unflag -> the IMAP flag, add or remove; move / delete have none", MB.opFlags("seen").join() === "true,\\Seen,seen,true" && MB.opFlags("unflag").join() === "false,\\Flagged,flagged,false" && MB.opFlags("move") === null && MB.OPS.length === 6);
const ix = [{ msgs: [
  { date: "2026-01-01", from: { name: "Ann", address: "ANN@x.com" }, to: [{ name: "Me", address: "me@me.com" }], cc: [{ name: "Bob", address: "bob@y.com" }] },
  { date: "2026-03-01", from: { name: "Ann Lee", address: "ann@x.com" }, to: [{ address: "me@me.com" }] },
  { date: "2026-02-01", from: { name: "", address: "noname@z.com" } }] }];
const cs = MB.contactsOf(ix, "Me@me.com");
check("contactsOf: every address once (case folded), the newest name, the most used first, me left out", cs.length === 3 && cs[0].address === "ann@x.com" && cs[0].name === "Ann Lee" && cs[0].n === 2 && !cs.some((c) => c.address === "me@me.com"), cs);
check("matchContacts: a word of the name or the address", MB.matchContacts(cs, "lee").map((c) => c.address).join() === "ann@x.com" && MB.matchContacts(cs, "bob@").length === 1 && MB.matchContacts(cs, "zz").length === 0);
check("lastToken: the address being typed after the last comma", JSON.stringify(C.lastToken("a@b.c, be", 9)) === JSON.stringify({ start: 7, text: "be" }) && C.lastToken("be").text === "be");
const put = C.putIn("a@b.c, be", 9, { name: "Bea Accountant", address: "bea@books.example" });
check("putIn: the pick replaces it as Name <address>, - the caret after it", put.value === "a@b.c, Bea Accountant <bea@books.example>, " && put.caret === put.value.length, put);
check("putIn: a contact with no name = its address; text after the caret kept", C.putIn("x, y@z.com", 1, { name: "", address: "xa@q.com" }).value === "xa@q.com, y@z.com");

const RT = read("routes", "mail.js"), AC = read("ext", "maildock", "mailaccounts.js"), DK = read("ext", "maildock", "maildock.js"), HT = read("ext", "maildock", "dock.html");
const EXT = JSON.parse(read("ext", "maildock", "ext.json")).scripts, IM = read("lib", "mailImap.js");
check("routes: batch / search / contacts / new folder on lib/mailBatch.js (server.js untouched)", /app\.post\("\/api\/mail\/:id\/batch"/.test(RT) && /app\.post\("\/api\/mail\/:id\/search"/.test(RT) && /app\.get\("\/api\/mail\/:id\/contacts"/.test(RT) && /app\.post\("\/api\/mail\/:id\/folders"/.test(RT) && !/mailBatch/.test(read("misc", "server.js")));
check("Tim's bug: a Test that logs in keeps the account; Close / Esc keep typed changes; the first one closes the dialog",
  /if \(i\.ok && \(!cur \|\| dirty\)\) \{ const ok = await save\(\);/.test(AC) && /on\("mlAClose", "click", closeDlg\)/.test(AC) && /addEventListener\("cancel", \(e\) => \{ e\.preventDefault\(\); closeDlg\(\); \}\)/.test(AC) && /if \(first\) \{ const d = \$\("mlAcctDlg"\); if \(d && d\.open\) d\.close\(\);/.test(AC));
check("the docker: picks (Ctrl / Shift / Ctrl+A / Esc), 📁 Move ▾, drag onto a folder, Enter = server search, ⤓ Older, ＋ folder",
  /S\.picks/.test(DK) && /e\.ctrlKey \|\| e\.metaKey/.test(DK) && /text\/x-bitgen-mail/.test(DK) && /serverSearch\(e\.target\.value\)/.test(DK) && /id="mlOlder"/.test(DK) && /id="mlNewFolder"/.test(DK)
  && /id="mlMove"/.test(HT) && /id="mlSearchBar"/.test(HT));
check("sync keeps the server's count (f.exists) - ⤓ Older knows how many more", /f\.exists = exists;/.test(IM) && /limit: S\.limit\[S\.folder\] \|\| 200/.test(DK));
check("ext.json: mailcontacts.js loaded last", EXT[EXT.length - 1] === "mailcontacts.js");

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
