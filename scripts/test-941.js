#!/usr/bin/env node
/* bitGen Studio — 2.941.0 units: 🔒 Settings ▸ Security - an optional email, kept on this PC, and 💬 Join the community
 * (the Community panel's join form filled from here; nothing goes online until Join is pressed there).
 * Tim: "maybe add email (optional) to security and a join community button?" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const S = require("../lib/security.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-sec941-"));
S.useDir(tmp);
check("no email to start with; the page sees an email field", S.pub().email === "");
check("optional: empty is fine and kept empty", S.save({ email: "" }).email === "");
const a = S.save({ email: "  tim@example.com " });
check("an email is kept (trimmed) in settings/security.json on this PC", a.email === "tim@example.com" && JSON.parse(fs.readFileSync(S.file(), "utf8")).email === "tim@example.com");
let err = ""; try { S.save({ email: "not an email", name: "Changed" }); } catch (e) { err = e.message; }
check("a wrong one is refused (and nothing else in that save is kept)", /doesn't look right/.test(err) && S.pub().email === "tim@example.com" && S.pub().name !== "Changed");
check("...cleared with an empty one", S.save({ email: "" }).email === "");
fs.rmSync(tmp, { recursive: true, force: true }); S.useDir(null);
const P = require("../static/securitytab.js");
check("the join form gets a user ID the community accepts, the name and the email (never the password)",
  JSON.stringify(P.joinFill({ user: "Tim Paul", name: "Tim", email: "t@x.au", hasPassword: true })) === JSON.stringify({ handle: "Tim_Paul", display: "Tim", email: "t@x.au" })
  && P.joinFill({ user: "ab" }).handle === "" && P.joinFill({ user: "x".repeat(40) }).handle.length === 24 && P.joinFill({ user: "é!tim" }).handle === "tim");
const H = src("static/index.html"), J = src("static/securitytab.js"), C = src("static/community.js");
check("Settings ▸ Security: Email (optional) and 💬 Join the community, with a note (not help text) on what goes online and when",
  /id="sec_email"/.test(H) && /type="email"/.test(H) && /id="sec_join"/.test(H) && /<p class="hint" id="sec_joinnote"/.test(H) && /go online only if you press\s+<b>Join<\/b> there/.test(H)
  && /password, name and email stay on this computer/.test(H));
check("Join: saves what's typed first, closes Settings, opens 💬 Community, fills the form (not when already a member)",
  /\? save\(\) : Promise\.resolve\(cur\)/.test(J) && /dlg\.close\(\)/.test(J) && /C\.toggle\(true\)/.test(J) && /if \(!st\.joined && C\.prefill\) C\.prefill\(joinFill\(cur\)\)/.test(J));
check("💬 Community: prefill() fills user ID, display name, email - kept until joined; the password is left for you",
  /function prefill\(p\)/.test(C) && /\["cmHandle", P\.handle\], \["cmDisplay", P\.display\], \["cmEmail", P\.email\]/.test(C) && /S\.prefill = null;\n\s*\$\("cmPass"\)\.value = ""/.test(C) && !/cmPass", P\./.test(C));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
