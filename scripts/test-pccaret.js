#!/usr/bin/env node
/* bitGen Studio — scripts/test-pccaret.js (2.602.0): the image editor's Type tool - WHERE A CLICK PUTS THE CARET, the
 * text box MEASURED IN THE TEXT'S FONT, the frame that hugs the letters, the edit-text cursor.
 * Tim: "in image-editor text tool make the select tool fit the text that is typed dynamically. change the cursor to a
 * edit text cursor when hover over text, on click edit text from the position of the click".
 *   ext/imageeditdock/pccaret.js   nearest, plainIndex (lines, alignment), layoutIndex (wrapped lines), unturn (t.rot)
 *   pcdoc.textBox0                 measures with fontCss(t) + tracking (a context left at "10px sans-serif" made every
 *                                  box far too narrow) and leaves the context as it was
 *   wiring                         ext.json loads pccaret.js before pctools.js; pctools: editText(L, {x, y}), the click
 *                                  inside the typing box stays there, the frame hugs the text, the hover cursor; the
 *                                  textarea's own look can no longer be overridden by .kx textarea */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
try {
  const C = require("../ext/imageeditdock/pccaret.js");
  const mono = (s) => Array.from(s).length * 10;                 // every letter 10 px
  check("nearest: the prefix edge closest to x", C.nearest([0, 10, 20, 30], 14) === 1 && C.nearest([0, 10, 20, 30], 16) === 2 && C.nearest([0, 10, 20], -5) === 0 && C.nearest([0, 10, 20], 99) === 2);
  const t = { str: "Hello\nWorld", x: 100, y: 50, size: 20, leading: 1.5, align: "left" };
  check("plainIndex: the first line - a click at 3.4 letters = after the 3rd", C.plainIndex(t, 134, 55, mono) === 3);
  check("…the second line (y past one line height) - after 'Wo' = 6 + 2", C.plainIndex(t, 121, 85, mono) === 8);
  check("…left of the text = its start; past the end = its end; below the last line = the last line", C.plainIndex(t, 10, 55, mono) === 0 && C.plainIndex(t, 999, 55, mono) === 5 && C.plainIndex(t, 999, 500, mono) === 11);
  check("…centred text: the line starts at x - w/2", C.plainIndex(Object.assign({}, t, { align: "center" }), 86, 55, mono) === 1);
  check("…right aligned: it ends at x", C.plainIndex(Object.assign({}, t, { align: "right" }), 90, 55, mono) === 4);
  check("…an emoji is one step (a click never lands inside it)", C.plainIndex({ str: "a😀b", x: 0, y: 0, size: 20 }, 19, 5, mono) === 3);
  const lines = [{ text: "The quick", x: 10, y: 0 }, { text: "brown fox", x: 10, y: 24 }];
  check("layoutIndex: a wrapped line found back in the string (the space the wrap dropped skipped): 'br|own' = 10 + 2",
    C.layoutIndex("The quick brown fox", lines, 31, 30, 24, mono) === 12);
  check("…above the first line = the first line; below the last = the last line", C.layoutIndex("The quick brown fox", lines, 999, -10, 24, mono) === 9 && C.layoutIndex("The quick brown fox", lines, 999, 300, 24, mono) === 19);
  const [ux, uy] = C.unturn({ rot: 90 }, { x: 0, y: 0, w: 100, h: 20 }, 50, 60);
  check("unturn: a click on a text turned 90° turned back round the box centre", Math.abs(ux - 100) < 1e-9 && Math.abs(uy - 10) < 1e-9, [ux, uy]);

  // pcdoc.textBox0 measures in the text's font
  const D = require("../ext/imageeditdock/pcdoc.js");
  const g = { font: "10px sans-serif", letterSpacing: "0px", stack: [], save() { this.stack.push([this.font, this.letterSpacing]); }, restore() { [this.font, this.letterSpacing] = this.stack.pop(); },
    measureText(s) { const px = +String(this.font).match(/(\d+(?:\.\d+)?)px/)[1]; return { width: s.length * px * 0.5 + s.length * parseFloat(this.letterSpacing || "0") }; } };
  const b = D.textBox0({ str: "Hello", x: 10, y: 0, size: 40, tracking: 100, align: "left", font: "Arial", leading: 1.2 }, g);
  check("pcdoc.textBox0: measured in the text's own font (40 px) and tracking (+4 px a letter) - not the context's 10 px; the context left as it was",
    b.w === 5 * 20 + 5 * 4 && g.font === "10px sans-serif" && g.letterSpacing === "0px", { b, font: g.font });

  const EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, PT = rd("ext", "imageeditdock", "pctools.js"), IE = rd("ext", "imageeditdock", "imageedit.js");
  const W = {
    "ext.json: pccaret.js before pctools.js": EXT.indexOf("pccaret.js") >= 0 && EXT.indexOf("pccaret.js") < EXT.indexOf("pctools.js"),
    "a click on a text edits it FROM the click": /editText\(S\.layers\[i\], \{ x: fx, y: fy \}\)/.test(PT) && /ta\.setSelectionRange\(pos, pos\)/.test(PT),
    "a click inside the typing box stays in it": /ta\.addEventListener\("pointerdown", \(ev\) => ev\.stopPropagation\(\)\)/.test(PT),
    "the frame hugs the letters (no extra em, grown on the side the text grows)": /const wPx = \(empty \? 0 : b\.w \* S\.zoom\) \+ room/.test(PT) && !/\(b\.w \+ t\.size\) \* S\.zoom/.test(PT),
    "the hover cursor: I-beam over a text, the new-text cursor elsewhere": /E\.textCursorAt = /.test(PT) && /NEW_TEXT_CURSOR/.test(PT),
    "the typing box's look wins over .kx textarea (transparent, dashed, no padding)": /\.pctext,\.kx textarea\.pctext\{[^}]*background:transparent[^}]*padding:0[^}]*color:transparent/.test(IE),
    "pctype hands its measure to the caret": /measure: \(t\) => canvasMeasure\(t, ctx\(E\.cv\)\)/.test(rd("ext", "imageeditdock", "pctype.js")),
  };
  const miss = Object.keys(W).filter((k) => !W[k]);
  check("wired: " + Object.keys(W).join(" · "), miss.length === 0, miss);
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
