#!/usr/bin/env node
/* bitGen Studio — 2.809.0 pins: the image editor's right-click menu has Copy, Paste and 🎨 Artist Mode; in artist mode it has
 * Show Layers + ⏳ Pending, 🟧 Blender Scene, ✨ Prompt and Exit Artist Mode instead.
 * Tim (verbatim): "in image editor right click context menu add copy, paste, artist mode, when in artist mode add show layers,
 * blender scene,prompt, exit artist mode." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n); } };
const src = (f) => fs.readFileSync(path.join(ROOT, "ext/imageeditdock", f), "utf8");
const FR = src("pcframes.js"), FO = src("pcfocus.js");
check("pcframes: Copy and Paste after the clicked thing's own items, before Duplicate / Delete",
  /items\.push\(sep, "edit\.copy", "edit\.paste", sep, "layer\.dup", "layer\.del"\);/.test(FR));
check("pcframes: the artist-mode items come last, from E.focusMenu (🎨 Artist Mode when it is off)",
  /const fm = E\.focusMenu \? E\.focusMenu\(\) : \["view\.focus"\];/.test(FR) && /if \(fm\.length\) items\.push\(sep, \.\.\.fm\);/.test(FR));
check("pcfocus: the four artist-mode commands", ["focus.layers", "focus.blender", "focus.prompt", "focus.exit"].every((c) => FO.includes('addCmd("' + c + '"')));
check("pcfocus: E.focusMenu gives the four in artist mode, view.focus otherwise",
  /E\.focusMenu = \(\) => \(on \? \["focus\.layers", "focus\.blender", "focus\.prompt", "focus\.exit"\] : \["view\.focus"\]\);/.test(FO));
check("pcfocus: Show Layers ticks with the side panel; Blender opens / closes E.blendLayer; Prompt brings the prompt docker forward; Exit leaves",
  /checked: \(\) => side/.test(FO) && /B\.isOpen\(\)\) B\.leave\(\); else B\.start\(\)/.test(FO) && /H3PromptFront\.front\(\)/.test(FO) && /"focus\.exit", "Exit (Artist Mode|Full Screen)", "", \(\) => setFocus\(false\)/.test(FO));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
