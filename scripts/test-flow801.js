#!/usr/bin/env node
/* bitGen Studio — 2.801.0 units: linked text frames + text wrap (ext/imageeditdock/pcflow.js, pctype.js wrapHoles) and paragraph
 * text in the export (pcdtpout.js). Pure + source pins. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const F = require("../ext/imageeditdock/pcflow.js");
const PT = require("../ext/imageeditdock/pctype.js");

check("boundaries: 0 and after each word", F.boundaries("ab cd\nef  g").join() === "0,2,5,8,11" && F.boundaries("").join() === "0");
// a fake fit: frame k holds cap[k] characters
const cap = [10, 8, 100];
const story = "one two three four five six seven eight nine";
const parts = F.flow(story, 3, (k, t) => t.length <= cap[k]);
check("flow: each frame the longest run of whole words that fits; the next frame goes on after the space", parts.map((p) => p.part).join("|") === "one two|three|four five six seven eight nine" && parts[1].start === 8 && parts[1].end === 13 && parts[2].start === 14, parts);
const p2 = F.flow("alpha beta\ngamma delta", 2, (k, t) => (k === 0 ? t.length <= 10 : true));
check("flow: a cut at a paragraph's end drops that line break (the next frame starts the next paragraph)", p2[0].part === "alpha beta" && p2[1].part === "gamma delta" && p2[1].start === 11, p2);
const p3 = F.flow("supercalifragilistic word", 3, (k, t) => (k === 0 ? t.length <= 3 : t.length <= 100));
check("flow: a frame too small for the first word shows nothing; the next frame takes it all", p3[0].part === "" && p3[1].part === "supercalifragilistic word" && p3[2].part === "", p3);
check("flow: the last frame gets what is left (its overflow hidden); one frame = all", F.flow("a b c", 1, () => false)[0].part === "a b c" && F.flow("", 2, () => true).every((p) => p.part === ""));
const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
const c1 = F.clipPoly([[50, 50], [150, 50], [150, 150], [50, 150]], { x: 0, y: 0, w: 100, h: 100 });
check("clipPoly: a square half outside the frame is cut to the part inside", c1.length === 4 && c1.every(([x, y]) => x >= 50 && x <= 100 && y >= 50 && y <= 100), c1);
check("clipPoly: outside entirely = nothing", F.clipPoly([[200, 200], [300, 200], [300, 300]], { x: 0, y: 0, w: 100, h: 100 }).length === 0);
const el = F.shapePoly({ kind: "ellipse", x: 0, y: 0, w: 100, h: 50 }, 10);
check("shapePoly: an ellipse grown by the gap (48 points); a rectangle = its box + gap; a triangle 3 points", el.length === 48 && Math.abs(el[0][0] - 110) < 1e-9 && JSON.stringify(F.shapePoly({ kind: "rect", x: 10, y: 10, w: 20, h: 20 }, 5)) === JSON.stringify(F.rectPoly({ x: 10, y: 10, w: 20, h: 20 }, 5)) && F.shapePoly({ kind: "triangle", x: 0, y: 0, w: 10, h: 10 }, 0).length === 3);
const holes = F.holesFor({ x: 0, y: 0, w: 100, h: 100 }, [F.rectPoly({ x: 60, y: 20, w: 80, h: 30 }, 0), F.rectPoly({ x: 300, y: 300, w: 5, h: 5 }, 0), sq.slice(0, 2)]);
check("holesFor: only obstacles reaching into the frame, clipped to it", holes.length === 1 && Math.max(...holes[0].map((p) => p[0])) === 100 && Math.min(...holes[0].map((p) => p[0])) === 60, holes);
// pctype: paragraph text with a hole lays its lines beside it
const t = { str: "word ".repeat(120).trim(), font: "Arial", size: 10, leading: 1.2, x: 0, y: 0, box: { w: 200, h: 120 }, align: "left" };
const plain = PT.layout(t), wrapped = PT.layout(Object.assign({}, t, { wrapHoles: [[[100, 20], [200, 20], [200, 60], [100, 60]]] }));
const beside = wrapped.lines.filter((l) => !l.over && l.y + 12 > 20 && l.y < 60);
check("pctype: wrapHoles - lines next to the hole stop before it (left of x 100), the others use the whole width", beside.length > 0 && beside.every((l) => l.x + l.w <= 100.5) && wrapped.lines.some((l) => !l.over && l.y >= 60 && l.w > 120) && plain.lines.some((l) => l.y > 20 && l.y < 60 && l.w > 120), beside.slice(0, 3));
const shownWords = (Lo) => Lo.lines.filter((l) => !l.over).reduce((n, l) => n + l.text.split(" ").filter(Boolean).length, 0);
check("pctype: a hole means less text fits (fewer words shown, the rest hidden for the next frame)", shownWords(wrapped) < shownWords(plain) && wrapped.overflow, [shownWords(plain), shownWords(wrapped)]);

const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FL = src("ext/imageeditdock/pcflow.js"), DT = src("ext/imageeditdock/pcdtpout.js"), EXT = JSON.parse(src("ext/imageeditdock/ext.json")), IE = src("ext/imageeditdock/imageedit.js");
check("the first frame holds the story; a later frame typed in goes back into it at its place; reflow after each undo step (E.onPush) and on a page change", /const merged = head\.str\.slice\(0, was\.start\) \+ t\.str \+ head\.str\.slice\(was\.end\)/.test(FL) && /E\.setLayer\(arr\[0\]\.L, "type in frame "/.test(FL) && /t\.str !== t\.flowSet/.test(FL) && /E\.onPush = function/.test(FL) && /const parts = flow\(head\.str, arr\.length/.test(FL));
check("menus: Text Flow: Add Frame Here / on the Next Page / Edit Story… / Unlink Frame, Text Wrap…", ["flow.here", "flow.next", "flow.story", "flow.unlink", "flow.wrap"].every((id) => FL.includes(`C("${id}"`)));
check("the export writes paragraph / linked / wrapped text as real lines (a justified line word by word)", /const plainPara = \(t\) =>/.test(DT) && /para \? paraLines\(t, off\)/.test(DT) && /ln\.gap > 0/.test(DT));
check("pcflow.js loads after pcdtpout.js and is installed after it", EXT.scripts.indexOf("pcflow.js") === EXT.scripts.indexOf("pcdtpout.js") + 1 && IE.indexOf("PCFlow.install(E)") > IE.indexOf("PCDtpOut.install(E)"));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
