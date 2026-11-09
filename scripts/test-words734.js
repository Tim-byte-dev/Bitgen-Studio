#!/usr/bin/env node
/* bitGen Studio — 2.734.0 units: the WORDS under the sheet music (static/abcscore.js syllables / lyricsSections / render's
 * lyrics). Tim (verbatim): "can we add a checkbox in the sheetmusic tab to add the words, add the lyrics of the song that
 * is being worked on in the lyrics input"
 *   - words cut into syllables (English rules of thumb, a CJK character each, punctuation kept on the ends);
 *   - the lyrics' [tag] lines make sections ([verse 2] = a verse);
 *   - one syllable to each sung note of the VOCAL staff (a tied-over note and the notes inside a slur keep the one
 *     before), [verse] -> the score's next % verse, a chorus sung again re-uses its words, no tags = one run;
 *   - the bars widen for the words; the words drawn under the vocal staff below everything on it, a hyphen between the
 *     syllables of a word, nothing on the other staves; the PDF carries them. */
"use strict";
const A = require("../static/abcscore.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const S = (w) => A.syllables(w).join("-");

check("syllables: beau-ti-ful, ta-ble, fa-ther, win-ter, ba-by, sing-er, to-night, ev-ery thing ok", S("beautiful") === "beau-ti-ful" && S("table") === "ta-ble"
  && S("father") === "fa-ther" && S("winter") === "win-ter" && S("baby") === "ba-by" && S("singer") === "sing-er" && S("tonight") === "to-night",
  ["beautiful", "table", "father", "winter", "baby", "singer", "tonight"].map(S));
check("syllables: walk-ing, run-ning, emp-ty, mon-ster, chil-dren, hun-dred, wan-ted, dan-ces; walked / danced / loved stay one",
  ["walking", "running", "empty", "monster", "children", "hundred", "wanted", "dances"].map(S).join(" ") === "walk-ing run-ning emp-ty mon-ster chil-dren hun-dred wan-ted dan-ces"
  && ["walked", "danced", "loved"].every((w) => S(w) === w), ["walking", "running", "empty", "monster", "children", "hundred", "wanted", "dances", "walked", "danced"].map(S));
check("syllables: one-syllable words stay whole (time, loved, night, heart, love, the)", ["time", "loved", "night", "heart", "love", "the", "street"].every((w) => S(w) === w));
check("syllables: punctuation stays on the ends (hel-lo!, \"(oh\", heart,)", S("hello!") === "hel-lo!" && S("(oh") === "(oh" && S("heart,") === "heart," && S("don't") === "don't");
check("syllables: Japanese / Chinese = a character each (愛-し-て-る, 我-爱-你), punctuation joined", S("愛してる") === "愛-し-て-る" && S("我爱你，") === "我-爱-你，");
const L = A.lyricsSections("[Intro]\n\n[verse 1]\nHello my love,\n[chorus] Shine on\n\n[Verse 2]\nAgain\nno tag above");
check("sections: [tag] lines (and a tag before the words) start sections; [verse 1] / [Verse 2] = verse; an empty intro kept by name",
  JSON.stringify(L.map((x) => [x.key, x.syl.map((s) => s.s + (s.end ? "" : "-")).join(" ")])) === JSON.stringify([["intro", ""], ["verse", "Hel- lo my love,"], ["chorus", "Shine on"], ["verse", "A- gain no tag a- bove"]]), L);
check("sections: no tags = one untitled section", A.lyricsSections("one two\nthree").length === 1 && A.lyricsSections("one two\nthree")[0].key === "");

const SCORE = `X:1
M:4/4
L:1/4
V: Vocal name="Vocal Melody"
V: Ins name="Ins Melody"
K:C
% verse
V: Vocal
C D E F|G A B c|
V: Ins
C,4|G,4|
% chorus
V: Vocal
c B A G|F E D C|
V: Ins
Z2|
% verse
V: Vocal
E F G A|z4|
V: Ins
Z2|
% chorus
V: Vocal
c B A G|F E D C|
V: Ins
Z2|
`;
const LY = "[verse]\none two three four five six se-ven eight\n[chorus]\nla la la la so so so so\n[verse]\nnine ten e-le-ven";
const words = (r, vi) => r.pages.flatMap((p) => p.ops.filter((o) => o.t === "t" && o.f === "TR" && o.z === 10 && o.s !== "-").map((o) => o.s));
const R = A.render(SCORE, { lyrics: LY });
const W = words(R);
check("section by section: verse 1 (8 notes, 8 syllables), chorus, verse 2 (4 notes: nine ten e le), the chorus sung again re-uses its words",
  JSON.stringify(W) === JSON.stringify(["one", "two", "three", "four", "five", "six", "se", "ven", "la", "la", "la", "la", "so", "so", "so", "so", "nine", "ten", "e", "le", "la", "la", "la", "la", "so", "so", "so", "so"]), W);
check("result.words: 22 syllables (se-ven and e-le-ven split where typed), 20 of them used, 28 of 28 sung notes worded (the chorus twice), under Vocal Melody, by sections",
  R.words && R.words.syllables === 22 && R.words.used === 20 && R.words.placed === 28 && R.words.notes === 28 && R.words.voice === "Vocal Melody" && R.words.sections, R.words);
const hy = R.pages.flatMap((p) => p.ops.filter((o) => o.t === "t" && o.s === "-")).length;
check("a hyphen between se-ven and e-le-ven's syllables (3 of them), none after a whole word", hy === 3, hy);
const flat = A.render(SCORE.replace(/% (verse|chorus)\n/g, ""), { lyrics: "[verse]\none two three" });
check("no sections in the score = one run from the first note", JSON.stringify(words(flat)) === JSON.stringify(["one", "two", "three"]) && !flat.words.sections, words(flat));
const tie = A.render("X:1\nL:1/4\nK:C\nC D- D E|(F G A) B|]\n", { lyrics: "a b c d e f g" });
check("a tied-over note and the notes inside a slur keep the syllable before: a b c | d . . e", JSON.stringify(words(tie)) === JSON.stringify(["a", "b", "c", "d", "e"]), words(tie));
// placement
const noW = A.render(SCORE), wW = A.render(SCORE, { lyrics: "[verse]\nextraordinarily wonderfully magnificently unbelievable\n[chorus] x" });
const xs = (r) => r.timing.bars.map((b) => Math.round(b.x1 - b.x0));
check("the bars widen for long words (bar 1 wider with 'ex-traor-di-na…' than without)", xs(wW)[0] > xs(noW)[0], [xs(noW), xs(wW)]);
const vocalOps = R.pages[0].ops.filter((o) => o.t === "t" && o.f === "TR" && o.z === 10);
const heads = R.pages[0].ops.filter((o) => o.t === "p" && o.n != null);
const yHead = Math.max.apply(null, heads.filter((o) => R.timing.notes[o.n].v === 0 && R.timing.notes[o.n].bar === 0).map((o) => Math.max.apply(null, o.d.filter((c) => c[0] !== "Z").map((c) => c[c.length - 1]))));
const yW = vocalOps.find((o) => o.s === "one").y;
const insTop = Math.min.apply(null, heads.filter((o) => R.timing.notes[o.n].v === 1 && R.timing.notes[o.n].bar === 0).map((o) => Math.min.apply(null, o.d.filter((c) => c[0] !== "Z").map((c) => c[c.length - 1]))));
check("the words sit under the vocal staff (below its notes), above the Ins staff; centred on their notes", yW > yHead && yW < insTop
  && vocalOps.every((o) => o.a === "m"), { yHead, yW, insTop });
const one = vocalOps.find((o) => o.s === "one"), firstHead = heads.find((o) => o.n === 0);
const hxs = firstHead.d.filter((c) => c[0] !== "Z").map((c) => c[c.length - 2]);
const hx = (Math.min.apply(null, hxs) + Math.max.apply(null, hxs)) / 2;
check("…'one' centred under the first note's head", Math.abs(one.x - hx) < 2.5, { x: one.x, hx });
check("without lyrics nothing changes (no words, result.words null)", noW.words === null && words(noW).length === 0);
const pdf = Buffer.from(A.toPDF(R.pages)).toString("latin1");
check("the PDF carries the words (Times-Roman)", /\(one\) Tj/.test(pdf) && /\(se\) Tj/.test(pdf) && /\/TR 10 Tf/.test(pdf));
const svg = A.toSVG(R.pages[0]);
check("the SVG shows them", />three<\/text>/.test(svg) && />ven<\/text>/.test(svg));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
