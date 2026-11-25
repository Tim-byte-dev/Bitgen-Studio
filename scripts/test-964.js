#!/usr/bin/env node
// bitGen Studio 2.964.0 - 🎓 Life Choices stage 2: pass-and-play (2-6 seats - people, bots, 🧠 LLM players) and the 🧠 LLM
// player (lifellm.js + POST /api/life-choices/llm). The browser test is scripts/test-ui964-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const C = require("../ext/lifedock/lifecore.js");
const L = require("../ext/lifedock/lifellm.js");
const S = require("../ext/lifedock/lifeserver.js");

(async () => {
  // ---- the rules core
  const g = C.newGame({ seed: 7, players: [{ name: "Ann" }, { name: "Ben" }, { name: "Nova", llm: true }, { name: "Kai", bot: "risk" }] });
  check("seats: two people, a 🧠 LLM player (on a property tycoon's legs) and a bot; humans() = the people",
    C.humans(g).map((p) => p.name).join() === "Ann,Ben" && g.players[2].llm === true && g.players[2].bot === "tycoon" && g.players[3].llm === false && g.players[3].bot === "risk" && g.handed === -1,
    g.players.map((p) => [p.name, p.bot, p.llm]));
  check("the first log line names the 🧠 player", /Nova \(🧠 LLM player\)/.test(g.log[0].t) && /Kai \(risk-taker\)/.test(g.log[0].t), g.log[0].t);
  const llm2 = C.newGame({ seed: 2, players: [{ name: "A" }, { name: "B", llm: true, bot: "saver" }] });
  check("a 🧠 player can take another fallback persona", llm2.players[1].bot === "saver" && llm2.players[1].llm);
  const old = JSON.parse(JSON.stringify(C.newGame({ seed: 3, players: [{ name: "A" }, { name: "B", bot: "saver" }] })));
  delete old.handed; old.players.forEach((p) => delete p.llm);
  C.upgrade(old);
  check("an older save gets handed = -1 and llm = false", old.handed === -1 && old.players.every((p) => p.llm === false));
  // botPick / botApply on a 🧠 player's fork
  const f = C.newGame({ seed: 11, players: [{ name: "Nova", llm: true, skill: 0.9 }, { name: "Kai", bot: "saver" }] });
  const n0 = f.players[0]; n0.ring = "fork"; n0.qual = "diploma";
  C.roll(f);
  const pick = C.botPick(f);
  check("botPick: the rule bot's pick for the 🧠 player's choice (the fork), nothing applied yet", f.pending && f.pending.kind === "fork" && ["college", "trade", "factory"].includes(pick) && n0.ring === "fork", { pend: f.pending && f.pending.kind, pick });
  check("botApply(id) makes the pick", C.botApply(f, "trade") === true && n0.ring === "trade" && !f.pending);
  const f2 = C.newGame({ seed: 12, players: [{ name: "Nova", llm: true }, { name: "Kai", bot: "saver" }] });
  f2.players[0].ring = "fork"; C.roll(f2);
  const t0 = f2.turn;
  check("botApply with an id that is not there ends the turn (as the rule bot does)", C.botApply(f2, "nope") === false && !f2.pending && f2.turn !== t0);
  check("botPick is null without a choice on the table", C.botPick(f2) === null);
  C.note(f2, "🧠 hello"); check("note(s, text) logs a line", f2.log[f2.log.length - 1].t === "🧠 hello");
  // a whole game: people (first open option), the 🧠 player (an LLM stand-in that always takes the last open option), a bot
  const w = C.newGame({ seed: 99, retire: 30, players: [{ name: "Ann" }, { name: "Ben" }, { name: "Nova", llm: true }, { name: "Kai", bot: "saver" }] });
  let steps = 0, llmAsks = 0;
  while (!w.over && steps < 20000) {
    steps++;
    const p = C.current(w);
    if (p.llm && w.pending && w.pending.type === "choice" && L.KINDS.includes(w.pending.kind)) {
      const body = L.payload(w, C); llmAsks++;
      const o = body.options[body.options.length - 1];
      if (!C.botApply(w, o ? o.id : C.botPick(w))) continue;
      if (w.pending && w.pending.type === "choice" && C.current(w) === p) C.botApply(w, C.botPick(w));   // the 3-a-turn cap: the rule bot finishes
      continue;
    }
    if (p.bot) { C.botStep(w); continue; }
    if (!w.pending) C.roll(w);
    else if (w.pending.type === "puzzle") C.answer(w, steps % 3 !== 0);
    else { const o = w.pending.options.find((x) => !x.off && !/^(borrow|sh|buy|build|reno)/.test(x.id)) || w.pending.options.find((x) => !x.off); C.choose(w, o.id) || (w.pending = null, w.phase = "roll"); }
  }
  check("a whole pass-and-play game with a 🧠 player and a bot plays to the end (retire at 30)", w.over && w.players.every((p) => p.retired) && llmAsks > 0, { over: w.over, steps, llmAsks, round: w.round });
  // ---- lifellm.js
  const s = C.newGame({ seed: 5, players: [{ name: "Ann" }, { name: "Nova", llm: true }] });
  const nv = s.players[1]; nv.age = 30; nv.cash = 42000; nv.job = { id: "plumber", title: "Plumber", salary: 84000, level: 2, levels: 4 }; nv.ring = "invest"; nv.pos = 1; nv.open = true; nv.loan = 10000;
  s.turn = 1; C.roll(s, 1);   // a plain move onto the Studio flat? pos 2 = Townhouse
  const b = L.brief(s, nv, C);
  check("brief: age, years to retirement, cash, work, the loan and its limit, rivals' worth", /age 30/.test(b) && /35 years from now/.test(b) && /Cash \$4[0-9],/.test(b) && /Plumber, \$84,000 a year/.test(b) && /Bank loan \$10,000 of \$420,000/.test(b) && /Ann \$/.test(b), b);
  const pl = s.pending && s.pending.type === "choice" ? L.payload(s, C) : null;
  check("payload: the choice and only its OPEN options", pl && pl.kind === "buy" && pl.options.length >= 1 && pl.options.every((o) => s.pending.options.find((x) => x.id === o.id && !x.off)), { pend: s.pending, pl });
  let bad = 0;
  for (const o of [{ kind: "rm -rf", options: [{ id: "a", label: "x" }, { id: "b", label: "y" }] }, { kind: "buy", options: [{ id: "a", label: "x" }] }, { kind: "buy", options: [{ id: "a b", label: "x" }, { id: "c;d", label: "y" }] }]) {
    try { L.clean(o); } catch (e) { if (e.status === 400) bad++; }
  }
  check("clean: refuses an unknown kind, fewer than two options, ids with spaces / semicolons (400)", bad === 3, bad);
  const c = L.clean({ name: "N".repeat(40), brief: "x".repeat(5000), kind: "bank", title: "The bank", text: "t", options: [{ id: "borrow:25000", label: "Borrow" }, { id: "done", label: "Done" }] });
  check("clean: names, the brief and labels cut to size", c.name.length === 18 && c.brief.length === 3000 && c.options.length === 2);
  const m = L.messages({ kind: "bank", title: "The bank", text: "Loan $0", brief: "You are N.", options: [{ id: "borrow:25000", label: "Borrow $25,000" }, { id: "done", label: "Done" }] });
  check("messages: the game's rules + JSON only in the system; the brief, the choice and numbered options in the user turn",
    m.length === 2 && m[0].role === "system" && /\{"choice": <the option's number>/.test(m[0].content) && /net worth/.test(m[0].content) && /1\. Borrow \$25,000\n2\. Done/.test(m[1].content) && /You are N\./.test(m[1].content), m);
  const O = [{ id: "college", label: "🎓 College - a degree" }, { id: "trade", label: "🔧 Trades - an apprenticeship" }, { id: "factory", label: "🏭 Factory - paid from day one" }];
  const P1 = L.parse('{"choice": 2, "why": "Steady pay sooner."}', O), P2 = L.parse("<think>hmm 3</think>Option 1 because degrees pay most", O),
    P3 = L.parse("3. the factory", O), P4 = L.parse("I would go with 🔧 Trades - an apprenticeship.", O), P5 = L.parse("no idea", O), P6 = L.parse('{"choice": 9}', O),
    P7 = L.parse('```json\n{"choice":"1","why":"x"}\n```', O);
  check("parse: JSON (with its why), 'Option 1' (thinking stripped), '3.', an option's own words; nonsense / out of range -> null",
    P1 && P1.id === "trade" && P1.why === "Steady pay sooner." && P2 && P2.id === "college" && P3 && P3.id === "factory" && P4 && P4.id === "trade" && P5 === null && P6 === null && P7 && P7.id === "college", [P1, P2, P3, P4, P5, P6, P7]);
  // ---- the server part
  let seen = null;
  S.setComplete(async (q) => { seen = q; return { ok: true, text: '{"choice": 1, "why": "Cheap and close."}' }; });
  const d1 = await S.decide({ kind: "buy", title: "For sale", brief: "b", options: [{ id: "buy:2", label: "Buy it" }, { id: "pass", label: "Pass" }] });
  check("decide: bitGen's LLM asked with lifellm's messages (temperature 0.4) -> {id, why}", d1.id === "buy:2" && d1.why === "Cheap and close." && seen && seen.messages.length === 2 && seen.temperature === 0.4, { d1, seen });
  S.setComplete(async () => ({ ok: false, status: 400, error: "No .gguf model found" }));
  let e1 = null; try { await S.decide({ kind: "buy", options: [{ id: "a", label: "x" }, { id: "b", label: "y" }] }); } catch (e) { e1 = e; }
  check("decide: no LLM -> 502 with the LLM's own words", e1 && e1.status === 502 && /No \.gguf/.test(e1.message), e1 && e1.message);
  S.setComplete(async () => ({ ok: true, text: "the weather is nice" }));
  let e2 = null; try { await S.decide({ kind: "buy", options: [{ id: "a", label: "x" }, { id: "b", label: "y" }] }); } catch (e) { e2 = e; }
  check("decide: an answer that names no option -> 502", e2 && e2.status === 502 && /named none of the options/.test(e2.message));
  let e3 = null; try { await S.decide({ kind: "shell", options: [] }); } catch (e) { e3 = e; }
  check("decide: nonsense in -> 400 before any LLM", e3 && e3.status === 400);
  S.setComplete(null);
  const SV = src("ext/lifedock/lifeserver.js");
  check("the route: POST /api/life-choices/llm in the extension's own server part (lib/llmChat complete - never server.js)",
    /app\.post\("\/api\/life-choices\/llm", express\.json\(\{ limit: "32kb" \}\)/.test(SV) && /require\("\.\.\/\.\.\/lib\/llmChat"\)\.complete\(require\("\.\.\/\.\.\/lib\/core"\), q\)/.test(SV) && !/life-choices/.test(src("misc/server.js")));
  // ---- the view (statics)
  const J = src("ext/lifedock/lifedock.js"), H = src("ext/lifedock/dock.html"), E = JSON.parse(src("ext/lifedock/ext.json"));
  check("ext.json: lifellm.js after the core, before the view", E.scripts.indexOf("lifellm.js") > E.scripts.indexOf("lifecore.js") && E.scripts.indexOf("lifellm.js") < E.scripts.indexOf("lifedock.js"));
  check("the set-up: seats (people / three bots / 🧠), ＋ Person, ＋ 🧠, Bots n, the 🧠 wait, Start needs two",
    /id="lcSeats"/.test(H) && /id="lcAddPerson"/.test(H) && /id="lcAddLlm"/.test(H) && /id="lcBots"[^>]*><option>0<\/option>/.test(H) && /id="lcLlmWait"/.test(H) &&
    /\["human", "🙂 Person"\], \["saver", "🤖 Bot: careful saver"\], \["tycoon", "🤖 Bot: property tycoon"\], \["risk", "🤖 Bot: risk-taker"\], \["llm", "🧠 LLM player"\]/.test(J) && /\$\("lcStart"\)\.disabled = G\.seats\.length < 2;/.test(J));
  check("pass the PC: two or more people, not yet handed, nothing pending; Enter / ▶ hands it over; no roll before",
    /return !!\(p && !s\.pending && !s\.puz && C\.humans\(s\)\.length > 1 && s\.handed !== p\.id\);/.test(J) && /if \(needPass\(s\)\) \{ passGo\(\); return true; \}/.test(J) && /G\.rolling \|\| needPass\(s\)\) return;/.test(J) && /id="lcPass"/.test(H) && /id="lcPassGo"/.test(H));
  check("the 🧠 loop: up to 3 asks a turn, its time limit (aborted), a wrong / missing answer = the rule bot, two failures = 5 minutes of its own rules",
    /var LLMMAX = 3;/.test(J) && /ac\.abort\(\)/.test(J) && /C\.botApply\(s, C\.botPick\(s\)\);/.test(J) && /G\.llmOffUntil = Date\.now\(\) \+ 5 \* 60000;/.test(J) && /if \(G\.s !== s \|\| s\.pending !== pd\) \{ after\(\); return; \}/.test(J));
  check("every person's score goes to 🏆", /people\.forEach\(function \(me\) \{\s*fetch\("\/api\/life-choices\/scores"/.test(J));
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
