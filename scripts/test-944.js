#!/usr/bin/env node
/* bitGen Studio — 2.944.0 units: 🎓 LIFE CHOICES stage 1 - the rules (ext/lifedock/lifecore.js), the puzzles (lifepuzzles.js),
 * the high scores (lifeserver.js) and the wiring.
 * Tim: "can we add 1 more game ... a game of life similar to monopoly. but start from highschool, with quizes, math puzzles,
 * word puzzles, earn money for puzzles. your iq grows ..." + "lets call it life choices ..." + "make the quizes at least grade
 * 12 level". Stage 1 = you vs 1-5 bots on one PC; the board 2D (Tim picked it); the rules as proposed (Tim: yes). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/lifedock/lifecore.js"), P = require("../ext/lifedock/lifepuzzles.js"), SV = require("../ext/lifedock/lifeserver.js");
const seeded = (x) => () => { x = (x * 16807) % 2147483647; return x / 2147483647; };

/* ---------------- puzzles ---------------- */
const R = seeded(11);
let bad = [], wrongOk = [], kinds = {};
for (let i = 0; i < 2500; i++) for (const lv of ["hs", "college", "trade", "work"]) for (const t of ["math", "word", "quiz"]) {
  const p = P.make(lv, t, R); kinds[lv + ":" + t + ":" + p.kind] = 1;
  if (!p.q || !P.check(p, String(p.answer)) || !(p.secs > 30)) bad.push(p);
  const wrong = p.kind === "choice" ? p.choices.find((c) => c !== p.answer) : p.kind === "number" ? String(p.answer + 1) : p.kind === "fraction" ? "999/1000" : p.answer + "x";
  if (P.check(p, wrong)) wrongOk.push([p.q, wrong]);
  if (p.kind === "choice" && (p.choices.length !== 4 || new Set(p.choices).size !== 4 || !p.choices.includes(p.answer))) bad.push(p);
  if (typeof p.answer === "number" && !Number.isFinite(p.answer)) bad.push(p);
}
check("10,000 puzzles on every ring and topic: each has a question, its own answer checks right, a wrong one checks wrong", !bad.length && !wrongOk.length, { bad: bad.slice(0, 2), wrongOk: wrongOk.slice(0, 2) });
check("...maths answers typed, words typed, quizzes and meanings as 4 choices", ["hs:math:number", "hs:math:fraction", "college:math:number", "college:math:fraction", "trade:math:number", "hs:word:word", "hs:word:choice", "college:quiz:choice"].every((k) => kinds[k]), Object.keys(kinds));
const mk = (kind, answer, tol) => ({ kind, answer, tol });
check("answers: $ and commas in numbers, a tolerance for measurements, fractions by value (10/20 = 1/2), words in any case",
  P.check(mk("number", 1210), "$1,210") && P.check(mk("number", 14.7, 0.01), "14.70") && !P.check(mk("number", 14.7, 0.01), "14.8") && P.check(mk("fraction", "1/2"), "10/20")
  && !P.check(mk("fraction", "1/2"), "1/3") && P.check(mk("fraction", "3"), "3") && P.check(mk("word", "molecule"), " MoLeCuLe ") && !P.check(mk("number", 5), "five") && !P.check(null, "1"));
