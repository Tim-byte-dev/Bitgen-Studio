"use strict";
// bitGen Studio — lib/llmChat.js unit tests (2.188.0).
//
// THE STRICT-TEMPLATE ARMOR. Tim's card, verbatim: "Unable to generate
// parser for this template. Automatic parser generation failed: ...
// raise_exception('After the optional system message, con..." — a
// Mistral/Gemma-family chat template refusing two user turns in a row.
// alternate() merges adjacent same-role messages at the single gate every
// LLM call passes, so no caller can trip the rule again.

const { alternate } = require("../lib/llmChat.js");

let fail = 0;
function check(name, cond, detail) {
  if (cond) console.log("PASS: " + name);
  else { fail++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail)); }
}

// the exact shape that killed scene 7/8: [system, user, user]
{
  const out = alternate([
    { role: "system", content: "guide" },
    { role: "user", content: "write scene 7" },
    { role: "user", content: "Reply with ONLY the JSON." },
  ]);
  check("the killer shape [system, user, user] merges to [system, user]",
        out.length === 2 && out[0].role === "system" && out[1].role === "user", out);
  check("...and the merged user turn keeps BOTH texts, in order, blank-line joined",
        out[1].content === "write scene 7\n\nReply with ONLY the JSON.", out[1].content);
}

// an already-alternating conversation passes through untouched
{
  const msgs = [
    { role: "system", content: "s" },
    { role: "user", content: "u1" },
    { role: "assistant", content: "a1" },
    { role: "user", content: "u2" },
  ];
  const out = alternate(msgs);
  check("an alternating [system, user, assistant, user] is untouched",
        JSON.stringify(out.map((m) => [m.role, m.content]))
        === JSON.stringify(msgs.map((m) => [m.role, m.content])), out);
  check("...and the input array's own messages are not mutated",
        msgs[1].content === "u1" && out[1] !== msgs[1]);
}

// runs of three, and same-role runs in the middle
{
  const out = alternate([
    { role: "user", content: "a" },
    { role: "user", content: "b" },
    { role: "user", content: "c" },
    { role: "assistant", content: "x" },
    { role: "assistant", content: "y" },
  ]);
  check("runs collapse: [user x3, assistant x2] -> [user, assistant]",
        out.length === 2 && out[0].content === "a\n\nb\n\nc" && out[1].content === "x\n\ny", out);
}

// two system messages (the guide + a caller's extra instructions) merge too
{
  const out = alternate([
    { role: "system", content: "guide" },
    { role: "system", content: "extra" },
    { role: "user", content: "go" },
  ]);
  check("adjacent system messages merge — a template sees ONE optional system",
        out.length === 2 && out[0].content === "guide\n\nextra", out);
}

// holes and empties survive without crashing
{
  const out = alternate([null, { role: "user", content: "a" }, undefined,
                         { role: "user" }]);
  check("nulls are dropped and a content-less message merges as empty text",
        out.length === 1 && out[0].content === "a\n\n", out);
}

console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
