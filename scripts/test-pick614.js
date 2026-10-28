#!/usr/bin/env node
/* bitGen Studio — 2.614.0 (wiring): ▼ ranges PICKED and cut by ✂ Cut; Ctrl taps counted while it plays whatever is focused
 * (only a box you type in holds them back) and while the preview docker's player plays a clip that is on the timeline.
 * Tim: "if a range or ranges are selected and user clicks cut then cut the selected ranges ... they are only working when
 * i drag the timeline and press ctrl not while the clip is playing". */
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const S = fs.readFileSync(path.join(R, "ext", "timelinedock", "tlranges.js"), "utf8");
check("a Ctrl tap is held back only by a box you TYPE in (a list, a ticked box, the zoom slider, a button: counted); up to 1.2 s",
  /function texting\(\)/.test(S) && /a\.tagName === "INPUT" && \/\^\(text\|search\|number\|email\|url\|password\|tel\|\)\$\/i\.test/.test(S) && /if \(!ok \|\| texting\(\)/.test(S) && /performance\.now\(\) - armed < 1200/.test(S));
check("the preview docker's player playing a clip on the timeline counts as playing - its time on the timeline (start + currentTime - in), the highlighted layer's clip first",
  /function playerAt\(\)/.test(S) && /t: \(\+c\.start \|\| 0\) \+ ct - \(\+c\.in \|\| 0\)/.test(S) && /\|\| !!playerAt\(\)/.test(S));
check("picking: a click on a ▼ picks its range, Ctrl / Shift + click adds / takes out; Esc unpicks; Del removes the picked markers",
  /if \(e\.ctrlKey \|\| e\.shiftKey \|\| e\.metaKey\) \{/.test(S) && /if \(!isPicked\(r\)\) chosen = \[r\];/.test(S) && /e\.key === "Escape" && picked\(\)\.length/.test(S) && /picked\(\)\.length && !typing\(\) && overTl\(\)/.test(S));
check("✂ Cut with ranges picked cuts THEM (applySel wrapped; a ▯ frame selection keeps its own); the ▼ group's buttons say what they work on",
  /if \(op === "cut" && picked\(\)\.length && !\(T && T\.sel && T\.sel\.frame\)\) return cutAll\(picked\(\)\.slice\(\)\);/.test(S) && /"✂ Cut " \+ P\.length \+ " picked" : "✂ Cut all"/.test(S)
  && /function cutAll\(only\)/.test(S) && /function speedAll\(k, only\)/.test(S) && /w\._tljoin = f\._tljoin/.test(S));
check("server.js untouched by this release", !/tlranges/.test(fs.readFileSync(path.join(R, "misc", "server.js"), "utf8")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
