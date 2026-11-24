/* bitGen Studio — ext/lifedock/lifecore.js (2.944.0): 🎓 LIFE CHOICES - the rules (window.H3LifeCore; pure, no DOM).
 *
 * Tim: "can we add 1 more game ... a game of life ... start from highschool, with quizes, math puzzles, word puzzles, earn
 * money for puzzles. your iq grows. your iq gives you options for jobs or university/college or working in a factory or
 * trade (user gets to choose) earn money from jobs, use money to buy houses, rent houses to other players. bank can lend
 * based on your income, properties get values" + "lets call it life choices - start with a small square of tasks at the
 * center of the board fork out into trades, factory, college, college gets another group outside the first group, the
 * trades go to a shorter apprenticeship tour, 1 square at a time, the factor gets to go straight to the outside layer which
 * is the property/shares/investment layer, before that layer will be the college jobs and trade jobs on a separate layer,
 * the investment layer will only open when u have a stable income." Our own game - no other board game's names or rules.
 *
 * THE BOARD (rings, from the centre):  hs (high school, 8) -> the FORK -> college (10) | trade (apprenticeship, 8 squares,
 *   ONE a turn, no dice) | factory (straight to invest)  ->  jobs (12)  ->  invest (16: property, shares, the bank).
 * THE CLOCK: every turn is 3 months of life for that player (age 16 -> the retirement age: 30 / 45 / 65).
 * HIGH SCHOOL: 5 right answers = the diploma (all three forks); 3 wrong = drop out (trades or factory).
 * COLLEGE: 6 exams passed = the degree (-> jobs ring); 3 failed = drop out (trades / factory; night school students go back
 *   to work). Tuition goes on a student debt each turn, repaid from a salary later.
 * JOBS: offers gated by IQ (a game score, never a real IQ test) + qualification; promotions by a work puzzle; restructures.
 * INVESTMENT RING: opens with a STABLE INCOME = employed for two paydays in a row (sticky once open). Property (rent from
 *   tenants each turn + rent from players who land), shares in made-up companies, the bank (loans up to 5x the salary).
 * 2.945.0 (Tim: "add another ring on the outside with blocks of land and houses in good condition and houses that need
 *   renovation"): the LAND & HOUSES ring (estate, 20) outside the investment ring, through the Land office squares (a gate on
 *   each ring). Blocks of land (no rent; build a house on one at a Builder square or when you land on your own block), houses
 *   in good condition (full rent) and renovators (cheap, a little rent; renovate for 25% of the value -> a good house worth
 *   half as much again). Council rates, an auction (a lot at 85%). s.estate[k] = {type: land | good | reno, value, owner};
 *   lot keys "1".."15" = the investment ring's property, "e1".."e19" = the estate ring's lots.
 * 2.946.0 (Tim: "user gets to roll a pair of dice this dictates their luck. 1-12 levels of luck 12 gets to roll again ... in high
 *   school luck would be finding money, getting gifts etc. when moved to the investment layer, players avatar will move with
 *   the dice roll and include the luck features"): every roll is a PAIR of dice. Their total is the turn's LUCK (2 = double
 *   1, the worst; 6-8 an ordinary few months; 12 = double 6, the best + a roll again) from the life stage's own table (LUCK
 *   school / work / money - found money and gifts at school, fines and refunds at work, storms, inheritances and lotteries
 *   with property). On the investment and land & houses rings the pair's total moves you; inside, the first die does
 *   (small rings), the apprenticeship stays one square. s.luck = the last roll {who, dice, level, word, text, amount, again}.
 * 2.947.0 (Tim: "make insurance plans, bills (utilities, food, entertainment) going to a cinema is different price from going
 *   on a picnic etc. life expenses. user can choose to buy health insurance or house insurance or car insurance ... taxes and
 *   deductions (use au tax scale)"): lifemoney.js. Once out of study, every quarter's bills are itemised (rent until you own a
 *   place, utilities, phone, getting around, food and fun from p.budget, insurance premiums from p.ins); fun keeps
 *   p.wellbeing up (scored at the end). Pay is taxed on the 2026-27 Australian scale (PAYG each quarter); each birthday is a
 *   tax return (p.fy: salary, rent, dividends, deductions, withheld -> a refund or a bill). Luck events a cover pays (car,
 *   home, health) cost only the excess when insured. A jobseeker payment while out of work.
 * WINNER at the end: net worth + (IQ - 100) x $1,000 + a qualification bonus (diploma $10k, trade $30k, degree $50k).
 *
 * newGame({seed, retire, players: [{name, bot: null | "saver" | "tycoon" | "risk", skill 0-1}]}) -> state (plain JSON -
 * save it as it is);  roll(s, die?) -> events;  answer(s, right);  choose(s, optionId);  botStep(s) (one bot move);
 * s.pending = null | {type: "puzzle", level, topic, square} | {type: "choice", kind, title, text, options [{id, label, off, why}]}
 */
