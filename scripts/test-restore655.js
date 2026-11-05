#!/usr/bin/env node
/* bitGen Studio — 2.655.0: 🩹 RESTORE STARTS BY ITSELF - Ctrl+click runs the restore, Shift+click the colourising restore
 * (ext/promptdock/ptrestore.js clickAction / canRun / runNote + the wiring). The clicks: scripts/test-ui655-ui.js.
 * Tim (verbatim): "can u add ctrl click starts the job automatically, a click starts the colorize job automatically" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "ext/promptdock/ptrestore.js"));
const J = fs.readFileSync(path.join(ROOT, "ext/promptdock/ptrestore.js"), "utf8"), D = fs.readFileSync(path.join(ROOT, "ext/promptdock/dock.html"), "utf8");

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check("clickAction: plain = set up only; Ctrl (or ⌘) = restore + start; Shift = colourise + start; both = colourise + start",
  eq(R.clickAction({}), { colour: false, run: false }) && eq(R.clickAction({ ctrlKey: true }), { colour: false, run: true }) && eq(R.clickAction({ metaKey: true }), { colour: false, run: true })
  && eq(R.clickAction({ shiftKey: true }), { colour: true, run: true }) && eq(R.clickAction({ ctrlKey: true, shiftKey: true }), { colour: true, run: true }));
check("canRun: only with a picture to take (the editor's layer / a References picture) and the edit tools there",
  R.canRun({ imgop: true, refs: 1 }) && R.canRun({ imgop: true, open: true }) && !R.canRun({ imgop: true, refs: 0 }) && !R.canRun({ imgop: false, refs: 2 }) && !R.canRun(null));
check("runNote: what is restored (References / the layer / the selection / layers) and that it starts; colourising says so",
  R.runNote({ refs: 1 }) === "🩹 Restoring the picture in the 🖼 References docker - starting ✏ Edit…" && /^🎨 Restoring and colourising the layer “Photo”/.test(R.runNote({ open: true, layer: "Photo" }, true))
  && /the selection on “Photo”/.test(R.runNote({ open: true, layer: "Photo", hasSel: true })) && /the 2 layers picked/.test(R.runNote({ open: true, picks: 2 })) && /the 3 pictures in/.test(R.runNote({ refs: 3 })));
check("the wiring: started after the ▾ / style settle (1.25 s), once (a newer click wins), only when Generate is free, Edit re-asserted first",
  /if \(act\.run && canRun\(st\)\)/.test(J) && /setTimeout\(\(\) => \{\s*if \(token !== run\.n\) return;/.test(J) && /if \(!go \|\| go\.disabled\)/.test(J) && /go\.click\(\);/.test(J) && /\}, 1250\);/.test(J) && /op\.get\(\) !== "edit"\) op\.set\("edit"\);\s*\} catch \(e\) \{ \/\* fine \*\/ \}\s*const go/.test(J));
check("…no picture: not started, the note says what to do", /🩹 Not started - put the photo in the 🖼 References docker/.test(J));
check("the tooltip: Ctrl+click starts it, Shift+click colourises and starts it", /Ctrl\+click: restore and start it now/.test(D) && /Shift\+click: restore \+ colourise a black-and-white photo and start it now/.test(D));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
