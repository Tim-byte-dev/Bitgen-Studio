#!/usr/bin/env node
/* bitGen Studio — 2.948.0 units: 🎓 LIFE CHOICES - shared housing and housemate luck.
 * Tim: "people can choose to get shared housing, but the roll of the dice can also affect their luck with the housemates" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const MN = require("../ext/lifedock/lifemoney.js"), C = require("../ext/lifedock/lifecore.js");
function settle(s) { for (let k = 0; k < 20 && s.pending; k++) { if (s.pending.type === "puzzle") C.answer(s, false); else C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id); } }
function worker(o) {
  const s = C.newGame({ seed: 3, players: [{ name: "Tim" }, { name: "Bot", bot: "saver" }] });
  const p = s.players[0]; Object.assign(p, { ring: "jobs", pos: 0, qual: "trade", cash: 50000, job: { id: "electrician", title: "Electrician", salary: 88000, level: 1, levels: 4 } }, o || {});
  return { s, p };
}
check("housing: rent on your own ($4,200 + $900 bills a quarter) or share a house (about half: $2,300 + $450)",
  MN.HOUSING.alone[1] === 4200 && MN.HOUSING.alone[2] === 900 && MN.HOUSING.share[1] === 2300 && MN.HOUSING.share[2] === 450);
const a = MN.bills({ housing: "alone" }, {}, false, 0), sh = MN.bills({ housing: "share" }, {}, false, 0), own = MN.bills({ housing: "share" }, {}, true, 0);
check("...the bills follow it; an owner pays no rent and full utilities whatever the choice", a.rent === 4200 && a.utilities === 900 && sh.rent === 2300 && sh.utilities === 450 && own.rent === 0 && own.utilities === 900 && a.total - sh.total === 2350);
check("housemate luck for every level but the ordinary 6-8: bad at 2-5 (money and/or ❤), good at 9-12",
  [2, 3, 4, 5].every((l) => MN.HOUSEMATE[l][2] < 0) && [9, 10, 11, 12].every((l) => MN.HOUSEMATE[l][2] > 0) && [6, 7, 8].every((l) => !MN.HOUSEMATE[l]) && /owing rent/.test(MN.HOUSEMATE[2][0]) && /best friend/.test(MN.HOUSEMATE[12][0]));
let { s, p } = worker();
check("everyone starts renting on their own; savers and tycoons share (to save)", p.budget.housing === "alone" && s.players[1].budget.housing === "share");
C.setBudget(s, p, { housing: "share" });
check("choosing a share house (said in the log)", p.budget.housing === "share" && /moves into a share house/.test(s.log.slice(-1)[0].t));
const c0 = p.cash, w0 = p.wellbeing; C.roll(s, 1, 1);
check("double 1 while sharing: the main bad luck AND a housemate leaving owing rent (-$1,500, ❤ -3)", s.luck.house && /owing rent/.test(s.luck.house.text) && s.luck.house.amount === -1500 && s.luck.house.wb === -3 && /car is written off/.test(s.luck.text) && /🏘 Tim: A housemate moves out/.test(s.log.map((l) => l.t).join("|")));
({ s, p } = worker()); C.setBudget(s, p, { housing: "share" }); const w1 = p.wellbeing; C.roll(s, 5, 6);
check("11 while sharing: movie nights with great housemates (❤ +3)", s.luck.house && /Movie nights/.test(s.luck.house.text) && p.wellbeing === w1 + 3);
({ s, p } = worker()); C.setBudget(s, p, { housing: "share" }); C.roll(s, 3, 4);
check("an ordinary 7: nothing from the housemates", !s.luck.house);
({ s, p } = worker()); C.roll(s, 1, 1);
check("living alone: no housemate luck", !s.luck.house);
({ s, p } = worker({ ring: "invest", pos: 4, open: true })); C.setBudget(s, p, { housing: "share" }); s.props[2].owner = 0; C.roll(s, 1, 1);
check("an owner lives in their own place: no housemates, no rent", !s.luck.house && MN.sharing(p.budget, C.ownsHome(s, p)) === false);
({ s, p } = worker({ ring: "hs", job: null })); p.budget.housing = "share"; C.roll(s, 1, 1);
check("at school: no housemate luck (you live at home)", !s.luck.house);
({ s, p } = worker()); C.setBudget(s, p, { housing: "share" }); C.roll(s, 2); settle(s);
check("a quarter while sharing: rent $2,300 and bills $450 on the itemised list", p.lastBills.rent === 2300 && p.lastBills.utilities === 450);
const old = JSON.parse(JSON.stringify(C.newGame({ seed: 1 }))); old.players.forEach((q) => { delete q.budget.housing; }); C.upgrade(old);
check("older saves: rent on your own", old.players[0].budget.housing === "alone");
let ok = true;
for (const seed of [1, 2, 3]) { const g = C.newGame({ seed, players: ["saver", "tycoon", "risk"].map((b) => ({ name: b, bot: b })) }); let n = 0; while (!g.over && n < 40000) { C.botStep(g); n++; } if (!g.over || g.players.some((q) => !Number.isFinite(q.cash) || !(q.wellbeing >= 0 && q.wellbeing <= 100))) ok = false; }
check("whole bot games finish; wellbeing stays 0-100", ok);
const J = src("ext/lifedock/lifedock.js"), D = src("ext/lifedock/dock.html");
check("the docker: Housing in 💸 Budget (greyed for owners), housemate luck under the dice, How to play", /id=\\"lcHousing\\"/.test(J) && /You live in a place you own/.test(J) && /"<br>🏘 " \+ esc\(L\.house\.text\)/.test(J) && /🏘 Share a house for about half the rent/.test(D));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
