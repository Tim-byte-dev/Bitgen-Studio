"use strict";
/* chatRecall (2.169.0): the chat's RAG. The session is rebuilt to a budget —
 * seed + relevant middle + recent tail — so llama-server never truncates the
 * system prompt (and the cast with it) off the top. */
const R = require("../lib/chatRecall.js");

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (detail !== undefined
    ? " -> " + JSON.stringify(detail) : "")); }
}
const mk = (r, t) => ({ role: r, text: t });

// ---- a short chat rides whole --------------------------------------------
{
  const prior = [mk("user", "hi"), mk("assistant", "hello"), mk("user", "plan a heist")];
  const out = R.build(prior, "go on", 5000);
  check("a chat inside the budget is sent WHOLE — recall never loses a short conversation",
        out.length === 3 && out[2].text === "plan a heist", out);
}

// ---- the seed, the tail, and the relevant middle -------------------------
{
  const prior = [
    mk("user", "a heist story with @jinx and the vault in the old bank"),
    mk("assistant", "noted, the vault it is"),
    ...Array.from({ length: 40 }, (_, i) =>
      mk(i % 2 ? "assistant" : "user", "filler about the weather " + i + " " + "x".repeat(220))),
    mk("user", "now write scene two where @jinx drills the vault door"),
    mk("assistant", "Scene two: @jinx sets the drill against the hinge"),
  ];
  const out = R.build(prior, "continue the vault heist with @jinx", 2600);
  const chars = out.reduce((n, m) => n + m.text.length, 0);
  check("the rebuilt chat respects the budget", chars <= 2600, chars);
  check("the SEED (first user message) always rides — it is what the chat is about",
        /heist story with @jinx/.test(out[0].text), out[0]);
  check("the recent TAIL always rides verbatim",
        /sets the drill against the hinge/.test(out[out.length - 1].text));
  check("the middle is RETRIEVED by relevance — the vault turn in, the weather out",
        out.some((m) => /drills the vault door/.test(m.text))
        && !out.some((m) => /weather 7 /.test(m.text)), out.map((m) => m.text.slice(0, 30)));
  const idx = out.map((m) => prior.findIndex((p) => p.text === m.text || p.text.endsWith(m.text)));
  check("order stays chronological after retrieval",
        idx.every((v, i) => i === 0 || v >= idx[i - 1]), idx);
}

// ---- seed + tail alone can overflow: clip old text, keep the newest words
{
  const prior = [
    mk("user", "S".repeat(3000)),
    mk("assistant", "A".repeat(3000)),
    mk("user", "the newest ask ends with THESE WORDS"),
  ];
  const out = R.build(prior, "anything", 1200);
  const chars = out.reduce((n, m) => n + m.text.length, 0);
  check("an overflowing seed+tail is clipped to the budget, never dropped whole",
        chars <= 1200 && out.length >= 1, chars);
  check("the newest words survive the clip — they are what is being replied to",
        /THESE WORDS$/.test(out[out.length - 1].text), out[out.length - 1].text.slice(-40));
}

// ---- the cast note -------------------------------------------------------
{
  const note = R.castNote([
    { name: "Jinx", tag: "jinx", type: "person", age: "19" },
    { name: "Kitt", tag: "kitt", type: "vehicle", subtype: "sports car",
      color: "black", model: "Trans Am", year: "1982" },
    { name: "Jacket", tag: "jacket", type: "clothing", subtype: "leather jacket", color: "black" },
  ], [{ name: "w", tag: "old_warehouse" }]);
  check("the cast note names every @tag with its type and headline facts",
        /@jinx — age 19/.test(note) && /@kitt \(sports car\) — black, Trans Am, 1982/.test(note)
        && /@jacket \(leather jacket\)/.test(note) && /@old_warehouse/.test(note), note);
  check("the note forbids invented characters in scene asks",
        /never invent characters/.test(note));
  check("no cast, no note (the chat stays clean for cast-less projects)",
        R.castNote([], []) === "" && R.castNote(null, null) === "");
}

// ---- digest (2.174.0, "do a rag of the chat to complete the response") -----
// The same retriever, flattened for the screenplay writer's system prompt.
{
  const prior = [
    { role: "user", text: "let's make a heist story on the neon pier" },
    { role: "assistant", text: "Great — who's the crew?" },
    { role: "user", text: "jinx cracks the vault, storms   at midnight" },
  ];
  const d = R.digest(prior, "create a screenplay about the heist", 4000);
  check("digest carries the story lines with speaker prefixes",
        /User: let's make a heist story on the neon pier/.test(d)
        && /Assistant: Great/.test(d)
        && /jinx cracks the vault/.test(d), d);
  check("digest collapses internal whitespace so one turn is one line",
        /storms at midnight/.test(d) && !/storms {2,}/.test(d));
  check("digest respects a tiny budget instead of overflowing the writer's prompt",
        R.digest(prior, "heist", 40).length <= 40);
  check("an empty conversation digests to an empty string",
        R.digest([], "anything", 4000) === "");
}

console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
