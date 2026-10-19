#!/usr/bin/env node
/* bitGen Studio — 2.431.0 units: the IMAGE EDITOR and the PROMPT DOCKER - the wiring (core's generateOne seam, mount.js's
 * mode follow + generated pictures -> the canvas). Tim: "when the editor is open the prompt docker changes to image
 * mode - all generated images are sent to the open canvas as a layer". The behaviour: scripts/test-iegen-ui.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const IX = read("static", "index.html"), M = read("ext", "imageeditdock", "mount.js");

const g1 = IX.indexOf("async function generateOne("), g2 = IX.indexOf("\n}", g1), GEN = IX.slice(g1, g2);
check("core's generateOne waits for the render, then offers it: window.H3OnGenerated({mode, text, job}) when it is done (a seam - no editor = undefined)",
  /const st = await awaitJob\(id\);/.test(GEN) && /if \(st === "done" && typeof window\.H3OnGenerated === "function"\) \{ try \{ window\.H3OnGenerated\(\{ mode: gm, text, job: id \}\); \}/.test(GEN) && /return st;/.test(GEN));
check("...a failing taker never fails the queue (try / catch)", /catch \(e\) \{ console\.warn\("\[generated\]", e\); \}/.test(GEN));
check("mount.js: the editor on screen = shown and not collapsed", /function ieOnScreen\(\) \{ const d = \$\("imageeditdock"\); return !!d && !d\.classList\.contains\("dockgone"\) && !d\.classList\.contains\("collapsed"\); \}/.test(M));
check("...only a change counts (opened / closed by hand - not the state the page boots in, nor the saved layout landing): /if \(open !== ieWasOpen\)/ + the boot window",
  /if \(open !== ieWasOpen\) \{/.test(M) && /function ieBooting\(\)/.test(M) && /return Date\.now\(\) - ieBootT < 1500;/.test(M));
check("...opened: the mode it was in is kept (h3.ie.modeWas, '' = it was Image already) and Image is picked through the select's own onchange",
  /iePref\.set\("ie\.modeWas", sel\.value === "image" \? "" : sel\.value\);/.test(M) && /if \(sel\.value !== "image"\) \{ sel\.value = "image"; if \(sel\.onchange\) sel\.onchange\(\); \}/.test(M));
check("...closed: back to it only when it is still on Image (a mode picked meanwhile stays)", /if \(was && sel\.value === "image" && \[\.\.\.sel\.options\]\.some\(\(o\) => o\.value === was\)\)/.test(M));
check("...watched by a MutationObserver on the editor docker's class (debounced), started from mountImageEditor", /new MutationObserver\(\(\) => \{ clearTimeout\(ieModeT\); ieModeT = setTimeout\(ieFollowMode, 60\); \}\)\.observe\(d, \{ attributes: true, attributeFilter: \["class"\] \}\)/.test(M) && /ieWatchMode\(\);\s+\/\/ 2\.431\.0\n\s+if \(imageEditor \|\| !window\.ImageEdit/.test(M));
check("H3OnGenerated: only while the editor is on screen; the job's pictures (png / jpg / webp / bmp / jxl - 2.479.0) - a layer each named '✨ <prompt>' on the document in front, else opened as one",
  /if \(!info \|\| !ieOnScreen\(\)\) return 0;/.test(M) && /const IE_PICS = \/\\\.\(png\|jpe\?g\|webp\|bmp\|jxl\)\$\/i;/.test(M) && /const label = "✨ " \+ base/.test(M) && /if \(E\.S\.w\) E\.addImageLayer\(img, label\); else E\.openImage\(img, name\);/.test(M));
check("the project keeps the mode the user picked (window.ieModeKept), not the editor's Image; a reload with the editor still open (this browser switched it) = Image again",
  /chat: \{ mode: \(typeof window\.ieModeKept === "function" && window\.ieModeKept\(\)\) \|\| fieldVal\("genModeSel"\) \}/.test(IX) && /window\.ieModeKept = function \(\)/.test(M) && /if \(open && was0 !== null && sel\.value !== "image"\)/.test(M));
check("the chip beside the mode: → ▦ canvas", /c\.textContent = "→ ▦ canvas";/.test(M));
check("server.js untouched", !/H3OnGenerated|ieFollowMode/.test(read("server.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
