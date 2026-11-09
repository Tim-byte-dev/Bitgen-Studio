#!/usr/bin/env node
/* bitGen Studio — 2.735.0 units: the WORDS LIT AS THEY ARE SUNG (static/abcscore.js render(...).timing.words, the SVG's
 * data-w, ext/musicdock/scoreplayer.js wordsAt). Tim (verbatim): "can the words be highlighted as the song is sung?"
 *   - each sung syllable gets a time: from its note to the end of the notes it holds (a tie, the notes of a slur, the
 *     rest of a note carried over the barline); a rest, or a sung note with no syllable left for it, ends it;
 *   - the SVG marks the syllable's <text> data-w = its id (the hyphens are not marked);
 *   - wordsAt(T, tick) -> the syllables being sung at that moment; nothing before / between / after;
 *   - the words clear of each other at the barlines too (the bar makes room);
 *   - no lyrics -> no words, and the notes' timing is the same as before. */
"use strict";
const A = require("../static/abcscore.js");
const P = require("../ext/musicdock/scoreplayer.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const ABC = "X:1\nT:t\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nV:1 name=Vocal\nC D- D (E | F G) z A |]\n";
const R = A.render(ABC, { lyrics: "hel-lo dear world sing" });
const W = R.timing.words;
const q = 480;
check("version 2.735.0", A.version === "2.735.0", A.version);
check("four syllables timed (sing has no note left)", W.length === 4 && W.map((w) => w.s).join(" ") === "hel lo dear world", W);
check("hel: its quarter note", W[0].t0 === 0 && W[0].t1 === q, W[0]);
check("lo: held through its tie (D- D)", W[1].t0 === q && W[1].t1 === 3 * q, W[1]);
check("dear: held through the slur, over the barline (E | F G)", W[2].t0 === 3 * q && W[2].t1 === 6 * q, W[2]);
check("world: after the rest, its own note", W[3].t0 === 7 * q && W[3].t1 === 8 * q, W[3]);
check("ids = places", W.every((w, k) => w.id === k));
const svg = A.toSVG(R.pages[0]);
const marked = (svg.match(/<text[^>]*data-w="(\d+)"[^>]*>([^<]*)<\/text>/g) || []).map((m) => m.replace(/.*data-w="(\d+)"[^>]*>([^<]*)<.*/, "$1:$2"));
check("SVG: each syllable's <text> carries data-w", marked.join(" ") === "0:hel 1:lo 2:dear 3:world", marked);
check("SVG: the hyphen is not marked", /<text[^>]*>-<\/text>/.test(svg) && !/data-w="\d+"[^>]*>-</.test(svg));
const opsW = R.pages[0].ops.filter((o) => o.t === "t" && o.w != null).length;
check("ops: the lyric text ops carry w", opsW === 4, opsW);

const T = R.timing;
const at = (t) => P.wordsAt(T, t).join(",");
check("wordsAt: the first syllable at 0", at(0) === "0");
check("wordsAt: lo lit across the tie", at(q) === "1" && at(2.5 * q) === "1");
check("wordsAt: dear lit across the barline", at(4 * q + 10) === "2" && at(6 * q - 1) === "2");
check("wordsAt: nothing in the rest", at(6.5 * q) === "");
check("wordsAt: world, then nothing after the end / before the start", at(7 * q) === "3" && at(8 * q) === "" && at(-5) === "");

// the words clear of each other, across the barlines too ("world,sing" ran together)
const R5 = A.render("X:1\nM:4/4\nL:1/4\nV: Vocal name=\"Vocal Melody\"\nV: Ins clef=bass name=\"Piano\"\nK:C\nV: Vocal\nC D- D (E|F G) z A|c B A G|]\nV: Ins\nC,4|G,,4|C,4|]\n", { lyrics: "Hel-lo dear world, sing it to me now" });
const tw = R5.pages[0].ops.filter((o) => o.t === "t" && o.w != null).map((o) => ({ s: o.s, l: o.x - A.textWidth(o.s, "TR", 10) / 2, r: o.x + A.textWidth(o.s, "TR", 10) / 2, y: o.y }));
const bump = tw.filter((w, k) => k && tw[k - 1].y === w.y && w.l - tw[k - 1].r < 2.5).map((w, k) => w.s);
check("the words clear of each other, across the barline too (world, | sing)", tw.length === 8 && bump.length === 0, { bump, tw: tw.map((w) => w.s + "@" + Math.round(w.l) + "-" + Math.round(w.r)) });

// a sung note with no syllable for it closes the word before
const R2 = A.render("X:1\nM:4/4\nL:1/4\nK:C\nV:1 name=Vocal\nC D E F|]\n", { lyrics: "one" });
check("a sung note with no syllable ends the word before", R2.timing.words.length === 1 && R2.timing.words[0].t1 === q, R2.timing.words);

// two staves: only the vocal staff's words
const R3 = A.render("X:1\nM:4/4\nL:1/4\nK:C\nV:P name=Piano\nC,4|]\nV:S name=\"Lead Vocal\"\nc2 d2|]\n", { lyrics: "high low" });
check("two staves: the words come from the vocal staff", R3.timing.words.map((w) => w.s + "@" + w.t0 + "-" + w.t1).join(" ") === "high@0-960 low@960-1920", R3.timing.words);

// no lyrics: no words, the notes unchanged
const R4 = A.render(ABC, {});
check("no lyrics: timing.words empty, no data-w", R4.timing.words.length === 0 && !/data-w=/.test(A.toSVG(R4.pages[0])));
check("no lyrics: the notes' timing is the same", JSON.stringify(R4.timing.notes) === JSON.stringify(R.timing.notes));
check("wordsAt copes with a timing that has no words", P.wordsAt({ total: 10 }, 3).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
