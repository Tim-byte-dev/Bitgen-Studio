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
 * WINNER at the end: net worth + (IQ - 100) x $1,000 + a qualification bonus (diploma $10k, trade $30k, degree $50k).
 *
 * newGame({seed, retire, players: [{name, bot: null | "saver" | "tycoon" | "risk", skill 0-1}]}) -> state (plain JSON -
 * save it as it is);  roll(s, die?) -> events;  answer(s, right);  choose(s, optionId);  botStep(s) (one bot move);
 * s.pending = null | {type: "puzzle", level, topic, square} | {type: "choice", kind, title, text, options [{id, label, off, why}]}
 */
(function (root) {
  "use strict";
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
             ["exchange", "Exchange"], ["prop", "Apartment block"], ["news", "Market news"], ["prop", "Office tower"]],
  };
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
    COMPANIES.forEach(function (c) { s.price[c[0]] = 10 + Math.round(rng(s) * 40); });
    log(s, "A new game: " + s.players.map(function (p) { return p.name + (p.bot ? " (" + PERSONAS[p.bot] + ")" : ""); }).join(", ") + " - retire at " + s.retire + ".");
    return s;
  }
  var cur = function (s) { return s.players[s.turn]; };
  var square = function (p) { var r = RINGS[p.ring]; return r ? r[p.pos % r.length] : ["fork", "The fork"]; };
  function propsOf(s, p) { return Object.keys(s.props).filter(function (k) { return s.props[k].owner === p.id; }); }
  function sharesValue(s, p) { return Object.keys(p.shares).reduce(function (t, k) { return t + p.shares[k] * s.price[k]; }, 0); }
  function netWorth(s, p) { return Math.round(p.cash + propsOf(s, p).reduce(function (t, k) { return t + s.props[k].value; }, 0) + sharesValue(s, p) - p.loan - p.studentDebt); }
  function score(s, p) { return netWorth(s, p) + (p.iq - 100) * 1000 + QBONUS[p.qual]; }
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
    log(s, p.name + " starts work: " + j.title + " (" + money(j.salary) + " a year).");
  }

  /* ---------------- moving ---------------- */
  function canRoll(s) { return !s.over && s.phase === "roll" && !s.pending; }
  function roll(s, die) {
    if (!canRoll(s)) return [];
    var p = cur(s);
    if (p.ring === "fork") { forkChoice(s, p); return ["fork"]; }
    var d = p.ring === "trade" ? 1 : (die >= 1 && die <= 6 ? Math.floor(die) : 1 + Math.floor(rng(s) * 6));
    s.lastRoll = d;
    var n = RINGS[p.ring].length;
    if (p.ring === "trade") p.pos = Math.min(n - 1, p.pos + 1);
    else p.pos = (p.pos + d) % n;
    log(s, p.name + (p.ring === "trade" ? " moves one square" : " rolls " + d) + " -> " + square(p)[1] + ".");
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
        buyChoice(s, p, p.pos);
      } else if (pr.owner !== p.id) {
        var o = s.players[pr.owner], rent = Math.round(pr.value * MONEY.rentFrac);
        p.cash -= rent; o.cash += rent; log(s, p.name + " pays " + o.name + " " + money(rent) + " rent for the " + name + ".");
      } else log(s, p.name + " checks on their " + name + ".");
    } else if (k === "news") news(s, p);
    else if (k === "exchange") { if (p.open) sharesChoice(s, p); else log(s, p.name + " watches the exchange - not open to them yet."); }
    else if (k === "rates") {
      var v = propsOf(s, p).reduce(function (t, x) { return t + s.props[x].value; }, 0), c = Math.round(v * MONEY.rates);
      if (c) { p.cash -= c; log(s, p.name + " pays " + money(c) + " rates and land tax."); } else log(s, p.name + ": no property, no rates.");
    } else if (k === "night") nightChoice(s, p);
  }
  function buyChoice(s, p, at) {
    var pr = s.props[at], v = pr.value, dep = Math.round(v * MONEY.deposit), need = v - dep, room = loanLimit(p) - p.loan;
    var cashAll = p.cash >= v, mort = p.cash >= dep && need <= room;
    choice(s, "buy", "For sale: " + RINGS.invest[at][1], money(v) + " - tenants pay about " + money(v * MONEY.tenant) + " a quarter; players who land here pay you " + money(v * MONEY.rentFrac) + ".", [
      { id: "buy:" + at, label: cashAll ? "Buy it with cash" : "Buy it (" + money(dep) + " deposit, " + money(need) + " loan)", off: !(cashAll || mort),
        why: p.cash < dep ? "the deposit is " + money(dep) : "the bank lends up to " + money(loanLimit(p)) + " on your income (" + money(p.loan) + " owed)" },
      { id: "pass", label: "Pass" }]);
  }
  function bankChoice(s, p) {
    var room = Math.max(0, loanLimit(p) - p.loan), mine = propsOf(s, p);
    choice(s, "bank", "The bank", "Loan " + money(p.loan) + " of " + money(loanLimit(p)) + " (5x your salary), interest 6% a year. Cash " + money(p.cash) + ".",
      [{ id: "borrow:25000", label: "Borrow $25,000", off: room < 25000, why: "over your limit" },
       { id: "borrow:100000", label: "Borrow $100,000", off: room < 100000, why: "over your limit" },
       { id: "repay:25000", label: "Repay $25,000", off: p.loan < 1 || p.cash < Math.min(25000, p.loan), why: p.loan < 1 ? "nothing owed" : "not enough cash" },
       { id: "repay:all", label: "Repay it all (" + money(p.loan) + ")", off: p.loan < 1 || p.cash < p.loan, why: p.loan < 1 ? "nothing owed" : "not enough cash" }]
      .concat(mine.map(function (k) { return { id: "sell:" + k, label: "Sell the " + RINGS.invest[k][1] + " (" + money(s.props[k].value * 0.95) + ")" }; }))
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
      s.news = "Property market " + (up2 ? "up " : "down ") + Math.round(pc * 100) + "%.";
    }
    log(s, "📰 " + s.news);
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
    else if (k === "gate") { if (id === "out") { p.ring = "invest"; p.pos = 0; log(s, p.name + " moves out to the investment ring."); } }
    else if (k === "night") { if (id === "enrol") { p.cash -= MONEY.night; p.ring = "college"; p.pos = 0; p.night = true; p.colRight = 0; p.colWrong = 0; log(s, p.name + " enrols in night school."); } }
    else if (k === "buy") {
      if (a[0] === "buy") {
        var at = a[1], v = s.props[at].value, fromCash = p.cash >= v ? v : Math.round(v * MONEY.deposit);   // cash if there is enough, else the deposit + a loan
        p.cash -= fromCash; p.loan += v - fromCash; s.props[at].owner = p.id;
        log(s, "🏠 " + p.name + " buys the " + RINGS.invest[at][1] + " for " + money(v) + (v - fromCash > 0 ? " (" + money(v - fromCash) + " loan)" : "") + ".");
      }
    } else if (k === "bank" || k === "shares") {
      if (id === "done") { finishTurn(s); return true; }
      if (a[0] === "borrow") { p.loan += +a[1]; p.cash += +a[1]; log(s, p.name + " borrows " + money(+a[1]) + "."); }
      else if (a[0] === "repay") { var r = a[1] === "all" ? p.loan : Math.min(+a[1], p.loan); p.loan -= r; p.cash -= r; log(s, p.name + " repays " + money(r) + "."); }
      else if (a[0] === "sell" && s.props[a[1]]) { var got = Math.round(s.props[a[1]].value * 0.95); s.props[a[1]].owner = -1; p.cash += got; log(s, p.name + " sells the " + RINGS.invest[a[1]][1] + " for " + money(got) + "."); }
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
    p.age = Math.round((p.age + 0.25) * 100) / 100;
    if (p.ring === "college" && !p.night) p.studentDebt += MONEY.tuition;
    if (p.ring === "trade") p.cash += MONEY.apprentice;
    if (p.job) {
      var pay = Math.round(p.job.salary / 4 * (1 - MONEY.tax));
      p.cash += pay - MONEY.living; p.paydays++;
      if (p.studentDebt > 0 && p.job.salary >= 50000) { var r = Math.min(p.studentDebt, Math.round(p.job.salary / 4 * MONEY.repay)); p.studentDebt -= r; p.cash -= r; }
      if (p.paydays >= 2 && !p.open) { p.open = true; log(s, "🔓 " + p.name + " has a stable income - the investment ring is open."); }
    } else if (p.ring === "jobs" || p.ring === "invest") { p.cash -= MONEY.jobless; p.paydays = 0; }
    if (p.loan > 0) p.cash -= Math.round(p.loan * MONEY.interest);
    propsOf(s, p).forEach(function (k) { p.cash += Math.round(s.props[k].value * MONEY.tenant); });
    p.cash += Math.round(sharesValue(s, p) * MONEY.dividend);
    if (p.cash < 0) raise(s, p);
    if (p.age >= s.retire && !p.retired) { p.retired = true; log(s, "🏖 " + p.name + " retires at " + Math.floor(p.age) + " - net worth " + money(netWorth(s, p)) + "."); }
    next(s);
  }
  /** short of cash: shares sold, then the cheapest property, then the bank; nothing left = bankrupt (out, retired) */
  function raise(s, p) {
    Object.keys(p.shares).forEach(function (k) { if (p.cash < 0) { p.cash += Math.round(p.shares[k] * s.price[k]); delete p.shares[k]; log(s, p.name + " has to sell shares in " + coName(k) + "."); } });
    propsOf(s, p).sort(function (a, b) { return s.props[a].value - s.props[b].value; }).forEach(function (k) {
      if (p.cash >= 0) return; p.cash += Math.round(s.props[k].value * 0.9); s.props[k].owner = -1; log(s, p.name + " has to sell the " + RINGS.invest[k][1] + ".");
    });
    if (p.cash < 0 && loanLimit(p) - p.loan >= -p.cash) { var b = Math.ceil(-p.cash / 1000) * 1000; p.loan += b; p.cash += b; log(s, p.name + " borrows " + money(b) + " to cover bills."); }
    if (p.cash < -20000 && !propsOf(s, p).length && !Object.keys(p.shares).length) { p.bankrupt = true; p.retired = true; log(s, "💥 " + p.name + " is bankrupt - out of the game."); }
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
    if (pd.kind === "gate") return "out";
    if (pd.kind === "night") return has("enrol") && p.bot === "risk" && p.cash > 15000 ? "enrol" : "no";
    if (pd.kind === "buy") {
      var b = byPrefix("buy:")[0]; if (!b) return "pass";
      var at = b.id.slice(4), v = s.props[at].value, buffer = p.bot === "saver" ? 30000 : p.bot === "tycoon" ? 5000 : 15000;
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
              money: money, coName: coName, rng: rng };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3LifeCore = API;
})(typeof window !== "undefined" ? window : this);