// independent checks of the generated maths (worked out again here from the numbers in the question)
let mBad = [];
for (let i = 0; i < 400; i++) {
  const q = P.MATH.hs[0](R); const m = q.q.match(/x² ([-+]) (\d+)x ([-+]) (\d+) = 0|x² ([-+]) (\d+) = 0|x² ([-+]) (\d+)x = 0|x² = 0/);
  const r = q.answer; let b = 0, c = 0;
  const t = q.q.replace("Solve ", "").split(" = 0")[0].replace(/\s/g, "");
  const mm = t.match(/^x²(?:([-+]\d*)x)?([-+]\d+)?$/); if (mm) { b = mm[1] == null ? 0 : mm[1] === "+" ? 1 : mm[1] === "-" ? -1 : Number(mm[1]); c = mm[2] == null ? 0 : Number(mm[2]); }
  if (!mm || r * r + b * r + c !== 0 || (b * b - 4 * c) < 0 || r < (-b) / 2) mBad.push(q.q + " -> " + r);
  const g = P.MATH.hs[5](R), s = Number(g.q.match(/total is (\d+)/)[1]); let n = 0; for (let a = 1; a <= 6; a++) for (let d = 1; d <= 6; d++) if (a + d === s) n++;
  if (!P.check(g, n + "/36")) mBad.push(g.q);
  const h = P.MATH.college[4](R), mt = h.q.match(/(\d+)\^(\d+) mod (\d+)/), base = BigInt(mt[1]), e = BigInt(mt[2]), md = BigInt(mt[3]);
  if (Number(base ** e % md) !== h.answer) mBad.push(h.q);
  const k = P.MATH.college[6](R), N = Number(k.q.match(/\+ (\d+)²\?/)[1]); let sq = 0; for (let j = 1; j <= N; j++) sq += j * j;
  if (sq !== k.answer) mBad.push(k.q);
}
check("maths worked out again independently: quadratic roots, dice totals, powers mod m, sums of squares", !mBad.length, mBad.slice(0, 3));
check("our own quiz bank: high school 60+, university 45+, four different options each, no duplicates",
  P.QUIZ.hs.length >= 60 && P.QUIZ.college.length >= 45 && [...P.QUIZ.hs, ...P.QUIZ.college].every((q) => q.length === 5 && new Set(q.slice(1)).size === 4)
  && new Set([...P.QUIZ.hs, ...P.QUIZ.college].map((q) => q[0])).size === P.QUIZ.hs.length + P.QUIZ.college.length);
check("our own word lists: anagram words with no common second arrangement (no painter / triangle / resource / weather / algorithm)",
  !["painter", "triangle", "resource", "weather", "algorithm", "listen", "silent"].some((w) => P.WORDS.hs.includes(w) || P.WORDS.college.includes(w)) && P.WORDS.hs.length >= 40 && P.WORDS.college.length >= 30
  && Object.values(P.SYN).every((L) => L.every((r) => r.length === 5 && new Set(r.slice(1)).size === 4)));

/* ---------------- the rules ---------------- */
const solo = (o) => C.newGame(Object.assign({ seed: 7, players: [{ name: "Tim" }, { name: "Bot", bot: "saver", skill: 0.7 }] }, o || {}));
let s = solo();
check("a new game: age 16 in high school, $500, IQ 100 (a game score), full life to 65 by default; the board's rings 8 / 10 / 8 / 12 / 16",
  s.players[0].ring === "hs" && s.players[0].age === 16 && s.players[0].cash === 500 && s.players[0].iq === 100 && s.retire === 65 && s.phase === "roll"
  && C.RINGS.hs.length === 8 && C.RINGS.college.length === 10 && C.RINGS.trade.length === 8 && C.RINGS.jobs.length === 12 && C.RINGS.invest.length === 16);
const me = () => s.players[0];
/** roll until the human gets a puzzle (bots step), then answer */
function toPuzzle() { for (let n = 0; n < 200; n++) { if (s.pending && s.pending.type === "puzzle" && C.current(s) === me()) return true; if (C.current(s).bot) C.botStep(s); else if (!s.pending) C.roll(s); else return false; } return false; }
for (let i = 0; i < 5; i++) { toPuzzle(); C.answer(s, true); }
check("high school: 5 right answers = the diploma, +$250 and IQ +2 each; the fork with all three paths open",
  me().qual === "diploma" && me().iq === 110 && me().ring === "fork" && s.pending && s.pending.kind === "fork" && s.pending.options.every((o) => !o.off), { q: me().qual, iq: me().iq, pd: s.pending });
