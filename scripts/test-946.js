#!/usr/bin/env node
/* bitGen Studio — 2.946.0 units: 🎓 LIFE CHOICES - a pair of dice every turn: the total is the turn's LUCK (2 - 12), double 6
 * rolls again; inside the first die moves you, on the investment rings the pair's total does.
 * Tim: "user gets to roll a pair of dice this dictates their luck. 1-12 levels of luck 12 gets to roll again. luck will
 * include bad luck from double 1, to very good luck double 6, in high school luck would be finding money, getting gifts
 * etc. when moved to the investment layer, players avatar will move with the dice roll and include the luck features" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/lifedock/lifecore.js");
const g = (o) => { const s = C.newGame({ seed: 5, players: [{ name: "Tim" }, { name: "Bot", bot: "saver" }] }); Object.assign(s.players[0], o || {}); return { s, p: s.players[0] }; };
const work = { ring: "jobs", qual: "trade", open: true, paydays: 3, job: { id: "plumber", title: "Plumber", salary: 84000, level: 1, levels: 4 } };

check("luck tables for each stage of life: school, work, money - bad at 2-5, nothing at 6-8, good at 9-12",
  ["school", "work", "money"].every((st) => [2, 3, 4, 5].every((l) => C.LUCK[st][l][1] < 0) && [6, 7, 8].every((l) => !C.LUCK[st][l]) && [9, 10, 11, 12].every((l) => C.LUCK[st][l][1] > 0)));
check("...bigger with the stage: school < work < money (double 6 and double 1)", C.LUCK.school[12][1] < C.LUCK.work[12][1] && C.LUCK.work[12][1] < C.LUCK.money[12][1] && C.LUCK.school[2][1] > C.LUCK.work[2][1] && C.LUCK.work[2][1] > C.LUCK.money[2][1]);
check("...words for every level: double 1 = terrible luck, 6-8 ordinary, double 6 = brilliant luck", C.LUCKWORD[2] === "terrible luck" && C.LUCKWORD[7] === "an ordinary few months" && C.LUCKWORD[12] === "brilliant luck" && Object.keys(C.LUCKWORD).length === 11);

let { s, p } = g();
C.roll(s, 4, 6);
check("high school: 4 + 6 = 10 - a birthday gift (+$150); the FIRST die moves you (4 squares)", s.luck.level === 10 && /birthday gift/.test(s.luck.text) && p.cash === 650 && p.pos === 4 && s.luck.who === 0, { luck: s.luck, cash: p.cash, pos: p.pos });
({ s, p } = g({ cash: 100 })); C.roll(s, 1, 1);
check("...double 1 at school: terrible luck - never takes more than you have", s.luck.level === 2 && /bike is stolen/.test(s.luck.text) && p.cash === 0 && s.luck.amount === -100);
({ s, p } = g()); C.roll(s, 2, 5);
check("...7: an ordinary few months, nothing happens", s.luck.level === 7 && !s.luck.text && p.cash === 500);
({ s, p } = g(work)); p.pos = 0; const c0 = p.cash; C.roll(s, 5, 6);
check("the jobs ring: 11 - a scratch-card win (+$5,000); moved by the first die", /scratch-card/.test(s.luck.text) && p.pos === 5 && s.log.some((l) => /\+\$5,000/.test(l.t)));
({ s, p } = g(Object.assign({}, work, { ring: "invest", pos: 0 }))); C.roll(s, 2, 3);
check("the investment ring: the pair's TOTAL moves you (2 + 3 = 5 squares) - with the luck", p.pos === 5 && s.luck.level === 5 && /Car repairs/.test(s.luck.text));
({ s, p } = g(Object.assign({}, work, { ring: "estate", pos: 0 }))); C.roll(s, 4, 5);
check("...the land & houses ring too (4 + 5 = 9 squares)", p.pos === 9 && s.luck.level === 9 && /Interest on your savings/.test(s.luck.text));
({ s, p } = g(Object.assign({}, work, { ring: "invest", pos: 4 }))); s.estate[18].owner = 0; C.roll(s, 1, 1);
check("double 1 with property: a storm damages your dearest place (5% of its value, at least $20,000)", /storm damages your Beach house/.test(s.luck.text) && s.luck.amount === -49000, s.luck);
({ s, p } = g(Object.assign({}, work, { ring: "invest", pos: 4 }))); s.props[2].owner = 0; C.roll(s, 1, 2);
check("...3 with property: a tenant leaves owing rent (2%, at least $8,000)", /tenant leaves owing rent/.test(s.luck.text) && s.luck.amount === -8000);
({ s, p } = g(Object.assign({}, work, { ring: "invest", pos: 4 }))); C.roll(s, 1, 1);
check("...double 1 without property: the car written off", /car is written off/.test(s.luck.text) && s.luck.amount === -12000);

// double 6: roll again (the same player, one quarter of life for both rolls)
({ s, p } = g(Object.assign({}, work, { ring: "invest", pos: 0 }))); p.cash = 1000000;
const age = p.age; C.roll(s, 6, 6);
if (s.pending) C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id);
check("double 6: brilliant luck (a lottery win, +$75,000) and the same player rolls again", s.luck.level === 12 && /lottery/.test(s.luck.text) && C.current(s) === p && s.phase === "roll" && !s.pending && s.log.some((l) => /rolls again/.test(l.t)));
check("...the extra roll is the same three months (no ageing in between)", p.age === age);
C.roll(s, 2, 2); if (s.pending) C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id);
check("...after the second roll the turn ends (aged a quarter, the next player)", p.age === age + 0.25 && C.current(s) !== p);
({ s, p } = g()); C.roll(s, 6, 6);
check("...at school too: a bursary and a roll again (after the puzzle)", /bursary/.test(s.luck.text) && s.pending && s.pending.type === "puzzle");
C.answer(s, true);
check("...then rolls again", C.current(s) === p && !s.pending && s.phase === "roll");
check("the apprenticeship: rolls for luck, still one square", (() => { const r = g({ ring: "trade", pos: 2 }); C.roll(r.s, 5, 5); return r.p.pos === 3 && r.s.luck.level === 10; })());
check("each player keeps their own last roll (shown while the bots play)", (() => { const r = g(); C.roll(r.s, 2, 5); return r.p.lastLuck && r.p.lastLuck.level === 7 && r.p.lastLuck.dice.join() === "2,5"; })());
check("roll(s, n) with one number = a plain move (no luck) - the older tests' moves", (() => { const r = g(); C.roll(r.s, 3); return r.p.pos === 3 && !r.s.luck; })());

// the dice are fair and whole games still finish
const counts = {}; const t = C.newGame({ seed: 77, players: [{ name: "A", bot: "risk" }, { name: "B", bot: "tycoon" }, { name: "C", bot: "saver" }] });
let n = 0; while (!t.over && n < 40000) { const before = t.luck; C.botStep(t); if (t.luck && t.luck !== before) counts[t.luck.level] = (counts[t.luck.level] || 0) + 1; n++; }
const tot = Object.values(counts).reduce((a, b) => a + b, 0);
check("bots roll the pair too: the totals spread like two dice (7 the most common, 2 and 12 rare); the game ends",
  t.over && tot > 300 && Object.keys(counts).length === 11 && counts[7] > counts[2] * 3 && counts[7] > counts[12] * 3 && t.players.every((q) => Number.isFinite(q.cash)), counts);

const J = src("ext/lifedock/lifedock.js"), D = src("ext/lifedock/dock.html");
check("the docker: the dice (⚀-⚅), the roll's luck and a 2-12 luck meter; your own last roll stays in view; the dice tumble for a moment",
  /id="lcDice"/.test(D) && /FACE = \["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"\]/.test(J) && /function meter\(lv\)/.test(J) && /\(many \? esc\(me\.name\) \+ "'s" : "Your"\) \+ " last roll: "/.test(J) /* 2.964.0: whose, with several people */ && /function doRoll\(\)/.test(J) && /diceView\(true\)/.test(J));
check("...🎲 Roll the dice; double six says roll again; How to play explains luck", /🎲 Roll the dice/.test(J) && /Double six - roll again/.test(J) && /<b>Luck<\/b>: every turn you roll a pair of dice/.test(D));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
