#!/usr/bin/env node
/* bitGen Studio — 2.945.0 units: 🎓 LIFE CHOICES - the LAND & HOUSES ring outside the investment ring.
 * Tim: "add another ring on the outside with blocks of land and houses in good condition and houses that need renovation" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/lifedock/lifecore.js");

const E = C.RINGS.estate, types = Object.values(C.ESTATE).map((e) => e[0]);
check("the land & houses ring: 20 squares - 5 blocks of land, 5 good houses, 5 renovators; the land office, 2 builders, council rates, an auction",
  E.length === 20 && types.filter((t) => t === "land").length === 5 && types.filter((t) => t === "good").length === 5 && types.filter((t) => t === "reno").length === 5
  && E[0][0] === "office" && E[4][0] === "builder" && E[16][0] === "builder" && E[8][0] === "council" && E[12][0] === "auction");
check("...renovators cheaper than good houses; land the cheapest", Math.max(...Object.values(C.ESTATE).filter((e) => e[0] === "land").map((e) => e[2])) < Math.min(...Object.values(C.ESTATE).filter((e) => e[0] === "good").map((e) => e[2]))
  && Object.values(C.ESTATE).filter((e) => e[0] === "reno").every((e) => e[2] < 500000));
check("the investment ring's square 14 is the land office (the way out)", C.RINGS.invest[14][0] === "landoff");

function game() {
  const s = C.newGame({ seed: 4, players: [{ name: "Tim" }, { name: "Bot", bot: "saver", skill: 0.7 }] });
  const p = s.players[0]; p.ring = "invest"; p.qual = "trade"; p.open = true; p.paydays = 4; p.cash = 400000;
  p.job = { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 };
  return { s, p };
}
let { s, p } = game();
p.pos = 13; C.roll(s, 1);
check("landing on the land office (stable income): out to the land & houses ring, or stay", s.pending && s.pending.kind === "gate" && s.pending.options.map((o) => o.id).join() === "estate,stay");
C.choose(s, "estate");
check("...out: on the estate ring's land office", p.ring === "estate" && p.pos === 0);
({ s, p } = game()); p.open = false; p.pos = 13; C.roll(s, 1);
check("...not open without a stable income", !s.pending && p.ring === "invest");

({ s, p } = game()); p.ring = "estate"; p.pos = 2; C.roll(s, 1);
const buy = s.pending && s.pending.options[0];
check("landing on a renovator: for sale - says it needs renovating, little rent", s.pending.kind === "buy" && buy.id === "buy:e3" && /needs renovating/.test(s.pending.text) && !buy.off, s.pending);
C.choose(s, "buy:e3");
check("...bought (cash): the Weatherboard renovator is Tim's", s.estate[3].owner === 0 && s.estate[3].type === "reno");
// tenants: good full, reno a little, land none
({ s, p } = game()); s.estate[2].owner = 0; s.estate[3].owner = 1; s.estate[1].owner = 1;
const y = (k) => Math.round(s.estate[k].value * C.YIELD[s.estate[k].type]);
check("tenants each turn: a good house 4.5% a year, a renovator 2%, a block of land nothing", y(2) === Math.round(560000 * 0.045 / 4) && y(3) === Math.round(310000 * 0.02 / 4) && y(1) === 0);
const c0 = p.cash; p.ring = "estate"; p.pos = 2; C.roll(s, 1);
check("another player's renovator: rent 1% of its value", c0 - p.cash === 3100 - Math.round(560000 * 0.045 / 4) + 0 || s.log.some((l) => /pays Bot \$3,100 rent for the Weatherboard renovator/.test(l.t)), s.log.slice(-3));
({ s, p } = game()); s.estate[1].owner = 1; p.ring = "estate"; p.pos = 0; C.roll(s, 1);
check("...another player's block of land: no rent (walks across it)", s.log.some((l) => /walks across Bot's Hilltop block/.test(l.t)));
({ s, p } = game()); s.estate[2].owner = 1; p.ring = "estate"; p.pos = 1; C.roll(s, 1);
check("...another player's good house: rent 2%", s.log.some((l) => /pays Bot \$11,200 rent for the Family home/.test(l.t)));

// works: build on land, renovate a renovator
({ s, p } = game()); s.estate[1].owner = 0; p.ring = "estate"; p.pos = 0; C.roll(s, 1);
const w = C.works(s, "e1");
check("landing on your own block: build a house - $320,000, then worth (land + build) x 1.12", s.pending && s.pending.kind === "works" && s.pending.options[0].id === "build:e1" && w.cost === 320000 && w.after === Math.round((180000 + 320000) * 1.12 / 1000) * 1000, s.pending);
const cb = p.cash; C.choose(s, "build:e1");
check("...built: a good house worth $560,000, the cost paid", s.estate[1].type === "good" && s.estate[1].value === 560000 && cb - p.cash >= 320000 - 30000);
({ s, p } = game()); s.estate[3].owner = 0; s.estate[7].owner = 0; s.estate[2].owner = 0; p.ring = "estate"; p.pos = 3; C.roll(s, 1);
const opts = s.pending && s.pending.options.map((o) => o.id);
check("a builder square: works for your block / renovators only (not your good house)", s.pending.kind === "works" && opts.join() === "reno:e3,reno:e7,done", opts);
const r3 = C.works(s, "e3");
C.choose(s, "reno:e3");
check("...renovate for 25% of the value -> worth 1.5x; the next renovator still offered", s.estate[3].type === "good" && s.estate[3].value === r3.after && r3.cost === 78000 && r3.after === 465000 && s.pending && s.pending.options.map((o) => o.id).join() === "reno:e7,done");
C.choose(s, "done");
check("...Not now ends the turn", !s.pending && C.current(s) !== p);
({ s, p } = game()); p.cash = 30000; s.estate[11].owner = 0; p.ring = "estate"; p.pos = 10; C.roll(s, 1);
const rn = s.pending && s.pending.options[0];
check("works on a loan: 20% from cash, the rest borrowed within 5x the salary", rn && !rn.off && (C.choose(s, rn.id), s.estate[11].type === "good" && p.loan === C.works({ estate: { 11: { type: "reno", value: 420000 } } , props: {} }, "e11").cost - Math.round(105000 * 0.2)), { loan: p.loan });
// council rates, auction
({ s, p } = game()); s.estate[2].owner = 0; s.estate[5].owner = 0; p.ring = "estate"; p.pos = 7; const cc = p.cash; C.roll(s, 1);
check("council rates: 1% of your land and houses out here", s.log.some((l) => /pays \$8,000 council rates/.test(l.t)), s.log.slice(-2));
({ s, p } = game()); p.ring = "estate"; p.pos = 11; C.roll(s, 1);
const au = s.pending && s.pending.options[0];
check("the auction: a free lot at 85%", s.pending && /^Auction: /.test(s.pending.title) && /^buy:e\d+:85$/.test(au.id), s.pending && s.pending.title);
const k = au.id.split(":")[1], full = C.lot(s, k).value, ca = p.cash; C.choose(s, au.id);
check("...bought at 85% of its value", C.lot(s, k).owner === 0 && s.log.some((l) => /at auction/.test(l.t)) && Math.abs((ca - p.cash) - Math.round(full * 0.85)) < 30000);
// net worth, selling, the way back in
({ s, p } = game()); s.estate[6].owner = 0; const nw = C.netWorth(s, p);
check("net worth counts the land & houses", nw === Math.round(p.cash + 690000));
p.ring = "invest"; p.pos = 15; C.roll(s, 1);
check("the bank sells them too", s.pending.kind === "bank" && s.pending.options.some((o) => o.id === "sell:e6"));
C.choose(s, "sell:e6");
check("...sold at 95%", s.estate[6].owner === -1 && s.log.some((l) => /sells the Brick villa for \$655,500/.test(l.t)));
({ s, p } = game()); p.ring = "estate"; p.pos = 19; C.roll(s, 1);
check("the estate's land office: back in to the investment ring", s.pending && s.pending.kind === "gate" && s.pending.options[0].id === "in");
C.choose(s, "in");
check("...in at the investment ring's land office", p.ring === "invest" && p.pos === 14);
({ s, p } = game()); s.estate[13].owner = 0; p.cash = -50000; p.job = null; p.loan = 0; p.ring = "estate"; p.pos = 7; C.roll(s, 1);
check("short of cash: a lot out here is sold for you", s.estate[13].owner === -1 && s.log.some((l) => /has to sell the Acreage/.test(l.t)));
// a game saved before 2.945.0
const old = JSON.parse(JSON.stringify(C.newGame({ seed: 2 }))); delete old.estate;
C.upgrade(old);
check("a game saved by 2.944.0 gets the ring (all 15 lots for sale)", Object.keys(old.estate).length === 15 && Object.values(old.estate).every((e) => e.owner === -1));
// whole bot games
let res = [];
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const g = C.newGame({ seed, players: ["saver", "tycoon", "risk", "saver"].map((b, i) => ({ name: "B" + i, bot: b, skill: 0.5 + 0.1 * i })) });
  let built = 0, n = 0; while (!g.over && n < 40000) { const L = g.log.length, last = g.log[L - 1]; C.botStep(g); n++; const i = g.log.indexOf(last); g.log.slice(i + 1).forEach((l) => { if (/builds a house|renovates the/.test(l.t)) built++; }); }
  res.push({ seed, over: g.over, owned: Object.values(g.estate).filter((e) => e.owner >= 0).length, built, finite: g.players.every((q) => Number.isFinite(q.cash)) });
}
check("whole bot games: the bots buy out here and build / renovate; every game ends, no money goes NaN",
  res.every((r) => r.over && r.finite) && res.some((r) => r.owned > 3) && res.reduce((t, r) => t + r.built, 0) > 3, res);

const J = src("ext/lifedock/lifedock.js"), D = src("ext/lifedock/dock.html");
check("the board: the ring drawn outside (the others a little narrower), its lots coloured by type (🌳 land, 🏡 good, 🏚 renovator), owners and prices",
  /estate: \[0\.835, 0\.985, -90, 270\]/.test(J) && /land: "🌳", good: "🏡", reno: "🏚"/.test(J) && /s\.estate\[q\.i\]\.type : q\.kind/.test(J) && /"LAND & HOUSES"/.test(J));
check("...hover a lot: its kind, worth, owner and what building / renovating costs and makes", /Renovate" \) \+ ": "|\(e\.type === "land" \? "Build" : "Renovate"\)/.test(J));
check("old saves upgraded on load; How to play explains the ring", /C\.upgrade\(j\)/.test(J) && /The land &amp; houses ring/.test(D));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
