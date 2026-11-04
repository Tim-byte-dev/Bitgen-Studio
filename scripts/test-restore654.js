#!/usr/bin/env node
/* bitGen Studio — 2.654.0: 🩹 RESTORE / FIX A PHOTO in the prompt docker's left column (ext/promptdock/ptrestore.js) -
 * the instruction (once; + colourise with Shift), the note for each source, the wiring. The clicks: scripts/test-ui654-ui.js.
 * Tim (verbatim): "please a a button to the shortcut buttons on the left of the prompt docker to restore/fix photo" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = require(path.join(ROOT, "ext/promptdock/ptrestore.js"));

const a = R.withInstruction("her dress is dark green");
check("the instruction leads the prompt, the typed words after it", a.startsWith(R.BASE) && a.endsWith(" her dress is dark green"), a);
check("it says what to fix and what to keep (scratches, dust, fading, noise, blur; the people, faces, framing)",
  ["scratches", "dust", "faded", "noise", "blurry"].every((w) => R.BASE.includes(w)) && ["people", "faces", "framing", "composition"].every((w) => R.BASE.includes(w)));
check("once: again = the same prompt (any case)", R.withInstruction(a) === a && R.withInstruction(a.replace("Restore this photo", "RESTORE THIS PHOTO")) === a.replace("Restore this photo", "RESTORE THIS PHOTO"));
const c = R.withInstruction(a, true);
check("Shift: colourise added once, right after the instruction (the words kept)", (c.match(/colourise/g) || []).length === 1 && c.indexOf("colourise") < c.indexOf("her dress") && R.withInstruction(c, true) === c && c.endsWith("her dress is dark green"), c);
check("an empty prompt = the instruction (+ a space to type after)", R.withInstruction("") === R.BASE + " " && R.withInstruction(null, true) === R.BASE + R.COLOUR + " ");
check("the note: no image editor extension", /image editor extension is needed/.test(R.sourceNote({ imgop: false })));
check("the note: the editor closed, no reference = put the photo in the References docker", /put the photo in the 🖼 References docker/.test(R.sourceNote({ imgop: true, editorOn: false, refs: 0 })));
check("the note: one reference / several (keep only the photo)", /restores the picture in the 🖼 References docker\.$/.test(R.sourceNote({ imgop: true, editorOn: false, refs: 1 })) && /3 pictures .*keep only the photo/.test(R.sourceNote({ imgop: true, editorOn: false, refs: 3 })));
check("the note: the editor open - the layer / the selection / several layers", /the layer “Photo” in the image editor/.test(R.sourceNote({ imgop: true, editorOn: true, open: true, layer: "Photo" }))
  && /the selection on “Photo”/.test(R.sourceNote({ imgop: true, editorOn: true, open: true, layer: "Photo", hasSel: true })) && /2 layers picked/.test(R.sourceNote({ imgop: true, editorOn: true, open: true, picks: 2 })));
const D = read("ext/promptdock/dock.html"), EJ = JSON.parse(read("ext/promptdock/ext.json")), J = read("ext/promptdock/ptrestore.js");
check("dock.html: 🩹 #ptRestore in #ptools after 🎤, a tooltip", D.indexOf('id="ptRestore"') > D.indexOf('id="ptMusicVideo"') && D.indexOf('id="ptRestore"') < D.indexOf('<div class="pleft">') && />🩹<\/button>/.test(D) && /Shift\+click: colourise/.test(D));
check("ext.json loads ptrestore.js; the click: 🖼 Image (the page's onchange), ✏ Edit (H3ImgOp), the prompt's input event", EJ.scripts.includes("ptrestore.js") && /gm\.value = "image"; if \(typeof gm\.onchange === "function"\) gm\.onchange\(\)/.test(J) && /op\.set\("edit"\)/.test(J) && /dispatchEvent\(new Event\("input"/.test(J));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