s = solo(); for (let i = 0; i < 3; i++) { toPuzzle(); C.answer(s, false); }
const fk = s.pending && s.pending.options.find((o) => o.id === "college");
check("...3 wrong = drop out: trades or the factory, college greyed with why", me().ring === "fork" && me().qual === "none" && fk && fk.off && /diploma/.test(fk.why));
C.choose(s, "trade");
check("trades: the apprenticeship", me().ring === "trade" && me().pos === 0);
let rolls = 0; while (me().ring === "trade" && rolls < 30) { if (C.current(s).bot) { C.botStep(s); continue; } if (s.pending) { if (s.pending.type === "puzzle") C.answer(s, true); else C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id); continue; } const before = me().pos; C.roll(s, 6); rolls++; if (me().ring === "trade" && me().pos !== before + 1) break; }
check("...ONE square a turn whatever the die (7 turns to the licence), then a trade qualification and the jobs ring with offers", rolls === 7 && me().qual === "trade" && me().ring === "jobs", { rolls, q: me().qual, ring: me().ring });
const tradeOffers = C.offers(s, Object.assign({}, me(), { iq: 120 })).map((o) => o.id);
check("job offers gated by IQ + qualification (a tradesperson with IQ 120: site supervisor, electrician, plumber)", tradeOffers.join() === "supervisor,electrician,plumber", tradeOffers);
check("...a graduate with IQ 140: doctor first; with IQ 100 no graduate job (an office clerk at best)", C.offers(s, Object.assign({}, me(), { qual: "degree", iq: 140 }))[0].id === "doctor"
  && C.offers(s, Object.assign({}, me(), { qual: "degree", iq: 100 })).map((o) => o.id).join() === "clerk,retail");

s = solo(); for (let i = 0; i < 3; i++) { toPuzzle(); C.answer(s, false); }
C.choose(s, "factory");
check("the factory: paid from day one, straight to the investment ring (Factory hand), not open yet", me().ring === "invest" && me().job.id === "factory" && !me().open);
s.turn = 0; s.pending = null; me().pos = 0; C.roll(s, 1);                    // the studio flat, before a stable income
check("...property can't be bought before a stable income (said in the log)", s.props[1].owner === -1 && !s.pending && /two paydays/.test(s.log[s.log.length - 2].t + s.log[s.log.length - 1].t + s.log.slice(-4).map((l) => l.t).join()), s.log.slice(-3));
while (!me().open) { if (C.current(s).bot) C.botStep(s); else if (s.pending) C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id); else { me().pos = 7; C.roll(s, 3); } }
check("...two paydays in a row = a stable income: the investment ring opens", me().open && me().paydays >= 2);
while (C.current(s).bot) C.botStep(s);
me().pos = 0; me().cash = 60000; C.roll(s, 1);
const buy = s.pending && s.pending.options.find((o) => o.id === "buy:1");
check("buying: the studio flat - a 20% deposit and a loan within 5x the salary", s.pending && s.pending.kind === "buy" && buy && !buy.off && /deposit/.test(buy.label), s.pending);
const cash0 = me().cash; C.choose(s, "buy:1");
check("...bought: the deposit from cash, the rest a loan", s.props[1].owner === 0 && me().loan === 220000 - 44000 && me().cash < cash0, { loan: me().loan });
check("loan limit = 5x the salary (no job = no loan)", C.loanLimit(me()) === 5 * me().job.salary && C.loanLimit({ job: null }) === 0);
while (C.current(s) !== s.players[1]) { if (s.pending) C.choose(s, s.pending.options.filter((o) => !o.off).slice(-1)[0].id); else C.roll(s); }
const bot = s.players[1]; bot.ring = "invest"; bot.pos = 0; s.pending = null; const bc = bot.cash, mc = me().cash; C.roll(s, 1);
check("...another player landing on it pays you rent (2% of its value)", me().cash - mc === 4400 && bc - bot.cash >= 4400 - 20000, { me: me().cash - mc });
check("net worth = cash + property + shares - loans - student debt; the score adds IQ and the qualification",
  C.netWorth(s, me()) === Math.round(me().cash + s.props[1].value - me().loan) && C.score(s, me()) === C.netWorth(s, me()) + (me().iq - 100) * 1000 + Math.round((me().wellbeing - 50) * 2000));   // 2.947.0: + wellbeing

