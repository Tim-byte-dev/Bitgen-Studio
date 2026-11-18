#!/usr/bin/env node
/* bitGen Studio — 2.811.0: word-processor text in the image editor (ext/imageeditdock/pcdoctext.js) - the pure parts in Node
 * (jsdom) + pins on where it is hooked in.
 * Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the
 * alignment, text editing/formatting / table options?" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { JSDOM } = require("jsdom");
const X = require("../ext/imageeditdock/pcdoctext.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
const S = (h) => X.sanitize(h, doc);

check("sanitize: scripts, iframes, pictures and event handlers out; the words kept", (() => { const o = S('<p onclick="x()">Hi <script>alert(1)</script><img src=x onerror=y><iframe></iframe>there</p>'); return o === "<p>Hi there</p>"; })(), S('<p onclick="x()">Hi <script>alert(1)</script><img src=x onerror=y><iframe></iframe>there</p>'));
check("sanitize: div -> p, font -> span with its colour / face, loose words into a paragraph", S('Loose <div>Block</div><font color="#ff0000" face="Arial">red</font>') === '<p>Loose </p><p>Block</p><p><span style="color:#ff0000;font-family:Arial">red</span></p>', S('Loose <div>Block</div><font color="#ff0000" face="Arial">red</font>'));
check("sanitize: only known style keys, no url() / expression", S('<p style="text-align:center;position:fixed;background-image:url(x);color:red">a</p>') === '<p style="color:red;text-align:center">a</p>', S('<p style="text-align:center;position:fixed;background-image:url(x);color:red">a</p>'));
check("sanitize: links only http(s) / mailto", S('<p><a href="javascript:x">a</a><a href="https://x.y">b</a></p>') === '<p><a>a</a><a href="https://x.y">b</a></p>', S('<p><a href="javascript:x">a</a><a href="https://x.y">b</a></p>'));
check("sanitize: data-style title / subtitle kept on paragraphs, others dropped", S('<p data-style="title">T</p><p data-style="evil">E</p>') === '<p data-style="title">T</p><p>E</p>');
check("sanitize: lists, headings, tables (colspan), empty paragraphs keep a line", S('<h1>H</h1><ul><li>a</li></ul><table><tr><td colspan="2">c</td></tr></table><p></p>') === '<h1>H</h1><ul><li>a</li></ul><table><tbody><tr><td colspan="2">c</td></tr></tbody></table><p><br></p>', S('<h1>H</h1><ul><li>a</li></ul><table><tr><td colspan="2">c</td></tr></table><p></p>'));
check("sanitize: nothing -> one empty paragraph", S("") === "<p><br></p>");
check("bands: overlapping boxes merged (lines that only touch stay apart), sorted", JSON.stringify(X.bands([{ top: 20, bottom: 30 }, { top: 0, bottom: 10 }, { top: 2, bottom: 12 }, { top: 25, bottom: 40 }, { top: 40, bottom: 50 }])) === JSON.stringify([{ top: 0, bottom: 12 }, { top: 20, bottom: 40 }, { top: 40, bottom: 50 }]), X.bands([{ top: 20, bottom: 30 }, { top: 0, bottom: 10 }, { top: 2, bottom: 12 }, { top: 25, bottom: 40 }, { top: 40, bottom: 50 }]));
const lines = Array.from({ length: 10 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 15 }));
const w = X.windows(lines, [50, 50, 200]);
check("windows: whole lines per frame - 2 lines fit 50 px (the third ends at 55), the next frame starts at the next line", w[0].top === 0 && w[0].lines === 2 && w[1].top === 40 && w[1].lines === 2 && w[2].top === 80 && w[2].lines === 6 && !w[2].overflow, w);
const w2 = X.windows(lines, [50]);
check("windows: the last frame's overflow when lines are left", w2[0].overflow === true && w2[0].lines === 2, w2);
const w3 = X.windows([{ top: 0, bottom: 80 }, { top: 90, bottom: 100 }], [50, 50]);
check("windows: a line taller than its frame still goes in (never stuck)", w3[0].lines === 1 && w3[1].top === 90, w3);
check("windows: no lines - each frame empty, none overflowing", X.windows([], [50, 50]).every((x) => x.lines === 0 && !x.overflow));
check("ptOf: pt / px / words", X.ptOf("12pt") === 12 && X.ptOf("16px") === 12 && X.ptOf("xxx-large") === 36 && X.ptOf("bogus") === null);
check("STYLES: Normal, Title, Subtitle, Heading 1-3, Quote, Code", X.STYLES.map((s) => s[1]).join() === "Normal,Title,Subtitle,Heading 1,Heading 2,Heading 3,Quote,Code");

const DC = src("ext/imageeditdock/pcdoc.js"), IE = src("ext/imageeditdock/imageedit.js"), UI = src("ext/imageeditdock/pcui.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json"));
check("pcdoc: \"doc\" layers are live, kept by undo (DEEP) and drawn by PCDocText", /"bscene", "doc"(, "cal")?\]/.test(DC) && /L\.type === "sketch" \|\| L\.type === "doc"\)/.test(DC) && /L\.type === "doc" && L\.doc && root\.PCDocText\) root\.PCDocText\.draw\(g, L\)/.test(DC));
check("imageedit: a doc layer moves (x / y), copies, rasterizes; PCDocText installed after PCShapeOps", /else if \(L\.type === "doc" && L\.doc\) \{ L\.doc\.x \+= dx; L\.doc\.y \+= dy; D\.rasterize\(L\); \}/.test(IE) && /"sketch", "doc"\]\) d\[k\] = D\.clone/.test(IE) && IE.indexOf("PCDocText.install(E)") > IE.indexOf("PCShapeOps.install(E)"));
check("the Document Text tool in the T group; pcdoctext.js loaded after pcshapeops.js", /\["doctext", "Document Text Tool \(word processor\)"\]/.test(UI) && EX.scripts.indexOf("pcdoctext.js") === EX.scripts.indexOf("pcshapeops.js") + 2 && EX.scripts.indexOf("pcpickmodes.js") === EX.scripts.indexOf("pcshapeops.js") + 1);
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
