#!/usr/bin/env node
/* bitGen Studio — 2.764.4 units: the Community's join form says why the email is confirmed and that bitGen Studio needs no
 * membership (static/community.js; the website's account.php / community.php say the same - tigerart's test-site.js).
 * Tim (verbatim): "make it so that new members have to verify their email - add a note that we do this to prevent spam emails
 * and to verify the user is a real person and say, you don't have to be a member to use or download bitgen studio - you only
 * need to be a member to talk to the community" (the code has been needed since 2.713.0). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const C = fs.readFileSync(path.join(ROOT, "static", "community.js"), "utf8"), D = fs.readFileSync(path.join(ROOT, "community", "lib", "dispatch.php"), "utf8");
check("join form: you don't have to be a member to use bitGen Studio - only to talk to the community", /id: "cmNoNeed", text: "You don't have to be a member to use bitGen Studio - you only need to be a member to talk to the community\."/.test(C));
check("…new members confirm their email (a 6-digit code) to prevent spam sign-ups and to make sure a real person is joining", /id: "cmWhyCode", text: "New members confirm their email address with a 6-digit code we send to it\. We do this to prevent spam sign-ups and to make sure a real person is joining\."/.test(C));
check("the code box says why too", /We confirm every new member's email address to prevent spam and to make sure a real person is joining\./.test(C));
check("the server still refuses everything but confirming to a member whose address is not confirmed (since 2.713.0)", /if \(\$me !== null && !\$unverifiedOk && \(int\) \(\$me\['email_verified'\] \?\? 0\) !== 1\)/.test(D) && /'verify_email' => \['act_verify_email', true, false, true\]/.test(D) && /'chat_send' => \['act_chat_send', true, false, false\]|'send' => \[/.test(D) || /'forum_new' => \['act_forum_new', 'opt', false, false\]/.test(D));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
