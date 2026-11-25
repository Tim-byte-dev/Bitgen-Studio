/* bitGen Studio — ext/lifedock/lifellm.js (2.964.0): 🎓 LIFE CHOICES's 🧠 LLM PLAYER - what the LLM is told and how its answer
 * is read (window.H3LifeLLM in the page, require() in lifeserver.js - one file, so the page and the server never disagree).
 *
 * Stage 2 of the design (claude/LIFE-CHOICES-DESIGN.md): "an optional 🧠 LLM player decides only the big choices (career,
 * buy / sell, loans) with a timeout that falls back to the rule bot". It rolls and answers puzzles like its fallback bot
 * (lifecore.js); for every choice the page sends payload(s) to POST /api/life-choices/llm, the server cleans it (clean),
 * builds messages(o), asks bitGen's LLM (lib/llmChat.js - whichever LLM the app uses) and reads the reply (parse). The page
 * makes the pick only when it is one of the options still open; anything else = the rule bot's pick.
 *
 *   brief(s, p, core?) the player's situation in plain words (age, years left, cash, IQ, work, debts, property, shares, rivals)
 *   payload(s, core?)  {name, brief, kind, title, text, options [{id, label}]} - only the options that can be picked
 *   clean(o)           the server's check: sizes, ids, at least two options - throws {status 400} on nonsense
 *   messages(o)        [{system}, {user}] - answer as JSON {"choice": n, "why": "..."}
 *   parse(text, opts)  -> {id, why} | null - JSON, else "choice 3" / "3." / an option's own words
 */