(function (root) {
  "use strict";
  // 2.947.0: life's money (bills, budget, insurance, Australian tax) - ext/lifedock/lifemoney.js
  var MN = typeof module !== "undefined" && module.exports ? require("./lifemoney.js") : root.H3LifeMoney;
  var RINGS = {
    hs: [["quiz", "Quiz"], ["math", "Maths"], ["word", "Words"], ["allowance", "Pocket money"], ["quiz", "Quiz"], ["math", "Maths"], ["word", "Words"], ["exam", "Exam"]],
    college: [["enrol", "Enrolment"], ["exam", "Exam"], ["library", "Library"], ["exam", "Exam"], ["parttime", "Part-time work"], ["exam", "Exam"],
              ["seminar", "Seminar"], ["exam", "Exam"], ["study", "Study group"], ["finals", "Finals"]],
    trade: [["induct", "Induction"], ["skill", "Site skills"], ["tools", "Tools"], ["skill", "Trade maths"], ["skill", "Safety test"], ["skill", "Trade maths"],
            ["workshop", "Workshop"], ["licence", "Licence"]],
    jobs: [["bank", "Bank"], ["offers", "Job offers"], ["overtime", "Overtime"], ["promo", "Promotion"], ["expense", "Car repairs"], ["offers", "Job offers"],
           ["restructure", "Restructure"], ["night", "Night school"], ["bonus", "Bonus"], ["promo", "Promotion"], ["expense", "Moving house"], ["offers", "Job offers"]],
    invest: [["bank", "Bank"], ["prop", "Studio flat"], ["prop", "Townhouse"], ["news", "Market news"], ["prop", "Corner shop"], ["exchange", "Exchange"],
             ["prop", "Brick house"], ["rates", "Rates & taxes"], ["prop", "Duplex"], ["prop", "Beach unit"], ["night", "Night school"], ["prop", "Warehouse"],
             ["exchange", "Exchange"], ["prop", "Apartment block"], ["landoff", "Land office"], ["prop", "Office tower"]],
  };
  // 2.945.0: the land & houses ring - [type, name, price]; the other squares are the gate, builders, council rates and an auction
  var ESTATE = { 1: ["land", "Hilltop block", 180000], 2: ["good", "Family home", 560000], 3: ["reno", "Weatherboard renovator", 310000],
                 5: ["land", "Riverside block", 240000], 6: ["good", "Brick villa", 690000], 7: ["reno", "Fixer-upper cottage", 280000],
                 9: ["land", "Corner block", 200000], 10: ["good", "Lakeside home", 820000], 11: ["reno", "Old farmhouse", 420000],
                 13: ["land", "Acreage", 380000], 14: ["good", "Modern home", 760000], 15: ["reno", "Run-down terrace", 350000],
                 17: ["land", "Bushland block", 150000], 18: ["good", "Beach house", 980000], 19: ["reno", "Deceased estate", 460000] };
  var EXTRA = { 0: ["office", "Land office"], 4: ["builder", "Builder"], 8: ["council", "Council rates"], 12: ["auction", "Auction"], 16: ["builder", "Builder"] };
  RINGS.estate = [];
  for (var ei = 0; ei < 20; ei++) RINGS.estate.push(ESTATE[ei] ? ["lot", ESTATE[ei][1]] : EXTRA[ei]);
  var WORKS = { build: 320000, buildUp: 1.12, reno: 0.25, renoUp: 1.5, landGrowth: 0.02, auction: 0.85 };
  var YIELD = { prop: 0.045 / 4, good: 0.045 / 4, reno: 0.02 / 4, land: 0 }, LANDRENT = { prop: 0.02, good: 0.02, reno: 0.01, land: 0 };
  var PROPS = { 1: 220000, 2: 380000, 4: 450000, 6: 620000, 8: 700000, 9: 840000, 11: 950000, 13: 1600000, 15: 2400000 };
  var COMPANIES = [["sun", "Sunreach Power"], ["tide", "Tidewater Freight"], ["leaf", "Greenleaf Health"], ["grain", "Goldgrain Foods"]];
  // [id, title, salary a year, qualification needed, IQ needed, promotion levels]
  var JOBS = [["factory", "Factory hand", 50000, "none", 0, 2], ["retail", "Shop assistant", 46000, "none", 0, 2], ["clerk", "Office clerk", 56000, "diploma", 100, 3],
              ["carpenter", "Carpenter", 76000, "trade", 98, 4], ["plumber", "Plumber", 84000, "trade", 102, 4], ["electrician", "Electrician", 88000, "trade", 106, 4],
              ["supervisor", "Site supervisor", 112000, "trade", 116, 4], ["analyst", "Graduate analyst", 72000, "degree", 106, 5], ["engineer", "Engineer", 102000, "degree", 116, 5],
              ["developer", "Software developer", 112000, "degree", 121, 5], ["scientist", "Research scientist", 118000, "degree", 127, 5],
              ["lawyer", "Lawyer", 138000, "degree", 131, 5], ["doctor", "Doctor", 162000, "degree", 136, 5]];
  var QUAL = { none: 0, diploma: 1, trade: 2, degree: 2 }, QBONUS = { none: 0, diploma: 10000, trade: 30000, degree: 50000 };
  var NEED = { hs: 5, hsFail: 3, college: 6, collegeFail: 3 };
  var MONEY = { start: 500, hsRight: 250, allowance: 300, tuition: 2500, apprentice: 1500, living: 5000, jobless: 3000, tax: 0.25,
                overtime: 2000, bonus: 3000, carRepairs: 1500, moving: 4000, night: 6000, partTime: 1500, tradeRight: 500,
                interest: 0.015, tenant: 0.045 / 4, dividend: 0.01, rentFrac: 0.02, rates: 0.01, deposit: 0.2, loanX: 5, repay: 0.05 };
  var COLORS = ["#ff8a1c", "#3fa9f5", "#5ccf6c", "#e25d9b", "#b48cff", "#f2d14a"];
  var NAMES = ["Ava", "Kai", "Mila", "Theo", "Zara", "Leo", "Isla", "Remy"];
  var PERSONAS = { saver: "careful saver", tycoon: "property tycoon", risk: "risk-taker" };

  function rng(s) {                                                // mulberry32 on a number kept in the state (saved games replay)
    s.rs = (s.rs + 0x6D2B79F5) >>> 0; var t = s.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  var money = function (v) { return (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-AU"); };
  function log(s, t) { s.log.push({ r: s.round, t: t }); if (s.log.length > 300) s.log.splice(0, s.log.length - 300); }

  function newGame(o) {
    o = o || {};
    var s = { v: 1, seed: (Number(o.seed) >>> 0) || 1, retire: [30, 45, 65].indexOf(Number(o.retire)) >= 0 ? Number(o.retire) : 65,
              round: 1, turn: 0, phase: "roll", pending: null, log: [], over: false, props: {}, price: {}, news: "", year: 0, lastRoll: 0 };
    s.rs = s.seed;
    var list = (o.players && o.players.length ? o.players : [{ name: "You" }]).slice(0, 6);
    s.players = list.map(function (q, i) {
      return { id: i, name: String(q.name || NAMES[i] || "Player " + (i + 1)).slice(0, 18), bot: PERSONAS[q.bot] ? q.bot : null,
               skill: q.skill == null ? 0.65 : Math.max(0, Math.min(1, Number(q.skill))), color: q.color || COLORS[i % COLORS.length],
               ring: "hs", pos: 0, age: 16, cash: MONEY.start, iq: 100, qual: "none", hsRight: 0, hsWrong: 0, colRight: 0, colWrong: 0,
               job: null, paydays: 0, open: false, studentDebt: 0, loan: 0, shares: {}, retired: false, bankrupt: false, night: false, dropped: [] };
    });
    Object.keys(PROPS).forEach(function (k) { s.props[k] = { value: PROPS[k], owner: -1 }; });
    upgrade(s);
    COMPANIES.forEach(function (c) { s.price[c[0]] = 10 + Math.round(rng(s) * 40); });
    log(s, "A new game: " + s.players.map(function (p) { return p.name + (p.bot ? " (" + PERSONAS[p.bot] + ")" : ""); }).join(", ") + " - retire at " + s.retire + ".");
    return s;
  }
  /** a game saved before 2.945.0 gets the land & houses ring */
  /** a player's 2.947.0 money fields (older saves too) */
  function money0(p) {
    if (!p.budget) p.budget = p.bot === "saver" ? { food: "home", fun: "picnic" } : p.bot === "risk" ? { food: "out", fun: "gigs" } : { food: "mix", fun: "cinema" };
    if (!p.ins) p.ins = { health: false, car: false, home: false };
    if (p.wellbeing == null) p.wellbeing = MN.WB.start;
    if (!p.fy) p.fy = { salary: 0, rent: 0, div: 0, ded: 0, withheld: 0 };
    return p;
  }
  function upgrade(s) {
    if (s && s.players) s.players.forEach(money0);
    if (s && !s.estate) { s.estate = {}; Object.keys(ESTATE).forEach(function (k) { s.estate[k] = { type: ESTATE[k][0], value: ESTATE[k][2], owner: -1 }; }); }
    return s;
  }
  /** a lot by its key: "7" = the investment ring's property 7, "e7" = the estate ring's lot 7 */
  function lot(s, key) { key = String(key); return key.charAt(0) === "e" ? s.estate[key.slice(1)] : s.props[key]; }
  function lotType(s, key) { var l = lot(s, key); return String(key).charAt(0) === "e" ? l.type : "prop"; }
  function lotName(key) { key = String(key); return key.charAt(0) === "e" ? ESTATE[key.slice(1)][1] : RINGS.invest[key][1]; }
  /** every lot a player owns, both rings (keys) */
  function lotsOf(s, p) {
    return Object.keys(s.props).filter(function (k) { return s.props[k].owner === p.id; })
      .concat(Object.keys(s.estate || {}).filter(function (k) { return s.estate[k].owner === p.id; }).map(function (k) { return "e" + k; }));
  }
  var cur = function (s) { return s.players[s.turn]; };
  var square = function (p) { var r = RINGS[p.ring]; return r ? r[p.pos % r.length] : ["fork", "The fork"]; };
  function propsOf(s, p) { return Object.keys(s.props).filter(function (k) { return s.props[k].owner === p.id; }); }
  function sharesValue(s, p) { return Object.keys(p.shares).reduce(function (t, k) { return t + p.shares[k] * s.price[k]; }, 0); }
  function netWorth(s, p) { return Math.round(p.cash + lotsOf(s, p).reduce(function (t, k) { return t + lot(s, k).value; }, 0) + sharesValue(s, p) - p.loan - p.studentDebt); }
  function score(s, p) { return netWorth(s, p) + (p.iq - 100) * 1000 + QBONUS[p.qual] + Math.round(((p.wellbeing == null ? MN.WB.start : p.wellbeing) - MN.WB.start) * MN.WB.point); }
  function loanLimit(p) { return p.job ? MONEY.loanX * p.job.salary : 0; }
  function jobOf(id) { var j = JOBS.filter(function (x) { return x[0] === id; })[0]; return j ? { id: j[0], title: j[1], salary: j[2], need: j[3], iq: j[4], levels: j[5] } : null; }
  function qualifies(p, j) { var need = j[3]; return p.iq >= j[4] && (need === "none" || p.qual === need || (need === "diploma" && QUAL[p.qual] >= 1)); }
  /** the job offers for a player: every job they qualify for (the best three by pay), each with why not when they don't */
  function offers(s, p) {
    var ok = JOBS.filter(function (j) { return qualifies(p, j) && j[0] !== "factory"; }).sort(function (a, b) { return b[2] - a[2]; }).slice(0, 3);
    return ok.map(function (j) { return jobOf(j[0]); });
  }
  function hire(s, p, id) {
    var j = jobOf(id); if (!j) return;
    p.job = { id: j.id, title: j.title, salary: j.salary, level: 1, levels: j.levels }; p.paydays = 0;
    money0(p);
    if (p.bot && !p.insChosen) { p.insChosen = true; p.ins = p.bot === "saver" ? { health: true, car: true, home: true } : p.bot === "tycoon" ? { health: false, car: true, home: true } : { health: false, car: false, home: false }; }
    log(s, p.name + " starts work: " + j.title + " (" + money(j.salary) + " a year).");
  }

  /* ---------------- moving ---------------- */
  function canRoll(s) { return !s.over && s.phase === "roll" && !s.pending; }
  /* ---- 2.946.0: luck - a pair of dice, 2 (double 1) to 12 (double 6, roll again) ---- */
  var LUCKWORD = { 2: "terrible luck", 3: "bad luck", 4: "a bit unlucky", 5: "a bit unlucky", 6: "an ordinary few months", 7: "an ordinary few months",
                   8: "an ordinary few months", 9: "a bit lucky", 10: "a bit lucky", 11: "good luck", 12: "brilliant luck" };
  var LUCK = {
    school: { 2: ["Your bike is stolen", -400], 3: ["You crack your phone screen", -250], 4: ["A library fine", -60], 5: ["You lose your bus pass", -30],
              9: ["You find $50 on the footpath", 50], 10: ["A birthday gift from your grandparents", 150], 11: ["You win a school prize", 300],
              12: ["A local business gives you a bursary", 600] },
    work: { 2: ["Your car is written off", -8000, "car"], 3: ["A burst pipe floods your flat", -3000, "home"], 4: ["A speeding fine", -450], 5: ["A night in hospital", -2500, "health"],
            9: ["A tax refund", 600], 10: ["You sell things you no longer need", 1200], 11: ["A scratch-card win", 5000], 12: ["An award at work, with a bonus", 10000] },
    money: { 2: ["Your car is written off", -12000, "car"], 3: ["A burst pipe floods your place", -6000, "home"], 4: ["A stay in hospital", -6000, "health"], 5: ["Car repairs", -1500],
             9: ["Interest on your savings", 1000], 10: ["A tip on a deal pays off", 8000], 11: ["An inheritance from a great-aunt", 25000], 12: ["A lottery win", 75000] },
  };
  function stageOf(p) { return p.ring === "invest" || p.ring === "estate" ? "money" : p.ring === "jobs" ? "work" : "school"; }
  /** the luck of a roll: the stage's event for the total (property owners' bad luck hits their property); school losses never
   *  take more than you have */
  function luck(s, p, d1, d2) {
    var lv = d1 + d2, st = stageOf(p), ev = LUCK[st][lv], text = "", amt = 0;
    if (ev) {
      text = ev[0]; amt = ev[1]; var cover = ev[2] || null;
      var mine = lotsOf(s, p);
      if (st === "money" && mine.length && lv <= 3) {
        var big = mine.sort(function (a, b) { return lot(s, b).value - lot(s, a).value; })[0], v = lot(s, big).value;
        if (lv === 2) { text = "A storm damages your " + lotName(big); amt = -Math.max(20000, Math.round(v * 0.05 / 1000) * 1000); cover = "home"; }
        else { text = "A tenant leaves owing rent"; amt = -Math.max(8000, Math.round(v * 0.02 / 1000) * 1000); cover = null; }
        if (p.fy) p.fy.ded += -MN.covered(cover || "none", p.ins, -amt);           // repairs and lost rent on a rental: deductible
      }
      if (st === "money" && lv === 9) amt = Math.max(1000, Math.round(Math.max(0, p.cash) * 0.01));
      if (st === "school" && amt < 0) amt = -Math.min(-amt, Math.max(0, p.cash));
      if (cover && amt < 0) {                                                      // 2.947.0: insured = the excess
        if (p.ins && p.ins[cover]) { amt = -MN.covered(cover, p.ins, -amt); text += " - insured, you pay the excess"; }
        else text += " - not insured";
      }
      p.cash += amt;
    }
    s.luck = { who: p.id, dice: [d1, d2], level: lv, word: LUCKWORD[lv], text: text, amount: amt, again: lv === 12 };
    p.lastLuck = { dice: [d1, d2], level: lv, word: LUCKWORD[lv], text: text, amount: amt };
    log(s, "🎲 " + p.name + " rolls " + d1 + " + " + d2 + " = " + lv + " - " + LUCKWORD[lv] + (text ? ": " + text + (amt ? " (" + (amt > 0 ? "+" : "") + money(amt) + ")" : "") : "") + (lv === 12 ? " - and rolls again!" : "") + ".");
    if (lv === 12) p.again = true;
    return lv;
  }
  /** roll(s) = the pair of dice (roll(s, d1, d2) to set them); roll(s, n) with ONE number = a plain move of n squares, no luck (tests) */
  function roll(s, a, b) {
    if (!canRoll(s)) return [];
    var p = cur(s);
    if (p.ring === "fork") { forkChoice(s, p); return ["fork"]; }
    var d, plain = a != null && b == null;
    if (plain) d = Math.max(1, Math.min(12, Math.floor(a)));
    else {
      var d1 = a >= 1 && a <= 6 ? Math.floor(a) : 1 + Math.floor(rng(s) * 6), d2 = b >= 1 && b <= 6 ? Math.floor(b) : 1 + Math.floor(rng(s) * 6);
      luck(s, p, d1, d2);
      d = p.ring === "invest" || p.ring === "estate" ? d1 + d2 : d1;          // the outer rings: the pair's total; inside: the first die
    }
    s.lastRoll = d;
    var n = RINGS[p.ring].length;
    if (p.ring === "trade") p.pos = Math.min(n - 1, p.pos + 1);
    else p.pos = (p.pos + d) % n;
    log(s, p.name + (p.ring === "trade" ? " moves one square" : " moves " + d) + " -> " + square(p)[1] + ".");
    land(s, p);
    if (!s.pending) finishTurn(s);
    return ["roll"];
  }
  function puzzle(s, p, level, topic, sq) { s.pending = { type: "puzzle", level: level, topic: topic, square: sq }; s.phase = "pending"; }
  function choice(s, kind, title, text, options) { s.pending = { type: "choice", kind: kind, title: title, text: text || "", options: options }; s.phase = "pending"; }

  function land(s, p) {
    var sq = square(p), k = sq[0];
    if (p.ring === "hs") {
      if (k === "allowance") { p.cash += MONEY.allowance; log(s, p.name + " gets " + money(MONEY.allowance) + " pocket money."); }
      else puzzle(s, p, "hs", k === "exam" ? "any" : k, sq[1]);
      return;
    }
    if (p.ring === "college") {
      if (k === "exam" || k === "finals") puzzle(s, p, "college", "any", sq[1]);
      else if (k === "library" || k === "seminar") { p.iq += 1; log(s, p.name + " reads up: IQ +1."); }
      else if (k === "parttime") { p.cash += MONEY.partTime; log(s, p.name + " earns " + money(MONEY.partTime) + " part-time."); }
      else if (k === "study") puzzle(s, p, "college", "math", sq[1]);
      return;
    }
    if (p.ring === "trade") {
      if (k === "skill") puzzle(s, p, "trade", "math", sq[1]);
      else if (k === "licence") { p.qual = "trade"; log(s, p.name + " is a qualified tradesperson!"); toJobs(s, p); }
      else if (k === "tools") { p.cash -= 800; log(s, p.name + " buys tools: " + money(-800) + "."); }
      return;
    }
    if (p.ring === "jobs") { landJobs(s, p, k); return; }
    if (p.ring === "invest") landInvest(s, p, k);
    if (p.ring === "estate") landEstate(s, p, k);
  }
  function toJobs(s, p) { p.ring = "jobs"; p.pos = 1; p.night = false; land(s, p); }
  function forkChoice(s, p) {
    var hasDip = QUAL[p.qual] >= 1 || p.qual === "diploma";
    var col = p.dropped.indexOf("college") >= 0;
    choice(s, "fork", "Your next step", p.qual === "none" ? "You left high school without the diploma - college needs it." : "Pick a path. You can go to night school later.", [
      { id: "college", label: "🎓 College - a degree (tuition goes on a student debt)", off: !hasDip || col, why: !hasDip ? "needs the high school diploma" : col ? "you dropped out of college" : "" },
      { id: "trade", label: "🔧 Trades - an apprenticeship, one square a turn, a small wage", off: p.dropped.indexOf("trade") >= 0, why: "" },
      { id: "factory", label: "🏭 Factory - paid from day one, straight to the investment ring", off: false, why: "" }]);
  }
  function landJobs(s, p, k) {
    var j = p.job;
    if (k === "bank") {
      if (p.open) choice(s, "gate", "The bank", "With a stable income the investment ring is open to you - property, shares and loans.", [
        { id: "out", label: "➜ Move out to the investment ring" }, { id: "stay", label: "Stay on the jobs ring" }]);
      else log(s, p.name + " visits the bank: the investment ring opens after two paydays in a row in a job.");
    } else if (k === "offers") {
      var of = offers(s, p);
      if (!of.length) { log(s, p.name + ": no job offers yet (IQ " + p.iq + ", " + p.qual + ")."); return; }
      choice(s, "job", "Job offers", j ? "You work as " + j.title + " (" + money(j.salary) + ")." : "You have no job.",
        of.map(function (o) { return { id: "job:" + o.id, label: o.title + " - " + money(o.salary) + " a year", off: !!(j && j.id === o.id) }; })
          .concat([{ id: "keep", label: j ? "Keep my job" : "Not now" }]));
    } else if (k === "overtime") { if (j) { p.cash += MONEY.overtime; log(s, p.name + " works overtime: +" + money(MONEY.overtime) + "."); } }
    else if (k === "promo") { if (j) { if (j.level >= j.levels) log(s, p.name + " is at the top as " + j.title + "."); else puzzle(s, p, "work", "any", "Promotion"); } }
    else if (k === "expense") { var c = square(p)[1] === "Car repairs" ? MONEY.carRepairs : MONEY.moving; p.cash -= c; log(s, p.name + ": " + square(p)[1].toLowerCase() + " " + money(-c) + "."); }
    else if (k === "restructure") restructure(s, p);
    else if (k === "night") nightChoice(s, p);
    else if (k === "bonus") { if (j) { p.cash += MONEY.bonus; log(s, p.name + " gets a bonus: +" + money(MONEY.bonus) + "."); } }
  }
  function restructure(s, p) {
    if (!p.job) return;
    var risk = p.iq >= 125 ? 1 / 8 : 1 / 4;
    if (rng(s) < risk) { log(s, p.name + " is laid off in a restructure (was " + p.job.title + ")."); p.job = null; p.paydays = 0; }
    else log(s, p.name + " keeps their job through a restructure.");
  }
  function nightChoice(s, p) {
    if (p.qual === "degree" || p.dropped.indexOf("college") >= 0) return;
    var dip = QUAL[p.qual] >= 1;
    choice(s, "night", "Night school", "Study for a degree while you keep working: " + money(MONEY.night) + " now, then the college ring.", [
      { id: "enrol", label: "🎓 Enrol (" + money(MONEY.night) + ")", off: !dip || p.cash < MONEY.night, why: !dip ? "needs the high school diploma (or a trade)" : p.cash < MONEY.night ? "not enough cash" : "" },
      { id: "no", label: "Not now" }]);
  }
  function landInvest(s, p, k) {
    var name = square(p)[1];
    if (k === "bank") { if (p.open) bankChoice(s, p); else log(s, p.name + " at the bank: no stable income yet - two paydays in a row first."); }
    else if (k === "prop") {
      var pr = s.props[p.pos];
      if (pr.owner === -1) {
        if (!p.open) { log(s, p.name + " looks at the " + name + " (" + money(pr.value) + ") - the investment ring opens after two paydays in a row."); return; }
        buyChoice(s, p, String(p.pos));
      } else if (pr.owner !== p.id) {
        var o = s.players[pr.owner], rent = Math.round(pr.value * MONEY.rentFrac);
        p.cash -= rent; o.cash += rent; log(s, p.name + " pays " + o.name + " " + money(rent) + " rent for the " + name + ".");
      } else log(s, p.name + " checks on their " + name + ".");
    } else if (k === "news") news(s, p);
    else if (k === "landoff") {
      if (p.open) choice(s, "gate", "The land office", "Out past the city: blocks of land, houses in good condition and houses that need renovating.", [
        { id: "estate", label: "➜ Move out to the land & houses ring" }, { id: "stay", label: "Stay on the investment ring" }]);
      else log(s, p.name + " at the land office: no stable income yet.");
    }
    else if (k === "exchange") { if (p.open) sharesChoice(s, p); else log(s, p.name + " watches the exchange - not open to them yet."); }
    else if (k === "rates") {
      var v = propsOf(s, p).reduce(function (t, x) { return t + s.props[x].value; }, 0), c = Math.round(v * MONEY.rates);
      if (c) { p.cash -= c; if (p.fy) p.fy.ded += c; log(s, p.name + " pays " + money(c) + " rates and land tax."); } else log(s, p.name + ": no property, no rates.");
    } else if (k === "night") nightChoice(s, p);
  }
  var TYPEWORD = { prop: "", land: "A block of land - no rent until you build on it (at a Builder, or when you land here). ", good: "A house in good condition. ", reno: "A house that needs renovating - little rent until it is done. " };
  function buyChoice(s, p, at, pct) {
    var pr = lot(s, at), ty = lotType(s, at), v = Math.round(pr.value * (pct || 100) / 100), dep = Math.round(v * MONEY.deposit), need = v - dep, room = loanLimit(p) - p.loan;
    var cashAll = p.cash >= v, mort = p.cash >= dep && need <= room;
    choice(s, "buy", (pct ? "Auction: " : "For sale: ") + lotName(at), TYPEWORD[ty] + money(v) + (pct ? " (" + pct + "% of its value)" : "") + (YIELD[ty] ? " - tenants pay about " + money(pr.value * YIELD[ty]) + " a quarter; players who land here pay you " + money(pr.value * LANDRENT[ty]) + "." : "."), [
      { id: "buy:" + at + (pct ? ":" + pct : ""), label: cashAll ? "Buy it with cash" : "Buy it (" + money(dep) + " deposit, " + money(need) + " loan)", off: !(cashAll || mort),
        why: p.cash < dep ? "the deposit is " + money(dep) : "the bank lends up to " + money(loanLimit(p)) + " on your income (" + money(p.loan) + " owed)" },
      { id: "pass", label: "Pass" }]);
  }
  function bankChoice(s, p) {
    var room = Math.max(0, loanLimit(p) - p.loan);
    choice(s, "bank", "The bank", "Loan " + money(p.loan) + " of " + money(loanLimit(p)) + " (5x your salary), interest 6% a year. Cash " + money(p.cash) + ".",
      [{ id: "borrow:25000", label: "Borrow $25,000", off: room < 25000, why: "over your limit" },
       { id: "borrow:100000", label: "Borrow $100,000", off: room < 100000, why: "over your limit" },
       { id: "repay:25000", label: "Repay $25,000", off: p.loan < 1 || p.cash < Math.min(25000, p.loan), why: p.loan < 1 ? "nothing owed" : "not enough cash" },
       { id: "repay:all", label: "Repay it all (" + money(p.loan) + ")", off: p.loan < 1 || p.cash < p.loan, why: p.loan < 1 ? "nothing owed" : "not enough cash" }]
      .concat(lotsOf(s, p).map(function (k) { return { id: "sell:" + k, label: "Sell the " + lotName(k) + " (" + money(lot(s, k).value * 0.95) + ")" }; }))
      .concat([{ id: "done", label: "Done" }]));
  }
  function sharesChoice(s, p) {
    var o = [];
    COMPANIES.forEach(function (c) {
      var pr = s.price[c[0]], have = p.shares[c[0]] || 0;
      o.push({ id: "sh:" + c[0] + ":5000", label: "Buy $5,000 of " + c[1] + " ($" + pr.toFixed(2) + ")", off: p.cash < 5000, why: "not enough cash" });
      if (have) o.push({ id: "sell:" + c[0], label: "Sell my " + have + " " + c[1] + " (" + money(have * pr) + ")" });
    });
    o.push({ id: "done", label: "Done" });
    choice(s, "shares", "The exchange", "Cash " + money(p.cash) + ". Prices move every round; each holding pays a dividend each turn.", o);
  }
  function news(s, p) {
    var r = rng(s);
    if (r < 0.6) {
      var c = COMPANIES[Math.floor(rng(s) * COMPANIES.length)], up = rng(s) < 0.55, pct = 0.08 + rng(s) * 0.17;
      s.price[c[0]] = Math.max(0.5, +(s.price[c[0]] * (up ? 1 + pct : 1 - pct)).toFixed(2));
      s.news = c[1] + (up ? " jumps " : " falls ") + Math.round(pct * 100) + "% on " + (up ? pick(s, ["a big new contract", "strong results", "a breakthrough"]) : pick(s, ["a profit warning", "a product recall", "a lost contract"])) + ".";
    } else {
      var up2 = rng(s) < 0.6, pc = 0.03 + rng(s) * 0.05;
      Object.keys(s.props).forEach(function (k) { s.props[k].value = Math.round(s.props[k].value * (up2 ? 1 + pc : 1 - pc) / 1000) * 1000; });
      Object.keys(s.estate || {}).forEach(function (k) { s.estate[k].value = Math.round(s.estate[k].value * (up2 ? 1 + pc : 1 - pc) / 1000) * 1000; });
      s.news = "Property market " + (up2 ? "up " : "down ") + Math.round(pc * 100) + "%.";
    }
    log(s, "📰 " + s.news);
  }
  /* ---- 2.945.0: the land & houses ring ---- */
  function landEstate(s, p, k) {
    var name = square(p)[1];
    if (k === "office") choice(s, "gate", "The land office", "Back to the investment ring (the bank, the exchange, the city's property)?", [
      { id: "in", label: "➜ Move in to the investment ring" }, { id: "stay", label: "Stay out here" }]);
    else if (k === "lot") {
      var key = "e" + p.pos, l = lot(s, key);
      if (l.owner === -1) buyChoice(s, p, key);
      else if (l.owner !== p.id) {
        var o = s.players[l.owner], rent = Math.round(l.value * LANDRENT[l.type]);
        if (rent) { p.cash -= rent; o.cash += rent; log(s, p.name + " pays " + o.name + " " + money(rent) + " rent for the " + name + "."); }
        else log(s, p.name + " walks across " + o.name + "'s " + name + ".");
      } else if (l.type === "good") log(s, p.name + " checks on their " + name + " - the tenants are happy.");
      else worksChoice(s, p, [key]);
    } else if (k === "builder") {
      var mine = lotsOf(s, p).filter(function (x) { return x.charAt(0) === "e" && lot(s, x).type !== "good"; });
      if (mine.length) worksChoice(s, p, mine); else log(s, p.name + " chats with the builder - nothing of theirs to build on or renovate.");
    } else if (k === "council") {
      var v = lotsOf(s, p).filter(function (x) { return x.charAt(0) === "e"; }).reduce(function (t, x) { return t + lot(s, x).value; }, 0), c = Math.round(v * MONEY.rates);
      if (c) { p.cash -= c; if (p.fy) p.fy.ded += c; log(s, p.name + " pays " + money(c) + " council rates."); } else log(s, p.name + ": no land, no council rates.");
    } else if (k === "auction") {
      var free = Object.keys(s.estate).filter(function (x) { return s.estate[x].owner === -1; });
      if (!free.length) { log(s, "The auction has nothing for sale - every lot is owned."); return; }
      buyChoice(s, p, "e" + free[Math.floor(rng(s) * free.length)], Math.round(WORKS.auction * 100));
    }
  }
  /** what the works cost and what the lot is worth after: build a house on land, renovate a renovator */
  function works(s, key) {
    var l = lot(s, key);
    return l.type === "land" ? { what: "build", cost: WORKS.build, after: Math.round((l.value + WORKS.build) * WORKS.buildUp / 1000) * 1000 }
      : { what: "reno", cost: Math.round(l.value * WORKS.reno / 1000) * 1000, after: Math.round(l.value * WORKS.renoUp / 1000) * 1000 };
  }
  function canPay(p, cost) { return p.cash >= cost || (p.cash >= cost * MONEY.deposit && cost - Math.round(cost * MONEY.deposit) <= loanLimit(p) - p.loan); }
  function worksChoice(s, p, keys) {
    var o = keys.filter(function (k) { return lot(s, k).owner === p.id && lot(s, k).type !== "good"; }).map(function (k) {
      var w = works(s, k);
      return { id: w.what + ":" + k, label: (w.what === "build" ? "🏗 Build a house on the " : "🔨 Renovate the ") + lotName(k) + " - " + money(w.cost) + " (then worth about " + money(w.after) + ")",
               off: !canPay(p, w.cost), why: "not enough cash or loan room" };
    });
    if (!o.length) return;
    choice(s, "works", "The builder", "Cash " + money(p.cash) + ". Works not covered by cash go on a loan (20% from cash).", o.concat([{ id: "done", label: "Not now" }]));
  }
  function doWorks(s, p, key) {
    var l = lot(s, key), w = works(s, key), fromCash = p.cash >= w.cost ? w.cost : Math.round(w.cost * MONEY.deposit);
    p.cash -= fromCash; p.loan += w.cost - fromCash;
    l.type = "good"; l.value = w.after;
    log(s, (w.what === "build" ? "🏗 " + p.name + " builds a house on the " : "🔨 " + p.name + " renovates the ") + lotName(key) + " for " + money(w.cost) + " - now worth " + money(w.after) + ".");
  }
  function pick(s, a) { return a[Math.floor(rng(s) * a.length)]; }

  /* ---------------- answers and choices ---------------- */
  function answer(s, right) {
    var pd = s.pending, p = cur(s);
    if (!pd || pd.type !== "puzzle") return;
    s.pending = null; s.phase = "roll";
    if (pd.level === "hs") {
      if (right) { p.hsRight++; p.iq += 2; p.cash += MONEY.hsRight; log(s, "✔ " + p.name + " gets it right: +" + money(MONEY.hsRight) + ", IQ +2 (" + p.hsRight + "/" + NEED.hs + ")."); }
      else { p.hsWrong++; log(s, "✘ " + p.name + " gets it wrong (" + p.hsWrong + " of " + NEED.hsFail + " allowed)."); }
      if (p.hsRight >= NEED.hs) { p.qual = "diploma"; p.ring = "fork"; p.pos = 0; log(s, "🎓 " + p.name + " graduates from high school!"); forkChoice(s, p); }
      else if (p.hsWrong >= NEED.hsFail) { p.ring = "fork"; p.pos = 0; p.dropped.push("hs"); log(s, p.name + " drops out of high school."); forkChoice(s, p); }
    } else if (pd.level === "college") {
      if (right) { p.colRight++; p.iq += 3; log(s, "✔ " + p.name + " passes: IQ +3 (" + p.colRight + "/" + NEED.college + ")."); }
      else { p.colWrong++; log(s, "✘ " + p.name + " fails an exam (" + p.colWrong + " of " + NEED.collegeFail + " allowed)."); }
      if (p.colRight >= NEED.college) { p.qual = "degree"; log(s, "🎓 " + p.name + " earns a degree!"); toJobs(s, p); }
      else if (p.colWrong >= NEED.collegeFail) {
        p.dropped.push("college"); log(s, p.name + " drops out of college.");
        if (p.night) { p.ring = "jobs"; p.pos = 0; p.night = false; } else { p.ring = "fork"; p.pos = 0; forkChoice(s, p); }
      }
    } else if (pd.level === "trade") {
      if (right) { p.iq += 2; p.cash += MONEY.tradeRight; log(s, "✔ " + p.name + " nails it: +" + money(MONEY.tradeRight) + ", IQ +2."); }
      else log(s, "✘ " + p.name + " gets it wrong - the boss shows them again.");
    } else if (pd.level === "work") {
      if (right && p.job) { p.job.level++; p.job.salary = Math.round(p.job.salary * 1.12 / 100) * 100; p.iq += 1; log(s, "✔ " + p.name + " is promoted: " + money(p.job.salary) + " a year."); }
      else log(s, "✘ " + p.name + " misses the promotion this time.");
    }
    if (!s.pending) finishTurn(s);
  }
  function choose(s, id) {
    var pd = s.pending, p = cur(s);
    if (!pd || pd.type !== "choice") return false;
    var opt = pd.options.filter(function (o) { return o.id === id; })[0];
    if (!opt || opt.off) return false;
    s.pending = null; s.phase = "roll";
    var k = pd.kind, a = id.split(":");
    if (k === "fork") {
      if (id === "college") { p.ring = "college"; p.pos = 0; p.colRight = 0; p.colWrong = 0; log(s, p.name + " goes to college."); }
      else if (id === "trade") { p.ring = "trade"; p.pos = 0; log(s, p.name + " starts an apprenticeship."); }
      else { p.ring = "invest"; p.pos = 0; hire(s, p, "factory"); }
    } else if (k === "job") { if (a[0] === "job") hire(s, p, a[1]); }
    else if (k === "gate") {
      if (id === "out") { p.ring = "invest"; p.pos = 0; log(s, p.name + " moves out to the investment ring."); }
      else if (id === "estate") { p.ring = "estate"; p.pos = 0; log(s, p.name + " heads out to the land & houses ring."); }
      else if (id === "in") { p.ring = "invest"; p.pos = 14; log(s, p.name + " moves back in to the investment ring."); }
    }
    else if (k === "night") { if (id === "enrol") { p.cash -= MONEY.night; p.ring = "college"; p.pos = 0; p.night = true; p.colRight = 0; p.colWrong = 0; log(s, p.name + " enrols in night school."); } }
    else if (k === "buy") {
      if (a[0] === "buy") {
        var at = a[1], v = Math.round(lot(s, at).value * (+a[2] || 100) / 100), fromCash = p.cash >= v ? v : Math.round(v * MONEY.deposit);   // cash if there is enough, else the deposit + a loan
        p.cash -= fromCash; p.loan += v - fromCash; lot(s, at).owner = p.id;
        log(s, ({ land: "🌳 ", reno: "🏚 ", good: "🏡 ", prop: "🏠 " })[lotType(s, at)] + p.name + " buys the " + lotName(at) + " for " + money(v) + (a[2] ? " at auction" : "") + (v - fromCash > 0 ? " (" + money(v - fromCash) + " loan)" : "") + ".");
      }
    } else if (k === "works") {
      if (id === "done") { finishTurn(s); return true; }
      doWorks(s, p, a[1]);
      worksChoice(s, p, lotsOf(s, p).filter(function (x) { return x.charAt(0) === "e" && lot(s, x).type !== "good"; }).filter(function (x) { return pd.options.some(function (o) { return o.id.split(":")[1] === x; }); }));
      if (!s.pending) finishTurn(s);
      return true;
    } else if (k === "bank" || k === "shares") {
      if (id === "done") { finishTurn(s); return true; }
      if (a[0] === "borrow") { p.loan += +a[1]; p.cash += +a[1]; log(s, p.name + " borrows " + money(+a[1]) + "."); }
      else if (a[0] === "repay") { var r = a[1] === "all" ? p.loan : Math.min(+a[1], p.loan); p.loan -= r; p.cash -= r; log(s, p.name + " repays " + money(r) + "."); }
      else if (a[0] === "sell" && (s.props[a[1]] || /^e\d+$/.test(a[1]))) { var got = Math.round(lot(s, a[1]).value * 0.95); lot(s, a[1]).owner = -1; p.cash += got; log(s, p.name + " sells the " + lotName(a[1]) + " for " + money(got) + "."); }
      else if (a[0] === "sell") { var q = p.shares[a[1]] || 0, g = Math.round(q * s.price[a[1]]); p.cash += g; delete p.shares[a[1]]; log(s, p.name + " sells " + q + " shares for " + money(g) + "."); }
      else if (a[0] === "sh") { var n = Math.floor(+a[2] / s.price[a[1]]); p.shares[a[1]] = (p.shares[a[1]] || 0) + n; p.cash -= Math.round(n * s.price[a[1]]); log(s, p.name + " buys " + n + " shares of " + coName(a[1]) + "."); }
      if (k === "bank") bankChoice(s, p); else sharesChoice(s, p);
      return true;
    }
    if (!s.pending) finishTurn(s);
    return true;
  }
  var coName = function (id) { return (COMPANIES.filter(function (c) { return c[0] === id; })[0] || [0, id])[1]; };

  /* ---------------- the end of a turn: 3 months of life ---------------- */
  function finishTurn(s) {
    var p = cur(s);
    if (s.pending) return;
    if (p.again && !p.retired && !s.over) {                                   // 2.946.0: double 6 - the same player rolls again
      p.again = false; s.phase = "roll"; s._botBuys = 0; log(s, "🎲 " + p.name + " rolls again."); return;
    }
    p.again = false;
    p.age = Math.round((p.age + 0.25) * 100) / 100;
    if (p.ring === "college" && !p.night) p.studentDebt += MONEY.tuition;
    if (p.ring === "trade") p.cash += MONEY.apprentice;
    money0(p);
    var adult = !!p.job || p.ring === "jobs" || p.ring === "invest" || p.ring === "estate";
    if (p.job) {                                                                // 2.947.0: pay taxed on the Australian scale (PAYG)
      var gross = Math.round(p.job.salary / 4), wh = MN.withholding(p.job.salary, p.ins.health);
      p.cash += gross - wh; p.fy.salary += gross; p.fy.withheld += wh; p.paydays++;
      if (p.studentDebt > 0 && p.job.salary >= 50000) { var r = Math.min(p.studentDebt, Math.round(p.job.salary / 4 * MONEY.repay)); p.studentDebt -= r; p.cash -= r; }
      if (p.paydays >= 2 && !p.open) { p.open = true; log(s, "🔓 " + p.name + " has a stable income - the investment ring is open."); }
    } else if (adult) { p.cash += MN.BILL.jobseeker; p.paydays = 0; }
    if (adult) {                                                                // the quarter's bills
      var mine = lotsOf(s, p), pv = mine.reduce(function (t, k) { return t + lot(s, k).value; }, 0);
      var home = mine.some(function (k) { return lotType(s, k) !== "land"; }), b = MN.bills(p.budget, p.ins, home, pv);
      p.cash -= b.total; p.lastBills = b;
      if (p.ins.home && mine.length) p.fy.ded += b.insurance && MN.premium("home", pv);          // landlord insurance: deductible
      p.wellbeing = Math.max(0, Math.min(100, Math.round((p.wellbeing + (MN.FUN[p.budget.fun] || MN.FUN.cinema)[2] - MN.WB.drift) * 10) / 10));
    }
    var lots = lotsOf(s, p);
    if (p.loan > 0) { var intr = Math.round(p.loan * MONEY.interest); p.cash -= intr; if (lots.length) p.fy.ded += intr; }   // interest on an investment loan: deductible
    lots.forEach(function (k) { var y = Math.round(lot(s, k).value * YIELD[lotType(s, k)]); p.cash += y; p.fy.rent += y; });   // tenants (none on bare land)
    var dv = Math.round(sharesValue(s, p) * MONEY.dividend); p.cash += dv; p.fy.div += dv;
    if (Math.abs(p.age - Math.round(p.age)) < 1e-9) taxReturn(s, p);          // every birthday: the tax return
    if (p.cash < 0) raise(s, p);
    if (p.age >= s.retire && !p.retired) { p.retired = true; log(s, "🏖 " + p.name + " retires at " + Math.floor(p.age) + " - net worth " + money(netWorth(s, p)) + "."); }
    next(s);
  }
  /** the year's tax return: salary + rent + dividends - deductions (the $1,000 standard deduction or the real ones, whichever
   *  is bigger) taxed on the scale, less what was withheld -> a refund or a bill */
  function taxReturn(s, p) {
    var f = p.fy, income = f.salary + f.rent + f.div;
    if (income <= 0 && !f.withheld) { p.fy = { salary: 0, rent: 0, div: 0, ded: 0, withheld: 0 }; return; }
    var ded = Math.max(f.salary > 0 ? MN.STD_DEDUCTION : 0, Math.round(f.ded)), t = MN.taxOn(income - ded, p.ins && p.ins.health), diff = f.withheld - t.total;
    p.cash += diff;
    p.lastTax = { income: income, deductions: ded, taxable: t.taxable, tax: t.total, withheld: f.withheld, refund: diff, surcharge: t.surcharge, age: Math.round(p.age) };
    log(s, "🧾 " + p.name + "'s tax return: income " + money(income) + ", deductions " + money(ded) + ", tax " + money(t.total) + (t.surcharge ? " (incl. " + money(t.surcharge) + " Medicare levy surcharge - no hospital cover)" : "") +
      " - " + (diff >= 0 ? "a refund of " + money(diff) : "a bill of " + money(-diff)) + ".");
    p.fy = { salary: 0, rent: 0, div: 0, ded: 0, withheld: 0 };
  }
  /** 2.947.0: your budget and cover - setBudget(s, p, {food, fun}) / setCover(s, p, kind, on) (any time on your own turn) */
  function setBudget(s, p, o) { money0(p); if (o && MN.FOOD[o.food]) p.budget.food = o.food; if (o && MN.FUN[o.fun]) p.budget.fun = o.fun; return p.budget; }
  function setCover(s, p, kind, on) { money0(p); if (MN.COVER[kind]) { p.ins[kind] = !!on; log(s, (on ? "🛡 " + p.name + " takes out " : p.name + " drops ") + MN.COVER[kind].name.replace(/^\S+ /, "").toLowerCase() + " insurance."); } return p.ins; }
  /** short of cash: shares sold, then the cheapest property, then the bank; nothing left = bankrupt (out, retired) */
  function raise(s, p) {
    Object.keys(p.shares).forEach(function (k) { if (p.cash < 0) { p.cash += Math.round(p.shares[k] * s.price[k]); delete p.shares[k]; log(s, p.name + " has to sell shares in " + coName(k) + "."); } });
    lotsOf(s, p).sort(function (a, b) { return lot(s, a).value - lot(s, b).value; }).forEach(function (k) {
      if (p.cash >= 0) return; p.cash += Math.round(lot(s, k).value * 0.9); lot(s, k).owner = -1; log(s, p.name + " has to sell the " + lotName(k) + ".");
    });
    if (p.cash < 0 && loanLimit(p) - p.loan >= -p.cash) { var b = Math.ceil(-p.cash / 1000) * 1000; p.loan += b; p.cash += b; log(s, p.name + " borrows " + money(b) + " to cover bills."); }
    if (p.cash < -20000 && !lotsOf(s, p).length && !Object.keys(p.shares).length) { p.bankrupt = true; p.retired = true; log(s, "💥 " + p.name + " is bankrupt - out of the game."); }
  }
  function next(s) {
    s.pending = null; s.phase = "roll";
    if (s.players.every(function (p) { return p.retired; })) { s.over = true; s.phase = "over"; log(s, "🏁 Everyone has retired. " + standings(s)[0].name + " wins!"); return; }
    for (var n = 0; n < s.players.length; n++) {
      s.turn = (s.turn + 1) % s.players.length;
      if (s.turn === 0) endRound(s);
      if (!cur(s).retired) return;
    }
  }
  function endRound(s) {
    s.round++;
    COMPANIES.forEach(function (c) { s.price[c[0]] = Math.max(0.5, +(s.price[c[0]] * (1 + 0.012 + (rng(s) - 0.5) * 0.14)).toFixed(2)); });
    if (s.round % 4 === 1) {
      s.year++;
      var m = 0.05 + (rng(s) - 0.5) * 0.12;
      Object.keys(s.props).forEach(function (k) { s.props[k].value = Math.round(s.props[k].value * (1 + m + (rng(s) - 0.5) * 0.04) / 1000) * 1000; });
      Object.keys(s.estate || {}).forEach(function (k) { var e = s.estate[k]; e.value = Math.round(e.value * (1 + m + (e.type === "land" ? WORKS.landGrowth : 0) + (rng(s) - 0.5) * 0.04) / 1000) * 1000; });
      log(s, "📅 A year passes - property " + (m >= 0 ? "up " : "down ") + Math.abs(Math.round(m * 100)) + "%.");
    }
  }
  function standings(s) { return s.players.map(function (p) { return { id: p.id, name: p.name, worth: netWorth(s, p), score: score(s, p) }; }).sort(function (a, b) { return b.score - a.score; }); }

  /* ---------------- bots: rule-based, each with a personality ---------------- */
  function botChoice(s, p, pd) {
    var o = pd.options.filter(function (x) { return !x.off; }), has = function (id) { return o.some(function (x) { return x.id === id; }); };
    var byPrefix = function (pre) { return o.filter(function (x) { return x.id.indexOf(pre) === 0; }); };
    if (pd.kind === "fork") {
      if (has("college") && (p.bot === "risk" || p.skill >= 0.7 || (p.bot === "saver" && p.iq >= 108))) return "college";
      if (p.bot === "tycoon" || !has("trade")) return "factory";
      return "trade";
    }
    if (pd.kind === "job") { var js = byPrefix("job:"); return js.length && (!p.job || jobOf(js[0].id.slice(4)).salary > p.job.salary) ? js[0].id : "keep"; }
    if (pd.kind === "gate") {
      if (has("out")) return "out";
      if (has("estate")) return (p.bot === "saver" ? p.cash > 120000 : p.cash > 50000) && rng(s) < 0.6 ? "estate" : "stay";
      return p.cash < 40000 || rng(s) < 0.3 ? "in" : "stay";
    }
    if (pd.kind === "works") {
      var wk = o.filter(function (x) { return x.id !== "done"; })[0], need = p.bot === "saver" ? 60000 : p.bot === "tycoon" ? 10000 : 30000;
      return wk && (s._botBuys || 0) < 2 && p.cash >= need + works(s, wk.id.split(":")[1]).cost * MONEY.deposit ? (s._botBuys = (s._botBuys || 0) + 1, wk.id) : "done";
    }
    if (pd.kind === "night") return has("enrol") && p.bot === "risk" && p.cash > 15000 ? "enrol" : "no";
    if (pd.kind === "buy") {
      var b = byPrefix("buy:")[0]; if (!b) return "pass";
      var at = b.id.split(":")[1], v = lot(s, at).value * (+b.id.split(":")[2] || 100) / 100, buffer = p.bot === "saver" ? 30000 : p.bot === "tycoon" ? 5000 : 15000;
      return p.cash - Math.min(p.cash, v * MONEY.deposit) >= buffer || p.cash >= v + buffer ? b.id : "pass";
    }
    if (pd.kind === "shares") {
      if ((s._botBuys || 0) >= 2) return "done";
      var want = p.bot === "risk" ? 30000 : p.bot === "saver" ? 80000 : 120000;
      if (p.cash > want) { var sh = byPrefix("sh:"); if (sh.length) { s._botBuys = (s._botBuys || 0) + 1; return sh[Math.floor(rng(s) * sh.length)].id; } }
      return "done";
    }
    if (pd.kind === "bank") {
      if ((s._botBuys || 0) >= 2) return "done";
      if (p.loan > 0 && p.cash > (p.bot === "saver" ? 40000 : 90000) && has("repay:25000")) { s._botBuys = (s._botBuys || 0) + 1; return "repay:25000"; }
      return "done";
    }
    return o.length ? o[o.length - 1].id : null;
  }
  /** one move for the bot whose turn it is: roll, answer (right skill of the time - less at college), or choose */
  function botStep(s) {
    var p = cur(s);
    if (s.over || !p.bot) return false;
    if (!s.pending) { s._botBuys = 0; roll(s); return true; }
    if (s.pending.type === "puzzle") { var sk = s.pending.level === "college" ? p.skill - 0.1 : p.skill; answer(s, rng(s) < sk); return true; }
    var id = botChoice(s, p, s.pending);
    if (id == null || !choose(s, id)) { s.pending = null; s.phase = "roll"; finishTurn(s); }
    return true;
  }

  var API = { RINGS: RINGS, PROPS: PROPS, COMPANIES: COMPANIES, JOBS: JOBS, MONEY: MONEY, NEED: NEED, QBONUS: QBONUS, COLORS: COLORS, PERSONAS: PERSONAS,
              newGame: newGame, current: cur, square: square, canRoll: canRoll, roll: roll, answer: answer, choose: choose, botStep: botStep,
              offers: offers, loanLimit: loanLimit, netWorth: netWorth, score: score, standings: standings, propsOf: propsOf, sharesValue: sharesValue,
              money: money, coName: coName, rng: rng,
              MN: MN, money0: money0, taxReturn: taxReturn, setBudget: setBudget, setCover: setCover,
              LUCK: LUCK, LUCKWORD: LUCKWORD, luck: luck, stageOf: stageOf,
              ESTATE: ESTATE, WORKS: WORKS, YIELD: YIELD, LANDRENT: LANDRENT, upgrade: upgrade, lot: lot, lotType: lotType, lotName: lotName, lotsOf: lotsOf, works: works };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3LifeCore = API;
})(typeof window !== "undefined" ? window : this);
