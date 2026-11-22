#!/usr/bin/env node
// bitGen Studio 2.921.0 - the 📱 app's 🎙 Talk: questions, 🌐 Web, 🧑‍💼 Assistant / 🤝 Friend, spoken back.
// Tim: "in the android app when user speaks check keywords, find , search, what is? etc. Let's have a chat, what's? will question
// the llm. add a web button so it searches the internet. act as a personal assistant or just have a chat as a friend . speak back
// to me". Units: lib/appVoice.js's words, the system notes, handle() with stand-in LLMs (web or not, which persona), the route,
// the live stream session and the app's buttons. The browser run is scripts/test-ui921-ui.js. Run: node scripts/test-921.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 600)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  const V = require("../lib/appVoice");
  const c = (t, p) => V.classify(t, p);
  const kinds = (l) => l.map((t) => c(t).kind);
  check("what is / what's / who / when / where / why / how much / tell me about / explain -> a question (ask)",
    kinds(["what is the capital of France", "What's the time in Tokyo", "whats a black hole", "who won the grand final", "when does Woolworths close",
      "where is Uluru", "why is the sky blue", "how much is a Galaxy Z Fold 8", "how far is the moon", "tell me about the Roman empire", "explain quantum computing",
      "is it going to rain today", "do you know any good films", "can you tell me what a VPN is", "Hey bitGen, what's the weather in Perth"]).every((k) => k === "ask"),
    kinds(["what is the capital of France", "What's the time in Tokyo", "how much is a Galaxy Z Fold 8", "Hey bitGen, what's the weather in Perth"]));
  check("...the question kept whole as the words (\"Hey bitGen\" taken off)", c("Hey bitGen, what's the weather in Perth").text === "what's the weather in Perth");
  check("find / search for / look up still -> the web search (not a question)", c("find cheapest flights to china").kind === "find" && c("search for ramen near me").kind === "find" && c("look up the weather in Perth").kind === "find");
  check("small talk stays a chat (how are you / thanks / I had a long day)", kinds(["how are you today", "thanks mate", "I had a long day"]).every((k) => k === "chat"));
  const f1 = c("Let's have a chat"), f2 = c("lets have a chat about movies"), f3 = c("can we talk for a bit"), f4 = c("chat with me"), f5 = c("be my friend");
  check("let's have a chat / let's talk / can we talk / chat with me / be my friend -> the 🤝 friend", [f1, f2, f3, f4, f5].every((x) => x.kind === "persona" && x.persona === "friend") && f2.text === "movies" && f1.text === "", [f1, f2, f3]);
  const a1 = c("be my assistant"), a2 = c("assistant mode"), a3 = c("let's get to work, what's on today");
  check("be my assistant / assistant mode / let's get to work -> the 🧑‍💼 assistant (the rest kept)", [a1, a2, a3].every((x) => x.kind === "persona" && x.persona === "assistant") && a3.text === "what's on today", [a1, a3]);
  check("making things and goodbye are not taken for questions", c("make a video of a cat").kind === "video" && c("draw a picture of a kite").kind === "image" && c("okay goodbye").kind === "bye" && c("what's that song = song".split(" = ")[0], ["what's that song = song"]).kind === "song");
  check("your own phrases can say ask / question", JSON.stringify(V.parsePhrases("tell me = ask\nquick q = question")) === '[{"phrase":"tell me","kind":"ask"},{"phrase":"quick q","kind":"ask"}]');

  const nA = V.note("assistant", "", false), nF = V.note("friend", "", true);
  check("the assistant's note: a personal assistant, practical, honest about what it cannot do, today's date, said aloud (no markdown)",
    /personal assistant/.test(nA) && /cannot do/.test(nA) && /Today is \w+day/.test(nA) && /read aloud/.test(nA) && !/search the web/.test(nA));
  check("the friend's note: a friend, warm, a question back, honest it is an AI; with 🌐 the web note", /as a friend/.test(nF) && /warm/.test(nF) && /question back/.test(nF) && /an AI on their PC, not\s+a person/.test(nF) && /You can search the web/.test(nF));

  // handle() with stand-in LLMs: which way it went, what it was told
  const calls = [];
  const fake = (mod, fn) => { const k = require.resolve("../lib/" + mod); require(k); require.cache[k].exports = Object.assign({}, require.cache[k].exports, fn); };
  fake("llmChat", { complete: async (core, o) => { calls.push({ via: "chat", sys: o.messages[0].content, msgs: o.messages }); return { ok: true, text: "<think>hm</think>Paris." }; }, stripThinking: (t) => t.replace(/<think>[\s\S]*?<\/think>/g, "") });
  fake("llmAgent", { run: async (core, o) => { calls.push({ via: "web", sys: o.messages[0].content, web: o.web }); return { ok: true, text: "It's 31 degrees in Perth.", sources: [{ title: "BoM", url: "https://bom.gov.au/x" }] }; } });
  delete require.cache[require.resolve("../lib/appVoice")];
  const H = require("../lib/appVoice");
  const r1 = await H.handle(null, { text: "what is the capital of France", history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] });
  check("a question, 🌐 off: this PC's LLM answers (no web), the assistant by default, the conversation kept", r1.intent === "ask" && r1.reply === "Paris." && r1.persona === "assistant" && r1.web === false
    && calls[0].via === "chat" && /answer it directly/.test(calls[0].sys) && calls[0].msgs.length === 4, { r1, c: calls[0] && calls[0].msgs.length });
  const r2 = await H.handle(null, { text: "what's the weather in Perth", web: true });
  check("a question, 🌐 on: the web tools (it searches when it needs to) - the sources back", r2.intent === "ask" && r2.web === true && r2.sources.length === 1 && calls[1].via === "web" && calls[1].web === true && /You can search the web/.test(calls[1].sys), r2);
  const r3 = await H.handle(null, { text: "how are you going", web: "1", persona: "friend" });
  check("a chat as the friend, 🌐 on (\"1\" from the form): the friend's note + the web", r3.intent === "chat" && r3.persona === "friend" && calls[2].via === "web" && /as a friend/.test(calls[2].sys), r3);
  const r4 = await H.handle(null, { text: "find cheapest flights to china", web: false });
  check("find … with 🌐 OFF still searches (you asked for it)", r4.intent === "find" && r4.text === "cheapest flights to china" && calls[3].via === "web" && /asked you to search/.test(calls[3].sys), r4);
  const r5 = await H.handle(null, { text: "let's have a chat", persona: "assistant", web: true });
  check("\"let's have a chat\": the friend from now on (the result says so), a friendly hello - no search for a hello", r5.intent === "persona" && r5.persona === "friend" && calls[4].via === "chat" && /say hi like a friend/.test(calls[4].sys) && /as a friend/.test(calls[4].sys), r5);
  const r6 = await H.handle(null, { text: "be my assistant", persona: "friend" });
  check("\"be my assistant\": back to the assistant", r6.intent === "persona" && r6.persona === "assistant" && /personal assistant/.test(calls[5].sys), r6);
  const r7 = await H.handle(null, { text: "make a video of a tiger", persona: "friend" });
  check("making something is still the app's job (no LLM), the persona kept", r7.intent === "video" && r7.text === "a tiger" && r7.persona === "friend" && calls.length === 6, r7);
  fake("llmChat", { complete: async () => ({ ok: false, error: "no LLM is running" }) });
  delete require.cache[require.resolve("../lib/appVoice")];
  const r8 = await require("../lib/appVoice").handle(null, { text: "who is the prime minister" });
  check("no LLM: the error said, not a crash", r8.intent === "ask" && r8.error === "no LLM is running", r8);

  const rv = src("routes/appVoice.js"), vs = src("lib/voiceStream.js");
  check("POST /api/app/voice passes web (1) and the persona on", /web: b\.web === "1" \|\| b\.web === "true"/.test(rv) && /persona: b\.persona === "friend" \? "friend" : "assistant"/.test(rv));
  check("the live stream session keeps web + the persona and hands them to lib/appVoice", /persona: x\.persona === "friend"/.test(vs) && /web: s\.web, persona: s\.persona/.test(vs));
  check("server.js untouched by this (routes/appVoice.js, lib/appVoice.js, lib/voiceStream.js)", !/appVoice|persona/.test(src("misc/server.js")));

  const app = src("mobile/www/app.js"), html = src("mobile/www/index.html");
  check("the app: 🧑‍💼 Assistant / 🤝 Friend and 🌐 Web on the Talk screen", /id="personaSeg"[\s\S]{0,200}data-p="assistant"[\s\S]{0,80}data-p="friend"/.test(html) && /id="talkWeb"[^>]*aria-pressed="false"/.test(html));
  check("...both sent with every turn (the recording and the live stream) and kept on the phone", /fd\.append\("web", talkWeb \? "1" : "0"\); fd\.append\("persona", persona\)/.test(app) && /web: talkWeb, persona: persona/.test(app)
    && /kset\("talkWeb"/.test(app) && /kset\("persona"/.test(app) && /"talkWeb", "persona"\]\.map\(kget\)/.test(app));
  check("...a question / persona switch is answered, kept in the conversation and SAID (the reply goes through speak); the switch moves the buttons",
    /j\.intent === "ask" \|\| j\.intent === "persona"/.test(app) && /if \(j\.persona && j\.persona !== persona\) setPersona\(j\.persona, true\)/.test(app) && /return speak\(lastSaid\)/.test(app));
  check("the help says the new words", /what is …<\/b> \/ <b>what's …/.test(html) && /let's have a chat<\/b>/.test(html) && /be my assistant<\/b>/.test(html));
  check("the app's version 1.9.0 or later", /^1\.(9|[1-9]\d)\./.test(JSON.parse(src("mobile/package.json")).version));

  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL:", e && e.stack || e); process.exit(1); });
