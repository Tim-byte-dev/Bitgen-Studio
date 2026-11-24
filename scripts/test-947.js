#!/usr/bin/env node
/* bitGen Studio — 2.947.0 units: 🎓 LIFE CHOICES - bills, the budget, insurance and Australian tax (ext/lifedock/lifemoney.js).
 * Tim: "make insurance plans, bills (utilities, food, entertainment) going to a cinema is different price from going on a
 * picnic etc. life expenses. user can choose to buy health insurance or house insurance or car insurance. if it is
 * reasonable in this build we could add taxes and deductions (use au tax scale)" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const MN = require("../ext/lifedock/lifemoney.js"), C = require("../ext/lifedock/lifecore.js");

// the scale (2026-27, resident) - the published worked examples: $50,000 -> $5,520; $100,000 -> $20,520
check("2026-27 resident scale: nil to $18,200, 15% to $45,000 ($4,020), 30% to $135,000 ($31,020), 37% to $190,000 ($51,370), 45% above",
  MN.incomeTax(18200) === 0 && MN.incomeTax(45000) === 4020 && MN.incomeTax(135000) === 31020 && MN.incomeTax(190000) === 51370 && MN.incomeTax(200000) === 55870 && MN.YEAR === "2026-27");
check("...the published examples: $50,000 pays $5,520, $100,000 pays $20,520 (before the Medicare levy)", MN.incomeTax(50000) === 5520 && MN.incomeTax(100000) === 20520);
check("low income tax offset: $700 to $37,500, tapering to nothing at $66,667", MN.lito(30000) === 700 && MN.lito(41250) === 513 && MN.lito(45000) === 325 && MN.lito(66667) === 0 && MN.lito(90000) === 0);
check("Medicare levy 2%; the surcharge without hospital cover (2026-27 singles: 1% over $105,000, 1.25% over $123,000, 1.5% over $164,000)",
  MN.taxOn(60000, false).medicare === 1200 && MN.taxOn(100000, false).surcharge === 0 && MN.taxOn(110000, false).surcharge === 1100 && MN.taxOn(130000, false).surcharge === 1625
  && MN.taxOn(200000, false).surcharge === 3000 && MN.taxOn(200000, true).surcharge === 0);
const t60 = MN.taxOn(60000, false);
check("...a $60,000 year: tax $8,520 - offset $100 + Medicare $1,200 = $9,620", t60.tax === 8520 && t60.offset === 100 && t60.total === 9620);
check("PAYG: a quarter of the year's tax on the salary after the $1,000 standard deduction", MN.withholding(88000, false) === Math.round(MN.taxOn(87000, false).total / 4) && MN.STD_DEDUCTION === 1000);

// the budget
check("food and fun choices with different prices: a picnic costs less than the cinema, the cinema less than concerts, a holiday most",
  MN.FUN.picnic[1] < MN.FUN.cinema[1] && MN.FUN.cinema[1] < MN.FUN.gigs[1] && MN.FUN.gigs[1] < MN.FUN.travel[1] && MN.FOOD.home[1] < MN.FOOD.mix[1] && MN.FOOD.mix[1] < MN.FOOD.out[1]);
const b1 = MN.bills({ food: "home", fun: "picnic" }, {}, false, 0), b2 = MN.bills({ food: "out", fun: "travel" }, { health: true, car: true, home: true }, true, 500000);
check("a quarter's bills itemised: rent (none once you own a place), utilities, phone, getting around, food, fun, insurance",
  b1.rent === 4200 && b1.utilities === 900 && b1.food === 1500 && b1.fun === 150 && b1.insurance === 0 && b1.total === 4200 + 900 + 250 + 650 + 1500 + 150
  && b2.rent === 0 && b2.insurance === 650 + 320 + 500 && b2.total === 900 + 250 + 650 + 3900 + 2800 + 1470, { b1, b2 });
check("home cover: 0.1% of what you own a quarter, contents only ($150) while renting", MN.premium("home", 0) === 150 && MN.premium("home", 800000) === 800);
check("insured = only the excess (never more than the bill)", MN.covered("car", { car: true }, 12000) === 800 && MN.covered("car", { car: false }, 12000) === 12000 && MN.covered("health", { health: true }, 300) === 300);

// in the game
function settle(s) { for (let k = 0; k < 20 && s.pending; k++) { if (s.pending.type === "puzzle") C.answer(s, false); else C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id); } }
function worker(o) {
  const s = C.newGame({ seed: 3, players: [{ name: "Tim" }, { name: "Bot", bot: "saver" }] });
  const p = s.players[0]; Object.assign(p, { ring: "jobs", pos: 0, qual: "trade", cash: 50000, job: { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 } }, o || {});
  return { s, p };
}
let { s, p } = worker();
check("every player starts with a budget, no cover and wellbeing 50; the bots' budgets fit their personality",
  p.budget.food === "mix" && p.budget.fun === "cinema" && !p.ins.health && p.wellbeing === 50 && s.players[1].budget.fun === "picnic");
let c0 = p.cash; C.roll(s, 2); settle(s);       // the overtime square ... whatever it is, then the quarter
const q = s.log.map((l) => l.t).join("|");
const expectPay = 22000 - MN.withholding(88000, false), bills = MN.bills(p.budget, p.ins, false, 0).total;
check("a working quarter: pay less PAYG tax, then the bills (rent, utilities, food, fun ...); recorded for the tax return",
  p.lastBills && p.lastBills.total === bills && p.fy.salary === 22000 && p.fy.withheld === MN.withholding(88000, false), { bills: p.lastBills, fy: p.fy });
check("...fun keeps wellbeing: the cinema +1.5, less the quarter's 1", p.wellbeing === 50.5);
({ s, p } = worker()); C.setBudget(s, p, { fun: "travel", food: "out" }); C.setCover(s, p, "health", true);
check("your choices: food, fun and cover set on your turn (said in the log)", p.budget.fun === "travel" && p.budget.food === "out" && p.ins.health && /takes out health/.test(s.log.slice(-1)[0].t));
({ s, p } = worker({ ring: "invest", pos: 4, open: true })); C.roll(s, 1, 1);
check("bad luck without cover: the car written off costs it all", /car is written off - not insured/.test(s.luck.text) && s.luck.amount === -12000);
({ s, p } = worker({ ring: "invest", pos: 4, open: true })); C.setCover(s, p, "car", true); C.roll(s, 1, 1);
check("...with car cover: only the $800 excess", /insured, you pay the excess/.test(s.luck.text) && s.luck.amount === -800);
({ s, p } = worker({ ring: "invest", pos: 4, open: true })); C.setCover(s, p, "health", true); C.roll(s, 1, 3);
check("health cover: a stay in hospital costs the $500 excess", /hospital/.test(s.luck.text) && s.luck.amount === -500);
({ s, p } = worker({ ring: "invest", pos: 4, open: true })); s.estate[18].owner = 0; C.setCover(s, p, "home", true); C.roll(s, 1, 1);
check("home cover: a storm on your property costs the $1,000 excess", /storm damages your Beach house - insured/.test(s.luck.text) && s.luck.amount === -1000);
// a year: the tax return on the birthday
({ s, p } = worker({ age: 25 }));
for (let i = 0; i < 4; i++) { while (C.current(s) !== p) C.botStep(s); C.roll(s, 1); settle(s); }
const T = p.lastTax;
check("each birthday: a tax return - salary taxed on the scale (standard deduction), less what was withheld -> a refund or a bill",
  T && T.age === 26 && T.income === 88000 && T.deductions === 1000 && T.taxable === 87000 && T.tax === MN.taxOn(87000, false).total && T.refund === T.withheld - T.tax && /tax return/.test(s.log.map((l) => l.t).join("|")), T);
({ s, p } = worker({ age: 25, ring: "invest", pos: 0, open: true, loan: 400000 })); s.props[8].owner = 0;
for (let i = 0; i < 4; i++) { while (C.current(s) !== p) C.botStep(s); p.pos = 0; C.roll(s, 4); settle(s); }
check("deductions: interest on a loan with rental property (and its rates) beat the standard deduction - rent is income",
  p.lastTax && p.lastTax.deductions > 20000 && p.lastTax.income > 88000, p.lastTax);
({ s, p } = worker({ age: 25, job: { id: "doctor", title: "Doctor", salary: 162000, level: 1, levels: 5 } }));
for (let i = 0; i < 4; i++) { while (C.current(s) !== p) C.botStep(s); C.roll(s, 1); settle(s); }
const noCover = p.lastTax.surcharge;
({ s, p } = worker({ age: 25, job: { id: "doctor", title: "Doctor", salary: 162000, level: 1, levels: 5 } })); C.setCover(s, p, "health", true);
for (let i = 0; i < 4; i++) { while (C.current(s) !== p) C.botStep(s); C.roll(s, 1); settle(s); }
check("a $162,000 doctor without hospital cover pays the Medicare levy surcharge (1.25%); with it, none", noCover === Math.round(161000 * 0.0125) && p.lastTax.surcharge === 0, { noCover, with: p.lastTax.surcharge });
({ s, p } = worker({ job: null })); C.roll(s, 2); settle(s);
check("out of work: a jobseeker payment, the bills still come", p.lastBills && s.players[0].fy.salary === 0);
check("the score counts wellbeing: $2,000 a point from 50", (() => { const r = worker(); r.p.wellbeing = 60; return C.score(r.s, r.p) === C.netWorth(r.s, r.p) + (r.p.iq - 100) * 1000 + 30000 + 20000; })());
const old = JSON.parse(JSON.stringify(C.newGame({ seed: 1 }))); old.players.forEach((q) => { delete q.budget; delete q.ins; delete q.wellbeing; delete q.fy; });
C.upgrade(old);
check("a game saved before 2.947.0 gets budgets, cover (none) and wellbeing", old.players.every((q) => q.budget && q.ins && q.wellbeing === 50 && q.fy));
let ok = true;
for (const seed of [1, 2, 3, 4]) { const g = C.newGame({ seed, players: ["saver", "tycoon", "risk"].map((b) => ({ name: b, bot: b })) }); let n = 0; while (!g.over && n < 40000) { C.botStep(g); n++; } if (!g.over || g.players.some((q) => !Number.isFinite(q.cash) || !Number.isFinite(q.wellbeing))) ok = false; }
check("whole bot games still finish, nothing NaN", ok);

const J = src("ext/lifedock/lifedock.js"), D = src("ext/lifedock/dock.html");
check("the docker: 💸 Budget, 🛡 insurance and tax on your turn - food, fun, the three covers with premium and excess, last quarter's bills, the last tax return; ❤ in the players' table",
  /function moneyPanel\(b, s, p\)/.test(J) && /id=\\"lcFood\\"/.test(J) && /id=\\"lcFun\\"/.test(J) && /data-cover/.test(J) && /Last quarter's bills/.test(J) && /🧾 Tax return at/.test(J) && /<th title=\\"Wellbeing\\">❤<\/th>/.test(J));
check("lifemoney.js loads first; How to play explains bills, insurance and tax (a game's tax, not tax advice)",
  JSON.parse(src("ext/lifedock/ext.json")).scripts[0] === "lifemoney.js" && /<b>Bills, insurance and tax<\/b>/.test(D) && /not tax advice/.test(D));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
