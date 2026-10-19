#!/usr/bin/env node
/* bitGen Studio — 2.449.0 units: PER-CHARACTER TYPE (ext/imageeditdock/pcruns.js): ranges set / joined / cleared, the
 * style of a letter, ranges following the typing, the pieces and lines (one baseline, the tallest letters), scaling;
 * the wiring (pcdoc, pctools, pctype, pcui, pcdockers, ext.json, imageedit.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const R = require(path.join(ROOT, "ext", "imageeditdock", "pcruns.js"));
const J = (x) => JSON.stringify(x);
const base = { str: "Hello world", x: 10, y: 20, size: 40, color: "#000000", weight: 400 };

let runs = R.applyRun(null, 0, 5, { color: "#ff0000" }, 11, base);
runs = R.applyRun(runs, 3, 8, { weight: 700 }, 11, base);
check("applyRun: a range for letters s .. e; an overlapping one splits it (each part keeps what it had)",
  J(runs) === '[{"s":0,"e":3,"color":"#ff0000"},{"s":3,"e":5,"weight":700,"color":"#ff0000"},{"s":5,"e":8,"weight":700}]', runs);
check("applyRun: a value equal to the layer's (or null) clears it; empty ranges go; equal neighbours join",
  J(R.applyRun(runs, 0, 11, { weight: 400 }, 11, base)) === '[{"s":0,"e":5,"color":"#ff0000"}]' && J(R.applyRun(runs, 0, 11, { color: null, weight: null }, 11, base)) === "[]"
  && J(R.normRuns([{ s: 0, e: 2, size: 9 }, { s: 2, e: 4, size: 9 }, { s: 4, e: 4, size: 1 }, { s: 6, e: 99, italic: true }], 8)) === '[{"s":0,"e":4,"size":9},{"s":6,"e":8,"italic":true}]');
const t = Object.assign({}, base, { runs });
check("styleAt: the layer's settings + its range's; rangeHas / allBold (the B / I buttons toggle off when every letter has it)",
  R.styleAt(t, 4).weight === 700 && R.styleAt(t, 4).color === "#ff0000" && R.styleAt(t, 9).weight === 400 && R.styleAt(t, 9).color === "#000000"
  && R.allBold(t, 3, 8) && !R.allBold(t, 2, 8) && R.rangeHas(t, 0, 5, "color", "#ff0000") && !R.rangeHas(t, 0, 6, "color", "#ff0000") && R.rangeHas(t, 0, 3, "italic", false));
check("shiftRuns: typed letters take the style of the letter before them; deleted letters take their ranges with them; at the start, the one after",
  J(R.shiftRuns([{ s: 0, e: 5, color: "#f00" }], "Hello world", "HeXXllo world")) === '[{"s":0,"e":7,"color":"#f00"}]'
  && J(R.shiftRuns([{ s: 6, e: 11, weight: 700 }], "Hello world", "Hello there world")) === '[{"s":12,"e":17,"weight":700}]'
  && J(R.shiftRuns([{ s: 0, e: 5, color: "#f00" }], "Hello world", "lo world")) === '[{"s":0,"e":2,"color":"#f00"}]'
  && J(R.shiftRuns([{ s: 0, e: 2, size: 9 }], "ab", "Xab")) === '[{"s":0,"e":3,"size":9}]'
  && J(R.shiftRuns([{ s: 2, e: 4, size: 9 }], "abcdef", "abef")) === "[]");
const P = R.pieces(Object.assign({}, base, { str: "ab cd\nef", runs: [{ s: 1, e: 4, caps: true }] }));
check("pieces: one style per piece, a paragraph per \"\\n\"; All Caps shows capitals (the text keeps its letters)",
  P.length === 2 && J(P[0].map((x) => x.text)) === '["a","B C","d"]' && J(P[1].map((x) => [x.s, x.e])) === "[[6,8]]", P.map((q) => q.map((x) => x.text)));
const Lo = R.layout(Object.assign({}, base, { runs: [{ s: 0, e: 5, size: 80 }] }));
check("layout: a line as tall as its largest letters (80 x 1.2), one baseline for all (the largest ascent), pieces side by side",
  Lo.lines.length === 1 && Math.abs(Lo.lines[0].h - 96) < 1e-6 && Math.abs(Lo.lines[0].base - 64) < 1e-6 && Lo.lines[0].items[0].x === 10 && Lo.lines[0].items[1].x > Lo.lines[0].items[0].x && Lo.box.h === 96, Lo.lines[0]);
const Lb = R.layout(Object.assign({}, base, { str: "aaa bbb ccc", box: { w: 100, h: 200 }, runs: [{ s: 4, e: 7, size: 60 }] }));
const Lc = R.layout(Object.assign({}, base, { str: "ab\ncd", align: "center", x: 100, runs: [{ s: 3, e: 5, size: 20 }] }));
check("layout: a paragraph box wraps at spaces (each line its own height); point text centred line by line",
  Lb.lines.length === 3 && Lb.lines[1].items.map((i) => i.text).join("") === "bbb" && Math.abs(Lb.lines[1].h - 72) < 1e-6 && Math.abs(Lb.lines[0].h - 48) < 1e-6
  && Math.abs(Lc.lines[0].x + Lc.lines[0].w / 2 - 100) < 1e-6 && Math.abs(Lc.lines[1].x + Lc.lines[1].w / 2 - 100) < 1e-6 && Lc.lines[1].h === 24, { b: Lb.lines.map((l) => [l.items.map((i) => i.text).join(""), l.h]), c: Lc.lines.map((l) => [l.x, l.w, l.h]) });
const sc = { size: 10, runs: [{ s: 0, e: 1, size: 20, baseline: 4 }, { s: 1, e: 2, color: "#fff" }] }; R.scale(sc, 2);
check("sameMetrics (colours / lines only = the typing box stays over the letters); owns (not a path / vertical / warp / 3D / text effect text); scale",
  R.sameMetrics({ runs: [{ s: 0, e: 1, color: "#f00", underline: true }] }) && !R.sameMetrics({ runs: [{ s: 0, e: 1, size: 9 }] })
  && R.owns({ str: "a", runs: [{ s: 0, e: 1, color: "#f00" }] }) && !R.owns({ str: "a" }) && !R.owns({ str: "a", fx: "neon", runs: [{ s: 0, e: 1, color: "#f00" }] }) && !R.owns({ str: "a", vertical: true, runs: [{ s: 0, e: 1, color: "#f00" }] })
  && sc.runs[0].size === 40 && sc.runs[0].baseline === 8);

const DOC = read("ext", "imageeditdock", "pcdoc.js"), PT = read("ext", "imageeditdock", "pctools.js"), TY = read("ext", "imageeditdock", "pctype.js"), UI = read("ext", "imageeditdock", "pcui.js"), DK = read("ext", "imageeditdock", "pcdockers.js"), IE = read("ext", "imageeditdock", "imageedit.js");
const ext = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("wiring: pcdoc draws / sizes a ranged text with PCRuns first; pctools: the typing box gives its picked letters (E.textEditing), stays open for the bar / panel (E.keepTyping), the ranges follow the typing and Image Size; pctype exports drawRun / canvasMeasure / baseOff; Properties' text box and Free Transform keep the ranges; pcruns.js after pctype.js (2.466.0: pcotype.js between), installed after PCType",
  /PCRuns\.owns\(t\)\) return root\.PCRuns\.box/.test(DOC) && /PCRuns\.owns\(L\.text\)\) root\.PCRuns\.draw/.test(DOC) && /E\.textEditing = /.test(PT) && /E\.keepTyping\(doc\.activeElement\)/.test(PT) && /PCRuns\.shiftRuns/.test(PT) && /PCRuns\.scale\(L\.text, ky\)/.test(PT)
  && /drawRun, canvasMeasure, baseOff, effSize/.test(TY) && /PCRuns\.shiftRuns/.test(UI) && /PCRuns\.scale\((L\.text|t), k\)/.test(DK)
  && ext.indexOf("pcruns.js") === ext.indexOf("pctype.js") + 2 && ext[ext.indexOf("pctype.js") + 1] === "pcotype.js" && IE.indexOf("PCRuns.install(E)") > IE.indexOf("PCType.install(E)"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
