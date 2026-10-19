#!/usr/bin/env node
// Unit tests for lib/chatStore.js — the prompt-chat transcript.
// Run: node scripts/test-chatstore.js
//
// The whole point of this store is CONTINUITY: "have the llm read the history
// of todays and yesterdays chat so it knows where we are up to". So the tests
// that matter are the ones about a boundary nobody ever reproduces by hand —
// midnight — and about what survives a file that has been damaged.
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require(path.join(__dirname, "..", "lib", "chatStore"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const ws = () => fs.mkdtempSync(path.join(os.tmpdir(), "chat-"));
const at = (y, m, d, hh = 12, mm = 0, ss = 0) => new Date(y, m - 1, d, hh, mm, ss);

// ------------------------------------------------------------------- naming
{
  const d = at(2026, 8, 22, 20, 33, 25);
  check("a session is named date_time.chat", C.sessionName(d) === "2026-08-22_203325.chat",
    C.sessionName(d));
  check("the name sorts chronologically as text, so 'newest' needs no stat",
    C.sessionName(at(2026, 8, 22, 9, 5, 1)) < C.sessionName(at(2026, 8, 22, 10, 0, 0)), null);
  check("the day is read back off the name",
    C.dayOf("2026-08-22_203325.chat") === "2026-08-22", C.dayOf("2026-08-22_203325.chat"));
  check("a stray file in the folder is not mistaken for a session",
    C.dayOf("notes.txt") === "", C.dayOf("notes.txt"));
  check("the day key is LOCAL time — 'today' means the user's today, not UTC's",
    C.dayKey(at(2026, 8, 22, 23, 59, 59)) === "2026-08-22",
    C.dayKey(at(2026, 8, 22, 23, 59, 59)));
}

// ------------------------------------------------------------ append + read
{
  const d = ws();
  const f = C.currentSession(d, at(2026, 8, 22, 10));
  check("a session file is created on first use", fs.existsSync(path.join(d, f)), f);
  C.append(d, f, "user", "a woman walking in rain");
  C.append(d, f, "assistant", "What lens?");
  const got = C.read(d, f);
  check("both messages come back in order",
    got.length === 2 && got[0].role === "user" && got[1].role === "assistant", got);
  check("the text survives exactly", got[0].text === "a woman walking in rain", got[0]);
  check("each message carries a timestamp", /^\d{4}-\d{2}-\d{2}T/.test(got[0].t), got[0].t);
  check("an unknown role is stored as 'user' rather than passed through",
    (C.append(d, f, "system", "x"), C.read(d, f)[2].role === "user"), C.read(d, f)[2]);
}
{
  // ONE BAD LINE COSTS ONE LINE. Appending is a single write precisely so that
  // a crash mid-save cannot corrupt what is already there; the read has to hold
  // up its end of that bargain.
  const d = ws();
  const f = "2026-08-22_120000.chat";
  fs.writeFileSync(path.join(d, f),
    '{"t":"1","role":"user","text":"first"}\n'
    + "{ this line is not json\n"
    + "\n"
    + '{"t":"2","role":"assistant","text":"second"}\n', "utf8");
  const got = C.read(d, f);
  check("a damaged line is skipped, not fatal to the rest of the day",
    got.length === 2 && got[0].text === "first" && got[1].text === "second", got);
  check("reading a file that is not there is empty, not a throw",
    C.read(d, "nope.chat").length === 0, null);
  // A FILE where a folder should be: mkdir fails, and append must report that
  // rather than throwing out of a request handler.
  const blocked = path.join(d, "blocked");
  fs.writeFileSync(blocked, "not a folder");
  check("appending where a folder cannot exist reports false instead of throwing",
    C.append(path.join(blocked, "sub"), "x.chat", "user", "y") === false, null);
}
{
  const d = ws();
  const f = C.currentSession(d, at(2026, 8, 22));
  C.append(d, f, "user", "x".repeat(C.MAX_TEXT + 500));
  check("one enormous paste is capped rather than swallowing the context window",
    C.read(d, f)[0].text.length === C.MAX_TEXT, C.read(d, f)[0].text.length);
}

// ------------------------------------------------------- today and yesterday
{
  const d = ws();
  const write = (name, lines) => fs.writeFileSync(path.join(d, name),
    lines.map((x) => JSON.stringify({ t: "2026-01-01T00:00:00Z", role: "user", text: x })).join("\n") + "\n");
  write("2026-08-20_100000.chat", ["three days ago"]);
  write("2026-08-21_100000.chat", ["yesterday"]);
  write("2026-08-22_090000.chat", ["today early"]);
  write("2026-08-22_180000.chat", ["today late"]);
  const now = at(2026, 8, 22, 20);
  const h = C.history(d, { now, limit: 0 });
  check("TODAY AND YESTERDAY are replayed — that is the whole feature",
    h.map((m) => m.text).join("|") === "yesterday|today early|today late",
    h.map((m) => m.text));
  check("...and older days are left out, so the window stays bounded",
    !h.some((m) => m.text === "three days ago"), h.map((m) => m.text));
  check("each message says which session it came from",
    h[0].session === "2026-08-21_100000.chat", h[0]);
  check("one day means only today", C.history(d, { now, days: 1, limit: 0 })
    .every((m) => m.text.startsWith("today")), null);
  // THE MONTH BOUNDARY. Naive "yesterday = day - 1" arithmetic breaks on the
  // 1st, and this is the only bug in the file that waits a month to appear.
  const d2 = ws();
  fs.writeFileSync(path.join(d2, "2026-07-31_230000.chat"),
    JSON.stringify({ t: "x", role: "user", text: "last night" }) + "\n");
  check("yesterday still works across a month boundary",
    C.history(d2, { now: at(2026, 8, 1, 9), limit: 0 }).length === 1, null);
  const d3 = ws();
  fs.writeFileSync(path.join(d3, "2025-12-31_230000.chat"),
    JSON.stringify({ t: "x", role: "user", text: "last year" }) + "\n");
  check("...and across a year boundary",
    C.history(d3, { now: at(2026, 1, 1, 9), limit: 0 }).length === 1, null);
}
{
  const d = ws();
  const f = C.currentSession(d, at(2026, 8, 22));
  for (let i = 0; i < C.MAX_CONTEXT_MESSAGES + 20; i += 1) C.append(d, f, "user", "m" + i);
  // `now` is PINNED to the session's own day. With `new Date()` this check
  // passed on the day it was written and failed two days later, when the
  // 08-22 session fell outside the two-day window — a test that depends on
  // the calendar is the month-boundary bug above wearing a different hat.
  const h = C.history(d, { now: at(2026, 8, 22, 18) });
  check("the context is capped so a long day cannot overflow the model",
    h.length === C.MAX_CONTEXT_MESSAGES, h.length);
  check("...and it keeps the MOST RECENT, where the current idea lives",
    h[h.length - 1].text === "m" + (C.MAX_CONTEXT_MESSAGES + 19), h[h.length - 1]);
}

// ------------------------------------------------------------------ sessions
{
  const d = ws();
  const a = C.currentSession(d, at(2026, 8, 22, 9));
  const b = C.currentSession(d, at(2026, 8, 22, 17));
  check("the same day CONTINUES one file — otherwise it is not a conversation",
    a === b, [a, b]);
  const c = C.currentSession(d, at(2026, 8, 23, 9));
  check("a new day starts a new file on its own", c !== a, [a, c]);
  const n1 = C.newSession(d, at(2026, 8, 23, 9, 30, 0));
  const n2 = C.newSession(d, at(2026, 8, 23, 9, 30, 0));
  check("'New chat' starts a fresh file even though today already has one",
    n1 !== c, [c, n1]);
  check("...twice in the same second without one overwriting the other",
    n1 !== n2 && fs.existsSync(path.join(d, n1)) && fs.existsSync(path.join(d, n2)), [n1, n2]);
  check("the old conversation is still on disk, not replaced",
    C.sessions(d).length >= 4, C.sessions(d));
  check("a missing folder lists nothing rather than throwing",
    C.sessions(path.join(d, "nope")).length === 0, null);
}


// ===== reading a reply out of a model that thinks (2.85.1) ==================
// Tim's chat answered "⚠ LLM returned an empty response" to `hi`. A REASONING
// model had spent the whole token budget inside a <think> block: llama-server
// splits those into reasoning_content and leaves content empty, and if the
// budget runs out before the block closes there is nothing to leave. The old
// code reported the one thing that was certainly not the problem.
{
  const L = require(path.join(__dirname, "..", "lib", "llmChat"));
  const reply = (m, why) => L.readReply({ choices: [{ message: m, finish_reason: why }] });
  check("an ordinary reply comes back unchanged",
    reply({ content: "Here is your song." }).text === "Here is your song.", null);
  check("a <think> block is stripped, not shown as the answer",
    reply({ content: "<think>the user wants a song</think>Verse one:" }).text === "Verse one:",
    reply({ content: "<think>x</think>Verse one:" }).text);
  check("an UNCLOSED think block yields no answer — it is not one",
    reply({ content: "<think>let me consider the rhyme" }).ok === false, null);
  check("reasoning_content is used when that is all there is, because a thought "
    + "on screen beats an empty error",
    reply({ content: "", reasoning_content: "a partial idea" }).text === "a partial idea",
    null);
  const cut = reply({ content: "" }, "length");
  check("running out of tokens SAYS SO, and names the likely cause",
    cut.ok === false && /token budget/.test(cut.error) && /reasoning model/.test(cut.error),
    cut.error);
  const none = reply({ content: "" }, "stop");
  check("a genuinely empty answer reports finish_reason, so the two are "
    + "distinguishable at last",
    none.ok === false && /stop/.test(none.error), none.error);
  check("a malformed body does not throw out of a request handler",
    L.readReply({}).ok === false && L.readReply(null).ok === false, null);
  check("thinking is turned OFF in the request, which is the real fix",
    /enable_thinking:\s*false/.test(
      fs.readFileSync(path.join(__dirname, "..", "lib", "llmChat.js"), "utf8")), null);
}

// 2.115.1: current() is the current session only
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cs-"));
  const now = at(2026, 8, 22, 18);
  C.append(d, C.currentSession(d, now), "user", "first session", now);
  const s2 = C.newSession(d, at(2026, 8, 22, 19));
  C.append(d, s2, "user", "second session", at(2026, 8, 22, 19));
  const cur = C.current(d, { now: at(2026, 8, 22, 20), limit: 0 });
  check("current() returns only the newest session's messages (New chat clears the window and the model's context)",
    cur.length === 1 && cur[0].text === "second session" && cur[0].session === s2, cur);
  check("...while history() still spans the day", C.history(d, { now: at(2026, 8, 22, 20), limit: 0 }).length === 2, null);
  // two New chats inside one second: "-2.chat" sorts before ".chat" by name; the newest must still win
  const dd = fs.mkdtempSync(path.join(os.tmpdir(), "cs2-")); const t = new Date();
  const f1 = C.currentSession(dd, t); C.append(dd, f1, "user", "old", t);
  const f2 = C.newSession(dd, t); const f3 = C.newSession(dd, t);
  check("currentSession picks the NEWEST session even when same-second names sort backwards (-2, -3)",
    /-2\.chat$/.test(f2) && /-3\.chat$/.test(f3) && C.currentSession(dd, new Date(t.getTime() + 50)) === f3, [f1, f2, f3, C.currentSession(dd, new Date(t.getTime() + 50))]);
}
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
