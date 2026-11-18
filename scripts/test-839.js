#!/usr/bin/env node
/* bitGen Studio — 2.839.0 units: a document's figures dragged to a new place in the text and laid out beside the text.
 *   pcdocfig blockIndexAt / relocate / layout / modeOf / tidy (a 2.838.0 place turned into the caption-inside form);
 *   pcdoctext sanitize keeps a place's float / padding-top / margin-right; pcdocai places carry their caption inside; the
 *   Word export keeps the caption; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const F = require(path.join(ROOT, "ext/imageeditdock/pcdocfig.js")), T = require(path.join(ROOT, "ext/imageeditdock/pcdoctext.js"));
const { JSDOM } = require("jsdom");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const H = '<p>A</p><p>B</p><p data-fig="f1" style="padding-top:200px"><i>Figure 1</i></p><p>C</p><p>D</p>';
const blocks = [{ top: 0, bottom: 20 }, { top: 20, bottom: 40 }, { top: 40, bottom: 260, fig: "f1" }, { top: 260, bottom: 280 }, { top: 280, bottom: 300 }];
check("blockIndexAt: before the first block whose middle is below the drop; the figure's own block skipped; past the end = the end",
  F.blockIndexAt(blocks, 5) === 0 && F.blockIndexAt(blocks, 25) === 1 && F.blockIndexAt(blocks, 150, "f1") === 3 && F.blockIndexAt(blocks, 275, "f1") === 4 && F.blockIndexAt(blocks, 999, "f1") === 5);
const r1 = F.relocate(H, "f1", 4, doc), r0 = F.relocate(H, "f1", 0, doc), rEnd = F.relocate(H, "f1", 5, doc);
check("relocate: the place moved before the block asked for (after C / to the top / to the end), its caption inside it",
  r1 === '<p>A</p><p>B</p><p>C</p><p data-fig="f1" style="padding-top:200px"><i>Figure 1</i></p><p>D</p>' && /^<p data-fig="f1"/.test(r0) && /<p>D<\/p><p data-fig="f1"[^>]*><i>Figure 1<\/i><\/p>$/.test(rEnd), [r1, r0, rEnd]);
check("relocate: dropped where it already is = null (nothing to change)", F.relocate(H, "f1", 2, doc) === null && F.relocate(H, "f1", 3, doc) === null && F.relocate(H, "nope", 0, doc) === null);
const OLD = '<p>A</p><p data-fig="g" style="height:300px"><br></p><p><i>Figure 2: old</i></p><p>B</p>';
const r2 = F.relocate(OLD, "g", 0, doc);
check("a 2.838.0 place (height + a caption paragraph after it) moved = the picture as padding-top, the caption inside, no empty caption paragraph left",
  r2 === '<p data-fig="g" style="padding-top: 300px;"><i>Figure 2: old</i></p><p>A</p><p>B</p>', r2);
const l1 = F.layout(H, "f1", "left", 0.5, 600, 0.5, doc), l2 = F.layout(l1, "f1", "right", 0.75, 600, 0.5, doc), l3 = F.layout(l2, "f1", "full", 1, 600, 0.5, doc);
check("layout: left / right beside the text (float, width %, a gap on the text's side, the picture's height for that width), full = the whole column again",
  /float: left;[^"]*width: 50%;[^"]*margin-right: 14px;[^"]*padding-top: 150px/.test(l1) && /float: right;[^"]*width: 75%;[^"]*margin-left: 14px;[^"]*padding-top: 225px/.test(l2) && !/float|width|margin/.test(l3) && /padding-top: 300px/.test(l3), [l1, l2, l3]);
check("modeOf: full / left 0.5 / right 0.75", F.modeOf(H, "f1", doc).mode === "full" && F.modeOf(l1, "f1", doc).mode === "left" && F.modeOf(l1, "f1", doc).frac === 0.5 && F.modeOf(l2, "f1", doc).frac === 0.75);
const sa = T.sanitize(l1 + '<p data-fig="z" style="float:left;position:absolute;padding-top:9999px;margin-right:900px"><i>x</i></p>' + '<p style="float:left">not a figure</p>', doc);
check("pcdoctext sanitize keeps a figure's float, width, padding-top (<= 4000) and its gap (<= 200) - only on a figure's place",
  /data-fig="f1" style="[^"]*float: ?left[^"]*"/.test(sa) && /data-fig="f1" style="[^"]*width: ?50%/.test(sa) && /padding-top: ?4000px/.test(sa) && /margin-right: ?200px/.test(sa) && !/absolute/.test(sa) && /<p>not a figure<\/p>/.test(sa), sa);
const P = require(path.join(ROOT, "ext/imageeditdock/pcdocai.js"));
check("pcdocai: a new place carries its caption inside, under the picture (padding-top)", /<p data-fig="a1" style="padding-top:\d+px"><i>Figure 1: c<\/i><\/p>/.test(P.toHtml({ blocks: [{ type: "chart", caption: "Figure 1: c", chart: {} }] }, { colW: 500, figId: () => "a1" })));
const DF = read("ext/imageeditdock/pcdocfig.js"), DX = read("ext/imageeditdock/pcdocx.js"), DT = read("ext/imageeditdock/pcdoctext.js"), EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js");
check("the wiring: a Move-tool drag of an anchored layer (a 'move' push) moves its place (one undo, drawn again at it); the commands hidden off a figure; loaded after pcdocai, installed after it",
  /if \(!e \|\| e\.label !== "move"\) return;/.test(DF) && /E\.structOp\(label, \(\) => \{ st\.head\.doc\.html = E\.docText\.sanitize\(html\); \}\)/.test(DF) && /Object\.defineProperty\(c, "hidden", \{ get: \(\) => !on\(\)/.test(DF)
  && EX.scripts.indexOf("pcdocfig.js") === EX.scripts.indexOf("pcdocai.js") + 1 && IE.indexOf("PCDocFig.install(E)") > IE.indexOf("PCDocAi.install(E)"));
check("pcdoctext measure: a place's picture = its padding-top (the caption under it is not the picture); the story's top-level blocks for a drop",
  /bottom: pt > 0 \? r\.top - r0\.top \+ pt : r\.bottom - r0\.top/.test(DT) && /const blocks = \[\.\.\.el\.children\]/.test(DT));
check("Word export: a place's caption follows its picture as a centred paragraph", /if \(cap\.some\(\(r\) => String\(r\.text \|\| ""\)\.trim\(\)\)\) out\.push\(\{ t: "p", runs: cap, align: "center" \}\)/.test(DX));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
