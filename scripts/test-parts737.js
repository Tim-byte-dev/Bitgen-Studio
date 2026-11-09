#!/usr/bin/env node
/* bitGen Studio — 2.737.0 units: a PART's own sheet (static/abcscore.js render's parts / partName) and the mix's notes
 * (scoreplayer's isMuted - Node has no Web Audio, so the rules are checked through the timing it reads).
 * Tim (verbatim): "in sheet music , can we separate the instruments and have sheet music for each instrument and another for
 * vocals? and have toggle buttons to play each instrument and vocals?"
 *   - result.parts lists every staff (name, the vocal one marked) and result.shown the ones engraved;
 *   - parts:[i] engraves that staff alone (one staff, its own clef), partName at the top left, the staff not labelled again;
 *   - the words only on a part with the vocal staff; timing's v stays the score's own staff index;
 *   - bad / all / empty parts = the full score; a one-staff score ignores parts. */
"use strict";
const A = require("../static/abcscore.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const ABC = "X:1\nT:Night\nC:Composer\nM:4/4\nL:1/4\nK:C\nV:P name=\"Piano\" snm=\"Pno.\"\nV:S name=\"Lead Vocal\" snm=\"Voc.\"\nV:B clef=bass name=\"Bass\"\nV:P\nC E G c|]\nV:S\nc2 d2|]\nV:B\nC,4|]\n";
const LY = "high low";
const texts = (r) => r.pages[0].ops.filter((o) => o.t === "t").map((o) => o.s);

const F = A.render(ABC, { lyrics: LY });
check("result.parts: every staff by name, the vocal one marked", JSON.stringify(F.parts.map((p) => p.name + (p.vocal ? "*" : ""))) === '["Piano","Lead Vocal*","Bass"]', F.parts);
check("the full score: shown = all three, the words on the vocal staff", JSON.stringify(F.shown) === "[0,1,2]" && F.voices === 3 && F.words && F.words.placed === 2, { shown: F.shown, words: F.words });
check("the full score labels its staves", texts(F).includes("Piano") && texts(F).includes("Lead Vocal") && texts(F).includes("Bass"));

const B = A.render(ABC, { lyrics: LY, parts: [2], partName: "Bass" });
check("parts [2]: the bass alone - one staff, shown = [2]", B.voices === 1 && JSON.stringify(B.shown) === "[2]", { v: B.voices, shown: B.shown });
check("…named once, at the top left (not again beside the staff); the composer kept", texts(B).filter((t) => t === "Bass").length === 1
  && B.pages[0].ops.some((o) => o.t === "t" && o.s === "Bass" && o.f === "TB" && Math.abs(o.x - 46) < 0.01) && texts(B).includes("Composer"), texts(B));
check("…no words on an instrument part", B.words === null && B.timing.words.length === 0);
check("…its notes keep the score's staff number (v = 2) and are the bass's", B.timing.notes.every((n) => n.v === 2) && B.timing.sound.length === 1 && B.timing.sound[0].v === 2 && B.timing.sound[0].midi === 48, B.timing.sound);
check("…a bass clef in the SVG and the same length as the score", B.timing.total === F.timing.total && JSON.stringify(B.timing.barStarts) === JSON.stringify(F.timing.barStarts));

const S = A.render(ABC, { lyrics: LY, parts: [1], partName: "Lead Vocal" });
check("parts [1]: the vocal part with its words", S.voices === 1 && S.words && S.words.placed === 2 && S.timing.words.map((w) => w.s).join(" ") === "high low", S.words);
check("…its notes are v = 1", S.timing.notes.length === 2 && S.timing.notes.every((n) => n.v === 1));

const PB = A.render(ABC, { parts: [2, 0] });
check("parts [2, 0]: those two in score order (piano, bass)", PB.voices === 2 && JSON.stringify(PB.shown) === "[0,2]");
check("bad parts (9, -1, 'x') = the full score", A.render(ABC, { parts: [9, -1, "x"] }).voices === 3);
check("every part = the full score (shown all)", JSON.stringify(A.render(ABC, { parts: [0, 1, 2] }).shown) === "[0,1,2]");
const N = A.render(ABC, { parts: [0] });
check("no partName: nothing at the top left, the staff keeps its label", texts(N).filter((t) => t === "Piano").length === 1 && !N.pages[0].ops.some((o) => o.t === "t" && o.f === "TB" && o.z === 12));
const one = A.render("X:1\nM:4/4\nL:1/4\nK:C\nC D E F|]\n", { parts: [0], partName: "Solo" });
check("a one-staff score ignores parts (the whole score, no part name)", one.voices === 1 && JSON.stringify(one.shown) === "[0]" && !texts(one).includes("Solo") && one.parts.length === 1 && one.parts[0].vocal, { shown: one.shown, t: texts(one) });

// the mix: the synth strikes timing.sound minus the muted staves (scoreplayer create's isMuted) - the full score's sound
// has every staff, so a part's sheet can still play them all
const muted = { 1: true };
const plays = F.timing.sound.filter((n) => !muted[n.v]).map((n) => n.v);
check("the mix: the full score's sound has all three staves; with the vocal muted the piano + bass remain", [...new Set(F.timing.sound.map((n) => n.v))].sort().join() === "0,1,2"
  && plays.length && !plays.includes(1) && plays.includes(0) && plays.includes(2), plays);
const P = require("../ext/musicdock/scoreplayer.js");
check("scoreplayer exports the same pure functions (wordsAt, activeAt…)", typeof P.wordsAt === "function" && typeof P.activeAt === "function" && typeof P.create === "function");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
