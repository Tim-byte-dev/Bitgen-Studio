#!/usr/bin/env node
/* bitGen Studio — 2.964.0 in a REAL browser: 🎓 LIFE CHOICES stage 2 - the seats (people, bots, 🧠 LLM players; Bots n keeps the
 * people; Start needs two), pass-and-play (the "pass the PC" screen before each person's turn, Enter / ▶, no roll before it,
 * kept over a reload), the 🧠 player's choice made by bitGen's LLM (a stand-in OpenAI-style server here, through the app's own
 * /api/life-choices/llm -> lib/llmChat), its reason in the log; too slow / no LLM -> the rule bot's pick; two failures -> its own
 * rules for 5 minutes; every person's score to 🏆. Against the running app (H3_URL). */
"use strict";
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const LLM_PORT = 8397;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
// a stand-in LLM: OpenAI chat completions; mode "fast" answers option 1 at once, "slow" waits 8 s
const LLM = { mode: "fast", seen: [] };
const llmServer = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => { b += c; }); req.on("end", () => {
    let j = {}; try { j = JSON.parse(b); } catch { /* fine */ }
    LLM.seen.push(j);
    const answer = () => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { content: '{"choice": 1, "why": "A degree pays most over a long life."}' }, finish_reason: "stop" }], usage: {} })); };
    if (LLM.mode === "slow") setTimeout(answer, 8000); else answer();
  });
});
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  await new Promise((r) => llmServer.listen(LLM_PORT, "127.0.0.1", r));
  const cfg = (o) => fetch(URL_ + "api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ llm: o }) });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.H3Life.info());
  try {
    await p.addInitScript(() => { try { if (window.top !== window) return; } catch (e) { return; } if (!sessionStorage.getItem("t964")) { sessionStorage.setItem("t964", "1");
      ["h3.life.save", "h3.g.lifedock", "h3.life.speed", "h3.life.name", "h3.life.seats", "h3.life.bots", "h3.life.llmwait"].forEach((k) => localStorage.removeItem(k)); } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof toggleDockGone === "function" && window.H3Life && window.H3LifeLLM && document.getElementById("lifedock"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tester 964" }) }));
    await p.click("#tX_lifedock");
    await p.waitForFunction(() => document.getElementById("lcSetup").classList.contains("on") && document.getElementById("lcName") && document.getElementById("lcName").value, null, { timeout: 8000 });
    const s0 = await ev(() => ({ seats: window.H3Life.seats(), bots: document.getElementById("lcBots").value, rows: document.querySelectorAll("#lcSeats .lcseat").length }));
    check("the set-up: seats - you (named from bitGen) + two bots at first; Bots shows 2", s0.rows === 3 && s0.seats[0].name === "Tester 964" && s0.seats[0].type === "human" && s0.seats[1].type === "saver" && s0.seats[2].type === "tycoon" && s0.bots === "2", s0);
    await p.selectOption("#lcBots", "0"); await p.waitForTimeout(100);
    const s1 = await ev(() => ({ n: window.H3Life.seats().length, start: document.getElementById("lcStart").disabled, hint: document.getElementById("lcSeatHint").textContent }));
    check("Bots 0: only you - Start is off, the hint says a game needs two or more", s1.n === 1 && s1.start && /two or more/.test(s1.hint), s1);
    await p.click("#lcAddPerson"); await p.keyboard.type("Bea"); await p.click("#lcAddLlm"); await p.selectOption("#lcBots", "1"); await p.waitForTimeout(100);
    const s2 = await ev(() => ({ seats: window.H3Life.seats(), start: document.getElementById("lcStart").disabled, hint: document.getElementById("lcSeatHint").textContent, focus: document.activeElement && document.activeElement.getAttribute("aria-label") }));
    check("＋ 🙂 Person (its name box focused, typed), ＋ 🧠 LLM player (named Nova), Bots 1 keeps the people and the 🧠 player",
      s2.seats.map((q) => q.name + ":" + q.type).join() === "Tester 964:human,Bea:human,Nova:llm,Ava:saver" && !s2.start && /2 people take turns/.test(s2.hint) && /🧠 LLM players use the LLM/.test(s2.hint), s2);
    // change a seat's type: Ava -> a risk-taker keeps her name; a bot seat -> 🧠 takes an LLM name
    await p.selectOption('#lcSeats .lcseat[data-seat="3"] [data-seat-type]', "risk"); await p.waitForTimeout(60);
    const s3 = await ev(() => window.H3Life.seats()[3]);
    check("a seat's type changes in place (Ava, now a risk-taker)", s3.name === "Ava" && s3.type === "risk", s3);
    await p.selectOption("#lcRetire", "30"); await p.selectOption("#lcLlmWait", "10"); await p.selectOption("#lcSpeed", "fast");
    await p.click("#lcStart"); await p.waitForTimeout(400);
    const g1 = await ev(() => { const s = window.H3Life.state(); return { pl: s.players.map((q) => [q.name, q.bot, q.llm]), handed: s.handed, retire: s.retire, wait: window.H3Life.llm().wait,
      seatsLS: JSON.parse(localStorage.getItem("h3.life.seats") || "[]").length, table: document.getElementById("lcPlayers").textContent }; });
    check("▶ Start: two people, a 🧠 LLM player (a tycoon's rules to fall back on), a risk-taker bot; 🧠 / 🤖 in the table; the seats and the 🧠 time kept",
      JSON.stringify(g1.pl) === JSON.stringify([["Tester 964", null, false], ["Bea", null, false], ["Nova", "tycoon", true], ["Ava", "risk", false]]) && g1.retire === 30 && g1.wait === 10 && g1.seatsLS === 4 && /Nova 🧠/.test(g1.table) && /Ava 🤖/.test(g1.table), g1);
    // pass the PC
    const p1 = await ev(() => ({ i: window.H3Life.info(), body: document.getElementById("lcPassBody").textContent, go: document.getElementById("lcPassGo").textContent, roll: !!document.getElementById("lcRoll"), focus: document.activeElement && document.activeElement.id }));
    check("two people: the \"pass the PC\" screen first - whose turn, no 🎲 Roll behind it, ▶ focused", p1.i.pass && p1.i.people === 2 && p1.i.handed === -1 && /Pass the PC to Tester 964/.test(p1.body) && /I'm Tester 964/.test(p1.go) && !p1.roll && p1.focus === "lcPassGo", p1);
    await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    const p2 = await ev(() => ({ i: window.H3Life.info(), roll: !!document.getElementById("lcRoll"), log: window.H3Life.state().log.slice(-1)[0].t, pz: window.H3Life.state().players[0].age }));
    check("Enter hands it over (not a roll): the screen goes, 🎲 Roll is there, \"takes the PC\" in the log", !p2.i.pass && p2.i.handed === 0 && p2.roll && /Tester 964 takes the PC/.test(p2.log) && p2.pz === 16 && !(await ev(() => !!window.H3Life.state().luck)), p2);
    // Tester's turn: roll and answer whatever comes
    await p.click("#lcRoll"); await p.waitForTimeout(300);
    const z = await ev(() => { const s = window.H3Life.state(); return s.puz && { kind: s.puz.p.kind, answer: String(s.puz.p.answer), choices: s.puz.p.choices || null }; });
    if (z) { if (z.kind === "choice") await p.click('[data-ans="' + z.choices.indexOf(z.answer) + '"]'); else { await p.fill("#lcAns", z.answer); await p.keyboard.press("Enter"); } await p.waitForTimeout(150); await p.keyboard.press("Enter"); }
    await p.waitForFunction(() => window.H3Life.info().pass, null, { timeout: 10000 });
    const p3 = await ev(() => ({ i: window.H3Life.info(), body: document.getElementById("lcPassBody").textContent, turn: window.H3Life.state().turn }));
    check("...then Bea's turn: the screen again, for Bea", p3.i.pass && p3.turn === 1 && /Pass the PC to Bea/.test(p3.body), p3);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Life && window.H3Life.state() && document.body.classList.contains("lc-full") !== undefined, null, { timeout: 60000 });
    await p.waitForTimeout(900);
    if (!(await ev(() => window.H3Life.info().shown))) { await p.click("#tX_lifedock"); await p.waitForTimeout(600); }
    const p4 = await info();
    check("kept over a reload: still Bea's turn, still waiting for her to take the PC", p4.pass && p4.handed === 0 && p4.turn === 1, p4);
    await p.click("#lcPassGo"); await p.waitForTimeout(150);
    check("▶ I'm Bea: she has the PC", (await info()).handed === 1 && !(await info()).pass);
    // ---- the 🧠 player: Nova at the fork, the LLM decides
    await cfg({ external_url: "http://127.0.0.1:" + LLM_PORT + "/v1/chat/completions", external_model: "stub" });
    LLM.mode = "fast"; LLM.seen = [];
    const fork = () => ev(() => { const s = window.H3Life.state(), n = s.players[2]; n.ring = "fork"; n.pos = 0; n.qual = "diploma"; n.dropped = []; n.skill = 0.5; s.pending = null; s.phase = "roll"; s.puz = null; s.turn = 2; window.H3Life.speed("fast"); });
    await fork();
    await p.waitForFunction(() => window.H3Life.llm().last && window.H3Life.state().players[2].ring !== "fork", null, { timeout: 15000 });
    const l1 = await ev(() => ({ ring: window.H3Life.state().players[2].ring, last: window.H3Life.llm().last, log: window.H3Life.state().log.map((x) => x.t).filter((t) => /^🧠/.test(t)) }));
    const req = LLM.seen[0] || {}, um = ((req.messages || []).find((m) => m.role === "user") || {}).content || "", sm = ((req.messages || []).find((m) => m.role === "system") || {}).content || "";
    check("🧠 Nova at the fork: bitGen's LLM is asked (its situation, the numbered options, JSON only) through the app's route",
      LLM.seen.length >= 1 && /You are Nova/.test(um) && /1\. 🎓 College/.test(um) && /2\. 🔧 Trades/.test(um) && /Answer with JSON only/.test(sm), { n: LLM.seen.length, um: um.slice(0, 400) });
    check("...its pick (1 = college) is made, its reason in the log", l1.ring === "college" && l1.last.id === "college" && l1.log.some((t) => /🧠 Nova chooses: 🎓 College.* - A degree pays most over a long life\./.test(t)), l1);
    // too slow: the 🧠 time runs out -> the rule bot's pick
    await ev(() => window.H3Life.llmWait(3)); LLM.mode = "slow";
    await fork();
    await p.waitForFunction(() => window.H3Life.llm().busy, null, { timeout: 8000 });
    const busy = await ev(() => ({ b: window.H3Life.llm().busy, act: document.getElementById("lcAct").textContent }));
    check("while the LLM thinks: \"🧠 Nova is thinking: Your next step…\" and when it falls back", busy.b && busy.b.name === "Nova" && /🧠 Nova is thinking: Your next step/.test(busy.act) && /after 3 s it plays by its own rules/.test(busy.act), busy);
    await p.waitForFunction(() => !window.H3Life.llm().busy && window.H3Life.state().players[2].ring !== "fork", null, { timeout: 12000 });
    const l2 = await ev(() => ({ ring: window.H3Life.state().players[2].ring, log: window.H3Life.state().log.map((x) => x.t).filter((t) => /^🧠/.test(t)).slice(-1)[0], off: window.H3Life.llm().off }));
    check("no answer in 3 s: the rule bot's pick (a tycoon -> the factory), said in the log", l2.ring === "invest" && /no answer in 3 s - plays by its own rules this time/.test(l2.log) && !l2.off, l2);
    // no LLM at all: a second failure in a row -> its own rules for 5 minutes
    await cfg({ external_url: "http://127.0.0.1:8398/v1/chat/completions", external_model: "stub" });
    await ev(() => window.H3Life.llmWait(10));
    await fork();
    await p.waitForFunction(() => window.H3Life.llm().off && window.H3Life.state().players[2].ring !== "fork", null, { timeout: 15000 });
    const l3 = await ev(() => ({ log: window.H3Life.state().log.map((x) => x.t).filter((t) => /^🧠/.test(t)).slice(-1)[0], off: window.H3Life.llm().off }));
    check("no LLM answering twice: the 🧠 players use their own rules for 5 minutes (said once)", l3.off && /did not answer twice/.test(l3.log) && /5 minutes/.test(l3.log), l3);
    LLM.seen = [];
    await fork();
    await p.waitForFunction(() => window.H3Life.state().players[2].ring !== "fork", null, { timeout: 8000 });
    check("...meanwhile its choices are the rule bot's at once (the LLM not asked)", LLM.seen.length === 0 && !(await ev(() => window.H3Life.llm().busy)));
    // every person's score
    const before = await ev(() => fetch("/api/life-choices/scores").then((r) => r.json()).then((j) => j.scores.length));
    await ev(() => { const s = window.H3Life.state(); s.players.forEach((q) => { q.retired = true; q.cash = 9e6 + q.id; }); s.over = true; s.phase = "over"; s.pending = null; s.scored = false; window.H3Life.act(); });
    await p.waitForTimeout(800);
    const sc = await ev(() => fetch("/api/life-choices/scores").then((r) => r.json()).then((j) => j.scores.map((x) => x.name)));
    check("the end: every person's score goes to 🏆 (Tester 964 and Bea - not the bots)", sc.includes("Tester 964") && sc.includes("Bea") && !sc.includes("Nova") && !sc.includes("Ava"), { before, sc });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run stopped - " + (e && e.stack || e)); }
  finally {
    try { await cfg({ external_url: "", external_model: "" }); } catch { /* fine */ }
    llmServer.close(); await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
