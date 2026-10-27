#!/usr/bin/env node
/* bitGen Studio — scripts/test-typepick606.js (2.606.0): A CLICK ON A TEXT PICKS IT + THE MOVE TOOL; a double-click
 * edits it - the wiring (ext/imageeditdock/pctools.js, pcselhl.js, pchandles.js). The browser side: test-ui602-ui.js.
 * Tim: "the click on element in this case text layer is not auto selecting the move tool". */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
try {
  const PT = rd("ext", "imageeditdock", "pctools.js"), SL = rd("ext", "imageeditdock", "pcselhl.js"), PH = rd("ext", "imageeditdock", "pchandles.js");
  check("the Type tool's click on a text (not being typed) = pickText: the text picked + the Move tool (no typing box)",
    /if \(i >= 0\) \{ pickText\(i\); return false; \}/.test(PT) && /function pickText\(i\) \{\s*E\.setActive\(i\); S\.objSel = true;\s*E\.setTool\("move"\)/.test(PT));
  check("…while typing, a click on ANOTHER text commits this one and picks that one (+ the Move tool)", /if \(j >= 0 && S\.layers\[j\] && S\.layers\[j\]\.type === "text"\) pickText\(j\);/.test(PT));
  check("a DOUBLE-click inside a text with the Move tool edits it from the click (not on one of its handles - they switch rotate / skew)",
    /E\.stage\.addEventListener\("dblclick", \(ev\) => \{\s*if \(S\.tool !== "move"/.test(PT) && /H\.hitHandle\(b, fx, fy, 7 \/ \(S\.zoom \|\| 1\)\)\) return;/.test(PT) && /editText\(S\.layers\[i\], \{ x: fx, y: fy \}\);\s*\}, true\);/.test(PT));
  check("the Layers panel: a row picked with a drawing / Type tool in hand = the Move tool", /const sw = \(AUTO_MOVE\.includes\(S\.tool\) \|\| TYPE_TOOLS\.includes\(S\.tool\)\)/.test(SL) && /if \(sw\) E\.setTool\("move"\);/.test(SL));
  check("the Move tool's options: ⤡ Scale / ↻ Rotate / skew handles button", /id="xhMode"/.test(PH) && /q\("xhMode"\)\.onclick/.test(PH));
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
