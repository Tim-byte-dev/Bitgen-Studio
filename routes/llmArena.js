// bitGen Studio — routes/llmArena.js (2.584.0): the prompt docker's 🔁 Compare LLMs (lib/llmArena.js; the replies
// themselves come from /api/chat with an `arena` field - the same system prompt, recall and context as any chat turn).
//   POST /api/llmarena/start   {text, gen_mode, llms}  -> {id, kind, llms}     a round: every LLM will answer `text`
//   POST /api/llmarena/pick    {id, n}                 the reply n is THE answer: it goes into the chat; n -1 = none
//   GET  /api/llmarena/stats                           the best LLM for each job (wins, win rate, avg seconds)
//   GET  /api/llmarena/rounds?kind=&limit=             the rounds, newest first (the request, every reply, the choice)
//   GET  /api/llmarena/export.csv                      every reply of every round
//   POST /api/llmarena/delete {id}  ·  POST /api/llmarena/clear
//   2.585.0 GET  /api/llmarena/trainset?kind=&include_system=   {chats, prefs, rounds, with_prompt, without_prompt,
//                                                                longest_tokens, jobs: the trainer's LLM jobs}
//           POST /api/llmarena/to-trainer {job, kind, what: chats|prefs|both, include_system, replace}  -> what was added
"use strict";
const core = require("../lib/core");
const arena = require("../lib/llmArena");
const chatStore = require("../lib/chatStore");

function mount(app) {
  app.post("/api/llmarena/start", (req, res) => {
    const r = arena.start(core, req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ id: r.id, kind: r.kind, llms: r.llms });
  });
  app.post("/api/llmarena/pick", async (req, res) => {
    const b = req.body || {};
    const n = b.n == null ? -1 : Number(b.n);
    const out = await arena.pick(core, String(b.id || ""), n);
    if (!out) return res.status(404).json({ error: "no such round" });
    if (out.error) return res.status(400).json(out);
    const c = out.chosen;
    if (c) {
      // THE CHOSEN REPLY IS THE CONVERSATION'S ANSWER: written to the chat like any reply (with whose it was), so the
      // next turn - and the screenplay writer's recall - builds on it; the others stay in the round only
      try { const dir = core.pDir("chat"); chatStore.append(dir, chatStore.currentSession(dir), "assistant", c.reply); } catch { /* the round keeps it */ }
    }
    res.json({ ok: true, chosen: c ? { n: c.n, llm: c.llm, name: arena.llmName(c.llm), reply: c.reply, song: c.song || null } : null, kind: out.round.kind });
  });
  app.get("/api/llmarena/stats", (_req, res) => res.json(arena.stats(core)));
  app.get("/api/llmarena/rounds", (req, res) => res.json(arena.rounds(core, { kind: req.query.kind, limit: req.query.limit })));
  app.get("/api/llmarena/export.csv", (_req, res) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="llm-compare.csv"');
    res.send("﻿" + arena.csv(core));
  });
  // 2.585.0: the training set - what the decided rounds would give (?kind=&include_system=0|1) / into a 🎓 trainer LLM job
  app.get("/api/llmarena/trainset", (req, res) => {
    const set = arena.trainingSet(arena.allRounds(core), { kind: req.query.kind, include_system: req.query.include_system });
    let jobs = []; try { jobs = require("../lib/loraTrain").list().filter((j) => j.kind === "llm").map((j) => ({ name: j.name, examples: j.examples, prefs: j.prefs, objective: j.settings.objective, max_seq: j.settings.max_seq })); } catch { jobs = []; }
    res.json({ chats: set.chats.length, prefs: set.prefs.length, rounds: set.rounds, with_prompt: set.with_prompt, without_prompt: set.without_prompt, longest_tokens: arena.tokensOf(set.longest_chars), jobs });
  });
  app.post("/api/llmarena/to-trainer", (req, res) => {
    let r; try { r = arena.toTrainer(core, req.body || {}); } catch (e) { r = { error: String((e && e.message) || e) }; }
    res.status(r.error ? 400 : 200).json(r);
  });
  app.post("/api/llmarena/delete", (req, res) => { const r = arena.remove(core, String((req.body || {}).id || "")); res.status(r.error ? 404 : 200).json(r); });
  app.post("/api/llmarena/clear", (_req, res) => res.json(arena.clear(core)));
}

module.exports = { mount };