s = solo(); for (let i = 0; i < 5; i++) { toPuzzle(); C.answer(s, true); } C.choose(s, "college");
for (let i = 0; i < 6; i++) { toPuzzle(); if (me().ring !== "college") break; C.answer(s, true); }
check("college: six passes = a degree (IQ +3 each), the jobs ring; tuition on the student debt", me().qual === "degree" && me().ring === "jobs" && me().studentDebt > 0 && me().iq >= 128, { q: me().qual, ring: me().ring, iq: me().iq, d: me().studentDebt });
s = solo(); for (let i = 0; i < 5; i++) { toPuzzle(); C.answer(s, true); } C.choose(s, "college");
for (let i = 0; i < 3; i++) { toPuzzle(); C.answer(s, false); }
check("...three fails = out of college: trades or the factory (college greyed)", me().ring === "fork" && s.pending.options.find((o) => o.id === "college").off);

s = solo(); const p0 = me(); p0.ring = "jobs"; p0.qual = "trade"; p0.job = { id: "plumber", title: "Plumber", salary: 84000, level: 1, levels: 4 }; p0.pos = 6; p0.cash = 20000;
C.roll(s, 1);
check("night school from the jobs ring: enrol for $6,000, keep the job, then the college ring", s.pending && s.pending.kind === "night" && !s.pending.options[0].off);
C.choose(s, "enrol");
check("...enrolled: on the college ring, still a plumber, no tuition debt", p0.ring === "college" && p0.night && p0.job && p0.job.id === "plumber" && p0.studentDebt === 0 && /enrols in night school/.test(s.log.map((l) => l.t).join("|")));

// whole games: bots only, several seeds - everyone retires, nothing goes NaN, saves replay the same
let games = [];
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const g = C.newGame({ seed, retire: seed % 2 ? 65 : 30, players: ["saver", "tycoon", "risk", "saver"].map((b, i) => ({ name: "B" + i, bot: b, skill: 0.5 + 0.1 * i })) });
  let n = 0; while (!g.over && n < 30000) { C.botStep(g); n++; }
  games.push({ seed, over: g.over, n, ok: g.players.every((p) => Number.isFinite(p.cash) && Number.isFinite(C.netWorth(g, p)) && p.retired), quals: g.players.map((p) => p.qual).join() });
}
check("whole games with bots (to 65 and to 30): everyone retires, no money goes NaN", games.every((g) => g.over && g.ok), games);
check("...the bots take different paths (a degree, a trade, the factory all seen)", ["degree", "trade", "none"].every((q) => games.some((g) => g.quals.includes(q))), games.map((g) => g.quals));
const a = C.newGame({ seed: 9, players: [{ name: "A", bot: "risk", skill: 0.7 }, { name: "B", bot: "tycoon", skill: 0.6 }] });
for (let i = 0; i < 300; i++) C.botStep(a);
const b = JSON.parse(JSON.stringify(a));
for (let i = 0; i < 400; i++) { C.botStep(a); C.botStep(b); }
check("a saved game (plain JSON) carries on exactly the same", JSON.stringify(a) === JSON.stringify(b));
check("the end: winner by score; standings sorted", (() => { const g = C.newGame({ seed: 3, retire: 30, players: [{ name: "X", bot: "saver" }, { name: "Y", bot: "risk" }] }); while (!g.over) C.botStep(g); const st = C.standings(g); return g.over && st[0].score >= st[1].score && /wins/.test(g.log[g.log.length - 1].t); })());

