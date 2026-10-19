#!/usr/bin/env node
/* bitGen Studio — 2.300.0: the timeline clip START-TIME dialog's parser and
 * wiring. Run: node scripts/test-clipstart.js
 * Tim (verbatim): "if user clicks on a clip in timeline layer, allow user to
 * set start position, double click will show a start time input dialog, move
 * start of the clip on that layer to the start time".
 * The dialog itself runs on the real page in scripts/test-imagedom.js
 * (select, double-click, Enter, refusal, Escape, V1's one-after-another). */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const window = {};
new Function("window", "document", fs.readFileSync(path.join(ROOT, "static", "clipstart.js"), "utf8"))(window, {});
const P = window.ClipStart.parse;
const cases = [["12.5", 12.5], ["12.5s", 12.5], [" 7 ", 7], ["0", 0], ["1:02.5", 62.5], ["01:05", 65],
  ["1:02:03", 3723], ["300f", 12.5], ["48f", 2], ["3,25", 3.25], ["0.0417", 0.042]];
check("seconds, m:ss, h:mm:ss, frames (24 fps) and a comma decimal all read",
  cases.every(([t, v]) => P(t, 24) === v), cases.map(([t]) => [t, P(t, 24)]));
check("frames use the timeline's fps", P("50f", 25) === 2 && P("30f", 30) === 1);
const bad = ["", "-4", "abc", "1:75", "12s5", "1::2", "99999999", "NaN", "1e3"];
check("empty, negative, junk, bad m:ss and absurd times are refused (null)",
  bad.every((t) => P(t, 24) === null), bad.map((t) => [t, P(t, 24)]));
const IX = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
check("the page loads the dialog after pmedia.js",
  IX.includes('<script src="/static/pmedia.js"></script>\n<!-- 2.300.0: a timeline clip\'s start-time dialog (double-click a clip) -->\n<script src="/static/clipstart.js"></script>'));
check("a click SELECTS the clip without re-rendering (the double-click must land on the same element)",
  IX.includes('el.classList.add("sel");         // no re-render: it would eat the double-click'));
check("Move sets the clip's start on its own layer - V1 keeps one-after-another (resolveOverlaps), then save + redraw",
  /onMove: sec => \{\s*c\.start = sec;\s*if \(lk === "v1"\) resolveOverlaps\(\);[\s\S]{0,60}tlSave\(\); renderTimeline\(\);/.test(IX));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
