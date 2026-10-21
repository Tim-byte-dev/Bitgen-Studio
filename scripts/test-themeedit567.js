#!/usr/bin/env node
/* bitGen Studio — 2.567.0 units: the theme editor's text alignment, padding / margins (the element's and its words') and
 * rounded corners one by one (static/themeedit.js: cleanRule, compile, alignKind, alignCss; lib/themeStore keeps them).
 * Tim: "in theme editor add alignment options for text" / "add padding and margins for selected objects and text, and
 * rounded corners for objects". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = require(path.join(ROOT, "static", "themeedit.js"));

/* 1 the rule */
const r = T.cleanRule({ align: "right", valign: "bottom", pad: { t: 4, r: "", b: 6.6, l: 900, x: 3 }, mar: { t: -12, l: "8" }, tpad: { l: 5 }, tmar: { r: -300 }, corners: { tl: 10, br: 300, zz: 4 } });
check("cleanRule: align / valign kept; padding T R B L (empty dropped, rounded, clamped 0..400, unknown sides dropped); margins may be negative; the words' padding / margins; each corner 0..200",
  r.align === "right" && r.valign === "bottom" && JSON.stringify(r.pad) === '{"t":4,"b":7,"l":400}' && JSON.stringify(r.mar) === '{"t":-12,"l":8}'
  && JSON.stringify(r.tpad) === '{"l":5}' && JSON.stringify(r.tmar) === '{"r":-200}' && JSON.stringify(r.corners) === '{"tl":10,"br":200}', r);
const bad = T.cleanRule({ align: "middle", valign: "left", pad: "4px", mar: [1, 2], corners: { tl: "" } });
check("...anything else is dropped (a wrong word, a string / list for the sides, all empty)", Object.keys(bad).length === 0, bad);
check("...never on the page itself: html / body keep colours and alignment, no padding / margins", (() => { const m = T.cleanStyles({ body: { pad: { t: 9 }, mar: { l: 9 }, align: "center", color: "#ffffff" } }).body; return !m.pad && !m.mar && m.align === "center" && m.color === "#ffffff"; })());

/* 2 the CSS */
const css = T.compile({ "#zz": { align: "right", valign: "bottom", pad: { t: 4, l: 2 }, mar: { b: -3 }, radius: 6, corners: { tl: 0, br: 14 }, tpad: { l: 5 }, tmar: { r: 2 } } });
check("compile: text-align / align-content; padding-* / margin-* per side; each corner after the Radius (so it wins)",
  /#zz:not\(#thEditPanel \*\)\{[^}]*text-align:right !important/.test(css) && /align-content:end !important/.test(css) && /padding-top:4px !important;padding-left:2px !important/.test(css)
  && /margin-bottom:-3px !important/.test(css) && /border-radius:6px !important.*border-top-left-radius:0px !important;border-bottom-right-radius:14px !important/.test(css), css);
check("...the words' padding / margins on its .h3lb (an inline block, so top / bottom count)", /#zz:not\(#thEditPanel \*\) > \.h3lb\{display:inline-block !important;padding-left:5px !important;margin-right:2px !important\}/.test(css), css);
check("...flex boxes by direction: row = justify-content / align-items, column = the other way round, reversed = flipped; a grid = justify-items; a button made a flex box (top / bottom)",
  /#zz\[data-h3al\]\[data-h3al="row"\]:not\(#thEditPanel \*\)\{justify-content:flex-end !important;align-items:flex-end !important\}/.test(css)
  && /\[data-h3al="rowr"\][^{]*\{justify-content:flex-start !important;align-items:flex-end !important\}/.test(css)
  && /\[data-h3al="col"\][^{]*\{align-items:flex-end !important;justify-content:flex-end !important\}/.test(css)
  && /\[data-h3al="colr"\][^{]*\{align-items:flex-end !important;justify-content:flex-start !important\}/.test(css)
  && /\[data-h3al="grid"\][^{]*\{justify-items:end !important\}/.test(css)
  && /\[data-h3al="btn"\][^{]*\{display:inline-flex !important;justify-content:flex-end !important;align-items:flex-end !important\}/.test(css)
  && /\[data-h3al="btnb"\][^{]*\{display:flex !important/.test(css), css);
const css2 = T.compile({ "#zz": { align: "center" } });
check("...only a horizontal alignment: a button is left alone (text-align does it); a flex row gets only justify-content", !/data-h3al="btn/.test(css2) && /\[data-h3al="row"\][^{]*\{justify-content:center !important\}/.test(css2) && !/align-content/.test(css2), css2);

/* 3 the kinds */
check("alignKind: flex row / row-reverse / column / column-reverse, grid, a button only when top / bottom is asked (inline or block), it stays one while it is; a block = \"\"",
  T.alignKind("flex", "row", "DIV", false) === "row" && T.alignKind("inline-flex", "row-reverse", "SPAN", true) === "rowr" && T.alignKind("flex", "column", "DIV", false) === "col"
  && T.alignKind("flex", "column-reverse", "DIV", false) === "colr" && T.alignKind("grid", "row", "DIV", true) === "grid"
  && T.alignKind("inline-block", "row", "BUTTON", true) === "btn" && T.alignKind("block", "row", "BUTTON", true) === "btnb" && T.alignKind("inline-block", "row", "BUTTON", false) === ""
  && T.alignKind("inline-flex", "row", "BUTTON", true, "btn") === "btn" && T.alignKind("block", "row", "DIV", true) === "");

/* 4 kept with the theme */
const TS = require(path.join(ROOT, "lib", "themeStore.js"));
const SRC = rd("lib", "themeStore.js");
check("themeStore cleans a theme's styles with the same cleanRule - alignment, padding, margins, corners are saved with it", /TE\.cleanStyles\(o\.styles\)/.test(SRC) && !!TS);

/* 5 the panel */
const S = rd("static", "themeedit.js");
check("the Style panel: Text ▸ Align (⇤ ↔ ⇥ ☰ and ⤒ ↕ ⤓, – = none), the words' Padding / Margin (off for elements with children), Box ▸ Corners ↖ ↗ ↘ ↙, Padding, Margin; = copies the first value to all four",
  /seg\("teAl", r\.align/.test(S) && /seg\("teVa", r\.valign/.test(S) && /sides\("teTPad", r\.tpad/.test(S) && /sides\("teTMar", r\.tmar/.test(S) && /sides\("teCr", r\.corners, CORNERS/.test(S)
  && /sides\("tePad", r\.pad/.test(S) && /sides\("teMar", r\.mar/.test(S) && /button\[data-eq\]/.test(S) && /offT = \(id\) => \/\^teT\(Pad\|Mar\)\$\/\.test\(id\) && !plain/.test(S));
check("the page: alignment rules mark what they aim at (data-h3al) on every repaint, the watcher runs for them too; the words' padding wraps them like an icon rule",
  /applyAlign\(\);\n    \} finally \{ wrapping = false; \}/.test(S) && /iconSels\(\)\.length \|\| alignSels\(\)\.length/.test(S) && /styles\[s\]\.tpad \|\| styles\[s\]\.tmar/.test(S));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