/* ---------------- high scores ---------------- */
const tmp = path.join(os.tmpdir(), "life944-" + process.pid + ".json");
SV.setFile(tmp);
let L = []; for (let i = 0; i < 12; i++) L = SV.add(L, { name: "P" + i, score: i * 1000, worth: i * 900, retire: 65, bots: 2 }).scores;
const r = SV.add(L, { name: "<b>Top</b>", score: 99999, retire: 99 });
check("high scores: the best ten, a clean name, retire age kept to 30 / 45 / 65", L.length === 10 && L[0].score === 11000 && r.rank === 1 && r.scores[0].name === "bTop/b" && r.scores[0].retire === 65);
let threw = false; try { SV.clean({ score: "lots" }); } catch (e) { threw = e.status === 400; }
check("...junk refused (400)", threw);
SV.setFile(null); try { fs.unlinkSync(tmp); } catch { /* none */ }

/* ---------------- the wiring ---------------- */
const EJ = JSON.parse(src("ext/lifedock/ext.json")), D = src("ext/lifedock/dock.html"), J = src("ext/lifedock/lifedock.js");
check("ext/lifedock: rules, puzzles, then the view; its own server part (never server.js)", EJ.id === "lifedock" && EJ.name === "Life Choices" && EJ.scripts.join() === "lifemoney.js,lifecore.js,lifepuzzles.js,lifedock.js" /* 2.947.0: + money */ && EJ.server === "lifeserver.js" && !/life/.test(src("misc/server.js")));
check("🎓 on the top bar's mini-app group after 🚓; the docker's keys stay in the game (secfloat / the prompt docker's P)",
  /\["tX_chasedock", "🚓", "Police Chase"\], \["tX_lifedock", "🎓", "Life Choices"\]/.test(src("static/appstrip.js")) && /#chasedock, #lifedock/.test(src("static/secfloat.js")) && /#chasedock, #lifedock"/.test(src("ext/promptdock/pfloat.js")));
check("life_choices.json is this PC's own: gitignored and left out of the zips", /^life_choices\.json$/m.test(src(".gitignore")) && /^life_choices\.json$/m.test(src("misc/_gitignore")) && /! -name "life_choices\.json"/.test(src("scripts/make_zips.sh")));
check("the docker: board canvas, players, the action panel, the log, set-up (name, bots 1-5, how often they answer right, retire at 30 / 45 / 65), how to play, scores",
  ["lcBoard", "lcPlayers", "lcAct", "lcLog", "lcSetup", "lcName", "lcBots", "lcSkill", "lcRetire", "lcHelp", "lcScores", "lcSpeed", "lcExitFull"].every((id) => D.includes('id="' + id + '"'))
  && /<option value="30">/.test(D) && /<option value="65" selected>/.test(D) && /<option>5<\/option>/.test(D));
check("saved in localStorage after every move; the bots only play while it is on screen; the puzzle clock only runs while shown",
  /localStorage\.setItem\("h3\.life\.save"/.test(J) && /if \(!shown\(\)\) \{ G\.botT = setTimeout\(pump, 800\)/.test(J) && /!human\(s\) \|\| !shown\(\)\) return;/.test(J));
check("hidden the first time; shown from 🎓 = maximized to the whole window (body.lc-full)", /h3\.g\.lifedock/.test(J) && /root\.toggleMax\("lifedock", true\)/.test(J) && /body\.lc-full #lifedock \{ position: fixed/.test(D));
// what a player sees (code comments, where Tim's own words are quoted, left out)
const ALL = ["lifecore.js", "lifepuzzles.js", "lifedock.js", "dock.html", "lifeserver.js"].map((f) => src("ext/lifedock/" + f)).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");
check("our own game: no other board game's names in what a player sees", !/monopoly|game of life|hasbro|chance card|community chest|go to jail|boardwalk|park place/i.test(ALL));
check("IQ is said to be a game score, never a real IQ test", /a game score, not a real IQ test/.test(D) && /never a real IQ test/.test(src("ext/lifedock/lifecore.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
