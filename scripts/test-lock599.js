#!/usr/bin/env node
/* bitGen Studio — scripts/test-lock599.js (2.599.0): the "Resetting Project..." LOCK SCREEN (static/locklayer.js) - its pure
 * parts and its wiring. Tim: "when resetting a project put a lock screen at the front and say "Resetting Project..." but
 * animate it until the project resets". The real run: scripts/test-ui599-ui.js. No server. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const L = require("../static/locklayer.js");
check("dots: . .. ... and round again", [0, 1, 2, 3, 4].map(L.dots).join("|") === ".|..|...|.|..");
check("secs: nothing under 2 s, then seconds, then minutes", L.secs(500) === "" && L.secs(12500) === "12 s" && L.secs(125000) === "2 min 5 s");
const H = rd("static", "index.html"), J = rd("static", "locklayer.js"), R = rd("static", "recyclebin.js");
check("loaded at the TOP of <body> (a reload under way is covered before anything paints)", /<body>\n<script src="\/static\/locklayer\.js"><\/script>/.test(H));
check("the cover: on top of everything, a spinning ring, running dots, a bar, the seconds; clicks + keys stop at it; aria-busy",
  /z-index:2147483646/.test(J) && /@keyframes h3lockspin/.test(J) && /h3lockbar/.test(J) && /addEventListener\("keydown", keyBlock, true\)/.test(J) && /"aria-busy", "true"/.test(J) && /prefers-reduced-motion/.test(J));
check("the reset: the cover at once (\"Resetting Project...\"), each step said, carried over the reload, down on an error",
  /L\.show\("Resetting Project\.\.\."/.test(R) && /L\.step\("Deleting/.test(R) && /L\.carry\("Resetting Project\.\.\.", \{ sub2: /.test(R) && (R.match(/if \(L\) L\.hide\(\);/g) || []).length === 2);
check("the next page: the same cover until window.H3_PROJECT_READY (600 ms at least, 90 s at most), then ✓ the done words",
  /root\.H3_PROJECT_READY === true/.test(J) && /Date\.now\(\) - start > 600/.test(J) && /> 90000/.test(J) && /hide\(c\.done \|\| "Done"\)/.test(J));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
