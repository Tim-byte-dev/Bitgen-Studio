#!/usr/bin/env node
/* bitGen Studio — 2.677.0: THE RESTYLE'S PROGRESS BAR UNDER THE PICTURE (static/lbrestyle.js barState). The clicks:
 * scripts/test-ui677-ui.js.
 * Tim (verbatim): "show the progress of the generation with a small bar below the picture" */
"use strict";
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const R = require(path.join(__dirname, "..", "static", "lbrestyle.js"));
const s = (j) => R.barState(j, "🧸 Pixar");
check("queued: a moving stripe (no number yet), \"🧸 Pixar · queued\"", JSON.stringify(s({ status: "queued" })) === JSON.stringify({ pct: null, text: "🧸 Pixar · queued", kind: "wait" }) && s(null).kind === "wait");
check("running before the sampler counts: the stripe, \"loading the models\"", s({ status: "running" }).pct === null && /loading the models$/.test(s({ status: "running", progress: { step: 0, total: 0 } }).text));
check("the sampler's steps: the bar fills - step 12 of 25 = 48 %", JSON.stringify(s({ status: "running", progress: { step: 12, total: 25 } })) === JSON.stringify({ pct: 48, text: "🧸 Pixar · step 12 of 25 · 48 %", kind: "run" }));
check("…a step past the total held at 100 %; a pct-only progress used", s({ status: "running", progress: { step: 30, total: 25 } }).pct === 100 && s({ status: "running", progress: { pct: 37 } }).pct === 37);
check("done = full (green), failed / cancelled = said (red)", s({ status: "done" }).kind === "done" && s({ status: "done" }).pct === 100 && s({ status: "failed" }).kind === "fail" && /failed - see the job log/.test(s({ status: "failed" }).text) && /cancelled/.test(s({ status: "cancelled" }).text));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
