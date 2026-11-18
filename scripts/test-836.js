#!/usr/bin/env node
/* bitGen Studio — 2.836.0 units: the image editor - Generate on an empty layer (the selection's shape, cut to it), a hard edge for
 * shaped selections, a click on a WP layer = word processing, the handles' pointers, Artist Mode named Full Screen.
 *   pcaifill selShape; pcpromptlink actionFor (an empty layer = the prompt docker's own Generate); pchandles cursorKind /
 *   cursorCss; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const F = require(path.join(ROOT, "ext/imageeditdock/pcaifill.js")), L = require(path.join(ROOT, "ext/imageeditdock/pcpromptlink.js")), HD = require(path.join(ROOT, "ext/imageeditdock/pchandles.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const W = 40, H = 30;
const rect = new Uint8Array(W * H); for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) rect[y * W + x] = 255;
const ell = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 20) / 12) ** 2 + ((y - 15) / 9) ** 2 <= 1) ell[y * W + x] = 255;
const r1 = F.selShape(rect, W, H), r2 = F.selShape(ell, W, H), r3 = F.selShape(null, W, H);
check("selShape: a rectangle is a rectangle (its box), an ellipse is not; no selection = none (a rectangle)", r1.rect && r1.box.x === 10 && r1.box.w === 20 && r1.box.h === 10 && !r2.rect && r2.box.w === 25 && r3.box === null && r3.rect, [r1, r2]);
const s = { onScreen: true, open: true, aiShown: false, mode: "generate", genMode: "image", hasSel: true, blender: false, picks: 0, refs: 0 };
check("actionFor ✨ Generate + a selection: a picture layer = the editor fills it; an EMPTY layer = the prompt docker's own Generate (null)",
  L.actionFor(Object.assign({}, s, { op: "generate" })).kind === "run" && L.actionFor(Object.assign({}, s, { op: "generate", empty: true })) === null);
check("cursorKind: scale corners / sides = their two-way arrows; rotate mode: corners turn, sides skew; no handle = none",
  HD.cursorKind("scale", "nw") === "nwse" && HD.cursorKind("scale", "ne") === "nesw" && HD.cursorKind("scale", "e") === "ew" && HD.cursorKind("scale", "s") === "ns"
  && HD.cursorKind("rotate", "sw") === "rot" && HD.cursorKind("rotate", "n") === "skewx" && HD.cursorKind("rotate", "w") === "skewy" && HD.cursorKind("scale", null) === null);
const hot = HD.cursorCss("nwse", true, "#00ff00"), cold = HD.cursorCss("nwse", false), rot = HD.cursorCss("rot", false);
check("cursorCss: over a handle the browser's own arrow (or a drawn one for turn / skew); while dragging the arrow drawn in the accent colour, bigger",
  cold === "nwse-resize" && /^url\("data:image\/svg\+xml,/.test(hot) && decodeURIComponent(hot).includes('fill="#00ff00"') && decodeURIComponent(hot).includes('width="32"') && /nwse-resize$/.test(hot) && /grab$/.test(rot) && HD.cursorCss(null) === "");
// the wiring
const IE = read("ext/imageeditdock/imageedit.js"), PL = read("ext/imageeditdock/pcpromptlink.js"), AF = read("ext/imageeditdock/pcaifill.js"), DT = read("ext/imageeditdock/pcdoctext.js"), PH = read("ext/imageeditdock/pchandles.js"), FO = read("ext/imageeditdock/pcfocus.js");
check("runAI opt.hardEdge = no feather, no soft blend; pcpromptlink sends it for a shaped selection and the empty flag to actionFor",
  /clip \|\| opt\.hardEdge \? 0 : S\.feather/.test(IE) && (IE.match(/!clip && !opt\.hardEdge/g) || []).length === 2 && /hardEdge: hard/.test(PL) && /empty: !!\(E\.aiFill && E\.aiFill\.layerEmpty\(\)\)/.test(PL));
check("pcaifill: H3ImageSize at the selection's box for an empty layer, takeGenerated puts it into that layer (cut by the mask, one undo)",
  /place = empty && L \?/.test(AF) && /E\.beginPx\(L\)/.test(AF) && /destination-in/.test(AF) && /E\.push\(px\)/.test(AF));
check("pcdoctext: a click on a WP layer's row / its frame (Move tool, no drag) = the Document Text tool + typing (wpMode)", /const wpMode = /.test(DT) && /\.kxlayer\[data-i\]/.test(DT) && /E\.setTool\("doctext"\)/.test(DT));
check("pchandles: the hover pointer from the window's capture, the hot pointer on press, back on release", /\.pchcur, \.pchcur \* \{ cursor: var\(--pch-cur\) !important; \}/.test(PH) && /showCursor\(cursorKind\(st\.mode, h\), true\)/.test(PH) && /showCursor\(cursorKind\(st\.mode, d\.h\), false\)/.test(PH));
const sc = read("docs/shortcuts.json"), us = read("docs/USAGE.md"), ft = read("docs/FEATURES.md"), hp = read("static/help/imageeditor.html");
check("Artist Mode is called Full Screen: the button, the View command, Exit; the shortcuts, guide, features and help say so (no 'Artist mode' left)",
  /🎨 <span>Full Screen<\/span>/.test(FO) && /"🎨 Full Screen \(canvas only\)"/.test(FO) && /"Exit Full Screen"/.test(FO) && ![sc, us, ft, hp].some((t) => /\bArtist [Mm]ode\b/.test(t.replace(/Artist Mode(<\/b>)? is now/g, ""))) && /Full Screen/.test(sc));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