(function (root) {
  "use strict";
  var C = typeof module !== "undefined" && module.exports ? null : root.H3LifeCore;   // the page only (brief / payload)
  var money = function (v) { return (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-AU"); };
  var RING = { hs: "high school", fork: "the fork (choosing a path)", college: "college", trade: "an apprenticeship", jobs: "the jobs ring",
               invest: "the investment ring", estate: "the land & houses ring" };
  var QUALW = { none: "no qualification", diploma: "a high school diploma", trade: "a trade licence", degree: "a degree" };
  var KINDS = ["fork", "job", "gate", "night", "buy", "works", "bank", "shares"];
  var ID = /^[a-z0-9:_.-]{1,40}$/i;

  function brief(s, p, core) {
    var K = core || C;
    var years = Math.max(0, s.retire - p.age), lots = K.lotsOf(s, p);
    var L = [];
    L.push("You are " + p.name + ", age " + Math.floor(p.age) + " (you retire at " + s.retire + ", " + (Math.round(years * 4) / 4) + " years from now; every turn is 3 months).");
    L.push("Where: " + (RING[p.ring] || p.ring) + ". Qualification: " + QUALW[p.qual] + ". IQ score " + p.iq + ".");
    L.push(p.job ? "Work: " + p.job.title + ", " + money(p.job.salary) + " a year (level " + p.job.level + " of " + p.job.levels + ")." : "Work: none.");
    L.push("Cash " + money(p.cash) + ". Bank loan " + money(p.loan) + " of " + money(K.loanLimit(p)) + " allowed (interest 6% a year)." + (p.studentDebt ? " Student debt " + money(p.studentDebt) + "." : ""));
    if (lots.length) L.push("You own: " + lots.map(function (k) { return K.lotName(k) + " (" + K.lotType(s, k) + ", " + money(K.lot(s, k).value) + ")"; }).join("; ") + ".");
    var sh = Object.keys(p.shares || {}).filter(function (k) { return p.shares[k]; });
    if (sh.length) L.push("Shares: " + sh.map(function (k) { return p.shares[k] + " " + K.coName(k) + " at $" + Number(s.price[k]).toFixed(2); }).join("; ") + ".");
    if (p.wellbeing != null) L.push("Wellbeing " + Math.round(p.wellbeing) + " of 100.");
    L.push("Net worth " + money(K.netWorth(s, p)) + ". The other players: " + s.players.filter(function (q) { return q !== p; }).map(function (q) {
      return q.name + " " + money(K.netWorth(s, q)) + (q.retired ? " (retired)" : ""); }).join(", ") + ".");
    if (s.news) L.push("Latest news: " + s.news);
    return L.join("\n");
  }
  function payload(s, core) {
    var K = core || C, p = K.current(s), pd = s.pending;
    if (!pd || pd.type !== "choice") return null;
    return { name: p.name, brief: brief(s, p, K), kind: pd.kind, title: pd.title, text: pd.text || "",
             options: pd.options.filter(function (o) { return !o.off; }).map(function (o) { return { id: o.id, label: o.label }; }) };
  }
  var str = function (v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").slice(0, n); };
  function clean(o) {
    o = o || {};
    var bad = function (m) { throw Object.assign(new Error(m), { status: 400 }); };
    if (KINDS.indexOf(o.kind) < 0) bad("not a choice the 🧠 player makes");
    var opts = (Array.isArray(o.options) ? o.options : []).slice(0, 30).filter(function (x) { return x && ID.test(String(x.id)); })
      .map(function (x) { return { id: String(x.id), label: str(x.label, 160) }; });
    if (opts.length < 2) bad("fewer than two options");
    return { name: str(o.name, 18) || "Player", brief: str(o.brief, 3000), kind: o.kind, title: str(o.title, 120), text: str(o.text, 600), options: opts };
  }
  var SYSTEM = "You are a player in Life Choices, a board game of a whole life: high school, then college, a trade or the factory, " +
    "jobs, then property, shares and bank loans. The winner, when everyone has retired, has the highest score: net worth + $1,000 " +
    "for every IQ point over 100 + a bonus for a qualification (diploma $10,000, trade $30,000, degree $50,000) + $2,000 for every " +
    "wellbeing point over 50. Debt costs interest; property pays rent and grows; running out of cash forces sales. " +
    "Play to win, think about the years you have left, and do not take a loan you cannot carry. " +
    "Pick exactly ONE of the numbered options. Answer with JSON only, nothing else: {\"choice\": <the option's number>, \"why\": \"<one short sentence>\"}";
  function messages(o) {
    var c = clean(o);
    var user = c.brief + "\n\nThe choice now - " + c.title + (c.text ? ": " + c.text : "") + "\n" +
      c.options.map(function (x, i) { return (i + 1) + ". " + x.label; }).join("\n") + "\n\nReply with JSON only.";
    return [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
  }
  /** read the LLM's answer: JSON first, else a number it named, else an option's own words */
  function parse(text, opts) {
    var t = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim(), n = null, why = "";
    var m = t.match(/\{[\s\S]*?\}/);
    if (m) { try { var j = JSON.parse(m[0]); n = Number(j.choice != null ? j.choice : j.option); why = String(j.why || j.reason || ""); } catch (e) { /* not JSON after all */ } }
    if (!(n >= 1 && n <= opts.length)) {
      var m2 = t.match(/(?:choice|option|pick|number)\s*[:#]?\s*"?(\d{1,2})\b/i) || t.match(/^\s*\(?(\d{1,2})[.):\s]/);
      n = m2 ? Number(m2[1]) : null;
    }
    if (!(n >= 1 && n <= opts.length)) {
      var low = t.toLowerCase(), best = -1, bestLen = 0;
      opts.forEach(function (x, i) { var l = String(x.label).toLowerCase(); if (l.length > bestLen && low.indexOf(l) >= 0) { best = i; bestLen = l.length; } });
      n = best >= 0 ? best + 1 : null;
    }
    if (!(n >= 1 && n <= opts.length)) return null;
    if (!why) why = t.replace(/\{[\s\S]*?\}/, "").replace(/\s+/g, " ").trim();
    return { id: opts[n - 1].id, why: why.slice(0, 200) };
  }
  var API = { brief: brief, payload: payload, clean: clean, messages: messages, parse: parse, KINDS: KINDS, SYSTEM: SYSTEM };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3LifeLLM = API;
})(typeof window !== "undefined" ? window : this);
