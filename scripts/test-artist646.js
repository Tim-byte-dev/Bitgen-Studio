#!/usr/bin/env node
/* bitGen Studio — 2.646.0: 🎨 ARTIST MODE - Alt+P the colour palette, Ctrl+P the prompt docker over the canvas, Alt+G the Layers
 * panel + ⏳ Pending (ext/imageeditdock/pcfocus.js, static/promptfront.js) - the wiring + the docs. The real presses:
 * scripts/test-ui646-ui.js. Tim (verbatim): "change artist mode colour pallet to alt P, and let user press ctrl P for artist
 * mode, alt G will open the layers panel and pending docker in artist mode so user can still generate an image from the layer
 * they are working on in artist mode". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };

const PF = read("ext/imageeditdock/pcfocus.js"), FR = read("static/promptfront.js");
check("keys: Alt+P = the palette (the old Ctrl+P line gone), Alt+G = the side panels",
  /e\.altKey && !c && !e\.shiftKey && \(k === "p" \|\| code === "KeyP"\)\) return "palette"/.test(PF) && /e\.altKey && !c && !e\.shiftKey && \(k === "g" \|\| code === "KeyG"\)\) return "side"/.test(PF)
  && !/c && !e\.shiftKey && !e\.altKey && \(k === "p"/.test(PF));
check("Alt+G toggles setSide; E.focus.side / setSide exposed", /else if \(a === "side"\) setSide\(!side\);/.test(PF) && /side: \(\) => side, setSide/.test(PF));
check("setSide(on): the column's hidden ancestors shown, the other groups hidden, the Layers tab picked, ⏳ Pending shown, body.ie-focus-side",
  /unhide\(col\); col\.classList\.add\("pcfocus-side"\)/.test(PF) && /g\.classList\.add\("pcfocus-sidehide"\)/.test(PF) && /button\[data-tab="pcLayers"\]/.test(PF)
  && /E\.pending\.show\(\)/.test(PF) && /doc\.body\.classList\.add\("ie-focus-side"\)/.test(PF));
check("setSide(off) puts every mark back; leaving artist mode turns it off first", /for \(const \[el, c, add\] of sideMarks\) \{ if \(add\) el\.classList\.add\(c\); else el\.classList\.remove\(c\); \}/.test(PF)
  && /function unmark\(\) \{ setSide\(false\);/.test(PF));
check("the side panel sits on the right over the canvas, ⏳ Pending beside it (not under it)", /#pcPanels\.pcfocus-side\{display:flex!important;[^}]*right:8px/.test(PF) && /#ieKx>#pcPend\{z-index:40;left:auto!important;right:318px!important/.test(PF));
check("leaving artist mode puts the panels column back as it was (a narrow dock no longer loses it)", /sideOff0 = kx0 \? kx0\.classList\.contains\("side-off"\) : null/.test(PF) && /kx\.classList\.toggle\("side-off", was\)/.test(PF));
check("the prompt docker: Ctrl+P in artist mode too - lifted over the canvas (2147483000), under its popups (2147483600)",
  /const ARTIST_Z = 2147483300;/.test(FR) && /classList\.contains\("ie-focus"\) \? ARTIST_Z : FRONT_Z/.test(FR) && /el\.style\.zIndex = String\(zNow\(\)\)/.test(FR) && !/ie-focus"\)\) return/.test(FR));
check("the hints say it: the artist-mode message, the 🎨 button's title, the palette's own hint",
  /Alt\+P colours, Ctrl\+B brushes, Alt\+G layers \+ pending, Ctrl\+P the prompt docker/.test(PF) && /Alt\+P colours · Ctrl\+B brushes · Alt\+G layers \+ pending · Ctrl\+P the prompt do/.test(PF) && /Alt\+P \/ Esc closes/.test(PF));
const SC = JSON.parse(read("docs/shortcuts.json"));
const rows = SC.groups.flatMap((g) => g.rows);
check("the shortcut list: Alt+P, Alt+G and Ctrl+B for artist mode; Ctrl+P works in artist mode too",
  rows.some(([k, v]) => k === "Alt+P" && /Artist mode/.test(v) && /colour palette/.test(v)) && rows.some(([k, v]) => k === "Alt+G" && /Layers panel/.test(v) && /Pending/.test(v))
  && rows.some(([k, v]) => k === "Ctrl+P" && /Artist mode too/.test(v)));
const U = read("docs/USAGE.md"), F = read("docs/FEATURES.md"), H = read("static/help/imageeditor.html");
check("the guide, the feature reference and the help say it", /2\.646\.0: \*\*🎨 Artist mode: Alt\+P colours, Ctrl\+P the prompt docker, Alt\+G layers \+ pending\*\*/.test(U)
  && /\*\*Generate from Artist mode\*\*[^\n]*\*Since:\* 2\.646\.0/.test(F) && /<kbd>Alt\+G<\/kbd> the Layers panel \+ ⏳ Pending/.test(H));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
